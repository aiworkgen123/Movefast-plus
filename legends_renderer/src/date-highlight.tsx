import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {dateHighlightDuration, dateHighlightTextLimits, repairDateHighlight, type DateHighlightProps} from './date-highlight-contract.ts';
import {dateHighlightSpec as k, dateHighlightState} from './date-highlight-state.ts';
// Montserrat 800 with line-height 1: cap ink sits capTop em below the box top, descender ink ends descent em above its bottom;
// the first/last glyphs' side bearings are inkLeft/inkRight em (calibrated on full-resolution stills).
const capTop = 0.1108, descent = -0.0525, inkLeft = 0, inkRight = -0.024, yearCapTop = 0.142;
export const DateHighlight: React.FC<ComponentRenderProps<DateHighlightProps>> = ({props, skin, context}) => {
  const safe = repairDateHighlight(props);
  if (!safe || !validContext(context, dateHighlightDuration)) return null;
  const s = context.width / 1920, look = skin.stage, st = dateHighlightState(context), d = k.date, b = k.bar;
  const fadeMask = `linear-gradient(90deg, rgba(0,0,0,${st.dateLeft}), rgba(0,0,0,${st.dateRight}))`;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: 0, right: 0, top: (d.inkTop - capTop * d.size) * s, textAlign: 'center'}}>
      <span style={{position: 'relative', display: 'inline-block', fontFamily: look.heavy.family, fontWeight: 800, fontSize: d.size * s, lineHeight: 1,
        letterSpacing: `${d.tracking}em`, whiteSpace: 'pre'}}>
        <span style={{position: 'absolute', left: -(b.padLeft + inkLeft * d.size) * s, right: -(b.padRight - (inkRight + d.tracking) * d.size) * s,
          top: (capTop * d.size - b.padTop) * s, bottom: (descent * d.size - b.padBottom) * s, backgroundColor: look.yellow,
          clipPath: `inset(0 ${(1 - st.bar) * 100}% 0 0)`}} />
        <span style={{position: 'relative', color: look.onMedia, maskImage: fadeMask, WebkitMaskImage: fadeMask}}>{safe.date}</span>
      </span>
    </div>
    {safe.year ? <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', top: (k.year.inkTop - yearCapTop * k.year.size) * s, letterSpacing: `${k.year.tracking}em`,
      fontFamily: look.heavy.family, fontWeight: 800, fontSize: k.year.size * s, lineHeight: 1, whiteSpace: 'pre', color: look.onMedia, opacity: st.year}}>{safe.year}</div> : null}
    <Sequence from={Math.round(b.start * context.fps)} layout="none"><Audio src={staticFile('sfx/soft-whoosh.wav')} volume={k.whooshVolume} /></Sequence>
  </AbsoluteFill>;
};
export const dateHighlight: VisualComponent<DateHighlightProps> = {id: 'date-highlight', layer: 'fullscreen', duration: dateHighlightDuration,
  textLimits: dateHighlightTextLimits, repair: repairDateHighlight, render: DateHighlight};
