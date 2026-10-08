import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E11: two small italic lines set up a big payoff word, whose letters rise into place one by one. */
export type KickerPayoffProps = Readonly<{kicker: string; subtitle?: string; word: string; media: FrameMedia}>;
export const kickerPayoffTextLimits = {kicker: {minWords: 1, maxWords: 4, maxChars: 24}, subtitle: {minWords: 1, maxWords: 5, maxChars: 28}, word: {minWords: 1, maxWords: 1, maxChars: 10}} as const;
export const kickerPayoffDuration = {minSeconds: 1.5, maxSeconds: 8};
export const repairKickerPayoff = (input: unknown): KickerPayoffProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const kicker = repairText(v.kicker, kickerPayoffTextLimits.kicker), word = repairText(v.word, kickerPayoffTextLimits.word), media = repairFrameMedia(v.media);
  if (!kicker || !word || !media) return null;
  const subtitle = repairText(v.subtitle, kickerPayoffTextLimits.subtitle);
  return {kicker, word, media, ...(subtitle ? {subtitle} : {})};
};
