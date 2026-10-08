import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {
  rectsIntersect,
  solveAdaptiveTextLayout,
  type AdaptiveTextLayoutResult,
  type LayoutRect,
} from '../adaptive-text-layout';
import {WC_EDITORIAL_SERIF, WC_EDITORIAL_SANS} from '../editorial-theme';
import {ADAPTIVE_TEXT_LAYOUT_LAB_CASES, type AdaptiveTextLabCase} from './adaptive-text-layout-cases';

export const ADAPTIVE_TEXT_LAYOUT_LAB_DURATION = 720;

const caseForFrame = (frame: number): AdaptiveTextLabCase =>
  ADAPTIVE_TEXT_LAYOUT_LAB_CASES.find(
    (candidate) => frame >= candidate.sceneStartFrame && frame < candidate.sceneEndFrame,
  ) ?? ADAPTIVE_TEXT_LAYOUT_LAB_CASES.at(-1)!;

// Layout is solved once when the review composition is loaded. A frame render
// only selects the already-bound scene result; it cannot choose a new variant
// while a scene is animating.
const ADAPTIVE_TEXT_LAYOUT_LAB_RESULTS = new Map<string, AdaptiveTextLayoutResult>(
  ADAPTIVE_TEXT_LAYOUT_LAB_CASES.map((candidate) => [candidate.caseId, solveAdaptiveTextLayout(candidate)]),
);

const resultForCase = (candidate: AdaptiveTextLabCase): AdaptiveTextLayoutResult => {
  const result = ADAPTIVE_TEXT_LAYOUT_LAB_RESULTS.get(candidate.caseId);
  if (!result) throw new Error(`Missing adaptive layout result for ${candidate.caseId}`);
  return result;
};

const sameRect = (a: DOMRect, b: DOMRect): LayoutRect => ({
  x: a.left - b.left,
  y: a.top - b.top,
  width: a.width,
  height: a.height,
});

const BrowserLayoutAudit: React.FC<{
  candidate: AdaptiveTextLabCase;
  result: AdaptiveTextLayoutResult;
}> = ({candidate, result}) => {
  React.useLayoutEffect(() => {
    if (result.outcome !== 'fit') return;
    const text = document.querySelector<HTMLElement>(
      `[data-adaptive-text-case="${candidate.caseId}"]`,
    );
    const content = document.querySelector<HTMLElement>(
      `[data-adaptive-text-content-case="${candidate.caseId}"]`,
    );
    const protectedNodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-adaptive-protected-case="${candidate.caseId}"]`,
      ),
    );
    if (!text || !content || protectedNodes.length !== candidate.protectedMedia.length) {
      throw new Error(`Adaptive layout audit could not find ${candidate.caseId} boxes`);
    }
    if (content.textContent !== result.displayText) {
      throw new Error(`Adaptive layout text content drift for ${candidate.caseId}`);
    }
    const rootRect = text.parentElement?.getBoundingClientRect();
    if (!rootRect) throw new Error(`Adaptive layout audit has no root for ${candidate.caseId}`);
    const overflowTolerance = 1;
    if (
      content.scrollWidth > content.clientWidth + overflowTolerance ||
      content.scrollHeight > content.clientHeight + overflowTolerance
    ) {
      throw new Error(
        `Adaptive layout text overflow for ${candidate.caseId}: ` +
          `${content.scrollWidth}x${content.scrollHeight} > ` +
          `${content.clientWidth}x${content.clientHeight}`,
      );
    }
    const range = document.createRange();
    range.selectNodeContents(content);
    const lineRects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > overflowTolerance && rect.height > overflowTolerance,
    );
    const lineTops = new Set(lineRects.map((rect) => Math.round(rect.top * 10) / 10));
    if (lineTops.size > result.lineCount) {
      throw new Error(
        `Adaptive layout wrapped beyond diagnosed lines for ${candidate.caseId}: ` +
          `${lineTops.size} > ${result.lineCount}`,
      );
    }
    const textRect = sameRect(content.getBoundingClientRect(), rootRect);
    for (const protectedNode of protectedNodes) {
      const protectedRect = sameRect(protectedNode.getBoundingClientRect(), rootRect);
      if (rectsIntersect(textRect, protectedRect)) {
        throw new Error(`Adaptive layout collision for ${candidate.caseId}`);
      }
    }
  }, [candidate, result]);

  return null;
};

const MediaPlate: React.FC<{candidate: AdaptiveTextLabCase}> = ({candidate}) => (
  <>
    <Img
      src={staticFile(candidate.mediaStaticFileKey)}
      style={{
        position: 'absolute',
        left: candidate.mediaRect.x,
        top: candidate.mediaRect.y,
        width: candidate.mediaRect.width,
        height: candidate.mediaRect.height,
        objectFit: 'cover',
        objectPosition: candidate.mediaObjectPosition,
        filter: 'saturate(.82) contrast(1.04)',
      }}
    />
    {candidate.caseId === 'b-long-alternate-zone' ? (
      <Img
        data-adaptive-protected-case={candidate.caseId}
        src={staticFile('visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')}
        style={{
          position: 'absolute',
          left: 1240,
          top: 90,
          width: 500,
          height: 800,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          filter: 'drop-shadow(0 22px 22px rgba(0,0,0,.42))',
        }}
      />
    ) : null}
    {candidate.caseId !== 'b-long-alternate-zone'
      ? candidate.protectedMedia.map((protectedMedia) => (
          <div
            key={protectedMedia.id}
            data-adaptive-protected-case={candidate.caseId}
            data-protected-id={protectedMedia.id}
            style={{
              position: 'absolute',
              left: protectedMedia.rect.x,
              top: protectedMedia.rect.y,
              width: protectedMedia.rect.width,
              height: protectedMedia.rect.height,
              pointerEvents: 'none',
            }}
          />
        ))
      : null}
  </>
);

const LabText: React.FC<{
  candidate: AdaptiveTextLabCase;
  result: AdaptiveTextLayoutResult;
}> = ({candidate, result}) => {
  if (result.outcome !== 'fit' || !result.textRect || result.fontSize === null) {
    return (
      <div
        data-adaptive-preflight-blocked={candidate.caseId}
        style={{
          position: 'absolute',
          left: 930,
          top: 360,
          width: 840,
          color: '#edb09b',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 3,
          lineHeight: 1.45,
          textTransform: 'uppercase',
        }}
      >
        <div style={{fontSize: 30, letterSpacing: 2}}>Preflight blocked</div>
        <div style={{marginTop: 14, color: '#f3d7c8', fontSize: 17, letterSpacing: 1}}>
          No safe geometry for the supplied copy. Request display copy or a new protected zone.
        </div>
      </div>
    );
  }

  const variant = candidate.variants.find((item) => item.id === result.chosenVariantId);
  return (
    <div
      data-adaptive-text-case={candidate.caseId}
      style={{
        position: 'absolute',
        left: result.textRect.x,
        top: result.textRect.y,
        width: result.textRect.width,
        height: result.textRect.height,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent:
          variant?.verticalAnchor === 'bottom'
            ? 'flex-end'
            : variant?.verticalAnchor === 'center'
              ? 'center'
              : 'flex-start',
        overflow: 'visible',
      }}
    >
      <div
        data-adaptive-text-content-case={candidate.caseId}
        style={{
          width: '100%',
          maxWidth: '100%',
          height: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems:
            variant?.verticalAnchor === 'bottom'
              ? 'flex-end'
              : variant?.verticalAnchor === 'center'
                ? 'center'
                : 'flex-start',
          justifyContent:
            variant?.anchor === 'right'
              ? 'flex-end'
              : variant?.anchor === 'center'
                ? 'center'
                : 'flex-start',
          color: '#f5eee5',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: result.fontSize,
          fontWeight: 700,
          lineHeight: variant?.lineHeight ?? 1.08,
          letterSpacing: -0.5,
          textAlign: variant?.anchor ?? 'left',
          whiteSpace: 'pre-line',
          overflow: 'visible',
          overflowWrap: 'normal',
          wordBreak: 'normal',
          textShadow: '0 3px 18px rgba(0,0,0,.72)',
        }}
      >
        {result.displayText}
      </div>
    </div>
  );
};

const LabScene: React.FC<{candidate: AdaptiveTextLabCase; result: AdaptiveTextLayoutResult; frame: number}> = ({
  candidate,
  result,
  frame,
}) => {
  const sceneProgress = interpolate(
    frame,
    [candidate.sceneStartFrame, candidate.sceneStartFrame + 18],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  return (
    <AbsoluteFill
      data-adaptive-case={candidate.caseId}
      style={{backgroundColor: candidate.backgroundColor, opacity: sceneProgress}}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(112deg, rgba(10,13,16,.92) 0%, rgba(10,13,16,.32) 48%, rgba(10,13,16,.08) 100%)',
        }}
      />
      <MediaPlate candidate={candidate} />
      <div
        style={{
          position: 'absolute',
          left: candidate.anchorSide === 'left' ? 80 : 120,
          top: 58,
          color: '#d7c7b2',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 4,
        }}
      >
        {candidate.label}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 120,
          bottom: 48,
          color: 'rgba(245,238,229,.64)',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 14,
          letterSpacing: 1.6,
        }}
      >
        VISUAL LAB · GEOMETRY PREFLIGHT · SOURCE COPY PRESERVED
      </div>
      <LabText candidate={candidate} result={result} />
      <BrowserLayoutAudit candidate={candidate} result={result} />
    </AbsoluteFill>
  );
};

export const AdaptiveTextLayoutLab: React.FC = () => {
  const frame = useCurrentFrame();
  const candidate = caseForFrame(frame);
  const result = resultForCase(candidate);
  return <LabScene candidate={candidate} result={result} frame={frame} />;
};
