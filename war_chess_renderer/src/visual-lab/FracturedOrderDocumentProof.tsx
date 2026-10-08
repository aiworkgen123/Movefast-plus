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

export const FRACTURED_ORDER_DOCUMENT_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const paperTexture = {
  background:
    'linear-gradient(132deg, rgba(255,255,255,.5), transparent 30%), repeating-linear-gradient(7deg, transparent 0 8px, rgba(82,61,37,.035) 9px), linear-gradient(180deg, #eee4ce, #d9c6a3)',
};

const OrderContent: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, color: '#201a14'}}>
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 55,
        borderBottom: '2px solid rgba(54,42,28,.42)',
        paddingBottom: 27,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 4.8,
            color: '#746552',
          }}
        >
          HEADQUARTERS COPY · MARCH 1796
        </div>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: -1.8,
            marginTop: 10,
          }}
        >
          Coalition order of battle
        </div>
      </div>
      <div
        style={{
          border: '3px double #8e3e33',
          color: '#8e3e33',
          borderRadius: '50%',
          width: 98,
          height: 98,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: 2.2,
          rotate: '-8deg',
        }}
      >
        MUTUAL
        <br />
        SUPPORT
      </div>
    </div>

    <div
      style={{
        position: 'absolute',
        left: 76,
        right: 76,
        top: 240,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 116,
      }}
    >
      <div style={{borderRight: '1px solid rgba(54,42,28,.24)', paddingRight: 58}}>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 4.5,
            color: '#9b4a3c',
          }}
        >
          LEFT WING
        </div>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 78,
            fontWeight: 700,
            marginTop: 18,
          }}
        >
          Austria
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 35,
          }}
        >
          <div
            style={{
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 38,
              fontStyle: 'italic',
            }}
          >
            Beaulieu
          </div>
          <div
            style={{
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 73,
              fontWeight: 700,
            }}
          >
            30,000
          </div>
        </div>
      </div>
      <div style={{paddingLeft: 58}}>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 4.5,
            color: '#3e697a',
          }}
        >
          RIGHT WING
        </div>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 78,
            fontWeight: 700,
            marginTop: 18,
          }}
        >
          Piedmont
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 35,
          }}
        >
          <div
            style={{
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 38,
              fontStyle: 'italic',
            }}
          >
            Colli
          </div>
          <div
            style={{
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 73,
              fontWeight: 700,
            }}
          >
            25,000
          </div>
        </div>
      </div>
    </div>

    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        bottom: 48,
        borderTop: '2px solid rgba(54,42,28,.42)',
        paddingTop: 25,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 4.5,
          color: '#746552',
        }}
      >
        COMBINED FIELD STRENGTH
      </div>
      <div
        style={{
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 67,
          fontWeight: 700,
        }}
      >
        55,000
      </div>
    </div>
  </div>
);

const TornHalf: React.FC<{
  side: 'left' | 'right';
  establish: number;
  tear: number;
}> = ({side, establish, tear}) => {
  const direction = side === 'left' ? -1 : 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: 210,
        top: 218,
        width: 1500,
        height: 690,
        ...paperTexture,
        border: '1px solid rgba(72,52,31,.5)',
        boxShadow: '0 30px 55px rgba(0,0,0,.56)',
        opacity: establish,
        translate: `${interpolate(tear, [0, 1], [0, direction * 270])}px ${interpolate(
          tear,
          [0, 1],
          [0, 13],
        )}px`,
        rotate: `${interpolate(tear, [0, 1], [0, direction * 2.3])}deg`,
        clipPath:
          side === 'left'
            ? 'polygon(0 0, 51.5% 0, 49% 9%, 51% 18%, 49.4% 28%, 51% 39%, 49.2% 52%, 50.8% 64%, 48.8% 76%, 51% 88%, 49.5% 100%, 0 100%)'
            : 'polygon(51.5% 0, 100% 0, 100% 100%, 49.5% 100%, 51% 88%, 48.8% 76%, 51.2% 64%, 49.2% 52%, 51% 39%, 49.4% 28%, 51% 18%, 49% 9%)',
      }}
    >
      <OrderContent />
    </div>
  );
};

export const FracturedOrderDocumentProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [10, 32], [0, 1], editorialEase);
  const mark = interpolate(frame, [45, 69], [0, 1], editorialEase);
  const tear = interpolate(frame, [65, 101], [0, 1], editorialEase);
  const reveal = interpolate(frame, [76, 112], [0, 1], editorialEase);
  const conclusion = interpolate(frame, [107, 129], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 7, 141, 149], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        background: '#17120d',
        color: '#eee2cc',
        overflow: 'hidden',
        opacity: fade,
      }}
    >
      <Audio src={staticFile('visual-lab/force-comparison/attack-the-seam.wav')} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 56%, rgba(81,52,31,.55), transparent 56%), repeating-linear-gradient(91deg, rgba(255,255,255,.012) 0 2px, rgba(0,0,0,.035) 3px 12px), linear-gradient(110deg, #24180f, #100d09 55%, #26180f)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 690,
          top: 310,
          width: 540,
          height: 500,
          opacity: reveal,
          scale: interpolate(reveal, [0, 1], [0.86, 1]),
          translate: `0px ${interpolate(reveal, [0, 1], [100, 0])}px`,
          background: 'linear-gradient(155deg, #991f1c, #651713)',
          border: '1px solid #d17a69',
          boxShadow: '0 30px 55px rgba(0,0,0,.65)',
          color: '#f3e6d0',
          padding: '48px 50px',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 4.7,
          }}
        >
          BONAPARTE · ARMY OF ITALY
        </div>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 126,
            fontWeight: 700,
            letterSpacing: -3,
            marginTop: 38,
          }}
        >
          38,000
        </div>
        <div
          style={{
            height: 2,
            background: 'rgba(246,227,205,.5)',
            margin: '26px 40px 28px',
          }}
        />
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 42,
            fontStyle: 'italic',
          }}
        >
          Attack the seam.
        </div>
      </div>

      <TornHalf side="left" establish={establish} tear={tear} />
      <TornHalf side="right" establish={establish} tear={tear} />

      <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <path
          d="M965 245 C932 375 992 487 949 616 C927 681 984 771 951 905"
          fill="none"
          stroke="rgba(67,16,13,.35)"
          strokeWidth="31"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - mark}
        />
        <path
          d="M965 245 C932 375 992 487 949 616 C927 681 984 771 951 905"
          fill="none"
          stroke="#a43830"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - mark}
          opacity={1 - tear * 0.65}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 58,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 4.8,
          color: '#b9aa92',
          opacity: intro * (1 - conclusion),
        }}
      >
        ITALIAN CAMPAIGN · MARCH 1796
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 50,
          textAlign: 'center',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 50,
          fontStyle: 'italic',
          textShadow: '0 6px 22px rgba(0,0,0,.78)',
          opacity: conclusion,
          translate: `0px ${interpolate(conclusion, [0, 1], [18, 0])}px`,
        }}
      >
        One coalition on paper. Two armies in the field.
      </div>
    </AbsoluteFill>
  );
};
