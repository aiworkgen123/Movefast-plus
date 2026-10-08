/**
 * This is the only composition registration surface in the production
 * package.  It is intentionally hand-pinned to the owner-approved
 * canonical_components.json; the proof-lab Root is not imported here.
 */

export type ProductionComponentId =
  | 'WC01'
  | 'WC02'
  | 'WC04'
  | 'WC06'
  | 'WC07'
  | 'WC08'
  | 'WC09'
  | 'WC10'
  | 'WC11'
  | 'WC12'
  | 'WCFX01';

export type ProductionMode = 'movement_progression' | 'ranked_formation' | 'adaptive_tactical_map' | null;

export type ProductionAllowlistEntry = {
  readonly componentId: ProductionComponentId;
  readonly mode: ProductionMode;
  readonly backendId: 'WB01' | null;
  readonly canonicalComposition: string;
  readonly durationInFrames: number;
  readonly overlayOnly: boolean;
  readonly referenceSha256: string;
  readonly referenceVersion?: 1 | 2;
};

export type ReviewOnlyAllowlistEntry = {
  readonly componentId: 'WC04';
  readonly mode: 'adaptive_tactical_map';
  readonly referenceVersion: 2;
  readonly backendId: null;
  readonly canonicalComposition: 'WarChessWC04AdaptiveTacticalMapV2Review';
  readonly durationInFrames: 240;
  readonly overlayOnly: false;
  readonly referenceSha256: string;
  readonly reviewOnly: true;
  readonly freshProductionAllowed: false;
};

export type CompatibilityAllowlistEntry = ProductionAllowlistEntry & {
  readonly referenceVersion: 1;
  readonly freshProductionAllowed: false;
  readonly retentionStatus: 'legacy_read_only_compatibility';
};

export const CANONICAL_SOURCE_PROOF_REGISTRY_SHA256 =
  'e30502d0a64b8ca20219cfd6696d7d1d3021e668645a53f0bd029c38c3a098d2';

/** Exactly the thirteen fresh rows in the skill-owned canonical registry. */
export const PRODUCTION_ALLOWLIST = [
  {
    componentId: 'WC01',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC01',
    durationInFrames: 150,
    overlayOnly: false,
    referenceSha256: 'df6be169261ac82c2cf474c4451f181e498b65d6363d76159e7377f0e577c5a0',
  },
  {
    componentId: 'WC02',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC02',
    durationInFrames: 270,
    overlayOnly: false,
    referenceSha256: '52640e1c6b3f67c4f64b50493a33cece37bd441d52139ec97280da9c8b470146',
  },
  {
    componentId: 'WC04',
    mode: 'movement_progression',
    backendId: null,
    canonicalComposition: 'WarChessWC04CChessEnhanced',
    durationInFrames: 240,
    overlayOnly: false,
    referenceSha256: '14dc396e5757afc02578a4af735d0ebd13921270d868f1b9655a9ee2a2ec2130',
  },
  {
    componentId: 'WC04',
    mode: 'ranked_formation',
    backendId: null,
    canonicalComposition: 'WarChessMapRankedPiecesV2',
    durationInFrames: 318,
    overlayOnly: false,
    referenceSha256: '0e692fa5e6db774229d098ac9b2855c631adc82e52c0c938b2bba4b30f5223d2',
  },
  {
    componentId: 'WC04',
    mode: 'adaptive_tactical_map',
    backendId: null,
    canonicalComposition: 'WarChessWC04AdaptiveTacticalMapV2',
    durationInFrames: 240,
    referenceSha256: '87dda7701f0733bdf15c453f107b5e793aff60a4be6079673b26c94743b9fe2f',
    referenceVersion: 2,
    overlayOnly: false,
  },
  {
    componentId: 'WC06',
    mode: null,
    backendId: 'WB01',
    canonicalComposition: 'WarChessWC06ChessEvaluation',
    durationInFrames: 318,
    overlayOnly: false,
    referenceSha256: 'd137fefb923896f4c5f58ef364154f7de02b49e7c6541872c63cada3eeaa2e00',
  },
  {
    componentId: 'WC07',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC07',
    durationInFrames: 210,
    overlayOnly: false,
    referenceSha256: '6b15af284ddc01864aa2c0e4ae33e5fe21b4ade9b57556393c413538ea0a8809',
  },
  {
    componentId: 'WC08',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC08',
    durationInFrames: 210,
    overlayOnly: true,
    referenceSha256: '1e7509eead2e618bb0e72cfcd145016d471c100e6f8eb6831fd3f127dfe78dec',
  },
  {
    componentId: 'WC09',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC09',
    durationInFrames: 180,
    overlayOnly: true,
    referenceSha256: 'd218bb857ae4a2f323020673a7024e3aa28b1b7fe672c4576579f4426109867e',
  },
  {
    componentId: 'WC10',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC10StrategicDecisionForkV7',
    durationInFrames: 330,
    overlayOnly: false,
    referenceSha256: '2ff9aeb3e38dab16a38a8dbe30cd73711cb48501a23f3fd645e9063958a81f8f',
  },
  {
    componentId: 'WC11',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC11CampaignTimeline',
    durationInFrames: 420,
    overlayOnly: false,
    referenceSha256: 'd3f8ef40e9622af8cc738cd5f7502e68d19931b6affb8f10ee150da3f99a5523',
  },
  {
    componentId: 'WC12',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWC12NamedPersonOverlay',
    durationInFrames: 150,
    overlayOnly: true,
    referenceSha256: '441e2a5d1c5154f3d3d27b0ac2193fff140b08baf177aca66033f1b50d718545',
  },
  {
    componentId: 'WCFX01',
    mode: null,
    backendId: null,
    canonicalComposition: 'WarChessWCFX01',
    durationInFrames: 180,
    overlayOnly: false,
    referenceSha256: '4988daa6e2f9b3b02469720dddf751a4dc95700a5e13adc6d6f92c79245c8d92',
  },
] as const satisfies readonly ProductionAllowlistEntry[];

/** Exact v1 WC04 binding retained for old hash-bound projects. */
export const COMPATIBILITY_ALLOWLIST = [
    {
      componentId: 'WC04',
      mode: 'adaptive_tactical_map',
    referenceVersion: 1,
      backendId: null,
    canonicalComposition: 'WarChessWC04AdaptiveTacticalMap',
      durationInFrames: 240,
      overlayOnly: false,
    referenceSha256: '00c0f749e970216916171683cef41de0598a877f2e34c8bfaefa11a4c1f5e5a0',
    freshProductionAllowed: false,
    retentionStatus: 'legacy_read_only_compatibility',
  },
] as const satisfies readonly CompatibilityAllowlistEntry[];

/** Historical proof surface is retained in evidence, not fresh resolution. */
export const REVIEW_ONLY_ALLOWLIST: readonly ReviewOnlyAllowlistEntry[] = [];

export const PRODUCTION_COMPOSITION_IDS = PRODUCTION_ALLOWLIST.map(
  (entry) => entry.canonicalComposition,
) as readonly string[];
export const COMPATIBILITY_COMPOSITION_IDS = COMPATIBILITY_ALLOWLIST.map(
  (entry) => entry.canonicalComposition,
) as readonly string[];

/** Ordinary sourced media uses this separate owner-approved compositor. */
export const MEDIA_PRESENTATION_COMPOSITION_ID =
  'WarChessMediaPresentation' as const;

/** IDs seen in the lab but deliberately not addressable by production. */
export const KNOWN_REJECTED_OR_SUPERSEDED_IDS = [
  'WC03',
  'WC05',
  'WarChessWC03',
  'WarChessWC05',
  'WCTR01',
  'WarChessWCTR01',
  'WarChessWC04',
  'WarChessWC04A',
  'WarChessWC04C',
  'WarChessWC04CChessEnhancedV2',
  'WarChessMapRankedPieces',
  'WarChessWC10StrategicDecisionFork',
  'WarChessWC10StrategicDecisionForkV2',
  'WarChessWC10StrategicDecisionForkV3',
  'WarChessWC10StrategicDecisionForkV4',
  'WarChessWC10StrategicDecisionForkV5',
  'WarChessWC10StrategicDecisionForkV6',
  'WarChessCannaeForceComparisonCandidate',
  'WarChessCannaeForceComparisonCandidateV2',
  'WarChessCannaeSurfaceTreatmentCandidate',
  'WarChessCannaeSurfaceTreatmentCandidateV2',
] as const;

export const isProductionComposition = (id: string): boolean =>
  PRODUCTION_COMPOSITION_IDS.includes(id);

export const isDeniedComposition = (id: string): boolean =>
  (KNOWN_REJECTED_OR_SUPERSEDED_IDS as readonly string[]).includes(id);

export const getAllowlistEntry = (
  componentId: string,
  mode: string | null | undefined,
  backendId: string | null | undefined,
  referenceVersion?: number,
): ProductionAllowlistEntry | undefined =>
  (referenceVersion === 1 ? [] : PRODUCTION_ALLOWLIST).find(
    (entry) =>
      entry.componentId === componentId &&
      entry.mode === (mode ?? null) &&
      entry.backendId === (backendId ?? null),
  );

export const getCompatibilityAllowlistEntry = (
  componentId: string,
  mode: string | null | undefined,
  backendId: string | null | undefined,
  referenceVersion: number | undefined,
): CompatibilityAllowlistEntry | undefined =>
  (referenceVersion === 1 ? COMPATIBILITY_ALLOWLIST : []).find(
    (entry) =>
      entry.componentId === componentId &&
      entry.mode === (mode ?? null) &&
      entry.backendId === (backendId ?? null),
  );

export const getReviewOnlyEntry = (
  componentId: string,
  mode: string | null | undefined,
  referenceVersion: number | undefined,
): ReviewOnlyAllowlistEntry | undefined =>
  REVIEW_ONLY_ALLOWLIST.find(
    (entry) =>
      entry.componentId === componentId &&
      entry.mode === (mode ?? null) &&
      entry.referenceVersion === referenceVersion,
  );
