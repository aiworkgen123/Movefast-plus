import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {redDossierDuration, redDossierTextLimits, repairRedDossier, type RedDossierProps} from './red-dossier-contract.ts';
import {redDossierSpec as k, redDossierState} from './red-dossier-state.ts';
// Montserrat with line-height 1: cap ink sits 0.1555 em (800) / 0.15 em (500) below the box top.
const sticker = (s: number) => [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([x, y]) => `drop-shadow(${x * s}px ${y * s}px 0 #fff)`).join(' ');
export const RedDossier: React.FC<ComponentRenderProps<RedDossierProps>> = ({props, skin, context}) => {
  const safe = repairRedDossier(props);
  if (!safe || !validContext(context, redDossierDuration)) return null;
  const s = context.width / 1920, look = skin.stage, d = k.disc;
  const words = safe.role ? safe.role.toUpperCase().split(/\s+/u) : [];
  // Whole words only (owner rule: never split a word); each word rises in turn, 0.2 s apart.
  const nameWords = safe.name.toUpperCase().split(/\s+/u);
  const st = redDossierState(context, nameWords.length, words.length);
  const slots = k.photos[safe.photos.length - 1];
  return <AbsoluteFill style={{backgroundColor: look.stageDark, overflow: 'hidden'}}>
    <AbsoluteFill style={{transform: `translateX(${st.slide * s}px)`}}>
      <div style={{position: 'absolute', left: (d.x - d.r - d.halo) * s, top: (d.y - d.r - d.halo) * s, width: 2 * (d.r + d.halo) * s, height: 2 * (d.r + d.halo) * s,
        borderRadius: '50%', opacity: st.halo,
        background: `radial-gradient(circle closest-side, ${look.redDisc}55 ${100 * d.r / (d.r + d.halo)}%, ${look.redDisc}3A ${100 * (d.r + 140) / (d.r + d.halo)}%, ${look.redDisc}1C ${100 * (d.r + 240) / (d.r + d.halo)}%, transparent 100%)`}} />
      <div style={{position: 'absolute', left: (d.x - d.r) * s, top: (d.y - d.r) * s, width: 2 * d.r * s, height: 2 * d.r * s, borderRadius: '50%', backgroundColor: look.redDisc}} />
      {safe.photos.map((p, i) => <Img key={i} src={staticFile(p.path)} style={{position: 'absolute', left: (slots[i].x - slots[i].h * p.width / p.height / 2) * s,
        top: (slots[i].y - slots[i].h / 2) * s, height: slots[i].h * s, filter: `grayscale(1) contrast(1.15) ${sticker(s)}`}} />)}
    </AbsoluteFill>
    {words.length ? <div style={{position: 'absolute', left: k.role.left * s, top: (k.role.inkTop - 0.15 * k.role.size) * s, fontFamily: look.heavy.family,
      fontWeight: 500, fontSize: k.role.size * s, lineHeight: 1, letterSpacing: `${k.role.tracking}em`, whiteSpace: 'pre', color: look.caption}}>
      {words.map((w, i) => <span key={i} style={{display: 'inline-block', opacity: st.words[i], transform: `translateY(${-(1 - st.words[i]) * k.role.drop * s}px)`}}>{w}{i < words.length - 1 ? ' ' : ''}</span>)}
    </div> : null}
    <div style={{position: 'absolute', left: k.name.left * s, top: (k.name.inkTop - 0.1555 * k.name.size) * s, width: k.name.width * s,
      fontFamily: look.heavy.family, fontWeight: 800, fontSize: k.name.size * s, lineHeight: `${k.name.pitch * s}px`, color: look.red}}>
      {nameWords.map((w, i) => <span key={i} style={{display: 'inline-block', marginRight: '0.28em', opacity: st.lines[Math.min(i, st.lines.length - 1)],
        transform: `translateY(${(1 - st.lines[Math.min(i, st.lines.length - 1)]) * k.name.rise * s}px)`}}>{w}</span>)}
    </div>
  </AbsoluteFill>;
};
export const redDossier: VisualComponent<RedDossierProps> = {id: 'red-dossier', layer: 'fullscreen', duration: redDossierDuration,
  textLimits: redDossierTextLimits, repair: repairRedDossier, render: RedDossier};
