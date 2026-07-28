"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@planazo/types";
import { NAV_GROUPS } from "@/data/dashboard";
import { Icon } from "@/components/icon";

const ROUTES: Record<string, string> = { dashboard: "/", crear: "/crear", ia: "/centro-ia", contenido: "/contenido" };

export function Sidebar({ user, onOpenCommand }: { user: AuthUser; onOpenCommand: () => void }) {
  const pathname = usePathname();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="flex h-full w-[246px] flex-none flex-col border-r border-border bg-card">
      <div className="flex h-[60px] flex-none items-center gap-2.5 border-b border-border-soft px-[18px]">
        <Image src="/logo.jpg" alt="Planazo" width={26} height={26} className="rounded-[7px] object-cover" style={{ mixBlendMode: "multiply" }} />
        <div className="flex flex-col leading-[1.1]">
          <span className="text-[14.5px] font-semibold tracking-tight">Planazo</span>
          <span className="font-mono text-[8.5px] font-medium tracking-[.14em] text-ink-faint uppercase">CMS · CDMX</span>
        </div>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onOpenCommand}
          className="flex w-full items-center gap-2 rounded-[9px] border border-border bg-background px-2.5 py-1.5 text-left font-sans text-[12.5px] text-ink-faint transition-colors hover:border-[#E0DBD4] hover:bg-[#F6F4F1]"
        >
          <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21" size={13} strokeWidth={2} />
          <span className="flex-1">Buscar o preguntar…</span>
          <span className="rounded border border-border bg-white px-1 py-px font-mono text-[9.5px] text-ink-faint">⌘K</span>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-3 pt-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-px">
            <div className="px-2.5 pb-1.5 font-mono text-[8.5px] font-medium tracking-[.14em] text-[#BDB6AE] uppercase">
              {group.label}
            </div>
            {group.items.map((item) => {
              const href = ROUTES[item.id];
              const active = href ? (href === "/" ? pathname === "/" : pathname.startsWith(href)) : false;
              const className = `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[6.5px] text-left text-[13px] transition-colors ${
                active ? "bg-accent font-semibold text-accent-fg" : "text-ink hover:bg-[#F5F3F0]"
              } ${!href ? "cursor-default opacity-55" : ""}`;

              const content = (
                <>
                  <Icon d={item.icon} size={15} strokeWidth={1.6} className="flex-none" />
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
                </>
              );

              return href ? (
                <Link key={item.id} href={href} className={className}>
                  {content}
                </Link>
              ) : (
                <button key={item.id} type="button" title="Próximamente" className={className} disabled>
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex-none border-t border-border-soft p-3">
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
        <div className="flex items-center gap-2.5 px-1 pt-2.5 pb-0.5">
          <div className="grid size-[26px] flex-none place-items-center rounded-lg bg-ink text-[10.5px] font-semibold text-white">
            {initials}
          </div>
          <div className="flex flex-1 flex-col leading-[1.25]">
            <span className="text-[12px] font-medium">{user.name}</span>
            <span className="text-[10px] text-ink-faint capitalize">{user.role === "admin" ? "Administrador" : "Editor"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
