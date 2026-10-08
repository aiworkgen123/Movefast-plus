import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY } from '../constants.js'

/**
 * P13 — slower historical sequence / date treatment. A VENDORED COPY, edited on
 * purpose.
 *
 * PROVENANCE:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P13.tsx
 *   sha256    b7ba471fd636415004e9b31bbd30e0720f2e9b56e0322358f287a22f2da42023
 *   lock      accepted_snapshots/P13_HistoricalSequence/P13_LOCK.json
 *   identity  accepted_snapshots/P13_HistoricalSequence/P13.tsx hashes identically
 *
 * `templates/` is gitignored and kept out of the worker image by
 * `.dockerignore`, so the hash above is the whole audit trail.
 *
 * Niku's pick at 1:00-1:06, which he called "timeline edit". The LAST of the six
 * and the hungriest of them for copy.
 *
 * ####################################################################
 * # EIGHT STRINGS, AND THAT IS THE MOST OF THE SIX BY SOME WAY.      #
 * #                                                                   #
 * #   P22, P19   none                                                 #
 * #   P17        one                                                  #
 * #   P03        three                                                #
 * #   P16        five                                                 #
 * #   P13        EIGHT — a kicker, a heading, and three year/label    #
 * #              pairs                                                #
 * #                                                                   #
 * # AND THEY ARE NOT INTERCHANGEABLE. Three of them must be DATES, in #
 * # chronological order, that the narration actually mentions. The    #
 * # film already finds a bare four-digit year in the narration —      #
 * # `proposeDeterministicMarks` in `plan.ts` does exactly that and    #
 * # placed "1947" in v8 — so ONE year has a proven source. Three, in  #
 * # order, with a short label each, does not.                         #
 * #                                                                   #
 * # So this is the template whose SELECTION is hardest, and the       #
 * # constraint is arithmetic rather than taste: no three dates in the #
 * # passage, no timeline.                                             #
 * ####################################################################
 *
 * ####################################################################
 * # IT CARRIES ITS OWN SCRIMS, WHICH P16 DOES NOT.                    #
 * #                                                                   #
 * # Two linear gradients — one top-to-bottom weighted heavily at the  #
 * # bottom where the timeline sits, one left-to-right darkening both  #
 * # edges — plus an inset vignette, plus a 0.70 brightness on the     #
 * # picture itself. Four separate things holding the ground down.     #
 * #                                                                   #
 * # That is why this one survives a bright photograph where P16 does  #
 * # not, and it is worth stating because the two look superficially   #
 * # alike: type over a still, no card, no plate.                      #
 * ####################################################################
 *
 * ####################################################################
 * # C20 — FOUR BLOCKS, TWO STACKS, SIX NAMED FACES, ZERO FONT FILES. #
 * #                                                                   #
 * # A sans kicker, a serif heading, serif years and sans labels. The  #
 * # worker image installs only `fonts-liberation` and                 #
 * # `fonts-noto-core`, so every one misses. All four become           #
 * # `FONT_FAMILY`.                                                    #
 * #                                                                   #
 * # THE LOSS HERE IS THE SAME SHAPE AS P16's and slightly milder: the #
 * # pack alternated serif for the DATES and sans for the LABELS, so   #
 * # the two rows of a timeline point were told apart by face as well  #
 * # as by size and colour. With one family, size and colour do all    #
 * # the work. No italic is asked for anywhere here, so unlike P16 and #
 * # P03 this template needs no synthesised oblique.                    #
 * ####################################################################
 *
 * ####################################################################
 * # TWO EDITS BEYOND THE FONTS.                                       #
 * #                                                                   #
 * # 1  C4, C2 — the pack's asset-path helper import and its whole     #
 * #    default-props export are DELETED. Neither symbol is named here #
 * #    on purpose: each edit is gated by a grep over THIS FILE that   #
 * #    must come back empty. Both live in the mount test.             #
 * #                                                                   #
 * # 2  Every block's weight 700 becomes 600, the value P03's port     #
 * #    MEASURED against the pack's own preview. Nothing here is       #
 * #    within P03's measured size — the largest is 67px against its   #
 * #    92px — so this is a carried result and a render is what would  #
 * #    settle it if one ever disagrees.                                #
 * ####################################################################
 *
 * THE PALETTE IS KEPT, as in P03, P16, P17 and P19.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. No `useState`, no `useEffect`, no
 * `useMemo`, no `memo`, no `Math.random`, no `Date`, no DOM access.
 *
 * The typeface is registered by `useDocumentaryFont()` on `Scene`'s first line.
 */

/** One point on the timeline. A date and a short caption for it. */
export type P13Event = {
  year: string
  label: string
}

/** Exactly three points, as a tuple, because the layout divides by two. */
export type P13Props = {
  src: string
  kicker: string
  heading: string
  events: [P13Event, P13Event, P13Event]
}

const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * ####################################################################
 * # THE OUTER TWO POINTS HANG OFF THE FRAME BY 30px EACH, AND THAT   #
 * # IS THE PACK'S GEOMETRY RATHER THAN A MISTAKE HERE.               #
 * #                                                                   #
 * # The rail runs 150 to 1770. Points sit at 0, 0.5 and 1 along it,   #
 * # each in a 360px box centred on its position. So the first spans   #
 * # -30 to 330 and the last spans 1590 to 1950, against a 1920 frame. #
 * #                                                                   #
 * # It is harmless for SHORT labels, which centre well inside the     #
 * # box. It bites when a label is wide enough to fill it: anything    #
 * # over about 300px of drawn text is clipped by the frame edge on    #
 * # the outer two points, and the middle one is never affected.       #
 * #                                                                   #
 * # NOT WIDENED, NOT INSET. Saku's change policy says a visual change #
 * # means a new version or a new template, rendered and reviewed, so  #
 * # moving the rail here would fork his locked P13 without him        #
 * # knowing. It is recorded as a copy constraint instead, the same    #
 * # call P17's plate got.                                             #
 * #                                                                   #
 * # MEASURED 2026-08-25, frame 130, the label band, ours against the  #
 * # pack's own preview.mp4. Ink extents of the outer two labels:      #
 * #                                                                   #
 * #              left label      right label                          #
 * #   ours       x 29 .. 295     x 1657 .. 1881                       #
 * #   pack       x 41 .. 266     x 1658 .. 1853                       #
 * #                                                                   #
 * # NEITHER CLIPS with the pack's own copy, and the pack's own render  #
 * # hugs the edges just as ours does — so this is his geometry and    #
 * # not something the port introduced.                                #
 * #                                                                   #
 * # THE BRACKET, since the copy is what varies: the outer labels are  #
 * # centred 150px from each edge, so they clip once the DRAWN width   #
 * # passes about 300px. The pack's longest is 266px, which leaves     #
 * # roughly three more characters of headroom at this size. Nothing   #
 * # enforces it — a longer label simply loses its first word to the   #
 * # frame edge, at exit 0.                                            #
 * ####################################################################
 */
const TIMELINE = {
  left: 150,
  width: 1620,
  top: 720,
} as const

/** The box each point's copy is centred in. */
const POINT_WIDTH = 360

/**
 * The registered weight P03's port measured. Every block in the pack asks for
 * 700 and this film has 600 and 800; P03's render put 600 nine percent light and
 * 800 sixteen percent heavy at 92px. CARRIED rather than re-measured, and the
 * largest block here is 67px, so a render is what would settle a disagreement.
 */
const BLOCK_WEIGHT = 600

const INK = '#f0eadb'
const GOLD_TEXT = '#d0a862'
const GOLD_RULE = '#c39a52'

/**
 * ####################################################################
 * # THE POINTS ARE 1.15s APART AND THE FIRST ARRIVES WHILE THE RAIL  #
 * # IS STILL DRAWING.                                                 #
 * #                                                                   #
 * #   heading   0.08 - 0.85s                                          #
 * #   rail      0.45 - 1.45s   starts before the heading has landed   #
 * #   point 1   0.85 - 1.47s   starts 0.60s BEFORE the rail finishes  #
 * #   point 2   2.00 - 2.62s                                          #
 * #   point 3   3.15 - 3.77s                                          #
 * #                                                                   #
 * # So the rail is being drawn under a point that has already         #
 * # appeared, which is what makes it read as a line being traced      #
 * # THROUGH the dates rather than a track laid before them. Chaining  #
 * # point 1 to the rail's end costs 0.60s in a five second template.  #
 * ####################################################################
 */
const EVENT_STARTS: [number, number, number] = [0.85, 2.0, 3.15]
const EVENT_DURATION = 0.62

export function P13({ src, kicker, heading, events }: P13Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.03], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -8], clamp)
  const headingProgress = interpolate(frame, [0.08 * fps, 0.85 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const headingY = interpolate(frame, [0.08 * fps, 0.85 * fps], [22, 0], clamp)
  const lineProgress = interpolate(frame, [0.45 * fps, 1.45 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)

  /*
   * PAIRED BY LITERAL INDEX rather than by `events.map`, the same move P19 and
   * P22 make: `noUncheckedIndexedAccess` is on, so `EVENT_STARTS[index]` inside
   * a `map` is `number | undefined` and would need a guard for a case two
   * 3-tuples make impossible.
   */
  const points: [[P13Event, number], [P13Event, number], [P13Event, number]] = [
    [events[0], EVENT_STARTS[0]],
    [events[1], EVENT_STARTS[1]],
    [events[2], EVENT_STARTS[2]],
  ]

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0908', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: exit, overflow: 'hidden' }}>
        {/*
          The template grades its own picture, as every vendored one does, and
          note the 0.70 brightness — this is the darkest grade of the six, and
          it is the first of four things holding the ground down under the type.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${String(backgroundX)}px 0px`,
            filter: 'sepia(0.10) saturate(0.78) contrast(1.04) brightness(0.70)',
          }}
        />
      </AbsoluteFill>

      {/*
        Two gradients: one top-to-bottom weighted hard at the BOTTOM, where the
        rail and its labels sit, and one left-to-right darkening both edges,
        where the outer two points sit. Both are aimed at exactly the places
        this template puts type. P16 has neither and pays for it.
      */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(8, 7, 6, 0.28) 0%, rgba(8, 7, 6, 0.02) 38%, rgba(8, 7, 6, 0.78) 100%), ' +
            'linear-gradient(90deg, rgba(8, 7, 6, 0.34) 0%, rgba(8, 7, 6, 0.04) 62%, rgba(8, 7, 6, 0.32) 100%)',
          opacity: exit,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 112,
          width: 920,
          opacity: headingProgress * exit,
          translate: `0px ${String(headingY)}px`,
        }}
      >
        <div
          style={{
            marginBottom: 18,
            color: GOLD_TEXT,
            fontFamily: FONT_FAMILY,
            fontSize: 15,
            fontWeight: BLOCK_WEIGHT,
            letterSpacing: 4.0,
            lineHeight: 1.15,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            color: INK,
            // The pack set this in a SERIF against the sans kicker above it.
            // One family means only size and colour separate them now.
            fontFamily: FONT_FAMILY,
            fontSize: 67,
            fontWeight: BLOCK_WEIGHT,
            letterSpacing: 0.1,
            lineHeight: 1.0,
            textShadow: '0 3px 18px rgba(0, 0, 0, 0.45)',
          }}
        >
          {heading}
        </div>
      </div>

      {/*
        The rail. A dim full-width track with a gold fill growing across it —
        a WIDTH animation rather than a scale, so the fill's right end stays
        sharp instead of being stretched.
      */}
      <div
        style={{
          position: 'absolute',
          left: TIMELINE.left,
          top: TIMELINE.top,
          width: TIMELINE.width,
          height: 4,
          backgroundColor: 'rgba(238, 230, 215, 0.35)',
          opacity: exit,
        }}
      >
        <div
          style={{
            width: `${String(lineProgress * 100)}%`,
            height: '100%',
            backgroundColor: GOLD_RULE,
            transformOrigin: 'left center',
          }}
        />
      </div>

      {points.map(([event, start], index) => {
        const eventProgress = interpolate(
          frame,
          [start * fps, (start + EVENT_DURATION) * fps],
          [0, 1],
          { ...clamp, easing: quietEase },
        )
        const eventY = interpolate(eventProgress, [0, 1], [24, 0], clamp)
        // 0, 0.5, 1 along the rail. Exactly three points is why this divides by
        // two, and why `P13Props.events` is a tuple rather than an array.
        const position = index / (points.length - 1)

        return (
          <div
            key={`${event.year}-${String(index)}`}
            style={{
              position: 'absolute',
              left: TIMELINE.left + TIMELINE.width * position,
              top: TIMELINE.top - 91,
              width: POINT_WIDTH,
              transform: 'translateX(-50%)',
              opacity: eventProgress * exit,
              translate: `0px ${String(eventY)}px`,
              textAlign: 'center',
            }}
          >
            {/*
              A fixed 62px box with the year sitting on its FLOOR, so a
              four-digit year and a word like "Now" share one baseline. Without
              it the dots would sit at different heights along the rail.
            */}
            <div
              style={{
                height: 62,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                color: INK,
                fontFamily: FONT_FAMILY,
                fontSize: 45,
                fontWeight: BLOCK_WEIGHT,
                lineHeight: 0.95,
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.52)',
              }}
            >
              {event.year}
            </div>
            <div
              style={{
                width: 18,
                height: 18,
                margin: '20px auto 18px auto',
                boxSizing: 'border-box',
                border: `4px solid ${GOLD_RULE}`,
                borderRadius: '50%',
                backgroundColor: '#19130d',
                boxShadow: '0 0 0 5px rgba(195, 154, 82, 0.16)',
              }}
            />
            <div
              style={{
                color: GOLD_TEXT,
                fontFamily: FONT_FAMILY,
                fontSize: 14,
                fontWeight: BLOCK_WEIGHT,
                letterSpacing: 2.4,
                lineHeight: 1.15,
                textTransform: 'uppercase',
              }}
            >
              {event.label}
            </div>
          </div>
        )
      })}

      <AbsoluteFill
        style={{
          boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.44)',
          opacity: exit,
        }}
      />
    </AbsoluteFill>
  )
}
