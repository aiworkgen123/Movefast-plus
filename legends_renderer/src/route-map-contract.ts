import {repairText} from './contract.ts';
import type {CameraStop} from './geo-state.ts';
import {repairStops} from './world-tour-map-contract.ts';
/** E43: a curved red route draws from one place to another across an atlas map, each end tagged with a dark label;
 * the camera follows from a close view of the start to a view of the whole journey. */
export type RoutePlace = Readonly<{lon: number; lat: number; label: string}>;
export type RouteMapProps = Readonly<{from: RoutePlace; to: RoutePlace; stops: readonly CameraStop[]}>;
export const routeMapTextLimits = {label: {minWords: 1, maxWords: 5, maxChars: 34}} as const;
export const routeMapDuration = {minSeconds: 3, maxSeconds: 14};
const place = (input: unknown): RoutePlace | null => {
  const r = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const label = repairText(r.label, routeMapTextLimits.label);
  return label && typeof r.lon === 'number' && typeof r.lat === 'number' && Math.abs(r.lon) <= 180 && Math.abs(r.lat) <= 85 ? {lon: r.lon, lat: r.lat, label} : null;
};
export const repairRouteMap = (input: unknown): RouteMapProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>, from = place(v.from), to = place(v.to), stops = repairStops(v.stops);
  return from && to && stops ? {from, to, stops} : null;
};
