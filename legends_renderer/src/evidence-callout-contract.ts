import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E17: a dark circle opens over the footage; a condensed headline, a quoted passage beside a cyan bar and a source line appear. */
export type EvidenceCalloutProps = Readonly<{title: string; body: string; source?: string; media: FrameMedia}>;
export const evidenceCalloutTextLimits = {title: {minWords: 2, maxWords: 8, maxChars: 44}, body: {minWords: 4, maxWords: 30, maxChars: 190}, source: {minWords: 2, maxWords: 14, maxChars: 90}} as const;
export const evidenceCalloutDuration = {minSeconds: 3, maxSeconds: 12};
export const repairEvidenceCallout = (input: unknown): EvidenceCalloutProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const title = repairText(v.title, evidenceCalloutTextLimits.title), body = repairText(v.body, evidenceCalloutTextLimits.body), media = repairFrameMedia(v.media);
  if (!title || !body || !media) return null;
  const source = repairText(v.source, evidenceCalloutTextLimits.source);
  return {title, body, media, ...(source ? {source} : {})};
};
