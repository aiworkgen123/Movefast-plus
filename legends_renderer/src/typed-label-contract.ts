import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E04: name (then role) typed with a cursor at the lower left; the name moves up a line when the role starts. */
export type TypedLabelProps = Readonly<{name: string; role?: string; media: FrameMedia}>;
export const typedLabelTextLimits = {name: {minWords: 1, maxWords: 6, maxChars: 34}, role: {minWords: 1, maxWords: 6, maxChars: 40}} as const;
export const typedLabelDuration = {minSeconds: 2, maxSeconds: 10};
export const repairTypedLabel = (input: unknown): TypedLabelProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const name = repairText(v.name, typedLabelTextLimits.name), media = repairFrameMedia(v.media);
  if (!name || !media) return null;
  const role = repairText(v.role, typedLabelTextLimits.role);
  return {name, media, ...(role ? {role} : {})};
};
