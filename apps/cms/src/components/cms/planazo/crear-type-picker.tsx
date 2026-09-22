"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const PENCIL_ICON = "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 6l4 4";
const ARROW_ICON = "M5 12h14M13 6l6 6-6 6";

const TYPES = [
  { value: "place", label: "Lugar" },
  { value: "evento-planazo", label: "Evento" },
  { value: "guia", label: "Guía" },
];

// null = ese método no existe para el tipo (se muestra la tarjeta
// deshabilitada en vez de enlazar a algo roto). Las guías se arman
// curando lugares/eventos ya publicados, no tiene sentido "generarlas"
// con IA — y crear un evento a mano todavía no tiene ficha propia (solo
// se puede generar con IA o editar uno ya creado).
const IA_COPY: Record<string, string | null> = {
  place: "Dale el nombre de un lugar real y lo que ya sabes de él. Escribimos la descripción, categoría y etiquetas — tú revisas y completas dirección, teléfono y precio.",
  "evento-planazo": "Dale el nombre del evento y lo que ya sabes (fecha, lugar, etc.). Escribimos la descripción y categoría — tú revisas antes de publicar.",
  guia: null,
};
const MANUAL_COPY: Record<string, string | null> = {
  place: "Llena la ficha completa tú mismo — nombre, descripción, categoría, zona, precio y contacto — como en cualquier CMS tradicional.",
  "evento-planazo": null,
  guia: "Arma la guía eligiendo lugares y eventos ya publicados, con tu propio texto de introducción.",
};

/** Planazo tiene 3 tipos de contenido (La Mira tiene 6, ver
 * LamiraCrearTypePicker) — mismo patrón de pills + tarjetas, pero no todos
 * los tipos tienen las dos formas de creación implementadas todavía
 * (ver IA_COPY/MANUAL_COPY), así que la combinación que falta se muestra
 * deshabilitada en vez de enlazar a algo que no existe. */
export function PlanazoCrearTypePicker() {
  const [type, setType] = useState("place");
  const iaCopy = IA_COPY[type];
  const manualCopy = MANUAL_COPY[type];

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto flex flex-wrap justify-center gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              type === t.value ? "border-brand bg-accent text-accent-fg" : "border-border bg-card text-ink-soft hover:border-ink-faint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
        {iaCopy ? (
          <Link
            href={`/centro-ia?site=planazo&type=${type}`}
            className="group flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#FFE2CC] hover:shadow-[0_16px_32px_-16px_rgba(253,105,13,.28)]"
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
              <p className="text-[13px] leading-[1.55] text-ink-soft">{iaCopy}</p>
            </div>
            <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand">
              Empezar con IA
              <Icon d={ARROW_ICON} size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : (
          <DisabledCard
            icon={SPARK_ICON}
            title="Crear con IA"
            description="Las guías se arman curando lugares y eventos que ya existen — no aplica generarlas con IA."
          />
        )}

        {manualCopy ? (
          <Link
            href={`/crear/manual?site=planazo&type=${type}`}
            className="group flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#E0DBD4] hover:shadow-[0_16px_32px_-16px_rgba(23,20,17,.12)]"
          >
            <div className="grid size-[44px] place-items-center rounded-[13px] border border-border bg-background">
              <Icon d={PENCIL_ICON} size={20} strokeWidth={1.6} className="text-ink" />
            </div>
            <div>
              <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight">Crear manualmente</h2>
              <p className="text-[13px] leading-[1.55] text-ink-soft">{manualCopy}</p>
            </div>
            <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              Llenar formulario
              <Icon d={ARROW_ICON} size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : (
          <DisabledCard
            icon={PENCIL_ICON}
            title="Crear manualmente"
            description="Por ahora los eventos nuevos solo se generan con IA — la ficha manual está en camino."
          />
        )}
      </div>
    </div>
  );
}

function DisabledCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-[16px] border border-dashed border-border bg-background p-6">
      <div className="grid size-[44px] place-items-center rounded-[13px] border border-border bg-card">
        <Icon d={icon} size={20} strokeWidth={1.6} className="text-ink-faint" />
      </div>
      <div>
        <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight text-ink-soft">{title}</h2>
        <p className="text-[13px] leading-[1.55] text-ink-faint">{description}</p>
      </div>
      <span className="mt-auto text-[13px] font-medium text-ink-faint">Próximamente</span>
    </div>
  );
}
