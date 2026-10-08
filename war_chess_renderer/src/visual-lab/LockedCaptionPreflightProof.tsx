import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  continueRender,
  delayRender,
  useCurrentScale,
} from 'remotion';

import {LockedCaption} from '../WarChessComposition';
import {
  isMeasuredCaptionClipped,
  selectLockedCaption,
  type LockedCaptionPreflightResult,
  type MeasuredCaptionAttempt,
} from '../locked-caption-preflight';
import {CanonicalMediaScene} from '../ported/media-presentation-adapter';
import type {CaptionLayout} from '../ported/caption-hierarchy';
import {
  LOCKED_CAPTION_PREFLIGHT_CASES,
  type LockedCaptionProofCase,
} from './locked-caption-preflight-cases';

const attemptKey = (copy: 'original' | 'shorter', layoutId: string): string =>
  `${copy}:${layoutId}`;

const candidatesFor = (
  candidate: LockedCaptionProofCase,
): Array<{copy: 'original' | 'shorter'; text: string; layoutId: string; layout: CaptionLayout}> => {
  const layoutIds = [candidate.primaryLayoutId, ...(candidate.alternateLayoutIds ?? [])];
  const copies: Array<{copy: 'original' | 'shorter'; text: string}> = [
    {copy: 'original', text: candidate.originalText},
    ...(candidate.shorterText
      ? [{copy: 'shorter' as const, text: candidate.shorterText}]
      : []),
  ];
  return copies.flatMap(({copy, text}) =>
    layoutIds.map((layoutId) => ({
      copy,
      text,
      layoutId,
      layout: candidate.layouts[layoutId]!,
    })),
  );
};

const measure = (
  element: HTMLDivElement,
  root: HTMLDivElement,
  scale: number,
): Pick<MeasuredCaptionAttempt, 'textRect' | 'lineCount' | 'clipped'> => {
  const box = element.getBoundingClientRect();
  const rootBox = root.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(element);
  const lineTops = new Set(
    Array.from(range.getClientRects())
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .map((rect) => Math.round(((rect.top - rootBox.top) / scale) * 10) / 10),
  );
  return {
    textRect: {
      x: (box.left - rootBox.left) / scale,
      y: (box.top - rootBox.top) / scale,
      width: box.width / scale,
      height: box.height / scale,
    },
    lineCount: lineTops.size,
    // Chromium reports extra font overflow below the CSS line box for the
    // locked condensed sans, even for a single fully visible line. Range
    // rects expose the real number of laid-out lines and therefore distinguish
    // normal glyph overflow from a caption hidden by the two-line clamp.
    clipped: isMeasuredCaptionClipped({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      lineCount: lineTops.size,
    }),
  };
};

const GuardedCaption: React.FC<{
  candidate: LockedCaptionProofCase;
  durationInFrames: number;
}> = ({candidate, durationInFrames}) => {
  const scale = useCurrentScale();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [result, setResult] = React.useState<LockedCaptionPreflightResult | null>(null);
  const [handle] = React.useState(() =>
    delayRender(`Measure locked caption ${candidate.caseId}`, {timeoutInMilliseconds: 30000}),
  );
  const attempts = React.useMemo(() => candidatesFor(candidate), [candidate]);

  React.useLayoutEffect(() => {
    let cancelled = false;
    const run = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      const root = rootRef.current;
      if (!root) throw new Error(`Missing caption measurement root for ${candidate.caseId}`);
      const measurements = attempts.map((attempt): MeasuredCaptionAttempt => {
        const element = refs.current[attemptKey(attempt.copy, attempt.layoutId)];
        if (!element) {
          throw new Error(
            `Missing caption measurement ${attempt.copy}:${attempt.layoutId} for ${candidate.caseId}`,
          );
        }
        return {
          copy: attempt.copy,
          text: attempt.text,
          layoutId: attempt.layoutId,
          ...measure(element, root, scale),
        };
      });
      const selected = selectLockedCaption(candidate, measurements);
      setResult(selected);
      requestAnimationFrame(() => continueRender(handle));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [attempts, candidate, handle, scale]);

  const chosenLayout = result?.layoutId ? candidate.layouts[result.layoutId] : null;
  return (
    <div ref={rootRef} style={{position: 'absolute', inset: 0}}>
      <div aria-hidden="true" style={{position: 'absolute', inset: 0, visibility: 'hidden'}}>
        {attempts.map((attempt) => (
          <LockedCaption
            key={attemptKey(attempt.copy, attempt.layoutId)}
            text={attempt.text}
            layout={attempt.layout}
            durationInFrames={durationInFrames}
            textRef={(element) => {
              refs.current[attemptKey(attempt.copy, attempt.layoutId)] = element;
            }}
          />
        ))}
      </div>
      {result?.displayText && chosenLayout ? (
        <LockedCaption
          text={result.displayText}
          layout={chosenLayout}
          durationInFrames={durationInFrames}
        />
      ) : null}
    </div>
  );
};

const ProofScene: React.FC<{candidate: LockedCaptionProofCase}> = ({candidate}) => {
  const captionDuration = candidate.captionEndFrameExclusive - candidate.captionStartFrame;
  return (
    <AbsoluteFill style={{backgroundColor: '#171614'}}>
      <CanonicalMediaScene scene={candidate.scene} />
      <Sequence
        from={candidate.captionStartFrame}
        durationInFrames={captionDuration}
        layout="none"
      >
        <GuardedCaption candidate={candidate} durationInFrames={captionDuration} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const LockedCaptionPreflightProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#171614'}}>
    {LOCKED_CAPTION_PREFLIGHT_CASES.map((candidate) => (
      <Sequence
        key={candidate.caseId}
        from={candidate.startFrame}
        durationInFrames={candidate.endFrameExclusive - candidate.startFrame}
      >
        <ProofScene candidate={candidate} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
