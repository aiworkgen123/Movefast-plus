import type {RenderComponent, RenderScene, WarChessRenderSpec} from '../schema';

export type CaptionLayoutKind =
  | 'side_field'
  | 'wide_lower_overlay'
  | 'component_subtitle';

export type CaptionLayout = {
  kind: CaptionLayoutKind;
  align: 'left' | 'center' | 'right';
  maxWidth: number;
  fontSize: number;
  lineHeight: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

const MAX_FRAME_WIDTH = 1400;
const MAX_FRAME_HEIGHT = 788;

const sceneAtFrame = (
  spec: Pick<WarChessRenderSpec, 'scenes'>,
  frame: number,
): RenderScene | undefined =>
  spec.scenes.find(
    (scene) => scene.startFrame <= frame && frame < scene.endFrameExclusive,
  );

const fullScreenComponentAtFrame = (
  spec: Pick<WarChessRenderSpec, 'components'>,
  frame: number,
): RenderComponent | undefined =>
  spec.components
    .filter((component) => component.layer === 'full_screen')
    .find(
      (component) =>
        component.startFrame <= frame && frame < component.endFrameExclusive,
    );

/**
 * Captions are positioned from the frozen render graph, never from a random
 * runtime choice. A full-screen component owns its visual field; ordinary
 * media gets either the portrait side field or the low-profile visual overlay.
 */
export const captionLayoutFor = (
  spec: Pick<WarChessRenderSpec, 'scenes' | 'components'>,
  frame: number,
): CaptionLayout => {
  if (fullScreenComponentAtFrame(spec, frame)) {
    return {
      kind: 'component_subtitle',
      align: 'center',
      maxWidth: 960,
      fontSize: 28,
      lineHeight: 1.18,
      left: 120,
      right: 120,
      bottom: 42,
    };
  }

  const scene = sceneAtFrame(spec, frame);
  if (!scene || scene.kind === 'original_motion_graphic') {
    return {
      kind: 'component_subtitle',
      align: 'center',
      maxWidth: 960,
      fontSize: 28,
      lineHeight: 1.18,
      left: 120,
      right: 120,
      bottom: 42,
    };
  }

  const sourceRatio = scene.sourceWidth / scene.sourceHeight;
  const fittedWidth = Math.min(MAX_FRAME_WIDTH, MAX_FRAME_HEIGHT * sourceRatio);
  const sideRoom = (1920 - fittedWidth) / 2;
  const hasGenuineSideRoom =
    scene.treatment.presentationMode === 'stay_framed' &&
    sourceRatio <= 1.15 &&
    sideRoom >= 360;

  if (hasGenuineSideRoom) {
    const sceneIndex = spec.scenes.findIndex((candidate) => candidate.sceneId === scene.sceneId);
    const side = sceneIndex % 2 === 0 ? 'left' : 'right';
    return {
      kind: 'side_field',
      align: side === 'left' ? 'left' : 'right',
      maxWidth: Math.max(300, Math.floor(sideRoom - 112)),
      fontSize: 30,
      lineHeight: 1.16,
      ...(side === 'left' ? {left: 86} : {right: 86}),
      top: 540,
    };
  }

  return {
    kind: 'wide_lower_overlay',
    align: 'left',
    maxWidth: 1050,
    fontSize: 32,
    lineHeight: 1.14,
    left:
      scene.treatment.presentationMode === 'stay_framed'
        ? Math.round((1920 - fittedWidth) / 2 + 56)
        : 112,
    right:
      scene.treatment.presentationMode === 'stay_framed'
        ? Math.round((1920 - fittedWidth) / 2 + 56)
        : 112,
    // Keep a stay-framed caption on the lower part of the visual itself.
    // Expand-fullscreen clips use the full composition height and retain the
    // smaller safe-area offset.
    bottom:
      scene.treatment.presentationMode === 'stay_framed'
        ? Math.round((1080 - Math.min(MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH / sourceRatio)) / 2 + 48)
        : 78,
  };
};
