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

  useEffect(() => {
    if (window.localStorage.getItem("planazo-cms-sidebar-collapsed") === "1") setSidebarCollapsed(true);

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("planazo-cms-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} onOpenCommand={() => setCommandOpen(true)} />

      <main className="flex h-full min-w-0 flex-1 flex-col">
        <Topbar user={user} title={title} copilotOpen={copilotOpen} onToggleCopilot={() => setCopilotOpen((v) => !v)} />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</div>
          <div
            inert={!copilotOpen}
            className={`flex-none overflow-hidden transition-[width] duration-200 ease-out ${copilotOpen ? "w-[326px]" : "w-0"}`}
          >
            <CopilotPanel screenTitle={title} onClose={() => setCopilotOpen(false)} />
          </div>
        </div>
      </main>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
