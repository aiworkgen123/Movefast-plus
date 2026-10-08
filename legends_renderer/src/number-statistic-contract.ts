import {repairText} from './contract.ts';
export type NumberStatisticProps = Readonly<{value: number; precision: 0 | 1 | 2; label: string; source?: string}>;
export const statisticTextLimits = {label: {minWords: 1, maxWords: 8, maxChars: 64}, source: {minWords: 1, maxWords: 8, maxChars: 80}} as const;
export const statisticDuration = {minSeconds: 3, maxSeconds: 8};
export const repairNumberStatistic = (input: unknown): NumberStatisticProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.value !== 'number' || !Number.isFinite(value.value) ||
    (value.precision !== 0 && value.precision !== 1 && value.precision !== 2)) return null;
  const label = repairText(value.label, statisticTextLimits.label);
  if (!label) return null;
  const source = repairText(value.source, statisticTextLimits.source);
  return {value: value.value, precision: value.precision, label, ...(source ? {source} : {})};
};
