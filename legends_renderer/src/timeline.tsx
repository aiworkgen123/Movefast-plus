import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairTimeline, timelineDuration, timelineTextLimits, type TimelineProps} from './timeline-contract.ts';
import {timelineState} from './timeline-state.ts';
export const Timeline: React.FC<ComponentRenderProps<TimelineProps>> = ({props, skin, context}) => {
  const safe = repairTimeline(props);
  if (!safe || !validContext(context, timelineDuration)) return null;
  const state = timelineState(context, skin, safe.events.length);
  const scale = context.width / 1920;
  const token = skin.timeline;
  const width = 1920 - 2 * token.inset;
  const column = width / safe.events.length;
  const title = skin.fonts.title, date = skin.fonts.label, label = skin.fonts.body;
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: token.inset * scale, right: token.inset * scale,
      top: context.height * 0.15, opacity: state.opacity, fontFamily: title.family, fontWeight: title.weight,
      letterSpacing: title.letterSpacing * scale, fontSize: token.titleSize * scale, lineHeight: 1.12,
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{safe.title}</div>
    <div style={{position: 'absolute', left: token.inset * scale, width: width * scale,
      top: context.height * 0.53, opacity: state.opacity}}>
      <div aria-hidden="true" style={{position: 'absolute', left: column * scale / 2,
        width: (width - column) * scale, height: token.lineWidth * scale, backgroundColor: skin.palette.accent,
        transform: `scaleX(${state.lineScale})`, transformOrigin: 'left center'}} />
      <div style={{display: 'grid', gridTemplateColumns: `repeat(${safe.events.length}, minmax(0, 1fr))`}}>
        {safe.events.map((event, i) => <div key={i} style={{position: 'relative', textAlign: 'center',
          padding: `0 ${token.gap * scale}px`, opacity: state.events[i],
          transform: `translateY(${(1 - state.events[i]) * token.riseDistance * scale}px)`}}>
          <div style={{position: 'absolute', top: -42 * scale, transform: 'translateY(-100%)', left: token.gap * scale, right: token.gap * scale,
            fontFamily: date.family, fontWeight: date.weight, letterSpacing: date.letterSpacing * scale,
            fontSize: token.dateSize * scale, lineHeight: 1.15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            color: state.activeIndex === i ? skin.palette.accent : skin.palette.muted}}>{event.date}</div>
          <div aria-hidden="true" style={{width: token.nodeSize * scale, height: token.nodeSize * scale,
            position: 'absolute', top: (token.lineWidth - token.nodeSize) * scale / 2, left: '50%',
            transform: `translateX(-50%) scale(${state.activeIndex === i ? 1.3 : 1})`, borderRadius: '50%', backgroundColor: skin.palette.accent}} />
          <div style={{marginTop: 44 * scale, fontFamily: label.family, fontWeight: label.weight,
            letterSpacing: label.letterSpacing * scale, fontSize: token.labelSize * scale, lineHeight: 1.25,
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{event.label}</div>
        </div>)}
      </div>
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const timeline: VisualComponent<TimelineProps> = {id: 'timeline', layer: 'fullscreen', duration: timelineDuration,
  textLimits: timelineTextLimits, repair: repairTimeline, render: Timeline};
