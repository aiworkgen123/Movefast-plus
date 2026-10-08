/** Frame controls shared by the production adapters and their offline smoke check. */
export const chronologyCueState = (frame: number, duration: number, count: number, cues?: readonly number[]) =>
  cues ? cues.filter(start => frame >= start).length - 1 : Math.min(count, Math.floor(frame / (duration / (count + 1))));

export const decisionCueState = (frame: number, duration: number, count: number, reveal?: number) => {
  const segment = Math.max(1, reveal === undefined ? duration / (count + 1) : reveal / count);
  const state = reveal !== undefined && frame >= reveal ? count : Math.min(count, Math.floor(frame / segment));
  const selected = state === count;
  return {state, selected, segment,
    stateStart: selected && reveal !== undefined ? reveal : state * segment,
    stateDuration: selected && reveal !== undefined ? duration - reveal : segment};
};
