"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex w-fit items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11.5px] text-ink-soft transition-colors hover:border-[#E0DBD4] hover:text-ink"
    >
      <span className="max-w-[150px] truncate">{id}</span>
      <Icon
        d={copied ? "M5 13l4 4L19 7" : "M8 8h10v10H8zM5 5h10v3H8v7H5z"}
        size={12}
        strokeWidth={2}
        className={`flex-none ${copied ? "text-positive" : "text-ink-faint group-hover:text-ink-soft"}`}
      />
    </button>
  );
}
