import type { ReactNode } from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { PlannedScene } from '@vg/core/schemas'
import { TURN_KEYS } from './turnData.js'

/**
 * The cinematic turn (owner 2026-10-09): the picture swings slowly in depth around its vertical centre line - the
 * right side comes toward the camera, the left recedes - while it eases in by about 11%. Measured 1:1 from the
 * owner's reference (3.7 s at 60 fps; fitted per frame to under 1 px): a point x,y from the centre lands at
 * s*x/(1+k*x/W), s*y/(1+k*x/W). Past the measured 3.7 s the move carries on and settles (its last speed decays
 * by TURN_DECAY a frame), as the reference was cut while still moving.
 *
 * The perspective term is multiplied by the overscan: scaling AFTER the projection would otherwise thin the
 * measured perspective by that factor relative to the frame (checked against the reference by re-measuring).
 *
 * The picture is overscanned by one constant factor (the whole move's worst corner), so no edge ever shows and
 * the overscan itself never moves.
 */
const TURN_DECAY = 0.92

function keyAt(frame: number): readonly [number, number] {
  const last = TURN_KEYS.length - 1
  if (frame <= last) return TURN_KEYS[Math.max(0, frame)] ?? [0, 1]
  const [k1, s1] = TURN_KEYS[last] ?? [0, 1]
  const [k0, s0] = TURN_KEYS[last - 1] ?? [0, 1]
  const n = frame - last
  const carry = (1 - Math.pow(TURN_DECAY, n)) / (1 - TURN_DECAY) * TURN_DECAY
  return [k1 + (k1 - k0) * carry, s1 + (s1 - s0) * carry]
}

/** The constant overscan that keeps the left edge (the receding side) covered over the whole shot. */
function overscan(durationFrames: number): number {
  let worst = 1
  for (let f = 0; f < durationFrames; f++) {
    const [k, s] = keyAt(f)
    worst = Math.max(worst, (1 + Math.abs(k) / 2) / s, 1 / s)
  }
  return worst * 1.01
}

export function CinemaTurn({ scene, children }: { scene: PlannedScene; children: ReactNode }): ReactNode {
  const frame = useCurrentFrame()
  const { width } = useVideoConfig()
  if (scene.cinemaMove?.kind !== 'turn') return <>{children}</>
  const [k, s] = keyAt(frame)
  const o = overscan(scene.durationFrames)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '50% 50%',
        transform: `scale(${o.toFixed(5)}) matrix3d(${s}, 0, 0, ${(k * o) / width}, 0, ${s}, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)`,
      }}
    >
      {children}
    </div>
  )
}
