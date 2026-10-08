import React from 'react';

import {ComponentLayer} from '../components';
import {RenderComponentSchema} from '../schema';

const hash = '0000000000000000000000000000000000000000000000000000000000000000';

const asset = (artifactId: string, staticFileKey: string) => ({
  artifactId,
  sha256: hash,
  mediaType: 'image/png',
  staticFileKey,
});

export const ANCHORED_PROGRESSION_PRODUCTION_DURATION = 557;

const component = RenderComponentSchema.parse({
  componentId: 'component.owner-approved-anchored-progression-v2',
  componentType: 'WC02',
  presentationVariant: 'anchored_progression_v2',
  parentUnitIds: ['unit-opening', 'unit-middlegame', 'unit-endgame'],
  layer: 'full_screen',
  baseSceneIds: ['scene-opening', 'scene-middlegame', 'scene-endgame'],
  startFrame: 0,
  endFrameExclusive: ANCHORED_PROGRESSION_PRODUCTION_DURATION,
  evidenceIds: ['evidence-anchor', 'evidence-opening', 'evidence-middle', 'evidence-end'],
  acceptedScopeHash: hash,
  subject: 'Napoleon Bonaparte',
  subjectRole: 'Commander',
  anchorKind: 'person',
  relationship: 'progression',
  relationshipLabel: 'WAR → CHESS',
  subjectImage: asset(
    'asset-napoleon-background',
    'visual-lab/historical-documents/napoleon-study.jpg',
  ),
  subjectCutout: asset(
    'asset-napoleon-cutout',
    'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
  ),
  steps: [
    {
      stepId: 'opening',
      label: 'OPENING',
      title: 'First Command',
      detail: 'The position is established.',
      evidenceIds: ['evidence-opening'],
      media: asset(
        'asset-opening',
        'visual-lab/phase-progression-real/pexels-tima-6598739.jpg',
      ),
    },
    {
      stepId: 'middlegame',
      label: 'MIDDLEGAME',
      title: 'Pure Calculation',
      detail: 'The prepared book runs out.',
      evidenceIds: ['evidence-middle'],
      media: asset(
        'asset-middle',
        'visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg',
      ),
    },
    {
      stepId: 'endgame',
      label: 'ENDGAME',
      title: 'Better Technique',
      detail: 'Fewer pieces. Less room for error.',
      evidenceIds: ['evidence-end'],
      media: asset(
        'asset-end',
        'visual-lab/phase-progression-real/pexels-cottonbro-8656670.jpg',
      ),
    },
  ],
});

export const AnchoredProgressionProductionProof: React.FC = () => (
  <ComponentLayer component={component} />
);
