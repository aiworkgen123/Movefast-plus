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

export const DOCUMENT_EVIDENCE_REVEAL_DURATION = 180;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const documentSource = staticFile(
  'visual-lab/document-evidence-reveal/grande-armee-29th-bulletin.jpg',
);

/**
 * Review-only proof for an exact document, letter, order, newspaper, map, or
 * other evidence artifact. The full source remains visible while a crop shows
 * the exact region being discussed. Copy describes the artifact; it does not
 * turn a document into proof of claims outside its reviewed scope.
 */
export const DocumentEvidenceRevealProof: React.FC = () => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [0, 22], [0, 1], ease);
  const move = interpolate(frame, [24, 68], [0, 1], ease);
  const detail = interpolate(frame, [51, 91], [0, 1], ease);
  const copy = interpolate(frame, [72, 106], [0, 1], ease);
  const source = interpolate(frame, [95, 120], [0, 1], ease);
  const fade = interpolate(frame, [0, 8, 168, 179], [0, 1, 1, 0], clamp);
  const pageX = interpolate(move, [0, 1], [558, 150]);
  const pageScale = interpolate(move, [0, 1], [0.97, 0.91]);
  const connectorWidth = interpolate(detail, [0, 1], [0, 150]);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        opacity: fade,
        color: '#f1eadc',
        background:
          'radial-gradient(circle at 22% 45%, #2c2119 0, #15100d 38%, #090807 76%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            'repeating-linear-gradient(7deg, transparent 0 5px, rgba(255,255,255,.035) 6px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: pageX,
          top: 70,
          width: 742,
          height: 946,
          transform: `scale(${pageScale}) rotate(${interpolate(move, [0, 1], [-0.4, -1.15])}deg)`,
          transformOrigin: '50% 50%',
          opacity: establish,
          overflow: 'hidden',
          border: '1px solid rgba(234,220,195,.34)',
          boxShadow: '0 34px 88px rgba(0,0,0,.62)',
          background: '#d6c5a3',
        }}
      >
        <Img
          src={documentSource}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 123,
          width: connectorWidth,
          height: 1,
          background: 'rgba(157,59,48,.92)',
          transformOrigin: 'left center',
          opacity: detail,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 754,
          top: 107,
          width: 33,
          height: 33,
          border: '2px solid #9d3b30',
          borderRadius: '50%',
          scale: detail,
          opacity: detail,
          boxShadow: '0 0 0 6px rgba(157,59,48,.13)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 920,
          top: 64,
          width: 840,
          height: 356,
          overflow: 'hidden',
          clipPath: `inset(0 ${interpolate(detail, [0, 1], [100, 0])}% 0 0)`,
          boxShadow: '0 26px 70px rgba(0,0,0,.5)',
          background: '#d5c29d',
        }}
      >
        <Img
          src={documentSource}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 8%',
            transform: `scale(${interpolate(frame, [50, 179], [1.04, 1.1], clamp)})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 1px rgba(247,234,207,.28)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 938,
          top: 474,
          width: 760,
          opacity: copy,
          transform: `translateY(${interpolate(copy, [0, 1], [35, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 5.1,
            color: '#c88678',
            textTransform: 'uppercase',
          }}
        >
          PRIMARY DOCUMENT · DECEMBER 1812
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 0.91,
            letterSpacing: -2.8,
          }}
        >
          The official
          <br />
          account
        </div>
        <div
          style={{
            marginTop: 34,
            maxWidth: 620,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 28,
            fontWeight: 550,
            lineHeight: 1.32,
            letterSpacing: 0.7,
            color: 'rgba(241,234,220,.72)',
          }}
        >
          Show the whole artifact, then isolate only the exact region the
          narration is using.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 938,
          bottom: 68,
          opacity: source,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 17,
          fontWeight: 750,
          letterSpacing: 3.2,
          color: 'rgba(241,234,220,.48)',
          textTransform: 'uppercase',
        }}
      >
        29th Bulletin of the Grande Armée · Public-domain scan
      </div>
    </AbsoluteFill>
  );
};
