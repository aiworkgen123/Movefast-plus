import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SourcedImg as Img } from '../SourcedImg.js'
import type { ReactNode } from 'react'
import { FONT_FAMILY } from '../constants.js'

/**
 * P03 — whole-word stat highlight. A VENDORED COPY, edited on purpose.
 *
 * PROVENANCE:
 *
 *   pack      templates/accepted_template_webapp_handoff/
 *   source    remotion-source/src/templates/P03.tsx
 *   sha256    b35667546fdb45a04e91394abca1fdb004fd37bfa637704ab67f719afd78ec91
 *   lock      accepted_snapshots/P03_WholeWordHighlight/P03_LOCK.json
 *   identity  accepted_snapshots/P03_WholeWordHighlight/P03.tsx hashes
 *             identically
 *
 * `templates/` is gitignored and kept out of the worker image by
 * `.dockerignore`, so the hash above is the whole audit trail.
 *
 * This is Niku's pick at 0:10-0:14 of Saku's reel, which he called "cosmic scale
 * highlight text". Fourth of the six ported, and the first with TWO blocks of
 * type on it rather than one.
 *
 * ####################################################################
 * # WHAT THE MARKER IS, BECAUSE THE NAME UNDERSELLS IT.              #
 * #                                                                   #
 * # The complete word stays ivory while a muted-gold block paints in  #
 * # BEHIND it, left to right. It is word-scoped by construction: the  #
 * # headline is split on whitespace and each word gets its own span,  #
 * # so the marker can never cover half a word and can never turn the  #
 * # whole headline gold. That is the property the template is named   #
 * # for and it is the one a rebuild would most easily lose.           #
 * #                                                                   #
 * # Markers are STAGGERED at 0.18s apart, in the order the words      #
 * # appear in the headline rather than the order they were listed in  #
 * # `highlightWords`. The whole headline settles first, at 1.0s.      #
 * ####################################################################
 *
 * ####################################################################
 * # C20 — TWO FONT STACKS, FOUR NAMED FACES, ZERO FONT FILES.        #
 * #                                                                   #
 * # The kicker asked for a serif stack and the headline for a sans    #
 * # one. `docker/worker.Dockerfile` installs exactly                  #
 * # `fonts-liberation` and `fonts-noto-core`, so on the render box    #
 * # both stacks miss and land on Liberation. That substitution is in  #
 * # neither `contentHash` nor `computeRenderKey`, so every test        #
 * # passes, every hash matches, and the frame carries a typeface      #
 * # nobody chose. Both become `FONT_FAMILY`, as P12 and P17 did.       #
 * #                                                                   #
 * # THIS ONE LOSES MORE THAN P17 DID, and it is worth being honest    #
 * # about: the pack DELIBERATELY CONTRASTED a serif kicker against a  #
 * # sans headline. Collapsing both to one family removes a designed   #
 * # distinction, and what is left to separate them is size, colour,   #
 * # tracking and the italic. Getting the contrast back means          #
 * # vendoring a licensed serif, which is a decision to take once for  #
 * # all six templates rather than here.                               #
 * ####################################################################
 *
 * ####################################################################
 * # THE KICKER'S ITALIC IS A BROWSER-SYNTHESISED OBLIQUE.            #
 * #                                                                   #
 * # There is no italic face registered under `FONT_FAMILY` — see      #
 * # `fonts.ts`, four upright weights from three files. Chrome slants  #
 * # the upright outlines instead. P12's port recorded the same thing  #
 * # about its detail block, where it never renders because that block #
 * # is always empty. HERE IT ALWAYS RENDERS, because the kicker is    #
 * # required copy. So this is the first place on the project where a  #
 * # fake oblique actually reaches a frame. Left in rather than        #
 * # dropped: removing the italic changes the pack's design on a       #
 * # guess, and a synthesised slant is visible but not wrong.          #
 * ####################################################################
 *
 * ####################################################################
 * # THE PALETTE IS KEPT, THE SAME CALL AS P17 AND P19.               #
 * #                                                                   #
 * # A missing FONT does not error and renders as a different face. A  #
 * # colour is present and renders as authored. So C20 applies to      #
 * # every template with type on it and C22 only where a pack colour   #
 * # stands in for the FILM'S OWN type palette, which was P12's case.  #
 * #                                                                   #
 * # RECORDED RATHER THAN ACTED ON: the headline's ivory is within a   #
 * # couple of levels of the film's own off-white, so using the film's #
 * # token there would cost nothing visually. The two golds are NOT    #
 * # interchangeable though — the film's accent is a deeper, more      #
 * # saturated gold chosen to read as ink on PAPER, and both of these  #
 * # are pale warm golds chosen to sit on a dark photograph. Swapping  #
 * # them is a visible change, so none of the three is swapped.        #
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
 * # 2  The pack's weight 700 is not one of the four `fonts.ts`        #
 * #    registers, and a weight the browser cannot honour is           #
 * #    synthesised rather than refused. See `HEADLINE_WEIGHT`, which  #
 * #    was chosen against a render rather than by arithmetic.         #
 * ####################################################################
 *
 * IT IS A PURE FUNCTION OF `frame` AND PROPS. No `useState`, no `useEffect`, no
 * `useMemo`, no `memo`, no `Math.random`, no `Date`, no DOM access. Segments
 * render in isolation and in any order and are cached by `computeRenderKey`.
 *
 * The typeface is registered by `useDocumentaryFont()` on `Scene`'s first line.
 * This file loads no font of its own and calls no loader at module scope.
 */

/**
 * The pack's four props, unchanged.
 *
 * ####################################################################
 * # `highlightWords` THAT MATCH NOTHING ARE SILENT, AND THAT IS THE   #
 * # DEFECT THIS TEMPLATE SHIPS WITH.                                  #
 * #                                                                   #
 * # A word that does not occur in the headline simply highlights      #
 * # nothing. The frame renders, looks deliberate, exits 0, and a      #
 * # third of the animation is missing. a2 had the identical failure   #
 * # — `indexOf` returning -1 still drew the span — and `parseClipArgs` #
 * # gained the one refusal in that file about MEANING rather than     #
 * # counts: a phrase must occur in its own paragraph.                 #
 * #                                                                   #
 * # The same refusal is in `look-template-clip.ts` for this template. #
 * # It is NOT in this component, deliberately: a compositor that      #
 * # throws mid-render kills a segment, and the caller is the right    #
 * # place to refuse. Anything that builds these props in a real film  #
 * # has to make the same check.                                       #
 * ####################################################################
 */
export type P03Props = {
  src: string
  kicker: string
  headline: string
  highlightWords: string[]
}

const clamp: { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
}

const quietEase = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * ####################################################################
 * # THE WEIGHT WAS CHOSEN AGAINST A RENDER, NOT BY ARITHMETIC.        #
 * #                                                                   #
 * # `fonts.ts` registers 300, 500, 600 and 800. The pack asked for    #
 * # 700, which is exactly between the two candidates, so "closest"    #
 * # does not decide it — 600 and 800 are both 100 away.               #
 * #                                                                   #
 * # It matters more here than it did on P17's small label: this is a  #
 * # 92px display headline and the pack set it in Arial BOLD.          #
 * #                                                                   #
 * # MEASURED 2026-08-25, frame 100, the headline band, ours against   #
 * # the pack's own preview.mp4. Ink is counted as near-white pixels,  #
 * # which the gold marker does not reach:                             #
 * #                                                                   #
 * #            ink    span   ink per column   against the pack        #
 * #   pack    23609   790px      29.9              —                  #
 * #   600     21635   796px      27.2           -9.1%                 #
 * #   800     28492   819px      34.8          +16.4%                 #
 * #                                                                   #
 * # 600 WINS, and this is the second time on this project that a      #
 * # measurement has beaten an eyeball. Put side by side, 800 looked   #
 * # like the closer match to me and 600 looked thin. It is not: 800   #
 * # is nearly twice as far out.                                       #
 * #                                                                   #
 * # THE EYE WAS FOOLED BY THE BACKGROUND, and that is the part worth  #
 * # keeping. The pack's frame sits over a dark, smooth photograph and #
 * # ours over bright foliage, so the same stroke reads differently.   #
 * # The pixel count does not care, and it was CHECKED rather than     #
 * # assumed — the near-white rate in the columns either side of the   #
 * # headline is 0.0 per column in all three, so the vignette and the  #
 * # 0.82 brightness put the whole photograph below the threshold and  #
 * # every counted pixel is type.                                      #
 * #                                                                   #
 * # The spans also come out within 4% of each other, so face WIDTH is #
 * # not confounding the comparison the way it could have.             #
 * #                                                                   #
 * # 9% light is a residual, not a match. The pack asked for 700 and   #
 * # this film does not have one. Vendoring the missing weight is the  #
 * # fix and it is one more woff2 beside the three already there.      #
 * ####################################################################
 */
const HEADLINE_WEIGHT = 600

/** The kicker carries no weight in the pack. 500 is the film's own body weight. */
const KICKER_WEIGHT = 500

/**
 * Punctuation is stripped and case is folded before matching, so a headline
 * word ending in a comma still matches a clean highlight word. The pack's own
 * function, unchanged — it is the reason `highlightWords` can be written the way
 * a person would say them.
 */
function normalizeWord(word: string): string {
  return word.replace(/[.,!?;:]/g, '').toUpperCase()
}

export function P03({ src, kicker, headline, highlightWords }: P03Props): ReactNode {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const words = headline.toUpperCase().split(/\s+/).filter(Boolean)
  const highlights = new Set(highlightWords.map(normalizeWord))

  /*
   * The stagger runs in HEADLINE order, not in the order the caller listed the
   * words. So passing them the other way round changes nothing, which is the
   * behaviour you want and is worth knowing before someone "fixes" it.
   */
  const highlightedIndices = words
    .map((word, index) => (highlights.has(normalizeWord(word)) ? index : -1))
    .filter((index) => index >= 0)

  const backgroundScale = interpolate(frame, [0, durationInFrames - 1], [1, 1.09], {
    ...clamp,
    // Keep the push moving at a steady rate through the final frame.
    easing: Easing.linear,
  })
  const backgroundX = interpolate(frame, [0, durationInFrames - 1], [0, -12], clamp)
  const entrance = interpolate(frame, [0, 0.6 * fps], [0, 1], { ...clamp, easing: quietEase })
  const exit = interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], clamp)
  const contentOpacity = Math.min(entrance, exit)
  const titleY = interpolate(frame, [0, 0.7 * fps], [22, 0], { ...clamp, easing: quietEase })

  return (
    <AbsoluteFill style={{ backgroundColor: '#070807', overflow: 'hidden' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {/*
          The template grades its OWN picture here, as P12, P17, P19 and P22 do.
          `Scene` must not also mount `<Grade>` on a template branch.
        */}
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: backgroundScale,
            translate: `${String(backgroundX)}px 0px`,
            filter: 'saturate(0.86) contrast(1.08) brightness(0.82)',
          }}
        />
      </AbsoluteFill>

      {/*
        Two darkening layers, a centre-weighted radial and an inset vignette.
        Together they are what makes ivory type legible over an arbitrary
        photograph, which is the same problem `OVERLAY.scrim` solves in the
        film's own devices.
      */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 52% 46%, rgba(255, 246, 218, 0.08), rgba(0, 0, 0, 0.42) 72%)',
        }}
      />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.55)' }} />

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          paddingLeft: 138,
          paddingBottom: 150,
          opacity: contentOpacity,
          translate: `0px ${String(titleY)}px`,
        }}
      >
        <div style={{ maxWidth: 1120 }}>
          <div
            style={{
              marginBottom: 18,
              color: '#d8bd88',
              fontFamily: FONT_FAMILY,
              fontSize: 22,
              fontWeight: KICKER_WEIGHT,
              // A synthesised oblique. No italic face is registered under
              // FONT_FAMILY, and this is the first place on the project where
              // that actually reaches a frame.
              fontStyle: 'italic',
              letterSpacing: 4.4,
              textTransform: 'uppercase',
            }}
          >
            {kicker}
          </div>
          {/*
            A WRAPPING FLEX ROW OF WORD SPANS, and it has to be one — each word
            needs its own positioned marker, so this cannot be a single text
            node. The cost is the same one `a2`'s caption row paid: flex wrapping
            can strand a short last word alone on a line, where normal text flow
            with `textWrap: balance` would not. Not changed, because the marker
            geometry depends on each word being its own inline-block.
          */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: 22,
              rowGap: 8,
              color: '#f0eadb',
              fontFamily: FONT_FAMILY,
              fontSize: 92,
              fontWeight: HEADLINE_WEIGHT,
              letterSpacing: 0.4,
              lineHeight: 0.98,
              textTransform: 'uppercase',
              textShadow: '0 3px 18px rgba(0, 0, 0, 0.52)',
            }}
          >
            {words.map((word, index) => {
              const highlightRank = highlightedIndices.indexOf(index)
              const isHighlighted = highlightRank >= 0
              // Let the complete headline settle before the highlight begins.
              const markerStart = (1.0 + highlightRank * 0.18) * fps
              const markerEnd = markerStart + 0.48 * fps
              const markerScale = isHighlighted
                ? interpolate(frame, [markerStart, markerEnd], [0, 1], {
                    ...clamp,
                    easing: quietEase,
                  })
                : 0

              return (
                <span
                  key={`${word}-${String(index)}`}
                  style={{ position: 'relative', display: 'inline-block' }}
                >
                  {isHighlighted ? (
                    /*
                      The marker overhangs the word by 14px each side and is
                      1.06em tall, so it reads as a drawn mark rather than a
                      text background. `scale: markerScale 1` with a left
                      origin is what paints it left to right — it is a
                      transform, so it costs no layout and cannot reflow the
                      headline mid-animation.
                    */
                    <span
                      style={{
                        position: 'absolute',
                        left: -14,
                        right: 'auto',
                        top: '-0.06em',
                        width: 'calc(100% + 28px)',
                        height: '1.06em',
                        backgroundColor: 'rgba(191, 151, 73, 0.76)',
                        opacity: 0.95,
                        scale: `${String(markerScale)} 1`,
                        transformOrigin: 'left center',
                        zIndex: 0,
                      }}
                    />
                  ) : null}
                  <span style={{ position: 'relative', zIndex: 1 }}>{word}</span>
                </span>
              )
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
