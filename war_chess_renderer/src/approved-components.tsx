import {chronologyCueState} from './component-cue-state';
import React from 'react';
import {Chess, type Square} from 'chess.js';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {AnchoredProgression} from './anchored-progression';
import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from './editorial-theme';
import {CartographicDecisionFork} from './canonical/cartographic-decision-fork';
import {STRONG_GREY_MAP_TREATMENT, WC04_ADAPTIVE_STYLE, type EngravedPieceSpec, type TacticalArrowSpec} from './canonical/production-contracts';
import {WarChessEngravedPiece} from './canonical/war-chess-engraved-piece';
import {WarChessTacticalArrow} from './canonical/war-chess-tactical-arrow';
import type {RenderComponent} from './schema';
import {WC06PremiumMinimalReview, type WC06PremiumMinimalReviewLabels} from './visual-lab/WC06PremiumMinimalReview';

type ComponentOf<T extends RenderComponent['componentType']> =
  Extract<RenderComponent, {componentType: T}>;

const C = {
  ink: '#0d0d0b',
  paper: '#efe5cf',
  amber: '#c89a47',
  red: '#b94b39',
  blue: '#81999a',
  muted: '#aaa18e',
  dim: '#777264',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const assetUrl = (asset: {url?: string; staticFileKey?: string}) => {
  if (asset.url) return asset.url;
  if (asset.staticFileKey) return staticFile(asset.staticFileKey);
  throw new Error('approved component asset was not staged by the render worker');
};

const localDuration = (component: Pick<RenderComponent, 'startFrame' | 'endFrameExclusive'>) =>
  component.endFrameExclusive - component.startFrame;

const reveal = (frame: number, start: number, duration = 20) =>
  interpolate(frame, [start, start + duration], [0, 1], ease);

const EditorialLabel: React.FC<{children: React.ReactNode; color?: string}> = ({children, color = C.amber}) => (
  <div style={{fontFamily: WC_EDITORIAL_SANS, color, fontSize: 18, fontWeight: 800, letterSpacing: 4.8}}>
    {children}
  </div>
);

const Terrain: React.FC<{width?: number}> = ({width = 1920}) => (
  <svg viewBox={`0 0 ${width} 1080`} style={{position: 'absolute', inset: 0, width, height: 1080}}>
    <defs>
      <radialGradient id={`field-${width}`} cx="52%" cy="46%" r="76%">
        <stop offset="0" stopColor="#45402c" />
        <stop offset=".58" stopColor="#25271d" />
        <stop offset="1" stopColor="#10110d" />
      </radialGradient>
    </defs>
    <rect width={width} height="1080" fill={`url(#field-${width})`} />
    <g fill="none" stroke="#d6caa4" strokeWidth="2" opacity=".11">
      <path d={`M-80 174 C130 40 310 245 500 118 S835 222 1055 92 S${width - 85} 145 ${width + 100} 35`} />
      <path d={`M-70 235 C145 105 325 305 520 180 S858 282 1076 155 S${width - 70} 210 ${width + 115} 99`} />
      <path d={`M-45 800 C160 668 345 874 553 748 S920 852 1155 698 S${width - 30} 716 ${width + 120} 628`} />
      <path d={`M-35 866 C177 728 365 934 578 812 S950 914 1182 760 S${width - 10} 778 ${width + 140} 690`} />
      <path d="M148 -30 C236 145 130 290 225 450 S186 768 270 1110" />
    </g>
    <path d={`M${width * .8} -20 C${width * .75} 182 ${width * .84} 320 ${width * .78} 485 S${width * .78} 800 ${width * .7} 1110`} fill="none" stroke="#6d9290" strokeWidth="70" opacity=".1" />
    <path d={`M${width * .8} -20 C${width * .75} 182 ${width * .84} 320 ${width * .78} 485 S${width * .78} 800 ${width * .7} 1110`} fill="none" stroke="#96afaa" strokeWidth="3" opacity=".3" />
  </svg>
);

const BackgroundWash: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(8,8,7,.94) 0%, rgba(8,8,7,.7) 38%, rgba(8,8,7,.05) 76%)'}} />
);

const P01Headline: React.FC<{headline: string; emphasis: string | null}> = ({headline, emphasis}) => {
  if (!emphasis) return <>{headline}</>;
  const index = headline.toLocaleLowerCase().indexOf(emphasis.toLocaleLowerCase());
  if (index < 0) return <>{headline}</>;
  return <>{headline.slice(0, index)}<span style={{color: '#d2a85e'}}>{headline.slice(index, index + emphasis.length)}</span>{headline.slice(index + emphasis.length)}</>;
};

/** P01 v2 — owner-approved short editorial phrase over one reviewed still. */
export const ApprovedShortOverlay: React.FC<ComponentOf<'P01'>> = (component) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = localDuration(component);
  const textEndFrame = duration - fps;
  const entrance = interpolate(frame, [0, Math.round(.65 * fps)], [0, 1], ease);
  const exitStartFrame = textEndFrame - Math.round(.4 * fps);
  const exit = frame >= textEndFrame
    ? 0
    : interpolate(frame, [exitStartFrame, Math.max(exitStartFrame + 1, textEndFrame - 1)], [1, 0], clamp);
  const overlayOpacity = Math.min(entrance, exit);
  const headlineSize = component.headline.length > 36 ? 78 : component.headline.length > 28 ? 86 : 94;

  return (
    <AbsoluteFill style={{backgroundColor: '#080807', overflow: 'hidden'}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <Img
          src={assetUrl(component.source)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: interpolate(frame, [0, duration - 1], [1, 1.035], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)}),
            translate: `${interpolate(frame, [0, duration - 1], [0, -10], clamp)}px 0px`,
            filter: 'sepia(0.12) saturate(0.82) contrast(1.04) brightness(0.88)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(7, 8, 8, 0.44) 0%, rgba(7, 8, 8, 0.27) 38%, rgba(7, 8, 8, 0) 78%)', opacity: overlayOpacity}} />
      <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(4, 4, 3, 0.25) 0%, rgba(4, 4, 3, 0) 38%)', opacity: .9 * overlayOpacity}} />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.31)', opacity: overlayOpacity}} />
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          paddingLeft: 138,
          paddingBottom: 155,
          opacity: overlayOpacity,
          translate: `0px ${interpolate(frame, [0, Math.round(.75 * fps)], [24, 0], ease)}px`,
        }}
      >
        <div
          style={{
            width: 820,
            maxHeight: 190,
            overflow: 'hidden',
            color: '#f0eadb',
            fontFamily: "'Iowan Old Style', Iowan, Baskerville, Georgia, serif",
            fontSize: headlineSize,
            fontWeight: 700,
            letterSpacing: .2,
            lineHeight: .95,
            textTransform: 'uppercase',
            textWrap: 'balance',
            textShadow: '0 3px 18px rgba(0, 0, 0, 0.55)',
          }}
        >
          <P01Headline headline={component.headline} emphasis={component.emphasis} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** P02 v2 — owner-approved compact editorial statement over one reviewed still. */
export const ApprovedEditorialCard: React.FC<ComponentOf<'P02'>> = (component) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = localDuration(component);
  const cardOpacity = interpolate(frame, [0, Math.round(.35 * fps)], [0, 1], clamp);
  const exitOpacity = interpolate(
    frame,
    [duration - Math.round(.35 * fps), duration],
    [1, 0],
    clamp,
  );
  const headlineSize = component.headline.length > 54 ? 50 : component.headline.length > 42 ? 54 : 59;

  return (
    <AbsoluteFill style={{backgroundColor: '#11100d', overflow: 'hidden'}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <Img
          src={assetUrl(component.source)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: interpolate(frame, [0, duration - 1], [1, 1.018], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            filter: 'sepia(0.08) saturate(0.82) contrast(1.04) brightness(0.82)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(7, 8, 8, 0.38) 0%, rgba(7, 8, 8, 0.10) 55%, rgba(7, 8, 8, 0) 100%)'}} />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.56)'}} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: 170,
          opacity: Math.min(cardOpacity, exitOpacity),
        }}
      >
        <div
          style={{
            boxSizing: 'border-box',
            width: 460,
            padding: '24px 28px 27px',
            backgroundColor: '#eee9dc',
            border: '1px solid rgba(56, 48, 39, 0.22)',
            boxShadow: '18px 24px 42px rgba(0, 0, 0, 0.28)',
            translate: `${interpolate(frame, [0, 1.15 * fps], [-820, 0], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px 0px`,
          }}
        >
          <div
            style={{
              color: '#26231f',
              fontFamily: 'Georgia, Times New Roman, serif',
              fontSize: headlineSize,
              fontWeight: 700,
              lineHeight: 1.08,
            }}
          >
            {component.headline}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const P03PlacementStyle: Record<ComponentOf<'P03'>['placement'], React.CSSProperties> = {
  'bottom-left': {justifyContent: 'flex-end', alignItems: 'flex-start', paddingLeft: 138, paddingBottom: 150},
  'bottom-right': {justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 138, paddingBottom: 150},
  'top-left': {justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: 138, paddingTop: 150},
  'center-left': {justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 138},
};

const normalizeP03Word = (word: string) =>
  word.normalize('NFKC').replace(/[.,!?;:()[\]{}"'“”‘’]/g, '').toLocaleLowerCase();

/** P03 v2 — owner-approved whole-word highlight over one reviewed still. */
export const ApprovedWholeWordHighlight: React.FC<ComponentOf<'P03'>> = (component) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = localDuration(component);
  const words = component.headline.toLocaleUpperCase().split(/\s+/).filter(Boolean);
  const highlights = new Set(component.highlightWords.map(normalizeP03Word));
  const highlightedIndices = words
    .map((word, index) => highlights.has(normalizeP03Word(word)) ? index : -1)
    .filter((index) => index >= 0);
  const entrance = interpolate(frame, [0, .6 * fps], [0, 1], ease);
  const exit = interpolate(frame, [duration - .35 * fps, duration], [1, 0], clamp);
  const isRight = component.placement === 'bottom-right';

  return (
    <AbsoluteFill style={{backgroundColor: '#070807', overflow: 'hidden'}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <Img
          src={assetUrl(component.source)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: interpolate(frame, [0, duration - 1], [1, 1.09], {...clamp, easing: Easing.linear}),
            translate: `${interpolate(frame, [0, duration - 1], [0, -12], clamp)}px 0px`,
            filter: 'saturate(0.86) contrast(1.08) brightness(0.82)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 52% 46%, rgba(255, 246, 218, 0.08), rgba(0, 0, 0, 0.42) 72%)'}} />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.55)'}} />
      <AbsoluteFill
        style={{
          ...P03PlacementStyle[component.placement],
          opacity: Math.min(entrance, exit),
          translate: `0px ${interpolate(frame, [0, .7 * fps], [22, 0], ease)}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: isRight ? 'flex-end' : 'flex-start',
            maxWidth: 1120,
            columnGap: 22,
            rowGap: 8,
            color: '#f0eadb',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: .4,
            lineHeight: .98,
            textAlign: isRight ? 'right' : 'left',
            textTransform: 'uppercase',
            textShadow: '0 3px 18px rgba(0, 0, 0, 0.52)',
          }}
        >
          {words.map((word, index) => {
            const highlightRank = highlightedIndices.indexOf(index);
            const markerScale = highlightRank < 0 ? 0 : interpolate(
              frame,
              [(1 + highlightRank * .18) * fps, (1.48 + highlightRank * .18) * fps],
              [0, 1],
              ease,
            );
            return (
              <span key={`${word}-${index}`} style={{position: 'relative', display: 'inline-block'}}>
                {highlightRank >= 0 ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: -14,
                      top: '-0.06em',
                      width: 'calc(100% + 28px)',
                      height: '1.06em',
                      backgroundColor: 'rgba(191, 151, 73, 0.76)',
                      opacity: .95,
                      scale: `${markerScale} 1`,
                      transformOrigin: 'left center',
                      zIndex: 0,
                    }}
                  />
                ) : null}
                <span style={{position: 'relative', zIndex: 1}}>{word}</span>
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const P14_DIGIT_HEIGHT = 126;
const P14_DIGIT_STRIP = Array.from({length: 40}, (_, index) => index % 10);

const P14DigitColumn: React.FC<{
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
  const currentPosition = interpolate(progress, [0, 1], [target + 30, target + 10], clamp);

  return (
    <div
      style={{
        position: 'relative',
        width: 104,
        height: P14_DIGIT_HEIGHT,
        overflow: 'hidden',
        opacity,
        maskImage: 'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          translate: `0px ${-currentPosition * P14_DIGIT_HEIGHT}px`,
        }}
      >
        {P14_DIGIT_STRIP.map((value, stripIndex) => (
          <div
            key={`${index}-${stripIndex}`}
            style={{
              width: '100%',
              height: P14_DIGIT_HEIGHT,
              color: '#f0eadb',
              fontFamily: '"New York", Palatino, Georgia, "Times New Roman", serif',
              fontSize: 132,
              fontWeight: 700,
              lineHeight: `${P14_DIGIT_HEIGHT}px`,
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

/** P14 — owner-approved number-only year over one reviewed still. */
export const ApprovedNumberOnlyYear: React.FC<ComponentOf<'P14'>> = (component) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = localDuration(component);
  const blockProgress = interpolate(frame, [0.06 * fps, 0.78 * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit = interpolate(frame, [duration - 0.35 * fps, duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: '#090807', overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: exit, overflow: 'hidden'}}>
        <Img
          src={assetUrl(component.source)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            scale: interpolate(frame, [0, duration - 1], [1, 1.035], {...clamp, easing: Easing.linear}),
            translate: `${interpolate(frame, [0, duration - 1], [0, -10], clamp)}px ${interpolate(frame, [0, duration - 1], [0, -4], clamp)}px`,
            filter: 'sepia(0.08) saturate(0.82) contrast(1.05) brightness(0.72)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(90deg, rgba(8, 7, 6, 0.12) 0%, rgba(8, 7, 6, 0.02) 45%, rgba(8, 7, 6, 0.64) 100%), linear-gradient(180deg, rgba(8, 7, 6, 0.36) 0%, rgba(8, 7, 6, 0.04) 44%, rgba(8, 7, 6, 0.72) 100%)',
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
            height: P14_DIGIT_HEIGHT,
            overflow: 'hidden',
          }}
        >
          {component.year.split('').map((digit, index) => (
            <P14DigitColumn
              key={`${digit}-${index}`}
              digit={digit}
              index={index}
              opacity={Math.min(1, blockProgress * 1.45)}
            />
          ))}
        </div>
      </div>
      <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0, 0, 0, 0.42)', opacity: exit}} />
    </AbsoluteFill>
  );
};

export const ApprovedForceComparison: React.FC<ComponentOf<'WC01'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const enter = reveal(frame, 5, 22);
  const sides = [...component.forces].sort((a, b) => a.side === 'red' ? -1 : b.side === 'red' ? 1 : 0);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, color: C.paper, overflow: 'hidden'}}>
      {sides.map((force, index) => (
        <div key={force.forceId} style={{position: 'absolute', left: index * 960, top: 0, width: 960, height: 1080, overflow: 'hidden'}}>
          <Img src={assetUrl(force.identityAsset)} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(.6) sepia(.12) contrast(1.08) brightness(.66)', transform: `scale(${interpolate(frame, [0, duration], [1.06, 1], clamp)})`}} />
          <div style={{position: 'absolute', inset: 0, background: index === 0 ? 'linear-gradient(90deg, rgba(10,9,7,.12), rgba(10,9,7,.84))' : 'linear-gradient(90deg, rgba(10,9,7,.84), rgba(10,9,7,.12))'}} />
          <div style={{position: 'absolute', left: index === 0 ? 88 : 104, bottom: 96, width: 760, opacity: enter}}>
            <EditorialLabel color={force.side === 'red' ? C.red : C.blue}>{force.side.toUpperCase()} FORCE</EditorialLabel>
            <div style={{marginTop: 18, fontFamily: WC_EDITORIAL_SERIF, fontSize: 64, lineHeight: .96, fontWeight: 700}}>{force.label}</div>
          </div>
        </div>
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: 82, textAlign: 'center', opacity: enter}}>
        <EditorialLabel>{component.title.toUpperCase()}</EditorialLabel>
      </div>
      <div style={{position: 'absolute', left: 910, top: 480, width: 100, textAlign: 'center', fontFamily: WC_EDITORIAL_SERIF, fontSize: 70, fontWeight: 700, opacity: enter}}>VS</div>
    </AbsoluteFill>
  );
};

export const ApprovedProgression: React.FC<ComponentOf<'WC02'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  if (component.presentationVariant === 'anchored_progression_v2') {
    if (!component.anchorKind || !component.relationship || !component.relationshipLabel) {
      throw new Error('WC02 v2 anchor relationship is missing');
    }
    if (component.steps.some((step) => !step.title || !step.detail || !step.media)) {
      throw new Error('WC02 v2 progression item is incomplete');
    }
    const dockStartFrame = Math.min(48, Math.max(24, Math.floor(duration * 0.1)));
    const dockEndFrame = Math.min(dockStartFrame + 46, Math.floor(duration * 0.24));
    const closeStartFrame = duration - Math.min(60, Math.max(36, Math.floor(duration * 0.12)));
    const closeEndFrame = duration - 12;
    const itemStart = Math.max(dockEndFrame - 8, 1);
    const itemEnd = closeStartFrame + 8;
    const stride = (itemEnd - itemStart) / component.steps.length;
    const overlap = Math.min(30, Math.max(8, Math.floor(stride * 0.22)));
    const accents = ['#c89a4a', '#b44d3a', '#78969a', '#ad8a62', '#8a815f'];
    return (
      <AnchoredProgression
        relationship={component.relationship}
        anchorKind={component.anchorKind}
        anchorSide="left"
        anchorLabel={component.subjectRole.toUpperCase()}
        anchorTitle={component.subject}
        relationshipLabel={component.relationshipLabel}
        anchorCutoutSource={assetUrl(component.subjectCutout)}
        anchorBackgroundSource={assetUrl(component.subjectImage)}
        durationInFrames={duration}
        dockStartFrame={dockStartFrame}
        dockEndFrame={dockEndFrame}
        closeStartFrame={closeStartFrame}
        closeEndFrame={closeEndFrame}
        finalMessage={component.subject}
        finalDetail={component.relationshipLabel}
        showIndex
        items={component.steps.map((step, index) => ({
          id: step.stepId,
          label: step.label.toUpperCase(),
          title: step.title!,
          detail: step.detail!,
          imageSource: assetUrl(step.media!),
          accent: accents[index],
          startFrame: Math.floor(itemStart + stride * index),
          endFrame: Math.min(
            closeEndFrame,
            Math.ceil(itemStart + stride * (index + 1) + overlap),
          ),
        }))}
      />
    );
  }
  const phase = Math.min(2, Math.floor(frame / Math.max(1, duration / 3)));
  const enter = reveal(frame, 8, 24);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, color: C.paper, overflow: 'hidden'}}>
      <Img src={assetUrl(component.subjectImage)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(.75) sepia(.1) contrast(1.08) brightness(.58)', transform: `scale(${interpolate(frame, [0, duration], [1.055, 1], clamp)})`}} />
      <BackgroundWash />
      <div style={{position: 'absolute', left: 1040, bottom: -25, width: 690, height: 1020, opacity: enter, filter: 'drop-shadow(0 25px 18px rgba(0,0,0,.55))'}}>
        <Img src={assetUrl(component.subjectCutout)} style={{width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom'}} />
      </div>
      <div style={{position: 'absolute', left: 108, top: 170, width: 820, opacity: enter}}>
        <EditorialLabel>{component.subjectRole.toUpperCase()}</EditorialLabel>
        <div style={{marginTop: 20, fontFamily: WC_EDITORIAL_SERIF, fontSize: 88, fontWeight: 700, lineHeight: .92}}>{component.subject}</div>
        <div style={{marginTop: 84, minHeight: 180}}>
          <EditorialLabel color={C.dim}>PROGRESSION</EditorialLabel>
          <div style={{marginTop: 20, fontFamily: WC_EDITORIAL_SERIF, fontSize: 56, fontWeight: 700, lineHeight: 1.03}}>{component.steps[phase].label}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

type MapPoint = [number, number];

const mapPoint = (point: {x: number; y: number}): MapPoint => [point.x, point.y];

const piecePosition = (piece: EngravedPieceSpec, frame: number): MapPoint => {
  const amount = interpolate(frame, [piece.startFrame, piece.endFrameExclusive], [0, 1], ease);
  return [
    piece.start[0] + (piece.end[0] - piece.start[0]) * amount,
    piece.start[1] + (piece.end[1] - piece.start[1]) * amount,
  ];
};

const actorPiece = (
  component: ComponentOf<'WC04'>,
  actor: ComponentOf<'WC04'>['actors'][number],
  index: number,
): EngravedPieceSpec | null => {
  if (actor.side === 'neutral') return null;
  const movements = component.movementSteps.filter((step) => step.actorId === actor.actorId);
  const start = movements.length > 0 ? mapPoint(movements[0].from) : mapPoint(actor.position);
  const end = movements.length > 0 ? mapPoint(movements[movements.length - 1].to) : mapPoint(actor.position);
  const duration = localDuration(component);
  const startFrame = Math.min(10 + index * 8, Math.max(0, duration - 2));
  const pieceType: EngravedPieceSpec['pieceType'] = movements.length > 0 ? 'knight' : 'pawn';
  return {
    id: `actor-${actor.actorId}`,
    side: actor.side === 'blue' ? 'white' : 'black',
    // RenderComponent records movement, not unit type.  The approved moving/
    // stationary silhouette treatment is presentation-only and adds no fact.
    pieceType,
    start,
    end,
    startFrame,
    endFrameExclusive: Math.max(startFrame + 1, Math.min(duration, duration - 12)),
    scale: WC04_ADAPTIVE_STYLE.pieceScale[pieceType],
  };
};

const actorArrow = (
  component: ComponentOf<'WC04'>,
  step: ComponentOf<'WC04'>['movementSteps'][number],
  index: number,
): TacticalArrowSpec | null => {
  const actor = component.actors.find((candidate) => candidate.actorId === step.actorId);
  if (!actor || actor.side === 'neutral') return null;
  const duration = localDuration(component);
  const drawStartFrame = Math.min(22 + index * 20, Math.max(0, duration - 2));
  return {
    id: step.movementId,
    profile: 'movement_flank',
    palette: actor?.side === 'blue' ? 'blue' : 'red',
    start: mapPoint(step.from),
    end: mapPoint(step.to),
    shaftWidth: 14,
    headLength: 34,
    headWidth: 34,
    headStyle: 'softened',
    shaftCap: 'round',
    drawStartFrame,
    drawEndFrameExclusive: Math.max(drawStartFrame + 1, Math.min(duration, drawStartFrame + 46)),
    connected: true,
    shaftEnd: mapPoint(step.to),
    headBase: mapPoint(step.to),
  };
};

export const ApprovedTacticalMap: React.FC<ComponentOf<'WC04'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const enter = reveal(frame, 5, 20);
  const pieces = component.actors
    .map((actor, index) => actorPiece(component, actor, index))
    .filter((piece): piece is EngravedPieceSpec => piece !== null);
  const arrows = component.movementSteps
    .map((step, index) => actorArrow(component, step, index))
    .filter((arrow): arrow is TacticalArrowSpec => arrow !== null);
  const leftLabels = component.actors.filter((actor) => actor.side === 'red').map((actor) => actor.label).join(' · ');
  const rightLabels = component.actors.filter((actor) => actor.side === 'blue').map((actor) => actor.label).join(' · ');
  const contextLabel = component.movementSteps.at(-1)?.label
    ?? (component.ranks.length > 0 ? component.ranks.map((rank) => rank.label).join(' · ') : component.plate.label);
  const titleSize = component.title.length > 48 ? 48 : 62;
  return (
    <AbsoluteFill style={{backgroundColor: '#242220', color: '#F6F1E8', overflow: 'hidden'}} data-wc04-mode={component.mode}>
      <Img src={assetUrl(component.plate.source)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: STRONG_GREY_MAP_TREATMENT.filter}} />
      <AbsoluteFill style={{backgroundColor: STRONG_GREY_MAP_TREATMENT.veil, zIndex: 1}} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(9,9,8,.68), rgba(9,9,8,.08) 58%, rgba(9,9,8,.4)), linear-gradient(0deg, rgba(9,9,8,.48), rgba(9,9,8,0) 42%)', zIndex: 2}} />
      <div style={{position: 'absolute', inset: 0, zIndex: 3, opacity: enter, pointerEvents: 'none'}}>
        <div style={{position: 'absolute', left: 72, top: 60, maxWidth: 820, padding: '16px 24px 18px', backgroundColor: 'rgba(18,18,18,.84)', borderLeft: '6px solid #D7B275', boxShadow: '0 12px 28px rgba(0,0,0,.24)'}}>
          <EditorialLabel>{component.mode.replaceAll('_', ' ').toUpperCase()}</EditorialLabel>
          <div style={{marginTop: 16, fontFamily: WC_EDITORIAL_SERIF, fontSize: titleSize, lineHeight: .98, fontWeight: 700}}>{component.title}</div>
        </div>
        {leftLabels && <div style={{position: 'absolute', left: 72, bottom: 62, maxWidth: 620, padding: '10px 16px 9px', backgroundColor: 'rgba(18,18,18,.84)', borderLeft: `4px solid ${C.red}`, fontFamily: WC_EDITORIAL_SANS, fontSize: 18, fontWeight: 800, letterSpacing: 2.2}}>{leftLabels}</div>}
        {rightLabels && <div style={{position: 'absolute', right: 72, bottom: 62, maxWidth: 620, padding: '10px 16px 9px', backgroundColor: 'rgba(18,18,18,.84)', borderRight: `4px solid ${C.blue}`, fontFamily: WC_EDITORIAL_SANS, fontSize: 18, fontWeight: 800, letterSpacing: 2.2, textAlign: 'right'}}>{rightLabels}</div>}
        <div style={{position: 'absolute', left: 72, right: 72, bottom: 24, color: '#d9d0bd', fontFamily: WC_EDITORIAL_SANS, fontSize: 14, fontWeight: 700, letterSpacing: 1.8, textAlign: 'center'}}>{contextLabel}</div>
        <div style={{position: 'absolute', right: 72, top: 72, color: '#d9d0bd', fontFamily: WC_EDITORIAL_SANS, fontSize: 13, fontWeight: 700, letterSpacing: 2.2, textAlign: 'right'}}>{component.plate.label}</div>
      </div>
      <div style={{position: 'absolute', inset: 0, zIndex: 4}}>{arrows.map((arrow) => <WarChessTacticalArrow key={arrow.id} arrow={arrow} treatment="wc04_premium" />)}</div>
      <div style={{position: 'absolute', inset: 0, zIndex: 5}}>{pieces.map((piece) => <WarChessEngravedPiece key={piece.id} piece={piece} position={piecePosition(piece, frame)} />)}</div>
    </AbsoluteFill>
  );
};

export const ApprovedChessAnalogy: React.FC<ComponentOf<'WC06'>> = (component) => {
  const plan = component.chessPlan;
  const scenario = (() => {
    const chess = new Chess(plan.fen);
    const moves = plan.moves.map((move) => {
      const promotion = move.uci.slice(4) as 'q' | 'r' | 'b' | 'n' | '';
      const legal = chess.move({
        from: move.uci.slice(0, 2) as Square,
        to: move.uci.slice(2, 4) as Square,
        ...(promotion ? {promotion} : {}),
      });
      return {
        uci: move.uci,
        expected_san: legal.san,
        story_label: move.caption,
      };
    });
    return {
      schema_version: 'warboard-scenario.v1' as const,
      foundation_lock: 'warboard.visual-foundation.v1' as const,
      scenario_id: `wc06_${plan.motifId}`,
      historical_context: 'Engine-verified chess analogy.',
      tactical_message: 'A locked line selected from the admitted motif library.',
      white_represents: 'WHITE',
      black_represents: 'BLACK',
      starting_fen: plan.fen,
      moves,
      final_label: moves.at(-1)?.story_label ?? 'Locked line',
      palette_accent: '#c69346',
    };
  })();
  const labels: WC06PremiumMinimalReviewLabels = {
    title: component.title,
    stages: plan.moves.map((move) => move.caption),
    engineLabel: `${plan.engine.name} ${plan.engine.version} · depth ${plan.engine.settings.depth}`,
  };
  return <WC06PremiumMinimalReview scenario={scenario} labels={labels} durationInFrames={localDuration(component)} />;
};

export const ApprovedThreeUp: React.FC<ComponentOf<'WC07'>> = (component) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, color: C.paper, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 76, top: 68, zIndex: 3}}><EditorialLabel>{component.title.toUpperCase()}</EditorialLabel></div>
      {component.subjects.map((subject, index) => (
        <div key={subject.subjectId} style={{position: 'absolute', left: index * 640, top: 0, width: 640, height: 1080, overflow: 'hidden', opacity: reveal(frame, 6 + index * 12, 20)}}>
          <Img src={assetUrl(subject.subjectAsset)} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(.72) sepia(.12) contrast(1.08) brightness(.72)', transform: `scale(${interpolate(frame, [0, localDuration(component)], [1.05, 1], clamp)})`}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(9,9,7,.94), rgba(9,9,7,.05) 56%)'}} />
          <div style={{position: 'absolute', left: 54, right: 48, bottom: 78, fontFamily: WC_EDITORIAL_SERIF, fontSize: 48, lineHeight: .98, fontWeight: 700}}>{subject.label}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const ApprovedIdentityPlace: React.FC<ComponentOf<'WC08'>> = (component) => {
  const frame = useCurrentFrame();
  const amount = Math.min(reveal(frame, 10, 20), interpolate(frame, [localDuration(component) - 18, localDuration(component) - 1], [1, 0], clamp));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 94, bottom: 82, width: 770, paddingTop: 34, opacity: amount, transform: `translateY(${interpolate(amount, [0, 1], [24, 0], clamp)}px)`, color: C.paper, textShadow: '0 3px 18px rgba(0,0,0,.85)'}}>
        <div style={{fontFamily: "Optima, Candara, 'Segoe UI', sans-serif", fontSize: 64, fontWeight: 600, letterSpacing: .1, lineHeight: .96}}>{component.identity}</div>
        <div style={{marginTop: 12, fontFamily: "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif", color: '#c8bea9', fontSize: 24, fontWeight: 600, letterSpacing: 1.1, lineHeight: 1}}>{component.place}</div>
      </div>
    </AbsoluteFill>
  );
};

export const ApprovedStatistic: React.FC<ComponentOf<'WC09'>> = (component) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = localDuration(component);
  const amount = Math.min(reveal(frame, 12, 22), interpolate(frame, [duration - 20, duration - 1], [1, 0], clamp));
  const slideStart = 12;
  const slide = interpolate(frame, [slideStart, slideStart + Math.max(1, Math.round(fps * .8))], [-180, 0], {
    ...clamp,
    easing: Easing.linear,
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none', color: C.paper}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,8,7,.9) 0%, rgba(8,8,7,.64) 36%, rgba(8,8,7,0) 70%)', opacity: amount}} />
      <div style={{position: 'absolute', left: 108, top: 231, width: 830, opacity: amount, translate: `${slide}px 0`}}>
        <div style={{fontFamily: WC_EDITORIAL_SERIF, fontSize: 170, fontWeight: 700, letterSpacing: -4, lineHeight: .86}}>{component.value}</div>
        <div style={{marginTop: 14, fontFamily: WC_EDITORIAL_SERIF, fontSize: 72, fontWeight: 700, lineHeight: .95}}>{component.unit.toUpperCase()}</div>
      </div>
    </AbsoluteFill>
  );
};

export const ApprovedDecisionFork: React.FC<ComponentOf<'WC10'>> = (component) => {
  return <CartographicDecisionFork
    title={component.title}
    options={component.options}
    chosenOptionId={component.chosenOptionId}
    chosenRevealFrame={component.chosenRevealFrame}
    durationInFrames={localDuration(component)}
  />;
};

export const ApprovedChronology: React.FC<ComponentOf<'WC11'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const count = component.events.length;
  const segment = duration / (count + 1);
  const cueFrames = component.eventStartFrames;
  const state = chronologyCueState(frame, duration, count, cueFrames);
  const overview = state === count;
  const active = Math.max(0, Math.min(count - 1, state));
  const lineProgress = interpolate(frame, cueFrames ?? [Math.max(1, duration * .025), Math.max(2, segment * count * .86)], cueFrames ? cueFrames.map((_, index) => index / (count - 1)) : [0, 1], {
    ...clamp,
    easing: Easing.linear,
  });
  const positions = component.events.map((_, index) => 150 + index * (1620 / (count - 1)));
  const labelWidth = Math.min(360, 1580 / count);
  const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
  const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
  const oxblood = '#87372f';
  const ivory = '#f1e7d3';
  const titleSize = component.title.length > 70 ? 48 : component.title.length > 42 ? 58 : 76;
  const activeLabel = component.events[active].label;
  const activeSize = activeLabel.length > 80 ? 38 : activeLabel.length > 48 ? 48 : 68;
  return (
    <AbsoluteFill style={{overflow: 'hidden', color: ivory}}>
      <AbsoluteFill style={{backdropFilter: 'blur(13.8px)', WebkitBackdropFilter: 'blur(13.8px)', backgroundColor: 'rgba(0,0,0,0.001)'}} />
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id="wc11-production-grid" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M96 0H0V96" fill="none" stroke="#d9cdb8" strokeWidth="1" opacity=".1"/></pattern>
          <pattern id="wc11-production-grain" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="#2b211b" opacity=".09"/><circle cx="10" cy="8" r=".5" fill="#fffaf0" opacity=".2"/></pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#wc11-production-grid)"/>
        <rect width="1920" height="1080" fill="url(#wc11-production-grain)"/>
        <g stroke="#d9cdb8" strokeWidth="1" opacity=".18"><path d="M96 166H1824"/><path d="M96 914H1824"/></g>
        <path d="M150 650 H1770" fill="none" stroke="#d9cdb8" strokeWidth="2"/>
        <path d="M150 650 H1770" pathLength="1" fill="none" stroke={oxblood} strokeWidth="3" strokeLinecap="butt" strokeDasharray="1" strokeDashoffset={1 - lineProgress}/>
        {component.events.map((event, index) => {
          const amount = interpolate(frame, cueFrames ? [cueFrames[index], cueFrames[index] + Math.max(1, Math.min(12, (cueFrames[index + 1] ?? duration) - cueFrames[index]))] : [index * segment + segment * .1, index * segment + segment * .34], [0, 1], clamp);
          const current = !overview && index === active;
          const visible = state >= 0 && (index <= active || overview);
          const radius = current ? 16 : 10;
          return <g key={event.eventId} opacity={visible ? amount : 0}><circle cx={positions[index]} cy="650" r={radius + 7} fill="#e7decb" stroke="#000000" strokeWidth="1"/><circle cx={positions[index]} cy="650" r={radius} fill={current ? oxblood : '#e7decb'} stroke={oxblood} strokeWidth={current ? 2 : 3}/></g>;
        })}
      </svg>
      <div style={{position: 'absolute', left: 96, top: 62, fontFamily: sans, fontSize: 18, fontWeight: 600, letterSpacing: 4.4, color: oxblood, WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>CHRONOLOGY</div>
      <div style={{position: 'absolute', left: 96, top: 102, width: 1450, maxHeight: 150, overflow: 'hidden', fontFamily: serif, fontSize: titleSize, fontWeight: 600, lineHeight: .96, letterSpacing: -.4, WebkitTextStroke: '4px #000000', paintOrder: 'stroke fill'}}>{component.title}</div>
      {state < 0 ? null : !overview ? <div style={{position: 'absolute', left: 96, right: 96, top: 282, height: 184, textAlign: 'center'}}>
        <div style={{fontFamily: sans, fontSize: 20, fontWeight: 600, letterSpacing: 4, color: oxblood, WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>{component.events[active].dateLabel}</div>
        <div style={{marginTop: 18, fontFamily: serif, fontSize: activeSize, fontWeight: 600, lineHeight: .98, WebkitTextStroke: '4px #000000', paintOrder: 'stroke fill'}}>{activeLabel}</div>
      </div> : <div style={{position: 'absolute', left: 96, right: 96, top: 316, textAlign: 'center', fontFamily: sans, fontSize: 18, fontWeight: 600, letterSpacing: 4, color: oxblood, WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>COMPLETE OVERVIEW</div>}
      {component.events.map((event, index) => {
        const amount = interpolate(frame, cueFrames ? [cueFrames[index], cueFrames[index] + Math.max(1, Math.min(12, (cueFrames[index + 1] ?? duration) - cueFrames[index]))] : [index * segment + segment * .1, index * segment + segment * .34], [0, 1], clamp);
        const current = !overview && index === active;
        const visible = state >= 0 && (index <= active || overview);
        const eventSize = event.label.length > 80 ? 18 : event.label.length > 48 ? 21 : count >= 5 ? 24 : current ? 34 : 29;
        return <div key={event.eventId} style={{position: 'absolute', left: positions[index] - labelWidth / 2, top: 701, width: labelWidth, textAlign: 'center', opacity: visible ? amount : 0}}>
          <div style={{fontFamily: sans, fontSize: 17, fontWeight: 600, letterSpacing: 2.2, color: current ? oxblood : '#eadfcb', WebkitTextStroke: '2px #000000', paintOrder: 'stroke fill'}}>{event.dateLabel}</div>
          <div style={{marginTop: 12, fontFamily: serif, fontSize: eventSize, fontWeight: current ? 600 : 500, lineHeight: 1.05, color: ivory, WebkitTextStroke: '3px #000000', paintOrder: 'stroke fill'}}>{event.label}</div>
        </div>;
      })}
    </AbsoluteFill>
  );
};

export const ApprovedNamedPerson: React.FC<ComponentOf<'WC12'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
  const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
  const premiumEase = Easing.bezier(0.16, 1, 0.3, 1);
  const subjectEnterStart = Math.round(duration * .04);
  const subjectEnterEnd = Math.round(duration * .24);
  const exitStart = Math.round(duration * .84);
  const copyEnterStart = Math.round(duration * .1);
  const copyEnterEnd = Math.round(duration * .3);
  const overlayOpacity = interpolate(frame, [0, Math.max(1, Math.round(duration * .1)), exitStart, duration - 1], [0, 1, 1, 0], clamp);
  const subjectY = interpolate(frame, [subjectEnterStart, subjectEnterEnd], [180, 0], {...clamp, easing: premiumEase})
    + interpolate(frame, [exitStart, duration - 1], [0, 1100], {...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0)});
  const copyX = interpolate(frame, [copyEnterStart, copyEnterEnd], [-128, 0], {...clamp, easing: premiumEase});
  const words = component.namedPerson.trim().split(/\s+/);
  let splitAt = 0;
  if (words.length > 1) {
    splitAt = 1;
    let bestDifference = Number.POSITIVE_INFINITY;
    for (let index = 1; index < words.length; index += 1) {
      const difference = Math.abs(words.slice(0, index).join(' ').length - words.slice(index).join(' ').length);
      if (difference < bestDifference) {
        splitAt = index;
        bestDifference = difference;
      }
    }
  }
  const balancedName = splitAt > 0
    ? `${words.slice(0, splitAt).join(' ')}\n${words.slice(splitAt).join(' ')}`
    : component.namedPerson;
  const longestNameLine = Math.max(...balancedName.split('\n').map((line) => line.length));
  const nameSize = longestNameLine > 34 ? 68 : longestNameLine > 26 ? 78 : longestNameLine > 20 ? 90 : 104;
  const roleSize = component.role.length > 78 ? 22 : component.role.length > 52 ? 25 : 30;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,8,7,.82) 0%, rgba(10,8,7,.62) 36%, rgba(10,8,7,.18) 64%, rgba(10,8,7,0) 83%)', opacity: overlayOpacity}} />
      <div style={{position: 'absolute', right: 210, bottom: -18, width: 410, height: 970, translate: `0 ${subjectY}px`, opacity: overlayOpacity, filter: 'drop-shadow(-18px 20px 22px rgba(0,0,0,.32))'}}><Img src={assetUrl(component.cutout)} style={{width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom'}} /></div>
      <div style={{position: 'absolute', left: 130, top: 240, width: 870, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', translate: `${copyX}px 0`, opacity: overlayOpacity}}>
        <div style={{fontFamily: sans, fontSize: 18, fontWeight: 700, letterSpacing: 5.2, color: '#a74a3e', WebkitTextStroke: '.45px #000000', paintOrder: 'stroke fill'}}>NAMED PERSON</div>
        <div style={{marginTop: 24, whiteSpace: 'pre-line', fontFamily: serif, fontSize: nameSize, lineHeight: .9, fontWeight: 600, letterSpacing: -1.7, color: '#f1e7d3', WebkitTextStroke: '1px #000000', paintOrder: 'stroke fill'}}>{balancedName}</div>
        <div style={{marginTop: 30, fontFamily: sans, fontSize: roleSize, lineHeight: 1, fontWeight: 500, letterSpacing: 1.25, color: '#e3d8c4', WebkitTextStroke: '.6px #000000', paintOrder: 'stroke fill'}}>{component.role}</div>
      </div>
    </AbsoluteFill>
  );
};

export const ApprovedDocumentEvidenceReveal: React.FC<ComponentOf<'WC13'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
  const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
  const premiumEase = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};
  const establish = interpolate(frame, [Math.round(duration * .02), Math.round(duration * .13)], [0, 1], premiumEase);
  const transition = interpolate(frame, [Math.round(duration * .29), Math.round(duration * .47)], [0, 1], premiumEase);
  const detail = interpolate(frame, [Math.round(duration * .4), Math.round(duration * .55)], [0, 1], premiumEase);
  const fade = interpolate(frame, [0, Math.max(1, Math.round(duration * .045)), Math.round(duration * .89), duration - 1], [0, 1, 1, 0], clamp);
  const documentLeft = interpolate(transition, [0, 1], [680, 170], clamp);
  const documentTop = interpolate(transition, [0, 1], [105, 175], clamp);
  const documentWidth = interpolate(transition, [0, 1], [560, 480], clamp);
  const documentHeight = documentWidth * (1636 / 1280);
  const documentLabelSize = component.documentLabel.length > 72 ? 14 : component.documentLabel.length > 44 ? 16 : 18;
  const titleSize = component.title.length > 72 ? 48 : component.title.length > 44 ? 58 : 68;
  const detailLabelSize = component.detailLabel.length > 72 ? 22 : component.detailLabel.length > 44 ? 26 : 30;
  const dateSize = component.dateLabel.length > 56 ? 17 : component.dateLabel.length > 34 ? 19 : 22;

  return (
    <AbsoluteFill style={{backgroundColor: '#12100e', color: '#eee3cf', overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: fade}}>
      <AbsoluteFill style={{background: 'linear-gradient(135deg, #181512 0%, #0d0c0b 72%, #18130f 100%)'}} />
      <div style={{position: 'absolute', left: documentLeft, top: documentTop, width: documentWidth, height: documentHeight, opacity: establish, scale: interpolate(establish, [0, 1], [.975, 1], clamp), boxShadow: '0 28px 70px rgba(0,0,0,.48)'}}>
        <Img src={assetUrl(component.document)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        <div style={{position: 'absolute', left: '17%', top: '31%', width: '66%', height: '34%', border: '2px solid #a95848', boxSizing: 'border-box', opacity: detail}} />
      </div>
      <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, width: 1920, height: 1080, opacity: detail}}><path d="M 568 508 C 760 508, 854 322, 1012 322" fill="none" stroke="#a95848" strokeWidth="1.5" opacity=".72" /></svg>
      <div style={{position: 'absolute', left: 1012, top: 96, width: 760, height: 470, overflow: 'hidden', border: '1.5px solid rgba(223,202,164,.72)', backgroundColor: '#d9c7a8', boxShadow: '0 24px 60px rgba(0,0,0,.4)', opacity: detail, translate: `${interpolate(detail, [0, 1], [36, 0], clamp)}px 0`}}>
        <Img src={assetUrl(component.detail)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%'}} />
      </div>
      <div style={{position: 'absolute', left: 1012, top: 630, width: 760, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: detail, translate: `${interpolate(detail, [0, 1], [44, 0], clamp)}px 0`}}>
        <div style={{maxWidth: 760, overflowWrap: 'anywhere', fontFamily: sans, fontSize: documentLabelSize, lineHeight: 1.05, fontWeight: 700, letterSpacing: 4.8, color: '#a95848'}}>{component.documentLabel}</div>
        <div style={{marginTop: 20, maxWidth: 760, overflowWrap: 'anywhere', fontFamily: serif, fontSize: titleSize, lineHeight: .98, fontWeight: 600, letterSpacing: -.8}}>{component.title}</div>
        <div style={{marginTop: 22, maxWidth: 760, overflowWrap: 'anywhere', fontFamily: sans, fontSize: detailLabelSize, lineHeight: 1.15, fontWeight: 500, color: '#d9cdb9'}}>{component.detailLabel}</div>
        <div style={{marginTop: 14, maxWidth: 760, overflowWrap: 'anywhere', fontFamily: sans, fontSize: dateSize, lineHeight: 1.05, fontWeight: 500, letterSpacing: 1.3, color: '#aa9d89'}}>{component.dateLabel}</div>
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ApprovedArchivalDetailSequence: React.FC<ComponentOf<'WC14'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
  const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
  const premiumEase = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};
  const establish = interpolate(frame, [Math.round(duration * .02), Math.round(duration * .12)], [0, 1], premiumEase);
  const arrange = interpolate(frame, [Math.round(duration * .21), Math.round(duration * .35)], [0, 1], premiumEase);
  const title = interpolate(frame, [Math.round(duration * .58), Math.round(duration * .71)], [0, 1], premiumEase);
  const fade = interpolate(frame, [0, Math.max(1, Math.round(duration * .045)), Math.round(duration * .89), duration - 1], [0, 1, 1, 0], clamp);
  const gap = component.details.length === 4 ? 22 : 34;
  const totalWidth = component.details.length === 2 ? 1320 : 1696;
  const left = (1920 - totalWidth) / 2;
  const cardWidth = (totalWidth - gap * (component.details.length - 1)) / component.details.length;
  const titleSize = component.sourceTitle.length > 80 ? 40 : component.sourceTitle.length > 56 ? 46 : component.sourceTitle.length > 34 ? 54 : 64;
  const sourceLabelSize = component.sourceLabel.length > 72 ? 17 : component.sourceLabel.length > 44 ? 21 : 26;

  return (
    <AbsoluteFill style={{overflow: 'hidden', color: '#eee3cf', backgroundColor: '#100e0c'}}>
      <AbsoluteFill style={{opacity: fade}}>
      <Img src={assetUrl(component.source)} style={{position: 'absolute', inset: -24, width: 1968, height: 1128, objectFit: 'cover', objectPosition: '50% 33%', scale: interpolate(frame, [Math.round(duration * .21), duration - 1], [1.02, 1.055], clamp), filter: 'blur(9px) brightness(.46)', opacity: arrange}} />
      <AbsoluteFill style={{backgroundColor: 'rgba(12,10,9,.2)', opacity: arrange}} />
      <div style={{position: 'absolute', left: 620, top: 70, width: 680, height: 855, opacity: establish * (1 - arrange), scale: interpolate(establish, [0, 1], [.98, 1], clamp), boxShadow: '0 32px 80px rgba(0,0,0,.5)'}}>
        <Img src={assetUrl(component.source)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      {component.details.map((detailRow, index) => {
        const from = Math.round(duration * (.31 + index * .145));
        const amount = interpolate(frame, [from, from + Math.max(16, Math.round(duration * .12))], [0, 1], premiumEase);
        const labelSize = detailRow.label.length > 60 ? 13 : detailRow.label.length > 38 ? 15 : 18;
        const labelSpacing = detailRow.label.length > 38 ? 2.5 : 4.4;
        return (
          <div key={detailRow.detailId} style={{position: 'absolute', left: left + index * (cardWidth + gap), top: 150, width: cardWidth, height: 625, overflow: 'hidden', opacity: amount, translate: `0 ${interpolate(amount, [0, 1], [34, 0], clamp)}px`, border: '1px solid rgba(224,207,177,.58)', boxShadow: '0 24px 55px rgba(0,0,0,.42)', backgroundColor: '#17120f'}}>
            <Img src={assetUrl(detailRow.source)} style={{width: '100%', height: '100%', objectFit: 'cover', scale: interpolate(frame, [from, duration - 1], [1.025, 1], clamp)}} />
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, background: 'linear-gradient(0deg, rgba(8,7,6,.92), rgba(8,7,6,0))'}} />
            <div style={{position: 'absolute', left: 28, right: 28, bottom: 24, overflowWrap: 'anywhere', fontFamily: sans, fontSize: labelSize, lineHeight: 1.08, fontWeight: 700, letterSpacing: labelSpacing, color: '#d2b175', textTransform: 'uppercase'}}>{detailRow.label}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 112, right: 112, top: 832, opacity: title, translate: `0 ${interpolate(title, [0, 1], [26, 0], clamp)}px`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 48}}>
        <div style={{maxWidth: 1080, overflowWrap: 'anywhere', fontFamily: serif, fontSize: titleSize, lineHeight: 1, fontWeight: 600, letterSpacing: -.7}}>{component.sourceTitle}</div>
        <div style={{maxWidth: 620, overflowWrap: 'anywhere', fontFamily: sans, fontSize: sourceLabelSize, lineHeight: 1.08, fontWeight: 500, letterSpacing: 1.1, color: '#b8aa96', textAlign: 'right'}}>{component.sourceLabel}</div>
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ApprovedTwoSourceContrast: React.FC<ComponentOf<'WC15'>> = (component) => {
  const frame = useCurrentFrame();
  const duration = localDuration(component);
  const [leftSource, rightSource] = component.sources;
  const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
  const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";
  const premiumEase = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};
  const establish = interpolate(frame, [Math.round(duration * .02), Math.round(duration * .12)], [0, 1], premiumEase);
  const compare = interpolate(frame, [Math.round(duration * .24), Math.round(duration * .41)], [0, 1], premiumEase);
  const rightReveal = interpolate(frame, [Math.round(duration * .39), Math.round(duration * .54)], [0, 1], premiumEase);
  const contentFade = interpolate(frame, [0, Math.max(7, Math.round(duration * .045)), Math.max(8, Math.round(duration * .89)), duration - 1], [0, 1, 1, 0], clamp);
  const panelTop = 224;
  const panelWidth = 812;
  const panelHeight = 674;
  const relationshipSize = component.relationshipLabel.length > 62 ? 48 : component.relationshipLabel.length > 42 ? 57 : 68;
  const sourceKindLabels: Record<typeof leftSource.sourceKind, string> = {
    primary_document: 'Primary document',
    painting: 'Painting',
    photograph: 'Photograph',
    map: 'Map',
    film_frame: 'Film frame',
    artifact: 'Artifact',
  };
  const sourceCopy = (source: typeof leftSource) => {
    const labelSize = source.label.length > 72 ? 14 : source.label.length > 48 ? 16 : 19;
    const dateSize = source.dateLabel.length > 52 ? 28 : source.dateLabel.length > 30 ? 34 : 43;
    return (
      <div style={{position: 'absolute', left: 34, right: 34, bottom: 28, color: '#f0e5d2'}}>
        <div style={{maxWidth: '100%', overflowWrap: 'anywhere', fontFamily: sans, fontSize: labelSize, lineHeight: 1.08, fontWeight: 700, letterSpacing: labelSize > 16 ? 4.2 : 2.5, color: '#cfaa72', textTransform: 'uppercase'}}>{source.label}</div>
        <div style={{display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px 18px', marginTop: 9}}>
          <div style={{maxWidth: 520, overflowWrap: 'anywhere', fontFamily: serif, fontSize: dateSize, lineHeight: 1, fontWeight: 600}}>{source.dateLabel}</div>
          <div style={{fontFamily: sans, fontSize: 23, lineHeight: 1, fontWeight: 500, letterSpacing: .8, color: '#beb1a0'}}>{sourceKindLabels[source.sourceKind]}</div>
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#100e0d'}}>
      <AbsoluteFill style={{opacity: contentFade, color: '#f0e5d2'}}>
        <div style={{position: 'absolute', left: 960, top: 94, width: 1500, translate: '-50% 0', opacity: compare, textAlign: 'center', overflowWrap: 'anywhere', fontFamily: serif, fontSize: relationshipSize, lineHeight: 1, fontWeight: 600, letterSpacing: -.5}}>{component.relationshipLabel}</div>
        <div style={{position: 'absolute', left: interpolate(compare, [0, 1], [650, 112], clamp), top: interpolate(compare, [0, 1], [90, panelTop], clamp), width: interpolate(compare, [0, 1], [620, panelWidth], clamp), height: interpolate(compare, [0, 1], [792, panelHeight], clamp), opacity: establish, overflow: 'hidden', backgroundColor: '#181411', border: '1px solid rgba(211,188,151,.38)', boxShadow: '0 28px 70px rgba(0,0,0,.46)'}}>
          <Img src={assetUrl(leftSource.source)} style={{width: '100%', height: '100%', objectFit: 'contain', padding: compare * 22, boxSizing: 'border-box'}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, opacity: compare, background: 'linear-gradient(0deg, rgba(10,8,7,.98) 0%, rgba(10,8,7,.72) 58%, rgba(10,8,7,0) 100%)'}} />
          <div style={{opacity: compare}}>{sourceCopy(leftSource)}</div>
        </div>
        <div style={{position: 'absolute', left: 996, top: panelTop, width: panelWidth, height: panelHeight, opacity: rightReveal, translate: `${interpolate(rightReveal, [0, 1], [42, 0], clamp)}px 0`, overflow: 'hidden', backgroundColor: '#181411', border: '1px solid rgba(211,188,151,.38)', boxShadow: '0 28px 70px rgba(0,0,0,.46)'}}>
          <Img src={assetUrl(rightSource.source)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${interpolate(frame, [Math.round(duration * .39), Math.round(duration * .89)], [50, 54], clamp)}% 49%`, scale: interpolate(frame, [Math.round(duration * .39), Math.round(duration * .89)], [1.02, 1.055], clamp)}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, background: 'linear-gradient(0deg, rgba(10,8,7,.98) 0%, rgba(10,8,7,.72) 58%, rgba(10,8,7,0) 100%)'}} />
          {sourceCopy(rightSource)}
        </div>
        <div style={{position: 'absolute', left: 958, top: panelTop + 18, width: 1, height: panelHeight - 36, opacity: compare * rightReveal, backgroundColor: 'rgba(199,166,117,.44)'}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
