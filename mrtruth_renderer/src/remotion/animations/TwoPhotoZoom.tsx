import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import {
  CONDENSED_CAP_OVER_EM,
  CONDENSED_FACE_BASELINE_OVER_EM,
  CONDENSED_FAMILY,
  CONDENSED_STROKE_CAP_FRACTION,
  useCondensedFace,
} from './condensedFace.js'
import { TWO_PHOTO_ZOOM, twoPhotoZoomCard } from './twoPhotoZoomClock.js'
import { GRID_ANIMATION_PAINT, GRID_ANIMATION_VIGNETTE } from './warpedGridGeometry.js'
import { WarpedGrid } from './WarpedGrid.js'

/**
 * Two photographs side by side in thick white mounts, each with an orange label
 * chip beneath it. Both grow from nothing to full size together.
 *
 * The client's fourth reference animation, at 0:17 of `Templates (Unseperated)`.
 * Every number lives in `twoPhotoZoomClock.ts`, pinned by measurements there.
 *
 * ####################################################################
 * # NO LONGER INERT, AND THE OLD HEADER HERE WAS STALE FOR A WHOLE    #
 * # DELIVERED FILM.                                                    #
 * #                                                                   #
 * # It said "INERT, AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.    #
 * # Nothing in `Root.tsx`, `index.ts` or `Scene.tsx` imports it."     #
 * # `DeviceFrame.tsx:8` imports it and `:241` draws it, and V49 drew  #
 * # it THREE times, at 208.6s, 387.4s and 453.0s. Both of the things  #
 * # the old header called impossible are now built: stage 1c writes   #
 * # the two labels, and `DeviceFrame` hands in a companion picture.   #
 * #                                                                   #
 * # A stale "this is inert" box is worse than no box, because it      #
 * # tells the next reader that nothing here reaches a client.         #
 * ####################################################################
 *
 * ####################################################################
 * # THE ORANGE WASH IS DELIBERATELY NOT BUILT.                        #
 * #                                                                   #
 * # The reference carries a full-frame orange flash over its first    #
 * # second — entering at frame 8, peaking at 16, gone in one step at  #
 * # 40. That is 32 of its 129 frames and the loudest thing in the     #
 * # opening.                                                          #
 * #                                                                   #
 * # It is left out because it measures at 24fps against the 30fps of  #
 * # everything else in the shot, which means it was composited in     #
 * # afterwards rather than being part of the template. Building it in #
 * # would give every clip this device ever makes somebody else's      #
 * # transition. His own note for a4 does not mention it.              #
 * #                                                                   #
 * # It is HIS call, not ours, so it is a line in the message rather   #
 * # than a silent omission. Adding it later is cheap; taking it back  #
 * # out of a hundred delivered shots is not.                          #
 * ####################################################################
 */

/** Pure black, sampled off the reference at luma 3.0. */
const GROUND = '#000000'

/**
 * The label face. IT IS NOW HIS FACE, AND A DELIVERED FILM IS WHY.
 *
 * ####################################################################
 * # THE STAND-IN SHIPPED A DEFECT. THIS IS WHAT IT LOOKED LIKE.       #
 * #                                                                   #
 * # The old note here predicted the chip would grow "from 54% of the  #
 * # card's width to about 85%" and accepted that. Measured off the    #
 * # DELIVERED V49 MP4, at y=735, it goes further than that:           #
 * #                                                                   #
 * #   208.6s  left 763px, right 850px against a 720px card, so the    #
 * #           right chip overhangs its own photograph by 18%          #
 * #   387.4s  532px and 684px, the only correct one of the three      #
 * #   453.0s  ONE UNBROKEN ORANGE RUN, 1694px, x=108 to x=1801        #
 * #                                                                   #
 * # At 453.0s the two chips have grown into each other and painted a  #
 * # single bar reading NOT GAZING AT NOTHING BEHOLDING SOMETHING,     #
 * # with no way to tell which label belongs to which photograph. Two  #
 * # chips is the whole device. `handoff/now.md` recorded these three  #
 * # pairs as "all readable"; two of them are not.                     #
 * #                                                                   #
 * # THE CAUSE WAS NEVER THE CHIP RULE, IT WAS THE FACE. The chip is   #
 * # ink plus padding by measurement (`twoPhotoZoomClock.ts`), which   #
 * # is correct and stays. Libre Franklin 800 sets 70% wider than the  #
 * # reference, so ink plus padding on the wrong ink overruns.         #
 * #                                                                   #
 * # WHY THE FONT APPROVAL THIS FILE WAS WAITING ON IS NOT NEEDED.     #
 * # The old note deferred pending a font example from the client and  #
 * # warned that a new woff2 in `apps/web/public` would move           #
 * # `bundleHash`. Neither applies now:                                 #
 * #                                                                   #
 * #   1. `condensedFace.ts` already vendors Bebas Neue INLINE as      #
 * #      base64, so no file is added to `public` and no new bytes     #
 * #      enter `publicDir` at all.                                     #
 * #   2. `condensedFace.ts` writes the licence as "a4, a7 and a8 are  #
 * #      set in a condensed face he chose". THIS DEVICE IS a4         #
 * #      (`devices.ts` gives its `officialFileName` as               #
 * #      `a4_two-photo-zoom.mp4`). a7 and a8 already import the face  #
 * #      and both already draw in the film, so the film bundle        #
 * #      carries these bytes today. a4 was inside that licence from   #
 * #      the day it was written and was simply never wired.           #
 * #                                                                   #
 * # The face stays confined to reproducing HIS reference chips. It    #
 * # does not become the film's own type, which is what `fonts.ts`     #
 * # excludes and what that exclusion is actually about.               #
 * ####################################################################
 */
const LABEL_WEIGHT = 400

/**
 * The size that lands the caps on the reference's measured 42.91px.
 *
 * Bebas Neue's cap height is 0.700 em, read off the vendored file's own `OS/2`
 * table (`CONDENSED_CAP_OVER_EM`). The old code divided by Libre Franklin's
 * 0.72, so leaving that in place would set the caps 2.9% short.
 */
const LABEL_FONT_SIZE = TWO_PHOTO_ZOOM.chip.capHeight / CONDENSED_CAP_OVER_EM

/**
 * POSITIONED BY THE BASELINE, not by the top of the line box.
 *
 * ####################################################################
 * # THE OLD CODE PASSED `chip.paddingTop` STRAIGHT TO CSS, WHICH IS   #
 * # THE SAME NAIVE MOVE `condensedFace.ts` RECORDS AS ALREADY HAVING  #
 * # SHIPPED WRONG ONCE, AND IT IS FACE-DEPENDENT.                     #
 * #                                                                   #
 * # `paddingTop` 19.16 is measured CAP TOP to CHIP TOP. With          #
 * # `line-height: 1` the line box is one em tall and a face is taller #
 * # than its em, so CSS centres the overflow and the cap top does NOT #
 * # land on the box top. The error is the half-leading, and it is a   #
 * # different number for every face.                                  #
 * #                                                                   #
 * # So solve for the BASELINE, which is what the reference actually   #
 * # pins: baseline sits at `paddingTop + capHeight` = 62.07 below the #
 * # chip top, and at `fontSize * 0.800` below the line box top for    #
 * # this face. Subtract. GalleryStrip does the identical thing.       #
 * ####################################################################
 */
const LABEL_PADDING_TOP =
  TWO_PHOTO_ZOOM.chip.paddingTop +
  TWO_PHOTO_ZOOM.chip.capHeight -
  LABEL_FONT_SIZE * CONDENSED_FACE_BASELINE_OVER_EM

/**
 * Half the synthetic stroke, in screen px. FITTED AGAINST A REAL RENDER, and
 * the fit picks `outlineFit` for a4.
 *
 * ####################################################################
 * # `condensedFace.ts` CARRIES TWO FIGURES AND DISOWNS BOTH, asking   #
 * # for a per-animation fit rather than a shared constant. This is    #
 * # a4's fit, and the measurement is written out so the next reader   #
 * # can redo it rather than trust it.                                  #
 * #                                                                   #
 * # METHOD. Host render of this component at the plateau, frame 110,  #
 * # captions "Not gazing at nothing" and "Beholding something", which #
 * # are the two V49 actually delivered. White ink segmented by column #
 * # inside the left chip, each glyph's ink width divided by the       #
 * # measured cap height of 42.91.                                     #
 * #                                                                   #
 * # AGAINST `CONDENSED_FINGERPRINT.inkOverCap`, which was measured    #
 * # off HIS OWN FRAMES and therefore already contains his stroke:     #
 * #                                                                   #
 * #        his      ours     error                                     #
 * #   A  0.5575   0.5593   +0.0018                                     #
 * #   G  0.4932   0.4972   +0.0040                                     #
 * #   H  0.5082   0.5127   +0.0045                                     #
 * #   I  0.1926   0.1864   -0.0062                                     #
 * #   T  0.5111   0.5127   +0.0016                                     #
 * #                                                                   #
 * # Mean error +0.00114 cap heights, which is 0.05px at this size.    #
 * # A stroke moves ink by twice its own change, so the least-squares  #
 * # correction is 0.00057 and would take 0.0256 to 0.0250. That is    #
 * # far inside the error of thresholded, antialiased ink, so the      #
 * # honest result is that `outlineFit` IS a4's figure and the number  #
 * # stays where it is. `pixelFitLegacy` at 0.046 would set every      #
 * # glyph 0.04 cap heights too wide and is rejected by this fit.      #
 * #                                                                   #
 * # `WebkitTextStrokeWidth` is the TOTAL stroke and it straddles the  #
 * # outline, so ink grows by half of it on each side. Hence the       #
 * # doubling at the call site.                                        #
 * ####################################################################
 */
const LABEL_STROKE_PER_SIDE =
  TWO_PHOTO_ZOOM.chip.capHeight * CONDENSED_STROKE_CAP_FRACTION.outlineFit

/** One photograph in its mount, scaled about its own centre. */
function PhotoCard({ src, frame, side }: { src: string; frame: number; side: 'left' | 'right' }): ReactNode {
  const card = twoPhotoZoomCard(frame, side)

  // Nothing to draw before the ramp opens, and a zero-size box with a border
  // still paints a 48px white cross at the centre of each card.
  if (card.width <= 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: card.left,
        top: card.top,
        width: card.width,
        height: card.height,
        boxSizing: 'border-box',
        /*
          THE MOUNT SCALES WITH THE CARD. Measured border/scale is constant at
          24.0 across scales from 0.372 to 1.000, so at half size the mount
          really is 12px. `PhotoPop` uses a FIXED 2px stroke and copying that
          here is a twelvefold error at the start of the ramp.
        */
        border: `${TWO_PHOTO_ZOOM.card.borderPx * card.scale}px solid #ffffff`,
        /*
          SQUARE, and NO GLOW. Corner-pixel coverage measures 0.96-0.99, and the
          background reads 3.0 luma right up to the stroke. `PhotoPop` carries
          three box-shadows because a9's card genuinely glows at 205-213 well
          outside its edge. Copy that line here and you draw a halo on two
          cards for 109 frames that the reference does not have.
        */
        overflow: 'hidden',
      }}
    >
      {/*
        `objectFit: cover` for the reason `FramedCard.tsx` argues at length —
        jsdom computes no layout, so nothing in this repository can see a
        stretched photograph. Note the picture area here is 16:9 exactly, so a
        16:9 source fills it with NO crop, unlike a9's 3:2 card.

        The photograph is rigidly pinned to its mount. Correlating the card
        interior against the settled frame rises to 1.00000 with no positional
        offset needed, so any drift inside the picture is wrong.
      */}
      <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

/**
 * One orange label.
 *
 * ####################################################################
 * # IT IS A SIBLING OF THE CARD, NEVER A CHILD, AND IT IS SIZED FROM  #
 * # ITS OWN WORDS.                                                    #
 * #                                                                   #
 * # The chip sits at a FIXED absolute position for all 129 frames     #
 * # while the card grows up to it, so the gap between them falls from #
 * # 234px to 32px. Parent it to the card and it scales, which         #
 * # animates the one thing the client says is static.                 #
 * #                                                                   #
 * # And its width comes from its text. The two cards are both 720px   #
 * # while the two chips measure 388 and 408, and that 20px is exactly #
 * # the difference in the two labels' ink widths. So no explicit      #
 * # width here: padding plus `inline-block` and let it hug.           #
 * ####################################################################
 */
function Chip({ text, centreX, frame }: { text: string; centreX: number; frame: number }): ReactNode {
  const { chip, rampStartFrame } = TWO_PHOTO_ZOOM

  /*
   * ##################################################################
   * # THE CHIPS ARRIVE WITH THE CARDS. THE FIRST BUILD DREW THEM     #
   * # FROM FRAME 0 AND IT WAS ONLY VISIBLE BY LOOKING.               #
   * #                                                                 #
   * # Nothing in the clock or the tests could see it: the cards were  #
   * # correct to the pixel, the chips were correct to the pixel, and  #
   * # the render opened with two orange tags hanging in empty space   #
   * # for 20 frames with no photographs above them.                   #
   * #                                                                 #
   * # The reference has NO chips at its own frame 0 — zero pixels     #
   * # differ across its first eight frames, so they are definitively  #
   * # absent. They are at full colour by frame 40.                    #
   * #                                                                 #
   * # WHEN EXACTLY THEY APPEAR CANNOT BE MEASURED, and that is not a  #
   * # gap in the measuring. The orange wash white-outs the frame from #
   * # frame 8 to 39, and a grid line beside each chip, known to be at #
   * # constant opacity, has its own contrast crushed to 0.04 over the #
   * # same span and recovers on the same frame. The chip's apparent   #
   * # ramp is the wash's decay and cannot be separated from it.       #
   * #                                                                 #
   * # So frame 20 is a CHOICE, not a measurement: they come in on the #
   * # frame the cards start, which is the only defensible moment that #
   * # is inside the bracket the reference allows.                     #
   * ##################################################################
   */
  if (frame < rampStartFrame) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: centreX,
        top: chip.top,
        transform: 'translateX(-50%)',
        height: chip.height,
        boxSizing: 'border-box',
        paddingTop: LABEL_PADDING_TOP,
        paddingLeft: chip.paddingX,
        paddingRight: chip.paddingX,
        backgroundColor: chip.fill,
        borderRadius: chip.cornerRadius,
        color: chip.textColour,
        fontFamily: CONDENSED_FAMILY,
        fontWeight: LABEL_WEIGHT,
        fontSize: LABEL_FONT_SIZE,
        lineHeight: 1,
        letterSpacing: chip.capHeight * 0.0231,
        /*
          HIS FACE IS BEBAS NEUE PLUS A SYNTHETIC STROKE, not Bebas alone.
          Every glyph measured off his frames is wider than the real outline by
          a near-constant amount, which is what a stroke painted under the fill
          does and what a horizontal scale does not. See `condensedFace.ts`.
          The figure is fitted for THIS device against a real render, because
          that file refuses to hand out one number for all of them.
        */
        WebkitTextStrokeWidth: LABEL_STROKE_PER_SIDE * 2,
        WebkitTextStrokeColor: chip.textColour,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  )
}

export function TwoPhotoZoom({ srcs, captions }: { srcs: string[]; captions: string[] }): ReactNode {
  useCondensedFace()
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      {/*
        The grid is DEAD here — constant scale 1.000 for all 129 frames,
        verified rather than assumed at five rows clear of the cards. Reaching
        for `photoPopGridScale` would add a zoom the reference does not have.

        The blur is a4's own 1.27, not a9's 2.32. Same artwork, same stroke,
        same ink to within 0.6%, half the softness. At 2.32 every line draws at
        58 peak luma where the reference draws 96.
      */}
      <WarpedGrid
        scale={1}
        blurStdDeviation={GRID_ANIMATION_PAINT.twoPhotoZoom.blurStdDeviation}
        strokeWidth={GRID_ANIMATION_PAINT.twoPhotoZoom.strokeWidth}
        strokeOpacity={GRID_ANIMATION_PAINT.twoPhotoZoom.strokeOpacity}
        /* The falloff is per animation too. Take the row that matches the paint. */
        vignette={GRID_ANIMATION_VIGNETTE.twoPhotoZoom}
        idPrefix="two-photo-zoom"
      />

      <PhotoCard src={srcs[0] ?? ''} frame={frame} side="left" />
      <PhotoCard src={srcs[1] ?? ''} frame={frame} side="right" />

      <Chip text={captions[0] ?? ''} centreX={TWO_PHOTO_ZOOM.chip.leftCentreX} frame={frame} />
      <Chip text={captions[1] ?? ''} centreX={TWO_PHOTO_ZOOM.chip.rightCentreX} frame={frame} />
    </AbsoluteFill>
  )
}
