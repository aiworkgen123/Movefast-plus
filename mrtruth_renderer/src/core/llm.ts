import { z } from 'zod'
import type { SegmentationScene, VisionCandidate } from './schemas.js'

/**
 * Stage 3 and stage 4c — the two model seams.
 *
 * Same shape as `Aligner` next door and `ImageSource` in @vg/sources: a narrow
 * interface declared beside the payload types it carries, with the vendor client
 * behind it. The implementations deliberately do NOT follow the interfaces into
 * this package — `AnthropicSegmenter` needs @anthropic-ai/sdk and `GeminiRanker`
 * needs a pino logger, and apps/web imports @vg/core, Remotion bundle included.
 * `DeepgramAligner` could live here only because Deepgram is a plain undici call.
 *
 * PROVIDER IDENTITY TRAVELS ON THE INSTANCE, and that is the whole point of this
 * file. `provider`, `model`, `promptVersion`, `operation` and `costMicros` are
 * interface members rather than module constants imported at the call site,
 * because an imported model constant keeps naming the old vendor's model while a
 * different ranker answers — and then serves one provider's judgement out of the
 * other provider's cache entry and bills it at the other provider's rate. A wrong
 * rate is not a reporting error: `jobs.cost_micros` is what the cost ceiling is
 * computed from. Reading the instance is the only version that cannot go stale.
 */

/**
 * One implementation per seam in V1. These unions are deliberately narrower than
 * `ApiProvider` in @vg/db, which `charge()` takes: a provider added here without
 * the matching `ALTER TYPE api_provider ADD VALUE` migration is then a compile
 * error at the `charge()` call rather than a failed INSERT forty minutes into a
 * render. That error is the guard rail working — widen the database enum, never
 * widen `ChargeInput['provider']`.
 */
export const SEGMENTER_PROVIDERS = ['anthropic'] as const
export const SegmenterProviderSchema = z.enum(SEGMENTER_PROVIDERS)
export type SegmenterProvider = z.infer<typeof SegmenterProviderSchema>

export const VISION_PROVIDERS = ['gemini'] as const
export const VisionProviderSchema = z.enum(VISION_PROVIDERS)
export type VisionProvider = z.infer<typeof VisionProviderSchema>

/**
 * Thrown by a `Segmenter` that could not produce schema-valid scenes.
 *
 * Declared here rather than in the implementation so that the caller's catch
 * recognises a second implementation's failure too. Same reason `AlignerError`
 * sits with `Aligner` and `SourceError` sits with `ImageSource`.
 */
export class SegmentationError extends Error {
  override readonly name = 'SegmentationError'
}

/** Thrown by a `VisionRanker`. `statusCode` is present when a provider answered. */
export class VisionError extends Error {
  override readonly name = 'VisionError'
  readonly statusCode: number | undefined

  constructor(message: string, statusCode?: number) {
    super(message)
    this.statusCode = statusCode
  }
}

/* ------------------------------------------------------------------------- */
/* Stage 3 — segmentation                                                      */
/* ------------------------------------------------------------------------- */

export type TimedLine = {
  index: number
  startMs: number
  endMs: number
  text: string
  /** Context lines are shown for continuity but must not produce scenes. */
  isFocus: boolean
}

export type SegmentBatchInput = {
  /** The whole script. Context and spelling only — never a source of timing. */
  script: string
  lines: readonly TimedLine[]
  focusStartMs: number
  focusEndMs: number
  targetSceneMs: number
  /**
   * WHAT THE FILM IS, AND WHAT IT MAY NOT ASK FOR.
   *
   * ######################################################################
   * # THE SHOT PLANNER WROTE 58 BRIEFS WITHOUT EVER BEING SHOWN THIS.     #
   * #                                                                    #
   * # Stage 1b works out `avoidVisualCategories`. On job 0d4dec42 it      #
   * # wrote "Contemporary funerals, hospitals and grieving families in    #
   * # modern dress" and "Medieval or Renaissance European cathedral       #
   * # pageantry standing in for Second Temple imagery". This stage then   #
   * # commissioned, verbatim, "A lone mourner standing at a graveside in  #
   * # a quiet cemetery" for three consecutive shots, "A hospital bedside  #
   * # at night with a monitor glowing beside empty sheets", and "An empty #
   * # carved stone pulpit in a European church interior". All of them     #
   * # reached the screen.                                                 #
   * #                                                                    #
   * # NOTHING AFTER THIS STAGE CAN REFUSE THEM, and that is the whole     #
   * # argument for putting it here. The picture judge's own rule reads    #
   * # "A SENTENCE CAN OVERRIDE THE FILM ... the preferred and avoided     #
   * # categories are film-level preferences and they never outrank a      #
   * # specific line". Asked for a modern cemetery, a modern cemetery      #
   * # photograph IS the right answer and scores 7. The brief is the last  #
   * # place a banned picture can be stopped.                              #
   * #                                                                    #
   * # REQUIRED AND NULLABLE, never optional, for the reason written above #
   * # `VisionSceneContext`: an optional field arrives `undefined` at      #
   * # every construction site that predates it and `x === null` is false  #
   * # for undefined. Required makes `tsc` enumerate the call sites.       #
   * #                                                                    #
   * # NULL MEANS THE RESEARCH STAGE FAILED, which is a real outcome and   #
   * # not a default. It must never be the case on a healthy run, and      #
   * # `segmentCacheKey` keys it separately so a blind batch can never be  #
   * # served to a run that has a dossier.                                 #
   * ######################################################################
   */
  film: VisionFilmContext | null
}

export type SegmentBatchResult = {
  scenes: SegmentationScene[]
  inputTokens: number
  outputTokens: number
  latencyMs: number
  /**
   * True when the first response failed validation and the retry succeeded.
   *
   * Contract surface, not dead code: it is the only signal an operator gets that
   * a batch cost two calls instead of one. Do not delete it because nothing reads
   * it yet.
   */
  repaired: boolean
}

/**
 * Turn a batch of transcript lines into scenes.
 *
 * THE IMPLEMENTATION OWNS ITS OWN REPAIR. `segmentBatch` either returns scenes
 * that have already passed `SegmentationResponseSchema` — which is why `scenes`
 * is the inferred type and not `unknown` — or it throws. A repair attempt is
 * provider-specific by nature, because it feeds the validator's own issues back
 * into that provider's own turn, so it belongs behind this method and not in a
 * shared retry framework.
 *
 * THE CALLER'S ANSWER TO A THROW IS A DETERMINISTIC PAUSE-BASED SPLIT, never a
 * failed job. `runSegment` catches, warns and falls through to `deterministicScenes`.
 * An implementation that wants a second repair must pay for it inside this call;
 * it must not expect the caller to retry.
 *
 * `costMicros` is on this interface rather than chosen at the call site because a
 * swapped provider billed at the previous provider's rate does not produce a
 * reporting error, it produces a wrong cost ceiling.
 */
export interface Segmenter {
  readonly provider: SegmenterProvider
  readonly model: string
  readonly promptVersion: number
  /** Provider-native verb for the `api_usage` ledger, e.g. `messages.create`. */
  readonly operation: string
  segmentBatch(input: SegmentBatchInput, signal?: AbortSignal): Promise<SegmentBatchResult>
  costMicros(inputTokens: number, outputTokens: number): number
}

/* ------------------------------------------------------------------------- */
/* Stage 4c — vision ranking                                                   */
/* ------------------------------------------------------------------------- */

/**
 * What the FILM is, held while one shot is judged.
 *
 * ##########################################################################
 * # THE FIRST HALF OF THE CLIENT'S IMAGE-JUDGE DOCUMENT, WHICH HAD NO CODE. #
 * #                                                                        #
 * #   "Before judging the image, understand context such as: overall topic; #
 * #    documentary category; narrative style; historical period or setting; #
 * #    previous narration; current narration; surrounding narration; mood;  #
 * #    desired visual style."                                               #
 * #                                                                        #
 * # The judge was told five lines about one shot and nothing about the      #
 * # film. Every one of these fields already existed on `ResearchDossier`,   #
 * # written by stage 1b, and nothing read them.                             #
 * ##########################################################################
 *
 * A MIRROR OF THE DOSSIER'S FIELDS, DELIBERATELY NOT AN IMPORT OF IT.
 * `ResearchDossier` lives in `apps/worker/src/stages/types.ts` — outside the
 * compositor's bundle graph on purpose — and `@vg/core` may not depend on the
 * worker. `logline` and `keyEntities` are left out because the judge is shown a
 * single shot and its neighbours: a four-hundred-character logline and forty
 * proper nouns are the SEARCH's context, not the judge's.
 */
export type VisionFilmContext = {
  topic: string
  category: string
  narrativeStyle: string
  /** The era the CONTENT occupies, never the era the script was written in. */
  period: string
  /** Kept apart from `period`: a picture can be right for the century and wrong for the continent. */
  setting: string
  visualStyle: readonly string[]
  /** His section 3. A STEER, never a veto — a sentence naming a laboratory outranks it. */
  preferredVisualCategories: readonly string[]
  avoidVisualCategories: readonly string[]
}

/**
 * ##########################################################################
 * # EVERY FIELD HERE IS REQUIRED, INCLUDING THE NULLABLE ONES, AND THAT IS  #
 * # THE POINT. This is a plain type with no parse at its boundary, so an    #
 * # optional field arrives `undefined` on any construction site that        #
 * # predates it — and `x === null` is false for undefined. That exact shape #
 * # took down seventy-four tests at once on `DeviceBeat`. Required fields   #
 * # make `tsc` the enumerator: there are four construction sites and the    #
 * # compiler names all four.                                                #
 * ##########################################################################
 */
export type VisionSceneContext = {
  text: string
  visualIntent: string
  entities: readonly string[]
  mood: string
  sceneType: string
  /**
   * His section 2, "always consider the surrounding narration, not only the
   * sentence currently being illustrated". `null` at the edges of the film.
   *
   * Four consecutive shots of the delivered film carry one sentence about a
   * scholar at a Munich university. Each was judged alone, and all four drew a
   * generic modern library interior that the judge itself scored 4.0.
   */
  previousText: string | null
  nextText: string | null
  /** `null` when stage 1b returned `unavailable`. The judge still works without it. */
  film: VisionFilmContext | null
}

export type VisionCandidateInput = {
  /** Only used by the caller to key the per-image cache. Never sent to the model. */
  contentHash: string
  base64: string
  mimeType: string
  title: string
  description: string
}

export type VisionRankResult = {
  candidates: VisionCandidate[]
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

/**
 * Score candidate images against one scene.
 *
 * THE MODEL ANSWERS BY INDEX. `candidates` is `VisionCandidate[]`, whose
 * `candidateIndex` is the only handle on an image the model is allowed to emit —
 * never a path, a URL, a filename or a LUT name. Candidate titles and
 * descriptions come from publicly editable catalogues, so an implementation must
 * treat them as untrusted labels and must have passed the model's answer through
 * `VisionResponseSchema` before returning it.
 *
 * THE CALLER'S ANSWER TO A THROW IS THE FREE KEYWORD PREFILTER SCORE, never a
 * failed job or a failed scene. Unparseable output must therefore be thrown, not
 * coerced: a coerced score would outrank a real judgement.
 *
 * `inputTokens` is what the ledger is charged on, so an implementation that has
 * to estimate must do the estimating here — the caller has no way to know which
 * provider bills images at what rate.
 */
export interface VisionRanker {
  readonly provider: VisionProvider
  readonly model: string
  readonly promptVersion: number
  /** Provider-native verb for the `api_usage` ledger, e.g. `generateContent`. */
  readonly operation: string
  rank(
    scene: VisionSceneContext,
    candidates: readonly VisionCandidateInput[],
    signal?: AbortSignal,
  ): Promise<VisionRankResult>
  costMicros(inputTokens: number, outputTokens: number): number
}
