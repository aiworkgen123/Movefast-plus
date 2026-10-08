/**
 * Template 05, shadow-up: its clock and its type, as pure data and pure functions.
 *
 * ####################################################################
 * # THE PORT IS EXACT, AND THIS IS WHY.                               #
 * #                                                                   #
 * # His table is 60 fps and repeats every value but the last twice,  #
 * # so his motion was a 30 fps motion sampled twice. Film frame f is  #
 * # time f/30, which is his frame 2f, so the film reads his own table #
 * # at `frame * 60 / fps` and loses nothing. Measured by              #
 * # `tmp/v52/template-05/clock-port.mjs` against the approved         #
 * # preview's ink: 44 of 44 frames agree.                             #
 * #                                                                   #
 * #   5:79 6:69 7:59 8:49 9:41 10:33 11:27 12:22 13:18 14:14 15:12    #
 * #   16:9 17:7 18:6 19:4 20:4 21:3 22:2 23:2 24:1 25:1, 0 from 26    #
 * #   hidden on frames 0 to 4, fully opaque from frame 5              #
 * #                                                                   #
 * # Evaluating the table at the film frame instead is the obvious     #
 * # port and it runs twice as slow. `shadowUpClock.test.ts` pins it.  #
 * ####################################################################
 *
 * ####################################################################
 * # THIS MODULE NEVER IMPORTS `remotion`, THE RULE EVERY CLOCK IN    #
 * # THIS TREE KEEPS, AND THAT IS THE ONE PLACE IT DEPARTS FROM THE   #
 * # SPEC'S SKETCH.                                                   #
 * #                                                                  #
 * # The rule is the box at the top of `framedCardClock.ts`. It is    #
 * # not "imports nothing": three clocks import `../constants.js`,    #
 * # which imports only `@vg/core`. This one happens to import        #
 * # nothing at all, as six others do.                                #
 * #                                                                  #
 * # The sketch in `tmp/v52/specs/template-05.md` 4.5 took            #
 * # `interpolate` from `remotion`. His table needs none of it: its   #
 * # frames are consecutive integers and the film samples it at even  #
 * # integers, so every frame the film draws returns a value of his   #
 * # table with no blend between two. `sampleClamped` is his          #
 * # `interpolate` with his `clamp` on both sides, and the test       #
 * # proves it returns his table, frame for frame, at his own 60 fps. #
 * ####################################################################
 */

/** His frame rate. The table below is in his frames. */
export const SHADOW_UP_SOURCE_FPS = 60

/** His rise, 60 fps frames, byte for byte from `ShadowUpAnimatedTextOverlay.tsx:28-32`. */
export const SHADOW_UP_RISE_FRAMES_60 = [
  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
] as const

/** Pixels below rest at each of those frames, byte for byte from `:33-37`. */
export const SHADOW_UP_RISE_OFFSETS = [
  79, 79, 69, 69, 59, 59, 49, 49, 41, 41, 33, 33, 27, 27, 22, 22, 18, 18, 14, 14, 12, 12, 9, 9, 7,
  7, 6, 6, 4, 4, 4, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 0,
] as const

/** His opacity step, in seconds, `:49-54`. At 30 fps no film frame falls inside it. */
export const SHADOW_UP_REVEAL_SECONDS = [0.14, 0.15] as const

/**
 * The type, his values where they carry over and measured ones where they cannot.
 *
 * ####################################################################
 * # THREE OF THESE ARE NOT HIS NUMBERS, AND EACH IS MEASURED.         #
 * #                                                                   #
 * # SIZE 104, NOT HIS 101. His 101 was set for his face, which this   #
 * # repo does not have. Matched on CAP HEIGHT, the thing the eye      #
 * # reads: the preview's cap is 73 rows, Bebas's cap is 0.700 em, and #
 * # 104 x 0.700 = 72.8. Matching the name instead would draw a 70.7   #
 * # px cap. `measure-reference.out.txt`, `bebas-metrics.out.txt`.     #
 * #                                                                   #
 * # WEIGHT 400, NOT HIS 700. Bebas has one weight and                 #
 * # `useCondensedFace` registers it as 400. Asking for 700 makes      #
 * # Chrome thicken the outlines without widening them, which moved    #
 * # a2's words on screen (trap F). Bebas at 400 is already heavy.     #
 * #                                                                   #
 * # BASELINE 1007, NOT HIS `top` OF 935. His `top` placed his face's  #
 * # box. The preview's last cap ink row is 1006, so the baseline is   #
 * # the line under it, and the component hangs the box from there     #
 * # through the face's own baseline ratio, never a typed top.         #
 * ####################################################################
 */
export const SHADOW_UP_TYPE = {
  fontSizePx: 104,
  fontWeight: 400,
  letterSpacingPx: 1.25,
  baselineY: 1007,
  /** His mask: a box from y 0 to y 1020 with overflow hidden, `:67-76`. */
  maskBottomY: 1020,
  /** The dark copy rides this far under the white one, `:91`. */
  shadowCopyDropPx: 5,
  /** Both copies nudged left, `:91`, `:111`. */
  nudgeXPx: -1,
  colour: '#fffdf6',
  shadowCopyColour: '#090909',
  textShadow: '0 4px 4px rgba(0, 0, 0, 0.72)',
  ground: '#0c0c0c',
} as const

/**
 * His `interpolate(x, xs, ys, clamp)`: straight lines between the points, held
 * flat before the first and after the last. `xs` must rise, as his does.
 */
function sampleClamped(x: number, xs: readonly number[], ys: readonly number[]): number {
  const firstX = xs[0] ?? 0
  const firstY = ys[0] ?? 0
  const lastX = xs[xs.length - 1] ?? firstX
  const lastY = ys[ys.length - 1] ?? firstY
  if (x <= firstX) return firstY
  if (x >= lastX) return lastY
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const x0 = xs[i] ?? firstX
    const x1 = xs[i + 1] ?? lastX
    const y0 = ys[i] ?? firstY
    const y1 = ys[i + 1] ?? lastY
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return lastY
}

/** Pixels below rest. Film frame f is his 60 fps frame `f * 60 / fps`. */
export function shadowUpRise(frame: number, fps: number): number {
  return sampleClamped(
    (frame * SHADOW_UP_SOURCE_FPS) / fps,
    SHADOW_UP_RISE_FRAMES_60,
    SHADOW_UP_RISE_OFFSETS,
  )
}

/** His opacity step, verbatim: 0 until 0.14 s, 1 from 0.15 s. */
export function shadowUpOpacity(frame: number, fps: number): number {
  const [from, to] = SHADOW_UP_REVEAL_SECONDS
  return sampleClamped(frame, [from * fps, to * fps], [0, 1])
}
