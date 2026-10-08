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

export const VERIFIED_STATISTIC_OVERLAY_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

/**
 * WC09 owner-review proof. Exactly one numeric fact is shown over continuous
 * useful media. The value and source line occupy separate, readable slots and
 * use the approved no-rule editorial typography.
 */
export const VerifiedStatisticOverlayProof: React.FC = () => {
  const frame = useCurrentFrame();
  const baseOpacity = interpolate(frame, [0, 10, 139, 149], [0, 1, 1, 0], clamp);
  const enter = interpolate(frame, [18, 42], [0, 1], ease);
  const exit = interpolate(frame, [122, 143], [1, 0], clamp);
  const amount = Math.min(enter, exit);
  const imageScale = interpolate(frame, [0, 149], [1.055, 1], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: '#080807', overflow: 'hidden'}}>
      <Img
        src={staticFile('visual-lab/historical-media/patton.jpg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '66% 34%',
          scale: imageScale,
          opacity: baseOpacity * 0.9,
          filter: 'grayscale(.72) sepia(.08) contrast(1.12) brightness(.86)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: baseOpacity,
          background:
            'linear-gradient(90deg, rgba(8,8,7,.93) 0%, rgba(8,8,7,.72) 34%, rgba(8,8,7,.18) 61%, rgba(8,8,7,.03) 100%), radial-gradient(circle at 28% 54%, rgba(194,151,70,.09), transparent 35%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 200,
          width: 760,
          opacity: amount,
          translate: `${interpolate(enter, [0, 1], [-38, 0], clamp)}px 0px`,
          color: '#f0e7d2',
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            color: '#c89a47',
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: 4.8,
          }}
        >
          VERIFIED STATISTIC
        </div>
        <div
          style={{
            marginTop: 20,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 178,
            fontWeight: 700,
            letterSpacing: -5,
            lineHeight: 0.86,
          }}
        >
          4
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -1.8,
            lineHeight: 0.95,
          }}
        >
          DAYS
        </div>
        <div
          style={{
            marginTop: 32,
            maxWidth: 625,
            fontFamily: WC_EDITORIAL_SANS,
            color: '#b6ad99',
            fontSize: 27,
            fontWeight: 500,
            lineHeight: 1.38,
            letterSpacing: 0.4,
          }}
        >
          One decisive operational window.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 108,
          bottom: 64,
          maxWidth: 760,
          opacity: amount,
          fontFamily: WC_EDITORIAL_SANS,
          color: '#8d8778',
          fontSize: 16,
          lineHeight: 1.35,
          letterSpacing: 1.35,
        }}
      >
        ILLUSTRATIVE VALUE · PRODUCTION REQUIRES A VERIFIED SOURCE CLAIM
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
