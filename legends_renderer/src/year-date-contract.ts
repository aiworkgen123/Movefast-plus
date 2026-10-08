import {repairText} from './contract.ts';
export type YearDateProps = Readonly<{display: string; context?: string}>;
export const yearDateTextLimits = {display: {minWords: 1, maxWords: 4, maxChars: 32}, context: {minWords: 1, maxWords: 8, maxChars: 64}} as const;
export const yearDateDuration = {minSeconds: 2, maxSeconds: 6};
export const repairYearDate = (input: unknown): YearDateProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const display = repairText(value.display, yearDateTextLimits.display);
  if (!display) return null;
  const context = repairText(value.context, yearDateTextLimits.context);
  return {display, ...(context ? {context} : {})};
};
