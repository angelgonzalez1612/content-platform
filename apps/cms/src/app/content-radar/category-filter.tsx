"use client";

import { useEffect } from "react";

// Convierte los chips de categoría (renderizados server-side dentro del HTML
// crudo del reporte) en filtros reales: clic para mostrar solo esa(s)
// categoría(s), clic de nuevo para quitarla, "Todos" resetea. Sin JS los
// chips igual funcionan como ancla (href="#slug") — esto es progressive
// enhancement, igual que en el viewer standalone que reemplaza.
export function CategoryFilter() {
  useEffect(() => {
    const nav = document.querySelector(".category-nav");
    const status = document.querySelector(".filter-status");
    if (!nav || !status) return;

    const chips = Array.from(nav.querySelectorAll<HTMLElement>(".chip"));
    const allChip = nav.querySelector<HTMLElement>(".chip-all");
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".card[data-slug]"));
    if (!allChip) return;
    const active = new Set<string>();

    function render() {
      if (active.size === 0) {
        allChip!.classList.add("active");
        chips.forEach((c) => c.classList.remove("active"));
        cards.forEach((card) => (card.hidden = false));
        (status as HTMLElement).hidden = true;
      } else {
        allChip!.classList.remove("active");
        chips.forEach((c) => c.classList.toggle("active", active.has(c.dataset.slug ?? "")));
        cards.forEach((card) => (card.hidden = !active.has(card.dataset.slug ?? "")));
        (status as HTMLElement).hidden = false;
        status!.textContent = `Mostrando ${active.size} de ${cards.length} secciones — `;
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "filter-reset";
        reset.textContent = "ver todas";
        reset.addEventListener("click", () => {
          active.clear();
          render();
        });
        status!.appendChild(reset);
      }
    }

    function scrollToCard(slug: string) {
      const card = document.querySelector<HTMLElement>(`.card[data-slug="${slug}"]`);
      const bar = document.querySelector<HTMLElement>(".filters-bar");
      if (!card || !bar) return;
      const barHeight = bar.getBoundingClientRect().height;
      const top = card.getBoundingClientRect().top + window.scrollY - barHeight - 16;
      window.scrollTo({ top, behavior: "smooth" });
    }

    function onAllClick() {
      active.clear();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    allChip.addEventListener("click", onAllClick);

    const chipHandlers = chips.map((chip) => {
      function onClick(e: Event) {
        e.preventDefault();
        const slug = chip.dataset.slug ?? "";
        const wasActive = active.has(slug);
        if (wasActive) active.delete(slug);
        else active.add(slug);
        render();
        // Al activar un filtro, saltamos directo a esa tarjeta — no solo se
        // filtra, también te lleva a donde está.
        if (!wasActive) scrollToCard(slug);
      }
      chip.addEventListener("click", onClick);
      return { chip, onClick };
    });

    return () => {
      allChip.removeEventListener("click", onAllClick);
      chipHandlers.forEach(({ chip, onClick }) => chip.removeEventListener("click", onClick));
    };
  }, []);

  return null;
}
