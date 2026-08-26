"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const PENCIL_ICON = "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 6l4 4";

const TYPES = [
  { value: "noticia", label: "Noticia" },
  { value: "alerta", label: "Alerta" },
  { value: "guia", label: "Guía" },
  { value: "evento", label: "Evento" },
  { value: "lugar", label: "Lugar" },
  { value: "reportaje", label: "Reportaje" },
];

/** La Mira tiene 6 tipos de contenido (Planazo solo 'place') — antes de
 * elegir IA vs. manual hay que elegir cuál. Cliente porque los 2 links de
 * abajo dependen del tipo elegido. */
export function LamiraCrearTypePicker() {
  const [type, setType] = useState("noticia");

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto flex flex-wrap justify-center gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              type === t.value ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
        <Link
          href={`/centro-ia?site=lamira&type=${type}`}
          className="group flex flex-col gap-4 rounded-[16px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#FFE2CC] hover:shadow-[0_16px_32px_-16px_rgba(253,105,13,.28)]"
        >
          <div className="grid size-[44px] place-items-center rounded-[13px] border border-[#FFE2CC] bg-accent">
            <Icon d={SPARK_ICON} size={20} strokeWidth={1.6} className="text-brand" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-[15.5px] font-semibold tracking-tight">Crear con IA</h2>
              <span className="rounded font-mono text-[9.5px] font-medium text-white" style={{ padding: "1px 5px", background: "#FD690D" }}>
                IA
              </span>
            </div>
            <p className="text-[13px] leading-[1.55] text-ink-soft">
              Dale el tema y lo que ya sabes (ej. de content-radar). Escribimos el borrador — tú revisas antes de publicar.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand">
            Empezar con IA
            <Icon d="M5 12h14M13 6l6 6-6 6" size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href={`/crear/manual?site=lamira&type=${type}`}
          className="group flex flex-col gap-4 rounded-[16px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#E0DBD4] hover:shadow-[0_16px_32px_-16px_rgba(23,20,17,.12)]"
        >
          <div className="grid size-[44px] place-items-center rounded-[13px] border border-border bg-background">
            <Icon d={PENCIL_ICON} size={20} strokeWidth={1.6} className="text-ink" />
          </div>
          <div>
            <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight">Crear manualmente</h2>
            <p className="text-[13px] leading-[1.55] text-ink-soft">Llena la ficha completa tú mismo, como en cualquier CMS tradicional.</p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            Llenar formulario
            <Icon d="M5 12h14M13 6l6 6-6 6" size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
