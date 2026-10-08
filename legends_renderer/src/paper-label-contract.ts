import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E15: a white paper strip with rough edges wipes in at the lower left, revealing a short label in spaced black capitals. */
export type PaperLabelProps = Readonly<{text: string; media: FrameMedia}>;
export const paperLabelTextLimits = {text: {minWords: 1, maxWords: 4, maxChars: 24}} as const;
export const paperLabelDuration = {minSeconds: 2, maxSeconds: 10};
export const repairPaperLabel = (input: unknown): PaperLabelProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const text = repairText(v.text, paperLabelTextLimits.text), media = repairFrameMedia(v.media);
  return text && media ? {text, media} : null;
};
