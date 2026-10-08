/**
 * P09's TYPE AND CARD, AS DRAWN, AND AS THE CHOOSER MEASURES THEM.
 *
 * A FILE OF ITS OWN, as `p02Type.ts` is for P02, so the mirror test in
 * `apps/web/src/lib/p09Mirror.test.ts` can pin `packages/core/src/p09Fit.ts`
 * against these numbers from the plain node lane, without loading a component.
 * It imports nothing. Every value is the accepted pack's own
 * (`remotion-source/src/templates/P09.tsx`), except the two weights below.
 *
 * ####################################################################
 * # THE WEIGHTS ARE DECIDED HERE, NOT LEFT TO CHROME.                 #
 * #                                                                   #
 * # `FONT_FAMILY` registers Libre Franklin at 300, 500, 600 and 800   #
 * # (`fonts.ts`), and a weight the browser cannot honour synthesises  #
 * # silently. The pack set BOTH lines at 700, which is not one: the   #
 * # label in Avenir Next bold and the question in New York bold. 600  #
 * # is the registered weight `P02.tsx` and `P03.tsx` took for the     #
 * # same 700. It is a STATIC face (`LibreFranklin-SemiBold.woff2`),   #
 * # so `p09Fit.ts` can sum its advances exactly.                      #
 * #                                                                   #
 * # THE QUESTION LOSES ITS SERIF, BY RULING. New York, Palatino and    #
 * # Georgia are macOS faces with no file here and would fall back to  #
 * # Liberation on the render box without a word. Every reel template  #
 * # sets `FONT_FAMILY`, as `P12.tsx` does.                             #
 * ####################################################################
 *
 * THE CARD IS BORDER-BOX, AS THE PACK WRITES IT (`boxSizing: 'border-box'`), so
 * its content box is 760 - 2 x 44 - 2 x 1 = 670 px wide. The label has no measure
 * of its own and is laid into that 670. The question carries the pack's
 * `maxWidth: 650`, which is narrower, so it binds and the question is laid into
 * 650. The card is pinned by its TOP, not centred, so every question line grows
 * it downward over the picture.
 */
export const P09_TYPE = {
  /** The pack's `left: 150` and `top: 335`, both absolute. */
  cardLeftPx: 150,
  cardTopPx: 335,
  cardWidthPx: 760,
  cardPaddingTopPx: 34,
  cardPaddingSidePx: 44,
  cardPaddingBottomPx: 38,
  cardBorderPx: 1,
  /** 760 - 2 x 44 - 2 x 1. The width the label is laid into. See the box above. */
  contentWidthPx: 670,
  /** The pack's translucent fill. 70 percent, so the picture still shows through it. */
  cardFill: 'rgba(16, 16, 14, 0.70)',
  cardBorderColour: 'rgba(195, 154, 82, 0.62)',
  cardShadow: '12px 18px 36px rgba(0, 0, 0, 0.22)',
  rule: { widthPx: 66, heightPx: 4, marginBottomPx: 22, colour: '#c39a52' },
  label: {
    fontSizePx: 15,
    fontWeight: 600,
    letterSpacingPx: 3.8,
    lineHeight: 1.15,
    marginBottomPx: 18,
    colour: '#d0a862',
  },
  question: {
    fontSizePx: 54,
    fontWeight: 600,
    lineHeight: 1.08,
    /** The pack's own `maxWidth`. Narrower than `contentWidthPx`, so it binds. */
    maxWidthPx: 650,
    colour: '#f0eadb',
    textShadow: '0 2px 16px rgba(0, 0, 0, 0.30)',
  },
} as const
