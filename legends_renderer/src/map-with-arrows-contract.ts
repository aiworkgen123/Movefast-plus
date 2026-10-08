import {repairText} from './contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
export type MapPoint = readonly [number, number];
export type MapGeometry = Readonly<{type: 'Polygon'; coordinates: readonly (readonly MapPoint[])[]}> | Readonly<{type: 'MultiPolygon'; coordinates: readonly (readonly (readonly MapPoint[])[])[]}>;
export type MapSource = Readonly<{kind: 'plate'; image: StaticImage}> | Readonly<{kind: 'geometry'; geometry: MapGeometry; bounds: Readonly<{west: number; south: number; east: number; north: number}>}>;
export type MapWithArrowsProps = Readonly<{title: string; map: MapSource; routes: readonly (readonly MapPoint[])[]}>;
export const mapWithArrowsTextLimits = {title: {minWords: 1, maxWords: 8, maxChars: 64}} as const;
export const mapWithArrowsDuration = {minSeconds: 3, maxSeconds: 10};
export const repairMapWithArrows = (input: unknown): MapWithArrowsProps | null => {
 if (!input || typeof input !== 'object') return null;
 const v = input as Record<string, any>, title = repairText(v.title, mapWithArrowsTextLimits.title);
 if (!title || !v.map || typeof v.map !== 'object') return null;
 let map: MapSource; let limits = [0, 0, 1, 1];
 if (v.map.kind === 'plate') {const image = repairStaticImage(v.map.image); if (!image) return null; map = {kind: 'plate', image};}
 else if (v.map.kind === 'geometry') {
  const b = v.map.bounds, g = v.map.geometry;
  if (!b || ![b.west,b.south,b.east,b.north].every(Number.isFinite) || b.west < -180 || b.east > 180 || b.south < -85 || b.north > 85 || b.west >= b.east || b.south >= b.north || !g || !['Polygon','MultiPolygon'].includes(g.type)) return null;
  limits = [b.west,b.south,b.east,b.north];
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  if (!Array.isArray(polys) || polys.length < 1 || polys.length > 12) return null;
  let total = 0;
  for (const poly of polys) {
   if (!Array.isArray(poly) || poly.length < 1 || poly.length > 8) return null;
   for (const ring of poly) {
    if (!Array.isArray(ring) || ring.length < 4 || ring.length > 128 || !ring.every((p: unknown) => point(p, limits))) return null;
    total += ring.length; if (total > 1024 || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return null;
    const area = ring.slice(1).reduce((sum: number,p: MapPoint,i: number) => sum + ring[i][0]*p[1]-p[0]*ring[i][1],0);
    if (Math.abs(area) < 1e-10) return null;
   }
  }
  map = {kind: 'geometry', geometry: structuredClone(g), bounds: {...b}};
 } else return null;
 if (!Array.isArray(v.routes) || v.routes.length < 1 || v.routes.length > 6) return null;
 for (const route of v.routes) {
  if (!Array.isArray(route) || route.length < 2 || route.length > 32 || !route.every(p => point(p,limits)) || route.slice(1).some((p,i) => p[0] === route[i][0] && p[1] === route[i][1])) return null;
 }
 return {title,map,routes: structuredClone(v.routes)};
};
const point = (p: unknown, b: number[]): boolean => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
