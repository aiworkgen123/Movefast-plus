import { FRAME_WIDTH } from './schemas.js'

/**
 * `top-title`'s TWO LINES, MEASURED BEFORE THEIR WORDS MAY REACH A FRAME.
 *
 * ##########################################################################
 * # THE DEVICE SETS TWO LINES AT THE TOP LEFT, EACH AT AN ABSOLUTE         #
 * # BASELINE, AND NOTHING IN THE COMPONENT SHORTENS EITHER OF THEM.        #
 * #                                                                        #
 * #   line1   130 px Noto Sans Bold, 0.5 px tracking, one line of 1697     #
 * #   line2   130 px Noto Sans Bold, 0.5 px tracking, one line of 1697     #
 * #                                                                        #
 * # EACH SLOT IS ONE LINE AND MUST STAY ONE LINE. `topTitleClock.ts` puts  #
 * # line 1 on baseline 237 and line 2 on baseline 393, both ABSOLUTE, and  #
 * # `TopTitle.tsx` sets `white-space: pre`. So a line past the band does   #
 * # not wrap: it runs out through the right edge of the frame. And a       #
 * # newline — which `devices.ts` records that `deviceText` does not refuse #
 * # — draws a second visual line 130 px down, THROUGH the other slot. Both #
 * # land at exit 0 with nothing red anywhere, three hours into a render.   #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES, the lesson `shadowUpFit.ts`,        #
 * # `p02Fit.ts`, `p04Fit.ts`, `p05Fit.ts` and `p09Fit.ts` have each paid    #
 * # for: a character count cannot tell 'I' (0.389 em) from 'W' (0.967 em). #
 * #                                                                        #
 * # REFUSES, NEVER TRUNCATES. A line that will not draw is left off the     #
 * # frame entirely, by the chooser, and never cut.                         #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE FACE CHANGED ON 2026-09-17, AND EVERY NUMBER HERE CHANGED WITH IT. #
 * #                                                                        #
 * # His note of 2026-09-16 said this title's style was still wrong. It was  #
 * # set in Libre Franklin 800 at 122 px. Measured glyph by glyph off his    #
 * # own clip it is Noto Sans Bold at 130 px with 0.5 px of tracking, from   #
 * # a text box at x 127 — see the boxes on `TOP_TITLE_TYPE` in              #
 * # `topTitleClock.ts`. The face sets about 11% WIDER than the one it       #
 * # replaced, so lines this gate used to pass are refused now. That is the  #
 * # gate being right about a wider face, not a regression.                 #
 * #                                                                        #
 * # THE FACE IS STATIC, SO `hmtx` IS WHAT CHROME DRAWS. The variable-font   #
 * # `HVAR` walk the Libre Franklin mirror needed is gone with it. The file  #
 * # is `@fontsource/noto-sans@5.3.0` latin 700, inlined by                  #
 * # `bodyFaceBoldData.ts`, and `topTitleMirror.test.ts` reads every advance #
 * # below back out of those exact bytes with `readWoff2Advances`.           #
 * ##########################################################################
 *
 * MEASURED AS WRITTEN, NOT UPPER-CASED. Nothing in `topTitleClock.ts` cases the
 * copy, and the client's own sample is "Elder Earth: Fiery Undoing". So both
 * cases are carried and the German sharp s measures as ß rather than SS. That
 * trap belongs to the devices that DO upper-case; this one would ship the
 * opposite defect if it borrowed their rule.
 *
 * KERNING IS LEFT ON, as Chrome draws it, so these sums over-predict by the
 * pairs Chrome tightens. That is the direction to err in: a gate that
 * over-predicts refuses a line that would just have fitted, and one that
 * under-predicts ships a line through the frame edge. Non-zero tracking already
 * switches Chrome's optional ligatures off, so no ligature narrows a line either.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `p05Fit.ts`. The compositor
 * imports @vg/core/{schemas,devices,frames,motion} and nothing else, so nothing
 * here can move `bundleHash` — which matters more here than anywhere else,
 * because an advance table this big is the file most likely to be edited again
 * and a subpath would turn each edit into a full re-render of the film.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/topTitleMirror.test.ts` pins every advance against the woff2
 * bytes, and the size, tracking, weight and measure against `TOP_TITLE_TYPE`
 * and `topTitleMeasurePx` in the clock.
 */

/**
 * Noto Sans Bold's advance for each character a line may hold, in thousandths
 * of an em (`unitsPerEm` 1000). BOTH CASES, because the component draws the copy
 * as written: printable ASCII, the curly quotes, both dashes, the ellipsis, the
 * Latin-1 letters and Œ œ — the same set `P05_SUPPORT_ADVANCE_MIRROR` carries,
 * which is the Latin subset this film's script actually needs.
 *
 * Read off the latin 700 woff2 that `bodyFaceBoldData.ts` inlines, through
 * fontTools' `hmtx`, and pinned against the same bytes by the mirror test.
 */
export const TOP_TITLE_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 260, '!': 282, '"': 479, '#': 646, $: 572, '%': 902, '&': 750, "'": 266,
  '(': 339, ')': 339, '*': 542, '+': 572, ',': 285, '-': 320, '.': 281, '/': 415,
  '0': 572, '1': 572, '2': 572, '3': 572, '4': 572, '5': 572, '6': 572, '7': 572, '8': 572, '9': 572,
  ':': 281, ';': 285, '<': 572, '=': 572, '>': 572, '?': 477, '@': 898,
  A: 692, B: 665, C: 642, D: 732, E: 560, F: 549, G: 724, H: 765, I: 389, J: 331, K: 664, L: 559, M: 943,
  N: 813, O: 791, P: 621, Q: 791, R: 656, S: 551, T: 577, U: 756, V: 650, W: 967, X: 670, Y: 626, Z: 579,
  '[': 331, '\\': 415, ']': 331, '^': 572, _: 411, '`': 365,
  a: 599, b: 632, c: 516, d: 632, e: 597, f: 387, g: 632, h: 650, i: 299, j: 298, k: 620, l: 298, m: 975,
  n: 650, o: 625, p: 632, q: 632, r: 447, s: 502, t: 434, u: 650, v: 571, w: 856, x: 578, y: 571, z: 493,
  '{': 394, '|': 551, '}': 394, '~': 572,
  '‘': 217, '’': 217, '“': 445, '”': 445, '–': 500, '—': 1000, '…': 855,
  À: 692, Á: 692, Â: 692, Ã: 692, Ä: 692, Å: 692, Æ: 952, Ç: 642, È: 560, É: 560, Ê: 560, Ë: 560,
  Ì: 389, Í: 389, Î: 389, Ï: 389, Ð: 732, Ñ: 805, Ò: 791, Ó: 791, Ô: 791, Õ: 791, Ö: 791, Ø: 791,
  Ù: 756, Ú: 756, Û: 756, Ü: 756, Ý: 626, Þ: 628, ß: 704,
  à: 599, á: 599, â: 599, ã: 599, ä: 599, å: 599, æ: 917, ç: 516, è: 597, é: 597, ê: 597, ë: 597,
  ì: 299, í: 299, î: 299, ï: 299, ð: 627, ñ: 650, ò: 625, ó: 625, ô: 625, õ: 625, ö: 625, ø: 619,
  ù: 650, ú: 650, û: 650, ü: 650, ý: 571, þ: 632, ÿ: 571, Œ: 973, œ: 978,
}

/* -------------------------------------------------- the clock's numbers -- */

/** `TOP_TITLE_TYPE.fontWeight`. `bodyFaceBold.ts` registers the Bold at 700 and nothing heavier. */
export const TOP_TITLE_FONT_WEIGHT_MIRROR = 700

/** `TOP_TITLE_TYPE.capHeightPx`: his cap height, the mean of both lines' sub-pixel readings. */
export const TOP_TITLE_CAP_HEIGHT_MIRROR = 92.8

/**
 * `TOP_TITLE_CAP_OVER_EM` in the clock, which is `BODY_FACE_CAP_OVER_EM` in the
 * compositor's `bodyFace.ts`: Noto Sans's `OS/2.sCapHeight`, 714 of 1000, the
 * same in the Regular and the Bold.
 */
export const TOP_TITLE_CAP_OVER_EM_MIRROR = 0.714

/**
 * `TOP_TITLE_TYPE.fontSizePx`, DERIVED here exactly as the clock derives it, so
 * a change to the cap height moves both or neither. 92.8 / 0.714 rounds to 130.
 */
export const TOP_TITLE_FONT_SIZE_MIRROR = Math.round(
  TOP_TITLE_CAP_HEIGHT_MIRROR / TOP_TITLE_CAP_OVER_EM_MIRROR,
)

/**
 * `TOP_TITLE_TYPE.letterSpacingPx`: 0.5 px, MEASURED, and the sums count it.
 *
 * ##########################################################################
 * # HIS TRACKING IS NOT ZERO. With the size held at the 130 px his vertical #
 * # edges give, his 46 horizontal glyph edges ask for 0.52 px after every   #
 * # character. It is small, and it is not nothing: across his 18-character #
 * # first line it is 9 px, and across the 28 characters the schema allows   #
 * # it is 14 px, which is the difference between a line that fits and one   #
 * # that runs through the frame edge.                                       #
 * #                                                                        #
 * # COUNTED AFTER EVERY CHARACTER INCLUDING THE LAST, which is what Chrome  #
 * # puts into the line's own width. A per-GAP sum would under-predict by    #
 * # exactly one tracking unit per line — the defect `p03WordWidth` records. #
 * ##########################################################################
 */
export const TOP_TITLE_LETTER_SPACING_MIRROR = 0.5

/** `TOP_TITLE_TYPE.leftPx`: the text box's left edge, fitted off his glyph edges. */
export const TOP_TITLE_LEFT_MIRROR = 127

/** `SAFE_AREA_X` in the compositor's `constants.ts`, the margin every caption keeps. */
export const TOP_TITLE_SAFE_MARGIN_MIRROR = 96

/**
 * The widest a line may draw: 1697 px.
 *
 * DERIVED, NEVER TYPED, and it is `topTitleMeasurePx(FRAME_WIDTH, SAFE_AREA_X)`
 * written out. The title-safe band is `FRAME_WIDTH - 2 * SAFE_AREA_X` = 1728 px,
 * and the block's own left edge already sits `127 - 96` = 31 px inside it, so
 * what is left for the words is 1697 px. The mirror test pins this against the
 * clock's function rather than against the number.
 */
export const TOP_TITLE_MAX_WIDTH =
  FRAME_WIDTH - 2 * TOP_TITLE_SAFE_MARGIN_MIRROR - (TOP_TITLE_LEFT_MIRROR - TOP_TITLE_SAFE_MARGIN_MIRROR)

/**
 * ONE LINE PER SLOT, AND NO MORE.
 *
 * The two baselines are ABSOLUTE, 237 and 393. A second visual line of line 1
 * lands about 130 px lower, which is inside where line 2 is drawn. The device
 * has a second slot precisely so a second line is ASKED for rather than
 * arrived at.
 */
export const TOP_TITLE_MAX_LINES = 1

/* ------------------------------------------------------------ the sums -- */

type Setting = {
  readonly advances: Readonly<Record<string, number>>
  readonly sizePx: number
  readonly trackingPx: number
  readonly widthPx: number
}

const LINE1: Setting = {
  advances: TOP_TITLE_ADVANCE_MIRROR,
  sizePx: TOP_TITLE_FONT_SIZE_MIRROR,
  trackingPx: TOP_TITLE_LETTER_SPACING_MIRROR,
  widthPx: TOP_TITLE_MAX_WIDTH,
}

/**
 * IDENTICAL TO `LINE1` TODAY, AND STILL ITS OWN SETTING.
 *
 * The two lines differ only in where their baselines sit, and `topTitleClock.ts`
 * gives them one `fontSizePx` and one measure. Writing that equality out here,
 * rather than pointing the second gate at the first setting, is what gives a
 * future line-2 size or a narrower second measure somewhere to land — and the
 * caller names the slot it means either way. `topTitleFit.test.ts` pins the two
 * settings equal so the duplication cannot drift unnoticed.
 */
const LINE2: Setting = {
  advances: TOP_TITLE_ADVANCE_MIRROR,
  sizePx: TOP_TITLE_FONT_SIZE_MIRROR,
  trackingPx: TOP_TITLE_LETTER_SPACING_MIRROR,
  widthPx: TOP_TITLE_MAX_WIDTH,
}

/**
 * How wide a run of characters draws, in screen pixels, or null when it holds a
 * character the mirror does not name.
 *
 * `letter-spacing` is added after EVERY character INCLUDING THE LAST, which is
 * what Chrome puts into the line's own width (the rule `p03WordWidth` records).
 * An unmeasured character REFUSES rather than guesses: Chrome would draw it in a
 * fallback face at a width nothing here knows, and an average would be a number
 * that looks like a measurement and is not one.
 *
 * Exported with its size and tracking as arguments so the "including the last"
 * rule is provable at a tracking this device does not currently use. See the box
 * on `TOP_TITLE_LETTER_SPACING_MIRROR`.
 */
export function topTitleRunWidthPx(
  run: string,
  fontSizePx: number,
  letterSpacingPx: number,
): number | null {
  let thousandths = 0
  let characters = 0
  for (const character of run) {
    const advance = TOP_TITLE_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (thousandths / 1000) * fontSizePx + characters * letterSpacingPx
}

function runWidth(run: string, setting: Setting): number | null {
  return topTitleRunWidthPx(run, setting.sizePx, setting.trackingPx)
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
 * # would be calling an overflow a fit. The schema's own 28-character      #
 * # bound admits such a word — 28 characters of                            #
 * # "Antidisestablishmentarianism" draw 1970.11 px into a 1697 px band.    #
 * #                                                                        #
 * # THIS IS A DIAGNOSTIC, NOT THE GATE, BECAUSE `pre` MEANS NO WRAPPING AT #
 * # ALL. `fitsOneLine` measures the exact drawn width instead. What this   #
 * # still tells apart is WHY a line was refused — one unbreakable word, or #
 * # a run of ordinary ones — and it is what the gate would have to become  #
 * # the day `pre` becomes `pre-wrap`.                                       #
 * ##########################################################################
 */
function lineCount(line: string, setting: Setting): number | null {
  const words = wordsOf(line)
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
 * How wide the copy draws, EXACTLY AS GIVEN, or null when it holds a character
 * the mirror does not name.
 *
 * ##########################################################################
 * # `TopTitle.tsx` SETS `white-space: pre`, SO NOTHING IS FOLDED AND        #
 * # NOTHING IS TRIMMED. This is read off the component, not assumed: it     #
 * # sets `whiteSpace: 'pre'` on the block with the comment "So the gap      #
 * # spans below keep their width instead of collapsing", and it renders     #
 * # each gap token's literal text into its own span.                        #
 * #                                                                        #
 * # SO A DOUBLE SPACE DRAWS TWICE AND LEADING SPACES PUSH THE LINE RIGHT.   #
 * # Measuring the folded form would UNDER-predict, which is the direction   #
 * # that ships an overflow. `p05Fit.ts` folds because its templates wrap    #
 * # normally; copying that here would be copying the wrong half.            #
 * #                                                                        #
 * # `pre` ALSO MEANS THE LINE NEVER WRAPS AT ALL. A line past the band      #
 * # runs out through the right edge of the frame rather than breaking, so   #
 * # the exact width IS the gate. The greedy fill above is kept for what it  #
 * # still tells apart — a single unbreakable word from a run of ordinary    #
 * # ones — and for the day somebody changes `pre` to `pre-wrap`, when a     #
 * # second visual line would land on the other slot's baseline.             #
 * ##########################################################################
 */
function oneLineWidth(line: string | null | undefined, setting: Setting): number | null {
  if (line === null || line === undefined) return null
  return runWidth(line, setting)
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
 * newline inside `line1` draws a second visual line 130 px lower — on top of
 * `line2`. There is no advance for `\n` in the mirror, so it refuses.
 */
function fitsOneLine(line: string | null | undefined, setting: Setting): boolean {
  if (line === null || line === undefined) return false
  /* Whitespace draws under `pre`, so it has a width. It is still not copy. */
  if (line.trim() === '') return false
  const width = oneLineWidth(line, setting)
  return width !== null && width > 0 && width <= setting.widthPx
}

/* ------------------------------------------------------------- the gates -- */

/** How wide `line1` draws on ONE line, or null when it holds an unmeasured character. */
export function topTitleLine1Width(line: string | null | undefined): number | null {
  return oneLineWidth(line, LINE1)
}

/** How wide `line2` draws on ONE line, or null when it holds an unmeasured character. */
export function topTitleLine2Width(line: string | null | undefined): number | null {
  return oneLineWidth(line, LINE2)
}

/**
 * How many lines `line1` would take, `Infinity` for a single word wider than the
 * band, 0 for nothing to draw, null for an unmeasured character. See `lineCount`.
 */
export function topTitleLine1LineCount(line: string | null | undefined): number | null {
  if (line === null || line === undefined) return null
  return lineCount(line, LINE1)
}

/** The same for `line2`. See `lineCount`. */
export function topTitleLine2LineCount(line: string | null | undefined): number | null {
  if (line === null || line === undefined) return null
  return lineCount(line, LINE2)
}

/** THE GATE for `line1`. Does it draw on one line of the 1697 px band? */
export function topTitleLine1Fits(line: string | null | undefined): boolean {
  return fitsOneLine(line, LINE1)
}

/**
 * THE GATE for `line2`, the optional slot.
 *
 * AN EMPTY `line2` IS REFUSED HERE AND THAT IS NOT THE SAME AS REFUSING THE
 * DEVICE. The schema's `line2` defaults to `''`, which means "draw one line";
 * the caller omits the second block rather than asking this whether an empty
 * string fits. What this answers is only ever "may these words be drawn", and
 * the empty string is not words.
 */
export function topTitleLine2Fits(line: string | null | undefined): boolean {
  return fitsOneLine(line, LINE2)
}

/* ------------------------------------------------------- the prompt cap -- */

/**
 * The count the PLANNER PROMPT asks for, which is not the schema bound in
 * `devices.ts`.
 *
 * ##########################################################################
 * # 21, WHICH IS WHAT THE GATE MEASURES ON THE FACE HIS CLIP IS SET IN.    #
 * #                                                                        #
 * # MEASURED on this film's own script (tmp/v52/render/segment.json, 164   #
 * # scenes, 8,578 characters, 1,414 words once edge punctuation is         #
 * # stripped): every run of consecutive whole words up to the schema's 28, #
 * # 5,158 distinct runs, put through the gate above.                       #
 * #                                                                        #
 * #   Libre Franklin 800, 122 px, band 1685   (until 2026-09-17)           #
 * #     every run up to 24 characters draws on one line; the first refusal #
 * #     at 25, "dead remember us The Book", 1691.41 px                     #
 * #                                                                        #
 * #   Noto Sans Bold, 130 px, 0.5 px tracking, band 1697   (now)           #
 * #     every run up to 21 characters draws on one line; the first refusal #
 * #     at 22, "chambers They remember", 1714.00 px. Refused at 22: 2 of   #
 * #     233 runs, at 23: 6 of 224, at 24: 24 of 227, at 28: 236 of 239.    #
 * #                                                                        #
 * #   NO SINGLE WORD IN THIS SCRIPT IS WIDER THAN THE BAND. The longest    #
 * #   that draws is "unconsciousness" at 1104.18 px, so the `Infinity`     #
 * #   branch is reachable only by copy the planner invents — which the     #
 * #   28-character bound admits, and which is why the branch exists.       #
 * #                                                                        #
 * # 24 -> 21 ON 2026-09-17, ONE COMMIT AFTER THE FACE, AND ON PURPOSE.     #
 * # The face moved first and this number stayed at 24, because it is       #
 * # interpolated into the planner prompt and moving it forces              #
 * # `VISUAL_PLAN_PROMPT_VERSION` up, so the next job calls the planner     #
 * # again and re-draws the whole sheet. The developer took that decision:  #
 * # at 24 the prompt was ASKING for lines the gate refuses, 24 of the 227  #
 * # real 24-character runs, and a refused first line draws nothing at all. #
 * # 21 is the largest N at which every run of the script draws, and it is  #
 * # not set by one undrawable word the way P03's 19 once was: the first    #
 * # refusal at 22 is three ordinary words. Prompt version 19 carries it.   #
 * #                                                                        #
 * # THE SCHEMA BOUND STAYS ABOVE THIS at 28, just past the widest run the  #
 * # gate ever passes ("in a state of full conscious", 28 characters,       #
 * # 1696.72 px of 1697). This moves only what the planner is ASKED for,    #
 * # and the gate is what actually refuses.                                 #
 * ##########################################################################
 */
export const TOP_TITLE_PROMPT_CHARS = 21
