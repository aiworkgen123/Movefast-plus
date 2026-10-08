import { useLayoutEffect } from 'react'
import { continueRender, delayRender } from 'remotion'
import { BODY_FACE_FAMILY } from './bodyFace.js'
import { BODY_FACE_BOLD_WOFF2_BASE64 } from './bodyFaceBoldData.js'

/**
 * Noto Sans Bold, registered under the SAME family as the regular.
 *
 * ####################################################################
 * # WHY IT EXISTS. a2's marked phrases are a real weight 700 in his    #
 * # reference, and without a bold face in the family `font-weight:    #
 * # 700` falls through to Chrome's SYNTHETIC bold, which draws heavier #
 * # glyphs and adds nothing to their advances. The marks then came out #
 * # at 0.912-0.933 of his width and one paragraph wrapped differently. #
 * #                                                                   #
 * # Registering this face under `BODY_FACE_FAMILY` with weight 700 is  #
 * # what makes the browser pick a real bold for those spans, so the    #
 * # extra width lives inside each glyph where his does.                #
 * ####################################################################
 *
 * A SEPARATE MODULE, NOT A SECOND FACE INSIDE `bodyFace.ts`, so the devices
 * that set only the regular (a3, a5) do not carry this blob in their import
 * graph.
 */
const BOLD_SOURCE = `url(data:font/woff2;base64,${BODY_FACE_BOLD_WOFF2_BASE64}) format('woff2')`

/** Loads the bold and holds the render until it is really available. Same contract as `useBodyFace`. */
export function useBodyFaceBold(): void {
  useLayoutEffect(() => {
    const handle = delayRender(`loading ${BODY_FACE_FAMILY} bold`)
    let cancelled = false

    void (async () => {
      try {
        const loaded = await new FontFace(BODY_FACE_FAMILY, BOLD_SOURCE, {
          weight: '700',
          style: 'normal',
          display: 'block',
        }).load()
        if (!cancelled) document.fonts.add(loaded)
      } catch (error) {
        console.warn(
          `${BODY_FACE_FAMILY} bold failed to load, so the marks fall back to a synthetic bold ` +
            `and this frame MUST NOT be sent to the client. Cause: ${String(error)}`,
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
