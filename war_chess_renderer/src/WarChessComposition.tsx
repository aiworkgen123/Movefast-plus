import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type {RenderScene, WarChessRenderSpec} from './schema';
import {CaptionTrack} from './CaptionTrack';
import {ComponentLayer} from './components';
import {CanonicalMediaScene} from './ported/media-presentation-adapter';
import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from './editorial-theme';

export {LockedCaption} from './CaptionTrack';

const COLORS = {
  ink: '#171614',
  paper: '#ece7db',
  paperWarm: '#d9d0bd',
  red: '#aa2d27',
  blue: '#304c67',
  white: '#faf8f1',
};

const sourceUrl = (source: {url?: string; staticFileKey?: string}) => {
  if (source.url) return source.url;
  if (source.staticFileKey) return staticFile(source.staticFileKey);
  throw new Error('render source location is missing');
};

const FramedMedia: React.FC<{scene: RenderScene}> = ({scene}) => {
  if (scene.kind === 'original_motion_graphic') return null;
  return <CanonicalMediaScene scene={scene} />;
};

export const SceneOverlay: React.FC<{scene: RenderScene}> = ({scene}) => {
  if (!scene.overlay) return null;
  const chapter = scene.overlay.kind === 'chapter';
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: chapter ? 'center' : 'flex-end',
        padding: chapter ? 64 : '0 96px 150px',
        textAlign: 'center',
        pointerEvents: 'none',
        backgroundColor: chapter ? 'rgba(0, 0, 0, 0.52)' : undefined,
      }}
    >
      <div
        style={{
          backgroundColor: chapter ? 'rgba(23, 22, 20, 0.82)' : 'rgba(23, 22, 20, 0.9)',
          color: COLORS.white,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: chapter ? 72 : 30,
          fontWeight: chapter ? 900 : 700,
          letterSpacing: chapter ? 5 : 1,
          lineHeight: 1.08,
          maxWidth: '90%',
          padding: chapter ? '24px 38px' : '12px 20px',
          textTransform: chapter || scene.overlay.kind === 'cta' ? 'uppercase' : 'none',
        }}
      >
        {scene.overlay.text}
      </div>
    </AbsoluteFill>
  );
};

export const PlacementEditOverlay: React.FC<{scene: RenderScene}> = ({scene}) => {
  const edit = scene.edit;
  if (!edit || !edit.overlayText || !['label', 'caption', 'headline'].includes(edit.kind) || scene.overlay) return null;
  const headline = edit.kind === 'headline';
  return <AbsoluteFill style={{pointerEvents: 'none', justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 96px 150px'}}>
    <div style={{fontFamily: WC_EDITORIAL_SANS, fontSize: headline ? 54 : 30, fontWeight: headline ? 800 : 700, lineHeight: 1.12, letterSpacing: headline ? 0.5 : 0.8, color: COLORS.white, backgroundColor: 'rgba(23, 22, 20, 0.84)', padding: headline ? '17px 23px' : '11px 17px', maxWidth: headline ? 1050 : 680}}>{edit.overlayText}</div>
  </AbsoluteFill>;
};

const EvidenceGraphic: React.FC<{
  scene: Extract<RenderScene, {kind: 'original_motion_graphic'}>;
}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (scene.componentVariant === 'board_count_v1' && scene.boardCount !== undefined) {
    const boardSize = Math.min(440, 1440 / scene.boardCount - 36);
    return (
      <AbsoluteFill style={{backgroundColor: '#090909', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 48}}>
        {scene.stateChangePlan.map((state, index) => {
          const reveal = interpolate(frame, [state.startFrame, Math.min(state.startFrame + 8, state.endFrameExclusive - 1)], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <div key={index} style={{width: boardSize, height: boardSize, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)', border: '2px solid #d9d0bd', opacity: reveal, translate: `0px ${(1 - reveal) * 24}px`}}>
              {Array.from({length: 64}, (_, square) => (
                <div key={square} style={{backgroundColor: (Math.floor(square / 8) + square % 8) % 2 === 0 ? '#ece7db' : '#304c67'}} />
              ))}
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 78% 18%, ${COLORS.blue} 0%, ${COLORS.ink} 58%, #090909 100%)`,
        color: COLORS.white,
        padding: '118px 138px',
        fontFamily: WC_EDITORIAL_SANS,
      }}
    >
      <div style={{fontSize: 24, fontWeight: 800, letterSpacing: 5, color: COLORS.paperWarm}}>
        {scene.display.eyebrow.toUpperCase()}
      </div>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 28, marginTop: 86}}>
        {scene.display.steps.map((step, index) => {
          const state = scene.stateChangePlan[index];
          const reveal = interpolate(frame, [state.startFrame, Math.min(state.startFrame + 0.45 * fps, state.endFrameExclusive - 1)], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          return (
            <React.Fragment key={`${scene.componentId}-${index}`}>
              <div
                style={{
                  flex: 1,
                  minHeight: 220,
                  padding: '34px 16px',
                  opacity: reveal,
                  translate: `0px ${interpolate(reveal, [0, 1], [32, 0])}px`,
                }}
              >
                {scene.display.steps.length > 1 ? <div style={{fontFamily: WC_EDITORIAL_SANS, fontSize: 18, fontWeight: 800, letterSpacing: 4, color: index % 2 ? COLORS.paperWarm : COLORS.red}}>KEY POINT</div> : null}
                <div style={{fontFamily: WC_EDITORIAL_SERIF, fontSize: 45, fontWeight: 700, lineHeight: 1.06, marginTop: 22}}>{step}</div>
              </div>
              {index < scene.display.steps.length - 1 ? (
                <div style={{alignSelf: 'center', fontSize: 48, fontWeight: 900, color: COLORS.red, opacity: reveal}}>→</div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const WarChessComposition: React.FC<WarChessRenderSpec> = (props) => {
  const components = props.components ?? [];
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.ink}}>
      <Audio src={sourceUrl(props.voiceover)} />
      {props.scenes.map((scene) => (
        <Sequence
          key={scene.sceneId}
          name={scene.sceneId}
          from={scene.startFrame}
          durationInFrames={scene.endFrameExclusive - scene.startFrame}
          premountFor={props.fps}
        >
          {scene.kind === 'original_motion_graphic' ? (
            <EvidenceGraphic scene={scene} />
          ) : (
            <FramedMedia scene={scene} />
          )}
          <SceneOverlay scene={scene} />
          <PlacementEditOverlay scene={scene} />
        </Sequence>
      ))}
      {components.map((component) => (
        <Sequence
          key={component.componentId}
          name={`${component.componentType} ${component.componentId}`}
          from={component.startFrame}
          durationInFrames={component.endFrameExclusive - component.startFrame}
          premountFor={props.fps}
        >
          <ComponentLayer component={component} />
        </Sequence>
      ))}
      <CaptionTrack
        cues={props.captions}
        scenes={props.scenes}
        components={components}
      />
    </AbsoluteFill>
  );
};
