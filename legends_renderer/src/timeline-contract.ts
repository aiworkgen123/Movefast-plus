import {repairText} from './contract.ts';
export type TimelineEvent = Readonly<{date: string; label: string}>;
export type TimelineProps = Readonly<{title: string; events: readonly TimelineEvent[]}>;
export const timelineTextLimits = {title: {minWords: 2, maxWords: 8, maxChars: 64}} as const;
export const timelineEventLimits = {date: {minWords: 1, maxWords: 4, maxChars: 24}, label: {minWords: 2, maxWords: 8, maxChars: 64}} as const;
export const timelineDuration = {minSeconds: 3, maxSeconds: 9};
export const repairTimeline = (input: unknown): TimelineProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const title = repairText(value.title, timelineTextLimits.title);
  if (!title || !Array.isArray(value.events) || value.events.length < 2 || value.events.length > 5) return null;
  const events: TimelineEvent[] = [];
  for (const item of value.events) {
    if (!item || typeof item !== 'object') return null;
    const date = repairText(item.date, timelineEventLimits.date);
    const label = repairText(item.label, timelineEventLimits.label);
    // Dates and factual event labels must fit intact; never silently shorten an event.
    if (!date || !label || date !== item.date.trim() || label !== item.label.trim()) return null;
    events.push({date, label});
  }
  return {title, events};
};
