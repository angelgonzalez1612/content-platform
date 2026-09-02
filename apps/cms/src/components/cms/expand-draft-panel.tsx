"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";
import { useOpenAiAvailable } from "@/lib/use-openai-available";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

type ProviderId = "openai" | "claude-cli" | "codex-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "claude-cli", label: "Claude (tu sesión)" },
  { id: "codex-cli", label: "Codex (tu sesión)" },
];

/** "Generar más contenido" en la pantalla de revisión de Centro IA — ANTES de
 * crear, a diferencia de ImproveWithAiPanel (que opera sobre algo ya
 * guardado, con contentId). Manda el estado actual del borrador tal cual lo
 * tiene el formulario en memoria (nunca lee/escribe la BD) — ver
 * AiDraftService.expandDraft. El resultado se revisa aquí mismo (bloques
 * nuevos, editables) antes de que el padre los aplique al crear. */
export function ExpandDraftPanel({
  contentType,
  name,
  description,
  content,
  categoryId,
  expanded,
  onToggle,
  onApply,
}: {
  contentType: string;
  name: string;
  description?: string;
  content: ContentBlockValue[];
  categoryId?: string | null;
  expanded: boolean;
  onToggle: () => void;
  onApply: (mergedContent: ContentBlockValue[]) => void;
}) {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ContentBlockValue[] | null>(null);
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
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/draft-expand`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          name,
          description: description || undefined,
          content: content.length ? content : undefined,
          categoryId: categoryId || undefined,
          instructions: instructions || undefined,
          provider,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar contenido nuevo.");
        return;
      }

      const data = (await res.json()) as { draft: { content: ContentBlockValue[] } };
      setResult(data.draft.content);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!result) return;
    onApply(result);
    setResult(null);
    setInstructions("");
  }

  return (
    <div className="rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Icon d={SPARK_ICON} size={15} strokeWidth={1.8} className="text-brand" />
          Generar más contenido
        </span>
        <span className="text-[12px] text-ink-faint">{expanded ? "Cerrar" : "Abrir"}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border-soft p-5">
          <p className="text-[12.5px] leading-[1.5] text-ink-soft">
            El agente escribe 1-3 secciones NUEVAS (encabezado + párrafos) para agregar a esta pieza antes de crearla — nunca inventa dirección, teléfono, precio ni otros datos verificables. Tú decides si las aplicas, y puedes editarlas después de aplicarlas.
          </p>

          {!result && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Proveedor de IA</span>
                <div className="flex gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                        provider === p.id ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="expand-instructions" className={labelClass}>
                  Instrucciones (opcional)
                </label>
                <textarea
                  id="expand-instructions"
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="ej. agrega una sección sobre el ambiente y otra sobre para quién es bueno"
                  className={`${fieldClass} resize-none`}
                />
              </div>

              {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center justify-center gap-2 self-start rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} className="animate-spin" />
                    Generando… {provider === "claude-cli" && "(puede tardar ~30s)"}
                  </>
                ) : (
                  "Generar contenido nuevo"
                )}
              </button>
            </>
          )}

          {result && (
            <>
              <p className="text-[12.5px] font-semibold text-ink">Contenido nuevo — revisa antes de aplicar</p>
              <div className="flex flex-col gap-3">
                {result.slice(content.length).map((block, i) => (
                  <div key={i} className="rounded-[10px] border border-border-soft bg-background p-3.5">
                    {block.heading && <p className="mb-1.5 text-[13px] font-semibold text-ink">{block.heading}</p>}
                    {block.paragraphs.map((p, pi) => (
                      <p key={pi} className="mb-1.5 text-[12.5px] leading-[1.6] text-ink-soft last:mb-0">
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={apply}
                  className="rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
                >
                  Aplicar
                </button>
                <button type="button" onClick={() => setResult(null)} className="text-[13px] font-medium text-ink-soft hover:text-brand">
                  Descartar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
