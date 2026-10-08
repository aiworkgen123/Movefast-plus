import React from 'react';

import {
  AnchoredProgression,
} from '../anchored-progression';
import type {AnchoredProgressionConfig} from '../anchored-progression-config';

export const NAPOLEON_REAL_CHESS_PHASE_DURATION = 557;

export const NAPOLEON_REAL_CHESS_PHASE_CONFIG: AnchoredProgressionConfig = {
  relationship: 'progression',
  anchorKind: 'person',
  anchorSide: 'left',
  anchorLabel: 'COMMANDER',
  anchorTitle: 'Napoleon\nBonaparte',
  relationshipLabel: 'WAR → CHESS',
  anchorCutoutStaticFileKey:
    'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
  anchorBackgroundStaticFileKey: 'visual-lab/historical-documents/napoleon-study.jpg',
  anchorSourceCredit: 'Jacques-Louis David · 1812',
  audioStaticFileKey:
    'visual-lab/historical-documents/three-boards-opening-middle-end.wav',
  durationInFrames: NAPOLEON_REAL_CHESS_PHASE_DURATION,
  dockStartFrame: 58,
  dockEndFrame: 104,
  closeStartFrame: 496,
  closeEndFrame: 528,
  finalMessage: 'Same commander. Sharper choices.',
  finalDetail: 'OPENING · MIDDLEGAME · ENDGAME',
  showIndex: true,
  items: [
    {
      id: 'opening',
      label: 'OPENING',
      title: 'First Command',
      detail: 'The position is established.',
      imageStaticFileKey: 'visual-lab/phase-progression-real/pexels-tima-6598739.jpg',
      imageObjectPosition: '58% 52%',
      sourceCredit: 'Tima Miroshnichenko · Pexels',
      accent: '#c89a4a',
      startFrame: 88,
      endFrame: 238,
    },
    {
      id: 'middlegame',
      label: 'MIDDLEGAME',
      title: 'Pure Calculation',
      detail: 'The prepared book runs out.',
      imageStaticFileKey: 'visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg',
      imageObjectPosition: '62% 54%',
      sourceCredit: 'Sudarson Alwin · Pexels',
      accent: '#b44d3a',
      startFrame: 210,
      endFrame: 399,
    },
    {
      id: 'endgame',
      label: 'ENDGAME',
      title: 'Better Technique',
      detail: 'Fewer pieces. Less room for error.',
      imageStaticFileKey: 'visual-lab/phase-progression-real/pexels-cottonbro-8656670.jpg',
      imageObjectPosition: '58% 66%',
      sourceCredit: 'cottonbro studio · Pexels',
      accent: '#78969a',
      startFrame: 371,
      endFrame: 522,
    },
  ],
};

export const NapoleonRealChessPhaseProof: React.FC = () => (
  <AnchoredProgression {...NAPOLEON_REAL_CHESS_PHASE_CONFIG} />
);
