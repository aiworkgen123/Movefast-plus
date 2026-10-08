import {repairText} from './contract.ts';
export type ChapterCardProps = Readonly<{chapter: number; title: string; subtitle?: string}>;
export const chapterCardTextLimits = {title: {minWords: 2, maxWords: 8, maxChars: 64}, subtitle: {minWords: 2, maxWords: 8, maxChars: 64}} as const;
export const chapterCardDuration = {minSeconds: 2, maxSeconds: 7};
export const repairChapterCard = (input: unknown): ChapterCardProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.chapter !== 'number' || !Number.isInteger(value.chapter) || value.chapter < 1 || value.chapter > 99) return null;
  const title = repairText(value.title, chapterCardTextLimits.title);
  if (!title) return null;
  const subtitle = repairText(value.subtitle, chapterCardTextLimits.subtitle);
  return {chapter: value.chapter, title, ...(subtitle ? {subtitle} : {})};
};
