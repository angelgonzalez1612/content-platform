"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import type { CalendarItem } from "@/lib/calendar-api";
import { contentEditHref, contentPublishedHref, contentTypeIcon, contentTypeLabel } from "@/lib/dashboard-api";
import { Icon } from "@/components/icon";
import { ViewPublishedLink } from "@/components/cms/view-published-link";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_LABEL = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
const DAY_LABEL = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" });

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function todayParts(): { year: number; month: number; day: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function CalendarView({
  initialItems,
  initialYear,
  initialMonth,
}: {
  initialItems: CalendarItem[];
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [siteFilter, setSiteFilter] = useState<"all" | "la-mira" | "planazo">("all");
  const today = todayParts();
  const [selectedDay, setSelectedDay] = useState<number | null>(year === today.year && month === today.month ? today.day : null);

  useEffect(() => {
    if (year === initialYear && month === initialMonth) {
      setItems(initialItems);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${apiConfig.clientBaseUrl}/cms/calendar?year=${year}&month=${month}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CalendarItem[]) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const filteredItems = useMemo(() => (siteFilter === "all" ? items : items.filter((i) => i.site === siteFilter)), [items, siteFilter]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, CalendarItem[]>();
    for (const item of filteredItems) {
      const d = new Date(item.date);
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return map;
  }, [filteredItems, year, month]);

  // Independiente de siteFilter — la franja de KPIs siempre muestra el
  // desglose completo del mes, aunque la vista de calendario esté filtrada
  // a un solo sitio.
  const monthItems = useMemo(
    () =>
      items.filter((i) => {
        const d = new Date(i.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }),
    [items, year, month],
  );
  const monthDaysActive = useMemo(() => new Set(monthItems.map((i) => new Date(i.date).getDate())).size, [monthItems]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month - 1, 1);
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Lunes = 0
    const daysInMonth = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const day = i - leadingBlanks + 1;
      return day >= 1 && day <= daysInMonth ? day : null;
    });
  }, [year, month]);

  function goToMonth(deltaMonths: number) {
    const d = new Date(year, month - 1 + deltaMonths, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDay(null);
  }

  function goToday() {
    setYear(today.year);
    setMonth(today.month);
    setSelectedDay(today.day);
  }

  const monthLabel = MONTH_LABEL.format(new Date(year, month - 1, 1));
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const selectedItems = selectedDay ? (itemsByDay.get(selectedDay) ?? []) : [];
  const selectedDateLabel = selectedDay ? DAY_LABEL.format(new Date(year, month - 1, selectedDay)) : null;

  const kpis = [
    { label: "Publicaciones", value: monthItems.length },
    { label: "La Mira", value: monthItems.filter((i) => i.site === "la-mira").length },
    { label: "Planazo", value: monthItems.filter((i) => i.site === "planazo").length },
    { label: "Días con publicaciones", value: monthDaysActive },
  ];

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-[18px] flex flex-wrap items-end gap-4">
        <div>
          <h1 className="mb-1 text-[25px] font-semibold tracking-tight">Calendario Editorial</h1>
          <p className="text-[13.5px] text-ink-soft">Registro real de lo publicado en La Mira y Planazo, por fecha.</p>
        </div>
        <div className="flex-1" />
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          {([
            { id: "all", label: "Todos" },
            { id: "la-mira", label: "La Mira" },
            { id: "planazo", label: "Planazo" },
          ] as const).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSiteFilter(f.id)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                siteFilter === f.id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-[14px] border border-border bg-border">
        {kpis.map((k) => (
          <div key={k.label} className="flex min-w-0 flex-col gap-2 bg-card px-4 pt-[15px] pb-3.5">
            <span className="text-[11.5px] text-[#8A837B]">{k.label}</span>
            <span className="text-[23px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
        {/* El calendario tiene alto acotado (siempre ~5-6 semanas) — se queda
            fijo (sticky) mientras se hace scroll de la lista de al lado, que
            sí puede crecer mucho en un día con muchas publicaciones. Mismo
            patrón que EditPreviewLayout (form + vista previa), aquí al
            revés: el panel angosto es el que scrollea, no el ancho. */}
        <div className="rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)] lg:sticky lg:top-[26px]">
          <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3.5">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="grid size-7 place-items-center rounded-lg border border-border bg-card text-ink-soft transition-colors hover:border-ink-faint"
            >
              <Icon d="M15 5l-7 7 7 7" size={13} strokeWidth={2} />
            </button>
            <span className="min-w-[150px] text-center text-[13.5px] font-semibold tracking-tight capitalize">{monthLabelCap}</span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="grid size-7 place-items-center rounded-lg border border-border bg-card text-ink-soft transition-colors hover:border-ink-faint"
            >
              <Icon d="M9 5l7 7-7 7" size={13} strokeWidth={2} />
            </button>
            <button type="button" onClick={goToday} className="ml-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint">
              Hoy
            </button>
            <div className="flex-1" />
            {loading && <span className="text-[11.5px] text-ink-faint">Cargando…</span>}
          </div>

          <div className="grid grid-cols-7 border-b border-border-soft">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="px-2 py-2 text-center font-mono text-[9.5px] font-medium tracking-[.08em] text-[#BDB6AE] uppercase">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dayItems = day ? (itemsByDay.get(day) ?? []) : [];
              const isToday = day !== null && year === today.year && month === today.month && day === today.day;
              const isSelected = day !== null && day === selectedDay;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={day === null}
                  onClick={() => day && setSelectedDay(day)}
                  className={`flex min-h-[84px] flex-col items-start gap-1 border-r border-b border-border-soft p-1.5 text-left transition-colors last:border-r-0 [&:nth-child(7n)]:border-r-0 ${
                    day === null ? "bg-[#FAF9F7]" : "bg-card hover:bg-[#FEFCFA]"
                  } ${isToday && !isSelected ? "shadow-[inset_0_0_0_1.5px_rgba(253,105,13,.35)]" : ""} ${isSelected ? "!bg-accent" : ""}`}
                >
                  {day && (
                    <>
                      <span
                        className={`grid size-5 flex-none place-items-center rounded-full font-mono text-[11px] ${
                          isToday ? "bg-brand font-semibold text-white" : "text-ink-soft"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="flex w-full flex-col gap-0.5">
                        {dayItems.slice(0, 2).map((it) => (
                          <span key={`${it.contentType}-${it.contentId}`} className="truncate text-[10.5px] leading-tight text-ink-soft">
                            {contentTypeIcon(it.contentType)} {it.title}
                          </span>
                        ))}
                        {dayItems.length > 2 && <span className="text-[10px] font-medium text-brand">+{dayItems.length - 2} más</span>}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)] lg:sticky lg:top-[26px] lg:max-h-[calc(100vh-52px)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[13.5px] font-semibold tracking-tight capitalize">{selectedDateLabel ?? "Selecciona un día"}</span>
            {selectedDay && selectedItems.length > 0 && (
              <span className="inline-flex flex-none items-center rounded-full bg-[#F3F0EC] px-2 py-0.5 text-[11px] font-semibold text-[#5C564F]">
                {selectedItems.length}
              </span>
            )}
          </div>
          {!selectedDay ? (
            <p className="text-[12.5px] text-ink-faint">Haz clic en un día del calendario para ver qué se publicó.</p>
          ) : selectedItems.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Nada se publicó este día.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {selectedItems.map((it) => (
                <div
                  key={`${it.contentType}-${it.contentId}`}
                  className="flex items-center gap-1 rounded-[9px] border border-border-soft px-2.5 py-2 transition-colors hover:border-[#FFD9BB] hover:bg-[#FFFCF9]"
                >
                  <Link href={contentEditHref(it.contentType, it.contentId)} className="flex min-w-0 flex-1 items-center gap-2">
                    <span aria-hidden="true">{contentTypeIcon(it.contentType)}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[12.5px] font-medium">{it.title}</span>
                      <span className="font-mono text-[9.5px] text-ink-faint">
                        {contentTypeLabel(it.contentType)} · {it.site === "la-mira" ? "La Mira" : "Planazo"}
                      </span>
                    </div>
                  </Link>
                  <ViewPublishedLink compact href={contentPublishedHref(it.contentType, it.slug)} available />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
