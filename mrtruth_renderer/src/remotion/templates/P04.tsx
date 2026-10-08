import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ReactNode } from 'react'
import { SourcedImg as Img } from '../SourcedImg.js'
import { FONT_FAMILY } from '../constants.js'
import { P04_TYPE } from './p04Type.js'

/**
 * P04 — restrained lower-left label. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P04.tsx
 *   sha256    e13b929f41fb65742e7d3e7eba2cb04893cbb54470f3086886dcccfea708f502
 *   lock      accepted_snapshots/P04_LowerLeftLabel/P04_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P04_LowerLeftLabel/P04.tsx hashes identically.
 *             `apps/worker/scripts/verify-template-locks.ts P04` said so on
 *             2026-09-13, with all four locked hashes matching.
 *
 * `templates/` is gitignored and kept out of the worker image, so the hash above
 * is the whole audit trail, exactly as it is for `P12.tsx` and `P08.tsx`.
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
 * # 2  Both font stacks become `FONT_FAMILY`, at weights that exist.  #
 * #    The pack named Arial bold and Georgia italic, which are not on #
 * #    the render box and would miss to Liberation without a word.    #
 * #    See the box on `P04_TYPE` in `p04Type.ts`.                     #
 * #                                                                   #
 * # 3  THE SUPPORT LINE IS OMITTED WHEN EMPTY. Its words must be       #
 * #    spoken in the shot AND in the picture's archive record, by the  #
 * #    developer's ruling, and the chooser hands '' when they are not. #
 * #    An empty `<div>` would still hold its 8 px margin and a line of #
 * #    height under the label, so the block goes, not only its text.   #
 * #    The main line is never empty: the schema refuses an empty one.  #
 * #                                                                   #
 * # 4  The root fill is plain black, not the pack's near-black. This  #
 * #    mounts inside `Scene`'s own black root, as `P12.tsx` and        #
 * #    `P08.tsx` do.                                                  #
 * #                                                                   #
 * # 5  `Img` is `SourcedImg`, which retries a slow storage fetch the  #
 * #    way every other device picture does.                           #
 * #                                                                   #
 * # 6  The type numbers are read from `P04_TYPE` in `p04Type.ts`,      #
 * #    rather than typed inline, so `apps/web/src/lib/p04Mirror.test.ts`#
 * #    can pin the chooser's width gate against the numbers this file  #
 * #    actually draws with. Every value in it is the pack's, except    #
 * #    the two weights edit 2 explains.                                #
 * ####################################################################
 *
 * WHAT IS KEPT, ON PURPOSE: the full-frame picture at cover with its 5 percent
 * linear push and 8 px drift, the picture's own filter, the bottom gradient, the
 * inset vignette, the label's place 138 px from the left and 112 px from the
 * bottom, the 620 px block, the 4 px gold rule growing to 42 px, both sizes, both
 * trackings, both line heights, both text shadows, the upper case, the italic on
 * the support line, the pack's own ivory and golds, and every entrance and exit
 * time. `P03.tsx` kept the same ivory and gold for its own two lines.
 *
 * NO PICTURE BOX, SO RULING R1 IS NOT IN PLAY HERE. The still fills the 16:9
 * frame at cover, like every full-frame device.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. The two Remotion hooks below are
 * the only hooks this file may have, for the reason `P12.tsx` gives: segments
 * are cached by a hash of the PLAN, so anything not derived from the frame and
 * the props would let that cache serve a frame nobody drew.
 */

/** The three props the pack declares, unchanged. */
export type P04Props = {
  src: string
  mainLine: string
  supportLine: string
}

/** Spread into every `interpolate`, typed as the contract rather than asserted. See `P12.tsx`. */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

export function P04({ src, mainLine, supportLine }: P04Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const t = P04_TYPE

  /*
   * Every input range is strictly increasing for any `durationInFrames >= 2`, so
   * the template is safe at the SHOT's length rather than at the pack's 150.
   * `renderOne` hands it the scene's own `durationFrames`. The chooser's
   * `buildEndFrames` of 60 is what keeps a settled label on screen between the
   * entrance and the exit; it is not what stops a crash.
   */
  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.05], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -8], clamp)
  const entrance = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)
  const labelOpacity = Math.min(entrance, exit)
  const labelY = interpolate(frame, [0, 0.55 * fps], [16, 0], {
    ...clamp,
    easing: quietEase,
  })
  const ruleWidth = interpolate(frame, [0.1 * fps, 0.5 * fps], [0, t.rule.widthPx], {
    ...clamp,
    easing: quietEase,
  })

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
            translate: `${String(backgroundX)}px 0px`,
            filter: 'sepia(0.10) saturate(0.84) contrast(1.05) brightness(0.82)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(0deg, rgba(9, 7, 4, 0.74) 0%, rgba(9, 7, 4, 0.30) 30%, rgba(9, 7, 4, 0) 58%)',
        }}
      />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.46)' }} />

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          paddingLeft: t.labelLeftPx,
          paddingBottom: t.labelBottomPx,
          opacity: labelOpacity,
          translate: `0px ${String(labelY)}px`,
        }}
      >
        <div style={{ maxWidth: t.labelMaxWidthPx }}>
          <div
            style={{
              width: ruleWidth,
              height: t.rule.heightPx,
              marginBottom: t.rule.marginBottomPx,
              backgroundColor: t.rule.colour,
            }}
          />
          <div
            style={{
              color: t.main.colour,
              fontFamily: FONT_FAMILY,
              fontSize: t.main.fontSizePx,
              fontWeight: t.main.fontWeight,
              letterSpacing: t.main.letterSpacingPx,
              lineHeight: t.main.lineHeight,
              textTransform: 'uppercase',
              textShadow: t.main.textShadow,
            }}
          >
            {mainLine}
          </div>
          {/*
            `.length > 0`, NOT truthiness, for the reason `P12.tsx` gives: the day
            a prop widens to `string | number`, `{line && …}` prints a bare 0.
          */}
          {supportLine.length > 0 && (
            <div
              style={{
                marginTop: t.support.marginTopPx,
                color: t.support.colour,
                fontFamily: FONT_FAMILY,
                fontSize: t.support.fontSizePx,
                fontStyle: 'italic',
                fontWeight: t.support.fontWeight,
                letterSpacing: t.support.letterSpacingPx,
                lineHeight: t.support.lineHeight,
                textTransform: 'uppercase',
                textShadow: t.support.textShadow,
              }}
            >
              {supportLine}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
