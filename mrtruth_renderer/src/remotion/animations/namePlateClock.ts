/**
 * `name-plate`, his "text Overlay winton churchill": every number it draws with.
 *
 * ####################################################################
 * # THIS MODULE IMPORTS NOTHING, which is the rule every clock in     #
 * # this folder keeps (`chapterPlateClock.ts`, `topTitleClock.ts`,    #
 * # `nameCardClock.ts`). The fast `.test.ts` lane resolves under      #
 * # `--conditions react-server`, where a `remotion` import dies at    #
 * # the import line with an error that reads nothing like the cause.  #
 * # Importing nothing at all is stronger still, and it is what lets   #
 * # every number below be checked in plain node.                      #
 * #                                                                   #
 * # THE PRICE IS THAT `FRAME_WIDTH` AND `SAFE_AREA_X` CANNOT BE READ  #
 * # HERE. They are passed IN — see `namePlateMeasurePx` — so the      #
 * # title-safe band is still DERIVED from the compositor's own two    #
 * # constants and is never retyped as 1728.                           #
 * #                                                                   #
 * # `NamePlate.tsx` holds NO number of its own. It reads them here.   #
 * ####################################################################
 *
 * ####################################################################
 * # PROVENANCE, IN TWO LAYERS, AND THEY DISAGREE ABOUT THE PLATE.     #
 * #                                                                   #
 * #   layer 1  tmp/v53/overlays/SPEC-measured.md, section 4. The      #
 * #            plate box, the plate colour, the ink colour and the    #
 * #            three motion times. THE COMMISSION RESTATES ALL OF     #
 * #            THESE, so they are what this file ships.               #
 * #   layer 2  his own frames, tmp/v53/overlays/measure/name/         #
 * #            f0001..f0150 — 150 frames of 1920x1080 at 60fps.       #
 * #            Everything section 4 does NOT state was measured       #
 * #            there: the type sizes, the baselines, the torn edge,   #
 * #            the tilt, the wipe's fixed point and both curves.      #
 * #                                                                   #
 * # SEE THE BOX ON `NAME_PLATE_PLATE`. Layer 2 reads his plate 614 by #
 * # 132 where section 4 states 739 by 287. Section 4 wins here,       #
 * # because it is what the spec states and what the commission        #
 * # restates; the re-measurement is exported beside it as             #
 * # `NAME_PLATE_CLIP_PLATE` so one look settles it rather than an     #
 * # argument.                                                         #
 * ####################################################################
 *
 * ####################################################################
 * # HIS CLIP IS 60fps AND THE FILM IS 30. EVERY FRAME COUNT HALVES.   #
 * #                                                                   #
 * # The halving happens ONCE, at `SOURCE_FRAMES_PER_FILM_FRAME`, so   #
 * # no reader has to remember to do it and no second place can        #
 * # forget. Seconds are invariant and are quoted beside every frame   #
 * # number as the cross-check:                                        #
 * #                                                                   #
 * #   plate appears   0.17s   10.2 clip frames ->  5.1 film frames    #
 * #   settles         1.03s   61.8            -> 30.9                 #
 * #   build           0.87s   51.6            -> 25.8                 #
 * #                                                                   #
 * # 30.9 is why `DEVICE_REGISTRY['name-plate'].buildEndFrames` is 31  #
 * # — that number taken up to a whole frame. The fractional frames    #
 * # are kept HERE, because a ramp reads a fractional bound perfectly  #
 * # well and rounding one is a measurement thrown away.               #
 * #                                                                   #
 * # AND HIS CLIP IS 30fps CONTENT IN A 60fps CONTAINER. Every edge    #
 * # position measured off it repeats for exactly two consecutive      #
 * # source frames all the way through the build — 31 and 32 read      #
 * # alike, 33 and 34 read alike, and so on. That is independent       #
 * # evidence for the halving rather than an assumption about it.      #
 * ####################################################################
 */

/** His clip's fps over the film's. Every source frame count is divided by it. */
const SOURCE_FRAMES_PER_FILM_FRAME = 2

/** The film's rate, so the spec's SECONDS can be turned into film frames here. */
const FILM_FPS = 30

/* ------------------------------------------------------------ the plate -- */

/**
 * The torn light plate, bottom left. SECTION 4's OWN NUMBERS.
 *
 * `x 61..799, y 732..1018 (739 x 287)`, counted inclusively, which is why the
 * width and height below are derived as `right - left + 1`. A CSS box at
 * `left: 61` `width: 739` covers columns 61..799 exactly.
 *
 * ####################################################################
 * # THE SPEC'S BOX AND HIS OWN FRAMES DO NOT AGREE, AND THE           #
 * # DISAGREEMENT IS LARGE. WRITTEN DOWN RATHER THAN TUNED AWAY.       #
 * #                                                                   #
 * # Re-measured on `measure/name/f0150.png` — the settled frame — by  #
 * # taking the largest connected run of pixels above luma 200 in the  #
 * # bottom-left quadrant, the plate is                                #
 * #                                                                   #
 * #       x 61..674,  y 831..962      614 by 132                      #
 * #                                                                   #
 * # against section 4's 739 by 287. The LEFT EDGE agrees exactly at   #
 * # 61. Nothing else does, and the two are not one scale apart: x is  #
 * # out by 1.20 and y by 2.17, so a resolution or crop difference     #
 * # cannot explain it. The same measurement on his five sampled       #
 * # stills (`text_Overlay_winton_churchill_*.jpg`, 640x360) gives     #
 * # x 20..224, y 277..320, which is the SAME box at a third scale.    #
 * #                                                                   #
 * # AND THE OTHER THREE SECTIONS ARE CORROBORATED WHERE THIS ONE IS   #
 * # NOT. `measure/raw.json` carries `whiteBBox` for `chapter`,        #
 * # `chapter2` and `ov5` matching their spec sections to the pixel.   #
 * # Its `name` entry is `x 0..1854, y 0..1079` — the mask caught the  #
 * # photograph, so section 4's box has no second source behind it.    #
 * #                                                                   #
 * # SECTION 4 IS SHIPPED ANYWAY, because it is what the spec states   #
 * # and what the commission restates word for word, and because this  #
 * # device ships DISABLED — no film can reach it before somebody      #
 * # settles this. `NAME_PLATE_CLIP_PLATE` below is the re-measured    #
 * # box, exported so the swap is one line and so a test can pin the   #
 * # difference rather than let it be re-argued.                       #
 * ####################################################################
 */
export const NAME_PLATE_PLATE = {
  /** Sampled off the plate, section 4. Not pure white. */
  colour: '#FEF9F6',
  leftPx: 61,
  rightPx: 799,
  topPx: 732,
  bottomPx: 1018,
} as const

/** 799 - 61 + 1. Inclusive columns, so the `+ 1` is the column at 799 itself. */
export const NAME_PLATE_PLATE_WIDTH_PX = NAME_PLATE_PLATE.rightPx - NAME_PLATE_PLATE.leftPx + 1

/** 1018 - 732 + 1. */
export const NAME_PLATE_PLATE_HEIGHT_PX = NAME_PLATE_PLATE.bottomPx - NAME_PLATE_PLATE.topPx + 1

/**
 * The plate as HIS OWN FRAMES carry it. NOT DRAWN — see the box above.
 *
 * Kept because every other number in this file was measured in THIS box's
 * coordinates: the type, the tear and the wipe's fixed point are all stated as
 * offsets and fractions of it, so the ratio between the two boxes is what any
 * future correction turns on.
 */
export const NAME_PLATE_CLIP_PLATE = {
  leftPx: 61,
  rightPx: 674,
  topPx: 831,
  bottomPx: 962,
  widthPx: 674 - 61 + 1,
  heightPx: 962 - 831 + 1,
} as const

/**
 * The tilt, applied to the PLATE and to nothing else.
 *
 * ####################################################################
 * # THE PLATE IS TILTED AND THE TYPE ON IT IS NOT. MEASURED, BOTH.    #
 * #                                                                   #
 * # Least squares on the plate's own long edges across `f0150`,       #
 * # skipping 12px at each end so the torn corners cannot lever the    #
 * # fit: the top edge runs at -0.086 degrees and the bottom at        #
 * # -0.194. The mean is what is taken.                                #
 * #                                                                   #
 * # THE TWO EDGES DISAGREE BY 0.11 DEGREES, and a rigid rotation      #
 * # would put them equal. That residual is the tear, not a second     #
 * # transform: the plate is torn paper, so its edges are not          #
 * # parallel. Recorded rather than averaged away silently.            #
 * #                                                                   #
 * # THE TYPE IS LEVEL TO A HUNDREDTH OF A PIXEL. Sub-pixel coverage   #
 * # on the first and last glyphs of the name line, 550px apart, puts  #
 * # the `W` cap top at 850.98 and the final `l` at 850.99, and their  #
 * # baselines at 894.06 and 894.01. At -0.14 degrees the far end      #
 * # would sit 1.3px higher. So the type is a SIBLING of the plate     #
 * # here, never a child of it — a rotation on a shared parent would   #
 * # tilt letters his clip draws straight.                             #
 * ####################################################################
 */
export const NAME_PLATE_TILT_DEGREES = (-0.086 + -0.194) / 2

/* ------------------------------------------------------------- the tear -- */

/**
 * How far outside the nominal box the drawn element reaches, so that a tear
 * which runs OUTSIDE that box still has ink under it.
 *
 * The offsets below are signed: a negative one is ink outside the nominal
 * rectangle, which is what a torn edge does, and the deepest is -1.4px. An
 * element sized exactly to the nominal box could not paint there — a
 * `clip-path` only ever removes paint, it never adds any — so the element is
 * grown by this pad on all four sides and the nominal rectangle sits this far
 * inside it. The DRAWN nominal edges still land on section 4's box.
 */
export const NAME_PLATE_TEAR_PAD_PX = 2

/**
 * The torn edge, measured off `f0150` and stated as an inward offset in pixels
 * at a fraction along each edge.
 *
 * ####################################################################
 * # PIXELS ACROSS, FRACTIONS ALONG, AND THAT IS THE WHOLE POINT.      #
 * #                                                                   #
 * # The tear's DEPTH is a property of the torn paper — a couple of    #
 * # pixels — and does not grow when the plate does, so it is held in  #
 * # pixels. Where each notch sits ALONG the edge is a property of the #
 * # shape, so it is held as a fraction and follows whatever box the   #
 * # plate is drawn at. Stating the depths as fractions instead would  #
 * # stretch a 2px nick into a 4px one the moment the box changed      #
 * # height, and the box here is exactly what is in dispute.           #
 * #                                                                   #
 * # DETRENDED. Each long-edge offset is the measured edge MINUS the   #
 * # fitted line for that edge, so the tilt is carried once, by        #
 * # `NAME_PLATE_TILT_DEGREES`, and not a second time by these         #
 * # numbers. Undetrended they would double the tilt, by up to 2.3px   #
 * # across the plate.                                                 #
 * #                                                                   #
 * # NOT AN IMAGE ASSET, on purpose: the commission asks for a path or #
 * # a clip-path, and a PNG of a torn edge could not be scaled by the  #
 * # wipe without resampling its own antialiasing every frame.         #
 * ####################################################################
 */
export const NAME_PLATE_TEAR = {
  /** Inward (downward) offsets at u = 0.125 .. 0.875 along the top edge. */
  topPx: [-0.9, 0.2, 2.4, 0.5, -1.4, -1.3, 0.8],
  /** Inward (leftward) offsets at v = 0.167 .. 0.833 down the right edge. */
  rightPx: [2, 1, 2, 3, 3],
  /** Inward (upward) offsets at u = 0.875 .. 0.125, taken right to left. */
  bottomPx: [1.1, 0.4, -0.4, -1.1, -0.8, 0.4, 1.7],
  /** Inward (rightward) offsets at v = 0.833 .. 0.167, taken bottom to top. */
  leftPx: [0, 3, 1, 4, 5],
  /**
   * The four corners, each as (inward x, inward y) in pixels.
   *
   * ##################################################################
   * # THE BOTTOM-RIGHT CORNER CARRIES A SPIKE THAT IS NOT DRAWN.      #
   * #                                                                 #
   * # At x 674 his plate reaches down to y 889 only, a nick 3 columns #
   * # wide and 64 rows deep. Three columns of a 614px edge is below   #
   * # what a 28-point polygon resolves, and drawing it would put a    #
   * # hairline spike on the frame that his clip shows as one ragged   #
   * # pixel. The corner is taken at the measured shoulder instead —   #
   * # x 668..671, where the bottom edge lifts from 960 to 953 — and   #
   * # the spike is written down here instead of being drawn.          #
   * ##################################################################
   */
  cornersPx: {
    topLeft: { x: 4, y: 5 },
    topRight: { x: 6, y: 2.9 },
    bottomRight: { x: 6, y: 7 },
    bottomLeft: { x: 5, y: 10.9 },
  },
} as const

/* ------------------------------------------------------------- the type -- */

/**
 * Playfair Display's own vertical metrics, read out of the shipped
 * `apps/web/public/fonts/PlayfairDisplay-Variable.woff2` rather than off a
 * specimen page: `head.unitsPerEm` 1000, `hhea` ascender 1082 and descender
 * -251, `OS/2.sTypoAscender` and `sTypoDescender` repeating the same pair with
 * `USE_TYPO_METRICS` set in `fsSelection`, and `OS/2.sCapHeight` 708.
 *
 * Recompute all three if the face ever changes. `chapterPlateClock.ts` carries
 * the identical derivation for the identical face, and
 * `NamePlate.mount.test.tsx` writes the expected values out again from the font
 * tables rather than importing them, so the two cannot drift in silence.
 */
const FACE_CAP_OVER_EM = 708 / 1000
const FACE_ASCENDER_OVER_EM = 1082 / 1000
const FACE_DESCENDER_OVER_EM = 251 / 1000

/** Exported so the mount test can pin it against the font's own `sCapHeight`. */
export const NAME_PLATE_CAP_OVER_EM = FACE_CAP_OVER_EM

/**
 * Where the baseline sits inside a `line-height: 1` box, as a fraction of the
 * font size. DERIVED, never typed.
 *
 * ####################################################################
 * # `top = baseline - fontSize` IS WRONG AND IT HAS SHIPPED ONCE.     #
 * #                                                                   #
 * # With `line-height: 1` the line box is one em tall, but the FACE   #
 * # is taller: Playfair's ascender plus descender is 1.333em. CSS     #
 * # centres the overflow, so the half-leading is NEGATIVE and the     #
 * # baseline lands at (1 - 1.333) / 2 + 1.082 = 0.9155em from the     #
 * # top, not at 1.000em. Positioning the name by `baseline -          #
 * # fontSize` puts it 0.0845em = 5.1px too HIGH, and the role line    #
 * # 2.9px too high.                                                   #
 * #                                                                   #
 * # IT IS A PROPERTY OF THE FACE, NOT OF CSS. `bodyFace.ts` carries   #
 * # the same derivation for Noto Sans and lands on 0.888 instead.     #
 * # Nothing in this repository lays text out, so only a render        #
 * # against his own frame would ever catch the wrong one.             #
 * ####################################################################
 */
export const NAME_PLATE_BASELINE_OVER_EM =
  (1 - (FACE_ASCENDER_OVER_EM + FACE_DESCENDER_OVER_EM)) / 2 + FACE_ASCENDER_OVER_EM

/**
 * The two lines. Sizes come from CAP HEIGHTS, which is what can be measured off
 * a video — a `font-size` is an em box no glyph ever fills, so typing one would
 * be inventing the number that matters most.
 *
 * Measured on `f0150` by sub-pixel coverage, reading each edge as the row where
 * the ink's coverage crosses half of that glyph's own full coverage:
 *
 *     name  "Winston Churchill"   W cap top 850.98, baseline 894.06
 *     role  "British Statesman"   B cap top 919.63, baseline 943.64
 *
 * so 43.08 and 24.38 of cap, and 49.95 between the two baselines. The name's
 * ink starts at x 100 and his plate's at x 61, which is the 39px inset below.
 */
export const NAME_PLATE_TYPE = {
  /** Near-black, not pure black. Section 4's ink colour, and the commission's. */
  colour: '#101010',

  /**
   * The ink's left edge, as an inset from the plate's own left edge. 100 - 61.
   *
   * ##################################################################
   * # THIS IS HIS INK EDGE AND OURS WILL SIT A FEW PIXELS RIGHT OF   #
   * # IT. A text box placed at this x draws its first glyph at x     #
   * # plus that glyph's left side bearing, and the correction        #
   * # depends on which letter the name happens to start with — so    #
   * # applying it would move the block every time the copy changed.  #
   * # `chapterTitleClock.ts` records an equivalent shortfall for     #
   * # the same reason. `topTitleClock.ts` did too until 2026-09-17,  #
   * # when it fitted its box origin off every glyph of his sample.   #
   * #                                                                 #
   * # HIS OWN TWO LINES ALREADY DIFFER BY 5px FOR THIS REASON: the   #
   * # name's ink starts at 100 and the role's at 105, and both are   #
   * # left aligned. Ours are aligned on the BOX, as his are.         #
   * ##################################################################
   */
  leftInsetPx: 100 - 61,

  /**
   * The ink's right margin inside his plate, 674 - 652, used only to bound the
   * measure. It is not a position: it is how much room his own longest line
   * left itself, and it keeps a long name from running into the torn edge.
   */
  rightInsetPx: 674 - 652,

  name: {
    /** W's cap, 894.06 - 850.98. */
    capHeightPx: 43.08,
    /**
     * 700. `fonts.ts` registers `SERIF_FAMILY` at 500 and 700 only, both pinned
     * out of the one variable file. Any other weight gets whatever the browser
     * synthesises, which nobody has reviewed, and it fails soft.
     */
    fontWeight: 700,
  },

  role: {
    /** B's cap, 943.64 - 919.63. */
    capHeightPx: 24.38,
    /**
     * 500, WHICH IS THE COMMISSION'S NUMBER AND NOT WHAT HIS CLIP SHOWS.
     *
     * ################################################################
     * # SECTION 4 SAYS "Bold name over a smaller BOLD role line" and #
     * # his role line is visibly the same weight as his name. The    #
     * # commission for this device says 500, and 500 is one of the   #
     * # two weights `fonts.ts` registers, so 500 is what ships.      #
     * #                                                              #
     * # It is a one-token change if he wants his own weight back.    #
     * # Written down because a render against his clip will show the #
     * # role line lighter than his, and that is this line, not a bug.#
     * ################################################################
     */
    fontWeight: 500,
  },

  /** 943.64 - 894.06, his two baselines. */
  baselineGapPx: 49.95,

  /**
   * One em per line, and `NAME_PLATE_BASELINE_OVER_EM` is derived for EXACTLY
   * this value: the half-leading that puts the baseline at 0.9155em is
   * `(1 - 1.333) / 2`, and the leading `1` in that expression is this. Change
   * one and the other is wrong, silently, in a way no test here can see.
   */
  lineHeight: 1,
} as const

/** The name's size: the measured cap over the face's own cap ratio. 60.85px. */
export const NAME_PLATE_NAME_FONT_SIZE_PX =
  NAME_PLATE_TYPE.name.capHeightPx / FACE_CAP_OVER_EM

/** The role's size, the same way. 34.44px. */
export const NAME_PLATE_ROLE_FONT_SIZE_PX =
  NAME_PLATE_TYPE.role.capHeightPx / FACE_CAP_OVER_EM

/**
 * The type block's height: the name's cap top down to the ROLE's baseline.
 *
 * Not an ink height and not a line height. It is the thing his layout centres,
 * and it is what the two margins below are measured against.
 */
export const NAME_PLATE_BLOCK_HEIGHT_PX =
  NAME_PLATE_TYPE.name.capHeightPx + NAME_PLATE_TYPE.baselineGapPx

/**
 * The name's baseline, in frame pixels from the top of the frame.
 *
 * ####################################################################
 * # THE BLOCK IS CENTRED IN THE PLATE, AND THAT IS MEASURED RATHER   #
 * # THAN CHOSEN.                                                     #
 * #                                                                   #
 * # In his own frame the plate runs y 831..962 and the type block     #
 * # runs 850.98 to 943.64, so the margins are 19.98 above and 19.36   #
 * # below. Equal to within two thirds of a pixel on a 132px plate.    #
 * #                                                                   #
 * # AT SECTION 4's PLATE HEIGHT THOSE MARGINS BECOME 97px EACH, not   #
 * # his 20, because section 4's plate is 287 tall where his is 132.   #
 * # That follows from the box in `NAME_PLATE_PLATE` and is the most   #
 * # visible consequence of taking the spec's box: the type keeps its  #
 * # measured size and its measured spacing and sits in a much taller  #
 * # plate. Centring is the only placement rule his frame supports;    #
 * # pinning the block 20px under the plate's top instead would leave  #
 * # 174px of bare plate below it.                                     #
 * ####################################################################
 */
export const NAME_PLATE_BLOCK_TOP_MARGIN_PX =
  (NAME_PLATE_PLATE_HEIGHT_PX - NAME_PLATE_BLOCK_HEIGHT_PX) / 2

export const NAME_PLATE_NAME_BASELINE_PX =
  NAME_PLATE_PLATE.topPx + NAME_PLATE_BLOCK_TOP_MARGIN_PX + NAME_PLATE_TYPE.name.capHeightPx

/**
 * The role's baseline. An ABSOLUTE baseline, his measured 49.95 below the
 * name's, rather than a line height or a margin.
 *
 * ####################################################################
 * # ABSOLUTE, WHICH IS WHAT MAKES THE EMPTY-ROLE CASE FREE: the name  #
 * # cannot move, because nothing about its position is expressed      #
 * # relative to the role. `TopTitle.tsx` and `NameCard.tsx` place     #
 * # their two lines the same way and for the same reason.             #
 * #                                                                   #
 * # THE CONSEQUENCE, SAID PLAINLY: with no role line the name stays   #
 * # where it is and the lower half of the plate is bare. Re-centring  #
 * # the name alone would make one slot's position depend on another   #
 * # slot's contents, which is the coupling those two files exist to   #
 * # avoid. If he wants the single-line case centred, that is a        #
 * # design answer from him, not a fix.                                #
 * ####################################################################
 */
export const NAME_PLATE_ROLE_BASELINE_PX =
  NAME_PLATE_NAME_BASELINE_PX + NAME_PLATE_TYPE.baselineGapPx

/** The `top` a `line-height: 1` box needs so its baseline lands where measured. */
export function namePlateLineTopPx(baselinePx: number, fontSizePx: number): number {
  return baselinePx - fontSizePx * NAME_PLATE_BASELINE_OVER_EM
}

/**
 * The widest a line may be drawn, in film pixels.
 *
 * TITLE-SAFE IS DERIVED AND NEVER TYPED. `frameWidth - 2 * safeAreaX` is the
 * 1728px band every caption in this film keeps inside; hand it the
 * compositor's own two constants and the two can never drift apart.
 *
 * ####################################################################
 * # THE PLATE IS THE BINDING CONSTRAINT, NOT THE SAFE AREA, AND BOTH  #
 * # ARE APPLIED.                                                      #
 * #                                                                   #
 * # The text starts at x 100 and the plate's inner edge is at 777, so #
 * # the plate leaves 677px. Title-safe leaves 1724px from the same    #
 * # start. The narrower of the two is what a line may use.            #
 * #                                                                   #
 * # AND THE PLATE ITSELF BREAKS THE MARGIN. Section 4 puts its left   #
 * # edge at x 61 where `SAFE_AREA_X` is 96, so 35px of plate sits     #
 * # outside the band this project keeps everywhere else. That is the  #
 * # spec's number, not a choice made here — section 3 carries the     #
 * # same warning about `text overlay 6.0` landing 38px from the       #
 * # frame edge. The TYPE clears the margin by 4px.                    #
 * ####################################################################
 */
export function namePlateMeasurePx(frameWidth: number, safeAreaX: number): number {
  const titleSafeRightPx = frameWidth - safeAreaX
  const textLeftPx = NAME_PLATE_PLATE.leftPx + NAME_PLATE_TYPE.leftInsetPx
  const plateInnerRightPx =
    NAME_PLATE_PLATE.leftPx + NAME_PLATE_PLATE_WIDTH_PX - NAME_PLATE_TYPE.rightInsetPx
  return Math.min(plateInnerRightPx, titleSafeRightPx) - textLeftPx
}

/** The text's left edge in frame pixels. Both lines share it. */
export const NAME_PLATE_TEXT_LEFT_PX = NAME_PLATE_PLATE.leftPx + NAME_PLATE_TYPE.leftInsetPx

/* ------------------------------------------------------------ the clock -- */

/**
 * A cubic-bezier easing, solved rather than approximated. Newton-Raphson on x,
 * falling back to bisection where the derivative goes flat, which is what a
 * browser's own implementation does.
 *
 * Written out here rather than imported from `nameCardClock.ts`, which carries
 * the same solver, because this module imports nothing at all — see the head of
 * the file. `topTitleClock.ts` restates Noto Sans's cap height over the em for
 * the same reason.
 */
export function namePlateCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  const curveX = (t: number): number => {
    const u = 1 - t
    return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t
  }
  const curveY = (t: number): number => {
    const u = 1 - t
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t
  }
  const slopeX = (t: number): number => {
    const u = 1 - t
    return 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2)
  }

  let t = x
  for (let i = 0; i < 8; i += 1) {
    const error = curveX(t) - x
    if (Math.abs(error) < 1e-7) return curveY(t)
    const slope = slopeX(t)
    if (Math.abs(slope) < 1e-7) break
    t -= error / slope
  }

  let low = 0
  let high = 1
  t = x
  for (let i = 0; i < 40; i += 1) {
    const value = curveX(t)
    if (Math.abs(value - x) < 1e-7) break
    if (value > x) high = t
    else low = t
    t = (low + high) / 2
  }
  return curveY(t)
}

/**
 * CSS `ease-out`, and BOTH of this device's ramps land on it.
 *
 * ####################################################################
 * # FITTED, NOT ASSUMED, AND THE SAME CURVE TWICE IS THE RESULT.      #
 * #                                                                   #
 * # The wipe was tracked by the plate's right edge on 30 of his       #
 * # frames and the fade by the ink coverage of the first glyph of     #
 * # each line on 20 of them. Free two-parameter fits over the         #
 * # cubic-bezier family `(0, y1, x2, 1)` returned (0, 0.08, 0.60, 1)  #
 * # for the wipe and (0, 0.00, 0.58, 1) for the fade — both of which  #
 * # ARE cubic-bezier(0, 0, 0.58, 1) to within the measurement.        #
 * #                                                                   #
 * # The rivals, on the fade, by rms in alpha:                         #
 * #                                                                   #
 * #   ease-out (0,0,.58,1)   0.0069    linear             0.0567      #
 * #   1 - (1-t)^1.8          0.0053    smoothstep         0.0508      #
 * #   1 - (1-t)^2            0.0073    easy-ease          0.0505      #
 * #   1 - (1-t)^3            0.0196    ease-out-expo      0.245       #
 * #                                                                   #
 * # Every symmetric curve is an order of magnitude worse, so the      #
 * # SHAPE is pinned even though the exact bezier is not. `ease-out`   #
 * # is taken over the power curve because it is a curve an author     #
 * # picks by name and the free fit landed on it, and because one      #
 * # curve serving both ramps is what a person working in one tool     #
 * # does. `chapterPlateClock.ts` takes a power curve on the same      #
 * # reasoning run the other way: there, only two endpoints were       #
 * # measured and there was no interior sample to pick a bezier with.  #
 * ####################################################################
 */
export const NAME_PLATE_EASE_OUT = { x1: 0, y1: 0, x2: 0.58, y2: 1 } as const

function easeOut(progress: number): number {
  return namePlateCubicBezier(
    NAME_PLATE_EASE_OUT.x1,
    NAME_PLATE_EASE_OUT.y1,
    NAME_PLATE_EASE_OUT.x2,
    NAME_PLATE_EASE_OUT.y2,
    Math.min(Math.max(progress, 0), 1),
  )
}

/**
 * The wipe: the plate opens from a point just outside its own left end.
 *
 * ####################################################################
 * # IT IS A `scaleX`, NOT A WIDTH ANIMATION AND NOT A CENTRE-OUT      #
 * # REVEAL, AND THE FIXED POINT IS OUTSIDE THE PLATE.                 #
 * #                                                                   #
 * # Tracked across his build, the plate's LEFT edge drifts 43 -> 61   #
 * # while its RIGHT edge races 79 -> 674. Both edges are therefore    #
 * # moving, which a width animation cannot do, and they are moving    #
 * # the SAME way, which a centre-out wipe cannot do.                  #
 * #                                                                   #
 * # A `scaleX` about a fixed point x collapses both edges onto that   #
 * # point at scale 0. Solving for it from three widely separated      #
 * # frames gives 41.88, 42.07 and 42.42 — a quarter of a pixel apart  #
 * # over the whole build, and 19px OUTSIDE his plate's left edge at   #
 * # 61. It reproduces every measured left edge to within a pixel.     #
 * #                                                                   #
 * # THE LIKELY AUTHORING, though it changes nothing here: his plate   #
 * # element is about 19px wider than its ink on the left — the slack  #
 * # a torn edge needs — and the origin is that element's own left     #
 * # edge. Modelled as a negative fraction of the ink box so that the  #
 * # number is the measurement rather than a guess about his file.     #
 * ####################################################################
 */
export const NAME_PLATE_WIPE = {
  /**
   * Where both edges start, as a fraction of the plate's width, signed from
   * the plate's own left edge. (42 - 61) / 614 on his box.
   */
  originFraction:
    (42 - NAME_PLATE_CLIP_PLATE.leftPx) / NAME_PLATE_CLIP_PLATE.widthPx,

  /** Section 4's "appears 0.17s". 10.2 of his frames, 5.1 of the film's. */
  startFrame: 0.17 * FILM_FPS,

  /** Section 4's "settles 1.03s". 61.8 of his frames, 30.9 of the film's. */
  endFrame: 1.03 * FILM_FPS,
} as const

/**
 * The plate's horizontal scale at a local frame, 0 to 1.
 *
 * ####################################################################
 * # SECTION 4's SETTLE IS 0.12s EARLIER THAN THE EDGE ACTUALLY        #
 * # STOPS, AND SECTION 4 IS WHAT IS USED.                             #
 * #                                                                   #
 * # His right edge is still moving at 1.03s and reaches its rest at   #
 * # source frame 69, which is 1.15s. The difference is that section 4 #
 * # and `measure/timing.json` both read the settle off the plate's    #
 * # AREA, and the last 23px of a 614px plate is under 4% of it —      #
 * # inside the noise of any threshold. Section 4's number is also the #
 * # one `DEVICE_REGISTRY['name-plate'].buildEndFrames` is built from, #
 * # so taking the other would put the registry and the drawing out of #
 * # step. The cost is that the ramp arrives about 3% short of its     #
 * # last few pixels a tenth of a second early, then holds.            #
 * ####################################################################
 */
export function namePlateWipeScaleX(frame: number): number {
  const { startFrame, endFrame } = NAME_PLATE_WIPE
  return easeOut((frame - startFrame) / (endFrame - startFrame))
}

/**
 * The type's fade. ONE ramp for BOTH lines, which is measured rather than
 * assumed.
 *
 * ####################################################################
 * # THE TWO LINES FADE TOGETHER, ON ONE CLOCK, AND NOTHING TYPES ON.  #
 * #                                                                   #
 * # Ink coverage of the `W` of the name and the `B` of the role,      #
 * # frame by frame through the build, reads                           #
 * #                                                                   #
 * #   src   31     35     41     49     57     63     69              #
 * #   W   0.098  0.280  0.525  0.773  0.953  0.994  1.000             #
 * #   B   0.096  0.275  0.514  0.766  0.943  0.992  1.000             #
 * #                                                                   #
 * # — the same curve to within a percent at every frame. There is no  #
 * # stagger between the lines and none within them: the ink's         #
 * # bounding box holds x 100..652 on every frame it is visible, so no #
 * # glyph arrives before its neighbour and nothing moves. That rules  #
 * # out the per-glyph type-on `ChapterTitle`, `NameCard` and          #
 * # `TopTitle` all use, which was the obvious thing to reach for.     #
 * #                                                                   #
 * # THE FADE STARTS LATE AND ENDS WITH THE WIPE. Its start is not in  #
 * # section 4 at all; back-solved against the ease-out with the end   #
 * # pinned to section 4's own 1.03s settle, it is source frame 29.2,  #
 * # which is 0.487s. So the plate opens alone for the first third of  #
 * # a second and the words arrive into it.                            #
 * ####################################################################
 */
export const NAME_PLATE_TEXT_FADE = {
  /** Source frame 29.2 of his 60fps clip. 0.487s, 14.6 film frames. */
  startFrame: 29.2 / SOURCE_FRAMES_PER_FILM_FRAME,
  /** Section 4's settle, the same instant the wipe ends. 1.03s. */
  endFrame: 1.03 * FILM_FPS,
} as const

/** The opacity of BOTH lines at a local frame. */
export function namePlateTextOpacity(frame: number): number {
  const { startFrame, endFrame } = NAME_PLATE_TEXT_FADE
  return easeOut((frame - startFrame) / (endFrame - startFrame))
}

/* --------------------------------------------------- ready-made for CSS -- */

/**
 * The plate element's own box, the nominal box grown by the tear's pad.
 *
 * Built here rather than in the component, which carries no numbers at all —
 * not even the 2 that turns one pad into two.
 */
export const NAME_PLATE_ELEMENT = {
  leftPx: NAME_PLATE_PLATE.leftPx - NAME_PLATE_TEAR_PAD_PX,
  topPx: NAME_PLATE_PLATE.topPx - NAME_PLATE_TEAR_PAD_PX,
  widthPx: NAME_PLATE_PLATE_WIDTH_PX + 2 * NAME_PLATE_TEAR_PAD_PX,
  heightPx: NAME_PLATE_PLATE_HEIGHT_PX + 2 * NAME_PLATE_TEAR_PAD_PX,
} as const

function pointsAlong(count: number): number[] {
  /* 1/(count+1) .. count/(count+1), the interior of an edge, ends excluded. */
  return Array.from({ length: count }, (unused, index) => (index + 1) / (count + 1))
}

/**
 * The torn outline as a `clip-path: polygon()` value, in the element's own
 * pixels, walked clockwise from the top-left corner.
 *
 * 28 points: four corners, seven down each long edge and five down each short
 * one, at the fractions the offsets above were measured at.
 */
export const NAME_PLATE_TEAR_POLYGON = ((): string => {
  const pad = NAME_PLATE_TEAR_PAD_PX
  const width = NAME_PLATE_PLATE_WIDTH_PX
  const height = NAME_PLATE_PLATE_HEIGHT_PX
  const corner = NAME_PLATE_TEAR.cornersPx

  const points: [number, number][] = [[pad + corner.topLeft.x, pad + corner.topLeft.y]]

  pointsAlong(NAME_PLATE_TEAR.topPx.length).forEach((u, index) => {
    points.push([pad + u * width, pad + (NAME_PLATE_TEAR.topPx[index] ?? 0)])
  })
  points.push([pad + width - corner.topRight.x, pad + corner.topRight.y])

  pointsAlong(NAME_PLATE_TEAR.rightPx.length).forEach((v, index) => {
    points.push([pad + width - (NAME_PLATE_TEAR.rightPx[index] ?? 0), pad + v * height])
  })
  points.push([pad + width - corner.bottomRight.x, pad + height - corner.bottomRight.y])

  pointsAlong(NAME_PLATE_TEAR.bottomPx.length).forEach((u, index) => {
    /* Right to left, so the fraction runs back down the edge. */
    points.push([
      pad + (1 - u) * width,
      pad + height - (NAME_PLATE_TEAR.bottomPx[index] ?? 0),
    ])
  })
  points.push([pad + corner.bottomLeft.x, pad + height - corner.bottomLeft.y])

  pointsAlong(NAME_PLATE_TEAR.leftPx.length).forEach((v, index) => {
    points.push([pad + (NAME_PLATE_TEAR.leftPx[index] ?? 0), pad + (1 - v) * height])
  })

  const drawn = points
    .map(([x, y]) => `${String(Math.round(x * 100) / 100)}px ${String(Math.round(y * 100) / 100)}px`)
    .join(', ')
  return `polygon(${drawn})`
})()

/**
 * The wipe's `transform-origin`, ready to hand to CSS, as a percentage of the
 * PADDED element rather than of the nominal plate — which is the box CSS
 * resolves a percentage against.
 *
 * Negative on purpose: the fixed point is outside the plate's left edge. See
 * the box on `NAME_PLATE_WIPE`.
 */
export const NAME_PLATE_WIPE_TRANSFORM_ORIGIN = ((): string => {
  const fixedPointPx =
    NAME_PLATE_PLATE.leftPx + NAME_PLATE_WIPE.originFraction * NAME_PLATE_PLATE_WIDTH_PX
  const fraction = (fixedPointPx - NAME_PLATE_ELEMENT.leftPx) / NAME_PLATE_ELEMENT.widthPx
  return `${String(fraction * 100)}% 50%`
})()

/** The tilt's origin: the plate's own centre, so the rotation adds no travel. */
export const NAME_PLATE_TILT_TRANSFORM_ORIGIN = '50% 50%'
