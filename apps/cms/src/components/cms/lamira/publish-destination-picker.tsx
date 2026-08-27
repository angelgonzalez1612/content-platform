"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

const RADAR_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

const SITES = [
  { value: "lamira", label: "La Mira" },
  { value: "planazo", label: "Planazo" },
] as const;

const TYPES = [
  { value: "noticia", label: "Noticia", hint: "Un hecho puntual y reciente — tráfico, seguridad, gobierno…" },
  { value: "alerta", label: "Alerta", hint: "Aviso urgente en curso — cierre vial, corte, riesgo activo" },
  { value: "guia", label: "Guía", hint: "Trámite o instructivo paso a paso, no ligado a una fecha" },
  { value: "evento", label: "Evento", hint: "Algo con fecha, hora y lugar — concierto, feria, festival…" },
  { value: "lugar", label: "Lugar", hint: "Un sitio en sí — parque, museo, estación, colonia…" },
  { value: "reportaje", label: "Reportaje", hint: "Análisis a fondo, no urgente — contexto detrás de un tema" },
];

// Heurística simple por palabras clave — no es IA, es solo para no dejar la
// elección totalmente a ciegas cuando el título no deja claro qué tipo es
// (ej. "Cierre en Reforma" suena a Alerta más que a Noticia genérica).
// Sigue siendo 100% editable; esto solo pre-selecciona y marca "Sugerido".
// Vocabulario ajustado contra titulares REALES de content-radar (no
// supuestos) — el primer intento usaba palabras de libro de texto
// ("riesgo", "desalojo") que casi nunca aparecen; el tráfico/vialidad de
// CDMX se reporta con "bloqueos", "vial", "caos", "colapsa", "marchas".
function suggestType(text: string): string {
  const t = text.toLowerCase();
  if (
    /\b(cierre|cerrad[oa]|corte|riesgo|accidente|choque|incendio|balacera|alerta|evacua|desalojo|bloqueo|bloqueos|vial|caos|colapsa|colapso|manifestaci[oó]n(es)?|march(a|as)|protesta(s)?)\b/.test(
      t,
    )
  )
    return "alerta";
  if (/\b(concierto|festival|feria|exposici[oó]n|boletos|entradas|inaugura)\b/.test(t)) return "evento";
  if (/\b(c[oó]mo\s|tr[aá]mite|requisitos|pasos para)\b/.test(t)) return "guia";
  if (/\b(parque|museo|plaza|monumento|estaci[oó]n de|colonia)\b/.test(t)) return "lugar";
  return "noticia";
}

// Content Radar manda un tema (?name=&hints=) directo a Centro IA — antes
// eso arrancaba de una el formulario ya con "La Mira / Noticia" fijos, sin
// preguntar. Este paso intermedio confirma (o cambia) sitio y tipo antes de
// llegar al formulario — La Mira + Noticia siguen sugeridos por defecto
// (lo más común viniendo de un tema de tendencias CDMX), pero ahora es una
// elección explícita, no algo que el link ya decidió por ti.
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
  const suggested = suggestType(`${name} ${hints}`);
  const [type, setType] = useState(initialType !== "noticia" && TYPES.some((t) => t.value === initialType) ? initialType : suggested);

  const continueQuery = new URLSearchParams({ site, name });
  if (site === "lamira") continueQuery.set("type", type);
  if (hints) continueQuery.set("hints", hints);

  return (
    <div className="mx-auto max-w-[620px] p-[26px] pb-[60px] text-center">
      <div className="mx-auto mb-4 grid size-[46px] place-items-center rounded-2xl border border-[#FFE2CC] bg-accent">
        <Icon d={RADAR_ICON} size={22} strokeWidth={1.6} className="text-brand" />
      </div>
      <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Dónde publicamos esto?</h1>
      <p className="mx-auto mb-2 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-soft">
        Content Radar te trajo un tema. Antes de escribir el borrador, confirma sitio y tipo de contenido.
      </p>

      <div className="mx-auto mb-7 flex max-w-[46ch] items-start gap-2.5 rounded-[12px] border border-border-soft bg-background p-3.5 text-left">
        <Icon d={RADAR_ICON} size={14} strokeWidth={1.8} className="mt-0.5 flex-none text-ink-faint" />
        <p className="text-[13px] leading-[1.5] text-ink">{name}</p>
      </div>

      <div className="flex flex-col gap-6 text-left">
        <div className="flex flex-col gap-2">
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

        {site === "lamira" && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10.5px] font-medium tracking-[.08em] text-ink-faint uppercase">Tipo de contenido</span>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    type === t.value ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold">{t.label}</span>
                    {t.value === suggested && (
                      <span className="rounded-full bg-brand px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[.03em] text-white uppercase">
                        Sugerido
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] leading-[1.4] text-ink-faint">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
