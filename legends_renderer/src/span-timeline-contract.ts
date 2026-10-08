import {repairText} from './contract.ts';
/** E41: a straight timeline on a dark grid: a start tag and glowing label, a span word over the middle, an end tag and label.
 * Five dots (start, three steps, end); everything is shown in capitals. */
export type SpanTimelineProps = Readonly<{startTag: string; startLabel: string; span: string; endTag: string; endLabel: string}>;
export const spanTimelineTextLimits = {startTag: {minWords: 1, maxWords: 2, maxChars: 12}, endTag: {minWords: 1, maxWords: 2, maxChars: 14},
  startLabel: {minWords: 1, maxWords: 3, maxChars: 22}, endLabel: {minWords: 1, maxWords: 3, maxChars: 22}, span: {minWords: 1, maxWords: 2, maxChars: 14}} as const;
export const spanTimelineDuration = {minSeconds: 3, maxSeconds: 15};
export const repairSpanTimeline = (input: unknown): SpanTimelineProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>, k = spanTimelineTextLimits;
  const out = {startTag: repairText(v.startTag, k.startTag), startLabel: repairText(v.startLabel, k.startLabel), span: repairText(v.span, k.span),
    endTag: repairText(v.endTag, k.endTag), endLabel: repairText(v.endLabel, k.endLabel)};
  return Object.values(out).every(Boolean) ? out as SpanTimelineProps : null;
};
