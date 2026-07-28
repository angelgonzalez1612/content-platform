"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/data/dashboard";
import { Icon } from "@/components/icon";

const ROUTES: Record<string, string> = { dashboard: "/", crear: "/crear", ia: "/centro-ia", contenido: "/contenido" };

interface TooltipState {
  label: string;
  top: number;
  left: number;
}

const collapseText = (collapsed: boolean) =>
  `overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${collapsed ? "opacity-0" : "opacity-100"}`;

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onOpenCommand,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenCommand: () => void;
}) {
  const pathname = usePathname();
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

  return (
    <aside
      className={`flex h-full flex-none flex-col border-r border-border bg-card transition-[width] duration-200 ease-out ${
        collapsed ? "w-[64px]" : "w-[246px]"
      }`}
    >
      <div className={`flex h-[60px] flex-none items-center gap-2.5 border-b border-border-soft ${collapsed ? "justify-center px-0" : "px-[18px]"}`}>
        <Image src="/logo.jpg" alt="Planazo" width={26} height={26} className="flex-none rounded-[7px] object-cover" style={{ mixBlendMode: "multiply" }} />
        <div className={`flex flex-col leading-[1.1] ${collapseText(collapsed)}`} style={{ maxWidth: collapsed ? 0 : 140 }}>
          <span className="text-[14.5px] font-semibold tracking-tight">Planazo</span>
          <span className="font-mono text-[8.5px] font-medium tracking-[.14em] text-ink-faint uppercase">CMS · CDMX</span>
        </div>
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
                <Link key={item.id} href={href} onMouseEnter={handleEnter(item.name)} onMouseLeave={handleLeave} className={className}>
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

      <div
        className={`flex-none overflow-hidden border-t border-border-soft transition-[max-height,opacity] duration-200 ease-out ${
          collapsed ? "max-h-0 border-t-0 opacity-0" : "max-h-[110px] p-3 opacity-100"
        }`}
      >
        <div className="flex flex-col gap-[7px] rounded-[11px] border border-[#FFE2CC] bg-[#FFF7F1] px-3 py-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold tracking-tight">Créditos IA</span>
            <span className="font-mono text-[10.5px] text-accent-fg">68%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#FFE2CC]">
            <div className="h-full rounded-full bg-brand" style={{ width: "68%" }} />
          </div>
          <span className="text-[10.5px] leading-[1.35] text-ink-faint">13,600 de 20,000 tokens · renueva el 1 de agosto</span>
        </div>
      </div>

      <div className={`flex-none border-t border-border-soft ${collapsed ? "p-2" : "p-2.5"}`}>
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
  );
}
