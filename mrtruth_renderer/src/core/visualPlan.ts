/**
 * THE VISUAL PLANNER'S PURE HALF — an animation opportunity becomes a beat.
 *
 * ##########################################################################
 * # THIS IS THE PIECE THAT FILLS `DeviceBeat.plannedTemplate`, AND WITHOUT #
 * # IT THE SHEET THE MODEL WRITES CANNOT REACH A FRAME.                    #
 * #                                                                        #
 * # It is the same shape as `sections.ts`, which fills `editorialTitle`,   #
 * # and it exists for the same reason: T-18 condition 3 says editorial     #
 * # decisions are "generated upstream and frozen into the plan, never      #
 * # inside `chooseDevices`", because that function's determinism is what   #
 * # `computeRenderKey` rests on.                                           #
 * #                                                                        #
 * # THE CLIENT ASKED FOR THIS BY NAME, and his words are the spec:         #
 * # "The visual planner should read the whole script and actively identify #
 * # opportunities for animations and text-overlay animations. For every    #
 * # good opportunity, it should evaluate the full animation library and    #
 * # decide which template actually fits the narration. It should go        #
 * # through the script/voiceover line-by-line making sure it catches       #
 * # everything." See `docs/ANIMATION_TEMPLATE_PLANNER.md`.                 #
 * ##########################################################################
 *
 * ##########################################################################
 * # IT IS DELIBERATELY NOT REACHABLE FROM THE COMPOSITOR BUNDLE. TRAP SS.  #
 * #                                                                        #
 * # `apps/web/src/remotion` imports exactly four subpaths of this package  #
 * # — schemas, devices, frames, motion — and never the barrel. So this     #
 * # file is exported from `index.ts` ONLY, `bundleHash` cannot move, and a #
 * # film that gains animations re-renders THE CHANGED SEGMENTS AND NOTHING #
 * # ELSE. Do not add a subpath export for it, and do not import it from    #
 * # anything under `apps/web/src/remotion`.                                #
 * #                                                                        #
 * # It imports `devices.ts`, which IS in that bundle. That direction is    #
 * # safe and is the one `deviceChoice.ts` already takes: the bundle holds  #
 * # what the compositor REACHES, and nothing in the compositor reaches     #
 * # here. Measured on 2026-09-02 and pinned by `exclusions.test.ts`.       #
 * ##########################################################################
 */

import { DANGLING_WORDS } from './danglingWords.js'
/*
 * SEVEN VALUES, AND THE DIRECTION IS THE ONE THIS FILE ALREADY TAKES. The box at
 * the head of `deviceChoice.ts` records that its own edge back to here is
 * `import type` only, so this stays a one-way runtime edge and no cycle exists.
 * Five of the seven joined on 2026-09-21 for the opening-title builder below, so
 * that builder judges a line with the same functions the chooser will judge it
 * with. Copying them instead is what the `DANGLING_WORDS` box argues against.
 */
import {
  contentTokens,
  cornerLabelShotIsLongEnough,
  endsMidPhrase,
  JOINING_WORDS,
  kickerRepeatsTheHeadline,
  NUMBER_WORDS,
  P03_KICKER_MAX_CHARS,
} from './deviceChoice.js'
import {
  DEVICE_REGISTRY,
  P02_HEADLINE_MAX_CHARS,
  P04_MAIN_LINE_MAX_CHARS,
  P05_HEADLINE_MAX_CHARS,
  P09_QUESTION_MAX_CHARS,
  P17_LABEL_MAX_CHARS_MIRROR,
  SHADOW_UP_LINE_MAX_CHARS,
  p03HeadlineFits,
} from './devices.js'
import type { DeviceId, DeviceSpec } from './devices.js'
import { anchorScriptToWords, scriptTokens } from './sections.js'
import type { AlignedWord } from './sections.js'

/**
 * ONE MOMENT THE MODEL MARKED, KEYED BY CHARACTER OFFSET RATHER THAN BY SCENE.
 *
 * ##########################################################################
 * # CHAR OFFSETS, NOT SCENE INDICES, AND THIS IS THE TRAP THE DESIGN IS    #
 * # BUILT AROUND.                                                          #
 * #                                                                        #
 * # `recutOpening` (plan.ts) RENUMBERS every scene after the gallery       #
 * # carrier. A sheet keyed by scene index would therefore be silently off  #
 * # by one on exactly the films where the opening gallery places — the     #
 * # same hazard `sectionTitlesForBeats` records in its own header. A       #
 * # character offset into the script is fixed by the script, so the recut  #
 * # cannot move it, and the dossier's `sections` already use this shape.   #
 * ##########################################################################
 */
export type VisualOpportunity = {
  /** 0-based character offsets into the script exactly as the model saw it. */
  readonly startChar: number
  readonly endChar: number
  /** Which template. Checked against the registry here, not trusted. */
  readonly templateId: DeviceId
  /**
   * THREE COPY SLOTS AND NO MORE, WHICH IS A T-18 DECISION RATHER THAN A
   * CONVENIENCE.
   *
   * ######################################################################
   * # T-18 CONDITION 2: an editorial string "asserts nothing the beat     #
   * # does not support ... A description of what a passage is about       #
   * # qualifies. A date, a catalogue number, a person's role or an        #
   * # institution's name does not."                                       #
   * #                                                                     #
   * # A headline, a kicker and a short list are all SUMMARIES. Giving the #
   * # model a `year` slot or a `role` slot would be handing it the exact  #
   * # shapes that rule refuses, so those slots do not exist here and the  #
   * # devices that need them go on being fed by the spoken marks.         #
   * ######################################################################
   */
  readonly headline: string | null
  readonly kicker: string | null
  readonly lines: readonly string[]
  /** Why the model chose this template here, for the sheet the client reads. */
  readonly reason: string
}

/**
 * The little a beat has to expose to be a candidate carrier.
 *
 * ##########################################################################
 * # THE LAST TWO FIELDS ARE THE FIX THE FIRST REAL RUN FORCED.             #
 * #                                                                        #
 * # Measured on 2026-09-04 against the client's own script: the model       #
 * # marked 45 opportunities, 41 landed on a shot, and `chooseDevices` then  #
 * # drew ONE. The refusals were not about the sheet's judgement — six       #
 * # `beat-too-short`, seven `no-own-picture`, three `beat-too-long`. The    #
 * # planner reads the SCRIPT and cannot see how long a shot is or whether   #
 * # it owns a photograph, so "the nearest cut" seated template after        #
 * # template on a shot that could never carry it.                          #
 * #                                                                        #
 * # `pictureCount` is the scene's own photograph plus its companions, so    #
 * # zero on a shot that holds the previous picture. Gates G2/G3/G4 already  #
 * # ask exactly these questions of exactly these numbers; `canCarry` below  #
 * # asks them EARLY so a slot is not spent on an answer already known.      #
 * ##########################################################################
 */
export type VisualPlanCandidateBeat = {
  readonly index: number
  readonly startMs: number
  readonly endMs: number
  readonly durationFrames: number
  readonly pictureCount: number
}

/** What lands on `DeviceBeat.plannedTemplate`. The opportunity, minus its offsets. */
export type PlannedTemplate = {
  readonly templateId: DeviceId
  readonly headline: string | null
  readonly kicker: string | null
  readonly lines: readonly string[]
  readonly reason: string
}

export type VisualRefusal =
  | 'unknown-template'
  | 'no-anchor-in-the-audio'
  | 'no-cut-within-tolerance'
  | 'beat-already-taken'
  /**
   * EVERY CUT NEAR THIS MOMENT IS TOO SHORT, TOO LONG, OR HOLDS TOO FEW
   * PICTURES FOR THE TEMPLATE THE PLANNER NAMED.
   *
   * ######################################################################
   * # REFUSED RATHER THAN SEATED ANYWAY, AND THAT IS THE POINT.           #
   * #                                                                    #
   * # Seating it on an unfit shot spends the slot AND locks the shot, so  #
   * # a later opportunity that COULD have used it is then refused         #
   * # `beat-already-taken` for nothing. That is exactly what the first    #
   * # real run did forty times over. Refusing leaves the shot free.       #
   * ######################################################################
   */
  | 'no-shot-can-carry-it'

/** One row of the sheet, placed or refused, so the report can show both. */
export type VisualPlacement = {
  readonly opportunityIndex: number
  readonly templateId: string
  readonly beatIndex: number | null
  readonly startMs: number | null
  readonly offsetMs: number | null
  readonly refusal: VisualRefusal | null
  /**
   * The offset the MODEL wrote, when this row was re-anchored on its own words,
   * and null when it was left where it was said to be.
   *
   * ######################################################################
   * # REPORTED RATHER THAN SILENT, for the reason `offsetMs` is. A sheet  #
   * # whose pointers are drifting is a prompt problem, and a correction   #
   * # nobody can count hides exactly the evidence that would fix it at    #
   * # the source. On job 3e185245 this reads 34 of 49.          #
   * ######################################################################
   */
  readonly snappedFromChar: number | null
}

export type VisualPlanResult = {
  readonly planByBeat: ReadonlyMap<number, PlannedTemplate>
  readonly placements: readonly VisualPlacement[]
  readonly anchoredFraction: number
  readonly refusedForDrift: boolean
}

/**
 * HOW FAR A SCENE CUT MAY SIT FROM AN OPPORTUNITY'S FIRST SPOKEN WORD.
 *
 * ##########################################################################
 * # WIDER THAN `SECTION_CUT_TOLERANCE_MS`, ON PURPOSE, AND THE DIFFERENCE  #
 * # IS THE QUESTION EACH ONE ANSWERS.                                      #
 * #                                                                        #
 * # A chapter title ANNOUNCES a turn, so a heading a second late is a      #
 * # heading for a chapter the viewer is already inside — 1000ms is that    #
 * # rule's honest bound and it was swept against two dossiers to find it.  #
 * #                                                                        #
 * # An animation ILLUSTRATES a moment. It sits under the narration rather  #
 * # than announcing it, so landing on the shot either side of the exact    #
 * # word is not a defect, and the median scene in the delivered film is    #
 * # only 89 frames — three seconds — so a 1000ms bound would refuse most   #
 * # opportunities for being one shot out. 2000ms is one median scene       #
 * # either way, which is the widest window in which "this animation is     #
 * # about that sentence" is still true.                                    #
 * #                                                                        #
 * # It is a bound and not a target. An opportunity that lands 40ms from    #
 * # its word is not better placed for being inside it — see the offsetMs   #
 * # column of the report, which exists so a drift can be READ rather than  #
 * # inferred from the tolerance.                                           #
 * ##########################################################################
 */
export const VISUAL_PLAN_CUT_TOLERANCE_MS = 2000

/**
 * The share of script tokens that must anchor to the audio before the sheet is
 * believed at all. Copied from `SECTION_MIN_ANCHORED_FRACTION` deliberately:
 * both are answering "does this script describe this recording", and a project
 * with two different answers to that question has a bug waiting in it.
 */
export const VISUAL_PLAN_MIN_ANCHORED_FRACTION = 0.5

/**
 * THE COPY SLOT EACH TEMPLATE ACTUALLY DRAWS, WHICH IS NOT ONE SHARED BUDGET.
 *
 * ##########################################################################
 * # ELEVEN PLACEMENTS WERE LOST TO THIS ON THE FIRST REAL RUN.             #
 * #                                                                        #
 * # The prompt asked for headlines "under 48 characters" and the model      #
 * # obliged. But `framed-card`'s caption slot is 32, `chapter-title`'s is   #
 * # TWENTY — measured off a render where twelve of fourteen titles ran off  #
 * # both edges of the frame — and P17's label is TEN. So `buildCopy`        #
 * # refused eleven beats `copy-not-available` for a line that was exactly   #
 * # the length the planner had been told to write.                          #
 * #                                                                        #
 * # THE NUMBERS ARE THE TEMPLATES' OWN. `P17_LABEL_MAX_CHARS_MIRROR` and    #
 * # `CHAPTER_TITLE_MAX_CHARS` are imported rather than retyped, and the     #
 * # rest mirror `SceneDeviceSchema`. A slot that changes and is not         #
 * # reflected here would show up as a template that silently stops placing, #
 * # which is the failure mode this whole commit exists to answer, so        #
 * # `visualPlan.test.ts` pins each one against the real constant.           #
 * ##########################################################################
 */
export const TEMPLATE_HEADLINE_CHARS: Readonly<Partial<Record<DeviceId, number>>> = {
  P03: 64,
  P17: P17_LABEL_MAX_CHARS_MIRROR,
  'framed-card': 32,
  /*
   * A MIRROR OF `CHAPTER_TITLE_MAX_CHARS`, NOT AN IMPORT, BECAUSE THE IMPORT
   * WOULD BE A CYCLE. `deviceChoice.ts` already imports this file for
   * `PlannedTemplate`; importing its constant back would close the loop, and a
   * type-only edge that becomes a runtime edge is the kind of thing a bundler
   * resolves differently from `tsx`. `visualPlan.test.ts` asserts the two are
   * equal, which is the same trade `P17_LABEL_MAX_CHARS_MIRROR` already makes
   * in the other direction.
   */
  'chapter-title': 20,
  /*
   * NIKU'S THREE, 2026-09-14, AND ALL THREE ARE MIRRORS FOR THE SAME REASON
   * `chapter-title` ABOVE IS ONE: importing `deviceChoice.ts`'s constants back
   * into this file would close a cycle, because `deviceChoice.ts` already
   * imports this one for `PlannedTemplate`. `visualPlan.test.ts` asserts each
   * pair is equal, which is the trade every mirror in this table makes.
   *
   * Each one's WIDTH is the real gate — `chapterPlateFit.ts`, `topTitleFit.ts`
   * and `cornerLabelFit.ts` — and every one of the three is in
   * `TEMPLATES_REFUSED_NOT_CUT` below, so a long line is refused and never
   * silently shortened.
   */
  'chapter-plate': 20,
  'top-title': 28,
  'corner-label': 18,
  'pointer-label': 32,
  'name-card': 32,
  'two-photo-zoom': 24,
  'bullet-checklist': 32,
  P13: 48,
  P16: 24,
  /* Imported, never retyped. Its WIDTH is the real gate, in `shadowUpFit.ts`; this is the schema bound. */
  'shadow-up': SHADOW_UP_LINE_MAX_CHARS,
  /*
   * P04's label, imported and never retyped, as 05's is. Its WIDTH is the real
   * gate, in `p04Fit.ts`, and the prompt asks for the measured
   * `P04_LABEL_PROMPT_CHARS`; this is the schema bound, and a longer label is
   * refused here, never cut (`TEMPLATES_REFUSED_NOT_CUT`).
   */
  P04: P04_MAIN_LINE_MAX_CHARS,
  /*
   * P02's headline, imported and never retyped, as P04's is. Its WIDTH is the
   * real gate, in `p02Fit.ts`, and the prompt asks for the measured
   * `P02_HEADLINE_PROMPT_CHARS`; this is the schema bound, and a longer headline
   * is refused here, never cut (`TEMPLATES_REFUSED_NOT_CUT`).
   */
  P02: P02_HEADLINE_MAX_CHARS,
  /*
   * P09's question, imported and never retyped, as P02's headline is. Its WIDTH
   * is the real gate, in `p09Fit.ts`, and the prompt asks for the measured
   * `P09_QUESTION_PROMPT_CHARS`; this is the schema bound, and a longer question
   * is refused here, never cut (`TEMPLATES_REFUSED_NOT_CUT`). A cut question
   * would have lost its question mark.
   */
  P09: P09_QUESTION_MAX_CHARS,
  /*
   * P05's headline, imported and never retyped, as P02's is. Its WIDTH is the
   * real gate, in `p05Fit.ts`, and the prompt asks for the measured
   * `P05_HEADLINE_PROMPT_CHARS`; this is the schema bound, and a longer headline
   * is refused here, never cut (`TEMPLATES_REFUSED_NOT_CUT`). Its support line
   * and picture label ride in `lines`, carried whole to the arm's own bounds.
   */
  P05: P05_HEADLINE_MAX_CHARS,
}

/**
 * THE P03 HEADLINE LENGTH THE PLANNER PROMPT ASKS FOR. NOT A TRUNCATION BOUND.
 *
 * ##########################################################################
 * # THE PROMPT SAID "AT MOST 36" AND THE GATE REFUSED HALF OF THEM.        #
 * #                                                                        #
 * # `p03HeadlineFits` lays each word's real advances into the 1120 px      #
 * # block and allows two lines. The 36 in the prompt came off a sweep of   #
 * # one phrase (box 3 in `anthropic-visual-plan.ts`, "33 fits, 38 does     #
 * # not"), and one phrase is not a script.                                 #
 * #                                                                        #
 * # MEASURED on job 99414763's own script (ingest.json `scriptText`, 8,742 #
 * # characters, 1,404 words once edge punctuation is stripped): every run  #
 * # of consecutive whole words, 9,534 distinct runs up to 48 characters,   #
 * # put through the real gate by                                           #
 * # tmp/v53/templates/measure-prompt-caps-detail.mts.                       #
 * #                                                                        #
 * #   length   runs   refused   of those, held an unusable word            #
 * #     19      217      0         0                                       #
 * #     20      242      1         1   "already-accomplished"              #
 * #     23      216      1         1                                       #
 * #     24      210      1         1                                       #
 * #     26      214      0         0                                       #
 * #     27      237      6         1   5 REAL, "chapter twenty-two text    #
 * #                                    The" and four more take 3 lines     #
 * #     32      225     48         2                                       #
 * #     36      215    108         -   half, which is what the prompt was  #
 * #                                    asking for                          #
 * #                                                                        #
 * # TWO NUMBERS COME OUT OF THAT TABLE AND ONLY ONE OF THEM IS A CAP.      #
 * #                                                                        #
 * #   19   the largest N where every run of <= N characters fits           #
 * #   26   the same, EXCLUDING runs that hold one unusable word            #
 * #                                                                        #
 * # 26, AND THE 19 IS WRITTEN DOWN BESIDE IT SO NOBODY RE-DERIVES IT AND   #
 * # PUTS IT BACK. The whole distance between the two is ONE WORD.          #
 * # "already-accomplished" is 20 characters and 1,263.9 px on its own,     #
 * # against a 1,120 px block, and a word is never broken — so that word    #
 * # CAN NEVER DRAW, at 19, at 26, or at any other cap. Every run that      #
 * # refuses below 27 is a run containing it.                               #
 * #                                                                        #
 * # A SINGLE UNUSABLE WORD MUST NOT SET THE CAP, AND THAT IS THE WHOLE     #
 * # CORRECTION. A cap is a promise about what the planner can safely       #
 * # write. Lowering it to 19 does not make "already-accomplished"          #
 * # drawable — nothing does — it only forbids the 1,000-odd runs of 20 to  #
 * # 26 characters that draw perfectly well, to dodge one that never could. #
 * # The prompt is guidance to a model, not the gate; the gate is           #
 * # `p03HeadlineFits`, it still refuses that word, and refusing is the     #
 * # right answer for a line that cannot be drawn.                          #
 * #                                                                        #
 * # WHAT 19 WAS ACTUALLY COSTING. It is shorter than two headlines this    #
 * # film has already drawn well: "Book of the Watchers" (20, the frame the #
 * # client called perfect, two lines, 1,149.3 px of summed advance) and    #
 * # "Israel Antiquities Authority" (28, two lines, 1,513.1 px). Both pass  #
 * # the gate. At 19 the planner was being told to write headlines shorter  #
 * # than the frame it is being asked to produce more of.                   #
 * #                                                                        #
 * # THE CEILING IS NOT RAISED PAST WHAT WAS MEASURED. 27 is where the      #
 * # first REAL three-line refusals arrive — five runs of 27, none of them  #
 * # holding the unusable word — so 26 is the last length this script       #
 * # passes clean, exactly as 19 was the last under the old reading.        #
 * #                                                                        #
 * # RE-MEASURED 2026-09-13 by tmp/v53/templates/p03-recap-measure.mts,     #
 * # over the same 9,534 runs, and both numbers came back unchanged.        #
 * #                                                                        #
 * # `TEMPLATE_HEADLINE_CHARS.P03` STAYS 64. It is where a sheet's line is  #
 * # cut, and a cut line is a different claim, so a fit measurement does    #
 * # not belong there.                                                      #
 * #                                                                        #
 * # HERE AND NOT BESIDE `p03HeadlineFits` IN `devices.ts`, because the      #
 * # compositor imports `@vg/core/devices` and a planner-only number has no #
 * # business in the bundle. This file is reached through the barrel only.  #
 * ##########################################################################
 */
export const P03_HEADLINE_PROMPT_CHARS = 26

/**
 * THE TEMPLATES WHOSE LINES ARE REFUSED, NEVER CUT.
 *
 * ##########################################################################
 * # THE DEVELOPER'S RULING FOR THE NEW TEMPLATES IS REFUSE RATHER THAN     #
 * # TRUNCATE, AND A NAME SHOWS WHY.                                        #
 * #                                                                        #
 * # This step cut a P04 label to its 32-character slot on a word. "Great  #
 * # Isaiah Scroll and Habakkuk Commentary" is 43 characters and needs      #
 * # three lines, so P04's gate refuses it. Its cut, "Great Isaiah Scroll   #
 * # and Habakkuk", fits two, every word is spoken in the shot and in the   #
 * # archive URL, and it names a different object. The chooser only ever   #
 * # saw the cut, so it drew it. Neither the dangling-word rule nor the     #
 * # clause rule below can see a proper noun cut short.                     #
 * #                                                                        #
 * # SO FOR THESE, A HEADLINE LONGER THAN ITS SLOT SEATS AS NULL. The row   #
 * # still holds its shot and shows on the sheet, and the chooser refuses   #
 * # the beat `copy-not-available`, as it does any line it cannot draw.     #
 * #                                                                        #
 * # THEIR `lines` ARE CARRIED WHOLE. The 48 they were cut at is            #
 * # bullet-checklist's row slot, not theirs, and each arm holds a line to  #
 * # its own bound and its own width gate. No template's kicker is cut.     #
 * #                                                                        #
 * # THE OLDER TEMPLATES KEEP THE CUT. It is this file's standing trade for #
 * # them, a refused caption against a drawn broken one, and their tests    #
 * # pin it. These are the templates whose ruling says refuse.              #
 * ##########################################################################
 */
/*
 * NIKU'S THREE JOIN THE REFUSE SIDE, 2026-09-14, AND NOT THE CUT SIDE.
 *
 * A chapter heading, a top-left title and a corner label are all DISPLAY lines:
 * short, set large, and read as a statement about the shot. Trimming one to its
 * slot makes a different claim, which is the same argument P02, P04, P09 and
 * P05 are on this list for. The chapter plate is the clearest case — cutting
 * "The Elder Earth Passage" to fit would print a section name the film does not
 * have, and the client's rule 2 forbids inventing chapter names outright.
 */
export const TEMPLATES_REFUSED_NOT_CUT: ReadonlySet<DeviceId> = new Set<DeviceId>([
  'P04',
  'P02',
  'P09',
  'P05',
  'chapter-plate',
  'top-title',
  'corner-label',
])

/** A refused-not-cut template's line, whole, or null when it is longer than its slot. */
function wholeOrRefused(value: string, max: number): string | null {
  const trimmed = value.trim()
  return trimmed.length > max ? null : trimmed
}

/** Trim to the last WHOLE WORD, never mid-word. See `research.ts`'s own box. */
/**
 * TRIM TO THE SLOT, ON A WORD, AND NEVER ONTO A WORD THAT DANGLES.
 *
 * ##########################################################################
 * # CUTTING ON A WORD BOUNDARY WAS NOT ENOUGH AND A DELIVERED FRAME PROVED  #
 * # IT. On job 0d4dec42 the planner wrote "Four chambers described in the   #
 * # twenty-second chapter" for the framed-card at 1:28. `framed-card`'s     #
 * # caption slot is 32 characters, so the old body cut it on a space to     #
 * # "Four chambers described in the" and put a caption ending on the word   #
 * # "the" on screen for the length of the shot.                            #
 * #                                                                        #
 * # The box on the call site already says a fragment "reads as a different  #
 * # claim". A line ending on an article is worse than that: it does not     #
 * # read as a claim at all, it reads as a render that broke halfway. Same   #
 * # family as the gold emphasis box that landed on the indefinite article   #
 * # "A" on the film's closing frame.                                       #
 * #                                                                        #
 * # IT STRIPS REPEATEDLY, because "described in the" leaves "in" behind on  #
 * # a single pass, and "in" dangles exactly as hard as "the" does.         #
 * #                                                                        #
 * # AN EMPTY RESULT IS A REAL ANSWER. A line that is nothing but dangling   #
 * # words has nothing in it to draw, and both call sites already refuse an  #
 * # empty string — the headline becomes null and the row is filtered out.   #
 * # That is the file's standing trade: a refused caption costs a caption, a #
 * # drawn broken one costs the frame.                                      #
 * ##########################################################################
 */
function toLastWord(value: string, max: number): string {
  const trimmed = value.trim()
  let capped = trimmed
  if (trimmed.length > max) {
    capped = trimmed.slice(0, max)
    if (/\S/u.test(trimmed.charAt(max))) {
      const lastSpace = capped.search(/\s\S*$/u)
      if (lastSpace > 0) capped = capped.slice(0, lastSpace)
    }
  }
  capped = capped.trim()
  /*
   * Only a TRIMMED line can dangle. A line the planner wrote short enough is
   * its own whole thought and is left exactly as written, even if it happens
   * to end on one of these words.
   */
  if (capped === trimmed) return capped
  for (;;) {
    const lastSpace = capped.search(/\s\S*$/u)
    const lastWord = (lastSpace >= 0 ? capped.slice(lastSpace) : capped).trim()
    const token = lastWord.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    if (token.length === 0 || !DANGLING_WORDS.has(token)) break
    if (lastSpace <= 0) return ''
    capped = capped.slice(0, lastSpace).trim()
  }
  /*
   * A DANGLING WORD CAN LEAVE ITS COMMA BEHIND. "Qumran, jars, of the sealed
   * caves" trimmed to twenty characters is "Qumran, jars, of the"; stripping
   * "the" and "of" leaves "Qumran, jars,", which reads as broken for exactly
   * the reason ending on "the" does. Found while hunting a fixture for the
   * clause rule below, not by design.
   */
  capped = capped.replace(/[,;:—–]+$/u, '').trim()
  return toLastWholeClause(capped, trimmed)
}

/**
 * DROP BACK TO THE LAST CLAUSE THE TRIM DID NOT CUT INTO.
 *
 * ##########################################################################
 * # THE THIRD DEFECT IN THIS FAMILY IN ONE DAY, AND THE FIRST TWO ARE WHY  #
 * # THIS ONE IS WORTH A FUNCTION.                                          #
 * #                                                                        #
 * # Caught in the frozen plan of job 0d4dec42 before it reached a frame.   #
 * # The planner wrote "Chapter twenty-two, Book of the Watchers" for the   #
 * # framed-card at 1:25. Forty characters into a thirty-two character slot #
 * # cuts on a space to "Chapter twenty-two, Book of the". `toLastWord`     #
 * # then strips "the" and "of" exactly as it should and STOPS at "Book",   #
 * # which is a real word carrying real meaning.                            #
 * #                                                                        #
 * # "Chapter twenty-two, Book" obeys every rule written before this one    #
 * # and still reads as a caption that broke halfway. The clause after the  #
 * # comma is gone; what is left of it is not a shorter version of what the #
 * # writer wrote, it is a phrase the writer never wrote.                   #
 * #                                                                        #
 * # SO PREFER THE CLAUSE THAT SURVIVED WHOLE. Dropping back to a boundary  #
 * # the writer themselves put in loses information and stays true. Keeping #
 * # half a clause invents.                                                 #
 * #                                                                        #
 * # IT ONLY FIRES WHERE THE TRIM ACTUALLY CUT INTO THE FINAL CLAUSE. A     #
 * # line that fits, or one whose trim happened to land on the boundary, is #
 * # untouched — otherwise this would degenerate into "delete everything    #
 * # after the first comma", which is a different and much worse rule. The  #
 * # test named 'keeps a clause the trim did not cut into' is that control. #
 * ##########################################################################
 */
function toLastWholeClause(capped: string, original: string): string {
  if (capped.length === 0 || capped === original) return capped
  const boundary = capped.search(/[,;:—–][^,;:—–]*$/u)
  if (boundary <= 0) return capped
  const keptTail = capped.slice(boundary + 1).trim()
  if (keptTail.length === 0) return capped
  /*
   * ONE WORD IS STRANDED. TWO IS A CLAUSE.
   *
   * This is the narrow test and the width of it is the whole design. A single
   * surviving word after a comma reads as the opening of a phrase that got
   * cut off, which is exactly "Chapter twenty-two, Book". Two or more read as
   * a short clause the writer could have written, so they stay: collapsing
   * "Qumran, cave four and jars" to "Qumran" would throw away a complete
   * thought to fix a defect it does not have.
   */
  if (keptTail.split(/\s+/u).length > 1) return capped
  /*
   * AND THE TAIL IS ONLY STRANDED IF THE WRITER WROTE MORE OF IT THAN SURVIVED.
   *
   * NO FIXTURE IN THIS FILE REACHES THIS LINE, AND I AM SAYING SO RATHER THAN
   * IMPLYING OTHERWISE. Deleting it leaves the suite green. Reaching it needs a
   * trimmed line whose final clause is a SINGLE word that the trim did not cut
   * into, and every construction I tried either fits the slot (so `toLastWord`
   * returns before this function) or has its tail cut (so the check agrees with
   * the branch above anyway).
   *
   * It stays because without it a COMPLETE one-word final clause is thrown away:
   * "Qumran, jars" would collapse to "Qumran" on any trim elsewhere in the
   * line. That is a real regression, it is just one this file's own fixtures
   * cannot currently express. Contrast the bullet-checklist empty-rows guard,
   * which is documented the same way and for the same reason.
   */
  const wholeTail = original
    .slice(boundary + 1)
    .split(/[,;:—–]/u)[0]
    ?.trim()
  if (wholeTail === undefined || keptTail === wholeTail) return capped
  const head = capped.slice(0, boundary).trim()
  return head.length === 0 ? capped : head
}

/**
 * Can this shot draw this template at all?
 *
 * ##########################################################################
 * # IT ASKS GATES G2, G3 AND G4's OWN QUESTIONS, EARLY. `refuse` in         #
 * # `deviceChoice.ts` compares `durationFrames` against `buildEndFrames`    #
 * # and `holdsWellFrames`, and counts `1 + companionCount` against          #
 * # `pictures`. Those are facts about the shot that are already known when  #
 * # the sheet is seated, so asking them here costs nothing and saves the    #
 * # slot. It deliberately asks NO new question — a template refused here    #
 * # would have been refused there.                                          #
 * ##########################################################################
 */
function canCarry(
  spec: DeviceSpec,
  beat: VisualPlanCandidateBeat,
  /**
   * The row being seated, when there is one. Only `corner-label` reads it, and
   * only to replace a worst-case floor with this row's own. Absent, every
   * template is asked the registry's own question exactly as before.
   */
  marked?: VisualOpportunity,
): boolean {
  /*
   * ##########################################################################
   * # `corner-label` RESERVES TIME FOR THE LONGEST CAPTION THE SCHEMA ADMITS, #
   * # AND THE ROW IN FRONT OF US SAYS WHAT THE CAPTION IS.                    #
   * #                                                                        #
   * # Its `buildEndFrames` is 101, which is `settle(18, 14)` — the 18         #
   * # character label and 14 character kicker `deviceText` allows. That is    #
   * # the only honest floor for a corner-label whose words are unknown, and   #
   * # it STAYS the floor here for a row that wrote none.                      #
   * #                                                                        #
   * # BUT THE SEATER IS HOLDING THE WORDS. On job c75d51e6 the planner asked  #
   * # for this device twice — "Epistle of Enoch" over "Most direct" at        #
   * # startChar 1579, and "Stuckenbruck" over "Cosmology" at 5652 — and both  #
   * # rows were lost `no-shot-can-carry-it` against the 101, on captions that #
   * # finish at frames 91 and 79. The device the client approved on           #
   * # 2026-09-16 therefore drew ZERO times in the film he approved it from.   #
   * #                                                                        #
   * # IT ASKS NO NEW QUESTION, which is this function's standing promise.     #
   * # `cornerLabelShotIsLongEnough` is the SAME function `buildCopy`'s        #
   * # corner-label arm runs over the copy it builds, kicker degrade and all,  #
   * # so a row seated here and refused there is a row whose copy failed a     #
   * # DIFFERENT gate — a width, a repeat, a narration check — and never this  #
   * # one.                                                                    #
   * ##########################################################################
   */
  const cornerLabelCopy = spec.id === 'corner-label' ? (marked?.headline ?? '').trim() : ''
  if (cornerLabelCopy.length > 0) {
    /*
     * TRIMMED ON BOTH SLOTS, because `buildCopy` trims before it counts and a
     * slot is one drawn character. A stray space either side of the kicker is
     * two frames of build that never happens.
     */
    const cornerLabelKicker = (marked?.kicker ?? '').trim()
    if (!cornerLabelShotIsLongEnough(beat.durationFrames, cornerLabelCopy, cornerLabelKicker)) return false
  } else if (beat.durationFrames < spec.buildEndFrames) return false
  if (beat.durationFrames > spec.holdsWellFrames) return false
  /* `pictures: 0` draws its own ground and is not asked to find a photograph. */
  if (spec.pictures >= 1 && beat.pictureCount < spec.pictures) return false
  return true
}

/**
 * HOW WIDE A STRETCH OF SCRIPT MAY BE AND STILL BE ONE PASSAGE.
 *
 * ##########################################################################
 * # THE ONLY GUARD ON THE RE-ANCHORING BELOW, AND THE NUMBER SITS IN A     #
 * # MEASURED GAP RATHER THAN BEING CHOSEN.                                 #
 * #                                                                        #
 * # Over the 37 word-bearing rows of job 3e185245's sheet, the tightest     #
 * # stretch of script holding all of a row's own words was:                 #
 * #                                                                        #
 * #   at most 191 characters   on every row genuinely quoting one passage  #
 * #   1,078 and 5,504          on the two rows whose words merely co-occur #
 * #                                                                        #
 * # So the two populations are five-fold apart and 600 is between them.     #
 * # Swept end to end through the real chooser at 100, 200, 400, 600, 900,   #
 * # 1500 and 3000 the film comes back with 29 devices at every value, so    #
 * # nothing here rests on the exact figure. Unbounded gives 30, and the     #
 * # extra one is a row moved on the strength of six words spread over       #
 * # 5,504 characters — which is a coincidence, not a quotation.             #
 * #                                                                        #
 * # THAT TRADE IS THIS FILE'S STANDING ONE. A row left where the model put  #
 * # it costs a row; a row moved onto a coincidence costs the frame.         #
 * ##########################################################################
 */
export const VISUAL_PLAN_MAX_QUOTE_SPAN_CHARS = 600

/**
 * HOW FAR A ROW MAY BE MOVED FROM THE OFFSET THE MODEL WROTE.
 *
 * ##########################################################################
 * # THIS ONE IS NOT READ OFF A GAP, AND SAYING SO MATTERS BECAUSE THE      #
 * # CONSTANT ABOVE IS AND THE TWO LOOK ALIKE.                              #
 * #                                                                        #
 * # Over job 3e185245 the furthest honest correction is 343 characters and #
 * # the nearest REJECTED alternative window is 15, so the two populations  #
 * # overlap completely and no threshold separates them. There is nothing   #
 * # here to measure a boundary from.                                       #
 * #                                                                        #
 * # IT IS A RAIL AGAINST A SHAPE A REVIEW FOUND. Without it nothing stops  #
 * # a row whose words happen to co-occur once at the far end of the film   #
 * # being dragged there; a probe moved one 5,559 characters. 600 sits well #
 * # above the worst real correction and changes nothing on this film — all #
 * # 34 of its snaps survive it. A sheet that needs more than this is a     #
 * # prompt problem, and the seating log line is what will say so.          #
 * ##########################################################################
 */
export const VISUAL_PLAN_MAX_SNAP_CHARS = 600

/**
 * THE WORDS A ROW IS ASKING TO BE PLACED BY, WHICH ARE THE HEADLINE'S.
 *
 * ##########################################################################
 * # THE KICKER AND THE ROWS ARE DELIBERATELY NOT IN HERE, AND POOLING THEM #
 * # COST TWO DELIVERED ANIMATIONS IN THE FIRST VERSION OF THIS FEATURE.    #
 * #                                                                        #
 * # Every slot's words in one bag makes the minimal window start at        #
 * # whichever sentence the EARLIEST word came from, and on a P03 that is   #
 * # the kicker. Measured on job 3e185245: opportunity 17 was dragged off   #
 * # "and the structure is not symmetric" — the shot that speaks its        #
 * # headline verbatim and which DREW in the delivered film — onto the      #
 * # sentence its kicker quotes, where it was refused. Opportunity 15 did   #
 * # the same. Two animations lost to make six.                             #
 * #                                                                        #
 * # THE OTHER SLOTS DO NOT NEED TO BE IN THE WINDOW. The copy gate reads   #
 * # the beat plus two shots either side, so a kicker quoting the sentence  #
 * # before is already spoken where the headline lands.                     #
 * #                                                                        #
 * # A ROW WITH NO HEADLINE FALLS BACK TO WHAT IT HAS. Every word-bearing   #
 * # row on the real sheet carries one, so this arm is a guard rather than  #
 * # a path anything has taken.                                            #
 * ##########################################################################
 */
function quotedWords(marked: VisualOpportunity): string[] {
  const written =
    marked.headline === null ? [marked.kicker, ...marked.lines] : [marked.headline]
  const wanted = new Set<string>()
  for (const line of written) {
    if (line === null) continue
    for (const token of scriptTokens(line)) {
      if (!JOINING_WORDS.has(token.key)) wanted.add(token.key)
    }
  }
  return [...wanted]
}

/**
 * WHERE IN THE SCRIPT THIS ROW'S OWN WORDS ARE ACTUALLY SPOKEN, OR NULL.
 *
 * ##########################################################################
 * # THE MODEL NAMES THE RIGHT MOMENT IN WORDS AND THE WRONG ONE IN NUMBERS, #
 * # AND ON THE DELIVERED FILM THAT COST TWENTY OF THIRTY-EIGHT SEATED ROWS. #
 * #                                                                        #
 * # Measured on job 3e185245's sheet: 26 of the 49 `startChar` values land  #
 * # in the MIDDLE OF A WORD, which no deliberate boundary does, and the     #
 * # error grows through the script — median 136, worst 343, and nearly     #
 * # always LATE. The row therefore seats up to six shots away from the      #
 * # sentence it quotes, and `everyContentWordWasSpoken` then refuses it     #
 * # `copy-not-available`, correctly, for words nobody says there.           #
 * #                                                                        #
 * # THE COPY IS THE HALF WORTH TRUSTING. On that same sheet only 1 of 37    #
 * # word-bearing rows used a word absent from the script, so the words say  #
 * # where a row belongs far better than the number written beside them.     #
 * #                                                                        #
 * # THE NEAREST OCCURRENCE, NOT THE TIGHTEST. A writer repeats a phrase;    #
 * # this script says "the record forgot" in two different acts. Taking the  #
 * # globally tightest window would drag a row to the other end of the film  #
 * # whenever that happens, so the model's own offset still decides WHICH    #
 * # saying is meant. It is being corrected, not overruled.                  #
 * #                                                                        #
 * # ITS TOKENISER IS `scriptTokens`, so the row's words and the script's    #
 * # words are normalised by exactly the same function that `anchorScript-   #
 * # ToWords` already anchors this script with. That differs from            #
 * # `deviceChoice.ts`'s own normaliser on ACCENTS and on the APOSTROPHE —   #
 * # "École" folds to "ecole" here and "cole" there, and on this script the  #
 * # apostrophe is the commoner cause, 6 of the 9 disagreeing tokens. Each   #
 * # is self-consistent, so the worst a disagreement can do is leave a row   #
 * # where it already was.                                                   #
 * ##########################################################################
 */
function quotedPassageStart(
  marked: VisualOpportunity,
  tokens: ReturnType<typeof scriptTokens>,
): number | null {
  const wanted = quotedWords(marked)
  if (wanted.length === 0) return null

  const need = new Set(wanted)
  const seen = new Map<string, number>()
  let left = 0
  let covered = 0
  let best: { start: number; distance: number } | null = null

  for (let right = 0; right < tokens.length; right += 1) {
    const entering = tokens[right]
    if (entering === undefined) break
    if (need.has(entering.key)) {
      const count = (seen.get(entering.key) ?? 0) + 1
      seen.set(entering.key, count)
      if (count === 1) covered += 1
    }
    if (covered < need.size) continue

    /* Shrink from the left while the window still holds every word. */
    for (;;) {
      const leaving = tokens[left]
      if (leaving === undefined) break
      const count = seen.get(leaving.key) ?? 0
      if (need.has(leaving.key) && count <= 1) break
      if (need.has(leaving.key)) seen.set(leaving.key, count - 1)
      left += 1
    }

    const from = tokens[left]
    if (from !== undefined && entering.startChar - from.startChar <= VISUAL_PLAN_MAX_QUOTE_SPAN_CHARS) {
      const distance = Math.abs(from.startChar - marked.startChar)
      /* Ties to the EARLIER window, because this answer feeds a render key. */
      if (distance <= VISUAL_PLAN_MAX_SNAP_CHARS && (best === null || distance < best.distance)) {
        best = { start: from.startChar, distance }
      }
    }

    /* Step past this window's left edge so the next minimal one is found. */
    if (from !== undefined && need.has(from.key)) {
      seen.set(from.key, (seen.get(from.key) ?? 1) - 1)
      covered -= 1
    }
    left += 1
  }

  if (best === null || best.start === marked.startChar) return null
  return best.start
}

/* ------------------------------------------------------------------------- */
/* The opening title — the one row nothing in the pipeline was responsible for  */
/* ------------------------------------------------------------------------- */

/**
 * THE DEVICE T-11 TAKES ON `scenes[0]`, NAMED HERE AS `ruleT11` NAMES IT.
 *
 * ##########################################################################
 * # T-11 IS A **MUST** AND NOTHING PRODUCED IT. JOB 5e14ad33, 2026-09-21.  #
 * #                                                                        #
 * # The rule says the opening carries P03 and the gate refuses a plan that #
 * # does not. The only thing that ever MADE one was the visual planner     #
 * # happening to mark a P03 at the head of the script whose headline       #
 * # happened to be spoken early enough in the first shot to seat there. On #
 * # the first film of a new voiceover it did not: beat 0 claimed only the  #
 * # catch-all job `source_inspection`, P03 was refused at G14              #
 * # `wrong-narrative-job`, framed-card drew, and the gate said "scenes[0]  #
 * # carries framed-card, not P03". The picture was fine — score 8.0,       #
 * # meanLuma 0.48, both inside P03's limits. Nothing was broken except     #
 * # that no part of the pipeline had been given the job.                   #
 * #                                                                        #
 * # A MUST THAT HOLDS BY LUCK IS NOT A MUST. This section owns it: it cuts #
 * # the title out of the opening shot's own narration and seats it on the  #
 * # opening shot DIRECTLY, before the sheet's own rows are anchored.       #
 * #                                                                        #
 * # THE OTHER HALF ALREADY EXISTS AND HAS SINCE D5. `openingCanCarryP03`   #
 * # in `stages/source.ts` was written for this same rule and holds the     #
 * # PICTURE — its score, its luma, its title-safe room. It was never given #
 * # a partner that holds the JOB, so the film kept sourcing a picture      #
 * # ready for a title it then never asked for. This is the partner.        #
 * #                                                                        #
 * # NOT IN THE RENDER BUNDLE. This file is reached through the barrel only #
 * # (see the header), so `bundleHash` cannot move and no film re-renders.  #
 * ##########################################################################
 */
export const OPENING_TITLE_TEMPLATE: DeviceId = 'P03'

/**
 * WHAT THE SYNTHESISED ROW CALLS ITSELF IN THE SEATING REPORT.
 *
 * Negative because every other row's index is its position in the sheet the
 * model wrote, and this row is not in that sheet. A reader of the report can
 * therefore tell our row from the model's at a glance, and the model's rows keep
 * the positions they had. Nothing in production reads this field — the log line
 * in `plan.ts` filters on `beatIndex` and `refusal` — so it is documentation.
 */
export const OPENING_TITLE_OPPORTUNITY_INDEX = -1

/**
 * THE PREPOSITIONS A SENTENCE HINGES ON. READ BY THE OPENING-TITLE BUILDER
 * BELOW AND BY NOTHING ELSE IN THIS PROJECT.
 *
 * ##########################################################################
 * # THE FIRST CUT THIS BUILDER EVER MADE WAS "On a wooded bluff above"     #
 * # OVER "the Allegheny Reservoir" — a headline sawn off on the very       #
 * # preposition that introduces its own kicker, in 92px type, as the       #
 * # film's FIRST FRAME.                                                    #
 * #                                                                        #
 * # `endsMidPhrase` did not catch it and was right not to. It reads five   #
 * # closed lists and none of them holds "above", because "above" was never #
 * # a word a MODEL ended a line on. A cut WE make out of running narration #
 * # is a different animal from a line a model chose, and it needs its own  #
 * # list.                                                                  #
 * #                                                                        #
 * # ONE LIST, TWO JOBS, AND THEY ARE THE SAME FACT. A headline may not     #
 * # STOP on one of these, and a kicker may not OPEN on one. "above the     #
 * # Allegheny Reservoir" becomes "Allegheny Reservoir" by skipping exactly #
 * # these and the joining words, because the preposition belongs to the    #
 * # JOIN between the two lines and to neither line itself.                 #
 * #                                                                        #
 * # WIDENING `DANGLING_WORDS` INSTEAD WOULD HAVE BEEN WRONG. `toLastWord`  #
 * # reads that list and trims every template's headline and every          #
 * # checklist row with it, so "above" there would quietly reshape lines on #
 * # films this change has no business touching.                            #
 * #                                                                        #
 * # THE SHORT ONES ARE DELIBERATELY ABSENT: of, in, at, on, for, to, from, #
 * # by and with are all in `JOINING_WORDS` already, and                     #
 * # `OPENING_TITLE_JOIN_WORDS` below reads the two sets together.           #
 * #                                                                        #
 * # "within" IS IN HERE THOUGH `WORDS_THAT_NEED_AN_OBJECT` LEAVES IT OUT.  #
 * # That exclusion was measured on "Radiant from within", a phrase the     #
 * # NARRATOR ends — three real sheets draw it. This list never judges a    #
 * # line anybody wrote; it judges a cut this file made, and a cut that     #
 * # lands on "within" is missing the thing it was about to name.           #
 * ##########################################################################
 */
export const OPENING_TITLE_HINGE_WORDS: ReadonlySet<string> = new Set([
  'above', 'across', 'after', 'against', 'along', 'among', 'around', 'before', 'behind',
  'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'inside', 'into', 'near',
  'off', 'onto', 'outside', 'over', 'past', 'since', 'through', 'throughout', 'toward',
  'towards', 'under', 'underneath', 'until', 'upon', 'within', 'without',
])

/**
 * AND THE WORDS A CUT MAY NOT STOP ON — that list plus the six the chooser
 * deliberately dropped.
 *
 * ##########################################################################
 * # `WORDS_THAT_OPEN_A_CLAUSE` LOST so, yet, where, when, who AND which ON #
 * # 2026-09-12, on the argument that a writer can end a whole sentence on  #
 * # each of them: "He said so", "Not yet", "No one knows where". That is   #
 * # right for a line a MODEL chose. It is wrong here, because this builder #
 * # does not choose a line, it CUTS one out of running narration, and a    #
 * # cut that lands on "when" never means "Nobody knows when".              #
 * #                                                                        #
 * # END OF LINE ONLY, AND THAT IS LOAD BEARING. The hinge words above are  #
 * # also SKIPPED at the head of the kicker. Skipping a "who" there would   #
 * # turn "Nobody ever knew" over "who built it" into "Nobody ever knew"    #
 * # over "built it" — a broken clause where a whole one was already        #
 * # sitting. So these six are read at the tail of a line and never at its  #
 * # head, which is why they are a second set rather than more members of   #
 * # the first.                                                             #
 * #                                                                        #
 * # THE COMMA IN THAT EXAMPLE IS NOT DECORATION, 2026-09-21. Unpunctuated, #
 * # "Nobody knows who built it." is refused outright now, because "who" is #
 * # not a join word and there is nothing else for the headline to end on.  #
 * # See `openingTitleHeadlineMayEnd`, whose box calls that out as the one  #
 * # acceptable line this project knowingly gave up.                        #
 * ##########################################################################
 */
const OPENING_TITLE_WILL_NOT_STOP_ON: ReadonlySet<string> = new Set([
  ...OPENING_TITLE_HINGE_WORDS,
  'when', 'where', 'who', 'which', 'that', 'so', 'yet',
])

/**
 * THE PREPOSITIONS THAT CAN BE THE JOIN, skipped at the head of the kicker.
 *
 * The hinge list plus the short ones out of `JOINING_WORDS`. A preposition at
 * the head of the kicker belongs to the seam between the two lines and to
 * neither line, which is what turns "above the Allegheny Reservoir" into a
 * kicker rather than the second half of a sentence.
 *
 * THE THREE ARTICLES ARE NOT IN HERE, and that is the point of the split. See
 * `OPENING_TITLE_ARTICLES`.
 */
const OPENING_TITLE_JOIN_PREPOSITIONS: ReadonlySet<string> = new Set([
  ...OPENING_TITLE_HINGE_WORDS,
  'of', 'in', 'at', 'on', 'for', 'to', 'from', 'by', 'with',
])

/**
 * Those, and the one conjunction that can also be a join: "The ground shook"
 * over "and the mountain woke" is a seam of the same kind. It is kept out of the
 * set above because an article after "and" belongs to the clause that follows
 * it, never to the join.
 */
const OPENING_TITLE_JOIN_WORDS: ReadonlySet<string> = new Set([
  ...OPENING_TITLE_JOIN_PREPOSITIONS,
  'and',
])

/**
 * a, an, the — AND THEY ARE ALMOST NEVER THE JOIN.
 *
 * ##########################################################################
 * # THE STRIP USED TO BE UNCONDITIONAL AND IT PRINTED FOUR BROKEN KICKERS  #
 * # IN GOLD TYPE ON A FILM'S FIRST FRAME. Measured over 14 openings, 9 of  #
 * # which produced copy at all:                                            #
 * #                                                                        #
 * #   "The Smithsonian Institute kept it" / "drawer for ninety years"      #
 * #   "At Harvard University"             / "librarian opened the box"     #
 * #   "The Army Corps of Engineers began" / "dam in nineteen sixty"        #
 * #   "In Rome, in the year seventy nine" / "mountain woke"                #
 * #                                                                        #
 * # AN ARTICLE BELONGS TO THE NOUN AFTER IT, NOT TO THE SEAM BEFORE IT.    #
 * # "the mountain woke" is a whole clause and "mountain woke" is not       #
 * # English at all, so an article at the very head of the kicker STAYS —   #
 * # and if keeping it puts the line over `P03_KICKER_MAX_CHARS`, the split #
 * # is refused and the next candidate is tried, which is this file's       #
 * # standing trade: a refused caption costs a caption, a drawn broken one  #
 * # costs the frame.                                                       #
 * #                                                                        #
 * # ONE EXCEPTION, AND IT IS THE ONE THE RULE WAS WRITTEN FOR. When the    #
 * # join's own preposition has just been skipped AND the article           #
 * # introduces a NAME, the article is the sentence's rather than the       #
 * # label's: "above the Allegheny Reservoir" is the place called Allegheny #
 * # Reservoir, and a kicker is a label. "in a drawer" is not — "drawer" is #
 * # a common noun, so "a" stays and that split is refused on width.        #
 * ##########################################################################
 */
const OPENING_TITLE_ARTICLES: ReadonlySet<string> = new Set(['a', 'an', 'the'])

/**
 * Does this cut stop somewhere a viewer will hear the missing half?
 *
 * `endsMidPhrase` is the chooser's own rule and runs first, so anything the
 * written arm would refuse is refused here before it can be proposed. The second
 * test is the list above, which only this builder reads.
 */
export function openingTitleStopsShort(line: string): boolean {
  if (endsMidPhrase(line)) return true
  const tokens = contentTokens(line)
  const last = tokens[tokens.length - 1]
  return last !== undefined && OPENING_TITLE_WILL_NOT_STOP_ON.has(last)
}

/** One raw narration word as the chooser normalises it, or '' if it is all punctuation. */
function openingToken(word: string | undefined): string {
  return word === undefined ? '' : (contentTokens(word)[0] ?? '')
}

/**
 * The lower-case words a NAME carries inside itself, as "of" does in "Army Corps
 * of Engineers" and "van" does in "Ludwig van Beethoven". Read by the cut guard
 * alone, and only ever BETWEEN two capitalised words — on its own, "the" is just
 * an article.
 */
const OPENING_TITLE_NAME_PARTICLES: ReadonlySet<string> = new Set([
  'of', 'the', 'and', 'da', 'de', 'del', 'della', 'der', 'di', 'van', 'von',
])

/** Is this word capitalised, which mid-sentence is what a name looks like? */
function looksLikeAName(word: string | undefined): boolean {
  if (word === undefined) return false
  const bare = word.replace(/^[^\p{L}\p{N}]+/u, '')
  return bare.length > 0 && /^\p{Lu}/u.test(bare)
}

/** Is this word part of a figure said in words, or a bare numeral? */
function isANumberWord(word: string | undefined): boolean {
  const token = openingToken(word)
  return token.length > 0 && (NUMBER_WORDS.has(token) || /^[0-9]+$/u.test(token))
}

/**
 * IS THE "to" AT `words[at]` AN INFINITIVE MARKER RATHER THAN THE SEAM?
 *
 * ##########################################################################
 * # "to" IS THE ONE JOIN WORD THAT IS USUALLY NOT A JOIN, AND THE SKIP ATE #
 * # IT EITHER WAY. 2026-09-21.                                             #
 * #                                                                        #
 * # Every other member of `OPENING_TITLE_JOIN_PREPOSITIONS` introduces a   #
 * # noun, so eating it leaves the noun standing — "above the Allegheny     #
 * # Reservoir" becomes "Allegheny Reservoir" and the kicker is a label.    #
 * # "to" introduces a VERB about as often, and eating that one leaves the  #
 * # verb standing with nothing to conjugate it, which is not English.      #
 * #                                                                        #
 * # THREE OF THE CLIENT'S OWN SENTENCES, VERBATIM, THROUGH THE REAL LOOP:  #
 * #                                                                        #
 * #   "None of this was a community waiting to be relocated."              #
 * #       -> "None of this was a community waiting" / "be relocated"       #
 * #   "The name is not going to be written."                               #
 * #       -> "The name is not going" / "be written"                        #
 * #   "Not a verdict to be delivered."   -> "Not a verdict" / "be delivered"#
 * #                                                                        #
 * # Each drew in 64px gold type on the first frame with the plan gate      #
 * # GREEN at 11 PASS, where before the opening title existed at all those  #
 * # films failed T-11 loudly BEFORE a two-hour render.                     #
 * #                                                                        #
 * # NO PART OF SPEECH TAGGER, AND NONE IS NEEDED. What follows a real      #
 * # prepositional "to" is a destination, so it is an article or a name —   #
 * # "to the Allegheny Reservoir", "to Washington". What follows an         #
 * # infinitive marker is a bare verb — "to be", "to halt", "to stop". The  #
 * # two next words tell them apart without knowing any grammar, and the    #
 * # `OPENING_TITLE_ARTICLES` box already relies on exactly this pair of    #
 * # tests one field over.                                                  #
 * #                                                                        #
 * # REFUSING THE SKIP REFUSES THE SPLIT, AND THAT IS THE POINT. With the   #
 * # "to" kept, `from` never passes `head`, so the join arm of              #
 * # `openingTitleHeadlineMayEnd` has no seam to point at and the candidate #
 * # falls out of the loop — this file's standing trade, a refused caption  #
 * # costs a caption and a drawn broken one costs the frame.                #
 * #                                                                        #
 * # THE ONE MEASURED LOSS is "It dates to roughly 100 BCE," out of the     #
 * # Enoch script, which used to draw "It dates" / "roughly 100 BCE". An    #
 * # adverb is neither an article nor a name, so it goes with the bad ones. #
 * # Widening this to let a FIGURE through would buy that line back and was #
 * # deliberately not done: "to" before a bare numeral is as often a range  #
 * # ("rose to 300") as a destination, and the guard below refuses those.   #
 * ##########################################################################
 */
function openingTitleIsAnInfinitiveMarker(words: readonly string[], at: number): boolean {
  if (openingToken(words[at]) !== 'to') return false
  const next = words[at + 1]
  return !OPENING_TITLE_ARTICLES.has(openingToken(next)) && !looksLikeAName(next)
}

/**
 * IS `words[from .. tail)` ONE BARE WORD THAT NAMES NOTHING?
 *
 * ##########################################################################
 * # THE SKIP EATS THE SEAM, AND SOMETIMES THE SEAM WAS CARRYING THE        #
 * # MEANING. 2026-09-21.                                                   #
 * #                                                                        #
 * # A hinge preposition after a NOUN is a join — "a bluff above the        #
 * # Allegheny Reservoir" is a bluff and a reservoir, and eating "above"    #
 * # leaves both halves standing. The same preposition after a VERB is part #
 * # of the verb, and eating it leaves one orphaned object behind:          #
 * #                                                                        #
 * #   "Court in Washington ruled against them."     -> ... / "them"        #
 * #   "The text says their spirits are at peace."   -> ... / "peace"       #
 * #   "They are not gazing at nothing."             -> ... / "nothing"     #
 * #   "Senecas now had an Engineers Report in hand."-> ... / "hand"        #
 * #   "Enoch, the book they cut out of scripture."  -> ... / "scripture"   #
 * #                                                                        #
 * # All five are the client's own sentences and all five drew with the     #
 * # plan gate green. The third one reads on the frame as the OPPOSITE of   #
 * # what he said.                                                          #
 * #                                                                        #
 * # NOT BY REFUSING TO EAT THE PREPOSITION, WHICH IS THE WALL TWO EARLIER  #
 * # ROUNDS HIT. Keeping it gives "above the Allegheny Reservoir", 30       #
 * # characters against a 24-character kicker budget, so the real failing   #
 * # film loses the very line the hand rescue wrote. Nothing in this file   #
 * # can tell a verb from a noun, so the seam cannot be judged at all.      #
 * #                                                                        #
 * # SO JUDGE WHAT COMES OUT INSTEAD OF WHAT MADE IT. A kicker is a LABEL   #
 * # — that is the `OPENING_TITLE_ARTICLES` box's word for it — and one     #
 * # bare common noun with its particle gone is not one. It is the same     #
 * # argument `openingTitleHeadlineMayEnd` makes about a one-word HEADLINE, #
 * # one line down: one word out of running narration has no internal       #
 * # structure, so nothing in it shows what the sentence was doing.         #
 * #                                                                        #
 * # A NAME OR A FIGURE IS A LABEL ON ITS OWN, and those are the two        #
 * # exceptions. "Pennsylvania", "Puech" and "House" all still draw, and so #
 * # does a bare year — the whole genre puts one on a card by itself.       #
 * #                                                                        #
 * # MEASURED THROUGH THIS LOOP, NOT A MODEL OF IT. All 6 openings the      #
 * # boxes say must survive come back exactly right, "On a wooded bluff" /  #
 * # "Allegheny Reservoir" among them; all 5 named severed cases stay       #
 * # refused; the 89-opening corpus goes from 36 drawing to 27 and every    #
 * # one of the 9 it drops is a bare word. Across the client's two real     #
 * # scripts it is Kinzua 11 -> 9 and Enoch 15 -> 10, and the only loss a   #
 * # person would argue for is "It is the word" / "wakefulness".            #
 * #                                                                        #
 * # WHAT IT DOES NOT CLOSE, so the next reader does not assume it did: a   #
 * # kicker that OPENS mid-clause is still never examined, because          #
 * # `openingTitleStopsShort` judges the LAST word of a line. "He had       #
 * # concluded, he said" / "that it" is his sentence and it still draws.    #
 * # Refusing a kicker that opens on "that" would also refuse "The          #
 * # implication" / "that verb", where the same word is a determiner and    #
 * # the line is right, and the skip's own box explains why "who" at the    #
 * # head of a kicker is left alone. That one needs grammar this file does  #
 * # not have.                                                              #
 * ##########################################################################
 */
function openingTitleKickerIsABareWord(
  words: readonly string[],
  from: number,
  tail: number,
): boolean {
  if (tail - from !== 1) return false
  const only = words[from]
  return !looksLikeAName(only) && !isANumberWord(only)
}

/**
 * THE TWELVE MONTH NAMES, READ BY THE CUT GUARD BELOW AND BY NOTHING ELSE.
 *
 * ##########################################################################
 * # A MONTH AND ITS YEAR ARE ONE MARK, AND NEITHER HALF OF THE GUARD SAW   #
 * # IT. `isANumberWord` reads `NUMBER_WORDS` plus a bare-numeral regex and #
 * # no month is in either, so "August | 1961" was never two figures.       #
 * # `looksLikeAName` cannot help either, because "1961" starts with a      #
 * # digit and `/^\p{Lu}/u` fails on it — so the name|name rule did not     #
 * # fire and the cut was legal.                                            #
 * #                                                                        #
 * # THE CLIENT'S OWN FILM HAS THE SHAPE. Segment "In August 1961," is one  #
 * # of its 116, and cut first it printed "In August" over "1961" in 92px   #
 * # type with the plan gate green. A date is the one mark the surrounding  #
 * # file works hardest to get on screen intact.                            #
 * #                                                                        #
 * # LOCAL RATHER THAN ADDED TO `NUMBER_WORDS`, for the reason the          #
 * # `DANGLING_WORDS` box gives a few fields up: that set is read by the    #
 * # chooser across every template and every film, and a month counted as a #
 * # figure there would reshape lines this change has no business touching  #
 * # — "may" and "march" are ordinary words everywhere except next to a     #
 * # figure, which is the only place this list is ever consulted.           #
 * ##########################################################################
 */
const OPENING_TITLE_MONTHS: ReadonlySet<string> = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
])

/** Is this word one of the twelve months? See the box above. */
function isAMonthName(word: string | undefined): boolean {
  return OPENING_TITLE_MONTHS.has(openingToken(word))
}

/**
 * ARE THESE TWO WORDS, WHICH THE KICKER-HEAD SKIP HAS PULLED TOGETHER, ONE MARK?
 *
 * ##########################################################################
 * # THE SAME THREE PAIRINGS `openingTitleMayCutBefore` REFUSES, ASKED      #
 * # ACROSS THE SKIP. That guard is handed one index and compares the two   #
 * # words either side of it, so it cannot see the word the kicker actually #
 * # OPENS on once a join word has been eaten. This one is handed both ends #
 * # and nothing in between.                                                #
 * #                                                                        #
 * # WITHOUT THE MONTH ARMS THE GUARD REFUSED THE DATE IT WAS WRITTEN FOR   #
 * # AND PRINTED THE SAME DATE ONE PREPOSITION WIDER. "In August 1961," was #
 * # refused, while "In August of 1961," was judged as "August" against     #
 * # "of", the skip ate the "of", and the kicker opened on "1961" alone.    #
 * # All three of "In August of 1961,", "In March of 1936," and "In October #
 * # of 1956," are verbatim in the client's Kinzua script, so this is his   #
 * # own wording rather than a shape invented for a test.                   #
 * #                                                                        #
 * # MEASURED AT ZERO COST: every opening the builder is pinned to keep is  #
 * # unchanged, every named severed case stays refused, and the Skagit      #
 * # opening still draws "On the morning" over "December 1st, 1989".        #
 * ##########################################################################
 */
function openingTitleIsOneMarkAcrossTheSkip(
  before: string | undefined,
  after: string | undefined,
): boolean {
  if (isANumberWord(before) && isANumberWord(after)) return true
  if (isAMonthName(before) && isANumberWord(after)) return true
  return isANumberWord(before) && isAMonthName(after)
}

/**
 * MAY A LINE BOUNDARY FALL BETWEEN `words[at - 1]` AND `words[at]`?
 *
 * ##########################################################################
 * # THE BUILDER HAS NO MODEL OF WHICH ADJACENT WORDS ARE ONE THING, AND    #
 * # THAT WAS ITS ONLY REAL DEFECT. Measured over 20 opening sentences from #
 * # 20 topics: 14 cuts came back good, 1 refused, and every one of the 5   #
 * # bad ones broke a name or a number in half —                            #
 * #                                                                        #
 * #   "In the spring of nineteen" / "forty seven, a Bedouin"               #
 * #   "The Army Corps"            / "Engineers began"                      #
 * #   "Between nineteen"          / "sixty"                                #
 * #                                                                        #
 * # A broken proper noun in the biggest type on the film's first frame is  #
 * # exactly the class `TEMPLATES_REFUSED_NOT_CUT` exists for — "Great      #
 * # Isaiah Scroll and Habakkuk" names a different object from the whole    #
 * # phrase, and "The Army Corps" names a different thing from "The Army    #
 * # Corps of Engineers".                                                   #
 * #                                                                        #
 * # NOT `scanNarrationMarks`, AND THAT IS NOT LAZINESS. Those five         #
 * # detectors live in `apps/worker/src/stages/plan.ts` and read ALIGNED    #
 * # `WordTiming`s; this file is pure, has no audio, and cannot import the  #
 * # worker. They also answer a different question — "what is quotable" —   #
 * # and this one only has to answer "may I cut here", which is narrower    #
 * # and needs no timings. `NUMBER_WORDS` IS imported from the chooser, so  #
 * # at least the figure half of the model is shared rather than copied.    #
 * #                                                                        #
 * # THE FIRST WORD OF THE NARRATION IS ALWAYS CAPITALISED and nothing here #
 * # can tell a sentence's opening capital from a name's. It is read as a   #
 * # name, which can only ever REFUSE a cut and never make a bad one, and   #
 * # the cut it refuses is the one after a single opening word.             #
 * #                                                                        #
 * # THIS BOX USED TO EXCUSE THAT BY SAYING `openingTitleStopsShort`        #
 * # "almost always refuses anyway", AND THAT WAS FALSE — it refuses a      #
 * # one-word headline only when that word is on one of its two lists, and  #
 * # ordinary subjects are not. Measured over 20 short openings, 5 drew     #
 * # with a one-word headline: "He" over "ran", "Nobody" over "came", "It"  #
 * # over "was nineteen sixty five". The end guard is what actually holds   #
 * # that line now, and since 2026-09-21 it holds it on BOTH of its arms:   #
 * # a one-word headline is refused outright, whether a join word follows   #
 * # it or the narrator's own comma does. An earlier draft of this box      #
 * # said the comma still let one through "as in \"Go.\"", which was both   #
 * # true of the code and impossible as an example — `openingTitleCopy`     #
 * # refuses a narration of fewer than two words before any of this runs.   #
 * # The real instance was an ordinary sentence, "Still, the water came     #
 * # anyway.", drawing "Still" in 92px type. See                            #
 * # `openingTitleHeadlineMayEnd`.                                          #
 * ##########################################################################
 */
function openingTitleMayCutBefore(words: readonly string[], at: number): boolean {
  const before = words[at - 1]
  const after = words[at]
  /* Nothing on one side, so there is no run here to cut into. */
  if (before === undefined || after === undefined) return true
  /* One figure said in words: "nineteen | forty | seven". */
  if (isANumberWord(before) && isANumberWord(after)) return false
  /*
   * One date: "August | 1961" and "6 | August" are each one mark, not two.
   * Both directions, because this genre writes a date either way round, and
   * `isANumberWord` covers the year said in words as well — "August |
   * nineteen sixty one". See `OPENING_TITLE_MONTHS`.
   */
  if (
    (isAMonthName(before) && isANumberWord(after)) ||
    (isANumberWord(before) && isAMonthName(after))
  ) {
    return false
  }
  /* One name: "Allegheny | Reservoir". */
  if (looksLikeAName(before) && looksLikeAName(after)) return false
  /* And one name across the particle it carries: "Army Corps | of | Engineers". */
  if (
    OPENING_TITLE_NAME_PARTICLES.has(openingToken(after)) &&
    looksLikeAName(before) &&
    looksLikeAName(words[at + 1])
  ) {
    return false
  }
  if (
    OPENING_TITLE_NAME_PARTICLES.has(openingToken(before)) &&
    looksLikeAName(after) &&
    looksLikeAName(words[at - 2])
  ) {
    return false
  }
  return true
}

/**
 * DOES THE NARRATOR HIMSELF END A CLAUSE AT `words[at - 1]`?
 *
 * ##########################################################################
 * # THE KICKER'S TAIL IS THE ONE END NOBODY ELSE IS HOLDING, AND IT WAS    #
 * # WHERE EVERY REMAINING BAD LINE CAME FROM.                              #
 * #                                                                        #
 * # The headline's end is the JOIN between the two lines, and the hinge    #
 * # list holds it. The kicker's start is the far side of that join, and    #
 * # the skip holds it. Its tail had only a 24-character budget, so the     #
 * # balance score simply took as many words as fitted and stopped wherever #
 * # the twenty-fifth character fell. Measured over 20 openings from 20     #
 * # topics, that produced "the Tokyo fish market wakes" with its "up"      #
 * # gone, "every letter she ever" and "three names share one" — five lines #
 * # cut in the middle of a phrase that no word list can catch, because     #
 * # every one of them ends on an ordinary word.                            #
 * #                                                                        #
 * # SO PREFER THE CLAUSE THE WRITER FINISHED. This is `toLastWholeClause`'s#
 * # argument, one field over: "dropping back to a boundary the writer      #
 * # themselves put in loses information and stays true. Keeping half a     #
 * # clause invents." The same 20 openings come back with 5 broken lines    #
 * # traded for 3 extra refusals and 2 lines that got BETTER, which is this #
 * # file's standing trade — a refused caption costs a caption, a drawn     #
 * # broken one costs the frame. And a refusal is not a lost opening here,  #
 * # because the row still seats with no copy and the spoken arm still runs.#
 * #                                                                        #
 * # THE END OF THE NARRATION COUNTS. A shot that runs to the end of its    #
 * # sentence often carries no closing mark at all — the segmenter cuts     #
 * # mid-sentence, which is what "On a wooded bluff above the Allegheny     #
 * # Reservoir," is — so the last word of the shot is always a legal end.   #
 * ##########################################################################
 */
function openingTitleEndsAClause(words: readonly string[], at: number): boolean {
  if (at >= words.length) return true
  const last = words[at - 1]
  /* The narrator's own mark, under any closing quote or bracket he put after it. */
  return last !== undefined && /[,;:.…?!—–]["'’”)\]]*$/u.test(last)
}

/**
 * MAY THE HEADLINE END AT `words[head]`, WITH THE KICKER OPENING AT `from`?
 *
 * ##########################################################################
 * # THE HEADLINE'S END WAS THE ONE END NOBODY WAS HOLDING, AND IT SHIPPED  #
 * # A WORSE FILM THAN NO FIX AT ALL. 2026-09-21.                           #
 * #                                                                        #
 * # The three guards around it all judge something else. `endsMidPhrase`   #
 * # and `OPENING_TITLE_WILL_NOT_STOP_ON` read the LAST WORD against closed #
 * # lists, so they catch "above" and "when" and nothing else; the kicker's #
 * # tail has `openingTitleEndsAClause`; the kicker's head has the join     #
 * # skip. Nothing asked whether the headline was a whole enough unit to    #
 * # stand alone, so a cut after an ordinary verb, auxiliary or subject was #
 * # legal — and `deviceText(max)` is `.min(1)`, so a ONE-WORD headline is  #
 * # schema-valid and draws.                                                #
 * #                                                                        #
 * # MEASURED ON THE CLIENT'S OWN FILM: 14 of its 116 segments are five     #
 * # words or fewer and 11 of those printed a severed title — "Geography    #
 * # made" over "the choice", "He" over "ran", "Start" over "1936". End to  #
 * # end the plan gate came back 11 PASS on every one of them. That is      #
 * # STRICTLY WORSE than before the opening-title fix existed, because      #
 * # those films used to fail T-11 loudly BEFORE a two-hour render and a    #
 * # person looked at them.                                                 #
 * #                                                                        #
 * # ONE WORD IS NEVER A HEADLINE, WHATEVER FOLLOWS IT. That is the first   #
 * # line of the function and it guards BOTH arms below. One word cut out   #
 * # of running narration has no internal structure at all, so nothing in   #
 * # it shows where the sentence was going — which is the same reason this  #
 * # file refuses a one-word NARRATION outright, two screens down.          #
 * #                                                                        #
 * # IT USED TO GUARD ONLY THE JOIN ARM, AND THE MARK ARM LET IT BACK IN.   #
 * # 2026-09-21, second pass. `openingTitleEndsAClause` is satisfied by any #
 * # comma, so a narration whose FIRST word carries one printed that single #
 * # word in 92px type with the gate green — 6 of 12 ordinary documentary   #
 * # openers did it:                                                        #
 * #                                                                        #
 * #   "Still, the water came anyway."  -> "Still" / "the water came anyway"#
 * #   "Yes, the valley is gone."       -> "Yes"   / "the valley is gone"   #
 * #   "First, the graves were moved."  -> "First" / "the graves were moved"#
 * #                                                                        #
 * # A sentence-initial adverb followed by a comma is not a clause he       #
 * # finished, it is one he started, so the argument above covers it too.   #
 * # The balance score hid this most of the time, because a longer headline #
 * # scores better; it surfaced exactly when no other legal cut existed,    #
 * # which is the worst case to be lenient in. It costs nothing measurable  #
 * # — the draw counts on both of the client's real scripts are unchanged,  #
 * # and 0 of their 106 capitalised-start segments ever had the shape.      #
 * #                                                                        #
 * # TWO WAYS TO END A HEADLINE, AND BOTH ARE THE NARRATOR'S OWN:           #
 * #                                                                        #
 * #   1. HE PUT A MARK THERE. `openingTitleEndsAClause`, the same test the #
 * #      kicker's tail already uses — "Once elected," / "Kennedy ordered". #
 * #      A line he finished is a line that can stand on its own.           #
 * #                                                                        #
 * #   2. A JOIN WORD FOLLOWS. `from > head` is true exactly when the skip  #
 * #      above consumed a preposition or "and", which is the seam between  #
 * #      the two lines — "On a wooded bluff" / above / "Allegheny          #
 * #      Reservoir". On its own a seam is not enough: "Start in 1936"      #
 * #      hands it an "in" and leaves "Start" alone in 92px type, and so do #
 * #      "Presbyterian" and "Nobody", which is what the one-word rule      #
 * #      above was written for and why it is stated once for both arms.    #
 * #                                                                        #
 * # NOT `JOINING_WORDS` FOR THE SET, AND THIS WAS MEASURED BOTH WAYS. That #
 * # set holds the three articles, and an article at the head of the kicker #
 * # belongs to its own noun rather than to the seam — see                  #
 * # `OPENING_TITLE_ARTICLES`. Reading it here lets "Geography made" over   #
 * # "the choice" and "team proposed" over "an alternative" straight back   #
 * # through. `OPENING_TITLE_JOIN_WORDS` is the set the skip itself uses,   #
 * # so the question asked here is the one the code below already answered. #
 * #                                                                        #
 * # THE TRADE, MEASURED THROUGH THIS LOOP RATHER THAN A MODEL OF IT.       #
 * #                                                                        #
 * #   20 openings from 20 topics: all 20 used to produce copy, 8 still do. #
 * #     6 were already right and are untouched, the real failing film's    #
 * #     "On a wooded bluff" / "Allegheny Reservoir" among them.            #
 * #     2 got BETTER, because the winning cut moved to the narrator's own  #
 * #     comma: "October 1956, Corps" / "surveyors began" became            #
 * #     "October 1956" / "Corps surveyors began".                          #
 * #     11 severed ones are refused, and 1 acceptable line is lost —       #
 * #     "Nobody knows" over "who built it", whose sentence carries no      #
 * #     join and no mark for the headline to end at.                       #
 * #                                                                        #
 * #   The client's own 14 short segments: 11 printed a title, 4 do, and    #
 * #   every one of the 4 now ends where he put a mark.                     #
 * #                                                                        #
 * # That is this file's standing trade, written out in the                 #
 * # `DANGLING_WORDS` box: a refused caption costs a caption, a drawn       #
 * # broken one costs the frame. And a refusal is cheap here in particular, #
 * # because the row still seats with no copy and `buildCopy`'s SPOKEN arm  #
 * # still gets its chance at the opening.                                  #
 * ##########################################################################
 */
function openingTitleHeadlineMayEnd(
  words: readonly string[],
  head: number,
  from: number,
): boolean {
  /* One word is never a headline, whatever follows it. See the box above. */
  if (head < 2) return false
  if (openingTitleEndsAClause(words, head)) return true
  return from > head
}

/**
 * `words[from .. to)` as one drawable line.
 *
 * The edge punctuation goes because a cut out of running narration keeps the
 * comma or full stop that belonged to the sentence, and "Allegheny Reservoir,"
 * on a title card reads as a line that broke. A "?" or a "!" STAYS: those are
 * the narrator's, not the cut's, and dropping one changes what the line says.
 */
function openingTitleLine(words: readonly string[], from: number, to: number): string {
  return words
    .slice(from, to)
    .join(' ')
    .replace(/^[\s"'‘“([—–-]+/u, '')
    .replace(/[\s,;:.…"'’”)\]—–-]+$/u, '')
    .trim()
}

/** The two lines of a synthesised opening title. */
export type OpeningTitleCopy = {
  readonly headline: string
  readonly kicker: string
}

/**
 * ASK FOR AN OPENING TITLE — the narration to cut it out of, and T-5's own
 * predicate to refuse it with.
 *
 * ##########################################################################
 * # THE TWO FIELDS ARE ONE OBJECT SO THE FILTER CANNOT BE FORGOTTEN, AND   #
 * # THE FIRST VERSION OF THIS FIX FORGOT IT. The builder below is the only #
 * # route in the pipeline that puts narration words on a frame, and every  #
 * # other one — `scanNarrationMarks`, `properNounEntity`,                  #
 * # `applyOperatorPlacements` — asks T-5's question first. Without it a    #
 * # documentary whose first sentence says "At the Carnegie Institute"      #
 * # trades a T-11 failure for a T-5 one, and T-5 is a NEVER.               #
 * #                                                                        #
 * # INJECTED RATHER THAN COPIED, BECAUSE THE LIST MUST NOT EXIST TWICE.    #
 * # `namesAnInstitution`, `INSTITUTION_WORDS` and `INSTITUTION_INITIALISM` #
 * # live in `apps/worker/src/stages/plan.ts`, which this package cannot    #
 * # import — and moving them here would break the plan gate, whose own     #
 * # copy is SCRAPED out of that file's source text by name                 #
 * # (`readThresholds`, harness/planCheck.ts) precisely so it cannot drift. #
 * # A second list here would be a third reader of a rule whose whole       #
 * # history is one copy drifting from another: "school" was listed in      #
 * # English alone while every other head noun carried five languages, and  #
 * # "École Biblique, Jerusalem" reached a delivered frame. So the worker   #
 * # hands its own predicate down, and there is still exactly one list.     #
 * ##########################################################################
 */
export type OpeningTitleRequest = {
  /** The opening shot's own narration, which is the only text this may print. */
  readonly narration: string
  /** T-5's rule, passed down from the worker. See the box above. */
  readonly namesAnInstitution: (line: string) => boolean
}

/**
 * P03's TWO LINES, CUT OUT OF THE OPENING SHOT'S OWN NARRATION, OR NULL.
 *
 * ##########################################################################
 * # BOTH LINES COME OUT OF THE SAME STRING `everyContentWordWasSpoken`     #
 * # READS AS `beat.text`, SO THE CHOOSER'S COPY GATE PASSES BY             #
 * # CONSTRUCTION RATHER THAN BY LUCK. That gate is the one that put "A     #
 * # STRUCTURE THAT BREAKS" on the closing frame of a delivered film off a  #
 * # passage spoken a second after the cut ended; a line quoted from the    #
 * # shot itself cannot fail it.                                           #
 * #                                                                        #
 * # IT ASKS THE CHOOSER'S OWN QUESTIONS AND NOT LOOKALIKES. The real width #
 * # gate `p03HeadlineFits`, the real schema bounds, the real              #
 * # `endsMidPhrase`, the real `kickerRepeatsTheHeadline`. A pair this      #
 * # returns is a pair the written arm of `buildCopy` will draw.           #
 * #                                                                        #
 * # THREE OF ITS GATES IT CANNOT MODEL, AND SAYING SO IS THE POINT.        #
 * # `writtenLineStopsMidPhrase` reads the beat's NEIGHBOUR window (it can  #
 * # only ever EXCUSE a line this one already passed, so it is safe);       #
 * # `drawnHeadlines` is a whole-film ledger, and scene 0 is the first beat #
 * # judged so the ledger is empty there; `nameIsCorroborated` reads the    #
 * # picture's archive URL when the headline equals a scene entity, and     #
 * # this builder never sees the entities. That last one can still refuse.  #
 * #                                                                        #
 * # EVERY SPLIT POINT, NOT THE LONGEST HEADLINE FIRST. The greedy version  #
 * # broke a phrase on half the openings it was measured against, leaving   #
 * # "It started with a phone" over "call" and "Rome, in the year seventy"  #
 * # over "nine". Scoring on `min(headline, kicker)` picks the BALANCED cut #
 * # instead — "It started" over "phone call" — and that one rule is what   #
 * # turns most of the 20 measured openings from passable into right.       #
 * #                                                                        #
 * # TIES BREAK ON THE EARLIEST HEADLINE AND THE LONGEST KICKER, BECAUSE    #
 * # THIS ANSWER FEEDS A RENDER KEY. `computeRenderKey` hashes              #
 * # `scene.device` whole, so two runs over one narration must return the   #
 * # same two strings or one film's pixels serve under another film's hash. #
 * # The loops run head-ascending and tail-descending and the comparison is #
 * # strict, so the first candidate at a given balance is the one kept.     #
 * #                                                                        #
 * # AND T-5 REFUSES A SPLIT RATHER THAN THE WHOLE TITLE. A headline or a   #
 * # kicker that names an institution simply loses its candidacy and the    #
 * # loop carries on, so a narration that can be cut somewhere else still   #
 * # gets its title; only a narration where EVERY split names one falls     #
 * # through to the no-copy seat. See `OpeningTitleRequest`.                #
 * ##########################################################################
 */
export function openingTitleCopy(request: OpeningTitleRequest): OpeningTitleCopy | null {
  const words = request.narration.trim().split(/\s+/u).filter((word) => word.length > 0)
  /* One word cannot be two lines, and `P03.tsx` always draws both. */
  if (words.length < 2) return null

  let best: { readonly copy: OpeningTitleCopy; readonly balance: number } | null = null
  for (let head = 1; head < words.length; head += 1) {
    if (!openingTitleMayCutBefore(words, head)) continue

    /*
     * ######################################################################
     * # THE KICKER OPENS PAST THE JOIN, AND THE JOIN IS PREPOSITIONS —     #
     * # NOT ARTICLES. This is what turns "above the Allegheny Reservoir"   #
     * # into "Allegheny Reservoir" without also turning "the mountain      #
     * # woke" into "mountain woke". The `OPENING_TITLE_ARTICLES` box has   #
     * # the four broken kickers the unconditional strip printed and the    #
     * # one case where an article really is the sentence's rather than the #
     * # label's.                                                           #
     * #                                                                    #
     * # COMPUTED **BEFORE** THE HEADLINE IS ACCEPTED, 2026-09-21, because  #
     * # `from > head` is the only evidence in this loop that a real join   #
     * # sits between the two lines, and the headline's own end guard needs #
     * # it. Nothing else about this block moved: it reads `words` and      #
     * # `head` alone, so hoisting it cannot change what it computes.       #
     * #                                                                    #
     * # AND THE SKIP STOPS DEAD ON AN INFINITIVE'S "to", 2026-09-21, which #
     * # is the one join word that is usually not a join at all. See        #
     * # `openingTitleIsAnInfinitiveMarker` for the three of the client's   #
     * # own sentences that printed a bare verb phrase in gold type.        #
     * ######################################################################
     */
    let from = head
    while (from < words.length && OPENING_TITLE_JOIN_WORDS.has(openingToken(words[from]))) {
      if (openingTitleIsAnInfinitiveMarker(words, from)) break
      from += 1
    }
    if (
      from > head &&
      OPENING_TITLE_JOIN_PREPOSITIONS.has(openingToken(words[from - 1])) &&
      OPENING_TITLE_ARTICLES.has(openingToken(words[from])) &&
      looksLikeAName(words[from + 1])
    ) {
      from += 1
    }

    /* The headline has to END somewhere the narrator did. See the box there. */
    if (!openingTitleHeadlineMayEnd(words, head, from)) continue
    /*
     * ######################################################################
     * # A FIGURE ON EACH SIDE OF THE SEAM IS ONE RANGE, AND ONLY THIS      #
     * # LOOP CAN SEE IT. 2026-09-21.                                       #
     * #                                                                    #
     * # `openingTitleMayCutBefore` already refuses two adjacent figures,   #
     * # but it compares `words[at - 1]` against `words[at]` and never      #
     * # looks across the skip — so "one | through | 36" was judged as      #
     * # "one" against "through", which is not two figures, and the cut was #
     * # legal. "through" is a hinge word, so the skip then ate it and the  #
     * # kicker opened on the far half of the range alone.                  #
     * #                                                                    #
     * # THE CLIENT'S OWN ENOCH SCRIPT HAS IT TWICE, VERBATIM:              #
     * #                                                                    #
     * #   "Enoch chapters one through 36, which" -> "Enoch chapters one"   #
     * #                                             / "36"                 #
     * #   "chapters 37 through 71, where"        -> "chapters 37" / "71"   #
     * #                                                                    #
     * # A range is the same kind of mark as a date, and the                #
     * # `OPENING_TITLE_MONTHS` box makes the argument in full: it is the   #
     * # one thing the surrounding file works hardest to get on screen      #
     * # intact, and half of one names a different thing from the whole.    #
     * #                                                                    #
     * # HERE RATHER THAN INSIDE THE CUT GUARD, because `from` is the only  #
     * # thing that knows where the kicker really opens and the guard is    #
     * # given a single index. It is stated as one line next to the end     #
     * # guard for the same reason that guard needs `from`.                 #
     * ######################################################################
     */
    if (openingTitleIsOneMarkAcrossTheSkip(words[head - 1], words[from])) continue
    const headline = openingTitleLine(words, 0, head)
    if (headline.length === 0) continue
    /* The sheet's own P03 budget, so the two paths agree on what fits a slot. */
    if (headline.length > (TEMPLATE_HEADLINE_CHARS.P03 ?? 64)) continue
    if (openingTitleStopsShort(headline)) continue
    if (!p03HeadlineFits(headline)) continue
    /* T-5 is a NEVER, and this is the rule the gate will read the frame with. */
    if (request.namesAnInstitution(headline)) continue

    for (let tail = words.length; tail > from; tail -= 1) {
      if (!openingTitleEndsAClause(words, tail)) continue
      if (!openingTitleMayCutBefore(words, tail)) continue
      const kicker = openingTitleLine(words, from, tail)
      if (kicker.length === 0 || kicker.length > P03_KICKER_MAX_CHARS) continue
      if (contentTokens(kicker).length === 0) continue
      if (openingTitleStopsShort(kicker)) continue
      /* And it has to be a LABEL, not the word left over after the skip ate a
       * verb's particle. See `openingTitleKickerIsABareWord`. */
      if (openingTitleKickerIsABareWord(words, from, tail)) continue
      /* The two blocks sit one above the other, so a shared word prints twice. */
      if (kickerRepeatsTheHeadline(kicker, headline)) continue
      /* T-5 again, because `deviceStrings` walks BOTH of P03's lines. */
      if (request.namesAnInstitution(kicker)) continue
      const balance = Math.min(headline.length, kicker.length)
      if (best === null || balance > best.balance) best = { copy: { headline, kicker }, balance }
    }
  }
  return best?.copy ?? null
}

/**
 * WHO HOLDS A SEATED SHOT: where its placement sits in `placements`, what it
 * draws, and the shot its own first word is spoken in.
 *
 * Named rather than inline since 2026-09-21, because the opening-title seat
 * reads the map too — it has to know whose row to refuse when it takes beat 0.
 */
type SeatedRow = {
  readonly at: number
  readonly spec: DeviceSpec
  readonly spokenIn: VisualPlanCandidateBeat | undefined
  readonly startMs: number
  readonly marked: VisualOpportunity
  readonly anchorChar: number
}

/**
 * SEAT THE OPENING TITLE ON THE FIRST SHOT, OR SAY WHY IT COULD NOT BE SEATED.
 *
 * ##########################################################################
 * # SEATED DIRECTLY, NOT PREPENDED TO THE SHEET, AND THE DIFFERENCE IS THE #
 * # WHOLE FIX.                                                             #
 * #                                                                        #
 * # A prepended row is still placed by the anchor, and the anchor is the   #
 * # thing that was failing. The loop below sorts candidate cuts by the     #
 * # distance from a row's FIRST SPOKEN WORD to each beat's START, not by   #
 * # which shot that word falls in. On job 5e14ad33 beat 0 runs 0 to 2960ms #
 * # and beat 1 starts at 2960ms, so a headline anchoring at 1520ms sits    #
 * # 1520ms from beat 0's cut and 1440ms from beat 1's — and seats on beat  #
 * # 1, failing T-11 again with a legal row at startChar 0. Measured: of    #
 * # six hand-written rows differing only in WHICH words of the opening     #
 * # they quoted, three seated on scene 0 and three did not.                #
 * #                                                                        #
 * # Picking a headline whose words start early enough makes it work by     #
 * # luck, and luck is the defect being replaced. Seating directly removes  #
 * # the entire class.                                                      #
 * #                                                                        #
 * # ##################################################################### #
 * # # AND IT IS SEATED **AFTER** THE SHEET'S OWN ROWS, NOT BEFORE THEM.  # #
 * # # THE ORDER IS A FIX IN ITS OWN RIGHT, 2026-09-21.                   # #
 * # #                                                                    # #
 * # # Seating first only LOOKED free. The sheet loop skips a beat that   # #
 * # # is already taken, so a row pass one had put on beat 0 did not stay # #
 * # # refused in pass two — it went looking for a neighbouring shot and  # #
 * # # often found one, which changes that scene's template, its device   # #
 * # # and its render key. Measured on a three-beat probe: one framed-    # #
 * # # card row moved from beat 0 to beat 1, drawn 1.2 s after its own    # #
 * # # words, carrying the very line the opening title was printing above # #
 * # # it. On job 5e14ad33 nothing moved only because that sheet's row 0  # #
 * # # is a gallery-strip wanting 131 frames and beat 0 is 89 — luck      # #
 * # # again, on the same film, in the opposite direction.                # #
 * # #                                                                    # #
 * # # Seating LAST makes the displaced row's answer the ordinary one for # #
 * # # a shot that is spoken for: `beat-already-taken`, in place, with no # #
 * # # second seat anywhere. NO OTHER ROW IS RE-SEATED.                   # #
 * # #                                                                    # #
 * # # THAT IS NOT "NOTHING ELSE IN THE FILM MOVES", AND THIS BOX USED TO # #
 * # # SAY THE STRONGER THING. The chooser carries two whole-film ledgers # #
 * # # that beat 0's winner writes into: `state.drawnHeadlines`, read as  # #
 * # # a refusal by a dozen gates, and `state.used`, read by G11's        # #
 * # # per-film cap and by the variety score, where an unused device      # #
 * # # scores 1000 and each use costs 250. Turning beat 0 from framed-    # #
 * # # card into P03 moves both, so a later beat whose top two devices    # #
 * # # sat within 250 points of each other COULD flip its winner.         # #
 * # #                                                                    # #
 * # # MEASURED, ON TWO FILMS, IT DOES NOT. The real failing film and     # #
 * # # art-v2, scene by scene, 116 scenes: 1 device differs, 1 renderKey  # #
 * # # differs, 0 non-device fields differ — and the device tally moves   # #
 * # # framed-card 3→2, P03 3→4, which is beat 0 and nothing else.        # #
 * # #                                                                    # #
 * # # THE GUARANTEE THAT IS STRUCTURAL IS THE OTHER ONE, and it is the   # #
 * # # one this change actually rests on: `plan.ts` runs this pass ONLY   # #
 * # # on a film whose opening was about to draw something other than     # #
 * # # P03, so a film that already works never reaches this code and its  # #
 * # # bytes cannot move. On the films that do reach it, the alternative  # #
 * # # was a plan the gate refuses.                                       # #
 * # #                                                                    # #
 * # # IT STILL TAKES THE BEAT, and that is the other half of the fix.    # #
 * # # The guard in `plan.ts` now asks what the opening will DRAW rather  # #
 * # # than what the sheet requested, so pass two runs on a film whose    # #
 * # # sheet DID name P03 on beat 0 with copy the chooser refuses. If the # #
 * # # title deferred to the holder there, the repair would do nothing on # #
 * # # exactly that film.                                                 # #
 * # ##################################################################### #
 * #                                                                        #
 * # DELIBERATELY NOT REGISTERED IN `holderOf`. That map exists so a seated #
 * # row can be MOVED to the shot its own words are spoken in. The opening  #
 * # title is the one row whose beat is fixed by a MUST, so it must never   #
 * # be given back. Nothing reads the map after this runs, which is why     #
 * # this can read it and not write it.                                     #
 * #                                                                        #
 * # NO COPY IS STILL A SEAT, AND IT IS THE COMMON CASE NOW. When the       #
 * # narration yields no legal pair the row is seated with both lines null  #
 * # anyway. This used to be measured at 1 opening in 20 — the degenerate   #
 * # "Go." — and the guards added on 2026-09-21 turned it into the majority #
 * # answer: 27 of an 89-opening corpus draw, and of the segments that      #
 * # START where a writer starts, which is the only shape scene 0 can ever  #
 * # have, 9 of the client's 43 do. That still appends P03's job in         #
 * # `narrativeJobsOf`, which opens G14, which lets `buildCopy`'s SPOKEN    #
 * # arm try the shot's own marks. Seating nothing would refuse that arm    #
 * # its chance for no gain.                                                #
 * ##########################################################################
 */
function seatOpeningTitle(
  input: {
    readonly openingTitle?: OpeningTitleRequest | null
    readonly beats: readonly VisualPlanCandidateBeat[]
  },
  planByBeat: Map<number, PlannedTemplate>,
  placements: VisualPlacement[],
  holderOf: ReadonlyMap<number, SeatedRow>,
): void {
  const request = input.openingTitle ?? null
  /*
   * `beats[0]`, THE LIST'S OWN FIRST ROW, AND IT HAS TO STAY THAT WAY.
   * `plan.ts` builds this list from `lists.scenes` in order and `ruleT11` reads
   * `plan.scenes[0]`, so the two name the same shot. `plan.test.ts` pins the
   * three lists index-aligned through the opening recut, which is what keeps
   * that true; a renumbering that broke it would break this.
   */
  const opening = input.beats[0]
  if (request === null || opening === undefined) return

  const base = {
    opportunityIndex: OPENING_TITLE_OPPORTUNITY_INDEX,
    templateId: OPENING_TITLE_TEMPLATE,
    snappedFromChar: null,
  }
  /*
   * The shot still has to be able to draw it — 55 to 240 frames and a picture
   * of its own. `canCarry` asks G2/G3/G4's own questions, so a refusal here is
   * a refusal the chooser would have made anyway, and T-11 then fails exactly
   * as it does today. `openingCanCarryP03` in the source stage is what keeps
   * the picture half of this true. The shot is left exactly as the sheet left
   * it, holder and all, because nothing has been gained by taking it.
   */
  if (!canCarry(DEVICE_REGISTRY[OPENING_TITLE_TEMPLATE], opening)) {
    placements.push({
      ...base,
      beatIndex: null,
      startMs: opening.startMs,
      offsetMs: null,
      refusal: 'no-shot-can-carry-it',
    })
    return
  }

  /*
   * THE HOLDER IS REFUSED WHERE IT STANDS, not re-seated. Its placement row
   * keeps its own `startMs` and `offsetMs` — the distance to the cut it asked
   * for — so the report still says which moment the sheet meant, and the code
   * is the one every other row gets for a shot already spoken for.
   */
  const holder = holderOf.get(opening.index)
  const evicted = holder === undefined ? undefined : placements[holder.at]
  if (holder !== undefined && evicted !== undefined) {
    placements[holder.at] = { ...evicted, beatIndex: null, refusal: 'beat-already-taken' }
  }

  const copy = openingTitleCopy(request)
  planByBeat.set(opening.index, {
    templateId: OPENING_TITLE_TEMPLATE,
    headline: copy?.headline ?? null,
    kicker: copy?.kicker ?? null,
    lines: [],
    reason: 'T-11 — the opening carries a title, cut from the first shot’s own narration',
  })
  /* `offsetMs: 0` because this row was not anchored at all. It was placed. */
  placements.push({
    ...base,
    beatIndex: opening.index,
    startMs: opening.startMs,
    offsetMs: 0,
    refusal: null,
  })
}

/**
 * Every marked moment becomes a beat index, or a written refusal.
 *
 * PURE. No clock, no randomness, no I/O. `computeRenderKey` hashes
 * `scene.device` whole, so two runs of this function over one sheet must be the
 * same answer or one film's pixels would be served under another film's hash.
 */
export function visualPlanForBeats(input: {
  readonly opportunities: readonly VisualOpportunity[]
  readonly scriptText: string
  readonly words: readonly AlignedWord[]
  readonly beats: readonly VisualPlanCandidateBeat[]
  readonly toleranceMs?: number
  /**
   * ASK FOR T-11's OPENING TITLE — the opening shot's own narration, and the
   * institution rule to refuse it with. See `OpeningTitleRequest`.
   *
   * ########################################################################
   * # OPTIONAL, AND ABSENT IS BYTE-IDENTICAL TO EVERY RUN BEFORE TODAY.    #
   * #                                                                      #
   * # `plan.ts` runs the sheet exactly as it always did and chooses devices #
   * # over it, and only if THAT leaves something other than P03 on the     #
   * # opening does it run a second pass with this field filled. So a film  #
   * # whose sheet already titles its own opening is planned from the same  #
   * # bytes it was planned from before — same map, same report, same       #
   * # render keys, no re-render. The repair runs only on the films that    #
   * # were failing, and on those the alternative was no film at all.       #
   * ########################################################################
   */
  readonly openingTitle?: OpeningTitleRequest | null
}): VisualPlanResult {
  const tolerance = input.toleranceMs ?? VISUAL_PLAN_CUT_TOLERANCE_MS
  const tokens = scriptTokens(input.scriptText)

  const planByBeat = new Map<number, PlannedTemplate>()
  const placements: VisualPlacement[] = []

  /*
   * Who holds each seated shot: where its placement sits in `placements`, its
   * template, and the shot its own first word is spoken in, so a row spoken
   * elsewhere can be moved home. See the give-back below.
   */
  const holderOf = new Map<number, SeatedRow>()

  /**
   * EVERY EXIT GOES THROUGH HERE, AND THE OPENING TITLE IS SEATED IN IT.
   *
   * ##########################################################################
   * # THE TITLE IS PLACED BY A MUST, NOT BY THE AUDIO, so none of the three  #
   * # things that can stop the sheet applies to it: an empty script (a film  #
   * # with no sheet at all), an unanchorable script, and a sheet refused for #
   * # drift all still leave `scenes[0]` needing a title. Hanging the seat off #
   * # the ordinary return alone would give the guarantee back to luck on      #
   * # exactly the films with the least of it, so it hangs off all three.      #
   * #                                                                        #
   * # AND IT RUNS LAST IN EVERY ONE OF THEM, which is what keeps a sheet row #
   * # the title displaces refused in place rather than re-seated on the shot  #
   * # next door. `seatOpeningTitle` has the measurement.                      #
   * ##########################################################################
   */
  const seated = (anchoredFraction: number, refusedForDrift: boolean): VisualPlanResult => {
    seatOpeningTitle(input, planByBeat, placements, holderOf)
    return { planByBeat, placements, anchoredFraction, refusedForDrift }
  }

  if (tokens.length === 0 || input.words.length === 0 || input.beats.length === 0) {
    return seated(0, false)
  }

  const anchor = anchorScriptToWords(tokens, input.words)
  const anchoredFraction = anchor.filter((entry) => entry !== null).length / tokens.length
  if (anchoredFraction < VISUAL_PLAN_MIN_ANCHORED_FRACTION) {
    return seated(anchoredFraction, true)
  }

  /** The first anchored token at or after `startChar`, as audio milliseconds. */
  const firstSpokenMs = (startChar: number): number | null => {
    const from = tokens.findIndex((token) => token.startChar >= startChar)
    if (from === -1) return null
    for (let i = from; i < tokens.length; i += 1) {
      const at = anchor[i]
      if (at !== undefined && at !== null) return input.words[at]?.startMs ?? null
    }
    return null
  }

  /**
   * Is every word a row is placed by, `quotedWords`, spoken inside `beat`,
   * reading forward from where the row is anchored? Each word's first saying
   * after the anchor is the one read, and a word the aligner never heard
   * refuses. False for a row with no words of its own, which has nothing to
   * say which shot is its own.
   */
  const headlineIsSpokenIn = (
    marked: VisualOpportunity,
    fromChar: number,
    beat: VisualPlanCandidateBeat,
  ): boolean => {
    const wanted = new Set(quotedWords(marked))
    if (wanted.size === 0) return false
    const from = tokens.findIndex((token) => token.startChar >= fromChar)
    if (from === -1) return false
    for (let i = from; i < tokens.length && wanted.size > 0; i += 1) {
      const token = tokens[i]
      if (token === undefined || !wanted.has(token.key)) continue
      const at = anchor[i]
      const ms = at === undefined || at === null ? null : (input.words[at]?.startMs ?? null)
      if (ms === null || ms < beat.startMs || ms >= beat.endMs) return false
      wanted.delete(token.key)
    }
    return wanted.size === 0
  }

  for (const [opportunityIndex, marked] of input.opportunities.entries()) {
    /*
     * G0, and it runs before anything else costs work. The model is told only
     * the ids the planner library offers and is capable of returning any other
     * string; a `DeviceId` that is not in the registry would reach
     * `chooseDevices` as a beat asking for a device that cannot be scored,
     * refused, or reported on.
     */
    if (!Object.hasOwn(DEVICE_REGISTRY, marked.templateId)) {
      placements.push({
        opportunityIndex,
        templateId: String(marked.templateId),
        beatIndex: null,
        startMs: null,
        offsetMs: null,
        refusal: 'unknown-template',
        snappedFromChar: null,
      })
      continue
    }

    /*
     * The pointer is corrected before anything is measured from it, so every
     * number below — the anchor, the tolerance window, `offsetMs` — is about
     * the moment this row's own words name rather than the one it mis-counted.
     */
    const quotedAt = quotedPassageStart(marked, tokens)
    const anchorChar = quotedAt ?? marked.startChar
    const base = {
      opportunityIndex,
      templateId: String(marked.templateId),
      snappedFromChar: quotedAt === null ? null : marked.startChar,
    }
    const miss = (refusal: VisualRefusal, startMs: number | null): void => {
      placements.push({ ...base, beatIndex: null, startMs, offsetMs: null, refusal })
    }

    const startMs = firstSpokenMs(anchorChar)
    if (startMs === null) {
      miss('no-anchor-in-the-audio', null)
      continue
    }

    /*
     * ##########################################################################
     * # THE NEAREST CUT THIS TEMPLATE CAN ACTUALLY USE, WHICH IS NOT THE SAME  #
     * # AS THE NEAREST CUT.                                                     #
     * #                                                                        #
     * # Measured on the first real run: seating on the nearest cut put 41 of 45 #
     * # opportunities on a shot and the chooser then drew ONE, because the      #
     * # planner reads the script and cannot see that a shot is 60 frames long   #
     * # or holds no photograph of its own. So the window is walked in order of  #
     * # distance and the first FIT is taken.                                    #
     * #                                                                        #
     * # THREE REFUSALS, IN THIS ORDER, AND THE ORDER IS WHAT MAKES THE REPORT   #
     * # READABLE. Nothing within the tolerance at all is `no-cut-within-        #
     * # tolerance`. Cuts there but none this template can draw on is `no-shot-  #
     * # can-carry-it`. A fit cut already spoken for is `beat-already-taken`.    #
     * # Three different problems with three different answers, and collapsing   #
     * # them would make the sheet's own report useless for fixing the prompt.   #
     * ##########################################################################
     */
    const within = input.beats
      .map((beat) => ({ beat, delta: Math.abs(beat.startMs - startMs) }))
      .filter((row) => row.delta <= tolerance)
      /* Nearest first; ties on the LOWER index, because this feeds a hash. */
      .sort((a, b) => a.delta - b.delta || a.beat.index - b.beat.index)

    const spec = DEVICE_REGISTRY[marked.templateId]
    const fit = within.filter((row) => canCarry(spec, row.beat, marked))

    /*
     * ONE DEVICE PER SCENE. `PlannedScene.device` is a single nullable object
     * and `Scene.tsx` mounts one `DeviceFrame`, so a second opportunity on the
     * same cut is not drawable. Taking the nearest FREE fit rather than
     * refusing on the first collision is what stops one crowded sentence
     * costing the two either side of it.
     */
    const seat = fit.find((row) => !planByBeat.has(row.beat.index))

    /*
     * ##########################################################################
     * # AND WHEN THE NEAREST CUT FAILS, THE SHOT THE ROW IS SPOKEN IN.        #
     * #                                                                        #
     * # A cut is measured from where a shot STARTS, so a long shot whose      #
     * # start is more than the tolerance before the row's first word is      #
     * # never in `within`, though the word is spoken on it. The V52 sheet's   #
     * # row 57, "Not passively aware" over "Actively seeking", is spoken      #
     * # 2.88 seconds into beat 154, a 130-frame shot that can carry it, and   #
     * # the only cut inside two seconds, beat 155's, cannot. It was refused   #
     * # with its own shot free. Forced there, it draws.                       #
     * #                                                                        #
     * # ONLY AFTER THE NEAREST CUT HAS FAILED, and only onto a shot that is   #
     * # free and can carry the template, so every row the nearest cut seats   #
     * # sits exactly where it did. The refusal, when there still is one, is   #
     * # the one the nearest cut earned, in the order the box above gives.     #
     * #                                                                        #
     * # ITS WHOLE HEADLINE, NOT ITS FIRST WORD. The same sheet's row 48, "They #
     * # see the world", starts on "They", the last word of beat 132, and is   #
     * # spoken on beat 133, one frame too short for it. On beat 132 it would  #
     * # sit over "he observes them in a state of full awareness". So the shot #
     * # must hold every word the row is placed by, see `headlineIsSpokenIn`,  #
     * # and a row with no words of its own is never moved off the nearest cut.#
     * ##########################################################################
     */
    const spokenIn = input.beats.find((beat) => beat.startMs <= startMs && startMs < beat.endMs)
    const ownShot =
      spokenIn !== undefined &&
      canCarry(spec, spokenIn, marked) &&
      headlineIsSpokenIn(marked, anchorChar, spokenIn)
        ? spokenIn
        : undefined
    let carrier = seat?.beat ?? (ownShot !== undefined && !planByBeat.has(ownShot.index) ? ownShot : undefined)

    /*
     * AND A SHOT HELD BY A ROW SPOKEN ELSEWHERE IS GIVEN BACK. The V52 sheet's
     * row 34, "Not a verdict" over "A condition in effect", is spoken 160ms into
     * beat 90, and row 33 took beat 90 first, from exactly the two-second edge,
     * though its own headline, "The memory condition is fixed", is spoken in
     * beat 89, which was free. So when this row's own shot is held by a row
     * whose own shot is a different one, free, able to carry it and holding its
     * whole headline, that row moves there and this one takes the shot it is
     * spoken in. Both then sit where they are spoken. A row the nearest cut put
     * on its own shot is never moved.
     */
    if (carrier === undefined && ownShot !== undefined) {
      const holder = holderOf.get(ownShot.index)
      const home = holder?.spokenIn
      const moved = planByBeat.get(ownShot.index)
      const was = holder === undefined ? undefined : placements[holder.at]
      if (
        holder !== undefined &&
        home !== undefined &&
        moved !== undefined &&
        was !== undefined &&
        home.index !== ownShot.index &&
        !planByBeat.has(home.index) &&
        canCarry(holder.spec, home, holder.marked) &&
        headlineIsSpokenIn(holder.marked, holder.anchorChar, home)
      ) {
        planByBeat.delete(ownShot.index)
        planByBeat.set(home.index, moved)
        placements[holder.at] = { ...was, beatIndex: home.index, offsetMs: home.startMs - holder.startMs }
        holderOf.delete(ownShot.index)
        holderOf.set(home.index, holder)
        carrier = ownShot
      }
    }

    if (carrier === undefined) {
      if (within.length === 0) {
        miss('no-cut-within-tolerance', startMs)
        continue
      }
      const nearest = (fit.length === 0 ? within : fit)[0]
      placements.push({
        ...base,
        beatIndex: null,
        startMs,
        offsetMs: nearest === undefined ? null : nearest.beat.startMs - startMs,
        refusal: fit.length === 0 ? 'no-shot-can-carry-it' : 'beat-already-taken',
      })
      continue
    }

    /*
     * TRIMMED TO THE SLOT THIS TEMPLATE DRAWS, not to the sheet's shared budget.
     * See the box on `TEMPLATE_HEADLINE_CHARS`: eleven placements were lost to
     * a headline that was exactly the length the planner had been told to write.
     * Trimming to the last whole word rather than mid-word, because a fragment
     * on screen reads as a different claim — `research.ts` records that one.
     *
     * EXCEPT WHERE THE RULING SAYS REFUSE. See `TEMPLATES_REFUSED_NOT_CUT`: a
     * P04 label cut on a word named a different object and was drawn.
     */
    const budget = TEMPLATE_HEADLINE_CHARS[marked.templateId] ?? 48
    const refusesACut = TEMPLATES_REFUSED_NOT_CUT.has(marked.templateId)
    let headline: string | null = null
    if (marked.headline !== null) {
      headline = refusesACut ? wholeOrRefused(marked.headline, budget) : toLastWord(marked.headline, budget)
    }
    planByBeat.set(carrier.index, {
      templateId: marked.templateId,
      headline: headline === null || headline.length === 0 ? null : headline,
      kicker: marked.kicker,
      /*
       * `lines` feed row slots, which are 48 on the one template that has them.
       * A refused-not-cut template's lines are its own arm's to bound, whole.
       */
      lines: marked.lines
        .map((line) => (refusesACut ? line.trim() : toLastWord(line, 48)))
        .filter((line) => line.length > 0),
      reason: marked.reason,
    })
    holderOf.set(carrier.index, { at: placements.length, spec, spokenIn, startMs, marked, anchorChar })
    placements.push({
      ...base,
      beatIndex: carrier.index,
      startMs,
      offsetMs: carrier.startMs - startMs,
      refusal: null,
    })
  }

  /* LAST, so the sheet's own rows keep the positions a reader already knows. */
  return seated(anchoredFraction, false)
}

/* ------------------------------------------------------------------------- */
/* The whole-video distribution review — his section 6                         */
/* ------------------------------------------------------------------------- */

/**
 * ##########################################################################
 * # NOTHING IN THE TOOL PERFORMED THIS PASS, AND ITS ABSENCE IS THE WHOLE  #
 * # OF THE CLIENT'S THIRD COMPLAINT.                                       #
 * #                                                                        #
 * # `ANIMATION_TEMPLATE_PLANNER.md` section 6, "Whole-Video Distribution   #
 * # Review", asks four questions by name. Measured off the delivered       #
 * # film's own frozen plan, all four answer badly:                         #
 * #                                                                        #
 * #   only a small number of templates account for most placements   YES   #
 * #     six distinct ids; the top three take 20 of 26                       #
 * #   one template is heavily overrepresented                        YES   #
 * #     framed-card 8, P12 7, P03 5, photo-pop 3, P19 2, gallery 1          #
 * #   the same template appears repeatedly in a short section        YES   #
 * #   other suitable templates from the library were ignored         YES   #
 * #     six of sixteen used; three ENABLED ones drew zero frames           #
 * #                                                                        #
 * # And the shape behind all four: 220.57s of the 526.53s film — 41.89% — #
 * # in three stretches carrying no animation at all, with per-minute       #
 * # counts of 9,5,2,0,4,3,2,1,0.                                            #
 * ##########################################################################
 *
 * ##########################################################################
 * # IT REPORTS. IT DOES NOT REFUSE, AND THAT IS HIS OWN INSTRUCTION.        #
 * #                                                                        #
 * # His section 1: "These timing ranges are editorial guidance, not fixed  #
 * # quotas or mandatory intervals. Do not place an animation simply        #
 * # because a certain amount of time has passed." His section 2: "If no    #
 * # animation template is appropriate for a section, do not insert one     #
 * # solely for frequency."                                                 #
 * #                                                                        #
 * # So a gate that failed on a long gap would be a gate that forces the    #
 * # exact behaviour he forbids. This returns numbers; the planner re-reads #
 * # them and re-evaluates, and the report goes in front of him. Same       #
 * # argument as T-19's copy sheet: reported, never a refusal.              #
 * ##########################################################################
 */
export type DistributionGap = {
  readonly startMs: number
  readonly endMs: number
  readonly lengthMs: number
}

export type DistributionReview = {
  readonly total: number
  readonly distinctTemplates: number
  /** Descending by count, ties breaking on the id so the report is stable. */
  readonly histogram: readonly { readonly templateId: string; readonly count: number }[]
  /** The share of placements taken by the top three ids. */
  readonly topShare: number
  readonly overConcentrated: boolean
  /** How many placements repeat the id of the placement immediately before. */
  readonly backToBackRepeats: number
  readonly gaps: readonly DistributionGap[]
  readonly longestGapMs: number
}

/**
 * TWO THIRDS. His first bullet is "only a SMALL NUMBER of templates account for
 * MOST of the animation placements", and "most" of a top-three share is the
 * threshold that makes that sentence true. The delivered film sits at 0.769,
 * which is what this number has to catch; a film spreading its top three over
 * two thirds or less is doing what he asked.
 */
export const DISTRIBUTION_TOP_SHARE_LIMIT = 2 / 3

export function reviewDistribution(input: {
  readonly placements: readonly { readonly atMs: number; readonly templateId: string }[]
  readonly filmMs: number
}): DistributionReview {
  /* Sorted by time, ties on the id, so a caller's ordering cannot move the answer. */
  const ordered = [...input.placements].sort(
    (a, b) => a.atMs - b.atMs || a.templateId.localeCompare(b.templateId),
  )

  const counts = new Map<string, number>()
  for (const placement of ordered) {
    counts.set(placement.templateId, (counts.get(placement.templateId) ?? 0) + 1)
  }
  const histogram = [...counts]
    .map(([templateId, count]) => ({ templateId, count }))
    .sort((a, b) => b.count - a.count || a.templateId.localeCompare(b.templateId))

  const total = ordered.length
  const topShare =
    total === 0
      ? 0
      : histogram.slice(0, 3).reduce((sum, row) => sum + row.count, 0) / total

  let backToBackRepeats = 0
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i]?.templateId === ordered[i - 1]?.templateId) backToBackRepeats += 1
  }

  /*
   * THE HEAD AND THE TAIL COUNT. The delivered film's single worst stretch is
   * its LAST 46 seconds, and a gap measure that only looked between placements
   * would have scored that film as ending perfectly.
   *
   * ########################################################################
   * # A PLACEMENT IS A POINT HERE, NOT A SPAN, SO EVERY GAP IS MEASURED     #
   * # FROM ONE ANIMATION'S START TO THE NEXT ONE'S START AND READS SLIGHTLY #
   * # LONG.                                                                 #
   * #                                                                      #
   * # On the delivered film that is 230.0s against 220.6s measured from     #
   * # each device's own end — about 2% of the film. The difference is a     #
   * # template's own duration, which is knowable, so this could be exact.    #
   * # It is not, on purpose: the number exists to put a stretch in front of #
   * # a human, and erring LONGER can only ever flag something that turns    #
   * # out to be fine. Erring short would hide one.                          #
   * ########################################################################
   */
  const gaps: DistributionGap[] = []
  let cursor = 0
  for (const placement of ordered) {
    if (placement.atMs > cursor) {
      gaps.push({ startMs: cursor, endMs: placement.atMs, lengthMs: placement.atMs - cursor })
    }
    cursor = Math.max(cursor, placement.atMs)
  }
  if (input.filmMs > cursor) {
    gaps.push({ startMs: cursor, endMs: input.filmMs, lengthMs: input.filmMs - cursor })
  }

  return {
    total,
    distinctTemplates: counts.size,
    histogram,
    topShare,
    /*
     * ####################################################################
     * # GUARDED ON THE PLACEMENT COUNT, NOT ON THE NUMBER OF DISTINCT     #
     * # TEMPLATES, AND THE DIFFERENCE IS THE WHOLE COMPLAINT.             #
     * #                                                                   #
     * # A film that used only three templates would pass a distinct-count #
     * # guard trivially — its top three ARE all of them — which is exactly #
     * # the film the client is objecting to. What genuinely carries no    #
     * # information is a film with three or fewer PLACEMENTS, where the   #
     * # top-three share is 1.0 by arithmetic and says nothing about the   #
     * # planner's choices.                                                 #
     * ####################################################################
     */
    overConcentrated: total > 3 && topShare > DISTRIBUTION_TOP_SHARE_LIMIT,
    backToBackRepeats,
    gaps,
    longestGapMs: gaps.reduce((longest, gap) => Math.max(longest, gap.lengthMs), 0),
  }
}
