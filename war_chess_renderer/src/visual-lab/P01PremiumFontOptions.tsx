import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const P01_PREMIUM_FONT_OPTION_DURATION = 150;
export const P01_FINAL_REVIEW_DURATION = 90;

type FontOption = {
  headlineFont: string;
  headlineSize: number;
  headlineWeight: number;
  headlineTracking: number;
  headlineLineHeight: number;
  kickerFont: string;
  kickerSize: number;
  kickerWeight: number;
  kickerTracking: number;
  kickerStyle?: 'normal' | 'italic';
  showKicker?: boolean;
  imageSrc?: string;
  revealImageOnExit?: boolean;
};

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const P01FontStill: React.FC<FontOption> = ({showKicker = true, imageSrc = 'visual-lab/p01-font-options/fixture-still.jpg', revealImageOnExit = false, ...option}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames - 1], [1, 1.035], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  const translateX = interpolate(frame, [0, durationInFrames - 1], [0, -10], clamp);
  const entrance = interpolate(frame, [0, .65 * fps], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  const exit = interpolate(frame, [durationInFrames - .4 * fps, durationInFrames - 1], [1, 0], clamp);
  const overlayOpacity = Math.min(entrance, exit);
  const imageBackingOpacity = revealImageOnExit ? overlayOpacity : 1;
  const titleTranslateY = interpolate(frame, [0, .75 * fps], [24, 0], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  const accentWidth = interpolate(frame, [.15 * fps, .8 * fps], [0, 32], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});

  return (
    <AbsoluteFill style={{backgroundColor: '#080807', overflow: 'hidden'}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <Img src={staticFile(imageSrc)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 34%', scale, translate: `${translateX}px 0px`, filter: 'sepia(0.12) saturate(0.82) contrast(1.04) brightness(0.88)'}} />
      </AbsoluteFill>
      {revealImageOnExit ? (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(7, 8, 8, 0.44) 0%, rgba(7, 8, 8, 0.27) 38%, rgba(7, 8, 8, 0) 78%)', opacity: imageBackingOpacity}} />
          <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(4, 4, 3, 0.25) 0%, rgba(4, 4, 3, 0) 38%)', opacity: .9 * imageBackingOpacity}} />
          <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.31)', opacity: imageBackingOpacity}} />
        </>
      ) : (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(7, 8, 8, 0.88) 0%, rgba(7, 8, 8, 0.54) 38%, rgba(7, 8, 8, 0) 78%)'}} />
          <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(4, 4, 3, 0.50) 0%, rgba(4, 4, 3, 0) 38%)', opacity: .9}} />
          <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.62)'}} />
        </>
      )}
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'flex-start', paddingLeft: 138, paddingBottom: 155, opacity: overlayOpacity, translate: `0px ${titleTranslateY}px`}}>
        <div style={{width: 760}}>
          {showKicker ? <>
            <div style={{width: accentWidth, height: 5, marginBottom: 22, backgroundColor: '#c39a52'}} />
            <div style={{marginBottom: 16, color: '#d8bd88', fontFamily: option.kickerFont, fontSize: option.kickerSize, fontStyle: option.kickerStyle ?? 'normal', fontWeight: option.kickerWeight, letterSpacing: option.kickerTracking, textTransform: 'uppercase'}}>A recovered record</div>
          </> : null}
          <div style={{color: '#f0eadb', fontFamily: option.headlineFont, fontSize: option.headlineSize, fontWeight: option.headlineWeight, letterSpacing: option.headlineTracking, lineHeight: option.headlineLineHeight, textTransform: 'uppercase', textShadow: '0 3px 18px rgba(0, 0, 0, 0.55)'}}>
            <div>THE RECORD</div>
            <div style={{color: '#d2a85e'}}>REMAINS</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const P01FontOptionAIowan: React.FC = () => <P01FontStill headlineFont="'Iowan Old Style', Iowan, Baskerville, Georgia, serif" headlineSize={94} headlineWeight={700} headlineTracking={.2} headlineLineHeight={.95} kickerFont="'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif" kickerSize={23} kickerWeight={600} kickerTracking={4.5} />;
export const P01FinalReview: React.FC = () => <P01FontStill headlineFont="'Iowan Old Style', Iowan, Baskerville, Georgia, serif" headlineSize={94} headlineWeight={700} headlineTracking={.2} headlineLineHeight={.95} kickerFont="'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif" kickerSize={23} kickerWeight={600} kickerTracking={4.5} showKicker={false} imageSrc="visual-lab/factual-owner-cut/montgomery-1943.jpg" revealImageOnExit />;
export const P01FontOptionBBaskerville: React.FC = () => <P01FontStill headlineFont="Baskerville, 'Iowan Old Style', Georgia, serif" headlineSize={96} headlineWeight={600} headlineTracking={.1} headlineLineHeight={.94} kickerFont="Baskerville, 'Iowan Old Style', Georgia, serif" kickerSize={23} kickerWeight={600} kickerTracking={4.1} kickerStyle="italic" />;
export const P01FontOptionCOptima: React.FC = () => <P01FontStill headlineFont="Optima, 'Gill Sans', 'Helvetica Neue', Arial, sans-serif" headlineSize={91} headlineWeight={700} headlineTracking={.35} headlineLineHeight={.97} kickerFont="'Iowan Old Style', Iowan, Baskerville, Georgia, serif" kickerSize={23} kickerWeight={600} kickerTracking={4.2} kickerStyle="italic" />;
export const P01FontOptionDAvenirCondensed: React.FC = () => <P01FontStill headlineFont="'Avenir Next Condensed', 'Arial Narrow', Arial, sans-serif" headlineSize={94} headlineWeight={800} headlineTracking={1} headlineLineHeight={.96} kickerFont="'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif" kickerSize={23} kickerWeight={600} kickerTracking={4.5} />;
