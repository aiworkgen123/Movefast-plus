import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {PhotoSpotlightProps} from './photo-spotlight-contract.ts';
import {entranceOpacity, progress} from './motion.ts';
export const photoSpotlightState = (context: FrameContext, skin: Skin, props: PhotoSpotlightProps) => {
  const token = skin.photoSpotlight;
  const amount = progress(context.frame, 0, context.durationInFrames - 1, skin.motion.camera);
  const zoom = token.startZoom + (token.endZoom - token.startZoom) * amount;
  const scale = Math.max(context.width / props.source.width, context.height / props.source.height) * zoom;
  const halfW = context.width / (2 * scale), halfH = context.height / (2 * scale);
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const cx = clamp(props.source.width * (0.5 + (props.focus.x - 0.5) * amount), halfW, props.source.width - halfW);
  const cy = clamp(props.source.height * (0.5 + (props.focus.y - 0.5) * amount), halfH, props.source.height - halfH);
  const x = context.width / 2 - cx * scale, y = context.height / 2 - cy * scale;
  return {opacity: entranceOpacity(context, skin), amount, zoom, scale, x, y,
    width: props.source.width * scale, height: props.source.height * scale,
    focusScreen: {x: x + props.focus.x * props.source.width * scale, y: y + props.focus.y * props.source.height * scale},
    vignetteOpacity: token.vignetteOpacity * progress(context.frame, 0,
      context.durationInFrames * token.dimEndFraction, skin.motion.entrance)};
};
