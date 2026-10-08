import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';
import type {RenderComponent} from '../schema';

type NamedPersonComponent = Extract<RenderComponent, {componentType: 'WC12'}>;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

/** Overlay-only web adaptation of the owner-approved WC12 motion envelope. */

/** Worker renders pass a staged static-file key; the web preview passes a URL. */
const resolveMediaSource = (path: string): string =>
  /^(?:blob:|https?:|data:)/i.test(path) ? path : staticFile(path);

export const CanonicalNamedPersonOverlay: React.FC<{component: NamedPersonComponent}> = ({component}) => {
  const frame = useCurrentFrame();
  const path = component.cutout.staticFileKey ?? component.cutout.url;
  if (!path) throw new Error('WC12 cutout has no staged key or preview URL');
  const duration = component.endFrameExclusive - component.startFrame;
  const enterStart = Math.max(0, Math.round(duration * 0.08));
  const enterEnd = Math.max(enterStart + 1, Math.round(duration * 0.28));
  const exitStart = Math.max(enterEnd + 1, Math.round(duration * 0.84));
  const exitEnd = Math.max(exitStart + 1, duration - 1);
  const enter = interpolate(frame, [enterStart, enterEnd], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.18, 0.84, 0.22, 1),
  });
  const exit = interpolate(frame, [exitStart, exitEnd], [1, 0], {
    ...clamp,
    easing: Easing.bezier(0.28, 0.72, 0.42, 1),
  });
  const amount = Math.min(enter, exit);
  const top = interpolate(enter, [0, 1], [1160, 280], clamp) + interpolate(exit, [0, 1], [880, 0], clamp);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 1286, top: top - 98, width: 4, height: 104, backgroundColor: '#c99b55', opacity: amount, zIndex: 10}} />
      <div style={{position: 'absolute', left: 1304, top: top - 104, display: 'flex', flexDirection: 'column', gap: 8, padding: '15px 21px 14px 20px', backgroundColor: 'rgba(29,29,27,.94)', border: '1px solid rgba(217,184,123,.68)', boxShadow: '0 10px 22px rgba(13,14,13,.28)', opacity: amount, whiteSpace: 'nowrap', zIndex: 9, color: '#f4ead8'}}>
        <div style={{fontFamily: WC_EDITORIAL_SERIF, fontSize: 33, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.4}}>{component.namedPerson}</div>
        <div style={{fontFamily: WC_EDITORIAL_SANS, fontSize: 18, fontWeight: 500, lineHeight: 1, letterSpacing: 3.35, color: '#d4ad6e'}}>{component.role}</div>
      </div>
      <div style={{position: 'absolute', left: 1304, top, width: 560, opacity: amount, filter: 'drop-shadow(0 18px 16px rgba(15,16,15,.54)) drop-shadow(0 0 1px rgba(243,220,173,.48))', zIndex: 8}}>
        <Img src={resolveMediaSource(path)} alt={component.namedPerson} style={{width: '100%', height: 'auto', display: 'block'}} />
      </div>
      <div style={{position: 'absolute', right: 56, bottom: 46, maxWidth: 580, color: '#f4ead8', fontFamily: WC_EDITORIAL_SANS, fontWeight: 600, fontSize: 18, textAlign: 'right', textShadow: '0 2px 8px rgba(0,0,0,.9)', opacity: amount}}>{component.label}</div>
    </AbsoluteFill>
  );
};
