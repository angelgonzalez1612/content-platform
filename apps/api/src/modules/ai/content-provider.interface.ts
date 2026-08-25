import { PLACE_CATEGORY_SLUGS, type PlaceDraftInput, type PlaceDraftOutput } from '@planazo/types';

export { PLACE_CATEGORY_SLUGS as CATEGORY_SLUGS };
export type { PlaceDraftInput, PlaceDraftOutput };

/**
 * Every LLM provider (OpenAI, Claude, Gemini, ...) implements this. Nothing
 * outside src/modules/ai should import a provider directly — only this
 * interface, via ContentProvider's injection token.
 */
export interface ContentProvider {
  generatePlaceDraft(input: PlaceDraftInput): Promise<PlaceDraftOutput>;
}

export const CONTENT_PROVIDER = Symbol('CONTENT_PROVIDER');
