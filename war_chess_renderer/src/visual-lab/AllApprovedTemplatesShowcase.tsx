import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {ComponentLayer} from '../components';
import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';
import {RenderComponentSchema} from '../schema';
import {
  ANCHORED_PROGRESSION_PRODUCTION_DURATION,
  AnchoredProgressionProductionProof,
} from './AnchoredProgressionProductionProof';
import {
  ARCHIVAL_DETAIL_SEQUENCE_DURATION,
  ArchivalDetailSequenceProof,
} from './ArchivalDetailSequenceProof';
import {
  CAMPAIGN_CHRONOLOGY_DURATION,
  CampaignChronologyProof,
} from './CampaignChronologyProof';
import {
  DOCUMENT_EVIDENCE_REVEAL_DURATION,
  DocumentEvidenceRevealProof,
} from './DocumentEvidenceRevealProof';
import {
  FORCE_COMPARISON_PROOF_DURATION,
  ForceComparisonProof,
} from './ForceComparisonProof';
import {
  HISTORICAL_DOCUMENTS_PROOF_DURATION,
  HistoricalDocumentsProof,
} from './HistoricalDocumentsProof';
import {
  HISTORICAL_FOOTAGE_PROOF_DURATION,
  HistoricalFootageProof,
} from './HistoricalFootageProof';
import {
  HISTORICAL_MEDIA_PROOF_DURATION,
  HistoricalMediaProof,
} from './HistoricalMediaProof';
import {
  NAMED_PERSON_OVERLAY_DURATION,
  NamedPersonOverlayProof,
} from './NamedPersonOverlayProof';
import {
  STRATEGIC_DECISION_FORK_DURATION,
  StrategicDecisionForkProof,
} from './StrategicDecisionForkProof';
import {
  TACTICAL_BLOCK_REINFORCEMENT_DURATION,
  TacticalBlockReinforcementProof,
} from './TacticalBlockReinforcementProof';
import {
  TACTICAL_BREAKTHROUGH_DURATION,
  TacticalBreakthroughProof,
} from './TacticalBreakthroughProof';
import {
  TACTICAL_COMMAND_TABLE_DURATION,
  TacticalCommandTableProof,
} from './TacticalCommandTableProof';
import {
  TACTICAL_COUNTERATTACK_DURATION,
  TacticalCounterattackProof,
} from './TacticalCounterattackProof';
import {
  TACTICAL_ENCIRCLEMENT_DURATION,
  TacticalEncirclementProof,
} from './TacticalEncirclementProof';
import {
  TACTICAL_FLANKING_DURATION,
  TacticalFlankingProof,
} from './TacticalFlankingProof';
import {
  TACTICAL_RETREAT_PURSUIT_DURATION,
  TacticalRetreatPursuitProof,
} from './TacticalRetreatPursuitProof';
import {
  THREE_PHASE_PROGRESSION_PROOF_DURATION,
  ThreePhaseProgressionProof,
} from './ThreePhaseProgressionProof';
import {
  TWO_SOURCE_CONTRAST_DURATION,
  TwoSourceContrastProof,
} from './TwoSourceContrastProof';
import {
  VERIFIED_STATISTIC_OVERLAY_DURATION,
  VerifiedStatisticOverlayProof,
} from './VerifiedStatisticOverlayProof';

const FPS = 30;
const INTRO_FRAMES = FPS * 3;
const CARD_FRAMES = 27;
const OUTRO_FRAMES = FPS * 4;
const ACTIVE_MAP_DURATION = 132;
const ACTIVE_CHESS_DURATION = 318;
const ACTIVE_THREE_UP_DURATION = 278;
const ACTIVE_IDENTITY_PLACE_DURATION = 120;

const zeroHash = '0000000000000000000000000000000000000000000000000000000000000000';
const evidenceIds = ['owner-approved-visual-system'];
const asset = (
  artifactId: string,
  staticFileKey: string,
  mediaType: 'image/png' | 'image/jpeg' = 'image/jpeg',
) => ({artifactId, sha256: zeroHash, mediaType, staticFileKey});
const activeChessPlan = {
  schemaVersion: 'war-chess-wc06-engine-receipt.v1' as const,
  status: 'verified' as const,
  motifId: 'knight_fork' as const,
  fen: '2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1',
  moves: [{ply: 1, uci: 'd5e7', caption: 'Move' as const}],
  principalVariation: ['d5e7'],
  engine: {name: 'Stockfish' as const, version: '18', settings: {depth: 12, movetimeMs: 400, threads: 1 as const, hashMb: 16, multipv: 1 as const}},
  score: {kind: 'cp' as const, value: 0},
  frozenBriefHash: zeroHash,
  componentBriefHash: zeroHash,
  receiptHash: zeroHash,
};
const base = (componentId: string, endFrameExclusive: number) => ({
  componentId,
  parentUnitIds: [`${componentId}-unit`],
  baseSceneIds: [`${componentId}-scene`],
  startFrame: 0,
  endFrameExclusive,
  evidenceIds,
  acceptedScopeHash: zeroHash,
});

const activeMap = RenderComponentSchema.parse({
  ...base('showcase-wc04-orientation', ACTIVE_MAP_DURATION),
  componentType: 'WC04',
  layer: 'full_screen',
  mode: 'orientation',
  title: 'The road toward Moscow',
  plate: {
    source: asset(
      'campaign-map-1812',
      'visual-lab/maps/campaign-1812.jpg',
    ),
    label: 'Geographic orientation only · no invented troop movement',
  },
  actors: [],
  movementSteps: [],
  ranks: [],
});

const activeChess = RenderComponentSchema.parse({
  ...base('showcase-wc06', ACTIVE_CHESS_DURATION),
  componentType: 'WC06',
  layer: 'full_screen',
  chessPlan: activeChessPlan,
  title: 'The reply was already in the line',
});

const activeThreeUp = RenderComponentSchema.parse({
  ...base('showcase-wc07', ACTIVE_THREE_UP_DURATION),
  componentType: 'WC07',
  layer: 'full_screen',
  title: 'Three commanders · one reference point',
  subjects: [
    {
      subjectId: 'rommel',
      label: 'Erwin Rommel · Western Desert',
      evidenceIds,
      subjectAsset: asset(
        'rommel-1941',
        'visual-lab/historical-media/rommel-1941.jpg',
      ),
    },
    {
      subjectId: 'patton',
      label: 'George S. Patton · Sicily',
      evidenceIds,
      subjectAsset: asset(
        'patton',
        'visual-lab/historical-media/patton.jpg',
      ),
    },
    {
      subjectId: 'montgomery',
      label: 'Bernard Montgomery · Sandhurst',
      evidenceIds,
      subjectAsset: asset(
        'montgomery-1944',
        'visual-lab/historical-media/montgomery-1944.jpg',
      ),
    },
  ],
});

const activeIdentityPlace = RenderComponentSchema.parse({
  ...base('showcase-wc08', ACTIVE_IDENTITY_PLACE_DURATION),
  componentType: 'WC08',
  layer: 'overlay',
  identity: 'George S. Patton',
  place: 'Sicily',
  label: 'Identity · narrated setting',
});

const ActiveMapProof: React.FC = () => <ComponentLayer component={activeMap} />;

const ActiveChessProof: React.FC = () => <ComponentLayer component={activeChess} />;

const ActiveThreeUpProof: React.FC = () => <ComponentLayer component={activeThreeUp} />;

const ActiveIdentityPlaceProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#0d0d0b', overflow: 'hidden'}}>
    <Img
      src={staticFile('visual-lab/historical-media/patton.jpg')}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center 22%',
        filter: 'grayscale(.62) sepia(.1) contrast(1.06) brightness(.82)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(90deg, rgba(7,7,6,.76), rgba(7,7,6,.08) 58%, rgba(7,7,6,.02))',
      }}
    />
    <ComponentLayer component={activeIdentityPlace} />
  </AbsoluteFill>
);

type ApprovedTemplate = {
  id: string;
  title: string;
  use: string;
  durationInFrames: number;
  Component: React.FC;
};

const APPROVED_TEMPLATES: readonly ApprovedTemplate[] = [
  {
    id: 'ORDINARY 01A',
    title: 'Archival identity portraits',
    use: 'A single person or historical subject carried by framed media and restrained motion.',
    durationInFrames: HISTORICAL_MEDIA_PROOF_DURATION,
    Component: HistoricalMediaProof,
  },
  {
    id: 'ORDINARY 01B',
    title: 'Paintings, maps and documents',
    use: 'Identified historical artifacts shown as evidence or period context.',
    durationInFrames: HISTORICAL_DOCUMENTS_PROOF_DURATION,
    Component: HistoricalDocumentsProof,
  },
  {
    id: 'ORDINARY 01C',
    title: 'Historical footage',
    use: 'Short archival clips with provenance-safe text and visible media priority.',
    durationInFrames: HISTORICAL_FOOTAGE_PROOF_DURATION,
    Component: HistoricalFootageProof,
  },
  {
    id: 'WC04 · ORIENTATION',
    title: 'Geographic orientation map',
    use: 'Place and route orientation without inventing troop positions or movement.',
    durationInFrames: ACTIVE_MAP_DURATION,
    Component: ActiveMapProof,
  },
  {
    id: 'WC06 · WB01',
    title: 'Pivotal chess analogy',
    use: 'A legal chess position used only when it clarifies a decisive strategic beat.',
    durationInFrames: ACTIVE_CHESS_DURATION,
    Component: ActiveChessProof,
  },
  {
    id: 'WC07',
    title: 'Three-subject archival layout',
    use: 'Three related people, places or objects compared in one evidence-bound beat.',
    durationInFrames: ACTIVE_THREE_UP_DURATION,
    Component: ActiveThreeUpProof,
  },
  {
    id: 'WC08',
    title: 'Identity and place overlay',
    use: 'A concise identity or location label added without hiding the underlying media.',
    durationInFrames: ACTIVE_IDENTITY_PLACE_DURATION,
    Component: ActiveIdentityPlaceProof,
  },
  {
    id: 'WC02 · PROGRESSION',
    title: 'Three-phase subject progression',
    use: 'One stable subject moves through genuinely related phases or consequences.',
    durationInFrames: THREE_PHASE_PROGRESSION_PROOF_DURATION,
    Component: ThreePhaseProgressionProof,
  },
  {
    id: 'WC01',
    title: 'Force comparison',
    use: 'Two evidence-backed forces or sides compared without turning the frame into a chart.',
    durationInFrames: FORCE_COMPARISON_PROOF_DURATION,
    Component: ForceComparisonProof,
  },
  {
    id: 'WC04 · COMMAND',
    title: 'Battlefield command table',
    use: 'A clean tactical overview using chess-piece actors and external labels.',
    durationInFrames: TACTICAL_COMMAND_TABLE_DURATION,
    Component: TacticalCommandTableProof,
  },
  {
    id: 'WC04 · BLOCK',
    title: 'Block and reinforcement',
    use: 'A defended line, blocking force or reinforcement entering a position.',
    durationInFrames: TACTICAL_BLOCK_REINFORCEMENT_DURATION,
    Component: TacticalBlockReinforcementProof,
  },
  {
    id: 'WC04 · ENCIRCLEMENT',
    title: 'Encirclement',
    use: 'Forces closing around a position from distinct directions.',
    durationInFrames: TACTICAL_ENCIRCLEMENT_DURATION,
    Component: TacticalEncirclementProof,
  },
  {
    id: 'WC04 · FLANK',
    title: 'Flanking movement',
    use: 'One force fixes the front while another moves around the side.',
    durationInFrames: TACTICAL_FLANKING_DURATION,
    Component: TacticalFlankingProof,
  },
  {
    id: 'WC04 · BREAKTHROUGH',
    title: 'Breakthrough',
    use: 'A force penetrates a defended line and opens a route beyond it.',
    durationInFrames: TACTICAL_BREAKTHROUGH_DURATION,
    Component: TacticalBreakthroughProof,
  },
  {
    id: 'WC04 · PURSUIT',
    title: 'Retreat and pursuit',
    use: 'One side withdraws while another follows along a distinct path.',
    durationInFrames: TACTICAL_RETREAT_PURSUIT_DURATION,
    Component: TacticalRetreatPursuitProof,
  },
  {
    id: 'WC04 · COUNTERATTACK',
    title: 'Counterattack',
    use: 'A committed attack is answered by a new movement from the defending side.',
    durationInFrames: TACTICAL_COUNTERATTACK_DURATION,
    Component: TacticalCounterattackProof,
  },
  {
    id: 'WC10',
    title: 'Strategic decision fork',
    use: 'Two to four real options are introduced, compared and resolved.',
    durationInFrames: STRATEGIC_DECISION_FORK_DURATION,
    Component: StrategicDecisionForkProof,
  },
  {
    id: 'WC11',
    title: 'Campaign chronology',
    use: 'Evidence-bound events progress in order without a decorative terminal arrow.',
    durationInFrames: CAMPAIGN_CHRONOLOGY_DURATION,
    Component: CampaignChronologyProof,
  },
  {
    id: 'WC12',
    title: 'Named-person overlay',
    use: 'A verified person enters over relevant media with concise role context.',
    durationInFrames: NAMED_PERSON_OVERLAY_DURATION,
    Component: NamedPersonOverlayProof,
  },
  {
    id: 'WC09',
    title: 'Verified statistic overlay',
    use: 'One important value and unit supported by one source-bound claim.',
    durationInFrames: VERIFIED_STATISTIC_OVERLAY_DURATION,
    Component: VerifiedStatisticOverlayProof,
  },
  {
    id: 'WC02 · V2',
    title: 'Anchored progression',
    use: 'One person, place or object remains visible while two to five related moments unfold.',
    durationInFrames: ANCHORED_PROGRESSION_PRODUCTION_DURATION,
    Component: AnchoredProgressionProductionProof,
  },
  {
    id: 'WC13',
    title: 'Document evidence reveal',
    use: 'Establish the whole document, then isolate the exact reviewed region.',
    durationInFrames: DOCUMENT_EVIDENCE_REVEAL_DURATION,
    Component: DocumentEvidenceRevealProof,
  },
  {
    id: 'WC14',
    title: 'Archival detail sequence',
    use: 'Two to four visible details are revealed from one identified source.',
    durationInFrames: ARCHIVAL_DETAIL_SEQUENCE_DURATION,
    Component: ArchivalDetailSequenceProof,
  },
  {
    id: 'WC15',
    title: 'Two-source contrast',
    use: 'Exactly two independent sources stay visually separate while a real contrast is made.',
    durationInFrames: TWO_SOURCE_CONTRAST_DURATION,
    Component: TwoSourceContrastProof,
  },
] as const;

export const ALL_APPROVED_TEMPLATES_SHOWCASE_DURATION =
  INTRO_FRAMES +
  OUTRO_FRAMES +
  APPROVED_TEMPLATES.reduce(
    (total, template) => total + CARD_FRAMES + template.durationInFrames,
    0,
  );

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const TitleCard: React.FC<{
  eyebrow: string;
  title: string;
  detail: string;
  durationInFrames: number;
}> = ({eyebrow, title, detail, durationInFrames}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames - 1], [1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 72% 42%, rgba(147,124,72,.18), transparent 34%), linear-gradient(135deg, #171711, #090a08 72%)',
        color: '#efe5cf',
        overflow: 'hidden',
        opacity: enter * exit,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 124,
          top: 242,
          width: 1330,
          transform: `translateY(${interpolate(enter, [0, 1], [28, 0], clamp)}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            color: '#c89a47',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: 5.6,
          }}
        >
          {eyebrow.toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 94,
            fontWeight: 700,
            letterSpacing: -2.4,
            lineHeight: 0.94,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 35,
            width: 930,
            color: '#b9b09d',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 31,
            fontWeight: 600,
            letterSpacing: 0.5,
            lineHeight: 1.3,
          }}
        >
          {detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => (
  <TitleCard
    eyebrow="War Chess visual library"
    title="Approved editing templates"
    detail="One reel of every locked editing and motion-graphics family. Sample media is for visual review; factual approval remains separate."
    durationInFrames={INTRO_FRAMES}
  />
);

const Outro: React.FC = () => (
  <TitleCard
    eyebrow="24 approved patterns"
    title="One reusable visual language"
    detail="No-line Type 1 typography · media-first composition · evidence-bound graphics · face-safe overlays"
    durationInFrames={OUTRO_FRAMES}
  />
);

export const AllApprovedTemplatesShowcase: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#090a08'}}>
    <Series>
      <Series.Sequence durationInFrames={INTRO_FRAMES} premountFor={FPS}>
        <Intro />
      </Series.Sequence>
      {APPROVED_TEMPLATES.flatMap(({id, title, use, durationInFrames, Component}) => [
        <Series.Sequence key={`${id}-card`} durationInFrames={CARD_FRAMES} premountFor={FPS}>
          <TitleCard eyebrow={id} title={title} detail={use} durationInFrames={CARD_FRAMES} />
        </Series.Sequence>,
        <Series.Sequence key={`${id}-proof`} durationInFrames={durationInFrames} premountFor={FPS}>
          <Component />
        </Series.Sequence>,
      ])}
      <Series.Sequence durationInFrames={OUTRO_FRAMES} premountFor={FPS}>
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
