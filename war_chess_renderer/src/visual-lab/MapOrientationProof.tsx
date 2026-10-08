import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WarChessAdaptiveTacticalMapV2Review} from '../canonical/war-chess-adaptive-tactical-map-v2';

export const MAP_ORIENTATION_PROOF_DURATION = 132;

const MapOrientationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, 120, 131], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#151515', opacity}}>
      <WarChessAdaptiveTacticalMapV2Review
        componentId="WC04"
        mode="adaptive_tactical_map"
        referenceVersion={2}
        mapStoryMode="orientation"
        map={{
          path: 'visual-lab/maps/campaign-1812.jpg',
          sha256:
            'ea088f61833d02f1cdba2855131879510fa2b074454af18ef3043873e1fe0ce0',
        }}
        mapSelection={{
          schemaVersion: 'war-chess-map-selection-receipt.v1',
          transactionId: 'visual-lab-map-orientation-02a',
          mapRung: 'exact_battle_campaign',
          selectionReceiptHash:
            'd6182ab04b11915fba15b6330d35df52437d77f1f8d50f02f962da9c3f54a532',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:EB1911-19-0227-a-Napoleonic_Campaigns,_Campaign_of_1812.jpg',
          sourcePageTitle: 'Napoleonic Campaigns, Campaign of 1812',
          exactMapExhausted: false,
          regionalMapExhausted: false,
          webMapsUsable: true,
          createdMap: false,
          strongGreyTreatment: {
            filter: 'grayscale(.45) saturate(.55) brightness(.78) contrast(1.06)',
            veil: 'rgba(45,48,50,0.18)',
            layerOrder: 'map_then_veil_then_arrows_and_pieces',
          },
        }}
        semanticContextHash="0cad5b45af13c4793ba990a379b87761b32f41018d729506f0ea174f2d651c0f"
        supportedClaimIds={['visible-map-labels-warsaw-moscow']}
        contextBasis={[
          {
            source: 'owner_voiceover',
            clauseId: 'hitler-studied-russian-campaign',
            ref: 'voiceover-16.58-20.10',
          },
          {
            source: 'identified_map_artifact',
            ref: 'campaign-1812-map-visible-labels',
          },
        ]}
        visualClaim="Regional orientation from Warsaw toward Moscow"
        visualClaimEvidence={{
          source: 'campaign-1812-map-visible-labels',
          quote: 'The map visibly labels Warsaw and Moscow.',
          claimType: 'visual_claim',
          supportedFields: ['map.path', 'regionRouteHighlight.label'],
        }}
        displayTitle="Russian Campaign · 1812"
        labels={{title: 'Russian Campaign · 1812'}}
        startFrame={0}
        endFrameExclusive={132}
        regionRouteHighlight={{
          kind: 'region',
          label: 'Warsaw · Moscow · geographic orientation',
          supportedClaimIds: ['visible-map-labels-warsaw-moscow'],
        }}
        palette={{
          stage: '#17130f',
          paper: '#f1e7d2',
          amber: '#d7b275',
          signal: '#b94b39',
          muted: '#a8977f',
          line: '#5b5144',
          slate: '#47494a',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 42,
          right: 56,
          zIndex: 10,
          padding: '11px 16px 9px',
          border: '1px solid rgba(244,242,235,.24)',
          background: 'rgba(0,0,0,.58)',
          color: 'rgba(244,242,235,.78)',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
        }}
      >
        Orientation only · no troop positions or movement
      </div>
    </AbsoluteFill>
  );
};

/** Review-only proof of the truthful orientation-map rung. */
export const MapOrientationProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#151515'}}>
    <MapOrientationScene />
    <Sequence from={13} durationInFrames={107}>
      <Audio src={staticFile('visual-lab/maps/russian-campaign-line.wav')} />
    </Sequence>
  </AbsoluteFill>
);
