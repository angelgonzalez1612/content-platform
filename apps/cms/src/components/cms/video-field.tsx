"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

const ID = "([\\w-]{11})";
const PATTERNS = [
  new RegExp(`youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/${ID}`),
  new RegExp(`youtube\\.com/watch\\?(?:[^#]*&)?v=${ID}`),
  new RegExp(`youtu\\.be/${ID}`),
];

/** ID de un link de YouTube (watch, youtu.be, Shorts, embed, live) — o el ID pegado tal cual. */
export function youtubeIdFromInput(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  for (const re of PATTERNS) {
    const match = re.exec(text);
    if (match) return match[1];
  }
  return null;
}

/**
 * Video de YouTube incrustado en la pieza — mismo patrón que ImageField. Se
 * llena solo al generar si la fuente es un video o trae uno incrustado; aquí
 * se puede ver, reemplazar pegando cualquier link, buscar el de la fuente o
 * quitar. Solo se guarda el ID.
 */
export function VideoField({
  videoId,
  onChange,
  sourceUrl,
}: {
  videoId: string | null;
  onChange: (videoId: string | null) => void;
  /** URL de la fuente de la pieza: permite "Buscar el video de la fuente". */
  sourceUrl?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  function applyInput() {
    const id = youtubeIdFromInput(input);
    if (!id) {
      setError("Ese link no es de un video de YouTube.");
      return;
    }
    onChange(id);
    setInput("");
    setError("");
    setEditing(false);
  }

  async function findFromSource() {
    if (!sourceUrl) return;
    setSearching(true);
    setError("");
    setNotFound(false);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/source-video`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = res.ok ? ((await res.json()) as { youtubeId: string | null }) : null;
      if (data?.youtubeId) {
        onChange(data.youtubeId);
        setEditing(false);
      } else setNotFound(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSearching(false);
    }
  }

  const sourceButton = sourceUrl ? (
    <button
      type="button"
      onClick={findFromSource}
      disabled={searching}
      className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
    >
      {searching ? "Buscando en la fuente…" : "Buscar el video de la fuente"}
    </button>
  ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>Video (YouTube)</span>

      {videoId && !editing ? (
        <div className="flex items-start gap-3 rounded-[10px] border border-border-soft bg-background p-3">
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block h-20 w-36 flex-none overflow-hidden rounded-[8px] bg-hover"
            title="Ver en YouTube"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de YouTube */}
            <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-ink-solid/25 transition-colors group-hover:bg-ink-solid/40">
              <span className="grid size-8 place-items-center rounded-full bg-[#FF0033] text-white shadow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </a>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[12px] text-ink-soft">
              Se incrusta en la página, debajo de la imagen. <span className="font-mono text-ink-faint">{videoId}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
              >
                Reemplazar
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-md px-2 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:bg-negative/10 hover:text-negative"
              >
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-border bg-background p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyInput();
                }
              }}
              placeholder="Pega un link de YouTube (video, youtu.be o Shorts)"
              aria-label="Link del video de YouTube"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={applyInput}
              disabled={!input.trim()}
              className="flex-none rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:opacity-50"
            >
              Usar
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sourceButton}
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className="text-[12px] font-medium text-ink-faint hover:text-ink">
                Cancelar
              </button>
            )}
          </div>
          {notFound && <p className="text-[12px] text-ink-faint">La fuente no trae un video de YouTube.</p>}
          {error && <p className="text-[12px] font-medium text-negative">{error}</p>}
        </div>
      )}
    </div>
  );
}
