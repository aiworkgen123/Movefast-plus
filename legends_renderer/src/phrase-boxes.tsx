import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {phraseBoxesDuration, phraseBoxesTextLimits, repairPhraseBoxes, type PhraseBoxesProps} from './phrase-boxes-contract.ts';
import {phraseBoxesSpec as k, phraseStartTimes, phraseWipe} from './phrase-boxes-state.ts';
export const PhraseBoxes: React.FC<ComponentRenderProps<PhraseBoxesProps>> = ({props, skin, context}) => {
  const safe = repairPhraseBoxes(props);
  if (!safe || !validContext(context, phraseBoxesDuration)) return null;
  const s = context.width / 1920, look = skin.stage, t = context.frame / context.fps, starts = phraseStartTimes(safe.phrases.length, safe.phraseStarts);
  const g = k.grid, mask = `radial-gradient(circle at ${g.x * s}px ${g.y * s}px, #000 0, #000 ${g.radius * 0.35 * s}px, transparent ${g.radius * s}px)`;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <AbsoluteFill style={{backgroundImage: `linear-gradient(rgba(255,255,255,${g.alpha}) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,${g.alpha}) 1px, transparent 1px)`,
      backgroundSize: `${g.cell * s}px ${g.cell * s}px`, maskImage: mask, WebkitMaskImage: mask}} />
    <div style={{position: 'absolute', left: k.left * s, top: k.top * s, width: k.maxWidth * s, display: 'flex', flexWrap: 'wrap', rowGap: k.rowGap * s}}>
      {safe.phrases.map((p, i) => {
        const w = phraseWipe(t, starts[i]), stop = p.endsWith('.'), text = stop ? p.slice(0, -1) : p;
        return <div key={i} style={{display: 'flex', alignItems: 'flex-end', marginRight: (stop ? 0 : k.gap) * s}}>
          <div style={{height: k.height * s, display: 'flex', alignItems: 'center', padding: `0 ${k.padRight * s}px 0 ${k.padLeft * s}px`, backgroundColor: look.violet,
            clipPath: `inset(0 ${(1 - w) * 100}% 0 0)`, fontFamily: look.script.family, fontWeight: look.script.weight, fontSize: k.size * s, lineHeight: 1, whiteSpace: 'pre', color: look.scriptInk}}>{text}</div>
          {stop ? <div style={{width: k.gap * s, height: k.height * s, position: 'relative', opacity: w > 0.98 ? 1 : 0}}>
            <div style={{position: 'absolute', left: (k.gap / 2 - k.dot / 2) * s, bottom: 34 * s, width: k.dot * s, height: k.dot * s, borderRadius: '50%', backgroundColor: look.onMedia}} />
          </div> : null}
        </div>;
      })}
    </div>
  </AbsoluteFill>;
};
export const phraseBoxes: VisualComponent<PhraseBoxesProps> = {id: 'phrase-boxes', layer: 'fullscreen', duration: phraseBoxesDuration,
  textLimits: phraseBoxesTextLimits, repair: repairPhraseBoxes, render: PhraseBoxes};
