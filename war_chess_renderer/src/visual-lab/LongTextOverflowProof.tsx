import React from 'react';
import {staticFile} from 'remotion';

import {AnchoredProgression} from '../anchored-progression';

export const LONG_TEXT_OVERFLOW_PROOF_DURATION = 557;

export const LongTextOverflowProof: React.FC = () => (
  <AnchoredProgression
    relationship="progression"
    anchorKind="person"
    anchorSide="left"
    anchorLabel="PROGRESSION"
    anchorTitle="the three-board progression from opening to middlegame to endgame"
    relationshipLabel="WAR → CHESS"
    anchorCutoutSource={staticFile(
      'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
    )}
    anchorBackgroundSource={staticFile(
      'visual-lab/historical-documents/napoleon-study.jpg',
    )}
    durationInFrames={LONG_TEXT_OVERFLOW_PROOF_DURATION}
    dockStartFrame={48}
    dockEndFrame={94}
    closeStartFrame={497}
    closeEndFrame={545}
    finalMessage="the three-board progression from opening to middlegame to endgame"
    finalDetail="WAR → CHESS"
    showIndex
    items={[
      {
        id: 'first',
        label: 'OPENING — THE FIRST COMMAND',
        title: 'Opening — the first command',
        detail: 'The position is established.',
        imageSource: staticFile('visual-lab/phase-progression-real/pexels-tima-6598739.jpg'),
        accent: '#c89a4a',
        startFrame: 86,
        endFrame: 256,
      },
      {
        id: 'second',
        label: 'MIDDLEGAME — PURE CALCULATION',
        title: 'Middlegame — pure calculation',
        detail: 'The prepared book runs out.',
        imageSource: staticFile('visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg'),
        accent: '#b44d3a',
        startFrame: 225,
        endFrame: 396,
      },
      {
        id: 'third',
        label: 'ENDGAME: BETTER TECHNIQUE RATHER THAN MORE FORCE',
        title: 'Endgame: better technique rather than more force',
        detail: 'Fewer pieces. Less room for error.',
        imageSource: staticFile('visual-lab/phase-progression-real/pexels-cottonbro-8656670.jpg'),
        accent: '#78969a',
        startFrame: 365,
        endFrame: 536,
      },
    ]}
  />
);
