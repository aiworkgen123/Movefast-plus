import { createHash } from 'node:crypto'
import type { PlannedScene, PlannedSceneDraft, VideoPlan } from './schemas.js'

/**
 * The segment cache key — plan correction C4.
 *
 * ############################################################################
 * # `startFrame` IS DELIBERATELY EXCLUDED FROM THIS HASH. DO NOT "FIX" IT.   #
 * #                                                                          #
 * # A render key answers one question: "would this segment render to the      #
 * # same pixels?" Where the segment sits on the timeline does not change its  #
 * # pixels — it changes the concat list, which is rebuilt for free.           #
 * #                                                                          #
 * # Include `startFrame` and nudging scene 3 by two frames invalidates all    #
 * # 147 segments after it, turning a 40-second re-render into a three-hour    #
 * # one. That is the entire reason the V2 editor is affordable.               #
 * #                                                                          #
 * # This holds only because every other frame number inside a PlannedScene is #
 * # SCENE-RELATIVE (captions, text-card words, transition duration). If you   #
 * # ever store absolute caption frames, this key becomes unsound and the      #
 * # cache will serve you the wrong video.                                     #
 * ############################################################################
 *
 * Also excluded, for the same reason: `index` (reordering scenes must not
 * re-render them), `locked` and `version` (bookkeeping, not pixels), and the
 * asset's `path` (the same bytes cached at a different key render identically —
 * that is what `contentHash` is for).
 */

/** Bump when the compositor's meaning of a plan changes, invalidating every segment. */
export const RENDER_KEY_VERSION = 1

type Hashable = PlannedScene | PlannedSceneDraft

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`renderKey: cannot hash a non-finite number (${String(value)})`)
  }
  // Float noise must not fork the cache: 1.1200000000000001 and 1.12 are one key.
  return Math.round(value * 1e6) / 1e6
}

function canonicalise(value: unknown): unknown {
  if (value === null) return null
  if (typeof value === 'number') return roundNumber(value)
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalise)

  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    const entry = source[key]
    if (entry === undefined) continue
    out[key] = canonicalise(entry)
  }
  return out
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value))
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Hash the scene-relative content of one segment.
 *
 * `bundleHash` identifies the Remotion bundle: a compositor change must
 * invalidate every segment, and nothing inside the plan can express that.
 */
export function computeRenderKey(scene: Hashable, bundleHash: string): string {
  if (typeof bundleHash !== 'string' || bundleHash.length === 0) {
    throw new Error('computeRenderKey: bundleHash is required')
  }

  const payload = {
    v: RENDER_KEY_VERSION,
    bundleHash,
    durationFrames: scene.durationFrames,
    sceneType: scene.sceneType,
    motion: scene.motion,
    crop: scene.crop,
    transitionIn: scene.transitionIn,
    /*
     * Draws on THIS scene's own last frames — Saku's burn desaturates the shot
     * being left for 24 frames before the splice — so it is this segment's
     * pixels and must move the key. Trap 2.
     */
    transitionOut: scene.transitionOut,
    // already scene-relative — see the block comment above
    captions: scene.captions,
    textCard: scene.textCard,
    /*
     * THE OVERLAY IS PIXELS, SO IT IS IN THE KEY.
     *
     * This project has been bitten by the caption version of this bug: a
     * decision taken after the key is computed leaves all 91 keys identical,
     * every segment cache-hits, and the delivered file is the previous cut. An
     * overlay is a block of 92px type composited over the photograph — if it is
     * not hashed, adding overlays to a job whose segments are already on disk
     * re-delivers the video without them and looks exactly like dead code.
     *
     * Adding the key also shifts EVERY scene's hash, including the ~90% that
     * carry `null`, because `canonicalJson` emits nulls. That is correct rather
     * than unfortunate: the compositor now draws a layer it did not draw before,
     * so no segment rendered by the old bundle is reusable. `bundleHash` above
     * would have forced the same invalidation on its own.
     */
    overlay: scene.overlay,
    /*
     * THE DEVICE IS THE WHOLE FRAME, SO IT IS IN THE KEY WITHOUT A PROJECTION.
     *
     * Every field on `SceneDevice` is copy or geometry that reaches a pixel —
     * there is no score, no reason string and no bookkeeping on it, deliberately,
     * because a metadata field here would throw the segment cache away on a
     * re-plan that draws exactly the same frame. So the whole object is hashed
     * and there is nothing to project away.
     *
     * This is the fourth landing of the same bug class the two notes below
     * describe. A device is a completely different composition — different
     * layout, different type, different grade — and adding one to a re-planned
     * job whose segments are on disk would cache-hit every one of them and
     * re-deliver the previous cut with a success line and exit 0.
     */
    device: scene.device,
    /*
     * THE AMBIENCE PLATE IS PIXELS ON EVERY FRAME OF THE SHOT, SO IT IS IN THE
     * KEY. THIS IS THE FIFTH LANDING OF THE SAME BUG CLASS.
     *
     * The three notes above this one — captions, overlay, device, vision — all
     * describe one failure with one signature: a decision taken after the key is
     * computed leaves all 164 keys identical, every segment cache-hits, concat
     * runs, delivery succeeds, and the file handed to the client is the previous
     * cut with none of the new effect in it. Nothing goes red and the render
     * exits 0.
     *
     * It is worse for this one than for the four before it, because the plate is
     * the FIRST effect on this film whose whole purpose is to be visible on
     * ordinary shots. A missing device is one shot; a missing plate is the
     * client's 6% and Saku's "something happening in each frame", and the
     * delivered file would be byte-identical to the one he has already
     * rejected.
     *
     * `.nullish()` on the schema means this reads `undefined` on the ~94 scenes
     * in 100 that carry none, and `canonicalise` SKIPS undefined — so those
     * scenes keep the key they would have had, and a later share tweak
     * re-renders only the shots that gain or lose a plate.
     */
    ambience: scene.ambience,
    /*
     * COMPANIONS ARE HASHED BY CONTENT, NOT BY PATH, exactly as `asset` is.
     *
     * The same bytes cached at a different storage key render identically, which
     * is what `contentHash` is for. What DOES change the frame is which picture
     * sits in which cell and in what order, so the array's ORDER is significant
     * and `canonicalJson` preserves it — arrays are mapped, not sorted.
     */
    companions: scene.companions.map((companion) => ({
      contentHash: companion.contentHash,
      type: companion.type,
    })),
    grade: scene.grade,
    /*
     * `vision` IS IN THE KEY FROM 2026-08-18, BECAUSE IT BECAME PIXELS.
     *
     * It used to be pure metadata — a score and a reason the ranker wrote, read
     * by `source` to choose this photograph and never looked at again. Two
     * fields on it are now read by the COMPOSITOR: `subjectAnchor` and
     * `shotScale` decide which corner a mark is placed in, and whether it takes
     * a corner at all. Same bytes on disk, different type on screen.
     *
     * The failure it prevents is narrow and entirely silent. A re-source that
     * returns the SAME image but a different vision judgement would leave
     * `contentHash` identical; `motion` and `crop` also read vision, so a
     * changed anchor usually moves them and invalidates the key by accident —
     * but `shotScale` alone can flip a mark from the corner to the bottom block
     * while leaving both untouched. Identical key, different frame, cached
     * segment served. That is the caption bug and the overlay bug for a third
     * time, and the note above this one says so.
     *
     * Only the two fields the compositor reads. The score and the prose reason
     * change with every re-rank and change no pixel, so hashing them would throw
     * the segment cache away on a re-source that draws exactly the same frame.
     */
    asset:
      scene.asset === null
        ? null
        : {
            contentHash: scene.asset.contentHash,
            type: scene.asset.type,
            vision:
              scene.asset.vision === null
                ? null
                : {
                    subjectAnchor: scene.asset.vision.subjectAnchor,
                    shotScale: scene.asset.vision.shotScale,
                  },
          },
    // geometry included as well as the hash: the same outgoing image blended from
    // a different end position produces different pixels. `crop` is geometry too
    // — it decides whether the outgoing layer is a full-bleed cover or a plate —
    // and omitting it would serve a segment cached with the old flat-cover
    // crossfade for a scene whose plan now asks for the plate. `path` still stays
    // out, for the reason in the block comment: same bytes, same pixels.
    prevAsset:
      scene.prevAsset === null
        ? null
        : {
            contentHash: scene.prevAsset.contentHash,
            crop: scene.prevAsset.crop,
            endScale: scene.prevAsset.endScale,
            endX: scene.prevAsset.endX,
            endY: scene.prevAsset.endY,
          },
  }

  return sha256(canonicalJson(payload))
}

/** Attach render keys to a batch of drafts. */
export function withRenderKeys(
  scenes: readonly PlannedSceneDraft[],
  bundleHash: string,
): PlannedScene[] {
  return scenes.map((scene) => ({ ...scene, renderKey: computeRenderKey(scene, bundleHash) }))
}

/**
 * The plan-level hash. Unlike a render key this DOES depend on placement and
 * ordering, because moving a scene changes the finished video even though it
 * changes no segment.
 */
export function computePlanContentHash(
  plan: Omit<VideoPlan, 'contentHash'> | VideoPlan,
): string {
  const payload = {
    v: RENDER_KEY_VERSION,
    fps: plan.fps,
    dimensions: plan.dimensions,
    audio: plan.audio,
    totalFrames: plan.totalFrames,
    scenes: plan.scenes.map((scene) => ({
      index: scene.index,
      startFrame: scene.startFrame,
      durationFrames: scene.durationFrames,
      renderKey: scene.renderKey,
    })),
  }
  return sha256(canonicalJson(payload))
}

/** Where a rendered segment lives. Content-addressed, so it is cheap to check. */
export function segmentStorageKey(renderKey: string): string {
  if (!/^[0-9a-f]{64}$/.test(renderKey)) {
    throw new Error(`segmentStorageKey: expected a sha-256 hex render key, got "${renderKey}"`)
  }
  return `segments/${renderKey}.mp4`
}
