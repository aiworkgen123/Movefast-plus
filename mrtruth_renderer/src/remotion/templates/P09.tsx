import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ReactNode } from 'react'
import { SourcedImg as Img } from '../SourcedImg.js'
import { FONT_FAMILY } from '../constants.js'
import { P09_TYPE } from './p09Type.js'

/**
 * P09 — compact reset / question card. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P09.tsx
 *   sha256    039fbcbd2bfbce789e8e7997f9dcaa98277ace0c10218ce51284ae63df5d25c4
 *   lock      accepted_snapshots/P09_CompactQuestion/P09_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P09_CompactQuestion/P09.tsx hashes identically.
 *             `apps/worker/scripts/verify-template-locks.ts P09` said so on
 *             2026-09-13, with all four locked hashes matching.
 *
 * `templates/` is gitignored and kept out of the worker image, so the hash above
 * is the whole audit trail, exactly as it is for `P12.tsx`, `P08.tsx`, `P04.tsx`
 * and `P02.tsx`.
 *
 * ####################################################################
 * # SIX EDITS WERE MADE TO THE COPY. Do not "restore" any of them.   #
 * #                                                                   #
 * # 1  The pack's asset-path helper import and its default-props      #
 * #    export are DELETED, for the reason `P12.tsx` edit 1 gives: a   #
 * #    Studio default that resolves a scraped fixture is how such a   #
 * #    frame reaches a real render by accident. The picture arrives   #
 * #    as `src`, built by the worker from the plan's own asset.       #
 * #                                                                   #
 * # 2  Both font stacks become `FONT_FAMILY`, at a weight that        #
 * #    exists. The pack named Avenir Next bold and New York bold,      #
 * #    which are not on the render box and would miss to Liberation   #
 * #    without a word. See the box on `P09_TYPE` in `p09Type.ts`.      #
 * #                                                                   #
 * # 3  THE SECTION LABEL IS OMITTED WHEN EMPTY. Its words must be      #
 * #    spoken in the window, and the chooser hands '' when they are    #
 * #    not, or when the label would wrap or repeat a word of the       #
 * #    question. An empty `<div>` would still hold its 18 px margin    #
 * #    and a line of height between the rule and the question, so the #
 * #    block goes, not only its text. The question is never empty:    #
 * #    the schema refuses one.                                        #
 * #                                                                   #
 * # 4  The root fill is plain black, not the pack's near-black. This  #
 * #    mounts inside `Scene`'s own black root, as `P02.tsx` does.      #
 * #                                                                   #
 * # 5  `Img` is `SourcedImg`, which retries a slow storage fetch the  #
 * #    way every other device picture does.                           #
 * #                                                                   #
 * # 6  The card and type numbers are read from `P09_TYPE` in           #
 * #    `p09Type.ts`, rather than typed inline, so                      #
 * #    `apps/web/src/lib/p09Mirror.test.ts` can pin the chooser's      #
 * #    width gate against the numbers this file actually draws with.  #
 * #    Every value in it is the pack's, except the weight edit 2       #
 * #    explains.                                                      #
 * ####################################################################
 *
 * WHAT IS KEPT, ON PURPOSE: the full-frame picture at cover with its 2.5 percent
 * linear push and 5 px drift, the picture's own filter, the left and bottom
 * gradients, the inset vignette, the card's place at x 150 and y 335, its 760 px
 * width, padding, translucent fill, gold border and shadow, the 86 px slide and
 * fade from 0.08 s to 0.72 s, the 66 px gold rule drawn from 0.22 s to 0.82 s,
 * the label's size, tracking, line height, upper case and colour, the question's
 * size, line height, colour, text shadow and 650 px measure, its 14 px rise from
 * 0.42 s to 1.05 s, and the 0.35 s fade out.
 *
 * NO PICTURE BOX, SO RULING R1 IS NOT IN PLAY HERE. The still fills the 16:9
 * frame at cover, like every full-frame device, and the card sits over it.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. The two Remotion hooks below are
 * the only hooks this file may have, for the reason `P12.tsx` gives: segments
 * are cached by a hash of the PLAN, so anything not derived from the frame and
 * the props would let that cache serve a frame nobody drew.
 */

/** The three props the pack declares, unchanged. */
export type P09Props = {
  src: string
  sectionLabel: string
  question: string
}

/** Spread into every `interpolate`, typed as the contract rather than asserted. See `P12.tsx`. */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

export function P09({ src, sectionLabel, question }: P09Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const t = P09_TYPE

  /*
   * Every input range is strictly increasing for any `durationInFrames >= 2`, so
   * the template is safe at the SHOT's length rather than at the pack's 150.
   * `renderOne` hands it the scene's own `durationFrames`. The chooser's
   * `buildEndFrames` of 90 is what keeps a settled question on screen between
   * the entrance and the exit; it is not what stops a crash.
   */
  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.025], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -5], clamp)
  const entrance = interpolate(frame, [0.08 * fps, 0.72 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const cardX = interpolate(frame, [0.08 * fps, 0.72 * fps], [-86, 0], {
    ...clamp,
    easing: quietEase,
  })
  const ruleWidth = interpolate(frame, [0.22 * fps, 0.82 * fps], [0, t.rule.widthPx], {
    ...clamp,
    easing: quietEase,
  })
  const questionOpacity = interpolate(frame, [0.42 * fps, 1.05 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const questionY = interpolate(frame, [0.42 * fps, 1.05 * fps], [14, 0], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: exit, overflow: 'hidden' }}>
        {/*
          The template grades its own picture here, which is why `carriesOwnGrade`
          is true and `Scene` does not stack the house grade on top.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${String(backgroundX)}px 0px`,
            filter: 'sepia(0.06) saturate(0.86) contrast(1.04) brightness(0.78)',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(7, 7, 6, 0.42) 0%, rgba(7, 7, 6, 0.20) 42%, rgba(7, 7, 6, 0) 82%), linear-gradient(180deg, rgba(7, 7, 6, 0.06) 0%, rgba(7, 7, 6, 0.18) 100%)',
          opacity: exit,
        }}
      />

      <AbsoluteFill
        style={{
          boxShadow: 'inset 0 0 170px rgba(0, 0, 0, 0.46)',
          opacity: exit,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: t.cardLeftPx,
          top: t.cardTopPx,
          width: t.cardWidthPx,
          boxSizing: 'border-box',
          padding: `${String(t.cardPaddingTopPx)}px ${String(t.cardPaddingSidePx)}px ${String(t.cardPaddingBottomPx)}px ${String(t.cardPaddingSidePx)}px`,
          backgroundColor: t.cardFill,
          border: `${String(t.cardBorderPx)}px solid ${t.cardBorderColour}`,
          boxShadow: t.cardShadow,
          opacity: entrance * exit,
          translate: `${String(cardX)}px 0px`,
        }}
      >
        <div
          style={{
            width: ruleWidth,
            height: t.rule.heightPx,
            marginBottom: t.rule.marginBottomPx,
            backgroundColor: t.rule.colour,
            transformOrigin: 'left center',
          }}
        />
        {/*
          `.length > 0`, NOT truthiness, for the reason `P12.tsx` gives: the day
          a prop widens to `string | number`, `{sectionLabel && …}` prints a bare 0.
        */}
        {sectionLabel.length > 0 && (
          <div
            style={{
              marginBottom: t.label.marginBottomPx,
              color: t.label.colour,
              fontFamily: FONT_FAMILY,
              fontSize: t.label.fontSizePx,
              fontWeight: t.label.fontWeight,
              letterSpacing: t.label.letterSpacingPx,
              lineHeight: t.label.lineHeight,
              textTransform: 'uppercase',
            }}
          >
            {sectionLabel}
          </div>
        )}
        <div
          style={{
            maxWidth: t.question.maxWidthPx,
            color: t.question.colour,
            fontFamily: FONT_FAMILY,
            fontSize: t.question.fontSizePx,
            fontWeight: t.question.fontWeight,
            lineHeight: t.question.lineHeight,
            opacity: questionOpacity,
            translate: `0px ${String(questionY)}px`,
            textShadow: t.question.textShadow,
          }}
        >
          {question}
        </div>
      </div>
    </AbsoluteFill>
  )
}
