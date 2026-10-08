import {repairText} from './contract.ts';
/** E37: a thin white line climbs through labelled amber points on a dotted grid (a running total, a race to a number). */
export type PlotPoint = Readonly<{label: string; value: number}>;
export type LinePlotProps = Readonly<{title: string; points: readonly PlotPoint[]; xTitle?: string; yTitle?: string; max?: number; tickStep?: number}>;
export const linePlotTextLimits = {title: {minWords: 1, maxWords: 6, maxChars: 40}, label: {minWords: 1, maxWords: 2, maxChars: 10},
  xTitle: {minWords: 1, maxWords: 4, maxChars: 30}, yTitle: {minWords: 1, maxWords: 3, maxChars: 24}} as const;
export const linePlotDuration = {minSeconds: 4, maxSeconds: 12};
export const repairLinePlot = (input: unknown): LinePlotProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const title = repairText(v.title, linePlotTextLimits.title);
  if (!title || !Array.isArray(v.points) || v.points.length < 3 || v.points.length > 8) return null;
  const points = v.points.map((p) => {
    const r = p && typeof p === 'object' ? p as Record<string, unknown> : {};
    const label = repairText(r.label, linePlotTextLimits.label);
    return label && typeof r.value === 'number' && Number.isFinite(r.value) && r.value >= 0 ? {label, value: r.value} : null;
  });
  if (!points.every(Boolean) || Math.max(...(points as PlotPoint[]).map((p) => p.value)) <= 0) return null;
  const xTitle = repairText(v.xTitle, linePlotTextLimits.xTitle), yTitle = repairText(v.yTitle, linePlotTextLimits.yTitle);
  const top = Math.max(...(points as PlotPoint[]).map((p) => p.value));
  return {title, points: points as PlotPoint[], ...(xTitle ? {xTitle} : {}), ...(yTitle ? {yTitle} : {}),
    ...(typeof v.max === 'number' && Number.isFinite(v.max) && v.max >= top ? {max: v.max} : {}),
    ...(typeof v.tickStep === 'number' && Number.isFinite(v.tickStep) && v.tickStep > 0 ? {tickStep: v.tickStep} : {})};
};
