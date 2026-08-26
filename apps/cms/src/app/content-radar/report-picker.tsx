"use client";

import { useRouter } from "next/navigation";

export function ReportPicker({ options, value }: { options: { value: string; label: string }[]; value: string }) {
  const router = useRouter();

  return (
    <select
      className="cr-report-select"
      aria-label="Reporte"
      value={value}
      onChange={(e) => {
        if (e.target.value) router.push(e.target.value);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
