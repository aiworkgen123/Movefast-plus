import { FRAME_HEIGHT, FRAME_WIDTH } from '../constants.js'

/**
 * The photo pop's clock and geometry, as pure functions of one integer.
 *
 * ####################################################################
 * # THIS MODULE MUST NEVER IMPORT `remotion`.                         #
 * #                                                                   #
 * # Same rule as `framedCardClock.ts` and `warpedGridGeometry.ts`. The        #
 * # `.test.ts` lane runs under `--conditions react-server`, where a   #
 * # `remotion` import dies at the import line with an error that      #
 * # reads nothing like the real cause.                                #
 * ####################################################################
 *
 * WHAT THIS IS. The client's ninth reference animation, at 0:42 of
 * `Templates (Unseperated).mp4`. His own words: *"a landscape photo not full
 * screen ... a blank page, to pop up the photo from the bottom then 1 bounce
 * and slight zoomin"*.
 *
 * IT IS THE ONLY ONE OF HIS NINE THAT CARRIES NO WORDS AT ALL. That is why it
 * was built first: every other candidate would have shown him text a human
 * typed by hand, so his approval would quietly promise a film the pipeline
 * cannot produce. Here what he watches is what the pipeline could make.
 *
 * ####################################################################
 * # EVERY NUMBER BELOW IS A MEASUREMENT AND ITS PROVENANCE IS IN THE  #
 * # COMMENT BESIDE IT.                                                #
 * #                                                                   #
 * # This project has already sent this client an animation built on a #
 * # GUESSED constant. The leader line's dash length was taken as      #
 * # "straight distance x 2" as a safe over-estimate; the true curve   #
 * # was 357.5 and the guess was 657.8, an offset longer than the path #
 * # draws NOTHING, so 45.7% of the draw window was blank. He watched  #
 * # it and said "slightly delay and not smooth". He diagnosed a       #
 * # rounding decision from the picture.                               #
 * #                                                                   #
 * # So: no number here is a choice. Frames were re-extracted at the   #
 * # full 30fps and edges taken as sub-pixel luma crossings.           #
 * ####################################################################
 */

/**
 * ####################################################################
 * # THE EDGE THRESHOLD IS 235 AND IT HAS TO BE STATED.                #
 * #                                                                   #
 * # Every absolute pixel number in this file is a luma-235 crossing.  #
 * # An earlier pass used 200, justified by checking frames with NO    #
 * # card in them — which by construction cannot see the card's own    #
 * # halo. That halo peaks at 205–213 above the top edge, so a 200     #
 * # threshold measures GLOW rather than STROKE. The same card's top   #
 * # edge reads 139.0 at threshold 130, 143.0 at 200 and 144.6 at 235. #
 * #                                                                   #
 * # Nearly every disagreement between measurement passes traced back  #
 * # to this one number, including a rest centre of 538.85 that made   #
 * # the card look 1px off frame centre when it is dead centre.        #
 * ####################################################################
 */
export const PHOTO_POP = {
  /**
   * 120 frames, 4.000s. NOT the 3 seconds the client's note claims.
   *
   * Measured: the shot is absolute source frames 1259 to 1378 inclusive. Frame
   * 1259 is a hard cut from a separator page into the grid (whole-frame
   * difference 9.192 against 0.000 for the nine identical frames before it),
   * and 1379 reverts to that same separator.
   *
   * His stated durations are short for six of his nine animations because he
   * is timing the MOVEMENT, not the shot. The movement here really does finish
   * at 2.03s. The precedent agrees: a6's note says 1.5 seconds, the reference
   * measures 90 frames, and `framedCardClock.ts` renders 90.
   *
   * If 90 is ever forced, TRUNCATE at frame 89 rather than compressing.
   * Truncating loses 0.57% of end grid scale, about 5.5px at the frame edge and
   * invisible, and keeps every frame of the card's motion. Compressing runs the
   * whole background 33.7% fast.
   */
  totalFrames: 120,

  /**
   * The card stops translating here, at exactly 2.0333s, and never moves again.
   *
   * ##################################################################
   * # THE SPRING IS HARD-TRUNCATED AT THIS FRAME AND THE TRUNCATION  #
   * # IS LOAD-BEARING. IT IS NOT A TIDY-UP.                          #
   * #                                                                 #
   * # It buys two things for free. The reference has a real 6.99px    #
   * # one-frame SNAP between frames 60 and 61 — verified on the top   #
   * # edge, the bottom edge and the centre, so it is a rigid          #
   * # translation and not a squash, and verified as a genuine frame   #
   * # rather than a splice by re-decoding with no seek. Cutting the   #
   * # spring here reproduces it with no special case: the model's own #
   * # step is 6.987px.                                                #
   * #                                                                 #
   * # And it SUPPRESSES a second bounce. A free-running spring with   #
   * # these parameters draws a 2.24px undershoot at about frame 76.   #
   * # The reference does not have one, and the client's own word for  #
   * # this animation is "1 bounce". Let the spring run past 61 and    #
   * # you draw a bounce he did not ask for.                           #
   * ##################################################################
   */
  popEndFrame: 61,

  /**
   * A damped second-order spring, fitted to the measured card centre.
   *
   * `zeta` and `omega0` (radians per frame) came from a least-squares fit over
   * frames 13 to 60 with the start frame fixed at 0. RMS residual 0.256px,
   * worst 0.614px, which is the noise floor of a ~3 Mbps h264 source. An
   * independent fit against a DIFFERENT edge definition got 0.7331 and 0.12200,
   * agreeing to five figures.
   *
   * ##################################################################
   * # THE HOUSE CURVE CANNOT DRAW THIS, AND THAT IS WHY A NEW ONE IS  #
   * # DEFINED HERE RATHER THAN IMPORTED.                              #
   * #                                                                 #
   * # `easeOut` in `../constants.js` is 1-(1-t)^3 and cannot overshoot #
   * # AT ALL, so it cannot produce the bounce that is the whole point #
   * # of this device. Fitted over the same span with four free         #
   * # parameters it is 16.9px RMS and 35.6px worst. Quintic is worse.  #
   * #                                                                 #
   * # `framedCardClock.ts` argues at length against adding near-       #
   * # identical easings to the shared file, and it is right. This is   #
   * # the opposite case: not a fourth spelling of ease-out, but a      #
   * # curve the shared file genuinely cannot express.                  #
   * #                                                                 #
   * # It stays LOCAL either way. `constants.ts` is imported by the     #
   * # compositor, so editing it changes `bundleHash` and invalidates   #
   * # every cached render segment of the client's film.                #
   * ##################################################################
   */
  spring: {
    zeta: 0.732,
    omega0: 0.122,
  },

  card: {
    /**
     * Where the card's centre finishes, in geometric pixels where the frame
     * spans 0..1920 and 0..1080. Dead frame centre to within 0.2px: the
     * measured centre at threshold 235 is (959.97, 539.805) with a standard
     * deviation of 0.15px across the 59 settled frames.
     */
    restCentre: { x: 960, y: 539.805 },

    /**
     * How far the centre travels, from 2484.8px at frame 0 down to rest.
     *
     * Only the part from frame 13 is measurable — before that the card is
     * entirely below the bottom of the frame and has no edge. The fit earns the
     * extrapolation by predicting the frame-13 centre having never seen it.
     */
    travel: 1945,

    /**
     * The card's OUTER stroke edge at the landing frame, in pixels.
     *
     * Pinned WITH its frame because the card never stops growing — there is no
     * settled size anywhere in this reference, so a size without a frame number
     * is meaningless.
     *
     * Width over height is 1.5012 on the OUTER edge and 1.5024 on the picture
     * area inside the stroke, so the reference draws its stroke outside a 3:2
     * picture. `PhotoPop.tsx` reproduces that with a BORDER-box border on these
     * outer numbers, which lands the outer edge exactly where it was measured
     * and leaves the inner area at 1.5038 — 0.09% off the measured inner ratio,
     * and about a tenth of a pixel on a 785px card. Sizing the CONTENT to these
     * numbers instead would put the outer edge 4px wide of the measurement,
     * which is the larger of the two errors.
     */
    widthAtLanding: 1179.5,
    heightAtLanding: 785.7,

    /**
     * Two scale rates, not one, and the split is measured rather than tidy.
     *
     * Width is LINEAR in frame, not eased — least-squares residual 0.467px
     * during the pop and 0.340px after. The tail rate is about half the pop
     * rate. Forcing one straight line across the whole clip doubles the
     * residual to 0.821px, which is the evidence that this is two rates.
     */
    scaleRatePop: 0.00015017,
    scaleRateTail: 0.00007724,
  },

  /**
   * The grid's zoom: a fast settle riding on a slow creep.
   *
   * Two independent passes fitted this two-term form to two different
   * quantities — a whole-frame similarity scale and a single-scanline pitch —
   * and recovered the same time constants, 3.20 and 86.0 frames, and the same
   * fast amplitude to within 3%. A single ease-out does not fit it.
   *
   * ##################################################################
   * # THE ZOOM THE EYE READS IS THE BACKGROUND, NOT THE PICTURE.      #
   * # The grid grows 5.7% while the card grows 1.2%, about 4.7 times  #
   * # more. Build the client's "slight zoomin" into the card instead  #
   * # and it looks wrong.                                             #
   * ##################################################################
   *
   * NEITHER TERM REACHES ITS ASYMPTOTE INSIDE THE SHOT. The value at frame 119
   * is 1.0571, and that is where the source file ran out rather than where the
   * zoom was meant to end. Do not quote it as a final scale.
   */
  gridScale: {
    fastAmplitude: 0.0148,
    fastTimeConstant: 3.2,
    slowAmplitude: 0.05645,
    slowTimeConstant: 86,
  },
} as const

/**
 * The card's centre y at a frame.
 *
 * The step response of a damped second-order system, truncated at
 * `popEndFrame`. See the box on `popEndFrame` for why the truncation is the
 * device rather than a rounding of it.
 */
export function photoPopCentreY(frame: number): number {
  const { spring, card, popEndFrame } = PHOTO_POP
  const { zeta, omega0 } = spring

  if (frame >= popEndFrame) return card.restCentre.y

  const decay = Math.exp(-zeta * omega0 * frame)
  const damped = omega0 * Math.sqrt(1 - zeta * zeta)
  const phase =
    Math.cos(damped * frame) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(damped * frame)

  return card.restCentre.y + card.travel * decay * phase
}

/**
 * The card's scale at a frame, where 1.0 is its size at the LANDING frame.
 *
 * The reference frame has to be named or every scale number here is
 * meaningless, because the card is still growing on the last frame that exists.
 */
export function photoPopCardScale(frame: number): number {
  const { card, popEndFrame } = PHOTO_POP

  if (frame >= popEndFrame) {
    return 1 + (frame - popEndFrame) * card.scaleRateTail
  }
  return 1 - (popEndFrame - frame) * card.scaleRatePop
}

/** The grid's scale at a frame, about the FRAME centre. 1.0 at frame 0. */
export function photoPopGridScale(frame: number): number {
  const { fastAmplitude, fastTimeConstant, slowAmplitude, slowTimeConstant } = PHOTO_POP.gridScale

  return (
    1 +
    fastAmplitude * (1 - Math.exp(-frame / fastTimeConstant)) +
    slowAmplitude * (1 - Math.exp(-frame / slowTimeConstant))
  )
}

/**
 * Everything the component needs to draw the card on one frame.
 *
 * One function rather than four, so the width, the height and the top edge can
 * never be computed from different scales by accident. The photograph is
 * RIGIDLY PINNED to the card — measured by resampling the card interior onto a
 * fixed grid and matching against the landing frame, where the content offset
 * never exceeds 0.75px and its sign alternates, so it is resampling noise. Any
 * Ken Burns move inside the picture is wrong.
 */
export function photoPopCard(frame: number): {
  width: number
  height: number
  left: number
  top: number
  centreY: number
  scale: number
} {
  const { card } = PHOTO_POP
  const scale = photoPopCardScale(frame)
  const width = card.widthAtLanding * scale
  const height = card.heightAtLanding * scale
  const centreY = photoPopCentreY(frame)

  return {
    width,
    height,
    left: card.restCentre.x - width / 2,
    top: centreY - height / 2,
    centreY,
    scale,
  }
}

/** True while any part of the card is inside the frame. */
export function photoPopCardIsVisible(frame: number): boolean {
  const { top, height } = photoPopCard(frame)
  return top < FRAME_HEIGHT && top + height > 0
}

/** The frame is 1920x1080 and the card is authored against it. */
export const PHOTO_POP_FRAME = { width: FRAME_WIDTH, height: FRAME_HEIGHT } as const
