import {repairText} from './contract.ts';
import type {CameraStop} from './geo-state.ts';
/** E42: a flat world map that flies between camera stops; named countries light up red (where from) or blue (where to)
 * and a dark caption types itself at the lower left. Stops and highlight times follow the narration. */
export type TourHighlight = Readonly<{country: string; tone: 'red' | 'blue'; at: number}>;
export type WorldTourMapProps = Readonly<{caption: string; captionAt: number; stops: readonly CameraStop[]; highlights: readonly TourHighlight[]}>;
export const worldTourMapTextLimits = {caption: {minWords: 1, maxWords: 6, maxChars: 34}} as const;
export const worldTourMapDuration = {minSeconds: 2, maxSeconds: 15};
const finite = (...v: unknown[]) => v.every((x) => typeof x === 'number' && Number.isFinite(x));
export const repairStops = (input: unknown): CameraStop[] | null => {
  if (!Array.isArray(input) || input.length < 1 || input.length > 64) return null;
  const stops = input.map((s) => {
    const r = s && typeof s === 'object' ? s as Record<string, number> : {} as Record<string, number>;
    return finite(r.at, r.lon, r.lat, r.zoom) && r.zoom > 0 && Math.abs(r.lat) <= 85 && Math.abs(r.lon) <= 180 ? {at: r.at, lon: r.lon, lat: r.lat, zoom: r.zoom} : null;
  });
  if (!stops.every(Boolean)) return null;
  const sorted = (stops as CameraStop[]).slice().sort((a, b) => a.at - b.at);
  return sorted.every((s, i) => i === 0 || s.at > sorted[i - 1].at) ? sorted : null;
};
export const repairWorldTourMap = (input: unknown): WorldTourMapProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const caption = repairText(v.caption, worldTourMapTextLimits.caption), stops = repairStops(v.stops);
  if (!caption || !stops || !finite(v.captionAt) || !Array.isArray(v.highlights) || v.highlights.length < 1 || v.highlights.length > 8) return null;
  const highlights = v.highlights.map((h) => {
    const r = h && typeof h === 'object' ? h as Record<string, unknown> : {};
    return typeof r.country === 'string' && /^[A-Z]{3}$/u.test(r.country) && (r.tone === 'red' || r.tone === 'blue') && finite(r.at)
      ? {country: r.country, tone: r.tone, at: r.at as number} : null;
  });
  return highlights.every(Boolean) ? {caption, captionAt: v.captionAt as number, stops, highlights: highlights as TourHighlight[]} : null;
};
