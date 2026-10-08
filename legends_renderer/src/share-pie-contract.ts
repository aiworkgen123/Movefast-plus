import {repairText} from './contract.ts';
/** E39: a pie whose slices sweep open one after another, with a large light caption below and a small label above.
 * Shares are the script's numbers (any positive values; the pie shows each as its share of the total). */
export type SharePieProps = Readonly<{caption: string; label?: string; shares: readonly number[]}>;
export const sharePieTextLimits = {caption: {minWords: 1, maxWords: 5, maxChars: 26}, label: {minWords: 1, maxWords: 4, maxChars: 24}} as const;
export const sharePieDuration = {minSeconds: 3.5, maxSeconds: 12};
export const repairSharePie = (input: unknown): SharePieProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const caption = repairText(v.caption, sharePieTextLimits.caption), label = repairText(v.label, sharePieTextLimits.label);
  if (!caption || !Array.isArray(v.shares) || v.shares.length < 2 || v.shares.length > 5) return null;
  if (!v.shares.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) return null;
  return {caption, shares: v.shares as number[], ...(label ? {label} : {})};
};
