import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const WC15_PREMIUM_TWO_SOURCE_CONTRAST_REVIEW_DURATION = 180;

const bulletin = 'visual-lab/document-evidence-reveal/grande-armee-29th-bulletin.jpg';
const painting = 'visual-lab/two-source-contrast/ary-scheffer-retreat-1826.jpg';
const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const premiumEase = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};

const SourceLabel: React.FC<{eyebrow: string; date: string; kind: string}> = ({eyebrow, date, kind}) => (
  <div style={{position: 'absolute', left: 34, right: 34, bottom: 28, color: '#f0e5d2'}}>
    <div style={{fontFamily: sans, fontSize: 19, fontWeight: 700, letterSpacing: 4.2, color: '#cfaa72'}}>{eyebrow}</div>
    <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 9}}>
      <div style={{fontFamily: serif, fontSize: 43, lineHeight: 1, fontWeight: 600}}>{date}</div>
      <div style={{fontFamily: sans, fontSize: 23, lineHeight: 1, fontWeight: 500, letterSpacing: .8, color: '#beb1a0'}}>{kind}</div>
    </div>
  </div>
);

export const WC15PremiumTwoSourceContrastReview: React.FC = () => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [4, 22], [0, 1], premiumEase);
  const compare = interpolate(frame, [44, 74], [0, 1], premiumEase);
  const rightReveal = interpolate(frame, [70, 98], [0, 1], premiumEase);
  const contentFade = interpolate(frame, [0, 8, 160, 179], [0, 1, 1, 0], clamp);
  const panelTop = 224;
  const panelWidth = 812;
  const panelHeight = 674;

  return (
    <AbsoluteFill style={{backgroundColor: '#100e0d', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, opacity: contentFade}}>
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 94,
            translate: '-50% 0',
            opacity: compare,
            fontFamily: serif,
            fontSize: 68,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: -.5,
            color: '#f0e5d2',
          }}
        >
          Record and representation
        </div>

        <div
          style={{
            position: 'absolute',
            left: interpolate(compare, [0, 1], [650, 112], clamp),
            top: interpolate(compare, [0, 1], [90, panelTop], clamp),
            width: interpolate(compare, [0, 1], [620, panelWidth], clamp),
            height: interpolate(compare, [0, 1], [792, panelHeight], clamp),
            opacity: establish,
            overflow: 'hidden',
            backgroundColor: '#181411',
            border: '1px solid rgba(211,188,151,.38)',
            boxShadow: '0 28px 70px rgba(0,0,0,.46)',
          }}
        >
          <Img src={staticFile(bulletin)} style={{width: '100%', height: '100%', objectFit: 'contain', padding: compare * 22, boxSizing: 'border-box'}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 154, opacity: compare, background: 'linear-gradient(0deg, rgba(10,8,7,.98) 0%, rgba(10,8,7,.72) 58%, rgba(10,8,7,0) 100%)'}} />
          <div style={{opacity: compare}}><SourceLabel eyebrow="OFFICIAL BULLETIN" date="December 1812" kind="Primary document" /></div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 996,
            top: panelTop,
            width: panelWidth,
            height: panelHeight,
            opacity: rightReveal,
            translate: `${interpolate(rightReveal, [0, 1], [42, 0], clamp)}px 0`,
            overflow: 'hidden',
            backgroundColor: '#181411',
            border: '1px solid rgba(211,188,151,.38)',
            boxShadow: '0 28px 70px rgba(0,0,0,.46)',
          }}
        >
          <Img
            src={staticFile(painting)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${interpolate(frame, [70, 160], [50, 54], clamp)}% 49%`,
              scale: interpolate(frame, [70, 160], [1.02, 1.055], clamp),
            }}
          />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 154, background: 'linear-gradient(0deg, rgba(10,8,7,.98) 0%, rgba(10,8,7,.72) 58%, rgba(10,8,7,0) 100%)'}} />
          <SourceLabel eyebrow="RETREAT IN ART" date="1826" kind="Painting" />
        </div>

        <div style={{position: 'absolute', left: 958, top: panelTop + 18, width: 1, height: panelHeight - 36, opacity: compare * rightReveal, backgroundColor: 'rgba(199,166,117,.44)'}} />
      </div>
    </AbsoluteFill>
  );
};
