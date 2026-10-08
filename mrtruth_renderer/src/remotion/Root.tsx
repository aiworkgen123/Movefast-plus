import { AbsoluteFill, Composition } from 'remotion'
import type { CalculateMetadataFunction } from 'remotion'
import type { ReactNode } from 'react'
import { BLACK_HEAD_FRAMES, FPS, FRAME_HEIGHT, FRAME_WIDTH } from './constants.js'
import { Scene } from './Scene.js'
import { BumperPropsSchema, DEFAULT_SEGMENT_PROPS, SegmentPropsSchema } from './props.js'
import type { BumperProps, SegmentProps } from './props.js'

/**
 * Two compositions, and a deliberate reason for the second one.
 *
 * `Segment` renders exactly one PlannedScene. The worker renders it once per
 * scene, keyed by `renderKey`, and concatenates the results.
 *
 * `Bumper` renders black. The head (6 frames) and tail (12 frames) of the
 * FINISHED film cannot live inside segment 0 and segment N: a `renderKey`
 * excludes `startFrame` and `index` on purpose, so "I am the first scene" is not
 * expressible in the hash, and baking a black head into that segment would serve
 * a wrong first frame to every future job that reuses it. So the bumpers are
 * their own tiny renders, concatenated at the ends.
 *
 * THE FONT IS NOT LOADED HERE. It used to be — a bare `loadDocumentaryFont()`
 * on this line — and that is what killed stage 6 on every job it ever ran: a
 * `delayRender()` handle taken during module evaluation is erased from
 * Remotion's bookkeeping before it can be cleared, and its orphaned 28s timer
 * cancels the render. `Scene` takes the gate in a layout effect instead; see the
 * block comment in `fonts.ts`. `Bumper` renders black and needs no typeface.
 */

const calculateSegmentMetadata: CalculateMetadataFunction<SegmentProps> = ({ props }) => {
  // Zod at the boundary: `inputProps` arrives as JSON from another process, and
  // a plan that disagrees with the contract must fail here rather than render
  // 40 minutes of something subtly wrong.
  const parsed = SegmentPropsSchema.parse(props)
  return {
    durationInFrames: parsed.scene.durationFrames,
    fps: FPS,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    props: parsed,
  }
}

const calculateBumperMetadata: CalculateMetadataFunction<BumperProps> = ({ props }) => {
  const parsed = BumperPropsSchema.parse(props)
  return {
    durationInFrames: parsed.frames,
    fps: FPS,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    props: parsed,
  }
}

function Bumper(): ReactNode {
  return <AbsoluteFill style={{ backgroundColor: '#000' }} />
}

export function RemotionRoot(): ReactNode {
  return (
    <>
      <Composition
        id="Segment"
        component={Scene}
        durationInFrames={DEFAULT_SEGMENT_PROPS.scene.durationFrames}
        fps={FPS}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        defaultProps={DEFAULT_SEGMENT_PROPS}
        calculateMetadata={calculateSegmentMetadata}
      />

      <Composition
        id="Bumper"
        component={Bumper}
        durationInFrames={BLACK_HEAD_FRAMES}
        fps={FPS}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        defaultProps={{ frames: BLACK_HEAD_FRAMES } satisfies BumperProps}
        calculateMetadata={calculateBumperMetadata}
      />
    </>
  )
}
