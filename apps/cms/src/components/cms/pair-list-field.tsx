"use client";

import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

/** Editor genérico para arrays de 2 campos — reusado para `updates`
 * (time/text) de Alerta, `quickFacts` (label/value) y `faq` (question/answer)
 * de Guía. No es lo mismo que field_schema (eso es CategoryFieldsSection) —
 * estos son campos fijos del tipo de contenido, no configurables por categoría. */
export function PairListField<K1 extends string, K2 extends string>({
  label,
  items,
  onChange,
  keyA,
  keyB,
  labelA,
  labelB,
  placeholderA,
  placeholderB,
  multilineB = false,
  addLabel,
}: {
  label: string;
  items: Record<K1 | K2, string>[];
  onChange: (items: Record<K1 | K2, string>[]) => void;
  keyA: K1;
  keyB: K2;
  labelA: string;
  labelB: string;
  placeholderA?: string;
  placeholderB?: string;
  multilineB?: boolean;
  addLabel: string;
}) {
  function update(i: number, key: K1 | K2, value: string) {
    onChange(items.map((it, ii) => (ii === i ? { ...it, [key]: value } : it)));
  }
  function add() {
    onChange([...items, { [keyA]: "", [keyB]: "" } as Record<K1 | K2, string>]);
  }
  function remove(i: number) {
    onChange(items.filter((_, ii) => ii !== i));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className={labelClass}>{label}</span>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-[10px] border border-border-soft bg-background p-3">
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
              <input
                value={item[keyA] ?? ""}
                onChange={(e) => update(i, keyA, e.target.value)}
                placeholder={placeholderA ?? labelA}
                aria-label={labelA}
                className={fieldClass}
              />
              {multilineB ? (
                <textarea
                  value={item[keyB] ?? ""}
                  onChange={(e) => update(i, keyB, e.target.value)}
                  placeholder={placeholderB ?? labelB}
                  aria-label={labelB}
                  rows={2}
                  className={`${fieldClass} resize-none`}
                />
              ) : (
                <input
                  value={item[keyB] ?? ""}
                  onChange={(e) => update(i, keyB, e.target.value)}
                  placeholder={placeholderB ?? labelB}
                  aria-label={labelB}
                  className={fieldClass}
                />
              )}
            </div>
            <button type="button" onClick={() => remove(i)} className="flex-none rounded-md px-1.5 py-2 text-ink-faint hover:text-negative">
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="self-start rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
      >
        {addLabel}
      </button>
    </div>
  );
}
