import { easeOut } from '../constants.js'

/**
 * The framed card's clock and geometry, as pure functions of one integer.
 *
 * ####################################################################
 * # THIS MODULE MUST NEVER IMPORT `remotion`.                         #
 * #                                                                   #
 * # It is tested by `framedCard.test.ts`, which the `.test.ts` lane   #
 * # collects, and that lane runs under `--conditions react-server`.   #
 * # A `remotion` import there dies at the import line with a React    #
 * # Server Components error that reads nothing like the real cause.   #
 * # `../constants.js` is safe and was checked — it imports only       #
 * # `@vg/core`, never `remotion`.                                     #
 * #                                                                   #
 * # The split also buys the only real testing there is. jsdom         #
 * # computes NO layout, so the mount test can assert that the right   #
 * # declarations exist and nothing about where anything lands. Every  #
 * # number below is only checkable here.                              #
 * ####################################################################
 *
 * WHAT THIS IS. The device the client sent as his sixth reference animation, at
 * 0:28 of `Templates (Unseperated).mp4`. A window opens sideways and downward
 * over a photograph, and a caption wipes in underneath it.
 *
 * ####################################################################
 * # THE PICTURE INSIDE THE WINDOW NEVER SCALES, AND THAT IS THE WHOLE #
 * # DEVICE. Getting this wrong is the single easiest mistake here and #
 * # it produces something that looks superficially similar and reads  #
 * # completely differently.                                           #
 * #                                                                   #
 * # Measured off the reference: the image is a pure translation of    #
 * # dy = 688 across the open, with NO scale term. So the window is a  #
 * # moving aperture over a picture pinned at a fixed size, and it     #
 * # reads as curtains opening. An `objectFit` on the animating box    #
 * # would scale the picture with the window and read as a zoom, which #
 * # is a move this film already makes 112 times.                      #
 * #                                                                   #
 * # THE CLIENT HIMSELF GOT THIS WRONG in his own note, which said the #
 * # image "eventually get big". It does not. Building it correctly is #
 * # what makes the clip worth sending.                                #
 * ####################################################################
 *
 * The numbers are measurements, not choices. They came off his frames and they
 * are pinned by a table in the test file. If a change moves one of them, the
 * change is wrong.
 */
export const FRAMED_CARD = {
  /**
   * All motion is over in 25 frames, 0.83s.
   *
   * The scene is far longer than this on purpose. The client's note calls this
   * animation 1.5 seconds; it is 0.83s of movement followed by a long dead
   * hold, and the hold is what makes it read as a documentary cut rather than a
   * template. Do not shorten the scene to fit the motion.
   */
  openFrames: 25,

  /**
   * Width and top edge share ONE driver. They are not two animations that
   * happen to line up — the reference proves a single eased progress behind
   * both, which is why the component makes one `interpolate` call and derives
   * the second value from it.
   */
  window: {
    /** Constant for every frame. The window opens sideways and down, never taller. */
    height: 727,
    widthFrom: 223,
    widthTo: 1130,
    topFrom: -559,
    topTo: 130,
  },

  /**
   * The caption starts at frame 14, while the window is still opening.
   *
   * That overlap is measured and it is load-bearing. A caption that waits for
   * the window to settle reads noticeably slower, and the test pins the
   * relationship so a later tidy-up cannot quietly serialise them.
   */
  caption: {
    startFrame: 14,
    frames: 7,
  },
} as const

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * The aperture at a given frame.
 *
 * `easeOut` is imported rather than restated. The reference's own progress —
 * 0, 0.467, 0.759, 0.919, 0.985, 1.0 — sits inside the 6fps sampling error of
 * `1 - (1 - t)^3`, so this device needs no new curve and must not introduce
 * one. `constants.ts` carries a box explaining why those curves were hoisted
 * into one place; adding a fourth near-identical easing is exactly the drift it
 * was written to stop.
 */
export function framedCardWindow(frame: number): {
  width: number
  top: number
  height: number
} {
  const { openFrames, window } = FRAMED_CARD
  const t = easeOut(clamp01(frame / openFrames))

  return {
    width: lerp(window.widthFrom, window.widthTo, t),
    top: lerp(window.topFrom, window.topTo, t),
    height: window.height,
  }
}

/**
 * How much of the caption is drawn, 0 to 1, left to right.
 *
 * LINEAR AND HARD-EDGED, both deliberate. The reference slices letters through
 * the middle, which is a clip travelling across finished type — not a
 * per-character opacity ramp. `Overlay.tsx`'s `Note` is the latter and carries
 * its own box arguing the two are different devices. Do not route this through
 * it.
 */
export function framedCardCaptionReveal(frame: number): number {
  const { startFrame, frames } = FRAMED_CARD.caption
  return clamp01((frame - startFrame) / frames)
}
