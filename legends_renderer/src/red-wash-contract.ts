import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** T03: the picture turns red from the centre outwards before a hard cut. No text. */
export type RedWashProps = Readonly<{media: FrameMedia}>;
export const redWashDuration = {minSeconds: 1.2, maxSeconds: 4};
export const repairRedWash = (input: unknown): RedWashProps | null => {
  if (!input || typeof input !== 'object') return null;
  const media = repairFrameMedia((input as Record<string, unknown>).media);
  return media ? {media} : null;
};
