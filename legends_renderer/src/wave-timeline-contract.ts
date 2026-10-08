import {repairText} from './contract.ts';
/** E40: a glowing line rises and falls through four numbered milestones (peak, dip, peak, dip) between a start and an end
 * label, with a two-word title on each side ("Forced / Out" ... "New / Refuge"). Exactly four milestones: the layout and
 * camera are the reference's. */
export type WaveTimelineProps = Readonly<{leftTitle: string; rightTitle: string; startLabel: string; endLabel: string; milestones: readonly string[]}>;
export const waveTimelineTextLimits = {leftTitle: {minWords: 1, maxWords: 2, maxChars: 14}, rightTitle: {minWords: 1, maxWords: 2, maxChars: 14},
  startLabel: {minWords: 1, maxWords: 3, maxChars: 24}, endLabel: {minWords: 1, maxWords: 3, maxChars: 24}, milestone: {minWords: 1, maxWords: 3, maxChars: 24}} as const;
export const waveTimelineDuration = {minSeconds: 3.5, maxSeconds: 10};
export const repairWaveTimeline = (input: unknown): WaveTimelineProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>, k = waveTimelineTextLimits;
  const leftTitle = repairText(v.leftTitle, k.leftTitle), rightTitle = repairText(v.rightTitle, k.rightTitle);
  const startLabel = repairText(v.startLabel, k.startLabel), endLabel = repairText(v.endLabel, k.endLabel);
  if (!leftTitle || !rightTitle || !startLabel || !endLabel || !Array.isArray(v.milestones) || v.milestones.length !== 4) return null;
  const milestones = v.milestones.map((m) => repairText(m, k.milestone));
  return milestones.every(Boolean) ? {leftTitle, rightTitle, startLabel, endLabel, milestones: milestones as string[]} : null;
};
/** One word per line; a hyphenated word breaks after its hyphen ("Franco-Prussian War" -> Franco- / Prussian / War). */
export const stackWords = (text: string) => text.split(/\s+/u).flatMap((w) => w.split(/(?<=-)(?=.)/u));
