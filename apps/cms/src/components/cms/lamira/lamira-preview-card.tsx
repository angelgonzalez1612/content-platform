import type { ReactNode } from "react";
import type { AlertaStatus, EventoStatus, LugarKind } from "@planazo/types";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

const KIND_LABEL: Record<LugarKind, string> = {
  parque: "Parque",
  plaza: "Plaza",
  museo: "Museo",
  monumento: "Monumento",
  colonia: "Colonia",
  "estacion-metro": "Estación de Metro",
  "estacion-metrobus": "Estación de Metrobús",
};

const ALERTA_STATUS_META: Record<AlertaStatus, { label: string; className: string }> = {
  activa: { label: "Activa", className: "bg-[#FDECEA] text-[#C4453A]" },
  "en-seguimiento": { label: "En seguimiento", className: "bg-[#FEF6E7] text-[#9A6B12]" },
  resuelta: { label: "Resuelta", className: "bg-[#EAF6EC] text-[#2E7D42]" },
};

const EVENTO_STATUS_LABEL: Record<EventoStatus, string> = {
  proximo: "Próximo",
  "en-curso": "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

// Espejo visual del AdSlot real de la-mira (src/components/ads/AdSlot.tsx) —
// mismo texto/formato de placeholder ("Espacio publicitario · SIZE · Google
// AdSense") que se ve ahí cuando no hay AdSense configurado, para que la
// vista previa muestre dónde caen los anuncios de verdad, no un mockup
// inventado. `rectangle` = el de la barra lateral en la página real (aquí,
// sin layout de 2 columnas, se centra angosto); `in-feed` = el que interrumpe
// el cuerpo después del segundo bloque (misma posición que la página real).
const AD_SIZES: Record<"rectangle" | "in-feed", { label: string; maxWidth: number; aspect: string }> = {
  rectangle: { label: "300×250", maxWidth: 300, aspect: "300 / 250" },
  "in-feed": { label: "responsivo", maxWidth: 640, aspect: "1240 / 200" },
};

function AdSlotPreview({ format }: { format: "rectangle" | "in-feed" }) {
  const size = AD_SIZES[format];
  return (
    <div
      role="presentation"
      className="mx-auto flex w-full items-center justify-center rounded-[8px] border border-dashed border-border-soft bg-background text-[10.5px] font-medium tracking-wider text-ink-faint uppercase"
      style={{ maxWidth: size.maxWidth, aspectRatio: size.aspect }}
    >
      Espacio publicitario · {size.label} · Google AdSense
    </div>
  );
}

// Markdown mínimo dentro de un párrafo — **negritas**, *cursiva*, ==color de
// acento==. Mismo parser que usa el cuerpo real de la-mira (ver renderInline
// en las páginas de detalle), para que resaltar/inclinar/colorear una palabra
// en el editor de bloques realmente se vea así una vez publicado, no solo en
// esta vista previa. Mayúsculas no necesita sintaxis propia — se escriben
// directo en el texto.
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|==[^=]+==|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("==") && part.endsWith("==") && part.length > 4) {
      return (
        <mark key={i} className="bg-transparent font-semibold text-brand">
          {part.slice(2, -2)}
        </mark>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export interface LamiraPreviewProps {
  type: string;
  name: string;
  categoryName: string | null;
  image: { url: string; credit: string } | null;
  dek: string;
  description: string;
  content: ContentBlockValue[];
  alertaStatus: AlertaStatus;
  alcaldiaSlug: string;
  eventoStatus: EventoStatus;
  date: string;
  time: string;
  location: string;
  price: string;
  organizer: string;
  kind: LugarKind;
  colonia: string;
}

/** Aproximación visual de cómo quedaría publicado en La Mira — no reutiliza
 * el CSS real del sitio (repo aparte, sin sistema de diseño compartido), pero
 * sigue su misma anatomía (eyebrow de categoría, imagen con crédito, cuerpo)
 * para que la revisión sea sobre el contenido, no un formulario más. */
export function LamiraPreviewCard({
  type,
  name,
  categoryName,
  image,
  dek,
  description,
  content,
  alertaStatus,
  alcaldiaSlug,
  eventoStatus,
  date,
  time,
  location,
  price,
  organizer,
  kind,
  colonia,
}: LamiraPreviewProps) {
  const isRichContent = type === "noticia" || type === "guia" || type === "reportaje";
  const path = type === "lugar" ? "lugares" : type === "evento" ? "eventos" : type === "guia" ? "guias" : type === "reportaje" ? "reportajes" : type === "alerta" ? "alertas" : "noticias";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Vista previa — cómo se vería en La Mira</span>

      <div className="overflow-hidden rounded-[14px] border border-border-soft bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex items-center gap-1.5 border-b border-border-soft bg-background px-3 py-2">
          <span className="size-2 rounded-full bg-[#E4A951]" />
          <span className="size-2 rounded-full bg-[#DE7A54]" />
          <span className="size-2 rounded-full bg-[#7AAE7C]" />
          <span className="ml-2 truncate font-mono text-[11px] text-ink-faint">lamira.mx/{path}/{slugPreview(name)}</span>
        </div>

        <article className="p-5 sm:p-7">
          {image && (
            <figure className="mb-4 -mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={image.url} alt="" className="aspect-video w-full rounded-[10px] object-cover" />
              <figcaption className="mt-1.5 text-[11px] text-ink-faint">{image.credit}</figcaption>
            </figure>
          )}

          <p className="text-[11.5px] font-bold tracking-wide text-brand uppercase">{categoryName ?? "Sin categoría"}</p>

          <h2 className="mt-1.5 font-serif text-[22px] leading-[1.2] font-semibold text-ink text-balance sm:text-[26px]">{name || "(sin título todavía)"}</h2>

          {type === "alerta" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${ALERTA_STATUS_META[alertaStatus].className}`}>{ALERTA_STATUS_META[alertaStatus].label}</span>
              {alcaldiaSlug && <span className="text-[12px] text-ink-faint">{alcaldiaSlug}</span>}
            </div>
          )}

          {type === "evento" && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-soft">
              {date && <span>{date}{time ? ` · ${time}` : ""}</span>}
              {location && <span>{location}</span>}
              {price && <span>{price}</span>}
              {organizer && <span>Organiza: {organizer}</span>}
              <span className="font-medium">{EVENTO_STATUS_LABEL[eventoStatus]}</span>
            </div>
          )}

          {type === "lugar" && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-soft">
              <span>{KIND_LABEL[kind]}</span>
              {colonia && <span>{colonia}</span>}
              {alcaldiaSlug && <span>{alcaldiaSlug}</span>}
            </div>
          )}

          {isRichContent && dek && <p className="mt-3 text-[15px] leading-[1.55] text-ink-soft">{renderInline(dek)}</p>}

          {/* rectangle = ad de la barra lateral en la página real; aquí, sin esas 2 columnas, va centrado justo debajo del encabezado — misma posición relativa (antes del cuerpo). */}
          {(type === "noticia" || type === "guia" || type === "reportaje") && (
            <div className="my-4">
              <AdSlotPreview format="rectangle" />
            </div>
          )}

          {!isRichContent && description && <p className="mt-3 text-[14px] leading-[1.6] whitespace-pre-line text-ink">{renderInline(description)}</p>}

          {(type === "alerta" || type === "evento") && (
            <div className="my-4">
              <AdSlotPreview format="rectangle" />
            </div>
          )}

          {isRichContent && content.length > 0 && (
            <div className="mt-5 flex flex-col gap-4 border-t border-border-soft pt-5">
              {content.map((block, i) => (
                <div key={i} className="contents">
                  <div className="flex flex-col gap-1.5">
                    {block.heading && <h3 className="font-serif text-[16px] font-semibold text-ink">{block.heading}</h3>}
                    {block.paragraphs.map((p, j) => (
                      <p key={j} className="text-[14px] leading-[1.65] text-ink-soft">
                        {renderInline(p)}
                      </p>
                    ))}
                  </div>
                  {/* in-feed = mismo lugar que la página real de noticia/guía: justo después del 2º bloque. Reportaje no lo tiene en el sitio real, por eso no aparece aquí. */}
                  {i === 1 && (type === "noticia" || type === "guia") && <AdSlotPreview format="in-feed" />}
                </div>
              ))}
            </div>
          )}

          {isRichContent && content.length === 0 && <p className="mt-4 text-[13px] text-ink-faint italic">Sin cuerpo todavía — se completa arriba, en el editor de bloques.</p>}

          {type !== "lugar" && (
            <div className="mt-5 flex flex-col gap-1 border-t border-border-soft pt-3 text-[11px] text-ink-faint">
              <p>Puedes darle formato a cualquier párrafo — se ve reflejado arriba y también en la página real:</p>
              <p>
                <code className="rounded bg-background px-1 py-0.5 font-mono">**negritas**</code>
                {" · "}
                <code className="rounded bg-background px-1 py-0.5 font-mono">*cursiva*</code>
                {" · "}
                <code className="rounded bg-background px-1 py-0.5 font-mono">==color de acento==</code>
                {" · "}
                MAYÚSCULAS se escriben directo, sin sintaxis especial.
              </p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function slugPreview(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "…"
  );
}
