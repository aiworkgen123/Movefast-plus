export type AnchoredProgressionRelationship =
  | 'progression'
  | 'contrast'
  | 'cause_effect'
  | 'facets'
  | 'repeated_context';

export type AnchoredProgressionAnchorKind =
  | 'person'
  | 'place'
  | 'object'
  | 'document'
  | 'group'
  | 'symbol';

export type AnchoredProgressionItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  imageStaticFileKey?: string;
  imageSource?: string;
  imageObjectPosition?: string;
  sourceCredit?: string;
  accent: string;
  startFrame: number;
  endFrame: number;
};

export type AnchoredProgressionConfig = {
  relationship: AnchoredProgressionRelationship;
  anchorKind: AnchoredProgressionAnchorKind;
  anchorSide?: 'left' | 'right';
  anchorLabel: string;
  anchorTitle: string;
  relationshipLabel: string;
  anchorCutoutStaticFileKey?: string;
  anchorCutoutSource?: string;
  anchorBackgroundStaticFileKey?: string;
  anchorBackgroundSource?: string;
  anchorSourceCredit?: string;
  items: AnchoredProgressionItem[];
  audioStaticFileKey?: string;
  durationInFrames: number;
  dockStartFrame: number;
  dockEndFrame: number;
  closeStartFrame: number;
  closeEndFrame: number;
  finalMessage?: string;
  finalDetail?: string;
  showIndex?: boolean;
};

const RELATIONSHIPS = new Set<AnchoredProgressionRelationship>([
  'progression',
  'contrast',
  'cause_effect',
  'facets',
  'repeated_context',
]);

const ANCHOR_KINDS = new Set<AnchoredProgressionAnchorKind>([
  'person',
  'place',
  'object',
  'document',
  'group',
  'symbol',
]);

const localAsset = (value: string, field: string): void => {
  if (!value || value.startsWith('/') || value.includes('..') || /^https?:/i.test(value)) {
    throw new Error(`${field} must be a project-local static file key`);
  }
};

const resolvedAsset = (
  staticFileKey: string | undefined,
  source: string | undefined,
  field: string,
): void => {
  if (Boolean(staticFileKey) === Boolean(source)) {
    throw new Error(`${field} requires exactly one static file key or resolved source`);
  }
  if (staticFileKey) localAsset(staticFileKey, `${field}StaticFileKey`);
  if (
    source &&
    (!source.trim() || source.length > 2000 || /[\u0000-\u001f]/.test(source) || /^javascript:/i.test(source))
  ) {
    throw new Error(`${field}Source is invalid`);
  }
};

const shortText = (value: string, maximum: number, field: string): void => {
  if (!value.trim() || value.length > maximum) {
    throw new Error(`${field} must contain 1-${maximum} characters`);
  }
};

export const validateAnchoredProgressionConfig = (
  input: AnchoredProgressionConfig,
): AnchoredProgressionConfig => {
  if (!RELATIONSHIPS.has(input.relationship)) {
    throw new Error('relationship is not supported');
  }
  if (!ANCHOR_KINDS.has(input.anchorKind)) {
    throw new Error('anchorKind is not supported');
  }
  if (input.anchorSide !== undefined && input.anchorSide !== 'left' && input.anchorSide !== 'right') {
    throw new Error('anchorSide must be left or right');
  }
  if (input.items.length < 2 || input.items.length > 5) {
    throw new Error('anchored progression requires two to five related items');
  }
  if (!Number.isInteger(input.durationInFrames) || input.durationInFrames < 90) {
    throw new Error('durationInFrames must be an integer of at least 90 frames');
  }
  if (
    !Number.isInteger(input.dockStartFrame) ||
    !Number.isInteger(input.dockEndFrame) ||
    input.dockStartFrame < 0 ||
    input.dockEndFrame <= input.dockStartFrame ||
    input.dockEndFrame >= input.durationInFrames
  ) {
    throw new Error('dock timing is invalid');
  }
  if (
    !Number.isInteger(input.closeStartFrame) ||
    !Number.isInteger(input.closeEndFrame) ||
    input.closeStartFrame <= input.dockEndFrame ||
    input.closeEndFrame <= input.closeStartFrame ||
    input.closeEndFrame >= input.durationInFrames
  ) {
    throw new Error('close timing is invalid');
  }

  shortText(input.anchorLabel, 24, 'anchorLabel');
  shortText(input.anchorTitle, 42, 'anchorTitle');
  shortText(input.relationshipLabel, 40, 'relationshipLabel');
  resolvedAsset(
    input.anchorCutoutStaticFileKey,
    input.anchorCutoutSource,
    'anchorCutout',
  );
  if (input.anchorBackgroundStaticFileKey || input.anchorBackgroundSource) {
    resolvedAsset(
      input.anchorBackgroundStaticFileKey,
      input.anchorBackgroundSource,
      'anchorBackground',
    );
  }
  if (input.anchorSourceCredit) {
    shortText(input.anchorSourceCredit, 120, 'anchorSourceCredit');
  }
  if (input.audioStaticFileKey) {
    localAsset(input.audioStaticFileKey, 'audioStaticFileKey');
  }
  if (input.finalMessage) shortText(input.finalMessage, 64, 'finalMessage');
  if (input.finalDetail) shortText(input.finalDetail, 90, 'finalDetail');

  const ids = new Set<string>();
  input.items.forEach((item, index) => {
    shortText(item.id, 64, `items[${index}].id`);
    shortText(item.label, 24, `items[${index}].label`);
    shortText(item.title, 42, `items[${index}].title`);
    shortText(item.detail, 90, `items[${index}].detail`);
    resolvedAsset(item.imageStaticFileKey, item.imageSource, `items[${index}].image`);
    if (item.imageObjectPosition) {
      shortText(item.imageObjectPosition, 40, `items[${index}].imageObjectPosition`);
    }
    if (item.sourceCredit) {
      shortText(item.sourceCredit, 120, `items[${index}].sourceCredit`);
    }
    if (!/^#[0-9a-f]{6}$/i.test(item.accent)) {
      throw new Error(`items[${index}].accent must be a six-digit hex color`);
    }
    if (ids.has(item.id)) throw new Error('item ids must be unique');
    ids.add(item.id);
    if (
      !Number.isInteger(item.startFrame) ||
      !Number.isInteger(item.endFrame) ||
      item.startFrame < input.dockStartFrame ||
      item.endFrame <= item.startFrame ||
      item.endFrame > input.closeEndFrame
    ) {
      throw new Error(`items[${index}] timing is invalid`);
    }
    if (index > 0) {
      const previous = input.items[index - 1];
      if (
        item.startFrame <= previous.startFrame ||
        item.startFrame >= previous.endFrame ||
        previous.endFrame - item.startFrame > 60
      ) {
        throw new Error('items must be ordered with a 1-60 frame transition overlap');
      }
    }
  });

  return input;
};
