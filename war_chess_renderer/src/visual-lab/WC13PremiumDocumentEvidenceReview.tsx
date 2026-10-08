import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

export const WC13_PREMIUM_DOCUMENT_EVIDENCE_REVIEW_DURATION = 180;

const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const asset = 'visual-lab/document-evidence-reveal/grande-armee-29th-bulletin.jpg';
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const premiumEase = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};

export const WC13PremiumDocumentEvidenceReview: React.FC = () => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [4, 24], [0, 1], premiumEase);
  const transition = interpolate(frame, [52, 84], [0, 1], premiumEase);
  const detail = interpolate(frame, [72, 98], [0, 1], premiumEase);
  const fade = interpolate(frame, [0, 8, 160, 179], [0, 1, 1, 0], clamp);
  const documentLeft = interpolate(transition, [0, 1], [680, 170], clamp);
  const documentTop = interpolate(transition, [0, 1], [105, 175], clamp);
  const documentWidth = interpolate(transition, [0, 1], [560, 480], clamp);
  const documentHeight = documentWidth * (1636 / 1280);

  return (
    <AbsoluteFill style={{backgroundColor: '#12100e', color: '#eee3cf', overflow: 'hidden', opacity: fade}}>
      <AbsoluteFill style={{background: 'linear-gradient(135deg, #181512 0%, #0d0c0b 72%, #18130f 100%)'}} />
      <div
        style={{
          position: 'absolute',
          left: documentLeft,
          top: documentTop,
          width: documentWidth,
          height: documentHeight,
          opacity: establish,
          scale: interpolate(establish, [0, 1], [.975, 1], clamp),
          boxShadow: '0 28px 70px rgba(0,0,0,.48)',
        }}
      >
        <Img src={staticFile(asset)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        <div
          style={{
            position: 'absolute',
            left: '17%',
            top: '31%',
            width: '66%',
            height: '34%',
            border: '2px solid #a95848',
            boxSizing: 'border-box',
            opacity: detail,
          }}
        />
      </div>

      <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, width: 1920, height: 1080, opacity: detail}}>
        <path d="M 568 508 C 760 508, 854 322, 1012 322" fill="none" stroke="#a95848" strokeWidth="1.5" opacity=".72" />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 1012,
          top: 96,
          width: 760,
          height: 470,
          overflow: 'hidden',
          border: '1.5px solid rgba(223,202,164,.72)',
          backgroundColor: '#d9c7a8',
          boxShadow: '0 24px 60px rgba(0,0,0,.4)',
          opacity: detail,
          translate: `${interpolate(detail, [0, 1], [36, 0], clamp)}px 0`,
        }}
      >
        <Img
          src={staticFile(asset)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 39%',
            scale: 1.5,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1012,
          top: 630,
          width: 760,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          opacity: detail,
          translate: `${interpolate(detail, [0, 1], [44, 0], clamp)}px 0`,
        }}
      >
        <div style={{fontFamily: sans, fontSize: 18, fontWeight: 700, letterSpacing: 4.8, color: '#a95848'}}>PRIMARY DOCUMENT</div>
        <div style={{marginTop: 20, fontFamily: serif, fontSize: 68, lineHeight: .98, fontWeight: 600, letterSpacing: -.8}}>The official account</div>
        <div style={{marginTop: 22, fontFamily: sans, fontSize: 30, lineHeight: 1.15, fontWeight: 500, color: '#d9cdb9'}}>29th Bulletin of the Grande Armée</div>
        <div style={{marginTop: 14, fontFamily: sans, fontSize: 22, lineHeight: 1, fontWeight: 500, letterSpacing: 1.3, color: '#aa9d89'}}>December 1812</div>
      </div>
    </AbsoluteFill>
  );
};
