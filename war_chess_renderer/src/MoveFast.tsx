import React from 'react';
import {AbsoluteFill, Composition, Sequence, registerRoot} from 'remotion';
import {ComponentLayer} from './components';
import {RenderComponentSchema} from './schema';
import {CanonicalMediaScene} from './ported/media-presentation-adapter';
import {SceneOverlay} from './WarChessComposition';

// MoveFast owns its timeline. Only the reusable visual components cross this boundary.
const MoveFastScene: React.FC<any> = ({base, layers = [], effects = []}) => <AbsoluteFill>
  {base && <CanonicalMediaScene scene={base} />}
  {effects.map((effect: any, i: number) => <Sequence key={`effect-${i}`} from={effect.from}
    durationInFrames={effect.duration}>
    {effect.overlay && <SceneOverlay scene={{overlay: effect.overlay} as any} />}
  </Sequence>)}
  {layers.map((layer: any, i: number) => <Sequence key={i} from={layer.from}
    durationInFrames={layer.duration}>
    <ComponentLayer component={RenderComponentSchema.parse(layer.component)} />
  </Sequence>)}
</AbsoluteFill>;

registerRoot(() => <Composition id="MoveFastWarChess" component={MoveFastScene}
  width={1920} height={1080} fps={30} durationInFrames={150}
  defaultProps={{base: null, layers: [], effects: [], frames: 150}}
  calculateMetadata={({props}) => ({durationInFrames: props.frames})} />);
