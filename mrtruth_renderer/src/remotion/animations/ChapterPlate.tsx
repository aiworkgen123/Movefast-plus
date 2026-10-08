import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { pictureMoveStyle } from '../KenBurns.js'
import type { PictureMove } from '../KenBurns.js'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FRAME_WIDTH, SAFE_AREA_X, SERIF_FAMILY } from '../constants.js'
/*
 * THE HALO, FROM THE FILE THAT HOLDS ITS FIT. `TOP_TITLE_SHADOW` was fitted
 * from the client's own clips and `CHAPTER_PLATE_HALO_GLOW` is that shape
 * deepened and fitted to this device's cap, so both live beside the fit table
 * rather than being copied here. `CornerLabel.tsx` reaches into the same file
 * for the same reason, and `topTitleClock.js` is already in the compositor's
 * closure through `TopTitle.tsx`, so this costs the bundle nothing.
 */
import { chapterPlateTextShadow } from './topTitleClock.js'
import {
  CHAPTER_PLATE_GROUP_TRANSFORM_ORIGIN,
  CHAPTER_PLATE_RULE,
  CHAPTER_PLATE_RULE_TOP_PX,
  CHAPTER_PLATE_RULE_TRANSFORM_ORIGIN,
  CHAPTER_PLATE_TYPE,
  chapterPlateCapHeightPx,
  chapterPlateGroupOpacity,
  chapterPlateGroupScale,
  chapterPlateHeadingFontSizePx,
  chapterPlateHeadingTopPx,
  chapterPlateRuleScaleX,
} from './chapterPlateClock.js'

/**
 * `chapter-plate`, the client's "chapter title v2" — a centred serif heading
 * over the beat's own photograph, with a solid ochre rule under it that wipes
 * rightward out of its own left end, the pair of them fading up and growing
 * into place together on ONE group scale and ONE group opacity.
 *
 * His fourth reference clip of 2026-09-14, `chapter title v2.mp4`. Every number
 * lives in `chapterPlateClock.ts`, measured off that clip and pinned there.
 * THIS FILE CONTAINS NO NUMBER OF ITS OWN except the 2 that turns one margin
 * into two, below.
 *
 * ####################################################################
 * # IT IS A SECOND STYLE, NOT A RESTYLE OF `chapter-title`.           #
 * #                                                                   #
 * # a3 paints its own black ground and its warped grid and draws no   #
 * # photograph. This one is set OVER the shot in both of his samples, #
 * # and `DEVICE_REGISTRY['chapter-plate']` says so: `pictures: 1`,    #
 * # `pictureSource: 'ownScene'`. The two ids carry two caps, which is #
 * # the only shape that puts a title on a seventh detected spot.      #
 * ####################################################################
 *
 * ####################################################################
 * # THE PHOTOGRAPH IS DRAWN HERE, AS THE FIRST CHILD, AND THAT CLOSES #
 * # THE GAP THIS FILE USED TO CARRY.                                  #
 * #                                                                   #
 * # The device is specified to draw the beat's own picture full frame #
 * # under this type, and the registry agrees: `pictures: 1`,          #
 * # `pictureSource: 'ownScene'`. The props now open with `src`, which #
 * # is that picture already resolved to a URL, and it is drawn at     #
 * # cover as the FIRST child below so the type composites over it.    #
 * #                                                                   #
 * # `SourcedImg`, NEVER remotion's `Img`. The wrapper is the only     #
 * # place the retry budget lives, and one slow storage fetch through  #
 * # a bare `Img` fails the whole segment. `ShadowUp.tsx` is the house #
 * # exemplar for this exact shape and this file copies it.            #
 * #                                                                   #
 * # NO GROUND COLOUR AND NO BAND. THE GROUND IS ON THE GLYPHS.        #
 * #                                                                   #
 * # The picture is still the ground and nothing here paints a plate, a #
 * # flat tone or a box. The heading carries                            #
 * # `chapterPlateTextShadow(capPx)` — `TOP_TITLE_SHADOW` with three    #
 * # stacked centred glows over it, fitted to the size this heading is  #
 * # really set at — which is what makes `typeOverPicture: 'scrim'`     #
 * # true instead of merely declared. `DeviceFrame` still mounts        #
 * # `Grade` over all of it.                                            #
 * #                                                                   #
 * # A BAND SHIPPED HERE FOR ONE DAY AND CAME BACK, exactly as it did   #
 * # on `corner-label`. It measured 3.36:1 on beat 28 while darkening   #
 * # 416,052 pixels of the census page and taking a shot the client had #
 * # ALREADY ACCEPTED — beat 57's turquoise lake — from 220 grey to     #
 * # 144 across a horizontal stripe. The halo measures 3.96:1 and       #
 * # darkens 238,417, of which only 13,302 hold no letter at all. The   #
 * # client's own reference for this device sets a heading over a       #
 * # BUSIER printed page with no band anywhere on the frame. The        #
 * # numbers and the provenance are on                                  #
 * # `DEVICE_REGISTRY['chapter-plate'].scrimAlpha`, which is now the    #
 * # measured CREDIT of this halo rather than an alpha anything paints. #
 * #                                                                   #
 * # THIS FILE READS NO REGISTRY ROW and has no `@vg/core` import at    #
 * # all. The depth arrived as a constant from the registry for one day #
 * # and was a constant 0.55 on every shot in the film; it was then     #
 * # solved per shot for one day more. Neither survived a clip.         #
 * ####################################################################
 *
 * ####################################################################
 * # ONE LINE, AND IT SHRINKS TO FIT. IT USED TO OVERFLOW.             #
 * #                                                                   #
 * # The client ruled on 2026-09-16, in writing: "Shrink long titles   #
 * # to fit. I would say maximum 25 character titles might be good     #
 * # limit."                                                           #
 * #                                                                   #
 * # HIS SECOND SAMPLE WAS ALWAYS THE EVIDENCE THAT HIS DEVICE DOES    #
 * # THIS, and this comment used to say so and then say the width      #
 * # table needed to build it did not exist. It does now:              #
 * # `chapterPlateClock.ts` carries Playfair's own advances at the 700 #
 * # instance, and `chapterPlateHeadingFontSizePx` sets a heading at   #
 * # the largest size that lands inside the 1728px title-safe box.     #
 * # Run his own 23-character sample through it and it comes back at   #
 * # 0.8253 of the settled size, against the 0.828 his own two ink     #
 * # boxes give. That is his device, not an approximation of it.       #
 * #                                                                   #
 * # NOTHING IS TRUNCATED AND NOTHING WRAPS. `whiteSpace: 'nowrap'` is #
 * # still deliberate: the rule is pinned at y 610 by measurement, so  #
 * # a second line would be drawn straight through it. A heading that  #
 * # would have to be set below `CHAPTER_PLATE_MIN_CAP_HEIGHT_PX` is   #
 * # refused in `packages/core/src/chapterPlateFit.ts` and never       #
 * # reaches this file at all.                                         #
 * #                                                                   #
 * # THE LAYOUT IS STILL DONE ONCE. The size is a function of the      #
 * # HEADING, not of the frame, so the line is laid out at one size    #
 * # for the whole shot and the group transform below scales the       #
 * # finished raster exactly as it did before.                         #
 * ####################################################################
 *
 * IT IS A PURE FUNCTION OF `frame` AND ITS PROP. `useCurrentFrame` is the only
 * hook here — the typeface is registered by `useDocumentaryFont()` on `Scene`'s
 * first line, as it is for every template — because segments are cached by a
 * hash of the PLAN, and anything not derived from the frame and the props would
 * let that cache serve a frame nobody drew.
 */

/**
 * The title-safe measure, derived and never typed.
 *
 * `FRAME_WIDTH - 2 * SAFE_AREA_X` = 1728px, the same derivation
 * `captions.test.ts` and `constants.ts` already make. The 2 is one margin on
 * each side, not a measurement.
 */
const TITLE_SAFE_WIDTH_PX = FRAME_WIDTH - 2 * SAFE_AREA_X

export function ChapterPlate({
  src,
  heading,
  pictureMove,
}: {
  src: string
  heading: string
  /** The plan's push on the picture alone. Absent draws the picture untouched. See `PictureMove`. */
  pictureMove?: PictureMove
}): ReactNode {
  const frame = useCurrentFrame()

  /*
    THE ONE SIZE THIS HEADING IS SET AT, AND IT IS A FUNCTION OF THE WORDS
    RATHER THAN OF THE FRAME.

    Read once here and used twice below, for the `fontSize` and for the line
    box's `top` — which has to follow it, because the top is derived so that
    the BASELINE lands on the measured 594 whatever the size is. Calling the
    clock twice would be the same number; binding it says the two are one
    decision.

    NOT a hook and not state. `chapterPlateHeadingFontSizePx` is pure over the
    heading, so this stays a pure function of `frame` and its props, which is
    what lets a segment be cached by a hash of the plan.
  */
  const headingFontSizePx = chapterPlateHeadingFontSizePx(heading)

  /*
    `.length > 0`, NOT truthiness, for the reason `P05.tsx` and `P12.tsx` give:
    the day this prop widens to `string | number`, `{heading && …}` prints a
    bare 0 onto the frame.

    THE RULE GOES WITH IT. It is not copy and it is not a slot, but it is the
    heading's underline, and an ochre bar 1716px long with nothing over it is
    exactly the defect the empty-block rule exists for — a block drawing its
    own backing with no words in it. The schema refuses an empty heading
    anyway (`deviceText` is `.min(1)`), so this is belt and braces.
  */
  if (heading.length === 0) return null

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/*
        THE BEAT'S OWN PHOTOGRAPH, FULL FRAME AND FIRST, so every box below is
        composited over it. Cover rather than contain, so the frame is filled
        whatever the asset's aspect is. `SourcedImg`, never remotion's `Img`.
      */}
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...pictureMoveStyle(pictureMove, frame) }}
      />

      {/*
        THE GROUP, AND IT IS THE WHOLE REASON THIS FILE GAINED A WRAPPER. IT
        CARRIES TWO THINGS NOW, THE SCALE AND THE FADE.

        His heading and his rule are ONE thing that grows from about three
        quarters size into place over two and a half seconds, and fades up
        together over the first twelve frames. Measured two independent ways on
        both of his clips; the boxes on `CHAPTER_PLATE_GROUP` carry the fit and
        its residuals.

        ####################################################################
        # A TRANSFORM ON A WRAPPER IS NOT A LAYOUT CHANGE, AND THAT IS THE #
        # WHOLE TRICK. READ THIS BEFORE MOVING THE SCALE ANYWHERE ELSE.    #
        #                                                                   #
        # Everything inside still carries its measured frame coordinates,  #
        # unchanged, and is laid out ONCE: same `top`, same `left`, same   #
        # `width`, same `fontSize`, on every frame of the build. The       #
        # browser lays the line out at the settled size and then the       #
        # compositor scales the finished raster. No glyph is re-shaped and #
        # no line is re-broken, so every box below is where it was before  #
        # this wrapper existed, and `scale(1)` from frame 75 on is an      #
        # identity.                                                        #
        #                                                                   #
        # AND THE SETTLED PIXELS ARE NOW CHECKED RATHER THAN DISCLAIMED.   #
        # This comment used to say the byte-for-byte question was one for  #
        # a still and not for jsdom, and to go check one. One was checked: #
        # frame 90 rendered through `scripts/look-still.ts` is byte for    #
        # byte identical before and after this wrapper gained its opacity  #
        # and the heading lost its span.                                   #
        #                                                                   #
        # The alternative — animating `fontSize`, or a `width`, or the     #
        # box positions — is a layout change on every frame. It would      #
        # re-break the line, re-hint the glyphs and re-derive the rule's   #
        # top from a moving baseline, and the one thing this device cannot #
        # afford is its geometry drifting: every number in it is a         #
        # measurement off his frame.                                       #
        #                                                                   #
        # THE PICTURE IS OUTSIDE THIS WRAPPER ON PURPOSE. His background   #
        # never moves in either sample. Since lever 4 (2026-09-19) it takes #
        # the plan's own slow push-in, Saku's 3-5% (`pictureMove`), but on   #
        # its OWN element: inside this wrapper it would scale from 0.765    #
        # and fade UP out of black at the head of every chapter, which is  #
        # a different film.                                                 #
        ####################################################################

        ####################################################################
        # THE FADE IS ON THIS ELEMENT, COVERING THE HEADING AND THE RULE,  #
        # AND IT USED TO BE ON THE HEADING'S SPAN ALONE. THE RULE DID NOT  #
        # FADE AT ALL, SO OUR BAR POPPED ON AT FULL OCHRE ON FRAME 1 WHILE #
        # HIS FADES UP WITH THE WORDS. That is the visible defect of the   #
        # six corrected on 2026-09-16 and the only one a viewer would      #
        # name. `CHAPTER_PLATE_GROUP.fadeEndFrame` carries the reading.    #
        #                                                                   #
        # THREE THINGS WERE CHECKED BEFORE PUTTING IT HERE, because        #
        # "opacity on the thing that already has a transform" is the       #
        # obvious move and obvious moves are how the last five defects     #
        # got in.                                                          #
        #                                                                   #
        # ONE. DOES ONE OPACITY ON THE WRAPPER COMPOSITE THE WAY TWO       #
        # SEPARATE ONES WOULD? A group opacity renders the subtree to its  #
        # own buffer and fades the buffer; per-element opacity fades each  #
        # element onto the backdrop. Those differ ONLY where the subtree's #
        # own elements overlap each other, because the overlap composites  #
        # at full alpha inside the buffer first. These two do not overlap: #
        # the heading's line box runs y 423.32 to 609.75 and the rule runs #
        # y 610 to 647, adjacent with a quarter pixel between them. So the #
        # two ways are the same picture, and the group is the one that     #
        # matches his, because his heading and his rule share one ramp.    #
        #                                                                   #
        # TWO. DOES OPACITY ON AN ELEMENT THAT ALREADY HAS A TRANSFORM     #
        # CHANGE STACKING OR RASTERISATION IN THE SETTLED FRAME? No. The   #
        # `transform` already makes this element a stacking context and    #
        # already gives it its own compositing path, so `opacity` adds no  #
        # NEW context and no new layer, and paint order is untouched: the  #
        # wrapper is still the picture's next sibling and still paints     #
        # over it. At the settled frame the value is exactly 1, which by   #
        # spec creates no stacking context and which engines skip the      #
        # transparency layer for outright. Checked rather than argued:     #
        # frame 90 is byte identical before and after.                     #
        #                                                                   #
        # THREE. WHAT HAPPENED TO THE SPAN THE FADE USED TO LIVE ON? It is #
        # GONE, deliberately, and it did not keep an opacity of its own.   #
        # Two nested opacities MULTIPLY — 0.5 inside 0.5 composites to     #
        # 0.25 — so leaving it would have made the words fade at the       #
        # square of the rate the rule fades at, which is a subtler wrong   #
        # than the one being fixed and much harder to see. Inheriting was  #
        # not an option either: `opacity` is not an inherited property,    #
        # a child that declares one multiplies rather than adopts. The     #
        # span existed only to carry that opacity — it was an              #
        # `inline-block` wrapping the whole single line of a `nowrap`      #
        # centred box, so it changed no layout — and with nothing left to  #
        # carry it is removed rather than left for the next reader to      #
        # explain. Frame 90 is byte identical without it.                  #
        ####################################################################
      */}
      <AbsoluteFill
        style={{
          transform: `scale(${String(chapterPlateGroupScale(frame))})`,
          transformOrigin: CHAPTER_PLATE_GROUP_TRANSFORM_ORIGIN,
          opacity: chapterPlateGroupOpacity(frame),
        }}
      >
        {/*
          ####################################################################
          # A BAND WASH SAT HERE, FIRST INSIDE THE GROUP, AND IT IS GONE.    #
          # RECORDED RATHER THAN SILENTLY DROPPED, because it was written    #
          # against a real defect and the next reader will otherwise         #
          # re-invent it.                                                     #
          #                                                                   #
          # WHAT THE BAND WAS FOR. The registry has declared                  #
          # `typeOverPicture: 'scrim'` for this device since 2026-09-14 and   #
          # this file drew nothing: that is what put "Cornplanter's land" on  #
          # a 1940 census form at 1.07:1 over nine tenths of its length, in a #
          # frame the developer sent back. TREATMENT-STANDARD.md line 108     #
          # makes owning the ground the house rule and this was one of only   #
          # two word devices in the film that owned none.                      #
          #                                                                   #
          # WHY A BAND WAS THE WRONG SHAPE FOR IT. Rendered and measured on   #
          # beat 28's own frame the band read 3.36:1 while darkening 416,052  #
          # pixels of the census page and leaving it at grey 160 where it was #
          # 244; the halo on the glyphs reads 3.96:1, darkens 238,417 and     #
          # leaves the page at 231. Of what the band darkened, 145,965 pixels #
          # held no letter at all, against the halo's 13,302. And on beat 57  #
          # — a shot the CLIENT HAS ALREADY ACCEPTED — even a per-shot depth  #
          # solved down to 0.37 took the turquoise lake from 220 to 144       #
          # across a horizontal stripe.                                        #
          #                                                                   #
          # AND THE HALO DELETES A WHOLE CLASS OF FAULT RATHER THAN RETUNING  #
          # IT, WHICH ONLY A CLIP SHOWS. The band needed its own clock, its   #
          # own sideways mask and its own landing, because a rectangle is at  #
          # full depth across the whole width from frame 12 while the type is #
          # still three quarters size and still fading up — and because its   #
          # bottom edge was only hidden where the ochre rule had already      #
          # wiped on. The halo is part of the glyph, so it arrives with the   #
          # glyph and scales with the group transform: the blur-over-cap      #
          # ratio is identical on every frame of the build, and the ground is #
          # at nothing on every frame that draws no letter, exactly rather    #
          # than nearly.                                                       #
          #                                                                   #
          # THE OCHRE RULE IS UNTOUCHED BY ALL OF IT. A wash deep enough to   #
          # rescue the heading dragged `#B77935` from 3.32:1 to 1.08:1, which #
          # is why the band had to stop at the bar's top edge; a halo cannot  #
          # reach the bar at all, so that constraint goes away rather than    #
          # being re-tuned. See `chapterPlateClock.ts`'s ground section.       #
          ####################################################################
        */}

        {/*
          Positioned by its BASELINE, which is what was measured, and centred
          inside the title-safe box rather than across the whole frame. The
          centre of that box IS the frame's centre, so the heading lands on his
          959.5 either way, and this one cannot start outside the safe margin.
        */}
        <div
          style={{
            position: 'absolute',
            left: SAFE_AREA_X,
            top: chapterPlateHeadingTopPx(headingFontSizePx),
            width: TITLE_SAFE_WIDTH_PX,
            textAlign: 'center',
            fontFamily: SERIF_FAMILY,
            fontWeight: CHAPTER_PLATE_TYPE.fontWeight,
            fontSize: headingFontSizePx,
            lineHeight: CHAPTER_PLATE_TYPE.lineHeight,
            color: CHAPTER_PLATE_TYPE.colour,
            /*
              THE GROUND, AND IT IS ON THE TYPE RATHER THAN UNDER IT.

              ####################################################################
              # FITTED TO THE SIZE THIS HEADING IS REALLY SET AT, WHICH IS THE   #
              # WHOLE DIFFERENCE FROM THE CORNER LABEL'S COPY OF THIS IDIOM.     #
              #                                                                   #
              # The heading shrinks to fit, so a blur typed in pixels would be a #
              # different fraction of the type on every heading and the credit   #
              # `DEVICE_REGISTRY['chapter-plate'].scrimAlpha` records would move #
              # with the COPY. `CHAPTER_PLATE_HALO_GLOW` is a RATIO of the cap   #
              # and its box carries the measurement that says the credit then    #
              # holds to within five thousandths across the whole shrink range.  #
              #                                                                   #
              # ON THE LINE BOX AND NOT ON A SPAN, for the reason the box below  #
              # gives about the fade: this device draws its heading as one       #
              # `nowrap` line with no per-character spans, so there is exactly   #
              # one element to declare it on, and declaring it here keeps this   #
              # file's rule that it types no number of its own.                  #
              #                                                                   #
              # IT CANNOT TOUCH THE OCHRE RULE. `text-shadow` is drawn from the  #
              # glyphs of this box only; the bar is a sibling `div` with a       #
              # background colour and no text in it.                             #
              ####################################################################
            */
            textShadow: chapterPlateTextShadow(chapterPlateCapHeightPx(headingFontSizePx)),
            /* One line, always. See the box above, a wrap lands on the rule. */
            whiteSpace: 'nowrap',
          }}
        >
          {/*
            NOTHING HERE CARRIES A FADE ANY MORE, AND THAT IS DELIBERATE.

            The heading used to sit in an `inline-block` span whose only job
            was an `opacity`. The fade covers the rule as well as the words,
            so it moved to the group wrapper above, and the span went with it:
            an opacity left here would MULTIPLY with the one above rather than
            be replaced by it. The long box on the wrapper has the reasoning.

            Nothing that affects LAYOUT animates. This box is laid out once,
            at the settled size, and the wrapper above only scales and fades
            the finished raster. No glyph is re-shaped and no line is re-broken
            across the whole build.
          */}
          {heading}
        </div>

        {/*
          THE RULE WIPES BY `transform`, NEVER BY `width`.

          Its box is the finished bar, 1716 by 37 at its measured place, and the
          only thing that moves is the scale. Animating the width instead would
          be a layout change on every frame.

          ####################################################################
          # THE ORIGIN IS THE BAR'S OWN LEFT EDGE, 0%, AND IT WAS 13% UNTIL  #
          # 2026-09-16. The 13% was the GROUP SCALE misread as a wipe        #
          # origin: his left edge really does travel 225px, but the group    #
          # dragging the whole bar leftward is what moves it, not this       #
          # `scaleX`. Take the group scale out and the fixed point solves to #
          # zero on both clips at every frame. See `originFraction`.         #
          #                                                                   #
          # A CENTRE-OUT WIPE IS STILL THE EASIEST THING HERE TO GET WRONG,  #
          # and it reads as a different device. The origin is now further    #
          # from the middle than it ever was, not closer.                    #
          ####################################################################
        */}
        <div
          style={{
            position: 'absolute',
            left: CHAPTER_PLATE_RULE.leftPx,
            top: CHAPTER_PLATE_RULE_TOP_PX,
            width: CHAPTER_PLATE_RULE.widthPx,
            height: CHAPTER_PLATE_RULE.heightPx,
            backgroundColor: CHAPTER_PLATE_RULE.colour,
            transform: `scaleX(${String(chapterPlateRuleScaleX(frame))})`,
            transformOrigin: CHAPTER_PLATE_RULE_TRANSFORM_ORIGIN,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
