import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC10_PRODUCTION_DECISION_FORK_PROOF_DURATION = 150;

const zeroHash = '0'.repeat(64);
const evidenceIds = ['review-only-strategic-choice-evidence'];

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc10-production-decision-fork-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC10_PRODUCTION_DECISION_FORK_PROOF_DURATION,
  voiceover: {
    artifactId: 'owner-voiceover-62-9s',
    sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236',
    mediaType: 'audio/wav',
    staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav',
  },
  scenes: [
    {
      kind: 'animated_still',
      sceneId: 'wc10-proof-base-scene',
      parentUnitId: 'wc10-proof-unit',
      startFrame: 0,
      endFrameExclusive: WC10_PRODUCTION_DECISION_FORK_PROOF_DURATION,
      routeId: 'proof-selected-still',
      treatment: {
        surfaceEffect: 'fine_35mm_grain',
        presentationEffect: 'film_dust',
        presentationMode: 'stay_framed',
        seed: 31,
      },
      acceptedScopeHash: zeroHash,
      source: {
        artifactId: 'owner-review-patton-1943',
        sha256: '12533dbe8c6f1b388cd23e40dddf6693b16e3058551a062190736095f1961fab',
        mediaType: 'image/jpeg',
        staticFileKey: 'visual-lab/factual-owner-cut/patton-1943.jpg',
      },
      sourceWidth: 1120,
      sourceHeight: 1400,
      frameTreatment: {style: 'basic_static'},
    },
  ],
  components: [
    {
      componentId: 'wc10-production-proof-decision-fork',
      componentType: 'WC10',
      parentUnitIds: ['wc10-proof-unit'],
      layer: 'full_screen',
      baseSceneIds: ['wc10-proof-base-scene'],
      startFrame: 0,
      endFrameExclusive: WC10_PRODUCTION_DECISION_FORK_PROOF_DURATION,
      evidenceIds,
      acceptedScopeHash: zeroHash,
      title: 'Choose the approach',
      chosenOptionId: 'turn-the-flank',
      options: [
        {optionId: 'direct-assault', label: 'Direct assault', evidenceIds},
        {optionId: 'turn-the-flank', label: 'Turn the flank', evidenceIds},
        {optionId: 'wide-envelopment', label: 'Wide envelopment', evidenceIds},
      ],
    },
  ],
  componentManifestHash: zeroHash,
  componentQcHash: zeroHash,
  captions: [],
  selectedSetHash: zeroHash,
  timelineHash: zeroHash,
  attributionHash: zeroHash,
  rendererBuildHash: zeroHash,
  dependencyLockHash: zeroHash,
  rightsManifestHash: zeroHash,
  fixtureOnly: true,
  commercialUseCertified: false,
  renderSpecHash: zeroHash,
};

export const WC10_PRODUCTION_DECISION_FORK_PROOF_SPEC = proofSpec;

export const WC10ProductionDecisionForkProof: React.FC<WarChessRenderSpec> = (props) => (
  <WarChessComposition {...props} />
);
