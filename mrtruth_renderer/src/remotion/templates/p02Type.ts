/**
 * P02's TYPE AND CARD, AS DRAWN, AND AS THE CHOOSER MEASURES THEM.
 *
 * A FILE OF ITS OWN, as `p04Type.ts` is for P04, so the mirror test in
 * `apps/web/src/lib/p02Mirror.test.ts` can pin `packages/core/src/p02Fit.ts`
 * against these numbers from the plain node lane, without loading a component.
 * It imports nothing. Every value is the accepted pack's own
 * (`remotion-source/src/templates/P02.tsx`), except the two weights below.
 *
 * ####################################################################
 * # THE WEIGHTS ARE DECIDED HERE, NOT LEFT TO CHROME.                 #
 * #                                                                   #
 * # `FONT_FAMILY` registers Libre Franklin at 300, 500, 600 and 800   #
 * # (`fonts.ts`), and a weight the browser cannot honour synthesises  #
 * # silently. The pack set BOTH lines at 700, which is not one: the   #
 * # label in Arial bold and the headline in Georgia bold. 600 is the  #
 * # registered weight `P03.tsx` measured against the pack's own       #
 * # preview for the same 700, and the one `P04.tsx` took for its      #
 * # label. It is a STATIC face (`LibreFranklin-SemiBold.woff2`), so    #
 * # `p02Fit.ts` can sum its advances exactly.                         #
 * #                                                                   #
 * # THE HEADLINE LOSES ITS SERIF, BY RULING. The pack's Georgia is a   #
 * # macOS face with no file here and would fall back to Liberation on #
 * # the render box without a word. Every reel template sets           #
 * # `FONT_FAMILY`, as `P12.tsx` does.                                  #
 * ####################################################################
 *
 * THE CARD IS BORDER-BOX, AND A RENDER SAYS SO. The pack's preview.mp4 draws the
 * paper from x 170 to x 819, 650 px including its padding and border, so the
 * headline's own box is 650 - 2 x 62 - 2 x 1 = 524 px wide and the pack's
 * `maxWidth: 530` never binds. `contentWidthPx` below is that 524, and it is the
 * width the chooser's gate lays both lines into.
 */
export const P02_TYPE = {
  /** The card's left edge, the pack's `paddingLeft: 170` on the centring layer. */
  cardLeftPx: 170,
  cardWidthPx: 650,
  cardMinHeightPx: 370,
  cardPaddingTopPx: 54,
  cardPaddingSidePx: 62,
  cardPaddingBottomPx: 58,
  cardBorderPx: 1,
  /** 650 - 2 x 62 - 2 x 1. The width both lines are laid into. See the box above. */
  contentWidthPx: 524,
  cardColour: '#eee9dc',
  rule: { widthPx: 66, heightPx: 4, marginBottomPx: 28, colour: '#b68b4c' },
  label: {
    fontSizePx: 19,
    fontWeight: 600,
    letterSpacingPx: 4.1,
    lineHeight: 1.2,
    marginBottomPx: 24,
    colour: '#8d7353',
  },
  headline: {
    fontSizePx: 59,
    fontWeight: 600,
    lineHeight: 1.08,
    /** The pack's own `maxWidth`. Wider than `contentWidthPx`, so it never binds. */
    maxWidthPx: 530,
    colour: '#26231f',
  },
} as const
