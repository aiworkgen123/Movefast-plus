import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const WC02_PREMIUM_OPTIONS_REVIEW_DURATION = 4;

const CUTOUT_PATH = 'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png';
const museumSerif = "'Iowan Old Style', Baskerville, Georgia, 'Times New Roman', serif";
const museumSans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const cinematicSerif = "Didot, 'Bodoni 72', Baskerville, Georgia, serif";
const cinematicSans = "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif";
const marginaliaSerif = "Baskerville, 'Iowan Old Style', Georgia, 'Times New Roman', serif";

const ideas = ['Establish the subject', 'Name the position', 'Read the consequence'] as const;

const OptionMark: React.FC<{
  letter: string;
  title: string;
  color: string;
  accent: string;
  right?: number;
  left?: number;
}> = ({letter, title, color, accent, right, left}) => (
  <div
    style={{
      position: 'absolute',
      top: 44,
      right,
      left,
      zIndex: 20,
      color,
      fontFamily: museumSans,
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: 3.2,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{color: accent, marginRight: 14}}>{letter}</span>
    {title}
  </div>
);

const Cutout: React.FC<{
  left: number;
  top: number;
  width: number;
  height: number;
  filter?: string;
  opacity?: number;
}> = ({left, top, width, height, filter, opacity = 1}) => (
  <Img
    src={staticFile(CUTOUT_PATH)}
    style={{
      position: 'absolute',
      left,
      top,
      width,
      height,
      objectFit: 'contain',
      objectPosition: 'center bottom',
      opacity,
      filter,
      zIndex: 3,
    }}
  />
);

const IdeaBlock: React.FC<{
  number: number;
  copy: string;
  left: number;
  top: number;
  width: number;
  color: string;
  numberColor: string;
  fontFamily: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'right';
  italic?: boolean;
}> = ({
  number,
  copy,
  left,
  top,
  width,
  color,
  numberColor,
  fontFamily,
  fontSize = 38,
  fontWeight = 600,
  lineHeight = 1,
  textAlign = 'left',
  italic = false,
}) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width,
      zIndex: 6,
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: textAlign === 'right' ? 'flex-end' : 'flex-start',
      gap: 18,
      color,
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight,
      letterSpacing: -0.45,
      textAlign,
      fontStyle: italic ? 'italic' : 'normal',
    }}
  >
    <span
      style={{
        flexShrink: 0,
        color: numberColor,
        fontFamily: museumSans,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 2.8,
        fontStyle: 'normal',
      }}
    >
      {String(number).padStart(2, '0')}
    </span>
    <span>{copy}</span>
  </div>
);

const ConnectorLayer: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg
    width={1920}
    height={1080}
    viewBox="0 0 1920 1080"
    style={{position: 'absolute', inset: 0, zIndex: 2, overflow: 'visible', pointerEvents: 'none'}}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const MuseumEditorial: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(circle at 26% 48%, rgba(255,255,255,.34), transparent 38%), #e8e0d2',
      color: '#2f2d29',
      overflow: 'hidden',
    }}
  >
    <OptionMark letter="A" title="Museum editorial" color="#625b52" accent="#a98248" right={72} />
    <div style={{position: 'absolute', left: 930, top: 92, width: 830, zIndex: 5}}>
      <div style={{fontFamily: museumSans, color: '#9a7745', fontSize: 16, fontWeight: 700, letterSpacing: 4.2}}>
        WC02 · SUBJECT INTRODUCTION
      </div>
      <div style={{marginTop: 18, fontFamily: museumSerif, fontSize: 76, fontWeight: 600, lineHeight: 0.94, letterSpacing: -1.1}}>
        Napoleon Bonaparte
      </div>
      <div style={{marginTop: 18, fontFamily: museumSans, color: '#6f675c', fontSize: 20, fontWeight: 600, letterSpacing: 3.8}}>
        CAMPAIGN COMMANDER
      </div>
    </div>
    <ConnectorLayer>
      <path d="M 520 390 C 685 330, 804 349, 944 362" fill="none" stroke="#b18a52" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 525 523 C 698 486, 805 544, 944 558" fill="none" stroke="#b18a52" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 510 678 C 688 678, 812 734, 944 754" fill="none" stroke="#b18a52" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="520" cy="390" r="4" fill="#b18a52" />
      <circle cx="525" cy="523" r="4" fill="#b18a52" />
      <circle cx="510" cy="678" r="4" fill="#b18a52" />
      <circle cx="944" cy="362" r="4" fill="#b18a52" />
      <circle cx="944" cy="558" r="4" fill="#b18a52" />
      <circle cx="944" cy="754" r="4" fill="#b18a52" />
    </ConnectorLayer>
    <Cutout left={104} top={124} width={710} height={910} filter="drop-shadow(0 24px 18px rgba(67,52,36,.22)) saturate(.92)" />
    <IdeaBlock number={1} copy={ideas[0]} left={972} top={338} width={745} color="#2f2d29" numberColor="#a98248" fontFamily={museumSerif} />
    <IdeaBlock number={2} copy={ideas[1]} left={972} top={534} width={745} color="#2f2d29" numberColor="#a98248" fontFamily={museumSerif} />
    <IdeaBlock number={3} copy={ideas[2]} left={972} top={730} width={745} color="#2f2d29" numberColor="#a98248" fontFamily={museumSerif} />
    <div style={{position: 'absolute', left: 930, bottom: 58, color: '#8c8274', fontFamily: museumSans, fontSize: 14, fontWeight: 600, letterSpacing: 2.7}}>
      LOCAL REVIEW FIXTURE · TRANSPARENT CUTOUT
    </div>
  </AbsoluteFill>
);

const CinematicDossier: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(circle at 31% 49%, rgba(150,82,63,.15), transparent 35%), linear-gradient(116deg, #11171b 0%, #1c1719 67%, #0d1114 100%)',
      color: '#f0e8dc',
      overflow: 'hidden',
    }}
  >
    <OptionMark letter="B" title="Cinematic dossier" color="#bdb5ae" accent="#a14d3e" right={72} />
    <div style={{position: 'absolute', left: 104, top: 82, zIndex: 5}}>
      <div style={{fontFamily: cinematicSans, color: '#a14d3e', fontSize: 16, fontWeight: 700, letterSpacing: 4.4}}>
        CASE FILE / WC02
      </div>
      <div style={{marginTop: 18, fontFamily: cinematicSans, fontSize: 84, fontWeight: 800, lineHeight: 0.86, letterSpacing: 7.4}}>
        NAPOLEON
      </div>
      <div style={{marginTop: 16, fontFamily: cinematicSerif, color: '#d5c7ba', fontSize: 48, fontWeight: 500, lineHeight: 0.95, letterSpacing: 0.4}}>
        Bonaparte
      </div>
    </div>
    <ConnectorLayer>
      <path d="M 565 364 L 862 364 L 1014 342" fill="none" stroke="#a14d3e" strokeWidth="2.4" strokeLinecap="square" opacity=".88" />
      <path d="M 565 528 L 886 528 L 1014 538" fill="none" stroke="#a14d3e" strokeWidth="2.4" strokeLinecap="square" opacity=".88" />
      <path d="M 560 704 L 862 704 L 1014 735" fill="none" stroke="#a14d3e" strokeWidth="2.4" strokeLinecap="square" opacity=".88" />
      <path d="M 964 278 L 964 816" fill="none" stroke="#a14d3e" strokeWidth="1" opacity=".48" />
      <circle cx="565" cy="364" r="4" fill="#a14d3e" />
      <circle cx="565" cy="528" r="4" fill="#a14d3e" />
      <circle cx="560" cy="704" r="4" fill="#a14d3e" />
      <circle cx="1014" cy="342" r="4" fill="#a14d3e" />
      <circle cx="1014" cy="538" r="4" fill="#a14d3e" />
      <circle cx="1014" cy="735" r="4" fill="#a14d3e" />
    </ConnectorLayer>
    <Cutout left={104} top={144} width={720} height={900} filter="drop-shadow(0 26px 20px rgba(0,0,0,.48)) saturate(.86) contrast(1.04)" />
    <IdeaBlock number={1} copy={ideas[0]} left={1048} top={322} width={690} color="#f0e8dc" numberColor="#a14d3e" fontFamily={cinematicSans} fontSize={38} fontWeight={700} lineHeight={1.04} />
    <IdeaBlock number={2} copy={ideas[1]} left={1048} top={518} width={690} color="#f0e8dc" numberColor="#a14d3e" fontFamily={cinematicSans} fontSize={38} fontWeight={700} lineHeight={1.04} />
    <IdeaBlock number={3} copy={ideas[2]} left={1048} top={715} width={690} color="#f0e8dc" numberColor="#a14d3e" fontFamily={cinematicSans} fontSize={38} fontWeight={700} lineHeight={1.04} />
    <div style={{position: 'absolute', left: 104, bottom: 58, color: '#8b8279', fontFamily: cinematicSans, fontSize: 14, fontWeight: 600, letterSpacing: 3.1}}>
      SUBJECT / POSITION / CONSEQUENCE
    </div>
  </AbsoluteFill>
);

const HistoricalMarginalia: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(circle at 50% 47%, rgba(255,255,255,.34), transparent 36%), #e7dfd0',
      color: '#34312c',
      overflow: 'hidden',
    }}
  >
    <OptionMark letter="C" title="Historical marginalia" color="#625b52" accent="#8b3f35" right={72} />
    <div style={{position: 'absolute', left: 112, top: 76, width: 730, zIndex: 5}}>
      <div style={{fontFamily: museumSans, color: '#8b3f35', fontSize: 15, fontWeight: 700, letterSpacing: 4.2}}>
        MARGINALIA / WC02
      </div>
      <div style={{marginTop: 15, fontFamily: marginaliaSerif, fontSize: 68, fontWeight: 600, lineHeight: 0.94, letterSpacing: -0.7}}>
        Napoleon Bonaparte
      </div>
      <div style={{marginTop: 14, fontFamily: museumSans, color: '#746c61', fontSize: 17, fontWeight: 600, letterSpacing: 3.4}}>
        ANATOMY OF AN INTRODUCTION
      </div>
    </div>
    <ConnectorLayer>
      <path d="M 680 401 C 588 364, 520 354, 574 354" fill="none" stroke="#6b6257" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 1078 489 C 1178 468, 1227 468, 1282 468" fill="none" stroke="#8b3f35" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 688 780 C 585 784, 528 805, 604 805" fill="none" stroke="#6b6257" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="680" cy="401" r="3.5" fill="#6b6257" />
      <circle cx="1078" cy="489" r="3.5" fill="#8b3f35" />
      <circle cx="688" cy="780" r="3.5" fill="#6b6257" />
      <circle cx="574" cy="354" r="3.5" fill="#6b6257" />
      <circle cx="1282" cy="468" r="3.5" fill="#8b3f35" />
      <circle cx="604" cy="805" r="3.5" fill="#6b6257" />
    </ConnectorLayer>
    <Cutout left={674} top={205} width={548} height={830} filter="drop-shadow(0 22px 17px rgba(66,53,42,.22)) sepia(.12) saturate(.84)" />
    <div style={{position: 'absolute', left: 110, top: 318, zIndex: 6, fontFamily: museumSans, color: '#7c7164', fontSize: 14, fontWeight: 700, letterSpacing: 3.4}}>IDENTITY</div>
    <IdeaBlock number={1} copy={ideas[0]} left={110} top={346} width={510} color="#34312c" numberColor="#8b3f35" fontFamily={marginaliaSerif} fontSize={36} fontWeight={600} lineHeight={1.05} italic />
    <div style={{position: 'absolute', left: 1282, top: 430, zIndex: 6, fontFamily: museumSans, color: '#8b3f35', fontSize: 14, fontWeight: 700, letterSpacing: 3.4}}>POSITION</div>
    <IdeaBlock number={2} copy={ideas[1]} left={1282} top={458} width={520} color="#34312c" numberColor="#8b3f35" fontFamily={marginaliaSerif} fontSize={36} fontWeight={600} lineHeight={1.05} italic />
    <div style={{position: 'absolute', left: 110, top: 744, zIndex: 6, fontFamily: museumSans, color: '#7c7164', fontSize: 14, fontWeight: 700, letterSpacing: 3.4}}>CONSEQUENCE</div>
    <IdeaBlock number={3} copy={ideas[2]} left={110} top={772} width={565} color="#34312c" numberColor="#8b3f35" fontFamily={marginaliaSerif} fontSize={36} fontWeight={600} lineHeight={1.05} italic />
    <div style={{position: 'absolute', right: 112, bottom: 58, color: '#8a8071', fontFamily: museumSans, fontSize: 14, fontWeight: 600, letterSpacing: 2.8}}>
      ARCHIVAL NOTE · LOCAL REVIEW
    </div>
  </AbsoluteFill>
);

const UltraMinimal: React.FC = () => (
  <AbsoluteFill style={{background: '#f4f1ea', color: '#252522', overflow: 'hidden'}}>
    <OptionMark letter="D" title="Ultra-minimal" color="#77736b" accent="#a98248" right={72} />
    <div style={{position: 'absolute', left: 158, top: 104, width: 870, zIndex: 5}}>
      <div style={{fontFamily: WC_EDITORIAL_SANS, color: '#a98248', fontSize: 15, fontWeight: 700, letterSpacing: 4.1}}>
        WC02 / SUBJECT INTRODUCTION
      </div>
      <div style={{marginTop: 18, fontFamily: WC_EDITORIAL_SERIF, fontSize: 78, fontWeight: 700, lineHeight: 0.93, letterSpacing: -1.7}}>
        Napoleon Bonaparte
      </div>
      <div style={{marginTop: 18, fontFamily: WC_EDITORIAL_SANS, color: '#77736b', fontSize: 18, fontWeight: 700, letterSpacing: 3.8}}>
        CAMPAIGN COMMANDER
      </div>
    </div>
    <ConnectorLayer>
      <path d="M 208 350 L 208 852" fill="none" stroke="#a98248" strokeWidth="1.4" />
      <path d="M 208 398 L 254 398" fill="none" stroke="#a98248" strokeWidth="1.4" />
      <path d="M 208 586 L 254 586" fill="none" stroke="#a98248" strokeWidth="1.4" />
      <path d="M 208 774 L 254 774" fill="none" stroke="#a98248" strokeWidth="1.4" />
      <circle cx="208" cy="398" r="3.5" fill="#a98248" />
      <circle cx="208" cy="586" r="3.5" fill="#a98248" />
      <circle cx="208" cy="774" r="3.5" fill="#a98248" />
    </ConnectorLayer>
    <Cutout left={1216} top={110} width={600} height={920} filter="drop-shadow(0 21px 17px rgba(48,43,34,.18)) saturate(.88)" />
    <IdeaBlock number={1} copy={ideas[0]} left={258} top={370} width={790} color="#252522" numberColor="#a98248" fontFamily={WC_EDITORIAL_SANS} fontSize={41} fontWeight={600} lineHeight={1.02} />
    <IdeaBlock number={2} copy={ideas[1]} left={258} top={558} width={790} color="#252522" numberColor="#a98248" fontFamily={WC_EDITORIAL_SANS} fontSize={41} fontWeight={600} lineHeight={1.02} />
    <IdeaBlock number={3} copy={ideas[2]} left={258} top={746} width={790} color="#252522" numberColor="#a98248" fontFamily={WC_EDITORIAL_SANS} fontSize={41} fontWeight={600} lineHeight={1.02} />
    <div style={{position: 'absolute', left: 158, bottom: 58, color: '#8b877e', fontFamily: WC_EDITORIAL_SANS, fontSize: 14, fontWeight: 600, letterSpacing: 2.8}}>
      ONE COLUMN · THREE IDEAS
    </div>
  </AbsoluteFill>
);

export const WC02PremiumOptionsReview: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#f4f1ea'}}>
    <Sequence name="A · museum editorial" from={0} durationInFrames={1} layout="none">
      <MuseumEditorial />
    </Sequence>
    <Sequence name="B · cinematic dossier" from={1} durationInFrames={1} layout="none">
      <CinematicDossier />
    </Sequence>
    <Sequence name="C · historical marginalia" from={2} durationInFrames={1} layout="none">
      <HistoricalMarginalia />
    </Sequence>
    <Sequence name="D · ultra-minimal" from={3} durationInFrames={1} layout="none">
      <UltraMinimal />
    </Sequence>
  </AbsoluteFill>
);
