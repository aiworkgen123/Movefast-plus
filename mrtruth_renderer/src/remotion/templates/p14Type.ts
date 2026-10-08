/**
 * P14's DIGIT COLUMN AND TYPE, AS DRAWN, AND AS THE MIRROR TEST MEASURES THEM.
 *
 * A FILE OF ITS OWN, as `p02Type.ts`, `p09Type.ts` and `p05Type.ts` are, so the
 * mirror test in `apps/web/src/lib/p14Mirror.test.ts` can pin the column against
 * the shipped woff2 from the plain node lane, without loading a component. It
 * imports nothing. Every value is the accepted pack's own
 * (`remotion-source/src/templates/P14.tsx`) except the weights and the mask
 * stops, and both exceptions are boxed below.
 *
 * ####################################################################
 * # THE WEIGHTS ARE DECIDED HERE, NOT LEFT TO CHROME.                 #
 * #                                                                   #
 * # `FONT_FAMILY` registers Libre Franklin at 300, 500, 600 and 800   #
 * # (`fonts.ts`), and a weight the browser cannot honour synthesises  #
 * # silently, six hours into a render. The pack set 700 on the digits #
 * # and 700 on the label, and 700 is not one of the four.             #
 * #                                                                   #
 * # THE DIGITS TAKE 600, NOT P12's 800, AND THAT IS A DECISION RATHER #
 * # THAN A COPY. 600 is `LibreFranklin-SemiBold.woff2`, a STATIC      #
 * # face, so every digit's advance can be summed exactly out of its   #
 * # own `hmtx` table and the "does it fit the column" question has an #
 * # arithmetic answer. 800 is an instance of the VARIABLE file, whose #
 * # advances this repo has no reader for, so the same question would  #
 * # only ever be answerable by looking at a picture. A column that    #
 * # clips a digit is the one defect this template can ship, so the    #
 * # measurable weight wins. It is also the weight P02, P03, P04, P09  #
 * # and P05 all took for the pack's 700.                              #
 * #                                                                   #
 * # THE DIGITS LOSE THEIR SERIF, BY RULING. The pack asked for three  #
 * # macOS serif faces with no font file and no `@font-face` rule to   #
 * # resolve them, so on the render box every one of them would miss   #
 * # to Liberation Serif without a word. Every reel template sets      #
 * # `FONT_FAMILY`, as `P12.tsx` does. The pack's stacks are NOT       #
 * # quoted here, for the reason edit 2 in `P14.tsx` gives: a `grep`   #
 * # for them across `apps/web/src/` is the gate that proves the edit. #
 * ####################################################################
 *
 * ####################################################################
 * # THE MASK STOPS MOVED, AND CHANGING THE FACE IS WHY.               #
 * #                                                                   #
 * # The column is 126 px tall and holds a strip of digits at a 126 px #
 * # pitch. A vertical mask hides the neighbours: the pack wrote it as #
 * # transparent at 0, opaque from 16% to 84%, transparent at 100% —   #
 * # an opaque band from 20.16 px to 105.84 px.                        #
 * #                                                                   #
 * # THOSE PERCENTAGES BELONG TO THE PACK'S FACE, NOT TO OURS. Read    #
 * # out of `LibreFranklin-SemiBold.woff2` at 132 px in a 126 px line  #
 * # box, the baseline lands at 110.52 px and the cap top at 12.58 px  #
 * # (tmp/v53/templates/P14/p14-metrics.out.txt). So a settled digit   #
 * # runs from 12.58 to about 111.8 px once the round figures'         #
 * # overshoot is counted, and the pack's band contains neither end:   #
 * # 7.6 px of every digit's top and 5.9 px of its foot would sit on   #
 * # the gradient ramp, half faded, on a frame that is supposed to be  #
 * # locked and still. That is not the pack's look, it is our face     #
 * # poking out of the pack's window.                                  #
 * #                                                                   #
 * # SO THE BAND IS SET FROM THE MEASURED INK, WITH A MARGIN. 5 and 95 #
 * # percent is 6.3 px to 119.7 px. A still rendered through           #
 * # `look-still.ts --device=P14` at frame 60 puts the settled digits' #
 * # ink at y 124 to 223 with the block's top at 112, so 12 px to 111  #
 * # inside the column — inside the band with 5.7 px of margin at the  #
 * # top and 8.7 at the foot. Measured on that still, the top eight    #
 * # rows of every glyph read 0.944 of the glyph's own middle and the  #
 * # bottom six read 1.01, which is antialiasing rather than the mask: #
 * # the pack's own preview frames read 0.90 to 1.11 on the same test. #
 * # (tmp/v53/templates/P14/measure-p14-stills.out.txt)                #
 * #                                                                   #
 * # Everything else about the mask is the pack's: still a 180deg      #
 * # linear gradient, still transparent at both ends, still one digit  #
 * # in the window at rest and two mid-roll, which is the whole point  #
 * # of an odometer.                                                   #
 * #                                                                   #
 * # WHAT THIS COSTS: about 14 px more of the neighbouring digit is    #
 * # visible at each edge WHILE A COLUMN IS ROLLING. Nothing is        #
 * # visible at rest, because the strip is aligned to the digit and    #
 * # the next one starts 126 px away against a 99 px glyph.            #
 * ####################################################################
 */
export const P14_TYPE = {
  /** The pack's `right: 132` and `top: 112`, and its 600 px right-aligned block. */
  blockRightPx: 132,
  blockTopPx: 112,
  blockWidthPx: 600,
  /** The pack's 46 px slide from the right, with the block fading in behind it. */
  blockSlidePx: 46,
  digits: {
    /** The pack's `digitHeight`: the column's height, the strip's pitch and the line box. */
    heightPx: 126,
    /** The pack's `width: 104` on each column, and its 7 px flex gap. */
    columnWidthPx: 104,
    gapPx: 7,
    fontSizePx: 132,
    /** SemiBold, a static face. See the box above. */
    fontWeight: 600,
    /**
     * The pack's 40-entry strip of `index % 10`, so a column may roll through
     * three whole decades without running off either end of it.
     */
    stripLength: 40,
    /**
     * The opaque band, as a fraction of `heightPx`. See the box above: these are
     * the pack's 0.16 and 0.84 re-measured for Libre Franklin SemiBold.
     */
    maskOpaqueFrom: 0.05,
    maskOpaqueTo: 0.95,
    colour: '#F2EEE6',
    textShadow: '0 3px 16px rgba(0, 0, 0, 0.56)',
  },
  /** The pack's small upper-case label above the digits. Empty in Rung 1. */
  label: {
    fontSizePx: 15,
    fontWeight: 600,
    letterSpacingPx: 4.1,
    lineHeight: 1.15,
    marginBottomPx: 13,
  },
  /**
   * The pack's 430 px gold rule, drawn right to left under the digits.
   *
   * `glow` is the pack's own `0 0 14px` halo with its rgba restated in the
   * film's gold. `TEXT_CARD.accentColor` is `#C9A227`, so the rgba triple below
   * is 201, 162, 39 at the pack's own 0.26 — the geometry and the opacity are
   * the pack's, only the hue follows edit 3.
   */
  rule: {
    widthPx: 430,
    heightPx: 4,
    marginTopPx: 17,
    glow: '0 0 14px rgba(201, 162, 39, 0.26)',
  },
  /** The pack's italic caption under the rule. Empty in Rung 1. */
  detail: {
    fontSizePx: 31,
    /** 300 is the film's caption weight. The pack set no weight at all here. */
    fontWeight: 300,
    lineHeight: 1.05,
    marginTopPx: 19,
    risePx: 15,
  },
} as const

/**
 * THE PACK'S OWN REDUCTION OF A DATE TO FOUR DIGITS, AND IT IS LOSSY.
 *
 * ##########################################################################
 * # Strip every non-digit, keep the LAST FOUR, pad to four with leading     #
 * # zeroes. Hand it the pack's own contract wording — "verified four-digit  #
 * # year/date" — and it is the identity. Hand it anything else and it       #
 * # invents a year without a word: "364 CE" becomes 0364, "third century    #
 * # BCE" becomes 0000, "1947-1956" becomes 1956.                            #
 * #                                                                        #
 * # SO NOTHING ELSE EVER REACHES IT. `deviceChoice.ts` feeds P14 from the   #
 * # `bareYear` detector and only when the mark is exactly four digits, and  #
 * # `BARE_FOUR_DIGIT_YEAR` in `devices.ts` refuses the rest again at the    #
 * # plan boundary. The reduction is KEPT rather than deleted so the         #
 * # component still draws the pack's frame from a hand-written plan, in     #
 * # Studio, or in a test.                                                   #
 * #                                                                        #
 * # HERE RATHER THAN IN `P14.tsx` SO THE MIRROR TEST CAN REACH IT. This     #
 * # file imports nothing, so the plain node lane can pin what the reduction #
 * # does to each bad shape without loading `remotion` to do it.             #
 * ##########################################################################
 */
export function digitsOf(targetYear: string): string[] {
  return targetYear.replace(/\D/g, '').slice(-4).padStart(4, '0').split('')
}
