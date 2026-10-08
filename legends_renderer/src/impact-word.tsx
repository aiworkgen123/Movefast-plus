import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GradedMedia, gradeFromColour, mixGrade} from './red-grade.tsx';
import {impactWordDuration, impactWordTextLimits, repairImpactWord, type ImpactWordProps} from './impact-word-contract.ts';
import {impactWordSpec as spec, impactWordState} from './impact-word-state.ts';
export const ImpactWord: React.FC<ComponentRenderProps<ImpactWordProps>> = ({props, skin, context}) => {
  const safe = repairImpactWord(props);
  if (!safe || !validContext(context, impactWordDuration)) return null;
  const s = context.width / 1920, look = skin.stage, st = impactWordState(context, safe);
  const grade = mixGrade(spec.warm, gradeFromColour(look.gradeRed), st.grade);
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <GradedMedia media={safe.media} context={context} id={`impact-word-${skin.id}`} grade={grade} />
    <div style={{position: 'absolute', left: spec.centreX * s, top: spec.centreY * s, transform: `translate(-50%, -50%) scale(${st.scale})`,
      fontFamily: look.impact.family, fontWeight: look.impact.weight, fontSize: spec.fontSize * s, lineHeight: 1, letterSpacing: `${spec.tracking}em`,
      whiteSpace: 'pre', color: look.onMedia}}>
      {Array.from(safe.word.toUpperCase()).map((ch, i) => <span key={i} style={{opacity: st.letters[i]}}>{ch}</span>)}
    </div>
  </AbsoluteFill>;
};
export const impactWord: VisualComponent<ImpactWordProps> = {id: 'impact-word', layer: 'fullscreen', duration: impactWordDuration,
  textLimits: impactWordTextLimits, repair: repairImpactWord, render: ImpactWord};
