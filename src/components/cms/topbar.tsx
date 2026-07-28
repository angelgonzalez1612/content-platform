"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@planazo/types";
import { getBreadcrumb } from "@/data/dashboard";
import { Icon } from "@/components/icon";
import { UserMenu } from "@/components/cms/user-menu";

export function Topbar({
  user,
  title,
  copilotOpen,
  onToggleCopilot,
}: {
  user: AuthUser;
  title: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
}) {
  const pathname = usePathname();
  const crumbs = getBreadcrumb(pathname, title);

  return (
    <header className="flex h-[60px] flex-none items-center gap-3 border-b border-border bg-white/86 px-[22px] backdrop-blur-sm">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
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
        <div className="flex items-center gap-1.5 rounded-lg border border-[#D8EFDF] bg-[#F4FBF6] px-2.5 py-[5px]">
          <span className="size-[5px] animate-[pz-pulse_2.4s_ease-in-out_infinite] rounded-full bg-positive" />
          <span className="text-[11.5px] font-medium text-[#2A7A4A]">4 automatizaciones activas</span>
        </div>
        <button
          type="button"
          title="Notificaciones"
          className="relative grid size-8 place-items-center rounded-lg border border-border bg-white text-ink-soft transition-colors hover:border-[#E0DBD4]"
        >
          <Icon d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4zM10 18.5a2 2 0 0 0 4 0" />
          <span className="absolute top-[5px] right-1.5 size-[5px] rounded-full border-[1.5px] border-white bg-brand" />
        </button>
        <button
          type="button"
          onClick={onToggleCopilot}
          className={`flex items-center gap-[7px] rounded-lg border py-1.5 pr-[11px] pl-2.5 font-sans text-[12.5px] font-medium transition-colors ${
            copilotOpen ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
          }`}
        >
          <Icon d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" size={14} strokeWidth={1.6} />
          Copiloto
        </button>
        <div className="mx-1 h-6 w-px bg-border-soft" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
