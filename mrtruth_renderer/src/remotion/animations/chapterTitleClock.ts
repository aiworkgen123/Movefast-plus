/**
 * a3, the chapter title card: timing, measured off the client's own frames.
 *
 * Pure. No remotion import, so every number here is checkable in the fast test
 * lane, the same shape as `photoPopClock.ts` and `twoPhotoZoomClock.ts`.
 *
 * ####################################################################
 * # PROVENANCE. Measured on tmp/anim/a3-30, which is the client's own #
 * # `Templates (Unseperated).mp4` re-extracted at 1920x1080 and the   #
 * # true 30fps. a3 owns SOURCE FRAMES 330..479 inclusive, so local    #
 * # frame f here is source frame 330 + f.                             #
 * #                                                                   #
 * # HIS BRIEF SAYS 0:10 AND IT IS WRONG. The device starts at source  #
 * # frame 330, which is 11.000s. The 41 frames before it are a wavy   #
 * # separator plate that also appears in front of a5, so anyone       #
 * # measuring off a padded window lands a second and a third early.   #
 * #                                                                   #
 * # HIS "takes 5 seconds" IS EXACTLY RIGHT: 330..479 is 150 frames.   #
 * # His "zoom out for 1 second" is wrong by 1.5s -- see ZOOM below.   #
 * ####################################################################
 */

/** a3 is 150 frames at 30fps, so the last frame index is 149. */
export const CHAPTER_TITLE_LAST_FRAME = 149

/** The scale the grid sits at when the zoom is at rest. Absolute, not relative. */
export const CHAPTER_TITLE_BASE_SCALE = 1.15

/**
 * The zoom, as a pinned per-frame table rather than a curve.
 *
 * ####################################################################
 * # WHY A TABLE AND NOT A BEZIER.                                     #
 * #                                                                   #
 * # The best in-gamut closed form is cubic-bezier(0.55, 0, 0.30, 1)   #
 * # over 53.5 frames, and it still leaves 0.83px rms and 1.56px worst #
 * # of grid displacement at the frame corner. This project holds      #
 * # itself to 0.41px on grid geometry, so the curve is documentation  #
 * # and the table is the build.                                       #
 * #                                                                   #
 * # IT GOES UP AND COMES BACK. The second half is the first half      #
 * # time-reversed about frame 75. Reading his "5 seconds in, 1 second #
 * # out" literally produces a visibly different film: the reference   #
 * # spends 2.5s going up and 2.5s coming down.                        #
 * #                                                                   #
 * # MEASURED THREE TIMES AND THEY DO NOT ALL AGREE. Peak relative     #
 * # scale came out 1.205526, 1.206968 and 1.209991 by three different #
 * # routes — a spread of 0.37%, which is about 5px at the frame       #
 * # corner and therefore ABOVE this project's own 0.41px standard.    #
 * #                                                                   #
 * # The table below is the third, taken because it was the most       #
 * # thorough (three independent routes agreeing to 6e-5, including a  #
 * # per-frame fit against the repo's OWN exported Bezier artwork) and #
 * # because it was symmetrised about the mirror axis, which is itself #
 * # established at 0.0001 rms. THE SPREAD IS RECORDED RATHER THAN     #
 * # HIDDEN: if a render disagrees with his frames, this is the first  #
 * # number to re-measure.                                             #
 * ####################################################################
 *
 * Values are RELATIVE to `CHAPTER_TITLE_BASE_SCALE`. Multiply to get the
 * absolute scale, which runs 1.150000 -> 1.386 -> 1.150.
 */
export const CHAPTER_TITLE_ZOOM: readonly number[] = [
  1.000000, 1.000035, 1.000083, 1.000287, 1.000504, 1.001052,
  1.001674, 1.002630, 1.003891, 1.005500, 1.007521, 1.009617,
  1.012899, 1.016291, 1.020256, 1.024738, 1.029851, 1.035568,
  1.041881, 1.048841, 1.056519, 1.064880, 1.073888, 1.083557,
  1.093961, 1.105043, 1.115995, 1.126055, 1.135220, 1.143572,
  1.151215, 1.158124, 1.164354, 1.170023, 1.175075, 1.179579,
  1.183649, 1.187288, 1.190479, 1.193296, 1.195800, 1.197957,
  1.199852, 1.201487, 1.202882, 1.204139, 1.205191, 1.206026,
  1.206817, 1.207413, 1.207956, 1.208352, 1.208721, 1.208987,
  1.209239, 1.209417, 1.209569, 1.209687, 1.209800, 1.209847,
  1.209900, 1.209926, 1.209943, 1.209943, 1.209973, 1.209978,
  1.209982, 1.209987, 1.209991, 1.209991, 1.209991, 1.209991,
  1.209991, 1.209991, 1.209991, 1.209991, 1.209991, 1.209991,
  1.209991, 1.209991, 1.209991, 1.209991, 1.209991, 1.209987,
  1.209982, 1.209978, 1.209973, 1.209943, 1.209943, 1.209926,
  1.209900, 1.209847, 1.209800, 1.209687, 1.209569, 1.209417,
  1.209239, 1.208987, 1.208721, 1.208352, 1.207956, 1.207413,
  1.206817, 1.206026, 1.205191, 1.204139, 1.202882, 1.201487,
  1.199852, 1.197957, 1.195800, 1.193296, 1.190479, 1.187288,
  1.183649, 1.179579, 1.175075, 1.170023, 1.164354, 1.158124,
  1.151215, 1.143572, 1.135220, 1.126055, 1.115995, 1.105043,
  1.093961, 1.083557, 1.073888, 1.064880, 1.056519, 1.048841,
  1.041881, 1.035568, 1.029851, 1.024738, 1.020256, 1.016291,
  1.012899, 1.009617, 1.007521, 1.005500, 1.003891, 1.002630,
  1.001674, 1.001052, 1.000504, 1.000287, 1.000083, 1.000035,
]

/** The absolute scale of the whole scene -- grid AND type -- at a local frame. */
export function chapterTitleScale(frame: number): number {
  const clamped = Math.min(Math.max(Math.round(frame), 0), CHAPTER_TITLE_LAST_FRAME)
  const relative = CHAPTER_TITLE_ZOOM[clamped] ?? 1
  return CHAPTER_TITLE_BASE_SCALE * relative
}

/**
 * The per-character entry: a critically damped spring, not an exponential.
 *
 * ####################################################################
 * # THE ZERO-VELOCITY START IS THE WHOLE SIGNATURE, AND A PURE        #
 * # EXPONENTIAL GETS IT WRONG BY UP TO 78px ON THE FIRST TWO FRAMES.  #
 * #                                                                   #
 * # Fitted per glyph across all thirteen characters: the spring gives #
 * # 0.40-1.11px rms, the exponential 4.03-6.50px. Six times worse on  #
 * # the same data.                                                     #
 * #                                                                   #
 * # AND IT DOES NOT ROTATE OR GROW. At 6fps the entry reads as a      #
 * # rotating, swelling wave and it is neither: unscaled by the zoom,  #
 * # every glyph holds its size to 0.3% and its angle to 0.2 degrees   #
 * # for all 150 frames. A threshold-based measurement manufactures a  #
 * # fake growth by truncating the faint early frames, which caught    #
 * # the measuring pass too.                                            #
 * ####################################################################
 */
export const CHAPTER_TITLE_SPRING = {
  /** How far below its rest position a character starts, in base units. */
  riseBaseUnits: 349.78,
  /**
   * Decay rate per frame, for BOTH the rise and the opacity. tau = 2.99 frames.
   *
   * The two fit 0.3336 and 0.3401, two percent apart and indistinguishable at
   * this bitrate. An earlier note put the opacity at 0.308 and 8% below the
   * position; that figure is wrong and should not be quoted as an alternative.
   */
  w: 0.334,
  /**
   * Frames between one DRAWN character's onset and the next.
   *
   * ####################################################################
   * # THE SPACE IS SKIPPED, NOT SLOTTED, AND THE FIRST MEASUREMENT OF  #
   * # THIS ANIMATION SAID THE OPPOSITE.                                #
   * #                                                                   #
   * # That pass fitted onset, amplitude and decay independently per    #
   * # glyph and read the r-to-T gap as 1.25 frames against a within-   #
   * # word 0.68, which is exactly what a consumed slot looks like.     #
   * #                                                                   #
   * # A second, adversarial pass cross-correlated each glyph's own     #
   * # opacity curve against the first glyph's on a 0.005-frame grid —  #
   * # a direct measurement rather than three coupled free parameters — #
   * # and got 0.725 for r-to-T against 0.615 to 0.900 within words.    #
   * # No slot. The totals barely differ (8.19 frames against 8.22),    #
   * # which is why the wrong law fitted so well; only WHERE the gap    #
   * # falls distinguishes them.                                        #
   * #                                                                   #
   * # SO INDEX BY POSITION AMONG DRAWN GLYPHS, NOT IN THE STRING.      #
   * # `ChapterTitle.tsx` passes a running non-space counter.           #
   * ####################################################################
   */
  staggerFrames: 0.747,
  /** The first character's onset, in local frames. */
  firstOnsetFrame: 0,
} as const

/**
 * How far below rest a character sits, in base units, at a local frame.
 *
 * `index` is the position among the DRAWN glyphs. A space is skipped rather
 * than slotted — see the box on `staggerFrames`, where the first measurement of
 * this animation got it the other way round.
 */
export function chapterTitleGlyphRise(frame: number, index: number): number {
  const { riseBaseUnits, w, staggerFrames, firstOnsetFrame } = CHAPTER_TITLE_SPRING
  const t = frame - (firstOnsetFrame + staggerFrames * index)
  if (t <= 0) return riseBaseUnits
  return riseBaseUnits * (1 + w * t) * Math.exp(-w * t)
}

/**
 * A character's opacity at a local frame: the same spring, inverted.
 *
 * It is a genuine fade rather than a mask reveal -- the ink itself is
 * translucent, measured at 0.059 alpha on a character's second frame.
 *
 * The opacity fit gives w = 0.308 against the position's 0.3331, an 8% gap
 * that sits inside the measurement's own 2% systematic. One w is used for both
 * until a render says otherwise.
 */
export function chapterTitleGlyphOpacity(frame: number, index: number): number {
  const { w, staggerFrames, firstOnsetFrame } = CHAPTER_TITLE_SPRING
  const t = frame - (firstOnsetFrame + staggerFrames * index)
  if (t <= 0) return 0
  return 1 - (1 + w * t) * Math.exp(-w * t)
}

/**
 * The type block, in base units -- the coordinate space of the grid at scale 1.
 *
 * The words live INSIDE the zoom group, so they are scaled by the same
 * transform as the lines. Every other animation in this folder draws its type
 * in screen space over a moving background, which is the opposite.
 */
export const CHAPTER_TITLE_TYPE = {
  /** Cap height in base units. On screen this is 106.21 at rest, 128.5 at peak. */
  capHeightBaseUnits: 92.36,
  /** Baseline, base units from the top of the frame. */
  baselineBaseUnits: 583.63,
  /** The block is centred to within 0.8px of the frame centre. */
  centreXBaseUnits: 960,
  colour: '#FFFFFF',
  background: '#000000',
  /**
   * ####################################################################
   * # A KNOWN 0.84% SHORTFALL, RECORDED RATHER THAN TUNED AWAY.        #
   * #                                                                   #
   * # Rendered and compared against his frame 405: our block measures   #
   * # 1063px against his 1072, nine pixels narrow over twelve glyphs.   #
   * #                                                                   #
   * # It is NOT the face. Matched glyph for glyph, ours are 3.17px      #
   * # WIDER on average, and the widest gaps are on the thin letters     #
   * # (t +8, r +10) — which is h264 eating thin white stems in HIS      #
   * # video, not our type being wrong. The difference is in the gaps.   #
   * #                                                                   #
   * # Closing it needs about 0.005em of letter-spacing. That is         #
   * # sub-pixel per gap and derived from one thresholded measurement,   #
   * # so applying it would be fitting to noise. a5's spacing WAS        #
   * # measured properly (0.020em and 0.040em) and is applied; a3's has  #
   * # never been measured and is left at zero.                          #
   * #                                                                   #
   * # Nine pixels on 1072 is not visible. Do not chase it without a     #
   * # reason from him.                                                  #
   * ####################################################################
   */
  knownWidthShortfallPx: 9,
} as const
