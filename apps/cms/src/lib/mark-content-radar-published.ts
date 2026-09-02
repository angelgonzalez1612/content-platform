import { apiConfig } from "@planazo/config";

// Se llama justo después de crear con éxito una pieza que vino del botón
// "Publicar" de Content Radar (`initialName` viene de su deep-link `?name=`,
// ver PublishFlow/centro-ia/page.tsx) — para que ese tema se marque como
// hecho en el reporte y no invite a publicarlo otra vez. Sin bloquear ni
// mostrar error si falla: es un extra de comodidad, no debe impedir navegar
// al contenido recién creado si esta llamada falla por lo que sea.
export function markContentRadarPublished(params: { title: string; site: "la-mira" | "planazo"; contentType: string; contentId: string }) {
  fetch(`${apiConfig.baseUrl}/cms/content-radar/mark-published`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch(() => {
    // silencioso a propósito — ver comentario arriba.
  });
}
