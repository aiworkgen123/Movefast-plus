import { Easing } from 'remotion'

/**
 * `date-stamp`, the owner's date overlay of 2026-10-11: a big serif month
 * ("February") over a smaller year ("1994"), right-aligned at the top right of
 * the shot, rising 60 px into place as it fades in, then holding until the shot
 * cuts away.
 *
 * EVERY NUMBER HERE IS MEASURED OFF HIS REFERENCE (ref.mp4, frames 278-400, a
 * 1920x1080 30 fps clip), except the three marked OURS. The measurement notes
 * and per-frame fits live with the job that measured them
 * (verify/mapdate/measure_date/spec.json); this file is the one place the
 * component and any future width gate read them from.
 *
 *   faces     line 1 DM Serif Display Regular 130 px, line 2 Libre Baskerville
 *             Regular 65 px (exactly half). Both #FFFFFF, letter-spacing 0,
 *             default kerning. Two different families, matched glyph by glyph
 *             (IoU 0.939 and 0.925 against <=0.906 for every runner-up).
 *   place     both lines right-aligned to the ADVANCE box edge x = 1840 (80 px
 *             margin); baselines y = 190.1 and 269.0. The 'y' descender of the
 *             month touches the year's second '9' in his frame; kept.
 *   ground    NO plate, band or vignette. A black drop shadow (0.85, offset
 *             +2.06/+4.04 px, Gaussian sigma 4.33) under a white glow (0.615,
 *             sigma 4.55), the same absolute values on both lines.
 *   entrance  45 frames from the shot's first frame: group opacity = p and
 *             translateY = 60 * (1 - p) px, p = cubic-bezier(.345,.085,.375,.875)
 *             of frame / 45. Both lines as one block; no scale, blur, stagger or
 *             wipe. His Y offset lands on whole pixels every frame, so ours does.
 *   exit      none. The type leaves with the shot on a hard cut.
 *   sound     none (his overlay window is digital silence).
 *
 * All lengths are for a 1080-high frame; the component scales them by
 * height / 1080.
 */
export const DATE_STAMP = {
  /** The advance-box right edge both lines share (1920 - 80). */
  rightEdgePx: 1840,
  date: {
    fontSizePx: 130,
    baselinePx: 190.1,
    /** hhea ascender/descender in 1/1000 em: where the baseline sits in a line box of line-height = size. */
    ascent: 1036,
    descent: 335,
  },
  year: {
    fontSizePx: 65,
    baselinePx: 269.0,
    ascent: 970,
    descent: 270,
  },
  colour: '#FFFFFF',
  shadow: { colour: '#000000', opacity: 0.85, offsetXPx: 2.06, offsetYPx: 4.04, sigmaPx: 4.33 },
  glow: { colour: '#FFFFFF', opacity: 0.615, sigmaPx: 4.55 },
  entrance: { frames: 45, risePx: 60, bezier: [0.345, 0.085, 0.375, 0.875] as const },
  /**
   * OURS: the widest either line may be before it is set smaller. His one sample
   * ("February", 530 px) says nothing about a long line; 880 px keeps the block
   * in the right half of the frame (left edge never left of x = 960), and every
   * month name fits at full size (September, the widest, is 632 px).
   */
  maxWidthPx: 880,
  /** OURS: the smallest the month line is set before the fit refuses it. */
  minDateFontSizePx: 96,
  /** OURS: the same floor for the year line, half of the month's. */
  minYearFontSizePx: 48,
} as const

/** The frame (scene-relative) the block is fully in: `buildEndFrames` in the registry. */
export const DATE_STAMP_BUILD_END_FRAMES = DATE_STAMP.entrance.frames

const ease = Easing.bezier(...DATE_STAMP.entrance.bezier)

/** Entrance progress 0..1 at a scene-relative frame. 0 on the shot's first frame (nothing visible yet). */
export function dateStampProgress(frame: number): number {
  const t = Math.min(1, Math.max(0, frame / DATE_STAMP.entrance.frames))
  if (t <= 0) return 0
  if (t >= 1) return 1
  return Math.min(1, Math.max(0, ease(t)))
}

/** How far below its final place the block sits, in 1080p pixels, snapped to whole pixels as in his frames. */
export function dateStampRisePx(progress: number): number {
  return Math.round(DATE_STAMP.entrance.risePx * (1 - progress))
}

/** Where a line's box top goes so its baseline lands on `baselinePx`, for a line box of line-height = font size. */
export function dateStampLineTopPx(
  baselinePx: number,
  fontSizePx: number,
  metrics: { readonly ascent: number; readonly descent: number },
): number {
  return baselinePx - fontSizePx * (0.5 + (metrics.ascent - metrics.descent) / 2000)
}

/*
 * ADVANCE WIDTHS, 1/1000 em, of the printable Latin-1 range plus dashes, curly
 * quotes and the ellipsis, read from the shipped TTFs (public/fonts). Kerning is
 * LEFT OUT on purpose: it only ever tightens these two faces' runs here (by at
 * most 1.5% on the twelve month names), so a width from this table is never
 * smaller than the drawn one and a line it passes cannot overrun. A character
 * missing from the table counts as a full em, for the same reason.
 */
const DATE_CHARS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~" +
  ' ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿' +
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß' +
  'àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ' +
  '–—‘’“”…'

/** DM Serif Display, aligned to DATE_CHARS. */
const DATE_ADVANCES: readonly number[] = [
  218, 333, 425, 557, 532, 871, 721, 223, 368, 368, 433, 541, 300, 332, 300, 342, 502, 350, 532, 532, 538,
  532, 530, 489, 502, 532, 300, 300, 541, 541, 541, 506, 877, 650, 598, 603, 648, 555, 538, 656, 691, 301,
  427, 654, 540, 791, 653, 670, 565, 670, 628, 521, 627, 649, 632, 921, 614, 590, 560, 342, 336, 342, 541,
  532, 400, 518, 581, 494, 574, 507, 343, 531, 580, 280, 281, 582, 286, 871, 578, 545, 578, 565, 441, 436,
  361, 567, 530, 781, 568, 536, 465, 338, 267, 338, 541, 218, 333, 532, 532, 534, 532, 267, 522, 400, 747,
  354, 536, 541, 332, 467, 400, 328, 541, 345, 344, 400, 584, 611, 300, 400, 242, 379, 536, 698, 789, 776,
  506, 650, 650, 650, 650, 650, 650, 898, 603, 555, 555, 555, 555, 301, 301, 301, 301, 648, 653, 670, 670,
  670, 670, 670, 541, 670, 649, 649, 649, 649, 590, 577, 644, 518, 518, 518, 518, 518, 518, 785, 494, 507,
  507, 507, 507, 280, 280, 280, 280, 552, 578, 545, 545, 545, 545, 545, 541, 561, 567, 567, 567, 567, 536,
  580, 536, 532, 832, 215, 215, 426, 426, 900,
]

/** Libre Baskerville, aligned to DATE_CHARS (it has no soft hyphen: a full em). */
const YEAR_ADVANCES: readonly number[] = [
  287, 308, 367, 666, 622, 671, 878, 215, 332, 332, 516, 550, 273, 463, 265, 460, 714, 446, 616, 616, 585,
  568, 643, 502, 606, 643, 285, 311, 581, 620, 581, 399, 1029, 772, 767, 802, 884, 726, 670, 870, 925, 415,
  394, 779, 727, 1090, 902, 946, 687, 948, 788, 645, 803, 861, 784, 1176, 818, 733, 770, 371, 460, 371, 480,
  722, 275, 554, 654, 536, 675, 573, 412, 599, 688, 341, 304, 616, 325, 1073, 689, 654, 679, 653, 477, 454,
  378, 670, 610, 852, 609, 639, 557, 335, 290, 335, 553, 287, 308, 555, 680, 613, 802, 298, 566, 323, 888,
  378, 489, 625, 1000, 888, 310, 346, 634, 285, 279, 275, 721, 631, 285, 232, 246, 383, 489, 669, 675, 671,
  399, 772, 772, 772, 772, 772, 772, 1051, 802, 726, 726, 726, 726, 415, 415, 415, 415, 882, 902, 946, 946,
  946, 946, 946, 519, 946, 861, 861, 861, 861, 733, 699, 683, 554, 554, 554, 554, 554, 554, 852, 536, 573,
  573, 573, 573, 341, 341, 341, 341, 640, 689, 654, 654, 654, 654, 654, 599, 654, 670, 670, 670, 670, 639,
  654, 639, 724, 1112, 257, 254, 449, 446, 697,
]

function advanceEm(text: string, table: readonly number[]): number {
  let units = 0
  for (const character of text) {
    const index = DATE_CHARS.indexOf(character)
    units += index >= 0 ? (table[index] ?? 1000) : 1000
  }
  return units / 1000
}

/** The month line's width at `fontSizePx`, kerning left out (never narrower than drawn). */
export function dateStampDateWidthPx(text: string, fontSizePx: number = DATE_STAMP.date.fontSizePx): number {
  return advanceEm(text, DATE_ADVANCES) * fontSizePx
}

/** The year line's width at `fontSizePx`, kerning left out. */
export function dateStampYearWidthPx(text: string, fontSizePx: number = DATE_STAMP.year.fontSizePx): number {
  return advanceEm(text, YEAR_ADVANCES) * fontSizePx
}

/**
 * THE AUTO-SIZE RULE (OURS; his one sample never needed it). A line is set at
 * his size when it fits `maxWidthPx`, else scaled down until it does, never
 * below the floor. Shrinking keeps the right edge and the baseline where his
 * were, so the line grows leftward and the year below does not move. The two
 * lines size independently: a long month does not shrink the year.
 */
function fittedSize(widthAtFull: number, full: number, floor: number): number {
  if (widthAtFull <= DATE_STAMP.maxWidthPx) return full
  return Math.max(floor, Math.floor((full * DATE_STAMP.maxWidthPx * 10) / widthAtFull) / 10)
}

export function dateStampDateFontSizePx(text: string): number {
  const { fontSizePx } = DATE_STAMP.date
  return fittedSize(dateStampDateWidthPx(text), fontSizePx, DATE_STAMP.minDateFontSizePx)
}

export function dateStampYearFontSizePx(text: string): number {
  const { fontSizePx } = DATE_STAMP.year
  return fittedSize(dateStampYearWidthPx(text), fontSizePx, DATE_STAMP.minYearFontSizePx)
}

/**
 * Does this pair draw inside the measure? False when a line would still be
 * wider than `maxWidthPx` at its floor size; the component then draws it at the
 * floor and lets it run left, so a planner must ask this first.
 */
export function dateStampFits(date: string, year: string): boolean {
  const d = dateStampDateFontSizePx(date)
  const y = dateStampYearFontSizePx(year)
  return (
    date.trim().length > 0 &&
    dateStampDateWidthPx(date, d) <= DATE_STAMP.maxWidthPx &&
    dateStampYearWidthPx(year, y) <= DATE_STAMP.maxWidthPx
  )
}
