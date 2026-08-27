"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

const RADAR_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

const SITES = [
  { value: "lamira", label: "La Mira" },
  { value: "planazo", label: "Planazo" },
] as const;

// Content Radar manda un tema (?name=&hints=) directo a Centro IA — antes
// eso arrancaba de una el formulario ya con "La Mira" fijo, sin preguntar.
// Este paso intermedio confirma (o cambia) el sitio antes de llegar al
// formulario. Hubo una versión que también sugería el tipo de contenido
// (Noticia/Alerta/Evento/…) por palabras clave, pero la heurística fallaba
// seguido con titulares reales — se quitó esa parte a propósito, el tipo
// se queda en lo que ya traía el link (noticia por defecto).
export function PublishDestinationPicker({
  name,
  hints,
  initialSite,
  initialType,
}: {
  name: string;
  hints: string;
  initialSite: string;
  initialType: string;
}) {
  const [site, setSite] = useState<"lamira" | "planazo">(initialSite === "planazo" ? "planazo" : "lamira");

  const continueQuery = new URLSearchParams({ site, name });
  if (site === "lamira") continueQuery.set("type", initialType || "noticia");
  if (hints) continueQuery.set("hints", hints);

  return (
    <div className="mx-auto max-w-[620px] p-[26px] pb-[60px] text-center">
      <div className="mx-auto mb-4 grid size-[46px] place-items-center rounded-2xl border border-[#FFE2CC] bg-accent">
        <Icon d={RADAR_ICON} size={22} strokeWidth={1.6} className="text-brand" />
      </div>
      <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Dónde publicamos esto?</h1>
      <p className="mx-auto mb-2 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-soft">
        Content Radar te trajo un tema. Antes de escribir el borrador, confirma a qué sitio va.
      </p>

      <div className="mx-auto mb-7 flex max-w-[46ch] items-start gap-2.5 rounded-[12px] border border-border-soft bg-background p-3.5 text-left">
        <Icon d={RADAR_ICON} size={14} strokeWidth={1.8} className="mt-0.5 flex-none text-ink-faint" />
        <p className="text-[13px] leading-[1.5] text-ink">{name}</p>
      </div>

      <div className="flex flex-col gap-2 text-left">
        <span className="font-mono text-[10.5px] font-medium tracking-[.08em] text-ink-faint uppercase">Sitio</span>
        <div className="flex gap-2">
          {SITES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSite(s.value)}
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                site === s.value ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"
              }`}
            >
              <span className="block text-[13.5px] font-semibold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Link
        href={`/centro-ia?${continueQuery.toString()}&step=form`}
        className="mt-8 flex items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-3 text-[14.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)]"
      >
        Continuar
        <Icon d="M5 12h14M13 6l6 6-6 6" size={14} strokeWidth={2} />
      </Link>
    </div>
  );
}
