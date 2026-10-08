import {repairText} from './contract.ts';
import {repairStaticImage, type StaticImage} from './media-contract.ts';
/** E06: on a dark stage, a red disc carries one or two cut-out photos in from the left; the name rises in, the role drops in above it. */
export type RedDossierProps = Readonly<{name: string; role?: string; photos: readonly StaticImage[]}>;
export const redDossierTextLimits = {name: {minWords: 1, maxWords: 3, maxChars: 24}, role: {minWords: 1, maxWords: 5, maxChars: 32}} as const;
export const redDossierDuration = {minSeconds: 3, maxSeconds: 12};
export const repairRedDossier = (input: unknown): RedDossierProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const name = repairText(v.name, redDossierTextLimits.name);
  if (!name || !Array.isArray(v.photos) || v.photos.length < 1 || v.photos.length > 2) return null;
  const photos = v.photos.map(repairStaticImage);
  if (photos.some((p) => !p)) return null;
  const role = repairText(v.role, redDossierTextLimits.role);
  return {name, photos: photos as StaticImage[], ...(role ? {role} : {})};
};
