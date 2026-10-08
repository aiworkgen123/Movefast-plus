import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WarChessMediaPresentation} from '../canonical/media-presentation';

export const WC08_PREMIUM_FONT_COMPARISON_DURATION = 450;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const variants = [
  {
    marker: 'A · DIDOT',
    identityFont: 'Didot',
    identitySize: 66,
    identityWeight: 700,
    identityTracking: 0.1,
    detailFont: 'Avenir Next Condensed',
    detailWeight: 700,
    detailTracking: 4.2,
  },
  {
    marker: 'B · AVENIR',
    identityFont: 'Avenir Next',
    identitySize: 59,
    identityWeight: 600,
    identityTracking: -0.7,
    detailFont: 'Avenir Next Condensed',
    detailWeight: 700,
    detailTracking: 4,
  },
  {
    marker: 'C · BASKERVILLE',
    identityFont: 'Baskerville',
    identitySize: 64,
    identityWeight: 600,
    identityTracking: 0.1,
    detailFont: 'Gill Sans',
    detailWeight: 600,
    detailTracking: 4.4,
  },
] as const;

const FontVersion: React.FC<{variant: (typeof variants)[number]}> = ({variant}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [10, 30], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit = interpolate(frame, [132, 149], [1, 0], clamp);
  const amount = Math.min(enter, exit);

  return (
    <AbsoluteFill style={{backgroundColor: '#0d0d0b'}}>
      <WarChessMediaPresentation
        mediaKind="still"
        media={{
          path: 'visual-lab/factual-owner-cut/patton-1943.jpg',
          sha256: '12533dbe8c6f1b388cd23e40dddf6693b16e3058551a062190736095f1961fab',
        }}
        durationFrames={150}
        startFromFrames={0}
        sourceWidth={1120}
        sourceHeight={1400}
        surfaceEffect="fine_35mm_grain"
        surfaceIntensity={0.9}
        presentationEffect="film_dust"
        presentationIntensity={1}
        presentationMode="stay_framed"
        frameAlways
        frameTreatment={{
          style: 'animated_signal_yellow',
          reason: 'solo_person_reveal',
          visibleSubject: 'uniformed man',
          evidenceHash: '1'.repeat(64),
        }}
        textOverlay={null}
      />
      <div
        style={{
          position: 'absolute',
          left: 94,
          bottom: 82,
          width: 770,
          opacity: amount,
          transform: `translateY(${interpolate(amount, [0, 1], [24, 0], clamp)}px)`,
          color: '#efe5cf',
          textShadow: '0 3px 18px rgba(0,0,0,.85)',
        }}
      >
        <div
          style={{
            fontFamily: variant.detailFont,
            color: '#c89a47',
            fontSize: 18,
            fontWeight: variant.detailWeight,
            letterSpacing: variant.detailTracking,
          }}
        >
          IDENTITY · NARRATED SETTING
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: variant.identityFont,
            fontSize: variant.identitySize,
            fontWeight: variant.identityWeight,
            letterSpacing: variant.identityTracking,
            lineHeight: 0.96,
          }}
        >
          George S. Patton
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: variant.detailFont,
            color: '#c8bea9',
            fontSize: 24,
            fontWeight: variant.detailWeight,
            letterSpacing: 1.2,
          }}
        >
          Sicily
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 38,
          right: 48,
          color: 'rgba(239,229,207,.68)',
          fontFamily: 'Arial, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2.4,
        }}
      >
        {variant.marker}
      </div>
    </AbsoluteFill>
  );
};

export const WC08PremiumFontComparisonProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#0d0d0b'}}>
    <Audio src={staticFile('visual-lab/factual-owner-cut/voiceover-62.9s.wav')} />
    {variants.map((variant, index) => (
      <Sequence key={variant.marker} from={index * 150} durationInFrames={150} premountFor={30}>
        <FontVersion variant={variant} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
