/**
 * Small, deterministic overlay preflight for the face-safe visual lab.
 *
 * The only protected geometry in this experiment is an explicitly supplied
 * face rectangle. Background imagery, clothing, terrain, furniture, maps,
 * and chess pieces remain valid overlay surfaces. The selector is evaluated
 * from fixed scene inputs before rendering starts, so it cannot jump between
 * candidates as a frame animates.
 *
 * Text width is a conservative editorial-font estimate, not a replacement for
 * a real browser font audit. The lab composition repeats the check against an
 * explicit text element and fails its render when the browser creates overflow
 * or additional lines. No truncation or ellipsis is ever produced here.
 */

export type FaceSafeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FaceSafeAnchor =
  | 'top-left'
  | 'bottom-left'
  | 'top-right'
  | 'bottom-right';

export type FaceSafeFace = {
  id: string;
  rect: FaceSafeRect;
};

export type FaceSafeOverlayCandidate = {
  id: string;
  anchor: FaceSafeAnchor;
  priority: number;
  rect: FaceSafeRect;
  padding: number;
  maxLines: number;
  fontSize: number;
  lineHeight: number;
};

export type FaceSafeOverlayCase = {
  caseId: string;
  sourceText: string;
  candidates: FaceSafeOverlayCandidate[];
  faces: FaceSafeFace[];
};

export type FaceSafeOverlayOutcome = 'fit' | 'preflight_blocked';

export type FaceSafeCandidateDecision = {
  id: string;
  anchor: FaceSafeAnchor;
  rect: FaceSafeRect;
  textFits: boolean;
  lineCount: number;
  intersectsFace: boolean;
  intersectingFaceIds: string[];
};

export type FaceSafeOverlayResult = {
  caseId: string;
  sourceText: string;
  displayText: string | null;
  outcome: FaceSafeOverlayOutcome;
  chosenCandidateId: string | null;
  chosenRect: FaceSafeRect | null;
  chosenFontSize: number | null;
  chosenLineHeight: number | null;
  lines: string[];
  lineCount: number;
  faces: FaceSafeFace[];
  candidateDecisions: FaceSafeCandidateDecision[];
  failureReason: 'face_collision' | 'no_safe_geometry' | 'empty_source_copy' | null;
};

const EPSILON = 0.001;

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isValidRect = (rect: FaceSafeRect): boolean =>
  Number.isFinite(rect.x) &&
  Number.isFinite(rect.y) &&
  isFinitePositive(rect.width) &&
  isFinitePositive(rect.height);

/** Rectangles that only touch at an edge do not collide. */
export const faceRectsIntersect = (a: FaceSafeRect, b: FaceSafeRect): boolean =>
  a.x < b.x + b.width - EPSILON &&
  a.x + a.width > b.x + EPSILON &&
  a.y < b.y + b.height - EPSILON &&
  a.y + a.height > b.y + EPSILON;

const estimateGlyphWidth = (glyph: string, fontSize: number): number => {
  if (/\s/u.test(glyph)) return fontSize * 0.31;
  if (/[A-ZÀ-ÖØ-Þ]/u.test(glyph)) return fontSize * 0.67;
  if (/[0-9]/u.test(glyph)) return fontSize * 0.56;
  if (/[.,;:'’!?()[\]{}\-–—]/u.test(glyph)) return fontSize * 0.34;
  return fontSize * 0.57;
};

const estimateLineWidth = (line: string, fontSize: number): number =>
  Array.from(line).reduce(
    (width, glyph) => width + estimateGlyphWidth(glyph, fontSize),
    0,
  );

const wrapText = (sourceText: string, maxWidth: number, fontSize: number): string[] => {
  const words = sourceText.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && estimateLineWidth(next, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const emptyResult = (
  input: FaceSafeOverlayCase,
  failureReason: FaceSafeOverlayResult['failureReason'],
): FaceSafeOverlayResult => ({
  caseId: input.caseId,
  sourceText: input.sourceText,
  displayText: null,
  outcome: 'preflight_blocked',
  chosenCandidateId: null,
  chosenRect: null,
  chosenFontSize: null,
  chosenLineHeight: null,
  lines: [],
  lineCount: 0,
  faces: input.faces,
  candidateDecisions: [],
  failureReason,
});

/**
 * Select the first preferred candidate that can carry the complete copy and
 * whose full overlay rectangle avoids every protected face rectangle.
 */
export const selectFaceSafeOverlay = (
  input: FaceSafeOverlayCase,
): FaceSafeOverlayResult => {
  const sourceText = input.sourceText.trim();
  if (!sourceText) return emptyResult(input, 'empty_source_copy');

  const candidateDecisions: FaceSafeCandidateDecision[] = [];
  let hadFaceCollision = false;

  const candidates = [...input.candidates].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );

  for (const candidate of candidates) {
    const validGeometry =
      isValidRect(candidate.rect) &&
      Number.isFinite(candidate.padding) &&
      candidate.padding >= 0 &&
      Number.isInteger(candidate.maxLines) &&
      candidate.maxLines > 0 &&
      isFinitePositive(candidate.fontSize) &&
      isFinitePositive(candidate.lineHeight);
    const innerWidth = candidate.rect.width - candidate.padding * 2;
    const innerHeight = candidate.rect.height - candidate.padding * 2;
    const lines = validGeometry
      ? wrapText(sourceText, Math.max(1, innerWidth), candidate.fontSize)
      : [];
    const lineCount = lines.length;
    const textFits =
      validGeometry &&
      innerWidth > 0 &&
      innerHeight > 0 &&
      lineCount > 0 &&
      lineCount <= candidate.maxLines &&
      lineCount * candidate.fontSize * candidate.lineHeight <= innerHeight + EPSILON &&
      lines.every((line) => estimateLineWidth(line, candidate.fontSize) <= innerWidth + EPSILON);
    const intersectingFaceIds = input.faces
      .filter((face) => isValidRect(face.rect) && faceRectsIntersect(candidate.rect, face.rect))
      .map((face) => face.id);
    const intersectsFace = intersectingFaceIds.length > 0;
    if (intersectsFace) hadFaceCollision = true;

    candidateDecisions.push({
      id: candidate.id,
      anchor: candidate.anchor,
      rect: candidate.rect,
      textFits,
      lineCount,
      intersectsFace,
      intersectingFaceIds,
    });

    if (textFits && !intersectsFace) {
      return {
        caseId: input.caseId,
        sourceText: input.sourceText,
        displayText: lines.join('\n'),
        outcome: 'fit',
        chosenCandidateId: candidate.id,
        chosenRect: candidate.rect,
        chosenFontSize: candidate.fontSize,
        chosenLineHeight: candidate.lineHeight,
        lines,
        lineCount,
        faces: input.faces,
        candidateDecisions,
        failureReason: null,
      };
    }
  }

  return {
    ...emptyResult(input, hadFaceCollision ? 'face_collision' : 'no_safe_geometry'),
    candidateDecisions,
  };
};

