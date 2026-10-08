import { Easing, interpolate, useCurrentFrame } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { EASING_BEZIER, kenBurnsFramePercent, reduceMotion } from '@vg/core/motion'
import type { Motion } from '@vg/core/schemas'

/**
 * Ken Burns.
 *
 * ####################################################################
 * # NEVER `Easing.inOut`. NEVER a scale below 1.0.                    #
 * #                                                                   #
 * # `inOut` eases IN as well as out, so the shot is nearly stationary #
 * # for the first ~0.4s after every cut. Over 150 scenes that reads   #
 * # as PowerPoint — the single most recognisable tell there is. The   #
 * # image must already be moving at the frame the cut lands on.       #
 * #                                                                   #
 * # The curve is chosen per move from `EASING_BEZIER`, and every       #
 * # member of that lookup has control points x1 = y1 = 0, so the ban  #
 * # holds by construction rather than by this component picking one   #
 * # safe curve. Opening slopes are 1.72x / 1.20x / 1.00x of mean      #
 * # speed. Do not add a fourth easing without those two zeros.        #
 * #                                                                   #
 * # Below 1.0 the image is smaller than the frame and its edges show. #
 * ####################################################################
 *
 * Pan is NOT interpolated here. `motion.fromX`/`toX` are normalised positions in
 * the pan slack the current scale allows, and `kenBurnsFramePercent` converts
 * them to `u * (scale - 1) / 2` as a PERCENTAGE. That makes edge exposure
 * geometrically impossible at every frame, including the first frame of a push
 * that starts at exactly 1.0, where the slack is zero.
 *
 * ####################################################################
 * # PERCENT, NOT PIXELS — AND NOT THE FRAME SIZE.                     #
 * #                                                                   #
 * # This div is only 1920x1080 when the caller leaves it at the       #
 * # `position: absolute; inset: 0` below. ArchivePlate and the        #
 * # blurPillarbox branch of Scene both override that with             #
 * # `position: relative; inset: auto`, so the box shrink-wraps to the #
 * # image — around 564px wide for a portrait scan. Slack computed     #
 * # from FRAME_WIDTH was then roughly 3x the slack that box actually  #
 * # has, and the opening frame slid the photograph off its own plate. #
 * #                                                                   #
 * # A CSS percent translate resolves against this element's own       #
 * # untransformed border box, so it is right in all four crop         #
 * # branches with nothing measured.                                   #
 * ####################################################################
 */

export type KenBurnsProps = {
  motion: Motion
  durationFrames: number
  /** Some crop modes cap total scale travel; the cap comes from `maxTravelForCrop`. */
  maxTravel?: number
  children: ReactNode
  style?: CSSProperties
}

export function KenBurns({
  motion,
  durationFrames,
  maxTravel,
  children,
  style,
}: KenBurnsProps): ReactNode {
  const frame = useCurrentFrame()
  const effective = maxTravel === undefined ? motion : reduceMotion(motion, maxTravel)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: kenBurnsTransform(effective, durationFrames, frame),
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * THE CSS TRANSFORM OF ONE MOVE ON ONE FRAME. `KenBurns` above and the four
 * client animations that push their own picture (lever 4, see `PictureMove`)
 * both draw through this, so a move looks the same on either branch.
 */
export function kenBurnsTransform(motion: Motion, durationFrames: number, frame: number): string {
  // A one-frame scene has no range to interpolate over; it holds the start pose.
  const last = Math.max(1, durationFrames - 1)
  /*
   * LOOKED UP FROM THE MOVE, NOT HARDCODED, AND MISSING THIS LINE IS THE WORST
   * WAY THIS CHANGE COULD FAIL. Hardcoding one curve here while the schema
   * accepts three and the planner writes three means every shot silently plays
   * on `linearOut` anyway: the suite stays green, the plan looks right, and the
   * video does not change. Half-working is worse than not working.
   */
  const eased = interpolate(frame, [0, last], [0, 1], {
    easing: Easing.bezier(...EASING_BEZIER[motion.easing]),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const { scale, translateXPct, translateYPct } = kenBurnsFramePercent(motion, eased)
  // Transform functions apply right to left, so the translation is resolved
  // against the element's own UNSCALED box — which is exactly the box the
  // percentages are a fraction of.
  return `translate(${translateXPct}%, ${translateYPct}%) scale(${scale})`
}

/**
 * THE PLAN'S MOVE FOR A DEVICE'S OWN PICTURE. LEVER 4, 2026-09-19.
 *
 * ##########################################################################
 * # Four of the client's animations (shadow-up, chapter-plate, top-title,  #
 * # corner-label) draw the photograph untouched, so once the type lands    #
 * # the frame froze. The planner now writes Saku's slow push-in into       #
 * # `scene.motion` for exactly those four (`DEVICE_PICTURE_PUSH` in the    #
 * # worker's plan.ts, where it can be retuned or switched off without      #
 * # moving `bundleHash`), and `Scene` hands it through `DeviceFrame`.      #
 * #                                                                        #
 * # APPLIED TO THE PICTURE ALONE, as a transform on its own `<Img>`, never #
 * # on a wrapper round the type and never on an ancestor of the dust      #
 * # plate, whose screen blend a transformed ancestor would isolate.        #
 * ##########################################################################
 */
export type PictureMove = { readonly motion: Motion; readonly durationFrames: number }

/**
 * The style a device puts on its own `<Img>` for its `PictureMove`, and NOTHING
 * without one, so a device mounted with no move (the clip harnesses, the
 * standalone mount tests) draws exactly the DOM it always did.
 */
export function pictureMoveStyle(move: PictureMove | undefined, frame: number): CSSProperties {
  if (move === undefined) return {}
  return { transform: kenBurnsTransform(move.motion, move.durationFrames, frame), willChange: 'transform' }
}

/**
 * The outgoing image during a baked crossfade: held at the exact pose the plan
 * recorded, with no motion of its own.
 *
 * The plan carries only `endScale`/`endX`/`endY`, so continuing its movement is
 * not expressible — and over the 8-16 frames a dissolve lasts, a held frame under
 * a moving one is below the perceptual threshold.
 */
export function FrozenPose({
  endScale,
  endX,
  endY,
  children,
  style,
}: {
  endScale: number
  endX: number
  endY: number
  children: ReactNode
  style?: CSSProperties
}): ReactNode {
  // Percent for the same reason KenBurns uses it. This one matters even though
  // the caller is full-frame today: the outgoing layer has to be posed inside
  // whatever crop branch the previous scene used, and a plate-sized box here
  // would tear the picture sideways at the very moment the dissolve is holding
  // it still, which is the most visible frame in the whole transition.
  const { scale, translateXPct, translateYPct } = kenBurnsFramePercent(
    {
      type: 'kenBurns',
      fromScale: endScale,
      toScale: endScale,
      fromX: endX,
      toX: endX,
      fromY: endY,
      toY: endY,
      easing: 'linearOut',
    },
    1,
  )

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `translate(${translateXPct}%, ${translateYPct}%) scale(${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * How a picture is posed inside whatever box its crop mode gives it.
 *
 * ####################################################################
 * # THIS EXISTS SO THERE IS ONE CROP SWITCH, NOT TWO.                 #
 * #                                                                   #
 * # The incoming layer is a live Ken Burns move and the outgoing layer#
 * # of a crossfade is a held frame, and that difference used to be the#
 * # reason Scene.tsx had a four-way crop switch for one of them and a #
 * # bare `objectFit: cover` for the other. A portrait scan therefore  #
 * # snapped off its archive plate for the 8-16 frames of every        #
 * # dissolve. Making the difference a value the crop code carries     #
 * # means both layers go through the same crop branch and cannot      #
 * # drift apart again.                                                #
 * ####################################################################
 */
export type Pose =
  | { kind: 'kenBurns'; motion: Motion; durationFrames: number }
  | { kind: 'frozen'; endScale: number; endX: number; endY: number }

export type PosedProps = {
  pose: Pose
  /**
   * Cap on total scale travel, honoured only by a live move — see `Posed`.
   * Archive plates and blur pillarboxes set it; see `maxTravelForCrop`.
   */
  maxTravel?: number
  style?: CSSProperties
  children: ReactNode
}

/**
 * Render `children` at `pose`. A component, not a factory, on purpose: the
 * element type has to be stable across frames or React remounts the `<Img>` on
 * every single one of them and the picture reloads mid-shot.
 */
export function Posed({ pose, maxTravel, style, children }: PosedProps): ReactNode {
  if (pose.kind === 'frozen') {
    // `maxTravel` is deliberately dropped here. DO NOT "fix" this by forwarding
    // it: the worker already applied the same reduction when it wrote
    // `prevAsset.endScale` (plan.ts, via `maxTravelForCrop`), so this pose IS the
    // reduced one. Reducing it a second time would shrink the held frame below
    // the frame the outgoing shot actually ended on — the exact mismatch this
    // whole path exists to remove.
    return (
      <FrozenPose endScale={pose.endScale} endX={pose.endX} endY={pose.endY} style={style}>
        {children}
      </FrozenPose>
    )
  }

  return (
    <KenBurns
      motion={pose.motion}
      durationFrames={pose.durationFrames}
      maxTravel={maxTravel}
      style={style}
    >
      {children}
    </KenBurns>
  )
}
