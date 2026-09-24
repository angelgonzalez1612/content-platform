import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  CATEGORY_SLUGS,
  type ConnectionCheckResult,
  type ContentProvider,
  type PlaceDraftInput,
  type PlaceDraftOutput,
  type StructuredGenerateInput,
} from '../content-provider.interface';
import { killProcessTree } from './process-tree-kill';

const CLAUDE_TIMEOUT_MS = 60_000;

const PLACE_SYSTEM_PROMPT = `Eres redactor editorial de Planazo, una guía de planes y lugares de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información que te da el editor. NUNCA inventes dirección, teléfono, precios, horarios ni datos verificables que no te dieron.
- El tono es directo y útil, como alguien que ya fue y te está recomendando, no como un anuncio.
- Responde siempre en español de México.`;

// Describe una forma Zod en texto plano para el prompt — el CLI de Claude no
// tiene un modo de salida estructurada garantizada como response_format de
// OpenAI (ver checks.service.ts / ai-draft.service.ts), así que en vez de
// "forzar" el schema, se le pide en el prompt y se valida/reintenta después.
function describeZodShape(schema: z.ZodTypeAny): string {
  // Object.entries() sobre .shape en Zod v4 infiere el tipo interno $ZodType
  // en vez del público ZodTypeAny — son el mismo objeto en runtime, solo hay
  // que decírselo a TS explícitamente aquí.
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape as Record<string, z.ZodTypeAny>;
  const lines: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    lines.push(`- "${key}": ${describeType(field)}${field.description ? ` — ${field.description}` : ''}`);
  }
  return lines.join('\n');
}

function describeType(field: z.ZodTypeAny): string {
  const unwrapped = unwrap(field);
  if (unwrapped instanceof z.ZodString) return 'string';
  if (unwrapped instanceof z.ZodNumber) return 'number';
  if (unwrapped instanceof z.ZodBoolean) return 'boolean (true/false)';
  if (unwrapped instanceof z.ZodEnum) return `uno de: ${Object.values(unwrapped.enum).join(', ')}`;
  if (unwrapped instanceof z.ZodArray) return `array de ${describeType(unwrapped.element as z.ZodTypeAny)}`;
  if (unwrapped instanceof z.ZodObject) return `objeto {${Object.keys(unwrapped.shape).join(', ')}}`;
  return 'string';
}

function unwrap(field: z.ZodTypeAny): z.ZodTypeAny {
  let current = field;
  while (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
    current = current.unwrap() as z.ZodTypeAny;
  }
  return current;
}

// Los modelos suelen envolver el JSON en ```json ... ``` a pesar de que se
// les pida no hacerlo — se limpia antes de intentar JSON.parse.
function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

interface ClaudeCliResultEnvelope {
  is_error: boolean;
  result: string;
  subtype?: string;
}

// Invoca el CLI de Claude Code ya autenticado en esta máquina (suscripción
// Pro/Max vía OAuth, NO una API key nueva de pago por token) en modo
// no-interactivo. Deliberadamente sin --bare: ese modo exige
// ANTHROPIC_API_KEY y nunca lee la sesión OAuth — justo lo contrario de lo
// que se busca aquí. Ver la conversación que originó este archivo para el
// razonamiento completo (costo vs. garantías de OpenAI).
@Injectable()
export class ClaudeCliProvider implements ContentProvider {
  async generatePlaceDraft(input: PlaceDraftInput): Promise<PlaceDraftOutput> {
    const schema = z.object({
      description: z.string().describe('80-120 palabras, editorial, en español de México'),
      suggestedCategory: z.enum(CATEGORY_SLUGS),
      suggestedTags: z.array(z.string()).min(1).max(5),
    });

    const userPrompt = [
      `Nombre del lugar: ${input.name}`,
      input.hints ? `Notas del editor: ${input.hints}` : 'Notas del editor: (ninguna)',
      `Elige la categoría más adecuada de esta lista exacta: ${CATEGORY_SLUGS.join(', ')}.`,
      'Sugiere entre 1 y 5 etiquetas cortas y descriptivas.',
    ].join('\n');

    return this.generateStructured({ systemPrompt: PLACE_SYSTEM_PROMPT, userPrompt, schema, schemaName: 'place_draft' });
  }

  async generateStructured<Schema extends z.ZodTypeAny>(
    input: StructuredGenerateInput<Schema>,
    attempt = 0,
  ): Promise<z.infer<Schema>> {
    const jsonInstruction = [
      '',
      'Responde ÚNICAMENTE con un objeto JSON válido — sin markdown, sin ```, sin texto antes ni después — con exactamente estas claves:',
      describeZodShape(input.schema),
    ].join('\n');

    const raw = await this.runOnce(input.systemPrompt, `${input.userPrompt}\n${jsonInstruction}`);
    const parsed = input.schema.safeParse(raw);

    if (parsed.success) return parsed.data;

    if (attempt === 0) {
      const retryPrompt = `${input.userPrompt}\n${jsonInstruction}\n\nTu respuesta anterior no cumplió el formato exacto (error: ${parsed.error.message}). Responde de nuevo, SOLO el JSON, sin explicaciones.`;
      return this.generateStructured({ ...input, userPrompt: retryPrompt }, attempt + 1);
    }

    throw new InternalServerErrorException(
      `Claude CLI no devolvió datos válidos tras reintentar: ${parsed.error.message}`,
    );
  }

  // No usa el `timeout` propio de execFile: en esta máquina (Windows) ese
  // timeout llama a child.kill() sobre el proceso de `claude`, pero deja
  // vivos los hijos que ese proceso haya lanzado a su vez — visto en vivo,
  // un proceso siguió corriendo 15+ minutos después de que su timeout de 60s
  // debía matarlo, bloqueando toda la corrida de automatización detrás de
  // él (ver AutomationRunnerService.run, que es secuencial). Se maneja el
  // timeout a mano y se mata el árbol completo (killProcessTree) en vez de
  // confiar en el kill parcial de Node.
  private runClaudeCommand(args: string[], cwd: string, timeoutMs = CLAUDE_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const child = execFile(
        'claude',
        args,
        { cwd, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) reject(new Error(err.message, { cause: err }));
          else resolve(stdout);
        },
      );
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        if (child.pid) killProcessTree(child.pid);
        reject(new Error(`Claude CLI superó el tiempo límite de ${timeoutMs}ms.`));
      }, timeoutMs);
    });
  }

  // Prueba mínima real (Configuración → Probar conexión): el mismo camino
  // que runOnce (execFile 'claude', sin --bare, cwd aislado) pero con un
  // prompt trivial y timeout corto — un ✓ aquí significa que una generación
  // real también funcionaría, no solo que el binario existe.
  async checkConnection(): Promise<ConnectionCheckResult> {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'content-platform-claude-check-'));
    try {
      const stdout = await this.runClaudeCommand(
        ['-p', 'Responde únicamente con la palabra: ok', '--output-format', 'json', '--disallowedTools', '*'],
        tmpDir,
        25_000,
      );
      let envelope: ClaudeCliResultEnvelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        return { ok: false, detail: 'El CLI respondió, pero no en el formato esperado.' };
      }
      if (envelope.is_error) {
        return { ok: false, detail: `El CLI respondió con un error: ${envelope.result || 'desconocido'}` };
      }
      return { ok: true, detail: 'La sesión de Claude Code responde correctamente.' };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { ok: false, detail: 'El comando "claude" no se encontró en este servidor (¿está instalado y en PATH?).' };
      return { ok: false, detail: (err as Error).message };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async runOnce(systemPrompt: string, userPrompt: string): Promise<unknown> {
    // cwd aislado a propósito: sin --bare (para conservar la sesión OAuth ya
    // autenticada), pero corriendo fuera del repo para que no se auto-descubra
    // ningún CLAUDE.md/skill de este proyecto durante una generación de contenido.
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'content-platform-claude-'));
    try {
      const stdout = await this.runClaudeCommand(
        ['-p', userPrompt, '--output-format', 'json', '--system-prompt', systemPrompt, '--disallowedTools', '*'],
        tmpDir,
      );

      let envelope: ClaudeCliResultEnvelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        throw new InternalServerErrorException('Claude CLI no devolvió un JSON válido en su envoltura de resultado.');
      }
      if (envelope.is_error) {
        throw new InternalServerErrorException(`Claude CLI reportó un error: ${envelope.result ?? 'desconocido'}`);
      }

      const jsonText = extractJsonText(envelope.result);
      try {
        return JSON.parse(jsonText);
      } catch {
        throw new InternalServerErrorException('Claude CLI no devolvió JSON parseable dentro de su respuesta.');
      }
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException(`No se pudo invocar el CLI de Claude: ${(err as Error).message}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
