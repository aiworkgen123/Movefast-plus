import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {progress} from './motion.ts';
import {kickerPayoffDuration, kickerPayoffTextLimits, repairKickerPayoff, type KickerPayoffProps} from './kicker-payoff-contract.ts';
import {kickerPayoffSpec} from './kicker-payoff-state.ts';
export const KickerPayoff: React.FC<ComponentRenderProps<KickerPayoffProps>> = ({props, skin, context}) => {
  const safe = repairKickerPayoff(props);
  if (!safe || !validContext(context, kickerPayoffDuration)) return null;
  const s = context.width / 1920, look = skin.stage, k = kickerPayoffSpec, t = context.frame / context.fps;
  const letters = Array.from(safe.word.toUpperCase());
  const kFade = progress(t, k.kicker.fade[0], k.kicker.fade[1], 'out-cubic'), drift = (1 - progress(t, k.kicker.fade[0], k.kicker.driftEnd, 'out-cubic')) * k.kicker.drift;
  const ink = `rgba(${look.onMediaRgb},${k.alpha})`;
  const kick = (text: string, dx: number, baseline: number) => <div style={{position: 'absolute', left: dx * s, top: (baseline - 0.95 * k.kicker.size) * s,
    fontFamily: look.italic.family, fontStyle: 'italic', fontWeight: look.italic.weight, fontSize: k.kicker.size * s, lineHeight: 1, whiteSpace: 'pre',
    color: ink, opacity: kFade, transform: `translateX(${drift * s}px)`, textShadow: `0 ${2 * s}px ${8 * s}px rgba(0,0,0,.35)`}}>{text}</div>;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: 0, right: 0, top: (k.word.capTop - 0.149 * k.word.size) * s, textAlign: 'center'}}>
      <div style={{position: 'relative', display: 'inline-block', fontFamily: look.heavy.family, fontWeight: 700, fontSize: k.word.size * s, lineHeight: 1, letterSpacing: `${k.word.tracking}em`, whiteSpace: 'pre'}}>
        {kick(safe.kicker, k.kicker.line1, k.kicker.baseline2 - k.kicker.pitch - (k.word.capTop - 0.149 * k.word.size))}
        {safe.subtitle ? kick(safe.subtitle, k.kicker.line2, k.kicker.baseline2 - (k.word.capTop - 0.149 * k.word.size)) : null}
        {letters.map((ch, i) => {
          const p = progress(t, k.word.start + i * k.word.stagger, k.word.start + i * k.word.stagger + k.word.each, 'out-cubic');
          return <span key={i} style={{display: 'inline-block', color: ink, opacity: p, transform: `translateY(${(1 - p) * k.word.rise * s}px)`}}>{ch}</span>;
        })}
      </div>
    </div>
  </AbsoluteFill>;
};
export const kickerPayoff: VisualComponent<KickerPayoffProps> = {id: 'kicker-payoff', layer: 'fullscreen', duration: kickerPayoffDuration,
  textLimits: kickerPayoffTextLimits, repair: repairKickerPayoff, render: KickerPayoff};
