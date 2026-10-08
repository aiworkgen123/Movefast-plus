import {
  DEVICE_IDS,
  DEVICE_REGISTRY,
  DEVICE_WEIGHTS,
  NARRATIVE_JOBS,
  P17_LABEL_MAX_CHARS_MIRROR,
  SHADOW_UP_LINE_MAX_CHARS,
  P04_MAIN_LINE_MAX_CHARS,
  P04_SUPPORT_LINE_MAX_CHARS,
  P02_HEADLINE_MAX_CHARS,
  P02_LABEL_MAX_CHARS,
  P09_LABEL_MAX_CHARS,
  P09_QUESTION_MAX_CHARS,
  P05_EYEBROW_MAX_CHARS,
  P05_HEADLINE_MAX_CHARS,
  P05_IMAGE_LABEL_MAX_CHARS,
  P05_SUPPORT_LINE_MAX_CHARS,
  SceneDeviceSchema,
  VARIETY_PENALTY,
  VARIETY_WINDOW,
  chooserMaySelect,
  drawsWords,
  isBareFourDigitYear,
  p03HeadlineFits,
} from './devices.js'
import type { DeviceId, DeviceSpec, NarrativeJob, SceneDevice } from './devices.js'
/* Barrel only, like this file. Neither is reachable from the compositor bundle. */
import { shadowUpLineFits } from './shadowUpFit.js'
/* Barrel only as well. P04's two lines, measured against Libre Franklin's own advances. */
import { p04MainLineFits, p04SupportLineFits } from './p04Fit.js'
/* Barrel only as well. P02's headline and label, measured against Libre Franklin SemiBold's own advances. */
import { p02HeadlineFits, p02LabelFits } from './p02Fit.js'
/* Barrel only as well. P09's question and section label, measured against the same face. */
import { p09LabelFits, p09QuestionFits } from './p09Fit.js'
/* Barrel only as well. P05's four lines, measured against Libre Franklin SemiBold's and Medium's own advances. */
import { p05EyebrowFits, p05HeadlineFits, p05ImageLabelFits, p05SupportLineFits } from './p05Fit.js'
/* Niku's three, 2026-09-14. Barrel-only modules, imported by path here exactly
 * as every other fit module above is — the barrel-only rule is about what
 * `apps/web/src/remotion` may reach, not about this file. */
import { chapterPlateHeadingFits } from './chapterPlateFit.js'
import { topTitleLine1Fits, topTitleLine2Fits } from './topTitleFit.js'
import {
  cornerLabelFinishesInside,
  cornerLabelKickerFits,
  cornerLabelLabelFits,
} from './cornerLabelFit.js'
import {
  bulletChecklistRowDrawsInFull,
  bulletChecklistRowFits,
  bulletChecklistTitleFits,
} from './bulletChecklistFit.js'
/*
 * Barrel-only as well, and this one holds the LEGIBILITY THRESHOLDS as well as
 * the geometry. They are here and not on the registry rows they judge for the
 * reason `index.ts` gives: `devices.ts` is in the compositor's bundle graph and
 * `deviceChoice.ts` is not, so a number moved there would cost a full
 * re-render every time somebody retuned it after looking at a frame.
 */
import {
  TYPE_GROUND_MAX_EDGE_P95,
  TYPE_GROUND_MAX_EDGE_P95_WASHED,
  TYPE_GROUND_MAX_LEVEL,
  TYPE_GROUND_MIN_CONTRAST,
  readTypeGround,
  typeGroundInkRelLum,
  typeGroundRectsFor,
  washedGrey,
} from './typeGround.js'
import type { AssetTypeGround, TypeGroundReading } from './typeGround.js'
/*
 * IMPORTED RATHER THAN COPIED, 2026-09-12. `endsMidPhrase` reads the words
 * `toLastWord` strips, from the one list both use. A leaf that imports nothing,
 * so no cycle: `visualPlan.ts` already imports `JOINING_WORDS` from here as a
 * value. See the box on `DANGLING_WORDS`.
 */
import { DANGLING_WORDS } from './danglingWords.js'
/*
 * ##########################################################################
 * # IMPORTED RATHER THAN RETYPED, 2026-09-10, AND THE REASON IS A NEAR MISS.#
 * #                                                                        #
 * # `transitionInType` and `nextTransitionInType` below used to spell the   #
 * # five transition names out by hand. That made this the ONE place in the  #
 * # repo where widening `TransitionType` was not a compile error, so the    #
 * # two lists could drift apart silently and a new transition would look    #
 * # like a device-chooser bug months later.                                 #
 * #                                                                        #
 * # ACYCLIC, CHECKED: `schemas.ts` does not import this file. That is not   #
 * # true of `devices.ts`, which is why THAT file imports zod and nothing    #
 * # else and duplicates its refusal pattern on purpose. Do not copy this    #
 * # import into `devices.ts`.                                              #
 * #                                                                        #
 * # AND IT DOES NOT MOVE `bundleHash`. The compositor bundles exactly four  #
 * # `@vg/core` subpaths, pinned in `bundleGraph.test.ts`, and this file is  #
 * # not one of them.                                                       #
 * ##########################################################################
 */
import type { TransitionType } from './schemas.js'
/*
 * TYPE-ONLY, AND THE DIRECTION IS SAFE. `visualPlan.ts` imports `devices.ts`;
 * this file imports both. Nothing under `apps/web/src/remotion` reaches either
 * this file or `visualPlan.ts`, so `bundleHash` cannot move — measured on
 * 2026-09-02 and pinned by `exclusions.test.ts`.
 */
import type { PlannedTemplate } from './visualPlan.js'

/**
 * WHICH DEVICE A BEAT WANTS, AND WHETHER IT WANTS ONE AT ALL.
 *
 * ##########################################################################
 * # THE CLIENT'S TEST, IN HIS OWN WORDS: "using it in a video and proving  #
 * # that the AI knows/understand when to implement those."                 #
 * #                                                                        #
 * # So the product of this file is not just a choice. It is a choice with  #
 * # a reason attached, and a REFUSAL with a reason attached, because a     #
 * # chooser that cannot say why it declined cannot be shown to understand  #
 * # anything. Every gate below records itself on the beat's verdict.       #
 * ##########################################################################
 *
 * IT IS PURE AND IT IS DETERMINISTIC. No clock, no randomness, no I/O, no
 * iteration over a Set built from unordered input. Two runs over the same beats
 * return the same choices, because a device reaches the compositor and is
 * therefore hashed into the segment cache key — a chooser that wobbled would
 * fork the cache between two runs that chose identically.
 */

/* ------------------------------------------------------------------------- */
/* What the chooser is given                                                   */
/* ------------------------------------------------------------------------- */

/** One narration mark, already found and already timed by the planner. */
export type BeatMark = {
  /**
   * THE SPELLING THE SCRIPT USES, not the spelling the aligner heard.
   *
   * ######################################################################
   * # THIS DISTINCTION IS THE MOST IMPORTANT LINE IN THE FILE.           #
   * #                                                                    #
   * # `scanNarrationMarks` reads the ALIGNER's word stream, which is ASR #
   * # output. Replayed over this client's own narration it yields        #
   * # "Piuch" for Emile Puech, "Eccol Biblique" for Ecole Biblique and   #
   * # "Showian Collection" for Schoyen. Those are the spellings that     #
   * # would have gone on screen, on a monetised channel, under a real    #
   * # scholar's name.                                                    #
   * #                                                                    #
   * # So the SPELLING comes from the script and the PROOF comes from the #
   * # audio: `spokenInShot` is true only when the aligner heard this     #
   * # mark's words inside this shot's own window. The script says how it #
   * # is written; the recording says it was said. Neither alone is       #
   * # enough and the caller must supply both.                            #
   * ######################################################################
   */
  text: string
  /** Which rule found it. Five detectors, and two of them are dates. */
  detector: 'manuscript' | 'eraFigure' | 'section' | 'bareYear' | 'entity'
  /** Was it heard inside this shot? A mark that was not is not usable copy. */
  spokenInShot: boolean
}

export type DeviceBeat = {
  index: number
  durationFrames: number
  /** The beat's own narration, as the SCRIPT writes it. */
  text: string
  /**
   * THE NARRATION OF THE SHOTS EITHER SIDE OF THIS ONE, INSIDE THE FILM.
   *
   * ######################################################################
   * # A 45-CHARACTER SHOT CANNOT SUPPLY A HEADLINE AND A KICKER, AND THE  #
   * # RULE THAT DEMANDED IT WAS NOT STRICT, IT WAS UNSATISFIABLE.         #
   * #                                                                    #
   * # `everyContentWordWasSpoken` used to read `text` alone. Measured on  #
   * # job 0d4dec42's own `segment.json` — the 58-shot three-minute cut —  #
   * # a shot holds a MEDIAN of 45 characters, p90 78, max 102. That is a  #
   * # median of 8 words and, once the joining words are dropped, FIVE     #
   * # distinct content words; 6 shots of the 58 carry ten and ONE carries #
   * # fourteen. P03 wants two lines with no content word in common. Over  #
   * # two real sheets, ONE of eighteen word-bearing entries inside the    #
   * # cut passed the one-shot gate.                                       #
   * #                                                                    #
   * # So the gate reads a WINDOW instead, and this is the rest of it.     #
   * # `plan.ts` fills it from `NARRATION_WINDOW_SHOTS` shots either side, #
   * # CLIPPED TO THE DELIVERED FILM at both ends — which is the safety    #
   * # property, not an edge case: "The structure is not symmetric" is a   #
   * # paraphrase of a sentence beginning 180,960ms in, after the cut      #
   * # ends, and only a window bounded by the film refuses it.             #
   * #                                                                    #
   * # THE BEAT'S OWN TEXT IS NOT REPEATED HERE. `text` already carries    #
   * # it, and a field that was sometimes one shot and sometimes five      #
   * # would hide which half a gate had read.                             #
   * ######################################################################
   *
   * ######################################################################
   * # OPTIONAL, AND ABSENT MEANS NO WINDOW RATHER THAN AN UNBOUNDED ONE.  #
   * #                                                                    #
   * # A dozen fixtures across `test-utils.ts`, `devices.test.ts`,         #
   * # `schemas.test.ts` and this package's own suites build a             #
   * # `DeviceBeat` by hand. A required field breaks every one of them,    #
   * # and a beat that never got a window must gate exactly as it did      #
   * # before this existed.                                                #
   * ######################################################################
   *
   * READ BY `everyContentWordWasSpoken` AND BY NOTHING ELSE. In particular
   * `usableMarks` does not read it: a mark arrives with `spokenInShot`, the
   * aligner's proof that THIS shot's audio contained those words, and its
   * script check is there to catch the ASR spelling "Emile Piuch" against a
   * script that says "Emile Puech". A correct spelling two shots away would
   * corroborate the misspelling here, and the misspelling is what prints.
   */
  neighbourText?: string
  /** Marks found in this shot, script-spelled. */
  marks: readonly BeatMark[]
  /**
   * THE NAMED THINGS THE SEGMENTER ITSELF PULLED OUT OF THIS BEAT.
   *
   * ######################################################################
   * # THIS IS WHAT MAKES AN ENTITY MARK USABLE, AND WITHOUT IT ALMOST    #
   * # NOTHING FIRES.                                                     #
   * #                                                                    #
   * # `entityAt` is a capitalisation-run heuristic with no notion of what #
   * # kind of thing it found — on this narration it returns "March",     #
   * # "Aramaic" and "Raphael" beside the real places. So a rule like     #
   * # "label the artifact or the cave" cannot be honoured from the mark   #
   * # alone, and the first cut of this file responded by refusing every   #
   * # entity outright and accepting only manuscript designations.         #
   * #                                                                    #
   * # Measured on the first real ten-scene plan, that left SEVEN OF TEN   #
   * # BEATS with no usable mark and the whole text half of the library    #
   * # silent — which reads on screen as one overlay treatment repeated    #
   * # for the length of the film.                                        #
   * #                                                                    #
   * # `Scene.entities` is a SECOND, INDEPENDENT judgement: the           #
   * # segmentation model listing what this beat names, and the same list  #
   * # the picture was sourced against. A mark that appears in both is    #
   * # agreed by two sources to be a named thing in this shot. That is a   #
   * # basis, not a loosening — the mark still has to be spoken here and   #
   * # still has to match the script's spelling.                          #
   * ######################################################################
   */
  sceneEntities: readonly string[]
  /**
   * AN EDITORIAL LINE WRITTEN FOR THIS BEAT, WHICH THE NARRATION DOES NOT SAY.
   *
   * ######################################################################
   * # THE CLIENT AUTHORISED THIS IN WRITING ON 2026-08-30, ANSWERING A    #
   * # QUESTION OPEN SINCE 08-24:                                          #
   * #                                                                    #
   * #   "The tool can write its own words there when needed, based on     #
   * #    the context and the paragraph. Needs to make logical sense       #
   * #    ofcourse. I believe chapter title in most occasions will be      #
   * #    AI's own words, describing the next chapter"                     #
   * #                                                                    #
   * # See T-6, T-18 and T-19 in `TREATMENT-STANDARD.md`. T-6 used to ban  #
   * # this outright and was AMENDED by that ruling; what survives of it   #
   * # is the TRUTH half, and none of those guards move.                   #
   * ######################################################################
   *
   * ######################################################################
   * # IT IS PRODUCED UPSTREAM AND ARRIVES FROZEN. NOTHING HERE WRITES IT. #
   * #                                                                    #
   * # `buildCopy` runs inside `chooseDevices`, whose determinism is what  #
   * # `computeRenderKey` rests on — this file has already refused a model #
   * # call in that position once, in writing, for a smaller feature. So   #
   * # the line is written before the plan is frozen and read here.        #
   * #                                                                    #
   * # T-18 condition 3 states the same rule from the other side.          #
   * ######################################################################
   *
   * ######################################################################
   * # `null` TODAY ON EVERY BEAT, AND THAT IS DELIBERATE.                 #
   * #                                                                    #
   * # No producer fills it yet. Every rule below that reads it is written #
   * # to do nothing at all while it is null, so this whole change cannot  #
   * # move one beat of one film until a producer lands.                   #
   * #                                                                    #
   * # THAT MATTERS MORE THAN IT LOOKS. Trap EE measured that adding a     #
   * # usable mark redistributes device budget across the WHOLE film       #
   * # through `state.used` and `state.placedAt` — a one-beat intention   #
   * # moved a different beat two hundred frames away and manufactured a  #
   * # fresh falsehood. Landing the plumbing dark means                    #
   * # the producer arrives as the only variable, with a replay to prove   #
   * # what it moved.                                                      #
   * ######################################################################
   *
   * It is a SUMMARY, never a fact. A description of what a passage is about
   * qualifies; a date, a catalogue number, a person's role or an institution's
   * name does not, because those are claims rather than characterisations and
   * they are exactly what the surviving half of T-6 refuses. T-18 condition 2.
   */
  editorialTitle: string | null
  /**
   * THE WORK THIS FILM IS ABOUT, FOR A CHAPTER CITATION THAT HAS NO PARTNER.
   *
   * ##########################################################################
   * # THE CLIENT ASKED FOR THIS TWICE AND `buildP03` NAMED THE CONDITION.    #
   * #                                                                        #
   * # His standing rule, 2026-08-27, on the frame he called perfect: "this   #
   * # text overlay is perfect always use this in a Major mention or another  #
   * # chapter of the story". His follow-up, 2026-08-28: "there's some        #
   * # inportants chapter mention in the video that doesn't have a text       #
   * # overlay again ... make sure all the important things to mention if     #
   * # cover with the text overlay like this". And on 2026-09-03, watching    #
   * # V20: use the same gold headline for ALL of the chapters.               #
   * #                                                                        #
   * # MEASURED ON V20 BEFORE ANY OF THIS WAS WRITTEN. Fourteen beats carry a #
   * # chapter citation and ONE drew P03. Three of the thirteen refusals are  #
   * # this exact case: the beat says "chapter 39 of the parables" and the    #
   * # only quotable phrase in it is the citation, so there is no second      #
   * # spoken mark to fill the kicker and `buildP03` refuses.                 #
   * #                                                                        #
   * # `buildP03`'s own note ended "that is the honest ceiling UNTIL THE      #
   * # CLIENT SUPPLIES A RULE FOR IT". He supplied one on 2026-08-30 22:37:   #
   * # "The tool can write its own words there when needed, based on the      #
   * # context and the paragraph." That is T-18, and T-18's first condition   #
   * # is that editorial copy is a FALLBACK and never a preference — which is #
   * # why this is read only after every spoken mark has been tried.          #
   * #                                                                        #
   * # IT IS NOT INVENTED AND IT IS NOT PER-BEAT. It is the dossier's own     #
   * # first `work` entity, decided once for the film, so a chapter of that   #
   * # work cannot be labelled with a work it is not part of. NULL on any     #
   * # film with no dossier, which is what keeps every earlier film's plan    #
   * # reproducible.                                                          #
   * ##########################################################################
   */
  editorialKicker: string | null
  /** Does this scene own a photograph, rather than holding its predecessor's? */
  hasOwnAsset: boolean
  /**
   * WHAT SOMETHING OTHER THAN THE SEGMENTER SAYS THIS PICTURE IS.
   *
   * The asset's own source URL — which for Commons carries the file name — plus
   * the ranker's description of what it saw. It is the only evidence on a beat
   * that is independent of the words the narration used to go looking, which is
   * exactly what a catalogue designation needs before it may be drawn. See
   * `designationIsCorroborated`.
   *
   * `null` when the scene has no picture of its own, and null NEVER
   * corroborates: a designation over an inherited or generated frame has nothing
   * behind it at all.
   */
  assetProvenance: string | null
  /**
   * Extra pictures this scene could draw, beyond its own.
   *
   * These are the scene's own runner-up candidates: already downloaded, already
   * vision-ranked, already carrying licence and attribution. Nothing new is
   * fetched to satisfy a four-picture device, which is what keeps every drawn
   * pixel inside the credits manifest.
   */
  companionCount: number
  /**
   * The LOWEST relevance score among the companions, or null when there are none.
   *
   * ##########################################################################
   * # A COMPANION IS NEVER CHECKED FOR QUALITY AND THREE DEVICES DRAW FOUR    #
   * # OF THEM AT ONCE. THIS IS THE FIELD THAT LETS A GATE SEE THAT.           #
   * #                                                                        #
   * # `source.ts` filters companions on three things: not the winner, has a   #
   * # vision record, and far enough from every picture already taken by       #
   * # phash. NOT ON SCORE. The scene's OWN picture must clear an accept gate  #
   * # to be drawn at all; its three companions clear nothing.                 #
   * #                                                                        #
   * # MEASURED over the 78 four-picture beats of job 835cd84f: only 3 have    #
   * # all four cards at score 6 or better, only 8 at 5 or better, and 44      #
   * # carry a card under 4. The worst set is [10, 3, 0, 0].                   #
   * #                                                                        #
   * # IT REACHED A DELIVERED FILM. At 2:11 of the 8m46s cut a four-panel      #
   * # mosaic draws cards the ranker itself described as "Close-up of          #
   * # bacterial sample in petri dish, completely unrelated" and "Microbiology #
   * # context with petri dishes, irrelevant to scrolls", in a documentary     #
   * # about the Book of Enoch. The model caught it and wrote it down and      #
   * # nothing read it — the same shape as the stock photograph captioned      #
   * # "British Academy" that the client answered with "Never never do this    #
   * # again".                                                                 #
   * #                                                                        #
   * # `score`, never `finalScore`. The continuity adjustments are facts about #
   * # the EDIT, not about whether the picture shows the thing.                #
   * ##########################################################################
   */
  companionScores: readonly (number | null)[]
  /**
   * The beat the mandatory opening gallery goes on, for the WHOLE FILM, or null.
   *
   * Every beat carries the same value. It is a film-level fact read per beat
   * because that is the only thing gate G13 has in scope, and comparing
   * `beat.index` against it is what replaces the bare `> 2` that stood here.
   *
   * `null` means no beat in this film can legally carry it, which refuses the
   * device everywhere rather than guessing at an illegal beat.
   */
  openingCarrierIndex: number | null
  /**
   * How many LATER pictures this beat could preview, for `pictureSource:
   * 'filmPreview'`. Zero on every beat but the carrier.
   *
   * Saku 0.3: "Reject or flag the beat if fewer than three valid images are
   * available." This is the number that check reads.
   */
  previewPictureCount: number
  /**
   * 0..1. Null when nothing looked at the picture.
   *
   * ##########################################################################
   * # IT IS THE MEASURED NUMBER NOW, WHEREVER ONE EXISTS. `plan.ts` prefers  #
   * # `ground.meanLuma` — the real pixels of the 16:9 crop the viewer sees — #
   * # over the judge's guess at the whole uncropped file, and writes the     #
   * # same number into the plan so planCheck T-7 reads what G8 decided on.   #
   * # Two numbers for one rule is how a film passes the chooser and then     #
   * # dies at the gate, and T-7 is a MUST that stops the render.             #
   * #                                                                        #
   * # THE CEILINGS ARE UNCHANGED, AND THAT IS A DECISION RATHER THAN A       #
   * # FINDING. Nine rows carry a `maxMeanLuma` and every one of them was      #
   * # calibrated against the JUDGE's whole-file guess. They now read a        #
   * # different measurement of a different rectangle — the 16:9 cover crop —  #
   * # whose distribution really does move: on the delivered film beat 0 goes  #
   * # from a judged 0.48 to a measured 0.278 and beat 22 from 0.65 to 0.490.  #
   * # Two of the nine were re-derived here (corner-label and chapter-plate,   #
   * # through their own wash). The other seven — P03, P12, P13, P14, P16,     #
   * # shadow-up and top-title — were NOT re-derived, and on this film nothing #
   * # crosses, which is measured rather than assumed: the replay moves two    #
   * # beats and neither for a ceiling reason. Re-read them on the box against #
   * # the real JPEGs before the next paid run.                                #
   * ##########################################################################
   */
  meanLuma: number | null
  /**
   * THE PICTURE'S OWN PIXELS, PROFILED BAND BY BAND. Null when nobody looked.
   *
   * Read only by G8c and G9's pixel half, both of which abstain on it. See
   * `typeGroundRefusal` for why abstaining rather than refusing is the only
   * safe answer here, and `packages/core/src/typeGround.ts` for what is in it.
   *
   * OPTIONAL AS WELL AS NULLABLE: absent means a beat built before this
   * existed, null means a picture nobody could measure, and both are the same
   * instruction to the gate. Every hand-built fixture in the repo keeps
   * compiling, which is the same argument `AssetVisionSchema.depiction` makes.
   */
  typeGround?: AssetTypeGround | null
  /**
   * The ranker's relevance score, 0..10. Null when nothing looked at the picture.
   *
   * ##########################################################################
   * # T-8. A DEVICE COULD SEE HOW BRIGHT A PICTURE IS AND NOT WHETHER IT WAS  #
   * # THE RIGHT PICTURE, AND THAT GAP REACHED A FRAME THE CLIENT PRAISED.     #
   * #                                                                        #
   * # The 2:50 cut's scene 25 is his own reference for a correct chapter      #
   * # treatment — P03 reading "CHAPTERS 102 THROUGH 104 / EPISTLE OF ENOCH".  #
   * # It is drawn over a photograph the ranker scored 4.0 and described as    #
   * # "Generic Arabic manuscript page rather than Ge'ez". Scene 9's           #
   * # framed-card names "Book of Enoch" over a 4.1 the ranker called          #
   * # "Wide shot of a large crowd at a cemetery service".                     #
   * #                                                                        #
   * # `OVERLAY_MIN_PICTURE_SCORE` in plan.ts already refused exactly this for #
   * # the NATIVE overlay, which is why the failure survived: devices build    #
   * # their own copy and never passed through that guard. Two doors, one      #
   * # rule, and only one of them was locked.                                  #
   * #                                                                        #
   * # Found by `scripts/harness/planCheck.ts` on its first run, against a     #
   * # film that had already shipped and already been reviewed.                #
   * ##########################################################################
   */
  visionScore: number | null
  /** Does the photograph already have words burned into it? */
  hasBakedText: boolean
  shotScale: 'wide' | 'medium' | 'closeup' | null
  subjectAnchor: { x: number; y: number } | null
  transitionInType: TransitionType
  /** The FOLLOWING beat's transition, if there is one. */
  nextTransitionInType: TransitionType | null
  /**
   * Does the NEXT beat draw THIS beat's photograph, having none of its own?
   *
   * ######################################################################
   * # A HELD FOLLOWER IS THE SUBTLE ONE AND IT IS NOT A TRANSITION BUG.  #
   * #                                                                    #
   * # A held scene draws its predecessor's photograph raw and full-bleed #
   * # for its whole duration, framed by a camera cursor the predecessor  #
   * # left behind. A device scene draws its OWN composition instead, so  #
   * # the audience never saw that crop or that pose — and then the next  #
   * # shot opens on it, mid-move, for seconds. Nulling the crossfade     #
   * # does not help: this is not an 8-frame blend, it is the whole next  #
   * # shot.                                                              #
   * ######################################################################
   *
   * ######################################################################
   * # IT USED TO ASK "IS THE NEXT SCENE HELD", WHICH IS A DIFFERENT AND  #
   * # STRICTLY WIDER QUESTION, AND THE FIVE-SECOND PACING RULE IS WHAT   #
   * # MADE THE DIFFERENCE BITE.                                          #
   * #                                                                    #
   * # A held scene does NOT always draw its immediate predecessor's      #
   * # picture. `holdPicture` re-frames onto a DIFFERENT photograph from  #
   * # history the moment the current run would pass                      #
   * # `MAX_PICTURE_RUN_FRAMES`, and at 150 frames that fires constantly  #
   * # on a film cut every three seconds. When it does, the device's own  #
   * # composition is inherited by NOTHING and the hazard above cannot    #
   * # occur.                                                             #
   * #                                                                    #
   * # MEASURED ON V20, on the five beats this gate refused a gold        #
   * # headline: 27, 33, 42, 127 and 151. In ALL FIVE the following scene #
   * # draws a different photograph. The gate was refusing five of the    #
   * # client's own chapter mentions to prevent something that was not    #
   * # going to happen on any of them.                                    #
   * #                                                                    #
   * # THIS IS A NARROWING, NOT A LOOSENING. Where the follower really    #
   * # does inherit this picture the gate still refuses, and              #
   * # `deviceChoice.test.ts` pins both directions.                       #
   * ######################################################################
   */
  nextHoldsThisPicture: boolean
  /** Does this beat already carry a mark the planner placed and budgeted? */
  hasOverlay: boolean
  /**
   * WHAT THE VISUAL PLANNER DECIDED THIS MOMENT IS FOR, OR NULL.
   *
   * ######################################################################
   * # THE ONE THING THIS FUNCTION COULD NEVER WORK OUT ON ITS OWN.        #
   * #                                                                    #
   * # `chooseDevices` sees one beat, its neighbour and some film-wide     #
   * # counters. It cannot know what the next hundred seconds contain and  #
   * # it cannot know what a sentence is FOR, so it falls back to whatever #
   * # the beat's own marks happen to fit — which on one narration is the  #
   * # same three templates from end to end. That is the defect the client #
   * # reported: "I still saw the exact same 2-3 animations up until 5     #
   * # minute mark ... Most of the library still seems unused."            #
   * #                                                                    #
   * # PRODUCED UPSTREAM AND FROZEN, WHICH IS T-18 CONDITION 3 IN AS MANY  #
   * # WORDS: "It is generated upstream and frozen into the plan. Never    #
   * # inside `chooseDevices`. That function's determinism is what         #
   * # `computeRenderKey` rests on." `visualPlanForBeats` is a pure        #
   * # function of the frozen sheet, the script and this film's own scene  #
   * # starts, so nothing here becomes non-deterministic.                  #
   * #                                                                    #
   * # IT PROPOSES. EVERY GATE STILL DISPOSES. A sheet cannot waive G1's   #
   * # `enabled`, the picture count, the per-film cap or the wrong-person  #
   * # strip, and `deviceChoice.visualPlan.test.ts` pins each of those.    #
   * #                                                                    #
   * # NULL ON EVERY BEAT OF EVERY FILM PLANNED BEFORE THIS EXISTED, which #
   * # is what keeps those plans reproducible.                             #
   * ######################################################################
   */
  plannedTemplate: PlannedTemplate | null
}

/* ------------------------------------------------------------------------- */
/* What the chooser returns                                                    */
/* ------------------------------------------------------------------------- */

/** Why a device was not available on a beat. One phrase, kept for the report. */
export type RefusalCode =
  | 'not-enabled'
  | 'no-own-picture'
  | 'not-enough-pictures'
  | 'beat-too-short'
  | 'beat-too-long'
  | 'next-scene-holds-this-picture'
  | 'picture-too-bright'
  | 'picture-too-dark'
  | 'picture-has-baked-text'
  /**
   * G8c. THE RECTANGLE THE LETTERS LAND ON CANNOT HOLD THEM.
   *
   * A fact about the photograph, exactly like `picture-too-bright`, and a
   * SEPARATE code from it because the two say different things to a reader. A
   * beat refused `picture-too-bright` has a pale picture; a beat refused this
   * one may have a perfectly ordinary picture with a white sky in the corner
   * the words go, or a page of printed rows behind them. The delivered film's
   * own ALLEGHENY frame is the case in point: 0.48 whole-frame, well inside
   * the ceiling, and three letters at 1.11:1.
   */
  | 'type-ground-too-weak'
  | 'no-subject-anchor'
  /**
   * TEMPLATE 05's LINE WOULD SIT ON THE SUBJECT. See G14b.
   *
   * His manifest and both of his handoffs say not to cover an important subject
   * at the bottom centre, which is exactly where 05 sets its line. A fact about
   * the photograph, like `picture-too-bright`, so it is a missing input.
   */
  | 'subject-under-the-line'
  /**
   * P04's LABEL WOULD SIT ON THE SUBJECT. See G14c.
   *
   * The pack's own rule 8 is "Keep important faces, document writing, maps, and
   * the feature being discussed visible and readable", and P04 sets its label at
   * the lower left. A fact about the photograph, like `subject-under-the-line`,
   * so it is a missing input.
   */
  | 'subject-under-the-label'
  /**
   * P02's CARD WOULD SIT ON THE SUBJECT. See G14d.
   *
   * The pack's own rule 8 keeps the feature being discussed visible, and P02
   * slides an opaque paper card over the left half of the frame. A fact about the
   * photograph, like `subject-under-the-label`, so it is a missing input.
   *
   * P09's compact question card returns it too, from G14e: the same fact about
   * the picture, a different card.
   */
  | 'subject-under-the-card'
  /**
   * P05's SQUARE PANEL WOULD CROP THE SUBJECT AWAY. See G14f.
   *
   * P05 draws the picture at cover inside a 746 px square, so a 16:9 picture
   * loses 44 percent of its width, 22 percent off each side. A subject centred in
   * either side is not on screen at all. A fact about the photograph, like
   * `subject-under-the-card`, so it is a missing input.
   */
  | 'subject-outside-the-panel'
  | 'per-film-cap-reached'
  | 'variety-cooldown'
  | 'wrong-position-in-film'
  /**
   * THE BEAT SPEAKS A DATE, SO IT IS A YEAR TEMPLATE'S. See gate G15.
   *
   * Not a variant of `outscored`: the score did not decide it, a written rule
   * did, and the report has to be able to say which.
   *
   * IT WAS `date-beat-belongs-to-P12` UNTIL P14 LANDED, and the rename is not
   * cosmetic. There are two year treatments now and the planner chooses between
   * them, so a refusal line saying the beat belongs to P12 would be false on
   * every beat P14 actually drew — and this string is read by a person in a
   * refusal report, which is the only place it is ever read.
   */
  | 'date-beat-belongs-to-a-year-template'
  /**
   * P14's DIGITS WOULD SIT ON THE SUBJECT. See G14g.
   *
   * The pack's own rule 8 is "Keep important faces, document writing, maps, and
   * the feature being discussed visible and readable", and P14 sets four 132 px
   * digit wheels in the TOP RIGHT corner. A fact about the photograph, like
   * `subject-under-the-card`, so it is a missing input.
   */
  | 'subject-under-the-year'
  /**
   * THE BEAT SPEAKS A SECTION AND SOMETHING HERE CAN PRINT WORDS. See G16.
   *
   * Like `date-beat-belongs-to-a-year-template` and for the same reason: the score did not
   * decide it, `T-4` did, and a report that called this `outscored` would say
   * the opposite of what happened.
   */
  | 'section-mention-needs-words'
  /**
   * G18, T-18 condition 1. A written heading stood down because the beat's own
   * SPOKEN words could be printed on it, and the narration outranks our prose.
   *
   * A policy refusal like its neighbours: every input was present and a written
   * rule decided it, so reporting this as `outscored` would say the opposite of
   * what happened.
   */
  | 'spoken-mark-outranks-written'
  /**
   * T-8. The copy would have NAMED the picture, and the ranker called the
   * picture generic. Distinct from `copy-not-available`, because the copy was
   * available and correct — it was the PHOTOGRAPH that could not carry it.
   */
  | 'picture-too-generic-to-name'
  /**
   * A FOUR-PICTURE DEVICE WOULD DRAW A PICTURE TOO WEAK TO BE SHOWN ALONE.
   *
   * Distinct from `picture-too-generic-to-name`, which is about NAMING the
   * scene's own photograph. This one names no picture at all — it is about the
   * three COMPANIONS, which nothing has ever quality-checked, and it fires on
   * devices that draw no words. See `companionScores`.
   */
  | 'companion-picture-too-weak'
  /**
   * THE BEAT IS THE OPENING GALLERY'S, BY THE AUTHOR'S OWN RULE. See G17.
   *
   * Like `date-beat-belongs-to-a-year-template` and `section-mention-needs-words`: the score
   * did not decide it, a written rule did, and a report calling this `outscored`
   * would say the opposite of what happened.
   */
  | 'opening-belongs-to-A8'
  | 'copy-not-available'
  | 'wrong-narrative-job'
  | 'outscored'

export type BeatVerdict = {
  index: number
  /** The device chosen, or null when this beat stays an ordinary shot. */
  chosen: SceneDevice | null
  /**
   * THE DEVICE THIS BEAT ACTUALLY WANTED, when `chosen` is a substitute for it.
   *
   * ######################################################################
   * # NULL FOR EVERY ORDINARY CHOICE, AND IT IS THE ONLY WAY TO TELL THE #
   * # TWO APART FROM OUTSIDE. A fallback and a winner both arrive here as #
   * # a `chosen` device, but they mean different things: one is "this is   #
   * # the right treatment for this beat", the other is "the right         #
   * # treatment could not be drawn and this is the author's registered    #
   * # substitute". A report that could not distinguish them would hide     #
   * # exactly the beats a human should look at — which is the second half  #
   * # of his rule 3, "or mark the beat for review".                        #
   * ######################################################################
   */
  fallbackFrom: DeviceId | null
  /** Why, in the chooser's own words. Written for a human to read. */
  reason: string
  /** Every device considered, with its score or the gate that refused it. */
  considered: readonly {
    id: DeviceId
    score: number | null
    refusal: RefusalCode | null
  }[]
}

export type DeviceChoice = {
  /** Scene index -> the device that scene becomes. */
  devices: ReadonlyMap<number, SceneDevice>
  /** One verdict per beat, in scene order. The evidence, not a side effect. */
  verdicts: readonly BeatVerdict[]
}

/* ------------------------------------------------------------------------- */
/* Copy, and the rules that keep it honest                                     */
/* ------------------------------------------------------------------------- */

/**
 * The project's own token normaliser, matching `verifyToken` in the planner.
 *
 * Everything outside `[a-z0-9]` is stripped, which is deliberately more than the
 * dev harness strips. On this narration the difference is live: "Ge'ez",
 * "King's" and "Enoch's" all carry apostrophes a five-character punctuation
 * class leaves in place, so a highlight word would be refused against a headline
 * that plainly contains it.
 */
function normaliseToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/*
 * EXPORTED FOR THE OPENING-TITLE BUILDER IN `visualPlan.ts`, 2026-09-21, AND
 * NOTHING ELSE MOVED. That builder cuts P03's two lines out of the opening
 * shot's narration, and every line it proposes has to be judged by the SAME
 * normaliser this file will judge it with a moment later — otherwise the builder
 * would be answering a slightly different question from the gate that decides
 * whether its answer draws. Same argument as the `DANGLING_WORDS` box above:
 * imported rather than copied, so the two readers cannot drift.
 */
export function contentTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map(normaliseToken)
    .filter((token) => token.length > 0)
}

/**
 * Is `word` a WHOLE word of `sentence`, rather than a substring of one?
 *
 * "not" is a whole word of "not metaphor" and is NOT a whole word of "nothing".
 * A substring match here draws a highlight rectangle across half a word, which
 * is precisely the defect the partner's own template notes call out by name.
 */
export function isWholeWordOf(word: string, sentence: string): boolean {
  const target = normaliseToken(word)
  if (target.length === 0) return false
  return contentTokens(sentence).includes(target)
}

/**
 * Marks this beat can legally draw: script-spelled AND heard in this shot.
 *
 * ##########################################################################
 * # EVERY WORD OF THE MARK, NOT JUST ITS FIRST.                            #
 * #                                                                        #
 * # Checking only the first token passes "Emile Piuch" against a script    #
 * # that says "Emile Puech" — the given name matches, the SURNAME is the   #
 * # aligner's guess, and the wrong spelling of a real scholar's name goes  #
 * # on screen under his photograph. The whole mark has to be in the script #
 * # or none of it is usable.                                              #
 * ##########################################################################
 */
/**
 * Letters and digits only, folded to lower case, so a catalogue designation can
 * be looked for inside a URL, a filename or a sentence without the punctuation
 * getting in the way. "4Q204" and "File:4Q204_Enoch-c.jpg" both reduce to a form
 * where one contains the other.
 */
function alphanumeric(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * A CATALOGUE DESIGNATION IS A CLAIM ABOUT *THIS* OBJECT, AND THE SCORE NEVER
 * CHECKED IT.
 *
 * ##########################################################################
 * # THE FRAME THAT PRODUCED THIS RULE, IN A DELIVERED FILM. Job 99414763    #
 * # scene 63, narration "the Aramaic construction used for the name         #
 * # preservation clause in 4Q204". P17 drew a leader line into the picture  #
 * # and labelled the point "4Q204".                                        #
 * #                                                                        #
 * # THE PICTURE WAS A MESOPOTAMIAN CLAY TABLET. Its Commons file is         #
 * # `Cuneiform_tablet-_fragment_of_a_contract`, and the ranker's OWN words  #
 * # were "Authentic ancient cuneiform tablet fragment match visual intent". #
 * # It scored 6.8.                                                         #
 * #                                                                        #
 * # SO T-8 PASSED, AND T-8 WAS ANSWERING A DIFFERENT QUESTION. The ranker   #
 * # scores a picture against the beat's VISUAL INTENT — "an ancient         #
 * # inscribed fragment" — which a Babylonian contract tablet satisfies      #
 * # perfectly. Nothing anywhere asked whether it is THE NAMED OBJECT. Every #
 * # automated rule in this repo passed that frame: real photograph, correct #
 * # licence, dark enough, no baked text, a subject anchor, score above the  #
 * # naming bar. Only a person looking at it could see the falsehood.        #
 * #                                                                        #
 * # This is the same mechanism as the Enoch Powell photograph captioned     #
 * # "Enoch" and the Qur'an page captioned "1 Enoch 39", both of which are   #
 * # still in the film the client holds.                                    #
 * ##########################################################################
 *
 * WHY ONLY THIS DETECTOR. A designation like "4Q204" or "11Q5" is a precise
 * claim that THIS artefact is that catalogue entry, and nothing about a generic
 * ancient object supports it. A section name ("Book of Enoch") is a claim about
 * what the narration is discussing and a caption under a papyrus is fair; a year
 * belongs to the narration rather than to the photograph. Those are argued where
 * they are read. This rule is the narrowest one that removes the falsehood.
 *
 * ##########################################################################
 * # IT SITS IN `usableMarks` RATHER THAN IN P17, DELIBERATELY.              #
 * #                                                                        #
 * # P17 refusing would hand the beat down its own fallback chain to         #
 * # `framed-card`, which would caption the SAME tablet "4Q204" in smaller   #
 * # type. The claim is a property of the WORDS, not of the furniture, so    #
 * # the filter belongs where words become available to every device.        #
 * ##########################################################################
 *
 * WHAT COUNTS AS CORROBORATION. The picture's own provenance — the source URL,
 * which for Commons carries the file name. NOT the ranker's description; see
 * `archiveEvidence` below for the frame that cost.
 *
 * OVER-REFUSING IS THE SAFE DIRECTION HERE and under-refusing is not. A refused
 * designation costs a title; an accepted wrong one puts a falsehood on a
 * monetised channel under a pointer.
 */
const DESIGNATION_DETECTOR: BeatMark['detector'] = 'manuscript'

/**
 * THE DESIGNATION IS THE DIGIT-BEARING TOKEN, NOT THE PHRASE AROUND IT.
 *
 * ##########################################################################
 * # MATCHING THE WHOLE MARK IS THE OBVIOUS IMPLEMENTATION AND IT IS WRONG.  #
 * # "4Q208 fragment" never appears as a contiguous run in a Commons file    #
 * # name, so a whole-string test refuses a picture that genuinely IS the    #
 * # object — caught by three existing tests going red rather than by        #
 * # reading. The catalogue number is the part that makes the claim;         #
 * # "fragment", "scroll" and "page" are generic and corroborate nothing.    #
 * #                                                                        #
 * # A MARK WITH NO DIGITS IS NOT A CATALOGUE DESIGNATION and this rule does #
 * # not apply to it. There is no number to be wrong about, and refusing on  #
 * # a bare word would silently take the `manuscript` detector's whole       #
 * # non-numbered output out of the film.                                    #
 * ##########################################################################
 */
/**
 * THE HALF OF THE PROVENANCE THE RANKER DID NOT WRITE.
 *
 * ##########################################################################
 * # A DISCLAIMER SPELLS THE DESIGNATION WHILE DENYING IT, AND A SUBSTRING   #
 * # TEST CANNOT TELL THE TWO APART. THIS SHIPPED TWICE.                     #
 * #                                                                        #
 * # `plan.ts` builds provenance as `sourceUrl + ' ' + vision.reason`. The   #
 * # URL is the ARCHIVE's own name for the object. The reason is free text a #
 * # model wrote about it.                                                   #
 * #                                                                        #
 * # Job 99414763 scene 63 drew a leader line into a Mesopotamian clay       #
 * # contract tablet and labelled the point "4Q204" — an Aramaic LEATHER     #
 * # manuscript from Qumran cave 4. The gate passed it because the ranker's  #
 * # own sentence reads "...though 4Q204 is a Dead Sea Scroll manuscript     #
 * # fragment." The one sentence in the provenance saying the picture is NOT #
 * # the object was the only thing saying it WAS.                            #
 * #                                                                        #
 * # READING THE SENTENCE FOR NEGATION IS NOT THE FIX — that is trap FF. A   #
 * # reword carrying the same meaning ("though it is not the Qumran          #
 * # manuscript") never spells the token at all, so any prose rule is one    #
 * # sentence deep. The free-text half is dropped from the haystack instead. #
 * #                                                                        #
 * # Everything up to the first whitespace is the URL `plan.ts` joined on,   #
 * # and it is the only field on the beat the ranker cannot write.           #
 * #                                                                        #
 * # THIS IS STRICTLY MORE REFUSING. A picture that genuinely IS a catalogue #
 * # object, whose archive file name happens not to spell the designation,   #
 * # now loses its title. That is the safe direction: a refused designation  #
 * # costs a caption, an accepted wrong one puts a falsehood on screen.      #
 * ##########################################################################
 */
function archiveEvidence(provenance: string): string {
  const [url] = provenance.split(/\s/, 1)
  return url ?? ''
}

export function designationIsCorroborated(mark: string, provenance: string | null): boolean {
  const numbered = mark.split(/\s+/).filter((token) => /\d/.test(token))
  /* Nothing numeric to verify, so nothing for this rule to refuse. */
  if (numbered.length === 0) return true
  if (provenance === null) return false
  const haystack = alphanumeric(archiveEvidence(provenance))
  /* EVERY number must check out. One right and one wrong is still a falsehood. */
  return numbered.every((token) => {
    const needle = alphanumeric(token)
    return needle.length > 0 && haystack.includes(needle)
  })
}

/**
 * THE ARCHIVE'S OWN FILE NAME, BROKEN INTO WORDS.
 *
 * `alphanumeric` folds a URL to one unbroken run of letters, which is right for
 * a catalogue number and wrong for a word: "research" contains "sea", so a
 * substring test would let a paper about research corroborate "Dead Sea
 * Scrolls". Splitting on every non-alphanumeric run gives whole words to
 * compare against instead.
 */
function archiveWords(provenance: string): ReadonlySet<string> {
  return new Set(
    archiveEvidence(provenance)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0),
  )
}

/**
 * MAY THIS CAPTION NAME THIS PICTURE?
 *
 * ##########################################################################
 * # THE SAME RULE AS `designationIsCorroborated`, FOR THE CASE IT GAVE UP   #
 * # ON. That function returns TRUE on its first line for any mark with no   #
 * # digits, and its box says so deliberately: refusing a bare word "would   #
 * # silently take the `manuscript` detector's whole non-numbered output out #
 * # of the film".                                                           #
 * #                                                                        #
 * # THAT OUTPUT WAS THEN MEASURED. Job 2629eec5 drew four captions and      #
 * # three of them named something the picture does not show:                #
 * #                                                                        #
 * #   0:43  "Dead Sea Scrolls"     over the Qumran canyon                   #
 * #   1:25  "Book of the Watchers" over an Ethiopian GOSPEL OF LUKE leaf    #
 * #   1:43  "Epistle of Enoch"     over Chester Beatty XII   <- correct     #
 * #   1:59  "Enoch"                over a stock photo of sunlight           #
 * #                                                                        #
 * # The client watched the first and asked whether it was a Dead Sea        #
 * # Scroll. The second is the serious one: a false claim about a real,      #
 * # accessioned museum object.                                              #
 * #                                                                        #
 * # SO THE COST WAS REAL AND THE VALUE WAS NOT. Deleting that output        #
 * # removes three falsehoods and one correct caption, and the trade is the  #
 * # one `archiveEvidence` already states: "a refused designation costs a    #
 * # caption, an accepted wrong one puts a falsehood on screen."             #
 * #                                                                        #
 * # EVERY WORD, NOT ANY. `some` reads better and is wrong: a photograph of  #
 * # the Dead Sea itself, `File:Dead_Sea_aerial.jpg`, corroborates "Dead Sea #
 * # Scrolls" on two words of three. That is the frame this whole line of    #
 * # work started from.                                                      #
 * #                                                                        #
 * # JOINING WORDS ARE DROPPED because "of" and "the" carry no identity and  #
 * # requiring them would refuse every multi-word name outright.             #
 * #                                                                        #
 * # THE URL ONLY, via `archiveEvidence`, for the reason argued at length    #
 * # there: the rest of the provenance is prose the ranker wrote, and a      #
 * # sentence that spells a name while DENYING it reads identically to one   #
 * # that confirms it.                                                       #
 * ##########################################################################
 */
export function nameIsCorroborated(mark: string, provenance: string | null): boolean {
  const words = contentTokens(mark).filter((token) => !JOINING_WORDS.has(token))
  /* Nothing with identity in it, so nothing for this rule to refuse. */
  if (words.length === 0) return true
  if (provenance === null) return false
  const evidence = archiveWords(provenance)
  return words.every((word) => evidence.has(word))
}

function usableMarks(beat: DeviceBeat): BeatMark[] {
  const scripted = new Set(contentTokens(beat.text))
  return beat.marks.filter((mark) => {
    if (!mark.spokenInShot) return false
    /*
     * The corroboration gate. See the box above — it runs before the script
     * check rather than after only because it is cheaper, and both must pass.
     */
    if (
      mark.detector === DESIGNATION_DETECTOR &&
      !designationIsCorroborated(mark.text, beat.assetProvenance)
    ) {
      return false
    }
    const tokens = contentTokens(mark.text)
    return tokens.length > 0 && tokens.every((token) => scripted.has(token))
  })
}

const DATE_DETECTORS: ReadonlySet<BeatMark['detector']> = new Set(['bareYear', 'eraFigure'])

/**
 * Words that carry no identity, so two entities sharing one are not the same
 * thing. Closed, short, and read by `distinctThings`, `nameIsCorroborated`,
 * `everyContentWordWasSpoken`, `firstContentWordOf`,
 * `kickerRepeatsTheHeadline` and `endsMidPhrase` below.
 */
export const JOINING_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'and', 'in', 'at', 'on', 'for', 'to', 'from', 'by', 'with',
])

/**
 * DID THE NARRATOR SAY THESE WORDS AROUND THIS SHOT?
 *
 * ##########################################################################
 * # THE CHECK THE WRITTEN-PAIR ARM NEVER MADE, AND IT PUT A SENTENCE       #
 * # NOBODY SPEAKS ON THE CLOSING FRAME OF THE FILM.                        #
 * #                                                                        #
 * # Scene 57 of the three-minute cut, 2:55.6 to 2:59.9, drew kicker "NOT   #
 * # SOULS DRIFTING" over headline "A STRUCTURE THAT BREAKS". "break"       #
 * # occurs ZERO times in the 8,742-character script and "drift" ZERO times #
 * # — the script says "floating". The sheet was paraphrasing a passage     #
 * # that starts at 180,960ms, over a second AFTER that cut ends, and the   #
 * # line it paraphrased is "the structure is not symmetric". So it is not  #
 * # a quotation, it is not in this shot, and it is not even a faithful     #
 * # paraphrase of the passage it drifted to.                               #
 * #                                                                        #
 * # THE SPOKEN ARM ABOVE HAS ALWAYS HAD THIS RULE. `usableMarks` folds     #
 * # `beat.text` — the beat's own narration as the SCRIPT writes it — into  #
 * # a token set and refuses any mark not spelled there. This is the same   #
 * # source and the same tokeniser, applied to the words the planner wrote  #
 * # instead of to the words the aligner heard.                             #
 * #                                                                        #
 * # PER CONTENT WORD, NOT AS A SUBSTRING. The whole point of the fallback  #
 * # is that the planner may REWORD the shot when nothing in it is          #
 * # quotable; a substring test would refuse every reordering and empty the #
 * # single largest recovery in the sheet. Requiring each word to have been #
 * # said keeps the rewording and removes the invention.                    #
 * #                                                                        #
 * # JOINING WORDS ARE EXEMPT, for the reason `nameIsCorroborated` gives:   #
 * # "of" and "the" carry no identity, and a headline may legitimately need #
 * # an article the narration's own phrasing did not use.                   #
 * #                                                                        #
 * # NOTHING BUT JOINING WORDS IS NOT REFUSED HERE. There is no claim in    #
 * # it to be wrong about, and `firstContentWordOf` refuses that headline   #
 * # on its own account one gate later.                                     #
 * ##########################################################################
 *
 * ##########################################################################
 * # AND IT READS A WINDOW RATHER THAN THE ONE SHOT, BECAUSE THE ONE-SHOT   #
 * # VERSION OF THIS RULE COULD NOT BE SATISFIED BY ANYTHING.               #
 * #                                                                        #
 * # EVERY NUMBER HERE WAS RUN AGAINST JOB 0d4dec42's OWN ARTIFACTS — its   #
 * # `segment.json` (58 shots), its `align.json` (1,400 words), and the two #
 * # visual-plan sheets, seated with `scriptTokens` and                     #
 * # `anchorScriptToWords` from `sections.ts`, which is the code the worker #
 * # really uses.                                                            #
 * #                                                                        #
 * # WHAT A SHOT ACTUALLY HOLDS on this film: median 45 characters, p90 78, #
 * # max 102. Median 8 words. Median FIVE distinct content words once the   #
 * # joining words are dropped, minimum 2, maximum 14 — and only 6 of the   #
 * # 58 shots reach ten. The visual-planner prompt had been told a shot      #
 * # speaks 87 characters at the median and 209 at the longest, numbers      #
 * # measured off a DIFFERENT and twice-longer segmentation, so the sheet    #
 * # was written to quote from a window twice as wide as the one this rule   #
 * # allowed.                                                                #
 * #                                                                        #
 * # WHAT THAT COST, MEASURED RATHER THAN ESTIMATED. Nine word-bearing sheet #
 * # entries land inside the delivered cut in each of the two sheets. Under  #
 * # the one-shot rule: 1 of 9 passed on the old sheet and 0 of 9 on the new #
 * # one. Six of those eighteen entries are P03, and 0 of the 6 passed. A   #
 * # rule that a correctly-briefed model still cannot satisfy is not a       #
 * # strict rule, it is a broken one.                                        #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE WIDTH IS TWO SHOTS EITHER SIDE, AND THE DATA CHOSE IT.              #
 * #                                                                        #
 * #   radius  shots  distinct content words  seconds either side  new sheet #
 * #     0       1     median 5,  min 2       0.0                  0 of 9    #
 * #     1       3     median 16, min 12      median 2.8, max 5.0  2 of 9    #
 * #     2       5     median 27, min 19      median 5.5, max 9.5  6 of 9    #
 * #     3       7     median 38, min 25      median 8.6, max 12.9 9 of 9    #
 * #                                                                        #
 * # Radius 1 admits 2 of the 9 and refuses the v6 checklist that the tests  #
 * # below draw, on one row of three whose words are spoken two shots away.  #
 * # Radius 3 admits every entry on the sheet, which is a gate that has      #
 * # stopped discriminating, and it reaches copy from 12.9 seconds away.     #
 * # Radius 2 is the smallest that carries the sheet's real entries.         #
 * #                                                                        #
 * # WHAT RADIUS 2 DOES NOT FIX, SAID PLAINLY RATHER THAN ROUNDED AWAY.      #
 * #                                                                        #
 * # Split by template, over all 18 word-bearing entries in the two sheets:  #
 * #                                                                        #
 * #                    entries  r=0  r=1  r=2  r=3                          #
 * #   framed-card         6      1    3    5    5   (not gated by this rule)#
 * #   P03                 6      0    0    0    2                           #
 * #   bullet-checklist    4      0    0    1    3                           #
 * #   two-photo-zoom      2      0    0    1    1                           #
 * #                                                                        #
 * # So across the twelve entries this rule actually gates, radius 2 moves 0 #
 * # to 2 and radius 3 would move it to 6. That is the honest size of the    #
 * # win, and it is smaller than the whole-sheet figure suggests.            #
 * #                                                                        #
 * # THE REST IS NOT A GATE PROBLEM. Four of the six P03 entries quote words #
 * # the film never says at any width. The other two, and most of the        #
 * # remainder, were written against a prompt that had been told a shot      #
 * # speaks 87 characters at the median and 209 at the longest — numbers     #
 * # measured off a different, twice-longer segmentation, when this film's   #
 * # own shots are 45 and 102. Copy written to a span twice as wide as the   #
 * # film lands one to three shots downstream of the frame it belongs to,    #
 * # and no widening HERE corrects a sheet written to the wrong span. The    #
 * # gate is satisfiable now — the tests build a P03 pair out of this film's #
 * # own shots 44 and 46 — and the remaining fix is the prompt's numbers.    #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE TRADE, WHICH IS REAL AND IS NOT THE ONE THE GATE WAS BUILT FOR.     #
 * #                                                                        #
 * # WHAT IT COSTS: a viewer may read a line a moment before or after        #
 * # hearing it. The window is counted in SHOTS, and this film's shortest is #
 * # 1.76s, so at radius 2 that moment is a median of 5.5 seconds and at     #
 * # worst 9.5. The line is something the film says in that breath. It is    #
 * # not necessarily something it is saying while the frame is on screen.    #
 * #                                                                        #
 * # WHAT IT DOES NOT COST: either falsehood this rule was written for.      #
 * # "A STRUCTURE THAT BREAKS" over "NOT SOULS DRIFTING" uses words the      #
 * # SCRIPT never contains — "break" 0 times in 8,742 characters, "drift" 0  #
 * # times — so no window of any width admits it, and the replay confirms 0  #
 * # of 58 shots do at radius 0, 1, 2, 3, 4, 8 and 60. "The structure is not #
 * # symmetric" uses a word the script HAS and the delivered 58 shots never  #
 * # say, and a window bounded by the FILM refuses it where a window bounded #
 * # by the script would not. Both are pinned in                             #
 * # `deviceChoice.visualPlan.test.ts`.                                      #
 * #                                                                        #
 * # THE WINDOW IS THE CALLER'S, NOT THIS FILE'S. `plan.ts` builds it from   #
 * # the delivered drafts and clips it at both ends; this file only unions   #
 * # the two token sets, so nothing here can widen it past the film.         #
 * ##########################################################################
 */
function everyContentWordWasSpoken(copy: string, beat: DeviceBeat): boolean {
  /*
   * ONE TOKEN SET OVER BOTH, and the beat's own shot is always in it. An
   * absent window contributes nothing, which is what keeps a beat built by
   * hand — every fixture in `test-utils.ts` and every film planned before
   * this landed — gated on its own shot exactly as it was.
   */
  const spoken = new Set([
    ...contentTokens(beat.text),
    ...contentTokens(beat.neighbourText ?? ''),
  ])
  /*
   * ########################################################################
   * # A HYPHENATED COPY WORD IS HEARD WHOLE OR AS ITS PARTS, AND ONLY THE   #
   * # PLANNER'S COPY IS EVER SPLIT. His note 3 on V50, 2026-09-11.          #
   * #                                                                       #
   * # `normaliseToken` strips the hyphen, so the planner's "Pre-exilic"     #
   * # became the one token "preexilic", while beat 69, inside the window    #
   * # of V50's beat 70, says "pre exilic". The sheet quoted the narrator    #
   * # and was refused for it. Over V50's beats and three real planner       #
   * # sheets, 8 hyphenated words sat in seated asks: 6 were spoken as their #
   * # parts, none whole, and 2, "twenty-two" and "thirty-nine", neither way.#
   * #                                                                       #
   * # WHOLE FIRST, EXACTLY AS BEFORE, so copy that passed still passes and  #
   * # a narration that hyphenates the same word still matches it. Only a    #
   * # hyphenated word whose whole form was not spoken is read as its parts, #
   * # and then EVERY part that is not a joining word must be spoken, which  #
   * # is the rule the copy would meet had the planner typed a space.        #
   * #                                                                       #
   * # ONLY A COMPOUND WITH AN ORDINARY WORD IN IT SPLITS, 2026-09-12. An   #
   * # ordinary word holds a letter, holds no digit, and is neither a       #
   * # number word nor a joining word. "Second-Temple", "First-born" and    #
   * # "Seven-headed" each hold one, so each splits, and then every piece   #
   * # that is not a joining word must be spoken, the number included.      #
   * # "Chapters 6-11", "The 6th-8th centuries", "Twenty-two chambers",     #
   * # "Chapters six-eleven" and "6-to-11" hold none, so each is one        #
   * # number, heard whole or not at all. Split, "Twenty-two" passed under  #
   * # "Twenty years later ... two chambers", which says two other numbers. #
   * # "Of-the" holds none either, so it is not waved through with nothing  #
   * # in it checked. An empty piece, left by a trailing hyphen, is never   #
   * # spoken and refuses. All of it came from review.                      #
   * #                                                                       #
   * # THE NARRATION IS NEVER SPLIT. Its "pre-exilic" stays "preexilic", so  #
   * # copy reading "Exilic temple", the opposite period, is still refused.  #
   * #                                                                       #
   * # THE PARTS, NOT THE WHOLE TOKEN, GO TO `narrationDeniesIt`. It looks   #
   * # the first word up in each clause, and "preexilic" is never found in   #
   * # a clause that says "pre exilic", so a "not" before it would go unread.#
   * #                                                                       #
   * # AND NOWHERE ELSE, `contentTokens` INCLUDED. Every other reader of it  #
   * # wants a word as the script spells it or the template prints it: the   #
   * # highlight box, the name check, which aligner marks count as spoken,   #
   * # the count and contrast readers, the denial check, the named-thing     #
   * # count and the P03 overlap tests. Split there, "twenty-two chambers"   #
   * # would read as a count of two.                                         #
   * ########################################################################
   */
  const words: string[] = []
  for (const written of copy.split(/\s+/)) {
    const whole = normaliseToken(written)
    if (whole.length === 0 || JOINING_WORDS.has(whole)) continue
    if (spoken.has(whole)) {
      words.push(whole)
      continue
    }
    /* The ASCII hyphen-minus and the two Unicode hyphens, U+2010 and U+2011. */
    const pieces = written.split(/[-‐‑]/u).map(normaliseToken)
    if (pieces.length < 2) return false
    /*
     * A COMPOUND SPLITS ONLY WHEN AN ORDINARY WORD IS IN IT. "Second-Temple"
     * holds "temple", so it is heard in "Second Temple Jewish literature".
     * "Twenty-two", "6-11", "6th-8th" and "6-to-11" hold none, so each stays
     * the one token a narration would have to say whole, and "Of-the" holds
     * none either. Once it splits, every piece that is not a joining word must
     * be spoken, the number piece included, and an empty piece never is,
     * because `contentTokens` drops empty tokens. The box above says why.
     */
    if (!pieces.some(isAnOrdinaryWord)) return false
    const parts = pieces.filter((piece) => !JOINING_WORDS.has(piece))
    if (!parts.every((part) => spoken.has(part))) return false
    words.push(...parts)
  }
  return !narrationDeniesIt(words, beat)
}

/**
 * NUMBERS WRITTEN AS WORDS, cardinal and ordinal. Read by `isAnOrdinaryWord`
 * alone, so a compound made of nothing but numbers, and joining words between
 * them, never splits. "Twenty-two" is one number and "second-third" is a range,
 * and neither is the separate words it is spelt with. A compound with an
 * ordinary word in it does split, so "Second-Temple", "First-born" and
 * "Seven-headed" are heard in a narration that says their pieces, and so are
 * "one-sided", "first-hand" and "second-hand", which 7d7dac3 had stopped
 * splitting.
 *
 * THE NARRATION WRITES ITS NUMBERS IN DIGITS, AND THIS BOX USED TO SAY THE
 * OPPOSITE. The client's script file spells "twenty-two" and "thirty-nine"
 * with hyphens, and the planner reads that file. The chooser does not.
 * `DeviceBeat.text` and `neighbourText` come from segment.json, and on job
 * 3e185245 its 164 beats hold no hyphen at all and write every number in
 * digits, "chapter 22" and "Chapters 102 through 104". So copy that writes a
 * number in words, as final-v14's kicker "Chapter twenty-two" does, is heard
 * neither whole nor split, and is refused. That is a gap in what the chooser
 * can hear, and nothing here closes it. Copy that writes the digits matches.
 *
 * THE TRADES. A narration that wrote "twenty two" with no hyphen would not
 * match "Twenty-two", because the split that matched it is the split that let
 * "twenty years ... two chambers" through. A Roman-numeral range, "Chapters
 * VI-XI", still splits, because "vi" and "xi" read as ordinary words, and this
 * script has none. And a compound that holds a word as well as two numbers,
 * "twenty-two-headed", splits into its numbers too.
 */
/* Exported for the opening-title builder's cut guard. See `contentTokens`. */
export const NUMBER_WORDS: ReadonlySet<string> = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand', 'million', 'billion',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
  'eighteenth', 'nineteenth', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth',
  'seventieth', 'eightieth', 'ninetieth', 'hundredth', 'thousandth', 'millionth', 'billionth',
])

/**
 * Is this piece of a hyphenated copy word an ORDINARY word, one whose presence
 * lets the compound split? It holds a letter, holds no digit, and is neither a
 * number word nor a joining word.
 */
function isAnOrdinaryWord(piece: string): boolean {
  return (
    /[a-z]/.test(piece) && !/[0-9]/.test(piece) && !NUMBER_WORDS.has(piece) && !JOINING_WORDS.has(piece)
  )
}

/**
 * Words that turn the clause after them into a denial.
 *
 * Closed and short on purpose. Every member reverses the claim of the clause it
 * opens, which is the only property this rule needs; a hedge like "rarely" or
 * "hardly" weakens a claim without reversing it and is deliberately absent.
 */
const NEGATORS: ReadonlySet<string> = new Set([
  'not',
  'never',
  'no',
  'nothing',
  'neither',
  'nor',
  'without',
  'nobody',
])

/**
 * A SMALL NUMBER IN FRONT OF A PLURAL NOUN, WHICH IS A CLAIM ABOUT HOW MANY
 * THINGS THE SHOT IS TALKING ABOUT.
 *
 * ##########################################################################
 * # THE STANDARD SAID "THREE NAMED THINGS" AND THE SCRIPT SAID "THREE".     #
 * #                                                                        #
 * # `connected_three_source_evidence` is the job the red string board       #
 * # declares, and `narrativeJobsOf` already derived it — from three         #
 * # DISTINCT NAMED marks, or three entities plus four photographs. Both     #
 * # routes count NAMES.                                                     #
 * #                                                                        #
 * # The client's own example names nothing. Scene 24 of job c75d51e6 says   #
 * # "the afterlife are distributed across three sections of the book        #
 * # Enoch", and scene 46 says "when these three sections are read           #
 * # together". A counted plural, not a list of names, so neither route      #
 * # fired and the board was never even a candidate on the two shots the     #
 * # film is most obviously about.                                           #
 * #                                                                        #
 * # V22 drew the board at 0:51 because THAT shot happened to name three     #
 * # things. It was luck, not recognition, and this is the rule that makes   #
 * # it recognition.                                                          #
 * ##########################################################################
 */
const COUNTED_PLURALS: ReadonlyMap<string, 2 | 3 | 4> = new Map([
  ['both', 2],
  ['two', 2],
  ['2', 2],
  ['three', 3],
  ['3', 3],
  ['four', 4],
  ['4', 4],
])

/**
 * Plurals that count TIME rather than things. "Three centuries" is a span, and
 * a span belongs to the date devices, which have their own rule above.
 */
const TIME_PLURALS: ReadonlySet<string> = new Set([
  'years',
  'decades',
  'centuries',
  'millennia',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'times',
  'ages',
])

/**
 * Words that make the number a CITATION rather than a count of things.
 * "Chapters one through 36" and "verses two to four" are references.
 */
const CITATION_WORDS: ReadonlySet<string> = new Set([
  'chapter',
  'chapters',
  'verse',
  'verses',
  'line',
  'lines',
  'page',
  'pages',
  'column',
  'columns',
  'fragment',
  'fragments',
])

/**
 * WORDS THAT SET ONE THING AGAINST ANOTHER.
 *
 * ##########################################################################
 * # `comparison` IS ONE OF FOUR JOBS NOTHING DERIVED COULD EVER EMIT, AND   #
 * # IT IS THE ONLY ONE OF THE FOUR WHOSE DEVICE IS SWITCHED ON.             #
 * #                                                                        #
 * # two-photo-zoom declares it, and until this rule the ONLY way the job    #
 * # reached a beat was the planner's seated template appended at the bottom #
 * # of `narrativeJobsOf`. That made every compare shot in the film depend   #
 * # on one model call going well, which is why the count swung from 3 to 0  #
 * # to 3 across three consecutive sheets on the same script.                #
 * #                                                                        #
 * # THIS RULE PLACES NOTHING, AND SAYING SO IS THE POINT.                   #
 * #                                                                        #
 * # Measured through the real seater and the real chooser over job          #
 * # 3e185245's frozen inputs, adding it moves the film not at all:          #
 * # two-photo-zoom draws 3 with it and 3 without, and the whole tally is    #
 * # unchanged at 30. The reason is the copy arm below — a compare shot's    #
 * # two labels come ONLY from `plannerWords`, which refuses unless the      #
 * # planner named this exact template on this exact beat, and such an ask   #
 * # already supplies the job itself. So the derived job can never be the    #
 * # thing that unlocks a placement.                                         #
 * #                                                                        #
 * # WHAT IT IS FOR is making the MOMENT visible. A shot whose own words     #
 * # say "not sleeping. They are paying attention" is a comparison whether   #
 * # or not anyone asked for one, and the standards report can only say      #
 * # "this was a comparison and no compare shot was asked for" if something  #
 * # marked it. Without this, a missed comparison is indistinguishable from  #
 * # a beat that never wanted one, which is exactly how the client's own     #
 * # examples went unnoticed for three films.                                #
 * #                                                                        #
 * # DO NOT "FIX" THIS BY GIVING THE COPY ARM A MARK-PAIR FALLBACK. Each     #
 * # label is mounted on its OWN photograph, so a mark pair asserts that     #
 * # picture A IS the first named thing. That is the class of defect that    #
 * # put a leader line on a page naming something not in it.                 #
 * ##########################################################################
 */
const CONTRAST_TOKENS: ReadonlySet<string> = new Set([
  'unlike',
  'whereas',
  'versus',
  'contrast',
  'contrasts',
  'conversely',
  'opposed',
])

/** The multi-word forms, which a token set cannot see. */
const CONTRAST_PHRASES: readonly string[] = [
  'rather than',
  'instead of',
  'as opposed to',
  'on the other hand',
  'on the one hand',
  'before and after',
  'compared with',
  'compared to',
  'the difference between',
  'while others',
  'not the same as',
]

/**
 * IS THIS SHOT SETTING TWO THINGS AGAINST EACH OTHER, IN ITS OWN WORDS?
 *
 * Two shapes, and the second is the one this script actually uses.
 *
 * ##########################################################################
 * # THE DENY-THEN-ASSERT SHAPE IS THE COMMON ONE AND IT HAS NO KEYWORD.     #
 * #                                                                        #
 * # The delivered script writes its comparisons like this:                  #
 * #                                                                        #
 * #   "The righteous dead are not sleeping. They are paying attention."     #
 * #   "They are not gazing at nothing. They are beholding something."       #
 * #                                                                        #
 * # A negated clause, then a clause that asserts the other side. No word    #
 * # in `CONTRAST_TOKENS` appears in either. A keyword list alone would      #
 * # find none of them, which is why this second shape exists.               #
 * #                                                                        #
 * # THE ASSERTING CLAUSE IS REQUIRED. "The question is not the one most     #
 * # people are hoping for" is a denial with no second side stated, and a    #
 * # split frame there would invent the half the narration withheld.         #
 * ##########################################################################
 */
function narrationComparesThings(text: string): boolean {
  const clauses = text.split(/[.;?!]/u).filter((clause) => contentTokens(clause).length > 0)

  for (const clause of clauses) {
    const tokens = contentTokens(clause)
    const joined = tokens.join(' ')
    if (tokens.some((token) => CONTRAST_TOKENS.has(token))) return true
    if (CONTRAST_PHRASES.some((phrase) => joined.includes(phrase))) return true
  }

  /* Deny, then assert: a negated clause followed by one that states the other side. */
  for (let at = 0; at < clauses.length - 1; at += 1) {
    const here = contentTokens(clauses[at] ?? '')
    const next = contentTokens(clauses[at + 1] ?? '')
    if (!here.some((token) => NEGATORS.has(token))) continue
    if (next.length < 2) continue
    if (next.some((token) => NEGATORS.has(token))) continue
    return true
  }

  return false
}

/**
 * HOW MANY THINGS IS THIS SHOT HOLDING UP, IN ITS OWN WORDS?
 *
 * Returns 2, 3 or 4 when the narration counts that many of something, and null
 * otherwise. Clause-scoped and denial-guarded for the reason `narrationDeniesIt`
 * is: "not three sections" is the narration REFUSING the count, and a board of
 * three cards there would assert the opposite of the sentence.
 *
 * The noun may sit up to three words after the number, because "three
 * independent manuscript traditions" is the same claim as "three traditions".
 */
function countedThingsIn(text: string): 2 | 3 | 4 | null {
  for (const clause of text.split(/[,.;:?!]/u)) {
    const tokens = contentTokens(clause)
    for (let at = 0; at < tokens.length; at += 1) {
      const token = tokens[at]
      if (token === undefined) continue
      const count = COUNTED_PLURALS.get(token)
      if (count === undefined) continue

      /* "not three sections" is a denial, and a denial is not a count. */
      if (tokens.slice(0, at).some((word) => NEGATORS.has(word))) continue

      /* "chapters three and four" is a reference, not three things. */
      const before = at === 0 ? null : (tokens[at - 1] ?? null)
      if (before !== null && CITATION_WORDS.has(before)) continue

      for (let ahead = at + 1; ahead <= at + 3 && ahead < tokens.length; ahead += 1) {
        const noun = tokens[ahead]
        if (noun === undefined) continue
        if (CITATION_WORDS.has(noun)) break
        if (TIME_PLURALS.has(noun)) break
        /* Four letters and an s, so `is`, `as`, `its` and `has` cannot qualify. */
        if (noun.length > 3 && noun.endsWith('s')) return count
      }
    }
  }
  return null
}

/**
 * DOES THE NARRATION SAY THESE WORDS IN ORDER TO DENY THEM?
 *
 * ##########################################################################
 * # THE GATE ABOVE IS A SET MEMBERSHIP TEST, SO A "NOT" IS INVISIBLE TO IT #
 * # AND A LABEL QUOTING WHAT THE FILM DENIES PASSES IT PERFECTLY.          #
 * #                                                                        #
 * # CAUGHT IN REVIEW RATHER THAN ON SCREEN, which is a first on this       #
 * # project. Job 3e185245 beat 143 would have drawn a `two-photo-zoom`     #
 * # whose left chip reads "Gazing at nothing" under the sentence "They are #
 * # NOT gazing at nothing. They are beholding something specific." The     #
 * # chip sits beneath its own photograph, so it is an assertion about that #
 * # picture, and it asserts the reverse of the narration. Beat 55 carries   #
 * # the same shape behind "not a description of".                          #
 * #                                                                        #
 * # THE COPY'S OWN NEGATION IS FINE AND MUST STAY. "Not sleeping" over     #
 * # "The righteous dead are not sleeping" is faithful, so the search runs  #
 * # only over the words BEFORE the copy's first word — the copy's own      #
 * # negator is never in that stretch, and a copy that opens on one is not  #
 * # examined at all.                                                       #
 * #                                                                        #
 * # CLAUSE-SCOPED, AND THAT IS MEASURED RATHER THAN CHOSEN. An adjacent    #
 * # two-word lookback catches beat 143 and MISSES beat 55, whose negator   #
 * # is four words back. Both rules refuse ZERO of the 23 devices the       #
 * # delivered film draws, so the wider one costs nothing and catches one   #
 * # more falsehood. Splitting on clause punctuation is what stops it       #
 * # reaching backwards past a sentence boundary into an unrelated denial.  #
 * #                                                                        #
 * # IT READS THE SAME WINDOW THE GATE ABOVE DOES. A phrase the gate found  #
 * # in a neighbouring shot is judged against that shot's own clause, which #
 * # is where it was said.                                                  #
 * ##########################################################################
 */
function narrationDeniesIt(words: readonly string[], beat: DeviceBeat): boolean {
  const opening = words[0]
  /* Nothing to deny, or the copy carries the denial itself. */
  if (opening === undefined || NEGATORS.has(opening)) return false
  for (const narration of [beat.text, beat.neighbourText ?? '']) {
    for (const clause of narration.split(/[,.;:—–?!]/u)) {
      const tokens = contentTokens(clause)
      const at = tokens.indexOf(opening)
      if (at === -1) continue
      if (tokens.slice(0, at).some((token) => NEGATORS.has(token))) return true
    }
  }
  return false
}

/**
 * THE FIRST WORD OF A HEADLINE WORTH DRAWING A GOLD BOX ROUND, OR NULL.
 *
 * ##########################################################################
 * # THE HIGHLIGHT USED TO BE THE FIRST TOKEN, WHATEVER IT WAS, AND ON THE  #
 * # CLOSING FRAME THAT BOXED THE INDEFINITE ARTICLE "A".                   #
 * #                                                                        #
 * # A one-letter emphasis rectangle does not read as emphasis. It reads as #
 * # a render glitch, which is the same class of complaint as the stray     #
 * # leader-line mark beside P17's plate: invisible to every test and       #
 * # plainly wrong in the delivered frame.                                  #
 * #                                                                        #
 * # AND IT REFUSES RATHER THAN FALLING BACK. A headline made only of       #
 * # joining words has nothing in it to emphasise, so there is no better    #
 * # box to draw — the file's own trade applies and a refused device costs  #
 * # a caption where a drawn one puts a glitch on screen.                   #
 * #                                                                        #
 * # `isWholeWordOf` is re-checked here for the reason the spoken arm gives #
 * # it: the box is drawn against what the template ACTUALLY prints, and a  #
 * # word the normaliser folds away is not a word the renderer can find.    #
 * ##########################################################################
 */
function firstContentWordOf(headline: string): string | null {
  const written = headline.split(/\s+/).filter((word) => word.length > 0)
  return (
    written.find((word) => {
      const token = normaliseToken(word)
      return token.length > 0 && !JOINING_WORDS.has(token) && isWholeWordOf(word, headline)
    }) ?? null
  )
}

/**
 * DOES THE KICKER PRINT A WORD THE HEADLINE ALREADY PRINTS?
 *
 * ##########################################################################
 * # THE TWO P03 BLOCKS SIT ONE ABOVE THE OTHER, so a word in both is        #
 * # printed twice on one frame. "Jerusalem" did that on a real render. The  #
 * # planner's written pair and the T-18 editorial fallback both refuse it   #
 * # here, through one rule, so the two cannot drift apart.                  #
 * #                                                                         #
 * # A JOINING WORD IN BOTH IS NOT A REPEAT. His note 3 on V50, 2026-09-11.  #
 * # Replayed on V50's beats over three real planner sheets, 13 seated P03   #
 * # pairs shared a word and 10 of them shared only "the" or "a". "Book of   #
 * # the Watchers" over "The four holding chambers" (V50's sheet, beat 27)   #
 * # prints no claim twice. The other three shared "written" or "already",   #
 * # and are still refused.                                                  #
 * #                                                                         #
 * # THE SET IS `JOINING_WORDS`, NOT A LONGER STOPWORD LIST. It is this      #
 * # file's own list of words that carry no identity, and it already decides #
 * # which words of this same copy the narration need not have said, in      #
 * # `everyContentWordWasSpoken`, so the two rules agree on what a content   #
 * # word is. It holds no negator, number, pronoun or verb, so "not" in both #
 * # lines is still a repeat, and so is "It is written" over "Not going to   #
 * # be written". The package's two other lists answer other questions and   #
 * # would be wrong here: `DANGLING_WORDS` in `visualPlan.ts` holds "not",   #
 * # "is" and "was", and the aligner's `KEYTERM_STOPWORDS` holds "Not",      #
 * # "One" and "Three".                                                      #
 * #                                                                         #
 * # P03 NOW HAS TWO OVERLAP RULES, AND THIS IS THE LOOSE ONE. The spoken    #
 * # kicker search in `buildP03` keeps the strict one: a mark that shares    #
 * # ANY token with the headline, a joining word included, cannot be the     #
 * # kicker. AND THAT SEARCH DOES REFUSE. When no mark passes it,            #
 * # `marks.find` comes back empty, and unless the headline is a section     #
 * # mark, which goes on to the T-18 fallback, `buildP03` returns null for   #
 * # that highlight. The loop then tries the next highlight and, after the   #
 * # last, the planner's written pair, which answers to this loose rule.     #
 * # THE STRICT ONE WAS LEFT ALONE ON PURPOSE. Loosening it too, measured    #
 * # in a scratch copy of the chooser, moved no beat on the three sheets.    #
 * ##########################################################################
 */
/* Exported for the opening-title builder. See `contentTokens`. */
export function kickerRepeatsTheHeadline(kicker: string, headline: string): boolean {
  const printed = new Set(contentTokens(headline))
  return contentTokens(kicker).some((token) => !JOINING_WORDS.has(token) && printed.has(token))
}

/**
 * Words that point forward at a noun, so a line that stops on one is missing
 * the thing it was about to name. Read by `endsMidPhrase` alone. "my", "such"
 * and "another" joined on 2026-09-12, after "A word for my" drew.
 */
const WORDS_THAT_NEED_A_NOUN: ReadonlySet<string> = new Set([
  'every', 'each', 'any', 'all', 'some', 'no', 'both', 'either', 'neither', 'my', 'such', 'another',
])

/**
 * Words that open a clause and cannot close one, so a line that stops on one
 * never says the clause it started. Read by `endsMidPhrase` alone. NOT added to
 * `DANGLING_WORDS`, because `toLastWord` reads that list too and would start
 * stripping these off the trimmed headlines and rows of every template, which
 * nothing here measured.
 *
 * SIX LEFT ON 2026-09-12, so, yet, where, when, who and which, because each can
 * end a whole sentence, as in "He said so", "Not yet" and "No one knows where",
 * and on the list they refused those. The trade is a line cut after one of
 * them, such as "The souls of those who" out of "The souls of those who
 * remember", which now draws. A sheet planned from now on never makes that cut,
 * because the worker keeps the kicker whole and the 24-character bound refuses
 * the overrun, but a stored sheet could hold one. No line on the three real
 * sheets ends on any of the six. "whether", "although" and "unless" joined the
 * same day, since none of them ends a sentence.
 */
const WORDS_THAT_OPEN_A_CLAUSE: ReadonlySet<string> = new Set([
  'whose', 'whom', 'while', 'if', 'because', 'nor', 'whether', 'although', 'unless',
])

/**
 * Words that point at a thing they govern, a preposition's object or the other
 * side of "than", so a line that stops on one is missing it. Read by
 * `endsMidPhrase` alone, and kept out of `DANGLING_WORDS` for the reason the
 * clause words are. Added 2026-09-12, after "Knowledge passed between" drew.
 * "than" is on `DANGLING_WORDS` too, and is here as well so the chooser keeps
 * refusing it whatever `toLastWord`'s list becomes.
 *
 * "within" IS LEFT OUT, ON MEASUREMENT. All three real planner sheets ask P03
 * on beat 131 or 132, near 6:52, for a headline that ends on it, "Radiant from
 * within" and two variants, and all three draw. It is the narrator's own
 * "radiant from within,", the only place the script ends a phrase on any word
 * added that day. On this list it would take one drawn text off every sheet.
 */
const WORDS_THAT_NEED_AN_OBJECT: ReadonlySet<string> = new Set([
  'about', 'between', 'through', 'upon', 'among', 'during', 'without', 'despite',
  'toward', 'towards', 'beneath', 'beyond', 'than',
])

/**
 * DOES THIS P03 LINE STOP MID-PHRASE?
 *
 * ##########################################################################
 * # A KICKER ENDING ON "every" IS SAWN OFF, AND ONLY A PICTURE GATE WAS    #
 * # STOPPING ONE. Review of v52/pushcut-copycheck, 2026-09-12.             #
 * #                                                                        #
 * # Job-v9's sheet asks P03 on beat 9 with the kicker "The question every" #
 * # over "Do the dead remember us". On main the shared "the" refused it.   #
 * # Once `kickerRepeatsTheHeadline` let a joining word be shared, the pair #
 * # passed every copy check here and was refused only because its picture  #
 * # scored too low to be named. On a better picture it would have drawn.   #
 * #                                                                        #
 * # AND A FIXED LIST OF OUR OWN WAS NARROWER THAN THE DEFECT. The second   #
 * # review, same day. Job-v9's P03 on beat 114, at 6:00.2, still drew "Not #
 * # sleep or" over "The word for wakefulness", because "or" was on the     #
 * # package's own dangling-word list and not on this one.                  #
 * #                                                                        #
 * # WHERE A SAWN-OFF LINE COMES FROM. The worker's `normaliseSheet` cut    #
 * # the kicker to 24 characters on a word, so "Not sleep or                #
 * # unconsciousness" came out as "Not sleep or". It now keeps the kicker   #
 * # whole up to 48, so an overrun reaches the 24-character check in the    #
 * # written arm and is refused there, but every sheet already stored still #
 * # holds the cut ones. `visualPlanForBeats` passes the kicker through     #
 * # untouched. `toLastWord` trims the headline to its template's budget    #
 * # and every row of `lines` to 48, and strips a dangling word only from a #
 * # line it had to trim itself. It never sees the kicker, and a headline   #
 * # the worker cut to 48 arrives inside P03's own budget of 64, so it is   #
 * # not trimmed again and nothing is stripped from it.                     #
 * #                                                                        #
 * # THE LIST IS FIVE SETS. `JOINING_WORDS`. `DANGLING_WORDS`, the          #
 * # package's own list, imported from `danglingWords.ts` so the two        #
 * # readers cannot drift, which adds "or", "but", "than", "that", "their", #
 * # "is" and "not" among others. And the chooser's own three just above,   #
 * # twelve words that need a noun after them, nine that open a clause and  #
 * # thirteen that need an object.                                          #
 * #                                                                        #
 * # THE TRADE, SAID PLAINLY. Some of these can close a real phrase, as in  #
 * # "not at all", "the answer is no", "they found her", "remember this"    #
 * # and "or not", and this refuses those too. The script ends six phrases  #
 * # on a listed word, "at all", "hoping for", "pass over", "with this",    #
 * # "is this" and "you were", and no seated line on the three real sheets  #
 * # ends on one of them. Words that end real phrases often were taken off  #
 * # or kept off on the third review, 2026-09-12. So, yet, where, when, who #
 * # and which left the clause words. "within" stayed off, because all      #
 * # three sheets draw "Radiant from within". The chooser's own lists take  #
 * # no helping verb, because "who we are" is whole, though                 #
 * # `DANGLING_WORDS` holds eight, "is" and "were" among them. On V50's     #
 * # beats over three real sheets the seated P03 lines these refuse are     #
 * # job-v9's kickers on b9 and b114. The "at all" and "you were" lines are #
 * # comparison labels and checklist rows. It reads those since 2026-09-12. #
 * # A refused line costs a caption. A sawn-off one costs the frame.        #
 * #                                                                        #
 * # WHERE IT RUNS: every line the planner writes, see below, and the T-18  #
 * # editorial kicker, which is the dossier's work name, cut by nothing of  #
 * # ours below 120 characters and checked by nothing for how it ends. NOT  #
 * # THE EDITORIAL HEADLINE, a section mark, which always ends on its       #
 * # number. NOT THE SPOKEN SEARCH, whose marks are names, dates and        #
 * # citations. The worker's `entityAt` already drops a trailing "of",      #
 * # "the" or "and", and takes a lower-case word into a name only when it   #
 * # is a name particle.                                                    #
 * ##########################################################################
 *
 * EVERY PLANNER LINE NOW ASKS `writtenLineStopsMidPhrase`, 2026-09-12, which
 * is this rule with one ending excused, a whole clause the narrator ends on a
 * preposition, opened by a question word that stands for the thing, where the
 * same stretch of his holds the rest, such as the V52 sheet's "Not what people
 * are hoping for". That is both lines of P03's written pair, the 05 line, the
 * framed-card caption, both comparison labels, and the checklist's title and
 * rows. The T-18 editorial kicker still asks this rule as it stands.
 *
 * THE TRADE ON THE FOUR TEMPLATES THAT JOINED, SAID PLAINLY. The script's own
 * "at all" and "you were" end real phrases, and the planner has written both
 * onto comparison labels and checklist rows, "Not everyone remembers at all"
 * and "Lose everything you were" among them. They are refused now. The whole
 * phrases these checks now refuse on the 05 line, the framed-card caption,
 * both comparison labels and the checklist include "Their memory lives on",
 * "They were never heard from", "Lose everything you were" and "Not everyone
 * at all". A line that ends on a preposition and opens on no question word is
 * refused on every template, and `writtenLineStopsMidPhrase` names the whole
 * phrases that costs.
 */
/* Exported for the opening-title builder. See `contentTokens`. */
export function endsMidPhrase(line: string): boolean {
  const tokens = contentTokens(line)
  const last = tokens[tokens.length - 1]
  if (last === undefined) return false
  return (
    JOINING_WORDS.has(last) ||
    DANGLING_WORDS.has(last) ||
    WORDS_THAT_NEED_A_NOUN.has(last) ||
    WORDS_THAT_OPEN_A_CLAUSE.has(last) ||
    WORDS_THAT_NEED_AN_OBJECT.has(last)
  )
}

/**
 * Prepositions a whole clause can end on, once the thing each points at has
 * moved to the front, as in "what they asked for", "who they spoke to" and
 * "what they went through". Read by `writtenLineStopsMidPhrase` alone.
 *
 * NOT EVERY PREPOSITION ON THE LISTS ABOVE. The rest of
 * `WORDS_THAT_NEED_AN_OBJECT` stays out, "between" among them, because it
 * joined that list after "Knowledge passed between" drew and no real sheet
 * ends a whole clause on it. "as", "onto" and "under" stay out because a
 * clause almost never ends on them. Articles, conjunctions, determiners and
 * helping verbs are not prepositions and are never excused.
 */
const PREPOSITIONS_A_CLAUSE_CAN_END_ON: ReadonlySet<string> = new Set([
  'about', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'over', 'through', 'to', 'upon',
  'with', 'without',
])

/**
 * Question words that can stand at the front of a clause for the thing a
 * preposition at its end points back to, as "what" does in "what people are
 * hoping for". Read by `aQuestionWordHoldsTheLine` alone.
 *
 * FIVE SINCE 2026-09-12. "which", "whom" and "whichever" left, because a line
 * that opens on one is almost always a relative clause cut away from the noun
 * it belongs to, as "Which the souls are kept in" is cut from "the chamber
 * which the souls are kept in". "that" was never here, because it is as often
 * a pointing word, as in "that book", as a clause's first word.
 *
 * AND THE FIVE THAT STAYED DO THE SAME THING, which is what the fourth review
 * found the same day. "Where the souls are kept in" is cut from "the chamber
 * where the souls are kept in" exactly as "Which the souls are kept in" was.
 * Shortening this list is not what stops those, because these same five open
 * b21's line and every other real object question.
 * `theQuestionWordHangsOffAHeadNoun` reads the narrator's own words in front
 * of the question word instead.
 */
const WORDS_A_LAST_PREPOSITION_POINTS_BACK_TO: ReadonlySet<string> = new Set([
  'what', 'who', 'where', 'whatever', 'whoever',
])

/**
 * Words that make a question word the one DOING the thing rather than the
 * thing it is done to. In "who are waiting for", "who" is the one waiting, so
 * "for" is left with nothing to point back to. Read by
 * `aQuestionWordHoldsTheLine` alone.
 */
const HELPING_VERBS: ReadonlySet<string> = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'will', 'would',
  'can', 'could', 'do', 'does', 'did', 'shall', 'should', 'may', 'might', 'must',
])

/** Does `said` hold every word of `wanted`, in order, with other words allowed between? */
function readsInOrder(wanted: readonly string[], said: readonly string[]): boolean {
  let next = 0
  for (const token of said) if (token === wanted[next]) next += 1
  return next === wanted.length
}

/**
 * DOES A QUESTION WORD AT THE FRONT STAND FOR THE THING? The one excuse
 * `writtenLineStopsMidPhrase` makes. Until 2026-09-12 it was rule (b) of two,
 * and rule (a), the narrator's own clause, head and all, is gone. See that
 * function for why and for what it costs.
 *
 * `line` and `said` are tokens, and `said` already ends on the line's last two
 * words. The verifier's tested version, `tmp/v52/verify-probe/rule-probe2.mts`.
 * All four must hold.
 *   1. The line opens, after an optional "not", on a question word. See
 *      `WORDS_A_LAST_PREPOSITION_POINTS_BACK_TO`.
 *   2. No helping verb follows it. See `HELPING_VERBS`.
 *   3. At least two words stand between it and the preposition, room for who
 *      does it and what they do. "What leads to" has one and "What for" none.
 *   4. The words after it are in `said`, in order. The question word itself
 *      need not be, so the V52 sheet's "Not what people are hoping for" is
 *      read against the narrator's "not the one most people are hoping for".
 *
 * IT IS NOT THE WHOLE EXCUSE SINCE THE FOURTH REVIEW, 2026-09-12. Point 4 lets
 * the question word be absent from `said`, which is exactly what b21 needs,
 * and nothing here ever looked at what stands in front of it when it IS there.
 * `writtenLineStopsMidPhrase` asks `theQuestionWordHangsOffAHeadNoun` after
 * this one, and a line this excuses is still refused when that answers yes.
 */
function aQuestionWordHoldsTheLine(line: readonly string[], said: readonly string[]): boolean {
  const opens = line[0] === 'not' ? 1 : 0
  const question = line[opens]
  if (question === undefined || !WORDS_A_LAST_PREPOSITION_POINTS_BACK_TO.has(question)) return false
  const rest = line.slice(opens + 1)
  const next = rest[0]
  if (next === undefined || HELPING_VERBS.has(next)) return false
  if (rest.length < 3) return false
  return readsInOrder(rest.slice(0, -2), said.slice(0, -2))
}

/**
 * Words that open a noun phrase, so what follows one is a thing being named
 * rather than something being done. Read by
 * `theQuestionWordHangsOffAHeadNoun` alone.
 *
 * SIXTEEN, AND THEY ARE THE POINTING WORDS, NOT THE COUNTING ONES. "every" and
 * "each" are here and on `WORDS_THAT_NEED_A_NOUN`, which answers a different
 * question about the END of a line. "some", "any", "no", "both" and "either"
 * are left out: "Enoch saw some chamber where" does not name a thing he has
 * already put on screen, and no measured shape uses one.
 */
const DETERMINERS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'his', 'her', 'its', 'their', 'our', 'my',
  'your', 'every', 'each',
])

/**
 * Words that name nothing of their own, so a word that is on none of these
 * lists is a content word: a thing, or something being done. Read by
 * `theQuestionWordHangsOffAHeadNoun` alone, and built out of the sets this file
 * already keeps so the two readers cannot drift apart.
 */
const WORDS_THAT_NAME_NOTHING: ReadonlySet<string> = new Set([
  ...HELPING_VERBS,
  ...PREPOSITIONS_A_CLAUSE_CAN_END_ON,
  ...DETERMINERS,
  'not', 'and', 'but', 'or',
])

/**
 * IS THE NARRATOR HANGING THIS QUESTION WORD OFF A HEAD NOUN? The guard on the
 * one excuse. `writtenLineStopsMidPhrase` refuses a line this answers yes for,
 * even where `aQuestionWordHoldsTheLine` excused it.
 *
 * ##########################################################################
 * # THE FOURTH REVIEW, 2026-09-12, AND THE HOLE WAS ON THE OTHER SIDE OF   #
 * # THE QUESTION WORD. The excuse asked what the line says after it and    #
 * # never what the narrator says BEFORE it. So a relative clause hanging   #
 * # off a head noun read as a question word standing for the thing, when   #
 * # the thing is the head noun the line cut off: "the chamber WHERE the    #
 * # souls are kept in" gave "Where the souls are kept in" on five of eight #
 * # template slots. Twelve shapes drew, one per surviving question word    #
 * # and two with the head noun in the same stretch.                        #
 * ##########################################################################
 *
 * TWO MARKS, AND A SAWN-OFF RELATIVE CLAUSE CARRIES BOTH. The narrator names
 * the thing, then says a clause about it, so his question word sits between
 * two noun phrases.
 *   1. THE HEAD NOUN IN FRONT. The word before the question word is a content
 *      word, and a determiner stands within the two words before THAT, which
 *      is what reaches "the FIRST chamber where" as well as "the chamber
 *      where". See `DETERMINERS` and `WORDS_THAT_NAME_NOTHING`.
 *   2. THE CLAUSE'S OWN SUBJECT BEHIND. The word after the question word is a
 *      determiner too, as in "where THE souls are kept in".
 *
 * ONE MARK IS NOT ENOUGH, AND IT IS MARK 1 THAT IS NOT ENOUGH, MEASURED. "The
 * text asks where they came from" also puts a determiner two words in front of
 * the word before "where", because "the" belongs to "the text", the thing
 * DOING the asking. On mark 1 alone the sheet loses "Where they came from",
 * which is a whole object question and draws on all eight slots. Mark 2 is
 * what separates them: a relative clause brings its own subject noun phrase,
 * "where THE souls", and an object question does not, "asks where THEY came".
 *
 * WHEN THE QUESTION WORD IS NOT IN THE STRETCH AT ALL, this answers no and the
 * excuse stands. That is b21's case, and it is the whole reason the V52 sheet
 * draws: the planner wrote "what" where the narrator said "the one most", so
 * "what" is in the line and nowhere in "not the one most people are hoping
 * for". Nothing in front of it can be read, because he never said it.
 */
function theQuestionWordHangsOffAHeadNoun(line: readonly string[], said: readonly string[]): boolean {
  const opens = line[0] === 'not' ? 1 : 0
  const question = line[opens]
  if (question === undefined) return false
  for (let at = said.length - 1; at >= 0; at -= 1) {
    if (said[at] !== question) continue
    const head = said[at - 1]
    if (head === undefined || WORDS_THAT_NAME_NOTHING.has(head)) return false
    const named = DETERMINERS.has(said[at - 2] ?? '') || DETERMINERS.has(said[at - 3] ?? '')
    if (!named) return false
    const subject = said[at + 1]
    return subject !== undefined && DETERMINERS.has(subject)
  }
  return false
}

/**
 * DOES A LINE THE PLANNER WROTE STOP MID-PHRASE? `endsMidPhrase`, with one
 * ending excused. Read by every template the planner writes words for: both
 * lines of P03's written pair, the 05 line, the framed-card caption, both
 * comparison labels, and the checklist's title and every row.
 *
 * THE LINE THAT CALLED FOR IT. The V52 sheet, planner prompt v15, asks P03 on
 * beat 21, at 1:12, for "The reunion question" over "Not what people are
 * hoping for". Both are the narrator's own words, "the answer Enoch gives to
 * the reunion question is not the one most people are hoping for." It drew
 * before the copy-check rounds of 2026-09-12, and `endsMidPhrase` then refused
 * it for ending on "for".
 *
 * ##########################################################################
 * # A PREPOSITION CAN END A WHOLE CLAUSE WHEN THE THING IT POINTS AT SITS  #
 * # EARLIER IN THE LINE. So a line ending on one is excused only when all  #
 * # three of these hold. Otherwise it is refused as mid-phrase, on every   #
 * # template.                                                              #
 * #   1. The preposition is one a clause can end on. See                   #
 * #      `PREPOSITIONS_A_CLAUSE_CAN_END_ON`.                               #
 * #   2. ONE stretch of the narration, closed by a punctuation mark, ends  #
 * #      on the line's last two words.                                     #
 * #   3. A question word at the front of the line stands for the thing,    #
 * #      and THAT SAME STRETCH holds the words after it, as it holds "Not  #
 * #      what people are hoping for". See `aQuestionWordHoldsTheLine`.     #
 * #   4. AND THE NARRATOR IS NOT HANGING THAT QUESTION WORD OFF A HEAD     #
 * #      NOUN OF HIS OWN. See `theQuestionWordHangsOffAHeadNoun`.          #
 * #                                                                        #
 * # THE SECOND EXCUSE IS GONE, 2026-09-12, AND WAS REMOVED RATHER THAN     #
 * # PATCHED A FOURTH TIME. Rule (a) excused a line that was the narrator's #
 * # own clause, head and all, opening on a word such as "the" or           #
 * # "nothing". Three rounds of review each found new cut-offs passing it:  #
 * # "The souls are kept in" and "The commentators pass over" under the     #
 * # clauses they are cut from, then "The dead are kept in", "The wicked    #
 * # are kept in", "The angels put the souls in", "The souls in the first   #
 * # chamber wait for" and "Everyone is hoping for", which drops the        #
 * # narrator's "not" and says the opposite of what he said. Each round     #
 * # added a check and the next round walked round it.                      #
 * #                                                                        #
 * # AND IT PAID FOR NOTHING. On the nine real sheets under tmp/ the only   #
 * # seated lines that end on a preposition are three of beat 21's. V52's   #
 * # "Not what people are hoping for" and the real sheet's "Not what most   #
 * # are hoping for" draw through the question-word rule above, and v14's   #
 * # "Not the answer most are hoping for" was refused before this change    #
 * # and is refused now. Rule (a) excused no seated line on any of the      #
 * # nine, so removing it moves no device and no verdict on any sheet.      #
 * #                                                                        #
 * # THE FIRST VERSION, 618c2b7, took the phrase end from ANY stretch in    #
 * # the window, so a line cut from one sentence borrowed the ending of     #
 * # another. "Who are waiting for", "Those who are hoping for" and "Which  #
 * # the souls are kept in" drew on it. It also looked for the question     #
 * # word in `tokens.slice(0, at - 2)`, which on a two-word line is the     #
 * # question word itself, so "What for" skipped the rule of two words     #
 * # between. All four are refused now.                                     #
 * ##########################################################################
 *
 * THE PRICE, SAID PLAINLY, AND IT IS WHOLE PHRASES. A line that ends on a
 * preposition and opens on no question word is refused wherever the planner
 * writes it, even where the narrator ends the same clause on the same two
 * words. "The place they came from", "Nothing to be afraid of", "Something
 * worth waiting for", "The wait is over", "Everything he stood for", "The
 * chamber the souls are kept in", "Those who are cared for" and b21's own
 * verbatim "Not the one most people are hoping for" are each whole, and each
 * is refused now. So are the phrases named on `endsMidPhrase`, "Their memory
 * lives on", "They were never heard from", "Lose everything you were" and "Not
 * everyone at all". None of them draws on any of the nine real sheets today. A
 * refused line costs a caption. A sawn-off one costs the frame.
 *
 * ONLY A STRETCH A MARK CLOSES COUNTS. The text after a narration's last mark
 * never does, because a shot's text stops where the cut falls, often
 * mid-sentence. So "hoping for. If" ends a stretch on "hoping for", and a shot
 * whose text stops on "waiting for" does not.
 *
 * THE COMMA IS A KNOWN LIMIT, AND IT IS PINNED RATHER THAN CLOSED. A comma
 * closes a stretch, so "The righteous, who still wait for, as it were, the
 * judgment" holds a stretch that ends on "wait for", and "Who still wait for"
 * is excused there though his phrase runs on to "the judgment". Check 4 does
 * not reach it either: "who" opens that stretch, so there is no word in front
 * of it to read. Nothing here reads across a comma, and the case is left
 * standing rather than guessed at. It draws on all eight slots today and
 * `deviceChoice.visualPlan.test.ts` pins that it does, so the day it is
 * closed, it is closed on purpose.
 *
 * AND CHECK 4'S OWN LIMITS, SAID PLAINLY, BECAUSE IT WANTS BOTH ITS MARKS. It
 * reads the narrator and never the line, so one line is refused under "the
 * reunion what the people are hoping for" and drawn under "This is what the
 * people are hoping for". A head noun with no determiner in front of it,
 * "Enoch saw chambers where the souls are kept in", is not caught, and neither
 * is a clause whose own subject is a bare pronoun. Both were left rather than
 * widened: dropping the second mark costs "Where they came from" under his own
 * "The text asks where they came from", where "the" belongs to "the text",
 * measured on all eight slots before this was written.
 *
 * THE OTHER LIMIT, SAID PLAINLY. The window is several shots joined with
 * spaces, so the last word of the shots before this one and the first word of
 * the shots after it sit side by side with nothing between them. A false
 * phrase end needs the line's own last two words to fall exactly across that
 * join with a mark straight after them, a question word and the line's other
 * words in order before it, and every content word still spoken.
 *
 * A WORD COUNT OR A VERB WAS THE OBVIOUS TEST, AND EACH LETS A CUT LINE
 * THROUGH. "Knowledge passed between" has a verb before its preposition, and
 * "The righteous dead are waiting in" has six words. Both stay refused, and so
 * do "The question every" and "Not sleep or", which end on no preposition.
 * `deviceChoice.visualPlan.test.ts` pins every case named here.
 *
 * NOT THE EDITORIAL KICKER. That is the dossier's work name, with no clause of
 * the narrator's to check it against, so it keeps `endsMidPhrase` unchanged.
 */
function writtenLineStopsMidPhrase(line: string, beat: DeviceBeat): boolean {
  if (!endsMidPhrase(line)) return false
  const tokens = contentTokens(line)
  const last = tokens[tokens.length - 1]
  const before = tokens[tokens.length - 2]
  if (last === undefined || before === undefined) return true
  if (!PREPOSITIONS_A_CLAUSE_CAN_END_ON.has(last)) return true
  for (const narration of [beat.text, beat.neighbourText ?? '']) {
    for (const stretch of narration.split(/[,.;:—–?!]/u).slice(0, -1)) {
      const said = contentTokens(stretch)
      if (said[said.length - 2] !== before || said[said.length - 1] !== last) continue
      if (!aQuestionWordHoldsTheLine(tokens, said)) continue
      if (theQuestionWordHangsOffAHeadNoun(tokens, said)) continue
      return false
    }
  }
  return true
}

/**
 * How many DIFFERENT things a list of entity strings actually names.
 *
 * ##########################################################################
 * # A LENGTH IS NOT A COUNT OF THINGS, AND ONE BEAT PROVED IT EXPENSIVELY.  #
 * #                                                                        #
 * # Beat 24 of the delivered plan — the frame the client called PERFECT —   #
 * # carries three entities: "Book of Enoch", "Book of the Watchers" and     #
 * # "chapter 22". Counted by length that is three named things and the beat #
 * # claims the four-picture jobs, which sit FIRST in the ordering below and #
 * # therefore demote everything else. Measured, that handed beat 24 to P22  #
 * # and replaced the frame he asked for more of with a mosaic.              #
 * #                                                                        #
 * # THEY ARE NOT THREE THINGS. Two of them are the same book under two      #
 * # names. So entities that share a content word are one thing here, and    #
 * # "of" and "the" do not count as sharing — every title on this script     #
 * # contains one, and merging on those would collapse the whole list to a   #
 * # single thing every time.                                                #
 * #                                                                        #
 * # DETERMINISTIC: a single forward pass in the segmenter's own array       #
 * # order, no Set iteration, no sort. Two runs agree, which the render key  #
 * # requires.                                                               #
 * ##########################################################################
 */
function distinctThings(entities: readonly string[]): number {
  const groups: Set<string>[] = []
  for (const entity of entities) {
    const tokens = contentTokens(entity).filter((token) => !JOINING_WORDS.has(token))
    if (tokens.length === 0) continue
    const existing = groups.find((group) => tokens.some((token) => group.has(token)))
    if (existing === undefined) {
      groups.push(new Set(tokens))
      continue
    }
    for (const token of tokens) existing.add(token)
  }
  return groups.length
}

/**
 * P17's plate geometry, taken from the approved lock rather than invented.
 *
 * His `defaultProps` are `anchorX 0.48, anchorY 0.64, labelX 0.63, labelY 0.35`,
 * so the plate sits +0.15 to the RIGHT of the subject and -0.29 ABOVE it.
 */
/**
 * P03's KICKER, AND IT IS A SCHEMA BOUND RATHER THAN A MEASUREMENT.
 *
 * `SceneDeviceSchema` declares the slot as `deviceText(24)`, so a longer string
 * is refused by the parse in `chooseDevices` whatever this file thinks. Checking
 * it HERE as well is not belt-and-braces: `buildCopy` now tries candidates in a
 * loop, and a candidate rejected here lets the NEXT one be tried, where the same
 * string reaching the parse would refuse the whole device for the beat.
 *
 * At 22px with `letterSpacing: 4.4` inside the same 1120px block, 24 characters
 * of the widest glyphs draw about 590px, so the schema is the binding limit and
 * the kicker needs no width model of its own.
 */
/* Exported for the opening-title builder. See `contentTokens`. */
export const P03_KICKER_MAX_CHARS = 24

/**
 * P03's HEADLINE, and the schema is a SECOND ceiling above the width gate.
 *
 * `deviceText(64)` bounds the slot. The width gate is the one that matters, but
 * the two do not agree at the extremes — thirty-nine I's draw on one line and
 * are still 39 characters, and a 70-character run of them would pass the width
 * gate and fail the parse. Checked here so the loop tries the next candidate.
 */
const P03_HEADLINE_MAX_SCHEMA_CHARS = 64

const P17_LABEL_OFFSET_X = 0.15
const P17_LABEL_OFFSET_Y = 0.29
/** The plate is 292 of 1920 wide, so past this it runs off the frame. */
const P17_LABEL_MAX_X = 1 - 292 / 1920 - 0.01

/**
 * Does this mark name a THING, rather than a date or a citation?
 *
 * A manuscript designation always does — that is what the detector matches. An
 * entity run does so only when the segmenter independently listed it among this
 * beat's entities; see the box on `sceneEntities` for why one source is not
 * enough.
 */
function namesAThing(mark: BeatMark, beat: DeviceBeat): boolean {
  if (mark.detector === 'manuscript') return true
  if (mark.detector !== 'entity') return false
  const wanted = normaliseToken(mark.text)
  return beat.sceneEntities.some((entity) => normaliseToken(entity) === wanted)
}

/**
 * One complete P03 from one chosen highlight, or null if this highlight cannot
 * carry the frame.
 *
 * Pulled out of `buildCopy` so the highlight choice can be a LOOP. Returning
 * null here rejects one candidate; it does not reject the device.
 */
function buildP03(
  highlight: BeatMark,
  marks: readonly BeatMark[],
  drawnHeadlines: ReadonlySet<string>,
  /** The film's own work, for the T-18 fallback below. Null on a film with no dossier. */
  editorialKicker: string | null,
  /** The ranker's score, for the editorial bar. Null when nothing looked at it. */
  visionScore: number | null,
): SceneDevice | null {
  /*
   * THE HEADLINE IS THE MARK'S OWN PHRASE, AND A RENDER IS WHY.
   *
   * ##############################################################
   * # A WINDOW GROWN OUTWARDS FROM THE MARK WAS WRONG THREE WAYS, #
   * # and all three were visible in one frozen plan.              #
   * #                                                             #
   * # It began MID-CLAUSE. Grown to a 64-character budget from    #
   * # "Inside a sealed glass case at the Israel Antiquities       #
   * # Authority in Jerusalem," it produced "glass case at the     #
   * # Israel Antiquities Authority in Jerusalem" — a fragment     #
   * # starting on a noun with no article, which is the sawn-off   #
   * # defect this file refuses everywhere else.                   #
   * #                                                             #
   * # And it DUPLICATED THE KICKER, because a window wide enough  #
   * # to reach one mark usually reaches the next one too — so     #
   * # "Jerusalem" was printed twice on one frame.                 #
   * #                                                             #
   * # A MARK'S OWN TEXT FIXES BOTH. It is a complete named phrase #
   * # the narrator actually said, so it can never be a fragment,  #
   * # and it contains exactly one mark, so nothing else collides. #
   * ##############################################################
   */
  const headline = highlight.text

  /*
   * DOES IT DRAW INSIDE THE BLOCK? A WIDTH, NOT A CHARACTER COUNT.
   *
   * ################################################################
   * # THE THIRD DEFECT THE OLD COMMENT LISTED — "far too long for   #
   * # the setting" — WAS REAL, AND `P03_HEADLINE_MAX_CHARS` WAS THE #
   * # WRONG INSTRUMENT FOR IT. Its own note said so: a mean glyph   #
   * # width divided into `maxWidth` cannot tell "MMM WWW" from      #
   * # "III LLL". `p03HeadlineFits` lays the real advances out of    #
   * # the shipping font file against the real 1120px block and      #
   * # counts the lines the template will actually draw.             #
   * #                                                               #
   * # It is a WIDENING, not a loosening. "Israel Antiquities        #
   * # Authority" is 28 characters and fits in two lines; a run of   #
   * # eighteen W's is 18 characters and does not fit at all. The    #
   * # count admitted the second and refused the first.              #
   * ################################################################
   */
  if (!p03HeadlineFits(headline)) return null
  /* And the slot's own schema bound, checked here so the loop can move on. */
  if (headline.length > P03_HEADLINE_MAX_SCHEMA_CHARS) return null

  /*
   * NOT A HEADLINE THIS FILM HAS ALREADY SET, WHICH IS A VARIETY RULE AND NOT
   * A COPY RULE.
   *
   * ################################################################
   * # MEASURED OVER THE REAL 118 BEATS: beats 29 and 106 both drew  #
   * # "CHAPTER 39" as the headline, and beats 71 and 87 both drew   #
   * # "ENOCH" — because the narration says those phrases more than  #
   * # once and each beat picks its marks independently. On screen   #
   * # that is the same 92px display frame twice in one film, which  #
   * # reads as a stuck render rather than a callback.               #
   * #                                                               #
   * # HIS WORDS ARE "always put in every generated video use        #
   * # different style in those animations and clips". A device that #
   * # repeats its own copy is the narrowest form of the thing he is #
   * # objecting to.                                                 #
   * #                                                               #
   * # IT SKIPS THE CANDIDATE RATHER THAN THE DEVICE. Beat 106 also  #
   * # speaks "Scepter and the Star", so refusing "Chapter 39" here  #
   * # lets the loop try the next mark instead of blanking the beat. #
   * ################################################################
   */
  if (drawnHeadlines.has(normaliseToken(headline))) return null

  const highlightWord = headline.split(/\s+/)[0] ?? headline
  /* Re-checked against what is ACTUALLY drawn, never against the beat. */
  if (!isWholeWordOf(highlightWord, headline)) return null

  /*
   * THE KICKER IS A SECOND SPOKEN MARK, AND WITHOUT ONE THE DEVICE IS
   * REFUSED RATHER THAN GIVEN A LABEL WE INVENTED.
   *
   * ##############################################################
   * # `P03.tsx` ALWAYS RENDERS THE KICKER — there is no empty     #
   * # branch — so it cannot be left blank the way P12's era block #
   * # can. The pack's own reference reads "A MEASURED CONTRAST",  #
   * # which is editorial copy nothing in this pipeline knows.     #
   * #                                                             #
   * # Writing one would be the first invented string in the file  #
   * # and it would be the highest-visibility one on screen. So a  #
   * # beat with only a single mark does not get P03, and that is  #
   * # the honest ceiling until the client supplies a rule for it. #
   * ##############################################################
   *
   * ##############################################################
   * # HE SUPPLIED THE RULE. 2026-08-30 22:37: "The tool can write #
   * # its own words there when needed, based on the context and   #
   * # the paragraph." That is T-18, and its first condition is    #
   * # that editorial copy is a FALLBACK and never a preference —  #
   * # so the spoken search below runs FIRST and unchanged, and    #
   * # the fallback is reached only where it comes back empty.     #
   * #                                                             #
   * # A REPLAY PROVES THE ORDER MATTERS. Beat 27 of V20 speaks    #
   * # both "Chapter 22" and "Book of the Watchers", so it takes   #
   * # the spoken pair and this fallback never runs on it. That is #
   * # the frame the client called perfect and it must not move.   #
   * ##############################################################
   */
  const headlineTokens = new Set(contentTokens(headline))
  const kicker = marks.find((mark) => {
    if (mark.text.length > P03_KICKER_MAX_CHARS) return false
    const tokens = contentTokens(mark.text)
    /*
     * NO SHARED WORD WITH THE HEADLINE, not merely a different mark. The two
     * blocks sit one above the other on the same frame, so a word in both is
     * printed twice — which is what "Jerusalem" did.
     *
     * STRICTER THAN `kickerRepeatsTheHeadline`, deliberately: a shared "the"
     * refuses a mark here. The end of that function's box says why P03 has
     * both rules, and that this one refuses too.
     */
    return tokens.length > 0 && tokens.every((token) => !headlineTokens.has(token))
  })
  if (kicker !== undefined) {
    return { id: 'P03', kicker: kicker.text, headline, highlightWords: [highlightWord] }
  }

  /*
   * THE T-18 FALLBACK, AND ITS FOUR CONDITIONS ARE ALL CHECKED HERE.
   *
   * ##############################################################
   * # 1. FALLBACK, NEVER A PREFERENCE — the spoken search above   #
   * #    has already returned undefined by the time we are here.  #
   * # 2. ONLY ON A CHAPTER CITATION. A name with no partner still #
   * #    refuses, because "BOOK OF ENOCH / ÉMILE PUECH" asserts a #
   * #    relationship the narration did not state. A chapter of   #
   * #    the film's own work is a relationship the dossier does   #
   * #    state.                                                   #
   * # 3. IT MUST FIT THE SLOT, same bound as a spoken kicker.     #
   * # 4. IT MUST NOT REPEAT THE HEADLINE'S OWN WORDS, through     #
   * #    `kickerRepeatsTheHeadline`, so "BOOK OF ENOCH" over      #
   * #    "CHAPTERS 102 THROUGH 104" passes and over "BOOK OF THE  #
   * #    WATCHERS" would not, on "book". A shared "of" alone is   #
   * #    not a repeat.                                            #
   * ##############################################################
   */
  if (highlight.detector !== 'section') return null
  if (editorialKicker === null) return null
  /*
   * 5. AND THE PICTURE MUST EARN THE STRONGER CLAIM. See
   * `MIN_SCORE_FOR_AN_EDITORIAL_LINE` — a spoken kicker is true whatever the
   * photograph is, and an editorial one is not.
   */
  if (visionScore === null || visionScore < MIN_SCORE_FOR_AN_EDITORIAL_LINE) return null
  if (editorialKicker.length > P03_KICKER_MAX_CHARS) return null
  if (contentTokens(editorialKicker).length === 0) return null
  if (kickerRepeatsTheHeadline(editorialKicker, headline)) return null
  /*
   * 6. AND IT MUST NOT STOP MID-PHRASE. See `endsMidPhrase`. The headline
   * needs no such check here: it is a section mark, and always ends on its
   * number.
   */
  if (endsMidPhrase(editorialKicker)) return null

  return { id: 'P03', kicker: editorialKicker, headline, highlightWords: [highlightWord] }
}

/**
 * Build the copy for one device on one beat, or refuse.
 *
 * ##########################################################################
 * # NOTHING IN HERE INVENTS A WORD. Every string returned is a substring   #
 * # of the beat's own script text, and every one of them was heard in this #
 * # shot. A device whose slots cannot be filled that way is REFUSED, not   #
 * # filled with a plausible guess — which is why four of the 22 are        #
 * # registered and disabled rather than quietly fed.                       #
 * ##########################################################################
 */
/**
 * THE PLANNER'S WORDS FOR THIS DEVICE ON THIS BEAT, OR NULL.
 *
 * ##########################################################################
 * # GUARDED ON THE ID, WHICH IS WHAT MAKES IT A FALLBACK RATHER THAN A     #
 * # SUPPLY OF FREE COPY.                                                    #
 * #                                                                        #
 * # The sheet names ONE template per moment and writes the words for THAT   #
 * # template. Letting any other arm read them would hand a headline written #
 * # for a checklist to a chapter heading, and would turn one editorial      #
 * # decision into sixteen.                                                  #
 * ##########################################################################
 */
function plannerWords(spec: DeviceSpec, beat: DeviceBeat): PlannedTemplate | null {
  /* `?? null` and not `=== null`. See the box in `narrativeJobsOf`: a beat built
   * before this field existed carries `undefined`, and `undefined !== null`. */
  const planned = beat.plannedTemplate ?? null
  if (planned === null || planned.templateId !== spec.id) return null
  return planned
}

/*
 * The shapes the narration scanner calls a date, copied from `scanNarrationMarks`
 * in `apps/worker/src/stages/plan.ts` (`BARE_YEAR_TOKEN`, `ERA_TOKEN`,
 * `ERA_FIGURE_TOKEN`), which this package cannot import. The era marker is read
 * in either case here, because the component upper-cases the line and "ad 79"
 * draws as AD 79.
 */
const LINE_YEAR_TOKEN = /^(?:1[0-9]{3}|20[0-9]{2})$/
const LINE_ERA_TOKEN = /^(?:BCE|BC|CE|AD)$/i
const LINE_ERA_LEADING_TOKEN = /^(?:AD|CE)$/i
const LINE_ERA_FIGURE_TOKEN = /^[0-9]{1,4}$/
/** Where a year hides inside one token. See the second box on `lineCarriesAYear`. */
const LINE_YEAR_JOINS = /[-‐‑–—\/]/u

/**
 * DOES THIS LINE CARRY A YEAR? T-2, FOR THE ONE DEVICE THAT COULD PRINT ONE AS
 * A LABEL.
 *
 * ##########################################################################
 * # G15 HANDS A DATE BEAT TO A YEAR TEMPLATE ONLY WHERE ONE OF THEM CAN    #
 * # REALLY DRAW (review C7). Where neither P12 nor P14 can, beside another #
 * # P12 for instance, or where the year is spoken one shot away so this    #
 * # beat holds no date mark, a 05 line holding "1947" passes every other   #
 * # check and prints the year as a stamp. T-2 says a date never falls back #
 * # to a label, and planCheck's T-2 reads only year overlays, so nothing   #
 * # later notices.                                                         #
 * #                                                                        #
 * # THE SCANNER'S OWN SHAPES, NOT A LOOSER ONE. "1,800 horsepower" keeps   #
 * # its comma, exactly as `stripPunctuation` keeps it, so his own          #
 * # reference line is a count and not a year. A bare "1800" is refused,    #
 * # which is the right way to err in a film about ancient texts.           #
 * ##########################################################################
 *
 * ##########################################################################
 * # EACH PIECE OF A JOINED TOKEN IS READ ON ITS OWN. Core review of        #
 * # feb2dc9. Read only as whitespace tokens, "Sealed 1947-1956",           #
 * # "Sealed mid-1947", "Sealed 1947–1956" and "Sealed 1947/48" each held   #
 * # a token that is not year-shaped as a whole, so all four drew as        #
 * # shadow-up on a beat P12 could not claim.                               #
 * #                                                                        #
 * # The joins are the hyphen class the spoken check splits on (`-`,        #
 * # U+2010, U+2011), the en dash, the em dash and the slash. The comma     #
 * # is not one, so "1,800" stays a count.                                  #
 * ##########################################################################
 */
function lineCarriesAYear(line: string): boolean {
  const bare = line
    .split(/\s+/)
    .flatMap((token) => token.split(LINE_YEAR_JOINS))
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0)
  return bare.some((token, index) => {
    if (LINE_YEAR_TOKEN.test(token)) return true
    const next = bare[index + 1]
    if (next === undefined) return false
    if (LINE_ERA_FIGURE_TOKEN.test(token) && LINE_ERA_TOKEN.test(next)) return true
    return LINE_ERA_LEADING_TOKEN.test(token) && LINE_ERA_FIGURE_TOKEN.test(next)
  })
}

/**
 * The beat with its window taken away, so a check reads THIS SHOT'S OWN
 * NARRATION and nothing either side of it. See `p04LineNamesWhatTheShotSays`.
 */
function theShotAlone(beat: DeviceBeat): DeviceBeat {
  const { neighbourText, ...shot } = beat
  void neighbourText
  return shot
}

/**
 * MAY THIS LINE BE PRINTED ON P04? THE DEVELOPER'S RULING, AS A PREDICATE.
 *
 * ##########################################################################
 * # P04's WORDS NAME THE PICTURE. The pack's card calls it "a small source, #
 * # date, place, or object identifier", so a label under a photograph      #
 * # tells the viewer what that photograph IS. The developer ruled, for the  #
 * # label and the support line alike: "only words spoken in the shot's      #
 * # narration AND confirmed by the picture's archive record ... Never an    #
 * # invented name." Each half of that is one line below.                   #
 * #                                                                        #
 * #   a name     at least one word that is not a joining word, or the      #
 * #              corroboration check below has nothing to check            #
 * #   spoken     every content word in THIS SHOT'S narration, read by the  #
 * #              same tokeniser `everyContentWordWasSpoken` uses, with the #
 * #              window taken away. 05 and P03 may quote a word two shots  #
 * #              away; a name over a picture may not                       #
 * #   whole      it does not stop mid-phrase ("Book of the")               #
 * #   no year    T-2 gives a spoken year to P12 or P14, see              #
 * #              `lineCarriesAYear`                                       #
 * #   confirmed  every content word in the picture's ARCHIVE RECORD, the   #
 * #              URL only (`nameIsCorroborated`, trap FF). ALWAYS, not only #
 * #              when the line equals a scene entity as 05's arm reads it  #
 * #                                                                        #
 * # AN AI FRAME FAILS THE LAST LINE TWICE OVER. It has no archive record,   #
 * # and `nameIsCorroborated` refuses a null provenance; T-8 then refuses    #
 * # its null score as well. T-10, from both sides.                          #
 * ##########################################################################
 */
function p04LineNamesWhatTheShotSays(line: string, beat: DeviceBeat): boolean {
  if (contentTokens(line).every((token) => JOINING_WORDS.has(token))) return false
  const shot = theShotAlone(beat)
  if (!everyContentWordWasSpoken(line, shot)) return false
  if (writtenLineStopsMidPhrase(line, shot)) return false
  if (lineCarriesAYear(line)) return false
  return nameIsCorroborated(line, beat.assetProvenance)
}

/**
 * P04's SUPPORT LINE, OR '' WHEN IT MAY NOT BE PRINTED.
 *
 * ##########################################################################
 * # LEFT OFF RATHER THAN REFUSING THE DEVICE. The label alone is the whole  #
 * # identifier the pack's fixture draws ("Venus"), and a label with nothing #
 * # under it says nothing false. So a support line that fails any check is  #
 * # simply not drawn, and the component omits its block.                    #
 * #                                                                        #
 * # THE SAME RULING AS THE LABEL, plus two things a second line adds: it    #
 * # may not repeat a content word of the label (the rule P03's written pair #
 * # answers to, `kickerRepeatsTheHeadline`), and it must draw on ONE line   #
 * # of the block by the face's own advances. Never cut to fit.              #
 * ##########################################################################
 */
function p04SupportLine(kicker: string | null, mainLine: string, beat: DeviceBeat): string {
  if (kicker === null) return ''
  const line = kicker.trim()
  if (line.length === 0 || line.length > P04_SUPPORT_LINE_MAX_CHARS) return ''
  if (!p04LineNamesWhatTheShotSays(line, beat)) return ''
  if (kickerRepeatsTheHeadline(line, mainLine)) return ''
  if (!p04SupportLineFits(line)) return ''
  return line
}

/**
 * MAY THIS LINE BE PRINTED ON P02's CARD? P03's WRITTEN-PAIR CHECKS, AS ONE
 * PREDICATE FOR BOTH LINES.
 *
 * ##########################################################################
 * # P02's WORDS ARE A STATEMENT ABOUT THE PASSAGE, NOT A NAME FOR THE      #
 * # PICTURE, so they answer to the rule P03's written pair answers to, not #
 * # to P04's stricter ruling:                                              #
 * #                                                                        #
 * #   a line       at least one word that is not a joining word            #
 * #   spoken       every content word in the WINDOW, the carrying shot and #
 * #                the shots either side, by `everyContentWordWasSpoken`   #
 * #   whole        it does not stop mid-phrase, see                        #
 * #                `writtenLineStopsMidPhrase`                             #
 * #   no year      T-2 gives a spoken year to P12 or P14, see            #
 * #                `lineCarriesAYear`                                     #
 * #   corroborated a line that IS a thing the scene names must be that     #
 * #                thing in the picture's archive record, as P03's and     #
 * #                05's are (`nameIsCorroborated`, trap FF)                #
 * #                                                                        #
 * # T-8 IS APPLIED AFTER THIS, in `attempt`, and `copyNamesThePicture`      #
 * # answers true for P02, so an AI frame never carries it (T-10).          #
 * ##########################################################################
 */
function p02LineIsTheNarrations(line: string, beat: DeviceBeat): boolean {
  if (contentTokens(line).every((token) => JOINING_WORDS.has(token))) return false
  if (!everyContentWordWasSpoken(line, beat)) return false
  if (writtenLineStopsMidPhrase(line, beat)) return false
  if (lineCarriesAYear(line)) return false
  const identifies = beat.sceneEntities.some((entity) => normaliseToken(entity) === normaliseToken(line))
  return !identifies || nameIsCorroborated(line, beat.assetProvenance)
}

/**
 * P02's LABEL, OR '' WHEN IT MAY NOT BE PRINTED.
 *
 * ##########################################################################
 * # LEFT OFF RATHER THAN REFUSING THE DEVICE. The label is the small       #
 * # section line over the statement, and the statement is the whole        #
 * # template. A headline with no label over it says nothing false, so a    #
 * # label that fails any check is simply not drawn and the component       #
 * # omits its block, as P04's support line is.                             #
 * #                                                                        #
 * # THE SAME CHECKS AS THE HEADLINE, plus two things a second line adds:   #
 * # it may not repeat a content word of the headline (the rule P03's       #
 * # written pair answers to, `kickerRepeatsTheHeadline`), and it must draw #
 * # on ONE line of the card by the face's own advances. Never cut to fit.  #
 * ##########################################################################
 */
function p02Label(kicker: string | null, headline: string, beat: DeviceBeat): string {
  if (kicker === null) return ''
  const line = kicker.trim()
  if (line.length === 0 || line.length > P02_LABEL_MAX_CHARS) return ''
  if (!p02LineIsTheNarrations(line, beat)) return ''
  if (kickerRepeatsTheHeadline(line, headline)) return ''
  if (!p02LabelFits(line)) return ''
  return line
}

/** Where a spoken question may START inside its sentence. Read by `theNarrationAsksIt` alone. */
const CLAUSE_MARKS = /[,;:—–]/u
/** A stretch of narration up to and including the marks that end it. Read by `theNarrationAsksIt` alone. */
const SPOKEN_STRETCH = /[^.!?…]*[.!?…]+/gu
const STRETCH_END = /[.!?…]+$/u

/**
 * DOES THE NARRATION ASK THIS QUESTION OUT LOUD? THE DEVELOPER'S RULING FOR
 * P09, AS A PREDICATE.
 *
 * ##########################################################################
 * # "P09: only where the narration actually asks a question (the sentence  #
 * # ends in a question mark)." So the line must end in a question mark AND #
 * # be the end of a stretch of narration that does:                        #
 * #                                                                        #
 * #   ends     the stretch's own closing marks include a question mark     #
 * #   the end  the line's content words are the LAST content words of that #
 * #            stretch, in the same order with none skipped, so the card   #
 * #            ends exactly where the spoken question ends                 #
 * #   a start  and they begin where the stretch or one of its clauses      #
 * #            begins, after a comma, semicolon, colon or dash, so         #
 * #            "Remember us?" is never cut out of "do the dead remember    #
 * #            us?"                                                        #
 * #                                                                        #
 * # MEASURED ON THE REAL SCRIPT. Job 99414763 asks one question in 8,742   #
 * # characters, and its shot 9 reads "asks, do the dead remember us? The    #
 * # Book of Enoch was". The clause after "asks," is the question, so "Do    #
 * # the dead remember us?" passes, and "The dead remember us?" (a statement #
 * # with a question mark) and "Every person who has ever lost someone?"     #
 * # (words from the same sentence that are not its question) do not.        #
 * #                                                                        #
 * # JOINING WORDS ARE LEFT OUT OF THE COMPARISON on both sides, as          #
 * # `everyContentWordWasSpoken` leaves them out, so "Do the dead" matches   #
 * # "do the dead". Tokens are `contentTokens`, whole, so a hyphenated word  #
 * # heard as its parts, or a number heard in digits and written in words,  #
 * # does not match. That refuses, which is the side to err on.              #
 * #                                                                        #
 * # THE LIMITS, SAID PLAINLY. `text` and `neighbourText` are read one at a  #
 * # time, because the window arrives with this shot taken out of it and    #
 * # nothing says where it was. So a question that starts in this shot and   #
 * # ends in the next is refused, and the window's own join, where the shots #
 * # before this one meet the shots after it, can read as one stretch. The   #
 * # second needs a question to end straight after that join with the        #
 * # line's words in order before it; `writtenLineStopsMidPhrase` names the  #
 * # same seam. A full stop inside an abbreviation or a decimal ends a       #
 * # stretch early, which can only refuse.                                   #
 * ##########################################################################
 */
function theNarrationAsksIt(question: string, beat: DeviceBeat): boolean {
  if (!question.endsWith('?')) return false
  const asked = contentTokens(question).filter((token) => !JOINING_WORDS.has(token))
  if (asked.length === 0) return false
  for (const narration of [beat.text, beat.neighbourText ?? '']) {
    for (const stretch of narration.match(SPOKEN_STRETCH) ?? []) {
      const marks = STRETCH_END.exec(stretch)?.[0] ?? ''
      if (!marks.includes('?')) continue
      const said: string[] = []
      const clauseStarts = new Set<number>()
      for (const clause of stretch.slice(0, stretch.length - marks.length).split(CLAUSE_MARKS)) {
        clauseStarts.add(said.length)
        said.push(...contentTokens(clause).filter((token) => !JOINING_WORDS.has(token)))
      }
      const from = said.length - asked.length
      if (from < 0 || !clauseStarts.has(from)) continue
      if (asked.every((token, offset) => said[from + offset] === token)) return true
    }
  }
  return false
}

/**
 * MAY THIS QUESTION BE PRINTED ON P09's CARD?
 *
 * The ruling above, and then every check P02's lines answer to, through the same
 * predicate rather than a copy of it: a line, every content word spoken in the
 * window, not stopping mid-phrase, no year, and corroborated by the archive
 * record when it is a thing the scene names. T-8 is applied after this, in
 * `attempt`, and `copyNamesThePicture` answers true for P09 (T-10).
 */
function p09QuestionIsTheNarrations(question: string, beat: DeviceBeat): boolean {
  return theNarrationAsksIt(question, beat) && p02LineIsTheNarrations(question, beat)
}

/**
 * P09's SECTION LABEL, OR '' WHEN IT MAY NOT BE PRINTED.
 *
 * ##########################################################################
 * # LEFT OFF RATHER THAN REFUSING THE DEVICE, for the reason `p02Label`     #
 * # gives: a question with no label over it says nothing false. The same   #
 * # checks as P02's label, against P09's own bound and card, plus one:      #
 * # a label is the name of a section, so one that is itself a question is   #
 * # left off rather than printed as a second question over the first.      #
 * ##########################################################################
 */
function p09SectionLabel(kicker: string | null, question: string, beat: DeviceBeat): string {
  if (kicker === null) return ''
  const line = kicker.trim()
  if (line.length === 0 || line.length > P09_LABEL_MAX_CHARS) return ''
  if (line.endsWith('?')) return ''
  if (!p02LineIsTheNarrations(line, beat)) return ''
  if (kickerRepeatsTheHeadline(line, question)) return ''
  if (!p09LabelFits(line)) return ''
  return line
}

/**
 * P05's EYEBROW OR SUPPORT LINE, OR '' WHEN IT MAY NOT BE PRINTED.
 *
 * ##########################################################################
 * # THE COLUMN'S LINES ARE A CLAIM SET BESIDE THE PICTURE, NOT A NAME FOR   #
 * # IT, so the eyebrow and the support line answer to the rule P02's lines  #
 * # answer to, through `p02LineIsTheNarrations` itself rather than a copy:  #
 * # a line, every content word spoken in the window, whole, no year, and    #
 * # corroborated by the archive record when it IS a thing the scene names.  #
 * #                                                                        #
 * # LEFT OFF RATHER THAN REFUSING THE DEVICE, for the reason `p02Label`     #
 * # gives: the claim is the template, and a claim with nothing over or      #
 * # under it says nothing false. Plus the two checks a further line adds:  #
 * # it may not repeat a content word of any line already printed           #
 * # (`kickerRepeatsTheHeadline`), and it must fit its own measure by the    #
 * # face's own advances. Never cut to fit.                                  #
 * ##########################################################################
 */
function p05ColumnLine(
  written: string | null | undefined,
  printed: readonly string[],
  beat: DeviceBeat,
  bound: number,
  fits: (line: string) => boolean,
): string {
  if (written === null || written === undefined) return ''
  const line = written.trim()
  if (line.length === 0 || line.length > bound) return ''
  if (!p02LineIsTheNarrations(line, beat)) return ''
  if (printed.some((other) => other.length > 0 && kickerRepeatsTheHeadline(line, other))) return ''
  if (!fits(line)) return ''
  return line
}

/**
 * P05's PICTURE LABEL, OR '' WHEN IT MAY NOT BE PRINTED.
 *
 * ##########################################################################
 * # THE LABEL SITS ON THE PICTURE AND NAMES IT, SO IT ANSWERS TO THE        #
 * # DEVELOPER'S RULING FOR P04 AND P05 LABELS, through P04's own predicate  #
 * # `p04LineNamesWhatTheShotSays`: "only words spoken in the shot's         #
 * # narration AND confirmed by the picture's archive record ... Never an    #
 * # invented name." Every content word spoken in THIS SHOT with the window  #
 * # taken away, whole, no year, and every content word in the archive       #
 * # record, always and not only when it equals a scene entity.              #
 * #                                                                        #
 * # LEFT OFF, NEVER A REFUSAL, as P04's support line is. It may not repeat  #
 * # a content word of the headline, and it must fit one line inside the     #
 * # picture. An AI frame has no archive record, so its label is always '';  #
 * # T-8 then refuses the frame as well, on its null score (T-10).           #
 * ##########################################################################
 */
function p05ImageLabel(written: string | undefined, headline: string, beat: DeviceBeat): string {
  if (written === undefined) return ''
  const line = written.trim()
  if (line.length === 0 || line.length > P05_IMAGE_LABEL_MAX_CHARS) return ''
  if (!p04LineNamesWhatTheShotSays(line, beat)) return ''
  if (kickerRepeatsTheHeadline(line, headline)) return ''
  if (!p05ImageLabelFits(line)) return ''
  return line
}

function buildCopy(
  spec: DeviceSpec,
  beat: DeviceBeat,
  /** Headlines this film has already set. See the box inside `buildP03`. */
  drawnHeadlines: ReadonlySet<string>,
): SceneDevice | null {
  const marks = usableMarks(beat)
  const written = plannerWords(spec, beat)

  switch (spec.id) {
    case 'photo-pop':
      return { id: 'photo-pop' }

    case 'P22':
      return { id: 'P22' }

    case 'P19':
      return { id: 'P19' }

    case 'gallery-strip':
      return { id: 'gallery-strip' }

    /*
     * ######################################################################
     * # P08, FULLSCREEN SOURCE EVIDENCE. NO WORDS, BY RULING.                #
     * #                                                                    #
     * # The pack's two lines name the source of the picture, and nothing    #
     * # here may invent that (T-18 condition 2). The developer ruled both   #
     * # empty, so the schema arm carries no string at all and a planner row #
     * # that wrote a headline for P08 draws exactly this: nothing printed.  #
     * #                                                                    #
     * # UNCONDITIONAL HERE, AND THAT IS SAFE ONLY BECAUSE OF TWO GATES      #
     * # ELSEWHERE, which photo-pop's cap box says an unconditional device    #
     * # needs. Its job, `source_priority`, is pushed only by a planner row, #
     * # so G14 refuses it on every beat the planner did not ask for it. And #
     * # `copyNamesThePicture` answers true for it, so T-8 refuses a picture  #
     * # under 6 or with no score, which includes every AI frame.            #
     * ######################################################################
     */
    case 'P08':
      return { id: 'P08' }

    case 'P12': {
      /* A year is a NUMBER, so it is the one mark the aligner cannot misspell. */
      const date = marks.find((mark) => DATE_DETECTORS.has(mark.detector))
      if (date === undefined) return null
      return { id: 'P12', year: date.text, eraLabel: '', detail: '' }
    }

    case 'P17': {
      if (beat.subjectAnchor === null) return null
      /*
       * A manuscript designation is a thing you can SEE in the picture the
       * scene was sourced for. An untyped entity run is not — on this script
       * `entityAt` also returns "March", "Aramaic" and "Raphael" — so P17's
       * leader line is restricted to the one detector whose output is always a
       * named object rather than a capitalised word of unknown kind.
       */
      /*
       * A MANUSCRIPT DESIGNATION ONLY, AND THIS IS DELIBERATELY NARROWER THAN
       * WHAT `framed-card` ACCEPTS. A rendered film is what settled it.
       *
       * ##################################################################
       * # THE TWO DEVICES MAKE DIFFERENT CLAIMS, SO THEY GET DIFFERENT   #
       * # RULES. `framed-card` puts a caption BELOW the photograph on    #
       * # the film's own ground — it titles the whole image, and "Book   #
       * # of Enoch" under a papyrus is right. P17 points a leader line   #
       * # AT ONE POINT and says "that thing there is X", which is a far  #
       * # stronger claim about a specific patch of pixels.               #
       * #                                                                #
       * # Loosening both to any agreed entity put "Jerusalem" on a       #
       * # leader line aimed into the middle of a page of Arabic script — #
       * # rendered, delivered, and only visible by looking at the frame. #
       * # That is the client's first complaint exactly: an overlay may   #
       * # only name what you can SEE, and it is the same defect as the   #
       * # Enoch Powell photograph still sitting in v9.                   #
       * #                                                                #
       * # A place name cannot be a point in a photograph of an object. A #
       * # MANUSCRIPT DESIGNATION can: "4Q208" IS the thing photographed, #
       * # so a line pointing at it is true. That is the whole difference #
       * # and it is why the entity route is refused here and kept for    #
       * # the caption.                                                   #
       * #                                                                #
       * # WHAT THIS DOES NOT FIX: nothing here knows WHICH PART of the   #
       * # picture is the manuscript, so the line still lands where the   #
       * # anchor says. The anchor gate above is what keeps that honest.  #
       * ##################################################################
       */
      const named = marks.find(
        (mark) =>
          mark.detector === 'manuscript' && mark.text.length <= P17_LABEL_MAX_CHARS_MIRROR,
      )
      if (named === undefined) return null
      const { x, y } = beat.subjectAnchor
      /*
       * THE PLATE MUST SIT TO THE RIGHT OF THE ANCHOR, AND THAT IS NOT A
       * PREFERENCE — IT IS THE TEMPLATE'S DRAWN GEOMETRY.
       *
       * ##################################################################
       * # `P17.tsx` ends its leader line at the plate's LEFT edge         #
       * # (`lineStart.x = labelPosition.x`, with the plate drawn from     #
       * # that same x rightward across LABEL_WIDTH). So the line has to   #
       * # ARRIVE from the left. His own lock file agrees: the approved    #
       * # defaults are `anchorX 0.48, labelX 0.63` — plate right of       #
       * # subject, offset +0.15.                                          #
       * #                                                                 #
       * # An earlier version placed the plate on whichever side had more  #
       * # room, which for a centred anchor put it at 0.20 with the anchor #
       * # at 0.50. The line then ran the full width of the plate BEHIND   #
       * # it and poked out the far side — visible in a delivered film as  #
       * # a stray mark beside the label, and invisible to every test.     #
       * #                                                                 #
       * # SO THE OFFSETS ARE HIS, and where they do not fit, the device   #
       * # is REFUSED rather than drawn mirrored. Editing his template to  #
       * # attach on the facing edge is the other repair, and his written  #
       * # change policy is that a visual change means a new version       #
       * # reviewed and registered — not an edit in place by us.           #
       * ##################################################################
       */
      const labelX = x + P17_LABEL_OFFSET_X
      if (labelX > P17_LABEL_MAX_X) return null
      /* His lock puts the plate above the subject by the same construction. */
      const labelY = Math.min(0.80, Math.max(0.06, y - P17_LABEL_OFFSET_Y))
      return { id: 'P17', label: named.text, anchorX: x, anchorY: y, labelX, labelY }
    }

    case 'P03': {
      /*
       * EVERY CANDIDATE HIGHLIGHT, IN PREFERENCE ORDER, AND IT USED TO BE ONLY
       * THE FIRST.
       *
       * ##############################################################
       * # THE OLD CODE WAS `marks.find(...)` FOLLOWED BY A RETURN OF  #
       * # null IF THAT ONE PICK DID NOT FIT. So a beat naming a long  #
       * # thing and a short one was refused on the long one and never #
       * # tried the short one — the first pick was treated as the     #
       * # only pick.                                                  #
       * #                                                             #
       * # Real scene 0 is the case: its two marks are "Israel         #
       * # Antiquities Authority" and "Jerusalem". Whichever the find   #
       * # returned first decided the beat, and a failure there ended   #
       * # P03's chances rather than moving on.                        #
       * #                                                             #
       * # It is a LOOP now, and the kicker search sits inside it —    #
       * # because a headline that fits is still no use if nothing left #
       * # over can be the kicker, and that pairing is what has to be   #
       * # searched, not the headline alone.                            #
       * ##############################################################
       *
       * THE ORDER IS THE CLIENT'S, not convenience:
       *
       *   1. A DATE OR NUMBER. `goodFor` leads with "number" and "fact", and a
       *      figure is the one mark the aligner cannot misspell. In practice
       *      G15 hands date beats to a year template first, so this branch is
       *      what P03 falls back to when neither P12 nor P14 can draw.
       *   2. A NAMED THING, agreed by both the mark and the segmenter.
       *   3. A CHAPTER OR SECTION MARKER.
       *
       * ##############################################################
       * # THE THIRD ENTRY IS NEW AND IT IS RULE 3 OF THE STYLE NOTES.  #
       * #                                                             #
       * # HIS WORDS, about the "CHAPTER 22 / BOOK OF THE WATCHERS"     #
       * # frame: "this text overlay is perfect always use this in a    #
       * # Major mention or ANOTHER CHAPTER OF THE STORY."              #
       * #                                                             #
       * # The `section` detector is the one that finds those — it      #
       * # returns "Chapter 39" and "Chapters 102 through 104" — and    #
       * # neither of the two tests above admits it: a section is not a #
       * # date, and `namesAThing` takes only a manuscript designation  #
       * # or an entity the segmenter also listed. So a chapter marker  #
       * # could not be a P03 highlight AT ALL, and all three of the    #
       * # chapter beats in the delivered film were drawn as the `note` #
       * # style he rejected.                                          #
       * #                                                             #
       * # IT IS LAST, NOT FIRST, AND THAT ORDERING IS LOAD-BEARING.    #
       * # Beat 24 is the frame he called perfect, and it carries BOTH  #
       * # a section mark ("Chapter 22") and a named thing ("Book of    #
       * # the Watchers"). Putting sections first would swap them, and  #
       * # the film would draw CHAPTER 22 large with BOOK OF THE        #
       * # WATCHERS as the small gold kicker above it — the frame he    #
       * # praised, inverted. Last keeps that frame exactly as it is.   #
       * ##############################################################
       */
      const seen = new Set<string>()
      const highlights: BeatMark[] = []
      for (const candidate of [
        ...marks.filter((mark) => DATE_DETECTORS.has(mark.detector)),
        ...marks.filter((mark) => namesAThing(mark, beat)),
        ...marks.filter((mark) => mark.detector === 'section'),
      ]) {
        const key = normaliseToken(candidate.text)
        if (seen.has(key)) continue
        seen.add(key)
        highlights.push(candidate)
      }

      for (const highlight of highlights) {
        const built = buildP03(highlight, marks, drawnHeadlines, beat.editorialKicker, beat.visionScore)
        if (built !== null) return built
      }

      /*
       * ####################################################################
       * # THE VISUAL PLANNER'S OWN PAIR, AND IT IS REACHED ONLY WHEN EVERY  #
       * # SPOKEN CANDIDATE ABOVE HAS FAILED.                                #
       * #                                                                  #
       * # T-18 CONDITION 1 IS THE LOOP ORDER, not a check: the spoken       #
       * # highlights are tried first and return above. Beat 27 of V20       #
       * # speaks both "Chapter 22" and "Book of the Watchers", takes the    #
       * # spoken pair, and never reaches this line — and that is the frame  #
       * # the client called PERFECT.                                        #
       * #                                                                  #
       * # WHY IT EARNS ITS PLACE. On the first real run the planner named   #
       * # P03 ten times and FIVE were refused `copy-not-available`, which   #
       * # is the single largest loss in the sheet. `buildP03` quotes a      #
       * # mark's own text, so a sentence with nothing quotable in it can    #
       * # never carry the one template built for a sentence that turns on   #
       * # a phrase.                                                         #
       * #                                                                  #
       * # EVERY OTHER RULE STILL RUNS, AND THAT IS WHAT MAKES IT SAFE. The  #
       * # width check that lays real glyph advances against the real block, #
       * # the schema bound, the no-repeated-headline ledger and the         #
       * # shared-word test between the two lines are all applied below      #
       * # exactly as they are to a spoken pair. A written pair that fails   #
       * # any of them refuses the device rather than drawing badly.         #
       * ####################################################################
       */
      if (written === null) return null
      const writtenHeadline = written.headline
      const writtenKicker = written.kicker
      /* `P03.tsx` always renders the kicker — there is no empty branch — so a
       * headline with no partner is a frame with a blank line on it. */
      if (writtenHeadline === null || writtenKicker === null) return null
      /*
       * ##################################################################
       * # AND THE WORDS MUST BE THIS SHOT'S OWN. See the box on           #
       * # `everyContentWordWasSpoken`: without this the arm drew "A       #
       * # STRUCTURE THAT BREAKS" over the closing frame of the film, off  #
       * # a passage that begins a second AFTER the cut ends.              #
       * #                                                                #
       * # BOTH LINES, because `P03.tsx` draws both. Gating the headline   #
       * # alone leaves "NOT SOULS DRIFTING" printed in gold above it,     #
       * # which is the same falsehood in the smaller type.                #
       * #                                                                #
       * # IT REFUSES THE CANDIDATE, NOT THE BEAT. Returning null here     #
       * # drops P03 and lets G15's fallback chain hand the beat to        #
       * # photo-pop, exactly as an unfittable headline already does.      #
       * ##################################################################
       */
      if (!everyContentWordWasSpoken(writtenHeadline, beat)) return null
      if (!everyContentWordWasSpoken(writtenKicker, beat)) return null
      /*
       * AND NEITHER LINE MAY STOP MID-PHRASE. See `endsMidPhrase`. Job-v9's
       * "The question every" passed every other check in this arm. A whole
       * clause the narrator ends on a preposition is excused where a question
       * word at its front stands for the thing and the same stretch of his
       * holds the rest, as the V52 sheet's "Not what people are hoping for" is.
       * See `writtenLineStopsMidPhrase`. The 05 line, the framed-card caption,
       * the comparison labels and the checklist ask it too.
       */
      if (writtenLineStopsMidPhrase(writtenHeadline, beat) || writtenLineStopsMidPhrase(writtenKicker, beat)) {
        return null
      }
      if (!p03HeadlineFits(writtenHeadline)) return null
      if (writtenHeadline.length > P03_HEADLINE_MAX_SCHEMA_CHARS) return null
      if (writtenKicker.length > P03_KICKER_MAX_CHARS) return null
      if (drawnHeadlines.has(normaliseToken(writtenHeadline))) return null
      /*
       * ##################################################################
       * # SPOKEN IS NECESSARY AND NOT SUFFICIENT, AND SCENE 0 IS WHY.     #
       * #                                                                #
       * # The film's OPENING frame, 0:00.0 to 0:04.6, drew "JERUSALEM"    #
       * # over "ISRAEL ANTIQUITIES AUTHORITY". Both phrases are in the    #
       * # narration word for word, so the check above passes them. The    #
       * # picture underneath is a self-published CC0 Wikimedia snapshot   #
       * # that no archive record connects to the IAA or to Jerusalem.     #
       * # The card is faithful to the script and false about the frame.   #
       * #                                                                #
       * # THIS IS THE SAME RULE `framed-card` ALREADY RUNS, and the same  #
       * # helper. Its box says it best: a headline that repeats a thing   #
       * # the scene NAMES is an identification wearing a description's    #
       * # clothes. P03's headline is the biggest type on the frame, so it #
       * # makes that claim harder than a caption does, not softer.        #
       * #                                                                #
       * # TRAP FF IS HANDLED INSIDE `nameIsCorroborated`, which reads the #
       * # URL half of the provenance only. The ranker's sentence about    #
       * # the picture may spell "Israel Antiquities Authority" while      #
       * # denying it, and a substring test cannot tell the two apart.     #
       * #                                                                #
       * # THE HEADLINE ONLY, DELIBERATELY. The kicker is the second line  #
       * # and sits beside the identification rather than making it — the  #
       * # spoken arm does not corroborate its kicker either. Gating it    #
       * # would refuse a true "JERUSALEM" over a photograph of the IAA's  #
       * # own scroll lab, whose file name names the institution and not   #
       * # the city it stands in.                                          #
       * ##################################################################
       */
      const writtenIdentifies = beat.sceneEntities.some(
        (entity) => normaliseToken(entity) === normaliseToken(writtenHeadline),
      )
      if (writtenIdentifies && !nameIsCorroborated(writtenHeadline, beat.assetProvenance)) {
        return null
      }
      /* The gold box goes round a WORD. See `firstContentWordOf` — the first
       * token of "A structure that breaks" is a single letter. */
      const writtenWord = firstContentWordOf(writtenHeadline)
      if (writtenWord === null) return null
      /* The two blocks sit one above the other, so a word in both is printed
       * twice. That is what "Jerusalem" did on a real render. A joining word
       * in both is not a repeat. See `kickerRepeatsTheHeadline`. */
      if (contentTokens(writtenKicker).length === 0) return null
      if (kickerRepeatsTheHeadline(writtenKicker, writtenHeadline)) return null
      return {
        id: 'P03',
        kicker: writtenKicker,
        headline: writtenHeadline,
        highlightWords: [writtenWord],
      }
    }


    case 'framed-card': {
      /*
       * Its caption names the artifact, cave or place the picture SHOWS. Only
       * the manuscript detector reliably returns that kind of thing; an entity
       * run may be a month or a language.
       */
      const candidates = marks.filter(
        (mark) => namesAThing(mark, beat) && mark.text.length <= 32,
      )
      /*
       * ####################################################################
       * # NAME THE ONE YOU CAN SEE, WHEN THE SHOT NAMES MORE THAN ONE.      #
       * #                                                                  #
       * # This was `marks.find(...)`, which takes whichever the aligner     #
       * # happened to hear first, and on a sentence naming two things that  #
       * # is a coin toss over what the caption asserts.                     #
       * #                                                                  #
       * # JOB 2629eec5 SHOT 13, AT 0:43. Narration "the Dead Sea Scrolls    #
       * # surfaced at Qumran in", entities Qumran / Dead Sea Scrolls /      #
       * # 1947, picture `File:Palestine_Qumran_BW_6.jpg` which the ranker   #
       * # called "Desolate landscape view around Qumran canyon". The        #
       * # caption drawn was "Dead Sea Scrolls". The client watched it and   #
       * # asked whether that was a Dead Sea Scroll. It is the canyon, and   #
       * # the RIGHT name was in the same sentence.                          #
       * #                                                                  #
       * # A PREFERENCE AND NOT A REFUSAL, which is the whole design. A      #
       * # refusal would also delete captions that are correct and simply    #
       * # unverifiable — the file name of Chester Beatty XII does not spell #
       * # "Epistle of Enoch" though that is exactly what it holds — and it  #
       * # would break the rule that a framed-card may name the PLACE a      #
       * # pictured object sits in, which is settled at                       #
       * # `deviceChoice.test.ts` "refuses a PLACE on P17". Sorting cannot   #
       * # empty a non-empty list, so no beat loses a caption it had.        #
       * #                                                                  #
       * # WHAT IT DOES NOT FIX, said plainly: a shot naming exactly one     #
       * # thing over a picture that is not it still draws it. Shot 25 of    #
       * # that film captions an Ethiopian GOSPEL OF LUKE leaf "Book of the  #
       * # Watchers" and this rule has nothing better to offer it.           #
       * ####################################################################
       */
      /*
       * ####################################################################
       * # AND NO FALLBACK TO AN UNCORROBORATED NAME, which the first        #
       * # version of this rule had as `?? candidates[0]`.                    #
       * #                                                                  #
       * # A preference only helps a shot that names TWO things. Shot 25 of  #
       * # job 2629eec5 names one, "Book of the Watchers", over an Ethiopian #
       * # GOSPEL OF LUKE leaf, accession 1999.212 at the Cleveland Museum   #
       * # of Art. Shot 38 names "Enoch" over a Pexels photograph of         #
       * # sunlight. With nothing better to prefer, both kept their          #
       * # falsehood.                                                        #
       * #                                                                  #
       * # REFUSING THE NAME DOES NOT COST THE ANIMATION. Control falls to   #
       * # the planner's own headline below, which is a DESCRIPTION of the   #
       * # picture rather than an identification of it, and T-18 already     #
       * # forbids it from asserting a fact. The card still draws; it stops  #
       * # claiming the picture is a thing it is not.                        #
       * #                                                                  #
       * # THE PRICE, PAID KNOWINGLY: a caption that is correct and merely   #
       * # unverifiable goes too. P. Chester Beatty XII really does hold the #
       * # Epistle of Enoch and its file name never says so. The only thing  #
       * # that could vouch for it is the ranker's own prose, and that is    #
       * # trap FF, which has put a falsehood on screen twice.                #
       * #                                                                  #
       * # THE CLIENT'S OWN RULE IS THE TIEBREAK: "an overlay may only name  #
       * # what you can see."                                                #
       * ####################################################################
       */
      const named = candidates.find((mark) =>
        nameIsCorroborated(mark.text, beat.assetProvenance),
      )
      if (named !== undefined) return { id: 'framed-card', caption: named.text }
      /*
       * ####################################################################
       * # T-18 CONDITION 1, IN ONE LINE OF CONTROL FLOW: "It is a fallback, #
       * # never a preference. Where a spoken mark exists it wins."          #
       * #                                                                  #
       * # The spoken caption is tried FIRST and returns above. This line is #
       * # only reached on a beat that names nothing the aligner heard — the #
       * # beat that used to draw nothing at all, which is where the client's #
       * # empty stretches came from.                                        #
       * #                                                                  #
       * # AND CONDITION 2 IS SATISFIED BY THE SLOT, NOT BY A CHECK HERE.    #
       * # A caption is a description of what the picture shows, which is    #
       * # the summary T-18 permits. There is no slot in `PlannedTemplate`   #
       * # for a date, a role or an institution, so the shapes it refuses    #
       * # cannot be expressed.                                              #
       * ####################################################################
       */
      const caption = written?.headline ?? null
      if (caption === null || caption.length > 32) return null
      /*
       * AND IT MAY NOT STOP MID-PHRASE, the rule P03's written pair answers to,
       * excuse and all. See `writtenLineStopsMidPhrase`. A caption is printed as
       * a whole thought, and "Parchment sealed in" is not one.
       */
      if (writtenLineStopsMidPhrase(caption, beat)) return null
      /*
       * ####################################################################
       * # THE PLANNER CAN WRITE THE SAME FALSEHOOD, AND A RENDER PROVED IT. #
       * #                                                                  #
       * # Gating the spoken path above was not enough. Job f17489be shot 25 #
       * # still drew "Book of the Watchers" over an Ethiopian GOSPEL OF     #
       * # LUKE leaf, because the words were never a spoken mark: stage 1c   #
       * # wrote them into the visual-plan sheet and this fallback carried   #
       * # them through unchecked.                                           #
       * #                                                                  #
       * # A HEADLINE IS NORMALLY A DESCRIPTION AND MUST STAY ONE. "A        #
       * # fragment from the caves" corroborates nothing and is exactly what #
       * # T-18 permits, so gating every headline would delete the whole     #
       * # fallback. The test is therefore what the headline IS rather than  #
       * # where it came from: one that repeats a thing the scene NAMES is   #
       * # an identification wearing a description's clothes, and it answers #
       * # to the same rule a spoken name does.                              #
       * ####################################################################
       */
      const identifies = beat.sceneEntities.some(
        (entity) => normaliseToken(entity) === normaliseToken(caption),
      )
      if (identifies && !nameIsCorroborated(caption, beat.assetProvenance)) return null
      return { id: 'framed-card', caption }
    }

    /*
     * ######################################################################
     * # a3, THE CHAPTER TITLE. THE ONLY DEVICE WHOSE COPY IS WRITTEN        #
     * # RATHER THAN QUOTED, AND THE CLIENT NAMED IT HIMSELF.                #
     * #                                                                    #
     * #   "I believe chapter title in most occasions will be AI's own       #
     * #    words, describing the next chapter"  — 2026-08-30                #
     * #                                                                    #
     * # It reads `editorialTitle` and NEVER composes one. See that field's  #
     * # own box for why writing it here is forbidden, and T-18 condition 3. #
     * ######################################################################
     *
     * ######################################################################
     * # THIS ARM WAS MISSING AND IT IS THE SECOND OF THREE REASONS a3 HAS   #
     * # DRAWN ZERO FRAMES IN EVERY FILM EVER RENDERED.                      #
     * #                                                                    #
     * # It has been `enabled: true` since `99b0f61` on 08-28 and has never  #
     * # appeared. Without a case here it fell to `default: return null` and #
     * # `attempt` refused it `copy-not-available` — so enabling it changed  #
     * # no frame, which is exactly what the 18-agent audit found.           #
     * #                                                                    #
     * # The other two are `narrativeJobsOf` never pushing `section_turn`,   #
     * # and `copyNamesThePicture` refusing it `picture-too-generic-to-name` #
     * # because a chapter beat holds no picture and so scores null. All     #
     * # three are fixed together in this change, because fixing any two     #
     * # leaves it just as invisible and burns a render cycle proving it.    #
     * ######################################################################
     */
    case 'chapter-title': {
      /*
       * ####################################################################
       * # TWO PRODUCERS NOW, AND THE ORDER IS T-18 CONDITION 1 AGAIN.       #
       * #                                                                  #
       * # `editorialTitle` comes from the dossier's own section headings,   #
       * # which are ANCHORED to a chapter boundary in the script by         #
       * # `sectionTitlesForBeats`. That is a stronger claim about a beat    #
       * # than "the planner thought a heading belonged here", so it wins.   #
       * # The planner's line is what lets a turn the dossier's forty        #
       * # sections did not name still carry a heading.                       #
       * ####################################################################
       */
      const title = beat.editorialTitle ?? written?.headline ?? null
      if (title === null) return null

      /*
       * `CHAPTER_TITLE_MAX_CHARS` is the measured width bound, and this refuses
       * rather than truncating. Cutting a client's copy silently is how P17's
       * plate rule was written the wrong way round first — a label that visibly
       * does not fit is better than one quietly shortened, and a refusal here
       * just means the beat draws something else.
       */
      const caption = title.trim()
      if (caption.length === 0 || caption.length > CHAPTER_TITLE_MAX_CHARS) return null

      /*
       * THE SAME FILM MUST NOT PRINT THE SAME DISPLAY LINE TWICE, and until
       * now this set was P03's alone. a3's caption is a display line of the
       * same weight, so it belongs in the same ledger.
       *
       * REACHABLE ON THE REAL NARRATION, not hypothetical: this script cites
       * the same passage in two different movements, so two sections can
       * legitimately be titled the same thing and the film would say it twice.
       */
      if (drawnHeadlines.has(normaliseToken(caption))) return null
      return { id: 'chapter-title', caption }
    }

    /*
     * ######################################################################
     * # THE TWO ARMS THE VISUAL PLANNER UNLOCKS, AND THEY WERE BOTH BLOCKED #
     * # ON EXACTLY ONE THING: `disabledReason: 'needs-invented-copy'`.       #
     * #                                                                    #
     * # Neither template can be fed from spoken marks. A comparison needs   #
     * # two short LABELS for the two halves, and a checklist needs a title  #
     * # and its rows — none of which any narration says in those words. So  #
     * # the registry disabled them and said so, and this file's own header  #
     * # said "nothing in here invents a word".                              #
     * #                                                                    #
     * # THAT SENTENCE IS NOW OUT OF DATE, AND T-18 IS WHY. The client ruled #
     * # on 2026-08-30 that the tool may write its own words "based on the   #
     * # context and the paragraph", under four conditions. Both arms below  #
     * # meet all four: the words come from upstream and frozen (3), they    #
     * # are summaries rather than facts (2), they are only reached when     #
     * # nothing was spoken for the slot (1), and T-19's copy sheet lists    #
     * # every one of them before the film ships (4).                        #
     * #                                                                    #
     * # THE PLANNER IS THE ONLY SOURCE. No marks are consulted, because     #
     * # there is nothing in a mark that could fill these slots — which is   #
     * # the whole reason they were disabled.                                #
     * ######################################################################
     */
    case 'two-photo-zoom': {
      if (written === null) return null
      /* Two labels: the headline for the left half, the first list row for the
       * right. A comparison with only one side named is not a comparison. */
      const left = written.headline
      const right = written.lines[0] ?? null
      if (left === null || right === null) return null
      /*
       * ##################################################################
       * # BOTH LABELS MUST BE THIS SHOT'S OWN WORDS. See the box on       #
       * # `everyContentWordWasSpoken`. A comparison names two things and  #
       * # asserts a contrast between them, so an invented label does not  #
       * # merely mislabel a picture, it claims a distinction the          #
       * # narration never drew.                                          #
       * #                                                                #
       * # THIS ARM HAD NOT SHIPPED WHEN THE RULE WAS WRITTEN, and it is   #
       * # gated anyway. The two devices ahead of it in this family were   #
       * # each fixed only after a delivered film put the falsehood on     #
       * # screen; waiting for a third would be a choice, not an accident. #
       * ##################################################################
       */
      if (!everyContentWordWasSpoken(left, beat)) return null
      if (!everyContentWordWasSpoken(right, beat)) return null
      /* AND NEITHER LABEL MAY STOP MID-PHRASE. See `writtenLineStopsMidPhrase`. */
      if (writtenLineStopsMidPhrase(left, beat) || writtenLineStopsMidPhrase(right, beat)) return null
      if (left.length > 24 || right.length > 24) return null
      if (normaliseToken(left) === normaliseToken(right)) return null
      return { id: 'two-photo-zoom', left, right }
    }

    case 'bullet-checklist': {
      if (written === null) return null
      const title = written.headline
      if (title === null || title.length > 32) return null
      /*
       * ##################################################################
       * # THE TITLE AND EVERY ROW MUST BE THIS SHOT'S OWN WORDS.          #
       * #                                                                #
       * # THIS IS NOT A PRECAUTION, IT IS A DELIVERED DEFECT. Gating P03  #
       * # sent the film's closing beat down its fallback chain to here,   #
       * # and on the first real run afterwards this arm drew on scene 57  #
       * # — the last shot of the film — with the title "The structure is  #
       * # not symmetric" over "A holding environment, not a reunion" and  #
       * # two rows about who remembers. Measured against that run's own   #
       * # 58 scenes: "symmetric" appears in NONE of them, "remembers" in  #
       * # NONE, "holding environment" in NONE. It is the same falsehood   #
       * # as "A STRUCTURE THAT BREAKS", on the same frame, one device to  #
       * # the left, and it was reachable only because the beat ordering   #
       * # changed and this template had never been CHOSEN before.         #
       * #                                                                #
       * # EVERY ROW, AND REFUSE RATHER THAN FILTER. Dropping the unspoken #
       * # rows and drawing the rest would print a checklist that means    #
       * # something the planner did not write and the viewer cannot       #
       * # check. A refused checklist costs a caption; a silently          #
       * # shortened one is a different claim.                             #
       * ##################################################################
       */
      if (!everyContentWordWasSpoken(title, beat)) return null
      /*
       * ##################################################################
       * # AND IT MUST FIT THE PANEL, 2026-09-12. ANOTHER DELIVERED        #
       * # DEFECT, AND THE CLIENT SENT A PHOTOGRAPH OF IT.                 #
       * #                                                                #
       * #   "still include this kind of animation, and adjust it to the  #
       * #    left to make all the text visible"                           #
       * #                                                                #
       * # V50 drew "MEMORY IN THE AFTERLIF" with the final E off the     #
       * # frame. The 32 above passed it at 23 characters, because a      #
       * # COUNT CANNOT CONTROL A WIDTH: 20 Bebas characters span 443 to  #
       * # 1173 px depending on which letters they are. The title needed  #
       * # 868 px of an 823 px panel.                                      #
       * #                                                                #
       * # THE CHARACTER CAPS STAY as the coarse schema bound, which is    #
       * # how `shadowUpFit` sits beside its own. The width is the real    #
       * # gate.                                                           #
       * ##################################################################
       */
      if (!bulletChecklistTitleFits(title)) return null
      const rows = written.lines.filter((row) => row.length > 0 && row.length <= 48)
      if (!rows.every((row) => everyContentWordWasSpoken(row, beat))) return null
      /*
       * ##################################################################
       * # A ROW MUST ALSO FINISH DRAWING, AND THAT IS A SECOND FAULT      #
       * # WEARING THE FIRST ONE'S FACE.                                   #
       * #                                                                #
       * # V50's third row was "What that means for the people waiting".   #
       * # Its ink stops at x=1759, comfortably inside the frame, so it    #
       * # was never clipped — what the client photographed at 1:02 was    #
       * # the per-character reveal still in flight. But it never          #
       * # finished either: 38 slots land its last character at local      #
       * # frame 159.7 of a 134-frame shot, so the word "waiting" was      #
       * # never on screen at any point in the delivered film.             #
       * #                                                                #
       * # A WIDTH GATE ALONE WOULD HAVE FIXED THE WRONG HALF. Both are    #
       * # real, they are different, and only one of them is visible in a  #
       * # screenshot.                                                     #
       * ##################################################################
       */
      /*
       * THE FIRST THREE, BECAUSE THOSE ARE THE ONES DRAWN. The return below
       * slices to 3 and `BULLET_CHECKLIST_ROW_ONSETS` holds exactly 3 onsets,
       * so a fourth row has no start frame and is never on screen. Measuring it
       * would refuse a whole checklist over a row the template ignores, which
       * is what the first version of this gate did — `keeps at most three rows,
       * because the fourth is drawn nowhere` caught it.
       *
       * The two checks ABOVE stay on every row on purpose. They are about what
       * the planner WROTE and whether the film says it; these two are about
       * what the frame can hold.
       */
      const drawn = rows.slice(0, 3)
      if (!drawn.every((row) => bulletChecklistRowFits(row))) return null
      if (
        !drawn.every((row, index) =>
          bulletChecklistRowDrawsInFull(row, index, beat.durationFrames),
        )
      ) {
        return null
      }
      /*
       * AND NO LINE OF IT MAY STOP MID-PHRASE, the title or any row, refused
       * rather than filtered for the reason the box above gives. See
       * `writtenLineStopsMidPhrase`.
       */
      if (writtenLineStopsMidPhrase(title, beat)) return null
      if (rows.some((row) => writtenLineStopsMidPhrase(row, beat))) return null
      /*
       * BELT AND BRACES, AND SAYING SO RATHER THAN IMPLYING OTHERWISE.
       * `SceneDeviceSchema` declares `rows: .min(1).max(3)` and `attempt`
       * safe-parses every copy object before it can be chosen, so an empty
       * checklist is already refused one layer down. This line is here because
       * the arm should read as a complete statement of what it will and will
       * not build — a checklist with no rows is a title — and not because the
       * schema is untrusted. A mutation test on this line stays green for
       * exactly that reason.
       */
      if (rows.length === 0) return null
      /* The same ledger P03 and a3 use — no film prints one display line twice. */
      if (drawnHeadlines.has(normaliseToken(title))) return null
      return { id: 'bullet-checklist', title, rows: drawn }
    }

    /*
     * ######################################################################
     * # SAKU'S 05. ONE LINE OF THE NARRATION'S OWN WORDS, SET STRAIGHT ON    #
     * # THE PHOTOGRAPH WITH A SHADOW AND NOTHING UNDER IT.                   #
     * #                                                                    #
     * # THE PLANNER IS THE ONLY SOURCE, like the checklist's, and every     #
     * # check P03's written pair runs is run here, because the line names   #
     * # what is on screen as plainly as a headline does:                    #
     * #                                                                    #
     * #   spoken      every content word is in the window (T-6, T-18)      #
     * #   whole       it does not stop mid-phrase, see                     #
     * #               `writtenLineStopsMidPhrase`                          #
     * #   a line      at least one word that is not a joining word         #
     * #   width       measured with Bebas's own advances against the       #
     * #               title-safe width, because the line never wraps       #
     * #   no year     T-2 gives a year to P12 or P14, see                 #
     * #               `lineCarriesAYear`                                   #
     * #   ledger      no film prints one display line twice                #
     * #   corroborated  a line that IS a thing the scene names must be     #
     * #               that thing in the picture's archive record          #
     * #                                                                    #
     * # T-8 is applied after this, in `attempt`, through                   #
     * # `copyNamesThePicture`.                                             #
     * ######################################################################
     */
    case 'shadow-up': {
      if (written === null) return null
      const line = written.headline
      if (line === null) return null
      if (!everyContentWordWasSpoken(line, beat)) return null
      if (writtenLineStopsMidPhrase(line, beat)) return null
      if (contentTokens(line).every((token) => JOINING_WORDS.has(token))) return null
      if (line.length > SHADOW_UP_LINE_MAX_CHARS) return null
      if (!shadowUpLineFits(line)) return null
      if (lineCarriesAYear(line)) return null
      if (drawnHeadlines.has(normaliseToken(line))) return null
      const identifies = beat.sceneEntities.some(
        (entity) => normaliseToken(entity) === normaliseToken(line),
      )
      if (identifies && !nameIsCorroborated(line, beat.assetProvenance)) return null
      return { id: 'shadow-up', line }
    }

    /*
     * ######################################################################
     * # P04, THE LOWER-LEFT LABEL. THE PLANNER'S HEADLINE IS THE LABEL AND   #
     * # ITS KICKER IS THE SUPPORT LINE, AND BOTH NAME THE PICTURE.           #
     * #                                                                    #
     * # THE LABEL IS REFUSED unless it passes the ruling, which is all of   #
     * # `p04LineNamesWhatTheShotSays`: spoken in this shot, a name, whole,  #
     * # no year, and confirmed by the archive record. Then:                 #
     * #                                                                    #
     * #   bound     the schema's 32, checked here so the refusal is ours   #
     * #   width     two lines of the 620 px block at most, by Libre        #
     * #             Franklin SemiBold's own advances (`p04Fit.ts`)          #
     * #   ledger    no film prints one display line twice                  #
     * #                                                                    #
     * # THE SUPPORT LINE IS NEVER A REFUSAL. See `p04SupportLine`: it is    #
     * # drawn when it passes the same ruling and fits, and is '' otherwise. #
     * #                                                                    #
     * # T-8 is applied after this, in `attempt`, through                   #
     * # `copyNamesThePicture`, and G14c keeps it off the subject.          #
     * ######################################################################
     */
    case 'P04': {
      if (written === null) return null
      const mainLine = written.headline
      if (mainLine === null) return null
      if (mainLine.length > P04_MAIN_LINE_MAX_CHARS) return null
      if (!p04LineNamesWhatTheShotSays(mainLine, beat)) return null
      if (!p04MainLineFits(mainLine)) return null
      if (drawnHeadlines.has(normaliseToken(mainLine))) return null
      return { id: 'P04', mainLine, supportLine: p04SupportLine(written.kicker, mainLine, beat) }
    }

    /*
     * ######################################################################
     * # P02, THE EDITORIAL CARD. THE PLANNER'S HEADLINE IS THE HEADLINE AND  #
     * # ITS KICKER IS THE LABEL, AND BOTH ARE THE NARRATION'S OWN WORDS.     #
     * #                                                                    #
     * # THE HEADLINE IS REFUSED unless it passes all of                     #
     * # `p02LineIsTheNarrations`: a line, spoken in the window, whole, no   #
     * # year, and corroborated when it is a thing the scene names. Then:    #
     * #                                                                    #
     * #   bound     the schema's 80, checked here so the refusal is ours   #
     * #   width     four lines of the card's 524 px at most, by Libre      #
     * #             Franklin SemiBold's own advances (`p02Fit.ts`)          #
     * #   ledger    no film prints one display line twice                  #
     * #                                                                    #
     * # THE LABEL IS NEVER A REFUSAL. See `p02Label`: it is drawn when it   #
     * # passes the same checks and fits, and is '' otherwise.               #
     * #                                                                    #
     * # T-8 is applied after this, in `attempt`, through                   #
     * # `copyNamesThePicture`, and G14d keeps the card off the subject.    #
     * ######################################################################
     */
    case 'P02': {
      if (written === null) return null
      const headline = written.headline
      if (headline === null) return null
      if (headline.length > P02_HEADLINE_MAX_CHARS) return null
      if (!p02LineIsTheNarrations(headline, beat)) return null
      if (!p02HeadlineFits(headline)) return null
      if (drawnHeadlines.has(normaliseToken(headline))) return null
      return { id: 'P02', label: p02Label(written.kicker, headline, beat), headline }
    }

    /*
     * ######################################################################
     * # P09, THE COMPACT QUESTION CARD. THE PLANNER'S HEADLINE IS THE        #
     * # QUESTION AND ITS KICKER IS THE SECTION LABEL.                        #
     * #                                                                    #
     * # THE QUESTION IS REFUSED unless the narration ASKS it, by the        #
     * # developer's ruling, and it passes P02's checks as well: see         #
     * # `p09QuestionIsTheNarrations`. Then:                                  #
     * #                                                                    #
     * #   bound     the schema's 80, checked here so the refusal is ours   #
     * #   width     three lines of the 650 px measure at most, by Libre    #
     * #             Franklin SemiBold's own advances (`p09Fit.ts`)          #
     * #   ledger    no film prints one display line twice                  #
     * #                                                                    #
     * # THE LABEL IS NEVER A REFUSAL. See `p09SectionLabel`: it is drawn    #
     * # when it passes the same checks and fits, and is '' otherwise.       #
     * #                                                                    #
     * # T-8 is applied after this, in `attempt`, through                   #
     * # `copyNamesThePicture`, and G14e keeps the card off the subject.    #
     * ######################################################################
     */
    case 'P09': {
      if (written === null || written.headline === null) return null
      const question = written.headline.trim()
      if (question.length > P09_QUESTION_MAX_CHARS) return null
      if (!p09QuestionIsTheNarrations(question, beat)) return null
      if (!p09QuestionFits(question)) return null
      if (drawnHeadlines.has(normaliseToken(question))) return null
      return { id: 'P09', sectionLabel: p09SectionLabel(written.kicker, question, beat), question }
    }

    /*
     * ######################################################################
     * # P05, TEXT LEFT AND A PICTURE RIGHT. THE PLANNER'S HEADLINE IS THE    #
     * # CLAIM, ITS KICKER THE EYEBROW, ITS FIRST `lines` ENTRY THE SUPPORT   #
     * # LINE AND ITS SECOND THE LABEL INSIDE THE PICTURE.                    #
     * #                                                                    #
     * # THE HEADLINE IS REFUSED unless it passes all of                     #
     * # `p02LineIsTheNarrations`: a line, spoken in the window, whole, no   #
     * # year, and corroborated when it is a thing the scene names. Then:    #
     * #                                                                    #
     * #   bound     the schema's 48, checked here so the refusal is ours   #
     * #   width     three lines of the 678 px column at most, in capitals, #
     * #             by Libre Franklin SemiBold's own advances (`p05Fit.ts`) #
     * #   ledger    no film prints one display line twice                  #
     * #                                                                    #
     * # NO OTHER LINE IS EVER A REFUSAL. The eyebrow and the support line   #
     * # answer to the same rule, `p05ColumnLine`, and the picture label to  #
     * # the developer's ruling for P04 and P05 labels, `p05ImageLabel`.     #
     * # Each is '' when it fails, and the component omits its block.        #
     * #                                                                    #
     * # T-8 is applied after this, in `attempt`, through                   #
     * # `copyNamesThePicture`, and G14f keeps the subject inside the panel. #
     * ######################################################################
     */
    case 'P05': {
      if (written === null || written.headline === null) return null
      const headline = written.headline.trim()
      if (headline.length > P05_HEADLINE_MAX_CHARS) return null
      if (!p02LineIsTheNarrations(headline, beat)) return null
      if (!p05HeadlineFits(headline)) return null
      if (drawnHeadlines.has(normaliseToken(headline))) return null
      const eyebrow = p05ColumnLine(written.kicker, [headline], beat, P05_EYEBROW_MAX_CHARS, p05EyebrowFits)
      const supportLine = p05ColumnLine(
        written.lines[0],
        [headline, eyebrow],
        beat,
        P05_SUPPORT_LINE_MAX_CHARS,
        p05SupportLineFits,
      )
      const imageLabel = p05ImageLabel(written.lines[1], headline, beat)
      return { id: 'P05', eyebrow, headline, supportLine, imageLabel }
    }

    /*
     * ######################################################################
     * # P14, THE FAST YEAR ODOMETER. THE SAME DETECTOR P12 READS, NARROWED   #
     * # TO THE ONE SHAPE FOUR SPINNING WHEELS CAN DRAW WITHOUT LYING.        #
     * #                                                                    #
     * # A year is a NUMBER, so it is the one mark the aligner cannot        #
     * # misspell, and the planner never writes it — P14 is in                #
     * # `WORDS_COME_FROM_THE_NARRATION` beside P12, so a planner row that    #
     * # carried a headline for it is ignored here and the narration's own    #
     * # mark is used instead. That is what keeps the two year templates      #
     * # fed identically: the planner picks the TEMPO, never the figure.      #
     * #                                                                    #
     * # `bareYear` ONLY, WHERE P12 TAKES `eraFigure` TOO, AND THE            #
     * # DIFFERENCE IS THE COMPONENT. P12 sets its string as type, so         #
     * # "364 CE" draws as "364 CE". P14 rolls four numeric wheels, so its    #
     * # renderer strips every non-digit, keeps the last four and pads with   #
     * # zeroes — "364 CE" would draw as 0364 and "third century BCE" as      #
     * # 0000, each a year nobody said, drawn with total confidence, and      #
     * # invisible to every check downstream because the plan still records   #
     * # the string that was asked for.                                       #
     * #                                                                    #
     * # SO BOTH CONDITIONS ARE LOAD-BEARING AND NEITHER IMPLIES THE OTHER.   #
     * # The detector rules out an era figure; the four-digit test rules out  #
     * # a `bareYear` the detector wrote with anything else attached. When    #
     * # either fails the answer is null, which G14's sibling turns into      #
     * # `copy-not-available` — and on a date beat where P12 can still draw,  #
     * # G15 hands it to P12. A year never falls back to a label.             #
     * #                                                                    #
     * # T-8 DOES NOT APPLY. `copyNamesThePicture` answers false for this,    #
     * # as it does for P12, and the switch says why.                         #
     * ######################################################################
     */
    case 'P14': {
      const date = marks.find(
        (mark) => mark.detector === 'bareYear' && isBareFourDigitYear(mark.text),
      )
      if (date === undefined) return null
      return { id: 'P14', year: date.text, label: '', detail: '' }
    }

    /* Every remaining device is disabled and G1 refuses it before we get here. */
    /*
     * ######################################################################
     * # NIKU'S SECOND CHAPTER STYLE. IT TAKES `editorialTitle` AND NOTHING  #
     * # ELSE, AND THAT SINGLE LINE IS THE WHOLE REASON IT MAY BE ENABLED.   #
     * #                                                                    #
     * # Read a3's arm above. It reads                                       #
     * #                                                                    #
     * #     beat.editorialTitle ?? written?.headline ?? null                #
     * #                                                                    #
     * # and that SECOND arm is why `chapter-title` was switched on for one  #
     * # morning in `194fb40` and switched straight back off the same        #
     * # evening. When the dossier anchors no heading to the beat it falls   #
     * # through to the visual planner's OWN invented headline, and nothing  #
     * # between there and the screen asks whether the narration ever said   #
     * # it. On job d421138e both cards took that arm: scene 24 drew "Three  #
     * # sections", scene 56 drew "Not symmetric", the pipeline's own T-19   #
     * # sheet logged both as lines "the narration does not say", and the    #
     * # client watched the first and wrote that it "did not related in any".#
     * # His rule 2 forbids inventing chapter names, so that is a rule       #
     * # violation and not a tuning choice.                                  #
     * #                                                                    #
     * # `devices.test.ts` states the remedy in as many words: "an admission #
     * # path that takes ONLY `beat.editorialTitle`, refusing the beat       #
     * # outright when the dossier anchors no spoken heading to it". That is #
     * # this arm. There is deliberately no `??` here, and adding one would  #
     * # re-open a defect the client has already complained about once.      #
     * #                                                                    #
     * # a3 IS LEFT EXACTLY AS IT IS. It is `PLACED_BY_OPERATOR_ONLY`, so a  #
     * # person reads its copy before it can reach a frame, and that person  #
     * # is the check this arm does in code.                                 #
     * ######################################################################
     */
    case 'chapter-plate': {
      const title = beat.editorialTitle
      if (title === null) return null

      const heading = title.trim()
      if (heading.length === 0 || heading.length > CHAPTER_PLATE_MAX_CHARS) return null

      /*
       * THE SIZE GATE, AND IT IS NOT THE CHARACTER BOUND. The bound above is
       * the shape of the copy; this is whether the words can be DRAWN.
       *
       * ##################################################################
       * # IT USED TO BE A WIDTH GATE AND THE CLIENT OVERRULED IT ON      #
       * # 2026-09-16: "Shrink long titles to fit. I would say maximum 25 #
       * # character titles might be good limit."                         #
       * #                                                                #
       * # So an over-wide heading is now SET SMALLER rather than thrown  #
       * # away, and this refuses only what would have to go below        #
       * # `CHAPTER_PLATE_MIN_CAP_HEIGHT_PX`, the size under which the    #
       * # film's largest mark stops reading as one. Still never          #
       * # truncates, for a3's own stated reason: a cut client heading is #
       * # a different claim.                                             #
       * #                                                                #
       * # ON THE DELIVERED FILM THIS IS WORTH ONE CHAPTER PLATE. Beat    #
       * # 133, "Looking for someone", measures 1822.83 px against the    #
       * # 1728 px box and was refused here; it now draws at 94.80% of    #
       * # the settled size. `apps/worker/scripts/device-replay.ts` over  #
       * # job c75d51e6 is where that was measured, before and after.     #
       * ##################################################################
       */
      if (!chapterPlateHeadingFits(heading)) return null

      /* One display line, once per film. The same ledger a3 writes to. */
      if (drawnHeadlines.has(normaliseToken(heading))) return null
      /*
       * ##################################################################
       * # NO DEPTH ON THE COPY. A `washAlpha` was written here for one    #
       * # day, first as the registry cap and then solved per shot from    #
       * # this shot's own pixels, and the band it set the depth of is     #
       * # gone. The heading's ground travels on its own glyphs now, at a  #
       * # blur fitted to the size the heading is set at, so there is      #
       * # nothing per-shot for the plan to carry and nothing for the      #
       * # frame to honour. `corner-label` has been in that position since #
       * # the same day and writes no depth either.                        #
       * ##################################################################
       */
      return { id: 'chapter-plate', heading }
    }

    /*
     * ######################################################################
     * # NIKU'S TOP-LEFT TITLE. THE PLANNER'S LINE, HELD TO THE NARRATION.   #
     * #                                                                    #
     * # Unlike the chapter plate this is not a section heading, so there is #
     * # no `editorialTitle` to read. It takes the planner's headline and    #
     * # puts it through `p02LineIsTheNarrations` — spoken in the window,    #
     * # whole, no invented year, corroborated when it names a thing — which #
     * # is the same bar P02, P05 and shadow-up already clear.               #
     * #                                                                    #
     * # THE SECOND LINE IS NEVER A REFUSAL. It answers the same rule and is #
     * # '' when it fails, and `TopTitle` omits its block. That is the house #
     * # shape: one required slot decides the device, the rest degrade.      #
     * ######################################################################
     */
    case 'top-title': {
      if (written === null || written.headline === null) return null

      const line1 = written.headline.trim()
      if (line1.length === 0 || line1.length > TOP_TITLE_MAX_CHARS) return null
      if (!p02LineIsTheNarrations(line1, beat)) return null
      if (!topTitleLine1Fits(line1)) return null
      if (drawnHeadlines.has(normaliseToken(line1))) return null

      const candidate = (written.lines[0] ?? '').trim()
      const line2 =
        candidate.length > 0 &&
        candidate.length <= TOP_TITLE_MAX_CHARS &&
        p02LineIsTheNarrations(candidate, beat) &&
        topTitleLine2Fits(candidate)
          ? candidate
          : ''

      return { id: 'top-title', line1, line2 }
    }

    /*
     * ######################################################################
     * # NIKU'S TOP-RIGHT CORNER LABEL. IT SAYS WHAT THE PICTURE IS, SO IT   #
     * # ANSWERS TO THE SAME RULE P04'S LABEL DOES.                          #
     * #                                                                    #
     * # MEASURED IN CAPITALS, because `CornerLabel` upper-cases both slots  #
     * # before drawing them. Measuring as typed under-predicts badly — a3's #
     * # own recorded failure is "The Memory Passages" fitting at 1896 px    #
     * # while "THE MEMORY PASSAGES" is 2075 px and does not. The fit module #
     * # upper-cases for us; this arm must not pre-upper-case, or the copy   #
     * # stored in the plan stops being the copy the planner wrote.          #
     * #                                                                    #
     * # THE KICKER IS NEVER A REFUSAL, same shape as the top title.         #
     * ######################################################################
     */
    case 'corner-label': {
      if (written === null || written.headline === null) return null

      const label = written.headline.trim()
      if (label.length === 0 || label.length > CORNER_LABEL_MAX_CHARS) return null
      if (!p02LineIsTheNarrations(label, beat)) return null
      if (!cornerLabelLabelFits(label)) return null
      if (drawnHeadlines.has(normaliseToken(label))) return null

      const candidate = (written.kicker ?? '').trim()
      const kicker =
        candidate.length > 0 &&
        candidate.length <= CORNER_LABEL_KICKER_MAX_CHARS &&
        p02LineIsTheNarrations(candidate, beat) &&
        cornerLabelKickerFits(candidate)
          ? candidate
          : ''

      /*
       * ##################################################################
       * # AND THE SHOT MUST OUTLAST THE BUILD THESE PARTICULAR WORDS      #
       * # MAKE, WHICH G3 CANNOT ASK BECAUSE THE WORDS DO NOT EXIST YET.   #
       * #                                                                 #
       * # G3 compares the shot against `buildEndFrames`, and for this     #
       * # device that is 101 — `settle(18, 14)`, the longest copy the     #
       * # schema admits. It is the only honest number to hold a shot to   #
       * # BEFORE the caption is written, and it is far too pessimistic    #
       * # once it IS: on job c75d51e6 it refuses 103 of 164 shots, and    #
       * # the caption the planner actually wrote, "Stuckenbruck" over     #
       * # "Cosmology", finishes at frame 79 and would have fitted 132.    #
       * #                                                                 #
       * # STRICTLY GREATER. `cornerLabelFinishesInside` carries the       #
       * # reason: a hard step at `frame >= slot` over a 0-based frame     #
       * # counter means a settle of exactly N never draws on an N-frame   #
       * # shot. That is how "COSMOLOGY" shipped as "COSMOLOG".            #
       * #                                                                 #
       * # THE KICKER DEGRADES AND THE LABEL DOES NOT. Dropping the second #
       * # line is the same "one required slot decides the device, the     #
       * # rest degrade" shape `top-title` above already uses, and it is   #
       * # what takes this device from 61 usable shots to 161. It is a     #
       * # visual decision on the client's own design, so it sits behind   #
       * # `CORNER_LABEL_KICKER_MAY_DEGRADE` until he rules on it.         #
       * ##################################################################
       */
      if (cornerLabelFinishesInside(beat.durationFrames, label, kicker)) {
        return { id: 'corner-label', label, kicker }
      }
      if (
        CORNER_LABEL_KICKER_MAY_DEGRADE &&
        kicker.length > 0 &&
        cornerLabelFinishesInside(beat.durationFrames, label, '')
      ) {
        return { id: 'corner-label', label, kicker: '' }
      }
      return null
    }

    default:
      return null
  }
}

/* ------------------------------------------------------------------------- */
/* What the beat is DOING                                                      */
/* ------------------------------------------------------------------------- */

/**
 * The beat's narrative job, derived from evidence already in the plan.
 *
 * ##########################################################################
 * # DERIVED, NOT ASKED. The alternative was a new field on the             #
 * # segmentation call, which costs a prompt-version bump, a full re-bill   #
 * # of segmentation on the client's script, and a non-deterministic answer #
 * # in a function whose determinism the render key depends on. Every       #
 * # signal below is already in the frozen plan, so this is free, stable    #
 * # and testable.                                                          #
 * #                                                                        #
 * # IT RETURNS A LIST, not a single job, because a beat that names a       #
 * # manuscript AND says a year is honestly doing two things and the score  #
 * # should be allowed to weigh both.                                       #
 * ##########################################################################
 */
export function narrativeJobsOf(beat: DeviceBeat): NarrativeJob[] {
  const marks = usableMarks(beat)
  const jobs: NarrativeJob[] = []

  const dates = marks.filter((mark) => DATE_DETECTORS.has(mark.detector))
  const distinct = new Set(marks.map((mark) => normaliseToken(mark.text)))
  const names = marks.some((mark) => namesAThing(mark, beat))

  /*
   * WHAT THE SEGMENTER SAYS THIS BEAT IS ABOUT, WHICH IS A DIFFERENT AND
   * WEAKER CLAIM THAN `distinct` ABOVE, AND FOR THE NO-COPY DEVICES IT IS THE
   * RIGHT ONE.
   *
   * ##########################################################################
   * # `distinct` COUNTS MARKS THAT SURVIVED THE ANTI-MISSPELLING FILTER —    #
   * # heard by the aligner inside this shot AND spelled the way the script    #
   * # spells them. That filter exists because a mark becomes TEXT ON SCREEN   #
   * # under a real scholar's name, and it is right for every device that      #
   * # draws words.                                                            #
   * #                                                                        #
   * # P22, P19 AND gallery-strip DRAW NO WORDS AT ALL. Their whole contract   #
   * # is four photographs; P22's registry entry calls it "the only device of  #
   * # the twenty-two that needs NO written copy", and gallery-strip's badges #
   * # are ordinals it generates from the card index. Holding them to a        #
   * # spelling test for text they never set is a gate protecting nothing.     #
   * #                                                                        #
   * # AND IT WAS THE GATE THAT ACTUALLY BOUND THEM, WHICH IS NOT WHAT THE     #
   * # REFUSAL REPORT SAID. Over the real 118 beats they were refused on       #
   * # `not-enough-pictures` 87 times each, so picture supply looked like the  #
   * # whole story. Handed three companions on EVERY pictured beat, the        #
   * # placement count did not move by one: `four_source_mosaic` was in the    #
   * # jobs of exactly ONE beat of 118, because only 32 beats carry any usable #
   * # mark at all and three distinct ones is nearly unreachable. Supply was   #
   * # necessary and it was never sufficient.                                  #
   * #                                                                        #
   * # `Scene.entities` IS THE HONEST EVIDENCE HERE. It is the segmenter's own #
   * # list of what this beat names, and it is THE SAME LIST THE PICTURES WERE #
   * # SOURCED AGAINST — so a beat whose segmenter named three things and      #
   * # which owns four ranked photographs is a four-source beat by both        #
   * # judgements at once. Nothing is spelled, so nothing can be misspelled.   #
   * ##########################################################################
   */
  const namedInScene = distinctThings(beat.sceneEntities)
  /*
   * AND IT HAS TO ACTUALLY HAVE THE FOUR PICTURES, WHICH IS THE HALF THAT
   * KEEPS THIS ORDERING SAFE.
   *
   * ##########################################################################
   * # THESE TWO JOBS SIT FIRST IN THE LIST, SO EVERYTHING THEY FIRE ON GETS   #
   * # DEMOTED. `score` reads the INDEX: first place is 1000, second 800,      #
   * # anything later 600. A job that fired on most beats would push           #
   * # `single_word_or_number_emphasis` from 1000 down to 600 — level with     #
   * # photo-pop, which then wins the tie on `sourceProtection` by 6,000       #
   * # points. Measured, a bare entity-count test flipped P03 beats to         #
   * # photo-pop, which is the monoculture this whole change exists to avoid.  #
   * #                                                                        #
   * # Requiring the pictures keeps the claim rare AND makes it true: "this    #
   * # beat is a four-source mosaic" is partly a statement about having four   #
   * # sources. It is not circular with G2 — G2 refuses a device that cannot   #
   * # be drawn, this decides whether the beat is asking for one.              #
   * ##########################################################################
   */
  const hasFourPictures = beat.hasOwnAsset && beat.companionCount >= 3

  /*
   * ##########################################################################
   * # ORDERED MOST-CONSTRAINED FIRST, AND THE ORDER IS THE WHOLE SCORE.      #
   * #                                                                        #
   * # `score` reads the INDEX of a device's job in this list — first place    #
   * # scores 1000, second 800, anything later 600 — against the partner's     #
   * # heaviest weight, `narrativeJob` at 0.35. So this ordering decides more  #
   * # than the other six terms put together.                                 #
   * #                                                                        #
   * # IT USED TO BE THE ORDER I HAPPENED TO WRITE THE IFS IN, and that put    #
   * # `source_inspection` — which fires on ANY named thing or ANY wide shot,  #
   * # the loosest condition in the file — ABOVE                              #
   * # `single_word_or_number_emphasis`, which needs two marks. The catch-all  #
   * # therefore beat the specific device on nearly every beat, so the         #
   * # highlight and the callout almost never won and the film carried one     #
   * # treatment from end to end. That is the defect the client reported, and  #
   * # this ordering is its actual cause.                                      #
   * #                                                                        #
   * # THE RULE NOW: a job that is harder to satisfy sits earlier. Three       #
   * # ordered dates is a stronger claim about a beat than one date; one date  #
   * # is stronger than two marks; two marks is stronger than "something is    #
   * # named"; and "a picture worth looking at" is the weakest of all, so it   #
   * # goes last and wins only when nothing better applies. That is a          #
   * # property of the CONDITIONS, checkable by reading them, rather than a    #
   * # preference between templates.                                          #
   * ##########################################################################
   */

  /* Three ordered dates: the narrowest condition here. */
  if (dates.length >= 3) jobs.push('ordered_dates_or_eras')

  /*
   * Three distinct named things, which is a claim about how they relate — from
   * the marks when they carry it, and otherwise from the segmenter's own list
   * plus four real photographs. See the two boxes above for why the second
   * route is honest for these devices and would not be for any other.
   */
  if (distinct.size >= 3 || (namedInScene >= 3 && hasFourPictures)) {
    jobs.push('connected_three_source_evidence')
    jobs.push('four_source_mosaic')
  }

  /*
   * THE SHOT COUNTS ITS OWN THINGS. See the box on `COUNTED_PLURALS`.
   *
   * The count chooses the family, because the count IS the claim: two things
   * set against each other is a comparison, three tied together is the board,
   * four surveyed is the mosaic. Nothing here asks whether the pictures exist —
   * that is what the gates are for, and keeping this rule about the MOMENT
   * rather than the supply is what lets the report say "the standard matched
   * and we could not draw it", which is the sentence nobody could write before.
   *
   * SECOND, NEVER FIRST. `dates` and three named things are stronger claims and
   * keep their positions, so a shot that satisfies both is unchanged.
   */
  const counted = countedThingsIn(beat.text)
  if (
    (counted === 2 || narrationComparesThings(beat.text)) &&
    !jobs.includes('comparison')
  ) {
    jobs.push('comparison')
  }
  if (counted === 3 && !jobs.includes('connected_three_source_evidence')) {
    jobs.push('connected_three_source_evidence')
  }
  if (counted === 4 && !jobs.includes('four_source_mosaic')) jobs.push('four_source_mosaic')

  /* One verified date. A figure, and the one mark ASR cannot misspell. */
  if (dates.length >= 1) jobs.push('single_historical_date')

  /*
   * Two marks, so there is a phrase with something in it worth emphasising.
   *
   * ##########################################################################
   * # OR ONE CHAPTER CITATION AND A WORK TO SET IT AGAINST, WHICH IS THE     #
   * # CLIENT'S OWN RULE AND NOT A LOOSENING OF THIS ONE.                     #
   * #                                                                        #
   * # The two-mark test exists because `P03.tsx` always renders its kicker,  #
   * # so a beat with one quotable phrase has nothing to put there. A chapter #
   * # beat on a film with a dossier is the one case where the second string  #
   * # is known without inventing it — see `DeviceBeat.editorialKicker`.      #
   * #                                                                        #
   * # BOTH HALVES ARE REQUIRED. `editorialKicker` alone is not enough: every #
   * # beat in a dossiered film carries it, and pushing on that would hand    #
   * # `single_word_or_number_emphasis` to the whole film. The `section`      #
   * # detector is what makes this a chapter beat, and it is the one detector #
   * # whose text is a citation rather than a name.                           #
   * #                                                                        #
   * # AND `buildCopy` STILL DECIDES. This only lets P03 be CONSIDERED; the   #
   * # width check, the repeated-headline check and the T-18 fallback order   #
   * # in `buildP03` all still run and can still refuse.                      #
   * ##########################################################################
   */
  const citesASection = marks.some((mark) => mark.detector === 'section')
  if (marks.length >= 2 || (citesASection && beat.editorialKicker !== null)) {
    jobs.push('single_word_or_number_emphasis')
  }

  /* Something is named, so there is a thing a line could point at. */
  if (names) jobs.push('one_named_detail')

  /*
   * THE CATCH-ALL, AND IT IS LAST ON PURPOSE. Any named thing or any wide shot
   * qualifies, so it is true of most beats that qualify for anything, and a
   * device claiming it should win only when nothing more specific fits.
   */
  if (names || beat.shotScale === 'wide') jobs.push('source_inspection')

  /*
   * ##########################################################################
   * # THE JOB `chapter-title` DECLARES, AND NOTHING HAS EVER PUSHED IT.      #
   * #                                                                        #
   * # a3 has been `enabled: true` since 2026-08-28 and has drawn ZERO frames #
   * # in every film ever rendered, because G14 refuses any device whose job  #
   * # is absent from this list. This is the first of the three reasons.      #
   * #                                                                        #
   * # KEYED ON THE PRODUCER'S OUTPUT, NOT ON A `section` MARK, and that is   #
   * # the whole design. `editorialTitle` is null on every beat until a       #
   * # producer fills it, so this line emits nothing today and the change is  #
   * # provably frame-identical. A mark-keyed push would instead fire on      #
   * # every beat that merely SPEAKS a section mention, which is a different  #
   * # and much larger set, and would change films before any title existed.  #
   * #                                                                        #
   * # LAST, AND THE POSITION IS ARITHMETIC RATHER THAN TASTE. `score` reads  #
   * # a device's INDEX in this array against Saku's heaviest weight, and it  #
   * # squashes the rank into three buckets — index 0, index 1, index 2 or    #
   * # later. Appending therefore cannot change any other device's score on   #
   * # any beat. Inserting first would cost the incumbent top two devices     #
   * # thousands of points on every titled beat, and P03's real margin over   #
   * # photo-pop on scene 0 is thin enough that one variety hit flips it.     #
   * ##########################################################################
   */
  if (beat.editorialTitle !== null) jobs.push('section_turn')

  /*
   * ##########################################################################
   * # THE VISUAL PLANNER'S JOB, AND IT IS APPENDED RATHER THAN PROMOTED.     #
   * #                                                                        #
   * # G14 refuses any device whose declared job is absent from this list, and #
   * # the list is built entirely from marks the aligner heard IN THIS SHOT.   #
   * # Four of the twelve narrative jobs are therefore never emitted at all,   #
   * # so four templates were unreachable however well they fitted the         #
   * # narration. That is the mechanical half of "most of the library still    #
   * # seems unused". This line is the only way a job can enter the list from  #
   * # something that read more than one beat.                                 #
   * #                                                                        #
   * # LAST, AND THE POSITION IS ARITHMETIC RATHER THAN TASTE — the same       #
   * # argument the `section_turn` box above makes. `score` reads a device's   #
   * # INDEX here and squashes it into three buckets, so appending cannot      #
   * # change any other device's score on any beat, while inserting first      #
   * # would silently cost every incumbent thousands of points on every        #
   * # planned beat. The planner's force comes from `PLANNED_BONUS` instead,   #
   * # where it is one named number that can be read and argued with.          #
   * #                                                                        #
   * # A JOB THE BEAT ALREADY CLAIMS IS NOT ADDED TWICE. `jobs.indexOf` reads  #
   * # the FIRST occurrence, so a duplicate would be harmless today and would  #
   * # be a trap the moment anything counted this array.                       #
   * ##########################################################################
   */
  /*
   * OPTIONAL CHAINING RATHER THAN `!== null`, and it is not defensive padding.
   * `DeviceBeat` is a plain type with no parse at this boundary, so a hand-built
   * beat that predates the field arrives with `plannedTemplate: undefined` — and
   * `undefined !== null` is TRUE, which reads `.templateId` off nothing and
   * takes down the whole chooser. Caught by 74 tests going red at once while
   * this was being written.
   */
  const plannedHere = beat.plannedTemplate ?? null
  const plannedJob =
    plannedHere === null ? null : (DEVICE_REGISTRY[plannedHere.templateId]?.job ?? null)
  if (plannedJob !== null && !jobs.includes(plannedJob)) jobs.push(plannedJob)

  return jobs
}

/* ------------------------------------------------------------------------- */
/* The gates                                                                   */
/* ------------------------------------------------------------------------- */

type GateState = {
  used: Map<DeviceId, number>
  /**
   * WHICH DEVICE SITS ON WHICH BEAT, keyed by the beat's own index.
   *
   * ######################################################################
   * # THIS REPLACED A `recent` LIST AND A `lastChosen` PAIR, AND THE      #
   * # REASON IS THAT BOTH OF THEM RECORDED WALK ORDER RATHER THAN FILM    #
   * # ORDER. While the chooser visited beats front to back the two were   #
   * # the same thing, so nothing was ever wrong; the moment the walk is   #
   * # spaced instead (see `spacedOrder`) they come apart, and a rule      #
   * # about the ADJACENT SHOT that silently reads "the previous decision" #
   * # stops being the rule anybody wrote down.                            #
   * #                                                                     #
   * # "IMMEDIATELY" MEANS THE ADJACENT SHOT, NOT THE PREVIOUS CHOICE, AND #
   * # THE DIFFERENCE IS NOT COSMETIC. Written as "the previous choice",   #
   * # the gate never advances on a beat that chooses nothing — so in a    #
   * # film where one device is the only candidate it places once and is   #
   * # refused on every later beat forever, however far apart they are.    #
   * # That silently caps the device the client declared uncapped. A map   #
   * # keyed by index answers "what is on the shot next door" directly and #
   * # gives the same answer whatever order the shots were decided in.     #
   * ######################################################################
   */
  placedAt: Map<number, DeviceId>
  /**
   * Normalised headlines this film has already set, so no two frames carry the
   * same display line. Grows only when a device is actually chosen, and it is
   * a film-wide set rather than a sequence, so the walk order cannot touch it.
   */
  drawnHeadlines: Set<string>
  totalBeats: number
}

/*
 * The band template 05's line covers, as fractions of the frame. The line sits
 * at rows 924 to 1020 of 1080, centred, and may run to the title-safe edges.
 * See G14b.
 */
const SHADOW_UP_SUBJECT_MIN_Y = 0.8
const SHADOW_UP_SUBJECT_MAX_OFFSET_X = 0.35

/** Is the subject's centre in the band 05's line covers? The 0.5/0.5 sentinel and a null anchor are no subject. */
function subjectSitsUnderTheLine(anchor: DeviceBeat['subjectAnchor']): boolean {
  if (anchor === null) return false
  if (anchor.x === 0.5 && anchor.y === 0.5) return false
  return (
    anchor.y >= SHADOW_UP_SUBJECT_MIN_Y &&
    Math.abs(anchor.x - 0.5) <= SHADOW_UP_SUBJECT_MAX_OFFSET_X
  )
}

/*
 * The corner P04's label covers, as fractions of the frame. The block starts
 * 138 px from the left and may run 620 px, so it ends at x 758 (0.395). Its foot
 * is 112 px above the bottom, y 968 (0.896). With the tallest label the width
 * gate allows, a two-line label and a support line, a still measured the rule's
 * top row at y 814 (0.754) and the support line's last ink at y 962
 * (tmp/v53/templates/P04/measure-p04-contrast.out.txt). See G14c.
 */
const P04_SUBJECT_MIN_Y = 0.72
const P04_SUBJECT_MAX_X = 0.45

/** Is the subject's centre in the corner P04's label covers? The 0.5/0.5 sentinel and a null anchor are no subject. */
function subjectSitsUnderTheLabel(anchor: DeviceBeat['subjectAnchor']): boolean {
  if (anchor === null) return false
  if (anchor.x === 0.5 && anchor.y === 0.5) return false
  return anchor.y >= P04_SUBJECT_MIN_Y && anchor.x <= P04_SUBJECT_MAX_X
}

/*
 * The band P02's card covers, as fractions of the frame. The card starts 170 px
 * from the left and is 650 px wide, so it ends at x 820 (0.427), and its shadow
 * reaches a little further right. It is centred on the frame's height, so its
 * height sets its top and bottom: with a label and the four-line headline the
 * width gate allows, a still measured the paper from y 316 to y 764 (0.293 to
 * 0.707). See G14d.
 */
const P02_SUBJECT_MAX_X = 0.47
const P02_SUBJECT_MIN_Y = 0.26
const P02_SUBJECT_MAX_Y = 0.74

/** Is the subject's centre in the band P02's card covers? The 0.5/0.5 sentinel and a null anchor are no subject. */
function subjectSitsUnderTheCard(anchor: DeviceBeat['subjectAnchor']): boolean {
  if (anchor === null) return false
  if (anchor.x === 0.5 && anchor.y === 0.5) return false
  return anchor.x <= P02_SUBJECT_MAX_X && anchor.y >= P02_SUBJECT_MIN_Y && anchor.y <= P02_SUBJECT_MAX_Y
}

/*
 * The band P09's card covers, as fractions of the frame. The card starts 150 px
 * from the left and is 760 px wide, so it ends at x 910 (0.474), and its shadow
 * reaches a little further right. It is pinned by its TOP at y 335 (0.310) and
 * grows down, so its height sets only its bottom: with a label and the
 * three-line question the width gate allows, a still measured its gold border
 * from y 335 to y 644 (0.310 to 0.596)
 * (tmp/v53/templates/P09/measure-p09-stills.out.txt). See G14e.
 */
const P09_SUBJECT_MAX_X = 0.52
const P09_SUBJECT_MIN_Y = 0.28
const P09_SUBJECT_MAX_Y = 0.63

/** Is the subject's centre in the band P09's card covers? The 0.5/0.5 sentinel and a null anchor are no subject. */
function subjectSitsUnderTheQuestionCard(anchor: DeviceBeat['subjectAnchor']): boolean {
  if (anchor === null) return false
  if (anchor.x === 0.5 && anchor.y === 0.5) return false
  return anchor.x <= P09_SUBJECT_MAX_X && anchor.y >= P09_SUBJECT_MIN_Y && anchor.y <= P09_SUBJECT_MAX_Y
}

/*
 * The band of the picture P05's square panel keeps on screen, as fractions of
 * the picture's width. The picture is drawn at cover in a 746 px square, so a
 * 16:9 picture shows its middle 746 of 1,326 px, 0.219 to 0.781. The push to
 * 1.04 and the 8 px drift narrow what stays on screen for the WHOLE shot to
 * 0.235 to 0.770. The full height is kept, so nothing is cut on y. See G14f.
 */
const P05_SUBJECT_MIN_X = 0.25
const P05_SUBJECT_MAX_X = 0.75

/** Would P05's square panel crop the subject's centre away? The 0.5/0.5 sentinel and a null anchor are no subject. */
function subjectFallsOutsideThePanel(anchor: DeviceBeat['subjectAnchor']): boolean {
  if (anchor === null) return false
  if (anchor.x === 0.5 && anchor.y === 0.5) return false
  return anchor.x < P05_SUBJECT_MIN_X || anchor.x > P05_SUBJECT_MAX_X
}

/*
 * The corner P14's year covers, as fractions of the frame. The block is pinned
 * by its TOP at y 112 and its RIGHT at x 132, and it is 600 px wide, so it
 * spans x 1188 to 1788 (0.619 to 0.931). Its 46 px entrance slide starts it
 * further right, never further left, so the left edge above is the whole shot's.
 *
 * With the label and the caption both empty, which is every frame Rung 1 draws,
 * the block is the four 126 px digit columns plus a 17 px margin and a 4 px
 * rule. Stills measured the digits' ink from y 124 to y 223 and the rule's four
 * rows at y 255 to 258, spanning x 1358 to 1787
 * (tmp/v53/templates/P14/measure-p14-stills.out.txt and
 * measure-p14-ceiling.out.txt). So the drawn block is x 1358 to 1787 and y 124
 * to 258: 0.707 to 0.931 across, 0.115 to 0.239 down.
 *
 * The band below is rounded OUTWARD from that, to x 0.60 and y 0.27, and the
 * extra room on x is deliberate rather than slack. The block's own measure is
 * 600 px wide, from x 1188 (0.619), and two things live in the empty left part
 * of it: the 46 px entrance slide, and the label the pack puts above the digits.
 * A subject at 0.65 is under nothing today and under the label the day one is
 * ever fed, and the difference between those two is not worth a picture. See
 * G14g.
 */
const P14_SUBJECT_MIN_X = 0.60
const P14_SUBJECT_MAX_Y = 0.27

/** Is the subject's centre in the corner P14's year covers? The 0.5/0.5 sentinel and a null anchor are no subject. */
function subjectSitsUnderTheYear(anchor: DeviceBeat['subjectAnchor']): boolean {
  if (anchor === null) return false
  if (anchor.x === 0.5 && anchor.y === 0.5) return false
  return anchor.x >= P14_SUBJECT_MIN_X && anchor.y <= P14_SUBJECT_MAX_Y
}

/**
 * DOES G18 STAND THIS DEVICE DOWN WHERE A SPOKEN TREATMENT CAN PRINT THE BEAT'S
 * SECTION MENTION?
 *
 * One predicate, read by G18 and by `sectionBeatClaimsWords`, so the gate and
 * the probe that feeds it cannot disagree about which devices it covers. Three
 * kinds: a device with no photograph, whose heading is our own prose, and
 * template 05 and P04, whose lines the planner chose. Review C1.
 *
 * P04 FOR 05's REASON. A P04 asked for on a chapter beat would beat the spoken
 * P03 on the planner's bonus alone, and T-1 gives chapters to P03. A label is a
 * T-4 treatment, never a title, so it stands down exactly where a spoken P03
 * prints the mention and costs nothing where P03 cannot draw.
 *
 * P02 FOR THE SAME REASON. Its pack card names "section turn" among its uses,
 * and its headline is the planner's. On a chapter beat a spoken P03 prints the
 * mention in the narrator's own words, which T-1 asks for and T-18 condition 1
 * prefers, so P02 stands down there and keeps every beat P03 cannot draw.
 *
 * P09 AS WELL. Its pack card names "section reset" among its uses and its label
 * is the planner's, so on a chapter beat it would beat the spoken P03 on the
 * planner's bonus alone. A question card is never T-1 coverage, so it stands
 * down where a spoken P03 prints the mention, and keeps every other beat.
 *
 * P05 FOR P02's REASON. Its headline, eyebrow and support line are the
 * planner's, so on a chapter beat it would beat the spoken P03 on the planner's
 * bonus alone. A claim beside a picture is never T-1 coverage, so it stands down
 * where a spoken P03 prints the mention, and keeps every other beat.
 */
function standsDownToSpokenWords(spec: DeviceSpec): boolean {
  return (
    spec.pictures === 0 ||
    spec.id === 'shadow-up' ||
    spec.id === 'P04' ||
    spec.id === 'P02' ||
    spec.id === 'P09' ||
    spec.id === 'P05'
  )
}

/**
 * Every hard refusal, in order, returning the FIRST that fires.
 *
 * A gate is a fact about this pipeline or a rule somebody wrote down. Nothing
 * here is a preference — preferences are in the score.
 */
/**
 * What G3 should really hold this beat to, which for one device is not
 * `buildEndFrames`.
 *
 * ##########################################################################
 * # G3 ASKS ITS QUESTION BEFORE THE COPY EXISTS, AND FOR `corner-label`     #
 * # THAT MADE THE DEVICE UNREACHABLE. THIS IS THE WHOLE BUG.                #
 * #                                                                         #
 * # `corner-label` types on character by character, so its build length is  #
 * # a function of the CAPTION, not of the device. `buildEndFrames` is 101,  #
 * # which is `settle(18, 14)`, the longest caption the schema admits. That  #
 * # is the only honest number to hold a shot to when the caption is not yet #
 * # known, and it is far too pessimistic once it is.                        #
 * #                                                                         #
 * # Measured on job c75d51e6, over its own 164 shots:                       #
 * #                                                                         #
 * #     schema maximum, 18 + 14        101 frames      61 shots fit         #
 * #     what the planner really wrote   79 frames     132 shots fit         #
 * #     the label alone, no kicker      43 frames     161 shots fit         #
 * #                                                                         #
 * # So the script was never too short. G3 refused 103 of 164 shots, the     #
 * # copy arm below was never reached on a single one of them, and the       #
 * # device drew ZERO in a delivered film the client has since approved.     #
 * #                                                                         #
 * # THE ARM ALONE COULD NOT FIX IT. `refuse` runs before `attempt`, so a    #
 * # copy-aware check inside `buildCopy` is unreachable on exactly the shots #
 * # it was written to rescue. The question has to be asked HERE, and it     #
 * # can be, because the planner's row is already on the beat.               #
 * #                                                                         #
 * # EVERY OTHER DEVICE IS ASKED THE IDENTICAL QUESTION IT WAS ASKED BEFORE. #
 * # The narrowing is by `spec.id`, not by a shape test, so a second typing  #
 * # device added later does NOT silently inherit this and keeps the safe    #
 * # worst-case floor until somebody opts it in deliberately.                #
 * #                                                                         #
 * # AND 101 STILL STANDS AS THE FLOOR WHENEVER THE COPY IS UNKNOWN — no     #
 * # planner row, a row for another template, or a row with no headline. DO  #
 * # NOT lower `buildEndFrames` itself toward 54 instead. 54 is the LABEL's  #
 * # settle rather than the DEVICE's, and it is what cut "COSMOLOGY" to      #
 * # "COSMOLOG" in a film that shipped. Three tests from commit 10b0bab      #
 * # refuse that and are still green.                                        #
 * #                                                                         #
 * # `cornerLabelShotIsLongEnough` is shared with the seater in              #
 * # `visualPlan.ts` and with the copy arm, so the three cannot drift into   #
 * # admitting a shot one of the others refuses. It is STRICTLY GREATER on   #
 * # purpose: the reveal is a hard step at `frame >= slot` over a 0-based    #
 * # frame counter, so a settle of exactly N never draws on an N-frame shot. #
 * ##########################################################################
 */
function cornerLabelAwareBuildFloor(spec: DeviceSpec, beat: DeviceBeat): number {
  if (spec.id !== 'corner-label') return spec.buildEndFrames

  const written = plannerWords(spec, beat)
  if (written === null || written.headline === null) return spec.buildEndFrames

  /*
   * A FLOOR rather than a boolean, so G3 stays the single comparison it has
   * always been and no other device's path grows a branch.
   *
   * 0 means "the shared check already said yes, so G3 has nothing left to
   * refuse on duration". It is not a magic number standing in for a length:
   * the length question was asked and answered one line above, by the same
   * function the seater and the copy arm ask.
   */
  return cornerLabelShotIsLongEnough(beat.durationFrames, written.headline, written.kicker)
    ? 0
    : spec.buildEndFrames
}

function refuse(
  spec: DeviceSpec,
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
  /**
   * Has P12 already been shown to be drawable on this beat? See G15.
   *
   * Computed once per beat by `chooseDevices` and handed down, rather than
   * worked out in here — `refuse` is called once per device, and deciding it
   * inside would run P12's gates and its copy build eight times a beat.
   */
  dateBeatBelongsToAYearTemplate: boolean,
  /**
   * Does this beat owe words to a section mention? See G16.
   *
   * Computed once per beat by `chooseDevices` for the same reason as the flag
   * above — working it out in here would run every word-carrying device's gates
   * and copy build once per device per beat.
   */
  sectionBeatOwesWords: boolean,
  /** T-17. Is this beat the opening gallery's, and can it really draw here? */
  openingBeatBelongsToA8: boolean,
  /**
   * GATES THE FALLBACK WALK IS ALLOWED TO STEP OVER, AND IT IS NEVER MORE THAN
   * THE TWO IN `FALLBACK_WAIVES`.
   *
   * ######################################################################
   * # WHY A PARAMETER AND NOT A SECOND COPY OF THIS FUNCTION. `refuse`   #
   * # returns the FIRST gate that fires, so a walk that simply ignored a #
   * # returned code would also ignore every gate written after it — a    #
   * # framed-card waived past `beat-too-long` (G4) would never reach its #
   * # own cap, position rule, brightness or section check. The waiver    #
   * # has to be applied AT THE GATE, so the ones after it still run.     #
   * #                                                                    #
   * # Exactly two gates consult it and each says why where it does. Every #
   * # other gate is unconditional, which is the property that makes this  #
   * # safe: a caller cannot waive a rule the rule did not agree to.       #
   * ######################################################################
   */
  waived: ReadonlySet<RefusalCode>,
): RefusalCode | null {
  /*
   * G1. The registry decides what is selectable at all.
   *
   * `chooserMaySelect` rather than `spec.enabled`, because since 2026-09-11 a
   * device can be DRAWABLE without being CHOOSABLE — see
   * `PLACED_BY_OPERATOR_ONLY`. Those are refused on the same code a disabled
   * device gets, which is what keeps every verdict, fallback seed and standards
   * line byte-identical to the film before a2 became drawable.
   */
  if (!chooserMaySelect(spec)) return 'not-enabled'

  /*
   * G2. Pictures. A device draws what the scene can actually give it — EXCEPT
   * the one device whose pictures are not the scene's at all.
   *
   * ##########################################################################
   * # `filmPreview` ASKS A DIFFERENT SUPPLY QUESTION AND THAT IS WHY a8 HAD   #
   * # NEVER PLACED. Read as an own-scene device it needed one opening beat to #
   * # happen to own four photographs, and over the real 118-beat film no beat #
   * # in the opening ever did. Saku 0.3 says its pictures come from "content  #
   * # that appears LATER in the video", so the carrier's own supply is        #
   * # irrelevant to it and its own photograph is the one picture it may NOT   #
   * # show, because a picture on screen now previews nothing.                 #
   * #                                                                        #
   * # HIS OWN FLOOR, VERBATIM: "Reject or flag the beat if fewer than three   #
   * # valid images are available." So three, not four — `previewPictureCount` #
   * # is compared against 3 and the picker takes up to `spec.pictures`.       #
   * ##########################################################################
   */
  if (spec.pictureSource === 'filmPreview') {
    if (beat.previewPictureCount < MIN_PREVIEW_PICTURES) return 'not-enough-pictures'
  } else {
    /*
     * ######################################################################
     * # `>= 1` BECAME `ALWAYS`, AND THIS IS THE EDIT NOBODY ASKS FOR.      #
     * #                                                                    #
     * # Until now T-8's null-score branch was the only thing keeping a     #
     * # zero-picture device off a beat with no photograph — and it did so  #
     * # for the WRONG STATED REASON, refusing a claim about a picture that #
     * # is not there. The T-8 exemption below removes that accident, so    #
     * # the real requirement has to be written down here instead.          #
     * #                                                                    #
     * # WITHOUT THIS LINE THE CHOOSER PLACES A TITLE THE FILM NEVER DRAWS. #
     * # `Scene.tsx` enters the device branch only when `assetSrc !== null` #
     * # for an `ownScene` device, and `DeviceFrame` returns null on a null  #
     * # src ABOVE its chapter-title arm. The beat would render as the       #
     * # ordinary held shot with no title, no error and no log line, at     #
     * # full render cost — a device placed, reported, and invisible.       #
     * #                                                                    #
     * # It refuses nothing new today: the only enabled `ownScene`          #
     * # devices that declare `pictures: 0` are a2 and a3, and G1 refuses   #
     * # both through `PLACED_BY_OPERATOR_ONLY` before G2 is asked.         #
     * ######################################################################
     */
    if (!beat.hasOwnAsset) return 'no-own-picture'
    if (spec.pictures >= 2 && beat.companionCount < spec.pictures - 1) return 'not-enough-pictures'
  }

  /*
   * G2b. THE COMPANIONS IT WOULD DRAW HAVE TO BE WORTH DRAWING. T-15.
   *
   * ##########################################################################
   * # G2 ABOVE COUNTS THE PICTURES AND NEVER LOOKS AT THEM, AND THAT REACHED  #
   * # A DELIVERED FILM. At 2:11 of the 8m46s cut a four-panel mosaic drew     #
   * # cards the ranker itself called "Close-up of bacterial sample in petri   #
   * # dish, completely unrelated" and "Microbiology context with petri        #
   * # dishes, irrelevant to scrolls", in a documentary about the Book of      #
   * # Enoch. Two more four-picture beats are the same shape, at 2:04 and      #
   * # 3:18. The client's rule 6 is "always when using an Image make sure it's #
   * # 100% related on the script", which is T-15.                             #
   * #                                                                        #
   * # ONLY THE SCENE'S OWN PICTURE WAS EVER GATED. `source.ts` accepts a      #
   * # scene's winner only above a score floor and then keeps its runners-up   #
   * # with no score test at all, so a device drawing four pictures drew one   #
   * # checked photograph and three unchecked ones.                            #
   * #                                                                        #
   * # THE FLOOR IS A JUDGEMENT, STATED AS ONE. It is the VALUE of             #
   * # `TEXT_CARD_BELOW_SCORE`, the line below which the sourcer would rather  #
   * # draw nothing than draw the picture — but that constant is compared      #
   * # against `finalScore` and this is compared against `vision.score`, so it #
   * # is INFORMED BY that number rather than the same test. Do not describe   #
   * # it as read from the sourcer.                                            #
   * #                                                                        #
   * # MEASURED on the 78 four-picture beats of job 835cd84f: a floor of 6     #
   * # leaves 3 beats, 5 leaves 8, and 4 leaves 34. On the delivered film 4    #
   * # refuses exactly the three bad mosaics and keeps the one good one, the   #
   * # P19 at 0:49 whose cards are [6, 6, 5, 5].                               #
   * #                                                                        #
   * # A REFUSAL AND NOT A SCORE PENALTY, because the beat losing its mosaic   #
   * # walks its own fallback chain and takes a simpler treatment, which is    #
   * # the partner's rule 3. Nothing goes silent.                              #
   * ##########################################################################
   *
   * ##########################################################################
   * # AND IT PASSED THE SECOND FRAME THE CLIENT SENT BACK, BY ONE TICK.       #
   * #                                                                        #
   * # Job 2629eec5, shot 24 at 1:20.4: a P22 whose cards scored 6.8, 6.0,     #
   * # 5.2 and 4.0. The weakest companion is EXACTLY 4.0 and `4 < 4` is        #
   * # false, so this gate — written for precisely this frame — let it         #
   * # through. `MIN_COMPANION_SCORE` is 5 now and its own box argues why.     #
   * #                                                                        #
   * # A PREFIX, BECAUSE THAT IS WHAT THE COMPOSITOR DRAWS. This asked for     #
   * # the weakest companion ON THE BEAT, which is the right question only     #
   * # for a device that draws them all. `DeviceFrame.tsx` takes a prefix:     #
   * # P22 and P19 destructure three companions, `two-photo-zoom` takes        #
   * # exactly one. A beat routinely carries three runners-up, so the old      #
   * # form refused a two-picture comparison over the third-best picture on    #
   * # the beat — one it never puts on screen.                                 #
   * #                                                                        #
   * # THAT COST NOTHING AT A FLOOR OF 4 and costs something at 5, which is    #
   * # why the two changes ship together. `two-photo-zoom` was enabled on      #
   * # 2026-09-04 and has drawn no frame yet, so this is the guard going in    #
   * # before the harm rather than after it — the opposite of how G2b itself   #
   * # arrived.                                                                #
   * #                                                                        #
   * # NO LENGTH GUARD ON THE PREFIX. G2 above has already returned            #
   * # `not-enough-pictures` when the beat carries too few companions, so an   #
   * # empty prefix is unreachable here and a check for it would be a branch   #
   * # nothing can observe.                                                    #
   * #                                                                        #
   * # A NULL FAILS, exactly as `OVERLAY_MIN_PICTURE_SCORE` reads it: "no      #
   * # opinion" is not "good enough".                                          #
   * ##########################################################################
   */
  if (spec.pictures >= 2 && spec.pictureSource === 'ownScene') {
    const drawn = beat.companionScores.slice(0, spec.pictures - 1)
    if (drawn.some((score) => score === null || score < MIN_COMPANION_SCORE)) {
      return 'companion-picture-too-weak'
    }
  }

  /*
   * G3. TOO SHORT IS A BROKEN RENDER AND IT IS NEVER WAIVED.
   *
   * A beat shorter than `buildEndFrames` cuts the build off mid-animation, at
   * exit 0, with nothing red anywhere. That is not a numeric range being read as
   * a hard limit — it is output that does not work. His rule 9 is about
   * DEFAULTS, and a truncated animation is not a default.
   */
  if (beat.durationFrames < cornerLabelAwareBuildFloor(spec, beat)) return 'beat-too-short'
  /*
   * G4. TOO LONG IS A PREFERENCE, AND THE FALLBACK WALK MAY STEP OVER IT.
   *
   * ##########################################################################
   * # HIS RULE 9: "Numeric ranges are DEFAULTS unless they are explicitly     #
   * # marked as hard limits." NOT ONE of the fifteen templates in             #
   * # `TEMPLATE_REGISTRY.json` carries `durationIsHardLimit: true`, and his    #
   * # `globalRules.normalDuration` puts the usual maximum at EIGHT SECONDS —  #
   * # 240 frames — against framed-card's ceiling of 120 here.                 #
   * #                                                                        #
   * # SO THE CEILING KEEPS ITS FULL FORCE AS A COMPARISON AND YIELDS AS A     #
   * # VETO, and that split is the whole point. In the main competition        #
   * # several devices are bidding and the ceiling correctly steers the beat   #
   * # to one that holds well — that is a default doing a default's job, and   #
   * # `durationFit` in the score is pulling the same way. Inside the fallback #
   * # walk the competition is over: the alternative is not a better device,   #
   * # it is an EMPTY BEAT, and his rule 6 is "Every selected beat should      #
   * # contain a purposeful visual change or hold. Do not leave an empty       #
   * # layout." A default that blanks a beat is being used as a hard limit.    #
   * #                                                                        #
   * # THE CONSTANT IS NOT TOUCHED, WHICH MATTERS. `holdsWellFrames`'s own     #
   * # note says "Do not widen it from the selection report alone — tuning a   #
   * # constant to make more devices place is exactly backwards", and it is    #
   * # right. 120 still decides every comparison in the film. What changes is  #
   * # only whether it is allowed to be the last word on a beat that would     #
   * # otherwise draw nothing. MEASURED over the 39 real beats: this waiver    #
   * # is what places beats 19 and 29, and it moves no beat that already had   #
   * # a winner, because the walk only runs when nothing won.                  #
   * ##########################################################################
   */
  if (beat.durationFrames > spec.holdsWellFrames && !waived.has('beat-too-long')) {
    return 'beat-too-long'
  }

  /*
   * G5 AND G6 USED TO LIVE HERE AND THEY WERE BACKWARDS. THE FIRST REAL RUN IS
   * WHAT SHOWED IT.
   *
   * ######################################################################
   * # THEY REFUSED ANY BEAT NOT ALREADY PRECEDED BY A HARD CUT, AND      #
   * # FOLLOWED BY ONE. On the first ten-scene run against real narration #
   * # that refused SIX OF TEN BEATS on transitions alone, regardless of  #
   * # what any of them was about — because the planner assigns           #
   * # crossfades deterministically by scene index, long before anything  #
   * # asks whether a beat wants a device.                                #
   * #                                                                    #
   * # The partner's own rule reads the other way round. Rule 7 is "USE a #
   * # hard cut into and out of each template", and his registry carries  #
   * # `defaultTransitionBefore: hard_cut`. That is the template DICTATING #
   * # the cut, not waiting to be given one. Implemented as a wait, the   #
   * # feature could only ever land on whichever beats the crossfade      #
   * # arithmetic happened to skip.                                       #
   * #                                                                    #
   * # So the cut is now IMPOSED by `applyDeviceChoice`, which rewrites   #
   * # `transitionIn` to `cut` and nulls `prevAsset` on the device scene  #
   * # AND on its follower, in the plan, before anything is hashed.       #
   * # Rewriting the PLAN is what keeps the sound honest: `deliver.ts`    #
   * # maps SFX from the plan's own transition type, so a scene that says #
   * # `cut` gets `null` and the 400ms whoosh goes with the dissolve it   #
   * # belonged to. The earlier refusal existed to avoid exactly that     #
   * # mismatch and solved it by never firing.                            #
   * ######################################################################
   */

  /* G7. See the box on `nextHoldsThisPicture`. Seconds long, not frames. */
  if (beat.nextHoldsThisPicture) return 'next-scene-holds-this-picture'

  /*
   * G8. Type over a bright photograph is illegible and nothing goes red.
   *
   * ##########################################################################
   * # IT ASKS ABOUT THE PICTURE THE VIEWER SEES, WHICH IS THE PICTURE AFTER   #
   * # THE DEVICE'S OWN WASH. `washedGrey` IS THE WHOLE OF THAT CHANGE.        #
   * #                                                                        #
   * # For 25 of the 27 devices this is `x * 1` and the gate is exactly what   #
   * # it always was. The two exceptions are the two that now PAINT a ground   #
   * # under their own type, and for them the old reading asked a question     #
   * # about a picture that no longer reaches the eye: the 1940 census page    #
   * # measures 0.77 across the frame, and under chapter-plate's own band it   #
   * # is 0.42 where the letters are.                                          #
   * #                                                                        #
   * # WITHOUT THIS LINE THE BUNDLE HALF BUYS NOTHING. The wash would be       #
   * # painted on a beat the chooser had already refused for being too bright, #
   * # so the census page would play with no heading at all and the 87 minutes #
   * # would land on no frame in this film. Measured through the real chooser  #
   * # over the real artifacts: with the raw number, beat 28 loses its plate;  #
   * # with this one it keeps it and nothing else moves.                       #
   * #                                                                        #
   * # AND IT IS NOT A LOOPHOLE A DEVICE CAN OPEN FOR ITSELF. G8c below then   #
   * # measures the rectangle the letters land on, in pixels, under the same   #
   * # ground. A device that claims a ground it does not draw fails the second #
   * # test on the frame rather than passing both on the label.                #
   * #                                                                        #
   * # IT READS `spec.scrimAlpha`, AND SINCE 2026-09-21 THAT IS THE ONLY       #
   * # GROUND NUMBER EITHER OF THESE DEVICES HAS.                              #
   * #                                                                        #
   * # This gate sits inside `refuse`, which runs BEFORE `buildCopy`, so for a #
   * # DAY it was structurally optimistic: the chapter plate solved a band     #
   * # depth from its own rectangle, the rectangle depended on the copy, and   #
   * # the copy did not exist yet. G8 read the registry cap while G8c and      #
   * # planCheck T-7 read the drawn number, and an entire term in the depth    #
   * # solver existed only to prove the two could never contradict each other. #
   * #                                                                        #
   * # NO DEVICE PAINTS A BAND NOW. Both devices that own their ground carry a #
   * # fixed glyph halo, and each row's number is the MEASURED CREDIT of that  #
   * # halo over a window one letter wide — which is the same unit this gate's #
   * # proxy has always been in. The cap and the drawn number are one number,  #
   * # so G8, G8c and T-7 read one field and the proof obligation is deleted   #
   * # rather than discharged. Both rows carry their own measurement.          #
   * #                                                                        #
   * # ONE CONSEQUENCE, STATED PLAINLY. At the credits these two carry, the    #
   * # brightest picture that exists — a pure white frame — lands at 4.17:1    #
   * # under the corner label and 3.08:1 under the chapter plate, both over    #
   * # the project's 3:1 floor. So for those two devices neither this gate nor #
   * # G8c's LEVEL or CONTRAST tests can fire any more, and the live           #
   * # protection is G8c's printed-matter test at its own wash ceiling — see   #
   * # `TYPE_GROUND_MAX_EDGE_P95_WASHED`. That is the wash doing its job       #
   * # rather than a hole: a device that owns its ground is no longer at the   #
   * # mercy of the picture's brightness. It is still at the mercy of what is  #
   * # PRINTED on it, which is the thing no ground can fix by dimming. It is   #
   * # a real weakening and it is accepted knowingly; both registry rows say   #
   * # so, and say what a live brightness gate would have to be measured from. #
   * #                                                                        #
   * # (4.17 and 3.08 are `readTypeGround` run over a pure-white ground at     #
   * # each row's own `scrimAlpha` and `typeGroundInkRelLum`. An earlier draft #
   * # of this box said 3.49 and 3.34; those came off an arithmetic sketch     #
   * # rather than off the shipped code and did not reproduce.)                #
   * ##########################################################################
   *
   * ##########################################################################
   * # AND THE DISCOUNT IS CONDITIONAL ON THERE BEING EVIDENCE, WHICH IS THE   #
   * # WHOLE DOCTRINE OF THIS CHANGE READ BACK IN THE OTHER DIRECTION.         #
   * #                                                                        #
   * # `typeGroundRefusal`'s box says a missing measurement ABSTAINS. A wash   #
   * # discount applied to a beat nothing measured does not abstain — it makes #
   * # this gate WEAKER than it was before the commit, on exactly the beats    #
   * # with the least evidence. Unconditional, `meanLuma` 0.60, 0.78, 0.95 and #
   * # 1.00 all cleared chapter-plate's 0.55 ceiling with no pixels in hand,   #
   * # where every one of them was `picture-too-bright` at `dc4f9dd`. G8c      #
   * # cannot make that up, because it abstains on the same missing input.     #
   * #                                                                        #
   * # So: pixels in hand, judge the picture the viewer sees; no pixels, judge #
   * # it exactly as this gate judged it before any of this existed. Every     #
   * # replay, every hand-built plan, every re-plan on a machine that does not #
   * # hold the JPEGs, and every asset `sharp` could not decode takes the      #
   * # second branch. planCheck T-7 mirrors this condition line for line.      #
   * ##########################################################################
   */
  if (spec.maxMeanLuma !== null && beat.meanLuma !== null) {
    const measured = beat.typeGround !== null && beat.typeGround !== undefined
    const asSeen = measured ? washedGrey(beat.meanLuma, spec.scrimAlpha) : beat.meanLuma
    if (asSeen > spec.maxMeanLuma) return 'picture-too-bright'
  }

  /*
   * G8b. AND THE OTHER END, for the one device that needs a LIGHT picture.
   *
   * P19's cards are pinned to a board. Handed a dark busy photograph its
   * mechanics render identically, nothing errors, and the cards stop reading as
   * pinned to anything. Found by rendering a still, not by reading the code.
   */
  if (spec.minMeanLuma !== null && beat.meanLuma !== null && beat.meanLuma < spec.minMeanLuma) {
    return 'picture-too-dark'
  }

  /* G9. Words on a picture that already has words burned into it. */
  if (spec.typeOverPicture !== 'none' && beat.hasBakedText) return 'picture-has-baked-text'

  /*
   * G10. P17 POINTS AT SOMETHING, AND A DEAD-CENTRE ANCHOR MEANS THERE IS
   * NOTHING TO POINT AT.
   *
   * ######################################################################
   * # 0.5/0.5 IS A DOCUMENTED SENTINEL, NOT A COORDINATE. The vision      #
   * # prompt says so in as many words: "0.5/0.5 if there is NO SINGLE     #
   * # SUBJECT" (`apps/worker/src/llm/gemini.ts`). Measured on a real run, #
   * # 61 of 70 judged candidates carried exactly that pair.               #
   * #                                                                     #
   * # P17's whole job is "point one thin line at one meaningful feature   #
   * # and label it briefly". Firing it on that sentinel draws a leader    #
   * # line into the middle of a photograph the model has just said has no #
   * # single subject — nothing errors, the line draws, and it points at   #
   * # nothing. It shipped in a frozen plan before this gate existed.      #
   * #                                                                     #
   * # AND EVEN IF IT WERE A REAL MEASUREMENT the answer is the same: a    #
   * # pointer at the exact centre labels the obvious, which is the one    #
   * # thing a callout is not for.                                         #
   * ######################################################################
   */
  if (spec.id === 'P17') {
    if (beat.subjectAnchor === null) return 'no-subject-anchor'
    if (beat.subjectAnchor.x === 0.5 && beat.subjectAnchor.y === 0.5) return 'no-subject-anchor'
  }

  /*
   * G11. THE PER-FILM CAP, AND THE NULL TEST COMES FIRST.
   *
   * `maxPerFilm: null` means the client wrote "does not have a hard rule".
   * Writing this as `used >= spec.maxPerFilm` would compare `0 >= null`, which
   * JavaScript coerces to `0 >= 0` — true — and would refuse the one device he
   * explicitly left open, on its first candidate beat, forever.
   */
  const used = state.used.get(spec.id) ?? 0
  if (spec.maxPerFilm !== null && used >= spec.maxPerFilm) return 'per-film-cap-reached'

  /*
   * G12. "Do not repeat the same template IMMEDIATELY." Only the immediately
   * previous choice is a refusal; everything else inside the window is a score
   * penalty, because his next sentence is "do not force variety when the
   * narration clearly requires the same treatment". See the box on
   * `VARIETY_WINDOW` for what a hard cooldown silently did to the one device he
   * declared uncapped.
   */
  /*
   * ##########################################################################
   * # BOTH NEIGHBOURS, AND THE SECOND ONE COSTS NOTHING UNDER A FRONT-TO-BACK #
   * # WALK. `beat.index + 1` is never decided yet when the chooser goes in    #
   * # film order, so this reads exactly as `beat.index - 1` alone always did. #
   * # Under `spacedOrder` the shot after this one may already carry a device, #
   * # and "do not repeat the same template immediately" is a fact about the   #
   * # FILM rather than about the order somebody decided it in — so it has to  #
   * # look both ways or it enforces the rule on one side only.                #
   * ##########################################################################
   */
  if (
    state.placedAt.get(beat.index - 1) === spec.id ||
    state.placedAt.get(beat.index + 1) === spec.id
  ) {
    return 'variety-cooldown'
  }

  /* G13. His written placement rules. Both are quoted where they are declared. */
  /*
   * ##########################################################################
   * # THE BARE `> 2` THAT STOOD HERE WAS QUOTED FROM NOBODY.                  #
   * #                                                                        #
   * # No test pinned it — mutating it to anything from 0 to 39 left all 67    #
   * # core tests green — and the client's own relayed rule forbids that shape #
   * # by name: "Detect boundaries using sentence completion, pauses, topic    #
   * # changes, and narration structure, NOT fixed time limits."               #
   * #                                                                        #
   * # It is now the beat the plan's own opening detector chose. A null        #
   * # boundary refuses the device everywhere, which is Saku's "flag for       #
   * # review" rather than a placement on a beat nothing sanctioned.           #
   * ##########################################################################
   */
  if (spec.positionRule === 'openingOnly' && beat.index !== beat.openingCarrierIndex) {
    return 'wrong-position-in-film'
  }
  /*
   * "In the first 0:00-0:04 I don't want this show clip animations." Scene 0 of
   * the delivered plan is photo-pop and runs 0:00 to 4.57s, so the beat he means
   * is the first one. See the box on photo-pop's `positionRule`.
   */
  if (spec.positionRule === 'notOpening' && beat.index === 0) return 'wrong-position-in-film'

  /*
   * G14. THE BEAT HAS TO BE DOING THE THING THIS DEVICE IS FOR — AND THIS IS
   * THE GATE THE AUTHOR'S OWN FALLBACK CHAIN EXISTS TO STEP OVER.
   *
   * ##########################################################################
   * # WITHOUT THIS WAIVER THE WHOLE FALLBACK FEATURE PLACES NOTHING, AND THE  #
   * # REASON IS WORTH SPELLING OUT BECAUSE IT IS NOT OBVIOUS.                 #
   * #                                                                        #
   * # The walk only runs on a beat where EVERY device was already refused, by #
   * # these same gates, against this same state. So a fallback candidate was  #
   * # refused a moment ago too — and if the walk changed nothing it would get  #
   * # the identical answer and rescue exactly zero beats.                     #
   * #                                                                        #
   * # G14 IS THE ONE THAT DIFFERS. A beat asking for a highlight-text frame   #
   * # is doing `single_word_or_number_emphasis`; photo-pop's job is           #
   * # `source_inspection`, which that beat may not be doing at all, so        #
   * # photo-pop is refused here in the competition. HIS CHAIN IS THE SEMANTIC #
   * # BRIDGE: by writing `1_0-10_P03 -> a9_photo-pop` he has already decided  #
   * # that a highlight beat which cannot be highlighted is acceptably served  #
   * # by a photo reveal. That is his judgement about his own library, and     #
   * # rule 3 is the instruction to use it.                                    #
   * #                                                                        #
   * # IT IS NOT A LOOSENING OF SEMANTIC FIT. Semantic fit still decides which #
   * # device SEEDS the walk — `rescueByFallback` orders the seeds by          #
   * # `jobs.indexOf(spec.job)`, his own first priority — and a device whose   #
   * # job the beat is not doing can never be a seed. The waiver applies only  #
   * # to a substitute the author himself nominated for that seed.             #
   * ##########################################################################
   */
  /*
   * ##########################################################################
   * # A MANDATORY DEVICE ON ITS OWN CARRIER IS AN INSERTION, NOT A BID.       #
   * #                                                                        #
   * # Saku 0.3 requires a8 in every film, at a beat HIS RULE chooses. Asking  #
   * # that beat to also be "doing a four-source mosaic" is asking the         #
   * # narration's meaning to agree with a placement rule about structure, and #
   * # measured over the real 118 beats it never does: `four_source_mosaic` is #
   * # in the jobs of 16 beats and not one of them is in the opening.          #
   * #                                                                        #
   * # SCOPED TO THE CARRIER, so a8 still cannot win an ordinary beat on a job #
   * # it is not doing, and every other device is unaffected. The other gates  #
   * # after this one all still run.                                          #
   * ##########################################################################
   */
  const mandatoryOnItsCarrier =
    spec.mandatoryOnce && beat.openingCarrierIndex !== null && beat.index === beat.openingCarrierIndex
  if (!jobs.includes(spec.job) && !mandatoryOnItsCarrier && !waived.has('wrong-narrative-job')) {
    return 'wrong-narrative-job'
  }

  /*
   * G14b. TEMPLATE 05 NEVER SITS ON THE SUBJECT. Review C6.
   *
   * ##########################################################################
   * # HIS FILES SAY IT THREE TIMES: do not cover an important subject at the #
   * # bottom centre (manifest :81, AI handoff :76, human handoff :35, :54).  #
   * # That is exactly where 05 sets its line, rows 924 to 1020 of 1080.      #
   * #                                                                        #
   * # COARSE ON PURPOSE. The anchor is a POINT, the subject's centre, not a  #
   * # box, so this catches the plain case of a subject centred under the     #
   * # line. The band starts a little above the cap top (0.8 of the frame     #
   * # against 0.865) so a subject centred just over the line is caught too.  #
   * # 0.5/0.5 is the vision prompt's sentinel for "no single subject", read  #
   * # exactly as G10 reads it, and a null anchor is no reading at all.       #
   * #                                                                        #
   * # AFTER G14, NOT BESIDE G10, so this is only ever the reported refusal   #
   * # on a beat that asked for 05. Before G14 it would name 05 as the         #
   * # "nearest" device on every bottom-centre picture in the film.            #
   * ##########################################################################
   */
  if (spec.id === 'shadow-up' && subjectSitsUnderTheLine(beat.subjectAnchor)) {
    return 'subject-under-the-line'
  }

  /*
   * G14c. P04's LABEL NEVER SITS ON THE SUBJECT.
   *
   * ##########################################################################
   * # THE PACK'S RULE 8: "Keep important faces, document writing, maps, and  #
   * # the feature being discussed visible and readable." P04 sets its label  #
   * # in the lower-left corner, x 138 to 758 and up from y 968 of 1080.      #
   * #                                                                        #
   * # COARSE ON PURPOSE, as G14b is. The anchor is a POINT, the subject's    #
   * # centre, so this catches a subject centred in that corner: below 0.72   #
   * # of the frame's height, a little above the tallest label's top at      #
   * # 0.754, and left of 0.45, a little past the block's right edge at       #
   * # 0.395. 0.5/0.5 is the vision prompt's "no single subject" sentinel and  #
   * # a null anchor is no reading, both read as G10 reads them.               #
   * #                                                                        #
   * # AFTER G14, for G14b's reason: only ever the reported refusal on a beat #
   * # that asked for P04.                                                    #
   * ##########################################################################
   */
  if (spec.id === 'P04' && subjectSitsUnderTheLabel(beat.subjectAnchor)) {
    return 'subject-under-the-label'
  }

  /*
   * G14d. P02's CARD NEVER SITS ON THE SUBJECT.
   *
   * ##########################################################################
   * # THE PACK'S RULE 8: "Keep important faces, document writing, maps, and  #
   * # the feature being discussed visible and readable." P02 slides an       #
   * # opaque paper card over the left of the frame, x 170 to 820, centred on  #
   * # the frame's height and at its tallest from y 316 to 764.               #
   * #                                                                        #
   * # COARSE ON PURPOSE, as G14b and G14c are. The anchor is a POINT, the    #
   * # subject's centre, so this catches a subject centred under the card:    #
   * # left of 0.47, a little past the card's right edge at 0.427, and        #
   * # between 0.26 and 0.74 of the height, a little outside the tallest      #
   * # card's 0.293 and 0.707. 0.5/0.5 is the vision prompt's "no single       #
   * # subject" sentinel and a null anchor is no reading, both read as G10     #
   * # reads them.                                                            #
   * #                                                                        #
   * # AFTER G14, for G14b's reason: only ever the reported refusal on a beat #
   * # that asked for P02.                                                    #
   * ##########################################################################
   */
  if (spec.id === 'P02' && subjectSitsUnderTheCard(beat.subjectAnchor)) {
    return 'subject-under-the-card'
  }

  /*
   * G14e. P09's CARD NEVER SITS ON THE SUBJECT.
   *
   * ##########################################################################
   * # THE PACK'S RULE 8 again, and P09's own contract: "The real background   #
   * # must remain visible". P09 slides its dark card in over the left of the  #
   * # frame, x 150 to 910, pinned by its top at y 335 and growing down.       #
   * #                                                                        #
   * # COARSE ON PURPOSE, as G14b, G14c and G14d are. The anchor is a POINT,   #
   * # so this catches a subject centred under the card: left of 0.52, a      #
   * # little past the card's right edge at 0.474, and between 0.28 and 0.63   #
   * # of the height, a little outside the card's top at 0.310 and the tallest #
   * # card's bottom at 0.596. 0.5/0.5 is the "no single subject" sentinel and #
   * # a null anchor is no reading, both read as G10 reads them.               #
   * #                                                                        #
   * # THE SAME CODE AS P02's, because it is the same fact about the picture:  #
   * # a card would sit on its subject. The verdict names the device.          #
   * #                                                                        #
   * # AFTER G14, for G14b's reason: only ever the reported refusal on a beat #
   * # that asked for P09.                                                    #
   * ##########################################################################
   */
  if (spec.id === 'P09' && subjectSitsUnderTheQuestionCard(beat.subjectAnchor)) {
    return 'subject-under-the-card'
  }

  /*
   * G14f. P05's SQUARE PANEL NEVER CROPS THE SUBJECT AWAY.
   *
   * ##########################################################################
   * # THE PACK'S RULE 8 FROM THE OTHER SIDE: the feature being discussed has  #
   * # to be visible. P05 covers none of the picture with its column, but it   #
   * # draws the picture at cover in a 746 px square, by R1, so a 16:9 picture #
   * # loses 22 percent of its width off each side, and the push and drift     #
   * # leave 0.235 to 0.770 of it on screen for the whole shot.                #
   * #                                                                        #
   * # COARSE ON PURPOSE, as G14b to G14e are. The anchor is a POINT, the      #
   * # subject's centre, so this refuses a centre left of 0.25 or right of     #
   * # 0.75, a little inside that band so a subject centred at its edge is not #
   * # half gone. Nothing is cut on the height. A picture narrower than 16:9   #
   * # keeps more than this assumes, which can only refuse. 0.5/0.5 is the     #
   * # "no single subject" sentinel and a null anchor is no reading, both read #
   * # as G10 reads them.                                                      #
   * #                                                                        #
   * # AFTER G14, for G14b's reason: only ever the reported refusal on a beat  #
   * # that asked for P05.                                                     #
   * ##########################################################################
   */
  if (spec.id === 'P05' && subjectFallsOutsideThePanel(beat.subjectAnchor)) {
    return 'subject-outside-the-panel'
  }

  /*
   * G14g. P14's YEAR NEVER SITS ON THE SUBJECT.
   *
   * ##########################################################################
   * # THE PACK'S OWN RULE 8, and P14's contract repeats it in its own words:  #
   * # "Keep the date block clear of faces, source text, documents, or other  #
   * # critical subject detail when another placement is available." There is #
   * # no other placement — the block is pinned top-right — so the answer     #
   * # here is to refuse the picture rather than to move the type.            #
   * #                                                                        #
   * # AND P14 NEEDS THIS GATE MORE THAN ITS FIVE SIBLINGS DO. Their type is  #
   * # still. P14's four wheels SPIN for the first second, which is the       #
   * # loudest motion any device in this registry puts on a frame, and motion #
   * # over a face is not the same defect as a label over a face — it is a    #
   * # worse one.                                                             #
   * #                                                                        #
   * # COARSE ON PURPOSE, as G14b to G14f are. The anchor is a POINT, the     #
   * # ranker's guess at where the thing being discussed is, and it carries   #
   * # no extent. So this asks whether that point is inside the corner the    #
   * # year covers, rounded outward from a rendered still, and it does not    #
   * # pretend to know how big the subject is.                                #
   * #                                                                        #
   * # RESCUABLE, like 05's, P04's, P02's, P09's and P05's. It is a fact      #
   * # about the photograph rather than a policy about the beat, so the       #
   * # fallback walk may step past it — except that P14's chain is empty, so  #
   * # today that only means the beat is left to the other devices.           #
   * ##########################################################################
   */
  if (spec.id === 'P14' && subjectSitsUnderTheYear(beat.subjectAnchor)) {
    return 'subject-under-the-year'
  }

  /*
   * G15. A YEAR OR A DATE TAKES P12, AND NOTHING ELSE MAY TAKE THE BEAT.
   *
   * ######################################################################
   * # HIS WORD IS "MAINTAIN", SAID ABOUT BOTH P12 FRAMES HE WAS SHOWN,   #
   * # and `handoff/style-rules.md` reduces it to "A year that misses P12 #
   * # is a DEFECT, not a fallback."                                      #
   * #                                                                    #
   * # A GATE RATHER THAN A SCORE, BECAUSE THE SCORE LOSES THIS. Work it  #
   * # through on a beat that speaks a date AND names three things:       #
   * # `narrativeJobsOf` puts `connected_three_source_evidence` first, so #
   * # `single_historical_date` lands at index 2 and P12 scores 600 on    #
   * # `narrativeJob` — exactly what photo-pop scores from index 3 or     #
   * # later, because everything past second place is 600. The tie then   #
   * # breaks on `sourceProtection`, where photo-pop's 1000 beats P12's   #
   * # 400 by 6,000 points, and PHOTO-POP TAKES THE DATE BEAT. Nothing is #
   * # broken; the terms are simply not what the client's rule says.      #
   * #                                                                    #
   * # SO IT IS A REFUSAL, AND IT IS CONDITIONAL ON A YEAR TEMPLATE       #
   * # ACTUALLY BEING ABLE TO DRAW. If both are refused here for their    #
   * # own reasons — the picture is too bright for the scrim, the beat is #
   * # 20 frames long, the previous shot was also one of them — then this #
   * # gate does not fire and the other devices compete as before. A rule #
   * # that blanked the beat whenever the year template was unavailable   #
   * # would turn one refusal into two.                                   #
   * #                                                                    #
   * # TWO YEAR TEMPLATES SINCE P14, AND THE RULE IS THE SAME RULE.       #
   * # `YEAR_TEMPLATES` is the set the client's "always takes P12" now    #
   * # covers, because P14 draws the same fact in a faster tempo and the  #
   * # developer ruled them equal. So this asks "can EITHER of them       #
   * # draw", refuses everything that is neither, and lets the two settle #
   * # it between themselves the way every other pair of candidates does: #
   * # the planner's row wins through `PLANNED_BONUS`, and with no row    #
   * # P12 is reached first in `DEVICE_IDS` and P14's own G14 refuses it  #
   * # anyway, because `fast_date_emphasis` is emitted from nothing but a #
   * # planner row. So an unplanned date beat still draws exactly the P12 #
   * # it drew before P14 existed.                                        #
   * ######################################################################
   */
  if (dateBeatBelongsToAYearTemplate && !YEAR_TEMPLATES.has(spec.id)) {
    return 'date-beat-belongs-to-a-year-template'
  }

  /*
   * G16. A SECTION MENTION OUTRANKS A TREATMENT THAT PRINTS NOTHING. T-1, T-4.
   *
   * ######################################################################
   * # T-4, VERBATIM: "Must never displace a section mention competing for #
   * # the same beat — a P03-carrying beat outranks a decorative one."     #
   * #                                                                     #
   * # A GATE RATHER THAN A WEIGHT, AND THE DELIVERED FILM IS WHY. Beat 31 #
   * # of the 2:50 cut speaks "Chapter 22" and "Jerusalem", owns four      #
   * # pictures and runs 189 frames. Replayed, P03 builds on it — kicker   #
   * # "Jerusalem", headline "Chapter 22" — and then LOSES 92,200 to       #
   * # 81,704, because P22 takes `sourceCountFit` (four of four against    #
   * # one of four) by 15,000 and `sourceProtection` by 6,000 while P03    #
   * # leads on nothing. The beat drew a four-tile mosaic and the chapter  #
   * # went untitled, which is the complaint T-1 exists for.               #
   * #                                                                     #
   * # NO WEIGHT FIXES THAT SAFELY. `sourceCountFit` and `sourceProtection` #
   * # are the partner's own terms and they are RIGHT about what they      #
   * # measure; a thumb heavy enough to turn this beat over would turn      #
   * # over every four-picture beat in the film. The client's rule is not   #
   * # "P03 fits better here", it is "the mention must be on screen", and   #
   * # that is a refusal.                                                   #
   * #                                                                     #
   * # AND IT IS CONDITIONAL ON THE SWAP ACTUALLY COVERING THE MENTION,    #
   * # which is more than G15 asks of P12 and is the difference between a   #
   * # gate that buys coverage and one that only spends variety.            #
   * # `sectionBeatOwesWords` is false unless a word-carrying device has    #
   * # passed every gate, built copy, and that copy CONTAINS this beat's    #
   * # section mark. So beat 28, whose photograph is too bright for P03's   #
   * # scrim, is left to the other devices rather than blanked; and a beat   #
   * # where P03 would title something else entirely keeps its mosaic.      #
   * # Turning one refusal into two, and paying a treatment for nothing,    #
   * # are the two failure modes this shape avoids.                         #
   * #                                                                     #
   * # SECTIONS ONLY, NOT EVERY MARK. T-4 makes places, people and          #
   * # manuscript designations a MAY; T-1 makes a section division a MUST.  #
   * # Dates are the other MUST and G15 already owns them. Beat 30 of the   #
   * # delivered film — P19 over "4Q204", "4Q206" and an entity — is        #
   * # therefore left exactly as it is, on purpose.                         #
   * #                                                                     #
   * # THIS IS NOT A COVERAGE GUARANTEE AND MUST NOT BE READ AS ONE. It     #
   * # removes the devices that print nothing; which of the survivors wins  #
   * # is still the score's business, and framed-card's caption is not a    #
   * # title under T-3. T-1 is checked on the plan, not here.               #
   * ######################################################################
   */
  if (sectionBeatOwesWords && !drawsWords(spec)) return 'section-mention-needs-words'

  /*
   * ##########################################################################
   * # G18. T-18 CONDITION 1: EDITORIAL COPY IS A FALLBACK, NEVER A           #
   * # PREFERENCE. If the narration's OWN words can be printed on this beat,  #
   * # they win, and a written heading stands down.                           #
   * #                                                                        #
   * # `sectionBeatOwesWords` is already computed once per beat and is exactly #
   * # the right question: it runs the REAL gates and the REAL copy build over #
   * # every word-drawing device and is true only when one of them actually   #
   * # PRINTS the mention. So this is not a heuristic about what might be     #
   * # sayable, it is the answer to what will be said.                        #
   * #                                                                        #
   * # WHY THIS DOES NOT KILL THE FEATURE. It only fires where a spoken       #
   * # treatment genuinely lands, which is where the client already gets the  #
   * # frame he called perfect. On a beat whose picture is too weak to carry  #
   * # a name, nothing spoken can be printed, the flag is false, and the      #
   * # written heading is the only thing that can serve the moment.           #
   * #                                                                        #
   * # RECURSION IS ALREADY SOLVED: the probe that computes the flag passes   #
   * # `false` for it, so a device probed inside it never reaches this line.  #
   * ##########################################################################
   */
  /*
   * ##########################################################################
   * # AND TEMPLATE 05, WHOSE LINE THE PLANNER CHOSE. A 05 asked for on a     #
   * # chapter beat would beat the spoken P03 on the planner's bonus alone,   #
   * # and T-1 gives chapters to P03. So 05 stands down exactly where a       #
   * # spoken treatment prints the mention. It costs 05 nothing where P03     #
   * # cannot draw, because the probe that sets the flag skips every device   #
   * # this line stands down. See `standsDownToSpokenWords`.                  #
   * ##########################################################################
   */
  if (standsDownToSpokenWords(spec) && sectionBeatOwesWords) return 'spoken-mark-outranks-written'

  /*
   * G17. THE OPENING GALLERY IS REQUIRED, SO ITS BEAT IS NOT A CONTEST. T-17.
   *
   * ######################################################################
   * # SAKU 0.3, FOUR TIMES: "Status: required opening template", "required #
   * # once in every video as an opening orientation gallery", "The opening #
   * # A8 use is mandatory", and the sequence "Hook -> A8 Gallery Strip ->  #
   * # Chapter Title, if supplied -> Main Content". The client forwarded    #
   * # that document himself saying "Now A8 will be used each time", after  #
   * # asking in his own words to "make it so that the AI won't skip" it.   #
   * #                                                                     #
   * # A GATE RATHER THAN A WEIGHT, for the reason G15's and G16's boxes    #
   * # already give: no thumb on the score is both big enough to win this   #
   * # beat and small enough to leave every other beat alone. "Required" is #
   * # not "fits better here", and only a refusal says that.                #
   * #                                                                     #
   * # LAST OF THE SEVENTEEN, ON PURPOSE. It sits after G15 and G16 so a    #
   * # date beat still goes to a year template and a section mention still  #
   * # gets its words — the client's "MAINTAIN" and his "this is important" #
   * # both predate this document and neither is withdrawn by it. In        #
   * # practice they cannot collide, because the carrier is chosen for      #
   * # structure and those two are chosen for what the narration says, but  #
   * # the ORDER is the thing that keeps that true if the detector ever     #
   * # moves.                                                               #
   * ######################################################################
   */
  if (openingBeatBelongsToA8 && spec.id !== 'gallery-strip') return 'opening-belongs-to-A8'

  return null
}

/** Nothing waived. Every caller but the fallback walk passes this. */
const NO_WAIVERS: ReadonlySet<RefusalCode> = new Set()

/** One device on one beat: the copy it would draw, or the code that stopped it. */
type Attempt =
  | { readonly copy: SceneDevice; readonly refusal: null }
  | { readonly copy: null; readonly refusal: RefusalCode }

/**
 * EVERYTHING BETWEEN "consider this device" AND "it is placeable", IN ONE PLACE.
 *
 * ##########################################################################
 * # PULLED OUT OF `chooseDevices` BECAUSE FOUR CALLERS NOW ASK THE SAME     #
 * # QUESTION AND THEY HAD DRIFTED. The competition ran the gates, the copy  #
 * # build, the schema parse and T-8. `yearTemplateClaims` ran the gates and #
 * # the copy build. `sectionBeatClaimsWords` ran the gates and the copy     #
 * # build.                                                                 #
 * #                                                                        #
 * # THAT GAP WAS LIVE ON A REAL BEAT. Beat 31 of the delivered cut speaks a #
 * # chapter, and its photograph scores 4.5 — under T-8's bar of 6. P03      #
 * # passed the gates and built "Chapter 22" over "Jerusalem", so            #
 * # `sectionBeatClaimsWords` said the mention was covered and G16 refused   #
 * # all four wordless devices. Then the competition applied T-8 and refused #
 * # P03 as well, and the beat drew NOTHING. G16's own comment promises the  #
 * # opposite — "AND IT IS CONDITIONAL ON THE SWAP ACTUALLY COVERING THE     #
 * # MENTION... Turning one refusal into two [is a] failure mode this shape  #
 * # avoids" — and it could not keep that promise while the probe and the    #
 * # competition asked different questions.                                 #
 * #                                                                        #
 * # SO THE PROBE IS NOW LITERALLY "WOULD THIS DEVICE BE PLACED HERE", and   #
 * # it cannot drift again because there is only one implementation of it.   #
 * ##########################################################################
 */
function attempt(
  spec: DeviceSpec,
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
  dateBeatBelongsToAYearTemplate: boolean,
  sectionBeatOwesWords: boolean,
  openingBeatBelongsToA8: boolean,
  waived: ReadonlySet<RefusalCode>,
): Attempt {
  const refusal = refuse(
    spec,
    beat,
    state,
    jobs,
    dateBeatBelongsToAYearTemplate,
    sectionBeatOwesWords,
    openingBeatBelongsToA8,
    waived,
  )
  if (refusal !== null) return { copy: null, refusal }

  const copy = buildCopy(spec, beat, state.drawnHeadlines)
  if (copy === null) return { copy: null, refusal: 'copy-not-available' }

  /* Belt and braces: the union is what actually reaches a frame. */
  const parsed = SceneDeviceSchema.safeParse(copy)
  if (!parsed.success) return { copy: null, refusal: 'copy-not-available' }

  /*
   * T-8, AND IT HAS TO SIT HERE RATHER THAN IN `refuse`.
   *
   * Whether a device NAMES its picture is a property of the COPY, not of the
   * device — P12 draws a year, and a year is a fact about the narration that
   * claims nothing about the photograph under it. So the question cannot be
   * asked until `buildCopy` has run, which is after every gate.
   */
  /*
   * ##########################################################################
   * # `spec.pictures > 0` IS NEW, AND IT IS THE THIRD REASON a3 NEVER DREW.  #
   * #                                                                        #
   * # T-8 asks whether the picture is good enough to be NAMED. A device that #
   * # draws no picture makes no claim about one, so the question does not    #
   * # apply — and asking it anyway refuses the device for failing to justify #
   * # a claim it cannot make. `chapter-title` declares `pictures: 0`, so its #
   * # beat holds no photograph, so `visionScore` is null, so                 #
   * # `pictureEarnsAName` is false on EVERY beat of EVERY film.              #
   * #                                                                        #
   * # KEYED ON THE REGISTRY, NOT ON AN ID LIST, because "does it draw a      #
   * # picture" is the actual question and an id list drifts from it. Exactly #
   * # two devices declare `pictures: 0` today: chapter-title, and            #
   * # highlight-page, which is `enabled: false` and refused by G1 long       #
   * # before this line. So one device changes behaviour.                     #
   * #                                                                        #
   * # `copyNamesThePicture` is deliberately LEFT ALONE. It is a switch over  #
   * # the `SceneDevice` union, so a new member is a compile error there —    #
   * # and a silent `false` would let a future device name any picture it     #
   * # liked. The exemption belongs at the call site, not in the predicate.   #
   * #                                                                        #
   * # WHAT REPLACES THE PROTECTION THIS REMOVES is the `hasOwnAsset` line in #
   * # G2 above. Read them together; neither is correct alone.                #
   * ##########################################################################
   */
  if (spec.pictures > 0 && copyNamesThePicture(parsed.data) && !pictureEarnsAName(beat)) {
    return { copy: null, refusal: 'picture-too-generic-to-name' }
  }

  /*
   * G8c. THE GROUND UNDER THESE PARTICULAR LETTERS. See `typeGroundRefusal`.
   *
   * BESIDE T-8 AND NOT BESIDE G8, FOR T-8's OWN REASON. The rectangle is a
   * property of the COPY — "ALLEGHENY" occupies 482px of a band and a kicker
   * occupies its own — and the copy does not exist until `buildCopy` has run.
   * G3's box already makes the same argument from the other side about
   * `cornerLabelFinishesInside`: a gate that has to know the words cannot be
   * asked before the words are written.
   */
  /*
   * ##########################################################################
   * # ONE READING, ONE ANSWER, AND IT USED TO BE ONE READING AND TWO.         #
   * #                                                                        #
   * # `typeGroundSettle` sat here for one day and returned a refusal AND a    #
   * # solved band depth from a single `readTypeGround`, so that "did we look  #
   * # at this picture" could not be answered twice — which is how G8 and G8c  #
   * # came apart in the first place. No device paints a band now, so there is #
   * # no second answer to keep in step and the settlement collapses back to   #
   * # the refusal it wraps.                                                   #
   * ##########################################################################
   */
  const groundRefusal = typeGroundRefusalFor(spec, parsed.data, beat)
  if (groundRefusal !== null) return { copy: null, refusal: groundRefusal }

  return { copy: parsed.data, refusal: null }
}

/**
 * THE RECTANGLE THESE PARTICULAR LETTERS LAND ON, READ ONCE AND JUDGED.
 *
 * ##########################################################################
 * # IT IS `typeGroundReadingFor` AND A COMPARISON, SINCE 2026-09-22, AND    #
 * # BEFORE THAT IT WAS A SECOND COPY OF IT.                                 #
 * #                                                                        #
 * # The two functions held the same four lines — the same abstentions, the  #
 * # same `readTypeGround` call, the same `spec.scrimAlpha` — and differed   #
 * # only in that one ended with `typeGroundRefusal`. T-26 in `planCheck.ts` #
 * # now judges a FROZEN plan on the reading the reporting function          #
 * # produces, so the two had to become one call or the gate and the chooser #
 * # would have had two implementations of "the ground under this type" to   #
 * # disagree about. That is the failure the box at G8c describes, one level #
 * # down, and collapsing them is the same move 69c7b25 made on the solver.  #
 * ##########################################################################
 */
function typeGroundRefusalFor(
  spec: DeviceSpec,
  copy: SceneDevice,
  beat: DeviceBeat,
): RefusalCode | null {
  const reading = typeGroundReadingFor(spec, copy, beat.typeGround)
  return reading === null ? null : typeGroundRefusal(spec, reading)
}

/**
 * IS THE RECTANGLE THESE LETTERS LAND ON ABLE TO HOLD THEM?
 *
 * ##########################################################################
 * # THREE TESTS, BECAUSE THE TWO FRAMES THE DEVELOPER SENT BACK FAIL IN     #
 * # THREE DIFFERENT WAYS AND NO ONE NUMBER FINDS MORE THAN ONE OF THEM.     #
 * #                                                                        #
 * #   LEVEL     a page so pale no arrangement of cream letters survives it. #
 * #             The census form reads 0.91 against a ceiling of 0.62.       #
 * #   CONTRAST  the WORST one-letter window, not the average. ALLEGHENY's   #
 * #             rectangle has a perfectly innocent mean of 0.38 to 0.47 and #
 * #             its first three letters sit at 1.11:1 on white sky.         #
 * #   BUSY      printed rules and rows running through the glyphs, which    #
 * #             neither of the other two can see: the census page's edge    #
 * #             p95 is five times a clean photograph's while its edge MEAN  #
 * #             is the same.                                                #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE TESTS RUN ON THE PICTURE AS THE VIEWER WILL SEE IT, WHICH MEANS     #
 * # AFTER THE DEVICE'S OWN WASH — AND THE RAW BUSY NUMBER IS STILL KEPT.    #
 * #                                                                        #
 * # The alternative was to exempt chapter-plate from LEVEL and BUSY because #
 * # it draws its own ground. That is too broad: it re-opens type-on-a-      #
 * # document for every future film and for every copy, not just for the one #
 * # frame that provoked it. Measuring after the wash keeps all three        #
 * # thresholds exactly where they were calibrated and makes beat 28 pass on #
 * # its own numbers rather than by exemption.                               #
 * #                                                                        #
 * # MEASURED ON THE DELIVERED CENSUS FRAME, through the worker's own        #
 * # decoder, with each device's ground modelled at the credit its registry   #
 * # row records. The level and window columns move with that credit; the     #
 * # edge column does not, and that is the point of it:                       #
 * #                                                                        #
 * #   `readTypeGround`'s own output over that frame, chapter-plate at 0.43:  #
 * #                                                                        #
 * #   raw picture    level 0.90   edge p95 112    worst window 1.07:1       #
 * #   with the halo  level 0.51   edge p95 112    worst window 3.31:1       #
 * #   thresholds     0.62 max     128 max         3.0 min                   #
 * #                                                                        #
 * # AND THE SAME SHOT MEASURED ON A RENDERED CLIP, which is the number the   #
 * # developer's eye is on rather than the gate's. Frame 90 of 150 over the   #
 * # delivered film's own clean frame, glyph fill transparent so the reading  #
 * # is the GROUND the shapes leave rather than the cream ink:                #
 * #                                                                        #
 * #   beat 28   bare 1.04:1   with the halo 3.96:1   238,870 px darkened    #
 * #   beat 57   bare 1.50:1   with the halo 6.13:1   233,834 px darkened    #
 * #   beat  1   bare 1.05:1   with the halo 4.59:1    24,925 px darkened    #
 * #                                                                        #
 * # AND THE SHAPE HOLDS THROUGH THE BUILD, which a band never could: at      #
 * # frame 12, where the chapter plate's group is fully opaque but still at   #
 * # 0.861 scale, beat 28 reads 3.90:1 against the settled 3.96 — because the #
 * # halo rides inside the group transform and its blur-over-cap ratio is the #
 * # same on every frame. On frame 0, where no letter is drawn, the ground is #
 * # the bare picture EXACTLY: 0 px darkened.                                 #
 * #                                                                        #
 * # AND THE EDGE NUMBER IS ANSWERED RAW FOR EVERY DEVICE, at a ceiling that #
 * # depends on whether a ground is owned. A uniform dimming scales every     #
 * # Sobel edge by the same factor and removes not one printed rule, and a    #
 * # halo does not reach the print between the words at all, so discounting   #
 * # the reading is not leniency, it is blindness — see the box at the test.  #
 * # This is the pixel-side replacement for the one boolean the vision        #
 * # prompt can never answer correctly.                                       #
 * #                                                                        #
 * # WITH A GROUND IN PLAY, CONTRAST AND LEVEL BOTH STOP BINDING AND THE BUSY #
 * # RULE IS WHAT IS LEFT. At the shipped credits no picture that exists can  #
 * # fail LEVEL or CONTRAST under these two devices — a pure white ground     #
 * # still reads 4.17:1 under the corner label and 3.08:1 under the chapter   #
 * # plate — so the printed-matter ceiling is the live protection and it is   #
 * # stated as such rather than claimed alongside two dead tests. The census  #
 * # page clears the busy line at 112 against 128; beat 33's drawing at 204   #
 * # does not.                                                                #
 * ##########################################################################
 *
 * ##########################################################################
 * # NO MEASUREMENT ABSTAINS, AND THE OPPOSITE RULE WOULD KILL THE JOB.      #
 * #                                                                        #
 * # The obvious shape — "refuse the device when the worker could not look"  #
 * # — fails closed on beat 0 of every film, where T-11 REQUIRES P03 and     #
 * # `planGate` throws a `PermanentJobError` when it is missing. It would    #
 * # also delete every device from every plan built before this existed, and #
 * # from every beat whose picture is not on the machine doing the planning. #
 * #                                                                        #
 * # So it abstains, and the hole is closed from the other side: planCheck   #
 * # T-7 prints, per beat, whether the number it judged was measured or      #
 * # guessed. A gate that fails open and SAYS SO is honest; one that fails   #
 * # closed and takes the opening title with it is not.                      #
 * ##########################################################################
 */
function typeGroundRefusal(spec: DeviceSpec, reading: TypeGroundReading): RefusalCode | null {
  /*
   * ##########################################################################
   * # IT TAKES THE READING RATHER THAN THE BEAT SINCE 2026-09-21, so that     #
   * # `typeGroundRefusalFor` above can hold every abstention in one place and #
   * # this function can do nothing but test numbers. A second                 #
   * # `readTypeGround` call here would be a second answer to the same         #
   * # question, which is exactly how G8 and G8c came apart.                   #
   * #                                                                        #
   * # THE THREE TESTS BELOW ARE UNCHANGED, INCLUDING THEIR THRESHOLDS. The    #
   * # contrast test still refuses at `TYPE_GROUND_MIN_CONTRAST`, 3.0, on a    #
   * # ground modelled at the device's own recorded credit.                    #
   * ##########################################################################
   */
  /*
   * G9's PIXEL HALF. The same measurement, asked as the question G9 has always
   * meant to ask. It reads the RAW edge number for EVERY device, and what the
   * wash buys is a higher ceiling rather than a discount on the reading.
   *
   * ##########################################################################
   * # ONE TEST, TWO CEILINGS, AND IT WAS ONE TEST AND ONE HOLE.               #
   * #                                                                        #
   * # This used to read the raw number only where `spec.scrimAlpha <= 0` and  #
   * # then ask the WASHED number the same question. For corner-label and     #
   * # chapter-plate that was two dead lines: the first was skipped, and the  #
   * # second needed a raw p95 of 96 / 0.45 = 213 to fire, which is above     #
   * # every picture in this film. The two devices the whole change exists to #
   * # protect had no picture gate left at all.                                #
   * #                                                                        #
   * # `spec.scrimAlpha` still separates a device that solved the problem     #
   * # from one that merely declares it has — the registry said 'scrim' on    #
   * # both of these for a week while neither drew one — but now it chooses   #
   * # WHICH LINE the picture is held to, not whether it is held to one.      #
   * # Both numbers live in `typeGround.ts`, out of the compositor's bundle,  #
   * # so either can be retuned for a re-plan instead of 87 minutes.           #
   * ##########################################################################
   */
  const edgeCeiling =
    spec.scrimAlpha > 0 ? TYPE_GROUND_MAX_EDGE_P95_WASHED : TYPE_GROUND_MAX_EDGE_P95
  if (reading.rawEdgeP95 > edgeCeiling) return 'picture-has-baked-text'

  if (reading.level > TYPE_GROUND_MAX_LEVEL) return 'type-ground-too-weak'
  if (reading.worstWindow < TYPE_GROUND_MIN_CONTRAST) return 'type-ground-too-weak'
  return null
}

/**
 * THE ONE READING. Null when this beat's picture was never measured, or this
 * device sets no type on a photograph, or its copy cannot be measured.
 *
 * ##########################################################################
 * # EVERY ABSTENTION IS HERE, WHERE THERE IS ONE OF EACH THING TO ABSTAIN   #
 * # ON. The ground can exist while `typeGroundRectsFor(copy)` returns null, #
 * # because a fit module refused to measure that copy, and                  #
 * # `readTypeGround` can come back null because nothing in the profile      #
 * # covered the rectangle. All three mean the same thing — nobody looked —  #
 * # and `typeGroundRefusal` above is left to do nothing but test numbers.   #
 * ##########################################################################
 *
 * ##########################################################################
 * # THREE CALLERS NOW, AND THE THIRD IS WHY THE SECOND EXISTS.              #
 * #                                                                        #
 * #   `typeGroundRefusalFor`  G8c, at CHOOSE time. Refuses the device.      #
 * #   `device-replay.ts` and the probes. Print what a refusal was made on.  #
 * #   `typeGroundReadings` in plan.ts, which freezes the numbers beside the #
 * #   plan so planCheck T-26 can ask the same question of the FROZEN plan.  #
 * #                                                                        #
 * # T-26 DOES NOT RE-DERIVE ANYTHING. It reads the reading this function    #
 * # produced, so the floor the gate applies and the floor the chooser       #
 * # applied are applied to one number rather than to two that agree today.  #
 * # See `ruleT26` in `apps/worker/scripts/harness/planCheck.ts`.            #
 * ##########################################################################
 *
 * ##########################################################################
 * # IT TAKES THE GROUND RATHER THAN THE BEAT, SINCE 2026-09-22, because the #
 * # plan stage's caller holds the measurements in a map keyed by storage    #
 * # path and has no `DeviceBeat` left by the time the devices are settled.  #
 * # The chooser passes `beat.typeGround` and reads exactly as it did.       #
 * ##########################################################################
 *
 * ##########################################################################
 * # IT READS `spec.scrimAlpha`, WHICH IS NOW THE ONLY GROUND NUMBER EITHER  #
 * # OF THESE DEVICES HAS. For one day it read a per-shot `washAlpha` off    #
 * # the copy instead, because the frame was drawing a band at a depth       #
 * # solved from that shot's own pixels and printing the registry cap's      #
 * # numbers beside a frame drawn at 0.37 would have described no frame.     #
 * # Both devices draw a fixed glyph halo now, so the cap and the drawn      #
 * # number are one number again and this reads the row like every other     #
 * # device's.                                                               #
 * ##########################################################################
 */
export function typeGroundReadingFor(
  spec: DeviceSpec,
  copy: SceneDevice,
  ground: AssetTypeGround | null | undefined,
): TypeGroundReading | null {
  if (ground === null || ground === undefined) return null
  const ink = typeGroundInkRelLum(spec.id)
  if (ink === null) return null
  const rects = typeGroundRectsFor(copy)
  if (rects === null || rects.length === 0) return null
  return readTypeGround(ground, rects, ink, spec.scrimAlpha)
}

/*
 * ##########################################################################
 * # `drawnWashAlpha` LIVED HERE AND IS DELETED RATHER THAN COLLAPSED.       #
 * #                                                                        #
 * # It existed for one day to answer "the registry row, or this copy's own  #
 * # solved depth?" in ONE place, so that planCheck T-7 could not retype the #
 * # branch and come to a different answer from the frame. The branch is     #
 * # gone: no copy carries a depth, both wash devices draw a fixed glyph     #
 * # halo, and the function would have been `return spec.scrimAlpha` with an #
 * # argument it never read, which is the kind of indirection that makes a   #
 * # later reader look for a distinction that no longer exists.              #
 * #                                                                        #
 * # T-7 WAS ITS ONLY CALLER and now reads `spec.scrimAlpha` directly, with  #
 * # its own box saying so. `device-replay.ts` never called it.              #
 * ##########################################################################
 */

/**
 * THE DEVICES THE CLIENT'S DATE RULE COVERS. See G15.
 *
 * ##########################################################################
 * # TWO, SINCE P14, AND THEY ARE EQUALS RATHER THAN A PAIR WITH A          #
 * # PREFERENCE. His rule is about the FACT — "a year that misses P12 is a  #
 * # defect, not a fallback" — and P14 draws the same fact faster. The      #
 * # developer ruled P14 an equal treatment, so the set is what the rule    #
 * # means today and G15 asks the set rather than an id.                    #
 * #                                                                        #
 * # A SET RATHER THAN TWO COMPARISONS, so the day a third year treatment   #
 * # is approved there is one line to change and it is next to the rule it  #
 * # states, instead of an `||` in a gate and a second one in a helper       #
 * # drifting apart.                                                        #
 * ##########################################################################
 */
const YEAR_TEMPLATES: ReadonlySet<DeviceId> = new Set<DeviceId>(['P12', 'P14'])

/**
 * Can EITHER year template draw on this beat? The answer G15 needs, computed
 * once per beat.
 *
 * `false` for the ordinary case of a beat that speaks no date — both devices'
 * G14 sees neither `single_historical_date` nor `fast_date_emphasis` in the
 * jobs and refuses, so this returns false without any special-casing of what a
 * date is.
 *
 * ##########################################################################
 * # P12 IS ASKED FIRST AND THE ORDER IS NOT AN ACCIDENT. On a beat with no  #
 * # P14 row, P12 answers and P14 is never probed at all, so the common case #
 * # costs exactly what it cost before P14 existed. On a beat WITH a row,    #
 * # both may answer and either one is enough — the gate only asks whether   #
 * # the beat has an owner, and which owner it is is the score's business.   #
 * ##########################################################################
 */
function yearTemplateClaims(
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
): boolean {
  /*
   * `false` for the flag, which is what stops this recursing: a year template
   * asking whether a year template claims the beat is the one call that must
   * not consult G15.
   *
   * `false` for G16's flag too, and here it is free rather than delicate: G16
   * only ever refuses a device that draws no words, and both of these draw a
   * year. So the answer is the same either way and the ordering — G15's input
   * first, G16's second — carries no hidden dependency.
   *
   * NOTHING WAIVED. G15 is a rule about the film the beat is really in, so it
   * must be answered against the gates as they really are — the fallback
   * walk's two waivers would let a year template claim a beat it could not
   * then draw.
   */
  for (const id of YEAR_TEMPLATES) {
    const spec = DEVICE_REGISTRY[id]
    if (attempt(spec, beat, state, jobs, false, false, false, NO_WAIVERS).copy !== null) return true
  }
  return false
}

/** Every string this device will actually SET, id aside. T-1's own check. */
export function printedLines(copy: SceneDevice): string[] {
  return Object.entries(copy)
    .filter(([key]) => key !== 'id')
    .flatMap(([, value]) => {
      if (typeof value === 'string') return [value]
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
      return []
    })
}

/**
 * Would a device that prints words actually put THIS BEAT'S SECTION MENTION on
 * screen? The answer G16 needs, computed once per beat. T-1, T-4.
 *
 * ##########################################################################
 * # THREE CONDITIONS AND ALL THREE ARE LOAD-BEARING.                       #
 * #                                                                        #
 * # A USABLE SECTION MARK. `usableMarks` is what makes it usable — heard    #
 * # in this shot and spelled the way the script spells it — because T-6     #
 * # outranks T-1 and a mark that cannot legally become copy cannot oblige   #
 * # anything. A beat where the aligner merely thought it heard a chapter    #
 * # number owes nothing. STATED HONESTLY: the third condition below already  #
 * # implies this one, because unusable marks never reach printed copy. It   #
 * # is kept because it says what the rule IS, and because it is the cheap   #
 * # test — it exits before running eight gates and a copy build.            #
 * #                                                                        #
 * # SOMETHING THAT CAN ACTUALLY DRAW HERE, proved the only honest way: by   #
 * # running the real gates and the real copy builder. An "is P03 plausible" #
 * # heuristic would drift from what P03 does the first time a gate moved.   #
 * #                                                                        #
 * # AND THE COPY IT BUILT HAS TO CONTAIN THE MENTION, which is the          #
 * # condition that keeps this gate from costing more than it buys. A beat   #
 * # can speak a chapter AND name two other things; P03 then has candidates  #
 * # that are not the chapter, and on a film where an earlier beat has       #
 * # already set that chapter as a headline it will reach for one of them.   #
 * # Refusing the mosaic in that case removes a treatment and covers         #
 * # nothing. T-1's own check is "every section mark appears as a P03        #
 * # kicker or headline", so that is what is asked here, against the strings #
 * # the device will really set rather than against its id.                  #
 * #                                                                        #
 * # WHOLE-STRING, NOT SUBSTRING. "Chapter 39" inside "Chapters 37 through   #
 * # 71" is a different mention, and the standard counts the mark, not a     #
 * # collision of its characters.                                            #
 * ##########################################################################
 */
/**
 * WOULD THE MANDATORY OPENING GALLERY ACTUALLY DRAW ON THIS BEAT?
 *
 * ##########################################################################
 * # THE CONDITIONAL IS THE WHOLE POINT, AND BOTH EXISTING PRECEDENTS SAY SO #
 * # IN THEIR OWN BOXES.                                                     #
 * #                                                                        #
 * # G15 refuses the others on a date beat only when a year template can     #
 * # really draw there. G16 refuses the wordless devices only when a word-   #
 * # carrying one has passed every gate AND built copy that covers the       #
 * # mention. Both were written that way after an unconditional version      #
 * # turned ONE refusal into TWO and left a beat drawing nothing at all.     #
 * #                                                                        #
 * # So this asks the real question — would `attempt` place it here, with no #
 * # waivers — rather than "is this the carrier". A carrier whose preview    #
 * # pictures fell through, or whose beat drifted out of the frame window,   #
 * # leaves the other devices to compete for it exactly as before.          #
 * ##########################################################################
 */
function openingBeatClaimsA8(
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
  dateBeatBelongsToAYearTemplate: boolean,
): boolean {
  if (beat.openingCarrierIndex === null || beat.index !== beat.openingCarrierIndex) return false
  const spec = DEVICE_REGISTRY['gallery-strip']
  if (!spec.mandatoryOnce) return false
  return attempt(spec, beat, state, jobs, dateBeatBelongsToAYearTemplate, false, false, NO_WAIVERS).copy !== null
}

function sectionBeatClaimsWords(
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
  dateBeatBelongsToAYearTemplate: boolean,
): boolean {
  const wanted = new Set(
    usableMarks(beat)
      .filter((mark) => mark.detector === 'section')
      .map((mark) => normaliseToken(mark.text)),
  )
  if (wanted.size === 0) return false

  for (const id of DEVICE_IDS) {
    const spec = DEVICE_REGISTRY[id]
    if (!drawsWords(spec)) continue
    /*
     * ######################################################################
     * # A DEVICE G18 STANDS DOWN CANNOT BE THE ONE THAT MAKES THE BEAT OWE  #
     * # WORDS. Review C1, and the beat it would blank is concrete: one      #
     * # section mark, so P03 has no kicker, and a 05 asked to print that    #
     * # mark. Counted here, 05 sets the flag; G18 then stands 05 down, G16  #
     * # refuses every wordless device, and the beat draws NOTHING. That is  #
     * # one refusal turned into two, which G16's own box forbids.           #
     * #                                                                    #
     * # Skipped, the flag is true only where a spoken treatment really      #
     * # prints the mention, and 05 carries it on the planner's bonus        #
     * # otherwise. The pictures-0 half was latent: a2 and a3 are refused at #
     * # G1 before a probe can build their copy.                             #
     * ######################################################################
     */
    if (standsDownToSpokenWords(spec)) continue
    /*
     * `false` for G16's own flag, which is what stops this recursing — and it
     * changes no answer, because every device reaching here draws words and G16
     * refuses only devices that do not. G15's flag is passed through REAL, so
     * the probe sees the same film this beat is actually in.
     *
     * NOTHING WAIVED, for the same reason as `yearTemplateClaims`: this decides
     * what the REAL competition owes the beat, so it has to be asked against the real
     * gates. And it goes through `attempt` rather than `refuse` + `buildCopy` —
     * see the box on `attempt` for the beat that proved the difference.
     */
    const tried = attempt(spec, beat, state, jobs, dateBeatBelongsToAYearTemplate, false, false, NO_WAIVERS)
    if (tried.copy === null) continue
    if (printedLines(tried.copy).some((line) => wanted.has(normaliseToken(line)))) return true
  }
  return false
}

/* ------------------------------------------------------------------------- */
/* The score                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * The partner's seven terms, each 0..1000, weighted by his own hundredths.
 *
 * INTEGER THROUGHOUT. See the box on `DEVICE_WEIGHTS` — a device choice is
 * hashed into the segment cache key, so a float that reassociates differently
 * on another platform would fork the cache between two runs that chose the same
 * thing.
 */
/**
 * T-8's bar, and it deliberately mirrors `OVERLAY_MIN_PICTURE_SCORE` in plan.ts.
 *
 * The ranker's own prompt defines 3-5 as "generic; it would not be wrong, but it
 * says nothing", and 6 as the first score meaning the picture shows THE thing the
 * scene is about. Naming a picture is a claim that it shows the named thing, so
 * the bar for naming is the bar the ranker itself drew.
 *
 * TWO COPIES OF THIS NUMBER NOW EXIST, in two packages that cannot import each
 * other. `scripts/harness/planCheck.ts` reads plan.ts's copy at run time and
 * judges both doors by it, so a drift between them goes red rather than quiet.
 */
export const MIN_SCORE_TO_NAME_A_PICTURE = 6

/**
 * THE BAR FOR AN EDITORIAL LINE, WHICH IS HIGHER THAN THE BAR FOR A SPOKEN ONE.
 *
 * ##########################################################################
 * # A RENDERED FRAME IS WHY, AND IT SHIPPED BEFORE IT WAS CAUGHT.          #
 * #                                                                        #
 * # V21 scene 36 drew "THE BOOK OF ENOCH / CHAPTER 39" over an ILLUMINATED #
 * # ARABIC MANUSCRIPT. The ranker scored it 7 — over the 6 that lets a      #
 * # picture be named — and its own words were "Fits the visual intent      #
 * # closely with illuminated section headings and warm lighting". True,    #
 * # and not the question. TRAP V, for the fourth time on this project.     #
 * #                                                                        #
 * # It is the v9 defect through a new door: a Qur'an-shaped page captioned #
 * # as Enoch. And it is not one beat — scene 37 is                          #
 * # `intricately-illustrated-arabic-manuscript`, ALSO 7, and was held off  #
 * # only by the variety cooldown behind scene 36.                          #
 * #                                                                        #
 * # WHY A HIGHER BAR RATHER THAN A NEW KIND OF CHECK. T-8's 6 was          #
 * # calibrated for copy the NARRATOR SPOKE in that shot, where the words   #
 * # are true whatever the picture is. An editorial line is the tool         #
 * # asserting a relationship of its own, so it is a stronger claim and it  #
 * # earns a stronger picture. 8 is "shows THE thing" rather than "suits    #
 * # the beat".                                                             #
 * #                                                                        #
 * # MEASURED ON V21's OWN PLAN, and the separation is clean on the two     #
 * # frames that matter:                                                    #
 * #   scene 33  Chester Beatty XII papyrus            8    KEPT            #
 * #             ranker: "Authentic papyrus leaf ... containing Greek text  #
 * #             of the Book of Enoch"                                      #
 * #   scene 36  generic Pexels illuminated manuscript 7    REFUSED         #
 * #   scene 37  Arabic illuminated manuscript         7    REFUSED         #
 * #                                                                        #
 * # STATED PLAINLY: 8 is calibrated on ONE film. What it is NOT is the     #
 * # general fix — that is the ranker's prompt, which should be asked       #
 * # whether the picture IS the thing rather than A thing of that kind.     #
 * # A CORROBORATION GATE CANNOT SUBSTITUTE and was tried on paper: the     #
 * # Chester Beatty URL does not contain the word "Enoch" either, so        #
 * # matching provenance would refuse the GOOD frame as well. Trap NN says  #
 * # the ranker's free text cannot be the haystack, and that is why the     #
 * # score is what this reads.                                              #
 * ##########################################################################
 */
export const MIN_SCORE_FOR_AN_EDITORIAL_LINE = 8

/**
 * THE LONGEST CHAPTER TITLE a3 CAN DRAW WITHOUT RUNNING OFF THE FRAME.
 *
 * ##########################################################################
 * # MEASURED OFF RENDERED FRAMES, AND THE OLD VALUE OF 48 NEVER WAS.        #
 * #                                                                        #
 * # `ChapterTitle.tsx` sets `whiteSpace: 'pre'` on a full-width centred     #
 * # block at a FIXED font size, so a long caption does not wrap, does not   #
 * # shrink and does not clip to a box. It runs off BOTH edges of the frame  #
 * # and nothing anywhere errors.                                            #
 * #                                                                        #
 * # THE BINDING FRAME IS THE PEAK OF THE ZOOM, NOT THE SETTLED ONE, AND     #
 * # MEASURING THE WRONG FRAME GIVES AN ANSWER THAT IS TOO GENEROUS BY A     #
 * # QUARTER. a3 swells to 1.209991 of its rest scale around frame 75 and    #
 * # holds there, so a caption that fits at frame 149 can still run off the  #
 * # screen for a second in the middle of the shot. Both were rendered.      #
 * #                                                                        #
 * # AT REST, frame 149:                    AT PEAK, frame 75:               #
 * #   20  1444  fits                         13  1277  fits                 #
 * #   22  1605  fits                         18  1709  fits                 #
 * #   27  1886  fits                         19  1663  fits                 #
 * #   26  1910  CLIPPED                      20  1745  fits                 #
 * #   29  1920  CLIPPED                      21  1831  fits                 #
 * #   16  1920  CLIPPED (capital W)          22  1920  CLIPPED              #
 * #   40  1512  fits (lower-case i)          27  1920  CLIPPED              #
 * #                                          12  1920  CLIPPED (capital W)  #
 * #                                                                        #
 * # So the boundary is 21 fits and 22 clips, and real mixed-case English    #
 * # titles measure a remarkably steady 87.2 to 88.5 px per character at     #
 * # peak. 20 is that boundary with an 8% margin rather than 4.6%.           #
 * #                                                                        #
 * # TWELVE OF THE FOURTEEN TITLES IN THE FIRST REAL DOSSIER WOULD HAVE RUN  #
 * # OFF THE SCREEN, including one the chooser had already placed.           #
 * #                                                                        #
 * # A CHARACTER COUNT IS THE WRONG GUARD AND THE REST TABLE PROVES IT — 26  #
 * # clips where 27 fits, because a count cannot see letter widths. It is    #
 * # also the only guard a deterministic chooser with no font metrics can    #
 * # express, exactly as `P17_LABEL_MAX_CHARS` is.                            #
 * #                                                                        #
 * # RESIDUAL, STATED RATHER THAN HIDDEN: a 20-character title in capitals   #
 * # can still clip — twelve capital W measure 160px per character at peak   #
 * # against 88 for real prose. The research prompt asks for sentence case   #
 * # and for headings this short, so the model produces copy that fits by    #
 * # construction, and this is the backstop for a dossier written under an   #
 * # older prompt. Closing it completely needs the face's advance table,     #
 * # which nothing in this repo parses.                                      #
 * ##########################################################################
 */
export const CHAPTER_TITLE_MAX_CHARS = 20

/*
 * ##########################################################################
 * # NIKU'S THREE, 2026-09-14, AND EACH ONE IS THE SCHEMA BOUND RESTATED     #
 * # SO THE REFUSAL IS OURS AND NOT ZOD'S.                                   #
 * #                                                                        #
 * # Every one of these is CHECKED HERE AS WELL AS IN THE SCHEMA, for the    #
 * # reason P02, P05 and P09's arms all state: a refusal from `buildCopy`    #
 * # names the device and the beat in the chooser's own log, and a zod parse #
 * # failure at the boundary does not.                                       #
 * #                                                                        #
 * # NONE OF THEM IS A WIDTH CHECK. The character count is the shape of the  #
 * # copy; `chapterPlateHeadingFits`, `topTitleLine1Fits` and               #
 * # `cornerLabelLabelFits` are whether it fits. Both run, and the width one #
 * # runs second, because a twenty-character heading of narrow letters can   #
 * # sit inside a box a sixteen-character one of broad letters overflows.    #
 * ##########################################################################
 */

/**
 * THE CLIENT'S OWN NUMBER, GIVEN IN WRITING ON 2026-09-16.
 *
 * ##########################################################################
 * # "Shrink long titles to fit. I would say maximum 25 character titles     #
 * # might be good limit." It was 20 until that ruling, matching a3's own    #
 * # `CHAPTER_TITLE_MAX_CHARS` so that a heading moved between the two       #
 * # styles was not refused by one of them for a reason that reads like a    #
 * # bug. THE TWO NO LONGER MATCH, and they should not: a3 cannot shrink     #
 * # and this one now can, so 20 is a real ceiling there and a shape here.   #
 * #                                                                        #
 * # ######################################################################  #
 * # # `devices.ts` STILL SAYS `deviceText(20)` AND IT HAS TO FOLLOW.     #  #
 * # #                                                                    #  #
 * # # `DeviceSchema`'s chapter-plate arm is the BOUNDARY; this constant  #  #
 * # # is the restatement that makes a refusal legible in the chooser's   #  #
 * # # own log. While the schema says 20 and this says 25, a 21 to 25     #  #
 * # # character heading passes the chooser and is refused by zod at the  #  #
 * # # plan boundary, which is the least readable place for it to fail.   #  #
 * # #                                                                    #  #
 * # # IT IS INERT ON THE FILM IN FRONT OF US, WHICH IS WHY IT IS SAFE TO #  #
 * # # LAND HALF OF IT. The chapter plate's heading is                     #  #
 * # # `beat.editorialTitle`, i.e. a dossier section title, and job       #  #
 * # # c75d51e6's eleven section titles are 11 to 20 characters. The      #  #
 * # # longest, "The name is the self", is exactly 20. So nothing on this #  #
 * # # film reaches the gap. `devices.ts:699` is owned by another agent   #  #
 * # # this session and must go to `deviceText(25)` before a heading of   #  #
 * # # 21 characters or more can ever reach a frame.                      #  #
 * # ######################################################################  #
 * ##########################################################################
 */
export const CHAPTER_PLATE_MAX_CHARS = 25
/** Both top-title lines, matching `deviceText(28)` on its schema arm. */
export const TOP_TITLE_MAX_CHARS = 28
/** The corner label's main line, matching `deviceText(18)`. */
export const CORNER_LABEL_MAX_CHARS = 18
/** Its kicker, matching `deviceText(14)`. Shorter because it is set smaller and
 * sits under a line that is already at the title-safe margin. */
export const CORNER_LABEL_KICKER_MAX_CHARS = 14

/**
 * MAY A SHORT SHOT DROP THE KICKER RATHER THAN LOSE THE DEVICE? IT MAY, AND
 * THIS IS THE SWITCH THAT TURNS THAT OFF.
 *
 * ##########################################################################
 * # THIS IS A VISUAL DECISION ON THE CLIENT'S OWN DESIGN AND HE HAS NOT     #
 * # BEEN ASKED. It is written as a constant, in one place, so the answer    #
 * # "no, always both lines" is one word and no reasoning.                   #
 * #                                                                        #
 * # WHAT IT IS WORTH, measured on job c75d51e6's own 164 shots through      #
 * # `apps/worker/scripts/device-replay.ts`:                                 #
 * #                                                                        #
 * #   both lines, longest copy the schema admits   61 shots are long enough #
 * #   both lines, the copy actually written        132                      #
 * #   label alone                                  161                      #
 * #                                                                        #
 * # SO IT IS THE DIFFERENCE BETWEEN A DEVICE HE HAS APPROVED APPEARING AND  #
 * # NOT. It never shortens a line — the kicker is drawn whole or left off,  #
 * # which is the same rule `top-title`'s second line and P04's support line #
 * # already follow, and `CornerLabel` omits the block for an empty kicker    #
 * # rather than drawing a gap.                                              #
 * #                                                                        #
 * # THE LABEL NEVER DEGRADES. A shot too short for the label alone refuses  #
 * # the device outright: there is nothing left to drop, and a half-drawn    #
 * # label is the exact defect this whole change exists to stop.             #
 * ##########################################################################
 */
export const CORNER_LABEL_KICKER_MAY_DEGRADE = true

/**
 * CAN THIS SHOT DRAW THIS CORNER LABEL AT ALL — with both lines, or with the
 * label alone if the kicker is allowed to go?
 *
 * ONE FUNCTION BECAUSE TWO CALLERS ASK IT AND THEY MUST NOT DRIFT. The seater
 * in `visualPlan.ts` asks it to decide whether a shot may hold a planner row,
 * and `buildCopy`'s own arm asks it again over the copy it has just built. A
 * seater that were stricter would throw away rows the arm would have drawn; a
 * seater that were looser would seat rows the arm then refuses, and the beat
 * would draw nothing at all. `attempt()`'s own header records what that gap
 * cost the last time two callers asked the same question their own way.
 */
export function cornerLabelShotIsLongEnough(
  durationFrames: number,
  label: string | null | undefined,
  kicker: string | null | undefined,
): boolean {
  /*
   * TRIMMED FIRST, because `buildCopy` trims both slots before it counts and a
   * slot is one drawn character. An all-whitespace kicker is NOT a kicker —
   * `CornerLabel` omits the block for it — so it must not buy itself frames of
   * build here and then be refused as nothing to degrade.
   */
  const wrote = (kicker ?? '').trim()
  if (cornerLabelFinishesInside(durationFrames, label, wrote)) return true
  if (!CORNER_LABEL_KICKER_MAY_DEGRADE || wrote.length === 0) return false
  return cornerLabelFinishesInside(durationFrames, label, '')
}

/**
 * The lowest a COMPANION may score and still be one of four pictures on a frame.
 *
 * A JUDGEMENT, and the box on gate G2b argues it at length. It is the value of
 * `TEXT_CARD_BELOW_SCORE` in the sourcer, the line below which that stage would
 * rather draw nothing than draw the picture — but that constant is compared
 * against `finalScore` and this one against `vision.score`, so this is informed
 * by that number and is not the same test. Say so rather than calling it read.
 *
 * Measured over the 78 four-picture beats of job 835cd84f, the number of beats a
 * floor admits: 6 leaves 3, 5 leaves 8, 4 leaves 34.
 *
 * ##########################################################################
 * # FIVE SINCE 2026-09-04, AND FOUR FAILED BY ONE TICK ON A FRAME THE       #
 * # CLIENT SENT BACK.                                                       #
 * #                                                                        #
 * # Job 2629eec5, shot 24 at 1:20.4. A P22 mosaic whose four pictures       #
 * # scored 6.8 (its own) and 6.0, 5.2, 4.0 (its companions). The weakest is #
 * # EXACTLY 4.0, `4 < 4` is false, and the frame shipped. The 4.0 panel is  #
 * # a Pexels shelf of Swiss legislative bindings that the ranker itself     #
 * # described as "Shows shelf books, but the bright red bindings look too   #
 * # modern" — a 19th-century Bernese statute book in a film about the Book  #
 * # of Enoch.                                                               #
 * #                                                                        #
 * # FOUR SAT INSIDE THE BAND THIS FLOOR EXISTS TO EXCLUDE. The vision       #
 * # prompt tells the model 3 to 5 means "generic; it would not be wrong,    #
 * # but it says nothing", so a floor of 4 admitted the middle of the        #
 * # generic band while claiming to keep it out. Five is the top of that     #
 * # band and the first score the prompt calls specific.                     #
 * #                                                                        #
 * # IT DOES NOT COST THE ONE GOOD MOSAIC. The delivered film's correct      #
 * # four-picture frame, the P19 at 0:49 over Qumran, carries companions     #
 * # scoring 6, 5 and 5. Its weakest is 5, so this floor keeps it, and the   #
 * # test beside it pins exactly that.                                       #
 * ##########################################################################
 */
export const MIN_COMPANION_SCORE = 5

/**
 * The fewest pictures the opening gallery will draw.
 *
 * SAKU 0.3, VERBATIM, twice: "Reject or flag the beat if fewer than three valid
 * images are available", and "Use the strongest three images when only three
 * legitimate future subjects are available."
 *
 * NOTE THE COMPONENT CANNOT YET DRAW THREE. `GALLERY_STRIP_CARD_COUNT` is 4 and
 * the camera path is fitted to a four-card strip, so three cards is a re-fit
 * against a reference clip this repo does not have, not a parameter. Until then
 * the picker takes four or the beat falls back, and TREATMENT-STANDARD.md §6
 * records the gap rather than hiding it. This constant is his floor, kept honest
 * so the day the component can do three, one number changes.
 */
export const MIN_PREVIEW_PICTURES = 4

/**
 * May this beat's picture be NAMED? T-8, and a null fails.
 *
 * ##########################################################################
 * # NO OPINION IS NOT AN ACCEPTABLE OPINION, and that is the whole reason   #
 * # this reads `!== null` rather than leaning on a comparison.              #
 * #                                                                        #
 * # The brightness gate G8 is written `meanLuma !== null && meanLuma > max`,#
 * # so a MISSING reading passes it. A generated image carries no vision     #
 * # record at all, so that hole is exactly how a fabricated picture could   #
 * # take a titled beat. This gate fails the other way on purpose: unjudged  #
 * # means unnameable.                                                       #
 * ##########################################################################
 */
function pictureEarnsAName(beat: DeviceBeat): boolean {
  return beat.visionScore !== null && beat.visionScore >= MIN_SCORE_TO_NAME_A_PICTURE
}

/**
 * Does this copy make a claim ABOUT THE PHOTOGRAPH?
 *
 * A switch on the union rather than a flag on the spec, because it is a property
 * of the words a device drew and not of the device. `SceneDevice` is a
 * discriminated union, so a new member is a COMPILE ERROR here rather than a
 * silent `false` — which is the safe direction, since a silent false would let a
 * new device name any picture it liked.
 *
 * P12 IS THE INTERESTING ONE. It draws a year, and a year belongs to the
 * narration rather than to the picture: "1947" over a middling photograph of
 * Qumran says nothing false about that photograph. The client kept both of his
 * year frames. So P12 is exempt, and it is exempt for a stated reason rather
 * than because it happened to pass.
 *
 * EXPORTED FOR CHECK-PLAN, WHICH READS THIS SWITCH RATHER THAN KEEPING AN ID
 * LIST. P08 prints no words and answers true, and a checker that decided
 * "named" off the printed strings alone passed a P08 over an AI frame and over
 * a picture scored 4. See `beatsOf` in `apps/worker/scripts/harness/planCheck.ts`.
 */
export function copyNamesThePicture(copy: SceneDevice): boolean {
  switch (copy.id) {
    /* Words that title, label or caption what is on screen. */
    case 'P03':
    case 'P17':
    case 'framed-card':
    case 'pointer-label':
    case 'chapter-title':
    case 'name-card':
    case 'two-photo-zoom':
    case 'highlight-page':
    case 'bullet-checklist':
    case 'P13':
    case 'P16':
    /* Template 05's line stamps a fact under the picture, so the picture has to be the thing. */
    case 'shadow-up':
    /*
     * ########################################################################
     * # NIKU'S FOUR, ALL TRUE, AND TWO OF THEM ARE NOT CLOSE CALLS.          #
     * #                                                                      #
     * # `name-plate` prints a PERSON'S NAME on a photograph. That is trap V  #
     * # exactly, and it is the shape that produced Enoch Powell captioned    #
     * # "Enoch" and a Qur'an page captioned "1 Enoch 39". `corner-label`     #
     * # prints what the thing on screen IS, with a century under it, which   #
     * # is the same claim P04 makes and the reason P04 answers true.         #
     * #                                                                      #
     * # `chapter-plate` and `top-title` are the P02 case rather than the P04 #
     * # case: their words are about the passage, not labels. They answer     #
     * # true anyway, on the safe side and for P02's stated reason — they set #
     * # the largest type on the frame directly over the photograph with no   #
     * # plate under it, so a viewer reads them as being about what is on     #
     * # screen. `chapter-title` is already on this side of the switch for    #
     * # the same reason and this is its second style.                        #
     * #                                                                      #
     * # T-8's bar then keeps all four off a weak picture and, through the    #
     * # null score every generated frame carries, off every AI frame (T-10). #
     * ########################################################################
     */
    case 'chapter-plate':
    case 'top-title':
    case 'corner-label':
    case 'name-plate':
      return true
    /*
     * ########################################################################
     * # P08 PRINTS NO WORDS AND STILL MAKES A CLAIM ABOUT THE PHOTOGRAPH.     #
     * #                                                                      #
     * # Its whole treatment is the claim: one picture, framed in gold over a #
     * # dark copy of itself, presented as THE source the narration is about. #
     * # A generic stock page in that frame reads as the manuscript itself,   #
     * # which is the defect T-8 exists for, with the caption left off.       #
     * #                                                                      #
     * # SO T-8's BAR APPLIES, AND IT CLOSES T-10 FOR FREE. `pictureEarnsAName`#
     * # wants a score of 6 or more, and `plan.ts` hands every AI-generated   #
     * # frame a null score, so an invented picture is never presented as a   #
     * # source. photo-pop draws the same picture as a card with no framing  #
     * # claim, which is why it stays on the other side of this switch.      #
     * ########################################################################
     */
    case 'P08':
      return true
    /*
     * P04's label and support line say what the photograph IS, which is the
     * claim T-8 exists for. The pack's card: "a small source, date, place, or
     * object identifier".
     */
    case 'P04':
      return true
    /*
     * P02's headline is a statement about the passage rather than a label, and
     * it answers true anyway, on the safe side. It is the largest type any
     * picture device sets, on a card laid over the photograph, so a viewer reads
     * it as being about what is on screen. T-8's bar then keeps it off a weak
     * picture and, through the null score, off every AI frame (T-10).
     */
    case 'P02':
      return true
    /*
     * P09's question is about the passage rather than a label, and it answers
     * true on the safe side, for P02's reason: 54 px type on a card laid over the
     * photograph reads as being about what is on screen. T-8's bar then keeps it
     * off a weak picture and, through the null score, off every AI frame (T-10).
     */
    case 'P09':
      return true
    /*
     * P05's picture label says what the photograph IS, which is the claim T-8
     * exists for, and its claim is set beside the photograph as the evidence
     * for it. Either alone answers true. T-8's bar then keeps it off a weak
     * picture and, through the null score, off every AI frame (T-10).
     */
    case 'P05':
      return true
    /* A date. It names the moment, not the photograph. */
    case 'P12':
    /*
     * ########################################################################
     * # AND P14, WHICH IS THE SAME DATE AT A DIFFERENT TEMPO. It draws four   #
     * # digits and nothing else — its label and its caption are both '' and   #
     * # the component omits their blocks, and the pack's hardcoded            #
     * # "Verified date marker" tag is CUT. So the ONLY thing on the frame is  #
     * # a year, and a year belongs to the narration rather than to the        #
     * # picture: 1947 over a middling photograph of Qumran says nothing false #
     * # about that photograph. The client kept both of his year frames.       #
     * #                                                                       #
     * # SO P14 IS EXEMPT FROM T-8 AND MAY SIT ON AN AI FRAME, WHICH IS        #
     * # RULING D4 — "A P12 year card may sit on an AI picture (it names no    #
     * # picture)". The ruling is about what a year CLAIMS, not about which    #
     * # template draws it, so it covers this one on its own terms.            #
     * #                                                                       #
     * # THE SIZE OF THE TYPE IS NOT THE TEST, and it is worth saying because  #
     * # P02 and P09 answer TRUE partly on size. 132 px of spinning digits is  #
     * # the largest type any device in this registry sets. It still names no  #
     * # picture, because a viewer reads "1947" as when, never as what. What   #
     * # the size actually buys is the brightness ceiling and G14g, which is   #
     * # where a claim this loud is answered.                                  #
     * ########################################################################
     */
    case 'P14':
      return false
    /* No words at all. */
    case 'photo-pop':
    case 'P22':
    case 'P19':
    case 'gallery-strip':
      return false
  }
}

/**
 * What a template named by the visual planner is worth, against a maximum
 * possible score of 100,000 from the seven weighted terms — the weights sum to
 * 100 and every term is bounded at 1000. An order of magnitude above that
 * ceiling, so the comparison needs no arithmetic. See the box in `score`.
 */
const PLANNED_BONUS = 1_000_000

function score(
  spec: DeviceSpec,
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
  copy: SceneDevice,
): number {
  /* narrativeJob. An exact primary match beats a beat that merely allows it. */
  const jobRank = jobs.indexOf(spec.job)
  const narrativeJob = jobRank === 0 ? 1000 : jobRank === 1 ? 800 : 600

  /*
   * sourceCountFit. A device that uses every picture the beat can offer fits it
   * better than one that leaves three unused.
   */
  const available = beat.hasOwnAsset ? 1 + beat.companionCount : 0
  const sourceCountFit =
    available === 0 ? 0 : Math.round((1000 * spec.pictures) / Math.max(spec.pictures, available))

  /*
   * textNeedFit. How much of the device's copy budget the beat actually filled.
   * A device with no copy at all scores full marks: nothing can be wrong with it.
   */
  const slots = copySlotCount(copy)
  const textNeedFit = slots === 0 ? 1000 : Math.min(1000, Math.round((1000 * slots) / slots))

  /*
   * sourceProtection. His rule: do not put graphics over faces, document text or
   * the feature being discussed when another safe placement exists. A device
   * that draws no type on the picture cannot break it; one that draws on an
   * opaque plate is next; a scrim is last.
   */
  const sourceProtection =
    spec.typeOverPicture === 'none' || spec.typeOverPicture === 'ownGround'
      ? 1000
      : spec.typeOverPicture === 'opaquePlate'
        ? 700
        : 400

  /*
   * durationFit. Closeness to the device's registered default, falling off in
   * BOTH directions. Falling off only from below is what steers a static device
   * onto the longest beat in the film.
   */
  const drift = Math.abs(beat.durationFrames - spec.defaultDurationFrames)
  const durationFit = Math.max(0, 1000 - Math.round((1000 * drift) / spec.defaultDurationFrames))

  /*
   * variety. Full marks for a device the film has not used. A device with no cap
   * cannot be scored as a fraction of one, so it decays by a fixed step instead.
   */
  const used = state.used.get(spec.id) ?? 0
  const spend =
    spec.maxPerFilm === null
      ? Math.max(0, 1000 - used * 250)
      : Math.max(0, 1000 - Math.round((1000 * used) / spec.maxPerFilm))
  /*
   * And the recency half of his rule, as the penalty the gate no longer applies.
   *
   * ##########################################################################
   * # "RECENT" MEANS THE LAST FEW DEVICES THE VIEWER SAW, so the window is    #
   * # counted backwards along the FILM and not backwards along the walk. This #
   * # was `state.recent.slice(-VARIETY_WINDOW)` — the last four placements in #
   * # decision order — which is the same list while the chooser goes front to #
   * # back and is a scattering of unrelated beats once it does not.           #
   * ##########################################################################
   */
  const inWindow = placementsBefore(state, beat.index).filter((id) => id === spec.id).length
  const variety = Math.max(0, spend - inWindow * VARIETY_PENALTY)

  /*
   * themeConsistency. THE PACK DEFINES NO INPUT FOR THIS TERM.
   *
   * It carries 0.05 of his weight and he supplies nothing to measure it with, so
   * it is a constant rather than an invented metric. A constant cancels out of
   * every comparison, which is the honest behaviour: it is his weight, held open
   * for the day he says what it means, and it is not quietly doing something
   * else in the meantime.
   */
  const themeConsistency = 1000

  /*
   * ##########################################################################
   * # THE VISUAL PLANNER'S OWN TERM, AND IT IS DECISIVE ON PURPOSE.          #
   * #                                                                        #
   * # The seven weights above sum to 100 over terms of 0..1000, so the whole  #
   * # rest of the score CANNOT EXCEED 100,000. A bonus an order of magnitude #
   * # above that ceiling therefore means exactly one thing, with no           #
   * # arithmetic left to check: among the templates that PASS THEIR GATES on  #
   * # this beat, the one the planner named wins.                              #
   * #                                                                        #
   * # THE CEILING IS NOT A COMFORTABLE MARGIN, WHICH IS WHY IT IS A FULL      #
   * # ORDER. Measured on a one-beat probe while writing this, an UNPLANNED    #
   * # photo-pop scored 98,000 of the possible 100,000 — so a bonus of 100,000 #
   * # would have decided that beat by two thousand points, and any future     #
   * # re-weighting could silently flip it back.                               #
   * #                                                                        #
   * # WHY DECISIVE RATHER THAN A NUDGE. The client's complaint is that the    #
   * # per-beat heuristic produces a monoculture — six templates of sixteen,   #
   * # three of them taking twenty of twenty-six placements. A nudge would     #
   * # lose to that heuristic on exactly the beats where the two disagree,     #
   * # which is every beat the planner exists to change, and we would have     #
   * # shipped the feature and changed nothing. That has already happened      #
   * # once on this project and it is what he is objecting to.                  #
   * #                                                                        #
   * # IT IS NOT A WAIVER. It is added to a score that is only ever computed   #
   * # for a device that already survived every gate — `attempt` returns a     #
   * # null copy otherwise and this function is never reached. So a planner    #
   * # can decide BETWEEN drawable templates and can never make an undrawable  #
   * # one drawable. `deviceChoice.visualPlan.test.ts` pins that both ways.    #
   * ##########################################################################
   */
  const plannedByTheVisualPlanner =
    beat.plannedTemplate?.templateId === spec.id ? PLANNED_BONUS : 0

  return (
    plannedByTheVisualPlanner +
    narrativeJob * DEVICE_WEIGHTS.narrativeJob +
    sourceCountFit * DEVICE_WEIGHTS.sourceCountFit +
    textNeedFit * DEVICE_WEIGHTS.textNeedFit +
    sourceProtection * DEVICE_WEIGHTS.sourceProtection +
    durationFit * DEVICE_WEIGHTS.durationFit +
    variety * DEVICE_WEIGHTS.variety +
    themeConsistency * DEVICE_WEIGHTS.themeConsistency
  )
}

function copySlotCount(copy: SceneDevice): number {
  return Object.keys(copy).filter((key) => key !== 'id').length
}

/* ------------------------------------------------------------------------- */
/* A BEAT NEVER GOES SILENT, IT FALLS BACK. His rule 3.                        */
/* ------------------------------------------------------------------------- */

/**
 * WHICH REFUSALS A FALLBACK MAY RESCUE.
 *
 * ##########################################################################
 * # HIS RULE 3: "Do not select a template if its required inputs are        #
 * # unavailable. Select a FALLBACK or mark the beat for review."            #
 * #                                                                        #
 * # NOTE THE SCOPE OF THAT SENTENCE. It is about REQUIRED INPUTS, and that  #
 * # is the line this set draws. A refusal that says "this beat cannot feed  #
 * # this template" is a missing input and it earns a substitute. A refusal  #
 * # that says "somebody wrote down that this device may not go here" is a   #
 * # POLICY, and stepping over it with a different device would not be       #
 * # honouring rule 3, it would be repealing the rule.                       #
 * #                                                                        #
 * # THE LIST IS CLOSED AND EXHAUSTIVE. `RefusalCode` is a union, and        #
 * # `POLICY_REFUSALS` below holds every code that is NOT in here, so a      #
 * # seventeenth code is a COMPILE ERROR until somebody classifies it. A     #
 * # silent default either way is the wrong direction: defaulting to         #
 * # rescuable would let a new policy be walked past, and defaulting to      #
 * # policy would let a new missing-input refusal blank a beat.               #
 * ##########################################################################
 */
export const RESCUABLE_REFUSALS = [
  /*
   * THE PICTURE. All four of these say the photograph cannot carry what this
   * device wanted to draw on it, and a simpler treatment may not care: photo-pop
   * sets no type at all, so brightness, baked text and "too generic to name" are
   * all irrelevant to it. `picture-too-generic-to-name` is the one section 8 of
   * TREATMENT-STANDARD.md singles out — "T-8 STANDS AS A PREFERENCE AND FALLS AS
   * A REFUSAL. Refusing outright is what emptied three films. Fall back instead."
   */
  'picture-too-bright',
  'picture-too-dark',
  'picture-has-baked-text',
  'picture-too-generic-to-name',
  /*
   * And G8c, for the same reason and with the same force. "This photograph
   * cannot carry THESE letters in THAT corner" is a missing input, and the
   * simpler treatment a chain falls to either sets no type on the picture at
   * all or sets it somewhere else — so it is genuinely a different question
   * rather than the same refusal under another name.
   */
  'type-ground-too-weak',
  /*
   * And 05's line landing on the subject at the bottom centre. The same shape:
   * this photograph cannot carry 05, and a treatment that sets no type there
   * would not care. 05 is in no chain, so in practice nothing rescues it.
   */
  'subject-under-the-line',
  /* And P04's label landing on the subject in the lower-left corner, for the same reason. P04 is in no chain either. */
  'subject-under-the-label',
  /* And P02's or P09's card landing on the subject at the left, for the same reason. Neither is in a chain. */
  'subject-under-the-card',
  /* And P05's square panel cropping the subject away, for the same reason. P05 is in no chain either. */
  'subject-outside-the-panel',
  /* And P14's spinning year landing on the subject in the top-right corner, for the same reason. P14 is in no chain either. */
  'subject-under-the-year',
  /*
   * THE COPY. The fallback needs DIFFERENT copy — framed-card's caption is not
   * P03's headline and kicker — so it gets to build its own and be judged on it.
   * `no-subject-anchor` is the same shape: P17 has nothing to point at, and a
   * caption under the picture needs no point.
   */
  'copy-not-available',
  'no-subject-anchor',
  /*
   * THE SUPPLY. Literally "its required inputs are unavailable": a four-picture
   * mosaic on a beat with two pictures, or no picture at all.
   */
  'no-own-picture',
  'not-enough-pictures',
  /*
   * And the same shape read for QUALITY rather than for count. A beat whose
   * runner-up photographs are too weak to put on a frame still has its own,
   * checked picture, so a one-picture treatment is exactly the right fallback
   * and refusing outright would blank a beat over pictures it would not draw.
   */
  'companion-picture-too-weak',
  /*
   * DURATION. `beat-too-short` is a broken render and the fallback has to clear
   * its own G3 anyway; it is rescuable as a SEED because the beat genuinely
   * cannot host that device and a shorter build can. `beat-too-long` is his rule
   * 9 — see the box on G4.
   */
  'beat-too-short',
  'beat-too-long',
  /*
   * NOT ENABLED, which is this repo's way of saying a required input does not
   * exist at all: `needs-invented-copy`, `needs-external-fact`,
   * `needs-shape-detector`. That is rule 3's own case, so P13 refused for
   * wanting an editorial heading may hand its beat down its chain.
   *
   * ######################################################################
   * # AND IT CANNOT PLACE A DISABLED DEVICE, which is the half that keeps #
   * # this safe. A disabled device may SEED a walk; every candidate IN a   #
   * # walk goes through the whole of `refuse`, G1 first, so `not-enabled`  #
   * # still refuses it. `a3_chapter-title` in particular stays exactly as  #
   * # disabled as it was.                                                 #
   * ######################################################################
   */
  'not-enabled',
  /*
   * THE COOLDOWN, AND IT IS THE ONE JUDGEMENT CALL IN THIS LIST.
   *
   * ######################################################################
   * # G12 SAYS "not the same template twice in a row". A fallback is BY   #
   * # CONSTRUCTION a different template — none of the fifteen chains      #
   * # names its own owner, and the walk skips the seed anyway — so        #
   * # rescuing this refusal UPHOLDS the rule rather than undoing it. The  #
   * # film gets X then Y, which is what the gate was asking for.          #
   * #                                                                    #
   * # And his rule 8 is "A template may be used repeatedly. Repetition is #
   * # valid", with variety LAST of his five priorities. A variety rule    #
   * # that empties a beat is the strongest possible reading of the        #
   * # priority he put weakest.                                            #
   * ######################################################################
   */
  'variety-cooldown',
] as const satisfies readonly RefusalCode[]

/**
 * WHICH REFUSALS A FALLBACK MUST NOT RESCUE, AND WHY, ONE BY ONE.
 *
 * Declared rather than inferred, so that `RESCUABLE_REFUSALS` and this list
 * together are provably every member of `RefusalCode` — see the type assertion
 * under them.
 */
export const POLICY_REFUSALS = [
  /*
   * THE PER-FILM CAP. A cap is not a missing input — every input is present and
   * the FILM has had its fill.
   *
   * ##########################################################################
   * # AND ON THIS LIBRARY IT IS THE ONE THAT WOULD DO REAL DAMAGE. photo-pop  #
   * # is the terminal link of most of his chains, because it is the device     #
   * # that draws no words and therefore cannot be wrong. Rescue past its cap   #
   * # and every chain in the film ends at photo-pop. That experiment has       #
   * # already been run in this repo from the other direction: raising the cap  #
   * # to 99 moved placements from 13 to 35 and TWENTY-TWO OF THE TWENTY-TWO    #
   * # new ones were photo-pop, which is the monoculture the client complained  #
   * # about in the first place.                                                #
   * ##########################################################################
   */
  'per-film-cap-reached',
  /*
   * THE POSITION RULES, AND THE OPENING ONE IS A DIRECT QUOTE. "In the first
   * 0:00-0:04 I don't want this show clip animations." Rescuing photo-pop's
   * `notOpening` on beat 0 draws a different clip animation in the first four
   * seconds, which is the thing he asked not to have — the device changed, the
   * complaint would not.
   */
  'wrong-position-in-film',
  /*
   * THE SECTION GATE. T-4: a section mention may not be displaced by a treatment
   * that prints nothing. It fires only on beats where a word-carrying device can
   * really be placed, so rescuing a wordless device past it is precisely the
   * displacement the standard forbids.
   */
  'section-mention-needs-words',
  /*
   * G18, and it is the mirror of the line above. There the beat owed words and
   * the device had none; here the beat owed words and a SPOKEN treatment could
   * print them, so our own prose stands down. Both are written rules deciding
   * a beat rather than a score deciding it, which is what makes them policy.
   */
  'spoken-mark-outranks-written',
  /*
   * And the third of the same kind. The opening gallery is required by the
   * template's own author, so the beat is spoken for by a rule rather than by a
   * score, and a fallback walk must not step over it any more than it may step
   * over a year template's date beat.
   */
  'opening-belongs-to-A8',
  /*
   * THE DATE RULE. G15 hands the beat to a year template, P12 or P14, and it
   * fires only when one of them can actually draw, so the beat already has a
   * winner. "A year that misses P12 is a DEFECT, not a fallback."
   */
  'date-beat-belongs-to-a-year-template',
  /*
   * THE HELD FOLLOWER, AND THIS ONE IS NOT A POLICY — IT IS STRUCTURAL, WHICH IS
   * A STRONGER NO.
   *
   * ##########################################################################
   * # The next scene draws THIS scene's photograph, full-bleed, framed by the  #
   * # camera cursor this scene left behind. Any device replaces this scene's    #
   * # composition, so the follower opens mid-move on a pose the audience never  #
   * # saw, for its whole duration. EVERY member of every fallback chain has     #
   * # that same property, so a walk here cannot find a device that is exempt —  #
   * # it can only find one that reintroduces the defect. Rescuing costs a       #
   * # visible fault and buys nothing.                                          #
   * ##########################################################################
   */
  'next-scene-holds-this-picture',
  /*
   * THE WRONG JOB, AND IT IS THE MOST IMPORTANT NON-RESCUE IN THE FILE.
   *
   * ##########################################################################
   * # THERE IS NOTHING TO FALL BACK FROM. This code means the beat is not     #
   * # doing this device's job at all, so the device was never a candidate and #
   * # never had its inputs taken away. Treat it as rescuable and EVERY device #
   * # seeds a chain on EVERY beat — which places a treatment on all 39 beats  #
   * # and turns "semantic fit first" into "semantic fit never".                #
   * #                                                                        #
   * # It is waived INSIDE a walk, for a candidate the author himself          #
   * # nominated. That is the opposite operation and the box on G14 says so.   #
   * ##########################################################################
   */
  'wrong-narrative-job',
  /*
   * NOT A REFUSAL AT ALL. `outscored` means the device passed every gate and
   * lost on points, so the beat has a winner and the walk never runs.
   */
  'outscored',
] as const satisfies readonly RefusalCode[]

/**
 * EVERY REFUSAL CODE IS CLASSIFIED, PROVED BY THE COMPILER.
 *
 * ##########################################################################
 * # THE DIRECTION OF THIS ASSIGNMENT IS THE WHOLE TEST, AND THE OBVIOUS WAY  #
 * # ROUND IS THE USELESS ONE. Written as `const x: RefusalCode = ...union`,  #
 * # it only proves the two lists contain nothing that ISN'T a refusal code — #
 * # which `satisfies readonly RefusalCode[]` above already proves. Checked:  #
 * # a code deleted from both lists still compiled.                           #
 * #                                                                        #
 * # THIS WAY ROUND proves the reverse and the one that matters: every        #
 * # `RefusalCode` is assignable to the union of the two lists, so a new code #
 * # put in NEITHER stops the build until somebody classifies it. A silent    #
 * # default either way is wrong — defaulting to rescuable would let a new    #
 * # policy be walked past, and defaulting to policy would let a new          #
 * # missing-input refusal go on blanking beats.                              #
 * ##########################################################################
 */
const _everyRefusalIsClassified:
  | (typeof RESCUABLE_REFUSALS)[number]
  | (typeof POLICY_REFUSALS)[number] = null as unknown as RefusalCode
void _everyRefusalIsClassified

const RESCUABLE: ReadonlySet<RefusalCode> = new Set<RefusalCode>(RESCUABLE_REFUSALS)

/**
 * The two gates a walk may step over. Both are argued where they are read: see
 * G4 for the duration default and G14 for the author's semantic bridge.
 */
const FALLBACK_WAIVES: ReadonlySet<RefusalCode> = new Set<RefusalCode>([
  'wrong-narrative-job',
  'beat-too-long',
])

/** The device a fallback stood in for, and the substitute that was drawn. */
type Rescue = {
  readonly spec: DeviceSpec
  readonly copy: SceneDevice
  readonly from: DeviceId
  readonly fromRefusal: RefusalCode
}

/**
 * A BEAT NOTHING COULD TAKE, GIVEN THE AUTHOR'S OWN SUBSTITUTE INSTEAD OF
 * NOTHING. His rule 3, and rule 6's "do not leave an empty layout".
 *
 * ##########################################################################
 * # IT RUNS ONLY WHEN THE COMPETITION PLACED NOTHING, and that is the whole  #
 * # safety argument. A beat that already has a winner is not empty, rule 6   #
 * # is satisfied, and this function is never called — so no frame the client #
 * # has already seen and approved can move. Every change it can possibly    #
 * # make is on a beat that was drawing an ordinary shot.                     #
 * #                                                                        #
 * # SEMANTIC FIT PICKS THE SEED, WHICH IS HIS FIRST PRIORITY. The seeds are  #
 * # ordered by `jobs.indexOf(spec.job)` — the same rank the score's heaviest #
 * # term reads — so the walk starts from the device the beat most wanted and #
 * # only moves on when that device's entire chain is undrawable. A device    #
 * # whose job the beat is not doing can never be a seed at all.              #
 * #                                                                        #
 * # HIS ORDER DECIDES WITHIN A CHAIN, NOT OUR SCORE. `fallbackTemplateIds`   #
 * # is an ordered list he wrote, and the first drawable member wins. Scoring #
 * # the chain would substitute our seven weights for his two-item judgement. #
 * #                                                                        #
 * # DETERMINISTIC. `DEVICE_IDS` order, an explicit numeric tie-break rather  #
 * # than a reliance on sort stability, a `visited` set instead of Set        #
 * # iteration, and no state written until a winner is found. A device choice #
 * # is hashed into the segment cache key, so two runs must agree exactly.    #
 * ##########################################################################
 */
function rescueByFallback(
  beat: DeviceBeat,
  state: GateState,
  jobs: readonly NarrativeJob[],
  dateBeatBelongsToAYearTemplate: boolean,
  sectionBeatOwesWords: boolean,
  /* T-17, threaded so a rescue cannot walk onto the gallery's own beat. */
  openingBeatBelongsToA8: boolean,
  considered: readonly { id: DeviceId; refusal: RefusalCode | null }[],
): Rescue | null {
  /*
   * THE SEEDS: devices this beat WANTED and could not have. Both halves matter.
   *
   * `jobs.indexOf` >= 0 is the semantic half, and it is load-bearing rather than
   * belt-and-braces: G1, G2, G3, G4, G7 and G8 all fire BEFORE G14, so a device
   * refused on any of them never reached the job check and could otherwise seed
   * a chain on a beat that is not doing its job at all.
   */
  const seeds: { spec: DeviceSpec; refusal: RefusalCode; rank: number; order: number }[] = []
  DEVICE_IDS.forEach((id, order) => {
    const entry = considered.find((candidate) => candidate.id === id)
    if (entry === undefined || entry.refusal === null) return
    if (!RESCUABLE.has(entry.refusal)) return
    const spec = DEVICE_REGISTRY[id]
    /*
     * A RETIRED DEVICE IS NOT SOMETHING A BEAT CAN WANT.
     *
     * ######################################################################
     * # `supersededBy` records the CLIENT'S OWN instruction that one device #
     * # replaces another — P17 replaces a1 `pointer-label`. So a beat that  #
     * # needs a pointer wants P17; the retired device is not a second       #
     * # opinion about that beat, it is the same opinion written down twice.  #
     * #                                                                    #
     * # MEASURED, AND IT SHOWED UP AS A WRONG SENTENCE RATHER THAN A WRONG  #
     * # FRAME. Beat 19 of the real 39 is rescued to framed-card either way, #
     * # because pointer-label and P17 share both their job and the tail of  #
     * # their chain. But `pointer-label` sits at index 1 of `DEVICE_IDS`    #
     * # and P17 at index 13, so it sorted first and the verdict read "the   #
     * # beat wanted pointer-label" — crediting a want to a device the       #
     * # client had retired, in the one field a human reads to decide        #
     * # whether to look at the beat.                                        #
     * ######################################################################
     */
    if (spec.supersededBy !== null) return
    const rank = jobs.indexOf(spec.job)
    if (rank < 0) return
    seeds.push({ spec, refusal: entry.refusal, rank, order })
  })
  seeds.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.order - b.order))

  /*
   * ONE VISITED SET FOR THE WHOLE RESCUE, and it is a correctness device before
   * it is an optimisation. His chains close cycles — `a6_framed-card ->
   * a9_photo-pop -> a6_framed-card` and `a9_photo-pop -> 1_0-10_P03 ->
   * a9_photo-pop` — so a walk without one does not terminate. Sharing it across
   * seeds changes no answer, because nothing is written to `state` until a
   * winner is found, so a candidate refused once is refused identically again.
   */
  const visited = new Set<DeviceId>()

  /*
   * IT RETURNS THE SUBSTITUTE ONLY, NOT A FINISHED `Rescue`. An earlier cut had
   * `walk` fill in a placeholder `fromRefusal` for its caller to overwrite,
   * which is the shape of a bug rather than a bug: return the value one level
   * higher without the overwrite and the verdict quietly reports the wrong
   * refusal. The walk does not know which seed's refusal it is standing in for,
   * so it does not claim to.
   */
  const walk = (
    chain: readonly DeviceId[],
    seedId: DeviceId,
  ): { spec: DeviceSpec; copy: SceneDevice } | null => {
    for (const id of chain) {
      /* Never fall back to yourself, however the chain is edited. */
      if (id === seedId || visited.has(id)) continue
      visited.add(id)
      const spec = DEVICE_REGISTRY[id]
      const tried = attempt(
        spec,
        beat,
        state,
        jobs,
        dateBeatBelongsToAYearTemplate,
        sectionBeatOwesWords,
        openingBeatBelongsToA8,
        FALLBACK_WAIVES,
      )
      if (tried.copy !== null) return { spec, copy: tried.copy }
      /*
       * A LINK THAT CANNOT BE DRAWN HANDS ON DOWN ITS OWN CHAIN, which is what
       * makes these chains compose. He gave `a6_framed-card -> a9_photo-pop` as
       * framed-card's rule, and it holds whether framed-card was reached as a
       * primary choice or as somebody else's substitute.
       */
      const deeper = walk(spec.fallbackTemplateIds, seedId)
      if (deeper !== null) return deeper
    }
    return null
  }

  for (const seed of seeds) {
    const found = walk(seed.spec.fallbackTemplateIds, seed.spec.id)
    if (found !== null) {
      return { spec: found.spec, copy: found.copy, from: seed.spec.id, fromRefusal: seed.refusal }
    }
  }
  return null
}

/* ------------------------------------------------------------------------- */
/* The pass                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Choose a device for every beat that wants one.
 *
 * A SINGLE FORWARD PASS IN SCENE ORDER, because the caps and the variety window
 * are film-level state that only a forward pass can carry. Ties break on the
 * registry's own id order, which is fixed, so two runs over the same beats
 * return the same map.
 */
/**
 * The last `VARIETY_WINDOW` devices the viewer would have seen BEFORE this beat.
 *
 * Reads the placement map in film order, so it answers the same thing however
 * the beats were decided. See the box on `GateState.placedAt`.
 *
 * ##########################################################################
 * # BACKWARD ONLY, AND THE DIRECTION IS NOT INDEPENDENTLY PINNED. Said     #
 * # plainly because it is a choice rather than a deduction: `at < index`   #
 * # is what reproduces the old `state.recent.slice(-VARIETY_WINDOW)`       #
 * # EXACTLY on a front-to-back walk, so this refactor changes no score on  #
 * # any film. Widening it to `at !== index` — the shots on both sides,     #
 * # which is arguably what "the viewer just saw this" means once the walk  #
 * # is spaced — was tried and no test in the package can tell the two      #
 * # apart. The narrower one is kept because it is the one that provably    #
 * # changes nothing, and the partner has never supplied the number this    #
 * # penalty is sized by.                                                    #
 * ##########################################################################
 */
function placementsBefore(state: GateState, index: number): DeviceId[] {
  return [...state.placedAt.keys()]
    .filter((at) => at < index)
    .sort((a, b) => a - b)
    .slice(-VARIETY_WINDOW)
    .map((at) => state.placedAt.get(at) as DeviceId)
}

/**
 * THE ORDER THE BEATS ARE DECIDED IN, WHICH IS NOT THE ORDER THEY ARE WATCHED IN.
 *
 * ##########################################################################
 * # THE FINDING THIS EXISTS FOR. The delivered 2:59.9 cut carries thirteen  #
 * # devices, NINE of them inside the first 52 seconds, and three stretches  #
 * # of 33.4s, 49.4s and 30.9s with nothing moving at all — 113.7 seconds,   #
 * # 63% of the film. The client's words: "I still saw the exact same 2-3    #
 * # animations up until 5 minute mark."                                     #
 * #                                                                        #
 * # THE CAUSE IS THIS FUNCTION'S ABSENCE. `chooseDevices` walked the beats  #
 * # in film order and took the first that fit, and almost every device in   #
 * # `devices.ts` carries a `maxPerFilm`. A ceiling spent front to back is   #
 * # spent in the first quarter, and the tail then has nothing left to draw  #
 * # with — not because those beats were worse, but because they were later. #
 * #                                                                        #
 * # RAISING THE CEILINGS WAS TRIED, AND MEASURED, AND IT MADE IT WORSE.     #
 * # Over the real 86-beat fixture: placements 19 -> 21, longest dead run 14 #
 * # beats -> 13, and the number of beats whose nearest refusal is a spent   #
 * # cap ROSE from 25 to 32. A bigger budget spent front to back is still    #
 * # spent front to back. The record is on photo-pop's `maxPerFilm`.         #
 * ##########################################################################
 *
 * ##########################################################################
 * # SO IT IS AN ORDERING AND NOT A THRESHOLD, WHICH IS THE WHOLE POINT.    #
 * #                                                                        #
 * # Every beat is still visited, and every beat is still judged by exactly  #
 * # the same gates in exactly the same way. Nothing here can refuse a shot: #
 * # a rule that said "this beat is too close to the last one, skip it"      #
 * # would be a new way to starve a film, and starving the film is the       #
 * # defect being fixed. All that changes is WHO GOES FIRST — and therefore  #
 * # who gets to spend a ceiling that only stretches so far.                 #
 * #                                                                        #
 * # FARTHEST FIRST, MEASURED IN FILM TIME. The film's first beat is decided #
 * # first, and after that the next beat is always the one FURTHEST IN TIME  #
 * # from every beat already decided. Ties go to the earlier beat, so the    #
 * # walk is deterministic and two runs of the same film agree, which the    #
 * # segment cache key depends on.                                           #
 * #                                                                        #
 * # DISTANCE IS IN FRAMES AND NOT IN BEATS, because a beat is not a unit of #
 * # time. The client's complaint is about SECONDS of film with nothing      #
 * # moving; a stretch of six short beats and a stretch of two long ones can #
 * # be the same length on screen and only one of them looks like a fault.   #
 * #                                                                        #
 * # FROM EVERY DECIDED BEAT, NOT FROM EVERY PLACED ONE, AND THAT WAS        #
 * # MEASURED BOTH WAYS. Anchoring on placements alone reads more like the   #
 * # sentence one wants to write, and it is worse: a beat that draws nothing #
 * # never becomes an anchor, so the walk keeps coming back to the           #
 * # neighbourhood it has already failed in and spends its visits there. On  #
 * # the 86-beat fixture that left both long dead runs untouched at 14 and   #
 * # 13 beats, where anchoring on decided beats cut them to 9 and 8.         #
 * ##########################################################################
 */
function spacedOrder(beats: readonly DeviceBeat[]): DeviceBeat[] {
  if (beats.length <= 2) return [...beats]

  /* Where each beat starts, in frames from the head of the film. */
  const startFrames: number[] = []
  let running = 0
  for (const beat of beats) {
    startFrames.push(running)
    running += beat.durationFrames
  }

  const pending = beats.map((_, position) => position)
  /*
   * ##########################################################################
   * # THE OPENING IS TAKEN FIRST EXPLICITLY, AND IT IS HONEST TO SAY THAT    #
   * # THIS LINE CHANGES NO OUTPUT TODAY. With an empty anchor set every      #
   * # candidate is infinitely far from nothing, so the tie-break below would #
   * # pick this same beat anyway; seeding the walk with the LAST beat        #
   * # instead was measured over the real 86-beat fixture and over the        #
   * # 24-beat unit fixture and moved not one placement.                      #
   * #                                                                        #
   * # IT IS WRITTEN OUT ANYWAY, and the reason is that the property it       #
   * # states is one the film's opening depends on while the tie-break is an  #
   * # implementation detail of a loop. The opening carries two written       #
   * # placement rules — gallery-strip is MANDATORY there, photo-pop is       #
   * # FORBIDDEN there — and on the real fixture it is the beat that draws    #
   * # P03 over "Israel Antiquities Authority". A later change from           #
   * # `nearest > farthest` to `>=` would move the opening somewhere into the #
   * # middle of the walk, and that must be a deliberate edit to this line    #
   * # rather than a side effect of a comparison operator.                    #
   * ##########################################################################
   */
  const order: DeviceBeat[] = [beats[pending.shift() as number] as DeviceBeat]

  /*
   * How far each beat still waiting is from the NEAREST beat already decided,
   * carried forward rather than recomputed. One new decision can only ever
   * shorten a distance, so a single pass of `Math.min` per pick keeps the whole
   * walk quadratic in the beat count instead of cubic.
   */
  const nearest = pending.map((position) =>
    Math.abs((startFrames[position] as number) - (startFrames[0] as number)),
  )

  while (pending.length > 0) {
    let pick = 0
    for (let slot = 1; slot < pending.length; slot += 1) {
      /* Strictly greater, so a tie keeps the earlier beat and the walk is stable. */
      if ((nearest[slot] as number) > (nearest[pick] as number)) pick = slot
    }

    const position = pending.splice(pick, 1)[0] as number
    nearest.splice(pick, 1)
    order.push(beats[position] as DeviceBeat)

    const decidedAt = startFrames[position] as number
    for (let slot = 0; slot < pending.length; slot += 1) {
      const gap = Math.abs((startFrames[pending[slot] as number] as number) - decidedAt)
      if (gap < (nearest[slot] as number)) nearest[slot] = gap
    }
  }

  return order
}

export function chooseDevices(beats: readonly DeviceBeat[]): DeviceChoice {
  const state: GateState = {
    used: new Map(),
    placedAt: new Map(),
    drawnHeadlines: new Set(),
    totalBeats: beats.length,
  }
  const devices = new Map<number, SceneDevice>()
  /*
   * KEYED BY BEAT, NOT PUSHED IN WALK ORDER. The beats are decided in
   * `spacedOrder`'s order and read back in the film's, so a report or a plan
   * still lists them in the sequence a viewer watches them in.
   */
  const verdictByIndex = new Map<number, BeatVerdict>()

  const decide = (beat: DeviceBeat): void => {
    const jobs = narrativeJobsOf(beat)
    /* G15's input. Once per beat, before anything competes for it. */
    const dateBeatBelongsToAYearTemplate = yearTemplateClaims(beat, state, jobs)
    /* G16's input, and it reads G15's — a date beat is already spoken for. */
    const sectionBeatOwesWords = sectionBeatClaimsWords(beat, state, jobs, dateBeatBelongsToAYearTemplate)
    /* G17's input. Last of the three, and it reads neither of the other two. */
    const openingBeatBelongsToA8 = openingBeatClaimsA8(beat, state, jobs, dateBeatBelongsToAYearTemplate)
    const considered: { id: DeviceId; score: number | null; refusal: RefusalCode | null }[] = []
    let best: { spec: DeviceSpec; copy: SceneDevice; points: number } | null = null

    for (const id of DEVICE_IDS) {
      const spec = DEVICE_REGISTRY[id]

      /* NOTHING WAIVED. This is the competition; every gate is a gate here. */
      const tried = attempt(
        spec,
        beat,
        state,
        jobs,
        dateBeatBelongsToAYearTemplate,
        sectionBeatOwesWords,
        openingBeatBelongsToA8,
        NO_WAIVERS,
      )
      if (tried.copy === null) {
        considered.push({ id, score: null, refusal: tried.refusal })
        continue
      }

      const points = score(spec, beat, state, jobs, tried.copy)
      considered.push({ id, score: points, refusal: null })

      if (best === null || points > best.points) {
        best = { spec, copy: tried.copy, points }
      }
    }

    /*
     * NOTHING WON, SO THE BEAT GETS THE AUTHOR'S OWN SUBSTITUTE RATHER THAN
     * SILENCE. His rule 3, and it is the only place `rescueByFallback` is called.
     */
    const rescue =
      best === null
        ? rescueByFallback(
            beat,
            state,
            jobs,
            dateBeatBelongsToAYearTemplate,
            sectionBeatOwesWords,
            openingBeatBelongsToA8,
            considered,
          )
        : null

    /*
     * ONE STATE UPDATE FOR BOTH ROUTES, AND THAT IS DELIBERATE.
     *
     * ######################################################################
     * # A FALLBACK IS A PLACEMENT, so it spends the cap, enters the variety #
     * # window and claims its headline exactly as a winner does. Written as #
     * # a separate branch that forgot one of those, the chain would become  #
     * # the way round every film-level limit in the file: photo-pop capped  #
     * # at three could be rescued onto every remaining beat because the     #
     * # rescues never counted. Collapsing the two routes into one `winner`  #
     * # here is what makes forgetting impossible rather than unlikely.      #
     * ######################################################################
     */
    const winner =
      best !== null
        ? { spec: best.spec, copy: best.copy }
        : rescue !== null
          ? { spec: rescue.spec, copy: rescue.copy }
          : null

    if (winner === null) {
      verdictByIndex.set(beat.index, {
        index: beat.index,
        chosen: null,
        fallbackFrom: null,
        /*
         * "or mark the beat for review" — the other half of his rule 3, and this
         * string IS the mark. Nothing was drawable and nothing his chains
         * nominated was drawable either, so the honest answer is an ordinary shot
         * with a written reason rather than an invented frame.
         */
        reason: reasonForNoDevice(considered),
        considered,
      })
      return
    }

    /* Mark the losers as outscored rather than as refused. They passed. */
    for (const entry of considered) {
      if (entry.score !== null && entry.id !== winner.spec.id) entry.refusal = 'outscored'
    }

    devices.set(beat.index, winner.copy)
    if (winner.copy.id === 'P03') state.drawnHeadlines.add(normaliseToken(winner.copy.headline))
    /* a3's caption is a display line too — see the chapter-title arm of buildCopy. */
    if (winner.copy.id === 'chapter-title') {
      state.drawnHeadlines.add(normaliseToken(winner.copy.caption))
    }
    /* And 05's line, the only words on its frame. See its arm of buildCopy. */
    if (winner.copy.id === 'shadow-up') state.drawnHeadlines.add(normaliseToken(winner.copy.line))
    /* And P04's label, its display line. See its arm of buildCopy. */
    if (winner.copy.id === 'P04') state.drawnHeadlines.add(normaliseToken(winner.copy.mainLine))
    /* And P02's headline, its display line. See its arm of buildCopy. */
    if (winner.copy.id === 'P02') state.drawnHeadlines.add(normaliseToken(winner.copy.headline))
    /* And P09's question, its display line. See its arm of buildCopy. */
    if (winner.copy.id === 'P09') state.drawnHeadlines.add(normaliseToken(winner.copy.question))
    /* And P05's headline, its display line. See its arm of buildCopy. */
    if (winner.copy.id === 'P05') state.drawnHeadlines.add(normaliseToken(winner.copy.headline))
    state.used.set(winner.spec.id, (state.used.get(winner.spec.id) ?? 0) + 1)
    state.placedAt.set(beat.index, winner.spec.id)

    verdictByIndex.set(beat.index, {
      index: beat.index,
      chosen: winner.copy,
      fallbackFrom: rescue?.from ?? null,
      reason:
        rescue !== null
          ? `${winner.spec.id} — FALLBACK. The beat wanted ${rescue.from}, which was refused on ` +
            `${rescue.fromRefusal}, and ${winner.spec.id} is the first link of its registered ` +
            `chain (${DEVICE_REGISTRY[rescue.from].fallbackTemplateIds.join(' -> ')}) that can ` +
            `be drawn here`
          : `${winner.spec.id} — the beat is doing ${winner.spec.job.replace(/_/g, ' ')}, ` +
            `it has ${beat.hasOwnAsset ? 1 + beat.companionCount : 0} picture(s) for a device that ` +
            `needs ${String(winner.spec.pictures)}, and ${String(beat.durationFrames)} frames against a ` +
            `build that finishes at ${String(winner.spec.buildEndFrames)}`,
      considered,
    })
  }

  /*
   * ##########################################################################
   * # THE ONE LINE THAT MOVES A FRAME. See the box on `spacedOrder`: the      #
   * # beats are decided furthest-apart-first so that a ceiling which only     #
   * # stretches to three placements spends them across the film rather than   #
   * # in its first quarter.                                                   #
   * ##########################################################################
   */
  for (const beat of spacedOrder(beats)) decide(beat)

  /* Read back in the order they are watched in. */
  const verdicts = beats.map((beat) => verdictByIndex.get(beat.index) as BeatVerdict)
  return { devices, verdicts }
}

/** The most informative refusal on a beat nothing could take. */
function reasonForNoDevice(
  considered: readonly { id: DeviceId; refusal: RefusalCode | null }[],
): string {
  /*
   * Report the refusal that is CLOSEST to a yes. "not-enabled" is true of six
   * devices on every beat in the film and says nothing about this one.
   */
  const informative: RefusalCode[] = [
    /*
     * FIRST, BECAUSE IT MEANS THE BEAT WAS SPOKEN FOR AND THEN LOST ITS OWNER.
     * It only ever appears on a beat where a year template passed every gate,
     * so seeing it as the nearest refusal says the film has a date beat that
     * drew nothing — which is the one outcome the client called a defect by
     * name.
     */
    'date-beat-belongs-to-a-year-template',
    /*
     * SECOND, AND IT SHOULD BE UNREACHABLE HERE. G16 only fires once a
     * word-carrying device has passed every gate and built its copy on this
     * beat, so that device wins and the beat is not blank. Seeing it as the
     * nearest refusal means the winner was lost between the gates and the map —
     * today the only way is `SceneDeviceSchema` rejecting copy `buildCopy`
     * accepted — and that is worth reading in a report rather than hiding
     * behind whatever the next device happened to say.
     */
    'section-mention-needs-words',
    'picture-too-generic-to-name',
    'copy-not-available',
    'picture-too-bright',
    'picture-too-dark',
    'picture-has-baked-text',
    'no-subject-anchor',
    /* Only ever on a beat that asked for 05, because G14b sits after the job gate. */
    'subject-under-the-line',
    /* And only ever on a beat that asked for P04, for the same reason. */
    'subject-under-the-label',
    /* And only ever on a beat that asked for P02 or P09, for the same reason. */
    'subject-under-the-card',
    /* And only ever on a beat that asked for P05, for the same reason. */
    'subject-outside-the-panel',
    /* And only ever on a beat that asked for P14, for the same reason. */
    'subject-under-the-year',
    'next-scene-holds-this-picture',
    'variety-cooldown',
    'per-film-cap-reached',
    'wrong-position-in-film',
    'beat-too-long',
    'beat-too-short',
    'not-enough-pictures',
    'no-own-picture',
    /*
     * LAST, BECAUSE IT IS THE DEFAULT STATE RATHER THAN A DECISION. Most
     * devices are wrong for most beats, so reporting this first would be true
     * of nearly every refused beat and would hide the gate that actually
     * decided this one.
     */
    'wrong-narrative-job',
  ]

  for (const code of informative) {
    const hit = considered.find((entry) => entry.refusal === code)
    if (hit !== undefined) return `no device — nearest was ${hit.id}, refused on ${code}`
  }
  return 'no device — nothing was eligible'
}

/**
 * ##########################################################################
 * # THE STANDARDS REPORT: WHICH MOMENTS THE FILM RECOGNISED AND COULD NOT   #
 * # DRAW.                                                                  #
 * #                                                                        #
 * # `NARRATIVE_JOBS` is the written standard — twelve kinds of moment, and  #
 * # every device declares which one it serves. `narrativeJobsOf` decides    #
 * # which of them a shot is, from the shot's own words. Until now nothing   #
 * # anywhere compared the two, so a standard that matched and was refused   #
 * # looked exactly like a standard that never matched at all.               #
 * #                                                                        #
 * # That is how the client's own example went unnoticed across three        #
 * # films. Scene 46 of job c75d51e6 says "when these three sections are     #
 * # read together". Once the counted-plural rule existed it matched the     #
 * # evidence-board standard, was refused `picture-too-dark` at meanLuma     #
 * # 0.42 against a floor of 0.45, and the film drew nothing there and said  #
 * # nothing about it.                                                       #
 * #                                                                        #
 * # THE PLANNER'S ASK IS DELIBERATELY EXCLUDED. `narrativeJobsOf` appends   #
 * # the planned template's own job at the end, so asking for a device would #
 * # make the beat "match" the standard the device serves and the report     #
 * # would be marking its own homework. This reads the beat with             #
 * # `plannedTemplate` stripped, so `matched` means the SHOT said so.        #
 * ##########################################################################
 */
export type StandardMatch = {
  /** The kind of moment, from the written standard. */
  readonly job: NarrativeJob
  /** Shots whose OWN words said they were this kind of moment. */
  readonly matched: number
  /** Of those, how many drew a device that serves this job. */
  readonly drew: number
  /** Whether any device the chooser may select serves it. Without one, the tool can never draw it. */
  readonly hasLiveDevice: boolean
  /** For the shots that did not draw, why the serving devices were refused. */
  readonly refusals: Readonly<Record<string, number>>
  /** Scene indices that matched and drew nothing, so a human can go and look. */
  readonly missedAt: readonly number[]
}

/**
 * Build the report. Pure, and takes exactly what `chooseDevices` was given and
 * returned, so it can be recomputed from a frozen plan without a replay.
 *
 * `drawn` is the map the film really draws, hand placements included, and a
 * matched beat counts as drawn when what is ON it serves the job. Absent, the
 * chooser's own choices are read, which is the same map on any film with no
 * hand placement. `live` still asks only what the chooser may select, because
 * a device a person places serves no standard on its own.
 */
export function standardsReport(
  beats: readonly DeviceBeat[],
  verdicts: readonly BeatVerdict[],
  drawn?: ReadonlyMap<number, SceneDevice>,
): StandardMatch[] {
  const verdictByIndex = new Map<number, BeatVerdict>(verdicts.map((v) => [v.index, v]))

  const servedBy = new Map<NarrativeJob, DeviceId[]>()
  for (const id of DEVICE_IDS) {
    const spec = DEVICE_REGISTRY[id]
    servedBy.set(spec.job, [...(servedBy.get(spec.job) ?? []), id])
  }

  const out: StandardMatch[] = []
  for (const job of NARRATIVE_JOBS) {
    const serving = servedBy.get(job) ?? []
    /* Choosable, not merely drawable: a hand-placed device serves no standard on its own. */
    const live = serving.filter((id) => chooserMaySelect(DEVICE_REGISTRY[id]))

    let matched = 0
    let drew = 0
    const refusals: Record<string, number> = {}
    const missedAt: number[] = []

    for (const beat of beats) {
      /* The SHOT's own claim, never the planner's. See the box above. */
      const own: NarrativeJob[] = narrativeJobsOf({ ...beat, plannedTemplate: null })
      if (!own.includes(job)) continue
      matched += 1

      const verdict = verdictByIndex.get(beat.index)
      const onBeat = drawn !== undefined ? (drawn.get(beat.index) ?? null) : (verdict?.chosen ?? null)
      if (onBeat !== null && DEVICE_REGISTRY[onBeat.id]?.job === job) {
        drew += 1
        continue
      }

      missedAt.push(beat.index)
      for (const id of live) {
        const entry = verdict?.considered.find((row: { id: DeviceId }) => row.id === id)
        const code = entry?.refusal ?? null
        if (code === null) continue
        refusals[code] = (refusals[code] ?? 0) + 1
      }
    }

    if (matched === 0) continue
    out.push({ job, matched, drew, hasLiveDevice: live.length > 0, refusals, missedAt })
  }
  return out
}

/** How many missed scenes a log line names before it says "and N more". */
const MISSED_SCENES_IN_LOG = 8

/**
 * One line per standard, for the log.
 *
 * BOUNDED THE SAME WAY THE DEVICE VERDICT LINE IS, because `job_events` is
 * rendered raw in the client-facing UI and `source_inspection` alone matched 65
 * shots on the delivered film. Only the standards that MISSED are worth the
 * width, so a standard that drew every time it matched is one short clause.
 */
export function describeStandardsReport(report: readonly StandardMatch[]): string {
  return report
    .map((row) => {
      if (row.missedAt.length === 0) {
        return `${row.job}: ${String(row.matched)} matched, all drew`
      }
      const why = Object.entries(row.refusals)
        .sort((a, b) => b[1] - a[1])
        .map(([code, n]) => `${code} x${String(n)}`)
        .join(', ')
      const shown = row.missedAt.slice(0, MISSED_SCENES_IN_LOG)
      const rest = row.missedAt.length - shown.length
      const where = `scenes ${shown.join(', ')}${rest > 0 ? ` and ${String(rest)} more` : ''}`
      const dead = row.hasLiveDevice ? '' : ' [NO DEVICE THE TOOL MAY CHOOSE SERVES THIS]'
      return (
        `${row.job}: ${String(row.matched)} matched, ${String(row.drew)} drew` +
        (why.length > 0 ? ` — refused on ${why}` : '') +
        ` (${where})` +
        dead
      )
    })
    .join('; ')
}
