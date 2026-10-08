import {Chess} from 'chess.js';
import {z} from 'zod';

export const START_FEN = '6k1/6pp/2b1p3/8/8/5N2/8/6K1 w - - 0 1';

export const MOVE_SEQUENCE = [
  {uci: 'f3h4', san: 'Nh4', side: 'white', beat: 'ROME ADVANCES'},
  {uci: 'g7g5', san: 'g5!', side: 'black', beat: 'THE QUIET MOVE'},
  {uci: 'h4g6', san: 'Ng6', side: 'white', beat: 'NO SAFE SQUARES'},
  {uci: 'h7g6', san: 'hxg6', side: 'black', beat: 'THE RING CLOSED'},
] as const;

const stageRange = z.object({start: z.number().int().min(0), end: z.number().int().gt(0)}).strict();

export const Wb01BriefSchema = z.object({
  schema_version: z.literal('wb01-brief.v2-3d'),
  graphic_id: z.literal('WB01'),
  composition: z.literal('WB01PoisonedCenter3D'),
  render_mode: z.enum(['full-frame', 'transparent-overlay']),
  canvas: z.object({width: z.literal(1920), height: z.literal(1080), fps: z.literal(30)}).strict(),
  duration: z.object({frames: z.literal(420), stages: z.object({
    establish: stageRange,
    whiteAdvance: stageRange,
    blackQuiet: stageRange,
    unsafeReveal: stageRange,
    whiteEscape: stageRange,
    capture: stageRange,
    final: stageRange,
  }).strict()}).strict(),
  chess: z.object({
    starting_fen: z.literal(START_FEN),
    moves: z.array(z.object({uci: z.string().regex(/^[a-h][1-8][a-h][1-8]$/), san: z.string().min(2), side: z.enum(['white', 'black']), beat: z.string().min(1)}).strict()).length(4),
    validation_policy: z.literal('chess.js-legal-sequence-v1'),
  }).strict(),
  camera: z.object({
    establish: z.tuple([z.number(), z.number(), z.number()]),
    trap: z.tuple([z.number(), z.number(), z.number()]),
    final: z.tuple([z.number(), z.number(), z.number()]),
    target: z.tuple([z.number(), z.number(), z.number()]),
    fov: z.number().min(20).max(70),
  }).strict(),
  palette: z.object({
    surround: z.string().regex(/^#[0-9a-f]{6}$/),
    walnut: z.string().regex(/^#[0-9a-f]{6}$/),
    stone: z.string().regex(/^#[0-9a-f]{6}$/),
    ivory: z.string().regex(/^#[0-9a-f]{6}$/),
    obsidian: z.string().regex(/^#[0-9a-f]{6}$/),
    gold: z.string().regex(/^#[0-9a-f]{6}$/),
    danger: z.string().regex(/^#[0-9a-f]{6}$/),
    paper: z.string().regex(/^#[0-9a-f]{6}$/),
    muted: z.string().regex(/^#[0-9a-f]{6}$/),
  }).strict(),
  labels: z.object({
    eyebrow: z.string(),
    title: z.string(),
    final: z.string(),
    notation: z.array(z.string()).length(4),
  }).strict(),
  unsafe_squares: z.array(z.object({
    square: z.enum(['f3', 'f5', 'g2', 'g6']),
    controller: z.string(),
    explanation: z.string(),
    reveal: z.enum(['first', 'second']),
    ray: z.array(z.string()).min(2),
  }).strict()).length(4),
  piece_style: z.object({
    name: z.literal('Staunton procedural 3D'),
    geometry_policy: z.literal('recognizable-silhouettes-no-label-glyphs'),
    lighting: z.literal('warm-ivory-obsidian-controlled-rim'),
  }).strict(),
  safe_area: z.object({left: z.number(), right: z.number(), top: z.number(), bottom: z.number()}).strict(),
  creative_note: z.string(),
}).strict();

export type Wb01Brief = z.infer<typeof Wb01BriefSchema>;
export type StageName = keyof Wb01Brief['duration']['stages'];

export const defaultBrief: Wb01Brief = {
  schema_version: 'wb01-brief.v2-3d',
  graphic_id: 'WB01',
  composition: 'WB01PoisonedCenter3D',
  render_mode: 'full-frame',
  canvas: {width: 1920, height: 1080, fps: 30},
  duration: {frames: 420, stages: {
    establish: {start: 0, end: 48},
    whiteAdvance: {start: 48, end: 96},
    blackQuiet: {start: 96, end: 144},
    unsafeReveal: {start: 144, end: 228},
    whiteEscape: {start: 228, end: 282},
    capture: {start: 282, end: 330},
    final: {start: 330, end: 420},
  }},
  chess: {starting_fen: START_FEN, moves: MOVE_SEQUENCE.map((move) => ({...move})), validation_policy: 'chess.js-legal-sequence-v1'},
  camera: {establish: [0, 10.6, 13.4], trap: [1.25, 9.4, 11.7], final: [0, 10.2, 13.1], target: [0, 0.45, 0], fov: 43},
  palette: {surround: '#242220', walnut: '#4a2a1d', stone: '#c8bda8', ivory: '#eee3c9', obsidian: '#24282b', gold: '#c69346', danger: '#a83c32', paper: '#eee7d9', muted: '#a79c8b'},
  labels: {eyebrow: 'CANNAE · TACTICAL METAPHOR', title: 'THE CENTER WALKS INTO THE TRAP', final: 'THE RING CLOSED BEFORE ROME SAW IT', notation: ['Nh4', 'g5!', 'Ng6', 'hxg6']},
  unsafe_squares: [
    {square: 'f3', controller: 'Bc6', explanation: 'diagonal c6–f3', reveal: 'first', ray: ['c6', 'd5', 'e4', 'f3']},
    {square: 'f5', controller: 'e6', explanation: 'pawn e6 controls f5', reveal: 'first', ray: ['e6', 'f5']},
    {square: 'g2', controller: 'Bc6', explanation: 'diagonal c6–g2 after f3 clears', reveal: 'second', ray: ['c6', 'd5', 'e4', 'f3', 'g2']},
    {square: 'g6', controller: 'h7', explanation: 'pawn h7 controls g6', reveal: 'second', ray: ['h7', 'g6']},
  ],
  piece_style: {name: 'Staunton procedural 3D', geometry_policy: 'recognizable-silhouettes-no-label-glyphs', lighting: 'warm-ivory-obsidian-controlled-rim'},
  safe_area: {left: 96, right: 96, top: 72, bottom: 72},
  creative_note: 'Clean chess metaphor for the tightening ring. No map, audio, particles, cage bars, or simultaneous army movement. Board state and all four moves are compiled and validated by chess.js.',
};

export const deriveDurationInFrames = (brief: Wb01Brief): number => brief.duration.frames;
export const stageStart = (brief: Wb01Brief, name: StageName): number => brief.duration.stages[name].start;

/** Parse and validate the exact SAN/UCI sequence. Throws on any illegal position or move. */
export const validateLegalSequence = (brief: Wb01Brief) => {
  Wb01BriefSchema.parse(brief);
  const chess = new Chess(brief.chess.starting_fen);
  const states = [{fen: chess.fen(), move: null as null | (typeof brief.chess.moves)[number]}];
  for (const expected of brief.chess.moves) {
    const from = expected.uci.slice(0, 2);
    const to = expected.uci.slice(2, 4);
    if ((chess.turn() === 'w' ? 'white' : 'black') !== expected.side) throw new Error(`side-to-move mismatch before ${expected.uci}`);
    const move = chess.move({from, to});
    if (!move) throw new Error(`illegal move ${expected.uci}`);
    if (move.san !== expected.san.replace('!', '')) throw new Error(`SAN mismatch for ${expected.uci}: got ${move.san}`);
    states.push({fen: chess.fen(), move: expected});
  }
  return {states, finalFen: chess.fen(), finalTurn: chess.turn(), candidates: ['f3', 'f5', 'g2', 'g6'] as const};
};

export const validatedSequence = validateLegalSequence(defaultBrief);
