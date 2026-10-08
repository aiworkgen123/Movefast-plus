import {repairText} from './contract.ts';
import {repairStaticImage, repairNormalizedPoint, type StaticImage, type NormalizedPoint} from './media-contract.ts';
export type PhotoSpotlightProps = Readonly<{source: StaticImage; focus: NormalizedPoint; sourceCredit?: string}>;
export const photoSpotlightTextLimits = {sourceCredit: {minWords: 1, maxWords: 8, maxChars: 80}} as const;
export const photoSpotlightDuration = {minSeconds: 3, maxSeconds: 9};
export const repairPhotoSpotlight = (input: unknown): PhotoSpotlightProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const source = repairStaticImage(value.source), focus = repairNormalizedPoint(value.focus);
  if (!source || !focus) return null;
  const sourceCredit = repairText(value.sourceCredit, photoSpotlightTextLimits.sourceCredit);
  return {source, focus, ...(sourceCredit ? {sourceCredit} : {})};
};
