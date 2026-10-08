import type {RenderScene} from '../schema';
import type {CaptionLayout} from '../ported/caption-hierarchy';
import {captionLayoutFor} from '../ported/caption-hierarchy';
import type {
  LockedCaptionPreflightInput,
  ProtectedCaptionRegion,
} from '../locked-caption-preflight';

const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export type LockedCaptionProofCase = LockedCaptionPreflightInput & {
  scene: Exclude<RenderScene, {kind: 'original_motion_graphic'}>;
  layouts: Record<string, CaptionLayout>;
  startFrame: number;
  endFrameExclusive: number;
  captionStartFrame: number;
  captionEndFrameExclusive: number;
};

const still = (
  sceneId: string,
  staticFileKey: string,
  sha256: string,
  sourceWidth: number,
  sourceHeight: number,
  seed: number,
): LockedCaptionProofCase['scene'] => ({
  kind: 'animated_still',
  sceneId,
  parentUnitId: `${sceneId}-unit`,
  startFrame: 0,
  endFrameExclusive: 180,
  routeId: `${sceneId}-route`,
  treatment: {
    surfaceEffect: 'fine_35mm_grain',
    presentationEffect: 'film_dust',
    presentationMode: 'stay_framed',
    seed,
  },
  acceptedScopeHash: ZERO_HASH,
  source: {
    artifactId: `${sceneId}-asset`,
    sha256,
    mediaType: 'image/jpeg',
    staticFileKey,
  },
  sourceWidth,
  sourceHeight,
});

const layoutFor = (scene: LockedCaptionProofCase['scene']): CaptionLayout =>
  captionLayoutFor({scenes: [scene], components: []}, 0);

const region = (
  id: string,
  kind: ProtectedCaptionRegion['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
): ProtectedCaptionRegion => ({id, kind, rect: {x, y, width, height}});

const rommel = still(
  'locked-caption-rommel',
  'visual-lab/factual-owner-cut/rommel-1917.jpg',
  '3998197160b4a4439fd6c1f94edb095cc4bdada08fa0b75f6656fbde6861ffb9',
  1096,
  1651,
  17,
);
const sicily = still(
  'locked-caption-sicily',
  'visual-lab/factual-owner-cut/sicily-map-cc0.jpg',
  '6c1101ce3467d4065d64bf906fc6cf07f8e71be456482ab1a75e1649767eca7d',
  1080,
  597,
  29,
);
const rommelLayout = layoutFor(rommel);
const sicilyLayout = layoutFor(sicily);
const movedSicilyLayout: CaptionLayout = {
  ...sicilyLayout,
  left: (sicilyLayout.left ?? 0) + 360,
  right: undefined,
};

export const LOCKED_CAPTION_PREFLIGHT_CASES: LockedCaptionProofCase[] = [
  {
    caseId: 'safe-production-caption-unchanged',
    originalText: 'Erwin Rommel',
    primaryLayoutId: 'production-side-field',
    protectedRegions: [region('rommel-face', 'face', 790, 176, 300, 310)],
    scene: rommel,
    layouts: {'production-side-field': rommelLayout},
    startFrame: 0,
    endFrameExclusive: 180,
    captionStartFrame: 30,
    captionEndFrameExclusive: 150,
  },
  {
    caseId: 'long-copy-shortened-in-the-same-production-slot',
    originalText:
      'Erwin Rommel developed a method of command built on speed, surprise, and constant movement.',
    shorterText: 'Rommel relied on speed and surprise.',
    requiredExactTerms: ['Rommel'],
    primaryLayoutId: 'production-side-field',
    protectedRegions: [region('rommel-face', 'face', 790, 176, 300, 310)],
    scene: rommel,
    layouts: {'production-side-field': rommelLayout},
    startFrame: 180,
    endFrameExclusive: 360,
    captionStartFrame: 30,
    captionEndFrameExclusive: 150,
  },
  {
    caseId: 'concise-copy-moved-off-map-evidence',
    originalText: 'The retreat route',
    primaryLayoutId: 'production-lower-overlay',
    alternateLayoutIds: ['reviewed-nearby-lower-overlay'],
    protectedRegions: [region('southwest-coast-evidence', 'map_evidence', 286, 792, 320, 142)],
    scene: sicily,
    layouts: {
      'production-lower-overlay': sicilyLayout,
      'reviewed-nearby-lower-overlay': movedSicilyLayout,
    },
    startFrame: 360,
    endFrameExclusive: 540,
    captionStartFrame: 30,
    captionEndFrameExclusive: 150,
  },
];

export const LOCKED_CAPTION_PREFLIGHT_PROOF_DURATION = 540;
