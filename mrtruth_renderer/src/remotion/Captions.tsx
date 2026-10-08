import { useCurrentFrame } from 'remotion'
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import type { CaptionPhrase } from '@vg/core/schemas'
import { CAPTION, FONT_FAMILY, FRAME_HEIGHT, SAFE_AREA_X, SCRIM } from './constants.js'

/**
 * Captions.
 *
 * ####################################################################
 * # PHRASE BLOCKS, NOT WORD-POP.                                      #
 * #                                                                   #
 * # The whole phrase is on screen for its whole duration and only the #
 * # OPACITY of the current word changes — 1.0 against 0.74. No colour #
 * # shift, no scale, no karaoke fill. Those are the two tells that    #
 * # mark a video as social-first, and neither helps anyone read a     #
 * # line that is already in front of them. What actually helps is     #
 * # being able to read ahead, which requires the words to be there.   #
 * #                                                                   #
 * # Because every word is present from the first frame of the phrase, #
 * # nothing reflows: opacity does not affect layout.                  #
 * ####################################################################
 *
 * Frames here are SCENE-RELATIVE, like everything else inside a PlannedScene.
 */

/**
 * The scrim's three-stop gradient, as a CSS value.
 *
 * Pulled out of the JSX so the stops can be asserted with plain strings, the way
 * `kenBurnsFramePercent` is asserted with plain numbers. A gradient is the one
 * part of this component that is a VALUE rather than a layout: the three stops
 * are either the numbers `SCRIM` states or they are not, and that is checkable
 * without a browser. Whether the resulting tone actually rescues white type over
 * a lit manuscript page is not, and no test here claims it.
 *
 * Three stops, not two. The middle one puts the whole text block on flat tone
 * instead of on the slope of a ramp — see the note on SCRIM in constants.ts.
 */
export function captionScrimGradient(): string {
  return (
    `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ` +
    `rgba(0,0,0,${SCRIM.plateauAlpha}) ${SCRIM.plateauAt * 100}%, ` +
    `rgba(0,0,0,${SCRIM.endAlpha}) 100%)`
  )
}

export function CaptionScrim(): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: SCRIM.startY,
        height: SCRIM.endY - SCRIM.startY,
        background: captionScrimGradient(),
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * Half-open [startFrame, endFrame), which is the timing convention everywhere in
 * a PlannedScene.
 *
 * Stated once because the phrase window and the word window are the same
 * question asked at two scales, and an inclusive `<=` on either end would put two
 * phrases on screen together, or light two words at once, on the frame where one
 * hands over to the next.
 */
export function coversFrame(window: { startFrame: number; endFrame: number }, frame: number): boolean {
  return frame >= window.startFrame && frame < window.endFrame
}

/** The phrase on screen at this frame, or null in the gaps between phrases. */
export function activePhraseAt(
  phrases: readonly CaptionPhrase[],
  frame: number,
): CaptionPhrase | null {
  return phrases.find((phrase) => coversFrame(phrase, frame)) ?? null
}

/** One word of the phrase, ready to render: what goes before it, and how lit it is. */
export type CaptionWordPart = {
  text: string
  /**
   * A REAL space before every word but the first, and null before the first.
   * Null rather than '' so React emits nothing at all there, exactly as the
   * original `position > 0 ? ' ' : null` did.
   */
  separator: string | null
  /** Stable while the phrase is on screen; position alone would reuse across phrases. */
  key: string
  opacity: number
}

/**
 * The phrase, turned into the parts the component renders. THE SEPARATORS ARE
 * THE POINT.
 *
 * These used to be flex `gap`, and the words carried no whitespace of their own.
 * `textWrap: 'balance'` is a text algorithm and does nothing to flex items, so
 * the layout had to move to normal text flow — at which point a phrase with no
 * spaces in it both runs together AND has nowhere legal to break, because a line
 * break can only happen at a break opportunity and adjacent inline spans give it
 * none. So the space is not spacing. It is the break opportunity.
 *
 * Returned as data rather than JSX so that claim is a string claim, checkable in
 * node. What it CANNOT check is where the line actually breaks, or whether the
 * last word is stranded alone on line two — that needs a real text layout, and
 * only the renderer has one.
 */
export function captionWordParts(phrase: CaptionPhrase, frame: number): CaptionWordPart[] {
  return phrase.words.map((word, position) => ({
    text: word.text,
    separator: position > 0 ? ' ' : null,
    key: `${position}-${word.startFrame}`,
    opacity: coversFrame(word, frame) ? CAPTION.activeOpacity : CAPTION.inactiveOpacity,
  }))
}

export function Captions({ phrases }: { phrases: readonly CaptionPhrase[] }): ReactNode {
  const frame = useCurrentFrame()

  const active = activePhraseAt(phrases, frame)
  if (active === null) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE_AREA_X,
        right: SAFE_AREA_X,
        // The block's BOTTOM edge is the fixed thing. Anchoring the top instead
        // would make a two-line phrase sit lower than a one-line phrase.
        bottom: FRAME_HEIGHT - CAPTION.blockBottomY,
        /*
         * THE SAFE AREAS ARE NOT THE LINE LENGTH, and treating them as one is
         * what broke this.
         *
         * `left`/`right` above are a legal-area limit: nothing may go outside
         * them. Left alone they also SET the width, at 1728px, which is about 65
         * characters of this face — while the planner builds every phrase to fit
         * two balanced lines of 38. So both budgeted lines fitted on one, and
         * `textWrap: 'balance'` below did nothing at all, because a block that
         * fits on one line has no second line to balance against. The visible
         * result is a single caption sweeping nearly the full frame.
         *
         * `maxWidth` restates the planner's budget in pixels; see the derivation
         * on `CAPTION.maxWidth`. The safe areas stay, because they are still the
         * limit — this only stops them doubling as the measure.
         *
         * `margin: '0 auto'` is what centres the narrower box. With `left` and
         * `right` both set and `width` no longer filling them, CSS 10.3.7 splits
         * the leftover space equally between two `auto` margins, so the block is
         * centred in the frame rather than pinned to the left safe area.
         */
        maxWidth: CAPTION.maxWidth,
        margin: '0 auto',
        /*
         * NORMAL TEXT FLOW, NOT FLEX, and the reason is `textWrap: 'balance'`.
         *
         * A wrapping flex row breaks wherever the next item stops fitting, so a
         * phrase ending in a short word strands it alone on line two — observed
         * on real frames as "an answer" and as a lone "47". Balance is a text
         * algorithm and does nothing to flex items, so the words have to be
         * inline for it to apply. Chrome has supported it since 114 and the
         * renderer is Chrome, so there is no fallback to carry.
         *
         * Spacing moves from flex `gap` to real spaces between the spans, which
         * is also what lets a line break happen between words at all.
         */
        display: 'block',
        textWrap: 'balance',
        fontFamily: FONT_FAMILY,
        fontWeight: 500,
        fontSize: CAPTION.fontSize,
        lineHeight: CAPTION.lineHeight,
        letterSpacing: CAPTION.letterSpacing,
        color: CAPTION.color,
        textAlign: 'center',
        textShadow: CAPTION.textShadow,
        // Never a stroke and never a box. The fixed scrim is what makes this
        // legible over 150 images nobody has previewed.
        pointerEvents: 'none',
      }}
    >
      {/*
        `part.separator` is the explicit space, and it is load-bearing now that
        this is text flow rather than a flex row — see `captionWordParts`.
      */}
      {captionWordParts(active, frame).map((part) => (
        <Fragment key={part.key}>
          {part.separator}
          <span style={{ opacity: part.opacity }}>{part.text}</span>
        </Fragment>
      ))}
    </div>
  )
}
