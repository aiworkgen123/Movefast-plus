import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { PHOTO_POP, photoPopCard, photoPopGridScale } from './photoPopClock.js'
import { GRID_ANIMATION_PAINT, GRID_ANIMATION_VIGNETTE } from './warpedGridGeometry.js'
import { WarpedGrid } from './WarpedGrid.js'

/**
 * The photo pop — a landscape photograph that springs up from below the frame,
 * overshoots once, settles, and then drifts slowly larger over a warped grid.
 *
 * The client's ninth reference animation, at 0:42 of `Templates (Unseperated)`.
 * Every number lives in `photoPopClock.ts` and `warpedGridGeometry.ts`, pinned by
 * measurements there.
 *
 * ####################################################################
 * # INERT, AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.             #
 * #                                                                   #
 * # Nothing in `Root.tsx`, `index.ts` or `Scene.tsx` imports it, so   #
 * # it is not in the webpack graph and not in `bundleHash`, and it    #
 * # cannot reach a frame of a delivered film. It exists to be         #
 * # rendered on its own by the clip harness and shown to the client.  #
 * ####################################################################
 *
 * ####################################################################
 * # THIS IS THE ONLY ONE OF HIS NINE THAT CARRIES NO WORDS.           #
 * #                                                                   #
 * # That is why it was built first, and it is the thing to say when   #
 * # the clip goes out. Every other candidate would have shown him     #
 * # text typed by a human, so an approval would quietly promise a     #
 * # film that `verifySpokenMarks` (plan.ts) is built to refuse.       #
 * # Here what he watches is what the pipeline could actually make.    #
 * ####################################################################
 */

/** The grid is drawn on pure black, sampled off the reference. */
const GROUND = '#000000'

/** Measured at 2.2px by 50% crossings on all four sides. Rounded for a border. */
const CARD_STROKE_PX = 2

/** The far-field halo reaches zero at 32-33px; a CSS blur radius of ~26 matches. */
const GLOW_BLUR_PX = 26

export function PhotoPop({ src }: { src: string }): ReactNode {
  const frame = useCurrentFrame()
  const card = photoPopCard(frame)
  const gridScale = photoPopGridScale(frame)

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      <WarpedGrid
        scale={gridScale}
        blurStdDeviation={GRID_ANIMATION_PAINT.photoPop.blurStdDeviation}
        strokeWidth={GRID_ANIMATION_PAINT.photoPop.strokeWidth}
        strokeOpacity={GRID_ANIMATION_PAINT.photoPop.strokeOpacity}
        /* The falloff is per animation too. Take the row that matches the paint. */
        vignette={GRID_ANIMATION_VIGNETTE.photoPop}
        idPrefix="photo-pop"
      />

      {/*
        The card, positioned in absolute pixels rather than by a transform.

        `photoPopCard` returns left, top, width and height from ONE scale, so
        the four can never be computed from different frames by accident. That
        matters more here than usual because the card is growing on every single
        frame of the shot, including the ones that look frozen.
      */}
      <div
        style={{
          position: 'absolute',
          left: card.left,
          top: card.top,
          width: card.width,
          height: card.height,
          boxSizing: 'border-box',
          /*
            The stroke measures 2.2px by 50% crossings on all four sides, NOT
            the 3px an earlier reading gave — that reading was taken at a luma
            threshold low enough to sit inside the card's own halo. The raw
            pixels settle it: across the left border the luma runs 94, 93, 112,
            132, 155, 253, 242, 8, so only two pixels are near white.

            Square corners. Coverage-deficit integration gives a radius of 1.14,
            1.02 and 0.98px at three corners, so 0 or 1 matches and anything
            from 4px up is visibly wrong.
          */
          border: `${CARD_STROKE_PX}px solid #ffffff`,
          /*
            The glow is a Gaussian of sigma 11.15px dying to zero at 32-33px,
            NOT the 45px an earlier pass reported, plus a hard 2px directional
            band immediately outside the stroke that reads 205 above, 130 at the
            sides and 78 below. Two shadows: the tight directional one and the
            broad halo.
          */
          boxShadow: `0 -1px 2px rgba(255,255,255,0.80), 0 1px 2px rgba(255,255,255,0.31), 0 0 ${GLOW_BLUR_PX}px rgba(255,255,255,0.42)`,
          overflow: 'hidden',
        }}
      >
        {/*
          THE PHOTOGRAPH IS RIGIDLY PINNED TO THE CARD AND MUST NOT MOVE INSIDE
          IT. Measured by resampling the card interior onto a fixed grid and
          matching against the landing frame: the content offset never exceeds
          0.75px, and its sign alternates with no trend, so it is resampling
          noise rather than a move. Any Ken Burns inside this picture is wrong,
          and it is a move this film already makes 112 times elsewhere.

          `objectFit: 'cover'` IS REQUIRED, for the reason written at length in
          `FramedCard.tsx`. The card is 3:2 and a 16:9 source has to fill it.
          Without `cover` the browser stretches the source to the box, and
          nothing in this repository can see that — jsdom computes no layout.
          The reference's own crop is a centred 3:2 cover crop of a 16:9 image,
          keeping 87.0% of width, which is what `cover` does by default.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

/** Re-exported so the entry and the CLI cannot disagree about the length. */
export const PHOTO_POP_TOTAL_FRAMES = PHOTO_POP.totalFrames
