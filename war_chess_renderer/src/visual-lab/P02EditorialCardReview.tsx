import React from 'react';

import {ApprovedEditorialCard} from '../approved-components';

export const P02_EDITORIAL_CARD_REVIEW_DURATION = 150;

/** Review composition backed by the exact production P02 renderer. */
export const P02EditorialCardReview: React.FC = () => (
  <ApprovedEditorialCard
    componentId="p02-editorial-card-review"
    parentUnitIds={['review-unit']}
    componentType="P02"
    layer="full_screen"
    baseSceneIds={['review-scene']}
    startFrame={0}
    endFrameExclusive={P02_EDITORIAL_CARD_REVIEW_DURATION}
    evidenceIds={['owner-approved-p02-review']}
    acceptedScopeHash={'0'.repeat(64)}
    headline="The source changes the question"
    source={{
      artifactId: 'p02-editorial-card-review-still',
      sha256: '1'.repeat(64),
      mediaType: 'image/jpeg',
      staticFileKey: 'visual-lab/p02-editorial-card/fixture-still.jpg',
    }}
  />
);
