import { useLayoutEffect } from 'react'
import { continueRender, delayRender } from 'remotion'
import { CONDENSED_FACE_WOFF2_BASE64 } from './condensedFaceData.js'

/**
 * The heavy condensed grotesque the client's own references are set in.
 *
 * ####################################################################
 * # THIS DELIBERATELY CONTRADICTS `fonts.ts`, AND THE REASON MATTERS. #
 * #                                                                   #
 * # `fonts.ts` says of the film's own typeface: "Montserrat, Poppins  #
 * # and Bebas are excluded on purpose: those three are so overused in #
 * # generated video that the typeface alone announces what made the   #
 * # film." That rule is about OUR default look and it still stands.   #
 * #                                                                   #
 * # It does not govern HIS reference. a4, a7 and a8 are set in a      #
 * # condensed face he chose, and the job of a reference clip is to    #
 * # match what he sent, not to improve it. Measured against his own   #
 * # frames, Bebas Neue is the face: nothing else is close, and the    #
 * # per-glyph pattern matches including the distinctively narrow `I`. #
 * #                                                                   #
 * # SO THIS IS SCOPED TO HIS FRAMES, BY NAME, AND MUST STAY THAT WAY. #
 * #                                                                   #
 * # This used to read "Nothing the film bundles may import it", and   #
 * # that has been false since 2026-08-30. The scope was never the     #
 * # bundle, it was the SENTENCE two lines up: a4, a7 and a8. All      #
 * # three import this file and all three draw in the film.            #
 * #                                                                   #
 * # THE FOURTH NAME IS SAKU'S TEMPLATE 05, SINCE 2026-09-12, and it   #
 * # is the same argument, not a new licence. `templates/ShadowUp.tsx` #
 * # ports his approved shadow-up, whose manifest locks a condensed    #
 * # bold face this repo does not carry and records no licence for.    #
 * # Bebas Neue is the one condensed face the repo has. Set at 104 px  #
 * # it matches his preview's 73-row cap and sets his own line 645.6   #
 * # px wide against the preview's 632 px of ink. So the face still    #
 * # only reproduces the frames he approved. Taken on the spec's      #
 * # recommended default and reported to the developer, who did not   #
 * # object, 2026-09-12.                                              #
 * #                                                                   #
 * # `inert.test.ts` pins exactly those four BY NAME, and a fifth      #
 * # importer is a failure.                                            #
 * ####################################################################
 *
 * ####################################################################
 * # WHY THE BYTES ARE INLINE INSTEAD OF IN `apps/web/public/fonts`.   #
 * #                                                                   #
 * # `bundleHash` is `hashDirectory` over the bundle OUTPUT, and       #
 * # `publicDir` is copied into that output wholesale. So one new      #
 * # woff2 in `public/fonts` moves `bundleHash`, and every render key  #
 * # folds `bundleHash` in — which invalidates EVERY cached segment of #
 * # the client's film and turns the next re-render from ten minutes   #
 * # into seventy-five.                                                 #
 * #                                                                   #
 * # THE ARGUMENT SURVIVED THE MODULE ENTERING THE BUNDLE, and that    #
 * # is worth spelling out because the old note here said the opposite.#
 * #                                                                   #
 * # It said the data URI "stops being true the day something the film #
 * # bundles imports this file". Four components now do. What it got  #
 * # wrong is that the two costs are not the same one. `publicDir` is  #
 * # copied into the output WHOLESALE, so a woff2 there is carried by  #
 * # every render whether or not anything reads it. A module is only   #
 * # in the graph when something imports it, and by then the device it #
 * # serves is drawing, which is the point of shipping it at all.      #
 * #                                                                   #
 * # It still moves `bundleHash` on the commit that wires it, which   #
 * # is why a4, a7, a8 and 05 should each be batched with other work  #
 * # that already invalidates the cache rather than paid for on their #
 * # own.                                                             #
 * ####################################################################
 */
export const CONDENSED_FAMILY = 'ClipCondensed'

/**
 * Bebas Neue's cap height, read off the vendored file's own `OS/2` table.
 *
 * `sCapHeight` is 700 of 1000 units per em, and the outlines agree: `#`, `1`
 * and `4` all have a bounding-box height of exactly 700, while `2` and `3`
 * overshoot to 710 as round glyphs do.
 */
export const CONDENSED_CAP_OVER_EM = 0.7

/**
 * Where the baseline sits in a `line-height: 1` box, as a fraction of the em.
 *
 * ####################################################################
 * # `top: baseline - fontSize` IS WRONG AND IT ALREADY SHIPPED WRONG. #
 * #                                                                   #
 * # With `line-height: 1` the line box is one em tall, but a face is  #
 * # taller than its em. CSS centres the overflow, so the half-leading #
 * # is negative and the baseline does not land at the bottom of the   #
 * # box. a3 and a5 both rendered 0.112em too high for exactly this,   #
 * # which measured 22px against the client's own frame at peak zoom,  #
 * # and ALL 464 TESTS PASSED OVER IT because nothing in this repo     #
 * # lays out text. Only comparing a render to his frame caught it.    #
 * #                                                                   #
 * # For Bebas the error would be LARGER than it was for Noto Sans:    #
 * # 0.200em rather than 0.112em.                                      #
 * ####################################################################
 *
 * ####################################################################
 * # 0.800 IS THE SAME UNDER BOTH METRIC CONVENTIONS CHROME PICKS      #
 * # BETWEEN, AND THAT IS LUCK WORTH KNOWING ABOUT.                    #
 * #                                                                   #
 * # Chrome takes a face's ascent and descent from `hhea` on some      #
 * # platforms and from `OS/2.usWin*` on others, and the two disagree  #
 * # for this file:                                                    #
 * #                                                                   #
 * #   hhea    asc 900  desc -300   sum 1.200em                        #
 * #   usWin   asc 950  desc  350   sum 1.300em                        #
 * #                                                                   #
 * # baseline = (1 - sum)/2 + asc, so hhea gives -0.100 + 0.900 and    #
 * # usWin gives -0.150 + 0.950. BOTH ARE 0.800 EXACTLY, because the   #
 * # two pairs are symmetric about the same point.                     #
 * #                                                                   #
 * # So this constant does not put the host render and the container   #
 * # render at risk of disagreeing, which was a live worry for a face  #
 * # that exists nowhere on disk. DO NOT assume that holds for the     #
 * # next face — recompute it, and check both conventions.             #
 * ####################################################################
 */
export const CONDENSED_FACE_BASELINE_OVER_EM = 0.8

const FACE_SOURCE = `url(data:font/woff2;base64,${CONDENSED_FACE_WOFF2_BASE64}) format('woff2')`

/**
 * His face is Bebas Neue PLUS A SYNTHETIC STROKE, not Bebas Neue alone.
 *
 * Every glyph measured off his frames is WIDER than the real outline by a
 * near-constant amount, which is what a stroke painted under the fill does and
 * what a horizontal scale does not — a scale would widen `M` and `I` in
 * proportion, and his `I` is off by twice what his `M` is.
 *
 * ####################################################################
 * # TWO STROKE FIGURES ARE IN CIRCULATION AND NEITHER IS AUTHORITATIVE#
 * #                                                                   #
 * #   0.046 cap heights  the developer's earlier note, fitted against #
 * #                      RENDERED PIXELS from his video               #
 * #   0.0256 cap heights fitted here against the FONT OUTLINES, from  #
 * #                      the same ten glyph widths                     #
 * #                                                                   #
 * # They disagree because thresholded, antialiased, then h264-encoded #
 * # ink measures wider than the outline it came from. Neither number  #
 * # is the answer.                                                     #
 * #                                                                   #
 * # FIT IT AGAINST A REAL RENDER, per animation, the way the grid     #
 * # blur was fitted per animation. Until that is done for a device,   #
 * # do not pin a number in its component.                              #
 * ####################################################################
 */
export const CONDENSED_STROKE_CAP_FRACTION = {
  /** Fitted against font outlines only. A STARTING POINT, not a result. */
  outlineFit: 0.0256,
  /** The earlier pixel-space figure, kept so the two can be compared. */
  pixelFitLegacy: 0.046,
} as const

/**
 * What to check his promised font file against the moment it arrives.
 *
 * Cap-normalised INK widths measured off his own frames, plus the ratios that
 * survive a scale. If a candidate file reproduces these, it is his face; if it
 * reproduces them only after a horizontal squash, it is NOT — squashing thins
 * vertical stems and leaves horizontal bars alone, so `barOverStem` moves and
 * that is the tell.
 */
export const CONDENSED_FINGERPRINT = {
  inkOverCap: {
    A: 0.5575, E: 0.4534, F: 0.4426, G: 0.4932, H: 0.5082,
    I: 0.1926, L: 0.4444, M: 0.6681, R: 0.5131, T: 0.5111,
  },
  stemOverCap: 0.1955,
  barOverStem: 0.89,
  capHeightPx: 42.91,
} as const

/**
 * Loads the condensed face and holds the render until it is really available.
 *
 * Mirrors `fonts.ts`: a missing face is a cosmetic defect and must never throw
 * away a render, so a failure warns and lets the browser fall back. Unlike
 * `fonts.ts` there is no metric-compatible fallback to register — no condensed
 * face is installed in the worker container — so a failure here is visible in
 * the frame rather than merely wrong.
 *
 * This was written when only clips used the face, and called a failure
 * acceptable for a clip and not for a film. a4, a7, a8 and 05 now draw in the
 * film, so a failure here is a wrong face in a delivered film. It still warns
 * rather than throws, because a throw kills the segment. So search every film's
 * render log for "ClipCondensed failed to load" before it is sent.
 */
export function useCondensedFace(): void {
  useLayoutEffect(() => {
    const handle = delayRender(`loading ${CONDENSED_FAMILY}`)
    let cancelled = false

    void (async () => {
      try {
        const loaded = await new FontFace(CONDENSED_FAMILY, FACE_SOURCE, {
          weight: '400',
          style: 'normal',
          display: 'block',
        }).load()
        if (!cancelled) document.fonts.add(loaded)
      } catch (error) {
        console.warn(
          `${CONDENSED_FAMILY} failed to load, so this clip is set in a fallback face and ` +
            `MUST NOT be sent to the client. Cause: ${String(error)}`,
        )
      } finally {
        continueRender(handle)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])
}
