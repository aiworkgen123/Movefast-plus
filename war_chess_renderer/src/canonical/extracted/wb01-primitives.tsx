import React, {useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {type Wb01Brief, validateLegalSequence} from './wb01-brief';

export const BOARD_SQUARE = 1.16;
const BOARD_SIZE = BOARD_SQUARE * 8;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.22, 0.78, 0.22, 1);
const stageOpacity = (frame: number, range: {start: number; end: number}, fade = 12): number => Math.min(interpolate(frame, [range.start, range.start + fade], [0, 1], clamp), interpolate(frame, [range.end - fade, range.end], [1, 0], clamp));

type Color = 'w' | 'b';
type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
type PieceState = {id: string; type: PieceType; color: Color; square: string};
type CompiledMove = {uci: string; san: string; from: string; to: string; color: Color; movingId: string; capturedId?: string; isKnight: boolean};
type Compilation = {states: PieceState[][]; moves: CompiledMove[]; finalFen: string};

const FILES = 'abcdefgh';
const squareToWorld = (square: string): [number, number, number] => {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return [(file - 3.5) * BOARD_SQUARE, 0, (3.5 - (rank - 1)) * BOARD_SQUARE];
};

export const squareToWorldPosition = squareToWorld;

const piecesFromFen = (fen: string): PieceState[] => {
  const rows = fen.split(' ')[0].split('/');
  const pieces: PieceState[] = [];
  rows.forEach((row, rowIndex) => {
    let file = 0;
    for (const token of row) {
      if (/\d/.test(token)) file += Number(token);
      else {
        const color: Color = token === token.toUpperCase() ? 'w' : 'b';
        const square = `${FILES[file]}${8 - rowIndex}`;
        pieces.push({id: `${color}${token.toLowerCase()}-${square}`, type: token.toLowerCase() as PieceType, color, square});
        file += 1;
      }
    }
  });
  return pieces;
};

export const compileChessPosition = (brief: Wb01Brief): Compilation => {
  const legal = validateLegalSequence(brief);
  const states: PieceState[][] = [piecesFromFen(brief.chess.starting_fen)];
  const moves: CompiledMove[] = [];
  brief.chess.moves.forEach((expected, index) => {
    const previous = states[index];
    const from = expected.uci.slice(0, 2);
    const to = expected.uci.slice(2, 4);
    const moving = previous.find((piece) => piece.square === from && piece.color === (expected.side === 'white' ? 'w' : 'b'));
    if (!moving) throw new Error(`compiler could not find moving piece at ${from}`);
    const captured = previous.find((piece) => piece.square === to && piece.color !== moving.color);
    const next = previous.filter((piece) => piece.id !== captured?.id).map((piece) => piece.id === moving.id ? {...piece, square: to} : piece);
    states.push(next);
    moves.push({uci: expected.uci, san: expected.san, from, to, color: moving.color, movingId: moving.id, capturedId: captured?.id, isKnight: moving.type === 'n'});
  });
  if (states.length !== legal.states.length) throw new Error('compiled state count does not match legal validation');
  return {states, moves, finalFen: legal.finalFen};
};

const moveRanges = (brief: Wb01Brief) => [brief.duration.stages.whiteAdvance, brief.duration.stages.blackQuiet, brief.duration.stages.whiteEscape, brief.duration.stages.capture];

const transitionForFrame = (brief: Wb01Brief, frame: number): {index: number; progress: number} | null => {
  const ranges = moveRanges(brief);
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (frame >= range.start && frame < range.end) return {index, progress: interpolate(frame, [range.start, range.end], [0, 1], {...clamp, easing: ease})};
  }
  return null;
};

type RenderPiece = PieceState & {position: [number, number, number]; opacity: number; danger: number};

export const piecesForFrame = (brief: Wb01Brief, compilation: Compilation, frame: number): RenderPiece[] => {
  const transition = transitionForFrame(brief, frame);
  const stateIndex = transition ? transition.index : moveRanges(brief).reduce((index, range) => frame >= range.end ? index + 1 : index, 0);
  const current = compilation.states[Math.min(stateIndex, compilation.states.length - 1)];
  const danger = interpolate(frame, [brief.duration.stages.unsafeReveal.start, brief.duration.stages.whiteEscape.end], [0, 1], clamp);
  const dangerSquares = new Set<string>(brief.unsafe_squares.map((unsafe) => unsafe.square));
  const rendered: RenderPiece[] = current.map((piece) => ({...piece, position: squareToWorld(piece.square), opacity: 1, danger: dangerSquares.has(piece.square) ? danger : 0}));
  if (!transition) return rendered;
  const move = compilation.moves[transition.index];
  const fromPiece = compilation.states[transition.index].find((piece) => piece.id === move.movingId);
  const moving = rendered.find((piece) => piece.id === move.movingId);
  // A capture is shown in two readable actions: remove the captured piece,
  // then let the attacker occupy the cleared square. This avoids two models
  // intersecting and makes the chess result unambiguous at normal speed.
  const capturedExitProgress = move.capturedId ? interpolate(transition.progress, [0, 0.42], [0, 1], {...clamp, easing: ease}) : 0;
  const movingProgress = move.capturedId ? interpolate(transition.progress, [0.34, 1], [0, 1], {...clamp, easing: ease}) : transition.progress;
  if (fromPiece && moving) {
    const from = squareToWorld(move.from);
    const to = squareToWorld(move.to);
    const isKnight = fromPiece.type === 'n';
    const lift = isKnight ? Math.sin(Math.PI * movingProgress) * 0.95 : Math.sin(Math.PI * movingProgress) * 0.28;
    moving.position = [from[0] + (to[0] - from[0]) * movingProgress, lift, from[2] + (to[2] - from[2]) * movingProgress];
  }
  if (move.capturedId) {
    const captured = rendered.find((piece) => piece.id === move.capturedId);
    if (captured) {
      const [x, , z] = squareToWorld(captured.square);
      captured.position = [x + capturedExitProgress * 2.8, Math.sin(capturedExitProgress * Math.PI * 0.72) * 1.15, z + capturedExitProgress * 0.35];
      captured.opacity = 1 - capturedExitProgress;
      captured.danger = 1;
    }
  }
  return rendered;
};

const Base: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <>
    <mesh position={[0, 0.26, 0]} castShadow receiveShadow><cylinderGeometry args={[0.46, 0.5, 0.15, 32]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.34} metalness={color === 'w' ? 0.06 : 0.32} /></mesh>
    <mesh position={[0, 0.37, 0]} castShadow><torusGeometry args={[0.4, 0.045, 10, 32]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.3} metalness={0.25} /></mesh>
  </>
);

const Pawn: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <>
    <Base color={color} palette={palette} />
    <mesh position={[0, 0.7, 0]} castShadow><cylinderGeometry args={[0.18, 0.28, 0.63, 24]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.3} metalness={0.15} /></mesh>
    <mesh position={[0, 1.08, 0]} castShadow><sphereGeometry args={[0.27, 24, 16]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.12} /></mesh>
  </>
);

const Bishop: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <>
    <Base color={color} palette={palette} />
    <mesh position={[0, 0.7, 0]} castShadow><coneGeometry args={[0.29, 0.68, 28]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.3} metalness={0.14} /></mesh>
    <mesh position={[0, 1.02, 0]} castShadow><torusGeometry args={[0.27, 0.055, 12, 32]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.27} metalness={0.16} /></mesh>
    <mesh position={[0, 1.34, 0]} scale={[1, 1.3, 1]} castShadow><sphereGeometry args={[0.27, 28, 20]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.27} metalness={0.16} /></mesh>
    <mesh position={[0, 1.69, 0]} castShadow><coneGeometry args={[0.12, 0.3, 24]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.18} /></mesh>
    <mesh position={[0.07, 1.38, 0.255]} rotation={[0, 0, -0.64]}><boxGeometry args={[0.075, 0.46, 0.055]} /><meshBasicMaterial color={color === 'w' ? palette.obsidian : palette.gold} /></mesh>
  </>
);

const King: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <>
    <Base color={color} palette={palette} />
    <mesh position={[0, 0.66, 0]} castShadow><coneGeometry args={[0.34, 0.68, 28]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.17} /></mesh>
    <mesh position={[0, 1.12, 0]} castShadow><sphereGeometry args={[0.24, 24, 16]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.17} /></mesh>
    <mesh position={[0, 1.45, 0]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.18} /></mesh>
    <mesh position={[0, 1.45, 0]} castShadow><boxGeometry args={[0.37, 0.12, 0.12]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.18} /></mesh>
  </>
);

const KnightHead: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, -0.42); shape.lineTo(-0.38, -0.08); shape.lineTo(-0.33, 0.2); shape.lineTo(-0.2, 0.4); shape.lineTo(-0.12, 0.68); shape.lineTo(0.03, 0.54); shape.lineTo(0.14, 0.72); shape.lineTo(0.2, 0.42); shape.lineTo(0.42, 0.3); shape.lineTo(0.34, 0.1); shape.lineTo(0.12, 0.03); shape.lineTo(0.22, -0.2); shape.lineTo(0.16, -0.44); shape.closePath();
    const extruded = new THREE.ExtrudeGeometry(shape, {depth: 0.26, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035});
    extruded.center();
    return extruded;
  }, []);
  return <mesh geometry={geometry} position={[0, 1.03, 0]} rotation={[0, 0, 0]} castShadow><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.14} /></mesh>;
};

const Knight: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <><Base color={color} palette={palette} /><mesh position={[0, 0.66, 0]} castShadow><coneGeometry args={[0.34, 0.62, 24]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.14} /></mesh><KnightHead color={color} palette={palette} /></>
);

const Rook: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <><Base color={color} palette={palette} /><mesh position={[0, 0.72, 0]} castShadow><cylinderGeometry args={[0.3, 0.35, 0.7, 24]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.32} metalness={0.15} /></mesh><mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.39, 0.32, 0.18, 24]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.32} metalness={0.15} /></mesh>{[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * 0.25, 1.28, Math.sin(index * Math.PI / 2) * 0.25]} castShadow><boxGeometry args={[0.22, 0.27, 0.22]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.32} metalness={0.15} /></mesh>)}</>
);

const Queen: React.FC<{color: Color; palette: Wb01Brief['palette']}> = ({color, palette}) => (
  <><Base color={color} palette={palette} /><mesh position={[0, 0.78, 0]} castShadow><coneGeometry args={[0.34, 0.86, 28]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.3} metalness={0.16} /></mesh><mesh position={[0, 1.24, 0]} castShadow><torusGeometry args={[0.27, 0.065, 12, 28]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.28} metalness={0.18} /></mesh>{Array.from({length: 5}, (_, index) => <mesh key={index} position={[Math.cos(index * Math.PI * 2 / 5) * 0.25, 1.52, Math.sin(index * Math.PI * 2 / 5) * 0.25]} castShadow><sphereGeometry args={[0.105, 16, 12]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.27} metalness={0.18} /></mesh>)}<mesh position={[0, 1.48, 0]} castShadow><coneGeometry args={[0.25, 0.42, 20]} /><meshStandardMaterial color={color === 'w' ? palette.ivory : palette.obsidian} roughness={0.29} metalness={0.17} /></mesh></>
);

const PieceModel: React.FC<{piece: RenderPiece; palette: Wb01Brief['palette']}> = ({piece, palette}) => {
  const content = piece.type === 'p' ? <Pawn color={piece.color} palette={palette} /> : piece.type === 'n' ? <Knight color={piece.color} palette={palette} /> : piece.type === 'b' ? <Bishop color={piece.color} palette={palette} /> : piece.type === 'k' ? <King color={piece.color} palette={palette} /> : piece.type === 'q' ? <Queen color={piece.color} palette={palette} /> : <Rook color={piece.color} palette={palette} />;
  return <group position={piece.position} scale={piece.opacity} visible={piece.opacity > 0.001}>
    {piece.danger > 0.001 && <mesh position={[0, 0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.48, 0.58, 40]} /><meshBasicMaterial color={palette.danger} transparent opacity={piece.danger * 0.88} /></mesh>}
    {content}
  </group>;
};

export const StauntonPiece: React.FC<{type: PieceType; color: Color; palette: Wb01Brief['palette']; position?: [number, number, number]}> = ({type, color, palette, position = [0, 0, 0]}) => (
  <PieceModel piece={{id: `lineup-${color}-${type}`, type, color, square: 'a1', position, opacity: 1, danger: 0}} palette={palette} />
);

const Square: React.FC<{file: number; rank: number; palette: Wb01Brief['palette']}> = ({file, rank, palette}) => {
  const square = `${FILES[file]}${rank}`;
  const [x, , z] = squareToWorld(square);
  const light = (file + rank) % 2 === 0;
  return <mesh position={[x, 0, z]} receiveShadow><boxGeometry args={[BOARD_SQUARE - 0.012, 0.16, BOARD_SQUARE - 0.012]} /><meshStandardMaterial color={light ? palette.stone : palette.walnut} roughness={0.62} metalness={0.03} /></mesh>;
};

export const Board3D: React.FC<{palette: Wb01Brief['palette']}> = ({palette}) => (
  <group>
    <mesh position={[0, -0.13, 0]} receiveShadow castShadow><boxGeometry args={[BOARD_SIZE + 0.48, 0.24, BOARD_SIZE + 0.48]} /><meshStandardMaterial color="#211914" roughness={0.52} metalness={0.08} /></mesh>
    {Array.from({length: 8}, (_, rank) => Array.from({length: 8}, (_, file) => <Square key={`${file}-${rank}`} file={file} rank={rank + 1} palette={palette} />))}
    <mesh position={[0, 0.13, -(BOARD_SIZE + 0.08) / 2]} receiveShadow><boxGeometry args={[BOARD_SIZE + 0.08, 0.12, 0.08]} /><meshStandardMaterial color="#765037" roughness={0.5} metalness={0.05} /></mesh>
    <mesh position={[0, 0.13, (BOARD_SIZE + 0.08) / 2]} receiveShadow><boxGeometry args={[BOARD_SIZE + 0.08, 0.12, 0.08]} /><meshStandardMaterial color="#765037" roughness={0.5} metalness={0.05} /></mesh>
    <mesh position={[-(BOARD_SIZE + 0.08) / 2, 0.13, 0]} receiveShadow><boxGeometry args={[0.08, 0.12, BOARD_SIZE]} /><meshStandardMaterial color="#765037" roughness={0.5} metalness={0.05} /></mesh>
    <mesh position={[(BOARD_SIZE + 0.08) / 2, 0.13, 0]} receiveShadow><boxGeometry args={[0.08, 0.12, BOARD_SIZE]} /><meshStandardMaterial color="#765037" roughness={0.5} metalness={0.05} /></mesh>
  </group>
);

const Segment: React.FC<{from: [number, number, number]; to: [number, number, number]; color: string; opacity: number; width?: number}> = ({from, to, color, opacity, width = 0.025}) => {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2];
  return <mesh position={mid} rotation={[0, Math.atan2(dx, dz), 0]}><boxGeometry args={[width, width, distance]} /><meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} /></mesh>;
};

const MoveArc: React.FC<{move: CompiledMove; progress: number; palette: Wb01Brief['palette']}> = ({move, progress, palette}) => {
  const from = squareToWorld(move.from);
  const to = squareToWorld(move.to);
  const points = Array.from({length: 10}, (_, i) => {
    const t = (i + 1) / 10;
    const lift = move.isKnight ? Math.sin(Math.PI * t) * 0.86 : Math.sin(Math.PI * t) * 0.23;
    return [from[0] + (to[0] - from[0]) * t, 0.2 + lift, from[2] + (to[2] - from[2]) * t] as [number, number, number];
  });
  return <group>{points.map((point, i) => <Segment key={i} from={i === 0 ? [from[0], 0.2, from[2]] : points[i - 1]} to={point} color={palette.gold} opacity={(0.28 + progress * 0.42) * (progress > i / 10 ? 0.76 : 0.08)} width={0.021} />)}</group>;
};

const UnsafeSquare: React.FC<{square: string; opacity: number; palette: Wb01Brief['palette']}> = ({square, opacity, palette}) => {
  const [x, , z] = squareToWorld(square);
  return <mesh position={[x, 0.22, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[BOARD_SQUARE * 0.78, BOARD_SQUARE * 0.78]} /><meshBasicMaterial color={palette.danger} transparent opacity={opacity * 0.3} depthWrite={false} /></mesh>;
};

const ThreatSquare: React.FC<{brief: Wb01Brief}> = ({brief}) => {
  const frame = useCurrentFrame();
  const opacity = stageOpacity(frame, brief.duration.stages.blackQuiet, 10) * 0.72;
  const threat = brief.unsafe_squares[0];
  if (!threat) return null;
  const [x, , z] = squareToWorld(threat.square);
  return <mesh position={[x, 0.23, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[BOARD_SQUARE * 0.8, BOARD_SQUARE * 0.8]} /><meshBasicMaterial color={brief.palette.danger} transparent opacity={opacity * 0.42} depthWrite={false} /></mesh>;
};

const UnsafeRays: React.FC<{brief: Wb01Brief; opacity: number}> = ({brief, opacity}) => {
  const reveal = useCurrentFrame();
  const windowOpacity = stageOpacity(reveal, brief.duration.stages.unsafeReveal, 14) * opacity;
  const first = interpolate(reveal, [brief.duration.stages.unsafeReveal.start + 4, brief.duration.stages.unsafeReveal.start + 32], [0, 1], clamp) * windowOpacity;
  const second = interpolate(reveal, [brief.duration.stages.unsafeReveal.start + 34, brief.duration.stages.unsafeReveal.start + 62], [0, 1], clamp) * windowOpacity;
  return <group>
    {brief.unsafe_squares.map((unsafe) => {
      const squareOpacity = (unsafe.reveal === 'first' ? first : second) * opacity;
      const rayPoints = unsafe.ray.map((square) => {
        const [x, , z] = squareToWorld(square);
        return [x, 0.28, z] as [number, number, number];
      });
      return <group key={unsafe.square}><UnsafeSquare square={unsafe.square} opacity={squareOpacity} palette={brief.palette} />{rayPoints.slice(0, -1).map((point, index) => <Segment key={`${unsafe.square}-${index}`} from={point} to={rayPoints[index + 1]} color={brief.palette.danger} opacity={squareOpacity * 0.48} width={0.018} />)}</group>;
    })}
  </group>;
};

const CameraRig: React.FC<{brief: Wb01Brief; frame: number}> = ({brief, frame}) => {
  const {camera} = useThree();
  const trapProgress = interpolate(frame, [brief.duration.stages.unsafeReveal.start, brief.duration.stages.unsafeReveal.end], [0, 1], {...clamp, easing: ease});
  const finalProgress = interpolate(frame, [brief.duration.stages.final.start, brief.duration.stages.final.start + 42], [0, 1], {...clamp, easing: ease});
  const position = [
    brief.camera.establish[0] + (brief.camera.trap[0] - brief.camera.establish[0]) * trapProgress + (brief.camera.final[0] - brief.camera.trap[0]) * finalProgress,
    brief.camera.establish[1] + (brief.camera.trap[1] - brief.camera.establish[1]) * trapProgress + (brief.camera.final[1] - brief.camera.trap[1]) * finalProgress,
    brief.camera.establish[2] + (brief.camera.trap[2] - brief.camera.establish[2]) * trapProgress + (brief.camera.final[2] - brief.camera.trap[2]) * finalProgress,
  ];
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(new THREE.Vector3(...brief.camera.target));
  if (camera instanceof THREE.PerspectiveCamera) { camera.fov = brief.camera.fov; camera.updateProjectionMatrix(); }
  return null;
};

export const ChessBoardScene: React.FC<{brief: Wb01Brief}> = ({brief}) => {
  const frame = useCurrentFrame();
  const compilation = useMemo(() => compileChessPosition(brief), [brief]);
  const rendered = piecesForFrame(brief, compilation, frame);
  const transition = transitionForFrame(brief, frame);
  const sceneOpacity = interpolate(frame, [0, 18], [0, 1], clamp);
  return <>
    <CameraRig brief={brief} frame={frame} />
    <color attach="background" args={[brief.palette.surround]} />
    <ambientLight intensity={1.15} color="#f4ead7" />
    <directionalLight position={[4, 11, 6]} intensity={3.0} color="#f5dfba" castShadow shadow-mapSize={[1024, 1024]} />
    <pointLight position={[-5, 5, -4]} intensity={1.2} distance={18} color="#9b6c45" />
    <group scale={sceneOpacity}><Board3D palette={brief.palette} /><ThreatSquare brief={brief} /><UnsafeRays brief={brief} opacity={sceneOpacity} />{transition && <MoveArc move={compilation.moves[transition.index]} progress={transition.progress} palette={brief.palette} />}{rendered.map((piece) => <PieceModel key={`${piece.id}-${piece.square}`} piece={piece} palette={brief.palette} />)}</group>
  </>;
};
