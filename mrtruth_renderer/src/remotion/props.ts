import { z } from 'zod'
import { DEFAULT_GRADE, PlannedSceneSchema } from '@vg/core/schemas'
import type { PlannedScene } from '@vg/core/schemas'

/**
 * What the worker passes to a segment render.
 *
 * ####################################################################
 * # THE WORKER RESOLVES PATHS, NOT THE COMPOSITOR.                    #
 * # `PlannedScene.asset.path` and `prevAsset.path` are STORAGE KEYS.  #
 * # The compositor has no storage adapter and no filesystem, so the   #
 * # worker resolves each key to a URL Chrome can fetch and passes it  #
 * # here. That keeps every path decision on the server side of the    #
 * # boundary and makes the composition renderable in Remotion Studio  #
 * # against any URL at all.                                           #
 * ####################################################################
 *
 * The resolving end is `segmentInputProps` in `apps/worker/src/stages/render.ts`,
 * which builds this exact object for both `selectComposition` and `renderMedia`.
 * The three `*Src` fields are nullable and NOT optional on purpose: `Root.tsx`
 * parses `inputProps` with the schema below inside `calculateMetadata`, so a
 * caller that forgets one gets a ZodError before the first frame rather than a
 * black rectangle two hours later.
 */

/**
 * The two text-card treatments, and there are deliberately only two.
 *
 * The client's whole note was "text overlays, which is currently not what it is
 * supposed be", with no reference attached. That is not a question anyone can
 * answer by guessing harder, so it is converted into a two-way pick: `plate` is
 * the safe bet — a set block of type on a designed ground — and `spoken` keeps
 * the per-word reveal the first render had, so his answer also tells us whether
 * the reveal was the part he liked. Both take the same rule, eyebrow, gradient
 * and colour, so whichever he picks, everything except the headline is settled.
 */
export const OverlayVariantSchema = z.enum(['plate', 'spoken'])
export type OverlayVariant = z.infer<typeof OverlayVariantSchema>

/**
 * THE OTHER TWO-WAY PICK, AND IT IS A DIFFERENT DEVICE FROM THE ONE ABOVE.
 *
 * ####################################################################
 * # `OverlayVariant` NAMES THE TEXT CARD'S TREATMENT. THIS ONE NAMES  #
 * # THE TEXT OVERLAY'S. THEY ARE NOT THE SAME FEATURE.                #
 * #                                                                   #
 * # The card is the FALLBACK — full frame, defocused backdrop, and it #
 * # fires only when a scene has no picture. The overlay is the         #
 * # editorial device: a few words ON a photograph that stays on        #
 * # screen. `overlayVariant` was named before the second one existed   #
 * # and now reads as if it belonged to this; it does not, and renaming #
 * # it would touch the card path this build is not allowed to touch.   #
 * ####################################################################
 *
 * `rule` carries the 64x2px brass hairline the card draws, so the two devices
 * read as one family. `plain` is the line on its gradient and nothing else,
 * which is what most documentary channels actually cut. Nobody on this build can
 * watch the reference the client gave, so it is converted into a pick from two
 * stills rather than a guess — the same move the card's own variant makes.
 *
 * `rule` is the default because it is the conservative one: it is made of marks
 * already agreed and already on screen elsewhere in the film, so it cannot look
 * like a device from a different project.
 */
export const OverlayTreatmentSchema = z.enum(['rule', 'plain'])
export type OverlayTreatment = z.infer<typeof OverlayTreatmentSchema>

export const SegmentPropsSchema = z.object({
  scene: PlannedSceneSchema,
  /** Resolved from `scene.asset.path`. Null when the scene has no asset. */
  assetSrc: z.string().min(1).nullable(),
  /** Resolved from `scene.prevAsset.path` — the baked crossfade (plan C1). */
  prevAssetSrc: z.string().min(1).nullable(),
  /** Resolved from `scene.textCard.backgroundAssetPath`. */
  textCardBackgroundSrc: z.string().min(1).nullable(),
  /**
   * Resolved from `scene.companions`. Empty on almost every scene.
   *
   * ####################################################################
   * # THESE ARE A RESOLUTION OF PLAN STATE, NOT A PRESENTATION CHOICE, #
   * # SO THEY ARE NOT THE SAME KIND OF FIELD AS THE TWO VARIANTS BELOW #
   * # AND THEY ARE NOT THE HAZARD THAT BOX DESCRIBES.                   #
   * #                                                                   #
   * # `overlayVariant` and `overlayTreatment` pick a LOOK that the plan #
   * # does not record, which is why two renders of one plan can differ  #
   * # under one cache key. A companion src is the URL of a picture the  #
   * # PLAN already names in `scene.companions`, and that array IS       #
   * # hashed into the render key by content — so two renders of one     #
   * # plan resolve to the same pictures by construction.                #
   * ####################################################################
   */
  /*
   * FOUR, NOT THREE. Every other four-picture device is handed
   * `[src, ...companionSrcs]`, so three companions plus the scene's own asset
   * makes four. `gallery-strip` is `pictureSource: 'filmPreview'` and draws
   * NONE of its own scene, so all four of its cards arrive here. Left at three
   * the compositor boundary rejects the fourth after the render has begun.
   */
  companionSrcs: z.array(z.string().min(1)).max(4).default([]),
  /**
   * Which text-card treatment to draw. OPTIONAL, unlike the three fields above.
   *
   * It is optional precisely because it is NOT part of the contract those three
   * are. They are resolved per scene from the plan and a missing one is a caller
   * bug; this is a presentation choice with a house default, and every existing
   * caller — `segmentInputProps` in `apps/worker/src/stages/render.ts` — is
   * correct without it.
   *
   * ####################################################################
   * # IT IS NOT IN THE RENDER KEY, AND IT MUST NOT REACH A FULL RENDER  #
   * # UNTIL IT IS.                                                      #
   * #                                                                   #
   * # `computeRenderKey` hashes the PLAN (renderKey.ts:78-99), and this #
   * # lives in the input props instead — so two renders of one plan     #
   * # under different variants produce different pixels under the SAME  #
   * # cache key. Rendering `spoken` after `plate` would serve 91 cached  #
   * # `plate` segments and look exactly like the switch did nothing.    #
   * #                                                                   #
   * # That is safe for what this is for — single stills, rendered to be #
   * # sent to the client — and it is why the chosen variant belongs in  #
   * # the PLAN before any full render uses it.                          #
   * ####################################################################
   */
  overlayVariant: OverlayVariantSchema.default('plate'),
  /**
   * Which text-OVERLAY treatment to draw. Optional and defaulted for exactly the
   * reasons the field above is, including the render-key caveat in that box:
   * this is not hashed either, so two renders of one plan under different
   * treatments collide in the segment cache. Stills only until it is in the plan.
   */
  overlayTreatment: OverlayTreatmentSchema.default('rule'),
})

export type SegmentProps = z.infer<typeof SegmentPropsSchema>

export const BumperPropsSchema = z.object({
  frames: z.number().int().min(1).max(300),
})

export type BumperProps = z.infer<typeof BumperPropsSchema>

/**
 * Studio default. A text card, because it exercises the font, the eyebrow, the
 * reveal and the grade without needing an image on disk.
 */
const DEFAULT_SCENE: PlannedScene = {
  index: 0,
  startFrame: 0,
  durationFrames: 90,
  sceneType: 'titleCard',
  locked: false,
  version: 1,
  asset: null,
  crop: { mode: 'fill', anchor: { x: 0.5, y: 0.5 } },
  motion: {
    type: 'kenBurns',
    fromScale: 1,
    toScale: 1.08,
    fromX: -0.2,
    toX: 0,
    fromY: 0,
    toY: 0,
    easing: 'linearOut',
  },
  transitionIn: { type: 'cut', durationFrames: 0 },
  transitionOut: null,
  prevAsset: null,
  captions: [],
  textCard: {
    pullPhrase: 'The archive remembers what the record forgot',
    eyebrow: '1974',
    words: [
      { text: 'The', startFrame: 0 },
      { text: 'archive', startFrame: 4 },
      { text: 'remembers', startFrame: 9 },
      { text: 'what', startFrame: 15 },
      { text: 'the', startFrame: 19 },
      { text: 'record', startFrame: 23 },
      { text: 'forgot', startFrame: 29 },
    ],
    backgroundAssetPath: null,
  },
  /**
   * NULL, and it has to be on this fixture in particular: this scene shows a
   * TEXT CARD, and a card and an overlay may never appear on the same frame.
   * Studio's default scene is the one place someone would reach for a hand-built
   * PlannedScene, so it must model the invariant rather than contradict it.
   */
  overlay: null,
  device: null,
  companions: [],
  grade: { ...DEFAULT_GRADE },
  renderKey: '0'.repeat(64),
}

export const DEFAULT_SEGMENT_PROPS: SegmentProps = {
  scene: DEFAULT_SCENE,
  assetSrc: null,
  prevAssetSrc: null,
  textCardBackgroundSrc: null,
  companionSrcs: [],
  overlayVariant: 'plate',
  overlayTreatment: 'rule',
}
