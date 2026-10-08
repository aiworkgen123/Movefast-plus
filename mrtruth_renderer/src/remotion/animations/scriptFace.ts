import { useLayoutEffect } from 'react'
import { continueRender, delayRender } from 'remotion'
import { SCRIPT_FACE_WOFF2_BASE64 } from './scriptFaceData.js'

/**
 * The marker/script face the client's a7 checklist rows are set in.
 *
 * ####################################################################
 * # IT IS CAVEAT BOLD, AND THAT IS AN IDENTIFICATION RATHER THAN A    #
 * # GUESS.                                                            #
 * #                                                                   #
 * # Measured against a7's own frames across all three rows — 39       #
 * # glyphs of "Key takeaway #1..3" — Caveat 700 wins on a whole-line  #
 * # pixel fit and on a scale-free per-glyph width test, and the       #
 * # letterforms survive shape exclusion where the obvious rivals do   #
 * # not.                                                              #
 * #                                                                   #
 * # THE LEAN IS DRAWN INTO THE GLYPHS, NOT APPLIED AS A SKEW. The     #
 * # file's own `post.italicAngle` is 0.0, and Caveat supplies about   #
 * # 19.8 degrees of slant on its own against the 19.5 measured off    #
 * # his frames. So DO NOT add a CSS skew and DO NOT reach for an      #
 * # italic file — there isn't one, and skewing on top double-slants   #
 * # every glyph.                                                      #
 * #                                                                   #
 * # THE WEIGHT IS THE SOFT PART. Caveat 700 beats 600 by only 6.6%,   #
 * # and his frames carry about 7% LESS ink than a clean 700 render at #
 * # 59px, which points the other way. Size and weight trade against   #
 * # stroke thickness, and h264 plus the source renderer's             #
 * # antialiasing move the alpha-0.5 contour by 0.2-0.3px. The family, #
 * # the size, the position and the timing are all far firmer than the #
 * # weight. If a render reads heavy, try `wght 660` before touching   #
 * # anything else.                                                    #
 * ####################################################################
 *
 * ####################################################################
 * # SCOPED TO THE CLIPS, LIKE THE OTHER TWO VENDORED FACES.           #
 * #                                                                   #
 * # `fonts.ts` governs the FILM's own look and deliberately excludes  #
 * # overused faces from it. This module is not part of that decision. #
 * # The job of a reference clip is to match what the client sent, and #
 * # nothing the film bundles may import this file. `inert.test.ts`    #
 * # enforces that.                                                    #
 * ####################################################################
 */
export const SCRIPT_FAMILY = 'ClipScript'

/**
 * Caveat Bold's cap height as a fraction of its em, read from its OS/2 table.
 *
 * `sCapHeight` is 610 of 1000 units per em. NOTE that the measured ink of a
 * capital `K` on his frames stands 39.3px at a 59px size, which is 0.666em
 * rather than 0.610 — Caveat's capitals overshoot their declared cap height,
 * as a handwriting face's tend to. Use the DECLARED value for size conversion
 * and the measured ink for checking a render, and do not confuse the two.
 */
export const SCRIPT_FACE_CAP_OVER_EM = 0.61

/** `sxHeight` is 400 of 1000, and it matches the measured a/e/w tops at 23.6px on 59. */
export const SCRIPT_FACE_X_HEIGHT_OVER_EM = 0.4

/**
 * Where the baseline sits in a `line-height: 1` box, as a fraction of the em.
 *
 * ####################################################################
 * # `top: baseline - fontSize` IS WRONG AND IT HAS SHIPPED WRONG      #
 * # TWICE ON THIS PROJECT.                                            #
 * #                                                                   #
 * # With `line-height: 1` the line box is one em tall, but a face is  #
 * # taller than its em. CSS centres the overflow, so the half-leading #
 * # is negative and the baseline does not land at the bottom of the   #
 * # box. a3 and a5 both rendered 0.112em too high for exactly this,   #
 * # which measured 22px against the client's own frame at peak zoom,  #
 * # and ALL 464 TESTS PASSED OVER IT because nothing in this repo     #
 * # lays out text.                                                    #
 * ####################################################################
 *
 * ####################################################################
 * # 0.830 UNDER BOTH CONVENTIONS CHROME PICKS BETWEEN, WHICH IS LUCK  #
 * # WORTH CHECKING FOR EVERY NEW FACE.                                #
 * #                                                                   #
 * #   hhea    asc 960  desc -300   sum 1.260em                        #
 * #   usWin   asc 974  desc  315   sum 1.289em                        #
 * #                                                                   #
 * # baseline = (1 - sum)/2 + asc                                      #
 * #   hhea   -0.1300 + 0.960 = 0.8300                                 #
 * #   usWin  -0.1445 + 0.974 = 0.8295                                 #
 * #                                                                   #
 * # They agree to 0.0005em, which is 0.03px at this size. So the host #
 * # render and the container render cannot disagree about it — the    #
 * # same property Bebas turned out to have, and the same one the      #
 * # NEXT face must be checked for rather than assumed to share.       #
 * ####################################################################
 */
export const SCRIPT_FACE_BASELINE_OVER_EM = 0.83

const FACE_SOURCE = `url(data:font/woff2;base64,${SCRIPT_FACE_WOFF2_BASE64}) format('woff2')`

/**
 * Loads the script face and holds the render until it is really available.
 *
 * Mirrors `fonts.ts`: a missing face is a cosmetic defect and must never throw
 * away a render, so a failure warns and lets the browser fall back. There is no
 * metric-compatible fallback to register — no handwriting face is installed in
 * the worker container — so a failure here is visible in the frame rather than
 * merely wrong. Acceptable for a clip a human looks at before sending, and not
 * acceptable in a film.
 */
export function useScriptFace(): void {
  useLayoutEffect(() => {
    const handle = delayRender(`loading ${SCRIPT_FAMILY}`)
    let cancelled = false

    void (async () => {
      try {
        const loaded = await new FontFace(SCRIPT_FAMILY, FACE_SOURCE, {
          /*
            A RANGE, because the vendored file is the variable wght axis. Declaring
            a single weight against a variable file makes Chrome pick that instance
            and ignore any other font-weight the component asks for, which would
            silently freeze the one number this animation still needs to tune.
          */
          weight: '400 700',
          style: 'normal',
          display: 'block',
        }).load()
        if (!cancelled) document.fonts.add(loaded)
      } catch (error) {
        console.warn(
          `${SCRIPT_FAMILY} failed to load, so this clip is set in a fallback face and ` +
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
