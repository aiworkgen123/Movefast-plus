import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC11_PRODUCTION_CHRONOLOGY_PROOF_DURATION = 150;

const zeroHash = '0'.repeat(64);
const evidenceIds = ['review-only-chronology-evidence'];

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc11-production-chronology-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC11_PRODUCTION_CHRONOLOGY_PROOF_DURATION,
  voiceover: {
    artifactId: 'owner-voiceover-62-9s',
    sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236',
    mediaType: 'audio/wav',
    staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav',
  },
  scenes: [{
    kind: 'animated_still',
    sceneId: 'wc11-proof-base-scene',
    parentUnitId: 'wc11-proof-unit',
    startFrame: 0,
    endFrameExclusive: WC11_PRODUCTION_CHRONOLOGY_PROOF_DURATION,
    routeId: 'proof-selected-still',
    treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 41},
    acceptedScopeHash: zeroHash,
    source: {
      artifactId: 'review-wc11-archival-worktable',
      sha256: 'a2269df68bd33bf822a86ad982f3d065d1adc95ea3fc19e622082ae2c1f47ec3',
      mediaType: 'image/png',
      staticFileKey: 'visual-lab/wc11-chronology/editor-arranging-archival-chronology.png',
    },
    sourceWidth: 1672,
    sourceHeight: 941,
    frameTreatment: {style: 'basic_static'},
  }],
  components: [{
    componentId: 'wc11-production-proof-chronology',
    componentType: 'WC11',
    parentUnitIds: ['wc11-proof-unit'],
    layer: 'full_screen',
    baseSceneIds: ['wc11-proof-base-scene'],
    startFrame: 0,
    endFrameExclusive: WC11_PRODUCTION_CHRONOLOGY_PROOF_DURATION,
    evidenceIds,
    acceptedScopeHash: zeroHash,
    title: 'How it unfolded',
    events: [
      {eventId: 'review-event-1', dateLabel: '01', label: 'The first signal', evidenceIds},
      {eventId: 'review-event-2', dateLabel: '02', label: 'Momentum shifts', evidenceIds},
      {eventId: 'review-event-3', dateLabel: '03', label: 'The turning point', evidenceIds},
      {eventId: 'review-event-4', dateLabel: '04', label: 'The final outcome', evidenceIds},
    ],
  }],
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

export const WC11_PRODUCTION_CHRONOLOGY_PROOF_SPEC = proofSpec;

export const WC11ProductionChronologyProof: React.FC<WarChessRenderSpec> = (props) => <WarChessComposition {...props}/>;
