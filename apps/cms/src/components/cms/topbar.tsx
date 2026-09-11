"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@planazo/types";
import { apiConfig } from "@planazo/config";
import { getBreadcrumb } from "@/data/dashboard";
import { Icon } from "@/components/icon";
import { UserMenu } from "@/components/cms/user-menu";

export function Topbar({
  user,
  title,
  copilotOpen,
  onToggleCopilot,
  onOpenMobileMenu,
}: {
  user: AuthUser;
  title: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  onOpenMobileMenu: () => void;
}) {
  const pathname = usePathname();
  const crumbs = getBreadcrumb(pathname, title);

  const [automation, setAutomation] = useState<{ activeRulesCount: number; isRunning: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.clientBaseUrl}/cms/automation/status`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { activeRulesCount?: number; isRunning?: boolean } | null) => {
        if (!cancelled && data) setAutomation({ activeRulesCount: data.activeRulesCount ?? 0, isRunning: !!data.isRunning });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="flex h-[60px] flex-none items-center gap-2 border-b border-border bg-white/86 px-3 backdrop-blur-sm sm:gap-3 sm:px-[22px]">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="grid size-8 flex-none place-items-center rounded-lg border border-border bg-white text-ink-soft md:hidden"
      >
        <Icon d="M4 7h16M4 12h16M4 17h16" size={15} strokeWidth={1.8} />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className={`flex min-w-0 items-center gap-1.5 ${i > 0 ? "hidden sm:flex" : ""}`}>
            {i > 0 && <Icon d="M9 6l6 6-6 6" size={10} strokeWidth={2.4} className="flex-none text-[#D8D2CA]" />}
            {crumb.href ? (
              <Link href={crumb.href} className="truncate text-[12.5px] text-ink-faint transition-colors duration-150 hover:text-brand">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate text-[14px] font-semibold tracking-tight text-ink">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        {automation && (
          <Link
            href="/automatizaciones"
            className="hidden items-center gap-1.5 rounded-lg border border-[#D8EFDF] bg-[#F4FBF6] px-2.5 py-[5px] transition-colors hover:border-positive md:flex"
          >
            <span className="size-[5px] animate-[pz-pulse_2.4s_ease-in-out_infinite] rounded-full bg-positive" />
            <span className="text-[11.5px] font-medium text-[#2A7A4A]">
              {automation.isRunning ? "Ejecutando ahora…" : `${automation.activeRulesCount} automatizacion${automation.activeRulesCount === 1 ? "" : "es"} activa${automation.activeRulesCount === 1 ? "" : "s"}`}
            </span>
          </Link>
        )}
        <button
          type="button"
          title="Notificaciones"
          className="relative hidden size-8 place-items-center rounded-lg border border-border bg-white text-ink-soft transition-colors hover:border-[#E0DBD4] sm:grid"
        >
          <Icon d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4zM10 18.5a2 2 0 0 0 4 0" />
          <span className="absolute top-[5px] right-1.5 size-[5px] rounded-full border-[1.5px] border-white bg-brand" />
        </button>
        <button
          type="button"
          onClick={onToggleCopilot}
          title="Copiloto"
          className={`flex items-center gap-[7px] rounded-lg border py-1.5 pr-2.5 pl-2.5 font-sans text-[12.5px] font-medium transition-colors sm:pr-[11px] ${
            copilotOpen ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
          }`}
        >
          <Icon d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" size={14} strokeWidth={1.6} />
          <span className="hidden sm:inline">Copiloto</span>
        </button>
        <div className="mx-1 hidden h-6 w-px bg-border-soft sm:block" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
