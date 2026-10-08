import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {filmBurnDuration, repairFilmBurn, type FilmBurnProps} from './film-burn-contract.ts';
import {filmBurnState} from './film-burn-state.ts';
/** Screen-blended over the cut; deterministic for a given seed. */
export const FilmBurn: React.FC<ComponentRenderProps<FilmBurnProps>> = ({props, skin, context}) => {
  const safe = repairFilmBurn(props);
  if (!safe || !validContext(context, filmBurnDuration)) return null;
  const st = filmBurnState(context), [yellow, orange, green] = skin.stage.burn, w = context.width, h = context.height;
  const colour = [yellow, orange, green][st.tone];
  const r = (k: string) => random(`${safe.seed}-${k}`);
  const scratchX = (0.6 + 0.25 * r('x')) * w;
  return <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}} aria-hidden="true">
      <defs>
        <radialGradient id={`burn-hot-${safe.seed}`} cx={0.3 + 0.4 * r('hx')} cy={0.4 + 0.2 * r('hy')} r="0.9">
          <stop offset="0" stopColor={st.flash ? '#FFF6D8' : colour} />
          <stop offset="0.6" stopColor={colour} />
          <stop offset="1" stopColor={orange} />
        </radialGradient>
        <linearGradient id={`burn-band-${safe.seed}`} x1="0" x2="1">
          <stop offset="0" stopColor={yellow} />
          <stop offset="0.75" stopColor={orange} />
          <stop offset="1" stopColor={orange} stopOpacity="0" />
        </linearGradient>
      </defs>
      {st.wash > 0 ? <rect width={w} height={h} fill={`url(#burn-hot-${safe.seed})`} opacity={st.wash} /> : null}
      {st.band > 0 ? <rect width={st.bandEdge * w} height={h} fill={`url(#burn-band-${safe.seed})`} opacity={st.band} /> : null}
      {st.band > 0 ? <rect x={st.bandEdge * w - 3} width={3} height={h} fill={skin.stage.scratch} opacity={st.band * 0.8} /> : null}
      {st.scratches ? <g stroke={skin.stage.scratch} fill="none" strokeWidth={3} opacity={0.85}>
        <path d={`M${scratchX} 0 L${scratchX + 6} ${h}`} />
        <path d={`M${scratchX + 0.08 * w} ${0.15 * h} c${-0.06 * w} ${0.1 * h} ${0.05 * w} ${0.2 * h} ${-0.02 * w} ${0.3 * h} s${-0.05 * w} ${0.25 * h} ${0.03 * w} ${0.4 * h}`} />
      </g> : null}
    </svg>
  </AbsoluteFill>;
};
export const filmBurn: VisualComponent<FilmBurnProps> = {id: 'film-burn', layer: 'overlay', duration: filmBurnDuration,
  textLimits: {}, repair: repairFilmBurn, render: FilmBurn};
