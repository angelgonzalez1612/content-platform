import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  CATEGORY_SLUGS,
  type ContentProvider,
  type PlaceDraftInput,
  type PlaceDraftOutput,
  type StructuredGenerateInput,
} from '../content-provider.interface';

const PLACE_SYSTEM_PROMPT = `Eres redactor editorial de Planazo, una guía de planes y lugares de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información que te da el editor. NUNCA inventes dirección, teléfono, precios, horarios ni datos verificables que no te dieron.
- El tono es directo y útil, como alguien que ya fue y te está recomendando, no como un anuncio.
- Responde siempre en español de México.`;

// Mismo describeZodShape que claude-cli-provider.ts (fallback cuando
// z.toJSONSchema no soporta algún shape del schema — ver runOnce) — se
// duplica a propósito en vez de compartir un util: cada provider CLI queda
// autocontenido, igual que ya está claude-cli-provider.ts.
function describeZodShape(schema: z.ZodTypeAny): string {
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape as Record<
    string,
    z.ZodTypeAny
  >;
  const lines: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    lines.push(
      `- "${key}": ${describeType(field)}${field.description ? ` — ${field.description}` : ''}`,
    );
  }
  return lines.join('\n');
}

function describeType(field: z.ZodTypeAny): string {
  const unwrapped = unwrap(field);
  if (unwrapped instanceof z.ZodString) return 'string';
  if (unwrapped instanceof z.ZodNumber) return 'number';
  if (unwrapped instanceof z.ZodBoolean) return 'boolean (true/false)';
  if (unwrapped instanceof z.ZodEnum)
    return `uno de: ${Object.values(unwrapped.enum).join(', ')}`;
  if (unwrapped instanceof z.ZodArray)
    return `array de ${describeType(unwrapped.element as z.ZodTypeAny)}`;
  if (unwrapped instanceof z.ZodObject)
    return `objeto {${Object.keys(unwrapped.shape).join(', ')}}`;
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
// les pida no hacerlo — se limpia antes de intentar JSON.parse. Solo hace
// falta en el fallback (sin --output-schema, Codex no está forzado a un
// formato); con --output-schema el archivo de salida ya viene limpio.
function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

// El endpoint de OpenAI que respalda a Codex exige, en TODO nodo
// `type: "object"` del JSON Schema pasado a --output-schema, dos cosas que
// z.toJSONSchema no produce por defecto (responde 400 invalid_json_schema si
// faltan):
// 1. `additionalProperties: false`.
// 2. `required` debe incluir TODAS las claves de `properties` — a
//    diferencia del JSON Schema estándar, donde un campo ausente de
//    `required` simplemente es opcional. Los campos que `field-schema-builder.ts`
//    marca `.nullable().optional()` ya generan un `anyOf` que incluye
//    `{type: "null"}` (ver z.toJSONSchema), así que agregarlos a `required`
//    no les exige inventar un valor: el modelo puede seguir respondiendo
//    `null` — solo ya no puede omitir la clave por completo.
function enforceNoAdditionalProperties(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(enforceNoAdditionalProperties);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  if (
    record.type === 'object' &&
    record.properties &&
    typeof record.properties === 'object'
  ) {
    record.additionalProperties = false;
    record.required = Object.keys(record.properties);
  }
  for (const value of Object.values(record)) {
    enforceNoAdditionalProperties(value);
  }
}

// Escapa un argumento para pasarlo dentro de un comando de una sola cadena a
// `cmd.exe` (spawn con shell:true) de forma que el binario lo reciba tal
// cual — sigue las reglas de CommandLineToArgvW que usan la mayoría de CLIs
// nativos en Windows (Rust/clap, como Codex): las barras invertidas solo se
// duplican si preceden inmediatamente una comilla; las comillas siempre se
// escapan. Necesario porque `spawn(command, {shell:true})` con un string ya
// armado NO escapa nada por su cuenta — a diferencia de pasar un array de
// `args` con shell:true, que sí intenta escapar pero lo hace mal para
// prompts largos con espacios (parte el prompt en argumentos sueltos).
function quoteArgForWindowsShell(arg: string): string {
  let result = '"';
  let backslashes = 0;
  for (const ch of arg) {
    if (ch === '\\') {
      backslashes += 1;
      continue;
    }
    if (ch === '"') {
      result += '\\'.repeat(backslashes * 2 + 1) + '"';
      backslashes = 0;
      continue;
    }
    result += '\\'.repeat(backslashes) + ch;
    backslashes = 0;
  }
  result += '\\'.repeat(backslashes * 2) + '"';
  return result;
}

// spawn(command, {shell:true, stdio:['pipe', ...]}) en vez de execFile:
// - shell:true — en Windows, `codex` instalado vía npm es un shim
//   (codex.cmd/codex.ps1, no un .exe); sin shell, spawn/execFile no lo
//   resuelven (ENOENT), y spawn directo al .cmd también falla (EINVAL).
// - El prompt viaja por stdin (`codex exec -`), NUNCA como argumento del
//   comando: cmd.exe (el shell que arma spawn con shell:true en Windows)
//   corta la línea de comando en el primer salto de línea que traiga el
//   argumento — un prompt real (system+user, con \n\n de por medio) llegaba
//   truncado a la primera línea, y con él se perdían TODAS las flags que
//   venían después (--output-schema, --output-last-message, -C, etc.), sin
//   ningún error visible. Pasar el prompt por stdin evita esa clase entera
//   de problemas de escapado/longitud de línea.
// - El resto de los argumentos (rutas, flags) sí van en la línea de comando
//   — no tienen saltos de línea, solo se entrecomillan a mano (ver
//   quoteArgForWindowsShell) porque un array de `args` con shell:true no
//   escapa bien argumentos con espacios.
function runCodexCommand(
  command: string,
  stdinInput: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Codex CLI superó el tiempo límite de ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdin?.write(stdinInput);
    child.stdin?.end();
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `Codex CLI terminó con código ${code}: ${(stderr || stdout).trim()}`,
          ),
        );
    });
  });
}

// Invoca el CLI de Codex ya autenticado en esta máquina (sesión de ChatGPT
// vía `codex login`, NO una API key nueva de pago por token) en modo
// no-interactivo (`codex exec`). A diferencia de Claude CLI, Codex acepta un
// JSON Schema real (`--output-schema`) que restringe la respuesta del modelo
// — no hace falta describir el shape en el prompt ni parsear una envoltura;
// `--output-last-message` escribe directo el JSON final a un archivo. Si el
// schema no se puede convertir a JSON Schema (construcción no soportada por
// z.toJSONSchema), se cae al mismo patrón de claude-cli-provider.ts: describir
// el shape en el prompt y validar/reintentar después.
@Injectable()
export class CodexCliProvider implements ContentProvider {
  async generatePlaceDraft(input: PlaceDraftInput): Promise<PlaceDraftOutput> {
    const schema = z.object({
      description: z
        .string()
        .describe('80-120 palabras, editorial, en español de México'),
      suggestedCategory: z.enum(CATEGORY_SLUGS),
      suggestedTags: z.array(z.string()).min(1).max(5),
    });

    const userPrompt = [
      `Nombre del lugar: ${input.name}`,
      input.hints
        ? `Notas del editor: ${input.hints}`
        : 'Notas del editor: (ninguna)',
      `Elige la categoría más adecuada de esta lista exacta: ${CATEGORY_SLUGS.join(', ')}.`,
      'Sugiere entre 1 y 5 etiquetas cortas y descriptivas.',
    ].join('\n');

    return this.generateStructured({
      systemPrompt: PLACE_SYSTEM_PROMPT,
      userPrompt,
      schema,
      schemaName: 'place_draft',
    });
  }

  async generateStructured<Schema extends z.ZodTypeAny>(
    input: StructuredGenerateInput<Schema>,
    attempt = 0,
  ): Promise<z.infer<Schema>> {
    const raw = await this.runOnce(
      input.systemPrompt,
      input.userPrompt,
      input.schema,
    );
    const parsed = input.schema.safeParse(raw);

    if (parsed.success) return parsed.data;

    if (attempt === 0) {
      const retryPrompt = `${input.userPrompt}\n\nTu respuesta anterior no cumplió el formato exacto (error: ${parsed.error.message}). Responde de nuevo cumpliendo exactamente el schema, sin explicaciones.`;
      return this.generateStructured(
        { ...input, userPrompt: retryPrompt },
        attempt + 1,
      );
    }

    throw new InternalServerErrorException(
      `Codex CLI no devolvió datos válidos tras reintentar: ${parsed.error.message}`,
    );
  }

  private async runOnce(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodTypeAny,
  ): Promise<unknown> {
    // cwd aislado a propósito (igual que claude-cli-provider.ts): corre fuera
    // del repo para que no se auto-descubra ningún AGENTS.md/config de este
    // proyecto durante una generación de contenido.
    const tmpDir = await mkdtemp(
      path.join(tmpdir(), 'content-platform-codex-'),
    );
    const outputPath = path.join(tmpDir, 'output.txt');

    let schemaPath: string | null = null;
    try {
      schemaPath = path.join(tmpDir, 'schema.json');
      const schemaJson = z.toJSONSchema(schema);
      enforceNoAdditionalProperties(schemaJson);
      await writeFile(schemaPath, JSON.stringify(schemaJson));
    } catch {
      schemaPath = null; // el schema no se pudo convertir — se cae al fallback en el prompt
    }

    const jsonInstruction = schemaPath
      ? ''
      : [
          '',
          'Responde ÚNICAMENTE con un objeto JSON válido — sin markdown, sin ```, sin texto antes ni después — con exactamente estas claves:',
          describeZodShape(schema),
        ].join('\n');

    try {
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}${jsonInstruction}`;
      const parts = [
        'codex',
        'exec',
        '-', // el prompt viaja por stdin, no como argumento — ver runCodexCommand
        '--output-last-message',
        quoteArgForWindowsShell(outputPath),
        '--sandbox',
        'read-only',
        '--skip-git-repo-check',
        '--ephemeral',
        '-C',
        quoteArgForWindowsShell(tmpDir),
      ];
      if (schemaPath)
        parts.push('--output-schema', quoteArgForWindowsShell(schemaPath));

      await runCodexCommand(parts.join(' '), fullPrompt, 60_000);

      const lastMessage = await readFile(outputPath, 'utf-8');
      const jsonText = extractJsonText(lastMessage);
      try {
        return JSON.parse(jsonText);
      } catch {
        throw new InternalServerErrorException(
          'Codex CLI no devolvió JSON parseable en su respuesta.',
        );
      }
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException(
        `No se pudo invocar el CLI de Codex: ${(err as Error).message}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
