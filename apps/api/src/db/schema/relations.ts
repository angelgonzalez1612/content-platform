import { relations } from 'drizzle-orm';
import { sites } from './sites';
import { categories, tags, services } from './taxonomy';
import {
  places,
  placeCategories,
  placeTags,
  placeServices,
  photos,
  socialLinks,
  openingHours,
} from './places';
import { articles, articlePlaces } from './articles';
import { events, promotions } from './events';
import { rankings, rankingPlaces } from './rankings';
import { noticias, alertas, guias, lamiraEventos, lamiraLugares, reportajes } from './lamira';

export const sitesRelations = relations(sites, ({ many }) => ({
  categories: many(categories),
  noticias: many(noticias),
  alertas: many(alertas),
  guias: many(guias),
  lamiraEventos: many(lamiraEventos),
  lamiraLugares: many(lamiraLugares),
  reportajes: many(reportajes),
}));

export const noticiasRelations = relations(noticias, ({ one }) => ({
  site: one(sites, { fields: [noticias.siteId], references: [sites.id] }),
  category: one(categories, { fields: [noticias.categoryId], references: [categories.id] }),
}));

export const alertasRelations = relations(alertas, ({ one }) => ({
  site: one(sites, { fields: [alertas.siteId], references: [sites.id] }),
  category: one(categories, { fields: [alertas.categoryId], references: [categories.id] }),
}));

export const guiasRelations = relations(guias, ({ one }) => ({
  site: one(sites, { fields: [guias.siteId], references: [sites.id] }),
  category: one(categories, { fields: [guias.categoryId], references: [categories.id] }),
}));

export const lamiraEventosRelations = relations(lamiraEventos, ({ one }) => ({
  site: one(sites, { fields: [lamiraEventos.siteId], references: [sites.id] }),
  category: one(categories, { fields: [lamiraEventos.categoryId], references: [categories.id] }),
}));

export const lamiraLugaresRelations = relations(lamiraLugares, ({ one }) => ({
  site: one(sites, { fields: [lamiraLugares.siteId], references: [sites.id] }),
  category: one(categories, { fields: [lamiraLugares.categoryId], references: [categories.id] }),
}));

export const reportajesRelations = relations(reportajes, ({ one }) => ({
  site: one(sites, { fields: [reportajes.siteId], references: [sites.id] }),
  category: one(categories, { fields: [reportajes.categoryId], references: [categories.id] }),
}));

export const placesRelations = relations(places, ({ many }) => ({
  placeCategories: many(placeCategories),
  placeTags: many(placeTags),
  placeServices: many(placeServices),
  photos: many(photos),
  socialLinks: many(socialLinks),
  openingHours: many(openingHours),
  articlePlaces: many(articlePlaces),
  promotions: many(promotions),
  events: many(events),
  rankingPlaces: many(rankingPlaces),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  site: one(sites, { fields: [categories.siteId], references: [sites.id] }),
  placeCategories: many(placeCategories),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  placeTags: many(placeTags),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  placeServices: many(placeServices),
}));

export const placeCategoriesRelations = relations(
  placeCategories,
  ({ one }) => ({
    place: one(places, {
      fields: [placeCategories.placeId],
      references: [places.id],
    }),
    category: one(categories, {
      fields: [placeCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const placeTagsRelations = relations(placeTags, ({ one }) => ({
  place: one(places, { fields: [placeTags.placeId], references: [places.id] }),
  tag: one(tags, { fields: [placeTags.tagId], references: [tags.id] }),
}));

export const placeServicesRelations = relations(placeServices, ({ one }) => ({
  place: one(places, {
    fields: [placeServices.placeId],
    references: [places.id],
  }),
  service: one(services, {
    fields: [placeServices.serviceId],
    references: [services.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  place: one(places, { fields: [photos.placeId], references: [places.id] }),
}));

export const socialLinksRelations = relations(socialLinks, ({ one }) => ({
  place: one(places, {
    fields: [socialLinks.placeId],
    references: [places.id],
  }),
}));

export const openingHoursRelations = relations(openingHours, ({ one }) => ({
  place: one(places, {
    fields: [openingHours.placeId],
    references: [places.id],
  }),
}));

export const articlesRelations = relations(articles, ({ many }) => ({
  articlePlaces: many(articlePlaces),
}));

export const articlePlacesRelations = relations(articlePlaces, ({ one }) => ({
  article: one(articles, {
    fields: [articlePlaces.articleId],
    references: [articles.id],
  }),
  place: one(places, {
    fields: [articlePlaces.placeId],
    references: [places.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  place: one(places, { fields: [events.placeId], references: [places.id] }),
}));

export const promotionsRelations = relations(promotions, ({ one }) => ({
  place: one(places, { fields: [promotions.placeId], references: [places.id] }),
}));

export const rankingsRelations = relations(rankings, ({ many }) => ({
  rankingPlaces: many(rankingPlaces),
}));

export const rankingPlacesRelations = relations(rankingPlaces, ({ one }) => ({
  ranking: one(rankings, {
    fields: [rankingPlaces.rankingId],
    references: [rankings.id],
  }),
  place: one(places, {
    fields: [rankingPlaces.placeId],
    references: [places.id],
  }),
}));
