import { Img } from 'remotion'
import type { ImgProps } from 'remotion'

/**
 * Every photograph this film draws goes through here.
 *
 * ##########################################################################
 * # THIRTY `<Img>` SITES, NOT ONE OF THEM WITH A RETRY, AND ONE SLOW FETCH #
 * # KILLS A WHOLE SEGMENT.                                                 #
 * #                                                                        #
 * # Remotion gates a frame on `delayRender` while an image decodes. The    #
 * # default allowance is 28 seconds and the default retry count is ZERO,   #
 * # so a single asset that is slow to read — a cold page cache on the box, #
 * # a 12MB scan, a disk under load from three other headless Chromes at    #
 * # RENDER_CONCURRENCY 4 — fails that segment outright.                    #
 * #                                                                        #
 * # THE COST IS NOT THE SEGMENT, IT IS THE FILM. `renderMedia` is called   #
 * # per scene in a serial loop, so one failure ends the stage, and the     #
 * # resume re-renders from there. On a 166-scene job that is the           #
 * # difference between a retried image and an hour.                        #
 * #                                                                        #
 * # A WRAPPER RATHER THAN THIRTY PROPS, on purpose. Thirty call sites is   #
 * # thirty chances to forget one, and the sixteenth device added next      #
 * # month would forget it silently — which is the exact shape of the       #
 * # `assetSrc !== null` narrowing that already shipped a device the        #
 * # compositor threw away. `img-retry.test.ts` walks the source and fails  #
 * # if any component imports `Img` from `remotion` directly.               #
 * #                                                                        #
 * # A DEFAULT, NOT A CLAMP. Both props are still overridable, because a    #
 * # caller with a genuinely different budget should be able to say so.     #
 * ##########################################################################
 *
 * WHY THESE NUMBERS. Three retries against a 60-second allowance is 180 seconds
 * of patience for one image, which is far longer than any asset on disk needs
 * and still an order of magnitude under the render timeout. It is sized to
 * absorb a transient stall, not to hide a missing file — a genuinely absent
 * asset fails all three attempts and the segment still stops, which is correct.
 */
export const SOURCED_IMG_RETRIES = 3
export const SOURCED_IMG_TIMEOUT_MS = 60_000

export function SourcedImg(props: ImgProps): React.JSX.Element {
  return (
    <Img
      delayRenderRetries={SOURCED_IMG_RETRIES}
      delayRenderTimeoutInMilliseconds={SOURCED_IMG_TIMEOUT_MS}
      {...props}
    />
  )
}
