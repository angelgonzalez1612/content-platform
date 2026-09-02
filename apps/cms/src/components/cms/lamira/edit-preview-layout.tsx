import type { ReactNode } from "react";

// Layout de 2 columnas para los formularios de edición manual de la-mira:
// formulario a la izquierda (scroll normal de la página, vía CmsShell) y
// vista previa a la derecha, pegada arriba (`sticky`) con su propio scroll
// una vez que crece más que el alto disponible — más simple que el panel de
// alto forzado del flujo de generación con IA porque aquí sí es una página
// normal, no una pantalla dividida de app.
export function EditPreviewLayout({ left, preview }: { left: ReactNode; preview: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="w-full flex-none lg:sticky lg:top-[26px] lg:max-h-[calc(100vh-52px)] lg:w-[380px] lg:overflow-y-auto xl:w-[420px]">
        {preview}
      </div>
    </div>
  );
}
