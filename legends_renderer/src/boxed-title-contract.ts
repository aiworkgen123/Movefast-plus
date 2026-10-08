import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E10: a centred see-through dark box wipes in over the footage and a short title types into it. */
export type BoxedTitleProps = Readonly<{text: string; media: FrameMedia}>;
export const boxedTitleTextLimits = {text: {minWords: 1, maxWords: 5, maxChars: 26}} as const;
export const boxedTitleDuration = {minSeconds: 2, maxSeconds: 10};
export const repairBoxedTitle = (input: unknown): BoxedTitleProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const text = repairText(v.text, boxedTitleTextLimits.text), media = repairFrameMedia(v.media);
  return text && media ? {text, media} : null;
};
