/**
 * P04's LABEL, MEASURED BEFORE IT MAY REACH A FRAME.
 *
 * ##########################################################################
 * # P04 SETS TWO LINES INSIDE A 620 px BLOCK AT THE LOWER LEFT, AND THE    #
 * # BLOCK WRAPS. The main line is 48 px, upper-cased, 2.2 px of tracking,  #
 * # and it wraps onto a second line when it runs past 620. The support     #
 * # line under it is 23 px, upper-cased, 1.9 px of tracking. Nothing in    #
 * # the component shortens either line, so a label that does not fit      #
 * # either grows upward over the photograph or runs off the block, at      #
 * # exit 0, with nothing red anywhere.                                     #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES, the lesson `shadowUpFit.ts` and    #
 * # `bulletChecklistFit.ts` already paid for: a character count cannot     #
 * # tell 'I' (0.306 em) from 'W' (1.071 em), and those are three and a     #
 * # half times apart in this face.                                         #
 * #                                                                        #
 * # REFUSES, NEVER TRUNCATES. A main line that needs a third line is       #
 * # refused, and so is one holding a single word wider than the block.     #
 * # A support line that would wrap is left off the frame entirely.         #
 * ##########################################################################
 *
 * THE FACE IS THE FILM'S OWN, AT TWO REGISTERED WEIGHTS. The pack named Arial
 * bold and Georgia italic, which are not on the render box. `P04.tsx` sets both
 * lines in `FONT_FAMILY`, Libre Franklin, as `P03.tsx` does: the main line at
 * 600 (`LibreFranklin-SemiBold.woff2`) and the support line at 500
 * (`LibreFranklin-Medium.woff2`). Both are STATIC faces, so their `hmtx` tables
 * are the widths Chrome draws, with no variation deltas to apply.
 *
 * THE SUPPORT LINE IS ITALIC AND THAT DOES NOT MOVE A WIDTH. No italic face is
 * registered, so Chrome slants the upright one. A synthesised slant shears the
 * outlines and keeps every advance, which is why the upright face's table is the
 * right one to sum here.
 *
 * KERNING IS LEFT ON, as the pack drew it, so these sums over-predict by the
 * kerning pairs Chrome tightens. That is the direction to err in: a gate that
 * over-predicts refuses a label that would just have fitted, and one that
 * under-predicts ships a third line over the picture. `bulletChecklistFit.ts`
 * takes the same trade for a7's title.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `shadowUpFit.ts`. The
 * compositor imports @vg/core/{schemas,devices,frames,motion} and nothing else,
 * so nothing here can move `bundleHash`.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/p04Mirror.test.ts` pins every advance against the woff2
 * bytes in `apps/web/public/fonts`, and the sizes, tracking, weights and block
 * width against `P04_TYPE` in the template itself.
 */

/**
 * Libre Franklin SemiBold's advance for each character a main line may hold, in
 * thousandths of an em (`unitsPerEm` 1000), off the `hmtx` table of
 * `apps/web/public/fonts/LibreFranklin-SemiBold.woff2`. Capitals only, because
 * the line is upper-cased before it is measured, as the component draws it:
 * printable ASCII, the curly quotes, both dashes, the ellipsis, the Latin-1
 * capitals and Œ. Read off the bytes by `tmp/v53/templates/P04/p04-metrics.mts`,
 * never typed from a specimen.
 */
export const P04_MAIN_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
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
 * Libre Franklin Medium's advance for each character a support line may hold, off
 * `apps/web/public/fonts/LibreFranklin-Medium.woff2`, read the same way and for
 * the same set. A different table from the main line's on purpose: Medium is
 * narrower than SemiBold on almost every glyph, so reusing the main table would
 * refuse support lines that fit.
 */
export const P04_SUPPORT_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 212, '!': 251, '"': 428, '#': 603, $: 621, '%': 925, '&': 797, "'": 242,
  '(': 294, ')': 294, '*': 407, '+': 565, ',': 225, '-': 381, '.': 222, '/': 349,
  '0': 694, '1': 479, '2': 613, '3': 649, '4': 661, '5': 661, '6': 669, '7': 606, '8': 673, '9': 666,
  ':': 222, ';': 238, '<': 554, '=': 565, '>': 554, '?': 527, '@': 834,
  A: 741, B: 707, C: 712, D: 731, E: 636, F: 611, G: 743, H: 740, I: 298, J: 427, K: 714, L: 610, M: 919,
  N: 757, O: 767, P: 698, Q: 768, R: 704, S: 652, T: 656, U: 713, V: 715, W: 1057, X: 701, Y: 694, Z: 647,
  '[': 296, '\\': 349, ']': 296, '^': 476, _: 526, '`': 292, '{': 324, '|': 258, '}': 324, '~': 581,
  '‘': 228, '’': 228, '“': 419, '”': 421, '–': 566, '—': 889, '…': 793,
  À: 741, Á: 741, Â: 741, Ã: 741, Ä: 741, Å: 741, Æ: 1031, Ç: 712, È: 636, É: 636, Ê: 636, Ë: 636,
  Ì: 298, Í: 298, Î: 298, Ï: 298, Ð: 739, Ñ: 757, Ò: 767, Ó: 767, Ô: 767, Õ: 767, Ö: 767, Ø: 740,
  Ù: 713, Ú: 713, Û: 713, Ü: 713, Ý: 694, Þ: 703, Œ: 1125,
}

/* The template's own numbers, mirrored. Pinned against `P04_TYPE` by the web test. */
export const P04_MAIN_FONT_SIZE_MIRROR = 48
export const P04_MAIN_LETTER_SPACING_MIRROR = 2.2
export const P04_MAIN_FONT_WEIGHT_MIRROR = 600
export const P04_SUPPORT_FONT_SIZE_MIRROR = 23
export const P04_SUPPORT_LETTER_SPACING_MIRROR = 1.9
export const P04_SUPPORT_FONT_WEIGHT_MIRROR = 500
/** The pack's `maxWidth: 620`, the block both lines wrap inside. */
export const P04_LABEL_MAX_WIDTH_MIRROR = 620

/**
 * TWO LINES FOR THE MAIN LINE, AND NO MORE.
 *
 * The pack's own words are "a small two-line identifier" and "never
 * subtitle-length narration". The block is bottom-anchored, so every extra line
 * grows UPWARD over the photograph. Two main lines at 48 px and `lineHeight`
 * 1.05 still sit below y 820, where the chooser's subject gate starts looking;
 * a third lifts the rule into the picture's middle band. "Book of the Watchers"
 * is the case that needs the second line: it sums to 670 px of a 620 px block.
 */
export const P04_MAIN_MAX_LINES = 2

type Setting = {
  readonly advances: Readonly<Record<string, number>>
  readonly sizePx: number
  readonly trackingPx: number
}

const MAIN: Setting = {
  advances: P04_MAIN_ADVANCE_MIRROR,
  sizePx: P04_MAIN_FONT_SIZE_MIRROR,
  trackingPx: P04_MAIN_LETTER_SPACING_MIRROR,
}

const SUPPORT: Setting = {
  advances: P04_SUPPORT_ADVANCE_MIRROR,
  sizePx: P04_SUPPORT_FONT_SIZE_MIRROR,
  trackingPx: P04_SUPPORT_LETTER_SPACING_MIRROR,
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

/**
 * How many lines the main line draws on, `Infinity` when one word alone is wider
 * than the block, or null when it holds an unmeasured character.
 *
 * ##########################################################################
 * # A GREEDY FILL ON SPACES, WHICH IS WHAT CHROME'S LINE BREAKER DOES WITH #
 * # ORDINARY TEXT. Upper-cased first, so ß is measured as the SS it draws. #
 * # A space between two words costs its own advance and its own tracking;  #
 * # the space a line breaks on hangs and costs nothing.                    #
 * #                                                                        #
 * # CHROME MAY ALSO BREAK AFTER A HYPHEN, AND THIS DOES NOT. Fewer break   #
 * # opportunities can only predict MORE lines, never fewer, so ignoring    #
 * # the hyphen errs towards refusing.                                      #
 * #                                                                        #
 * # A WORD WIDER THAN THE BLOCK IS `Infinity`. Nothing in the component    #
 * # sets `overflow-wrap`, so Chrome does not break inside a word; the word #
 * # runs out past the 620 px edge. That is a clip, not a wrap.             #
 * ##########################################################################
 */
export function p04MainLineCount(line: string): number | null {
  const words = line.toUpperCase().trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return 0
  const space = runWidth(' ', MAIN)
  if (space === null) return null

  let lines = 1
  let used = 0
  for (const word of words) {
    const width = runWidth(word, MAIN)
    if (width === null) return null
    if (width > P04_LABEL_MAX_WIDTH_MIRROR) return Number.POSITIVE_INFINITY
    if (used === 0) {
      used = width
      continue
    }
    if (used + space + width <= P04_LABEL_MAX_WIDTH_MIRROR) {
      used += space + width
      continue
    }
    lines += 1
    used = width
  }
  return lines
}

/** Does the main line draw on at most two lines of the block? An unmeasured character does not. */
export function p04MainLineFits(line: string): boolean {
  const lines = p04MainLineCount(line)
  return lines !== null && lines >= 1 && lines <= P04_MAIN_MAX_LINES
}

/**
 * How wide the support line draws on ONE line, upper-cased, or null when it
 * holds an unmeasured character. Whitespace runs count as one space, which is
 * how the line is laid out.
 */
export function p04SupportLineWidth(line: string): number | null {
  const words = line.toUpperCase().trim().split(/\s+/).filter((word) => word.length > 0)
  return runWidth(words.join(' '), SUPPORT)
}

/**
 * Does the support line draw on ONE line of the block?
 *
 * ONE, BECAUSE IT IS THE SMALL LINE UNDER A LABEL. A support line that wraps is
 * no longer small, and the chooser leaves it off the frame rather than let it
 * grow the block upward.
 */
export function p04SupportLineFits(line: string): boolean {
  const width = p04SupportLineWidth(line)
  return width !== null && width > 0 && width <= P04_LABEL_MAX_WIDTH_MIRROR
}

/* ------------------------------------------------------- the prompt caps -- */

/**
 * The character counts the PLANNER PROMPT asks for, which are not the schema
 * bounds in `devices.ts`.
 *
 * ##########################################################################
 * # MEASURED, NOT ESTIMATED, on job 99414763's own script (ingest.json    #
 * # `scriptText`, 8,742 characters, 1,404 words once edge punctuation is  #
 * # stripped): every run of consecutive whole words, 9,534 distinct runs  #
 * # up to 48 characters, put through the two gates above by               #
 * # tmp/v53/templates/P04/measure-p04-caps.mts.                            #
 * #                                                                        #
 * #   LABEL, 19. Every run up to 19 characters draws on two lines or one. #
 * #   Between 20 and 26 the only refusals are runs holding               #
 * #   "already-accomplished", one 20-character word 699 px wide on its    #
 * #   own, which no length can draw. Leave that word out and every run up #
 * #   to 26 fits; the first three-line labels arrive at 27 ("Puech's      #
 * #   grammatical finding"). The same shape as P03's headline, whose     #
 * #   number is also 19, because both are SemiBold capitals in a block.   #
 * #                                                                        #
 * #   SUPPORT LINE, 35. Every run up to 35 characters draws on one line,  #
 * #   the widest "Watchers Enoch chapters one through" at 598.3 px of     #
 * #   620. At 36 one run of 215 is refused, "twenty-two cosmology noted   #
 * #   something" at 627.3 px, and at 42 every run is.                     #
 * #                                                                        #
 * # THE SCHEMA BOUNDS STAY WHERE THEY ARE. `P04_MAIN_LINE_MAX_CHARS` is    #
 * # also where `visualPlan.ts` refuses a longer sheet label rather than    #
 * # cut it, because a cut label names a different thing                    #
 * # (`TEMPLATES_REFUSED_NOT_CUT`), so a fit measurement does not belong    #
 * # there.                                                                 #
 * # These two move only what the planner is ASKED for, and                 #
 * # `anthropic-visual-plan.ts` interpolates them so the prompt and the     #
 * # gates cannot drift apart silently.                                     #
 * ##########################################################################
 */
export const P04_LABEL_PROMPT_CHARS = 19
export const P04_SUPPORT_PROMPT_CHARS = 35
