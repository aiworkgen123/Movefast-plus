import type {FrameContext} from './contract.ts';
/** Keyframes measured frame by frame on WTC 17:45.7 (15 frames at 30 fps), as fractions of the overlay's life:
 * 1-frame flash, 4 clear frames (the new shot settles), orange, yellow-green with red scratches, orange,
 * then a band that rolls off to the left. */
const wash = [0.9, 0, 0, 0, 0, 0.45, 0.55, 0.55, 0.45, 0, 0, 0, 0, 0, 0] as const;
const tone = [0, 0, 0, 0, 0, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1] as const; // index into skin.stage.burn
const band = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.62, 0.6, 0.55, 0.45, 0.3, 0.12] as const;
const edge = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.46, 0.42, 0.36, 0.28, 0.18, 0.08] as const;
export const filmBurnState = (context: FrameContext) => {
  const i = Math.min(14, Math.floor(context.frame / context.durationInFrames * 15));
  return {wash: wash[i], tone: tone[i], band: band[i], bandEdge: edge[i], scratches: i === 6 || i === 7, flash: i === 0};
};
