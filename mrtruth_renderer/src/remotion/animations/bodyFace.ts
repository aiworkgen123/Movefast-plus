import { useLayoutEffect } from 'react'
import { continueRender, delayRender } from 'remotion'
import { BODY_FACE_WOFF2_BASE64 } from './bodyFaceData.js'

/**
 * The face the client's own reference animations are set in.
 *
 * ####################################################################
 * # IT IS NOTO SANS REGULAR, AND THAT IS AN IDENTIFICATION RATHER     #
 * # THAN A GUESS.                                                     #
 * #                                                                   #
 * # Measured against a5's own frames, per-glyph ink width over cap    #
 * # height across E L O N M U S K:                                    #
 * #                                                                   #
 * #     Noto Sans      0.28% rms, with a fitted synthetic stroke of   #
 * #                    -0.0009 cap heights, i.e. NONE                 #
 * #     Inter          4.93%                                          #
 * #     DM Sans        5.16%                                          #
 * #     Montserrat     5.36%                                          #
 * #     Libre Franklin 8.54%   <- what this repo owns                 #
 * #                                                                   #
 * # A 17x margin over the next best, and no free parameter doing any  #
 * # work. Compare a4's chips, where Bebas Neue fitted at 0.6% and     #
 * # needed a synthetic stroke to do it.                                #
 * #                                                                   #
 * # AN EARLIER PASS CALLED THIS UNKNOWN AND IT WAS WRONG. It swept    #
 * # the host's installed faces and fifteen Google candidates and      #
 * # never tested Noto Sans, which was sitting inside this repo's own  #
 * # `node_modules` the whole time.                                     #
 * ####################################################################
 *
 * ####################################################################
 * # HE STILL OWES US THE FONT EXAMPLE, AND THIS DOES NOT REPLACE IT.  #
 * #                                                                   #
 * # What is established is the face in the REFERENCE VIDEO he sent.   #
 * # He asked to approve the typeface for the FILM separately, and     #
 * # `fonts.ts` deliberately excludes overused faces from the film's   #
 * # own look. Matching his reference in a reference clip is not the   #
 * # same decision as choosing the film's type, and this module is     #
 * # scoped to the clips so the two cannot be confused.                 #
 * ####################################################################
 */
export const BODY_FACE_FAMILY = 'ClipBodySans'

/** Noto Sans Regular's cap height as a fraction of its em, read from its OS/2 table. */
export const BODY_FACE_CAP_OVER_EM = 0.714

/**
 * Where the baseline sits inside a `line-height: 1` box, as a fraction of the
 * font size.
 *
 * ####################################################################
 * # `top = baseline - fontSize` IS WRONG AND IT SHIPPED ONCE.        #
 * #                                                                   #
 * # It reads as obviously right and it is not. With `line-height: 1`  #
 * # the line box is one em tall, but the FACE is taller than that —   #
 * # Noto Sans's ascender plus descender is 1.362em. CSS centres the   #
 * # overflow, so the half-leading is negative and the baseline lands  #
 * # at (1 - 1.362)/2 + 1.069 = 0.888em from the top, not at 1.000em.  #
 * #                                                                   #
 * # Positioning by `baseline - fontSize` therefore puts every line    #
 * # 0.112em too HIGH. On a3 that is 14.5 base px, which measured as   #
 * # 22px on screen at peak zoom against the client's own frame. It    #
 * # passed every test, because no test in this repo lays out text.    #
 * # ONLY COMPARING A RENDER TO HIS FRAME CAUGHT IT.                   #
 * #                                                                   #
 * # Recompute this if the family changes. It is a property of the     #
 * # face's own vertical metrics, not a constant of CSS.                #
 * ####################################################################
 */
export const BODY_FACE_BASELINE_OVER_EM = 0.888

const FACE_SOURCE = `url(data:font/woff2;base64,${BODY_FACE_WOFF2_BASE64}) format('woff2')`

/**
 * Loads the face and holds the render until it is really available.
 *
 * Mirrors `fonts.ts`: a failure warns rather than throwing away a render. There
 * is no metric-compatible fallback registered, so a failure here is visible in
 * the frame — acceptable for a clip a human looks at before sending, and not
 * acceptable in a film.
 */
export function useBodyFace(): void {
  useLayoutEffect(() => {
    const handle = delayRender(`loading ${BODY_FACE_FAMILY}`)
    let cancelled = false

    void (async () => {
      try {
        const loaded = await new FontFace(BODY_FACE_FAMILY, FACE_SOURCE, {
          weight: '400',
          style: 'normal',
          display: 'block',
        }).load()
        if (!cancelled) document.fonts.add(loaded)
      } catch (error) {
        console.warn(
          `${BODY_FACE_FAMILY} failed to load, so this clip is set in a fallback face and ` +
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
