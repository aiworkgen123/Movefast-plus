/**
 * P09's CARD, MEASURED BEFORE ITS WORDS MAY REACH A FRAME.
 *
 * ##########################################################################
 * # P09 SETS TWO LINES INSIDE A 760 px CARD PINNED BY ITS TOP, AND THE     #
 * # CARD GROWS DOWNWARD. The card is border-box, so its padding and border #
 * # leave 670 px for type. The question carries the pack's own 650 px      #
 * # measure, is 54 px, in sentence case, and wraps as ordinary text. The   #
 * # section label above it is 15 px, upper-cased, 3.8 px of tracking, and #
 * # has no measure of its own, so it is laid into the 670. Nothing in the  #
 * # component shortens either line, so a question that does not fit grows #
 * # the card down over the photograph, and a word wider than the measure   #
 * # runs out past it, both at exit 0, with nothing red anywhere.           #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES, the lesson `shadowUpFit.ts`,       #
 * # `bulletChecklistFit.ts`, `p04Fit.ts` and `p02Fit.ts` already paid for: #
 * # a character count cannot tell 'i' (0.256 em) from 'm' (0.914 em).      #
 * #                                                                        #
 * # REFUSES, NEVER TRUNCATES. A question that needs a fourth line is       #
 * # refused, and so is one holding a single word wider than the measure.   #
 * # A label that would wrap is left off the frame entirely.                #
 * ##########################################################################
 *
 * THE FACE IS THE FILM'S OWN, AT ONE REGISTERED WEIGHT. The pack named Avenir
 * Next bold and New York bold, which are not on the render box. `P09.tsx` sets
 * both lines in `FONT_FAMILY`, Libre Franklin, at 600
 * (`LibreFranklin-SemiBold.woff2`). It is a STATIC face, so its `hmtx` table is
 * the widths Chrome draws, with no variation deltas to apply.
 *
 * THE SAME FILE AT THE SAME WEIGHT AS P02's CARD, SO THE SAME TABLE. The advances
 * are `P02_ADVANCE_MIRROR`, read once off the woff2 by
 * `tmp/v53/templates/P02/p02-metrics.mts` and pinned against the bytes by
 * `apps/web/src/lib/p02Mirror.test.ts`. Typing a second copy would be a second
 * place for one face to drift. `apps/web/src/lib/p09Mirror.test.ts` pins this
 * alias against the same bytes again, so the day P09 moves to another weight the
 * pin goes red rather than P09 quietly measuring P02's face.
 *
 * KERNING AND LIGATURES ARE LEFT ON, as the pack drew them, so these sums
 * over-predict by the pairs Chrome tightens and the ligatures it joins. That is
 * the direction to err in: a gate that over-predicts refuses a line that would
 * just have fitted, and one that under-predicts ships a fourth line over the
 * picture. `p02Fit.ts` takes the same trade.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `p02Fit.ts`. The compositor
 * imports @vg/core/{schemas,devices,frames,motion} and nothing else, so nothing
 * here can move `bundleHash`.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/p09Mirror.test.ts` pins the sizes, tracking, weight and both
 * measures against `P09_TYPE` in the template itself.
 */
import { P02_ADVANCE_MIRROR } from './p02Fit.js'

/**
 * Libre Franklin SemiBold's advance for each character either line may hold, in
 * thousandths of an em. The SAME table as P02's, because it is the same file at
 * the same weight. See the box above.
 */
export const P09_ADVANCE_MIRROR: Readonly<Record<string, number>> = P02_ADVANCE_MIRROR

/* The template's own numbers, mirrored. Pinned against `P09_TYPE` by the web test. */
export const P09_FONT_WEIGHT_MIRROR = 600
export const P09_LABEL_FONT_SIZE_MIRROR = 15
export const P09_LABEL_LETTER_SPACING_MIRROR = 3.8
export const P09_QUESTION_FONT_SIZE_MIRROR = 54
/** The pack sets no tracking on the question. */
export const P09_QUESTION_LETTER_SPACING_MIRROR = 0
/** 760 px of card less 44 px of padding and 1 px of border each side. The label's measure. See `p09Type.ts`. */
export const P09_CONTENT_WIDTH_MIRROR = 670
/** The pack's `maxWidth: 650` on the question, narrower than the content box, so it binds. */
export const P09_QUESTION_MEASURE_MIRROR = 650

/**
 * THREE LINES FOR THE QUESTION, AND NO MORE.
 *
 * The pack calls the card "compact" and says "the card is not a subtitle
 * container", and its own fixture draws two lines. The card is pinned by its top
 * at y 335, so every question line grows it 58.3 px DOWNWARD. With a label and
 * three lines it ends near y 645, which still leaves the lower two fifths of the
 * photograph clear and stays inside the chooser's subject gate. A fourth line
 * would take it past y 700 and turn a compact card into a panel of text.
 */
export const P09_QUESTION_MAX_LINES = 3

type Setting = {
  readonly sizePx: number
  readonly trackingPx: number
}

const LABEL: Setting = { sizePx: P09_LABEL_FONT_SIZE_MIRROR, trackingPx: P09_LABEL_LETTER_SPACING_MIRROR }
const QUESTION: Setting = {
  sizePx: P09_QUESTION_FONT_SIZE_MIRROR,
  trackingPx: P09_QUESTION_LETTER_SPACING_MIRROR,
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
    const advance = P09_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (thousandths / 1000) * setting.sizePx + characters * setting.trackingPx
}

/**
 * How many lines the question draws on, `Infinity` when one word alone is wider
 * than the measure, or null when it holds an unmeasured character.
 *
 * ##########################################################################
 * # A GREEDY FILL ON SPACES, WHICH IS WHAT CHROME'S LINE BREAKER DOES WITH #
 * # ORDINARY TEXT. Drawn as written, so no case folding, and the question  #
 * # mark is measured as part of the last word it is attached to. A space   #
 * # between two words costs its own advance; the space a line breaks on   #
 * # hangs and costs nothing.                                               #
 * #                                                                        #
 * # CHROME MAY ALSO BREAK AFTER A HYPHEN, AND THIS DOES NOT. Fewer break   #
 * # opportunities can only predict MORE lines, never fewer, so ignoring    #
 * # the hyphen errs towards refusing.                                      #
 * #                                                                        #
 * # A WORD WIDER THAN THE MEASURE IS `Infinity`. Nothing in the component  #
 * # sets `overflow-wrap`, so Chrome does not break inside a word; the word #
 * # runs out past the 650 px measure. That is a clip, not a wrap.          #
 * ##########################################################################
 */
export function p09QuestionLineCount(line: string): number | null {
  const words = line.trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return 0
  const space = runWidth(' ', QUESTION)
  if (space === null) return null

  let lines = 1
  let used = 0
  for (const word of words) {
    const width = runWidth(word, QUESTION)
    if (width === null) return null
    if (width > P09_QUESTION_MEASURE_MIRROR) return Number.POSITIVE_INFINITY
    if (used === 0) {
      used = width
      continue
    }
    if (used + space + width <= P09_QUESTION_MEASURE_MIRROR) {
      used += space + width
      continue
    }
    lines += 1
    used = width
  }
  return lines
}

/** Does the question draw on at most three lines of the card? An unmeasured character does not. */
export function p09QuestionFits(line: string): boolean {
  const lines = p09QuestionLineCount(line)
  return lines !== null && lines >= 1 && lines <= P09_QUESTION_MAX_LINES
}

/**
 * How wide the section label draws on ONE line, upper-cased, or null when it
 * holds an unmeasured character. Whitespace runs count as one space, which is
 * how the line is laid out. Upper-cased first, so ß is measured as the SS it
 * draws.
 */
export function p09LabelWidth(line: string): number | null {
  const words = line.toUpperCase().trim().split(/\s+/).filter((word) => word.length > 0)
  return runWidth(words.join(' '), LABEL)
}

/**
 * Does the section label draw on ONE line of the card?
 *
 * ONE, BECAUSE IT IS THE SMALL LINE OVER A QUESTION. A label that wraps is no
 * longer small and pushes the question down, so the chooser leaves it off the
 * frame rather than let it grow the card.
 */
export function p09LabelFits(line: string): boolean {
  const width = p09LabelWidth(line)
  return width !== null && width > 0 && width <= P09_CONTENT_WIDTH_MIRROR
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
 * # tmp/v53/templates/P09/measure-p09-caps.mts. A P09 question always     #
 * # ends in a question mark, so every run was measured with one appended   #
 * # and the count below includes it.                                       #
 * #                                                                        #
 * #   QUESTION, 51, ITS QUESTION MARK INCLUDED. Every run up to 51         #
 * #   characters draws on three lines or fewer. The first four-line one    #
 * #   arrives at 52, "Puech noted the grammar is already-accomplished      #
 * #   The?". No word of the script is wider than the 650 px measure on its #
 * #   own, not even "already-accomplished", so unlike P02 no word limit is #
 * #   needed. At 68 four runs in ten are refused, and from 81 every one is. #
 * #                                                                        #
 * #   LABEL, 48. Every run up to 48 characters draws on one line, the      #
 * #   widest "cosmology noted something that most commentators" at 669.3   #
 * #   px of 670. At 49 the first are refused, "chapter twenty-two         #
 * #   cosmology noted something that" at 678.0 px, and from 55 every run   #
 * #   is.                                                                  #
 * #                                                                        #
 * #   THE SCRIPT ASKS ONE QUESTION, "Do the dead remember us?", and it     #
 * #   draws on two lines, as the pack's own "What changed beneath the      #
 * #   surface?" does.                                                      #
 * #                                                                        #
 * # THE SCHEMA BOUNDS STAY ABOVE THESE. `P09_QUESTION_MAX_CHARS` is also   #
 * # where `visualPlan.ts` cuts a sheet's headline, and a cut question is a #
 * # different claim, so a fit measurement does not belong there. These    #
 * # move only what the planner is ASKED for, and `anthropic-visual-plan.ts`#
 * # interpolates them so the prompt and the gates cannot drift apart.      #
 * ##########################################################################
 */
export const P09_QUESTION_PROMPT_CHARS = 51
export const P09_LABEL_PROMPT_CHARS = 48
