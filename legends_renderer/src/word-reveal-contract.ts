import {repairText} from './contract.ts';
/** E14: a narration sentence appears word by word on the bowed grid. */
export type WordRevealProps = Readonly<{text: string; stress?: readonly string[]; wordStarts?: readonly number[]}>;
export const wordRevealTextLimits = {text: {minWords: 3, maxWords: 16, maxChars: 110}} as const;
export const wordRevealDuration = {minSeconds: 2, maxSeconds: 10};
const bare = (word: string) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
export const repairWordReveal = (input: unknown): WordRevealProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const text = repairText(v.text, wordRevealTextLimits.text);
  if (!text) return null;
  const words = text.split(/\s+/u).map(bare);
  // At most two whole words from the text may be shown in capitals; anything else is dropped.
  const stress = Array.isArray(v.stress) ? v.stress.filter((w): w is string => typeof w === 'string' && words.includes(bare(w))).slice(0, 2).map(bare) : [];
  // Narration-aligned start times (seconds) are kept only when there is one per word and they never go backwards.
  const starts = v.wordStarts;
  const wordStarts = Array.isArray(starts) && starts.length === words.length &&
    starts.every((t, i) => typeof t === 'number' && Number.isFinite(t) && t >= 0 && (i === 0 || t >= (starts[i - 1] as number)))
    ? starts as number[] : undefined;
  return {text, ...(stress.length ? {stress} : {}), ...(wordStarts ? {wordStarts} : {})};
};
