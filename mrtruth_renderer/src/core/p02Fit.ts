/**
 * P02's CARD, MEASURED BEFORE ITS WORDS MAY REACH A FRAME.
 *
 * ##########################################################################
 * # P02 SETS TWO LINES INSIDE A 650 px PAPER CARD, AND THE CARD GROWS.     #
 * # Its padding and border leave 524 px for type. The headline is 59 px,  #
 * # in sentence case, and wraps as ordinary text. The label above it is   #
 * # 19 px, upper-cased, 4.1 px of tracking. Nothing in the component       #
 * # shortens either line, so a headline that does not fit grows the card   #
 * # up and down over the photograph, and a word wider than the card runs   #
 * # out past its right edge, both at exit 0, with nothing red anywhere.    #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES, the lesson `shadowUpFit.ts`,       #
 * # `bulletChecklistFit.ts` and `p04Fit.ts` already paid for: a character #
 * # count cannot tell 'i' (0.256 em) from 'm' (0.914 em), and those are    #
 * # three and a half times apart in this face.                             #
 * #                                                                        #
 * # REFUSES, NEVER TRUNCATES. A headline that needs a fifth line is        #
 * # refused, and so is one holding a single word wider than the card. A    #
 * # label that would wrap is left off the frame entirely.                  #
 * ##########################################################################
 *
 * THE FACE IS THE FILM'S OWN, AT ONE REGISTERED WEIGHT. The pack named Arial
 * bold and Georgia bold, which are not on the render box. `P02.tsx` sets both
 * lines in `FONT_FAMILY`, Libre Franklin, at 600 (`LibreFranklin-SemiBold.woff2`).
 * It is a STATIC face, so its `hmtx` table is the widths Chrome draws, with no
 * variation deltas to apply.
 *
 * KERNING AND LIGATURES ARE LEFT ON, as the pack drew them, so these sums
 * over-predict by the pairs Chrome tightens and the ligatures it joins. That is
 * the direction to err in: a gate that over-predicts refuses a line that would
 * just have fitted, and one that under-predicts ships a fifth line over the
 * picture. `p04Fit.ts` takes the same trade.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `p04Fit.ts`. The compositor
 * imports @vg/core/{schemas,devices,frames,motion} and nothing else, so nothing
 * here can move `bundleHash`.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/p02Mirror.test.ts` pins every advance against the woff2
 * bytes in `apps/web/public/fonts`, and the sizes, tracking, weight and content
 * width against `P02_TYPE` in the template itself.
 */

/**
 * Libre Franklin SemiBold's advance for each character either line may hold, in
 * thousandths of an em (`unitsPerEm` 1000), off the `hmtx` table of
 * `apps/web/public/fonts/LibreFranklin-SemiBold.woff2`. BOTH CASES, because the
 * headline is drawn as written: printable ASCII, the curly quotes, both dashes,
 * the ellipsis, the Latin-1 letters and Œ œ. Read off the bytes by
 * `tmp/v53/templates/P02/p02-metrics.mts`, never typed from a specimen.
 */
export const P02_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 209, '!': 257, '"': 449, '#': 603, $: 638, '%': 935, '&': 818, "'": 245, '(': 304, ')': 304, '*': 436, '+': 574,
  ',': 239, '-': 380, '.': 237, '/': 357, '0': 701, '1': 494, '2': 628, '3': 658, '4': 675, '5': 669, '6': 677, '7': 612,
  '8': 678, '9': 675, ':': 237, ';': 249, '<': 566, '=': 574, '>': 566, '?': 532, '@': 834,
  A: 756, B: 715, C: 719, D: 741, E: 645, F: 621, G: 747, H: 746, I: 306, J: 437, K: 729, L: 619, M: 934,
  N: 758, O: 770, P: 706, Q: 772, R: 713, S: 665, T: 669, U: 717, V: 724, W: 1071, X: 715, Y: 715, Z: 664,
  '[': 306, '\\': 357, ']': 306, '^': 475, _: 535, '`': 299,
  a: 558, b: 606, c: 548, d: 606, e: 584, f: 394, g: 622, h: 592, i: 256, j: 256, k: 590, l: 257, m: 914,
  n: 592, o: 599, p: 605, q: 606, r: 411, s: 524, t: 417, u: 588, v: 564, w: 811, x: 575, y: 554, z: 506,
  '{': 345, '|': 255, '}': 345, '~': 595, '‘': 234, '’': 234, '“': 442, '”': 445, '–': 575, '—': 899, '…': 840,
  À: 756, Á: 756, Â: 756, Ã: 756, Ä: 756, Å: 756, Æ: 1055, Ç: 719, È: 645, É: 645, Ê: 645, Ë: 645,
  Ì: 306, Í: 306, Î: 306, Ï: 306, Ð: 753, Ñ: 758, Ò: 770, Ó: 770, Ô: 770, Õ: 770, Ö: 770, Ø: 752,
  Ù: 717, Ú: 717, Û: 717, Ü: 717, Ý: 715, Þ: 713, ß: 635,
  à: 558, á: 558, â: 558, ã: 558, ä: 558, å: 558, æ: 917, ç: 548, è: 584, é: 584, ê: 584, ë: 584,
  ì: 256, í: 256, î: 256, ï: 256, ð: 599, ñ: 592, ò: 599, ó: 599, ô: 599, õ: 599, ö: 599, ø: 591,
  ù: 588, ú: 588, û: 588, ü: 588, ý: 554, þ: 603, ÿ: 554, Œ: 1127, œ: 975,
}

/* The template's own numbers, mirrored. Pinned against `P02_TYPE` by the web test. */
export const P02_FONT_WEIGHT_MIRROR = 600
export const P02_LABEL_FONT_SIZE_MIRROR = 19
export const P02_LABEL_LETTER_SPACING_MIRROR = 4.1
export const P02_HEADLINE_FONT_SIZE_MIRROR = 59
/** The pack sets no tracking on the headline. */
export const P02_HEADLINE_LETTER_SPACING_MIRROR = 0
/** 650 px of card less 62 px of padding and 1 px of border each side. See `p02Type.ts`. */
export const P02_CONTENT_WIDTH_MIRROR = 524

/**
 * FOUR LINES FOR THE HEADLINE, AND NO MORE.
 *
 * The pack's contract asks for "normally 4 to 14 words, constrained by actual
 * fit", and its own fixture draws three lines. The card is centred on the
 * frame's height, so every line grows it 63.7 px, half up and half down. Four
 * lines with a label make a card about 448 px tall, from y 316 to y 764, which
 * still leaves the top and bottom thirds of the photograph clear and stays
 * inside the chooser's subject gate. A fifth line would push the card past
 * 510 px and turn an editorial card into a panel of text.
 */
export const P02_HEADLINE_MAX_LINES = 4

type Setting = {
  readonly sizePx: number
  readonly trackingPx: number
}

const LABEL: Setting = { sizePx: P02_LABEL_FONT_SIZE_MIRROR, trackingPx: P02_LABEL_LETTER_SPACING_MIRROR }
const HEADLINE: Setting = {
  sizePx: P02_HEADLINE_FONT_SIZE_MIRROR,
  trackingPx: P02_HEADLINE_LETTER_SPACING_MIRROR,
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
    const advance = P02_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (thousandths / 1000) * setting.sizePx + characters * setting.trackingPx
}

/**
 * How many lines the headline draws on, `Infinity` when one word alone is wider
 * than the card, or null when it holds an unmeasured character.
 *
 * ##########################################################################
 * # A GREEDY FILL ON SPACES, WHICH IS WHAT CHROME'S LINE BREAKER DOES WITH #
 * # ORDINARY TEXT. Drawn as written, so no case folding. A space between   #
 * # two words costs its own advance; the space a line breaks on hangs and  #
 * # costs nothing.                                                         #
 * #                                                                        #
 * # CHROME MAY ALSO BREAK AFTER A HYPHEN, AND THIS DOES NOT. Fewer break   #
 * # opportunities can only predict MORE lines, never fewer, so ignoring    #
 * # the hyphen errs towards refusing.                                      #
 * #                                                                        #
 * # A WORD WIDER THAN THE CARD IS `Infinity`. Nothing in the component     #
 * # sets `overflow-wrap`, so Chrome does not break inside a word; the word #
 * # runs out past the 524 px measure and over the card's padding. That is  #
 * # a clip, not a wrap.                                                    #
 * ##########################################################################
 */
export function p02HeadlineLineCount(line: string): number | null {
  const words = line.trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return 0
  const space = runWidth(' ', HEADLINE)
  if (space === null) return null

  let lines = 1
  let used = 0
  for (const word of words) {
    const width = runWidth(word, HEADLINE)
    if (width === null) return null
    if (width > P02_CONTENT_WIDTH_MIRROR) return Number.POSITIVE_INFINITY
    if (used === 0) {
      used = width
      continue
    }
    if (used + space + width <= P02_CONTENT_WIDTH_MIRROR) {
      used += space + width
      continue
    }
    lines += 1
    used = width
  }
  return lines
}

/** Does the headline draw on at most four lines of the card? An unmeasured character does not. */
export function p02HeadlineFits(line: string): boolean {
  const lines = p02HeadlineLineCount(line)
  return lines !== null && lines >= 1 && lines <= P02_HEADLINE_MAX_LINES
}

/**
 * How wide the label draws on ONE line, upper-cased, or null when it holds an
 * unmeasured character. Whitespace runs count as one space, which is how the
 * line is laid out. Upper-cased first, so ß is measured as the SS it draws.
 */
export function p02LabelWidth(line: string): number | null {
  const words = line.toUpperCase().trim().split(/\s+/).filter((word) => word.length > 0)
  return runWidth(words.join(' '), LABEL)
}

/**
 * Does the label draw on ONE line of the card?
 *
 * ONE, BECAUSE IT IS THE SMALL SECTION LINE OVER A HEADLINE. A label that wraps
 * is no longer small and pushes the headline down, so the chooser leaves it off
 * the frame rather than let it grow the card.
 */
export function p02LabelFits(line: string): boolean {
  const width = p02LabelWidth(line)
  return width !== null && width > 0 && width <= P02_CONTENT_WIDTH_MIRROR
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
 * # up to 96 characters, put through the two gates above by               #
 * # tmp/v53/templates/P02/measure-p02-caps.mts.                            #
 * #                                                                        #
 * #   HEADLINE, 46, AND NO WORD OVER 16 CHARACTERS. Two words of the       #
 * #   script are wider than the card on their own, "name-preservation"    #
 * #   (17 characters) and "already-accomplished" (20), so no length can    #
 * #   draw a run holding either. Leave those out and every run up to 46    #
 * #   characters draws on four lines or fewer; the first five-line         #
 * #   headline arrives at 47, "chapters thirty-seven through seventy-one   #
 * #   where". At 64 half the runs are refused, and from 78 every one is.   #
 * #                                                                        #
 * #   CHARACTERS, A HYPHEN COUNTED, AND NOT LETTERS. "name-preservation"   #
 * #   is 16 letters and is refused, so a cap in letters let the planner    #
 * #   write a word the gate refuses. Counted in characters, no word of     #
 * #   the script of 16 or fewer is refused                                 #
 * #   (tmp/v53/templates/review-fix/measure-p02-words.out.txt).            #
 * #                                                                        #
 * #   AND 16 IS A GUIDE, NOT A PROMISE. Width is set by which letters a    #
 * #   word holds, not how many. "Misunderstanding" is 16 and 511 px, and   #
 * #   fits. "Counterarguments" is 16 and 538 px, past 524, and is refused. #
 * #   The width gate makes the final call, and the prompt tells the        #
 * #   planner a headline that fails draws nothing.                         #
 * #                                                                        #
 * #   LABEL, 30. Every run up to 30 characters draws on one line, the      #
 * #   widest "watching language to show what" at 508.4 px of 524. At 31    #
 * #   the first is refused, "Enoch was removed from approved" at 524.9 px, #
 * #   and from 36 every run is.                                            #
 * #                                                                        #
 * # THE SCHEMA BOUNDS STAY ABOVE THESE. `P02_HEADLINE_MAX_CHARS` is also   #
 * # where `visualPlan.ts` refuses a longer sheet headline rather than cut  #
 * # it, because a cut line is a different claim (`TEMPLATES_REFUSED_NOT_   #
 * # CUT`), so a fit measurement does not belong there. These               #
 * # move only what the planner is ASKED for, and `anthropic-visual-plan.ts`#
 * # interpolates them so the prompt and the gates cannot drift apart.      #
 * ##########################################################################
 */
export const P02_HEADLINE_PROMPT_CHARS = 46
export const P02_HEADLINE_PROMPT_LONGEST_WORD = 16
export const P02_LABEL_PROMPT_CHARS = 30
