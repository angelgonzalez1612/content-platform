"use client";

import { useMemo, useState } from "react";
import { ShowMoreRow, useVisibleRows } from "@/components/cms/show-more";
import { ContentSearch, matchesSearch } from "@/components/cms/content-search";
import { SourceLink } from "@/components/cms/source-link";
import { ReviewBanner } from "@/components/cms/review-banner";
import type { StatusFilter } from "./lamira-contenido-view";
import Link from "next/link";
import type { Category } from "@planazo/types";
import type { PlanazoEventRow, PlanazoGuideRow, PlanazoPlaceRow } from "@/lib/cms-api";
import { StatusBadge } from "@/components/cms/status-badge";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

type TypeFilter = "todos" | "lugares" | "eventos" | "guias";

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
  initialStatusFilter = "todos",
}: {
  places: PlanazoPlaceRow[];
  events: PlanazoEventRow[];
  guides: PlanazoGuideRow[];
  categories: Category[];
  initialStatusFilter?: StatusFilter;
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [search, setSearch] = useState("");

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
    return matchesSearch(search, p.name, p.address, p.slug, ...p.categories.map((c) => c.name));
  });
  const filteredEvents = events.filter((e) => {
    if (categoryFilter !== "todos" && e.categoryId !== categoryFilter) return false;
    if (statusFilter === "publicado" && e.status !== "published") return false;
    if (statusFilter === "en_revision" && e.status !== "in_review") return false;
    if (statusFilter === "sin_publicar" && e.status === "published") return false;
    return matchesSearch(search, e.name, e.locationName, e.slug, e.categoryId ? categoryNameById.get(e.categoryId) : null);
  });
  // Las guías no tienen categoría del catálogo (categoryLabel es texto libre,
  // ver PlanazoGuide) — el filtro de categoría de arriba no les aplica.
  const filteredGuides = guides.filter((g) => {
    if (statusFilter === "publicado" && g.status !== "published") return false;
    if (statusFilter === "en_revision" && g.status !== "in_review") return false;
    if (statusFilter === "sin_publicar" && g.status === "published") return false;
    return matchesSearch(search, g.title, g.categoryLabel, g.slug);
  });

  const inReviewCount =
    places.filter((p) => p.status === "in_review").length +
    events.filter((e) => e.status === "in_review").length +
    guides.filter((g) => g.status === "in_review").length;

  const filtersKey = `${typeFilter}|${categoryFilter}|${statusFilter}|${search}`;
  const placesPage = useVisibleRows(filteredPlaces, filtersKey);
  const eventsPage = useVisibleRows(filteredEvents, filtersKey);
  const guidesPage = useVisibleRows(filteredGuides, filtersKey);

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
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
        <ReviewBanner count={inReviewCount} site="planazo" onShowInTable={() => setStatusFilter("en_revision")} />
      )}

      <ContentSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar lugares, eventos o guías por nombre, zona o categoría…"
        resultCount={(showPlaces ? filteredPlaces.length : 0) + (showEvents ? filteredEvents.length : 0) + (showGuides ? filteredGuides.length : 0)}
      />

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
          className="rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
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

        {(typeFilter !== "todos" || categoryFilter !== "todos" || statusFilter !== "todos" || search) && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter("todos");
              setCategoryFilter("todos");
              setStatusFilter("todos");
              setSearch("");
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

          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="overflow-x-auto">
            <div className="grid min-w-[690px] grid-cols-[1fr_150px_130px_100px_50px_84px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Nombre</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Actualizado</span>
              <span className="text-center">Fuente</span>
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
                  search ? `Nada coincide con "${search}".` : "Ningún lugar coincide con estos filtros."
                )}
              </p>
            ) : (
              placesPage.visible.map((place) => (
                <div
                  key={place.id}
                  className="grid min-w-[690px] grid-cols-[1fr_150px_130px_100px_50px_84px] items-center gap-0 border-b border-border-soft px-4 py-1 transition-colors last:border-b-0 hover:bg-hover"
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
                    <SourceLink url={place.sourceUrl} />
                  </span>
                  <span className="flex justify-center">
                    <ViewPublishedLinks compact site="planazo" path={`lugares/${place.slug}`} available={place.status === "published"} previewHref={`/contenido/${place.id}`} />
                  </span>
                </div>
              ))
            )}
            </div>
            <ShowMoreRow remaining={placesPage.remaining} onClick={placesPage.showMore} />
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

          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="overflow-x-auto">
            <div className="grid min-w-[690px] grid-cols-[1fr_150px_130px_100px_50px_84px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Nombre</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Inicia</span>
              <span className="text-center">Fuente</span>
              <span className="text-center">Ver</span>
            </div>

            {filteredEvents.length === 0 ? (
              <p className="p-8 text-center text-[13.5px] text-ink-soft">
                {events.length === 0 ? "Todavía no hay eventos. Créalos con el botón de arriba." : search ? `Nada coincide con "${search}".` : "Ningún evento coincide con estos filtros."}
              </p>
            ) : (
              eventsPage.visible.map((event) => (
                <div
                  key={event.id}
                  className="grid min-w-[690px] grid-cols-[1fr_150px_130px_100px_50px_84px] items-center gap-0 border-b border-border-soft px-4 py-1 transition-colors last:border-b-0 hover:bg-hover"
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
                    <SourceLink url={event.sourceUrl} />
                  </span>
                  <span className="flex justify-center">
                    <ViewPublishedLinks compact site="planazo" path={`eventos/${event.slug}`} available={event.status === "published"} previewHref={`/contenido/planazo-evento/${event.id}`} />
                  </span>
                </div>
              ))
            )}
            </div>
            <ShowMoreRow remaining={eventsPage.remaining} onClick={eventsPage.showMore} />
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

          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[1fr_150px_130px_100px_84px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Título</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Actualizado</span>
              <span className="text-center">Ver</span>
            </div>

            {filteredGuides.length === 0 ? (
              <p className="p-8 text-center text-[13.5px] text-ink-soft">
                {guides.length === 0 ? "Todavía no hay guías. Créalas con el botón de arriba." : search ? `Nada coincide con "${search}".` : "Ninguna guía coincide con estos filtros."}
              </p>
            ) : (
              guidesPage.visible.map((guide) => (
                <div
                  key={guide.id}
                  className="grid min-w-[640px] grid-cols-[1fr_150px_130px_100px_84px] items-center gap-0 border-b border-border-soft px-4 py-1 transition-colors last:border-b-0 hover:bg-hover"
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
                    <ViewPublishedLinks compact site="planazo" path={`guias/${guide.slug}`} available={guide.status === "published"} previewHref={`/contenido/planazo-guia/${guide.id}`} />
                  </span>
                </div>
              ))
            )}
            </div>
            <ShowMoreRow remaining={guidesPage.remaining} onClick={guidesPage.showMore} />
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
        active ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
