import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {DocumentRevealProps} from './document-reveal-contract.ts';
import {entranceOpacity, progress} from './motion.ts';
import {containImage, focusCrop, mixRect} from './image-framing.ts';
export const documentRevealState = (context: FrameContext, skin: Skin, props: DocumentRevealProps) => {
  const token = skin.documentReveal, d = context.durationInFrames;
  const inset = token.inset * context.width / 1920;
  const viewport = {x: inset, y: context.height * token.mediaTopFraction,
    width: context.width - 2 * inset, height: context.height * token.mediaHeightFraction};
  const move = progress(context.frame, d * token.focusStartFraction, d * token.focusEndFraction, skin.motion.camera);
  const detailOpacity = progress(context.frame, d * token.detailStartFraction, d * token.focusEndFraction, skin.motion.entrance);
  const start = containImage(props.source.width, props.source.height, viewport);
  const end = containImage(props.source.width, props.source.height, {...viewport, width: context.width * token.overviewWidthFraction});
  const detailViewport = {...viewport, x: context.width * token.detailLeftFraction,
    width: context.width * (1 - token.detailLeftFraction) - inset};
  const target = focusCrop(props.source, props.detail, detailViewport, token.contextPadding, token.maxZoom);
  const crop = mixRect({x: 0, y: 0, width: props.source.width, height: props.source.height}, target, move);
  return {opacity: entranceOpacity(context, skin), move, detailOpacity, overview: mixRect(start, end, move),
    crop, detailFrame: containImage(crop.width, crop.height, detailViewport), detailViewport};
};
