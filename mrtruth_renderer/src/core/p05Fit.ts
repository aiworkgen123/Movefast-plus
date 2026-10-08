/**
 * P05's FOUR LINES, MEASURED BEFORE THEIR WORDS MAY REACH A FRAME.
 *
 * ##########################################################################
 * # P05 SETS THREE LINES IN A 678 px COLUMN ON THE LEFT AND ONE INSIDE ITS #
 * # PICTURE PANEL, AND NOTHING IN THE COMPONENT SHORTENS ANY OF THEM.      #
 * #                                                                        #
 * #   eyebrow     20 px, upper-cased, 4.2 px tracking, one line of 678     #
 * #   headline    78 px, upper-cased, 0.4 px tracking, wraps in 678        #
 * #   support     27 px, as written, 0.6 px tracking, wraps in 580         #
 * #   image label 17 px, upper-cased, 2.5 px tracking, one line of 718     #
 * #                                                                        #
 * # A headline that takes a fourth line grows the column up and down the   #
 * # frame, a word wider than the column runs under the picture panel, and  #
 * # a label wider than the picture runs over the gold stroke, all at exit  #
 * # 0 with nothing red anywhere.                                           #
 * #                                                                        #
 * # SO IT SUMS THE FACES' OWN ADVANCES, the lesson `shadowUpFit.ts`,        #
 * # `bulletChecklistFit.ts`, `p04Fit.ts` and `p02Fit.ts` already paid for:  #
 * # a character count cannot tell 'I' (0.306 em) from 'W' (1.071 em).       #
 * #                                                                        #
 * # REFUSES, NEVER TRUNCATES. A headline that needs a fourth line is       #
 * # refused, and so is one holding a single word wider than the column.   #
 * # An eyebrow, support line or label that does not fit is left off the    #
 * # frame entirely, by the chooser, and never cut.                        #
 * ##########################################################################
 *
 * THE FACE IS THE FILM'S OWN, AT TWO REGISTERED WEIGHTS. The pack named Arial
 * bold and Georgia italic, which are not on the render box. `P05.tsx` sets the
 * eyebrow, headline and image label in `FONT_FAMILY`, Libre Franklin, at 600
 * (`LibreFranklin-SemiBold.woff2`), and the support line at 500
 * (`LibreFranklin-Medium.woff2`). Both are STATIC faces, so their `hmtx` tables
 * are the widths Chrome draws, with no variation deltas to apply.
 *
 * THE SUPPORT LINE IS ITALIC AND THAT DOES NOT MOVE A WIDTH. No italic face is
 * registered, so Chrome slants the upright one, which keeps every advance.
 *
 * KERNING AND LIGATURES ARE LEFT ON, as the pack drew them, so these sums
 * over-predict by the pairs Chrome tightens. That is the direction to err in: a
 * gate that over-predicts refuses a line that would just have fitted, and one
 * that under-predicts ships a fourth line down the frame.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `p02Fit.ts`. The compositor
 * imports @vg/core/{schemas,devices,frames,motion} and nothing else, so nothing
 * here can move `bundleHash`.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/p05Mirror.test.ts` pins every advance against the woff2
 * bytes in `apps/web/public/fonts`, and the sizes, tracking, weights and widths
 * against `P05_TYPE` in the template itself.
 */

/**
 * Libre Franklin SemiBold's advance for each character the eyebrow, headline or
 * image label may hold, in thousandths of an em (`unitsPerEm` 1000), off the
 * `hmtx` table of `apps/web/public/fonts/LibreFranklin-SemiBold.woff2`. CAPITALS
 * ONLY, because all three are upper-cased before they are measured, as the
 * component draws them: printable ASCII less the lower case, the curly quotes,
 * both dashes, the ellipsis, the Latin-1 capitals and Œ. Read off the bytes by
 * `tmp/v53/templates/P05/p05-metrics.mts`, never typed from a specimen.
 */
export const P05_CAPS_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 209, '!': 257, '"': 449, '#': 603, $: 638, '%': 935, '&': 818, "'": 245,
  '(': 304, ')': 304, '*': 436, '+': 574, ',': 239, '-': 380, '.': 237, '/': 357,
  '0': 701, '1': 494, '2': 628, '3': 658, '4': 675, '5': 669, '6': 677, '7': 612, '8': 678, '9': 675,
  ':': 237, ';': 249, '<': 566, '=': 574, '>': 566, '?': 532, '@': 834,
  A: 756, B: 715, C: 719, D: 741, E: 645, F: 621, G: 747, H: 746, I: 306, J: 437, K: 729, L: 619, M: 934,
  N: 758, O: 770, P: 706, Q: 772, R: 713, S: 665, T: 669, U: 717, V: 724, W: 1071, X: 715, Y: 715, Z: 664,
  '[': 306, '\\': 357, ']': 306, '^': 475, _: 535, '`': 299, '{': 345, '|': 255, '}': 345, '~': 595,
  '‘': 234, '’': 234, '“': 442, '”': 445, '–': 575, '—': 899, '…': 840,
  À: 756, Á: 756, Â: 756, Ã: 756, Ä: 756, Å: 756, Æ: 1055, Ç: 719, È: 645, É: 645, Ê: 645, Ë: 645,
  Ì: 306, Í: 306, Î: 306, Ï: 306, Ð: 753, Ñ: 758, Ò: 770, Ó: 770, Ô: 770, Õ: 770, Ö: 770, Ø: 752,
  Ù: 717, Ú: 717, Û: 717, Ü: 717, Ý: 715, Þ: 713, Œ: 1127,
}

/**
 * Libre Franklin Medium's advance for each character the support line may hold,
 * off `apps/web/public/fonts/LibreFranklin-Medium.woff2`, read the same way. BOTH
 * CASES, because the support line is drawn as written: printable ASCII, the curly
 * quotes, both dashes, the ellipsis, the Latin-1 letters and Œ œ.
 */
export const P05_SUPPORT_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 212, '!': 251, '"': 428, '#': 603, $: 621, '%': 925, '&': 797, "'": 242, '(': 294, ')': 294, '*': 407, '+': 565,
  ',': 225, '-': 381, '.': 222, '/': 349, '0': 694, '1': 479, '2': 613, '3': 649, '4': 661, '5': 661, '6': 669, '7': 606,
  '8': 673, '9': 666, ':': 222, ';': 238, '<': 554, '=': 565, '>': 554, '?': 527, '@': 834,
  A: 741, B: 707, C: 712, D: 731, E: 636, F: 611, G: 743, H: 740, I: 298, J: 427, K: 714, L: 610, M: 919,
  N: 757, O: 767, P: 698, Q: 768, R: 704, S: 652, T: 656, U: 713, V: 715, W: 1057, X: 701, Y: 694, Z: 647,
  '[': 296, '\\': 349, ']': 296, '^': 476, _: 526, '`': 292,
  a: 552, b: 602, c: 545, d: 602, e: 582, f: 386, g: 611, h: 588, i: 247, j: 247, k: 576, l: 248, m: 910,
  n: 588, o: 599, p: 601, q: 602, r: 396, s: 517, t: 401, u: 583, v: 555, w: 803, x: 559, y: 541, z: 493,
  '{': 324, '|': 258, '}': 324, '~': 581, '‘': 228, '’': 228, '“': 419, '”': 421, '–': 566, '—': 889, '…': 793,
  À: 741, Á: 741, Â: 741, Ã: 741, Ä: 741, Å: 741, Æ: 1031, Ç: 712, È: 636, É: 636, Ê: 636, Ë: 636,
  Ì: 298, Í: 298, Î: 298, Ï: 298, Ð: 739, Ñ: 757, Ò: 767, Ó: 767, Ô: 767, Õ: 767, Ö: 767, Ø: 740,
  Ù: 713, Ú: 713, Û: 713, Ü: 713, Ý: 694, Þ: 703, ß: 621,
  à: 552, á: 552, â: 552, ã: 552, ä: 552, å: 552, æ: 920, ç: 545, è: 582, é: 582, ê: 582, ë: 582,
  ì: 247, í: 247, î: 247, ï: 247, ð: 599, ñ: 588, ò: 599, ó: 599, ô: 599, õ: 599, ö: 599, ø: 587,
  ù: 583, ú: 583, û: 583, ü: 583, ý: 541, þ: 599, ÿ: 541, Œ: 1125, œ: 986,
}

/* The template's own numbers, mirrored. Pinned against `P05_TYPE` by the web test. */
export const P05_CAPS_FONT_WEIGHT_MIRROR = 600
export const P05_SUPPORT_FONT_WEIGHT_MIRROR = 500
export const P05_EYEBROW_FONT_SIZE_MIRROR = 20
export const P05_EYEBROW_LETTER_SPACING_MIRROR = 4.2
export const P05_HEADLINE_FONT_SIZE_MIRROR = 78
export const P05_HEADLINE_LETTER_SPACING_MIRROR = 0.4
export const P05_SUPPORT_FONT_SIZE_MIRROR = 27
export const P05_SUPPORT_LETTER_SPACING_MIRROR = 0.6
export const P05_IMAGE_LABEL_FONT_SIZE_MIRROR = 17
export const P05_IMAGE_LABEL_LETTER_SPACING_MIRROR = 2.5
/** The column's 760 px less its 82 px right padding. See `p05Type.ts`. */
export const P05_CONTENT_WIDTH_MIRROR = 678
/** The support line's own `maxWidth`. */
export const P05_SUPPORT_MAX_WIDTH_MIRROR = 580
/** The picture box's 746 px less the label's 12 px inset and its 14 px backing each side. */
export const P05_IMAGE_LABEL_MAX_WIDTH_MIRROR = 718

/**
 * THREE LINES FOR THE HEADLINE, AND NO MORE.
 *
 * The pack's contract asks for "one concise claim" and "do not add
 * subtitle-length narration", and its own fixture draws three lines. The column
 * is centred on the frame's height, so every line grows it 76 px, half up and
 * half down. Three lines with an eyebrow and a two-line support line make a
 * column about 395 px tall, from y 342 to y 738, the pack's own preview. A fourth
 * line of 78 px capitals turns a claim into a paragraph set in display type.
 */
export const P05_HEADLINE_MAX_LINES = 3

/**
 * TWO LINES FOR THE SUPPORT LINE, AND NO MORE. The pack's fixture draws two, and
 * a third is subtitle-length narration beside a picture, which its contract
 * refuses.
 */
export const P05_SUPPORT_MAX_LINES = 2

type Setting = {
  readonly advances: Readonly<Record<string, number>>
  readonly sizePx: number
  readonly trackingPx: number
  readonly widthPx: number
  /** Upper-cased before measuring, because the component draws it that way. */
  readonly upperCase: boolean
}

const EYEBROW: Setting = {
  advances: P05_CAPS_ADVANCE_MIRROR,
  sizePx: P05_EYEBROW_FONT_SIZE_MIRROR,
  trackingPx: P05_EYEBROW_LETTER_SPACING_MIRROR,
  widthPx: P05_CONTENT_WIDTH_MIRROR,
  upperCase: true,
}
const HEADLINE: Setting = {
  advances: P05_CAPS_ADVANCE_MIRROR,
  sizePx: P05_HEADLINE_FONT_SIZE_MIRROR,
  trackingPx: P05_HEADLINE_LETTER_SPACING_MIRROR,
  widthPx: P05_CONTENT_WIDTH_MIRROR,
  upperCase: true,
}
const SUPPORT: Setting = {
  advances: P05_SUPPORT_ADVANCE_MIRROR,
  sizePx: P05_SUPPORT_FONT_SIZE_MIRROR,
  trackingPx: P05_SUPPORT_LETTER_SPACING_MIRROR,
  widthPx: P05_SUPPORT_MAX_WIDTH_MIRROR,
  upperCase: false,
}
const IMAGE_LABEL: Setting = {
  advances: P05_CAPS_ADVANCE_MIRROR,
  sizePx: P05_IMAGE_LABEL_FONT_SIZE_MIRROR,
  trackingPx: P05_IMAGE_LABEL_LETTER_SPACING_MIRROR,
  widthPx: P05_IMAGE_LABEL_MAX_WIDTH_MIRROR,
  upperCase: true,
}

/**
 * How wide a run of characters draws, in screen pixels, or null when it holds a
 * character the mirror does not name.
 *
 * `letter-spacing` is added after every character INCLUDING THE LAST, which is
 * what Chrome puts into the line's own width (the rule `p03WordWidth` records).
 * An unmeasured character refuses rather than guesses, because Chrome would draw
 * it in a fallback face at a width nothing here knows.
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

/** The words of a line as the component lays them out: cased as drawn, whitespace runs folded. */
function wordsOf(line: string, setting: Setting): string[] {
  const cased = setting.upperCase ? line.toUpperCase() : line
  return cased.trim().split(/\s+/).filter((word) => word.length > 0)
}

/**
 * How many lines a wrapping line draws on, `Infinity` when one word alone is
 * wider than its measure, or null when it holds an unmeasured character.
 *
 * ##########################################################################
 * # A GREEDY FILL ON SPACES, WHICH IS WHAT CHROME'S LINE BREAKER DOES WITH #
 * # ORDINARY TEXT, as `p02HeadlineLineCount` records. A space between two  #
 * # words costs its own advance and tracking; the space a line breaks on   #
 * # hangs and costs nothing.                                               #
 * #                                                                        #
 * # CHROME MAY ALSO BREAK AFTER A HYPHEN, AND THIS DOES NOT. Fewer break   #
 * # opportunities can only predict MORE lines, so it errs towards refusing.#
 * #                                                                        #
 * # A WORD WIDER THAN THE MEASURE IS `Infinity`. Nothing in the component  #
 * # sets `overflow-wrap`, so Chrome does not break inside a word; it runs   #
 * # out past the measure. That is a clip, not a wrap.                      #
 * ##########################################################################
 */
function lineCount(line: string, setting: Setting): number | null {
  const words = wordsOf(line, setting)
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

/** How wide a one-line setting draws, cased as drawn, or null when it holds an unmeasured character. */
function oneLineWidth(line: string, setting: Setting): number | null {
  return runWidth(wordsOf(line, setting).join(' '), setting)
}

function fitsOneLine(line: string, setting: Setting): boolean {
  const width = oneLineWidth(line, setting)
  return width !== null && width > 0 && width <= setting.widthPx
}

/** How many lines of the 678 px column the headline takes, in capitals. See `lineCount`. */
export function p05HeadlineLineCount(line: string): number | null {
  return lineCount(line, HEADLINE)
}

/** Does the headline draw on at most three lines of the column? An unmeasured character does not. */
export function p05HeadlineFits(line: string): boolean {
  const lines = p05HeadlineLineCount(line)
  return lines !== null && lines >= 1 && lines <= P05_HEADLINE_MAX_LINES
}

/** How many lines of the 580 px measure the support line takes, as written. See `lineCount`. */
export function p05SupportLineCount(line: string): number | null {
  return lineCount(line, SUPPORT)
}

/** Does the support line draw on at most two lines of its measure? */
export function p05SupportLineFits(line: string): boolean {
  const lines = p05SupportLineCount(line)
  return lines !== null && lines >= 1 && lines <= P05_SUPPORT_MAX_LINES
}

/** How wide the eyebrow draws on ONE line, upper-cased, or null when it holds an unmeasured character. */
export function p05EyebrowWidth(line: string): number | null {
  return oneLineWidth(line, EYEBROW)
}

/**
 * Does the eyebrow draw on ONE line of the column?
 *
 * ONE, BECAUSE IT IS THE SMALL GOLD LINE OVER A HEADLINE. An eyebrow that wraps
 * is no longer small and pushes the headline down, so the chooser leaves it off.
 */
export function p05EyebrowFits(line: string): boolean {
  return fitsOneLine(line, EYEBROW)
}

/** How wide the image label draws on ONE line, upper-cased, or null when it holds an unmeasured character. */
export function p05ImageLabelWidth(line: string): number | null {
  return oneLineWidth(line, IMAGE_LABEL)
}

/**
 * Does the image label draw on ONE line inside the picture?
 *
 * ONE, AND INSIDE THE PICTURE BOX. The label is absolutely placed with no right
 * edge, so Chrome would let it grow to the panel's own edge and over the gold
 * stroke before it wrapped. 718 px keeps its backing on the picture.
 */
export function p05ImageLabelFits(line: string): boolean {
  return fitsOneLine(line, IMAGE_LABEL)
}

/* ------------------------------------------------------- the prompt caps -- */

/**
 * The counts the PLANNER PROMPT asks for, which are not the schema bounds in
 * `devices.ts`.
 *
 * ##########################################################################
 * # MEASURED, NOT ESTIMATED, on job 99414763's own script (ingest.json    #
 * # `scriptText`, 8,742 characters, 1,404 words once edge punctuation is  #
 * # stripped): every run of consecutive whole words, 20,518 distinct runs #
 * # up to 96 characters, put through the four gates above by              #
 * # tmp/v53/templates/P05/measure-p05-caps.mts.                            #
 * #                                                                        #
 * #   HEADLINE, 25, AND NO WORD OVER 11 CHARACTERS, a hyphen counted, as   #
 * #   P02's cap is and for P02's reason. At 78 px capitals nine            #
 * #   words of the script are wider than the 678 px column on their own,  #
 * #   the shortest "commentators" at 12 letters, so no length can draw a   #
 * #   run holding one. Leave those out and every run up to 25 characters   #
 * #   draws on three lines or fewer; the first fourth line arrives at 26,  #
 * #   "chambers They remember who". From 45 every run is refused.          #
 * #                                                                        #
 * #   EYEBROW, 38. Every run up to 38 draws on one line, the widest "the    #
 * #   chapter twenty-two cosmology noted" at 670.8 px of 678. At 39 the     #
 * #   first is refused, "Book of Enoch was removed from approved" at 678.4. #
 * #                                                                        #
 * #   SUPPORT LINE, 48. Every run up to 62 draws on two lines of 580 px,   #
 * #   and the first refused arrives at 63. `visualPlan.ts` used to cut     #
 * #   every `lines` entry at 48 on a word, which set this ask. It now      #
 * #   carries P05's lines whole and the arm refuses one it cannot hold     #
 * #   (`TEMPLATES_REFUSED_NOT_CUT`), so 48 stays a safe ask under 62.      #
 * #                                                                        #
 * #   PICTURE LABEL, 48. Every run up to 52 draws on one line of 718 px,    #
 * #   the widest at 717.1, and the first refused arrives at 53. It is a     #
 * #   `lines` entry too, carried whole the same way, and 48 stays under 52.#
 * #                                                                        #
 * # THE SCHEMA BOUNDS STAY ABOVE THESE, just past the widest run each gate #
 * # ever passed: 48 for the headline (44), 48 for the eyebrow (43), 96 for #
 * # the support line (92) and 60 for the label (59). These move only what  #
 * # the planner is ASKED for, and `anthropic-visual-plan.ts` interpolates   #
 * # them so the prompt and the gates cannot drift apart.                   #
 * ##########################################################################
 */
export const P05_HEADLINE_PROMPT_CHARS = 25
export const P05_HEADLINE_PROMPT_LONGEST_WORD = 11
export const P05_EYEBROW_PROMPT_CHARS = 38
export const P05_SUPPORT_PROMPT_CHARS = 48
export const P05_IMAGE_LABEL_PROMPT_CHARS = 48
