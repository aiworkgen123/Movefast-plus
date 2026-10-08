import {repairText} from './contract.ts';
export type QuoteProps = Readonly<{quote: string; attribution: string; context?: string}>;
export const quoteTextLimits = {quote: {minWords: 2, maxWords: 8, maxChars: 100}, attribution: {minWords: 1, maxWords: 6, maxChars: 64}, context: {minWords: 1, maxWords: 8, maxChars: 64}} as const;
export const quoteDuration = {minSeconds: 3, maxSeconds: 9};
/** Tokens retain the exact whitespace following each supplied word. */
export const quoteTokens = (text: string): string[] => text.match(/\S+\s*/gu) ?? [];
export const repairQuote = (input: unknown): QuoteProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const quote = repairText(value.quote, quoteTextLimits.quote);
  const attribution = repairText(value.attribution, quoteTextLimits.attribution);
  if (!quote || !attribution) return null;
  const context = repairText(value.context, quoteTextLimits.context);
  return {quote, attribution, ...(context ? {context} : {})};
};
