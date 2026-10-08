import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC09_PRODUCTION_STATISTIC_STILL_PROOF_DURATION = 150;

const zeroHash = '0'.repeat(64);

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc09-production-statistic-still-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC09_PRODUCTION_STATISTIC_STILL_PROOF_DURATION,
  voiceover: {
    artifactId: 'owner-voiceover-62-9s',
    sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236',
    mediaType: 'audio/wav',
    staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav',
  },
  scenes: [
    {
      kind: 'animated_still',
      sceneId: 'wc09-proof-patton-scene',
      parentUnitId: 'wc09-proof-patton-unit',
      startFrame: 0,
      endFrameExclusive: WC09_PRODUCTION_STATISTIC_STILL_PROOF_DURATION,
      routeId: 'proof-selected-still',
      treatment: {
        surfaceEffect: 'fine_35mm_grain',
        presentationEffect: 'film_dust',
        presentationMode: 'stay_framed',
        seed: 29,
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
      frameTreatment: {
        style: 'animated_signal_yellow',
        reason: 'solo_person_reveal',
        visibleSubject: 'uniformed man',
        evidenceHash: '1'.repeat(64),
      },
    },
  ],
  components: [
    {
      componentId: 'wc09-production-proof-overlay',
      componentType: 'WC09',
      parentUnitIds: ['wc09-proof-patton-unit'],
      layer: 'overlay',
      baseSceneIds: ['wc09-proof-patton-scene'],
      startFrame: 0,
      endFrameExclusive: WC09_PRODUCTION_STATISTIC_STILL_PROOF_DURATION,
      evidenceIds: ['review-only-statistic-evidence'],
      acceptedScopeHash: zeroHash,
      value: '4',
      unit: 'days',
      claimId: 'review-only-four-day-key-fact',
      sourceClaim: 'Illustrative timeline fact · visual review only',
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

export const WC09_PRODUCTION_STATISTIC_STILL_PROOF_SPEC = proofSpec;

export const WC09ProductionStatisticStillProof: React.FC<WarChessRenderSpec> = (props) => (
  <WarChessComposition {...props} />
);
