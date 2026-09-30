"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { apiConfig } from "@planazo/config";
import type { CheckResult, AiDecision } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { useAiSettings } from "@/lib/use-openai-available";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

type ProviderId = "openai" | "claude-cli" | "codex-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string; name: string }> = [
  { id: "openai", label: "OpenAI", name: "OpenAI" },
  { id: "claude-cli", label: "Claude (tu sesión)", name: "Claude" },
  { id: "codex-cli", label: "Codex (tu sesión)", name: "Codex" },
];

// Las sesiones CLI (Codex/Claude) suelen tardar 20-60 s; pasado esto se avisa
// que está tardando más de lo normal.
const SLOW_AFTER_S = 75;

interface ImproveResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
  /** Con qué modo se generó — "Generar más" solo aplica a "Agregar contenido". */
  mode?: "rewrite" | "expand";
}

export interface ImproveWithAiHandle {
  /** Repite la última generación con el mismo proveedor/modo/instrucciones —
   * la usa el botón "Generar otra vez" del preview (ImprovePreview), para no
   * obligar a volver a abrir este panel para pedir una alternativa. */
  regenerate: () => void;
  /** "Generar más": pide secciones NUEVAS adicionales conservando `proposed`
   * (las que la IA ya propuso y el editor dejó marcadas); el resultado trae
   * el cuerpo actual + `proposed` + las nuevas. */
  generateMore: (proposed: ContentBlockValue[]) => void;
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Contador de segundos desde `startedAt` — solo corre mientras se muestra. */
function useElapsedSeconds(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** "Mejorar" nunca sobreescribe directo — solo pide el borrador al agente y
 * lo entrega al componente padre para que el humano decida si lo aplica. */
export const ImproveWithAiPanel = forwardRef<ImproveWithAiHandle, {
  contentType: string;
  contentId: string;
  expanded: boolean;
  onToggle: () => void;
  onResult: (result: ImproveResult, mode: "rewrite" | "expand") => void;
  // Solo 'place' lo implementa por ahora (ver AiDraftService.improvePlace,
  // modo 'expand') — los otros 7 tipos que usan este panel no ofrecen el
  // segundo modo, se quedan exactamente como estaban.
  supportsExpand?: boolean;
  // Notifica al padre cuando empieza/termina una regeneración disparada vía
  // el ref — así ImprovePreview puede deshabilitar sus botones mientras dura.
  onLoadingChange?: (loading: boolean) => void;
}>(function ImproveWithAiPanel({ contentType, contentId, expanded, onToggle, onResult, supportsExpand = false, onLoadingChange }, ref) {
  const settings = useAiSettings();
  // null = el editor no ha elegido: se usa el predeterminado de Configuración.
  const [chosenProvider, setChosenProvider] = useState<ProviderId | null>(null);
  const [mode, setMode] = useState<"rewrite" | "expand">("rewrite");
  const [instructions, setInstructions] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const elapsed = useElapsedSeconds(startedAt);

  const loading = startedAt !== null;
  const providers = PROVIDERS.filter((p) => p.id !== "openai" || settings?.openaiAvailable === true);
  const fallbackProvider = settings && providers.some((p) => p.id === settings.defaultProvider) ? settings.defaultProvider : "codex-cli";
  const provider = chosenProvider ?? fallbackProvider;
  const providerName = PROVIDERS.find((p) => p.id === provider)?.name ?? provider;

  useImperativeHandle(ref, () => ({ regenerate: () => handleImprove(), generateMore: (proposed) => handleImprove(proposed) }));

  async function handleImprove(proposed?: ContentBlockValue[]) {
    const sentMode = proposed ? "expand" : mode;
    if (abortRef.current) return; // ya hay una generación en curso
    const controller = new AbortController();
    abortRef.current = controller;
    setStartedAt(Date.now());
    onLoadingChange?.(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/improve/${contentType}/${contentId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, mode: sentMode, instructions: instructions || undefined, proposed }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar la mejora.");
        return;
      }

      onResult({ ...(await res.json()), mode: sentMode }, sentMode);
    } catch (err) {
      if ((err as Error).name === "AbortError") setNotice("Generación cancelada. Puedes cambiar el proveedor o las instrucciones y volver a intentar.");
      else setError("No se pudo conectar con el servidor.");
    } finally {
      abortRef.current = null;
      setStartedAt(null);
      onLoadingChange?.(false);
    }
  }

  function cancel() {
    // Solo deja de esperar la respuesta: el servidor puede terminar la
    // llamada, pero su resultado se descarta.
    abortRef.current?.abort();
  }

  return (
    <div className="rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Icon d={SPARK_ICON} size={15} strokeWidth={1.8} className={loading ? "animate-spin text-brand" : "text-brand"} />
          Mejorar con IA
        </span>
        {loading ? (
          <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-fg">
            Generando con {providerName} · <span className="tabular-nums">{formatElapsed(elapsed)}</span>
          </span>
        ) : (
          <span className="text-[12px] text-ink-faint">{expanded ? "Cerrar" : "Abrir"}</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border-soft p-5">
          {/* Bloqueado mientras genera: cambiar proveedor/modo/instrucciones a la
              mitad no afecta la generación en curso, pero sí "Generar otra vez". */}
          <fieldset disabled={loading} className="flex min-w-0 flex-col gap-4 transition-opacity duration-200 disabled:opacity-55">
            {supportsExpand && (
              <div className="inline-flex items-center self-start rounded-full border border-border bg-background p-0.5">
                {(
                  [
                    { id: "rewrite", label: "Mejorar redacción" },
                    { id: "expand", label: "Agregar contenido" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed ${
                      mode === m.id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[12.5px] leading-[1.5] text-ink-soft">
              {mode === "expand"
                ? "El agente escribe 1-3 secciones NUEVAS (encabezado + párrafos) para agregar al final del contenido — nunca inventa dirección, teléfono, precio ni otros datos verificables. Tú decides si las aplicas."
                : "El agente reescribe la descripción y el SEO para mejorar texto genérico o ambiguo — nunca cambia dirección, teléfono, precio ni otros datos verificables sin que tú lo apruebes."}
            </p>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Proveedor de IA</span>
              <div className="flex gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setChosenProvider(p.id)}
                    aria-pressed={provider === p.id}
                    className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${
                      provider === p.id ? "border-brand bg-accent" : "border-border bg-card hover:border-ink-faint"
                    }`}
                  >
                    {p.label}
                    {settings?.defaultProvider === p.id && <span className="ml-1 text-[11px] font-normal text-ink-faint">· predeterminado</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="improve-instructions" className={labelClass}>
                Instrucciones (opcional)
              </label>
              <textarea
                id="improve-instructions"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={mode === "expand" ? "ej. agrega una sección sobre el ambiente y otra sobre para quién es bueno" : "ej. hazla más atractiva para familias con niños"}
                className={`${fieldClass} resize-none disabled:cursor-not-allowed`}
              />
            </div>
          </fieldset>

          {error && <p className="rounded-lg bg-negative/10 px-3 py-2 text-[13px] font-medium text-negative">{error}</p>}
          {notice && <p className="rounded-lg bg-hover px-3 py-2 text-[13px] text-ink-soft">{notice}</p>}

          {loading ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-2.5 rounded-[12px] border border-brand/30 bg-accent/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-accent-fg">
                  <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} className="animate-spin" />
                  {mode === "expand" ? "Escribiendo secciones nuevas" : "Mejorando la redacción"} con {providerName}…
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-accent-fg tabular-nums">{formatElapsed(elapsed)}</span>
                  <button type="button" onClick={cancel} className="rounded-md px-2 py-0.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-card hover:text-ink">
                    Cancelar
                  </button>
                </span>
              </div>
              <div className="relative h-1 overflow-hidden rounded-full bg-brand/15" aria-hidden>
                <span className="absolute inset-y-0 w-1/3 animate-[pz-progress_1.4s_cubic-bezier(.65,0,.35,1)_infinite] rounded-full bg-brand motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
              </div>
              <p className="text-[12px] text-ink-soft">
                {elapsed < SLOW_AFTER_S
                  ? provider === "openai"
                    ? "Suele tardar unos segundos."
                    : `Con la sesión de ${providerName} suele tardar entre 20 y 60 segundos. Puedes seguir editando el formulario mientras tanto.`
                  : "Está tardando más de lo normal. Puedes esperar un poco más o cancelar y probar con otro proveedor."}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleImprove()}
              className="flex items-center justify-center gap-2 self-start rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
            >
              <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} />
              {mode === "expand" ? "Generar contenido nuevo" : "Generar mejora"} con {providerName}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
