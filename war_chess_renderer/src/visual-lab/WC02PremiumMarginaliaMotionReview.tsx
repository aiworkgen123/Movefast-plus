import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {ComponentLayer} from '../components';
import {RenderComponentSchema} from '../schema';

export const WC02_PREMIUM_MARGINALIA_MOTION_REVIEW_DURATION = 255;

const reviewHash = '0000000000000000000000000000000000000000000000000000000000000000';

const reviewAsset = (artifactId: string, staticFileKey: string) => ({
  artifactId,
  sha256: reviewHash,
  mediaType: 'image/png',
  staticFileKey,
});

const WC02_PERSON_MARGINALIA_REVIEW_COMPONENT = RenderComponentSchema.parse({
  componentId: 'component.owner-approved-person-marginalia-v3',
  componentType: 'WC02',
  presentationVariant: 'person_marginalia_v3',
  parentUnitIds: ['unit-opening', 'unit-middlegame', 'unit-endgame'],
  layer: 'full_screen',
  baseSceneIds: ['scene-opening', 'scene-middlegame', 'scene-endgame'],
  startFrame: 0,
  endFrameExclusive: WC02_PREMIUM_MARGINALIA_MOTION_REVIEW_DURATION,
  evidenceIds: ['evidence-person', 'evidence-step-1', 'evidence-step-2', 'evidence-step-3'],
  acceptedScopeHash: reviewHash,
  subject: 'Napoleon Bonaparte',
  title: 'Napoleon Bonaparte',
  subjectRole: 'Commander',
  anchorKind: 'person',
  relationship: 'progression',
  relationshipLabel: 'WAR → CHESS',
  subjectImage: reviewAsset(
    'asset-napoleon-subject',
    'visual-lab/historical-documents/napoleon-study-cutout-clean-v3.png',
  ),
  subjectCutout: reviewAsset(
    'asset-napoleon-cutout',
    'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
  ),
  steps: [
    {
      stepId: 'point-1',
      label: 'Establish the subject',
      title: 'Establish the subject',
      evidenceIds: ['evidence-step-1'],
    },
    {
      stepId: 'point-2',
      label: 'Name the position',
      title: 'Name the position',
      evidenceIds: ['evidence-step-2'],
    },
    {
      stepId: 'point-3',
      label: 'Read the consequence',
      title: 'Read the consequence',
      evidenceIds: ['evidence-step-3'],
    },
  ],
});

const CUTOUT_PATH = 'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png';
const museumSans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const marginaliaSerif = "Baskerville, 'Iowan Old Style', Georgia, 'Times New Roman', serif";
const ideas = ['Establish the subject', 'Name the position', 'Read the consequence'] as const;
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

type BackgroundVariant = 'plain' | 'ash' | 'grid' | 'ash-grid';

type AshParticle = {
  x: number;
  y: number;
  size: number;
  driftX: number;
  driftY: number;
  phase: number;
  opacity: number;
  depth: number;
  ember?: boolean;
};

const ASH_PARTICLES: readonly AshParticle[] = [
  {x: 74, y: 922, size: 1.4, driftX: 0.26, driftY: 0.18, phase: 0.2, opacity: 0.24, depth: 0},
  {x: 148, y: 236, size: 2.1, driftX: 0.42, driftY: 0.28, phase: 1.4, opacity: 0.2, depth: 1},
  {x: 226, y: 706, size: 1.2, driftX: 0.18, driftY: 0.12, phase: 2.8, opacity: 0.18, depth: 0},
  {x: 314, y: 148, size: 2.8, driftX: 0.56, driftY: 0.2, phase: 3.6, opacity: 0.24, depth: 2, ember: true},
  {x: 392, y: 1002, size: 1.8, driftX: 0.3, driftY: 0.34, phase: 4.4, opacity: 0.2, depth: 1},
  {x: 474, y: 566, size: 1.3, driftX: 0.22, driftY: 0.16, phase: 5.2, opacity: 0.16, depth: 0},
  {x: 558, y: 854, size: 2.4, driftX: 0.4, driftY: 0.24, phase: 0.8, opacity: 0.22, depth: 2},
  {x: 646, y: 192, size: 1.5, driftX: 0.24, driftY: 0.3, phase: 1.9, opacity: 0.18, depth: 1},
  {x: 728, y: 694, size: 2.2, driftX: 0.48, driftY: 0.16, phase: 2.6, opacity: 0.2, depth: 1},
  {x: 812, y: 100, size: 1.3, driftX: 0.18, driftY: 0.22, phase: 3.8, opacity: 0.17, depth: 0},
  {x: 896, y: 940, size: 2.7, driftX: 0.52, driftY: 0.28, phase: 4.9, opacity: 0.25, depth: 2, ember: true},
  {x: 986, y: 318, size: 1.6, driftX: 0.28, driftY: 0.18, phase: 5.6, opacity: 0.15, depth: 0},
  {x: 1070, y: 816, size: 2.1, driftX: 0.36, driftY: 0.2, phase: 0.4, opacity: 0.19, depth: 1},
  {x: 1152, y: 154, size: 1.4, driftX: 0.2, driftY: 0.32, phase: 1.1, opacity: 0.2, depth: 0},
  {x: 1238, y: 612, size: 2.5, driftX: 0.44, driftY: 0.22, phase: 2.2, opacity: 0.22, depth: 2},
  {x: 1316, y: 976, size: 1.5, driftX: 0.24, driftY: 0.17, phase: 3.1, opacity: 0.17, depth: 0},
  {x: 1406, y: 266, size: 2.8, driftX: 0.58, driftY: 0.26, phase: 4.1, opacity: 0.23, depth: 2, ember: true},
  {x: 1494, y: 740, size: 1.9, driftX: 0.32, driftY: 0.13, phase: 5.1, opacity: 0.18, depth: 1},
  {x: 1582, y: 92, size: 1.3, driftX: 0.2, driftY: 0.2, phase: 5.8, opacity: 0.17, depth: 0},
  {x: 1676, y: 892, size: 2.4, driftX: 0.46, driftY: 0.3, phase: 0.9, opacity: 0.22, depth: 2},
  {x: 1764, y: 462, size: 1.5, driftX: 0.26, driftY: 0.18, phase: 2.1, opacity: 0.19, depth: 0},
  {x: 1848, y: 1004, size: 2.1, driftX: 0.38, driftY: 0.24, phase: 3.4, opacity: 0.2, depth: 1},
  {x: 44, y: 488, size: 2.2, driftX: 0.34, driftY: 0.2, phase: 4.6, opacity: 0.18, depth: 1},
  {x: 274, y: 388, size: 1.4, driftX: 0.22, driftY: 0.15, phase: 5.4, opacity: 0.16, depth: 0},
  {x: 520, y: 384, size: 2.7, driftX: 0.5, driftY: 0.26, phase: 1.6, opacity: 0.21, depth: 2},
  {x: 758, y: 1000, size: 1.6, driftX: 0.26, driftY: 0.2, phase: 2.9, opacity: 0.18, depth: 0},
  {x: 1184, y: 372, size: 2.2, driftX: 0.42, driftY: 0.16, phase: 3.8, opacity: 0.19, depth: 1},
  {x: 1540, y: 564, size: 1.4, driftX: 0.18, driftY: 0.22, phase: 4.8, opacity: 0.17, depth: 0},
  {x: 1728, y: 208, size: 2.6, driftX: 0.54, driftY: 0.28, phase: 5.7, opacity: 0.23, depth: 2},
];

const ASH_GRID_EXTRA_PARTICLES: readonly AshParticle[] = [
  {x: 108, y: 74, size: 1.6, driftX: 0.24, driftY: 0.2, phase: 0.7, opacity: 0.16, depth: 0},
  {x: 196, y: 548, size: 2.2, driftX: 0.38, driftY: 0.25, phase: 1.8, opacity: 0.17, depth: 1},
  {x: 352, y: 760, size: 1.3, driftX: 0.2, driftY: 0.15, phase: 2.5, opacity: 0.14, depth: 0},
  {x: 438, y: 284, size: 2.4, driftX: 0.46, driftY: 0.2, phase: 3.3, opacity: 0.18, depth: 2},
  {x: 604, y: 488, size: 1.5, driftX: 0.26, driftY: 0.17, phase: 4.2, opacity: 0.15, depth: 0},
  {x: 686, y: 970, size: 2.0, driftX: 0.34, driftY: 0.28, phase: 5.0, opacity: 0.16, depth: 1},
  {x: 846, y: 468, size: 2.6, driftX: 0.52, driftY: 0.22, phase: 5.8, opacity: 0.19, depth: 2, ember: true},
  {x: 948, y: 170, size: 1.4, driftX: 0.22, driftY: 0.3, phase: 0.5, opacity: 0.14, depth: 0},
  {x: 1038, y: 724, size: 2.1, driftX: 0.4, driftY: 0.18, phase: 1.7, opacity: 0.17, depth: 1},
  {x: 1124, y: 1006, size: 1.7, driftX: 0.28, driftY: 0.24, phase: 2.8, opacity: 0.15, depth: 0},
  {x: 1272, y: 82, size: 2.3, driftX: 0.48, driftY: 0.26, phase: 3.7, opacity: 0.18, depth: 2},
  {x: 1368, y: 430, size: 1.5, driftX: 0.24, driftY: 0.16, phase: 4.5, opacity: 0.14, depth: 0},
  {x: 1462, y: 846, size: 2.5, driftX: 0.5, driftY: 0.27, phase: 5.3, opacity: 0.19, depth: 2, ember: true},
  {x: 1636, y: 352, size: 1.8, driftX: 0.32, driftY: 0.2, phase: 1.2, opacity: 0.16, depth: 1},
  {x: 1826, y: 678, size: 1.4, driftX: 0.2, driftY: 0.14, phase: 2.4, opacity: 0.14, depth: 0},
];

const ASH_GRID_PARTICLES: readonly AshParticle[] = [
  ...ASH_PARTICLES,
  ...ASH_GRID_EXTRA_PARTICLES,
];

const AshBackground: React.FC<{particles?: readonly AshParticle[]}> = ({particles = ASH_PARTICLES}) => {
  const frame = useCurrentFrame();

  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none'}}
      aria-hidden="true"
    >
      <g>
        {particles.map((particle, index) => {
          const x = particle.x + frame * particle.driftX + Math.sin(frame * 0.028 + particle.phase) * (4 + particle.depth * 2);
          const y = particle.y - frame * particle.driftY + Math.cos(frame * 0.022 + particle.phase) * (3 + particle.depth * 1.5);
          const shimmer = 0.78 + Math.sin(frame * 0.045 + particle.phase) * 0.22;
          const radius = particle.size * (1.02 + Math.sin(frame * 0.018 + particle.phase) * 0.08);
          const fill = particle.ember ? '#bd8563' : '#b8aa99';
          const visibleOpacity = Math.min(0.42, particle.opacity * 1.45 * shimmer);

          return particle.ember ? (
            <g key={`ash-${index}`} opacity={visibleOpacity}>
              <circle cx={x} cy={y} r={radius * 1.35} fill={fill} opacity={0.26} />
              <circle cx={x} cy={y} r={radius} fill={fill} />
            </g>
          ) : (
            <ellipse
              key={`ash-${index}`}
              cx={x}
              cy={y}
              rx={radius * (1.32 + particle.depth * 0.26)}
              ry={radius * (0.82 + particle.depth * 0.12)}
              fill={fill}
              opacity={visibleOpacity}
              transform={`rotate(${(frame * 0.4 + particle.phase * 38) % 180} ${x} ${y})`}
            />
          );
        })}
      </g>
      <defs>
        <radialGradient id="wc02-marginalia-ash-vignette" cx="50%" cy="47%" r="73%">
          <stop offset="0%" stopColor="#0b0a09" stopOpacity="0" />
          <stop offset="68%" stopColor="#0b0a09" stopOpacity="0.015" />
          <stop offset="100%" stopColor="#050403" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-ash-vignette)" />
    </svg>
  );
};

const GridBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const driftX = frame * 0.055;
  const driftY = -frame * 0.032;

  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none'}}
      aria-hidden="true"
    >
      <defs>
        <pattern id="wc02-marginalia-grid-minor" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform={`translate(${driftX} ${driftY})`}>
          <path d="M 64 0 L 64 64 M 0 64 L 64 64" fill="none" stroke="#a79887" strokeWidth="0.8" opacity="0.14" />
        </pattern>
        <pattern id="wc02-marginalia-grid-major" width="256" height="256" patternUnits="userSpaceOnUse" patternTransform={`translate(${driftX} ${driftY})`}>
          <path d="M 256 0 L 256 256 M 0 256 L 256 256" fill="none" stroke="#b9a98f" strokeWidth="1.2" opacity="0.2" />
        </pattern>
        <radialGradient id="wc02-marginalia-grid-vignette" cx="50%" cy="47%" r="75%">
          <stop offset="0%" stopColor="#0b0a09" stopOpacity="0" />
          <stop offset="70%" stopColor="#0b0a09" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#050403" stopOpacity="0.24" />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-grid-minor)" opacity="0.82" />
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-grid-major)" opacity="0.9" />
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-grid-vignette)" />
    </svg>
  );
};

const CoarseGridBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const driftX = frame * 0.055;
  const driftY = -frame * 0.032;

  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none'}}
      aria-hidden="true"
    >
      <defs>
        <pattern id="wc02-marginalia-ash-grid-minor" width="128" height="128" patternUnits="userSpaceOnUse" patternTransform={`translate(${driftX} ${driftY})`}>
          <path d="M 128 0 L 128 128 M 0 128 L 128 128" fill="none" stroke="#a79887" strokeWidth="0.8" opacity="0.14" />
        </pattern>
        <pattern id="wc02-marginalia-ash-grid-major" width="512" height="512" patternUnits="userSpaceOnUse" patternTransform={`translate(${driftX} ${driftY})`}>
          <path d="M 512 0 L 512 512 M 0 512 L 512 512" fill="none" stroke="#b9a98f" strokeWidth="1.2" opacity="0.2" />
        </pattern>
        <radialGradient id="wc02-marginalia-ash-grid-vignette" cx="50%" cy="47%" r="75%">
          <stop offset="0%" stopColor="#0b0a09" stopOpacity="0" />
          <stop offset="70%" stopColor="#0b0a09" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#050403" stopOpacity="0.24" />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-ash-grid-minor)" opacity="0.82" />
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-ash-grid-major)" opacity="0.9" />
      <rect width="1920" height="1080" fill="url(#wc02-marginalia-ash-grid-vignette)" />
    </svg>
  );
};

const ReviewBackground: React.FC<{variant: BackgroundVariant}> = ({variant}) => {
  if (variant === 'ash-grid') {
    return (
      <>
        <CoarseGridBackground />
        <AshBackground particles={ASH_GRID_PARTICLES} />
      </>
    );
  }
  if (variant === 'ash') {
    return <AshBackground />;
  }
  if (variant === 'grid') {
    return <GridBackground />;
  }
  return null;
};

const AnimatedMarginNote: React.FC<{
  number: number;
  copy: string;
  label: string;
  left: number;
  top: number;
  width: number;
  revealStart: number;
  labelColor: string;
  showMetadata: boolean;
}> = ({number, copy, label, left, top, width, revealStart, labelColor, showMetadata}) => {
  const frame = useCurrentFrame();
  const amount = interpolate(frame, [revealStart, revealStart + 24], [0, 1], editorialEase);
  const lift = interpolate(amount, [0, 1], [12, 0], clamp);
  const numberStyle: React.CSSProperties = {
    flexShrink: 0,
    color: '#b36858',
    fontFamily: museumSans,
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: 2.8,
    fontStyle: 'normal',
  };

  return (
    <>
      {showMetadata && (
        <div
          style={{
            position: 'absolute',
            left,
            top,
            zIndex: 6,
            color: labelColor,
            fontFamily: museumSans,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 3.4,
            opacity: amount,
            translate: `0px ${lift}px`,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left,
          top: top + 28,
          width,
          zIndex: 6,
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          color: '#f0e6d4',
          fontFamily: marginaliaSerif,
          fontSize: 52,
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: -0.45,
          fontStyle: 'italic',
          textShadow: '0 2px 14px rgba(0,0,0,.4)',
          opacity: amount,
          translate: `0px ${lift}px`,
        }}
      >
        <span aria-hidden={!showMetadata} style={showMetadata ? numberStyle : {...numberStyle, visibility: 'hidden'}}>
          {String(number).padStart(2, '0')}
        </span>
        <span>{copy}</span>
      </div>
    </>
  );
};

const Connector: React.FC<{
  path: string;
  startFrame: number;
  color: string;
}> = ({path, startFrame, color}) => {
  const frame = useCurrentFrame();
  const amount = interpolate(frame, [startFrame, startFrame + 30], [0, 1], editorialEase);
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeDasharray="900"
      strokeDashoffset={interpolate(amount, [0, 1], [900, 0], clamp)}
      opacity={amount}
    />
  );
};

export type WC02PremiumMarginaliaMotionReviewProps = {
  backgroundVariant?: BackgroundVariant;
};

export const WC02PremiumMarginaliaMotionReview: React.FC<WC02PremiumMarginaliaMotionReviewProps> = ({
  backgroundVariant = 'plain',
}) => {
  const frame = useCurrentFrame();
  const recede = interpolate(frame, [18, 116], [0, 1], editorialEase);
  const cutoutLeft = interpolate(recede, [0, 1], [560, 715], clamp);
  const cutoutTop = interpolate(recede, [0, 1], [32, 267], clamp);
  const cutoutWidth = interpolate(recede, [0, 1], [800, 466], clamp);
  const cutoutHeight = interpolate(recede, [0, 1], [1020, 706], clamp);
  const cutoutBlur = interpolate(recede, [0, 1], [0, 1.7], clamp);
  const cutoutOpacity = interpolate(recede, [0, 1], [1, 0.91], clamp);
  const leftAnchor = interpolate(recede, [0, 1], [788, 828], clamp);
  const rightAnchor = interpolate(recede, [0, 1], [1132, 1067], clamp);
  const topLeftPath = `M ${leftAnchor} 400 C 780 390, 735 365, 690 354`;
  const rightPath = `M ${rightAnchor} 489 C 1178 468, 1227 468, 1282 468`;
  const bottomLeftPath = `M ${leftAnchor - 4} 780 C 780 784, 766 800, 750 805`;
  const showMetadata = backgroundVariant !== 'ash-grid';

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 49% 46%, rgba(185,148,93,.05), transparent 42%), #0b0a09',
        color: '#f0e6d4',
        overflow: 'hidden',
      }}
    >
      <ReviewBackground variant={backgroundVariant} />
      <div style={{position: 'absolute', left: 112, top: 76, width: 920, zIndex: 5}}>
        <div style={{marginTop: 0, fontFamily: marginaliaSerif, fontSize: 80, fontWeight: 600, lineHeight: 0.94, letterSpacing: -0.7, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,.42)'}}>
          Napoleon Bonaparte
        </div>
      </div>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, zIndex: 2, overflow: 'visible', pointerEvents: 'none'}}
        aria-hidden="true"
      >
        <Connector path={topLeftPath} startFrame={76} color="#a79887" />
        <Connector path={rightPath} startFrame={112} color="#b36858" />
        <Connector path={bottomLeftPath} startFrame={148} color="#a79887" />
        <circle cx={leftAnchor} cy="400" r="3.5" fill="#a79887" opacity={interpolate(frame, [76, 106], [0, 1], editorialEase)} />
        <circle cx={rightAnchor} cy="489" r="3.5" fill="#b36858" opacity={interpolate(frame, [112, 142], [0, 1], editorialEase)} />
        <circle cx={leftAnchor - 4} cy="780" r="3.5" fill="#a79887" opacity={interpolate(frame, [148, 178], [0, 1], editorialEase)} />
        <circle cx="690" cy="354" r="3.5" fill="#a79887" opacity={interpolate(frame, [76, 106], [0, 1], editorialEase)} />
        <circle cx="1282" cy="468" r="3.5" fill="#b36858" opacity={interpolate(frame, [112, 142], [0, 1], editorialEase)} />
        <circle cx="750" cy="805" r="3.5" fill="#a79887" opacity={interpolate(frame, [148, 178], [0, 1], editorialEase)} />
      </svg>
      <Img
        src={staticFile(CUTOUT_PATH)}
        style={{
          position: 'absolute',
          left: cutoutLeft,
          top: cutoutTop,
          width: cutoutWidth,
          height: cutoutHeight,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          opacity: cutoutOpacity,
          filter: `drop-shadow(0 18px 16px rgba(0,0,0,.56)) sepia(.08) saturate(.9) blur(${cutoutBlur}px)`,
          zIndex: 3,
        }}
      />
      <AnimatedMarginNote number={1} copy={ideas[0]} label="IDENTITY" left={110} top={318} width={560} revealStart={88} labelColor="#a79887" showMetadata={showMetadata} />
      <AnimatedMarginNote number={2} copy={ideas[1]} label="POSITION" left={1282} top={430} width={560} revealStart={124} labelColor="#b36858" showMetadata={showMetadata} />
      <AnimatedMarginNote number={3} copy={ideas[2]} label="CONSEQUENCE" left={110} top={744} width={620} revealStart={160} labelColor="#a79887" showMetadata={showMetadata} />
    </AbsoluteFill>
  );
};

export const WC02PremiumMarginaliaAshReview: React.FC = () => (
  <WC02PremiumMarginaliaMotionReview backgroundVariant="ash" />
);

export const WC02PremiumMarginaliaGridReview: React.FC = () => (
  <WC02PremiumMarginaliaMotionReview backgroundVariant="grid" />
);

export const WC02PremiumMarginaliaAshGridReview: React.FC = () => (
  <ComponentLayer component={WC02_PERSON_MARGINALIA_REVIEW_COMPONENT} />
);
