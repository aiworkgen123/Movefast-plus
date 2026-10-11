import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import type { Grade as GradeSettings } from '@vg/core/schemas'
import { DATE_STAMP_DATE_FAMILY, DATE_STAMP_YEAR_FAMILY } from '../constants.js'
import { useDateStampFonts } from '../fonts.js'
import { Grade } from '../Grade.js'
import { pictureMoveStyle } from '../KenBurns.js'
import type { PictureMove } from '../KenBurns.js'
import { SourcedImg as Img } from '../SourcedImg.js'
import {
  DATE_STAMP,
  dateStampDateFontSizePx,
  dateStampLineTopPx,
  dateStampProgress,
  dateStampRisePx,
  dateStampYearFontSizePx,
} from './dateStampClock.js'

/**
 * `date-stamp`, the owner's date overlay of 2026-10-11 ("February" / "1994"):
 * the beat's own photograph full frame, the house grade on it, and two
 * right-aligned serif lines at the top right that rise 60 px into place as they
 * fade in. Every number is in `dateStampClock.ts`, measured off his reference.
 *
 * THE GRADE GOES UNDER THE TYPE, as `TopTitle.tsx` does it. His type is pure
 * #FFFFFF with a black shadow and a white glow; the house grade on top would
 * dim, mute and tint it, which is no longer his overlay. So the registry says
 * `carriesOwnGrade: true` and this file mounts the scene's grade itself,
 * between the photograph and the letters.
 *
 * THE SHADOW AND THE GLOW ARE TWO BLURRED COPIES OF THE TEXT, not
 * `text-shadow`. `filter: blur(s)` takes s as the Gaussian standard deviation by
 * spec, which is exactly what was fitted (sigma 4.33 and 4.55); Chromium's
 * text-shadow radius-to-sigma mapping is not guaranteed to be radius / 2.
 * Bottom to top: shadow, glow, fill, all inside ONE layer that carries the
 * entrance's opacity and rise, because his frames fade the whole block as one
 * (group opacity fits them better than fading each layer on its own).
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS, like every device: segments are
 * cached by a hash of the plan.
 */
export type DateStampProps = {
  src: string
  grade: GradeSettings
  /** The big line: a month ("February") or a short date. Auto-sized when it is long. */
  date: string
  /** The small line under it, a year. '' omits its block. */
  year: string
  /** The plan's move on the picture alone. Absent draws the picture untouched. See `PictureMove`. */
  pictureMove?: PictureMove
}

export function DateStamp({ src, grade, date, year, pictureMove }: DateStampProps): ReactNode {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...pictureMoveStyle(pictureMove, frame) }}
      />
      <Grade grade={grade} />
      <DateStampType date={date} year={year} />
    </AbsoluteFill>
  )
}

/** The two lines alone, over whatever is below. Exported so a comparison render can lay them on a bare frame. */
export function DateStampType({ date, year }: { date: string; year: string }): ReactNode {
  useDateStampFonts()
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  /* His frame is 1920x1080: sizes and heights scale with the height, the right margin with the width. */
  const k = height / 1080
  const rightPx = (width * (1920 - DATE_STAMP.rightEdgePx)) / 1920
  const progress = dateStampProgress(frame)
  const { shadow, glow } = DATE_STAMP

  return (
    <AbsoluteFill
      style={{
        opacity: progress,
        transform: `translateY(${dateStampRisePx(progress) * k}px)`,
        pointerEvents: 'none',
      }}
    >
      <Lines
        date={date}
        year={year}
        k={k}
        rightPx={rightPx}
        style={{
          color: shadow.colour,
          opacity: shadow.opacity,
          transform: `translate(${shadow.offsetXPx * k}px, ${shadow.offsetYPx * k}px)`,
          filter: `blur(${shadow.sigmaPx * k}px)`,
        }}
      />
      <Lines
        date={date}
        year={year}
        k={k}
        rightPx={rightPx}
        style={{ color: glow.colour, opacity: glow.opacity, filter: `blur(${glow.sigmaPx * k}px)` }}
      />
      <Lines date={date} year={year} k={k} rightPx={rightPx} style={{ color: DATE_STAMP.colour }} />
    </AbsoluteFill>
  )
}

function Lines({
  date,
  year,
  k,
  rightPx,
  style,
}: {
  date: string
  year: string
  k: number
  rightPx: number
  style: CSSProperties
}): ReactNode {
  const dateSize = dateStampDateFontSizePx(date)
  const yearSize = dateStampYearFontSizePx(year)
  return (
    <AbsoluteFill style={style}>
      <Line
        text={date}
        family={DATE_STAMP_DATE_FAMILY}
        fontSizePx={dateSize * k}
        topPx={dateStampLineTopPx(DATE_STAMP.date.baselinePx, dateSize, DATE_STAMP.date) * k}
        rightPx={rightPx}
      />
      {/* `!== ''` rather than truthiness, for the reason `P12.tsx` gives. */}
      {year !== '' && (
        <Line
          text={year}
          family={DATE_STAMP_YEAR_FAMILY}
          fontSizePx={yearSize * k}
          topPx={dateStampLineTopPx(DATE_STAMP.year.baselinePx, yearSize, DATE_STAMP.year) * k}
          rightPx={rightPx}
        />
      )}
    </AbsoluteFill>
  )
}

function Line({
  text,
  family,
  fontSizePx,
  topPx,
  rightPx,
}: {
  text: string
  family: string
  fontSizePx: number
  topPx: number
  rightPx: number
}): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        top: topPx,
        /* Right-anchored with no width, so the line grows leftward from his x = 1840 edge. */
        right: rightPx,
        fontFamily: `'${family}', 'Liberation Serif', serif`,
        fontWeight: 400,
        fontSize: fontSizePx,
        lineHeight: `${fontSizePx}px`,
        letterSpacing: 0,
        fontKerning: 'normal',
        textAlign: 'right',
        whiteSpace: 'pre',
      }}
    >
      {text}
    </div>
  )
}
