import React from 'react';

import {AnchoredProgression} from '../anchored-progression';
import type {AnchoredProgressionConfig} from '../anchored-progression-config';

const napoleonCutout =
  'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png';
const napoleonBackground = 'visual-lab/historical-documents/napoleon-study.jpg';

const image = (name: string): string => `visual-lab/phase-progression-real/${name}`;

export const ANCHORED_PROGRESSION_TWO_ITEM_DURATION = 420;

export const ANCHORED_PROGRESSION_TWO_ITEM_CONFIG: AnchoredProgressionConfig = {
  relationship: 'contrast',
  anchorKind: 'person',
  anchorSide: 'right',
  anchorLabel: 'COMMANDER',
  anchorTitle: 'Napoleon\nBonaparte',
  relationshipLabel: 'FIELD → BOARD',
  anchorCutoutStaticFileKey: napoleonCutout,
  anchorBackgroundStaticFileKey: napoleonBackground,
  anchorSourceCredit: 'Jacques-Louis David · 1812',
  durationInFrames: ANCHORED_PROGRESSION_TWO_ITEM_DURATION,
  dockStartFrame: 42,
  dockEndFrame: 82,
  closeStartFrame: 365,
  closeEndFrame: 402,
  finalMessage: 'One mind. Two arenas.',
  finalDetail: 'COMMAND → CALCULATION',
  items: [
    {
      id: 'field-command',
      label: 'FIELD',
      title: 'Command in Motion',
      detail: 'Pressure changes the available choices.',
      imageStaticFileKey: image('pexels-muhammed-18706253.jpg'),
      imageObjectPosition: '54% 54%',
      sourceCredit: 'Muhammed Arafath · Pexels',
      accent: '#b44d3a',
      startFrame: 76,
      endFrame: 230,
    },
    {
      id: 'board-command',
      label: 'BOARD',
      title: 'Calculation in Position',
      detail: 'The same pressure becomes visible on the board.',
      imageStaticFileKey: image('pexels-sudarson-36680436.jpg'),
      imageObjectPosition: '60% 52%',
      sourceCredit: 'Sudarson Alwin · Pexels',
      accent: '#78969a',
      startFrame: 202,
      endFrame: 370,
    },
  ],
};

export const AnchoredProgressionTwoItemProof: React.FC = () => (
  <AnchoredProgression {...ANCHORED_PROGRESSION_TWO_ITEM_CONFIG} />
);

export const ANCHORED_PROGRESSION_FIVE_ITEM_DURATION = 720;

export const ANCHORED_PROGRESSION_FIVE_ITEM_CONFIG: AnchoredProgressionConfig = {
  relationship: 'facets',
  anchorKind: 'person',
  anchorSide: 'left',
  anchorLabel: 'CENTRAL FIGURE',
  anchorTitle: 'Napoleon\nBonaparte',
  relationshipLabel: 'FIVE CONNECTED FACETS',
  anchorCutoutStaticFileKey: napoleonCutout,
  anchorBackgroundStaticFileKey: napoleonBackground,
  anchorSourceCredit: 'Jacques-Louis David · 1812',
  durationInFrames: ANCHORED_PROGRESSION_FIVE_ITEM_DURATION,
  dockStartFrame: 48,
  dockEndFrame: 94,
  closeStartFrame: 660,
  closeEndFrame: 702,
  finalMessage: 'One anchor. Five connected ideas.',
  finalDetail: 'EVIDENCE-BOUND · REUSABLE · EDITORIAL',
  items: [
    {
      id: 'position',
      label: 'POSITION',
      title: 'The Starting Shape',
      detail: 'Every decision begins from a concrete position.',
      imageStaticFileKey: image('pexels-tima-6598739.jpg'),
      imageObjectPosition: '58% 52%',
      accent: '#c89a4a',
      startFrame: 92,
      endFrame: 230,
    },
    {
      id: 'pressure',
      label: 'PRESSURE',
      title: 'The Threat Appears',
      detail: 'A visible constraint narrows the available choices.',
      imageStaticFileKey: image('pexels-muhammed-18706253.jpg'),
      imageObjectPosition: '55% 54%',
      accent: '#b44d3a',
      startFrame: 202,
      endFrame: 340,
    },
    {
      id: 'calculation',
      label: 'CALCULATION',
      title: 'The Options Separate',
      detail: 'Different routes carry different consequences.',
      imageStaticFileKey: image('pexels-sudarson-36680436.jpg'),
      imageObjectPosition: '62% 54%',
      accent: '#78969a',
      startFrame: 312,
      endFrame: 450,
    },
    {
      id: 'commitment',
      label: 'COMMITMENT',
      title: 'The Choice Is Made',
      detail: 'One route becomes the active line of play.',
      imageStaticFileKey: image('pexels-moises-caro-15379682.jpg'),
      imageObjectPosition: '56% 51%',
      accent: '#ad8a62',
      startFrame: 422,
      endFrame: 560,
    },
    {
      id: 'consequence',
      label: 'CONSEQUENCE',
      title: 'The Position Changes',
      detail: 'The result becomes the next starting point.',
      imageStaticFileKey: image('pexels-cottonbro-8656670.jpg'),
      imageObjectPosition: '58% 66%',
      accent: '#8a815f',
      startFrame: 532,
      endFrame: 668,
    },
  ],
};

export const AnchoredProgressionFiveItemProof: React.FC = () => (
  <AnchoredProgression {...ANCHORED_PROGRESSION_FIVE_ITEM_CONFIG} />
);
