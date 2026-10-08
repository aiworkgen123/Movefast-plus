import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY, TEXT_CARD } from '../constants.js'

/**
 * P12 — historical date/era treatment. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE, because this is somebody else's work and the copy has to stay
 * auditable after the original is gone:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P12.tsx
 *   sha256    e37c24a54acfdd5c4674290655239ac5786390bbae956e829e7a3bde2f667c24
 *   lock      accepted_snapshots/P12_HistoricalDate/P12_LOCK.json,
 *             at `files.component.sha256`, which carries the same value
 *   identity  accepted_snapshots/P12_HistoricalDate/P12.tsx hashes identically,
 *             which is what lets a lock written against the SNAPSHOT cover the
 *             `remotion-source` file that was actually copied here
 *
 * `templates/` is gitignored and is kept out of the worker image by
 * `.dockerignore`, so nothing downstream of this repo can diff this file against
 * what it came from. The hash above is the whole audit trail. Re-derive it with
 * `sha256sum` on the pack source before trusting any claim that the two agree.
 *
 * ####################################################################
 * # FIVE EDITS WERE MADE TO THE COPY, AND EVERY ONE OF THEM IS       #
 * # LOAD-BEARING. Do not "restore" any of them from the pack.        #
 * #                                                                   #
 * # NONE OF THE FIVE QUOTES THE STRING IT REMOVED, AND THAT IS        #
 * # DELIBERATE RATHER THAN VAGUE. Each edit is gated by a `grep` over #
 * # THIS FILE that must come back empty — the two deleted symbols,    #
 * # the pack's four font stacks, its five hexes, its one chrome       #
 * # label. A header that quoted any of them would fail the very check #
 * # that proves the edit was made, and the next builder would learn   #
 * # to ignore a red gate. Every removed literal is written out in the #
 * # plan, section 3 and TASK 3, which is where they belong.           #
 * #                                                                   #
 * # 1  C4, C2 — the pack's asset-path helper import and its whole     #
 * #    default-props export are DELETED, not commented out. That      #
 * #    export resolved a scraped fixture out of the pack's own        #
 * #    `public/assets/`, and an export shaped like that is exactly    #
 * #    how such a frame reaches a real render by accident: it is the  #
 * #    Studio default, so it renders the moment anyone opens the      #
 * #    composition. `apps/web/remotion.config.ts` states that nothing #
 * #    in this compositor resolves an asset that way. The picture     #
 * #    arrives as the `src` prop, built by `assetUrlFor` in           #
 * #    `apps/worker/src/stages/render.ts` from the plan's own asset.  #
 * #                                                                   #
 * # 2  C20 — all four font stacks become `FONT_FAMILY`, and the       #
 * #    weights are set explicitly. See the box below.                 #
 * #                                                                   #
 * # 3  C22 — five pack hexes become ONE gold and ONE ivory, read from #
 * #    `constants.ts` rather than restated here, plus a plain black   #
 * #    root fill. See the note on `GOLD` and `IVORY` below.           #
 * #                                                                   #
 * # 4  C23 — the kicker block printed an English UI label naming the  #
 * #    device. The whole `<div>` is CUT, not just the string: the     #
 * #    label is not on `P12Props`, so it cannot be changed through    #
 * #    data, and an English UI label on a frame of a documentary      #
 * #    about biblical manuscripts is a P0 defect. GEOMETRY            #
 * #    CONSEQUENCE, stated so nobody hunts it later: the panel is     #
 * #    top-anchored, so losing 15px of type at lineHeight 1.15 plus   #
 * #    its 20px bottom margin lifts the rule and the year about 37px  #
 * #    relative to the pack's own preview.png. Expected, not a bug.   #
 * #                                                                   #
 * # 5  The `eraLabel` and `detail` blocks are OMITTED ENTIRELY when    #
 * #    their string is empty, rather than rendering an empty div with  #
 * #    its margins. Both arrive as `''` in Rung 1 — nothing in this    #
 * #    pipeline has a verified source for an era name or a date        #
 * #    caption, and inventing one is the single worst defect this      #
 * #    template could ship — so the empty case is the ONLY case that   #
 * #    renders today. An empty div would leave the year floating       #
 * #    above 51px of dead margin and read as a layout bug.             #
 * ####################################################################
 *
 * What the component itself draws, from the pack's own docblock: a verified year
 * enters in the upper-right over real source media. This is a calm date marker,
 * not a rolling odometer — the year appears once, settles, and stays readable
 * while the still continues its gentle motion.
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS, AND IT HAS TO STAY ONE. No
 * `useState`, no `useEffect`, no `useMemo`, no `memo`, no `Math.random`, no
 * `Date`, no DOM access. Segments render in isolation and in any order and are
 * cached by `computeRenderKey`, which hashes the PLAN; anything in here that is
 * not derived from `frame` and props would make that cache serve a frame that
 * was never drawn from these inputs. The two Remotion hooks below are the only
 * hooks this file may ever have.
 *
 * The typeface is registered by `useDocumentaryFont()` on `Scene`'s first line,
 * which holds frame 0 behind a `delayRender` gate until the face is real. This
 * file therefore loads no font of its own, and in particular calls no
 * `loadDocumentaryFont()` at module scope — `Root.tsx` records that exact call
 * killing stage 6 on every job it ever ran.
 */

/** The four props the pack declares, unchanged. Four plain strings, nothing else. */
export type P12Props = {
  src: string
  year: string
  eraLabel: string
  detail: string
}

/**
 * ####################################################################
 * # THE PACK'S TYPE IS GONE AND IT IS NOT COMING BACK IN RUNG 1.     #
 * #                                                                   #
 * # The pack shipped four font stacks — one sans list twice and one   #
 * # serif list twice, every family named in them a macOS system face  #
 * # — and ZERO font files and ZERO `@font-face` rules to resolve      #
 * # them. `docker/worker.Dockerfile` installs exactly                 #
 * # `fonts-liberation` and `fonts-noto-core`, so on the render box    #
 * # every one of those sans names misses to Liberation Sans and every #
 * # serif name misses to Liberation Serif.                            #
 * #                                                                   #
 * # THAT SUBSTITUTION IS INVISIBLE TO EVERY CHECK THIS REPO HAS. It   #
 * # is not in `contentHash` and it is not in `computeRenderKey`, so   #
 * # every test passes, every hash matches, and the delivered frame is #
 * # a third typeface nobody has ever seen. The client has already     #
 * # objected to a font once. The only defence is a still rendered      #
 * # inside the worker container and looked at by a person.            #
 * #                                                                   #
 * # SO: one family, `FONT_FAMILY`, the same one the rest of the film   #
 * # uses. THE COST IS REAL AND IT IS PAID KNOWINGLY — the only faces  #
 * # registered under it are Libre Franklin, a SANS, at 300/500/600/   #
 * # 800 (`fonts.ts`). The 136px year loses its serif. Anyone who       #
 * # wants that serif back is asking for a licensed woff2 vendored     #
 * # into `apps/web/public/fonts`, which needs a named licence first.  #
 * #                                                                   #
 * # AND THE WEIGHTS ARE DECIDED HERE RATHER THAN LEFT TO CHROME. The  #
 * # pack set weight 700 on three of its four blocks and none at all   #
 * # on the fourth. 700 is NOT one of the four registered weights, and #
 * # a weight the browser cannot honour does not error — it            #
 * # synthesises or falls back, silently, six hours into a render.     #
 * # `fonts.ts` says exactly this in its own box, and says the check   #
 * # is a one-frame still. Every weight below is a weight that exists. #
 * ####################################################################
 */
const YEAR_WEIGHT = 800

/** SemiBold, the registered weight closest to the pack's 700. */
const ERA_LABEL_WEIGHT = 600

/**
 * The pack set no weight at all on the detail block, only `fontStyle: italic`.
 * 300 is the film's caption weight. NOTE, so a later phase does not discover it
 * in a frame: there is no italic face registered under `FONT_FAMILY`, so the
 * italic below is a browser-synthesised oblique. Never renders in Rung 1.
 */
const DETAIL_WEIGHT = 300

/**
 * ONE gold and ONE ivory, read from the film's own constants rather than
 * restated as literals here.
 *
 * The pack carried five distinct hexes: two near-identical golds (one on the
 * rule, one shared by the cut kicker and the era label), two near-identical
 * ivories (one on the year, one on the detail) and a near-black root fill. Four
 * of those are a hair off the film's palette and the fifth is a hair off black,
 * which is precisely the kind of difference that survives review and then reads
 * as a graphic from a different project once it is cut next to the text cards.
 * The old-to-new mapping is the table in TASK 3 of the plan; the pack's values
 * are deliberately not repeated here, because a `grep` for them across
 * `apps/web/src/` is the gate that proves this edit was made.
 *
 * Read, never copied, so the template and the cards can never drift apart.
 * `TEXT_CARD.headlineColor` IS the film's off-white — `constants.ts` hoists it
 * out as a module-private `OFF_WHITE` precisely so more than one key can use it,
 * and everything outside that file reads it through this key.
 */
const GOLD = TEXT_CARD.accentColor
const IVORY = TEXT_CARD.headlineColor

/**
 * Spread into every `interpolate` below so no value ever runs past its range.
 *
 * The pack wrote this as two `'clamp' as const` assertions. It is an explicit
 * literal-union annotation here instead, because this repo's rule is literal
 * unions and `satisfies` rather than `as` — and the annotation is strictly
 * better than the assertion anyway: it makes the object's type the CONTRACT
 * `interpolate` expects, so a typo like `'clmap'` is an error at this line
 * instead of at the seven call sites that spread it.
 */
const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

export function P12({ src, year, eraLabel, detail }: P12Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  /*
   * Every input range here is strictly increasing for any `durationInFrames >= 2`,
   * which is what makes this template safe at the BEAT's length rather than at
   * the pack's locked 150 — `renderOne` overrides `durationInFrames` with the
   * scene's own `durationFrames`. The exit range's left edge goes negative on a
   * very short scene and stays increasing, so `interpolate` does not throw. The
   * planner's 45-frame floor is what stops the last block being cut off
   * mid-build; it is not what stops a crash.
   */
  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1.18, 1.22], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -12], clamp)
  const backgroundY = interpolate(frame, [0, durationInFrames - 1], [0, -3], clamp)
  const entrance = interpolate(frame, [0.08 * fps, 0.78 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const panelX = interpolate(frame, [0.08 * fps, 0.78 * fps], [92, 0], {
    ...clamp,
    easing: quietEase,
  })
  const ruleWidth = interpolate(frame, [0.18 * fps, 0.72 * fps], [0, 238], {
    ...clamp,
    easing: quietEase,
  })
  const yearOpacity = interpolate(frame, [0.28 * fps, 0.9 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const yearY = interpolate(frame, [0.28 * fps, 0.9 * fps], [18, 0], {
    ...clamp,
    easing: quietEase,
  })
  const detailOpacity = interpolate(frame, [0.62 * fps, 1.18 * fps], [0, 1], {
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
          filter grades the shot twice and matches neither the pack's preview
          nor the rest of the film.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${backgroundX}px ${backgroundY}px`,
            filter: 'sepia(0.08) saturate(0.82) contrast(1.04) brightness(0.72)',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(7, 6, 5, 0.06) 0%, rgba(7, 6, 5, 0.16) 58%, rgba(7, 6, 5, 0.58) 100%), linear-gradient(180deg, rgba(7, 6, 5, 0.20) 0%, rgba(7, 6, 5, 0) 42%, rgba(7, 6, 5, 0.30) 100%)',
          opacity: exit,
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: 132,
          top: 120,
          width: 700,
          textAlign: 'right',
          opacity: entrance * exit,
          translate: `${panelX}px 0px`,
        }}
      >
        {/* The gold rule, drawing left to right. Edit 4 cut the kicker that sat above it. */}
        <div
          style={{
            marginLeft: 'auto',
            width: ruleWidth,
            height: 4,
            marginBottom: 24,
            backgroundColor: GOLD,
            transformOrigin: 'right center',
          }}
        />
        <div
          style={{
            color: IVORY,
            fontFamily: FONT_FAMILY,
            fontSize: 136,
            fontWeight: YEAR_WEIGHT,
            letterSpacing: -2.8,
            lineHeight: 0.86,
            opacity: yearOpacity,
            translate: `0px ${yearY}px`,
            textShadow: '0 3px 20px rgba(0, 0, 0, 0.52)',
          }}
        >
          {year}
        </div>

        {/*
          `.length > 0`, NOT truthiness. Both are correct for a `string` today
          and only one of them stays correct: the day one of these props becomes
          `string | number`, `{detail && …}` renders a bare `0` onto the frame.
          The length test cannot do that, and it says what is actually meant —
          "there is a word to set" — rather than "this value is not falsy".
        */}
        {eraLabel.length > 0 && (
          <div
            style={{
              marginTop: 23,
              color: GOLD,
              fontFamily: FONT_FAMILY,
              fontSize: 19,
              fontWeight: ERA_LABEL_WEIGHT,
              letterSpacing: 4.0,
              lineHeight: 1.15,
              textTransform: 'uppercase',
              opacity: yearOpacity,
            }}
          >
            {eraLabel}
          </div>
        )}

        {detail.length > 0 && (
          <div
            style={{
              maxWidth: 560,
              marginTop: 28,
              marginLeft: 'auto',
              color: IVORY,
              fontFamily: FONT_FAMILY,
              fontSize: 27,
              fontStyle: 'italic',
              fontWeight: DETAIL_WEIGHT,
              letterSpacing: 0.2,
              lineHeight: 1.2,
              opacity: detailOpacity,
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
