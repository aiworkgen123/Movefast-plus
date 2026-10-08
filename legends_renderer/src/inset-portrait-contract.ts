import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
/** E07: over softened footage, a name and role fade in at the left and a cut-out portrait in a thin blue frame fades in at the right. */
export type InsetPortraitProps = Readonly<{name: string; role?: string; portrait: StaticImage; media: FrameMedia}>;
export const insetPortraitTextLimits = {name: {minWords: 1, maxWords: 4, maxChars: 22}, role: {minWords: 1, maxWords: 6, maxChars: 40}} as const;
export const insetPortraitDuration = {minSeconds: 2, maxSeconds: 10};
export const repairInsetPortrait = (input: unknown): InsetPortraitProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const name = repairText(v.name, insetPortraitTextLimits.name), portrait = repairStaticImage(v.portrait), media = repairFrameMedia(v.media);
  if (!name || !portrait || !media) return null;
  const role = repairText(v.role, insetPortraitTextLimits.role);
  return {name, portrait, media, ...(role ? {role} : {})};
};
