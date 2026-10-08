import {progress} from './motion.ts';
/** Measured on WTC 10:37.27 (1080p). Stage #080808 with a soft vignette. Card 481x321 at (719, 379), 2.5 px red #DF0E39
 * border, radius 4; it drifts in perspective to (738, 385) (1213, 385) (1215, 718) (712, 692) over 4.6 s. Leaders 4 px red,
 * drawn from the card outward in 0.47 s, starting 0.2 s and 0.65 s apart; each chip fades in 0.2 s after its leader.
 * Chips #101010, 300 px wide, padding 23 px top / 17 px sides; labels Open Sans 700 27.5 px, line pitch 34, white with a
 * red glow; the bottom chip's text is centred. */
export const evidenceLeadersSpec = {
  card: {x: 719, y: 379, width: 481, height: 321, border: 2.5, radius: 4, drift: 4.6},
  end: [[738, 385], [1213, 385], [1215, 718], [712, 692]] as const,
  chip: {width: 300, padTop: 23, padX: 17, size: 27.5, pitch: 34, padBottom: 30},
  leaders: {start: 0.2, stagger: 0.65, draw: 0.47, chipDelay: 0.1, chipFade: 0.2, width: 4},
  // Per slot: leader polyline (from the card outward) and chip anchor. Top chips sit on y 294; the bottom chip hangs from y 806.
  slots: [
    {path: [[721, 356], [640, 296], [498, 296]], chip: {left: 500, bottom: 294}, align: 'left'},
    {path: [[1198, 354], [1280, 294], [1420, 294]], chip: {left: 1420, bottom: 294}, align: 'left'},
    {path: [[960, 712], [960, 795], [937, 805]], chip: {left: 690, top: 806}, align: 'center'},
  ],
} as const;
export const evidenceLeadersTimes = (i: number) => {
  const k = evidenceLeadersSpec.leaders, start = k.start + i * k.stagger;
  return {start, end: start + k.draw, chip: start + k.draw + k.chipDelay};
};
export const leaderProgress = (t: number, i: number) => {
  const w = evidenceLeadersTimes(i);
  return {line: progress(t, w.start, w.end, 'out-cubic'), chip: progress(t, w.chip, w.chip + evidenceLeadersSpec.leaders.chipFade, 'out-cubic')};
};
/** CSS matrix3d mapping the unit square to a quadrilateral (homography), for the card's perspective drift. */
export const quadMatrix = (w: number, h: number, q: readonly (readonly [number, number])[]) => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  // Unit square → quad; scale the element's own w×h down to the unit square first.
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
};
export const cardQuad = (t: number): [number, number][] => {
  const k = evidenceLeadersSpec, c = k.card, p = Math.min(1, Math.max(0, t / c.drift));
  const start = [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]];
  return start.map(([x, y], i) => [x + (k.end[i][0] - x) * p, y + (k.end[i][1] - y) * p]);
};
