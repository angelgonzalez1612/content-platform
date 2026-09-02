"use client";

import { useState } from "react";

export interface AccordionGroupData {
  label: string;
  html: string;
}

// Antes se apilaban los 4 grupos (Compartidas/La Mira/Planazo/Otras) uno
// debajo del otro — para llegar al que te interesa había que scrollear
// pasando los demás. Un <select> muestra solo el grupo elegido.
export function GroupSelect({ groups }: { groups: AccordionGroupData[] }) {
  const [selectedLabel, setSelectedLabel] = useState(groups[0]?.label ?? "");
  const active = groups.find((g) => g.label === selectedLabel) ?? groups[0];

  if (!active) return null;

  return (
    <div className="cr-group">
      <div className="cr-group-select-row">
        <label htmlFor="cr-group-select" className="cr-group-select-label">
          Grupo
        </label>
        <select id="cr-group-select" className="cr-report-select" value={active.label} onChange={(e) => setSelectedLabel(e.target.value)}>
          {groups.map((g) => (
            <option key={g.label} value={g.label}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div className="cr-accordion" dangerouslySetInnerHTML={{ __html: active.html }} />
    </div>
  );
}
