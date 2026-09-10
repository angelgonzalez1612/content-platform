import type { Place, PlanazoEvent } from "@planazo/types";
import type { PlaceOption } from "@/components/cms/planazo/guide-sections-field";

/** Options for GuideSectionsField's place/event picker — places and events combined, labeled so an editor can tell them apart at a glance. */
export function buildPlaceOptions(places: Place[], events: PlanazoEvent[]): PlaceOption[] {
  return [
    ...places.map((p) => ({ slug: p.slug, label: `📍 ${p.name}` })),
    ...events.map((e) => ({ slug: e.slug, label: `📅 ${e.name}` })),
  ].sort((a, b) => a.label.localeCompare(b.label));
}
