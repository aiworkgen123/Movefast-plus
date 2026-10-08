import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';

import {WarChessRenderSpecSchema, type WarChessRenderSpec} from './schema';
import {WarChessComposition} from './WarChessComposition';
import {
  HISTORICAL_MEDIA_PROOF_DURATION,
  HistoricalMediaProof,
} from './visual-lab/HistoricalMediaProof';
import {
  HISTORICAL_DOCUMENTS_PROOF_DURATION,
  HistoricalDocumentsProof,
} from './visual-lab/HistoricalDocumentsProof';
import {
  HISTORICAL_FOOTAGE_PROOF_DURATION,
  HistoricalFootageProof,
} from './visual-lab/HistoricalFootageProof';
import {
  MAP_ORIENTATION_PROOF_DURATION,
  MapOrientationProof,
} from './visual-lab/MapOrientationProof';
import {
  CHESS_ANALOGY_PROOF_DURATION,
  ChessAnalogyProof,
} from './visual-lab/ChessAnalogyProof';
import {
  THREE_SUBJECT_PROOF_DURATION,
  ThreeSubjectProof,
} from './visual-lab/ThreeSubjectProof';
import {
  IDENTITY_PLACE_PROOF_DURATION,
  IdentityPlaceProof,
} from './visual-lab/IdentityPlaceProof';
import {
  THREE_PHASE_PROGRESSION_PROOF_DURATION,
  ThreePhaseProgressionProof,
} from './visual-lab/ThreePhaseProgressionProof';
import {
  FORCE_COMPARISON_PROOF_DURATION,
  ForceComparisonProof,
} from './visual-lab/ForceComparisonProof';
import {
  ARCHIVAL_CUTOUT_CONFRONTATION_DURATION,
  ArchivalCutoutConfrontationProof,
} from './visual-lab/ArchivalCutoutConfrontationProof';
import {
  FRACTURED_ORDER_DOCUMENT_DURATION,
  FracturedOrderDocumentProof,
} from './visual-lab/FracturedOrderDocumentProof';
import {
  TACTICAL_COMMAND_TABLE_DURATION,
  TacticalCommandTableProof,
} from './visual-lab/TacticalCommandTableProof';
import {
  TACTICAL_BLOCK_REINFORCEMENT_DURATION,
  TacticalBlockReinforcementProof,
} from './visual-lab/TacticalBlockReinforcementProof';
import {
  TACTICAL_ENCIRCLEMENT_DURATION,
  TacticalEncirclementProof,
} from './visual-lab/TacticalEncirclementProof';
import {
  TACTICAL_FLANKING_DURATION,
  TacticalFlankingProof,
} from './visual-lab/TacticalFlankingProof';
import {
  TACTICAL_BREAKTHROUGH_DURATION,
  TacticalBreakthroughProof,
} from './visual-lab/TacticalBreakthroughProof';
import {
  TACTICAL_RETREAT_PURSUIT_DURATION,
  TacticalRetreatPursuitProof,
} from './visual-lab/TacticalRetreatPursuitProof';
import {
  TACTICAL_COUNTERATTACK_DURATION,
  TacticalCounterattackProof,
} from './visual-lab/TacticalCounterattackProof';
import {
  STRATEGIC_DECISION_FORK_DURATION,
  StrategicDecisionForkProof,
} from './visual-lab/StrategicDecisionForkProof';
import {
  CAMPAIGN_CHRONOLOGY_DURATION,
  CampaignChronologyProof,
} from './visual-lab/CampaignChronologyProof';
import {
  NAMED_PERSON_OVERLAY_DURATION,
  NamedPersonOverlayProof,
} from './visual-lab/NamedPersonOverlayProof';
import {
  VERIFIED_STATISTIC_OVERLAY_DURATION,
  VerifiedStatisticOverlayProof,
} from './visual-lab/VerifiedStatisticOverlayProof';
import {
  APPROVED_PRODUCTION_GALLERY_DURATION,
  ApprovedProductionGallery,
} from './visual-lab/ApprovedProductionGallery';
import {
  GRAPHICS_ONLY_PHASE_PROGRESSION_DURATION,
  GraphicsOnlyPhaseProgressionProof,
} from './visual-lab/GraphicsOnlyPhaseProgressionProof';
import {
  REAL_IMAGE_PHASE_PROGRESSION_DURATION,
  RealImagePhaseProgressionProof,
} from './visual-lab/RealImagePhaseProgressionProof';
import {
  NAPOLEON_REAL_CHESS_PHASE_DURATION,
  NapoleonRealChessPhaseProof,
} from './visual-lab/NapoleonRealChessPhaseProof';
import {
  ANCHORED_PROGRESSION_FIVE_ITEM_DURATION,
  ANCHORED_PROGRESSION_TWO_ITEM_DURATION,
  AnchoredProgressionFiveItemProof,
  AnchoredProgressionTwoItemProof,
} from './visual-lab/AnchoredProgressionRangeProof';
import {
  ANCHORED_PROGRESSION_PRODUCTION_DURATION,
  AnchoredProgressionProductionProof,
} from './visual-lab/AnchoredProgressionProductionProof';
import {
  DOCUMENT_EVIDENCE_REVEAL_DURATION,
  DocumentEvidenceRevealProof,
} from './visual-lab/DocumentEvidenceRevealProof';
import {
  ARCHIVAL_DETAIL_SEQUENCE_DURATION,
  ArchivalDetailSequenceProof,
} from './visual-lab/ArchivalDetailSequenceProof';
import {
  TWO_SOURCE_CONTRAST_DURATION,
  TwoSourceContrastProof,
} from './visual-lab/TwoSourceContrastProof';
import {
  FACTUAL_OWNER_CUT_DURATION,
  FactualOwnerCutProof,
} from './visual-lab/FactualOwnerCutProof';
import {
  PRODUCTION_CAPTION_HIERARCHY_PROOF_DURATION,
  PRODUCTION_CAPTION_HIERARCHY_PROOF_SPEC,
  ProductionCaptionHierarchyProof,
} from './visual-lab/ProductionCaptionHierarchyProof';
import {
  MIXED_FRAME_TREATMENT_PROOF_DURATION,
  MIXED_FRAME_TREATMENT_PROOF_SPEC,
  MixedFrameTreatmentProof,
} from './visual-lab/MixedFrameTreatmentProof';
import {
  WC08_PRODUCTION_PERSON_FRAME_PROOF_DURATION,
  WC08_PRODUCTION_PERSON_FRAME_PROOF_SPEC,
  WC08ProductionPersonFrameProof,
} from './visual-lab/WC08ProductionPersonFrameProof';
import {
  WC09_PRODUCTION_STATISTIC_STILL_PROOF_DURATION,
  WC09_PRODUCTION_STATISTIC_STILL_PROOF_SPEC,
  WC09ProductionStatisticStillProof,
} from './visual-lab/WC09ProductionStatisticStillProof';
import {
  WC10_PRODUCTION_DECISION_FORK_PROOF_DURATION,
  WC10_PRODUCTION_DECISION_FORK_PROOF_SPEC,
  WC10ProductionDecisionForkProof,
} from './visual-lab/WC10ProductionDecisionForkProof';
import {
  WC10_PREMIUM_OPTION_DURATION,
  WC10PremiumArchitecturalBlueprint,
  WC10PremiumEngravedAtlas,
  WC10PremiumMuseumCatalogue,
  WC10PremiumVelvetGlass,
} from './visual-lab/WC10PremiumOptions';
import {
  WC10_MUSEUM_TERRAIN_DURATION,
  WC10MuseumCartographicMap,
  WC10MuseumEngineerTopographic,
  WC10MuseumHillshadeRelief,
  WC10MuseumHypsometricAtlas,
  WC10MuseumSurveyContour,
} from './visual-lab/WC10MuseumTerrainVariants';
import {
  WC10_CARTOGRAPHIC_MOTION_DURATION,
  WC10CartographicMotionProof,
} from './visual-lab/WC10CartographicMotionProof';
import {
  WC11_PREMIUM_CHRONOLOGY_DURATION,
  WC11PremiumChronologyReview,
} from './visual-lab/WC11PremiumChronologyReview';
import {
  WC11_PRODUCTION_CHRONOLOGY_PROOF_DURATION,
  WC11_PRODUCTION_CHRONOLOGY_PROOF_SPEC,
  WC11ProductionChronologyProof,
} from './visual-lab/WC11ProductionChronologyProof';
import {
  WC12_PREMIUM_NAMED_PERSON_REVIEW_DURATION,
  WC12PremiumNamedPersonReview,
} from './visual-lab/WC12PremiumNamedPersonReview';
import {
  WC12_PRODUCTION_NAMED_PERSON_PROOF_DURATION,
  WC12_PRODUCTION_NAMED_PERSON_PROOF_SPEC,
  WC12ProductionNamedPersonProof,
} from './visual-lab/WC12ProductionNamedPersonProof';
import {
  WC13_PREMIUM_DOCUMENT_EVIDENCE_REVIEW_DURATION,
  WC13PremiumDocumentEvidenceReview,
} from './visual-lab/WC13PremiumDocumentEvidenceReview';
import {
  WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_DURATION,
  WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_SPEC,
  WC13ProductionDocumentEvidenceProof,
} from './visual-lab/WC13ProductionDocumentEvidenceProof';
import {
  WC14_PREMIUM_ARCHIVAL_DETAIL_REVIEW_DURATION,
  WC14PremiumArchivalDetailReview,
} from './visual-lab/WC14PremiumArchivalDetailReview';
import {
  WC15_PREMIUM_TWO_SOURCE_CONTRAST_REVIEW_DURATION,
  WC15PremiumTwoSourceContrastReview,
} from './visual-lab/WC15PremiumTwoSourceContrastReview';
import {
  WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_DURATION,
  WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_SPEC,
  WC14ProductionArchivalDetailProof,
} from './visual-lab/WC14ProductionArchivalDetailProof';
import {
  WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_DURATION,
  WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_SPEC,
  WC15ProductionTwoSourceContrastProof,
} from './visual-lab/WC15ProductionTwoSourceContrastProof';
import {
  P01_PREMIUM_FONT_OPTION_DURATION,
  P01_FINAL_REVIEW_DURATION,
  P01FinalReview,
  P01FontOptionAIowan,
  P01FontOptionBBaskerville,
  P01FontOptionCOptima,
  P01FontOptionDAvenirCondensed,
} from './visual-lab/P01PremiumFontOptions';
import {
  P02_EDITORIAL_CARD_REVIEW_DURATION,
  P02EditorialCardReview,
} from './visual-lab/P02EditorialCardReview';
import {
  P03_POSITION_VARIANTS_REVIEW_DURATION,
  P03PositionVariantsReview,
} from './visual-lab/P03PositionVariantsReview';
import {
  P14_NUMBER_ONLY_REVIEW_DURATION,
  P14NumberOnlyReview,
} from './visual-lab/P14NumberOnlyReview';
import {
  WC04_PREMIUM_CAMPAIGN_ATLAS_DURATION,
  WC04PremiumCampaignAtlasProof,
} from './visual-lab/WC04PremiumCampaignAtlasProof';
import {
  WC06_PREMIUM_MINIMAL_REVIEW_DURATION,
  WC06PremiumMinimalReview,
} from './visual-lab/WC06PremiumMinimalReview';
import {
  WC08_PREMIUM_FONT_COMPARISON_DURATION,
  WC08PremiumFontComparisonProof,
} from './visual-lab/WC08PremiumFontComparisonProof';
import {
  WC08_TWO_LINE_FONT_STILL_DURATION,
  WC08TwoLineFuturaStill,
  WC08TwoLineHoeflerStill,
  WC08TwoLineIowanStill,
  WC08TwoLineOptimaStill,
} from './visual-lab/WC08TwoLineFontStillProofs';
import {
  LockedCaptionPreflightProof,
} from './visual-lab/LockedCaptionPreflightProof';
import {
  LOCKED_CAPTION_PREFLIGHT_PROOF_DURATION,
} from './visual-lab/locked-caption-preflight-cases';
import {
  FACE_SAFE_OVERLAY_LAB_DURATION,
  FaceSafeOverlayLab,
} from './visual-lab/FaceSafeOverlayLab';
import {
  ALL_APPROVED_TEMPLATES_SHOWCASE_DURATION,
  AllApprovedTemplatesShowcase,
} from './visual-lab/AllApprovedTemplatesShowcase';

const calculateMetadata: CalculateMetadataFunction<WarChessRenderSpec> = async ({props}) => {
  const validated = WarChessRenderSpecSchema.parse(props);
  return {
    durationInFrames: validated.durationInFrames,
    fps: validated.fps,
    width: validated.width,
    height: validated.height,
    props: validated,
    defaultOutName: `war-chess-${validated.jobId}.mp4`,
    defaultCodec: 'h264',
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="WarChessAllApprovedTemplatesShowcase"
      component={AllApprovedTemplatesShowcase}
      durationInFrames={ALL_APPROVED_TEMPLATES_SHOWCASE_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessFactualOwnerCutProof"
      component={FactualOwnerCutProof}
      durationInFrames={FACTUAL_OWNER_CUT_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessProductionCaptionHierarchyProof"
      component={ProductionCaptionHierarchyProof}
      durationInFrames={PRODUCTION_CAPTION_HIERARCHY_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={PRODUCTION_CAPTION_HIERARCHY_PROOF_SPEC}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="WarChessMixedFrameTreatmentProof"
      component={MixedFrameTreatmentProof}
      durationInFrames={MIXED_FRAME_TREATMENT_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={MIXED_FRAME_TREATMENT_PROOF_SPEC}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="WarChessWC08ProductionPersonFrameProof"
      component={WC08ProductionPersonFrameProof}
      durationInFrames={WC08_PRODUCTION_PERSON_FRAME_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={WC08_PRODUCTION_PERSON_FRAME_PROOF_SPEC}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="WarChessWC09ProductionStatisticStillProof"
      component={WC09ProductionStatisticStillProof}
      durationInFrames={WC09_PRODUCTION_STATISTIC_STILL_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={WC09_PRODUCTION_STATISTIC_STILL_PROOF_SPEC}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="WarChessWC10ProductionDecisionForkProof"
      component={WC10ProductionDecisionForkProof}
      durationInFrames={WC10_PRODUCTION_DECISION_FORK_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={WC10_PRODUCTION_DECISION_FORK_PROOF_SPEC}
      calculateMetadata={calculateMetadata}
    />
    <Composition id="WarChessWC10PremiumEngravedAtlas" component={WC10PremiumEngravedAtlas} durationInFrames={WC10_PREMIUM_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10PremiumArchitecturalBlueprint" component={WC10PremiumArchitecturalBlueprint} durationInFrames={WC10_PREMIUM_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10PremiumVelvetGlass" component={WC10PremiumVelvetGlass} durationInFrames={WC10_PREMIUM_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10PremiumMuseumCatalogue" component={WC10PremiumMuseumCatalogue} durationInFrames={WC10_PREMIUM_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10MuseumSurveyContour" component={WC10MuseumSurveyContour} durationInFrames={WC10_MUSEUM_TERRAIN_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10MuseumHillshadeRelief" component={WC10MuseumHillshadeRelief} durationInFrames={WC10_MUSEUM_TERRAIN_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10MuseumEngineerTopographic" component={WC10MuseumEngineerTopographic} durationInFrames={WC10_MUSEUM_TERRAIN_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10MuseumHypsometricAtlas" component={WC10MuseumHypsometricAtlas} durationInFrames={WC10_MUSEUM_TERRAIN_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10MuseumCartographicMap" component={WC10MuseumCartographicMap} durationInFrames={WC10_MUSEUM_TERRAIN_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC10CartographicMotionProof" component={WC10CartographicMotionProof} durationInFrames={WC10_CARTOGRAPHIC_MOTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC11PremiumChronologyReview" component={WC11PremiumChronologyReview} durationInFrames={WC11_PREMIUM_CHRONOLOGY_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC11ProductionChronologyProof" component={WC11ProductionChronologyProof} durationInFrames={WC11_PRODUCTION_CHRONOLOGY_PROOF_DURATION} fps={30} width={1920} height={1080} defaultProps={WC11_PRODUCTION_CHRONOLOGY_PROOF_SPEC} calculateMetadata={calculateMetadata} />
    <Composition id="WarChessWC12PremiumNamedPersonReview" component={WC12PremiumNamedPersonReview} durationInFrames={WC12_PREMIUM_NAMED_PERSON_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC12ProductionNamedPersonProof" component={WC12ProductionNamedPersonProof} durationInFrames={WC12_PRODUCTION_NAMED_PERSON_PROOF_DURATION} fps={30} width={1920} height={1080} defaultProps={WC12_PRODUCTION_NAMED_PERSON_PROOF_SPEC} calculateMetadata={calculateMetadata} />
    <Composition id="WarChessWC13PremiumDocumentEvidenceReview" component={WC13PremiumDocumentEvidenceReview} durationInFrames={WC13_PREMIUM_DOCUMENT_EVIDENCE_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC13ProductionDocumentEvidenceProof" component={WC13ProductionDocumentEvidenceProof} durationInFrames={WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_DURATION} fps={30} width={1920} height={1080} defaultProps={WC13_PRODUCTION_DOCUMENT_EVIDENCE_PROOF_SPEC} calculateMetadata={calculateMetadata} />
    <Composition id="WarChessWC14PremiumArchivalDetailReview" component={WC14PremiumArchivalDetailReview} durationInFrames={WC14_PREMIUM_ARCHIVAL_DETAIL_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC15PremiumTwoSourceContrastReview" component={WC15PremiumTwoSourceContrastReview} durationInFrames={WC15_PREMIUM_TWO_SOURCE_CONTRAST_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC14ProductionArchivalDetailProof" component={WC14ProductionArchivalDetailProof} durationInFrames={WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_DURATION} fps={30} width={1920} height={1080} defaultProps={WC14_PRODUCTION_ARCHIVAL_DETAIL_PROOF_SPEC} calculateMetadata={calculateMetadata} />
    <Composition id="WarChessWC15ProductionTwoSourceContrastProof" component={WC15ProductionTwoSourceContrastProof} durationInFrames={WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_DURATION} fps={30} width={1920} height={1080} defaultProps={WC15_PRODUCTION_TWO_SOURCE_CONTRAST_PROOF_SPEC} calculateMetadata={calculateMetadata} />
    <Composition id="P01FontOptionAIowan" component={P01FontOptionAIowan} durationInFrames={P01_PREMIUM_FONT_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P01FinalReview" component={P01FinalReview} durationInFrames={P01_FINAL_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P01FontOptionBBaskerville" component={P01FontOptionBBaskerville} durationInFrames={P01_PREMIUM_FONT_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P01FontOptionCOptima" component={P01FontOptionCOptima} durationInFrames={P01_PREMIUM_FONT_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P01FontOptionDAvenirCondensed" component={P01FontOptionDAvenirCondensed} durationInFrames={P01_PREMIUM_FONT_OPTION_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P02EditorialCardReview" component={P02EditorialCardReview} durationInFrames={P02_EDITORIAL_CARD_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P03PositionVariantsReview" component={P03PositionVariantsReview} durationInFrames={P03_POSITION_VARIANTS_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="P14NumberOnlyReview" component={P14NumberOnlyReview} durationInFrames={P14_NUMBER_ONLY_REVIEW_DURATION} fps={30} width={1920} height={1080} />
    <Composition
      id="WarChessWC08PremiumFontComparisonProof"
      component={WC08PremiumFontComparisonProof}
      durationInFrames={WC08_PREMIUM_FONT_COMPARISON_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition id="WarChessWC08TwoLineFuturaStill" component={WC08TwoLineFuturaStill} durationInFrames={WC08_TWO_LINE_FONT_STILL_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC08TwoLineOptimaStill" component={WC08TwoLineOptimaStill} durationInFrames={WC08_TWO_LINE_FONT_STILL_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC08TwoLineHoeflerStill" component={WC08TwoLineHoeflerStill} durationInFrames={WC08_TWO_LINE_FONT_STILL_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WarChessWC08TwoLineIowanStill" component={WC08TwoLineIowanStill} durationInFrames={WC08_TWO_LINE_FONT_STILL_DURATION} fps={30} width={1920} height={1080} />
    <Composition
      id="WarChessLockedCaptionPreflightProof"
      component={LockedCaptionPreflightProof}
      durationInFrames={LOCKED_CAPTION_PREFLIGHT_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessFaceSafeOverlayLab"
      component={FaceSafeOverlayLab}
      durationInFrames={FACE_SAFE_OVERLAY_LAB_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessMaster"
      component={WarChessComposition}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
      schemaVersion: 'vpp-war-chess-render-spec.v1',
      jobId: '00000000-0000-0000-0000-000000000000',
      templateId: 'war_chess',
      templateVersion: 'r4',
      compositionId: 'WarChessMaster',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 1800,
      voiceover: {
        artifactId: 'fixture-voiceover',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        mediaType: 'audio/wav',
        staticFileKey: 'fixture.wav',
      },
      scenes: [
        {
          kind: 'original_motion_graphic',
          sceneId: 'fixture-scene',
          parentUnitId: 'fixture-unit',
          startFrame: 0,
          endFrameExclusive: 1800,
          routeId: 'fixture-route',
          treatment: {
            surfaceEffect: 'fine_35mm_grain',
            presentationEffect: 'film_dust',
            presentationMode: 'stay_framed',
            seed: 0,
          },
          acceptedScopeHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          componentId: 'fixture-component',
          componentVariant: 'evidence_flow_v1',
          display: {
            eyebrow: 'War Chess',
            title: 'Evidence before spectacle',
            steps: ['Establish the claim', 'Show the position', 'Explain the consequence'],
          },
          stateChangePlan: [
            {
              startFrame: 0,
              endFrameExclusive: 900,
              description: 'Establish the evidence chain',
              meaningfulChange: true,
            },
            {
              startFrame: 900,
              endFrameExclusive: 1800,
              description: 'Reveal the consequence',
              meaningfulChange: true,
            },
          ],
        },
      ],
      components: [],
      componentManifestHash: '0000000000000000000000000000000000000000000000000000000000000000',
      componentQcHash: '0000000000000000000000000000000000000000000000000000000000000000',
      captions: [],
      selectedSetHash: '0000000000000000000000000000000000000000000000000000000000000000',
      timelineHash: '0000000000000000000000000000000000000000000000000000000000000000',
      attributionHash: '0000000000000000000000000000000000000000000000000000000000000000',
      rendererBuildHash: '0000000000000000000000000000000000000000000000000000000000000000',
      dependencyLockHash: '0000000000000000000000000000000000000000000000000000000000000000',
      rightsManifestHash: '0000000000000000000000000000000000000000000000000000000000000000',
      fixtureOnly: true,
      commercialUseCertified: false,
      renderSpecHash: '0000000000000000000000000000000000000000000000000000000000000000',
      }}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="WarChessApprovedProductionGallery"
      component={ApprovedProductionGallery}
      durationInFrames={APPROVED_PRODUCTION_GALLERY_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessGraphicsOnlyPhaseProgressionProof"
      component={GraphicsOnlyPhaseProgressionProof}
      durationInFrames={GRAPHICS_ONLY_PHASE_PROGRESSION_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessRealImagePhaseProgressionProof"
      component={RealImagePhaseProgressionProof}
      durationInFrames={REAL_IMAGE_PHASE_PROGRESSION_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessNapoleonRealChessPhaseProof"
      component={NapoleonRealChessPhaseProof}
      durationInFrames={NAPOLEON_REAL_CHESS_PHASE_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessAnchoredProgressionTwoItemProof"
      component={AnchoredProgressionTwoItemProof}
      durationInFrames={ANCHORED_PROGRESSION_TWO_ITEM_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessAnchoredProgressionFiveItemProof"
      component={AnchoredProgressionFiveItemProof}
      durationInFrames={ANCHORED_PROGRESSION_FIVE_ITEM_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessAnchoredProgressionProductionProof"
      component={AnchoredProgressionProductionProof}
      durationInFrames={ANCHORED_PROGRESSION_PRODUCTION_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessDocumentEvidenceRevealProof"
      component={DocumentEvidenceRevealProof}
      durationInFrames={DOCUMENT_EVIDENCE_REVEAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessArchivalDetailSequenceProof"
      component={ArchivalDetailSequenceProof}
      durationInFrames={ARCHIVAL_DETAIL_SEQUENCE_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTwoSourceContrastProof"
      component={TwoSourceContrastProof}
      durationInFrames={TWO_SOURCE_CONTRAST_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessHistoricalMediaProof"
      component={HistoricalMediaProof}
      durationInFrames={HISTORICAL_MEDIA_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessHistoricalDocumentsProof"
      component={HistoricalDocumentsProof}
      durationInFrames={HISTORICAL_DOCUMENTS_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessHistoricalFootageProof"
      component={HistoricalFootageProof}
      durationInFrames={HISTORICAL_FOOTAGE_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessMapOrientationProof"
      component={MapOrientationProof}
      durationInFrames={MAP_ORIENTATION_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessChessAnalogyProof"
      component={ChessAnalogyProof}
      durationInFrames={CHESS_ANALOGY_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessThreeSubjectProof"
      component={ThreeSubjectProof}
      durationInFrames={THREE_SUBJECT_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessIdentityPlaceProof"
      component={IdentityPlaceProof}
      durationInFrames={IDENTITY_PLACE_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessThreePhaseProgressionProof"
      component={ThreePhaseProgressionProof}
      durationInFrames={THREE_PHASE_PROGRESSION_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessForceComparisonProof"
      component={ForceComparisonProof}
      durationInFrames={FORCE_COMPARISON_PROOF_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessArchivalCutoutConfrontationProof"
      component={ArchivalCutoutConfrontationProof}
      durationInFrames={ARCHIVAL_CUTOUT_CONFRONTATION_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessFracturedOrderDocumentProof"
      component={FracturedOrderDocumentProof}
      durationInFrames={FRACTURED_ORDER_DOCUMENT_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalCommandTableProof"
      component={TacticalCommandTableProof}
      durationInFrames={TACTICAL_COMMAND_TABLE_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalBlockReinforcementProof"
      component={TacticalBlockReinforcementProof}
      durationInFrames={TACTICAL_BLOCK_REINFORCEMENT_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalEncirclementProof"
      component={TacticalEncirclementProof}
      durationInFrames={TACTICAL_ENCIRCLEMENT_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalFlankingProof"
      component={TacticalFlankingProof}
      durationInFrames={TACTICAL_FLANKING_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalBreakthroughProof"
      component={TacticalBreakthroughProof}
      durationInFrames={TACTICAL_BREAKTHROUGH_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalRetreatPursuitProof"
      component={TacticalRetreatPursuitProof}
      durationInFrames={TACTICAL_RETREAT_PURSUIT_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessTacticalCounterattackProof"
      component={TacticalCounterattackProof}
      durationInFrames={TACTICAL_COUNTERATTACK_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessStrategicDecisionForkProof"
      component={StrategicDecisionForkProof}
      durationInFrames={STRATEGIC_DECISION_FORK_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessCampaignChronologyProof"
      component={CampaignChronologyProof}
      durationInFrames={CAMPAIGN_CHRONOLOGY_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessNamedPersonOverlayProof"
      component={NamedPersonOverlayProof}
      durationInFrames={NAMED_PERSON_OVERLAY_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessVerifiedStatisticOverlayProof"
      component={VerifiedStatisticOverlayProof}
      durationInFrames={VERIFIED_STATISTIC_OVERLAY_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessWC04PremiumCampaignAtlasProof"
      component={WC04PremiumCampaignAtlasProof}
      durationInFrames={WC04_PREMIUM_CAMPAIGN_ATLAS_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="WarChessWC06PremiumMinimalReview"
      component={WC06PremiumMinimalReview}
      durationInFrames={WC06_PREMIUM_MINIMAL_REVIEW_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
