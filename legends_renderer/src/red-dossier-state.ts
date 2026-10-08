import {interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
/** Measured on WTC 02:35.5 (1080p). Stage #101010. Disc #B80628, centre (228, 700), radius 330, slides in from the left with
 * the photos (0-1 s, ease-out); a red halo grows around it 0.73-1.27 s. Name Montserrat 800 130.5 px, #FD0130, ink from
 * (873, 435), line pitch 135 px; each line rises 90 px and fades in (line 1 from 0.95 s, line 2 0.2 s later, 0.75 s each; we stagger per word).
 * Role Montserrat 500 44 px +0.05 em, #CECECE, ink from (868, 329); words drop 45 px into place, 0.17 s apart from 2.03 s. */
export const redDossierSpec = {
  disc: {x: 228, y: 700, r: 330, halo: 400, haloIn: [0.73, 1.27]},
  photos: [[{x: 345, y: 405, h: 259}], [{x: 355, y: 405, h: 259}, {x: 624, y: 411, h: 259}]],
  name: {size: 130.5, left: 866, inkTop: 433, pitch: 135, width: 1000, rise: 90, start: 0.95, stagger: 0.2, duration: 0.75},
  role: {size: 44, left: 864, tracking: 0.05, inkTop: 329, drop: 45, start: 2.03, stagger: 0.17, duration: 0.7},
} as const;
const slide = [[0, -715], [2, -556], [4, -436], [6, -333], [8, -247], [10, -178], [12, -123], [14, -81], [16, -51], [18, -29], [20, -15], [22, -7], [24, -3], [26, -1], [28, 0]] as const;
export const redDossierState = (context: FrameContext, nameWords: number, roleWords: number) => {
  const t = context.frame / context.fps, k = redDossierSpec;
  const ease = (start: number, dur: number) => progress(t, start, start + dur, 'out-cubic');
  return {
    slide: interpolate(t * 30, slide.map((p) => p[0]), slide.map((p) => p[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    halo: progress(t, k.disc.haloIn[0], k.disc.haloIn[1], 'in-out-cubic'),
    lines: Array.from({length: nameWords}, (_, i) => ease(k.name.start + i * k.name.stagger, k.name.duration)),
    words: Array.from({length: roleWords}, (_, i) => ease(k.role.start + i * k.role.stagger, k.role.duration)),
  };
};
