import {Video} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

import {
  ApprovedChessAnalogy,
  ApprovedChronology,
  ApprovedDecisionFork,
  ApprovedDocumentEvidenceReveal,
  ApprovedEditorialCard,
  ApprovedForceComparison,
  ApprovedArchivalDetailSequence,
  ApprovedIdentityPlace,
  ApprovedNamedPerson,
  ApprovedNumberOnlyYear,
  ApprovedProgression,
  ApprovedShortOverlay,
  ApprovedStatistic,
  ApprovedTacticalMap,
  ApprovedThreeUp,
  ApprovedTwoSourceContrast,
  ApprovedWholeWordHighlight,
} from './approved-components';

import {
  type RenderComponent,
} from './schema';

export {WC06_PRESET_REGISTRY} from './schema';

const COLORS = {
  ink: '#171614',
};

const sourceUrl = (source: {url?: string; staticFileKey?: string}) => {
  if (source.url) return source.url;
  if (source.staticFileKey) return staticFile(source.staticFileKey);
  throw new Error('render source location is missing');
};

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, Math.min(12, Math.max(1, duration - 1))], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const OrdinaryTreatment: React.FC<Extract<RenderComponent, {componentType: 'WCFX01'}> & {frame: number}> = ({frame, ...component}) => {
  const duration = component.endFrameExclusive - component.startFrame;
  if (component.source.mediaType === 'video/mp4') {
    return <AbsoluteFill style={{backgroundColor: COLORS.ink}}><Video src={sourceUrl(component.source)} muted trimBefore={component.sourceStartFrame} trimAfter={component.sourceEndFrameExclusive} durationInFrames={duration} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: fade(frame, duration)}} /></AbsoluteFill>;
  }
  return <AbsoluteFill style={{backgroundColor: COLORS.ink}}><Img src={sourceUrl(component.source)} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: fade(frame, duration)}} /></AbsoluteFill>;
};

export const renderComponentVisual = (component: RenderComponent, frame: number): React.ReactElement => {
  switch (component.componentType) {
    case 'P01': return <ApprovedShortOverlay {...component} />;
    case 'P02': return <ApprovedEditorialCard {...component} />;
    case 'P03': return <ApprovedWholeWordHighlight {...component} />;
    case 'P14': return <ApprovedNumberOnlyYear {...component} />;
    case 'WC01': return <ApprovedForceComparison {...component} />;
    case 'WC02': return <ApprovedProgression {...component} />;
    case 'WC04': return <ApprovedTacticalMap {...component} />;
    case 'WC06': return <ApprovedChessAnalogy {...component} />;
    case 'WC07': return <ApprovedThreeUp {...component} />;
    case 'WC08': return <ApprovedIdentityPlace {...component} />;
    case 'WC09': return <ApprovedStatistic {...component} />;
    case 'WC10': return <ApprovedDecisionFork {...component} />;
    case 'WC11': return <ApprovedChronology {...component} />;
    case 'WC12': return <ApprovedNamedPerson {...component} />;
    case 'WC13': return <ApprovedDocumentEvidenceReveal {...component} />;
    case 'WC14': return <ApprovedArchivalDetailSequence {...component} />;
    case 'WC15': return <ApprovedTwoSourceContrast {...component} />;
    case 'WCFX01': return <OrdinaryTreatment {...component} frame={frame} />;
  }
};

export const ComponentLayer: React.FC<{component: RenderComponent}> = ({component}) => {
  const frame = useCurrentFrame();
  return renderComponentVisual(component, frame);
};
