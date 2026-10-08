import { deterministicUnit } from './frames.js'
import type { AssetVision, CropMode, EasingName, Motion, ShotScale } from './schemas.js'

/**
 * Ken Burns derivation.
 *
 * ############################################################################
 * # LATERAL TRAVEL IS BOUGHT WITH SCALE. THAT ONE FACT GOVERNS EVERY NUMBER   #
 * # BELOW.                                                                    #
 * #                                                                           #
 * # Pan slack at scale s is `(s - 1) * 1920 / 2`, so at 1.10 the whole         #
 * # lateral range of the frame is 96px and at 1.20 it is 192px. There is no    #
 * # pan without upscale. The resolution ceiling is therefore not a side        #
 * # constraint on the motion budget — it IS the motion budget.                 #
 * ############################################################################
 *
 * THE MOVE SET IS THREE MOVES, AND IT REPLACED A SET THAT MEASURED AS A
 * SLIDESHOW. Measured off the delivered plan for job 8b6edd72 (78 image-carrying
 * scenes), the old derivation moved the median shot 18.9 px/sec — about 1% of
 * frame width per second — with the slowest quartile at 5 to 7 px/sec, which is
 * below the threshold at which a drift reads as movement at all.
 *
 * Two arithmetic reasons, not timidity:
 *
 * 1. THE PAN CANCELLED ITSELF. A push ran `fromScale` 1.0 with `fromX` -0.5 and
 *    `toX` 0. At t=0 the scale is exactly 1.0, so the slack is ZERO and -0.5 x 0
 *    is 0px; at t=1 the slack is largest but `toX` is 0, so 0px again. Net pan
 *    displacement was 0.0px on every push in the film — 39 of 78 scenes. The
 *    12px the audit attributed to pan was a 6px out-and-back bulge.
 * 2. THE ZOOM WAS ALL THAT WAS LEFT, and a slow zoom is the most slideshow-like
 *    move there is. A zoom's mean optical flow is only ~43% of its edge-path
 *    figure because the CENTRE of a zooming frame is stationary; a pan's is 94%,
 *    because a pan moves every pixel by the same amount. A lateral move is
 *    therefore ~2.2x more visible per unit of upscale spent than a zoom.
 *
 * So the budget is spent on SLACK rather than on travel. Every move now starts
 * at or above 1.06, which is what makes the pan expressible at all, and the
 * tracking move holds a constant 1.18-1.20 and spends the whole shot sliding.
 * Measured on the 5.7s median shot: PUSH 29.2/23.3/17.7 px/sec by shot scale,
 * PULL 37.1/30.0/22.9, TRACK 54.6.
 *
 * THOSE ZOOM FIGURES WERE HIGHER UNTIL 2026-08-18 AND THE DROP WAS BOUGHT ON
 * PURPOSE. `PUSH_PULL_PAN_X` went 0.70 -> 0.40 because the client watched v8 and
 * asked for less sideways drift, and a zoom's px/sec is zoom travel PLUS lateral
 * arc, so cutting the lateral half necessarily cuts the total. Simulated over
 * the 87 scenes of the frozen PLAN-v7-2026-08-16: film median 38.3 -> 35.1
 * px/sec, p25 30.0 -> 26.9, shots under 20 px/sec 10 -> 13 — against the OLD
 * derivation's film median of 18.9 with a 5-to-7 px/sec slowest quartile, which
 * is the comparison that matters. What actually halved is the part he named:
 * across the 43 full-bleed zooms in that plan the lateral path per shot falls
 * 80.3px -> 42.1px, a median 16.6 -> 9.4 px/sec of sideways flow. No zoom lost
 * any scale travel, and the TRACK — the move that is meant to read as lateral —
 * is untouched at 54.6.
 */

/**
 * The floor every zoom move starts or ends at.
 *
 * NOT 1.0, and that is the whole fix for the cancelling pan above. At 1.0 the
 * slack is zero, so whatever the pan asks for is multiplied by nothing. 1.06
 * costs 1.083x of upscale on the median 1880px asset, which is essentially free,
 * and buys 57.6px of slack for the pan to be expressed in on the opening frame.
 */
export const MOVE_FLOOR_SCALE = 1.06

/**
 * Peak scale by shot scale. A wide shot can take more push than a closeup.
 *
 * SET BY THE RESOLUTION CORPUS, NOT BY TASTE. Measured over all 1024 assets in
 * the database: min width 740, p10 987, MEDIAN 1880, p90 1920 — 84% are under
 * 1920px and every one is under 2400px, so the corpus is roughly frame-sized. A
 * landscape asset covering the frame at scale s is drawn `1920 * s` wide, so the
 * median asset at 1.20 is upscaled 1920 x 1.20 / 1880 = 1.2255x. The stated
 * softening threshold is ~1.25, so 1.20 leaves 2.0% of headroom; 1.25 peak would
 * put the median at 1.2766x, over the line. 1.20 is the largest round number
 * that keeps the median inside budget.
 *
 * THE p10 TAIL DOES NOT SET THE BUDGET. A 987px asset is already 1.945x upscaled
 * at scale 1.0, which is 56% past the threshold before any motion is applied.
 * Budgeting for it would cost the other 90% of the film all of its movement and
 * buy nothing perceptible on the tail.
 */
export const MOVE_PEAK_SCALE: Record<ShotScale, number> = {
  wide: 1.2,
  medium: 1.17,
  closeup: 1.14,
}

/**
 * The hard resolution ceiling, enforced in `assertMotionSafe`.
 *
 * SEPARATE FROM `MAX_SCALE` (schemas.ts) ON PURPOSE. That one is 1.6 and is a
 * sanity rail — three times looser than this design, so it enforces nothing. The
 * real budget is decided in this file, so it is asserted in this file.
 */
export const MOVE_PEAK_CEILING = 1.2

/** A track holds a near-constant scale; the 0.02 of drift is what stops it reading as a slid still. */
export const TRACK_FROM_SCALE = 1.18
export const TRACK_TO_SCALE = 1.2

/**
 * Half the track's pan, in units of slack, so the full path is twice this.
 *
 * At 1.18-1.20 the slack runs 172.8 -> 192px, so +/-0.80 is a 291.8px path and
 * 51.2 px/sec of pure lateral flow on a 5.7s shot. Rate is distance over time,
 * so a long shot needs a longer path to hit the same rate: at 8s and above the
 * pan opens to +/-0.92.
 */
export const TRACK_PAN_HALF = 0.8
export const TRACK_PAN_HALF_LONG = 0.92
/** 240 frames = 8s at 30fps. Below this a 0.80 half-pan already clears the target rate. */
export const TRACK_LONG_FRAMES = 240

/**
 * A track stops this far short of the slack, and it costs NOTHING to do so.
 *
 * Without it, `cx` is clamped to exactly `1 - half`, so any subject more than
 * 11.1% off centre drives `|toX|` to precisely 1.0 — the track ends with the
 * photograph's outermost pixel column against the frame edge. Measured on a
 * simulated film that was 8 of 29 tracks, and on shots of 8s or more the safe
 * anchor band narrows to [0.456, 0.544], so nearly every long track lands there.
 *
 * No black is exposed by that; a cover fit is flush on its tight axis and a
 * 5.4M-frame walk found the worst |translate| minus slack to be exactly 0.0. The
 * problem is what the outermost column CONTAINS. This corpus is scanned archive
 * material, where the extreme edge is where paper margins, mount board and
 * scanner borders live — none of which the vision ranker scores, because it
 * scores the picture.
 *
 * FREE BECAUSE IT MOVES THE CENTRE, NOT THE LENGTH. The pan still travels
 * `2 * half`; only its midpoint is pulled in. Rate is distance over time and the
 * distance is untouched, so every px/sec figure in this file stands.
 */
const TRACK_EDGE_MARGIN = 0.04

/** How far the end position is pushed toward centring the subject, as a fraction of the slack. */
const ANCHOR_PULL = 0.9
/**
 * Horizontal drift of a push or a pull, in units of pan slack.
 *
 * ############################################################################
 * # 0.40, DOWN FROM 0.70 ON 2026-08-18. THE OLD JUSTIFICATION IS REPLACED     #
 * # RATHER THAN SOFTENED, BECAUSE IT ARGUED FOR THE NUMBER THAT IS GONE.      #
 * #                                                                           #
 * # It said 0.70 beat the older 0.50 because a zoom only ever expresses PART  #
 * # of its pan — a PULL starts at maximum slack and draws all 134.4px of it,  #
 * # a PUSH starts at the 1.06 floor and the same 0.70 only draws 55.7px. That #
 * # arithmetic is still correct. What it missed is that this drift rides on   #
 * # EVERY push and EVERY pull — 43 of the delivered film's 87 scenes — and at #
 * # the durations those shots actually run it reads as a creep, not a move. A #
 * # centred wide PUSH opens at 1.06 where the slack is only 57.6px, so 0.70   #
 * # offsets the first frame by 40.3px and walks it back across the whole      #
 * # shot: on the film's 10.9s p90 scene that is 3.7 px/sec of net sideways    #
 * # displacement. The client watched v8 and wrote "avoid using the slow       #
 * # sideways motion alot, instead use zoom out zoom in etc." — this constant  #
 * # is the thing he was looking at.                                           #
 * #                                                                           #
 * # THE FIX IS NOT `MOVE_WEIGHTS`, WHICH IS THE OBVIOUS-LOOKING ONE.          #
 * # The dedicated TRACK is the FASTEST move in the set — 54.6 px/sec against  #
 * # PUSH 29.2-17.7 and PULL 37.1-22.9 — so it is not what a viewer is calling #
 * # slow. Reweighting was tried by editing and running the suite: eleven      #
 * # tests fail, because motion.test.ts pins the moves indices 0/1/2 roll and  #
 * # 38 call sites lean on that. And shifting weight onto `pull` would make    #
 * # `linearOut` — the one easing that closes at 0.00x of mean speed, a dead   #
 * # stop — the film's most common move, which is his "boring slideshow" note  #
 * # rebuilt out of easings.                                                   #
 * #                                                                           #
 * # WHAT IT COSTS, MEASURED, NOT PREDICTED. A centred wide PUSH's lateral     #
 * # path drops 55.7px -> 31.8px and a wide PULL's 134.4px -> 76.8px. Total    #
 * # rate on the 5.7s median shot falls PUSH 33.3/26.9/20.8 -> 29.2/23.3/17.7  #
 * # and PULL 47.2/38.6/30.0 -> 37.1/30.0/22.9, and the slowest full-bleed     #
 * # move in the system goes 19.21 -> 16.84 px/sec (a closeup PULL on a        #
 * # hard-left anchor). 16.84 is under the design's stated 20 px/sec floor,    #
 * # which was written when this constant was 0.70; it is still 2.4x to 3.4x   #
 * # the 5-to-7 px/sec quartile that caused the original slideshow complaint,  #
 * # and every pixel removed is lateral. motion.test.ts pins the NEW floor,    #
 * # deliberately, rather than the target the old pan happened to clear.       #
 * ############################################################################
 */
const PUSH_PULL_PAN_X = 0.4
/**
 * The same drift where the crop has a visible border.
 *
 * `REDUCED_TRAVEL` below caps SCALE travel only, so an unrestrained pan on a
 * plate or a pillarbox slides the picture against a stationary edge — the exact
 * tell that cap exists to prevent. 0.40 keeps the move motivated without it.
 *
 * EQUAL TO `PUSH_PULL_PAN_X` SINCE 2026-08-18, so the ternary in `buildZoom`
 * now picks the same number on both branches. Kept as two constants because
 * they are two independent arguments that happen to have converged — this one
 * is set by a stationary border, that one by how much lateral flow belongs on a
 * zoom at all — and collapsing them would let a future change to either one
 * silently move the other.
 */
const PUSH_PULL_PAN_X_EDGE = 0.4
/** Vertical drift. Deliberately smaller: vertical pans read as camera shake. */
const PUSH_PULL_PAN_Y = 0.22
/** A track passes the subject, so its vertical position is held near centre rather than honoured. */
const TRACK_ANCHOR_LIMIT_Y = 0.35

/** The three moves. A fourth (a vertical crane) was priced at 38 px/sec and rejected as the weakest. */
export type MoveKind = 'push' | 'pull' | 'track'

/**
 * How often each move is chosen, before bans.
 *
 * TRACK carries the design because it is the only move whose speed does not come
 * out of the zoom budget, so it gets the plurality. Weighted rather than
 * round-robin because the old `index % 2` alternation produced a 100% ABAB echo,
 * which the eye reads as a pattern within about four cuts.
 */
/**
 * ##########################################################################
 * # WHETHER ANY SHOT MAY MOVE SIDEWAYS. THE CLIENT BANNED IT OUTRIGHT ON   #
 * # 2026-09-12, AND HE ATTACHED A CLIP SO THERE IS NO AMBIGUITY ABOUT      #
 * # WHICH MOVE HE MEANT.                                                   #
 * #                                                                        #
 * #   "Eliminate only this type of sideways movement from everywhere       #
 * #    (keep all the other slow zooms etc.)"                               #
 * #                                                                        #
 * # HORIZONTAL ONLY. He wrote "sideways", the clip he sent is a horizontal #
 * # slide, and he has now said the same thing in the same word three       #
 * # times. `PUSH_PULL_PAN_Y` stays: measured at 3.1 px/sec median on V52,  #
 * # which is under a third of the slowest lateral creep and is not what he #
 * # is looking at.                                                         #
 * #                                                                        #
 * # THE TRAP, AND IT IS WHY THIS IS A FLAG RATHER THAN ONE DELETED LINE.   #
 * #                                                                        #
 * # On-screen sideways position is `unit * slack`, so TWO things slide a   #
 * # picture: the pan TRAVEL, and a fixed off-centre `ax` held while the    #
 * # slack changes under it. Remove only the travel and up to 121px of      #
 * # PURE ANCHOR DRIFT remains — measured at 67.7px on eight V52 scenes,    #
 * # which is worse than the push creep he is complaining about. The only   #
 * # setting with zero lateral movement is `fromX` and `toX` both exactly   #
 * # 0, which is what this flag produces.                                   #
 * #                                                                        #
 * # THE SECOND TRAP. A track cannot simply have its X stripped. What is    #
 * # left is 1.18 -> 1.20, which is 19.2px of edge travel, and 34 of V52's  #
 * # 53 tracks fall under 7 px/sec — the still-photograph band this whole   #
 * # file exists to avoid. So the track is REPLACED rather than stripped,   #
 * # by `buildDrift` below.                                                 #
 * ##########################################################################
 *
 * A FLAG RATHER THAN A DELETION, FOR THE SAME REASON THE SFX TABLE KEPT ITS
 * ROWS.
 *
 * `PUSH_PULL_PAN_X` has already been walked 0.70 -> 0.40 once at his request
 * and the box on it records him watching v8 and asking for less. A third
 * position on that same dial is a decision he may walk back, and every number
 * the pan arithmetic rests on — the px/sec spreads, the anchor inversion, the
 * long-shot pan opening — is measured work that would have to be re-measured
 * rather than re-read. Flip this to `true` to restore exactly what V52 shipped.
 *
 * COST WHEN IT CHANGES: every scene in the film re-keys, because `renderKey`
 * hashes `motion` whole. 128 of V52's 164 would change on screen; the other 36
 * are device scenes that re-render to identical pixels.
 */
export const SIDEWAYS_MOTION_ENABLED = false

const MOVE_WEIGHTS: Record<MoveKind, number> = { track: 0.4, push: 0.32, pull: 0.28 }
/** Fixed iteration order. The weighted roll walks this, so it is part of the determinism contract. */
const MOVE_ORDER: readonly MoveKind[] = ['track', 'push', 'pull']
/**
 * Seed for the move roll.
 *
 * INDEX ONLY, deliberately. Seeding off the asset would mean re-sourcing one
 * scene silently re-rolls its move and invalidates its render key; off the index
 * alone, a re-source is a cache hit.
 */
const MOVE_SEED = 1442695041

export type MotionInput = {
  index: number
  vision: AssetVision | null
  /**
   * THE SINGLE MOST VALUABLE INPUT, AND THE DERIVER NEVER HAD IT BEFORE.
   *
   * Rate is distance over time. The same wide PUSH runs at 63.4 px/sec on a 3s
   * shot, 33.3 on a 5.7s shot and 21.1 on a 9s shot, and the deriver had no way
   * to know which it was aiming at. It sets the track's pan length.
   */
  durationFrames: number
  /**
   * True when the crop renders inside a border — `REDUCED_TRAVEL_CROP_MODES`.
   *
   * Bans the track outright and halves the zoom moves' pan. Pass
   * `REDUCED_TRAVEL_CROP_MODES.includes(crop.mode)`, which means `chooseCrop`
   * has to run BEFORE this does.
   */
  hasVisibleEdge: boolean
  /**
   * The moves the previous two scenes ran, NEWEST FIRST.
   *
   * Feeds the no-three-in-a-row ban and the repeated-track direction flip. Two
   * entries is all that is read; a longer array is harmless.
   */
  recent: readonly MoveKind[]
  /** The previous scene's motion, or null for scene 0. Read only to oppose a repeated track. */
  previous: Motion | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function directionOf(from: number, to: number): number {
  if (to > from) return 1
  if (to < from) return -1
  return 0
}

/**
 * Which of the three moves scene `index` runs.
 *
 * SEPARATE FROM `deriveMotion` SO THE PLANNER CAN KEEP THE SEQUENCE. Both are
 * pure functions of the same input and `deriveMotion` calls this itself, so the
 * caller cannot hand the deriver a move it disagrees with — there is no way for
 * the recorded sequence and the rendered move to drift apart.
 *
 * TWO BANS, THEN A WEIGHTED ROLL RENORMALISED OVER WHAT SURVIVES.
 *
 * 1. NO MOVE RUNS THREE TIMES IN A ROW. A weighted roll left alone produces runs,
 *    and three identical moves in a row is the one pattern a viewer names.
 * 2. NO TRACK WHERE THE CROP HAS A VISIBLE EDGE. See `hasVisibleEdge`.
 *
 * Simulated over all 91 scene indices with the film's 13 edge-cropped scenes:
 * track 32, push 34, pull 25, longest run of any one move 2, ABAB echoes 26%,
 * which is chance for a weighted three-way. Under the old `index % 2` it was 100%.
 *
 * The two bans can remove at most two of the three moves, so the survivor list is
 * never empty.
 */
export function pickMove(input: Pick<MotionInput, 'index' | 'hasVisibleEdge' | 'recent'>): MoveKind {
  const banned = new Set<MoveKind>()
  const [last, before] = input.recent
  if (last !== undefined && last === before) banned.add(last)
  if (input.hasVisibleEdge) banned.add('track')

  const survivors = MOVE_ORDER.filter((move) => !banned.has(move))
  const total = survivors.reduce((sum, move) => sum + MOVE_WEIGHTS[move], 0)

  let cursor = deterministicUnit(input.index * MOVE_SEED) * total
  for (const move of survivors) {
    cursor -= MOVE_WEIGHTS[move]
    if (cursor < 0) return move
  }
  // Unreachable except by float dust at cursor === total; the last survivor is the answer there too.
  return survivors[survivors.length - 1] ?? 'push'
}

/**
 * Derive a Ken Burns move.
 *
 * Deterministic: the same index, vision, duration, crop class and recent-move
 * history always produce the same move. No `Math.random`, no clock.
 *
 * ############################################################################
 * # THE PAN BOUNDS ARE PROVED, NOT CLAMPED. NO CLAMP IN HERE EVER FIRES, AND  #
 * # THAT IS THE POINT — A CLAMP THAT FIRES IS A MOVE THAT SILENTLY SHRANK.    #
 * #                                                                           #
 * # Zoom moves: `dx` is `Math.sign(ax)`, so `|ax - dx * T| = ||ax| - T|`,     #
 * # which is at most `max(|ax|, T) <= 1` for any `T <= 1`. THE PROOF IS IN T, #
 * # so dropping T from 0.70 to 0.40 on 2026-08-18 cannot break it — and it    #
 * # tightens it. `ANCHOR_PULL` caps `|ax|` at 0.90, so the widest `fromX` a   #
 * # zoom can reach goes 0.70 -> 0.50, and the widest endpoint of either kind  #
 * # is still `|toX| = |ax| <= 0.90`. Swept over the whole anchor domain at    #
 * # both values and confirmed.                                                #
 * #                                                                           #
 * # Track: `cx` is clamped into `[-(1 - h), 1 - h]` first, so `|cx +/- h|`    #
 * # is at most 1 by construction and the full 2h of travel is ALWAYS          #
 * # available — the track never loses distance to a bound.                    #
 * ############################################################################
 */
/**
 * `sideways` IS A PARAMETER SO THE BANNED ARITHMETIC STAYS UNDER TEST.
 *
 * Every caller in the pipeline omits it and gets `SIDEWAYS_MOTION_ENABLED`,
 * which is the client's 2026-09-12 ruling. The tests pass `true` to go on
 * pinning the pan measurements — the px/sec spreads by shot scale, the anchor
 * inversion between push and pull, the long-shot pan opening, the
 * same-direction track ban — none of which were wrong, and all of which have to
 * be standing and correct on the day he asks for lateral movement back.
 *
 * A module constant read directly inside `buildZoom` would have made those
 * measurements unreachable, and an unreachable measurement is a deleted one.
 */
export function deriveMotion(input: MotionInput, sideways = SIDEWAYS_MOTION_ENABLED): Motion {
  const shotScale: ShotScale = input.vision?.shotScale ?? 'medium'
  const anchor = input.vision?.subjectAnchor ?? { x: 0.5, y: 0.5 }
  const move = pickMove(input)

  // Where the subject wants to sit, as a fraction of the slack.
  const ax = clamp((0.5 - anchor.x) * 2 * ANCHOR_PULL, -1, 1)
  const ay = clamp((0.5 - anchor.y) * 2 * ANCHOR_PULL, -1, 1)

  // Subject left of centre -> the image drifts left-to-right to centre it.
  // `Math.sign(ax)` is arithmetically the old `anchor.x < 0.5 ? 1 : -1` rule, so
  // the motivated-drift intent survives the rewrite; only a dead-centre anchor
  // falls through to the seed.
  let dx = ax !== 0 ? Math.sign(ax) : deterministicUnit(input.index * 7919) < 0.5 ? -1 : 1
  const dy = ay !== 0 ? Math.sign(ay) : deterministicUnit(input.index * 104729) < 0.5 ? -1 : 1

  // Two same-direction tracks across a cut read as one long pan chopped in half.
  if (
    move === 'track' &&
    input.recent[0] === 'track' &&
    input.previous !== null &&
    directionOf(input.previous.fromX, input.previous.toX) === dx
  ) {
    dx = -dx
  }

  /*
   * The track is the only move whose whole grammar was lateral, so when
   * sideways movement is banned it is replaced rather than adjusted. See the
   * boxes on `SIDEWAYS_MOTION_ENABLED` and `buildDrift`.
   */
  const motion =
    move === 'track'
      ? sideways
        ? buildTrack(input, ax, ay, dx)
        : buildDrift(ay, shotScale)
      : buildZoom(input, move, shotScale, ax, ay, dx, dy, sideways)

  assertMotionSafe(motion)
  return motion
}

/**
 * PUSH and PULL: the same pan on opposite zoom directions.
 *
 * ON A CENTRED SUBJECT THE PULL IS THE FASTER OF THE TWO, WHICH IS
 * COUNTER-INTUITIVE. Both travel the same 0.14 of scale, but a pull ends at the
 * anchor with the slack at its LARGEST at the start, so its pan is fully
 * expressed as 76.8px of path, while a push starts at the 1.06 floor and the
 * same 0.40 only draws 31.8px. Measured on a 5.7s shot: PULL 37.1/30.0/22.9
 * px/sec by shot scale against PUSH 29.2/23.3/17.7. (At the old 0.70 pan those
 * paths were 134.4px and 55.7px, for PULL 47.2/38.6/30.0 and PUSH
 * 33.3/26.9/20.8 — see `PUSH_PULL_PAN_X` for why they were cut.)
 *
 * ############################################################################
 * # AND IT INVERTS ON AN OFF-CENTRE SUBJECT. MEASURED, NOT PREDICTED.         #
 * #                                                                           #
 * # Pan is `unit * slack` and the two factors run in opposite directions       #
 * # across a zoom. A push ENDS at `ax` with the slack at maximum, so a large   #
 * # `|ax|` multiplies a big unit by a big slack and the pan grows. A pull ENDS #
 * # at `ax` with the slack at minimum, so the same anchor multiplies a big     #
 * # unit by a small slack and the pan partly cancels — the same failure, in    #
 * # miniature, that made the OLD push worth 0px of net displacement.           #
 * #                                                                           #
 * # Wide shot at 5.7s, anchor centred vs hard against the frame edge:          #
 * #   PUSH 29.2 -> 48.8 px/sec        PULL 37.1 -> 31.5 px/sec                 #
 * #                                                                           #
 * # The film's slowest full-bleed move is therefore a CLOSEUP PULL on an edge  #
 * # anchor at 16.84 px/sec, not the centred closeup push at 17.68.             #
 * # motion.test.ts pins both.                                                  #
 * #                                                                           #
 * # ALL FOUR FIGURES CAME DOWN WITH `PUSH_PULL_PAN_X` 0.70 -> 0.40, AND THE   #
 * # SPREAD IS WHAT SURVIVED RATHER THAN THE NUMBERS. At the old pan they were  #
 * # 33.3 -> 51.9 and 47.2 -> 32.0, with a swept floor of 19.21. A wide zoom    #
 * # still clears the design's 20 px/sec target at either anchor; a CLOSEUP no  #
 * # longer does, at 17.68 centred and 16.84 at the worst anchor. That target   #
 * # was set against a film whose median was 18.9, and what was taken out of    #
 * # these shots is exactly the lateral travel the client asked us to remove.   #
 * # If the pull ever reads slow, give it the larger pan — it is the move that  #
 * # spends its pan against a shrinking slack.                                  #
 * ############################################################################
 *
 * The easings differ for the same reason. `linearOut` closes at 0.00x of mean
 * speed — a dead stop — which is right for a pull settling onto a reveal and
 * wrong everywhere else, so a push takes `glide` and closes at 0.40x instead.
 */
function buildZoom(
  input: MotionInput,
  move: 'push' | 'pull',
  shotScale: ShotScale,
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  sideways: boolean,
): Motion {
  const peak = MOVE_PEAK_SCALE[shotScale]
  const panX = input.hasVisibleEdge ? PUSH_PULL_PAN_X_EDGE : PUSH_PULL_PAN_X

  return {
    type: 'kenBurns',
    fromScale: round4(move === 'push' ? MOVE_FLOOR_SCALE : peak),
    toScale: round4(move === 'push' ? peak : MOVE_FLOOR_SCALE),
    /*
     * BOTH ENDS, NOT JUST THE TRAVEL. See the box on `SIDEWAYS_MOTION_ENABLED`:
     * holding a non-zero `ax` across a changing slack is itself a slide, and on
     * a pull it is the larger half. Zeroing `fromX` alone would leave the
     * picture drifting to `ax` and read as the same defect, slower.
     */
    fromX: sideways ? round4(ax - dx * panX) : 0,
    toX: sideways ? round4(ax) : 0,
    fromY: round4(ay - dy * PUSH_PULL_PAN_Y),
    toY: round4(ay),
    easing: move === 'push' ? 'glide' : 'linearOut',
  }
}

/**
 * DRIFT: what the track becomes once sideways movement is banned.
 *
 * ##########################################################################
 * # THIS IS A REPLACEMENT, NOT A TRACK WITH ITS PAN SET TO ZERO, AND THE   #
 * # DIFFERENCE IS THE WHOLE POINT.                                         #
 * #                                                                        #
 * # A track is 1.18 -> 1.20. That 0.02 of scale exists so the shot is not  #
 * # "a picture sliding at a locked size"; it was never meant to carry the  #
 * # move on its own. Strip the pan and it is 19.2px of edge travel, and 34 #
 * # of V52's 53 tracks land under 7 px/sec, which is a still photograph.   #
 * # The move has to come from somewhere, so it comes from the zoom.        #
 * ##########################################################################
 *
 * WHY IT IS STILL A THIRD MOVE RATHER THAN A THIRD SHARE OF PUSH.
 *
 * `MOVE_WEIGHTS` and `MOVE_ORDER` are untouched, so the weighted roll, the
 * no-three-in-a-row ban and the determinism contract all survive with their
 * indices unshifted. And the film keeps three rhythms. A drift runs the SAME
 * span as a push, floor to peak, at a CONSTANT speed — `linear` rather than
 * `glide` — so it neither eases in nor stops dead. Against `pull`'s
 * `linearOut`, which closes at 0.00x of mean speed, the three now read as
 * accelerating in, holding, and settling.
 *
 * `ay` IS HELD AT BOTH ENDS, exactly as the track held `cy`. A move that
 * drifts vertically while it zooms reads as a handheld wobble, and that
 * judgement did not depend on the pan.
 */
function buildDrift(ay: number, shotScale: ShotScale): Motion {
  return {
    type: 'kenBurns',
    fromScale: MOVE_FLOOR_SCALE,
    toScale: round4(MOVE_PEAK_SCALE[shotScale]),
    fromX: 0,
    toX: 0,
    fromY: round4(clamp(ay, -TRACK_ANCHOR_LIMIT_Y, TRACK_ANCHOR_LIMIT_Y)),
    toY: round4(clamp(ay, -TRACK_ANCHOR_LIMIT_Y, TRACK_ANCHOR_LIMIT_Y)),
    easing: 'linear',
  }
}

/**
 * TRACK: a near-constant scale crossed laterally. The move that carries the design.
 *
 * A CONSTANT-SCALE PAN IS THE ONLY MOVE HERE THAT CANNOT CANCEL. At a fixed s
 * the slack is constant, so `translateX` is a straight linear ramp with no
 * bulge-and-return anywhere in it. 1.18 -> 1.20 rather than a flat 1.15 for two
 * reasons: the slack rises 172.8 -> 192px so the path is 291.8px rather than
 * 230.4px (51.2 vs 40.4 px/sec of pure lateral flow), and the 0.02 of drift
 * means no shot in the film is a picture sliding at a locked size. It stays
 * monotonic — `translateX` runs -138.2 -> +153.6 with zero reversals — and 0.02
 * is under `REDUCED_TRAVEL`, so `reduceMotion` returns a track by identity and
 * the frozen crossfade pose stays exact.
 *
 * `ax` IS RECENTRED RATHER THAN HONOURED, and that is the move's whole grammar.
 * A track PASSES the subject instead of settling on it, so the subject crosses
 * frame centre mid-shot, which is what a dolly does. `ay` is held near centre
 * because a track that also drifts vertically reads as a handheld wobble.
 */
function buildTrack(input: MotionInput, ax: number, ay: number, dx: number): Motion {
  const half = input.durationFrames >= TRACK_LONG_FRAMES ? TRACK_PAN_HALF_LONG : TRACK_PAN_HALF
  // `- TRACK_EDGE_MARGIN` keeps the sweep off the photograph's outermost column.
  // `Math.max(0, ...)` because a future `half` above `1 - margin` would otherwise
  // invert the clamp bounds and throw, rather than simply centring the sweep.
  const cxLimit = Math.max(0, 1 - half - TRACK_EDGE_MARGIN)
  const cx = clamp(ax, -cxLimit, cxLimit)
  const cy = clamp(ay, -TRACK_ANCHOR_LIMIT_Y, TRACK_ANCHOR_LIMIT_Y)

  return {
    type: 'kenBurns',
    fromScale: TRACK_FROM_SCALE,
    toScale: TRACK_TO_SCALE,
    fromX: round4(cx - dx * half),
    toX: round4(cx + dx * half),
    fromY: round4(cy),
    toY: round4(cy),
    easing: 'linear',
  }
}

/**
 * Ken Burns must never scale below 1.0 or the image edges show, and never above
 * `MOVE_PEAK_CEILING` or the picture softens.
 *
 * THE CEILING IS ASSERTED HERE RATHER THAN IN THE SCHEMA because this is the
 * file where the budget is decided. `MAX_SCALE` in schemas.ts is 1.6 and is a
 * sanity rail; at three times looser than the design it would not catch a move
 * that quietly went past the softening threshold on the client's 1880px median
 * asset.
 */
export function assertMotionSafe(motion: Motion): void {
  if (motion.fromScale < 1 || motion.toScale < 1) {
    throw new Error(
      `motion: scale below 1.0 (${motion.fromScale} -> ${motion.toScale}); the image edges would be exposed`,
    )
  }
  if (motion.fromScale > MOVE_PEAK_CEILING || motion.toScale > MOVE_PEAK_CEILING) {
    throw new Error(
      `motion: scale above the ${MOVE_PEAK_CEILING} resolution ceiling (${motion.fromScale} -> ${motion.toScale}); the median 1880px asset would soften`,
    )
  }
  for (const [name, value] of [
    ['fromX', motion.fromX],
    ['toX', motion.toX],
    ['fromY', motion.fromY],
    ['toY', motion.toY],
  ] as const) {
    if (!Number.isFinite(value) || value < -1 || value > 1) {
      throw new Error(`motion: ${name} is ${String(value)}; normalised pan positions must be within [-1, 1]`)
    }
  }
  if (EASING_BEZIER[motion.easing] === undefined) {
    throw new Error(`motion: unknown easing "${motion.easing}"`)
  }
}

/** Easing.bezier(0, 0, 0.58, 1). Still exported: constants.ts and the suite pin it by name. */
export const LINEAR_OUT_BEZIER = [0, 0, 0.58, 1] as const

/**
 * The control points the renderer feeds `Easing.bezier`.
 *
 * ############################################################################
 * # EVERY ENTRY HAS x1 = y1 = 0. THAT IS NOT A COINCIDENCE, IT IS THE BAN.     #
 * #                                                                           #
 * # An easing with a non-zero ease-in leaves the shot nearly stationary for    #
 * # the first ~0.4s after every cut, which over 91 scenes is the single most   #
 * # recognisable PowerPoint tell there is. With x1 = y1 = 0 the opening slope  #
 * # is `y2 / x2`, which is at or above 1.00x of mean speed for all three, so   #
 * # the image is ALWAYS already moving on the frame the cut lands on. A test   #
 * # pins this over the whole enum; do not add a fourth easing without it.      #
 * ############################################################################
 *
 * Measured opening and closing slopes as multiples of mean speed:
 *   linearOut  opens 1.72x  closes 0.00x   a dead stop, so it is PULL only
 *   linear     opens 1.00x  closes 1.00x   TRACK: never accelerates, never settles
 *   glide      opens 1.20x  closes 0.40x   PUSH: still moving when the next cut lands
 *
 * Today 100% of shots come to a dead stop before their cut. After this, 25% do —
 * and only the ones where settling onto a reveal is the point.
 */
export const EASING_BEZIER: Record<EasingName, readonly [number, number, number, number]> = {
  linearOut: LINEAR_OUT_BEZIER,
  linear: [0, 0, 1, 1],
  glide: [0, 0, 0.75, 0.9],
}

export type KenBurnsFrameValues = {
  scale: number
  translateXPx: number
  translateYPx: number
}

/**
 * Convert a Motion to concrete values for one frame.
 *
 * The renderer MUST use this rather than interpolating `fromX`/`toX` itself:
 * those are normalised pan positions, not pixels. Pan slack at scale s is
 * `(s - 1) * size / 2` per axis, so expressing pan as a fraction of it makes
 * edge exposure impossible at every frame — including the first frame of a push
 * that starts at exactly 1.0, where the slack is zero.
 *
 * Apply as: `transform: translate(${translateXPx}px, ${translateYPx}px) scale(${scale})`
 * on an element already covering the frame (object-fit: cover). Transform
 * functions apply right to left, so the translation stays in unscaled pixels.
 *
 * THAT CONTRACT IS THE TRAP. `dimensions` must be the transformed element's own
 * box, not the frame — pass the frame for an element that is narrower than it and
 * the pan overshoots the real slack and exposes an edge. Use
 * `kenBurnsFramePercent` below unless you have measured the element itself.
 *
 * `easedProgress` is the already-eased 0..1 progress, i.e. the output of
 * Remotion's `Easing.bezier(...LINEAR_OUT_BEZIER)`.
 */
export function kenBurnsFrameValues(
  motion: Motion,
  easedProgress: number,
  dimensions: { width: number; height: number },
): KenBurnsFrameValues {
  const t = clamp(easedProgress, 0, 1)
  const scale = motion.fromScale + (motion.toScale - motion.fromScale) * t
  const unitX = motion.fromX + (motion.toX - motion.fromX) * t
  const unitY = motion.fromY + (motion.toY - motion.fromY) * t

  const slackX = ((scale - 1) * dimensions.width) / 2
  const slackY = ((scale - 1) * dimensions.height) / 2

  return {
    scale,
    translateXPx: unitX * slackX,
    translateYPx: unitY * slackY,
  }
}

export type KenBurnsFramePercent = {
  scale: number
  translateXPct: number
  translateYPct: number
}

/**
 * The same move, expressed as PERCENTAGES of the transformed element's own box.
 *
 * `kenBurnsFrameValues` returns pixels against a size you pass in, and every
 * caller that is not full-frame gets that size wrong — the archive plate and the
 * blur pillarbox both transform an element far narrower than 1920, so a wide
 * shot's 115px of frame slack is spent on a picture that only has 34px of its
 * own. The remainder slides the photograph off its own plate on the frame the
 * shot opens on, and the plate's `overflow: hidden` shows bare ground through
 * the hairline rule.
 *
 * A CSS percent translate resolves against the element's own untransformed
 * border box, so this is correct for every crop branch without the renderer
 * having to measure anything. Full-frame callers are unaffected: at 1920 wide,
 * `unitX * (scale - 1) / 2 * 100` percent IS `unitX * (scale - 1) * 1920 / 2`
 * pixels, which motion.test.ts pins.
 *
 * Apply as: `transform: translate(${translateXPct}%, ${translateYPct}%) scale(${scale})`
 */
export function kenBurnsFramePercent(
  motion: Motion,
  easedProgress: number,
): KenBurnsFramePercent {
  const t = clamp(easedProgress, 0, 1)
  const scale = motion.fromScale + (motion.toScale - motion.fromScale) * t
  const unitX = motion.fromX + (motion.toX - motion.fromX) * t
  const unitY = motion.fromY + (motion.toY - motion.fromY) * t

  // Same slack rule as above, just left as a fraction of the box instead of
  // resolved against one: half the scale overshoot is available on each side.
  const slackPct = ((scale - 1) / 2) * 100

  return {
    scale,
    translateXPct: unitX * slackPct,
    translateYPct: unitY * slackPct,
  }
}

/* ------------------------------------------------------- travel capping --- */

/**
 * The cap a crop with a VISIBLE EDGE puts on total scale travel.
 *
 * 6% is a compositional number, not a preference. An archive plate is a card
 * with a rule around it and the blur pillarbox is a fixed gutter, so in both the
 * picture moves against a stationary border. Past ~6% the eye stops reading a
 * camera move and starts reading a photograph sliding around inside a frame,
 * which is the slideshow tell the whole Ken Burns derivation exists to avoid.
 *
 * ############################################################################
 * # `ARCHIVE_PLATE.maxTravel` IN THE COMPOSITOR'S CONSTANTS MUST NOT DIVERGE  #
 * # FROM THIS NUMBER.                                                         #
 * #                                                                           #
 * # It is stated twice because the worker cannot import the compositor's       #
 * # constants — they are in the Next app and drag React in with them. The two  #
 * # being EQUAL is the entire reason the end pose the plan persists for a      #
 * # crossfade is the pose the renderer actually holds. Let them drift and the  #
 * # frozen outgoing frame lands somewhere the shot never reached, which reads  #
 * # as a jump on the first frame of every dissolve out of a plate.             #
 * ############################################################################
 */
export const REDUCED_TRAVEL = 0.06

/** The crop modes that render inside a visible border, and so take the cap. */
export const REDUCED_TRAVEL_CROP_MODES: readonly CropMode[] = ['archivePlate', 'blurPillarbox']

/**
 * How much scale travel this crop mode allows.
 *
 * `fill` and `letterbox` are full-bleed — there is no border for the image to
 * slide against — so they are uncapped, and "uncapped" is spelled
 * `POSITIVE_INFINITY` rather than "skip the call". `reduceMotion` short-circuits
 * on `Math.abs(travel) <= maxTravel`, and every real travel is finite, so
 * Infinity makes it return the motion by identity. That lets both callers apply
 * the cap unconditionally instead of branching on the mode themselves, which is
 * how the plan and the renderer stay in agreement.
 */
export function maxTravelForCrop(mode: CropMode): number {
  return REDUCED_TRAVEL_CROP_MODES.includes(mode) ? REDUCED_TRAVEL : Number.POSITIVE_INFINITY
}

/**
 * Shrink a move toward its START so total scale travel never exceeds `maxTravel`.
 *
 * Lives here rather than in the compositor because the WORKER needs the same
 * answer: the plan records where the outgoing image finished, and that number is
 * only right if it is the reduced pose the renderer will hold. Two
 * implementations of this arithmetic would be two poses.
 *
 * The pan is scaled by the same factor as the scale, so the move keeps its
 * direction and its shape and only loses distance. Cutting the scale alone would
 * leave a pan that outruns the slack its smaller scale allows.
 *
 * ############################################################################
 * # THIS IS NOW STRICTER THAN THE GEOMETRY REQUIRES, AND IT IS LEFT THAT WAY  #
 * # DELIBERATELY. FLAGGED, NOT FIXED.                                         #
 * #                                                                          #
 * # The proportional pan cut was exactly right when a move could start at 1.0  #
 * # and the slack could vanish. With `MOVE_FLOOR_SCALE` at 1.06 the reduced    #
 * # move always has slack, so the cut costs the ~13 edge-cropped shots about   #
 * # 30% of pan they could safely keep.                                        #
 * #                                                                           #
 * # THE COST IS WORSE THAN THIS COMMENT FIRST CLAIMED, AND THE ERROR IS WORTH  #
 * # RECORDING. It said a capped PUSH runs 11.1 px/sec against a capped PULL's  #
 * # 18.2. Those figures are real but they are measured against a 1920px        #
 * # element, and a `blurPillarbox` scene does not have one: its sharp copy is  #
 * # drawn `height: 100%, width: auto` (`Scene.tsx`), so a 960x1440 portrait is #
 * # a 720px-wide box and `kenBurnsFramePercent` resolves the slack against     #
 * # THAT. The real on-screen rates are 4.15 and 6.82 px/sec — 2.67x slower,    #
 * # and inside the band that reads as a still photograph.                     #
 * #                                                                           #
 * # So the honest position is that the motion change lifted the film's median  #
 * # 2.31x and left these ~13 shots exactly where they were. They are the       #
 * # portrait scans, which are also the shots most likely to be held long.      #
 * #                                                                           #
 * # NOT TOUCHED IN THE MOTION CHANGE because this function is the SHARED       #
 * # SOURCE OF TRUTH for the frozen crossfade pose — the worker persists        #
 * # `prevAsset.endScale` through it and the renderer holds that frame. Loosen  #
 * # it and every dissolve out of a plate lands on a pose the outgoing shot     #
 * # never reached, which is the exact regression plan correction C1 fixed.     #
 * # Revisit only with the crossfade pose re-verified in the same change.       #
 * ############################################################################
 */
export function reduceMotion(motion: Motion, maxTravel: number): Motion {
  const travel = motion.toScale - motion.fromScale
  if (Math.abs(travel) <= maxTravel) return motion

  const scaled = Math.sign(travel) * maxTravel
  const factor = travel === 0 ? 0 : scaled / travel

  return {
    ...motion,
    toScale: Math.max(1, motion.fromScale + scaled),
    toX: motion.fromX + (motion.toX - motion.fromX) * factor,
    toY: motion.fromY + (motion.toY - motion.fromY) * factor,
  }
}

/**
 * The outgoing scene's final frame, for plan correction C1: the next scene
 * composites this INSIDE its own segment for the crossfade, so it needs to know
 * exactly where the previous image ended up.
 *
 * Feed it a motion that has ALREADY been through `reduceMotion` when the outgoing
 * scene was cropped to a plate or a pillarbox. The raw motion is where the shot
 * was aimed; the reduced motion is where it landed.
 */
export function motionEndState(motion: Motion): { endScale: number; endX: number; endY: number } {
  return { endScale: motion.toScale, endX: motion.toX, endY: motion.toY }
}
