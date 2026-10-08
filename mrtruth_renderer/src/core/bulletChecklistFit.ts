import { SHADOW_UP_ADVANCE_MIRROR } from './shadowUpFit.js'

/**
 * a7's TITLE AND ROWS, MEASURED BEFORE THEY MAY REACH A FRAME.
 *
 * ##########################################################################
 * # THE CLIENT PHOTOGRAPHED THIS DEFECT AND SENT IT, 2026-09-12.           #
 * #                                                                       #
 * #   "still include this kind of animation, and adjust it to the left     #
 * #    to make all the text visible"                                       #
 * #                                                                       #
 * # On V50 the title drew "MEMORY IN THE AFTERLIF" — the final E is off    #
 * # the frame — and the third row drew "What that means fo" and never      #
 * # finished. Neither was clipped by a rule. Nothing anywhere measured how #
 * # wide these strings draw, so both ran past 1920 at exit 0 with nothing  #
 * # red.                                                                   #
 * #                                                                       #
 * # AND THE PANEL IS NOT IN THE WRONG PLACE. Its left edge at x=1040 is    #
 * # measured off his own a7 reference clip to 0.001 px, and the panel      #
 * # bleeding off the RIGHT edge is what his clip does. Reading him         #
 * # literally — moving the overlay left — would shift a sub-pixel-measured #
 * # landmark 236 to 309 px, cover another 12 to 16% of the photograph,     #
 * # stretch the wipe's travel past its tested speed and break four pinned  #
 * # assertions, to fix a COPY problem. Reading him by intent costs this    #
 * # file and a prompt number.                                             #
 * ##########################################################################
 *
 * TWO CAPS, NOT ONE, AND THE SECOND IS THE ONE NOBODY LOOKED FOR.
 *
 * A row also has to FINISH DRAWING. The rows reveal one character at a time on
 * a measured clock, and V50's third row needed local frame 159.7 of a 134-frame
 * shot, so the word "waiting" was never on screen at any point in the film. A
 * width cap alone would have passed it, because its ink stops at x=1759 while
 * the reveal is still in flight. See `bulletChecklistRowDrawsInFull`.
 *
 * WHY A WIDTH AND NOT A CHARACTER COUNT. The same lesson `shadowUpFit.ts` and
 * `operatorPlacement.ts` already paid for. `deviceChoice.ts` caps the title at
 * 32 characters and each row at 48, and the planner prompt repeats those two
 * numbers. Against the real faces, 20 Bebas characters span 443 to 1173 px
 * depending on which letters they are, and 30 Caveat characters span 321 to
 * 1280 px. A count cannot control a width.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `shadowUpFit.ts`. The
 * compositor imports @vg/core/{schemas,devices,frames,motion} and nothing else,
 * so nothing here can move `bundleHash`. Export it from `index.ts` alone.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/bulletChecklistMirror.test.ts` pins every advance against
 * the woff2 bytes, and `bulletChecklistTypeMirror.test.ts` pins the sizes,
 * tracking and origins against the template's own clock.
 */

/* ------------------------------------------------------------------ title -- */

/**
 * The title's face is Bebas Neue — THE SAME FACE 05 DRAWS — so its advances are
 * reused rather than copied.
 *
 * ##########################################################################
 * # SAFE BECAUSE BEBAS IS A CAPS-ONLY FACE. Its lowercase code points map  #
 * # to the capital's glyph, so all 26 lowercase advances equal their       #
 * # uppercase twins and upper-casing before measuring is exact rather than #
 * # approximate. Verified against the woff2 bytes, 26 of 26 identical.     #
 * #                                                                       #
 * # ONLY THE ADVANCES ARE SHARED. The SIZE and the TRACKING are not: 05    #
 * # draws at 104 px with 1.25 px of spacing and a7's title at 100 px with  #
 * # 2.97 px. Reusing 05's width function would be wrong by about 9% and    #
 * # wrong in the passing direction, which is the worse one.                #
 * ##########################################################################
 */
export const BULLET_CHECKLIST_TITLE_SIZE_MIRROR = 100
export const BULLET_CHECKLIST_TITLE_TRACKING_MIRROR = 2.97
/** `BULLET_CHECKLIST_TITLE.originX`, where the pen starts. */
export const BULLET_CHECKLIST_TITLE_ORIGIN_MIRROR = 1096

/**
 * The right-hand limit: THE LAST DRAWABLE COLUMN, not his reference's ink edge.
 *
 * ##########################################################################
 * # 1919 AND NOT 1847, AND THE FIRST ATTEMPT AT THIS FILE GOT IT WRONG IN  #
 * # A WAY HIS OWN CLIP CAUGHT.                                            #
 * #                                                                       #
 * # `BULLET_CHECKLIST_TITLE.inkRight` is 1847, so budgeting to it gives    #
 * # 751 px. But that number is an INK measurement — the last dark pixel of #
 * # his reference — and everything below sums ADVANCES, which is the pen's #
 * # travel including the trailing side bearing. The two are not the same   #
 * # quantity, and comparing them double-counts.                            #
 * #                                                                       #
 * # MEASURED: his own title "BULLET POINT OVERLAY" sums to 759.10 px       #
 * # against a measured ink span of 747. A 751 budget therefore REFUSES THE #
 * # REFERENCE CLIP THE TEMPLATE WAS BUILT FROM. A gate that cannot pass    #
 * # its own reference is measuring the wrong thing, however carefully.     #
 * #                                                                       #
 * # The real constraint is the frame. A title whose ink ends at 1900 is    #
 * # fully visible; it is simply tighter than his clip. His 73 px of slack  #
 * # is a look, and a look cannot be enforced without measuring ink per     #
 * # string, which this file deliberately does not do.                      #
 * ##########################################################################
 */
export const BULLET_CHECKLIST_CONTENT_RIGHT = 1919
export const BULLET_CHECKLIST_TITLE_MAX_WIDTH =
  BULLET_CHECKLIST_CONTENT_RIGHT - BULLET_CHECKLIST_TITLE_ORIGIN_MIRROR

/**
 * How wide the title draws, in screen pixels, or null when it holds a character
 * the mirror does not name.
 *
 * IT OVER-PREDICTS BY ABOUT 12 px AND THAT IS THE DIRECTION TO ERR IN. Summing
 * advances measures the PEN's travel; the clock measures INK, first dark pixel
 * to last, so the trailing side bearing is counted here and not there. a7 also
 * leaves `kerning: 'normal'` on, unlike 05, so Chrome draws the reference
 * slightly tighter than the sum. Measured on his own line: this returns 759.10
 * against a measured ink span of 747. A gate that over-predicts refuses a line
 * that would just have fitted; one that under-predicts ships a clipped frame.
 */
export function bulletChecklistTitleWidth(title: string): number | null {
  let thousandths = 0
  let characters = 0
  for (const character of title.toUpperCase()) {
    const advance = SHADOW_UP_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (
    (thousandths / 1000) * BULLET_CHECKLIST_TITLE_SIZE_MIRROR +
    characters * BULLET_CHECKLIST_TITLE_TRACKING_MIRROR
  )
}

/** Does the title draw inside the panel? A title holding an unmeasured character does not. */
export function bulletChecklistTitleFits(title: string): boolean {
  const width = bulletChecklistTitleWidth(title)
  return width !== null && width <= BULLET_CHECKLIST_TITLE_MAX_WIDTH
}

/* ------------------------------------------------------------------- rows -- */

/**
 * Caveat at weight 700's advance for each character a row may hold, in
 * thousandths of an em (`unitsPerEm` 1000), off the `hmtx` table of the face
 * `scriptFaceData.ts` inlines.
 *
 * BOTH CASES, unlike the title's mirror, because the rows are drawn as written.
 * Read off the bytes by `tmp/caveat-metrics.mts`, never typed from a specimen,
 * and validated against the clock's own measured reference: "Key takeaway #1"
 * sums to 347.97 px against a measured ink span of 347.8.
 */
export const BULLET_CHECKLIST_ROW_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 242, '!': 210, '"': 237, '#': 559, $: 450, '%': 600, '&': 564, "'": 117,
  '(': 330, ')': 330, '*': 363, '+': 446, ',': 198, '-': 326, '.': 198, '/': 330,
  '0': 450, '1': 450, '2': 450, '3': 450, '4': 450, '5': 450, '6': 450, '7': 450, '8': 450, '9': 450,
  ':': 198, ';': 198, '<': 446, '=': 446, '>': 446, '?': 374, '@': 643,
  A: 502, B: 520, C: 472, D: 578, E: 529, F: 454, G: 487, H: 563, I: 400, J: 306, K: 498, L: 426, M: 720,
  N: 599, O: 496, P: 464, Q: 502, R: 537, S: 486, T: 458, U: 482, V: 490, W: 720, X: 524, Y: 504, Z: 522,
  '[': 330, ']': 330, '^': 446, _: 446, '`': 353,
  a: 437, b: 435, c: 355, d: 393, e: 325, f: 291, g: 355, h: 464, i: 187, j: 204, k: 365, l: 169, m: 560,
  n: 450, o: 353, p: 378, q: 377, r: 360, s: 341, t: 331, u: 370, v: 331, w: 517, x: 343, y: 341, z: 315,
  '{': 330, '|': 330, '}': 330, '~': 446,
  '‘': 117, '’': 117, '“': 267, '”': 267, '–': 446, '—': 566, '…': 594,
}

export const BULLET_CHECKLIST_ROW_SIZE_MIRROR = 59
/** `BULLET_CHECKLIST_ROWS.chromeTrackingPx`. Chrome's own, not a value the component sets. */
export const BULLET_CHECKLIST_ROW_TRACKING_MIRROR = 0.2
/** `BULLET_CHECKLIST_ROWS.penX`. The ink starts 4 px later, which is the face's left side bearing. */
export const BULLET_CHECKLIST_ROW_PEN_MIRROR = 1346
export const BULLET_CHECKLIST_ROW_MAX_WIDTH =
  BULLET_CHECKLIST_CONTENT_RIGHT - BULLET_CHECKLIST_ROW_PEN_MIRROR

/** How wide a row draws, in screen pixels, or null when it holds an unmeasured character. */
export function bulletChecklistRowWidth(row: string): number | null {
  let thousandths = 0
  let characters = 0
  for (const character of row) {
    const advance = BULLET_CHECKLIST_ROW_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (
    (thousandths / 1000) * BULLET_CHECKLIST_ROW_SIZE_MIRROR +
    characters * BULLET_CHECKLIST_ROW_TRACKING_MIRROR
  )
}

/** Does this row draw inside the panel? */
export function bulletChecklistRowFits(row: string): boolean {
  const width = bulletChecklistRowWidth(row)
  return width !== null && width <= BULLET_CHECKLIST_ROW_MAX_WIDTH
}

/* ----------------------------------------------------------- the clock cap -- */

/**
 * `BULLET_CHECKLIST_ROW_REVEAL`, mirrored. The three rows start at these local
 * frames and then uncover one character every `CHAR_STAGGER` frames, each
 * fading in over `CHAR_FADE`.
 *
 * A SPACE TAKES A SLOT, which is `spaceTakesSlot: true` in the clock. A row of
 * three short words therefore costs the same time as one long one of the same
 * length, and "What that means for the people waiting" spends five of its
 * thirty-eight slots on spaces.
 */
export const BULLET_CHECKLIST_ROW_ONSETS: readonly number[] = [33, 45, 57]
export const BULLET_CHECKLIST_CHAR_STAGGER = 2.46429
export const BULLET_CHECKLIST_CHAR_FADE = 11.5

/**
 * The local frame at which a row's LAST character reaches full opacity.
 *
 * ##########################################################################
 * # THE CAP V50 FAILED, AND IT IS NOT A WIDTH.                             #
 * #                                                                       #
 * # "What that means for the people waiting" is 38 slots. Its last one     #
 * # lands at 57 + 2.46429 * 37 + 11.5 = 159.68, on a shot 134 frames long. #
 * # The word "waiting" was never drawn at any point in the delivered film. #
 * #                                                                       #
 * # The client screenshotted this row and it LOOKED clipped by the frame.  #
 * # It was not. Its ink stops at x=1759, well inside 1920; what he caught  #
 * # was the reveal still in flight at 1:02. Both faults are real and they  #
 * # are different faults, so a width gate alone would have fixed the wrong #
 * # one and left the word missing.                                         #
 * ##########################################################################
 */
export function bulletChecklistRowLastFrame(row: string, rowIndex: number): number | null {
  const onset = BULLET_CHECKLIST_ROW_ONSETS[rowIndex]
  if (onset === undefined || row.length === 0) return null
  return onset + BULLET_CHECKLIST_CHAR_STAGGER * (row.length - 1) + BULLET_CHECKLIST_CHAR_FADE
}

/**
 * Does this row finish drawing inside the shot it is given?
 *
 * `durationFrames` IS THE SHOT, NOT THE TEMPLATE'S BUILD. The registry's
 * `buildEndFrames` of 119 is the floor a beat must clear to carry the device at
 * all; a beat may be longer, and V50's was 134. The row has to land inside the
 * SHOT, so the shot's own length is what it is measured against.
 */
export function bulletChecklistRowDrawsInFull(
  row: string,
  rowIndex: number,
  durationFrames: number,
): boolean {
  const last = bulletChecklistRowLastFrame(row, rowIndex)
  return last !== null && last <= durationFrames - 1
}

/* ------------------------------------------------------- the prompt caps -- */

/**
 * The character counts the PLANNER PROMPT asks for, which are not the counts
 * the chooser truncates to.
 *
 * ##########################################################################
 * # THE PROMPT SAID 32 AND 48. THE GATES ABOVE LET 19 AND 21 THROUGH.      #
 * #                                                                       #
 * # Prompt v15 told the planner "headline is the title, at most 32; each  #
 * # row in lines at most 48". Both numbers are the coarse schema bounds,   #
 * # and both are far past what this file refuses. A title of 23 real      #
 * # characters ("Memory in the afterlife") is 868 px of an 823 px panel,  #
 * # and a third row of 38 ("What that means for the people waiting") was  #
 * # still being written when V50's shot ended. The planner obeyed the     #
 * # numbers it was given and the film refused the copy.                   #
 * #                                                                       #
 * # MEASURED, NOT ESTIMATED, on job 99414763's own script (ingest.json    #
 * # `scriptText`, 8,742 characters, 1,404 words once edge punctuation is  #
 * # stripped): every run of consecutive whole words, 9,534 distinct runs  #
 * # up to 48 characters, put through the real gates by                   #
 * # tmp/v53/templates/measure-prompt-caps-detail.mts.                      #
 * #                                                                       #
 * #   TITLE, 19. Every one of the 217 runs of 19 characters fits. The     #
 * #   widest is "whose landmark 2001" at 793.03 px of 823. At 20, five of #
 * #   242 are refused, the widest "twenty-two cosmology" at 843.60. At    #
 * #   21 it is 50 of 224. Bebas is narrow but not uniform, so the first   #
 * #   refusal arrives the moment a count allows two wide words.           #
 * #                                                                       #
 * #   ROWS, 21, AND IT IS THE CLOCK, NOT THE WIDTH. The third row starts  #
 * #   at local frame 57 and the shortest shot that may carry the device   #
 * #   is the registry's `buildEndFrames`, 119. 21 slots land the last     #
 * #   character at 57 + 2.46429 x 20 + 11.5 = 117.79, inside frame 118;  #
 * #   22 land it at 120.25, past the end of the shot. The width is looser: #
 * #   every run of this script up to 24 characters fits the 573 px row    #
 * #   (widest "Qumran Aramaic fragments", 562.4 px) and the first width    #
 * #   refusal is at 25. One number is asked for every row, so it is the   #
 * #   third row's, on the shortest shot.                                  #
 * #                                                                       #
 * # A COUNT STILL CANNOT MEASURE A CHARACTER THE MIRROR DOES NOT HOLD.     #
 * # Four words of this script, Émile, École, Józef and Schøyen, carry a   #
 * # letter the row mirror has no advance for, so a row holding one is     #
 * # refused at any length. The title mirror strips the accent and passes. #
 * #                                                                       #
 * # THE 32 AND THE 48 STAY WHERE THEY TRUNCATE. `TEMPLATE_HEADLINE_CHARS` #
 * # and the row trim in `visualPlan.ts`, and the 32 and 48 in the chooser #
 * # arm, cut a line at a word. Lowering them to these numbers would cut    #
 * # real lines short instead of letting the gates refuse them, and a cut   #
 * # line is a different claim. These two constants move only what the     #
 * # planner is ASKED for.                                                  #
 * #                                                                       #
 * # `bulletChecklistFit.test.ts` pins both against the real gates, and     #
 * # `anthropic-visual-plan.ts` interpolates them, so the prompt and the    #
 * # gate cannot drift apart silently.                                      #
 * ##########################################################################
 */
export const BULLET_CHECKLIST_TITLE_PROMPT_CHARS = 19
export const BULLET_CHECKLIST_ROW_PROMPT_CHARS = 21

/* ------------------------------------------------------------- both at once -- */

/**
 * Everything a7's copy must satisfy, in one call, so a caller cannot check the
 * width and forget the clock — which is the mistake the client's screenshot
 * made look like one fault.
 *
 * REFUSES, NEVER TRUNCATES. The arm this feeds in `deviceChoice.ts` already
 * states that rule for unspoken rows, and a truncated row is how V50 drew
 * "Not sleep or" on another device.
 */
export function bulletChecklistCopyFits(
  title: string,
  rows: readonly string[],
  durationFrames: number,
): boolean {
  if (!bulletChecklistTitleFits(title)) return false
  return rows.every(
    (row, index) =>
      bulletChecklistRowFits(row) && bulletChecklistRowDrawsInFull(row, index, durationFrames),
  )
}
