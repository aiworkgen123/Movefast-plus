import {repairText} from './contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
/** E20: on a dark stage, a cut-out portrait spreads in like ink from the face while a quotation types beside it. */
export type PortraitQuoteProps = Readonly<{quote: string; author: string; role?: string; portrait: StaticImage}>;
export const portraitQuoteTextLimits = {quote: {minWords: 3, maxWords: 30, maxChars: 160}, author: {minWords: 1, maxWords: 4, maxChars: 28}, role: {minWords: 1, maxWords: 6, maxChars: 44}} as const;
export const portraitQuoteDuration = {minSeconds: 3, maxSeconds: 12};
export const repairPortraitQuote = (input: unknown): PortraitQuoteProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const quote = repairText(v.quote, portraitQuoteTextLimits.quote), author = repairText(v.author, portraitQuoteTextLimits.author), portrait = repairStaticImage(v.portrait);
  if (!quote || !author || !portrait) return null;
  const role = repairText(v.role, portraitQuoteTextLimits.role);
  return {quote, author, portrait, ...(role ? {role} : {})};
};
