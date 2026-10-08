/* eslint-disable @remotion/non-pure-animation -- all animated values are derived from explicit frame arguments. */
import React, {useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Board3D, squareToWorldPosition, StauntonPiece} from './wb01-primitives';
import {compileWarboardScenario, type CompiledScenarioMove, type ScenarioPiece, type WarboardScenario} from './scenario';

export const WAR_CHESS_WC06_CHESS_EVALUATION_ID = 'WC06_CHESS_EVALUATION_20260722';
export const WAR_CHESS_WC06_CHESS_EVALUATION_COMPOSITION_ID = 'WarChessWC06ChessEvaluation';
export const WAR_CHESS_WC06_CHESS_EVALUATION_FRAMES = 318;

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.22, 0.78, 0.22, 1);
const colors = {surround: '#242220', walnut: '#4a2a1d', stone: '#c8bda8', ivory: '#eee3c9', obsidian: '#24282b', gold: '#c69346', danger: '#a83c32', paper: '#eee7d9', muted: '#a79c8b', signal: '#a83c32', slate: '#7b8a8e', line: '#5c4934'};

export type WarChessWC06Labels = {eyebrow?: string; sideTag?: string; evaluationLabel?: string; whiteLabel?: string; blackLabel?: string; stages?: string[]; footerLeft?: string; footerRight?: string};
export type WarChessWC06Props = {scenario: WarboardScenario; labels: WarChessWC06Labels};

type MoveRange = {start: number; end: number};
const buildMoveRanges = (moveCount: number): MoveRange[] => {
  const usableStart = 34;
  const usableEnd = 294;
  const segment = (usableEnd - usableStart) / moveCount;
  return Array.from({length: moveCount}, (_, index) => ({start: usableStart + index * segment, end: usableStart + (index + 0.76) * segment}));
};

type Transition = {index: number; progress: number};

const transitionForFrame = (frame: number, moveRanges: MoveRange[]): Transition | null => {
  for (let index = 0; index < moveRanges.length; index += 1) {
    const range = moveRanges[index];
    if (frame >= range.start && frame < range.end) {
      return {index, progress: interpolate(frame, [range.start, range.end], [0, 1], {...clamp, easing: ease})};
    }
  }
  return null;
};

type RenderedPiece = ScenarioPiece & {position: [number, number, number]; opacity: number; danger: number};

const piecesForFrame = (frame: number, compiled: ReturnType<typeof compileWarboardScenario>, moveRanges: MoveRange[]): {pieces: RenderedPiece[]; transition: Transition | null} => {
  const transition = transitionForFrame(frame, moveRanges);
  const stateIndex = transition ? transition.index : moveRanges.reduce((index, range) => frame >= range.end ? index + 1 : index, 0);
  const current = compiled.states[Math.min(stateIndex, compiled.states.length - 1)];
  const rendered: RenderedPiece[] = current.map((piece) => ({...piece, position: squareToWorldPosition(piece.square), opacity: 1, danger: 0}));
  if (!transition) return {pieces: rendered, transition};

  const move = compiled.moves[transition.index];
  const fromPiece = compiled.states[transition.index].find((piece) => piece.id === move.movingId);
  const moving = rendered.find((piece) => piece.id === move.movingId);
  const capturedExit = move.capturedId ? interpolate(transition.progress, [0, 0.4], [0, 1], {...clamp, easing: ease}) : 0;
  const travel = move.capturedId ? interpolate(transition.progress, [0.3, 1], [0, 1], {...clamp, easing: ease}) : transition.progress;

  if (fromPiece && moving) {
    const from = squareToWorldPosition(move.from);
    const to = squareToWorldPosition(move.to);
    const lift = fromPiece.type === 'n' ? Math.sin(Math.PI * travel) * 0.95 : Math.sin(Math.PI * travel) * 0.26;
    moving.position = [from[0] + (to[0] - from[0]) * travel, lift, from[2] + (to[2] - from[2]) * travel];
  }
  if (move.capturedId) {
    const captured = rendered.find((piece) => piece.id === move.capturedId);
    if (captured) {
      const [x, , z] = squareToWorldPosition(captured.square);
      captured.position = [x + capturedExit * 2.15, Math.sin(capturedExit * Math.PI * 0.72) * 0.9, z + capturedExit * 0.24];
      captured.opacity = 1 - capturedExit;
      captured.danger = capturedExit;
    }
  }
  return {pieces: rendered, transition};
};

const CameraRig: React.FC<{frame: number}> = ({frame}) => {
  const {camera} = useThree();
  const reveal = interpolate(frame, [220, 294], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  camera.position.set(-0.25 + reveal * 0.42, 10.75 - reveal * 0.42, 13.9 - reveal * 0.55);
  camera.lookAt(new THREE.Vector3(0, 0.4, 0));
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = 43;
    camera.updateProjectionMatrix();
  }
  return null;
};

const PathSegment: React.FC<{from: [number, number, number]; to: [number, number, number]; opacity: number}> = ({from, to, opacity}) => {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  return <mesh position={mid} rotation={[0, Math.atan2(dx, dz), 0]}><boxGeometry args={[0.028, 0.028, distance]} /><meshBasicMaterial color={colors.gold} transparent opacity={opacity} depthWrite={false} /></mesh>;
};

const MoveArc: React.FC<{move: CompiledScenarioMove; progress: number}> = ({move, progress}) => {
  const from = squareToWorldPosition(move.from);
  const to = squareToWorldPosition(move.to);
  const points = Array.from({length: 9}, (_, index) => {
    const t = (index + 1) / 9;
    const lift = 0.25 + Math.sin(Math.PI * t) * (move.capturedId ? 0.34 : 0.2);
    return [from[0] + (to[0] - from[0]) * t, lift, from[2] + (to[2] - from[2]) * t] as [number, number, number];
  });
  return <group>
    {points.map((point, index) => <PathSegment key={index} from={index === 0 ? [from[0], 0.25, from[2]] : points[index - 1]} to={point} opacity={(0.18 + progress * 0.4) * (progress > index / 9 ? 0.9 : 0.08)} />)}
  </group>;
};

const SquarePulse: React.FC<{square: string; opacity: number; color: string}> = ({square, opacity, color}) => {
  const [x, , z] = squareToWorldPosition(square);
  return <mesh position={[x, 0.22, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.94, 0.94]} /><meshBasicMaterial color={color} transparent opacity={opacity * 0.24} depthWrite={false} /></mesh>;
};

const RevealRing: React.FC<{square: string; opacity: number}> = ({square, opacity}) => {
  const [x, , z] = squareToWorldPosition(square);
  return <mesh position={[x, 0.28, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.46, 0.55, 40]} /><meshBasicMaterial color={colors.danger} transparent opacity={opacity * 0.76} depthWrite={false} /></mesh>;
};

const EvaluationScene: React.FC<{frame: number; compiled: ReturnType<typeof compileWarboardScenario>; moveRanges: MoveRange[]}> = ({frame, compiled, moveRanges}) => {
  const {pieces, transition} = piecesForFrame(frame, compiled, moveRanges);
  const reveal = interpolate(frame, [220, 294], [0, 1], {...clamp, easing: ease});
  const activeDestination = transition ? compiled.moves[transition.index].to : null;
  return <>
    <CameraRig frame={frame} />
    <color attach="background" args={[colors.surround]} />
    <ambientLight intensity={1.15} color="#f4ead7" />
    <directionalLight position={[4, 11, 6]} intensity={3.0} color="#f5dfba" castShadow shadow-mapSize={[1024, 1024]} />
    <pointLight position={[-5, 5, -4]} intensity={1.25} distance={18} color="#9b6c45" />
    <pointLight position={[4, 4, 5]} intensity={0.7} distance={15} color="#8ba0a8" />
    <Board3D palette={colors} />
    {activeDestination && transition && <MoveArc move={compiled.moves[transition.index]} progress={transition.progress} />}
    {activeDestination && transition && <SquarePulse square={activeDestination} opacity={Math.sin(Math.PI * transition.progress)} color={colors.gold} />}
    <SquarePulse square={compiled.moves[compiled.moves.length - 1].to} opacity={reveal} color={colors.danger} />
    <RevealRing square={compiled.moves[compiled.moves.length - 1].to} opacity={reveal} />
    {pieces.map((piece) => <group key={piece.id} position={piece.position} scale={piece.opacity} visible={piece.opacity > 0.001}>
      {piece.danger > 0.001 && <mesh position={[0, 0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.48, 0.58, 40]} /><meshBasicMaterial color={colors.danger} transparent opacity={piece.danger * 0.85} /></mesh>}
      <StauntonPiece type={piece.type} color={piece.color} palette={colors} />
    </group>)}
  </>;
};

const Label: React.FC<{children: React.ReactNode; style?: React.CSSProperties; opacity?: number}> = ({children, style, opacity = 1}) => (
  <div style={{position: 'absolute', fontFamily: 'Arial, Helvetica, sans-serif', opacity, pointerEvents: 'none', ...style}}>{children}</div>
);

const Overlay: React.FC<{labels: WarChessWC06Labels; moveRanges: MoveRange[]; storyLabels: string[]}> = ({labels, moveRanges, storyLabels}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const intro = interpolate(frame, [0, 24], [0, 1], clamp);
  const evalX = interpolate(frame, [0, 88, 156, 224, 294], [790, 760, 780, 950, 1128], clamp);
  const stage = (labels.stages?.length ? labels.stages : storyLabels).map((text, index) => {
    const range = moveRanges[index] ?? moveRanges[moveRanges.length - 1];
    return {text, start: Math.max(24, range.start - 14), end: range.end + 14, color: index === 1 ? colors.gold : index === (moveRanges.length - 1) ? colors.danger : colors.paper};
  });
  return <AbsoluteFill style={{pointerEvents: 'none'}}>
    {labels.eyebrow && <Label opacity={intro} style={{left: 86, top: 54, fontSize: 27, letterSpacing: 4, color: colors.gold}}>{labels.eyebrow}</Label>}
    {labels.sideTag && <Label opacity={intro} style={{right: 86, top: 58, fontSize: 16, letterSpacing: 2.1, color: colors.muted, textAlign: 'right'}}>{labels.sideTag}</Label>}
    {labels.evaluationLabel && <Label opacity={intro} style={{left: '50%', top: 76, transform: 'translateX(-50%)', fontSize: 14, letterSpacing: 3, color: colors.muted}}>{labels.evaluationLabel}</Label>}
    {labels.whiteLabel && <Label opacity={intro} style={{left: 638, top: 101, fontSize: 17, letterSpacing: 2.2, color: colors.signal}}>{labels.whiteLabel}</Label>}
    {labels.blackLabel && <Label opacity={intro} style={{right: 638, top: 101, fontSize: 17, letterSpacing: 2.2, color: colors.slate, textAlign: 'right'}}>{labels.blackLabel}</Label>}
    <div style={{position: 'absolute', left: 638, top: 132, width: 644, height: 22, border: `2px solid ${colors.line}`, borderRadius: 12, backgroundColor: '#120f0d', boxSizing: 'border-box', opacity: intro}}>
      <div style={{position: 'absolute', inset: '4px 50% 4px 4px', borderRadius: 8, backgroundColor: `${colors.signal}c7`}} />
      <div style={{position: 'absolute', inset: '4px 4px 4px 50%', borderRadius: 8, backgroundColor: `${colors.slate}c7`}} />
      <div style={{position: 'absolute', left: evalX - 638 - 2, top: -7, width: 4, height: 32, backgroundColor: colors.paper, boxShadow: `0 0 10px ${colors.paper}`}} />
    </div>
    {stage.map((item) => {
      const opacity = interpolate(frame, [item.start, item.start + 12, item.end - 14, item.end], [0, 1, 1, 0], clamp);
      return <Label key={item.text} opacity={opacity} style={{left: '50%', bottom: 78, transform: 'translateX(-50%)', fontSize: 36, lineHeight: 1.1, letterSpacing: 3.1, fontWeight: 700, color: item.color, textAlign: 'center', whiteSpace: 'nowrap'}}>{item.text}</Label>;
    })}
    {labels.footerLeft && <Label opacity={intro} style={{left: 90, bottom: 35, fontSize: 15, letterSpacing: 2, color: colors.muted}}>{labels.footerLeft}</Label>}
    {labels.footerRight && <Label opacity={intro} style={{right: 90, bottom: 35, fontSize: 15, letterSpacing: 2, color: colors.muted, textAlign: 'right'}}>{labels.footerRight}</Label>}
    <div style={{position: 'absolute', left: 0, top: 0, width, height, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.24) 100%)', opacity: 0.5}} />
  </AbsoluteFill>;
};

export const WarChessWC06ChessEvaluation: React.FC<WarChessWC06Props> = (props) => {
  const {width, height} = useVideoConfig();
  const compiled = useMemo(() => {
    return compileWarboardScenario(props.scenario);
  }, [props.scenario]);
  const moveRanges = useMemo(() => buildMoveRanges(compiled.moves.length), [compiled.moves.length]);
  return <AbsoluteFill style={{backgroundColor: colors.surround, color: colors.paper, overflow: 'hidden'}}>
    <ThreeCanvas width={width} height={height} camera={{position: [0, 10.75, 13.9], fov: 43, near: 0.1, far: 100}} gl={{antialias: true, alpha: false, preserveDrawingBuffer: false}} shadows style={{position: 'absolute', inset: 0}}>
      <EvaluationScene frame={useCurrentFrame()} compiled={compiled} moveRanges={moveRanges} />
    </ThreeCanvas>
    <Overlay labels={props.labels} moveRanges={moveRanges} storyLabels={compiled.moves.map((move) => move.storyLabel)} />
  </AbsoluteFill>;
};
