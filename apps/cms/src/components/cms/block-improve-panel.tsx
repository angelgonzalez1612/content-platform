"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { fieldClass } from "@/components/cms/dynamic-field";
import { useOpenAiAvailable } from "@/lib/use-openai-available";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const CLOSE_ICON = "M6 6l12 12M18 6L6 18";

type ProviderId = "openai" | "claude-cli" | "codex-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "claude-cli", label: "Claude (tu sesión)" },
  { id: "codex-cli", label: "Codex (tu sesión)" },
];

interface BlockImproveResult {
  heading: string | null;
  paragraphs: string[];
}

function blockLabel(block: ContentBlockValue, i: number): string {
  const heading = block.heading?.trim();
  return heading ? `${i + 1}. ${heading}` : `Bloque ${i + 1} (sin título)`;
}

export interface BlockImprovePanelHandle {
  /** Abre el panel ya enfocado en un bloque específico — lo usa el botón
   * inline "+ Párrafos con IA" de cada bloque (ContentBlocksField), para no
   * obligar a abrir el panel flotante y elegir el bloque del selector a mano. */
  openFor: (index: number, mode: "rewrite" | "expand") => void;
}

/** Panel único y fijo (no uno por bloque) — mismo principio que
 * ImproveWithAiPanel (la IA nunca sobreescribe directo, el humano revisa y
 * aplica), pero acotado a UN bloque a la vez, elegido de un selector, en vez
 * de todo el contenido. Se queda fijo en pantalla mientras se hace scroll por
 * el cuerpo, así no hay que volver a subir para usarlo. */
export const BlockImprovePanel = forwardRef<BlockImprovePanelHandle, {
  blocks: ContentBlockValue[];
  onChange: (blocks: ContentBlockValue[]) => void;
  articleTitle?: string;
}>(function BlockImprovePanel({ blocks, onChange, articleTitle }, ref) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<"rewrite" | "expand">("rewrite");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BlockImproveResult | null>(null);
  const openaiAvailable = useOpenAiAvailable();
  const providers = PROVIDERS.filter((p) => p.id !== "openai" || openaiAvailable === true);

  useEffect(() => {
    if (openaiAvailable === false && provider === "openai") setProvider("claude-cli");
  }, [openaiAvailable, provider]);

  useEffect(() => {
    if (selectedIndex >= blocks.length) setSelectedIndex(Math.max(0, blocks.length - 1));
  }, [blocks.length, selectedIndex]);

  useImperativeHandle(ref, () => ({
    openFor: (index, m) => {
      setSelectedIndex(index);
      setMode(m);
      setResult(null);
      setError("");
      setOpen(true);
    },
  }));

  const block = blocks[selectedIndex] as ContentBlockValue | undefined;

  // No limpia `result` al inicio — así "Generar otra vez" deja el resultado
  // anterior visible (aunque ya desactualizado) mientras llega el nuevo, en
  // vez de hacerlo parpadear a la vista "sin resultado" y de vuelta.
  async function handleGenerate() {
    if (!block) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/improve-block`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode,
          heading: block.heading,
          paragraphs: block.paragraphs,
          instructions: instructions || undefined,
          articleTitle: articleTitle || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar.");
        return;
      }
      setResult(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    const next = blocks.map((b, i) => {
      if (i !== selectedIndex) return b;
      if (mode === "expand") return { ...b, paragraphs: [...b.paragraphs, ...result.paragraphs] };
      return { ...b, heading: result.heading ?? b.heading, paragraphs: result.paragraphs };
    });
    onChange(next);
    setResult(null);
  }

  if (blocks.length === 0) return null;

  return (
    <div className="fixed right-6 bottom-6 z-30 flex flex-col items-end gap-2.5">
      {open && (
        <div className="flex max-h-[min(72vh,640px)] w-[min(92vw,360px)] flex-col gap-3 overflow-y-auto rounded-[16px] border border-border bg-white p-4 shadow-[0_8px_28px_rgba(23,20,17,.16)]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} className="text-brand" />
              IA para el cuerpo
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-ink-faint">Bloque</span>
            <select
              value={selectedIndex}
              onChange={(e) => {
                setSelectedIndex(Number(e.target.value));
                setResult(null);
              }}
              className={`${fieldClass} text-[12.5px]`}
            >
              {blocks.map((b, i) => (
                <option key={i} value={i}>
                  {blockLabel(b, i)}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center self-start rounded-full border border-border bg-background p-0.5">
            {(
              [
                { id: "rewrite", label: "Corregir" },
                { id: "expand", label: "Ampliar" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setResult(null);
                }}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  mode === m.id ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] leading-[1.5] text-ink-faint">
            {mode === "expand"
              ? "Agrega 1-3 párrafos NUEVOS al final del bloque elegido, sin repetir lo ya dicho ni inventar datos."
              : "Corrige y mejora la redacción del bloque elegido, mismos hechos, sin agregar párrafos."}
          </p>

          <div className="flex gap-1.5">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                  provider === p.id ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={mode === "expand" ? "ej. agrega un dato sobre horarios" : "ej. hazlo más claro"}
            className={`${fieldClass} resize-none text-[12px]`}
          />

          {error && <p className="rounded-lg bg-[#FDECEA] px-2.5 py-1.5 text-[12px] font-medium text-[#C4453A]">{error}</p>}

          {result && (
            <div className="flex flex-col gap-2 rounded-[8px] border border-border-soft bg-background p-2.5">
              {mode === "rewrite" && result.heading && <p className="text-[12px] font-semibold">{result.heading}</p>}
              {result.paragraphs.map((p, i) => (
                <p key={i} className="text-[12px] leading-[1.5] text-ink-soft">
                  {p}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={loading}
                  className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
                >
                  {mode === "expand" ? "Agregar al bloque" : "Aplicar"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-70"
                >
                  {loading ? "Generando…" : "Generar otra vez"}
                </button>
                <button type="button" onClick={() => setResult(null)} disabled={loading} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-negative disabled:cursor-default disabled:opacity-70">
                  Descartar
                </button>
              </div>
            </div>
          )}

          {!result && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
            >
              {loading ? "Generando…" : mode === "expand" ? "Generar párrafos nuevos" : "Generar corrección"}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
      >
        <Icon d={open ? CLOSE_ICON : SPARK_ICON} size={14} strokeWidth={1.8} />
        {open ? "Cerrar" : "IA para el cuerpo"}
      </button>
    </div>
  );
});
