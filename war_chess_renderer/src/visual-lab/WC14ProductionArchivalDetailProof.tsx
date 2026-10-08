import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_DURATION = 180;

const zeroHash = '0'.repeat(64);
const source = {
  artifactId: 'wc14-proof-source',
  sha256: 'd6a1bf8fb6608ccf3af8518ed3d509a0efe48a114c1f2fcf2a70f9e63da9c70d',
  mediaType: 'image/jpeg',
  staticFileKey: 'visual-lab/historical-documents/napoleon-study.jpg',
} as const;

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc14-production-archival-detail-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_DURATION,
  voiceover: {artifactId: 'owner-voiceover-62-9s', sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236', mediaType: 'audio/wav', staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav'},
  scenes: [
    {kind: 'animated_still', sceneId: 'wc14-proof-base-a', parentUnitId: 'wc14-proof-unit', startFrame: 0, endFrameExclusive: 150, routeId: 'proof-selected-still-a', treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 61}, acceptedScopeHash: zeroHash, source, sourceWidth: 3079, sourceHeight: 5135, frameTreatment: {style: 'basic_static'}},
    {kind: 'animated_still', sceneId: 'wc14-proof-base-b', parentUnitId: 'wc14-proof-unit', startFrame: 150, endFrameExclusive: 180, routeId: 'proof-selected-still-b', treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 67}, acceptedScopeHash: zeroHash, source: {...source, artifactId: 'wc14-proof-source-b'}, sourceWidth: 3079, sourceHeight: 5135, frameTreatment: {style: 'basic_static'}},
  ],
  components: [{
    componentId: 'wc14-production-proof-archival-detail', componentType: 'WC14', parentUnitIds: ['wc14-proof-unit'], layer: 'full_screen', baseSceneIds: ['wc14-proof-base-a', 'wc14-proof-base-b'], startFrame: 0, endFrameExclusive: 180, evidenceIds: ['review-only-archival-detail'], acceptedScopeHash: zeroHash,
    sourceTitle: 'The Emperor in His Study',
    sourceLabel: 'Jacques-Louis David · 1812',
    source,
    details: [
      {detailId: 'portrait', label: 'PORTRAIT', evidenceIds: ['review-portrait'], source: {artifactId: 'wc14-proof-portrait', sha256: '09809a42596a655bf13748b32755c935a8f3d92ff7ba13901dc4036830a03727', mediaType: 'image/jpeg', staticFileKey: 'visual-lab/wc14-production-proof/portrait.jpg'}},
      {detailId: 'clock', label: 'CLOCK', evidenceIds: ['review-clock'], source: {artifactId: 'wc14-proof-clock', sha256: '12d2ef4a4448c690f5195752d950994f34deac5ec224c488411ca0f02bd1ec34', mediaType: 'image/jpeg', staticFileKey: 'visual-lab/wc14-production-proof/clock.jpg'}},
      {detailId: 'desk', label: 'DESK AND PAPERS', evidenceIds: ['review-desk'], source: {artifactId: 'wc14-proof-desk', sha256: 'e31364b89a36da86772fe10fe78509fd41fa5fa7a54928a39b6e46dd390b6146', mediaType: 'image/jpeg', staticFileKey: 'visual-lab/wc14-production-proof/desk-and-papers.jpg'}},
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

export const WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_SPEC = proofSpec;
export const WC14ProductionArchivalDetailProof: React.FC<WarChessRenderSpec> = (props) => <WarChessComposition {...props}/>;
