export type StaticImage = Readonly<{path: string; width: number; height: number}>;
export type NormalizedRect = Readonly<{x: number; y: number; width: number; height: number}>;
/** A literal image path relative to the served public root; never a URL or filesystem path. */
export const repairStaticImage = (input: unknown): StaticImage | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.path !== 'string' || !/\.(png|jpe?g|webp|avif|svg)$/iu.test(value.path) ||
    value.path.split('/').some(part => !/^[a-z0-9_-][a-z0-9 _.\-]*$/iu.test(part) || part === '.' || part === '..') ||
    typeof value.width !== 'number' || !Number.isSafeInteger(value.width) || value.width <= 0 ||
    typeof value.height !== 'number' || !Number.isSafeInteger(value.height) || value.height <= 0) return null;
  return {path: value.path, width: value.width, height: value.height};
};
export const repairNormalizedRect = (input: unknown): NormalizedRect | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  if (![v.x, v.y, v.width, v.height].every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  const {x, y, width, height} = v as NormalizedRect;
  return x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1
    ? {x, y, width, height} : null;
};
export type NormalizedPoint = Readonly<{x: number; y: number}>;
export const repairNormalizedPoint = (input: unknown): NormalizedPoint | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  return typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1 &&
    typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    ? {x: value.x, y: value.y} : null;
};
