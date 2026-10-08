/**
 * The bullet-point checklist overlay's clock and geometry, as pure functions.
 *
 * ####################################################################
 * # THIS MODULE MUST NEVER IMPORT `remotion`.                         #
 * #                                                                   #
 * # Same rule as the other clock modules. The `.test.ts` lane runs    #
 * # under `--conditions react-server`, where a `remotion` import dies #
 * # at the import line with an error that reads nothing like the real #
 * # cause. This file imports NOTHING, which is stronger still.        #
 * ####################################################################
 *
 * WHAT THIS IS. The client's seventh reference animation, at 0:32 of
 * `Templates (Unseperated).mp4`. His own words:
 *
 *   WHAT     a full backgound image with Bullet container, contains of
 *            checklist
 *   FROM/TO  the backfround image is static, to slowly open the Bulet
 *            container like a carlendar then 1 by 1 checking the checklist
 *   WHEN     starts at 0:32, takes 4 seconds
 *   HOW      slow
 *
 * A full-bleed photograph. Over its right-hand side an olive header bar
 * carrying "BULLET POINT OVERLAY" is uncovered by a mask sweeping leftward from
 * the frame edge. A cream paper panel then unrolls downward beneath it, and
 * three checklist rows reveal one after another, each with a checkbox that
 * darkens as a green tick draws into it.
 *
 * ####################################################################
 * # THE HANDOFF NOTES DESCRIBED a7 WRONG AND THIS FILE IS THE         #
 * # CORRECTION.                                                       #
 * #                                                                   #
 * # `handoff/now.md` and `HANDOFF.md` both called a7 "four pieces of  #
 * # hand-drawn artwork and a marker script face nobody has            #
 * # identified", and START HERE item 5 called it "the dearest" of the #
 * # nine on that basis.                                               #
 * #                                                                   #
 * # There is no hand-drawn artwork in a7. There is ONE photograph and #
 * # a vector overlay. The only true half was the marker script face,  #
 * # which is the checklist rows. Nothing else in his reel is          #
 * # hand-drawn artwork either, so this was not two animations swapped #
 * # — it was simply wrong, and it had been carried unchallenged for   #
 * # three sessions because nobody had opened the frames.              #
 * ####################################################################
 *
 * ####################################################################
 * # THREE THINGS A BUILDER MUST READ FIRST.                           #
 * #                                                                   #
 * # 1. THE PHOTOGRAPH REALLY IS STATIC, AND THIS IS THE FIRST TIME IN #
 * #    THE REEL HIS "static" IS LITERALLY TRUE. Translation under     #
 * #    0.005px and |k-1| under 5.4e-06 across all 120 frames, against #
 * #    a control that recovers a deliberate 0.03px shift at 10 sigma. #
 * #    Give it NO transform. Not a 1.0-to-1.0 scale, none at all.     #
 * #                                                                   #
 * # 2. THE HEADER DOES NOT SLIDE. The bar and its title are ONE       #
 * #    STATIC IMAGE and a hard mask edge sweeps across them. Sliding  #
 * #    them in together is wrong by 776px at local 14 and still 229px #
 * #    at local 20, and it looks entirely plausible on its own.       #
 * #                                                                   #
 * # 3. THE MASK CLIPS THE HEADER ONLY. The cream panel appears at     #
 * #    local 21 ALREADY at its final left edge of 1040, while the     #
 * #    mask is still out at 1172. It has its own reveal. Parent the   #
 * #    panel to the header's mask and it is wrong for 16 frames.      #
 * ####################################################################
 *
 * ####################################################################
 * # STATUS: EVERY ELEMENT IS MEASURED. TWO ARE LESS VERIFIED THAN THE #
 * # REST, AND THEY ARE NAMED.                                         #
 * #                                                                   #
 * # Fully measured with an adversarial pass behind them: the window,  #
 * # the photograph, the bar, the wipe, the title's face and setting,  #
 * # the cream panel, and the checklist rows.                          #
 * #                                                                   #
 * # MEASURED HERE, WITHOUT THAT SECOND PASS: the checkboxes and their #
 * # ticks, because the agent that owned them died in an outage. Their #
 * # geometry, colours and 12-frame beat are firm; their two EASINGS   #
 * # are the softest numbers on a7. Also soft: the rows' WEIGHT, where #
 * # 700 beats 600 by only 6.6%.                                       #
 * #                                                                   #
 * # FOUR PLAUSIBLE READINGS WERE WRONG ON THIS ANIMATION ALONE:       #
 * #   the header looked like a slide and is a mask                    #
 * #   the panel looked like an unroll and is a straight clip          #
 * #   the rows look like a soft wipe and are per-character fades      #
 * #   the title looked like the wrong face and was the right face     #
 * #     set with the wrong tracking                                   #
 * #                                                                   #
 * # Every one was caught by measuring, and the last by measuring      #
 * # AFTER a render had already been judged by eye. Do not add         #
 * # anything here from a plausible reading.                           #
 * ####################################################################
 *
 * ####################################################################
 * # THE TWO PHASES OVERLAP BY 17 FRAMES AND THAT IS THE EXPENSIVE     #
 * # MISTAKE.                                                          #
 * #                                                                   #
 * # The bar's wipe runs local 0..37. The panel's clip runs local      #
 * # 20..56. At the frame the panel begins, the bar is still 230px     #
 * # short of home with 26% of its travel left.                        #
 * #                                                                   #
 * # Chaining them — starting the panel when the bar lands — puts the  #
 * # whole checklist phase 0.567s late. That is precisely the failure  #
 * # a8 already paid for, where three phases overlapped and chaining   #
 * # them put the middle of the clip a third of a second late.         #
 * ####################################################################
 */

/**
 * The shot, cut to cut: source frames 965..1084 inclusive.
 *
 * ####################################################################
 * # 120 FRAMES, EXACTLY 4.000 SECONDS, AND HIS DURATION IS RIGHT.     #
 * #                                                                   #
 * # Both boundaries are hard cuts against the flat separator plate    #
 * # that recurs between every animation in the reel, and the plate    #
 * # frames either side are BIT-IDENTICAL to one another — 25 frames   #
 * # before and 11 after, maxdiff 0 of 255. So the noise floor those   #
 * # cuts clear is zero.                                               #
 * #                                                                   #
 * # There is NO FADE at either end. A dissolve would pull the         #
 * # boundary frame toward the plate; mad(local 0, plate) is 84.125    #
 * # against mad(local 1, plate) at 84.325, so local 0 is very         #
 * # slightly FURTHER from the plate than local 1 rather than half way #
 * # to it. Hard cut in, hard cut out.                                 #
 * #                                                                   #
 * # HE SAID "starts at 0:32", WHICH IS SOURCE FRAME 960. It starts at #
 * # 965, five frames and 0.167s later. Same direction and roughly the #
 * # same size as every other start time he has given in this reel.    #
 * #                                                                   #
 * # HIS "4 seconds" IS EXACT, and that is the second time in nine     #
 * # that a duration of his has been right. a8's was the first. Do not #
 * # let a correct duration lend credibility to the start time beside  #
 * # it — on a8 they sat together and only one of them was true.       #
 * ####################################################################
 */
export const BULLET_CHECKLIST_TOTAL_FRAMES = 120

/** The inclusive last frame, which is what the clip harness's map wants. */
export const BULLET_CHECKLIST_LAST_FRAME = BULLET_CHECKLIST_TOTAL_FRAMES - 1

/**
 * The overlay's left boundary: a hard one-pixel edge with nothing outside it.
 *
 * ####################################################################
 * # THE BAR AND THE PANEL SHARE THIS LINE TO 0.001 PIXELS, SO THEY    #
 * # SHARE THE CONSTANT.                                               #
 * #                                                                   #
 * # Bar 1040.0012, panel 1040.0000. Measured independently, on        #
 * # different colours, against different backgrounds.                 #
 * #                                                                   #
 * # Column means of the settled frame against the clean plate, over   #
 * # the overlay's own rows:                                           #
 * #                                                                   #
 * #   x     1036  1037  1038  1039 | 1040    1041    1042             #
 * #   mad   0.75  0.76  0.88  0.96 | 158.22  157.47  156.20           #
 * #                                                                   #
 * # Column 1039 sits at the compression noise level. So there is NO   #
 * # drop shadow, NO glow and NO feather spilling onto the photograph. #
 * # A 5%-opacity black shadow against the bright sky there would have #
 * # read as -6.4 levels; the measurement is -0.07 to +0.09.           #
 * #                                                                   #
 * # This also makes `x < 1040` an EXACTLY safe region for measuring   #
 * # the photograph rather than an approximately safe one, which is    #
 * # what the static-photograph proof leans on.                        #
 * ####################################################################
 */
export const BULLET_CHECKLIST_OVERLAY_LEFT = 1040

/**
 * The photograph. There is nothing to animate and that is the measurement.
 *
 * ####################################################################
 * # DO NOT GIVE THIS A TRANSFORM, AND DO NOT REPRODUCE THE FIRST      #
 * # FOUR FRAMES' "SETTLE".                                            #
 * #                                                                   #
 * # Whole-frame difference against local 0 rises 0 -> 0.66 over local #
 * # 0..4 and then locks flat for 115 frames, which is exactly the     #
 * # shape of a four-frame settle move. IT IS NOT ONE. It is h264      #
 * # recovering from the cut's keyframe, and four things prove it:     #
 * #                                                                   #
 * #   - a free shift explains 0.0% of the residual, where the same    #
 * #     pipeline recovers a synthetic 0.03px shift buried under the   #
 * #     real compression residual at 10 sigma                         #
 * #   - it is CHANNEL-SELECTIVE. R and B wobble by 0.33 and return    #
 * #     while G moves 0.02. A camera move cannot do that.             #
 * #   - in YCbCr it asymptotes rather than arriving and stopping      #
 * #   - it sits on the 8x8 DCT BLOCK GRID. Mean |dY| binned by        #
 * #     x mod 16 peaks at phases 0, 7, 8 and 15, 15% above the block  #
 * #     interiors. A photographic shift has no reason to know where   #
 * #     the 8-pixel grid is.                                          #
 * #                                                                   #
 * # Your own render will produce its own version of this. Adding one  #
 * # deliberately would be reproducing the codec, not the animation.   #
 * ####################################################################
 *
 * ####################################################################
 * # "DOES THE OVERLAY RIDE THE PHOTOGRAPH" IS DEGENERATE HERE, AND    #
 * # SAYING SO IS THE HONEST ANSWER.                                   #
 * #                                                                   #
 * # On a8 that question was worth 740px. Here the photograph's motion #
 * # is bounded at 0.006px at the frame corner, so riding it and being #
 * # pinned to the screen predict pixel-identical output and the       #
 * # frames cannot choose. Both readings collapse to "no transform",   #
 * # so the builder is safe either way ON THIS ANIMATION.              #
 * #                                                                   #
 * # Decide it on one whose photograph actually moves. Do not cite a7  #
 * # as evidence for either reading.                                   #
 * ####################################################################
 */
export const BULLET_CHECKLIST_PHOTO = {
  /** Full-bleed. Every frame edge carries real high-variance photographic content. */
  width: 1920,
  height: 1080,
  /** Measured bracket on the scale, over the whole shot. Stated, never applied. */
  measuredScaleBracket: 5.4e-6,
  /** Measured bracket on the translation, in design px, over the whole shot. */
  measuredTranslationBracketPx: 0.005,
} as const

/**
 * The olive header bar.
 *
 * ####################################################################
 * # THREE EDGES ARE PERFECT AND THE TOP EDGE IS A HAND-DRAWN WOBBLE.  #
 * #                                                                   #
 * #   left    x = 1040.0, dead vertical, sd 0.009px over 163 rows     #
 * #   bottom  y = 335.0, dead horizontal, sd 0.010px over 880 columns #
 * #   right   runs OFF the frame, clipped at 1920                     #
 * #   top     a slow organic wave, mean 166.55, range 159.1 to 169.6  #
 * #                                                                   #
 * # THE BAR IS NOT ROTATED. Every edge's fitted slope is at most      #
 * # 0.125 degrees, and a 1 degree rotation would be 15.4px across an  #
 * # 880px bar. The top edge's residual against a fitted LINE is       #
 * # 1.499px and against a plain CONSTANT is 1.597px — fitting a slope #
 * # buys 0.1px, so the wobble is a wobble and not a tilt.             #
 * #                                                                   #
 * # AND IT IS NOT A RECTANGLE EITHER. That 1.597px residual is 27x    #
 * # the 0.06px edge-position noise floor. Drawing a straight top edge #
 * # is a visible, measurable error, which is why the polyline below   #
 * # exists.                                                           #
 * ####################################################################
 */
export const BULLET_CHECKLIST_BAR = {
  left: BULLET_CHECKLIST_OVERLAY_LEFT,
  bottom: 335,
  /** Area-equivalent mean of a wobbly edge. The shape itself is the polyline. */
  topNominal: 166.55,
  topRange: [159.1, 169.6],
  /**
   * DRAWN PAST THE FRAME ON PURPOSE.
   *
   * The real right edge is off-screen and genuinely undeterminable — the wipe's
   * start position pins the MASK to x = 1920 +- 1, but the art behind it could
   * extend arbitrarily further. Drawing to 1960 and letting the frame clip means
   * no sub-pixel jitter can ever open a one-pixel gap at x = 1919.
   */
  drawRight: 1960,
  /**
   * Flat. Measured over 63,145 pixels clear of the type and the edges.
   *
   * Raw mean (100.93, 132.85, 60.97). Eleven 80px blocks across the bar span
   * 0.8 of 255, and rows down it span under 0.6 — so there is no gradient worth
   * reproducing. The residual per-pixel std of 0.91 falls to 0.44 at a 9x9 box
   * with a 2px correlation length, which is h264 ringing rather than paper
   * grain. Anything below about 1.5 of 255 is inside what the codec is doing.
   */
  fill: '#65853D',
  /** No shadow, no outline, no torn bottom. All three were looked for and are absent. */
  shadow: null,
  outline: null,
} as const

/**
 * The bar's wobbly top edge, decimated from an 880-column trace.
 *
 * ####################################################################
 * # 25 POINTS, AND THE DECIMATION IS ACCOUNTED FOR.                   #
 * #                                                                   #
 * # The full per-column trace lives at tmp/a7work/topedge_profile.csv #
 * # (880 rows). Douglas-Peucker at a 0.45px tolerance against a       #
 * # 9-column smooth keeps 25 points and reproduces the SMOOTH WAVE to #
 * # 0.44px worst case and the RAW trace to 0.348px rms.               #
 * #                                                                   #
 * # For scale: a straight edge misses the raw trace by 1.60px rms, so #
 * # these 25 points cut the error by 4.6x. The remaining 0.348px is   #
 * # dominated by the edge's own fine roughness, which is 0.227px rms  #
 * # and which no polyline can carry.                                  #
 * #                                                                   #
 * # THE LAST FOUR POINTS ARE THE FEATURE, NOT NOISE. The edge lifts   #
 * # sharply over the final 40px — 164.9 at x1880 up to 159.1 at       #
 * # x1906 and back to 164.0 at x1919. That single 6px kick is the     #
 * # most visible departure from a rectangle in the whole bar, and a   #
 * # smoother decimation eats it. Do not raise the tolerance.          #
 * ####################################################################
 *
 * Absolute design coordinates. The path closes down to `bottom` and across.
 */
export const BULLET_CHECKLIST_BAR_TOP_EDGE: readonly (readonly [number, number])[] = [
  [1040, 165.5], [1067, 164.4], [1076, 165.5], [1190, 166.1], [1199, 166.7],
  [1235, 166.5], [1310, 168.7], [1342, 167.5], [1387, 168.5], [1432, 167.1],
  [1470, 168.3], [1538, 168.0], [1564, 167.2], [1603, 168.0], [1651, 166.3],
  [1699, 167.0], [1765, 165.2], [1800, 165.5], [1812, 164.5], [1877, 164.9],
  [1906, 159.8], [1908, 159.8], [1909, 160.7], [1917, 162.8], [1919, 162.2],
  /*
   * Held flat out to `drawRight`. Off-frame, so its value is unconstrained by
   * any measurement — it exists only so the shape has somewhere to close.
   */
  [1960, 162.2],
]

/**
 * The header's reveal: a hard mask edge sweeping leftward across a static bar.
 *
 * ####################################################################
 * # IT IS A MASK. NOT A SLIDE, NOT A SCALE-X. THREE INDEPENDENT       #
 * # PROOFS, ANY ONE OF WHICH IS ENOUGH.                               #
 * #                                                                   #
 * # 1. THE WOBBLY TOP EDGE IS A FINGERPRINT AND IT NEVER SHIFTS.      #
 * #    Cross-correlating the visible part of the profile against the  #
 * #    final profile, searching +-30px in 0.5px steps, returns a best #
 * #    offset of 0.0px on every frame from local 20 on — where a pure #
 * #    slide would need -229px at local 20 and -651px at local 17.    #
 * #                                                                   #
 * # 2. SCALE-X ABOUT x=1920 LOSES, AND LOSES IN THE TELLTALE WAY.     #
 * #    Its residual is worst exactly where its scale is furthest from #
 * #    1 (1.118 at local 20, s=0.740) and shrinks to meet the mask    #
 * #    model as s approaches 1. That is the signature of a wrong      #
 * #    model rather than a noisy one.                                 #
 * #                                                                   #
 * # 3. THE REVEALED PIXELS ARE THE FINAL PIXELS. Every frame compared #
 * #    to local 44 over the uncovered region differs by 0.13 to 0.68  #
 * #    of 255. The mask uncovers a finished image.                    #
 * #                                                                   #
 * # AND THE TITLE PROVES IT AGAIN ON ITS OWN. See TITLE below.        #
 * ####################################################################
 *
 * ####################################################################
 * # THE EDGE IS HARD AND THERE IS NO MOTION BLUR.                     #
 * #                                                                   #
 * # Alpha runs 0.02 -> 0.32 -> 0.93 -> 1.00 across about 2px, which   #
 * # is antialiasing and nothing more. It stays 1 to 2px wide even     #
 * # between local 18 and 19, where the edge crosses 207px in a single #
 * # frame.                                                            #
 * #                                                                   #
 * # SO THE HEADER DOES NOT SHARE THE SOFT TRAILING REVEAL THE         #
 * # CHECKLIST ROWS HAVE. Two different reveals in one animation, and  #
 * # giving the header the rows' feather is the obvious wrong guess.   #
 * ####################################################################
 */
export const BULLET_CHECKLIST_WIPE = {
  /** Local frames. Onset is the shot's own first frame. */
  from: 0,
  to: 37,
  /** Design px. The mask begins exactly at the frame boundary, measured to +-1px. */
  fromX: 1920,
  toX: 1040,
  /**
   * `cubic-bezier(0.900, 0, 0.100, 1)`.
   *
   * ##################################################################
   * # A FIT AT THE NOISE FLOOR, BOUGHT WITH ONE FREE PARAMETER.       #
   * #                                                                 #
   * # Residual rms 0.25px against a 0.21px measurement floor, on an   #
   * # 880px travel. 27 of 37 frames are inside +-0.35px and the worst #
   * # single frame is -0.58px.                                        #
   * #                                                                 #
   * # Only the symmetric handle was free. The centre came out of an   #
   * # independent symmetry test — p(n) + p(37-n) - 1 stays inside     #
   * # +-0.00068 for every n from 3 to 18, which is +-0.6px on 880px.  #
   * #                                                                 #
   * # NAMED EASINGS ALL FAIL, AND NOT NARROWLY:                       #
   * #   easeInOutExpo    16.87px      easeInOutQuart   34.63px        #
   * #   easeInOutQuint   23.25px      easeInOutCubic   56.63px        #
   * #   this bezier       0.25px                                      #
   * #                                                                 #
   * # The motion is far more centre-weighted than any of them: peak   #
   * # velocity is 207px in one frame, 8.7x the mean, and 23.5% of the #
   * # whole travel happens between local 18 and 19 alone.             #
   * ##################################################################
   */
  ease: { x1: 0.9, y1: 0, x2: 0.1, y2: 1 },
} as const

/**
 * Where the mask edge is, in design px, on a given local frame.
 *
 * Returns `fromX` before the shot starts and `toX` once it has settled, so a
 * caller who asks outside the range gets the held pose rather than an
 * extrapolation off the end of the bezier.
 */
export function bulletChecklistWipeX(frame: number): number {
  const { from, to, fromX, toX, ease } = BULLET_CHECKLIST_WIPE
  if (frame <= from) return fromX
  if (frame >= to) return toX

  const u = (frame - from) / (to - from)
  const p = cubicBezier(ease.x1, ease.y1, ease.x2, ease.y2, u)
  return fromX + (toX - fromX) * p
}

/**
 * The title's ink, as measured. THE TYPEFACE IS NOT SETTLED YET.
 *
 * ####################################################################
 * # THE TITLE IS STATIC AND MASKED, AND THIS IS PROVED TO THE PIXEL.  #
 * #                                                                   #
 * # Its ink's right edge sits at x = 1847 on ALL 31 frames of the     #
 * # wipe, and the 15-column strip x1836..1850 holds EXACTLY 205 ink   #
 * # pixels on every one of them — bit-stable. The ink COUNT grows     #
 * # from 575 to 24,103 as the mask retreats and the ink never moves.  #
 * #                                                                   #
 * # A bar-and-type slide predicts x_max at 1071 on local 14 and 1618  #
 * # on local 20, and predicts it off-frame entirely before local 26.  #
 * # Wrong by 776px and 229px. Dead.                                   #
 * #                                                                   #
 * # This is why local 20 reads "ET POINT OVERLAY" with the Y already  #
 * # in its final place, which was the eyeball clue that started the   #
 * # measurement.                                                      #
 * ####################################################################
 *
 * ####################################################################
 * # WHAT IS STILL MISSING: THE FACE, THE SIZE AND THE TRACKING.       #
 * #                                                                   #
 * # It is a bold condensed sans. `condensedFace.ts` already asserts   #
 * # that "a4, a7 and a8 are set in a condensed face he chose" and     #
 * # names Bebas Neue, but THAT CLAIM WAS NEVER TESTED AGAINST a7 —    #
 * # it was measured on a4's and a8's chips. Bebas has no lowercase    #
 * # and this title is all caps, so it is not excluded on shape, but   #
 * # it is not established either.                                     #
 * #                                                                   #
 * # DO NOT ASSUME IT INHERITS a8's ANSWER. a3's grid paint and a8's   #
 * # grid paint looked interchangeable too, and one drew every line    #
 * # 26% dim.                                                          #
 * ####################################################################
 */
export const BULLET_CHECKLIST_TITLE = {
  text: 'BULLET POINT OVERLAY',
  /**
   * BEBAS NEUE, the file already vendored in `condensedFaceData.ts`.
   *
   * ##################################################################
   * # AN EARLIER PASS IN THIS SESSION LOOKED AT A RENDER AND SAID     #
   * # "PLAINLY NOT BEBAS". THAT WAS WRONG, AND WHY IT WAS WRONG IS    #
   * # WORTH KEEPING.                                                  #
   * #                                                                 #
   * # The render it judged had letter-spacing 0 against the measured  #
   * # +0.0297em. Over twenty characters that is 56px of accumulated   #
   * # tracking, so every glyph after the first sat at a different x   #
   * # and the whole line read as a different, narrower face. The      #
   * # eye compared letterforms that were not in the same places.      #
   * #                                                                 #
   * # A proper fit settles it: a whole-line pixel fit beats the next  #
   * # candidate by 13.7x, and a zero-free-parameter per-glyph width   #
   * # ratio test beats it by 7.8x. The face's own kern pairs are      #
   * # recoverable from the frames (OV -2, LA +4, AY -46). The fitted  #
   * # synthetic stroke is 0.00px per side, so nothing is being        #
   * # papered over.                                                   #
   * #                                                                 #
   * # THE LESSON: judge a face by a fit, not by a side-by-side of a   #
   * # render whose SETTING has not been matched first. Tracking,      #
   * # size and origin all have to be right before the letterforms     #
   * # can be compared at all.                                         #
   * ##################################################################
   */
  fontSizePx: 100,
  /** Measured 69.988 +-0.03, and 100 * Bebas's own sCapHeight 700/1000. */
  capHeightPx: 70,
  /**
   * POSITIVE tracking, measured two independent ways. Bracket 0.0280-0.0307.
   * At 100px that is +2.97px per gap. Setting it to 0 shortens the line by 56px.
   */
  letterSpacingEm: 0.0297,
  letterSpacingPx: 2.97,
  /**
   * MUST BE ON. The frames give back the font's own kern pairs, so the
   * reference renderer applied GPOS `kern`. Turning it off moves glyphs.
   */
  kerning: 'normal',
  /** Fitted at 0.00px per side, bracket 0.00-0.05. Bebas needs no fattening here. */
  syntheticStrokePx: 0,
  /** The text pen origin, not the ink edge. Bracket 1095.9-1096.15. */
  originX: 1096,
  /** Bracket 279.9-280.25. */
  baselineY: 280,
  /** Ink bounding box in the settled frame, design px. Sub-pixel 1100.01..1847.25. */
  inkLeft: 1100,
  inkRight: 1847,
  inkTop: 209,
  inkBottom: 279,
  /**
   * Ink CORE, after eroding the antialiased edge. Raw mean (48.65, 46.85, 47.03).
   *
   * An earlier figure of `#2F312D` came off a threshold that swept in
   * green-tinged edge pixels, which dragged it toward the bar. Same trap as
   * every other colour on this animation: erode before you average.
   */
  colour: '#312F2F',
} as const

/**
 * The cream panel's settled footprint. ITS UNROLL IS NOT MEASURED YET.
 *
 * ####################################################################
 * # THE PANEL HAS ITS OWN REVEAL AND DOES NOT SHARE THE HEADER'S.     #
 * #                                                                   #
 * #   local  mask edge    panel left edge                             #
 * #     22     1172.6         1040                                    #
 * #     26     1091.7         1040                                    #
 * #     36     1040.1         1040                                    #
 * #                                                                   #
 * # From its very first visible frame the panel is already at its     #
 * # final left edge, 132px inside where the header's mask has reached.#
 * # Parenting the panel to the header's mask draws it wrong for 16    #
 * # frames, and the error is largest at the start.                    #
 * ####################################################################
 *
 * The unroll is purely vertical: top pinned at 335, left pinned at 1040 with a
 * standard deviation of 0.00 across every sampled row of every sampled frame,
 * and the bottom growing 497 -> 916. No horizontal scale, no anchor drift.
 */
export const BULLET_CHECKLIST_PANEL = {
  /**
   * The SAME LINE as the bar's left edge, to 0.001px.
   *
   * Panel 1040.0000 against bar 1040.0012. There is no offset, no inset and no
   * 6px mistake to reproduce, so both are driven from one constant. The edge is
   * exactly on the pixel grid and completely unantialiased — column 1039 is
   * pure background at the noise floor and column 1040 is full paper.
   */
  left: BULLET_CHECKLIST_OVERLAY_LEFT,
  /** Contiguous with the bar's bottom. A hard 1px seam, no gap and no overlap. */
  top: 335,
  /**
   * The torn bottom, as a summary. The shape itself is the polyline below.
   *
   * Span 914.21 to 921.90, peak-to-peak 7.69px, std 1.83. It is a slow
   * undulation rather than jaggedness: after a 33px boxcar the peak-to-peak is
   * still 7.09px and the high-frequency residual is only sigma 0.235px.
   */
  bottomMean: 917.69,
  bottomRange: [914.21, 921.9],
  drawRight: 1960,
  /**
   * Measured over 275,070 clean-paper pixels. Flat: a fitted plane gives -0.31
   * levels across the full width and +0.94 down the full height, both under one
   * 8-bit level. There is no gradient and no inner shadow under the bar.
   */
  fill: '#EDE7E0',
  /**
   * OPAQUE, and this was a real test rather than a nominal one.
   *
   * The photograph behind the panel spans luma 1.8 to 162. Regressing the
   * paper's luma on the background's over all 275,070 clean pixels gives a
   * slope of 0.001225, i.e. alpha 0.9988 — a 0.25-level swing across a
   * 140-level change in what is behind it. A 2% translucency would have given
   * 3.6 levels, twice the paper's own grain. Bracket: alpha >= 0.995.
   */
  opaque: true,
  /** None, in any direction, under either the panel or the bar. See below. */
  shadow: null,
} as const

/**
 * The paper's grain. Cheap to reproduce and honest to skip.
 *
 * ####################################################################
 * # IT IS IN THE SOURCE ASSET, NOT IN THE CODEC.                      #
 * #                                                                   #
 * # Contrast-stretched 18x it is an even fibre grain with NO 8x8      #
 * # blocking, and it is perfectly static — temporal sigma 0.0003      #
 * # across the tail, where the spatial sigma is 1.9128. So h264 is    #
 * # preserving it rather than creating it.                            #
 * #                                                                   #
 * # It is PURE LUMINANCE: R, G and B standard deviations are          #
 * # identical to 0.001 and the channel offsets hold at R-G = 5.99 and #
 * # G-B = 7.00 everywhere. A grey grain over a flat fill, not a       #
 * # coloured paper scan.                                              #
 * #                                                                   #
 * # AND IT IS NOT STRIPES. 69% of the spectral energy is horizontal,  #
 * # so the fibres lean vertical, but the full-height column profile   #
 * # explains only 7.6% of the pixel variance — these are 2-4px        #
 * # fibres, not ruled lines. Broadband, no dominant period, and a     #
 * # correlation length of 2-3px.                                      #
 * #                                                                   #
 * # At sigma 0.75% of full scale it is invisible at viewing distance  #
 * # and shows only on a pixel-peep A/B. Do NOT go sourcing a          #
 * # photographic paper texture for it.                                #
 * ####################################################################
 *
 * ####################################################################
 * # IT IS NOT DRAWN, AND THE ATTEMPT IS RECORDED SO NOBODY REPEATS IT #
 * # THE SAME WAY.                                                     #
 * #                                                                   #
 * # An feTurbulence layer at the frequencies below reproduced the     #
 * # STRUCTURE correctly — column-profile sd 0.183 against             #
 * # row-profile 0.039, the same anisotropy as his 0.542 against       #
 * # 0.158 — but overlay blending pulled the paper mean down about 5   #
 * # levels and took the region mad from 1.578 to 4.567.               #
 * #                                                                   #
 * # FLAT ALREADY SITS AT THE NOISE FLOOR: 1.578 against a photograph  #
 * # control of 1.556 on the same frame. The grain is therefore not    #
 * # measurable in the output even though it is real in his source.    #
 * #                                                                   #
 * # These constants are kept for anyone who wants to try again with a #
 * # blend that preserves the mean. That is the only bar it has to     #
 * # clear.                                                            #
 * ####################################################################
 */
export const BULLET_CHECKLIST_PAPER_GRAIN = {
  /** Standard deviation in 8-bit luminance levels. */
  sigmaLevels: 1.92,
  /** Roughly 3:1, leaning vertical. */
  verticalStretch: 3,
  correlationLengthPx: 2.5,
  /*
    The two feTurbulence frequencies, derived from the numbers above rather
    than dialled in: 1/2.5px horizontally, and a third of that vertically
    because the fibres are three times longer than they are wide.
  */
  frequencyX: 0.4,
  frequencyY: 0.13,
  /*
    How hard to blend the grain. sigma 1.92 of 255 is 0.0075 of full scale, and
    an overlay blend of centred noise lands near that at this alpha. Tuned
    against a render rather than derived, because the blend mode is not linear.
  */
  alpha: 0.08,
} as const

/**
 * The torn bottom edge, as a 25-point polyline in absolute design coordinates.
 *
 * ####################################################################
 * # A STRAIGHT BOTTOM EDGE IS THE SINGLE MOST VISIBLE WAY TO GET THIS #
 * # PANEL WRONG.                                                      #
 * #                                                                   #
 * # A plain rectangle at the mean y = 917.7 differs from the real     #
 * # edge by up to 4.2px, and more importantly loses the torn-paper    #
 * # character that identifies the template at a glance.               #
 * #                                                                   #
 * # These 25 points hold it to max 1.27px and rms 0.32px. A NAIVE     #
 * # UNIFORM 24-POINT POLYLINE IS WORSE, at max 3.64px, because it     #
 * # misses the corner notch — so the three tight knots at the start   #
 * # are load-bearing and must not be tidied away.                     #
 * #                                                                   #
 * # Named features, for checking a render by eye:                     #
 * #   - a corner notch at the left, (1040, 918.1) dropping to         #
 * #     (1046, 921.2) in six columns, the sharpest thing on the edge  #
 * #   - the deepest point, y 921.90 at x 1622, a broad 80px lobe      #
 * #   - the shallowest region, x 1776-1912 at y 914.2-915.0           #
 * ####################################################################
 *
 * ####################################################################
 * # DO NOT BUILD THIS BY MIRRORING THE BAR'S TOP EDGE. They are       #
 * # independent curves — correlation 0.33 across only about six       #
 * # independent features, which is not significant.                   #
 * ####################################################################
 */
export const BULLET_CHECKLIST_PANEL_BOTTOM_EDGE: readonly (readonly [number, number])[] = [
  [1040, 918.1], [1044, 921.0], [1048, 921.2], [1056, 920.1], [1072, 917.0],
  [1114, 916.1], [1157, 917.0], [1199, 917.1], [1241, 917.3], [1284, 918.0],
  [1326, 917.9], [1368, 917.1], [1411, 919.8], [1453, 918.9], [1496, 918.9],
  [1538, 919.8], [1580, 919.3], [1623, 921.9], [1665, 918.7], [1707, 918.0],
  [1750, 917.9], [1792, 915.0], [1834, 914.8], [1877, 914.2], [1919, 915.0],
  /* Held flat past the frame, so nothing can open a gap at x = 1919. */
  [1960, 915.0],
]

/**
 * The panel's reveal: a dead-straight horizontal clip edge sweeping down.
 *
 * ####################################################################
 * # IT DOES NOT UNROLL, AND IT IS NOT SLOW. BOTH HALVES OF THE        #
 * # CLIENT'S DESCRIPTION ARE WRONG.                                   #
 * #                                                                   #
 * # He wrote "slowly open the Bulet container like a carlendar". A    #
 * # calendar page unrolls, which would carry its own torn edge down   #
 * # the screen. This is a hard straight clip edge over a panel that   #
 * # never moves, and the torn bottom only becomes visible in the LAST #
 * # HALF-FRAME of the reveal.                                         #
 * #                                                                   #
 * # THE PROOF IS THE EDGE'S OWN STRAIGHTNESS. Under a y-scale about   #
 * # the top, the visible bottom edge WOULD BE the torn edge,          #
 * # compressed — predicting a per-column spread of 1.38px at local 40 #
 * # against a measured IQR of 0.017px. That is 81x. At local 50 it is #
 * # 54x and at local 55 still 21x. Dead three times over.             #
 * #                                                                   #
 * # And the revealed pixels are the final pixels, at rms 0.07 to 0.25 #
 * # levels against a paper grain of 1.92. A vertical scale would be   #
 * # wrong by rms 25 to 36 levels.                                     #
 * ####################################################################
 *
 * ####################################################################
 * # THE EASING IS LINEAR, AND "SLOW LIKE A CALENDAR" IS THE TRAP.     #
 * #                                                                   #
 * #   linear, free slope and intercept   2 params   rms 0.1389px      #
 * #   quadratic                          3 params   rms 0.1356px      #
 * #                                                                   #
 * # The third parameter buys 0.003px. There is no curvature at all.   #
 * # Per-frame delta-y across the whole run is mean 16.2595 with std   #
 * # 0.1515 — a flat 36-frame ramp.                                    #
 * #                                                                   #
 * # At local 29 the measured edge is at 481.52. A cubic ease-out puts #
 * # it at 674, a cubic ease-in-out at 372, a spring at about 700. All #
 * # wrong by 110 to 220px. This is not a close call.                  #
 * ####################################################################
 *
 * ####################################################################
 * # TWO FREE NUMBERS LANDED ON MEANINGFUL ONES, AND THAT IS THE       #
 * # STRONGEST THING IN THE PANEL MEASUREMENT.                         #
 * #                                                                   #
 * # The fit was free in both slope and intercept. Its line crosses    #
 * # y = 335.0 — the green bar's own bottom edge, measured             #
 * # INDEPENDENTLY by a different pass — at local frame 19.9997.       #
 * # An arbitrary edge and an arbitrary frame, and it landed on the    #
 * # bar's seam and on an integer.                                     #
 * ####################################################################
 */
export const BULLET_CHECKLIST_UNROLL = {
  /**
   * Local frame. Honest bracket 19.98 to 20.02, widened from the formal
   * +-0.003 to fold in the estimator's 0.1px calibration bias.
   */
  from: 20,
  /** Design px per frame. 488.08 px/s. Fitted +-0.00239. */
  velocity: 16.26937,
  /** Where it starts, which is the bar's own bottom edge. */
  fromY: 335,
  /**
   * Local 56.074, when the edge clears the DEEPEST point of the torn bottom at
   * y 921.90. It clears the shallowest at 55.601, so the tear is only visible
   * for about half a frame.
   */
  clearsAt: 56.074,
} as const

/**
 * Where the panel's clip edge is, in design px, on a given local frame.
 *
 * Returns the panel's top before the unroll starts, so nothing shows, and stops
 * at the deepest point of the tear once it has cleared.
 */
export function bulletChecklistPanelMaskY(frame: number): number {
  const { from, velocity, fromY, clearsAt } = BULLET_CHECKLIST_UNROLL
  if (frame <= from) return fromY
  if (frame >= clearsAt) return fromY + velocity * (clearsAt - from)
  return fromY + velocity * (frame - from)
}


/**
 * The three checklist rows: the type, and where each one sits.
 *
 * ####################################################################
 * # CAVEAT BOLD AT 59px. NOT ITALIC AND NOT SKEWED.                   #
 * #                                                                   #
 * # The file's own `post.italicAngle` is 0.0 and Caveat supplies      #
 * # about 19.8 degrees of lean inside its outlines, against the 19.5  #
 * # measured off his frames. Adding a CSS skew on top double-slants   #
 * # every glyph. See `scriptFace.ts`.                                 #
 * ####################################################################
 *
 * ####################################################################
 * # THE ROW PITCH IS 101px AND ALL THREE ARE EQUAL TO 0.018px.        #
 * #                                                                   #
 * # Measured three ways, and confirmed independently against the      #
 * # checkbox tops, which sit at 496 / 597 / 698 — the same 101 pitch. #
 * # So the rows can be laid out from one constant rather than three   #
 * # measured baselines, and two separate families of measurement      #
 * # agree about it.                                                   #
 * ####################################################################
 */
export const BULLET_CHECKLIST_ROWS = {
  /** Bracket 58.6-59.4. */
  fontSizePx: 59,
  /**
   * Bracket 650-700; 600 is only 6.6% worse, and his frames carry about 7%
   * LESS ink than a clean 700 render, which points the other way. THIS IS THE
   * SOFTEST NUMBER ON a7. If a render reads heavy, try 660 before anything else.
   */
  fontWeight: 700,
  /** Bracket +-0.0015em. Flat zero, unlike the title. */
  letterSpacingEm: 0,
  /**
   * A RENDERER COMPENSATION, NOT A MEASUREMENT OF HIS FILE.
   *
   * ##################################################################
   * # CHROME LAYS THIS FACE OUT 1.4% NARROWER THAN HIS RENDERER DID, #
   * # AND THIS CLOSES THE GAP. IT IS A STAND-IN.                     #
   * #                                                                #
   * # The measured letter-spacing on HIS frames is 0, bracket        #
   * # +-0.0015em, and that measurement is not in dispute. But the    #
   * # same file at the same size lays out differently in different   #
   * # engines: PIL gives an ink width of 349.6px for 'Key takeaway   #
   * # #1' where Chrome gives 342.0, against his 347.8.               #
   * #                                                                #
   * # So the line came out 5px short with a correct size — vertical  #
   * # extent already matched, K height 51 against his 52, which is   #
   * # what rules out a size error. Adding 0.20px between characters  #
   * # restores the width:                                            #
   * #                                                                #
   * #   tracking   ink span      text mad vs his frame               #
   * #   0.00       1350..1692    22.53                               #
   * #   0.20       1350..1698     9.02   <- his is 1350..1697        #
   * #   0.36       1350..1701    15.10                               #
   * #                                                                #
   * # THE RIGHT SHAPE, THE WRONG MECHANISM, exactly like a2's old    #
   * # bold tracking stand-in: a real advance difference lives        #
   * # inside each glyph and this puts it between them. It is fitted  #
   * # against a render, which is what this project requires before   #
   * # any device pins a number like this.                            #
   * #                                                                #
   * # DELETE IT if a future render matches without it — it           #
   * # compensates for THIS Chrome's layout of THIS file, and nothing #
   * # about his reference.                                           #
   * ##################################################################
   */
  chromeTrackingPx: 0.2,
  /**
   * The pen origin.
   *
   * ##################################################################
   * # 1346 HERE, WHERE THE MEASUREMENT SAYS 1344, AND THE DIFFERENCE #
   * # IS CHROME'S LEFT SIDE BEARING RATHER THAN A DISAGREEMENT.      #
   * #                                                                #
   * # The measurement pinned pen 1344 with the first ink landing at  #
   * # 1350, i.e. a 6px bearing on the 'K'. Chrome lays the same file #
   * # out with a 4px bearing, so pen 1344 puts ink at 1348.          #
   * #                                                                #
   * # HIS INK EDGE IS THE MEASURED QUANTITY and the pen is not       #
   * # visible in any frame, so the pen is what moves. 1346 puts our  #
   * # ink on his 1350.                                               #
   * ##################################################################
   */
  penX: 1346,
  /** Leftmost and rightmost ink at alpha 0.5, for checking a render. */
  inkLeft: 1350,
  inkRight: 1697.8,
  baselines: [544, 645, 746],
  pitch: 101,
  /**
   * Raw mean (90.92, 88.26, 84.95). The true value may be about one level more
   * neutral — 4:2:0 chroma bleed from the surrounding cream depresses blue.
   */
  colour: '#5B5855',
} as const

/**
 * The reveal: a PER-CHARACTER opacity fade, and it is not a wipe of any kind.
 *
 * ####################################################################
 * # THE DECISIVE TEST IS THE WITHIN-GLYPH GRADIENT.                   #
 * #                                                                   #
 * # Inside a single glyph the reveal time barely varies with x:       #
 * # d(t50)/dx = +0.0059 +-0.0107 frames per px, where ANY             #
 * # left-to-right wipe requires +0.1071. Eighteen times out, and      #
 * # consistent with zero.                                             #
 * #                                                                   #
 * # THE "SOFT TRAILING EDGE" IS AN ARTEFACT OF THE STAGGER. At any    #
 * # instant about 4.65 characters are partly transparent, because the #
 * # fade lasts 11.5 frames and the slots are 2.46 apart. It LOOKS     #
 * # like a gradient mask sliding right at 9.34px per frame, and that  #
 * # apparent edge speed is a CONSEQUENCE, not a cause. Build the      #
 * # gradient-mask reading and you reproduce the look while getting    #
 * # every individual glyph's timing wrong.                            #
 * ####################################################################
 *
 * ####################################################################
 * # THE SPACE CONSUMES A SLOT, AND a3 PROVES THAT IS NOT SAFE TO      #
 * # ASSUME EITHER WAY.                                                #
 * #                                                                   #
 * # 'Key takeaway #1' is 15 slots including its two spaces. Skipping  #
 * # the space fits 16x worse.                                         #
 * #                                                                   #
 * # a3 SKIPS the space and a5 SLOTS it, on the same reel, and the     #
 * # only way to know is to measure each one. a3 was built the wrong   #
 * # way round first, and the two laws' totals differed by only 0.4% — #
 * # only WHERE the gap falls distinguishes them.                      #
 * ####################################################################
 *
 * ####################################################################
 * # THE FADE IS LINEAR: rms 0.0057 against 0.0248 for the best eased  #
 * # curve, a factor of 4.4.                                           #
 * #                                                                   #
 * # NOTE THE CHECKBOX AND ITS TICK ARE **EASED**, on the same         #
 * # animation. Do not unify them onto one curve because it looks      #
 * # tidier — the text is linear and the box is not, and each was      #
 * # fitted on its own.                                                #
 * ####################################################################
 */
export const BULLET_CHECKLIST_ROW_REVEAL = {
  /** Local frames. Free fit 33.06 / 45.05 / 57.06. */
  onset: [33, 45, 57],
  /** Frames between rows. Measured 11.990 and 12.005. */
  rowStagger: 12,
  /** Frames per SLOT, not per drawn glyph. Free fit 2.46390. */
  charStagger: 2.46429,
  /** Frames for one character to go 0 to 1. Free fit 11.4650. */
  charFadeFrames: 11.5,
  spaceTakesSlot: true,
  /** Local frames at which each row is fully opaque. Free fit 79.02 / 91.01 / 103.02. */
  complete: [79, 91, 103],
  /** Centroid drift is at most 0.086px, so the rows do not slide. */
  slides: false,
} as const

/**
 * One character's opacity: which slot it is in, and how far that slot has run.
 *
 * `row` is 0-based. `slot` counts EVERY character including spaces.
 */
export function bulletChecklistCharOpacity(row: number, slot: number, frame: number): number {
  const { onset, charStagger, charFadeFrames } = BULLET_CHECKLIST_ROW_REVEAL
  const start = (onset[row] ?? 0) + charStagger * slot
  return Math.max(0, Math.min(1, (frame - start) / charFadeFrames))
}

/**
 * The checkbox and its tick.
 *
 * ####################################################################
 * # MEASURED IN THIS SESSION RATHER THAN BY THE MEASUREMENT PASS.     #
 * #                                                                   #
 * # The agent that owned this dimension died in an outage, so these   #
 * # numbers were taken directly and have NOT been through the         #
 * # adversarial verification the other dimensions had.                #
 * #                                                                   #
 * # WHAT IS FIRM: the geometry, the colours, the 12-frame beat, and   #
 * # the fade-versus-draw distinction, which was settled by the same   #
 * # test that settled the rows. WHAT IS SOFT: both easings.           #
 * ####################################################################
 *
 * ####################################################################
 * # THE BOX FADES AND THE TICK DRAWS. THEY ARE DIFFERENT MECHANISMS   #
 * # AND THE FRAMES SEPARATE THEM CLEANLY.                             #
 * #                                                                   #
 * # BOX — all four edges reach half opacity within 0.01 frames of one #
 * # another (56.88, 56.87, 56.87, 56.87 on row 2). A stroke being     #
 * # drawn would spread those out the way the tick's do.               #
 * #                                                                   #
 * # TICK — t50 along its path runs 60.77, 63.24, 64.89, 68.13 from    #
 * # left to right. A 7.4-frame spread. Its ink bounding box grows     #
 * # from x1276..1279 to x1274..1315 as it goes, which a fade would    #
 * # not do and a pop would overshoot.                                 #
 * #                                                                   #
 * # AND THE OUTLINE DOES NOT CHANGE COLOUR WHEN IT IS TICKED. At      #
 * # local 60 row 1's outline reads (50.8, 49.0, 46.7) fully dark      #
 * # while row 2's reads (81.9, 79.2, 76.6) only because it is still   #
 * # fading in. That is a WITHIN-FRAME comparison, so no cross-frame   #
 * # drift can fake it. Row 3 has no box at all yet — the boxes arrive #
 * # per row, they are NOT all drawn when the panel opens.             #
 * ####################################################################
 */
export const BULLET_CHECKLIST_CHECKBOX = {
  /** All three identical, and their 101 pitch matches the rows'. */
  left: 1266,
  right: 1322,
  size: 57,
  tops: [496, 597, 698],
  /** Measured off a horizontal slice: the stroke runs 1266..1272. */
  strokeWidth: 7,
  /** Core colour after erosion, raw mean (39.2, 37.7, 36.4). */
  colour: '#272524',
  /**
   * Relative to the row's OWN text onset. Row 2's box fits onset 48.7 against
   * a text onset of 45.
   *
   * Cross-checked on all three rows by their half-opacity crossings, which land
   * at 44.90 / 56.88 / 68.93 — exactly 12.0 apart, and each 11.9 frames after
   * its own row's text starts.
   */
  fadeFromRowOnset: 3.7,
  fadeFrames: 16.2,
  /**
   * `cubic-bezier(0.42, 0, 0.58, 1)`, rms 0.0352 against linear's 0.0504.
   *
   * A 1.4x margin, FAR weaker than the 4.4x that made the text linear.
   * Recorded as the best of four candidates rather than as settled.
   */
  fadeEase: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
} as const

/**
 * The tick's path and its draw.
 *
 * Two segments: down-right from the entry, then up-right to the tip. Traced
 * from the per-column vertical centre of the green ink in the settled frame,
 * which runs (1274, 527) to a vertex near (1287, 535.5) and up to (1315, 513.5).
 * Thickness measures about 12px vertically, which on these slopes is roughly
 * 9.5px perpendicular.
 */
export const BULLET_CHECKLIST_TICK = {
  /**
   * Relative to the checkbox's own top-left, so one path serves all three rows.
   *
   * Traced from the per-column vertical centre of the green ink in the settled
   * frame: (1274, 527) to a vertex near (1287, 535.5) and up to (1315, 513.5).
   *
   * ##################################################################
   * # THESE ARE THE INK'S EXTREMES USED AS THE PATH, WHICH IS KNOWN   #
   * # TO BE SLIGHTLY LONG, AND THE CORRECTION MADE IT WORSE.          #
   * #                                                                #
   * # A butt cap on an angled stroke puts its corners past the path's #
   * # own end, so the path should in principle be shorter than the    #
   * # ink. Pulling each end in by half the stroke width was tried:    #
   * #                                                                #
   * #   path from ink        ink x 1272..1317  area 481  mad 18.17    #
   * #   ends pulled in 4.75  ink x 1276..1311  area 381  mad 19.62    #
   * #   his reference        ink x 1274..1315  area 440              #
   * #                                                                #
   * # His sits BETWEEN the two, and the shortened version is further  #
   * # from him than the unshortened one. So the overhang model, which #
   * # predicted the first version's ink correctly to 0.6px, does not  #
   * # invert cleanly — his tick is a hand-drawn mark and a uniform-   #
   * # width two-segment polyline cannot be both the right length and  #
   * # the right weight at once.                                       #
   * #                                                                #
   * # KEPT AT THE VERSION THAT MEASURED BEST. The residual is 2px of  #
   * # length at each end and about 9% of extra ink. A third iteration #
   * # on a 41px mark would be fitting noise, which is the over-fit    #
   * # that got a3's stagger backwards.                                #
   * ##################################################################
   */
  path: [
    [8, 31],
    [21, 39.5],
    [49, 17.5],
  ],
  strokeWidth: 9.5,
  /** Core colour after erosion, raw mean (75.1, 120.9, 64.9). Agrees across all three rows. */
  colour: '#4B7840',
  /** Relative to the row's own text onset. Row 2 fits onset 59.3 against a text onset of 45. */
  drawFromRowOnset: 14.3,
  drawFrames: 16,
  /**
   * `cubic-bezier(0.25, 0.1, 0.25, 1)`, rms 0.0265 against linear's 0.0425.
   *
   * Fitted on the green ink's AREA as a proxy for path length, which assumes a
   * constant stroke width. It very nearly is, and that assumption is why this
   * is the softest number in this block.
   */
  drawEase: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
} as const

/** How far the box has faded in, 0 to 1, for a row on a local frame. */
export function bulletChecklistBoxOpacity(row: number, frame: number): number {
  const { fadeFromRowOnset, fadeFrames, fadeEase } = BULLET_CHECKLIST_CHECKBOX
  const start = (BULLET_CHECKLIST_ROW_REVEAL.onset[row] ?? 0) + fadeFromRowOnset
  return cubicBezier(fadeEase.x1, fadeEase.y1, fadeEase.x2, fadeEase.y2, (frame - start) / fadeFrames)
}

/** How much of the tick has been drawn, 0 to 1, for a row on a local frame. */
export function bulletChecklistTickDrawn(row: number, frame: number): number {
  const { drawFromRowOnset, drawFrames, drawEase } = BULLET_CHECKLIST_TICK
  const start = (BULLET_CHECKLIST_ROW_REVEAL.onset[row] ?? 0) + drawFromRowOnset
  return cubicBezier(drawEase.x1, drawEase.y1, drawEase.x2, drawEase.y2, (frame - start) / drawFrames)
}

/**
 * THE MASTER TIMELINE, and the overlaps are the whole point of writing it down.
 *
 * ####################################################################
 * #  element          onset    ends     local frames                 #
 * #  ---------------------------------------------------------       #
 * #  bar wipe            0       37                                  #
 * #  panel clip         20       56.07                               #
 * #  row 1 text         33       79                                  #
 * #  row 1 box        36.7     52.9                                  #
 * #  row 1 tick       47.3     63.3                                  #
 * #  row 2 text         45       91                                  #
 * #  row 2 box        48.7     64.9                                  #
 * #  row 2 tick       59.3     75.3                                  #
 * #  row 3 text         57      103                                  #
 * #  row 3 box        60.7     76.9                                  #
 * #  row 3 tick       71.3     87.3                                  #
 * #  hold             103      119      16 frames                    #
 * ####################################################################
 *
 * ####################################################################
 * # NOTHING CHAINS. EVERYTHING OVERLAPS.                              #
 * #                                                                   #
 * # Row 1's text starts at local 33, which is FOUR FRAMES BEFORE the  #
 * # bar's wipe lands at 37 and TWENTY-THREE before the panel's clip   #
 * # finishes at 56.07. Row 2 has been running for 11 frames when the  #
 * # panel finishes.                                                   #
 * #                                                                   #
 * # A sibling measurement said "the ticks-and-text phase begins at    #
 * # local ~56, right as the unroll finishes". That is wrong by 23     #
 * # frames, and building to it would put the whole checklist          #
 * # three-quarters of a second late.                                  #
 * ####################################################################
 *
 * ####################################################################
 * # ONE COINCIDENCE, RECORDED BECAUSE IT DOES NOT GENERALISE.         #
 * #                                                                   #
 * # The panel's clip edge crosses row 1's baseline at local 32.85 and #
 * # row 1's first character starts at 33.06 — 0.21 frames apart. It   #
 * # looks as though the text is cued to the paper reaching its line.  #
 * #                                                                   #
 * # IT IS NOT. The mask crosses row 2's baseline at 39.05 where its   #
 * # text starts at 45.05, and row 3's at 45.26 where its text starts  #
 * # at 57.06. Rows 2 and 3 follow a plain 12-frame beat instead. So   #
 * # row 1's agreement is chance, and anyone retiming the unroll must  #
 * # not drag the rows along with it.                                  #
 * ####################################################################
 */
export const BULLET_CHECKLIST_HOLD_FROM = 103

/**
 * A cubic bezier easing, solved by bisection on x.
 *
 * Bisection rather than Newton because it cannot diverge, and 30 iterations is
 * exact to about 1e-9.
 *
 * Copied rather than shared with `galleryStripClock.ts` and
 * `highlightPageClock.ts` on purpose. Every clock module in this folder imports
 * NOTHING, which is what keeps the `.test.ts` lane safe under
 * `--conditions react-server`.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  /* The endpoints are returned exactly, so the settled pose is 1040 and not 1040.0000000003. */
  if (x <= 0) return 0
  if (x >= 1) return 1

  const curve = (a: number, b: number, t: number): number => {
    const u = 1 - t
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
  }

  let low = 0
  let high = 1
  let t = x
  for (let i = 0; i < 30; i += 1) {
    t = (low + high) / 2
    if (curve(x1, x2, t) < x) low = t
    else high = t
  }
  return curve(y1, y2, t)
}
