import {
  OVERLAY_ENTRY_FRAMES,
  OVERLAY_EXIT_FRAMES,
  OVERLAY_FULL_TREATMENT_MIN_FRAMES,
  OVERLAY_HOLD_FRAMES,
  OVERLAY_MIN_READABLE_FRAMES,
  OVERLAY_TYPE_DELAY_FRAMES,
  overlayStartFrame,
} from '@vg/core/frames'
import { maxTravelForCrop } from '@vg/core/motion'
import { FPS, FRAME_HEIGHT, FRAME_WIDTH, OVERLAY_MAX_CHARS } from '@vg/core/schemas'
import type { AssetVision, OverlayStyle, ShotScale } from '@vg/core/schemas'

/**
 * Every number the compositor renders with, in one place.
 *
 * These are typographic and geometric decisions, not preferences — they are the
 * difference between something that reads as a documentary and something that
 * reads as a social-video template. Where a value has a reason, the reason is
 * next to it.
 */

export { FPS, FRAME_WIDTH, FRAME_HEIGHT }

/**
 * Head and tail black.
 *
 * NOT rendered inside a segment. A segment's `renderKey` deliberately excludes
 * `startFrame`, so scene 0 is not distinguishable from any other scene by its
 * hash — baking a black head into it would poison the cache for every future job
 * that reuses that segment. They are rendered once by the `Bumper` composition
 * and concatenated by the worker.
 */
export const BLACK_HEAD_FRAMES = 6
export const BLACK_TAIL_FRAMES = 12

/** Typeface family name. See public/fonts/README.md for what has to be on disk. */
export const FONT_FAMILY = 'VG Documentary'

/**
 * The SECOND family, and the first serif this project has ever shipped.
 *
 * ####################################################################
 * # THIS EXISTS BECAUSE THE CLIENT'S OWN REFERENCE CLIPS ARE SET IN  #
 * # A SERIF, AND UNTIL 2026-09-14 THERE WAS NOWHERE TO PUT ONE.      #
 * #                                                                   #
 * # P03, P12 and P13 all asked for a serif and all three were         #
 * # collapsed into `FONT_FAMILY`, because vendoring a licensed face   #
 * # was "a decision to take once for all six templates rather than    #
 * # here" (`templates/P03.tsx`). Two of the four overlays Niku sent    #
 * # on 2026-09-14 — the chapter plate and the name plate — are set in  #
 * # a high-contrast display serif, so the decision is now taken.      #
 * #                                                                   #
 * # It is a SEPARATE family, never a weight of `FONT_FAMILY`. Every   #
 * # existing component asks for `FONT_FAMILY` by name, so nothing     #
 * # already approved can pick this up by accident, and the three      #
 * # templates above keep the exact pixels the client signed off.      #
 * ####################################################################
 *
 * Playfair Display, SIL Open Font License 1.1 — the same licence as Libre
 * Franklin, so committing the file is permitted as well as convenient.
 */
export const SERIF_FAMILY = 'VG Documentary Serif'

/**
 * The date stamp's two families (its month line and its year line), registered
 * by `useDateStampFonts` in fonts.ts only on a `date-stamp` shot. Own names, so
 * nothing else can pick them up: DM Serif Display and Libre Baskerville, both
 * SIL OFL 1.1, matched off the owner's 2026-10-11 reference.
 */
export const DATE_STAMP_DATE_FAMILY = 'VG Date Stamp Display'
export const DATE_STAMP_YEAR_FAMILY = 'VG Date Stamp Year'

/**
 * The location map's label face, registered by `useLocationMapFont` in fonts.ts
 * only on a `location-map` shot. Bebas Neue Regular (Dharma Type, SIL OFL 1.1),
 * matched off the owner's 2026-10-11 map reference ('LAKE MONOUN': letter widths
 * and places within 0.1 units). The house rule against Bebas (fonts.ts,
 * public/fonts/README.md) is about faces WE choose; this one is his, copied 1:1.
 */
export const LOCATION_MAP_LABEL_FAMILY = 'VG Location Map Label'

/* ------------------------------------------------------------- captions -- */

export const SAFE_AREA_X = 96

const CAPTION_FONT_SIZE = 52
const CAPTION_MAX_CHARS_PER_LINE = 38

/**
 * Mean advance of ONE character of Libre Franklin Medium at the caption size, as
 * a fraction of the em, letter-spacing already folded in.
 *
 * Measured off the thing that was broken rather than guessed. The caption block
 * used to be pinned to the two safe areas and nothing else, so it rendered
 * `FRAME_WIDTH - 2 * SAFE_AREA_X` = 1728px wide, and 1728px of this face at 52px
 * takes about 65 characters of real narration. 1728 / 65 / 52 = 0.511 em.
 */
const CAPTION_MEAN_ADVANCE_EM = 0.511

/**
 * 3% of slack, and it errs in ONE direction on purpose.
 *
 * 0.511 is a mean over a mixed corpus, so a line of wide glyphs ("WHOM THE
 * COMMISSION") runs past it and a line of narrow ones falls short. Those two
 * failures are not symmetrical. Too NARROW and a phrase the planner budgeted as
 * two lines wraps to three, whose top edge lands above the scrim's plateau and
 * sits on the ramp. Too WIDE and a phrase budgeted as two lines fits on one,
 * which is merely a short caption. So the derived width is rounded up.
 */
const CAPTION_WIDTH_SLACK = 1.03

/**
 * How many characters of this face fit across `width` at the caption size.
 *
 * Exported so the width decision below is checkable in node as a CHARACTER
 * claim, which is the same unit the planner budgets in (`countCaptionLines` in
 * @vg/core/frames counts characters, not pixels). It is an average and it says
 * nothing about any particular phrase.
 */
export function captionCharsPerLine(width: number): number {
  return width / (CAPTION_FONT_SIZE * CAPTION_MEAN_ADVANCE_EM)
}

export const CAPTION = {
  fontSize: CAPTION_FONT_SIZE,
  lineHeight: 1.24,
  letterSpacing: '0.005em',
  color: '#FAFAF7',
  maxLines: 2,
  maxCharsPerLine: CAPTION_MAX_CHARS_PER_LINE,
  /**
   * THE PLANNER'S LINE BUDGET, RESTATED IN PIXELS.
   *
   * `buildCaptionPhrases` splits narration against `maxCharsPerLine` 38 and
   * `maxLines` 2, so a phrase is BUILT as two balanced lines of ~38 characters.
   * The block it was rendered into was 1728px, which holds ~65 characters, so
   * both budgeted lines fitted on one and the caption swept nearly the whole
   * frame. `textWrap: 'balance'` had nothing left to balance, because a block
   * that fits on one line has no second line to balance against.
   *
   * 38 x 52 x 0.511 x 1.03 = 1040px is the width the planner has been budgeting
   * for all along. Derived, not chosen: change `maxCharsPerLine` or `fontSize`
   * and this follows.
   */
  maxWidth: Math.round(
    CAPTION_MAX_CHARS_PER_LINE * CAPTION_FONT_SIZE * CAPTION_MEAN_ADVANCE_EM * CAPTION_WIDTH_SLACK,
  ),
  /** The BOTTOM edge of the text block, measured from the top of the frame. */
  blockBottomY: 972,
  /**
   * The current word is at 1.0 and the rest at 0.74. No colour change and no
   * scale: karaoke fill and per-word pop are both instantly readable as social
   * video, and neither helps anyone follow a line they can already see.
   */
  activeOpacity: 1,
  inactiveOpacity: 0.74,
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.6)',
} as const

/**
 * A FIXED scrim, never keyed to whether a phrase is on screen at this instant.
 *
 * This is what makes legibility deterministic across 150 images nobody has
 * looked at. A stroke or a text box would also be legible and would look like a
 * subtitle burned in by a video editor from 2009. Fading it in with each phrase
 * would pump the brightness of the lower third every few seconds.
 *
 * It IS keyed, ONCE PER SCENE, to whether that scene has any captions at all
 * (`Scene.tsx:84-89`) — a different knob, and the constancy above survives it,
 * gaps between phrases included. Captions ship OFF by default now
 * (CAPTIONS_ENABLED, `apps/worker/src/env.ts`), and an always-on scrim over an
 * empty caption array is a 408px dark band with nothing in it on every shot.
 *
 * ALSO READ BY THE HARNESS: A10 gates a render on the vertical luminance spread
 * of a still, and this gradient used to supply nearly all of it. See the box at
 * `apps/worker/scripts/harness/frames.ts:84-108` for the measured margin that is
 * left. These five lines are the only mention of A10 anywhere under apps/web, so
 * read that box before changing `startY`, the alphas, or the condition the scrim
 * mounts under.
 */
/**
 * The gradient that makes white captions readable over an image nobody previewed.
 *
 * SIZED AGAINST THE TEXT BLOCK, not by eye. `CAPTION.blockBottomY` is 972 and two
 * lines at 52px / 1.24 are ~129px tall, so the text occupies roughly y=843..972.
 * The old ramp started at 760 and reached 0.55 only at the frame edge, which left
 * the band the text actually sits in at 0.14..0.36 alpha. That is ample over a
 * dark full-bleed photograph and invisible over a bright parchment scan — which is
 * most of the corpus for a documentary about manuscripts. Observed on a real frame:
 * white type laid straight across a lit manuscript page, barely readable.
 *
 * `plateauAt` is where the ramp finishes climbing, placed just above the text so
 * the whole block sits on flat tone rather than on a gradient. Ending at 0.72
 * rather than 1.0 keeps it reading as a scrim and not as a letterbox bar.
 *
 * ####################################################################
 * # RE-CHECKED AFTER THE BLOCK WAS GIVEN A REAL `maxWidth`.           #
 * #                                                                   #
 * # The narrowing changes the block's WIDTH. It does not touch the    #
 * # type size, the leading or the bottom edge, which are the only     #
 * # three numbers this ramp was derived from, so the arithmetic       #
 * # survives unchanged:                                               #
 * #   two lines      52 x 1.24 x 2      = 128.96px                    #
 * #   text top       972 - 128.96       = 843.04                      #
 * #   plateau        672 + 408 x 0.42   = 843.36                      #
 * # Same pixel, a third of a pixel apart. Still correct.              #
 * #                                                                   #
 * # WHAT CHANGED IS THAT IT NOW MATTERS. While the block was 1728px   #
 * # wide, a phrase the planner had budgeted as two lines rendered as  #
 * # ONE, occupied y=907..972, and never came near the ramp — 843 was  #
 * # accidentally generous rather than right, and the whole derivation #
 * # above was describing a block that never existed. With the block   #
 * # at `CAPTION.maxWidth` those phrases really do occupy two lines,   #
 * # so 843 is now the edge actually being defended.                   #
 * #                                                                   #
 * # THE UNCOVERED CASE, stated rather than hidden: a phrase whose     #
 * # glyphs run wider than the 0.511em mean and wrap to a THIRD line   #
 * # starts at 972 - 193.44 = 778.56, which is on the ramp at ~0.34    #
 * # alpha instead of on the 0.55 plateau. That cannot be fixed from a #
 * # constant — the planner counts characters and the renderer         #
 * # measures glyphs, and only the renderer is right.                  #
 * # `CAPTION_WIDTH_SLACK` is what keeps it rare.                      #
 * ####################################################################
 */
export const SCRIM = {
  startY: 672,
  endY: FRAME_HEIGHT,
  /** Fraction of the scrim's height at which the ramp reaches `plateauAlpha`. */
  plateauAt: 0.42,
  plateauAlpha: 0.55,
  endAlpha: 0.72,
} as const

/* ------------------------------------------------------------ text card -- */

/**
 * THE MEASURE. Every type decision on the card is derived from this one number.
 *
 * 1260px inside a 1920 frame, indented to `textX` 192, leaves 468px of picture
 * to the right of the longest line. That margin is not slack — it is where the
 * background photograph survives, and it is what makes the gradient below a
 * lighting decision rather than a black box behind some words.
 */
const TEXT_CARD_BLOCK_WIDTH = 1260

/**
 * The three type steps, and they are STEPS ON CHARACTERS, not on word count.
 *
 * ##########################################################################
 * # WHAT THE WORD COUNT COULD NOT SEE. The old rule was "<=8 words 96px,   #
 * # 9-16 76px, 17-24 62px", and a word count does not know how wide a word #
 * # is. "It dates to roughly 100 BCE" is six words and 27 characters;      #
 * # "Constantinople's reconstruction programme" is three words and 41.     #
 * # Both got 96px, and only one of them fitted.                            #
 * ##########################################################################
 *
 * Each step's ceiling is DERIVED: two lines of this face at that size across
 * `TEXT_CARD_BLOCK_WIDTH`, which is `textCardMaxChars` below. It lands on 53,
 * 68 and 85 — and 85 is `TEXT_CARD_MAX_CHARS` in `@vg/core/schemas`, the bound
 * the PLANNER shortens to. That is the contract: the planner guarantees a phrase
 * this block can hold, and the renderer never scales below the last step.
 *
 * Weight 600 on every step. ONLY 500 and 600 are on disk (`fonts.ts` FACES), so
 * asking for 700 does not produce a bolder card, it produces a synthesised face
 * in one browser and a fallback in another.
 */
const TEXT_CARD_TYPE_STEPS = [
  { fontSize: 92, lineHeight: 1.06, letterSpacing: '-0.015em' },
  { fontSize: 72, lineHeight: 1.1, letterSpacing: '-0.01em' },
  { fontSize: 58, lineHeight: 1.14, letterSpacing: '-0.005em' },
] as const

export type TextCardTypeStep = (typeof TEXT_CARD_TYPE_STEPS)[number]

/**
 * How many characters of headline two lines hold at `fontSize`.
 *
 * Reuses `CAPTION_MEAN_ADVANCE_EM`, which is a property of Libre Franklin and
 * not of the caption — the same face is being measured. It is measured with the
 * caption's +0.005em tracking folded in while the card sets NEGATIVE tracking,
 * so the real card fits slightly MORE than this says. The error therefore runs
 * in the safe direction: the renderer steps down a size fractionally early,
 * which is a slightly smaller headline, never an overflowing one.
 */
export function textCardMaxChars(fontSize: number): number {
  return Math.floor((2 * TEXT_CARD_BLOCK_WIDTH) / (fontSize * CAPTION_MEAN_ADVANCE_EM))
}

/**
 * ##########################################################################
 * # RETIRED 2026-08-16. NOTHING DRAWS THIS ANY MORE.                       #
 * #                                                                        #
 * # It sized the full-frame card's 92/72/58 headline. The card stopped     #
 * # owning the frame when the client rejected it, and its line is now      #
 * # sized by `textCardOnPictureFontSize` against a two-line block on a     #
 * # photograph — two steps, not three, and both much smaller.              #
 * #                                                                        #
 * # KEPT RATHER THAN DELETED, the same way `ArchivePlate` is kept: this is #
 * # one threshold away from coming back if he asks for the card look, and  #
 * # `TEXT_CARD_TYPE_STEPS` is still live regardless — `OVERLAY_STEP` reads #
 * # index 1 for the on-picture line. Its tests still document the          #
 * # derivation, which is the part that would be expensive to rediscover.   #
 * #                                                                        #
 * # DO NOT read this as current state. `TEXT_CARD.opticalCentreY`,         #
 * # `TEXT_CARD.textX` and `TEXT_CARD.scrimGradient` are retired with it,   #
 * # and are marked where they are declared.                                #
 * ##########################################################################
 */
export function textCardTypeStep(chars: number): TextCardTypeStep {
  const [large, medium, small] = TEXT_CARD_TYPE_STEPS
  if (chars <= textCardMaxChars(large.fontSize)) return large
  if (chars <= textCardMaxChars(medium.fontSize)) return medium
  return small
}

/**
 * The headline, split into at most two lines HERE rather than by the browser.
 *
 * Two things need this. The choreography animates PER LINE, and a line the
 * component cannot name is a line it cannot time. And "hard max 2 lines" is a
 * claim, so something has to be responsible for it; `textWrap: 'balance'` is a
 * hint about where to break, not a bound on how many breaks there are.
 *
 * The split minimises the LONGER line, which is what balancing means. It is
 * measured in characters against `textCardMaxChars`, so like every other number
 * here it is a mean and not a glyph measurement: a line of unusually wide
 * glyphs can still wrap to a third visual line in Chrome. Stated rather than
 * hidden — the planner's 85-character cap is what keeps it rare, and the failure
 * is a slightly taller block, not an unreadable one.
 */
export function textCardLines(phrase: string, fontSize: number): string[] {
  const words = phrase.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return []

  // `textCardMaxChars` is the TWO-line capacity, so half of it is one line.
  const text = words.join(' ')
  if (words.length < 2 || text.length <= textCardMaxChars(fontSize) / 2) return [text]

  let best = 1
  let bestLongest = Number.POSITIVE_INFINITY
  for (let split = 1; split < words.length; split += 1) {
    const longest = Math.max(
      words.slice(0, split).join(' ').length,
      words.slice(split).join(' ').length,
    )
    if (longest < bestLongest) {
      bestLongest = longest
      best = split
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

/**
 * THE FIXED CHOREOGRAPHY, in frames at 30fps and independent of the narration.
 *
 * The card's entry is a designed device, so it runs to the same clock on every
 * scene. Timing it off the word reveals would make an eight-second card and a
 * two-second card two different animations, and only one of them can be right.
 *
 * The full timeline is 20 frames of entry and 12 of exit, with the elements
 * overlapping: the rule draws first because it is the cheapest mark on the
 * frame, the eyebrow follows it, and the headline lands last and one line at a
 * time. Line two ends at f24, four frames past the nominal entry — the overlap
 * is what makes it read as one gesture rather than four.
 */
const TEXT_CARD_ENTRY_FRAMES = 20

/**
 * A SHORT SCENE GETS A SHORTER ANIMATION, OR NONE AT ALL.
 *
 * `56` is the full treatment's own length plus a beat: 24 frames until line two
 * has landed, 12 frames of exit, and 20 frames in the middle where the card is
 * simply on screen and readable. Under that the entry and the exit start to
 * collide, and a card that begins leaving before it finished arriving reads as a
 * bug in the render.
 *
 * `30` is where compressing stops helping. A one-second card cannot afford 20
 * frames of choreography, and a truncated animation looks broken in a way a
 * static card never does — so under a second the card simply IS, at full
 * opacity, from its first frame to its last.
 */
const TEXT_CARD_FULL_TREATMENT_MIN_FRAMES = 56
const TEXT_CARD_STATIC_BELOW_FRAMES = 30

export type FrameWindow = readonly [number, number]

export type TextCardChoreography = {
  /** No motion anywhere: every element sits at its final state on every frame. */
  frozen: boolean
  /** First frame of the exit. `durationFrames` when frozen, so nothing fires. */
  exitFrom: number
  exitFrames: number
  rule: FrameWindow
  eyebrow: FrameWindow
  headlineLine1: FrameWindow
  headlineLine2: FrameWindow
}

/** The full timeline. Every shorter one is this, scaled. */
const TEXT_CARD_ENTRY_WINDOWS = {
  rule: [0, 6],
  eyebrow: [4, 14],
  headlineLine1: [8, 20],
  headlineLine2: [12, 24],
} as const satisfies Record<string, FrameWindow>

export function textCardChoreography(durationFrames: number): TextCardChoreography {
  if (durationFrames < TEXT_CARD_STATIC_BELOW_FRAMES) {
    return {
      frozen: true,
      exitFrom: durationFrames,
      exitFrames: 0,
      rule: [0, 1],
      eyebrow: [0, 1],
      headlineLine1: [0, 1],
      headlineLine2: [0, 1],
    }
  }

  const full = durationFrames >= TEXT_CARD_FULL_TREATMENT_MIN_FRAMES
  const entryFrames = full ? TEXT_CARD_ENTRY_FRAMES : 12
  const exitFrames = full ? 12 : 8
  const scale = entryFrames / TEXT_CARD_ENTRY_FRAMES

  const scaled = (window: FrameWindow): FrameWindow => {
    const from = Math.round(window[0] * scale)
    // Never a zero-length window: `interpolate` requires a strictly increasing
    // input range and throws on `[4, 4]`, which a rounded scale can produce.
    return [from, Math.max(Math.round(window[1] * scale), from + 1)]
  }

  return {
    frozen: false,
    exitFrom: durationFrames - exitFrames,
    exitFrames,
    rule: scaled(TEXT_CARD_ENTRY_WINDOWS.rule),
    eyebrow: scaled(TEXT_CARD_ENTRY_WINDOWS.eyebrow),
    headlineLine1: scaled(TEXT_CARD_ENTRY_WINDOWS.headlineLine1),
    headlineLine2: scaled(TEXT_CARD_ENTRY_WINDOWS.headlineLine2),
  }
}

/**
 * The film's off-white, hoisted out of `TEXT_CARD` so more than one key inside
 * that object can use it.
 *
 * An object literal cannot reference its own properties while it is being built,
 * so `onPicture.color` would otherwise have to restate the hex — and a colour
 * written twice is a colour that eventually differs. Everything outside this
 * file still reads it as `TEXT_CARD.headlineColor`.
 */
const OFF_WHITE = '#F2EEE6'

export const TEXT_CARD = {
  margin: 96,
  /**
   * RETIRED 2026-08-16 along with `opticalCentreY` below and `scrimGradient`
   * further down — see the box on `textCardTypeStep`. The card's line now takes
   * `OVERLAY.textX` (160) and sits low, because it is on a photograph rather
   * than on a ground of its own.
   *
   * Text started here, not at the margin: the indent is what made it look set.
   */
  textX: 192,
  blockWidth: TEXT_CARD_BLOCK_WIDTH,
  /**
   * RETIRED 2026-08-16. Nothing reads this.
   *
   * Optical centre, slightly above the true centre (540). A block centred by
   * arithmetic always reads as sitting too low. The card's line is now pinned by
   * its BOTTOM at `OVERLAY_NOTE_BOTTOM_INSET`, because it wraps to one line or
   * two and there is no known height to derive a top from.
   */
  opticalCentreY: 486,
  /**
   * L1. Painted on EVERY card, with or without a picture behind it.
   *
   * That is the fix for the 0:20 frame, where a card with no structured ground
   * read as a stain. The three backdrop layers are always composited in the same
   * order and only the middle one is conditional, so the card's ground is the
   * same design either way and the photograph is a bonus rather than the
   * substrate.
   */
  baseColor: '#0B0B0C',
  /**
   * Warm off-white, not #FAFAF7. It is the same paper base the grade's toe lifts
   * the blacks toward (`GRADE.toeColor`), so the headline belongs to the film's
   * palette instead of being the one pure-white object in it.
   */
  headlineColor: OFF_WHITE,
  /** The rule and the eyebrow. Old gold, dark enough to read as ink on paper. */
  accentColor: '#C9A227',
  /**
   * THE RULE, and it is the cheapest element on the card.
   *
   * 64x2px of gold turns "type dropped on a picture" into a designed device, and
   * unlike the eyebrow it cannot be empty. That is what closes the hole the old
   * eyebrow left: `(year ?? entities[0] ?? '')` rendered NOTHING on a scene with
   * neither, and the card fell back to a bare pull quote on a dark frame — the
   * exact "we could not find an image" look the eyebrow exists to prevent.
   */
  rule: {
    width: 64,
    height: 2,
    /** Rule to eyebrow. The eyebrow's own cap height reads ~4px lower than this. */
    gapBelow: 20,
    /**
     * Rule straight to headline, when the scene had no year, no proper noun and
     * no section label to set.
     *
     * Optical, not metric. The same 20px that balances a 20px eyebrow reads as
     * cramped under a 92px headline, because what the eye measures is the gap
     * against the mass beneath it, and that mass is four times taller. 34px puts
     * the rule at the same apparent distance in both layouts.
     */
    gapBelowBare: 34,
  },
  eyebrow: {
    /**
     * 20px at FULL opacity in the accent, not 22px white at 0.6.
     *
     * An opacity multiplies against whatever is behind it, and what is behind it
     * is an unknown photograph — so 0.6 white is a different colour on every
     * scene, and over a pale scan it is a watermark. A darker colour at opacity
     * 1 is the same colour on every frame, which is the property that matters
     * when nobody previews 91 backdrops.
     */
    fontSize: 20,
    letterSpacing: '0.22em',
    lineHeight: 1,
    /** Eyebrow to headline. 32 read as two unrelated blocks; 20 reads as one. */
    gap: 20,
    /** How far it rises into place. Transform only — see the no-reflow rule. */
    translateY: 8,
  },
  background: {
    /**
     * L2, AND IT IS NO LONGER DEFOCUSED. THE CLIENT REJECTED THE CARD ON
     * 2026-08-16 AND ASKED FOR THE PICTURE.
     *
     * ##########################################################################
     * # WHAT THIS USED TO BE: `scale: 1.12` with                               #
     * # `blur(28px) brightness(0.28) saturate(0.55)`.                          #
     * #                                                                        #
     * # `brightness(0.28)` is the number that actually made the frame read as  #
     * # black — the picture was knocked to just over a quarter BEFORE the      #
     * # scrim went on, and the scrim opened at 0.92 alpha over a #0B0B0C base. #
     * # Three darkenings stacked. He sent that frame back and pointed at two   #
     * # of his own where the words simply sit on the photograph.               #
     * #                                                                        #
     * # THE 1.12 HAD TO GO WITH THE BLUR, AND MISSING THAT IS THE WORST WAY    #
     * # THIS CHANGE COULD FAIL. It was overscan, sized so a 28px blur did not  #
     * # sample transparent pixels in from outside the element's own box — the  #
     * # same trap the pillarbox branch documents at Scene.tsx. With the blur    #
     * # gone it has no job, and left in place it would MULTIPLY with the Ken   #
     * # Burns scale this layer now carries: a 1.06 -> 1.20 move would draw as  #
     * # 1.19 -> 1.34, straight through `MOVE_PEAK_CEILING` 1.2 in core/motion. #
     * # Neither that cap nor the scale-below-1 assertion can see a baked       #
     * # value, so nothing would have gone red. 1.0 is not tidiness, it is the  #
     * # cap staying enforceable.                                               #
     * ##########################################################################
     *
     * No filter at all now, which also settles the Grade.tsx question before it
     * is asked: there is nothing left on this layer to animate per frame.
     */
    scale: 1,
    filter: 'none',
  },
  /**
   * THE CARD'S TYPE, ONCE IT STOPPED OWNING THE FRAME.
   *
   * ##########################################################################
   * # A CARD IS NOW A PHOTOGRAPH WITH A LINE ON IT, WHICH IS THE SAME OBJECT  #
   * # AN OVERLAY IS. SO IT BORROWS THE OVERLAY'S SETTING RATHER THAN KEEPING  #
   * # ITS OWN.                                                                #
   * #                                                                        #
   * # The old block was 92px semibold on the optical centre line, left        #
   * # aligned, under a gold rule and a letterspaced eyebrow. Every one of     #
   * # those is a CHAPTER CARD mark, and the chapter card is the thing he      #
   * # asked us to stop showing him — twice now. The rule and the eyebrow are  #
   * # dropped here, not restyled: they are what made a fallback read as a     #
   * # designed interruption, and it is the interruption he objects to.        #
   * #                                                                        #
   * # THEY ARE NOT DELETED FROM THE CODEBASE. `TEXT_CARD.rule` and            #
   * # `TEXT_CARD.eyebrow` still set the overlay's own hairline treatment and  #
   * # are still pinned by T-TC9b. Only this device stopped drawing them.      #
   * ##########################################################################
   *
   * TWO SIZES, STEPPED ON CHARACTERS, and both derived rather than chosen.
   *
   * `pullPhrase` is capped at `TEXT_CARD_MAX_CHARS` 85 by the planner, and this
   * block wraps to at most two lines of the overlay's 1260px measure — a third
   * line would climb past y=750 and start covering the middle of the
   * photograph, which is the bound `OVERLAY.note.maxLines` already records.
   *
   *   large   `OVERLAY_NOTE_FONT_SIZE`, so a card line and an annotation are
   *           the same object. Two lines hold 2 x 1260 / (67 x 0.511 x 1.03)
   *           = 73 characters.
   *   small   56. Solved from the other end: 85 characters must fit, so
   *           fontSize <= 2 x 1260 / (85 x 0.511 x 1.03) = 56.3.
   *
   * The 1.03 is `CAPTION_WIDTH_SLACK`, folded in for the reason it exists — the
   * 0.511 advance is a mean and a line of wide glyphs runs past it. Here the
   * error is not merely cosmetic: this block has no third line to fall into.
   */
  onPicture: {
    largeMaxChars: 73,
    smallFontSize: 56,
    /** The annotation's, so the two devices cannot drift apart. */
    lineHeight: 1.37,
    letterSpacing: '0em',
    fontWeight: 300,
    color: OFF_WHITE,
  },
  /**
   * L3. RETIRED 2026-08-16 — see the box on `textCardTypeStep`.
   *
   * The card now takes `OVERLAY_SCRIM_GRADIENT`, the lower third's bottom-up
   * ramp, because its type moved to the lower left and a contrast guarantee has
   * to sit where the words are. Everything below is why THIS one was shaped the
   * way it was, and it is kept because the reasoning transfers if the full-frame
   * card ever comes back.
   *
   * It was the layer that actually made the headline legible.
   *
   * ##########################################################################
   * # DIRECTIONAL, BECAUSE THE TYPE IS LEFT-ALIGNED. The darkness sits where #
   * # the words are and lets the picture come back on the right, which is    #
   * # what stops it reading as a black box. Worst case — a pure white image  #
   * # under it — the headline still sits on ~0.9 alpha of #0B0B0C, which is  #
   * # roughly 10:1 against #F2EEE6. That number is the guarantee: grey type  #
   * # on a pale scan cannot happen again whatever the sourcing returns.      #
   * #                                                                        #
   * # 100deg rather than 90deg tips it very slightly off horizontal, so the  #
   * # ramp is not parallel to the frame edge and does not read as a band.    #
   * ##########################################################################
   */
  scrimGradient:
    'linear-gradient(100deg, rgba(11, 11, 12, 0.92) 0%, rgba(11, 11, 12, 0.82) 34%, ' +
    'rgba(11, 11, 12, 0.34) 62%, rgba(11, 11, 12, 0.1) 100%)',
  /** The exit lifts the whole block by this much as it fades. */
  exitTranslateY: -10,
  /**
   * THE SECOND TREATMENT, sent to the client beside the first.
   *
   * `spoken` keeps the per-word reveal the plate variant drops, so his note
   * about the overlays can be answered with two stills instead of a guess. It
   * takes the same rule, eyebrow, gradient and colour — only the headline
   * differs, so whichever he picks, everything else is already agreed.
   *
   * Lighter (500) and smaller (68px) on a wider measure than the plate, because
   * a word-by-word reveal is read while it is still arriving: the eye is
   * tracking a moving line rather than taking in a set block, and a 92px
   * semibold headline arriving one word at a time is a lot of ink in motion.
   */
  spoken: {
    fontSize: 68,
    fontWeight: 500,
    lineHeight: 1.12,
    letterSpacing: '-0.01em',
    blockWidth: 1360,
    revealFrames: 8,
    revealTranslateY: 12,
    /**
     * THE CLAMP, and it is the whole reason this variant is shippable.
     *
     * The reveal is keyed to real narration timings, so on a slow line the words
     * arrive one every twenty frames and the card reads as a teleprompter. Both
     * bounds are needed: capping the gap between two words alone still lets a
     * fourteen-word line run 56 frames, and capping the total alone lets a
     * two-word line hold an enormous gap in the middle of it.
     */
    maxStaggerFrames: 4,
    maxTotalStaggerFrames: 30,
  },
} as const

/**
 * Narration timings, re-spaced so the `spoken` headline cannot crawl.
 *
 * Takes each word's scene-relative `startFrame` and returns the frame it should
 * actually appear on, measured from the start of the headline. The first word is
 * always 0 — the card decides when the headline begins, not the narrator — and
 * from there each gap is capped at `maxStaggerFrames` and the whole run at
 * `maxTotalStaggerFrames`.
 *
 * IT ONLY EVER SPEEDS THE REVEAL UP. A line the narrator reads quickly keeps its
 * own rhythm, which is the point of syncing to narration in the first place; a
 * line read slowly is the failure case, because a card whose words appear every
 * twenty frames stops reading as a film and starts reading as a teleprompter.
 */
export function clampedRevealFrames(startFrames: readonly number[]): number[] {
  const { maxStaggerFrames, maxTotalStaggerFrames } = TEXT_CARD.spoken
  const out: number[] = []
  let cursor = 0

  for (let position = 0; position < startFrames.length; position += 1) {
    if (position > 0) {
      const current = startFrames[position]
      const previous = startFrames[position - 1]
      const gap =
        current === undefined || previous === undefined ? 0 : Math.max(0, current - previous)
      cursor = Math.min(cursor + Math.min(gap, maxStaggerFrames), maxTotalStaggerFrames)
    }
    out.push(cursor)
  }
  return out
}

/* --------------------------------------------------------- text overlay -- */

/**
 * MOUNT B — the short line set ON TOP of a real photograph.
 *
 * ##########################################################################
 * # THIS IS NOT THE TEXT CARD AND IT IS NOT A SECOND VISUAL LANGUAGE.      #
 * #                                                                        #
 * # The card is the FALLBACK: full frame, defocused backdrop, and it fires #
 * # only when a scene has no picture. This is an EDITORIAL DEVICE that     #
 * # names a beat on a scene that HAS one. So every value below is either   #
 * # taken from the TEXT_CARD block above or derived from it — the same     #
 * # gold, the same warm off-white, the same 64x2px rule, the same measure, #
 * # the same type scale and the same 20-frame entry.                       #
 * #                                                                        #
 * # TWO THINGS ARE THIS DEVICE'S OWN, and they are the two the card cannot #
 * # lend it: the MOUNT, because the card owns its whole frame and this sits#
 * # on a photograph, and the EXIT, because the card leaves when its scene  #
 * # ends and this one has to leave while the shot is still running. See    #
 * # `overlayChoreography` at the foot of this section.                     #
 * ##########################################################################
 *
 * The lower third is where it goes, and it is only free because captions ship
 * OFF (`CAPTIONS_ENABLED`, `apps/worker/src/env.ts` — the client waived them).
 * The planner refuses to emit an overlay on any scene that would also print a
 * caption band, so the two devices can never share a frame.
 */

/**
 * THE CARD'S SECOND STEP, AND NOT ITS FIRST.
 *
 * ##########################################################################
 * # 92px IS THE CARD'S HEADLINE SIZE, WHICH IS EXACTLY WHY IT IS WRONG     #
 * # HERE.                                                                  #
 * #                                                                        #
 * # The card is the FALLBACK and this is the editorial device, and the      #
 * # client's whole note was that the two had been confused. Set at the same #
 * # 92px, in the same 600 weight and the same off-white, they are the same  #
 * # typographic object and only the MOUNT tells them apart — which blurs    #
 * # the distinction again, from the other direction.                        #
 * #                                                                        #
 * # 72 is the card's own second step, so this is still one type scale and   #
 * # not two: 22% below the headline, which reads as a different rank at a   #
 * # glance, and 38% above the 52px captions, which is what keeps it from    #
 * # reading as a subtitle in a bigger size. The step below (58) is only 12% #
 * # over the caption size and would.                                       #
 * #                                                                        #
 * # IT ALSO CLOSES A REAL OVERFLOW. `OVERLAY_MAX_CHARS` is 26, and 26       #
 * # characters at 92px is 26 x 92 x 0.511 = 1222px of a 1260px measure — 3% #
 * # of slack. 0.511 is a MEAN, and `CAPTION_WIDTH_SLACK` above already      #
 * # records that a line of wide glyphs runs past it; 3% does not cover      #
 * # that. This block sets ONE line with `whiteSpace: nowrap`, so it does    #
 * # not wrap or shrink out of trouble the way the caption block does — it   #
 * # hangs off the right of the measure. At 72px the same 26 characters are  #
 * # 957px and the headroom is 24%.                                          #
 * ##########################################################################
 */
const OVERLAY_STEP = TEXT_CARD_TYPE_STEPS[1]

/**
 * How many characters of this face fit on ONE line of the card's measure.
 *
 * `textCardMaxChars` is the TWO-line capacity, so this is the same arithmetic
 * without the 2. It exists so `OVERLAY_MAX_CHARS` in `@vg/core/schemas` — the
 * bound the SEGMENTER writes to, three packages away — is a checkable claim
 * about this block rather than a number somebody once measured.
 *
 * THE TWO ARE NOT EQUAL AND MUST NOT BE. This block holds 34 characters; the
 * schema refuses anything past 26. The cap is the tighter of the two on purpose
 * — it comes from the client's "not long sentence text", not from the measure —
 * and the difference is the headroom that absorbs the error in a mean advance.
 */
export function overlayMaxChars(fontSize: number): number {
  return Math.floor(TEXT_CARD_BLOCK_WIDTH / (fontSize * CAPTION_MEAN_ADVANCE_EM))
}

/**
 * THE BOTTOM EDGE OF THE TEXT BLOCK, and the number that stops it reading as a
 * subtitle.
 *
 * 936, which is 36px above the 972 the caption block used
 * (`CAPTION.blockBottomY`). That gap is the whole point: type sitting exactly
 * where subtitles sit IS a subtitle whatever it says, and the client's note was
 * that the words should be part of the picture rather than a band under it.
 *
 * It also leaves 144px of clean frame below, which is where an 18px source
 * credit goes when there is one. Nothing is drawn there today; the space is
 * reserved so that adding it later does not move this block.
 */
const OVERLAY_BLOCK_BOTTOM_Y = 936

/** One line, so the block is one line box plus the rule and its gap. */
const OVERLAY_TEXT_HEIGHT = Math.round(OVERLAY_STEP.fontSize * OVERLAY_STEP.lineHeight)

/**
 * TWO TOPS, BECAUSE THERE ARE TWO TREATMENTS AND ONE BOTTOM EDGE.
 *
 * The block is pinned by its TOP (the component says why), so dropping the rule
 * in the `plain` treatment without moving the top would lift the line 36px and
 * put its bottom edge at 900 instead of 936. The bottom edge is the whole mount
 * decision, so it is the invariant and the top is derived per treatment:
 *
 *   plain   936 - 79                = 857
 *   rule    857 - 34 (gap) - 2      = 821
 *
 * `gapBelowBare`, not `gapBelow`. The overlay has no eyebrow — it IS the one
 * line — so it is the layout the card's bare-rule spacing was optically tuned
 * for: 34px reads the same under a headline as 20px does under a 20px eyebrow.
 */
const OVERLAY_TEXT_TOP_Y = OVERLAY_BLOCK_BOTTOM_Y - OVERLAY_TEXT_HEIGHT
const OVERLAY_BLOCK_TOP_Y = OVERLAY_TEXT_TOP_Y - TEXT_CARD.rule.gapBelowBare - TEXT_CARD.rule.height

/**
 * THE FACE'S CAP HEIGHT AS A FRACTION OF THE EM, HOISTED OUT OF `OVERLAY`.
 *
 * 0.756, MEASURED off a rendered PNG rather than read from the font tables — the
 * derivation and the 0.72 guess it corrected are documented on
 * `OVERLAY.fullFrame.capEm`, which now READS this rather than restating it, so
 * the two cannot drift.
 *
 * It moved up here for an ordering reason and not a tidiness one: the scrim
 * below is sized against the TALLEST block the lower third can produce, that
 * block is the annotation's two-line one, and its height cannot be known until
 * the annotation's font size is. `OVERLAY` cannot be read while `OVERLAY` is
 * still being built.
 */
const OVERLAY_CAP_EM = 0.756

/** The annotation's own two measurements. Both documented on `OVERLAY.note`. */
const OVERLAY_NOTE_CAP_FRACTION = 0.047
const OVERLAY_NOTE_LINE_HEIGHT = 1.37

/** Same cap-height derivation as the year. See `OVERLAY_CAP_EM` just above. */
export const OVERLAY_NOTE_FONT_SIZE = Math.round(
  (FRAME_HEIGHT * OVERLAY_NOTE_CAP_FRACTION) / OVERLAY_CAP_EM,
)

/**
 * ##########################################################################
 * # THE SCRIM IS SIZED AGAINST THE TALLEST BLOCK THIS MOUNT CAN PRODUCE,   #
 * # AND IT USED TO BE SIZED AGAINST THE SHORTEST.                          #
 * #                                                                        #
 * # `OVERLAY_BLOCK_TOP_Y` 821 is the top of a ONE-LINE block: rule, gap,   #
 * # one 72px line, bottom edge 936. That is right for `lowerThird`, which  #
 * # sets `whiteSpace: nowrap` and cannot be anything else. It is NOT right #
 * # for `note`, which is pinned by its BOTTOM at 936 and WRAPS, so a       #
 * # second line grows UPWARD:                                              #
 * #                                                                        #
 * #   line box   round(67 x 1.37)     = 92px                               #
 * #   two lines  936 - 2 x 92         = 752                                #
 * #                                                                        #
 * # 752 is 69px ABOVE the old plateau, which puts the whole of a two-line  #
 * # note's first line on the transparent part of the ramp — roughly 2:1    #
 * # over a bright photograph, under the 3:1 floor for large text.          #
 * #                                                                        #
 * # IT HAS NEVER FIRED, AND IT IS ABOUT TO. `OVERLAY_NOTE_MAX_CHARS` in    #
 * # @vg/core/schemas caps a note at 64 characters and the tool schema has  #
 * # been capping the model at 26, so every mark in the delivered film is   #
 * # one line and the defect was unreachable. That cap is being lifted, so  #
 * # the second line becomes real rather than theoretical.                  #
 * #                                                                        #
 * # `Math.min` rather than the note's number outright: the derivation      #
 * # states "whichever block is tallest", so if the one-line treatment ever #
 * # grows past the annotation the plateau follows it instead of quietly    #
 * # becoming the wrong bound again.                                        #
 * #                                                                        #
 * # THE CARD'S ON-PICTURE LINE IS COVERED BY THE SAME MOVE. `TextCard`     #
 * # pins its block at the identical `OVERLAY_NOTE_BOTTOM_INSET`, sets it   #
 * # at `OVERLAY_NOTE_FONT_SIZE` or 56 and wraps it to two lines, so its    #
 * # tallest block is this one or shorter.                                  #
 * ##########################################################################
 */
const OVERLAY_NOTE_LINE_BOX = Math.round(OVERLAY_NOTE_FONT_SIZE * OVERLAY_NOTE_LINE_HEIGHT)
const OVERLAY_NOTE_TWO_LINE_TOP_Y = OVERLAY_BLOCK_BOTTOM_Y - 2 * OVERLAY_NOTE_LINE_BOX
const OVERLAY_TALLEST_BLOCK_TOP_Y = Math.min(OVERLAY_BLOCK_TOP_Y, OVERLAY_NOTE_TWO_LINE_TOP_Y)

/**
 * A BOTTOM-UP GRADIENT, NEVER A BLUR AND NEVER A PER-FRAME FILTER.
 *
 * The card faced exactly this problem — type over a photograph nobody has
 * previewed — and solved it with a constant gradient rather than a backdrop
 * blur. Same reasoning here, plus one more: a `backdrop-filter` would have to be
 * re-rasterised as the Ken Burns move slides the picture underneath it, which is
 * a full-frame raster on every one of the film's 15,796 frames. See the box at
 * the top of Grade.tsx for what that costs on two cores.
 *
 * SIZED AGAINST THE TALLEST BLOCK, like `SCRIM` above. It is transparent one
 * margin above that block, reaches its plateau exactly at that block's top edge,
 * and holds from there to the frame edge — so the type never sits on the ramp.
 * ONE gradient serves every treatment on this mount rather than one each: the
 * `rule` block starts 36px above the `plain` one and the annotation's two-line
 * block starts 69px above that again, so sizing for the tallest covers all
 * three, and a second constant that only ever made the darkening smaller would
 * be a second thing to keep in step for no gain. See the box on
 * `OVERLAY_TALLEST_BLOCK_TOP_Y` for the derivation and for which block wins.
 *
 * ##########################################################################
 * # THE PLATEAU IS A CONTRAST GUARANTEE, NOT A TASTE, AND IT IS TWO        #
 * # NUMBERS BECAUSE THE LINE IS SET IN TWO COLOURS.                        #
 * #                                                                        #
 * # Worst case is a pure white photograph under it. 0.82 of #0B0B0C over    #
 * # #FFFFFF composites to sRGB (55, 55, 56), and against that ground, by    #
 * # the WCAG 2.1 relative-luminance formula:                                #
 * #                                                                        #
 * #   phrase  #F2EEE6  L 0.857 → (0.857 + 0.05) / (0.038 + 0.05) = 10.3:1  #
 * #   label   #C9A227  L 0.384 → (0.384 + 0.05) / (0.038 + 0.05) =  4.9:1  #
 * #                                                                        #
 * # 4.9 is the number that actually binds, and it is the gold label rather  #
 * # than the off-white phrase. It clears AA for body text (4.5) outright,   #
 * # and this is 72px semibold, which is "large text" by any definition —    #
 * # AAA there is 4.5. The plateau has very little room under it: 0.80 alpha #
 * # puts the label at 4.57:1 and 0.78 at 4.24:1, which is already under AAA.#
 * #                                                                        #
 * # Anywhere below the block top the ramp only gets darker (0.9 at the      #
 * # frame edge, where the same two colours read 13.5:1 and 6.5:1), so the   #
 * # plateau is the worst case for every pixel of type, not an average.      #
 * ##########################################################################
 */
const OVERLAY_SCRIM_TOP_Y = OVERLAY_TALLEST_BLOCK_TOP_Y - TEXT_CARD.margin

/**
 * 160, and it is NOT `TEXT_CARD.textX` (192).
 *
 * The card's indent is measured against a full-frame composition where the type
 * is the only object; this line sits on a photograph and is read against the
 * frame edge, so it is pulled 32px out to the same optical position. Both still
 * clear `SAFE_AREA_X`.
 *
 * HOISTED OUT OF `OVERLAY` so the corner mount below can take the identical
 * inset. A corner block indented by a second number that happened to match would
 * be two decisions, and the first person to nudge one of them would move half
 * the film's marks and not the other half.
 */
const OVERLAY_TEXT_X = 160

/* ---------------------------------------------------- the corner mount -- */

/**
 * ##########################################################################
 * # THE CORNER, AND IT IS A CONDITIONAL RULE WITH A FALLBACK RATHER THAN A #
 * # NEW HOME FOR EVERY MARK.                                               #
 * #                                                                        #
 * # The client's own reference frames set their captions bottom-left and   #
 * # top-right, and he asked for one "in the corner". A corner is only      #
 * # right when there IS a corner clear of the subject of the photograph;   #
 * # on a closeup there is not, and type dropped into one lands on a face.  #
 * # So this mount is chosen per shot and the delivered bottom block is     #
 * # what a shot falls back to. See `overlayPlacement` for the decision.     #
 * #                                                                        #
 * # AND HE ALREADY HAS THE BOTTOM-LEFT ONE. The delivered block IS         #
 * # bottom-left — 160 from the left edge, bottom edge 936, set from the    #
 * # left — so what this mount adds is the THREE corners that look could    #
 * # never reach. `OVERLAY_CORNER_ORDER` is three long for that reason.     #
 * ##########################################################################
 *
 * 760, and the ceiling is arithmetic rather than taste. The wash under a corner
 * block has to reach its plateau across the WHOLE block and then fall off over
 * at least the block's own width — a falloff narrower than the text it protects
 * puts the end of the line on the ramp, which is the lower third's old contrast
 * defect turned ninety degrees. That costs
 *
 *   insetX 160 + width + margin 96 + falloff (= width)
 *
 * of frame width, so `2 x width` may not exceed 1920 - 256 = 1664, i.e. width
 * may not exceed 832. 760 leaves 144px of frame beyond the wash and puts the far
 * edge of a left-hand block at 920 — 40px short of the frame centre, so the two
 * horizontal halves of this mount never cross.
 */
const OVERLAY_CORNER_BLOCK_WIDTH = 760

/**
 * A FIFTH OF THE MEASURE SPARE, WHICH IS THE SAME DISCIPLINE T-OV15 PINS ON THE
 * FULL-WIDTH BLOCK.
 *
 * `CAPTION_MEAN_ADVANCE_EM` is a MEAN and `CAPTION_WIDTH_SLACK` above already
 * records that a line of wide glyphs runs past it. The full-width block absorbs
 * that by holding 34 characters against a schema cap of 26, a ratio of 1.31.
 * This block is narrower, so the headroom cannot come from the gap to a cap that
 * was written for the other mount — it is folded into the capacity itself, and
 * `overlayCornerMaxChars` is the tighter answer that comes out.
 */
const OVERLAY_CORNER_HEADROOM = 1.2

/**
 * ##########################################################################
 * # HOW MUCH OF THE FRAME THE SUBJECT IS TAKEN TO OCCUPY, PER SHOT SCALE.  #
 * #                                                                        #
 * # `subjectAnchor` is a POINT and a photograph's subject is not. Without  #
 * # some estimate of its extent, "the corner furthest from the subject" is #
 * # satisfied by every corner on every picture — a point in a 1920x1080    #
 * # frame is always far from something — and the fallback branch this rule #
 * # is REQUIRED to have would be dead code that no still could reveal.     #
 * #                                                                        #
 * # `shotScale` is the extent estimate that is already on the record.      #
 * # These are radii as a fraction of the FRAME HEIGHT, so the subject is   #
 * # modelled as a disc of twice this across:                               #
 * #                                                                        #
 * #   closeup  0.46 -> 0.92 of the frame height. Fills it top to bottom.   #
 * #   medium   0.24 -> 0.48. About half the frame.                          #
 * #   wide     0.12 -> 0.24. A quarter, which is what "wide" means.         #
 * #                                                                        #
 * # MEASURED AGAINST THE FROZEN PLAN rather than left as taste. Over the   #
 * # 79 scored scenes of PLAN-v7-2026-08-16.json these send 44 scenes to a  #
 * # corner and 35 to the bottom block: all 29 wide shots take a corner,    #
 * # all 18 closeups fall back, and the 32 mediums split 15/17. Each of the #
 * # three corners `overlayCorners` offers is chosen by real scenes —       #
 * # topRight 24, topLeft 14, bottomRight 6. T-OV24b pins both branches.    #
 * #                                                                        #
 * # 44 OF 79 IS A COUNT OVER SCENES, NOT OVER MARKS, AND THE SECOND ONE IS #
 * # THE ONE THE CLIENT WATCHES. The v9 film carries 22 `note` marks, and   #
 * # on those the same rule reads 11 corners and 11 fallbacks — half, not   #
 * # 56%, because a mark is likelier than a scene to land on a closeup or   #
 * # to run past `overlayCornerMaxChars`. Quoted here so the flattering     #
 * # number cannot be the only one on the record.                           #
 * ##########################################################################
 */
const OVERLAY_SUBJECT_RADIUS_FRACTION = {
  wide: 0.12,
  medium: 0.24,
  closeup: 0.46,
} as const satisfies Record<ShotScale, number>

export const OVERLAY = {
  textX: OVERLAY_TEXT_X,
  blockBottomY: OVERLAY_BLOCK_BOTTOM_Y,
  /** Top of the `rule` treatment: rule, gap, line. */
  blockTopY: OVERLAY_BLOCK_TOP_Y,
  /** Top of the `plain` treatment: the line alone, same bottom edge. */
  textTopY: OVERLAY_TEXT_TOP_Y,
  /** The card's measure, unchanged — see the box above. */
  blockWidth: TEXT_CARD_BLOCK_WIDTH,
  fontSize: OVERLAY_STEP.fontSize,
  lineHeight: OVERLAY_STEP.lineHeight,
  /**
   * 300, AND IT USED TO BE 600. THE CLIENT ASKED FOR THE LIGHT ONE BY NAME.
   *
   * ##########################################################################
   * # HE POINTED AT HIS OWN 5:07 FRAME ON 2026-08-16 AND SAID TO USE THAT    #
   * # FACE FOR "THE IMPORTANT KEY LIKE DATES AND HIGHLIGHTED CONCEPT".       #
   * #                                                                        #
   * # That face is `OVERLAY.note` — weight 300, warm off-white — and it was  #
   * # already measured off the same reference and already shipping. The only #
   * # place a named thing was NOT set in it was this one, which drew a year  #
   * # or a name in gold at 600. So this is a routing change, not a new look. #
   * #                                                                        #
   * # 300 IS ON DISK. The comment that used to sit here said only 500 and    #
   * # 600 were, and that stopped being true when `LibreFranklin-Variable`    #
   * # was added for the 2026-08-15 build — `FACES` in fonts.ts registers 300 #
   * # and 800 from it with single-value weight descriptors. Two other        #
   * # comments in this file made the same stale claim and are corrected too. #
   * ##########################################################################
   *
   * The gold has not left the film. It is still the 64x2px hairline rule and
   * still the card's eyebrow, which are MARKS. What changed is that it is no
   * longer used to set WORDS, which is the distinction his two reference frames
   * draw and the one this device had backwards.
   */
  fontWeight: 300,
  /**
   * A YEAR AND A NAME ARE LABELS; A PHRASE IS A HEADLINE — AND AFTER THE WEIGHT
   * CHANGE ABOVE, TRACKING IS THE ONLY THING LEFT THAT SEPARATES THEM.
   *
   * That is deliberate rather than a loss. `OVERLAY_STEP` carries NEGATIVE
   * tracking, which is right for a phrase and wrong for "100 BCE": figures are
   * drawn on a fixed advance and closing them up turns a date into a single
   * mark. A label takes a slightly positive value instead.
   *
   * The colours are now the same because he asked for them to be. Keeping the
   * `kind` split alive with one property rather than three is the smallest thing
   * that still honours the distinction the card learned the hard way, and it
   * keeps `overlay.kind` load-bearing — so the segmenter's classification still
   * changes pixels, and a future decision to re-separate them has somewhere to
   * land.
   */
  label: {
    color: TEXT_CARD.headlineColor,
    letterSpacing: '0.02em',
  },
  phrase: {
    color: TEXT_CARD.headlineColor,
    letterSpacing: OVERLAY_STEP.letterSpacing,
  },
  /**
   * STYLE `plate` — THE TITLE, and it no longer draws a plate.
   *
   * ##########################################################################
   * # THE NAME IS A SCAR. `plate` IS STILL WHAT THE SEGMENTER WRITES AND     #
   * # WHAT EVERY STORED ARTIFACT CONTAINS, SO THE STRING CANNOT MOVE.        #
   * #                                                                        #
   * # `readArtifact` treats a parse failure as a cache MISS, so removing a   #
   * # value from `OverlayStyleSchema` would re-source and re-bill every job  #
   * # ever run. Changing what the string DRAWS costs one bundle. Changing    #
   * # the string itself costs the corpus. See the box on that enum.          #
   * ##########################################################################
   *
   * WHAT IT USED TO BE, AND WHY HE REJECTED IT. The picture held inside a
   * 1131x742 box on pure black with a 50px caption 80px under it. On a 16:9
   * photograph that draws 1131x636, which is 34.7% of the frame — so 65% of the
   * shot was black, and the caption sat a tenth of the frame away from the thing
   * it was naming. He is right on the arithmetic. `crop.ts` already records him
   * stopping the film at 0:02:23 on the same geometry one layer down.
   *
   * ##########################################################################
   * # MEASURED OFF THE FRAME HE SENT ON 2026-08-16 AND NORMALISED, the same  #
   * # way the year and the note were, so a windowed-player screenshot still  #
   * # yields numbers that transfer to 1080p:                                 #
   * #                                                                        #
   * #   cap height    12.8% of frame height  (92px of a 718px frame)         #
   * #   line spacing  1.17em                 (143px between line tops)       #
   * #   widest line   78.7% of frame width   (1013px of 1287px, two lines)   #
   * #   centre        50.5% of frame height, so essentially the true middle  #
   * #   weight        heavy — 800 is what is on disk, see fonts.ts FACES     #
   * #   ground        THE PHOTOGRAPH, full frame, still moving               #
   * ##########################################################################
   *
   * ##########################################################################
   * # TWO SIZES, AND WHICH ONE DRAWS IS DECIDED BY WHETHER THE TITLE FITS.   #
   * #                                                                        #
   * # THIS BLOCK IS NOW THE FALLBACK. `overlayTitleSetting` sets a title that #
   * # clears `overlayFitsFullFrame` at the YEAR's 36% of the frame height,    #
   * # because that is what the client's reference is and what he sent his     #
   * # note about — same family, same weight 800, same colour, a 389px cap     #
   * # instead of a 137px one. The film's title is "4Q204", five characters,   #
   * # so the film he is looking at takes that path.                           #
   * #                                                                        #
   * # EVERY NUMBER BELOW STILL DRAWS, AND MUST. A six-character title at      #
   * # font-size 515 would run past both frame edges with `whiteSpace: nowrap` #
   * # under it, so it falls back to this treatment: 12.8% of the frame,       #
   * # wrapping to at most two lines. Nothing existed between the retired      #
   * # plate caption at 50px and the year at 515px, which is why the opening   #
   * # shot used to have to borrow one of them and looked wrong either way.    #
   * ##########################################################################
   */
  title: {
    /**
     * 0.1271, AND IT TOOK THREE RENDERS TO GET HERE. THE MIDDLE ONE IS THE
     * LESSON.
     *
     * ##########################################################################
     * # WHAT IS BEING MATCHED. His band measures 92px in a 718px frame, which  #
     * # normalises to 138.4px at 1080. That band runs ASCENDER top to          #
     * # baseline, not cap to baseline — Libre Franklin's h, b and d stand      #
     * # above its capitals and "Chamber Record" carries three of them — so it  #
     * # is compared against the SAME measurement on our own render rather      #
     * # than converted into a true cap height on either side.                  #
     * #                                                                        #
     * # ROUND 1: 0.128 rendered a 145px band. Read as 4.7% too large.          #
     * # ROUND 2: corrected to 0.1222, which rendered 133px — now 4% too SMALL. #
     * #                                                                        #
     * # ####################################################################   #
     * # # THE ROUND-1 MEASUREMENT WAS TAKEN THROUGH A BUG.                 #   #
     * # #                                                                  #   #
     * # # `titleScale` at that point settled on `overshoot` instead of 1,  #   #
     * # # so the title held at 1.04 for the whole shot and every still was #   #
     * # # 4% oversized. The 145px was really 139.4px of type inside a      #   #
     * # # 1.04 transform, which against his 138.4 is 0.7% out, not 4.7%.   #   #
     * # #                                                                  #   #
     * # # MEASURE THE SETTLED FRAME, AND CHECK IT IS SETTLED. A still from #   #
     * # # inside an entry window is a measurement of the animation, not of #   #
     * # # the design. Frame 60 and frame 40 now agree to the pixel, which  #   #
     * # # is the cheap way to prove it.                                    #   #
     * # ####################################################################   #
     * #                                                                        #
     * # ROUND 3: 0.128 x 138.4/139.4 = 0.1271. Renders a 137px band, 12.7% of  #
     * # the frame against his 12.8%.                                           #
     * ##########################################################################
     */
    capFractionOfFrame: 0.1271,
    /**
     * The measure, as a fraction of the frame. His widest line runs 78.7%, and
     * the block is CENTRED rather than indented, so this is a bound on the wrap
     * and not a left edge. It clears `SAFE_AREA_X` on both sides by 108px.
     */
    blockWidthFraction: 0.787,
    /**
     * 1.19, corrected from 1.17 off the same render.
     *
     * Measured as a RATIO rather than in pixels, because the pixel gap moves
     * with the size correction above and the ratio does not. His frame runs
     * 143px between line tops against a 92px band, so 1.554; the first render
     * came back at 221 against 145, so 1.524. 1.17 x 1.554/1.524 = 1.193.
     */
    lineHeight: 1.19,
    /**
     * 800, from the variable file. `fonts.ts` registers it with a single-value
     * `weight` descriptor so the `wght` axis is really pinned — asking for a
     * weight that is not registered synthesises in one browser and falls back in
     * another, and `loadEverything` fails SOFT, so it would reach a two-hour
     * render with nothing red anywhere.
     */
    fontWeight: 800,
    color: TEXT_CARD.headlineColor,
    /**
     * His title carries no visible tracking. The year's -0.03em is a figure fix.
     *
     * ##########################################################################
     * # NOT CHANGED WHEN THE LARGE PATH LANDED, AND THAT IS A DELIBERATE       #
     * # DEFERRAL RATHER THAN AN OVERSIGHT.                                     #
     * #                                                                        #
     * # A title drawn large is the year's SIZE, and the year also carries      #
     * # -0.03em. Taking that too would be a second variable inside the one     #
     * # change the client is about to look at, and -0.03em is 3% of the width  #
     * # of the line — invisible next to a 183% size change, and impossible to  #
     * # attribute if he says the frame is not right. The year's tracking is a  #
     * # FIGURE fix (lining figures are drawn on one fixed generous advance);   #
     * # whether a title wants it is a separate question with its own answer.   #
     * #                                                                        #
     * # If it is ever taken, the year's `marginRight` cancel has to come with  #
     * # it — see `OVERLAY.fullFrame.letterSpacingEm` for why a centred box     #
     * # with trailing letter-spacing lands the glyphs half a step off.         #
     * ##########################################################################
     */
    letterSpacingEm: 0,
    /**
     * +0.009, MEASURED OFF A RENDERED PNG RATHER THAN REASONED. Positive is DOWN.
     *
     * The year needed -0.048 because ITS container centre and glyph centre
     * differ at `lineHeight: 1` on a line with no descenders. A two-line block
     * at 1.19 carrying a descender has a different discrepancy again and it runs
     * the other way, which is exactly why this was set to 0, rendered and
     * corrected rather than derived from the year's number.
     *
     * The arithmetic: his two bands centre at 42.3% and 60.4% of the frame
     * height, so his block centres at 51.35%. At 0 the render came back at
     * 41.1% and 59.8%, so 50.45%. The difference is 0.9% of the frame.
     *
     * ##########################################################################
     * # THE LARGE PATH DOES NOT TAKE THIS NUMBER. IT TAKES THE YEAR'S -0.048,  #
     * # AND MIXING THEM UP WOULD PUT THE TITLE 62px OFF ITS CENTRE.            #
     * #                                                                        #
     * # These two offsets are measurements of two different BLOCKS, not two    #
     * # tastes. +0.009 was measured off a rendered PNG of a TWO-LINE 181px      #
     * # block at lineHeight 1.19 carrying a descender. -0.048 was measured off  #
     * # a ONE-LINE 515px block with no descenders. A title drawn large is       #
     * # literally the second of those — same face, same weight, same size, one  #
     * # line — so `overlayTitleSetting` hands the component the year's number   #
     * # and this one goes on serving the fallback treatment it was measured on. #
     * #                                                                        #
     * # THE LEADING DOES NOT HAVE TO COME WITH IT. Half-leading is split evenly #
     * # above and below a line box, so a SINGLE line's glyphs sit at the centre #
     * # of that box whatever the line-height is. The large path keeps 1.19 and  #
     * # is centred identically to the year at 1.0, which is why only the offset #
     * # is borrowed and not the whole type block.                               #
     * ##########################################################################
     */
    centreOffsetFraction: 0.009,
    /**
     * 0.52. IT WAS 0.32, THEN 0.58, AND THE COMMENT THAT JUSTIFIED 0.58 CLAIMED
     * MORE THAN IT HAD MEASURED. THAT CORRECTION IS THE FIRST THING HERE.
     *
     * ##########################################################################
     * # WHAT THE OLD COMMENT SAID: that "4Q204" in #F2EEE6 over 0.32 of        #
     * # #0B0B0C, on scene 0's bright cream manuscript page, "measured 2.4:1. It #
     * # read as a watermark."                                                   #
     * #                                                                        #
     * # THE FIRST SENTENCE IS RIGHT AND THE SECOND IS NOT EVIDENCE. That frame  #
     * # was pulled 58% of the way through the mark's EXIT FADE, so what was     #
     * # read was type at roughly half opacity. It is a measurement of the       #
     * # animation, not of the design — the same trap the round-1 cap-height     #
     * # measurement above fell into, and it is recorded here as a correction    #
     * # owed rather than quietly deleted.                                       #
     * #                                                                        #
     * # WHAT IS TRUE WITHOUT THAT FRAME, and it is enough on its own: 0.32 is   #
     * # UNDER-SPECIFIED against the pure white photograph this scrim is sized   #
     * # for. #F2EEE6 over 0.32 of #0B0B0C on pure white is 1.85:1, and AA for   #
     * # large text is 3:1. No still is needed to see that; it is arithmetic     #
     * # about the worst case, which is the only case a device nobody previews   #
     * # the picture under can be designed to.                                   #
     * ##########################################################################
     *
     * ##########################################################################
     * # AND THE "A THIRD OF THE INK" ARGUMENT NO LONGER SEPARATES THE TWO      #
     * # DEVICES, BECAUSE THE TITLE NOW DRAWS AT THE YEAR'S SIZE WHEN IT FITS.  #
     * #                                                                        #
     * # 0.58 was reasoned from 137px of cap against the year's 389px. The film's#
     * # own title is "4Q204", five characters, which clears                    #
     * # `overlayFitsFullFrame` — so it is set at 389px of cap, on the same flat #
     * # wash, in the same colour and weight. Two devices drawing the same       #
     * # letters at the same size cannot want different washes.                  #
     * #                                                                        #
     * # SO BOTH SIT AT 0.52, AND THEY ARE STILL TWO CONSTANTS. Sharing a value  #
     * # is not sharing a decision: the fallback treatment really is 137px and   #
     * # may want its own number again, and `OVERLAY_TITLE_DIM` is still built   #
     * # from this key rather than from the year's.                              #
     * #                                                                        #
     * #   a = 0.32  ->  1.85:1   under AA-large                                 #
     * #   a = 0.50  ->  3.19:1                                                  #
     * #   a = 0.52  ->  3.41:1   AA-large with margin                           #
     * #   a = 0.58  ->  4.19:1                                                  #
     * #                                                                        #
     * # 0.52 IS THE MOST PHOTOGRAPH THAT STILL CLEARS THE FLOOR. "More of the   #
     * # picture" is the client's standing request and his own reference frame   #
     * # carries almost no wash at all, which is exactly why ours reads murky    #
     * # beside his. 0.58 buys AAA-adjacent contrast nobody asked for and costs  #
     * # six points of the one shot he most wants to see.                        #
     * #                                                                        #
     * # THE ARITHMETIC IS PINNED BY A TEST rather than left in this comment,    #
     * # so lowering it fails rather than ships. See T-TI6 in title.test.ts,     #
     * # and T-TI6c for the year's twin of it.                                   #
     * ##########################################################################
     *
     * Flat rather than a radial pool of darkness, which was tried on paper and
     * dropped: a two-line title runs to 78% of the frame width, so the ends of
     * the lines sit far enough out that any ellipse tight enough to spare the
     * corners leaves them at about 2:1. Even darkening is worse for the picture
     * and better for the words, and the words are the device.
     */
    dimAlpha: 0.52,
    /**
     * THE ENTRY, AND IT IS A DELIBERATE REVERSAL OF THE RULE ON `FullFrameYear`.
     *
     * That component's box says type must scale DOWN into place, because type
     * that grows reads as a title animation and type that settles reads as a
     * mark being placed. Both halves of that are true. This IS a title, it fires
     * exactly once at 0:00, and the client asked for the growing one by name.
     * The rule still governs every other device in the film.
     *
     * 0.90 up through 1.04 and back to 1.00. Transform and opacity only — see
     * the cost note at the top of Grade.tsx for why an animated `filter` or
     * `fontSize` is the banned shape.
     */
    fromScale: 0.9,
    overshoot: 1.04,
  },

  /**
   * STYLE `note` — the client's 2026-08-15 reference at 5:07-5:10, the one he
   * asked us to "copy the text font and the in-motion" from.
   *
   * ##########################################################################
   * # MEASURED OFF HIS FRAME AND NORMALISED TO FRACTIONS OF THE FRAME:       #
   * #   cap height   4.7% of frame height  (33px of a 695px frame)           #
   * #   line height  1.37em                (60px between baselines)          #
   * #   weight       LIGHT, which is the whole visual difference from v5      #
   * ##########################################################################
   *
   * WHAT IS DELIBERATELY NOT COPIED, and it is one thing. His reference sets the
   * block about 2.5% of the frame width from the left edge, which is 48px — well
   * INSIDE the 96px title-safe area. That is fine on a phone and wrong on a
   * deliverable, and he asked for the font and the motion, not the position. The
   * block keeps `textX` and `blockBottomY`, so what changes here is exactly what
   * he named and nothing else.
   */
  note: {
    /**
     * Same derivation as the year: a drawn cap height, not an em box.
     *
     * Declared above `OVERLAY` as `OVERLAY_NOTE_CAP_FRACTION` and read back
     * here, because `OVERLAY_NOTE_FONT_SIZE` has to exist before the scrim is
     * derived. One number, two readers.
     */
    capFractionOfFrame: OVERLAY_NOTE_CAP_FRACTION,
    /** LIGHT. This is what makes it read as an annotation rather than a label. */
    fontWeight: 300,
    color: TEXT_CARD.headlineColor,
    letterSpacing: '0em',
    /** Hoisted for the same reason as the cap fraction above. */
    lineHeight: OVERLAY_NOTE_LINE_HEIGHT,
    /**
     * TWO, AND NOTHING READS THIS. IT IS A NOTE, NOT A BOUND.
     *
     * ######################################################################
     * # NO CODE ANYWHERE READS `OVERLAY.note.maxLines`. Grepped, 2026-08-16 #
     * # — every other hit in the repo is a comment or `CAPTION.maxLines`,   #
     * # which is a different key on a different object and IS read, by      #
     * # `buildCaptionPhrases`. The two-line ceiling on this device is       #
     * # enforced by `OVERLAY_NOTE_MAX_CHARS` (64) in @vg/core/schemas and   #
     * # by nothing else. Raise that bound and a third line appears; this    #
     * # constant will not stop it and never could.                          #
     * ######################################################################
     *
     * AND THE ARITHMETIC IT USED TO CARRY WAS OFF BY ONE LINE. It said a
     * THIRD line "would climb to y=750". `blockBottomY` pins the bottom at 936
     * and a line box here is round(67 x 1.37) = 92px, so:
     *
     *   two lines    936 - 184 = 752
     *   three lines  936 - 276 = 660
     *
     * A TWO-line block already reaches 752, which is where the old comment
     * placed three. That is not a rounding slip, it is the number the scrim was
     * sized against — see the box on `OVERLAY_TALLEST_BLOCK_TOP_Y`, which is
     * what actually defends the edge now.
     */
    maxLines: 2,
  },

  /**
   * STYLE `fullFrame` — the client's 2026-08-15 reference, measured off the frame
   * he sent rather than designed from scratch.
   *
   * ##########################################################################
   * # EVERY NUMBER HERE WAS TAKEN OFF HIS REFERENCE FRAME AND NORMALISED TO  #
   * # A FRACTION OF THE FRAME, so it survives the fact that the screenshot   #
   * # was of a windowed player rather than a 1920x1080 file.                 #
   * #                                                                        #
   * #   cap height   36.0% of frame height  (256px of a 710px frame)         #
   * #   block width  63.4% of frame width   (806px of 1272px, for 4 digits)  #
   * #   centre       5.5% of frame height ABOVE the frame's own centre       #
   * #   tracking     advance/size came to 0.55em against a normal ~0.58,     #
   * #                so the reference carries about -0.03em                  #
   * ##########################################################################
   *
   * This is the ONE place in the compositor that sets type over the middle of a
   * photograph, so it cannot borrow the lower third's gradient — see `dimAlpha`.
   */
  fullFrame: {
    /**
     * DERIVED FROM A CAP HEIGHT, NOT TYPED AS A FONT SIZE, because the reference
     * is a measurement of drawn letters and `fontSize` is an em box that no
     * glyph fills. `capEm` is the fraction of the em that Libre Franklin's
     * capitals and lining figures actually occupy.
     *
     * `capEm` IS VERIFIED BY RENDERING, NOT BY READING THE FONT TABLES. The still
     * loop draws the year, the drawn height is measured off the PNG, and this
     * constant is corrected until it agrees. A wrong value here is invisible in
     * every test and obvious in one frame.
     */
    capFractionOfFrame: 0.36,
    /**
     * 0.756, MEASURED off a rendered frame, not read from the font tables.
     *
     * The first pass here guessed 0.72 from the usual grotesque range, which set
     * the year 5% too large — 408px of drawn cap against the 389px the reference
     * carries, and 67.1% of the frame width against its 63.4%. Rendering "1947"
     * at a known `fontSize` and dividing the drawn height by it is what produced
     * the real number. Re-measure if the family or the weight ever changes.
     *
     * Declared above `OVERLAY` as `OVERLAY_CAP_EM` and read back here, because
     * the annotation's size is derived from it and has to exist before the scrim
     * does. It is a property of the FACE rather than of this device, which is
     * also why the title borrows it.
     */
    capEm: OVERLAY_CAP_EM,
    fontWeight: 800,
    color: TEXT_CARD.headlineColor,
    /**
     * A NUMBER IN EM, NOT A CSS STRING, because the component needs it twice
     * with opposite signs.
     *
     * `letter-spacing` is applied after EVERY character including the last, so
     * the box is one whole step wider than the glyphs it contains. Centre that
     * box and the glyphs land half a step off — measured at 8.5px right of the
     * frame centre, which is small in the abstract and not small on a figure
     * 389px tall. The component cancels it with an equal and opposite
     * `marginRight`, which is the standard fix and needs the raw number.
     */
    letterSpacingEm: -0.03,
    /**
     * Optically centred. The reference puts the DRAWN glyphs 5.5% of the frame
     * height above the true middle, and a block of type centred by arithmetic
     * always reads as sitting low, because the eye centres on the mass of the
     * letters rather than on the em box.
     *
     * -0.048 RATHER THAN -0.055, and the difference is not a rounding slip. This
     * offset moves the CONTAINER; the reference measures the GLYPHS. At
     * `lineHeight: 1` with a line that has no descenders, the drawn figures
     * already sit about 8px above the container's own centre, so translating by
     * the full 5.5% overshot to a measured -6.2%. Verified by re-rendering.
     */
    centreOffsetFraction: -0.048,
    /**
     * A FLAT DIM, NOT A GRADIENT, and not a `backdrop-filter`.
     *
     * The lower-third scrim is a bottom-up gradient sized to a block that sits at
     * y=936; this type sits across the middle of the frame, where that gradient
     * is fully transparent. A second gradient shaped for the centre would darken
     * the subject of the photograph, which is the one thing the client has asked
     * for more of. A flat, constant, low-alpha wash costs the picture a little
     * contrast everywhere and guarantees the figure reads over any image.
     *
     * Constant string, like every other filter here, so Chrome rasterises it once
     * per segment rather than once per frame.
     *
     * ##########################################################################
     * # 0.52, AND IT WAS 0.32 UNTIL 2026-08-16. 0.32 WAS UNDER THE FLOOR.      #
     * #                                                                        #
     * # Against a pure white photograph — the worst case the lower third's own #
     * # scrim is sized for, and the only honest one for a device nobody        #
     * # previews the picture under — #F2EEE6 over 0.32 of #0B0B0C reads        #
     * # 1.85:1. AA for large text is 3:1, so this device has been sitting      #
     * # under the floor for its whole life.                                    #
     * #                                                                        #
     * # IT HAS NEVER BEEN SEEN, WHICH IS WHY NOTHING CAUGHT IT. The segmenter  #
     * # has never chosen `fullFrame` on a real job, so the year has never      #
     * # reached a frame. It is going live twice over: the title now draws at   #
     * # this device's geometry when it fits, and the plan stage is about to    #
     * # place the year deterministically.                                      #
     * #                                                                        #
     * #   a = 0.32  ->  1.85:1   under AA-large                                #
     * #   a = 0.50  ->  3.19:1                                                 #
     * #   a = 0.52  ->  3.41:1   AA-large with margin                          #
     * #   a = 0.58  ->  4.19:1                                                 #
     * #                                                                        #
     * # 0.52 IS THE MOST PHOTOGRAPH WE CAN SHOW AND STILL CLEAR THE FLOOR,     #
     * # which is the trade the client has asked for by name — his own          #
     * # reference frame carries almost no wash at all, and that difference is  #
     * # exactly why ours reads murky beside his. The arithmetic is pinned by   #
     * # T-TI6c in title.test.ts rather than left in this comment, so lowering  #
     * # it fails rather than ships.                                            #
     * ##########################################################################
     */
    dimAlpha: 0.52,
    /** Entry scale. Transform only — never `width`, never `filter`. */
    fromScale: 1.05,
  },
  scrim: {
    /**
     * Distance from the FRAME BOTTOM, because the gradient is drawn `to top`.
     *
     * THE TALLEST BLOCK, NOT `blockTopY`. It was `blockTopY` while `lowerThird`
     * was the only thing this mount drew; the annotation wraps and grows upward
     * past it. See the box on `OVERLAY_TALLEST_BLOCK_TOP_Y`.
     */
    plateauFromBottom: FRAME_HEIGHT - OVERLAY_TALLEST_BLOCK_TOP_Y,
    startFromBottom: FRAME_HEIGHT - OVERLAY_SCRIM_TOP_Y,
    plateauAlpha: 0.82,
    endAlpha: 0.9,
  },

  /**
   * THE CORNER MOUNT. Geometry only — the wash's colours are the scrim's, read
   * from the object above where the gradient strings are built, so a change to
   * the plateau alpha cannot make one mount legible and the other not.
   */
  corner: {
    /** The same indent the full-width block takes. See `OVERLAY_TEXT_X`. */
    insetX: OVERLAY_TEXT_X,
    /**
     * 144, AND IT IS THE BOTTOM EDGE MIRRORED RATHER THAN A SECOND NUMBER.
     *
     * The delivered block's bottom edge sits 144px off the frame bottom
     * (`OVERLAY_NOTE_BOTTOM_INSET` is the same subtraction). A top corner is
     * that block reflected, so its top edge sits 144px off the frame top and
     * the film has ONE distance from a frame edge to a mark rather than two.
     *
     * It is also what makes the wash below work out to one depth: the plateau
     * has to reach `insetY + blockHeight` from the top and
     * `FRAME_HEIGHT - tallestBlockTop` from the bottom, and those are the same
     * arithmetic read from the two ends.
     */
    insetY: FRAME_HEIGHT - OVERLAY_BLOCK_BOTTOM_Y,
    blockWidth: OVERLAY_CORNER_BLOCK_WIDTH,
    /**
     * THE TALLEST BLOCK THIS MOUNT CAN DRAW, which is the two-line annotation —
     * the same block the full-width scrim is sized against, and for the same
     * reason. `overlayFitsCorner` is expected to keep a corner mark to one line,
     * but it decides with a MEAN advance, and a line of wide glyphs that wraps
     * anyway must not land on the ramp. Sizing for two lines makes the contrast
     * guarantee unconditional instead of conditional on an estimate.
     */
    blockHeight: OVERLAY_BLOCK_BOTTOM_Y - OVERLAY_TALLEST_BLOCK_TOP_Y,
    measureHeadroom: OVERLAY_CORNER_HEADROOM,
    subjectRadiusFraction: OVERLAY_SUBJECT_RADIUS_FRACTION,
    wash: {
      /**
       * Distance from the frame edge the wash is anchored to, in both axes.
       *
       * VERTICAL: the plateau reaches the far edge of the tallest block, then
       * ramps to nothing over one margin — byte for byte the full-width scrim's
       * own two numbers, read from whichever edge this corner sits on.
       */
      plateauFromEdge: FRAME_HEIGHT - OVERLAY_TALLEST_BLOCK_TOP_Y,
      startFromEdge: FRAME_HEIGHT - OVERLAY_SCRIM_TOP_Y,
      /**
       * HORIZONTAL, AND THIS IS THE PAIR A FIRST ATTEMPT AT THIS DEVICE GOT
       * WRONG.
       *
       * The plateau has to clear the whole block plus a margin, and the falloff
       * after it has to be AT LEAST AS WIDE AS THE BLOCK. A falloff narrower
       * than the text puts the far end of the line on the ramp, at less than the
       * plateau alpha, which is the lower third's old contrast defect rebuilt on
       * the other axis — and it is invisible in a still of a SHORT mark, because
       * a short mark never reaches the ramp.
       *
       *   plateau  160 + 760 + 96      = 1016
       *   start    1016 + 760          = 1776   (144px of frame left over)
       */
      plateauFromSide: OVERLAY_TEXT_X + OVERLAY_CORNER_BLOCK_WIDTH + TEXT_CARD.margin,
      startFromSide:
        OVERLAY_TEXT_X + 2 * OVERLAY_CORNER_BLOCK_WIDTH + TEXT_CARD.margin,
    },
  },
} as const

/**
 * The gradient string, built once at module load.
 *
 * A CONSTANT, like every other filter and gradient in this compositor. It does
 * not depend on the frame, on the scene or on the picture, so Chrome rasterises
 * it once per segment instead of once per frame.
 */
export const OVERLAY_SCRIM_GRADIENT = [
  'linear-gradient(to top,',
  `rgba(11, 11, 12, ${String(OVERLAY.scrim.endAlpha)}) 0px,`,
  `rgba(11, 11, 12, ${String(OVERLAY.scrim.plateauAlpha)}) ${String(OVERLAY.scrim.plateauFromBottom)}px,`,
  `rgba(11, 11, 12, 0) ${String(OVERLAY.scrim.startFromBottom)}px)`,
].join(' ')

/* ------------------------------------------------- the corner wash, derived -- */

/**
 * ##########################################################################
 * # THE CORNER WASH IS THE SAME RAMP AS THE SCRIM, TURNED TOWARD ITS OWN   #
 * # EDGE AND THEN MASKED SO IT STOPS.                                      #
 * #                                                                        #
 * # ONE RAMP, TWO DIRECTIONS. The stops are built once here so a bottom    #
 * # corner and a top corner cannot drift into two washes that are nearly   #
 * # the same — which is the failure the whole overlay header warns about.  #
 * #                                                                        #
 * # THE MASK IS A MULTIPLY, AND THAT IS WHY THE CONTRAST ARITHMETIC IS     #
 * # UNCHANGED. Stacking a second semi-transparent gradient would give      #
 * # 1-(1-a)(1-b) — a corner darker than the plateau anyone reasoned about. #
 * # A mask multiplies the ramp's alpha by the mask's, and the block sits   #
 * # inside the mask's own opaque plateau, so under the type the product is #
 * # 1 x 0.82 = exactly the number T-OV17d already computes 10.3:1 from.    #
 * #                                                                        #
 * # AND IT FAILS SAFE. If a renderer ever ignored `mask-image`, the ramp   #
 * # draws full width — the delivered scrim, on the wrong edge for a top    #
 * # corner. That is more ink on the photograph than intended and never     #
 * # less, so the legibility floor holds even when the mask does not.       #
 * ##########################################################################
 */
const OVERLAY_CORNER_WASH_STOPS = [
  `rgba(11, 11, 12, ${String(OVERLAY.scrim.endAlpha)}) 0px,`,
  `rgba(11, 11, 12, ${String(OVERLAY.scrim.plateauAlpha)}) ${String(OVERLAY.corner.wash.plateauFromEdge)}px,`,
  `rgba(11, 11, 12, 0) ${String(OVERLAY.corner.wash.startFromEdge)}px)`,
].join(' ')

/** A corner on the frame's bottom edge. The delivered scrim's own direction. */
export const OVERLAY_CORNER_WASH_UP = `linear-gradient(to top, ${OVERLAY_CORNER_WASH_STOPS}`

/** A corner on the frame's top edge. The same ramp, reflected. */
export const OVERLAY_CORNER_WASH_DOWN = `linear-gradient(to bottom, ${OVERLAY_CORNER_WASH_STOPS}`

/**
 * The horizontal stop, as a MASK rather than as a second wash. See the box
 * above for why the distinction is the contrast guarantee and not a technique.
 *
 * Black is "keep" and transparent is "drop": a mask sourced from a gradient is
 * read through its ALPHA channel, which is what both the unprefixed and the
 * `-webkit-` forms do by default. The colour is irrelevant and is written black
 * only so the string reads as a mask rather than as something paintable.
 */
const OVERLAY_CORNER_MASK_STOPS = [
  '#000 0px,',
  `#000 ${String(OVERLAY.corner.wash.plateauFromSide)}px,`,
  `transparent ${String(OVERLAY.corner.wash.startFromSide)}px)`,
].join(' ')

/** A corner on the frame's left edge: kept at the left, dropped toward the right. */
export const OVERLAY_CORNER_MASK_FROM_LEFT = `linear-gradient(to right, ${OVERLAY_CORNER_MASK_STOPS}`

/** A corner on the frame's right edge. */
export const OVERLAY_CORNER_MASK_FROM_RIGHT = `linear-gradient(to left, ${OVERLAY_CORNER_MASK_STOPS}`

/* --------------------------------------------------------- where a mark sits -- */

/**
 * The four corners of the FRAME, plus the delivered full-width block.
 *
 * GEOMETRY, NOT THE MENU. All four are real rectangles and `overlayCornerRect`
 * answers for each of them; only three are offered to `overlayPlacement`, and
 * `overlayCorners` below is the list that decides a shot. `bottomLeft` is
 * deliberately in the type and out of the list — see the box on
 * `OVERLAY_CORNER_ORDER` for why, and `overlayPlacementMovesType` for the
 * property that keeps the two in step.
 */
export type OverlayCorner = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'
export type OverlayPlacement = 'bottom' | OverlayCorner

/**
 * ##########################################################################
 * # THREE, NOT FOUR, BECAUSE `bottomLeft` IS NOT A PLACE — IT IS A SECOND  #
 * # NAME FOR THE ONE THE FALLBACK ALREADY DRAWS.                           #
 * #                                                                        #
 * # The delivered block sits `OVERLAY.textX` 160 from the left edge with   #
 * # its bottom edge at `OVERLAY.blockBottomY` 936, set from the left. A    #
 * # `bottomLeft` corner sits at `OVERLAY.corner.insetX` — the SAME 160,    #
 * # hoisted from the same constant on purpose — with the same bottom edge  #
 * # (T-OV26e already pins `overlayCornerRect('bottomLeft').y2` to 936) and #
 * # the same left alignment. Every treatment lands on the identical pixel: #
 * #                                                                        #
 * #   note block      left 160, bottom 144   ==  the fallback's            #
 * #   line + rule     left 160, top 821      ==  the fallback's            #
 * #   line, plain     left 160, top 857      ==  the fallback's            #
 * #                                                                        #
 * # Only the WASH narrows, and a viewer asked "did the caption move" is    #
 * # looking at the type. So choosing it spent a shot's one placement       #
 * # decision and moved nothing the client could see.                       #
 * #                                                                        #
 * # MEASURED, BECAUSE THE TIE-BREAK MADE IT THE COMMON ANSWER RATHER THAN  #
 * # A RARE ONE. On the 79 scored scenes of PLAN-v7-2026-08-16.json         #
 * # `bottomLeft` was FIRST in this list and took 16 of the 44 corners —    #
 * # more than any other. Ten of those sixteen are the perfectly centred    #
 * # wide shots, where all four clearances are equal to the pixel and the   #
 * # order alone decided. On the marks the v9 film actually carries it was  #
 * # 3 of 22, which with the 11 that fall back left only 8 of 22 marks      #
 * # anywhere the client had not already seen them in v8.                   #
 * #                                                                        #
 * # THE OTHER FIX WAS CONSIDERED AND IS WORSE. Giving a bottom corner its  #
 * # own inset so it reads as a corner can only move it AWAY from the       #
 * # corner. Horizontally there are fewer than 40px of legal room — T-OV23c #
 * # requires `insetX + 760 < 960`, so `insetX` may not reach 200 — and     #
 * # 39px is not a move anybody sees. Vertically the                        #
 * # block would have to leave the frame's bottom edge, which makes it a    #
 * # mark in the middle of the left-hand side rather than a corner one; it  #
 * # would give the film two distances from a frame edge to a mark instead  #
 * # of the one `OVERLAY.corner.insetY` exists to guarantee; and because    #
 * # `wash.plateauFromEdge` is derived from the block's far edge it would   #
 * # re-open the contrast arithmetic T-OV25c and T-OV25d pin. All of that   #
 * # to make a placement look different from the fallback rather than BE    #
 * # different from it.                                                     #
 * #                                                                        #
 * # NOTHING FALLS BACK BECAUSE OF THIS. Removing a candidate can only      #
 * # lower the best clearance, so a scene that already failed the subject   #
 * # radius still fails it and a scene that took another corner still takes #
 * # it. Measured over the same 79: the fallback count is 35 before and 35  #
 * # after, no non-`bottomLeft` answer changes, and all sixteen             #
 * # `bottomLeft` scenes keep a corner — 10 to `topRight`, 4 to             #
 * # `bottomRight`, 2 to `topLeft`, with 9.8px to spare in the tightest     #
 * # case. T-OV24h pins that. `bottomLeft` stays in `OverlayCorner` and in  #
 * # `overlayCornerRect` because the geometry is what proves the claim.     #
 * ##########################################################################
 *
 * THE ORDER IS STILL THE TIE-BREAK, AND THE TIE IS STILL THE COMMON CASE.
 * A subject on the frame's centre line is exactly as far from every corner, and
 * 26 of the 79 scored scenes carry a dead-centre `subjectAnchor` — the vision
 * model's answer for "centred". Ten of them are wide enough to clear the subject
 * radius and really do reach here, so the order decides them rather than
 * whichever way a comparison happens to run.
 *
 * Top-right first because it is one of the two the client's own reference frames
 * use, and it is now the one a centred wide shot takes.
 */
const OVERLAY_CORNER_ORDER: readonly OverlayCorner[] = ['topRight', 'bottomRight', 'topLeft']

/**
 * THE CORNERS A MARK MAY BE PLACED IN, in tie-break order. Three of the four —
 * see the box on `OVERLAY_CORNER_ORDER`.
 *
 * Read by `overlayPlacement` and by every test that wants to say something about
 * every placement the film can draw, so the two can never disagree about what
 * the menu is.
 */
export function overlayCorners(): readonly OverlayCorner[] {
  return OVERLAY_CORNER_ORDER
}

/**
 * How many characters of this face fit on ONE line of the CORNER measure.
 *
 * The headroom is folded in here rather than left to the gap between this and a
 * schema cap, because the schema cap was written for the full-width block. See
 * `OVERLAY_CORNER_HEADROOM`.
 *
 * At the annotation's 67px this is 18 characters and at the one-line look's 72px
 * it is 17 — which is a short mark, and a short mark is what a corner caption is.
 */
export function overlayCornerMaxChars(fontSize: number): number {
  return Math.floor(
    OVERLAY.corner.blockWidth / (fontSize * CAPTION_MEAN_ADVANCE_EM * OVERLAY.corner.measureHeadroom),
  )
}

/**
 * THE GATE ON THE CORNER, and it is the same shape as `overlayFitsFullFrame`.
 *
 * A line that does not fit the corner measure is not drawn there badly, it is
 * handed back to the block that can hold it. `École Biblique, Jerusalem` — 25
 * characters, and a real mark in the delivered film — is exactly that case.
 *
 * Counted with the spread operator so an astral character is one unit, matching
 * the annotation's own reveal arithmetic.
 */
export function overlayFitsCorner(text: string, fontSize: number): boolean {
  return [...text].length <= overlayCornerMaxChars(fontSize)
}

/** The block a corner draws into, in frame pixels. */
export function overlayCornerRect(corner: OverlayCorner): {
  x1: number
  y1: number
  x2: number
  y2: number
} {
  const { insetX, insetY, blockWidth, blockHeight } = OVERLAY.corner
  const onLeft = corner === 'bottomLeft' || corner === 'topLeft'
  const onTop = corner === 'topLeft' || corner === 'topRight'
  const x1 = onLeft ? insetX : FRAME_WIDTH - insetX - blockWidth
  const y1 = onTop ? insetY : FRAME_HEIGHT - insetY - blockHeight
  return { x1, y1, x2: x1 + blockWidth, y2: y1 + blockHeight }
}

/** How far the subject sits from the nearest pixel of a corner's block. */
function clearanceFromSubject(corner: OverlayCorner, subjectX: number, subjectY: number): number {
  const { x1, y1, x2, y2 } = overlayCornerRect(corner)
  // Zero when the point is inside the block on that axis, which is what makes
  // this the distance to the RECTANGLE rather than to its centre. A distance to
  // the centre would rank a wide block as further away than it is.
  const dx = Math.max(x1 - subjectX, 0, subjectX - x2)
  const dy = Math.max(y1 - subjectY, 0, subjectY - y2)
  return Math.hypot(dx, dy)
}

/**
 * ##########################################################################
 * # WHERE THIS MARK SITS, AND THE SIGNAL IS `vision.subjectAnchor`.        #
 * #                                                                        #
 * # NOT `crop.anchor`, WHICH IS THE TRAP, AND THE REASON IT IS A TRAP HAS  #
 * # CHANGED. The sentence that used to stand here said `chooseCrop` only   #
 * # moves that anchor off 0.5 for a picture cropped HORIZONTALLY. That is  #
 * # no longer true of any mode. Read `packages/core/src/crop.ts` rather    #
 * # than this paragraph; what it does now is:                              #
 * #                                                                        #
 * #   fill            the CROPPED axis carries the subject, the other 0.5  #
 * #   blurPillarbox   ACROSS is free and takes `placeInGround`, DOWN is 0.5#
 * #   letterbox       DOWN is free and takes `placeInGround`, ACROSS is 0.5#
 * #   archivePlate    0.5/0.5 always — a fixed card with no free axis      #
 * #                                                                        #
 * # SO THREE OF THE FOUR MODES MOVE IT NOW, AND IT IS STILL THE WRONG      #
 * # SIGNAL FOR THIS DEVICE. The two halves fail differently:               #
 * #                                                                        #
 * # IN `fill` IT IS A SUBJECT POSITION ON ONE AXIS ONLY, and on this film  #
 * # that axis is DOWN. RE-MEASURED 2026-09-05, against the artifact this   #
 * # note has always named, `tmp/PLAN-v7-backup.json`. 87 scenes, and 75    #
 * # of them are `fill`. `crop.anchor.x` is 0.5 on every one of those 75.   #
 * # `anchor.y` runs 0.35..0.72. Five scenes sit outside a 0.42..0.60 band, #
 * # and by `scene.index` they are 23 (y=0.62), 26 (0.40), 43 (0.41),       #
 * # 44 (0.35) and 83 (0.72).                                               #
 * #                                                                        #
 * # THE X HALF IS THE LOAD-BEARING HALF AND IT DID NOT MOVE. A corner rule #
 * # keyed on x is still a rule that returns the same answer for every shot #
 * # in the film, which no still would ever reveal — the frames would       #
 * # simply all look like today's.                                          #
 * #                                                                        #
 * # IN THE CONTAINED MODES IT IS NOT A SUBJECT POSITION AT ALL.            #
 * # `placeInGround` solves for where to put the PICTURE so that the subject#
 * # arrives at the MIDDLE OF THE FRAME. Reading it as "where the subject   #
 * # is" reads the other quantity and reads it backwards: wherever the clamp#
 * # does not bite, the subject in a pillarboxed shot is at 0.5 by          #
 * # construction. A mark placed off it would be dodging the picture's      #
 * # blurred bands, not the subject.                                        #
 * #                                                                        #
 * # The plan's own 12 pillarboxed scenes still carry a hard 0.5/0.5,       #
 * # because it was planned before crop.ts learned to place them. Their 11  #
 * # recorded subjects sit at x 0.45..0.55, so re-planned they move a little#
 * # and no further; the source aspect that sets `share` is not in the plan,#
 * # so no number is put on it here.                                        #
 * #                                                                        #
 * # `subjectAnchor` is off-centre on 43 of the 79 scored scenes, over a    #
 * # range of 0.22 to 0.91. T-OV23c pins that difference against the real   #
 * # anchors so this cannot silently become the other one.                  #
 * #                                                                        #
 * # IT IS A FRAME POSITION, NOT ONLY AN IMAGE ONE. `objectPosition` places #
 * # the anchor's own fraction of the image at the same fraction of the      #
 * # frame, so a subject the vision stage put at x=0.22 is drawn 22% across  #
 * # the frame. The Ken Burns move then slides it by up to a few percent    #
 * # over the shot, which is why the clearance below is checked against a    #
 * # subject DISC and not against a point.                                  #
 * ##########################################################################
 *
 * THREE WAYS TO FALL BACK, and the fallback is the delivered block:
 *
 *   no vision      a held shot inherits a picture whose vision record it does
 *                  not carry, so there is no subject to be clear of
 *   too long       the line does not fit the corner measure
 *   too crowded    no corner clears the subject by its own radius
 */
export function overlayPlacement(
  vision: AssetVision | null,
  text: string,
  fontSize: number,
): OverlayPlacement {
  if (vision === null) return 'bottom'
  if (!overlayFitsCorner(text, fontSize)) return 'bottom'

  const { x, y } = vision.subjectAnchor
  // A NaN anchor would make every comparison below false and hand back whichever
  // corner happened to be first, which is a placement decision made by a bug.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'bottom'

  const subjectX = Math.min(1, Math.max(0, x)) * FRAME_WIDTH
  const subjectY = Math.min(1, Math.max(0, y)) * FRAME_HEIGHT
  const required = OVERLAY.corner.subjectRadiusFraction[vision.shotScale] * FRAME_HEIGHT

  // The `??` is only there because indexing a readonly array is typed as
  // possibly-undefined; the loop below overwrites it on its first pass. It has
  // to name a corner the order really offers, or an empty order would draw the
  // one placement this device has just been taught not to choose.
  let best: OverlayCorner = OVERLAY_CORNER_ORDER[0] ?? 'topRight'
  let bestClearance = -1

  for (const corner of OVERLAY_CORNER_ORDER) {
    const clearance = clearanceFromSubject(corner, subjectX, subjectY)
    // Strictly greater, so a tie keeps the earlier corner and the order above is
    // really the tie-break rather than a comment about one.
    if (clearance > bestClearance) {
      bestClearance = clearance
      best = corner
    }
  }

  return bestClearance >= required ? best : 'bottom'
}

/** Which frame edges a placement is anchored to. One reading, four callers. */
export function overlayPlacementEdges(placement: OverlayPlacement): {
  onTop: boolean
  onRight: boolean
  isCorner: boolean
} {
  return {
    onTop: placement === 'topLeft' || placement === 'topRight',
    onRight: placement === 'bottomRight' || placement === 'topRight',
    isCorner: placement !== 'bottom',
  }
}

/** The box a block sits in, ready to spread into a style object. */
export type OverlayBlockBox = {
  left: number | undefined
  right: number | undefined
  top: number | undefined
  bottom: number | undefined
  width: number
  textAlign: 'left' | 'right'
}

/**
 * THE ONE-LINE LOOK'S MOUNT, for every placement and both treatments.
 *
 * ##########################################################################
 * # ONE EDGE PER MOUNT, AND IT IS NOT THE SAME EDGE TOP AND BOTTOM.        #
 * #                                                                        #
 * # At the bottom the invariant is the block's BOTTOM edge at y=936, so    #
 * # `plain` starts lower than `rule` by exactly the rule and its gap — the #
 * # derivation `OVERLAY_TEXT_TOP_Y` and `OVERLAY_BLOCK_TOP_Y` already      #
 * # carry, and the reason the client's pick between the two treatments     #
 * # answers one question rather than two.                                  #
 * #                                                                        #
 * # At the top that same invariant has to be read the other way round:     #
 * # pinning both treatments to `insetY` would leave the LINE 36px lower in #
 * # `rule` than in `plain`, and he would be picking position as well as    #
 * # the hairline. So `rule` starts at the inset and `plain` starts below   #
 * # it by the rule and its gap, which lands the LINE on one edge again.    #
 * ##########################################################################
 */
export function overlayLineBox(placement: OverlayPlacement, showsRule: boolean): OverlayBlockBox {
  const { onTop, onRight, isCorner } = overlayPlacementEdges(placement)
  const ruleDrop = TEXT_CARD.rule.height + TEXT_CARD.rule.gapBelowBare

  if (!isCorner) {
    return {
      left: OVERLAY.textX,
      right: undefined,
      top: showsRule ? OVERLAY.blockTopY : OVERLAY.textTopY,
      bottom: undefined,
      width: OVERLAY.blockWidth,
      textAlign: 'left',
    }
  }

  return {
    left: onRight ? undefined : OVERLAY.corner.insetX,
    right: onRight ? OVERLAY.corner.insetX : undefined,
    top: onTop
      ? OVERLAY.corner.insetY + (showsRule ? 0 : ruleDrop)
      : showsRule
        ? OVERLAY.blockTopY
        : OVERLAY.textTopY,
    bottom: undefined,
    width: OVERLAY.corner.blockWidth,
    textAlign: onRight ? 'right' : 'left',
  }
}

/**
 * THE ANNOTATION'S MOUNT, which is pinned by the edge it grows away from.
 *
 * This block WRAPS, so unlike the one-line look it has no known height to derive
 * a top from. At the bottom it is pinned by its bottom and grows up; at the top
 * it is pinned by its top and grows down. Either way the second line grows into
 * the frame rather than off it, and the corner wash is sized for two lines in
 * both directions — see `OVERLAY.corner.blockHeight`.
 */
export function overlayNoteBox(placement: OverlayPlacement): OverlayBlockBox {
  const { onTop, onRight, isCorner } = overlayPlacementEdges(placement)

  return {
    left: onRight ? undefined : isCorner ? OVERLAY.corner.insetX : OVERLAY.textX,
    right: onRight ? OVERLAY.corner.insetX : undefined,
    top: onTop ? OVERLAY.corner.insetY : undefined,
    bottom: onTop ? undefined : OVERLAY_NOTE_BOTTOM_INSET,
    width: isCorner ? OVERLAY.corner.blockWidth : OVERLAY.blockWidth,
    textAlign: onRight ? 'right' : 'left',
  }
}

/**
 * WHERE THE FIRST GLYPH LANDS, WHICH IS THE ONLY PART OF A BOX A VIEWER CAN SEE.
 *
 * A box has six fields and only three of them move type. `width` is the one that
 * matters here and it is deliberately NOT read: a corner block is 760px against
 * the delivered 1260, and on a left-aligned line that fits on one line — which
 * `overlayFitsCorner` is what guarantees — a narrower measure changes nothing
 * about where a single glyph is drawn. `textAlign` decides WHICH end of the box
 * the line is set from, so a right-aligned block's origin is its right edge read
 * back from the frame; and a block pinned by its top is not the same mount as one
 * pinned by its bottom even on the rare number they share, so the pin travels
 * with the coordinate rather than being flattened into it.
 */
export type OverlayTypeOrigin = {
  /** Distance from the LEFT frame edge to the end the line is set from. */
  x: number
  /** Distance from the TOP frame edge to the edge the block is pinned by. */
  y: number
  pinnedBy: 'top' | 'bottom'
}

export function overlayTypeOrigin(box: OverlayBlockBox): OverlayTypeOrigin {
  const x = box.textAlign === 'right' ? FRAME_WIDTH - (box.right ?? 0) : (box.left ?? 0)

  return box.top === undefined
    ? { x, y: FRAME_HEIGHT - (box.bottom ?? 0), pinnedBy: 'bottom' }
    : { x, y: box.top, pinnedBy: 'top' }
}

/**
 * ##########################################################################
 * # A PLACEMENT THIS DEVICE CALLS A CORNER HAS TO DRAW THE TYPE SOMEWHERE  #
 * # THE FALLBACK DOES NOT. THIS IS THE FUNCTION THAT SAYS SO.              #
 * #                                                                        #
 * # `bottomLeft` failed it for the whole of v9's first pass and nothing    #
 * # went red, because every test asked what the code had CHOSEN rather     #
 * # than what the viewer would SEE — the same failure the box on           #
 * # `overlayStyleTypes` records costing a render. A placement that spends  #
 * # a shot's one decision and moves nothing is invisible to a placement    #
 * # count, to a still of a single scene, and to a reviewer reading the     #
 * # selection rule.                                                        #
 * #                                                                        #
 * # ALL THREE BLOCKS, NOT ONE. A mark is drawn by `overlayLineBox` in      #
 * # either treatment or by `overlayNoteBox`, and the film carries both.    #
 * # A corner that moved the one-line look and not the annotation would     #
 * # hide exactly this defect on whichever half of the marks type.          #
 * #                                                                        #
 * # IT IS NOT WIRED INTO `overlayPlacement`. Filtering the order by this   #
 * # would make the order derived and the test that checks it vacuous, and  #
 * # the order is a real design decision about which corner a tie takes.    #
 * # Stated in the list, proven here, pinned by T-OV24h.                    #
 * ##########################################################################
 */
export function overlayPlacementMovesType(placement: OverlayPlacement): boolean {
  const origins = (of: OverlayPlacement): readonly OverlayTypeOrigin[] => [
    overlayTypeOrigin(overlayLineBox(of, true)),
    overlayTypeOrigin(overlayLineBox(of, false)),
    overlayTypeOrigin(overlayNoteBox(of)),
  ]

  const fallback = origins('bottom')

  return origins(placement).every((origin, index) => {
    const against = fallback[index]
    if (against === undefined) return false
    return (
      origin.x !== against.x || origin.y !== against.y || origin.pinnedBy !== against.pinnedBy
    )
  })
}

/** The wash a placement draws under itself. `maskImage` is absent for the block. */
export function overlayWash(placement: OverlayPlacement): {
  background: string
  maskImage: string | undefined
} {
  const { onTop, onRight, isCorner } = overlayPlacementEdges(placement)

  if (!isCorner) return { background: OVERLAY_SCRIM_GRADIENT, maskImage: undefined }

  return {
    background: onTop ? OVERLAY_CORNER_WASH_DOWN : OVERLAY_CORNER_WASH_UP,
    maskImage: onRight ? OVERLAY_CORNER_MASK_FROM_RIGHT : OVERLAY_CORNER_MASK_FROM_LEFT,
  }
}

/**
 * ##########################################################################
 * # WHICH STYLES TYPE. ONE PREDICATE, READ BY THE COMPOSITOR AND BY THE    #
 * # TESTS, BECAUSE THE ALTERNATIVE HAS ALREADY COST A RENDER.              #
 * #                                                                        #
 * # `note` has a per-character reveal and `lowerThird` does not. A         #
 * # deterministic mark was once given `lowerThird` and arrived in the      #
 * # delivered film silent and un-animated beside eight marks that typed —  #
 * # and the suite stayed green, because every test asserted the style the  #
 * # code had chosen rather than the BEHAVIOUR the style implies. It was    #
 * # caught by reading a plan log. See the box in `proposeDeterministicMarks`#
 * # in apps/worker/src/stages/plan.ts.                                     #
 * #                                                                        #
 * # `deliver.ts` lays a keystroke under each word of a typing mark and     #
 * # still spells the question as `style !== 'note'`. It is in another      #
 * # package's lane; the two agree today and this is the half that can be   #
 * # pointed at when they stop.                                             #
 * ##########################################################################
 */
export function overlayStyleTypes(style: OverlayStyle): boolean {
  return style === 'note'
}

/* ------------------------------------------------------------ the flash -- */

/**
 * The camera-flash transition. Measured off the client's 2026-08-15 reference at
 * 0:23 rather than invented.
 *
 * `sheetAlpha` IS NOT 1. His frame still shows the manuscript faintly through
 * the wash, which is what separates a flash from a cut to white — a full-opacity
 * sheet reads as a dropped frame or an encode fault, not as light. 0.82 is what
 * that frame measures.
 */
export const FLASH = {
  /**
   * Where the peak lands inside the window, as a FRACTION rather than a frame
   * count, so a flash clamped short by a brief scene still has a rise and a fall
   * instead of being cut off mid-rise. A quarter in: fast attack, longer decay,
   * which is the shape of a real one.
   */
  peakFraction: 0.25,
  /**
   * Very slightly cool, not pure white. A pure `#fff` sheet over a warm
   * photograph reads as digital; every real flash and every film leak carries a
   * cast, and his reference has a faint cyan at the right-hand edge.
   */
  sheetColor: '#F4F8FF',
  sheetAlpha: 0.82,
  /** How far the leak sweeps, in px. About a third of the frame. */
  streakTravel: 640,
} as const

/**
 * The leak itself, built once at module load.
 *
 * A CONSTANT, like every other gradient here, so Chrome rasterises it once per
 * segment and the animation is a pure composite. A gradient rebuilt per frame
 * would repaint a 1920x1080 layer 8 times per flash for no visible gain.
 */
export const FLASH_STREAK_GRADIENT = [
  'linear-gradient(105deg,',
  'rgba(255, 255, 255, 0) 0%,',
  'rgba(255, 255, 255, 0.55) 38%,',
  'rgba(214, 240, 255, 0.75) 52%,',
  'rgba(255, 255, 255, 0) 78%)',
].join(' ')

/* ------------------------------------------------- the annotation, derived -- */

/*
 * `OVERLAY_NOTE_FONT_SIZE` USED TO BE DECLARED HERE and is now declared ABOVE
 * the `OVERLAY` object, beside `OVERLAY_CAP_EM`. It had to move: the scrim is
 * sized against the tallest block this mount can produce, that block is this
 * device's two-line one, and a block's height cannot be known before its font
 * size is. It is exported from there, so nothing importing it changes.
 */

/**
 * The distance from the FRAME BOTTOM to the block's bottom edge.
 *
 * THIS BLOCK IS PINNED BY ITS BOTTOM, WHICH THE ONE-LINE LOOK DELIBERATELY IS
 * NOT. That block knows its own height, so `constants.ts` derives a `top` from
 * the bottom edge that matters and a stray line-height change cannot move it
 * silently. This one WRAPS — it is one line or two depending on the sentence —
 * so there is no height to derive a top from, and pinning the bottom is the only
 * way both cases land on the same edge.
 */
export const OVERLAY_NOTE_BOTTOM_INSET = FRAME_HEIGHT - OVERLAY_BLOCK_BOTTOM_Y

/**
 * The size a text card's line is set at, now that it sits on a photograph.
 *
 * Two steps, and it steps DOWN on length rather than wrapping to a third line,
 * because there is no third line to wrap to — see `OVERLAY.note.maxLines` and
 * the derivation in `TEXT_CARD.onPicture`.
 *
 * Declared here rather than beside `textCardTypeStep` because it reads
 * `OVERLAY_NOTE_FONT_SIZE`, which is derived from `OVERLAY` and therefore does
 * not exist yet up there. It is a function, so the reference resolves at call
 * time and the file order is only about being readable.
 */
export function textCardOnPictureFontSize(chars: number): number {
  return chars <= TEXT_CARD.onPicture.largeMaxChars
    ? OVERLAY_NOTE_FONT_SIZE
    : TEXT_CARD.onPicture.smallFontSize
}

/* ------------------------------------------- the full-frame year, derived -- */

/** The DRAWN height of the capitals, which is the thing the reference measures. */
export const OVERLAY_FULL_FRAME_CAP_PX = Math.round(
  FRAME_HEIGHT * OVERLAY.fullFrame.capFractionOfFrame,
)

/** The em box that produces that drawn height. Nothing sets `fontSize` directly. */
export const OVERLAY_FULL_FRAME_FONT_SIZE = Math.round(
  OVERLAY_FULL_FRAME_CAP_PX / OVERLAY.fullFrame.capEm,
)

/** The flat wash under it. Constant, for the reason in `OVERLAY.fullFrame.dimAlpha`. */
export const OVERLAY_FULL_FRAME_DIM = `rgba(11, 11, 12, ${String(OVERLAY.fullFrame.dimAlpha)})`

/**
 * How wide one glyph of this line runs.
 *
 * ##########################################################################
 * # 0.72, MEASURED OFF A RENDERED PNG ON 2026-08-16. IT USED TO BE 0.6 AND #
 * # THE COMMENT DEFENDING 0.6 WAS WRONG ON ITS OWN FACTS.                  #
 * #                                                                        #
 * # That comment said "Libre Franklin draws its lining figures on one      #
 * # fixed, generous advance so that a column of numbers aligns". It does   #
 * # not. The figures are PROPORTIONAL. "4Q204" rendered at `fontSize` 515  #
 * # and measured glyph-origin to glyph-origin gives:                       #
 * #                                                                        #
 * #     4   366px   0.711em                                                #
 * #     Q   399px   0.775em                                                #
 * #     2   342px   0.664em                                                #
 * #     0   365px   0.709em                                                #
 * #                                                                        #
 * # so the line ran 1838px of advance against the 1545px 0.6 predicted —   #
 * # 19% under. The title-safe measure is 1728, so the line overflowed its  #
 * # own box, and `text-align: center` CLAMPS an overflowing line to the    #
 * # start edge rather than centring it. The rendered frame put "4Q204" 112 #
 * # px from the left and SIX PIXELS from the right.                        #
 * #                                                                        #
 * # WHY 0.6 SURVIVED THIS LONG: it was fitted to "1947", and "1" is the    #
 * # one narrow figure in the family. Every year with a 1 in it fits at 0.6 #
 * # and the device has never once been selected, so nothing ever drew a    #
 * # string without one.                                                    #
 * #                                                                        #
 * # 0.72 is 0.714 measured, padded 1%. It is a MEAN over mixed figures and #
 * # capitals, not a bound — see `overlayFullFrameFontSize`, which is why a #
 * # mean is safe here: the size shrinks to fit rather than the line        #
 * # overflowing.                                                           #
 * ##########################################################################
 */
const OVERLAY_FULL_FRAME_ADVANCE_EM = 0.72

/** Title-safe on both sides. A figure touching the frame edge reads as a crop. */
const OVERLAY_FULL_FRAME_MEASURE = FRAME_WIDTH - 2 * SAFE_AREA_X

/**
 * The smallest this device may shrink to before it stops BEING this device.
 *
 * 0.28 of the frame is a 302px cap, which is still more than twice the title's
 * fallback treatment. Below it the mark is neither the reference look nor a
 * lower third, and a device that degrades gradually into nothing is worse than
 * one that hands over cleanly.
 */
const OVERLAY_FULL_FRAME_MIN_CAP_FRACTION = 0.28

export const OVERLAY_FULL_FRAME_MIN_FONT_SIZE = Math.round(
  (FRAME_HEIGHT * OVERLAY_FULL_FRAME_MIN_CAP_FRACTION) / OVERLAY.fullFrame.capEm,
)

/**
 * THE SIZE THIS STRING IS ACTUALLY DRAWN AT — the reference size, or the
 * largest that fits the title-safe measure, whichever is smaller.
 *
 * ##########################################################################
 * # FITTING IS NOT A NICETY HERE, IT IS THE ONLY THING THAT CAN WORK.      #
 * #                                                                        #
 * # `whiteSpace: nowrap` means the line cannot wrap out of trouble, and a  #
 * # second 389px line would be 78% of the frame height in solid type. So   #
 * # the only two honest answers to "this string is too wide" are SHRINK IT #
 * # or HAND IT TO ANOTHER DEVICE, and shrinking keeps the client's ask.    #
 * #                                                                        #
 * # "1947" is four characters and asks for 600, so it is capped at the     #
 * # reference 515 and draws exactly as it was measured off his frame.      #
 * # "4Q204" is five and fits at 480, a 363px cap — 93% of the reference    #
 * # and still 2.6x the treatment the client called too small.               #
 * ##########################################################################
 */
export function overlayFullFrameFontSize(text: string): number {
  const characters = text.length
  if (characters === 0) return OVERLAY_FULL_FRAME_FONT_SIZE

  const fitted = Math.floor(
    OVERLAY_FULL_FRAME_MEASURE / (characters * OVERLAY_FULL_FRAME_ADVANCE_EM),
  )

  return Math.min(OVERLAY_FULL_FRAME_FONT_SIZE, fitted)
}

/**
 * THE AUTHORITATIVE GATE ON LOOK A.
 *
 * `OVERLAY_FULL_FRAME_MAX_CHARS` in `@vg/core/schemas` is what the segmenter is
 * ASKED for; this is what the renderer will actually draw. If they ever
 * disagree this one wins and the mark degrades to another device rather than
 * overflowing.
 *
 * IT NO LONGER ASKS "does this fit". Everything fits now, because the size
 * shrinks. It asks the question that is left: is what fits still big enough to
 * be the strongest mark in the film?
 */
export function overlayFitsFullFrame(text: string): boolean {
  return overlayFullFrameFontSize(text) >= OVERLAY_FULL_FRAME_MIN_FONT_SIZE
}

/* ------------------------------------------------------ the title, derived -- */

/**
 * BELOW THE YEAR IN THIS FILE, NOT ABOVE IT, AND THE ORDER IS LOAD-BEARING.
 *
 * `OVERLAY_TITLE_DIM` reads `OVERLAY_FULL_FRAME_DIM`, which is a module-scope
 * `const`. Declared earlier in the file this is a temporal-dead-zone
 * ReferenceError at import time — which in a Remotion bundle surfaces as the
 * composition failing to register, not as a readable stack next to the line.
 * Keep the two devices in this order.
 */

/** The DRAWN height of the capitals, which is the thing his frame measures. */
export const OVERLAY_TITLE_CAP_PX = Math.round(FRAME_HEIGHT * OVERLAY.title.capFractionOfFrame)

/**
 * The em box that produces that drawn height. Nothing sets `fontSize` directly.
 *
 * `capEm` is borrowed from `OVERLAY.fullFrame` because it is a property of the
 * TYPEFACE, not of the device — the fraction of the em that Libre Franklin's
 * capitals occupy. It was measured off a rendered PNG at weight 800, which is
 * the weight this device also sets, so it transfers exactly.
 */
export const OVERLAY_TITLE_FONT_SIZE = Math.round(
  OVERLAY_TITLE_CAP_PX / OVERLAY.fullFrame.capEm,
)

/** The measure the title wraps inside. Centred, so this is a bound, not an edge. */
export const OVERLAY_TITLE_BLOCK_WIDTH = Math.round(
  FRAME_WIDTH * OVERLAY.title.blockWidthFraction,
)

/**
 * The flat wash under the title. BUILT FROM THIS DEVICE'S OWN KEY, which today
 * happens to hold the same number as the year's.
 *
 * Both devices set type across the MIDDLE of a photograph, where the lower
 * third's bottom-up gradient is fully transparent and therefore does nothing, so
 * both need a flat wash rather than that gradient.
 *
 * ##########################################################################
 * # TWO CONSTANTS THAT AGREE IS NOT ONE CONSTANT, AND THE DIFFERENCE COST   #
 * # A RENDER ONCE ALREADY.                                                  #
 * #                                                                        #
 * # This used to read `OVERLAY.fullFrame.dimAlpha` outright. That is what   #
 * # made the title illegible when the year's value was lowered under it —   #
 * # a change to one device silently changed another. Both keys now sit at   #
 * # 0.52 because both were solved against the same 3:1 floor over the same  #
 * # pure white worst case, not because either borrows the other, and either #
 * # can move on its own. See `OVERLAY.title.dimAlpha` for the full          #
 * # arithmetic and for the correction to what the old comment claimed.       #
 * ##########################################################################
 */
export const OVERLAY_TITLE_DIM = `rgba(11, 11, 12, ${String(OVERLAY.title.dimAlpha)})`

/**
 * How many characters of this face fit on ONE line of the title's measure.
 *
 * Same arithmetic as `overlayMaxChars`, against this block rather than the
 * card's. At 181px it comes to 16 characters a line and 32 across two, which is
 * why `OVERLAY_MAX_CHARS` (26) needs no relaxing for this device — the schema
 * bound is already the tighter of the two, exactly as it is for `lowerThird`.
 *
 * 181, NOT 183. The comment said 183 and `OVERLAY_TITLE_FONT_SIZE` computes to
 * round(137 / 0.756) = 181; the character count it quotes is right either way
 * (1511 / (181 x 0.511) = 16.3, and 1511 / (183 x 0.511) = 16.2, both floor to
 * 16), which is exactly why nothing caught it. Corrected 2026-08-16.
 *
 * IT DESCRIBES THE FALLBACK TREATMENT ONLY. A title that clears
 * `overlayFitsFullFrame` is set at `OVERLAY_FULL_FRAME_FONT_SIZE` on one line,
 * and that gate — not this count — is what keeps it inside the frame.
 */
export function overlayTitleMaxChars(): number {
  return Math.floor(OVERLAY_TITLE_BLOCK_WIDTH / (OVERLAY_TITLE_FONT_SIZE * CAPTION_MEAN_ADVANCE_EM))
}

/**
 * The title split into at most two balanced lines, HERE rather than by the
 * browser, for the same two reasons the card splits its own headline: the entry
 * animates per line and a line the component cannot name is a line it cannot
 * time, and "at most two lines" is a claim that needs something responsible for
 * it.
 *
 * It reuses the card's splitter rather than restating the algorithm. That
 * function measures against `textCardMaxChars`, which is a TWO-line capacity of
 * the card's own 1260px measure, while this block is 1511px — so the split it
 * returns is very slightly conservative here. It breaks a fraction early, which
 * is a marginally shorter first line and never an overflowing one. The same
 * safe-direction error the card already documents.
 */
export function overlayTitleLines(text: string): string[] {
  return textCardLines(text, OVERLAY_TITLE_FONT_SIZE)
}

/**
 * Everything the title's geometry depends on for THIS string, decided in one
 * place so the component only reads values.
 */
export type OverlayTitleSetting = {
  /** True when the title is set at the year's size. */
  full: boolean
  /** The DRAWN cap height, which is the thing the client's frames measure. */
  capPx: number
  fontSize: number
  /** The measure. A bound on the wrap, not a left edge — the block is centred. */
  blockWidth: number
  /**
   * Positive is DOWN, as a fraction of the frame height. Two measurements of two
   * different blocks; see the box on `OVERLAY.title.centreOffsetFraction`.
   */
  centreOffsetFraction: number
  /** One line when `full`. At most two otherwise. Never three. */
  lines: string[]
}

/**
 * THE TITLE AT THE YEAR'S SIZE WHEN IT FITS, AND TODAY'S TREATMENT WHEN IT DOES
 * NOT.
 *
 * ##########################################################################
 * # THE CLIENT'S NOTE, IN ONE LINE: HIS REFERENCE IS A BARE YEAR SET ACROSS #
 * # THE MIDDLE OF A PHOTOGRAPH AT 36% OF THE FRAME HEIGHT, AND OURS DREW    #
 * # 12.71%. Same family, same weight 800, same colour. The difference he is #
 * # pointing at is SIZE and nothing else, so this changes size and nothing  #
 * # else — the entry pop, the tracking and the flat wash are untouched.     #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE FALLBACK IS NOT OPTIONAL, AND IT IS THE ONLY REASON THIS IS A       #
 * # FUNCTION RATHER THAN A CHANGED CONSTANT.                                #
 * #                                                                        #
 * # The large path sets ONE line with `whiteSpace: nowrap`, exactly as      #
 * # `FullFrameYear` does, so a string that does not fit cannot wrap or      #
 * # shrink out of trouble — it hangs off BOTH edges of the frame. At        #
 * # font-size 515 a six-character title draws about 1854px of a 1920 frame  #
 * # before the safe area is even considered.                               #
 * #                                                                        #
 * # `overlayFitsFullFrame` is the gate, and it is the SAME gate the year    #
 * # uses rather than a second one written to look like it: title-safe on    #
 * # both sides, measured with the figures' own generous advance. It admits  #
 * # 5 characters. The film's title is "4Q204", which is 5, so the shot the  #
 * # client is waiting on renders large — and "The Great Isaiah Scroll" gets #
 * # the delivered treatment instead of a catastrophe.                       #
 * ##########################################################################
 *
 * THE LARGE PATH IS ONE LINE BY CONSTRUCTION. `overlayTitleLines` splits to at
 * most two, which is right for a 181px block on a 1511px measure and wrong here:
 * two lines of 389px cap is 78% of the frame height of solid type. Anything that
 * passed the gate is short enough to be one line by definition, so this returns
 * the string whole rather than asking the splitter and trusting the answer. The
 * empty-string case is the one exception and is handled explicitly, because
 * `[""]` would draw an empty line box where `overlayTitleLines` draws nothing.
 */
export function overlayTitleSetting(text: string): OverlayTitleSetting {
  if (overlayFitsFullFrame(text)) {
    const fontSize = overlayFullFrameFontSize(text)

    return {
      full: true,
      /*
       * DERIVED FROM THE FITTED SIZE, not read off `OVERLAY_FULL_FRAME_CAP_PX`.
       * A five-character title is drawn a little smaller than the reference so
       * that it sits inside the title-safe measure, and a `capPx` that still
       * reported 389 would be a number no pixel on the frame agrees with.
       */
      capPx: Math.round(fontSize * OVERLAY.fullFrame.capEm),
      fontSize,
      /*
       * The gate's own measure, not `OVERLAY_TITLE_BLOCK_WIDTH` (1511), because
       * this is the width the size was fitted against. The line now fits it, so
       * `textAlign: center` centres rather than clamping to the start edge —
       * which is exactly what it did on 2026-08-16 when the size was fixed and
       * the estimate was 19% under.
       */
      blockWidth: FRAME_WIDTH - 2 * SAFE_AREA_X,
      centreOffsetFraction: OVERLAY.fullFrame.centreOffsetFraction,
      lines: text.trim().length === 0 ? [] : [text],
    }
  }

  return {
    full: false,
    capPx: OVERLAY_TITLE_CAP_PX,
    fontSize: OVERLAY_TITLE_FONT_SIZE,
    blockWidth: OVERLAY_TITLE_BLOCK_WIDTH,
    centreOffsetFraction: OVERLAY.title.centreOffsetFraction,
    lines: overlayTitleLines(text),
  }
}

/* ----------------------------------------------- the overlay's own clock -- */

/**
 * ##########################################################################
 * # THE OVERLAY LEAVES WHILE THE SHOT IS STILL RUNNING. THAT IS THE ENTIRE #
 * # DIFFERENCE BETWEEN A BEAT AND A LABEL, AND IT IS WHY THIS CANNOT REUSE #
 * # `textCardChoreography`.                                                #
 * #                                                                        #
 * # The card's exit is pinned to the END of its scene, because the card IS  #
 * # the scene — there is nothing else on the frame to go back to. Here      #
 * # there is: a photograph, mid Ken Burns move, which the line is sitting   #
 * # on top of. Borrowing the card's clock would hold the type up for every  #
 * # frame of an 8-second shot but the last twelve, and type that outstays   #
 * # the moment it is naming stops being punctuation and becomes a watermark #
 * # — a caption track with long gaps in it, which is the thing the client   #
 * # asked us to stop showing him.                                          #
 * ##########################################################################
 *
 * Frames at 30fps, fixed, and independent of the narration — the same
 * discipline as the card, so the two devices arrive at the same speed and read
 * as one hand. The entry windows are literally the card's (rule 0-6, first
 * headline line 8-20); only what happens AFTER the entry is new.
 *
 * ENTRY 20 · HOLD 60 · EXIT 12 = 92 frames, 3.07 seconds on screen.
 *
 * The hold is derived rather than chosen. `OVERLAY_MAX_CHARS` is 26 and the rate
 * the subtitling trade sizes to is 17 characters per second (Netflix's English
 * timed-text spec; the BBC's 160-180wpm works out close to the same), so the
 * longest legal line takes 26 / 17 = 1.53s to read. 60 frames is 2.0s: that
 * reading time plus half a second for the eye to leave the photograph, find the
 * line and come back. Against the film's average shot — 8m46s over 91 scenes is
 * 5.8s, 173 frames — the line is gone for the last 2.7 seconds and the
 * photograph finishes on its own, which is what makes it read as punctuation.
 *
 * THE FIVE CONSTANTS THEMSELVES NOW LIVE IN `@vg/core/frames`, and are
 * re-exported below so nothing importing them from here has to change. They
 * moved because the PLANNER now has to compute the same clamp the compositor
 * applies: `rebaseOverlay` writes the frame a mark opens on, `renderKey` hashes
 * it, and if the two ends disagreed the plan would store a frame the screen
 * never shows while two scenes drawing identical pixels carried different keys.
 * The reasoning above is unchanged. Only the home is.
 *
 * `OVERLAY_MIN_READABLE_FRAMES` — 26 characters at 17 per second is 46 frames,
 * so a scene shorter than that cannot hold its own longest legal line for long
 * enough to be read even if the mark were up for every frame of it. Below that
 * the device is dropped outright, because a word that flashes and goes reads as
 * a glitch. Reachable rather than theoretical: `MIN_SCENE_MS` is 1200ms, 36
 * frames, so the segmenter really can hand this component a scene it must
 * refuse.
 *
 * `OVERLAY_FULL_TREATMENT_MIN_FRAMES` — under this the mark is drawn STATIC,
 * fully formed on every frame it has. The alternative is compressing the entry
 * the way the card does, and it is wrong here for a reason the card does not
 * have: the card compresses a gesture that owns the whole frame, while this one
 * has to survive a photograph moving underneath it.
 */
export {
  OVERLAY_ENTRY_FRAMES,
  OVERLAY_EXIT_FRAMES,
  OVERLAY_FULL_TREATMENT_MIN_FRAMES,
  OVERLAY_HOLD_FRAMES,
  OVERLAY_MIN_READABLE_FRAMES,
}

/**
 * `none` draws nothing at all; `static` draws it fully formed on every frame it
 * has; `animated` runs the full entry, hold and exit and ends before the scene
 * does.
 */
export type OverlayChoreographyMode = 'none' | 'static' | 'animated'

export type OverlayChoreography = {
  mode: OverlayChoreographyMode
  /**
   * The device's opening beat: the gradient in both treatments, and the rule as
   * well in the `rule` one. They share a window because they are one thing —
   * the ground the line is about to sit on.
   */
  ground: FrameWindow
  line: FrameWindow
  /** First frame of the exit. `durationFrames` unless `animated`, so nothing fires. */
  exitFrom: number
  exitFrames: number
}

/**
 * The card's own entry, unchanged. Only the exit is this device's own.
 *
 * ##########################################################################
 * # THE 8 IS NOW NAMED RATHER THAN TYPED, AND THE TWO NUMBERS WERE CHECKED #
 * # AGAINST EACH OTHER BEFORE THE NAME WENT IN.                            #
 * #                                                                        #
 * # This window has always been [8, 20]. `OVERLAY_TYPE_DELAY_FRAMES` in    #
 * # @vg/core/frames is 8 and `OVERLAY_TYPE_MIN_FRAMES` is 12, and 20 - 8   #
 * # is 12 — so the typewriter clock's "delay" and "the flat window it      #
 * # replaces" are exactly this window, measured from the other end. Naming #
 * # it changes no pixel today; it is what lets the reveal below lengthen   #
 * # the window without moving where it starts. T-OV22b pins the equality,  #
 * # so if core ever moves the delay this stops silently agreeing.          #
 * ##########################################################################
 */
const OVERLAY_ENTRY_WINDOWS = {
  ground: [0, 6],
  line: [OVERLAY_TYPE_DELAY_FRAMES, OVERLAY_ENTRY_FRAMES],
} as const satisfies Record<string, FrameWindow>

/**
 * How long the line takes to arrive when nobody says otherwise.
 *
 * DERIVED FROM THE WINDOW ABOVE, so the default is the shipped behaviour by
 * construction rather than by a number that happens to match. Every device
 * except `note` takes it, and every existing caller of `overlayChoreography`
 * gets a byte-identical answer.
 */
const OVERLAY_DEFAULT_REVEAL_FRAMES =
  OVERLAY_ENTRY_WINDOWS.line[1] - OVERLAY_ENTRY_WINDOWS.line[0]

/**
 * `requestedStartFrame` is the moment the narrator says the thing, rebased by the
 * planner into this scene's own frames. It defaults to 0, which is exactly the
 * behaviour every mark had before the field existed, so an old plan and a model
 * that omits the timestamp both land on the identical answer.
 *
 * EVERY WINDOW MOVES BY THE SAME OFFSET, deliberately. The gradient, the rule and
 * the line are one gesture; shifting them independently is how a device starts
 * looking like two devices that happen to overlap.
 */
export function overlayChoreography(
  durationFrames: number,
  requestedStartFrame = 0,
  /**
   * How many frames the LINE takes to arrive, and only the line.
   *
   * ##########################################################################
   * # OPTIONAL, AND THE DEFAULT IS THE SHIPPED WINDOW, WHICH IS THE WHOLE    #
   * # REASON THIS IS A THIRD PARAMETER AND NOT A NEW FUNCTION.                #
   * #                                                                        #
   * # `note` is the only style that passes it. It asks the shared clock in   #
   * # @vg/core/frames how long ITS string takes to type and hands the answer #
   * # here, so a 9-character mark reveals in 14 frames and a 40-character    #
   * # one in 42. Every other device — `lowerThird`, the title and the year — #
   * # omits it and gets the identical [at+8, at+20] it has always had.       #
   * #                                                                        #
   * # NOTHING ELSE IN THE CLOCK MOVES. `ground`, `exitFrom` and `exitFrames` #
   * # are untouched, because the reveal is spent INSIDE the entry and hold    #
   * # the mark already had. `OVERLAY_FULL_TREATMENT_MIN_FRAMES`,             #
   * # `overlayStartFrame` and every clamp built on them are the same numbers #
   * # they were, so no frozen plan changes shape and no `renderKey` moves.   #
   * ##########################################################################
   */
  revealFrames: number = OVERLAY_DEFAULT_REVEAL_FRAMES,
): OverlayChoreography {
  if (durationFrames < OVERLAY_MIN_READABLE_FRAMES) {
    return { mode: 'none', ground: [0, 1], line: [0, 1], exitFrom: durationFrames, exitFrames: 0 }
  }

  /*
   * The SAME function the planner used to write the number. If this clamped
   * differently the stored frame and the drawn frame would diverge — see the box
   * on `overlayStartFrame` in @vg/core/frames.
   */
  const at = overlayStartFrame(durationFrames, requestedStartFrame)
  const shift = ([from, to]: FrameWindow): FrameWindow => [from + at, to + at]

  /*
   * NEVER A ZERO-LENGTH WINDOW. `interpolate` requires a strictly increasing
   * input range and THROWS on `[28, 28]`, and a throw inside a Remotion
   * composition fails the whole segment render rather than drawing something
   * wrong — the same failure `textCardChoreography` guards against when its
   * scale rounds two edges together. `overlayTypeFrames` never returns less than
   * `OVERLAY_TYPE_MIN_FRAMES` 12, so this is belt and braces against a future
   * caller rather than against the one that exists.
   *
   * NaN IS CHECKED SEPARATELY BECAUSE `Math.max` CANNOT SEE IT. `Math.max(1,
   * NaN)` is NaN, and a NaN window edge fails `interpolate`'s strictly-
   * increasing check and throws — the same crash `overlayStartFrame` already
   * refuses a NaN `atMs` for, and the same answer: fall back to the behaviour
   * that shipped rather than fail the segment.
   */
  const reveal = Number.isFinite(revealFrames)
    ? Math.max(1, Math.round(revealFrames))
    : OVERLAY_DEFAULT_REVEAL_FRAMES
  const lineWindow: FrameWindow = [
    at + OVERLAY_TYPE_DELAY_FRAMES,
    at + OVERLAY_TYPE_DELAY_FRAMES + reveal,
  ]

  /*
   * STATIC MEANS NO EXIT. IT DOES NOT MEAN NO ENTRY, AND THAT DISTINCTION IS A
   * BUG FIX, NOT A PREFERENCE.
   *
   * This branch used to hand back `[0, 1]` for both windows, which `progressIn`
   * reads as "already arrived" on frame 0. A crossfade composites the OUTGOING
   * picture on top for `CROSSFADE_FRAMES` = 12 frames, so a short scene entered
   * by a dissolve drew its whole device — gradient, rule and line at full
   * strength — over the PREVIOUS shot's photograph. Observed on a paired render:
   * a 60-frame scene showed the band and "100 BCE" over the outgoing white coin
   * plate, while the same props at 150 frames correctly drew nothing.
   *
   * It is reachable rather than theoretical: `MIN_SCENE_MS` is 1200ms and
   * crossfade is the default transition, so every 46-91 frame scene carrying an
   * overlay hit it.
   *
   * The entry is 20 frames against a floor of 46, so even the shortest scene in
   * this band still holds the finished mark for 26 frames. What it drops is the
   * exit, because a scene this short has no room to hold AND leave.
   */
  if (durationFrames < OVERLAY_FULL_TREATMENT_MIN_FRAMES) {
    return {
      mode: 'static',
      ground: shift(OVERLAY_ENTRY_WINDOWS.ground),
      line: lineWindow,
      exitFrom: durationFrames,
      exitFrames: 0,
    }
  }

  return {
    mode: 'animated',
    ground: shift(OVERLAY_ENTRY_WINDOWS.ground),
    line: lineWindow,
    /*
     * FROM WHERE THE MARK OPENS, never from the end of the shot. `durationFrames
     * - something` is what makes a device a label: it would stretch the hold to
     * fill whatever shot it landed on. The exit is 80 frames after the opening
     * because the hold is a fixed 60, and every frame after that is photograph.
     *
     * `at` is clamped so this can never run past `durationFrames`.
     */
    exitFrom: at + OVERLAY_ENTRY_FRAMES + OVERLAY_HOLD_FRAMES,
    exitFrames: OVERLAY_EXIT_FRAMES,
  }
}

/* --------------------------------------------------------------- easing -- */

/**
 * THE THREE CURVES, IN ONE PLACE, BECAUSE THEY USED TO BE IN TWO.
 *
 * ##########################################################################
 * # `easeIn` AND `easeOut` WERE COPY-PASTED INTO Overlay.tsx AND           #
 * # TextCard.tsx, FOUR IDENTICAL LINES IN TWO FILES.                       #
 * #                                                                        #
 * # That is harmless right up until someone changes one of them, at which  #
 * # point half the film's type moves on a different curve and nothing      #
 * # fails — the same shape as the two caption guards that disagreed and    #
 * # the two crop switches that drifted. Adding `easeOutBack` below was     #
 * # exactly that moment, so both files now import all three from here.     #
 * ##########################################################################
 */

/** Arrives at speed and settles. The house curve for anything entering. */
export const easeOut = (value: number): number => 1 - Math.pow(1 - value, 3)

/** Leaves slowly then goes. The house curve for anything exiting. */
export const easeIn = (value: number): number => Math.pow(value, 3)

/**
 * The title's scale over its entry, which is the motion the client called
 * "jumping text or pop up text".
 *
 * ##########################################################################
 * # USED BY THE TITLE AND BY NOTHING ELSE, AND THAT IS THE WHOLE POINT.    #
 * #                                                                        #
 * # `Overlay.tsx` carries a box saying type must scale DOWN into place,    #
 * # because type that grows reads as a title animation and type that       #
 * # settles reads as a mark being placed. That reasoning is correct and is #
 * # why every other device still takes `easeOut`. The title is the one     #
 * # device in the film that IS a title, it fires once, and he asked for    #
 * # the growing one by name on 2026-08-16.                                 #
 * ##########################################################################
 *
 * ##########################################################################
 * # TWO EXPLICIT PHASES, NOT A `back` EASING, AND THE FIRST ATTEMPT HERE   #
 * # WAS THE `back` ONE AND WAS WRONG IN A WAY NO TEST CAUGHT.              #
 * #                                                                        #
 * # The standard back-out curve overshoots by a fixed FRACTION OF ITS      #
 * # RANGE — about 10% for the usual 1.70158 tension. Over a range of only  #
 * # 0.90 to 1.00 that is a peak of 1.010, which is invisible. Reaching     #
 * # 1.04 that way needs a tension near 6.8, which is a bounce rather than  #
 * # a pop, and the number in the constant would no longer be the number    #
 * # on the screen.                                                         #
 * #                                                                        #
 * # Worse, the version this replaced multiplied the curve by `overshoot`   #
 * # as its ENDPOINT, so the title settled at 1.04 and simply stayed 4%     #
 * # too big for the rest of the shot. Nothing anywhere goes red for that:  #
 * # it is a correct-looking render of the wrong size, which is exactly the #
 * # class of defect the still loop exists to catch.                        #
 * #                                                                        #
 * # Phased, every endpoint is a constant you can read: it starts at        #
 * # `fromScale`, peaks at `overshoot`, and lands on exactly 1.             #
 * ##########################################################################
 *
 * `PEAK_AT` 0.6 gives a faster rise than fall, which is the shape of anything
 * with weight arriving and settling.
 */
const TITLE_PEAK_AT = 0.6

export function titleScale(progress: number, fromScale: number, overshoot: number): number {
  const clamped = Math.min(1, Math.max(0, progress))

  if (clamped <= TITLE_PEAK_AT) {
    return fromScale + (overshoot - fromScale) * easeOut(clamped / TITLE_PEAK_AT)
  }

  return overshoot + (1 - overshoot) * easeOut((clamped - TITLE_PEAK_AT) / (1 - TITLE_PEAK_AT))
}

/* --------------------------------------------------------- archive plate -- */

export const ARCHIVE_PLATE = {
  /** Portrait and square archival sits at 78% of frame height, on a plate. */
  heightRatio: 0.78,
  height: Math.round(FRAME_HEIGHT * 0.78),
  border: '1px solid rgba(255, 255, 255, 0.12)',
  shadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
  /**
   * Ken Burns inside the plate is capped at 6%. The plate has a visible edge, so
   * any larger move makes the image slide against a fixed frame and the whole
   * composition reads as a slideshow.
   *
   * NOT a literal any more. The worker's planner has to apply the identical cap
   * when it records where the outgoing image ended up (`prevAsset.endScale`), and
   * it cannot import this file, so the number lives in `@vg/core/motion` and both
   * sides read it from there. A local 0.06 here would be free to drift, and the
   * crossfade would hold a frame the shot never actually ended on.
   */
  maxTravel: maxTravelForCrop('archivePlate'),
} as const

/* ---------------------------------------------------------------- grade --- */

export const GRADE = {
  /**
   * THE HOUSE CURVE. One string, every frame, every asset, every job.
   *
   * There is no per-asset white balance and there is deliberately none: see the
   * block comment in Grade.tsx for why `asset.vision` cannot drive this without
   * making the same photograph change colour halfway through its own dissolve.
   *
   * `contrast(1.06)` — 6%, roughly a third of a stop at the ends of the scale.
   * Enough to put some snap back into a flat archival scan; small enough that a
   * photograph already printed with deep blacks does not clip. The corpus holds
   * both kinds and exactly one number is allowed, so it is sized for the one
   * that breaks, not for the one that would look best.
   *
   * `saturate(0.88)` — a yellowed albumen print and a cold monochrome plate cut
   * badly against each other because their casts point in opposite directions.
   * Taking 12% out of both moves them toward each other without turning either
   * grey. Going to 0 would unify them completely and would also throw away every
   * colour photograph in the film, which is a much larger decision than a grade.
   */
  toneFilter: 'contrast(1.06) saturate(0.88)',
  /**
   * The toe, and it exists BECAUSE of `contrast(1.06)`.
   *
   * CSS `contrast()` pivots around mid-grey, so it pushes the shadows down as
   * hard as it lifts the highlights, and an archival scan's shadows already sit
   * near the floor. A film print never reaches zero — the paper base sets a
   * floor under it. This is that floor.
   *
   * 3.5% over the whole frame is 3.5% everywhere arithmetically, but it is only
   * VISIBLE where there is nothing else, which is the black. Warm rather than
   * neutral because paper is warm, and because the same lift in a neutral grey
   * reads as haze on the lens rather than as a print.
   */
  toeColor: 'rgba(238, 230, 214, 0.035)',
  /** Four offsets on a 3-frame hold. Static grain reads as dirt on the lens. */
  grainOffsets: 4,
  grainHoldFrames: 3,
  grainTileSize: 512,
  vignetteInnerStop: 0.55,
  /**
   * `grade.vignette` in the plan is a 0-1 strength; the DEFAULT_GRADE value of
   * 0.18 is meant to produce the reference vignette, which is 30% black at the
   * corners. This constant is the conversion, so the default grade renders
   * exactly the designed look and a stronger grade scales from it.
   */
  vignetteAlphaPerUnit: 0.3 / 0.18,
  vignetteMaxAlpha: 0.6,
} as const

/* ------------------------------------------------------------------------- */
/* The film burn was here, and it was removed on the client's instruction     */
/* ------------------------------------------------------------------------- */

/*
 * ##########################################################################
 * # REMOVED 2026-09-10. His words: "Remove the current film burn fully,    #
 * # get rid of it".                                                        #
 * #                                                                        #
 * # WHAT WENT: `FILM_BURN` and eight gradient and vignette constants,      #
 * # `FILM_BURN_WARM_GRADIENT`, `FILM_BURN_YELLOW_GRADIENT`,                #
 * # `FILM_BURN_SCREEN_AMBER`, `FILM_BURN_SCREEN_GOLD`,                     #
 * # `FILM_BURN_STREAK_GRADIENT`, `FILM_BURN_GRAIN`,                        #
 * # `FILM_BURN_BOTTOM_VIGNETTE` and `FILM_BURN_RADIAL_VIGNETTE`.           #
 * #                                                                        #
 * # THEY ARE NOT LOST. The old block's own header warned that the values   #
 * # were copied from Saku's file rather than fitted, and that `script/` is #
 * # gitignored so nothing here could be re-derived. That is true of his    #
 * # SOURCE, not of this copy: `constants.ts` is tracked, so every number   #
 * # survives in git history. Recover with                                  #
 * #                                                                        #
 * #     git show <the removing commit>^:apps/web/src/remotion/constants.ts #
 * #                                                                        #
 * # HIS RULING STILL ASKS FOR A FILM BURN, on 10% of transition points. He #
 * # intends to supply the look himself. So `filmBurn` stays a member of    #
 * # `TransitionType` and this build simply never emits one. Do not read    #
 * # this deletion as the effect being cancelled.                           #
 * ##########################################################################
 */

/* ------------------------------------------------------------------------- */
/* The pushCut's flash, which we draw ourselves rather than let the preset do  */
/* ------------------------------------------------------------------------- */

/*
 * ##########################################################################
 * # THESE FOUR ARE `push-cut.js`'s OWN DEFAULTS, COPIED ON PURPOSE.        #
 * #                                                                        #
 * # `@remotion/transitions` paints this sheet inside its own wrapper, which #
 * # in our stack sits UNDER `Grade`. A sheet under a `backdrop-filter`      #
 * # contrast and a vignette comes out dimmer at the corners than in the     #
 * # middle and its white is not white — the same defect already recorded    #
 * # for the flash bloom. So the preset is handed `flashOpacity: 0` and      #
 * # `PushCutFlash` redraws it above `Grade` from these numbers.             #
 * #                                                                        #
 * # THEY MUST TRACK THE PRESET. If `@remotion/transitions` is upgraded,     #
 * # re-read `dist/presentations/push-cut.js` and check all four. Nothing    #
 * # here can notice them drifting, exactly as nothing reaches across to     #
 * # compare `FLASH_PEAK_FRACTION` with the worker's copy.                   #
 * #                                                                        #
 * # `PUSH_CUT_CUT_PROGRESS` ALSO EXISTS IN THE WORKER as                    #
 * # `PUSH_CUT_CUT_FRACTION` in `deliver.ts`, where it times the sound. Two  #
 * # copies of 5/11, one per app, which is the established shape here        #
 * # because the two apps share only `@vg/core` and this is a look value     #
 * # rather than a planning one.                                             #
 * ##########################################################################
 */

/** Where in the window the hard cut happens. `push-cut.js` `cutProgress`. */
export const PUSH_CUT_CUT_PROGRESS = 5 / 11

/** How many frames the flash decays over after the cut. `flashFrames`. */
export const PUSH_CUT_FLASH_FRAMES = 2

/** Its peak opacity. `flashOpacity`. */
export const PUSH_CUT_FLASH_PEAK = 0.2

/** Its colour, which is a warm off-white rather than a pure one. `flashColor`. */
export const PUSH_CUT_FLASH_COLOUR = '#f5f2ed'
