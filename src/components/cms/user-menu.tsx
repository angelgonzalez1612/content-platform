"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { AuthUser } from "@planazo/types";
import { Icon } from "@/components/icon";

export function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    await fetch(`${apiConfig.baseUrl}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name}
        className="grid size-8 flex-none place-items-center rounded-full bg-ink text-[11.5px] font-semibold text-white transition-shadow duration-150 hover:shadow-[0_0_0_3px_rgba(23,20,17,.1)]"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-50 w-[220px] overflow-hidden rounded-[12px] border border-border bg-white shadow-[0_16px_36px_-12px_rgba(23,20,17,.22)]"
        >
          <div className="flex items-center gap-2.5 border-b border-border-soft px-3.5 py-3">
            <div className="grid size-8 flex-none place-items-center rounded-full bg-ink text-[11.5px] font-semibold text-white">
              {initials}
            </div>
            <div className="flex min-w-0 flex-col leading-[1.25]">
              <span className="truncate text-[12.5px] font-medium">{user.name}</span>
              <span className="truncate text-[11px] text-ink-faint">{user.email}</span>
            </div>
          </div>

          <div className="flex flex-col p-1.5">
            <Link
              href="/perfil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink transition-colors hover:bg-[#F5F3F0]"
            >
              <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" size={14} strokeWidth={1.6} className="text-ink-faint" />
              Perfil
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-negative transition-colors hover:bg-[#FDECEA]"
            >
              <Icon d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 16l4-4-4-4M20 12H9" size={14} strokeWidth={1.6} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
