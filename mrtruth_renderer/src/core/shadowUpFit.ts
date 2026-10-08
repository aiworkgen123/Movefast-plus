import { FRAME_WIDTH } from './schemas.js'

/**
 * TEMPLATE 05's LINE, MEASURED BEFORE IT MAY REACH A FRAME.
 *
 * ##########################################################################
 * # 05 DRAWS ONE LINE THAT NEVER WRAPS. The component sets it `nowrap`,    #
 * # centred, in Bebas Neue at 104 px with 1.25 px of letter-spacing,       #
 * # upper-cased and with kerning off. A line wider than the title-safe     #
 * # width is clipped by the frame, at exit 0, with nothing red anywhere.   #
 * #                                                                        #
 * # SO IT SUMS THE FACE'S OWN ADVANCES, which is the a3 lesson             #
 * # (`operatorPlacement.ts`, the box on the chapter-title mirror): a count  #
 * # of characters let hand-typed titles run off both edges. Thirty W and   #
 * # thirty I are the same count, and 1775 against 637 px.                  #
 * #                                                                        #
 * # KERNING IS OFF IN THE COMPONENT so the drawn width is exactly this     #
 * # sum. The face carries a GPOS table and Chrome would kern by default.   #
 * # An unmeasured character refuses the line rather than guessing, because #
 * # Chrome would draw it in a fallback face at a width nothing here knows.  #
 * ##########################################################################
 *
 * BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `operatorPlacement.ts`. The
 * compositor imports @vg/core/{schemas,devices,frames,motion} and nothing else,
 * so nothing here can move `bundleHash`.
 *
 * Mirrored because `packages/core` cannot import from `apps/web`.
 * `apps/web/src/lib/shadowUpMirror.test.ts` pins every advance against the woff2
 * bytes `condensedFaceData.ts` inlines, and `shadowUpTypeMirror.test.ts` pins the
 * size and spacing against the template's own clock.
 */

/**
 * Bebas Neue's advance for each character a line may hold, in thousandths of an
 * em (`unitsPerEm` 1000), off the `hmtx` table of the face `condensedFaceData.ts`
 * inlines. Capitals only, because the line is upper-cased before it is measured,
 * as the component draws it: printable ASCII, the curly quotes, both dashes, the
 * ellipsis and the Latin-1 capitals. Read off the bytes by
 * `tmp/v52/template-05/bebas-metrics.mjs`, never typed from a specimen.
 */
export const SHADOW_UP_ADVANCE_MIRROR: Readonly<Record<string, number>> = {
  ' ': 160, '!': 210, '"': 336, '#': 412, '$': 400, '%': 589, '&': 417, "'": 188,
  '(': 276, ')': 276, '*': 422, '+': 400, ',': 188, '-': 270, '.': 188, '/': 389,
  '0': 400, '1': 400, '2': 400, '3': 400, '4': 400, '5': 400, '6': 400, '7': 400, '8': 400, '9': 400,
  ':': 188, ';': 188, '<': 400, '=': 400, '>': 400, '?': 363, '@': 696,
  A: 401, B: 404, C: 383, D: 406, E: 363, F: 344, G: 391, H: 420, I: 192, J: 265, K: 414, L: 344, M: 538,
  N: 427, O: 400, P: 386, Q: 400, R: 403, S: 372, T: 364, U: 402, V: 382, W: 557, X: 406, Y: 394, Z: 362,
  '[': 276, '\\': 389, ']': 276, '^': 400, _: 300, '`': 500, '{': 276, '|': 500, '}': 276, '~': 400,
  '‘': 188, '’': 188, '“': 336, '”': 336, '–': 300, '—': 500, '…': 500,
  À: 401, Á: 401, Â: 401, Ã: 401, Ä: 401, Å: 401, Æ: 580, Ç: 383, È: 363, É: 363, Ê: 363, Ë: 363,
  Ì: 192, Í: 192, Î: 192, Ï: 192, Ð: 423, Ñ: 427, Ò: 400, Ó: 400, Ô: 400, Õ: 400, Ö: 400, Ø: 400,
  Ù: 402, Ú: 402, Û: 402, Ü: 402, Ý: 394, Þ: 386,
}

/**
 * The template's font size. Matched on CAP HEIGHT, not on the name of the face:
 * Bebas's cap is 0.700 em, so 104 px draws a 72.8 px cap against the 73 rows his
 * approved preview measures.
 */
export const SHADOW_UP_FONT_SIZE_MIRROR = 104

/** His `letterSpacing`, byte for byte. */
export const SHADOW_UP_LETTER_SPACING_MIRROR = 1.25

/** `SAFE_AREA_X` in the compositor's `constants.ts`, the margin the captions keep. */
export const SHADOW_UP_SAFE_MARGIN_MIRROR = 96

/** The title-safe width a line must fit inside: 1728 px of a 1920 px frame. */
export const SHADOW_UP_MAX_WIDTH = FRAME_WIDTH - 2 * SHADOW_UP_SAFE_MARGIN_MIRROR

/**
 * How wide a line draws, in screen pixels, upper-cased the way the component
 * draws it, or null when it holds a character the mirror does not name.
 *
 * `letter-spacing` is added after every character INCLUDING THE LAST, which is
 * what Chrome puts into the line's own width (the rule `p03WordWidth` records).
 * A doubled space is counted twice although `nowrap` draws one, so such a line
 * measures a few pixels wide. That errs towards refusing.
 */
export function shadowUpLineWidth(line: string): number | null {
  let thousandths = 0
  let characters = 0
  for (const character of line.toUpperCase()) {
    const advance = SHADOW_UP_ADVANCE_MIRROR[character]
    if (advance === undefined) return null
    thousandths += advance
    characters += 1
  }
  return (thousandths / 1000) * SHADOW_UP_FONT_SIZE_MIRROR + characters * SHADOW_UP_LETTER_SPACING_MIRROR
}

/** Does this line draw inside the title-safe width? A line holding an unmeasured character does not. */
export function shadowUpLineFits(line: string): boolean {
  const width = shadowUpLineWidth(line)
  return width !== null && width <= SHADOW_UP_MAX_WIDTH
}
