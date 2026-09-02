"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";
import { ALCALDIAS, MUNICIPIOS, type LocationOption } from "@/lib/locations";
import { fieldClass } from "@/components/cms/dynamic-field";

// Reemplaza el campo de texto libre que había antes ("Alcaldía (slug)",
// tecleado a mano) — un slug mal escrito o inventado no coincidía con nada
// real en La Mira ni en Planazo. Trae la lista real de /api/locations (misma
// tabla que leen los dos sitios públicos, ver db/schema/locations.ts) — si
// esa llamada falla, cae a la copia estática de src/lib/locations.ts para
// no dejar el formulario sin opciones.
export function AlcaldiaSelect({
  value,
  onChange,
  id = "alcaldia-select",
  required,
  invalid,
}: {
  value: string;
  onChange: (slug: string) => void;
  id?: string;
  required?: boolean;
  // El botón "Crear" de GenerateLamiraContentFlow no vive dentro de un
  // <form> (dispara handleCreate por onClick, no por submit) — el atributo
  // `required` del <select> nunca se valida solo, así que el llamador debe
  // marcar `invalid` a mano tras su propio chequeo antes del POST.
  invalid?: boolean;
}) {
  const [alcaldias, setAlcaldias] = useState<LocationOption[]>(ALCALDIAS);
  const [municipios, setMunicipios] = useState<LocationOption[]>(MUNICIPIOS);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.baseUrl}/locations`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { slug: string; name: string; kind: "alcaldia" | "municipio" }[]) => {
        if (cancelled) return;
        setAlcaldias(data.filter((l) => l.kind === "alcaldia"));
        setMunicipios(data.filter((l) => l.kind === "municipio"));
      })
      .catch(() => {
        // Ya arrancó con la copia estática — no hace falta hacer nada más.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={invalid ? `${fieldClass} border-[#C4453A] focus:border-[#C4453A] focus:shadow-[0_0_0_4px_rgba(196,69,58,.12)]` : fieldClass}
    >
      <option value="">Sin definir</option>
      <optgroup label="Alcaldías (CDMX)">
        {alcaldias.map((a) => (
          <option key={a.slug} value={a.slug}>
            {a.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Zona Metropolitana (Edomex)">
        {municipios.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
