import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FRAME_WIDTH, SAFE_AREA_X, SERIF_FAMILY } from '../constants.js'
import {
  NAME_PLATE_ELEMENT,
  NAME_PLATE_NAME_BASELINE_PX,
  NAME_PLATE_NAME_FONT_SIZE_PX,
  NAME_PLATE_PLATE,
  NAME_PLATE_ROLE_BASELINE_PX,
  NAME_PLATE_ROLE_FONT_SIZE_PX,
  NAME_PLATE_TEAR_POLYGON,
  NAME_PLATE_TEXT_LEFT_PX,
  NAME_PLATE_TILT_DEGREES,
  NAME_PLATE_TILT_TRANSFORM_ORIGIN,
  NAME_PLATE_TYPE,
  NAME_PLATE_WIPE_TRANSFORM_ORIGIN,
  namePlateLineTopPx,
  namePlateMeasurePx,
  namePlateTextOpacity,
  namePlateWipeScaleX,
} from './namePlateClock.js'

/**
 * `name-plate`, his "text Overlay winton churchill" — a torn light plate at the
 * bottom left of the shot, wiping open, with a bold serif name on it and a
 * smaller serif role line under that.
 *
 * His fifth reference overlay of 2026-09-14. Every number lives in
 * `namePlateClock.ts`, measured against section 4 of
 * `tmp/v53/overlays/SPEC-measured.md` and against his own frames in
 * `tmp/v53/overlays/measure/name/`.
 *
 * ####################################################################
 * # THERE IS NOT ONE LITERAL NUMBER IN THIS FILE, ON PURPOSE.         #
 * # Every size, position, colour, angle and frame comes from the      #
 * # clock, the shape `ChapterPlate.tsx`, `TopTitle.tsx` and           #
 * # `NameCard.tsx` already keep. A number typed here is a number no   #
 * # fast test can reach and no width gate upstream can mirror.        #
 * ####################################################################
 *
 * ####################################################################
 * # IT SHIPS DISABLED, AND THE REASON IS NOT A BUG IN IT.             #
 * #                                                                   #
 * # `DEVICE_REGISTRY['name-plate']` carries `enabled: false` and      #
 * # `disabledReason: 'needs-external-fact'`. It prints a REAL         #
 * # PERSON'S NAME onto a photograph, which is the exposure that       #
 * # already disabled `name-card`: the client's own rule is that the   #
 * # face shown must not be the real one, and this script names living #
 * # scholars. The question was put to him in writing on 2026-08-23    #
 * # and is unanswered.                                                #
 * #                                                                   #
 * # SO THIS IS BUILT COMPLETE AND LEFT UNREACHABLE. Flipping          #
 * # `enabled` and adding it to `plannerLibrary` is the whole of the   #
 * # remaining work, the moment he answers. Do NOT flip it before.     #
 * ####################################################################
 *
 * ####################################################################
 * # THE PHOTOGRAPH IS DRAWN HERE, AS THE FIRST CHILD, AND THAT CLOSES #
 * # THE GAP THIS FILE USED TO CARRY.                                  #
 * #                                                                   #
 * # The device draws the beat's own picture full frame under this     #
 * # plate, and the registry agrees: `pictures: 1`, `pictureSource:    #
 * # 'ownScene'`, `typeOverPicture: 'opaquePlate'`. The props now open #
 * # with `src`, which is that picture already resolved to a URL, and  #
 * # it is drawn at cover as the FIRST child below, so the torn plate  #
 * # and both lines composite over it.                                 #
 * #                                                                   #
 * # `SourcedImg`, NEVER remotion's `Img`, which does not retry a slow #
 * # storage fetch — one stalled asset would fail the whole segment.   #
 * # `ShadowUp.tsx` is the house exemplar for this exact shape and     #
 * # this file copies it.                                              #
 * #                                                                   #
 * # NO GROUND COLOUR STILL. The picture is the ground, and the house  #
 * # grade stays ON: nothing here paints a tone of its own.            #
 * ####################################################################
 *
 * ####################################################################
 * # ONE LINE EACH, AND A LONG NAME RUNS PAST THE PLATE. STATED, NOT   #
 * # HIDDEN.                                                           #
 * #                                                                   #
 * # Both lines sit at ONE measured size, so their width is whatever   #
 * # the words are, and `whiteSpace: 'nowrap'` is deliberate: the two  #
 * # baselines are 49.95px apart by measurement, so a wrapped name     #
 * # would be drawn straight through the role line.                    #
 * #                                                                   #
 * # `namePlateMeasurePx` is the room a line actually has — 677px,     #
 * # the narrower of the plate's inner edge and title-safe. In         #
 * # `SERIF_FAMILY` at this size that is about 23 mixed-case           #
 * # characters, and his own "Winston Churchill" sets 519px wide.      #
 * # THE SCHEMA ADMITS 32 (`deviceText(32)`), so a long name           #
 * # overflows the plate onto the photograph. Fixing that properly     #
 * # needs a width gate upstream measuring the serif, the way          #
 * # `p05Fit.ts` gates P05 against the sans, and there is none.        #
 * ####################################################################
 *
 * THE TYPEFACE IS REGISTERED BY `useDocumentaryFont()` ON `Scene`'s FIRST LINE,
 * the same as every template that sets a family. Nothing is loaded here.
 *
 * IT IS A PURE FUNCTION OF `frame` AND ITS PROPS. `useCurrentFrame` is the only
 * hook it may have, for the reason `P12.tsx` gives: segments are cached by a
 * hash of the PLAN, so anything not derived from the frame and the props would
 * let that cache serve a frame nobody drew.
 */

/** The beat's own picture, then the two slots the schema declares for `name-plate`. */
export type NamePlateProps = { src: string; name: string; role: string }

/**
 * The title-safe measure, derived from the compositor's own two constants and
 * never typed. See the box on `namePlateMeasurePx` — the plate is the binding
 * constraint here, and the band is applied on top of it.
 */
const MEASURE_PX = namePlateMeasurePx(FRAME_WIDTH, SAFE_AREA_X)

function Line({
  text,
  baselinePx,
  fontSizePx,
  fontWeight,
  opacity,
}: {
  text: string
  baselinePx: number
  fontSizePx: number
  fontWeight: number
  opacity: number
}): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        left: NAME_PLATE_TEXT_LEFT_PX,
        /*
          POSITIONED BY ITS BASELINE, which is what was measured off his frames.
          `top = baseline - fontSize` is the obvious reading and it is wrong; it
          has shipped once in this repository. See the box on
          `NAME_PLATE_BASELINE_OVER_EM`.
        */
        top: namePlateLineTopPx(baselinePx, fontSizePx),
        width: MEASURE_PX,
        textAlign: 'left',
        fontFamily: SERIF_FAMILY,
        fontWeight,
        fontSize: fontSizePx,
        lineHeight: NAME_PLATE_TYPE.lineHeight,
        color: NAME_PLATE_TYPE.colour,
        /* One line, always. A wrap lands on the other line's baseline. */
        whiteSpace: 'nowrap',
      }}
    >
      {/*
        THE FADE IS ON AN INLINE-BLOCK SPAN AND IT IS ONLY `opacity`.

        Nothing that affects layout animates, so each line is laid out once and
        no glyph moves by so much as a subpixel across the whole build — which
        is what his own frames show: the ink's bounding box holds x 100..652 on
        every frame it is visible.
      */}
      <span style={{ display: 'inline-block', opacity }}>{text}</span>
    </div>
  )
}

export function NamePlate({ src, name, role }: NamePlateProps): ReactNode {
  const frame = useCurrentFrame()

  /*
    `.length > 0`, NOT truthiness, for the reason `P05.tsx` and `P12.tsx` give:
    the day this prop widens to `string | number`, `{name && …}` prints a bare 0
    onto the frame.

    THE PLATE GOES WITH THE NAME. It is not copy and it is not a slot, but a
    torn light plate 739px wide with no words on it is exactly the defect the
    empty-block rule exists for — a block drawing its own backing with nothing
    in it. The schema refuses an empty name anyway (`deviceText(32)` is
    `.min(1)`), so this is belt and braces.
  */
  if (name.length === 0) return null

  const textOpacity = namePlateTextOpacity(frame)

  return (
    /*
      NO GROUND COLOUR. The beat's photograph IS the ground and it is the first
      child below; a fill here would paint over it. See the box above.
    */
    <AbsoluteFill>
      {/*
        THE BEAT'S OWN PHOTOGRAPH, FULL FRAME AND FIRST, so the torn plate and
        both lines are composited over it. Cover rather than contain, so the
        frame is filled whatever the asset's aspect is. `SourcedImg`, never
        remotion's `Img`.
      */}
      <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/*
        THE TILT IS ON ITS OWN WRAPPER AND CARRIES THE PLATE ONLY.

        His plate sits about a seventh of a degree off level and his TYPE is
        level to a hundredth of a pixel across 550px of line — both measured.
        Putting the two transforms on one element would either tilt the words
        or lose the tilt, and putting the type inside this wrapper would tilt
        it too. So the type is a sibling, below.

        Two elements rather than one composed transform, because they want
        different origins: the tilt turns about the plate's centre and the wipe
        opens from a point outside its left edge.
      */}
      <div
        style={{
          position: 'absolute',
          left: NAME_PLATE_ELEMENT.leftPx,
          top: NAME_PLATE_ELEMENT.topPx,
          width: NAME_PLATE_ELEMENT.widthPx,
          height: NAME_PLATE_ELEMENT.heightPx,
          transform: `rotate(${String(NAME_PLATE_TILT_DEGREES)}deg)`,
          transformOrigin: NAME_PLATE_TILT_TRANSFORM_ORIGIN,
        }}
      >
        {/*
          THE PLATE WIPES BY `transform`, NEVER BY `width`.

          Its box is the finished plate at its measured place, and the only
          thing that moves is the scale. Animating the width instead would be a
          layout change on every frame, and it would also throw away the one
          thing this wipe is about: the origin is OUTSIDE the plate's left edge,
          so both edges travel and the right one races. A centre-out reveal
          reads as a different device.

          The torn outline is a `clip-path` on this same element, so the tear
          scales with the wipe exactly as his does.
        */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: NAME_PLATE_PLATE.colour,
            clipPath: NAME_PLATE_TEAR_POLYGON,
            transform: `scaleX(${String(namePlateWipeScaleX(frame))})`,
            transformOrigin: NAME_PLATE_WIPE_TRANSFORM_ORIGIN,
          }}
        />
      </div>

      <Line
        text={name}
        baselinePx={NAME_PLATE_NAME_BASELINE_PX}
        fontSizePx={NAME_PLATE_NAME_FONT_SIZE_PX}
        fontWeight={NAME_PLATE_TYPE.name.fontWeight}
        opacity={textOpacity}
      />

      {/*
        ####################################################################
        # AN EMPTY `role` OMITS ITS BLOCK ENTIRELY, NOT JUST ITS TEXT.      #
        #                                                                   #
        # `.length > 0` rather than truthiness, for the reason above. An    #
        # empty role `<div>` would still hold a line box 677px wide at the  #
        # role's own size, sitting on the plate where a reader expects      #
        # words — and it would keep the name's position honest only by      #
        # accident. The block goes, not only its text.                      #
        #                                                                   #
        # THE NAME DOES NOT MOVE WHEN IT GOES. Both baselines are absolute  #
        # and measured; see the box on `NAME_PLATE_ROLE_BASELINE_PX` for    #
        # why, and for what that leaves on the frame.                       #
        #                                                                   #
        # AND THE SCHEMA CANNOT SEND '' TODAY. `name-plate`'s `role` is     #
        # `deviceText(48)`, which is `.min(1)`. If the empty role is real,  #
        # the slot wants `corner-label`'s kicker shape,                     #
        # `z.union([z.literal(''), deviceText(48)])`, in `devices.ts` —     #
        # which belongs to another owner. This arm is correct either way.   #
        ####################################################################
      */}
      {role.length > 0 && (
        <Line
          text={role}
          baselinePx={NAME_PLATE_ROLE_BASELINE_PX}
          fontSizePx={NAME_PLATE_ROLE_FONT_SIZE_PX}
          fontWeight={NAME_PLATE_TYPE.role.fontWeight}
          opacity={textOpacity}
        />
      )}
    </AbsoluteFill>
  )
}
