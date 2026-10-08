import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from './SourcedImg.js'
import type { ReactNode } from 'react'
import type { TextCard as TextCardData } from '@vg/core/schemas'
import {
  clampedRevealFrames,
  easeIn,
  easeOut,
  FONT_FAMILY,
  OVERLAY,
  OVERLAY_NOTE_BOTTOM_INSET,
  OVERLAY_SCRIM_GRADIENT,
  TEXT_CARD,
  textCardChoreography,
  textCardLines,
  textCardOnPictureFontSize,
} from './constants.js'
import type { FrameWindow, TextCardChoreography } from './constants.js'
import { Posed } from './KenBurns.js'
import type { Pose } from './KenBurns.js'
import type { OverlayVariant } from './props.js'

/**
 * The text card — what a scene shows when sourcing found it no picture.
 *
 * ####################################################################
 * # IT IS NO LONGER A CARD, AND THAT IS THE 2026-08-16 CHANGE.        #
 * #                                                                   #
 * # It used to own the frame: a #0B0B0C base, the inherited photo     #
 * # blurred 28px and dimmed to 0.28, a 0.92-alpha scrim over that,    #
 * # and 92px semibold type on the optical centre line under a gold    #
 * # rule and a letterspaced eyebrow. Three darkenings stacked, and    #
 * # every mark on it a chapter-card mark.                             #
 * #                                                                   #
 * # The client sent that frame back and pointed at two of his own     #
 * # where the words simply sit on the photograph. So the picture is   #
 * # now drawn whole and MOVING, the scrim is the lower third's, and   #
 * # the line is the annotation's — light, warm, two lines, low left.  #
 * # A card scene and an overlay scene are now the same object, which  #
 * # is what he has asked for in three separate rounds of notes.       #
 * #                                                                   #
 * # THE RULE AND THE EYEBROW ARE GONE FROM THIS DEVICE ONLY.          #
 * # `TEXT_CARD.rule` and `TEXT_CARD.eyebrow` still set the overlay's  #
 * # own hairline treatment. They were what made a fallback read as a  #
 * # designed interruption, and the interruption is the objection.     #
 * ####################################################################
 *
 * Three things that are still load-bearing, and one that is new.
 *
 * THE BASE IS STILL PAINTED UNCONDITIONALLY. `backgroundAssetPath` is null for a
 * fallback at scene index 0 — there is no earlier picture to inherit — so the
 * ground has to exist without one. That is the 0:20 lesson and it has not
 * changed.
 *
 * NO REFLOW. Every line is in the DOM from frame 0 and animates on opacity and
 * transform only. Both are compositor-only, so the line breaks are decided once
 * at layout and never move.
 *
 * NO ANIMATED FILTER. There is now no filter on this component at all, which
 * settles the Grade.tsx question rather than answering it.
 *
 * NEW: THE PICTURE MOVES. It is wrapped in `Posed` with the scene's own planned
 * motion, which the planner has always written for a card scene (`deriveMotion`
 * runs before the card branch) and nothing has ever rendered. The old baked
 * `scale(1.12)` had to go with the blur — see `TEXT_CARD.background` for why
 * leaving it would have multiplied through the cap in core/motion silently.
 */

export function TextCard({
  card,
  backgroundSrc,
  durationFrames,
  variant,
  pose,
}: {
  card: TextCardData
  backgroundSrc: string | null
  /**
   * The SCENE's length, not the composition's. They are the same number in a
   * real render (`calculateSegmentMetadata` in Root.tsx derives one from the
   * other) and they are not the same in Remotion Studio or under `<Player>`,
   * where the choreography must still fit the scene it was planned for.
   */
  durationFrames: number
  variant: OverlayVariant
  /**
   * How the inherited picture is posed. Defaulted to null rather than required,
   * so Studio, `<Player>` and every existing test stay correct without it — and
   * so a caller with no motion to give draws a held picture instead of throwing.
   *
   * IT IS THE SCENE'S OWN MOTION, NOT THE PICTURE'S ORIGINAL ONE. The photograph
   * is inherited from an earlier scene, the move is not: this scene has its own
   * length and its own planned pose, and reusing the source scene's would run a
   * move sized for a different duration.
   */
  pose?: Pose | null
}): ReactNode {
  const frame = useCurrentFrame()
  const choreography = textCardChoreography(durationFrames)

  /*
   * THE EXIT IS ON THE WHOLE BLOCK. The lines arrive separately and leave as one
   * object; staggering the exit as well would read as the type falling apart.
   */
  const exit = choreography.frozen
    ? 0
    : interpolate(
        frame,
        [choreography.exitFrom, choreography.exitFrom + choreography.exitFrames],
        [0, 1],
        { easing: easeIn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )

  /*
   * ####################################################################
   * # BOTH FIELDS CAN BE EMPTY, AND THEN THERE IS NOTHING TO SET.       #
   * #                                                                   #
   * # `pullPhrase` and `words` may both be empty (schemas.ts). The old  #
   * # component still painted its three-layer ground in that case, on   #
   * # the reasoning that a designed ground reads as a held beat. That   #
   * # reasoning survives the rewrite unchanged and matters more now:    #
   * # with no rule and no eyebrow, a card with no words is simply the   #
   * # previous photograph held for another shot, which is a normal      #
   * # documentary move rather than a defect.                            #
   * ####################################################################
   */
  const hasHeadline =
    variant === 'spoken' ? card.words.length > 0 : card.pullPhrase.trim().length > 0

  return (
    <AbsoluteFill>
      {/* L1 — the ground, painted whether or not there is a picture. */}
      <AbsoluteFill style={{ backgroundColor: TEXT_CARD.baseColor }} />

      {/* L2 — the picture, whole and moving. */}
      {backgroundSrc !== null && (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Background src={backgroundSrc} pose={pose ?? null} />
        </AbsoluteFill>
      )}

      {/*
        L3 — the lower third's own gradient, not this component's old sideways
        wash.

        THE CONTRAST GUARANTEE MOVES WITH THE TYPE RATHER THAN BEING DROPPED.
        The old 100deg gradient opened at 0.92 alpha on the LEFT, which is where
        the old block sat. The line now sits low, so the guarantee has to be low
        too — `OVERLAY_SCRIM_GRADIENT` plateaus at 0.82 from the block's top edge
        to the frame bottom, which is 10.3:1 against this off-white over a pure
        white photograph and is pinned by T-OV17d. Reusing it rather than
        reshaping the old one is also what stops a card and an overlay reading as
        two devices.
      */}
      <AbsoluteFill style={{ background: OVERLAY_SCRIM_GRADIENT }} />

      {hasHeadline && (
        <div
          style={{
            position: 'absolute',
            left: OVERLAY.textX,
            /*
             * Pinned by the BOTTOM, like the annotation and unlike the one-line
             * overlay. This block is one line or two depending on the sentence,
             * so there is no known height to derive a top from, and pinning the
             * bottom is the only way both cases land on the same edge.
             */
            bottom: OVERLAY_NOTE_BOTTOM_INSET,
            width: OVERLAY.blockWidth,
            maxWidth: OVERLAY.blockWidth,
            fontFamily: FONT_FAMILY,
            textAlign: 'left',
            opacity: 1 - exit,
            transform: `translateY(${String(exit * TEXT_CARD.exitTranslateY)}px)`,
            willChange: 'transform, opacity',
          }}
        >
          {variant === 'spoken' ? (
            <SpokenHeadline card={card} frame={frame} choreography={choreography} />
          ) : (
            <PlateHeadline card={card} frame={frame} choreography={choreography} />
          )}
        </div>
      )}
    </AbsoluteFill>
  )
}

/**
 * The inherited photograph, filling the frame.
 *
 * `objectFit: cover` rather than the source scene's own crop mode, and that is a
 * stated limitation rather than an oversight. The crop that picture was drawn
 * under belongs to the scene it came from and is not carried on this one — the
 * plan stores `backgroundAssetPath` and nothing else about it. Cover is right
 * for the corpus (84% of assets are within a frame's width of 16:9) and wrong
 * for a tall scan, which it crops hard. Carrying the source crop would mean a
 * schema field, so it is deliberately not done for one shot in eighty-seven.
 *
 * A NULL POSE HOLDS THE PICTURE STILL rather than throwing. Studio and the tests
 * both reach here without one.
 */
function Background({ src, pose }: { src: string; pose: Pose | null }): ReactNode {
  const image = (
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // `TEXT_CARD.background.scale` is 1 now. It is read rather than omitted
        // so that a future decision to re-introduce overscan has one place to
        // make it, and cannot be made in a component while the constant says
        // otherwise.
        transform: `scale(${String(TEXT_CARD.background.scale)})`,
        filter: TEXT_CARD.background.filter,
      }}
    />
  )

  if (pose === null) return image

  return <Posed pose={pose}>{image}</Posed>
}

/**
 * `plate` — the default, and the safe bet.
 *
 * The headline is `pullPhrase`, the WRITTEN copy the planner trimmed to a
 * sentence or clause boundary. It used to render `card.words` — the raw aligned
 * tokens — and `pullPhrase` was read by nothing at all, which is how a headline
 * sawn off at "It dates to roughly 100" reached a delivered frame while a
 * correctly written field sat unused beside it in the same object.
 *
 * The size is stepped on the phrase's CHARACTER count and the lines are split
 * here rather than by the browser, so the two-line bound is a fact rather than a
 * hope and each line can be timed separately. Both now step against
 * `textCardOnPictureFontSize`, which is sized so that the planner's 85-character
 * cap still fits in two lines — this block has no third line to fall into.
 */
function PlateHeadline({
  card,
  frame,
  choreography,
}: {
  card: TextCardData
  frame: number
  choreography: TextCardChoreography
}): ReactNode {
  const fontSize = textCardOnPictureFontSize(card.pullPhrase.length)
  const lines = textCardLines(card.pullPhrase, fontSize)

  return (
    <div
      style={{
        fontSize,
        fontWeight: TEXT_CARD.onPicture.fontWeight,
        lineHeight: TEXT_CARD.onPicture.lineHeight,
        letterSpacing: TEXT_CARD.onPicture.letterSpacing,
        color: TEXT_CARD.onPicture.color,
        // No textShadow. The gradient below does that job, and a shadow under a
        // gradient only muddies the stems of the type. The client asked for
        // "no black background with shadow" and this is the half of that which
        // was already true.
      }}
    >
      {lines.map((line, position) => (
        <div
          key={`${String(position)}-${line}`}
          style={{
            opacity: progressIn(
              frame,
              position === 0 ? choreography.headlineLine1 : choreography.headlineLine2,
              choreography,
            ),
            willChange: 'opacity',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

/**
 * `spoken` — the second treatment, kept so the client's note can be answered.
 *
 * Same words as `plate` (the planner derives both fields from one trimmed token
 * list), revealed one at a time against the narration instead of a line at a
 * time against the clock. The stagger is CLAMPED — see `clampedRevealFrames` —
 * because the raw narration timings are what would make it a teleprompter.
 *
 * It takes the same size step as `plate` now. It used to set its own 68px on a
 * wider 1360px measure, which was sized for a block that owned the frame; on a
 * photograph the two treatments have to occupy the same box or picking between
 * them would also be picking a layout.
 */
function SpokenHeadline({
  card,
  frame,
  choreography,
}: {
  card: TextCardData
  frame: number
  choreography: TextCardChoreography
}): ReactNode {
  const offset = choreography.headlineLine1[0]
  const reveals = clampedRevealFrames(card.words.map((word) => word.startFrame))
  const spoken = card.words.map((word) => word.text).join(' ')

  return (
    <div
      style={{
        fontSize: textCardOnPictureFontSize(spoken.length),
        fontWeight: TEXT_CARD.onPicture.fontWeight,
        lineHeight: TEXT_CARD.onPicture.lineHeight,
        letterSpacing: TEXT_CARD.onPicture.letterSpacing,
        color: TEXT_CARD.onPicture.color,
      }}
    >
      {card.words.map((word, position) => (
        <RevealedWord
          key={`${String(position)}-${word.text}`}
          text={word.text}
          startFrame={offset + (reveals[position] ?? 0)}
          frame={frame}
          frozen={choreography.frozen}
        />
      ))}
    </div>
  )
}

function RevealedWord({
  text,
  startFrame,
  frame,
  frozen,
}: {
  text: string
  startFrame: number
  frame: number
  frozen: boolean
}): ReactNode {
  const progress = frozen
    ? 1
    : interpolate(frame, [startFrame, startFrame + TEXT_CARD.spoken.revealFrames], [0, 1], {
        // Ease-out only: the word arrives at speed and settles, matching the
        // motion of everything else in the film.
        easing: easeOut,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })

  return (
    <span
      style={{
        display: 'inline-block',
        // A space is emitted as part of the layout, not between spans, so the
        // wrap points are identical at every frame.
        marginRight: '0.26em',
        opacity: progress,
        transform: `translateY(${String((1 - progress) * TEXT_CARD.spoken.revealTranslateY)}px)`,
        willChange: 'transform, opacity',
      }}
    >
      {text}
    </span>
  )
}

/**
 * One entry window, or 1 outright when the scene is too short to animate at all.
 *
 * A card under `TEXT_CARD_STATIC_BELOW_FRAMES` frames renders fully formed on
 * every frame it has. A truncated animation looks like a bug; a static card
 * looks like a decision.
 */
function progressIn(
  frame: number,
  window: FrameWindow,
  choreography: TextCardChoreography,
): number {
  if (choreography.frozen) return 1
  return interpolate(frame, [window[0], window[1]], [0, 1], {
    easing: easeOut,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}
