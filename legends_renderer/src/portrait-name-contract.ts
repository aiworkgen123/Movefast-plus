import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
/** E05: a framed portrait drops onto the darkened footage while the name, then the role, type on below it. */
export type PortraitNameProps = Readonly<{name: string; role?: string; portrait: StaticImage; media: FrameMedia}>;
export const portraitNameTextLimits = {name: {minWords: 1, maxWords: 5, maxChars: 26}, role: {minWords: 1, maxWords: 6, maxChars: 44}} as const;
export const portraitNameDuration = {minSeconds: 3, maxSeconds: 10};
export const repairPortraitName = (input: unknown): PortraitNameProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const name = repairText(v.name, portraitNameTextLimits.name), portrait = repairStaticImage(v.portrait), media = repairFrameMedia(v.media);
  if (!name || !portrait || !media) return null;
  const role = repairText(v.role, portraitNameTextLimits.role);
  return {name, portrait, media, ...(role ? {role} : {})};
};
