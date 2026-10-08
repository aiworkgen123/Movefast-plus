import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GridStage} from './grid-stage.tsx';
import {measureRadarDuration, measureRadarTextLimits, repairMeasureRadar, type MeasureRadarProps} from './measure-radar-contract.ts';
import {decoded, measureRadarSpec as k, radarZoom, typedChars} from './measure-radar-state.ts';
// Saira 600 / width 80 with line-height 1: digit/cap ink sits 0.165 em below the box top.
const inkTop = 0.11;
const tornClip = (n: number) => `polygon(0 0, 100% 0, calc(100% - ${n}px) 22%, 100% 44%, calc(100% - ${n}px) 66%, 100% 88%, 100% 100%, 0 100%, ${n}px 78%, 0 56%, ${n}px 34%, 0 12%)`;
export const MeasureRadar: React.FC<ComponentRenderProps<MeasureRadarProps>> = ({props, skin, context}) => {
  const safe = repairMeasureRadar(props);
  if (!safe || !validContext(context, measureRadarDuration)) return null;
  const s = context.width / 1920, look = skin.stage, t = context.frame / context.fps, z = radarZoom(t), c = k.circle;
  const arcLen = 2 * Math.PI * c.r;
  const font = {fontFamily: look.measure.family, fontWeight: look.measure.weight, fontStretch: '80%', lineHeight: 1, whiteSpace: 'pre' as const};
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <GridStage skin={skin} context={context} variant="faint" line={look.gridLine} />
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
        <circle cx={c.x} cy={c.y} r={c.r} fill={look.radarFill} />
        <circle cx={c.x} cy={c.y} r={c.r} fill="none" stroke={look.measureGreen} strokeWidth={c.stroke} strokeDasharray={`${arcLen * z.arc} ${arcLen}`}
          transform={`rotate(${c.startDeg} ${c.x} ${c.y})`} />
      </svg>
      <Img src={staticFile(safe.object.path)} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, objectFit: 'contain',
        transformOrigin: `${k.zoom.originX}px ${k.zoom.originY}px`, transform: `scale(${z.scale})`, filter: z.blur > 0.05 ? `blur(${z.blur}px)` : undefined}} />
      {safe.measurements.map((m, i) => {
        const slot = k.slots[i], right = 'valueRight' in slot, chars = typedChars(t, slot.tagStart, Array.from(m.label).length);
        const value = decoded(m.value, t, slot.start, context.frame), label = Array.from(m.label).slice(0, chars).join('');
        const valuePos = right ? {right: 1920 - slot.valueRight - 3} : {left: slot.valueLeft + k.value.nudgeX};
        const tagPos = right ? {right: 1920 - slot.tagRight} : {left: slot.valueLeft};
        return <React.Fragment key={i}>
          <div style={{position: 'absolute', ...valuePos, top: slot.valueTop - inkTop * slot.valueSize, ...font, fontSize: slot.valueSize,
            letterSpacing: `${k.value.tracking}em`, color: look.measureGreen}}>{value}</div>
          {chars > 0 ? <div style={{position: 'absolute', ...tagPos, top: slot.tagTop, height: k.tag.height, display: 'flex', alignItems: 'center',
            padding: `${k.tag.textDrop}px ${k.tag.pad - k.tag.tracking * k.tag.size}px 0 ${k.tag.pad}px`, backgroundColor: look.tapeWhite, clipPath: tornClip(k.tag.notch),
            ...font, fontSize: k.tag.size, letterSpacing: `${k.tag.tracking}em`, color: look.tapeInk}}>{label}</div> : null}
          {chars > 0 && chars < Array.from(m.label).length ? <Sequence from={Math.round((slot.tagStart + chars / k.tag.rate) * context.fps)} durationInFrames={3} layout="none">
            <Audio src={staticFile('sfx/type-click.wav')} volume={0.08} /></Sequence> : null}
        </React.Fragment>;
      })}
      <AbsoluteFill style={{backgroundImage: `radial-gradient(circle, rgba(0,0,0,${k.dots.alpha}) 1.6px, transparent 2px)`, backgroundSize: `${k.dots.pitch}px ${k.dots.pitch}px`, mixBlendMode: 'multiply'}} />
    </div>
    <Audio src={staticFile('sfx/shutter-click.wav')} volume={0.2} />
  </AbsoluteFill>;
};
export const measureRadar: VisualComponent<MeasureRadarProps> = {id: 'measure-radar', layer: 'fullscreen', duration: measureRadarDuration,
  textLimits: {measurements: measureRadarTextLimits.label}, repair: repairMeasureRadar, render: MeasureRadar};
