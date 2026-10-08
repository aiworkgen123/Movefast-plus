import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';

import {WarChessWC08Canonical} from '../canonical/canonical-components';
import {WarChessMediaPresentation} from '../canonical/media-presentation';

export const IDENTITY_PLACE_PROOF_DURATION = 120;

const palette = {
  stage: '#17130f',
  paper: '#f1e7d2',
  amber: '#d7b275',
  signal: '#b94b39',
  muted: '#a8977f',
  line: '#5c4934',
  slate: '#7b8a8e',
};

/**
 * Review-only WC08 proof. Sicily is supplied by the owner narration and is
 * explicitly not inferred from the archival documentary footage.
 */
export const IdentityPlaceProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#020202'}}>
    <WarChessMediaPresentation
      mediaKind="clip"
      media={{
        path: 'visual-lab/historical-footage/patton-command-context.mp4',
        sha256:
          '113a5aa0211c2aaa7b5c4cabb485694cfc00f9f6c96dfec164ed93b3ebb03d70',
      }}
      durationFrames={IDENTITY_PLACE_PROOF_DURATION}
      startFromFrames={0}
      sourceWidth={320}
      sourceHeight={240}
      surfaceEffect="vignette"
      surfaceIntensity={0.9}
      presentationEffect="film_dust"
      presentationIntensity={1}
      presentationMode="stay_framed"
      frameAlways
      textOverlay={null}
    />
    <WarChessWC08Canonical
      componentId="WC08"
      overlayOnly
      underlyingMedia={{
        path: 'assets/transparent-overlay.svg',
        sha256:
          '83b53a36bac830bbb0da24db13f7a2a21fa7ac27af4f33d63343cbcee56978e5',
      }}
      labels={[
        {key: 'IDENTITY', value: 'GEORGE S. PATTON'},
        {key: 'NARRATED SETTING', value: 'SICILY'},
        {key: 'SOURCE TYPE', value: 'U.S. ARMY DOCUMENTARY'},
      ]}
      eyebrow="IDENTITY / PLACE ORIENTATION"
      rightTag="CONTEXT FOOTAGE · NOT SICILY EVIDENCE"
      footer="Narrated setting and footage provenance remain separately bound."
      palette={palette}
    />
    <Sequence from={26} durationInFrames={50}>
      <Audio
        src={staticFile('visual-lab/historical-footage/patton-line.wav')}
      />
    </Sequence>
  </AbsoluteFill>
);
