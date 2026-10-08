import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ReactNode } from 'react'
import { SourcedImg as Img } from '../SourcedImg.js'
import { FONT_FAMILY } from '../constants.js'
import { P02_TYPE } from './p02Type.js'

/**
 * P02 — premium editorial card. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P02.tsx
 *   sha256    120b87f02aae96f5b0da858b270465b776f1a94485b1cc64de3b34fac593d4fc
 *   lock      accepted_snapshots/P02_EditorialCard/P02_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P02_EditorialCard/P02.tsx hashes identically.
 *             `apps/worker/scripts/verify-template-locks.ts P02` said so on
 *             2026-09-13, with all four locked hashes matching.
 *
 * `templates/` is gitignored and kept out of the worker image, so the hash above
 * is the whole audit trail, exactly as it is for `P12.tsx`, `P08.tsx` and
 * `P04.tsx`.
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
 * #    exists. The pack named Arial bold and Georgia bold, which are   #
 * #    not on the render box and would miss to Liberation without a   #
 * #    word. See the box on `P02_TYPE` in `p02Type.ts`.                #
 * #                                                                   #
 * # 3  THE LABEL IS OMITTED WHEN EMPTY. Its words must be spoken in    #
 * #    the shot, and the chooser hands '' when they are not, or when   #
 * #    the label would wrap or repeat a word of the headline. An empty #
 * #    `<div>` would still hold its 24 px margin and a line of height  #
 * #    between the rule and the headline, so the block goes, not only  #
 * #    its text. The headline is never empty: the schema refuses one.  #
 * #                                                                   #
 * # 4  The root fill is plain black, not the pack's near-black. This  #
 * #    mounts inside `Scene`'s own black root, as `P04.tsx` does.      #
 * #                                                                   #
 * # 5  `Img` is `SourcedImg`, which retries a slow storage fetch the  #
 * #    way every other device picture does.                           #
 * #                                                                   #
 * # 6  The card and type numbers are read from `P02_TYPE` in           #
 * #    `p02Type.ts`, rather than typed inline, so                      #
 * #    `apps/web/src/lib/p02Mirror.test.ts` can pin the chooser's      #
 * #    width gate against the numbers this file actually draws with.  #
 * #    Every value in it is the pack's, except the weight edit 2       #
 * #    explains.                                                      #
 * ####################################################################
 *
 * WHAT IS KEPT, ON PURPOSE: the full-frame picture at cover with its 1.8 percent
 * eased push, the picture's own filter, the left gradient, the inset vignette,
 * the card's place 170 px from the left and centred on the frame's height, its
 * 650 px width, 370 px minimum height, padding, paper colour, border and shadow,
 * the slide from -820 px over 1.15 s with no bounce and no zoom, the 66 px gold
 * rule growing with the slide, the label's size, tracking, line height, upper
 * case and colour, the headline's size, line height, colour and 530 px measure,
 * and the 0.35 s fade in and fade out.
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
export type P02Props = {
  src: string
  label: string
  headline: string
}

/** Spread into every `interpolate`, typed as the contract rather than asserted. See `P12.tsx`. */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

export function P02({ src, label, headline }: P02Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const t = P02_TYPE

  /*
   * Every input range is strictly increasing for any `durationInFrames >= 2`, so
   * the template is safe at the SHOT's length rather than at the pack's 180.
   * `renderOne` hands it the scene's own `durationFrames`. The chooser's
   * `buildEndFrames` of 90 is what keeps a settled card on screen between the
   * entrance and the exit; it is not what stops a crash.
   */
  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.018], {
    ...clamp,
    easing: quietEase,
  })
  const cardProgress = interpolate(frame, [0, 1.15 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const cardX = interpolate(frame, [0, 1.15 * fps], [-820, 0], {
    ...clamp,
    easing: quietEase,
  })
  const cardOpacity = interpolate(frame, [0, 0.35 * fps], [0, 1], clamp)
  const exitOpacity = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)
  const contentOpacity = Math.min(cardOpacity, exitOpacity)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
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
            filter: 'sepia(0.08) saturate(0.82) contrast(1.04) brightness(0.82)',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(7, 8, 8, 0.38) 0%, rgba(7, 8, 8, 0.10) 55%, rgba(7, 8, 8, 0) 100%)',
        }}
      />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.56)' }} />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: t.cardLeftPx,
          opacity: contentOpacity,
        }}
      >
        <div
          style={{
            width: t.cardWidthPx,
            minHeight: t.cardMinHeightPx,
            padding: `${String(t.cardPaddingTopPx)}px ${String(t.cardPaddingSidePx)}px ${String(t.cardPaddingBottomPx)}px ${String(t.cardPaddingSidePx)}px`,
            backgroundColor: t.cardColour,
            border: `${String(t.cardBorderPx)}px solid rgba(56, 48, 39, 0.22)`,
            boxShadow: '18px 24px 42px rgba(0, 0, 0, 0.28)',
            translate: `${String(cardX)}px 0px`,
          }}
        >
          <div
            style={{
              width: t.rule.widthPx,
              height: t.rule.heightPx,
              marginBottom: t.rule.marginBottomPx,
              backgroundColor: t.rule.colour,
              scale: `${String(cardProgress)} 1`,
              transformOrigin: 'left center',
            }}
          />
          {/*
            `.length > 0`, NOT truthiness, for the reason `P12.tsx` gives: the day
            a prop widens to `string | number`, `{label && …}` prints a bare 0.
          */}
          {label.length > 0 && (
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
              {label}
            </div>
          )}
          <div
            style={{
              color: t.headline.colour,
              fontFamily: FONT_FAMILY,
              fontSize: t.headline.fontSizePx,
              fontWeight: t.headline.fontWeight,
              lineHeight: t.headline.lineHeight,
              maxWidth: t.headline.maxWidthPx,
            }}
          >
            {headline}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
