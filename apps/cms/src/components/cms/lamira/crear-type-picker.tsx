"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const PENCIL_ICON = "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 6l4 4";
const ARROW_ICON = "M5 12h14M13 6l6 6-6 6";

const TYPES = [
  { value: "noticia", label: "Noticia" },
  { value: "alerta", label: "Alerta" },
  { value: "guia", label: "Guía" },
  { value: "evento", label: "Evento" },
  { value: "lugar", label: "Lugar" },
  { value: "reportaje", label: "Reportaje" },
];

/** Antes pedía elegir uno de los 6 tipos de La Mira ANTES de elegir IA o
 * manual — pero con IA ya no hace falta: el tema/liga que se da en Centro
 * IA es suficiente para que la IA clasifique sola el tipo (y la categoría),
 * igual que ya hacía el botón "Publicar" de content-radar (ver
 * AiDraftService.classifyContentType). Manual sigue necesitando el tipo de
 * entrada — cada uno tiene su propia ficha — así que ese selector se movió
 * aquí abajo, solo para esa ruta. */
export function LamiraCrearTypePicker() {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
        <Link
          href="/centro-ia?site=lamira"
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
            <p className="text-[13px] leading-[1.55] text-ink-soft">
              Dale el tema (o un link) y lo que ya sabes. Escribimos el borrador y elegimos el tipo de contenido y la
              categoría que mejor encajan — tú los revisas antes de publicar.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand">
            Empezar con IA
            <Icon d={ARROW_ICON} size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="group flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 text-left shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#E0DBD4] hover:shadow-[0_16px_32px_-16px_rgba(23,20,17,.12)]"
        >
          <div className="grid size-[44px] place-items-center rounded-[13px] border border-border bg-background">
            <Icon d={PENCIL_ICON} size={20} strokeWidth={1.6} className="text-ink" />
          </div>
          <div>
            <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight">Crear manualmente</h2>
            <p className="text-[13px] leading-[1.55] text-ink-soft">
              Llena la ficha completa tú mismo, como en cualquier CMS tradicional — cada tipo tiene la suya, elige
              cuál abajo.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            {manualOpen ? "Ocultar tipos" : "Elegir tipo"}
            <Icon d={ARROW_ICON} size={14} strokeWidth={2} className={`transition-transform duration-200 ${manualOpen ? "-rotate-90" : "group-hover:translate-x-0.5"}`} />
          </span>
        </button>
      </div>

      {manualOpen && (
        <div className="flex flex-wrap justify-center gap-1.5 rounded-[14px] border border-dashed border-border bg-background p-4 [animation:pz-in_.2s_ease-out_both]">
          {TYPES.map((t) => (
            <Link
              key={t.value}
              href={`/crear/manual?site=lamira&type=${t.value}`}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-brand hover:bg-accent hover:text-accent-fg"
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
