import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import {
  CONDENSED_FACE_BASELINE_OVER_EM,
  CONDENSED_FAMILY,
  useCondensedFace,
} from './condensedFace.js'
import {
  GALLERY_STRIP,
  GALLERY_STRIP_CARD_COUNT,
  galleryStripBlurSigma,
  galleryStripCardBox,
  galleryStripCardIsBlurred,
  galleryStripChipDrop,
  galleryStripChipOpacity,
  galleryStripOrdinal,
} from './galleryStripClock.js'
import { GRID_ANIMATION_PAINT, GRID_ANIMATION_VIGNETTE } from './warpedGridGeometry.js'
import { WarpedGrid } from './WarpedGrid.js'

/**
 * a8, the gallery filmstrip — four photographs welded into one horizontal strip
 * on the warped grid, with a camera that opens inside the last picture, pulls
 * out to see them all, tracks left, and slams into the first.
 *
 * The client's eighth reference animation, at 0:36 of `Templates (Unseperated)`.
 * Every number lives in `galleryStripClock.ts`, pinned by measurements there.
 *
 * ####################################################################
 * # INERT, AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.             #
 * # `inert.test.ts` fails if anything the film bundles can reach it.  #
 * ####################################################################
 *
 * ####################################################################
 * # THIS IS THE FIRST CONSUMER OF `condensedFace.ts`.                 #
 * #                                                                   #
 * # The Bebas Neue bytes have been vendored since 2026-08-22 and      #
 * # nothing has drawn with them — a4 still sets its chips in Libre    #
 * # Franklin 800 as an acknowledged stand-in. So the inert test's     #
 * # claim that no film-reachable file imports the condensed face is   #
 * # load-bearing from today rather than merely true by accident.      #
 * ####################################################################
 *
 * ####################################################################
 * # WHAT THE FILM CANNOT YET PRODUCE, AND IT IS ONE THING RATHER      #
 * # THAN THE USUAL TWO.                                               #
 * #                                                                   #
 * # FOUR PHOTOGRAPHS ON ONE SHOT. `PlannedSceneSchema.asset` holds    #
 * # one asset or none, so the plan has no shape to name four. The     #
 * # pictures themselves already exist — sourcing downloads and scores #
 * # several candidates per scene — but nothing can hand them over.    #
 * #                                                                   #
 * # THE WORDS ARE NOT A BLOCKER HERE, and a8 is the only one of his   #
 * # references besides a9 that can say that. The chips are ordinals   #
 * # this component generates from the index, so `verifySpokenMarks`   #
 * # has nothing to refuse. Five of his nine need written copy this    #
 * # pipeline cannot invent; a8 is not one of them.                    #
 * ####################################################################
 */

/**
 * One card: the mount, the photograph inside it, and the chip hanging below.
 *
 * ####################################################################
 * # THE CHIP IS INSIDE THIS GROUP ON PURPOSE, AND a4 DOES THE         #
 * # OPPOSITE ON PURPOSE.                                              #
 * #                                                                   #
 * # a4's chips sit at a fixed absolute position while the cards grow  #
 * # up to them, because a4's client note says the text is static.     #
 * # a8's chips ride the strip: fitting chip 4's height over 47 frames #
 * # spanning a 1.7x zoom, a pure child scores 0.234px where a fixed   #
 * # screen-pixel chip scores 11.482px, 49x worse.                     #
 * #                                                                   #
 * # Making it a child is also what puts the chip inside the BLUR,     #
 * # which is what the reference does — the blur covers the mount and  #
 * # the chip as well as the photograph.                               #
 * ####################################################################
 */
function Card({
  src,
  index,
  frame,
}: {
  src: string
  index: number
  frame: number
}): ReactNode {
  const { design } = GALLERY_STRIP
  const box = galleryStripCardBox(frame, index)

  /*
   * Off-frame cards are not drawn at all.
   *
   * At the plateau the camera holds 2.376 card-widths of a strip 4.059
   * card-widths long, so at most three of the four are ever co-visible and at
   * the two heroes only one is. This is a cheap win rather than a correctness
   * one — a browser clips them anyway — but a `filter: blur()` on an off-frame
   * card is a real rasterisation the compositor would otherwise do 150 times.
   */
  if (box.left > 1920 || box.left + box.width < 0) return null

  const blurred = galleryStripCardIsBlurred(frame, index)

  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        /*
          THE BLUR IS A ONE-FRAME SWITCH ON THE TWO MIDDLE CARDS, and it sits
          on this whole group so it covers the mount and the chip too.

          CSS `filter: blur(<length>)` takes the length AS the standard
          deviation, so this is sigma directly and not a radius. Chrome
          approximates the Gaussian with three box passes, which is one of the
          two reasons the grid's own opacity is a bracket rather than a number.
        */
        filter: blurred ? `blur(${String(galleryStripBlurSigma(frame))}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          /*
            THE MOUNT SCALES WITH THE CARD. Measured thickness over camera scale
            is constant at 19.8-19.9 across k = 1.00 to 2.24, so it really runs
            20px at the plateau and 44.7px at the heroes. `PhotoPop` uses a
            FIXED 2.2px stroke; copying that here is a 2.24x error at both ends.
          */
          border: `${String(design.borderPx * box.unit)}px solid ${GALLERY_STRIP.borderColour}`,
          borderRadius: design.outerCornerRadius * box.unit,
          /*
            NO GLOW AND NO SHADOW. Approaching a mount from outside, the ground
            reads 3.3 across 61px and then steps 5.03 to 225.09 in ONE pixel.
            a9's card genuinely glows and carries three box-shadows; copy that
            line here and you draw a halo on four cards for 150 frames.
          */
          overflow: 'hidden',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            /*
              `objectFit: cover` for the reason `FramedCard.tsx` argues at
              length — jsdom computes no layout, so nothing in this repository
              can see a stretched photograph.

              The picture area is 16:9 EXACTLY (1920 x 1080 design px), so a
              16:9 source fills it with no crop at all.

              The photographs are rigidly pinned inside their mounts. A
              three-parameter fit for a Ken Burns of their own returns the
              identity as the strict optimum at every one of seven plateau
              comparisons: under 0.25 picture px of travel and under 0.2% of
              scale across a 26-frame, 506px interval.
            */
            objectFit: 'cover',
            display: 'block',
            /*
              A BRACKET, NOT A MEASUREMENT. The inner corner is clearly
              non-zero and no more than 3.5 design px, and the photo content
              defeats every edge finder tried. CSS would give 0 here on its own,
              because a border box's inner radius is the outer minus the border
              width. At the plateau the whole bracket spans 1.4 screen px.
            */
            borderRadius: design.innerCornerRadius * box.unit,
          }}
        />
      </div>

      <Chip index={index} frame={frame} unit={box.unit} cardHeight={box.height} />
    </div>
  )
}

/**
 * One ordinal badge, positioned relative to its own card.
 *
 * ####################################################################
 * # ANCHORED TO THE CARD'S OUTER BOTTOM EDGE, NOT TO THE PICTURE, AND #
 * # 30% OF IT HANGS BELOW THE CARD.                                   #
 * #                                                                   #
 * # a4's chips clear their cards entirely and sit in open ground.     #
 * # a8's overlap: chip bottom is the card's outer bottom plus 50      #
 * # design px, and the chip is 166 tall, so 116 of it lies over the   #
 * # photograph.                                                       #
 * ####################################################################
 */
function Chip({
  index,
  frame,
  unit,
  cardHeight,
}: {
  index: number
  frame: number
  unit: number
  cardHeight: number
}): ReactNode {
  const { chip } = GALLERY_STRIP
  const opacity = galleryStripChipOpacity(frame)

  /*
   * Not drawn at all when it is invisible, rather than drawn at opacity 0.
   *
   * That covers local 0-4 at the head and local 108-149 at the tail — 42
   * frames, 1.400s, the ENTIRE final zoom-in and the whole hold. a4 shipped a
   * build that drew its chips from frame 0 and it was only ever visible by
   * looking; nothing in the clock or the tests could see it.
   */
  if (opacity <= 0) return null

  const drop = galleryStripChipDrop(frame) * unit
  const height = chip.height * unit
  const fontSize = chip.fontSize * unit

  return (
    <div
      style={{
        position: 'absolute',
        /*
          Centred on the card, measured to within 0.15 screen px at the plateau.
          `left: 50%` plus a half-width translate rather than an explicit left,
          so the chip cannot drift if the card's width changes.
        */
        left: '50%',
        transform: `translateX(-50%) translateY(${String(drop)}px)`,
        /* Chip bottom = card outer bottom + 50 design px, so its top is above that. */
        top: cardHeight + (chip.dropBelowCard - chip.height) * unit,
        width: chip.width * unit,
        height,
        backgroundColor: chip.fill,
        borderRadius: chip.cornerRadius * unit,
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          /*
            POSITIONED BY THE BASELINE, and the 0.800 is where the baseline
            actually sits in a `line-height: 1` box for this face. See the box
            in `condensedFace.ts` — the naive `top: baseline - fontSize` shipped
            wrong once already, and for Bebas it is a 0.200em error rather than
            Noto Sans's 0.112em.
          */
          top: height - chip.baselineAboveBottom * unit - fontSize * CONDENSED_FACE_BASELINE_OVER_EM,
          /*
            CENTRED BY ADVANCE, WHICH IS WHAT `text-align: center` ALREADY DOES.

            Bebas's `1` has a wide right sidebearing, so ink-centring and
            advance-centring are not the same thing: at the plateau `#1`'s ink
            centre must land 2.03 screen px LEFT of the chip's centre and `#4`'s
            0.14px right, and ink-centring would put both at 0.00.

            Written down because a build that "fixes" the visibly off-centre `1`
            by measuring ink would be introducing the error, not removing it.
          */
          textAlign: 'center',
          fontFamily: CONDENSED_FAMILY,
          fontWeight: 400,
          fontSize,
          lineHeight: 1,
          letterSpacing: chip.letterSpacing,
          color: chip.textColour,
          /*
            BLACK ON ORANGE. a4's chips are white on orange, in the same reel,
            and getting it backwards makes the badge read as a different design.
          */
          WebkitTextStrokeWidth: chip.strokePerSide * 2 * unit,
          WebkitTextStrokeColor: chip.textColour,
          whiteSpace: 'nowrap',
        }}
      >
        {galleryStripOrdinal(index)}
      </div>
    </div>
  )
}

export function GalleryStrip({ srcs }: { srcs: readonly string[] }): ReactNode {
  useCondensedFace()
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill style={{ backgroundColor: GALLERY_STRIP.ground }}>
      {/*
        The grid is DEAD here, exactly as it is in a4 — scale a literal 1 for
        all 150 frames, with zero translation.

        This was proved rather than assumed, and by a bit-level control: rows
        30-250 across the full frame width are BIT-IDENTICAL between local 40
        and local 50 (mad 0.000000, maxd 0) while in that same pair the strip
        translated 201px. Not one pixel of one channel differs, and the same
        band is bit-identical for every one of the 86 frames from local 19 to
        local 104. A three-parameter fit buys 0.0003px over the identity.

        PASS `1` AS A LITERAL, NEVER AS A FUNCTION OF THE CLOCK. Reaching for
        the camera scale here would drag the grid along with the strip, which is
        the most visible failure available in this clip: the grid is the only
        thing on screen for the whole plateau.

        And it is drawn UNCONDITIONALLY. An earlier reading of the frames said
        "no grid before local 4 and none after local 128", which is true of the
        pixels and is not a rule to implement — the grid is simply covered by a
        card that fills the frame at both heroes. Adding a visibility switch for
        it would be building an artefact of the measurement.
      */}
      <WarpedGrid
        scale={1}
        blurStdDeviation={GRID_ANIMATION_PAINT.galleryStrip.blurStdDeviation}
        strokeWidth={GRID_ANIMATION_PAINT.galleryStrip.strokeWidth}
        strokeOpacity={GRID_ANIMATION_PAINT.galleryStrip.strokeOpacity}
        /*
          a8's OWN falloff, and it is not the one a4 and a9 share. Theirs holds
          alpha at 1.000 out to r = 0.68 where a8 is already at 0.87 by r = 0.60.
          Taking the shared row draws a8's mid-field 34-46% too bright at
          r = 0.708 — a bright ring across most of the frame.
        */
        vignette={GRID_ANIMATION_VIGNETTE.galleryStrip}
        /*
          Screen-fixed, like a4 and a9 and unlike a3. Provably identical to the
          alternative here, because a8's grid never moves at all, so this is
          chosen to match the two animations it shares its frame of reference
          with rather than to match the one it shares nothing with.
        */
        vignetteScalesWithGrid={false}
        idPrefix="gallery-strip"
      />

      {/*
        THE ORDER IS LOAD-BEARING AND IT IS BACKWARDS TO INTUITION.

        `srcs[0]` is card #1, the LEFTMOST, and it is the picture the clip ENDS
        on. `srcs[3]` is card #4, the rightmost, and it is the one the clip
        OPENS inside. The camera travels right to left through descending label
        order.

        Feed them in and drive the camera forward instead and you produce a
        mirror of his reference that looks entirely plausible on its own and is
        wrong in every frame.
      */}
      {/*
        ##################################################################
        # A MISSING PICTURE IS A REFUSAL, NEVER AN EMPTY CARD. T-17.      #
        #                                                                 #
        # This read `srcs[index] ?? ''`, which hands `<Img>` an empty src. #
        # Measured with three pictures: it throws `No "src" prop was      #
        # passed to <Img>` and blanks frames 0 to 66 — card 4's entire     #
        # on-screen window, which is also the frame the clip OPENS on.     #
        #                                                                 #
        # Saku 0.3 forbids it twice: "Reject or flag the beat if fewer     #
        # than three valid images are available", and "Do not silently     #
        # substitute unrelated images when an asset is missing."           #
        #                                                                 #
        # THE COUNT IS STILL FOUR AND HIS SPEC SAYS THREE OR FOUR. The     #
        # three-card version is a re-fit rather than a parameter: the      #
        # camera path is measured against a four-card strip, and nine of   #
        # the clock's assertions are the client's own measured pan points. #
        # `MIN_PREVIEW_PICTURES` carries his floor so the day the geometry #
        # exists, one number changes. TREATMENT-STANDARD.md §6 records it. #
        ##################################################################
      */}
      {srcs.length !== GALLERY_STRIP_CARD_COUNT
        ? null
        : Array.from({ length: GALLERY_STRIP_CARD_COUNT }, (_, index) => {
            const src = srcs[index]
            return src === undefined ? null : (
              <Card key={index} src={src} index={index} frame={frame} />
            )
          })}
    </AbsoluteFill>
  )
}
