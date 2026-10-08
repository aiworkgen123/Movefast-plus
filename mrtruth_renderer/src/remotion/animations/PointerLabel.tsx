import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY, TEXT_CARD } from '../constants.js'
import {
  POINTER_LABEL,
  pointerLabelArrow,
  pointerLabelCard,
  pointerLabelControl,
  pointerLabelLine,
  pointerLabelPhotoScale,
  quadraticLength,
} from './pointerLabelClock.js'

/**
 * The pointer label — a photograph, a small label card, and a line that draws
 * itself out of the card to land an arrowhead on the subject.
 *
 * The client's first reference animation, at 0:00 of `Templates (Unseperated)`.
 * Every number lives in `pointerLabelClock.ts`, pinned by measurements there.
 *
 * ####################################################################
 * # INERT, AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.             #
 * #                                                                   #
 * # Nothing in `Root.tsx`, `index.ts` or `Scene.tsx` imports it, so   #
 * # it is not in the webpack graph and not in `bundleHash`. It exists #
 * # to be rendered on its own by the clip harness and shown to the    #
 * # client. Wiring it into the compositor is a separate job.          #
 * ####################################################################
 *
 * ####################################################################
 * # THE ARROW POINTS AT `vision.subjectAnchor`, WHICH WE ALREADY HAVE #
 * #                                                                   #
 * # `AssetVisionSchema` records where the subject sits in every       #
 * # sourced photograph. It exists so the compositor can keep type     #
 * # CLEAR of the subject; here the same number is read the other way  #
 * # round and becomes the thing the arrow aims AT. No new model call. #
 * #                                                                   #
 * # `anchor` is a prop rather than read from a plan, because this     #
 * # component is a pure function of its inputs and the harness has no #
 * # plan. The planner supplies it when this is wired.                 #
 * ####################################################################
 */

const FRAME_W = 1920
const FRAME_H = 1080

/** The ground behind the photograph, seen only if the picture ever fails. */
const GROUND = TEXT_CARD.baseColor

/**
 * The label's face.
 *
 * The reference uses a heavy CONDENSED grotesque, which is not on disk and is
 * not something to fake with a horizontal squash — a synthesised condensed face
 * is the exact class of defect this project has a whole file of warnings about.
 * 800 is the heaviest weight registered under `FONT_FAMILY`
 * (`fonts.ts:104-107`), so the device reads as heavy in the film's own voice.
 * The client is already sending a font example, and that is the moment to
 * revisit this rather than now.
 */
const LABEL_WEIGHT = 800
const LABEL_FONT_SIZE = 46

export function PointerLabel({
  src,
  label,
  anchor,
}: {
  src: string
  label: string
  /** Where the subject is, as fractions of the frame. From `vision.subjectAnchor`. */
  anchor: { x: number; y: number }
}): ReactNode {
  const frame = useCurrentFrame()
  const scale = pointerLabelPhotoScale(frame)
  const card = pointerLabelCard(frame)
  const drawn = pointerLabelLine(frame)
  const arrow = pointerLabelArrow(frame)

  const { box } = POINTER_LABEL.card
  const cardLeft = box.left * FRAME_W
  const cardTop = box.top * FRAME_H
  const cardWidth = (box.right - box.left) * FRAME_W
  const cardHeight = (box.bottom - box.top) * FRAME_H

  const from = {
    x: POINTER_LABEL.line.from.x * FRAME_W,
    y: POINTER_LABEL.line.from.y * FRAME_H,
  }
  const to = { x: anchor.x * FRAME_W, y: anchor.y * FRAME_H }

  /*
   * One quadratic curve, bowed upward. The reference's line is not straight —
   * it leaves the card heading left and arrives heading down-left, which a
   * straight rule cannot do and which is most of why the device reads as drawn
   * by hand rather than generated.
   */
  const control = pointerLabelControl(from, to)
  const path = `M ${String(from.x)} ${String(from.y)} Q ${String(control.x)} ${String(control.y)} ${String(to.x)} ${String(to.y)}`

  /*
   * ##########################################################################
   * # THE DASH LENGTH IS THE PATH'S REAL LENGTH, AND IT HAS TO BE.           #
   * #                                                                        #
   * # This was `straight distance x 2` as a "safe over-estimate" and the      #
   * # client watched the result. An offset LARGER than the path draws         #
   * # nothing, so the guess of 657.8 against a true 357.5 left 45.7% of the   #
   * # window dead and gave the line 2.7 frames to travel instead of 5.        #
   * # Three visible steps. He said "slightly delay and not smooth".           #
   * #                                                                        #
   * # `quadraticLength` is sampled and pure, so it is checkable in a test.    #
   * # `getTotalLength()` would be exact but needs a laid-out element, and     #
   * # jsdom computes no layout, so nothing could have caught a regression.    #
   * ##########################################################################
   */
  const span = quadraticLength(from, control, to)

  const arrowSize = POINTER_LABEL.arrow.size * FRAME_W
  const heading = Math.atan2(to.y - control.y, to.x - control.x)

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      {/*
        The photograph, filling the frame and easing back from a slight crop.
        `transform: scale` on a frame-filling picture rather than a width change,
        so nothing reflows and the move stays on the compositor's cheap path.
      */}
      <AbsoluteFill style={{ transform: `scale(${String(scale)})` }}>
        <Img
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </AbsoluteFill>

      {/*
        Card, line and arrow are omitted ENTIRELY when there is no label. An
        empty white rectangle with a line running out of it is worse than no
        device at all, and it is what a "render it but blank" branch produces.
      */}
      {label === '' ? null : (
        <>
          {/*
            The leader line, drawn with a dash offset rather than faded.

            A fading line appears along its whole length at once and has no
            direction. This device is entirely about something travelling from
            the words to the thing being named, so it has to grow tip-first.
          */}
          <svg
            width={FRAME_W}
            height={FRAME_H}
            viewBox={`0 0 ${String(FRAME_W)} ${String(FRAME_H)}`}
            style={{ position: 'absolute', inset: 0 }}
          >
            <path
              d={path}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={span}
              style={{ strokeDashoffset: span * (1 - drawn) }}
            />

            {/*
              A barbed arrowhead, two strokes rather than a filled triangle,
              which is what the reference draws. It grows from nothing on its
              own clock once the line has stopped.
            */}
            {arrow === 0 ? null : (
              <g
                transform={`translate(${String(to.x)} ${String(to.y)}) rotate(${String((heading * 180) / Math.PI)}) scale(${String(arrow)})`}
              >
                <path
                  d={`M ${String(-arrowSize)} ${String(-arrowSize * 0.6)} L 0 0 L ${String(-arrowSize)} ${String(arrowSize * 0.6)}`}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </svg>

          {/* The label card. Arrives from the right and fades up. */}
          <div
            style={{
              position: 'absolute',
              left: cardLeft,
              top: cardTop,
              width: cardWidth,
              height: cardHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              fontFamily: FONT_FAMILY,
              fontWeight: LABEL_WEIGHT,
              fontSize: LABEL_FONT_SIZE,
              color: '#000000',
              whiteSpace: 'nowrap',
              opacity: card.opacity,
              transform: `translateX(${String(card.offsetX)}px)`,
            }}
          >
            {label}
          </div>
        </>
      )}
    </AbsoluteFill>
  )
}
