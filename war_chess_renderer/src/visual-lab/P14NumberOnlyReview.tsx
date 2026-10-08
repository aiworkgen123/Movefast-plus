import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const quietEase = Easing.bezier(0.16, 1, 0.3, 1);
const digitHeight = 126;
const digitStrip = Array.from({length: 40}, (_, index) => index % 10);

const DigitColumn: React.FC<{
  digit: string;
  index: number;
  opacity: number;
}> = ({digit, index, opacity}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const target = Number(digit);
  const progress = interpolate(
    frame,
    [(0.12 + index * 0.09) * fps, (0.58 + index * 0.11) * fps],
    [0, 1],
    {...clamp, easing: Easing.out(Easing.cubic)},
  );
  const currentPosition = interpolate(
    progress,
    [0, 1],
    [target + 30, target + 10],
    clamp,
  );

  return (
    <div
      style={{
        position: 'relative',
        width: 104,
        height: digitHeight,
        overflow: 'hidden',
        opacity,
        maskImage:
          'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          translate: `0px ${-currentPosition * digitHeight}px`,
        }}
      >
        {digitStrip.map((value, stripIndex) => (
          <div
            key={`${index}-${stripIndex}`}
            style={{
              width: '100%',
              height: digitHeight,
              color: '#f0eadb',
              fontFamily: '"New York", Palatino, Georgia, "Times New Roman", serif',
              fontSize: 132,
              fontWeight: 700,
              lineHeight: `${digitHeight}px`,
              textAlign: 'center',
              textShadow: '0 3px 16px rgba(0, 0, 0, 0.56)',
            }}
          >
            {value}
          </div>
        ))}
      </div>
    </div>
  );
};

export const P14_NUMBER_ONLY_REVIEW_DURATION = 150;

/** P14 review variant: the rolling four-digit number is the only overlay. */
export const P14NumberOnlyReview: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const digits = '2019'.split('');
  const blockProgress = interpolate(frame, [0.06 * fps, 0.78 * fps], [0, 1], {
    ...clamp,
    easing: quietEase,
  });
  const exit = interpolate(
    frame,
    [P14_NUMBER_ONLY_REVIEW_DURATION - 0.35 * fps, P14_NUMBER_ONLY_REVIEW_DURATION],
    [1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#090807', overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: exit, overflow: 'hidden'}}>
        <Img
          src={staticFile('visual-lab/p14-number-only/fixture-still.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: interpolate(
              frame,
              [0, P14_NUMBER_ONLY_REVIEW_DURATION - 1],
              [1, 1.035],
              {...clamp, easing: Easing.linear},
            ),
            translate: `${interpolate(frame, [0, P14_NUMBER_ONLY_REVIEW_DURATION - 1], [0, -10], clamp)}px ${interpolate(frame, [0, P14_NUMBER_ONLY_REVIEW_DURATION - 1], [0, -4], clamp)}px`,
            filter: 'sepia(0.08) saturate(0.82) contrast(1.05) brightness(0.72)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(8, 7, 6, 0.12) 0%, rgba(8, 7, 6, 0.02) 45%, rgba(8, 7, 6, 0.64) 100%), linear-gradient(180deg, rgba(8, 7, 6, 0.36) 0%, rgba(8, 7, 6, 0.04) 44%, rgba(8, 7, 6, 0.72) 100%)',
          opacity: exit,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 112,
          right: 132,
          width: 600,
          opacity: blockProgress * exit,
          translate: `${interpolate(frame, [0.06 * fps, 0.78 * fps], [46, 0], clamp)}px 0px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 7,
            height: digitHeight,
            overflow: 'hidden',
          }}
        >
          {digits.map((digit, index) => (
            <DigitColumn
              key={`${digit}-${index}`}
              digit={digit}
              index={index}
              opacity={Math.min(1, blockProgress * 1.45)}
            />
          ))}
        </div>
      </div>
      <AbsoluteFill
        style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.42)', opacity: exit}}
      />
    </AbsoluteFill>
  );
};
