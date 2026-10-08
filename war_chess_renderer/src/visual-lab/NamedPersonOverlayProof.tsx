import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const NAMED_PERSON_OVERLAY_DURATION = 165;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const enterEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const exitEase = {
  ...clamp,
  easing: Easing.bezier(0.4, 0, 0.7, 0.2),
};

/**
 * WC12 owner-review proof.
 *
 * The background remains a continuous reviewed base shot. The verified
 * one-person cutout enters after the base is established, remains readable for
 * roughly three seconds, and exits before the base ends. The title uses the
 * owner-approved no-rule editorial typography rather than the retired boxed
 * Literata treatment.
 */
export const NamedPersonOverlayProof: React.FC = () => {
  const frame = useCurrentFrame();
  const baseScale = interpolate(frame, [0, 164], [1.08, 1], clamp);
  const baseOpacity = interpolate(frame, [0, 12, 153, 164], [0, 1, 1, 0], clamp);
  const enter = interpolate(frame, [20, 48], [0, 1], enterEase);
  const leave = interpolate(frame, [126, 148], [0, 1], exitEase);
  const overlayOpacity = enter * (1 - leave);
  const subjectY = interpolate(enter, [0, 1], [1000, 105], clamp) +
    interpolate(leave, [0, 1], [0, 430], clamp);
  const subjectScale = interpolate(enter, [0, 1], [0.93, 1], clamp);
  const copyX = interpolate(enter, [0, 1], [-42, 0], enterEase);

  return (
    <AbsoluteFill style={{backgroundColor: '#0d0c0a', overflow: 'hidden'}}>
      <Img
        src={staticFile('visual-lab/historical-documents/campaign-1812.jpg')}
        style={{
          position: 'absolute',
          inset: -30,
          width: 1980,
          height: 1140,
          objectFit: 'cover',
          scale: baseScale,
          opacity: baseOpacity * 0.74,
          filter: 'grayscale(1) sepia(.28) contrast(.82) brightness(.58)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(10,9,7,.96) 0%, rgba(10,9,7,.79) 34%, rgba(10,9,7,.18) 68%, rgba(10,9,7,.48) 100%), radial-gradient(circle at 66% 42%, rgba(188,151,83,.12), transparent 40%)',
          opacity: baseOpacity,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 1120,
          top: subjectY,
          width: 520,
          height: 980,
          scale: subjectScale,
          opacity: overlayOpacity,
          transformOrigin: '50% 100%',
          filter:
            'drop-shadow(0 25px 18px rgba(0,0,0,.52)) drop-shadow(0 0 1px rgba(239,220,181,.45))',
        }}
      >
        <Img
          src={staticFile('visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')}
          style={{width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 300,
          width: 850,
          opacity: overlayOpacity,
          translate: `${copyX}px 0px`,
          color: '#f0e7d2',
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            color: '#c89a47',
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: 4.6,
          }}
        >
          COMMANDER · CAMPAIGN OF 1812
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 105,
            fontWeight: 700,
            letterSpacing: -2.4,
            lineHeight: 0.9,
          }}
        >
          Napoleon<br />Bonaparte
        </div>
        <div
          style={{
            marginTop: 30,
            maxWidth: 690,
            fontFamily: WC_EDITORIAL_SANS,
            color: '#aaa18e',
            fontSize: 25,
            fontWeight: 500,
            letterSpacing: 0.6,
            lineHeight: 1.42,
          }}
        >
          One verified identity. Briefly established, then the underlying story continues.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 66,
          bottom: 40,
          color: '#777264',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 14,
          letterSpacing: 3,
          opacity: baseOpacity,
        }}
      >
        DESIGN PROOF
      </div>
    </AbsoluteFill>
  );
};
