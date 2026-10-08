import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E28: narrow (square or portrait) footage shown sharp in the centre over a blurred, enlarged, darker copy of itself. */
export type BlurFillProps = Readonly<{media: FrameMedia}>;
export const blurFillDuration = {minSeconds: 0.3, maxSeconds: 12};
export const repairBlurFill = (input: unknown): BlurFillProps | null => {
  if (!input || typeof input !== 'object') return null;
  const media = repairFrameMedia((input as Record<string, unknown>).media);
  return media ? {media} : null;
};
