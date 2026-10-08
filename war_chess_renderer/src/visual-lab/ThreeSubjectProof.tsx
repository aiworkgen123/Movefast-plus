import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';

import {WarChessWC07ArchivalLayoutProof} from '../canonical/extracted/war-chess-review-library';

export const THREE_SUBJECT_PROOF_DURATION = 278;

/**
 * Review-only WC07 proof. Portrait identity comes from the recorded Commons
 * source pages; the owner's narrated study claims remain a separate fact gate.
 */
export const ThreeSubjectProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#15120f'}}>
    <Audio
      src={staticFile(
        'visual-lab/historical-media/rommel-patton-montgomery.wav',
      )}
    />
    <WarChessWC07ArchivalLayoutProof
      eyebrow="THREE COMMANDERS · ONE REFERENCE POINT"
      sideNote="WC07 · ARCHIVAL THREE-UP"
      footer="PORTRAIT IDENTITIES SOURCED · NARRATED STUDY CLAIMS PENDING FACT-CHECK"
      subjects={[
        {
          name: 'ERWIN ROMMEL · WESTERN DESERT',
          image: 'visual-lab/historical-media/rommel-1941.jpg',
        },
        {
          name: 'GEORGE S. PATTON · SICILY',
          image: 'visual-lab/historical-media/patton.jpg',
        },
        {
          name: 'BERNARD MONTGOMERY · SANDHURST',
          image: 'visual-lab/historical-media/montgomery-1944.jpg',
        },
      ]}
    />
  </AbsoluteFill>
);
