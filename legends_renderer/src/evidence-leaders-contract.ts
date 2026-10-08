import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E31: a small photo card in a red frame on a dark stage; 1-3 dark label chips are joined to it by red elbow lines
 * that draw out from the card (slots: top-left, top-right, bottom). The card slowly tilts in perspective. */
export type EvidenceLeadersProps = Readonly<{media: FrameMedia; labels: readonly string[]}>;
export const evidenceLeadersTextLimits = {labels: {minWords: 1, maxWords: 6, maxChars: 40}} as const;
export const evidenceLeadersDuration = {minSeconds: 2.5, maxSeconds: 10};
export const repairEvidenceLeaders = (input: unknown): EvidenceLeadersProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const media = repairFrameMedia(v.media);
  if (!media || !Array.isArray(v.labels) || v.labels.length < 1 || v.labels.length > 3) return null;
  const labels = v.labels.map((l) => repairText(l, evidenceLeadersTextLimits.labels));
  return labels.every(Boolean) ? {media, labels: labels as string[]} : null;
};
