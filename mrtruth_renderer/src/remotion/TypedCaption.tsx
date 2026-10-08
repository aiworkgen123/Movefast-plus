import { useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion'
import type { PlannedScene } from '@vg/core/schemas'
import { TYPED_CAPTION_WOFF2_BASE64 } from './typedCaptionFaceData.js'

/**
 * The typed caption: one or two lines of serif type, bottom left, typed in a
 * letter at a time behind a thin cursor that leaves when the last letter lands.
 *
 * Matched 2026-10-08 against the client's reference ("Removed from the Bible -
 * / Council of Laodicea, 364 CE", a 2880x1800 screen recording at 60 fps):
 *   face     EB Garamond, wght 520, OLD-STYLE figures (the 3 and 4 descend) -
 *            the defining tell; lining figures read as a different font.
 *   colour   #F3E1CE, a warm paper white, with a soft dark shadow.
 *   size     78px on 1920x1080, lines 89px apart, left edge 145px (7.5%),
 *            first baseline 850px.
 *   timing   about 24 characters a second (line 1 26/s, line 2 22/s), typing
 *            starts ~0.25 s into the shot; the cursor shows only while typing.
 * All lengths below are for 1920 wide and scale with the composition.
 */
export const TYPED_CAPTION_FAMILY = 'TypedCaptionSerif'
const FACE_SOURCE = `url(data:font/woff2;base64,${TYPED_CAPTION_WOFF2_BASE64}) format('woff2')`

export const TYPED_CAPTION = {
  color: '#F3E1CE',
  shadow: '0 2px 3px rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.45)',
  weight: 520,
  size: 78,
  lineGap: 89,
  left: 141,
  firstBaseline: 850,
  charsPerSecond: 24,
  cursorWidth: 3,
  /** line 1 runs ~25/s and line 2 ~21/s in the reference: multipliers on charsPerSecond */
  lineRates: [25 / 24, 21 / 24],
  /** the block holds two lines; the last baseline is firstBaseline + lineGap */
  maxLines: 2,
  /** where the baseline sits inside a line box of line-height = size (measured on a render) */
  baselineFromTop: 66,
} as const

function useTypedCaptionFace(on: boolean): void {
  useLayoutEffect(() => {
    if (!on) return
    const handle = delayRender(`loading ${TYPED_CAPTION_FAMILY}`)
    let cancelled = false
    void (async () => {
      try {
        const loaded = await new FontFace(TYPED_CAPTION_FAMILY, FACE_SOURCE, {
          weight: '400 800',
          style: 'normal',
          display: 'block',
        }).load()
        if (!cancelled) document.fonts.add(loaded)
      } catch (error) {
        console.warn(`${TYPED_CAPTION_FAMILY} failed to load: ${String(error)}`)
      } finally {
        continueRender(handle)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [on])
}

/**
 * How many characters of each line are on screen at `frame` (scene-relative).
 * The reference types its first line faster than its second (26 vs 22 a second,
 * no pause at the break); `cps` is the average and both lines scale with it.
 */
export function typedCounts(lines: readonly string[], frame: number, startFrame: number, fps: number, cps: number): number[] {
  let t = Math.max(0, (frame - startFrame) / fps)
  return lines.map((line, i) => {
    const rate = cps * (TYPED_CAPTION.lineRates[i] ?? 1)
    const shown = Math.min(line.length, Math.floor(t * rate))
    t = Math.max(0, t - line.length / rate)
    return shown
  })
}

export function TypedCaption({ scene }: { scene: PlannedScene }): ReactNode {
  const caption = scene.typedCaption ?? null
  useTypedCaptionFace(caption !== null)
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  if (caption === null || frame < caption.startFrame) return null
  const k = width / 1920
  const cps = caption.charsPerSecond ?? TYPED_CAPTION.charsPerSecond
  const counts = typedCounts(caption.lines, frame, caption.startFrame, fps, cps)
  const done = counts.every((n, i) => n === caption.lines[i]?.length)
  const cursorLine = counts.findIndex((n, i) => n < (caption.lines[i]?.length ?? 0))
  const visible = counts.filter((n, i) => n > 0 || i === cursorLine).length
  // fade with the shot's last 8 frames so the type never cuts hard
  const tail = scene.durationFrames - frame
  const opacity = tail < 8 ? Math.max(0, tail / 8) : 1
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity }}>
      {caption.scrim === true && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: Math.min(1, (frame - caption.startFrame) / 8),
            background: 'radial-gradient(ellipse 60% 42% at 22% 86%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0) 100%)',
          }}
        />
      )}
      {caption.lines.map((line, i) => {
        const shown = line.slice(0, counts[i] ?? 0)
        if (shown.length === 0 && i !== cursorLine) return null
        // BOTTOM-ANCHORED, as in the reference: a lone line sits on the LAST baseline and
        // is pushed up one line the moment the next line starts typing
        const row = TYPED_CAPTION.maxLines - visible + i
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: TYPED_CAPTION.left * k,
              top: (TYPED_CAPTION.firstBaseline + row * TYPED_CAPTION.lineGap - TYPED_CAPTION.baselineFromTop) * k,
              lineHeight: `${TYPED_CAPTION.size * k}px`,
              whiteSpace: 'pre',
              fontFamily: `'${TYPED_CAPTION_FAMILY}', Georgia, serif`,
              fontWeight: TYPED_CAPTION.weight,
              fontSize: TYPED_CAPTION.size * k,
              color: TYPED_CAPTION.color,
              textShadow: TYPED_CAPTION.shadow,
            }}
          >
            {shown}
            {!done && i === cursorLine && (
              <span
                style={{
                  display: 'inline-block',
                  width: TYPED_CAPTION.cursorWidth * k,
                  height: TYPED_CAPTION.size * 0.78 * k,
                  marginLeft: 3 * k,
                  verticalAlign: TYPED_CAPTION.size * -0.04 * k,
                  backgroundColor: TYPED_CAPTION.color,
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
