/**
 * `top-title`, his "text overlay 5.0": geometry, type, shadow and the type-on clock.
 *
 * ####################################################################
 * # THIS MODULE IMPORTS NOTHING, and that is the rule every other     #
 * # clock in this folder keeps. The `.test.ts` lane resolves          #
 * # differently from the DOM lane, and a `remotion` import here dies  #
 * # at the import line with an error that reads nothing like the real #
 * # cause. Importing nothing at all is stronger still, and it is what #
 * # lets every number below be checked in plain node.                 #
 * #                                                                   #
 * # THE PRICE IS THAT `FRAME_WIDTH` AND `SAFE_AREA_X` CANNOT BE READ  #
 * # HERE. They are passed IN, see `topTitleMeasurePx`, so the         #
 * # title-safe band is still DERIVED from the compositor's own two    #
 * # constants and is never retyped.                                   #
 * ####################################################################
 *
 * ####################################################################
 * # RE-MEASURED 2026-09-17, AFTER HIS NOTE OF 2026-09-16 19:14:       #
 * #                                                                   #
 * #   "title along the top (2/4) still needs changes on it's          #
 * #    style/color"                                                   #
 * #                                                                   #
 * # He sent no new file, so his own clip is the target, and EVERY     #
 * # number in the first version of this file was replaced. What the   #
 * # first version got wrong, all of it measured off his frames:       #
 * #                                                                   #
 * #   face      Libre Franklin 800   ->  Noto Sans Bold               #
 * #   size      122 px, no tracking  ->  130 px, 0.5 px tracking      #
 * #   left      139 (his INK edge)   ->  127 (the text box origin)    #
 * #   colour    #FDFAE7 under grade  ->  #FFFCE8 OVER the grade       #
 * #   shadow    none                 ->  black, 6 px at 45deg, 8.6 px #
 * #   type-on   per WORD, linear,       per CHARACTER, eased, spaces #
 * #             37.5 -> 105.5           slotted, 17 -> 94             #
 * #   block     no fade              ->  the whole title fades 0..30  #
 * #                                                                   #
 * # THE TIMINGS WERE THE LEAD-IN MISTAKE AGAIN. `SPEC-measured.md`    #
 * # recorded "starts 1.25s, settles 3.52s" off the CLIP'S clock. His  #
 * # clip opens on black at 60 fps and the photograph cuts in on clip  #
 * # frame 25, and his composition itself starts two clip frames      #
 * # earlier, see the box at the top of the clock below. Everything    #
 * # here is on the SHOT'S clock: film frame n is clip frames 23 + 2n  #
 * # and 24 + 2n.                                                      #
 * #                                                                   #
 * # HOW, so it can be repeated. His clip decoded with                  #
 * #   scale=in_color_matrix=bt709:in_range=tv:out_range=pc            #
 * # because the stream is TAGGED bt709 and ffmpeg's default matrix    #
 * # reads the cream about two levels off. Clip frame 54, the last     #
 * # frame before any ink, is the clean background; every later frame #
 * # is unmixed against it. A glyph's drawn opacity on a frame is the  #
 * # least-squares scale of its settled lift, shadow included, onto    #
 * # that frame's lift.                                                #
 * ####################################################################
 */

/* ------------------------------------------------------------- the face -- */

/**
 * Noto Sans Bold's vertical metrics over the em, from its own tables: `hhea`
 * ascent 1069 and descent -293 on a 1000 unit em, repeated as `sTypoAscender`
 * and `sTypoDescender` with `USE_TYPO_METRICS` set. The file is the one
 * `bodyFaceBold.ts` inlines, `@fontsource/noto-sans@5.3.0` latin 700.
 */
const FACE_ASCENDER_OVER_EM = 1.069
const FACE_DESCENDER_OVER_EM = 0.293

/**
 * Where the baseline sits inside a `line-height: 1` box, as a fraction of the
 * font size. DERIVED, not typed.
 *
 * ####################################################################
 * # `top = baseline - fontSize` IS WRONG AND IT HAS SHIPPED ONCE.     #
 * #                                                                   #
 * # With `line-height: 1` the line box is one em tall, but the FACE   #
 * # is taller. Noto Sans's ascender plus descender is 1.362em. CSS    #
 * # centres the overflow, so the half-leading is negative and the     #
 * # baseline lands at (1 - 1.362) / 2 + 1.069 = 0.888em from the top. #
 * #                                                                   #
 * # IT IS A PROPERTY OF THE FACE. `bodyFace.ts` carries the same      #
 * # 0.888 for the regular, and `TopTitle.mount.test.tsx` pins the two #
 * # equal. It was 0.860 while this device was set in Libre Franklin.  #
 * ####################################################################
 */
export const TOP_TITLE_BASELINE_OVER_EM =
  (1 - (FACE_ASCENDER_OVER_EM + FACE_DESCENDER_OVER_EM)) / 2 + FACE_ASCENDER_OVER_EM

/**
 * Noto Sans's capitals over the em: `OS/2.sCapHeight` 714, the same in the
 * Regular and the Bold. Restated rather than imported because this module
 * imports nothing; the mount test pins it to `BODY_FACE_CAP_OVER_EM`.
 */
const FACE_CAP_OVER_EM = 0.714

/** Exported so the mount test can pin it against `bodyFace.ts`. */
export const TOP_TITLE_CAP_OVER_EM = FACE_CAP_OVER_EM

/* ------------------------------------------------- geometry and the type -- */

/**
 * ####################################################################
 * # THE FACE IS NOTO SANS BOLD, AND THAT IS AN IDENTIFICATION.        #
 * #                                                                   #
 * # His two lines hold 23 glyphs, so 46 glyph edges. Laid out from     #
 * # each face's own `hmtx`, with one origin and one scale fitted:     #
 * #                                                                   #
 * #   Noto Sans Bold        rms  0.78 px   max  1.8 px               #
 * #   Libre Franklin 800    rms 11.05 px   max 30.4 px               #
 * #                                                                   #
 * # And his lower-case g is single-storey, which Open Sans's is not.  #
 * # `bodyFace.ts` reached Noto Sans for his OTHER reference clips the #
 * # same way, so this is the face he makes his overlays in.           #
 * ####################################################################
 *
 * ####################################################################
 * # 130 PX WITH 0.5 PX OF TRACKING, AND THREE READINGS AGREE.         #
 * #                                                                   #
 * # Horizontally alone, 131 px with no tracking and 130 px with 0.5   #
 * # cannot be told apart (rms 0.85 and 0.60 px). The VERTICAL edges   #
 * # decide it, and tracking cannot touch them. Sub-pixel, on flat     #
 * # glyph edges, luma unmixed against the clean frame:                #
 * #                                                                   #
 * #                 cap height   ascender (l, h, d)                   #
 * #   his line 1       92.93        98.92                             #
 * #   his line 2       92.59        98.94                             #
 * #   130 px           92.82        98.80                             #
 * #   131 px           93.53        99.56                             #
 * #                                                                   #
 * # The third reading is his line pitch: baselines 237.1 and 393.5,   #
 * # 156 px apart, which is exactly 1.2 x 130. With the size fixed at  #
 * # 130, the horizontal fit asks for 0.52 px of tracking and puts the #
 * # text box origin at x 127.2.                                        #
 * ####################################################################
 */
export const TOP_TITLE_TYPE = {
  /**
   * The text box's left edge, fitted. NOT his ink edge, which is 139: the first
   * glyph draws its own left side bearing to the right of this, 0.090em for his
   * E and 0.085em for his U, and both land on 139 from 127.
   */
  leftPx: 127,

  /** His cap height, the mean of both lines' sub-pixel readings in the box above. */
  capHeightPx: 92.8,

  /**
   * DERIVED FROM THE CAP HEIGHT, never typed as a font size, because what was
   * measured is drawn letters and `fontSize` is an em box no glyph fills.
   * 92.8 / 0.714 = 129.97, which rounds to 130.
   */
  fontSizePx: Math.round(92.8 / FACE_CAP_OVER_EM),

  /** 700, the weight `bodyFaceBold.ts` registers the Bold under. 800 would be a fake. */
  fontWeight: 700,

  /**
   * 0.5 px after EVERY character, the last included, which is how Chrome puts
   * `letter-spacing` into a line's width. `topTitleFit.ts` counts it the same way.
   */
  letterSpacingPx: 0.5,

  /**
   * 1, and `TOP_TITLE_BASELINE_OVER_EM` above is derived for EXACTLY this value.
   * The box is a positioning device; the 156 px pitch comes from the two
   * absolute baselines below, never from a line height.
   */
  lineHeight: 1,

  /**
   * #FFFCE8, the median of 28,687 glyph-interior pixels on his settled frame,
   * eroded 4 px so no anti-aliased edge is read. p10 is #FEFBE6 and p90 #FFFDE9,
   * and the reading is the same in every quarter of both lines, so it is a flat
   * fill with no gradient. The first version's #FDFAE7 was the default-matrix
   * decode of the same pixels.
   */
  colour: '#FFFCE8',

  /** The baseline of the first line, in film pixels from the top. His reads 237.1. */
  line1BaselinePx: 237,

  /**
   * The baseline of the second line. An ABSOLUTE baseline rather than a line
   * height, which is what makes the empty-`line2` case free. His reads 393.5.
   */
  line2BaselinePx: 393,
} as const

/**
 * The drop shadow under every glyph.
 *
 * ####################################################################
 * # MEASURED AS A FIT, NOT READ OFF A LOOK. His darkening around the  #
 * # glyphs, luma over the clean frame, fitted as his own glyph mask   #
 * # shifted, Gaussian-blurred and scaled. Each line fitted alone, on  #
 * # his settled frame (clip frame 257):                               #
 * #                                                                   #
 * #            offset x   offset y   sigma   opacity   rms luma       #
 * #   line 1     4.22       4.06      4.34    1.015     1.42          #
 * #   line 2     4.25       4.25      4.28    0.972     1.55          #
 * #   no shadow at all                                  8.78 / 11.70  #
 * #                                                                   #
 * # So it is BLACK AT FULL OPACITY, pushed down and right at 45deg.   #
 * # The four offsets average 4.2 px each way, about a 6 px distance   #
 * # at 45deg, which is the distance-and-angle shape an editor's       #
 * # shadow control has. The two sigmas average 4.31.                  #
 * #                                                                   #
 * # A SECOND FIT, with its own mask, reads his sigma a little wider,  #
 * # 4.42 and 4.46. The shadow below explains his pixels as well as    #
 * # that fit's own best does: rms 1.86 against 1.85 on line 1, and    #
 * # 1.65 against 1.64 on line 2.                                      #
 * #                                                                   #
 * # CSS blur is TWICE the Gaussian sigma (the spec's definition, and  #
 * # what Chrome draws), so sigma 4.31 is an 8.6 px blur. The render   #
 * # was fitted the first way and read back sigma 4.28 and 4.25, at    #
 * # opacity 0.98 on both lines.                                       #
 * ####################################################################
 */
export const TOP_TITLE_SHADOW = {
  /** 6 px at 45deg, down and to the right. */
  offsetXPx: 6 * Math.SQRT1_2,
  offsetYPx: 6 * Math.SQRT1_2,
  /** Twice his fitted sigma of 4.31. */
  blurPx: 8.6,
  colour: '#000000',
} as const

/** The CSS `text-shadow` the component draws, built here so no number is typed there. */
export function topTitleTextShadow(): string {
  const { offsetXPx, offsetYPx, blurPx, colour } = TOP_TITLE_SHADOW
  return `${String(offsetXPx)}px ${String(offsetYPx)}px ${String(blurPx)}px ${colour}`
}

/**
 * THE GLOW THE CORNER LABEL STACKS OVER THE SHADOW ABOVE, so it can carry its
 * own ground with no band under it.
 *
 * ##########################################################################
 * # IT LIVES HERE, BESIDE `TOP_TITLE_SHADOW`, BECAUSE IT IS THAT SHADOW      #
 * # DEEPENED AND NOT A SECOND IDEA. The shadow above is a fit to the         #
 * # CLIENT'S OWN darkening; this is the same idiom taken far enough to       #
 * # survive a sky at grey 254, and the two belong in one place so nobody     #
 * # tunes one without reading the other's fit table.                         #
 * #                                                                        #
 * # `cornerLabelClock.ts` IMPORTS NOTHING, on purpose — that is what keeps   #
 * # it in the fast test lane — so the composed string is built here and      #
 * # `CornerLabel.tsx` imports it, which is also why the file still types no  #
 * # number of its own. `topTitleClock.js` is already in the compositor's     #
 * # closure through `TopTitle.tsx`, so this adds nothing to the bundle and   #
 * # `bundleGraph.test.ts` stays green.                                       #
 * ##########################################################################
 *
 * ##########################################################################
 * # WHY TWO PASSES OF 16px AND NOT ONE OF 32. CSS blur is TWICE the Gaussian #
 * # sigma, so 16px is sigma 8 — repeating the SAME layer deepens the halo    #
 * # without widening it, because the transmittance at the peak goes to about #
 * # `(1 - a)` squared while the extinction distance stays where it is. A     #
 * # single wider glow buys the same peak by reaching further across the      #
 * # picture, which is the thing a halo exists to avoid.                      #
 * #                                                                        #
 * # MEASURED ON BEAT 1'S OWN RENDERED FRAME, through the real `Segment`      #
 * # composition with the film's own copy, length and grade, against the      #
 * # gate's own one-letter window arithmetic:                                 #
 * #                                                                        #
 * #   TOP_TITLE_SHADOW alone           1.76:1  FAIL   darkened  14,610 px    #
 * #   the same shadow, three copies    2.83:1  FAIL             16,106 px    #
 * #   1 pass of 24px + the shadow      3.20:1  OK               21,439 px    #
 * #   THIS, 2 passes of 16px           4.54:1  OK               20,050 px    #
 * #   2 passes of 24px + the shadow    5.23:1  OK               23,882 px    #
 * #   3 passes of 36px + the shadow    7.85:1  OK               30,614 px    #
 * #                                                                        #
 * # 2x16 is the first row that clears the 3.0 floor with real headroom while #
 * # darkening less picture than the single wide pass that barely clears it.  #
 * # Above it the numbers buy contrast nobody needs at a footprint the        #
 * # client's own reference never spends.                                     #
 * #                                                                        #
 * # THE DEPTH IS ABOUT TWO AND A HALF TIMES HIS OWN, and that is a taste     #
 * # call he has not been shown. At 3px from a stroke his `chapter title v2`  #
 * # runs 0.162 effective and this runs 0.405. It HAS to be heavier — his     #
 * # page is 140 grey and beat 1's sky is 254 — but send him the clip.        #
 * ##########################################################################
 */
export const TYPE_HALO_GLOW = {
  /** Sigma 8, since CSS blur is twice the Gaussian sigma. */
  blurPx: 16,
  /** How many times the SAME layer is drawn. See the box. */
  passes: 2,
  colour: '#000000',
} as const

/**
 * THE SAME IDIOM AT THE OTHER END OF A 2.4x WIDER WINDOW: what the CHAPTER
 * PLATE stacks over the same shadow, so it too can carry its ground with no
 * band under it.
 *
 * ##########################################################################
 * # A RATIO OF THE DRAWN CAP, WHERE THE CORNER LABEL'S IS A CONSTANT, AND    #
 * # THAT IS THE ONE REAL DIFFERENCE BETWEEN THE TWO ROWS.                    #
 * #                                                                        #
 * # The corner label is set at ONE size on every frame of every film, so its #
 * # 16px is already a fixed fraction of its 54.27px cap — 0.295 — and typing #
 * # the pixels is typing the ratio. A chapter heading SHRINKS TO FIT, from a #
 * # 132px cap down to the 90px floor `CHAPTER_PLATE_MIN_CAP_HEIGHT_PX`       #
 * # holds, so a blur typed as a constant would be a different fraction of    #
 * # the type at every size and the credit `DEVICE_REGISTRY` records for it   #
 * # would move with the COPY.                                                #
 * #                                                                        #
 * # MEASURED AT A CONSTANT RATIO THE CREDIT BARELY MOVES AT ALL, which is    #
 * # the whole engineering argument for one number on the row:                #
 * #                                                                        #
 * #     blur / cap      credit at cap 132.0   credit at cap 91.2             #
 * #       0.182               0.411                0.421                     #
 * #       0.242 (this)        0.448                0.443                     #
 * #       0.295               0.474                0.458                     #
 * #                                                                        #
 * # AND IT SURVIVES THE BUILD FOR FREE. The halo rides inside the group      #
 * # transform with the type, so the blur-over-cap ratio is identical on      #
 * # every frame from 0.765 scale to settled — the one thing the band it      #
 * # replaces could never be made to do, because a rectangle's depth does not #
 * # know how big the letters currently are.                                  #
 * ##########################################################################
 *
 * ##########################################################################
 * # THREE PASSES WHERE THE CORNER LABEL USES TWO, AND IT IS THE SAME FIT     #
 * # RATHER THAN A SECOND IDEA.                                               #
 * #                                                                        #
 * # Copy the corner label's rule LITERALLY — 2 passes at 0.295 of cap — and  #
 * # it is worth 0.406 on the settled heading and 0.393 on a shrunk one. The  #
 * # gate needs 0.406 to admit beat 28 at all, so the identical rule misses    #
 * # the one shot the band existed to rescue by about a hundredth of credit,  #
 * # and missing means that shot plays with NO HEADING.                        #
 * #                                                                        #
 * # MORE PASSES BEATS MORE BLUR, on both axes at once, which is what the box #
 * # above already predicted ("repeating the SAME layer deepens the halo      #
 * # without widening it") and which holds harder at twice the cap. All rows  #
 * # rendered through the real `Segment` composition over beat 28's census    #
 * # page and beat 57's lake, settled frame 90, read on the gate's own        #
 * # one-letter window:                                                       #
 * #                                                                        #
 * #   shape                        b28     b57    credit   picture darkened  #
 * #                                                        that holds no ink #
 * #   nothing                     1.04 X  1.50 X    -              1 px      #
 * #   TOP_TITLE_SHADOW alone      1.81 X  2.59 X    -          2,375 px      #
 * #   2x16, the corner label's    2.79 X  3.98      0.324      5,846 px      #
 * #   2x39, its RATIO at this cap 3.46    5.27      0.406     14,227 px      #
 * #   3x24                        3.58    5.35      0.411      9,842 px      #
 * #   THIS, 3x32                  3.96    5.90      0.448     13,302 px      #
 * #   3x39                        4.29    6.34      0.474     16,862 px      #
 * #   4x39                        5.13    7.36      0.528     19,011 px      #
 * #   the band this replaces      3.36    3.42      0.338    145,965 px      #
 * #                                                                        #
 * # X marks a window under the 3.0 floor. At matched credit the extra pass   #
 * # is strictly cheaper: 3x24 buys 0.411 for 9,842 px where 2x39 buys 0.406  #
 * # for 14,227.                                                              #
 * #                                                                        #
 * # WHY 0.242 AND NOT TIGHTER OR WIDER. 0.182 is worth 0.411, which clears   #
 * # the 0.406 the gate needs by five thousandths and leaves nothing for the  #
 * # source-JPEG error. 0.295 is worth 0.474 and starts to read as a cloud    #
 * # rather than a halo on the census page. 0.242 sits between them with      #
 * # 0.042 of headroom over what beat 28 needs, and on the strip it still     #
 * # reads as a halo hugging the letters with the printed table intact a few  #
 * # tens of pixels away.                                                     #
 * #                                                                        #
 * # THE DEPTH IS ABOUT FIVE AND A HALF TIMES THE CLIENT'S OWN, and that is a #
 * # taste call he has not been shown. At 3px from a stroke his `chapter      #
 * # title v2` runs 0.159 effective alpha on his own page and this runs 0.860 #
 * # on the census page. Part of that gap is honest — his page is 140 grey    #
 * # and beat 28's is 248 — and part of it is that his own reference measures #
 * # 2.45:1 on this project's own one-letter window, below the floor we hold  #
 * # ourselves to. SEND HIM tmp/f1/f3-b28.mp4 AND tmp/f1/f3-b57.mp4 BEFORE    #
 * # THE RENDER; those two are the SHIPPED component over those two pictures. #
 * ##########################################################################
 */
export const CHAPTER_PLATE_HALO_GLOW = {
  /** Blur as a fraction of the DRAWN cap height. 32px at the settled 132. */
  blurOverCap: 0.242,
  /** How many times the SAME layer is drawn. See the box. */
  passes: 3,
  colour: '#000000',
} as const

/**
 * The corner label's whole `text-shadow`, outermost layer first.
 *
 * Two glow passes and then `topTitleTextShadow()` unchanged, which is
 * `TOP_TITLE_SHADOW` exactly as it was fitted from the client's own clips. CSS
 * paints `text-shadow` layers back to front, so the directional shadow is last.
 */
export function cornerLabelTextShadow(): string {
  const { blurPx, passes, colour } = TYPE_HALO_GLOW
  const glow = `0px 0px ${String(blurPx)}px ${colour}`
  return [...Array<string>(passes).fill(glow), topTitleTextShadow()].join(', ')
}

/**
 * The chapter plate's whole `text-shadow`, outermost layer first, FITTED TO THE
 * SIZE THE HEADING IS REALLY DRAWN AT.
 *
 * Three glow passes at `blurOverCap` of `capPx`, then `topTitleTextShadow()`
 * unchanged — the same two-part shape `cornerLabelTextShadow` above builds, and
 * the same paint order: CSS draws `text-shadow` layers back to front, so the
 * directional shadow is last and sits closest to the glyph.
 *
 * `capPx` RATHER THAN A FONT SIZE, because the cap height is what the gate's
 * one-letter window is sized from and what the credit table above is indexed
 * by. `chapterPlateCapHeightPx` is the one place the two are converted.
 */
export function chapterPlateTextShadow(capPx: number): string {
  const { blurOverCap, passes, colour } = CHAPTER_PLATE_HALO_GLOW
  const glow = `0px 0px ${String(blurOverCap * capPx)}px ${colour}`
  return [...Array<string>(passes).fill(glow), topTitleTextShadow()].join(', ')
}

/**
 * The widest a line may be drawn, in film pixels.
 *
 * TITLE-SAFE IS DERIVED HERE AND NEVER TYPED. `frameWidth - 2 * safeAreaX` is
 * the band every caption keeps inside. The block's own left edge already sits
 * `leftPx - safeAreaX` inside that band, so what is left for the words is the
 * remainder, 1697 px. Hand it the compositor's own `FRAME_WIDTH` and
 * `SAFE_AREA_X` and the two can never drift apart.
 */
export function topTitleMeasurePx(frameWidth: number, safeAreaX: number): number {
  const titleSafeWidth = frameWidth - 2 * safeAreaX
  return titleSafeWidth - (TOP_TITLE_TYPE.leftPx - safeAreaX)
}

/** The `top` a `line-height: 1` box needs so its baseline lands where measured. */
export function topTitleLineTopPx(baselinePx: number): number {
  return baselinePx - TOP_TITLE_TYPE.fontSizePx * TOP_TITLE_BASELINE_OVER_EM
}

/* ------------------------------------------------------------- the clock -- */

/**
 * ####################################################################
 * # THE SHOT'S FRAME 0 IS HIS CLIP FRAME 23, NOT HIS PICTURE CUT.     #
 * #                                                                   #
 * # His clip opens on a dim frame (mean luma 1.37) for clip frames 0  #
 * # to 22, then a DIFFERENT, darker black (0.76) on 23 and 24, and    #
 * # the photograph cuts in on 25. The same second black the chapter   #
 * # title's duplicate sample carries. Two readings that cannot share  #
 * # an error put his composition's start on clip frame 23:            #
 * #                                                                   #
 * #   the black itself changes there                                  #
 * #   his title's fade, extrapolated back, is zero there              #
 * #                                                                   #
 * # So film frame n is clip frames 23 + 2n and 24 + 2n, and his       #
 * # photograph is on screen from film frame 1. A first pass that      #
 * # took the picture cut as frame 0 drew every motion one frame late. #
 * ####################################################################
 */

/**
 * THE WHOLE TITLE FADES UP, linearly, over the shot's first 30 frames.
 *
 * ####################################################################
 * # A SECOND MOTION, UNDER THE TYPE-ON, AND THE FIRST VERSION MISSED  #
 * # IT. Every glyph that has finished its own arrival reads the SAME  #
 * # level on a frame, whenever it arrived: the letters of "Elder",    #
 * # which arrive across frames 16 to 23, all read 0.84 on frame 25.   #
 * # That level climbs one thirtieth a frame and tops out on frame 30. #
 * # Fitted free, the end comes back 29.8. So a character's drawn      #
 * # opacity is this TIMES its own.                                    #
 * ####################################################################
 */
export const TOP_TITLE_BLOCK_FADE = {
  startFrame: 0,
  endFrame: 30,
} as const

/** The whole title's opacity at a film frame, 0 to 1. */
export function topTitleBlockOpacity(frame: number): number {
  const { startFrame, endFrame } = TOP_TITLE_BLOCK_FADE
  const t = (frame - startFrame) / (endFrame - startFrame)
  return Math.min(Math.max(t, 0), 1)
}

/**
 * The type-on, on the shot's clock, in film frames.
 *
 * ####################################################################
 * # ONE CHARACTER AT A TIME, EACH FADING UP, ON ONE EASED CURVE.      #
 * #                                                                   #
 * # Tracked glyph by glyph on every film frame of his build. A fading #
 * # glyph is an exact scaled copy of its settled self (residual 2% of #
 * # its signal, best shift 0,0), and its SHADOW fades with it, shadow #
 * # over fill 0.95 to 1.00 on every frame: the glyph and its shadow   #
 * # are one group at one opacity, which is how the component draws    #
 * # them. No rise, no scale, no blur, and no cursor: not one bright   #
 * # pixel lands outside the settled glyphs on any frame.              #
 * #                                                                   #
 * # THE MODEL. A reveal position runs from 0 to the character count   #
 * # along one curve, and character i is drawn at                      #
 * #   clamp((position - i) / softness, 0, 1)                          #
 * # so each fades over a little more than one slot. When the reveal   #
 * # ends, every character is whole: his last g creeps to 0.90 and     #
 * # snaps to 1.00 in one frame, on frame 94, which is this model's    #
 * # (26 - 25) / 1.1 = 0.91 and then the end.                          #
 * #                                                                   #
 * # A SPACE TAKES A SLOT, and so does his line break. His sample is   #
 * # one string, "Elder Earth: Fiery Undoing", wrapped, and the space  #
 * # the wrap replaced still takes its turn.                           #
 * #                                                                   #
 * # THE NUMBERS, fitted to all 23 glyphs on all 118 frames of his     #
 * # shot, with the block fade in the model, then rounded one at a     #
 * # time with the rest refitted:                                      #
 * #   start 17, duration 77, so whole on frame 94                     #
 * #   cubic-bezier(0.29, 0.68, 0.27, 1), softness 1.1 slots           #
 * # Drawn opacity against his: rms 0.012 over every glyph and frame,  #
 * # 0.052 while a glyph is arriving. The first version's model, one   #
 * # slot and no snap, read 0.092 there, and drew his g as much as     #
 * # 0.17 too bright for twenty frames.                                #
 * #                                                                   #
 * # WHAT IT STILL MISSES, written down: his very first letter starts  #
 * # a frame early. His E reads 0.24 on frame 17, where this reads 0.  #
 * # Moving the start to 16 to catch it costs every later glyph more   #
 * # than it buys (0.077 while arriving).                              #
 * #                                                                   #
 * # THE BUILD DOES NOT STRETCH WITH THE COPY, AND THAT IS A CHOICE,   #
 * # NOT A MEASUREMENT. His one sample is 26 slots, so nothing in it   #
 * # shows what a title of another length does. Here every title is    #
 * # whole on frame 94. A 46-slot title's first letters therefore land #
 * # about 1.7 times his pace, and a 6-slot one reads as each letter   #
 * # fading up slowly.                                                 #
 * #                                                                   #
 * # WHY THIS WAY ROUND. His reveal is not a steady typewriter: the    #
 * # gap between his half-drawn glyphs grows from about 1.1 frames to  #
 * # 13.4, so it reads as ONE eased curve over the whole title, which  #
 * # is what two eased keyframes on a text animator give, and those    #
 * # keyframes stay put when the words change. The other reading, his  #
 * # pace kept and the build stretched to fit, settles the film's one  #
 * # placed title ("Memory and recognition" / "Three sections of       #
 * # Enoch", 46 slots) on frame 153, after its 148-frame shot has      #
 * # cut, and it would need a shot length per copy that the            #
 * # registry's single `buildEndFrames` cannot say.                    #
 * #                                                                   #
 * # A SECOND SAMPLE FROM HIM, OF ANOTHER LENGTH, WOULD SETTLE IT. The #
 * # short-title test in `topTitleClock.test.ts` pins the choice.      #
 * ####################################################################
 */
export const TOP_TITLE_TYPE_ON = {
  /** The reveal starts. His first ink is on frame 16 and his E is half drawn on 17.8. */
  startFrame: 17,
  durationFrames: 77,
  /** Every character is whole from here on. `startFrame + durationFrames`. */
  settleFrame: 17 + 77,
  /** cubic-bezier(x1, y1, x2, y2), the CSS convention. */
  curve: [0.29, 0.68, 0.27, 1],
  /** How many slots of the reveal one character's own fade spans. */
  softnessSlots: 1.1,
} as const

/**
 * A CSS cubic-bezier timing function evaluated at `x`, 0 to 1.
 *
 * Solved for the curve parameter by Newton's method with a bisection fallback,
 * the same approach browsers take. Written out rather than imported because
 * this module imports nothing.
 */
export function topTitleCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (s: number): number => ((ax * s + bx) * s + cx) * s
  const slopeX = (s: number): number => (3 * ax * s + 2 * bx) * s + cx

  let s = x
  for (let step = 0; step < 8; step += 1) {
    const error = sampleX(s) - x
    if (Math.abs(error) < 1e-7) return ((ay * s + by) * s + cy) * s
    const slope = slopeX(s)
    if (Math.abs(slope) < 1e-6) break
    s -= error / slope
  }

  let lo = 0
  let hi = 1
  s = x
  for (let step = 0; step < 60; step += 1) {
    const value = sampleX(s)
    if (Math.abs(value - x) < 1e-7) break
    if (value < x) lo = s
    else hi = s
    s = (lo + hi) / 2
  }
  return ((ay * s + by) * s + cy) * s
}

/** How far the reveal has run at a film frame, 0 to 1 along his curve. */
export function topTitleRevealProgress(frame: number): number {
  const { startFrame, durationFrames, curve } = TOP_TITLE_TYPE_ON
  const x = (frame - startFrame) / durationFrames
  const [x1, y1, x2, y2] = curve
  return topTitleCubicBezier(x1, y1, x2, y2, Math.min(Math.max(x, 0), 1))
}

/**
 * A character's OWN opacity at a film frame, 0 to 1, before the block fade.
 *
 * `slot` is the character's position in the whole title, both lines together
 * and the break counted; `slotCount` is the total. See `topTitleSlotCount`.
 */
export function topTitleCharacterOpacity(frame: number, slot: number, slotCount: number): number {
  if (slotCount <= 0) return 0
  /* The reveal has ended and every character is whole, his last g included. */
  if (frame >= TOP_TITLE_TYPE_ON.settleFrame) return 1
  const position = topTitleRevealProgress(frame) * slotCount
  return Math.min(Math.max((position - slot) / TOP_TITLE_TYPE_ON.softnessSlots, 0), 1)
}

/* ------------------------------------------------------------ the slots -- */

/**
 * One drawn character and the slot it arrives in. A space is a character too:
 * it takes its slot and draws nothing.
 */
export type TopTitleGlyph = { text: string; slot: number }

/** Where line 1's first slot is, so the component never types a zero. */
export const TOP_TITLE_FIRST_SLOT = 0

/**
 * THE LINE BREAK TAKES ONE SLOT, because his sample is one string, "Elder
 * Earth: Fiery Undoing", wrapped: the space the wrap replaced still takes its
 * turn. Measured as a gap: his y is whole on frame 38.6 and his U starts on
 * 40.6, two frames at a pace of about one character a frame.
 */
export const TOP_TITLE_BREAK_SLOTS = 1

/**
 * A line as its characters, each with its slot, in reading order.
 *
 * BY CODE POINT, NOT BY UTF-16 UNIT, so a character outside the BMP is one
 * slot and one span rather than two halves of a surrogate pair.
 */
export function topTitleGlyphs(line: string, firstSlot: number): readonly TopTitleGlyph[] {
  return Array.from(line).map((text, index) => ({ text, slot: firstSlot + index }))
}

/** How many slots a line takes: one per character, spaces included. */
export function topTitleLineSlots(line: string): number {
  return Array.from(line).length
}

/** Line 2's first slot: after all of line 1 and the break. */
export function topTitleLine2FirstSlot(line1: string): number {
  return topTitleLineSlots(line1) + TOP_TITLE_BREAK_SLOTS
}

/** The whole title's slot count. An empty `line2` adds neither its characters nor a break. */
export function topTitleSlotCount(line1: string, line2: string): number {
  if (line2 === '') return topTitleLineSlots(line1)
  return topTitleLine2FirstSlot(line1) + topTitleLineSlots(line2)
}
