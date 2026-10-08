import {Chess} from 'chess.js';
import {z} from 'zod';

export const WarboardMoveSchema = z.object({
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  expected_san: z.string().min(1),
  story_label: z.string().min(1).max(52),
}).strict();

export const WarboardScenarioSchema = z.object({
  schema_version: z.literal('warboard-scenario.v1'),
  foundation_lock: z.literal('warboard.visual-foundation.v1'),
  scenario_id: z.string().regex(/^[a-z0-9_]+$/),
  historical_context: z.string().min(1),
  tactical_message: z.string().min(1),
  white_represents: z.string().min(1),
  black_represents: z.string().min(1),
  starting_fen: z.string().min(1),
  moves: z.array(WarboardMoveSchema).min(1).max(3),
  final_label: z.string().min(1).max(72),
  palette_accent: z.string().regex(/^#[0-9a-f]{6}$/),
}).strict();

export type WarboardScenario = z.infer<typeof WarboardScenarioSchema>;
export type ScenarioPiece = {id: string; type: 'k' | 'q' | 'r' | 'b' | 'n' | 'p'; color: 'w' | 'b'; square: string};
export type CompiledScenarioMove = {
  uci: string;
  san: string;
  storyLabel: string;
  movingId: string;
  capturedId?: string;
  from: string;
  to: string;
  isCapture: boolean;
};
export type CompiledScenario = {states: ScenarioPiece[][]; moves: CompiledScenarioMove[]; finalFen: string; durationInFrames: number};

const files = 'abcdefgh';

const piecesFromFen = (fen: string): ScenarioPiece[] => {
  const board = fen.split(' ')[0].split('/');
  const pieces: ScenarioPiece[] = [];
  board.forEach((row, rowIndex) => {
    let file = 0;
    for (const token of row) {
      if (/\d/.test(token)) file += Number(token);
      else {
        const color = token === token.toUpperCase() ? 'w' : 'b';
        const type = token.toLowerCase() as ScenarioPiece['type'];
        const square = `${files[file]}${8 - rowIndex}`;
        pieces.push({id: `${color}${type}-${square}`, type, color, square});
        file += 1;
      }
    }
  });
  return pieces;
};

export const scenarioDuration = (scenario: WarboardScenario): number => Math.min(600, Math.max(240, 30 + scenario.moves.length * 54 + 72));

export const compileWarboardScenario = (input: WarboardScenario): CompiledScenario => {
  const scenario = WarboardScenarioSchema.parse(input);
  const chess = new Chess(scenario.starting_fen);
  const states: ScenarioPiece[][] = [piecesFromFen(scenario.starting_fen)];
  const moves: CompiledScenarioMove[] = [];

  scenario.moves.forEach((expected, index) => {
    const from = expected.uci.slice(0, 2);
    const to = expected.uci.slice(2, 4);
    const promotion = expected.uci[4];
    const previous = states[index];
    const moving = previous.find((piece) => piece.square === from && piece.color === chess.turn());
    if (!moving) throw new Error(`scenario compiler cannot find moving piece at ${from}`);
    const captured = previous.find((piece) => piece.square === to && piece.color !== moving.color);
    const legal = chess.move({from, to, promotion});
    if (!legal) throw new Error(`illegal scenario move ${expected.uci}`);
    if (legal.san !== expected.expected_san) throw new Error(`SAN mismatch for ${expected.uci}: expected ${expected.expected_san}, got ${legal.san}`);
    if (/[kepq]/.test(legal.flags)) throw new Error(`special move not yet supported by visual compiler: ${expected.uci}:${legal.flags}`);

    const next = previous
      .filter((piece) => piece.id !== captured?.id)
      .map((piece) => piece.id === moving.id ? {...piece, square: to} : piece);
    states.push(next);
    moves.push({uci: expected.uci, san: legal.san, storyLabel: expected.story_label, movingId: moving.id, capturedId: captured?.id, from, to, isCapture: Boolean(captured)});
  });

  return {states, moves, finalFen: chess.fen(), durationInFrames: scenarioDuration(scenario)};
};

export const sacrificeDeflectionScenario: WarboardScenario = {
  schema_version: 'warboard-scenario.v1',
  foundation_lock: 'warboard.visual-foundation.v1',
  scenario_id: 'sacrifice_deflection_proof',
  historical_context: 'A deliberate sacrifice pulls the defender away from the position it was protecting.',
  tactical_message: 'The visible loss creates the decisive opening.',
  white_represents: 'THE ATTACKER',
  black_represents: 'THE DEFENDER',
  starting_fen: '3q2k1/5p2/8/8/2B5/8/8/3Q2K1 w - - 0 1',
  moves: [
    {uci: 'c4f7', expected_san: 'Bxf7+', story_label: 'THE SACRIFICE'},
    {uci: 'g8f7', expected_san: 'Kxf7', story_label: 'THE DEFENDER TAKES THE BAIT'},
    {uci: 'd1d8', expected_san: 'Qxd8', story_label: 'THE REAL TARGET FALLS'},
  ],
  final_label: 'THE LOSS WAS THE OPENING MOVE',
  palette_accent: '#c69346',
};
