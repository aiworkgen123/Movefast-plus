/**
 * Deterministic text-layout preflight for the visual lab.
 *
 * The solver intentionally does not use DOM or browser font measurement. It
 * estimates glyph widths from the requested font size, then returns the exact
 * rectangle the lab will assign to the text element. The proof composition
 * performs a second, browser-box collision check before treating a fit as
 * usable. This keeps the choice stable before a scene starts while making the
 * limitation explicit: a production integration must keep the browser check.
 */

export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutAnchor = 'left' | 'center' | 'right';
export type LayoutVerticalAnchor = 'top' | 'center' | 'bottom';

export type AdaptiveTextZone = {
  id: string;
  rect: LayoutRect;
};

export type AdaptiveProtectedRect = {
  id: string;
  rect: LayoutRect;
};

export type AdaptiveTextVariant = {
  id: string;
  zoneId: string;
  priority: number;
  padding: number;
  maxLines: number;
  preferredFontSize: number;
  minFontSize: number;
  lineHeight: number;
  anchor: LayoutAnchor;
  verticalAnchor: LayoutVerticalAnchor;
};

export type AdaptiveTextCase = {
  caseId: string;
  sourceText: string;
  zones: AdaptiveTextZone[];
  protectedRects: AdaptiveProtectedRect[];
  variants: AdaptiveTextVariant[];
};

export type AdaptiveTextOutcome =
  | 'fit'
  | 'needs_display_copy'
  | 'no_safe_layout';

export type AdaptiveTextFailureReason =
  | 'copy_does_not_fit'
  | 'protected_media_collision'
  | 'invalid_geometry'
  | 'empty_source_copy';

export type AdaptiveTextLayoutResult = {
  caseId: string;
  sourceText: string;
  displayText: string | null;
  outcome: AdaptiveTextOutcome;
  chosenVariantId: string | null;
  chosenZoneId: string | null;
  textRect: LayoutRect | null;
  lines: string[];
  lineCount: number;
  fontSize: number | null;
  protectedRects: AdaptiveProtectedRect[];
  failureReason: AdaptiveTextFailureReason | null;
};

const EPSILON = 0.001;
const FONT_METRIC_HEIGHT_BUFFER = 0.2;

const isFiniteNumber = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

const isValidRect = (rect: LayoutRect): boolean =>
  isFiniteNumber(rect.x) &&
  isFiniteNumber(rect.y) &&
  isFiniteNumber(rect.width) &&
  isFiniteNumber(rect.height) &&
  rect.width > 0 &&
  rect.height > 0;

const insetRect = (rect: LayoutRect, padding: number): LayoutRect => ({
  x: rect.x + padding,
  y: rect.y + padding,
  width: rect.width - padding * 2,
  height: rect.height - padding * 2,
});

const rectsOverlap = (a: LayoutRect, b: LayoutRect): boolean =>
  a.x < b.x + b.width - EPSILON &&
  a.x + a.width > b.x + EPSILON &&
  a.y < b.y + b.height - EPSILON &&
  a.y + a.height > b.y + EPSILON;

/**
 * Small, stable width estimate for the approved editorial fonts.
 * It is not a substitute for browser measurement; it is a conservative,
 * deterministic preflight that prevents silent truncation and frame jumps.
 */
const estimateGlyphWidth = (glyph: string, fontSize: number): number => {
  if (/\s/u.test(glyph)) return fontSize * 0.28;
  if (/[A-ZÀ-ÖØ-Þ]/u.test(glyph)) return fontSize * 0.62;
  if (/[0-9]/u.test(glyph)) return fontSize * 0.52;
  if (/[.,;:'’!?()[\]{}\-–—]/u.test(glyph)) return fontSize * 0.3;
  return fontSize * 0.53;
};

const estimateLineWidth = (line: string, fontSize: number): number =>
  Array.from(line).reduce(
    (total, glyph) => total + estimateGlyphWidth(glyph, fontSize),
    0,
  );

const breakWord = (word: string, maxWidth: number, fontSize: number): string[] => {
  const chunks: string[] = [];
  let current = '';
  for (const glyph of Array.from(word)) {
    const candidate = current + glyph;
    if (current && estimateLineWidth(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = glyph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const wrapText = (
  sourceText: string,
  maxWidth: number,
  fontSize: number,
): string[] => {
  const words = sourceText.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (estimateLineWidth(word, fontSize) > maxWidth) {
      if (current) {
        lines.push(current);
        current = '';
      }
      const chunks = breakWord(word, maxWidth, fontSize);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? '';
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (current && estimateLineWidth(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const resultShell = (
  input: AdaptiveTextCase,
  outcome: AdaptiveTextOutcome,
  failureReason: AdaptiveTextFailureReason | null,
): AdaptiveTextLayoutResult => ({
  caseId: input.caseId,
  sourceText: input.sourceText,
  displayText: null,
  outcome,
  chosenVariantId: null,
  chosenZoneId: null,
  textRect: null,
  lines: [],
  lineCount: 0,
  fontSize: null,
  protectedRects: input.protectedRects,
  failureReason,
});

const alignedX = (
  inner: LayoutRect,
  textWidth: number,
  anchor: LayoutAnchor,
): number => {
  if (anchor === 'right') return inner.x + inner.width - textWidth;
  if (anchor === 'center') return inner.x + (inner.width - textWidth) / 2;
  return inner.x;
};

const alignedY = (
  inner: LayoutRect,
  textHeight: number,
  anchor: LayoutVerticalAnchor,
): number => {
  if (anchor === 'bottom') return inner.y + inner.height - textHeight;
  if (anchor === 'center') return inner.y + (inner.height - textHeight) / 2;
  return inner.y;
};

/**
 * Choose one stable variant and font size for the complete source copy.
 * The returned displayText is line-broken only; every source word remains
 * present, and an unsuccessful layout never returns a truncated substitute.
 */
export const solveAdaptiveTextLayout = (
  input: AdaptiveTextCase,
): AdaptiveTextLayoutResult => {
  const trimmedSource = input.sourceText.trim();
  if (!trimmedSource) return resultShell(input, 'needs_display_copy', 'empty_source_copy');

  const zones = new Map(input.zones.map((zone) => [zone.id, zone]));
  const variants = [...input.variants].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
  let hadGeometryFit = false;
  let hadProtectedCollision = false;
  let hadInvalidGeometry = false;

  for (const variant of variants) {
    const zone = zones.get(variant.zoneId);
    if (
      !zone ||
      !isValidRect(zone.rect) ||
      !Number.isFinite(variant.padding) ||
      variant.padding < 0 ||
      !Number.isFinite(variant.maxLines) ||
      variant.maxLines < 1 ||
      !Number.isFinite(variant.preferredFontSize) ||
      !Number.isFinite(variant.minFontSize) ||
      variant.minFontSize <= 0 ||
      variant.preferredFontSize < variant.minFontSize ||
      !Number.isFinite(variant.lineHeight) ||
      variant.lineHeight < 1
    ) {
      hadInvalidGeometry = true;
      continue;
    }

    const inner = insetRect(zone.rect, variant.padding);
    if (!isValidRect(inner)) {
      hadInvalidGeometry = true;
      continue;
    }

    const preferred = Math.max(1, Math.floor(variant.preferredFontSize));
    const minimum = Math.max(1, Math.ceil(variant.minFontSize));
    for (let fontSize = preferred; fontSize >= minimum; fontSize -= 1) {
      const lines = wrapText(trimmedSource, inner.width, fontSize);
      if (!lines.length || lines.length > variant.maxLines) continue;
      // Browser line boxes include font ascender/descender metrics that are
      // not represented by the width estimator. Reserve a deterministic
      // per-size buffer so the actual DOM text cannot be clipped vertically;
      // the proof's scrollHeight assertion remains the final authority.
      const textHeight = Math.ceil(
        lines.length * fontSize * variant.lineHeight + fontSize * FONT_METRIC_HEIGHT_BUFFER,
      );
      if (textHeight > inner.height) continue;
      hadGeometryFit = true;
      // The assigned CSS box is the whole usable zone, not the estimated
      // glyph width. Browser font metrics can be wider than this preflight
      // estimate; giving the text its full approved geometry prevents a
      // seemingly successful one-line result from clipping its last word.
      const assignedWidth = inner.width;
      const textRect: LayoutRect = {
        x: alignedX(inner, assignedWidth, variant.anchor),
        y: alignedY(inner, textHeight, variant.verticalAnchor),
        width: assignedWidth,
        height: textHeight,
      };
      const collides = input.protectedRects.some(({rect}) => rectsOverlap(textRect, rect));
      if (collides) {
        hadProtectedCollision = true;
        continue;
      }

      return {
        caseId: input.caseId,
        sourceText: input.sourceText,
        displayText: lines.join('\n'),
        outcome: 'fit',
        chosenVariantId: variant.id,
        chosenZoneId: zone.id,
        textRect,
        lines,
        lineCount: lines.length,
        fontSize,
        protectedRects: input.protectedRects,
        failureReason: null,
      };
    }
  }

  if (hadProtectedCollision && hadGeometryFit) {
    return resultShell(input, 'no_safe_layout', 'protected_media_collision');
  }
  return resultShell(
    input,
    hadInvalidGeometry ? 'no_safe_layout' : 'needs_display_copy',
    hadInvalidGeometry ? 'invalid_geometry' : 'copy_does_not_fit',
  );
};

export const rectsIntersect = rectsOverlap;
