import type {FrameContext} from './contract.ts';
/** Measured on WTC 02:44.17 (1080p): Montserrat 700, 69.2 px, +0.007 em, ink from x 146. Name types at 33 characters/s; one frame after
 * it completes the role types at 27 characters/s and the name jumps up one line (79 px). A cursor blinks while typing. */
export const typedLabelSpec = {size: 69.2, tracking: 0.007, left: 140, lowerTop: 886, pitch: 79, nameRate: 33, roleRate: 27, gap: 1 / 30, blink: 7.5} as const;
export const typedLabelState = (context: FrameContext, name: string, role = '') => {
  const t = context.frame / context.fps, k = typedLabelSpec, n = Array.from(name).length, r = Array.from(role).length;
  const nameDone = n / k.nameRate, roleStart = nameDone + k.gap;
  const nameChars = Math.min(n, Math.floor(t * k.nameRate) + 1);
  const roleChars = r && t >= roleStart ? Math.min(r, Math.floor((t - roleStart) * k.roleRate) + 1) : 0;
  const typing = nameChars < n || (r > 0 && roleChars < r);
  return {nameChars, roleChars, nameUp: roleChars > 0, cursorOn: typing && Math.floor(t * k.blink) % 2 === 0, cursorLine: roleChars > 0 ? 'role' as const : 'name' as const};
};
