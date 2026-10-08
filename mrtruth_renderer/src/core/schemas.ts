import { z } from 'zod'
import { SceneDeviceSchema } from './devices.js'

/**
 * THE CANONICAL CONTRACT.
 *
 * Every package imports these types. Nobody redeclares them.
 *
 * Two conventions that the whole pipeline depends on — read them before writing
 * anything that produces or consumes a VideoPlan:
 *
 * 1. FRAME SPACE. `PlannedScene.startFrame` is the ONLY absolute (timeline) frame
 *    number in a scene. Everything else inside a PlannedScene — caption frames,
 *    text-card word frames, transition durations — is SCENE-RELATIVE, i.e. frame 0
 *    is the first frame of that scene's own segment render. This is what makes a
 *    segment renderable in isolation and is what makes the `renderKey` cache sound
 *    (see renderKey.ts).
 *
 * 2. PATH SPACE. Every `*Path` field is a STORAGE KEY — a relative POSIX string
 *    validated by `isSafeStorageKey`, never an absolute filesystem path and never a
 *    remote URL. Resolve keys to real paths with `LocalStorageAdapter.resolve(key)`
 *    at the point of use.
 */

/* ------------------------------------------------------------------------- */
/* Constants                                                                   */
/* ------------------------------------------------------------------------- */

export const FPS = 30
export const FRAME_WIDTH = 1920
export const FRAME_HEIGHT = 1080

/** Ken Burns must never scale below this or the image edges are exposed. */
export const MIN_SCALE = 1
/** Sanity ceiling. Above ~1.35 a stock photo turns to mush at 1080p. */
export const MAX_SCALE = 1.6

/** V1 ships exactly one grade. Planner code should import DEFAULT_GRADE, not retype it. */
export const LUT_NAMES = ['documentary-neutral'] as const

export const DEFAULT_GRADE = {
  lut: 'documentary-neutral',
  vignette: 0.18,
  grain: 0.06,
} as const

/** The worker checkpoints `jobs.stage` after each of these, in order. */
export const PIPELINE_STAGES = [
  'ingest',
  'align',
  'segment',
  'source',
  'plan',
  'render',
  'deliver',
] as const

/* ------------------------------------------------------------------------- */
/* Storage key grammar                                                         */
/* ------------------------------------------------------------------------- */
/* Lives here (not in storage.ts) so that browser bundles can import            */
/* `@vg/core/schemas` without dragging node:fs in.                              */

export const MAX_STORAGE_KEY_LENGTH = 512

/**
 * One path segment. Leading char must be alphanumeric, which rejects `.`, `..`
 * and dotfiles outright. No percent-encoding, so `%2e%2e` cannot smuggle a
 * traversal past a later decode.
 */
const STORAGE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isSafeStorageKey(key: string): boolean {
  if (typeof key !== 'string') return false
  if (key.length === 0 || key.length > MAX_STORAGE_KEY_LENGTH) return false
  if (key.includes('\0') || key.includes('\\')) return false
  if (key.startsWith('/')) return false
  if (/^[A-Za-z]:/.test(key)) return false

  for (const segment of key.split('/')) {
    if (!STORAGE_SEGMENT_PATTERN.test(segment)) return false
  }
  return true
}

export const StorageKeySchema = z
  .string()
  .max(MAX_STORAGE_KEY_LENGTH)
  .refine(isSafeStorageKey, 'must be a relative POSIX storage key (no traversal, no absolute path)')

/** Lowercase sha-256 hex digest. */
export const ContentHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'expected a lowercase sha-256 hex digest')

const HttpsUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => /^https:\/\/[^\s]+$/i.test(value), 'must be an https URL')

/**
 * WHERE A PICTURE CAME FROM, when it did not come from anywhere.
 *
 * A generated frame has an IDENTITY BUT NO LOCATION. Every other asset in this
 * pipeline is named by the https URL it was found at, and three separate contracts
 * — `AssetInputSchema.sourceUrl` (which is a NOT NULL column under a unique index),
 * `PlannedAssetSchema.sourceUrl` and `CreditsEntrySchema.sourceUrl` — require one.
 * A generated image has no such URL: the bytes arrive inline, base64, in the
 * response body.
 *
 * ##########################################################################
 * # A PLAUSIBLE-LOOKING https URL IS NOT AN OPTION. It would satisfy all   #
 * # three contracts in one line, and `sourceUrl` is copied verbatim into   #
 * # the CREDITS MANIFEST the client is handed. An entry that names a web   #
 * # address nobody can open, for a photograph nobody took, is a forgery in #
 * # the one document whose entire job is to say where each frame came      #
 * # from. The whole feature is defensible only if that document is true.   #
 * ##########################################################################
 *
 * So: a `urn:`. It cannot be mistaken for a link, it cannot be clicked, it is not
 * fetchable by anything, and it says what it is in its own text. Nothing ever
 * dereferences a `sourceUrl` — `safeFetch` is only ever handed
 * `AssetCandidate.downloadUrl`, and the only URL the web UI renders as an anchor
 * is `pageUrl`, which a generated asset leaves NULL because no such page exists.
 *
 * CONTENT-ADDRESSED, so it is a real identity rather than a label: the unique
 * index on `assets.source_url` then means the same generated frame can never enter
 * the cache twice, which is exactly the invariant that column already carries for
 * a Wikimedia file. The MODEL ID is deliberately NOT in here — it is config with a
 * documented escalation path (`AI_IMAGE_MODEL`), so putting it in the identity
 * would make one image under two models two rows of the same pixels. It lives on
 * `PlannedAssetSchema.generator` and in `assets.metadata`, where it belongs.
 */
export const GENERATED_ASSET_URN_PREFIX = 'urn:vg:ai:'

export const GeneratedAssetUrnSchema = z
  .string()
  .regex(/^urn:vg:ai:[0-9a-f]{64}$/, 'expected urn:vg:ai:<sha-256 of the generated bytes>')

/** Takes the hash of the PREPARED bytes, which is what `contentHash` is everywhere else. */
export function generatedAssetUrn(contentHash: string): string {
  return `${GENERATED_ASSET_URN_PREFIX}${contentHash}`
}

export function isGeneratedAssetUrn(value: string): boolean {
  return GeneratedAssetUrnSchema.safeParse(value).success
}

/**
 * An https URL or the generated-asset urn above, and nothing else.
 *
 * A UNION RATHER THAN A LOOSENED URL RULE. `HttpsUrlSchema` stays exactly as
 * strict as it was for every asset that really was fetched from somewhere, so
 * this cannot become the hole through which an `http://` or a `file://` reaches
 * the asset table. The only new string the boundary accepts is one this repo
 * mints itself, from a digest it computed.
 */
export const AssetOriginSchema = z.union([HttpsUrlSchema, GeneratedAssetUrnSchema])

/* ------------------------------------------------------------------------- */
/* Model-supplied text                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Anything that looks like a resource locator. LLM output is untrusted input; a
 * model that returns `../../.env` or `https://evil/x.png` in a "mood" field must
 * be rejected at the boundary, not sanitised three layers deep.
 */
const RESOURCE_LOCATOR_PATTERN =
  /(?:[a-z][a-z0-9+.-]*:\/\/|\bdata:|\bfile:|\.\.[/\\]|\\|\/\/|\/[\w.-]+\/|\.(?:png|jpe?g|webp|gif|svg|bmp|tiff?|mp4|mov|webm|mkv|mp3|wav|flac|cube|3dl|lut|json|ya?ml|env|js|mjs|cjs|ts|sh|bat|ps1|exe)\b)/i

/**
 * A numeric calendar date, the one slash-separated thing narration legitimately
 * says. The twin of `NUMERIC_DATE_PATTERN` in `devices.ts`, duplicated for the
 * same acyclic-import reason as the locator pattern above, and pinned by a test
 * in each file that asserts the two agree.
 *
 * Full reasoning, including why this strips rather than exempts, is in the box
 * over the copy in `devices.ts`.
 */
const NUMERIC_DATE_PATTERN = /\b(?:[12]\d|3[01]|0?[1-9])\/(?:[12]\d|3[01]|0?[1-9])\/(?:\d{4}|\d{2})\b/g

export function containsResourceLocator(value: string): boolean {
  return RESOURCE_LOCATOR_PATTERN.test(value.replace(NUMERIC_DATE_PATTERN, ''))
}

/** A bounded, locator-free string produced by a model. */
function modelText(max: number): z.ZodType<string> {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => !containsResourceLocator(value),
      'model text may not contain a URL, path, filename or LUT reference',
    )
}

/* ------------------------------------------------------------------------- */
/* Stage 2 — alignment                                                         */
/* ------------------------------------------------------------------------- */

export const WordTimingSchema = z
  .object({
    word: z.string().min(1).max(120),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    confidence: z.number().min(0).max(1),
  })
  .refine((w) => w.endMs >= w.startMs, 'endMs must be >= startMs')

export type WordTiming = z.infer<typeof WordTimingSchema>

export const WordTimingsSchema = z.array(WordTimingSchema).max(200_000)

/* ------------------------------------------------------------------------- */
/* Stage 3 — segmentation                                                      */
/* ------------------------------------------------------------------------- */

export const SceneTypeSchema = z.enum(['imagery', 'data', 'titleCard', 'quote'])
export type SceneType = z.infer<typeof SceneTypeSchema>

/* ------------------------------- the overlay, which is not the text card -- */

/**
 * ##########################################################################
 * # TWO TEXT DEVICES, AND THEY ARE NOT THE SAME FEATURE.                   #
 * #                                                                        #
 * # TEXT CARD (`TextCardSchema`, below) is a FALLBACK. Full frame, blurred #
 * # backdrop, and it fires only when a scene has NO picture. It is what     #
 * # goes on screen when sourcing came back empty.                          #
 * #                                                                        #
 * # OVERLAY (here) is an EDITORIAL DEVICE. A few words set ON TOP of a real #
 * # photograph, on a scene that HAS one, because that beat earned being     #
 * # named. Nothing about it is a failure state.                            #
 * #                                                                        #
 * # A SCENE MUST NEVER CARRY BOTH. The planner enforces that from the one   #
 * # place that already decides a scene shows a card (`buildSceneDrafts` in  #
 * # apps/worker/src/stages/plan.ts); the compositor asks the same question  #
 * # a second time (`Scene.tsx`) so the two can never disagree.             #
 * ##########################################################################
 */

/**
 * HOW MANY CHARACTERS THE OVERLAY LINE HOLDS.
 *
 * 26, which is what one line of the film's largest type ever held: the 1260px
 * measure the text card is set on (`TEXT_CARD_BLOCK_WIDTH` in
 * `apps/web/src/remotion/constants.ts`) at the 92px top of the card's type
 * scale, where 0.511 is the mean advance of Libre Franklin already measured for
 * the captions:
 *
 *   1260 / (92 x 0.511) = 26.8 characters
 *
 * ##########################################################################
 * # IT IS NOT A MEASUREMENT OF THE BLOCK ANY MORE, AND THAT IS DELIBERATE.  #
 * #                                                                        #
 * # The overlay renders at 72px, the card's SECOND step, so the same block  #
 * # now holds 34 (`overlayMaxChars()` in that file, which is checked        #
 * # against this constant by `overlay.test.ts`). This cap stayed at 26      #
 * # rather than following it up, because the two numbers answer different   #
 * # questions. 34 is what fits. 26 is what the client asked for — "not long #
 * # sentence text, but shorter text overlay" — and loosening a bound        #
 * # written from his note because the type got smaller would be answering   #
 * # a design change with a scope change.                                    #
 * #                                                                        #
 * # The gap is also the safety margin. 0.511 is a MEAN, and the caption     #
 * # block's own `CAPTION_WIDTH_SLACK` already records that a line of wide   #
 * # glyphs runs past it. The overlay sets ONE line with `whiteSpace:        #
 * # nowrap`, so it cannot wrap or step down a size out of trouble — an      #
 * # over-long line hangs off the measure. At 26/26 there was 3% of          #
 * # headroom; at 26/34 there is 24%.                                        #
 * ##########################################################################
 *
 * The card scales its type DOWN to fit whatever the planner wrote, which is how
 * it swallows 85 characters. The overlay has no such escape: a model that writes
 * a sentence fails validation here rather than reaching a frame.
 */
export const OVERLAY_MAX_CHARS = 26

/**
 * And a word bound as well as a character bound, because they refuse different
 * things. 26 characters alone admits "the moon is hollow and old" — six words,
 * 25 characters, and a whole sentence of narration. Four words is the brief.
 */
export const OVERLAY_MAX_WORDS = 4

/**
 * THE `note` STYLE'S OWN BOUNDS, and they are deliberately much looser.
 *
 * ##########################################################################
 * # THIS IS NOT THE 26-CHARACTER RULE BEING RELAXED. IT IS A SECOND DEVICE. #
 * #                                                                        #
 * # The client's note was "not long sentence text, but shorter text        #
 * # overlay", and 26/4 is that instruction. It still governs the mark that  #
 * # NAMES a thing — "Aksum, Ethiopia", "100 BCE".                          #
 * #                                                                        #
 * # The reference he sent on 2026-08-15 at 5:07-5:10 is a different job. It #
 * # reads "Abydos panel — sedged: to cause to move by a proc…", which is an #
 * # ANNOTATION of the photograph on screen, set light and small and revealed#
 * # a character at a time. Refusing it at 26 characters would refuse the    #
 * # thing he asked to copy.                                                 #
 * #                                                                        #
 * # The bound is still a bound. 64 characters at the `note` size is two     #
 * # full lines of the measure and no more, which is what stops this style   #
 * # quietly becoming the caption track the whole feature exists to avoid.   #
 * ##########################################################################
 */
export const OVERLAY_NOTE_MAX_CHARS = 64
export const OVERLAY_NOTE_MAX_WORDS = 10

/**
 * What KIND of thing is being named.
 *
 * The card already learned this distinction the hard way: `textCardEyebrow`
 * routes a year or a proper noun into the gold letterspaced label and a written
 * fragment into the headline, because a year standing alone reads as a designed
 * label and a fragment standing alone reads as a caption that lost its sentence.
 * The overlay has one line to do both jobs, so the classification has to travel
 * with the line rather than be re-guessed by a regex in the renderer.
 *
 * Asking the model to classify before it writes is also what keeps it honest
 * about what the device is FOR. "Which of a date, a name and a phrase is this?"
 * has no good answer for a beat that did not earn an overlay.
 */
export const OverlayKindSchema = z.enum(['year', 'name', 'phrase'])
export type OverlayKind = z.infer<typeof OverlayKindSchema>

/**
 * HOW the line is set, which is a different question from WHAT it names.
 *
 * ##########################################################################
 * # `kind` AND `style` ARE NOT THE SAME AXIS AND MUST NOT BE COLLAPSED.    #
 * #                                                                        #
 * # `kind` is a fact about the CONTENT — the segmenter classified it with  #
 * # the narration in front of it. `style` is a decision about the          #
 * # TREATMENT. "1947" and "Council of Laodicea, 364" are both `year`, and  #
 * # only one of them can be set at 36% of the frame height.                #
 * ##########################################################################
 *
 * Three values, and one of them is legacy:
 *
 * `note` is the look the client asked for on 2026-08-15, from his reference at
 * 5:07-5:10 — light weight, warm, up to two lines, revealed left to right. It is
 * what an ordinary mark should be from now on.
 *
 * `fullFrame` is his other reference, at 0:24-0:27: a bare year set enormous and
 * centred over the picture. Reserved for a SHORT figure; the renderer falls back
 * rather than hang a long line off both edges, and `overlayFitsFullFrame` in the
 * compositor is the one place that judgement is made.
 *
 * `lowerThird` IS THE v5 LOOK AND IS KEPT ONLY SO OLD WORK STILL PARSES. Every
 * frozen `jobs.plan` and every `segment.json` on disk predates this field and
 * defaults into it, and `readArtifact` treats a parse failure as a cache MISS —
 * so removing the value would silently re-source and re-bill every real job that
 * has ever run. The segmenter is no longer offered it. This is the same reasoning
 * that keeps `titleCard` in `SceneTypeSchema` after nothing emits it.
 */
/*
 * `plate` is his 0:00-0:03 reference: the picture held small and framed on black
 * with its name centred underneath.
 *
 * ##########################################################################
 * # IT IS AN OVERLAY STYLE AND NOT A CROP MODE, AND THAT DISTINCTION IS    #
 * # THE WHOLE REASON IT IS SAFE TO BUILD.                                  #
 * #                                                                        #
 * # This geometry ALREADY EXISTS as `archivePlate`, and the client stopped #
 * # the delivered film on it at 0:02:23 and said the format was wrong. It  #
 * # was made unreachable for stills as a result, and `crop.test.ts` pins   #
 * # that decision.                                                         #
 * #                                                                        #
 * # His own reference is not a rebuttal of that: measured off his frame,   #
 * # the picture occupies 59% x 69%, which leaves MORE ground than the      #
 * # plate he rejected, not less. So the objection was never the amount of  #
 * # empty frame. What differs is that his is a TITLE — it happens once, at #
 * # 0:00, with the subject's name under it, and the space has a job.       #
 * #                                                                        #
 * # Built as a crop mode it would fire automatically on every tall         #
 * # photograph and reproduce exactly the complaint. Built as an overlay    #
 * # style it fires only where the segmenter deliberately marks a title     #
 * # beat, the crop routing he objected to is not touched at all, and       #
 * # turning it off again is one enum value.                                #
 * ##########################################################################
 *
 * ##########################################################################
 * # ONCE PER FILM, ON SCENE 0, AND NOWHERE ELSE. THE PLANNER ENFORCES IT.  #
 * #                                                                        #
 * # "It happens once, at 0:00" is the reason the device is safe, so it is  #
 * # a rule rather than an observation. `proposeDeterministicMarks`         #
 * # (plan.ts) will only ever reserve this style for a candidate whose      #
 * # scene is the film's FIRST, and only when the segmenter has not already #
 * # spent it — the same first refusal `fullFrame` gets.                     #
 * #                                                                        #
 * # A plate that has drifted to shot 4 is not a title, it is a mark set in #
 * # a treatment that says "the film starts here" three quarters of a       #
 * # minute in. If this ever needs to move, move it in the planner; the     #
 * # enum value is not what is holding it in place.                          #
 * ##########################################################################
 */
export const OverlayStyleSchema = z.enum(['lowerThird', 'note', 'fullFrame', 'plate'])
export type OverlayStyle = z.infer<typeof OverlayStyleSchema>

/** The character and word bounds that apply to a given style. */
export function overlayBoundsFor(style: OverlayStyle): { maxChars: number; maxWords: number } {
  return style === 'note'
    ? { maxChars: OVERLAY_NOTE_MAX_CHARS, maxWords: OVERLAY_NOTE_MAX_WORDS }
    : { maxChars: OVERLAY_MAX_CHARS, maxWords: OVERLAY_MAX_WORDS }
}

/**
 * The longest line the SEGMENTER is asked to set `fullFrame`, and it is advisory.
 *
 * ##########################################################################
 * # THIS IS NOT THE GATE. `overlayFitsFullFrame` in the compositor is, and #
 * # it measures the real line against the real frame at the real size.     #
 * #                                                                        #
 * # Two numbers with two jobs, deliberately. This one is a PROMPT bound —  #
 * # what the model is told to aim at, three packages away from any         #
 * # geometry. That one is a RENDER bound, and it falls back to             #
 * # `lowerThird` rather than hanging a line off both edges of the frame.   #
 * # They agree at today's type size; if the size moves, the renderer       #
 * # degrades safely and this number is what gets corrected.                #
 * #                                                                        #
 * # `packages/core` must not import from `apps/web`, which is why the two  #
 * # cannot simply be one constant.                                         #
 * ##########################################################################
 *
 * Five, because at 36% of the frame height a lining figure is about 324px wide
 * and six of them already run past the title-safe area.
 */
export const OVERLAY_FULL_FRAME_MAX_CHARS = 5

/**
 * NOT `.strict()`, unlike its parent, and the asymmetry is deliberate.
 *
 * `SegmentationSceneSchema` is strict because an unknown key at SCENE level was
 * once how `assetPath` or `lut` might have reached the plan. Inside the overlay
 * there is no such route: zod strips an unknown key here, so a volunteered
 * `overlay.reason` is gone before anything can read it, and failing the scene
 * over it would cost a visual beat, its timing and its three search queries to
 * a decorative field.
 */
export const SceneOverlaySchema = z.object({
  /**
   * `modelText` first, so the URL/path/filename refusal every other model-written
   * field gets applies here too — this string is the one that reaches a frame.
   *
   * BOUNDED AT THE LOOSEST STYLE HERE, AND TIGHTENED PER STYLE BELOW. The length
   * a mark is allowed depends on how it is set — 26 characters for a label, 64
   * for an annotation — and a field-level check cannot see a sibling field. This
   * one keeps the absolute ceiling and the resource-locator refusal; the
   * `superRefine` under the object applies the rule that actually varies.
   */
  text: modelText(OVERLAY_NOTE_MAX_CHARS),
  kind: OverlayKindSchema,

  /**
   * DEFAULTED AND CAUGHT, and both halves are load-bearing.
   *
   * `.default` is what lets every frozen `jobs.plan` and every `segment.json`
   * already on disk keep parsing. `readArtifact` treats a parse failure as a
   * cache MISS rather than an error, so a REQUIRED field here would silently
   * re-source and re-bill every real job that has ever run.
   *
   * `.catch` is the second net, and it guards a different failure. `projectScene`
   * in `llm/anthropic.ts` DELETES an overlay whose schema parse fails and only
   * increments a counter — so a model that invents a style value would strip
   * every mark from the film, leaving a passing test suite and one number in a
   * log as the only evidence. Degrading to the delivered look costs a treatment;
   * refusing costs the mark.
   */
  style: OverlayStyleSchema.default('lowerThird').catch('lowerThird'),

  /**
   * ##########################################################################
   * # ONE MOMENT, CARRIED IN TWO FRAMES OF REFERENCE. THE PAIR IS THE POINT. #
   * #                                                                        #
   * # `atMs` is ABSOLUTE — milliseconds into the film, the same clock every  #
   * # other timestamp in the segmenter's answer uses. `startFrame` is        #
   * # SCENE-RELATIVE, written by the planner, and is what the compositor     #
   * # draws from.                                                            #
   * #                                                                        #
   * # They are not redundant. A scene is split, merged and re-timed between  #
   * # the model answering and the plan freezing (`splitLongScenes`,          #
   * # `absorbShortScenes`), so a relative offset written by the model would  #
   * # be measured against a scene that no longer exists. Absolute survives   #
   * # every one of those passes untouched, which is the same argument        #
   * # `frames.ts` already makes for deriving every `startFrame` from an      #
   * # absolute `startMs` rather than accumulating durations.                 #
   * ##########################################################################
   *
   * The client asked for a mark "on certain parts when a text overlay fits ...
   * when a certain important sentence is said, or a year for example". Before
   * this field every mark opened with its scene and was gone 3.07 seconds later,
   * whatever the narrator was saying at the time.
   */
  atMs: z
    .number()
    .int()
    .min(0)
    /*
     * `.catch(null)` HERE AND NOWHERE ELSE. This number is MODEL-WRITTEN, and a
     * model that miscopies a timestamp should cost the timing, not the line —
     * without the catch the projection in `llm/anthropic.ts` refuses the whole
     * overlay and counts it as dropped, so a stray digit deletes a good mark.
     */
    .nullish()
    .catch(null),

  /**
   * The rebased answer, in frames from this scene's own frame 0.
   *
   * NO `.catch(null)`, deliberately, and the asymmetry with `atMs` above is the
   * whole reason both fields exist. This one is MACHINE-written by
   * `rebaseOverlay`, so a bad value is a bug in our arithmetic rather than drift
   * in someone else's answer, and swallowing it would hide the bug behind a mark
   * that silently renders at frame 0. `assertPlanInvariants` is what bounds it
   * against the scene's real length; there is no useful absolute bound here.
   */
  startFrame: z.number().int().min(0).nullish(),
})
  /**
   * THE LENGTH RULE, APPLIED PER STYLE, because it is the one bound that depends
   * on how the line is set rather than on what it says.
   *
   * A label at 72px on one un-wrapping line cannot hold a sentence, and that is
   * why 26/4 exists. An annotation at the `note` size wraps to two lines and is
   * allowed 64/10. Checking either on the `text` field alone is impossible — a
   * field-level refinement cannot see `style`.
   *
   * TWO SEPARATE ISSUES RATHER THAN ONE, deliberately: a model that wrote four
   * long words and a model that wrote ten short ones have made different
   * mistakes, and `droppedOverlays` in `llm/anthropic.ts` is a bare counter, so
   * the message is the only thing that will ever say which.
   */
  .superRefine((overlay, ctx) => {
    const { maxChars, maxWords } = overlayBoundsFor(overlay.style)

    if (overlay.text.length > maxChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: `a ${overlay.style} overlay must be ${String(maxChars)} characters or fewer`,
      })
    }

    const words = overlay.text.split(/\s+/).filter((word) => word.length > 0).length
    if (words > maxWords) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: `a ${overlay.style} overlay must be ${String(maxWords)} words or fewer`,
      })
    }
  })

export type SceneOverlay = z.infer<typeof SceneOverlaySchema>

export const SceneSchema = z.object({
  index: z.number().int().min(0).max(5000),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().max(4000),
  visualIntent: z.string().max(600),
  /** Exactly three, in order: literal, conceptual, mood. */
  queries: z.array(z.string().min(1).max(160)).length(3),
  entities: z.array(z.string().max(120)).max(24),
  mood: z.string().max(60),
  sceneType: SceneTypeSchema,
  /**
   * The short line to set over this scene's picture, or null — which is what
   * almost every scene carries. See `SceneOverlaySchema`.
   *
   * `.default(null)` IS LOAD-BEARING, for the same reason `PlannedAssetSchema
   * .generator` carries one. `SegmentOutputSchema` parses `segment.json` back off
   * disk on every resume, and every artifact written before this field existed
   * has no `overlay` key. A required field here would make those unreadable,
   * `readArtifact` treats a parse failure as a MISS, and the job would re-bill a
   * full re-segmentation of the client's script to learn nothing new.
   */
  overlay: SceneOverlaySchema.nullable().default(null),
})

export type Scene = z.infer<typeof SceneSchema>

/**
 * What the Anthropic segmentation call is ALLOWED to return.
 *
 * Deliberately narrower than `Scene`:
 *  - `.strict()` — an unknown key is a hard failure, so the model cannot smuggle
 *    `assetPath`, `lut`, `command` or anything else into the plan.
 *  - no `index` — the caller assigns it from array order, so the model cannot
 *    reorder or duplicate scenes.
 *  - every free-text field is `modelText`, which rejects URLs, paths, filenames
 *    and LUT names.
 */
export const SegmentationSceneSchema = z
  .object({
    startMs: z.number().int().min(0).max(3_600_000),
    endMs: z.number().int().min(0).max(3_600_000),
    text: modelText(4000),
    visualIntent: modelText(600),
    queries: z.array(modelText(160)).length(3),
    entities: z.array(modelText(120)).max(24),
    mood: modelText(60),
    sceneType: SceneTypeSchema,
    /**
     * OPTIONAL as well as nullable, and both spellings have to be legal.
     *
     * Most scenes earn no overlay, and "most" is the whole design — the prompt
     * asks for roughly one every 45 seconds. A model told to omit a key omits
     * it; a model told to say "no" writes `null`. Refusing either spelling would
     * refuse a correct answer, and `.strict()` above means an absent key is the
     * only alternative to a legal one.
     */
    overlay: SceneOverlaySchema.nullish(),
  })
  .strict()
  .refine((s) => s.endMs > s.startMs, 'endMs must be > startMs')

export const SegmentationResponseSchema = z
  .object({
    scenes: z.array(SegmentationSceneSchema).min(1).max(1000),
  })
  .strict()

export type SegmentationScene = z.infer<typeof SegmentationSceneSchema>
export type SegmentationResponse = z.infer<typeof SegmentationResponseSchema>

/* ------------------------------------------------------------------------- */
/* Stage 4c — Gemini vision ranking                                            */
/* ------------------------------------------------------------------------- */

export const ShotScaleSchema = z.enum(['wide', 'medium', 'closeup'])
export type ShotScale = z.infer<typeof ShotScaleSchema>

export const AnchorSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

/**
 * ##########################################################################
 * # DOES THE PICTURE SHOW THE THING, OR SOMETHING OF THE SAME KIND?         #
 * #                                                                        #
 * # THE DEFECT THIS ANSWERS. On seven shots of the delivered film the judge #
 * # scored a picture highly AND said in `reason` that it showed a different #
 * # object: a haloed St Luke evangelist portrait at 7.0 "rather than        #
 * # Enoch", under the line "Enoch chapters one through 36". An Egyptian     #
 * # artifact under a claim about 47 lines of Aramaic. Illuminated Quran     #
 * # folios under the Parables of Enoch.                                     #
 * #                                                                        #
 * # WHY A FIELD AND NOT THE SENTENCE. Reading `reason` for those words is   #
 * # trap FF (`deviceChoice.ts`): a reword carrying the same meaning —       #
 * # "though it is not the Qumran manuscript" — never spells the token, so a #
 * # prose rule is one sentence deep. A QUESTION THE MODEL ANSWERS cannot be #
 * # reworded around, because it is not prose. `hasBakedText` is the         #
 * # precedent and it is exactly this shape.                                 #
 * #                                                                        #
 * # THREE ANSWERS AND NOT A BOOLEAN. "Is this the thing?" has no true or    #
 * # false for a beat whose visual intent names no specific object, and a    #
 * # forced false there would penalise every mood shot in the film. The      #
 * # prompt sends those to `named-subject`, which costs nothing.             #
 * ##########################################################################
 */
export const DepictionSchema = z.enum([
  /** The specific object, person or place the visual intent named. */
  'named-subject',
  /** The right KIND of thing, a different one. A Quran folio for an Enoch codex. */
  'same-category',
  /** Neither. */
  'unrelated',
])

export type Depiction = z.infer<typeof DepictionSchema>

/**
 * ##########################################################################
 * # WHOSE TRADITION THE PICTURED ARTIFACT BELONGS TO, WHICH `depiction`     #
 * # CANNOT ANSWER AND THE CLIENT SAW.                                       #
 * #                                                                        #
 * # Job 0d4dec42 put an illuminated Arabic manuscript on shot 28 and a      #
 * # Qur'an page under a magnifying glass on shot 33, in a film about the    #
 * # Book of Enoch. THE JUDGE GOT IT RIGHT: it answered `same-category` on   #
 * # both and wrote "the script is Islamic rather than" and "Arabic          #
 * # manuscript ... though wrong" in its own reason. The prompt even names   #
 * # this exact case as its worked example of `same-category` — "an          #
 * # illuminated Quran folio where the intent named an Enoch codex".         #
 * #                                                                        #
 * # SO NOTHING WAS BROKEN. `same-category` costs ONE rubric band, the       #
 * # Arabic manuscript scored 6.5 against a 6.2 alternative, and one band    #
 * # was not enough. Raising the price of `same-category` across the board   #
 * # is the -4 all over again: it also covers a generic desert cliff where   #
 * # the intent named the Qumran cliff, which is a mild and often correct    #
 * # substitution.                                                          #
 * #                                                                        #
 * # THE MISSING DISTINCTION IS THAT SOME SUBSTITUTIONS ARE FACTUAL          #
 * # EMBARRASSMENTS AND OTHERS ARE NOT. A different cliff is a compromise. A #
 * # different religion's scripture, under narration about this one, is a    #
 * # mistake a viewer will name out loud.                                    #
 * #                                                                        #
 * # SCOPED TO ARTIFACTS, AND THAT IS WHAT KEEPS IT SAFE. The judge prompt   #
 * # already says a sentence can override the film, so a beat about scholars #
 * # in Iowa correctly shows a modern American library — which is "foreign"  #
 * # to Second Temple Judaism in every sense except the one that matters.    #
 * # This question is asked ONLY of a religious or cultural artifact, and    #
 * # `not-applicable` is both a legal answer and the commonest one.          #
 * ##########################################################################
 */
export const ArtifactTraditionSchema = z.enum([
  /** Not a religious or cultural artifact at all. A landscape, a room, a tool. */
  'not-applicable',
  /** The artifact belongs to the tradition this documentary is about. */
  'matches-film',
  /** The artifact belongs to a DIFFERENT religion, culture or civilisation. */
  'different-tradition',
])

export type ArtifactTradition = z.infer<typeof ArtifactTraditionSchema>

export const AssetVisionSchema = z.object({
  score: z.number().min(0).max(10),
  /** Diagnostics only. NEVER rendered into the video, never shown to a viewer. */
  reason: z.string().max(400),
  shotScale: ShotScaleSchema,
  subjectAnchor: AnchorSchema,
  meanLuma: z.number().min(0).max(1),
  dominantHue: z.number().min(0).max(360),
  hasBakedText: z.boolean(),
  /**
   * ########################################################################
   * # `.optional()` IS LOAD-BEARING, AND IT IS THE WHOLE COMPATIBILITY      #
   * # STORY. The `assets` table on the render box is GLOBAL and shared by   #
   * # every job that has ever run there; it already holds hundreds of       #
   * # vision rows written without this key. A dozen fixtures across         #
   * # `test-utils.ts`, `deviceChoice.test.ts`, `devices.test.ts`,           #
   * # `deviceChoice.visualPlan.test.ts` and `overlay.test.ts` build an      #
   * # `AssetVision` by hand. A REQUIRED field breaks all of them at once,   #
   * # and `readArtifact` treats a parse failure as a MISS — so a resumed    #
   * # job would re-bill an entire ranking pass to learn nothing new.        #
   * #                                                                      #
   * # ABSENT IS NO SIGNAL, NEVER "WRONG". `source.ts` reads `undefined` as  #
   * # nothing to subtract, so a row from before this field ranks exactly as #
   * # it did the day it was written. Same shape, and the same reasoning, as #
   * # `Scene.overlay` and `PlannedScene.transitionOut`.                     #
   * ########################################################################
   */
  depiction: DepictionSchema.optional(),
  /**
   * `.optional()` FOR EXACTLY THE REASON `depiction` IS, one field above. The
   * box's `assets` table is global and holds hundreds of rows written before
   * this key existed; absent must read as NO SIGNAL and rank as it always did.
   */
  artifactTradition: ArtifactTraditionSchema.optional(),
})

export type AssetVision = z.infer<typeof AssetVisionSchema>

/** Hard cap on how many candidates go into one Gemini batch call. */
export const MAX_VISION_CANDIDATES = 64

/**
 * The Gemini batch response.
 *
 * The model selects by INDEX into the candidate array we sent it — never by URL,
 * never by path, never by filename. That means a prompt-injected image caption
 * cannot make us fetch or render an attacker-chosen resource; the worst it can do
 * is misrank a candidate we already vetted.
 */
export const VisionCandidateSchema = AssetVisionSchema.extend({
  candidateIndex: z.number().int().min(0).max(MAX_VISION_CANDIDATES - 1),
}).strict()

export const VisionResponseSchema = z
  .array(VisionCandidateSchema)
  .min(1)
  .max(MAX_VISION_CANDIDATES)
  .refine(
    (rows) => new Set(rows.map((r) => r.candidateIndex)).size === rows.length,
    'candidateIndex values must be unique',
  )

export type VisionCandidate = z.infer<typeof VisionCandidateSchema>
export type VisionResponse = z.infer<typeof VisionResponseSchema>

/* ------------------------------------------------------------------------- */
/* Stage 5 — the VideoPlan                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Ken Burns.
 *
 * `fromScale`/`toScale` are absolute scale factors and are never below 1.0.
 *
 * `fromX`/`toX`/`fromY`/`toY` are NOT pixels and NOT frame fractions. They are
 * NORMALISED PAN POSITIONS in [-1, 1]: the fraction of the pan slack that the
 * current scale makes available. The renderer must not interpret them itself —
 * call `kenBurnsFramePercent()` from motion.ts, which converts them to a CSS
 * percentage of the transformed element's own box as `u * (scale - 1) / 2`.
 * Encoding pan this way makes edge exposure geometrically impossible at every
 * frame, including a push that starts at exactly 1.0 where the slack is zero.
 *
 * PERCENT, not pixels, and that distinction is load-bearing. The pixel form
 * `kenBurnsFrameValues()` needs to be told the element's size, and two of the
 * four crop branches transform an element far narrower than the frame — an
 * archive plate is ~564px wide, not 1920. Every caller that passed the frame
 * size to those branches panned the picture clean off its own plate. A CSS
 * percentage resolves against the element's own untransformed border box, so
 * the renderer no longer has to know, or be told, how big anything is.
 */
/**
 * The easing curves a move may take. Control points live in `EASING_BEZIER`
 * (motion.ts), which is also where the reason each one exists is written down.
 *
 * ############################################################################
 * # `linearOut` MUST STAY A MEMBER, AND MUST KEEP THIS SPELLING.              #
 * #                                                                           #
 * # `jobs.plan` rows are frozen and read back through `VideoPlanSchema`, and  #
 * # every plan ever persisted carries `'linearOut'`. This was a               #
 * # `z.literal('linearOut')` until the move set grew to three; widening a     #
 * # literal to an enum that CONTAINS it is the one shape of this change that  #
 * # keeps every stored plan parsing. Rename it for tidiness and every job in  #
 * # the database fails to load.                                              #
 * #                                                                           #
 * # NEVER ADMIT AN EASING WITH A NON-ZERO EASE-IN. Every member has control   #
 * # points x1 = y1 = 0, so the image is already moving on the frame the cut   #
 * # lands on; an ease-in holds it nearly still for ~0.4s after every cut and  #
 * # reads as PowerPoint. motion.test.ts pins that over the whole enum.        #
 * ############################################################################
 */
export const EasingNameSchema = z.enum(['linearOut', 'linear', 'glide'])
export type EasingName = z.infer<typeof EasingNameSchema>
/** The enum's members as a plain array, for validators that cannot depend on zod. */
export const EASING_NAMES = EasingNameSchema.options

export const MotionSchema = z.object({
  type: z.literal('kenBurns'),
  fromScale: z.number().min(MIN_SCALE).max(MAX_SCALE),
  toScale: z.number().min(MIN_SCALE).max(MAX_SCALE),
  fromX: z.number().min(-1).max(1),
  toX: z.number().min(-1).max(1),
  fromY: z.number().min(-1).max(1),
  toY: z.number().min(-1).max(1),
  /**
   * NOT DEFAULTED, AND IT DOES NOT NEED TO BE. Widening the old literal to an
   * enum containing it adds no required field, so every frozen plan still
   * parses unchanged — see `EasingNameSchema`.
   */
  easing: EasingNameSchema,
})

export type Motion = z.infer<typeof MotionSchema>

export const CaptionWordSchema = z.object({
  text: z.string().min(1).max(120),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
})

export const CaptionPhraseSchema = z.object({
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  words: z.array(CaptionWordSchema).min(1).max(32),
})

export type CaptionWord = z.infer<typeof CaptionWordSchema>
export type CaptionPhrase = z.infer<typeof CaptionPhraseSchema>

export const CropModeSchema = z.enum(['fill', 'archivePlate', 'blurPillarbox', 'letterbox'])
export type CropMode = z.infer<typeof CropModeSchema>

export const CropSchema = z.object({
  mode: CropModeSchema,
  anchor: AnchorSchema,
})

export type Crop = z.infer<typeof CropSchema>

/**
 * `flash` IS A WASH OVER THE INCOMING SHOT, NOT A BLEND OF TWO.
 *
 * ##########################################################################
 * # IT CANNOT TOUCH THE OUTGOING PICTURE, AND THAT IS STRUCTURAL.          #
 * #                                                                        #
 * # Every scene is rendered as its own file and the files are concatenated #
 * # without re-encoding, so a transition can only paint into the frames of  #
 * # the segment it belongs to. `crossfade` gets around that by carrying a   #
 * # frozen copy of the previous image in `prevAsset` and compositing it     #
 * # here. A bloom needs nothing from before it, so it does not pay that     #
 * # cost — and must NOT be given `prevAsset`, which `assertPlanInvariants`  #
 * # enforces by refusing it on anything but a crossfade.                    #
 * #                                                                        #
 * # The client's reference (2026-08-15, 0:23) shows the wash beginning as   #
 * # the NEW picture arrives, which is exactly what this model produces.     #
 * ##########################################################################
 *
 * Modelled on `dipToBlack`, which is the other full-frame layer over the
 * incoming segment, and not on `crossfade`.
 */
/*
 * ##########################################################################
 * # `crossfade` STAYS A MEMBER EVEN THOUGH THE PLANNER NO LONGER EMITS ONE. #
 * #                                                                        #
 * # The client, 2026-08-30: "Remove all fade transitions (if the generated  #
 * # video had any)". `pickTransition` therefore never returns it any more.  #
 * #                                                                        #
 * # BUT EVERY FROZEN PLAN ON DISK STILL CONTAINS THEM, and this schema is   #
 * # what parses them back. Dropping the member turns every stored plan into #
 * # a validation error, which would make the delivered film unreadable and  #
 * # every artifact un-replayable. A retired value is not a deleted one.     #
 * ##########################################################################
 *
 * ##########################################################################
 * # AND `filmBurn` IS NOW RETIRED THE SAME WAY, 2026-09-10, FOR TWO        #
 * # REASONS RATHER THAN ONE.                                               #
 * #                                                                        #
 * # The client: "Remove the current film burn fully, get rid of it". Every #
 * # line that DREW it is deleted, and `pickTransition` no longer returns   #
 * # it, so no new plan can contain one.                                    #
 * #                                                                        #
 * # 1. THE SAME STORED-PLAN ARGUMENT AS `crossfade`, and it bites harder   #
 * #    here. `getJobPlan` uses `VideoPlanSchema.parse` and NOT `safeParse` #
 * #    (`packages/db/src/queries.ts`), so a dropped member does not         #
 * #    degrade, it throws, on a page the client opens. V49 alone has 35 of #
 * #    these strings in its frozen plan.                                    #
 * #                                                                        #
 * # 2. HE STILL WANTS THE EFFECT. His ruling the same day asks for a film  #
 * #    burn on 10% of transition points and he intends to supply the look. #
 * #    So this member is not a fossil like `crossfade`, it is a reserved   #
 * #    slot waiting for a drawer. Removing it would have to be undone.     #
 * #                                                                        #
 * # WHAT PROTECTS THE FILM MEANWHILE is that nothing emits it and nothing  #
 * # draws it. If a plan somehow carries one, `Scene.tsx` has no branch for #
 * # it and the boundary renders as a hard cut, which is a silent           #
 * # degradation rather than a crash. That is the argument for the plan     #
 * # gate rule the build plan calls T-20, which is NOT yet written.         #
 * ##########################################################################
 */
/*
 * ##########################################################################
 * # `pushCut` AND `slide` ADDED 2026-09-10, BY THE CLIENT'S WRITTEN RULING. #
 * #                                                                        #
 * #   "Use PushCut on 6% of all video transition points, selected randomly  #
 * #    throughout the video."                                               #
 * #   "Use Slide on 3% of all video transition points, selected randomly    #
 * #    throughout the video."                                               #
 * #                                                                        #
 * # Both are `@remotion/transitions` presets he named himself. Both         #
 * # composite the OUTGOING photograph, so both belong in `BLENDS_BACKWARDS` #
 * # in `frames.ts` and both take the two-neighbour clamp in `plan.ts`.      #
 * #                                                                        #
 * # WIDENING THIS ENUM IS THE SAFETY MECHANISM, NOT THE RISK. It is what    #
 * # turns every place that switches on a transition into a compile error,   #
 * # which is how the arms below get written instead of silently missed.     #
 * # The one shape it CANNOT catch is a `!==` early return or a fall-through #
 * # ternary, and there is one of each. See the boxes on the sizing ternary  #
 * # in `plan.ts` and on `transitionHitMs` in `deliver.ts`.                  #
 * ##########################################################################
 */
export const TransitionTypeSchema = z.enum([
  'cut',
  'crossfade',
  'dipToBlack',
  'flash',
  'filmBurn',
  'pushCut',
  'slide',
])
export type TransitionType = z.infer<typeof TransitionTypeSchema>

/**
 * THE TRANSITIONS THIS BUILD CAN ACTUALLY DRAW, which is a SMALLER SET than the
 * enum above and the difference is the dangerous part.
 *
 * ##########################################################################
 * # THE ENUM IS WHAT A STORED PLAN MAY CONTAIN. THIS IS WHAT THE COMPOSITOR #
 * # HAS A BRANCH FOR. Two retired members sit in the gap:                   #
 * #                                                                        #
 * #   crossfade   retired 2026-08-30, "Remove all fade transitions"        #
 * #   filmBurn    retired 2026-09-10, "Remove the current film burn fully" #
 * #                                                                        #
 * # A plan asking for either would not crash. `Scene.tsx` has no branch, so #
 * # the boundary renders as a plain hard cut, the render exits 0, and the   #
 * # film is quietly missing a transition the plan said was there. That is   #
 * # the exact silent-degradation shape this project keeps being bitten by.  #
 * #                                                                        #
 * # SO THE PLAN GATE REFUSES ANYTHING OUTSIDE THIS SET, and it derives the  #
 * # refusal from here rather than hard-coding a list. The day the client    #
 * # supplies a film burn to draw, `filmBurn` re-enters this array and the   #
 * # gate stops refusing it with no other edit.                              #
 * #                                                                        #
 * # IT MUST TRACK `Scene.tsx`. Nothing can check that automatically, which  #
 * # is why the set is small, named, and sat directly under the enum where a #
 * # reader adding a member cannot miss it.                                  #
 * ##########################################################################
 *
 * ##########################################################################
 * # `filmBurn` RE-ENTERED 2026-09-13, WITH NIKU'S OWN CLIP TO DRAW.         #
 * #                                                                        #
 * # `Scene.tsx` now has an `OverlayClipLayer` arm on both sides of the cut. #
 * # BUT BEING IN THIS SET IS NOT ENOUGH ANY MORE: the drawer needs a known  #
 * # `clip` and the exact lead and tail lengths, so a frozen V22 or V49 plan #
 * # with its old 24-frame burns would now pass T-20 and draw the wrong      #
 * # thing. T-24 is the rule that refuses those.                            #
 * ##########################################################################
 */
export const DRAWABLE_TRANSITION_TYPES: readonly TransitionType[] = [
  'cut',
  'dipToBlack',
  'flash',
  'filmBurn',
  'pushCut',
  'slide',
]

export const TransitionSchema = z.object({
  type: TransitionTypeSchema,
  /** Scene-relative: the blend occupies frames [0, durationFrames) of THIS segment. */
  durationFrames: z.number().int().min(0).max(90),
  /**
   * WHICH ROW OF `OVERLAY_CLIPS` (`effects.ts`) a `filmBurn` draws.
   *
   * ##########################################################################
   * # OPTIONAL, NOT NULLABLE, AND BOTH HALVES OF THAT ARE LOAD-BEARING.       #
   * #                                                                        #
   * # Optional so V22's and V49's frozen plans, 35 old 24-frame burns with no #
   * # clip, still PARSE: `getJobPlan` uses `parse`, not `safeParse`. T-24 is  #
   * # what refuses them. And absent rather than null because `canonicalise`   #
   * # skips undefined, so every scene without a burn keeps its render key.    #
   * #                                                                        #
   * # A pattern, not an enum of the table's ids: the schema would then import #
   * # the table and a removed row would make old plans unparseable. Whether   #
   * # the id is KNOWN is `assertPlanInvariants`' and T-24's question.        #
   * ##########################################################################
   */
  clip: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
    .optional(),
})

export const PlannedAssetSchema = z.object({
  path: StorageKeySchema,
  contentHash: ContentHashSchema,
  type: z.enum(['image', 'video']),
  /** An https URL for a found picture, a `urn:vg:ai:` identity for a generated one. */
  sourceUrl: AssetOriginSchema,
  license: z.string().max(200),
  attribution: z.string().max(500),
  vision: AssetVisionSchema.nullable(),
  /**
   * The model that DREW this frame, or null for the photographs, which is nearly
   * all of them.
   *
   * The machine-readable half of the provenance claim. `license` and `attribution`
   * both say "AI-generated" in English too, and they have to — they are what a
   * human reads — but an English sentence is not something a broadcaster's
   * compliance script can filter on, and this is.
   *
   * `.default(null)` IS LOAD-BEARING, not tidiness. `jobs.plan` is a frozen
   * `VideoPlan` and `saveJobPlan` persists the PARSED object, so a plan written
   * before this field existed must still parse or the client's completed jobs stop
   * re-delivering. Same reason `visionAvailable` carries one on SceneSelectionSchema.
   */
  generator: z.string().max(200).nullable().default(null),
  /**
   * The scene this picture is the ASSET OF, when it is being drawn somewhere else.
   *
   * ##########################################################################
   * # ONLY THE OPENING GALLERY FILLS THIS, AND IT IS THE FIELD THAT MAKES     #
   * # SAKU 0.3'S CENTRAL RULE CHECKABLE.                                      #
   * #                                                                        #
   * # His words: "Use 3-4 still images from real content that appears LATER   #
   * # in the video", and his own planning example carries a `sourceBeatId`    #
   * # per item for exactly this reason. Without it, "these pictures preview   #
   * # later content" is a claim nothing in the repo can verify — not the      #
   * # plan checker, not the credits, not the cache.                           #
   * #                                                                        #
   * # `null` FOR EVERY OTHER PICTURE, because a scene's own asset and its own #
   * # runners-up are not previews of anything. Null therefore means "drawn    #
   * # where it belongs", which is the honest default rather than a gap.       #
   * #                                                                        #
   * # NOT HASHED INTO THE RENDER KEY, on purpose. `computeRenderKey` projects #
   * # a companion down to `{ contentHash, type }` because the key is about    #
   * # PIXELS. This field changes no pixel, and folding it in would re-render  #
   * # every segment in the film for a piece of metadata. There is a test.     #
   * #                                                                        #
   * # `.default(null)` is load-bearing for the same reason `generator`'s is:  #
   * # `jobs.plan` is a frozen plan re-parsed on every re-delivery, so a plan  #
   * # written before this field existed has to keep parsing.                  #
   * ##########################################################################
   */
  sourceBeatId: z.number().int().min(0).nullable().default(null),
  /**
   * WHAT THE PIXELS SAY, AS OPPOSED TO WHAT THE MODEL GUESSED.
   *
   * ##########################################################################
   * # THIS FIELD EXISTS BECAUSE TWO GATES ASK THE SAME QUESTION AND ONLY ONE  #
   * # OF THEM CAN SEE THE ANSWER OTHERWISE.                                   #
   * #                                                                        #
   * # G8 runs in the chooser, where the worker's measurement is in hand.      #
   * # planCheck T-7 is a MUST that runs on the FROZEN PLAN and reads nothing  #
   * # else — `gatePlan` hands it a `VideoPlan` and the narration, and         #
   * # nothing more. So a chooser that admitted a device on a measured 0.51    #
   * # while the plan still carried the judge's 0.78 would pass the chooser    #
   * # and then throw `PermanentJobError` at the gate, with the whole film     #
   * # unrendered. One number, one meaning, one place, and this is the place.  #
   * #                                                                        #
   * # THE SCALAR ONLY. The band profiles the region gate reads are tens of    #
   * # thousands of numbers per picture and they never leave the plan stage;   #
   * # `jobs.plan` is a `jsonb` column re-parsed on every re-delivery and it   #
   * # is not a pixel store.                                                   #
   * #                                                                        #
   * # `.optional()` FOR THE REASON `depiction` ONE SCHEMA UP CARRIES IT, and  #
   * # not `.default(null)` like the two fields above. A defaulted field is    #
   * # REQUIRED in the inferred type, and a dozen fixtures across              #
   * # `test-utils.ts`, `deviceChoice.test.ts` and `plan.test.ts` build a      #
   * # `PlannedAsset` BY HAND — a required field breaks all of them at once to #
   * # say nothing. Absent is NO SIGNAL, never "bright": every plan frozen     #
   * # before today keeps parsing (`getJobPlan` uses `parse`, not              #
   * # `safeParse`, so a plan that stopped parsing would stop re-delivering),  #
   * # and T-7 falls back to the judge's number and prints that it did.        #
   * #                                                                        #
   * # NOT IN THE RENDER KEY. `computeRenderKey` projects an asset down to     #
   * # `{contentHash, type, vision.subjectAnchor, vision.shotScale}` because   #
   * # the key is about PIXELS. Measuring a picture changes none of its own.   #
   * ##########################################################################
   */
  ground: z
    .object({
      /** The 16:9 COVER CROP's mean grey, 0..1. The frame, not the file. */
      meanLuma: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
})

export type PlannedAsset = z.infer<typeof PlannedAssetSchema>

/**
 * Plan correction C1: the OUTGOING image is composited inside this segment for
 * `transitionIn.durationFrames`. Everything needed to reproduce its final frame
 * is copied here, so a segment still renders correctly in any order, on any
 * machine, with no reference to its neighbour's render.
 */
export const PrevAssetSchema = z.object({
  path: StorageKeySchema,
  contentHash: ContentHashSchema,
  /**
   * The crop branch the OUTGOING image was PRESENTED in, which is not always the
   * one this scene uses. Without it the renderer had nothing to branch on and drew
   * the outgoing layer as a flat full-bleed cover, so a portrait scan jumped off
   * its archive plate for the 8-16 frames of the dissolve and back onto it after —
   * a visible snap on every image-to-image transition in the video.
   */
  crop: CropSchema,
  /**
   * The pose the previous scene ACTUALLY ENDED ON — already reduced by
   * `maxTravelForCrop(crop.mode)` at plan time. The renderer holds these numbers
   * verbatim and must NOT reduce them again, or a plate-cropped predecessor gets
   * its move shrunk twice and the dissolve holds a frame the shot never reached.
   */
  endScale: z.number().min(MIN_SCALE).max(MAX_SCALE),
  endX: z.number().min(-1).max(1),
  endY: z.number().min(-1).max(1),
})

/**
 * How many CHARACTERS the headline block actually holds.
 *
 * Not a preference. It is two lines of Libre Franklin at the SMALLEST step the
 * renderer will set — `textCardTypeStep` in `apps/web/src/remotion/constants.ts`
 * derives 85 from the block width and the face's mean advance, and below that
 * step there is nothing left to shrink. So a phrase longer than this cannot be
 * made to fit by the renderer; it can only be shortened by the planner, and this
 * is where that contract is enforced.
 *
 * A 14-WORD CAP DOES NOT EXPRESS THIS. Fourteen words of "It dates to roughly
 * one hundred years before the common era began" is 90 characters, and fourteen
 * words was the only bound the card had — which is how a headline reached a real
 * frame at 0:20 cut mid-sentence at "It dates to roughly 100".
 */
export const TEXT_CARD_MAX_CHARS = 85

export const TextCardSchema = z.object({
  /**
   * The written headline, trimmed to a sentence or clause boundary by
   * `buildTextCard` in `apps/worker/src/stages/plan.ts`.
   *
   * EMPTY IS LEGAL AND MEANS "NO HEADLINE", which is why `.min(1)` is gone. When
   * a scene has no phrase worth setting, the card renders its rule and its
   * eyebrow and stops — a bare chapter marker reads as deliberate, and the
   * string this field used to be forced to carry instead was the literal word
   * "Untitled".
   */
  pullPhrase: z
    .string()
    .max(180)
    .refine(
      (s) => s.trim().split(/\s+/).filter((word) => word.length > 0).length <= 14,
      'pullPhrase must be 14 words or fewer',
    )
    .refine((s) => s.length <= TEXT_CARD_MAX_CHARS, 'pullPhrase must fit the block, see TEXT_CARD_MAX_CHARS'),
  /** A year, a place or organisation, or the section label. */
  eyebrow: z.string().max(80),
  /**
   * Scene-relative reveal schedule, one entry per rendered word.
   *
   * These are the SAME words as `pullPhrase` — the planner derives both from one
   * trimmed token list, so the two fields cannot disagree about what the card
   * says. Empty for the same reason `pullPhrase` may be empty.
   */
  words: z
    .array(
      z.object({
        text: z.string().min(1).max(64),
        startFrame: z.number().int().min(0),
      }),
    )
    .max(24),
  backgroundAssetPath: StorageKeySchema.nullable(),
})

export type TextCard = z.infer<typeof TextCardSchema>

export const GradeSchema = z.object({
  /** Enumerated, not free text: this value reaches a filter chain and a file lookup. */
  lut: z.enum(LUT_NAMES),
  vignette: z.number().min(0).max(1),
  grain: z.number().min(0).max(1),
  /** The shadow look, 0-1: a tight dark vignette, a dimmer and slightly muted picture. Absent = off. */
  shadow: z.number().min(0).max(1).optional(),
})

export type Grade = z.infer<typeof GradeSchema>

/**
 * THE PARTICLE PLATE THIS SHOT DRAWS FOR ITS WHOLE LENGTH, OR NULL.
 *
 * ##########################################################################
 * # A SECOND KIND OF CLIP, WITH A SECOND KIND OF SHAPE, AND IT IS NOT A     #
 * # TRANSITION. `TransitionSchema` IS THE WRONG HOME AND SO IS A ROW OF     #
 * # `OVERLAY_CLIPS`.                                                        #
 * #                                                                        #
 * # A transition is a thing that happens AT A JOIN: it carries a            #
 * # `durationFrames` measured from the cut and, for a burn, a `leadFrames`  #
 * # written onto the shot before. This is the opposite — it starts at this  #
 * # shot's own frame 0, runs to its last frame, belongs to no join, and     #
 * # nothing about it is written onto a neighbour. Expressing it as a        #
 * # `filmBurn` with a zero lead would make T-24 demand a paired lead-in and #
 * # make `overlayClipFrame` draw twelve seconds of plate over the incoming  #
 * # shot. See the box on `AmbienceClip` in `effects.ts`.                    #
 * ##########################################################################
 *
 * ##########################################################################
 * # WHY IT CARRIES ITS OWN `durationFrames` WHEN IT IS ALWAYS THE SHOT'S.   #
 * #                                                                        #
 * # So the plan gate has something to check. "The ambience runs past its    #
 * # own scene" is only a checkable sentence if the plan states a length     #
 * # rather than implying one, and a hand-edited plan is exactly where that  #
 * # goes wrong. The compositor reads THIS number, not `scene.durationFrames`#
 * # so the gate and the drawer are reading the same field.                  #
 * ##########################################################################
 *
 * `clip` is a PATTERN, not an enum of the table's ids, for the same reason
 * `TransitionSchema.clip` is one: the schema would otherwise import the table
 * and a removed row would make old plans unparseable. Whether the id is KNOWN
 * is T-25's question.
 */
export const SceneAmbienceSchema = z.object({
  /** Which row of `AMBIENCE_CLIPS` (`effects.ts`) this shot draws. */
  clip: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  /** Scene-relative: the plate occupies frames [0, durationFrames) of THIS segment. */
  durationFrames: z.number().int().min(1).max(5000),
  /**
   * HIS SECOND VARIANT, AS THE CORNER ALPHA OF A VIGNETTE. 0 IS HIS FIRST.
   *
   * ########################################################################
   * # THE CLIENT, 2026-09-15 17:54, VERBATIM, WITH A 6 SECOND CLIP:         #
   * #                                                                      #
   * #   "What kind of FX i'm hoping to add to some of the images            #
   * #    (ashes and ashes + shadow)"                                       #
   * #                                                                      #
   * # TWO VARIANTS, AND THIS FIELD IS WHICH ONE THIS SHOT IS:              #
   * #                                                                      #
   * #   0    "ashes"            the drifting specks alone                  #
   * #   >0   "ashes + shadow"   the same specks plus the vignette          #
   * #                                                                      #
   * # THE "SHADOW" IS A VIGNETTE, MEASURED OFF HIS OWN CLIP RATHER THAN     #
   * # GUESSED. Mean luma of his reference frame, tight corner boxes        #
   * # against a centre box of the same size: centre 80.1, top-left 30.9,   #
   * # top-right 38.7, bottom-left 28.2, bottom-right 66.4 — and the fourth #
   * # corner is a white jacket in the photograph itself. A radial band     #
   * # profile over the same frame drops monotonically from 0.74 of the     #
   * # plateau at r=0.65 to 0.39 at the corner. So it is a soft darkening   #
   * # toward the EDGES of the frame. It is not a shadow cast by the ashes  #
   * # and it is not a drop shadow on anything.                             #
   * ########################################################################
   *
   * ########################################################################
   * # ON THE AMBIENCE ROW, WHICH MAKES "SHADOW WITHOUT ASHES"              #
   * # UNREPRESENTABLE, AND THAT IS THE POINT RATHER THAN A SIDE EFFECT.    #
   * #                                                                      #
   * # Both of the names he gave start with "ashes". Neither is "shadow"    #
   * # alone, so the vignette never appears without the specks. Living here #
   * # rather than beside `grade.vignette` encodes that in the TYPE: there  #
   * # is no place to put a shadow on a shot that carries no plate. A       #
   * # boolean-plus-constant would have said the same thing in a comment.   #
   * #                                                                      #
   * # It is also why this is not a bigger `grade.vignette`. That field is  #
   * # the HOUSE look, unconditional on all 164 shots at 0.18, and raising  #
   * # it on ten of them would mean "this shot is graded differently",      #
   * # which is not what he asked for. This is an FX the plate brings with  #
   * # it, and it is drawn by the FX layer, not by `Grade`.                 #
   * ########################################################################
   *
   * ########################################################################
   * # A NUMBER RATHER THAN A BOOLEAN, AND IT BUYS A 1H50M RE-RENDER.       #
   * #                                                                      #
   * # The strength has to reach a pixel, so SOMETHING must carry it into   #
   * # the compositor. If it were a constant in the bundle — `constants.ts` #
   * # or a row of `effects.ts` — then nudging 0.25 to 0.28 after he        #
   * # watches the film would move `bundleHash`, which is in EVERY scene's  #
   * # render key, and re-render all 164 segments: about two hours on the   #
   * # box for a change that alters ten shots.                              #
   * #                                                                      #
   * # Carried in the PLAN instead, the number's home is                    #
   * # `AMBIENCE_DENSITY.shadowAlpha` in `effectDensity.ts`, which the      #
   * # compositor does not bundle. A tweak there re-plans, changes this     #
   * # field on the ten dusted shots, moves only those ten render keys, and #
   * # re-renders ten segments. That is the identical trade the burn's      #
   * # share taught this project the expensive way, and the box at the top  #
   * # of `effectDensity.ts` tells that story.                              #
   * #                                                                      #
   * # REQUIRED, unlike `ambience` itself. `ambience` is `.nullish()`       #
   * # because every delivered film predates it and `getJobPlan` uses       #
   * # `parse`. This sub-field has no such history: no frozen plan carries  #
   * # an ambience row at all, so there is nothing to stay compatible with. #
   * # Required means a plan STATES its variant instead of implying one,    #
   * # which is the same reason `durationFrames` above is stated — so T-25  #
   * # has something to check on a hand-edited plan.                        #
   * ########################################################################
   */
  shadow: z.number().min(0).max(1),
})

export type SceneAmbience = z.infer<typeof SceneAmbienceSchema>

export const PlannedSceneSchema = z.object({
  index: z.number().int().min(0).max(5000),
  /** ABSOLUTE timeline placement. Deliberately excluded from renderKey — see plan C4. */
  startFrame: z.number().int().min(0),
  durationFrames: z.number().int().min(1),
  sceneType: SceneTypeSchema,
  /** Nothing reads it in V1. One field now, one avoided migration in V2. */
  locked: z.boolean(),
  version: z.number().int().min(1),
  asset: PlannedAssetSchema.nullable(),
  crop: CropSchema,
  motion: MotionSchema,
  transitionIn: TransitionSchema,
  /**
   * THE TRANSITION THAT STARTS ON THIS SCENE'S OWN LAST FRAMES.
   *
   * ##########################################################################
   * # ONLY THE FILM BURN USES IT, AND ONLY BECAUSE SAKU'S EFFECT BEGINS      #
   * # BEFORE THE SPLICE.                                                     #
   * #                                                                        #
   * # His component is three phases: `INTRO_FRAMES` 24 holding the OUTGOING  #
   * # shot under a full `grayscale(1) contrast(1.08) brightness(0.96)`,      #
   * # `BASE_TRANSITION_FRAMES` 24 of burn, then `OUTRO_FRAMES` 42 in which   #
   * # the destination lands. Only the middle third belongs to the incoming   #
   * # segment, so `transitionIn` alone can never carry the first.            #
   * #                                                                        #
   * # WHY IT IS NOT SIMPLY A LONGER `transitionIn`. Those 24 frames are      #
   * # screen time, and they have to come from one side or the other. Saku    #
   * # spends the OUTGOING shot's, which is the honest reading — the picture  #
   * # being left is still on screen, just draining of colour. Charging them  #
   * # to the incoming scene instead would show the previous photograph for   #
   * # the first quarter of every burn-in shot, and at the five-second pacing #
   * # rule the median shot is only 90 frames long.                           #
   * #                                                                        #
   * # OPTIONAL, DEFAULTING TO NULL, and that is not politeness. `jobs.plan`  #
   * # holds the frozen plan of every film ever delivered here and they are   #
   * # the only record of what each one drew; a required field would make     #
   * # every one of them fail to parse. See the round-trip test.              #
   * #                                                                        #
   * # HASHED INTO THE RENDER KEY, because it changes this segment's own      #
   * # pixels. Trap 2 — a field that reaches a frame and is not hashed means  #
   * # a re-plan cache-hits and re-delivers the old film looking fixed.       #
   * ##########################################################################
   */
  transitionOut: TransitionSchema.nullable().default(null),
  prevAsset: PrevAssetSchema.nullable(),
  /** Scene-relative. Empty when sceneType === 'titleCard' — text cards suppress captions. */
  captions: z.array(CaptionPhraseSchema).max(64),
  textCard: TextCardSchema.nullable(),
  /**
   * The short line set ON TOP of this scene's picture. Non-null on roughly 8-12
   * scenes of an 8m46s film and null on every other one.
   *
   * ##########################################################################
   * # IT IS NO LONGER MUTUALLY EXCLUSIVE WITH `textCard`, AND THE CHANGE IS   #
   * # DELIBERATE. THIS DOCBLOCK USED TO SAY "BY CONSTRUCTION".                #
   * #                                                                        #
   * # That was true while `textCard` meant "this frame is a full-screen card". #
   * # It has not meant that since 2026-08-16: a scene with no photograph of    #
   * # its own now HOLDS the previous one, and the card is only the carrier for #
   * # the inherited picture's path (`textCard.backgroundAssetPath`, read by    #
   * # `render.ts` and drawn by `Scene.tsx` as an ordinary `CroppedImage`).     #
   * # There is a photograph on that frame, so there is something for a mark to #
   * # sit on, and the client asked for one at 0:35 — which is exactly such a   #
   * # scene.                                                                  #
   * #                                                                        #
   * # WHAT IS STILL EXCLUSIVE, and it is the half that was always the real     #
   * # rule: a card with NO background inherits nothing, really does draw       #
   * # full-screen type, and may never also carry a mark. Two blocks of type on #
   * # one frame is the defect; a card is not.                                  #
   * #                                                                        #
   * # AND ONLY A DATE MAY SIT ON AN INHERITED PICTURE. `plan.ts` refuses any   #
   * # other `kind` there, because a place or a person set over a photograph    #
   * # that belongs to the scene BEFORE is a caption for the wrong image.       #
   * ##########################################################################
   *
   * IT IS IN THE RENDER KEY (`renderKey.ts`). It has to be: adding overlays to a
   * re-planned job whose segments are already on disk would otherwise cache-hit
   * every one of them and re-deliver the identical video, which is
   * indistinguishable from the feature never having run.
   *
   * `.default(null)` for the same reason `generator` above carries one — a plan
   * frozen into `jobs.plan` before this field existed must still parse, or the
   * client's finished jobs stop re-delivering.
   */
  overlay: SceneOverlaySchema.nullable().default(null),
  /**
   * WHICH OF THE TWENTY-THREE DRAWABLE DEVICES THIS SCENE IS, or null for an ordinary
   * shot — which is what almost every scene carries.
   *
   * ##########################################################################
   * # BEFORE THIS FIELD, `packages/core` CONTAINED NO OCCURRENCE OF THE WORD  #
   * # "TEMPLATE" OR "DEVICE" AT ALL, and all sixteen animations and templates #
   * # were unreachable from a delivered film — the client's own nine included, #
   * # four of which he has seen and likes.                                    #
   * #                                                                        #
   * # It carries the device's IDENTITY and its COPY, never a picture path.    #
   * # The pictures come from `asset` and `companions` below, which is what    #
   * # keeps every drawn pixel inside the credits manifest.                    #
   * ##########################################################################
   *
   * IT IS IN THE RENDER KEY (`renderKey.ts`). It has to be, for the reason the
   * `overlay` docblock above gives at length: a device added to a re-planned job
   * whose segments are already on disk would otherwise cache-hit every one of
   * them and re-deliver the identical video, which is indistinguishable from the
   * feature never having run. That bug has landed three times on this project.
   *
   * `.default(null)` for the same reason `overlay` carries one.
   */
  device: SceneDeviceSchema.nullable().default(null),
  /**
   * THE PARTICLE PLATE OVER THIS WHOLE SHOT, or null for an ordinary one —
   * which is about 94 in every 100, by the client's own share.
   *
   * ##########################################################################
   * # IT IS IN THE RENDER KEY (`renderKey.ts`), AND THAT IS THE SINGLE MOST   #
   * # DANGEROUS LINE OF THIS FEATURE TO FORGET.                              #
   * #                                                                        #
   * # This bug class has landed on this project FOUR times — captions,        #
   * # overlays, devices, vision — and its signature never changes. A          #
   * # decision taken after the key is computed leaves every key identical,    #
   * # every segment cache-hits, the concat runs, the delivery succeeds, and   #
   * # the file handed over is the PREVIOUS cut with none of the new effect    #
   * # in it. Nothing goes red. The render exits 0. It looks exactly like a    #
   * # feature that shipped.                                                   #
   * #                                                                        #
   * # A plate is a full-frame image screened over the photograph on every     #
   * # frame of the shot, so it is pixels by any reading.                      #
   * ##########################################################################
   *
   * ##########################################################################
   * # `.nullish()`, NOT `.nullable().default(null)`, AND BOTH HALVES MATTER.  #
   * #                                                                        #
   * # NULLABLE so a plan can say "considered, and no". OPTIONAL so a plan     #
   * # frozen into `jobs.plan` before this field existed still PARSES —        #
   * # `getJobPlan` uses `parse`, not `safeParse`, and the client opens those  #
   * # pages — and, the half that is not politeness, so `canonicalise` SKIPS   #
   * # it on the ~94 scenes in 100 that carry none. Those scenes therefore     #
   * # keep the render key they would have had, and a later density tweak      #
   * # re-renders only the shots that gain or lose a plate rather than the     #
   * # whole film. `TransitionSchema.clip` is `.optional()` for that exact     #
   * # reason and says so.                                                     #
   * ##########################################################################
   */
  ambience: SceneAmbienceSchema.nullish(),
  /**
   * EXTRA PICTURES THIS SCENE MAY DRAW, beyond its own. Empty on almost every
   * scene.
   *
   * ##########################################################################
   * # THESE ARE THE SCENE'S OWN RUNNER-UP CANDIDATES, NOT A NEW SEARCH.       #
   * #                                                                        #
   * # Every scene already downloads several candidates, ranks them with       #
   * # vision, and keeps the losers — `asset_candidates` stores each with its  #
   * # rank and its judgement, and nothing deletes the files. So a four-picture #
   * # device costs no fetch, no model call and no licence risk: each          #
   * # companion is a full `PlannedAsset` carrying its own `license` and       #
   * # `attribution`, exactly as `asset` does.                                 #
   * ##########################################################################
   *
   * ##########################################################################
   * # THE ONE EXCEPTION, AND IT IS WHY THE BOUND IS FOUR RATHER THAN THREE.   #
   * #                                                                        #
   * # `gallery-strip` is `pictureSource: 'filmPreview'`. Saku 0.3: "Use 3-4   #
   * # still images from real content that appears LATER in the video." Its    #
   * # carrier beat may own no picture at all, and the picture it DOES own is  #
   * # the one picture the strip must not show, because a photograph on screen #
   * # right now previews nothing. So all four of its cards live here and      #
   * # `asset` contributes none of them.                                       #
   * #                                                                        #
   * # THREE WAS THEREFORE AN OFF-BY-ONE FOR THAT DEVICE, and a silent one:    #
   * # zod rejects the fourth with "Too big", at plan time, after an hour of   #
   * # sourcing has already been paid for.                                     #
   * #                                                                        #
   * # A FIFTH IS STILL DEAD WEIGHT IN EVERY RENDER KEY, so the bound stays.   #
   * ##########################################################################
   *
   * AND `buildCredits` READS THIS, which it did not until 2026-08-30. Three
   * devices draw four pictures each and only the scene's own was ever credited,
   * so twelve photographs were on screen in the delivered film with no line in
   * the manifest. See `drawnPictures` in `deliver.ts`.
   */
  companions: z.array(PlannedAssetSchema).max(4).default([]),
  grade: GradeSchema,
  renderKey: ContentHashSchema,
})

export type PlannedScene = z.infer<typeof PlannedSceneSchema>

/** A scene before `computeRenderKey` has been applied. */
export const PlannedSceneDraftSchema = PlannedSceneSchema.omit({ renderKey: true })
export type PlannedSceneDraft = z.infer<typeof PlannedSceneDraftSchema>

export const AudioPlanSchema = z.object({
  voiceoverPath: StorageKeySchema,
  musicPath: StorageKeySchema.nullable(),
  /**
   * Both of these are interpolated into an FFmpeg `sidechaincompress` filtergraph.
   * The bounds are the control that stops an out-of-range number from becoming a
   * broken (or hostile) filter string.
   */
  duckingThreshold: z.number().min(0).max(1),
  musicGainDb: z.number().min(-40).max(0),
})

export type AudioPlan = z.infer<typeof AudioPlanSchema>

/**
 * WHERE THE FILM STOPS OPENING AND STARTS EXPLAINING.
 *
 * ##########################################################################
 * # NOTHING IN THIS PIPELINE KNEW WHAT A HOOK WAS. A grep for hook,         #
 * # firstPassage or opening_orientation across core, worker and web         #
 * # returned React hooks and one unrelated comment.                         #
 * #                                                                        #
 * # THE CLIENT ASKED FOR IT IN THOSE WORDS on 2026-08-29: "you should tweak #
 * # it and tell the system to identify the hook", and relayed Saku's        #
 * # detection rules — "Hook: the opening section containing a question,     #
 * # mystery, surprising claim, promise, conflict, or preview. It ends when  #
 * # the video begins its normal explanation. First passage: the first       #
 * # complete narrative unit that establishes the subject, context, or first #
 * # argument. It is not merely the first sentence."                         #
 * #                                                                        #
 * # `carrierIndex` IS THE ANSWER THE REST OF THE PIPELINE USES, and it is a #
 * # SCENE INDEX rather than a time, because a device REPLACES a beat and    #
 * # cannot be inserted between two. Saku's own pseudocode calls             #
 * # `insertAfterNarrativePoint`; there is no counterpart here, because the  #
 * # scenes are a partition of the voiceover timeline with no free space.    #
 * #                                                                        #
 * # `confidence` EXISTS BECAUSE HE ASKED FOR IT: "If confidence is low,     #
 * # flag the placement for review." The plan gate reads it and reports      #
 * # rather than refusing.                                                   #
 * #                                                                        #
 * # FILM-LEVEL, SO IT IS NOT IN ANY RENDER KEY. `computeRenderKey` hashes   #
 * # per scene, and this changes no pixel of any scene by itself — what      #
 * # changes pixels is the DEVICE it causes to be placed, and that is        #
 * # already hashed. Folding this in would re-render every segment whenever  #
 * # the detector moved by one beat.                                        #
 * ##########################################################################
 */
export const OpeningBoundarySchema = z.object({
  /** Which rule found it. Saku's first branch, or his fallback. */
  kind: z.enum(['hook', 'first_passage']),
  /** The scene the opening gallery goes on. Never inserted between scenes. */
  carrierIndex: z.number().int().min(0),
  /** Where the opening section ends, for the report and for a human to check. */
  boundaryMs: z.number().int().min(0),
  /** 0..1. Below `OPENING_BOUNDARY_REVIEW_CONFIDENCE` the plan gate says so. */
  confidence: z.number().min(0).max(1),
  /** Which detector produced it, so a placement can be traced to a rule. */
  detector: z.string().max(80),
})

export type OpeningBoundary = z.infer<typeof OpeningBoundarySchema>

export const VideoPlanSchema = z.object({
  id: z.string().uuid(),
  fps: z.literal(FPS),
  dimensions: z.object({
    width: z.literal(FRAME_WIDTH),
    height: z.literal(FRAME_HEIGHT),
  }),
  audio: AudioPlanSchema,
  scenes: z.array(PlannedSceneSchema).min(1).max(5000),
  totalFrames: z.number().int().min(1),
  /**
   * Null when no legal carrier exists, which is Saku's "flag for review" path
   * rather than a guess. `.default(null)` so a plan frozen before this field
   * existed still parses and still re-delivers.
   */
  openingBoundary: OpeningBoundarySchema.nullable().default(null),
  contentHash: ContentHashSchema,
})

export type VideoPlan = z.infer<typeof VideoPlanSchema>

/* ------------------------------------------------------------------------- */
/* Stage 7 — delivery                                                          */
/* ------------------------------------------------------------------------- */

/**
 * ONE ROW OF THE DOCUMENT THAT SAYS WHERE EVERY FRAME CAME FROM.
 *
 * This ships with the film, so every field in it is a claim made to the client and
 * to whoever he shows the film to. A generated frame states so three ways, on
 * purpose and at no cost: `generator` names the model in a field a script can
 * read, `sourceUrl` is a `urn:vg:ai:` identity that cannot be mistaken for a
 * provenance link, and `license`/`attribution` say it in the English a person
 * reads. Any one of them alone could be missed by the reader who mattered.
 */
export const CreditsEntrySchema = z.object({
  sceneIndex: z.number().int().min(0),
  sourceUrl: AssetOriginSchema,
  license: z.string().max(200),
  attribution: z.string().max(500),
  /** Non-null exactly when no camera took this picture. See `PlannedAssetSchema.generator`. */
  generator: z.string().max(200).nullable().default(null),
})

export const CreditsManifestSchema = z.object({
  jobId: z.string().uuid(),
  generatedAt: z.string().max(40),
  entries: z.array(CreditsEntrySchema).max(5000),
})

export type CreditsManifest = z.infer<typeof CreditsManifestSchema>

/* ------------------------------------------------------------------------- */
/* Pipeline                                                                    */
/* ------------------------------------------------------------------------- */

export const PipelineStageSchema = z.enum(PIPELINE_STAGES)
export type PipelineStage = z.infer<typeof PipelineStageSchema>

/** The stage the worker checkpoints after finishing `stage`, or null when done. */
export function nextPipelineStage(stage: PipelineStage): PipelineStage | null {
  const at = PIPELINE_STAGES.indexOf(stage)
  const next = PIPELINE_STAGES[at + 1]
  return next ?? null
}
