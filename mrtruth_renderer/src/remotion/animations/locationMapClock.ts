import { Easing } from 'remotion'
import { LOCATION_MAP_ADVANCES, LOCATION_MAP_CHARS, LOCATION_MAP_KERNING } from './locationMapFaceData.js'

/**
 * `location-map`, the owner's map animation of 2026-10-11: a satellite map seen
 * in perspective, the camera pulling back, tilting up to top-down and turning,
 * while a yellow ring draws round the place, a white line runs off to the right
 * and the place's name slides up beside it. Every element lies IN the map plane,
 * so it foreshortens and turns with the map.
 *
 * EVERY NUMBER HERE IS MEASURED OFF HIS REFERENCE (ref.mp4, frames 22..261, 240
 * frames at 30 fps, 1920x1080), except the ones marked OURS. A few were then
 * corrected against our own render laid over his frames (the line's opacity and
 * height, the label's pen and baseline, the marker shadows), each said where it
 * is. The per-frame fits
 * live with the job that measured them (verify/mapdate/measure_map/spec.json and
 * notes.md); this file is the one place the component and the planner's width
 * gate (`mrtruth_map.py`, which mirrors the label numbers) read them from.
 *
 * UNITS. "M units" are north-up map-plane coordinates: origin = the place = the
 * marker centre = screen centre, +x east, +y south, 1 unit = 1 screen px in the
 * end frame (top-down, scale 1) = 135.34 m on the ground. The satellite plate is
 * made at planning time to exactly `plate` below (`mrtruth_map.py`).
 *
 *   camera    perspective 1600 px from (960, 540); the plane, anchored at the
 *             place, is rotateX(T) rotateZ(Z) scale(S) with p = easeInOutCubic
 *             over the whole shot: T 37.98 -> 0 deg, Z -21.01 -> +12.985 deg
 *             (north ends 13 deg clockwise), S 1.866 -> 1. Rms 0.20 px against
 *             his per-frame homographies.
 *   marker    #F7E440. Dot r 13.5 fading in over frames 0-15; ring r 36 (stroke
 *             6, butt caps) sweeping from east clockwise over frames 10.26-34.12.
 *             Black shadows multiplied onto the map, the ring's cut by a square.
 *   line      white, 6 thick, from x 77.5, its opacity 0.91 -> 0 at x 620;
 *             scaleX 0 -> 1 from its left end over frames 29.95-39.91.
 *   label     Bebas Neue 69.4 units with a 1.1 white outside stroke, tracking
 *             0.6, baseline about 1.6 above the marker centre; black shadow
 *             0.65 at (5.0, 5.9) sigma 6.3. In: slide up 44.67 + fade,
 *             frames 20.73-50.98; out: fade, ending 3.55 frames past the cut.
 *   screen    a fixed elliptical vignette over everything, blue darkened less.
 *   grade     baked into the plate at planning time (`mrtruth_map.py`): the
 *             overlays are NOT graded, his white is #FFFFFF.
 *   sound     `sfx/map_location.wav`, mixed by the planner (`mrtruth.py`
 *             `_sfx_audio`) 0.113 s after the shot's first frame.
 *
 * ANOTHER LENGTH (OURS). His shot is 240 frames and the camera move fills it
 * exactly. On any other length the move is compressed or stretched to the shot
 * (it always ends on the last frame, as his does), the build (dot, ring, label,
 * line) keeps his absolute frames from the shot's start and is never cut, and the
 * label's exit keeps its place relative to the END. The planner seats it on 5-8 s.
 */
export const LOCATION_MAP = {
  /** His shot: reference frames 22..261. */
  referenceFrames: 240,
  camera: {
    perspectivePx: 1600,
    /** rotateX at the shot's first frame; 0 (top-down) at its last. */
    tiltDeg: 37.9842,
    /** rotateZ of the north-up plane at the last frame; it starts `turnDeg` away. */
    endHeadingDeg: 12.985,
    turnDeg: -33.9937,
    /** scale = 1 + pullBack at the first frame, 1 at the last. */
    pullBack: 0.86644,
  },
  /**
   * The M-unit rectangle the satellite plate covers, centred on the place. His
   * camera sees x +-1056.8 and y +-741.9 at most (the end frame, turned 13 deg);
   * OURS: 40-odd units more on each side so no frame ever reaches its edge.
   */
  plate: { x0: -1100, x1: 1100, y0: -780, y1: 780 },
  /** Ground metres per M unit (his end frame, 259.9 km across). */
  metresPerUnit: 135.34,
  marker: {
    colour: '#F7E440',
    dotRadius: 13.5,
    /** Linear opacity 0 -> 1. */
    dotFade: { from: 0, to: 15 },
    ringRadius: 36,
    ringStroke: 6,
    /** Linear sweep 0 -> 360 deg, starting east and going clockwise (east, south, west, north). */
    ringDraw: { from: 10.26, to: 34.12 },
    /**
     * Black, multiplied onto the map, fading in with the dot. The shadow numbers
     * here and on the ring are refitted (same model as his notes) on his own
     * shading map - frames 100-200 over frame 0, in map units: rms 0.0246 against
     * 0.0287 for the first fit; ours rendered lies 0.030 rms from his.
     */
    dotShadow: { opacity: 0.948, sigma: 7.662, dx: -0.609, dy: 3.999 },
    /**
     * Black, cut off by a square (his layer's bounds) that leaves a faint darker
     * square round the ring; the clip edge is a 1.6-unit ramp. The ring and its
     * shadow sit above the dot, which is why his dot ends ~4% darker.
     */
    ringShadow: { opacity: 0.604, sigma: 12.644, dx: -0.372, dy: 8.491, clipHalfW: 43.545, clipHalfH: 43.266, clipSoft: 1.76 },
  },
  line: {
    colour: '#FFFFFF',
    /**
     * The gradient's opacity at its start. His notes read 1.0; laid over his
     * end frames (label-free, top-down) his line is 0.91 of a full-white line
     * along its whole length (x 85-485, ratio median 0.91): 0.91 it is.
     */
    opacity: 0.91,
    x0: 77.5,
    /** Where the linear opacity gradient (`opacity` at x0) reaches 0. */
    xFade: 620,
    /** 37.2 in his notes; 37.57 lands ours on his line (end frames, x 85-485, within 0.15 units). */
    yCentre: 37.57,
    thickness: 6,
    /** Linear scaleX 0 -> 1, anchored at x0; the gradient is squeezed into the drawn part. */
    draw: { from: 29.95, to: 39.91 },
  },
  label: {
    colour: '#FFFFFF',
    /** Font size in M units (cap height 48.6 = 0.7 em). */
    fontSize: 69.4,
    /** White outside stroke: -webkit-text-stroke 2 x this, painted under the fill. */
    stroke: 1.1,
    /** Letter-spacing, M units. */
    tracking: 0.6,
    /**
     * Pen origin of the first glyph and the baseline (his notes: 100.32 and
     * -1.75). Set 0.14 right and 0.17 down from those after laying ours over his
     * settled frames 70-205: his left and right ink edges are then within 0.05
     * unit (101.80 / 401.30), the name's centre within 0.1 unit, its cap top and
     * bottom within 0.4 (ours is 0.15 taller: the stroke).
     */
    penX: 100.46,
    baselineY: -1.58,
    shadow: { colour: '#000000', opacity: 0.648, dx: 5.0, dy: 5.869, sigma: 6.293 },
    /** Opacity 0 -> 1 and a rigid slide up from +44.67 (south), one curve. No mask. */
    entrance: { from: 20.728, to: 50.982, slide: 44.67, bezier: [0.281, 0.611, 0.223, 1] as const },
    /** Opacity only, ending past the cut (his last frame keeps 0.008). Anchored to the END of the shot. */
    exit: { startBeforeEnd: 29.343, frames: 32.896, bezier: [0.306, 0.718, 0.192, 1] as const },
    /**
     * OURS, his one sample ('LAKE MONOUN', 303 units of advance) never needed
     * them. A longer name is set smaller before it wraps; widths are advance
     * widths with kerning and tracking (`locationMapLabelWidth`).
     *   maxWidth   the advance width of one line. 464 keeps the name's right end
     *              at least 96 px (the house safe margin) inside the frame on every
     *              frame it shows: x <= 565 lands at screen x <= 1820 at worst.
     *   minFontSize  75% of his size; below it the name wraps onto two lines.
     *   linePitch    two lines are stacked UP from his baseline (the line stays
     *              clear below), 0.95 em apart.
     */
    maxWidth: 464,
    minFontSize: 52,
    linePitch: 0.95,
    maxLines: 2,
  },
  /** Screen-fixed, over everything: V = 1 - amount * smoothstep(r0, r1, rho), rho over an ellipse. */
  vignette: { r0: 0.6135, r1: 1.6559, ex: 0.9234, ey: 0.9255, amount: [0.591, 0.6796, 0.4277] as const },
} as const

/** The frame the build is complete on (label settled; the line is done at 39.91): `buildEndFrames`. */
export const LOCATION_MAP_BUILD_END_FRAMES = 51

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** easeInOutCubic, his camera's curve (fit rms 0.00006 in progress). */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

export type LocationMapCamera = { tiltDeg: number; headingDeg: number; scale: number }

/** The camera at a scene-relative frame of a shot `durationFrames` long: the move fills the shot. */
export function locationMapCamera(frame: number, durationFrames: number): LocationMapCamera {
  const c = LOCATION_MAP.camera
  const q = 1 - easeInOutCubic(frame / Math.max(1, durationFrames))
  return { tiltDeg: c.tiltDeg * q, headingDeg: c.endHeadingDeg + c.turnDeg * q, scale: 1 + c.pullBack * q }
}

const linear = (frame: number, span: { from: number; to: number }): number =>
  clamp01((frame - span.from) / (span.to - span.from))

export function locationMapDotOpacity(frame: number): number {
  return linear(frame, LOCATION_MAP.marker.dotFade)
}

/** The drawn share of the ring, 0..1. */
export function locationMapRingSweep(frame: number): number {
  return linear(frame, LOCATION_MAP.marker.ringDraw)
}

export function locationMapLineScale(frame: number): number {
  return linear(frame, LOCATION_MAP.line.draw)
}

const easeIn = Easing.bezier(...LOCATION_MAP.label.entrance.bezier)
const easeOut = Easing.bezier(...LOCATION_MAP.label.exit.bezier)

/** The label's entrance progress 0..1: its opacity, and 1 - (its share of the slide still to go). */
export function locationMapLabelIn(frame: number): number {
  const t = linear(frame, LOCATION_MAP.label.entrance)
  return t <= 0 ? 0 : t >= 1 ? 1 : clamp01(easeIn(t))
}

/** The label's exit multiplier 1 -> 0, anchored to the end; never before the build is done. */
export function locationMapLabelOut(frame: number, durationFrames: number): number {
  const x = LOCATION_MAP.label.exit
  const from = Math.max(LOCATION_MAP_BUILD_END_FRAMES, durationFrames - x.startBeforeEnd)
  const t = linear(frame, { from, to: from + x.frames })
  return t <= 0 ? 1 : t >= 1 ? 0 : clamp01(1 - easeOut(t))
}

/** The label as it is set: capitals, runs of white space as one space. */
export function locationMapLabelText(label: string): string {
  return label.replace(/\s+/g, ' ').trim().toUpperCase()
}

const advanceOf = (ch: string): number => {
  const i = LOCATION_MAP_CHARS.indexOf(ch)
  return i < 0 ? 500 : (LOCATION_MAP_ADVANCES[i] ?? 500)
}
const baseOf = (ch: string): string => ch.normalize('NFD').charAt(0)

/** Advance width in M units of one line set at `fontSize`: kerning (accented capitals as their base) and tracking. */
export function locationMapLabelWidth(line: string, fontSize: number = LOCATION_MAP.label.fontSize): number {
  const chars = [...line]
  let em = 0
  chars.forEach((ch, i) => {
    em += advanceOf(ch)
    const next = chars[i + 1]
    if (next !== undefined) em += LOCATION_MAP_KERNING[baseOf(ch) + baseOf(next)] ?? 0
  })
  return (em * fontSize) / 1000 + LOCATION_MAP.label.tracking * Math.max(0, chars.length - 1)
}

/** Can the face draw every character? (Anything else would be drawn by a fallback face.) */
export function locationMapLabelCovered(label: string): boolean {
  return [...locationMapLabelText(label)].every((ch) => LOCATION_MAP_CHARS.includes(ch))
}

export type LocationMapLabelLayout = { lines: string[]; fontSize: number; fits: boolean }

/**
 * OURS: how a name that is longer than his is set. One line at his size when it
 * fits; else one line set smaller, down to `minFontSize`; else two lines (the
 * split that keeps the longer line shortest), each at the largest size up to his
 * at which the longer one fits. `fits` is false past that: the planner refuses
 * the name (`mrtruth_map.label_layout` says the same), and the renderer still
 * draws it at the floor rather than draw nothing.
 */
export function locationMapLabelLayout(label: string): LocationMapLabelLayout {
  const L = LOCATION_MAP.label
  const text = locationMapLabelText(label)
  const sizeFor = (lines: string[]): number => {
    const widest = Math.max(...lines.map((l) => locationMapLabelWidth(l, L.fontSize)))
    if (widest <= L.maxWidth) return L.fontSize
    /* Tracking does not scale with the size, so solve for it exactly. */
    const n = Math.max(...lines.map((l) => [...l].length))
    const emWidth = (widest - L.tracking * Math.max(0, n - 1)) / L.fontSize
    return (L.maxWidth - L.tracking * Math.max(0, n - 1)) / emWidth
  }
  const one = sizeFor([text])
  if (one >= L.minFontSize) return { lines: [text], fontSize: Math.min(L.fontSize, one), fits: true }
  const words = text.split(' ')
  let best: { lines: string[]; size: number } | null = null
  for (let k = 1; k < words.length; k += 1) {
    const lines = [words.slice(0, k).join(' '), words.slice(k).join(' ')]
    const size = sizeFor(lines)
    if (best === null || size > best.size) best = { lines, size }
  }
  if (best !== null && best.size >= L.minFontSize) {
    return { lines: best.lines, fontSize: Math.min(L.fontSize, best.size), fits: true }
  }
  return { lines: best?.lines ?? [text], fontSize: L.minFontSize, fits: false }
}

/** Does the name fit his label (one or two lines, at or above the floor, every character in the face)? */
export function locationMapLabelFits(label: string): boolean {
  return locationMapLabelText(label) !== '' && locationMapLabelCovered(label) && locationMapLabelLayout(label).fits
}

/** The vignette as CSS: one elliptical radial gradient of multipliers, laid with `mix-blend-mode: multiply`. */
export function locationMapVignetteGradient(): string {
  const v = LOCATION_MAP.vignette
  const stops: string[] = []
  const at = (rho: number): string => {
    const t = clamp01((rho - v.r0) / (v.r1 - v.r0))
    const s = t * t * (3 - 2 * t)
    const [r, g, b] = v.amount.map((a) => (255 * (1 - a * s)).toFixed(3))
    return `rgb(${r}, ${g}, ${b}) ${(rho * 100).toFixed(3)}%`
  }
  stops.push(at(0))
  /* Every 0.02 in rho across the ramp: the smoothstep between two stops is linear to within 0.03%. */
  for (let rho = v.r0; rho < v.r1; rho += 0.02) stops.push(at(rho))
  stops.push(at(v.r1))
  /* rho = 1 on the ellipse with these radii (960 / ex by 540 / ey, in a 1920x1080 frame). */
  return `radial-gradient(ellipse ${(960 / v.ex).toFixed(3)}px ${(540 / v.ey).toFixed(3)}px at 960px 540px, ${stops.join(', ')})`
}
