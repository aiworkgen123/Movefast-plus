import {random} from 'remotion';
/** One look per editorial job for a whole video: consistent within a video, different from the previous video.
 * Pools grow as Construction Legends edits are ported; content-led jobs (charts, diagrams) are not kit-locked. */
export const kitPools = {
  // One editorial job per pool; each id is a library component. Content-led edits (charts, diagrams, quotes with a specific
  // portrait, red dossier, evidence callout) are chosen by content, not by the kit.
  'sentence-on-screen': ['word-reveal', 'pan-sentence', 'emphasis'],
  'impact-word': ['impact-word', 'drop-headline'],
  'single-percentage': ['percent-gauge', 'number-statistic'],
  'quantity': ['number-tag', 'stat-pill', 'number-statistic'],
  'date': ['corner-date', 'year-drop', 'date-highlight', 'year-date'],
  'name-label': ['typed-label', 'portrait-name', 'inset-portrait', 'double-portrait', 'name-label'],
  'chapter-title': ['boxed-title', 'kicker-payoff', 'drop-headline', 'chapter-card'],
  'object-label': ['paper-label', 'inset-clip'],
  'quote-highlight': ['phrase-boxes', 'word-highlight'],
  'section-transition': ['film-burn', 'red-wash', 'grid-flash', 'cut'],
} as const satisfies Record<string, readonly string[]>;
export type KitJob = keyof typeof kitPools;
export type Kit = {[J in KitJob]: (typeof kitPools)[J][number]};

export const pickKit = (videoSeed: string, previous?: Kit): Kit => {
  const kit = {} as Record<KitJob, string>;
  for (const job of Object.keys(kitPools) as KitJob[]) {
    const options: readonly string[] = kitPools[job];
    const allowed = options.length > 1 && previous ? options.filter((o) => o !== previous[job]) : options;
    kit[job] = allowed[Math.floor(random(`${videoSeed}:${job}`) * allowed.length)];
  }
  return kit as Kit;
};
