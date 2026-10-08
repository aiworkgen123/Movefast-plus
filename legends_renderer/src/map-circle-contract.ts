import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
import {repairNormalizedPoint, type NormalizedPoint} from './media-contract.ts';
/** E56: an aerial map slowly zooms in, a thick red circle draws around a place and its caption types at the lower left. */
export type MapCircleProps = Readonly<{media: FrameMedia; caption: string; centre?: NormalizedPoint}>;
export const mapCircleTextLimits = {caption: {minWords: 1, maxWords: 6, maxChars: 40}} as const;
export const mapCircleDuration = {minSeconds: 2, maxSeconds: 12};
export const repairMapCircle = (input: unknown): MapCircleProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const media = repairFrameMedia(v.media), caption = repairText(v.caption, mapCircleTextLimits.caption);
  if (!media || !caption) return null;
  const centre = repairNormalizedPoint(v.centre);
  return {media, caption, ...(centre ? {centre} : {})};
};
