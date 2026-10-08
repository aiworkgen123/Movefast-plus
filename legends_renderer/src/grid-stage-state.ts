/** Measured on 1920x1080 Construction Legends frames: bowed (E14), navy (E38) and faint (E30) grids.
 * A vertical line passes through originX and a horizontal line through originY. The bowed grid is a pincushion:
 * vertical lines bend with ((y - 540) / 540)^2, horizontal lines with ((x - originX) / 960)^2 about originY. */
export type GridVariant = 'bowed' | 'navy' | 'faint';
export const gridSpec = {
  bowed: {cellX: 97.3, cellY: 98.2, originX: 961, originY: 479, stroke: 2.2, bendX: 0.021, bendY: 0.055},
  navy: {cellX: 72.5, cellY: 72.5, originX: 922.5, originY: 499, stroke: 1.6, bendX: 0, bendY: 0},
  faint: {cellX: 100, cellY: 100, originX: 910, originY: 490, stroke: 1.6, bendX: 0, bendY: 0},
} as const;
/** Line brightness falls to black toward the corners of the bowed grid (stop = elliptical distance / 1.32). */
export const bowedFadeStops = [[0.606, 1], [0.74, 0.78], [0.83, 0.4], [0.917, 0.1], [1, 0]] as const;

/** Positions are in 1920x1080 units; callers scale. */
export const bendPoint = (variant: GridVariant, x: number, y: number): [number, number] => {
  const g = gridSpec[variant], ny = (y - 540) / 540, nx = (x - g.originX) / 960;
  return [g.originX + (x - g.originX) * (1 + g.bendX * ny * ny), g.originY + (y - g.originY) * (1 + g.bendY * nx * nx)];
};

/** One SVG path (1920x1080 units) with every grid line; bent lines are sampled every 24 units. */
export const gridPath = (variant: GridVariant): string => {
  const g = gridSpec[variant], parts: string[] = [];
  const line = (points: [number, number][]) => parts.push(points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''));
  const positions = (origin: number, cell: number, size: number) => {
    const out: number[] = [];
    for (let v = origin - Math.ceil((origin + size * 0.1) / cell) * cell; v < size * 1.1; v += cell) out.push(v);
    return out;
  };
  const samples = (size: number) => Array.from({length: Math.ceil(size * 1.2 / 24) + 1}, (_, i) => -size * 0.1 + i * 24);
  for (const x of positions(g.originX, g.cellX, 1920)) line(samples(1080).map((y) => bendPoint(variant, x, y)));
  for (const y of positions(g.originY, g.cellY, 1080)) line(samples(1920).map((x) => bendPoint(variant, x, y)));
  return parts.join('');
};
