import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

import {WarChessMediaPresentation} from '../canonical/media-presentation';

export const WC08_TWO_LINE_FONT_STILL_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

type FontOption = {
  nameFont: string;
  nameSize: number;
  nameWeight: number;
  nameTracking: number;
  placeFont: string;
  placeWeight: number;
  placeTracking: number;
};

const TwoLineStill: React.FC<FontOption> = (option) => {
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
          paddingTop: 34,
          opacity: amount,
          transform: `translateY(${interpolate(amount, [0, 1], [24, 0], clamp)}px)`,
          color: '#efe5cf',
          textShadow: '0 3px 18px rgba(0,0,0,.85)',
        }}
      >
        <div
          style={{
            fontFamily: option.nameFont,
            fontSize: option.nameSize,
            fontWeight: option.nameWeight,
            letterSpacing: option.nameTracking,
            lineHeight: 0.96,
          }}
        >
          George S. Patton
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: option.placeFont,
            color: '#c8bea9',
            fontSize: 24,
            fontWeight: option.placeWeight,
            letterSpacing: option.placeTracking,
            lineHeight: 1,
          }}
        >
          Sicily
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const WC08TwoLineFuturaStill: React.FC = () => (
  <TwoLineStill
    nameFont="Futura"
    nameSize={60}
    nameWeight={600}
    nameTracking={-0.5}
    placeFont="Avenir Next Condensed"
    placeWeight={600}
    placeTracking={1.2}
  />
);

export const WC08TwoLineOptimaStill: React.FC = () => (
  <TwoLineStill
    nameFont="Optima"
    nameSize={64}
    nameWeight={600}
    nameTracking={0.1}
    placeFont="Avenir Next"
    placeWeight={600}
    placeTracking={1.1}
  />
);

export const WC08TwoLineHoeflerStill: React.FC = () => (
  <TwoLineStill
    nameFont="Hoefler Text"
    nameSize={64}
    nameWeight={700}
    nameTracking={0.1}
    placeFont="Gill Sans"
    placeWeight={600}
    placeTracking={1.2}
  />
);

export const WC08TwoLineIowanStill: React.FC = () => (
  <TwoLineStill
    nameFont="Iowan Old Style"
    nameSize={64}
    nameWeight={700}
    nameTracking={0.1}
    placeFont="Gill Sans"
    placeWeight={600}
    placeTracking={1.2}
  />
);
