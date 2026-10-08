import { z } from 'zod'
import { DEVICE_REGISTRY, PLACED_BY_OPERATOR_ONLY, SceneDeviceSchema } from './devices.js'
import type { SceneDevice } from './devices.js'
import { FRAME_WIDTH } from './schemas.js'

/**
 * A DEVICE AN OPERATOR PUTS ON A BEAT BY HAND, AND THE CHECK IT MUST PASS.
 *
 * ##########################################################################
 * # WHY THIS EXISTS. Two devices the client wants on screen carry words a  #
 * # person writes. He ruled that a2, the highlighted page, is MANDATORY in #
 * # every video and carries "a natural surrounding passage that provides   #
 * # context". And on 2026-09-11 he approved two a3 chapter headings in     #
 * # writing. Nothing inside `chooseDevices` may write words or take a      #
 * # heading on trust, so a person places each one and this file decides    #
 * # whether it may reach a frame.                                          #
 * #                                                                        #
 * # ONLY `PLACED_BY_OPERATOR_ONLY` DEVICES MAY COME THROUGH HERE. Every    #
 * # other device has a chooser with seventeen gates, and a hand placement  #
 * # of one of those would walk past all of them.                           #
 * #                                                                        #
 * # IT CHECKS WHAT A WRONG FRAME LOOKS LIKE, NOT TASTE. A phrase that is   #
 * # not in its paragraph draws no mark. A page longer than its shot cuts a #
 * # wipe off mid-sweep. A beat with no picture draws nothing at all, and a #
 * # highlight nobody says in that shot is the "does not match anything     #
 * # being said around that moment" complaint the client made on 08-18. A   #
 * # title wider than the frame at the peak of its zoom runs off both       #
 * # edges, a line break draws a second row its clock was never fitted for, #
 * # and a shot shorter than its build cuts the title off before the last   #
 * # letter lands. A beat whose next shot holds its photograph is refused   #
 * # for either device, exactly as G7 refuses it for the chooser. Whether   #
 * # the words read well is the operator's job, and the plan's T-5 check    #
 * # still refuses an institution name on screen.                           #
 * ##########################################################################
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS: the compositor imports four subpaths
 * of this package, and a subpath here would fold this file into `bundleHash`.
 * a3's advance table lives here rather than in `devices.ts` for the same
 * reason: only the hand path reads it, and `devices.ts` is one of those four.
 */

/**
 * a2's clock, MIRRORED from `highlightPageClock.ts`: 13 frames per highlighted
 * word, chained, then a 48-frame hold. `packages/core` cannot import from
 * `apps/web`, so an `apps/web` test pins these two numbers against the clock.
 */
export const HIGHLIGHT_PAGE_FRAMES_PER_WORD_MIRROR = 13
export const HIGHLIGHT_PAGE_HOLD_FRAMES_MIRROR = 48

/** Whitespace words, the same count `highlightPageWordCount` makes. */
export function highlightPageWords(phrases: readonly string[]): number {
  return phrases.reduce(
    (total, phrase) => total + phrase.trim().split(/\s+/).filter((word) => word.length > 0).length,
    0,
  )
}

/** How many frames a page with these highlights needs, under the adopted per-word law. */
export function highlightPageFramesFor(phrases: readonly string[]): number {
  return HIGHLIGHT_PAGE_FRAMES_PER_WORD_MIRROR * highlightPageWords(phrases) + HIGHLIGHT_PAGE_HOLD_FRAMES_MIRROR
}

/** Three words is the shortest page: 87 frames. Fewer is a flicker, not a page. */
export const HIGHLIGHT_PAGE_MIN_WORDS = 3

/**
 * Three lines per paragraph at most, so nine in all, which ends at 982 of 1080
 * screen pixels once the zoom lands. His reference runs 114 to 144 characters,
 * two lines each.
 */
export const HIGHLIGHT_PAGE_PARAGRAPH_MAX_CHARS = 150

/** His widest phrase is 35 characters. A mark never wraps, so a long one runs off the column. */
export const HIGHLIGHT_PAGE_PHRASE_MAX_CHARS = 40

/**
 * a3's type, MIRRORED so a hand-placed heading is MEASURED rather than counted.
 *
 * ##########################################################################
 * # A COUNT OF CHARACTERS CANNOT SEE HOW WIDE THEY ARE, AND ON THIS PATH   #
 * # IT LET A TITLE RUN OFF BOTH EDGES OF THE FRAME AT EXIT 0.              #
 * #                                                                        #
 * # `CHAPTER_TITLE_MAX_CHARS` is 20, measured on sentence-case dossier     #
 * # headings at about 88 px a character. Its own box says capitals can     #
 * # still clip, and it leans on the research prompt asking for sentence    #
 * # case. A heading an operator types never passes through that prompt,    #
 * # and both headings he approved are Title Case. "THE MEMORY PASSAGES"    #
 * # and "Memory and Mourning" are 19 characters each, and at the peak of   #
 * # the zoom they are 2075 and 1962 px wide against a 1920 px frame.       #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES. `ChapterTitle.tsx` sets every      #
 * # character in its own inline-block, so nothing kerns and the line is    #
 * # exactly the sum. CHECKED AGAINST A RENDER: these advances, less the    #
 * # first letter's left bearing and the last letter's right one, put forty #
 * # lower-case i at rest at 1512.1 px of ink, and the rendered table on    #
 * # `CHAPTER_TITLE_MAX_CHARS` measured 1512. The check uses the whole      #
 * # advance box, a few pixels wider than the ink, so it errs towards       #
 * # refusing.                                                              #
 * #                                                                        #
 * # THE FRAME IS THE LIMIT, WITH NO MARGIN. "The Memory Passages" is 1896  #
 * # px at the peak, so the 8% margin the count carries would refuse a      #
 * # heading he approved that fits.                                         #
 * #                                                                        #
 * # RESIDUAL, STATED RATHER THAN HIDDEN. The sum is the advance box, not   #
 * # the ink. J and j reach up to 14 px left of theirs at the peak and f up #
 * # to 8 px right, so a heading that starts with J or j, or ends with f,   #
 * # and comes that close to the frame can still lose a sliver of that one  #
 * # letter. Neither approved heading does either.                          #
 * ##########################################################################
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/chapterTitleMirror.test.ts` pins every number below
 * against the inlined face, the clock and the type size, so a change to any of
 * them turns that test red instead of quietly putting this check out of tune.
 */

/**
 * Noto Sans Regular's advance for each character a heading may use, in
 * thousandths of an em (`unitsPerEm` 1000), off the `hmtx` table of the face
 * `bodyFaceData.ts` inlines. Printable ASCII, the curly quotes and the two
 * dashes.
 *
 * Anything else is refused. Some of it is in the face and simply not copied
 * here, and the rest would draw in whatever face the browser falls back to, at
 * a width nothing here knows.
 */
export const CHAPTER_TITLE_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 260, '!': 269, '"': 408, '#': 646, '$': 572, '%': 831, '&': 732, "'": 225,
  '(': 300, ')': 300, '*': 551, '+': 572, ',': 268, '-': 322, '.': 268, '/': 372,
  '0': 572, '1': 572, '2': 572, '3': 572, '4': 572, '5': 572, '6': 572, '7': 572, '8': 572, '9': 572,
  ':': 268, ';': 268, '<': 572, '=': 572, '>': 572, '?': 434, '@': 899,
  A: 639, B: 650, C: 632, D: 730, E: 556, F: 519, G: 728, H: 741, I: 339,
  J: 273, K: 619, L: 524, M: 907, N: 760, O: 781, P: 605, Q: 781, R: 622,
  S: 549, T: 556, U: 731, V: 600, W: 930, X: 586, Y: 566, Z: 572,
  '[': 329, '\\': 372, ']': 329, '^': 572, _: 444, '`': 281,
  a: 561, b: 615, c: 480, d: 615, e: 564, f: 344, g: 615, h: 618, i: 258,
  j: 258, k: 534, l: 258, m: 935, n: 618, o: 605, p: 615, q: 615, r: 413,
  s: 479, t: 361, u: 618, v: 508, w: 786, x: 529, y: 510, z: 470,
  '{': 380, '|': 551, '}': 380, '~': 572,
  '‘': 175, '’': 175, '“': 359, '”': 359, '–': 500, '—': 1000,
}

/** `ChapterTitle.tsx`'s font size: `CHAPTER_TITLE_TYPE.capHeightBaseUnits / BODY_FACE_CAP_OVER_EM`. */
export const CHAPTER_TITLE_FONT_SIZE_MIRROR = 92.36 / 0.714

/**
 * The widest a3 is ever drawn: `CHAPTER_TITLE_BASE_SCALE` times the peak of
 * `CHAPTER_TITLE_ZOOM`, which it holds from frame 68 to 82. Every shot a3 may
 * sit on is at least its 120-frame build, so the peak is always on screen.
 */
export const CHAPTER_TITLE_PEAK_SCALE_MIRROR = 1.15 * 1.209991

/**
 * How wide a heading draws at the peak of a3's zoom, in screen pixels, or null
 * when it holds a character `CHAPTER_TITLE_ADVANCE_MIRROR` does not name.
 */
export function chapterTitlePeakWidth(caption: string): number | null {
  let thousandths = 0
  for (const character of caption) {
    const advance = CHAPTER_TITLE_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
  }
  return (thousandths / 1000) * CHAPTER_TITLE_FONT_SIZE_MIRROR * CHAPTER_TITLE_PEAK_SCALE_MIRROR
}

/**
 * THE MOST ENTRIES AN `operator-placements` FILE MAY CARRY.
 *
 * ##########################################################################
 * # DERIVED FROM THE REGISTRY, NEVER TYPED. It is every hand-placed        #
 * # device's per-film cap added together: a3's 2 and a2's 6, so 8.         #
 * #                                                                        #
 * # IT USED TO BE A SECOND HAND-TYPED NUMBER, 4, AND IT FELL BEHIND THE     #
 * # CAPS THE MOMENT a2 NEEDED MORE THAN ONE EARLY PAGE. The next film's     #
 * # file holds five entries, and `.max(4)` on the schema made the fifth     #
 * # one fail the WHOLE file. runPlan then placed nothing by hand, both      #
 * # approved headings and the 7:50 page included, and said so in one warn  #
 * # line. A sum of the caps cannot fall behind a cap.                       #
 * #                                                                        #
 * # IT IS NOT IN THE SCHEMA ANY MORE, AND IT COUNTS ENTRIES THAT LANDED.   #
 * # Once this many have landed, `applyOperatorPlacements` in plan.ts       #
 * # refuses every further entry by name, so one entry too many costs that  #
 * # entry and nothing else. A refused entry never uses up a place. Places  #
 * # in the file were counted once, and one early refusal then cost the     #
 * # second approved heading while a3 still had room for it. A hand-placed  #
 * # device with no cap makes the file limitless, which is what "no cap"    #
 * # says.                                                                  #
 * ##########################################################################
 *
 * `specs` is a parameter only so a test can hand it a device with no cap. Every
 * caller takes the default, which reads the registry.
 */
export function operatorPlacementsLimit(
  specs: readonly { readonly maxPerFilm: number | null }[] = [...PLACED_BY_OPERATOR_ONLY].map(
    (id) => DEVICE_REGISTRY[id],
  ),
): number {
  let total = 0
  for (const spec of specs) {
    if (spec.maxPerFilm === null) return Number.POSITIVE_INFINITY
    total += spec.maxPerFilm
  }
  return total
}

export const OPERATOR_PLACEMENTS_MAX: number = operatorPlacementsLimit()

/**
 * One entry of the file. STRICT, so a key it does not know refuses the file
 * rather than vanish. See the box on `OperatorPlacementsSchema`.
 */
export const OperatorPlacementSchema = z.strictObject({
  beatIndex: z.number().int().min(0),
  device: SceneDeviceSchema,
  /** Why a person put it here. Written to the job log, never drawn. */
  note: z.string().max(400).default(''),
})

export type OperatorPlacement = z.infer<typeof OperatorPlacementSchema>

/**
 * The `operator-placements` artifact, as a person writes it.
 *
 * NO LENGTH LIMIT, ON PURPOSE. See `OPERATOR_PLACEMENTS_MAX`: a `.max()` here
 * refused the whole file for one entry too many. What this still refuses is a
 * file of the wrong shape, an entry with no beat, a device that does not parse
 * (a phrase missing from its own paragraph among them), a note over 400
 * characters and a key it does not know, and runPlan STOPS THE PLAN on any of
 * those rather than build the film without the placements the file names.
 *
 * ##########################################################################
 * # STRICT AT THE FILE AND AT EACH ENTRY. zod drops an unknown key by      #
 * # default, so {"placements":[],"stopOnRefusal":true} read as a file of   #
 * # no entries, and "notes" typed for "note" read as an entry with no      #
 * # note, both without a word. A person who types a key means something    #
 * # by it, so the file is refused and the job log names the key.           #
 * #                                                                        #
 * # THE DEVICE KEEPS zod's DEFAULT. `SceneDeviceSchema` is what every      #
 * # frozen plan parses through, and it sits in the compositor bundle, so   #
 * # it is not made strict for this file. It does not need to be: every     #
 * # key a hand-placed device reads is required, so a misspelt one fails as #
 * # missing, and an extra one is dropped and draws nothing.                #
 * #                                                                        #
 * # Every operator file on the developer's laptop on 2026-09-12 parses     #
 * # under this: tmp/v49, the two tmp/v51 files and both copies of V52's.   #
 * ##########################################################################
 */
export const OperatorPlacementsSchema = z.strictObject({
  placements: z.array(OperatorPlacementSchema),
})

/** What the check needs to know about the beat a placement names. */
export type OperatorBeat = {
  readonly index: number
  readonly durationFrames: number
  /** The beat's own narration, as the segmenter cut it. */
  readonly text: string
  readonly hasOwnAsset: boolean
  /** The opening gallery's carrier, or null when the film has none. */
  readonly openingCarrierIndex: number | null
  /** Does the next beat draw this beat's photograph? G7's question. See `DeviceBeat.nextHoldsThisPicture`. */
  readonly nextHoldsThisPicture: boolean
}

export type OperatorCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string }

const PASS: OperatorCheck = { ok: true }

function refused(reason: string): OperatorCheck {
  return { ok: false, reason }
}

/** Lower-cased word tokens, with curly apostrophes folded to straight ones. */
function tokens(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .map((token) => token.replace(/^'+|'+$/g, ''))
    .filter((token) => token.length > 0)
}

/** Is `phrase` said in `text` as an unbroken run of whole words? */
function saysAsWords(text: string, phrase: string): boolean {
  const said = tokens(text)
  const wanted = tokens(phrase)
  if (wanted.length === 0) return false
  for (let start = 0; start + wanted.length <= said.length; start += 1) {
    if (wanted.every((word, offset) => said[start + offset] === word)) return true
  }
  return false
}

/**
 * How many times `phrase` occurs in `paragraph` with no letter or digit
 * touching either end. The component marks the FIRST `indexOf` hit, so a
 * phrase that also occurs inside a longer word, or twice, marks the wrong one.
 */
function wholeOccurrences(paragraph: string, phrase: string): number {
  if (phrase.length === 0) return 0
  const touching = /[\p{L}\p{N}]/u
  let count = 0
  for (let at = paragraph.indexOf(phrase); at >= 0; at = paragraph.indexOf(phrase, at + 1)) {
    const before = at === 0 ? '' : (paragraph[at - 1] ?? '')
    const after = paragraph[at + phrase.length] ?? ''
    if (!touching.test(before) && !touching.test(after)) count += 1
  }
  return count
}

function checkHighlightPage(
  page: Extract<SceneDevice, { id: 'highlight-page' }>,
  beat: OperatorBeat,
): OperatorCheck {
  for (let index = 0; index < 3; index += 1) {
    const paragraph = page.paragraphs[index] ?? ''
    const phrase = page.phrases[index] ?? ''
    if (paragraph.length > HIGHLIGHT_PAGE_PARAGRAPH_MAX_CHARS) {
      return refused(
        `paragraph ${String(index + 1)} is ${String(paragraph.length)} characters, over ` +
          `${String(HIGHLIGHT_PAGE_PARAGRAPH_MAX_CHARS)}, so the page runs past three lines a paragraph`,
      )
    }
    if (phrase.length > HIGHLIGHT_PAGE_PHRASE_MAX_CHARS) {
      return refused(
        `phrase ${String(index + 1)} is ${String(phrase.length)} characters, over ` +
          `${String(HIGHLIGHT_PAGE_PHRASE_MAX_CHARS)}, and a mark never wraps`,
      )
    }
    const hits = wholeOccurrences(paragraph, phrase)
    if (hits !== 1) {
      return refused(
        `phrase ${String(index + 1)} "${phrase}" occurs ${String(hits)} times as whole words in its ` +
          'paragraph, and it must occur exactly once or the wrong words are marked',
      )
    }
  }

  const folded = page.phrases.map((phrase) => tokens(phrase).join(' '))
  if (new Set(folded).size !== folded.length) return refused('two highlighted phrases are the same words')

  const words = highlightPageWords(page.phrases)
  if (words < HIGHLIGHT_PAGE_MIN_WORDS) {
    return refused(`${String(words)} highlighted words, under the ${String(HIGHLIGHT_PAGE_MIN_WORDS)} a page needs`)
  }

  const needed = highlightPageFramesFor(page.phrases)
  if (needed > beat.durationFrames) {
    return refused(
      `${String(words)} highlighted words need ${String(needed)} frames and the beat has ` +
        `${String(beat.durationFrames)}, so the last wipe would be cut off mid-sweep`,
    )
  }

  if (!page.phrases.some((phrase) => saysAsWords(beat.text, phrase))) {
    return refused('no highlighted phrase is spoken in this beat, so the page would highlight words nobody is saying')
  }

  return PASS
}

/**
 * a3 on a beat by hand. The heading is one the client approved in writing, and
 * whether it is the right one is the operator's call. This asks only whether it
 * would draw right.
 *
 * The shot's two limits are READ FROM THE REGISTRY, never retyped. G3 and G4 ask
 * the chooser the same two questions of every beat, and a copy of the numbers
 * here would be a second place for them to drift.
 */
function checkChapterTitle(
  title: Extract<SceneDevice, { id: 'chapter-title' }>,
  beat: OperatorBeat,
): OperatorCheck {
  const { caption } = title
  if (caption.trim().length === 0) {
    return refused('the heading is empty, so the title would draw the grid with no words on it')
  }
  if (caption !== caption.trim()) {
    return refused(
      'the heading starts or ends with whitespace, and the title centres every character it is given, ' +
        'so it would sit off centre',
    )
  }
  /*
   * `ChapterTitle.tsx` sets `whiteSpace: 'pre'`, so a line break is drawn as a
   * second row, which neither the clock nor the measured width was fitted for.
   * Any other control character is that or a glyph nobody can see.
   *
   * The unmeasured-character refusal below would refuse every one of these too,
   * but its reason prints the raw character into a job-log line. So this runs
   * first, and the tests pin each refusal's REASON, which is what lets the two
   * rules be broken and caught on their own.
   */
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(caption)) {
    return refused(
      'the heading holds a line break or a control character, so the title would draw a second row ' +
        'it was never fitted for',
    )
  }
  /*
   * MEASURED, NOT COUNTED. See the box on `CHAPTER_TITLE_ADVANCE_MIRROR`: a count
   * passed capitals and wide Title Case that run off both edges, and refused
   * narrow headings that fit.
   */
  const width = chapterTitlePeakWidth(caption)
  if (width === null) {
    const unmeasured = [...caption].find((character) => CHAPTER_TITLE_ADVANCE_MIRROR[character] === undefined) ?? ''
    return refused(`the heading holds "${unmeasured}", which has no measured width, so nothing can say it fits the frame`)
  }
  if (width > FRAME_WIDTH) {
    return refused(
      `the heading is ${width.toFixed(0)} px wide at the peak of the zoom, over the ${String(FRAME_WIDTH)} px ` +
        'frame, so it would run off both edges',
    )
  }
  const { buildEndFrames, holdsWellFrames } = DEVICE_REGISTRY[title.id]
  if (beat.durationFrames < buildEndFrames) {
    return refused(
      `the beat has ${String(beat.durationFrames)} frames and the title needs ${String(buildEndFrames)} ` +
        'to finish arriving, so the shot would cut it off mid-build',
    )
  }
  if (beat.durationFrames > holdsWellFrames) {
    return refused(
      `the beat has ${String(beat.durationFrames)} frames, over the ${String(holdsWellFrames)} a title ` +
        'holds well, so the finished card would stay up past his usual maximum',
    )
  }
  return PASS
}

/**
 * May this hand placement reach a frame? Pure and deterministic.
 *
 * `beat` must be the beat `placement.beatIndex` names. The caller looks it up,
 * so a placement naming a beat the film does not have is refused there.
 */
export function checkOperatorPlacement(placement: OperatorPlacement, beat: OperatorBeat): OperatorCheck {
  const { device } = placement
  if (!PLACED_BY_OPERATOR_ONLY.has(device.id)) {
    return refused(`${device.id} is chosen by the tool and may not be placed by hand`)
  }
  if (!DEVICE_REGISTRY[device.id].enabled) return refused(`${device.id} is not drawable in this build`)
  if (beat.index !== placement.beatIndex) {
    return refused(`asked for beat ${String(placement.beatIndex)} and was handed beat ${String(beat.index)}`)
  }
  if (beat.index === 0) return refused('the opening beat is never a hand placement')
  if (beat.openingCarrierIndex !== null && beat.index <= beat.openingCarrierIndex) {
    return refused(`beat ${String(beat.index)} is at or before the opening gallery on beat ${String(beat.openingCarrierIndex)}`)
  }
  if (!beat.hasOwnAsset) {
    return refused('the beat owns no picture, and the compositor draws no device on a picture-less beat')
  }
  /*
   * G7, which the chooser asks of every device it places. Neither hand-placed
   * device draws the beat's photograph, so a next shot that holds it opens on a
   * crop and a pose nobody saw, and neither beat credits the picture. See the
   * box on `DeviceBeat.nextHoldsThisPicture`.
   */
  if (beat.nextHoldsThisPicture) {
    return refused(
      "the next beat draws this beat's photograph, which this device never shows, so that shot would open on " +
        'a crop nobody saw and the picture would be credited nowhere',
    )
  }

  switch (device.id) {
    case 'chapter-title':
      return checkChapterTitle(device, beat)
    case 'highlight-page':
      return checkHighlightPage(device, beat)
    default:
      return refused(`no hand-placement check exists for ${device.id}`)
  }
}
