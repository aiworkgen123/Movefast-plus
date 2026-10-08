/**
 * `chapter-plate`, the client's "chapter title v2": every number it draws with.
 *
 * Pure. NO IMPORTS AT ALL, the same shape as `chapterTitleClock.ts` and
 * `nameCardClock.ts`, so the whole device is checkable in the fast `.test.ts`
 * lane — which runs under `--conditions react-server`, where a `remotion`
 * import dies at the import line with an error that reads nothing like the
 * cause. `ChapterPlate.tsx` holds no number of its own; it reads them here.
 *
 * ####################################################################
 * # PROVENANCE. Section 1 of `tmp/v53/overlays/SPEC-measured.md`,     #
 * # measured frame by frame off his own delivered                     #
 * # `chapter title v2.mp4`, which is 1920x1080 at 60fps. TWO samples, #
 * # so the geometry is corroborated rather than read off one still:   #
 * #                                                                   #
 * #   "Three Great Ages"        x 222..1697, y 448..628, cap ~152px   #
 * #   "The Elder Earth Passage" x 106..1813, y 458..607               #
 * #                                                                   #
 * # NOTHING HERE IS A PREFERENCE. If a render disagrees with his      #
 * # clip, the number is wrong and the fix is another measurement.     #
 * ####################################################################
 *
 * ####################################################################
 * # EVERY TIME IN THIS FILE IS MEASURED FROM THE SHOT'S OWN FIRST     #
 * # FRAME, WHICH IS NOT ALWAYS THE PICTURE CUT. READ THIS BEFORE      #
 * # TOUCHING ANY NUMBER BELOW. The comment that stood here until      #
 * # 2026-09-16 said "from the picture cut", in a detailed and         #
 * # confident box, and on one of the two clips that is a film frame   #
 * # early.                                                            #
 * #                                                                   #
 * # BOTH clips open on BLACK and cut to the photograph part way in,   #
 * # and neither lead-in is part of the device:                        #
 * #                                                                   #
 * #   "Three Great Ages"        picture cut at clip frame 35          #
 * #   "The Elder Earth Passage" picture cut at clip frame 25          #
 * #                                                                   #
 * # `SPEC-measured.md` read its seconds off the CLIP clock, so every  #
 * # timing it stated was late by one lead-in. Its "rule appears       #
 * # 0.58s" is not a rule timing at all, it is sample one's lead-in    #
 * # length. THAT much of the earlier correction stands and is not     #
 * # what changed.                                                     #
 * #                                                                   #
 * # WHAT DID NOT STAND: THAT THE PICTURE CUT IS THE SHOT'S FRAME 0.   #
 * # On "The Elder Earth Passage" it is not. Its lead-in is 25 clip    #
 * # frames, but the last TWO of them are a DIFFERENT BLACK. Top-strip #
 * # mean luma, `crop=1920:40:0:0`, per clip frame:                    #
 * #                                                                   #
 * #   frames  0..22    1.670 to 1.678    the lead-in's own black      #
 * #   frames 23, 24    0.966, 0.968      A SECOND, DARKER BLACK       #
 * #   frames 25 on     62.4              the photograph               #
 * #                                                                   #
 * #   and the other clip for contrast: frames 0..34 all read 1.660 to #
 * #   1.673, ONE uniform black, and frame 35 steps to 6.58. No        #
 * #   second black, nothing before the cut.                           #
 * #                                                                   #
 * # So "The Elder Earth Passage" SHOT begins at clip frame 23, and it #
 * # opens on one film frame of black before its own picture arrives.  #
 * # Two clip frames is exactly one film frame; see the box below.     #
 * #                                                                   #
 * # THREE THINGS SAY THIS IS THE ANIMATION'S CLOCK AND NOT A          #
 * # CURIOSITY OF THE ENCODE:                                          #
 * #                                                                   #
 * #   1. Fit both clips with the time offset left FREE and it returns #
 * #      +1.98 clip frames on "The Elder Earth Passage" and +0.02 on  #
 * #      "Three Great Ages". The fitter was never told about the      #
 * #      black, and it lands on the pair boundary to 0.02 of a frame. #
 * #   2. On that clip the offset is the difference between a fit that #
 * #      works and one that does not: rms 1.04px with it against      #
 * #      9.68px without, on the same four bar edges.                  #
 * #   3. The two darker frames are a PAIR, 23 and 24, not one frame   #
 * #      and not three, which is what a 30fps authoring rate makes    #
 * #      them and what a container hiccup would not.                  #
 * #                                                                   #
 * # WHY IT MATTERED. Measuring that clip from its picture cut reads   #
 * # every timing on it one film frame short. It is not a rounding     #
 * # error: a straight line through the ORIGIN fitted to data that is  #
 * # really `(t + 1) / 36` comes back as `t / 34.6`, so the clip       #
 * # reported the 36-frame wipe as 34.6 frames, which is the 1.1532s   #
 * # this file used to average in. Recompute it and see — 36 * S(t^2)  #
 * # / (S(t^2) + S(t)) over t = 10..35 is 34.615, against the 34.60    #
 * # that was measured.                                                #
 * ####################################################################
 *
 * ####################################################################
 * # HIS CLIPS ARE 60fps CONTAINERS CARRYING 30fps CONTENT, SO THE     #
 * # FILM'S RATE NEEDS NO GUESSWORK.                                   #
 * #                                                                   #
 * # Every clip frame is identical to its neighbour in pairs, and the  #
 * # second black above is itself a pair. The animation underneath was #
 * # authored at 30, the film's own rate, so one film frame is two     #
 * # clip frames exactly and the halving below is a fact rather than a #
 * # conversion.                                                       #
 * #                                                                   #
 * # Measured from each SHOT'S OWN FIRST FRAME, on BOTH samples, by    #
 * # recovering per-pixel alpha by linear unmixing against the         #
 * # picture-cut frame and then fitting ONE model to the bar's four    #
 * # edges across every frame of both clips:                           #
 * #                                                                   #
 * #                       Elder Earth  Three Ages   taken             #
 * #   group fade full       0.3946s     0.3940s     0.39s  11.7 frames#
 * #   rule wipe full        1.2000s     1.2004s     1.20s  36 frames  #
 * #   group scale settles   2.499s      2.487s      2.50s  75 frames  #
 * #   start scale           0.7636      0.7643      0.765             #
 * #                                                                   #
 * # THE WHOLE-MODEL RESIDUAL IS THE ARGUMENT, not any single row.     #
 * # This set reproduces his four bar edges at rms 0.26px and 0.32px,  #
 * # worst 1.0px and 1.3px, over 100+ frames per clip. The set this    #
 * # file carried before — 0.35 / 1.18 / 2.475 / 0.766 and a derived   #
 * # 535.16px scale origin — reproduces the SAME frames at rms 4.59px  #
 * # and 3.95px, worst 28.4px and 25.2px.                              #
 * #                                                                   #
 * # THE OLDEST NUMBERS WERE 1.40s, 0.58s AND 1.65s, AND ALL THREE     #
 * # WERE THE LEAD-IN MISTAKE IN ITS FIRST, LARGER FORM.               #
 * ####################################################################
 */

/** The film's rate. His clip is 60fps; see the box above. */
export const CHAPTER_PLATE_FILM_FPS = 30

/** His clip's rate, kept only so the halving above can be read back. */
export const CHAPTER_PLATE_CLIP_FPS = 60

/**
 * The heading: a centred display serif straight onto the photograph, with no
 * plate and no backing of its own.
 *
 * ####################################################################
 * # THE SIZE IS DERIVED FROM THE CAP HEIGHT, WHICH IS WHAT WAS        #
 * # MEASURED. A font-size cannot be measured off a video at all —     #
 * # only ink can — so typing one would be inventing the number that   #
 * # matters most.                                                     #
 * ####################################################################
 *
 * ####################################################################
 * # PLAYFAIR IS NOT HIS FACE, IT IS THE CLOSEST OPEN ONE, AND IT IS   #
 * # WIDER. RECORDED RATHER THAN TUNED AWAY.                           #
 * #                                                                   #
 * # At the derived size, Playfair Display 700 sets "Three Great       #
 * # Ages" about 1713px wide (advances only, no kerning) against the   #
 * # 1475px his clip shows — about 16% wider at the same cap height.   #
 * # `constants.ts` already says as much on `SERIF_FAMILY`: the face   #
 * # was chosen as the closest open match, not as an identification.   #
 * #                                                                   #
 * # THE CONSEQUENCE IS A FIT PROBLEM, NOT A SIZE PROBLEM. His own     #
 * # 16-character sample lands 1713px wide inside a 1728px title-safe  #
 * # box, so it fits with 15px to spare and ANYTHING LONGER DOES NOT.  #
 * # The schema admits 20 characters. See the box on `ChapterPlate`.   #
 * ####################################################################
 */
export const CHAPTER_PLATE_TYPE = {
  /**
   * Cap height in frame pixels, measured on sample 1.
   *
   * ####################################################################
   * # 132, AND IT WAS 152 UNTIL 2026-09-14. 152 WAS NOT A CAP HEIGHT.  #
   * #                                                                   #
   * # The first measurement took the full ink bounding box of "Three    #
   * # Great Ages", y 448..628, called the top of it the cap line and    #
   * # subtracted a guess at the descender. Neither edge of that box is  #
   * # a cap line: y 448 is the ASCENDER of the `h`, and y 628 is the    #
   * # DESCENDER of the `g`.                                             #
   * #                                                                   #
   * # Re-measured by row-wise ink profile on the settled frame, which   #
   * # is the only way to see the two lines rather than the extremes:    #
   * #                                                                   #
   * #   y 448..460   28 to 52 px of ink   the `h` ascender, the `A` apex#
   * #   y 462        jumps to 138          THE CAP LINE, T G A arrive   #
   * #   y 464..592   400 to 590 px         the body of the line         #
   * #   y 594        collapses to 24       THE BASELINE                 #
   * #   y 596..628   about 20 px           the `g` descender alone      #
   * #                                                                   #
   * # So cap height is 594 - 462 = 132, and ascender-to-baseline is     #
   * # 146. The old 152 sat between the two and matched neither.         #
   * #                                                                   #
   * # THIS IS NOT COSMETIC. The font size is DERIVED from this number,  #
   * # so 152 set the heading about 13% too large, and that overshoot is #
   * # most of why only 13 characters fitted the title-safe box while    #
   * # his own sample is 16. Correcting it is what lets his own sample   #
   * # draw.                                                             #
   * ####################################################################
   */
  capHeightPx: 132,

  /**
   * The baseline, in frame pixels from the top.
   *
   * Read straight off the ink profile in the box above: y 594 is where the row
   * ink collapses from 303 px to 24 px. Everything below it is the `g`
   * descender. NOT derived as `capTop + capHeight`, because that only holds if
   * the cap top is right, and the old value proves that assumption can be wrong
   * without anything going red.
   */
  baselinePx: 594,

  /**
   * The measured centre of both samples, x 959.5.
   *
   * That is the centre of a 1920-column grid counted inclusively, which is the
   * frame centre `FRAME_WIDTH / 2` = 960 in CSS. The component does NOT type
   * either number: it centres the heading in the title-safe box, whose centre
   * is the frame's, and `ChapterPlate.mount.test.tsx` pins that.
   */
  centreXPx: 959.5,

  /** Warm off-white, never pure white. The same ink in all three light designs. */
  colour: '#FDFAE7',

  /**
   * 700, and it is a REAL instance rather than a synthesised fake.
   *
   * `fonts.ts` registers `SERIF_FAMILY` at 500 and 700 only, both pinned out of
   * the one variable file. Asking for any other weight gets whatever the
   * browser synthesises, which nobody has reviewed, and it fails soft.
   */
  fontWeight: 700,

  /**
   * Playfair Display's cap height as a fraction of its em: `OS/2.sCapHeight`
   * 708 of 1000 units, which the `H`, `T` and `E` outlines agree with exactly,
   * at the 700 instance as well as at the default.
   *
   * Read out of the shipped `public/fonts/PlayfairDisplay-Variable.woff2`, not
   * from a specimen page. Recompute it if the face ever changes.
   */
  capOverEm: 0.708,

  /**
   * Where the baseline sits inside a `line-height: 1` box, as a fraction of the
   * font size.
   *
   * ####################################################################
   * # `top = baseline - fontSize` IS WRONG AND IT SHIPPED ONCE.        #
   * #                                                                   #
   * # With `line-height: 1` the line box is one em tall, but the FACE   #
   * # is taller — Playfair's ascender plus descender is 1082 + 251 =    #
   * # 1333 units, 1.333em. CSS centres the overflow, so the             #
   * # half-leading is negative and the baseline lands at                #
   * # (1 - 1.333) / 2 + 1.082 = 0.9155em from the top, not at 1.000em.  #
   * #                                                                   #
   * # Positioning by `baseline - fontSize` would put this heading       #
   * # 0.0845em = 18.1px too HIGH. No test in this repo lays out text,   #
   * # so nothing but a render against his frame would catch it.         #
   * #                                                                   #
   * # THIS IS PLAYFAIR'S NUMBER, NOT NOTO SANS'S 0.888 in              #
   * # `bodyFace.ts`. It is a property of the face's own vertical        #
   * # metrics. The face sets `USE_TYPO_METRICS`, and its typo and hhea  #
   * # pairs are identical (1082 / -251), so every engine agrees.        #
   * ####################################################################
   */
  baselineOverEm: 0.9155,

  /** One em per line. The device is one line; see the box on `ChapterPlate`. */
  lineHeight: 1,

  /*
   * THE FADE USED TO LIVE HERE AND IT IS NOW ON `CHAPTER_PLATE_GROUP`.
   *
   * ####################################################################
   * # IT WAS NEVER THE HEADING'S OWN FADE. HIS RULE FADES UP TOO, ON   #
   * # the SAME straight line, so the fade is a property of the GROUP   #
   * # and belongs with the scale that the group already carries. See   #
   * # `CHAPTER_PLATE_GROUP.fadeEndFrame` and the box above it.         #
   * #                                                                   #
   * # Left as a signpost rather than deleted, because two files and    #
   * # two test files looked for the fade on `CHAPTER_PLATE_TYPE` for   #
   * # a day and a half, and a reader who remembers that should land    #
   * # on the reason rather than on an absence.                          #
   * ####################################################################
   */
} as const

/**
 * The ochre rule directly under the heading.
 *
 * It is NOT copy and it is never a prop: a fixed bar of a fixed width, the same
 * in both of his samples whatever the heading above it says.
 */
export const CHAPTER_PLATE_RULE = {
  /** Solid ochre. Sampled off his clip, and it is flat — no gradient, no fade. */
  colour: '#B77935',

  /** y 610..646 inclusive is 37 rows. */
  heightPx: 37,

  /**
   * x 102..1817 inclusive is 1716 columns.
   *
   * ####################################################################
   * # FIXED, WHERE HIS TRACKS THE HEADING, AND THE SHRINK MADE THIS    #
   * # BETTER RATHER THAN WORSE. EXAMINED ON 2026-09-16 AND LEFT ALONE  #
   * # DELIBERATELY.                                                     #
   * #                                                                   #
   * # HIS BAR IS NOT A CONSTANT. On his two samples it hugs the ink of  #
   * # the heading above it:                                             #
   * #                                                                   #
   * #   sample 1   ink 1478 px   bar 1492 px    about 8 px each side    #
   * #   sample 2   ink 1714 px   bar 1715 px    under 1 px each side    #
   * #                                                                   #
   * # OURS IS 1716 px WHATEVER THE HEADING SAYS, which was already the  #
   * # case before the heading could shrink and was already recorded as  #
   * # an open question. Measured off `scripts/look-still.ts` PNGs at    #
   * # frame 90, over the same photograph, with the bar at x 102..1817:  #
   * #                                                                   #
   * #                             heading ink   overhang each side      #
   * #   "Three Great Ages"        230..1687     128 px and 130 px       #
   * #   "The Sealed Chamber"      127..1797      25 px and  20 px       #
   * #   "Looking for someone"     122..1797      20 px and  20 px       #
   * #   "THE WHOLE WORLD OVER"    124..1797      22 px and  20 px       #
   * #                                                                   #
   * # SO THE MISMATCH IS ON SHORT HEADINGS, NOT ON SHRUNK ONES. Every   #
   * # heading that shrinks fills the measure by construction, so its    #
   * # bar overhangs by about 20 px a side, which is close to his 8 and  #
   * # nothing like the 128 a short heading gives. The shrink moves this #
   * # device TOWARDS his design.                                        #
   * #                                                                   #
   * # WHY IT IS NOT MADE TO TRACK, three reasons in order of weight:    #
   * #                                                                   #
   * #   1. IT WOULD NEED INK WIDTHS AND WE HAVE ADVANCE WIDTHS. An      #
   * #      advance box is wider than its ink by both side bearings, and #
   * #      by a DIFFERENT amount per heading: 30 px on "Three Great     #
   * #      Ages" and 53 px on the shrunk lines above. A bar drawn to    #
   * #      the advance box would overhang the ink unevenly, which is    #
   * #      the defect it was meant to fix.                              #
   * #   2. IT WOULD CHANGE A DELIVERED FRAME. Beat 146 of job c75d51e6  #
   * #      draws "The one-way divide" at full size, and the client has  #
   * #      seen that film. A bar that suddenly shortened by 250 px is a #
   * #      visible change nobody asked for, made on the same day he     #
   * #      signed off two of the four overlays.                         #
   * #   3. EVERY TIMING IN THIS FILE WAS FITTED AGAINST THE BAR'S FOUR  #
   * #      EDGES over every frame of both clips. The wipe origin, the   #
   * #      group scale and the group fade all rest on those edges, and  #
   * #      a width that moves per heading would have to be re-fitted    #
   * #      rather than re-typed.                                        #
   * #                                                                   #
   * # RECORDED AS AN OPEN QUESTION, NOT AS A DECISION THAT IT SHOULD    #
   * # STAY FIXED FOREVER. The measurement to take is the ink width of   #
   * # each of his two samples against each of his two bars, from his    #
   * # own clip, which is the only thing that would say whether his bar  #
   * # is `ink + 14` or `ink * 1.01` or something else entirely. Two     #
   * # points do not choose between those.                               #
   * ####################################################################
   */
  widthPx: 1716,

  /**
   * Its left edge, measured. 102 is also `(FRAME_WIDTH - 1716) / 2`, so the bar
   * is centred on the frame to the pixel, and the mount test pins that equality
   * rather than letting the two drift apart.
   */
  leftPx: 102,

  /**
   * How far the top of the bar sits under the heading's BASELINE.
   *
   * ####################################################################
   * # 16, AND IT WAS 10 FOR AS LONG AS THE CAP HEIGHT WAS WRONG.       #
   * #                                                                   #
   * # 10 was derived as `610 - 600`, where 610 is his MEASURED bar top  #
   * # and 600 was the baseline computed from the wrong cap height. The  #
   * # bar top never depended on the cap height — it was read straight   #
   * # off his frame — so when the baseline was corrected to 594 the     #
   * # gap had to move with it, and it did not. The bar was drawing 6px  #
   * # high.                                                             #
   * #                                                                   #
   * # 610 - 594 = 16. Both halves are measurements off his own clip:    #
   * # the bar top from the colour run at y 610..646 on sample 2, whose  #
   * # blue-sky background separates cleanly from the ochre, and the     #
   * # baseline from the row-wise ink profile in `CHAPTER_PLATE_TYPE`.    #
   * #                                                                   #
   * # THE LESSON IS ABOUT DERIVED CONSTANTS, NOT ABOUT THIS BAR. A      #
   * # number written as arithmetic over two others inherits both of     #
   * # their errors and shows neither. Expressed against the baseline is #
   * # still right — changing the type size must not leave the bar       #
   * # behind — but the value had to be RE-DERIVED when the baseline     #
   * # moved, and nothing made that happen automatically.                #
   * ####################################################################
   */
  gapBelowBaselinePx: 16,

  /**
   * The wipe: `scaleX` 0 -> 1 about the bar's OWN LEFT EDGE. Zero, not 13%.
   *
   * ####################################################################
   * # BOTH OLD READINGS WERE THE GROUP SCALE IN DISGUISE, AND SETTLING #
   * # BETWEEN THEM WAS SETTLING THE WRONG ARGUMENT.                    #
   * #                                                                   #
   * # Reading A took the fixed point at x 327 and got 0.13112. Reading  #
   * # B solved two edges on one frame and got 0.14488. The left edge    #
   * # really does travel 225px on sample one, so both had something to  #
   * # explain — but it is not the wipe that moves it. It is the GROUP   #
   * # SCALE, which is running underneath at the same time and drags     #
   * # the whole bar leftward as it grows.                               #
   * #                                                                   #
   * # Take the scale out and the wipe origin falls out flat. With the   #
   * # group scale S(t) read off the bar's own left edge, the frame-space#
   * # left edge of a `scaleX(s)` about a fraction p is                  #
   * #                                                                   #
   * #   left = C + S * (BL + p*BW*(1 - s) - C)                          #
   * #                                                                   #
   * # and solving that for p across the whole build gives, on sample    #
   * # one, p = -0.0004 at frame 10, 0.0024 at 20, -0.0012 at 30; on     #
   * # sample two, p = -0.003 at frame 10. ZERO, on both clips, at every #
   * # frame. The bar grows rightward out of a pinned left end.          #
   * #                                                                   #
   * # THE LESSON IS THE ONE THE LEAD-IN TAUGHT AGAIN. Two motions ran   #
   * # at once, only one was modelled, and the other one's travel was    #
   * # attributed to it as a 13% origin that never existed.              #
   * ####################################################################
   */
  originFraction: 0,

  /**
   * The wipe runs from the SHOT'S FIRST FRAME and is full at 1.20s.
   *
   * ####################################################################
   * # IT STARTS ON FRAME 0, AND 0.58s WAS NEVER A RULE TIMING.         #
   * #                                                                   #
   * # 0.58s is sample one's black lead-in, to three decimal places, so  #
   * # what the spec recorded as "rule appears" is the moment the        #
   * # PHOTOGRAPH appears. The bar is under way from that same frame.    #
   * #                                                                   #
   * # Nobody saw it because it is thin, soft-edged, laid over a         #
   * # photograph AND still fading up. Its absence was read as a delay.  #
   * #                                                                   #
   * # END: 1.2000s and 1.2004s, one per clip, each from a whole-model   #
   * # least squares over the bar's FOUR EDGES at every frame with the   #
   * # group scale inside the model rather than divided out of the data. #
   * # 1.20s is taken. It is 36 film frames EXACTLY, and 72 of his clip  #
   * # frames, which is why the two clips agree to 0.03 of a clip frame. #
   * #                                                                   #
   * # 1.18s WAS THE SECOND-BLACK ERROR AND NOTHING ELSE, which makes    #
   * # this the cleanest of the six corrections. It was the mean of      #
   * # 1.2017s and 1.1532s. The 1.2017 came off "Three Great Ages",      #
   * # which has no second black, and it was right all along. The        #
   * # 1.1532 came off "The Elder Earth Passage" measured from its       #
   * # picture cut instead of its shot start, and 34.6 frames is exactly #
   * # what a straight line through the origin returns when the data is  #
   * # really `(t + 1) / 36`. See the arithmetic in the file header.     #
   * ####################################################################
   */
  wipeStartFrame: 0,
  wipeEndFrame: 1.2 * CHAPTER_PLATE_FILM_FPS,
} as const

/**
 * THE GROUP. His heading and his rule are ONE thing: it grows, AND IT FADES.
 *
 * ####################################################################
 * # THIS IS THE BIG ONE, AND IT WAS MISSING ENTIRELY UNTIL 2026-09-16.#
 * #                                                                   #
 * # The device was built as two boxes frozen at final size with only  #
 * # an opacity and a wipe on them. His is a single group that starts  #
 * # at about three quarters size and grows into place over two and a  #
 * # half seconds, and the growth is what the frame actually reads as. #
 * #                                                                   #
 * # MEASURED TWO WAYS THAT CANNOT SHARE AN ERROR:                     #
 * #                                                                   #
 * #   by the heading ink box width, which needs the fade to be full   #
 * #   by the bar's own left edge, which does not care about opacity   #
 * #                                                                   #
 * # They agree to within 0.004 of each other at every frame of both   #
 * # clips. That agreement is what says it is a scale on a GROUP and   #
 * # not two separate motions that happen to look alike.               #
 * #                                                                   #
 * # THE FIT, cubic ease out, over the bar's four edges at every frame #
 * # of both clips, from each SHOT'S OWN FIRST FRAME:                  #
 * #                                                                   #
 * #                       start scale   duration    whole-model rms   #
 * #   Elder Earth           0.7636       2.499s      0.224 px         #
 * #   Three Great Ages      0.7643       2.487s      0.258 px         #
 * #   taken                 0.765        2.50s                        #
 * #                                                                   #
 * # 2.475s and 0.766 were this same set read with "The Elder Earth    #
 * # Passage" one film frame short; see the file header. The start     #
 * # scale barely moved, because a scale read at the START is the one  #
 * # quantity a time offset hardly touches. 0.766 against 0.765 is     #
 * # inside the noise either way, and it is corrected anyway so that   #
 * # this file and the fit carry ONE set of numbers rather than two    #
 * # that nearly agree.                                                #
 * #                                                                   #
 * # The exponent was fitted free as well and came back 3.15 on BOTH   #
 * # clips, against 3.00 fixed costing nothing in residual, so cubic   #
 * # is the honest reading. A quadratic is four times worse (rms       #
 * # 0.0020) and a quartic is twice (0.0010), so the shape is pinned   #
 * # even though the exact exponent is not.                            #
 * ####################################################################
 */
export const CHAPTER_PLATE_GROUP = {
  /**
   * Where the group starts, as a fraction of its settled size.
   *
   * 0.765, the mean of 0.7636 and 0.7643. NOT the 0.78 the first look
   * reported: that reading came off the heading ink box on the clip's earliest
   * frames, where the fade is at a quarter and the faint outer edges of the
   * line do not register, so the box reads SMALLER than it is and the scale
   * derived from it reads LARGER.
   */
  startScale: 0.765,

  /** It begins on the shot's first frame, with the fade and the wipe. */
  scaleStartFrame: 0,

  /**
   * 2.50s, which is 75 film frames.
   *
   * ####################################################################
   * # THIS IS THE NUMBER THAT PUTS `buildEndFrames` IN QUESTION.       #
   * #                                                                   #
   * # `DEVICE_REGISTRY` gives `chapter-plate` a `buildEndFrames` of 50, #
   * # built off the old 1.65s wipe end. The wipe now ends at 36, which  #
   * # is EARLIER, but the group scale does not settle until 75, so on a #
   * # 50-frame shot the plate would still be visibly growing when the   #
   * # shot cuts.                                                        #
   * #                                                                   #
   * # That file is not this agent's to change and the trade is real:   #
   * # the gate refuses any shot shorter than `buildEndFrames`, so      #
   * # raising it makes the device harder to place in the same week the #
   * # client asked for it in more spots. It is written up rather than  #
   * # decided here.                                                    #
   * ####################################################################
   *
   * ####################################################################
   * # 2.475 -> 2.50 IS THE ONE CORRECTION NO SINGLE FRAME CAN SHOW, so #
   * # do not go looking for the frame that proves it. Across the range #
   * # the clips cover, the two durations differ by less than a         #
   * # thousandth of a scale unit at every frame, which is under the    #
   * # per-frame measurement noise. What separates them is the whole    #
   * # curve: least squares returns 150.0 and 149.2 of his clip frames, #
   * # which is 75.0 and 74.6 film frames. 75 is the nearest whole      #
   * # frame to both of those. 74.25 is nearest to neither.             #
   * ####################################################################
   */
  scaleEndFrame: 2.5 * CHAPTER_PLATE_FILM_FPS,

  /**
   * THE GROUP FADES UP AS ONE, AND IT IS FULL AT 0.39s.
   *
   * ####################################################################
   * # THE HEADLINE CORRECTION OF 2026-09-16, AND THE ONE THE CLIENT    #
   * # WOULD HAVE SEEN. HIS RULE FADES IN. OURS DID NOT.                #
   * #                                                                   #
   * # The fade used to be an `opacity` on the heading's own span, and   #
   * # nothing at all on the rule. With `wipeStartFrame` at 0 that puts  #
   * # a hard-edged, FULLY OPAQUE ochre block on the frame at film       #
   * # frame 1, about 48px of it, under a heading that is barely there.  #
   * # His clips do not do that.                                         #
   * #                                                                   #
   * # Recover the rule's own alpha by linear unmixing against the       #
   * # picture-cut frame and it is 0.177 and 0.109 on its first visible  #
   * # frame in the two clips, and it climbs the same straight line the  #
   * # heading climbs. So the fade covers BOTH, which is to say it is    #
   * # on the group, next to the scale, which is where it now lives.     #
   * ####################################################################
   *
   * ####################################################################
   * # 0.39s, AND IT WAS 0.35s. TWO SEPARATE ERRORS MADE THAT 0.35, AND #
   * # ONLY ONE OF THEM IS THE SECOND-BLACK OFFSET. Spelled out because #
   * # the comment that stood here was confident about a single cause.  #
   * #                                                                   #
   * # ERROR ONE, THE OFFSET. "The Elder Earth Passage" was read a film #
   * # frame short, so its 0.3439s is roughly what a line through the   #
   * # origin returns from data that is really `(t + 1) / 11.7`.        #
   * #                                                                   #
   * # ERROR TWO, THE ESTIMATOR, and this one is on BOTH clips. The     #
   * # fade was read as ink MASS over the heading rows. "Three Great    #
   * # Ages" has no second black and still came back 0.3510s. The       #
   * # reason is that the group is growing underneath: as it grows,     #
   * # more pixels sit deep inside a stroke rather than on its          #
   * # antialiased edge, so an ink-mass or percentile reading climbs on #
   * # its own and the fade reads FAST. Re-read the heading on the same #
   * # clips today, with the offset corrected, and it still gives only  #
   * # 10.7 and 11.1 film frames.                                       #
   * #                                                                   #
   * # THE FIX IS THE RULE, NOT A BETTER HEADING READING. The rule is   #
   * # one flat colour over a known backdrop, so unmixing it is exact   #
   * # and its alpha needs no estimator at all: read the plateau over   #
   * # the bar's own interior. That gives 0.3946s and 0.3940s, the two  #
   * # clips agreeing to a fifth of a film frame.                       #
   * #                                                                   #
   * # AND A BRACKET WITH NO FIT IN IT, which is what actually settles  #
   * # the argument. The rule's alpha reaches its plateau between shot  #
   * # film frame 11 and 12 on BOTH clips:                              #
   * #                                                                   #
   * #     film frame        10       11       12                       #
   * #     Elder Earth      0.838    0.937    1.015  (plateau)          #
   * #     Three Ages       0.847    0.924    1.027  (plateau)          #
   * #                                                                   #
   * # 11.7 is inside that bracket. 10.5 is not: at film frame 10.5 the #
   * # old clock was already full while both of his clips still read    #
   * # about 0.88 and were still climbing.                              #
   * ####################################################################
   */
  fadeStartFrame: 0,
  fadeEndFrame: 0.39 * CHAPTER_PLATE_FILM_FPS,
} as const

/**
 * The heading's SETTLED font size, derived from the measured cap height.
 *
 * 132 / 0.708 = 186.44px. Never typed. It read 152 / 0.708 = 214.69 here for two
 * days after `capHeightPx` was corrected, which is the same not-following-through
 * the box on `gapBelowBaselinePx` is about.
 *
 * THE SIZE A GIVEN HEADING IS ACTUALLY DRAWN AT IS THIS OR SMALLER. See
 * `chapterPlateHeadingFontSizePx` below, and the client's ruling of 2026-09-16.
 */
export const CHAPTER_PLATE_HEADING_FONT_SIZE_PX =
  CHAPTER_PLATE_TYPE.capHeightPx / CHAPTER_PLATE_TYPE.capOverEm

/* -------------------------------------------- the shrink, and its floor -- */

/**
 * ##########################################################################
 * # HIS RULING OF 2026-09-16, VERBATIM: "Shrink long titles to fit. I      #
 * # would say maximum 25 character titles might be good limit."            #
 * #                                                                        #
 * # Until that day a heading too wide for the title-safe box was REFUSED   #
 * # by `packages/core/src/chapterPlateFit.ts` and never reached this file. #
 * # Now it reaches it and is set smaller.                                  #
 * #                                                                        #
 * # ####################################################################   #
 * # # WHY THE ADVANCE TABLE IS DUPLICATED HERE. READ BEFORE DELETING.  #   #
 * # #                                                                  #   #
 * # # `chapterPlateFit.ts` in `packages/core` carries the same numbers  #   #
 * # # and has since the device was built. It cannot be imported from    #   #
 * # # here: it is barrel-only by design, it imports `./schemas.js`, and #   #
 * # # zod does not belong in a Remotion bundle. `packages/core` cannot  #   #
 * # # import `apps/web` either. And nothing carries a size between the  #   #
 * # # two — `DeviceSchema`'s chapter-plate arm is `{ id, heading }`,    #   #
 * # # and widening it would change `renderKey` for every chapter plate  #   #
 * # # in a film that has already shipped.                                #   #
 * # #                                                                  #   #
 * # # So the widths have to exist on BOTH sides, because core decides   #   #
 * # # whether a heading may be drawn and this file decides how big to   #   #
 * # # draw it, and if they disagree by so much as a float the heading   #   #
 * # # lands over the title-safe edge at exit 0 with nothing red.        #   #
 * # #                                                                  #   #
 * # # `apps/web/src/lib/chapterPlateMirror.test.ts` is the ONE file     #   #
 * # # allowed to import both sides. It pins this table against the      #   #
 * # # shipped woff2 bytes, against core's copy character for character, #   #
 * # # and the two size functions against each other with `toBe`.        #   #
 * # ####################################################################   #
 * ##########################################################################
 *
 * Playfair Display's advance for each character a heading may hold, in
 * thousandths of an em (`unitsPerEm` 1000), AT THE 700 INSTANCE — which is the
 * instance `fonts.ts` registers and `CHAPTER_PLATE_TYPE.fontWeight` asks for.
 *
 * Read off the bytes by `tmp/v53/overlays/fit/extract-playfair-700.mjs`, which
 * walks the `HVAR` item variation store. NEVER typed from a specimen, and never
 * read from `hmtx` alone: `hmtx` holds the wght 400 default, and on the capitals
 * the 700 delta runs to +63 units, 13.5px a character at this size.
 */
export const CHAPTER_PLATE_ADVANCE: Readonly<Record<string, number>> = {
  ' ': 233, '!': 288, '"': 369, '#': 620, $: 574, '%': 728, '&': 898, "'": 209, '(': 318, ')': 318, '*': 481, '+': 574,
  ',': 271, '-': 481, '.': 270, '/': 368,
  '0': 645, '1': 383, '2': 523, '3': 488, '4': 528, '5': 459, '6': 561, '7': 455, '8': 561, '9': 553,
  ':': 290, ';': 296, '<': 602, '=': 635, '>': 602, '?': 508, '@': 884,
  A: 667, B: 672, C: 705, D: 776, E: 634, F: 592, G: 735, H: 800, I: 376, J: 364, K: 714, L: 611, M: 927,
  N: 722, O: 793, P: 641, Q: 793, R: 692, S: 584, T: 668, U: 689, V: 668, W: 968, X: 691, Y: 623, Z: 602,
  '[': 322, '\\': 368, ']': 322, '^': 529, _: 608, '`': 296,
  a: 518, b: 586, c: 496, d: 598, e: 504, f: 352, g: 553, h: 608, i: 315, j: 297, k: 585, l: 311, m: 905,
  n: 614, o: 565, p: 600, q: 585, r: 467, s: 462, t: 352, u: 606, v: 508, w: 787, x: 536, y: 519, z: 474,
  '{': 333, '|': 253, '}': 333, '~': 668,
  '‘': 258, '’': 253, '“': 464, '”': 459, '–': 602, '—': 895, '…': 830,
  À: 667, Á: 667, Â: 667, Ã: 667, Ä: 667, Å: 667, Æ: 889, Ç: 705, È: 634, É: 634, Ê: 634, Ë: 634,
  Ì: 376, Í: 376, Î: 376, Ï: 376, Ð: 776, Ñ: 722, Ò: 793, Ó: 793, Ô: 793, Õ: 793, Ö: 793, Ø: 793,
  Ù: 689, Ú: 689, Û: 689, Ü: 689, Ý: 623, Þ: 621,
  ß: 657, à: 518, á: 518, â: 518, ã: 518, ä: 518, å: 518, æ: 741, ç: 496, è: 504, é: 504, ê: 504,
  ë: 504, ì: 315, í: 315, î: 315, ï: 315, ð: 567, ñ: 614, ò: 565, ó: 565, ô: 565, õ: 565, ö: 565,
  ø: 565, ù: 606, ú: 606, û: 606, ü: 606, ý: 519, þ: 584, ÿ: 519,
  Œ: 995, œ: 814,
}

/**
 * The widest advance in the table, `Œ` at 0.995 em.
 *
 * It is what an UNMEASURED character costs in `chapterPlateHeadingWidthPx`.
 * Derived, so it cannot drift from the table it is the maximum of.
 */
const CHAPTER_PLATE_WIDEST_ADVANCE = Math.max(...Object.values(CHAPTER_PLATE_ADVANCE))

/**
 * The title-safe measure, 1728px, derived rather than typed.
 *
 * `FRAME_WIDTH - 2 * SAFE_AREA_X`, and both halves are written out here because
 * this file imports nothing at all, by design — see its header. The mirror test
 * pins these against `constants.ts`'s own values rather than trusting them.
 */
export const CHAPTER_PLATE_MEASURE_PX = 1920 - 2 * 96

/**
 * THE SMALLEST CAP HEIGHT THIS DEVICE MAY BE DRAWN AT AND STILL BE THIS DEVICE.
 *
 * 90px, against the 132px a settled heading draws at. The whole argument for
 * the number — his own sample 2 at a 108.9px cap, all 4,452 whole-word runs of
 * this film's script up to 25 characters clearing it, and the film's 37px
 * caption cap underneath it — is written out on
 * `CHAPTER_PLATE_MIN_CAP_HEIGHT_PX` in `packages/core/src/chapterPlateFit.ts`,
 * which is the side that does the refusing. Mirrored here because this side
 * does the drawing, and pinned equal by `chapterPlateMirror.test.ts`.
 */
export const CHAPTER_PLATE_MIN_CAP_HEIGHT_PX = 90

/** The floor as a font size: 90 / 0.708 = 127.12px. Derived, never typed. */
export const CHAPTER_PLATE_MIN_HEADING_FONT_SIZE_PX =
  CHAPTER_PLATE_MIN_CAP_HEIGHT_PX / CHAPTER_PLATE_TYPE.capOverEm

/**
 * How wide the heading's one line draws at the SETTLED size, in screen pixels.
 *
 * ##########################################################################
 * # TOTAL, WHERE CORE'S IS PARTIAL, AND THAT IS THE ONE DELIBERATE         #
 * # DIFFERENCE BETWEEN THE TWO SIDES.                                      #
 * #                                                                        #
 * # `chapterPlateHeadingWidth` in core returns null for a character the    #
 * # table does not name, and the chooser turns that into a refusal. This   #
 * # side has no refusal available: by the time a heading is here it is in  #
 * # the plan and something must be drawn. So an unnamed character is       #
 * # charged the WIDEST advance in the table. That over-predicts, which     #
 * # makes the heading smaller rather than wider, which is the safe         #
 * # direction — the failure this whole mechanism exists to prevent is type #
 * # running off the frame edge.                                            #
 * #                                                                        #
 * # IT IS UNREACHABLE THROUGH THE CHOOSER and is here so the function is   #
 * # total. An operator placement is the path that could reach it.          #
 * #                                                                        #
 * # WHITESPACE IS FOLDED THE WAY `white-space: nowrap` FOLDS IT: runs of   #
 * # it collapse to one space and the leading and trailing ones are         #
 * # dropped, exactly as `normal` does. Same as core's `wordsOf`.           #
 * #                                                                        #
 * # NO LETTER-SPACING TERM. This device sets none, `CHAPTER_PLATE_TYPE`    #
 * # declares none, and the mirror test reads this file's source to check   #
 * # that no `letterSpacing` ever appears. The day it gains tracking this   #
 * # sum gains it too, AFTER EVERY CHARACTER INCLUDING THE LAST, which is   #
 * # how Chrome puts it in the line box.                                    #
 * ##########################################################################
 */
export function chapterPlateHeadingWidthPx(heading: string): number {
  const folded = heading.trim().split(/\s+/).filter((word) => word.length > 0).join(' ')
  let thousandths = 0
  for (const character of folded) {
    thousandths += CHAPTER_PLATE_ADVANCE[character] ?? CHAPTER_PLATE_WIDEST_ADVANCE
  }
  return (thousandths / 1000) * CHAPTER_PLATE_HEADING_FONT_SIZE_PX
}

/**
 * THE SIZE THIS HEADING IS DRAWN AT: the settled size, or the largest that
 * lands inside the 1728px title-safe box, whichever is smaller.
 *
 * ##########################################################################
 * # THE EXPRESSION IS `(size * measure) / width` AND THE ORDER MATTERS.     #
 * # `chapterPlateHeadingFontSizePx` in `packages/core/src/chapterPlateFit. #
 * # ts` is written character for character the same, and                    #
 * # `chapterPlateMirror.test.ts` pins the two with `toBe` rather than       #
 * # `toBeCloseTo`. `size * (measure / width)` is a DIFFERENT number in      #
 * # IEEE 754 and would make the two sides disagree in the last bit. Do not  #
 * # "simplify" it.                                                          #
 * #                                                                        #
 * # A HEADING THAT ALREADY FITS RETURNS THE SETTLED SIZE EXACTLY, by the    #
 * # early return rather than by multiplying and dividing back to it. Every  #
 * # chapter plate this project has rendered so far takes that branch, so    #
 * # no delivered frame moves by a rounding.                                 #
 * #                                                                        #
 * # NO FLOOR IS APPLIED HERE, AND THAT IS NOT AN OVERSIGHT. The floor is a  #
 * # REFUSAL, and refusing is core's job: a heading below it never reaches   #
 * # the plan. Clamping here instead would draw an over-wide heading at the  #
 * # floor size and let it run off the frame, which is the failure this      #
 * # mechanism exists to prevent. `chapterPlateMirror.test.ts` pins that     #
 * # everything core admits is drawn at or above the floor.                  #
 * ##########################################################################
 */
export function chapterPlateHeadingFontSizePx(heading: string): number {
  const width = chapterPlateHeadingWidthPx(heading)
  if (width <= 0) return CHAPTER_PLATE_HEADING_FONT_SIZE_PX
  if (width <= CHAPTER_PLATE_MEASURE_PX) return CHAPTER_PLATE_HEADING_FONT_SIZE_PX
  return (CHAPTER_PLATE_HEADING_FONT_SIZE_PX * CHAPTER_PLATE_MEASURE_PX) / width
}

/**
 * The top of the heading's line box AT A GIVEN SIZE, so that its BASELINE
 * lands on 594 whatever the heading is set at.
 *
 * ##########################################################################
 * # IT TAKES THE SIZE BECAUSE THE SIZE MOVES NOW. It was a constant until   #
 * # 2026-09-16, when the heading gained its shrink. A shrunk heading laid   #
 * # out at the OLD constant top would sit about 15px low and close the      #
 * # 16px gap to the ochre rule.                                             #
 * #                                                                        #
 * # THE BASELINE IS WHAT IS HELD FIXED, and holding it is what keeps the    #
 * # rule where it was measured: `CHAPTER_PLATE_RULE_TOP_PX` is the baseline #
 * # plus `gapBelowBaselinePx`, and his bar is at y 610..646 on BOTH of his  #
 * # samples — the long one and the short one — so his bar does not move     #
 * # when his heading shrinks, and neither does ours.                        #
 * #                                                                        #
 * # ####################################################################   #
 * # # A KNOWN DISAGREEMENT WITH HIS SAMPLE 2, RECORDED RATHER THAN     #   #
 * # # TUNED AWAY, BECAUSE IT IS A FIT TO ONE FRAME.                    #   #
 * # #                                                                  #   #
 * # # His shrunk heading does not appear to be baseline-locked. Take    #   #
 * # # his sample 1 ink box, y 448..628 with the baseline at 594, as     #   #
 * # # the calibration: the ascender sits 0.7831em over the baseline and #   #
 * # # the descender 0.1824em under it. Apply those to sample 2, whose   #   #
 * # # ink box is y 458..607 at 0.8253 of the size:                      #   #
 * # #                                                                  #   #
 * # #   predicted ink height  148.6px     measured  149px               #   #
 * # #   implied baseline      about 578.7            not 594            #   #
 * # #                                                                  #   #
 * # # The height agreeing to 0.4px is independent corroboration of the  #   #
 * # # 0.8253 shrink. The baseline is another matter: his shrunk heading #   #
 * # # sits about 15px HIGHER than ours would, which puts about 31px of  #   #
 * # # air over his bar where ours leaves 16px. The best-fitting simple  #   #
 * # # rule is that his LINE BOX CENTRE is what stays fixed — 516.5 on   #   #
 * # # sample 1 against 514.8 on sample 2, agreeing to 1.7px, where      #   #
 * # # baseline-locked is out by 15.3px.                                 #   #
 * # #                                                                  #   #
 * # # NOT ADOPTED, ON PURPOSE. Both em fractions above are derived from #   #
 * # # ONE thresholded ink box on a 60fps h264 clip, and this file's own #   #
 * # # history is two corrections that each came from trusting a         #   #
 * # # derivation over a measurement. Baseline-locked keeps the bar 16px #   #
 * # # under the words at every size, which is the relationship          #   #
 * # # `gapBelowBaselinePx` was written to protect. The disagreement is  #   #
 * # # an OPEN QUESTION for the next person with his clip and a row-wise #   #
 * # # ink profile, not a number to fit here.                            #   #
 * # ####################################################################   #
 * ##########################################################################
 *
 * See the box on `baselineOverEm`: this is not `baseline - fontSize`, and the
 * difference is 18px of ink in the wrong place.
 */
export function chapterPlateHeadingTopPx(fontSizePx: number): number {
  return CHAPTER_PLATE_TYPE.baselinePx - fontSizePx * CHAPTER_PLATE_TYPE.baselineOverEm
}

/**
 * The top of a SETTLED heading's line box, so that its baseline lands on 594.
 *
 * Kept as a constant because it is the number every mount test and every
 * measurement off his frame is written against, and derived through the
 * function above so the two cannot drift.
 */
export const CHAPTER_PLATE_HEADING_TOP_PX = chapterPlateHeadingTopPx(
  CHAPTER_PLATE_HEADING_FONT_SIZE_PX,
)

/**
 * THE CAP HEIGHT A HEADING IS REALLY DRAWN AT, from the size it is really set
 * at. 132px settled, down to the 90px floor `CHAPTER_PLATE_MIN_CAP_HEIGHT_PX`
 * holds.
 *
 * ##########################################################################
 * # THE INVERSE OF `CHAPTER_PLATE_HEADING_FONT_SIZE_PX`, AND IT EXISTS      #
 * # BECAUSE TWO SEPARATE READERS NOW NEED THE CAP RATHER THAN THE EM.       #
 * #                                                                        #
 * #   the frame   `chapterPlateTextShadow(capPx)` fits the glyph halo to    #
 * #               the drawn cap, because the heading shrinks to fit and a   #
 * #               blur typed in pixels would be a different fraction of the #
 * #               type on every heading.                                    #
 * #   the gate    `typeGroundRectsFor` sizes its one-letter window and the  #
 * #               rows it charges from the same cap, through                #
 * #               `CHAPTER_PLATE_CAP_OVER_EM_MIRROR`.                       #
 * #                                                                        #
 * # ONE CONVERSION, IN ONE PLACE, so the halo and the number that records   #
 * # what the halo is worth cannot come to mean two different sizes. The     #
 * # gate's copy of `capOverEm` is pinned against this one by                #
 * # `chapterPlateMirror.test.ts`.                                           #
 * ##########################################################################
 */
export function chapterPlateCapHeightPx(fontSizePx: number): number {
  return fontSizePx * CHAPTER_PLATE_TYPE.capOverEm
}

/** The top of the rule: 16px under the heading's baseline, so y 610. */
export const CHAPTER_PLATE_RULE_TOP_PX =
  CHAPTER_PLATE_TYPE.baselinePx + CHAPTER_PLATE_RULE.gapBelowBaselinePx

/**
 * The wipe's `transform-origin`, ready to hand to CSS.
 *
 * Built here rather than in the component, which carries no numbers — not even
 * the 100 that turns a fraction into a percentage. The vertical half is stated
 * for completeness only: `scaleX` alone is indifferent to it.
 */
export const CHAPTER_PLATE_RULE_TRANSFORM_ORIGIN = `${String(
  CHAPTER_PLATE_RULE.originFraction * 100,
)}% 50%`

/**
 * The BOTTOM of the rule, so the group's own box has two ends.
 *
 * Derived, never typed: the rule is `heightPx` tall and its top is already
 * expressed against the heading's baseline, so this moves with the type size
 * the way `CHAPTER_PLATE_RULE_TOP_PX` does.
 */
export const CHAPTER_PLATE_RULE_BOTTOM_PX =
  CHAPTER_PLATE_RULE_TOP_PX + CHAPTER_PLATE_RULE.heightPx

/* ------------------------------------------------------- the ground -- */

/*
 * ##########################################################################
 * # THE BAND'S SIX NUMBERS LIVED HERE AND ARE DELETED, NOT RETUNED.        #
 * #                                                                        #
 * # `CHAPTER_PLATE_WASH_PLATEAU_TOP_PX`, `..._BOTTOM_PX`, `..._FADE_OUT_PX`,#
 * # `..._OVERHANG_PX`, `chapterPlateWashFadeInPx` and                       #
 * # `chapterPlateWashSidePx` described a rectangle this device no longer    #
 * # paints. Since 2026-09-21 the heading carries its ground ON THE GLYPHS,  #
 * # `TOP_TITLE_SHADOW` with three stacked centred glows over it, built by   #
 * # `chapterPlateTextShadow` in `topTitleClock.ts` and fitted to the drawn  #
 * # cap by `chapterPlateCapHeightPx` above.                                 #
 * #                                                                        #
 * # AND A WHOLE CONSTRAINT GOES WITH THEM RATHER THAN MOVING. The band's    #
 * # bottom end was pinned to the ochre rule's top edge because `#B77935` —  #
 * # relative luminance 0.24 — is dragged from 3.32:1 to 1.08:1 by a wash    #
 * # deep enough to rescue the heading. A halo is attached to letters and    #
 * # cannot reach the bar at all, so that argument has nothing left to       #
 * # protect. THE RULE ITSELF IS UNTOUCHED: it is the client's own underline #
 * # and nothing in this change reaches it.                                  #
 * #                                                                        #
 * # WHY A HALO AND NOT A SHALLOWER BAND, ON THE CLIP RATHER THAN ON A       #
 * # STILL. The band is at full depth across the whole width from frame 12,  #
 * # a grey stripe over the census page while the type is still three        #
 * # quarters size and still fading up; the halo is part of the glyph, so it #
 * # arrives with the glyph and scales with the group transform. The         #
 * # blur-over-cap ratio is therefore invariant through the whole build,     #
 * # which is the one thing a rectangle could never be made to do. The       #
 * # numbers are on `CHAPTER_PLATE_HALO_GLOW`.                               #
 * ##########################################################################
 */

/**
 * The point the group grows out of: THE FRAME'S OWN CENTRE, and no number.
 *
 * ####################################################################
 * # IT IS `50% 50%` ON A FULL-FRAME WRAPPER, AND THE DERIVED 535.16px #
 * # THIS REPLACES WAS MEASURABLY WORSE. The derivation is DELETED     #
 * # rather than retuned, because on a wrapper that already fills the  #
 * # frame there is no constant left to get wrong.                     #
 * #                                                                   #
 * # The old derivation took the midpoint of the heading's line box    #
 * # and the rule's bottom, `(423.32 + 647) / 2`, and got 535.16.      #
 * # That is a sensible-looking number and it is not his.              #
 * #                                                                   #
 * # FIT THE ORIGIN FREE against the bar's four edges over every frame #
 * # of both clips and it comes back:                                  #
 * #                                                                   #
 * #                       x        y        whole-model rms           #
 * #   Elder Earth        963.8    538.1      0.213 px                 #
 * #   Three Great Ages   957.7    539.8      0.258 px                 #
 * #                                                                   #
 * # Both land on the FRAME CENTRE, 960 by 540, to within a few        #
 * # pixels, and pinning it there costs essentially nothing:           #
 * #                                                                   #
 * #                       y = 540 (this)   y = 535.16 (the old one)   #
 * #   Elder Earth          rms 0.224        rms 0.247                 #
 * #   Three Great Ages     rms 0.258        rms 0.305                 #
 * #                                                                   #
 * # So 540 is BETTER than 535.16 on both clips, not merely defensible #
 * # — and it is better while carrying no derived constant at all.     #
 * #                                                                   #
 * # WHY THE DERIVATION WAS TEMPTING, so nobody re-derives it. A group #
 * # that grows "out of its own centre" is the natural reading of the  #
 * # motion, and the box it grows out of is only 5px from the frame's  #
 * # middle, so the wrong answer looks right on a still. It is the     #
 * # residual across 100+ frames that tells them apart, and the design #
 * # tool he built this in scales about the composition, not about the #
 * # bounding box of what happens to be inside it.                     #
 * #                                                                   #
 * # THE WRAPPER MUST STAY FULL-FRAME FOR THIS TO MEAN 960 BY 540.     #
 * # It is an `AbsoluteFill` in `ChapterPlate.tsx`, and if that ever   #
 * # becomes a shrink-to-fit box then `50% 50%` silently becomes the   #
 * # box's centre, which is the derived number this deletes.           #
 * ####################################################################
 */
export const CHAPTER_PLATE_GROUP_TRANSFORM_ORIGIN = '50% 50%'

/** Nothing outside [0, 1]: both ramps hold their ends rather than running past. */
function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

/**
 * THE GROUP's opacity at a local frame. A plain linear fade up, over the
 * heading AND the rule together.
 *
 * ####################################################################
 * # IT WAS `chapterPlateHeadingOpacity` AND IT DROVE ONLY THE WORDS. #
 * # RENAMED RATHER THAN REPOINTED, so that a caller cannot put this   #
 * # back on the heading alone and still read as correct.              #
 * #                                                                   #
 * # His rule fades in on the SAME line as his heading — 0.177 and     #
 * # 0.109 recovered alpha on its first visible frame in the two       #
 * # clips, full within 1.5 film frames of the heading. Ours arrived   #
 * # at full opacity on frame 1 as a hard ochre block. The box on      #
 * # `CHAPTER_PLATE_GROUP.fadeEndFrame` has the whole reading.         #
 * #                                                                   #
 * # ONE FADE, ON THE WRAPPER, NOT TWO THAT MULTIPLY. Two nested       #
 * # opacities of 0.5 composite to 0.25, so a leftover `opacity` on    #
 * # the heading span would make the words fade at the SQUARE of this  #
 * # rate while the rule faded at this rate. `ChapterPlate.tsx` sets   #
 * # this in exactly one place; its own box says why.                  #
 * ####################################################################
 *
 * ####################################################################
 * # LINEAR IS A MEASUREMENT, NOT A CONFESSION.                        #
 * #                                                                   #
 * # This comment once said linear was chosen because the spec gave    #
 * # two endpoints and no interior sample. There are ten interior      #
 * # samples per clip now, off the rule's own recovered alpha, and     #
 * # they are a straight line: least squares through the origin fits   #
 * # them at rms 0.014 and 0.005 of an opacity unit.                   #
 * #                                                                   #
 * # THE RULE IS WHAT IS MEASURED, NOT THE HEADING, and that is the    #
 * # 2026-09-16 correction to this reading. The bar is one flat colour #
 * # over a known backdrop, so unmixing its alpha is exact. The        #
 * # heading is antialiased strokes whose opacity has to be inferred   #
 * # from ink mass, and the group growing underneath inflates that     #
 * # reading on its own — which is how the fade came to be written 30% #
 * # too short. See the box on `fadeEndFrame`.                         #
 * ####################################################################
 */
export function chapterPlateGroupOpacity(frame: number): number {
  const { fadeStartFrame, fadeEndFrame } = CHAPTER_PLATE_GROUP
  return clamp01((frame - fadeStartFrame) / (fadeEndFrame - fadeStartFrame))
}

/**
 * The rule's horizontal scale at a local frame, 0 to 1, on a STRAIGHT LINE.
 *
 * ####################################################################
 * # LINEAR, AND IT WAS A CUBIC EASE OUT UNTIL 2026-09-16. THE ONE     #
 * # INTERIOR SAMPLE THAT PICKED THE CUBIC WAS THE GROUP SCALE AGAIN.  #
 * #                                                                   #
 * # The old argument: on the frame the bar is first SEEN it is        #
 * # already 162px wide, 9.4% of final, which a cubic reaches in two   #
 * # of his frames and a straight line does not reach for six. Both    #
 * # halves of that are wrong. The bar is not first seen on frame 0 of #
 * # the device, it is first seen 0.58s in because 0.58s is where the  #
 * # spec's clock started, and by then a straight line from the real   #
 * # frame 0 is well past 9%.                                          #
 * #                                                                   #
 * # Divide the group scale back out of the bar's measured width and   #
 * # the wipe is a ruler. Sample one, film frames 10 through 35:       #
 * #                                                                   #
 * #   .2767 .3047 .3324 .3600 .3880 .4162 .4440 .4715 .4994 .5269     #
 * #   .5549 .5825 .6099 .6384 .6658 .6936 .7210 .7487 .7768 .8051     #
 * #   .8334 .8607 .8879 .9155 .9436 .9716                             #
 * #                                                                   #
 * # Every step is 0.0277 give or take 0.0003. A cubic ease out cannot #
 * # produce a constant step, so the shape is settled by that table    #
 * # alone.                                                            #
 * #                                                                   #
 * # AND THAT TABLE WAS ALWAYS 1/36 PER FRAME, which is worth knowing  #
 * # because it sat in this file under a `wipeEndFrame` of 35.4. Check #
 * # it on the printed numbers: 10/36 is 0.2778 against the .2767 in   #
 * # row one, and 35/36 is 0.9722 against the .9716 in the last. 1/36  #
 * # is 0.02778 and 1/35.4 is 0.02825, and the measured step is        #
 * # 0.0277. This clip never said 35.4. 35.4 was the average of this   #
 * # clip and one read a film frame short; see the file header.        #
 * ####################################################################
 */
export function chapterPlateRuleScaleX(frame: number): number {
  const { wipeStartFrame, wipeEndFrame } = CHAPTER_PLATE_RULE
  return clamp01((frame - wipeStartFrame) / (wipeEndFrame - wipeStartFrame))
}

/**
 * The GROUP's scale at a local frame, on a cubic ease out.
 *
 * ####################################################################
 * # EASED, WHERE THE OTHER TWO ARE LINEAR, AND THAT IS MEASURED TOO. #
 * #                                                                   #
 * # The same de-scaling that flattened the wipe leaves this one       #
 * # curved: the scale gains 0.0065 per frame early and 0.0003 per     #
 * # frame late, a twenty to one slowdown across the build. Fitting    #
 * # the exponent free gives 3.15 on both clips; see the box on        #
 * # `CHAPTER_PLATE_GROUP`.                                            #
 * #                                                                   #
 * # `1 - (1 - p)^3` is the same shape as `easeOut` in `constants.ts`. #
 * # It is written out rather than imported because this file takes no #
 * # imports at all, which is what keeps it in the fast test lane.     #
 * ####################################################################
 */
export function chapterPlateGroupScale(frame: number): number {
  const { startScale, scaleStartFrame, scaleEndFrame } = CHAPTER_PLATE_GROUP
  const progress = clamp01((frame - scaleStartFrame) / (scaleEndFrame - scaleStartFrame))
  return startScale + (1 - startScale) * (1 - Math.pow(1 - progress, 3))
}
