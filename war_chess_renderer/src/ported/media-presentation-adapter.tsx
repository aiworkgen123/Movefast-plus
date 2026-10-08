import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from 'remotion';

import {WarChessMediaPresentation} from '../canonical/media-presentation';
import type {RenderScene} from '../schema';
import {PlannedAtmosphere} from './planned-atmosphere';

type MediaScene = Extract<RenderScene, {kind: 'animated_still' | 'real_clip'}>;


/** Worker renders pass a staged static-file key; the web preview passes a URL. */
const resolveMediaSource = (path: string): string =>
  /^(?:blob:|https?:|data:)/i.test(path) ? path : staticFile(path);

/**
 * Connect the hash-bound web RenderSpec to the owner-approved War Chess media
 * presentation without reintroducing filesystem paths into the public API.
 * The render worker alone hydrates an opaque artifact to a staged public key.
 */
export const CanonicalMediaScene: React.FC<{scene: MediaScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  // The render worker stages a static-file key; the web preview supplies a URL.
  const path = scene.source.staticFileKey ?? scene.source.url;
  if (!path) {
    throw new Error('canonical media requires a staged static-file key or preview URL');
  }
  const durationFrames = scene.endFrameExclusive - scene.startFrame;
  // The canonical presentation reads staged files only; the browser preview
  // (URL, no staged key) shows the plain media instead of the locked treatment.
  if (scene.plannedShotId || !scene.source.staticFileKey) {
    const progress = Math.min(1, frame / Math.max(1, durationFrames - 1));
    const motion = scene.edit?.motion ?? 'static';
    const style: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      transform: motion === 'zoom'
        ? `scale(${interpolate(progress, [0, 1], [1, 1.06])})`
        : motion === 'pan'
          ? `scale(1.06) translateX(${interpolate(progress, [0, 1], [-2, 2])}%)`
          : undefined,
    };
    return (
      <AbsoluteFill style={{backgroundColor: '#090909'}}>
        {scene.kind === 'real_clip' ? (
          <OffthreadVideo
            src={resolveMediaSource(path)}
            startFrom={scene.sourceStartFrame}
            endAt={scene.sourceEndFrameExclusive}
            muted
            style={style}
          />
        ) : (
          <Img src={resolveMediaSource(path)} style={style} />
        )}
        <PlannedAtmosphere effect={scene.edit ? (scene.edit.filter ?? 'white_grid') : scene.treatment.presentationEffect} />
        {scene.edit?.frame ? <AbsoluteFill style={{pointerEvents: 'none', border: '24px solid #d9d0bd', boxShadow: 'inset 0 0 0 3px #171614'}} /> : null}
      </AbsoluteFill>
    );
  }
  return (
    <WarChessMediaPresentation
      mediaKind={scene.kind === 'real_clip' ? 'clip' : 'still'}
      media={{path, sha256: scene.source.sha256}}
      durationFrames={durationFrames}
      startFromFrames={scene.kind === 'real_clip' ? scene.sourceStartFrame : 0}
      sourceWidth={scene.sourceWidth}
      sourceHeight={scene.sourceHeight}
      surfaceEffect={scene.treatment.surfaceEffect}
      surfaceIntensity={0.9}
      presentationEffect={scene.treatment.presentationEffect}
      presentationIntensity={1}
      presentationMode={scene.treatment.presentationMode}
      frameAlways
      frameTreatment={scene.frameTreatment ?? {style: 'basic_static'}}
      textOverlay={null}
    />
  );
};
