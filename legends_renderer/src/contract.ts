import type {ComponentType} from 'react';
import type {Skin} from './skins.ts';

export type FrameContext = Readonly<{frame: number; fps: number; durationInFrames: number; width: number; height: number}>;
export type TextLimit = Readonly<{minWords: number; maxWords: number; maxChars: number}>;
export type ComponentRenderProps<P> = Readonly<{props: P; skin: Skin; context: FrameContext}>;
export type VisualComponent<P> = Readonly<{
  id: string;
  layer: 'fullscreen' | 'overlay';
  duration: Readonly<{minSeconds: number; maxSeconds: number}>;
  textLimits: Partial<Record<keyof P, TextLimit>>;
  repair: (input: unknown) => P | null;
  render: ComponentType<ComponentRenderProps<P>>;
}>;

/** Keep an exact leading span; never paraphrase, add ellipses, or split a word. */
export const repairText = (input: unknown, limit: TextLimit): string | null => {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  const words = [...text.matchAll(/\S+/gu)];
  let count = Math.min(words.length, limit.maxWords);
  while (count > 0) {
    const last = words[count - 1];
    const end = last.index! + last[0].length;
    if (end <= limit.maxChars) return count >= limit.minWords ? text.slice(0, end) : null;
    count--;
  }
  return null;
};

export const validContext = (context: FrameContext, duration: VisualComponent<unknown>['duration']): boolean =>
  Number.isSafeInteger(context.frame) && context.frame >= 0 &&
  Number.isSafeInteger(context.durationInFrames) && context.frame < context.durationInFrames &&
  Number.isFinite(context.fps) && context.fps > 0 &&
  Number.isSafeInteger(context.width) && context.width > 0 &&
  Number.isSafeInteger(context.height) && context.height > 0 &&
  context.durationInFrames / context.fps >= duration.minSeconds &&
  context.durationInFrames / context.fps <= duration.maxSeconds;
