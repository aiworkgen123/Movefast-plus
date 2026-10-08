
/** Measured on Diesel 06:00.73 (1080p). Payoff Montserrat 700 178 px, +0.061 em, white at 85%, centred, cap top y 624; letters rise
 * 26 px and fade in 0.06 s apart from 0.53 s (0.4 s each). Kicker Noto Serif Italic 55 px, white at 85%, line 1 ink 56 px left
 * of the payoff, line 2 21 px right of it, baselines 72 px apart (line 2 at y 550); both fade in 0.47-0.75 s while
 * drifting 60 px left (ease-out to 1.6 s). */
export const kickerPayoffSpec = {
  word: {size: 178, tracking: 0.061, capTop: 624, rise: 26, start: 0.53, stagger: 0.057, each: 0.4},
  kicker: {size: 55, line1: -39, line2: 40, baseline2: 550, pitch: 72, fade: [0.47, 0.75], drift: 60, driftEnd: 1.6},
  alpha: 0.85,
} as const;
