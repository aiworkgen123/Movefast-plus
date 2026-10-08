/** Shared maths for the Construction Legends charts (E35-E37): band layout, ticks, fades. Units are 1920x1080. */
export const linearFade = (t: number, start: number, seconds: number) => Math.max(0, Math.min(1, (t - start) / seconds));

/** Category centres along [from, to]: one step per category plus `outer` steps of padding at each end (measured 0.6 / 0.55). */
export const bandCentres = (count: number, from: number, to: number, outer: number) => {
  const step = (to - from) / (count - 1 + 2 * outer);
  return {step, centres: Array.from({length: count}, (_, i) => from + (outer + i) * step)};
};

/** Nearest 1/2/5 x 10^k: 9.8 -> 10, 2092 -> 2000. */
export const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
};

/** Ticks at whole steps below max, plus max itself (E35 shows 0, 10, 20, 30, 35%). */
export const ticksTo = (max: number, step: number) => {
  const out: number[] = [];
  for (let v = 0; v < max - step * 1e-6; v += step) out.push(Number(v.toFixed(6)));
  return [...out, max];
};

export const formatTick = (value: number, unit: string, compact: boolean) => {
  if (unit === '%') return `${value}%`;
  if (!compact) return `${value}`;
  return value === 0 ? '0.0' : `${Number((value / 1000).toFixed(1))}K`;
};
