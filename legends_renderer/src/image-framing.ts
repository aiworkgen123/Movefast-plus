import type {StaticImage, NormalizedRect} from './media-contract.ts';
export type PixelRect = Readonly<{x: number; y: number; width: number; height: number}>;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const containImage = (width: number, height: number, viewport: PixelRect) => {
  const scale = Math.min(viewport.width / width, viewport.height / height);
  return {x: viewport.x + (viewport.width - width * scale) / 2,
    y: viewport.y + (viewport.height - height * scale) / 2, width: width * scale, height: height * scale, scale};
};
/** Expand around the supplied rectangle; cap at the actual image and contain if aspect ratios differ. */
export const focusCrop = (image: StaticImage, rect: NormalizedRect, viewport: PixelRect, padding: number, maxZoom: number): PixelRect => {
  const detailW = rect.width * image.width, detailH = rect.height * image.height;
  const paddedW = detailW * (1 + 2 * padding), paddedH = detailH * (1 + 2 * padding);
  const aspect = viewport.width / viewport.height;
  const width = Math.min(image.width, Math.max(image.width / maxZoom, paddedW, paddedH * aspect));
  const height = Math.min(image.height, Math.max(image.height / maxZoom, paddedH, paddedW / aspect));
  return {x: clamp((rect.x + rect.width / 2) * image.width - width / 2, 0, image.width - width),
    y: clamp((rect.y + rect.height / 2) * image.height - height / 2, 0, image.height - height), width, height};
};
export const mixRect = (from: PixelRect, to: PixelRect, amount: number): PixelRect => ({
  x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount,
  width: from.width + (to.width - from.width) * amount, height: from.height + (to.height - from.height) * amount,
});
