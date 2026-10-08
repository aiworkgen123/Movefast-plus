import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ReactNode } from 'react'
import { SourcedImg as Img } from '../SourcedImg.js'
import { FONT_FAMILY } from '../constants.js'
import { P05_TYPE, p05StrokeEndFrame } from './p05Type.js'

/**
 * P05 — text-left / image-right claim layout. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P05.tsx
 *   sha256    dab65751d37eae52b702fb972da2cf4aa88a0ad6ae0270eac11cb0a916636071
 *   lock      accepted_snapshots/P05_TextLeftImageRight/P05_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P05_TextLeftImageRight/P05.tsx hashes
 *             identically. `apps/worker/scripts/verify-template-locks.ts P05`
 *             said so on 2026-09-13, with all four locked hashes matching.
 *
 * `templates/` is gitignored and kept out of the worker image, so the hash above
 * is the whole audit trail, exactly as it is for `P12.tsx`, `P08.tsx`, `P04.tsx`
 * and `P02.tsx`.
 *
 * ####################################################################
 * # EIGHT EDITS WERE MADE TO THE COPY. Do not "restore" any of them. #
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
 * #    See the box on `P05_TYPE` in `p05Type.ts`.                     #
 * #                                                                   #
 * # 3  THE EYEBROW, THE SUPPORT LINE AND THE IMAGE LABEL ARE OMITTED   #
 * #    WHEN EMPTY. Each must be the narration's own words, and the     #
 * #    image label must also be in the picture's archive record, by   #
 * #    the developer's ruling. The chooser hands '' when they are not. #
 * #    An empty eyebrow `<div>` would still hold its 19 px margin and  #
 * #    a line of height, an empty support line its 28 px margin, and   #
 * #    an empty label its dark backing, a 28 by 19 px box drawn over   #
 * #    the corner of the picture. So each block goes, not only its     #
 * #    text. The headline is never empty: the schema refuses one.      #
 * #                                                                   #
 * # 4  THE PANEL IS SQUARE, 770 BY 770, not 770 by 820, by ruling R1:  #
 * #    no picture narrower than square reaches the screen. The two     #
 * #    upright strokes are 770 long to match. See `p05Type.ts`.        #
 * #                                                                   #
 * # 5  THE STROKE IS TIMED FROM THE SHOT'S LENGTH. The pack closes it  #
 * #    at a fixed 5 s, longer than any shot V50 held, so the fourth    #
 * #    edge was still drawing as the frame faded. It now closes at     #
 * #    `p05StrokeEndFrame`: the pack's 5 s, or one second before the   #
 * #    shot ends if that is sooner. On the pack's 180 frames, the same. #
 * #                                                                   #
 * # 6  The headline's `whiteSpace: 'pre-line'` is DROPPED. The pack    #
 * #    typed its own line breaks ("The source\nchanges the frame").    #
 * #    Here the headline is the planner's, and the width gate in       #
 * #    `p05Fit.ts` lays it out greedily on spaces. A stray newline     #
 * #    kept by `pre-line` would add a line the gate never counted;     #
 * #    under `normal` Chrome folds it into a space, which is what the  #
 * #    gate measures.                                                  #
 * #                                                                   #
 * # 7  `Img` is `SourcedImg`, which retries a slow storage fetch the  #
 * #    way every other device picture does.                           #
 * #                                                                   #
 * # 8  The type, panel and stroke numbers are read from `P05_TYPE` in  #
 * #    `p05Type.ts`, rather than typed inline, so                      #
 * #    `apps/web/src/lib/p05Mirror.test.ts` can pin the chooser's      #
 * #    width gates against the numbers this file actually draws with. #
 * #    Every value in it is the pack's, except edits 2, 4 and 5.       #
 * ####################################################################
 *
 * WHAT IS KEPT, ON PURPOSE: the near-black ground (it is the ground here, not a
 * fill behind a picture, so unlike `P02.tsx` it stays the pack's #0b0c0c), the
 * 44 px warm grid, the directional gradient and the inset vignette; the text
 * column 145 px from the left, 760 px wide with its 82 px right padding and
 * centred on the frame's height; the 72 px gold rule; the eyebrow's, headline's
 * and support line's sizes, trackings, line heights, colours and shadow, the
 * upper case on the eyebrow and headline, the italic on the support line and its
 * 580 px measure; the text's fade and 20 px rise from 0.35 s to 1.25 s; the
 * panel 1000 px from the left, centred on the height, its 12 px padding, backing
 * and shadow; the picture at cover with its linear 4 percent push, 8 px drift,
 * 0.25 s fade and the pack's own filter; the 5 px stroke drawn clockwise from the
 * top-left corner square, top, right, bottom, left; the image label's place,
 * padding, backing, size, tracking and upper case; and the 0.35 s fade out.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. The two Remotion hooks below are
 * the only hooks this file may have, for the reason `P12.tsx` gives: segments
 * are cached by a hash of the PLAN, so anything not derived from the frame and
 * the props would let that cache serve a frame nobody drew.
 */

/** The five props the pack declares, unchanged. */
export type P05Props = {
  src: string
  eyebrow: string
  headline: string
  supportLine: string
  imageLabel: string
}

/** Spread into every `interpolate`, typed as the contract rather than asserted. See `P12.tsx`. */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

export function P05({ src, eyebrow, headline, supportLine, imageLabel }: P05Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const t = P05_TYPE

  /*
   * Every input range is strictly increasing for any `durationInFrames >= 2`, so
   * the template is safe at the SHOT's length rather than at the pack's 180.
   * `renderOne` hands it the scene's own `durationFrames`. The chooser's
   * `buildEndFrames` of 120 is what keeps settled type and a closed frame on
   * screen between the entrance and the exit; it is not what stops a crash.
   */
  const imageScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.04], {
    ...clamp,
    easing: Easing.linear,
  })
  const imageX = interpolate(frame, [0, durationInFrames - 1], [0, -8], clamp)
  const imageOpacity = interpolate(frame, [0, 0.25 * fps], [0, 1], clamp)
  /* Edit 5. Four edges over the stroke's clock, one after another, as the pack draws them. */
  const drawPosition = interpolate(frame, [0, p05StrokeEndFrame(durationInFrames, fps)], [0, 4], clamp)
  const segmentProgress = (offset: number): number => Math.min(Math.max(drawPosition - offset, 0), 1)
  const topProgress = segmentProgress(0)
  const rightProgress = segmentProgress(1)
  const bottomProgress = segmentProgress(2)
  const leftProgress = segmentProgress(3)
  const textOpacity = interpolate(frame, [0.35 * fps, 1.25 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const textY = interpolate(frame, [0.35 * fps, 1.25 * fps], [20, 0], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - t.exitSeconds * fps, durationInFrames], [1, 0], clamp)

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0c0c', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(190, 156, 96, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(190, 156, 96, 0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          opacity: 0.8,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(8, 9, 9, 0.20) 0%, rgba(8, 9, 9, 0.10) 52%, rgba(8, 9, 9, 0.68) 100%)',
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: t.columnLeftPx,
          opacity: Math.min(textOpacity, exit),
          translate: `0px ${String(textY)}px`,
        }}
      >
        <div style={{ width: t.columnWidthPx, paddingRight: t.columnPaddingRightPx }}>
          <div
            style={{
              width: t.rule.widthPx,
              height: t.rule.heightPx,
              marginBottom: t.rule.marginBottomPx,
              backgroundColor: t.rule.colour,
            }}
          />
          {/*
            `.length > 0`, NOT truthiness, for the reason `P12.tsx` gives: the day
            a prop widens to `string | number`, `{eyebrow && …}` prints a bare 0.
          */}
          {eyebrow.length > 0 && (
            <div
              style={{
                marginBottom: t.eyebrow.marginBottomPx,
                color: t.eyebrow.colour,
                fontFamily: FONT_FAMILY,
                fontSize: t.eyebrow.fontSizePx,
                fontWeight: t.eyebrow.fontWeight,
                letterSpacing: t.eyebrow.letterSpacingPx,
                lineHeight: t.eyebrow.lineHeight,
                textTransform: 'uppercase',
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              color: t.headline.colour,
              fontFamily: FONT_FAMILY,
              fontSize: t.headline.fontSizePx,
              fontWeight: t.headline.fontWeight,
              letterSpacing: t.headline.letterSpacingPx,
              lineHeight: t.headline.lineHeight,
              textTransform: 'uppercase',
              textShadow: t.headline.textShadow,
            }}
          >
            {headline}
          </div>
          {supportLine.length > 0 && (
            <div
              style={{
                maxWidth: t.support.maxWidthPx,
                marginTop: t.support.marginTopPx,
                color: t.support.colour,
                fontFamily: FONT_FAMILY,
                fontSize: t.support.fontSizePx,
                fontStyle: 'italic',
                fontWeight: t.support.fontWeight,
                letterSpacing: t.support.letterSpacingPx,
                lineHeight: t.support.lineHeight,
              }}
            >
              {supportLine}
            </div>
          )}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: t.panel.leftPx,
          opacity: Math.min(imageOpacity, exit),
        }}
      >
        <div
          style={{
            position: 'relative',
            width: t.panel.widthPx,
            height: t.panel.heightPx,
            padding: t.panel.paddingPx,
            backgroundColor: t.panel.backgroundColour,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.36)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
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
                scale: imageScale,
                translate: `${String(imageX)}px 0px`,
                filter: 'sepia(0.12) saturate(0.82) contrast(1.06) brightness(0.86)',
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: t.stroke.thicknessPx,
              height: t.stroke.thicknessPx,
              backgroundColor: t.stroke.colour,
              zIndex: 3,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: t.panel.widthPx * topProgress,
              height: t.stroke.thicknessPx,
              backgroundColor: t.stroke.colour,
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: t.stroke.thicknessPx,
              height: t.panel.heightPx * rightProgress,
              backgroundColor: t.stroke.colour,
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: t.panel.widthPx * bottomProgress,
              height: t.stroke.thicknessPx,
              backgroundColor: t.stroke.colour,
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: t.stroke.thicknessPx,
              height: t.panel.heightPx * leftProgress,
              backgroundColor: t.stroke.colour,
              zIndex: 2,
            }}
          />
          {imageLabel.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: t.imageLabel.insetPx,
                bottom: t.imageLabel.insetPx,
                padding: `${String(t.imageLabel.paddingTopPx)}px ${String(t.imageLabel.paddingSidePx)}px ${String(t.imageLabel.paddingBottomPx)}px ${String(t.imageLabel.paddingSidePx)}px`,
                color: t.imageLabel.colour,
                backgroundColor: t.imageLabel.backgroundColour,
                fontFamily: FONT_FAMILY,
                fontSize: t.imageLabel.fontSizePx,
                fontWeight: t.imageLabel.fontWeight,
                letterSpacing: t.imageLabel.letterSpacingPx,
                lineHeight: t.imageLabel.lineHeight,
                textTransform: 'uppercase',
              }}
            >
              {imageLabel}
            </div>
          )}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ boxShadow: 'inset 0 0 190px rgba(0, 0, 0, 0.52)' }} />
    </AbsoluteFill>
  )
}
