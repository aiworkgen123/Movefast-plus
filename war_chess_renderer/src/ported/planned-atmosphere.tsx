import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

import type {RenderScene} from '../schema';

type Effect = Extract<RenderScene, {kind: 'animated_still'}>['treatment']['presentationEffect'];

const seeded = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.17 + salt * 37.31) * 43758.5453;
  return value - Math.floor(value);
};

/** The long planned-scene path needs atmosphere above its full-frame media. */
export const PlannedAtmosphere: React.FC<{effect: Effect}> = ({effect}) => {
  const frame = useCurrentFrame();

  if (effect === 'snowfall') {
    return (
      <AbsoluteFill style={{pointerEvents: 'none', backgroundColor: 'rgba(185,207,226,.075)'}}>
        {Array.from({length: 120}, (_, index) => (
          <div key={index} style={{
            position: 'absolute',
            left: `${seeded(index, 1) * 100 + Math.sin(frame * 0.025 + index) * 1.5}%`,
            top: `${(seeded(index, 2) * 130 + frame * (0.16 + seeded(index, 3) * 0.22)) % 130 - 15}%`,
            width: 5 + seeded(index, 4) * 9,
            height: 7 + seeded(index, 5) * 12,
            borderRadius: '50%',
            backgroundColor: '#fff',
            opacity: 0.4 + seeded(index, 6) * 0.4,
            filter: `blur(${seeded(index, 7) * 1.2}px)`,
          }} />
        ))}
      </AbsoluteFill>
    );
  }

  if (effect === 'smoke_ash') {
    return (
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        {Array.from({length: 7}, (_, index) => (
          <div key={`smoke-${index}`} style={{
            position: 'absolute',
            left: `${-12 + seeded(index, 21) * 85 + frame * (0.008 + seeded(index, 22) * 0.006)}%`,
            top: `${8 + seeded(index, 23) * 70 + Math.sin(frame * 0.009 + index) * 2}%`,
            width: `${30 + seeded(index, 24) * 22}%`,
            height: `${24 + seeded(index, 25) * 20}%`,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(220,215,200,.85), rgba(137,132,120,.3) 48%, transparent 72%)',
            opacity: 0.32 + seeded(index, 26) * 0.18,
            filter: 'blur(28px)',
          }} />
        ))}
        {Array.from({length: 90}, (_, index) => (
          <div key={`ash-${index}`} style={{
            position: 'absolute',
            left: `${seeded(index, 31) * 100 + Math.sin(frame * 0.018 + index) * 1.5}%`,
            top: `${(seeded(index, 32) * 120 + frame * (0.07 + seeded(index, 33) * 0.12)) % 120 - 10}%`,
            width: 4 + seeded(index, 34) * 7,
            height: 3 + seeded(index, 35) * 5,
            borderRadius: '50%',
            backgroundColor: '#d7d1c2',
            opacity: 0.35 + seeded(index, 36) * 0.4,
            rotate: `${frame * 0.55 + index * 13}deg`,
          }} />
        ))}
      </AbsoluteFill>
    );
  }

  return null;
};
