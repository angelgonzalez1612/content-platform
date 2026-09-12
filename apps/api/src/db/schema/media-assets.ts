import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { categories } from './taxonomy';

// Imágenes guardadas desde el buscador (Wikimedia/Openverse) que TODAVÍA no
// están usadas en ninguna pieza de contenido — un acervo aparte de la
// biblioteca (ver MediaService), no ligado a noticia/lugar/etc. El archivo
// en sí vive en el hosting FTP del cliente (ver FtpStorageService); aquí
// solo se guarda la URL pública final, nunca el binario — a propósito, para
// no crecer la base de datos con peso de imágenes.
export const mediaAssets = sqliteTable('media_assets', {
  id: idColumn(),
  url: text('url').notNull(),
  credit: text('credit'),
  source: text('source', { enum: ['wikimedia', 'openverse'] }).notNull(),
  sourcePageUrl: text('source_page_url'),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  createdAt: createdAtColumn(),
});
