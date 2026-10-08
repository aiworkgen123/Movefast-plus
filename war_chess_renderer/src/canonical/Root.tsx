import React from 'react';
import {Composition} from 'remotion';
import {COMPATIBILITY_ALLOWLIST, PRODUCTION_ALLOWLIST} from './production-allowlist';
import {MEDIA_PRESENTATION_COMPOSITION_ID} from './production-allowlist';
import {WarChessWCFX01Canonical, WarChessWC01Canonical, WarChessWC02Canonical, WarChessWC04AdaptiveTacticalMapCanonical, WarChessWC04AdaptiveTacticalMapV2Canonical, WarChessWC04MovementCanonical, WarChessRankedCanonical, WarChessWC06Canonical, WarChessWC07Canonical, WarChessWC08Canonical, WarChessWC09Canonical, WarChessWC10Canonical, WarChessWC11Canonical, WarChessWC12Canonical} from './canonical-components';
import {WarChessMediaPresentation} from './media-presentation';
import {MediaPresentationPropsSchema} from './production-contracts';
import type {MediaPresentationProps} from './production-contracts';

/**
 * Every registration below points at the extracted approved implementation.
 * The canonical wrappers validate external project props before handing them
 * to that implementation; no registration supplies defaultProps.
 */
const CANONICAL_COMPONENTS = {
  WarChessWC01: WarChessWC01Canonical,
  WarChessWC02: WarChessWC02Canonical,
  WarChessWC04CChessEnhanced: WarChessWC04MovementCanonical,
  WarChessMapRankedPiecesV2: WarChessRankedCanonical,
  WarChessWC04AdaptiveTacticalMap: WarChessWC04AdaptiveTacticalMapCanonical,
  WarChessWC04AdaptiveTacticalMapV2: WarChessWC04AdaptiveTacticalMapV2Canonical,
  WarChessWC06ChessEvaluation: WarChessWC06Canonical,
  WarChessWC07: WarChessWC07Canonical,
  WarChessWC08: WarChessWC08Canonical,
  WarChessWC09: WarChessWC09Canonical,
  WarChessWC10StrategicDecisionForkV7: WarChessWC10Canonical,
  WarChessWC11CampaignTimeline: WarChessWC11Canonical,
  WarChessWC12NamedPersonOverlay: WarChessWC12Canonical,
  WarChessWCFX01: WarChessWCFX01Canonical,
} as const;

const MEDIA_PRESENTATION_DEFAULT_PROPS: MediaPresentationProps = {
  mediaKind: 'still',
  media: {
    path: 'assets/media-presentation-placeholder.svg',
    sha256: '6c3b14c76af871250c589cc0500d8e7fa6013e7b51f8c14130fbb903c4df4e06',
  },
  durationFrames: 150,
  startFromFrames: 0,
  sourceWidth: 1920,
  sourceHeight: 1080,
  surfaceEffect: 'fine_35mm_grain',
  surfaceIntensity: 0.9,
  presentationEffect: 'film_dust',
  presentationIntensity: 1,
  presentationMode: 'stay_framed',
  frameAlways: true,
  textOverlay: null,
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={MEDIA_PRESENTATION_COMPOSITION_ID}
      component={WarChessMediaPresentation}
      schema={MediaPresentationPropsSchema}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={240}
      defaultProps={MEDIA_PRESENTATION_DEFAULT_PROPS}
      calculateMetadata={({props}) => ({
        durationInFrames: props.durationFrames,
      })}
    />
    {PRODUCTION_ALLOWLIST.map((entry) => {
      const component = CANONICAL_COMPONENTS[entry.canonicalComposition as keyof typeof CANONICAL_COMPONENTS];
      return <Composition key={entry.canonicalComposition} id={entry.canonicalComposition} component={component as React.ComponentType<Record<string, unknown>>} width={1920} height={1080} fps={30} durationInFrames={entry.durationInFrames} />;
    })}
    {COMPATIBILITY_ALLOWLIST.map((entry) => (
      <Composition key={entry.canonicalComposition} id={entry.canonicalComposition} component={CANONICAL_COMPONENTS[entry.canonicalComposition as keyof typeof CANONICAL_COMPONENTS] as React.ComponentType<Record<string, unknown>>} width={1920} height={1080} fps={30} durationInFrames={entry.durationInFrames} />
    ))}
  </>
);
