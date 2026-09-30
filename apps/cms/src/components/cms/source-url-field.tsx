"use client";

import { useState } from "react";
import { fieldClass } from "@/components/cms/dynamic-field";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * URL de la fuente en una sola línea ("Fuente · jornada.com.mx ↗ · Editar")
 * en vez de un input largo siempre visible: casi nunca se edita (la llena la
 * automatización o la generación), así que el input solo aparece al editar.
 */
export function SourceUrlField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-none text-[12px] font-medium text-ink-faint">Fuente</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          placeholder="https://…"
          aria-label="URL de la fuente"
          className={`${fieldClass} flex-1 py-1.5 text-[12.5px]`}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-none rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          Listo
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="self-start text-[12px] font-medium text-ink-faint transition-colors hover:text-brand">
        + Agregar fuente
      </button>
    );
  }

  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-faint">
      <span className="flex-none font-medium">Fuente</span>
      <span aria-hidden>·</span>
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        title={value}
        className="min-w-0 truncate font-medium text-ink-soft transition-colors hover:text-brand"
      >
        {hostOf(value)} ↗
      </a>
      <span aria-hidden>·</span>
      <button type="button" onClick={() => setEditing(true)} className="flex-none font-medium transition-colors hover:text-brand">
        Editar
      </button>
    </p>
  );
}
