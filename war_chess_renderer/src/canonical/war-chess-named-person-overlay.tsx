import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import type {WC12Props} from './production-contracts';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const enterEase = Easing.bezier(0.18, 0.84, 0.22, 1);
const exitEase = Easing.bezier(0.28, 0.72, 0.42, 1);

const mediaPath = (path: string): string => {
  const external = /^(?:data:|https?:|blob:)/i.test(path);
  return path.startsWith('/') || external ? path : staticFile(path);
};

/**
 * Owner-approved named-person overlay.
 *
 * The base media remains continuous. A single reviewed cutout rises from the
 * bottom, stays readable for roughly three to four seconds after duration
 * conforming, and leaves before the underlying shot ends. All motion is
 * derived from the Remotion frame; CSS transitions are deliberately absent.
 */
export const WarChessNamedPersonOverlay: React.FC<WC12Props> = (input) => {
  const frame = useCurrentFrame();
  const props = input;
  const entranceTop = interpolate(frame, [24, 48], [1160, 280], {
    ...clamp,
    easing: enterEase,
  });
  const exitTop = interpolate(frame, [132, 149], [280, 1160], {
    ...clamp,
    easing: exitEase,
  });
  const portraitTop = frame < 48 ? entranceTop : exitTop;
  const entranceOpacity = interpolate(frame, [24, 34], [0, 1], {
    ...clamp,
    easing: enterEase,
  });
  const exitOpacity = interpolate(frame, [132, 149], [1, 0], {
    ...clamp,
    easing: exitEase,
  });
  const portraitOpacity = Math.min(entranceOpacity, exitOpacity);
  const labelTop = portraitTop - 104;
  const underlying = mediaPath(props.underlyingMedia.path);

  return (
    <AbsoluteFill style={{backgroundColor: '#1b1c1b', overflow: 'hidden'}}>
      <style>{`
        @font-face {
          font-family: 'Literata WC12';
          src: url('${staticFile('fonts/Literata.ttf')}') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: block;
        }
      `}</style>

      {props.underlyingMediaKind === 'clip' ? (
        <OffthreadVideo
          src={underlying}
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Img
          src={underlying}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 1286,
          top: labelTop + 6,
          width: 4,
          height: 104,
          backgroundColor: '#c99b55',
          opacity: portraitOpacity,
          zIndex: 10,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 1304,
          top: labelTop,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '15px 21px 14px 20px',
          backgroundColor: 'rgba(29, 29, 27, 0.94)',
          border: '1px solid rgba(217, 184, 123, 0.68)',
          boxShadow: '0 10px 22px rgba(13, 14, 13, 0.28)',
          opacity: portraitOpacity,
          whiteSpace: 'nowrap',
          zIndex: 9,
          fontFamily: "'Literata WC12', Georgia, serif",
          color: '#f4ead8',
        }}
      >
        <div
          style={{
            fontSize: 33,
            fontWeight: 750,
            lineHeight: 1.05,
            letterSpacing: 2.15,
          }}
        >
          {props.displayName}
        </div>
        {props.displayRole ? (
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: 3.35,
              color: '#d4ad6e',
            }}
          >
            {props.displayRole}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1304,
          top: portraitTop,
          width: 560,
          opacity: portraitOpacity,
          filter:
            'drop-shadow(0 18px 16px rgba(15, 16, 15, 0.54)) drop-shadow(0 0 1px rgba(243, 220, 173, 0.48))',
          zIndex: 8,
          pointerEvents: 'none',
        }}
      >
        <Img
          src={mediaPath(props.subjectCutout.path)}
          alt={props.displayName}
          style={{width: '100%', height: 'auto', display: 'block'}}
        />
      </div>
    </AbsoluteFill>
  );
};
