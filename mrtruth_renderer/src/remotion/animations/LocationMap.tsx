import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { LOCATION_MAP_LABEL_FAMILY } from '../constants.js'
import { useLocationMapFont } from '../fonts.js'
import { SourcedImg as Img } from '../SourcedImg.js'
import {
  LOCATION_MAP,
  locationMapCamera,
  locationMapDotOpacity,
  locationMapLabelIn,
  locationMapLabelLayout,
  locationMapLabelOut,
  locationMapLineScale,
  locationMapRingSweep,
  locationMapVignetteGradient,
} from './locationMapClock.js'

/**
 * `location-map`, the owner's map animation of 2026-10-11 ("LAKE MONOUN"): the
 * place's satellite plate in perspective, the camera pulling back to top-down
 * while a yellow ring draws round the place, a white line runs off to the right
 * and the name slides up beside it, then fades before the cut. Every number is
 * in `locationMapClock.ts`, measured off his reference.
 *
 * THE MAP AND EVERYTHING ON IT ARE ONE PLANE. His overlays are drawn in the map's
 * own plane (they foreshorten and turn with it), so the plate and the overlays
 * ride the SAME CSS 3D transform, his camera solved as one: perspective 1600 px
 * from the frame's centre, rotateX(T) rotateZ(Z) scale(S) about the place.
 *
 * TWO PLANES WITH THE SAME TRANSFORM. The plate is laid out at one CSS px per
 * M unit, the resolution it is made at. The overlays are one SVG whose viewBox is
 * the map plane, in a plane of its own laid out at `OVERLAY_DENSITY` CSS px per
 * unit and scaled down by as much. Chromium snaps a line of text, and every move
 * of it, to whole CSS px of the transformed plane it sits in: at one px per unit
 * his name sat ~0.6 unit high and its slide-in stepped by whole units. At 4 px
 * per unit the grid is 0.25 unit: laid over his settled frames the name's centre
 * is within 0.05 unit of his and the slide is smooth. (Everything is vector and
 * rastered at the scale it lands on screen, so it stays sharp at the start's
 * 1.87x either way.)
 *
 * NO HOUSE GRADE (`carriesOwnGrade: true`, and the scene's grade is not read):
 * his look is baked into the plate when it is made, his vignette is drawn here
 * over everything, and his white is pure #FFFFFF.
 *
 * IT IS A PURE FUNCTION OF `frame`, THE SHOT'S LENGTH AND PROPS, like every device.
 */
export type LocationMapProps = {
  /** The place's satellite plate, made at planning time to cover `LOCATION_MAP.plate` exactly. */
  src: string
  /** The name, as written; it is set in capitals. */
  label: string
}

/**
 * The overlay SVG's box in M units: the ring shadow reaches ~80 units from the
 * place, the line ends at 620, two lines of name rise to about -130.
 */
const OVERLAY_BOX = { x0: -120, y0: -220, x1: 720, y1: 120 }

/** The name's box in M units (its shadow filter's region): two lines rise to ~-125, the slide and the shadow reach ~+100. */
const LABEL_BOX = { x0: 60, y0: -200, x1: 720, y1: 120 }

/** CSS px per M unit in the overlays' plane: see the box above. */
const OVERLAY_DENSITY = 4

export function LocationMap({ src, label }: LocationMapProps): ReactNode {
  useLocationMapFont()
  const frame = useCurrentFrame()
  const { width, durationInFrames } = useVideoConfig()
  const cam = locationMapCamera(frame, durationInFrames)
  const k = width / 1920
  const { plate } = LOCATION_MAP
  /* The place sits at the frame's centre; the plane turns, tilts and scales about it. */
  const plane = (density: number): CSSProperties => ({
    position: 'absolute',
    left: 960,
    top: 540,
    width: 0,
    height: 0,
    transformOrigin: '0 0',
    transform: `rotateX(${cam.tiltDeg}deg) rotateZ(${cam.headingDeg}deg) scale(${cam.scale / density})`,
  })
  const b = OVERLAY_BOX
  const d = OVERLAY_DENSITY

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {/* His frame is 1920x1080; another size is the same stage scaled. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            perspective: `${LOCATION_MAP.camera.perspectivePx}px`,
            perspectiveOrigin: '960px 540px',
          }}
        >
          <div style={plane(1)}>
            <Img
              src={src}
              style={{
                position: 'absolute',
                left: plate.x0,
                top: plate.y0,
                width: plate.x1 - plate.x0,
                height: plate.y1 - plate.y0,
                maxWidth: 'none',
              }}
            />
          </div>
          <div style={plane(d)}>
            {/* ONE SVG IN M UNITS for every overlay: its viewBox is the map plane. */}
            <svg
              width={(b.x1 - b.x0) * d}
              height={(b.y1 - b.y0) * d}
              viewBox={`${b.x0} ${b.y0} ${b.x1 - b.x0} ${b.y1 - b.y0}`}
              style={{ position: 'absolute', left: b.x0 * d, top: b.y0 * d, overflow: 'visible' }}
            >
              <Marker frame={frame} />
              <Line frame={frame} />
              <Label frame={frame} durationFrames={durationInFrames} label={label} />
            </svg>
          </div>
        </div>
        {/* Screen-fixed, over everything, as his. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: locationMapVignetteGradient(),
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

/** Filters cover the whole overlay box, in its own units. */
const REGION = {
  x: OVERLAY_BOX.x0,
  y: OVERLAY_BOX.y0,
  width: OVERLAY_BOX.x1 - OVERLAY_BOX.x0,
  height: OVERLAY_BOX.y1 - OVERLAY_BOX.y0,
  filterUnits: 'userSpaceOnUse' as const,
}

/** Dot and ring with their shadows. Bottom to top: dot shadow, dot, ring shadow, ring. */
function Marker({ frame }: { frame: number }): ReactNode {
  const m = LOCATION_MAP.marker
  const sweep = locationMapRingSweep(frame)
  const dotOpacity = locationMapDotOpacity(frame)
  const circumference = 2 * Math.PI * m.ringRadius
  /* A circle's stroke starts at 3 o'clock and runs clockwise on screen: his east, south, west, north. */
  const dash = `${circumference * sweep} ${circumference * 2}`
  const rs = m.ringShadow
  /* The square's 1.6-unit linear edge as a Gaussian of the same variance (a uniform ramp: width / sqrt 12). */
  const clipBlur = rs.clipSoft / Math.sqrt(12)
  return (
    <g>
      <defs>
        <filter id="lm-dot-shadow" {...REGION}>
          <feGaussianBlur stdDeviation={m.dotShadow.sigma} />
        </filter>
        <filter id="lm-ring-shadow" {...REGION}>
          <feGaussianBlur stdDeviation={rs.sigma} />
        </filter>
        <filter id="lm-clip-edge" {...REGION}>
          <feGaussianBlur stdDeviation={clipBlur} />
        </filter>
        <mask id="lm-ring-clip" maskUnits="userSpaceOnUse" {...{ x: REGION.x, y: REGION.y, width: REGION.width, height: REGION.height }}>
          <rect
            x={-rs.clipHalfW}
            y={-rs.clipHalfH}
            width={2 * rs.clipHalfW}
            height={2 * rs.clipHalfH}
            fill="#FFFFFF"
            filter="url(#lm-clip-edge)"
          />
        </mask>
      </defs>
      {dotOpacity > 0 && (
        <g opacity={dotOpacity}>
          <circle
            cx={m.dotShadow.dx}
            cy={m.dotShadow.dy}
            r={m.dotRadius}
            fill="#000000"
            opacity={m.dotShadow.opacity}
            filter="url(#lm-dot-shadow)"
          />
          <circle cx={0} cy={0} r={m.dotRadius} fill={m.colour} />
        </g>
      )}
      {sweep > 0 && (
        <>
          <g mask="url(#lm-ring-clip)" opacity={rs.opacity}>
            <circle
              cx={rs.dx}
              cy={rs.dy}
              r={m.ringRadius}
              fill="none"
              stroke="#000000"
              strokeWidth={m.ringStroke}
              strokeDasharray={dash}
              filter="url(#lm-ring-shadow)"
            />
          </g>
          <circle
            cx={0}
            cy={0}
            r={m.ringRadius}
            fill="none"
            stroke={m.colour}
            strokeWidth={m.ringStroke}
            strokeDasharray={dash}
          />
        </>
      )}
    </g>
  )
}

/** The white line: a linear opacity gradient, scaled out from its left end (the gradient squeezed with it). */
function Line({ frame }: { frame: number }): ReactNode {
  const l = LOCATION_MAP.line
  const s = locationMapLineScale(frame)
  if (s <= 0) return null
  const length = (l.xFade - l.x0) * s
  return (
    <g>
      <defs>
        <linearGradient id="lm-line-fade" gradientUnits="userSpaceOnUse" x1={l.x0} y1={0} x2={l.x0 + length} y2={0}>
          <stop offset={0} stopColor={l.colour} stopOpacity={l.opacity} />
          <stop offset={1} stopColor={l.colour} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={l.x0} y={l.yCentre - l.thickness / 2} width={length} height={l.thickness} fill="url(#lm-line-fade)" />
    </g>
  )
}

/** The name: slides up and fades in, holds, fades before the cut. Shadow and type are one group, as his fade them. */
function Label({ frame, durationFrames, label }: { frame: number; durationFrames: number; label: string }): ReactNode {
  const L = LOCATION_MAP.label
  const p = locationMapLabelIn(frame)
  const opacity = p * locationMapLabelOut(frame, durationFrames)
  if (opacity <= 0) return null
  const layout = locationMapLabelLayout(label)
  const fs = layout.fontSize
  /* Two lines stack UP from his baseline, so the bottom line sits where his one line does. */
  const baselines = layout.lines.map((_, i) => L.baselineY - (layout.lines.length - 1 - i) * L.linePitch * fs)
  const text = (colour: string): ReactNode =>
    layout.lines.map((line, i) => (
      <text
        key={i}
        x={L.penX}
        y={baselines[i] ?? L.baselineY}
        fill={colour}
        stroke={colour}
        strokeWidth={2 * L.stroke}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{
          fontFamily: `'${LOCATION_MAP_LABEL_FAMILY}', 'Liberation Sans Narrow', 'Arial Narrow', sans-serif`,
          fontWeight: 400,
          fontSize: fs,
          letterSpacing: L.tracking,
          fontKerning: 'normal',
          textRendering: 'geometricPrecision',
          whiteSpace: 'pre',
        }}
      >
        {line}
      </text>
    ))
  return (
    <g opacity={opacity} transform={`translate(0 ${L.entrance.slide * (1 - p)})`}>
      <defs>
        <filter
          id="lm-label-shadow"
          filterUnits="userSpaceOnUse"
          x={LABEL_BOX.x0}
          y={LABEL_BOX.y0}
          width={LABEL_BOX.x1 - LABEL_BOX.x0}
          height={LABEL_BOX.y1 - LABEL_BOX.y0}
        >
          <feGaussianBlur stdDeviation={L.shadow.sigma} />
        </filter>
      </defs>
      <g
        transform={`translate(${L.shadow.dx} ${L.shadow.dy})`}
        opacity={L.shadow.opacity}
        filter="url(#lm-label-shadow)"
      >
        {text(L.shadow.colour)}
      </g>
      {text(L.colour)}
    </g>
  )
}
