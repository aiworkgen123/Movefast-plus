import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_DURATION = 180;

const zeroHash = '0'.repeat(64);
const evidenceIds = ['review-only-document-evidence'];
const documentSource = {
  sha256: 'a13b39d2d80b7082577645f94f1955594c6368aa702dc78e345d0c99057ce441',
  mediaType: 'image/jpeg',
  staticFileKey: 'visual-lab/document-evidence-reveal/grande-armee-29th-bulletin.jpg',
} as const;

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-wc13-production-document-evidence-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_DURATION,
  voiceover: {artifactId: 'owner-voiceover-62-9s', sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236', mediaType: 'audio/wav', staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav'},
  scenes: [
    {kind: 'animated_still', sceneId: 'wc13-proof-base-a', parentUnitId: 'wc13-proof-unit', startFrame: 0, endFrameExclusive: 150, routeId: 'proof-selected-still-a', treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 53}, acceptedScopeHash: zeroHash, source: {artifactId: 'wc13-proof-base-document-a', ...documentSource}, sourceWidth: 1280, sourceHeight: 1636, frameTreatment: {style: 'basic_static'}},
    {kind: 'animated_still', sceneId: 'wc13-proof-base-b', parentUnitId: 'wc13-proof-unit', startFrame: 150, endFrameExclusive: 180, routeId: 'proof-selected-still-b', treatment: {surfaceEffect: 'fine_35mm_grain', presentationEffect: 'film_dust', presentationMode: 'stay_framed', seed: 59}, acceptedScopeHash: zeroHash, source: {artifactId: 'wc13-proof-base-document-b', ...documentSource}, sourceWidth: 1280, sourceHeight: 1636, frameTreatment: {style: 'basic_static'}},
  ],
  components: [{
    componentId: 'wc13-production-proof-document-evidence', componentType: 'WC13', parentUnitIds: ['wc13-proof-unit'], layer: 'full_screen', baseSceneIds: ['wc13-proof-base-a', 'wc13-proof-base-b'], startFrame: 0, endFrameExclusive: 180, evidenceIds, acceptedScopeHash: zeroHash,
    documentLabel: 'PRIMARY DOCUMENT', title: 'The official account', detailLabel: '29th Bulletin of the Grande Armée', dateLabel: 'December 1812', takeaway: 'NONVISUAL PLACEHOLDER — MUST NOT RENDER',
    document: {artifactId: 'wc13-proof-full-document', ...documentSource},
    detail: {artifactId: 'wc13-proof-reviewed-detail', ...documentSource},
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

export const WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_SPEC = proofSpec;
export const WC13ProductionDocumentEvidenceProof: React.FC<WarChessRenderSpec> = (props) => <WarChessComposition {...props}/>;
