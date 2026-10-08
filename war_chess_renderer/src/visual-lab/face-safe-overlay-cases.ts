import type {
  FaceSafeOverlayCandidate,
  FaceSafeOverlayCase,
  FaceSafeFace,
  FaceSafeRect,
} from '../face-safe-overlay';

export type FaceSafeOverlayLabCase = FaceSafeOverlayCase & {
  label: string;
  sceneStartFrame: number;
  sceneEndFrame: number;
  mediaStaticFileKey: string;
  mediaObjectPosition: string;
  backgroundColor: string;
};

const rect = (x: number, y: number, width: number, height: number): FaceSafeRect => ({
  x,
  y,
  width,
  height,
});

const face = (id: string, value: FaceSafeRect): FaceSafeFace => ({id, rect: value});

const candidate = (
  id: string,
  anchor: FaceSafeOverlayCandidate['anchor'],
  priority: number,
  value: FaceSafeRect,
  overrides: Partial<FaceSafeOverlayCandidate> = {},
): FaceSafeOverlayCandidate => ({
  id,
  anchor,
  priority,
  rect: value,
  padding: 24,
  maxLines: 2,
  fontSize: 36,
  lineHeight: 1.12,
  ...overrides,
});

export const FACE_SAFE_OVERLAY_LAB_CASES: FaceSafeOverlayLabCase[] = [
  {
    caseId: 'a-chess-overlay',
    label: 'FACE-SAFE OVERLAY · ORDINARY CHESS IMAGE',
    sourceText: 'Command changes the board.',
    sceneStartFrame: 0,
    sceneEndFrame: 180,
    mediaStaticFileKey: 'visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg',
    mediaObjectPosition: '50% 50%',
    backgroundColor: '#14100c',
    faces: [],
    candidates: [
      candidate('bottom-left', 'bottom-left', 1, rect(120, 790, 980, 170), {
        fontSize: 36,
      }),
      candidate('bottom-right', 'bottom-right', 2, rect(820, 790, 980, 170), {
        fontSize: 36,
      }),
    ],
  },
  {
    caseId: 'b-person-safe-overlay',
    label: 'FACE-SAFE OVERLAY · PERSON IMAGE',
    sourceText: 'The commander remains in view.',
    sceneStartFrame: 180,
    sceneEndFrame: 360,
    mediaStaticFileKey: 'visual-lab/historical-documents/napoleon-study.jpg',
    mediaObjectPosition: '50% 16%',
    backgroundColor: '#211a17',
    faces: [face('napoleon-face', rect(845, 315, 285, 300))],
    candidates: [
      candidate('top-left', 'top-left', 1, rect(120, 90, 700, 190), {
        fontSize: 34,
      }),
      candidate('bottom-left', 'bottom-left', 2, rect(120, 790, 900, 170), {
        fontSize: 34,
      }),
    ],
  },
  {
    caseId: 'c-face-fallback',
    label: 'FACE-SAFE OVERLAY · FALLBACK MOVES THE COPY',
    sourceText: 'A face remains evidence, so the caption moves.',
    sceneStartFrame: 360,
    sceneEndFrame: 540,
    mediaStaticFileKey: 'visual-lab/historical-documents/napoleon-study.jpg',
    mediaObjectPosition: '50% 16%',
    backgroundColor: '#211a17',
    faces: [face('napoleon-face', rect(1260, 80, 330, 360))],
    candidates: [
      candidate('top-right', 'top-right', 1, rect(1220, 70, 580, 210), {
        fontSize: 32,
      }),
      candidate('bottom-left', 'bottom-left', 2, rect(120, 790, 960, 180), {
        fontSize: 34,
      }),
      candidate('bottom-right', 'bottom-right', 3, rect(1080, 790, 720, 180), {
        fontSize: 32,
      }),
    ],
  },
  {
    caseId: 'd-face-blocked',
    label: 'PREFLIGHT BLOCKED · EVERY OVERLAY COVERS A FACE',
    sourceText: 'No safe placement is available for this complete source copy.',
    sceneStartFrame: 540,
    sceneEndFrame: 720,
    mediaStaticFileKey: 'visual-lab/historical-documents/napoleon-study.jpg',
    mediaObjectPosition: '50% 16%',
    backgroundColor: '#211a17',
    faces: [
      face('face-top-left', rect(80, 70, 820, 270)),
      face('face-top-right', rect(1220, 70, 620, 280)),
      face('face-bottom-left', rect(80, 770, 1040, 240)),
      face('face-bottom-right', rect(1160, 760, 700, 250)),
    ],
    candidates: [
      candidate('top-left', 'top-left', 1, rect(120, 90, 700, 190), {fontSize: 32}),
      candidate('top-right', 'top-right', 2, rect(1220, 90, 580, 190), {fontSize: 32}),
      candidate('bottom-left', 'bottom-left', 3, rect(120, 790, 960, 180), {fontSize: 32}),
      candidate('bottom-right', 'bottom-right', 4, rect(1180, 790, 620, 180), {fontSize: 32}),
    ],
  },
];

