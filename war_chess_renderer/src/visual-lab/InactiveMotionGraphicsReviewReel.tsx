import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';

import {
  WarChessWC02SubjectIntroduction,
} from '../canonical/extracted/war-chess-review-library';
import {
  WarChessWC04CChessEnhanced,
  type WarChessWC04MovementProps,
} from '../canonical/extracted/war-chess-wc04-variants';
import {
  WarChessMapRankedPiecesV2,
  type WarChessMapRankedPiecesV2Props,
} from '../canonical/extracted/war-chess-map-ranked-pieces-v2';
import {
  WarChessAdaptiveTacticalMapV2Review,
} from '../canonical/war-chess-adaptive-tactical-map-v2';
import type {WC04AdaptiveTacticalMapV2Props} from '../canonical/production-contracts';
import {StrategicDecisionForkProof} from './StrategicDecisionForkProof';
import {CampaignChronologyProof} from './CampaignChronologyProof';

const WC02_DURATION = 270;
const WC04_STATIC_DURATION = 240;
const WC04_TACTICAL_DURATION = 240;
const WC04_RANKED_DURATION = 318;
const WC10_DURATION = 210;
const WC11_DURATION = 240;

export const INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS = [
  {number: 1, name: 'WC02 · PERSON CUTOUT + CARDS', startFrame: 0, durationInFrames: WC02_DURATION},
  {number: 2, name: 'WC04 · STATIC POSITIONS', startFrame: WC02_DURATION, durationInFrames: WC04_STATIC_DURATION},
  {number: 3, name: 'WC04 · TACTICAL MOVEMENT', startFrame: WC02_DURATION + WC04_STATIC_DURATION, durationInFrames: WC04_TACTICAL_DURATION},
  {number: 4, name: 'WC04 · RANKED FORMATION', startFrame: WC02_DURATION + WC04_STATIC_DURATION + WC04_TACTICAL_DURATION, durationInFrames: WC04_RANKED_DURATION},
  {number: 5, name: 'WC10 · STRATEGIC DECISION FORK', startFrame: WC02_DURATION + WC04_STATIC_DURATION + WC04_TACTICAL_DURATION + WC04_RANKED_DURATION, durationInFrames: WC10_DURATION},
  {number: 6, name: 'WC11 · CAMPAIGN CHRONOLOGY', startFrame: WC02_DURATION + WC04_STATIC_DURATION + WC04_TACTICAL_DURATION + WC04_RANKED_DURATION + WC10_DURATION, durationInFrames: WC11_DURATION},
] as const;

export const INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_DURATION = 1518;

const mapPath = 'visual-lab/maps/campaign-1812.jpg';
const mapSha256 = 'ea088f61833d02f1cdba2855131879510fa2b074454af18ef3043873e1fe0ce0';
const zeroHash = '0000000000000000000000000000000000000000000000000000000000000000';

const wc02Palette = {
  stage: '#17130f',
  paper: '#f1e7d2',
  amber: '#d7b275',
  signal: '#b94b39',
  muted: '#a8977f',
};

const mapSelection = {
  schemaVersion: 'war-chess-map-selection-receipt.v1',
  transactionId: 'inactive-motion-graphics-review-reel-map',
  mapRung: 'exact_battle_campaign' as const,
  selectionReceiptHash: 'd6182ab04b11915fba15b6330d35df52437d77f1f8d50f02f962da9c3f54a532',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:EB1911-19-0227-a-Napoleonic_Campaigns,_Campaign_of_1812.jpg',
  sourcePageTitle: 'Napoleonic Campaigns, Campaign of 1812',
  exactMapExhausted: false,
  regionalMapExhausted: false,
  webMapsUsable: true,
  createdMap: false,
  strongGreyTreatment: {
    filter: 'grayscale(.45) saturate(.55) brightness(.78) contrast(1.06)',
    veil: 'rgba(45,48,50,0.18)',
    layerOrder: 'map_then_veil_then_arrows_and_pieces',
  } as const,
};

const staticPositionsProps: Extract<WC04AdaptiveTacticalMapV2Props, {mapStoryMode: 'static_positions'}> = {
  componentId: 'WC04',
  mode: 'adaptive_tactical_map',
  referenceVersion: 2,
  mapStoryMode: 'static_positions',
  map: {path: mapPath, sha256: mapSha256},
  mapSelection,
  semanticContextHash: zeroHash,
  supportedClaimIds: ['review-static-positions'],
  contextBasis: [{source: 'owner_review', ref: 'static-position-markers'}],
  visualClaim: 'Review-only static position markers',
  visualClaimEvidence: {
    source: 'review-static-position-markers',
    quote: 'Static markers show relative positions for visual review.',
    claimType: 'visual_claim',
    supportedFields: ['staticMarkers', 'zones', 'connectors'],
  },
  displayTitle: 'Static positions',
  labels: {title: 'Static positions · reviewed map'},
  startFrame: 0,
  endFrameExclusive: WC04_STATIC_DURATION,
  staticMarkers: [
    {id: 'north-ridge', actor: 'Field force A', markerType: 'formation', position: [0.28, 0.43], label: 'NORTH RIDGE'},
    {id: 'center-line', actor: 'Field force B', markerType: 'piece', position: [0.52, 0.54], label: 'CENTER LINE'},
    {id: 'south-pass', actor: 'Reserve', markerType: 'zone', position: [0.74, 0.68], label: 'SOUTH PASS'},
  ],
  zones: [{id: 'objective-zone', label: 'OBJECTIVE', position: [0.73, 0.38]}],
  connectors: [
    {id: 'north-to-center', from: [0.3, 0.44], to: [0.5, 0.53]},
    {id: 'center-to-south', from: [0.54, 0.55], to: [0.72, 0.67]},
  ],
  palette: {
    stage: '#242220',
    paper: '#f1e7d2',
    amber: '#d7b275',
    signal: '#b94b39',
    muted: '#a8977f',
    line: '#5b5144',
    slate: '#47494a',
  },
};

const tacticalMovementProps: WarChessWC04MovementProps = {
  map: mapPath,
  factions: [
    {name: 'FIELD FORCE A', image: 'visual-lab/historical-media/patton.jpg', role: 'CENTER'},
    {name: 'FIELD FORCE B', image: 'visual-lab/historical-media/rommel-1941.jpg', role: 'FLANKS'},
  ],
  stageLabels: ['ADVANCE', 'YIELD', 'FLANK CLEAR', 'REAR CLOSE'],
  eyebrow: 'TACTICAL MOVEMENT',
  reconstructionLabel: 'REVIEW-ONLY RECONSTRUCTION',
  evaluationLabel: 'POSITION → PRESSURE → ENCIRCLEMENT',
  leftAdvantageLabel: 'CENTER',
  rightAdvantageLabel: 'FLANKS',
  threatenedCenterLabel: 'CENTER UNDER PRESSURE',
  rearCloseLabel: 'REAR CLOSES',
  footer: 'EXISTING WC04 MOVEMENT IMPLEMENTATION',
};

const rankedProps: WarChessMapRankedPiecesV2Props = {
  map: mapPath,
  factions: [
    {name: 'FIELD FORCE A', image: 'visual-lab/historical-media/patton.jpg', role: 'CENTER'},
    {name: 'FIELD FORCE B', image: 'visual-lab/historical-media/rommel-1941.jpg', role: 'FLANKS'},
  ],
  eyebrow: 'RANKED FORMATION',
  mapCaption: 'RELATIVE RANKING · REVIEW ONLY',
  footer: 'EXISTING RANKED FORMATION IMPLEMENTATION',
  stageLabels: ['CENTER', 'FLANKS', 'REAR'],
};

const SectionLabel: React.FC<{number: number; name: string}> = ({number, name}) => (
  <div
    style={{
      position: 'absolute',
      top: 28,
      right: 34,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px 9px 10px',
      border: '1px solid rgba(244,242,235,.28)',
      background: 'rgba(12,11,9,.82)',
      color: '#f4f0e7',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: 1.8,
      whiteSpace: 'nowrap',
    }}
  >
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 99,
        background: '#c69346',
        color: '#18130e',
        fontSize: 14,
        letterSpacing: 0,
      }}
    >
      {String(number).padStart(2, '0')}
    </span>
    {name}
  </div>
);

const SectionFrame: React.FC<{
  number: number;
  name: string;
  children: React.ReactNode;
}> = ({number, name, children}) => (
  <AbsoluteFill style={{backgroundColor: '#11110f'}}>
    {children}
    <SectionLabel number={number} name={name} />
  </AbsoluteFill>
);

export const InactiveMotionGraphicsReviewReel: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#11110f', overflow: 'hidden'}}>
    <Sequence
      name="01 · WC02 person cutout and cards"
      from={INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS[0].startFrame}
      durationInFrames={WC02_DURATION}
      layout="none"
    >
      <SectionFrame number={1} name="WC02 · PERSON CUTOUT + CARDS">
        <WarChessWC02SubjectIntroduction
          subjectImage="visual-lab/historical-documents/napoleon-study.jpg"
          subjectCutout="visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png"
          subjectName="Napoleon Bonaparte"
          role="Campaign commander"
          storyPoints={['Establish the subject', 'Name the position', 'Read the consequence']}
          palette={wc02Palette}
          identityNote="Legacy person-cutout motion · review only"
          eyebrow="WC02 · SUBJECT INTRODUCTION"
          motionTag="CUTOUT → CARDS"
          assetTag="LOCAL REVIEW FIXTURE"
        />
      </SectionFrame>
    </Sequence>

    <Sequence
      name="02 · WC04 static positions"
      from={INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS[1].startFrame}
      durationInFrames={WC04_STATIC_DURATION}
      layout="none"
    >
      <SectionFrame number={2} name="WC04 · STATIC POSITIONS">
        <WarChessAdaptiveTacticalMapV2Review {...staticPositionsProps} />
      </SectionFrame>
    </Sequence>

    <Sequence
      name="03 · WC04 tactical movement"
      from={INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS[2].startFrame}
      durationInFrames={WC04_TACTICAL_DURATION}
      layout="none"
    >
      <SectionFrame number={3} name="WC04 · TACTICAL MOVEMENT">
        <WarChessWC04CChessEnhanced {...tacticalMovementProps} />
      </SectionFrame>
    </Sequence>

    <Sequence
      name="04 · WC04 ranked formation"
      from={INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS[3].startFrame}
      durationInFrames={WC04_RANKED_DURATION}
      layout="none"
    >
      <SectionFrame number={4} name="WC04 · RANKED FORMATION">
        <WarChessMapRankedPiecesV2 {...rankedProps} />
      </SectionFrame>
    </Sequence>

    <Sequence
      name="05 · WC10 strategic decision fork"
      from={INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS[4].startFrame}
      durationInFrames={WC10_DURATION}
      layout="none"
    >
      <SectionFrame number={5} name="WC10 · STRATEGIC DECISION FORK">
        <StrategicDecisionForkProof />
      </SectionFrame>
    </Sequence>

    <Sequence
      name="06 · WC11 campaign chronology"
      from={INACTIVE_MOTION_GRAPHICS_REVIEW_REEL_SECTIONS[5].startFrame}
      durationInFrames={WC11_DURATION}
      layout="none"
    >
      <SectionFrame number={6} name="WC11 · CAMPAIGN CHRONOLOGY">
        <CampaignChronologyProof />
      </SectionFrame>
    </Sequence>
  </AbsoluteFill>
);
