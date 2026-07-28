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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar user={user} onOpenCommand={() => setCommandOpen(true)} />

      <main className="flex h-full min-w-0 flex-1 flex-col">
        <Topbar title={title} copilotOpen={copilotOpen} onToggleCopilot={() => setCopilotOpen((v) => !v)} />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</div>
          {copilotOpen && <CopilotPanel screenTitle={title} onClose={() => setCopilotOpen(false)} />}
        </div>
      </main>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
