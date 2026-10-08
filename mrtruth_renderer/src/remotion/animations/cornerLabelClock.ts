/**
 * `corner-label`, his "text overlay 6.0": geometry, type and the type-on clock.
 *
 * ####################################################################
 * # THIS MODULE IMPORTS NOTHING, which is the rule every other clock  #
 * # in this folder keeps — `chapterTitleClock.ts`, `nameCardClock.ts`,#
 * # `topTitleClock.ts`, `chapterPlateClock.ts`. The `.test.ts` lane   #
 * # resolves differently from the DOM lane, and a `remotion` import   #
 * # here dies at the import line with an error that reads nothing     #
 * # like the real cause. Importing nothing at all is stronger still.  #
 * #                                                                   #
 * # THE PRICE IS THAT `FRAME_WIDTH` AND `SAFE_AREA_X` CANNOT BE READ  #
 * # HERE. They are passed IN — see `cornerLabelTitleSafeWidthPx` — so #
 * # the title-safe band stays DERIVED from the compositor's own two   #
 * # constants and is never retyped as 1728.                           #
 * ####################################################################
 *
 * ####################################################################
 * # PROVENANCE. Everything below is measured off the client's own     #
 * # clip, `text overlay 6.0`, through                                 #
 * #                                                                   #
 * #   tmp/v53/overlays/SPEC-measured.md          section 3            #
 * #   tmp/v53/overlays/measure/timing.json       ov6                  #
 * #   tmp/v53/overlays/measure/ov6/f0001..f0211  the frames themselves #
 * #                                                                   #
 * # HIS CLIP IS 1920x1080 AT 60 fps AND THE FILM IS 30. Every frame   #
 * # count that comes out of it is halved here, ONCE, at               #
 * # `SOURCE_FRAMES_PER_FILM_FRAME`, so no reader has to remember to   #
 * # do it and no second place can forget. Seconds are invariant and   #
 * # are quoted beside each frame number as the cross-check.           #
 * #                                                                   #
 * # AND HIS CLIP IS 30 fps CONTENT IN A 60 fps CONTAINER. Tracked     #
 * # frame by frame, every ink count repeats for exactly two           #
 * # consecutive source frames through the whole build (f0059 = f0060, #
 * # f0061 = f0062, and so on to the end). That is independent         #
 * # evidence for the halving rather than an assumption about it, and  #
 * # it is the same thing `topTitleClock.ts` found in `ov5`.           #
 * #                                                                   #
 * # HIS CLIP IS 1920x1080, WHICH IS THE FILM'S OWN FRAME, so every    #
 * # POSITION below is a film pixel already and only the frame counts  #
 * # need converting.                                                  #
 * ####################################################################
 *
 * ####################################################################
 * # THE SPEC'S SECTION 3 TIMINGS DESCRIBE THE LABEL LINE ONLY, AND    #
 * # `timing.json` DESCRIBES BOTH. They disagree, and neither is       #
 * # wrong:                                                            #
 * #                                                                   #
 * #   SPEC-measured.md   starts 1.00s, settles 1.80s, build 0.80s     #
 * #   timing.json ov6    onset 1.000s, settle 2.567s, build 1.567s    #
 * #                                                                   #
 * # Re-measured here per band. The LABEL's first character lands at   #
 * # source frame 58 (0.967s) and its last at source frame 106         #
 * # (1.767s) — which is the spec's pair, and its 0.80s build is EXACT.#
 * # The KICKER does not begin until source frame 130 (2.167s) and its #
 * # last character lands at source frame 166 (2.767s), which is the   #
 * # tail `timing.json` is measuring.                                  #
 * #                                                                   #
 * # SO BOTH LINES ARE CLOCKED HERE, and the consequence for the       #
 * # registry is written on `cornerLabelSettleFrame` below.            #
 * ####################################################################
 */

/** His clip's fps over the film's. Every source frame count is divided by it. */
const SOURCE_FRAMES_PER_FILM_FRAME = 2

/* ------------------------------------------------------------- the face -- */

/**
 * Libre Franklin's ascender and descender over the em, read out of the shipped
 * `apps/web/public/fonts/LibreFranklin-Variable.woff2` rather than off a
 * specimen: `hhea` 966 and -246 on a 1000 unit em, which `OS/2` repeats as
 * `sTypoAscender` and `sTypoDescender` with `USE_TYPO_METRICS` set, so there is
 * no ambiguity about which pair a browser takes.
 *
 * The two static cuts on disk carry the identical pair, so this device's two
 * weights — 800 out of the variable file, 500 out of `LibreFranklin-Medium` —
 * share one baseline law rather than needing one each.
 */
const FACE_ASCENDER_OVER_EM = 0.966
const FACE_DESCENDER_OVER_EM = 0.246

/**
 * Where the baseline sits inside a `line-height: 1` box, as a fraction of the
 * font size. DERIVED, not typed.
 *
 * ####################################################################
 * # `top = baseline - fontSize` IS WRONG AND IT HAS SHIPPED ONCE.     #
 * #                                                                   #
 * # With `line-height: 1` the line box is one em tall, but the FACE   #
 * # is taller. Libre Franklin's ascender plus descender is 1.212em.   #
 * # CSS centres the overflow, so the half-leading is negative and the #
 * # baseline lands at (1 - 1.212) / 2 + 0.966 = 0.860em from the top, #
 * # not at 1.000em. Positioning by `baseline - fontSize` puts the     #
 * # label 0.140em = 10.2px too HIGH and the kicker 6.6px too high.    #
 * #                                                                   #
 * # 0.888 IS NOT THIS FACE'S NUMBER. That one is in `bodyFace.ts` and #
 * # it is NOTO SANS's, carried there for `name-card`. The figure is a #
 * # property of the face's own vertical metrics, so it is derived     #
 * # here from Libre Franklin's. `topTitleClock.ts` made the same      #
 * # derivation and landed on the same 0.860 until 2026-09-17, when    #
 * # that device moved to Noto Sans Bold and 0.888.                    #
 * ####################################################################
 */
export const CORNER_LABEL_BASELINE_OVER_EM =
  (1 - (FACE_ASCENDER_OVER_EM + FACE_DESCENDER_OVER_EM)) / 2 + FACE_ASCENDER_OVER_EM

/**
 * The fraction of the em that Libre Franklin's capitals occupy.
 *
 * ####################################################################
 * # 0.742, READ FROM THE SHIPPED FACE, AND IT IS DELIBERATELY NOT     #
 * # `OVERLAY.fullFrame.capEm`'s 0.756. The two measure DIFFERENT      #
 * # THINGS and mixing them sets this device's type 1.9% small.        #
 * #                                                                   #
 * #   0.742  `OS/2.sCapHeight` of `LibreFranklin-Variable.woff2`,     #
 * #          which the H, B, E, K, N, F, T, D, R and 1 outlines all   #
 * #          agree with exactly, at the 500 instance AND at the 800.  #
 * #          It is the FLAT CAP LINE.                                 #
 * #   0.752  the same outlines' round overshoot — O, C, S, 3.         #
 * #   0.756  `OVERLAY_CAP_EM` in `constants.ts`, measured off a       #
 * #          RENDERED PNG of "1947". Lining figures are round, so     #
 * #          that number is the overshoot plus the antialias spill.   #
 * #                                                                   #
 * # WHAT WAS MEASURED HERE IS THE FLAT CAP LINE — the H at the end of #
 * # his label, whose top and bottom are both flat — so it must be     #
 * # divided by the flat fraction. Dividing it by 0.756 would ask for  #
 * # 72px and draw a 53.4px cap against his 54.27px.                   #
 * #                                                                   #
 * # `CornerLabel.mount.test.tsx` pins the derived sizes back against  #
 * # the measured cap heights, so the pair cannot drift apart.         #
 * ####################################################################
 */
export const CORNER_LABEL_CAP_OVER_EM = 0.742

/* ------------------------------------------------- geometry and the type -- */

/**
 * Measured on the settled frames of `measure/ov6` — f0167 onwards, where the
 * ink count and both bounding boxes stop changing — by thresholding on the text
 * colour and then taking sub-pixel edges from the coverage profile of a glyph
 * that is flat at top and bottom.
 *
 *     band      threshold bbox            flat glyph      cap top   baseline
 *     label     x 1250..1882 y 210..265   the final H     210.68    264.95
 *     kicker    x 1246..1493 y 290..325   the T of 1ST    290.33    324.89
 *
 * Every one of those bbox figures held across thresholds of 16, 28, 45, 60 and
 * 80 in max-channel distance. `raw.json` records no bbox for `ov6` at all — its
 * `whitePixelsLastFrame` is 0, because this overlay leaves the frame 14 source
 * frames before the clip ends — so the numbers here come from the settled
 * frames rather than from the last one, and `timing.json` agrees with them.
 *
 * ####################################################################
 * # THE TWO LINES SHARE A LEFT EDGE, WHICH IS WHAT MAKES THIS A       #
 * # LEFT-ALIGNED BLOCK ANCHORED ON ITS RIGHT rather than two          #
 * # right-aligned lines. His label runs x 1250..1882 and his kicker   #
 * # x 1246..1493: the left edges agree to 4px, which is the           #
 * # difference between a B's and a 3's left side bearing, and the     #
 * # right edges are 389px apart. Right-aligning the kicker would put  #
 * # it under the END of the label, which is not his frame.            #
 * ####################################################################
 */
export const CORNER_LABEL_TYPE = {
  /** The warm off-white all four of his 2026-09-14 overlays share, never white. */
  colour: '#FDFAE7',

  /**
   * 1, and `CORNER_LABEL_BASELINE_OVER_EM` above is derived for EXACTLY this
   * value. The half-leading that puts the baseline at 0.860em is
   * `(1 - 1.212) / 2`, and the leading `1` in that expression is this. Change
   * one and the other is wrong, silently, in a way no test here can see.
   */
  lineHeight: 1,

  label: {
    /**
     * The flat cap height in film pixels, sub-pixel, off the final H.
     *
     * Its coverage profile against an almost-black ground runs 0.39 at row 210,
     * 0.94 at 211, solid through 263, 0.83 at 264 and 0.13 at 265, which sums
     * to 54.28 rows and centres at 237.8 — so cap top 210.68, baseline 264.95.
     */
    capHeightPx: 54.27,

    /**
     * The baseline, in film pixels from the top of the frame.
     *
     * AN ABSOLUTE BASELINE, not a line height, which is what makes the empty
     * `kicker` case free: the label cannot move, because nothing about its
     * position is expressed relative to the kicker. `topTitleClock.ts` and
     * `nameCardClock.ts` both place their two lines this way.
     *
     * 264.95 is 0.05px off the integer 265 and the kicker's 324.89 is 0.11px
     * off 325, which is well inside the noise of a compressed 60fps clip — so
     * an author who typed two round numbers 60px apart would produce exactly
     * this. The MEASUREMENT is kept rather than the guess at the intent.
     */
    baselinePx: 264.95,

    /** 800. `fonts.ts` registers 300, 500, 600 and 800 for this family, no more. */
    fontWeight: 800,
  },

  kicker: {
    /**
     * The flat cap height, off the T of "1ST" — flat bar on top, flat stem foot
     * on the baseline. 34.56 rows, cap top 290.33, baseline 324.89.
     */
    capHeightPx: 34.56,
    baselinePx: 324.89,

    /**
     * 500, and it is a REAL instance rather than a synthesised fake.
     * `fonts.ts` registers it from `LibreFranklin-Medium.woff2`. 400 and 700
     * are not registered for this family and would both be browser-synthesised
     * weights that nobody has reviewed — and `loadEverything` fails SOFT, so
     * nothing would go red.
     */
    fontWeight: 500,
  },
} as const

/**
 * The label's size, DERIVED FROM THE CAP HEIGHT, never typed as a font size.
 *
 * What was measured is drawn letters; `fontSize` is an em box that no glyph
 * fills. 54.27 / 0.742 = 73.14, so 73, which draws a 54.17px cap against his
 * 54.27px. The same derivation as `OVERLAY_FULL_FRAME_FONT_SIZE` in
 * `constants.ts` and as `topTitleClock.ts`.
 */
export const CORNER_LABEL_LABEL_FONT_SIZE_PX = Math.round(
  CORNER_LABEL_TYPE.label.capHeightPx / CORNER_LABEL_CAP_OVER_EM,
)

/** The kicker's, the same way. 34.56 / 0.742 = 46.58, so 47. */
export const CORNER_LABEL_KICKER_FONT_SIZE_PX = Math.round(
  CORNER_LABEL_TYPE.kicker.capHeightPx / CORNER_LABEL_CAP_OVER_EM,
)

/* ------------------------------------------------------- the label's fit -- */

/**
 * What his own label line measures, and what Libre Franklin 800 would set it
 * at. The difference is spread over the gaps as tracking.
 *
 * ####################################################################
 * # HIS KICKER IS LIBRE FRANKLIN 500 TO WITHIN A PIXEL AND HIS LABEL  #
 * # IS 3% WIDER THAN LIBRE FRANKLIN 800. That asymmetry is the whole  #
 * # reason there is a tracking number here and only on one line.      #
 * #                                                                   #
 * #   kicker  "3RD-1ST C." at 47px draws 249.5px of ink by the face's #
 * #           own advances; his measures about 248, which is the      #
 * #           threshold trimming its own antialiased edges. Laid out  #
 * #           glyph by glyph against his nine ink groups it lands     #
 * #           within 2.9px at every one, with NO cumulative drift.    #
 * #           So: same face, same weight, NO TRACKING.                #
 * #                                                                   #
 * #   label   "BOOK OF ENOCH" at 73px draws 615.7px by the same       #
 * #           advances; his measures 634.17px sub-pixel, 18.4px wider.#
 * #           With no tracking the drift accumulates monotonically to #
 * #           -18px by the final H. With the tracking below it is     #
 * #           within 6.7px at every glyph and lands on his H to 0.1px.#
 * ####################################################################
 *
 * ####################################################################
 * # THE OTHER READING, RECORDED RATHER THAN SETTLED QUIETLY. The      #
 * # residual is not flat — his O positions sit within a pixel while   #
 * # his F, E and C are up to 6.7px out — so his label face may simply #
 * # be a slightly wider grotesque than Libre Franklin rather than a   #
 * # tracked one. BOTH READINGS ASK FOR THE SAME CORRECTION, because   #
 * # both are "this line draws 3% wider than our advances say", and a  #
 * # per-gap step is the only one of the two that CSS can express.     #
 * #                                                                   #
 * # IT IS A WIDTH CORRECTION AND NOT A CLAIM THAT HIS LETTERS ARE     #
 * # TRACKED. Setting it to 0 costs 18px of line width and nothing     #
 * # else — no cap height moves, because the size is pinned on the cap #
 * # height and tracking cannot touch it. That is the one thing        #
 * # `topTitleClock.ts` could NOT do for `ov5` while it was set in     #
 * # Libre Franklin, where matching the width would have put the cap   #
 * # height 7px over his. Re-measured on 2026-09-17 it is Noto Sans    #
 * # Bold, which matches his width and his cap height together.        #
 * ####################################################################
 */
export const CORNER_LABEL_LABEL_FIT = {
  /**
   * His drawn ink, sub-pixel, from the left edge of the B's left stem to the
   * right edge of the H's right stem: 1249.36 to 1883.53.
   */
  measuredInkWidthPx: 634.17,

  /**
   * What Libre Franklin 800 sets the same string at, per em: the sum of the
   * advances for "BOOK OF ENOCH" (8556 units on a 1000 unit em, read out of the
   * shipped variable face at the 800 instance) less the B's left side bearing
   * (60.53) and the H's right side bearing (60.61), because a side bearing is
   * not ink.
   */
  naturalInkWidthOverEm: (8556 - 60.53 - 60.61) / 1000,

  /**
   * The gaps his sample has: 13 characters, so 12 of them. A per-gap step is
   * what `letter-spacing` actually is, which is why the division is by 12 and
   * not by 13.
   */
  sampleGaps: 12,
} as const

/**
 * The label's tracking in film pixels, derived from the two widths above.
 *
 * (634.17 - 8.43486 * 73) / 12 = 1.535px, which is 0.0210em.
 */
export const CORNER_LABEL_LABEL_TRACKING_PX =
  (CORNER_LABEL_LABEL_FIT.measuredInkWidthPx -
    CORNER_LABEL_LABEL_FIT.naturalInkWidthOverEm * CORNER_LABEL_LABEL_FONT_SIZE_PX) /
  CORNER_LABEL_LABEL_FIT.sampleGaps

/**
 * The margin that cancels `letter-spacing`'s TRAILING step on the label.
 *
 * ####################################################################
 * # `letter-spacing` IS APPLIED AFTER EVERY CHARACTER INCLUDING THE   #
 * # LAST, so the line's box is one whole step wider than the glyphs   #
 * # inside it. This block is anchored by its RIGHT edge, so that      #
 * # trailing 1.535px would push every glyph 1.535px left of the       #
 * # anchor, and nothing about that looks wrong enough to catch.       #
 * #                                                                   #
 * # `constants.ts` documents the identical trap on                    #
 * # `OVERLAY.fullFrame.letterSpacingEm`, where a centred box landed   #
 * # its glyphs half a step right of the frame centre, and it fixes it #
 * # the same way: an equal and opposite margin. This is that fix on a #
 * # right edge rather than a centre, so it is the whole step.         #
 * ####################################################################
 */
export const CORNER_LABEL_LABEL_TRACKING_CANCEL_PX = -CORNER_LABEL_LABEL_TRACKING_PX

/* --------------------------------------------------------- the placement -- */

/**
 * The top of the BLOCK, which is the top of the label's `line-height: 1` box,
 * placed so the label's baseline lands where it was measured.
 *
 * See the box on `CORNER_LABEL_BASELINE_OVER_EM`: this is not
 * `baseline - fontSize`, and the difference is 10px of ink in the wrong place.
 */
export const CORNER_LABEL_BLOCK_TOP_PX =
  CORNER_LABEL_TYPE.label.baselinePx -
  CORNER_LABEL_LABEL_FONT_SIZE_PX * CORNER_LABEL_BASELINE_OVER_EM

/**
 * The gap between the label's line box and the kicker's, so that the kicker's
 * baseline lands on ITS measurement.
 *
 * The label's box is `fontSize` tall at `line-height: 1`, so it ends at
 * `blockTop + 73`. The kicker's own box has to start far enough down that
 * `kickerTop + 47 * 0.860` is 324.89. 284.47 - 275.17 = 9.30px.
 *
 * ####################################################################
 * # EXPRESSED AS A GAP BETWEEN THE BOXES, NOT AS A SECOND ABSOLUTE    #
 * # `top`, because the kicker is a FLOW child of the block: it has to #
 * # be, or it could not widen the block on the day it is the longer   #
 * # line. The arithmetic is still driven by the two measured          #
 * # baselines, and `CornerLabel.mount.test.tsx` adds it back up and   #
 * # checks that it lands on 324.89.                                   #
 * #                                                                   #
 * # AN OMITTED KICKER CANNOT MOVE THE LABEL, because the label is     #
 * # first in flow and this gap belongs to the kicker's own block.     #
 * ####################################################################
 */
export const CORNER_LABEL_KICKER_GAP_PX =
  CORNER_LABEL_TYPE.kicker.baselinePx -
  CORNER_LABEL_KICKER_FONT_SIZE_PX * CORNER_LABEL_BASELINE_OVER_EM -
  (CORNER_LABEL_BLOCK_TOP_PX + CORNER_LABEL_LABEL_FONT_SIZE_PX)

/**
 * His measured right margin, kept ONLY so that the number this device does NOT
 * use is on the record beside the one it does.
 *
 * `SPEC-measured.md` flags it itself: "right edge lands 38px from frame edge.
 * That is inside the title-safe margin this project uses everywhere else."
 * 1920 - 1882 = 38, against a `SAFE_AREA_X` of 96.
 */
export const CORNER_LABEL_HIS_RIGHT_MARGIN_PX = 1920 - 1882

/**
 * The title-safe band, DERIVED from the compositor's own two constants and
 * never typed as 1728.
 *
 * `frameWidth - 2 * safeAreaX` is the same derivation `constants.ts`,
 * `captions.test.ts` and `ChapterPlate.tsx` all make. The 2 is one margin on
 * each side, not a measurement. It lives in this module rather than in the
 * component so that the component carries no literal at all, and it takes its
 * two inputs as arguments because this module imports nothing.
 */
export function cornerLabelTitleSafeWidthPx(frameWidth: number, safeAreaX: number): number {
  return frameWidth - 2 * safeAreaX
}

/**
 * The inset of the inner block inside the title-safe box: none, on both axes.
 *
 * It is STRUCTURE AND NOT A MEASUREMENT — the block sits ON the title-safe
 * box's top-right corner — and it lives here only so that `CornerLabel.tsx` can
 * keep its promise of containing no number of its own.
 */
export const CORNER_LABEL_INNER_CORNER_INSET_PX = 0

/* --------------------------------------------------------- the ground -- */

/**
 * ##########################################################################
 * # THIS DEVICE HAS NO WASH, AND THIS SECTION HELD EIGHT EXPORTS FOR ONE     #
 * # DAY. THEY ARE RECORDED HERE RATHER THAN DELETED IN SILENCE, BECAUSE      #
 * # EVERY ONE OF THEM WAS WRITTEN AGAINST A DEFECT SOMEBODY MEASURED.        #
 * #                                                                        #
 * #   CORNER_LABEL_WASH_PLATEAU_TOP_PX     the ink's own cap row            #
 * #   CORNER_LABEL_WASH_PLATEAU_BOTTOM_PX  the kicker's baseline            #
 * #   cornerLabelWashFadeInPx              one margin above the caps        #
 * #   cornerLabelWashFadeOutPx             one margin below the kicker      #
 * #   CORNER_LABEL_WASH_SIDE_MARGINS       three, because one read as an    #
 * #                                        edge — 140 grey levels in 150px  #
 * #                                        of a perfectly smooth sky        #
 * #   cornerLabelWashSidePx                that number in pixels            #
 * #   CORNER_LABEL_WASH_FADE_FRAMES        0.39s, the client's own          #
 * #   cornerLabelWashOpacity               the ramp ENDING on the first     #
 * #                                        character, because a fixed       #
 * #                                        gradient painted a grey shape on #
 * #                                        bare sky for 29 frames of 79     #
 * #                                                                        #
 * # THE GROUND IS NOW ON THE GLYPHS: `cornerLabelTextShadow()` in           #
 * # `topTitleClock.ts`, which is `TOP_TITLE_SHADOW` — fitted from the        #
 * # client's own clips — with two stacked centred glows over it. Rendered    #
 * # and measured on beat 1's own frame through the real `Segment`            #
 * # composition it reads 4.54:1 against the band's 3.65:1 while darkening    #
 * # 20,050 pixels against 135,023. The numbers, the client's own reference   #
 * # measurements and the provenance are on                                   #
 * # `DEVICE_REGISTRY['corner-label'].scrimAlpha`.                            #
 * #                                                                        #
 * # AND FOUR OF THE EIGHT EXISTED ONLY BECAUSE A BAND HAS EDGES. A halo has  #
 * # none: nothing fades in, nothing fades out, nothing overhangs sideways,   #
 * # and there is no clock, because the halo is part of the glyph and arrives #
 * # with it. The invariant the wash clock was written to buy — "the ground   #
 * # is at full depth on every frame that draws ink, and at nothing on every  #
 * # frame that draws none" — is now true BY CONSTRUCTION rather than by      #
 * # timing. It was never quite true with the clock: the ramp ends on the     #
 * # first character so it must START before it, and beat 1 carried up to 38  #
 * # levels of grey on bare sky for about nine frames.                        #
 * #                                                                        #
 * # WHAT THIS FILE STILL OWES THE GATE. `typeGroundMirror.test.ts` used to   #
 * # pin the plateau's rows EQUAL to the band rows the gate slices. There are #
 * # no plateau rows now, so what it pins instead is that this file types no  #
 * # depth of its own and that the halo's measured credit on the gate's       #
 * # one-letter window is recorded with the render that produced it.          #
 * ##########################################################################
 */

/* ------------------------------------------------------------- the clock -- */

/**
 * The type-on, in source frames and in film frames.
 *
 * Measured by tracking the RIGHT-HAND EDGE of the drawn ink in each band
 * through all 211 frames. It advances in discrete jumps of one whole glyph, at
 * a dead-steady 4 source frames per jump, and the left edge never moves:
 *
 *     label    first ink source frame 58, right edge 1292, then 1352, 1414,
 *              1471, 1549, 1591, 1652, 1716, 1778, 1830 and 1882 at source
 *              frame 106 — ELEVEN steps for the eleven non-space characters of
 *              "BOOK OF ENOCH", with the two spaces showing as double waits
 *     kicker   first ink source frame 130, last at 166 — TEN steps for the ten
 *              characters of "3RD-1ST C.", the space among them showing as a
 *              step that adds no ink
 *
 * ####################################################################
 * # THE SPACES CONSUME SLOTS, ON BOTH LINES, AND IT IS MEASURED       #
 * # RATHER THAN ASSUMED. His K-to-O and F-to-E waits are 8 source     #
 * # frames where every within-word wait is 4, and the kicker's T-to-C #
 * # wait is likewise 8. That is `nameCardClock.ts`'s answer, not      #
 * # `chapterTitleClock.ts`'s — a5 slots its spaces, a3 skips them,    #
 * # and `topTitleClock.ts` slots them too since it was re-measured    #
 * # on 2026-09-17 (it staggered whole words before). All three were   #
 * # measured off their own clips; this is a fourth measurement and    #
 * # not a house default.                                              #
 * ####################################################################
 */
export const CORNER_LABEL_TYPE_ON = {
  /** His first character, source frame 58 of 60fps, halved. 0.967s. */
  firstCharacterFrame: 58 / SOURCE_FRAMES_PER_FILM_FRAME,

  /** 4 of his frames per character, halved. */
  framesPerCharacter: 4 / SOURCE_FRAMES_PER_FILM_FRAME,

  /**
   * The empty slots between the label's last character and the kicker's first.
   *
   * ##################################################################
   * # HIS REVEAL PAUSES AT THE LINE BREAK, WHICH IS THE OPPOSITE OF   #
   * # `ov5`, AND IT PAUSES BY A WHOLE NUMBER OF SLOTS.                #
   * #                                                                 #
   * # His kicker's first character lands at source frame 130, which   #
   * # is 72 source frames after his label's first — exactly 18 slots  #
   * # of 4. His label is 13 characters, so it holds slots 0 to 12 and #
   * # the kicker starts at slot 18. Five slots are empty.             #
   * #                                                                 #
   * # CLOCKED AS A GAP IN SLOTS RATHER THAN AS A SECOND ABSOLUTE      #
   * # ONSET, because the label is a PROP: his is 13 characters and    #
   * # the schema admits 18. An absolute onset would start the kicker  #
   * # while a longer label was still typing; this keeps the same beat #
   * # between the lines whatever the words are, and it reproduces his #
   * # own frame exactly for his own sample.                           #
   * #                                                                 #
   * # THE COST IS STATED: a longer label pushes the kicker later, by  #
   * # 2 film frames per extra character. At the schema's 18-character #
   * # maximum the kicker's last character lands at film frame 93      #
   * # rather than his 83. See `cornerLabelSettleFrame`.               #
   * ##################################################################
   */
  gapSlots: 5,
} as const

/**
 * Where the label's stagger starts, so the component never has to type a zero.
 * The kicker starts at `cornerLabelKickerFirstSlot(...)` instead.
 */
export const CORNER_LABEL_FIRST_SLOT = 0

/**
 * The slot the kicker's first character takes, given how many characters the
 * label has.
 *
 * COUNT THE UPPER-CASED LABEL. The component draws both lines through
 * `text-transform: uppercase`, so anything measuring this device has to measure
 * the upper-cased strings — the schema's own comment on `corner-label` says
 * exactly that. For every character the schema admits, upper-casing is
 * one-to-one and the count is the same either way; it is written down because
 * it is the sort of thing that stops being true the day a slot admits a sharp s.
 */
export function cornerLabelKickerFirstSlot(labelCharacterCount: number): number {
  return labelCharacterCount + CORNER_LABEL_TYPE_ON.gapSlots
}

/**
 * A character's opacity at a local film frame: 0 before its slot, 1 from it.
 *
 * ####################################################################
 * # IT IS A HARD STEP, AND THAT IS MEASURED RATHER THAN SIMPLIFIED.   #
 * #                                                                   #
 * # Each character arrives at full strength within ONE film frame.    #
 * # Reading the mean red channel over the final H's own window: 0 at  #
 * # source frames 101 to 106, then 142.9 at 107 and 146.7 at 109. The #
 * # first B does the same, 0 through source frame 58 then 152.1 at    #
 * # 59. There is no ramp to fit, so fitting one — `NameCard`'s 12.2   #
 * # frame ease, say — would be inventing a curve nobody filmed.       #
 * #                                                                   #
 * # The slow decline that follows each arrival (142.9 down to 107.9   #
 * # over the next twelve source frames) is the encoder settling on a  #
 * # static frame, not the type fading: the ink COUNT holds while the  #
 * # mean drifts, and it drifts on characters that arrived long        #
 * # before as well.                                                   #
 * ####################################################################
 */
export function cornerLabelCharacterOpacity(frame: number, slot: number): number {
  const { firstCharacterFrame, framesPerCharacter } = CORNER_LABEL_TYPE_ON
  return frame >= firstCharacterFrame + framesPerCharacter * slot ? 1 : 0
}

/*
 * THE FILM'S OWN FRAME RATE LIVED HERE, for `CORNER_LABEL_WASH_FADE_FRAMES`
 * alone, and both went with the wash. Nothing else in this module is written in
 * seconds: every other number here is a film frame measured off his clip.
 * `chapterPlateClock.ts` still carries its own copy of the 30 for its own
 * reason, and both modules still import nothing.
 */

/**
 * The film frame the LAST character of the device lands on.
 *
 * ####################################################################
 * # `DEVICE_REGISTRY['corner-label'].buildEndFrames` IS 54, AND 54 IS #
 * # THE LABEL'S SETTLE, NOT THE DEVICE'S.                             #
 * #                                                                   #
 * # Its comment reads "His clip settles at 1.80s of 60fps = 54 frames #
 * # at 30fps", which is the spec's section 3 line — and section 3's   #
 * # 1.80s is the label's last character, measured here at film frame  #
 * # 53. Taken up to a whole frame that is exactly 54, so the registry #
 * # is right about the label.                                         #
 * #                                                                   #
 * # HIS KICKER'S LAST CHARACTER LANDS AT FILM FRAME 83. On his own    #
 * # 13-and-10 sample the device is not finished building until 83,    #
 * # which is 29 frames past what the registry believes; at the        #
 * # schema's longest label with his own kicker it is 93, and at the   #
 * # schema's longest of both (18 and 14) it is 101. A shot cut on     #
 * # `buildEndFrames` would cut while the kicker was still typing.     #
 * #                                                                   #
 * # `devices.ts` IS NOT THIS CHANGE'S TO EDIT. The number is computed #
 * # here so the owner of that file has one to take, and               #
 * # `CornerLabel.mount.test.tsx` pins both halves of the reading.     #
 * ####################################################################
 */
export function cornerLabelSettleFrame(
  labelCharacterCount: number,
  kickerCharacterCount: number,
): number {
  const { firstCharacterFrame, framesPerCharacter } = CORNER_LABEL_TYPE_ON
  const lastSlot =
    kickerCharacterCount > 0
      ? cornerLabelKickerFirstSlot(labelCharacterCount) + kickerCharacterCount - 1
      : labelCharacterCount - 1
  return firstCharacterFrame + framesPerCharacter * lastSlot
}
