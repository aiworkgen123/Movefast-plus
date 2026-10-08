import { easeOut } from '../constants.js'

/**
 * The pointer-label's clock and geometry, as pure functions of one integer.
 *
 * MUST NEVER IMPORT `remotion`, for the reason set out at the top of
 * `framedCardClock.ts`.
 *
 * WHAT THIS IS. The client's first reference animation, at 0:00 of
 * `Templates (Unseperated).mp4`. A photograph, a small label card, and a curved
 * line that draws itself out of the card and lands an arrowhead on the subject.
 *
 * ####################################################################
 * # WHY THIS ONE IS BUILDABLE WHEN SEVEN OF THE NINE ARE NOT.         #
 * #                                                                   #
 * # It needs exactly what a scene already carries. ONE photograph,    #
 * # ONE short label, and a point in the picture to aim at.            #
 * #                                                                   #
 * # That last one is the interesting part. `AssetVisionSchema` at     #
 * # `packages/core/src/schemas.ts:631` records `subjectAnchor` for    #
 * # every sourced photograph — where the subject actually sits in the #
 * # frame. It was added so the compositor could keep type clear of    #
 * # the subject. Here it becomes the thing the arrow points AT, which #
 * # is the same number read the other way round.                      #
 * #                                                                   #
 * # So no new model call, no new field, no new prompt.                #
 * ####################################################################
 *
 * ####################################################################
 * # THE ORDER IS THE DEVICE, AND IT IS FOUR SEPARATE START FRAMES.    #
 * #                                                                   #
 * #   frame 29  the card arrives from the right and fades up          #
 * #   frame 34  a line DRAWS ITSELF out of the card, tip first        #
 * #   frame 41  an arrowhead appears where the line stopped           #
 * #   frame 56  the photograph eases back to fill the frame           #
 * #                                                                   #
 * # Fading them in together is a different and much flatter device,   #
 * # and it is what you get by default. The line in particular must    #
 * # GROW rather than fade, because a fading line has no direction and #
 * # the whole point is that it travels from the words to the thing.   #
 * ####################################################################
 *
 * Frame numbers are the measured seconds at 30fps. The 6fps sampling pass could
 * not resolve the arrowhead, so that window was re-extracted at the full frame
 * rate before these were written.
 */
export const POINTER_LABEL = {
  /** 3.1 seconds. */
  totalFrames: 93,

  photo: {
    /**
     * Opens about 4% cropped in and eases back to exactly 1.
     *
     * The direction matters. This is a PULL, not a push, so the shot opens
     * tight and opens up, which is what makes the reveal feel like it settles.
     */
    scaleFrom: 1.0395,
    pullStart: 56,
    pullFrames: 28,
  },

  card: {
    startFrame: 29,
    frames: 14,
    /** Arrives from about 4.7% of frame width to the right of its mark. */
    offsetFromX: 90,
    /** Fractions of the frame. The card's own box, measured off the reference. */
    box: { left: 0.633, right: 0.761, top: 0.376, bottom: 0.476 },
  },

  line: {
    startFrame: 34,
    frames: 5,
    /** Where the line leaves the card, as a fraction of the frame. */
    from: { x: 0.633, y: 0.428 },
  },

  arrow: {
    startFrame: 41,
    frames: 5,
    /** Across the barb, as a fraction of frame width. */
    size: 0.016,
  },
} as const

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function windowProgress(frame: number, startFrame: number, frames: number): number {
  return clamp01((frame - startFrame) / frames)
}

/**
 * The photograph's scale. Held, then eased back to exactly 1.
 *
 * Never below 1. A scale under 1 on a frame-filling picture exposes the frame
 * edge, which is why `MIN_SCALE` is 1 in `schemas.ts` and why this clamps rather
 * than trusting the arithmetic.
 */
export function pointerLabelPhotoScale(frame: number): number {
  const { scaleFrom, pullStart, pullFrames } = POINTER_LABEL.photo
  const t = easeOut(windowProgress(frame, pullStart, pullFrames))
  const scale = scaleFrom + (1 - scaleFrom) * t
  return scale < 1 ? 1 : scale
}

/** The label card's entry. Slides in from the right while fading up. */
export function pointerLabelCard(frame: number): { opacity: number; offsetX: number } {
  const { startFrame, frames, offsetFromX } = POINTER_LABEL.card
  const t = easeOut(windowProgress(frame, startFrame, frames))
  return { opacity: t, offsetX: offsetFromX * (1 - t) }
}

/**
 * How much of the leader line is drawn, 0 to 1, from the card outwards.
 *
 * Drawn with `strokeDashoffset` rather than faded. A fading line appears along
 * its whole length at once and has no direction; this device is entirely about
 * something travelling from the words to the thing being named.
 */
export function pointerLabelLine(frame: number): number {
  const { startFrame, frames } = POINTER_LABEL.line
  return easeOut(windowProgress(frame, startFrame, frames))
}

/** The arrowhead, which grows in once the line has stopped. */
export function pointerLabelArrow(frame: number): number {
  const { startFrame, frames } = POINTER_LABEL.arrow
  return easeOut(windowProgress(frame, startFrame, frames))
}

export type Point = { x: number; y: number }

/**
 * The length of a quadratic bezier, by sampling.
 *
 * ####################################################################
 * # THE LEADER LINE IS DRAWN BY RUNNING `strokeDashoffset` FROM THIS  #
 * # NUMBER DOWN TO ZERO, SO GETTING IT WRONG IS VISIBLE.              #
 * #                                                                   #
 * # An offset LARGER than the path draws nothing at all. The first    #
 * # build used "straight distance times two" as a safe over-estimate  #
 * # and the client watched the result. Measured on the real geometry, #
 * # the curve is 357.5 and the guess was 657.8, so 45.7% of the draw  #
 * # window was dead and the line then had 2.7 frames to travel        #
 * # instead of 5. He called it "slightly delay and not smooth".       #
 * #                                                                   #
 * # SAMPLED RATHER THAN `getTotalLength()`, which is the browser's    #
 * # own answer and would be exact. It needs a laid-out SVG element,   #
 * # which means a ref, an effect and a re-render — and none of that   #
 * # is testable here, because jsdom computes no layout. A pure        #
 * # function is checkable to the digit, and 64 samples is inside a    #
 * # tenth of a pixel on a curve this shallow.                         #
 * ####################################################################
 */
export function quadraticLength(from: Point, control: Point, to: Point): number {
  const SAMPLES = 64
  const at = (t: number, a: number, b: number, c: number): number =>
    (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c

  let length = 0
  let previous = from

  for (let step = 1; step <= SAMPLES; step += 1) {
    const t = step / SAMPLES
    const point = { x: at(t, from.x, control.x, to.x), y: at(t, from.y, control.y, to.y) }
    length += Math.hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }

  return length
}

/**
 * Where the leader line's curve bows, given the two ends.
 *
 * Lives here rather than in the component so the component and the tests cannot
 * disagree about the geometry — the same mistake `overlayStartFrame` exists to
 * prevent between the planner and the compositor.
 */
export function pointerLabelControl(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 }
}
