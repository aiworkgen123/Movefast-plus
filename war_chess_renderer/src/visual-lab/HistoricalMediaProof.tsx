import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
} from 'remotion';

import {WarChessType1FramedMedia} from '../type1-framed-media';

const FPS = 30;
export const HISTORICAL_MEDIA_PROOF_DURATION = 278;

/**
 * Review-only proof of the ordinary historical-media editing family.
 * It uses the owner's real VO excerpt and rights-recorded archival portraits.
 */
export const HistoricalMediaProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#020202'}}>
    <Audio
      src={staticFile('visual-lab/historical-media/rommel-patton-montgomery.wav')}
    />
    <Sequence from={0} durationInFrames={132} premountFor={FPS}>
      <WarChessType1FramedMedia
        durationFrames={132}
        imagePath="visual-lab/historical-media/rommel-1941.jpg"
        imageSha256="3c645ef576f019c450612c9697ee31568ae92f0b4953db65f1f7a930924624b3"
        sourceWidth={1205}
        sourceHeight={1531}
        headline="Erwin Rommel"
        supportingText="Napoleon's campaigns · Western Desert"
        emphasisTerms={['ROMMEL', 'Western Desert']}
        align="left"
        surfaceEffect="fine_35mm_grain"
        treatmentLabel="Archival portrait · restrained grain"
      />
    </Sequence>
    <Sequence from={120} durationInFrames={96} premountFor={FPS}>
      <WarChessType1FramedMedia
        durationFrames={96}
        imagePath="visual-lab/historical-media/patton.jpg"
        imageSha256="64cdde6652dacd66d9be24b53ceecbb5fcceaa53038d3482b3fc7f3d73806aea"
        sourceWidth={2752}
        sourceHeight={3594}
        headline="George S. Patton"
        supportingText="Napoleon's campaigns kept close in Sicily"
        emphasisTerms={['PATTON', 'Sicily']}
        align="right"
        surfaceEffect="vignette"
        treatmentLabel="Identity portrait · controlled vignette"
      />
    </Sequence>
    <Sequence from={204} durationInFrames={74} premountFor={FPS}>
      <WarChessType1FramedMedia
        durationFrames={74}
        imagePath="visual-lab/historical-media/montgomery-1944.jpg"
        imageSha256="4d1126b9c0717c1eff3530d2f73f1e4f198c06f1ace48e9ac31f015735656bb3"
        sourceWidth={2480}
        sourceHeight={3305}
        headline="Bernard Montgomery"
        supportingText="Lectured on the campaigns at Sandhurst"
        emphasisTerms={['MONTGOMERY', 'Sandhurst']}
        align="left"
        surfaceEffect="engraving_halftone"
        treatmentLabel="Archive print · engraving treatment"
      />
    </Sequence>
  </AbsoluteFill>
);
