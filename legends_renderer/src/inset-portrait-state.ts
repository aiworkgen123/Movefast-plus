
/** Measured on ESB 00:29.17 (1080p). Footage zoomed 107.5%, blurred 8 px, brightened 1.23x. Name Montserrat 800 75.6 px,
 * ink from (155, 483); role Montserrat 500 35 px, +0.074 em, ink from (153, 572); both fade in 0.45-0.9 s. Portrait frame
 * (1290, 219)-(1772, 861), 10 px blue border, cut-out inside; fades in 0.83-1.2 s. */
export const insetPortraitSpec = {
  footage: {scale: 1.075, blur: 8, brightness: 1.23},
  name: {size: 75.6, tracking: 0.003, left: 151, inkTop: 483, fade: [0.45, 0.9]},
  role: {size: 35, tracking: 0.074, left: 150, inkTop: 572, fade: [0.52, 0.9]},
  frame: {x: 1290, y: 219, width: 482, height: 642, border: 10, fade: [0.83, 1.2]},
} as const;
// Montserrat with line-height 1: cap ink 0.15 em, ascender ink 0.12 em below the box top (calibrated on stills).
export const capTop = 0.15, ascTop = 0.12;
