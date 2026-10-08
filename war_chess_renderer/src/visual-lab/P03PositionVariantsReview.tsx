import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';

import {ApprovedWholeWordHighlight} from '../approved-components';
import type {RenderComponent} from '../schema';

type P03Component = Extract<RenderComponent, {componentType: 'P03'}>;

const SEGMENT_DURATION = 120;
const placements: P03Component['placement'][] = [
  'bottom-left',
  'bottom-right',
  'top-left',
  'center-left',
];

const reviewComponent = (placement: P03Component['placement']): P03Component => ({
  componentId: `p03-review-${placement}`,
  parentUnitIds: ['p03-review-unit'],
  componentType: 'P03',
  layer: 'full_screen',
  baseSceneIds: ['p03-review-scene'],
  startFrame: 0,
  endFrameExclusive: SEGMENT_DURATION,
  evidenceIds: ['owner-approved-p03-review'],
  acceptedScopeHash: '0'.repeat(64),
  headline: 'A cosmic scale',
  highlightWords: ['cosmic'],
  placement,
  source: {
    artifactId: 'p03-position-review-still',
    sha256: '1'.repeat(64),
    mediaType: 'image/jpeg',
    staticFileKey: 'visual-lab/p03-position-variants/fixture-still.jpg',
  },
});

export const P03_POSITION_VARIANTS_REVIEW_DURATION =
  SEGMENT_DURATION * placements.length;

/** Approval review backed by the exact production P03 renderer. */
export const P03PositionVariantsReview: React.FC = () => (
  <AbsoluteFill>
    {placements.map((placement, index) => (
      <Sequence
        key={placement}
        from={index * SEGMENT_DURATION}
        durationInFrames={SEGMENT_DURATION}
      >
        <ApprovedWholeWordHighlight {...reviewComponent(placement)} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
