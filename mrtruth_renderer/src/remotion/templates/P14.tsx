import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ReactNode } from 'react'
import { SourcedImg as Img } from '../SourcedImg.js'
import { FONT_FAMILY, TEXT_CARD } from '../constants.js'
import { P14_TYPE, digitsOf } from './p14Type.js'

/**
 * P14 — fast year / date odometer. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P14.tsx
 *   sha256    cbce540400ec7927fb15b4e5320bd70eb8aa8207815dad2da7addd81103055fa
 *   lock      accepted_snapshots/P14_FastDateOdometer/P14_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P14_FastDateOdometer/P14.tsx hashes identically.
 *             `apps/worker/scripts/verify-template-locks.ts P14` said so on
 *             2026-09-13, with all FIVE locked hashes matching.
 *
 * `templates/` is gitignored and kept out of the worker image, so the hash above
 * is the whole audit trail, exactly as it is for `P12.tsx`, `P08.tsx`,
 * `P04.tsx`, `P02.tsx`, `P09.tsx` and `P05.tsx`.
 *
 * ####################################################################
 * # SEVEN EDITS WERE MADE TO THE COPY. Do not "restore" any of them.  #
 * #                                                                   #
 * # 1  The pack's asset-path helper import and its whole default-     #
 * #    props export are DELETED, for the reason `P12.tsx` edit 1      #
 * #    gives: that export resolves a scraped fixture out of the       #
 * #    pack's own `public/assets/` and is the Studio default, so it   #
 * #    renders the moment anyone opens the composition. The picture   #
 * #    arrives as `src`, built by `assetUrlFor` in                    #
 * #    `apps/worker/src/stages/render.ts` from the plan's own asset.  #
 * #                                                                   #
 * # 2  Both font stacks become `FONT_FAMILY`, at weights that exist.  #
 * #    The pack named a macOS serif for the digits and the detail and #
 * #    a macOS sans for both labels, with no font file and no         #
 * #    `@font-face` for either. See the box on `P14_TYPE`.            #
 * #                                                                   #
 * # 3  The pack's hexes become ONE gold and ONE ivory read from       #
 * #    `constants.ts`, plus a plain black root fill, exactly as       #
 * #    `P12.tsx` edit 3 did. See `GOLD` and `IVORY` below.            #
 * #                                                                   #
 * # 4  THE FIXED VERIFICATION TAG IS CUT, the way `P12.tsx` edit 4    #
 * #    cut its kicker, and the whole `<div>` goes rather than its     #
 * #    string. The pack sets a hardcoded upper-case line under the    #
 * #    detail asserting that the date has been checked. It is not on  #
 * #    `P14Props`, so it cannot be changed through data, and NOTHING  #
 * #    IN THIS PIPELINE HAS VERIFIED THAT DATE. T-18 condition 2: a   #
 * #    claim nobody checked is never printed. It is also an English   #
 * #    UI label on a frame of a documentary about biblical            #
 * #    manuscripts, which `P12.tsx` calls a P0 defect in its own      #
 * #    words.                                                         #
 * #                                                                   #
 * #    LIKE `P12.tsx`'s FIVE, THIS EDIT DOES NOT QUOTE THE STRING IT  #
 * #    REMOVED, and that is deliberate rather than vague: a `grep`    #
 * #    over this file for the cut literal must come back EMPTY, and a #
 * #    header that quoted it would fail the very check that proves    #
 * #    the edit was made. The literal is written out in the pack's    #
 * #    own contract and in this commit's message, which is where it   #
 * #    belongs. The same rule covers the pack's four font stacks and  #
 * #    its five hexes, none of which appear anywhere below.           #
 * #                                                                   #
 * #    GEOMETRY CONSEQUENCE, stated so nobody hunts it later: the     #
 * #    block is top-anchored, so losing a 13 px line at lineHeight    #
 * #    1.15 plus its 14 px top margin shortens the block by about     #
 * #    29 px. Nothing above it moves. Expected, not a bug.            #
 * #                                                                   #
 * # 5  The `label` and `detail` blocks are OMITTED ENTIRELY when      #
 * #    their string is empty, rather than rendering an empty div with #
 * #    its margins, exactly as `P12.tsx` edit 5 does for the same two #
 * #    kinds of string. Both arrive as `''` in Rung 1 — nothing here  #
 * #    has a verified source for a year's caption or its label, and   #
 * #    inventing one is the worst defect this template could ship —   #
 * #    so the empty case is the ONLY case that renders today. An      #
 * #    empty label div would leave the digits floating under 28 px of #
 * #    dead margin and read as a layout bug.                          #
 * #                                                                   #
 * # 6  `Img` is `SourcedImg`, which retries a slow storage fetch the  #
 * #    way every other device picture does.                           #
 * #                                                                   #
 * # 7  The column, mask and type numbers are read from `P14_TYPE` in  #
 * #    `p14Type.ts` rather than typed inline, so                      #
 * #    `apps/web/src/lib/p14Mirror.test.ts` can pin the digit column  #
 * #    against the advances of the face this file actually draws      #
 * #    with. Every value in it is the pack's except the weights and   #
 * #    the mask stops, and its box says why each moved.               #
 * ####################################################################
 *
 * WHAT IS KEPT, ON PURPOSE: the full-frame picture at cover with its 3.5 percent
 * linear push and its 10 px by 4 px drift, the picture's own warm filter, the
 * right-side readability veil and the top-and-bottom gradient, the inset
 * vignette, the block's place at top 112 and right 132 in a 600 px right-aligned
 * measure, its 46 px slide and fade from 0.06 s to 0.78 s, four 104 px digit
 * columns 7 px apart on a 40-entry strip, each rolling twenty places from
 * `target + 30` to `target + 10` on `Easing.out(cubic)`, the per-column roll
 * starts at 0.12 s, 0.21 s, 0.30 s and 0.39 s and locks at 0.58 s, 0.69 s,
 * 0.80 s and 0.91 s, the 430 px gold rule drawn from 0.32 s to 0.92 s, the
 * detail's 15 px rise from 0.62 s to 1.16 s, and the 0.35 s fade out.
 *
 * WHAT IT DRAWS IN RUNG 1, said plainly because it is much less than the pack's
 * preview: a graded still pushing 3.5 percent, four digits rolling to a locked
 * four-digit year in the upper right, and a gold rule under them. No label, no
 * caption, no tag. The year is the whole message, which is exactly what P12
 * draws too — P14 is the FAST treatment of the same fact, and the two are equal
 * choices rather than one superseding the other (see `deviceChoice.ts` G15).
 *
 * NO PICTURE BOX, SO RULING R1 IS NOT IN PLAY HERE. The still fills the 16:9
 * frame at cover, like every full-frame device.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS, AND IT HAS TO STAY ONE. The two
 * Remotion hooks below are the only hooks this file may ever have, for the
 * reason `P12.tsx` gives at length: segments render in isolation and are cached
 * by `computeRenderKey`, which hashes the PLAN, so anything in here not derived
 * from the frame and the props would let that cache serve a frame that was never
 * drawn from these inputs. No `useState`, no `useEffect`, no `useMemo`, no
 * `memo`, no `Math.random`, no `Date`, no DOM access.
 *
 * The typeface is registered by `useDocumentaryFont()` on `Scene`'s first line,
 * which holds frame 0 behind a `delayRender` gate until the face is real. This
 * file therefore loads no font of its own.
 */

/** The four props the pack declares, unchanged. Four plain strings, nothing else. */
export type P14Props = {
  src: string
  /**
   * THE VERIFIED YEAR, AND IT ARRIVES AS FOUR DIGITS OR NOT AT ALL.
   *
   * ##################################################################
   * # THE PACK'S RENDERER IS LOSSY AND THE CHOOSER IS WHAT MAKES IT   #
   * # SAFE. `digitsOf` below is the pack's own rule: strip every      #
   * # non-digit, keep the LAST FOUR, pad to four with leading zeroes. #
   * # Hand it the pack's own contract wording — "verified four-digit  #
   * # year/date" — and it is the identity. Hand it anything else and  #
   * # it invents a year without a word:                              #
   * #                                                                 #
   * #   "364 CE"              -> "0364", a different year             #
   * #   "third century BCE"   -> "0000", a year nobody said           #
   * #   "1947-1956"           -> "1956", one end of a range           #
   * #                                                                 #
   * # SO THE CHOOSER FEEDS THIS FROM `bareYear` ALONE and only when   #
   * # the mark is exactly four digits (`deviceChoice.ts`, the P14 arm #
   * # of `buildCopy`), and `SceneDeviceSchema` refuses anything else  #
   * # a second time at the plan boundary. The padding below is        #
   * # therefore unreachable in a real film, and it is KEPT rather     #
   * # than deleted so this file still draws the pack's frame if it is #
   * # ever mounted from a hand-written plan, in Studio, or by a test. #
   * ##################################################################
   */
  targetYear: string
  /** Reserved. Always '' today; '' omits the block entirely. See edit 5. */
  label: string
  /** Reserved. Always '' today; '' omits the block entirely. See edit 5. */
  detail: string
}

/**
 * ONE gold and ONE ivory, read from the film's own constants rather than
 * restated as literals here, exactly as `P12.tsx` does.
 *
 * The pack carried five distinct hexes for what are really two colours, plus a
 * near-black root fill. Four of them are a hair off the film's palette and the
 * fifth is a hair off black, which is precisely the kind of difference that
 * survives review and then reads as a graphic from a different project once it
 * is cut next to the text cards. `P14_TYPE.digits.colour` is the same ivory and
 * is stated there because the mirror test reads the column without this file.
 */
const GOLD = TEXT_CARD.accentColor
const IVORY = TEXT_CARD.headlineColor

/** Spread into every `interpolate`, typed as the contract rather than asserted. See `P12.tsx`. */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

/** The pack's strip: `stripLength` entries of `index % 10`, so every decade repeats. */
const DIGIT_STRIP: readonly number[] = Array.from(
  { length: P14_TYPE.digits.stripLength },
  (_, index) => index % 10,
)

type DigitColumnProps = {
  digit: string
  index: number
  frame: number
  fps: number
  opacity: number
}

/**
 * ONE ROLLING COLUMN.
 *
 * The strip is translated up by `position * heightPx`, and `position` runs from
 * `target + 30` down to `target + 10` — twenty places of the 40-entry strip, on
 * `Easing.out(cubic)`, so it arrives fast and settles slowly. At rest the strip
 * entry on show is `(target + 10) % 10`, which is `target`.
 *
 * `Number(digit)` is safe because `digitsOf` returns one character of `0-9`, and
 * the mask stops are in `P14_TYPE` with the measurement that set them.
 */
function DigitColumn({ digit, index, frame, fps, opacity }: DigitColumnProps): ReactNode {
  const t = P14_TYPE.digits
  const target = Number(digit)
  const rollStart = 0.12 + index * 0.09
  const lockTime = 0.58 + index * 0.11
  const progress = interpolate(frame, [rollStart * fps, lockTime * fps], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  })
  const position = interpolate(progress, [0, 1], [target + 30, target + 10], clamp)
  const mask =
    `linear-gradient(180deg, transparent 0%, black ${String(t.maskOpaqueFrom * 100)}%, ` +
    `black ${String(t.maskOpaqueTo * 100)}%, transparent 100%)`

  return (
    <div
      style={{
        position: 'relative',
        width: t.columnWidthPx,
        height: t.heightPx,
        overflow: 'hidden',
        opacity,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          transform: `translateY(${String(-position * t.heightPx)}px)`,
        }}
      >
        {DIGIT_STRIP.map((value, stripIndex) => (
          <div
            key={`${String(index)}-${String(stripIndex)}`}
            style={{
              width: '100%',
              height: t.heightPx,
              color: t.colour,
              fontFamily: FONT_FAMILY,
              fontSize: t.fontSizePx,
              fontWeight: t.fontWeight,
              lineHeight: `${String(t.heightPx)}px`,
              textAlign: 'center',
              textShadow: t.textShadow,
            }}
          >
            {value}
          </div>
        ))}
      </div>
    </div>
  )
}

export function P14({ src, targetYear, label, detail }: P14Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const t = P14_TYPE
  const digits = digitsOf(targetYear)

  /*
   * Every input range here is strictly increasing for any `durationInFrames >= 2`,
   * which is what makes this template safe at the SHOT's length rather than at
   * the pack's locked 150 — `renderOne` overrides `durationInFrames` with the
   * scene's own `durationFrames`. The exit range's left edge goes negative on a
   * very short scene and stays increasing, so `interpolate` does not throw. The
   * registry's `buildEndFrames` of 71 is what keeps a locked year on screen
   * between the last digit and the fade; it is not what stops a crash.
   */
  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.035], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -10], clamp)
  const backgroundY = interpolate(frame, [0, durationInFrames - 1], [0, -4], clamp)
  const blockProgress = interpolate(frame, [0.06 * fps, 0.78 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const blockX = interpolate(frame, [0.06 * fps, 0.78 * fps], [t.blockSlidePx, 0], clamp)
  const ruleProgress = interpolate(frame, [0.32 * fps, 0.92 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const detailProgress = interpolate(frame, [0.62 * fps, 1.16 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)

  return (
    /*
     * Plain black, not the pack's near-black. This mounts INSIDE `Scene`'s own
     * root `AbsoluteFill`, which is already `#000`; two different near-blacks
     * stacked is a seam waiting to appear on a dissolve.
     */
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: exit, overflow: 'hidden' }}>
        {/*
          The template grades its OWN picture, here, on the image element. That
          is why `Scene` must not also mount `<Grade>` on this branch: the house
          curve is a sibling backdrop layer, and stacking it on top of this
          filter grades the shot twice. `carriesOwnGrade` is true in the registry.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${String(backgroundX)}px ${String(backgroundY)}px`,
            filter: 'sepia(0.08) saturate(0.82) contrast(1.05) brightness(0.72)',
          }}
        />
      </AbsoluteFill>

      {/* The pack's right-side readability veil, under the block, plus its top and foot. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(8, 7, 6, 0.12) 0%, rgba(8, 7, 6, 0.02) 45%, rgba(8, 7, 6, 0.64) 100%), ' +
            'linear-gradient(180deg, rgba(8, 7, 6, 0.36) 0%, rgba(8, 7, 6, 0.04) 44%, rgba(8, 7, 6, 0.72) 100%)',
          opacity: exit,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: t.blockTopPx,
          right: t.blockRightPx,
          width: t.blockWidthPx,
          opacity: blockProgress * exit,
          translate: `${String(blockX)}px 0px`,
          textAlign: 'right',
        }}
      >
        {/*
          `.length > 0`, NOT truthiness, for the reason `P12.tsx` gives: the day
          one of these props becomes `string | number`, `{label && …}` renders a
          bare `0` onto the frame and the length test cannot.
        */}
        {label.length > 0 && (
          <div
            style={{
              marginBottom: t.label.marginBottomPx,
              color: GOLD,
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
            display: 'flex',
            justifyContent: 'flex-end',
            gap: t.digits.gapPx,
            height: t.digits.heightPx,
            overflow: 'hidden',
          }}
        >
          {digits.map((digit, index) => (
            <DigitColumn
              key={`${digit}-${String(index)}`}
              digit={digit}
              index={index}
              frame={frame}
              fps={fps}
              opacity={Math.min(1, blockProgress * 1.45)}
            />
          ))}
        </div>

        <div
          style={{
            width: `${String(ruleProgress * t.rule.widthPx)}px`,
            height: t.rule.heightPx,
            marginTop: t.rule.marginTopPx,
            marginLeft: 'auto',
            backgroundColor: GOLD,
            boxShadow: t.rule.glow,
            transformOrigin: 'right center',
          }}
        />

        {detail.length > 0 && (
          <div
            style={{
              marginTop: t.detail.marginTopPx,
              color: IVORY,
              fontFamily: FONT_FAMILY,
              fontSize: t.detail.fontSizePx,
              fontStyle: 'italic',
              fontWeight: t.detail.fontWeight,
              lineHeight: t.detail.lineHeight,
              opacity: detailProgress,
              translate: `0px ${String(interpolate(detailProgress, [0, 1], [t.detail.risePx, 0], clamp))}px`,
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.48)',
            }}
          >
            {detail}
          </div>
        )}
      </div>

      <AbsoluteFill
        style={{
          boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.42)',
          opacity: exit,
        }}
      />
    </AbsoluteFill>
  )
}
