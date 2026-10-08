import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root.js'

/**
 * The Remotion entry point.
 *
 * The worker bundles THIS file (`REMOTION_ENTRY`, defaulting to
 * `apps/web/src/remotion/index.ts`) and renders the `Segment` composition once
 * per scene. Two things it has to get right:
 *
 *  - `publicDir` must resolve to `apps/web/public`, or `staticFile()` will not
 *    find the fonts and the render will be cancelled by design.
 *  - the webpack override in `apps/web/remotion.config.ts` must be applied, or
 *    @vg/core's `./frames.js` imports will not resolve to their `.ts` sources.
 */
registerRoot(RemotionRoot)

export { RemotionRoot } from './Root.js'
export { SegmentPropsSchema, BumperPropsSchema, DEFAULT_SEGMENT_PROPS } from './props.js'
export type { SegmentProps, BumperProps } from './props.js'
export { BLACK_HEAD_FRAMES, BLACK_TAIL_FRAMES } from './constants.js'
