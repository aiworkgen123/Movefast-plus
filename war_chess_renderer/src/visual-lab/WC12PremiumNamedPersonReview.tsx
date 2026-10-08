import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

export const WC12_PREMIUM_NAMED_PERSON_REVIEW_DURATION = 150;

const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const premiumEase = Easing.bezier(0.16, 1, 0.3, 1);

export const WC12PremiumNamedPersonReview: React.FC = () => {
  const frame = useCurrentFrame();
  const backgroundScale = interpolate(
    frame,
    [0, WC12_PREMIUM_NAMED_PERSON_REVIEW_DURATION - 1],
    [1, 1.022],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const subjectEnter = interpolate(frame, [6, 30], [180, 0], {
    easing: premiumEase,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subjectExit = interpolate(frame, [126, 149], [0, 1100], {
    easing: Easing.bezier(0.7, 0, 0.84, 0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subjectOpacity = interpolate(frame, [4, 14, 137, 149], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const copyX = interpolate(frame, [12, 36], [-128, 0], {
    easing: premiumEase,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const copyOpacity = interpolate(frame, [12, 24, 132, 144], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#17120f', overflow: 'hidden'}}>
      <Img
        src={staticFile('visual-lab/historical-documents/campaign-1812.jpg')}
        style={{
          position: 'absolute',
          inset: -20,
          width: 'calc(100% + 40px)',
          height: 'calc(100% + 40px)',
          objectFit: 'cover',
          scale: backgroundScale,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(10,8,7,.82) 0%, rgba(10,8,7,.62) 36%, rgba(10,8,7,.18) 64%, rgba(10,8,7,0) 83%)',
        }}
      />

      <Img
        src={staticFile('visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')}
        style={{
          position: 'absolute',
          right: 210,
          bottom: -18,
          width: 410,
          height: 970,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          translate: `0 ${subjectEnter + subjectExit}px`,
          opacity: subjectOpacity,
          filter: 'drop-shadow(-18px 20px 22px rgba(0,0,0,.32))',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 240,
          width: 870,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          translate: `${copyX}px 0`,
          opacity: copyOpacity,
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 5.2,
            color: '#a74a3e',
            WebkitTextStroke: '.45px #000000',
            paintOrder: 'stroke fill',
          }}
        >
          NAMED PERSON
        </div>
        <div
          style={{
            marginTop: 24,
            whiteSpace: 'pre-line',
            fontFamily: serif,
            fontSize: 104,
            lineHeight: 0.9,
            fontWeight: 600,
            letterSpacing: -1.7,
            color: '#f1e7d3',
            WebkitTextStroke: '1px #000000',
            paintOrder: 'stroke fill',
          }}
        >
          {'Napoleon\nBonaparte'}
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: sans,
            fontSize: 30,
            lineHeight: 1,
            fontWeight: 500,
            letterSpacing: 1.25,
            color: '#e3d8c4',
            WebkitTextStroke: '.6px #000000',
            paintOrder: 'stroke fill',
          }}
        >
          Emperor of the French
        </div>
      </div>
    </AbsoluteFill>
  );
};
