"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { PlaceDetail } from "@planazo/types";
import type { UpdatePlaceInput } from "@/lib/cms-api";

const STATUS_OPTIONS: Array<{ value: PlaceDetail["status"]; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

const fieldClass =
  "rounded-xl border border-border bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-brand focus:shadow-[0_0_0_4px_rgba(253,105,13,.12)]";
const labelClass = "font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase";

export function PlaceEditForm({ place }: { place: PlaceDetail }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: place.name,
    description: place.description ?? "",
    address: place.address ?? "",
    priceLevel: place.priceLevel,
    phone: place.phone ?? "",
    website: place.website ?? "",
    status: place.status,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: UpdatePlaceInput = {
      name: form.name,
      description: form.description || null,
      address: form.address || null,
      priceLevel: form.priceLevel,
      phone: form.phone || null,
      website: form.website || null,
      status: form.status,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/places/${place.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError("No se pudo guardar. Intenta de nuevo.");
        return;
      }

      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Nombre
        </label>
        <input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelClass}>
          Descripción
        </label>
        <textarea
          id="description"
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="address" className={labelClass}>
            Dirección
          </label>
          <input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="priceLevel" className={labelClass}>
            Nivel de precio
          </label>
          <select
            id="priceLevel"
            value={form.priceLevel ?? ""}
            onChange={(e) => set("priceLevel", e.target.value ? Number(e.target.value) : null)}
            className={fieldClass}
          >
            <option value="">Sin definir</option>
            <option value="1">$</option>
            <option value="2">$$</option>
            <option value="3">$$$</option>
            <option value="4">$$$$</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className={labelClass}>
            Teléfono
          </label>
          <input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="website" className={labelClass}>
            Sitio web
          </label>
          <input id="website" value={form.website} onChange={(e) => set("website", e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className={labelClass}>
          Estado
        </label>
        <select
          id="status"
          value={form.status}
          onChange={(e) => set("status", e.target.value as PlaceDetail["status"])}
          className={`${fieldClass} max-w-[220px]`}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

      <div className="flex items-center gap-3 border-t border-border-soft pt-5">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
      </div>
    </form>
  );
}
