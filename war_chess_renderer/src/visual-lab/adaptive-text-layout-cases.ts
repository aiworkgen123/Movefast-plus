import type {
  AdaptiveProtectedRect,
  AdaptiveTextCase,
  AdaptiveTextVariant,
  LayoutRect,
} from '../adaptive-text-layout';

export type AdaptiveTextLabCase = AdaptiveTextCase & {
  label: string;
  sceneStartFrame: number;
  sceneEndFrame: number;
  mediaStaticFileKey: string;
  mediaRect: LayoutRect;
  mediaObjectPosition: string;
  backgroundColor: string;
  anchorSide: 'left' | 'right';
  protectedMedia: AdaptiveProtectedRect[];
};

const variant = (value: AdaptiveTextVariant): AdaptiveTextVariant => value;

const napoleonCutout =
  'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png';

export const ADAPTIVE_TEXT_LAYOUT_LAB_CASES: AdaptiveTextLabCase[] = [
  {
    caseId: 'a-short-anchored',
    label: 'ANCHOR · SHORT COPY',
    sourceText: 'Command changes the board.',
    sceneStartFrame: 0,
    sceneEndFrame: 180,
    mediaStaticFileKey: 'visual-lab/phase-progression-real/pexels-muhammed-18706253.jpg',
    mediaRect: {x: 1120, y: 130, width: 680, height: 760},
    mediaObjectPosition: '54% 54%',
    backgroundColor: '#11161b',
    anchorSide: 'right',
    zones: [
      {id: 'left-field', rect: {x: 120, y: 170, width: 820, height: 260}},
    ],
    protectedRects: [
      {id: 'anchored-media', rect: {x: 1120, y: 130, width: 680, height: 760}},
    ],
    protectedMedia: [
      {id: 'anchored-media', rect: {x: 1120, y: 130, width: 680, height: 760}},
    ],
    variants: [
      variant({
        id: 'short-left',
        zoneId: 'left-field',
        priority: 1,
        padding: 28,
        maxLines: 2,
        preferredFontSize: 50,
        minFontSize: 34,
        lineHeight: 1.08,
        anchor: 'left',
        verticalAnchor: 'center',
      }),
    ],
  },
  {
    caseId: 'b-long-alternate-zone',
    label: 'ANCHOR · ALTERNATE SAFE ZONE',
    sourceText: 'The commander stays visible while the position carries the argument.',
    sceneStartFrame: 180,
    sceneEndFrame: 360,
    mediaStaticFileKey: 'visual-lab/historical-documents/napoleon-study.jpg',
    mediaRect: {x: 960, y: 90, width: 850, height: 800},
    mediaObjectPosition: '58% 46%',
    backgroundColor: '#171412',
    anchorSide: 'right',
    zones: [
      {id: 'narrow-left-field', rect: {x: 100, y: 180, width: 480, height: 230}},
      {id: 'lower-safe-field', rect: {x: 100, y: 790, width: 1040, height: 190}},
    ],
    protectedRects: [
      {id: 'napoleon-cutout', rect: {x: 1240, y: 90, width: 500, height: 800}},
    ],
    protectedMedia: [
      {id: 'napoleon-cutout', rect: {x: 1240, y: 90, width: 500, height: 800}},
    ],
    variants: [
      variant({
        id: 'main-left-single-line',
        zoneId: 'narrow-left-field',
        priority: 1,
        padding: 24,
        maxLines: 1,
        preferredFontSize: 42,
        minFontSize: 30,
        lineHeight: 1.08,
        anchor: 'left',
        verticalAnchor: 'center',
      }),
      variant({
        id: 'lower-alternate-two-line',
        zoneId: 'lower-safe-field',
        priority: 2,
        padding: 24,
        maxLines: 2,
        preferredFontSize: 38,
        minFontSize: 28,
        lineHeight: 1.08,
        anchor: 'left',
        verticalAnchor: 'center',
      }),
    ],
  },
  {
    caseId: 'c-long-bottom-rail',
    label: 'BOTTOM RAIL · LONG COPY',
    sourceText:
      'A wide dedicated rail can carry the complete sentence while the image remains the dominant evidence.',
    sceneStartFrame: 360,
    sceneEndFrame: 540,
    mediaStaticFileKey: 'visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg',
    mediaRect: {x: 220, y: 100, width: 1480, height: 700},
    mediaObjectPosition: '60% 52%',
    backgroundColor: '#0f1718',
    anchorSide: 'left',
    zones: [
      {id: 'wide-bottom-rail', rect: {x: 110, y: 900, width: 1700, height: 115}},
    ],
    protectedRects: [
      {id: 'wide-media', rect: {x: 220, y: 100, width: 1480, height: 700}},
    ],
    protectedMedia: [
      {id: 'wide-media', rect: {x: 220, y: 100, width: 1480, height: 700}},
    ],
    variants: [
      variant({
        id: 'wide-bottom-rail',
        zoneId: 'wide-bottom-rail',
        priority: 1,
        padding: 22,
        maxLines: 1,
        preferredFontSize: 30,
        minFontSize: 25,
        lineHeight: 1.05,
        anchor: 'center',
        verticalAnchor: 'center',
      }),
    ],
  },
  {
    caseId: 'd-impossible-preflight',
    label: 'PREFLIGHT BLOCKED · NO SAFE LAYOUT',
    sourceText: 'This copy cannot safely share the protected portrait field.',
    sceneStartFrame: 540,
    sceneEndFrame: 720,
    mediaStaticFileKey: napoleonCutout,
    mediaRect: {x: 100, y: 100, width: 760, height: 340},
    mediaObjectPosition: '50% 50%',
    backgroundColor: '#181216',
    anchorSide: 'left',
    zones: [
      {id: 'blocked-field', rect: {x: 120, y: 140, width: 680, height: 260}},
    ],
    protectedRects: [
      {id: 'protected-portrait', rect: {x: 100, y: 100, width: 760, height: 340}},
    ],
    protectedMedia: [
      {id: 'protected-portrait', rect: {x: 100, y: 100, width: 760, height: 340}},
    ],
    variants: [
      variant({
        id: 'blocked-field',
        zoneId: 'blocked-field',
        priority: 1,
        padding: 24,
        maxLines: 2,
        preferredFontSize: 40,
        minFontSize: 30,
        lineHeight: 1.08,
        anchor: 'left',
        verticalAnchor: 'center',
      }),
    ],
  },
];

