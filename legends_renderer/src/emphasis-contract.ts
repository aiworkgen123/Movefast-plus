import {repairText} from './contract.ts';
export type EmphasisProps = Readonly<{text: string}>;
export const emphasisTextLimits = {text: {minWords: 2, maxWords: 8, maxChars: 64}} as const;
export const emphasisDuration = {minSeconds: 2, maxSeconds: 6};
export const repairEmphasis = (input: unknown): EmphasisProps | null => {
  if (!input || typeof input !== 'object') return null;
  const text = repairText((input as Record<string, unknown>).text, emphasisTextLimits.text);
  return text ? {text} : null;
};
