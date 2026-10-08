import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { CSSProperties, ReactNode } from 'react'
import {
  BULLET_CHECKLIST_BAR,
  BULLET_CHECKLIST_BAR_TOP_EDGE,
  BULLET_CHECKLIST_CHECKBOX,
  BULLET_CHECKLIST_PANEL,
  BULLET_CHECKLIST_PANEL_BOTTOM_EDGE,
  BULLET_CHECKLIST_ROW_REVEAL,
  BULLET_CHECKLIST_ROWS,
  BULLET_CHECKLIST_TICK,
  BULLET_CHECKLIST_TITLE,
  bulletChecklistBoxOpacity,
  bulletChecklistCharOpacity,
  bulletChecklistPanelMaskY,
  bulletChecklistTickDrawn,
  bulletChecklistWipeX,
} from './bulletChecklistClock.js'
import { CONDENSED_FAMILY, useCondensedFace } from './condensedFace.js'
import { SCRIPT_FACE_BASELINE_OVER_EM, SCRIPT_FAMILY, useScriptFace } from './scriptFace.js'

/**
 * a7, the bullet-point checklist overlay — a static photograph with an olive
 * header uncovered by a leftward mask, a cream panel unrolling beneath it, and
 * three checklist rows ticking one after another.
 *
 * The client's seventh reference animation, at 0:32 of `Templates
 * (Unseperated)`. Every number lives in `bulletChecklistClock.ts`, pinned by
 * measurements there.
 *
 * ####################################################################
 * # INERT, AND MUST STAY INERT UNTIL THERE IS A SIGN-OFF.             #
 * # `inert.test.ts` fails if anything the film bundles can reach it.  #
 * ####################################################################
 *
 * ####################################################################
 * # EVERY ELEMENT IS BUILT FROM A MEASUREMENT. TWO ARE LESS VERIFIED  #
 * # THAN THE REST AND THEY ARE NAMED IN THE CLOCK.                    #
 * #                                                                   #
 * # The checkboxes' and ticks' EASINGS were measured in this session  #
 * # without the adversarial second pass the other dimensions had, and #
 * # the rows' WEIGHT is a 6.6% margin. Everything else is firm.       #
 * ####################################################################
 *
 * ####################################################################
 * # FOUR MECHANISMS HERE LOOK LIKE SOMETHING THEY ARE NOT. EACH ONE   #
 * # HAS A PLAUSIBLE WRONG BUILD THAT MATCHES THE FINAL FRAME.         #
 * #                                                                   #
 * #   the header    looks like a slide      is a MASK over static art #
 * #   the panel     looks like an unroll    is a straight CLIP over   #
 * #                                         a sheet that never moves  #
 * #   the rows      look like a soft wipe   are PER-CHARACTER fades   #
 * #   the tick      looks like a fade       is a PATH DRAW            #
 * #                                                                   #
 * # Every wrong reading in that column reproduces the settled frame   #
 * # exactly and is wrong in most of the moving ones.                  #
 * #                                                                   #
 * # AND THE TITLE'S FACE IS BEBAS AFTER ALL. An earlier pass in this  #
 * # session rendered it, compared it to his frame by eye, and         #
 * # concluded "plainly not Bebas". The render had tracking 0 against  #
 * # the measured +0.0297em, which over twenty characters displaces    #
 * # every glyph by up to 56px — so the comparison was between         #
 * # letterforms that were not in the same places. A proper fit beats  #
 * # the next candidate 13.7x. Match the SETTING before judging a      #
 * # FACE.                                                             #
 * ####################################################################
 *
 * ####################################################################
 * # WHAT THE FILM CANNOT YET PRODUCE, AND a7 IS THE WORST OF THE NINE #
 * # FOR IT.                                                           #
 * #                                                                   #
 * # a7 draws FOUR SEPARATE STRINGS: a section title and three         #
 * # checklist items. `SceneOverlaySchema.text` is ONE string capped   #
 * # at `OVERLAY_NOTE_MAX_CHARS` = 64, and `PlannedSceneSchema` holds  #
 * # one `overlay` or none — so the plan has no shape to name four.    #
 * # That is the same wall a8 hit for its four PHOTOGRAPHS, in the     #
 * # other medium.                                                     #
 * #                                                                   #
 * # `verifySpokenMarks` is NOT the blocker, the way it is for a5. It  #
 * # keeps a mark when ANY of its words were spoken in the shot, and   #
 * # checklist items drawn from the narration would pass by            #
 * # construction — the same argument a2 makes. What is missing is     #
 * # SELECTION and a SCHEMA SHAPE, not invention.                      #
 * ####################################################################
 */

/**
 * The bar's silhouette, as an SVG path in absolute design coordinates.
 *
 * ####################################################################
 * # A PATH RATHER THAN A DIV, BECAUSE THE TOP EDGE IS NOT STRAIGHT.   #
 * #                                                                   #
 * # The measured edge is a slow organic wave with a 6px kick over its #
 * # last 40px. A plain rectangle misses it by 1.60px rms against a    #
 * # 0.06px edge-position noise floor, which is 27x — visible in a     #
 * # side-by-side and exactly the class of thing that makes a rebuild  #
 * # read as a different template.                                     #
 * ####################################################################
 */
function barPath(): string {
  const points = BULLET_CHECKLIST_BAR_TOP_EDGE
  const first = points[0]
  if (first === undefined) throw new Error('the bar has no top edge')

  const top = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${String(x)},${String(y)}`).join(' ')
  const last = points[points.length - 1]
  if (last === undefined) throw new Error('the bar has no top edge')

  /* Down the right, back along the bottom, and closed up the dead-vertical left. */
  return `${top} L${String(last[0])},${String(BULLET_CHECKLIST_BAR.bottom)} L${String(first[0])},${String(BULLET_CHECKLIST_BAR.bottom)} Z`
}

/**
 * The panel's silhouette: straight across the top, torn along the bottom.
 *
 * ####################################################################
 * # THE TORN BOTTOM IS THE SIGNATURE OF THE DEVICE.                   #
 * #                                                                   #
 * # A plain rectangle at the mean y = 917.7 is up to 4.2px out, and   #
 * # loses the character that identifies the template at a glance.     #
 * #                                                                   #
 * # It is a DIFFERENT tear from the bar's top edge — correlation 0.33 #
 * # across about six independent features, which is not significant.  #
 * # Mirroring one onto the other would be inventing a symmetry the    #
 * # frames do not have.                                               #
 * ####################################################################
 */
function panelPath(): string {
  const points = BULLET_CHECKLIST_PANEL_BOTTOM_EDGE
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) throw new Error('the panel has no bottom edge')

  /* Left to right along the tear, then up the right and back along the flat top. */
  const bottom = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${String(x)},${String(y)}`)
    .join(' ')
  return `${bottom} L${String(last[0])},${String(BULLET_CHECKLIST_PANEL.top)} L${String(first[0])},${String(BULLET_CHECKLIST_PANEL.top)} Z`
}

/**
 * One checklist row's type, revealed one character at a time.
 *
 * ####################################################################
 * # ONE SPAN PER CHARACTER, AND THE SPACES GET SPANS TOO.             #
 * #                                                                   #
 * # The space CONSUMES A SLOT here, measured, where a3's space does   #
 * # not. Rendering the spaces as plain text between spans would drop  #
 * # them from the slot count and pull every later character 2.46      #
 * # frames early — which is what fits 16x worse.                      #
 * #                                                                   #
 * # `display: inline-block` on a space collapses it, so the spans     #
 * # stay inline and only their opacity changes. Nothing here moves:   #
 * # measured centroid drift is at most 0.086px.                       #
 * ####################################################################
 */
function Row({ text, row, frame }: { text: string; row: number; frame: number }): ReactNode {
  const { fontSizePx, fontWeight, penX, baselines, colour } = BULLET_CHECKLIST_ROWS
  const baseline = baselines[row] ?? 0

  return (
    <div
      style={{
        position: 'absolute',
        left: penX,
        /*
          Positioned from the BASELINE, via the face's own metrics.

          `top: baseline - fontSize` is wrong by 0.17em for this face and has
          shipped wrong twice on this project. Caveat's baseline sits at
          0.830em inside a line-height:1 box, and that value is the same under
          both metric conventions Chrome picks between, so the host and the
          container cannot disagree about it.
        */
        top: baseline - fontSizePx * SCRIPT_FACE_BASELINE_OVER_EM,
        fontFamily: SCRIPT_FAMILY,
        fontWeight,
        fontSize: fontSizePx,
        lineHeight: 1,
        color: colour,
        letterSpacing: BULLET_CHECKLIST_ROWS.chromeTrackingPx,
        whiteSpace: 'pre',
        /*
          NO SKEW. Caveat's own `post.italicAngle` is 0 and the ~19.8 degrees
          of lean is drawn into the outlines. A CSS skew on top double-slants
          every glyph.
        */
      }}
    >
      {[...text].map((character, slot) => (
        <span key={slot} style={{ opacity: bulletChecklistCharOpacity(row, slot, frame) }}>
          {character}
        </span>
      ))}
    </div>
  )
}

/**
 * One checkbox and its tick: the box FADES, the tick DRAWS.
 *
 * ####################################################################
 * # TWO DIFFERENT MECHANISMS, AND THE FRAMES SEPARATE THEM CLEANLY.   #
 * #                                                                   #
 * # All four of the box's edges reach half opacity within 0.01 frames #
 * # of each other, so the box fades as one object. The tick's t50     #
 * # walks 60.77 -> 68.13 along its path, so the tick is drawn.        #
 * #                                                                   #
 * # `strokeDasharray` plus `strokeDashoffset` is the spelling that    #
 * # draws a path along its own length. Fading the tick instead would  #
 * # match its final frame and be wrong for every frame before it.     #
 * ####################################################################
 */
function Checkbox({ row, frame }: { row: number; frame: number }): ReactNode {
  const box = BULLET_CHECKLIST_CHECKBOX
  const tick = BULLET_CHECKLIST_TICK
  const top = box.tops[row] ?? 0
  const opacity = bulletChecklistBoxOpacity(row, frame)
  const drawn = bulletChecklistTickDrawn(row, frame)

  /*
    The path is stored relative to the box's own top-left, so one trace serves
    all three rows — which is right, because the three boxes measured identical
    to the pixel rather than being three hand-drawn variants.
  */
  const points = tick.path.map(([dx, dy]) => [box.left + dx, top + dy] as const)
  const d = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${String(x)},${String(y)}`).join(' ')

  /*
    The dash length has to be at least the path's own length or the tail never
    finishes drawing. Measured straight off the two segments rather than read
    from the DOM, so it works in jsdom too.
  */
  const length = points.reduce((total, point, index) => {
    const previous = points[index - 1]
    if (previous === undefined) return total
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1])
  }, 0)

  return (
    <g opacity={opacity}>
      <rect
        x={box.left + box.strokeWidth / 2}
        y={top + box.strokeWidth / 2}
        width={box.size - box.strokeWidth}
        height={box.size - box.strokeWidth}
        fill="none"
        stroke={box.colour}
        strokeWidth={box.strokeWidth}
      />
      <path
        d={d}
        fill="none"
        stroke={tick.colour}
        strokeWidth={tick.strokeWidth}
        /*
          BUTT CAPS, MEASURED. Round caps put our tick at x1268..1319 where his
          is 1274..1315 — and 1274..1315 is EXACTLY the path's own endpoints, so
          his stroke does not extend past them at all.

          Confirmed by the taper: his first column carries 3px of ink growing to
          13px over the next 5, which is what a flat cap on a 33-degree stroke
          draws. A round cap arrives at full thickness immediately.

          The JOIN stays round — that is the vertex in the middle of the check,
          not an end, and nothing in the frames argues for a mitre there.
        */
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - drawn)}
      />
    </g>
  )
}

export function BulletChecklist({
  src,
  title,
  items,
}: {
  /** The full-bleed photograph. Static — it is given no transform at all. */
  src: string
  /** The header's own line, e.g. "BULLET POINT OVERLAY". */
  title: string
  /** One string per checklist row. The reference carries three. */
  items: readonly string[]
}): ReactNode {
  useCondensedFace()
  useScriptFace()
  const frame = useCurrentFrame()

  const maskX = bulletChecklistWipeX(frame)
  const panelMaskY = bulletChecklistPanelMaskY(frame)

  /*
    A TWO-STOP GRADIENT WITH BOTH STOPS AT THE SAME POSITION, which is the
    cheapest spelling of a hard edge that still antialiases.

    The measured edge runs alpha 0.02 -> 0.32 -> 0.93 -> 1.00 across about 2px
    and stays that width even where it crosses 207px in one frame, so there is
    no feather and no motion blur to reproduce. A `clip-path` inset would give
    the same geometry with a hard aliased edge instead; the mask matches what
    was measured.
  */
  const headerMask: CSSProperties = {
    WebkitMaskImage: `linear-gradient(90deg, transparent ${String(maskX)}px, #000 ${String(maskX)}px)`,
    maskImage: `linear-gradient(90deg, transparent ${String(maskX)}px, #000 ${String(maskX)}px)`,
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/*
        NO TRANSFORM. Measured at under 0.005px of translation and |k-1| under
        5.4e-06 across all 120 frames, against a control that recovers a
        deliberate 0.03px shift at 10 sigma. This is the first animation in the
        reel where the client's "static" is literally true, and a decorative
        1.0-to-1.0 scale here would be inventing a move the frames do not have.
      */}
      <Img src={src} style={{ width: 1920, height: 1080, objectFit: 'cover' }} />

      {/*
        THE PANEL: A STATIC TORN-EDGED SHEET UNDER A STRAIGHT DESCENDING CLIP.

        The clip is `clipPath: inset(...)` rather than a height animation,
        because the paper underneath must not move or scale. Under a y-scale the
        visible bottom edge would BE the torn edge, compressed — which predicts
        a per-column spread of 1.38px at local 40 against a measured 0.017px.
        81x wrong, and it would also stretch the grain and, later, the rows.

        THE ROWS LIVE INSIDE THIS CLIP because they are drawn on the paper.
        Row 1's text happens to start 0.21 frames after the clip passes its
        baseline, so on THIS copy the clip never actually hides a character —
        but rows 2 and 3 do not share that coincidence, and a longer row set
        or a retimed unroll would rely on the clip being here.
      */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 0 ${String(Math.max(0, 1080 - panelMaskY))}px 0)`,
        }}
      >
        <svg
          width={1920}
          height={1080}
          viewBox="0 0 1920 1080"
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          {/*
            THE PAPER GRAIN, measured rather than styled.

            sigma 1.92 of 255, PURE LUMINANCE (the R, G and B standard
            deviations are identical to 0.001), broadband with no dominant
            period, correlation length 2-3px, and leaning vertical about 3:1.
            It is in the source asset and not in the codec: contrast-stretched
            18x it shows an even fibre grain with no 8x8 blocking, and it is
            perfectly static across the tail at temporal sigma 0.0003.

            `baseFrequency` is higher in x than in y because the FIBRES are
            vertical, which means the variation is horizontal. Getting that
            backwards draws horizontal rules.

            A fixed `seed`, so two renders of the same frame are identical.
          */}
          {/*
            THE PAPER IS DRAWN FLAT, AND THE MEASURED GRAIN IS DELIBERATELY
            NOT REPRODUCED.

            His paper carries a real grain: sigma 1.92 of 255, pure luminance,
            broadband, correlation length 2-3px, leaning vertical about 3:1. It
            is in the source asset rather than the codec — contrast-stretched
            18x it shows an even fibre grain with no 8x8 blocking, and it is
            static across the tail at temporal sigma 0.0003.

            IT WAS BUILT AND THEN REMOVED, because it made the match WORSE. An
            feTurbulence layer at the measured frequencies reproduced the
            structure correctly — column-profile sd 0.183 against row-profile
            0.039, the same anisotropy as his 0.542 against 0.158 — but overlay
            blending shifted the paper's mean down about 5 levels, taking the
            region's mad from 1.58 to 4.57.

            FLAT ALREADY MATCHES WITHIN THE NOISE FLOOR: paper mad 1.578 against
            a photograph control of 1.556 on the same frame. So the grain buys
            nothing measurable and costs a mean shift, and the measurement's own
            verdict was "reproduce it cheaply or skip it" — at 0.75% of full
            scale it is invisible except on a pixel-peep A/B.

            The constants are kept in the clock for whoever wants to try again
            with a blend that preserves the mean.
          */}
          <path d={panelPath()} fill={BULLET_CHECKLIST_PANEL.fill} shapeRendering="geometricPrecision" />

          {items.map((_, row) => (
            <Checkbox key={row} row={row} frame={frame} />
          ))}
        </svg>

        {items.map((text, row) => (
          <Row key={row} text={text} row={row} frame={frame} />
        ))}
      </div>

      <div style={{ position: 'absolute', inset: 0, ...headerMask }}>
        <svg
          width={1920}
          height={1080}
          viewBox="0 0 1920 1080"
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <path d={barPath()} fill={BULLET_CHECKLIST_BAR.fill} shapeRendering="geometricPrecision" />

          {/*
          THE TITLE IS INSIDE THE MASK AND IS OTHERWISE STATIC.

          Its ink right edge measured 1847 on all 31 frames of the wipe while
          the ink COUNT grew from 575 to 24,103. So it is one static image being
          uncovered, not type sliding in behind a bar.

          DRAWN AS SVG <text> RATHER THAN A DIV, deliberately. A div's baseline
          depends on which vertical metrics the engine picks — Bebas carries
          hhea 900/-300 and usWin 950/350, and a browser preferring the second
          would move the baseline 5px. SVG has no line box and no such trap:
          `y` IS the baseline.
        */}
          <text
            x={BULLET_CHECKLIST_TITLE.originX}
            y={BULLET_CHECKLIST_TITLE.baselineY}
            fontFamily={CONDENSED_FAMILY}
            fontSize={BULLET_CHECKLIST_TITLE.fontSizePx}
          /*
            +0.0297em, measured two independent ways. Leaving this at 0 is what
            made an earlier render read as the wrong TYPEFACE: over twenty
            characters it accumulates 56px, so every glyph lands somewhere else
            and the letterforms can no longer be compared at all.
          */
            letterSpacing={BULLET_CHECKLIST_TITLE.letterSpacingPx}
            fill={BULLET_CHECKLIST_TITLE.colour}
            xmlSpace="preserve"
          >
            {title}
          </text>
        </svg>
      </div>
    </AbsoluteFill>
  )
}
