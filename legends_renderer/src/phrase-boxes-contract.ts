import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E21: short phrases appear one after another in violet boxes (script lettering) at the top left, each followed by a dot. */
export type PhraseBoxesProps = Readonly<{phrases: readonly string[]; media: FrameMedia; phraseStarts?: readonly number[]}>;
export const phraseBoxesTextLimits = {phrases: {minWords: 1, maxWords: 4, maxChars: 22}} as const;
export const phraseBoxesDuration = {minSeconds: 2, maxSeconds: 10};
export const repairPhraseBoxes = (input: unknown): PhraseBoxesProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const media = repairFrameMedia(v.media);
  if (!media || !Array.isArray(v.phrases) || v.phrases.length < 1 || v.phrases.length > 4) return null;
  const phrases = v.phrases.map((p) => repairText(p, phraseBoxesTextLimits.phrases));
  if (phrases.some((p) => !p)) return null;
  const s = v.phraseStarts;
  const ok = Array.isArray(s) && s.length === phrases.length && s.every((t, i) => typeof t === 'number' && Number.isFinite(t) && (i === 0 || t >= (s[i - 1] as number)));
  return {phrases: phrases as string[], media, ...(ok ? {phraseStarts: s as number[]} : {})};
};
