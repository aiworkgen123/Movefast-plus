/** Shared map maths for E42-E44: Natural Earth TopoJSON (public/geo, public domain) decoded to Mercator paths, and a camera
 * that eases through stops. Mercator units: x = longitude in radians, y = -ln(tan(pi/4 + lat/2)) (y grows downwards). */
export type Topology = Readonly<{transform: {scale: [number, number]; translate: [number, number]};
  objects: Record<string, {geometries: {type: string; id?: string; arcs: unknown}[]}>; arcs: [number, number][][]}>;
export type GeoShape = Readonly<{id?: string; path: string; bounds: [number, number, number, number]}>;

export const mercator = (lon: number, lat: number): [number, number] => {
  const phi = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return [(lon * Math.PI) / 180, -Math.log(Math.tan(Math.PI / 4 + phi / 2))];
};

/** Every geometry of one object as an SVG path in Mercator units (Antarctica is left out, as in the reference maps). */
export const decodeTopology = (topo: Topology, object: string): GeoShape[] => {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {x += dx; y += dy; return mercator(x * sx + tx, y * sy + ty);});
  });
  const ring = (ids: number[]) => ids.flatMap((i, k) => {
    const pts = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
    return k === 0 ? pts : pts.slice(1);
  });
  return topo.objects[object].geometries.filter((g) => g.id !== 'ATA').map((g) => {
    const polys = (g.type === 'Polygon' ? [g.arcs] : g.arcs) as number[][][];
    const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    const path = polys.map((poly) => poly.map((r) => ring(r).map(([x, y], k) => {
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
      return `${k ? 'L' : 'M'}${x.toFixed(5)} ${y.toFixed(5)}`;
    }).join('') + 'Z').join('')).join('');
    return {id: g.id, path, bounds: b};
  });
};

/** Land borders only (arcs shared by two countries; coastlines are not outlined in the references), one Mercator path. */
export const decodeBorders = (topo: Topology, object: string): string => {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate, uses = new Map<number, number>();
  const walk = (a: unknown): void => {if (typeof a === 'number') {const i = a >= 0 ? a : ~a; uses.set(i, (uses.get(i) ?? 0) + 1);} else if (Array.isArray(a)) a.forEach(walk);};
  topo.objects[object].geometries.forEach((g) => walk(g.arcs));
  return [...uses].filter(([, n]) => n > 1).map(([i]) => {
    let x = 0, y = 0;
    return topo.arcs[i].map(([dx, dy], k) => {x += dx; y += dy; const [px, py] = mercator(x * sx + tx, y * sy + ty); return `${k ? 'L' : 'M'}${px.toFixed(5)} ${py.toFixed(5)}`;}).join('');
  }).join('');
};

/** A camera stop: the point at the frame centre and the zoom (1 = the whole world 1920 px wide). */
export type CameraStop = Readonly<{at: number; lon: number; lat: number; zoom: number}>;
export type Camera = Readonly<{scale: number; x: number; y: number}>; // screen = scale * mercator + (x, y)

// Monotone cubic (Fritsch-Carlson): passes through every stop, never overshoots, eases where the motion turns.
const monotone = (xs: number[], ys: number[], t: number) => {
  const n = xs.length;
  if (n === 1 || t <= xs[0]) return ys[0];
  if (t >= xs[n - 1]) return ys[n - 1];
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {m[i] = 0; m[i + 1] = 0; continue;}
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i];}
  }
  let i = 0;
  while (t > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1];
};

export const cameraAt = (stops: readonly CameraStop[], t: number): Camera => {
  const xs = stops.map((s) => s.at), pts = stops.map((s) => mercator(s.lon, s.lat));
  const cx = monotone(xs, pts.map((p) => p[0]), t), cy = monotone(xs, pts.map((p) => p[1]), t);
  const scale = Math.exp(monotone(xs, stops.map((s) => Math.log(s.zoom)), t)) * (1920 / (2 * Math.PI));
  return {scale, x: 960 - scale * cx, y: 540 - scale * cy};
};

export const project = (camera: Camera, lon: number, lat: number): [number, number] => {
  const [x, y] = mercator(lon, lat);
  return [camera.scale * x + camera.x, camera.scale * y + camera.y];
};
