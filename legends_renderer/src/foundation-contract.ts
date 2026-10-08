import {repairText} from './contract.ts';

export type FoundationProps = Readonly<{title: string; label: string; archive: boolean}>;
export const foundationTextLimits = {title: {minWords: 2, maxWords: 8, maxChars: 64}, label: {minWords: 1, maxWords: 4, maxChars: 32}} as const;
export const foundationDuration = {minSeconds: 2, maxSeconds: 8};
export const repairFoundation = (input: unknown): FoundationProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const title = repairText(value.title, foundationTextLimits.title);
  const label = repairText(value.label, foundationTextLimits.label);
  if (!title || !label || typeof value.archive !== 'boolean') return null;
  return {title, label, archive: value.archive};
};
