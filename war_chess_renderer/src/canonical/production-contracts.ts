import {z} from 'zod';
import wc04AdaptiveStyle from './wc04-adaptive-style.json';

export const WC04_ADAPTIVE_STYLE = wc04AdaptiveStyle;

const hash = z.string().regex(/^[a-f0-9]{64}$/i);
const asset = z.object({path: z.string().min(1), sha256: hash});
const label = z.string().trim().min(1).max(240);
const palette = z.object({stage: label, paper: label, amber: label, signal: label, muted: label, line: label, slate: label});
const base = {componentId: z.string().min(1)};
const faction = z.object({name: label, asset, role: label.optional()});
const wc04Labels = z.object({eyebrow: label.optional(), rightTag: label.optional(), reconstructionLabel: label.optional(), evaluationLabel: label.optional(), leftAdvantageLabel: label.optional(), rightAdvantageLabel: label.optional(), threatenedCenterLabel: label.optional(), rearCloseLabel: label.optional(), footer: label.optional()}).partial();
const wc04RankedLabels = z.object({eyebrow: label.optional(), rightTag: label.optional(), mapCaption: label.optional(), footer: label.optional(), stageLabels: z.array(label).min(1).max(4).optional()}).partial();
const wc06Labels = z.object({eyebrow: label.optional(), sideTag: label.optional(), evaluationLabel: label.optional(), whiteLabel: label.optional(), blackLabel: label.optional(), stages: z.array(label).min(1).max(8).optional(), footerLeft: label.optional(), footerRight: label.optional()}).partial();
const wc06Scenario = z.object({schema_version: z.literal('warboard-scenario.v1'), foundation_lock: z.literal('warboard.visual-foundation.v1'), scenario_id: z.string().min(1), historical_context: label, tactical_message: label, white_represents: label, black_represents: label, starting_fen: label, moves: z.array(z.object({uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/), expected_san: label, story_label: label})).min(1).max(3), final_label: label, palette_accent: z.string().min(1)});
const normalizedSafeZone = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine((zone) => zone.x + zone.width <= 1 && zone.y + zone.height <= 1, "safe zone must remain inside the frame");
const mediaTextOverlay = z.object({
  role: z.enum(['chapter_summary', 'identity', 'place_date', 'tactical_change', 'consequence', 'verified_statistic']),
  headline: z.string().trim().min(1).max(64),
  supportingText: z.string().trim().min(1).max(96).nullable(),
  emphasisTerms: z.array(z.string().trim().min(1).max(32)).max(3),
  placement: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
    align: z.enum(['left', 'center', 'right']),
    safeAreaSource: z.string().min(1),
    subjectOverlapForbidden: z.literal(true),
    headlineFontSize: z.union([z.literal(54), z.literal(60), z.literal(66), z.literal(72)]),
    supportFontSize: z.union([z.literal(34), z.literal(36)]),
    headlineLinesMax: z.literal(3),
    supportLinesMax: z.literal(2),
  }).refine((zone) => zone.x + zone.width <= 1 && zone.y + zone.height <= 1, "text placement must remain inside the frame"),
  animation: z.object({
    enterStartFrame: z.number().int().min(0),
    enterDurationFrames: z.number().int().min(1),
    exitDurationFrames: z.number().int().min(1),
    overshoot: z.literal(false),
  }),
}).superRefine((value, context) => {
  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount(value.headline) > 8) context.addIssue({code: 'custom', message: 'headline must not exceed eight words', path: ['headline']});
  if (value.supportingText && wordCount(value.supportingText) > 12) context.addIssue({code: 'custom', message: 'supporting text must not exceed twelve words', path: ['supportingText']});
  const completeCopy = `${value.headline} ${value.supportingText ?? ''}`.toLocaleLowerCase();
  value.emphasisTerms.forEach((term, index) => {
    if (!completeCopy.includes(term.toLocaleLowerCase())) context.addIssue({code: 'custom', message: 'emphasis term must occur in overlay copy', path: ['emphasisTerms', index]});
  });
});

const wc01DisplayTitle = z.string().trim().min(1).max(30).refine(
  (value) => value.split(/\s+/).filter(Boolean).length <= 8,
  'display title must fit the approved WC01 title envelope',
).refine(
  (value) => !/^(?:show|use|add|render|illustrate|display|depict|animate|overlay|compare|highlight)\b/i.test(value),
  'display title must not contain an internal editing instruction',
);
const wc10DisplayCopy = (
  maxCharacters: number,
  maxWords: number,
  field: string,
) => z.string().trim().min(1).max(maxCharacters).refine(
  (value) => value.split(/\s+/).filter(Boolean).length <= maxWords,
  `${field} exceeds the approved WC10 right-rail envelope`,
).refine(
  (value) => !/^(?:show|use|add|render|illustrate|display|depict|animate|overlay|compare|highlight)\b/i.test(value),
  `${field} must not contain an internal editing instruction`,
);
const wc10Option = z.object({
  id: z.string().trim().min(1).max(80),
  displayTitle: wc10DisplayCopy(30, 6, 'display title'),
  displayDescription: wc10DisplayCopy(44, 8, 'display description'),
}).strict();
export const WC01PropsSchema = z.object({...base, componentId: z.literal('WC01'), sides: z.array(z.object({name: label, asset, facts: z.array(label).min(1).max(2), count: z.number().positive().optional()})).length(2), firstMentionedSide: label, displayTitle: wc01DisplayTitle, displayTakeaway: label.max(30).optional(), palette});
export const WC02PropsSchema = z.object({...base, componentId: z.literal('WC02'), subject: z.object({name: label, role: label, image: asset, cutout: asset}), storyPoints: z.tuple([label, label, label]), labels: z.object({eyebrow: label.optional(), motionTag: label.optional(), assetTag: label.optional(), identityNote: label.optional()}).partial().optional(), palette});
export const WC04MovementPropsSchema = z.object({...base, componentId: z.literal('WC04'), mode: z.literal('movement_progression'), map: asset, factions: z.tuple([faction, faction]), stages: z.array(z.object({label, path: z.string().min(2)})).min(2).max(4), labels: wc04Labels.optional(), palette});
export const WC04RankedPropsSchema = z.object({...base, componentId: z.literal('WC04'), mode: z.literal('ranked_formation'), map: asset, factions: z.tuple([faction, faction]), groups: z.array(z.object({role: label, pieceType: z.enum(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']), rationale: label, path: z.string().min(2)})).min(2).max(4), labels: wc04RankedLabels.optional(), palette});
export const STRONG_GREY_MAP_TREATMENT = {
  filter: 'grayscale(.45) saturate(.55) brightness(.78) contrast(1.06)',
  veil: 'rgba(45,48,50,0.18)',
  layerOrder: 'map_then_veil_then_arrows_and_pieces',
} as const;
const normalizedPoint = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const mapTreatment = z.object({
  filter: z.literal(STRONG_GREY_MAP_TREATMENT.filter),
  veil: z.literal(STRONG_GREY_MAP_TREATMENT.veil),
  layerOrder: z.literal(STRONG_GREY_MAP_TREATMENT.layerOrder),
}).strict();
const mapSelectionReceipt = z.object({
  schemaVersion: z.string().min(1),
  transactionId: z.string().min(1),
  mapRung: z.enum(['exact_battle_campaign', 'same_place_regional_topographic', 'original_reconstructed']),
  selectionReceiptHash: hash,
  sourceUrl: z.string().url().optional(),
  sourcePageTitle: label.optional(),
  exactMapExhausted: z.boolean(),
  regionalMapExhausted: z.boolean(),
  webMapsUsable: z.boolean(),
  createdMap: z.boolean(),
  strongGreyTreatment: mapTreatment,
}).strict();
const engravedPiece = z.object({
  id: z.string().trim().min(1).max(80),
  side: z.enum(['black', 'white']),
  pieceType: z.enum(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']),
  start: normalizedPoint,
  end: normalizedPoint,
  startFrame: z.number().int().min(0),
  endFrameExclusive: z.number().int().positive(),
  scale: z.number().positive().max(1),
  arrowId: z.string().trim().min(1).max(80).optional(),
}).strict().superRefine((piece, context) => {
  if (piece.endFrameExclusive <= piece.startFrame) {
    context.addIssue({code: 'custom', message: 'piece movement must have a positive frame span', path: ['endFrameExclusive']});
  }
  const expectedScale = WC04_ADAPTIVE_STYLE.pieceScale[piece.pieceType];
  if (piece.scale !== expectedScale) {
    context.addIssue({code: 'custom', message: 'piece scale must match the code-owned WC04 presentation profile', path: ['scale']});
  }
});
const tacticalArrow = z.object({
  id: z.string().trim().min(1).max(80),
  profile: z.enum(['movement_flank', 'encirclement_sweep']),
  palette: z.enum(['red', 'blue']),
  start: normalizedPoint,
  end: normalizedPoint,
  control: normalizedPoint.optional(),
  shaftWidth: z.number().positive().max(160),
  headLength: z.number().positive().max(240),
  headWidth: z.number().positive().max(320),
  headStyle: z.enum(['sharp', 'softened']),
  shaftCap: z.enum(['round', 'square']),
  drawStartFrame: z.number().int().min(0),
  drawEndFrameExclusive: z.number().int().positive(),
  connected: z.literal(true),
  shaftEnd: normalizedPoint,
  headBase: normalizedPoint,
}).strict().refine((arrow) => arrow.drawEndFrameExclusive > arrow.drawStartFrame, 'arrow draw must have a positive frame span');
const adaptiveLabels = z.object({
  title: label.optional(),
  subtitle: label.optional(),
  left: label.optional(),
  right: label.optional(),
  bottom: label.optional(),
}).partial().strict();
export const WC04AdaptiveTacticalMapPropsSchema = z.object({
  ...base,
  componentId: z.literal('WC04'),
  mode: z.literal('adaptive_tactical_map'),
  map: asset,
  mapSelection: mapSelectionReceipt,
  factions: z.tuple([faction, faction]),
  pieces: z.array(engravedPiece).min(8),
  arrows: z.array(tacticalArrow).min(1).max(5),
  labels: adaptiveLabels.optional(),
  palette,
}).strict();
const wc04V2ContextBasis = z.object({
  source: label,
  clauseId: label.optional(),
  sectionId: label.optional(),
  beatId: label.optional(),
  ref: label.optional(),
}).strict();
const wc04V2Evidence = z.object({
  source: label,
  quote: label,
  claimType: z.enum(['visual_claim', 'movement']),
  supportedFields: z.array(label).min(1),
}).strict();
const wc04V2Common = {
  ...base,
  componentId: z.literal('WC04'),
  mode: z.literal('adaptive_tactical_map'),
  referenceVersion: z.literal(2),
  map: asset,
  mapSelection: mapSelectionReceipt,
  semanticContextHash: hash,
  supportedClaimIds: z.array(label).min(1).max(32),
  contextBasis: z.array(wc04V2ContextBasis).min(1).max(16),
  visualClaim: label,
  visualClaimEvidence: wc04V2Evidence,
  displayTitle: label,
  labels: adaptiveLabels,
  startFrame: z.number().int().min(0),
  endFrameExclusive: z.number().int().positive(),
  palette,
};
const wc04V2Highlight = z.object({
  kind: z.enum(['region', 'route']),
  label,
  supportedClaimIds: z.array(label).min(1).optional(),
}).strict();
const wc04V2StaticMarker = z.object({
  id: label,
  actor: label,
  markerType: z.enum(['piece', 'formation', 'zone']),
  position: normalizedPoint,
  label: label.optional(),
  supportedClaimIds: z.array(label).min(1).optional(),
}).strict();
const wc04V2Zone = z.object({
  id: label,
  label: label.optional(),
  position: normalizedPoint,
  supportedClaimIds: z.array(label).min(1).optional(),
}).strict();
const wc04V2Connector = z.object({
  id: label,
  label: label.optional(),
  from: normalizedPoint,
  to: normalizedPoint,
  supportedClaimIds: z.array(label).min(1).optional(),
}).strict();
const wc04V2MovementStep = z.object({
  stepId: label,
  arrowId: label,
  actor: label,
  action: label,
  start: label,
  end: label,
  outcome: label,
  supportedClaimIds: z.array(label).min(1),
  evidence: wc04V2Evidence,
}).strict();
const wc04V2OrientationProps = z.object({
  ...wc04V2Common,
  mapStoryMode: z.literal('orientation'),
  regionRouteHighlight: wc04V2Highlight.optional(),
}).strict();
const wc04V2StaticPositionsProps = z.object({
  ...wc04V2Common,
  mapStoryMode: z.literal('static_positions'),
  staticMarkers: z.array(wc04V2StaticMarker).min(1),
  zones: z.array(wc04V2Zone).max(8).optional(),
  connectors: z.array(wc04V2Connector).max(8).optional(),
}).strict();
const wc04V2TacticalMovementProps = z.object({
  ...wc04V2Common,
  mapStoryMode: z.literal('tactical_movement'),
  factions: z.tuple([faction, faction]),
  pieces: z.array(engravedPiece).min(8),
  arrows: z.array(tacticalArrow).min(1).max(5),
  movementSteps: z.array(wc04V2MovementStep).min(1).max(5),
}).strict().superRefine((value, context) => {
  const arrowIds = value.arrows.map((arrow) => arrow.id);
  const stepIds = value.movementSteps.map((step) => step.arrowId);
  const linkedPieceIds = value.pieces.map((piece) => piece.arrowId).filter((id): id is string => Boolean(id));
  if (new Set(arrowIds).size !== arrowIds.length) context.addIssue({code: 'custom', message: 'tactical arrow IDs must be distinct', path: ['arrows']});
  if (value.movementSteps.length !== value.arrows.length || new Set(stepIds).size !== stepIds.length || new Set(stepIds).size !== new Set(arrowIds).size || stepIds.some((id) => !arrowIds.includes(id))) {
    context.addIssue({code: 'custom', message: 'each tactical movement step must have one matching arrow', path: ['movementSteps']});
  }
  if (new Set(linkedPieceIds).size !== new Set(arrowIds).size || arrowIds.some((id) => !linkedPieceIds.includes(id))) {
    context.addIssue({code: 'custom', message: 'each tactical arrow must link to one moving piece', path: ['pieces']});
  }
  if (value.endFrameExclusive <= value.startFrame) context.addIssue({code: 'custom', message: 'coverage bounds must be positive', path: ['endFrameExclusive']});
});
export const WC04AdaptiveTacticalMapV2PropsSchema = z.discriminatedUnion('mapStoryMode', [
  wc04V2OrientationProps,
  wc04V2StaticPositionsProps,
  wc04V2TacticalMovementProps,
]);
export const WC06PropsSchema = z.object({...base, componentId: z.literal('WC06'), backendId: z.literal('WB01'), scenario: wc06Scenario, labels: wc06Labels.optional(), palette});
export const WC07PropsSchema = z.object({...base, componentId: z.literal('WC07'), subjects: z.tuple([z.object({name: label, asset}), z.object({name: label, asset}), z.object({name: label, asset})]), connectionType: z.enum(['people', 'places', 'things']), labels: z.object({eyebrow: label.optional(), sideNote: label.optional(), footer: label.optional()}).partial().optional(), palette}).superRefine((value, context) => {
  const names = value.subjects.map((subject) => subject.name);
  const assets = value.subjects.map((subject) => `${subject.asset.path}:${subject.asset.sha256}`);
  if (new Set(names).size !== 3) context.addIssue({code: 'custom', message: 'WC07 subject names must be distinct', path: ['subjects']});
  if (new Set(assets).size !== 3) context.addIssue({code: 'custom', message: 'WC07 subject assets must be distinct', path: ['subjects']});
});
export const WC08PropsSchema = z.object({...base, componentId: z.literal('WC08'), overlayOnly: z.literal(true), underlyingMedia: asset, labels: z.array(z.object({key: label, value: label})).max(3).optional(), eyebrow: label.optional(), rightTag: label.optional(), footer: label.optional(), palette});
export const WC09PropsSchema = z.object({...base, componentId: z.literal('WC09'), overlayOnly: z.literal(true), underlyingMedia: asset, statistic: label.optional(), eyebrow: label.optional(), rightTag: label.optional(), footer: label.optional(), faceSafeZone: normalizedSafeZone.optional(), palette});
export const WC10PropsSchema = z.object({...base, componentId: z.literal('WC10'), map: asset, options: z.array(wc10Option).min(2).max(4), chosenOption: z.string().trim().min(1).max(80), palette}).strict().superRefine((value, context) => {
  const ids = value.options.map((option) => option.id);
  if (new Set(ids).size !== ids.length) context.addIssue({code: 'custom', message: 'WC10 option IDs must be distinct', path: ['options']});
  if (!ids.includes(value.chosenOption)) context.addIssue({code: 'custom', message: 'WC10 chosen option must match one supplied option', path: ['chosenOption']});
});
export const WC11PropsSchema = z.object({...base, componentId: z.literal('WC11'), map: asset, stops: z.array(z.object({place: label, date: label, x: z.number(), y: z.number(), start: z.number().optional(), end: z.number().optional()})).min(3).max(8), labels: z.object({eyebrow: label.optional(), rightTag: label.optional(), mapCaption: label.optional(), campaignStartLabel: label.optional(), footer: label.optional()}).partial().optional(), palette});
const wc12DisplayCopy = (maxCharacters: number, field: string) => z.string().trim().min(1).max(maxCharacters).refine(
  (value) => !/^(?:show|use|add|render|illustrate|display|depict|animate|overlay|compare|highlight)\b/i.test(value),
  `${field} must not contain an internal editing instruction`,
);
export const WC12PropsSchema = z.object({
  ...base,
  componentId: z.literal('WC12'),
  overlayOnly: z.literal(true),
  underlyingMedia: asset,
  underlyingMediaKind: z.enum(['still', 'clip']),
  subjectCutout: asset,
  displayName: wc12DisplayCopy(48, 'display name'),
  displayRole: wc12DisplayCopy(48, 'display role').nullable(),
  placement: z.literal('right'),
  palette,
}).strict();
export const WCFX01PropsSchema = z.object({...base, componentId: z.literal('WCFX01'), underlyingMedia: asset, preset: z.enum(['normal', 'painting', 'evidence_safe', 'off']), applicationCount: z.literal(1), overlayLabels: z.array(label).max(4).optional(), labels: z.object({title: label.optional(), status: label.optional(), clean: label.optional(), treated: label.optional()}).partial().optional(), palette});
export const MediaPresentationPropsSchema = z.object({
  mediaKind: z.enum(['still', 'clip']),
  media: asset,
  durationFrames: z.number().int().min(1).max(240),
  startFromFrames: z.number().int().min(0),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  surfaceEffect: z.enum(['fine_35mm_grain', 'vignette', 'engraving_halftone']),
  surfaceIntensity: z.literal(0.9),
  presentationEffect: z.enum(['film_dust', 'snowfall', 'smoke_ash', 'white_grid']),
  presentationIntensity: z.literal(1),
  presentationMode: z.enum(['stay_framed', 'expand_fullscreen']),
  frameAlways: z.literal(true),
  frameTreatment: z.discriminatedUnion('style', [
    z.object({style: z.literal('basic_static')}).strict(),
    z.object({
      style: z.literal('animated_signal_yellow'),
      reason: z.enum(['solo_person_reveal', 'specific_object_place_reveal']),
      visibleSubject: label,
      evidenceHash: hash,
    }).strict(),
  ]).default({style: 'basic_static'}),
  textOverlay: mediaTextOverlay.nullable().default(null),
}).superRefine((value, context) => {
  if (value.mediaKind === 'clip' && value.durationFrames > 180) {
    context.addIssue({code: 'custom', message: 'clip duration must not exceed 180 frames', path: ['durationFrames']});
  }
  if (value.mediaKind === 'still' && value.presentationMode !== 'stay_framed') {
    context.addIssue({code: 'custom', message: 'stills must remain framed', path: ['presentationMode']});
  }
  if (value.textOverlay && value.presentationMode !== 'stay_framed') {
    context.addIssue({code: 'custom', message: 'text overlays require a safely framed presentation', path: ['textOverlay']});
  }
});

export const ProductionPropsSchema = z.union([WC01PropsSchema, WC02PropsSchema, WC04MovementPropsSchema, WC04RankedPropsSchema, WC04AdaptiveTacticalMapPropsSchema, WC04AdaptiveTacticalMapV2PropsSchema, WC06PropsSchema, WC07PropsSchema, WC08PropsSchema, WC09PropsSchema, WC10PropsSchema, WC11PropsSchema, WC12PropsSchema, WCFX01PropsSchema]);
export type ProductionProps = z.infer<typeof ProductionPropsSchema>;
export type Palette = z.infer<typeof palette>;
export type WC01Props = z.infer<typeof WC01PropsSchema>;
export type WC02Props = z.infer<typeof WC02PropsSchema>;
export type WC04MovementProps = z.infer<typeof WC04MovementPropsSchema>;
export type WC04RankedProps = z.infer<typeof WC04RankedPropsSchema>;
export type WC04AdaptiveTacticalMapProps = z.infer<typeof WC04AdaptiveTacticalMapPropsSchema>;
export type WC04AdaptiveTacticalMapV2Props = z.infer<typeof WC04AdaptiveTacticalMapV2PropsSchema>;
export type TacticalArrowSpec = z.infer<typeof tacticalArrow>;
export type EngravedPieceSpec = z.infer<typeof engravedPiece>;
export type WC06Props = z.infer<typeof WC06PropsSchema>;
export type WC07Props = z.infer<typeof WC07PropsSchema>;
export type WC08Props = z.infer<typeof WC08PropsSchema>;
export type WC09Props = z.infer<typeof WC09PropsSchema>;
export type WC10Props = z.infer<typeof WC10PropsSchema>;
export type WC11Props = z.infer<typeof WC11PropsSchema>;
export type WC12Props = z.infer<typeof WC12PropsSchema>;
export type WCFX01Props = z.infer<typeof WCFX01PropsSchema>;
export type MediaPresentationProps = z.input<typeof MediaPresentationPropsSchema>;
export const WCFX_PRESETS = {normal: {grain: 0.21, vignette: 0.45, dust: 0.24}, painting: {grain: 0.189, vignette: 0.405, dust: 0.216}, evidence_safe: {grain: 0.05, vignette: 0.1, dust: 0.05}, off: {grain: 0, vignette: 0, dust: 0}} as const;
