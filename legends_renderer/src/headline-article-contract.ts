import {repairText} from './contract.ts';
import {repairStaticImage, repairNormalizedRect, type StaticImage, type NormalizedRect} from './media-contract.ts';
export type HeadlineArticleProps = Readonly<{source: StaticImage; line: NormalizedRect; sourceCredit: string}>;
export const headlineArticleTextLimits = {sourceCredit: {minWords: 1, maxWords: 8, maxChars: 80}} as const;
export const headlineArticleDuration = {minSeconds: 3, maxSeconds: 9};
export const repairHeadlineArticle = (input: unknown): HeadlineArticleProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const source = repairStaticImage(value.source), line = repairNormalizedRect(value.line);
  const sourceCredit = repairText(value.sourceCredit, headlineArticleTextLimits.sourceCredit);
  return source && line && sourceCredit ? {source, line, sourceCredit} : null;
};
