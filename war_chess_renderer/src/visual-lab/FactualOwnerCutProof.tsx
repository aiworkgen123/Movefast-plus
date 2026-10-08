import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const FACTUAL_OWNER_CUT_DURATION = 1887;

const C = {
  ink: '#090907',
  paper: '#eee5d3',
  muted: '#aaa18f',
  amber: '#c49a51',
  red: '#a94d3f',
  blue: '#6f8f96',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const sceneOpacity = (frame: number, duration: number) =>
  interpolate(frame, [0, 12, Math.max(13, duration - 15), duration - 1], [0, 1, 1, 0], clamp);

const ContextLabel: React.FC<{children: React.ReactNode; align?: 'left' | 'right'}> = ({
  children,
  align = 'left',
}) => (
  <div
    style={{
      position: 'absolute',
      left: align === 'left' ? 64 : undefined,
      right: align === 'right' ? 64 : undefined,
      bottom: 42,
      color: 'rgba(238,229,211,.58)',
      fontFamily: WC_EDITORIAL_SANS,
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 3.1,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const OpeningBlunder: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 203);
  const enter = interpolate(frame, [10, 42], [0, 1], ease);
  const zoom = interpolate(frame, [0, 202], [1.02, 1.1], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity, overflow: 'hidden'}}>
      <Img
        src={staticFile('visual-lab/phase-progression-real/pexels-moises-caro-15379682.jpg')}
        style={{
          position: 'absolute',
          inset: -40,
          width: 2000,
          height: 1160,
          objectFit: 'cover',
          objectPosition: '58% 54%',
          scale: zoom,
          filter: 'grayscale(.12) sepia(.04) saturate(.94) contrast(1.05) brightness(.9)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(6,6,5,.55) 0%, rgba(6,6,5,.36) 36%, rgba(6,6,5,.06) 70%, rgba(6,6,5,.10) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 255,
          width: 950,
          opacity: enter,
          translate: `${interpolate(enter, [0, 1], [-34, 0])}px 0px`,
        }}
      >
        <div
          style={{
            color: C.amber,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: 5,
          }}
        >
          BEFORE THE POSITION IS VISIBLE
        </div>
        <div
          style={{
            marginTop: 24,
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 110,
            fontWeight: 700,
            lineHeight: 0.88,
            letterSpacing: -2.8,
          }}
        >
          The first move
          <br />
          is already the blunder.
        </div>
      </div>
      <ContextLabel align="right">Contemporary chess image · visual analogy</ContextLabel>
    </AbsoluteFill>
  );
};

const references = [
  {
    start: 0,
    end: 120,
    image: 'visual-lab/factual-owner-cut/rommel-1917.jpg',
    background: 'visual-lab/historical-documents/campaign-1812.jpg',
    name: 'Erwin Rommel',
    detail: 'Western Desert',
    credit: 'Unknown photographer · 1917 · Public domain',
  },
  {
    start: 120,
    end: 205,
    image: 'visual-lab/factual-owner-cut/patton-1943.jpg',
    background: 'visual-lab/factual-owner-cut/sicily-map-cc0.jpg',
    name: 'George S. Patton',
    detail: 'Sicily',
    credit: 'U.S. Army Signal Corps · 1943 · Public domain',
  },
  {
    start: 205,
    end: 300,
    image: 'visual-lab/factual-owner-cut/montgomery-1943.jpg',
    background: 'visual-lab/factual-owner-cut/sandhurst-1890s.jpg',
    name: 'Bernard Montgomery',
    detail: 'Sandhurst',
    credit: 'War Office · 1943 · Public domain',
  },
  {
    start: 300,
    end: 424,
    image: 'visual-lab/factual-owner-cut/hitler-mussolini-1934.jpg',
    background: 'visual-lab/factual-owner-cut/russian-campaign-1812-map.jpg',
    name: 'Adolf Hitler',
    detail: 'Russia',
    credit: 'Istituto Nazionale Luce · 1934 · Public domain',
  },
] as const;

const InfluenceMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 424);
  const napoleonEnter = interpolate(frame, [0, 24], [0, 1], ease);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity, overflow: 'hidden'}}>
      {references.map((item) => {
        const visible = interpolate(
          frame,
          [item.start, item.start + 12, item.end - 12, item.end],
          [0, 1, 1, 0],
          clamp,
        );
        const progress = interpolate(frame, [item.start, item.end], [0, 1], clamp);
        return (
          <React.Fragment key={item.name}>
            <Img
              src={staticFile(item.background)}
              style={{
                position: 'absolute',
                inset: -24,
                width: 1968,
                height: 1128,
                objectFit: 'cover',
                objectPosition: '64% 50%',
                opacity: visible * 0.72,
                scale: interpolate(progress, [0, 1], [1.04, 1.1]),
                filter: 'grayscale(.12) sepia(.05) saturate(.94) contrast(1.02) brightness(.92) blur(.4px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 110,
                top: 108,
                width: 650,
                height: 858,
                opacity: visible,
                overflow: 'hidden',
                boxShadow: '0 28px 70px rgba(0,0,0,.58)',
                backgroundColor: '#171510',
              }}
            >
              <Img
                src={staticFile(item.image)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: item.name === 'Adolf Hitler' ? '35% 50%' : '50% 38%',
                  scale: interpolate(progress, [0, 1], [1.03, 1.09]),
                  filter: 'grayscale(.12) sepia(.04) saturate(.95) contrast(1.04) brightness(.95)',
                }}
              />
              <AbsoluteFill
                style={{
                  background: 'linear-gradient(180deg, transparent 60%, rgba(5,5,4,.66) 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 42,
                  right: 36,
                  bottom: 38,
                }}
              >
                <div
                  style={{
                    color: C.paper,
                    fontFamily: WC_EDITORIAL_SERIF,
                    fontSize: 62,
                    fontWeight: 700,
                    letterSpacing: -1.3,
                    lineHeight: 0.95,
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    color: C.amber,
                    fontFamily: WC_EDITORIAL_SANS,
                    fontSize: 19,
                    fontWeight: 800,
                    letterSpacing: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {item.detail}
                </div>
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 110,
                bottom: 36,
                color: 'rgba(238,229,211,.54)',
                fontFamily: WC_EDITORIAL_SANS,
                fontSize: 13,
                letterSpacing: 1.1,
                opacity: visible,
              }}
            >
              {item.credit}
            </div>
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: 68,
          bottom: 0,
          width: 560,
          height: 990,
          opacity: napoleonEnter,
          translate: `${interpolate(napoleonEnter, [0, 1], [-120, 0])}px 0px`,
        }}
      >
        <Img
          src={staticFile('visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center bottom',
            filter: 'drop-shadow(0 28px 26px rgba(0,0,0,.62))',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 422,
          width: 500,
          height: 2,
          background: 'linear-gradient(90deg, rgba(196,154,81,.8), rgba(196,154,81,.12))',
          opacity: napoleonEnter,
          transform: 'rotate(-6deg)',
          transformOrigin: 'left center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 115,
          top: 105,
          color: C.paper,
          opacity: napoleonEnter,
        }}
      >
        <div
          style={{
            color: C.amber,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 4.4,
          }}
        >
          THE REFERENCE POINT
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: -2,
          }}
        >
          Napoleon
        </div>
      </div>
      <ContextLabel>Portraits establish identity context · narration claims remain separately sourced</ContextLabel>
    </AbsoluteFill>
  );
};

const ColdLogic: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 336);
  const progress = interpolate(frame, [0, 335], [0, 1], clamp);
  const copy = interpolate(frame, [34, 74], [0, 1], ease);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity, overflow: 'hidden'}}>
      <Img
        src={staticFile('visual-lab/factual-owner-cut/russian-campaign-1812-map.jpg')}
        style={{
          position: 'absolute',
          left: -50,
          top: -20,
          width: 1250,
          height: 1140,
          objectFit: 'cover',
          objectPosition: '53% 50%',
          scale: interpolate(progress, [0, 1], [1.02, 1.09]),
          filter: 'grayscale(.12) sepia(.05) saturate(.94) contrast(1.03) brightness(.92)',
        }}
      />
      <Img
        src={staticFile('visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg')}
        style={{
          position: 'absolute',
          right: -50,
          top: -20,
          width: 1040,
          height: 1140,
          objectFit: 'cover',
          scale: interpolate(progress, [0, 1], [1.08, 1.02]),
          filter: 'grayscale(.12) sepia(.04) saturate(.94) contrast(1.05) brightness(.9)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 62% 52%, rgba(7,7,6,.46) 0%, rgba(7,7,6,.24) 32%, rgba(7,7,6,.04) 62%), linear-gradient(180deg, rgba(6,6,5,.12), transparent 28%, rgba(6,6,5,.16))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 315,
          width: 1050,
          opacity: copy,
          textAlign: 'center',
          translate: `0px ${interpolate(copy, [0, 1], [28, 0])}px`,
        }}
      >
        <div
          style={{
            color: C.amber,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 5.2,
          }}
        >
          NOT MORE FORCE. EARLIER CALCULATION.
        </div>
        <div
          style={{
            marginTop: 28,
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 104,
            fontWeight: 700,
            lineHeight: 0.88,
            letterSpacing: -2.5,
          }}
        >
          The reply is
          <br />
          already queued.
        </div>
      </div>
      <ContextLabel>1812 campaign map · chess image used as analogy</ContextLabel>
    </AbsoluteFill>
  );
};

const phases = [
  {
    start: 0,
    end: 257,
    label: 'OPENING',
    title: 'First command',
    detail: 'The position is established.',
    image: 'visual-lab/phase-progression-real/pexels-tima-6598739.jpg',
    accent: C.amber,
    credit: 'Tima Miroshnichenko · Pexels',
  },
  {
    start: 257,
    end: 553,
    label: 'MIDDLEGAME',
    title: 'Pure calculation',
    detail: 'The prepared book runs out.',
    image: 'visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg',
    accent: C.red,
    credit: 'Sudarson Alwin · Pexels',
  },
  {
    start: 553,
    end: 707,
    label: 'ENDGAME',
    title: 'Better technique',
    detail: 'Less room for error.',
    image: 'visual-lab/phase-progression-real/pexels-cottonbro-8656670.jpg',
    accent: C.blue,
    credit: 'cottonbro studio · Pexels',
  },
] as const;

const ThreeBoards: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
      {phases.map((phase) => {
        const opacity = interpolate(
          frame,
          [phase.start, phase.start + 14, phase.end - 14, phase.end],
          [0, 1, 1, 0],
          clamp,
        );
        const progress = interpolate(frame, [phase.start, phase.end], [0, 1], clamp);
        const copy = interpolate(frame, [phase.start + 12, phase.start + 42], [0, 1], ease);
        return (
          <AbsoluteFill key={phase.label} style={{opacity}}>
            <Img
              src={staticFile(phase.image)}
              style={{
                position: 'absolute',
                inset: -36,
                width: 1992,
                height: 1152,
                objectFit: 'cover',
                objectPosition: '55% 55%',
                scale: interpolate(progress, [0, 1], [1.02, 1.12]),
                filter: 'grayscale(.08) sepia(.03) saturate(.96) contrast(1.03) brightness(.94)',
              }}
            />
            <AbsoluteFill
              style={{
                background:
                  'linear-gradient(90deg, rgba(6,6,5,.54) 0%, rgba(6,6,5,.36) 34%, rgba(6,6,5,.07) 58%, rgba(6,6,5,.02) 78%, rgba(6,6,5,.10) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 105,
                top: 250,
                width: 850,
                opacity: copy,
                translate: `${interpolate(copy, [0, 1], [-34, 0])}px 0px`,
              }}
            >
              <div
                style={{
                  color: phase.accent,
                  fontFamily: WC_EDITORIAL_SANS,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 5.2,
                }}
              >
                {phase.label}
              </div>
              <div
                style={{
                  marginTop: 22,
                  color: C.paper,
                  fontFamily: WC_EDITORIAL_SERIF,
                  fontSize: 112,
                  fontWeight: 700,
                  lineHeight: 0.88,
                  letterSpacing: -2.8,
                }}
              >
                {phase.title}
              </div>
              <div
                style={{
                  marginTop: 32,
                  color: C.muted,
                  fontFamily: WC_EDITORIAL_SANS,
                  fontSize: 29,
                  fontWeight: 500,
                  letterSpacing: 0.5,
                }}
              >
                {phase.detail}
              </div>
            </div>
            <ContextLabel align="right">{phase.credit}</ContextLabel>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

const BoardOne: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 217);
  const enter = interpolate(frame, [18, 60], [0, 1], ease);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity, overflow: 'hidden'}}>
      <Img
        src={staticFile('visual-lab/factual-owner-cut/russian-campaign-1812-map.jpg')}
        style={{
          position: 'absolute',
          inset: -36,
          width: 1992,
          height: 1152,
          objectFit: 'cover',
          objectPosition: '52% 48%',
          scale: interpolate(frame, [0, 216], [1.08, 1.02], clamp),
          opacity: 0.82,
          filter: 'grayscale(.12) sepia(.05) saturate(.94) contrast(1.02) brightness(.92)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(7,7,5,.55) 0%, rgba(7,7,5,.36) 40%, rgba(7,7,5,.07) 72%, rgba(7,7,5,.12) 100%)',
        }}
      />
      <Img
        src={staticFile('visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')}
        style={{
          position: 'absolute',
          right: 90,
          bottom: -90,
          width: 700,
          height: 1130,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          opacity: enter,
          translate: `${interpolate(enter, [0, 1], [110, 0])}px 0px`,
          filter: 'drop-shadow(0 28px 24px rgba(0,0,0,.6))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 115,
          top: 325,
          opacity: enter,
          translate: `${interpolate(enter, [0, 1], [-40, 0])}px 0px`,
        }}
      >
        <div
          style={{
            color: C.amber,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 5.2,
          }}
        >
          THE POSITION IS SET
        </div>
        <div
          style={{
            marginTop: 24,
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 128,
            fontWeight: 700,
            letterSpacing: -3.1,
            lineHeight: 0.86,
          }}
        >
          Now,
          <br />
          board one.
        </div>
      </div>
      <ContextLabel>1812 campaign map · identified Napoleon cutout</ContextLabel>
    </AbsoluteFill>
  );
};

/**
 * Full-length owner-input edit proof using the locked War Chess visual system.
 * Factual assets remain identity/geographic context only; this composition does
 * not certify the narration's historical claims or production delivery rights.
 */
export const FactualOwnerCutProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: C.ink}}>
    <Audio src={staticFile('visual-lab/factual-owner-cut/voiceover-62.9s.wav')} />
    <Sequence from={0} durationInFrames={203} premountFor={30}>
      <OpeningBlunder />
    </Sequence>
    <Sequence from={203} durationInFrames={424} premountFor={30}>
      <InfluenceMontage />
    </Sequence>
    <Sequence from={627} durationInFrames={336} premountFor={30}>
      <ColdLogic />
    </Sequence>
    <Sequence from={963} durationInFrames={707} premountFor={30}>
      <ThreeBoards />
    </Sequence>
    <Sequence from={1670} durationInFrames={217} premountFor={30}>
      <BoardOne />
    </Sequence>
  </AbsoluteFill>
);
