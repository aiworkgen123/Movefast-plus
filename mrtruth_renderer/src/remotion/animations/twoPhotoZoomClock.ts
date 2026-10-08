/**
 * The two photo cards' clock and geometry, as pure functions of one integer.
 *
 * ####################################################################
 * # THIS MODULE MUST NEVER IMPORT `remotion`.                         #
 * #                                                                   #
 * # Same rule as the other clock modules. The `.test.ts` lane runs    #
 * # under `--conditions react-server`, where a `remotion` import dies #
 * # at the import line with an error that reads nothing like the real #
 * # cause. This file imports NOTHING, which is stronger still.        #
 * ####################################################################
 *
 * WHAT THIS IS. The client's fourth reference animation, at 0:17 of
 * `Templates (Unseperated).mp4`. His own words:
 *
 *   WHAT     2 images with a title on it
 *   FROM/TO  the text of the image is static, comming in the 2 images lke
 *            zooming in slowly
 *   WHEN     starts at 0:17, takes 3 seconds
 *   HOW      slowly zooming in the image
 *
 * Two photographs side by side in thick white mounts, each with an orange chip
 * of type underneath. Both photographs grow from nothing to full size together.
 * The chips never move.
 *
 * ####################################################################
 * # ALMOST NOTHING TRANSFERS FROM `photoPopClock.ts`. READ THIS       #
 * # BEFORE REACHING FOR IT.                                           #
 * #                                                                   #
 * #   a9 border   2.2px, FIXED     a4 border   24px, SCALES with card #
 * #   a9 glow     sigma 11.15      a4 glow     NONE AT ALL            #
 * #   a9 grid     grows 5.7%       a4 grid     dead at k = 1.000      #
 * #   a9 curve    damped spring    a4 curve    the CSS named `ease`   #
 * #   a9 settle   never settles    a4 settles  hard at frame 80       #
 * #   a9 origin   frame centre     a4 origin   each card's OWN centre #
 * #   a9 words    none             a4 words    two, and they are      #
 * #                                            NOT children of the    #
 * #                                            cards                  #
 * #                                                                   #
 * # Every one of those is a measurement, and each of them draws       #
 * # something visibly wrong if a9's answer is copied across.          #
 * ####################################################################
 */

export const TWO_PHOTO_ZOOM = {
  /**
   * 129 frames, 4.300s. NOT the 3 seconds his note claims.
   *
   * Measured cut to cut: source frames 500 to 628 inclusive, both boundaries
   * confirmed against a no-seek decode. The frames either side are the
   * pixel-identical separator page that recurs between every animation in the
   * reel and are not part of a4.
   *
   * His "3 seconds" is the MOVEMENT, which really is 2.000s exactly. He times
   * what he can see, and the same was true of a9 and a6.
   */
  totalFrames: 129,

  /**
   * The ramp runs frame 20 to frame 80 inclusive. 60 frames, 2.000s exactly.
   *
   * ##################################################################
   * # FRAMES 20 TO 22 ARE A FITTED EXTRAPOLATION AND ARE SAID SO ON   #
   * # PURPOSE.                                                        #
   * #                                                                 #
   * # A full-frame orange wash white-outs the shot from frame 8,      #
   * # peaking at frame 16, so no card edge is separable before frame  #
   * # 23. A free grid search over the start and end at quarter-frame  #
   * # resolution landed on exactly 20.00 and 80.00.                   #
   * #                                                                 #
   * # It is well supported OUT OF SAMPLE. At frame 23, which the fit  #
   * # never saw, a matched filter measured 0.032349 on both cards and #
   * # the model says 0.032952 — 0.43px of agreement. At frame 27 the  #
   * # first clean measurement is 0.122250 against a predicted        #
   * # 0.122079, 0.12px.                                              #
   * ##################################################################
   */
  rampStartFrame: 20,
  rampEndFrame: 80,

  /**
   * The named CSS `ease`, and it is not a near miss for anything else.
   *
   * ##################################################################
   * # EVERY RIVAL CURVE FAILS BY THREE HUNDRED TIMES, AND THE REASON  #
   * # IS VISIBLE IN THE RAW VELOCITY.                                 #
   * #                                                                 #
   * # RMS residual over 54 clean frames, in pixels of the 720px card: #
   * #                                                                 #
   * #   CSS ease  cubic-bezier(.25,.1,.25,1)      0.156               #
   * #   CSS ease-out (0,0,.58,1)                 53.4                 #
   * #   cubic ease-out 1-(1-t)^3                 73.1                 #
   * #   quintic ease-out                        150.7                 #
   * #   linear                                  152.7                 #
   * #   AE easy-ease (.33,0,.67,1)              154.7                 #
   * #   CSS ease-in-out (.42,0,.58,1)           158.6                 #
   * #                                                                 #
   * # ds/dr RISES from 0.0305 at frame 27 to a PEAK of 0.03817 at     #
   * # frame 33, then decays to 0.0006 by frame 78. It ACCELERATES     #
   * # first, and no ease-out can do that. It is an ease-in-out with a #
   * # very short in and a long out, which is exactly `ease`.          #
   * #                                                                 #
   * # `constants.ts` exports only `easeOut` and `easeIn` and can      #
   * # express neither, so the bezier is solved locally here — the     #
   * # same choice `photoPopClock.ts` made for its spring, and for the #
   * # same reason: `constants.ts` is imported by the compositor, so   #
   * # editing it changes `bundleHash` and invalidates every cached    #
   * # render segment of the client's film.                            #
   * ##################################################################
   */
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },

  card: {
    /**
     * The OUTER white box at full size. Both cards are this size to the pixel.
     *
     * The PICTURE AREA inside the 24px mount is 672 x 378, which is 16:9
     * exactly (672 = 16*42, 378 = 9*42). The outer ratio of 1.690 is not a
     * designed number, it is the picture plus two mounts. So a 16:9 source
     * fills this with NO crop, unlike a9's 3:2 card which crops 13% of width.
     */
    width: 720,
    height: 426,

    /**
     * The mount, and IT SCALES WITH THE CARD. This is the difference from a9
     * most likely to be missed, because a9's 2.2px stroke is fixed.
     *
     * Measured border divided by scale across the ramp: 24.235, 24.133, 24.149,
     * 24.002, 24.145, 24.134 at scales from 0.372 to 1.000. Constant. So the
     * whole card is one uniform transform with the mount inside it, and at half
     * scale the mount really is 12px. A fixed-width border is a twelvefold
     * error at the start of the ramp.
     */
    borderPx: 24,

    /**
     * Square. Corner-pixel coverage measures 0.96 to 0.99, and a radius of even
     * 2px would leave a visible dark wedge. The CHIP below is rounded and the
     * card is not, in the same frame — do not make them agree.
     */
    cornerRadius: 0,

    /**
     * Each card scales about ITS OWN centre, and the centres never move.
     *
     * Held to within 0.05px across all 54 measured ramp frames. Were they
     * scaling about the frame centre, the left centre would have to travel from
     * 960 to 540, and it does not move at all.
     *
     * y = 481 is 59px ABOVE the frame's vertical centre, because the chips hang
     * below. The pair is symmetric about x = 960 to the pixel: 180 + 1740 =
     * 1920 and 900 + 1020 = 1920, with a 120px gap between them.
     */
    leftCentre: { x: 540, y: 481 },
    rightCentre: { x: 1380, y: 481 },
  },

  /**
   * The orange chips.
   *
   * ##################################################################
   * # A CHIP IS NOT A CHILD OF ITS CARD. IT SITS AT A FIXED ABSOLUTE  #
   * # POSITION AND THE CARD GROWS UP TO IT.                           #
   * #                                                                 #
   * # Measured gap from the card's bottom edge to the chip's fixed    #
   * # top: 237px at frame 24, 123 at 40, 68 at 52, 48 at 60, 35 at    #
   * # 72, then 32 from frame 80 on.                                   #
   * #                                                                 #
   * # Parent the chip to the card and it scales with it, which        #
   * # animates the one thing the client explicitly says is static:    #
   * # "the text of the image is static".                              #
   * ##################################################################
   */
  chip: {
    /** Both chips share a top and a bottom; only their widths differ. */
    top: 725.95,
    height: 87.15,

    /** Centred under its own card, to within 0.01px on both. */
    leftCentreX: 540,
    rightCentreX: 1380,

    /**
     * THE CHIP IS SIZED FROM ITS WORDS, NOT FROM ITS CARD.
     *
     * The two cards are both 720px. The two chips measure 388.0 and 408.0, and
     * the 20px difference is accounted for by the 21.1px difference in the ink
     * widths of the two labels. So the width is ink plus padding, and any
     * implementation that ties the chip to the card is drawing a different
     * device.
     */
    paddingX: 33.36,

    /** Cap top to chip top, and baseline to chip bottom. 19.16 + 42.91 + 25.08 = 87.15. */
    paddingTop: 19.16,
    capHeight: 42.91,

    /**
     * Rounded, unlike the card. Best fit 1.71px, bracketed 1.2 to 1.9, so the
     * test pins a RANGE. Corner-pixel coverage is 0.50 to 0.56 against the
     * card's 0.96 to 0.99 in the very same frame and encode, which is the
     * control that makes the difference real rather than an encoding artefact.
     */
    cornerRadius: 2,

    /**
     * The authored source is near #FF6A00 and cannot be recovered exactly from
     * a lossy encode. What IS certain is the DECODED value, rgb(254, 104, 0),
     * taken as the mode over 10,486 pure-fill pixels. Pin the test there.
     */
    fill: '#FF6A00',
    textColour: '#FFFFFF',
  },
} as const

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * A cubic bezier easing, solved by bisection on x.
 *
 * Bisection rather than Newton because it cannot diverge and 30 iterations is
 * exact to about 1e-9, which is nine digits more than a 720px card can show.
 * Speed is irrelevant here: this runs 129 times per clip.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  /*
   * The endpoints are returned exactly rather than solved for.
   *
   * Bisection converges to about 1e-9, which is nine digits finer than a 720px
   * card can show — but it never lands exactly ON an endpoint, so `scale(20)`
   * came back as 2.8e-10 rather than 0. That is invisible in a render and it is
   * still worth removing: "the cards are exactly absent before frame 20" is a
   * claim a test can make, and "the cards are 0.0000002px wide" is not.
   */
  if (x <= 0) return 0
  if (x >= 1) return 1

  const curve = (a: number, b: number, t: number): number => {
    const u = 1 - t
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
  }

  let low = 0
  let high = 1
  let t = x
  for (let i = 0; i < 30; i += 1) {
    t = (low + high) / 2
    if (curve(x1, x2, t) < x) low = t
    else high = t
  }
  return curve(y1, y2, t)
}

/**
 * The cards' shared scale at a frame: 0 before the ramp, 1 after it.
 *
 * ####################################################################
 * # BOTH CARDS SHARE ONE SCALE. THERE IS NO STAGGER.                  #
 * #                                                                   #
 * # Frame by frame the difference between the two stays inside        #
 * # 0.0005 and is mostly inside 0.0002. A lag of even 0.05 frames     #
 * # would cost 0.84px and one whole frame would cost 15.4px. Two      #
 * # independent passes measured this. Do not stagger them.            #
 * ####################################################################
 */
export function twoPhotoZoomScale(frame: number): number {
  const { rampStartFrame, rampEndFrame, ease } = TWO_PHOTO_ZOOM
  const t = clamp01((frame - rampStartFrame) / (rampEndFrame - rampStartFrame))
  return cubicBezier(ease.x1, ease.y1, ease.x2, ease.y2, t)
}

/** One card's box at a frame, in absolute frame pixels. */
export function twoPhotoZoomCard(
  frame: number,
  side: 'left' | 'right',
): { left: number; top: number; width: number; height: number; scale: number } {
  const { card } = TWO_PHOTO_ZOOM
  const scale = twoPhotoZoomScale(frame)
  const centre = side === 'left' ? card.leftCentre : card.rightCentre
  const width = card.width * scale
  const height = card.height * scale

  return {
    left: centre.x - width / 2,
    top: centre.y - height / 2,
    width,
    height,
    scale,
  }
}

/** True once the cards have stopped moving. Frames 80 to 128 are identical. */
export function twoPhotoZoomHasSettled(frame: number): boolean {
  return frame >= TWO_PHOTO_ZOOM.rampEndFrame
}

/**
 * The gap between a card's bottom edge and the chip's fixed top edge.
 *
 * Exported for the test, because this number falling to 32 rather than staying
 * at 32 is the whole proof that the chip is not a child of the card.
 */
export function twoPhotoZoomGapToChip(frame: number): number {
  return TWO_PHOTO_ZOOM.chip.top - (twoPhotoZoomCard(frame, 'left').top + twoPhotoZoomCard(frame, 'left').height)
}
