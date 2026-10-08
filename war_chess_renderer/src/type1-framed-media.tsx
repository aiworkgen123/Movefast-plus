import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

import {WarChessMediaPresentation} from './canonical/media-presentation';
import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from './editorial-theme';

export type WarChessType1FramedMediaProps = {
  durationFrames: number;
  imagePath: string;
  imageSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  headline: string;
  supportingText: string;
  emphasisTerms: string[];
  align: 'left' | 'right';
  surfaceEffect: 'fine_35mm_grain' | 'vignette' | 'engraving_halftone';
  treatmentLabel: string;
};

/**
 * Owner-approved no-line Type 1 treatment for ordinary framed historical
 * media. This is the reusable renderer component promoted from the accepted
 * review proof; typography and geometry are intentionally literal.
 */
export const WarChessType1FramedMedia: React.FC<
  WarChessType1FramedMediaProps
> = (props) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(
    frame,
    [Math.max(11, props.durationFrames - 12), props.durationFrames - 1],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

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
        textOverlay={null}
      />
      <div
        data-war-chess-type1-text="true"
        style={{
          position: 'absolute',
          left: props.align === 'left' ? 72 : undefined,
          right: props.align === 'right' ? 72 : undefined,
          top: 360,
          width: 510,
          opacity: enter * exit,
          translate: `0 ${interpolate(enter, [0, 1], [18, 0])}px`,
          textAlign: props.align,
          color: '#f4f2eb',
        }}
      >
        <div
          data-war-chess-type1-headline="true"
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 0.94,
            letterSpacing: -1.3,
          }}
        >
          {props.headline}
        </div>
        <div
          data-war-chess-type1-support="true"
          style={{
            marginTop: 20,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 23,
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: 0.7,
            color: 'rgba(244,242,235,.72)',
          }}
        >
          {props.supportingText}
        </div>
      </div>
      <div
        data-war-chess-type1-treatment-label="true"
        style={{
          position: 'absolute',
          top: 44,
          right: 58,
          color: 'rgba(244,242,235,.66)',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 3.2,
          textTransform: 'uppercase',
        }}
      >
        {props.treatmentLabel}
      </div>
    </AbsoluteFill>
  );
};
