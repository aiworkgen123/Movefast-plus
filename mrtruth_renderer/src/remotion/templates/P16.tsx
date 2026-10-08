import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY } from '../constants.js'

/**
 * P16 — staged phrase build. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P16.tsx
 *   sha256    21c55dfda2835a332899fec2201f36ec82b5004ae3d46f6197413bbd3233aeca
 *   lock      accepted_snapshots/P16_StagedPhraseBuild/P16_LOCK.json
 *   identity  accepted_snapshots/P16_StagedPhraseBuild/P16.tsx hashes identically
 *
 * `templates/` is gitignored and kept out of the worker image by
 * `.dockerignore`, so the hash above is the whole audit trail.
 *
 * This is Niku's pick at 1:18-1:21, which he wrote down as `text overlay "not
 * metaphor"`. The pack's own default copy is "Not / mythology" then "Not /
 * metaphor" then "A record of what occurred", so his shorthand names the second
 * of the two phrases rather than the template.
 *
 * ####################################################################
 * # WHAT IT ACTUALLY DOES, BECAUSE THE NAME IS VAGUE.                #
 * #                                                                   #
 * # A still holds. A small prefix slides in top-left, then a large    #
 * # phrase WIPES in under it left to right. A second prefix and a     #
 * # second phrase then do the same thing in a DIFFERENT ZONE, lower   #
 * # right. Finally a detail line and a short gold rule complete the   #
 * # thought, bottom-left.                                             #
 * #                                                                   #
 * # The wipe is a `clipPath` inset, not an opacity fade and not a     #
 * # mask over static art. Three of the five blocks use it. A build    #
 * # that faded them instead reproduces the settled frame exactly and  #
 * # is wrong in every moving one — the same trap a7 recorded four     #
 * # times over.                                                       #
 * ####################################################################
 *
 * ####################################################################
 * # C20 COSTS MORE ON THIS TEMPLATE THAN ON ANY OTHER OF THE SIX.    #
 * #                                                                   #
 * # FIVE blocks of type. The pack set FOUR of them in a serif stack   #
 * # and one in a sans stack, named six faces between them, and        #
 * # shipped ZERO font files. `docker/worker.Dockerfile` installs      #
 * # exactly `fonts-liberation` and `fonts-noto-core`, so on the       #
 * # render box every one misses. All five become `FONT_FAMILY`.       #
 * #                                                                   #
 * # TWO DESIGNED DISTINCTIONS ARE LOST AND BOTH ARE WORTH NAMING.     #
 * #                                                                   #
 * # The first phrase is SANS and the second is SERIF ITALIC. That     #
 * # contrast is how the two halves of the argument are told apart at  #
 * # a glance. With one family they differ only by size and slant.     #
 * #                                                                   #
 * # And FOUR of the five blocks are italic, where no italic face is   #
 * # registered under `FONT_FAMILY` — see `fonts.ts`, four upright     #
 * # weights from three files. Chrome slants the uprights instead. P03 #
 * # already ships one synthesised oblique; this template ships four,  #
 * # including a 76px one that is the second largest thing on screen.  #
 * #                                                                   #
 * # THIS IS THE TEMPLATE THAT MAKES THE CASE for vendoring a licensed #
 * # serif with a real italic. It is one decision taken once for all   #
 * # six, not six decisions, and until it is taken this file is the    #
 * # honest record of what it costs.                                   #
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
 * # 2  The pack's weight 700 on the two phrases becomes 600, the      #
 * #    value P03's port MEASURED against the pack's own preview at a  #
 * #    near-identical size. 700 is not one of the four weights        #
 * #    `fonts.ts` registers, and a weight the browser cannot honour   #
 * #    is synthesised rather than refused.                            #
 * ####################################################################
 *
 * ####################################################################
 * # THE PALETTE IS KEPT, as in P03, P17 and P19. A missing FONT does  #
 * # not error and renders as a different face; a colour is present    #
 * # and renders as authored. The gold rule here is a pale warm gold   #
 * # chosen to sit on a dark photograph, where the film's own accent   #
 * # is a deeper gold chosen to read as ink on paper.                  #
 * ####################################################################
 *
 * ####################################################################
 * # THE PACK SHIPPED THIS TEMPLATE WITH NO SCRIM, AND SAKU HAS SINCE  #
 * # ASKED FOR ONE. THE 20% LAYER BELOW IS HIS, NOT OURS.              #
 * #                                                                   #
 * # FOUND BY RENDERING IT, 2026-08-25. Five blocks of off-white type  #
 * # sat DIRECTLY on the photograph with nothing but a per-block       #
 * # `textShadow` between them. Compare P03, which carries a           #
 * # centre-weighted radial AND an inset vignette for exactly this     #
 * # reason, and P13, which carries two gradients and a vignette.      #
 * #                                                                   #
 * # Saku's own preview hid it, because his picture is a dark, quiet   #
 * # manuscript. Rendered over a bright, busy photograph the same five #
 * # blocks were barely legible — and NOTHING ERRORED, no test went    #
 * # red, and the frame looked like a design choice.                   #
 * #                                                                   #
 * # HE CONFIRMED IT UNPROMPTED on seeing that render, 2026-08-25:     #
 * # "Only note for clip 3: a little shadow/shade on the inage so the  #
 * # text is visible better. 20% should do the work."                  #
 * #                                                                   #
 * # So `SCRIM_ALPHA` is 0.20 because the template's AUTHOR chose that #
 * # number, not because anything here measured it. If it is ever      #
 * # changed, that is a change to his design and it needs his say-so   #
 * # the same way this one had it.                                     #
 * #                                                                   #
 * # THIS IS A DEPARTURE FROM HIS LOCKED SNAPSHOT and the provenance   #
 * # hash above no longer describes the drawn frame. His change policy #
 * # says a visual change means a NEW VERSION, rendered and reviewed,  #
 * # then added to the registry. That has NOT happened yet — the       #
 * # registry still describes P16 v1.0 with no scrim. Ask him whether  #
 * # this becomes v1.1 in his pack, or stays a change only in our      #
 * # copy, and record the answer here.                                 #
 * #                                                                   #
 * # THE SELECTION CONSTRAINT IS SOFTENED, NOT REMOVED, AND THE        #
 * # NUMBERS SAY SO.                                                   #
 * #                                                                   #
 * # MEASURED 2026-08-25 over the SAME bright foliage photograph that  #
 * # exposed the gap. WCAG contrast of the off-white type against the  #
 * # ground behind it, at frame 110:                                   #
 * #                                                                   #
 * #                  background   contrast at the mean   at the worst #
 * #   no scrim         53.7           10.65:1               1.68:1    #
 * #   20% scrim        42.7           12.47:1               2.63:1    #
 * #                                                                   #
 * # "Worst" is the brightest 5% of the ground, which is the case that #
 * # actually decides legibility — a mean of 10:1 means nothing when   #
 * # a word is sitting on a sunlit leaf.                               #
 * #                                                                   #
 * # SO HIS 20% BUYS A 57% IMPROVEMENT IN THE HARD CASE AND STILL      #
 * # LANDS UNDER THIS PROJECT'S OWN 3:1 FLOOR on this photograph.      #
 * # `T-TI6` in `title.test.ts` is where that floor is written down.   #
 * # The fix is right and the picture is still wrong for the template. #
 * #                                                                   #
 * # P13 clears the same shot comfortably, with three layers and the   #
 * # darkest grade of the six. So the rule stands: whatever chooses    #
 * # templates should still prefer a dark, quiet picture for this one, #
 * # and the rule in `look-still.ts` still holds — a contrast decision #
 * # is a property of the type AND the picture under it, and this      #
 * # compositor draws over pictures nobody previews.                   #
 * ####################################################################
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. No `useState`, no `useEffect`, no
 * `useMemo`, no `memo`, no `Math.random`, no `Date`, no DOM access.
 *
 * The typeface is registered by `useDocumentaryFont()` on `Scene`'s first line.
 * This file loads no font of its own and calls no loader at module scope.
 */

/**
 * The pack's six props, unchanged.
 *
 * ####################################################################
 * # SIX STRINGS, AND THAT IS THE MOST OF ANY OF THE SIX TEMPLATES.   #
 * #                                                                   #
 * # For comparison: P22 and P19 need none, P17 needs one, P03 needs   #
 * # three. This one needs five pieces of copy plus a picture, in a    #
 * # specific rhetorical shape — prefix, phrase, prefix, counterphrase, #
 * # resolution.                                                       #
 * #                                                                   #
 * # THE SHAPE IS THE HARD PART, NOT THE WORDS. `verifySpokenMarks`    #
 * # keeps an overlay when ANY of its words were spoken in the shot,   #
 * # and narration is prose the aligner has already timestamped word   #
 * # by word, so copy DRAWN FROM THE NARRATION passes by construction. #
 * # What nothing here can do is decide that a passage is making a     #
 * # "not X, not Y, but Z" argument in the first place. That is a      #
 * # selection problem and it is the sharpest one in the set.          #
 * ####################################################################
 */
export type P16Props = {
  src: string
  firstPrefix: string
  firstPhrase: string
  secondPrefix: string
  secondPhrase: string
  detail: string
}

const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * The registered weight P03's port measured against the pack's own preview at
 * 92px, where 700 came out 9% heavier than 600 and 16% lighter than 800. Both
 * phrases here are within a few pixels of that size, so the measurement carries.
 * It is a CARRIED result rather than a fresh one, which is worth knowing if a
 * render ever disagrees.
 */
const PHRASE_WEIGHT = 600

/** The prefixes and the detail carry no weight in the pack. 500 is the film's body weight. */
const SUPPORTING_WEIGHT = 500

/** Every block is the film's off-white; the rule is the pack's pale gold. */
const INK = '#f0eadb'
const RULE_GOLD = '#c39a52'

/**
 * Saku's own number, given on 2026-08-25 after seeing this template rendered
 * over a bright photograph. "20% should do the work." Not measured here, and not
 * to be tuned without asking him — see the box at the top of this file.
 */
const SCRIM_ALPHA = 0.2

const TEXT_SHADOW_SMALL = '0 2px 14px rgba(0, 0, 0, 0.55)'
const TEXT_SHADOW_LARGE = '0 3px 18px rgba(0, 0, 0, 0.58)'

export function P16({
  src,
  firstPrefix,
  firstPhrase,
  secondPrefix,
  secondPhrase,
  detail,
}: P16Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.035], {
    ...clamp,
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -12], clamp)
  const backgroundY = interpolate(frame, [0, durationInFrames - 1], [0, -4], clamp)

  /*
   * ######################################################################
   * # FIVE CLOCKS, AND FOUR OF THE FIVE OVERLAP THEIR PREDECESSOR.       #
   * #                                                                    #
   * #   first prefix    0.28 - 0.72s                                     #
   * #   first phrase    0.52 - 1.18s   starts 0.20s BEFORE the prefix    #
   * #                                  has landed                        #
   * #   second prefix   1.02 - 1.38s   starts 0.16s before the first     #
   * #                                  phrase has landed                 #
   * #   second phrase   1.26 - 1.86s   starts 0.12s before its own       #
   * #                                  prefix has landed                 #
   * #   detail          1.92 - 2.92s   the ONLY one with a gap, 0.06s    #
   * #                                                                    #
   * # So chaining any of the first four puts everything after it late,   #
   * # and the errors accumulate: chained end to end the detail would     #
   * # start at 2.40s rather than 1.92s, half a second adrift in a three  #
   * # second animation. a8 and a7 both paid for this and P17 and P19     #
   * # each have a test for it. So does this one.                         #
   * #                                                                    #
   * # THE ONE GAP IS REAL AND MUST SURVIVE A RETIME. The beat before     #
   * # the resolution line is what makes it read as a conclusion rather   #
   * # than a fourth item in a list.                                      #
   * ######################################################################
   */
  const firstPrefixProgress = interpolate(frame, [0.28 * fps, 0.72 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const firstPhraseProgress = interpolate(frame, [0.52 * fps, 1.18 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const secondPrefixProgress = interpolate(frame, [1.02 * fps, 1.38 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const secondPhraseProgress = interpolate(frame, [1.26 * fps, 1.86 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const detailProgress = interpolate(frame, [1.92 * fps, 2.92 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)

  /*
   * A `clipPath` inset, not an opacity fade. The right edge is pulled back from
   * 100% to 0, so the type is REVEALED left to right rather than appearing all
   * at once — and because it is a clip rather than a mask over static art, it
   * costs no layout and cannot reflow the line mid-wipe.
   */
  const firstPhraseClip = `inset(0 ${String((1 - firstPhraseProgress) * 100)}% 0 0)`
  const secondPhraseClip = `inset(0 ${String((1 - secondPhraseProgress) * 100)}% 0 0)`
  const detailClip = `inset(0 ${String((1 - detailProgress) * 100)}% 0 0)`

  return (
    <AbsoluteFill style={{ backgroundColor: '#100f0e', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: exit, overflow: 'hidden' }}>
        {/*
          The template grades its OWN picture here, as every other vendored one
          does. `Scene` must not also mount `<Grade>` on a template branch.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${String(backgroundX)}px ${String(backgroundY)}px`,
            filter: 'grayscale(0.24) sepia(0.10) saturate(0.78) contrast(1.06)',
          }}
        />
      </AbsoluteFill>

      {/*
        SAKU'S SCRIM. A flat 20% black over the whole frame, sitting BETWEEN the
        photograph and every block of type.

        Flat rather than a gradient on purpose. This template puts type in three
        widely separated places — upper left, lower right and bottom left — so
        there is no edge or corner a gradient could favour without leaving one of
        them uncovered. P13 can use gradients because everything it draws lives
        along one rail.

        It rides `exit` so it leaves with the picture rather than lingering as a
        grey card for the last third of a second.
      */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${String(SCRIM_ALPHA)})`,
          opacity: exit,
        }}
      />

      {/* ZONE ONE, upper left. */}
      <div
        style={{
          position: 'absolute',
          left: 152,
          top: 176,
          width: 850,
          opacity: firstPrefixProgress * exit,
          transform: `translateX(${String(interpolate(firstPrefixProgress, [0, 1], [-30, 0], clamp))}px)`,
        }}
      >
        <div
          style={{
            color: INK,
            fontFamily: FONT_FAMILY,
            fontSize: 27,
            fontWeight: SUPPORTING_WEIGHT,
            // Synthesised oblique. No italic face is registered under the
            // film's family. Four of this template's five blocks carry one.
            fontStyle: 'italic',
            lineHeight: 1.0,
            textShadow: TEXT_SHADOW_SMALL,
          }}
        >
          {firstPrefix}
        </div>
        <div
          style={{
            marginTop: 6,
            color: INK,
            // The pack set THIS block in a sans and the second phrase in a
            // serif, which is how the two halves are told apart at a glance.
            // One family means they now differ only by size and slant.
            fontFamily: FONT_FAMILY,
            fontSize: 88,
            fontWeight: PHRASE_WEIGHT,
            letterSpacing: -1.3,
            lineHeight: 0.95,
            clipPath: firstPhraseClip,
            opacity: firstPhraseProgress,
            transform: `translateX(${String(interpolate(firstPhraseProgress, [0, 1], [-24, 0], clamp))}px)`,
            textShadow: TEXT_SHADOW_LARGE,
          }}
        >
          {firstPhrase}
        </div>
      </div>

      {/* ZONE TWO, lower right. The counterphrase lands somewhere else on the
          frame, which is what stops the two halves reading as one list. */}
      <div
        style={{
          position: 'absolute',
          left: 1080,
          top: 470,
          width: 700,
          opacity: secondPrefixProgress * exit,
          transform: `translateX(${String(interpolate(secondPrefixProgress, [0, 1], [34, 0], clamp))}px)`,
        }}
      >
        <div
          style={{
            color: INK,
            fontFamily: FONT_FAMILY,
            fontSize: 25,
            fontWeight: SUPPORTING_WEIGHT,
            fontStyle: 'italic',
            lineHeight: 1.0,
            textShadow: TEXT_SHADOW_SMALL,
          }}
        >
          {secondPrefix}
        </div>
        <div
          style={{
            marginTop: 5,
            color: INK,
            fontFamily: FONT_FAMILY,
            fontSize: 76,
            fontStyle: 'italic',
            fontWeight: PHRASE_WEIGHT,
            letterSpacing: -0.6,
            lineHeight: 0.98,
            clipPath: secondPhraseClip,
            opacity: secondPhraseProgress,
            transform: `translateX(${String(interpolate(secondPhraseProgress, [0, 1], [28, 0], clamp))}px)`,
            textShadow: TEXT_SHADOW_LARGE,
          }}
        >
          {secondPhrase}
        </div>
      </div>

      {/* THE RESOLUTION, bottom left, after the one real gap in the clock. */}
      <div
        style={{
          position: 'absolute',
          left: 152,
          bottom: 148,
          width: 1040,
          color: INK,
          fontFamily: FONT_FAMILY,
          fontSize: 30,
          fontWeight: SUPPORTING_WEIGHT,
          fontStyle: 'italic',
          lineHeight: 1.15,
          clipPath: detailClip,
          opacity: detailProgress * exit,
          transform: `translateY(${String(interpolate(detailProgress, [0, 1], [16, 0], clamp))}px)`,
          textShadow: TEXT_SHADOW_SMALL,
        }}
      >
        {detail}
      </div>

      {/*
        118px of gold under the detail line, drawn left to right on the SAME
        clock. It is the cheapest element here and it is what turns the closing
        line from type dropped on a picture into a designed device — the same
        argument `TEXT_CARD`'s own rule makes in `constants.ts`.
      */}
      <div
        style={{
          position: 'absolute',
          left: 152,
          bottom: 112,
          width: 118,
          height: 3,
          backgroundColor: RULE_GOLD,
          opacity: detailProgress * exit,
          transform: `scaleX(${String(detailProgress)})`,
          transformOrigin: 'left center',
        }}
      />
    </AbsoluteFill>
  )
}
