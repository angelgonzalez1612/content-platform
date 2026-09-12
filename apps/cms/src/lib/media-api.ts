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

// Acervo aparte — imágenes guardadas desde el buscador (Wikimedia/Openverse)
// que todavía no están usadas en ninguna pieza de contenido. El binario vive
// en el hosting FTP del cliente (ver FtpStorageService en la API); aquí solo
// se guarda la URL pública final.
export interface MediaAsset {
  id: string;
  url: string;
  credit: string | null;
  source: "wikimedia" | "openverse";
  sourcePageUrl: string | null;
  categoryName: string | null;
  createdAt: string;
}
