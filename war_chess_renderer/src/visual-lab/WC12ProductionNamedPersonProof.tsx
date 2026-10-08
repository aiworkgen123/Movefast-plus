import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC12_PRODUCTION_NAMED_PERSON_PROOF_DURATION = 150;

const zeroHash = '0'.repeat(64);
const evidenceIds = ['review-only-named-person-evidence'];

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc12-production-named-person-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC12_PRODUCTION_NAMED_PERSON_PROOF_DURATION,
  voiceover: {
    artifactId: 'owner-voiceover-62-9s',
    sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236',
    mediaType: 'audio/wav',
    staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav',
  },
  scenes: [{
    kind: 'animated_still',
    sceneId: 'wc12-proof-base-scene',
    parentUnitId: 'wc12-proof-unit',
    startFrame: 0,
    endFrameExclusive: WC12_PRODUCTION_NAMED_PERSON_PROOF_DURATION,
    routeId: 'proof-selected-still',
    treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 47},
    acceptedScopeHash: zeroHash,
    source: {
      artifactId: 'review-wc12-campaign-map',
      sha256: 'ea088f61833d02f1cdba2855131879510fa2b074454af18ef3043873e1fe0ce0',
      mediaType: 'image/jpeg',
      staticFileKey: 'visual-lab/historical-documents/campaign-1812.jpg',
    },
    sourceWidth: 1080,
    sourceHeight: 674,
    frameTreatment: {style: 'basic_static'},
  }],
  components: [{
    componentId: 'wc12-production-proof-named-person',
    componentType: 'WC12',
    parentUnitIds: ['wc12-proof-unit'],
    layer: 'overlay',
    baseSceneIds: ['wc12-proof-base-scene'],
    startFrame: 15,
    endFrameExclusive: 135,
    evidenceIds,
    acceptedScopeHash: zeroHash,
    namedPerson: 'Napoleon Bonaparte',
    role: 'Emperor of the French',
    label: 'Nonvisual evidence label',
    baseStartFrame: 0,
    baseEndFrameExclusive: 150,
    cutout: {
      artifactId: 'review-wc12-napoleon-cutout',
      sha256: '87e62a2a8907789ff51438a76cc72fba9f90c1e8b8a4319b1f120420d5a18ea1',
      mediaType: 'image/png',
      staticFileKey: 'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
    },
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

export const WC12_PRODUCTION_NAMED_PERSON_PROOF_SPEC = proofSpec;

export const WC12ProductionNamedPersonProof: React.FC<WarChessRenderSpec> = (props) => <WarChessComposition {...props}/>;
