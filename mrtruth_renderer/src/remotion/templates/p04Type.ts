/**
 * P04's TYPE, AS DRAWN, AND AS THE CHOOSER MEASURES IT.
 *
 * A FILE OF ITS OWN, as `shadowUpClock.ts` is for 05, so the mirror test in
 * `apps/web/src/lib/p04Mirror.test.ts` can pin `packages/core/src/p04Fit.ts`
 * against these numbers from the plain node lane, without loading a component.
 * It imports nothing. Every value is the accepted pack's own
 * (`remotion-source/src/templates/P04.tsx`), except the two weights below.
 *
 * ####################################################################
 * # THE WEIGHTS ARE DECIDED HERE, NOT LEFT TO CHROME.                 #
 * #                                                                   #
 * # `FONT_FAMILY` registers Libre Franklin at 300, 500, 600 and 800   #
 * # (`fonts.ts`), and a weight the browser cannot honour synthesises  #
 * # silently. The pack's main line asked for 700, which is not one:   #
 * # 600 is the registered weight `P03.tsx` took for the same 700 on   #
 * # its headline, measured there against the pack's preview. The      #
 * # support line asked for no weight, which reads as 400, also not    #
 * # registered: 500 is the film's own body weight and the weight      #
 * # `P03.tsx` took for its own serif-italic kicker.                   #
 * #                                                                   #
 * # BOTH ARE STATIC FACES (`LibreFranklin-SemiBold.woff2` and          #
 * # `LibreFranklin-Medium.woff2`), which is what lets `p04Fit.ts` sum  #
 * # their advances exactly. The 300 and 800 come from the variable    #
 * # file, whose widths move with the weight axis.                     #
 * #                                                                   #
 * # THE ITALIC IS A SLANT CHROME MAKES. No italic face is registered   #
 * # under `FONT_FAMILY`, so the support line is the upright Medium     #
 * # sheared. A shear keeps every advance, so the width gate still      #
 * # holds. It is the same synthesised oblique `P03.tsx`'s kicker draws. #
 * ####################################################################
 */
export const P04_TYPE = {
  /** The pack's `maxWidth: 620`, the block both lines wrap inside. */
  labelMaxWidthPx: 620,
  labelLeftPx: 138,
  labelBottomPx: 112,
  main: {
    fontSizePx: 48,
    fontWeight: 600,
    letterSpacingPx: 2.2,
    lineHeight: 1.05,
    colour: '#f0eadb',
    textShadow: '0 2px 12px rgba(0, 0, 0, 0.62)',
  },
  support: {
    fontSizePx: 23,
    fontWeight: 500,
    letterSpacingPx: 1.9,
    lineHeight: 1.1,
    marginTopPx: 8,
    colour: '#d8bd88',
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.58)',
  },
  rule: { heightPx: 4, widthPx: 42, marginBottomPx: 16, colour: '#c39a52' },
} as const
