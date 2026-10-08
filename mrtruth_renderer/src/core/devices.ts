import { z } from 'zod'

/**
 * THE TWENTY-THREE DRAWABLE DEVICES, AND THE RULES FOR REACHING FOR ONE.
 *
 * ##########################################################################
 * # THIS FILE IS THE ONLY PLACE THAT KNOWS A DEVICE EXISTS. Until it       #
 * # landed, `packages/core` contained no occurrence of the word at all and #
 * # every one of the sixteen was unreachable from a delivered film.        #
 * #                                                                        #
 * # ONE REGISTRY, NOT TWO, and the reason is not tidiness. P17 SUPERSEDES  #
 * # a1 `pointer-label` by the client's own written instruction. Two        #
 * # registries cannot express that edge and would let a chooser offer both #
 * # for the same beat. The client's absolute caps ("used MAX 1 time") and  #
 * # the partner's variety window are the same kind of constraint over the  #
 * # same film, so they belong in one table with one scheduler. Provenance  #
 * # genuinely differs, so it is a FIELD (`origin`) rather than a split.    #
 * ##########################################################################
 *
 * ZOD AND NOTHING ELSE IS IMPORTED HERE, deliberately. This module is read by
 * the worker (which plans) AND by the compositor bundle (which draws), and
 * `apps/web` and `apps/worker` share exactly one workspace dependency, which is
 * this package. Importing `schemas.ts` from here would also make the dependency
 * cyclic the moment `schemas.ts` imports this file, which it does.
 */

/* ------------------------------------------------------------------------- */
/* Bounded copy                                                                */
/* ------------------------------------------------------------------------- */

/**
 * The same resource-locator refusal `modelText` applies in `schemas.ts`, copied
 * rather than imported.
 *
 * ##########################################################################
 * # THE DUPLICATION IS THE PRICE OF THE ACYCLIC IMPORT ABOVE, and it is    #
 * # cheap because the pattern is pinned by a test in `schemas.test.ts` and #
 * # by one here. What it buys: a device slot is a string that reaches a    #
 * # FRAME, so `../../.env` or `https://evil/x.png` must be refused at the  #
 * # boundary exactly as it is for every other model-written field.         #
 * ##########################################################################
 */
const RESOURCE_LOCATOR_PATTERN =
  /(?:[a-z][a-z0-9+.-]*:\/\/|\bdata:|\bfile:|\.\.[/\\]|\\|\/\/|\/[\w.-]+\/|\.(?:png|jpe?g|webp|gif|svg|bmp|tiff?|mp4|mov|webm|mkv|mp3|wav|flac|cube|3dl|lut|json|ya?ml|env|js|mjs|cjs|ts|sh|bat|ps1|exe)\b)/i

/**
 * A numeric calendar date, which is the one slash-separated thing narration
 * legitimately says out loud. Kept beside the pattern above and duplicated into
 * `schemas.ts` for the same acyclic-import reason.
 *
 * ##########################################################################
 * # `12/01/1989` WAS REFUSED AS A FILE PATH AND IT BLOCKED A WHOLE FILM.   #
 * #                                                                        #
 * # The `\/[\w.-]+\/` arm above exists to catch `/assets/`, and it cannot  #
 * # tell that from the `/01/` inside a date. Measured on the Skagit job    #
 * # (`b847f7b4`), whose beat 0 reads "On the morning of 12/01/1989, a      #
 * # hook": every legal split of that narration carries the date, so no     #
 * # opening title could ever draw and T-11 failed whatever the picture     #
 * # was. A date is an ordinary thing to put in a title.                    #
 * #                                                                        #
 * # STRIP THEN TEST, RATHER THAN AN EXEMPTION. The date is removed from a  #
 * # COPY and the untouched locator rule runs on what is left, so nothing   #
 * # is weakened: `/assets/12/01/1989/x.png` still collapses to             #
 * # `/assets//x.png`, which the `\/\/` arm refuses. An exemption that      #
 * # said "allow the string if it looks like a date" would instead hand     #
 * # every path with two numbers in it a way through.                       #
 * #                                                                        #
 * # REPLACED WITH '' AND NOT WITH A SPACE, deliberately. A space would     #
 * # turn `a/12/01/1989/b` into `a/ /b`, which matches nothing and passes.  #
 * # The empty string leaves `a//b`, which does not.                        #
 * #                                                                        #
 * # BOTH ORDERS, because the day may lead. Each of the first two fields    #
 * # is bounded at 31 rather than left as `\d{1,2}`, so this admits dates   #
 * # and not arbitrary number pairs.                                        #
 * ##########################################################################
 */
const NUMERIC_DATE_PATTERN = /\b(?:[12]\d|3[01]|0?[1-9])\/(?:[12]\d|3[01]|0?[1-9])\/(?:\d{4}|\d{2})\b/g

/** The string as the locator rule should judge it, with any date taken out. */
export function withoutNumericDates(value: string): string {
  return value.replace(NUMERIC_DATE_PATTERN, '')
}

/** A bounded, locator-free string that is allowed to reach a frame. */
export function deviceText(max: number): z.ZodType<string> {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => !RESOURCE_LOCATOR_PATTERN.test(withoutNumericDates(value)),
      'device text may not contain a URL, path, filename or LUT reference',
    )
}

/* ------------------------------------------------------------------------- */
/* Identity                                                                    */
/* ------------------------------------------------------------------------- */

export const DEVICE_IDS = [
  /* The client's nine, by the name the clip harness already uses. */
  'framed-card',
  'pointer-label',
  'photo-pop',
  'two-photo-zoom',
  'chapter-title',
  'name-card',
  'gallery-strip',
  'highlight-page',
  'bullet-checklist',
  /* The partner's seven, by his own registry id. */
  'P03',
  'P12',
  'P13',
  'P16',
  'P17',
  'P19',
  'P22',
  /*
   * Saku's reference library, by what the template does. APPENDED, because the
   * competition loop and the fallback seeds both walk this list in order, so an
   * id added at the end moves no existing tie-break.
   */
  'shadow-up',
  /*
   * The accepted P-pack's P08, by its own registry id, as P12 and the other
   * partner templates are. APPENDED, for the reason above: no existing
   * tie-break or fallback seed moves.
   */
  'P08',
  /*
   * The accepted P-pack's P04, the lower-left label. APPENDED after P08 for the
   * same reason: no existing tie-break or fallback seed moves.
   */
  'P04',
  /*
   * The accepted P-pack's P02, the editorial card. APPENDED after P04 for the
   * same reason: no existing tie-break or fallback seed moves.
   */
  'P02',
  /*
   * The accepted P-pack's P09, the compact question card. APPENDED after P02 for
   * the same reason: no existing tie-break or fallback seed moves.
   */
  'P09',
  /*
   * The accepted P-pack's P05, text left and a picture right. APPENDED after P09
   * for the same reason: no existing tie-break or fallback seed moves.
   */
  'P05',
  /*
   * The accepted P-pack's P14, the fast year odometer. APPENDED after P05 for the
   * same reason: no existing tie-break or fallback seed moves.
   *
   * AFTER P12 IN THIS LIST, AND THAT IS THE ONLY ORDERING THAT MATTERS HERE. The
   * competition loop walks these in order and the fallback seeds do too, so on a
   * beat where both year templates are drawable and neither is planned, P12 is
   * reached first and keeps the date exactly as it does today. P14 takes the
   * beat only where the planner asked for it (the score's `PLANNED_BONUS`) or
   * where P12 cannot draw at all (G15).
   */
  'P14',
  /*
   * ##########################################################################
   * # THE FOUR NIKU SENT ON 2026-09-14, ALL APPENDED, ALL FOR THE SAME       #
   * # REASON AS EVERY APPEND ABOVE: no existing tie-break or fallback seed   #
   * # moves.                                                                 #
   * #                                                                        #
   * # His message: "Few text overlays for you to remake (4 pieces)... Once   #
   * # you have managed to add these to the library, I will send a ruling for #
   * # them." So the RULINGS ARE NOT WRITTEN YET. Every cap, position rule    #
   * # and character bound below is therefore `capSource: 'unstated'` and     #
   * # measured off his own reference clips, never invented and never quoted  #
   * # back to him as his.                                                    #
   * #                                                                        #
   * # The clips are in `templates/Templates/NIKU-2026-09-14-text-overlays/`  #
   * # and every number is measured in `tmp/v53/overlays/SPEC-measured.md`.   #
   * ##########################################################################
   */

  /*
   * "chapter title v2.mp4". A SECOND chapter-title STYLE, and it needs its own
   * id rather than a restyle of `chapter-title` — his words, "it will just be
   * put on the other detected spots as the previous one could only be used
   * twice". `chapter-title` is `maxPerFilm: 2` and section detection finds
   * roughly eight spots on the real film, so the other six have nowhere to go.
   * A restyle would still be one device against one cap. Two ids, two caps.
   */
  'chapter-plate',
  /*
   * "text overlay 5.0". Two lines top left that type on character by character.
   */
  'top-title',
  /*
   * "text overlay 6.0". A caps line top right over a smaller caps kicker.
   */
  'corner-label',
  /*
   * "text Overlay winton churchill.mp4". A name and a role on a torn light
   * plate, bottom left. SHIPS DISABLED — see its registry entry. It carries the
   * same exposure that disabled `name-card`, and the client has not answered
   * the question that would settle it.
   */
  'name-plate',
] as const

export const DeviceIdSchema = z.enum(DEVICE_IDS)
export type DeviceId = z.infer<typeof DeviceIdSchema>

/* ------------------------------------------------------------------------- */
/* What a scene carries when it IS a device                                    */
/* ------------------------------------------------------------------------- */

const unit = z.number().min(0).max(1)

/**
 * P17's plate holds about ten characters and does NOT wrap, shrink or clip.
 *
 * Mirrored from `P17_LABEL_MAX_CHARS` in `apps/web/src/remotion/templates/P17.tsx`,
 * which cannot be imported from here — `packages/core` declares no `@vg/*`
 * dependency and adding one would make the workspace graph cyclic. The pair is
 * pinned against each other by a test in `apps/web`, which CAN see both.
 *
 * Character count is the wrong guard and the template's own notes say so: a
 * 12-character string fits where an 11-character one does not. It is a ceiling
 * that keeps the obviously-too-long out, not a proof that a passing string fits.
 */
export const P17_LABEL_MAX_CHARS_MIRROR = 10

/**
 * Template 05's line, as the schema bounds it and as the planner is told.
 *
 * Its WIDTH is the real gate, measured in the chooser by `shadowUpLineFits`
 * (`shadowUpFit.ts`) against Bebas Neue's own advances and the title-safe
 * width. 32 is only the ceiling a string may reach before that measurement is
 * worth running. It is not the tightest budget the planner has, so the
 * prompt's "tightest limit" sentence does not move.
 */
export const SHADOW_UP_LINE_MAX_CHARS = 32

/**
 * P04's two lines, as the schema bounds them.
 *
 * Their WIDTH is the real gate, measured in the chooser by `p04MainLineFits` and
 * `p04SupportLineFits` (`p04Fit.ts`) against Libre Franklin's own advances and
 * the pack's 620 px block. These are only the ceilings a string may reach before
 * that measurement is worth running. The main line's 32 is also where
 * `visualPlan.ts` cuts a sheet's headline, as it is for 05. The support line's
 * 40 sits past the widest run the measurement ever passed: on job 99414763's
 * script every run of 42 characters or more is wider than the block.
 */
export const P04_MAIN_LINE_MAX_CHARS = 32
export const P04_SUPPORT_LINE_MAX_CHARS = 40

/**
 * P02's two lines, as the schema bounds them.
 *
 * Their WIDTH is the real gate, measured in the chooser by `p02HeadlineFits` and
 * `p02LabelFits` (`p02Fit.ts`) against Libre Franklin SemiBold's own advances
 * and the 524 px the card leaves for type. These are only the ceilings a string
 * may reach before that measurement is worth running, and each sits just past
 * the widest run the measurement ever passed on job 99414763's script: a
 * headline of 77 characters still drew on four lines and every run of 78 or more
 * did not, and a label of 35 still drew on one line and every run of 36 or more
 * did not. The headline's 80 is also where `visualPlan.ts` cuts a sheet's
 * headline.
 */
export const P02_HEADLINE_MAX_CHARS = 80
export const P02_LABEL_MAX_CHARS = 40

/**
 * P09's two lines, as the schema bounds them.
 *
 * Their WIDTH is the real gate, measured in the chooser by `p09QuestionFits` and
 * `p09LabelFits` (`p09Fit.ts`) against Libre Franklin SemiBold's own advances,
 * the question's 650 px measure and the card's 670 px content box. These are
 * only the ceilings a string may reach before that measurement is worth running,
 * and each sits at or just past the widest run the measurement ever passed on
 * job 99414763's script: a question of 80 characters, its question mark
 * included, still drew on three lines and every run of 81 or more did not, and a
 * label of 54 still drew on one line and every run of 55 or more did not. The
 * question's 80 is also where `visualPlan.ts` cuts a sheet's headline, and a cut
 * question has lost its question mark, so the schema and the chooser refuse it.
 */
export const P09_QUESTION_MAX_CHARS = 80
export const P09_LABEL_MAX_CHARS = 56

/**
 * P05's four lines, as the schema bounds them.
 *
 * Their WIDTH is the real gate, measured in the chooser by `p05HeadlineFits`,
 * `p05EyebrowFits`, `p05SupportLineFits` and `p05ImageLabelFits` (`p05Fit.ts`)
 * against Libre Franklin's own advances, the column's 678 px, the support line's
 * 580 px and the picture's 718 px. These are only the ceilings a string may reach
 * before that measurement is worth running, and each sits just past the widest
 * run the measurement ever passed on job 99414763's script: a headline of 44
 * characters still drew on three lines, an eyebrow of 43 and a label of 59 on
 * one, and a support line of 92 on two. The headline's 48 is also where
 * `visualPlan.ts` cuts a sheet's headline, and 48 is where it cuts every `lines`
 * entry, so the support line and the label arrive shorter than their bounds.
 */
export const P05_HEADLINE_MAX_CHARS = 48
export const P05_EYEBROW_MAX_CHARS = 48
export const P05_SUPPORT_LINE_MAX_CHARS = 96
export const P05_IMAGE_LABEL_MAX_CHARS = 60

/**
 * P14's YEAR: FOUR DIGITS, NOTHING BEFORE THEM AND NOTHING AFTER.
 *
 * ##########################################################################
 * # NOT A LENGTH, A SHAPE, AND P14's OWN RENDERER IS WHY. It keeps the      #
 * # LAST FOUR numeric characters of whatever it is given and pads shorter   #
 * # values with leading zeroes, so every non-conforming string it can be    #
 * # handed becomes a DIFFERENT YEAR rather than an error:                   #
 * #                                                                        #
 * #   "364 CE"            -> 0364                                          #
 * #   "third century BCE" -> 0000                                          #
 * #   "1947-1956"         -> 1956                                          #
 * #   "c. 1200"           -> 1200, the "about" silently dropped            #
 * #                                                                        #
 * # A bound of 12 characters, which is what P12 carries, admits all four.   #
 * # This regex admits none of them. The chooser refuses the same strings a  #
 * # step earlier, from the `bareYear` detector alone; this is the refusal   #
 * # at the plan boundary, for the plan the chooser never saw.               #
 * #                                                                        #
 * # NO UPPER OR LOWER YEAR: `0000` and `9999` both parse. A year the        #
 * # narration really speaks is the only thing that ever reaches this, and a #
 * # range check here would be a second, weaker opinion about what a date is #
 * # sitting next to the detector that actually decides.                     #
 * ##########################################################################
 */
export const BARE_FOUR_DIGIT_YEAR: z.ZodType<string> = z
  .string()
  .regex(/^\d{4}$/, 'a P14 year must be exactly four digits, because the odometer draws four wheels')

/** Is this the one shape P14 can draw without rewriting it? Read by the chooser. */
export function isBareFourDigitYear(text: string): boolean {
  return /^\d{4}$/.test(text)
}

/* ------------------------------------------------------------------------- */
/* P03's headline: how WIDE it draws, not how many characters it has           */
/* ------------------------------------------------------------------------- */

/**
 * THE HEADLINE GATE IS A WIDTH NOW, AND IT USED TO BE A CHARACTER COUNT THAT
 * THIS PROJECT'S OWN NOTES CALLED WRONG IN AS MANY WORDS.
 *
 * ##########################################################################
 * # `P03_HEADLINE_MAX_CHARS` was 20, got by dividing ONE measured mean     #
 * # glyph width into `maxWidth`. The note recording it admitted the flaw   #
 * # itself: "a line of M's and W's is far wider and a line of I's and L's  #
 * # far narrower, so this is a ceiling that keeps the obviously-too-long   #
 * # out rather than a proof that a passing string fits."                   #
 * #                                                                        #
 * # IT WAS WRONG IN BOTH DIRECTIONS. On the real scene 0 it refused        #
 * # "Israel Antiquities Authority" (28 characters), which draws in two     #
 * # comfortable lines — so that beat could not feed P03 under any ordering #
 * # and fell through to photo-pop, which is the one device the client has  #
 * # since banned from the opening. And it PASSED a run of eighteen W's,    #
 * # measured here at 1781px against a 1120px block: one unbreakable word   #
 * # that simply runs off the frame.                                        #
 * #                                                                        #
 * # SO IT MEASURES INK. The old note said this package "cannot — it has no #
 * # font metrics and no DOM". It does not need a DOM: the metrics are in   #
 * # the font file, and they are copied in below.                           #
 * ##########################################################################
 */

/**
 * `P03.tsx`'s own numbers, mirrored the way `P17_LABEL_MAX_CHARS_MIRROR` is.
 *
 * `packages/core` declares no `@vg/*` dependency and adding one would make the
 * workspace graph cyclic, so these cannot be imported from the template. They
 * are the four values that decide where the headline breaks:
 *
 *   `<div style={{ maxWidth: 1120 }}>`                     the block
 *   `fontSize: 92, fontWeight: 600, letterSpacing: 0.4`    the type
 *   `display: flex, flexWrap: wrap, columnGap: 22`         the wrapping
 *
 * ##########################################################################
 * # NOTHING PINS THIS PAIR AGAINST THE TEMPLATE THE WAY `apps/web` PINS    #
 * # P17's. That test lives in the web package because only it can see both #
 * # files, and P03 has no equivalent. Whoever owns `apps/web` should add   #
 * # one — until then a change to `P03.tsx`'s layout silently un-tunes this #
 * # gate and nothing anywhere goes red.                                    #
 * ##########################################################################
 */
export const P03_CONTENT_MAX_WIDTH = 1120
export const P03_HEADLINE_FONT_SIZE = 92
export const P03_HEADLINE_LETTER_SPACING = 0.4
export const P03_HEADLINE_COLUMN_GAP = 22

/**
 * TWO LINES, AND THE CLIENT SETTLED THIS RATHER THAN A PREFERENCE.
 *
 * ##########################################################################
 * # THE OLD NOTE TREATED WRAPPING AS THE DEFECT — "a 28-character headline #
 * # passed it and then WRAPPED TO TWO LINES in the film, where the pack's  #
 * # reference is one". THAT READING IS DISPROVED BY HIS OWN REVIEW.        #
 * #                                                                        #
 * # The frame he called PERFECT, at 1:32, is beat 24 of the delivered plan #
 * # — kicker "Chapter 22", headline "Book of the Watchers". Pulled out of  #
 * # `storage/outputs` and LOOKED AT, it draws                              #
 * #                                                                        #
 * #        CHAPTER 22                                                      #
 * #        BOOK OF THE                                                     #
 * #        WATCHERS                                                        #
 * #                                                                        #
 * # on TWO lines. He praised it anyway, and asked for more of it. So two   #
 * # lines is the accepted look, and a one-line rule would refuse the exact #
 * # frame he pointed at.                                                   #
 * #                                                                        #
 * # THREE IS STILL REFUSED. The block is bottom-anchored with              #
 * # `paddingBottom: 150`, so every extra line grows UPWARDS; a third at    #
 * # 92px and `lineHeight` 0.98 lifts the kicker over the middle of the     #
 * # photograph, which no delivered frame has ever shown.                   #
 * ##########################################################################
 */
export const P03_HEADLINE_MAX_LINES = 2

/**
 * Advance width of one glyph as a fraction of the em, READ OFF THE SHIPPING
 * FONT FILE rather than estimated.
 *
 * Source: `apps/web/public/fonts/LibreFranklin-SemiBold.woff2` — the weight-600
 * face `P03.tsx` sets the headline in — `unitsPerEm` 1000, advances from its
 * `hmtx` table. Only what an uppercased narration mark can contain is listed;
 * `advanceEm` says what happens to anything else.
 *
 * ##########################################################################
 * # THE SPREAD IS THE WHOLE POINT. 'I' is 0.306 em and 'W' is 1.071 — one  #
 * # is THREE AND A HALF TIMES the other. A count of characters cannot tell #
 * # those apart and a width can, and that is the entire difference between #
 * # this gate and the number it replaces.                                  #
 * ##########################################################################
 */
const HEADLINE_ADVANCE_EM: Readonly<Record<string, number>> = {
  A: 0.756, B: 0.715, C: 0.719, D: 0.741, E: 0.645, F: 0.621,
  G: 0.747, H: 0.746, I: 0.306, J: 0.437, K: 0.729, L: 0.619,
  M: 0.934, N: 0.758, O: 0.77, P: 0.706, Q: 0.772, R: 0.713,
  S: 0.665, T: 0.669, U: 0.717, V: 0.724, W: 1.071, X: 0.715,
  Y: 0.715, Z: 0.664,
  '0': 0.701, '1': 0.494, '2': 0.628, '3': 0.658, '4': 0.675,
  '5': 0.669, '6': 0.677, '7': 0.612, '8': 0.678, '9': 0.675,
  ' ': 0.209, '-': 0.38, '.': 0.237, ',': 0.239, ':': 0.237,
  ';': 0.249, '!': 0.257, '?': 0.532, '&': 0.818, '/': 0.357,
  '(': 0.304, ')': 0.304, "'": 0.245, '"': 0.449,
  /* The five that are NOT a plain base letter, so stripping accents misses them. */
  'Æ': 1.055, 'Œ': 1.127, 'Ø': 0.752, 'Ð': 0.753, 'Þ': 0.575,
  /* Typographic punctuation this script actually uses. */
  '–': 0.575, '—': 0.899, '’': 0.234, '“': 0.442, '”': 0.445,
}

/**
 * The widest glyph in the face, used for anything the table does not name.
 *
 * ##########################################################################
 * # IT ERRS TOWARDS REFUSING, AND THAT DIRECTION IS CHOSEN RATHER THAN     #
 * # CONVENIENT.                                                            #
 * #                                                                        #
 * # Guessing NARROW lets an over-wide headline through, and it takes a     #
 * # third line or runs off the frame, in a delivered film, with nothing    #
 * # red. Guessing WIDE refuses a beat that would have fitted, and that     #
 * # beat then draws no type at all — the outcome the client has already    #
 * # accepted on eighty-seven scenes of the film he reviewed. The two       #
 * # failures are not the same size, so the fallback is the worst case.     #
 * ##########################################################################
 */
const WIDEST_ADVANCE_EM = 1.127

/**
 * One glyph's advance, in ems.
 *
 * Accented capitals are stripped to their base letter first, because in this
 * face they measure IDENTICALLY — 'A' and every one of its six accented forms
 * are all 0.756, 'E' and its four are all 0.645. That matters on this script,
 * which says "Ecole Biblique" with an acute and "Schoyen" with a slashed o. The
 * two ligatures and the slashed O are NOT their base letter, so they are named
 * in the table above instead.
 */
function advanceEm(glyph: string): number {
  const direct = HEADLINE_ADVANCE_EM[glyph]
  if (direct !== undefined) return direct
  const stripped = glyph.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return HEADLINE_ADVANCE_EM[stripped] ?? WIDEST_ADVANCE_EM
}

/**
 * How wide one WORD of the headline draws, in pixels.
 *
 * `letter-spacing` is added after every character INCLUDING THE LAST, which is
 * what Chrome puts into the inline-block's own width, so it is counted per
 * character rather than per gap.
 */
export function p03WordWidth(word: string): number {
  let width = 0
  for (const glyph of word.toUpperCase()) {
    width += advanceEm(glyph) * P03_HEADLINE_FONT_SIZE + P03_HEADLINE_LETTER_SPACING
  }
  return width
}

/**
 * How many lines the headline draws on, or `Infinity` when one word alone
 * overflows the block.
 *
 * ##########################################################################
 * # A GREEDY FILL, WHICH IS WHAT A WRAPPING FLEX ROW DOES. Every word is   #
 * # its own inline-block — the template needs that, because each word      #
 * # carries its own positioned highlight marker — so the words are the     #
 * # only break opportunities and `columnGap` sits between them.            #
 * #                                                                        #
 * # A SINGLE WORD WIDER THAN THE BLOCK IS `Infinity`, NOT ONE LINE. A flex #
 * # item does not break inside a word by default, so it runs out past the  #
 * # 1120px edge. That is a clip, not a wrap, and it must not read as the   #
 * # cheapest possible fit.                                                 #
 * #                                                                        #
 * # CHECKED AGAINST TWO DELIVERED FRAMES rather than reasoned about:       #
 * #   "Book of the Watchers" -> 2, and the film draws BOOK OF THE /        #
 * #                            WATCHERS, which is the split this predicts  #
 * #   "Dead Sea Scrolls"     -> 1, and the film draws it on one            #
 * # The predicted advance for the second is 944px against 935px of         #
 * # measured ink, the 9px being the side bearings the ink does not reach.  #
 * ##########################################################################
 */
export function p03HeadlineLineCount(headline: string): number {
  const words = headline.trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return 0

  let lines = 1
  let used = 0
  for (const word of words) {
    const width = p03WordWidth(word)
    if (width > P03_CONTENT_MAX_WIDTH) return Number.POSITIVE_INFINITY
    if (used === 0) {
      used = width
      continue
    }
    if (used + P03_HEADLINE_COLUMN_GAP + width <= P03_CONTENT_MAX_WIDTH) {
      used += P03_HEADLINE_COLUMN_GAP + width
      continue
    }
    lines += 1
    used = width
  }
  return lines
}

/** Does this headline draw inside the block P03 gives it? */
export function p03HeadlineFits(headline: string): boolean {
  return p03HeadlineLineCount(headline) <= P03_HEADLINE_MAX_LINES
}

/*
 * ##########################################################################
 * # `CHAPTER_PLATE_WASH_ALPHA_MAX` LIVED HERE AND IS DELETED. It was the    #
 * # deepest band `ChapterPlate.tsx` was licensed to paint, hoisted above    #
 * # both the schema and the registry so that the `.max()` at the plan       #
 * # boundary and the `scrimAlpha` on the row were literally one number.     #
 * #                                                                        #
 * # Nothing paints a band. Both devices that own their ground carry a fixed #
 * # glyph halo, the schema slot it bounded is gone with it, and the row it  #
 * # fed is no longer a cap on anything — it is a MEASUREMENT of what the    #
 * # halo is worth. A constant named `..._MAX` left in place would promise a #
 * # ceiling on a value nobody writes.                                       #
 * ##########################################################################
 */


/**
 * Only the COPY and the NUMBERS. Never a picture path.
 *
 * ##########################################################################
 * # A DEVICE NAMES ITSELF AND ITS WORDS; THE PICTURES COME FROM THE SCENE. #
 * #                                                                        #
 * # `PlannedScene.asset` and `PlannedScene.companions` already carry the   #
 * # storage keys, and `render.ts` already resolves those to URLs Chrome    #
 * # can fetch. Putting a path in here would give one scene two disagreeing #
 * # answers to "which photograph is this", and would put a path through a  #
 * # slot whose whole job is to refuse one.                                 #
 * ##########################################################################
 */
export const SceneDeviceSchema = z.discriminatedUnion('id', [
  /* ---- enabled ---- */
  z.object({
    id: z.literal('P12'),
    /** The spoken year or era. Never invented — see `deviceChoice.ts`. */
    year: deviceText(12),
    /** Reserved. Always '' today; '' omits the block entirely. */
    eraLabel: z.string().max(24).default(''),
    detail: z.string().max(160).default(''),
  }),
  z.object({
    id: z.literal('P17'),
    label: deviceText(P17_LABEL_MAX_CHARS_MIRROR),
    /** Where the leader line points. From `vision.subjectAnchor`. */
    anchorX: unit,
    anchorY: unit,
    /** Where the plate sits. Arithmetic on the anchor, no model. */
    labelX: unit,
    labelY: unit,
  }),
  z.object({
    id: z.literal('P03'),
    kicker: deviceText(24),
    headline: deviceText(64),
    /** Whole words of `headline`, checked as words rather than substrings. */
    highlightWords: z.array(deviceText(32)).min(1).max(3),
  }),
  z.object({
    id: z.literal('framed-card'),
    caption: deviceText(32),
  }),
  z.object({ id: z.literal('photo-pop') }),
  z.object({ id: z.literal('P22') }),
  z.object({ id: z.literal('P19') }),
  z.object({ id: z.literal('gallery-strip') }),
  z.object({
    id: z.literal('shadow-up'),
    /**
     * Template 05's one line, the narration's own words. Checked word by word,
     * measured against the title-safe width and refused if it carries a year,
     * all in `buildCopy`. Sentence case here; the component upper-cases it.
     */
    line: deviceText(SHADOW_UP_LINE_MAX_CHARS),
  }),
  /*
   * P08 CARRIES NO STRING, AND THAT IS THE RULING RATHER THAN AN OMISSION.
   *
   * The pack's `sourceTag` and `sourceDetail` name the source of the picture,
   * which nothing in this pipeline may invent. The developer ruled both empty,
   * so the arm has no field for either: zod strips an unknown key, and a plan
   * that somehow wrote one still reaches the frame as `{ id: 'P08' }`.
   */
  z.object({ id: z.literal('P08') }),
  /*
   * P04, THE LOWER-LEFT LABEL. BOTH STRINGS NAME THE PICTURE.
   *
   * So both answer to the developer's ruling in `buildCopy`: every content word
   * spoken in this shot's own narration AND in the picture's archive record. The
   * label is refused otherwise. The support line is '' instead, and '' omits its
   * block entirely, as P12's empty strings do. Sentence case here; the component
   * upper-cases both.
   */
  z.object({
    id: z.literal('P04'),
    mainLine: deviceText(P04_MAIN_LINE_MAX_CHARS),
    supportLine: z.union([z.literal(''), deviceText(P04_SUPPORT_LINE_MAX_CHARS)]).default(''),
  }),
  /*
   * P02, THE EDITORIAL CARD. THE HEADLINE IS REQUIRED AND THE LABEL IS NOT.
   *
   * Both answer to `buildCopy`: every content word spoken in the window, as
   * P03's written pair does, never a year, and measured against the card. A
   * headline that fails is refused. A label that fails is '' instead, and ''
   * omits its block entirely, as P04's support line does. Sentence case here;
   * the component upper-cases the label and draws the headline as written.
   */
  z.object({
    id: z.literal('P02'),
    label: z.union([z.literal(''), deviceText(P02_LABEL_MAX_CHARS)]).default(''),
    headline: deviceText(P02_HEADLINE_MAX_CHARS),
  }),
  /*
   * P09, THE COMPACT QUESTION CARD. THE QUESTION IS REQUIRED AND THE LABEL IS NOT.
   *
   * The question answers to `buildCopy`: a question the narration really asks,
   * ending where the spoken question ends, every content word spoken in the
   * window, never a year, and measured against the card. IT MUST END IN A
   * QUESTION MARK, here as well as there, so a sheet line cut short by
   * `visualPlan.ts` can never parse as one. A label that fails is '' instead, and
   * '' omits its block entirely, as P02's does. Sentence case here; the component
   * upper-cases the label and draws the question as written.
   */
  z.object({
    id: z.literal('P09'),
    sectionLabel: z.union([z.literal(''), deviceText(P09_LABEL_MAX_CHARS)]).default(''),
    question: deviceText(P09_QUESTION_MAX_CHARS).refine(
      (value) => value.endsWith('?'),
      'a P09 question must end in a question mark',
    ),
  }),
  /*
   * P05, TEXT LEFT AND A PICTURE RIGHT. THE HEADLINE IS REQUIRED AND THE OTHER
   * THREE ARE NOT.
   *
   * The eyebrow, headline and support line answer to `buildCopy` as P02's lines
   * do: every content word spoken in the window, never a year, and measured
   * against the column. The picture label answers to the developer's ruling for
   * P04's label: every content word spoken in the carrying shot alone AND in the
   * picture's archive record. A headline that fails is refused. Any other line
   * that fails is '' instead, and '' omits its block entirely. Sentence case here;
   * the component upper-cases the eyebrow, headline and label and draws the
   * support line as written.
   */
  z.object({
    id: z.literal('P05'),
    eyebrow: z.union([z.literal(''), deviceText(P05_EYEBROW_MAX_CHARS)]).default(''),
    headline: deviceText(P05_HEADLINE_MAX_CHARS),
    supportLine: z.union([z.literal(''), deviceText(P05_SUPPORT_LINE_MAX_CHARS)]).default(''),
    imageLabel: z.union([z.literal(''), deviceText(P05_IMAGE_LABEL_MAX_CHARS)]).default(''),
  }),
  /*
   * P14, THE FAST YEAR ODOMETER. FOUR DIGITS, AND LITERALLY NOTHING ELSE.
   *
   * ########################################################################
   * # `BARE_FOUR_DIGIT_YEAR`, NOT `deviceText(12)` LIKE P12's, AND THE      #
   * # DIFFERENCE IS THAT P14's RENDERER SILENTLY REWRITES WHAT IT CANNOT    #
   * # DRAW.                                                                #
   * #                                                                      #
   * # P12 sets its string as type: hand it "364 CE" and the frame says     #
   * # "364 CE". P14 rolls four numeric wheels, so the pack's component     #
   * # strips every non-digit, keeps the last four and pads with leading    #
   * # zeroes. That turns "364 CE" into 0364, "third century BCE" into      #
   * # 0000 and "1947-1956" into 1956 — three different years nobody said,  #
   * # each drawn with total confidence and none of them caught by anything #
   * # downstream, because the plan records the string and the frame draws  #
   * # the digits.                                                          #
   * #                                                                      #
   * # SO THE BOUND IS THE SHAPE, NOT THE LENGTH. Four digits is the only   #
   * # value for which the pack's reduction is the identity, and the pack's #
   * # own contract asks for exactly that: "verified four-digit year/date". #
   * # `deviceChoice.ts` already refuses anything else at `buildCopy`, from #
   * # the `bareYear` detector alone; this is the second refusal, at the    #
   * # boundary every path that parses a plan goes through, because a       #
   * # hand-edited sheet is exactly the plan the chooser never saw.         #
   * #                                                                      #
   * # `label` AND `detail` MIRROR P12's TWO RESERVED STRINGS. Both are ''  #
   * # today and '' omits the block entirely. Nothing here has a verified   #
   * # source for a year's caption, and P14 also CUTS the pack's hardcoded  #
   * # verification tag, which is a claim nobody checked (T-18).            #
   * ########################################################################
   */
  z.object({
    id: z.literal('P14'),
    year: BARE_FOUR_DIGIT_YEAR,
    label: z.string().max(24).default(''),
    detail: z.string().max(160).default(''),
  }),

  /* ---- Niku's four, 2026-09-14 ---- */

  /*
   * The heading only. The ochre rule under it is drawn at a fixed width and is
   * not copy, so it is not a slot.
   *
   * ########################################################################
   * # 25, AND IT NO LONGER MATCHES `chapter-title`. THAT IS THE CLIENT'S    #
   * # RULING OF 2026-09-16, NOT A DRIFT.                                    #
   * #                                                                       #
   * #   "Shrink long titles to fit. I would say maximum 25 character        #
   * #    titles might be good limit."                                       #
   * #                                                                       #
   * # This used to be 20, matching `chapter-title`'s `CHAPTER_TITLE_MAX_    #
   * # CHARS` rather than its looser 48-character schema bound, so that an   #
   * # operator moving a title between the two styles could not get a        #
   * # refusal that reads like a bug. The two styles sit on the same         #
   * # detected spots, so that pairing was worth having.                     #
   * #                                                                       #
   * # HIS RULING BREAKS THE PAIRING ON PURPOSE, and only this side may      #
   * # move, because only this side SHRINKS. A heading too wide for the      #
   * # measure is set smaller here, down to a 90px cap, and is REFUSED by    #
   * # `chapter-title`, which draws at one size and has no shrink at all.    #
   * # Raising `chapter-title` to 25 to restore the symmetry would hand it   #
   * # copy it cannot draw.                                                  #
   * #                                                                       #
   * # SO THE OPERATOR REFUSAL THE OLD COMMENT GUARDED AGAINST IS NOW REAL,  #
   * # in one direction: a 21-to-25-character heading moved from this style  #
   * # to `chapter-title` is refused, correctly, because it would overrun    #
   * # the frame there. Moving one the other way is always safe.             #
   * #                                                                       #
   * # KEEP THIS IN STEP WITH `CHAPTER_PLATE_MAX_CHARS` in deviceChoice.ts.  #
   * # They were 20 and 25 for one commit and the gap was invisible: the     #
   * # chooser admitted a 23-character heading and zod killed it at the      #
   * # plan boundary, so the device drew nothing and no test went red.       #
   * ########################################################################
   */
  z.object({
    id: z.literal('chapter-plate'),
    heading: deviceText(25),
    /*
     * ##########################################################################
     * # A `washAlpha` SLOT SAT HERE FOR ONE DAY AND IS DELETED WITH THE BAND    #
     * # IT SET THE DEPTH OF, AND THE DELETION IS WHY THIS BOX IS NOT EMPTY.     #
     * #                                                                        #
     * # It was a required number with a default, carried on the device object   #
     * # because that is the one object G8c, the frame, planCheck T-7 and        #
     * # `device-replay.ts` all already hold, and hashed into the segment key    #
     * # by `computeRenderKey` because a depth is geometry that reaches a pixel. #
     * # All of that was right about a band. There is no band: the heading       #
     * # carries its ground on its own glyphs, at a blur that is a fixed         #
     * # fraction of the cap it is set at, so the frame is a pure function of    #
     * # the HEADING and there is nothing per-shot left to carry.                #
     * #                                                                        #
     * # A PLAN THAT STILL CARRIES ONE PARSES AND IGNORES IT. `SceneDeviceSchema`#
     * # members are non-strict `z.object`s, so an unknown key is stripped       #
     * # rather than refused — which is what keeps every frozen plan in          #
     * # `jobs.plan` re-delivering. It does change the SEGMENT KEY of any beat   #
     * # that carried one, and that is correct rather than unfortunate: those    #
     * # beats draw a different frame now.                                       #
     * ##########################################################################
     */
  }),
  /*
   * Two lines, top left. `deviceText` per line rather than one string with a
   * newline, because a newline is not printable and `deviceText` would not
   * refuse it. The second line is optional and an empty string omits its block.
   */
  z.object({
    id: z.literal('top-title'),
    line1: deviceText(28),
    line2: z.union([z.literal(''), deviceText(28)]).default(''),
  }),
  /*
   * A caps line over a smaller caps kicker, top right. Both are drawn
   * upper-cased by the component, so both are MEASURED upper-cased too — see the
   * fit module. The kicker is optional.
   */
  z.object({
    id: z.literal('corner-label'),
    label: deviceText(18),
    kicker: z.union([z.literal(''), deviceText(14)]).default(''),
  }),
  /*
   * A person's name and what they are. Same two slots as `name-card`, and the
   * same bounds, because it answers the same job with a different design.
   */
  z.object({ id: z.literal('name-plate'), name: deviceText(32), role: deviceText(48) }),

  /* ---- registered but never chosen; see `enabled` in the registry ---- */
  z.object({ id: z.literal('pointer-label'), label: deviceText(32) }),
  z.object({ id: z.literal('chapter-title'), caption: deviceText(48) }),
  z.object({ id: z.literal('name-card'), name: deviceText(32), role: deviceText(48) }),
  z.object({ id: z.literal('two-photo-zoom'), left: deviceText(24), right: deviceText(24) }),
  /*
   * A PHRASE MUST BE AN EXACT SUBSTRING OF ITS OWN PARAGRAPH, OR THE PAGE DRAWS
   * THAT PARAGRAPH WITH NO MARK at exit 0 (`HighlightPage.tsx`). The clip CLI
   * refused it and nothing on the film side did, so the schema says it once for
   * every path that parses a plan.
   */
  z
    .object({
      id: z.literal('highlight-page'),
      paragraphs: z.array(deviceText(400)).length(3),
      phrases: z.array(deviceText(64)).length(3),
    })
    .refine(
      (page) => page.phrases.every((phrase, index) => (page.paragraphs[index] ?? '').includes(phrase)),
      { message: 'each highlight-page phrase must be an exact substring of its own paragraph' },
    ),
  z.object({
    id: z.literal('bullet-checklist'),
    title: deviceText(32),
    rows: z.array(deviceText(48)).min(1).max(3),
  }),
  z.object({
    id: z.literal('P13'),
    kicker: deviceText(24),
    heading: deviceText(48),
    events: z.array(z.object({ date: deviceText(12), caption: deviceText(24) })).length(3),
  }),
  z.object({
    id: z.literal('P16'),
    kicker: deviceText(24),
    lines: z.array(deviceText(32)).min(2).max(4),
    detail: deviceText(64),
  }),
])

export type SceneDevice = z.infer<typeof SceneDeviceSchema>

/* ------------------------------------------------------------------------- */
/* The registry                                                                */
/* ------------------------------------------------------------------------- */

/** What the beat is trying to do. The partner's `primaryJob`, as a closed set. */
export const NARRATIVE_JOBS = [
  'single_historical_date',
  'ordered_dates_or_eras',
  'one_named_detail',
  'single_word_or_number_emphasis',
  'staged_argument_or_counterphrase',
  'source_inspection',
  'connected_three_source_evidence',
  'four_source_mosaic',
  'person_introduction',
  'section_turn',
  'ordered_takeaways',
  'comparison',
  /**
   * Saku's template 05. No shot's own words claim it: `narrativeJobsOf` pushes
   * it only from a planner ask, exactly as with `ordered_takeaways`.
   */
  'one_line_fact',
  /**
   * P08, one source that deserves the whole frame. The pack's own `primaryJob`
   * name. No shot's own words claim it: `narrativeJobsOf` pushes it only from a
   * planner ask, exactly as with `one_line_fact`, so a film with no P08 row
   * chooses as it did before P08 existed.
   */
  'source_priority',
  /**
   * P04, a small label saying what the picture shows. The pack's own
   * `primaryJob` name. No shot's own words claim it: `narrativeJobsOf` pushes it
   * only from a planner ask, exactly as with `source_priority`, so a film with no
   * P04 row chooses as it did before P04 existed.
   */
  'small_identification',
  /**
   * P02, a statement that deserves to feel important. The pack's own
   * `primaryJob` name. No shot's own words claim it: `narrativeJobsOf` pushes it
   * only from a planner ask, exactly as with `small_identification`, so a film
   * with no P02 row chooses as it did before P02 existed.
   */
  'major_claim_or_section_turn',
  /**
   * P09, a question the narration asks out loud. The pack's own `primaryJob`
   * name. No shot's own words claim it: `narrativeJobsOf` pushes it only from a
   * planner ask, exactly as with `major_claim_or_section_turn`, so a film with no
   * P09 row chooses as it did before P09 existed. `section_turn` was not reused,
   * because chapter-title owns it and a spoken section mark pushes it.
   */
  'question_or_section_reset',
  /**
   * P05, one short claim with the picture that is its evidence beside it. The
   * pack's own `primaryJob` name. No shot's own words claim it: `narrativeJobsOf`
   * pushes it only from a planner ask, exactly as with
   * `major_claim_or_section_turn`, so a film with no P05 row chooses as it did
   * before P05 existed.
   */
  'claim_with_supporting_image',
  /**
   * P14, a verified year that benefits from speed. The pack's own `primaryJob`
   * name.
   *
   * ##########################################################################
   * # A JOB OF ITS OWN, NOT `single_historical_date`, AND THAT IS THE WHOLE   #
   * # MECHANISM THAT KEEPS P12 WHERE IT IS.                                   #
   * #                                                                        #
   * # `narrativeJobsOf` pushes this ONLY from a planner row, exactly as with  #
   * # `claim_with_supporting_image`. A spoken year still pushes               #
   * # `single_historical_date` and nothing else, so on a film with no P14 row #
   * # G14 refuses P14 on every beat and the date goes to P12 as it always     #
   * # has. Reusing P12's job would have put a second uncapped device into the #
   * # jobs of all six date beats of the delivered plan and made the choice a  #
   * # score tie-break, which is not "the planner chooses between them" — it   #
   * # is a coin flip nobody wrote down.                                       #
   * #                                                                        #
   * # THE PACK'S OWN SIMPLE RULE, verbatim from `TEMPLATE_REGISTRY.json`:     #
   * # "Use the fast odometer only for a verified date that benefits from      #
   * # speed." Whether a date benefits from speed is an editorial judgement    #
   * # about the passage, which is the planner's job and not a detector's.     #
   * ##########################################################################
   */
  'fast_date_emphasis',
  /**
   * `top-title`, a short title set over the shot while the narration turns to a
   * new idea. A job of its own rather than a reuse, for the reason the P14 box
   * above gives at length: reusing `major_claim_or_section_turn` would put a
   * second uncapped device into every beat P02 already answers and turn the
   * choice into a score tie-break nobody wrote down.
   *
   * `narrativeJobsOf` pushes it ONLY from a planner ask, so a film with no
   * `top-title` row chooses exactly as it did before this device existed.
   */
  'running_title',
  /**
   * `corner-label`, a short name for what is on screen with an optional period
   * kicker under it. NOT `small_identification`, which is P04's, for the same
   * reason again — P04 is a label beside the subject and this is a corner
   * caption with a date line, and two uncapped devices on one job is a coin
   * flip.
   *
   * `narrativeJobsOf` pushes it ONLY from a planner ask.
   */
  'corner_identification',
] as const

export type NarrativeJob = (typeof NARRATIVE_JOBS)[number]

/** Why a device is not selectable, in one phrase, kept next to the device. */
export type DisabledReason =
  | null
  | 'superseded'
  | 'needs-invented-copy'
  | 'needs-external-fact'
  | 'needs-unmeasured-clock'
  | 'needs-shape-detector'
  | 'fails-contrast-floor'
  /**
   * THE DRAWING IS RIGHT AND THE PLACEMENT IS NOT, so this is the only reason
   * here that is about WHERE a device lands rather than about whether it can be
   * drawn or fed at all. Every other reason describes something missing; this
   * one describes something outstanding with the author.
   */
  | 'awaiting-placement-ruling'

export type DeviceSpec = {
  readonly id: DeviceId
  readonly origin: 'client' | 'saku'
  /** May the chooser return this device at all? */
  readonly enabled: boolean
  readonly disabledReason: DisabledReason
  readonly supersededBy: DeviceId | null
  /**
   * THE NAME THE AUTHOR'S OWN FILES GIVE THIS TEMPLATE, or null for the one
   * device that is in none of them.
   *
   * ######################################################################
   * # PROVENANCE, AND IT IS THE ONLY WAY THE CHAIN BELOW IS AUDITABLE.   #
   * #                                                                    #
   * # `shared/TEMPLATE_REGISTRY.json` expresses every fallback as a      #
   * # FILENAME — `a9_photo-pop.mp4`, not `photo-pop`. Translating those  #
   * # into this file's ids is a hand step, and without the filename      #
   * # written down beside the result nobody can check the translation    #
   * # against his source.                                                #
   * #                                                                    #
   * # HIS REGISTRY IS FIFTEEN AND OURS IS TWENTY-THREE. P12 appears      #
   * # nowhere in his registry, in any of its four sections, so it        #
   * # carries `null` here and an EMPTY chain, because writing a fallback #
   * # for it would be inventing a line of his rulebook, not reading one. #
   * #                                                                    #
   * # `shadow-up` is his template 05, from his REFERENCE library rather  #
   * # than the registry. It carries the id that library's manifest gives #
   * # it, and an empty chain because the manifest names no fallback.     #
   * #                                                                    #
   * # `P08` is from the accepted P-pack, whose own registry and lock give #
   * # it the `compositionId` it carries here, and no fallback. `P04` and  #
   * # `P02` are from the same pack and carry theirs the same way.        #
   * #                                                                    #
   * # `script/` IS GITIGNORED, so no test may read that JSON — a fresh   #
   * # clone does not have it. The chains are pinned as literals in       #
   * # `devices.test.ts` instead, against this column.                     #
   * ######################################################################
   */
  readonly officialFileName: string | null
  /**
   * WHAT TO DRAW INSTEAD, IN HIS ORDER, WHEN THIS DEVICE CANNOT BE DRAWN.
   *
   * ######################################################################
   * # HIS RULE 3, VERBATIM: "Do not select a template if its required    #
   * # inputs are unavailable. Select a FALLBACK or mark the beat for     #
   * # review."                                                           #
   * #                                                                    #
   * # THIS IS WHY THREE BUILDS IN A ROW CAME OUT EMPTIER THAN THE FILM   #
   * # THE CLIENT PRAISED. Every gate in `deviceChoice.ts` was correct    #
   * # about the device it refused and NOTHING REPLACED IT, so a rule     #
   * # that was meant to protect one frame deleted it instead: templates  #
   * # placed 13 -> 10, and his own chapter treatment 1 -> 0.             #
   * #                                                                    #
   * # ORDERED, AND THE ORDER IS HIS RATHER THAN A SCORE. `chooseDevices` #
   * # walks this list and takes the FIRST member that can actually be    #
   * # drawn; it does not weigh them against each other. He decided that  #
   * # a refused highlight-text beat is best served by a photo-pop and    #
   * # then by a framed-card, and substituting our seven weights for his  #
   * # two-item list would be replacing his judgement with ours.          #
   * #                                                                    #
   * # NOTE WHICH DEVICE HE PUT FIRST ON P03's CHAIN. `a9_photo-pop`      #
   * # draws NO WRITTEN COPY AT ALL, so it is the one substitution that   #
   * # cannot mislabel the photograph it lands on — which is exactly the  #
   * # refusal (T-8, "too generic to name") it is being asked to rescue.  #
   * #                                                                    #
   * # THE CHAINS CONTAIN CYCLES. His `a6_framed-card -> a9_photo-pop`    #
   * # and `a9_photo-pop -> a6_framed-card` close a two-cycle, and        #
   * # `a9_photo-pop -> 1_0-10_P03 -> a9_photo-pop` closes another. The   #
   * # walk therefore has to carry a visited set; see `rescueByFallback`. #
   * ######################################################################
   */
  readonly fallbackTemplateIds: readonly DeviceId[]
  /** What the beat must be doing for this device to be the right answer. */
  readonly job: NarrativeJob
  /** How many photographs it draws. ZERO is legal — two devices draw none. */
  readonly pictures: 0 | 1 | 2 | 4
  /**
   * The frame its LAST build element lands on. A beat shorter than this cuts the
   * build off mid-animation, at exit 0, with nothing red anywhere.
   */
  readonly buildEndFrames: number
  /**
   * The longest beat this device still reads well on.
   *
   * ######################################################################
   * # THIS IS NOT DECORATION AND IT IS THE HALF THAT GETS FORGOTTEN.     #
   * # `framed-card` is completely static after frame 25 and has no exit, #
   * # so on a five-second beat it delivers seconds of a dead-still frame #
   * # in a film where every other shot carries a camera move. A floor    #
   * # without a ceiling steers devices onto exactly the beats where they #
   * # degrade worst, because a longer beat scores better on duration.    #
   * ######################################################################
   */
  readonly holdsWellFrames: number
  /** The partner's registered default, in frames at 30fps. */
  readonly defaultDurationFrames: number
  /** An ABSOLUTE per-film cap. `null` means the client wrote "no hard rule". */
  readonly maxPerFilm: number | null
  /**
   * Where that cap came from, so an invented one cannot pass as his.
   *
   * ######################################################################
   * # A THIRD VALUE SINCE 2026-09-15, AND IT IS NOT THE PDF.             #
   * #                                                                    #
   * # `niku-pdf` means his explanation PDF, the gitignored file the four #
   * # original caps are quoted from. `unstated` means OURS — a number we #
   * # chose while he had written nothing.                                #
   * #                                                                    #
   * # `niku-ruling-2026-09-15` is his, but from the written ruling he    #
   * # sent at 21:37 that day, not from the PDF. It needed its own value  #
   * # rather than folding into `niku-pdf`, because the test that lists   #
   * # "the caps that came from him" also states WHICH document each one  #
   * # is quoted from, and the PDF does not contain these two numbers.    #
   * # Anyone checking a cap against the PDF and finding it absent would  #
   * # otherwise read that as an invented cap wearing his label, which is #
   * # the exact failure this field exists to make impossible.            #
   * ######################################################################
   */
  readonly capSource: 'niku-pdf' | 'niku-ruling-2026-09-15' | 'unstated'
  /** A written placement rule, kept separate from the cap because it is hedged. */
  readonly positionRule: 'none' | 'openingOnly' | 'notOpening' | 'prefersFirstHalf'
  /**
   * WHERE ITS PICTURES COME FROM, which is a question only one device answers
   * differently and it changes what "has enough pictures" even means.
   *
   * ######################################################################
   * # `ownScene` — the beat's own photograph, plus its own runners-up for #
   * # a device that draws several. Every device but one.                  #
   * #                                                                     #
   * # `filmPreview` — photographs the film draws LATER, chosen from the    #
   * # whole plan. Saku 0.3 on a8: "The Gallery Strip is the video's        #
   * # opening orientation moment. It gives the viewer a quick visual taste #
   * # of the people, places, objects, evidence, or themes that will appear #
   * # LATER." A picture from this beat previews nothing, so the carrier's  #
   * # own runners-up are the one source it may NOT use.                    #
   * #                                                                     #
   * # THIS IS WHY IT HAD NEVER PLACED. Read as `ownScene` it could only    #
   * # fire where one opening scene happened to own four photographs, and   #
   * # over the real 118-beat film no beat in the opening ever did.         #
   * ######################################################################
   */
  readonly pictureSource: 'ownScene' | 'filmPreview'
  /**
   * The author requires this device in EVERY film, once.
   *
   * Only a8 carries it, and only because Saku 0.3 says so four times over:
   * "Status: required opening template", "required once in every video as an
   * opening orientation gallery", "The opening A8 use is mandatory", and the
   * client forwarding it himself with "Now A8 will be used each time".
   *
   * It buys a REFUSAL of the other devices on the carrier beat, in the shape
   * G15 and G16 already use, and a report when no film carries one. It does not
   * buy a score thumb — see the note on `variety` in `score`.
   */
  readonly mandatoryOnce: boolean
  /**
   * Does it set type directly on the photograph, and does it protect it?
   *
   * `'shadowOnly'` is type straight on the photograph with a drop shadow and
   * NOTHING under it: no plate, no scrim, no ground. Saku's 05 draws it.
   * Calling that `'scrim'` would be false, and every reader of this field takes
   * it without a new branch: `drawsWords` reads it as words, `sourceProtection`
   * scores it with the scrims, and G9 refuses baked text under it.
   */
  readonly typeOverPicture: 'none' | 'ownGround' | 'opaquePlate' | 'scrim' | 'shadowOnly'
  /**
   * HOW MUCH BLACK THE COMPONENT REALLY PAINTS UNDER ITS OWN TYPE, 0..1.
   *
   * ##########################################################################
   * # A SECOND FIELD RATHER THAN A NUMBER IN PLACE OF THE WORD ABOVE.        #
   * #                                                                        #
   * # `typeOverPicture` is a five-member union on all 27 rows and three call #
   * # sites branch on the words — G9's `!== 'none'`, the 1000/700/400        #
   * # `sourceProtection` ladder, and `drawsWords` — with `devices.test.ts`   #
   * # pinning the exact strings on seven rows. Replacing it with a number    #
   * # rewrites a gate and a scoring table to say what one extra field says   #
   * # on its own.                                                            #
   * #                                                                        #
   * # AND THE WORD WAS A LIE ON THE TWO ROWS THAT MATTERED. corner-label and #
   * # chapter-plate have declared `'scrim'` since 2026-09-14 and neither     #
   * # component drew one: `CornerLabel.tsx` had no backgroundColor, no       #
   * # gradient and no textShadow anywhere in the file, and chapter-plate's   #
   * # own registry comment said "white type straight onto the photograph     #
   * # with no plate and no scrim behind it" one line above the claim. The    #
   * # word bought a 400-point scoring penalty for protection the viewer      #
   * # never got. This number is the one a gate can check and a component     #
   * # must honour.                                                           #
   * #                                                                        #
   * # ZERO IS THE HONEST DEFAULT and it is what every other row carries,     #
   * # including the ones whose type sits on their OWN ground: a plate is not #
   * # a wash, and `typeOverPicture` is still the field that says which.      #
   * #                                                                        #
   * # IT IS IN THE BUNDLE BECAUSE THE COMPONENT READS IT. `cornerLabelClock` #
   * # and `chapterPlateClock` import this registry through                   #
   * # `@vg/core/devices` and paint exactly this alpha, so the gate and the   #
   * # frame cannot disagree. That is the one reason a number is allowed to   #
   * # live in this file; every threshold that JUDGES it lives in             #
   * # `typeGround.ts`, which the compositor cannot reach.                    #
   * ##########################################################################
   */
  readonly scrimAlpha: number
  /**
   * Refuse a picture brighter than this when the device sets type on it.
   * `null` when the device draws no type over the photograph.
   */
  readonly maxMeanLuma: number | null
  /**
   * Refuse a picture DARKER than this.
   *
   * ######################################################################
   * # THE ONE GATE THAT RUNS FROM THE OTHER END, AND IT EXISTS BECAUSE A #
   * # RENDER CAUGHT ITS ABSENCE.                                         #
   * #                                                                    #
   * # P19 pins three cards to a board. The partner's registry asks for a #
   * # "light historical background" and his own preview uses an antique  #
   * # map. Handed a busy dark photograph the mechanics render            #
   * # IDENTICALLY, nothing errors, no test goes red, and the three cards #
   * # simply stop reading as pinned to anything.                        #
   * #                                                                    #
   * # This file described that constraint in a comment and enforced      #
   * # nothing, which was only visible once a still was rendered against  #
   * # a green foliage board. `null` for every other device.              #
   * ######################################################################
   */
  readonly minMeanLuma: number | null
  /**
   * Does it apply its own colour treatment?
   *
   * ######################################################################
   * # THE HOUSE `Grade` LAYER MUST BE SUPPRESSED FOR A DEVICE THAT       #
   * # CARRIES ONE, AND MOUNTED FOR A DEVICE THAT DOES NOT. Getting this  #
   * # per-BRANCH rather than per-DEVICE ships the two client animations  #
   * # with no tone curve, no toe lift, no grain and no vignette while    #
   * # the other ninety shots have all four — a visible mismatch that no  #
   * # test would catch.                                                  #
   * ######################################################################
   */
  readonly carriesOwnGrade: boolean
}

/**
 * TOTAL BY TYPE. Add a seventeenth id to `DEVICE_IDS` and this object stops
 * compiling until somebody states what it draws — the same trick `clipArgs.ts`
 * uses, and for the same reason: a missing entry there once handed a new
 * animation 89 frames and rendered it truncated at exit 0.
 */
export const DEVICE_REGISTRY: Record<DeviceId, DeviceSpec> = {
  /* --------------------------------------------------------------------- */
  /* ENABLED                                                                */
  /* --------------------------------------------------------------------- */

  /**
   * One verified date. The single safest device in the set: a year is a NUMBER,
   * so it is the one piece of copy the aligner cannot misspell, and it is a
   * statement about the narration rather than a claim about the picture.
   */
  P12: {
    id: 'P12',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: null,
    fallbackTemplateIds: [],
    job: 'single_historical_date',
    pictures: 1,
    /* `detail` lands at 1.18s; it is always '' today, so the year at 0.9s rules. */
    buildEndFrames: 36,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    /*
     * UNCAPPED, AND THE CLIENT'S OWN RULE IS WHY.
     *
     * ####################################################################
     * # HIS WORDS ON P12 ARE "maintain this text overlay", said about    #
     * # both of the ones he was shown, and `handoff/style-rules.md`      #
     * # reduces them to "A YEAR OR A DATE ALWAYS TAKES P12 ... a year    #
     * # that misses P12 is a defect, not a fallback."                    #
     * #                                                                  #
     * # A CAP OF 3 CONTRADICTS THE WORD "ALWAYS", and the contradiction  #
     * # was live rather than theoretical. The delivered 118-beat plan    #
     * # speaks SIX dates and drew three of them as P12; scene 55's       #
     * # "1997" came out as the `note` style he rejected, and that scene  #
     * # is the example the style rules single out by name.               #
     * #                                                                  #
     * # THE 3 WAS NOT HIS. `capSource` says `unstated` — his PDF ends    #
     * # mid-entry and names a hard rule for four devices only, none of   #
     * # them this one. So it was a house number, invented, and it was    #
     * # refusing a written instruction.                                  #
     * #                                                                  #
     * # WHY UNCAPPING THIS CANNOT FLOOD A FILM, which is the fair        #
     * # question after the photo-pop result: G14 refuses P12 on any beat #
     * # whose jobs do not include `single_historical_date`, and that job #
     * # needs a `bareYear` or `eraFigure` mark that was HEARD in the     #
     * # shot and spelled the same way in the script. Six of 118 beats    #
     * # clear that. photo-pop had no such gate — its `buildCopy` returns #
     * # unconditionally — which is exactly why raising ITS cap bought    #
     * # twenty-two more photo-pops and no variety at all.                #
     * #                                                                  #
     * # G12 still refuses two P12s on ADJACENT beats, so the partner's   #
     * # "do not repeat the same template immediately" survives this.     #
     * ####################################################################
     *
     * A CAP OF 3 WAS TRIED ON 2026-09-05 AND MEASURED TO BUY NOTHING. REVERTED
     * THE SAME DAY, AND THE MEASUREMENT IS WRITTEN DOWN SO IT IS NOT RETRIED.
     *
     * ####################################################################
     * # THE ARGUMENT FOR THE CAP WAS FAIR AND THE MEASUREMENT KILLED IT. #
     * # The case: the 2:59.9 review cut drew FOUR P12s out of thirteen   #
     * # devices, 31% of a film's animation from one template, against a  #
     * # client complaint of "I still saw the exact same 2-3 animations". #
     * #                                                                  #
     * # RUN THROUGH THE REAL CHOOSER OVER THE REAL 86-BEAT FIXTURE, P12  #
     * # DREW EXACTLY THREE TIMES UNCAPPED AND EXACTLY THREE TIMES AT A   #
     * # CAP OF 3. The ceiling binds on nothing. It buys zero frames, and #
     * # the only thing it still does is contradict a written client rule #
     * # this repo records in two places — a year that misses P12 is a    #
     * # defect, not a fallback. A rule that costs an instruction and     #
     * # returns no frame is not a trade, it is a loss.                   #
     * #                                                                  #
     * # THE 4-OF-13 OBSERVATION IS NOT DENIED, IT IS RE-AIMED. Four date #
     * # beats inside three minutes is a SUPPLY fact about that script,   #
     * # and clipping the fourth deletes an animation from a film whose   #
     * # complaint was that it had too few. What that observation really  #
     * # points at is WHERE the devices land, not how many exist, and     #
     * # distribution is answered by the spacing term in                  #
     * # `deviceChoice.ts` rather than by a number in this file.          #
     * ####################################################################
     */
    maxPerFilm: null,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    /*
     * 0.75, RENDERED AND CHECKED, REPLACING A GUESSED 0.55.
     *
     * ####################################################################
     * # I GAVE THIS TEMPLATE THE STRICTEST FLOOR OF THE THREE AND IT IS  #
     * # THE BEST PROTECTED OF THEM. `P12.tsx` grades its picture at      #
     * # `brightness(0.72)` — DARKER than P03's 0.82 — then lays two      #
     * # gradients over it, the 90deg one reaching rgba(7,6,5,0.58) at    #
     * # the right edge, which is exactly where the year sits. Then an    #
     * # inset vignette at 0.42 and a textShadow under the figure itself. #
     * #                                                                  #
     * # Rendered over the brightest picture in the sourced set, measured #
     * # at 0.82 mean luma, the year reads cleanly. So 0.75 is            #
     * # conservative rather than optimistic, and 0.55 was refusing beats #
     * # this template handles comfortably.                               #
     * #                                                                  #
     * # THIS WAS THE MOST EXPENSIVE SINGLE NUMBER IN THE FILE. Over the  #
     * # full 86-beat narration `picture-too-bright` was the largest      #
     * # refusal bucket of all, and most of it was this line.             #
     * ####################################################################
     */
    maxMeanLuma: 0.75,
    minMeanLuma: null,
    carriesOwnGrade: true,
  },

  /** One named detail, on an opaque cream plate with a leader line. */
  P17: {
    id: 'P17',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: '4_1-22_P17-pinpoint-callout.mp4',
    fallbackTemplateIds: ['pointer-label', 'framed-card'],
    job: 'one_named_detail',
    pictures: 1,
    /* The label plate lands at 1.38s. */
    buildEndFrames: 42,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    maxPerFilm: 3,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'opaquePlate',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: true,
  },

  /** One complete highlighted word or number inside a spoken line. */
  P03: {
    id: 'P03',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: '1_0-10_P03-highlight-text.mp4',
    fallbackTemplateIds: ['photo-pop', 'framed-card'],
    job: 'single_word_or_number_emphasis',
    pictures: 1,
    buildEndFrames: 55,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    /*
     * UNCAPPED, FOR THE SAME REASON AS P12 AND WITH THE SAME NATURAL LIMIT.
     *
     * ####################################################################
     * # HIS WORDS: "this text overlay is perfect always use this in a    #
     * # Major mention or another chapter of the story." A cap of three   #
     * # is the opposite of "always use this", and the 3 was `unstated` — #
     * # a house number, not one of the four he actually wrote down.      #
     * #                                                                  #
     * # It was binding. Over the delivered 118 beats P03 was refused on   #
     * # `per-film-cap-reached` twenty-four times, and three of the beats  #
     * # it could not reach were drawn instead as the `note` style he      #
     * # rejected: "Book of the Watchers", "Chapter 39" and "Chapters 102  #
     * # through 104" — the exact beats rule 3 is about.                  #
     * #                                                                  #
     * # AND IT CANNOT FLOOD, WHICH IS THE PART THAT MATTERS. P03 needs    #
     * # TWO marks off one beat: a highlight, plus a kicker sharing no     #
     * # word with it, both heard in the shot and both spelled as the      #
     * # script spells them. It also needs a headline that draws inside    #
     * # `P03_CONTENT_MAX_WIDTH`. Measured over the real 118 beats, that   #
     * # copy gate alone holds it well below where a cap would have bitten #
     * # — the ceiling is the narration, not a number in this file.        #
     * ####################################################################
     */
    maxPerFilm: null,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    /*
     * 0.72, NOT P12's 0.55, AND THE DIFFERENCE IS THREE DRAWN LAYERS.
     *
     * An earlier cut gave every type-over-picture template the same number,
     * which is wrong in P03's favour: it is by far the best protected of the
     * three. `P03.tsx` applies `brightness(0.82)` to the photograph, then a
     * centre-weighted radial reaching `rgba(0,0,0,0.42)` at 72%, then an inset
     * vignette of `rgba(0,0,0,0.55)` over 180px, and only then sets type with
     * its own `textShadow`. P12 carries one scrim.
     *
     * The template's own measurement note says those layers "put the whole
     * photograph below the threshold". Copying P12's figure across refused P03
     * on three of ten beats in the first real run — pictures at 0.60 and 0.65 —
     * which is the template doing nothing on beats it was built for.
     *
     * RENDERED AND LOOKED AT, at 0.70, and the type reads clearly — the ivory
     * headline and the gold highlight both hold against the darkened picture.
     *
     * WHAT THAT RENDER DID NOT PROVE, said plainly rather than left implied: the
     * test picture was dense newsprint, so it is busy but not SMOOTH AND BRIGHT.
     * A pale empty sky at 0.70 is the real worst case and has not been tried.
     * The three layers are picture-independent, which is why the number is
     * defensible, but if a render ever reads thin this is the first thing to
     * re-measure rather than the last.
     */
    maxMeanLuma: 0.72,
    minMeanLuma: null,
    carriesOwnGrade: true,
  },

  /**
   * Four related stills in a 2x2 mosaic.
   *
   * The only device of the twenty-three that needs NO written copy, NO external fact
   * and nothing from a model. Its whole contract is four pictures. (P08 writes no
   * copy either, but it draws only where a planner row asked for it.)
   */
  P22: {
    id: 'P22',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: '6_1-38_P22-four-image-mosaic.mp4',
    /**
     * `gallery-strip` WAS THE NEXT LINK HERE AND IT HAD TO COME OUT.
     *
     * ####################################################################
     * # A8 IS A MANDATORY OPENING BEAT, NOT A RESCUE. `FALLBACK_WAIVES`   #
     * # contains `beat-too-long`, so a walk that reached a8 could place   #
     * # it on a 238-frame beat — and every geometry function in its clock #
     * # is frozen from frame 131, so that is 107 frames, 3.6 seconds, of  #
     * # a still photograph. Saku 0.3 forbids exactly that: "Do not leave  #
     * # a long empty hold after the images and labels have appeared."     #
     * #                                                                   #
     * # It is also the wrong PICTURES. a8 is `pictureSource:              #
     * # 'filmPreview'`, so rescuing it onto a beat means previewing later #
     * # content from somewhere the opening rule never sanctioned.         #
     * #                                                                   #
     * # Removing it from three chains costs nothing measurable: over the  #
     * # real 118-beat film the walk reached a8 three times and refused it #
     * # on picture supply all three.                                      #
     * ####################################################################
     */
    fallbackTemplateIds: ['gallery-strip', 'photo-pop'],
    job: 'four_source_mosaic',
    pictures: 4,
    /* The last tile finishes arriving at 4.10s. */
    buildEndFrames: 123,
    holdsWellFrames: 300,
    defaultDurationFrames: 210,
    /*
     * RAISED TO 4 ON 2026-09-05 AND REVERTED THE SAME DAY. The full record of
     * why every one of that day's raises came back is on photo-pop's cap below.
     *
     * ####################################################################
     * # THE SHORT VERSION, BECAUSE IT APPLIES TO THIS DEVICE HARDEST. G2 #
     * # asks P22 for FOUR pictures — its own plus three companions — so  #
     * # on the real fixture the beat's picture supply, and not this      #
     * # number, is what refuses it. Raising a ceiling that is not the    #
     * # binding constraint cannot change a frame, and measured over the  #
     * # 86-beat fixture it did not.                                      #
     * ####################################################################
     */
    maxPerFilm: 2,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'none',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: true,
  },

  /**
   * Three cards pinned to a board, joined by red string. FOUR pictures, not
   * three — the board is a photograph too, and the partner's own registry says
   * `sourceCount: 3` while listing four assets.
   */
  P19: {
    id: 'P19',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: '5_1-32_P19-red-string-board.mp4',
    /**
     * `gallery-strip` WAS THE NEXT LINK HERE AND IT HAD TO COME OUT.
     *
     * ####################################################################
     * # A8 IS A MANDATORY OPENING BEAT, NOT A RESCUE. `FALLBACK_WAIVES`   #
     * # contains `beat-too-long`, so a walk that reached a8 could place   #
     * # it on a 238-frame beat — and every geometry function in its clock #
     * # is frozen from frame 131, so that is 107 frames, 3.6 seconds, of  #
     * # a still photograph. Saku 0.3 forbids exactly that: "Do not leave  #
     * # a long empty hold after the images and labels have appeared."     #
     * #                                                                   #
     * # It is also the wrong PICTURES. a8 is `pictureSource:              #
     * # 'filmPreview'`, so rescuing it onto a beat means previewing later #
     * # content from somewhere the opening rule never sanctioned.         #
     * #                                                                   #
     * # Removing it from three chains costs nothing measurable: over the  #
     * # real 118-beat film the walk reached a8 three times and refused it #
     * # on picture supply all three.                                      #
     * ####################################################################
     */
    fallbackTemplateIds: ['P22', 'gallery-strip'],
    job: 'connected_three_source_evidence',
    pictures: 4,
    /* The last string segment finishes drawing at 2.52s. */
    buildEndFrames: 76,
    holdsWellFrames: 300,
    defaultDurationFrames: 180,
    /*
     * RAISED TO 4 ON 2026-09-05 AND REVERTED THE SAME DAY, ALONGSIDE P22'S.
     * This is the most gated device in the file — the same four pictures P22
     * wants AND a board over `minMeanLuma` 0.45 — so its ceiling was never the
     * thing refusing it, and lifting the ceiling moved nothing. The whole
     * measurement is on photo-pop's cap below.
     */
    maxPerFilm: 2,
    capSource: 'unstated',
    /**
     * IT WANTS A LIGHT, QUIET BOARD and nothing errors when it does not get one.
     * The partner's own preview uses an antique map. Handed a busy dark
     * photograph the mechanics render identically and the three cards simply
     * stop reading as pinned to anything. So the gate is on the BOARD's luma,
     * from the low side, which is why this is the one `minMeanLuma` case and it
     * is enforced in `deviceChoice.ts` rather than expressible here.
     */
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'none',
    scrimAlpha: 0,
    maxMeanLuma: null,
    /*
     * A LIGHT BOARD, which is what the cards are pinned to.
     *
     * ####################################################################
     * # 0.45 -> 0.40, AND A RENDER SAID WHERE THE EDGE IS.                #
     * #                                                                  #
     * # The number this replaces was, in its own words, "the middle of    #
     * # the range, chosen rather than measured", and it asked to be       #
     * # revisited when a render could say better. This is that render.    #
     * #                                                                  #
     * # Job c75d51e6 scene 46 is the client's own example — "when these   #
     * # three sections are read together", 153.3s. Once the counted-      #
     * # plural rule existed the beat matched this device's job, cleared   #
     * # the picture count and the companion floor, and was refused HERE   #
     * # at meanLuma 0.42. It missed by three hundredths.                  #
     * #                                                                  #
     * # Rendered that beat's own four pictures through the P19 harness on #
     * # the laptop, board first: the 0.42 board reads plainly, and all    #
     * # three cards read as pinned to it with the string legible across   #
     * # them. The failure this gate exists to stop — cards floating on a  #
     * # ground too dark to be a board — does not happen at 0.42.          #
     * #                                                                  #
     * # 0.40 RATHER THAN 0.42, so the client's own shot is not sitting on #
     * # the boundary the way it sat on the old one.                       #
     * #                                                                  #
     * # NO TEST PROTECTS THIS NUMBER. deviceChoice.test.ts passes at 0.7  #
     * # and fails at 0.2, so anything in between stays green and a green  #
     * # suite is not evidence here. The frame is the evidence.            #
     * ####################################################################
     */
    minMeanLuma: 0.4,
    carriesOwnGrade: true,
  },

  /**
   * Four cards on a strip, the camera opening on the LAST and travelling left.
   * Its badges are ordinals the device generates from the card index, so it
   * needs no written copy at all.
   */
  'gallery-strip': {
    id: 'gallery-strip',
    /*
     * ##########################################################################
     * # THE HOLD IS LIFTED — 2026-08-30. IT WAS ABOUT WHERE THIS DEVICE       #
     * # LANDED, AND WHERE IT LANDS IS NOW COMPUTED RATHER THAN STUMBLED ON.   #
     * #                                                                       #
     * # WHAT THE HOLD SAID, so nobody re-argues it: replayed at HEAD the      #
     * # gallery went to beat 72, 5:54.9 of an 8m46s film, which breaks four   #
     * # sentences Saku 0.3 writes including "Use A8 once near the beginning   #
     * # of every video". Two faults put it there, and BOTH are now fixed:     #
     * #                                                                       #
     * #   1. `firstPassageEndMs` scanned SCENE SEAMS, so it could only see a  #
     * #      passage end that a scene cut happened to land on. Measured over  #
     * #      30 jobs it answered 42770 on 6, 264210 on 2 and null on 4 — two  #
     * #      runs of the SAME script disagreeing by 3m41s. It now walks the   #
     * #      NARRATION's own sentence ends and answers 42770 on all 30,       #
     * #      across 12 different segmentations. And `hookEndMs` now exists    #
     * #      beside it, so Saku's FIRST branch is reachable at all: the hook  #
     * #      ends at 34370ms on "do the dead remember us?".                   #
     * #                                                                       #
     * #   2. There was exactly ONE beat before 6:00 both 131..150 frames and  #
     * #      starting on a finished sentence, and it was beat 72 itself. The  #
     * #      pipeline no longer waits for one: `cutCarrierAt` CUTS a          #
     * #      131-frame carrier at the boundary out of the beats around it,    #
     * #      preserving total frames, and returns null on any doubt so the    #
     * #      old behaviour is still the fallback.                             #
     * #                                                                       #
     * # THE DRAWING WAS NEVER THE PROBLEM AND STILL IS NOT.                   #
     * # `tmp/a8-host-2026-08-30.mp4` was opened frame by frame: the camera    #
     * # opens inside card 4, all four cards are co-visible at the pan         #
     * # midpoint, and the payoff zoom into card 1 lands at 130 and holds.     #
     * #                                                                       #
     * # `buildEndFrames` IS THE LENGTH IT IS CUT AT, NOT `defaultDurationFrames`.
     * # 150 appends 20 byte-identical frozen frames, and those 20 dead frames #
     * # cost the P12 "364 CE" card the frames it needs. See the box on        #
     * # `buildEndFrames` below for why 131 and not 105.                       #
     * #                                                                       #
     * # AND THE THIRD EDIT IS STILL MANDATORY, in the other direction now:    #
     * # an ENABLED device with no branch in `DeviceFrame.tsx` fails           #
     * # `inert.test.ts`, exactly as a disabled one still reachable from the   #
     * # render bundle does. That two-way guard is why the hold lived on       #
     * # `enabled` and not on `maxPerFilm`, which is ALSO the only record in   #
     * # the repo of his written "MAX 1 time" — his PDF is gitignored.         #
     * ##########################################################################
     */
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a8_gallery-strip.mp4',
    fallbackTemplateIds: ['P22', 'photo-pop'],
    job: 'four_source_mosaic',
    pictures: 4,
    /**
     * 131, WHERE THE CAMERA STOPS, NOT 105, WHERE THE BADGE FADES.
     *
     * ####################################################################
     * # 105 WAS THE CHIP EXIT AND IT IS THE WRONG ELEMENT. The pan runs   #
     * # to frame 130 and the payoff zoom into card 1 finishes there. Cut  #
     * # at exactly 105 and the shot ends on a fully opaque badge with the #
     * # move the whole animation exists for never drawn.                  #
     * #                                                                   #
     * # Measured: every geometry function in `galleryStripClock.ts`       #
     * # returns byte-identical values from frame 131 out to frame 600, so #
     * # 131 is both the first honest length AND the first frozen frame.   #
     * # With `holdsWellFrames` at 150 the window is 131..150, which is    #
     * # 4.37s to 5.00s, inside Saku 0.3's "roughly 4-8 seconds" and far   #
     * # under his "absolute maximum is 15 seconds". Anything past 150 is  #
     * # the "long empty hold after the images have appeared" he forbids.  #
     * ####################################################################
     */
    buildEndFrames: 131,
    holdsWellFrames: 150,
    defaultDurationFrames: 150,
    /**
     * HIS WORDS, and BOTH authorities are satisfied by 1.
     *
     * The client's own PDF: "HARD RULE: used MAX 1 time during the entire
     * video." Saku 0.3 PERMITS a later reuse — "A8 may be used again later when
     * the narration introduces a separate ordered gallery of 3-4 related
     * examples" — but permits is not requires, so 1 contradicts neither. Nothing
     * here can detect "a separate ordered gallery" in any case.
     */
    maxPerFilm: 1,
    capSource: 'niku-pdf',
    /**
     * HIS WORDS: "it comes during the first paragraph or right after it", and in
     * Saku 0.3, "If a distinct hook exists, insert A8 immediately after the hook
     * ends." Read against the plan's own detected opening boundary rather than a
     * scene index — the client's relayed rule forbids the latter by name:
     * "Detect boundaries using sentence completion, pauses, topic changes, and
     * narration structure, NOT fixed time limits."
     */
    positionRule: 'openingOnly',
    /**
     * THE ONE DEVICE WHOSE PICTURES ARE NOT ITS OWN BEAT'S. Saku 0.3: "Use 3-4
     * still images from real content that appears LATER in the video."
     */
    pictureSource: 'filmPreview',
    /** Saku 0.3, four times over: "The opening A8 use is mandatory." */
    mandatoryOnce: true,
    typeOverPicture: 'none',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * One picture in a frame with a caption on the film's own black ground, so it
   * sets no type over the photograph at all.
   *
   * THE ONE DEVICE THE CLIENT EXPLICITLY DECLARED UNCAPPED: "Does not have a
   * hard rule." `maxPerFilm: null` therefore means UNLIMITED, and every gate
   * that reads it must test for null FIRST — `0 >= null` coerces to true in
   * JavaScript and would silently refuse the one device he left open.
   */
  'framed-card': {
    id: 'framed-card',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a6_framed-card.mp4',
    /**
     * HIS ONE LINK, AND IT STAYS HIS ONE LINK.
     *
     * ####################################################################
     * # `P22` WAS APPENDED HERE ON 2026-09-05 AND REVERTED THE SAME DAY,  #
     * # BECAUSE IT REGRESSED THE OPENING FRAME OF THE FILM.               #
     * #                                                                  #
     * # THE MECHANISM, MEASURED RATHER THAN REASONED. Beat 0 wants        #
     * # photo-pop; photo-pop refuses on `beat-too-long`; the walk reaches #
     * # framed-card, and framed-card's chain is consulted from the FRONT. #
     * # With P22 on it the beat went to a wordless mosaic BEFORE P03 was  #
     * # ever reached — so the film's first frames lost kicker             #
     * # "Jerusalem" over headline "Israel Antiquities Authority", both    #
     * # spoken word for word in that shot's own narration, and got a      #
     * # picture with no writing on it instead.                            #
     * #                                                                  #
     * # THE CLAIM MADE FOR THE APPEND WAS THAT IT ONLY FIRES ONCE         #
     * # photo-pop IS SPENT. At beat 0 nothing is spent yet, so the claim  #
     * # is false: a chain is walked on REFUSAL, and a refusal on the      #
     * # first beat of the film is still a refusal. An appended link is    #
     * # not "last resort", it is "earlier than everything after it".      #
     * #                                                                  #
     * # THE PROBLEM IT WAS AIMED AT IS REAL — past photo-pop's cap an     #
     * # extra framed-card refusal deletes an animation rather than        #
     * # substituting one. The answer is to stop spending the cap in the   #
     * # first quarter of the film, which is a question of ORDER, and the  #
     * # spacing term in `deviceChoice.ts` is where it is answered. It is  #
     * # not a question of which device is bolted on the end of a chain    #
     * # the partner wrote.                                                #
     * ####################################################################
     */
    fallbackTemplateIds: ['photo-pop'],
    job: 'source_inspection',
    pictures: 1,
    buildEndFrames: 25,
    /*
     * THE LEAST-EVIDENCED NUMBER IN THIS FILE, AND IT IS DELIBERATELY THE
     * STRICT READING.
     *
     * Unlike photo-pop above, this one really is frozen: `framedCardWindow` and
     * `framedCardCaptionReveal` are both CLAMPED, there is no exit fade, and
     * `FramedCard.tsx` contains no per-frame transform of any kind — measured at
     * under 0.005px of drift. So a beat longer than this delivers seconds of a
     * dead-still frame in a film where every other shot carries a camera move.
     *
     * 120 is its 90-frame reference plus a second of headroom. It is a JUDGEMENT
     * rather than a measurement, and it is the reason this device does not
     * appear in a film whose beats run 165-192 frames. ONE RENDER SETTLES IT:
     * render it at 180 and look at whether the hold reads as a held shot or as a
     * frozen one. Do not widen it from the selection report alone — tuning a
     * constant to make more devices place is exactly backwards.
     *
     * ######################################################################
     * # STILL 120, AND NOW MEASURED RATHER THAN ONLY ASSERTED.             #
     * #                                                                    #
     * # Over the 39 real beats of `tmp/v11/plan-v13.json` this ceiling is   #
     * # the single most active gate in the file: it refuses framed-card on  #
     * # 21 OF 39 BEATS, more than half the film, and 38 device-refusals     #
     * # across the run carry `beat-too-long`. The partner's rule 9 says     #
     * # "numeric ranges are DEFAULTS unless they are explicitly marked as   #
     * # hard limits", and not one of his fifteen templates carries          #
     * # `durationIsHardLimit: true` — his own usual maximum is 8 seconds,   #
     * # which is 240 frames.                                               #
     * #                                                                    #
     * # SO THE NUMBER DID NOT MOVE AND ITS POWER DID: `deviceChoice.ts`     #
     * # waives `beat-too-long` inside the fallback walk only. See the box   #
     * # on G4. Widening the constant instead was MEASURED and it buys       #
     * # NOTHING — deleting the refusal outright places the same 12 beats,   #
     * # and it loses the `fallbackFrom` mark that tells a human which beat  #
     * # took a substitute. This note is the evidence the old one asked for,  #
     * # and it points the same way: leave 120 alone until a render says     #
     * # otherwise.                                                          #
     * ######################################################################
     */
    holdsWellFrames: 120,
    defaultDurationFrames: 90,
    maxPerFilm: null,
    capSource: 'niku-pdf',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'ownGround',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * One picture, ZERO written strings. Nothing here can be misspelled, mistyped
   * or invented, which makes it the device whose selection is easiest to defend.
   */
  'photo-pop': {
    id: 'photo-pop',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a9_photo-pop.mp4',
    fallbackTemplateIds: ['framed-card', 'P03'],
    job: 'source_inspection',
    pictures: 1,
    buildEndFrames: 61,
    /*
     * MEASURED, REPLACING A GUESS. An earlier cut set this to 120 — its own
     * reference length — on the reasoning that "the card scale runs unbounded
     * past the pop, so a long beat over-zooms". The arithmetic says otherwise.
     *
     * Past `popEndFrame` 61 the scale is `1 + (frame - 61) * 0.00007724`
     * (`photoPopClock.ts`). At 270 frames that is 1.0161 — SIX-TENTHS of a
     * percent per second, against the film's own Ken Burns which travels from
     * 1.00 to 1.08. So the "unbounded" tail is a slower push than every other
     * shot in the film, which is the restrained motion the partner's rulebook
     * asks for rather than a degradation.
     *
     * 270 is `MAX_PICTURE_RUN_FRAMES`, the longest run the planner will give any
     * picture, so this ceiling now binds on nothing the planner can produce.
     */
    holdsWellFrames: 270,
    defaultDurationFrames: 120,
    /*
     * THREE, AND DELIBERATELY NOT RAISED WHILE P12 AND P03 WERE.
     *
     * ####################################################################
     * # THIS IS THE ONE CAP THAT IS LOAD-BEARING, and it is load-bearing  #
     * # because photo-pop is the only enabled device whose `buildCopy`    #
     * # RETURNS UNCONDITIONALLY. It needs no mark, no date, no anchor and #
     * # no second picture, so nothing downstream of the cap narrows it.   #
     * #                                                                   #
     * # MEASURED: raising it to 99 alongside P03 and P12 moved placements #
     * # from 13 to 35 and TWENTY-TWO OF THE TWENTY-TWO new ones were      #
     * # photo-pop. That is the exact opposite of the client's "use        #
     * # different style in those animations and clips".                   #
     * ####################################################################
     *
     * 3 -> 4 WAS TRIED ON 2026-09-05 AND REVERTED THE SAME DAY, WITH THE RAISES
     * ON P22 AND P19 AND THE EXTRA LINK ON framed-card's CHAIN. This is the
     * long-form record of that measurement, because it is the argument against
     * the next person who reaches for a bigger number to fix the drought.
     *
     * ####################################################################
     * # THE DROUGHT IS REAL AND IS NOT IN DISPUTE. The 2:59.9 cut carries #
     * # thirteen devices, nine of them in the first 52 seconds, and three #
     * # stretches of 33.4s, 49.4s and 30.9s with NO device at all — 113.7 #
     * # seconds, 63% of the film, with nothing moving. Everything below   #
     * # is about the REMEDY, not about the finding.                       #
     * #                                                                  #
     * # RAISING CEILINGS MOVES THE DROUGHT, IT DOES NOT RELIEVE IT.       #
     * # Measured with the real chooser over the real 86-beat fixture,     #
     * # once at these values and once at the raised ones:                 #
     * #                                                                  #
     * #   placements       19 -> 21 of 86 beats. THREE beats change, and  #
     * #                    beats 23 to 85 come out BIT-IDENTICAL.         #
     * #   longest dead run 14 beats -> 13. The second-longest does not    #
     * #                    move at all.                                   #
     * #   beats blocked by                                                #
     * #   a spent cap      25 -> 32. It went UP.                          #
     * #                                                                  #
     * # THAT LAST LINE IS THE WHOLE LESSON. The chooser walks beats in    #
     * # ORDER and takes the first that fits, so a raised ceiling is spent #
     * # EARLIER, and more of the tail then sits behind an exhausted cap.  #
     * # Capacity is not the binding constraint on the back two thirds of  #
     * # a film. ORDER is. The spacing term in `deviceChoice.ts` is where  #
     * # that is answered, and an ordering cannot starve a shot the way a  #
     * # ceiling can.                                                      #
     * #                                                                  #
     * # SO 3 STAYS, and it stays for the reason in the box above rather   #
     * # than out of caution: this is still the only enabled device whose  #
     * # `buildCopy` returns unconditionally, so it is still the only one  #
     * # that eats a film when its ceiling is lifted.                      #
     * ####################################################################
     */
    maxPerFilm: 3,
    capSource: 'unstated',
    /*
     * NOT ON THE FIRST SHOT. HIS WORDS, ABOUT THIS DEVICE, ON THIS FILM:
     * "In the first 0:00-0:04 I don't want this show clip animations, the
     * previous sample is much better" — pointing at a full-frame P03.
     *
     * ####################################################################
     * # SCENE 0 OF THE DELIVERED PLAN IS photo-pop, 137 frames, 0:00 to   #
     * # 4.57s, which is his timestamp to the frame. It is a small inset   #
     * # card floating on a warped grid, and it is the first thing the     #
     * # film shows.                                                       #
     * #                                                                   #
     * # THE DEVICE IS NOT BANNED, ONLY THE POSITION. He approved all nine #
     * # of his own animations on 2026-08-24 with "Templates look great",  #
     * # and photo-pop still places freely from beat 1 onwards.            #
     * #                                                                   #
     * # A REFUSAL RATHER THAN A SCORE PENALTY, because he stated it as a  #
     * # rule and because the alternative is fragile: P03 now outscores    #
     * # photo-pop on the real scene 0 by about 8,400 of 100,000, which is #
     * # comfortable until one term is retuned and then it silently is     #
     * # not. If nothing else can take the opening, the opening draws no   #
     * # device — and eighty-seven bare scenes went past him unremarked.   #
     * ####################################################################
     */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'none',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * TEMPLATE 05, SHADOW-UP. ONE SHORT LINE OF THE NARRATION'S OWN WORDS THAT
   * RISES FROM BEHIND THE BOTTOM EDGE OF A DARK STILL AND SETTLES THERE.
   *
   * ##########################################################################
   * # APPROVED IN SAKU'S REFERENCE LIBRARY, "Approved, measured upward       #
   * # entrance locked" (docs/Remotion-Reference-Template-Library/README.md). #
   * # Ruling R3 puts it in V52. It answers the second half of the client's  #
   * # note 3 on V50: "Different variations of text animations".             #
   * #                                                                        #
   * # FED ONLY BY THE VISUAL PLANNER, like bullet-checklist. Its job,        #
   * # `one_line_fact`, is pushed by no mark rule, so G14 refuses it on every #
   * # beat the planner did not ask for it. Its line must pass the same       #
   * # spoken check as P03's written pair, fit the title-safe width by the    #
   * # face's own advances (`shadowUpFit.ts`), carry no year (T-2), and sit   #
   * # on a picture dark enough and good enough to be named (T-7, T-8).       #
   * #                                                                        #
   * # THE FACE IS BEBAS NEUE AT WEIGHT 400, NOT HIS DIN CONDENSED BOLD,      #
   * # which is not in the repo and has no licence recorded in it. Bebas is   #
   * # bundled, OFL, and matched on cap height at 104 px. Its one weight is   #
   * # 400; asking Chrome for 700 emboldens outlines without widening them.  #
   * # Both were taken on the spec's recommended default and reported to      #
   * # the developer, who did not object. The compositor carries the drawing. #
   * ##########################################################################
   */
  'shadow-up': {
    id: 'shadow-up',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json`. 05 is in his reference library, which
     * has no registry file, and this is the id its own manifest gives it
     * (`manifest/05-shadow-up-animated-text-overlay.json`, its `id`).
     */
    officialFileName: 'reference-05-shadow-up-animated-text-overlay',
    /* His manifest names no fallback. Writing one would invent a line of his rulebook, as P12's and a3's boxes say. */
    fallbackTemplateIds: [],
    job: 'one_line_fact',
    pictures: 1,
    /*
     * ##########################################################################
     * # 60, HIS 2-SECOND FLOOR, NOT 26, WHERE THE RISE PHYSICALLY ENDS.         #
     * #                                                                        #
     * # The line is hidden for 5 frames and settles at frame 26 at 30 fps. 60   #
     * # is the bottom of his recommended 2 to 3.5 s, which leaves 34 frames,   #
     * # 1.1 s, of a settled line to read. a2's 87 already folds a hold into    #
     * # its build. G3 is never waived, so a shorter shot is refused rather     #
     * # than cut mid-read. Measured cost on V50's cut: 3 shots of 66.          #
     * ##########################################################################
     */
    buildEndFrames: 60,
    /* His "may be extended toward 5 seconds". V50's longest shot is 148 frames, so it never binds there. */
    holdsWellFrames: 150,
    /* His locked 2.2 s. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 66,
    /* His manifest sets no quota and allows reuse. Variety comes from G12 and the score. */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro". A 05 asked there would win on the planner's bonus. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'shadowOnly',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # 0.55, THE TITLE-SAFE CEILING, BECAUSE THIS TEMPLATE DRAWS NO SCRIM.    #
     * #                                                                        #
     * # It is the value of `TITLE_SAFE_MAX_MEAN_LUMA` in `source.ts`. P03 gets #
     * # 0.72 for three darkening layers and P12 0.75 for its gradients; 05    #
     * # draws white type, a dark copy of it 5 px lower and a drop shadow,     #
     * # straight on the photograph. At a flat 0.55 grey that reads about 3.3  #
     * # to 1 before the shadow, over this project's 3 to 1 floor. His still   #
     * # reads 0.045 in the band under the type.                               #
     * #                                                                        #
     * # WHAT IT CANNOT SEE: `meanLuma` is the whole picture, so a dark picture #
     * # with a bright floor passes. Read the band under the line on every     #
     * # 05 beat before a render, as TREATMENT-STANDARD.md T-7 says.           #
     * ##########################################################################
     */
    maxMeanLuma: 0.55,
    minMeanLuma: null,
    /* No colour treatment of its own, so the house grade goes on top, as it does for a3 and the client's animations. */
    carriesOwnGrade: false,
  },

  /**
   * P08, FULLSCREEN SOURCE EVIDENCE. ONE PICTURE THAT IS THE SOURCE, IN A GOLD
   * FRAME OVER A DARK BLURRED COPY OF ITSELF, WITH NO WORDS.
   *
   * ##########################################################################
   * # FROM THE ACCEPTED P-PACK, `approved_locked`, vendored with its lock    #
   * # verified (`apps/web/src/remotion/templates/P08.tsx` carries the hash). #
   * # The pack's rule: "Let one important source fill the frame and stay    #
   * # unobstructed", for "one document, manuscript, map, or archival still". #
   * #                                                                        #
   * # NO WORDS, BY THE DEVELOPER'S RULING. Its tag and detail name the       #
   * # source of the picture, and T-18 condition 2 forbids inventing that, so #
   * # the schema arm carries no string and the component omits both blocks.  #
   * #                                                                        #
   * # FED ONLY BY THE VISUAL PLANNER. Its job, `source_priority`, is pushed  #
   * # by no mark rule, so G14 refuses it on every beat the planner did not   #
   * # ask for it. That matters more for P08 than for 05, because its        #
   * # `buildCopy` returns unconditionally, and photo-pop's cap box records   #
   * # what an unconditional device does to a film when nothing narrows it.  #
   * #                                                                        #
   * # AND T-8 APPLIES THOUGH IT PRINTS NOTHING. The frame presents the       #
   * # picture as THE source, which is a claim about the picture, so          #
   * # `copyNamesThePicture` answers true and a picture scored under 6, or    #
   * # AI-generated (`plan.ts` nulls the score), is refused.                  #
   * ##########################################################################
   */
  P08: {
    id: 'P08',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json` in `script/`, which has no P08. This is
     * the `compositionId` the accepted pack's own registry and lock give it
     * (`templates/accepted_template_webapp_handoff/TEMPLATE_REGISTRY.json`).
     */
    officialFileName: 'P08FullscreenSource',
    /* The pack names no fallback. Writing one would invent a line of its rulebook, as P12's box says. */
    fallbackTemplateIds: [],
    job: 'source_priority',
    pictures: 1,
    /*
     * ##########################################################################
     * # 60: 20 FRAMES TO ARRIVE, 11 TO LEAVE, AND A SECOND OF THE SOURCE       #
     * # SETTLED BETWEEN THEM.                                                  #
     * #                                                                        #
     * # The frame is fully in at 0.35 s (frame 11) and the rule finishes at    #
     * # 0.65 s (frame 20). The exit fades over the last 0.35 s. So the         #
     * # shortest shot that shows the whole source standing still for about a  #
     * # second is 20 + 29 + 11 = 60. G3 is never waived, so a shorter shot is #
     * # refused rather than cut while the frame is still arriving.            #
     * ##########################################################################
     */
    buildEndFrames: 60,
    /*
     * 240, THE PACK'S USUAL MAXIMUM OF EIGHT SECONDS, as P12's is. The push runs
     * 1.8 percent over the whole shot whatever its length, so a long shot is a
     * slower push rather than a frozen one. V50's longest shot is 148 frames, so
     * it never binds there.
     */
    holdsWellFrames: 240,
    /* The pack's locked five seconds. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 150,
    /*
     * UNCAPPED, AND NOT FOR photo-pop's REASON TO CAP. The pack sets no quota.
     * photo-pop needed a ceiling because nothing else narrowed it; P08 needs a
     * planner row on the beat and a picture scored 6 or more, and the planner's
     * own section 6 holds any one template to a third of its rows.
     */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro", as it does for photo-pop and 05. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /* No type anywhere on the frame, so nothing to protect: G9 does not refuse a manuscript for having writing in it. */
    typeOverPicture: 'none',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # NO CEILING, AND A STILL OVER A BRIGHT PAGE IS WHY RATHER THAN A GUESS. #
     * #                                                                        #
     * # Rendered 2026-09-13 through `look-still.ts --device=P08` at frame 60,   #
     * # over a 16:9 band of storage's brightest judged manuscript, the Ethiopic #
     * # Enoch page (160fd22d, vision luma 0.90, the band 0.94). The framed page  #
     * # draws at 251 of 255 and reads plainly as a page in a frame: the border  #
     * # holds at 165 and the rule at 90 over a top band of 3. There is no type  #
     * # for brightness to wash out. The pack's own approved preview is a light  #
     * # page on white, so a bright source is the case it was built for.        #
     * # (tmp/v53/templates/P08/p08-bright-ethiopic-f60.png)                     #
     * ##########################################################################
     */
    maxMeanLuma: null,
    minMeanLuma: null,
    /* It grades both copies of its picture itself, so the house grade must not go on top, as for P12. */
    carriesOwnGrade: true,
  },

  /**
   * P04, THE RESTRAINED LOWER-LEFT LABEL. ONE PICTURE, FULL FRAME, AND A SMALL
   * IDENTIFIER AT THE LOWER LEFT: A GOLD RULE, THE LABEL, AND AN OPTIONAL SUPPORT
   * LINE UNDER IT.
   *
   * ##########################################################################
   * # FROM THE ACCEPTED P-PACK, `approved_locked`, vendored with its lock    #
   * # verified (`apps/web/src/remotion/templates/P04.tsx` carries the hash). #
   * # The pack's card: "a small source, date, place, or object identifier",  #
   * # and its contract: "never subtitle-length narration".                   #
   * #                                                                        #
   * # ITS WORDS NAME THE PICTURE, SO BOTH LINES ARE HELD TO THE DEVELOPER'S  #
   * # RULING. Every content word must be SPOKEN IN THIS SHOT'S OWN          #
   * # NARRATION, not the window around it, AND be in the picture's archive   #
   * # record. The label is refused otherwise; the support line is left off.  #
   * # Never a year (T-2), and measured against the real face, so a label     #
   * # that would take a third line is refused rather than cut.               #
   * #                                                                        #
   * # FED ONLY BY THE VISUAL PLANNER. Its job, `small_identification`, is    #
   * # pushed by no mark rule, so G14 refuses it on every beat the planner    #
   * # did not ask for it, and a film with no P04 row chooses as before.      #
   * #                                                                        #
   * # T-8 AND T-10 BOTH APPLY. `copyNamesThePicture` answers true, so a      #
   * # picture scored under 6 is refused, and so is every AI frame, which     #
   * # `plan.ts` gives a null score and no archive record at all.             #
   * ##########################################################################
   */
  P04: {
    id: 'P04',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json` in `script/`, which has no P04. This is
     * the `compositionId` the accepted pack's own registry and lock give it
     * (`templates/accepted_template_webapp_handoff/TEMPLATE_REGISTRY.json`).
     */
    officialFileName: 'P04LowerLeftLabel',
    /* The pack names no fallback. Writing one would invent a line of its rulebook, as P12's box says. */
    fallbackTemplateIds: [],
    job: 'small_identification',
    pictures: 1,
    /*
     * ##########################################################################
     * # 60: 17 FRAMES TO ARRIVE, 11 TO LEAVE, AND 32 OF THE LABEL SETTLED.     #
     * #                                                                        #
     * # The label fades in over 0.5 s and finishes its 16 px rise at 0.55 s    #
     * # (frame 17); the rule is drawn by 0.5 s. It fades out over the last     #
     * # 0.35 s. So the shortest shot that holds a settled label for just over #
     * # a second is 17 + 32 + 11 = 60, the same floor 05 and P08 keep. G3 is  #
     * # never waived, so a shorter shot is refused rather than cut mid-read.  #
     * ##########################################################################
     */
    buildEndFrames: 60,
    /*
     * 240, THE PACK'S USUAL MAXIMUM OF EIGHT SECONDS, as P08's and P12's are. The
     * 5 percent push runs over the whole shot whatever its length, so a long shot
     * is a slower push rather than a frozen one.
     */
    holdsWellFrames: 240,
    /* The pack's locked five seconds. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 150,
    /*
     * UNCAPPED. The pack sets no quota. P04 needs a planner row on the beat, a
     * label spoken in the shot and corroborated by the archive record, and a
     * picture scored 6 or more, which is narrower than any cap would be.
     */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro", as it does for photo-pop, 05 and P08. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /*
     * A SCRIM, AND IT IS THE PACK'S OWN: a bottom gradient reaching
     * rgba(9,7,4,0.74) at the foot of the frame, an inset vignette at 0.46 and a
     * text shadow under each line, over a picture graded to brightness 0.82. G9
     * therefore refuses a picture with writing burned into it under the label.
     */
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # NO CEILING, AND A STILL OVER PURE WHITE IS WHY RATHER THAN A GUESS.     #
     * #                                                                        #
     * # The pack's grade and scrim do not depend on the picture, so the         #
     * # brightest thing that can sit under the label is a white picture.       #
     * # Rendered 2026-09-13 through `look-still.ts --device=P04` at frame 60,   #
     * # with the tallest label the width gate allows (two lines and a support  #
     * # line), over flat pictures at 0.50, 0.65, 0.75, 0.85, 0.95 and 1.00.     #
     * # Each line's own glyph colour against the BRIGHTEST background beside   #
     * # it on the same rows, which is further from the vignette than the       #
     * # glyphs and so the pessimistic reading:                                 #
     * #                                                                        #
     * #   picture   label line 1   label line 2   support line               #
     * #    0.75        5.07           6.09           4.94                     #
     * #    0.85        4.18           5.07           4.22                     #
     * #    1.00        3.42           4.18           3.62                     #
     * #                                                                        #
     * # Every line clears this project's 3 to 1 floor over pure white, so no   #
     * # picture can take one under it. The two brightest real pictures in      #
     * # storage, both judged 0.90, read 3.42 and 4.0 on their worst line.      #
     * # (tmp/v53/templates/P04/measure-p04-contrast.out.txt)                   #
     * #                                                                        #
     * # WHAT THIS DOES NOT HOLD, said plainly. The 4 px gold rule is ornament   #
     * # and falls under 3 to 1 above a 0.60 picture. And the 23 px support     #
     * # line is small text: held to 4.5 to 1 instead, it would want a ceiling  #
     * # near 0.81. The project's floor for corner type is 3 to 1 over white,   #
     * # which is the bar used here.                                            #
     * ##########################################################################
     */
    maxMeanLuma: null,
    minMeanLuma: null,
    /* It grades its own picture, so the house grade must not go on top, as for P12 and P08. */
    carriesOwnGrade: true,
  },

  /**
   * P02, THE PREMIUM EDITORIAL CARD. ONE PICTURE, FULL FRAME, AND A PAPER CARD
   * THAT SLIDES IN AT THE LEFT WITH A SMALL LABEL OVER A LARGE HEADLINE.
   *
   * ##########################################################################
   * # FROM THE ACCEPTED P-PACK, `approved_locked`, vendored with its lock    #
   * # verified (`apps/web/src/remotion/templates/P02.tsx` carries the hash). #
   * # The pack's card: "Use a premium card when the statement deserves to   #
   * # feel important", for "a thesis, major claim, proof emphasis,          #
   * # quote/information emphasis, or section turn".                         #
   * #                                                                        #
   * # ITS WORDS ARE THE NARRATION'S, AS P03's WRITTEN PAIR IS. The planner's #
   * # headline is the headline and its kicker is the label. Every content    #
   * # word of each must be spoken in the window, neither may stop mid-phrase #
   * # or carry a year (T-2), and a line that IS a thing the scene names must #
   * # be that thing in the archive record. The headline is refused           #
   * # otherwise; the label is left off, and so is one that repeats a         #
   * # headline word or would wrap. Measured against the real face, so a      #
   * # headline that would take a fifth line is refused rather than cut.      #
   * #                                                                        #
   * # FED ONLY BY THE VISUAL PLANNER. Its job, `major_claim_or_section_turn`,#
   * # is pushed by no mark rule, so G14 refuses it on every beat the planner #
   * # did not ask for it, and a film with no P02 row chooses as before.      #
   * #                                                                        #
   * # T-8 AND T-10 APPLY, ON THE SAFE SIDE. A thesis is not a caption, but a #
   * # headline this large over a photograph still reads as being about it,   #
   * # so `copyNamesThePicture` answers true: a picture scored under 6 is     #
   * # refused, and so is every AI frame, which `plan.ts` gives a null score. #
   * ##########################################################################
   */
  P02: {
    id: 'P02',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json` in `script/`, which has no P02. This is
     * the `compositionId` the accepted pack's own registry and lock give it
     * (`templates/accepted_template_webapp_handoff/TEMPLATE_REGISTRY.json`).
     */
    officialFileName: 'P02EditorialCard',
    /* The pack names no fallback. Writing one would invent a line of its rulebook, as P12's box says. */
    fallbackTemplateIds: [],
    job: 'major_claim_or_section_turn',
    pictures: 1,
    /*
     * ##########################################################################
     * # 90: 35 FRAMES TO ARRIVE, 11 TO LEAVE, AND 44 OF THE CARD SETTLED.      #
     * #                                                                        #
     * # The card fades in over 0.35 s and finishes its slide from -820 px at   #
     * # 1.15 s (frame 35), and the rule grows with the slide. It fades out     #
     * # over the last 0.35 s. A headline of up to 46 characters is about      #
     * # eight words, more to read than P04's label, so it gets about a second  #
     * # and a half settled rather than one: 35 + 44 + 11 = 90, three seconds,  #
     * # which is also this film's median shot. G3 is never waived, so a        #
     * # shorter shot is refused rather than cut mid-read.                     #
     * ##########################################################################
     */
    buildEndFrames: 90,
    /*
     * 240, THE PACK'S USUAL MAXIMUM OF EIGHT SECONDS, as P04's and P08's are.
     * The 1.8 percent push runs over the whole shot whatever its length, so a
     * long shot is a slower push rather than a frozen one.
     */
    holdsWellFrames: 240,
    /* The pack's locked six seconds. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 180,
    /*
     * UNCAPPED. The pack sets no quota. P02 needs a planner row on the beat, a
     * headline spoken in the window that fits the card, and a picture scored 6
     * or more, which is narrower than any cap would be.
     */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro", as it does for photo-pop, 05, P08 and P04. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /*
     * AN OPAQUE PLATE, AND IT IS THE PACK'S OWN: the words sit on an off-white
     * paper card, never on the photograph. G9 still refuses a picture with
     * writing burned into it, as it does for every device that sets words.
     */
    typeOverPicture: 'opaquePlate',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # NO CEILING, AND A STILL OVER PURE WHITE IS WHY RATHER THAN A GUESS.     #
     * #                                                                        #
     * # The words sit on the card, never on the picture, so no picture can     #
     * # move their contrast. Rendered 2026-09-13 through                        #
     * # `look-still.ts --device=P02` at frame 60 with the tallest card the gate #
     * # allows, a label over a four-line headline, over a flat grey at 0.50,   #
     * # over pure white, and over the two brightest judged pictures in storage #
     * # (160fd22d and 770d8810, both 0.90). Against the paper, the same on all  #
     * # four:                                                                  #
     * #                                                                        #
     * #   headline  #26231f on #eee9dc   12.90 to 1                            #
     * #   label     #8d7353 on #eee9dc    3.68 to 1                            #
     * #   rule      gold on paper         2.55 to 1, ornament                  #
     * #                                                                        #
     * # WHAT A BRIGHT PICTURE DOES MOVE is the card's own edge. Over white the  #
     * # paper meets the graded picture at 1.77 to 1 on its right edge and 2.19  #
     * # on its top, against 5.60 and 6.43 over grey. The pack's 1 px border and #
     * # lower-right shadow still draw that edge, and the still shows it        #
     * # plainly. (tmp/v53/templates/P02/measure-p02-stills.out.txt)            #
     * #                                                                        #
     * # WHAT THIS DOES NOT HOLD, said plainly. The 19 px label reads 3.68 to 1, #
     * # over this project's 3 to 1 floor and under the 4.5 to 1 a small line    #
     * # would want. That is the pack's own colour on its own paper, so no       #
     * # ceiling on the picture could raise it.                                 #
     * ##########################################################################
     */
    maxMeanLuma: null,
    minMeanLuma: null,
    /* It grades its own picture, so the house grade must not go on top, as for P04 and P08. */
    carriesOwnGrade: true,
  },

  /**
   * P09, THE COMPACT QUESTION CARD. ONE PICTURE, FULL FRAME, AND A SMALL DARK
   * CARD AT THE LEFT WITH A SECTION LABEL OVER A QUESTION THE NARRATION ASKS.
   *
   * ##########################################################################
   * # FROM THE ACCEPTED P-PACK, `approved_locked`, vendored with its lock    #
   * # verified (`apps/web/src/remotion/templates/P09.tsx` carries the hash). #
   * # The pack's card: "Use a compact card to signal a real question or      #
   * # change of direction", for "a genuine section reset, question,          #
   * # consequence, or compact narrative turn".                               #
   * #                                                                        #
   * # ONLY WHERE THE NARRATION ASKS A QUESTION, BY THE DEVELOPER'S RULING.   #
   * # The planner's headline is the question and must be the END of a        #
   * # stretch of the narration that ends in a question mark, starting where  #
   * # that sentence or one of its clauses starts. Its content words must be  #
   * # spoken in the window, it may not stop mid-phrase or carry a year       #
   * # (T-2), and it is measured against the real face, so a question that   #
   * # would take a fourth line is refused rather than cut. The kicker is the #
   * # section label, held to P02's label rule, and left off when it fails.   #
   * #                                                                        #
   * # FED ONLY BY THE VISUAL PLANNER. Its job, `question_or_section_reset`,  #
   * # is pushed by no mark rule, so G14 refuses it on every beat the planner #
   * # did not ask for it, and a film with no P09 row chooses as before.      #
   * #                                                                        #
   * # T-8 AND T-10 APPLY, ON THE SAFE SIDE, as they do for P02. A question   #
   * # is not a caption, but 54 px type on a card over a photograph reads as  #
   * # being about it, so `copyNamesThePicture` answers true: a picture       #
   * # scored under 6 is refused, and so is every AI frame.                   #
   * ##########################################################################
   */
  P09: {
    id: 'P09',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json` in `script/`, which has no P09. This is
     * the `compositionId` the accepted pack's own registry and lock give it
     * (`templates/accepted_template_webapp_handoff/TEMPLATE_REGISTRY.json`).
     */
    officialFileName: 'P09CompactQuestion',
    /* The pack names no fallback. Writing one would invent a line of its rulebook, as P12's box says. */
    fallbackTemplateIds: [],
    job: 'question_or_section_reset',
    pictures: 1,
    /*
     * ##########################################################################
     * # 90: 32 FRAMES TO ARRIVE, 11 TO LEAVE, AND 47 OF THE QUESTION SETTLED.  #
     * #                                                                        #
     * # The card slides and fades in from 0.08 s to 0.72 s, the rule draws to  #
     * # 0.82 s, and the question finishes its 14 px rise at 1.05 s (frame 32). #
     * # Everything fades out over the last 0.35 s. A question of up to 51      #
     * # characters is about as much to read as P02's headline, so it gets the  #
     * # same second and a half settled: 32 + 47 + 11 = 90, three seconds. The  #
     * # shot that asks this film's one question runs 115 frames. G3 is never   #
     * # waived, so a shorter shot is refused rather than cut mid-read.         #
     * ##########################################################################
     */
    buildEndFrames: 90,
    /*
     * 240, THE PACK'S USUAL MAXIMUM OF EIGHT SECONDS, as P02's and P04's are.
     * The 2.5 percent push runs over the whole shot whatever its length, so a
     * long shot is a slower push rather than a frozen one.
     */
    holdsWellFrames: 240,
    /* The pack's locked five seconds. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 150,
    /*
     * UNCAPPED. The pack sets no quota. P09 needs a planner row on the beat, a
     * question the narration really asks that fits the card, and a picture
     * scored 6 or more. This film's script asks one question in 8,742
     * characters, which is narrower than any cap would be.
     */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro", as it does for photo-pop, 05, P08, P04 and P02. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /*
     * A SCRIM, NOT A PLATE, BECAUSE THE PICTURE SHOWS THROUGH IT. The pack's card
     * is rgba(16,16,14,0.70) over a picture graded to brightness 0.78, a left
     * gradient and an inset vignette, and its question carries a text shadow.
     * Thirty percent of the picture still reaches the words, so calling it
     * `'opaquePlate'` would be false. G9 therefore refuses a picture with writing
     * burned into it under the card.
     */
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # NO CEILING, AND A STILL OVER PURE WHITE IS WHY RATHER THAN A GUESS.     #
     * #                                                                        #
     * # The card is only 70 percent dark, so the picture DOES move the ground  #
     * # under the words, which is why this was measured rather than assumed.   #
     * # The pack's grade (brightness 0.78), its left gradient and the card     #
     * # hold it down: over pure white the card's interior beside the question  #
     * # reads 55,55,54 of 255. Rendered 2026-09-13 through                      #
     * # `look-still.ts --device=P09` at frame 60 with the tallest card the     #
     * # gate allows, a label over a three-line question, over flat pictures at #
     * # 0.50, 0.65, 0.75, 0.85, 0.95 and 1.00, and over the two brightest      #
     * # judged pictures in storage (160fd22d and 770d8810, both 0.90). Each    #
     * # line's glyph core against the BRIGHTEST pixel beside it in the card:   #
     * #                                                                        #
     * #   picture   question   label   gold rule                               #
     * #    0.50      13.28      7.17     6.12                                  #
     * #    0.85      10.70      5.79     4.92                                  #
     * #    1.00       9.93      5.29     4.51                                  #
     * #                                                                        #
     * # Every line clears 4.5 to 1 over pure white, the bar for SMALL text, so #
     * # the 15 px label is held as well as the 54 px question, and no picture  #
     * # can take a line under it. The two brightest real pictures read 9.93   #
     * # and 10.70 on the question. (tmp/v53/templates/P09/measure-p09-stills.out.txt) #
     * #                                                                        #
     * # WHAT A BRIGHT PICTURE DOES MOVE, said plainly. Thirty percent of a     #
     * # busy page still shows through behind the words: over the Ethiopic page  #
     * # its script is plainly visible inside the card. The glyph contrast holds #
     * # at 9.93, but that is texture a mean-luma ceiling would not measure, so  #
     * # a ceiling here would not remove it either. And the card's edge against  #
     * # the picture beside it grows with brightness, 1.85 to 1 over grey and    #
     * # 4.04 over white, so the card reads more plainly on a bright picture.    #
     * ##########################################################################
     */
    maxMeanLuma: null,
    minMeanLuma: null,
    /* It grades its own picture, so the house grade must not go on top, as for P02 and P04. */
    carriesOwnGrade: true,
  },

  /**
   * P05, TEXT LEFT AND A PICTURE RIGHT. ONE SHORT CLAIM IN A COLUMN ON THE
   * TEMPLATE'S OWN DARK GROUND, AND ONE PICTURE IN A GOLD-FRAMED SQUARE PANEL.
   *
   * ##########################################################################
   * # FROM THE ACCEPTED P-PACK, `approved_locked`, vendored with its lock    #
   * # verified (`apps/web/src/remotion/templates/P05.tsx` carries the hash). #
   * # The pack's card: "Keep the claim on the left and the supporting image  #
   * # large on the right", for "claim plus evidence, short statistic, one    #
   * # argument", and never where "the copy is only a label".                 #
   * #                                                                        #
   * # TWO EDITS TO THE LOOK, BY RULING. The panel is 770 by 770, not the      #
   * # pack's 770 by 820, because R1 refuses a picture narrower than square    #
   * # and the pack's picture box was 0.94. And the gold stroke closes at the  #
   * # earlier of the pack's five seconds and one second before the shot ends, #
   * # because the pack's five seconds were longer than any shot V50 held.     #
   * #                                                                        #
   * # ITS COLUMN IS THE NARRATION'S OWN WORDS, AS P02's CARD IS. The planner's #
   * # headline is the claim, its kicker the eyebrow and its first `lines`     #
   * # entry the support line; each must be spoken in the window, whole, and   #
   * # never a year (T-2). The headline is measured against the real face in    #
   * # capitals, so one that would take a fourth line is refused rather than   #
   * # cut; the other two are left off when they fail.                         #
   * #                                                                        #
   * # ITS PICTURE LABEL IS HELD TO THE DEVELOPER'S RULING FOR P04 AND P05     #
   * # LABELS. The planner's second `lines` entry, spoken in the carrying shot  #
   * # alone AND confirmed by the picture's archive record, or left off. Never #
   * # an invented name.                                                       #
   * #                                                                        #
   * # FED ONLY BY THE VISUAL PLANNER. Its job, `claim_with_supporting_image`, #
   * # is pushed by no mark rule, so G14 refuses it on every beat the planner  #
   * # did not ask for it, and a film with no P05 row chooses as before.       #
   * #                                                                        #
   * # T-8 AND T-10 APPLY. The label names the picture and the claim sits      #
   * # beside it as its evidence, so `copyNamesThePicture` answers true: a     #
   * # picture scored under 6 is refused, and so is every AI frame. G14f       #
   * # refuses a subject the square panel would crop away.                     #
   * ##########################################################################
   */
  P05: {
    id: 'P05',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json` in `script/`, which has no P05. This is
     * the `compositionId` the accepted pack's own registry and lock give it
     * (`templates/accepted_template_webapp_handoff/TEMPLATE_REGISTRY.json`).
     */
    officialFileName: 'P05TextLeftImageRight',
    /* The pack names no fallback. Writing one would invent a line of its rulebook, as P12's box says. */
    fallbackTemplateIds: [],
    job: 'claim_with_supporting_image',
    pictures: 1,
    /*
     * ##########################################################################
     * # 120: 38 FRAMES TO ARRIVE, 11 TO LEAVE, 71 SETTLED, AND A CLOSED FRAME. #
     * #                                                                        #
     * # The column fades and rises into place from 0.35 s to 1.25 s (frame 38) #
     * # and everything fades out over the last 0.35 s. P05 carries more to read #
     * # than P02's card: an eyebrow of up to 38 characters, a claim in 78 px    #
     * # capitals, a support line of up to 48 and a label of up to 48. So it     #
     * # gets about two and a half seconds settled rather than P02's one and a   #
     * # half: 38 + 71 + 11 = 120, four seconds.                                 #
     * #                                                                        #
     * # THE STROKE IS WHAT ELSE THE FLOOR BUYS. It closes one second before the #
     * # shot ends (`p05StrokeEndFrame` in `p05Type.ts`), so on 120 frames it    #
     * # draws its four edges over three seconds, 0.75 s each against the pack's #
     * # 1.25, and the whole frame holds for the pack's 0.65 s before the fade.  #
     * # A 90-frame floor would have drawn each edge in half a second.           #
     * #                                                                        #
     * # G3 is never waived, so a shorter shot is refused rather than cut        #
     * # mid-read.                                                               #
     * ##########################################################################
     */
    buildEndFrames: 120,
    /*
     * 240, THE PACK'S USUAL MAXIMUM OF EIGHT SECONDS, as P02's and P04's are.
     * The 4 percent push runs over the whole shot whatever its length, so a long
     * shot is a slower push rather than a frozen one, and past 180 frames the
     * stroke keeps the pack's own five seconds.
     */
    holdsWellFrames: 240,
    /* The pack's locked six seconds. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 180,
    /*
     * UNCAPPED. The pack sets no quota. P05 needs a planner row on the beat, a
     * claim spoken in the window that fits three lines of 78 px capitals, a
     * picture scored 6 or more and a subject near its middle, which is narrower
     * than any cap would be.
     */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro", as it does for photo-pop, 05, P08, P04, P02 and P09. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /*
     * ITS OWN GROUND, AS framed-card's AND bullet-checklist's ARE. The eyebrow,
     * headline and support line sit on the template's near-black grid, beside
     * the picture and never on it. The picture label is the one line that sits
     * on the photograph, on the pack's own 72 percent dark backing. G9 still
     * refuses a picture with writing burned into it, because every value but
     * `'none'` sets words and that label would sit on the writing.
     */
    typeOverPicture: 'ownGround',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # NO CEILING, AND STILLS OVER PURE WHITE ARE WHY RATHER THAN A GUESS.    #
     * #                                                                        #
     * # The column never sits on the picture, so no picture can move it.       #
     * # Rendered 2026-09-13 through `look-still.ts --device=P05` at frame 130, #
     * # the stroke closed and nothing fading, with the tallest column and the  #
     * # widest label the gates allow, over a flat grey at 0.50, over pure      #
     * # white, over Dead Sea Scroll 175 (fdb8d6aa) and over the two brightest  #
     * # judged pictures in storage (160fd22d and 770d8810, both 0.90). Each    #
     * # line's brightest ink against the ground beside it, the same on all:    #
     * #                                                                        #
     * #   headline      16.32 to 1                                             #
     * #   eyebrow       10.78 to 1                                             #
     * #   support line  11.10 to 1                                             #
     * #   gold rule      7.48 to 1                                             #
     * #                                                                        #
     * # THE LABEL IS THE ONE LINE A PICTURE CAN MOVE. It sits on the pack's    #
     * # 72 percent dark backing over the picture, which the pack's own filter  #
     * # holds to brightness 0.86. Its text against the backing's brightest     #
     * # pixel: 12.68 to 1 over grey, 8.22 over pure white, 8.22 and 9.00 over  #
     * # the two brightest judged pictures, and 7.75 over the scroll, whose     #
     * # bright texture sits right under the backing's top row. Every reading   #
     * # clears 4.5 to 1, the bar for small text, so no picture can take the    #
     * # 17 px label under it. (tmp/v53/templates/P05/measure-p05-stills.out.txt)#
     * ##########################################################################
     */
    maxMeanLuma: null,
    minMeanLuma: null,
    /* It grades its own picture inside the panel, so the house grade must not go on top, as for P02, P04 and P09. */
    carriesOwnGrade: true,
  },

  /**
   * P14, THE FAST YEAR ODOMETER. ONE PICTURE, FULL FRAME, AND FOUR DIGIT WHEELS
   * IN THE UPPER RIGHT THAT ROLL AND LOCK LEFT TO RIGHT INSIDE A SECOND.
   *
   * ##########################################################################
   * # AN EQUAL YEAR TREATMENT TO P12, NOT A REPLACEMENT FOR IT, AND THE       #
   * # DEVELOPER RULED IT SO.                                                  #
   * #                                                                        #
   * # The two draw the same fact in two tempos. P12 is the calm marker: the   #
   * # year fades up once and settles. P14 is the fast one: four wheels spin   #
   * # and lock. The pack says the same thing from its side — its contract     #
   * # ends "Use P12 for a calm single date and P13 for three ordered          #
   * # dates/eras", which is a sibling's rule, not a successor's.              #
   * #                                                                        #
   * # SO NOTHING HERE DEMOTES P12. G15 used to read "a spoken year takes      #
   * # P12"; it now reads "a spoken year takes P12 OR P14", and T-2 in         #
   * # check-plan reads the same way. WHICH of the two draws is decided in     #
   * # exactly two places and nowhere else:                                    #
   * #                                                                        #
   * #   the planner asks   a P14 row on the beat pushes                       #
   * #                      `fast_date_emphasis` into the beat's jobs, which   #
   * #                      is the ONLY way that job is ever emitted, and the  #
   * #                      row's `PLANNED_BONUS` then wins the score          #
   * #                                                                        #
   * #   only one can draw  where P12 is refused for its own reasons — its     #
   * #                      0.75 brightness ceiling is the usual one — and     #
   * #                      P14 is not, P14 takes the beat, and the other way  #
   * #                      round. G15 asks both and fires if EITHER answers.  #
   * #                                                                        #
   * # A FILM WITH NO P14 ROW THEREFORE CHOOSES EXACTLY AS IT DID BEFORE P14   #
   * # EXISTED, and there is a snapshot test over the whole chooser that says  #
   * # so, as there is for 05, P08, P04, P02, P09 and P05.                     #
   * ##########################################################################
   */
  P14: {
    id: 'P14',
    origin: 'saku',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    /*
     * NOT FROM `TEMPLATE_REGISTRY.json` in `script/`, which has no P14. This is
     * the `compositionId` the accepted pack's own registry and lock give it
     * (`templates/accepted_template_webapp_handoff/TEMPLATE_REGISTRY.json`).
     */
    officialFileName: 'P14FastDateOdometer',
    /* The pack names no fallback. Writing one would invent a line of its rulebook, as P12's box says. */
    fallbackTemplateIds: [],
    job: 'fast_date_emphasis',
    pictures: 1,
    /*
     * ##########################################################################
     * # 71: 28 FRAMES TO ARRIVE, 11 TO LEAVE, 32 SETTLED, AND THE NUMBERS ARE  #
     * # OFF THE PACK'S OWN PREVIEW RATHER THAN OFF ITS PROSE.                  #
     * #                                                                        #
     * # ARRIVE. Two things finish last and they finish together. The fourth    #
     * # digit column starts rolling at 0.39 s and locks at 0.91 s, frame 27.3; #
     * # the 430 px rule finishes drawing at 0.92 s, frame 27.6. Rounded up     #
     * # that is 28. Confirmed by measuring the pack's own preview rather than  #
     * # trusting the contract: frames 27, 60 and 120 have byte-identical digit #
     * # geometry and an identical 425 px rule, and frame 20 has neither — its  #
     * # third column is mid-roll and its rule is still short                   #
     * # (tmp/v53/templates/P14/measure-p14-reference.out.txt).                 #
     * #                                                                        #
     * # LEAVE. The whole frame fades over the last 0.35 s, 10.5 frames, so 11. #
     * #                                                                        #
     * # SETTLED, AND THIS IS THE ONLY ONE THAT IS A JUDGEMENT. 32 frames is    #
     * # 1.07 s of a locked, motionless year. It is more than P12's, which gets #
     * # no settled allowance at all beyond its 36, and the reason is that a    #
     * # viewer who watched four wheels spinning has only just been given       #
     * # something to read at frame 28 — the roll is motion, not information.   #
     * # A second of stillness afterwards is what turns the trick into a date.  #
     * #                                                                        #
     * # IT IS ALSO WHY THE FLOOR IS HIGHER THAN P12's 36 FOR A SHORTER BUILD.  #
     * # P14 arrives EIGHT frames sooner and asks for THIRTY-FIVE more, because #
     * # the two numbers answer different questions: `buildEndFrames` is a G3   #
     * # floor on the whole treatment, and this treatment's cost is the hold,   #
     * # not the entrance. G3 is never waived, so a shorter shot is refused     #
     * # rather than cut mid-roll — a cut odometer is a frame of a year that is #
     * # not the year, which is the one thing this template must never do.      #
     * ##########################################################################
     */
    buildEndFrames: 71,
    /*
     * 240, THE PACK'S USUAL MAXIMUM OF EIGHT SECONDS, as P12's, P08's, P02's,
     * P04's, P09's and P05's are. The 3.5 percent push runs over the whole shot
     * whatever its length, so a long shot is a slower push rather than a frozen
     * one, and the odometer itself is over inside the first second either way.
     */
    holdsWellFrames: 240,
    /* The pack's locked five seconds. It feeds only `durationFit` in the score. */
    defaultDurationFrames: 150,
    /*
     * UNCAPPED, FOR EXACTLY P12's REASON AND WITH A NARROWER NATURAL LIMIT.
     *
     * ####################################################################
     * # The client's rule is "A YEAR OR A DATE ALWAYS TAKES P12 ... a     #
     * # year that misses P12 is a defect, not a fallback", and P14 is now #
     * # one of the two devices that satisfies it. A cap here would say    #
     * # the same "always" out of the other side of its mouth.             #
     * #                                                                   #
     * # AND IT CANNOT FLOOD, which is the fair question after photo-pop.  #
     * # P14 needs THREE things at once: a planner row naming it (its job  #
     * # is emitted from nothing else), a `bareYear` mark heard in the     #
     * # shot and spelled as the script spells it, and that mark being     #
     * # EXACTLY FOUR DIGITS. Over the delivered 118-beat plan six beats   #
     * # speak a date at all, and one of the six is "364 CE", which this   #
     * # device refuses on the third condition. The ceiling is the         #
     * # narration and the planner, not a number in this file.             #
     * #                                                                   #
     * # G12 STILL REFUSES TWO P14s ON ADJACENT BEATS, AND NOTHING REFUSES #
     * # A P14 BESIDE A P12. Said plainly rather than handed to something  #
     * # else: G12 compares `spec.id`, and both halves of the score's      #
     * # variety term count `spec.id` too, so a P12 on the shot next door  #
     * # costs a P14 nothing, no refusal and not one point.                #
     * #                                                                   #
     * # ACCEPTED, NOT OVERLOOKED. G12's rule is about seeing the SAME     #
     * # treatment twice, and on screen these are two of them, a year that #
     * # fades up and settles and then four wheels that spin and lock.     #
     * # Supply makes it rare besides: six of the 118 beats speak a date   #
     * # at all, and only a planner row can turn one of those into a P14.  #
     * #                                                                   #
     * # `lets a P12 sit on the shot next door, and charges P14 nothing    #
     * # for it`, in `deviceChoice.visualPlan.test.ts`, builds that film   #
     * # and asserts it as the outcome.                                    #
     * ####################################################################
     */
    maxPerFilm: null,
    capSource: 'unstated',
    /* The opening shot carries the P03 he called "the quality of good intro", as it does for photo-pop, 05, P08, P04, P02, P09 and P05. */
    positionRule: 'notOpening',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    /*
     * ##########################################################################
     * # 0.75, AND THE GOLD RULE SETS IT RATHER THAN THE DIGITS. RENDERED AND   #
     * # MEASURED OVER FOURTEEN PICTURES, 2026-09-13.                           #
     * #                                                                        #
     * # THE DIGITS DO NOT NEED A CEILING AT ALL, and that is worth saying      #
     * # first because it is the surprising half. P14 puts FIVE darkening       #
     * # layers between the ink and the photograph where P12 puts four: the     #
     * # same `brightness(0.72)` filter, then a 90deg veil reaching             #
     * # rgba(8,7,6,0.64) at the right edge where the digits sit (P12's reaches #
     * # 0.58), then a 180deg gradient at 0.36 across the top band where they   #
     * # ALSO sit (P12's top stop is 0.20), then the inset vignette at 0.42,    #
     * # then a textShadow under every digit at 0.56. Measured against the      #
     * # brightest ground pixel in the 7 px gaps between the columns — the      #
     * # ground a reader actually sees them against — the weakest digit reads   #
     * #                                                                        #
     * #   17.62 to 1 over the pack's own fixture (0.10)                        #
     * #    9.66 over Dead Sea Scroll 175, fdb8d6aa (0.41)                      #
     * #    5.87 and 5.43 over the two brightest judged pictures in storage,    #
     * #         770d8810 (0.87) and 160fd22d (0.93)                            #
     * #    5.43 over PURE WHITE                                                #
     * #                                                                        #
     * # Every reading clears 4.5 to 1, which is the bar for SMALL text, and    #
     * # these are 132 px. No picture can take the year.                        #
     * #                                                                        #
     * # THE 4 PX GOLD RULE IS WHAT A BRIGHT PICTURE ACTUALLY REACHES, and      #
     * # TREATMENT-STANDARD.md section 1 is why that is a refusal rather than a #
     * # shrug: "WHAT THE APPROVED TREATMENTS SHARE: each one OWNS THE GROUND   #
     * # UNDER ITS TYPE and draws at least one element that is not a letter —   #
     * # a gold marker block, a 4px gold rule, a hard-edged plate. The retired  #
     * # style drew glyphs and nothing else." P14's rule IS that element and it #
     * # is the only one it has. A P14 whose rule has washed out is four digits #
     * # dropped on a photograph, which is the style the client rejected by     #
     * # name — so losing the rule costs the treatment its authorship, not just #
     * # a decoration.                                                          #
     * #                                                                        #
     * # Against the brightest pixel in the eight rows under it, over flat      #
     * # greys rendered at 0.745, 0.765, 0.788, 0.808, 0.824 and 0.847, the     #
     * # rule reads 3.03, 2.94, 2.84, 2.72, 2.65 and 2.58 to 1. It crosses 3 to #
     * # 1 — the bar for a graphical object — at about 0.751, so the ceiling is #
     * # 0.75. It is the last measured reading that holds, not a round number   #
     * # chosen near one.                                                       #
     * #                                                                        #
     * # IT IS P12's NUMBER BY COINCIDENCE AND THE DERIVATION IS NOT P12's.     #
     * # Stated plainly, because a reader who assumes it was copied across will #
     * # also assume it can be moved by the same argument. P12's 0.75 is a      #
     * # conservative floor under a YEAR that was still reading at 0.82. P14's  #
     * # is the measured crossing of a RULE. The two would move for different   #
     * # reasons and neither is evidence about the other.                       #
     * #                                                                        #
     * # (tmp/v53/templates/P14/measure-p14-stills.out.txt and                  #
     * # measure-p14-ceiling.out.txt)                                           #
     * ##########################################################################
     */
    maxMeanLuma: 0.75,
    minMeanLuma: null,
    /* It grades its own picture, so the house grade must not go on top, as for P12. */
    carriesOwnGrade: true,
  },

  /* --------------------------------------------------------------------- */
  /* REGISTERED AND REFUSED. Each reason is a fact about this pipeline,      */
  /* written down so nobody re-derives it, and each is a one-line change     */
  /* the day the missing input arrives.                                     */
  /* --------------------------------------------------------------------- */

  /**
   * SUPERSEDED BY P17 by the client's own instruction. Kept, not deleted: its
   * clip is already with him and its tests pin measurements taken off his own
   * frames. Retire it when the replacement has been seen and accepted.
   *
   * It would fail on its own merits anyway — its leader line is a bare 8px white
   * stroke with no outline, shadow or scrim, so it vanishes against a bright
   * subject.
   */
  'pointer-label': {
    id: 'pointer-label',
    origin: 'client',
    enabled: false,
    disabledReason: 'superseded',
    supersededBy: 'P17',
    officialFileName: 'a1_pointer-label.mp4',
    fallbackTemplateIds: ['framed-card', 'photo-pop'],
    job: 'one_named_detail',
    pictures: 1,
    buildEndFrames: 40,
    holdsWellFrames: 150,
    defaultDurationFrames: 150,
    maxPerFilm: null,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'opaquePlate',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * a3, THE CHAPTER TITLE. DRAWABLE AGAIN SINCE 2026-09-11, FOR THE COMPOSITOR
   * ONLY, AND PLACED BY AN OPERATOR RATHER THAN CHOSEN BY THE TOOL.
   *
   * ##########################################################################
   * # HE APPROVED TWO HEADINGS IN WRITING, 2026-09-11 AT 17:02, replying to  #
   * # a list of eight drafts: "The Memory Passages" and "The Dead Are        #
   * # Awake". A heading he approved is not invented copy, so                 #
   * # `needs-invented-copy` is no longer true of what this device draws.     #
   * #                                                                        #
   * # HIS PLACEMENT RULING, VERBATIM: "1:16 is good (1 needs to come early)" #
   * # and "And then somewhere at at 4-6 minute mark, 6:13 is good."          #
   * #                                                                        #
   * # THE CHOOSER STILL MAY NOT PRODUCE ONE ON ITS OWN. Its only sources are #
   * # the dossier's heading and the planner's headline, the two arms the box #
   * # below takes apart, and neither is a heading he approved. So a3 is in   #
   * # `PLACED_BY_OPERATOR_ONLY`: the compositor can draw it, the chooser     #
   * # refuses it at G1 exactly as it did while it was disabled, the planner  #
   * # is never offered it, and the only way onto a beat is an                #
   * # `operator-placements` artifact that `checkOperatorPlacement` has       #
   * # passed.                                                                #
   * #                                                                        #
   * # WHAT WOULD RETURN IT TO THE CHOOSER: an admission path fed ONLY from   #
   * # headings he approved, never from the research dossier, whose own       #
   * # headings for this script include "Three sections" and "Not symmetric", #
   * # the two he rejected. Until that path exists a3 stays in the set.       #
   * #                                                                        #
   * # NO OTHER FIELD MOVED. His cap of two, `prefersFirstHalf`,              #
   * # `buildEndFrames` 120 (G3, never waived, because a truncated build is a #
   * # broken render), his 240 ceiling, `pictures: 0` and the house grade are #
   * # exactly as they were. His words on the entry record the cap and the    #
   * # position, and the box on `holdsWellFrames` records the ceiling. The    #
   * # grade had no written reason until the box on `carriesOwnGrade`,        #
   * # written the same day.                                                  #
   * ##########################################################################
   *
   * ENABLED 2026-08-28. HE RESOLVED THE CONFLICT HIMSELF.
   *
   * ##########################################################################
   * # THIS ENTRY WAS DISABLED BECAUSE HIS OWN WORKED EXAMPLE TURNED "And     #
   * # what it says is this" INTO "What the evidence reveals" — a line        #
   * # sharing no content word with the narration, which is exactly what the  #
   * # spoken-mark rule exists to refuse. The note said "only he can resolve  #
   * # it".                                                                   #
   * #                                                                        #
   * # HE HAS. `ai/AI_TEMPLATE_SELECTION_RULES.md`, delivered today:          #
   * #                                                                        #
   * #   a3_chapter-title: "select ONLY for an explicit chapter or major      #
   * #   section heading. The end of a hook is not enough."                   #
   * #                                                                        #
   * # and his rule 2: "Do not invent facts, dates, quotations, CHAPTER       #
   * # NAMES, entity roles, image labels, relationships, or conclusions."     #
   * #                                                                        #
   * # So the worked example was him sketching, not him specifying, and his   #
   * # written rule agrees with ours: the caption is an EXPLICIT heading the  #
   * # narration speaks. It may never be an editorial line.                   #
   * #                                                                        #
   * # THE NARRATION SPEAKS THEM. `scanNarrationMarks` over the client's own  #
   * # 1,399 aligned words returns SIXTEEN `section` marks across six texts — #
   * # "Chapter 22" x6, "Chapter 39" x5, "Chapters 102 through 104" x2,       #
   * # "Chapters one through 36", "Chapters 91 through 108", "Chapters 37     #
   * # through 71" — and seven of them fall inside the 2:50 window. That is   #
   * # T-1's table, and the detector landed in `b2c5adb`.                     #
   * #                                                                        #
   * # ITS CHAIN IS EMPTY IN HIS REGISTRY — a3 is terminal, it falls back to  #
   * # nothing. So a chapter beat it cannot serve stays available to P03,      #
   * # which is the treatment the client called "perfect" for this exact job. #
   * ##########################################################################
   *
   * ##########################################################################
   * # AND OFF AGAIN THE SAME DAY, 2026-09-04. THE ARGUMENT ABOVE IS STILL     #
   * # TRUE AND IT WAS NEVER THE WHOLE CONDITION.                              #
   * #                                                                        #
   * # "The narration speaks them" establishes that a spoken heading EXISTS.   #
   * # It does not establish that a spoken heading is what gets DRAWN, and     #
   * # `deviceChoice.ts:1287` is where the two come apart:                     #
   * #                                                                        #
   * #     const title = beat.editorialTitle ?? written?.headline ?? null      #
   * #                                                                        #
   * # The dossier's spoken heading is only the first arm. With no heading     #
   * # anchored to the beat it falls through to `written.headline`, which is   #
   * # the visual planner's own invented line, and no gate between that and the  #
   * # screen asks whether the narration ever said it.                         #
   * #                                                                        #
   * # BOTH CARDS OF THE FIRST FILM BUILT WITH IT TOOK THE SECOND ARM. Job     #
   * # d421138e, the 2:59 review cut: scene 24 drew "Three sections" and scene #
   * # 56 drew "Not symmetric". The pipeline logged both itself, in the        #
   * # client-facing T-19 copy sheet, as lines "the narration does not say".   #
   * # The client watched the first and wrote that it "did not related in      #
   * # any". The words "three sections" ARE spoken — on scene 25, 0.2s after   #
   * # the card ends — which is precisely how an invented heading passes for   #
   * # a real one right up until someone watches it.                           #
   * #                                                                        #
   * # SO `needs-invented-copy` IS THE ACCURATE REASON AGAIN. His rule 2       #
   * # forbids inventing CHAPTER NAMES by name, so this is a rule violation    #
   * # rather than a tuning miss, and a flag is the honest response until the  #
   * # arm is closed.                                                          #
   * #                                                                        #
   * # WHAT PUTS IT BACK: an admission path that takes ONLY                    #
   * # `beat.editorialTitle` and refuses the beat when the dossier anchors no  #
   * # spoken heading to it. That is a change to `deviceChoice.ts` and to the  #
   * # visual planner's contract. It is a real piece of work and it is worth   #
   * # doing — a3 is a template the client asked for by name, which is why     #
   * # this is `enabled: false` with the cap and the chain left standing,      #
   * # rather than a deletion.                                                 #
   * #                                                                        #
   * # THE COST OF LEAVING IT ON MEANWHILE IS NOT ZERO. `pictures: 0` means    #
   * # the device paints its own ground and discards whatever the scene        #
   * # sourced. Scene 24 had a Pexels shelf of old books plus three companions #
   * # and all four were binned to draw an invented line.                      #
   * ##########################################################################
   */
  'chapter-title': {
    id: 'chapter-title',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a3_chapter-title.mp4',
    fallbackTemplateIds: [],
    job: 'section_turn',
    pictures: 0,
    buildEndFrames: 120,
    /*
     * ##########################################################################
     * # 240 IS HIS NUMBER, NOT OURS, AND 150 REFUSED EVERY REAL CHAPTER BEAT.  #
     * #                                                                        #
     * # Measured on the 39 beats of the 2:50 cut: chapter-title was refused    #
     * # `beat-too-long` on every section beat it was wanted for, because the   #
     * # real beats run 161 frames and up while this ceiling was 150. It missed #
     * # by ELEVEN FRAMES — 0.37 seconds — and drew nothing all film.           #
     * #                                                                        #
     * # His `shared/TEMPLATE_REGISTRY.json` marks `durationIsHardLimit: false` #
     * # on all fifteen templates, and his rule 9 says "Numeric ranges are      #
     * # defaults unless they are explicitly marked as hard limits". His        #
     * # `globalRules.normalDuration` gives startingPoint 5s and                #
     * # usualMaximum 8s, which at 30fps is 150 and 240.                        #
     * #                                                                        #
     * # SO 150 WAS HIS STARTING POINT READ AS A CEILING. 240 is his stated     #
     * # usual maximum, and `defaultDurationFrames` stays 150 so the device     #
     * # still DRAWS for five seconds — his own reference length. What changed  #
     * # is only how long a beat may be and still be offered it.                #
     * ##########################################################################
     */
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    /*
     * ##########################################################################
     * # ONE. HE OVERRULED HIS OWN TWO, IN WRITING, ON 2026-09-15 AT 21:37.     #
     * #                                                                        #
     * # HIS WORDS, verbatim:                                                   #
     * #                                                                        #
     * #   "Once you have matched it, make this ruling change:                   #
     * #    Original chapter title to only be used once instead of twice.        #
     * #    But this new chapter title to be used in all the other spots that    #
     * #    get detected (2-5 spots)"                                            #
     * #                                                                        #
     * # "Original chapter title" is THIS device, a3. The PDF's "used only       #
     * # twice max during the entire video" is the number he is changing, so     #
     * # the PDF is no longer where this cap comes from and `capSource` says     #
     * # so. The 2 is kept in the quote above rather than deleted, because a     #
     * # reader holding the PDF open needs to see that the difference is a       #
     * # later ruling and not a transcription slip.                              #
     * #                                                                        #
     * # THE CAP ALONE DOES BITE ON THIS DEVICE, and that is worth stating       #
     * # because a3 is `PLACED_BY_OPERATOR_ONLY` and never goes near the         #
     * # chooser. `applyOperatorPlacements` in plan.ts reads                     #
     * # `DEVICE_REGISTRY[device.id].maxPerFilm` for hand placements too, and    #
     * # refuses the entry that would be the second.                            #
     * #                                                                        #
     * # IT BITES IN FILE ORDER, WHICH IS NOT THE SAME AS BITING ON THE RIGHT    #
     * # ENTRY. An `operator-placements` file that still lists two headings      #
     * # keeps whichever is written FIRST and refuses the other with a log       #
     * # line. Which of the two he wants kept is an editorial question this      #
     * # number cannot answer, so the file is edited by hand as well.            #
     * #                                                                        #
     * # `OPERATOR_PLACEMENTS_MAX` IS DERIVED FROM THIS and drops 8 -> 7.        #
     * ##########################################################################
     */
    maxPerFilm: 1,
    capSource: 'niku-ruling-2026-09-15',
    /** HIS WORDS: "first one USUALLY before the first half." Hedged, so soft. */
    positionRule: 'prefersFirstHalf',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'none',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    /*
     * ##########################################################################
     * # STAYS FALSE, ON PURPOSE. THE HOUSE GRADE DRAWS OVER THE CARD.          #
     * #                                                                        #
     * # Measured 2026-09-11 through the real Segment path. The grade lifts the #
     * # card's pure-black ground to about 9 of 255, and that is its toe layer, #
     * # not the encode. At the peak of the zoom its vignette dims the          #
     * # outermost letters by about 4.5%. Both show only side by side with an   #
     * # ungraded render, and the lifted black matches the blacks of every      #
     * # other graded shot in the film.                                         #
     * #                                                                        #
     * # a2 is the recorded exception, and the difference is what is judged.    #
     * # Its page brightness IS the measurement, see its own entry. a3's        #
     * # ground is not what the client judges.                                  #
     * ##########################################################################
     */
    carriesOwnGrade: false,
  },

  /**
   * NEEDS AN EXTERNAL FACT AND AN ANSWER. Its role line is a fact about a real
   * person, and the client's own rule says the face shown must NOT be the real
   * one — while this script names living scholars. Putting a stranger's face
   * under a real academic's name on a monetised channel is a live exposure, and
   * it contradicts the "an overlay may only name what you can see" rule he has
   * already confirmed. Raised with him, unanswered.
   */
  'name-card': {
    id: 'name-card',
    origin: 'client',
    enabled: false,
    disabledReason: 'needs-external-fact',
    supersededBy: null,
    officialFileName: 'a5_name-card.mp4',
    fallbackTemplateIds: ['framed-card', 'photo-pop'],
    job: 'person_introduction',
    pictures: 2,
    buildEndFrames: 90,
    holdsWellFrames: 150,
    defaultDurationFrames: 150,
    /** HIS WORDS: "Used max 3 times during the entire video." */
    maxPerFilm: 3,
    capSource: 'niku-pdf',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'opaquePlate',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /** NEEDS A COPY RULE HE HAS NOT WRITTEN. Nothing says what its two chips say. */
  'two-photo-zoom': {
    id: 'two-photo-zoom',
    origin: 'client',
    /*
     * ####################################################################
     * # SWITCHED ON BY THE VISUAL PLANNER, 2026-09-04, AND THE REASON IS  #
     * # THAT ITS ONE BLOCKER HAS BEEN REMOVED RATHER THAN WAIVED.         #
     * #                                                                  #
     * # `disabledReason` was `needs-invented-copy`, and that was true:    #
     * # nothing in a spoken mark can fill these slots, so `buildCopy` had #
     * # no honest arm to write. Stage 1c now writes them upstream, frozen #
     * # into the plan, under T-18's four conditions — a summary rather    #
     * # than a fact, only where nothing was spoken, generated outside     #
     * # `chooseDevices`, and listed on the copy sheet before shipping.    #
     * #                                                                  #
     * # THE OTHER FIVE DISABLED TEMPLATES STAY OFF, and each for its own  #
     * # reason rather than for want of a planner: `name-card` needs a     #
     * # person's ROLE and `P13` needs DATES, both of which T-18 condition #
     * # 2 refuses in as many words; `highlight-page` needs a clock nobody #
     * # has measured; `P16` fails the contrast floor; `pointer-label` is  #
     * # superseded by P17. A planner cannot fix any of those.             #
     * ####################################################################
     */
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a4_two-photo-zoom.mp4',
    fallbackTemplateIds: ['P22', 'P03'],
    job: 'comparison',
    pictures: 2,
    buildEndFrames: 80,
    holdsWellFrames: 150,
    defaultDurationFrames: 90,
    maxPerFilm: null,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'opaquePlate',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * a2, THE HIGHLIGHTED PAGE. DRAWABLE SINCE 2026-09-11, AND PLACED BY AN
   * OPERATOR RATHER THAN CHOSEN BY THE TOOL.
   *
   * ##########################################################################
   * # HIS RULING, 2026-09-10: "Highlighted Text is MANDATORY in every video" #
   * # and "this is like the a8 container, make it so that it will be used in #
   * # every video." It is placed at a source-reference moment, highlights    #
   * # "the specific phrase, claim, name, or finding being discussed" and     #
   * # carries "a natural surrounding passage that provides context".         #
   * #                                                                        #
   * # THE PASSAGE IS WRITTEN, SO NOTHING INSIDE `chooseDevices` MAY PRODUCE  #
   * # IT. The automatic version needs a model step upstream and a check of   #
   * # every word against the narration, which is days of work. Until it     #
   * # lands, a2 is in `PLACED_BY_OPERATOR_ONLY`: the compositor can draw it, #
   * # the chooser never selects it and the planner is never offered it, and #
   * # the only way onto a beat is an `operator-placements` artifact checked  #
   * # by `checkOperatorPlacement` in `operatorPlacement.ts`.                 #
   * ##########################################################################
   *
   * ##########################################################################
   * # THE CLOCK IS THE PER-WORD READING, ADOPTED RATHER THAN MEASURED.       #
   * #                                                                        #
   * # 13 frames per highlighted word plus a 48-frame hold. From one          #
   * # reference you cannot separate that from a fixed 130-frame span split   #
   * # 3:4:3, but the fixed span is 178 frames and the longest shot this      #
   * # pipeline cuts is 148, so it fits no shot at all. The per-word reading  #
   * # fits any shot of 87 frames or more by highlighting fewer words, which  #
   * # is why `buildEndFrames` is 87: the shortest legal page, 3 words.        #
   * ##########################################################################
   */
  'highlight-page': {
    id: 'highlight-page',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a2_highlight-page.mp4',
    fallbackTemplateIds: ['P03', 'framed-card'],
    job: 'staged_argument_or_counterphrase',
    pictures: 0,
    buildEndFrames: 87,
    holdsWellFrames: 200,
    defaultDurationFrames: 178,
    /*
     * ##########################################################################
     * # SIX, AND IT IS OUR NUMBER, NOT HIS. `capSource` STAYS `unstated`.      #
     * #                                                                        #
     * # His note on V50, 2026-09-11: "highlight text was good but it came too  #
     * # late, make it so that the first one appears within the first 3        #
     * # minutes ... And then it can freely appear later on many times too     #
     * # whenever suitable." He gave no number. At 2 the next film fitted one   #
     * # early page beside the 7:50 one and nothing more. Six in an 8:46 film   #
     * # is about one page every 88 seconds.                                   #
     * #                                                                        #
     * # ONLY THE HAND PATH READS IT. a2 is in `PLACED_BY_OPERATOR_ONLY`, so the #
     * # chooser refuses it at G1, before G11 or the variety score could read   #
     * # this, and the planner is never offered it, so its prompt, its tool and #
     * # `libraryFingerprint` do not move. `applyOperatorPlacements` in plan.ts #
     * # reads it, and so does `OPERATOR_PLACEMENTS_MAX`, which is the caps of  #
     * # the hand-placed devices added together.                                #
     * ##########################################################################
     */
    maxPerFilm: 6,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'none',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    /*
     * ITS OWN GRADE, BECAUSE THE PAGE IS THE MEASUREMENT. The house grade lifts
     * contrast and lays a dark vignette over the frame, which moves his near-white
     * page from 248 to about 254 and darkens the corners the page's own vignette
     * already shapes. `highlightPageClock.ts` calls a shifted page "the single
     * easiest way to be wrong on this shot".
     */
    carriesOwnGrade: true,
  },

  /**
   * NEEDS A HEADER TITLE NOTHING SPEAKS, and a measured cadence for a fourth
   * row. Its 120-frame clock holds exactly three baselines, three checkbox tops
   * and three onsets behind `?? 0` fallbacks, so a fourth item draws at y=0
   * fully opaque from frame 0, at exit 0.
   */
  'bullet-checklist': {
    id: 'bullet-checklist',
    origin: 'client',
    /*
     * ####################################################################
     * # SWITCHED ON BY THE VISUAL PLANNER, 2026-09-04, AND THE REASON IS  #
     * # THAT ITS ONE BLOCKER HAS BEEN REMOVED RATHER THAN WAIVED.         #
     * #                                                                  #
     * # `disabledReason` was `needs-invented-copy`, and that was true:    #
     * # nothing in a spoken mark can fill these slots, so `buildCopy` had #
     * # no honest arm to write. Stage 1c now writes them upstream, frozen #
     * # into the plan, under T-18's four conditions — a summary rather    #
     * # than a fact, only where nothing was spoken, generated outside     #
     * # `chooseDevices`, and listed on the copy sheet before shipping.    #
     * #                                                                  #
     * # THE OTHER FIVE DISABLED TEMPLATES STAY OFF, and each for its own  #
     * # reason rather than for want of a planner: `name-card` needs a     #
     * # person's ROLE and `P13` needs DATES, both of which T-18 condition #
     * # 2 refuses in as many words; `highlight-page` needs a clock nobody #
     * # has measured; `P16` fails the contrast floor; `pointer-label` is  #
     * # superseded by P17. A planner cannot fix any of those.             #
     * ####################################################################
     */
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'a7_bullet-checklist.mp4',
    /**
     * `gallery-strip` WAS THE NEXT LINK HERE AND IT HAD TO COME OUT.
     *
     * ####################################################################
     * # A8 IS A MANDATORY OPENING BEAT, NOT A RESCUE. `FALLBACK_WAIVES`   #
     * # contains `beat-too-long`, so a walk that reached a8 could place   #
     * # it on a 238-frame beat — and every geometry function in its clock #
     * # is frozen from frame 131, so that is 107 frames, 3.6 seconds, of  #
     * # a still photograph. Saku 0.3 forbids exactly that: "Do not leave  #
     * # a long empty hold after the images and labels have appeared."     #
     * #                                                                   #
     * # It is also the wrong PICTURES. a8 is `pictureSource:              #
     * # 'filmPreview'`, so rescuing it onto a beat means previewing later #
     * # content from somewhere the opening rule never sanctioned.         #
     * #                                                                   #
     * # Removing it from three chains costs nothing measurable: over the  #
     * # real 118-beat film the walk reached a8 three times and refused it #
     * # on picture supply all three.                                      #
     * ####################################################################
     */
    fallbackTemplateIds: ['P03', 'gallery-strip'],
    job: 'ordered_takeaways',
    pictures: 1,
    buildEndFrames: 119,
    holdsWellFrames: 150,
    defaultDurationFrames: 120,
    maxPerFilm: 2,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'ownGround',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * NEEDS A KICKER AND A HEADING, both editorial. Its three dates ARE sourceable
   * — two date detectors exist and sort chronologically — which makes it the
   * closest of the refused templates. Its outer labels also clip past about
   * 300px of DRAWN width and nothing upstream can measure ink.
   */
  P13: {
    id: 'P13',
    origin: 'saku',
    enabled: false,
    disabledReason: 'needs-invented-copy',
    supersededBy: null,
    officialFileName: '2_1-00_P13-timeline.mp4',
    fallbackTemplateIds: ['bullet-checklist', 'P03'],
    job: 'ordered_dates_or_eras',
    pictures: 1,
    buildEndFrames: 113,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    maxPerFilm: 2,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    maxMeanLuma: 0.62,
    minMeanLuma: null,
    carriesOwnGrade: true,
  },

  /**
   * REFUSED ON CONTRAST, WHICH IS A DIFFERENT KIND OF NO.
   *
   * Its 20% scrim measures 2.63:1 worst case on a bright photograph against this
   * project's own 3:1 floor. That is a 57% improvement on having no scrim at all
   * and it is still under the floor, so a luma threshold cannot honestly paper
   * over it. It also needs a detector for "not X, not Y, but Z", which nothing
   * has. UNBLOCKS ON a heavier scrim agreed with the partner, plus that shape.
   */
  P16: {
    id: 'P16',
    origin: 'saku',
    enabled: false,
    disabledReason: 'fails-contrast-floor',
    supersededBy: null,
    officialFileName: '3_1-18_P16-not-metaphor.mp4',
    fallbackTemplateIds: ['P03'],
    job: 'staged_argument_or_counterphrase',
    pictures: 1,
    buildEndFrames: 88,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    maxPerFilm: 2,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    maxMeanLuma: 0.35,
    minMeanLuma: null,
    carriesOwnGrade: true,
  },

  /* ------------------------------------------------- Niku's four, 2026-09-14 */

  /**
   * "chapter title v2.mp4", and the whole point of it is a SECOND cap.
   *
   * ##########################################################################
   * # WHY THIS IS A NEW ID AND NOT A RESTYLE OF `chapter-title`.             #
   * #                                                                        #
   * # His words: "One of them is same ruling as chapter title, but it will   #
   * # just be put on the other detected spots as the previous one could only #
   * # be used twice."                                                        #
   * #                                                                        #
   * # `chapter-title` was `maxPerFilm: 2` when this id was cut, and his      #
   * # 2026-09-15 ruling has since taken it to ONE. Section detection finds   #
   * # roughly EIGHT spots on the delivered film, so seven of them have       #
   * # nowhere to go and always did. A restyle would still be one device      #
   * # against one cap and would have changed nothing. Two ids carry two      #
   * # caps, which is the only shape that puts a title on a seventh spot —    #
   * # and his ruling makes that the whole job of this one rather than a      #
   * # side effect of it.                                                      #
   * ##########################################################################
   *
   * EVERYTHING BELOW IS MEASURED OFF HIS CLIP, NOT RULED BY HIM, WITH ONE
   * EXCEPTION SINCE 2026-09-15: `maxPerFilm`, which his written ruling of that
   * evening sets, and whose `capSource` says which document it came from.
   * Every other number here is still ours and may not be quoted back to him as
   * his own. Measurements: `tmp/v53/overlays/SPEC-measured.md`.
   */
  'chapter-plate': {
    id: 'chapter-plate',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'chapter title v2.mp4',
    /*
     * EMPTY, exactly as `chapter-title`'s is. A section title that cannot draw
     * has no substitute — the alternative to a chapter plate is the ordinary
     * shot, not a different device making a different claim.
     */
    fallbackTemplateIds: [],
    job: 'section_turn',
    /*
     * ONE, and this is the difference from `chapter-title` that matters most.
     * a3 paints its own black ground and draws no photograph. This one is set
     * OVER the shot in both of his samples — a manuscript page and a church
     * facade — so the beat's own picture is what it sits on.
     */
    pictures: 1,
    /*
     * ##########################################################################
     * # 75 FRAMES, 2.50s. HIS RULING, AND THE MEASUREMENT, AND THEY AGREE.     #
     * #                                                                        #
     * # HIS WORDS, 2026-09-16 at 19:13, verbatim:                              #
     * #                                                                        #
     * #   "Require at least 2.5 seconds. The animation should finish before     #
     * #    the cut; otherwise it can look accidental or broken."                #
     * #                                                                        #
     * # 2.5s at 30fps is 75 frames exactly, so his floor needs no rounding.     #
     * #                                                                        #
     * # AND THE LAST THING THIS DEVICE ANIMATES SETTLES AT 75 TOO. The clock    #
     * # runs three things off the shot's own first frame, and the number here   #
     * # has to be the LAST of them to finish, not any one of them:              #
     * #                                                                        #
     * #   group fade full     CHAPTER_PLATE_GROUP.fadeEndFrame    0.39 * 30 =   #
     * #                                                          11.7 frames    #
     * #   rule wipe full      CHAPTER_PLATE_RULE.wipeEndFrame     1.20 * 30 =   #
     * #                                                            36 frames    #
     * #   group scale settles CHAPTER_PLATE_GROUP.scaleEndFrame    2.50 * 30 =  #
     * #                                                            75 frames    #
     * #                                                                        #
     * # All three live in `apps/web/src/remotion/animations/chapterPlateClock`  #
     * # and all three were fitted against BOTH of his reference clips at once,  #
     * # to an rms of 0.26px and 0.32px on the ochre bar's four edges. So 75 is  #
     * # read off the same clips his ruling is about, and the agreement between  #
     * # the two is a coincidence worth stating rather than hiding.              #
     * #                                                                        #
     * # HIS 2.5s IS A FLOOR AND THE SETTLE IS A FACT, so if the settle ever     #
     * # moves, this number follows the SETTLE, taken up to at least 75. They    #
     * # coincide today; they are not the same kind of number.                   #
     * ##########################################################################
     *
     * ##########################################################################
     * # WHAT 50 WAS, AND WHY IT WAS CONFIDENTLY WRONG. The comment that stood   #
     * # here read: "the heading finishes building 1.40s in and the rule         #
     * # finishes at 1.65s ... 1.65 * 30 = 49.5, taken up to 50."                #
     * #                                                                        #
     * # BOTH of those clip readings have since been withdrawn. 1.40s and 1.65s  #
     * # were the lead-in mistake in its first, larger form, named in the header #
     * # of `chapterPlateClock.ts`. The wipe's real end is 1.20s, which is       #
     * # EARLIER, so a reader chasing the old derivation today would arrive at   #
     * # 36 and make this number smaller still. What 50 never accounted for at   #
     * # all is the GROUP SCALE, which was not in the clock when 50 was typed.   #
     * # On a 50-frame shot the plate is at 0.991296 of its settled size and     #
     * # still growing when the shot cuts. On a heading whose ink measures       #
     * # 1674px, that is 15px of growth left to come, 7px at each end of the     #
     * # line, arriving after the picture has already changed. That is exactly   #
     * # the "accidental or broken" he is describing.                            #
     * ##########################################################################
     *
     * ##########################################################################
     * # THE COST, MEASURED ON THE DELIVERED FILM RATHER THAN REASONED.         #
     * # (`apps/worker/scripts/device-replay.ts` over the live job's artifacts.) #
     * #                                                                        #
     * # This is a G3 gate, so raising it makes the device HARDER to place in    #
     * # the same week the client asked for it in more spots. Over the film's    #
     * # 164 shots, mean 3.211s, longest 148 frames:                             #
     * #                                                                        #
     * #   clear 50 frames   160 of 164                                          #
     * #   clear 75 frames   144 of 164      so 16 shots lose access             #
     * #                                                                        #
     * # AND IT COSTS THIS FILM NOTHING, because the device only ever looks at   #
     * # beats carrying an `editorialTitle`, and on this film that is EIGHT      #
     * # beats. All eight clear 75:                                              #
     * #                                                                        #
     * #    22 -> 137    47 -> 146    70 ->  84    88 -> 122                     #
     * #    94 ->  94   118 ->  79   133 ->  79   146 -> 113   frames            #
     * #                                                                        #
     * # 118 and 133 are the tight ones, at 79 frames, 2.63s. Four frames of     #
     * # margin, and 133 is the plate the shrink-to-fit work admitted the same   #
     * # day. So on THIS film the ruling refuses nothing and the build finishes  #
     * # 4 frames before the cut, which is what he asked for. On a film whose    #
     * # section beats are cut tighter it WOULD refuse, and the honest answer    #
     * # there is a longer shot, not a smaller number here.                      #
     * ##########################################################################
     */
    buildEndFrames: 75,
    /*
     * 240, the same as `chapter-title`. His `globalRules.normalDuration` gives a
     * usual maximum of 8s and 240 is that at 30fps. Read the long box on
     * `chapter-title`'s own `holdsWellFrames` before touching this: the same
     * number was 150 once and refused every real section beat in the film.
     *
     * ##########################################################################
     * # RE-CHECKED WHEN `buildEndFrames` WENT 50 -> 75 ON 2026-09-16, AND LEFT  #
     * # ALONE. The one invariant tying the two together is in `devices.test`,   #
     * # "gives every device a build that finishes before the shot it holds      #
     * # well", which asks `buildEndFrames <= holdsWellFrames`. 75 <= 240 with   #
     * # room to spare. The gap between them is the window a beat has to land    #
     * # in: G3 refuses under 75, G4 refuses over 240, so the device now wants   #
     * # a shot between 2.50s and 8.00s. The delivered film's longest shot is    #
     * # 148 frames, so G4 has never fired on this device, and narrowing 240 to  #
     * # sit closer to the new 75 would buy nothing and could only take beats    #
     * # away.                                                                   #
     * ##########################################################################
     */
    holdsWellFrames: 240,
    /*
     * ##########################################################################
     * # 150, AND IT IS NOT A GATE, WHICH IS WHY 75 DOES NOT DISTURB IT.        #
     * #                                                                        #
     * # Re-checked on 2026-09-16 alongside `buildEndFrames`, and deliberately   #
     * # unchanged. Nothing cuts a beat to this length. Its ONE reader is the    #
     * # `durationFit` term in `deviceChoice.ts`, which scores a beat by how     #
     * # close its own duration is to this number, falling off in BOTH           #
     * # directions. So it is a PREFERENCE, and a preference out of reach costs  #
     * # a device points rather than beats.                                      #
     * #                                                                        #
     * # IT IS OUT OF REACH ON THIS FILM, AND THAT IS NOT A DEFECT. The longest  #
     * # shot in the delivered film is 148 frames and only 43 of 164 clear 113,  #
     * # so no beat scores full marks on this term. Every device it competes     #
     * # with is scored by the same rule against its OWN default, and the four   #
     * # others carrying a 150 are scored on the same beats, so the term still   #
     * # separates them.                                                         #
     * #                                                                        #
     * # MOVING IT TOWARD 75 WOULD BE A SILENT RESCORE, not a correction. It     #
     * # would raise this device's score on SHORT beats specifically, which is   #
     * # the opposite of what his ruling asks for, and it would do so on every   #
     * # beat rather than only on the ones the gate now refuses. Left at 150     #
     * # until there is a measurement saying what length this plate reads best   #
     * # at, which is a question about his clips and not about the gate.         #
     * ##########################################################################
     */
    defaultDurationFrames: 150,
    /*
     * ##########################################################################
     * # FIVE. HE RULED, SO THE "RAISE IT WHEN HE RULES" NOTE ABOVE IS SPENT.   #
     * #                                                                        #
     * # HIS WORDS, 2026-09-15 at 21:37, verbatim:                              #
     * #                                                                        #
     * #   "Once you have matched it, make this ruling change:                   #
     * #    Original chapter title to only be used once instead of twice.        #
     * #    But this new chapter title to be used in all the other spots that    #
     * #    get detected (2-5 spots)"                                            #
     * #                                                                        #
     * # "this new chapter title" is THIS device. "2-5 spots" is a range and     #
     * # a cap is a ceiling, so the cap is the TOP of his range. Five is what    #
     * # he permits, not what he is promised: the chooser decides how many of    #
     * # the detected spots actually earn a plate, and on the delivered film     #
     * # that number was ONE.                                                    #
     * #                                                                        #
     * # THE CAP IS NOT THE BINDING CONSTRAINT AND RAISING IT ALONE BUYS         #
     * # NOTHING. At 2 the film drew 1, so 2 was never reached. What refuses     #
     * # the other detected spots is upstream of the cap, in this order:         #
     * #                                                                        #
     * #   1. `sectionTitlesForBeats` has to anchor a heading to the beat at     #
     * #      all — the chooser's arm is `beat.editorialTitle` with NO `??`      #
     * #      fall-through, on purpose.                                          #
     * #   2. G8 refuses the beat when the photograph is brighter than           #
     * #      `maxMeanLuma` below, 0.55, as `picture-too-bright`.                #
     * #   3. The sourcer's own floor decides whether the beat owns a            #
     * #      photograph for G2 to find at all.                                  #
     * #                                                                        #
     * # So 5 is the ceiling his ruling sets, and the work that turns it into    #
     * # five drawn plates is elsewhere. Written down here so nobody reads a     #
     * # 5 in this row as a promise of five.                                     #
     * #                                                                        #
     * # STILL NOT `niku-pdf`. The PDF predates this device by weeks and says    #
     * # nothing about it. See the box on `capSource`.                           #
     * ##########################################################################
     */
    maxPerFilm: 5,
    capSource: 'niku-ruling-2026-09-15',
    /*
     * NOT `prefersFirstHalf`. That rule is his, and it is about the FIRST
     * chapter title in the film. This device exists to take the spots a3 could
     * not reach, which are by definition the later ones.
     */
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /*
     * The heading is white type straight onto the photograph with no plate and
     * no scrim behind it, which is what his clip shows.
     */
    typeOverPicture: 'scrim',
    /*
     * ##########################################################################
     * # THIS DEVICE NO LONGER PAINTS A BAND AT ALL, AND THIS NUMBER IS NO      #
     * # LONGER AN ALPHA ANY BOX ON THE FRAME CARRIES. READ THIS BEFORE         #
     * # TOUCHING IT. `corner-label`'s row below says the same thing about the  #
     * # same day, and the two devices now answer one problem one way.          #
     * #                                                                        #
     * # Since 2026-09-21 `ChapterPlate.tsx` carries its ground ON THE GLYPHS —  #
     * # `TOP_TITLE_SHADOW` with THREE stacked centred glows over it at 0.242   #
     * # of the DRAWN cap height, built by `chapterPlateTextShadow` in          #
     * # `topTitleClock.ts`. There is no wash div, no plateau, no sideways      #
     * # mask, no wash clock and no per-shot solved depth.                      #
     * #                                                                        #
     * # SO WHAT IS 0.43 NOW? IT IS THE MEASURED CREDIT OF THAT HALO ON THE     #
     * # GATE'S OWN ONE-LETTER WINDOW. The gate models a ground as              #
     * # `grey * (1 - scrimAlpha)`; a halo is not a uniform multiply, so the    #
     * # honest question is what multiply it is WORTH over a window one capital #
     * # wide. Measured window by window at the SAME COLUMN on a rendered halo  #
     * # frame and a rendered bare one, restricted to windows whose bare ground #
     * # is above grey 147 — because for this ink (0.9813) only those can       #
     * # refuse a device at all:                                                #
     * #                                                                        #
     * #   measured worst credit of the shipped shape        0.443              #
     * #   what the gate needs to admit beat 28 at all       0.411              #
     * #   what the gate needs to admit beat 57 at all       0.296              #
     * #   what beat 28's LEVEL test needs                   0.324              #
     * #   the band this replaces, measured on a frame       0.338              #
     * #                                                                        #
     * # THE 0.411 IS THE WIDEST HEADING THE SCHEMA ADMITS, not this film's.    #
     * # "Cornplanter's land" is set at the settled cap and spans x 152..1767,  #
     * # and its own worst window demands 0.408. A 25-character heading shrinks #
     * # to the full measure, x 95.5..1823.5, and reaches brighter columns of   #
     * # the same page — so it is the demand the row has to clear.              #
     * #                                                                        #
     * # 0.43 SITS 3% UNDER THE MEASUREMENT, which is the same discipline       #
     * # `corner-label`'s 0.55 keeps against its own measured 0.568, and 0.019  #
     * # above what the hardest copy on beat 28 needs. Across ALL windows,      #
     * # including ones already dark enough to pass unaided, it falls to about  #
     * # 0.25, so the number is safe under today's 3.0 floor and would STOP     #
     * # being safe if that floor or the ink colour moved, because different    #
     * # windows would start binding.                                           #
     * #                                                                        #
     * # WHY THE CREDIT HOLDS AT EVERY HEADING SIZE, WHICH IS WHAT LETS ONE     #
     * # NUMBER SIT ON THIS ROW AT ALL. The heading shrinks to fit, so the halo #
     * # is typed as a RATIO of the cap rather than in pixels, and the gate     #
     * # sizes both its window and the rows it charges from the same cap. The   #
     * # credit then barely moves: 0.448 at the settled 132px cap against 0.443 #
     * # at the 91.2px one, on the same two pictures. `CHAPTER_PLATE_HALO_GLOW` #
     * # carries that table and the shapes it was chosen from.                   #
     * #                                                                        #
     * # RE-MEASURE THIS IF THE GLOW, THE PASS COUNT, THE RATIO, THE CAP        #
     * # HEIGHT OR THE INK COLOUR MOVES. Nothing in the repo can derive it and  #
     * # nothing goes red on its own. `typeGroundMirror.test.ts` records the    #
     * # measurement and names the renders, in the style `TOP_TITLE_SHADOW`'s   #
     * # own fit table already uses. That is the one real cost of the halo and  #
     * # it is written down rather than hidden.                                 #
     * ##########################################################################
     *
     * ##########################################################################
     * # THE THREE READERS AND WHY THEY ALL WANT THIS ONE NUMBER NOW.           #
     * #                                                                        #
     * #   G8   deviceChoice.ts        `washedGrey(beat.meanLuma, scrimAlpha)`  #
     * #                               against `maxMeanLuma`.                   #
     * #   G8c  edge ceiling           `scrimAlpha > 0` picks                   #
     * #                               `TYPE_GROUND_MAX_EDGE_P95_WASHED` over   #
     * #                               the bare 96.                             #
     * #   G8c  level and contrast     `readTypeGround(..., scrimAlpha)`.       #
     * #   T-7  planCheck.ts           the same, on the frozen plan. A MUST.    #
     * #                                                                        #
     * # THEY READ ONE FIELD, SO THEY CANNOT DISAGREE. For one day they could:  #
     * # G8 read this row while G8c and T-7 read a per-shot `washAlpha` off the #
     * # copy, and a whole term in the depth solver existed only to prove the   #
     * # two could never contradict each other. The band going deletes that     #
     * # proof obligation rather than discharging it.                            #
     * #                                                                        #
     * # AND SAY THIS OUT LOUD: AT ANY CREDIT THAT MAKES THE HALO WORK, THIS    #
     * # DEVICE'S BRIGHTNESS GATES STOP BEING ABLE TO FIRE. The 3.0 floor for   #
     * # this ink needs ground grey 147 or darker, so a pure white window at    #
     * # credit 0.424 already clears it; and `TYPE_GROUND_MAX_LEVEL`'s 0.62     #
     * # would need a region mean above 1.069, which does not exist.            #
     * # `corner-label` has been in this position since HEAD — its floor grey   #
     * # is 138, so it went vacuous at 0.459 and ships at 0.55 — so this is     #
     * # precedent rather than novelty. After this change the only LIVE picture #
     * # gate for either device is the busy rule,                               #
     * # `TYPE_GROUND_MAX_EDGE_P95_WASHED` at 128, which is what keeps a        #
     * # chapter plate off a busier document than beat 28. That is a real       #
     * # weakening and it is accepted knowingly. If a live brightness gate is   #
     * # wanted here it has to come from a different measurement — a ceiling on #
     * # the RAW brightest window rather than the washed one — and NOT from     #
     * # understating the credit, because 0.39 refuses beat 28 and that shot    #
     * # then plays with no heading at all.                                     #
     * ##########################################################################
     *
     * ##########################################################################
     * # WHY THE BAND WENT, ON NUMBERS. ALL ROWS RENDERED THROUGH THE REAL      #
     * # `Segment` COMPOSITION OVER THE DELIVERED FILM'S OWN CLEAN FRAMES,      #
     * # SETTLED FRAME 90, GLYPH FILL TRANSPARENT so each shape's own rows hold #
     * # the ground it leaves and no cream ink pollutes the window mean.        #
     * #                                                                        #
     * #   b28 "Cornplanter's land" over the 1940 census page, bare worst       #
     * #       window grey 248; b57 "Surveyors and a plan" over the turquoise   #
     * #       lake the client has ALREADY ACCEPTED, bare worst window 209.     #
     * #                                                                        #
     * #   shape                    b28     b57    darkened    above the caps   #
     * #   bare picture           1.04 X  1.50 X        1 px          1 px      #
     * #   TOP_TITLE_SHADOW alone 1.81 X  2.59 X  128,480 px      2,375 px      #
     * #   corner-label's 2x16    2.79 X  3.98      185,754 px      5,846 px    #
     * #   THE HALO, 3x0.242 cap  3.96    5.90      238,417 px     13,302 px    #
     * #   the band, solved       3.36    3.42      416,052 px    145,965 px    #
     * #                                                                        #
     * # X marks a window under the 3.0 floor. "above the caps" is darkened     #
     * # picture that carries no letter at all, and it excludes the ochre rule. #
     * #                                                                        #
     * # SO THE HALO READS BETTER THAN THE BAND IT REPLACES, on the gate's own  #
     * # unit, while darkening a twelfth as much picture that holds no type and #
     * # leaving the census page at grey 231 where the band left it at 160. The #
     * # band's nominal 0.47 is worth only 0.338 on a rendered frame, because   #
     * # the house grade composites OVER it and the toe lift puts light back    #
     * # in — `carriesOwnGrade: false` below is that fact.                       #
     * #                                                                        #
     * # THE CORNER LABEL'S HALO DOES NOT TRANSFER, WHICH IS WHY THIS ROW HAS   #
     * # ITS OWN SHAPE AND ITS OWN NUMBER. Copied literally, 2 passes of 16px   #
     * # reads 2.79:1 here. The 5.08:1 recorded on the row below for "beat 28"  #
     * # is the CORNER LABEL's 65px window in that picture's top-right corner,  #
     * # with ink 0.8705 over rows 211..265. This heading is a 158px window     #
     * # across the middle of the page with ink 0.9813, and the same halo there #
     * # is worth 2.79. Two devices, two windows, two inks, two numbers.        #
     * #                                                                        #
     * # HIS OWN REFERENCE IS A HALO AND NOT A BAND, AND IT IS POLISH RATHER    #
     * # THAN RESCUE. `chapter title v2` sets a heading over a BUSIER printed   #
     * # page with the page fully intact. Measured off clip frame 260 against   #
     * # frame 40 as its control, his cap is 134px against our settled 132 —    #
     * # the same type at the same size, so a pixel 3px from a stroke is the    #
     * # same place on the same letter: peak effective alpha 0.159 at 3px,      #
     * # 0.047 at 12px, 0.012 at 30px, deepest single pixel 0.476. His page     #
     * # runs 137 to 148 grey, so his ink is already near 3.25:1 bare.          #
     * #                                                                        #
     * # AND HIS OWN REFERENCE WOULD BE REFUSED BY THIS GATE. Run it on his     #
     * # frame: his 160.8px one-letter window's worst bare reading is 2.45:1,   #
     * # ground grey 163 at x662, BELOW the 3.0 floor this project holds every  #
     * # title to. The 3.25 is his page's REGION MEAN and the two are a whole   #
     * # ratio apart, for the same reason ALLEGHENY's rectangle looked innocent #
     * # while three of its letters sat at 1.11:1.                              #
     * #                                                                        #
     * # SO OURS IS ABOUT FIVE AND A HALF TIMES HIS DEPTH — 0.860 effective     #
     * # alpha at 3px from a stroke on the census page against his 0.159 — AND  #
     * # THAT IS A TASTE CALL HE HAS NOT BEEN SHOWN. Part of the gap is honest  #
     * # (his page is 140 grey, beat 28's is 248) and part of it is that he is  #
     * # not holding himself to 3.0:1 on a one-letter window at all. On beat    #
     * # 57's lake ours dies to 0.002 by 40px so it is genuinely local there;   #
     * # on the census page it is still 0.39 at 40px, because the heading is    #
     * # 1615px of densely packed type and almost nothing is further than that  #
     * # from a stroke. SEND HIM tmp/f1/f3-b28.mp4 AND tmp/f1/f3-b57.mp4, WHICH #
     * # ARE THE SHIPPED COMPONENT OVER THOSE TWO PICTURES FOR 150 FRAMES,      #
     * # BEFORE THE RENDER. The earlier round's f2c-*.mp4 are a HEAVIER halo    #
     * # (3 passes at 0.295 of cap) and must not be sent as this one.           #
     * #                                                                        #
     * # WHAT IT WAS ALL MEASURED OVER HAS TO BE SAID OUT LOUD. None of this    #
     * # job's 115 source JPEGs is on this laptop, so every ground here is the  #
     * # DELIVERED FILM'S OWN CLEAN FRAME — beat 28 is film frame 3097 — already#
     * # cropped to 16:9, already graded, already carrying its ambience and     #
     * # already through h.264. The margin at 0.43 is 0.024 over what beat 28's #
     * # 248 demands; if the real JPEG reads brighter, the demand rises and the #
     * # margin closes. Re-measure beat 28 and beat 57 on the box before the    #
     * # paid run, and if the gap comes back the CREDIT moves, not the rule.    #
     * #                                                                        #
     * # WHAT WAS NOT COVERED: two pictures, two cap sizes, one heading each.   #
     * # Not covered — a heading whose widest inter-word gap exceeds the 158px  #
     * # window, which is the case that hunts a halo the way "New York" and     #
     * # "Iron Ridge" were built to hunt the corner label's; the film's other   #
     * # 113 pictures; and the shots the busy rule already refuses. Only one of #
     * # the 115 is a document, so this gate's hardest case is a sample of one. #
     * #                                                                        #
     * # AND ONE THING THE NUMBERS DO NOT SAY. On a SETTLED STILL of beat 57    #
     * # the band at 0.37 reads as a gentle even tone rather than as murk,      #
     * # while the halo there reads as an irregular smudge. The clip is where   #
     * # the band loses: at frames 12, 24 and 48 it is at full depth across the #
     * # whole width while the type is still three quarters size and still      #
     * # fading up. A reviewer who only looks at stills will say the band is    #
     * # not ugly on that shot, and they will be right about that frame.        #
     * ##########################################################################
     */
    scrimAlpha: 0.43,
    /*
     * Both of his samples are mid-bright pictures. Type this size has no
     * backing, so a bright picture eats it. 0.55 is the number `shadow-up`
     * already uses for the same problem.
     */
    maxMeanLuma: 0.55,
    minMeanLuma: null,
    /*
     * FALSE, so the house grade draws over it, exactly as `chapter-title` does.
     * This device filters nothing of its own, and the recorded consequence of
     * getting this wrong is a shot with no tone curve, toe lift, grain or
     * vignette sitting among ninety that have all four.
     */
    carriesOwnGrade: false,
  },

  /**
   * "text overlay 5.0". Two lines top left that type on character by character.
   */
  'top-title': {
    id: 'top-title',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'text overlay 5.0',
    /*
     * `shadow-up` first: it is the other device that sets a short line over the
     * whole shot, so it is the nearest thing to the same frame. `framed-card`
     * second, which is the house fallback for anything word-bearing.
     */
    fallbackTemplateIds: ['shadow-up', 'framed-card'],
    job: 'running_title',
    pictures: 1,
    /*
     * ##########################################################################
     * # 94, HIS SETTLE ON THE SHOT'S CLOCK, AND THE SAME FRAME FOR EVERY COPY. #
     * #                                                                        #
     * # It was 106, "his clip settles at 3.52s", read off the CLIP'S clock,    #
     * # which carries black before his composition starts. Re-measured on the  #
     * # shot's clock on 2026-09-17, his last character is whole on film frame  #
     * # 94, and `topTitleClock.ts` settles every copy on that same frame 94,   #
     * # whatever its length. The block fade is whole on frame 30.              #
     * #                                                                        #
     * # 106 -> 94 ONE COMMIT AFTER THE CLOCK, ON PURPOSE. This number is       #
     * # interpolated into the planner prompt ("needs a shot 3.1 to 8.0 seconds #
     * # long, which 46% of the last film's shots were", up from 3.5 and 31%),  #
     * # so moving it forces `VISUAL_PLAN_PROMPT_VERSION` up and the next job   #
     * # re-draws the whole sheet. The developer took that decision with prompt #
     * # version 19. 25 of the delivered cut's 164 shots run 94 to 105 frames,  #
     * # and G3 refused this device on every one of them at 106.                #
     * #                                                                        #
     * # THE SETTLE ITSELF, NOT SETTLE + 1, AND WHY THIS IS NOT "COSMOLOG".     #
     * # A shot of exactly 94 frames ends on frame 93. That frame draws the     #
     * # last character at 0.907 or more for every copy the schema admits, 57   #
     * # slots included, because each glyph FADES, and his own last g reads     #
     * # 0.90 there before it snaps whole. `corner-label`'s reveal is a hard    #
     * # step, so one frame short draws NO character, and its copy-aware check  #
     * # is held to strictly longer. `topTitleMirror.test.ts` pins both halves: #
     * # this equals the clock's settle, and the frame before it is 0.9 drawn.  #
     * ##########################################################################
     */
    buildEndFrames: 94,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    /*
     * SIX. Ours, not his. The client's standing complaint is too FEW word
     * devices — 28 against the ~39 he asked for — so this one is deliberately
     * generous. Six is what `framed-card` already carries.
     */
    maxPerFilm: 6,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    scrimAlpha: 0,
    maxMeanLuma: 0.55,
    minMeanLuma: null,
    /*
     * ##########################################################################
     * # TRUE, AND THE SHOT STILL GETS THE HOUSE GRADE. `TopTitle.tsx` MOUNTS IT. #
     * #                                                                        #
     * # The device draws the same `Grade` every other shot gets, from the      #
     * # scene's own `grade`, between its photograph and its type. `Scene` must #
     * # not stack a second one on top, and this flag is what tells it so.      #
     * #                                                                        #
     * # WHY THE TYPE SITS OVER THE GRADE. His note of 2026-09-16 said the      #
     * # title's colour was wrong. With the grade on top, `saturate(0.88)`      #
     * # cooled his #FFFCE8 cream and the vignette greyed the top-left words,   #
     * # "Elder" reading #F2F2E2 on a still over his own picture. His clip's    #
     * # type is one flat cream everywhere, and a vignette cannot be undone by a #
     * # flat colour, so the type has to be drawn after it.                     #
     * ##########################################################################
     */
    carriesOwnGrade: true,
  },

  /**
   * "text overlay 6.0". A caps line top right over a smaller caps kicker.
   */
  'corner-label': {
    id: 'corner-label',
    origin: 'client',
    enabled: true,
    disabledReason: null,
    supersededBy: null,
    officialFileName: 'text overlay 6.0',
    fallbackTemplateIds: ['framed-card'],
    job: 'corner_identification',
    pictures: 1,
    /*
     * ##########################################################################
     * # 101, AND IT WAS 54, AND A DELIVERED FILM CAUGHT THE DIFFERENCE.        #
     * #                                                                        #
     * # 54 was read off the spec's "his clip settles at 1.80s of 60fps", which #
     * # is true and is the LABEL'S last character. This device draws a label   #
     * # AND THEN A KICKER, and the kicker types on after it. 54 is therefore   #
     * # the settle of the first half of the build, not of the build.           #
     * #                                                                        #
     * # WHAT IT COST, on the film rendered 2026-09-14. Beat 107 drew           #
     * # "Stuckenbruck" over "Cosmology", 12 characters and 9, which            #
     * # `cornerLabelSettleFrame` puts at film frame 79. The shot was 79 frames #
     * # long. The final Y of COSMOLOGY lands one frame after the cut, so the   #
     * # delivered film reads "COSMOLOG" and stops. Confirmed by eye on the     #
     * # shot's last frame, not inferred.                                       #
     * #                                                                        #
     * # THIS IS THE CLIENT'S OWN V53 COMPLAINT, REPEATED. His note 2 was that  #
     * # the checklist's third line "never finished drawing at all, so its last #
     * # word was never on screen". Same defect, new device, and the gate that  #
     * # is supposed to prevent it is this number.                              #
     * #                                                                        #
     * # 101 IS THE SCHEMA MAXIMUM, not this beat's 79, because the gate must   #
     * # hold for every copy the schema admits: `cornerLabelSettleFrame(18, 14)`#
     * # = 101, from the 18-character label and 14-character kicker that        #
     * # `deviceText` allows. Sizing it to the copy that happened to be written #
     * # would leave the next longer line to find the same cut.                 #
     * #                                                                        #
     * # `cornerLabelClock.ts` computed this before the render and said so in   #
     * # as many words, adding that `devices.ts` was not that change's to edit. #
     * # It was right, and nothing read it until a frame proved it.             #
     * ##########################################################################
     */
    buildEndFrames: 101,
    holdsWellFrames: 240,
    defaultDurationFrames: 150,
    /* SIX, same reasoning as `top-title`. Ours, not his. */
    maxPerFilm: 6,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    typeOverPicture: 'scrim',
    /*
     * ##########################################################################
     * # THIS DEVICE NO LONGER PAINTS A BAND AT ALL, AND THIS NUMBER IS NO      #
     * # LONGER AN ALPHA ANY BOX ON THE FRAME CARRIES. READ THIS BEFORE         #
     * # TOUCHING IT.                                                           #
     * #                                                                        #
     * # Since 2026-09-21 `CornerLabel.tsx` carries its ground ON THE GLYPHS —  #
     * # `TOP_TITLE_SHADOW` with two stacked centred glows over it, built by    #
     * # `cornerLabelTextShadow` in `topTitleClock.ts`. There is no wash div,   #
     * # no plateau, no sideways mask and no wash clock.                        #
     * #                                                                        #
     * # SO WHAT IS 0.55 NOW? IT IS THE MEASURED CREDIT OF THAT HALO ON THE     #
     * # GATE'S OWN ONE-LETTER WINDOW. The gate models a ground as              #
     * # `grey * (1 - scrimAlpha)`; a halo is not a uniform multiply, so the    #
     * # honest question is what multiply it is WORTH over a window one capital #
     * # wide. Measured window by window at the same column on a rendered halo  #
     * # frame and a rendered bare one, restricted to windows whose bare ground #
     * # is above grey 138 — because only those can refuse a device at all:     #
     * #                                                                        #
     * #   "Allegheny"  on beat  1   0.568      "Illinois"      0.772           #
     * #                on beat 28   0.578      "New York"      0.685           #
     * #                on beat 57   0.585      "Iron Ridge"    0.760           #
     * #                on beat 59   no binding window at all                   #
     * #                                                                        #
     * # WORST CREDIT ANYWHERE IN THE SET 0.568, so 0.55 is conservative on     #
     * # every case measured and G8, G8c and planCheck T-7 need no change at    #
     * # all. The last two labels carry a SPACE, where a one-letter window can  #
     * # land on almost no stroke, and they were built on purpose to hunt that. #
     * #                                                                        #
     * # WHY THE CREDIT IS STABLE, WHICH IS THE WHOLE ENGINEERING ARGUMENT: the #
     * # gate's unit is a window ONE LETTER WIDE, and a letter's strokes fill   #
     * # about the same share of their own window whatever is behind them.      #
     * # Across ALL windows, including ones already dark enough to clear the    #
     * # floor unaided, the credit falls to 0.146 — so the model is safe under  #
     * # today's 3.0 floor and would STOP being safe if that floor or the ink   #
     * # colour moved, because different windows would start binding.           #
     * #                                                                        #
     * # RE-MEASURE THIS IF THE GLOW, THE FONT SIZE OR THE CAP HEIGHT MOVES.    #
     * # Nothing in the repo can derive it and nothing goes red on its own.     #
     * # `typeGroundMirror.test.ts` records the measurement and names the       #
     * # render that produced it, in the style `TOP_TITLE_SHADOW`'s own fit     #
     * # table already uses. That is the one real cost of the halo and it is    #
     * # written down rather than hidden.                                       #
     * #                                                                        #
     * # AND `typeOverPicture: 'scrim'` ABOVE NOW COVERS A GLYPH HALO AS WELL   #
     * # AS A BAND. The word is not widened, because three call sites branch on #
     * # the five-member union and `devices.test.ts` pins the exact strings on  #
     * # seven rows; every one of them wants the same answer for a halo as for  #
     * # a band — G9 refuses baked text under it, `sourceProtection` scores it  #
     * # with the scrims, `drawsWords` reads it as words. Said here instead.    #
     * ##########################################################################
     *
     * ##########################################################################
     * # WHY THE BAND WENT, ON NUMBERS. ALL ON BEAT 1'S OWN RENDERED FRAME,     #
     * # THROUGH THE REAL `Segment` COMPOSITION, WITH THE FILM'S OWN COPY       #
     * # ({label "Allegheny", kicker ""}), ITS OWN 79 FRAMES AND ITS OWN GRADE. #
     * #                                                                        #
     * #   shape                          worst window   darkened >8%   vs band #
     * #   bare picture                      1.06 FAIL             0       -    #
     * #   TOP_TITLE_SHADOW alone            1.76 FAIL        14,610      11%   #
     * #   house shadow x3                   2.83 FAIL        16,106      12%   #
     * #   THE HALO, 2x16px glow + shadow    4.54 OK          20,050      15%   #
     * #   tight band 0.35 + shadow          3.70 OK          42,496      31%   #
     * #   the band this replaces, 0.55      3.65 OK         135,023     100%   #
     * #                                                                        #
     * # So the halo reads BETTER than the band it replaces while darkening a   #
     * # seventh as much picture. Set THIS DEVICE'S label over beat 28's census #
     * # page and it reads 5.08:1, leaving the printed table legible where the  #
     * # band washed out 218,575 pixels of it.                                  #
     * #                                                                        #
     * # THAT 5.08 IS THIS DEVICE'S WINDOW AND SAYS NOTHING ABOUT THE CHAPTER   #
     * # PLATE'S, AND IT HAS ALREADY BEEN READ THE WRONG WAY ONCE. It is a 65px #
     * # window in that picture's TOP-RIGHT CORNER with ink 0.8705 over rows    #
     * # 211..265. A chapter heading on the same page is a 158px window across  #
     * # the middle with ink 0.9813, and this exact halo there measures 2.79:1  #
     * # — under the floor. The chapter plate's own row carries its own shape   #
     * # and its own credit for that reason.                                    #
     * #                                                                        #
     * # THE SHADOW ALONE CANNOT DO IT, which was the first thing tried and the #
     * # right instinct: 1.76:1 against a 3.0 floor, and THREE stacked copies   #
     * # of it still only reach 2.83. A 65px window averages ground the halo    #
     * # never reaches, so the glow is what closes the gap.                     #
     * #                                                                        #
     * # HIS OWN REFERENCE IS A HALO AND NOT A BAND. `chapter title v2` sets a  #
     * # heading over a BUSIER printed page with no band at all: beyond 40px    #
     * # from any stroke his page is unchanged, effective alpha 0.000 exactly   #
     * # over 12,361 pixels, peaking at 0.162 about 3px out and gone by 18px.   #
     * # `TOP_TITLE_SHADOW` already IS that shape, fitted from his own clips,   #
     * # so there was nothing to derive. HIS HALO IS POLISH, NOT RESCUE: his    #
     * # page reads 134 to 142 grey, so his ink is already at about 3.25:1 bare #
     * # and his halo takes it to roughly 4.5. On beat 1's 254 sky the same     #
     * # shape measures 1.76:1. Ours has to be about two and a half times       #
     * # heavier than his for that reason, and THAT IS A TASTE CALL HE HAS NOT  #
     * # BEEN SHOWN. SEND HIM tmp/f1/c-halo.mp4 BEFORE THE RENDER.              #
     * #                                                                        #
     * # WHAT IT WAS ALL MEASURED OVER HAS TO BE SAID OUT LOUD. None of this    #
     * # job's 115 source JPEGs is on this laptop, so every ground here is the  #
     * # DELIVERED FILM'S OWN CLEAN FRAME — beat 1 is film frame 89 — already   #
     * # cropped to 16:9, already graded and already carrying its ambience. The #
     * # label band's sky reads 246 rendered against 243.8 on that source       #
     * # frame, so the error is small here; but a sky is already near clipping  #
     * # and the direction on a bright one is not established. Re-measure on    #
     * # the box before the next paid run.                                      #
     * #                                                                        #
     * # WHAT WAS NOT COVERED: four pictures, four labels, one device, one font #
     * # size, and the probes were read at the SETTLED frame. No kicker was     #
     * # rendered with the halo and beat 1 has none. A label long enough to     #
     * # reach the title-safe left edge was not tested, and neither was one     #
     * # whose widest gap is wider than the 65px window.                        #
     * #                                                                        #
     * # Saku asked for "a little shadow/shade on the inage so the text is      #
     * # visible better. 20% should do the work" on 2026-08-25. A 20% band      #
     * # measures 1.43:1 on this picture. That gap between an asked-for number  #
     * # and a rendered frame is why this row is measured and not chosen.       #
     * ##########################################################################
     */
    scrimAlpha: 0.55,
    maxMeanLuma: 0.55,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },

  /**
   * "text Overlay winton churchill.mp4". A name and a role on a torn light
   * plate, bottom left.
   *
   * ##########################################################################
   * # SHIPS DISABLED, AND IT IS THE SAME BLOCKER THAT DISABLED `name-card`.  #
   * #                                                                        #
   * # Read `name-card`'s entry above. Its role line is a fact about a real    #
   * # person, the client's own rule says the face shown must NOT be the real  #
   * # one, and this script names living scholars. Putting a stranger's face   #
   * # under a real academic's name on a monetised channel is a live exposure. #
   * #                                                                        #
   * # THIS DEVICE HAS THE IDENTICAL EXPOSURE. A new drawing does not change   #
   * # the claim being made, and the claim is what the exposure is. The        #
   * # question was put to him in writing on 2026-08-23 and is one of three    #
   * # things still owed since August. It is UNANSWERED as of 2026-09-14.      #
   * #                                                                        #
   * # Everything else about it is built, registered and drawable. Flipping    #
   * # `enabled` to true and adding it to `plannerLibrary` is the whole of the #
   * # remaining work, the moment he answers. Do NOT flip it before he does.   #
   * ##########################################################################
   */
  'name-plate': {
    id: 'name-plate',
    origin: 'client',
    enabled: false,
    disabledReason: 'needs-external-fact',
    supersededBy: null,
    officialFileName: 'text Overlay winton churchill.mp4',
    fallbackTemplateIds: ['framed-card', 'photo-pop'],
    job: 'person_introduction',
    /*
     * ONE, not `name-card`'s two. a5 draws a cut-out portrait beside the shot;
     * this plate sits on the beat's own photograph and draws no second picture.
     */
    pictures: 1,
    /* His clip settles at 1.03s of 60fps = 31 frames at 30fps. */
    buildEndFrames: 31,
    holdsWellFrames: 150,
    defaultDurationFrames: 150,
    /* THREE, matching `name-card`. Ours by analogy, not his written number. */
    maxPerFilm: 3,
    capSource: 'unstated',
    positionRule: 'none',
    pictureSource: 'ownScene',
    mandatoryOnce: false,
    /*
     * The type sits on an opaque light plate, so the photograph's brightness
     * never reaches it. That is why there is no `maxMeanLuma` here and there is
     * one on the other three.
     */
    typeOverPicture: 'opaquePlate',
    scrimAlpha: 0,
    maxMeanLuma: null,
    minMeanLuma: null,
    carriesOwnGrade: false,
  },
}

/* ------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * The partner's seven weights, AS INTEGER HUNDREDTHS.
 *
 * ##########################################################################
 * # INTEGERS, NOT HIS DECIMALS, AND THE REASON IS THE RENDER KEY.          #
 * #                                                                        #
 * # A device choice reaches the compositor, so it is hashed. Float         #
 * # arithmetic that reorders under a compiler or a platform would fork the #
 * # segment cache for two runs that chose identically. `0.35 + 0.2 + 0.15` #
 * # is 0.7000000000000001 in IEEE 754; `35 + 20 + 15` is 70 everywhere.    #
 * #                                                                        #
 * # They sum to exactly 100, which is pinned by a test — retuning one term #
 * # without taking the same amount off another would silently rescale      #
 * # every comparison in the file.                                          #
 * ##########################################################################
 */
export const DEVICE_WEIGHTS = {
  narrativeJob: 35,
  sourceCountFit: 20,
  textNeedFit: 15,
  sourceProtection: 10,
  durationFit: 8,
  variety: 7,
  themeConsistency: 5,
} as const

/**
 * How many recent CHOICES the variety term looks back over.
 *
 * ##########################################################################
 * # THE WINDOW IS A PENALTY, NOT A REFUSAL, AND THE FIRST CUT GOT THAT     #
 * # WRONG IN A WAY THAT A TEST CAUGHT.                                     #
 * #                                                                        #
 * # Built as a hard cooldown, it could never CLEAR when only one device    #
 * # was eligible: the history only grows when something is chosen, so a    #
 * # film in which `framed-card` is the sole candidate would place it once  #
 * # and then refuse it forever. That silently caps the one device the      #
 * # client explicitly declared uncapped — "Does not have a hard rule".     #
 * #                                                                        #
 * # The partner's actual words are narrower than a cooldown and they carry #
 * # their own escape hatch: "Do not repeat the same template immediately   #
 * # WHEN ANOTHER ACCEPTED TEMPLATE FITS EQUALLY WELL", and then "Do not    #
 * # force variety when the narration clearly requires the same treatment." #
 * #                                                                        #
 * # So: repeating the IMMEDIATELY previous device is a hard refusal, and   #
 * # appearing anywhere else inside this window is a score penalty that a   #
 * # clearly better fit can outweigh. That is what he wrote.                #
 * ##########################################################################
 *
 * He gives a 3-5 range and no penalty number, so this ships the middle of his
 * range. Both this and `VARIETY_PENALTY` are one constant each to change when
 * he supplies the number.
 */
export const VARIETY_WINDOW = 4

/** How much of the variety term a device inside the window gives up, per hit. */
export const VARIETY_PENALTY = 300

/**
 * Every device the COMPOSITOR can draw, in registry order.
 *
 * Not the same list as "every device the tool may choose" since 2026-09-11. See
 * `PLACED_BY_OPERATOR_ONLY` below and read `plannerLibrary` / `chooserMaySelect`
 * wherever the question is about choosing rather than drawing.
 */
export function enabledDevices(): DeviceSpec[] {
  return DEVICE_IDS.map((id) => DEVICE_REGISTRY[id]).filter((spec) => spec.enabled)
}

/**
 * DEVICES THE FILM CAN DRAW BUT THE TOOL MAY NOT PLACE ON ITS OWN.
 *
 * ##########################################################################
 * # TWO MEMBERS SINCE 2026-09-11, a2 AND a3, AND ONE REASON: THE WORDS     #
 * # EACH DRAWS COME FROM A PERSON, NOT FROM THE NARRATION.                 #
 * #                                                                        #
 * # a2. His ruling asks it to highlight the phrase being discussed and to  #
 * # "generate a natural surrounding passage". Nothing inside               #
 * # `chooseDevices` may write words, and the upstream step that would is   #
 * # not built yet.                                                         #
 * #                                                                        #
 * # a3. He approved two chapter headings in writing on 2026-09-11. A       #
 * # heading he approved is not invented copy, but the chooser's only       #
 * # sources for one are the dossier and the planner, and neither is a      #
 * # heading he approved.                                                   #
 * #                                                                        #
 * # So each is drawable (`enabled`), refused by the chooser at G1 exactly  #
 * # as a disabled device is, never offered to the visual planner, and      #
 * # placed only from an `operator-placements` artifact that                #
 * # `checkOperatorPlacement` has passed.                                   #
 * #                                                                        #
 * # THE CHOOSER'S OUTPUT IS BYTE-IDENTICAL BECAUSE OF THIS. Both were      #
 * # refused `not-enabled` before and both still are, so no verdict or      #
 * # fallback seed can move. The standards count reads what a beat really   #
 * # draws, so it moves only where a hand placement lands on a beat that    #
 * # matched its standard. Each leaves this set on the day its automatic    #
 * # version lands, and not before: for a2 the step that writes its         #
 * # passage, for a3 an admission path fed only from headings he approved.  #
 * ##########################################################################
 */
export const PLACED_BY_OPERATOR_ONLY: ReadonlySet<DeviceId> = new Set<DeviceId>(['chapter-title', 'highlight-page'])

/** May the chooser return this device on its own? G1's question. */
export function chooserMaySelect(spec: DeviceSpec): boolean {
  return spec.enabled && !PLACED_BY_OPERATOR_ONLY.has(spec.id)
}

/**
 * The templates the visual planner is shown, in registry order.
 *
 * Kept equal to what the chooser may select, so the prompt, the tool enum and
 * `libraryFingerprint` do not move when a device becomes drawable without
 * becoming choosable. A stored sheet therefore stays valid, and the planner is
 * never offered a template whose rows the chooser would throw away.
 */
export function plannerLibrary(): DeviceSpec[] {
  return enabledDevices().filter(chooserMaySelect)
}

/**
 * Does this device put any of the NARRATION'S OWN WORDS on screen? T-4.
 *
 * ##########################################################################
 * # THIS IS THE LINE THE STANDARD DRAWS IN `T-4`, AND IT NEEDS A NAME      #
 * # BECAUSE A GATE IS ABOUT TO READ IT.                                    #
 * #                                                                        #
 * # T-4: "Must never displace a section mention competing for the same     #
 * # beat — a P03-carrying beat outranks a decorative one." So the chooser  #
 * # has to be able to ask, of a device, whether it is the decorative kind. #
 * #                                                                        #
 * # `typeOverPicture: 'none'` IS ALREADY EXACTLY THAT SET and it is not a  #
 * # coincidence. The field records where a device's type sits relative to  #
 * # the photograph, and 'none' is the answer for a device that sets no     #
 * # type at all: photo-pop, P22, P19 and gallery-strip. Every other        #
 * # enabled device prints a slot the narration filled — framed-card's      #
 * # caption on the film's own ground, P17's plate, P03's and P12's over a  #
 * # scrim. Derived rather than hand-listed, so a seventeenth device        #
 * # answers this question by declaring where its type goes, which the      #
 * # registry already forces it to do.                                      #
 * #                                                                        #
 * # NOT THE SAME QUESTION AS "IS IT COVERAGE". T-3 says a mention is       #
 * # covered only at TITLE size, and the standard's own table calls         #
 * # framed-card "a caption, not a title". So this predicate is necessary   #
 * # for coverage and nowhere near sufficient, and the gate that reads it   #
 * # says so where it reads it.                                            #
 * ##########################################################################
 */
export function drawsWords(spec: DeviceSpec): boolean {
  /*
   * ##########################################################################
   * # `typeOverPicture: 'none'` MEANS TWO DIFFERENT THINGS AND READING ONLY   #
   * # THE FIRST ONE INVERTED THIS PREDICATE ON TWO DEVICES.                   #
   * #                                                                        #
   * # It means "no type over a PHOTOGRAPH". For photo-pop, P22, P19 and       #
   * # gallery-strip that is the same as "no words at all". For the two        #
   * # devices with `pictures: 0` it is the opposite: `chapter-title` and      #
   * # `highlight-page` show NO photograph, so their type is not over one —    #
   * # and words are the entire thing they draw.                               #
   * #                                                                        #
   * # SO `chapter-title` READ AS WORDLESS, and G16 would have refused THE     #
   * # SECTION-HEADING TREATMENT on a section beat for carrying no words.      #
   * # Found the moment it was enabled, by the registry test that pins which   #
   * # devices put words on screen.                                            #
   * #                                                                        #
   * # WHY `pictures === 0` IS THE HONEST SECOND CLAUSE rather than a list of  #
   * # two ids: a device that shows no photograph AND draws no words would     #
   * # render an empty frame, which Saku's rule 6 forbids outright — "Every    #
   * # selected beat should contain a purposeful visual change or hold. Do not #
   * # leave an empty layout." So no-picture implies words, by his own rule.   #
   * ##########################################################################
   */
  return spec.typeOverPicture !== 'none' || spec.pictures === 0
}
