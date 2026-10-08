import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WarChessMediaPresentation} from '../canonical/media-presentation';

export const HISTORICAL_FOOTAGE_PROOF_DURATION = 120;

const HistoricalFootageScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#020202',
        opacity: interpolate(frame, [0, 10, 108, 119], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }}
    >
      <WarChessMediaPresentation
        mediaKind="clip"
        media={{
          path: 'visual-lab/historical-footage/patton-command-context.mp4',
          sha256:
            '113a5aa0211c2aaa7b5c4cabb485694cfc00f9f6c96dfec164ed93b3ebb03d70',
        }}
        durationFrames={120}
        startFromFrames={0}
        sourceWidth={320}
        sourceHeight={240}
        surfaceEffect="vignette"
        surfaceIntensity={0.9}
        presentationEffect="film_dust"
        presentationIntensity={1}
        presentationMode="stay_framed"
        frameAlways
        textOverlay={{
          role: 'identity',
          headline: 'GEORGE S. PATTON',
          supportingText: 'Archival U.S. Army documentary footage',
          emphasisTerms: ['PATTON', 'U.S. Army'],
          placement: {
            x: 0.68,
            y: 0.37,
            width: 0.285,
            height: 0.3,
            align: 'right',
            safeAreaSource: 'visual_lab_reviewed_footage_margin',
            subjectOverlapForbidden: true,
            headlineFontSize: 54,
            supportFontSize: 34,
            headlineLinesMax: 3,
            supportLinesMax: 2,
          },
          animation: {
            enterStartFrame: 10,
            enterDurationFrames: 13,
            exitDurationFrames: 10,
            overshoot: false,
          },
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 42,
          right: 56,
          padding: '11px 16px 9px',
          border: '1px solid rgba(244,242,235,.2)',
          background: 'rgba(0,0,0,.48)',
          color: 'rgba(244,242,235,.72)',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
        }}
      >
        Context footage · not evidence of the desk claim
      </div>
    </AbsoluteFill>
  );
};

/**
 * Review-only proof of the historical-footage family. The clip identifies
 * Patton in a U.S. Army documentary; it does not purport to show the desk or
 * books described by the owner's narration.
 */
export const HistoricalFootageProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#020202'}}>
    <HistoricalFootageScene />
    <Sequence from={26} durationInFrames={50}>
      <Audio
        src={staticFile('visual-lab/historical-footage/patton-line.wav')}
      />
    </Sequence>
  </AbsoluteFill>
);
