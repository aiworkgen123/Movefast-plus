
/** Measured on ESB 00:00.3 and WTC 00:41.9 (1080p): Montserrat 700, 107 px, -0.008 em, ink from (89, 92);
 * year Montserrat 400, 65.8 px, -0.013 em, ink from (86, 200). Both fade in over 0.35 s at the cut; no exit (cut). */
export type Line = Readonly<{size: number; tracking: number; left: number; top: number}>;
export const cornerDateSpec: Readonly<{date: Line; year: Line; fade: number}> = {date: {size: 107, tracking: -0.008, left: 80.5, top: 79.5}, year: {size: 65.8, tracking: -0.013, left: 86, top: 190.6}, fade: 0.35};
