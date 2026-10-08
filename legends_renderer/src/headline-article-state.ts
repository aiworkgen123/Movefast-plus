import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {HeadlineArticleProps} from './headline-article-contract.ts';
import {entranceOpacity, progress} from './motion.ts';
import {containImage, focusCrop, mixRect} from './image-framing.ts';
export const headlineArticleState = (context: FrameContext, skin: Skin, props: HeadlineArticleProps) => {
  const token = skin.headlineArticle, d = context.durationInFrames, scale = context.width / 1920;
  const viewport = {x: token.inset * scale, y: context.height * token.pageTopFraction,
    width: context.width - 2 * token.inset * scale, height: context.height * token.pageHeightFraction};
  const camera = progress(context.frame, d * token.focusStartFraction, d * token.focusEndFraction, skin.motion.camera);
  const target = focusCrop(props.source, props.line, viewport, token.contextPadding, token.maxZoom);
  const crop = mixRect({x: 0, y: 0, width: props.source.width, height: props.source.height}, target, camera);
  const imageFrame = containImage(crop.width, crop.height, viewport);
  return {opacity: entranceOpacity(context, skin), camera, crop, imageFrame,
    markerScale: progress(context.frame, d * token.markerStartFraction, d * token.markerEndFraction, skin.motion.entrance),
    marker: {x: (props.line.x * props.source.width - crop.x) * imageFrame.scale,
      y: (props.line.y * props.source.height - crop.y) * imageFrame.scale,
      width: props.line.width * props.source.width * imageFrame.scale,
      height: props.line.height * props.source.height * imageFrame.scale},
    credit: {x: token.inset * scale, y: context.height * token.creditTopFraction, width: context.width - 2 * token.inset * scale}};
};
