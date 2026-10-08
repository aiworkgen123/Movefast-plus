import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {WarChessRenderSpec} from '../schema';

export const PRODUCTION_CAPTION_HIERARCHY_PROOF_DURATION = 300;

const zeroHash = '0000000000000000000000000000000000000000000000000000000000000000';

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'owner-review-caption-hierarchy-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: PRODUCTION_CAPTION_HIERARCHY_PROOF_DURATION,
  voiceover: {
    artifactId: 'owner-voiceover-62-9s',
    sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236',
    mediaType: 'audio/wav',
    staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav',
  },
  scenes: [
    {
      kind: 'animated_still',
      sceneId: 'proof-rommel-portrait',
      parentUnitId: 'proof-unit-portrait',
      startFrame: 0,
      endFrameExclusive: 150,
      routeId: 'proof-route-still',
      treatment: {
        surfaceEffect: 'fine_35mm_grain',
        presentationEffect: 'film_dust',
        presentationMode: 'stay_framed',
        seed: 17,
      },
      acceptedScopeHash: zeroHash,
      source: {
        artifactId: 'owner-review-rommel-1917',
        sha256: '3998197160b4a4439fd6c1f94edb095cc4bdada08fa0b75f6656fbde6861ffb9',
        mediaType: 'image/jpeg',
        staticFileKey: 'visual-lab/factual-owner-cut/rommel-1917.jpg',
      },
      sourceWidth: 1096,
      sourceHeight: 1651,
    },
    {
      kind: 'animated_still',
      sceneId: 'proof-sicily-wide',
      parentUnitId: 'proof-unit-wide',
      startFrame: 150,
      endFrameExclusive: 300,
      routeId: 'proof-route-wide',
      treatment: {
        surfaceEffect: 'vignette',
        presentationEffect: 'white_grid',
        presentationMode: 'stay_framed',
        seed: 29,
      },
      acceptedScopeHash: zeroHash,
      source: {
        artifactId: 'owner-review-sicily-map',
        sha256: '6c1101ce3467d4065d64bf906fc6cf07f8e71be456482ab1a75e1649767eca7d',
        mediaType: 'image/jpeg',
        staticFileKey: 'visual-lab/factual-owner-cut/sicily-map-cc0.jpg',
      },
      sourceWidth: 1080,
      sourceHeight: 597,
    },
  ],
  components: [],
  componentManifestHash: zeroHash,
  componentQcHash: zeroHash,
  captions: [
    {
      id: 'proof-caption-rommel',
      startFrame: 15,
      endFrameExclusive: 140,
      text: 'Erwin Rommel',
    },
    {
      id: 'proof-caption-sicily',
      startFrame: 165,
      endFrameExclusive: 290,
      text: 'Sicily',
    },
  ],
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

export const PRODUCTION_CAPTION_HIERARCHY_PROOF_SPEC = proofSpec;

export const ProductionCaptionHierarchyProof: React.FC<WarChessRenderSpec> = (props) => (
  <WarChessComposition {...props} />
);
