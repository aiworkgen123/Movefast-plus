import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WarChessMediaPresentation} from '../canonical/media-presentation';

const FPS = 30;
export const HISTORICAL_DOCUMENTS_PROOF_DURATION = 259;

type ArtifactSceneProps = {
  durationFrames: number;
  imagePath: string;
  imageSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  headline: string;
  supportingText: string;
  emphasisTerms: string[];
  align: 'left' | 'right';
  placement: 'side' | 'footer';
  surfaceEffect: 'fine_35mm_grain' | 'vignette' | 'engraving_halftone';
  proofLabel: string;
};

const ArtifactScene: React.FC<ArtifactSceneProps> = (props) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(
    frame,
    [Math.max(13, props.durationFrames - 14), props.durationFrames - 1],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const footer = props.placement === 'footer';

  return (
    <AbsoluteFill style={{opacity: enter * exit}}>
      <WarChessMediaPresentation
        mediaKind="still"
        media={{path: props.imagePath, sha256: props.imageSha256}}
        durationFrames={props.durationFrames}
        startFromFrames={0}
        sourceWidth={props.sourceWidth}
        sourceHeight={props.sourceHeight}
        surfaceEffect={props.surfaceEffect}
        surfaceIntensity={0.9}
        presentationEffect="film_dust"
        presentationIntensity={1}
        presentationMode="stay_framed"
        frameAlways
        textOverlay={{
          role: 'place_date',
          headline: props.headline,
          supportingText: props.supportingText,
          emphasisTerms: props.emphasisTerms,
          placement: footer
            ? {
                x: 0.035,
                y: 0.825,
                width: 0.62,
                height: 0.14,
                align: 'left',
                safeAreaSource: 'visual_lab_reviewed_artifact_footer',
                subjectOverlapForbidden: true,
                headlineFontSize: 54,
                supportFontSize: 34,
                headlineLinesMax: 3,
                supportLinesMax: 2,
              }
            : {
                x: props.align === 'left' ? 0.035 : 0.695,
                y: 0.34,
                width: 0.27,
                height: 0.31,
                align: props.align,
                safeAreaSource: 'visual_lab_reviewed_artifact_margin',
                subjectOverlapForbidden: true,
                headlineFontSize: 54,
                supportFontSize: 34,
                headlineLinesMax: 3,
                supportLinesMax: 2,
              },
          animation: {
            enterStartFrame: 8,
            enterDurationFrames: 13,
            exitDurationFrames: 10,
            overshoot: false,
          },
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 42,
          right: 56,
          padding: '11px 16px 9px',
          border: '1px solid rgba(244,242,235,.2)',
          background: 'rgba(0,0,0,.46)',
          color: 'rgba(244,242,235,.72)',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 2.6,
          textTransform: 'uppercase',
        }}
      >
        {props.proofLabel}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Review-only proof of paintings, maps, documents, and engravings.
 * Labels describe the visible artifact; none claims that this exact copy was
 * personally handled by any person named in the narration.
 */
export const HistoricalDocumentsProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#020202'}}>
    <Audio
      src={staticFile(
        'visual-lab/historical-documents/russian-campaign-context.wav',
      )}
    />
    <Sequence from={0} durationInFrames={116} premountFor={FPS}>
      <ArtifactScene
        durationFrames={116}
        imagePath="visual-lab/historical-documents/campaign-1812.jpg"
        imageSha256="ea088f61833d02f1cdba2855131879510fa2b074454af18ef3043873e1fe0ce0"
        sourceWidth={1080}
        sourceHeight={674}
        headline="CAMPAIGN OF 1812"
        supportingText="Period campaign context · Encyclopædia Britannica, 1911"
        emphasisTerms={['1812', 'campaign']}
        align="left"
        placement="footer"
        surfaceEffect="fine_35mm_grain"
        proofLabel="Context artifact · not personal-study evidence"
      />
    </Sequence>
    <Sequence from={104} durationInFrames={104} premountFor={FPS}>
      <ArtifactScene
        durationFrames={104}
        imagePath="visual-lab/historical-documents/napoleon-study.jpg"
        imageSha256="d6a1bf8fb6608ccf3af8518ed3d509a0efe48a114c1f2fcf2a70f9e63da9c70d"
        sourceWidth={3079}
        sourceHeight={5135}
        headline="NAPOLEON IN HIS STUDY"
        supportingText="Jacques-Louis David · 1812"
        emphasisTerms={['NAPOLEON', '1812']}
        align="left"
        placement="side"
        surfaceEffect="vignette"
        proofLabel="Period painting · identified work"
      />
    </Sequence>
    <Sequence from={196} durationInFrames={63} premountFor={FPS}>
      <ArtifactScene
        durationFrames={63}
        imagePath="visual-lab/historical-documents/napoleon-engraving-1817.jpg"
        imageSha256="656b4d9b9a51b92d4bbf96ee68e13ff02146989f761ecbd9b9953ddf0ae9bc83"
        sourceWidth={4046}
        sourceHeight={5658}
        headline="NAPOLÉON BUONAPARTE"
        supportingText="Etching and engraving · 1817 · Rijksmuseum"
        emphasisTerms={['NAPOLÉON', '1817']}
        align="right"
        placement="side"
        surfaceEffect="engraving_halftone"
        proofLabel="Dated engraving · museum record"
      />
    </Sequence>
  </AbsoluteFill>
);
