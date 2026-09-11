// Tipos para la Biblioteca Multimedia — catálogo real de imágenes en uso
// (MediaService en la API), no un sistema de archivos nuevo.

export interface MediaItem {
  id: string;
  url: string;
  credit: string | null;
  alt: string | null;
  contentType: string;
  contentId: string;
  contentTitle: string;
  site: "la-mira" | "planazo";
  categoryName: string | null;
}
