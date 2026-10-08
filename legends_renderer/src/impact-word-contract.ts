import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E12: one huge word types on letter by letter while the picture turns deep red and the word slowly grows. */
export type ImpactWordProps = Readonly<{word: string; media: FrameMedia; letterStarts?: readonly number[]}>;
export const impactWordTextLimits = {word: {minWords: 1, maxWords: 1, maxChars: 12}} as const;
export const impactWordDuration = {minSeconds: 2, maxSeconds: 8};
export const repairImpactWord = (input: unknown): ImpactWordProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const word = repairText(v.word, impactWordTextLimits.word), media = repairFrameMedia(v.media);
  if (!word || !media) return null;
  const s = v.letterStarts, n = Array.from(word).length;
  const ok = Array.isArray(s) && s.length === n && s.every((t, i) => typeof t === 'number' && Number.isFinite(t) && t >= 0 && (i === 0 || t >= (s[i - 1] as number)));
  return {word, media, ...(ok ? {letterStarts: s as number[]} : {})};
};
