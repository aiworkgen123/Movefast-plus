import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { ReactNode } from 'react'
import { FRAME_HEIGHT, FRAME_WIDTH } from '../constants.js'
import {
  BODY_FACE_BASELINE_OVER_EM,
  BODY_FACE_CAP_OVER_EM,
  BODY_FACE_FAMILY,
  useBodyFace,
} from './bodyFace.js'
import {
  CHAPTER_TITLE_TYPE,
  chapterTitleGlyphOpacity,
  chapterTitleGlyphRise,
  chapterTitleScale,
} from './chapterTitleClock.js'
import { GRID_ANIMATION_PAINT, GRID_ANIMATION_VIGNETTE } from './warpedGridGeometry.js'
import { WarpedGrid } from './WarpedGrid.js'

/**
 * a3, the chapter title — one line of type that arrives a letter at a time on
 * the warped grid, while the whole picture swells and settles back.
 *
 * The client's third reference animation, at 0:11 of `Templates (Unseperated)`.
 * Every number lives in `chapterTitleClock.ts` and `warpedGridGeometry.ts`.
 *
 * ####################################################################
 * # IN THE FILM SINCE 2026-09-11, AND DRAWN ONLY WHEN PLACED BY HAND. #
 * # `DeviceFrame.tsx` draws it for a heading the client approved in   #
 * # writing, placed through `operator-placements`. The tool never     #
 * # chooses it. See `PLACED_BY_OPERATOR_ONLY`.                        #
 * #                                                                   #
 * # The `bundleHash` cost is paid by the `DeviceFrame.tsx` edge,      #
 * # once, so the first film built with it re-renders whole.           #
 * ####################################################################
 *
 * ####################################################################
 * # THIS ONE DRAWS WORDS, AND THAT IS NOT A FREE THING TO SHOW HIM.   #
 * #                                                                   #
 * # a9 was built first because it carries no words at all, so an      #
 * # approval of it is one the pipeline can honour. a3 is the opposite #
 * # case: its entire content is editorial copy, and verifySpokenMarks #
 * # in `apps/worker/src/stages/plan.ts` deletes any caption whose     #
 * # words were not spoken in that shot. A title card goes around that #
 * # guard rather than through it.                                     #
 * #                                                                   #
 * # AND THERE IS A SECOND THING TO SAY. He asked on 2026-08-16 for    #
 * # the full-screen text scenes to go, and they were removed in v7.   #
 * # a3 is that device coming back. Send it with the question, not as  #
 * # a fait accompli.                                                  #
 * ####################################################################
 */

/** Sampled off his frame, and it is pure zero rather than a dark grey. */
const GROUND = CHAPTER_TITLE_TYPE.background

/**
 * ####################################################################
 * # THE TYPEFACE IS NOTO SANS, AND AN EARLIER NOTE HERE SAID IT WAS   #
 * # UNIDENTIFIABLE. See `bodyFace.ts` for the evidence: 0.28% width   #
 * # error against his own frames with no synthetic stroke, where the  #
 * # next best of sixteen candidates was 4.93% and Libre Franklin was  #
 * # 8.54%. It was in this repo's `node_modules` the whole time.       #
 * ####################################################################
 */
const TITLE_FONT_FAMILY = BODY_FACE_FAMILY

/**
 * Cap height is what was measured, so the size is derived from it.
 *
 * Noto Sans's cap is 714/1000 of its em, so the measured 92.36 cap wants a
 * 129.4 font-size. The ratio travels with the face in `bodyFace.ts`, so the two
 * can no longer drift apart.
 */
const FONT_SIZE_BASE_UNITS = CHAPTER_TITLE_TYPE.capHeightBaseUnits / BODY_FACE_CAP_OVER_EM

export function ChapterTitle({ caption }: { caption: string }): ReactNode {
  useBodyFace()
  const frame = useCurrentFrame()
  const scale = chapterTitleScale(frame)

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      <WarpedGrid
        scale={scale}
        blurStdDeviation={GRID_ANIMATION_PAINT.chapterTitle.blurStdDeviation}
        strokeWidth={GRID_ANIMATION_PAINT.chapterTitle.strokeWidth}
        strokeOpacity={GRID_ANIMATION_PAINT.chapterTitle.strokeOpacity}
        /* The falloff is per animation too. Take the row that matches the paint. */
        vignette={GRID_ANIMATION_VIGNETTE.chapterTitle}
        /*
          a3's darkening is fixed to the GRID, not to the screen, and the
          evidence is 2.25x in fit rms. a4 and a9 measure the other way, which
          is why this is a switch rather than a change to the component.
        */
        vignetteScalesWithGrid
        idPrefix="chapter-title"
      />

      {/*
        THE TYPE LIVES INSIDE THE SAME ZOOM AS THE GRID.

        Every other animation in this folder draws its type in screen space over
        a moving background. Here the words are scaled by the same transform as
        the lines: unscaled by the measured zoom, every glyph's size holds to
        0.3% and its position to half a pixel for all 150 frames.
      */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: `${FRAME_WIDTH / 2}px ${FRAME_HEIGHT / 2}px`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: FRAME_WIDTH,
            /*
              Positioned by its BASELINE, which is what was measured. The line
              box is placed so the baseline lands at 583.63 base units.
            */
            top:
              CHAPTER_TITLE_TYPE.baselineBaseUnits -
              FONT_SIZE_BASE_UNITS * BODY_FACE_BASELINE_OVER_EM,
            textAlign: 'center',
            fontFamily: TITLE_FONT_FAMILY,
            fontWeight: 400,
            fontSize: FONT_SIZE_BASE_UNITS,
            lineHeight: 1,
            color: CHAPTER_TITLE_TYPE.colour,
            whiteSpace: 'pre',
          }}
        >
          {(() => {
            /*
              INDEXED BY POSITION AMONG DRAWN GLYPHS, NOT IN THE STRING.

              A space is skipped rather than slotted. The first measurement of
              this animation said the opposite and this file was built to it;
              an adversarial re-measure by direct cross-correlation found the
              gap across the space is 0.725 frames against 0.615 to 0.900
              within words. No slot. See the box in `chapterTitleClock.ts`.

              Only `transform` and `opacity` animate, never anything that
              affects layout, so the line is laid out once and no glyph moves
              horizontally.
            */
            let drawn = -1
            return [...caption].map((character, index) => {
              const isSpace = character.trim() === ''
              if (!isSpace) drawn += 1
              const slot = drawn
              return (
                <span
                  key={`${character}-${String(index)}`}
                  style={{
                    display: 'inline-block',
                    transform: `translateY(${String(
                      isSpace ? 0 : chapterTitleGlyphRise(frame, slot),
                    )}px)`,
                    opacity: isSpace ? 1 : chapterTitleGlyphOpacity(frame, slot),
                  }}
                >
                  {character}
                </span>
              )
            })
          })()}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
