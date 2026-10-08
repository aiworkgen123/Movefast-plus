import {repairText} from './contract.ts';
import type {CameraStop} from './geo-state.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
import {repairStops} from './world-tour-map-contract.ts';
/** E44: an atlas map of one country; the parties involved pop in as a small pile of flags (up to six), the country fills red,
 * and a caption types itself at the lower left. Flags are supplied pictures. */
export type CountryFlagsMapProps = Readonly<{country: string; flags: readonly StaticImage[]; caption: string; captionAt: number; fillAt: number; stops: readonly CameraStop[]}>;
export const countryFlagsMapTextLimits = {caption: {minWords: 1, maxWords: 5, maxChars: 26}} as const;
export const countryFlagsMapDuration = {minSeconds: 2.5, maxSeconds: 12};
export const repairCountryFlagsMap = (input: unknown): CountryFlagsMapProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const caption = repairText(v.caption, countryFlagsMapTextLimits.caption), stops = repairStops(v.stops);
  if (!caption || !stops || typeof v.country !== 'string' || !/^[A-Z]{3}$/u.test(v.country) || !Array.isArray(v.flags) || v.flags.length < 1 || v.flags.length > 6) return null;
  if (typeof v.captionAt !== 'number' || !Number.isFinite(v.captionAt) || typeof v.fillAt !== 'number' || !Number.isFinite(v.fillAt)) return null;
  const flags = v.flags.map(repairStaticImage);
  return flags.every(Boolean) ? {country: v.country, flags: flags as StaticImage[], caption, captionAt: v.captionAt, fillAt: v.fillAt, stops} : null;
};
