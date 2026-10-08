/**
 * The gallery filmstrip's clock and geometry, as pure functions of one integer.
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
 * WHAT THIS IS. The client's eighth reference animation, at 0:36 of
 * `Templates (Unseperated).mp4`. His own words:
 *
 *   WHAT     a gallery of images that in order
 *   FROM/TO  normal full size screen image then zoom out to showing now the
 *            rest of images in order the zoom out image is at last then
 *            running the images in order to see the first image them zoom in
 *            the image and back to normal full screen image
 *   WHEN     starts at 0:36, 5 seconds
 *   HOW      fast zoom out, slowly showing the images in order come to the
 *            first, then fast zoom in
 *
 * Four photographs in thick yellow mounts, welded into one horizontal strip on
 * the warped grid, each with an orange ordinal chip hanging off its bottom
 * edge. The camera opens hard inside the LAST picture, pulls out to see the
 * whole strip, tracks left to the FIRST picture, and slams back in.
 *
 * ####################################################################
 * # THE THREE THINGS A BUILDER MUST READ FIRST.                       #
 * #                                                                   #
 * # 1. THE FOUR CARDS ARE ONE RIGID STRIP under a single similarity   #
 * #    about the FRAME centre. They are NOT four cards each scaling   #
 * #    about its own centre — that is a4, and here it is wrong by     #
 * #    740px on card 3 at local frame 9.                              #
 * #                                                                   #
 * # 2. CARDS 2 AND 3 CARRY A HARD BLUR that switches ON in ONE frame  #
 * #    at local 32 and OFF in ONE frame at local 103. It is flat      #
 * #    across the card and covers the mount and the chip as well as   #
 * #    the photograph. It is the most visible thing in a8 and the     #
 * #    easiest to miss, because no still frame shows a switch.        #
 * #                                                                   #
 * # 3. THE PHASES OVERLAP. The pan starts at local 30 while the       #
 * #    zoom-out is still running to local 40. Chain them back to back #
 * #    and the whole middle of the clip is a third of a second late.  #
 * ####################################################################
 *
 * ####################################################################
 * # ALMOST NOTHING TRANSFERS FROM THE OTHER THREE GRID ANIMATIONS.    #
 * #                                                                   #
 * #   a9 border   2.2px FIXED      a8 border   50du, SCALES           #
 * #   a4 mount    24px             a8 mount    50du = 20px at k=1     #
 * #   a4 chips    FIXED position   a8 chips    CHILDREN of the strip  #
 * #   a4 chips    white on orange  a8 chips    BLACK on orange        #
 * #   a4 grid     dead at k=1.000  a8 grid     dead at k=1.000  SAME  #
 * #   a3 grid     3.357/0.2538     a8 grid     3.36/0.352 — the       #
 * #                                            stroke matches to 0.4% #
 * #                                            and the OPACITY DOES   #
 * #                                            NOT. a3's row draws    #
 * #                                            every line 26% dim.    #
 * #   a3 vignette scales with grid  a8 vignette screen-fixed          #
 * #   a3 zoom     mirror about its  a8 zooms   NOT mirrors. Reversing #
 * #               own axis                     one onto the other     #
 * #                                            leaves 106px of rms.   #
 * #   a9 curve    damped spring     a8 curves  two custom beziers and #
 * #                                            a Penner ease-in-out.  #
 * #                                                                   #
 * # Every one of those is a measurement, and each of them draws       #
 * # something visibly wrong if another animation's answer is copied.  #
 * ####################################################################
 */

/**
 * THE ORDER IS BACKWARDS TO INTUITION AND THE CLIENT'S OWN WORDS.
 *
 * ####################################################################
 * # THE CAMERA OPENS ON THE LAST PICTURE AND ENDS ON THE FIRST.       #
 * #                                                                   #
 * # He wrote "running the images in order to see the first image".    #
 * # The camera opens hard inside card #4, the RIGHTMOST, travels      #
 * # LEFT through #3 and #2, and lands on card #1. Descending label    #
 * # order. It ends on the FIRST picture.                              #
 * #                                                                   #
 * # Feed the pictures in and drive the camera forward instead and you #
 * # get a mirror of his reference that looks entirely plausible on    #
 * # its own and is wrong in every single frame.                       #
 * #                                                                   #
 * # Identified from CONTENT, not from the description: resampling the #
 * # opening hero against each of the four pictures matched card 4 at  #
 * # mad 8.87 with the next best at 56.2, and the closing hold matched #
 * # card 1 at 1.17 against a next best of 54.4.                       #
 * ####################################################################
 *
 * So `srcs[0]` is card #1, the leftmost, the one the clip ENDS on, and
 * `srcs[3]` is card #4, the one it opens inside.
 */
export const GALLERY_STRIP_CARD_COUNT = 4

export const GALLERY_STRIP = {
  /**
   * 150 frames, 5.000s exactly. His duration is right for the first time in
   * this reel, and his start time is wrong again.
   *
   * Measured cut to cut: source frames 1100 to 1249 inclusive. Both boundaries
   * are hard cuts against the flat separator plate that recurs between every
   * animation in the reel — mad 102.23 into it and 124.34 out of it, where ten
   * consecutive plate frames are BIT-IDENTICAL to one another (maxd 0, every
   * one of 2,073,600 pixels equal). So the noise floor those cuts clear is
   * zero, and they clear it by about five hundred times.
   *
   * ##################################################################
   * # HE SAID "starts at 0:36". IT STARTS AT 36.667s, TWENTY FRAMES   #
   * # LATER. Frame 1080 is still a7's frozen pagoda.                  #
   * #                                                                 #
   * # His "5 seconds" IS EXACT, and that is the trap. It is the only  #
   * # duration in this reel he has got right, which makes it tempting #
   * # to trust the start time sitting beside it. a3's start was       #
   * # 1.0s out and a4's duration was 1.3s out.                        #
   * ##################################################################
   */
  totalFrames: 150,

  /**
   * The last frame that carries new pixels. Frames 131..149 are a FREEZE.
   *
   * Nineteen exact repeats: consecutive mad 0.0001 to 0.0069, maxd 2 to 9,
   * which is this encoder's static-image floor on this material and is the
   * floor every other claim in this file is measured against.
   *
   * ##################################################################
   * # FIT EVERY EASE OVER 131 FRAMES AND THEN HOLD FOR 19. Spreading  #
   * # the move across all 150 makes the whole shot 15% slow and lands #
   * # the final zoom short of the anchor.                             #
   * #                                                                 #
   * # a7 shows the identical freeze-then-cut pattern, so a held tail  #
   * # is this reel's own convention rather than dead air to trim.     #
   * ##################################################################
   */
  moveEndFrame: 130,

  /**
   * The layout, authored in a space where the PHOTOGRAPH is 1920x1080.
   *
   * Every layout quantity lands on a round number in that space, which is what
   * argues it is the author's own space rather than a convenient normalisation.
   * On screen a design length `X` draws at `X * unit * k(frame)`.
   *
   * ##################################################################
   * # `unit` IS A DESIGN INFERENCE, NOT A MEASUREMENT, AND NOTHING    #
   * # RENDERS DIFFERENTLY IF IT IS WRONG.                             #
   * #                                                                 #
   * # What is MEASURED is that the picture draws 768.00 x 432.01      #
   * # screen px at the plateau and that every layout quantity divides #
   * # by 0.4 to an integer. If the author's unit were different, all  #
   * # the design numbers below scale by the same factor and every     #
   * # rendered pixel is identical. The scale-free ratios are the real #
   * # measurement:                                                    #
   * #                                                                 #
   * #   inner aspect              1.77778  +/- 0.0002                 #
   * #   outer aspect              1.71160  +/- 0.0004                 #
   * #   border / picture width    0.026042   (= 1/38.4)               #
   * #   gap   / picture width     0.02090  +/- 0.00022                #
   * #   pitch / outer width       1.01987  +/- 0.00020                #
   * ##################################################################
   */
  unit: 0.4,

  design: {
    /** 16:9 EXACTLY. Measured 1.77775 +/- 0.00008 off the inner mount edges. */
    pictureWidth: 1920,
    pictureHeight: 1080,

    /**
     * The mount, and IT SCALES WITH THE STRIP.
     *
     * Thickness divided by camera scale over k = 1.00 to 2.24: 19.93 (68
     * measurements, sd 0.20), 19.75/20.0 by a second route, 19.79 by a third.
     * Constant. Raw thickness really runs 20.0px at the plateau up to 44.7px
     * at the hero, so a screen-fixed 20px mount is 124% wrong at both ends.
     *
     * DO NOT give cards 2 and 3 a thicker mount. One pass reported them at
     * t/W 0.0259-0.0270 against 0.0244 for cards 1 and 4; that is the blur
     * widening the measurement and a second pass could not reproduce it.
     */
    borderPx: 50,

    /**
     * The card is NOT 16:9. The PICTURE is.
     *
     * 2020 x 1180 is the picture plus two mounts, aspect 1.7119, measured
     * 1.7116 +/- 0.0004. Set a 16:9 card and inset the picture inside it and
     * you get 1820 x 1024 and every downstream number drifts.
     */
    cardWidth: 2020,
    cardHeight: 1180,

    /**
     * Centre to centre. THE GAP IS DERIVED FROM THIS, NEVER MEASURED DIRECTLY.
     *
     * The gap is 16 screen px at the plateau and the blur skirts of the two
     * cards bounding it overlap inside that distance, so any 50%-threshold
     * reading of it is biased large. Take it as pitch minus outer width.
     *
     * ##################################################################
     * # DO NOT USE 820. An earlier pass measured the pitch by          #
     * # thresholding card 2's BLURRED mount and got 822.5 screen px,   #
     * # reported as a 820 pitch with a 12-13px gap. Thresholding a     #
     * # blurred bright bar pulls its outer edge inward.                #
     * #                                                                 #
     * # Four routes on the SHARP cards and on the chip centroids give  #
     * # 824.05 +/- 0.15, 824.10 +/- 0.07, 824.1 and 824.0 +/- 0.4      #
     * # screen px at k = 1, i.e. 2060 design px. A gap 25% too narrow  #
     * # reads as "the gallery is too tightly packed" in every frame.   #
     * ##################################################################
     *
     * The chips are the right landmark for a pitch. They sit in a row below the
     * mounts where nothing else exists, and a blob centroid is unbiased under a
     * symmetric blur, so the neighbour-skirt bias that poisons every yellow-edge
     * reading simply does not arise. The three chip-centroid pitches agree to
     * 0.21px, where the yellow-edge route's three disagreed by 1.6px.
     */
    pitch: 2060,

    /**
     * Round, and genuinely so. A circle fit beats a square corner by 5x to 29x
     * in rms across four scales (0.011-0.094px against 0.275-1.256px), and the
     * estimator's control is the straight part of the same edge in the same
     * frame, which holds to 0.000 +/- 0.005px over 48 rows against a +4.80px
     * corner deviation. Bracket 7 to 9.
     */
    outerCornerRadius: 8,

    /**
     * A BRACKET, NOT A MEASUREMENT, and it is written as one on purpose.
     *
     * The inner corner where the mount meets the photograph is clearly
     * non-zero and no larger than 3.5 design px. The photo content sits
     * directly against it and defeats every edge finder tried in every
     * channel — a circle fit returns rms 7.1px, which is a failed fit.
     *
     * 2 is the middle of the (0, 3.5] bracket. CSS would otherwise give 0
     * here, because a border-box's inner radius is the outer radius minus the
     * border width and 8 - 50 clamps to nothing. At the plateau the whole
     * bracket spans 1.4 screen px, so nothing visible turns on it.
     */
    innerCornerRadius: 2,
  },

  /**
   * The camera, which is entirely `k` and `C`. THERE IS NO VERTICAL MOTION.
   *
   * `C` is the design-space x that sits at the centre of the screen.
   *
   *   s(frame)   = unit * k(frame)
   *   xScreen(u) = 959.5 + s * (u - C)
   *   yScreen(v) = 539.5 + s * v            v measured from the strip's centre line
   *
   * 959.5 and 539.5 are PIXEL-INDEX coordinates — pixel 0's centre is 0.0, so
   * the centre of a 1920x1080 frame is at 959.5, 539.5. Measured card centre y
   * is 539.3 +/- 0.3. It is the frame centre.
   *
   * ##################################################################
   * # DO NOT CENTRE THE CARD-PLUS-CHIP GROUP. a4's cards sit 59px     #
   * # above centre precisely because its chips hang below them. a8's  #
   * # chip hangs below too and the composition still centres the CARD.#
   * # Centre the group instead and the whole strip sits 25 design px  #
   * # too high.                                                       #
   * ##################################################################
   */
  camera: {
    /**
     * The hero scale at BOTH ends, and the loop is closed.
     *
     * Three routes give opening 2.5254 / 2.5258 / 2.5222 and closing 2.5250 /
     * 2.5264 / 2.5233. The two ends agree to within 0.5px on 2040 in every
     * route — but the routes get OPPOSITE SIGNS for that residual, which is
     * the clearest possible statement that the sign is unmeasurable. Built as
     * a perfect loop on purpose.
     *
     * ##################################################################
     * # AT THIS SCALE THE PICTURE OVERFILLS THE FRAME BY 0.96%.        #
     * #                                                                 #
     * # 1938.4 x 1090.4 against 1920 x 1080, so 9.2px of picture is    #
     * # lost off each of left and right and 5.2px off top and bottom.  #
     * # That is WHY no yellow mount is visible at either hero: a strict #
     * # scan finds exactly zero mount-coloured pixels on the opening    #
     * # frame and across all twenty closing frames, while the frames    #
     * # either side of them carry 70,866 and 194,755.                   #
     * #                                                                 #
     * # Snap the hero to exactly 1920x1080 and you draw a hairline of   #
     * # yellow top and bottom where the reference has none.             #
     * ##################################################################
     */
    heroScale: 2.524,

    /**
     * THE ZOOM-OUT AND THE ZOOM-IN ARE NOT MIRRORS OF EACH OTHER.
     *
     * a3's zoom is a mirror and someone nearly built it as two curves. a8 is
     * the opposite mistake waiting to happen. Time-reversing the measured
     * zoom-out onto the measured zoom-in leaves rms 106px and max 198px on a
     * 1232px travel, by two independent routes (106.0/197.3 and 106.7/199.5).
     *
     * They are also different LENGTHS — 40 frames out, 30 frames in.
     *
     * ##################################################################
     * # BOTH ARE CUSTOM BEZIERS ON `k` ITSELF, AND NO NAMED EASING FITS.#
     * #                                                                 #
     * # Five value spaces (g, 1/g, log g, g^0.5, g^-0.5) crossed with   #
     * # 24 named easings were swept. The best NAMED curve is 19x to 33x #
     * # worse than a plain bezier on the linear scale. A critically     #
     * # damped spring — a9's answer — leaves 37.4px rms on the zoom-out #
     * # and cannot produce the dead stop at local 40 at all, because a  #
     * # spring asymptotes.                                              #
     * #                                                                 #
     * # THE FAMILY IS DEGENERATE AT THE MEASUREMENT FLOOR. Three        #
     * # independent fits of each curve all land inside the brackets     #
     * # below and every member renders identically. `zoomIn.y2` is the  #
     * # least constrained parameter in the whole clip — 0.963 to 0.996  #
     * # all fit. THESE ARE THE FIRST NUMBERS TO RE-MEASURE if a render  #
     * # ever disagrees with his frames.                                 #
     * #                                                                 #
     * #   zoom-out   x1 .237-.261  y1 .429-.478                         #
     * #              x2 .437-.456  y2 .936-.944                         #
     * #   zoom-in    x1 .935-.948  y1 .097-.101                         #
     * #              x2 .945-.950  y2 .963-.996                         #
     * ##################################################################
     *
     * SHAPE, which is what actually has to look right. The zoom-out starts at
     * FULL SPEED — 57px of card width on its very first interval, no ease-in
     * and no hold, because source 1099 is the separator plate and the strip is
     * already moving on a8's first frame — and it ends dead. The zoom-in is a
     * strong ease-in that slams into the anchor: it is still doing 123px on
     * its last interval, having peaked near 154.
     */
    zoomOut: {
      startFrame: 0,
      endFrame: 40,
      ease: { x1: 0.2474, y1: 0.4534, x2: 0.447, y2: 0.9396 },
    },
    zoomIn: {
      startFrame: 100,
      endFrame: 130,
      ease: { x1: 0.9415, y1: 0.0991, x2: 0.9479, y2: 0.982 },
    },

    /**
     * The pan, in design px, and it OVERLAPS the zoom-out by ten frames.
     *
     * Travel is 6180 design px, which is exactly three pitches — card 4's
     * centre to card 1's centre. Peak speed at local 65 is 103.5 screen px per
     * frame at the plateau, i.e. 3105 px/s.
     *
     * ##################################################################
     * # THE OVERLAP IS MEASURED, NOT ASSUMED. At local 35 both phases   #
     * # are running: `k` is 1.0338, which is 27px of card width above   #
     * # the plateau and 58x the plateau's own 0.48px noise, and `C` has #
     * # already moved 3.77 screen px, 52x the 0.072px pre-pan floor.    #
     * #                                                                 #
     * # The onset needs no fitting to see. Chip 4's sub-pixel centroid  #
     * # holds at screen x 959.5 +/- 0.3 for every frame from local 14   #
     * # to local 31 while the card's own width falls from 1296 to 875px,#
     * # and then it departs — 0.25, 0.99, 1.56, 3.77, 6.30, 10.05,      #
     * # 14.84, 21.29, 29.13px against a model predicting 0.26, 0.83,    #
     * # 1.94, 3.75, 6.42, 10.12, 15.03, 21.25, 28.98.                   #
     * #                                                                 #
     * # Chain the phases back to back instead and the middle of the     #
     * # clip runs 0.333s late.                                          #
     * ##################################################################
     *
     * The other join is clean rather than overlapped: `C` settles at local 99
     * and the zoom-in opens at local 100, which is the single quietest frame of
     * the clip — whole-frame mad 0.0621 with 95.1% of pixels bit-identical to
     * its predecessor. Nothing at all is moving on it.
     */
    pan: {
      startFrame: 30,
      endFrame: 100,
      /** Card 4's centre: 3 * pitch + cardWidth / 2. */
      centreFrom: 7190,
      /** Card 1's centre: cardWidth / 2. */
      centreTo: 1010,
    },
  },

  /**
   * The blur on the two middle cards, which is the thing a still frame will
   * never tell you and the single most visible element of the animation.
   *
   * ##################################################################
   * # IT IS A SWITCH ON A TIMELINE, NOT A PROPERTY OF TWO ASSETS.     #
   * #                                                                 #
   * #   card 1   sharp always                                         #
   * #   card 2   blurred local 32..102, SHARP local 103..end          #
   * #   card 3   SHARP local 25..31, blurred local 32..71             #
   * #   card 4   sharp always                                         #
   * #                                                                 #
   * # Card 3 enters frame at local 25 and is pixel-sharp for its      #
   * # first seven frames. Card 2 becomes pixel-sharp at local 103     #
   * # while still on screen at nearly the same size. So "cards 2 and  #
   * # 3 are soft assets" is dead: the blur toggles on live content.   #
   * ##################################################################
   *
   * ##################################################################
   * # BOTH SWITCHES ARE ONE-FRAME HARD CUTS. An earlier pass called   #
   * # them three-frame ramps; its own published numbers say otherwise.#
   * #                                                                 #
   * # Card 3's top-edge 10-90 rise: 2.42, 2.42, 2.42 at local 29, 30, #
   * # 31, then 10.52 at local 32. Second-moment sigma on the same     #
   * # edge goes 0.91-1.72 to 4.08-4.19 in that one step.              #
   * #                                                                 #
   * # THE CONTROL IS IN THE SAME FRAME PAIR. Card 4's top edge across #
   * # those very frames reads 2.35 then 0.80 — it goes SHARPER, not   #
   * # softer. One card changes state and a second card in the same    #
   * # encoded frame does not, so it is not the encoder.               #
   * ##################################################################
   *
   * The switches are keyed to neither phase. The pan runs local 30 to 100 and
   * the zooms end at 40 and start at 100; the blur leads the pan by 2 frames
   * and trails its stop by 3. Implemented as literal frame numbers because
   * that is all the evidence supports.
   */
  blur: {
    onFrame: 32,
    offFrame: 103,
    /**
     * 10 design px, i.e. 4.0 screen px at the plateau. Bracket 9.5 to 10.8.
     *
     * Five estimators: 4.10 +/- 0.10, 4.0-4.4, 3.47/4.21, and a median of 3.9
     * from a second-moment route. The sharp cards read <= 0.3 by the same
     * estimators, so the contrast is twelvefold rather than marginal.
     *
     * ##################################################################
     * # IT IS 0.52% OF PICTURE WIDTH, NOT 1.2-1.4%. One pass carried an#
     * # arithmetic slip inside its own report — its pixel figure was   #
     * # right and its percentage was 2.6x too big. Anyone sizing the   #
     * # blur off the percentage blurs the middle cards into mush.      #
     * ##################################################################
     *
     * ##################################################################
     * # THE BLUR IS FLAT ACROSS THE CARD. A RADIAL LAW IS REFUTED.     #
     * #                                                                 #
     * # `sigma = 2.05 + 0.0020 * d` was published and is wrong. Card 3 #
     * # at local 60 straddles the screen centre, d from -330 to +237,  #
     * # and its 10-90 rise reads 9.92, 9.93, 10.04, 9.92, 9.92. Card 2 #
     * # at local 76, d from +141 to +707, reads 9.80 to 9.92. Flat to  #
     * # +/-0.1px from d = 0 out to d = 940, where the published law    #
     * # demands an 87% swing.                                          #
     * #                                                                 #
     * # The falsification control the original claim never had: a      #
     * # SYNTHETIC injection. Convolving the sharp card 1 with the      #
     * # published law and re-running the estimators recovers the       #
     * # injected sigma to +/-0.01 at every distance, so a flat reading #
     * # on the real cards is not the estimator failing to see it.      #
     * ##################################################################
     *
     * Whether the sigma rides the camera or is fixed in screen pixels CANNOT
     * be settled: the blur is only ever on while `k` sits between 1.00 and
     * 1.07, so the two differ by at most 7%, below the per-frame scatter. It
     * scales here, which is consistent with everything else in the strip.
     *
     * The kernel is probably not exactly Gaussian — a 10-90 rise implies sigma
     * 3.86 where a 20-80 rise implies 4.40, which cannot both be true of one —
     * so it has slightly flatter shoulders. A Gaussian beats a triangle by only
     * 10%. If a renderer offers a disc blur instead, radius 15 design px is the
     * matching value.
     */
    sigmaDesignPx: 10,
    /** 0-based. Cards #2 and #3 of #1..#4. */
    blurredCardIndices: [1, 2],
  },

  /**
   * The ordinal chips. CHILDREN of the strip, and they scale with it.
   *
   * ##################################################################
   * # THIS IS THE OPPOSITE OF a4, IN TWO SEPARATE WAYS.               #
   * #                                                                 #
   * # 1. a4's chips sit at a FIXED absolute position and the cards    #
   * #    grow up to them, which is why its gap falls from 237px to 32.#
   * #    a8's chips ride the strip. Fitting chip 4's height over 47   #
   * #    frames spanning a 1.7x zoom: a pure child scores 0.234px and #
   * #    a fixed-screen-pixel chip scores 11.482px, 49x worse. With   #
   * #    no free parameters at all, height/cardWidth reads 0.08271    #
   * #    +/- 0.00030 over 50 frames with no trend, where a fixed chip #
   * #    would drive it from 0.0827 down to 0.0482.                   #
   * #                                                                 #
   * # 2. a4's chips are WHITE ON ORANGE. a8's are BLACK ON ORANGE.    #
   * #    Get that backwards and the chip reads as a different design. #
   * ##################################################################
   */
  chip: {
    /**
     * 171 x 166 design px. THE CHIP IS NOT SQUARE — aspect 1.030.
     *
     * Height bracket 165 to 168; four routes read 66.3, 66.5, 66.79 and 65.82
     * screen px at the plateau and the spread is entirely estimators reading a
     * soft chip top edge against warm picture content.
     */
    width: 171,
    height: 166,

    /**
     * Best fit 2.5, bracket 0 to 6. What the measurement DOES exclude is a
     * pill: r = 15 design px is ruled out. Pinned as a range in the test.
     */
    cornerRadius: 2.5,

    /**
     * ANCHORED TO THE CARD'S OUTER BOTTOM EDGE, NOT TO THE PICTURE.
     *
     * The chip hangs 50 design px below the mount, so 70% of it lies over the
     * card and 30% below. Three routes give 49.4, 49.9 and 50.9 — a spread of
     * 1.6 design px, which is 0.65 screen px at the plateau.
     *
     * That 50 equals the mount's own 50 to within measurement error. Whether
     * that is a design rule or a coincidence cannot be told from these frames.
     */
    dropBelowCard: 50,

    /**
     * Bebas Neue, and the em size is fixed by the advance rather than guessed.
     *
     * The face is already vendored as `condensedFace.ts`. a8 is its first
     * consumer — a4 still sets its chips in Libre Franklin 800 as a stand-in.
     *
     * ##################################################################
     * # THE VENDORED FILE'S OWN METRICS CONFIRM THE IDENTIFICATION.    #
     * #                                                                 #
     * # Measured off his frames, the advance of "#d" is 0.812 em. The  #
     * # vendored Bebas Neue has `#` at 0.4120 em and every digit at    #
     * # 0.4000 em, summing to 0.8120 EXACTLY. Its cap height is 700 of #
     * # 1000 units, and 131.5 * 0.700 = 92.05 against a measured 92.   #
     * #                                                                 #
     * # Two independent fits over 18-19 candidate faces put Bebas at   #
     * # rms 0.041px against 0.337 for the next best, and an            #
     * # out-of-sample prediction the fit never saw — the merged "#4"   #
     * # ink width at 1.7x zoom — lands at 0.11px where every rival is  #
     * # off by 0.59 to 15.23px. 15 of 18 rivals need a physically      #
     * # impossible NEGATIVE stroke to fit at all.                      #
     * #                                                                 #
     * # ONLY THREE GLYPHS are measurable at full quality: `#`, `1` and #
     * # `4`. `2` and `3` live inside the blurred cards. That separates #
     * # Bebas from every mainstream condensed grotesque by 8x to 12x.  #
     * # It does NOT separate Bebas Neue from a Bebas fork.             #
     * ##################################################################
     */
    fontSize: 131.5,

    /**
     * Above the chip's own bottom edge. 0.267 of the chip's height.
     *
     * ##################################################################
     * # POSITION BY THE BASELINE AND USE THE FACE'S OWN METRICS.       #
     * #                                                                 #
     * # `top: baseline - fontSize` reads as obviously right and is     #
     * # wrong, and it shipped wrong once already on a3 and a5. With    #
     * # line-height 1 the box is one em tall while the face is taller  #
     * # than its em, so CSS centres the overflow and the baseline does #
     * # not land at the bottom of the box.                             #
     * #                                                                 #
     * # For Bebas the baseline sits at 0.800 em from the top, so the   #
     * # naive form is 0.200 em too high — 10.5 screen px at the        #
     * # plateau and 26.6px at the hero. See `condensedFace.ts` for why #
     * # 0.800 is portable across the two metric conventions Chrome     #
     * # picks between.                                                 #
     * ##################################################################
     */
    baselineAboveBottom: 44.5,

    /**
     * 2.1 design px PER SIDE, so a centred CSS stroke is 4.2 wide.
     *
     * ##################################################################
     * # FITTED AGAINST A REAL RENDER, WHICH IS WHAT `condensedFace.ts` #
     * # DEMANDS BEFORE ANY DEVICE PINS A STROKE NUMBER.                #
     * #                                                                 #
     * # The starting value came from HIS frames, and thresholded then  #
     * # h264-encoded ink measures wider than the outline it came from  #
     * # — which is why that file carries two figures for a4 differing  #
     * # by 1.8x and refuses to call either authoritative.              #
     * #                                                                 #
     * # Rendered and compared, 2026-08-23, on the two sharp frames      #
     * # where the chip is clear of picture content:                     #
     * #                                                                 #
     * #            cap/chipH      inkW/cap      inkArea/cap^2           #
     * #   local 14  his 0.5849    his 1.1290    his 0.7310              #
     * #             ours 0.5849   ours 1.1129   ours 0.7492  (+2.5%)    #
     * #   local 20  his 0.6023    his 1.0943    his 0.7188              #
     * #             ours 0.5909   ours 1.1346   ours 0.7474  (+4.0%)    #
     * #                                                                 #
     * # So our ink runs 2.5-4.0% heavy and the cap height matches to    #
     * # 1.9%. The caps there are 52 and 62 px, so ONE pixel of edge is  #
     * # already 1.6 to 1.9%, and the width ratio scatters +/-3% between #
     * # the two frames in opposite directions. The excess is inside the #
     * # quantisation and 2.1 is KEPT.                                   #
     * #                                                                 #
     * # If it is ever re-fitted: 3% of area is roughly 0.1-0.2 design   #
     * # px per side, so the honest bracket is about 1.9 to 2.2, and no  #
     * # frame in a8 has a chip big enough to do better.                 #
     * #                                                                 #
     * # Conventions, spelled out because a4 was bitten by exactly this:#
     * #   per side / OUTLINE cap  0.0228     doubled  0.0457           #
     * #   per side / INKED  cap   0.0218     doubled  0.0436           #
     * # a4's own 0.046 and 0.0256 are one measurement under two        #
     * # conventions, not two answers.                                  #
     * ##################################################################
     */
    strokePerSide: 2.1,

    /**
     * Zero. Measured -0.0002 em, bounded under 0.0005 em.
     *
     * ##################################################################
     * # CENTRE THE TEXT BY ITS ADVANCE, NOT BY ITS INK.                #
     * #                                                                 #
     * # Bebas's `1` carries a wide right sidebearing, so the two are   #
     * # not the same thing. At the plateau `#1`'s visible ink centre   #
     * # must land 2.03 screen px LEFT of the chip's centre and `#4`'s  #
     * # 0.14px right. Advance-centring predicts -2.08 and +0.08;       #
     * # ink-centring predicts 0.00 and 0.00 for both.                  #
     * #                                                                 #
     * # The differential settles it beyond argument: the `#1`-to-`#4`  #
     * # ink-centre difference is 2.17px measured against 2.16 from     #
     * # advance-centring and 0.00 from ink-centring.                   #
     * #                                                                 #
     * # Plain `text-align: center` IS advance-centring, so this is     #
     * # what a normal implementation does by default. It is written    #
     * # down because a build that "fixes" the visible off-centre look  #
     * # by measuring ink would be introducing the error.               #
     * ##################################################################
     */
    letterSpacing: 0,

    /**
     * Material Orange 500 and pure black.
     *
     * The fill decodes to (254, 151, 0) as the joint mode over 213,323 eroded
     * pixels, stable under erosion 2 to 8. The green channel was an open
     * question between `#FF9500` and `#FF9800` and is now closed by
     * calibration: the large flat yellow mount in the same frames decodes 1
     * level low on R and G against its authored value, and applying that same
     * offset to the chip gives `#FF9800` exactly. `#FF9500` would require the
     * green channel to read 2 levels HIGH in the same frames with the same
     * encoder, a sign flip.
     */
    fill: '#FF9800',
    textColour: '#000000',

    /**
     * In, and it is NOT the mirror of out.
     *
     * Different length, different easing, and a translate four times bigger.
     * easeOutCubic on opacity over 4 frames wins at rms 0.013 against
     * easeOutQuart 0.068, easeOutQuad 0.116 and linear 0.33.
     *
     * The measured alphas are 0.000, 0.58, 0.89 at local 5, 6, 7 and the model
     * gives 0.000, 0.578, 0.875, reaching 0.984 at local 8 where the
     * measurement rounds to 1.000. That last 0.016 is inside the encode's own
     * floor and is left rather than tuned away.
     *
     * The chip also translates DOWNWARD, and the slide outlasts the fade.
     *
     * ##################################################################
     * # THE MEASUREMENT SPEC PUT THIS AMPLITUDE AT 152 DESIGN PX AND    #
     * # IT IS ABOUT 30. TWO INDEPENDENT ROUTES REFUTE IT, AND IT WAS    #
     * # CAUGHT BY RENDERING THE CLIP AND LOOKING AT IT.                 #
     * #                                                                 #
     * # Built at 142.6 the chip enters from so far below that it is     #
     * # still clipped by the frame's bottom edge at local 8, where his  #
     * # own frame shows it clear of the edge and nearly home. That is   #
     * # 50 to 90 SCREEN px of error across local 8 to 13, and it is     #
     * # plainly visible in a side-by-side.                              #
     * #                                                                 #
     * # ROUTE ONE, absolute. His chip top against a settled position    #
     * # computed from this clock — geometry independently verified to   #
     * # 1px against his frame at local 100. Displacement in design px:  #
     * #   local  9  25.0    local 13  20.9                              #
     * #   local 10  20.4    local 14   5.9                              #
     * #   local 11  35.8    local 15  10.0                              #
     * #   local 12  37.0    local 16   1.9   local 17  0.9              #
     * #                                                                 #
     * # ROUTE TWO, fully differential — his chip bottom against card    #
     * # four's OWN outer bottom edge in the same frame, over that       #
     * # card's own width. This is the method his exit slide was         #
     * # measured with. It reads +23.8 at local 9 and then scatters      #
     * # within +/-10 design px of zero from local 10 on.                #
     * #                                                                 #
     * # Both routes agree the amplitude is TENS of design px, not       #
     * # HUNDREDS, and that it is over by about local 14.                #
     * #                                                                 #
     * # WHERE THE PUBLISHED NUMBER PROBABLY CAME FROM: it was quoted    #
     * # as 0.0706 strip units at local 9. The measured displacement     #
     * # there is 0.0124 su. A factor of 5.7, which is close to the      #
     * # ratio between the card's SCREEN width at local 9 and at the     #
     * # plateau. Its own source labelled the shape unresolved.          #
     * ##################################################################
     *
     * Held at 30 design px through local 8, then linear to zero at local 14.
     * Anchored on locals 9 and 10, the two frames where the chip is neither
     * clipped by the frame edge nor still fading: the model gives 25.0 and 20.0
     * against a measured 25.0 and 20.4.
     *
     * ##################################################################
     * # HIS SLIDE IS NOT A MONOTONE DECAY, AND THE REMAINING RESIDUAL   #
     * # IS RECORDED RATHER THAN FITTED AWAY.                            #
     * #                                                                 #
     * # Rendering this model and diffing the chip's top edge against    #
     * # his frame gives, in screen px (negative = ours sits higher):    #
     * #                                                                 #
     * #   local  9   0     local 13  -10     local 17   0               #
     * #   local 10   0     local 14   -4     local 18   0               #
     * #   local 11 -13     local 15   -5     local 19   0               #
     * #   local 12 -18     local 16   -1     local 20   0               #
     * #                                                                 #
     * # Converted back to design px, his displacement runs 25, 20, 33,  #
     * # 36, 20, 6 over locals 9 to 14 — it DIPS at 10 and RISES again   #
     * # at 11 and 12 before settling. That is an overshoot, not a       #
     * # decay, and it agrees with the absolute route's 25.0, 20.4,      #
     * # 35.8, 37.0, 20.9, 5.9 to within 3 design px at every frame.     #
     * #                                                                 #
     * # SO THE WOBBLE IS REAL AND NOT ESTIMATOR NOISE. It is about 15   #
     * # design px, 6 screen px at the plateau, over three frames in the #
     * # middle of the fastest motion in the clip, and it is NOT MODELLED#
     * # HERE. Fitting a spring through three points during a 2x zoom is #
     * # exactly the over-fit that got a3's stagger law backwards.       #
     * #                                                                 #
     * # If a8 ever needs to be tighter than 18 screen px over locals    #
     * # 11 to 13, this is the thing to model, and the frames to model   #
     * # it from are src 1108 to 1116.                                   #
     * ##################################################################
     *
     * ##################################################################
     * # AND SO THE SPEC'S "THE EXIT SLIDE IS A QUARTER OF THE ENTRANCE" #
     * # IS BACKWARDS. They are comparable — 30 in, 34 out. What really  #
     * # differs between the two ends is the ORDER: the fade leads going #
     * # in and the slide leads coming out.                              #
     * ##################################################################
     */
    entrance: { startFrame: 5, fadeFrames: 4, slideFromFrame: 8, slideToFrame: 14, slideDesignPx: 30 },

    /**
     * Out, and the amplitude here is a QUARTER of the entrance's.
     *
     * `(1-u)^2` over 3 frames wins at rms 0.017 against `(1-u)^3` 0.100 and
     * linear 0.238. Measured 1.000, 0.42, 0.10, 0.000 against a model giving
     * 1.000, 0.444, 0.111, 0.000.
     *
     * ##################################################################
     * # AN EARLIER PASS PUBLISHED A SYMMETRIC 0.070 su EXIT SLIDE AND  #
     * # A TRAP INSTRUCTING A BUILDER TO BUILD IT. IT IS 0.017 su.      #
     * #                                                                 #
     * # Tracked against card 1's own bottom edge in the same frame the #
     * # displacement peaks at +0.0168 su = 34 design px = 13.6 screen  #
     * # px at the plateau, against a claimed 59px.                     #
     * #                                                                 #
     * # The control settles it: at local 106 the chip's ink and fill   #
     * # occupy screen rows 754.1 to 823.5, a height of 69.5px against  #
     * # a predicted 70.4 — the WHOLE chip. The published figure needs  #
     * # rows 798 to 868, and rows 830-871 there read mean (7.5,7.3,7.4)#
     * # with a max R-B of 3 where the chip itself reaches 245. And the #
     * # ground directly below the chip is 100.000% BIT-IDENTICAL       #
     * # between local 105 and 106, so nothing in the comparison is     #
     * # encoder noise.                                                  #
     * #                                                                 #
     * # Build the published number and the chip visibly drops off the  #
     * # photograph before it fades, on the last four frames it exists. #
     * ##################################################################
     *
     * ##################################################################
     * # THE SLIDE LEADS THE FADE HERE, WHICH IS THE MIRROR OF THE       #
     * # ENTRANCE, WHERE THE FADE LEADS THE SLIDE.                       #
     * #                                                                 #
     * # Displacement is zero and settled at local 100 and 101, reads    #
     * # +0.0106 su at local 104, and is at its full +0.0168 su by local #
     * # 105 — the frame the fade STARTS on. So the chip has finished    #
     * # moving before it begins to disappear.                           #
     * #                                                                 #
     * # A three-frame ramp opening at local 102 predicts 22.7 design px #
     * # at local 104 against a measured 21.4, which is 0.5 screen px.   #
     * # The opening frame is bracketed 102 to 103 by that single point  #
     * # and nothing narrows it further.                                 #
     * #                                                                 #
     * # HELD from local 105 on. At local 107 the chip is 10% opaque and #
     * # its top edge is a 25-level step that reads LOWER than local     #
     * # 106's, which is not physical — so holding is the honest choice  #
     * # rather than continuing a ramp through the noise.                #
     * ##################################################################
     */
    exit: { startFrame: 105, fadeFrames: 3, slideFromFrame: 102, slideToFrame: 105, slideDesignPx: 34 },
  },

  /**
   * Material Yellow 500. Decodes to (254, 234, 59) as the joint mode in 100.0%
   * of 22,194 pure-fill pixels, and to the same value in six frames at three
   * different scales. The -1 on R and G is exactly the 8-bit limited-range
   * round trip, so `#FFEB3B` is the authored value to within +/-2 per channel,
   * which is as well as a lossy encode can ever say it.
   *
   * ##################################################################
   * # a9 FRAMES THE SAME PHOTOGRAPH IN A WHITE BORDER.                #
   * #                                                                 #
   * # a8's closing hero and a9's opening frame are the SAME rendered  #
   * # image two encodes apart — mad 0.0010, 99.8% of pixels           #
   * # bit-identical. Anyone building a9 from a8's card, or the other  #
   * # way, inherits the wrong mount colour invisibly.                 #
   * ##################################################################
   */
  borderColour: '#FFEB3B',

  /**
   * Pure black, and NOT a4's luma 3.0. Between 99.73% and 99.99% of ground
   * pixels are exactly zero in every radius band, and 81.6% of the whole grid
   * band on a mid-clip frame is exactly (0,0,0).
   *
   * There is NO glow, NO shadow and NO second outline around the cards.
   * Approaching a mount from outside, the ground reads 3.28, 3.31, 3.33, 3.34,
   * 3.36, 3.35, 3.40 across 61px and then steps 5.03 to 225.09 in ONE pixel.
   * The only outward feature is a 1-2px fringe at R=13, G=3, B=3, which is
   * 4:2:0 chroma upsampling leaking the yellow's Cr rather than a glow. Any
   * glow is bounded under sigma 0.5 screen px. The control is a real grid line
   * 20px away reading 77.5 in the same probe, so the probe is not blind.
   *
   * a9's card genuinely glows and carries three box-shadows. Copy that line
   * here and you draw a halo on four cards for 150 frames.
   */
  ground: '#000000',
} as const

/** The inclusive last frame of a8's own scene. */
export const GALLERY_STRIP_LAST_FRAME = GALLERY_STRIP.totalFrames - 1

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * A cubic bezier easing, solved by bisection on x.
 *
 * Bisection rather than Newton because it cannot diverge, and 30 iterations is
 * exact to about 1e-9 — nine digits finer than a 2020px card can show. Speed is
 * irrelevant: this runs 150 times per clip.
 *
 * Copied rather than shared with `twoPhotoZoomClock.ts` on purpose. Every clock
 * module in this folder imports NOTHING, which is what keeps the `.test.ts` lane
 * safe under `--conditions react-server`.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  /* The endpoints are returned exactly, so `scale(0)` is 0 and not 2.8e-10. */
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

/**
 * Penner's easeInOutCubic, PIECEWISE.
 *
 * ####################################################################
 * # THIS IS NOT THE CSS BEZIER OF THE SAME NAME. THEY ARE DIFFERENT   #
 * # CURVES AND THE DIFFERENCE IS VISIBLE.                             #
 * #                                                                   #
 * # Fitted against the pan with endpoints free on a quarter-frame     #
 * # grid, in screen px of rms:                                        #
 * #                                                                   #
 * #   Penner easeInOutCubic, piecewise        0.164   <- this         #
 * #   cubic-bezier(.65,0,.35,1)               8.60                    #
 * #   cubic-bezier(.645,.045,.355,1)          9.91                    #
 * #   easeInOutQuad                          25.10                    #
 * #   smootherstep                           29.82                    #
 * #   CSS ease-in-out (.42,0,.58,1)          38.20                    #
 * #   easeInOutSine                          60.78                    #
 * #   Material (.4,0,.2,1)                   78.05                    #
 * #   linear                                208.03                    #
 * #   easeOutCubic                          435.03                    #
 * #                                                                   #
 * # The CSS lookalike peaks at 23.6px of lag a third of a second into #
 * # the pan — the entire strip visibly behind where it should be.     #
 * #                                                                   #
 * # Two more routes confirm the winner on different landmarks: 0.222  #
 * # px rms on orange-chip centroids, and under 0.4px on a chip        #
 * # centroid track that involves no fitting at all.                   #
 * ####################################################################
 */
function easeInOutCubic(u: number): number {
  const t = clamp01(u)
  if (t < 0.5) return 4 * t * t * t
  const f = -2 * t + 2
  return 1 - (f * f * f) / 2
}

/**
 * The camera's scale at a frame.
 *
 * Hero at both ends, plateau in the middle, and the two ramps are different
 * curves of different lengths. See `GALLERY_STRIP.camera`.
 */
export function galleryStripScale(frame: number): number {
  const { heroScale, zoomOut, zoomIn } = GALLERY_STRIP.camera

  if (frame <= zoomOut.startFrame) return heroScale

  if (frame < zoomOut.endFrame) {
    const u = (frame - zoomOut.startFrame) / (zoomOut.endFrame - zoomOut.startFrame)
    const p = cubicBezier(zoomOut.ease.x1, zoomOut.ease.y1, zoomOut.ease.x2, zoomOut.ease.y2, u)
    return heroScale + (1 - heroScale) * p
  }

  if (frame <= zoomIn.startFrame) return 1

  const u = (frame - zoomIn.startFrame) / (zoomIn.endFrame - zoomIn.startFrame)
  const p = cubicBezier(zoomIn.ease.x1, zoomIn.ease.y1, zoomIn.ease.x2, zoomIn.ease.y2, u)
  return 1 + (heroScale - 1) * p
}

/**
 * The design-space x sitting at the centre of the screen, at a frame.
 *
 * Travels exactly three pitches, from card 4's centre to card 1's centre.
 */
export function galleryStripCentre(frame: number): number {
  const { pan } = GALLERY_STRIP.camera
  const u = (frame - pan.startFrame) / (pan.endFrame - pan.startFrame)
  return pan.centreFrom + (pan.centreTo - pan.centreFrom) * easeInOutCubic(u)
}

/** Screen pixels per design pixel at a frame. */
export function galleryStripUnit(frame: number): number {
  return GALLERY_STRIP.unit * galleryStripScale(frame)
}

/**
 * One card's OUTER box at a frame, in absolute frame pixels.
 *
 * `index` is 0-BASED. Card 0 is the leftmost, labelled `#1`, and it is the one
 * the clip ENDS on. Card 3 is the rightmost, labelled `#4`, and it is the one
 * the clip OPENS inside. See the box at the top of this file.
 */
export function galleryStripCardBox(
  frame: number,
  index: number,
): { left: number; top: number; width: number; height: number; unit: number } {
  const { design } = GALLERY_STRIP
  const unit = galleryStripUnit(frame)
  const centre = galleryStripCentre(frame)

  /* The card's own left edge in design space. Uniform pitch, no per-card widths. */
  const designLeft = index * design.pitch

  return {
    left: 959.5 + unit * (designLeft - centre),
    top: 539.5 - unit * (design.cardHeight / 2),
    width: design.cardWidth * unit,
    height: design.cardHeight * unit,
    unit,
  }
}

/**
 * Whether a card is blurred at a frame.
 *
 * A LITERAL FRAME WINDOW on the two middle cards, which is all the evidence
 * supports — the switches are keyed to neither the pan nor the zooms.
 */
export function galleryStripCardIsBlurred(frame: number, index: number): boolean {
  const { blur } = GALLERY_STRIP
  /*
   * `some` rather than `includes`, because `as const` narrows the array's
   * element type to `1 | 2` and `includes` then refuses a plain `number`
   * argument. A widening cast would work and would also silence a real future
   * mistake; this does not.
   */
  if (!blur.blurredCardIndices.some((blurredIndex) => blurredIndex === index)) return false
  return frame >= blur.onFrame && frame < blur.offFrame
}

/** The blur's sigma in SCREEN pixels at a frame, for a card that is blurred. */
export function galleryStripBlurSigma(frame: number): number {
  return GALLERY_STRIP.blur.sigmaDesignPx * galleryStripUnit(frame)
}

/**
 * The chips' shared opacity at a frame.
 *
 * ####################################################################
 * # THEY ARE ABSENT FOR THE ENTIRE FINAL ZOOM AND THE WHOLE HOLD —    #
 * # 42 FRAMES, 1.400s, THE MOST PROMINENT SHOT IN THE ANIMATION.      #
 * #                                                                   #
 * # A strict fill scan over all 150 frames finds chip fill only on    #
 * # local 8 to 105, two pixels at local 7, and EXACTLY ZERO from      #
 * # local 106 onward. Drawing them through the zoom-in puts an orange #
 * # badge across the hero shot that the reference does not have.      #
 * ####################################################################
 */
export function galleryStripChipOpacity(frame: number): number {
  const { entrance, exit } = GALLERY_STRIP.chip

  if (frame < entrance.startFrame) return 0

  if (frame >= exit.startFrame) {
    const u = clamp01((frame - exit.startFrame) / exit.fadeFrames)
    /* (1-u)^2, which beats a cubic by 6x and a linear by 14x. */
    return (1 - u) * (1 - u)
  }

  const u = clamp01((frame - entrance.startFrame) / entrance.fadeFrames)
  /* easeOutCubic. */
  const f = 1 - u
  return 1 - f * f * f
}

/**
 * How far the chips sit BELOW their settled position at a frame, in design px.
 *
 * Positive is downward, and zero for the whole settled middle of the clip.
 *
 * ####################################################################
 * # NEITHER SLIDE IS ALIGNED WITH ITS OWN FADE, AND THEY LEAD IN      #
 * # OPPOSITE DIRECTIONS.                                              #
 * #                                                                   #
 * #   in    fade local  5 ->  9    slide local  9 -> 14               #
 * #   out   slide local 102 -> 105  fade local 105 -> 108             #
 * #                                                                   #
 * # So on the way in the chip is fully opaque before it starts        #
 * # moving, and on the way out it has stopped moving before it starts #
 * # to disappear. Building either as one curve puts the chip in the   #
 * # wrong place for four frames at each end.                          #
 * ####################################################################
 */
export function galleryStripChipDrop(frame: number): number {
  const { entrance, exit } = GALLERY_STRIP.chip

  /* Held at full displacement while it fades in, and before it is drawn at all. */
  if (frame <= entrance.slideFromFrame) return entrance.slideDesignPx

  if (frame < entrance.slideToFrame) {
    const u = (frame - entrance.slideFromFrame) / (entrance.slideToFrame - entrance.slideFromFrame)
    return entrance.slideDesignPx * (1 - u)
  }

  if (frame <= exit.slideFromFrame) return 0

  const u = clamp01((frame - exit.slideFromFrame) / (exit.slideToFrame - exit.slideFromFrame))
  return exit.slideDesignPx * u
}

/**
 * The label a card carries.
 *
 * ####################################################################
 * # GENERATED, NOT AUTHORED, AND THAT IS A CHOICE RATHER THAN A       #
 * # MEASUREMENT.                                                      #
 * #                                                                   #
 * # Nothing in the pixels can settle it. All four strings are exactly #
 * # the 1-based index with a `#`, they match left-to-right position,  #
 * # and all four badges are the same width rather than sizing to      #
 * # their text — but Bebas's figures are TABULAR, every digit         #
 * # advancing 0.4000 em, so `#1` and `#4` have identical advances and #
 * # a hugging box and a fixed box predict the same pixels. a4 proves  #
 * # this reel's chip component does accept arbitrary authored text.   #
 * #                                                                   #
 * # Generating them is the reading that is safe under both, and it is #
 * # the one that costs the client nothing: it means a8 needs NO       #
 * # written copy, so it is not one of the five references blocked on  #
 * # the capability `verifySpokenMarks` does not yet have.             #
 * ####################################################################
 */
export function galleryStripOrdinal(index: number): string {
  return `#${String(index + 1)}`
}
