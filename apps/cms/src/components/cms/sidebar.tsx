"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/data/dashboard";
import { Icon } from "@/components/icon";
import { useIsMobile } from "@/lib/use-is-mobile";

const ROUTES: Record<string, string> = {
  dashboard: "/",
  crear: "/crear",
  ia: "/centro-ia",
  plantillas: "/plantillas",
  contenido: "/contenido",
  "content-radar": "/content-radar",
  calendario: "/calendario",
  automatizaciones: "/automatizaciones",
  multimedia: "/multimedia",
  config: "/configuracion",
};

interface TooltipState {
  label: string;
  top: number;
  left: number;
}

const collapseText = (collapsed: boolean) =>
  `overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${collapsed ? "opacity-0" : "opacity-100"}`;

export function Sidebar({
  collapsed: collapsedPref,
  onToggleCollapsed,
  onOpenCommand,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenCommand: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  // En celular el sidebar es un drawer que siempre se ve expandido — el
  // "colapsado" es una preferencia de escritorio (icon-only) que no aplica
  // ahí, donde el drawer ya se abre y cierra por completo.
  const collapsed = isMobile ? false : collapsedPref;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function handleEnter(label: string) {
    return (e: React.MouseEvent<HTMLElement>) => {
      if (!collapsed) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
    };
  }

  function handleLeave() {
    setTooltip(null);
  }

  function handleNavClick() {
    if (isMobile) onCloseMobile();
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[260px] flex-none flex-col border-r border-border bg-card transition-transform duration-200 ease-out md:relative md:translate-x-0 md:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[64px]" : "md:w-[246px]"}`}
      >
      <div className={`flex h-[60px] flex-none items-center gap-2.5 border-b border-border-soft ${collapsed ? "justify-center px-0" : "px-[18px]"}`}>
        <span className="grid size-[26px] flex-none place-items-center rounded-[7px] bg-brand text-[12px] font-semibold text-white">C</span>
        <div className={`flex flex-col leading-[1.1] ${collapseText(collapsed)}`} style={{ maxWidth: collapsed ? 0 : 140 }}>
          <span className="text-[14.5px] font-semibold tracking-tight">Content CMS</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCloseMobile}
          className="mr-2 grid size-7 flex-none place-items-center rounded-md text-ink-soft hover:bg-[#F5F3F0] md:hidden"
        >
          <Icon d="M6 6l12 12M18 6L6 18" size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className={`pt-3 ${collapsed ? "px-2" : "px-3"}`}>
        <button
          type="button"
          onClick={onOpenCommand}
          onMouseEnter={handleEnter("Buscar o preguntar (⌘K)")}
          onMouseLeave={handleLeave}
          className={`flex w-full items-center gap-2 rounded-[9px] border border-border bg-background text-left font-sans text-[12.5px] text-ink-faint transition-colors hover:border-[#E0DBD4] hover:bg-[#F6F4F1] ${
            collapsed ? "justify-center px-0 py-1.5" : "px-2.5 py-1.5"
          }`}
        >
          <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21" size={13} strokeWidth={2} className="flex-none" />
          <span className={`flex flex-1 items-center gap-2 ${collapseText(collapsed)}`} style={{ maxWidth: collapsed ? 0 : 220 }}>
            <span className="flex-1">Buscar o preguntar…</span>
            <span className="rounded border border-border bg-white px-1 py-px font-mono text-[9.5px] text-ink-faint">⌘K</span>
          </span>
        </button>
      </div>

      <nav className={`flex flex-1 flex-col gap-3.5 overflow-y-auto pt-3 pb-4 ${collapsed ? "px-2" : "px-3"}`}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-px">
            <div
              className={`overflow-hidden px-2.5 font-mono text-[8.5px] font-medium tracking-[.14em] text-[#BDB6AE] uppercase transition-[max-height,opacity] duration-200 ease-out ${
                collapsed ? "max-h-0 opacity-0" : "max-h-4 pb-1.5 opacity-100"
              }`}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const href = ROUTES[item.id];
              const active = href ? (href === "/" ? pathname === "/" : pathname.startsWith(href)) : false;
              const className = `flex w-full items-center gap-2.5 rounded-lg py-[6.5px] text-left text-[13px] transition-colors ${
                collapsed ? "justify-center px-0" : "px-2.5"
              } ${active ? "bg-accent font-semibold text-accent-fg" : "text-ink hover:bg-[#F5F3F0]"} ${!href ? "cursor-default opacity-55" : ""}`;

              const content = (
                <>
                  <Icon d={item.icon} size={15} strokeWidth={1.6} className="flex-none" />
                  <span className={`flex flex-1 items-center gap-1.5 ${collapseText(collapsed)}`} style={{ maxWidth: collapsed ? 0 : 180 }}>
                    <span className="flex-1 tracking-tight">{item.name}</span>
                    {item.badge && (
                      <span
                        className="rounded font-mono text-[9.5px] font-medium"
                        style={{
                          padding: "1px 5px",
                          background: item.badge === "IA" ? "#FD690D" : "#F3F0EC",
                          color: item.badge === "IA" ? "#fff" : "#8A837B",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </>
              );

              return href ? (
                <Link key={item.id} href={href} onClick={handleNavClick} onMouseEnter={handleEnter(item.name)} onMouseLeave={handleLeave} className={className}>
                  {content}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={handleEnter(`${item.name} · próximamente`)}
                  onMouseLeave={handleLeave}
                  className={className}
                  disabled
                >
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {!isMobile && (
        <div className="flex-none border-t border-border-soft p-2.5">
          <button
            type="button"
            onClick={onToggleCollapsed}
            onMouseEnter={handleEnter(collapsed ? "Expandir menú" : "Colapsar menú")}
            onMouseLeave={handleLeave}
            className={`flex w-full items-center gap-2 rounded-lg py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-[#F5F3F0] ${
              collapsed ? "justify-center px-0" : "px-2.5"
            }`}
          >
            <Icon d={collapsed ? "M9 5l7 7-7 7M4 5v14" : "M15 5l-7 7 7 7M20 5v14"} size={14} strokeWidth={1.8} className="flex-none" />
            <span className={collapseText(collapsed)} style={{ maxWidth: collapsed ? 0 : 130 }}>
              Colapsar menú
            </span>
          </button>
        </div>
      )}

      {tooltip && (
        <div
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 animate-[pz-in_.12s_ease-out] rounded-md bg-ink px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap text-white shadow-[0_6px_16px_-4px_rgba(23,20,17,.32)]"
        >
          {tooltip.label}
        </div>
      )}
      </aside>
    </>
  );
}
