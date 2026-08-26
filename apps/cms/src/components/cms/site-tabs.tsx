import Link from "next/link";

/** Reutilizado en /contenido, /crear y /centro-ia — todo lo demás de cada
 * página lee `site` de `searchParams` y decide qué renderizar; este
 * componente solo dibuja las pestañas y arma el href con el resto de la
 * query string que la página ya tenía (ej. `type`). */
export function SiteTabs({ site, basePath, extraQuery = "" }: { site: "planazo" | "lamira"; basePath: string; extraQuery?: string }) {
  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
      active ? "bg-accent text-accent-fg" : "text-ink-soft hover:bg-[#F5F3F0]"
    }`;
  return (
    <div className="mb-5 flex gap-1 border-b border-border-soft pb-3">
      <Link href={`${basePath}${extraQuery ? `?${extraQuery}` : ""}`} className={tabClass(site === "planazo")}>
        Planazo
      </Link>
      <Link href={`${basePath}?site=lamira${extraQuery ? `&${extraQuery}` : ""}`} className={tabClass(site === "lamira")}>
        La Mira
      </Link>
    </div>
  );
}
