"use client";

import type { Category } from "@planazo/types";
import { DynamicField } from "@/components/cms/dynamic-field";

/** Renderiza todos los campos del field_schema de una categoría — nada si
 * la categoría no tiene ninguno definido (la mayoría de categorías simples,
 * ej. "Ciudad", no agregan nada aquí). */
export function CategoryFieldsSection({
  category,
  data,
  onChange,
}: {
  category: Category | null;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  if (!category || category.fieldSchema.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-border-soft bg-background p-4">
      <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">
        Campos de {category.name}
      </span>
      <div className="grid grid-cols-2 gap-4">
        {category.fieldSchema.map((entry) => (
          <div key={entry.key} className={entry.type === "textarea" || entry.type === "multiselect" ? "col-span-2" : ""}>
            <DynamicField entry={entry} value={data[entry.key]} onChange={(value) => onChange({ ...data, [entry.key]: value })} />
          </div>
        ))}
      </div>
    </div>
  );
}
