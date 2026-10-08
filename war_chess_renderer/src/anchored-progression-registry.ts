import type {
  AnchoredProgressionAnchorKind,
  AnchoredProgressionRelationship,
} from './anchored-progression-config';

export const ANCHORED_PROGRESSION_TEMPLATE_ID =
  'WC02_ANCHORED_PROGRESSION_V2' as const;

export const ANCHORED_PROGRESSION_TEMPLATE = Object.freeze({
  templateId: ANCHORED_PROGRESSION_TEMPLATE_ID,
  componentFamily: 'WC02',
  variant: 'anchored_progression_v2',
  approvalState: 'owner_approved',
  approvedOn: '2026-08-14',
  itemCount: Object.freeze({minimum: 2, maximum: 5}),
  anchorKinds: Object.freeze([
    'person',
    'place',
    'object',
    'document',
    'group',
    'symbol',
  ] satisfies AnchoredProgressionAnchorKind[]),
  relationships: Object.freeze([
    'progression',
    'contrast',
    'cause_effect',
    'facets',
    'repeated_context',
  ] satisfies AnchoredProgressionRelationship[]),
  visualRules: Object.freeze({
    typography: 'no_line_type_1',
    decorativeSequenceNumbers: false,
    anchorRemainsVisible: true,
    itemTextMayOverlapAnchor: false,
    onePrimaryItemAtATime: true,
  }),
});

// Person-anchored three-point variant; schema.ts renders it as
// presentationVariant 'person_marginalia_v3'.
export const PERSON_MARGINALIA_TEMPLATE = Object.freeze({
  componentFamily: 'WC02',
  variant: 'person_marginalia_v3',
  itemCount: Object.freeze({minimum: 3, maximum: 3}),
  anchorKinds: Object.freeze(['person'] satisfies AnchoredProgressionAnchorKind[]),
  visualRules: Object.freeze({
    decorativeSequenceNumbers: false,
    annotationMetadata: false,
    background: 'combined_ash_coarse_grid',
  }),
});

export type AnchoredProgressionOpportunityItem = {
  itemId: string;
  anchorId: string;
  assetArtifactId: string;
  evidenceIds: string[];
  relationshipEstablished: boolean;
};

export type AnchoredProgressionOpportunity = {
  anchorId: string;
  anchorKind: AnchoredProgressionAnchorKind;
  relationship: AnchoredProgressionRelationship;
  items: AnchoredProgressionOpportunityItem[];
};

export type AnchoredProgressionEligibility = {
  eligible: boolean;
  reasons: string[];
};

const nonBlank = (value: string): boolean => value.trim().length > 0;

/**
 * Mechanical eligibility only. Editorial evidence must establish the shared
 * anchor and relationship before the renderer may use this template.
 */
export const evaluateAnchoredProgressionEligibility = (
  opportunity: AnchoredProgressionOpportunity,
): AnchoredProgressionEligibility => {
  const reasons: string[] = [];
  const {minimum, maximum} = ANCHORED_PROGRESSION_TEMPLATE.itemCount;

  if (!nonBlank(opportunity.anchorId)) reasons.push('anchor_id_missing');
  if (!ANCHORED_PROGRESSION_TEMPLATE.anchorKinds.includes(opportunity.anchorKind)) {
    reasons.push('anchor_kind_unsupported');
  }
  if (!ANCHORED_PROGRESSION_TEMPLATE.relationships.includes(opportunity.relationship)) {
    reasons.push('relationship_unsupported');
  }
  if (opportunity.items.length < minimum || opportunity.items.length > maximum) {
    reasons.push('item_count_out_of_range');
  }

  const itemIds = new Set<string>();
  for (const item of opportunity.items) {
    if (!nonBlank(item.itemId) || itemIds.has(item.itemId)) {
      reasons.push('item_identity_invalid');
    }
    itemIds.add(item.itemId);
    if (item.anchorId !== opportunity.anchorId) reasons.push('item_anchor_mismatch');
    if (!nonBlank(item.assetArtifactId)) reasons.push('item_asset_missing');
    if (item.evidenceIds.length === 0 || item.evidenceIds.some((id) => !nonBlank(id))) {
      reasons.push('item_evidence_missing');
    }
    if (!item.relationshipEstablished) reasons.push('item_relationship_unproven');
  }

  return {eligible: reasons.length === 0, reasons: [...new Set(reasons)]};
};
