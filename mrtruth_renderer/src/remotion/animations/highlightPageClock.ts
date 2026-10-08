/**
 * The highlighted-paragraph page's clock and geometry, as pure functions.
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
 * WHAT THIS IS. The client's second reference animation, at 0:03 of
 * `Templates (Unseperated).mp4`. His own words:
 *
 *   WHAT     a 3 sentence with the bold text
 *   FROM/TO  the bold text to highlighted with the yellow highlight background
 *            on that bold text, and zooming out the whole image
 *   WHEN     starts at 0:03, takes 2 seconds to be highlighted the text, the
 *            zoom in takes 3 seconds
 *   HOW      slowing to just cover the text
 *
 * A near-white page carrying a soft elliptical vignette. Three paragraphs of
 * dark grey body type, each wrapping to two lines. One phrase in each is set
 * bold, and a yellow block wipes in behind it, left to right, one paragraph
 * after another. The whole page zooms in slowly throughout.
 *
 * ####################################################################
 * # a2 SHARES NOTHING WITH THE OTHER EIGHT AND THAT IS THE HEADLINE.  #
 * #                                                                   #
 * # a3, a4, a8 and a9 are dark grounds carrying a warped grid. a2 is  #
 * # a LIGHT PAGE. Its vignette is bright in the middle where theirs   #
 * # are dark, it is linear in sRGB where theirs is a smoothstep, its  #
 * # ellipse is 16:9 where theirs is 1.712, and it RIDES THE ZOOM.     #
 * # Refitting `GRID_VIGNETTE` to a2 costs 48x the residual.           #
 * #                                                                   #
 * # It is also the only one that is mostly TYPE, and the only one     #
 * # whose length depends on the words it is given.                    #
 * ####################################################################
 *
 * ####################################################################
 * # THREE THINGS A BUILDER MUST READ FIRST.                           #
 * #                                                                   #
 * # 1. BUILD IN DESIGN SPACE, at 1920x1080, and let ONE transform     #
 * #    carry it. Twenty independent quantities land on integers there #
 * #    and none of them does at the settled size. Animating the font  #
 * #    size instead re-rounds every baseline every frame and gives a  #
 * #    per-line shimmer of up to 1px.                                 #
 * #                                                                   #
 * # 2. THE PHRASES ARE ALREADY BOLD ON FRAME 0, four frames before    #
 * #    the camera even starts. Only the YELLOW arrives. Animate the   #
 * #    weight and frame 0 is wrong and every glyph after each phrase  #
 * #    reflows.                                                       #
 * #                                                                   #
 * # 3. THE HIGHLIGHT CHAIN AND THE CAMERA SHARE ONLY THEIR END.       #
 * #    The chain starts at local 0 and the camera at local 4, and     #
 * #    both stop on local 130. Do not slave one clock to the other.   #
 * ####################################################################
 */

/**
 * The page, in design pixels. EVERYTHING is authored here and scaled once.
 *
 * ####################################################################
 * # THE INTEGER GRID IS THE EVIDENCE THAT THIS IS THE AUTHOR'S OWN    #
 * # SPACE, AND IT IS ALSO THE STRONGEST RESULT IN THE MEASUREMENT.    #
 * #                                                                   #
 * # Six highlight-rect edges, predicted from these integers times a   #
 * # scale of exactly 1.3 about the frame centre, against the settled  #
 * # frame measured over 43 frames:                                    #
 * #                                                                   #
 * #   design 551  -> 428.30 predicted, 428.302 measured               #
 * #   design 914  -> 900.20 predicted, 900.325 measured               #
 * #   design 652  -> 559.60 predicted, 559.648 measured               #
 * #   design 1227 -> 1307.10 predicted, 1307.232 measured             #
 * #   design 320  -> 128.00 predicted, 128.106 measured               #
 * #   design 618  -> 515.40 predicted, 515.526 measured               #
 * #                                                                   #
 * # Mean error +0.09px, spread 0.13px, over an 1179px span.           #
 * ####################################################################
 */
export const HIGHLIGHT_PAGE = {
  /**
   * 178 frames, 5.933s. Source 111..288 of his reel, local 0 = source 111.
   *
   * ##################################################################
   * # THIS IS THE ONE ANIMATION WHOSE LENGTH IS NOT A CONSTANT.       #
   * #                                                                 #
   * # 130 animated frames plus a 48-frame freeze, and the 130 is      #
   * # 13 frames per highlighted WORD across all three phrases. The    #
   * # reference has 3 + 4 + 3 = 10 words, so 130.                     #
   * #                                                                 #
   * # See `highlightPageFrameCount`. The rate is an ATTRIBUTION and   #
   * # not a measurement — only two distinct word counts occur in one  #
   * # clip, so anything reading (3, 4, 3) for these strings fits.     #
   * ##################################################################
   */
  totalFrames: 178,

  /**
   * The last frame that carries new pixels. 131..177 are held.
   *
   * Both clocks end here: the camera stops and the third highlight completes
   * on the same frame. That coincidence is real and is one of only two things
   * tying the two clocks together.
   *
   * ##################################################################
   * # THE FROZEN TAIL IS NOT BIT-IDENTICAL, UNLIKE THE REEL'S         #
   * # SEPARATOR PLATES. Consecutive mad runs 0.19 falling to 0.05 and #
   * # the difference against the last frame decays smoothly from 0.89 #
   * # to 0.06. That is the encoder converging on a still, not motion. #
   * # Do not use bit-identity as the freeze test on this shot.        #
   * ##################################################################
   */
  moveEndFrame: 130,

  /** Screen pixels per design pixel at scale 1. The page IS the frame at k = 1. */
  frameWidth: 1920,
  frameHeight: 1080,

  camera: {
    /**
     * IT ZOOMS IN. The client says both "zooming out the whole image" AND
     * "the zoom in" in one sentence, so he contradicts himself and the frames
     * decide. Four independent kinds of evidence agree: the ink bounding box
     * grows, the fitted font size goes 32.00 to 41.59, every baseline gap
     * grows, and the vignette's knee moves outward from 677.7 to 881.5.
     *
     * ##################################################################
     * # A PURE UNIFORM SCALE ABOUT THE EXACT FRAME CENTRE. NOTHING     #
     * # ELSE MOVES.                                                    #
     * #                                                                 #
     * # The origin was found by INTERSECTION rather than assumed —     #
     * # regressing the per-frame affine intercept on its slope over    #
     * # 131 moving frames lands on the geometric centre to 0.03px in x #
     * # and 0.3px in y, at a residual of 0.008 to 0.011px. To move it  #
     * # 10px off centre the landmarks would have to be displaced 2.3px #
     * # against a measured residual of 0.026px.                        #
     * #                                                                 #
     * # No translation (under 0.03px), no rotation or shear (0.003     #
     * # degrees), and isotropic to 2.8e-5.                             #
     * ##################################################################
     */
    startFrame: 4,
    endFrame: 130,

    /**
     * 1.000 to 1.300.
     *
     * ##################################################################
     * # 1.2991 AND 1.3000 ARE BOTH IN THE MEASUREMENT AND THE          #
     * # DIFFERENCE IS NOT A DISPUTE — IT IS WHICH FRAME YOU REGISTER   #
     * # AGAINST.                                                       #
     * #                                                                 #
     * # At source 244 the browser stops transforming a cached raster   #
     * # and re-renders the page natively at its final size. That is a  #
     * # sub-pixel re-snap of about 0.05%. Registering against a frame  #
     * # BEFORE it gives 1.29919; registering against one after gives   #
     * # 1.29976.                                                       #
     * #                                                                 #
     * # 1.3000 is shipped because five independent levers say so: the  #
     * # integer design grid predicts six rect edges to 0.13px, the     #
     * # font-size ratio is 41.5904/31.9929 = 1.29999, the column pen-x #
     * # lever gives 1.2998-1.3000, and the vignette knee — which has   #
     * # no type in it at all — gives 1.29990.                          #
     * #                                                                 #
     * # DO NOT AVERAGE THE TWO. And do not ship 1.29907, which is      #
     * # 0.68px small at the far right of the type on the first frame.  #
     * ##################################################################
     */
    scaleFrom: 1,
    scaleTo: 1.3,
  },

  /**
   * The page's own colour. `#F8F8F8`, NOT white.
   *
   * Decoded 248 as the per-pixel mode over 118,000 samples (79.5%), with a
   * fitted plateau of 247.94. Three independent reads on three frame sets.
   * Painting `#FFFFFF` is seven codes too bright over about two million pixels
   * and is the single easiest way to be wrong on this shot.
   */
  pageColour: '#F8F8F8',

  /**
   * The vignette. ONE two-stop, 16:9 elliptical, LINEAR-IN-sRGB gradient.
   *
   * ##################################################################
   * # IT RIDES THE PAGE. Put it on the node that carries the scale.   #
   * #                                                                 #
   * # Fixed in screen space it is wrong by 23.5 to 25.1 codes rms at  #
   * # the first frame — the corners start 22 codes too bright and     #
   * # never move. Riding the page scores 0.243 against 5.27, and the  #
   * # question was settled a second way: warping the BLANK LOWER PAGE #
   * # by an affine derived purely from the TYPE drops its residual    #
   * # from 21.878 to 0.465. Thin dark strokes and a smooth luminance  #
   * # gradient, damaged by h264 in opposite ways, move as one.        #
   * #                                                                 #
   * # The vignette alone recovers the whole camera curve to 0.06%     #
   * # using no type at all.                                           #
   * ##################################################################
   *
   * ##################################################################
   * # LINEAR IN sRGB BYTES, WHICH IS WHAT A CSS GRADIENT ALREADY      #
   * # DOES. A free exponent fits to 0.998-1.001.                      #
   * #                                                                 #
   * # Rival falloffs, by how much worse: linear light 7-26x,          #
   * # smoothstep 14-42x, THIS PROJECT'S OWN SHARED SMOOTHSTEP LAW     #
   * # 48x, super-Gaussian 85x, Gaussian 106-329x.                     #
   * #                                                                 #
   * # So a canvas or shader build working in linear light lands up to #
   * # three codes dark in the middle of the ramp, which reads as a    #
   * # visible dark ring.                                              #
   * ##################################################################
   *
   * The knees are HARD. Fitting a Gaussian softening returns sigma 4.3 design
   * px, which is smaller than the 8.66px between consecutive 8-bit code steps
   * and is therefore unresolvable and consistent with zero.
   */
  vignette: {
    /** `r = hypot(dx, aspect * dy)`, so the ellipse is 16:9. */
    aspect: 16 / 9,
    /** Design px. The plateau runs out to here. */
    innerRadius: 678.2,
    /** Design px. The floor is reached here and holds. */
    outerRadius: 1153.4,
    /**
     * The floor, `#B1B1B1`. Measured 176.67 — mode 177 at 68% with a stubborn
     * 30% at 176, which hints at a non-integer authored value.
     *
     * DO NOT spell this as a `#B1B1B1` overlay at alpha 0.99. Compositing 177
     * over 247.94 reaches 176.67 only at alpha 1.0047; at 0.99 you land a full
     * code too bright at the corners. If an alpha spelling is forced, black at
     * `1 - 176.67/247.94 = 0.28744`.
     */
    floorColour: '#B1B1B1',
  },

  type: {
    /**
     * Noto Sans Regular, already vendored as `bodyFace.ts` for a5.
     *
     * Three lanes tested the face three different ways and all three land on
     * it by a wide margin. A 2-D template match over 31 candidates scored Noto
     * at 0.01749 against the next best at 0.23668 — 13.5x. A position-only
     * regression over 28 words and 1400px scored it at 0.068px rms against a
     * next best of 2.17px — 32x. A third lane over 9 faces scored 7.99 against
     * 28.98.
     *
     * The two deliberate SERIF controls landed mid-pack rather than last,
     * which is what proves the metric discriminates on letterform geometry
     * rather than merely on "is it a sans".
     */
    fontSize: 32,

    /**
     * 1.6 em. The line box is 51.2 design px where the em is 32.
     *
     * ##################################################################
     * # THIS IS WHY `top: baseline - fontSize` IS WORSE HERE THAN      #
     * # ANYWHERE ELSE IN THE PROJECT.                                  #
     * #                                                                 #
     * # It has shipped wrong twice, on a3 and a5, and 464 tests passed #
     * # over it because nothing in this repo lays out text. There the  #
     * # error was 0.112em. Here the line height is 1.6 rather than 1,  #
     * # so the baseline sits 38.016 design px below the line box top   #
     * # rather than 32 — an error of 6.0 design px, 7.8 settled px,    #
     * # PER LINE.                                                       #
     * #                                                                 #
     * #   baseline = lineBoxTop                                        #
     * #            + (lineHeight - 1.362 * fontSize) / 2               #
     * #            + 1.069 * fontSize                                  #
     * #                                                                 #
     * # This file reports BASELINES throughout, never tops of type.    #
     * ##################################################################
     */
    lineHeight: 51.2,

    /**
     * Between the last baseline of one paragraph and the first of the next.
     * The extra gap over a normal line is 83.2 - 51.2 = 32, exactly one em.
     */
    paragraphPitch: 83.2,

    /**
     * The first baseline, CONTINUOUS. The browser rounds each rendered
     * baseline to an integer and lands on 393, 445, 528, 579, 662, 713.
     *
     * ##################################################################
     * # 393.4 IS NOT 393, AND THE DIFFERENCE IS THE WHOLE REASON THE   #
     * # SIX RENDERED INTEGERS COME OUT AS THEY DO.                     #
     * #                                                                 #
     * # b = 393.4, p = 51.2, q = 83.2 gives                            #
     * #   393.4 / 444.6 / 527.8 / 579.0 / 662.2 / 713.4                #
     * # which rounds to all six. Starting at a flat 393 would give     #
     * #   393 / 444.2 / 527.4 / 578.6 / 661.8 / 713.0                  #
     * # which rounds line 2 to 444 rather than 445.                    #
     * #                                                                 #
     * # AND THERE IS NO CONSTANT LINE-HEIGHT THAT PRODUCES THE SETTLED #
     * # GAPS 68 / 67 / 66. That was proved analytically rather than    #
     * # searched: constant spacing forces two differences to be equal  #
     * # and under -0.5 at once, which the rounding bound forbids. The  #
     * # settled gaps differ ONLY because the browser re-lays-out at    #
     * # the final size. Lay out at design scale and let the transform  #
     * # carry it.                                                       #
     * ##################################################################
     */
    firstBaseline: 393.4,

    /** The rendered integers, for the test to pin. */
    baselines: [393, 445, 528, 579, 662, 713],

    /** The pen origin. Measured 319.988 and 320.015 by two lanes. */
    columnLeft: 320,

    /**
     * INFERRED, NOT MEASURED. Nothing in the frames draws the column's right
     * edge, and 1240, 1250, 1260, 1280 and 1300 all wrap this copy identically.
     *
     * The hard bracket is [1222.5, 1310.0) and it comes from a contradiction:
     * line 5 wraps before the bold "exactly" even though `L5 + " exactly"` is
     * 1187.3 design px, less than line 1's own 1222.45. That only resolves if
     * the marks are UNBREAKABLE — see `whiteSpace: nowrap` on the mark.
     *
     * 1280 is chosen because it makes the right margin equal the
     * measured-exact left margin of 320. It changes nothing for THIS copy and
     * it changes where DIFFERENT copy wraps.
     */
    columnWidth: 1280,

    /**
     * `#3B3B3B`, and the bold is the SAME colour.
     *
     * The frames contain (59,59,59) to (60,60,60) as the mode over pixels
     * above 98.5% coverage. The bold reads 0.5-0.9 levels darker, which is
     * exactly what its wider stem alone predicts, so do not give it its own
     * colour.
     *
     * Bias direction: h264 FATTENS these strokes rather than eating them here
     * — the residual against the outline is a thin symmetric halo showing the
     * frame's strokes 0.02-0.05px wider. So the measured ink is if anything
     * one to two levels too light, and the true source is `#3A3A3A` or
     * `#3B3B3B`. `#333333` is excluded; it would read 52-54 and nothing does.
     */
    colour: '#3B3B3B',

    /**
     * Exactly zero, bracketed under 0.0012 em.
     *
     * ##################################################################
     * # FONT SIZE AND TRACKING ARE DEGENERATE HERE AND A FREE JOINT    #
     * # FIT DIVERGES — one run reached size 43.15 with tracking        #
     * # -3.54px per character in three iterations.                     #
     * #                                                                 #
     * # What the pixels actually pin is the ADVANCE, to 7e-5 relative. #
     * # (32, 0) is the round point on that ridge and it reproduces     #
     * # every position to 0.1px, but it is ONE POINT ON A RIDGE. With  #
     * # tracking pinned to 0 the size minimum is razor sharp: rms 7.93 #
     * # at 32.00 against 12.87 at 31.95 and 14.04 at 32.05.            #
     * #                                                                 #
     * # A letter-spacing of 0.01em would push line 5's last word 30px  #
     * # right of where it is. It is not there.                         #
     * ##################################################################
     */
    letterSpacing: 0,

    /**
     * The marked phrases' advance, over the same string set in the regular.
     *
     * Measured as the gap between two independently locked regular-weight runs,
     * so no bold outline is needed to get it: 1.0833, 1.0719, 1.0928 on the
     * three phrases, 1.0802 overall. Two lanes agreed to within 0.06px on every
     * one. The per-character increment spans 1.432 to 1.826 settled px, a 27%
     * spread, which is what proves it is a REAL WEIGHT and not a stroke — a
     * synthetic stroke adds a constant amount to every advance.
     */
    boldAdvanceRatio: 1.0802,
    /*
     * ##################################################################
     * # THE BOLD IS A REAL NOTO SANS BOLD SINCE 2026-09-11, AND THE     #
     * # TRACKING STAND-IN THAT USED TO SIT HERE IS GONE.                #
     * #                                                                 #
     * # Chrome's synthetic bold adds NOTHING to advances: measured off  #
     * # a render, the rects came out 436 / 696 / 354 settled px against #
     * # his 472 / 746 / 388. A 1.2px-per-character tracking restored    #
     * # the width between glyphs, where his lives inside them.          #
     * #                                                                 #
     * # `bodyFaceBold.ts` now registers Noto Sans Bold 2.015 in this    #
     * # family. Measured with fontTools and GPOS kerning, it sets his   #
     * # three phrases at 1.0806 / 1.0662 / 1.0913 of the regular, so    #
     * # the rects land 0.9 / 3.1 / 0.4 design px short of his. The      #
     * # stand-in was 0.8 over / 3.4 over / 3.7 short, in the wrong      #
     * # weight. A render still has to confirm it before a clip goes out.#
     * ##################################################################
     */
  },

  highlight: {
    /**
     * `#FBE742`, fully opaque, painted ABOVE the vignette and BELOW the text.
     *
     * Mode exactly (251, 231, 66) over 27,366 eroded samples at 55.8%, with
     * the median identical, reproduced by two other lanes with different masks
     * at 50.6% and 56.4%.
     *
     * ##################################################################
     * # THE AUTHORED VALUE IS A BRACKET, NOT A HEX YOU CAN TRUST TO    #
     * # THE BIT. Any RGB in R 249-253, G 229-233, B 64-68 decodes to   #
     * # within one level of what the frames contain — 33 candidates.   #
     * # `#FBE742` sits at the centre of that set, and no repdigit,     #
     * # web-safe, Tailwind or Material yellow lies inside it, so do    #
     * # not go hunting for a rounder value. Expect +/-2 per channel.   #
     * ##################################################################
     *
     * NOT vignetted. The control is direct: at x = 130 the paper immediately
     * below the third block reads 242.98 against 248.00 further right — a five
     * level drop — while the yellow at the same x still reads exactly 218.17,
     * a zero level drop. And the fill's red EXCEEDS the page's red everywhere,
     * which no darkening composite can produce.
     */
    colour: '#FBE742',

    /**
     * ZERO. The rect's left edge IS the pen position where the bold run starts.
     *
     * Predicted 551, 652, 320 from the regular text in front of each; measured
     * 551.05, 651.94, 319.94. Three for three. Rect width minus bold advance
     * is -0.47, +0.57, +0.62 px.
     *
     * ##################################################################
     * # THE 1-3px YOU WILL SEE BETWEEN THE RECT EDGE AND THE NEAREST   #
     * # INK IS THE FIRST AND LAST GLYPH'S SIDE BEARING, and it is      #
     * # UNEQUAL left against right because the phrases begin with      #
     * # 'h','s','e' and end with 't','s','t'. A real padding would be  #
     * # the same on all six edges. `padding: 0 2px` makes every block  #
     * # 4px too wide and moves all three left edges off their integers.#
     * ##################################################################
     */
    paddingX: 0,

    /**
     * The rect is EXACTLY THE CSS LINE BOX. Not the ink, and not the em box.
     *
     * ##################################################################
     * # A PLAIN `<span style="background: yellow">` IS WRONG BY ABOUT  #
     * # 4px AT THE TOP AND 4px AT THE BOTTOM OF EVERY BLOCK.           #
     * #                                                                 #
     * # An inline element's background paints its CONTENT box, which   #
     * # is ascent plus descent = 1.362em = 43.584 design px, starting  #
     * # at baseline - 34.208. The frames show 51.2px starting at       #
     * # baseline - 38.016.                                             #
     * #                                                                 #
     * # The fix is vertical padding of exactly the half-leading. On an #
     * # INLINE element vertical padding does not affect line height,   #
     * # but it does extend the background box — which is precisely     #
     * # what is wanted.                                                 #
     * #                                                                 #
     * # Confirmation that this is the line box and not a coincidence:  #
     * # predicting the top from Noto Sans's own hhea metrics and a 67  #
     * # settled px line box gives baseline - 49.64 against a measured  #
     * # -49.5 to -49.64. A 0.09px hit, and an independent confirmation #
     * # of both the face's vertical metrics and the 51.2 line height.  #
     * ##################################################################
     */
    boxTopAboveBaseline: 38.016,

    /**
     * Bounded at or under 2 design px by two independent estimators, best
     * estimate 0 to 1.
     *
     * FIVE of the twelve measured corner offsets are NEGATIVE, which a real
     * radius cannot produce, so that scatter is the estimator's floor and it
     * caps any true radius at about 2px. A 4px radius is already worse at 11
     * of 12 corners and 8px is worse at all 12.
     */
    cornerRadius: 0,

    /**
     * 13 frames per highlighted word, chained with NO gap.
     *
     * ##################################################################
     * # EACH SWEEP STARTS ON THE EXACT FRAME THE PREVIOUS ONE ENDS,    #
     * # AND THE FIRST STARTS ON LOCAL 0.                               #
     * #                                                                 #
     * # With ZERO free parameters — starts 0/39/91, durations          #
     * # 39/52/39, the easing below — the pooled residual is 0.96       #
     * # content px, and 0.43/0.63/0.40 excluding each sweep's first    #
     * # four frames. Freeing the start and duration per highlight      #
     * # returns t0 = -0.00 / +38.95 / +90.95 and D = 39.00 / 52.20 /   #
     * # 39.15. The integers fall straight out.                          #
     * #                                                                 #
     * # A MODEL-FREE TIME WARP settles it without any easing function  #
     * # anywhere in the calculation: fitting p1(t) = p2(a*t + b)       #
     * # returns a = 1.3340, b = 39.000, and for the third a = 1.0000,  #
     * # b = 91.000. The 3:4:3 ratio, the chaining and the zero gap all #
     * # fall out at once.                                              #
     * #                                                                 #
     * # THE 2-D SCAN OVER (start, rate) HAS A SHARP ISOLATED MINIMUM   #
     * # at exactly (0, 13.0000). Moving the start half a frame costs   #
     * # 8.1px rms; a rate of 12.5 or 13.5 costs 38-39px.               #
     * ##################################################################
     *
     * ##################################################################
     * # DO NOT START THE CHAIN ON THE FIRST FRAME THAT SHOWS YELLOW.   #
     * #                                                                 #
     * # Local 0 carries a complete page with EXACTLY ZERO yellow,      #
     * # because the wipe has advanced zero pixels — not because it has #
     * # not started. First yellow is local 1 / 40 / 92.                #
     * #                                                                 #
     * # This also means the highlights start FOUR FRAMES BEFORE the    #
     * # camera does.                                                    #
     * ##################################################################
     *
     * Rival duration laws, in rms frames of duration error: words 0.14,
     * constant 6.11, characters 6.43, rect width in px 6.44, characters
     * excluding spaces 6.84, syllables 7.19. Only a discrete count fits.
     *
     * ##################################################################
     * # "WORDS" IS AN ATTRIBUTION, NOT A MEASUREMENT. Only two         #
     * # distinct counts occur across three phrases, so anything that   #
     * # reads (3, 4, 3) for these particular strings fits identically  #
     * # — space count plus one, token count, syllable groups. Words is #
     * # the simplest survivor. ONE more highlight anywhere in his      #
     * # material with a count other than 3 or 4 would settle it.       #
     * ##################################################################
     */
    framesPerWord: 13,

    /**
     * Material Design's "standard" curve, and a free four-parameter search
     * lands on it EXACTLY.
     *
     * Rivals, each given its own free start and duration — the most generous
     * possible treatment — in pooled rms content px:
     *
     *   Material (0.4, 0, 0.2, 1)      0.947   <- winner
     *   CSS ease (.25,.1,.25,1)        6.633   <- 7x, and the best named rival
     *   easeInOutQuad                 16.116
     *   CSS ease-in-out               16.644
     *   Ant Design (.645,.045,.355,1) 18.778
     *   easeInOutCubic                20.127
     *   CSS ease-out                  24.648
     *   easeOutCubic                  33.466
     *   linear                        45.721
     *
     * ##################################################################
     * # DO NOT USE THIS CURVE FOR THE CAMERA. The wipes are a clean    #
     * # named bezier; the camera is not, and its best single bezier is #
     * # 60x its own noise floor. Two different laws in one animation.  #
     * ##################################################################
     *
     * 50% complete at 35.05% of the duration (measured 0.3506 / 0.3501 /
     * 0.3507; the analytic value for this curve is exactly 0.3500). Velocity
     * peaks at 30.2%.
     */
    ease: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  },
} as const

/**
 * The camera's progress, per frame, measured rather than fitted.
 *
 * ####################################################################
 * # NO NAMED EASING FITS THIS CURVE AND NOBODY FOUND WHAT GENERATES   #
 * # IT. SHIP THE TABLE.                                               #
 * #                                                                   #
 * # 24 named curves plus five free-parameter families were fitted     #
 * # against a measurement whose own noise floor is 0.0125px at a      #
 * # 745px lever. In rms px at that lever:                             #
 * #                                                                   #
 * #   two free beziers in series           0.169   13x the floor      #
 * #   best free single bezier              0.778   60x                #
 * #   critically damped spring             1.834                      #
 * #   CSS ease                             2.403  146x                #
 * #   cubic ease-out                       3.511                      #
 * #   CSS ease-out                         4.758                      #
 * #   Penner easeInOutCubic                5.183                      #
 * #   CSS ease-in-out                      5.668                      #
 * #   linear                               6.938                      #
 * #                                                                   #
 * # Refitting against 1/S, log S and S^2 gives 0.858, 0.828 and       #
 * # 0.714px, so the animated quantity is not a scale, an inverse, a   #
 * # log or an area in disguise. The tail is a clean exponential with  #
 * # tau about 17-18 frames but the rise is far too gradual for any    #
 * # linear second-order system with that tail, which is why every     #
 * # spring fails at every damping ratio.                              #
 * #                                                                   #
 * # Forced to ship one line of CSS, `cubic-bezier(0.3474, 0.2591,     #
 * # 0.0516, 1.0000)` over local 13.32 to 111.51 is wrong by up to     #
 * # 1.5px at the frame edge.                                          #
 * ####################################################################
 *
 * The curve in words: dead flat for four frames, then velocity climbs from
 * zero and peaks at local 32-33 — a quarter of the way through — and then a
 * long slowly decaying tail takes another 97 frames to land.
 */
const CAMERA_PROGRESS: readonly number[] = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.00026, 0.00056, 0.00113,
  0.00182, 0.00317, 0.00465, 0.00652, 0.00882, 0.01225, 0.01612, 0.02076,
  0.02619, 0.03284, 0.0404, 0.05008, 0.06046, 0.07237, 0.08661, 0.10234,
  0.11997, 0.14, 0.16232, 0.187, 0.21358, 0.24216, 0.27265, 0.30467,
  0.33768, 0.37108, 0.40435, 0.43706, 0.46916, 0.50013, 0.52936, 0.55703,
  0.58357, 0.60833, 0.63196, 0.65359, 0.67418, 0.69355, 0.71167, 0.72861,
  0.74442, 0.75919, 0.77322, 0.78647, 0.79884, 0.81027, 0.82108, 0.83116,
  0.84102, 0.84984, 0.85835, 0.8663, 0.87377, 0.88098, 0.88772, 0.89401,
  0.90018, 0.90553, 0.91091, 0.91569, 0.92038, 0.92485, 0.92924, 0.93311,
  0.93689, 0.94049, 0.94401, 0.94696, 0.94987, 0.95283, 0.95569, 0.95817,
  0.96052, 0.96277, 0.96499, 0.96686, 0.96877, 0.97064, 0.97237, 0.97398,
  0.97555, 0.97715, 0.97867, 0.97985, 0.98102, 0.98219, 0.98332, 0.98432,
  0.98532, 0.98627, 0.98723, 0.98805, 0.98892, 0.98975, 0.99062, 0.99114,
  0.9917, 0.99231, 0.99292, 0.99335, 0.99375, 0.99422, 0.99466, 0.99505,
  0.99544, 0.99587, 0.99631, 0.99666, 0.99696, 0.99731, 0.99761, 0.99783,
  0.998, 0.99831, 0.99861, 0.99891, 0.99917, 0.99931, 0.99939, 0.99957,
  0.9997, 0.99983, 1.0,
]

/** The inclusive last frame of a2's own scene, for the reference copy. */
export const HIGHLIGHT_PAGE_LAST_FRAME = HIGHLIGHT_PAGE.totalFrames - 1

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * A cubic bezier easing, solved by bisection on x.
 *
 * Copied rather than shared with the other clocks on purpose. Every clock
 * module in this folder imports NOTHING, which is what keeps the `.test.ts`
 * lane safe under `--conditions react-server`.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
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

/** How many words a phrase has, which is what sets its sweep's length. */
export function highlightPageWordCount(phrase: string): number {
  return phrase.trim().split(/\s+/).filter((word) => word.length > 0).length
}

/**
 * The whole shot's length, in frames, DERIVED FROM THE COPY.
 *
 * ####################################################################
 * # a2 IS THE ONLY ONE OF HIS NINE WHOSE DURATION IS NOT A CONSTANT,  #
 * # AND GETTING IT WRONG CUTS A WIPE OFF OR LEAVES DEAD AIR.          #
 * #                                                                   #
 * # In the reference the third highlight completes on exactly the     #
 * # frame the camera stops and the freeze begins. 13 * 10 + 48 = 178. #
 * #                                                                   #
 * # A CONFOUND THE CALLER MUST KNOW ABOUT. The chain's total, 130     #
 * # frames, is ALSO exactly the interval from the first frame to the  #
 * # camera's stop. From one instance you cannot tell whether 13       #
 * # frames per word is the primitive and the length follows, or       #
 * # whether the 130-frame span is the primitive and the words merely  #
 * # split it 3 : 4 : 3. The two diverge the moment a caller supplies  #
 * # a different word count: one lengthens the shot, the other         #
 * # compresses the wipes.                                             #
 * #                                                                   #
 * # THIS IS THE FIRST READING AND IT IS A HYPOTHESIS.                 #
 * ####################################################################
 */
export function highlightPageFrameCount(phrases: readonly string[]): number {
  const words = phrases.reduce((total, phrase) => total + highlightPageWordCount(phrase), 0)
  const held = HIGHLIGHT_PAGE.totalFrames - HIGHLIGHT_PAGE.moveEndFrame
  return HIGHLIGHT_PAGE.highlight.framesPerWord * words + held
}

/**
 * Each phrase's sweep window, chained with no gap, in local frames.
 *
 * The first opens on local 0 and each subsequent one opens on the frame the
 * previous closes.
 */
export function highlightPageSchedule(
  phrases: readonly string[],
): readonly { from: number; to: number }[] {
  const windows: { from: number; to: number }[] = []
  let cursor = 0
  for (const phrase of phrases) {
    const span = HIGHLIGHT_PAGE.highlight.framesPerWord * highlightPageWordCount(phrase)
    windows.push({ from: cursor, to: cursor + span })
    cursor += span
  }
  return windows
}

/**
 * How much of one phrase's yellow block is revealed at a frame, 0 to 1.
 *
 * A hard, LEFT-ANCHORED WIDTH WIPE at full opacity and full height from its
 * very first frame. Five rivals are dead, each with its own control:
 *
 *  - a fade is dead, because the measured luma AREA of the first three frames
 *    matches an alpha-1 geometric model to 0.07-0.33px, where a ramping alpha
 *    would make the early areas systematically short. And the interior colour
 *    at 40% coverage is statistically identical to the settled colour.
 *  - a scale from the centre or the left is dead, because the left edge is
 *    PINNED: sd 0.20 / 0.11 / 0.07 content px while the right edges travel
 *    472, 748 and 387px.
 *  - a grow-from-top is dead: full height on the first frame showing yellow.
 *  - a feathered edge is dead: measured in LUMA, which is full resolution,
 *    the static trailing edge is 1.60px and the moving leading edge 2.01px,
 *    and that 0.41px is the encoder spending fewer bits on a freshly-moved
 *    edge. No designed feather above about one pixel.
 *  - a per-word stepper is dead: on the third phrase the right edge crosses
 *    its two word gaps at 13.2 and 7.0 frame intervals for word widths of 156
 *    and 140px, a 2.7x spread. One continuous eased sweep whose DURATION is
 *    set by a word count, not a sequence of per-word reveals.
 *
 * ####################################################################
 * # A REAL, REPRODUCIBLE DEPARTURE AT ONSET, AND IT IS NOT MODELLED.  #
 * #                                                                   #
 * # Over each sweep's first four frames all three run 1.8 to 4.4      #
 * # content px WIDER than this curve, with the same sign every time,  #
 * # found independently by two measurements. At first light the rect  #
 * # is about 0.97 frame px wide where the model predicts 0.49.        #
 * #                                                                   #
 * # Either the renderer has a sub-pixel floor on a thin sliver, or    #
 * # the true curve has marginally less ease-in over its first two     #
 * # frames. It is at most 3.4 screen px, for four frames out of 39,   #
 * # and it moves neither the start, the duration nor the easing.      #
 * #                                                                   #
 * # From frame five onward the model sits at 0.4-0.6px, which is      #
 * # three to five times the estimator's own floor — NOT at it. Two    #
 * # lanes claimed "at the noise floor" against their own coarser      #
 * # floors. There is still no better curve hiding in the data: four   #
 * # free control points buy only 0.947 -> 0.923 and a free search     #
 * # returns Material exactly.                                         #
 * ####################################################################
 */
export function highlightPageReveal(
  frame: number,
  window: { from: number; to: number },
): number {
  const { ease } = HIGHLIGHT_PAGE.highlight
  const t = clamp01((frame - window.from) / (window.to - window.from))
  return cubicBezier(ease.x1, ease.y1, ease.x2, ease.y2, t)
}

/**
 * The page's scale at a frame.
 *
 * Flat for the first four frames, then the measured table, then held.
 */
export function highlightPageScale(frame: number): number {
  const { camera } = HIGHLIGHT_PAGE
  const index = Math.round(frame)
  const progress =
    index <= 0
      ? 0
      : index >= CAMERA_PROGRESS.length
        ? 1
        : (CAMERA_PROGRESS[index] ?? 1)
  return camera.scaleFrom + (camera.scaleTo - camera.scaleFrom) * progress
}

/**
 * The design-space y of a paragraph's first baseline, 0-based paragraph index.
 *
 * Continuous, not the rendered integer — the browser rounds, and reproducing
 * the rounding is the browser's job rather than this file's.
 */
export function highlightPageParagraphBaseline(index: number): number {
  const { firstBaseline, lineHeight, paragraphPitch } = HIGHLIGHT_PAGE.type
  /* Every paragraph in the reference is exactly two lines. */
  return firstBaseline + index * (lineHeight + paragraphPitch)
}

/**
 * The design-space top of the text block, so its first baseline lands right.
 *
 * `baseline = blockTop + halfLeading + ascent`, and for Noto Sans at these
 * settings that is `blockTop + 38.016`. See the box on `lineHeight`.
 */
export function highlightPageBlockTop(): number {
  return HIGHLIGHT_PAGE.type.firstBaseline - HIGHLIGHT_PAGE.highlight.boxTopAboveBaseline
}
