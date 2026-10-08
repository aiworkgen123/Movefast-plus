import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { pictureMoveStyle } from '../KenBurns.js'
import type { PictureMove } from '../KenBurns.js'
import { SourcedImg as Img } from '../SourcedImg.js'
import {
  CONDENSED_FACE_BASELINE_OVER_EM,
  CONDENSED_FAMILY,
  useCondensedFace,
} from '../animations/condensedFace.js'
import { SHADOW_UP_TYPE, shadowUpOpacity, shadowUpRise } from './shadowUpClock.js'

/**
 * Template 05, shadow-up. One spoken line rises from behind y 1020 and settles
 * near the bottom centre, white, with a dark copy of itself 5 px lower. No card,
 * no box, no scrim. A PORT of Saku's approved template, edited on purpose.
 *
 * PROVENANCE, because this is his work and the port has to stay auditable:
 *
 *   library   docs/Remotion-Reference-Template-Library/approved/
 *             05-shadow-up-animated-text-overlay/
 *   source    code/ShadowUpAnimatedTextOverlay.tsx, 126 lines
 *   sha256    b623968c154459b1fab97d10284cc769880282bb1e5fbc6b43252e56725e6714
 *   manifest  manifest/05-shadow-up-animated-text-overlay.json, whose `id` is
 *             reference-05-shadow-up-animated-text-overlay
 *   sha256    7ab45b971c5c8b7cf0d8ccb5679de78fc3d91c174c8f3c7bbd7bb802c519566c
 *   preview   preview/reference-template-05-approved.mp4, the frames every
 *             number here was measured against
 *   sha256    86aa7970e00aeb2c5f7ad7207554d4abaff41549c48aea920fc1af322d8acb8c
 *
 * `docs/` is gitignored, so nothing downstream of this repo can diff this file
 * against his. The hashes are the whole audit trail. Re-derive them with
 * `sha256sum` before trusting any claim that the two agree.
 *
 * ####################################################################
 * # SEVEN EDITS, EVERY ONE LOAD-BEARING. Do not restore any of them.  #
 * #                                                                   #
 * # 1  THE FACE. His stack names DIN Condensed Bold with four          #
 * #    fallbacks. The repo holds no such face and records no licence  #
 * #    for one, so on the render box his stack would land on whatever #
 * #    is installed, invisibly to every check. Now Bebas Neue through  #
 * #    `useCondensedFace`, the repo's one condensed face, OFL 1.1.     #
 * #    Taken on the spec's recommended default, its open question    #
 * #    1, and reported to the developer, who did not object,         #
 * #    2026-09-12.                                                   #
 * #                                                                   #
 * # 2  THE WEIGHT, 700 to 400. See the box on `SHADOW_UP_TYPE`.       #
 * #                                                                   #
 * # 3  THE SIZE, 101 to 104, matched on cap height. Same box.         #
 * #                                                                   #
 * # 4  THE BOX TOP is derived, never typed. His typed top placed his  #
 * #    face's box. For Bebas it would put the cap 11 px low. The box  #
 * #    now hangs from the preview's baseline, 1007, through the face's #
 * #    own baseline ratio, 0.8 em. `baseline - fontSize` is the trap   #
 * #    `condensedFace.ts` records, and it shipped wrong on a3 and a5.  #
 * #                                                                   #
 * # 5  KERNING OFF AND UPPER CASE ADDED. The chooser refuses a line   #
 * #    wider than the title-safe width by summing the face's own      #
 * #    advances of the upper-cased line. Chrome kerns Bebas by        #
 * #    default, so with kerning on the drawn width is not the width   #
 * #    the gate measured. His handoff asks for upper case.            #
 * #                                                                   #
 * # 6  THE CLOCK samples his 60 fps table at `frame * 60 / fps`. See  #
 * #    `shadowUpClock.ts`. It is exact at 30 fps.                      #
 * #                                                                   #
 * # 7  HIS DEFAULT PROPS ARE GONE, with his asset-path helper. They   #
 * #    resolved a fixture still, and an export shaped like that is    #
 * #    how a fixture frame reaches a real render (`P12.tsx` edit 1).  #
 * #    His optional face and size props are gone too, because both    #
 * #    are locked, and so is his duration: the shot's own cut ends    #
 * #    the frame, and his composition holds to its end with no exit.  #
 * ####################################################################
 *
 * EDIT 8, 2026-09-19 (lever 4): the still takes the plan's slow push-in
 * (`pictureMove`, 1.00 to 1.05 over the shot, Saku's own guide), on the picture
 * alone. Without the prop it is his still exactly.
 *
 * What stays his, byte for byte: the ground, the still at cover with no
 * filter, the mask at y 1020, both copies and their order (dark first, so it
 * sits underneath), the 5 px drop, the 1 px nudge left, both colours, the text
 * shadow, the letter spacing, `lineHeight: 1`, centred, never wrapped.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. The only hooks are Remotion's
 * two and `useCondensedFace`, which holds frame 0 behind `delayRender` until
 * the face is real, exactly as a4, a7 and a8 do.
 */

/**
 * THE PROPS `DeviceFrame` PASSES, and nothing else. `src` is the scene's own
 * picture, already a URL. `line` is the plan's one line, drawn as given:
 * upper-cased by CSS, never wrapped, never shortened here.
 */
export type ShadowUpProps = {
  src: string
  line: string
  /** The plan's push on the picture alone. Absent draws the still untouched. See `PictureMove`. */
  pictureMove?: PictureMove
}

export function ShadowUp({ src, line, pictureMove }: ShadowUpProps): ReactNode {
  useCondensedFace()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = shadowUpRise(frame, fps)
  const opacity = shadowUpOpacity(frame, fps)
  const t = SHADOW_UP_TYPE

  const setting: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: t.baselineY - CONDENSED_FACE_BASELINE_OVER_EM * t.fontSizePx,
    fontFamily: CONDENSED_FAMILY,
    fontSize: t.fontSizePx,
    fontWeight: t.fontWeight,
    letterSpacing: t.letterSpacingPx,
    lineHeight: 1,
    fontKerning: 'none',
    textTransform: 'uppercase',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    opacity,
  }

  return (
    <AbsoluteFill style={{ backgroundColor: t.ground, overflow: 'hidden' }}>
      <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', ...pictureMoveStyle(pictureMove, frame) }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: t.maskBottomY,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            ...setting,
            color: t.shadowCopyColour,
            translate: `${String(t.nudgeXPx)}px ${String(rise + t.shadowCopyDropPx)}px`,
          }}
        >
          {line}
        </div>
        <div
          style={{
            ...setting,
            color: t.colour,
            textShadow: t.textShadow,
            translate: `${String(t.nudgeXPx)}px ${String(rise)}px`,
          }}
        >
          {line}
        </div>
      </div>
    </AbsoluteFill>
  )
}
