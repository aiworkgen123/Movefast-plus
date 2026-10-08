import { FRAME_WIDTH } from './schemas.js'

/**
 * `chapter-plate`'s ONE LINE, MEASURED BEFORE ITS WORDS MAY REACH A FRAME.
 *
 * ##########################################################################
 * # THIS IS THE LARGEST TYPE IN THE WHOLE SET, CENTRED, WITH NOTHING BUT   #
 * # THE FRAME AROUND IT.                                                   #
 * #                                                                        #
 * # `ChapterPlate.tsx` draws the heading on ONE line, with                 #
 * # `whiteSpace: 'nowrap'`, centred in a 1728 px title-safe box. It has no #
 * # plate, no scrim of its own and no column, and it never wraps, never    #
 * # shortens and never truncates.                                          #
 * #                                                                        #
 * # So a heading two words too long would run off BOTH edges of the frame, #
 * # at exit 0, with nothing red anywhere, and be first visible in a        #
 * # finished render three hours later. This file is what stops that, and   #
 * # since 2026-09-16 it stops it by SETTING THE HEADING SMALLER rather     #
 * # than by throwing it away.                                              #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES. A character count cannot tell `I`  #
 * # (0.376 em) from `W` (0.968 em), which is the lesson `p05Fit.ts`,       #
 * # `p02Fit.ts` and a3's own `chapterTitlePeakWidth` each paid for         #
 * # separately. a3's recorded failure is the exact shape of this one:      #
 * # "The Memory Passages" fits and "THE MEMORY PASSAGES" does not.         #
 * #                                                                        #
 * # CAPITALS ARE STILL THE WIDE CASE AND ARE NO LONGER A REFUSAL. The      #
 * # client's own sample "Three Great Ages" is 1487.61 px and draws at the  #
 * # settled size; "THREE GREAT AGES" is 1847.63 px and now draws at 93.5%  #
 * # of it. Only the extremes are refused now — twenty-five capital W is    #
 * # 4511.86 px and would have to be set at 38% of the settled size.        #
 * #                                                                        #
 * # SHRINKS TO FIT, AND REFUSES ONLY WHAT WOULD BE TOO SMALL TO READ AS   #
 * # A CHAPTER TITLE. NEVER TRUNCATES. A heading wider than the box is set  #
 * # smaller until it lands inside it, exactly as the client's own device   #
 * # does; a heading that would have to go below the floor is left off the  #
 * # frame entirely and never cut, because half a chapter heading under an  #
 * # ochre rule reads as a broken render rather than as a shorter title.    #
 * #                                                                        #
 * # THIS FILE REFUSED EVERY OVERSET HEADING UNTIL 2026-09-16. The client   #
 * # ruled that day, in writing: "Shrink long titles to fit. I would say    #
 * # maximum 25 character titles might be good limit." His own second       #
 * # reference sample was always the evidence for it and is now the proof   #
 * # of the arithmetic -- see `chapterPlateHeadingFontSizePx`.              #
 * ##########################################################################
 *
 * THE FACE IS THE FILM'S FIRST SERIF, AND IT IS VARIABLE, WHICH CHANGES HOW
 * ITS WIDTHS ARE READ.
 *
 * ##########################################################################
 * # `PlayfairDisplay-Variable.woff2` carries `fvar`, `gvar` AND `HVAR`, so #
 * # its `hmtx` table holds the DEFAULT instance only, wght 400.            #
 * # `fonts.ts` pins `SERIF_FAMILY` to 700 with a single-value `weight`     #
 * # descriptor, and at 700 every advance is the `hmtx` value PLUS that     #
 * # instance's `HVAR` delta. On the capitals the delta runs to +63 units,  #
 * # which is 13.5 px a character at this size, so reading `hmtx` straight  #
 * # would under-predict a sixteen-character heading by about 130 px and    #
 * # pass one that runs off the frame.                                      #
 * #                                                                        #
 * # `apps/web/src/lib/woff2Advances.ts` reads `hmtx` and nothing else,     #
 * # which is correct for the three STATIC Libre Franklin faces and wrong   #
 * # for this one. The numbers below were extracted by                      #
 * # `tmp/v53/overlays/fit/extract-playfair-700.mjs`, which walks the       #
 * # `HVAR` item variation store, and `chapterPlateMirror.test.ts` pins     #
 * # every one of them against the shipped bytes through the same walk.     #
 * ##########################################################################
 *
 * MEASURED AS WRITTEN, BECAUSE THE COMPONENT DRAWS IT AS WRITTEN.
 * `ChapterPlate.tsx` renders `{heading}` with no `textTransform`, so both cases
 * reach the frame and both are carried below. A heading an operator types in
 * capitals is therefore MEASURED rather than refused as unmeasurable, and the
 * German sharp s measures as the sharp s, which is the glyph that is drawn.
 *
 * KERNING AND LIGATURES ARE LEFT ON, as the component draws them. Playfair
 * ships `GPOS` and `GSUB`, so these sums over-predict by the pairs Chrome
 * tightens and the ligatures it substitutes. That is the direction to err in.
 * A gate that over-predicts refuses a heading that would just have fitted; one
 * that under-predicts ships a title off both edges of the frame.
 *
 * THE SUM IS THE ADVANCE BOX, NOT THE INK, so it is a few pixels wider than
 * what is actually painted, and it errs towards refusing for that reason too.
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `p05Fit.ts` and
 * `operatorPlacement.ts`. The compositor imports four subpaths of this package;
 * a subpath here would let it import this file, and this file imports
 * `./schemas.js`.
 *
 * ##########################################################################
 * # THE COMPOSITOR NOW CARRIES ITS OWN COPY OF THIS TABLE, IN               #
 * # `chapterPlateClock.ts`, AND THAT IS NOT A DUPLICATION THAT COULD HAVE   #
 * # BEEN AVOIDED.                                                           #
 * #                                                                        #
 * # Until 2026-09-16 core alone needed the widths, because the only thing   #
 * # they decided was whether the chooser ADMITTED a heading. Now they also  #
 * # decide what size the heading is DRAWN at, and only the compositor can   #
 * # draw. There is no third place to put them: core cannot import           #
 * # `apps/web`, the compositor cannot import this file, and nothing carries #
 * # a size from one to the other — `DeviceSchema`'s `chapter-plate` arm is  #
 * # `{ id, heading }` and widening it would change `renderKey` for every    #
 * # chapter plate in a delivered film.                                      #
 * #                                                                        #
 * # THE OLD NOTE HERE SAID A SUBPATH WOULD "turn every future correction of #
 * # a width into a full re-render of the client's film". That is now true   #
 * # of a width correction WHATEVER we do, because the drawn size depends on #
 * # the widths, so a corrected width is a different frame by definition.    #
 * # The argument for keeping this file off the compositor's import graph is #
 * # therefore the plain one: `./schemas.js` and zod do not belong in a      #
 * # Remotion bundle.                                                        #
 * ##########################################################################
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/chapterPlateMirror.test.ts` is the only file allowed to
 * import both sides. It pins every advance against the woff2 bytes in
 * `apps/web/public/fonts`, pins the clock's copy of this table against this
 * one character for character, and pins the two shrink functions against each
 * other bit for bit.
 */

/**
 * Playfair Display's advance for each character a heading may hold, in
 * thousandths of an em (`unitsPerEm` 1000), AT THE 700 INSTANCE.
 *
 * Printable ASCII in BOTH cases, the curly quotes, both dashes, the ellipsis,
 * the Latin-1 letters and OE/oe. That is the whole of the latin subset the file
 * ships, which is what `public/fonts/README.md` records: an accented character
 * outside Latin-1 falls back to another face, and falls back for every caption
 * in the film already.
 *
 * Read off the bytes by `tmp/v53/overlays/fit/extract-playfair-700.mjs`, whose
 * output is kept at `tmp/v53/overlays/fit/extract-playfair-700.out.txt` and
 * `tmp/v53/overlays/fit/playfair-700-advances.json`. NEVER typed from a
 * specimen, and never read from `hmtx` alone.
 */
export const CHAPTER_PLATE_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 233, '!': 288, '"': 369, '#': 620, $: 574, '%': 728, '&': 898, "'": 209, '(': 318, ')': 318, '*': 481, '+': 574,
  ',': 271, '-': 481, '.': 270, '/': 368,
  '0': 645, '1': 383, '2': 523, '3': 488, '4': 528, '5': 459, '6': 561, '7': 455, '8': 561, '9': 553,
  ':': 290, ';': 296, '<': 602, '=': 635, '>': 602, '?': 508, '@': 884,
  A: 667, B: 672, C: 705, D: 776, E: 634, F: 592, G: 735, H: 800, I: 376, J: 364, K: 714, L: 611, M: 927,
  N: 722, O: 793, P: 641, Q: 793, R: 692, S: 584, T: 668, U: 689, V: 668, W: 968, X: 691, Y: 623, Z: 602,
  '[': 322, '\\': 368, ']': 322, '^': 529, _: 608, '`': 296,
  a: 518, b: 586, c: 496, d: 598, e: 504, f: 352, g: 553, h: 608, i: 315, j: 297, k: 585, l: 311, m: 905,
  n: 614, o: 565, p: 600, q: 585, r: 467, s: 462, t: 352, u: 606, v: 508, w: 787, x: 536, y: 519, z: 474,
  '{': 333, '|': 253, '}': 333, '~': 668,
  '‘': 258, '’': 253, '“': 464, '”': 459, '–': 602, '—': 895, '…': 830,
  À: 667, Á: 667, Â: 667, Ã: 667, Ä: 667, Å: 667, Æ: 889, Ç: 705, È: 634, É: 634, Ê: 634, Ë: 634,
  Ì: 376, Í: 376, Î: 376, Ï: 376, Ð: 776, Ñ: 722, Ò: 793, Ó: 793, Ô: 793, Õ: 793, Ö: 793, Ø: 793,
  Ù: 689, Ú: 689, Û: 689, Ü: 689, Ý: 623, Þ: 621,
  ß: 657, à: 518, á: 518, â: 518, ã: 518, ä: 518, å: 518, æ: 741, ç: 496, è: 504, é: 504, ê: 504,
  ë: 504, ì: 315, í: 315, î: 315, ï: 315, ð: 567, ñ: 614, ò: 565, ó: 565, ô: 565, õ: 565, ö: 565,
  ø: 565, ù: 606, ú: 606, û: 606, ü: 606, ý: 519, þ: 584, ÿ: 519,
  Œ: 995, œ: 814,
}

/* ------------------------------------------------- the component's type -- */

/** `CHAPTER_PLATE_TYPE.capHeightPx`. Measured off the client's own frame, never typed. */
export const CHAPTER_PLATE_CAP_HEIGHT_MIRROR = 132

/**
 * `CHAPTER_PLATE_TYPE.capOverEm`. Playfair's `OS/2.sCapHeight` of 708 over its
 * 1000 units per em, at the 700 instance as well as at the default.
 */
export const CHAPTER_PLATE_CAP_OVER_EM_MIRROR = 0.708

/**
 * `CHAPTER_PLATE_HEADING_FONT_SIZE_PX`, 214.689 px, DERIVED THE SAME WAY THE
 * CLOCK DERIVES IT rather than copied as a decimal.
 *
 * A font size cannot be measured off a video, only ink can, so the clock
 * measures the cap height and divides. Written as the same division here so the
 * two cannot drift by a rounding.
 */
export const CHAPTER_PLATE_FONT_SIZE_MIRROR = CHAPTER_PLATE_CAP_HEIGHT_MIRROR / CHAPTER_PLATE_CAP_OVER_EM_MIRROR

/** `CHAPTER_PLATE_TYPE.fontWeight`, and the instance the advances above were read at. */
export const CHAPTER_PLATE_FONT_WEIGHT_MIRROR = 700

/**
 * ZERO, AND THE ZERO IS LOAD-BEARING.
 *
 * ##########################################################################
 * # `ChapterPlate.tsx` sets no `letterSpacing`, so Chrome puts none in the #
 * # line box, and the sum below is the advances alone. It is a mirror      #
 * # rather than an omission so that the day the plate gains tracking the   #
 * # gate gains it too, in ONE place, and `chapterPlateMirror.test.ts` goes #
 * # red if the component gains it and this does not.                       #
 * #                                                                        #
 * # WHEN IT IS NOT ZERO, IT IS ADDED AFTER EVERY CHARACTER INCLUDING THE   #
 * # LAST. See the box on `chapterPlateRunWidth`. Counting it per GAP is    #
 * # the defect this project has already shipped once.                      #
 * ##########################################################################
 */
export const CHAPTER_PLATE_LETTER_SPACING_MIRROR = 0

/**
 * `SAFE_AREA_X` from `apps/web/src/remotion/constants.ts`, the title-safe
 * margin this project uses everywhere.
 */
export const CHAPTER_PLATE_SAFE_AREA_X_MIRROR = 96

/**
 * THE MEASURE, AND IT IS THE TITLE-SAFE BOX RATHER THAN THE FRAME.
 *
 * ##########################################################################
 * # `ChapterPlate.tsx` lays the heading into `FRAME_WIDTH - 2 *            #
 * # SAFE_AREA_X` = 1728 px and centres it there, so 1728 is not a margin   #
 * # invented here, it is the box the component actually draws into.        #
 * #                                                                        #
 * # NOT 1920. A heading that ends 10 px from the frame edge has not run    #
 * # off anything, but it is inside the margin every other device in this   #
 * # film respects, and `SPEC-measured.md` already flags exactly that on    #
 * # the client's own overlay 6.0: "right edge lands 38px from frame edge.  #
 * # That is inside the title-safe margin this project uses everywhere      #
 * # else." The client's own chapter rule is 1716 px wide and his widest    #
 * # sample heading is 1707 px of ink, so both of his own frames sit inside #
 * # this box with room to spare. 1728 is his design, not a haircut on it.  #
 * #                                                                        #
 * # a3 MEASURES AGAINST 1920 WITH NO MARGIN, AND THAT IS NOT A             #
 * # DISAGREEMENT. `chapterTitlePeakWidth` is checked against `FRAME_WIDTH` #
 * # because a heading the client had already approved in writing is       #
 * # 1896 px wide and a margin would have refused it. Nothing here is       #
 * # approved yet, so this one starts at the house margin.                  #
 * ##########################################################################
 */
export const CHAPTER_PLATE_MAX_WIDTH = FRAME_WIDTH - 2 * CHAPTER_PLATE_SAFE_AREA_X_MIRROR

/**
 * How wide a run of characters draws, in screen pixels, at an arbitrary size and
 * tracking, or null when it holds a character the mirror does not name.
 *
 * ##########################################################################
 * # `letter-spacing` IS ADDED AFTER EVERY CHARACTER INCLUDING THE LAST.    #
 * #                                                                        #
 * # That is what Chrome puts into the line's own width, and it is not      #
 * # obvious: the last character's spacing sits past the last glyph with    #
 * # nothing after it, so it LOOKS like a gap count. Counting per gap       #
 * # under-predicts by one tracking unit per line, which is how an overflow #
 * # shipped once already (the rule `p03WordWidth` records).                #
 * #                                                                        #
 * # AN UNMEASURED CHARACTER REFUSES RATHER THAN GUESSES. Never an average  #
 * # width: Chrome would draw the character in whatever face it falls back  #
 * # to, at a width nothing here knows, and an average is a number that     #
 * # cannot be wrong in a way anybody notices until the render.             #
 * ##########################################################################
 *
 * Exported because it is the law rather than a helper. The plate's own tracking
 * is zero today, so nothing else could exercise the "including the last" half
 * of it, and a law nothing can test is a law that quietly stops holding.
 */
export function chapterPlateRunWidth(run: string, sizePx: number, trackingPx: number): number | null {
  let thousandths = 0
  let characters = 0
  for (const character of run) {
    const advance = CHAPTER_PLATE_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (thousandths / 1000) * sizePx + characters * trackingPx
}

/**
 * The words of a heading as the component lays them out.
 *
 * `white-space: nowrap` collapses runs of whitespace and drops the leading and
 * trailing ones exactly as `normal` does; the only thing it changes is that it
 * refuses to break. So "A  B" draws as "A B", and a heading typed with a
 * trailing space draws without it.
 *
 * Cased as written, because `ChapterPlate.tsx` renders `{heading}` with no
 * `textTransform`.
 */
function wordsOf(line: string): string[] {
  return line
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
}

/**
 * How wide the heading draws on its one line, in screen pixels, or null when it
 * holds a character the mirror does not name.
 */
export function chapterPlateHeadingWidth(line: string): number | null {
  return chapterPlateRunWidth(
    wordsOf(line).join(' '),
    CHAPTER_PLATE_FONT_SIZE_MIRROR,
    CHAPTER_PLATE_LETTER_SPACING_MIRROR,
  )
}

/* ---------------------------------------------------------- the shrink -- */

/**
 * THE SMALLEST CAP HEIGHT THIS DEVICE MAY BE DRAWN AT AND STILL BE THIS DEVICE.
 *
 * ##########################################################################
 * # 90 px OF CAP, AGAINST THE 132 px THE SETTLED HEADING DRAWS AT. Stated  #
 * # as a cap height and not as a ratio, because cap height is the one      #
 * # quantity in this device a person can put a ruler on: every measurement #
 * # in `chapterPlateClock.ts` was taken that way, off the client's own     #
 * # frame, and this is the number they would be compared with.             #
 * #                                                                        #
 * # WHY A FLOOR EXISTS AT ALL. His ruling of 2026-09-16 is "shrink long    #
 * # titles to fit", and a pure shrink has no bottom: twenty-five capital W #
 * # would be set at a 50.6 px cap, which is a caption in a serif and not a #
 * # chapter title. The floor is the line under which this stops being the  #
 * # biggest mark in the film and starts being small type over a photo.     #
 * # Same shape of argument as `OVERLAY_FULL_FRAME_MIN_CAP_FRACTION` in     #
 * # `apps/web/src/remotion/constants.ts`, which is the house exemplar for  #
 * # shrink-to-fit-with-a-floor and justifies its own floor as a multiple   #
 * # of the next-smallest treatment on the frame.                           #
 * #                                                                        #
 * # WHY 90 AND NOT SOMETHING ELSE. Three measurements, in the order they   #
 * # were weighed:                                                          #
 * #                                                                        #
 * #   1. THE CLIENT'S OWN SHRINK NEVER GOES NEAR IT. His second reference  #
 * #      sample, "The Elder Earth Passage", 23 characters, needs 82.53% of #
 * #      the settled size in this face, a 108.9 px cap. That is the only   #
 * #      shrink he has ever shown us and it clears 90 by 19 px.            #
 * #                                                                        #
 * #   2. THE NEW 25-CHARACTER BOUND MEANS 25 REAL CHARACTERS. Every        #
 * #      whole-word run of THIS FILM'S OWN SCRIPT up to 25 characters,     #
 * #      4,452 distinct runs over its 1,414 words, was put through         #
 * #      `chapterPlateHeadingFontSizePx`. The widest is "dead remember us  #
 * #      The Book" at 2466 px, which sets at a 92.5 px cap. ALL 4,452 of   #
 * #      them clear 90. A floor of 92 would clear the widest by half a     #
 * #      pixel, which is a coincidence rather than a margin; 90 clears it  #
 * #      by 2.5 px, about 3%.                                              #
 * #                                                                        #
 * #   3. IT CANNOT BE MISTAKEN FOR A CAPTION AT THE FLOOR. The film's      #
 * #      captions are set at 52 px, a cap of about 37 px, so the floor is  #
 * #      2.4 times the caption's cap. `chapter-title`, the film's OTHER    #
 * #      chapter style and one of the two the client signed off on         #
 * #      2026-09-16, draws a 106.21 px cap at rest and 128.5 px at its     #
 * #      zoom peak, so at the floor this is the smaller of the two marks.  #
 * #      That one is white on its own black card and this one is set over  #
 * #      a photograph, and the two are never on a frame together.          #
 * #                                                                        #
 * # WHAT IT COSTS, MEASURED RATHER THAN GUESSED. Over those same 4,452     #
 * # runs a floor of 90 px of cap refuses NONE of them as written, and      #
 * # refuses 750 of the 4,452 when the same runs are upper-cased. So the    #
 * # floor still bites on capitals, which is the wide case this file has    #
 * # always been about, and never bites on the copy the planner is asked    #
 * # for.                                                                   #
 * ##########################################################################
 */
export const CHAPTER_PLATE_MIN_CAP_HEIGHT_PX = 90

/**
 * The floor as a font size, derived the way the settled size is derived, so a
 * change to the face's cap ratio moves both together.
 *
 * 90 / 0.708 = 127.12 px, which is 68.18% of the settled 186.44 px.
 */
export const CHAPTER_PLATE_MIN_FONT_SIZE_PX =
  CHAPTER_PLATE_MIN_CAP_HEIGHT_PX / CHAPTER_PLATE_CAP_OVER_EM_MIRROR

/**
 * THE SIZE THE HEADING IS ACTUALLY DRAWN AT: the settled size, or the largest
 * that lands inside the title-safe box, whichever is smaller. Null when the
 * heading holds a character the mirror does not name, or is not a heading.
 *
 * ##########################################################################
 * # THIS IS THE CLIENT'S OWN DEVICE'S ARITHMETIC, AND HIS SECOND SAMPLE IS #
 * # THE PROOF RATHER THAN THE MOTIVE.                                      #
 * #                                                                        #
 * # `SPEC-measured.md` section 1 carries two settled frames off his        #
 * # delivered `chapter title v2.mp4`:                                      #
 * #                                                                        #
 * #   sample 1  "Three Great Ages"        16 chars  ink x 222..1697        #
 * #   sample 2  "The Elder Earth Passage" 23 chars  ink x 106..1813        #
 * #                                                                        #
 * # HIS SAMPLE 2 IS SET SMALLER THAN HIS SAMPLE 1. That was recorded as an #
 * # observation the day the device was built and never acted on, because   #
 * # building it needed this advance table and there was none. Now there    #
 * # is, and the formula below reproduces his frame:                        #
 * #                                                                        #
 * #   his sample 2 ink              1708 px wide                           #
 * #   ours, shrunk by this formula  1728 px of ADVANCE, and an advance box #
 * #                                 runs about 12 px wider than its ink on #
 * #                                 sample 1, so about 1716 px of ink      #
 * #   agreement                     about 8 px over 1708, under half a     #
 * #                                 percent                                #
 * #                                                                        #
 * #   his two samples, ink-box height ratio   149 / 180 = 0.828            #
 * #   ours, by this formula                   1728 / 2093.73 = 0.8253      #
 * #   agreement                               0.3%                         #
 * #                                                                        #
 * # TWO INDEPENDENT READINGS OF HIS OWN FRAME, ONE HORIZONTAL AND ONE      #
 * # VERTICAL, BOTH LANDING ON "IT FITS THE BOX". So this is not a scheme   #
 * # invented to satisfy the ruling, it is the ruling and his own reference #
 * # agreeing.                                                              #
 * #                                                                        #
 * # THE EXPRESSION IS `(size * measure) / width` AND THE ORDER MATTERS.    #
 * # `chapterPlateClock.ts` carries the same function for the compositor,   #
 * # because `packages/core` and `apps/web` cannot import each other, and   #
 * # the two must agree to the LAST BIT. A size half a float apart would    #
 * # put a heading a hair over the title-safe edge at exit 0, which is the  #
 * # exact failure this whole file exists to prevent. It is written the     #
 * # same way on both sides, and `chapterPlateMirror.test.ts` pins them     #
 * # with `toBe` rather than `toBeCloseTo`. Do NOT "simplify" this to       #
 * # `size * (measure / width)`; that is a different number.                #
 * #                                                                        #
 * # AND A HEADING THAT ALREADY FITS RETURNS THE SETTLED SIZE EXACTLY, by   #
 * # the early return rather than by multiplying and dividing back to it.   #
 * # Every heading this film has drawn so far goes down that branch, so     #
 * # nothing that already ships moves by a rounding.                        #
 * ##########################################################################
 */
export function chapterPlateHeadingFontSizePx(line: string): number | null {
  const width = chapterPlateHeadingWidth(line)
  if (width === null || width <= 0) return null
  if (width <= CHAPTER_PLATE_MAX_WIDTH) return CHAPTER_PLATE_FONT_SIZE_MIRROR
  return (CHAPTER_PLATE_FONT_SIZE_MIRROR * CHAPTER_PLATE_MAX_WIDTH) / width
}

/**
 * May this heading be drawn at all?
 *
 * ##########################################################################
 * # IT NO LONGER ASKS "DOES THIS FIT". Everything fits now, because the    #
 * # size shrinks. It asks the question that is left: is what fits still    #
 * # big enough to be the biggest mark in the film? The wording and the     #
 * # shape are lifted from `overlayFitsFullFrame`, which answered the same  #
 * # question for the year card a month earlier.                            #
 * #                                                                        #
 * # THE NAME IS KEPT ON PURPOSE. It is the chooser's gate, `device-replay` #
 * # prints it by name, and three files name it in prose. A rename would    #
 * # have been a bigger diff than the behaviour change.                     #
 * #                                                                        #
 * # AN EMPTY OR ALL-WHITESPACE HEADING STILL DOES NOT FIT, because it is   #
 * # not a heading: the component would draw a 1716 px ochre rule with      #
 * # nothing over it, which is the empty-block defect every template in     #
 * # this repo already refuses. Nor does a heading holding a character the  #
 * # mirror cannot measure, for the reason `chapterPlateRunWidth` gives.    #
 * ##########################################################################
 */
export function chapterPlateHeadingFits(line: string): boolean {
  const size = chapterPlateHeadingFontSizePx(line)
  return size !== null && size >= CHAPTER_PLATE_MIN_FONT_SIZE_PX
}

/**
 * THE WIDEST A HEADING MAY MEASURE AND STILL BE ADMITTED, in screen pixels at
 * the settled size. 1728 * 186.44 / 127.12 = 2534.4 px.
 *
 * Derived rather than typed, and exported because it is the one number that
 * says what the floor actually refuses without anyone inverting the formula by
 * hand. An unmeasurable character and an empty heading are refused for their
 * own reasons and are not covered by it.
 */
export const CHAPTER_PLATE_MAX_ADMITTED_WIDTH =
  (CHAPTER_PLATE_MAX_WIDTH * CHAPTER_PLATE_FONT_SIZE_MIRROR) / CHAPTER_PLATE_MIN_FONT_SIZE_PX

/**
 * How many lines the heading WOULD take if the plate wrapped, `Infinity` when
 * one word alone is wider than the measure, or null when it holds an unmeasured
 * character.
 *
 * ##########################################################################
 * # THE PLATE DOES NOT WRAP, AND SINCE 2026-09-16 THIS DOES NOT EXPLAIN A  #
 * # REFUSAL EITHER. READ THIS BEFORE QUOTING IT AT ANYONE.                 #
 * #                                                                        #
 * # It used to say WHY `chapterPlateHeadingFits` had refused a heading:    #
 * # two lines meant "too many words", `Infinity` meant "one word is wider  #
 * # than the whole measure, only different words will do". Neither is a    #
 * # refusal any more. The heading SHRINKS, so a two-line heading is simply #
 * # set smaller, and a single over-wide word is set smaller too.           #
 * #                                                                        #
 * # WHAT IT STILL IS: the count of lines the heading would take AT THE     #
 * # SETTLED SIZE, which is a plain reading of how far past the measure the #
 * # words run and therefore of how hard the shrink is working. 2 means the #
 * # heading is being set somewhere between full size and half; `Infinity`  #
 * # means one word alone is over the measure, which is still worth saying  #
 * # out loud because that word will be set small on its own.               #
 * #                                                                        #
 * # THE REFUSAL NOW LIVES ENTIRELY IN `CHAPTER_PLATE_MIN_CAP_HEIGHT_PX`.   #
 * #                                                                        #
 * # A GREEDY FILL ON SPACES, which is what Chrome's line breaker does with #
 * # ordinary text, exactly as `p05Fit.ts` does it. A space between two     #
 * # words costs its own advance and tracking; the space a line breaks on   #
 * # hangs and costs nothing. Chrome may also break after a hyphen and this #
 * # does not, and fewer break opportunities can only predict MORE lines,   #
 * # so it errs towards refusing.                                           #
 * ##########################################################################
 */
export function chapterPlateHeadingLineCount(line: string): number | null {
  const words = wordsOf(line)
  if (words.length === 0) return 0
  const space = chapterPlateRunWidth(' ', CHAPTER_PLATE_FONT_SIZE_MIRROR, CHAPTER_PLATE_LETTER_SPACING_MIRROR)
  if (space === null) return null

  let lines = 1
  let used = 0
  for (const word of words) {
    const width = chapterPlateRunWidth(word, CHAPTER_PLATE_FONT_SIZE_MIRROR, CHAPTER_PLATE_LETTER_SPACING_MIRROR)
    if (width === null) return null
    if (width > CHAPTER_PLATE_MAX_WIDTH) return Number.POSITIVE_INFINITY
    if (used === 0) {
      used = width
      continue
    }
    if (used + space + width <= CHAPTER_PLATE_MAX_WIDTH) {
      used += space + width
      continue
    }
    lines += 1
    used = width
  }
  return lines
}

/* ------------------------------------------------------- the prompt cap -- */

/**
 * THE LENGTH A HEADING MAY BE ASKED FOR, WHICH IS NOT THE SCHEMA BOUND.
 *
 * ##########################################################################
 * # MEASURED, NOT ESTIMATED, on this film's own script                     #
 * # (`tmp/v52/render/segment.json`, 8,578 characters, 1,414 words once     #
 * # edge punctuation is stripped): every run of consecutive whole words,   #
 * # 9,874 distinct runs up to 48 characters, put through the gate above by #
 * # `tmp/v53/overlays/fit/measure-chapter-plate-runs.mjs`. Its output is   #
 * # kept beside it.                                                        #
 * #                                                                        #
 * # THIRTEEN. Every run up to 13 characters fits the 1728 px box. The      #
 * # first refusal arrives at 14, "Qumran Hodayot" at 1728.9 px, which      #
 * # misses by ONE pixel. From 20 characters upward NOT ONE of the 244      #
 * # runs fits, and the narrowest of them is 1767 px.                       #
 * #                                                                        #
 * # THE SCHEMA BOUND IS 20 AND IT IS NOT A FIT CHECK.                      #
 * # `devices.ts` gives this slot `deviceText(20)`, matching a3's own       #
 * # `CHAPTER_TITLE_MAX_CHARS` so that a heading moved between the two      #
 * # styles is not refused by one of them for a reason that reads like a    #
 * # bug. But a3 is set in Noto Sans at 129 px at its zoom peak and this    #
 * # one is set in a display serif at 215 px, and at 215 px twenty          #
 * # characters never fit. THE BOUND IS THE SHAPE OF THE COPY; THIS IS      #
 * # WHETHER IT FITS. Both run, and this one runs second.                   #
 * #                                                                        #
 * # 16 IS A SAFE ASK, NOT A LIMIT. The gate above is what decides. This    #
 * # number only keeps the planner from being asked for copy that is        #
 * # refused more often than not.                                           #
 * #                                                                        #
 * # ####################################################################   #
 * # # AND SINCE 2026-09-16 IT IS A CONSERVATIVE ASK RATHER THAN A SAFE #   #
 * # # ONE, BECAUSE NOTHING IN THAT RANGE IS REFUSED ANY MORE.          #   #
 * # #                                                                  #   #
 * # # The gate shrinks now, and the client's own ruling put the bound   #   #
 * # # at 25 characters. Every one of the 4,452 whole-word runs of this  #   #
 * # # film's script up to 25 characters is admitted. So 16 is no longer #   #
 * # # protecting the planner from anything; it is only holding the ASK  #   #
 * # # near his own sample's length.                                     #   #
 * # #                                                                  #   #
 * # # LEFT AT 16 DELIBERATELY AND NOT RAISED HERE. It is read by        #   #
 * # # `apps/worker/src/llm/anthropic-visual-plan.ts`, which is the      #   #
 * # # VISUAL planner's prompt, and the chapter plate's copy does not    #   #
 * # # come from there at all — its arm in `deviceChoice.ts` takes       #   #
 * # # `beat.editorialTitle`, which is the dossier's section title. So   #   #
 * # # raising this would loosen a prompt that does not feed this        #   #
 * # # device, which is a change to make on its own evidence.            #   #
 * # ####################################################################   #
 * #                                                                        #
 * # ####################################################################   #
 * # # IT WAS 13 FOR ABOUT AN HOUR, AND 13 WAS AN ARTEFACT OF A WRONG   #   #
 * # # CAP HEIGHT.                                                      #   #
 * # #                                                                  #   #
 * # # The first measurement of the client's clip recorded a cap height  #   #
 * # # of 152 px, which was really the ink bounding box: its top is the  #   #
 * # # `h` ascender and its bottom the `g` descender. The real cap       #   #
 * # # height, off a row-wise ink profile, is 132 px. See the long box   #   #
 * # # on `capHeightPx` in `chapterPlateClock.ts`.                        #   #
 * # #                                                                  #   #
 * # # The font size is DERIVED from cap height, so the whole heading    #   #
 * # # was being set about 13% too large, and the symptom was this       #   #
 * # # number: HIS OWN 16-CHARACTER SAMPLE DID NOT FIT. "Three Great     #   #
 * # # Ages" measured 1713 px against a 1728 px box at the wrong size    #   #
 * # # and measures 1487.61 px at the right one.                          #   #
 * # #                                                                  #   #
 * # # THE LESSON, AND IT IS WHY THIS BOX IS THIS LONG: a client's own   #   #
 * # # sample failing your gate is EVIDENCE ABOUT THE GATE, not about    #   #
 * # # the sample. The first reading of it here was that his device must #   #
 * # # shrink to fit. It does shrink, but that was not what this was.    #   #
 * # ####################################################################   #
 * ##########################################################################
 */
export const CHAPTER_PLATE_PROMPT_CHARS = 16
