import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { BODY_FACE_BASELINE_OVER_EM, BODY_FACE_FAMILY, useBodyFace } from './bodyFace.js'
import {
  NAME_CARD_CARD,
  NAME_CARD_SHADOW,
  NAME_CARD_TYPE,
  nameCardGlyphOpacity,
  nameCardOpacity,
  nameCardScrimAlpha,
  nameCardSlideOffset,
} from './nameCardClock.js'

/**
 * a5, the person name card — a portrait plate that slides down onto a darkening
 * landscape, with a name and a role line typing on underneath it.
 *
 * The client's fifth reference animation, at 0:22 of `Templates (Unseperated)`.
 * Every number lives in `nameCardClock.ts`, pinned by measurements there.
 *
 * ####################################################################
 * # INERT, AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.             #
 * # `inert.test.ts` fails if anything the film bundles can reach it.  #
 * ####################################################################
 *
 * ####################################################################
 * # SAKU PUSHED `rembg` FOR THIS ONE AND IT IS NOT WHAT BLOCKS IT.    #
 * #                                                                   #
 * # The portrait is a plain rounded rectangle photograph with no      #
 * # border and no cutout. What actually blocks a5 reaching a film is  #
 * # TWO PHOTOGRAPHS ON ONE SHOT — `PlannedSceneSchema.asset` holds    #
 * # one asset or none — and the ROLE LINE, which is a written fact    #
 * # about a real person that no narration necessarily speaks.         #
 * ####################################################################
 */

/**
 * ####################################################################
 * # THE TYPEFACE IS NOTO SANS REGULAR. See `bodyFace.ts`.             #
 * #                                                                   #
 * # 0.28% per-glyph width error against his own frames with NO        #
 * # synthetic stroke, where the next best of sixteen candidates was   #
 * # 4.93% and Libre Franklin 8.54%. An earlier pass called this       #
 * # unidentifiable, having swept the host's faces and fifteen Google  #
 * # candidates without ever testing Noto Sans — which was sitting in  #
 * # this repo's own node_modules.                                     #
 * ####################################################################
 */
const CARD_FONT_FAMILY = BODY_FACE_FAMILY

function Line({
  text,
  line,
  frame,
}: {
  text: string
  line: 'name' | 'role'
  frame: number
}): ReactNode {
  const { baselinePx, fontSizePx, letterSpacingEm } = NAME_CARD_TYPE[line]

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        width: '100%',
        /*
          Positioned by its BASELINE, which is what was measured. The 0.888 is
          where the baseline actually sits in a `line-height: 1` box — see the
          box in `bodyFace.ts`, this shipped wrong once.
        */
        top: baselinePx - fontSizePx * BODY_FACE_BASELINE_OVER_EM,
        textAlign: 'center',
        fontFamily: CARD_FONT_FAMILY,
        fontWeight: 400,
        fontSize: fontSizePx,
        /*
          PER LINE, AND THE ROLE LINE'S IS DOUBLE THE NAME LINE'S. Budgeting
          one value for both puts role-line glyphs up to 8.4px out of position.
        */
        letterSpacing: `${String(letterSpacingEm)}em`,
        lineHeight: 1,
        color: NAME_CARD_TYPE.colour,
        whiteSpace: 'pre',
      }}
    >
      {[...text].map((character, index) => (
        /*
          ONE SPAN PER CHARACTER, INDEXED BY POSITION IN THE STRING.

          Only `opacity` animates — never anything that affects layout — so the
          line is laid out once and no glyph ever moves. That is what the
          reference does: each glyph's column range is byte-for-byte identical
          on every frame it is visible.

          Spaces get a span and consume a stagger slot, on both lines.
        */
        <span
          key={`${character}-${String(index)}`}
          style={{ display: 'inline-block', opacity: nameCardGlyphOpacity(line, frame, index) }}
        >
          {character}
        </span>
      ))}
    </div>
  )
}

export function NameCard({
  srcs,
  captions,
}: {
  /** Backdrop first, portrait second. NOT interchangeable — see the box below. */
  srcs: readonly string[]
  /** The name line first, the role line second. */
  captions: readonly string[]
}): ReactNode {
  useBodyFace()
  const frame = useCurrentFrame()

  /*
    ####################################################################
    # THE TWO PHOTOGRAPHS HAVE DIFFERENT JOBS AND THE ORDER MATTERS.    #
    #                                                                   #
    # `photoCountOf('name-card')` reads 2, the same as the two photo    #
    # cards, but there the pair is interchangeable and here it is not.  #
    # Swapping them puts a portrait full bleed behind a landscape in a  #
    # 593px plate, which renders at exit 0 and looks deliberate.        #
    ####################################################################
  */
  const backdrop = srcs[0] ?? ''
  const portrait = srcs[1] ?? ''
  const name = captions[0] ?? ''
  const role = captions[1] ?? ''

  const cardTop = NAME_CARD_CARD.restTop - nameCardSlideOffset(frame)
  const cardOpacity = nameCardOpacity(frame)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <Img
        src={backdrop}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/*
        A FLAT BLACK MULTIPLY OVER THE BACKDROP ONLY, ON ITS OWN RAMP.

        Not a blur, not a gradient, not a vignette. Fitted per frame, the
        additive term stays within 0.33 of zero, which is what makes it a
        multiply rather than a lift or a grade.

        It ramps over 27 frames, so the opening 0.9 seconds are the photograph
        at full brightness. A static overlay reads differently there.

        It sits ABOVE the backdrop and BELOW the card, because the card and its
        shadow are not darkened by it.
      */}
      <AbsoluteFill
        style={{ backgroundColor: '#000000', opacity: nameCardScrimAlpha(frame) }}
      />

      <div
        style={{
          position: 'absolute',
          left: NAME_CARD_CARD.left,
          top: cardTop,
          width: NAME_CARD_CARD.width,
          height: NAME_CARD_CARD.height,
          opacity: cardOpacity,
          borderRadius: NAME_CARD_CARD.cornerRadiusPx,
          /*
            The shadow travels and fades WITH the card, which is why it is on
            this element rather than being a fixed vignette. Proven by finding
            the identical decay profile 79px lower once the card has landed.

            A CSS blur radius is about twice the fitted Gaussian sigma.
          */
          boxShadow: `${String(NAME_CARD_SHADOW.offsetXPx)}px ${String(
            NAME_CARD_SHADOW.offsetYPx,
          )}px ${String(NAME_CARD_SHADOW.sigmaPx * 2)}px ${String(
            NAME_CARD_SHADOW.spreadPx,
          )}px rgba(0, 0, 0, ${String(NAME_CARD_SHADOW.peakAlpha)})`,
          overflow: 'hidden',
        }}
      >
        <Img
          src={portrait}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <Line text={name} line="name" frame={frame} />
      <Line text={role} line="role" frame={frame} />
    </AbsoluteFill>
  )
}
