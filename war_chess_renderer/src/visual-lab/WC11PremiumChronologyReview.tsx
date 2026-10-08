import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const WC11_PREMIUM_CHRONOLOGY_DURATION = 150;

const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
const oxblood = '#87372f';
const ink = '#f1e7d3';

const events = [
  {ordinal: '01', title: 'The first signal'},
  {ordinal: '02', title: 'Momentum shifts'},
  {ordinal: '03', title: 'The turning point'},
  {ordinal: '04', title: 'The final outcome'},
] as const;

const positions = [225, 715, 1205, 1695] as const;

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const Paper: React.FC = () => <AbsoluteFill>
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
    <defs>
      <pattern id="wc11-grid" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M96 0H0V96" fill="none" stroke="#736d61" strokeWidth="1" opacity=".09"/></pattern>
      <pattern id="wc11-grain" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="#574f43" opacity=".08"/><circle cx="10" cy="8" r=".5" fill="#fffaf0" opacity=".24"/></pattern>
    </defs>
    <rect width="1920" height="1080" fill="url(#wc11-grid)"/>
    <rect width="1920" height="1080" fill="url(#wc11-grain)"/>
    <g stroke="#8b8170" strokeWidth="1" opacity=".15"><path d="M96 166H1824"/><path d="M96 914H1824"/></g>
  </svg>
</AbsoluteFill>;

export const WC11PremiumChronologyReview: React.FC = () => {
  const frame = useCurrentFrame();
  const finalOverview = frame >= 120;
  const activeIndex = Math.min(3, Math.floor(frame / 30));
  const lineProgress = interpolate(frame, [4, 112], [0, 1], {...clamp, easing: Easing.linear});
  const imageScale = interpolate(frame, [0, WC11_PREMIUM_CHRONOLOGY_DURATION - 1], [1.03, 1.045], clamp);
  return <AbsoluteFill style={{overflow: 'hidden', color: ink}}>
    <Img
      src={staticFile('visual-lab/wc11-chronology/editor-arranging-archival-chronology.png')}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(13.8px)', scale: imageScale}}
    />
    <Paper/>
    <div style={{position: 'absolute', left: 96, top: 62, fontFamily: sans, fontSize: 18, fontWeight: 600, letterSpacing: 4.4, color: oxblood, WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>CHRONOLOGY</div>
    <div style={{position: 'absolute', left: 96, top: 102, fontFamily: serif, fontSize: 76, fontWeight: 600, lineHeight: .96, letterSpacing: -.4, WebkitTextStroke: '4px #000000', paintOrder: 'stroke fill'}}>How it unfolded</div>

    {!finalOverview ? <div style={{position: 'absolute', left: 96, right: 96, top: 282, height: 170, textAlign: 'center'}}>
      <div style={{fontFamily: sans, fontSize: 20, fontWeight: 600, letterSpacing: 4, color: oxblood, WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>{events[activeIndex].ordinal}</div>
      <div style={{marginTop: 18, fontFamily: serif, fontSize: 68, fontWeight: 600, lineHeight: .98, WebkitTextStroke: '4px #000000', paintOrder: 'stroke fill'}}>{events[activeIndex].title}</div>
    </div> : <div style={{position: 'absolute', left: 96, right: 96, top: 316, textAlign: 'center', fontFamily: sans, fontSize: 18, fontWeight: 600, letterSpacing: 4, color: oxblood, WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>COMPLETE OVERVIEW</div>}

    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <path d="M225 650 H1695" fill="none" stroke="#d9cdb8" strokeWidth="2"/>
      <path d="M225 650 H1695" pathLength="1" fill="none" stroke={oxblood} strokeWidth="3" strokeLinecap="butt" strokeDasharray="1" strokeDashoffset={1 - lineProgress}/>
      {events.map((event, index) => {
        const reveal = interpolate(frame, [index * 30 + 4, index * 30 + 11], [0, 1], clamp);
        const current = !finalOverview && index === activeIndex;
        const visible = index <= activeIndex || finalOverview;
        const radius = current ? 16 : 10;
        return <g key={event.ordinal} opacity={visible ? reveal : 0}>
          <circle cx={positions[index]} cy="650" r={radius + 7} fill="#e7decb" stroke="#a89b87" strokeWidth="1"/>
          <circle cx={positions[index]} cy="650" r={radius} fill={current ? oxblood : '#e7decb'} stroke={oxblood} strokeWidth={current ? 2 : 3}/>
        </g>;
      })}
    </svg>

    {events.map((event, index) => {
      const reveal = interpolate(frame, [index * 30 + 4, index * 30 + 11], [0, 1], clamp);
      const current = !finalOverview && index === activeIndex;
      const visible = index <= activeIndex || finalOverview;
      return <div key={event.ordinal} style={{position: 'absolute', left: positions[index] - 180, top: 701, width: 360, textAlign: 'center', opacity: visible ? reveal : 0}}>
        <div style={{fontFamily: sans, fontSize: 17, fontWeight: 600, letterSpacing: 3.2, color: current ? oxblood : '#eadfcb', WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>{event.ordinal}</div>
        <div style={{marginTop: 12, fontFamily: serif, fontSize: current ? 34 : 29, fontWeight: current ? 600 : 500, lineHeight: 1.05, color: '#f1e7d3', WebkitTextStroke: '3px #000000', paintOrder: 'stroke fill'}}>{event.title}</div>
      </div>;
    })}

    <div style={{position: 'absolute', right: 96, bottom: 61, fontFamily: sans, fontSize: 14, fontWeight: 600, letterSpacing: 2.8, color: '#eadfcb', WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>ILLUSTRATIVE REVIEW COPY</div>
  </AbsoluteFill>;
};
