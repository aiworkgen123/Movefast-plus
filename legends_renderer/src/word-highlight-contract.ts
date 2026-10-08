import {repairText} from './contract.ts';
export type WordHighlightProps = Readonly<{text: string; highlight: string}>;
export const wordHighlightTextLimits = {text: {minWords: 2, maxWords: 8, maxChars: 80}, highlight: {minWords: 1, maxWords: 1, maxChars: 80}} as const;
export const wordHighlightDuration = {minSeconds: 3, maxSeconds: 7};
const normalizedWord = (word: string) => word.normalize('NFKC')
  .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}\p{M}]+$/gu, '').toLocaleLowerCase('en-US');
const isWord = (word: string) => /^[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*$/u.test(word);

/** First complete token match, ignoring case and edge punctuation; never substring matching. */
export const findHighlightSpan = (text: string, highlight: string): {start: number; end: number} | null => {
  if (/\s/u.test(highlight)) return null;
  const wanted = normalizedWord(highlight);
  if (!isWord(wanted)) return null;
  for (const token of text.matchAll(/\S+/gu)) {
    if (normalizedWord(token[0]) === wanted) return {start: token.index!, end: token.index! + token[0].length};
  }
  return null;
};
export const repairWordHighlight = (input: unknown): WordHighlightProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const text = repairText(value.text, wordHighlightTextLimits.text);
  if (!text || typeof value.highlight !== 'string') return null;
  const highlight = value.highlight.trim();
  if (!highlight || highlight.length > 80 || !findHighlightSpan(text, highlight)) return null;
  return {text, highlight};
};
