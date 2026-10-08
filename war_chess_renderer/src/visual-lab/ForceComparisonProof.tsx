import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const FORCE_COMPARISON_PROOF_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const palette = {
  table: '#17120d',
  tableWarm: '#2a1d13',
  paper: '#e8dcc3',
  ink: '#201a14',
  mutedInk: '#6f6252',
  paleInk: '#b9ab92',
  red: '#a53a30',
  brass: '#a78755',
  cord: '#c5b28e',
};

type AllianceMember = {
  commander: string;
  force: string;
  strength?: string;
  relativeWeight: number;
  color: string;
  darkText: string;
};

export type AllianceFractureProps = {
  eyebrow: string;
  title: string;
  connectedLabel: string;
  fracturedLabel: string;
  members: [AllianceMember, AllianceMember];
  interveningForce: {
    label: string;
    strength?: string;
    strengthNote?: string;
    color: string;
  };
  takeaway: string;
  audioSrc: string;
};

const PaperNoise: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity: 0.2,
      backgroundImage:
        'repeating-linear-gradient(7deg, transparent 0px, transparent 7px, rgba(80,58,36,.1) 8px), repeating-linear-gradient(91deg, transparent 0px, transparent 18px, rgba(255,255,255,.12) 19px)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }}
  />
);

const Pin: React.FC<{x: number; y: number}> = ({x, y}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 22,
      height: 22,
      borderRadius: '50%',
      background:
        'radial-gradient(circle at 36% 30%, #e4c785 0 10%, #a98043 34%, #49331e 72%, #1b130c 100%)',
      boxShadow: '0 7px 8px rgba(0,0,0,.45)',
      zIndex: 5,
    }}
  />
);

const Dossier: React.FC<{
  member: AllianceMember;
  side: 'left' | 'right';
  progress: number;
  fracture: number;
}> = ({member, side, progress, fracture}) => {
  const direction = side === 'left' ? -1 : 1;
  const baseX = side === 'left' ? 225 : 1125;
  const settleX = interpolate(progress, [0, 1], [direction * 75, 0]);
  const splitX = interpolate(fracture, [0, 1], [0, direction * 175]);
  const angle = side === 'left' ? -2.4 : 2.2;
  const splitAngle = interpolate(fracture, [0, 1], [0, direction * 2.6]);

  return (
    <div
      style={{
        position: 'absolute',
        left: baseX,
        top: 335,
        width: 570,
        height: 360,
        opacity: progress,
        translate: `${settleX + splitX}px ${interpolate(fracture, [0, 1], [0, 20])}px`,
        rotate: `${angle + splitAngle}deg`,
        background:
          'linear-gradient(132deg, rgba(255,255,255,.48), transparent 30%), linear-gradient(180deg, #eee4ce 0%, #dfd0b2 100%)',
        boxShadow: '0 28px 42px rgba(0,0,0,.48), 0 2px 0 rgba(255,255,255,.45) inset',
        border: '1px solid rgba(82,60,37,.42)',
        transformOrigin: side === 'left' ? '85% 20%' : '15% 20%',
      }}
    >
      <PaperNoise />
      <Pin x={side === 'left' ? 500 : 48} y={38} />
      <div
        style={{
          position: 'absolute',
          left: 48,
          right: 48,
          top: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `2px solid ${palette.mutedInk}55`,
          paddingBottom: 22,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: WC_EDITORIAL_SANS,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 4.3,
              color: palette.mutedInk,
            }}
          >
            FIELD DOSSIER
          </div>
          <div
            style={{
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 55,
              lineHeight: 0.94,
              fontWeight: 700,
              letterSpacing: -1.5,
              color: palette.ink,
              marginTop: 12,
            }}
          >
            {member.force}
          </div>
        </div>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: `3px double ${member.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: member.color,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 35,
            fontWeight: 700,
          }}
        >
          {member.force.slice(0, 1)}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 48,
          right: 48,
          top: 186,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              color: palette.mutedInk,
              fontFamily: WC_EDITORIAL_SANS,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 3.8,
            }}
          >
            COMMAND
          </div>
          <div
            style={{
              color: palette.ink,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 39,
              fontStyle: 'italic',
              marginTop: 10,
            }}
          >
            {member.commander}
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div
            style={{
              color: palette.mutedInk,
              fontFamily: WC_EDITORIAL_SANS,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 3.8,
            }}
          >
            FIELD STRENGTH
          </div>
          <div
            style={{
              color: palette.ink,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 67,
              fontWeight: 700,
              letterSpacing: -1.8,
              marginTop: 2,
            }}
          >
            {member.strength}
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 48,
          bottom: 29,
          color: member.color,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: 4.6,
        }}
      >
        COALITION FORCE
      </div>
    </div>
  );
};

const ConnectionCord: React.FC<{
  establish: number;
  fracture: number;
  connectedLabel: string;
  fracturedLabel: string;
}> = ({establish, fracture, connectedLabel, fracturedLabel}) => {
  const leftEnd = interpolate(fracture, [0, 1], [850, 742]);
  const rightStart = interpolate(fracture, [0, 1], [1070, 1178]);
  const intact = interpolate(fracture, [0, 0.35, 0.62], [1, 1, 0], clamp);
  const severed = interpolate(fracture, [0.42, 0.72], [0, 1], clamp);

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, opacity: establish}}
      >
        <path
          d="M760 430 C 930 500, 990 500, 1160 430"
          fill="none"
          stroke="rgba(0,0,0,.48)"
          strokeWidth="17"
          strokeLinecap="round"
          opacity={intact}
        />
        <path
          d="M760 426 C 930 496, 990 496, 1160 426"
          fill="none"
          stroke={palette.cord}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="5 5"
          opacity={intact}
        />
        <path
          d={`M760 426 C 810 448, 825 458, ${leftEnd} 475`}
          fill="none"
          stroke={palette.cord}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="5 5"
          opacity={severed}
        />
        <path
          d={`M${rightStart} 475 C 1095 458, 1110 448, 1160 426`}
          fill="none"
          stroke={palette.cord}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="5 5"
          opacity={severed}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 280,
          textAlign: 'center',
          color: palette.paleInk,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 4.8,
          opacity: establish * (1 - fracture),
        }}
      >
        {connectedLabel}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 250,
          textAlign: 'center',
          color: palette.red,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: 5.2,
          opacity: severed,
          translate: `0px ${interpolate(severed, [0, 1], [14, 0])}px`,
        }}
      >
        {fracturedLabel}
      </div>
    </>
  );
};

const RedStaffMove: React.FC<{
  force: AllianceFractureProps['interveningForce'];
  drive: number;
}> = ({force, drive}) => {
  const lineProgress = interpolate(drive, [0.1, 0.78], [0, 1], clamp);
  const cardProgress = interpolate(drive, [0.42, 1], [0, 1], editorialEase);

  return (
    <>
      <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <path
          d="M956 992 C947 843 1000 714 963 596 C946 542 926 495 954 432"
          fill="none"
          stroke="rgba(32,14,10,.42)"
          strokeWidth="27"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineProgress}
        />
        <path
          d="M956 992 C947 843 1000 714 963 596 C946 542 926 495 954 432"
          fill="none"
          stroke={palette.red}
          strokeWidth="15"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineProgress}
        />
        <path
          d="M922 470 L954 423 L985 470"
          fill="none"
          stroke={palette.red}
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={interpolate(drive, [0.67, 0.88], [0, 1], clamp)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 680,
          top: 767,
          width: 560,
          height: 174,
          background: 'linear-gradient(145deg, #e9dcc0, #d9c6a2)',
          border: '1px solid rgba(82,60,37,.48)',
          boxShadow: '0 24px 40px rgba(0,0,0,.5)',
          rotate: '-1.2deg',
          opacity: cardProgress,
          scale: interpolate(cardProgress, [0, 1], [0.9, 1]),
          translate: `0px ${interpolate(cardProgress, [0, 1], [65, 0])}px`,
        }}
      >
        <PaperNoise />
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 27,
            right: 28,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <div
              style={{
                color: force.color,
                fontFamily: WC_EDITORIAL_SANS,
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: 4.4,
              }}
            >
              NAPOLEON BONAPARTE
            </div>
            <div
              style={{
                color: palette.ink,
                fontFamily: WC_EDITORIAL_SERIF,
                fontSize: 37,
                fontWeight: 700,
                marginTop: 10,
                whiteSpace: 'nowrap',
              }}
            >
              {force.label}
            </div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div
              style={{
                color: palette.mutedInk,
                fontFamily: WC_EDITORIAL_SANS,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 3.5,
              }}
            >
              {force.strengthNote}
            </div>
            <div
              style={{
                color: palette.ink,
                fontFamily: WC_EDITORIAL_SERIF,
                fontSize: 52,
                fontWeight: 700,
              }}
            >
              {force.strength}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Owner-review option 1: a reusable campaign-table relationship graphic.
 * The physical cord represents the script-stated mutual support; the red staff
 * move severs that relationship. It is explanatory, not a geographic map.
 */
export const AllianceFracture: React.FC<AllianceFractureProps> = (props) => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 19], [0, 1], editorialEase);
  const establish = interpolate(frame, [13, 38], [0, 1], editorialEase);
  const fracture = interpolate(frame, [57, 91], [0, 1], editorialEase);
  const drive = interpolate(frame, [58, 112], [0, 1], editorialEase);
  const conclusion = interpolate(frame, [107, 128], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 7, 141, 149], [0, 1, 1, 0], clamp);
  const camera = interpolate(frame, [45, 135], [1, 1.055], editorialEase);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.table,
        color: palette.paper,
        overflow: 'hidden',
        opacity: fade,
      }}
    >
      <Audio src={staticFile(props.audioSrc)} />
      <div
        style={{
          position: 'absolute',
          inset: -40,
          scale: camera,
          transformOrigin: '50% 54%',
          background:
            'radial-gradient(ellipse at 50% 49%, rgba(70,48,30,.58), rgba(23,18,13,.2) 53%, rgba(4,3,2,.7) 100%), repeating-linear-gradient(91deg, rgba(255,255,255,.013) 0px, rgba(255,255,255,.013) 2px, rgba(0,0,0,.03) 3px, rgba(0,0,0,.03) 11px), linear-gradient(106deg, #21170f, #130f0b 52%, #26180f)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.16,
            backgroundImage:
              'repeating-radial-gradient(ellipse at 20% 60%, transparent 0 47px, rgba(191,150,96,.2) 49px, transparent 51px)',
          }}
        />
        <Dossier
          member={props.members[0]}
          side="left"
          progress={establish}
          fracture={fracture}
        />
        <Dossier
          member={props.members[1]}
          side="right"
          progress={establish}
          fracture={fracture}
        />
        <ConnectionCord
          establish={establish}
          fracture={fracture}
          connectedLabel={props.connectedLabel}
          fracturedLabel={props.fracturedLabel}
        />
        <RedStaffMove force={props.interveningForce} drive={drive} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 58,
          color: palette.paleInk,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 4.8,
          opacity: intro * (1 - conclusion),
        }}
      >
        {props.eyebrow}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 101,
          color: palette.paper,
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: -1.7,
          lineHeight: 0.95,
          opacity: intro * (1 - conclusion),
          translate: `0px ${interpolate(intro, [0, 1], [18, 0])}px`,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 225,
          right: 225,
          bottom: 54,
          color: palette.paper,
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 51,
          fontStyle: 'italic',
          letterSpacing: -0.5,
          textAlign: 'center',
          textShadow: '0 5px 20px rgba(0,0,0,.75)',
          opacity: conclusion,
          translate: `0px ${interpolate(conclusion, [0, 1], [18, 0])}px`,
        }}
      >
        {props.takeaway}
      </div>
    </AbsoluteFill>
  );
};

export const ForceComparisonProof: React.FC = () => (
  <AllianceFracture
    eyebrow="ITALIAN CAMPAIGN · MARCH 1796"
    title="Outnumbered on paper."
    connectedLabel="55,000 · MUTUAL SUPPORT"
    fracturedLabel="CONNECTION CUT"
    members={[
      {
        commander: 'BEAULIEU',
        force: 'AUSTRIA',
        strength: '30,000',
        relativeWeight: 30,
        color: '#9c513f',
        darkText: '#2b1710',
      },
      {
        commander: 'COLLI',
        force: 'PIEDMONT',
        strength: '25,000',
        relativeWeight: 25,
        color: '#416776',
        darkText: '#162126',
      },
    ]}
    interveningForce={{
      label: 'ARMY OF ITALY',
      strength: '38,000',
      strengthNote: 'ON PAPER',
      color: palette.red,
    }}
    takeaway="He does not attack the mass. He attacks the seam."
    audioSrc="visual-lab/force-comparison/attack-the-seam.wav"
  />
);
