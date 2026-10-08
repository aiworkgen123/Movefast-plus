import {repairText} from './contract.ts';
/** E38: one percentage in an outlined column; number and fill count up together. */
export type PercentGaugeProps = Readonly<{title: string; value: number; precision: 0 | 1; caption?: string}>;
export const percentGaugeTextLimits = {title: {minWords: 1, maxWords: 5, maxChars: 32}, caption: {minWords: 1, maxWords: 8, maxChars: 56}} as const;
export const percentGaugeDuration = {minSeconds: 3, maxSeconds: 10};
export const repairPercentGauge = (input: unknown): PercentGaugeProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const title = repairText(v.title, percentGaugeTextLimits.title);
  if (!title || typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0 || v.value > 100) return null;
  if (v.precision !== 0 && v.precision !== 1) return null;
  const caption = repairText(v.caption, percentGaugeTextLimits.caption);
  return {title, value: v.value, precision: v.precision, ...(caption ? {caption} : {})};
};
