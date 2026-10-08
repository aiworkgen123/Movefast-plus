/**
 * Selects among browser-measured renderings of the real War Chess caption.
 *
 * This module deliberately knows nothing about fonts or approximate glyph
 * widths. The Remotion browser measures the production component first; this
 * selector only applies the owner-approved repair order to those measurements:
 * unchanged, shorter in place, then the same caption in a reviewed nearby
 * position. If none is safe, it blocks the caption.
 */

export type CaptionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProtectedCaptionRegion = {
  id: string;
  kind:
    | 'face'
    | 'person'
    | 'important_object'
    | 'map_evidence'
    | 'document_evidence'
    | 'important_action';
  rect: CaptionRect;
};

export type MeasuredCaptionAttempt = {
  copy: 'original' | 'shorter';
  text: string;
  layoutId: string;
  textRect: CaptionRect;
  lineCount: number;
  clipped: boolean;
};

export type LockedCaptionPreflightInput = {
  caseId: string;
  originalText: string;
  shorterText?: string;
  requiredExactTerms?: string[];
  primaryLayoutId: string;
  alternateLayoutIds?: string[];
  protectedRegions: ProtectedCaptionRegion[];
};

export type LockedCaptionPreflightResult = {
  caseId: string;
  outcome:
    | 'unchanged'
    | 'shortened'
    | 'moved'
    | 'shortened_and_moved'
    | 'blocked';
  displayText: string | null;
  layoutId: string | null;
  selectedMeasurement: MeasuredCaptionAttempt | null;
  attemptedKeys: string[];
  shorterCandidateAccepted: boolean;
  shorterCandidateRejection: 'not_shorter' | 'protected_term_removed' | null;
};

const SAFETY_MARGIN = 12;
const normalize = (value: string): string => value.trim().replace(/\s+/gu, ' ');

export const isMeasuredCaptionClipped = (measurement: {
  clientWidth: number;
  scrollWidth: number;
  lineCount: number;
}): boolean =>
  measurement.scrollWidth > measurement.clientWidth + 1 ||
  measurement.lineCount > 2;

const expanded = (rect: CaptionRect): CaptionRect => ({
  x: rect.x - SAFETY_MARGIN,
  y: rect.y - SAFETY_MARGIN,
  width: rect.width + SAFETY_MARGIN * 2,
  height: rect.height + SAFETY_MARGIN * 2,
});

const intersects = (left: CaptionRect, right: CaptionRect): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const attemptKey = (
  copy: MeasuredCaptionAttempt['copy'],
  layoutId: string,
): string => `${copy}:${layoutId}`;

const safe = (
  measurement: MeasuredCaptionAttempt,
  protectedRegions: ProtectedCaptionRegion[],
): boolean =>
  !measurement.clipped &&
  measurement.lineCount >= 1 &&
  measurement.lineCount <= 2 &&
  !protectedRegions.some((region) =>
    intersects(expanded(measurement.textRect), region.rect),
  );

export const selectLockedCaption = (
  input: LockedCaptionPreflightInput,
  measurements: MeasuredCaptionAttempt[],
): LockedCaptionPreflightResult => {
  const original = normalize(input.originalText);
  const shorter = normalize(input.shorterText ?? '');
  const requiredTerms = (input.requiredExactTerms ?? []).map(normalize).filter(Boolean);
  const isActuallyShorter = shorter.length > 0 && shorter.length < original.length;
  const preservesTerms = requiredTerms.every((term) =>
    shorter.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
  );
  const shorterAccepted = isActuallyShorter && preservesTerms;
  const shorterRejection = shorter
    ? !isActuallyShorter
      ? 'not_shorter'
      : !preservesTerms
        ? 'protected_term_removed'
        : null
    : null;
  const byKey = new Map(
    measurements.map((measurement) => [
      attemptKey(measurement.copy, measurement.layoutId),
      measurement,
    ]),
  );
  const attemptedKeys: string[] = [];

  const choose = (
    copy: MeasuredCaptionAttempt['copy'],
    layoutId: string,
  ): MeasuredCaptionAttempt | null => {
    const key = attemptKey(copy, layoutId);
    attemptedKeys.push(key);
    const measurement = byKey.get(key);
    if (!measurement) return null;
    const expectedText = copy === 'original' ? original : shorter;
    if (normalize(measurement.text) !== expectedText) return null;
    return safe(measurement, input.protectedRegions) ? measurement : null;
  };

  const initial = choose('original', input.primaryLayoutId);
  if (initial) {
    return {
      caseId: input.caseId,
      outcome: 'unchanged',
      displayText: original,
      layoutId: initial.layoutId,
      selectedMeasurement: initial,
      attemptedKeys,
      shorterCandidateAccepted: false,
      shorterCandidateRejection: null,
    };
  }

  if (shorterAccepted) {
    const shortened = choose('shorter', input.primaryLayoutId);
    if (shortened) {
      return {
        caseId: input.caseId,
        outcome: 'shortened',
        displayText: shorter,
        layoutId: shortened.layoutId,
        selectedMeasurement: shortened,
        attemptedKeys,
        shorterCandidateAccepted: true,
        shorterCandidateRejection: null,
      };
    }
  }

  const activeCopy: MeasuredCaptionAttempt['copy'] = shorterAccepted
    ? 'shorter'
    : 'original';
  for (const layoutId of input.alternateLayoutIds ?? []) {
    const moved = choose(activeCopy, layoutId);
    if (moved) {
      return {
        caseId: input.caseId,
        outcome: shorterAccepted ? 'shortened_and_moved' : 'moved',
        displayText: activeCopy === 'shorter' ? shorter : original,
        layoutId: moved.layoutId,
        selectedMeasurement: moved,
        attemptedKeys,
        shorterCandidateAccepted: shorterAccepted,
        shorterCandidateRejection: shorterRejection,
      };
    }
  }

  return {
    caseId: input.caseId,
    outcome: 'blocked',
    displayText: null,
    layoutId: null,
    selectedMeasurement: null,
    attemptedKeys,
    shorterCandidateAccepted: shorterAccepted,
    shorterCandidateRejection: shorterRejection,
  };
};
