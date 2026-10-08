import React from 'react';

import {WarChessComposition} from '../WarChessComposition';
import type {RenderScene, WarChessRenderSpec} from '../schema';

export const MIXED_FRAME_TREATMENT_PROOF_DURATION = 750;

const zeroHash = '0'.repeat(64);
const accentEvidenceHash = '1'.repeat(64);

type StillScene = Extract<RenderScene, {kind: 'animated_still'}>;

const still = (
  sceneId: string,
  startFrame: number,
  basename: string,
  sha256: string,
  sourceWidth: number,
  sourceHeight: number,
  frameTreatment: StillScene['frameTreatment'],
  seed: number,
): StillScene => ({
  kind: 'animated_still',
  sceneId,
  parentUnitId: `${sceneId}-unit`,
  startFrame,
  endFrameExclusive: startFrame + 150,
  routeId: 'proof-selected-still',
  treatment: {
    surfaceEffect: 'fine_35mm_grain',
    presentationEffect: 'film_dust',
    presentationMode: 'stay_framed',
    seed,
  },
  acceptedScopeHash: zeroHash,
  source: {
    artifactId: `reviewed-${basename}`,
    sha256,
    mediaType: 'image/jpeg',
    staticFileKey: `visual-lab/factual-owner-cut/${basename}`,
  },
  sourceWidth,
  sourceHeight,
  frameTreatment,
});

const proofSpec: WarChessRenderSpec = {
  schemaVersion: 'vpp-war-chess-render-spec.v1',
  jobId: 'review-mixed-frame-treatment-proof',
  templateId: 'war_chess',
  templateVersion: 'r4',
  compositionId: 'WarChessMaster',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: MIXED_FRAME_TREATMENT_PROOF_DURATION,
  voiceover: {
    artifactId: 'owner-voiceover-62-9s',
    sha256: '03a27ab1d3a2631d3e6396bb1fd3b7ae5b993a1b34764bece53121fbceae0236',
    mediaType: 'audio/wav',
    staticFileKey: 'visual-lab/factual-owner-cut/voiceover-62.9s.wav',
  },
  scenes: [
    still(
      'proof-rommel-reveal',
      0,
      'rommel-1917.jpg',
      '3998197160b4a4439fd6c1f94edb095cc4bdada08fa0b75f6656fbde6861ffb9',
      1096,
      1651,
      {
        style: 'animated_signal_yellow',
        reason: 'solo_person_reveal',
        visibleSubject: 'Erwin Rommel',
        evidenceHash: accentEvidenceHash,
      },
      17,
    ),
    still(
      'proof-montgomery-basic',
      150,
      'montgomery-1943.jpg',
      '6273d5202e8933cb52300dc2ae40865fece845e1ef4246438a5e2326a0ad5605',
      3215,
      4020,
      {style: 'basic_static'},
      23,
    ),
    still(
      'proof-patton-basic',
      300,
      'patton-1943.jpg',
      '12533dbe8c6f1b388cd23e40dddf6693b16e3058551a062190736095f1961fab',
      1120,
      1400,
      {style: 'basic_static'},
      29,
    ),
    still(
      'proof-sicily-basic',
      450,
      'sicily-map-cc0.jpg',
      '6c1101ce3467d4065d64bf906fc6cf07f8e71be456482ab1a75e1649767eca7d',
      1080,
      597,
      {style: 'basic_static'},
      31,
    ),
    still(
      'proof-russia-basic',
      600,
      'russian-campaign-1812-map.jpg',
      '3ae4f6ac3c49601af60fdf24a2d8e0c09d4ae28c23f352b4fed46da585cf1bdf',
      2470,
      2122,
      {style: 'basic_static'},
      37,
    ),
  ],
  components: [],
  componentManifestHash: zeroHash,
  componentQcHash: zeroHash,
  captions: [
    {id: 'caption-rommel', startFrame: 15, endFrameExclusive: 140, text: 'Erwin Rommel'},
    {id: 'caption-montgomery', startFrame: 165, endFrameExclusive: 290, text: 'Bernard Montgomery'},
    {id: 'caption-patton', startFrame: 315, endFrameExclusive: 440, text: 'George S. Patton'},
    {id: 'caption-sicily', startFrame: 465, endFrameExclusive: 590, text: 'Sicily'},
    {id: 'caption-russia', startFrame: 615, endFrameExclusive: 740, text: 'Russian Campaign, 1812'},
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

export const MIXED_FRAME_TREATMENT_PROOF_SPEC = proofSpec;

export const MixedFrameTreatmentProof: React.FC<WarChessRenderSpec> = (props) => (
  <WarChessComposition {...props} />
);
