import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY } from '../constants.js'

/**
 * P17 — single annotated callout. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P17.tsx
 *   sha256    31a594c06cad58481980cc735bdcbd6e635f9460bc3dadc842000919c92fd33d
 *   lock      accepted_snapshots/P17_SingleCallout/P17_LOCK.json
 *   identity  accepted_snapshots/P17_SingleCallout/P17.tsx hashes identically,
 *             which is what lets a lock written against the SNAPSHOT cover the
 *             `remotion-source` file that was copied here
 *
 * `templates/` is gitignored and is kept out of the worker image by
 * `.dockerignore`, so nothing downstream of this repo can diff this file against
 * what it came from. The hash above is the whole audit trail.
 *
 * ####################################################################
 * # THIS ONE REPLACES AN ANIMATION RATHER THAN ADDING TO THE SET.     #
 * #                                                                   #
 * # Niku, 2026-08-24: "When i said 'replace it with yours', I meant   #
 * # keep this one and use it to replace your pointer-label". So       #
 * # `animations/PointerLabel.tsx` is superseded by this file, not     #
 * # joined by it. Both point a thin line at one detail and label it.  #
 * #                                                                   #
 * # DO NOT DELETE `PointerLabel.tsx` YET. Its clip is already with    #
 * # the client, its tests pin measurements taken off his own frames,  #
 * # and nothing has yet rendered this template beside it at the same  #
 * # size. Retire it when the replacement has been seen and accepted,  #
 * # not when it was announced.                                        #
 * ####################################################################
 *
 * ####################################################################
 * # THE FIRST OF THE SIX WITH TYPE ON IT, SO C20 FINALLY APPLIES.     #
 * #                                                                   #
 * # The pack sets this template's one label in a stack of four named  #
 * # faces and ships ZERO font files for them. Two are macOS system    #
 * # faces; `docker/worker.Dockerfile` installs exactly                #
 * # `fonts-liberation` and `fonts-noto-core`, so on the render box    #
 * # every one of them misses and the label draws in Liberation Serif. #
 * #                                                                   #
 * # THAT SUBSTITUTION IS INVISIBLE TO EVERY CHECK THIS REPO HAS. It   #
 * # is not in `contentHash` and not in `computeRenderKey`. Every test #
 * # passes, every hash matches, and the delivered frame carries a     #
 * # typeface nobody chose. The client has already objected to a font  #
 * # once. So the stack becomes `FONT_FAMILY`, the same one the rest   #
 * # of the film uses, exactly as P12's port did.                      #
 * #                                                                   #
 * # THE COST IS REAL AND PAID KNOWINGLY: the only faces registered    #
 * # under that name are Libre Franklin, a SANS. The pack wanted a     #
 * # serif museum label and this is a sans one. Getting the serif back #
 * # means a licensed woff2 vendored into `apps/web/public/fonts`,     #
 * # which needs a named licence first — and which moves `bundleHash`, #
 * # so it is a decision to take once for all six templates rather     #
 * # than per template.                                                #
 * ####################################################################
 *
 * ####################################################################
 * # WHY THE FONT CHANGED AND THE COLOURS DID NOT, STATED ONCE FOR ALL #
 * # THREE PORTS SO FAR.                                               #
 * #                                                                   #
 * # A missing FONT does not error. It renders as a different face and #
 * # nothing anywhere notices. A colour is present and renders as      #
 * # authored. So C20 applies to every template with type on it, and   #
 * # C22 applies only where a pack colour is standing in for the       #
 * # FILM'S OWN type palette.                                          #
 * #                                                                   #
 * # P12 was that case: its gold rule and ivory type were the film's   #
 * # own text colours on a full-frame device, so they became the       #
 * # film's tokens. P17's cream plate and brown ink are not text       #
 * # colours, they are a museum label — a physical object in the       #
 * # artwork, like P19's paper card mount. Repainting them produces    #
 * # something that is no longer the template Niku pointed at.         #
 * #                                                                   #
 * # P22 was changed for a third, narrower reason: its two near-blacks #
 * # sit against `Scene`'s own black root and two near-blacks stacked  #
 * # is a seam waiting to appear on a dissolve. That reason does not   #
 * # apply here, where the ground is a photograph.                     #
 * ####################################################################
 *
 * ####################################################################
 * # TWO EDITS BEYOND THE FONT.                                        #
 * #                                                                   #
 * # 1  C4, C2 — the pack's asset-path helper import and its whole     #
 * #    default-props export are DELETED. Neither symbol is named here #
 * #    on purpose: each edit is gated by a grep over THIS FILE that   #
 * #    must come back empty, so a header quoting the string it        #
 * #    removed would fail the check that proves the edit. Both live   #
 * #    in the mount test beside the assertion that hunts them.        #
 * #                                                                   #
 * # 2  The pack's weight 700 becomes 600. 700 is NOT one of the four  #
 * #    weights `fonts.ts` registers, and a weight the browser cannot  #
 * #    honour does not error — it synthesises or falls back, silently #
 * #    six hours into a render. 600 is the registered weight closest  #
 * #    to it, the same substitution P12's port made.                  #
 * ####################################################################
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS, AND IT HAS TO STAY ONE. No
 * `useState`, no `useEffect`, no `useMemo`, no `memo`, no `Math.random`, no
 * `Date`, no DOM access. Segments render in isolation and in any order and are
 * cached by `computeRenderKey`, which hashes the PLAN.
 *
 * The typeface is registered by `useDocumentaryFont()` on `Scene`'s first line,
 * which holds frame 0 behind a `delayRender` gate until the face is real. This
 * file therefore loads no font of its own and calls no loader at module scope —
 * `Root.tsx` records that exact call killing stage 6 on every job it ever ran.
 */

/**
 * The pack's six props, unchanged.
 *
 * ####################################################################
 * # THE FOUR COORDINATES ARE FRACTIONS OF THE FRAME, AND THE ANCHOR  #
 * # PAIR ALREADY HAS A SOURCE IN THIS PIPELINE.                       #
 * #                                                                   #
 * # `AssetVisionSchema.subjectAnchor` in `packages/core/src/schemas`  #
 * # is exactly this: an `{x, y}` in 0..1 saying where the subject of  #
 * # a photograph is. Gemini returns it for every candidate, it        #
 * # survives into the frozen plan, `crop.ts` and `motion.ts` already  #
 * # read it, and `renderKey.ts` already hashes it. So `anchorX` and   #
 * # `anchorY` are NOT a new problem — the pointer has somewhere real  #
 * # to point, today, with no new model call.                          #
 * #                                                                   #
 * # `labelX` and `labelY` do not have a source and do not need a      #
 * # model one either: the plate wants to sit away from the subject,   #
 * # which is arithmetic on the anchor plus the frame bounds. Written  #
 * # down here so nobody reaches for vision to solve it.               #
 * ####################################################################
 */
export type P17Props = {
  src: string
  label: string
  anchorX: number
  anchorY: number
  labelX: number
  labelY: number
}

/**
 * Spread into every `interpolate` below so no value ever runs past its range.
 * A literal-union annotation rather than the pack's two `as const` assertions,
 * because this repo's rule is literal unions and `satisfies` rather than `as`.
 */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * ####################################################################
 * # THE PLATE IS A FIXED BOX AND THE LABEL DOES NOT WRAP. A LONG      #
 * # LABEL HANGS OFF IT, AND NOTHING ERRORS.                           #
 * #                                                                   #
 * # 292px wide with 24px of padding each side leaves 244px of type,   #
 * # and `whiteSpace: nowrap` means an overlong string does not wrap,  #
 * # does not shrink and does not clip — it draws straight out of the  #
 * # cream plate onto the photograph, at exit 0, looking like a bug    #
 * # nobody wrote.                                                     #
 * #                                                                   #
 * # THE PACK NEVER MET THIS because its own default label is the six  #
 * # characters of a goddess's name. Anything drawn from real          #
 * # narration is longer more often than not.                          #
 * #                                                                   #
 * # THE THRESHOLD MOVED WHEN THE FACE DID, so the pack's own headroom #
 * # says nothing about ours. It is MEASURED against a render rather   #
 * # than computed — see `P17_LABEL_MAX_CHARS` below.                   #
 * ####################################################################
 */
const LABEL_WIDTH = 292
const LABEL_HEIGHT = 78
const LABEL_PADDING_X = 24

/**
 * ####################################################################
 * # MEASURED 2026-08-25 BY RENDERING SIX LABELS AND READING THE INK.  #
 * #                                                                   #
 * # Ink width of the drawn string inside the plate, at this size, in  #
 * # this face, at this weight and tracking. 244px is all there is.    #
 * #                                                                   #
 * #   ISHTAR            6 ch   128px   21.3 px/ch   fits              #
 * #   THE MOON          8 ch   184px   23.0         fits              #
 * #   MOON GATES       10 ch   237px   23.7         fits              #
 * #   LUNAR GATES      11 ch   248px   22.5         OVERFLOWS         #
 * #   URIEL S PATH     12 ch   236px   19.7         fits              #
 * #   THE MOON GATES   14 ch   282px   20.1         OVERFLOWS         #
 * #                                                                   #
 * # CHARACTER COUNT IS THE WRONG GUARD AND THE TABLE PROVES IT — a    #
 * # 12-character string FITS while an 11-character one does not,      #
 * # because `I` and `S` are narrow and `M` and `G` are not. The real  #
 * # predictor is ink width, which nothing upstream can see.           #
 * #                                                                   #
 * # So the cap below is the count that holds for the WIDEST observed  #
 * # letters, 23.7px each, and it is deliberately conservative. It is  #
 * # advice for whatever chooses labels, not a runtime clamp: this     #
 * # component draws what it is given, because silently truncating a   #
 * # client's copy is worse than a label that visibly does not fit.    #
 * #                                                                   #
 * # AND THE PLATE MUST NOT SIMPLY BE MADE WIDER. Saku's change policy #
 * # says a visual change means a NEW VERSION or a NEW TEMPLATE,       #
 * # rendered and reviewed, then added to the registry. Widening this  #
 * # box here would fork his locked P17 without him knowing.           #
 * #                                                                   #
 * # WHICH MAKES THIS A SELECTION CONSTRAINT: the registry's own rule  #
 * # for P17 asks for "one short tag", and it means it. A name, a      #
 * # date, one word. Anything sentence-shaped wants a different        #
 * # template.                                                         #
 * ####################################################################
 */
export const P17_LABEL_MAX_CHARS = 10

/**
 * The registered weight closest to the pack's 700. `fonts.ts` registers exactly
 * 300, 500, 600 and 800 under `FONT_FAMILY`, and asking for a weight that is not
 * one of them is silently synthesised rather than refused.
 */
const LABEL_WEIGHT = 600

/**
 * The pack's own tracking, kept, and it is the softest number on this template.
 *
 * 1.1px was fitted by Saku to a SERIF at 34px. It is applied here to a sans with
 * different advances, so it is the pack's intent rather than a measurement that
 * still holds. If a render ever reads loose or tight, this is the first number
 * to move and it should be moved against a render, not argued about.
 */
const LABEL_TRACKING_PX = 1.1

const LABEL_FONT_SIZE = 34

export function P17({ src, label, anchorX, anchorY, labelX, labelY }: P17Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const imageScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.045], {
    ...clamp,
    easing: Easing.linear,
  })
  const imageX = interpolate(frame, [0, durationInFrames - 1], [0, -9], clamp)
  const imageY = interpolate(frame, [0, durationInFrames - 1], [0, -4], clamp)
  const imageOpacity = interpolate(frame, [0, 0.24 * fps], [0, 1], clamp)

  /*
   * THE LINE STARTS DRAWING BEFORE THE PLATE ARRIVES AND THE TWO OVERLAP.
   * Line 0.26-1.14s, plate 0.82-1.38s. So the plate begins while the line still
   * has a third to run, which is what makes the label feel pulled along the
   * string rather than dropped on afterwards. Chaining them puts the plate
   * 0.32s late.
   */
  const lineProgress = interpolate(frame, [0.26 * fps, 1.14 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const labelProgress = interpolate(frame, [0.82 * fps, 1.38 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)

  const anchor = { x: anchorX * 1920, y: anchorY * 1080 }
  const labelPosition = { x: labelX * 1920, y: labelY * 1080 }

  /*
   * The leader meets the plate at 56% of its height rather than the middle,
   * which is what stops it looking like a stem growing out of a box.
   */
  const lineStart = {
    x: labelPosition.x,
    y: labelPosition.y + LABEL_HEIGHT * 0.56,
  }
  const dx = lineStart.x - anchor.x
  const dy = lineStart.y - anchor.y
  const calloutPath = [
    `M ${String(anchor.x)} ${String(anchor.y)}`,
    `C ${String(anchor.x + dx * 0.18)} ${String(anchor.y + dy * 0.08)}`,
    `${String(lineStart.x - dx * 0.24)} ${String(lineStart.y - dy * 0.08)}`,
    `${String(lineStart.x)} ${String(lineStart.y)}`,
  ].join(' ')

  return (
    <AbsoluteFill style={{ backgroundColor: '#91826c', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: exit }}>
        {/*
          The template grades its OWN picture here, on the image element, the
          same way P12, P19 and P22 do. `Scene` must not also mount `<Grade>` on
          a template branch or the shot is graded twice.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: imageScale,
            translate: `${String(imageX)}px ${String(imageY)}px`,
            filter: 'sepia(0.08) saturate(0.84) contrast(1.04) brightness(1.02)',
          }}
        />
      </AbsoluteFill>

      <svg
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          opacity: Math.min(imageOpacity, exit),
          pointerEvents: 'none',
        }}
      >
        {/*
          Two stacked strokes, a soft dark shadow under a pale line, both
          advancing together. `pathLength={1}` normalises the dash arithmetic so
          the same offset works whatever the real curve length is — which
          matters here more than in P19, because this curve's length depends on
          two props rather than on a fixed table.
        */}
        <path
          d={calloutPath}
          fill="none"
          stroke="rgba(35, 29, 23, 0.28)"
          strokeWidth="13"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineProgress}
        />
        <path
          d={calloutPath}
          fill="none"
          stroke="#f5f0e5"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineProgress}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: labelPosition.x,
          top: labelPosition.y,
          width: LABEL_WIDTH,
          height: LABEL_HEIGHT,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${String(LABEL_PADDING_X)}px`,
          backgroundColor: '#f0eadb',
          color: '#30291f',
          fontFamily: FONT_FAMILY,
          fontSize: LABEL_FONT_SIZE,
          fontWeight: LABEL_WEIGHT,
          letterSpacing: LABEL_TRACKING_PX,
          lineHeight: 1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          opacity: labelProgress * exit,
          transform: `translateX(${String(interpolate(labelProgress, [0, 1], [20, 0], clamp))}px)`,
          boxShadow: '0 8px 20px rgba(34, 27, 18, 0.24)',
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  )
}
