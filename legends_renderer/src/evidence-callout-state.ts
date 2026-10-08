import {progress} from './motion.ts';
/** Measured on WTC 12:31.5 (1080p). A 53% black circle grows from (1000, 610) to cover the frame 0.85-1.33 s (accelerating) while
 * a 40% ghost of the text fades in; then the title shows, the passage types in word by word (1.33-1.6 s), the bar fades in and the
 * source follows. Title Anton 96.5 px +0.009 em, ink from (221, 201). Bar #00FFFF 47 px wide, rounded, from (219, 329).
 * Passage Inter 600 74.2 px +0.028 em, #F5F5F3, ink from x 301, cap top 348, lines 100 px apart, wrap 1300 px.
 * Source Inter 600 37.9 px +0.028 em, #CAC9C6, cap top 867, 52 px below the passage. */
export const evidenceCalloutSpec = {
  circle: {x: 1000, y: 610, start: 0.85, full: 1.33, shade: 0.53},
  ghost: {start: 0.57, end: 1.13, alpha: 0.4},
  title: {size: 96.5, tracking: 0.009, left: 221, capTop: 204},
  bar: {left: 219, top: 329, width: 47, below: 14},
  body: {size: 74.2, tracking: 0.028, left: 301, capTop: 348, pitch: 100, width: 1300, typeEnd: 1.6},
  source: {size: 37.9, tracking: 0.028, gap: 55, start: 1.9},
} as const;
export const evidenceCalloutState = (t: number, words: number) => {
  const k = evidenceCalloutSpec, after = t >= k.circle.full;
  return {
    radius: progress(t, k.circle.start, k.circle.full, [0.7, 0, 1, 1]),
    ghost: after ? 0 : k.ghost.alpha * progress(t, k.ghost.start, k.ghost.end, 'out-cubic'),
    title: after ? 1 : 0, bar: progress(t, k.circle.full, k.circle.full + 0.27, 'out-cubic'),
    words: after ? Math.min(words, Math.ceil((t - k.circle.full) / (k.body.typeEnd - k.circle.full) * words)) : 0,
    source: progress(t, k.source.start, k.source.start + 0.3, 'out-cubic'),
  };
};
