import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ReactNode } from 'react'
import { SourcedImg as Img } from '../SourcedImg.js'
import { FONT_FAMILY } from '../constants.js'

/**
 * P08 — fullscreen source evidence. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P08.tsx
 *   sha256    f0c23b355675562095957dd2207c413f40bc032ba456f0422600fe089a7e02fc
 *   lock      accepted_snapshots/P08_FullscreenSource/P08_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P08_FullscreenSource/P08.tsx hashes identically.
 *             `apps/worker/scripts/verify-template-locks.ts P08` said so on
 *             2026-09-13, with all four locked hashes matching.
 *
 * `templates/` is gitignored and kept out of the worker image, so the hash above
 * is the whole audit trail, exactly as it is for `P12.tsx`.
 *
 * ####################################################################
 * # FIVE EDITS WERE MADE TO THE COPY. Do not "restore" any of them.  #
 * #                                                                   #
 * # 1  The pack's asset-path helper import and its default-props      #
 * #    export are DELETED, for the reason `P12.tsx` edit 1 gives: a   #
 * #    Studio default that resolves a scraped fixture is how such a   #
 * #    frame reaches a real render by accident. The picture arrives   #
 * #    as `src`, built by the worker from the plan's own asset.       #
 * #                                                                   #
 * # 2  Both font stacks become `FONT_FAMILY`, at weights that exist.  #
 * #    The pack named macOS faces with no files, which miss to        #
 * #    Liberation Sans on the render box without a word. See the box  #
 * #    on `TAG_WEIGHT`.                                               #
 * #                                                                   #
 * # 3  THE SOURCE TAG AND THE SOURCE DETAIL ARE OMITTED WHEN EMPTY,   #
 * #    AND IN THIS FILM THEY ARE ALWAYS EMPTY. The developer ruled     #
 * #    that P08 prints no words at all. Both lines name the source of #
 * #    the picture, and nothing in this pipeline may invent that      #
 * #    (T-18 condition 2). `SceneDeviceSchema`'s P08 arm carries no   #
 * #    string, and `DeviceFrame` hands both props as ''. An empty     #
 * #    `<div>` would still slide and fade with nothing in it, so the  #
 * #    block goes, not only its text.                                 #
 * #                                                                   #
 * # 4  The root fill is plain black, not the pack's near-black. This  #
 * #    mounts inside `Scene`'s own black root and fades to it on the   #
 * #    exit, so two near-blacks would meet at the last frame.          #
 * #                                                                   #
 * # 5  `Img` is `SourcedImg`, which retries a slow storage fetch the  #
 * #    way every other device picture does.                           #
 * ####################################################################
 *
 * WHAT IS KEPT, ON PURPOSE: the 1728 by 972 frame at x 96 and y 88, its 4 px
 * muted-gold border and shadow, the blurred dark copy behind it, the gradient,
 * the gold rule, the 1.8 percent push with its drift, every entrance and exit
 * time, the picture's own filter and the pack's own golds. P12's port moved its
 * colours onto the film's palette because its type sits next to the text cards.
 * P08 sets no type, so its gold is only the frame the pack's preview shows, and
 * it stays the gold that was approved.
 *
 * THE FRAME IS 16:9, SO RULING R1 HOLDS HERE. The picture is drawn `cover` into
 * the 1720 by 964 inside of the border, which is wider than tall, so no picture
 * narrower than square reaches the screen through this device.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. The two Remotion hooks below are
 * the only hooks this file may have, for the reason `P12.tsx` gives: segments
 * are cached by a hash of the PLAN, so anything not derived from the frame and
 * the props would let that cache serve a frame nobody drew.
 */

/** The three props the pack declares, unchanged. */
export type P08Props = {
  src: string
  sourceTag: string
  sourceDetail: string
}

/**
 * ####################################################################
 * # THE WEIGHTS ARE DECIDED HERE, NOT LEFT TO CHROME.                 #
 * #                                                                   #
 * # The pack set 700 on the tag and 600 on the detail. `FONT_FAMILY`  #
 * # registers Libre Franklin at 300, 500, 600 and 800 (`fonts.ts`),   #
 * # and a weight the browser cannot honour synthesises silently. 600  #
 * # is the registered weight `P12.tsx` takes for the pack's 700, and  #
 * # the detail's 600 is registered as it is. Neither block renders in #
 * # this film today, because both strings are always empty.           #
 * ####################################################################
 */
const TAG_WEIGHT = 600
const DETAIL_WEIGHT = 600

/** The pack's frame, unchanged. 1728 by 972 is 16:9. */
const documentFrame: { left: number; top: number; width: number; height: number } = {
  left: 96,
  top: 88,
  width: 1728,
  height: 972,
}

/** Spread into every `interpolate`, typed as the contract rather than asserted. See `P12.tsx`. */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

export function P08({ src, sourceTag, sourceDetail }: P08Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  /*
   * Every input range is strictly increasing for any `durationInFrames >= 2`, so
   * the template is safe at the SHOT's length rather than at the pack's 150.
   * `renderOne` hands it the scene's own `durationFrames`. The chooser's
   * `buildEndFrames` of 60 is what keeps a settled frame on screen between the
   * entrance and the exit; it is not what stops a crash.
   */
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)
  const documentOpacity = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const tagProgress = interpolate(frame, [0.1 * fps, 0.65 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const documentScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.018], {
    ...clamp,
    easing: Easing.linear,
  })
  const documentX = interpolate(frame, [0, durationInFrames - 1], [0, -3.2], {
    ...clamp,
    easing: Easing.linear,
  })
  const documentY = interpolate(frame, [0, durationInFrames - 1], [0, -1.4], {
    ...clamp,
    easing: Easing.linear,
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {/*
        The dark blurred copy that keeps the whole frame occupied. The template
        grades its own pictures here, which is why `carriesOwnGrade` is true and
        `Scene` does not stack the house grade on top.
      */}
      <AbsoluteFill style={{ opacity: exit }}>
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: 1.06,
            filter: 'blur(28px) saturate(0.42) brightness(0.30) contrast(0.96)',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(12, 11, 9, 0.88) 0%, rgba(12, 11, 9, 0.18) 24%, rgba(12, 11, 9, 0.28) 100%), radial-gradient(circle at 50% 48%, rgba(190, 145, 76, 0.12), transparent 63%)',
          opacity: exit,
        }}
      />

      {/*
        `.length > 0`, NOT truthiness, for the reason `P12.tsx` gives: the day a
        prop widens to `string | number`, `{tag && …}` prints a bare 0.
      */}
      {sourceTag.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: documentFrame.left,
            top: 26,
            color: '#c39a52',
            fontFamily: FONT_FAMILY,
            fontSize: 15,
            fontWeight: TAG_WEIGHT,
            letterSpacing: 4,
            lineHeight: 1.1,
            textTransform: 'uppercase',
            opacity: tagProgress * exit,
            translate: `0px ${interpolate(tagProgress, [0, 1], [10, 0], clamp)}px`,
          }}
        >
          {sourceTag}
        </div>
      )}
      {sourceDetail.length > 0 && (
        <div
          style={{
            position: 'absolute',
            right: documentFrame.left,
            top: 28,
            color: 'rgba(238, 230, 215, 0.64)',
            fontFamily: FONT_FAMILY,
            fontSize: 13,
            fontWeight: DETAIL_WEIGHT,
            letterSpacing: 2.6,
            lineHeight: 1.1,
            textTransform: 'uppercase',
            opacity: tagProgress * exit,
          }}
        >
          {sourceDetail}
        </div>
      )}

      {/* The gold rule over the frame, drawing left to right. Kept with no words above it. */}
      <div
        style={{
          position: 'absolute',
          left: documentFrame.left,
          top: 61,
          width: documentFrame.width,
          height: 2,
          backgroundColor: 'rgba(195, 154, 82, 0.62)',
          transformOrigin: 'left center',
          scale: `${tagProgress} 1`,
          opacity: exit,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: documentFrame.left,
          top: documentFrame.top,
          width: documentFrame.width,
          height: documentFrame.height,
          boxSizing: 'border-box',
          backgroundColor: '#e8dfce',
          border: '4px solid rgba(195, 154, 82, 0.86)',
          boxShadow: '0 26px 70px rgba(0, 0, 0, 0.52)',
          overflow: 'hidden',
          opacity: documentOpacity * exit,
        }}
      >
        <div style={{ position: 'absolute', inset: 4, overflow: 'hidden' }}>
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              scale: documentScale,
              translate: `${documentX}px ${documentY}px`,
              filter: 'saturate(0.90) contrast(1.04) brightness(0.96)',
            }}
          />
        </div>
      </div>

      <AbsoluteFill
        style={{
          boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.50)',
          opacity: exit,
        }}
      />
    </AbsoluteFill>
  )
}
