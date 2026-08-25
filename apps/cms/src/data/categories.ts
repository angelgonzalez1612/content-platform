import { PLACE_CATEGORY_SLUGS, type PlaceCategorySlug } from "@planazo/types";

export const CATEGORY_LABELS: Record<PlaceCategorySlug, string> = {
  comer: "Comer",
  cafes: "Cafés",
  bares: "Bares",
  cultura: "Cultura",
  "aire-libre": "Aire libre",
  tecnologia: "Tecnología",
};

export const CATEGORY_OPTIONS = PLACE_CATEGORY_SLUGS.map((slug) => ({ slug, label: CATEGORY_LABELS[slug] }));
