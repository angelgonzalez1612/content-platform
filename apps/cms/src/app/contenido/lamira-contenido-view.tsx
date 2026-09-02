"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category } from "@planazo/types";
import type { LamiraContentRow } from "@/lib/cms-api";
import { LamiraStatusBadge, PublishedBadge, domainStatusLabel } from "@/components/cms/lamira-status-badge";
import { Tooltip } from "@/components/cms/tooltip";

// Solo estos 3 tienen borrador real (ContentStatus) — alerta/evento/lugar se
// publican de inmediato al crearse, así que su columna "Estado" siempre debe
// decir "Publicado" (ver PublishedBadge), nunca su situación real.
const HAS_DRAFT_WORKFLOW = new Set(["noticia", "guia", "reportaje"]);
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { LAMIRA_TYPE_PATH } from "@/lib/lamira-paths";
import { siteConfig } from "@planazo/config";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
};
const TYPE_ICON: Record<string, string> = {
  noticia: "📰",
  alerta: "🚨",
  guia: "📘",
  evento: "📅",
  lugar: "📍",
  reportaje: "🔎",
};
const TYPE_ORDER = ["noticia", "alerta", "guia", "evento", "lugar", "reportaje"] as const;

type StatusFilter = "todos" | "publicado" | "sin_publicar";

// Antes se apilaban los 6 tipos en una sola lista larga — para llegar a
// "Reportaje" había que scrollear pasando noticias/alertas/guías/eventos/
// lugares. Mismo patrón que GroupSelect en content-radar: filtrar del lado
// del cliente sobre datos ya cargados, sin ida y vuelta al servidor.
export function LamiraContenidoView({ rows, categories }: { rows: LamiraContentRow[]; categories: Category[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const typesPresent = useMemo(() => TYPE_ORDER.filter((t) => rows.some((r) => r.type === t)), [rows]);
  const categoriesPresent = useMemo(() => {
    const ids = new Set(rows.map((r) => r.categoryId).filter((id): id is string => !!id));
    return categories.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, categories]);

  const filtered = rows.filter((r) => {
    if (typeFilter !== "todos" && r.type !== typeFilter) return false;
    if (categoryFilter !== "todos" && r.categoryId !== categoryFilter) return false;
    if (statusFilter === "publicado" && !r.isPublished) return false;
    if (statusFilter === "sin_publicar" && r.isPublished) return false;
    return true;
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-background p-0.5">
          <FilterChip active={typeFilter === "todos"} onClick={() => setTypeFilter("todos")}>
            Todos
          </FilterChip>
          {typesPresent.map((t) => (
            <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {TYPE_ICON[t]} {TYPE_LABEL[t]}
            </FilterChip>
          ))}
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

      <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="grid grid-cols-[110px_1fr_150px_130px_100px_50px_44px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
          <span>Tipo</span>
          <span>Título</span>
          <span>Categoría</span>
          <span>Estado</span>
          <span className="text-right">Fecha</span>
          <span className="text-center">Fuente</span>
          <span className="text-center">Ver</span>
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-[13.5px] text-ink-soft">
            {rows.length === 0 ? "Todavía no hay contenido de la-mira. Créalo con el botón de arriba." : "Ningún elemento coincide con estos filtros."}
          </p>
        ) : (
          filtered.map((row) => (
            <div
              key={`${row.type}-${row.id}`}
              className="grid grid-cols-[110px_1fr_150px_130px_100px_50px_44px] items-center gap-0 border-b border-border-soft px-4 py-1.5 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
            >
              <span className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                <span aria-hidden="true">{TYPE_ICON[row.type]}</span>
                {TYPE_LABEL[row.type]}
              </span>
              <Link href={`/contenido/lamira/${row.type}/${row.id}`} className="min-w-0 py-1.5 pr-3 hover:text-brand">
                <span className="block truncate text-[13.5px] font-medium tracking-tight">{row.title}</span>
                {/* Situación real (activa/próximo/etc.) — distinta de si ya
                    está publicado, ver lamira-status-badge.tsx. Solo alerta/
                    evento la tienen. */}
                {domainStatusLabel(row.status) && <span className="block truncate text-[11.5px] text-ink-faint">{domainStatusLabel(row.status)}</span>}
              </Link>
              <span className="truncate text-[12.5px] text-ink-soft">{row.categoryName}</span>
              <span>{HAS_DRAFT_WORKFLOW.has(row.type) ? <LamiraStatusBadge status={row.status} /> : <PublishedBadge />}</span>
              <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(row.date)}</span>
              <span className="flex justify-center">
                {row.sourceUrl ? (
                  <Tooltip label="Ver fuente original">
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-accent hover:text-brand"
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 17L17 7M7 7h10v10" />
                      </svg>
                    </a>
                  </Tooltip>
                ) : (
                  <span className="text-[11px] text-ink-faint">—</span>
                )}
              </span>
              <span className="flex justify-center">
                <ViewPublishedLink compact href={`${siteConfig.lamiraUrl}/${LAMIRA_TYPE_PATH[row.type]}/${row.slug}`} available={row.isPublished} />
              </span>
            </div>
          ))
        )}
      </div>
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
