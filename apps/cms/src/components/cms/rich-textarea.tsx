"use client";

import { useRef } from "react";

interface Marker {
  label: string;
  button: string;
  wrap: [string, string];
  buttonClassName: string;
}

// **negritas** / *cursiva* / ==color de acento== — mismo Markdown mínimo que
// interpreta renderInline() en la vista previa y en la-mira real. En vez de
// pedirle al humano que memorice/escriba la sintaxis, estos botones envuelven
// la selección actual del textarea — igual que "+ Párrafo"/"+ Bloque" son
// botones, no instrucciones de texto.
const MARKERS: Marker[] = [
  { label: "Negritas", button: "B", wrap: ["**", "**"], buttonClassName: "font-bold" },
  { label: "Cursiva", button: "I", wrap: ["*", "*"], buttonClassName: "italic" },
  { label: "Color de acento", button: "A", wrap: ["==", "=="], buttonClassName: "text-brand font-semibold" },
];

export function RichTextarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  className,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function applyMarker(prefix: string, suffix: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "texto";
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {MARKERS.map((m) => (
          <button
            key={m.label}
            type="button"
            title={m.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMarker(m.wrap[0], m.wrap[1])}
            className={`grid size-6 place-items-center rounded border border-border-soft bg-white text-[12px] hover:border-ink-faint ${m.buttonClassName}`}
          >
            {m.button}
          </button>
        ))}
      </div>
      <textarea ref={ref} id={id} required={required} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={className} />
    </div>
  );
}
