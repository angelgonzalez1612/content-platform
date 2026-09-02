// Aproximación visual de cómo quedaría publicado en Planazo — mismo criterio
// que LamiraPreviewCard (ver apps/cms/src/components/cms/lamira/lamira-preview-card.tsx):
// no reutiliza el CSS real del sitio (repo aparte), pero sigue su misma
// anatomía para que sirva como ejemplo honesto de la plantilla.
//
// El espacio publicitario mimetiza el AdSlot real de planazo_fronted (src/
// components/ad-slot.tsx) — mismo texto/formato de placeholder ("Publicidad"
// + "Espacio publicitario · SIZE") que se ve ahí cuando no hay AdSense
// configurado, y en la misma posición relativa que el sitio real (después de
// la descripción, ver plan-detail-view.tsx). Si la descripción trae más de
// un párrafo (separados por línea en blanco), el anuncio se intercala entre
// el primero y el resto — igual que el "in-feed" de La Mira entre bloques.
//
// A propósito, "lugar" y "evento" NO comparten un shape genérico: Place
// (lugar) sí tiene price/address/zone/tags reales (ver packages/types), pero
// PlanazoEvent (evento) no tiene NI precio NI tags — solo
// name/description/startDate/endDate/locationName (ver planazo-event-form.tsx).
// Antes este componente mostraba un cuadro de "Precio" siempre, para ambos —
// para un evento eso mostraba un dato que el modelo real ni siquiera captura.
export type PlanazoPreviewProps =
  | {
      kind: "lugar";
      name: string;
      categoryLabel: string;
      image: { url: string; credit: string } | null;
      address: string;
      zone: string;
      price: number | null;
      tags: string[];
      description: string;
      // Cuerpo extendido opcional, agregado con "Mejorar con IA" (modo
      // "Agregar contenido") — solo "lugar" lo modela, ver Place en
      // packages/types. Un anuncio real se intercala cada 2 secciones,
      // igual que noticia.content en La Mira.
      content?: { heading?: string | null; paragraphs: string[]; image?: { url: string; credit: string } | null }[];
    }
  | {
      kind: "evento";
      name: string;
      categoryLabel: string;
      image: { url: string; credit: string } | null;
      locationName: string;
      dateLabel: string;
      description: string;
      // Mismo cuerpo extendido opcional que "lugar" (ver arriba) — evento-planazo
      // ya modela `content` igual (ver AiDraftService.expandPlanazoEvento).
      content?: { heading?: string | null; paragraphs: string[]; image?: { url: string; credit: string } | null }[];
    };

type ContentBlockPreview = NonNullable<Extract<PlanazoPreviewProps, { kind: "lugar" }>["content"]>;

function AdSlotPreview({ size }: { size: string }) {
  return (
    <div
      role="presentation"
      className="relative flex items-center justify-center rounded-2xl border border-dashed border-[#E0D9D2] bg-[#FBF8F5] p-3.5 text-center text-[11px] font-semibold text-[#756C65]"
    >
      <span className="absolute top-2 left-3 font-mono text-[9px] font-bold tracking-widest text-[#756C65] uppercase">Publicidad</span>
      Espacio publicitario · {size}
    </div>
  );
}

// Divide la descripción en párrafos (línea en blanco) e intercala el
// anuncio entre el primero y el resto — si solo hay un párrafo, el anuncio
// simplemente va después, igual que en el sitio real.
function DescriptionWithAd({ description }: { description: string }) {
  if (!description) return null;
  const paragraphs = description.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-[14px] leading-[1.6] text-ink-soft">{paragraphs[0]}</p>
      <AdSlotPreview size="728 × 90" />
      {paragraphs.slice(1).map((p, i) => (
        <p key={i} className="text-[14px] leading-[1.6] text-ink-soft">
          {p}
        </p>
      ))}
    </div>
  );
}

export function PlanazoPreviewCard(props: PlanazoPreviewProps) {
  const { kind, name, categoryLabel, image, description } = props;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Vista previa — cómo se vería en Planazo</span>

      <div className="overflow-hidden rounded-[14px] border border-border-soft bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex items-center gap-1.5 border-b border-border-soft bg-background px-3 py-2">
          <span className="size-2 rounded-full bg-[#E4A951]" />
          <span className="size-2 rounded-full bg-[#DE7A54]" />
          <span className="size-2 rounded-full bg-[#7AAE7C]" />
          <span className="ml-2 truncate font-mono text-[11px] text-ink-faint">
            planazo.mx/{kind === "lugar" ? "lugares" : "eventos"}/{slugPreview(name)}
          </span>
        </div>

        <article className="p-5 sm:p-6">
          {image && (
            <figure className="mb-4 -mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={image.url} alt="" className="aspect-video w-full rounded-[10px] object-cover" />
              <figcaption className="mt-1.5 text-[11px] text-ink-faint">{image.credit}</figcaption>
            </figure>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold text-accent-fg">
            🏷️ {categoryLabel}
          </span>

          <h2 className="mt-2.5 font-serif text-[22px] leading-[1.2] font-semibold text-ink text-balance sm:text-[26px]">{name || "(sin nombre todavía)"}</h2>

          {kind === "lugar" ? (
            <>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-soft">
                {props.address && <span>📍 {props.address}</span>}
                {props.zone && <span>{props.zone}</span>}
              </p>

              {props.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {props.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border-soft bg-background px-2.5 py-1 text-[11.5px] font-medium text-ink-soft">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <DescriptionWithAd description={description} />

              {/* Solo "lugar" tiene precio de verdad en el modelo — un
                  evento de Planazo no lo captura (ver comentario arriba). */}
              <div className="mt-4 flex items-center justify-between rounded-[10px] border border-border-soft bg-background px-4 py-3">
                <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">Precio</span>
                <span className="text-[15px] font-semibold text-ink">{props.price !== null ? `$${props.price} MXN` : "Gratis"}</span>
              </div>

              {props.content && <ExtendedContent content={props.content} />}
            </>
          ) : (
            <>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-soft">
                {props.locationName && <span>📍 {props.locationName}</span>}
                {props.dateLabel && <span>📅 {props.dateLabel}</span>}
              </p>

              <DescriptionWithAd description={description} />

              {/* Fijo en "Gratis" a propósito — PlanazoEvent no captura su
                  propio precio todavía (ver comentario arriba), pero la
                  mayoría de los eventos sí lo son, y se ve raro un evento sin
                  este dato cuando "lugar" siempre lo trae. */}
              <div className="mt-4 flex items-center justify-between rounded-[10px] border border-border-soft bg-background px-4 py-3">
                <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">Precio</span>
                <span className="text-[15px] font-semibold text-ink">Gratis</span>
              </div>

              {props.content && <ExtendedContent content={props.content} />}
            </>
          )}
        </article>
      </div>
    </div>
  );
}

// Cuerpo extendido opcional (ver PlanazoPreviewProps.content) — mismo patrón
// que noticia.content en La Mira: encabezado + párrafos + imagen opcional
// por sección, con un anuncio real intercalado cada 2 secciones.
function ExtendedContent({ content }: { content: ContentBlockPreview }) {
  if (!content.length) return null;
  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-border-soft pt-5">
      {content.map((block, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          {block.heading && <h3 className="font-serif text-[16px] font-semibold text-ink">{block.heading}</h3>}
          {block.image && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={block.image.url} alt="" className="aspect-video w-full rounded-[10px] object-cover" />
              <figcaption className="mt-1.5 text-[11px] text-ink-faint">{block.image.credit}</figcaption>
            </figure>
          )}
          {block.paragraphs.map((p, pi) => (
            <p key={pi} className="text-[14px] leading-[1.6] text-ink-soft">
              {p}
            </p>
          ))}
          {i % 2 === 1 && i < content.length - 1 && <AdSlotPreview size="responsivo" />}
        </div>
      ))}
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
