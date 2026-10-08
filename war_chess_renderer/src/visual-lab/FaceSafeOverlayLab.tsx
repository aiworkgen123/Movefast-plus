import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';

import {
  selectFaceSafeOverlay,
  type FaceSafeOverlayResult,
} from '../face-safe-overlay';
import {WC_EDITORIAL_SERIF, WC_EDITORIAL_SANS} from '../editorial-theme';
import {
  FACE_SAFE_OVERLAY_LAB_CASES,
  type FaceSafeOverlayLabCase,
} from './face-safe-overlay-cases';

export const FACE_SAFE_OVERLAY_LAB_DURATION = 720;

/** Results are bound once, before any scene frame is rendered. */
export const FACE_SAFE_OVERLAY_LAB_RESULTS = new Map<string, FaceSafeOverlayResult>(
  FACE_SAFE_OVERLAY_LAB_CASES.map((candidate) => [
    candidate.caseId,
    selectFaceSafeOverlay(candidate),
  ]),
);

const caseForFrame = (frame: number): FaceSafeOverlayLabCase =>
  FACE_SAFE_OVERLAY_LAB_CASES.find(
    (candidate) => frame >= candidate.sceneStartFrame && frame < candidate.sceneEndFrame,
  ) ?? FACE_SAFE_OVERLAY_LAB_CASES.at(-1)!;

const resultForCase = (candidate: FaceSafeOverlayLabCase): FaceSafeOverlayResult => {
  const result = FACE_SAFE_OVERLAY_LAB_RESULTS.get(candidate.caseId);
  if (!result) throw new Error(`Missing face-safe result for ${candidate.caseId}`);
  return result;
};

const textAlignFor = (anchor: FaceSafeOverlayLabCase['candidates'][number]['anchor']) =>
  anchor.endsWith('right') ? ('right' as const) : ('left' as const);

const gradientFor = (anchor: FaceSafeOverlayLabCase['candidates'][number]['anchor']) =>
  anchor.endsWith('right')
    ? 'linear-gradient(270deg, rgba(8,10,12,.46), rgba(8,10,12,.08) 72%, transparent)'
    : 'linear-gradient(90deg, rgba(8,10,12,.46), rgba(8,10,12,.08) 72%, transparent)';

/**
 * A browser-side guard supplements the deterministic preflight. It measures a
 * real child text node, rather than anonymous flex content, and fails the lab
 * render if the installed editorial font adds overflow or an extra line.
 */
const BrowserTextAudit: React.FC<{
  candidate: FaceSafeOverlayLabCase;
  result: FaceSafeOverlayResult;
}> = ({candidate, result}) => {
  React.useLayoutEffect(() => {
    if (result.outcome !== 'fit' || typeof document === 'undefined') return;
    const root = document.querySelector<HTMLElement>(
      `[data-face-safe-overlay-root="${candidate.caseId}"]`,
    );
    const content = document.querySelector<HTMLElement>(
      `[data-face-safe-overlay-content="${candidate.caseId}"]`,
    );
    if (!root || !content || result.displayText === null) {
      throw new Error(`Face-safe overlay audit could not find ${candidate.caseId}`);
    }
    if (content.textContent !== result.displayText) {
      throw new Error(`Face-safe overlay source drift for ${candidate.caseId}`);
    }

    const tolerance = 1;
    if (
      content.scrollWidth > content.clientWidth + tolerance ||
      content.scrollHeight > content.clientHeight + tolerance
    ) {
      throw new Error(
        `Face-safe overlay text overflow for ${candidate.caseId}: ` +
          `${content.scrollWidth}x${content.scrollHeight} > ` +
          `${content.clientWidth}x${content.clientHeight}`,
      );
    }

    const range = document.createRange();
    range.selectNodeContents(content);
    const lineTops = new Set(
      Array.from(range.getClientRects())
        .filter((rect) => rect.width > tolerance && rect.height > tolerance)
        .map((rect) => Math.round(rect.top * 10) / 10),
    );
    if (lineTops.size > result.lineCount) {
      throw new Error(
        `Face-safe overlay wrapped beyond preflight for ${candidate.caseId}: ` +
          `${lineTops.size} > ${result.lineCount}`,
      );
    }
  }, [candidate.caseId, result]);

  return null;
};

const OverlayCopy: React.FC<{
  candidate: FaceSafeOverlayLabCase;
  result: FaceSafeOverlayResult;
}> = ({candidate, result}) => {
  if (
    result.outcome !== 'fit' ||
    !result.chosenRect ||
    result.chosenFontSize === null ||
    result.chosenLineHeight === null ||
    !result.chosenCandidateId
  ) {
    return (
      <div
        data-face-safe-preflight-blocked={candidate.caseId}
        style={{
          position: 'absolute',
          left: 120,
          bottom: 92,
          maxWidth: 980,
          color: '#f0b6a1',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 3.2,
          lineHeight: 1.25,
          textShadow: '0 3px 18px rgba(0,0,0,.9)',
          textTransform: 'uppercase',
        }}
      >
        <div style={{fontSize: 30}}>Preflight blocked</div>
        <div
          style={{
            marginTop: 12,
            maxWidth: 820,
            color: '#f7e7df',
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1.15,
            textTransform: 'none',
          }}
        >
          Every candidate covers a protected face.
        </div>
      </div>
    );
  }

  const chosenCandidate = candidate.candidates.find(
    (item) => item.id === result.chosenCandidateId,
  );
  if (!chosenCandidate) throw new Error(`Missing chosen candidate ${result.chosenCandidateId}`);

  return (
    <div
      data-face-safe-overlay-root={candidate.caseId}
      data-face-safe-overlay-placement={chosenCandidate.anchor}
      style={{
        position: 'absolute',
        left: result.chosenRect.x,
        top: result.chosenRect.y,
        width: result.chosenRect.width,
        height: result.chosenRect.height,
        boxSizing: 'border-box',
        padding: chosenCandidate.padding,
        background: gradientFor(chosenCandidate.anchor),
        pointerEvents: 'none',
      }}
    >
      <span
        data-face-safe-overlay-content={candidate.caseId}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100%',
          boxSizing: 'border-box',
          color: '#fbf4e9',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: result.chosenFontSize,
          fontWeight: 700,
          lineHeight: result.chosenLineHeight,
          letterSpacing: -0.25,
          textAlign: textAlignFor(chosenCandidate.anchor),
          whiteSpace: 'pre-line',
          overflow: 'hidden',
          overflowWrap: 'normal',
          wordBreak: 'normal',
          textShadow: '0 3px 18px rgba(0,0,0,.86)',
        }}
      >
        {result.displayText}
      </span>
    </div>
  );
};

const LabScene: React.FC<{
  candidate: FaceSafeOverlayLabCase;
  result: FaceSafeOverlayResult;
}> = ({candidate, result}) => (
  <AbsoluteFill
    data-face-safe-overlay-case={candidate.caseId}
    style={{backgroundColor: candidate.backgroundColor}}
  >
    <Img
      src={staticFile(candidate.mediaStaticFileKey)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: candidate.mediaObjectPosition,
        filter: 'saturate(.9) contrast(1.04)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 88,
        top: 58,
        color: 'rgba(251,244,233,.88)',
        fontFamily: WC_EDITORIAL_SANS,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: 3.2,
        textShadow: '0 2px 14px rgba(0,0,0,.85)',
      }}
    >
      {candidate.label}
    </div>
    <OverlayCopy candidate={candidate} result={result} />
    <BrowserTextAudit candidate={candidate} result={result} />
  </AbsoluteFill>
);

export const FaceSafeOverlayLab: React.FC = () => {
  const frame = useCurrentFrame();
  const candidate = caseForFrame(frame);
  return <LabScene candidate={candidate} result={resultForCase(candidate)} />;
};

