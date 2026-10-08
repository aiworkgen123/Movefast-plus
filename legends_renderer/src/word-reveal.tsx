import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GridStage} from './grid-stage.tsx';
import {repairWordReveal, wordRevealDuration, wordRevealTextLimits, type WordRevealProps} from './word-reveal-contract.ts';
import {wordRevealSpec as spec, wordRevealState} from './word-reveal-state.ts';
export const WordReveal: React.FC<ComponentRenderProps<WordRevealProps>> = ({props, skin, context}) => {
  const safe = repairWordReveal(props);
  if (!safe || !validContext(context, wordRevealDuration)) return null;
  const s = context.width / 1920, look = skin.stage, opacities = wordRevealState(context, safe);
  const stressed = new Set(safe.stress ?? []);
  const words = safe.text.split(/\s+/u);
  return <AbsoluteFill>
    <GridStage skin={skin} context={context} variant="bowed" />
    <div style={{position: 'absolute', left: spec.left * s, top: spec.top * s, maxWidth: spec.maxWidth * s,
      fontFamily: look.sans.family, fontWeight: look.sans.weight, letterSpacing: look.sans.letterSpacing * s,
      fontSize: spec.fontSize * s, lineHeight: spec.lineHeight, color: look.text, textShadow: `0 ${3 * s}px ${14 * s}px ${look.shadow}`}}>
      {words.map((word, i) => <span key={i} style={{opacity: opacities[i]}}>
        {stressed.has(word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')) ? word.toUpperCase() : word}{i < words.length - 1 ? ' ' : ''}
      </span>)}
    </div>
  </AbsoluteFill>;
};
export const wordReveal: VisualComponent<WordRevealProps> = {id: 'word-reveal', layer: 'fullscreen', duration: wordRevealDuration,
  textLimits: wordRevealTextLimits, repair: repairWordReveal, render: WordReveal};
