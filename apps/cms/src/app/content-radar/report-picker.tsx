"use client";

import { useRouter } from "next/navigation";

export interface ReportOption {
  value: string;
  label: string;
}

export interface ReportOptionGroup {
  groupLabel: string;
  options: ReportOption[];
}

/** Agrupado por día — antes cada archivo era un día y una lista plana bastaba;
 * ahora un mismo día puede tener varias corridas (7am, mediodía, "Actualizar"
 * a mano), así que se agrupan bajo su fecha para que siga siendo fácil
 * distinguir "hoy, 14:30" de "hoy, 09:00" sin perderse en la lista. */
export function ReportPicker({ groups, value }: { groups: ReportOptionGroup[]; value: string }) {
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
      {groups.map((group) => (
        <optgroup key={group.groupLabel} label={group.groupLabel}>
          {group.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
