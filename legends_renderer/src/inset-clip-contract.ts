import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E16: the footage plays in a small floating card (gently swaying) over a blurred copy of itself, with a caption chip above. */
/** backdrop: 'blurred' (E16, footage blurred behind the card) or 'dim' (E29, footage sharp but dark). */
export type InsetClipProps = Readonly<{caption: string; media: FrameMedia; backdrop?: 'blurred' | 'dim'}>;
export const insetClipTextLimits = {caption: {minWords: 1, maxWords: 6, maxChars: 40}} as const;
export const insetClipDuration = {minSeconds: 2, maxSeconds: 12};
export const repairInsetClip = (input: unknown): InsetClipProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const caption = repairText(v.caption, insetClipTextLimits.caption), media = repairFrameMedia(v.media);
  if (!caption || !media) return null;
  return {caption, media, ...(v.backdrop === 'dim' ? {backdrop: 'dim' as const} : {})};
};
