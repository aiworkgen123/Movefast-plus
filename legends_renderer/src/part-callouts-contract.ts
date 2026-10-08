import {repairText} from './contract.ts';
import {repairNormalizedPoint, repairStaticImage, type NormalizedPoint, type StaticImage} from './media-contract.ts';
/** E30: one cut-out object on a disc, with 2-4 part labels joined to it by dashed leader lines. */
export type PartCallout = Readonly<{text: string; target: NormalizedPoint}>;
/** size 'large' (E33): the object fills most of the frame and slides in from the right before the leaders draw. */
export type PartCalloutsProps = Readonly<{object: StaticImage; labels: readonly PartCallout[]; size?: 'small' | 'large'}>;
export const partCalloutsTextLimits = {labels: {minWords: 1, maxWords: 3, maxChars: 20}} as const;
export const partCalloutsDuration = {minSeconds: 3, maxSeconds: 12};
export const repairPartCallouts = (input: unknown): PartCalloutsProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const object = repairStaticImage(v.object);
  if (!object || !Array.isArray(v.labels) || v.labels.length < 2 || v.labels.length > 4) return null;
  const labels: PartCallout[] = [];
  for (const raw of v.labels) {
    const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const text = repairText(r.text, partCalloutsTextLimits.labels), target = repairNormalizedPoint(r.target);
    if (!text || !target) return null;
    labels.push({text, target});
  }
  return {object, labels, ...(v.size === 'large' ? {size: 'large' as const} : {})};
};
