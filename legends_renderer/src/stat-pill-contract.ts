import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E54: a small dark pill at the lower left with a value, a glowing dot and a label, opening outward from its middle. */
export type StatPillProps = Readonly<{value: string; label: string; media: FrameMedia}>;
export const statPillTextLimits = {value: {minWords: 1, maxWords: 1, maxChars: 8}, label: {minWords: 1, maxWords: 4, maxChars: 24}} as const;
export const statPillDuration = {minSeconds: 1.5, maxSeconds: 10};
export const repairStatPill = (input: unknown): StatPillProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const value = repairText(v.value, statPillTextLimits.value), label = repairText(v.label, statPillTextLimits.label), media = repairFrameMedia(v.media);
  return value && label && media ? {value, label, media} : null;
};
