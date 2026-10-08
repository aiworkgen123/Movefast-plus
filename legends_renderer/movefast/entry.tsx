// MoveFast-owned (update_legends.sh never touches movefast/): renders library edits for MoveFast.
// One composition: an optional real footage base, then edit layers, each with its own animation clock and sound.
// alpha: a transparent background, rendered to ProRes 4444 and laid over the finished picture by the final mix.
import React, {useEffect} from 'react';
import {AbsoluteFill, Composition, OffthreadVideo, Sequence, registerRoot, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as lib from '../src/index.ts';
import {loadDocumentaryFonts, loadStageFonts} from '../src/fonts.ts';
import type {Skin} from '../src/skins.ts';

type Component = {id: string; render: React.FC<{props: unknown; skin: Skin; context: unknown}>};
export const registry: Record<string, Component> = Object.fromEntries(Object.values(lib)
  .filter((v): v is Component => !!v && typeof v === 'object' && typeof (v as Component).id === 'string' && typeof (v as Component).render === 'function')
  .map((v) => [v.id, v]));

type Layer = {from: number; duration: number; id: string; props: unknown};
type Props = {frames: number; skin: Skin['id']; base?: {key: string} | null; layers: Layer[]; alpha?: boolean};

const LayerView: React.FC<{layer: Layer; skin: Skin}> = ({layer, skin}) => {
  const frame = useCurrentFrame(), {fps, width, height} = useVideoConfig(), C = registry[layer.id];
  if (!C) throw new Error(`Unknown edit ${layer.id}`);
  return <C.render props={layer.props} skin={skin} context={{frame, fps, width, height, durationInFrames: layer.duration}} />;
};

const Scene: React.FC<Props> = ({skin, base, layers, alpha}) => {
  useEffect(() => {void loadDocumentaryFonts(); void loadStageFonts();}, []);
  const look = lib.skins[skin];
  return <AbsoluteFill style={{backgroundColor: alpha ? 'transparent' : '#000'}}>
    {base ? <OffthreadVideo src={staticFile(base.key)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
    {layers.map((l, i) => <Sequence key={i} from={l.from} durationInFrames={l.duration}><LayerView layer={l} skin={look} /></Sequence>)}
  </AbsoluteFill>;
};

const Root: React.FC = () => <Composition id="MoveFastLegends" component={Scene} fps={30} width={1920} height={1080} durationInFrames={30}
  defaultProps={{frames: 30, skin: 'documentary', base: null, layers: []} as Props}
  calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round(props.frames))})} />;
registerRoot(Root);
