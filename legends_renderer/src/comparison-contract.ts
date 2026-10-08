import {repairText} from './contract.ts';
export type ComparisonSide = Readonly<{name: string; value: string; description?: string}>;
export type ComparisonProps = Readonly<{sides: readonly [ComparisonSide, ComparisonSide]; title?: string}>;
export const comparisonTextLimits = {title: {minWords: 2, maxWords: 8, maxChars: 64}} as const;
export const comparisonSideLimits = {name: {minWords: 1, maxWords: 4, maxChars: 40}, value: {minWords: 1, maxWords: 4, maxChars: 24}, description: {minWords: 2, maxWords: 8, maxChars: 64}} as const;
export const comparisonDuration = {minSeconds: 3, maxSeconds: 8};
export const repairComparison = (input: unknown): ComparisonProps | null => {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  if (!Array.isArray(item.sides) || item.sides.length !== 2) return null;
  const sides: ComparisonSide[] = [];
  for (const side of item.sides) {
    if (!side || typeof side !== 'object') return null;
    const name = repairText(side.name, comparisonSideLimits.name);
    const value = repairText(side.value, comparisonSideLimits.value);
    if (!name || !value || name !== side.name.trim() || value !== side.value.trim()) return null;
    const description = repairText(side.description, comparisonSideLimits.description);
    sides.push({name, value, ...(description ? {description} : {})});
  }
  const title = repairText(item.title, comparisonTextLimits.title);
  return {sides: sides as [ComparisonSide, ComparisonSide], ...(title ? {title} : {})};
};
