"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";

type TargetType = "noticia" | "reportaje" | "alerta";
type OriginalAction = "delete" | "unpublish" | "keep";

interface Suggestion {
  belongsIn: "la-mira" | "planazo";
  targetType: TargetType;
  categoryId: string | null;
  categoryName: string | null;
  reason: string;
}

const TARGETS: { id: TargetType; label: string; hint: string }[] = [
  { id: "noticia", label: "Noticia", hint: "Lo más común: un hecho o nota del día." },
  { id: "reportaje", label: "Reportaje", hint: "Pieza más larga o de fondo." },
  { id: "alerta", label: "Alerta", hint: "Aviso activo (tráfico, marchas…). Se publica al crearse." },
];

const ORIGINAL: { id: OriginalAction; label: string; hint: string }[] = [
  { id: "delete", label: "Eliminarla de Planazo", hint: "Recomendado: sin contenido duplicado. Queda copia en el historial." },
  { id: "unpublish", label: "Despublicarla en Planazo", hint: "La conservas como borrador por si la quieres de vuelta." },
  { id: "keep", label: "Dejarla en los dos", hint: "No recomendado: Google penaliza el mismo texto en dos sitios." },
];

function Radio<T extends string>({ name, value, current, onChange, label, hint }: { name: string; value: T; current: T; onChange: (v: T) => void; label: string; hint: string }) {
  const selected = value === current;
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 transition-colors ${
        selected ? "border-brand bg-accent/60" : "border-border hover:border-ink-faint"
      }`}
    >
      <input type="radio" name={name} value={value} checked={selected} onChange={() => onChange(value)} className="mt-0.5 accent-brand" />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        <span className="block text-[11.5px] leading-[1.4] text-ink-soft">{hint}</span>
      </span>
    </label>
  );
}

/**
 * "Mover a La Mira" en la ficha de un lugar/evento de Planazo: convierte la
 * pieza en noticia/reportaje/alerta de La Mira (mismo texto, secciones, foto,
 * video, fuente y SEO) sin volver a generarla, y decide qué pasa con la de
 * Planazo. La nueva queda en revisión y se abre para revisarla.
 */
export function MoveToLamiraButton({
  sourceType,
  sourceId,
  title,
  categories,
  defaultCategoryId,
}: {
  sourceType: "place" | "evento-planazo";
  sourceId: string;
  title: string;
  categories: { id: string; name: string }[];
  defaultCategoryId: string | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [targetType, setTargetType] = useState<TargetType>("noticia");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [original, setOriginal] = useState<OriginalAction>("delete");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  // "Que la IA decida": sugiere dónde encaja (La Mira o Planazo), como qué
  // tipo y en qué categoría; deja todo preseleccionado para que el editor confirme.
  async function suggest() {
    setSuggesting(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/transfer/suggest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceId }),
      });
      if (!res.ok) {
        setError("La IA no pudo decidir. Revisa el proveedor en Configuración o elige a mano.");
        return;
      }
      const data = (await res.json()) as Suggestion;
      setSuggestion(data);
      setTargetType(data.targetType);
      if (data.categoryId) setCategoryId(data.categoryId);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSuggesting(false);
    }
  }

  async function move() {
    setMoving(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/transfer/planazo-to-lamira`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceId, targetType, categoryId: categoryId || null, original }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(res.status === 403 ? "Solo un administrador puede eliminar; elige despublicarla o dejarla." : (body?.message ?? "No se pudo mover."));
        setMoving(false);
        return;
      }
      const data = (await res.json()) as { editPath: string };
      dialogRef.current?.close();
      router.push(data.editPath);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setMoving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-[3px] text-[11.5px] font-medium whitespace-nowrap text-ink-soft transition-colors hover:border-brand hover:text-brand"
        title="Convertir en una pieza de La Mira"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        Mover a La Mira
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="move-lamira-title"
        onClose={() => setError("")}
        className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[14px] border border-border bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,20,17,.45)] backdrop:bg-ink-solid/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-5">
          <div>
            <h2 id="move-lamira-title" className="text-[15px] font-semibold tracking-tight">
              Mover a La Mira
            </h2>
            <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-soft">
              «{title}» se copia a La Mira con su texto, secciones, foto, video, fuente y SEO. La nueva pieza queda en revisión para que la apruebes.
            </p>
          </div>

          {suggestion ? (
            <div
              role="status"
              className={`flex flex-col gap-1 rounded-[10px] border px-3 py-2.5 text-[12.5px] leading-[1.45] ${
                suggestion.belongsIn === "la-mira" ? "border-positive/30 bg-positive/10 text-ink" : "border-warning/30 bg-warning/10 text-ink"
              }`}
            >
              <span className={`font-semibold ${suggestion.belongsIn === "la-mira" ? "text-positive" : "text-warning"}`}>
                {suggestion.belongsIn === "la-mira"
                  ? `✨ La IA sugiere: La Mira · ${TARGETS.find((t) => t.id === suggestion.targetType)!.label}${suggestion.categoryName ? ` · ${suggestion.categoryName}` : ""}`
                  : "✨ La IA cree que sí encaja en Planazo"}
              </span>
              <span className="text-ink-soft">{suggestion.reason}</span>
              {suggestion.belongsIn === "planazo" && (
                <span className="text-ink-soft">Si aun así la quieres en La Mira, te dejo preseleccionado cómo quedaría.</span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={suggest}
              disabled={suggesting}
              className="flex items-center justify-center gap-2 rounded-[10px] border border-brand/30 bg-accent/60 px-3 py-2.5 text-[13px] font-semibold text-accent-fg transition-colors hover:border-brand disabled:cursor-default disabled:opacity-70"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={suggesting ? "animate-spin" : ""} aria-hidden>
                <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
              </svg>
              {suggesting ? "La IA está leyendo la pieza…" : "Que la IA decida dónde encaja"}
            </button>
          )}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Como qué</legend>
            {TARGETS.map((t) => (
              <Radio key={t.id} name="target" value={t.id} current={targetType} onChange={setTargetType} label={t.label} hint={t.hint} />
            ))}
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Categoría en La Mira</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Sin categoría (elegirla después)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Qué pasa con la de Planazo</legend>
            {ORIGINAL.map((o) => (
              <Radio key={o.id} name="original" value={o.id} current={original} onChange={setOriginal} label={o.label} hint={o.hint} />
            ))}
          </fieldset>

          {error && <p className="rounded-lg bg-negative/10 px-3 py-2 text-[12.5px] font-medium text-negative">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border-soft bg-background px-5 py-3">
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            disabled={moving}
            className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink-faint disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={move}
            disabled={moving}
            className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
          >
            {moving ? "Moviendo…" : `Mover como ${TARGETS.find((t) => t.id === targetType)!.label.toLowerCase()}`}
          </button>
        </div>
      </dialog>
    </>
  );
}
