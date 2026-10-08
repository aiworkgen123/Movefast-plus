import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile} from 'remotion';

import {ComponentLayer} from '../components';
import {type RenderComponent} from '../schema';

export const APPROVED_PRODUCTION_GALLERY_DURATION = 1155;

const hash = '0000000000000000000000000000000000000000000000000000000000000000';
const evidenceIds = ['owner-approved-visual-system'];
const base = (componentId: string, startFrame: number, endFrameExclusive: number) => ({
  componentId,
  parentUnitIds: [`${componentId}-unit`],
  baseSceneIds: [`${componentId}-scene`],
  startFrame,
  endFrameExclusive,
  evidenceIds,
  acceptedScopeHash: hash,
});
const asset = (artifactId: string, staticFileKey: string) => ({artifactId, sha256: hash, mediaType: 'image/png', staticFileKey});
const wc06Plan = {
  schemaVersion: 'war-chess-wc06-engine-receipt.v1' as const,
  status: 'verified' as const,
  motifId: 'knight_fork' as const,
  fen: '2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1',
  moves: [{ply: 1, uci: 'd5e7', caption: 'Move' as const}],
  principalVariation: ['d5e7'],
  engine: {name: 'Stockfish' as const, version: '18', settings: {depth: 12, movetimeMs: 400, threads: 1 as const, hashMb: 16, multipv: 1 as const}},
  score: {kind: 'cp' as const, value: 0},
  frozenBriefHash: hash,
  componentBriefHash: hash,
  receiptHash: hash,
};

const components = [
  {
    ...base('gallery-wc04', 0, 150), componentType: 'WC04', layer: 'full_screen', mode: 'tactical_movement', title: 'The turning movement',
    plate: {source: asset('campaign-map', 'visual-lab/maps/campaign-1812.jpg'), label: 'Reviewed campaign plate'},
    actors: [
      {actorId: 'army', label: 'Field army', side: 'blue', position: {x: .23, y: .7}},
      {actorId: 'objective', label: 'Objective', side: 'red', position: {x: .72, y: .43}},
    ],
    movementSteps: [{movementId: 'turn', actorId: 'army', label: 'Turn the defended position', from: {x: .23, y: .7}, to: {x: .72, y: .43}}], ranks: [],
  },
  {...base('gallery-wc06', 150, 390), componentType: 'WC06', layer: 'full_screen', chessPlan: wc06Plan, title: 'Pressure becomes position'},
  {
    ...base('gallery-wc10', 390, 600), componentType: 'WC10', layer: 'full_screen', title: 'Three ways forward', chosenOptionId: 'flank',
    options: [
      {optionId: 'direct', label: 'Direct assault', evidenceIds},
      {optionId: 'flank', label: 'Turn the flank', evidenceIds},
      {optionId: 'wide', label: 'Wide envelopment', evidenceIds},
    ],
  },
  {
    ...base('gallery-wc11', 600, 840), componentType: 'WC11', layer: 'full_screen', title: 'The route unfolds',
    events: [
      {eventId: 'opening', dateLabel: 'Opening', label: 'The campaign enters contested ground', evidenceIds},
      {eventId: 'contact', dateLabel: 'First contact', label: 'The advance reaches a defended position', evidenceIds},
      {eventId: 'turn', dateLabel: 'Turning point', label: 'A crossing changes the direction of movement', evidenceIds},
      {eventId: 'result', dateLabel: 'Result', label: 'The road opens toward the objective', evidenceIds},
    ],
  },
  {...base('gallery-wc09', 840, 990), componentType: 'WC09', layer: 'overlay', value: '4', unit: 'days', claimId: 'gallery-claim', sourceClaim: 'Production requires a verified source claim'},
  {...base('gallery-wc12', 990, 1155), componentType: 'WC12', layer: 'overlay', namedPerson: 'Napoleon Bonaparte', role: 'Commander · Campaign of 1812', label: 'Verified identity', baseStartFrame: 990, baseEndFrameExclusive: 1155, cutout: asset('napoleon-cutout', 'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')},
] satisfies RenderComponent[];

const OverlayBase: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#0d0c0a'}}>
    <Img src={staticFile('visual-lab/historical-documents/campaign-1812.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(.85) sepia(.16) contrast(1.05) brightness(.62)'}} />
  </AbsoluteFill>
);

export const ApprovedProductionGallery: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#0d0d0b'}}>
    <Audio src={staticFile('visual-lab/historical-documents/russian-campaign-context.wav')} volume={0} />
    <Sequence from={840} durationInFrames={315}><OverlayBase /></Sequence>
    {components.map((component) => (
      <Sequence key={component.componentId} from={component.startFrame} durationInFrames={component.endFrameExclusive - component.startFrame}>
        <ComponentLayer component={component} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
