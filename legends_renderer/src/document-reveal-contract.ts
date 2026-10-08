import {repairText} from './contract.ts';
import {repairStaticImage, repairNormalizedRect, type StaticImage, type NormalizedRect} from './media-contract.ts';
export type DocumentRevealProps = Readonly<{source: StaticImage; detail: NormalizedRect; title: string; detailLabel?: string}>;
export const documentRevealTextLimits = {title: {minWords: 2, maxWords: 8, maxChars: 64}, detailLabel: {minWords: 1, maxWords: 8, maxChars: 64}} as const;
export const documentRevealDuration = {minSeconds: 3, maxSeconds: 9};
export const repairDocumentReveal = (input: unknown): DocumentRevealProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const source = repairStaticImage(value.source), detail = repairNormalizedRect(value.detail);
  const title = repairText(value.title, documentRevealTextLimits.title);
  if (!source || !detail || !title) return null;
  const detailLabel = repairText(value.detailLabel, documentRevealTextLimits.detailLabel);
  return {source, detail, title, ...(detailLabel ? {detailLabel} : {})};
};
