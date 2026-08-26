"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

/** Mismo patrón de etiquetas que ya usaban inline place-create-form.tsx /
 * generate-place-flow.tsx, extraído aquí para reusarlo en noticias/reportajes. */
export function TagsField({ label, tags, onChange }: { label: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Escribe y presiona Enter"
          className={`${fieldClass} flex-1`}
        />
        <button type="button" onClick={add} className="rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-[#F5F3F0]">
          Agregar
        </button>
      </div>
      {tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px]">
              {tag}
              <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} aria-label={`Quitar ${tag}`} className="text-ink-faint hover:text-negative">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
