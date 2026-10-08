import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {STRONG_GREY_MAP_TREATMENT, WC04_ADAPTIVE_STYLE, type EngravedPieceSpec, type WC04AdaptiveTacticalMapV2Props} from './production-contracts';
import {WarChessEngravedPiece} from './war-chess-engraved-piece';
import {WarChessTacticalArrow} from './war-chess-tactical-arrow';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const assetPath = (path: string): string => /^(?:data:|https?:|blob:|\/)/i.test(path) ? path : staticFile(path);
const movement = (frame: number, start: number, end: number): number => interpolate(frame, [start, end], [0, 1], {...clamp, easing: Easing.bezier(0.18, 0.84, 0.22, 1)});
const mix = (from: readonly [number, number], to: readonly [number, number], amount: number): [number, number] => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
];

export const WC04_V2_TEXT_LAYOUT = {
  titleFontSize: 48,
  annotationFontSize: 28,
  markerLabelFontSize: 28,
  markerDiameter: 42,
  titleZone: 'fixed_top_left',
  orientationAnnotationZone: 'fixed_bottom_left',
  staticMarkerLabels: 'attached_to_marker',
  connectorLabels: 'not_rendered',
  zoneLabels: 'not_rendered',
} as const;

const Text: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{fontFamily: 'Arial, Helvetica, sans-serif', ...style}}>{children}</div>
);

const TitlePlate: React.FC<{children: React.ReactNode; paper: string}> = ({children, paper}) => (
  <Text style={{
    position: 'absolute',
    left: 54,
    top: 42,
    maxWidth: 780,
    color: paper,
    backgroundColor: 'rgba(18,18,18,.84)',
    borderLeft: '6px solid #D7B275',
    padding: '15px 22px 14px',
    fontSize: WC04_V2_TEXT_LAYOUT.titleFontSize,
    lineHeight: 1.02,
    fontWeight: 800,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    boxShadow: '0 10px 28px rgba(0,0,0,.24)',
  }}>{children}</Text>
);

const MovingPiece: React.FC<{piece: EngravedPieceSpec}> = ({piece}) => {
  const frame = useCurrentFrame();
  const position = mix(piece.start, piece.end, movement(frame, piece.startFrame, piece.endFrameExclusive));
  return <WarChessEngravedPiece piece={piece} position={position} />;
};

const MapLabel: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <Text style={{
    color: '#F6F1E8',
    backgroundColor: 'rgba(18,18,18,.86)',
    borderLeft: '4px solid #D7B275',
    padding: '11px 16px 10px',
    fontSize: WC04_V2_TEXT_LAYOUT.annotationFontSize,
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: 1.5,
    boxShadow: '0 8px 22px rgba(0,0,0,.22)',
    ...style,
  }}>{children}</Text>
);

const StaticMarker: React.FC<{marker: Extract<WC04AdaptiveTacticalMapV2Props, {mapStoryMode: 'static_positions'}>['staticMarkers'][number]}> = ({marker}) => (
  <div style={{position: 'absolute', left: `${marker.position[0] * 100}%`, top: `${marker.position[1] * 100}%`, transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#F6F1E8', pointerEvents: 'none'}}>
    <div style={{width: WC04_V2_TEXT_LAYOUT.markerDiameter, height: WC04_V2_TEXT_LAYOUT.markerDiameter, border: '4px solid #F6F1E8', borderRadius: marker.markerType === 'zone' ? 7 : '50%', backgroundColor: 'rgba(23,23,23,.88)', boxShadow: '0 5px 16px rgba(0,0,0,.34)', margin: '0 auto 8px'}} />
    {marker.label && <Text style={{minWidth: 142, maxWidth: 270, color: '#F6F1E8', backgroundColor: 'rgba(18,18,18,.88)', borderBottom: '3px solid #D7B275', padding: '8px 13px 7px', fontSize: WC04_V2_TEXT_LAYOUT.markerLabelFontSize, lineHeight: 1.05, fontWeight: 800, letterSpacing: 1.2, whiteSpace: 'normal'}}>{marker.label}</Text>}
  </div>
);

type StaticPositionsProps = Extract<WC04AdaptiveTacticalMapV2Props, {mapStoryMode: 'static_positions'}>;
type StaticZone = NonNullable<StaticPositionsProps['zones']>[number];
type StaticConnectorSpec = NonNullable<StaticPositionsProps['connectors']>[number];

const StaticZoneMarker: React.FC<{zone: StaticZone}> = ({zone}) => (
  <div aria-label={zone.label} style={{position: 'absolute', left: `${zone.position[0] * 100}%`, top: `${zone.position[1] * 100}%`, width: 92, height: 92, transform: 'translate(-50%, -50%)', border: '3px solid rgba(215,178,117,.82)', borderRadius: '50%', boxShadow: '0 0 0 10px rgba(215,178,117,.10)', pointerEvents: 'none'}} />
);

const StaticConnector: React.FC<{connector: StaticConnectorSpec}> = ({connector}) => {
  return <>
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
      <line x1={connector.from[0]} y1={connector.from[1]} x2={connector.to[0]} y2={connector.to[1]} stroke="#D7B275" strokeOpacity={0.82} strokeWidth={0.007} strokeLinecap="round" />
    </svg>
  </>;
};

const BaseMap: React.FC<{props: WC04AdaptiveTacticalMapV2Props; children: React.ReactNode}> = ({props, children}) => (
  <AbsoluteFill style={{backgroundColor: '#242220', overflow: 'hidden'}} data-map-rung={props.mapSelection.mapRung} data-reference-version={props.referenceVersion} data-map-story-mode={props.mapStoryMode} data-style-version={WC04_ADAPTIVE_STYLE.schemaVersion}>
    <Img src={assetPath(props.map.path)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: STRONG_GREY_MAP_TREATMENT.filter}} />
    <AbsoluteFill style={{backgroundColor: STRONG_GREY_MAP_TREATMENT.veil, zIndex: 1}} />
    {children}
  </AbsoluteFill>
);

const Orientation: React.FC<{props: Extract<WC04AdaptiveTacticalMapV2Props, {mapStoryMode: 'orientation'}>}> = ({props}) => (
  <BaseMap props={props}>
    <div style={{position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none'}}>
      <TitlePlate paper={props.palette.paper}>{props.labels.title ?? props.displayTitle}</TitlePlate>
      {props.regionRouteHighlight && <MapLabel style={{position: 'absolute', left: 54, bottom: 48, maxWidth: 520}}>{props.regionRouteHighlight.label}</MapLabel>}
    </div>
  </BaseMap>
);

const StaticPositions: React.FC<{props: Extract<WC04AdaptiveTacticalMapV2Props, {mapStoryMode: 'static_positions'}>}> = ({props}) => (
  <BaseMap props={props}>
    <div style={{position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none'}}>
      <TitlePlate paper={props.palette.paper}>{props.labels.title ?? props.displayTitle}</TitlePlate>
      {(props.connectors ?? []).map((connector) => <StaticConnector key={connector.id} connector={connector} />)}
      {(props.zones ?? []).map((zone) => <StaticZoneMarker key={zone.id} zone={zone} />)}
      {props.staticMarkers.map((marker) => <StaticMarker key={marker.id} marker={marker} />)}
    </div>
  </BaseMap>
);

const TacticalMovement: React.FC<{props: Extract<WC04AdaptiveTacticalMapV2Props, {mapStoryMode: 'tactical_movement'}>}> = ({props}) => (
  <BaseMap props={props}>
    <div style={{position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none'}}>
      <Text style={{position: 'absolute', left: 64, top: 46, color: props.palette.paper, fontSize: 34, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase'}}>{props.labels.title ?? props.displayTitle}</Text>
      <MapLabel style={{position: 'absolute', left: 58, bottom: 54}}>{props.labels.left ?? props.factions[0].name}</MapLabel>
      <MapLabel style={{position: 'absolute', right: 58, bottom: 54, textAlign: 'right'}}>{props.labels.right ?? props.factions[1].name}</MapLabel>
    </div>
    <div style={{position: 'absolute', inset: 0, zIndex: 4}}>{props.arrows.map((arrow) => <WarChessTacticalArrow key={arrow.id} arrow={arrow} />)}</div>
    <div style={{position: 'absolute', inset: 0, zIndex: 5}}>{props.pieces.map((piece) => <MovingPiece key={piece.id} piece={piece} />)}</div>
  </BaseMap>
);

/** Review-only WC04 reference_version 2 surface. It never enters ProductionPropsSchema. */
export const WarChessAdaptiveTacticalMapV2Review: React.FC<WC04AdaptiveTacticalMapV2Props> = (props) => {
  if (props.mapStoryMode === 'orientation') return <Orientation props={props} />;
  if (props.mapStoryMode === 'static_positions') return <StaticPositions props={props} />;
  return <TacticalMovement props={props} />;
};
