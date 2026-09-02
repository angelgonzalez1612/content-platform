import { LamiraPreviewCard } from "@/components/cms/lamira/lamira-preview-card";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

// Imagen de ejemplo real (Wikimedia Commons, licencia libre) — no un mockup
// inventado, para que /plantillas muestre exactamente el tipo de crédito que
// trae una imagen real elegida en el buscador.
const EXAMPLE_IMAGE = { url: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Mexico_City_traffic_cop.jpg", credit: "Janice Waltzer · CC BY 2.0 (Wikimedia Commons)" };

const RICH_EXAMPLE: Record<string, { name: string; categoryName: string; dek: string; content: ContentBlockValue[] }> = {
  noticia: {
    name: "Caos vial en Reforma por bloqueo de manifestantes",
    categoryName: "Tráfico",
    dek: "Automovilistas reportan hasta 40 minutos de retraso en la zona desde las 8 de la mañana.",
    content: [
      { heading: null, paragraphs: ["Decenas de manifestantes bloquearon **Paseo de la Reforma** la mañana de este jueves, a la altura de la Glorieta de la Palma, como parte de una protesta magisterial."] },
      { heading: null, paragraphs: ["La Secretaría de Movilidad recomendó tomar vías alternas como Río Churubusco o Circuito Interior mientras dura la manifestación."] },
    ],
  },
  guia: {
    name: "Cómo tramitar tu pasaporte en CDMX",
    categoryName: "Trámites",
    dek: "Todo lo que necesitas antes de ir a la SRE — requisitos, costos y cómo sacar cita.",
    content: [
      { heading: "Requisitos", paragraphs: ["Identificación oficial vigente, acta de nacimiento y comprobante de domicilio no mayor a 3 meses."] },
      { heading: "Costo y vigencia", paragraphs: ["Desde $1,565 MXN por un pasaporte de 3 años. El trámite se paga antes de la cita, en el banco o en línea."] },
    ],
  },
  reportaje: {
    name: "Un año de ciclovías nuevas en la ciudad",
    categoryName: "Movilidad",
    dek: "Qué cambió — y qué no — para quienes se mueven en bici por CDMX desde 2025.",
    content: [
      { heading: null, paragraphs: ["Desde la inauguración de los primeros 40 km de ciclovía protegida, los accidentes viales con ciclistas involucrados bajaron 18% en las zonas cubiertas, según datos de la Secretaría de Movilidad."] },
    ],
  },
};

/** Ejemplo estático de cómo se vería cada tipo de contenido ya publicado —
 * solo para /plantillas. Nunca lee datos reales; los textos son inventados a
 * propósito para ilustrar la plantilla, no contenido editorial de verdad.
 * `categoryName`, si se pasa, sustituye la categoría de ejemplo por la que el
 * humano eligió en el selector de categoría — así la vista previa se siente
 * ligada a la categoría real, no a un texto fijo. */
export function TemplateExamplePreview({ contentType, categoryName }: { contentType: string; categoryName?: string }) {
  switch (contentType) {
    case "noticia":
    case "guia":
    case "reportaje": {
      const e = RICH_EXAMPLE[contentType];
      return (
        <LamiraPreviewCard
          type={contentType}
          name={e.name}
          categoryName={categoryName ?? e.categoryName}
          image={EXAMPLE_IMAGE}
          dek={e.dek}
          description=""
          content={e.content}
          alertaStatus="activa"
          alcaldiaSlug=""
          eventoStatus="proximo"
          date=""
          time=""
          location=""
          price=""
          organizer=""
          kind="parque"
          colonia=""
        />
      );
    }
    case "alerta":
      return (
        <LamiraPreviewCard
          type="alerta"
          name="Cierre vial en Insurgentes por obras de Metrobús"
          categoryName={categoryName ?? "Tráfico"}
          image={EXAMPLE_IMAGE}
          dek=""
          description="La alcaldía Cuauhtémoc reporta el cierre parcial de Avenida Insurgentes, sentido sur, entre Álvaro Obregón y Sonora, por trabajos de mantenimiento en la Línea 1 del Metrobús."
          content={[]}
          alertaStatus="activa"
          alcaldiaSlug="cuauhtemoc"
          eventoStatus="proximo"
          date=""
          time=""
          location=""
          price=""
          organizer=""
          kind="parque"
          colonia=""
        />
      );
    case "evento":
      return (
        <LamiraPreviewCard
          type="evento"
          name="Festival de Jazz al aire libre"
          categoryName={categoryName ?? "Cultura"}
          image={EXAMPLE_IMAGE}
          dek=""
          description="Una tarde de jazz en vivo con agrupaciones locales, en la explanada principal del bosque. Entrada libre, cupo limitado."
          content={[]}
          alertaStatus="activa"
          alcaldiaSlug="miguel-hidalgo"
          eventoStatus="proximo"
          date="2026-09-12"
          time="17:00"
          location="Bosque de Chapultepec, 1ª Sección"
          price="Gratis"
          organizer="Secretaría de Cultura CDMX"
          kind="parque"
          colonia=""
        />
      );
    case "lugar":
      return (
        <LamiraPreviewCard
          type="lugar"
          name="Bosque de Chapultepec"
          categoryName={categoryName ?? "Parques"}
          image={EXAMPLE_IMAGE}
          dek=""
          description="Uno de los parques urbanos más grandes de América Latina, con museos, un lago artificial y el Castillo de Chapultepec en su primera sección."
          content={[]}
          alertaStatus="activa"
          alcaldiaSlug="miguel-hidalgo"
          eventoStatus="proximo"
          date=""
          time=""
          location=""
          price=""
          organizer=""
          kind="parque"
          colonia="Bosque de Chapultepec"
        />
      );
    case "place":
      // Place sí tiene price/address/zone/tags reales — el ejemplo deja
      // price=null a propósito (la IA nunca lo llena, se completa después de
      // crear), para que se note que "Gratis" ahí es un fallback, no un dato
      // confirmado.
      return (
        <PlanazoPreviewCard
          kind="lugar"
          name="Café Nube"
          categoryLabel={categoryName ?? "Cafés"}
          image={EXAMPLE_IMAGE}
          address="Colima 132, Roma Norte"
          zone="Roma Norte"
          price={null}
          tags={["Pet friendly", "Wifi", "Para trabajar"]}
          description={
            "Café de especialidad con tostado propio, terraza pequeña y buena luz para trabajar en la mañana — se llena después del mediodía.\n\n" +
            "Tiene enchufes en casi todas las mesas y el wifi aguanta videollamadas — el punto flaco es que no aceptan reservación, así que llegar antes de las 11 es la única forma segura de conseguir mesa."
          }
        />
      );
    case "evento-planazo":
      // PlanazoEvent no tiene price ni tags en el modelo real — no se
      // inventan aquí (ver PlanazoPreviewCard).
      return (
        <PlanazoPreviewCard
          kind="evento"
          name="Noche de trivia en Café Nube"
          categoryLabel={categoryName ?? "Eventos"}
          image={EXAMPLE_IMAGE}
          locationName="Café Nube, Roma Norte"
          dateLabel="Todos los jueves, 20:00"
          description={
            "Pon a prueba tus conocimientos generales cada jueves por la noche — equipos de hasta 5 personas, premio para el primer lugar.\n\n" +
            "Las categorías cambian cada semana, desde cine hasta historia de CDMX — llega 15 minutos antes para apartar mesa, porque se llena rápido."
          }
        />
      );
    default:
      return null;
  }
}
