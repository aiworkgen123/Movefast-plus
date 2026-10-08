/**
 * a5, the person name card: timing, measured off the client's own frames.
 *
 * Pure. No remotion import, the same shape as `photoPopClock.ts`.
 *
 * ####################################################################
 * # PROVENANCE. Measured on tmp/anim/a5-30, his own                   #
 * # `Templates (Unseperated).mp4` re-extracted at 1920x1080 and the   #
 * # true 30fps. a5 owns SOURCE FRAMES 656..805, so local frame f here #
 * # is source frame 656 + f.                                          #
 * #                                                                   #
 * # FIVE INDEPENDENT CLOCKS, AND NOT ONE OF THEM IS SHARED WITH       #
 * # ANOTHER ANIMATION IN THIS FOLDER. That is the headline: a5 looks  #
 * # simple and every curve in it is its own.                          #
 * ####################################################################
 */

/** a5 is 150 frames at 30fps, so the last frame index is 149. */
export const NAME_CARD_LAST_FRAME = 149

/**
 * A cubic-bezier easing, solved rather than approximated.
 *
 * Two of a5's five clocks are beziers that beat every named CSS curve by a
 * wide margin, so an "close enough" ease would be a visible error rather than
 * a rounding one. Newton-Raphson on x, falling back to bisection when the
 * derivative is flat, which is what a browser's own implementation does.
 */
export function cubicBezierEase(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  const curveX = (t: number): number => {
    const u = 1 - t
    return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t
  }
  const curveY = (t: number): number => {
    const u = 1 - t
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t
  }
  const slopeX = (t: number): number => {
    const u = 1 - t
    return 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2)
  }

  let t = x
  for (let i = 0; i < 8; i += 1) {
    const error = curveX(t) - x
    if (Math.abs(error) < 1e-7) return curveY(t)
    const slope = slopeX(t)
    if (Math.abs(slope) < 1e-7) break
    t -= error / slope
  }

  let low = 0
  let high = 1
  t = x
  for (let i = 0; i < 40; i += 1) {
    const value = curveX(t)
    if (Math.abs(value - x) < 1e-7) break
    if (value > x) high = t
    else low = t
    t = (low + high) / 2
  }
  return curveY(t)
}

/**
 * The portrait card at rest, in frame pixels.
 *
 * Corner radius 8 rather than 10: a circle of radius 8 predicts the measured
 * sub-pixel left edge down the corner to within 0.16px rms, and 7 and 9 are
 * both rejected by more than a pixel on the first row. There is NO border.
 *
 * ####################################################################
 * # EVERY EDGE IS INTEGER-SNAPPED, WITH ZERO PARTIAL COVERAGE.       #
 * #                                                                   #
 * # A first pass read 734.78 for the bottom by sampling one column    #
 * # where the card's own dark content sits on the steep near-edge     #
 * # shadow gradient, and took that gradient for partial coverage. A   #
 * # coverage test across 440 rows puts all four edges exactly on      #
 * # integers. Do not let a layout engine land this on a half pixel.   #
 * ####################################################################
 */
export const NAME_CARD_CARD = {
  left: 664,
  width: 593,
  restTop: 65,
  height: 670,
  cornerRadiusPx: 8,
} as const

/**
 * The drop shadow, from a joint fit across all four sides.
 *
 * It travels with the card AND fades with the card, proven by finding the same
 * decay profile 79px lower once the card has landed, and by its edge alpha
 * being 0.13 of settled on the frame where the card's own opacity is 0.113.
 *
 * The offset is what makes it directional: a shadow with no offset would read
 * A/2 on all four sides, and the measured edges are 0.365 left, 0.421 right,
 * 0.338 top, 0.401 bottom. Pinning the x offset to zero triples the fit error.
 *
 * ####################################################################
 * # THE PARAMETERS ARE DEGENERATE. BUILD TO THE PROFILE, NOT TO THEM. #
 * #                                                                   #
 * # Peak alpha, sigma and spread trade off against one another, and   #
 * # two independent fits landed on (0.850, 28.25, -1.7) and (0.803,   #
 * # 26.99, +0.02) while reproducing the SAME measured edge alphas to  #
 * # 0.006. Both render the same shadow. What is actually pinned is    #
 * # the decay profile, which reaches ~0.001 by 70px out.              #
 * #                                                                   #
 * # It extends about 70px past every edge, so nothing above it in the #
 * # tree may clip or set overflow hidden.                             #
 * ####################################################################
 */
export const NAME_CARD_SHADOW = {
  peakAlpha: 0.8,
  /** A CSS blur radius is about twice the Gaussian sigma. */
  sigmaPx: 27,
  offsetXPx: 4,
  offsetYPx: 4,
  spreadPx: 0,
} as const

/**
 * ####################################################################
 * # THE SLIDE IS CONSTANT VELOCITY WITH A HARD STOP, AND THIS IS THE  #
 * # MOST LIKELY THING FOR A BUILDER TO GET WRONG.                     #
 * #                                                                   #
 * # His note says the card "slowly goes at the center", which reads   #
 * # as a decelerating arrival. It is not. Two independent fits give   #
 * # 19.7311 and 19.7276 px/frame — 0.13px apart over the whole move — #
 * # the last step before it lands is the same size as every other,    #
 * # and the next 111 frames are exactly zero. A free quadratic term   #
 * # comes out at 0.0004 px/frame^2, so the velocity changes by 0.03   #
 * # px/frame across all 38 frames. No overshoot, no settle, no bounce.#
 * #                                                                   #
 * # DO NOT REACH FOR `photoPopClock.ts`'s SPRING. That device is a4   #
 * # and a9's, and it is the wrong one here.                           #
 * ####################################################################
 */
export const NAME_CARD_SLIDE = {
  pxPerFrame: 19.7311,
  /** Local frame the card lands on and stops dead. */
  landsAtFrame: 38,
} as const

/** How far above its rest position the card sits, at a local frame. */
export function nameCardSlideOffset(frame: number): number {
  const remaining = NAME_CARD_SLIDE.landsAtFrame - frame
  if (remaining <= 0) return 0
  return remaining * NAME_CARD_SLIDE.pxPerFrame
}

/**
 * The card's opacity — and it finishes 19 frames BEFORE the slide does.
 *
 * Two different durations on one object, 19 frames of fade against 38 of
 * travel. Driving both from one progress value makes the card either arrive
 * translucent or stop moving while it is still fading, and it is the single
 * likeliest build mistake in this animation.
 *
 * The curve is cubic-bezier(0.33, 0, 0.67, 1), the After Effects easy-ease
 * shape, at 0.0021-0.0024 rms in alpha against 0.015 for linear.
 *
 * A first pass claimed it beats every rival by 1.6x. It does not: smoothstep
 * TIES it at 0.0021 on the same frames. The chosen curve is right and the
 * margin over its nearest rival was overstated, which is worth writing down
 * rather than leaving as a number nobody can reproduce.
 */
export const NAME_CARD_FADE = { startFrame: 0, durationFrames: 19 } as const

export function nameCardOpacity(frame: number): number {
  const progress = (frame - NAME_CARD_FADE.startFrame) / NAME_CARD_FADE.durationFrames
  return cubicBezierEase(0.33, 0, 0.67, 1, progress)
}

/**
 * The scrim — a flat BLACK MULTIPLY over the backdrop only.
 *
 * Not a blur, not a gradient, not a vignette, not a colour grade. Fitted per
 * frame as `ref(f) = k(f) * ref(0) + c`, the additive term stays within 0.33 of
 * zero at every frame, and the left and right strips agree to 0.0005.
 *
 * ####################################################################
 * # THE FIRST 0.9 SECONDS ARE THE PHOTOGRAPH AT FULL BRIGHTNESS.      #
 * # Authoring this as a static 0.6 overlay makes the opening 27       #
 * # frames read completely differently from his reference.            #
 * ####################################################################
 */
export const NAME_CARD_SCRIM = { alpha: 0.6002, durationFrames: 27 } as const

export function nameCardScrimAlpha(frame: number): number {
  const progress = frame / NAME_CARD_SCRIM.durationFrames
  return NAME_CARD_SCRIM.alpha * cubicBezierEase(0.18, 0, 0.65, 1, progress)
}

/**
 * The two type lines. Fixed layout, per-character opacity, nothing else.
 *
 * Each string is LAID OUT ONCE and never moves: every glyph's column range is
 * identical on every frame it is visible. Within one glyph the alpha is flat to
 * 0.005 across its whole width and steps down at the glyph boundary, so it is
 * per-character opacity rather than a wipe or a gradient mask.
 *
 * ####################################################################
 * # THE SPACES CONSUME STAGGER SLOTS, ON BOTH LINES.                  #
 * #                                                                   #
 * # "ELON MUSK" has NINE slots, not eight. The N-to-M advance spans   #
 * # the space, and on the role line the O-to-o gap across a space is  #
 * # 6.0 frames for 4 characters against 3.0 frames for 2 within a     #
 * # word. Skipping the space pulls every later character forward and  #
 * # the second word lands early.                                      #
 * ####################################################################
 */
/*
 * ####################################################################
 * # THE BASELINES CARRY A HALF-PIXEL CONVENTION SHIFT.               #
 * #                                                                   #
 * # The first measurement put pixel CENTRES on integers; these are    #
 * # CSS pixels, where pixel i spans [i, i+1) and the frame centre is  #
 * # (960, 540). Every convention-free number — widths, heights, cap   #
 * # heights, durations — agrees between the two. Only absolute        #
 * # positions move, and they move by exactly 0.5px.                    #
 * #                                                                   #
 * # The card's four edges land on integers in THIS convention, which  #
 * # is itself evidence that it is the one the author worked in.       #
 * ####################################################################
 */
export const NAME_CARD_TYPE = {
  name: {
    startFrame: -0.1,
    staggerFrames: 2.0,
    fadeFrames: 12.2,
    capHeightPx: 71.636,
    baselinePx: 867.04,
    /*
      ROUND NUMBERS, WHICH IS THE TELL. Once the face was identified as Noto
      Sans the two sizes fell out as exactly 100 and 40 with a 2.500 ratio, and
      solving for size freely preferred 100.10 with no improvement in error.
      Those are numbers a person typed, so they are authored rather than derived.
    */
    fontSizePx: 100,
    letterSpacingEm: 0.02,
  },
  role: {
    startFrame: 10.85,
    staggerFrames: 1.5,
    fadeFrames: 10.65,
    capHeightPx: 28.662,
    baselinePx: 930.02,
    fontSizePx: 40,
    /*
      DOUBLE THE NAME LINE'S, and an earlier pass budgeted 0.02em for both.
      Building the role line at 0.02em puts glyphs up to 8.4px out of position.
    */
    letterSpacingEm: 0.04,
  },
  colour: '#FFFFFF',
} as const

/** A character's opacity on one of the two lines, at a local frame. */
export function nameCardGlyphOpacity(
  line: 'name' | 'role',
  frame: number,
  index: number,
): number {
  const { startFrame, staggerFrames, fadeFrames } = NAME_CARD_TYPE[line]
  const progress = (frame - (startFrame + staggerFrames * index)) / fadeFrames
  return cubicBezierEase(0.33, 0, 0.67, 1, progress)
}
