import { FRAME_HEIGHT, FRAME_WIDTH } from '../constants.js'

/**
 * The warped grid, as path data measured off the client's own reference.
 *
 * ####################################################################
 * # THIS MODULE MUST NEVER IMPORT `remotion`.                         #
 * #                                                                   #
 * # Same rule and same reason as `framedCardClock.ts`. It is tested   #
 * # by the `.test.ts` lane, which runs under `--conditions            #
 * # react-server`, where a `remotion` import dies at the import line  #
 * # with a React Server Components error that reads nothing like the  #
 * # real cause. `../constants.js` is safe — it imports only           #
 * # `@vg/core`, never `remotion`.                                     #
 * ####################################################################
 *
 * WHAT THIS IS. The black field with soft grey lines that sits behind FOUR of
 * the client's nine reference animations — a3, a4, a8 and a9. It is the most
 * recognisable thing in his whole reel, so it is built once, here, rather than
 * inside whichever animation happened to need it first.
 *
 * ####################################################################
 * # THE ARTWORK IS FIXED AND THE ONLY PROP IS `scale`. THIS WAS THE   #
 * # OPEN QUESTION AND IT IS NOW SETTLED BY MEASUREMENT.               #
 * #                                                                   #
 * # A reviewer measured the bow of the leftmost line in three of the  #
 * # animations and found it did NOT grow with the cell pitch, which   #
 * # would mean warp and pitch are two independent parameters and a    #
 * # `scale()` wrapper is the wrong build.                             #
 * #                                                                   #
 * # It was an artefact of measuring the bow over a chord fixed in     #
 * # SCREEN space. A scaled-up grid covers a SHORTER ARC of the same   #
 * # line inside the same frame, so the visible sagitta shrinks even   #
 * # though the line is identical. Measured over the same arc in GRID  #
 * # units the sagitta is 5.560 (a4), 5.626 (a9) and 5.631 (a3) — a    #
 * # spread of 1.3%.                                                   #
 * #                                                                   #
 * # Confirmed the other way too: one scale about the frame centre     #
 * # maps a9's frame 0 onto a4's frame 500 at k = 1.0000 at all five   #
 * # rows tested, including the two where the bow displaces lines      #
 * # most. a4 and a8 sit at k = 1.000 for their whole lives.           #
 * #                                                                   #
 * # SO: ONE pre-warped path set, wrapped in ONE `scale(k)`. Never     #
 * # recompute the warp at runtime and never expose a pitch prop.      #
 * ####################################################################
 *
 * ####################################################################
 * # IT IS NOT A LENS DISTORTION. DO NOT MODEL IT AS ONE.              #
 * #                                                                   #
 * # A seven-parameter radial fit failed at 3.60px rms and 17.19px     #
 * # worst over 8,514 points. The warp is centred near (862, 492) —    #
 * # about one cell left of and 48px above the frame centre — while    #
 * # the SCALE is about the frame centre. Two different centres, and   #
 * # confusing them draws the grid visibly wrong. The offset is baked  #
 * # into the path data below and must stay baked in.                  #
 * ####################################################################
 */

/**
 * Every line is ONE quadratic Bezier, and that is a measurement rather than a
 * simplification.
 *
 * Traced from absolute source frame 1259 of `Templates (Unseperated).mp4`,
 * which is a9's own first frame and the base artwork at scale 1.000. Each line
 * was followed pixel row by pixel row with a sub-pixel intensity centroid, then
 * fitted. Worst residual across all 30 lines is 0.41px rms and 3.03px at a
 * single point, and that worst point is on `h10`, the bottom line, which the
 * card covers for most of the reference so it is partly extrapolated.
 *
 * A cubic would fit no better than the noise floor of a ~3 Mbps h264 source.
 */
const VERTICAL_LINES: readonly (readonly [number, number, number])[] = [
  [66.76, 107.32, 69.51],
  [167.08, 201.65, 169.24],
  [266.89, 296.23, 268.7],
  [366.16, 390.89, 367.96],
  [465.94, 485.42, 467.1],
  [564.72, 580.02, 566.64],
  [664.08, 674.43, 665.79],
  [763.25, 769.07, 765.13],
  [862.39, 863.53, 864.74],
  [961.99, 957.98, 963.89],
  [1061.06, 1052.31, 1064.44],
  [1160.81, 1146.28, 1164.46],
  [1260.51, 1240.65, 1264.85],
  [1360.48, 1334.85, 1365.75],
  [1461.24, 1428.44, 1466.62],
  [1561.62, 1522.83, 1568.16],
  [1662.81, 1616.44, 1670.29],
  [1764.21, 1710.34, 1772.7],
  [1866.23, 1804.15, 1875.65],
] as const

const HORIZONTAL_LINES: readonly (readonly [number, number, number])[] = [
  [66.74, 109.36, 63.97],
  [170.03, 202.01, 168.41],
  [273.17, 294.66, 271.99],
  [375.39, 387.35, 375.28],
  [477.31, 480.3, 478.73],
  [579.57, 573.11, 582.17],
  [682.44, 665.45, 685.94],
  [785.67, 757.7, 791.61],
  [890.19, 849.74, 897.87],
  [996.29, 940.69, 1006.07],
  [1100.11, 1036.39, 1110.64],
] as const

/**
 * How the lines are painted, and the intersections are what pin it.
 *
 * A single line's cross-section is a Gaussian of sigma 2.45px peaking at 59.7
 * of 255. Painting a 2.75px stroke at alpha 0.504 and then blurring by
 * stdDeviation 2.32 reproduces that peak AND the 91.0 measured where two lines
 * cross, with profile residuals under 0.43 of 255.
 *
 * ####################################################################
 * # 91 IS THE NUMBER THAT DECIDES THE IMPLEMENTATION. Two lines each  #
 * # peaking at 59.7 would read about 105 if they were ADDED and 119   #
 * # if screened. 91 is what you get when the strokes are painted as   #
 * # one UNION and the whole thing is blurred afterwards. So every     #
 * # line goes into ONE path with ONE filter over it — never a blur    #
 * # per path, and never separate opacities that compose.              #
 * ####################################################################
 *
 * ####################################################################
 * # AND OUR RENDER LANDS AT 95, NOT 91. STATED RATHER THAN ROUNDED    #
 * # AWAY, BECAUSE THE GAP IS REAL AND SOMEBODY WILL RE-MEASURE IT.    #
 * #                                                                   #
 * # Measured on a real container render against the reference frame:  #
 * #                                                                   #
 * #                       single line   crossing   ratio              #
 * #   reference               59           91      1.542              #
 * #   first build             59          109      1.847              #
 * #   this build              58           95      1.638              #
 * #                                                                   #
 * # The first build put `stroke-opacity` on the lines, so two half-   #
 * # transparent strokes composited at every crossing. Fixing that to  #
 * # one opacity over one union took 109 to 95 and is a real fix.      #
 * #                                                                   #
 * # THE REMAINING 4 OF 255 DOES NOT CLOSE. A sweep over stroke width, #
 * # opacity and blur could not get the ratio below about 1.63 at any  #
 * # setting that also keeps the single line at 59. The obvious        #
 * # explanation was REFUTED by testing it: re-encoding our own clip   #
 * # at the reference's 3.0 Mbps leaves the crossing at 112, so this   #
 * # is not the reference's compression attenuating an isolated peak.  #
 * #                                                                   #
 * # The likeliest remaining explanation is that the client's grid is  #
 * # a RASTER asset being scaled up rather than vector art — bilinear  #
 * # resampling softens isolated peaks more than long edges, and the   #
 * # measurement that it is "one static picture that only gets bigger" #
 * # fits a bitmap exactly. Unproven, so it is written as a suspicion. #
 * #                                                                   #
 * # 4 of 255 on a line whose own peak is 59 is not visible, so this   #
 * # ships. Do not chase it without a reason from the client.          #
 * ####################################################################
 */
export const GRID_PAINT = {
  strokeWidth: 2.75,
  strokeOpacity: 0.504,
  blurStdDeviation: 2.32,
} as const

/**
 * The blur is PER ANIMATION. The artwork is not.
 *
 * ####################################################################
 * # a4 AND a9 SHARE ONE GRID DRAWN AT TWO DIFFERENT SOFTNESSES, AND   #
 * # SHIPPING ONE VALUE FOR BOTH DRAWS a4 40 PERCENT TOO DIM.          #
 * #                                                                   #
 * # Measured line cross-sections, mean of the nine central lines:     #
 * #                                                                   #
 * #            rms width   peak luma   integrated ink                 #
 * #   a4        1.5002       96.3          358.6                      #
 * #   a9        2.4665       57.6          356.5                      #
 * #                                                                   #
 * # THE INK IS THE SAME TO 0.6 PERCENT. Same stroke width, same       #
 * # opacity, same paths — only the blur differs, which is exactly     #
 * # what makes one prop the right shape rather than a second artwork. #
 * #                                                                   #
 * # The model was validated forwards on a9 before being run backwards #
 * # for a4: sqrt(2.75^2/12 + 2.32^2) = 2.4521 against a9's measured   #
 * # 2.4453-2.4665, agreeing to under 1 percent. Backwards for a4,     #
 * # sqrt(1.5002^2 - 2.75^2/12) = 1.273. An independent route agrees:  #
 * # blurring a4's own base frame by an extra sigma of 1.950 with a    #
 * # free gain reproduces a9's frame at rms 0.598 of 255, which        #
 * # back-solves to sqrt(2.32^2 - 1.95^2) = 1.257.                     #
 * #                                                                   #
 * # Render a4 at a9's 2.32 and every line draws at 58 peak where the  #
 * # reference draws 96, across the whole frame for all 129 frames.    #
 * ####################################################################
 */
export const GRID_BLUR = {
  /** a9, the animation the base artwork was traced from. */
  photoPop: 2.32,
  /** a4. Bounded 1.24 to 1.28 by two independent routes. */
  twoPhotoZoom: 1.27,
} as const

/**
 * THE PAINT IS PER ANIMATION TOO, NOT JUST THE BLUR.
 *
 * ####################################################################
 * # a3 FORCED THIS, AND IT WOULD HAVE BEEN A 15% BRIGHTNESS ERROR.   #
 * #                                                                   #
 * # `GRID_BLUR` alone was enough while a4 and a9 were the only two    #
 * # animations on this artwork, because they differ ONLY in softness: #
 * # their integrated ink matches to 0.6%, 358.6 against 356.5.        #
 * #                                                                   #
 * # a3 does not. Its lines carry 211.9 of ink against a4's 358.6, at  #
 * # a4's sharpness. Held at the shared strokeWidth of 2.75, every     #
 * # setting of blur and opacity that also matches a3's single-line    #
 * # peak predicts a crossing ratio of about 1.25 against the measured #
 * # 1.082 — 15.2% too bright at EVERY intersection on the frame.      #
 * #                                                                   #
 * # That is the same defect class already caught once at 20%, and it  #
 * # shows up in no test that samples a line away from a crossing.     #
 * #                                                                   #
 * # DO NOT EDIT `GRID_PAINT` TO SUIT A NEW ANIMATION. It is shared by #
 * # four deliverables, two of which are already rendered and sent.    #
 * # Add a row here instead.                                            #
 * ####################################################################
 *
 * a3's row comes from a free three-parameter fit of conv(rect(W), gauss(sigma))
 * to a 41-point mean cross-section averaged over 569 line samples, at 0.2995 of
 * 255 rms. It predicts a crossing ratio of 1.0905 against the measured 1.082.
 */
export const GRID_ANIMATION_PAINT = {
  /** a9. The base artwork, and the values `GRID_PAINT` holds. */
  photoPop: { strokeWidth: 2.75, strokeOpacity: 0.504, blurStdDeviation: 2.32 },
  /** a4. Same artwork and same ink as a9, sharper only. */
  twoPhotoZoom: { strokeWidth: 2.75, strokeOpacity: 0.504, blurStdDeviation: 1.27 },
  /** a3. a4's sharpness, but 59% of the ink — a genuinely lighter paint. */
  chapterTitle: { strokeWidth: 3.357, strokeOpacity: 0.2538, blurStdDeviation: 0.991 },
  /**
   * a8. Sharper than a9, lighter than a4, and HEAVIER THAN a3.
   *
   * ####################################################################
   * # a3 IS THE ROW A REVIEWER WILL WANT TO REUSE, AND IT IS THE ONE   #
   * # THAT DRAWS a8 WORST.                                             #
   * #                                                                   #
   * # a3's stroke matches a8's to 0.4% and its blur to 5%, so the two  #
   * # rows look interchangeable at a glance. The OPACITY does not      #
   * # match. Predicted single-line peak luma against a8's measured     #
   * # 79.9:                                                            #
   * #                                                                   #
   * #   a4 (2.75, 0.504, 1.27)     92.9   +16%, and crossings +32%     #
   * #   a9 (2.75, 0.504, 2.32)     57.6   -28%                         #
   * #   a3 (3.357, 0.2538, 0.991)  58.9   -26%   <- the nastiest       #
   * #                                                                   #
   * # AND a9's ROW PREDICTS a8's CROSSING PEAK TO WITHIN 0.8%, so any  #
   * # check that samples only at an intersection waves it straight     #
   * # through while every line on the frame is 29% too dim. That is    #
   * # the a3 defect turned inside out — a3 was caught because its      #
   * # crossings were wrong while its lines matched.                     #
   * ####################################################################
   *
   * Three significant figures is all the pixels support. Brackets, from three
   * routes each: strokeWidth 3.34-3.42 (3.3705, 3.3552, and 3.44 from a
   * fit-free moment route), blurStdDeviation 1.00-1.05 (1.0418, 1.0319, 1.00),
   * strokeOpacity 0.348-0.366 — and that last one is genuinely open rather
   * than merely imprecise. See `GRID_ANIMATION_VIGNETTE.galleryStrip`.
   *
   * The cross-section model is `conv(rect(W), gauss(sigma))` and it wins by
   * 3.2x to 4.5x over the nearest rival, which is what licenses reading the
   * width and the blur off it separately rather than quoting one lumped width:
   * conv(rect, gauss) rms 0.173/0.193 of 255, pure Gaussian 0.562/0.864,
   * Lorentzian 3.235/3.715, hard rect 6.297/9.613.
   *
   * For checking a render: integrated ink at the frame centre 298 (bracket 296
   * to 312), single-line peak luma 79.9 (79.2 to 83.5), rms width
   * `sqrt(W^2/12 + sigma^2)` = 1.418, which places a8 between a3's 1.386 and
   * a4's 1.498.
   *
   * ####################################################################
   * # MEASURED AGAINST A REAL RENDER, 2026-08-23, AND THE BLUR NUMBER   #
   * # TURNS OUT TO BE UNOBSERVABLE ACROSS ITS WHOLE BRACKET.            #
   * #                                                                   #
   * # Rendered at five sigmas and compared against his own frame 1144,  #
   * # rows 30-250, which is grid and nothing else. Median single-line   #
   * # peak luma and integrated ink against his 58.00 and 258.0:         #
   * #                                                                   #
   * #   sigma   peak            ink            band mad                 #
   * #   0.50    71.86  (+24%)   272.0 (+5.4%)   1.687                   #
   * #   0.90    56.00  ( -3.4%) 262.0 (+1.6%)   1.099                   #
   * #   0.95    56.00  ( -3.4%) 262.0 (+1.6%)   1.099                   #
   * #   1.03    56.00  ( -3.4%) 263.0 (+1.9%)   1.109                   #
   * #   1.30    56.00  ( -3.4%) 263.0 (+1.9%)   1.109                   #
   * #                                                                   #
   * # 1.03 AND 1.30 ARE BIT-IDENTICAL in that band. Chrome's            #
   * # `feGaussianBlur` is not a true Gaussian at these radii — it is    #
   * # box passes whose count is quantised — so the entire measured      #
   * # bracket of 1.00 to 1.05 renders as one image, and so does 1.30.   #
   * # Only crossing down to 0.50 changes anything, and that draws every #
   * # line 24% too bright.                                              #
   * #                                                                   #
   * # SO THE VALUE IS KEPT AT ITS MEASURED 1.03. Moving it to 0.95 buys #
   * # 0.9% of band mad, which is noise, and would mean tuning a number  #
   * # measured off his frames to chase an artefact of our renderer.     #
   * #                                                                   #
   * # AND IT MEANS THE OPEN QUESTION ON `strokeOpacity` CANNOT BE       #
   * # CLOSED THE WAY IT WAS EXPECTED TO BE. The plan was to render      #
   * # through the real Chrome blur and refit the gain. The blur has no  #
   * # resolution to refit against. The residual 3.4% peak deficit at    #
   * # matching ink is the box approximation's SHAPE, and the only       #
   * # levers left are the stroke width and the opacity.                 #
   * ####################################################################
   */
  galleryStrip: { strokeWidth: 3.36, strokeOpacity: 0.352, blurStdDeviation: 1.03 },
} as const

/**
 * The corner vignette, measured rather than assumed, and it is NOT radial.
 *
 * Peak line brightness is flat at 55–63 of 255 right across the middle of the
 * frame, including 20px from the left edge at mid height. It falls only into
 * the CORNERS. Sampled off the eleven horizontal lines away from their
 * crossings, normalised against a 60 plateau:
 *
 *     r = 0.708  ->  0.95        r = 0.835  ->  0.35
 *     r = 0.799  ->  0.58        r = 0.851  ->  0.27
 *                                r = 0.913  ->  0.12
 *
 * where `r` is the ELLIPTICAL radius below. Those five points are monotonic in
 * `r`, which is what proves the ellipse is the right normalisation — a circular
 * radius puts the left edge at mid height and the top edge at mid width at
 * almost the same radius with visibly different brightness.
 *
 * It is fixed in SCREEN space, so it must be applied OUTSIDE the scaled group.
 * Scaling it with the grid would swim the darkening around as the grid grows.
 */
export const GRID_VIGNETTE = {
  centre: { x: FRAME_WIDTH / 2, y: FRAME_HEIGHT / 2 },
  radius: { x: 1275, y: 745 },
  /** `alpha = smoothstep((fadeFrom - r) / fadeWidth)`, clamped to 0..1. */
  fadeFrom: 0.95,
  fadeWidth: 0.27,
} as const

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** The classic 3t^2 - 2t^3, which is what the measured falloff turned out to be. */
function smoothstep(t: number): number {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

/**
 * The vignette's alpha at a point, 0 to 1, in SCREEN pixels.
 *
 * Exported so the test can pin it against the five measured samples rather than
 * against the formula, and so the component can emit gradient stops from the
 * same function the test checks. Two implementations of one curve always drift.
 */
export function gridVignetteAlpha(x: number, y: number): number {
  const { centre, radius, fadeFrom, fadeWidth } = GRID_VIGNETTE
  const dx = (x - centre.x) / radius.x
  const dy = (y - centre.y) / radius.y
  const r = Math.sqrt(dx * dx + dy * dy)
  return smoothstep((fadeFrom - r) / fadeWidth)
}

/** The same curve as a function of the elliptical radius, for the gradient stops. */
export function gridVignetteAlphaAtRadius(r: number): number {
  const { fadeFrom, fadeWidth } = GRID_VIGNETTE
  return smoothstep((fadeFrom - r) / fadeWidth)
}

/**
 * THE FALLOFF IS PER ANIMATION TOO, AND a8 IS WHAT PROVED IT.
 *
 * ####################################################################
 * # `GRID_VIGNETTE` ABOVE WAS TRACED OFF a9 AND FITTED AGAINST a4.    #
 * # IT HOLDS ALPHA AT 1.000 OUT TO r = 0.68. a8 IS ALREADY AT 0.87    #
 * # BY r = 0.60 AND IS FALLING FROM r = 0.35.                         #
 * #                                                                   #
 * #    r       a8 measured    the shared row    the shared row's      #
 * #                                             error on a8           #
 * #   0.400      0.988           1.000            +1.2%               #
 * #   0.500      0.941           1.000            +6.3%               #
 * #   0.600      0.870           1.000           +14.9%               #
 * #   0.708      0.675           0.970           +34% to +46%         #
 * #   0.799      0.391           0.5885          +50%                 #
 * #   0.913      0.088           0.0512          -42%                 #
 * #                                                                   #
 * # THAT IS A BRIGHT RING ACROSS MOST OF THE FRAME, NOT A CORNER      #
 * # EFFECT, and during a8's plateau the grid is the only thing on     #
 * # screen. Two independent passes score the shared row at rms 30.4   #
 * # and 29.1 ink units against 14.8 and 14.0 for the row below, so it #
 * # is 2.06x worse over 6,633 and 22,964 samples.                     #
 * #                                                                   #
 * # a9's own five published points at those radii are 0.95, 0.58,     #
 * # 0.35, 0.27, 0.12. a8 is DARKER AT EVERY ONE.                      #
 * ####################################################################
 *
 * ####################################################################
 * # NEVER MIX ONE ANIMATION'S VIGNETTE WITH ANOTHER'S PAINT ROW.      #
 * #                                                                   #
 * # On out-of-sample frames, a3's paint row combined with the SHARED  #
 * # vignette scores rms 4.279/3.928 on a8 — startlingly close to a8's #
 * # own correct pair at 4.240/3.472 — because a3's paint is 26% too   #
 * # dim and the shared vignette is 34-46% too bright and the two      #
 * # errors partially cancel.                                          #
 * #                                                                   #
 * # So fixing ONLY the vignette while keeping a3's paint makes the    #
 * # whole-frame number go UP, to 4.686/4.574. A reviewer who fixes    #
 * # one, measures, and sees the error rise may revert the correct     #
 * # change. FIX BOTH TOGETHER OR NEITHER.                             #
 * ####################################################################
 */
export type GridVignetteLaw =
  | { readonly kind: 'smoothstep'; readonly fadeFrom: number; readonly fadeWidth: number; readonly stops: readonly number[] }
  | { readonly kind: 'superGaussian'; readonly r0: number; readonly power: number; readonly stops: readonly number[] }

/**
 * The stop offsets a3, a4 and a9 have always emitted.
 *
 * ####################################################################
 * # THIS ARRAY IS FROZEN. a4's AND a9's CLIPS ARE ALREADY WITH THE    #
 * # CLIENT, AND THE STOPS ARE PART OF WHAT THEY RENDERED. Changing    #
 * # the offsets changes their pixels. a8 carries its own list.        #
 * ####################################################################
 */
const SHARED_VIGNETTE_STOPS = [0, 0.6, 0.68, 0.72, 0.76, 0.8, 0.84, 0.88, 0.92, 0.95, 1] as const

/**
 * a8's stops, on a uniform 0.025 grid.
 *
 * A super-Gaussian of power 8 is flat and then falls hard, so the shared list's
 * 0.08-wide step from 0.60 to 0.68 straddles the knee and linear interpolation
 * across it costs 1.1% of alpha, about 3 of 255 on a line at peak 80. A uniform
 * 0.025 grid takes that under 0.001, which is a tenth of one level.
 */
const A8_VIGNETTE_STOPS = Array.from(
  { length: 41 },
  /*
   * ROUNDED, because `24 * 0.025` is 0.6000000000000001 in binary floating
   * point and that lands in the SVG attribute verbatim. It renders identically
   * — SVG parses it fine — but it makes the emitted markup unreadable and it
   * defeats anything that looks a stop up by its offset, which is how the
   * mount test checks a8 is not using the shared falloff.
   */
  (_, index) => Math.round(index * 25) / 1000,
)

const SHARED_VIGNETTE_LAW = {
  kind: 'smoothstep',
  fadeFrom: GRID_VIGNETTE.fadeFrom,
  fadeWidth: GRID_VIGNETTE.fadeWidth,
  stops: SHARED_VIGNETTE_STOPS,
} as const

/** One falloff per animation, keyed exactly as `GRID_ANIMATION_PAINT` is. */
export const GRID_ANIMATION_VIGNETTE: Record<
  keyof typeof GRID_ANIMATION_PAINT,
  GridVignetteLaw
> = {
  /*
   * a9, a4 and a3 all read the shared row, and they read it THROUGH
   * `GRID_VIGNETTE` rather than repeating its numbers, so the two cannot drift.
   * a3 differs from a4 and a9 in its FRAME OF REFERENCE, not in its falloff —
   * see `vignetteScalesWithGrid` on the component.
   */
  photoPop: SHARED_VIGNETTE_LAW,
  twoPhotoZoom: SHARED_VIGNETTE_LAW,
  chapterTitle: SHARED_VIGNETTE_LAW,

  /**
   * a8, on the SAME ellipse. Only the alpha-at-radius changes.
   *
   * ####################################################################
   * # KEEPING rx 1275 / ry 745 IS A DELIBERATE PURCHASE OF SAFETY.     #
   * #                                                                   #
   * # The best free-ellipse fit is rx 1052-1075, ry 581-595, and it is #
   * # 0.5 to 1.1 rms better. It is not worth taking. With that ellipse #
   * # the alpha at the gradient's own edge is exp(-1) = 0.368, so SVG's#
   * # `pad` would light the frame's corners at 37% brightness. On this #
   * # ellipse the edge value is 0.00033 and the corner is 0.000097, so #
   * # `pad` lands on black.                                            #
   * #                                                                   #
   * # IF ANYONE EVER SWAPS THE ELLIPSE, RE-CHECK WHERE THE GRADIENT    #
   * # PADS. It is the kind of change that looks free and lights up the #
   * # four corners of every frame.                                     #
   * ####################################################################
   *
   * `r0` bracket 0.8075 to 0.8155. `power` bracket 7.0 to 8.2 — an earlier
   * pass quoted 8.176, which is two digits more than this content supports.
   *
   * ####################################################################
   * # THE FAMILY IS NOT QUITE RIGHT, AND THE RESIDUAL IS RECORDED      #
   * # RATHER THAN TUNED AWAY.                                          #
   * #                                                                   #
   * # The measured falloff is 3-4% BRIGHTER than any smooth family at  #
   * # r = 0.33-0.40 and about 5% DARKER than this curve at r = 0.70    #
   * # to 0.72. So the authored curve has a slightly flatter core and a #
   * # harder knee than a super-Gaussian, and both residuals reproduce  #
   * # in two independent passes. Worst case is 5 of 255.               #
   * #                                                                   #
   * # This is the first thing to re-measure if a8's grid ever reads    #
   * # wrong in the mid-field.                                          #
   * ####################################################################
   *
   * The darkening is a pure multiplicative alpha and NOT extra blur. Refitting
   * the stroke width and sigma freely inside 24 radius bins from 0.33 to 0.87
   * holds W in 3.29-3.47 and sigma in 0.99-1.11 while the amplitude falls from
   * 93.4 to 14.5. Only past r = 0.88, where the signal is under 15 of 255 and
   * the encoder is crushing it, does sigma climb at all.
   */
  galleryStrip: { kind: 'superGaussian', r0: 0.814, power: 8, stops: A8_VIGNETTE_STOPS },
}

/**
 * A named falloff's alpha at an elliptical radius.
 *
 * Exported so the test can pin each law against its own measured ladder, and so
 * the component emits gradient stops from the same function the test checks.
 * Two implementations of one curve always drift.
 */
export function gridVignetteAlphaAtRadiusFor(law: GridVignetteLaw, r: number): number {
  if (law.kind === 'superGaussian') {
    return Math.exp(-Math.pow(Math.max(r, 0) / law.r0, law.power))
  }
  return smoothstep((law.fadeFrom - r) / law.fadeWidth)
}

/**
 * The `d` attributes for every line, at the base scale.
 *
 * A vertical is `M p0 0 Q p1 540 p2 1080` — the control point sits at the frame's
 * vertical midpoint because the fit parametrises `x` against `y` linearly, so
 * `t = 0.5` IS `y = 540`. Horizontals are the same idea transposed.
 *
 * ####################################################################
 * # THE PATHS SPAN THE WHOLE FRAME AND THAT IS WHY SCALING IS SAFE.   #
 * #                                                                   #
 * # A path from y=0 to y=1080, scaled by 1.0571 about the centre,     #
 * # runs from y=-30.8 to y=1110.8. So a line END can never drift into #
 * # view. And because scaling pushes lines AWAY from the centre, a    #
 * # line outside the frame at scale 1 moves further out — the 19 and  #
 * # 11 below are the complete visible set at every scale >= 1.        #
 * #                                                                   #
 * # This animation only ever scales UP. A scale below 1 would expose  #
 * # bare corners, so if a3's 1.150-to-1.391 ramp is ever built here,  #
 * # do not let it dip under 1 without extending the path set.         #
 * ####################################################################
 */
export function warpedGridPaths(): { vertical: string[]; horizontal: string[] } {
  const midY = FRAME_HEIGHT / 2
  const midX = FRAME_WIDTH / 2

  return {
    vertical: VERTICAL_LINES.map(
      ([p0, p1, p2]) => `M ${p0} 0 Q ${p1} ${midY} ${p2} ${FRAME_HEIGHT}`,
    ),
    horizontal: HORIZONTAL_LINES.map(
      ([p0, p1, p2]) => `M 0 ${p0} Q ${midX} ${p1} ${FRAME_WIDTH} ${p2}`,
    ),
  }
}

/** Counts, exported so the test can pin them without reaching into the arrays. */
export const GRID_LINE_COUNT = {
  vertical: VERTICAL_LINES.length,
  horizontal: HORIZONTAL_LINES.length,
} as const

/**
 * Where a vertical line sits at a given row, at the base scale.
 *
 * Only the test uses this, to check the fitted curves against raw measurements
 * taken off the reference at rows the fit did not privilege.
 */
export function verticalLineX(index: number, y: number): number {
  const line = VERTICAL_LINES[index]
  if (line === undefined) throw new Error(`no vertical line ${index}`)
  const t = y / FRAME_HEIGHT
  const [p0, p1, p2] = line
  return (1 - t) * (1 - t) * p0 + 2 * t * (1 - t) * p1 + t * t * p2
}

/** As `verticalLineX`, for a horizontal line at a given column. */
export function horizontalLineY(index: number, x: number): number {
  const line = HORIZONTAL_LINES[index]
  if (line === undefined) throw new Error(`no horizontal line ${index}`)
  const t = x / FRAME_WIDTH
  const [p0, p1, p2] = line
  return (1 - t) * (1 - t) * p0 + 2 * t * (1 - t) * p1 + t * t * p2
}
