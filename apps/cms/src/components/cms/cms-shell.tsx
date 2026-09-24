"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@planazo/types";
import { Sidebar } from "@/components/cms/sidebar";
import { Topbar } from "@/components/cms/topbar";
import { CopilotPanel } from "@/components/cms/copilot-panel";
import { CommandPalette } from "@/components/cms/command-palette";

export function CmsShell({
  user,
  title,
  children,
}: {
  user: AuthUser;
  title: string;
  children: ReactNode;
}) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Arranca en "light" y el layout raíz corrige a "dark" con un script
  // inline antes de hidratar (ver app/layout.tsx) — evita el flash, pero
  // significa que este estado debe releerse del DOM, no de localStorage
  // directo, para no perder ese ajuste temprano.
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (window.localStorage.getItem("planazo-cms-sidebar-collapsed") === "1") setSidebarCollapsed(true);
      if (document.documentElement.dataset.theme === "dark") setTheme("dark");
    }, 0);

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("planazo-cms-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  function toggleTheme() {
    setTheme((v) => {
      const next = v === "dark" ? "light" : "dark";
      window.localStorage.setItem("planazo-cms-theme", next);
      if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      return next;
    });
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onOpenCommand={() => setCommandOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <main className="flex h-full min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          title={title}
          copilotOpen={copilotOpen}
          onToggleCopilot={() => setCopilotOpen((v) => !v)}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</div>
          {copilotOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 sm:hidden"
              onClick={() => setCopilotOpen(false)}
              aria-hidden="true"
            />
          )}
          <div
            inert={!copilotOpen}
            className={`fixed inset-y-0 right-0 z-50 overflow-hidden transition-[width] duration-200 ease-out sm:relative sm:z-auto ${
              copilotOpen ? "w-full sm:w-[326px]" : "w-0"
            }`}
          >
            <CopilotPanel screenTitle={title} onClose={() => setCopilotOpen(false)} />
          </div>
        </div>
      </main>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
