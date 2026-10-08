import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY, TEXT_CARD } from '../constants.js'
import { FRAMED_CARD, framedCardCaptionReveal, framedCardWindow } from './framedCardClock.js'

/**
 * The framed card — a window opening over a photograph, with a caption wiping in.
 *
 * Built from the client's own sixth reference animation, at 0:28 of the
 * `Templates (Unseperated)` video he sent on 2026-08-19. Every number lives in
 * `framedCard.ts` and is pinned by a measured table in `framedCard.test.ts`.
 *
 * ####################################################################
 * # THIS IS INERT AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.      #
 * #                                                                   #
 * # Nothing in `Root.tsx`, `index.ts` or `Scene.tsx` imports it, so   #
 * # it is not in the webpack graph, not in `bundleHash`, and cannot   #
 * # reach a frame of a delivered film. `bundleHash` is `hashDirectory`#
 * # over the webpack OUTPUT (`bundle.ts:363`), not over the source    #
 * # tree, which is why an unreferenced file costs nothing.            #
 * #                                                                   #
 * # It exists to be rendered on its own by the clip harness and sent  #
 * # to the client for approval. Wiring it into the compositor is a    #
 * # separate job with a render-key entry, and it invalidates every    #
 * # cached segment the moment it lands.                               #
 * ####################################################################
 *
 * WHY THE SHAPE IS WHAT IT IS. The window and the picture are two elements, not
 * one. The picture is a fixed 1130x727 box that never changes; the window is an
 * `overflow: hidden` parent whose width and top edge animate. That is what makes
 * this read as curtains opening rather than as a zoom, and it is measured — the
 * reference shows a pure translation with no scale term. See the box in
 * `framedCard.ts`.
 *
 * This borrows its structure from `ArchivePlate.tsx:63-98`, which is the same
 * idea standing still: a fixed-size image inside a clipping box, with the border
 * drawn as a sibling ABOVE the image so the crop cannot eat it. That component
 * is pinned to one height by `ARCHIVE_PLATE`, so it is not reused directly here
 * — four of the client's nine references want a plate at four different sizes,
 * and widening those tokens into props is the refactor that should happen when
 * the second one is built, not speculatively now.
 */

/** The ground. Flat, no gradient and no texture, which the reference confirms. */
const GROUND = TEXT_CARD.baseColor

/** White in the reference. Kept as the house off-white — see the note below. */
const CAPTION_COLOR = TEXT_CARD.headlineColor

/**
 * 42px of cap height in the reference. `OVERLAY_CAP_EM` is 0.756 for this
 * family, so 42 / 0.756 is 56.
 */
const CAPTION_FONT_SIZE = 56

/** Measured off the reference: the caption's ink sits 93px off the frame bottom. */
const CAPTION_BOTTOM = 93

export function FramedCard({
  src,
  caption,
}: {
  src: string
  caption: string
}): ReactNode {
  const frame = useCurrentFrame()
  const window = framedCardWindow(frame)
  const reveal = framedCardCaptionReveal(frame)

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      {/*
        The aperture. Absolutely positioned rather than flex-centred, because its
        TOP EDGE is animated and a flex parent would re-centre it every frame,
        which cancels exactly the motion this device is made of.
      */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: window.top,
          width: window.width,
          height: window.height,
          marginLeft: -window.width / 2,
          overflow: 'hidden',
        }}
      >
        {/*
          The picture. Fixed pixel width and height, centred inside the aperture
          by the same negative-margin trick, so the aperture's edges travel across
          a picture that never moves relative to the frame.

          NO PERCENTAGE, deliberately: a percentage would hand the size to the
          layout and let the picture grow with the aperture, which is the one
          mistake that makes this device read as a zoom.

          `objectFit: 'cover'` IS REQUIRED AND WAS ADDED AFTER LOOKING AT A REAL
          RENDER. Without it the browser stretches the source to the box, and a
          960x1700 portrait squashed into 1130x727 is a severe distortion that
          nothing in this repository can see — jsdom computes no layout, and every
          declaration was exactly as intended. `cover` does not fight the fixed
          box, it only decides how the source fills it, which is what every crop
          mode in `Scene.tsx` already does.
        */}
        <Img
          src={src}
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            width: FRAMED_CARD.window.widthTo,
            height: FRAMED_CARD.window.height,
            marginLeft: -FRAMED_CARD.window.widthTo / 2,
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/*
          NO RULE AND NO ROUNDED CORNERS, and both are the client's call rather
          than an omission.

          The first build carried a hairline white rule, borrowed from
          `ArchivePlate.tsx:90-97` where it is drawn above the image so the crop
          cannot eat it. He watched the clip and asked for it gone, so the
          picture now sits on the ground with nothing drawn around it. A test
          asserts the absence, because a rule is exactly what a later polish
          pass puts back.

          If a corner radius is ever wanted it belongs HERE, on the aperture,
          not on the image. Any radius the client sees today is baked into the
          photograph itself — the Qumran slide carries its own black mount.
        */}
      </div>

      {/*
        The caption, omitted entirely when empty rather than rendered blank.

        An empty block still occupies its line box under the picture, which reads
        as a layout bug on a delivered frame. `P12.mount.test.tsx` records the
        same finding, and the mount test here counts elements for that reason.
      */}
      {caption === '' ? null : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: CAPTION_BOTTOM,
            textAlign: 'center',
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            fontSize: CAPTION_FONT_SIZE,
            color: CAPTION_COLOR,
            whiteSpace: 'nowrap',
            /*
              A travelling clip over finished type, which slices letters through
              the middle. NOT a per-character opacity ramp — `Overlay.tsx`'s
              `Note` is that, and its own header argues at length that the two
              are different devices. The reference is unambiguously this one.
            */
            clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  )
}
