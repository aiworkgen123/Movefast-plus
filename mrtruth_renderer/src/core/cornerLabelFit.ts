import { FRAME_WIDTH } from './schemas.js'

/**
 * `corner-label`'s TWO SLOTS, MEASURED BEFORE THEIR WORDS MAY REACH A FRAME.
 *
 * ##########################################################################
 * # THE DEVICE SETS A CAPS LINE OVER A SMALLER CAPS KICKER, TOP RIGHT,     #
 * # AND NOTHING IN THE COMPONENT SHORTENS EITHER OF THEM.                  #
 * #                                                                        #
 * #   label    73 px, weight 800, UPPER-CASED, 1.535 px tracking, 1728     #
 * #   kicker   47 px, weight 500, UPPER-CASED, no tracking, 1728, optional #
 * #                                                                        #
 * # EACH SLOT IS ONE LINE AND MUST STAY ONE LINE. `CornerLabel.tsx` sets   #
 * # `white-space: pre` on both, so a line past the band does not wrap: it  #
 * # runs out through the LEFT edge of the frame, because the block is      #
 * # anchored by its RIGHT edge and grows leftwards. And a newline — which  #
 * # `devices.ts` records that `deviceText` does not refuse — would draw a  #
 * # second visual line down into the kicker. Both land at exit 0 with      #
 * # nothing red anywhere, three hours into a render.                      #
 * #                                                                        #
 * # SO IT SUMS THE FACES' OWN ADVANCES, the lesson `shadowUpFit.ts`,       #
 * # `p02Fit.ts`, `p04Fit.ts`, `p05Fit.ts`, `p09Fit.ts` and                 #
 * # `topTitleFit.ts` have each paid for: a character count cannot tell     #
 * # 'I' (0.323 em) from 'W' (1.097 em).                                    #
 * #                                                                        #
 * # REFUSES, NEVER TRUNCATES. A line that will not draw is left off the    #
 * # frame entirely, by the chooser, and never cut.                        #
 * ##########################################################################
 *
 * ##########################################################################
 * # TWO WEIGHTS OF ONE FAMILY, AND THEREFORE TWO ADVANCE TABLES. This is   #
 * # the thing about this module that is not like `topTitleFit.ts`.         #
 * #                                                                        #
 * #   label    `LibreFranklin-Variable.woff2` at wght 800                  #
 * #   kicker   `LibreFranklin-Medium.woff2`, a STATIC 500 cut              #
 * #                                                                        #
 * # 'I' is 323 units at 800 and 298 at 500, 'W' 1097 against 1057. Summing #
 * # one table for both slots would misread every kicker by about 3%, in    #
 * # the direction that under-predicts, which is the direction that ships   #
 * # an overflow. `fonts.ts` registers both weights for `FONT_FAMILY` and   #
 * # `CornerLabel.tsx` asks for one on each line.                          #
 * ##########################################################################
 *
 * ##########################################################################
 * # AND THE 800 FACE'S `hmtx` IS THE WRONG WEIGHT, exactly as              #
 * # `topTitleFit.ts` recorded while top-title was set in this face         #
 * # (until 2026-09-17). `LibreFranklin-Variable.woff2`'s `fvar` says       #
 * #                                                                        #
 * #     wght   min 100   DEFAULT 100   max 900                             #
 * #                                                                        #
 * # so its `hmtx` holds THIN. `readWoff2Advances` in `apps/web` reads      #
 * # `hmtx` and nothing else — correctly, because the Medium cut below IS   #
 * # its own `hmtx`. Pointed at the variable file it returns Thin, 'I' 274  #
 * # against the real 323, and the label gate would under-predict by about  #
 * # a tenth and pass the overflow it exists to refuse.                     #
 * #                                                                        #
 * # `CORNER_LABEL_LABEL_ADVANCE_MIRROR` is `hmtx` PLUS the `HVAR` delta at #
 * # the `avar`-mapped normalised `wght` coordinate — the arithmetic        #
 * # HarfBuzz runs inside Chrome. Read off the bytes by                     #
 * # `tmp/v53/overlays/fit/cornerLabel-metrics.mjs`, never typed from a     #
 * # specimen, and checked FOUR ways by                                     #
 * # `tmp/v53/overlays/fit/verify-cornerLabel-advances.py`:                 #
 * #                                                                        #
 * #   fontTools' own instancer agrees at wght 800 on all 107, 0 mismatch   #
 * #   fontTools agrees on the Medium cut on all 107, 0 mismatch            #
 * #   every capital matched `TOP_TITLE_ADVANCE_MIRROR` as it stood         #
 * #     until 2026-09-17, the 800 table a different script read months     #
 * #     apart, 107 in common, 0 mismatch. That table is Noto Sans Bold     #
 * #     now.                                                               #
 * #   every capital matches `P05_SUPPORT_ADVANCE_MIRROR`, the 500 table    #
 * #     `p05-metrics.mts` read, 107 in common, 0 mismatch                  #
 * ##########################################################################
 *
 * MEASURED UPPER-CASED, BECAUSE THE COMPONENT DRAWS THEM UPPER-CASED.
 * `CornerLabel.tsx` sets `textTransform: 'uppercase'` on the shared line, so the
 * copy that reaches the frame is capitals whatever the planner wrote. Measuring
 * as written would under-predict by the difference between a lower-case set and
 * a capital one, about a sixth, which is the direction that ships an overflow.
 * The tables are therefore CAPITALS ONLY and the German sharp s measures as SS,
 * because `'ß'.toUpperCase()` is two characters and CSS `text-transform`
 * does the same full case mapping.
 *
 * KERNING AND LIGATURES ARE LEFT ON, as the component draws them, so these sums
 * over-predict by the pairs Chrome tightens. That is the direction to err in: a
 * gate that over-predicts refuses a line that would just have fitted, and one
 * that under-predicts ships a line through the frame edge.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `p05Fit.ts` and
 * `topTitleFit.ts`. The compositor imports @vg/core/{schemas,devices,frames,motion}
 * and nothing else, so nothing here can move `bundleHash` — which matters more
 * for a fit module than for anything else in this package, because two advance
 * tables are the files most likely to be edited again and a subpath would turn
 * each edit into a full re-render of the film.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/cornerLabelMirror.test.ts` pins every advance against the
 * woff2 bytes in `apps/web/public/fonts` at BOTH weights, and every size,
 * tracking, weight and measure against `cornerLabelClock.ts` and
 * `CornerLabel.tsx` themselves.
 */

/**
 * Libre Franklin's advance AT WEIGHT 800 for each character the LABEL may hold,
 * in thousandths of an em (`unitsPerEm` 1000).
 *
 * CAPITALS ONLY, because the component upper-cases before it draws: printable
 * ASCII less a-z, the curly quotes, both dashes, the ellipsis, the Latin-1
 * capitals and OE — the same set `P05_CAPS_ADVANCE_MIRROR` carries, which is the
 * Latin subset this film's script actually needs.
 *
 * Read off `apps/web/public/fonts/LibreFranklin-Variable.woff2` by
 * `tmp/v53/overlays/fit/cornerLabel-metrics.mjs`, whose saved output is
 * `cornerLabel-metrics.out.txt` beside it. See the box above for why `hmtx`
 * alone is not enough for this file.
 */
export const CORNER_LABEL_LABEL_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 203, '!': 271, '"': 490, '#': 603, $: 671, '%': 954, '&': 859, "'": 251, '(': 323, ')': 323, '*': 494, '+': 592,
  ',': 266, '-': 380, '.': 266, '/': 373, '0': 716, '1': 523, '2': 659, '3': 677, '4': 703, '5': 683, '6': 693, '7': 626,
  '8': 688, '9': 693, ':': 266, ';': 270, '<': 589, '=': 592, '>': 589, '?': 542, '@': 834, A: 785, B: 731, C: 731,
  D: 762, E: 663, F: 641, G: 757, H: 757, I: 323, J: 458, K: 759, L: 635, M: 964, N: 760, O: 777,
  P: 723, Q: 779, R: 731, S: 690, T: 693, U: 724, V: 743, W: 1097, X: 743, Y: 755, Z: 698, '[': 327,
  '\\': 373, ']': 327, '^': 475, _: 554, '`': 313, '{': 387, '|': 248, '}': 387, '~': 623, '‘': 247, '’': 247, '“': 488,
  '”': 492, '–': 594, '—': 919, '…': 935, À: 785, Á: 785, Â: 785, Ã: 785, Ä: 785, Å: 785, Æ: 1104, Ç: 731,
  È: 663, É: 663, Ê: 663, Ë: 663, Ì: 323, Í: 323, Î: 323, Ï: 323, Ð: 779, Ñ: 760, Ò: 777, Ó: 777,
  Ô: 777, Õ: 777, Ö: 777, Ø: 775, Ù: 724, Ú: 724, Û: 724, Ü: 724, Ý: 755, Þ: 734, Œ: 1129,
}

/**
 * Libre Franklin MEDIUM's own advance for each character the KICKER may hold,
 * off `apps/web/public/fonts/LibreFranklin-Medium.woff2`.
 *
 * A STATIC 500 CUT, so its `hmtx` IS what Chrome draws and there is no HVAR walk
 * to run — the same reading `p05Fit.ts` makes of this exact file. Same character
 * set as the label's, and read by the same script in the same run so the two
 * cannot be refreshed apart.
 */
export const CORNER_LABEL_KICKER_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 212, '!': 251, '"': 428, '#': 603, $: 621, '%': 925, '&': 797, "'": 242, '(': 294, ')': 294, '*': 407, '+': 565,
  ',': 225, '-': 381, '.': 222, '/': 349, '0': 694, '1': 479, '2': 613, '3': 649, '4': 661, '5': 661, '6': 669, '7': 606,
  '8': 673, '9': 666, ':': 222, ';': 238, '<': 554, '=': 565, '>': 554, '?': 527, '@': 834, A: 741, B: 707, C: 712,
  D: 731, E: 636, F: 611, G: 743, H: 740, I: 298, J: 427, K: 714, L: 610, M: 919, N: 757, O: 767,
  P: 698, Q: 768, R: 704, S: 652, T: 656, U: 713, V: 715, W: 1057, X: 701, Y: 694, Z: 647, '[': 296,
  '\\': 349, ']': 296, '^': 476, _: 526, '`': 292, '{': 324, '|': 258, '}': 324, '~': 581, '‘': 228, '’': 228, '“': 419,
  '”': 421, '–': 566, '—': 889, '…': 793, À: 741, Á: 741, Â: 741, Ã: 741, Ä: 741, Å: 741, Æ: 1031, Ç: 712,
  È: 636, É: 636, Ê: 636, Ë: 636, Ì: 298, Í: 298, Î: 298, Ï: 298, Ð: 739, Ñ: 757, Ò: 767, Ó: 767,
  Ô: 767, Õ: 767, Ö: 767, Ø: 740, Ù: 713, Ú: 713, Û: 713, Ü: 713, Ý: 694, Þ: 703, Œ: 1125,
}

/* -------------------------------------------------- the clock's numbers -- */

/** `CORNER_LABEL_TYPE.label.fontWeight`. `fonts.ts` registers 300, 500, 600 and 800 for this family, no more. */
export const CORNER_LABEL_LABEL_FONT_WEIGHT_MIRROR = 800

/** `CORNER_LABEL_TYPE.kicker.fontWeight`, and it is a REAL registered instance rather than a synthesised one. */
export const CORNER_LABEL_KICKER_FONT_WEIGHT_MIRROR = 500

/**
 * `CORNER_LABEL_CAP_OVER_EM` in the clock: the fraction of the em Libre
 * Franklin's FLAT capitals occupy.
 *
 * ##########################################################################
 * # 0.742, AND IT IS DELIBERATELY NOT `OVERLAY.fullFrame.capEm`'s 0.756,   #
 * # which `topTitleFit.ts` used until 2026-09-17. The clock's own box      #
 * # gives the reason and this mirror only repeats it: 0.742 is             #
 * # `OS/2.sCapHeight`, the FLAT cap line, which is what was measured here  #
 * # (the H at the end of his label, flat at top and bottom). 0.756 was     #
 * # measured off a rendered PNG of "1947", and lining figures are ROUND,   #
 * # so that number carries the overshoot and the antialias spill. Mixing   #
 * # them sets this device 1.9% small.                                      #
 * #                                                                        #
 * # THE TWO NUMBERS DISAGREEING IS THE POINT, NOT A DRIFT. The mirror test #
 * # asserts the inequality so nobody "tidies" them together.               #
 * ##########################################################################
 */
export const CORNER_LABEL_CAP_OVER_EM_MIRROR = 0.742

/** `CORNER_LABEL_TYPE.label.capHeightPx`: the sub-pixel flat cap height off the final H of his settled label. */
export const CORNER_LABEL_LABEL_CAP_HEIGHT_MIRROR = 54.27

/** `CORNER_LABEL_TYPE.kicker.capHeightPx`: the same, off the T of his "1ST". */
export const CORNER_LABEL_KICKER_CAP_HEIGHT_MIRROR = 34.56

/**
 * `CORNER_LABEL_LABEL_FONT_SIZE_PX`, DERIVED here exactly as the clock derives
 * it, so a change to the cap height moves both or neither. 54.27 / 0.742 is
 * 73.14, which rounds to 73.
 */
export const CORNER_LABEL_LABEL_FONT_SIZE_MIRROR = Math.round(
  CORNER_LABEL_LABEL_CAP_HEIGHT_MIRROR / CORNER_LABEL_CAP_OVER_EM_MIRROR,
)

/** `CORNER_LABEL_KICKER_FONT_SIZE_PX`, the same way. 34.56 / 0.742 is 46.58, which rounds to 47. */
export const CORNER_LABEL_KICKER_FONT_SIZE_MIRROR = Math.round(
  CORNER_LABEL_KICKER_CAP_HEIGHT_MIRROR / CORNER_LABEL_CAP_OVER_EM_MIRROR,
)

/**
 * `CORNER_LABEL_LABEL_FIT` in the clock, the three numbers its tracking is
 * derived from. Restated here rather than a finished 1.535, so that re-measuring
 * his clip moves the gate and the drawing together.
 *
 *   `measuredInkWidthPx`        his own drawn ink for "BOOK OF ENOCH", sub-pixel
 *   `naturalInkWidthOverEm`     what Libre Franklin 800 sets the same string at
 *                               per em, less the B's left and the H's right side
 *                               bearing, because a side bearing is not ink
 *   `sampleGaps`                13 characters, so 12 gaps — `letter-spacing` is
 *                               a per-gap step, which is why it is not 13
 *
 * THE 8556 IS THIS MODULE'S OWN TABLE. `cornerLabelFit.test.ts` adds the
 * advances of "BOOK OF ENOCH" out of `CORNER_LABEL_LABEL_ADVANCE_MIRROR` and
 * checks they come to exactly that, so the clock's derivation and this one are
 * standing on the same face rather than on two readings of it.
 */
export const CORNER_LABEL_LABEL_SAMPLE_INK_WIDTH_MIRROR = 634.17
export const CORNER_LABEL_LABEL_SAMPLE_ADVANCE_UNITS_MIRROR = 8556
export const CORNER_LABEL_LABEL_SAMPLE_LEFT_BEARING_MIRROR = 60.53
export const CORNER_LABEL_LABEL_SAMPLE_RIGHT_BEARING_MIRROR = 60.61
export const CORNER_LABEL_LABEL_SAMPLE_GAPS_MIRROR = 12

/**
 * The label's tracking in film pixels, ~1.535, DERIVED as the clock derives it.
 *
 * ##########################################################################
 * # IT IS A WIDTH CORRECTION, NOT A CLAIM THAT HIS LETTERS ARE TRACKED.    #
 * # His label draws 3% wider than Libre Franklin 800 sets the same string, #
 * # and a per-gap step is the only one of the two readings — a tracked     #
 * # line, or a slightly wider grotesque — that CSS can express. The clock  #
 * # records both readings; this module only has to sum what CSS will do.   #
 * #                                                                        #
 * # AND IT IS ONLY ON ONE LINE. His kicker IS Libre Franklin 500 to within #
 * # a pixel, so the kicker carries none.                                   #
 * ##########################################################################
 */
export const CORNER_LABEL_LABEL_LETTER_SPACING_MIRROR =
  (CORNER_LABEL_LABEL_SAMPLE_INK_WIDTH_MIRROR -
    ((CORNER_LABEL_LABEL_SAMPLE_ADVANCE_UNITS_MIRROR -
      CORNER_LABEL_LABEL_SAMPLE_LEFT_BEARING_MIRROR -
      CORNER_LABEL_LABEL_SAMPLE_RIGHT_BEARING_MIRROR) /
      1000) *
      CORNER_LABEL_LABEL_FONT_SIZE_MIRROR) /
  CORNER_LABEL_LABEL_SAMPLE_GAPS_MIRROR

/**
 * ZERO FOR THE KICKER, AND IT IS A READ RATHER THAN A DEFAULT.
 *
 * ##########################################################################
 * # `CornerLabel.tsx` passes `letterSpacingPx={undefined}` for the kicker, #
 * # so no `letter-spacing` declaration is written at all and Chrome draws  #
 * # at `normal`, which is 0. The clock exports no kicker tracking to read. #
 * #                                                                        #
 * # THE SUMS BELOW STILL COUNT TRACKING AFTER EVERY CHARACTER INCLUDING    #
 * # THE LAST on both slots, and on the LABEL that is not dead arithmetic:  #
 * # its tracking is 1.535 px, so a per-GAP sum would under-predict every   #
 * # label by exactly 1.535 px and the widest line the film can draw sits   #
 * # 0.07 px inside the band. That is the defect `p03WordWidth` records.    #
 * #                                                                        #
 * # THE COMPONENT'S CANCELLING MARGIN DOES NOT CHANGE THIS.                #
 * # `CORNER_LABEL_LABEL_TRACKING_CANCEL_PX` is a negative `margin-right`   #
 * # that pulls the box back by the trailing step so the last glyph's       #
 * # advance edge lands on the anchor. It moves the box; it does not narrow #
 * # the LINE, which is what Chrome lays out and what overflows. Counting   #
 * # the trailing step therefore over-predicts the drawn extent by exactly  #
 * # one step, which is the safe direction and is the house rule anyway.    #
 * #                                                                        #
 * # `cornerLabelMirror.test.ts` goes RED if the component ever gives the   #
 * # kicker a tracking, or the clock grows a constant for one.              #
 * ##########################################################################
 */
export const CORNER_LABEL_KICKER_LETTER_SPACING_MIRROR = 0

/** `SAFE_AREA_X` in the compositor's `constants.ts`, the margin every caption keeps. */
export const CORNER_LABEL_SAFE_MARGIN_MIRROR = 96

/**
 * The widest either slot may draw: 1728 px.
 *
 * ##########################################################################
 * # THE WHOLE TITLE-SAFE BAND, AND THAT IS THE PORT'S DECISION RATHER THAN #
 * # HIS FRAME. `SPEC-measured.md` flags his own block itself: "right edge  #
 * # lands 38px from frame edge. That is inside the title-safe margin this  #
 * # project uses everywhere else. Check before copying it." So             #
 * # `CornerLabel.tsx` anchors the block at `FRAME_WIDTH - SAFE_AREA_X`     #
 * # instead, and it grows LEFTWARDS from there. What is left for the words #
 * # is the distance from that anchor to the left edge of the safe area,    #
 * # which is the band itself.                                              #
 * #                                                                        #
 * # UNLIKE `top-title`, WHICH SUBTRACTS ITS OWN LEFT INSET. That device's  #
 * # block starts 31 px inside the band, so its measure is 1697. This one   #
 * # sits ON the title-safe corner — `CORNER_LABEL_INNER_CORNER_INSET_PX`   #
 * # is 0 — so nothing is subtracted. DERIVED, never typed as 1728, and the #
 * # mirror test pins it against the clock's own                            #
 * # `cornerLabelTitleSafeWidthPx` rather than against the number.          #
 * ##########################################################################
 */
export const CORNER_LABEL_MAX_WIDTH = FRAME_WIDTH - 2 * CORNER_LABEL_SAFE_MARGIN_MIRROR

/**
 * ONE LINE PER SLOT, AND NO MORE.
 *
 * The two lines are one block: the label's box, then the kicker's, with a gap
 * between them derived from two ABSOLUTE measured baselines. A second visual
 * line of the label lands about 73 px lower, which is where the kicker is drawn.
 * The device has a second slot precisely so a second line is ASKED for rather
 * than arrived at.
 */
export const CORNER_LABEL_MAX_LINES = 1

/* ------------------------------------------------------------ the sums -- */

type Setting = {
  readonly advances: Readonly<Record<string, number>>
  readonly sizePx: number
  readonly trackingPx: number
  readonly widthPx: number
}

const LABEL: Setting = {
  advances: CORNER_LABEL_LABEL_ADVANCE_MIRROR,
  sizePx: CORNER_LABEL_LABEL_FONT_SIZE_MIRROR,
  trackingPx: CORNER_LABEL_LABEL_LETTER_SPACING_MIRROR,
  widthPx: CORNER_LABEL_MAX_WIDTH,
}

const KICKER: Setting = {
  advances: CORNER_LABEL_KICKER_ADVANCE_MIRROR,
  sizePx: CORNER_LABEL_KICKER_FONT_SIZE_MIRROR,
  trackingPx: CORNER_LABEL_KICKER_LETTER_SPACING_MIRROR,
  widthPx: CORNER_LABEL_MAX_WIDTH,
}

/**
 * The copy AS THE COMPONENT DRAWS IT: upper-cased.
 *
 * `CornerLabel.tsx` sets `textTransform: 'uppercase'` on the shared line, which
 * applies Unicode's FULL case mapping — the same one `toUpperCase` applies — so
 * the German sharp s becomes two S and is two advances wide. That is why neither
 * table names it, and why a per-character rule that mapped one character to one
 * advance would be wrong here.
 */
function asDrawn(line: string): string {
  return line.toUpperCase()
}

/**
 * How wide a run of characters draws, in screen pixels, or null when it holds a
 * character the mirror does not name.
 *
 * `letter-spacing` is added after EVERY character INCLUDING THE LAST, which is
 * what Chrome puts into the line's own width (the rule `p03WordWidth` records).
 * An unmeasured character REFUSES rather than guesses: Chrome would draw it in a
 * fallback face at a width nothing here knows, and an average would be a number
 * that looks like a measurement and is not one. The canonical probe is A-macron,
 * U+0100, which is outside the Latin subset both files ship.
 *
 * THE RUN IS ALREADY UPPER-CASED WHEN IT ARRIVES. Casing happens once, in
 * `asDrawn`, so a caller that reaches this with lower case would be measuring
 * something the frame never draws — which is why nothing outside this file can.
 */
function runWidth(run: string, setting: Setting): number | null {
  let thousandths = 0
  let characters = 0
  for (const character of run) {
    const advance = setting.advances[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (thousandths / 1000) * setting.sizePx + characters * setting.trackingPx
}

/**
 * The words of a line, for the greedy fill below ONLY.
 *
 * The drawn width does NOT go through this — see `oneLineWidth` and the box on
 * `white-space: pre`. Folding here is right for the wrap model and wrong for the
 * measurement, and keeping the two apart is the point.
 */
function wordsOf(line: string): string[] {
  return line.trim().split(/\s+/).filter((word) => word.length > 0)
}

/**
 * How many lines the copy would draw on, `Infinity` when one word alone is wider
 * than the measure, 0 when there is nothing to draw, or null when it holds an
 * unmeasured character.
 *
 * ##########################################################################
 * # A GREEDY FILL ON SPACES, WHICH IS WHAT CHROME'S LINE BREAKER DOES WITH #
 * # ORDINARY TEXT, lifted from `p05Fit.ts` rather than written again. A    #
 * # space between two words costs its own advance and tracking; the space  #
 * # a line breaks on hangs and costs nothing.                              #
 * #                                                                        #
 * # CHROME MAY ALSO BREAK AFTER A HYPHEN, AND THIS DOES NOT. Fewer break   #
 * # opportunities can only predict MORE lines, so it errs towards refusing.#
 * #                                                                        #
 * # A WORD WIDER THAN THE MEASURE IS `Infinity`, NOT 1. Nothing in the     #
 * # component sets `overflow-wrap`, so Chrome would not break inside a     #
 * # word even if it were wrapping: it runs the word out past the measure   #
 * # and through the frame edge. That is a CLIP, and calling it one line    #
 * # would be calling an overflow a fit.                                    #
 * #                                                                        #
 * # THIS IS A DIAGNOSTIC, NOT THE GATE, BECAUSE `pre` MEANS NO WRAPPING AT #
 * # ALL. `fitsOneLine` measures the exact drawn width instead. What this   #
 * # still tells apart is WHY a line was refused — one unbreakable word, or #
 * # a run of ordinary ones — and it is what the gate would have to become  #
 * # the day `pre` becomes `pre-wrap`, when a wrapped label would land on   #
 * # the kicker.                                                            #
 * ##########################################################################
 */
function lineCount(line: string, setting: Setting): number | null {
  const words = wordsOf(asDrawn(line))
  if (words.length === 0) return 0
  const space = runWidth(' ', setting)
  if (space === null) return null

  let lines = 1
  let used = 0
  for (const word of words) {
    const width = runWidth(word, setting)
    if (width === null) return null
    if (width > setting.widthPx) return Number.POSITIVE_INFINITY
    if (used === 0) {
      used = width
      continue
    }
    if (used + space + width <= setting.widthPx) {
      used += space + width
      continue
    }
    lines += 1
    used = width
  }
  return lines
}

/**
 * How wide the copy draws, upper-cased but otherwise EXACTLY AS GIVEN, or null
 * when it holds a character the mirror does not name.
 *
 * ##########################################################################
 * # `CornerLabel.tsx` SETS `white-space: pre`, SO NOTHING IS FOLDED AND     #
 * # NOTHING IS TRIMMED. This is read off the component, not assumed: it     #
 * # sets `whiteSpace: 'pre'` with the comment "So the space spans keep      #
 * # their width instead of collapsing, and so a long line cannot wrap into  #
 * # the kicker", and it renders every character into its own span.          #
 * #                                                                        #
 * # SO A DOUBLE SPACE DRAWS TWICE AND TRAILING SPACES PUSH THE LINE LEFT,   #
 * # because this block is anchored on its RIGHT edge. Measuring the folded  #
 * # form would UNDER-predict, which is the direction that ships an          #
 * # overflow. `p05Fit.ts` folds because its templates wrap normally;        #
 * # copying that here would be copying the wrong half.                     #
 * #                                                                        #
 * # `pre` ALSO MEANS THE LINE NEVER WRAPS AT ALL. A line past the band runs #
 * # out through the left edge of the frame rather than breaking, so the     #
 * # exact width IS the gate. The greedy fill above is kept for what it      #
 * # still tells apart — a single unbreakable word from a run of ordinary    #
 * # ones.                                                                   #
 * ##########################################################################
 */
function oneLineWidth(line: string | null | undefined, setting: Setting): number | null {
  if (line === null || line === undefined) return null
  return runWidth(asDrawn(line), setting)
}

/**
 * Does this slot draw on ONE line inside the title-safe band?
 *
 * Everything that is not one drawable line answers false, and each for its own
 * reason: null, the empty string and an all-whitespace string are not copy at
 * all; a line wider than the band runs out through the frame edge under `pre`;
 * and an unmeasured character is null because Chrome would draw it in a face
 * this table knows nothing about.
 *
 * A NEWLINE REFUSES, AND THAT MATTERS MORE HERE THAN IT LOOKS. `devices.ts`
 * records that `deviceText` does not refuse one. Under `white-space: pre` a
 * newline inside `label` draws a second visual line 73 px lower — on top of the
 * kicker. There is no advance for `\n` in either mirror, so it refuses.
 */
function fitsOneLine(line: string | null | undefined, setting: Setting): boolean {
  if (line === null || line === undefined) return false
  /* Whitespace draws under `pre`, so it has a width. It is still not copy. */
  if (line.trim() === '') return false
  const width = oneLineWidth(line, setting)
  return width !== null && width > 0 && width <= setting.widthPx
}

/* ------------------------------------------------------------- the gates -- */

/** How wide `label` draws on ONE line, upper-cased, or null when it holds an unmeasured character. */
export function cornerLabelLabelWidth(line: string | null | undefined): number | null {
  return oneLineWidth(line, LABEL)
}

/** How wide `kicker` draws on ONE line, upper-cased, or null when it holds an unmeasured character. */
export function cornerLabelKickerWidth(line: string | null | undefined): number | null {
  return oneLineWidth(line, KICKER)
}

/**
 * How many lines `label` would take, `Infinity` for a single word wider than the
 * band, 0 for nothing to draw, null for an unmeasured character. See `lineCount`.
 */
export function cornerLabelLabelLineCount(line: string | null | undefined): number | null {
  if (line === null || line === undefined) return null
  return lineCount(line, LABEL)
}

/** The same for `kicker`. See `lineCount`. */
export function cornerLabelKickerLineCount(line: string | null | undefined): number | null {
  if (line === null || line === undefined) return null
  return lineCount(line, KICKER)
}

/** THE GATE for `label`. Does it draw on one line of the 1728 px band, upper-cased? */
export function cornerLabelLabelFits(line: string | null | undefined): boolean {
  return fitsOneLine(line, LABEL)
}

/**
 * THE GATE for `kicker`, the optional slot.
 *
 * AN EMPTY `kicker` IS REFUSED HERE AND THAT IS NOT THE SAME AS REFUSING THE
 * DEVICE. The schema's `kicker` defaults to `''`, which means "draw the label
 * alone"; the caller omits the second line rather than asking this whether an
 * empty string fits. What this answers is only ever "may these words be drawn",
 * and the empty string is not words.
 */
export function cornerLabelKickerFits(line: string | null | undefined): boolean {
  return fitsOneLine(line, KICKER)
}

/* -------------------------------------------------- the build, in frames -- */

/**
 * `corner-label`'s TYPE-ON CLOCK, MIRRORED, SO THE CHOOSER CAN ASK HOW LONG
 * THIS PARTICULAR CAPTION TAKES TO FINISH.
 *
 * ##########################################################################
 * # WHY A MIRROR AND NOT AN IMPORT. `cornerLabelSettleFrame` lives in       #
 * # `apps/web/src/remotion/animations/cornerLabelClock.ts`, beside the      #
 * # component it clocks. `packages/core` cannot import a compositor module  #
 * # — it is the package the compositor imports — so the chooser has no way  #
 * # to reach the real clock. The three numbers are therefore restated here  #
 * # and `apps/web/src/lib/cornerLabelMirror.test.ts`, the one file in the   #
 * # repo allowed to import BOTH sides, asserts the two agree on every copy  #
 * # the schema admits. That is the same trade `chapterPlateFit.ts` makes.   #
 * #                                                                        #
 * # THE WORST CASE IS ALREADY IN `devices.ts` AND STAYS THERE.              #
 * # `buildEndFrames: 101` is `settle(18, 14)`, the longest copy the schema  #
 * # admits, and it is the right floor for any corner-label whose words are  #
 * # not yet known. It is the WRONG floor once they are: the caption the     #
 * # planner actually wrote for the delivered film, "Stuckenbruck" over      #
 * # "Cosmology", finishes at frame 79, and the worst-case floor refused it  #
 * # 103 of that film's 164 shots on a build it would have completed.        #
 * #                                                                        #
 * # 54 IS NOT AN OPTION AND THIS MODULE IS NOT A ROUTE BACK TO IT. 54 was   #
 * # the LABEL's settle read as the DEVICE's, and it is what delivered       #
 * # "COSMOLOG" to a paying client. Nothing below ever returns a number      #
 * # smaller than the frame that caption's LAST character lands on.          #
 * ##########################################################################
 */

/**
 * `CORNER_LABEL_TYPE_ON.firstCharacterFrame`. His first character is at source
 * frame 58 of 60fps; the film runs at half that, so 29.
 */
export const CORNER_LABEL_FIRST_CHARACTER_FRAME_MIRROR = 58 / 2

/** `CORNER_LABEL_TYPE_ON.framesPerCharacter`. Four of his frames per glyph, halved. */
export const CORNER_LABEL_FRAMES_PER_CHARACTER_MIRROR = 4 / 2

/**
 * `CORNER_LABEL_TYPE_ON.gapSlots`. The reveal PAUSES at the line break by a
 * whole number of empty slots rather than restarting from an absolute onset, so
 * a longer label pushes the kicker later. See the clock's own box.
 */
export const CORNER_LABEL_GAP_SLOTS_MIRROR = 5

/**
 * HOW MANY SLOTS A SLOT'S COPY OCCUPIES: its CODE POINTS, AS TYPED.
 *
 * ##########################################################################
 * # NOT the upper-cased count, and the difference is real. `CornerLabel`    #
 * # maps `[...text]` over the PLANNER'S OWN STRING and upper-cases in CSS   #
 * # (`textTransform: 'uppercase'`), so one written character is one span is #
 * # one slot however wide it draws. The German sharp s is the case that     #
 * # separates the two readings: `asDrawn` turns it into two advances for    #
 * # the WIDTH sum above, and it is still one span and one slot here.        #
 * #                                                                        #
 * # Code points rather than `.length`, because `.length` counts UTF-16      #
 * # units and the component's spread does not.                              #
 * ##########################################################################
 */
function slots(line: string | null | undefined): number {
  if (line === null || line === undefined) return 0
  return [...line].length
}

/**
 * The film frame this caption's LAST character lands on, local to the shot.
 *
 * An empty or absent `kicker` means the device draws the label alone, which is
 * what `CornerLabel` does with it, so the build ends on the label's own last
 * character. A kicker starts `CORNER_LABEL_GAP_SLOTS_MIRROR` slots after the
 * label's last slot and runs on from there.
 */
export function cornerLabelSettleFrames(
  label: string | null | undefined,
  kicker: string | null | undefined,
): number {
  const labelSlots = slots(label)
  const kickerSlots = slots(kicker)
  const lastSlot =
    kickerSlots > 0
      ? labelSlots + CORNER_LABEL_GAP_SLOTS_MIRROR + kickerSlots - 1
      : labelSlots - 1
  return CORNER_LABEL_FIRST_CHARACTER_FRAME_MIRROR + CORNER_LABEL_FRAMES_PER_CHARACTER_MIRROR * lastSlot
}

/**
 * THE GATE. Does this shot hold this caption long enough to finish drawing it?
 *
 * ##########################################################################
 * # STRICTLY GREATER, AND THE OFF-BY-ONE IS THE WHOLE POINT.                #
 * #                                                                        #
 * # `cornerLabelCharacterOpacity` is a HARD STEP at `frame >= slot`, and    #
 * # `useCurrentFrame()` is 0-based, so a shot of N frames draws local       #
 * # frames 0 to N-1. A caption whose settle is exactly N therefore never    #
 * # draws its last character at all: the frame it needs is the first frame  #
 * # of the NEXT shot.                                                      #
 * #                                                                        #
 * # THAT IS NOT A HYPOTHETICAL. Beat 107 of the film delivered 2026-09-14   #
 * # ran 79 frames and drew "Stuckenbruck" over "Cosmology", whose settle is #
 * # 79. The client received "COSMOLOG".                                    #
 * #                                                                        #
 * # It is also the client's own ruling of 2026-09-16 read honestly: "The    #
 * # animation should finish before the cut; otherwise it can look           #
 * # accidental or broken." A last character that lands ON the cut has not   #
 * # finished before it.                                                     #
 * ##########################################################################
 */
export function cornerLabelFinishesInside(
  durationFrames: number,
  label: string | null | undefined,
  kicker: string | null | undefined,
): boolean {
  return durationFrames > cornerLabelSettleFrames(label, kicker)
}

/* ------------------------------------------------------- the prompt caps -- */

/**
 * The counts the PLANNER PROMPT asks for, which are not the schema bounds in
 * `devices.ts`.
 *
 * ##########################################################################
 * # MEASURED, NOT ESTIMATED, on this film's own script                     #
 * # (tmp/v52/render/segment.json, 164 scenes, 8,578 characters, 1,414      #
 * # words once edge punctuation is stripped): every run of consecutive     #
 * # whole words up to 70 characters, 15,048 distinct runs, put UPPER-CASED #
 * # through the two gates above by                                        #
 * # tmp/v53/overlays/fit/measure-cornerLabel-runs.mjs.                     #
 * #                                                                        #
 * #   LABEL, 18. Every run up to 33 characters draws on one line of the    #
 * #   1728 px band; the first refusal arrives at 34, "of Enoch was removed #
 * #   from approved" at 1732.37 px, and from 40 every run is refused. The  #
 * #   schema's own bound of 18 is so far under that that ALL 220 runs of   #
 * #   exactly 18 characters pass.                                          #
 * #                                                                        #
 * #   KICKER, 14. Every run up to 57 characters draws on one line, the     #
 * #   first refusal at 58 and every run refused from 67. All 195 runs of   #
 * #   exactly 14 characters pass.                                          #
 * #                                                                        #
 * # SO THESE ARE NOT WIDTH CAPS, AND SAYING SO IS THE POINT. Both are the  #
 * # SCHEMA BOUNDS restated, because this device's band is the whole        #
 * # title-safe width and its copy is a short name with a date under it.    #
 * # What holds the copy short is the ask, not the gate. The gate still     #
 * # exists for the copy the planner can invent inside those bounds — an    #
 * # unmeasured character, a newline, and a single word wider than the band #
 * # are all reachable at 18 characters, and each one is a frame nobody     #
 * # would see until the render finished.                                   #
 * #                                                                        #
 * # NO SINGLE WORD IN THIS SCRIPT IS WIDER THAN THE BAND ON EITHER SLOT.   #
 * # The longest that draws is "unconsciousness", 788.80 px on the label    #
 * # and 479.26 px on the kicker, so the `Infinity` branch is reachable     #
 * # only by copy the planner invents. A 34-character German compound —     #
 * # "Straßenverkehrsgenehmigungsordnung", 1899.55 px on the label —   #
 * # is what the fit test uses to reach it.                                 #
 * ##########################################################################
 */
export const CORNER_LABEL_LABEL_PROMPT_CHARS = 18
export const CORNER_LABEL_KICKER_PROMPT_CHARS = 14
