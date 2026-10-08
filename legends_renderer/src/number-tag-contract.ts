import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E53: a big number counts up at the lower left with a white unit tag centred beneath it. */
export type NumberTagProps = Readonly<{value: number; unit: string; media: FrameMedia}>;
export const numberTagTextLimits = {unit: {minWords: 1, maxWords: 4, maxChars: 22}} as const;
export const numberTagDuration = {minSeconds: 1.5, maxSeconds: 10};
export const repairNumberTag = (input: unknown): NumberTagProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const unit = repairText(v.unit, numberTagTextLimits.unit), media = repairFrameMedia(v.media);
  if (!unit || !media || typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value <= 0 || v.value >= 1e9 || !Number.isInteger(v.value)) return null;
  return {value: v.value, unit, media};
};
