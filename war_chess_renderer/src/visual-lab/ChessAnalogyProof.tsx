import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WarChessWC06ChessEvaluation} from '../canonical/extracted/war-chess-wc06-evaluation';
import {
  sacrificeDeflectionScenario,
  type WarboardScenario,
} from '../canonical/extracted/scenario';

export const CHESS_ANALOGY_PROOF_DURATION = 318;

const replyQueuedScenario: WarboardScenario = {
  ...sacrificeDeflectionScenario,
  scenario_id: 'reply_queued_analogy_proof',
  historical_context:
    'Explanatory chess analogy only; it does not assert a historical battlefield position.',
  tactical_message:
    'The player plans the answer before offering the opponent the expected move.',
  white_represents: 'THE PLAYER WITH THE PLAN',
  black_represents: 'THE EXPECTED REPLY',
  moves: [
    {
      ...sacrificeDeflectionScenario.moves[0],
      story_label: 'THE OFFER',
    },
    {
      ...sacrificeDeflectionScenario.moves[1],
      story_label: 'THE EXPECTED REPLY',
    },
    {
      ...sacrificeDeflectionScenario.moves[2],
      story_label: 'THE QUEUED ANSWER',
    },
  ],
  final_label: 'THE ANSWER WAS READY BEFORE THE MOVE',
};

const FinalStatement: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [278, 290, 307, 317], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 74,
        transform: 'translateX(-50%)',
        color: '#c69346',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 34,
        fontWeight: 800,
        letterSpacing: 2.7,
        opacity,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {replyQueuedScenario.final_label}
    </div>
  );
};

/**
 * Review-only proof of the pivotal-chess family. The legal sequence is an
 * explanatory analogy for the owner's narration, never historical evidence.
 */
export const ChessAnalogyProof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#242220'}}>
    <WarChessWC06ChessEvaluation
      scenario={replyQueuedScenario}
      labels={{
        eyebrow: 'PIVOTAL CHESS ANALOGY',
        sideTag: 'ANALOGY ONLY · NOT HISTORICAL EVIDENCE',
        evaluationLabel: 'THE REPLY IS ALREADY IN THE LINE',
        whiteLabel: replyQueuedScenario.white_represents,
        blackLabel: replyQueuedScenario.black_represents,
        stages: replyQueuedScenario.moves.map((move) => move.story_label),
        footerLeft: 'LEGAL LINE · CHESS.JS VALIDATED',
        footerRight: 'WC06 · WB01',
      }}
    />
    <FinalStatement />
    <Sequence from={18} durationInFrames={197}>
      <Audio src={staticFile('visual-lab/chess/reply-queued.wav')} />
    </Sequence>
  </AbsoluteFill>
);
