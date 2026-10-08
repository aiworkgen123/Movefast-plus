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

export const ARCHIVAL_DETAIL_SEQUENCE_DURATION = 180;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const source = staticFile('visual-lab/historical-documents/napoleon-study.jpg');

const DetailSlice: React.FC<{
  from: number;
  left: number;
  width: number;
  objectPosition: string;
  label: string;
  startScale: number;
  endScale: number;
}> = ({from, left, width, objectPosition, label, startScale, endScale}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [from, from + 24], [0, 1], ease);
  const labelReveal = interpolate(frame, [from + 14, from + 32], [0, 1], ease);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 112,
        width,
        height: 786,
        overflow: 'hidden',
        clipPath: `inset(${interpolate(reveal, [0, 1], [50, 0])}% 0 ${interpolate(
          reveal,
          [0, 1],
          [50, 0],
        )}% 0)`,
        opacity: reveal,
        translate: `0 ${interpolate(reveal, [0, 1], [34, 0])}px`,
        boxShadow: '0 30px 70px rgba(0,0,0,.48)',
      }}
    >
      <Img
        src={source}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          transformOrigin: objectPosition,
          scale: interpolate(frame, [from, 179], [startScale, endScale], clamp),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          background: 'linear-gradient(transparent, rgba(10,8,7,.86))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 30,
          bottom: 25,
          opacity: labelReveal,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 4.8,
          color: 'rgba(247,239,225,.78)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
};

/**
 * Review-only multi-detail treatment for one verified painting, engraving,
 * photograph, map, or artifact image. The labels must describe visible,
 * reviewed regions of the same source; they cannot add unseen facts.
 */
export const ArchivalDetailSequenceProof: React.FC = () => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [0, 20], [0, 1], ease);
  const arrange = interpolate(frame, [30, 65], [0, 1], ease);
  const title = interpolate(frame, [92, 123], [0, 1], ease);
  const fade = interpolate(frame, [0, 7, 169, 179], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        opacity: fade,
        color: '#f3ead9',
        background: '#0c0907',
      }}
    >
      <Img
        src={source}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '50% 32%',
          opacity: establish * interpolate(arrange, [0, 1], [0.9, 0.2]),
          scale: interpolate(frame, [0, 179], [1.02, 1.11], clamp),
          filter: `blur(${interpolate(arrange, [0, 1], [0, 13])}px) brightness(${interpolate(
            arrange,
            [0, 1],
            [0.74, 0.4],
          )})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(8,6,5,.78), rgba(8,6,5,.08) 32%, rgba(8,6,5,.2) 72%, rgba(8,6,5,.82))',
          opacity: arrange,
        }}
      />

      <DetailSlice
        from={25}
        left={120}
        width={650}
        objectPosition="49% 27%"
        label="The subject"
        startScale={1.22}
        endScale={1.16}
      />
      <DetailSlice
        from={45}
        left={796}
        width={414}
        objectPosition="87% 8%"
        label="The clock"
        startScale={3.05}
        endScale={2.88}
      />
      <DetailSlice
        from={65}
        left={1236}
        width={564}
        objectPosition="84% 72%"
        label="The working desk"
        startScale={2.2}
        endScale={2.08}
      />

      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          bottom: 55,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 80,
          opacity: title,
          translate: `0 ${interpolate(title, [0, 1], [26, 0])}px`,
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 67,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: -1.8,
          }}
        >
          The Emperor in His Study
        </div>
        <div
          style={{
            paddingBottom: 6,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 4.4,
            color: 'rgba(243,234,217,.55)',
            textAlign: 'right',
            textTransform: 'uppercase',
          }}
        >
          Identified painting · Jacques-Louis David · 1812
        </div>
      </div>
    </AbsoluteFill>
  );
};
