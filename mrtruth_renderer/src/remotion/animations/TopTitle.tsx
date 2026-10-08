import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { ReactNode } from 'react'
import type { Grade as GradeSettings } from '@vg/core/schemas'
import { FRAME_WIDTH, SAFE_AREA_X } from '../constants.js'
import { Grade } from '../Grade.js'
import { pictureMoveStyle } from '../KenBurns.js'
import type { PictureMove } from '../KenBurns.js'
import { SourcedImg as Img } from '../SourcedImg.js'
import { BODY_FACE_FAMILY } from './bodyFace.js'
import { useBodyFaceBold } from './bodyFaceBold.js'
import {
  TOP_TITLE_FIRST_SLOT,
  TOP_TITLE_TYPE,
  topTitleBlockOpacity,
  topTitleCharacterOpacity,
  topTitleGlyphs,
  topTitleLine2FirstSlot,
  topTitleLineTopPx,
  topTitleMeasurePx,
  topTitleSlotCount,
  topTitleTextShadow,
} from './topTitleClock.js'
import type { TopTitleGlyph } from './topTitleClock.js'

/**
 * `top-title`, his "text overlay 5.0" — up to two lines of bold sans at the top
 * left of the shot, arriving one CHARACTER at a time over a soft black shadow.
 *
 * Every number lives in `topTitleClock.ts`, measured there against his own
 * clip on the shot's clock.
 *
 * ####################################################################
 * # THERE IS NOT ONE LITERAL NUMBER IN THIS FILE, ON PURPOSE.         #
 * # Every size, position, colour, shadow and frame comes from the     #
 * # clock, the same shape `ChapterTitle.tsx` and `NameCard.tsx` keep. #
 * # A number typed here is a number no fast test can reach and no     #
 * # width gate upstream can mirror.                                   #
 * ####################################################################
 *
 * ####################################################################
 * # THE PHOTOGRAPH, THEN THE HOUSE GRADE, THEN THE TYPE. THIS DEVICE  #
 * # MOUNTS THE GRADE ITSELF, AND THAT IS HIS "COLOR" NOTE.            #
 * #                                                                   #
 * # Until 2026-09-17 `Scene` drew the house grade over the finished   #
 * # device, type included. Measured on a still over his own picture,  #
 * # that did two things to his cream that his clip never does:        #
 * #                                                                   #
 * #   saturate(0.88) cooled it     his #FFFCE8, ours read #FEFEEE     #
 * #   the vignette greyed it       "Elder" read #F2F2E2, his E is     #
 * #                                flat cream, because the top left   #
 * #                                is where the vignette is darkest   #
 * #                                                                   #
 * # A flat colour cannot undo a vignette, which darkens by position.  #
 * # So the grade goes UNDER the type: the photograph gets exactly the #
 * # tone curve, toe, grain and vignette every other shot gets, from   #
 * # the scene's own `grade`, and the words sit over it the way his    #
 * # sit over his picture. The registry says `carriesOwnGrade: true`   #
 * # so `Scene` does not stack a second grade on top.                  #
 * ####################################################################
 *
 * THE TYPEFACE IS NOTO SANS BOLD, registered by `useBodyFaceBold()` under
 * `BODY_FACE_FAMILY` at weight 700. It is inlined, so it cannot miss a network
 * fetch, and `HighlightPage.tsx` already puts the same file in the bundle.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. The face hook holds the render
 * until the font is ready and changes nothing a frame reads, which is the same
 * exception `ChapterTitle.tsx` and `NameCard.tsx` already take.
 */

/**
 * The beat's own picture, the scene's grade, then the two slots the schema
 * declares for `top-title`. `line2` may be ''.
 */
export type TopTitleProps = {
  src: string
  grade: GradeSettings
  line1: string
  line2: string
  /**
   * The plan's push on the picture alone. Absent draws the picture untouched.
   * See `PictureMove`. It goes on the `<Img>` and never on the `Grade` above
   * it, whose grain and vignette must stay put.
   */
  pictureMove?: PictureMove
}

function Line({
  glyphs,
  baselinePx,
  slotCount,
  measurePx,
  frame,
}: {
  glyphs: readonly TopTitleGlyph[]
  baselinePx: number
  slotCount: number
  measurePx: number
  frame: number
}): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        left: TOP_TITLE_TYPE.leftPx,
        /*
          POSITIONED BY ITS BASELINE, which is what was measured off his frames.
          `top = baseline - fontSize` is the obvious reading and it is wrong; it
          has shipped once in this repository. See `TOP_TITLE_BASELINE_OVER_EM`.
        */
        top: topTitleLineTopPx(baselinePx),
        /* Title-safe, derived from the compositor's own two constants. */
        width: measurePx,
        textAlign: 'left',
        fontFamily: BODY_FACE_FAMILY,
        fontWeight: TOP_TITLE_TYPE.fontWeight,
        fontSize: TOP_TITLE_TYPE.fontSizePx,
        letterSpacing: TOP_TITLE_TYPE.letterSpacingPx,
        lineHeight: TOP_TITLE_TYPE.lineHeight,
        color: TOP_TITLE_TYPE.colour,
        textShadow: topTitleTextShadow(),
        /* So a run of spaces keeps its width, which is what the gate measures. */
        whiteSpace: 'pre',
      }}
    >
      {glyphs.map((glyph) => (
        /*
          ONE INLINE SPAN PER CHARACTER, AND ONLY `opacity` ANIMATES.

          INLINE, NOT INLINE-BLOCK, so the line is still set as one run: the
          tracking and the advances are the ones the gate sums. Opacity moves no
          layout, so nothing shifts as later characters arrive, and his own
          glyphs hold their boxes to the pixel through the whole build.

          The shadow is inherited, so a half-drawn character carries a
          half-drawn shadow, which is what his frames show.
        */
        <span
          key={String(glyph.slot)}
          style={{ opacity: topTitleCharacterOpacity(frame, glyph.slot, slotCount) }}
        >
          {glyph.text}
        </span>
      ))}
    </div>
  )
}

export function TopTitle({ src, grade, line1, line2, pictureMove }: TopTitleProps): ReactNode {
  useBodyFaceBold()
  const frame = useCurrentFrame()

  /*
    ONE COUNT ACROSS BOTH LINES, with the break taking a slot, so the reveal does
    not restart on line 2. See `TOP_TITLE_BREAK_SLOTS`.
  */
  const slotCount = topTitleSlotCount(line1, line2)
  const measurePx = topTitleMeasurePx(FRAME_WIDTH, SAFE_AREA_X)

  return (
    /* NO GROUND COLOUR. The beat's photograph IS the ground and it is the first child. */
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/*
        THE BEAT'S OWN PHOTOGRAPH, FULL FRAME AND FIRST. Cover rather than
        contain, so the frame is filled whatever the asset's aspect is.
        `SourcedImg`, never remotion's `Img`, which does not retry a slow fetch.
      */}
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...pictureMoveStyle(pictureMove, frame) }}
      />

      {/* THE HOUSE GRADE, ON THE PICTURE AND UNDER THE TYPE. See the box above. */}
      <Grade grade={grade} />

      {/*
        THE WHOLE TITLE'S FADE, one layer over both lines, so a character's drawn
        opacity is this times its own. That product is what his frames measure.
      */}
      <AbsoluteFill style={{ opacity: topTitleBlockOpacity(frame) }}>
        <Line
          glyphs={topTitleGlyphs(line1, TOP_TITLE_FIRST_SLOT)}
          baselinePx={TOP_TITLE_TYPE.line1BaselinePx}
          slotCount={slotCount}
          measurePx={measurePx}
          frame={frame}
        />
        {/*
          AN EMPTY `line2` OMITS ITS BLOCK ENTIRELY, NOT JUST ITS TEXT.

          `!== ''` rather than truthiness, for the reason `P12.tsx` gives: the
          day a slot widens to `string | number`, `{line2 && …}` prints a bare 0.
          `line1` is never empty: `deviceText(28)` refuses one.
        */}
        {line2 !== '' && (
          <Line
            glyphs={topTitleGlyphs(line2, topTitleLine2FirstSlot(line1))}
            baselinePx={TOP_TITLE_TYPE.line2BaselinePx}
            slotCount={slotCount}
            measurePx={measurePx}
            frame={frame}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
