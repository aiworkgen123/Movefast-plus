/**
 * P05's TYPE, PANEL AND STROKE, AS DRAWN, AND AS THE CHOOSER MEASURES THEM.
 *
 * A FILE OF ITS OWN, as `p02Type.ts` is for P02, so the mirror test in
 * `apps/web/src/lib/p05Mirror.test.ts` can pin `packages/core/src/p05Fit.ts`
 * against these numbers from the plain node lane, without loading a component.
 * It imports nothing. Every value is the accepted pack's own
 * (`remotion-source/src/templates/P05.tsx`), except the weights, the panel's
 * height and the stroke's clock, each boxed below.
 *
 * ####################################################################
 * # THE WEIGHTS ARE DECIDED HERE, NOT LEFT TO CHROME.                 #
 * #                                                                   #
 * # `FONT_FAMILY` registers Libre Franklin at 300, 500, 600 and 800   #
 * # (`fonts.ts`), and a weight the browser cannot honour synthesises  #
 * # silently. The pack set the eyebrow, the headline and the image    #
 * # label in Arial at 700, which is not one: 600 is the registered    #
 * # weight `P03.tsx`, `P04.tsx` and `P02.tsx` took for the same 700.  #
 * # The support line asked for Georgia italic at no weight, which     #
 * # reads as 400, also not registered: 500 is the film's body weight  #
 * # and the weight `P04.tsx` took for its own serif-italic line.      #
 * #                                                                   #
 * # BOTH ARE STATIC FACES (`LibreFranklin-SemiBold.woff2` and          #
 * # `LibreFranklin-Medium.woff2`), which is what lets `p05Fit.ts` sum  #
 * # their advances exactly.                                           #
 * #                                                                   #
 * # THE SERIF IS GONE, BY RULING, AND THE ITALIC IS A SLANT CHROME     #
 * # MAKES. Georgia and Arial are macOS faces with no file here and    #
 * # would fall back to Liberation on the render box without a word.   #
 * # No italic face is registered, so the support line is the upright   #
 * # Medium sheared, which keeps every advance.                         #
 * ####################################################################
 *
 * ####################################################################
 * # THE PANEL IS SQUARE, 770 BY 770, BY RULING R1.                    #
 * #                                                                   #
 * # The pack drew a 770 by 820 panel, a picture box 746 by 796 inside #
 * # its 12 px padding: 0.94 wide for every 1 tall, narrower than      #
 * # square. R1 (2026-09-11) says no picture narrower than square      #
 * # reaches the screen anywhere, and `FILLABLE_ASPECT` in `crop.ts`    #
 * # is the 1.0 it reads. At 770 by 770 the picture box is 746 by 746, #
 * # exactly 1.0, which passes. The developer took that on 2026-09-13; #
 * # the look moves by 50 px of height, 25 at the top and 25 at the    #
 * # foot, because the panel stays centred on the frame's height.      #
 * ####################################################################
 *
 * THE PANEL IS BORDER-BOX, AND THE PACK'S OWN PREVIEW SAYS SO. `preview.png`
 * draws the gold stroke from x 1000 to x 1769, 770 px including the padding, and
 * the picture from x 1012 to x 1757. So the text column is border-box too: 760 px
 * less its 82 px right padding leaves 678 px, and that is the width the chooser's
 * gate lays the eyebrow and the headline into.
 */
export const P05_TYPE = {
  /** The text layer's `paddingLeft: 145`. */
  columnLeftPx: 145,
  columnWidthPx: 760,
  columnPaddingRightPx: 82,
  /** 760 - 82. The width the eyebrow and headline are laid into. See the box above. */
  contentWidthPx: 678,
  rule: { widthPx: 72, heightPx: 4, marginBottomPx: 26, colour: '#c39a52' },
  eyebrow: {
    fontSizePx: 20,
    fontWeight: 600,
    letterSpacingPx: 4.2,
    lineHeight: 1.2,
    marginBottomPx: 19,
    colour: '#d8bd88',
  },
  headline: {
    fontSizePx: 78,
    fontWeight: 600,
    letterSpacingPx: 0.4,
    lineHeight: 0.98,
    colour: '#f0eadb',
    textShadow: '0 3px 18px rgba(0, 0, 0, 0.55)',
  },
  support: {
    /** The pack's own `maxWidth`, narrower than the column, so it binds. */
    maxWidthPx: 580,
    marginTopPx: 28,
    fontSizePx: 27,
    fontWeight: 500,
    letterSpacingPx: 0.6,
    lineHeight: 1.2,
    colour: '#cfc2a4',
  },
  panel: {
    /** The picture layer's `paddingLeft: 1000`. */
    leftPx: 1000,
    widthPx: 770,
    /** 770, not the pack's 820. See the R1 box above. */
    heightPx: 770,
    /** The pack's own height, kept here so a test can say what moved. */
    packHeightPx: 820,
    paddingPx: 12,
    backgroundColour: 'rgba(16, 14, 11, 0.82)',
  },
  stroke: { thicknessPx: 5, colour: '#c39a52' },
  imageLabel: {
    /** `left: 12, bottom: 12` inside the panel, which is the panel's padding. */
    insetPx: 12,
    paddingTopPx: 10,
    paddingSidePx: 14,
    paddingBottomPx: 9,
    fontSizePx: 17,
    fontWeight: 600,
    letterSpacingPx: 2.5,
    lineHeight: 1.1,
    colour: '#f0eadb',
    backgroundColour: 'rgba(9, 9, 8, 0.72)',
    /**
     * The widest one line of label that stays on the picture: the picture box is
     * 746 px (770 - 2 x 12), the label starts 12 px in, and its backing adds 14 px
     * each side, so 770 - 12 - 12 - 14 - 14 = 718.
     */
    maxTextWidthPx: 718,
  },
  /** The last 0.35 s fade everything out, as the pack's `exit` does. */
  exitSeconds: 0.35,
  /** The pack's stroke finishes 5 s in. See `p05StrokeEndFrame`. */
  strokePackEndSeconds: 5,
  /**
   * The pack's own gap between the whole frame and the fade: 180 frames less the
   * 0.35 s exit is 169.5, and the stroke closed at 150, so 19.5 frames, 0.65 s.
   */
  strokeHoldBeforeExitSeconds: 0.65,
} as const

/**
 * THE FRAME THE GOLD STROKE CLOSES ON, TIMED FROM THE SHOT'S OWN LENGTH.
 *
 * ##########################################################################
 * # THE PACK'S STROKE CLOSES AT FRAME 150 AND NO SHOT WAS THAT LONG.       #
 * #                                                                        #
 * # Its clock is `interpolate(frame, [0, 5 * fps], ...)`, a fixed five     #
 * # seconds. The longest shot of V50 is 148 frames, so as written the      #
 * # fourth edge was still drawing when every P05 faded out, on every shot. #
 * #                                                                        #
 * # SO IT CLOSES AT THE EARLIER OF THE PACK'S FIVE SECONDS AND ONE SECOND  #
 * # BEFORE THE SHOT ENDS: the 0.35 s fade plus the 0.65 s the pack's own    #
 * # 180-frame fixture holds the whole frame before that fade. On the       #
 * # pack's 180 frames this is 150, identical to the pack. On 120 frames it #
 * # is 90, a quarter-second faster per edge, still clockwise from the top  #
 * # left, and the whole frame holds for the pack's 0.65 s before it fades. #
 * #                                                                        #
 * # NEVER UNDER ONE FRAME, so the input range stays strictly increasing on #
 * # any length `renderOne` might hand it. The chooser's 120-frame floor is  #
 * # what keeps the stroke readable; this is only what keeps it valid.      #
 * ##########################################################################
 */
export function p05StrokeEndFrame(durationInFrames: number, fps: number): number {
  const pack = P05_TYPE.strokePackEndSeconds * fps
  const beforeTheFade =
    durationInFrames - (P05_TYPE.exitSeconds + P05_TYPE.strokeHoldBeforeExitSeconds) * fps
  return Math.max(1, Math.min(pack, beforeTheFade))
}
