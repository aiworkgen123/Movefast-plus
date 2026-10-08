import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'

/**
 * P19 — pinned evidence web. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P19.tsx
 *   sha256    17682c39478307fc1c8ffe8f09ac8ca606796da1648f78df8179cf46dcd2ee7b
 *   lock      accepted_snapshots/P19_RedStringEvidenceBoard/P19_LOCK.json
 *   identity  accepted_snapshots/P19_RedStringEvidenceBoard/P19.tsx hashes
 *             identically, which is what lets a lock written against the
 *             SNAPSHOT cover the `remotion-source` file that was copied here
 *
 * `templates/` is gitignored and is kept out of the worker image by
 * `.dockerignore`, so nothing downstream of this repo can diff this file against
 * what it came from. The hash above is the whole audit trail.
 *
 * ####################################################################
 * # THE SECOND OF THE SIX, AND THE SECOND WITH NO TYPE ON IT.        #
 * #                                                                   #
 * # Niku picked six of the pack's nineteen by timestamp from Saku's   #
 * # 1:45 reel. This is the one at 1:32-1:36, added a day after the    #
 * # other five. Like P22 it draws NO TEXT AT ALL — no label, no       #
 * # caption, no date — so the font substitution that dominates P12    #
 * # cannot happen here and no face is registered.                     #
 * #                                                                   #
 * # That is why it was ported second rather than P17, which replaces  #
 * # the pointer label and would have forced the typeface question on  #
 * # the same evening as the port.                                     #
 * ####################################################################
 *
 * ####################################################################
 * # TWO EDITS WERE MADE TO THE COPY, AND ONE DELIBERATE NON-EDIT.     #
 * #                                                                   #
 * # 1  C4, C2 — the pack's asset-path helper import and its whole     #
 * #    default-props export are DELETED, not commented out. Neither   #
 * #    symbol is named here on purpose: each edit is gated by a grep  #
 * #    over THIS FILE that must come back empty, and a header that    #
 * #    quoted the string it removed would fail the very check that    #
 * #    proves the edit was made. Both literals live in the mount test #
 * #    beside the assertion that hunts them.                          #
 * #                                                                   #
 * #    That export resolved FOUR scraped fixtures out of the pack's   #
 * #    own public assets directory. Making it work here would mean    #
 * #    putting them under `apps/web/public`, which moves              #
 * #    `bundleHash`, which folds into every render key, which         #
 * #    invalidates every cached segment of the client's film.         #
 * #                                                                   #
 * # 2  Two tuple pairings replace two `array[index]` reads, because   #
 * #    `noUncheckedIndexedAccess` is on and a fixed-length table       #
 * #    indexed by a `map` counter is `T | undefined`. No behaviour     #
 * #    changes; see the comments at each site.                         #
 * #                                                                   #
 * # THE NON-EDIT, AND IT IS A DELIBERATE DEPARTURE FROM P12'S C22.    #
 * #                                                                   #
 * # P12's port collapsed five pack hexes into the film's own gold and #
 * # ivory, because in P12 those hexes were TYPE COLOURS and type in   #
 * # this film belongs to this film's palette. P19's fifteen colours   #
 * # are not type. They are a red pin, a red string, a cream paper     #
 * # mount, a brown card shadow and a warm paper wash — they ARE the   #
 * # artwork Niku pointed at, and there is no type on this template at #
 * # all for a house colour to apply to.                               #
 * #                                                                   #
 * # Repainting them in the film's two tokens would produce something  #
 * # that is no longer the template he picked. So the pack's palette   #
 * # is kept verbatim, and that is a decision rather than an omission. #
 * # If the film's grade ever fights it, the fix is a grade decision   #
 * # taken once for all six templates, not fifteen edits here.         #
 * ####################################################################
 *
 * What the component draws, from the pack's own docblock: framed stills arrive
 * one at a time on a light historical map. Red pins and red string leader lines
 * then connect the cards into one evidence network. The cards and background are
 * still images; all movement is generated from frame-driven transforms and SVG
 * stroke drawing.
 *
 * ####################################################################
 * # MEASURED AGAINST THE PACK'S OWN preview.mp4, 2026-08-25.         #
 * #                                                                   #
 * # t50 of each card's transition, both at 30fps. Note the cards get  #
 * # DARKER as they land, because the board behind them is light — a   #
 * # measurement that assumed a rise finds nothing at all here.        #
 * #                                                                   #
 * #             ours     pack    delta                                #
 * #   left      10.83     8.77   +2.06 frames                         #
 * #   centre    30.65    30.18   +0.47                                #
 * #   right     50.72    49.96   +0.76                                #
 * #                                                                   #
 * # THE LEFT CARD'S NUMBER IS THE WEAK ONE AND IT IS WEAK FOR A       #
 * # KNOWN REASON, not because the timing differs. Its region swings   #
 * # only 9 luma levels, 94 to 85, where the centre swings 27. A small #
 * # amplitude puts the half-crossing at the mercy of which photograph #
 * # is in the cell, and ours is not the pack's. The two cards whose   #
 * # amplitude is large agree to under a frame.                        #
 * #                                                                   #
 * # Structure was checked frame for frame at 15, 45, 70 and 120       #
 * # against the same frames of the pack's preview: same card          #
 * # positions, same rotations, same pin placement, same string        #
 * # routing, same order.                                              #
 * ####################################################################
 *
 * ####################################################################
 * # THE BOARD WANTS A LIGHT, QUIET PICTURE, AND THIS IS A SELECTION   #
 * # CONSTRAINT RATHER THAN A DRAWING ONE.                             #
 * #                                                                   #
 * # `TEMPLATE_REGISTRY.json` asks for a "light historical background" #
 * # and Saku's own preview uses an antique world map. Handed a busy    #
 * # dark photograph the mechanics render identically, nothing errors,  #
 * # and the three cards simply stop reading as pinned TO anything.     #
 * #                                                                   #
 * # So whatever ends up choosing templates has to be able to refuse    #
 * # this one when no quiet background is available. Recorded here      #
 * # because it is invisible from the component's own signature — the   #
 * # prop is a string like any other.                                   #
 * ####################################################################
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS, AND IT HAS TO STAY ONE. No
 * `useState`, no `useEffect`, no `useMemo`, no `memo`, no `Math.random`, no
 * `Date`, no DOM access. Segments render in isolation and in any order and are
 * cached by `computeRenderKey`, which hashes the PLAN; anything in here that is
 * not derived from `frame` and props would make that cache serve a frame that
 * was never drawn from these inputs.
 */

/** One pinned card's picture. The pack's type, unchanged. */
export type P19Card = {
  src: string
  fit?: 'cover' | 'contain'
  position?: string
}

/**
 * FOUR PICTURES, NOT THREE, AND THE REGISTRY IS MISLEADING ABOUT IT.
 *
 * `TEMPLATE_REGISTRY.json` gives P19 `sourceCount: 3`, and its `assets` list has
 * four entries. Both are right about different things: three CARDS are pinned to
 * the board, and the board itself is a fourth photograph. Anything planning
 * capacity from the registry's number alone will come up one picture short.
 */
export type P19Props = {
  backgroundSrc: string
  cards: [P19Card, P19Card, P19Card]
}

type CardLayout = {
  left: number
  top: number
  width: number
  height: number
  rotation: number
  /** Seconds, not frames. Multiplied by `fps` at the point of use. */
  start: number
  end: number
  fromX: number
  fromY: number
}

type Point = { x: number; y: number }

/**
 * Spread into every `interpolate` below so no value ever runs past its range.
 *
 * The pack wrote this as two `'clamp' as const` assertions. It is an explicit
 * literal-union annotation here instead, because this repo's rule is literal
 * unions and `satisfies` rather than `as`.
 */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * THE CARDS ARRIVE LEFT, CENTRE, RIGHT, AND THE LAST TWO OVERLAP.
 *
 * Left runs 0.22-0.92s, centre 0.92-1.78s, right 1.58-2.34s. So the right card
 * starts 0.20s BEFORE the centre one has settled. Chaining these back to back
 * would push the whole board late, which is the same failure a8 and a7 both paid
 * for on the client's own reel.
 *
 * The rotations are the point of the device — nothing here is axis-aligned, and
 * a build that dropped them would read as a tidy grid rather than a pinned board.
 */
const layouts: [CardLayout, CardLayout, CardLayout] = [
  {
    left: 150,
    top: 170,
    width: 360,
    height: 500,
    rotation: -4,
    start: 0.22,
    end: 0.92,
    fromX: -90,
    fromY: 20,
  },
  {
    left: 545,
    top: 270,
    width: 830,
    height: 500,
    rotation: 1,
    start: 0.92,
    end: 1.78,
    fromX: 0,
    fromY: 86,
  },
  {
    left: 1510,
    top: 110,
    width: 390,
    height: 280,
    rotation: 4,
    start: 1.58,
    end: 2.34,
    fromX: 100,
    fromY: -28,
  },
]

/**
 * A TUPLE RATHER THAN AN ARRAY, and the reason is the four `stringSegments`
 * below read these by literal index at module scope. `noUncheckedIndexedAccess`
 * makes an array read `Point | undefined`, which would need a guard for a case a
 * fixed table makes impossible. Literal indices into a tuple are exact.
 */
const pinPoints: [Point, Point, Point] = [
  { x: 330, y: 151 },
  { x: 960, y: 251 },
  { x: 1705, y: 91 },
]

/**
 * FOUR STRINGS, NOT THREE, AND TWO OF THEM LEAVE THE SAME PIN.
 *
 * The centre pin carries two strings, one to each neighbour, which is what makes
 * this read as a web rather than a chain. They draw in sequence from 0.86s to
 * 2.52s, each over about 0.58s, and the second and third overlap.
 */
const stringSegments: { from: Point; to: Point; start: number; end: number }[] = [
  { from: pinPoints[0], to: { x: 545, y: 284 }, start: 0.86, end: 1.43 },
  { from: pinPoints[1], to: { x: 559, y: 284 }, start: 1.18, end: 1.76 },
  { from: pinPoints[1], to: { x: 1362, y: 284 }, start: 1.3, end: 1.88 },
  { from: pinPoints[2], to: { x: 1362, y: 304 }, start: 1.94, end: 2.52 },
]

const cardImageFilter = 'sepia(0.08) saturate(0.88) contrast(1.02) brightness(1.02)'

function makeStringPath(from: Point, to: Point): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return [
    `M ${String(from.x)} ${String(from.y)}`,
    `C ${String(from.x + dx * 0.32)} ${String(from.y + dy * 0.05)}`,
    `${String(to.x - dx * 0.2)} ${String(to.y - dy * 0.1)}`,
    `${String(to.x)} ${String(to.y)}`,
  ].join(' ')
}

/**
 * The pin head. It OVERSHOOTS to 1.08 and settles, which is what makes it read
 * as pushed in rather than faded on — the same distinction a7's tick turned on.
 */
function Pin({ progress }: { progress: number }): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: -18,
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 32% 26%, #f27662 0%, #c6352a 30%, #8f211d 100%)',
        boxShadow: '0 5px 8px rgba(62, 31, 21, 0.34), inset 0 2px 2px rgba(255, 210, 185, 0.42)',
        opacity: progress,
        transform: `translateX(-50%) scale(${String(
          interpolate(progress, [0, 0.72, 1], [0.4, 1.08, 1], clamp),
        )})`,
        transformOrigin: 'center center',
      }}
    />
  )
}

type EvidenceCardProps = {
  card: P19Card
  layout: CardLayout
  index: number
  frame: number
  fps: number
  durationInFrames: number
  exit: number
}

function EvidenceCard({
  card,
  layout,
  index,
  frame,
  fps,
  durationInFrames,
  exit,
}: EvidenceCardProps): ReactNode {
  const reveal = interpolate(frame, [layout.start * fps, layout.end * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const cardX = interpolate(reveal, [0, 1], [layout.fromX, 0], clamp)
  const cardY = interpolate(reveal, [0, 1], [layout.fromY, 0], clamp)
  const cardScale = interpolate(reveal, [0, 1], [0.94, 1], clamp)

  /*
   * The pin starts 0.08s BEFORE its card finishes settling and takes 0.30s. So
   * it is already going in as the card lands, which is what stops it reading as
   * a separate second event.
   */
  const pinProgress = interpolate(
    frame,
    [layout.end * fps - 0.08 * fps, layout.end * fps + 0.22 * fps],
    [0, 1],
    clamp,
  )
  const imageScale = interpolate(frame, [layout.start * fps, durationInFrames - 1], [1, 1.035], {
    ...clamp,
    easing: Easing.linear,
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        opacity: reveal * exit,
        transform: `translate(${String(cardX)}px, ${String(cardY)}px) rotate(${String(
          layout.rotation,
        )}deg) scale(${String(cardScale)})`,
        transformOrigin: 'center center',
        zIndex: index + 2,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: 22,
          backgroundColor: '#f5edda',
          border: '2px solid rgba(88, 59, 34, 0.52)',
          boxShadow: '0 18px 26px rgba(65, 39, 22, 0.28), 0 3px 4px rgba(65, 39, 22, 0.16)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#312820',
            border: '1px solid rgba(76, 50, 30, 0.58)',
          }}
        >
          {/*
            The template grades its OWN picture here, on the image element, the
            same way P12 and P22 do. `Scene` must not also mount `<Grade>` on a
            template branch or the shot is graded twice.
          */}
          <Img
            src={card.src}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: card.fit ?? 'cover',
              objectPosition: card.position ?? 'center',
              scale: imageScale,
              filter: cardImageFilter,
            }}
          />
        </div>
        {/*
          `Math.min` with `exit`, not a product. During the fade the pin must not
          outlive its own card, and it is drawn in a child stacking context, so
          the card's opacity does not carry to it on its own.
        */}
        <Pin progress={Math.min(pinProgress, exit)} />
      </div>
    </div>
  )
}

export function P19({ backgroundSrc, cards }: P19Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1.01, 1.04], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -8], clamp)
  const backgroundY = interpolate(frame, [0, durationInFrames - 1], [0, -5], clamp)
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)

  /*
   * PAIRED BY LITERAL INDEX rather than by `cards.map`, for the same reason P22
   * does it: `noUncheckedIndexedAccess` makes `layouts[index]` inside a `map`
   * `CardLayout | undefined`, and a runtime guard for a case two 3-tuples make
   * impossible is noise. Literal indices into a tuple are exact.
   */
  const pinned: [[P19Card, CardLayout], [P19Card, CardLayout], [P19Card, CardLayout]] = [
    [cards[0], layouts[0]],
    [cards[1], layouts[1]],
    [cards[2], layouts[2]],
  ]

  return (
    <AbsoluteFill style={{ backgroundColor: '#e2ceb0', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: exit }}>
        <Img
          src={backgroundSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${String(backgroundX)}px ${String(backgroundY)}px`,
            filter: 'sepia(0.10) saturate(0.72) contrast(0.90) brightness(1.08)',
          }}
        />
      </AbsoluteFill>

      {/* The warm paper wash that lifts the map behind the cards. */}
      <AbsoluteFill
        style={{
          opacity: 0.22 * exit,
          backgroundColor: 'rgba(255, 244, 216, 0.72)',
        }}
      />

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
          opacity: exit,
          pointerEvents: 'none',
          zIndex: 8,
        }}
      >
        {stringSegments.map((segment, index) => {
          const path = makeStringPath(segment.from, segment.to)
          const lineProgress = interpolate(
            frame,
            [segment.start * fps, segment.end * fps],
            [0, 1],
            { ...clamp, easing: quietEase },
          )
          return (
            /*
             * `pathLength={1}` normalises the dash arithmetic, so one offset
             * works for four curves of different real lengths. The string is
             * DRAWN, not faded — two strokes, a soft dark shadow under a red
             * line, both advancing together.
             */
            <g key={`string-${String(index)}`} opacity={lineProgress}>
              <path
                d={path}
                fill="none"
                stroke="rgba(74, 38, 27, 0.24)"
                strokeWidth="11"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - lineProgress}
              />
              <path
                d={path}
                fill="none"
                stroke="#b72d27"
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - lineProgress}
              />
            </g>
          )
        })}
      </svg>

      {pinned.map(([card, layout], index) => (
        <EvidenceCard
          key={`card-${String(index)}`}
          card={card}
          layout={layout}
          index={index}
          frame={frame}
          fps={fps}
          durationInFrames={durationInFrames}
          exit={exit}
        />
      ))}
    </AbsoluteFill>
  )
}
