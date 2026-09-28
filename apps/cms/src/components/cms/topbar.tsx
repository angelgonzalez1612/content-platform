"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@planazo/types";
import { apiConfig } from "@planazo/config";
import { getBreadcrumb } from "@/data/dashboard";
import { Icon } from "@/components/icon";
import { UserMenu } from "@/components/cms/user-menu";
import { NotificationsBell } from "@/components/cms/notifications-bell";
import type { CmsNotification, ProviderHealth } from "@/lib/automation-types";
import { describeProviderHealth, unhealthyProviders } from "@/lib/provider-health";

// Solo lee estado (no gasta IA) — cada minuto para que el aviso de "sin
// tokens" aparezca sin recargar la página.
const STATUS_POLL_MS = 60_000;

export function Topbar({
  user,
  title,
  copilotOpen,
  onToggleCopilot,
  onOpenMobileMenu,
  theme,
  onToggleTheme,
}: {
  user: AuthUser;
  title: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  onOpenMobileMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();
  const crumbs = getBreadcrumb(pathname, title);

  const [automation, setAutomation] = useState<{ activeRulesCount: number; isRunning: boolean; providerHealth: ProviderHealth[] } | null>(
    null,
  );

  const [notifications, setNotifications] = useState<CmsNotification[]>([]);
  const [apiDownSince, setApiDownSince] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [statusRes, notificationsRes] = await Promise.all([
          fetch(`${apiConfig.clientBaseUrl}/cms/automation/status`, { credentials: "include" }),
          fetch(`${apiConfig.clientBaseUrl}/cms/notifications`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        setApiDownSince(null);
        if (statusRes.ok) {
          const data = (await statusRes.json()) as { activeRulesCount?: number; isRunning?: boolean; providerHealth?: ProviderHealth[] };
          setAutomation({
            activeRulesCount: data.activeRulesCount ?? 0,
            isRunning: !!data.isRunning,
            providerHealth: data.providerHealth ?? [],
          });
        }
        if (notificationsRes.ok) setNotifications((await notificationsRes.json()) as CmsNotification[]);
      } catch {
        // fetch solo truena si no hay respuesta en absoluto: la API está caída.
        if (!cancelled) setApiDownSince((prev) => prev ?? new Date().toISOString());
      }
    };
    void load();
    const timer = setInterval(() => void load(), STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const providerProblem = unhealthyProviders(automation?.providerHealth)[0];
  const allNotifications: CmsNotification[] = apiDownSince
    ? [
        {
          id: `api-down:${apiDownSince}`,
          severity: "critical",
          title: "Sin conexión con la API",
          detail: "El CMS no puede comunicarse con el servidor: no se generan borradores ni corren automatizaciones. Revisa que la API esté encendida.",
          at: apiDownSince,
          href: "/automatizaciones",
        },
        ...notifications,
      ]
    : notifications;

  return (
    <header className="flex h-[60px] flex-none items-center gap-2 border-b border-border bg-card/86 px-3 backdrop-blur-sm sm:gap-3 sm:px-[22px]">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="grid size-8 flex-none place-items-center rounded-lg border border-border bg-card text-ink-soft md:hidden"
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
        {providerProblem && (
          <Link
            href="/configuracion"
            title={describeProviderHealth(providerProblem).long}
            className="flex items-center gap-1.5 rounded-lg border border-negative/30 bg-negative/10 px-2.5 py-[5px] transition-colors hover:border-negative"
          >
            <span className="size-[5px] rounded-full bg-negative" />
            <span className="text-[11.5px] font-semibold text-negative">{describeProviderHealth(providerProblem).short}</span>
          </Link>
        )}
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
        <NotificationsBell notifications={allNotifications} />
        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          className="grid size-8 flex-none place-items-center rounded-lg border border-border bg-card text-ink-soft transition-colors hover:border-[#E0DBD4]"
        >
          {theme === "dark" ? (
            <Icon d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={15} strokeWidth={1.7} />
          ) : (
            <Icon d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" size={15} strokeWidth={1.7} />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleCopilot}
          title="Copiloto"
          className={`flex items-center gap-[7px] rounded-lg border py-1.5 pr-2.5 pl-2.5 font-sans text-[12.5px] font-medium transition-colors sm:pr-[11px] ${
            copilotOpen ? "border-ink-solid bg-ink-solid text-white" : "border-border bg-card text-ink"
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
