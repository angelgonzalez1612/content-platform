"use client";

import type { FieldSchemaEntry } from "@planazo/types";

// Mismas clases que el resto de los formularios del CMS (place-edit-form,
// generate-place-flow) — no se exportan de un lugar central todavía, se
// copian aquí a propósito para no acoplar este componente a otro archivo.
export const fieldClass =
  "rounded-xl border border-border bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-brand focus:shadow-[0_0_0_4px_rgba(253,105,13,.12)]";
export const labelClass = "flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase";

/** Un campo del field_schema de una categoría — la pieza que implementa
 * "cada categoría con su propio formato" en la UI. `isFact` se marca con un
 * candado: es un dato verificable que el agente de IA nunca inventa. */
export function DynamicField({
  entry,
  value,
  onChange,
}: {
  entry: FieldSchemaEntry;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${entry.key}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {entry.label}
        {entry.isFact && (
          <span title="Dato verificable — la IA nunca lo inventa sin confirmación humana" className="text-[11px] text-ink-faint">
            🔒
          </span>
        )}
      </label>

      {entry.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} resize-none`}
        />
      ) : entry.type === "number" ? (
        <input
          id={id}
          type="number"
          value={value === null || value === undefined ? "" : (value as number)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={fieldClass}
        />
      ) : entry.type === "date" ? (
        <input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={fieldClass}
        />
      ) : entry.type === "boolean" ? (
        <select
          id={id}
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
          className={`${fieldClass} max-w-[160px]`}
        >
          <option value="">Sin definir</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      ) : entry.type === "select" ? (
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={`${fieldClass} max-w-[260px]`}
        >
          <option value="">Sin definir</option>
          {(entry.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : entry.type === "multiselect" ? (
        <div className="flex flex-wrap gap-1.5">
          {(entry.options ?? []).map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? (value as string[]) : [];
                  onChange(selected ? current.filter((v) => v !== opt) : [...current, opt]);
                }}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                  selected ? "border-brand bg-accent text-accent-fg" : "border-border bg-background text-ink-soft hover:border-ink-faint"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <input id={id} type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={fieldClass} />
      )}
    </div>
  );
}
