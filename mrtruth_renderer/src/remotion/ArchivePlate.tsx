import { AbsoluteFill } from 'remotion'
import { SourcedImg as Img } from './SourcedImg.js'
import type { ReactNode } from 'react'
import type { AssetVision } from '@vg/core/schemas'
import { ARCHIVE_PLATE } from './constants.js'
import { Posed } from './KenBurns.js'
import type { Pose } from './KenBurns.js'

/**
 * Archive plate — a sub-square VIDEO clip held on a card in a 16:9 frame.
 *
 * ####################################################################
 * # NO STILL REACHES THIS COMPONENT ANY MORE, AND THAT IS A CLIENT   #
 * # DECISION RATHER THAN A DESIGN ONE. `chooseCropMode` sends every  #
 * # sub-square STILL to `blurPillarbox` now; only video between      #
 * # PHONE_ASPECT and square still lands here.                        #
 * #                                                                   #
 * # The argument this box used to make — that a vertical photograph  #
 * # on a blurred copy of itself is the most recognisable             #
 * # YouTube-automation tell there is, and that a documentary editor  #
 * # holds the photograph on a card instead — is intact and is still  #
 * # why the component is kept whole and tested. What overrode it is  #
 * # measurable: the plate spends 75.9% of a 1920x1080 frame on       #
 * # ground, 663px of near-black down each side, and the client       #
 * # stopped the delivered film on exactly that frame at 0:02:23 and  #
 * # said the format is wrong. See the header of core/crop.ts.        #
 * #                                                                   #
 * # DO NOT DELETE THIS. It is one threshold away from coming back.   #
 * ####################################################################
 *
 * The plate's ground is tinted from the image's own dominant hue, so it belongs
 * to the shot instead of sitting on a generic grey — which costs nothing,
 * because the Gemini ranking call already returned that number.
 */

function plateBackground(vision: AssetVision | null): string {
  const hue = vision?.dominantHue ?? 210
  const luma = vision?.meanLuma ?? 0.4
  // Deliberately dark and desaturated: the plate is a ground, not a subject.
  const lightness = 6 + luma * 6
  return `radial-gradient(ellipse at 50% 42%, hsl(${hue}, 16%, ${lightness + 4}%) 0%, hsl(${hue}, 14%, ${lightness}%) 62%, hsl(${hue}, 12%, ${Math.max(3, lightness - 3)}%) 100%)`
}

/**
 * `pose`, not `motion` + `durationFrames`: the plate has to draw the OUTGOING
 * image of a crossfade too, and that one is a held frame rather than a move. The
 * plate geometry is identical either way, and it must be, or the picture jumps
 * off its plate for the length of the dissolve.
 */
export function ArchivePlate({
  src,
  pose,
  vision,
}: {
  src: string
  pose: Pose
  vision: AssetVision | null
}): ReactNode {
  return (
    <AbsoluteFill style={{ background: plateBackground(vision) }}>
      <AbsoluteFill
        style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'relative',
            height: ARCHIVE_PLATE.height,
            // Width follows the image's own aspect: the source dimensions are
            // not in the plan, and asking the layout for them is free.
            display: 'inline-block',
            boxShadow: ARCHIVE_PLATE.shadow,
            overflow: 'hidden',
          }}
        >
          {/*
            The move is capped inside the plate; the plate itself never moves.
            A held pose ignores the cap — the plan already applied it. See `Posed`.
          */}
          <Posed
            pose={pose}
            maxTravel={ARCHIVE_PLATE.maxTravel}
            style={{ position: 'relative', inset: 'auto' }}
          >
            <Img
              src={src}
              style={{ height: ARCHIVE_PLATE.height, width: 'auto', display: 'block' }}
            />
          </Posed>

          {/* Hairline inner rule. Sits above the image so the crop cannot eat it. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: ARCHIVE_PLATE.border,
              pointerEvents: 'none',
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
