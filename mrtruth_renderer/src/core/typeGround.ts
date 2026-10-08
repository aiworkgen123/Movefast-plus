/**
 * THE RECTANGLE THE LETTERS LAND ON, MEASURED IN PIXELS.
 *
 * ##########################################################################
 * # NOTHING IN THIS PIPELINE HAS EVER MEASURED THE GROUND UNDER THE TYPE.   #
 * #                                                                        #
 * # Every brightness rule in the repo reads ONE scalar — `vision.meanLuma`, #
 * # the judge's guess at the brightness of the WHOLE uncropped picture from #
 * # a 512px preview. G8 (`deviceChoice.ts`), planCheck T-7 and T-12's       #
 * # `isTitleSafeCandidate` all read that same number.                       #
 * #                                                                        #
 * # TWO DELIVERED FRAMES ARE THE BILL, and they fail DIFFERENTLY.           #
 * #                                                                        #
 * #   0:00:04  ALLEGHENY, corner-label on scene 1. The judge said 0.48      #
 * #            against a ceiling of 0.55, so G8 passed it with 0.07 to      #
 * #            spare. The strip under the word runs 0.99 white sky at one   #
 * #            end and 0.03 black trees at the other — a 20:1 swing inside  #
 * #            ONE WORD. Three whole letters sit at 1.11:1.                 #
 * #            A REGIONAL MEAN DOES NOT CATCH THIS EITHER: the rectangle    #
 * #            averages 0.38 to 0.47, comfortably under any ceiling.        #
 * #            Only a WORST-WINDOW measure finds it.                        #
 * #                                                                        #
 * #   0:01:45  "Cornplanter's land", chapter-plate on scene 28, over a      #
 * #            1940 census form. The judge said 0.43; the delivered frame   #
 * #            reads 0.77 to 0.82 and the heading's own rectangle 0.91.     #
 * #            It fails on LEVEL and on BUSY-ness, and the second one is    #
 * #            what a wash cannot fix by dimming.                           #
 * ##########################################################################
 *
 * WHAT THIS FILE IS. The geometry and the arithmetic, with no pixels in it.
 * `apps/worker/src/media/typeGround.ts` decodes the stored picture and fills
 * `AssetTypeGround`; `deviceChoice.ts` reads it back through `readTypeGround`
 * and refuses the device. Neither half knows how the other works.
 *
 * ##########################################################################
 * # WHY A COLUMN PROFILE AND NOT A RECTANGLE. THE RECTANGLE IS NOT KNOWN    #
 * # UNTIL THE COPY IS WRITTEN, AND THE COPY IS WRITTEN INSIDE THE CHOOSER.  #
 * #                                                                        #
 * # A device's type band is fixed by its own design — corner-label's caps   #
 * # occupy rows 210.68 to 264.95 on every frame of every film. What varies  #
 * # is how far along that band the words run, and `buildCopy` decides that  #
 * # one gate later, from marks this file cannot see.                        #
 * #                                                                        #
 * # So the worker profiles the WHOLE band by column, once per picture, and  #
 * # the gate slices the columns the words really cover. One decode answers  #
 * # every device and every copy, and the rectangle is exact rather than a   #
 * # worst case padded out to be safe.                                       #
 * ##########################################################################
 *
 * NOTHING HERE IS IN THE COMPOSITOR'S BUNDLE. `bundleGraph.test.ts` lets
 * `apps/web/src/remotion` import exactly five subpaths — devices, effects,
 * frames, motion, schemas — and this is not one of them, so every threshold
 * below can be retuned for the cost of re-planning rather than the 87 minutes
 * a full re-render costs. That is deliberate and it is why the thresholds are
 * here and not on the registry rows they judge.
 */

import {
  CORNER_LABEL_KICKER_CAP_HEIGHT_MIRROR,
  CORNER_LABEL_LABEL_CAP_HEIGHT_MIRROR,
  cornerLabelKickerWidth,
  cornerLabelLabelWidth,
} from './cornerLabelFit.js'
import {
  CHAPTER_PLATE_CAP_HEIGHT_MIRROR,
  CHAPTER_PLATE_CAP_OVER_EM_MIRROR,
  CHAPTER_PLATE_MAX_WIDTH,
  chapterPlateHeadingFontSizePx,
  chapterPlateHeadingWidth,
} from './chapterPlateFit.js'
import {
  TOP_TITLE_CAP_HEIGHT_MIRROR,
  TOP_TITLE_LEFT_MIRROR,
  topTitleLine1Width,
  topTitleLine2Width,
} from './topTitleFit.js'
import type { DeviceId, SceneDevice } from './devices.js'
import { FRAME_WIDTH, FRAME_HEIGHT } from './schemas.js'

/* ------------------------------------------------------------------------- */
/* 1 — THE SHAPE THE WORKER FILLS IN                                           */
/* ------------------------------------------------------------------------- */

/**
 * How many bins the Sobel histogram carries, over magnitudes 0..255.
 *
 * SIXTY-FOUR, so a percentile lands within 4 of the truth, a third of the gap
 * between the busiest ordinary photograph in the delivered film and the census
 * page that provoked all this. Thirty-two bins was tried first and quantised
 * every reading to a multiple of 8, which put the threshold itself on a bin
 * edge.
 *
 * A HISTOGRAM RATHER THAN A MEAN, because the mean cannot see this at all: the
 * census page's edge MEAN is 6.97 against a clean photograph's 4.66, a
 * difference of nothing, while its p95 is five times as high. What separates
 * printed matter from a photograph is the tail.
 */
export const TYPE_GROUND_EDGE_BINS = 64

/**
 * ONE ROW STRIPE OF ONE BAND, holding one mean grey per column bucket.
 *
 * ##########################################################################
 * # THE BAND IS SLICED FROM THE BASELINE UP BECAUSE THE INK GROWS THAT WAY, #
 * # AND UNTIL 2026-09-21 THE GATE CHARGED A SHRUNK HEADING FOR ROWS IT      #
 * # NEVER DREW ON.                                                          #
 * #                                                                        #
 * # `chapter-plate/heading` is profiled over the TALLEST heading's rows,    #
 * # y 462..594, because the worker profiles a picture by column before any  #
 * # copy is written. A 91px cap draws its letters in y 503..594 and leaves  #
 * # the top 41 rows of that band holding nothing but picture. A BAND WASH   #
 * # filled those rows, because a rectangle does not care where the letters  #
 * # are; A GLYPH HALO CANNOT, because it is attached to glyphs that are not #
 * # there. Same rendered frames, read two ways:                             #
 * #                                                                        #
 * #   shape                   the fixed band y462..594   the drawn rows     #
 * #   3 passes at 0.242 cap        2.25 : 1  FAIL          3.64 : 1         #
 * #   the band it replaced         3.33 : 1                3.31 : 1         #
 * #                                                                        #
 * # Read the band's own row: it scores the SAME either way, because a       #
 * # rectangle covers both row ranges identically. So the fixed band         #
 * # silently favoured a rectangle over a glyph-attached ground, by exactly  #
 * # the amount of empty band a shrunk heading leaves — and the honest       #
 * # credit for a shrunk heading came out at about 0.28, at which the gate   #
 * # refuses beat 28's chapter plate outright and that shot plays with no    #
 * # heading at all.                                                         #
 * #                                                                        #
 * # NEITHER OF THIS FILM'S TWO PLATES IS SHRUNK — beat 28 draws at cap      #
 * # 132.0 and beat 57 at 126.5 — so nothing delivered moves over this. The  #
 * # gate has to hold for every copy the SCHEMA admits, which is the same    #
 * # argument `corner-label.buildEndFrames`' own box makes about a label     #
 * # nobody has written yet.                                                 #
 * #                                                                        #
 * # THEY COMPOSE EXACTLY AND THEY COST NO SECOND DECODE. A mean over a row  #
 * # range is the row-weighted mean of its stripes, and the stripes are      #
 * # disjoint, so the worker reads each row exactly once whatever the        #
 * # stripe height is. `TypeGroundBandSpec.stripePx` is what sets it.        #
 * ##########################################################################
 */
export type TypeGroundStripe = {
  /**
   * How many screen rows this stripe really sampled — the weight its means
   * carry, and ZERO where the pose put every one of them off the picture.
   */
  readonly rows: number
  /**
   * The picture's mean grey per column bucket over THIS STRIPE'S ROWS, 0..1 in
   * sRGB — the same scale `ffmpeg signalstats` prints as YAVG/255 and the same
   * scale every `maxMeanLuma` on the registry is written in.
   */
  readonly lumaMeans: readonly number[]
}

/** One device band on one picture, at one pose of the Ken Burns push. */
export type TypeGroundBand = {
  /** Screen x of the first bucket's left edge. */
  readonly leftPx: number
  readonly bucketPx: number
  /**
   * Sobel magnitudes per column bucket, binned, over THE WHOLE BAND rather than
   * per stripe. See `TYPE_GROUND_EDGE_BINS`.
   *
   * ##########################################################################
   * # NOT SLICED WITH THE LUMA, AND THE ASYMMETRY IS DELIBERATE TWICE OVER.   #
   * #                                                                        #
   * # WHAT IT IS FOR. The busy rule asks whether there is printed matter      #
   * # behind the letters. Reading it over the tallest heading's rows when a   #
   * # shrunk heading is drawn is CONSERVATIVE — it can only find more print,  #
   * # never less — and unlike the level and contrast tests it is not the      #
   * # number the halo's credit is measured against, so over-reading it costs  #
   * # nothing the credit has to pay for.                                      #
   * #                                                                        #
   * # WHAT IT COSTS. A 64-bin histogram per bucket is 64 numbers where a      #
   * # stripe's mean is one. Sliced per stripe as well, the heading band alone #
   * # would carry 22x the numbers it carries now, for every picture in the    #
   * # film, held in memory at once through the chooser.                        #
   * ##########################################################################
   */
  readonly edges: readonly (readonly number[])[]
  /** The band's rows, sliced from the BASELINE UP. See `TypeGroundStripe`. */
  readonly stripes: readonly TypeGroundStripe[]
}

/**
 * One stored picture, measured. Produced by the worker, carried on the beat,
 * read by the gate.
 *
 * `bands` is keyed by `TypeGroundBandSpec.id` and each entry holds ONE BAND PER
 * POSE, in `TYPE_GROUND_POSE_SCALES` order.
 */
export type AssetTypeGround = {
  /**
   * The whole 16:9 frame's mean grey, 0..1, measured rather than guessed.
   *
   * THIS IS THE NUMBER G8 AND planCheck T-7 BOTH READ once it exists. Over the
   * 95 undarkened beats of the delivered film the judge and the pixels disagree
   * by a median of 0.05 and a worst of 0.36, and the worst case is the census
   * form this whole change is about.
   */
  readonly meanLuma: number
  readonly bands: Readonly<Record<string, readonly TypeGroundBand[]>>
}

/* ------------------------------------------------------------------------- */
/* 2 — THE MOVE, WHICH IS A CONSTANT FOR EXACTLY THESE DEVICES                 */
/* ------------------------------------------------------------------------- */

/**
 * `DEVICE_PICTURE_PUSH`, mirrored, because there is NO PLAN AT MEASURING TIME.
 *
 * ##########################################################################
 * # THE OBVIOUS SENTENCE — "apply the plan's Ken Burns pose" — DESCRIBES    #
 * # SOMETHING THAT DOES NOT EXIST YET, AND IT IS CIRCULAR EVEN WHERE IT     #
 * # DOES.                                                                  #
 * #                                                                        #
 * # `deriveMotion` runs inside the plan stage, and for the four devices in  #
 * # `DEVICE_PICTURE_PUSH` the derived move is THROWN AWAY: `plan.ts`'s      #
 * # `motionForDevice` replaces it with a fixed centred push AFTER the       #
 * # device has been chosen. So the pose under a corner label is not a fact  #
 * # about the beat, it is a fact about the DEVICE — which is what makes it  #
 * # safe to know here, before anything is chosen.                          #
 * #                                                                        #
 * # MIRRORED RATHER THAN IMPORTED because `plan.ts` lives in the worker and #
 * # this package may not reach it. `typeGroundMirror.test.ts` in the worker #
 * # imports both and fails if they part company, which is the same shape    #
 * # every other `_MIRROR` in this package is pinned by.                     #
 * ##########################################################################
 */
export const TYPE_GROUND_PUSH_MIRROR = 0.05

/**
 * The two poses every band is measured at: the first frame of the shot and the
 * last.
 *
 * THE MOVE IS SLOW AND IT STILL MATTERS. Measured across scene 1 the band under
 * ALLEGHENY drifts from 0.55 to 0.61 and the fourth letter goes from 17.0:1 to
 * 5.9:1 as a tree edge slides off it. On a beat with a real pan the background
 * under fixed type is REPLACED mid-shot, and nothing in the repo could notice.
 * Every test below takes the WORSE of the two poses.
 */
export const TYPE_GROUND_POSE_SCALES: readonly number[] = [1, 1 + TYPE_GROUND_PUSH_MIRROR]

/* ------------------------------------------------------------------------- */
/* 3 — WHERE EACH DEVICE PUTS ITS INK                                          */
/* ------------------------------------------------------------------------- */

/**
 * The compositor's safe margin, mirrored. The three fit modules each already
 * carry their own copy of this same 96 for the same reason.
 */
export const TYPE_GROUND_SAFE_AREA_X_MIRROR = 96

/**
 * THE BASELINES, MIRRORED OFF THE THREE CLOCK FILES.
 *
 * ##########################################################################
 * # THE FIT MODULES CARRY CAP HEIGHTS AND ADVANCES AND NOT ONE BASELINE,    #
 * # BECAUSE UNTIL NOW NOTHING OUTSIDE THE COMPOSITOR NEEDED TO KNOW WHICH   #
 * # ROWS THE INK OCCUPIES — only how wide it would be.                      #
 * #                                                                        #
 * # `apps/web/src/lib/typeGroundMirror.test.ts` pins every number below     #
 * # against the clock that really draws it, the same way                    #
 * # `cornerLabelMirror.test.ts` and `chapterPlateMirror.test.ts` already    #
 * # pin the cap heights. A baseline that moved in the compositor and not    #
 * # here would have this gate reading the wrong rows with nothing red.      #
 * ##########################################################################
 */
export const CORNER_LABEL_LABEL_BASELINE_MIRROR = 264.95
export const CORNER_LABEL_KICKER_BASELINE_MIRROR = 324.89
export const CHAPTER_PLATE_BASELINE_MIRROR = 594
export const CHAPTER_PLATE_CENTRE_X_MIRROR = 959.5
export const TOP_TITLE_LINE1_BASELINE_MIRROR = 237
export const TOP_TITLE_LINE2_BASELINE_MIRROR = 393
export const TOP_TITLE_CAP_OVER_EM_MIRROR_FOR_GROUND = 0.714

/**
 * THE INK AS THE VIEWER SEES IT, WHICH IS NOT THE INK AS IT IS SPECIFIED.
 *
 * ##########################################################################
 * # THE HOUSE GRADE IS APPLIED OVER THE TYPE, NOT UNDER IT, ON ALL THREE OF #
 * # THESE DEVICES (`carriesOwnGrade: false`, `Scene.tsx` mounts `Grade`     #
 * # after the device). Measured on the delivered film, that costs the       #
 * # corner label 8% at the top right where the vignette bites and GIVES the #
 * # chapter heading 3% at frame centre where the toe lift wins:            #
 * #                                                                        #
 * #   nominal #FDFAE7                    relative luminance 0.9502          #
 * #   corner-label as delivered, corner                     0.8705          #
 * #   chapter-plate as delivered, centre                    0.9813          #
 * #                                                                        #
 * # So a contrast test that used the nominal colour would be 5% optimistic  #
 * # exactly where the frame is worst. These are the delivered readings.     #
 * #                                                                        #
 * # TOP-TITLE IS THE NOMINAL #FFFCE8 AND IS STATED AS SUCH: no delivered    #
 * # measurement of its drawn ink exists, and it is the one of the three     #
 * # that also draws `TOP_TITLE_SHADOW`, which this gate does not model. A   #
 * # shadow only ever helps, so that omission is conservative.               #
 * ##########################################################################
 */
export const CORNER_LABEL_INK_REL_LUM_MIRROR = 0.8705
export const CHAPTER_PLATE_INK_REL_LUM_MIRROR = 0.9813
export const TOP_TITLE_INK_REL_LUM_MIRROR = 0.9668

/**
 * HOW WIDE ONE LETTER'S WINDOW IS, AS A MULTIPLE OF THE CAP HEIGHT.
 *
 * 1.2, so one window is about one capital plus its sidebearings — 65px for the
 * corner label and 152 to 158px for a chapter heading. It is deliberately a
 * MULTIPLE and never a constant: a chapter heading shrinks to fit, down to a
 * 90px cap, and a window sized off `CHAPTER_PLATE_CAP_HEIGHT_MIRROR` would be
 * too wide for every shrunk heading — including "Surveyors and a plan", which
 * is the thinnest margin this whole gate has.
 */
export const TYPE_GROUND_WINDOW_OVER_CAP = 1.2

/**
 * HOW FINELY THE ONE BAND WHOSE INK HEIGHT VARIES IS SLICED.
 *
 * ONE ROW, so the rows the gate charges are the rows the letters really cover,
 * to the pixel. A chapter heading's cap is a continuous function of its copy —
 * `chapterPlateHeadingFontSizePx` divides the title-safe measure by the
 * heading's own advance width — so there is no coarser quantum that lands on
 * the real cap rather than near it.
 *
 * IT IS NOT EXPENSIVE, because the stripes are disjoint: the worker reads each
 * of the band's 132 rows exactly once whatever this is, and what the slicing
 * adds is 131 extra means per column bucket. The 64-bin Sobel histogram, which
 * is the part that would be expensive, is NOT sliced — see `TypeGroundBand`.
 */
export const TYPE_GROUND_HEADING_STRIPE_PX = 1

/** One device band: fixed rows, the full title-safe width. */
export type TypeGroundBandSpec = {
  readonly id: string
  readonly device: DeviceId
  /** Inclusive top row, in screen pixels at the settled size. */
  readonly topPx: number
  /** Exclusive bottom row. */
  readonly bottomPx: number
  /**
   * How many rows one stripe covers, counted from `bottomPx` UPWARD.
   *
   * THE BAND'S OWN HEIGHT WHERE THE INK'S HEIGHT NEVER VARIES, which makes one
   * stripe and is exactly what those bands carried before stripes existed. A
   * device whose type shrinks to fit declares a finer one, and today there is
   * one of those; see `TYPE_GROUND_HEADING_STRIPE_PX`.
   */
  readonly stripePx: number
}

/**
 * EVERY BAND THE WORKER PROFILES, FOR EVERY PICTURE.
 *
 * Five bands over three devices. The rows are the ink's own rows at the SETTLED
 * size, which is where the type spends the shot and where it is largest.
 *
 * ##########################################################################
 * # THE CHAPTER PLATE'S GROUP GROWS FROM 0.765 TO 1.000 OVER ITS FIRST 75  #
 * # FRAMES, SO ITS BAND IS SMALLER AND HIGHER EARLY IN THE SHOT. That is a #
 * # sub-second transient inside a settled band this one contains, and it    #
 * # is not modelled. Measured on the delivered census shot the difference   #
 * # is 0.893 at the start against 0.907 settled — a hundredth.              #
 * #                                                                        #
 * # THE CORNER LABEL'S KICKER BAND IS PROFILED WHETHER OR NOT A KICKER IS   #
 * # DRAWN, because the profile is per PICTURE and the copy is not known     #
 * # yet. `typeGroundRectsFor` is what leaves it out when the slot is empty. #
 * ##########################################################################
 */
export const TYPE_GROUND_BAND_SPECS: readonly TypeGroundBandSpec[] = [
  {
    id: 'corner-label/label',
    device: 'corner-label',
    topPx: CORNER_LABEL_LABEL_BASELINE_MIRROR - CORNER_LABEL_LABEL_CAP_HEIGHT_MIRROR,
    bottomPx: CORNER_LABEL_LABEL_BASELINE_MIRROR,
    /* Set at ONE size on every frame of every film, so one stripe is the band. */
    stripePx: CORNER_LABEL_LABEL_CAP_HEIGHT_MIRROR,
  },
  {
    id: 'corner-label/kicker',
    device: 'corner-label',
    topPx: CORNER_LABEL_KICKER_BASELINE_MIRROR - CORNER_LABEL_KICKER_CAP_HEIGHT_MIRROR,
    bottomPx: CORNER_LABEL_KICKER_BASELINE_MIRROR,
    stripePx: CORNER_LABEL_KICKER_CAP_HEIGHT_MIRROR,
  },
  {
    /*
     * The band is the TALLEST heading's rows; a shrunk one sits inside it.
     *
     * `CHAPTER_PLATE_CAP_HEIGHT_MIRROR` AND NOT A LITERAL 132. It was typed as
     * a bare 132 until 2026-09-21, beside three other constants imported from
     * the same fit module, so a cap-height change in the compositor would have
     * left this gate slicing rows the letters had moved off — and the mirror
     * test's `<=` assertions would have stayed green through it. That constant
     * has already moved once, from 152, and the box on `capHeightPx` in
     * `chapterPlateClock.ts` is the record of what it cost.
     */
    id: 'chapter-plate/heading',
    device: 'chapter-plate',
    topPx: CHAPTER_PLATE_BASELINE_MIRROR - CHAPTER_PLATE_CAP_HEIGHT_MIRROR,
    bottomPx: CHAPTER_PLATE_BASELINE_MIRROR,
    /*
     * THE ONLY STRIPED BAND IN THE FILE, because it is the only device whose
     * type shrinks to fit. The band above it is the TALLEST heading's rows and
     * the baseline is what is held fixed, so a shrunk heading occupies the
     * BOTTOM stripes and `readTypeGround` charges it for those alone. See
     * `TypeGroundStripe` for what charging it for the rest cost.
     */
    stripePx: TYPE_GROUND_HEADING_STRIPE_PX,
  },
  {
    id: 'top-title/line1',
    device: 'top-title',
    topPx: TOP_TITLE_LINE1_BASELINE_MIRROR - TOP_TITLE_CAP_HEIGHT_MIRROR,
    bottomPx: TOP_TITLE_LINE1_BASELINE_MIRROR,
    stripePx: TOP_TITLE_CAP_HEIGHT_MIRROR,
  },
  {
    id: 'top-title/line2',
    device: 'top-title',
    topPx: TOP_TITLE_LINE2_BASELINE_MIRROR - TOP_TITLE_CAP_HEIGHT_MIRROR,
    bottomPx: TOP_TITLE_LINE2_BASELINE_MIRROR,
    stripePx: TOP_TITLE_CAP_HEIGHT_MIRROR,
  },
]

/**
 * WHICH STRIPE A SCREEN ROW FALLS INTO, counted from the band's BASELINE UP.
 *
 * Row `bottomRow - 1` — the last row the band covers, the one sitting on the
 * baseline — is stripe 0, and the numbers climb toward the cap.
 *
 * ##########################################################################
 * # THE DEFINITION LIVES HERE BECAUSE TWO FILES HAVE TO AGREE ON IT AND     #
 * # NEITHER MAY IMPORT THE OTHER. `apps/worker/src/media/typeGround.ts`     #
 * # fills the stripes and `readTypeGround` below reads them back; a worker  #
 * # that numbered them from the TOP would hand the gate a band whose bottom #
 * # stripes were its cap rows, and every shrunk heading would then be       #
 * # judged on the rows it does not draw on — the exact defect the slicing   #
 * # exists to remove, with nothing red.                                     #
 * #                                                                        #
 * # AND THE STRIPE COUNT IS DERIVED FROM IT rather than computed beside it: #
 * # a band's stripe count is `typeGroundStripeOf(bottom, top, stripePx) + 1`#
 * # by definition. Counting them as `ceil(rows / stripePx)` instead was     #
 * # tried and it is off by one whenever `stripePx` does not divide the rows #
 * # — a 93-row top-title band at a 92.8px stripe comes out as two, the      #
 * # second holding nothing at all.                                         #
 * ##########################################################################
 */
export function typeGroundStripeOf(bottomRow: number, rowPx: number, stripePx: number): number {
  return Math.floor((bottomRow - 1 - rowPx) / stripePx)
}

/** Which devices this gate can judge at all. Everything else abstains. */
export const TYPE_GROUND_DEVICES: readonly DeviceId[] = ['corner-label', 'chapter-plate', 'top-title']

/** Where one line of one device's copy really lands, and how tall its ink is. */
export type TypeGroundRect = {
  readonly bandId: string
  readonly x0: number
  readonly x1: number
  /**
   * THE CAP HEIGHT THIS LINE IS REALLY DRAWN AT, and the rectangle's two
   * remaining dimensions both come off it.
   *
   * ##########################################################################
   * # ONE FIELD WHERE THERE WERE TWO, AND IT IS THE ONE THE COMPOSITOR DRAWS  #
   * # WITH. This used to be `windowPx`, already computed as                   #
   * # `TYPE_GROUND_WINDOW_OVER_CAP * cap` at every one of the call sites      #
   * # below. The gate now needs the cap for a SECOND reason — it is the       #
   * # number of rows above the baseline that really hold ink, which is what   #
   * # `readTypeGround` slices its stripes to — so carrying the window instead #
   * # would mean dividing the multiple back out to recover it.                #
   * #                                                                        #
   * # A rect that carried both could carry two caps. This one cannot.         #
   * ##########################################################################
   */
  readonly capPx: number
}

/**
 * ONE LETTER'S WINDOW for a rectangle, `TYPE_GROUND_WINDOW_OVER_CAP` times the
 * cap the line is really drawn at. Exported because every probe and every
 * measurement that reproduces the gate's arithmetic needs the same width.
 */
export function typeGroundWindowPx(rect: TypeGroundRect): number {
  return TYPE_GROUND_WINDOW_OVER_CAP * rect.capPx
}

/**
 * THE RECTANGLES THE COPY REALLY OCCUPIES.
 *
 * Null for every device this gate does not judge, and for copy whose own fit
 * module refuses to measure it — which `buildCopy` has already refused anyway.
 *
 * THE GEOMETRY IS THE COMPONENT'S OWN, hop for hop:
 *
 *   corner-label   `CornerLabel.tsx` anchors an inner box on the title-safe
 *                  box's TOP-RIGHT corner, so the block's right edge is
 *                  `FRAME_WIDTH - SAFE_AREA_X`. The two lines are LEFT-aligned
 *                  inside a box that shrinks to the wider of them, so a short
 *                  kicker starts where the long label starts and stops early.
 *   chapter-plate  `ChapterPlate.tsx` centres the heading in the title-safe
 *                  box, whose centre is the frame's own 959.5.
 *   top-title      `TopTitle.tsx` sets both lines from `TOP_TITLE_LEFT_MIRROR`.
 */
/**
 * THE RECTANGLES A READING WAS TAKEN OVER, AS ONE COMPARABLE STRING.
 *
 * ##########################################################################
 * # THE STORED READING WAS MATCHED ON BEAT, DEVICE AND PICTURE, AND NONE   #
 * # OF THOSE THREE IS WHAT DECIDES WHERE THE LETTERS SIT. THE COPY IS.     #
 * #                                                                        #
 * # Found by the T-26 attack on 2026-09-24, on the real 116-beat Kinzua    #
 * # plan. Beat 59, a real archive photograph, legal copy on both sides,    #
 * # ONLY THE WORDS DIFFERING: the frozen row said `worstWindow` 16.0096,   #
 * # the patched frame really reads 1.9363, and T-26 printed PASS and       #
 * # quoted the stale 16.01 in its own note. Re-measuring the same plan     #
 * # gives FAIL, so the arithmetic was right and only the MATCHING was      #
 * # wrong. On 11 of 48 real photographs, legal top-title copies straddle   #
 * # the floor of 3 on the SAME picture, so this was not a synthetic edge.  #
 * #                                                                        #
 * # WHY THE RECTS AND NOT THE WORDS. `typeGroundRectsFor` is the only      #
 * # thing that reads the copy, and it reads it to compute widths. Two      #
 * # different strings that produce the same rectangles describe the same   #
 * # frame and the reading is genuinely still valid for both, so pinning    #
 * # the words would report UNPROVEN on an edit that changed nothing.       #
 * # Pinning the rectangles is exactly as strict as the measurement is.     #
 * #                                                                        #
 * # ROUNDED TO WHOLE PIXELS, so float noise between two builds cannot      #
 * # invent a mismatch. A sub-pixel shift moves no letter onto new ground.  #
 * ##########################################################################
 */
export function typeGroundRectKey(rects: readonly TypeGroundRect[]): string {
  return rects
    .map(
      (rect) =>
        `${rect.bandId}:${String(Math.round(rect.x0))},${String(Math.round(rect.x1))},${String(Math.round(rect.capPx))}`,
    )
    .join('|')
}

export function typeGroundRectsFor(copy: SceneDevice): readonly TypeGroundRect[] | null {
  switch (copy.id) {
    case 'corner-label': {
      const labelWidth = cornerLabelLabelWidth(copy.label)
      if (labelWidth === null) return null
      const kickerWidth = copy.kicker === '' ? 0 : (cornerLabelKickerWidth(copy.kicker) ?? null)
      if (kickerWidth === null) return null

      const right = FRAME_WIDTH - TYPE_GROUND_SAFE_AREA_X_MIRROR
      const blockLeft = right - Math.max(labelWidth, kickerWidth)
      const rects: TypeGroundRect[] = [
        {
          bandId: 'corner-label/label',
          x0: blockLeft,
          x1: blockLeft + labelWidth,
          capPx: CORNER_LABEL_LABEL_CAP_HEIGHT_MIRROR,
        },
      ]
      if (copy.kicker !== '') {
        rects.push({
          bandId: 'corner-label/kicker',
          x0: blockLeft,
          x1: blockLeft + kickerWidth,
          capPx: CORNER_LABEL_KICKER_CAP_HEIGHT_MIRROR,
        })
      }
      return rects
    }

    case 'chapter-plate': {
      const sizePx = chapterPlateHeadingFontSizePx(copy.heading)
      const mirrorWidth = chapterPlateHeadingWidth(copy.heading)
      if (sizePx === null || mirrorWidth === null) return null
      /*
       * THE DRAWN WIDTH, NOT THE MIRROR WIDTH. A heading over the measure is
       * SET SMALLER rather than thrown away (the client's 2026-09-16 ruling),
       * so an over-wide one draws at exactly the measure and its cap height
       * comes down with it. Both numbers below follow the drawn size.
       */
      const drawnWidth = Math.min(mirrorWidth, CHAPTER_PLATE_MAX_WIDTH)
      const capPx = sizePx * CHAPTER_PLATE_CAP_OVER_EM_MIRROR
      return [
        {
          bandId: 'chapter-plate/heading',
          x0: CHAPTER_PLATE_CENTRE_X_MIRROR - drawnWidth / 2,
          x1: CHAPTER_PLATE_CENTRE_X_MIRROR + drawnWidth / 2,
          capPx,
        },
      ]
    }

    case 'top-title': {
      const width1 = topTitleLine1Width(copy.line1)
      if (width1 === null) return null
      const capPx = TOP_TITLE_CAP_HEIGHT_MIRROR
      const rects: TypeGroundRect[] = [
        { bandId: 'top-title/line1', x0: TOP_TITLE_LEFT_MIRROR, x1: TOP_TITLE_LEFT_MIRROR + width1, capPx },
      ]
      if (copy.line2 !== '') {
        const width2 = topTitleLine2Width(copy.line2)
        if (width2 === null) return null
        rects.push({
          bandId: 'top-title/line2',
          x0: TOP_TITLE_LEFT_MIRROR,
          x1: TOP_TITLE_LEFT_MIRROR + width2,
          capPx,
        })
      }
      return rects
    }

    default:
      return null
  }
}

/** The ink's own relative luminance, as the viewer sees it. See the box above. */
export function typeGroundInkRelLum(id: DeviceId): number | null {
  if (id === 'corner-label') return CORNER_LABEL_INK_REL_LUM_MIRROR
  if (id === 'chapter-plate') return CHAPTER_PLATE_INK_REL_LUM_MIRROR
  if (id === 'top-title') return TOP_TITLE_INK_REL_LUM_MIRROR
  return null
}

/* ------------------------------------------------------------------------- */
/* 4 — THE ARITHMETIC                                                          */
/* ------------------------------------------------------------------------- */

/** One sRGB channel, 0..1, to its linear-light value. The WCAG transfer curve. */
export function srgbToLinear(channel: number): number {
  const clamped = channel < 0 ? 0 : channel > 1 ? 1 : channel
  return clamped <= 0.04045 ? clamped / 12.92 : Math.pow((clamped + 0.055) / 1.055, 2.4)
}

/*
 * ##########################################################################
 * # `linearToSrgb` LIVED HERE AND IS DELETED WITH THE SOLVER IT EXISTED FOR. #
 * #                                                                        #
 * # It was the exact inverse of the curve above, and its own comment said   #
 * # it was for `typeGroundWashAlpha` "and for nothing else": the solver ran #
 * # the arithmetic backwards to ask how bright a ground may be at most, and #
 * # every other reader of this file runs it forwards. No device solves a    #
 * # depth any more — both of them carry a fixed glyph halo — so the         #
 * # question has no asker and the function goes rather than sitting here    #
 * # unreachable. `srgbToLinear` above is untouched.                          #
 * ##########################################################################
 */

/** WCAG contrast between two relative luminances, lighter over darker. */
export function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * THE GROUND'S CREDIT APPLIED, AS A UNIFORM MULTIPLY.
 *
 * `grey * (1 - alpha)` is what a black layer at `alpha` over an opaque picture
 * really composites to in sRGB — CSS composites in gamma space, not in linear
 * light, and the two differ by a great deal at these alphas.
 *
 * ##########################################################################
 * # NOTHING IN THE FILM PAINTS SUCH A LAYER ANY MORE, AND THE FUNCTION      #
 * # STAYS BECAUSE THE MODEL DOES. Both devices that own their ground now    #
 * # carry a GLYPH HALO, which is not a uniform multiply at all. What        #
 * # `scrimAlpha` records for each of them is the multiply that halo is      #
 * # WORTH over a window one capital wide, measured window by window at the  #
 * # same column on a rendered halo frame against a rendered bare one — so   #
 * # the arithmetic here is unchanged and only its input changed meaning.    #
 * # The two registry rows carry the measurement and name the renders.       #
 * #                                                                        #
 * # WHICH MAKES THIS A MODEL OF A RENDER RATHER THAN A DESCRIPTION OF ONE,  #
 * # AND THAT IS STATED HERE SO A READER OF `level` OR `worstWindow` KNOWS   #
 * # WHAT THEY ARE HOLDING. A halo is deep on the letters and gone a few     #
 * # tens of pixels away; a multiply is even. They agree on the number the   #
 * # gate needs — the worst one-letter window — and nowhere else.            #
 * ##########################################################################
 */
export function washedGrey(grey: number, alpha: number): number {
  return grey * (1 - alpha)
}

/** What the gate learned about one device's ground on one beat. */
export type TypeGroundReading = {
  /** Region mean grey AFTER the device's own wash, 0..1. */
  readonly level: number
  /** The worst one-letter window's contrast against the ink, AFTER the wash. */
  readonly worstWindow: number
  /**
   * Region Sobel p95 on the UNDARKENED picture, AND THERE IS DELIBERATELY NO
   * WASHED TWIN OF IT.
   *
   * ##########################################################################
   * # A `edgeP95: rawEdgeP95 * (1 - scrimAlpha)` FIELD SAT HERE UNTIL         #
   * # 2026-09-21 AND IT IS WHAT SWITCHED THE BUSY RULE OFF.                   #
   * #                                                                        #
   * # A wash is linear in the pixel values, so it scales every Sobel edge by  #
   * # the same factor and removes not one printed rule. Judging the SCALED    #
   * # number against a threshold calibrated on RAW ones means a device at     #
   * # alpha 0.55 is refused only past a raw 96 / 0.45 = 213 — above every     #
   * # picture in the delivered film, the busiest of them included at 204.     #
   * # A rule that cannot fire is not a lenient rule, it is an absent one.     #
   * #                                                                        #
   * # So the busy test reads THIS number for every device, and the leniency a #
   * # wash has earned is written down as a second, higher ceiling that a      #
   * # person can see and retune. See `TYPE_GROUND_MAX_EDGE_P95_WASHED`.       #
   * ##########################################################################
   */
  readonly rawEdgeP95: number
  /*
   * ##########################################################################
   * # `brightestWindow` AND `rawLevel` SAT HERE AND ARE DELETED WITH THE      #
   * # SOLVER THAT WAS THEIR ONLY READER.                                      #
   * #                                                                        #
   * # Both were RAW maxima taken across every pose, carried so                #
   * # `typeGroundWashAlpha` could run the arithmetic backwards and solve one  #
   * # shot's band depth. No band is painted any more, nothing solves a depth, #
   * # and a field that no reader reads is a field the next person has to      #
   * # work out the purpose of. The three tests below read `level`,            #
   * # `worstWindow` and `rawEdgeP95` and nothing else, exactly as they did    #
   * # before the solver existed.                                              #
   * ##########################################################################
   */
  /** Which pose produced the worst reading, for the report. */
  readonly poseIndex: number
}

function bucketOverlap(
  band: TypeGroundBand,
  index: number,
  x0: number,
  x1: number,
): number {
  const left = band.leftPx + index * band.bucketPx
  const right = left + band.bucketPx
  return Math.max(0, Math.min(right, x1) - Math.max(left, x0))
}

/**
 * THE ROWS THIS LINE'S INK REALLY COVERS, AS ONE MEAN PER COLUMN BUCKET.
 *
 * The band's stripes run from the BASELINE UP and the baseline is what every
 * one of these devices holds fixed, so a line `capPx` tall occupies the bottom
 * stripes and nothing above them. This walks them until it has covered the cap
 * and returns the row-weighted mean, which IS the mean over those rows.
 *
 * ##########################################################################
 * # IT TAKES THE STRIPE THAT STRADDLES THE CAP LINE RATHER THAN DROPPING    #
 * # IT, so the rows charged are the drawn cap ROUNDED UP to a stripe        #
 * # boundary — at most `stripePx - 1` rows of picture the letters do not    #
 * # reach. On the one band where that could matter `stripePx` is 1, so the  #
 * # over-reach is under one row on a 91-row cap. Up is the safe direction:  #
 * # a row with no ink on it can only make the ground look worse, and the    #
 * # number this feeds is what admits or refuses a device.                   #
 * #                                                                        #
 * # A STRIPE THE POSE PUT OFF THE PICTURE CARRIES `rows: 0` AND IS SKIPPED  #
 * # WITHOUT ADVANCING THE COUNT, because it contributed no pixels to weight #
 * # with. That cannot happen at the poses and bands this film uses — a 5%   #
 * # centred push keeps every one of these rows inside the frame — and it is #
 * # handled rather than asserted because abstaining is the only honest      #
 * # answer if it ever does.                                                 #
 * ##########################################################################
 *
 * Null when the band carries no sampled stripes at all, which is the same
 * "nobody looked" every caller already abstains on.
 */
function inkColumnMeans(band: TypeGroundBand, capPx: number): readonly number[] | null {
  const sums = new Array<number>(band.edges.length).fill(0)
  let rows = 0
  for (const stripe of band.stripes) {
    if (rows >= capPx) break
    if (stripe.rows <= 0) continue
    for (let index = 0; index < sums.length; index += 1) {
      sums[index] = (sums[index] ?? 0) + (stripe.lumaMeans[index] ?? 0) * stripe.rows
    }
    rows += stripe.rows
  }
  if (rows <= 0) return null
  return sums.map((sum) => sum / rows)
}

/** The p95 of a summed histogram, in magnitude units. */
function histogramP95(bins: readonly number[]): number {
  let total = 0
  for (const count of bins) total += count
  if (total === 0) return 0
  const target = total * 0.95
  let seen = 0
  for (let index = 0; index < bins.length; index += 1) {
    seen += bins[index] ?? 0
    if (seen >= target) return ((index + 1) * 256) / bins.length
  }
  return 256
}

/**
 * READ ONE DEVICE'S GROUND. Null when nothing measured this picture.
 *
 * ##########################################################################
 * # THE WORST POSE AND THE WORST LINE, NEVER AN AVERAGE OF EITHER.          #
 * #                                                                        #
 * # A device draws its type for the whole shot and a viewer reads it at     #
 * # whichever frame is worst. Averaging the two ends of the push would have #
 * # admitted scene 1, whose fourth letter starts at 17:1 and ends at 5.9:1. #
 * # Averaging the two lines of a top title would let a legible headline     #
 * # carry an illegible second line.                                         #
 * ##########################################################################
 */
export function readTypeGround(
  ground: AssetTypeGround,
  rects: readonly TypeGroundRect[],
  inkRelLum: number,
  scrimAlpha: number,
): TypeGroundReading | null {
  let worst: TypeGroundReading | null = null

  for (let pose = 0; pose < TYPE_GROUND_POSE_SCALES.length; pose += 1) {
    let level = 0
    let weight = 0
    let worstWindow = Number.POSITIVE_INFINITY
    const regionEdges = new Array<number>(TYPE_GROUND_EDGE_BINS).fill(0)
    let measured = false

    for (const rect of rects) {
      const band = ground.bands[rect.bandId]?.[pose]
      if (band === undefined) continue
      /*
       * THE ROWS THIS LINE'S LETTERS REALLY COVER, not the whole profiled band.
       * On every device but the chapter plate those are the same rows; see
       * `TypeGroundStripe` for what the difference is worth on a shrunk heading
       * and why a band wash never had to care.
       */
      const means = inkColumnMeans(band, rect.capPx)
      if (means === null) continue
      measured = true

      /* The region's own mean, weighted by how much of each bucket it covers. */
      const covers: number[] = []
      for (let index = 0; index < band.edges.length; index += 1) {
        const overlap = bucketOverlap(band, index, rect.x0, rect.x1)
        covers.push(overlap)
        if (overlap <= 0) continue
        level += (means[index] ?? 0) * overlap
        weight += overlap
        const edges = band.edges[index]
        if (edges === undefined) continue
        for (let bin = 0; bin < TYPE_GROUND_EDGE_BINS; bin += 1) {
          regionEdges[bin] = (regionEdges[bin] ?? 0) + (edges[bin] ?? 0) * (overlap / band.bucketPx)
        }
      }

      /*
       * THE SLIDING WINDOW, ONE LETTER WIDE. This is the measurement the two
       * complained frames need and a regional mean cannot give: ALLEGHENY's
       * rectangle has a perfectly innocent mean and three letters at 1.11:1.
       */
      const perWindow = Math.max(1, Math.round(typeGroundWindowPx(rect) / band.bucketPx))
      for (let start = 0; start + perWindow <= band.edges.length; start += 1) {
        let sum = 0
        let span = 0
        for (let index = start; index < start + perWindow; index += 1) {
          const overlap = covers[index] ?? 0
          if (overlap <= 0) continue
          sum += (means[index] ?? 0) * overlap
          span += overlap
        }
        /* Windows that the copy does not actually cover are not the copy's. */
        if (span < perWindow * band.bucketPx * 0.5) continue
        const washed = washedGrey(sum / span, scrimAlpha)
        const ratio = contrastRatio(inkRelLum, srgbToLinear(washed))
        if (ratio < worstWindow) worstWindow = ratio
      }
    }

    if (!measured || weight === 0 || worstWindow === Number.POSITIVE_INFINITY) continue

    const reading: TypeGroundReading = {
      level: washedGrey(level / weight, scrimAlpha),
      worstWindow,
      /*
       * RAW, AND `scrimAlpha` IS NOT ALLOWED TO TOUCH IT. Sobel is linear in
       * the pixel values, so a ground that dimmed the picture evenly would take
       * a gradient of 50 to 27.5 and leave every ruled line exactly where it
       * was. See the box on the field.
       */
      rawEdgeP95: histogramP95(regionEdges),
      poseIndex: pose,
    }
    if (worst === null || worseThan(reading, worst)) worst = reading
  }

  return worst
}

/** Is `a` the reading a reader should be shown? Worst level, worst window, busiest. */
function worseThan(a: TypeGroundReading, b: TypeGroundReading): boolean {
  if (a.worstWindow !== b.worstWindow) return a.worstWindow < b.worstWindow
  if (a.level !== b.level) return a.level > b.level
  return a.rawEdgeP95 > b.rawEdgeP95
}

/* ------------------------------------------------------------------------- */
/* 5 — THE THRESHOLDS                                                          */
/* ------------------------------------------------------------------------- */

/**
 * LEVEL. A region this pale cannot hold cream type however the letters fall.
 *
 * ##########################################################################
 * # 0.62 AND NOT THE REGISTRY'S 0.55, BECAUSE THIS IS A DIFFERENT           #
 * # MEASUREMENT OF A DIFFERENT THING AND HAS TO BE CALIBRATED AGAINST       #
 * # FRAMES THE CLIENT ACCEPTED RATHER THAN AGAINST THE OLD NUMBER.          #
 * #                                                                        #
 * # The brightest region in a frame he accepted is beat 57, "Surveyors and  #
 * # a plan", measured here at 0.571. The dimmest in a frame he rejected is  #
 * # beat 28's census page at 0.900. 0.62 sits 9% above everything accepted  #
 * # and 31% below everything rejected. His own chapter-title reference,     #
 * # measured off his clip, is a parchment at 0.49 to 0.53, so this admits   #
 * # his own hard case.                                                      #
 * #                                                                        #
 * # THE MARGIN IS THIN AND IT IS STATED RATHER THAN HIDDEN. Beat 57's       #
 * # DELIVERED heading region climbs to 0.628 in the middle of the shot,     #
 * # above this line — because the plan lays a dust ambience plate over that #
 * # whole beat, which this gate never sees. Two accepted frames is a small  #
 * # calibration sample.                                                     #
 * #                                                                        #
 * # AND IT STOPS BEING THE BINDING TEST THE MOMENT A DEVICE DRAWS A WASH,   #
 * # which is correct: contrast is what readability actually is, and LEVEL   #
 * # is only the crude proxy that catches a page no arrangement of letters   #
 * # could survive.                                                          #
 * ##########################################################################
 */
export const TYPE_GROUND_MAX_LEVEL = 0.62

/**
 * CONTRAST. The project's own floor for large type, and the test that binds.
 *
 * 3.0:1 is WCAG AA for large text and it is already this project's number:
 * `title.test.ts` T-TI6 holds every title to it, and `constants.ts` sizes the
 * overlay scrim by the same algebra. What is new is that it is measured on a
 * PHOTOGRAPH rather than assumed against a hypothetical white one.
 *
 * ONE LETTER, NOT THE LINE. See `TYPE_GROUND_WINDOW_OVER_CAP`.
 */
export const TYPE_GROUND_MIN_CONTRAST = 3

/*
 * ##########################################################################
 * # THE DEPTH SOLVER LIVED HERE AND IS DELETED. `TYPE_GROUND_CONTRAST_      #
 * # MARGIN`, `ceilToHundredth` and `typeGroundWashAlpha` between them       #
 * # answered one question — HOW DEEP SHOULD THIS SHOT'S BAND BE — and no    #
 * # device paints a band any more, so nothing asks it.                      #
 * #                                                                        #
 * # WHAT THE MARGIN WAS AND WHY IT DOES NOT SURVIVE THE MOVE. It was 1.25,  #
 * # the ratio by which the gate's arithmetic over-read a rendered frame,    #
 * # fitted on three measured pairs and used to aim the SOLVE high enough    #
 * # that the frame still cleared 3.0:1. It bought headroom in a number the  #
 * # chooser computed. A halo's credit is not computed at all: it is         #
 * # MEASURED ON A RENDERED FRAME, window by window at the same column,      #
 * # against a rendered bare one — so the gap the margin existed to cover is #
 * # inside the measurement rather than outside it, and adding it again      #
 * # would be counting the same correction twice. The discipline that        #
 * # replaces it is on the registry rows: each records a worst measured      #
 * # credit and ships about 3% under it.                                     #
 * #                                                                        #
 * # AND THE THIRD TERM GOES WITH IT, which is worth one line because it was #
 * # load-bearing. `alphaForG8` forced the drawn depth to satisfy the very   #
 * # inequality G8 had tested at the registry cap, so planCheck T-7 reading  #
 * # the DRAWN number could never fail a beat G8 passed. With one fixed      #
 * # number per device there is no drawn-versus-cap distinction left for the #
 * # two to disagree about: G8, G8c and T-7 all read `spec.scrimAlpha`.      #
 * ##########################################################################
 */

/**
 * BUSY. Printed matter behind the letters, measured instead of asked about.
 *
 * ##########################################################################
 * # THIS IS `hasBakedText` DONE IN PIXELS, AND THAT IS WHY IT IS ANSWERED   #
 * # AT G9 AS WELL AS HERE.                                                  #
 * #                                                                        #
 * # The vision judge is told, verbatim, that "the print on a page being     #
 * # photographed" is NOT added text and must answer false, so G9 can never  #
 * # fire on a photograph of a document. It answered false on a 1940 census  #
 * # form and it was RIGHT TO: the question it was asked is about provenance #
 * # and the question G9 needs answered is about legibility. `gemini.ts`     #
 * # predicted this in writing and deferred the fix twice, the second time   #
 * # saying it "should not be deferred again". This is that fix, in pixels,  #
 * # for no model call, no prompt bump and no re-judging.                    #
 * ##########################################################################
 *
 * ##########################################################################
 * # 96, MEASURED ON THIS IMPLEMENTATION'S OWN SCALE AND NOT COPIED FROM A   #
 * # NOTE. A Sobel number means nothing without the operator that produced   #
 * # it, so the calibration was re-run against this file's own arithmetic    #
 * # rather than inherited from the audit that asked for the rule.           #
 * #                                                                        #
 * # Over the 89 shots of the delivered film that draw NO device and NO      #
 * # overlay, sampled past their own transition, the chapter-plate band      #
 * # reads a median of 48 and a p90 of 96. The two frames the client has     #
 * # accepted read 24 and 24. The census page reads 112. Its three           #
 * # neighbours, ordinary archival photographs the same gate must admit,     #
 * # read 72, 48 and 64.                                                     #
 * #                                                                        #
 * # So the line has to sit above 72 and below 112, and 96 is where the      #
 * # film's own ordinary pictures stop: it refuses the busiest tenth, which  #
 * # on this film is the documents and the pen-and-ink drawings (beats 33 at #
 * # 208, 35 at 184, 67 at 168, 31 at 120), and admits everything else.      #
 * #                                                                        #
 * # THIS CEILING IS FOR A DEVICE THAT DRAWS NO WASH. A device that draws    #
 * # one gets a second, higher one; see `TYPE_GROUND_MAX_EDGE_P95_WASHED`,   #
 * # whose box carries a SECOND sample of this same film and says where the  #
 * # two disagree. Neither is re-tuned to match the other: they are          #
 * # different frames of different shots and they are labelled as such.      #
 * ##########################################################################
 */
export const TYPE_GROUND_MAX_EDGE_P95 = 96

/**
 * THE SAME RULE FOR A DEVICE THAT PAINTS ITS OWN WASH, AT A CEILING CHOSEN ON
 * PURPOSE RATHER THAN FALLING OUT OF THE ARITHMETIC.
 *
 * ##########################################################################
 * # THE ALTERNATIVE WAS TO EXEMPT THE TWO WASH DEVICES FROM THIS TEST       #
 * # because they draw their own ground. That is too broad: it re-opens      #
 * # type-on-a-document for every future film and for every copy, not just   #
 * # for the one frame that provoked it. A wash DIMS printed rules and       #
 * # cannot remove one, which is the whole reason the raw number exists.     #
 * #                                                                        #
 * # AND THE OTHER ALTERNATIVE — judging the WASHED number against the 96 —  #
 * # is that exemption by accident, which is what the first draft of this    #
 * # file shipped. At alpha 0.55 it puts the real line at 96 / 0.45 = 213,   #
 * # above every picture in this film including the busiest at 204, so the   #
 * # two devices the change exists to protect had no picture gate at all.    #
 * # Measured: that rule refused 0 of 115 shots. This one refuses 5.         #
 * ##########################################################################
 *
 * ##########################################################################
 * # WHERE 128 COMES FROM, ON THIS FILM'S OWN NUMBERS.                       #
 * #                                                                        #
 * # The chapter-plate heading band, RAW Sobel p95, over all 115 shots of    #
 * # the delivered film that carry a picture, read at each shot's own first  #
 * # clean frame. Median 40, p90 88. The whole tail, with what each picture  #
 * # actually is:                                                            #
 * #                                                                        #
 * #    20        beat 57 — a frame the client ACCEPTED                      #
 * #   100 100    beats 85, 86 — photographs of wampum belts                 #
 * #   108        beat 92 — a photograph of a building                        #
 * #   112        BEAT 28, THE 1940 CENSUS PAGE — must keep its heading      #
 * #   116        beat 31 — a 1922 park plan, a map                           #
 * #   ------------------------------ 128                                     #
 * #   144        beat 72 — a TVA map                                         #
 * #   148        beat  8 — an engraved plaque                                #
 * #   168        beat 67 — an 1794 territory map                             #
 * #   180        beat 35 — a pen-and-ink illustration                        #
 * #   204        beat 33 — a pen-and-ink drawing, the busiest in the film    #
 * #                                                                        #
 * # 116 to 144 is the widest step anywhere in the tail, and 128 sits in it. #
 * # It is also exactly 96 x 4/3 — a third again for a device that owns its  #
 * # ground — and the two derivations landing together is the only reason it #
 * # is not a round guess.                                                    #
 * #                                                                        #
 * # THE CENSUS PAGE IS WHY THE LINE CANNOT GO LOWER, AND IT IS NOT A CLEAN  #
 * # SPLIT. Beat 28 is a printed document and it is admitted, because a      #
 * # still rendered under the real band shows its rows reading as texture    #
 * # behind the heading rather than as competing type. Beat 31's map, four   #
 * # units busier, is admitted with it. So this line is not "documents out,  #
 * # photographs in" — it is "as busy as the one document a wash was proved  #
 * # to rescue, and no busier". Said plainly because a reader retuning this  #
 * # will otherwise look for a cleaner rule that the film does not contain.  #
 * #                                                                        #
 * # WHAT IT COSTS. Five shots could not carry a chapter plate even under a  #
 * # wash. None of them draws one today and none gains one from this commit, #
 * # so nothing in the delivered film changes hands over it; the replay over #
 * # `art5e14` and the rebuilt pixel plan both confirm the same two shot     #
 * # changes with this rule in force as without it.                           #
 * #                                                                        #
 * # A MULTIPLE OF 4 BECAUSE THE HISTOGRAM IS. `histogramP95` returns        #
 * # `(bin + 1) * 256 / 64`, so every reading is a multiple of 4 and a       #
 * # threshold between two of them would carry a fictitious precision.       #
 * #                                                                        #
 * # AND THAT CUTS BOTH WAYS, WHICH IS THE PART TO READ BEFORE THE PAID RUN. #
 * # BEAT 28 — the one shot this ceiling exists to keep — CLEARS IT BY FOUR  #
 * # HISTOGRAM BINS, 112 against 128, which is the smallest margin any       #
 * # reading here can express. That 112 came off the DELIVERED FILM'S own    #
 * # frame, which is already cropped to 16:9, already graded and already     #
 * # through h.264, not off the source JPEG a paid run decodes, because none #
 * # of this job's 115 is on this laptop.                                    #
 * #                                                                        #
 * # THE DIRECTION OF THAT ERROR IS KNOWN FOR THE LEVEL READINGS AND NOT     #
 * # FOR THIS ONE. A grade flattens local contrast and compression removes   #
 * # edges, while grain and sharpening add them, so an edge p95 can move     #
 * # either way and only its SIZE is bounded. If the real JPEG reads 132 the #
 * # census page is refused its chapter plate outright and the shot plays    #
 * # with NO HEADING AT ALL — a different failure from the one this whole    #
 * # change fixes, one nothing in the plan check would call a regression,    #
 * # and one that costs the shot its heading rather than its legibility.     #
 * #                                                                        #
 * # SO: re-read beat 28's real JPEG on the box before the paid run, and if  #
 * # it lands above 128 move THIS number rather than the rule. It is out of  #
 * # the compositor's bundle, so that costs a re-plan and not 87 minutes.    #
 * #                                                                        #
 * # Confirmed live through the real chooser rather than by reading: a       #
 * # chapter plate at scrimAlpha 0.55 is ADMITTED at raw edge 128 and        #
 * # returns `picture-has-baked-text` at 132.                                #
 * #                                        #
 * # AND A SECOND SAMPLE OF THE SAME FILM, BECAUSE THE 96 ABOVE CAME OFF     #
 * # ONE. That one took the 89 shots drawing no device and no overlay,       #
 * # sampled PAST each transition, and read median 48, p90 96, census 112,   #
 * # beat 31 at 120, 67 at 168, 35 at 184, 33 at 208. This one takes all     #
 * # 115 picture shots at the FIRST clean frame, which is the frame a hard   #
 * # cut actually opens on and the one the replay measures. The two agree on #
 * # the census page exactly and on the ordering everywhere; they differ by  #
 * # up to 4 units on the tail and by 8 on the median, which is the width of #
 * # one histogram bin and a little dissolve. Neither is re-tuned to match   #
 * # the other. A Sobel number means nothing without the operator AND the    #
 * # frame that produced it, and this file now records both.                  #
 * ##########################################################################
 */
export const TYPE_GROUND_MAX_EDGE_P95_WASHED = 128

/**
 * THE FRAME THE BANDS ARE MEASURED IN, re-exported so the worker's decoder
 * cannot drift from the geometry the gate slices. Every band x and y above is
 * a screen coordinate inside this frame, after the compositor's own
 * `objectFit: 'cover'` crop.
 */
export const TYPE_GROUND_FRAME_WIDTH = FRAME_WIDTH
export const TYPE_GROUND_FRAME_HEIGHT = FRAME_HEIGHT
