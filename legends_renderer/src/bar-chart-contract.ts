import {repairText} from './contract.ts';
/** E35 / E36: an animated bar chart on the navy vignette. Vertical (E35) shows each value above its bar and can turn one bar
 * amber; horizontal (E36) reads off a value axis. Values are the script's numbers; the template never rounds them in the data. */
export type Bar = Readonly<{label: string; value: number}>;
export type BarChartProps = Readonly<{orientation: 'vertical' | 'horizontal'; title: string; bars: readonly Bar[]; unit?: '%'; highlight?: number;
  valueTitle?: string; categoryTitle?: string; max?: number; tickStep?: number}>;
export const barChartTextLimits = {title: {minWords: 1, maxWords: 6, maxChars: 40}, label: {minWords: 1, maxWords: 3, maxChars: 18},
  valueTitle: {minWords: 1, maxWords: 4, maxChars: 26}, categoryTitle: {minWords: 1, maxWords: 4, maxChars: 26}} as const;
export const barChartDuration = {minSeconds: 3.5, maxSeconds: 12};
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
export const repairBarChart = (input: unknown): BarChartProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const orientation = v.orientation === 'horizontal' ? 'horizontal' : v.orientation === 'vertical' ? 'vertical' : null;
  const title = repairText(v.title, barChartTextLimits.title);
  if (!orientation || !title || !Array.isArray(v.bars) || v.bars.length < 2 || v.bars.length > 6) return null;
  const bars = v.bars.map((b) => {
    const r = b && typeof b === 'object' ? b as Record<string, unknown> : {};
    const label = repairText(r.label, barChartTextLimits.label);
    return label && typeof r.value === 'number' && Number.isFinite(r.value) && r.value >= 0 ? {label, value: r.value} : null;
  });
  if (!bars.every(Boolean)) return null;
  const top = Math.max(...(bars as Bar[]).map((b) => b.value));
  if (top <= 0) return null;
  const valueTitle = repairText(v.valueTitle, barChartTextLimits.valueTitle), categoryTitle = repairText(v.categoryTitle, barChartTextLimits.categoryTitle);
  const highlight = orientation === 'vertical' && Number.isInteger(v.highlight) && (v.highlight as number) >= 0 && (v.highlight as number) < bars.length ? v.highlight as number : undefined;
  return {orientation, title, bars: bars as Bar[], ...(v.unit === '%' ? {unit: '%' as const} : {}), ...(highlight !== undefined ? {highlight} : {}),
    ...(valueTitle ? {valueTitle} : {}), ...(categoryTitle ? {categoryTitle} : {}),
    ...(positive(v.max) && v.max >= top ? {max: v.max} : {}), ...(positive(v.tickStep) ? {tickStep: v.tickStep} : {})};
};
