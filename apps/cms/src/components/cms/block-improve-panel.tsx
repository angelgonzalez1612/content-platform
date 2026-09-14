"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { fieldClass } from "@/components/cms/dynamic-field";
import { useOpenAiAvailable } from "@/lib/use-openai-available";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

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

/** Botón "IA" por bloque del cuerpo — mismo principio que ImproveWithAiPanel
 * (la IA nunca sobreescribe directo, el humano revisa y aplica) pero acotado
 * a ESTE bloque nada más: corrige su redacción, o agrega párrafos nuevos al
 * final. */
export function BlockImprovePanel({
  heading,
  paragraphs,
  articleTitle,
  onApplyRewrite,
  onApplyExpand,
}: {
  heading: string | null;
  paragraphs: string[];
  articleTitle?: string;
  onApplyRewrite: (heading: string | null, paragraphs: string[]) => void;
  onApplyExpand: (newParagraphs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
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

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/improve-block`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode,
          heading,
          paragraphs,
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
    if (mode === "expand") onApplyExpand(result.paragraphs);
    else onApplyRewrite(result.heading ?? heading, result.paragraphs);
    setResult(null);
    setOpen(false);
  }

  return (
    <div className="rounded-[10px] border border-border-soft bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition-colors hover:text-brand"
      >
        <Icon d={SPARK_ICON} size={12} strokeWidth={1.8} className="text-brand" />
        IA para este bloque
        <span className="ml-auto text-[11px] text-ink-faint">{open ? "Cerrar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border-soft p-3">
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
              ? "Agrega 1-3 párrafos NUEVOS al final de este bloque, sin repetir lo ya dicho ni inventar datos."
              : "Corrige y mejora la redacción de este bloque, mismos hechos, sin agregar párrafos."}
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-pressed"
                >
                  {mode === "expand" ? "Agregar al bloque" : "Aplicar"}
                </button>
                <button type="button" onClick={() => setResult(null)} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-negative">
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
    </div>
  );
}
