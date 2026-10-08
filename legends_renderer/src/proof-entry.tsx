import React, {useEffect} from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame, useVideoConfig} from 'remotion';
import {filmBurn} from './film-burn.tsx';
import {dropHeadline} from './drop-headline.tsx';
import {yearDrop} from './year-drop.tsx';
import {redWash} from './red-wash.tsx';
import {impactWord} from './impact-word.tsx';
import {portraitName} from './portrait-name.tsx';
import {cornerDate} from './corner-date.tsx';
import {typedLabel} from './typed-label.tsx';
import {dateHighlight} from './date-highlight.tsx';
import {insetPortrait} from './inset-portrait.tsx';
import {redDossier} from './red-dossier.tsx';
import {panSentence} from './pan-sentence.tsx';
import {boxedTitle} from './boxed-title.tsx';
import {paperLabel} from './paper-label.tsx';
import {kickerPayoff} from './kicker-payoff.tsx';
import {insetClip} from './inset-clip.tsx';
import {evidenceCallout} from './evidence-callout.tsx';
import {doublePortrait} from './double-portrait.tsx';
import {numberTag} from './number-tag.tsx';
import {statPill} from './stat-pill.tsx';
import {phraseBoxes} from './phrase-boxes.tsx';
import {portraitQuote} from './portrait-quote.tsx';
import {blurFill} from './blur-fill.tsx';
import {gridFlash} from './grid-flash.tsx';
import {evidenceLeaders} from './evidence-leaders.tsx';
import {measureRadar} from './measure-radar.tsx';
import {mapCircle} from './map-circle.tsx';
import {barChart} from './bar-chart.tsx';
import {linePlot} from './line-plot.tsx';
import {sharePie} from './share-pie.tsx';
import {waveTimeline} from './wave-timeline.tsx';
import {spanTimeline} from './span-timeline.tsx';
import {worldTourMap} from './world-tour-map.tsx';
import {routeMap} from './route-map.tsx';
import {countryFlagsMap} from './country-flags-map.tsx';
import {loadDocumentaryFonts, loadStageFonts} from './fonts.ts';
import {partCallouts} from './part-callouts.tsx';
import {percentGauge} from './percent-gauge.tsx';
import {skins, type Skin} from './skins.ts';
import {wordReveal} from './word-reveal.tsx';
/** Side-by-side proof renders: any ported edit, any skin, caller-supplied props and duration (scripts/side-by-side.mjs). */
const components = {'bar-chart': barChart, 'line-plot': linePlot, 'share-pie': sharePie, 'wave-timeline': waveTimeline, 'span-timeline': spanTimeline, 'world-tour-map': worldTourMap, 'route-map': routeMap, 'country-flags-map': countryFlagsMap, 'map-circle': mapCircle, 'measure-radar': measureRadar, 'evidence-leaders': evidenceLeaders, 'blur-fill': blurFill, 'grid-flash': gridFlash, 'number-tag': numberTag, 'stat-pill': statPill, 'phrase-boxes': phraseBoxes, 'portrait-quote': portraitQuote, 'double-portrait': doublePortrait, 'evidence-callout': evidenceCallout, 'inset-clip': insetClip, 'kicker-payoff': kickerPayoff, 'boxed-title': boxedTitle, 'paper-label': paperLabel, 'pan-sentence': panSentence, 'red-dossier': redDossier, 'inset-portrait': insetPortrait, 'date-highlight': dateHighlight, 'corner-date': cornerDate, 'typed-label': typedLabel, 'portrait-name': portraitName, 'red-wash': redWash, 'impact-word': impactWord, 'year-drop': yearDrop, 'drop-headline': dropHeadline, 'word-reveal': wordReveal, 'percent-gauge': percentGauge, 'part-callouts': partCallouts, 'film-burn': filmBurn} as const;
type ProofProps = {componentId: keyof typeof components; skinId: Skin['id']; props: unknown; seconds: number};
const Proof: React.FC<ProofProps> = ({componentId, skinId, props}) => {
  const frame = useCurrentFrame(), {fps, width, height, durationInFrames} = useVideoConfig(), skin = skins[skinId];
  useEffect(() => {if (skinId === 'documentary') {void loadDocumentaryFonts(); void loadStageFonts();}}, [skinId]);
  const Render = components[componentId].render as React.FC<{props: unknown; skin: Skin; context: unknown}>;
  return <AbsoluteFill style={{backgroundColor: componentId === 'film-burn' ? '#000' : skin.stage.bowed.background}}>
    <Render props={props} skin={skin} context={{frame, fps, width, height, durationInFrames}} />
  </AbsoluteFill>;
};
const Root: React.FC = () => <Composition id="proof" component={Proof} fps={30} width={1920} height={1080} durationInFrames={150}
  defaultProps={{componentId: 'word-reveal', skinId: 'documentary', props: {text: 'A short proof sentence appears'}, seconds: 5} as ProofProps}
  calculateMetadata={({props}) => ({durationInFrames: Math.round(props.seconds * 30)})} />;
registerRoot(Root);
