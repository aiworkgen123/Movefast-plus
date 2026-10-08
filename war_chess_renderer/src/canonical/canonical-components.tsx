import React from 'react';
import {staticFile} from 'remotion';
import {CannaeSurfaceTreatmentProofV2} from './extracted/war-chess-candidate-library';
import {WarChessWC01ForceComparison, WarChessWC02SubjectIntroduction, WarChessWC07ArchivalLayoutProof, WarChessWC08LowerThird, WarChessWC09CasualtyProof} from './extracted/war-chess-review-library';
import {WarChessWC04CChessEnhanced} from './extracted/war-chess-wc04-variants';
import {WarChessMapRankedPiecesV2} from './extracted/war-chess-map-ranked-pieces-v2';
import {WarChessWC06ChessEvaluation} from './extracted/war-chess-wc06-evaluation';
import {WarChessWC10DecisionForkV7} from './extracted/war-chess-wc10-decision-fork';
import {WarChessWC11CampaignTimeline} from './extracted/war-chess-wc11-campaign-timeline';
import {WarChessAdaptiveTacticalMap} from './war-chess-adaptive-tactical-map';
import {WarChessAdaptiveTacticalMapV2Review} from './war-chess-adaptive-tactical-map-v2';
import {WarChessNamedPersonOverlay} from './war-chess-named-person-overlay';
import {WCFX_PRESETS, WC01PropsSchema, WC02PropsSchema, WC04AdaptiveTacticalMapPropsSchema, WC04AdaptiveTacticalMapV2PropsSchema, WC04MovementPropsSchema, WC04RankedPropsSchema, WC06PropsSchema, WC07PropsSchema, WC08PropsSchema, WC09PropsSchema, WC10PropsSchema, WC11PropsSchema, WC12PropsSchema, WCFX01PropsSchema, type WC01Props, type WC02Props, type WC04AdaptiveTacticalMapProps, type WC04AdaptiveTacticalMapV2Props, type WC04MovementProps, type WC04RankedProps, type WC06Props, type WC07Props, type WC08Props, type WC09Props, type WC10Props, type WC11Props, type WC12Props, type WCFX01Props} from './production-contracts';

const path = (value: {path: string}): string => value.path;

/**
 * WCFX01 receives media directly from the source-treatment compositor.  Keep
 * inline data and valid URLs intact, while resolving ordinary public paths via
 * Remotion so callers do not need data-URI fixture workarounds.
 */
const mediaPath = (value: {path: string}): string => {
  const source = value.path;
  const isUrl = /^(?:data:|https?:|blob:)/i.test(source);
  return source.startsWith('/') || isUrl ? source : staticFile(source);
};

export const WarChessWC01Canonical: React.FC<WC01Props> = (input) => {
  const props = WC01PropsSchema.parse(input);
  return <WarChessWC01ForceComparison title={props.displayTitle} attackingFirstLabel={props.displayTakeaway ?? ''} sides={props.sides.map((side) => ({name: side.name, facts: side.facts, count: side.count})) as [{name: string; facts: string[]; count?: number}, {name: string; facts: string[]; count?: number}]} />;
};

export const WarChessWC02Canonical: React.FC<WC02Props> = (input) => {
  const props = WC02PropsSchema.parse(input);
  return <WarChessWC02SubjectIntroduction subjectImage={path(props.subject.image)} subjectCutout={path(props.subject.cutout)} subjectName={props.subject.name} role={props.subject.role} storyPoints={props.storyPoints} palette={{stage: '#17130f', paper: '#f1e7d2', amber: '#d7b275', signal: '#b94b39', muted: '#a8977f'}} identityNote={props.labels?.identityNote} eyebrow={props.labels?.eyebrow} motionTag={props.labels?.motionTag} assetTag={props.labels?.assetTag} />;
};

export const WarChessWC04MovementCanonical: React.FC<WC04MovementProps> = (input) => {
  const props = WC04MovementPropsSchema.parse(input);
  return <WarChessWC04CChessEnhanced map={path(props.map)} factions={props.factions.map((faction) => ({name: faction.name, image: path(faction.asset), role: faction.role})) as [{name: string; image: string; role?: string}, {name: string; image: string; role?: string}]} stageLabels={props.stages.map((stage) => stage.label)} {...(props.labels ?? {})} />;
};

export const WarChessRankedCanonical: React.FC<WC04RankedProps> = (input) => {
  const props = WC04RankedPropsSchema.parse(input);
  return <WarChessMapRankedPiecesV2 map={path(props.map)} factions={props.factions.map((faction) => ({name: faction.name, image: path(faction.asset), role: faction.role})) as [{name: string; image: string; role?: string}, {name: string; image: string; role?: string}]} stageLabels={props.labels?.stageLabels ?? props.groups.map((group) => group.role)} eyebrow={props.labels?.eyebrow} rightTag={props.labels?.rightTag} mapCaption={props.labels?.mapCaption} footer={props.labels?.footer} />;
};

export const WarChessWC04AdaptiveTacticalMapCanonical: React.FC<WC04AdaptiveTacticalMapProps> = (input) => {
  const props = WC04AdaptiveTacticalMapPropsSchema.parse(input);
  return <WarChessAdaptiveTacticalMap {...props} />;
};

/** Fresh owner-approved WC04 reference_version 2 adapter. */
export const WarChessWC04AdaptiveTacticalMapV2Canonical: React.FC<WC04AdaptiveTacticalMapV2Props> = (input) => {
  const props = WC04AdaptiveTacticalMapV2PropsSchema.parse(input);
  return <WarChessAdaptiveTacticalMapV2Review {...props} />;
};

/** Historical alias retained for older proof readers. */
export const WarChessWC04AdaptiveTacticalMapV2Review: React.FC<WC04AdaptiveTacticalMapV2Props> = (input) => {
  const props = WC04AdaptiveTacticalMapV2PropsSchema.parse(input);
  return <WarChessAdaptiveTacticalMapV2Review {...props} />;
};

export const WarChessWC06Canonical: React.FC<WC06Props> = (input) => {
  const props = WC06PropsSchema.parse(input);
  return <WarChessWC06ChessEvaluation scenario={props.scenario} labels={{...props.labels, whiteLabel: props.labels?.whiteLabel ?? props.scenario.white_represents, blackLabel: props.labels?.blackLabel ?? props.scenario.black_represents, stages: props.labels?.stages ?? props.scenario.moves.map((move) => move.story_label)}} />;
};

export const WarChessWC07Canonical: React.FC<WC07Props> = (input) => {
  const props = WC07PropsSchema.parse(input);
  return <WarChessWC07ArchivalLayoutProof subjects={props.subjects.map((subject) => ({name: subject.name, image: path(subject.asset)})) as [{name: string; image: string}, {name: string; image: string}, {name: string; image: string}]} {...(props.labels ?? {})} />;
};

export const WarChessWC08Canonical: React.FC<WC08Props> = (input) => {
  const props = WC08PropsSchema.parse(input);
  return <WarChessWC08LowerThird underlyingMedia={path(props.underlyingMedia)} labels={props.labels} eyebrow={props.eyebrow} rightTag={props.rightTag} footer={props.footer} />;
};

export const WarChessWC09Canonical: React.FC<WC09Props> = (input) => {
  const props = WC09PropsSchema.parse(input);
  return <WarChessWC09CasualtyProof underlyingMedia={path(props.underlyingMedia)} statistic={props.statistic} eyebrow={props.eyebrow} rightTag={props.rightTag} footer={props.footer} faceSafeZone={props.faceSafeZone} />;
};

export const WarChessWC10Canonical: React.FC<WC10Props> = (input) => {
  const props = WC10PropsSchema.parse(input);
  return <WarChessWC10DecisionForkV7 map={path(props.map)} options={props.options} chosenOption={props.chosenOption} />;
};

export const WarChessWC11Canonical: React.FC<WC11Props> = (input) => {
  const props = WC11PropsSchema.parse(input);
  return <WarChessWC11CampaignTimeline map={path(props.map)} stops={props.stops} {...(props.labels ?? {})} />;
};

export const WarChessWC12Canonical: React.FC<WC12Props> = (input) => {
  const props = WC12PropsSchema.parse(input);
  return <WarChessNamedPersonOverlay {...props} />;
};

export const WarChessWCFX01Canonical: React.FC<WCFX01Props> = (input) => {
  const props = WCFX01PropsSchema.parse(input);
  const values = WCFX_PRESETS[props.preset];
  return <CannaeSurfaceTreatmentProofV2 imageSrc={mediaPath(props.underlyingMedia)} grainOpacity={values.grain} vignetteOpacity={values.vignette} dustOpacity={values.dust} showComparison={false} />;
};
