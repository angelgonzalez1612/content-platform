"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category } from "@planazo/types";
import type { MediaItem, MediaAsset } from "@/lib/media-api";
import { contentEditHref, contentTypeIcon, contentTypeLabel } from "@/lib/dashboard-api";
import { MediaSearchPanel } from "./media-search-panel";

type SiteFilter = "all" | "la-mira" | "planazo";
type Tab = "en-uso" | "buscar";

const NO_CATEGORY = "__sin_categoria__";

export function MediaView({
  initialItems,
  initialAssets,
  categories,
}: {
  initialItems: MediaItem[];
  initialAssets: MediaAsset[];
  categories: Category[];
}) {
  const [tab, setTab] = useState<Tab>("en-uso");
  const [assets, setAssets] = useState(initialAssets);
  const [siteFilter, setSiteFilter] = useState<SiteFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const typesPresent = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const it of initialItems) {
      if (!seen.has(it.contentType)) {
        seen.add(it.contentType);
        order.push(it.contentType);
      }
    }
    return order;
  }, [initialItems]);

  // Categoría editorial real (no el tipo de contenido) — para poder ver
  // "toda la variedad de fotos de Comida", por ejemplo, sin importar si es
  // una noticia, un lugar o una guía, útil al buscar un reemplazo.
  const categoriesPresent = useMemo(() => {
    const names = new Set<string>();
    let hasUncategorized = false;
    for (const it of initialItems) {
      if (it.categoryName) names.add(it.categoryName);
      else hasUncategorized = true;
    }
    return { names: [...names].sort((a, b) => a.localeCompare(b, "es")), hasUncategorized };
  }, [initialItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialItems.filter((it) => {
      if (siteFilter !== "all" && it.site !== siteFilter) return false;
      if (typeFilter !== "all" && it.contentType !== typeFilter) return false;
      if (categoryFilter === NO_CATEGORY && it.categoryName) return false;
      if (categoryFilter !== "all" && categoryFilter !== NO_CATEGORY && it.categoryName !== categoryFilter) return false;
      if (q && !it.contentTitle.toLowerCase().includes(q) && !(it.credit ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initialItems, siteFilter, typeFilter, categoryFilter, query]);

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-[18px] flex flex-wrap items-end gap-4">
        <div>
          <h1 className="mb-1 text-[25px] font-semibold tracking-tight">Biblioteca Multimedia</h1>
          <p className="text-[13.5px] text-ink-soft">
            {tab === "en-uso"
              ? `${filtered.length} de ${initialItems.length} ${initialItems.length === 1 ? "imagen" : "imágenes"} en uso.`
              : `${assets.length} ${assets.length === 1 ? "imagen guardada" : "imágenes guardadas"} sin usar todavía.`}
          </p>
        </div>
        <div className="flex-1" />
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          {(
            [
              { id: "en-uso", label: "En uso" },
              { id: "buscar", label: "Buscar y guardar" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "buscar" ? (
        <MediaSearchPanel assets={assets} categories={categories} onAssetsChange={setAssets} />
      ) : (
        <>
      <div className="mb-[18px] flex flex-wrap items-end gap-4">
        <div className="flex-1" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o crédito…"
          className="w-full max-w-[260px] rounded-full border border-border bg-white px-3.5 py-1.5 text-[12.5px] transition-colors placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-full border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
        >
          <option value="all">Todas las categorías</option>
          {categoriesPresent.names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {categoriesPresent.hasUncategorized && <option value={NO_CATEGORY}>Sin categoría</option>}
        </select>
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "la-mira", label: "La Mira" },
              { id: "planazo", label: "Planazo" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSiteFilter(f.id)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                siteFilter === f.id ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-background p-0.5">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
            typeFilter === "all" ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
          }`}
        >
          Todos los tipos
        </button>
        {typesPresent.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
              typeFilter === t ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
            }`}
          >
            {contentTypeIcon(t)} {contentTypeLabel(t)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-white p-10 text-center text-[13.5px] text-ink-soft">
          {initialItems.length === 0 ? "Todavía no hay imágenes en uso." : "Ninguna imagen coincide con estos filtros."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((it) => (
            <Link
              key={`${it.contentType}-${it.id}`}
              href={contentEditHref(it.contentType, it.contentId)}
              className="group relative overflow-hidden rounded-[12px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]"
            >
              <div className="relative aspect-square overflow-hidden bg-[#F3F0EC]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.alt ?? it.contentTitle} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
              </div>
              <div className="p-2">
                <span className="block truncate text-[11.5px] font-medium tracking-tight">{it.contentTitle}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="flex-none rounded font-mono text-[9px] text-[#8A837B]" style={{ background: "#F3F0EC", padding: "1px 4px" }}>
                    {contentTypeIcon(it.contentType)} {contentTypeLabel(it.contentType)}
                  </span>
                  {it.categoryName && (
                    <span className="flex-none truncate rounded font-mono text-[9px] text-accent-fg" style={{ background: "#FFF2E8", padding: "1px 4px", maxWidth: 100 }}>
                      {it.categoryName}
                    </span>
                  )}
                </div>
              </div>
              {it.credit && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[46px] bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="line-clamp-2 text-[10.5px] leading-tight text-white">{it.credit}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
