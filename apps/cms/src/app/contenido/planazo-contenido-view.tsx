"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category, Place, PlanazoEvent, PlanazoGuide } from "@planazo/types";
import { StatusBadge } from "@/components/cms/status-badge";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { siteConfig } from "@planazo/config";

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

type TypeFilter = "todos" | "lugares" | "eventos" | "guias";
type StatusFilter = "todos" | "publicado" | "en_revision" | "sin_publicar";

// Antes Lugares y Eventos se apilaban uno debajo del otro — con muchos
// lugares, había que scrollear pasando todos para llegar a Eventos. El
// filtro de tipo deja saltar directo a la sección que se busca, mismo
// patrón que LamiraContenidoView (filtrado del lado del cliente, sin ida y
// vuelta al servidor — los datos ya vienen cargados del server component).
export function PlanazoContenidoView({
  places,
  events,
  guides,
  categories,
}: {
  places: Place[];
  events: PlanazoEvent[];
  guides: PlanazoGuide[];
  categories: Category[];
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoriesPresent = useMemo(() => {
    const ids = new Set<string>();
    places.forEach((p) => p.categories.forEach((c) => ids.add(c.id)));
    events.forEach((e) => e.categoryId && ids.add(e.categoryId));
    return categories.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [places, events, categories]);

  const filteredPlaces = places.filter((p) => {
    if (categoryFilter !== "todos" && !p.categories.some((c) => c.id === categoryFilter)) return false;
    if (statusFilter === "publicado" && p.status !== "published") return false;
    if (statusFilter === "en_revision" && p.status !== "in_review") return false;
    if (statusFilter === "sin_publicar" && p.status === "published") return false;
    return true;
  });
  const filteredEvents = events.filter((e) => {
    if (categoryFilter !== "todos" && e.categoryId !== categoryFilter) return false;
    if (statusFilter === "publicado" && e.status !== "published") return false;
    if (statusFilter === "en_revision" && e.status !== "in_review") return false;
    if (statusFilter === "sin_publicar" && e.status === "published") return false;
    return true;
  });
  // Las guías no tienen categoría del catálogo (categoryLabel es texto libre,
  // ver PlanazoGuide) — el filtro de categoría de arriba no les aplica.
  const filteredGuides = guides.filter((g) => {
    if (statusFilter === "publicado" && g.status !== "published") return false;
    if (statusFilter === "en_revision" && g.status !== "in_review") return false;
    if (statusFilter === "sin_publicar" && g.status === "published") return false;
    return true;
  });

  const inReviewCount =
    places.filter((p) => p.status === "in_review").length +
    events.filter((e) => e.status === "in_review").length +
    guides.filter((g) => g.status === "in_review").length;

  const showPlaces = typeFilter === "todos" || typeFilter === "lugares";
  const showEvents = typeFilter === "todos" || typeFilter === "eventos";
  const showGuides = typeFilter === "todos" || typeFilter === "guias";
  const total = places.length + events.length + guides.length;

  return (
    <>
      {/* Mismo header que La Mira (título + conteo + "+ Crear"), para que
          ambas vistas se vean iguales — el botón se adapta al tipo elegido
          en el filtro de abajo, ya que Planazo tiene 2 flujos de creación
          distintos (lugar vs. evento), a diferencia de La Mira. */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Planazo</h1>
          <p className="text-[13.5px] text-ink-soft">
            {total} {total === 1 ? "elemento" : "elementos"} · lugares, eventos y guías.
          </p>
        </div>
        {typeFilter === "eventos" ? (
          <Link
            href="/centro-ia?site=planazo&type=evento-planazo"
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
          >
            + Crear evento
          </Link>
        ) : typeFilter === "guias" ? (
          <Link
            href="/crear/manual?site=planazo&type=guia"
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
          >
            + Crear guía
          </Link>
        ) : (
          <Link
            href="/crear?site=planazo"
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
          >
            + Crear lugar
          </Link>
        )}
      </div>

      {inReviewCount > 0 && (
        <button
          type="button"
          onClick={() => setStatusFilter("en_revision")}
          className="mb-4 flex w-full items-center gap-2 rounded-[10px] border border-[#F4DDA0] bg-[#FEF6E7] px-4 py-2.5 text-left text-[13px] font-medium text-[#9A6B12] transition-colors hover:bg-[#FCEECA]"
        >
          <span aria-hidden>⏳</span>
          {inReviewCount} {inReviewCount === 1 ? "elemento" : "elementos"} en revisión — no salieron publicados solos
          porque no pasaron algún check automático (longitud, SEO, foto, etc). Revísalos antes de publicarlos a mano.
        </button>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          <FilterChip active={typeFilter === "todos"} onClick={() => setTypeFilter("todos")}>
            Todos
          </FilterChip>
          <FilterChip active={typeFilter === "lugares"} onClick={() => setTypeFilter("lugares")}>
            📍 Lugares
          </FilterChip>
          <FilterChip active={typeFilter === "eventos"} onClick={() => setTypeFilter("eventos")}>
            📅 Eventos
          </FilterChip>
          <FilterChip active={typeFilter === "guias"} onClick={() => setTypeFilter("guias")}>
            📖 Guías
          </FilterChip>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-full border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
        >
          <option value="todos">Todas las categorías</option>
          {categoriesPresent.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          <FilterChip active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>
            Cualquier estado
          </FilterChip>
          <FilterChip active={statusFilter === "publicado"} onClick={() => setStatusFilter("publicado")}>
            Publicado
          </FilterChip>
          <FilterChip active={statusFilter === "en_revision"} onClick={() => setStatusFilter("en_revision")}>
            En revisión{inReviewCount > 0 ? ` (${inReviewCount})` : ""}
          </FilterChip>
          <FilterChip active={statusFilter === "sin_publicar"} onClick={() => setStatusFilter("sin_publicar")}>
            Sin publicar
          </FilterChip>
        </div>

        {(typeFilter !== "todos" || categoryFilter !== "todos" || statusFilter !== "todos") && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter("todos");
              setCategoryFilter("todos");
              setStatusFilter("todos");
            }}
            className="text-[12.5px] font-medium text-ink-faint hover:text-brand"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {showPlaces && (
        <>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink-soft">
              Lugares
              <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">
                {filteredPlaces.length} de {places.length}
              </span>
            </h2>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="grid grid-cols-[1fr_150px_130px_100px_44px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Nombre</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Actualizado</span>
              <span className="text-center">Ver</span>
            </div>

            {filteredPlaces.length === 0 ? (
              <p className="p-8 text-center text-[13.5px] text-ink-soft">
                {places.length === 0 ? (
                  <>
                    Todavía no hay lugares. Corre <code className="font-mono text-[12px]">pnpm db:seed:places</code> en
                    planazo_backend para tener datos de prueba.
                  </>
                ) : (
                  "Ningún lugar coincide con estos filtros."
                )}
              </p>
            ) : (
              filteredPlaces.map((place) => (
                <div
                  key={place.id}
                  className="grid grid-cols-[1fr_150px_130px_100px_44px] items-center gap-0 border-b border-border-soft px-4 py-1 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
                >
                  <Link href={`/contenido/${place.id}`} className="min-w-0 py-2 pr-3">
                    <span className="block truncate text-[13.5px] font-medium tracking-tight hover:text-brand">{place.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">{place.address}</span>
                  </Link>
                  <span className="truncate text-[12.5px] text-ink-soft">{place.categories[0]?.name ?? "—"}</span>
                  <span>
                    <StatusBadge status={place.status} />
                  </span>
                  <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(place.updatedAt)}</span>
                  <span className="flex justify-center">
                    <ViewPublishedLink compact href={`${siteConfig.planazoUrl}/lugares/${place.slug}`} available={place.status === "published"} />
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showPlaces && (showEvents || showGuides) && <div className="h-8" />}

      {showEvents && (
        <>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink-soft">
              Eventos
              <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">
                {filteredEvents.length} de {events.length}
              </span>
            </h2>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="grid grid-cols-[1fr_150px_130px_100px_44px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Nombre</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Inicia</span>
              <span className="text-center">Ver</span>
            </div>

            {filteredEvents.length === 0 ? (
              <p className="p-8 text-center text-[13.5px] text-ink-soft">
                {events.length === 0 ? "Todavía no hay eventos. Créalos con el botón de arriba." : "Ningún evento coincide con estos filtros."}
              </p>
            ) : (
              filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[1fr_150px_130px_100px_44px] items-center gap-0 border-b border-border-soft px-4 py-1 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
                >
                  <Link href={`/contenido/planazo-evento/${event.id}`} className="min-w-0 py-2 pr-3">
                    <span className="block truncate text-[13.5px] font-medium tracking-tight hover:text-brand">{event.name}</span>
                    {event.locationName && <span className="block truncate text-[11.5px] text-ink-faint">{event.locationName}</span>}
                  </Link>
                  <span className="truncate text-[12.5px] text-ink-soft">{(event.categoryId && categoryNameById.get(event.categoryId)) ?? "—"}</span>
                  <span>
                    <StatusBadge status={event.status} />
                  </span>
                  <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(event.startDate)}</span>
                  <span className="flex justify-center">
                    <ViewPublishedLink compact href={`${siteConfig.planazoUrl}/eventos/${event.slug}`} available={event.status === "published"} />
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showEvents && showGuides && <div className="h-8" />}

      {showGuides && (
        <>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink-soft">
              Guías
              <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">
                {filteredGuides.length} de {guides.length}
              </span>
            </h2>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="grid grid-cols-[1fr_150px_130px_100px_44px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Título</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Actualizado</span>
              <span className="text-center">Ver</span>
            </div>

            {filteredGuides.length === 0 ? (
              <p className="p-8 text-center text-[13.5px] text-ink-soft">
                {guides.length === 0 ? "Todavía no hay guías. Créalas con el botón de arriba." : "Ninguna guía coincide con estos filtros."}
              </p>
            ) : (
              filteredGuides.map((guide) => (
                <div
                  key={guide.id}
                  className="grid grid-cols-[1fr_150px_130px_100px_44px] items-center gap-0 border-b border-border-soft px-4 py-1 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
                >
                  <Link href={`/contenido/planazo-guia/${guide.id}`} className="min-w-0 py-2 pr-3">
                    <span className="block truncate text-[13.5px] font-medium tracking-tight hover:text-brand">{guide.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">
                      {guide.placeSlugs.length} {guide.placeSlugs.length === 1 ? "parada" : "paradas"}
                    </span>
                  </Link>
                  <span className="truncate text-[12.5px] text-ink-soft">{guide.categoryLabel || "—"}</span>
                  <span>
                    <StatusBadge status={guide.status} />
                  </span>
                  <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(guide.updatedAt)}</span>
                  <span className="flex justify-center">
                    <ViewPublishedLink compact href={`${siteConfig.planazoUrl}/guias/${guide.slug}`} available={guide.status === "published"} />
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
        active ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
