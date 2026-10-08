import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {bowedFadeStops, gridPath, gridSpec, type GridVariant} from './grid-stage-state.ts';

/** Full-frame grid background shared by the Construction Legends edits. Static: it never moves. */
export const GridStage: React.FC<{skin: Skin; context: FrameContext; variant: GridVariant; line?: string}> = ({skin, context, variant, line}) => {
  const look = {...skin.stage[variant], ...(line ? {line} : {})}, {width, height} = context, id = `grid-fade-${skin.id}-${variant}`;
  return <AbsoluteFill style={{backgroundColor: look.background}}>
    <svg width={width} height={height} viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}} aria-hidden="true">
      {variant === 'bowed' ? <defs>
        <radialGradient id={`${id}-g`} cx="0.5" cy="0.5" r="0.66">
          {bowedFadeStops.map(([offset, opacity]) => <stop key={offset} offset={offset} stopColor="white" stopOpacity={opacity} />)}
        </radialGradient>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <rect width="1920" height="1080" fill={`url(#${id}-g)`} />
        </mask>
      </defs> : null}
      <path d={gridPath(variant)} fill="none" stroke={look.line}
        strokeWidth={gridSpec[variant].stroke} mask={variant === 'bowed' ? `url(#${id})` : undefined} />
    </svg>
  </AbsoluteFill>;
};
