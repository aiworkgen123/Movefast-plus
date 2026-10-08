import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile} from 'remotion';
import {loadStageFonts} from './fonts.ts';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {panSentenceDuration, panSentenceTextLimits, repairPanSentence, type PanSentenceProps} from './pan-sentence-contract.ts';
import {panCamera, panRevealTimes, panSentenceSpec as k, panWordState, type Shot} from './pan-sentence-state.ts';
import type {Skin} from './skins.ts';
// Montserrat 600 with line-height 1: cap ink 0.1555 em below the box top.
const capTop = 0.1555;
/** Word offsets need the real font: load it (and wait) before measuring, so every render measures the same glyphs. */
const useFontReady = (font: string, stage: boolean) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender('Measure pan sentence');
    void (stage ? loadStageFonts() : Promise.resolve()).then(() => document.fonts.load(font)).then(() => {setReady(true); continueRender(handle);});
  }, [font, stage]);
  return ready;
};
const measure = (text: string, shot: Shot, family: string) => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${k.weight} ${shot.size}px ${family}`;
  (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = `${k.tracking * shot.size}px`;
  const words = text.split(/\s+/u);
  return {words, offsets: words.map((_, i) => i ? ctx.measureText(`${words.slice(0, i).join(' ')} `).width : 0), width: ctx.measureText(text).width};
};
const PanGrid: React.FC<{shot: Shot; pan: number; colour: string; s: number}> = ({shot, pan, colour, s}) => {
  const lines: string[] = [], c = shot.cell, x0 = -((pan % c) + c) % c;
  for (let x = x0; x < 1920 + c; x += c) lines.push(`M${x} 0V1080`);
  for (let y = shot.originY - Math.ceil(shot.originY / c) * c; y < 1080 + c; y += c) lines.push(`M0 ${y}H1920`);
  return <svg width={1920 * s} height={1080 * s} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}} aria-hidden="true">
    <path d={lines.join('')} stroke={colour} strokeWidth={shot.stroke} fill="none" /></svg>;
};
const ShotView: React.FC<{text: string; starts?: readonly number[]; shot: Shot; t: number; skin: Skin; s: number; fps: number; from: number}> = ({text, starts, shot, t, skin, s, fps, from}) => {
  const look = skin.stage, m = useMemo(() => measure(text, shot, look.heavy.family), [text, shot, look.heavy.family]);
  const reveal = useMemo(() => starts ? [...starts] : panRevealTimes(shot, m.width, m.offsets), [starts, shot, m]);
  const cam = panCamera(shot, m.width, t);
  return <>
    <PanGrid shot={shot} pan={cam} colour={look.gridLine} s={s} />
    {m.words.map((w, i) => {
      const st = panWordState(t, reveal[i]);
      return <div key={i} style={{position: 'absolute', left: (shot.startX + m.offsets[i] - cam) * s, top: (shot.capTop - capTop * shot.size + st.dy) * s,
        fontFamily: look.heavy.family, fontWeight: k.weight, fontSize: shot.size * s, lineHeight: 1, letterSpacing: `${k.tracking}em`, whiteSpace: 'pre',
        color: look.red, opacity: st.opacity, filter: st.blur > 0.05 ? `blur(${st.blur * s}px)` : undefined}}>{w}</div>;
    })}
    {reveal.map((r, i) => <Sequence key={i} from={from + Math.round(r * fps)} durationInFrames={3} layout="none"><Audio src={staticFile('sfx/type-click.wav')} volume={k.clickVolume} /></Sequence>)}
  </>;
};
export const PanSentence: React.FC<ComponentRenderProps<PanSentenceProps>> = ({props, skin, context}) => {
  const safe = repairPanSentence(props), family = skin.stage.heavy.family;
  const ready = useFontReady(`${k.weight} 100px ${family}`, family.includes('Template'));
  if (!safe || !validContext(context, panSentenceDuration) || !ready) return null;
  const s = context.width / 1920, t = context.frame / context.fps, cut = safe.followUp ? (safe.cutAt ?? k.cutAt) : Infinity;
  return <AbsoluteFill style={{backgroundColor: skin.stage.stageBlack, overflow: 'hidden'}}>
    {t < cut ? <ShotView text={safe.text} starts={safe.wordStarts} shot={k.wide} t={t} skin={skin} s={s} fps={context.fps} from={0} />
      : t < cut + k.gap ? <PanGrid shot={k.close} pan={0} colour={skin.stage.gridLine} s={s} />
      : <ShotView text={safe.followUp!} starts={safe.followUpStarts} shot={k.close} t={t - cut - k.gap} skin={skin} s={s} fps={context.fps} from={Math.round((cut + k.gap) * context.fps)} />}
  </AbsoluteFill>;
};
export const panSentence: VisualComponent<PanSentenceProps> = {id: 'pan-sentence', layer: 'fullscreen', duration: panSentenceDuration,
  textLimits: panSentenceTextLimits, repair: repairPanSentence, render: PanSentence};
