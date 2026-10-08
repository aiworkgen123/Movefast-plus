import type {TikTokPage} from '@remotion/captions';
import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {captionTrackIntervals} from './caption-track';
import {captionLayoutFor, type CaptionLayout} from './ported/caption-hierarchy';
import type {WarChessRenderSpec} from './schema';
import {WC_EDITORIAL_SANS} from './editorial-theme';

type CaptionCue = WarChessRenderSpec['captions'][number];
type CaptionGraph = Pick<WarChessRenderSpec, 'scenes' | 'components'>;

const DEFAULT_CAPTION_LAYOUT: CaptionLayout = {
  kind: 'component_subtitle',
  align: 'center',
  maxWidth: 1180,
  fontSize: 46,
  lineHeight: 1.16,
  bottom: 72,
};

export const LockedCaption: React.FC<{
  text: string;
  textRef?: React.Ref<HTMLDivElement>;
  layout?: CaptionLayout;
  durationInFrames?: number;
}> = ({text, textRef, layout = DEFAULT_CAPTION_LAYOUT}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <div
      ref={textRef}
      data-production-caption-page="true"
      style={{
        color: '#faf8f1',
        width: '100%',
        maxWidth: layout.maxWidth,
        fontFamily: WC_EDITORIAL_SANS,
        fontSize: layout.fontSize,
        fontWeight: 650,
        lineHeight: layout.lineHeight,
        textAlign: layout.align,
        textShadow: '0 2px 14px rgba(0,0,0,.78)',
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 2,
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        textWrap: 'balance',
        opacity: enter,
        translate: `0 ${interpolate(enter, [0, 1], [28, 0])}px`,
      }}
    >
      {text}
    </div>
  );
};

const CaptionPage: React.FC<{
  page: TikTokPage;
  graph: CaptionGraph;
  pageStartFrame: number;
}> = ({page, graph, pageStartFrame}) => {
  const frame = useCurrentFrame();
  const absoluteFrame = pageStartFrame + frame;
  if (graph.scenes.some(scene => scene.edit && scene.startFrame <= absoluteFrame && absoluteFrame < scene.endFrameExclusive)) return null;
  const layout = captionLayoutFor(graph, pageStartFrame + frame);
  const sideField = layout.kind === 'side_field';
  return (
    <AbsoluteFill
      style={{
        justifyContent: sideField ? 'flex-start' : 'flex-end',
        alignItems: layout.align === 'center'
          ? 'center'
          : layout.align === 'right'
            ? 'flex-end'
            : 'flex-start',
        paddingTop: layout.top ?? 0,
        paddingLeft: layout.left ?? 0,
        paddingRight: layout.right ?? 0,
        paddingBottom: layout.bottom ?? 0,
        pointerEvents: 'none',
      }}
    >
      <LockedCaption text={page.text} layout={layout} />
    </AbsoluteFill>
  );
};

export const CaptionTrack: React.FC<{
  cues: readonly CaptionCue[];
  scenes: WarChessRenderSpec['scenes'];
  components: WarChessRenderSpec['components'];
}> = ({cues, scenes, components}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const intervals = useMemo(
    () => captionTrackIntervals(cues, fps, durationInFrames),
    [cues, durationInFrames, fps],
  );
  return intervals.map(({page, startFrame, endFrameExclusive}) => (
    <Sequence
      key={`${startFrame}-${page.text}`}
      name={`Caption ${startFrame}`}
      from={startFrame}
      durationInFrames={endFrameExclusive - startFrame}
      layout="none"
    >
      <CaptionPage
        page={page}
        graph={{scenes, components}}
        pageStartFrame={startFrame}
      />
    </Sequence>
  ));
};
