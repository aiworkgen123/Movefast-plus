import {repairText} from './contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
/** E32: a cut-out object zooms in sharp on a grid inside a large dark circle; 1-2 measurements decode in (green figure)
 * over a torn white tag that types its label (first top-left, second bottom-right). */
export type Measurement = Readonly<{value: string; label: string}>;
export type MeasureRadarProps = Readonly<{object: StaticImage; measurements: readonly Measurement[]}>;
export const measureRadarTextLimits = {value: {minWords: 1, maxWords: 1, maxChars: 9}, label: {minWords: 1, maxWords: 4, maxChars: 22}} as const;
export const measureRadarDuration = {minSeconds: 2.5, maxSeconds: 10};
export const repairMeasureRadar = (input: unknown): MeasureRadarProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const object = repairStaticImage(v.object);
  if (!object || !Array.isArray(v.measurements) || v.measurements.length < 1 || v.measurements.length > 2) return null;
  const measurements = v.measurements.map((m) => {
    const r = m && typeof m === 'object' ? m as Record<string, unknown> : {};
    const value = repairText(r.value, measureRadarTextLimits.value), label = repairText(r.label, measureRadarTextLimits.label);
    return value && label ? {value, label} : null;
  });
  return measurements.every(Boolean) ? {object, measurements: measurements as Measurement[]} : null;
};
