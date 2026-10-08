import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from './editorial-theme';
import {
  type AnchoredProgressionConfig,
  type AnchoredProgressionItem,
  validateAnchoredProgressionConfig,
} from './anchored-progression-config';

const C = {
  ink: '#090a08',
  paper: '#f1e9d9',
  muted: '#b7ad9b',
  quiet: '#7d7669',
  amber: '#c89a4a',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const smooth = {
  ...clamp,
  easing: Easing.bezier(0.45, 0, 0.55, 1),
};

const mediaSource = (staticFileKey?: string, source?: string): string => {
  if (source) return source;
  if (staticFileKey) return staticFile(staticFileKey);
  throw new Error('anchored progression media source is missing');
};


const titleSize = (title: string): number => {
  if (title.length > 28) return 70;
  if (title.length > 20) return 78;
  return 92;
};

const ProgressionItem: React.FC<{
  item: AnchoredProgressionItem;
  index: number;
  anchorSide: 'left' | 'right';
}> = ({item, index, anchorSide}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [item.startFrame, item.startFrame + 25], [0, 1], editorialEase);
  const leave = interpolate(frame, [item.endFrame - 26, item.endFrame], [1, 0], editorialEase);
  const opacity = enter * leave;
  const progress = interpolate(frame, [item.startFrame, item.endFrame], [0, 1], clamp);
  const copy = interpolate(frame, [item.startFrame + 11, item.startFrame + 36], [0, 1], editorialEase);
  const mediaLeft = anchorSide === 'left' ? 432 : 0;
  const copyLeft = anchorSide === 'left' ? 556 : 104;

  return (
    <AbsoluteFill style={{opacity}}>
      <div style={{position: 'absolute', left: mediaLeft, top: 0, width: 1488, height: 1080}}>
        <Img
          src={mediaSource(item.imageStaticFileKey, item.imageSource)}
          style={{
            position: 'absolute',
            inset: -30,
            width: 1548,
            height: 1140,
            objectFit: 'cover',
            objectPosition: item.imageObjectPosition ?? '50% 50%',
            scale: interpolate(progress, [0, 1], [1.025, 1.11]),
            translate:
              index % 2 === 0
                ? `0px ${interpolate(progress, [0, 1], [9, -12])}px`
                : `${interpolate(progress, [0, 1], [22, -18])}px 0px`,
            filter: 'saturate(.62) contrast(1.12) brightness(.74)',
          }}
        />
        <AbsoluteFill
          style={{
            background:
              anchorSide === 'left'
                ? 'linear-gradient(90deg, rgba(8,9,7,.91) 0%, rgba(8,9,7,.54) 17%, rgba(8,9,7,.08) 48%, rgba(8,9,7,.28) 100%)'
                : 'linear-gradient(270deg, rgba(8,9,7,.91) 0%, rgba(8,9,7,.54) 17%, rgba(8,9,7,.08) 48%, rgba(8,9,7,.28) 100%)',
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(5,5,4,.45) 0%, transparent 34%, transparent 69%, rgba(5,5,4,.74) 100%)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: copyLeft,
          top: 90,
          width: 760,
          opacity: copy,
          translate: `${interpolate(copy, [0, 1], [anchorSide === 'left' ? 34 : -34, 0])}px 0px`,
        }}
      >
        <div
          style={{
            color: item.accent,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: 5,
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            marginTop: 18,
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: titleSize(item.title),
            fontWeight: 700,
            letterSpacing: -2.1,
            lineHeight: 0.9,
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            marginTop: 26,
            color: C.muted,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 27,
            fontWeight: 500,
            letterSpacing: 0.45,
          }}
        >
          {item.detail}
        </div>
      </div>

      {item.sourceCredit ? (
        <div
          style={{
            position: 'absolute',
            [anchorSide === 'left' ? 'right' : 'left']: 62,
            bottom: 48,
            color: 'rgba(241,233,217,.57)',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 1.1,
          }}
        >
          {item.sourceCredit}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const ProgressionIndex: React.FC<{
  items: AnchoredProgressionItem[];
  anchorSide: 'left' | 'right';
  visibleStart: number;
  visibleEnd: number;
}> = ({items, anchorSide, visibleStart, visibleEnd}) => {
  const frame = useCurrentFrame();
  const visible = interpolate(frame, [visibleStart, visibleStart + 25, visibleEnd - 28, visibleEnd], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        [anchorSide === 'left' ? 'left' : 'right']: 558,
        bottom: 52,
        display: 'flex',
        gap: items.length > 4 ? 20 : 32,
        opacity: visible,
      }}
    >
      {items.map((item) => {
        const active = interpolate(
          frame,
          [item.startFrame, item.startFrame + 20, item.endFrame - 22, item.endFrame],
          [0.24, 1, 1, 0.24],
          clamp,
        );
        return (
          <div key={item.id} style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 9, height: 9, borderRadius: 99, backgroundColor: item.accent, opacity: active}} />
            <div
              style={{
                color: C.paper,
                fontFamily: WC_EDITORIAL_SANS,
                fontSize: items.length > 4 ? 13 : 16,
                fontWeight: 800,
                letterSpacing: items.length > 4 ? 1.5 : 2.1,
                opacity: active,
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AnchoredProgression: React.FC<AnchoredProgressionConfig> = (rawConfig) => {
  const config = validateAnchoredProgressionConfig(rawConfig);
  const frame = useCurrentFrame();
  const side = config.anchorSide ?? 'left';
  const opening = interpolate(frame, [0, 24], [0, 1], editorialEase);
  const dock = interpolate(frame, [config.dockStartFrame, config.dockEndFrame], [0, 1], smooth);
  const field = interpolate(frame, [config.dockStartFrame + 14, config.dockEndFrame], [0, 1], editorialEase);
  const close = interpolate(frame, [config.closeStartFrame, config.closeEndFrame], [0, 1], editorialEase);
  const fade = interpolate(
    frame,
    [0, 10, config.durationInFrames - 11, config.durationInFrames - 1],
    [0, 1, 1, 0],
    clamp,
  );
  const dockedLeft = side === 'left' ? 42 : 1458;
  const dockedCopyLeft = side === 'left' ? 54 : 1476;

  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity: fade, overflow: 'hidden'}}>
      {config.audioStaticFileKey ? <Audio src={staticFile(config.audioStaticFileKey)} /> : null}
      {config.anchorBackgroundStaticFileKey || config.anchorBackgroundSource ? (
        <Img
          src={mediaSource(config.anchorBackgroundStaticFileKey, config.anchorBackgroundSource)}
          style={{
            position: 'absolute',
            inset: -34,
            width: 1988,
            height: 1148,
            objectFit: 'cover',
            objectPosition: '50% 27%',
            opacity: opening * (1 - field),
            scale: interpolate(frame, [0, config.dockEndFrame + 6], [1.08, 1.01], clamp),
            filter: 'grayscale(.32) sepia(.28) contrast(.94) brightness(.48)',
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 52% 43%, rgba(186,145,75,.14), transparent 32%), linear-gradient(90deg, rgba(8,8,6,.72), rgba(8,8,6,.27) 50%, rgba(8,8,6,.72))',
          opacity: opening * (1 - field),
        }}
      />

      <div style={{opacity: field}}>
        {config.items.map((item, index) => (
          <ProgressionItem key={item.id} item={item} index={index} anchorSide={side} />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          [side]: 0,
          top: 0,
          width: interpolate(dock, [0, 1], [0, 492]),
          height: 1080,
          background:
            side === 'left'
              ? 'linear-gradient(90deg, rgba(7,8,6,.98) 0%, rgba(7,8,6,.94) 78%, rgba(7,8,6,0) 100%)'
              : 'linear-gradient(270deg, rgba(7,8,6,.98) 0%, rgba(7,8,6,.94) 78%, rgba(7,8,6,0) 100%)',
          opacity: field,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: interpolate(dock, [0, 1], [590, dockedLeft]),
          top: interpolate(dock, [0, 1], [38, 180]),
          width: interpolate(dock, [0, 1], [740, 420]),
          height: interpolate(dock, [0, 1], [1018, 770]),
          opacity: opening * (1 - close),
          filter:
            'drop-shadow(0 26px 22px rgba(0,0,0,.58)) drop-shadow(0 0 1px rgba(239,220,181,.42))',
        }}
      >
        <Img
          src={mediaSource(config.anchorCutoutStaticFileKey, config.anchorCutoutSource)}
          style={{width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: interpolate(dock, [0, 1], [112, dockedCopyLeft]),
          top: interpolate(dock, [0, 1], [286, 78]),
          width: interpolate(dock, [0, 1], [620, 390]),
          opacity: opening * (1 - close),
        }}
      >
        <div
          style={{
            color: C.amber,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: interpolate(dock, [0, 1], [21, 16]),
            fontWeight: 800,
            letterSpacing: interpolate(dock, [0, 1], [5, 3.7]),
          }}
        >
          {config.anchorLabel}
        </div>
        <div
          style={{
            marginTop: interpolate(dock, [0, 1], [22, 13]),
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: interpolate(dock, [0, 1], [104, config.anchorTitle.length > 28 ? 40 : 47]),
            fontWeight: 700,
            letterSpacing: interpolate(dock, [0, 1], [-2.3, -0.7]),
            lineHeight: 0.9,
            whiteSpace: 'pre-line',
          }}
        >
          {config.anchorTitle}
        </div>
        <div
          style={{
            marginTop: interpolate(dock, [0, 1], [26, 13]),
            color: dock > 0.75 ? C.quiet : C.muted,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: interpolate(dock, [0, 1], [25, 15]),
            fontWeight: 600,
            letterSpacing: 1.1,
          }}
        >
          {config.relationshipLabel}
        </div>
      </div>

      {config.showIndex !== false ? (
        <ProgressionIndex
          items={config.items}
          anchorSide={side}
          visibleStart={config.items[0].startFrame}
          visibleEnd={config.closeEndFrame}
        />
      ) : null}

      {config.finalMessage ? (
        <AbsoluteFill style={{backgroundColor: C.ink, opacity: close}}>
          <div
            style={{
              position: 'absolute',
              left: 220,
              right: 220,
              top: 347,
              color: C.paper,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: config.finalMessage.length > 42 ? 92 : 110,
              fontWeight: 700,
              letterSpacing: -2.7,
              lineHeight: 0.94,
              textAlign: 'center',
              translate: `0px ${interpolate(close, [0, 1], [28, 0])}px`,
            }}
          >
            {config.finalMessage}
          </div>
          {config.finalDetail ? (
            <div
              style={{
                position: 'absolute',
                left: 360,
                right: 360,
                top: 505,
                color: C.muted,
                fontFamily: WC_EDITORIAL_SANS,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 3,
                textAlign: 'center',
              }}
            >
              {config.finalDetail}
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
