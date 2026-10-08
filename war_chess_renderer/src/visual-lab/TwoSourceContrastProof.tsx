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

export const TWO_SOURCE_CONTRAST_DURATION = 180;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const bulletin = staticFile(
  'visual-lab/document-evidence-reveal/grande-armee-29th-bulletin.jpg',
);
const retreat = staticFile(
  'visual-lab/two-source-contrast/ary-scheffer-retreat-1826.jpg',
);

/**
 * Review-only contrast treatment for exactly two separately verified sources.
 * The two images remain visually and semantically distinct: labels identify
 * source type and date without implying that an artwork is documentary proof.
 */
export const TwoSourceContrastProof: React.FC = () => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [0, 22], [0, 1], ease);
  const compare = interpolate(frame, [38, 84], [0, 1], ease);
  const paintingReveal = interpolate(frame, [54, 96], [0, 1], ease);
  const titleReveal = interpolate(frame, [82, 116], [0, 1], ease);
  const sourceReveal = interpolate(frame, [108, 137], [0, 1], ease);
  const fade = interpolate(frame, [0, 7, 169, 179], [0, 1, 1, 0], clamp);

  const documentLeft = interpolate(compare, [0, 1], [530, 112]);
  const documentTop = interpolate(compare, [0, 1], [52, 126]);
  const documentWidth = interpolate(compare, [0, 1], [860, 620]);
  const documentHeight = interpolate(compare, [0, 1], [976, 828]);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        opacity: fade,
        color: '#f4ebda',
        background:
          'radial-gradient(circle at 20% 45%, #2b2119 0, #12100e 42%, #080807 80%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.11,
          backgroundImage:
            'repeating-linear-gradient(7deg, transparent 0 5px, rgba(255,255,255,.032) 6px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 76,
          width: 1030,
          height: 830,
          overflow: 'hidden',
          opacity: paintingReveal,
          clipPath: `inset(0 ${interpolate(paintingReveal, [0, 1], [100, 0])}% 0 0)`,
          boxShadow: '0 34px 88px rgba(0,0,0,.54)',
          background: '#101211',
        }}
      >
        <Img
          src={retreat}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '53% 50%',
            scale: interpolate(frame, [55, 179], [1.04, 1.1], clamp),
            filter: 'brightness(1.22) contrast(1.01) saturate(.88)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(7,9,9,.36) 0%, transparent 32%, rgba(7,7,6,.06) 72%, rgba(7,7,6,.46) 100%)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: documentLeft,
          top: documentTop,
          width: documentWidth,
          height: documentHeight,
          overflow: 'hidden',
          opacity: establish,
          transform: `rotate(${interpolate(compare, [0, 1], [-0.35, -1.2])}deg)`,
          boxShadow: '0 32px 82px rgba(0,0,0,.65)',
          background: '#d3c29f',
        }}
      >
        <Img
          src={bulletin}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 1px rgba(245,231,203,.28)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: interpolate(compare, [0, 1], [120, 820]),
          top: interpolate(compare, [0, 1], [95, 118]),
          width: 890,
          opacity: interpolate(compare, [0, 0.7, 1], [0, 0, titleReveal]),
          transform: `translateY(${interpolate(titleReveal, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: 4.8,
            color: '#c88a78',
            textTransform: 'uppercase',
          }}
        >
          RETREAT IN ART · ARY SCHEFFER · 1826
        </div>
        <div
          style={{
            marginTop: 19,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 102,
            fontWeight: 700,
            lineHeight: 0.88,
            letterSpacing: -3.1,
            textShadow: '0 8px 28px rgba(0,0,0,.5)',
          }}
        >
          The retreat
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: interpolate(compare, [0, 1], [690, 112]),
          bottom: 60,
          width: 620,
          opacity: interpolate(compare, [0, 0.55, 1], [establish, 0, sourceReveal]),
          transform: `translateY(${interpolate(sourceReveal, [0, 1], [18, 0])}px)`,
          fontFamily: WC_EDITORIAL_SANS,
          textTransform: 'uppercase',
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: 4.6,
            color: '#c88a78',
          }}
        >
          Official bulletin · December 1812
        </div>
        <div
          style={{
            marginTop: 11,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2.7,
            color: 'rgba(244,235,218,.46)',
          }}
        >
          Primary document
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 100,
          bottom: 60,
          width: 700,
          opacity: sourceReveal,
          textAlign: 'right',
          transform: `translateY(${interpolate(sourceReveal, [0, 1], [18, 0])}px)`,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2.5,
          color: 'rgba(244,235,218,.48)',
          textTransform: 'uppercase',
        }}
      >
        Identified painting · Public-domain museum image
      </div>
    </AbsoluteFill>
  );
};
