/* eslint-disable @remotion/non-pure-animation -- animated values are derived from the explicit frame. */
import React, {useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {
  Board3D,
  squareToWorldPosition,
  StauntonPiece,
} from '../canonical/extracted/wb01-primitives';
import {
  compileWarboardScenario,
  scenarioDuration,
  type CompiledScenario,
  type ScenarioPiece,
  type WarboardScenario,
} from '../canonical/extracted/scenario';

export const WC06_PREMIUM_MINIMAL_REVIEW_DURATION = 240;
export type WC06PremiumMinimalReviewLabels = {
  title?: string;
  stages?: string[];
  engineLabel?: string;
};
export type WC06PremiumMinimalReviewProps = {
  scenario?: WarboardScenario;
  labels?: WC06PremiumMinimalReviewLabels;
  durationInFrames?: number;
};

// The standalone review composition needs a deterministic sample, but it uses
// the same closed motif vocabulary as the production component rather than a
// separate hand-authored tactical claim.
const lockedKnightForkScenario: WarboardScenario = {
  schema_version: 'warboard-scenario.v1',
  foundation_lock: 'warboard.visual-foundation.v1',
  scenario_id: 'locked_knight_fork_review',
  historical_context: 'Review-only chess analogy; not historical evidence.',
  tactical_message: 'The admitted motif supplies the visible line.',
  white_represents: 'WHITE',
  black_represents: 'BLACK',
  starting_fen: '2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1',
  moves: [{uci: 'd5e7', expected_san: 'Ne7+', story_label: 'Move'}],
  final_label: 'The line is locked before render.',
  palette_accent: '#c69346',
};

type MoveRange = {start: number; end: number};
const buildMoveRanges = (moveCount: number, duration: number): MoveRange[] => {
  const usableStart = Math.min(32, Math.max(12, duration * .12));
  const usableEnd = Math.max(usableStart + moveCount * 20, duration - 18);
  const segment = (usableEnd - usableStart) / moveCount;
  return Array.from({length: moveCount}, (_, index) => ({
    start: usableStart + index * segment,
    end: usableStart + (index + .76) * segment,
  }));
};
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const palette = {
  surround: '#18120e',
  walnut: '#4a2a1d',
  stone: '#c8bda8',
  ivory: '#eee3c9',
  obsidian: '#24282b',
  gold: '#c69346',
  danger: '#913c32',
  paper: '#eee7d9',
  muted: '#a79c8b',
};

type Position = [number, number, number];

const worldPosition = (square: string): Position => {
  const [x, y, z] = squareToWorldPosition(square);
  return [x, y, z];
};

type Transition = {index: number; progress: number};

const transitionForFrame = (frame: number, moveRanges: MoveRange[]): Transition | null => {
  for (let index = 0; index < moveRanges.length; index += 1) {
    const range = moveRanges[index];
    if (frame >= range.start && frame < range.end) {
      return {
        index,
        progress: interpolate(frame, [range.start, range.end], [0, 1], {
          ...clamp,
          easing: Easing.inOut(Easing.cubic),
        }),
      };
    }
  }
  return null;
};

const stateIndexForFrame = (frame: number, moveRanges: MoveRange[]): number =>
  moveRanges.reduce((index, range) => frame >= range.end ? index + 1 : index, 0);

type RenderedPiece = ScenarioPiece & {position: Position; opacity: number};

const piecesForFrame = (frame: number, compiled: CompiledScenario, moveRanges: MoveRange[]): {pieces: RenderedPiece[]; transition: Transition | null; stateIndex: number} => {
  const transition = transitionForFrame(frame, moveRanges);
  const stateIndex = transition ? transition.index : stateIndexForFrame(frame, moveRanges);
  const current = compiled.states[Math.min(stateIndex, compiled.states.length - 1)];
  const rendered: RenderedPiece[] = current.map((piece) => ({
    ...piece,
    position: worldPosition(piece.square),
    opacity: 1,
  }));
  if (!transition) return {pieces: rendered, transition, stateIndex};

  const move = compiled.moves[transition.index];
  const moving = rendered.find((piece) => piece.id === move.movingId);
  const captured = move.capturedId
    ? rendered.find((piece) => piece.id === move.capturedId)
    : undefined;
  const travel = interpolate(
    frame,
    [moveRanges[transition.index].start + 12, moveRanges[transition.index].end],
    [0, 1],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const captureExit = move.capturedId
    ? interpolate(
        frame,
        [moveRanges[transition.index].start, moveRanges[transition.index].start + 18],
        [0, 1],
        {...clamp, easing: Easing.inOut(Easing.cubic)},
      )
    : 0;

  if (moving) {
    const from = worldPosition(move.from);
    const to = worldPosition(move.to);
    const lift = Math.sin(Math.PI * travel) * (moving.type === 'n' ? 0.95 : 0.72);
    moving.position = [
      from[0] + (to[0] - from[0]) * travel,
      lift,
      from[2] + (to[2] - from[2]) * travel,
    ];
  }
  if (captured) {
    const [x, , z] = worldPosition(move.to);
    captured.position = [x + captureExit * 0.55, captureExit * 0.38, z + captureExit * 0.18];
    captured.opacity = 1 - captureExit;
  }
  return {pieces: rendered, transition, stateIndex};
};

const AnimatedPiece: React.FC<{
  piece: ScenarioPiece;
  position: Position;
  opacity: number;
}> = ({piece, position, opacity}) => (
  <group
    position={position}
    scale={opacity}
    visible={opacity > 0.001}
  >
    <StauntonPiece type={piece.type} color={piece.color} palette={palette} />
  </group>
);

const DestinationAccent: React.FC<{square: string; opacity: number}> = ({square, opacity}) => {
  const [x, , z] = worldPosition(square);
  return (
    <>
      <mesh position={[x, 0.2, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.49, 48]} />
        <meshBasicMaterial
          color={palette.gold}
          transparent
          opacity={opacity * 0.72}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        position={[x, 1.1, z]}
        color={palette.gold}
        intensity={opacity * 0.55}
        distance={3.2}
      />
    </>
  );
};

const CameraRig: React.FC<{frame: number; duration: number}> = ({frame, duration}) => {
  const {camera} = useThree();
  const push = interpolate(frame, [0, duration - 1], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  camera.position.set(
    0.18 - push * 0.08,
    11.35 - push * 0.48,
    15.1 - push * 0.86,
  );
  camera.lookAt(new THREE.Vector3(0, 0.36, 0));
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = 42;
    camera.updateProjectionMatrix();
  }
  return null;
};

const MinimalChessScene: React.FC<{frame: number; compiled: CompiledScenario; moveRanges: MoveRange[]; duration: number}> = ({frame, compiled, moveRanges, duration}) => {
  const {pieces, transition, stateIndex} = piecesForFrame(frame, compiled, moveRanges);
  const accentMoveIndex = transition ? transition.index : Math.max(0, stateIndex - 1);
  const accentMove = compiled.moves[Math.min(accentMoveIndex, compiled.moves.length - 1)];
  const accentRange = moveRanges[accentMoveIndex] ?? moveRanges[moveRanges.length - 1];
  const accentOpacity = transition
    ? interpolate(transition.progress, [0, 0.24, 1], [0.16, 0.7, 0.36], clamp)
    : interpolate(frame, [accentRange.end, accentRange.end + 18, accentRange.end + 42], [0.36, 0.3, 0.12], clamp);

  return (
    <>
      <CameraRig frame={frame} duration={duration} />
      <color attach="background" args={[palette.surround]} />
      <ambientLight intensity={1.05} color="#f4ead7" />
      <directionalLight
        position={[4, 11, 6]}
        intensity={3.1}
        color="#f5dfba"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 5, -4]} intensity={1.1} distance={18} color="#9b6c45" />
      <pointLight position={[4, 4, 5]} intensity={0.42} distance={15} color="#8ba0a8" />
      <Board3D palette={palette} />
      <DestinationAccent square={accentMove.to} opacity={accentOpacity} />
      {pieces.map((piece) => (
        <AnimatedPiece
          key={piece.id}
          piece={piece}
          position={piece.position}
          opacity={piece.opacity}
        />
      ))}
    </>
  );
};

const MinimalOverlay: React.FC<{labels: WC06PremiumMinimalReviewLabels; compiled: CompiledScenario; moveRanges: MoveRange[]; duration: number}> = ({labels, compiled, moveRanges, duration}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const stateIndex = Math.min(stateIndexForFrame(frame, moveRanges), compiled.moves.length - 1);
  const stages = labels.stages?.length === compiled.moves.length
    ? labels.stages
    : compiled.moves.map((move) => move.storyLabel);
  const title = stages[stateIndex] ?? 'Move';
  const notation = compiled.moves[stateIndex].san;
  const opacity = interpolate(frame, [0, 18, Math.max(19, duration - 18), duration - 1], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 78,
          color: palette.paper,
          fontFamily: 'Georgia, Times New Roman, serif',
          fontSize: 58,
          fontWeight: 600,
          letterSpacing: 0.4,
          lineHeight: 1.04,
          opacity,
        }}
      >
        {title}
      </div>
      {labels.title && <div style={{position: 'absolute', left: 96, top: 18, color: palette.muted, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, letterSpacing: 2.2, opacity}}>{labels.title}</div>}
      <div
        style={{
          position: 'absolute',
          right: 106,
          top: 92,
          color: palette.gold,
          fontFamily: 'Georgia, Times New Roman, serif',
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: 1.2,
          opacity,
        }}
      >
        {notation}
      </div>
      {labels.engineLabel && <div style={{position: 'absolute', right: 106, bottom: 34, color: palette.muted, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, letterSpacing: 1.4, opacity}}>{labels.engineLabel}</div>}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width,
          height,
          background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,.38) 100%)',
          opacity: 0.72,
        }}
      />
    </AbsoluteFill>
  );
};

export const WC06PremiumMinimalReview: React.FC<WC06PremiumMinimalReviewProps> = ({
  scenario = lockedKnightForkScenario,
  labels = {},
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const compiled = useMemo(() => compileWarboardScenario(scenario), [scenario]);
  const duration = durationInFrames ?? scenarioDuration(scenario);
  const moveRanges = useMemo(
    () => buildMoveRanges(compiled.moves.length, duration),
    [compiled.moves.length, duration],
  );
  return (
    <AbsoluteFill style={{backgroundColor: palette.surround, overflow: 'hidden'}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{position: [0.18, 11.35, 15.1], fov: 42, near: 0.1, far: 100}}
        gl={{antialias: true, alpha: false, preserveDrawingBuffer: false}}
        shadows
        style={{position: 'absolute', inset: 0}}
      >
        <MinimalChessScene frame={frame} compiled={compiled} moveRanges={moveRanges} duration={duration} />
      </ThreeCanvas>
      <MinimalOverlay labels={labels} compiled={compiled} moveRanges={moveRanges} duration={duration} />
    </AbsoluteFill>
  );
};
