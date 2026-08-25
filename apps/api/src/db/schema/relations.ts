import { relations } from 'drizzle-orm';
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

export const categoriesRelations = relations(categories, ({ many }) => ({
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
