import { useLayoutEffect } from 'react'
import { continueRender, delayRender, staticFile } from 'remotion'
import { FONT_FAMILY, SERIF_FAMILY } from './constants.js'

/**
 * Fonts must be BUNDLED and LOADED BEFORE THE FIRST FRAME.
 *
 * A slim Linux render container has no system fonts of its own choosing. Remotion
 * will not warn you: it renders whatever the browser falls back to, which on a
 * bare container can be a different metric set per segment. Captions then jitter
 * horizontally at every cut, and the cause is invisible in the plan, in the logs,
 * and in a single screenshot. `delayRender` holds the render until the face is
 * really available.
 *
 * WHAT THIS DOES *NOT* DO IS FAIL THE RENDER. It used to call `cancelRender()`,
 * on the reasoning that a silent fallback is worse than a failed render. That
 * trade is wrong at this scale: a missing typeface is a cosmetic defect, and
 * throwing away a three-hour job over it — at segment 140, on the client's
 * laptop — costs far more than captions in the wrong grotesque. So a failure
 * warns and falls back to a metric-compatible system face registered under the
 * SAME family name, which keeps the metrics identical across every segment. That
 * is the property that actually matters: consistent, not correct.
 *
 * The loud, readable signal lives worker-side instead — `ensureRenderFonts` in
 * `apps/worker/src/bundle.ts` warns once at start-up when the files are not on
 * disk, which is somewhere a human will see it.
 *
 * WHERE `staticFile()` LOOKS. These two files are BUNDLED: they sit in this app's
 * `public/fonts`, which is the directory handed to `bundle()` as `publicDir` and
 * copied into the bundle output. That is the whole reason fonts and scene images
 * travel differently — fonts are small, fixed and known at build time, so they
 * ride along in the bundle; scene images are downloaded per job long after the
 * bundle exists and are served from the storage mount instead. `staticFile()` is
 * for the first kind only. The one other caller is `OverlayClipLayer` in
 * `Scene.tsx`, whose light-burn frames are the same kind: small, fixed, bundled.
 *
 * The intended face is a Franklin-Gothic-class grotesque — the news and
 * documentary lineage. Montserrat, Poppins and Bebas are excluded on purpose:
 * those three are so overused in generated video that the typeface alone
 * announces what made the film.
 *
 * ####################################################################
 * # THE RENDER GATE IS CREATED IN A LAYOUT EFFECT, NEVER AT MODULE    #
 * # SCOPE. THIS IS THE WHOLE REASON STAGE 6 USED TO DIE.              #
 * #                                                                   #
 * # `delayRender()` registers the handle in TWO places on `window`:   #
 * # it pushes the id onto `remotion_delayRenderHandles` and it stores #
 * # an armed 28s timer in `remotion_delayRenderTimeouts`.             #
 * # `continueRender()` disarms that timer ONLY IF the id is still in  #
 * # the first array (`delay-render.js`: `handleExists && ...`).       #
 * #                                                                   #
 * # Remotion's own module top-level runs                              #
 * #   `window.remotion_delayRenderHandles = []`   (unconditional)     #
 * #   `if (!window.remotion_delayRenderTimeouts) ... = {}` (guarded)  #
 * # and the bundle contains TWO copies of that module — Remotion      #
 * # ships `remotion/dist/esm/index.mjs` and `remotion/dist/esm/       #
 * # no-react.mjs` as separately pre-bundled ESM files, each with its  #
 * # own inlined copy. Whichever evaluates SECOND wipes the handles    #
 * # array while leaving the armed timers behind.                      #
 * #                                                                   #
 * # A handle taken during module evaluation is therefore erased from  #
 * # the array before its font ever finishes loading. `continueRender` #
 * # then finds `handleExists === false`, silently skips the           #
 * # `clearTimeout`, and returns as if it had worked — and 28 seconds  #
 * # later the orphaned timer fires `cancelRender()` and kills a       #
 * # render whose font loaded perfectly 27.8 seconds earlier.          #
 * #                                                                   #
 * # A layout effect runs long after every module in the bundle has    #
 * # evaluated, so the array is stable and the handle survives. This   #
 * # is also how Remotion's own `<Img>` takes its handle.              #
 * ####################################################################
 */

type FaceSpec = { file: string; weight: string; family: string }

/**
 * Four weights from three files, and the mismatch is deliberate.
 *
 * 500 and 600 are STATIC instances and have shipped in every delivered film. They
 * are left exactly as they are: they set the captions and the text cards the
 * client has already accepted, and re-cutting them from a different file to tidy
 * this list would put approved pixels at risk for no gain.
 *
 * ####################################################################
 * # 300 AND 800 COME FROM ONE VARIABLE FILE, BECAUSE GOOGLE NO LONGER #
 * # SERVES STATICS FOR THIS FAMILY.                                   #
 * #                                                                   #
 * # Asking the CSS API for `wght@300;800` returns the SAME woff2 URL  #
 * # twice — one variable face with a `wght` axis, not two cuts. A     #
 * # single-value `weight` descriptor pins that axis, so registering   #
 * # the file twice gives a real 300 and a real 800 rather than one    #
 * # default instance used for both.                                    #
 * #                                                                   #
 * # THIS IS VERIFIED BY LOOKING, NOT BY READING THE SPEC. A weight    #
 * # the browser cannot honour does not error — it synthesises or      #
 * # falls back, and `loadEverything` below fails SOFT by design, so a #
 * # wrong weight would reach a six-hour render with nothing red. The  #
 * # check is a one-frame still: see `apps/web/scripts/look-still.ts`. #
 * ####################################################################
 *
 * 300 sets the lower-left caption and the plate caption; 800 sets the full-frame
 * year. Both come from the client's 2026-08-15 references.
 */
const FACES: readonly FaceSpec[] = [
  { file: 'fonts/LibreFranklin-Variable.woff2', weight: '300', family: FONT_FAMILY },
  { file: 'fonts/LibreFranklin-Medium.woff2', weight: '500', family: FONT_FAMILY },
  { file: 'fonts/LibreFranklin-SemiBold.woff2', weight: '600', family: FONT_FAMILY },
  { file: 'fonts/LibreFranklin-Variable.woff2', weight: '800', family: FONT_FAMILY },

  /*
   * ####################################################################
   * # ONE FILE, TWO WEIGHTS, AND IT IS THE SAME VARIABLE-FACE TRICK    #
   * # THE 300/800 PAIR ABOVE ALREADY USES.                             #
   * #                                                                   #
   * # Playfair Display ships from Google as ONE variable face with a    #
   * # `wght` axis covering 400..900. Registering it twice with a        #
   * # single-value `weight` descriptor pins that axis, so 500 and 700   #
   * # are real instances rather than one default used for both.        #
   * #                                                                   #
   * # 700 sets the chapter plate's heading and the name plate's name.   #
   * # 500 sets the name plate's role line, which is visibly lighter in  #
   * # the client's clip and would be a synthesised fake at 700.         #
   * #                                                                   #
   * # VERIFY BY LOOKING, NOT BY READING. A weight the browser cannot    #
   * # honour does not error, it synthesises, and `loadEverything` fails #
   * # SOFT by design. The check is a one-frame still — see              #
   * # `apps/web/scripts/look-still.ts`.                                 #
   * ####################################################################
   */
  { file: 'fonts/PlayfairDisplay-Variable.woff2', weight: '500', family: SERIF_FAMILY },
  { file: 'fonts/PlayfairDisplay-Variable.woff2', weight: '700', family: SERIF_FAMILY },
]

/**
 * The fallback, in descending order of how close it is to Libre Franklin.
 *
 * Liberation Sans is installed by `docker/worker.Dockerfile` and is metric
 * compatible with Arial; DejaVu Sans is the near-universal Linux default. They
 * are registered under `FONT_FAMILY` itself, so no component needs to know a
 * fallback happened.
 */
const FALLBACK_SOURCE =
  "local('Liberation Sans'), local('Arial'), local('Helvetica Neue'), local('Helvetica'), local('DejaVu Sans')"

/**
 * The serif fallback, in descending order of how close it is to Playfair Display.
 *
 * Nothing here is a high-contrast display serif, because nothing installed on the
 * render box is. `docker/worker.Dockerfile` installs `fonts-liberation` and
 * `fonts-noto-core` and no more, so a miss lands on Liberation Serif, which is
 * metric-compatible with Times New Roman. That is a WORKHORSE serif and it will
 * look wrong next to the client's reference — but wrong and identical in every
 * segment beats a cancelled render, which is the same trade the sans stack makes.
 */
const SERIF_FALLBACK_SOURCE =
  "local('Liberation Serif'), local('Noto Serif'), local('DejaVu Serif'), local('Georgia'), local('Times New Roman')"

function fallbackSourceFor(family: string): string {
  return family === SERIF_FAMILY ? SERIF_FALLBACK_SOURCE : FALLBACK_SOURCE
}

/**
 * EVERY WAIT IS BOUNDED, because a hang is worse than a wrong typeface.
 *
 * `FontFace.load()` is not guaranteed to settle. A `local()` source that matches
 * nothing is the known offender in headless Chrome, and it is the NORMAL case on
 * both targets: this Windows host has none of the five faces above, and a slim
 * Linux container has no system fonts at all. An unsettled promise inside the
 * chain would hold the gate open until Remotion's own timer cancelled the render
 * — which is exactly the failure this whole file exists to prevent.
 *
 * Worst case here is 12s, comfortably inside Remotion's 28s budget
 * (`remotion_puppeteerTimeout` 30000 minus its own 2000 margin), so the gate is
 * always released by this file and never by Remotion's timeout.
 */
const PRIMARY_BUDGET_MS = 8_000
const FALLBACK_BUDGET_MS = 4_000

/**
 * One load per page, shared by every component that asks. Resolves — never
 * rejects — once the face is registered, the fallback is registered, or both
 * budgets have expired.
 */
let loadPromise: Promise<void> | null = null
let settled = false

function ensureDocumentaryFont(): Promise<void> {
  loadPromise ??= loadEverything().then(() => {
    settled = true
  })
  return loadPromise
}

/**
 * Hold the first frame until the typeface is really available.
 *
 * Call it from a composition component, not from module scope — see the block
 * comment above for what module scope costs.
 */
export function useDocumentaryFont(): void {
  useLayoutEffect(() => {
    // Already registered by an earlier mount in this page: nothing to wait for,
    // so do not open a gate at all.
    if (settled || typeof document === 'undefined') return

    const handle = delayRender(`loading ${FONT_FAMILY}`)
    let cleared = false
    const release = (): void => {
      // Idempotent: the unmount path and the settle path can both reach here.
      if (cleared) return
      cleared = true
      continueRender(handle)
    }

    void ensureDocumentaryFont().then(release, release)

    // Unmounting before the font settles must not leave the gate open either.
    return release
  }, [])
}

/** Never rejects. Every exit path leaves the render able to continue. */
async function loadEverything(): Promise<void> {
  if (typeof document === 'undefined') return

  try {
    await withBudget(Promise.all(FACES.map(loadFace)), PRIMARY_BUDGET_MS, FONT_FAMILY)
    return
  } catch (error) {
    console.warn(
      `${FONT_FAMILY} failed to load — see apps/web/public/fonts/README.md. ` +
        `Falling back to a generic sans stack; captions and text cards will be set ` +
        `in the wrong face but will not jitter. Cause: ${String(error)}`,
    )
  }

  try {
    await withBudget(loadFallback(), FALLBACK_BUDGET_MS, `${FONT_FAMILY} fallback`)
  } catch (error) {
    // Both budgets gone. The browser's own default still renders legible glyphs,
    // identically in every segment, which beats a cancelled render.
    console.warn(`no fallback face registered for ${FONT_FAMILY}: ${String(error)}`)
  }
}

/**
 * `Promise.race` against a timer, with the timer always cleared.
 *
 * The losing promise is left pending on purpose — `race` has already attached a
 * handler to it, so a late rejection cannot surface as an unhandled one.
 */
async function withBudget<T>(work: Promise<T>, budgetMs: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${what} did not settle within ${budgetMs}ms`)),
          budgetMs,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function loadFace(face: FaceSpec): Promise<void> {
  const loaded = await new FontFace(
    face.family,
    `url(${staticFile(face.file)}) format('woff2')`,
    { weight: face.weight, style: 'normal', display: 'block' },
  ).load()
  document.fonts.add(loaded)
}

async function loadFallback(): Promise<void> {
  try {
    await Promise.all(
      FACES.map(async (face) => {
        const loaded = await new FontFace(face.family, fallbackSourceFor(face.family), {
          weight: face.weight,
          style: 'normal',
          display: 'block',
        }).load()
        document.fonts.add(loaded)
      }),
    )
  } catch (error) {
    // Nothing local matched either. The browser's own default still renders
    // legible glyphs, which beats a cancelled render.
    console.warn(`no fallback face matched for ${FONT_FAMILY}: ${String(error)}`)
  }
}
