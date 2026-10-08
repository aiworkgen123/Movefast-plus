import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_DURATION = 180;

const zeroHash = '0'.repeat(64);
const bulletin = {
  artifactId: 'wc15-proof-bulletin',
  sha256: 'a13b39d2d80b7082577645f94f1955594c6368aa702dc78e345d0c99057ce441',
  mediaType: 'image/jpeg',
  staticFileKey: 'visual-lab/document-evidence-reveal/grande-armee-29th-bulletin.jpg',
} as const;
const painting = {
  artifactId: 'wc15-proof-painting',
  sha256: '4cdbf249a44891769b5c60c634f1ecccd262f740b67b3f7c6122c287a2e66b78',
  mediaType: 'image/jpeg',
  staticFileKey: 'visual-lab/two-source-contrast/ary-scheffer-retreat-1826.jpg',
} as const;

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc15-production-two-source-contrast-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_DURATION,
  voiceover: {artifactId: 'owner-voiceover-62-9s', sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236', mediaType: 'audio/wav', staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav'},
  scenes: [
    {kind: 'animated_still', sceneId: 'wc15-proof-base-a', parentUnitId: 'wc15-proof-unit', startFrame: 0, endFrameExclusive: 150, routeId: 'proof-selected-still-a', treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 71}, acceptedScopeHash: zeroHash, source: bulletin, sourceWidth: 1280, sourceHeight: 1636, frameTreatment: {style: 'basic_static'}},
    {kind: 'animated_still', sceneId: 'wc15-proof-base-b', parentUnitId: 'wc15-proof-unit', startFrame: 150, endFrameExclusive: 180, routeId: 'proof-selected-still-b', treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 73}, acceptedScopeHash: zeroHash, source: {...painting, artifactId: 'wc15-proof-base-painting'}, sourceWidth: 1920, sourceHeight: 1505, frameTreatment: {style: 'basic_static'}},
  ],
  components: [{
    componentId: 'wc15-production-proof-two-source-contrast', componentType: 'WC15', parentUnitIds: ['wc15-proof-unit'], layer: 'full_screen', baseSceneIds: ['wc15-proof-base-a', 'wc15-proof-base-b'], startFrame: 0, endFrameExclusive: 180, evidenceIds: ['review-only-two-source-contrast'], acceptedScopeHash: zeroHash,
    relationship: 'reviewed_contrast',
    relationshipLabel: 'Record and representation',
    sources: [
      {sourceId: 'official-bulletin', label: 'OFFICIAL BULLETIN', sourceKind: 'primary_document', dateLabel: 'December 1812', evidenceIds: ['review-bulletin'], source: bulletin},
      {sourceId: 'retreat-painting', label: 'RETREAT IN ART', sourceKind: 'painting', dateLabel: '1826', evidenceIds: ['review-painting'], source: painting},
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

export const WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_SPEC = proofSpec;
export const WC15ProductionTwoSourceContrastProof: React.FC<WarChessRenderSpec> = (props) => <WarChessComposition {...props} />;
