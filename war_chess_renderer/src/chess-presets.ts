import {Chess, type Move, type Piece, type Square} from 'chess.js';

export type WC06Preset = {
  id: string;
  title: string;
  fen: string;
  move: string;
};

export type ResolvedWC06Preset = {
  preset: WC06Preset;
  board: ({piece: Piece; square: Square} | null)[][];
  move: Move;
};

/** Closed editorial vocabulary; positions and lines come from the engine receipt. */
export const WC06_MOTIF_IDS = [
  'knight_fork',
  'back_rank_mate',
  'queen_capture',
] as const;
export type WC06MotifId = (typeof WC06_MOTIF_IDS)[number];

// These positions form one modest, code-owned legal opening sequence. They are
// not editorial claims and do not imply a tactical analogy. The render input
// can select only an id plus the exact registry hash below.
export const WC06_PRESET_REGISTRY: readonly WC06Preset[] = [
  {id: 'wc06_preset_01', title: 'Legal position 01', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', move: 'e4'},
  {id: 'wc06_preset_02', title: 'Legal position 02', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', move: 'e5'},
  {id: 'wc06_preset_03', title: 'Legal position 03', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', move: 'Nf3'},
  {id: 'wc06_preset_04', title: 'Legal position 04', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', move: 'Nc6'},
  {id: 'wc06_preset_05', title: 'Legal position 05', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', move: 'Bb5'},
  {id: 'wc06_preset_06', title: 'Legal position 06', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', move: 'a6'},
  {id: 'wc06_preset_07', title: 'Legal position 07', fen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', move: 'Ba4'},
  {id: 'wc06_preset_08', title: 'Legal position 08', fen: 'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4', move: 'Nf6'},
  {id: 'wc06_preset_09', title: 'Legal position 09', fen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5', move: 'O-O'},
  {id: 'wc06_preset_10', title: 'Legal position 10', fen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5', move: 'Be7'},
  {id: 'wc06_preset_11', title: 'Legal position 11', fen: 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 6', move: 'Re1'},
  {id: 'wc06_preset_12', title: 'Legal position 12', fen: 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq - 5 6', move: 'b5'},
  {id: 'wc06_preset_13', title: 'Legal position 13', fen: 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 7', move: 'Bb3'},
  {id: 'wc06_preset_14', title: 'Legal position 14', fen: 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 7', move: 'd6'},
  {id: 'wc06_preset_15', title: 'Legal position 15', fen: 'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq - 0 8', move: 'c3'},
];

export const WC06_REGISTRY_HASH = '983f720a96bcd151ae35284c70cac1592cb5eda2747cad97d2f1db1af0f7fd50';

const resolveLegalPreset = (preset: WC06Preset): ResolvedWC06Preset => {
  let chess: Chess;
  let move: Move;
  try {
    chess = new Chess(preset.fen);
    move = chess.move(preset.move);
  } catch (error) {
    throw new Error(`WC06 preset ${preset.id} is not a legal FEN/move pair`, {cause: error});
  }
  return {
    preset,
    move,
    board: chess.board().map((rank, rankIndex) =>
      rank.map((piece, fileIndex) => piece ? {
        piece,
        square: `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}` as Square,
      } : null),
    ),
  };
};

export const assertValidWC06Registry = (): void => {
  if (WC06_PRESET_REGISTRY.length !== 15) {
    throw new Error('WC06 registry must contain exactly 15 presets');
  }
  const ids = new Set<string>();
  for (const [index, preset] of WC06_PRESET_REGISTRY.entries()) {
    const expectedId = `wc06_preset_${String(index + 1).padStart(2, '0')}`;
    if (preset.id !== expectedId || ids.has(preset.id)) {
      throw new Error('WC06 registry ids must be unique and sequential');
    }
    ids.add(preset.id);
    resolveLegalPreset(preset);
  }
};

export const resolveWC06Preset = (presetId: string, registryHash: string): ResolvedWC06Preset => {
  if (registryHash !== WC06_REGISTRY_HASH) {
    throw new Error('WC06 registry binding is invalid');
  }
  const preset = WC06_PRESET_REGISTRY.find((entry) => entry.id === presetId);
  if (!preset) {
    throw new Error('WC06 preset id is not registered');
  }
  return resolveLegalPreset(preset);
};

// Fail at module initialization as well as at individual renderer lookup.
assertValidWC06Registry();
