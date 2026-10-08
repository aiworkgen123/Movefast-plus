import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {portraitNameDuration, portraitNameTextLimits, repairPortraitName, type PortraitNameProps} from './portrait-name-contract.ts';
import {portraitNameSpec as spec, portraitNameState} from './portrait-name-state.ts';
// Montserrat with line-height 1: ascender ink sits 0.1185 em, cap ink 0.1585 em below the box top.
const Typed: React.FC<{text: string; wipe: number; speed: number; size: number; tracking: number; inkTop: number; inkOffset: number; centreX: number; weight: number; colour: string; family: string; s: number}> =
  ({text, wipe, speed, size, tracking, inkTop, inkOffset, centreX, weight, colour, family, s}) => {
    const front = wipe * s, soft = spec.settle * speed * s;
    const mask = `linear-gradient(90deg, #000 ${front - soft}px, rgba(0,0,0,${spec.appear}) ${front}px, transparent ${front + 0.5}px)`;
    return <div style={{position: 'absolute', left: (centreX - 900) * s, width: 1800 * s, textAlign: 'center', top: (inkTop - inkOffset * size) * s}}>
      <span style={{display: 'inline-block', fontFamily: family, fontWeight: weight, fontSize: size * s, lineHeight: 1, letterSpacing: `${tracking}em`,
        whiteSpace: 'pre', color: colour, textShadow: `0 ${2 * s}px ${10 * s}px rgba(0,0,0,.45)`, maskImage: mask, WebkitMaskImage: mask}}>{text}</span>
    </div>;
  };
export const PortraitName: React.FC<ComponentRenderProps<PortraitNameProps>> = ({props, skin, context}) => {
  const safe = repairPortraitName(props);
  if (!safe || !validContext(context, portraitNameDuration)) return null;
  const s = context.width / 1920, look = skin.stage, st = portraitNameState(context), fr = spec.frame;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <AbsoluteFill style={{filter: `brightness(${st.brightness})`}}><FrameMediaView media={safe.media} context={context} fit="cover" /></AbsoluteFill>
    <div style={{position: 'absolute', left: fr.x * s, top: (fr.y + st.drop) * s, width: fr.width * s, height: fr.height * s,
      boxShadow: `inset ${3 * s}px 0 ${4 * s}px -${1 * s}px ${spec.line}, inset -${3 * s}px 0 ${4 * s}px -${1 * s}px ${spec.line}`}}>
      <Img src={staticFile(safe.portrait.path)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: -5 * s, height: 10 * s, background: spec.line, filter: `blur(${2 * s}px)`}} />
    </div>
    <Typed text={safe.name} wipe={st.nameWipe} speed={spec.name.speed} size={spec.name.size} tracking={spec.name.tracking} inkTop={spec.name.inkTop} inkOffset={0.1585}
      centreX={spec.name.centreX} weight={look.heavy.weight} colour={look.onMedia} family={look.heavy.family} s={s} />
    {safe.role ? <Typed text={safe.role} wipe={st.roleWipe} speed={spec.role.speed} size={spec.role.size} tracking={spec.role.tracking} inkTop={spec.role.inkTop} inkOffset={0.1185}
      centreX={spec.role.centreX} weight={600} colour={look.onMedia} family={look.heavy.family} s={s} /> : null}
  </AbsoluteFill>;
};
export const portraitName: VisualComponent<PortraitNameProps> = {id: 'portrait-name', layer: 'fullscreen', duration: portraitNameDuration,
  textLimits: portraitNameTextLimits, repair: repairPortraitName, render: PortraitName};
