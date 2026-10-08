import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
/** E08: a large close portrait slowly pushes in; a second (cut-out) portrait grows in from the bottom-left corner; the name and
 * role type on and a curved arrow draws from the label towards the person. */
export type DoublePortraitProps = Readonly<{name: string; role?: string; portrait: StaticImage; media: FrameMedia}>;
export const doublePortraitTextLimits = {name: {minWords: 1, maxWords: 4, maxChars: 22}, role: {minWords: 1, maxWords: 4, maxChars: 26}} as const;
export const doublePortraitDuration = {minSeconds: 2, maxSeconds: 10};
export const repairDoublePortrait = (input: unknown): DoublePortraitProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const name = repairText(v.name, doublePortraitTextLimits.name), portrait = repairStaticImage(v.portrait), media = repairFrameMedia(v.media);
  if (!name || !portrait || !media) return null;
  const role = repairText(v.role, doublePortraitTextLimits.role);
  return {name, portrait, media, ...(role ? {role} : {})};
};
