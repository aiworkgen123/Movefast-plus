import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { pictureMoveStyle } from '../KenBurns.js'
import type { PictureMove } from '../KenBurns.js'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY, FRAME_WIDTH, SAFE_AREA_X } from '../constants.js'
/*
 * THE HALO, FROM THE FILE THAT HOLDS ITS FIT. `TOP_TITLE_SHADOW` was fitted
 * from the client's own clips and `TYPE_HALO_GLOW` is that shape deepened, so
 * both live beside the fit table rather than being copied here.
 *
 * NO `@vg/core` IMPORT REMAINS IN THIS FILE. `DEVICE_REGISTRY` was here for the
 * wash's depth; there is no wash. `topTitleClock.js` is already in the
 * compositor's closure through `TopTitle.tsx`, so this costs the bundle nothing.
 */
import { cornerLabelTextShadow } from './topTitleClock.js'
import {
  CORNER_LABEL_BLOCK_TOP_PX,
  CORNER_LABEL_FIRST_SLOT,
  CORNER_LABEL_INNER_CORNER_INSET_PX,
  CORNER_LABEL_KICKER_FONT_SIZE_PX,
  CORNER_LABEL_KICKER_GAP_PX,
  CORNER_LABEL_LABEL_FONT_SIZE_PX,
  CORNER_LABEL_LABEL_TRACKING_CANCEL_PX,
  CORNER_LABEL_LABEL_TRACKING_PX,
  CORNER_LABEL_TYPE,
  cornerLabelCharacterOpacity,
  cornerLabelKickerFirstSlot,
  cornerLabelTitleSafeWidthPx,
} from './cornerLabelClock.js'

/**
 * `corner-label`, his "text overlay 6.0" — a bold sans line in capitals at the
 * top right of the shot, with a smaller, lighter capitals kicker under it, both
 * arriving one CHARACTER at a time.
 *
 * The client's fourth reference overlay of 2026-09-14, `text overlay 6.0`.
 * Every number lives in `cornerLabelClock.ts`, measured there against his own
 * clip and his own frames.
 *
 * ####################################################################
 * # THIS FILE DRAWS WITH NO NUMBER OF ITS OWN, ON PURPOSE. Every      #
 * # size, position, colour, tracking and frame comes from the clock,  #
 * # the same shape `ChapterTitle.tsx`, `NameCard.tsx` and             #
 * # `TopTitle.tsx` already keep. A number typed here is a number no   #
 * # fast `.test.ts` can reach and no width gate upstream can mirror.  #
 * # Even the zero that pins the inner block to the title-safe box's   #
 * # corner is named over there, as                                    #
 * # `CORNER_LABEL_INNER_CORNER_INSET_PX`.                             #
 * #                                                                   #
 * # THE ONE LITERAL LEFT IS THE `0` IN `label.length === 0` below,    #
 * # which is a count of characters and not a measurement.             #
 * # `ChapterPlate.tsx` carries the same one for the same test.        #
 * ####################################################################
 *
 * ####################################################################
 * # THE BLOCK IS ANCHORED AT `SAFE_AREA_X`, NOT AT HIS MEASURED 38px, #
 * # AND THIS IS A DELIBERATE DEPARTURE FROM THE REFERENCE.            #
 * #                                                                   #
 * # His own right edge lands 1920 - 1882 = 38px from the frame edge.  #
 * # `SPEC-measured.md` flags it rather than stating it flat: "right   #
 * # edge lands 38px from frame edge. That is inside the title-safe    #
 * # margin this project uses everywhere else. Check before copying    #
 * # it." `SAFE_AREA_X` is 96, so his 38 is 58px INSIDE the band every #
 * # caption, title and overlay in this film keeps.                    #
 * #                                                                   #
 * # A margin violation is not a look, it is a crop risk on any player #
 * # that overscans, and this film keeps one margin everywhere. So the #
 * # block's right edge is the title-safe box's own right edge —       #
 * # `FRAME_WIDTH - SAFE_AREA_X` — and the type sits 58px further in   #
 * # than his. `CORNER_LABEL_HIS_RIGHT_MARGIN_PX` keeps his 38 on the  #
 * # record next to the 96 that replaced it, and the mount test pins   #
 * # that the drawn anchor is the safe margin and NOT the 38.          #
 * #                                                                   #
 * # WHAT IS ANCHORED IS THE TEXT BOX'S EDGE, so the last glyph's own  #
 * # right side bearing (4.4px on his final H) sits inside it. The ink #
 * # therefore lands a few pixels further in again, never further out. #
 * ####################################################################
 *
 * ####################################################################
 * # LEFT-ALIGNED INSIDE A RIGHT-ANCHORED BLOCK, WHICH IS TWO BOXES    #
 * # AND NOT ONE, AND EACH ONE EARNS ITS PLACE.                        #
 * #                                                                   #
 * # OUTER   the title-safe box itself: `left: SAFE_AREA_X` and the    #
 * #         derived `FRAME_WIDTH - 2 * SAFE_AREA_X` wide, so its own  #
 * #         right edge IS the anchor and the band is derived rather   #
 * #         than a second copy of one number.                         #
 * # INNER   absolutely positioned on that box's top-right corner with #
 * #         no width, so it shrinks to fit the WIDER of the two lines #
 * #         and both lines then start at one shared left edge. That   #
 * #         is what his frame shows: his label runs x 1250..1882 and  #
 * #         his kicker x 1246..1493, left edges together, right edges #
 * #         389px apart.                                              #
 * #                                                                   #
 * # THE INNER BOX IS POSITIONED AND NOT `inline-block`, and that is   #
 * # the load-bearing part. An inline-block would be placed by the     #
 * # outer box's own line box, so its vertical position would depend   #
 * # on a strut and a `vertical-align` — and the whole device is       #
 * # placed by a MEASURED BASELINE. An absolutely positioned box takes #
 * # its top from `top` and nothing else.                              #
 * #                                                                   #
 * # A LABEL TOO LONG FOR THE BAND OVERFLOWS TO THE LEFT, not to the   #
 * # right, because the anchored edge is the right one. It leaves the  #
 * # safe margin on the far side rather than running off the frame,    #
 * # which is the better of the two failures. `white-space: pre` means #
 * # it cannot wrap out of trouble either: a second line would be      #
 * # drawn straight through the kicker, whose baseline is pinned by    #
 * # measurement. Overflowing the margin is a margin violation;        #
 * # wrapping into the kicker is a broken frame.                       #
 * ####################################################################
 *
 * ####################################################################
 * # IT DRAWS THE PHOTOGRAPH, FIRST, AND THE TYPE COMPOSITES OVER IT.  #
 * #                                                                   #
 * # The device is the beat's own picture full frame with this type    #
 * # over it, and `DEVICE_REGISTRY['corner-label']` says so:           #
 * # `pictures: 1`, `pictureSource: 'ownScene'`,                       #
 * # `typeOverPicture: 'scrim'`. The props now open with `src`, which  #
 * # is that picture already resolved to a URL, and it is drawn at     #
 * # cover as the FIRST child of the root below.                       #
 * #                                                                   #
 * # `SourcedImg`, NEVER remotion's `Img`, which does not retry a slow #
 * # storage fetch — one stalled asset would fail the whole segment.   #
 * # `ShadowUp.tsx` is the house exemplar for this exact shape and     #
 * # this file copies it, as `ChapterPlate.tsx` and `TopTitle.tsx` do. #
 * #                                                                   #
 * # NO GROUND COLOUR AND NO BAND. THE GROUND IS ON THE GLYPHS.        #
 * #                                                                   #
 * # The picture is still the ground and nothing here paints a flat    #
 * # tone, a plate or a box. Each character carries                     #
 * # `cornerLabelTextShadow()` — `TOP_TITLE_SHADOW` with two stacked    #
 * # centred glows over it — which is what makes                        #
 * # `typeOverPicture: 'scrim'` true instead of merely declared.        #
 * #                                                                   #
 * # A BAND SHIPPED HERE FOR ONE DAY AND CAME BACK. It measured 3.65:1  #
 * # and darkened 135,023 pixels of a smooth sky; the halo measures     #
 * # 4.54:1 and darkens 20,050. The client's own reference for this     #
 * # device sets type over a busier page with no band at all. The       #
 * # numbers and the provenance are on                                  #
 * # `DEVICE_REGISTRY['corner-label'].scrimAlpha`, which is now the     #
 * # measured CREDIT of this halo rather than an alpha anything paints. #
 * #                                                                   #
 * # The house grade still draws over all of it, as it always did.      #
 * ####################################################################
 *
 * THE TYPEFACE IS REGISTERED BY `useDocumentaryFont()` ON `Scene`'s FIRST LINE,
 * the same as every template that sets `FONT_FAMILY`. Nothing is loaded here.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. `useCurrentFrame` is the only
 * hook it may have, for the reason `P12.tsx` gives: segments are cached by a
 * hash of the PLAN, so anything not derived from the frame and the props would
 * let that cache serve a frame nobody drew.
 */

/**
 * The beat's own picture, then the two slots the schema declares for
 * `corner-label`. `kicker` may be ''.
 */
export type CornerLabelProps = {
  src: string
  label: string
  kicker: string
  /** The plan's push on the picture alone. Absent draws the picture untouched. See `PictureMove`. */
  pictureMove?: PictureMove
}

function Line({
  text,
  firstSlot,
  fontSizePx,
  fontWeight,
  letterSpacingPx,
  marginRightPx,
  marginTopPx,
  frame,
}: {
  text: string
  firstSlot: number
  fontSizePx: number
  fontWeight: number
  /** Undefined where the line carries none, so no declaration is written at all. */
  letterSpacingPx: number | undefined
  marginRightPx: number | undefined
  marginTopPx: number | undefined
  frame: number
}): ReactNode {
  return (
    <div
      style={{
        marginTop: marginTopPx,
        /*
          Cancels `letter-spacing`'s trailing step on the tracked line, so the
          LAST GLYPH's advance edge lands on the anchor instead of one step
          inside it. See `CORNER_LABEL_LABEL_TRACKING_CANCEL_PX`.
        */
        marginRight: marginRightPx,
        textAlign: 'left',
        fontFamily: FONT_FAMILY,
        fontSize: fontSizePx,
        fontWeight,
        letterSpacing: letterSpacingPx,
        lineHeight: CORNER_LABEL_TYPE.lineHeight,
        color: CORNER_LABEL_TYPE.colour,
        /*
          HIS LINES ARE CAPITALS AND THE COPY IS NOT. Upper-casing in CSS rather
          than in JavaScript keeps the DOM text the planner's own words, which
          is what the empty-slot rule and the "prints nothing of its own" test
          both read. Anything MEASURING this device has to measure the
          upper-cased string, and the schema's comment on `corner-label` says so.
        */
        textTransform: 'uppercase',
        /*
          THE GROUND, AND IT IS ON THE TYPE RATHER THAN UNDER IT.

          ####################################################################
          # ON THE LINE AND NOT ON EACH SPAN, WHICH IS NOT TIDINESS.          #
          #                                                                   #
          # `text-shadow` INHERITS, and the per-character spans below carry   #
          # an `opacity` that fades a character in. A shadow declared on the  #
          # span would be composited with that span's own alpha, which is     #
          # what a viewer wants; declared here it is inherited by each span   #
          # and drawn inside it, which is the SAME picture and one            #
          # declaration instead of one per glyph. Checked rather than argued: #
          # a shadow on an element with `opacity` fades with the element,     #
          # because opacity applies to the element's finished raster.         #
          #                                                                   #
          # A SPACE SPAN DRAWS NO SHADOW, because a space has no ink to cast  #
          # one, which is exactly why the gate's one-letter window can land   #
          # on a gap with almost no stroke in it. That case was measured:     #
          # "New York" and "Iron Ridge" are the two labels in the credit      #
          # table on `corner-label.scrimAlpha` and they read 0.685 and 0.760  #
          # against the worst case of 0.568.                                  #
          ####################################################################
        */
        textShadow: cornerLabelTextShadow(),
        /*
          So the space spans keep their width instead of collapsing, and so a
          long line cannot wrap into the kicker. See the box above.
        */
        whiteSpace: 'pre',
      }}
    >
      {[...text].map((character, index) => (
        /*
          ONE INLINE-BLOCK SPAN PER CHARACTER, INDEXED ACROSS THE WHOLE DEVICE.

          ####################################################################
          # ONLY `opacity` ANIMATES, AND NOTHING MOVES AT ALL.                #
          #                                                                   #
          # Tracked frame by frame through his build, the drawn ink of each   #
          # band holds one fixed left edge and one fixed row range on every   #
          # frame — the label at x 1250 and y 210..265 from its first         #
          # character to its last. Only the right-hand edge advances, and it  #
          # advances in whole-glyph steps. So the line is laid out ONCE and   #
          # characters appear in place; there is no measured travel to        #
          # animate, and inventing one would be inventing a number.           #
          #                                                                   #
          # The span is `inline-block` regardless, because that is what keeps #
          # the guarantee: no character can shift as later ones arrive.       #
          ####################################################################
        */
        <span
          key={`${character}-${String(index)}`}
          style={{
            display: 'inline-block',
            opacity: cornerLabelCharacterOpacity(frame, firstSlot + index),
          }}
        >
          {character}
        </span>
      ))}
    </div>
  )
}

export function CornerLabel({ src, label, kicker, pictureMove }: CornerLabelProps): ReactNode {
  const frame = useCurrentFrame()

  /*
    `.length === 0`, NOT truthiness, for the reason `P05.tsx` and `P12.tsx`
    give: the day this prop widens to `string | number`, `{label && …}` prints
    a bare 0 onto the frame.

    THE WHOLE DEVICE GOES WITH AN EMPTY LABEL, not just the label's block. A
    kicker on its own is not this device — it is a stray date line in the top
    right corner with nothing above it, and its own place is measured from the
    label's. The schema refuses an empty label anyway (`deviceText(18)` is
    `.min(1)`), so this is belt and braces.
  */
  if (label.length === 0) return null

  return (
    /*
      NO GROUND COLOUR HERE AND NO BOX ANYWHERE. The beat's photograph IS the
      ground and it is the first child below; a fill on the root would paint
      over it. The type's own ground travels on the glyphs — see the box on the
      `textShadow` in `Line` above — so there is nothing here that could cover
      the frame even by accident.
    */
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/*
        THE BEAT'S OWN PHOTOGRAPH, FULL FRAME AND FIRST, so the label and its
        kicker are composited over it. Cover rather than contain, so the frame
        is filled whatever the asset's aspect is. `SourcedImg`, never `Img`.
      */}
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...pictureMoveStyle(pictureMove, frame) }}
      />

      {/*
        THE TITLE-SAFE BOX. Its right edge is the anchor, and it is derived
        from the compositor's own two constants rather than typed as 1728.
      */}
      <div
        style={{
          position: 'absolute',
          left: SAFE_AREA_X,
          /*
            POSITIONED BY THE LABEL'S BASELINE, which is what was measured off
            his frames. `top = baseline - fontSize` is the obvious reading, it
            is wrong, and it has shipped once in this repository. See the box
            on `CORNER_LABEL_BASELINE_OVER_EM`.
          */
          top: CORNER_LABEL_BLOCK_TOP_PX,
          width: cornerLabelTitleSafeWidthPx(FRAME_WIDTH, SAFE_AREA_X),
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: CORNER_LABEL_INNER_CORNER_INSET_PX,
            right: CORNER_LABEL_INNER_CORNER_INSET_PX,
            textAlign: 'left',
          }}
        >
          {/*
            ####################################################################
            # A WASH DIV SAT HERE FOR ONE DAY AND IS GONE, AND SO IS THE        #
            # `position: relative` WRAPPER WHOSE ONLY JOB WAS TO STOP IT        #
            # PAINTING OVER THE TWO LINES. Both are recorded rather than        #
            # silently dropped, because both were written against real defects. #
            #                                                                   #
            # WHAT THE BAND WAS FOR. The registry has declared                  #
            # `typeOverPicture: 'scrim'` for this device since 2026-09-14 and   #
            # this file drew nothing: that is what put the word ALLEGHENY on a  #
            # 0.97 sky at 1.04:1 for its first three letters, in a frame the    #
            # developer sent back. TREATMENT-STANDARD.md line 108 makes owning  #
            # the ground the house rule and this was one of only two word       #
            # devices in the film that owned none.                              #
            #                                                                   #
            # WHY A BAND WAS THE WRONG SHAPE FOR IT. Rendered and measured on   #
            # beat 1's own frame the band read 3.65:1 while darkening 135,023   #
            # pixels of a perfectly smooth sky, two thirds of which held no     #
            # type at all. The halo on the glyphs reads 4.54:1 and darkens      #
            # 20,050. The client's own reference for this device sets a heading #
            # over a BUSIER printed page with no band at all. The full table,   #
            # the client's own measurements and the provenance are on           #
            # `DEVICE_REGISTRY['corner-label'].scrimAlpha`.                      #
            #                                                                   #
            # AND THE HALO DELETES A WHOLE CLASS OF FAULT RATHER THAN RETUNING  #
            # IT. The band needed its own clock, because a fixed gradient       #
            # painted at full depth from frame 0 while ALLEGHENY's first letter #
            # did not land until frame 29 of 79 — a grey shape on a smooth sky  #
            # with nothing in it, for 0.97 seconds. Even with the clock it      #
            # still painted up to 38 levels of grey on bare sky for about nine  #
            # frames before the first letter, because the ramp ENDS on that     #
            # letter and so must start before it. The halo is part of the glyph #
            # so it arrives with the glyph: there is nothing to time, and the   #
            # ground is at nothing on every frame that draws no letter, exactly #
            # rather than nearly.                                               #
            #                                                                   #
            # WHY THE `position: relative` WENT WITH IT. CSS paints POSITIONED  #
            # boxes after in-flow ones whatever the DOM order, so the           #
            # absolutely positioned wash written as the block's first child     #
            # landed ON TOP of the two plain flow lines and drew ALLEGHENY as   #
            # dark olive letters under a grey panel. The wrapper put the lines  #
            # in the same painting step as the wash, where DOM order does       #
            # decide. With no positioned sibling left there is nothing for it   #
            # to out-paint, and a wrapper that does nothing is a wrapper the    #
            # next reader has to explain.                                       #
            ####################################################################
          */}
          <Line
            text={label}
            firstSlot={CORNER_LABEL_FIRST_SLOT}
            fontSizePx={CORNER_LABEL_LABEL_FONT_SIZE_PX}
            fontWeight={CORNER_LABEL_TYPE.label.fontWeight}
            letterSpacingPx={CORNER_LABEL_LABEL_TRACKING_PX}
            marginRightPx={CORNER_LABEL_LABEL_TRACKING_CANCEL_PX}
            marginTopPx={undefined}
            frame={frame}
          />
          {/*
            ####################################################################
            # AN EMPTY `kicker` OMITS ITS BLOCK ENTIRELY, NOT JUST ITS TEXT.    #
            #                                                                   #
            # An empty block still holds a line of height and its own 9.3px     #
            # top margin, and it would still widen nothing while taking its     #
            # stagger slots with it.                                            #
            #                                                                   #
            # `!== ''` rather than truthiness, for the reason `P12.tsx` gives:  #
            # the day a slot widens to `string | number`, `{kicker && …}`       #
            # prints a bare 0 on the frame. The schema already spells this slot #
            # `z.union([z.literal(''), deviceText(14)])`, so '' is the value it #
            # really arrives as.                                                #
            #                                                                   #
            # THE LABEL CANNOT MOVE WHEN IT GOES: the label is first in flow    #
            # and the gap belongs to the kicker's own block.                    #
            ####################################################################
          */}
          {kicker !== '' && (
            <Line
              text={kicker}
              firstSlot={cornerLabelKickerFirstSlot([...label].length)}
              fontSizePx={CORNER_LABEL_KICKER_FONT_SIZE_PX}
              fontWeight={CORNER_LABEL_TYPE.kicker.fontWeight}
              /* His kicker measures as Libre Franklin 500's own advances. */
              letterSpacingPx={undefined}
              marginRightPx={undefined}
              marginTopPx={CORNER_LABEL_KICKER_GAP_PX}
              frame={frame}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  )
}
