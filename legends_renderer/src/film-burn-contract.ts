/** T01: film-burn transition overlay, placed so the cut sits at its 'cutAt' fraction. No text. */
export type FilmBurnProps = Readonly<{seed: number}>;
export const filmBurnDuration = {minSeconds: 0.4, maxSeconds: 1};
export const filmBurnCutAt = 1 / 15;
export const repairFilmBurn = (input: unknown): FilmBurnProps | null => {
  if (!input || typeof input !== 'object') return null;
  const seed = (input as Record<string, unknown>).seed;
  return Number.isSafeInteger(seed) && (seed as number) >= 0 ? {seed: seed as number} : null;
};
