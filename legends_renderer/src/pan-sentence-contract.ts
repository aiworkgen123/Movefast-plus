import {repairText} from './contract.ts';
/** E13: a long red sentence on a grid; the camera pans along it and each word rises in at its narration time
 * (wordStarts, seconds from the shot start) or, without timings, as the camera reaches it.
 * An optional follow-up sentence plays after a cut, closer (larger) on the same grid. */
export type PanSentenceProps = Readonly<{text: string; followUp?: string; cutAt?: number; wordStarts?: readonly number[]; followUpStarts?: readonly number[]}>;
export const panSentenceTextLimits = {text: {minWords: 3, maxWords: 14, maxChars: 90}, followUp: {minWords: 3, maxWords: 12, maxChars: 60}} as const;
export const panSentenceDuration = {minSeconds: 3, maxSeconds: 14};
export const repairPanSentence = (input: unknown): PanSentenceProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const text = repairText(v.text, panSentenceTextLimits.text);
  if (!text) return null;
  const followUp = repairText(v.followUp, panSentenceTextLimits.followUp);
  const cutAt = typeof v.cutAt === 'number' && Number.isFinite(v.cutAt) && v.cutAt >= 3 ? v.cutAt : undefined;
  const starts = (raw: unknown, words: number) => Array.isArray(raw) && raw.length === words &&
    raw.every((t, i) => typeof t === 'number' && Number.isFinite(t) && t >= 0 && (i === 0 || t >= (raw[i - 1] as number))) ? raw as number[] : undefined;
  const wordStarts = starts(v.wordStarts, text.split(/\s+/u).length), followUpStarts = followUp ? starts(v.followUpStarts, followUp.split(/\s+/u).length) : undefined;
  return {text, ...(followUp ? {followUp} : {}), ...(followUp && cutAt ? {cutAt} : {}), ...(wordStarts ? {wordStarts} : {}), ...(followUpStarts ? {followUpStarts} : {})};
};
