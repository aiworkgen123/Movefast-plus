import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

export const WC14_PREMIUM_ARCHIVAL_DETAIL_REVIEW_DURATION = 180;

const asset = 'visual-lab/historical-documents/napoleon-study.jpg';
const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const premiumEase = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};

const details = [
  {label: 'PORTRAIT', imageWidth: 1500, imageLeft: -470, imageTop: -90, from: 56},
  {label: 'CLOCK', imageWidth: 2000, imageLeft: -1320, imageTop: 0, from: 82},
  {label: 'DESK AND PAPERS', imageWidth: 1500, imageLeft: -930, imageTop: -1035, from: 108},
] as const;

export const WC14PremiumArchivalDetailReview: React.FC = () => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [4, 22], [0, 1], premiumEase);
  const shift = interpolate(frame, [38, 62], [0, 1], premiumEase);
  const fade = interpolate(frame, [0, 8, 160, 179], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: '#100e0c', color: '#eee3cf', overflow: 'hidden', opacity: fade}}>
      <Img
        src={staticFile(asset)}
        style={{
          position: 'absolute',
          inset: -24,
          width: 1968,
          height: 1128,
          objectFit: 'cover',
          objectPosition: '50% 33%',
          scale: interpolate(frame, [38, 179], [1.02, 1.055], clamp),
          filter: 'blur(9px) brightness(.46)',
          opacity: shift,
        }}
      />
      <AbsoluteFill style={{backgroundColor: 'rgba(12,10,9,.2)', opacity: shift}} />

      <div
        style={{
          position: 'absolute',
          left: 704,
          top: 70,
          width: 512,
          height: 855,
          opacity: establish * (1 - shift),
          scale: interpolate(establish, [0, 1], [.98, 1], clamp),
          boxShadow: '0 32px 80px rgba(0,0,0,.5)',
        }}
      >
        <Img src={staticFile(asset)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>

      {details.map((detail, index) => {
        const amount = interpolate(frame, [detail.from, detail.from + 22], [0, 1], premiumEase);
        return (
          <div
            key={detail.label}
            style={{
              position: 'absolute',
              left: 112 + index * 570,
              top: 150,
              width: 536,
              height: 625,
              overflow: 'hidden',
              opacity: amount,
              translate: `0 ${interpolate(amount, [0, 1], [34, 0], clamp)}px`,
              border: '1px solid rgba(224,207,177,.58)',
              boxShadow: '0 24px 55px rgba(0,0,0,.42)',
              backgroundColor: '#17120f',
            }}
          >
            <Img
              src={staticFile(asset)}
              style={{
                position: 'absolute',
                left: detail.imageLeft,
                top: detail.imageTop,
                width: detail.imageWidth,
                height: detail.imageWidth * (5135 / 3079),
                maxWidth: 'none',
                objectFit: 'contain',
              }}
            />
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 116, background: 'linear-gradient(0deg, rgba(8,7,6,.9), rgba(8,7,6,0))'}} />
            <div style={{position: 'absolute', left: 28, right: 28, bottom: 24, fontFamily: sans, fontSize: 18, fontWeight: 700, letterSpacing: 4.4, color: '#d2b175'}}>{detail.label}</div>
          </div>
        );
      })}

      <div style={{position: 'absolute', left: 112, right: 112, top: 832, opacity: interpolate(frame, [104, 128], [0, 1], premiumEase), display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 48}}>
        <div style={{fontFamily: serif, fontSize: 64, lineHeight: 1, fontWeight: 600, letterSpacing: -.7}}>The Emperor in His Study</div>
        <div style={{fontFamily: sans, fontSize: 26, lineHeight: 1, fontWeight: 500, letterSpacing: 1.1, color: '#b8aa96'}}>Jacques-Louis David · 1812</div>
      </div>
    </AbsoluteFill>
  );
};
