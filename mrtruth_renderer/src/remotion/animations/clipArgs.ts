import { FRAMED_CARD } from './framedCardClock.js'
import { PHOTO_POP } from './photoPopClock.js'
import { POINTER_LABEL } from './pointerLabelClock.js'
import { CHAPTER_TITLE_LAST_FRAME } from './chapterTitleClock.js'
import { NAME_CARD_LAST_FRAME } from './nameCardClock.js'
import { TWO_PHOTO_ZOOM } from './twoPhotoZoomClock.js'
import { GALLERY_STRIP_LAST_FRAME } from './galleryStripClock.js'
import { highlightPageFrameCount } from './highlightPageClock.js'
import { BULLET_CHECKLIST_LAST_FRAME } from './bulletChecklistClock.js'

/**
 * The clip harness's argument contract, as a pure function of `argv`.
 *
 * Kept out of `scripts/` deliberately. `apps/web/vitest.config.ts:33` collects
 * `src/**\/*.test.ts` and nothing else, so logic that lives beside the CLI is
 * logic nothing can test. The CLI is a shell around this.
 *
 * ####################################################################
 * # THE REFUSALS ARE THE PRODUCT. A HARNESS THAT RENDERS THE WRONG    #
 * # THING AT EXIT 0 IS WORSE THAN ONE THAT DOES NOT RUN.              #
 * #                                                                   #
 * # This project has paid for that lesson twice already. The template #
 * # still harness accepted a space-separated flag as a stray token,   #
 * # ignored it, and rendered a frame nobody asked for. And the render #
 * # stage wrote to `<path>.mp4.tmp`, which `renderMedia` rejects on   #
 * # extension BEFORE rendering, so stage 6 produced zero frames for   #
 * # the whole of this project's early history.                        #
 * #                                                                   #
 * # So every refusal below is by NAME, with the fix in the message.   #
 * ####################################################################
 */

/**
 * The last frame of the framed card's scene.
 *
 * 90 frames at 30fps is 3.0 seconds, and the range is inclusive, so the last
 * frame is 89. Motion finishes at frame 25 and the remaining 2.1 seconds are a
 * dead hold. That hold is not padding — the client's note calls this animation
 * 1.5 seconds long, and sending only the moving part would confirm his reading
 * rather than correct it.
 */
export const CLIP_DEFAULT_LAST_FRAME = 89

/** Anything not listed is a typo, and a typo is refused rather than ignored. */
const KNOWN_FLAGS: readonly string[] = ['image', 'caption', 'out', 'frames', 'animation', 'anchor']

/**
 * Every animation the harness can render, by the name a person types.
 *
 * Listed rather than free-form so a typo is refused by name. A misspelled
 * animation would otherwise render the DEFAULT one at exit 0, and a clip that
 * is silently the wrong device is exactly what this file exists to prevent.
 */
export const ANIMATIONS = [
  'framed-card',
  'pointer-label',
  'photo-pop',
  'two-photo-zoom',
  'chapter-title',
  'name-card',
  'gallery-strip',
  'highlight-page',
  'bullet-checklist',
] as const

export type AnimationName = (typeof ANIMATIONS)[number]

/**
 * How long each animation runs, as the INCLUSIVE last frame of its own scene.
 *
 * ####################################################################
 * # THIS IS A TOTAL MAP AND NOT A TERNARY, AND THE TYPE IS THE POINT. #
 * #                                                                   #
 * # It used to read                                                   #
 * #                                                                   #
 * #   animation === 'pointer-label' ? POINTER_LABEL.totalFrames - 1   #
 * #                                : CLIP_DEFAULT_LAST_FRAME          #
 * #                                                                   #
 * # which is correct for exactly two animations and silently wrong    #
 * # for a third. Adding a name to `ANIMATIONS` without touching that  #
 * # line handed the new animation 89 frames, so anything longer was   #
 * # rendered TRUNCATED, with a success line and exit 0. That is the   #
 * # "silently the wrong clip" failure the header above says this file #
 * # exists to prevent, and the file was committing it itself.         #
 * #                                                                   #
 * # `Record<AnimationName, number>` cannot be partial. Add a name to  #
 * # `ANIMATIONS` and this object stops compiling until its length is  #
 * # stated, so the bug is now a build error rather than a bad clip.   #
 * ####################################################################
 */
const LAST_FRAME: Record<AnimationName, number | ((captions: readonly string[]) => number)> = {
  'framed-card': CLIP_DEFAULT_LAST_FRAME,
  'pointer-label': POINTER_LABEL.totalFrames - 1,
  'photo-pop': PHOTO_POP.totalFrames - 1,
  'two-photo-zoom': TWO_PHOTO_ZOOM.totalFrames - 1,
  'chapter-title': CHAPTER_TITLE_LAST_FRAME,
  'name-card': NAME_CARD_LAST_FRAME,
  'gallery-strip': GALLERY_STRIP_LAST_FRAME,
  /*
   * ####################################################################
   * # a2 IS THE FIRST ANIMATION WHOSE LENGTH IS NOT A CONSTANT, WHICH  #
   * # IS WHY THIS MAP NOW HOLDS FUNCTIONS AS WELL AS NUMBERS.          #
   * #                                                                   #
   * # Its highlights run 13 frames per marked WORD, chained end to     #
   * # end, and then the whole shot holds for 48. The reference's three #
   * # phrases carry 3 + 4 + 3 words, so 13 * 10 + 48 = 178 frames.     #
   * #                                                                   #
   * # A CONSTANT HERE WOULD BE SILENTLY WRONG FOR ANY OTHER COPY —     #
   * # either cutting the last wipe off mid-sweep or leaving dead air   #
   * # after it, both at exit 0. That is exactly the class of failure   #
   * # this file exists to refuse, and it is why the map's type changed #
   * # rather than a8's constant being reused with a comment.           #
   * #                                                                   #
   * # The odd captions are the phrases; see CAPTION_COUNT below.       #
   * ####################################################################
   */
  'highlight-page': (captions) =>
    highlightPageFrameCount(captions.filter((_, index) => index % 2 === 1)) - 1,
  /*
   * ####################################################################
   * # 119 IS A CONSTANT TODAY AND MAY HAVE TO BECOME A FUNCTION.       #
   * #                                                                   #
   * # a7 is 120 frames for the reference's THREE checklist rows. Its   #
   * # rows arrive on a stagger, so a fourth row plausibly makes the    #
   * # shot longer the way a2's fourth marked word does — which is      #
   * # exactly the case this map's type was widened to hold.            #
   * #                                                                   #
   * # It is pinned rather than derived because the row cadence and the #
   * # length of the final hold are still being measured. Deriving it   #
   * # from a guessed cadence would be the a2 failure in reverse: a     #
   * # formula that looks principled and is wrong for the one set of    #
   * # copy we can actually check against.                              #
   * #                                                                   #
   * # REVISIT once the row timing is measured. If the cadence is fixed #
   * # and the hold absorbs the remainder, 120 is right only for three. #
   * ####################################################################
   */
  'bullet-checklist': BULLET_CHECKLIST_LAST_FRAME,
}

/**
 * The inclusive last frame of an animation's own scene. Total by construction.
 *
 * Takes the captions because ONE animation's length depends on them. Every
 * other entry ignores the argument, and passing none is safe for those.
 */
export function lastFrameOf(animation: AnimationName, captions: readonly string[] = []): number {
  const entry = LAST_FRAME[animation]
  return typeof entry === 'function' ? entry(captions) : entry
}

/**
 * How many photographs and how many written labels each animation draws.
 *
 * ####################################################################
 * # THE COUNTS ARE REFUSALS, NOT CONFIGURATION.                       #
 * #                                                                   #
 * # `--image=` and `--caption=` are repeatable now, because the two   #
 * # photo cards need two of each. Repeatable flags create a brand new #
 * # way to render the wrong thing at exit 0: pass one photograph to a #
 * # two-picture device and the second card draws empty, or pass two   #
 * # to a one-picture device and the second is silently dropped.       #
 * #                                                                   #
 * # Before this, `flag()` used `argv.find`, which returns the FIRST   #
 * # match. `--image=a.jpg --image=b.jpg` rendered a.jpg and exited 0, #
 * # and `image` being in KNOWN_FLAGS meant the duplicate was not even #
 * # caught as an unknown flag. Silently dropping an argument the      #
 * # caller typed is the same failure class as the rest of this file.  #
 * #                                                                   #
 * # So the count is checked against the animation BY NAME, and both   #
 * # maps are total: add an animation and they stop compiling until    #
 * # somebody states what it draws.                                    #
 * ####################################################################
 */
const PHOTO_COUNT: Record<AnimationName, number> = {
  'framed-card': 1,
  'pointer-label': 1,
  'photo-pop': 1,
  'two-photo-zoom': 2,
  /* a3 draws no photograph at all -- nothing in its 150 frames is photographic. */
  'chapter-title': 0,
  /*
   * a5 draws two, AND THEY ARE NOT INTERCHANGEABLE, unlike a4's pair.
   * Backdrop first, portrait second. Swapping them renders at exit 0.
   */
  'name-card': 2,
  /*
   * a8 draws FOUR, and the ORDER runs LEFT TO RIGHT while the CAMERA runs
   * RIGHT TO LEFT.
   *
   * ####################################################################
   * # THE FIRST PICTURE IS THE ONE THE CLIP ENDS ON, NOT THE ONE IT    #
   * # OPENS ON.                                                        #
   * #                                                                   #
   * # The camera opens hard inside the LAST picture typed, travels     #
   * # left through the strip, and lands on the FIRST. Type them in     #
   * # reading order and it plays as his reference does; type them in   #
   * # the order the camera visits them and you get a mirror that looks #
   * # entirely plausible on its own and is wrong in every frame.       #
   * #                                                                   #
   * # The harness cannot catch that, the same way it cannot catch a5's #
   * # backdrop and portrait being swapped. It is in the CLI header.    #
   * ####################################################################
   */
  'gallery-strip': 4,
  /* a2 draws no photograph at all. It is a page of type. */
  'highlight-page': 0,
  /*
   * a7 draws ONE, full-bleed, and it is the only one of the nine that is
   * genuinely static — measured at under 0.005px of drift over 120 frames.
   */
  'bullet-checklist': 1,
}

/**
 * Zero means the device draws NO text, and passing one is refused rather than
 * ignored. The photo pop is the client's only reference with no words in it,
 * which is the whole reason it was built first, so a caption arriving there is
 * a caller misunderstanding the device rather than a harmless extra.
 */
const CAPTION_COUNT: Record<AnimationName, number> = {
  'framed-card': 1,
  'pointer-label': 1,
  'photo-pop': 0,
  'two-photo-zoom': 2,
  /* a3 is one line, and the line IS the animation. */
  'chapter-title': 1,
  /* a5's name line, then its role line. */
  'name-card': 2,
  /*
   * a8's four badges read "#1" to "#4" and the DEVICE GENERATES THEM from the
   * card index. Nothing is typed.
   *
   * That is a choice rather than a measurement — nothing in his frames can
   * separate a generated ordinal from an author who typed four ordinals, and
   * Bebas's figures are tabular so even the equal chip widths do not
   * discriminate. Generating is the reading that is safe under both, and it is
   * the one that costs the client nothing: it makes a8 one of only two of his
   * nine references that needs NO written copy, so it is not blocked behind
   * the capability `verifySpokenMarks` does not have.
   */
  'gallery-strip': 0,
  /*
   * ####################################################################
   * # SIX, AND THEY ARE PAIRS: paragraph, phrase, paragraph, phrase,   #
   * # paragraph, phrase.                                               #
   * #                                                                   #
   * # Interleaved rather than three paragraphs and then three phrases, #
   * # so a phrase always sits beside the paragraph it belongs to. With #
   * # the grouped order a caller who supplies five would have every    #
   * # pairing after the gap silently shifted, and the substring check  #
   * # below would be the only thing that noticed.                      #
   * #                                                                   #
   * # a2 is the most copy-hungry of his nine: 56 words of connected    #
   * # prose plus three exact substrings, where every other animation   #
   * # wants a caption or nothing at all.                               #
   * ####################################################################
   */
  'highlight-page': 6,
  /*
   * ####################################################################
   * # FOUR: THE HEADER'S TITLE FIRST, THEN ONE PER CHECKLIST ROW.      #
   * #                                                                   #
   * # The reference reads "BULLET POINT OVERLAY" over "Key takeaway     #
   * # #1", "#2" and "#3". The ordinals are part of the typed strings    #
   * # here and are NOT generated the way a8's badges are — a8's chips   #
   * # are the whole label, where these are the tail of a sentence, so   #
   * # there is nothing to generate them from.                           #
   * #                                                                   #
   * # a7 IS THE MOST COPY-HUNGRY OF HIS NINE AFTER a2, and unlike a2    #
   * # the plan has no shape to carry it: `SceneOverlaySchema.text` is   #
   * # ONE string capped at 64 characters. See the box in the component. #
   * ####################################################################
   */
  'bullet-checklist': 4,
}

/** How many photographs an animation draws. Total by construction. */
export function photoCountOf(animation: AnimationName): number {
  return PHOTO_COUNT[animation]
}

/** How many written labels an animation draws. Total by construction. */
export function captionCountOf(animation: AnimationName): number {
  return CAPTION_COUNT[animation]
}

export type ClipArgs = {
  /**
   * Every photograph, in the order typed. Left card first.
   *
   * ####################################################################
   * # THERE IS NO SINGULAR `image` FIELD, AND ITS ABSENCE IS THE POINT. #
   * #                                                                   #
   * # One existed briefly, holding `images[0]`, so the one-picture       #
   * # animations could read as before. It was a live trap: the CLI read #
   * # it and inlined exactly ONE file, so a two-picture device would    #
   * # have passed every count check here and then rendered the LEFT     #
   * # photograph twice, at exit 0.                                      #
   * #                                                                   #
   * # Removing it turns that into a compile error at every call site,   #
   * # which is the same trade this file makes everywhere else.          #
   * ####################################################################
   */
  images: string[]
  /** Every label, in the order typed. Left chip first. */
  captions: string[]
  out: string
  frames: { from: number; to: number }
  animation: AnimationName
  /**
   * Where the subject is, as FRACTIONS of the frame. Only the pointer label
   * reads it. In production this comes from `vision.subjectAnchor`; here it is
   * typed by hand, so it is validated rather than trusted.
   */
  anchor: { x: number; y: number }
}

export type ParsedClipArgs =
  | { ok: true; args: ClipArgs }
  | { ok: false; reason: string }

/**
 * `slice` on the first `=` only, so a caption may contain one.
 *
 * `--caption=E = mc2` has to survive intact. Splitting on every `=` would hand
 * back `E`, which is the kind of silent truncation that reaches a delivered
 * frame.
 */
function flag(argv: readonly string[], name: string): string | undefined {
  return flags(argv, name)[0]
}

/**
 * Every occurrence of a repeatable flag, in the order it was typed.
 *
 * Order is the contract: the first `--image=` is the LEFT card and the second
 * is the right. Nothing about the flag says so, which is why the refusal below
 * names the count and the CLI header spells out the order.
 */
function flags(argv: readonly string[], name: string): string[] {
  const prefix = `--${name}=`
  return argv.filter((value) => value.startsWith(prefix)).map((value) => value.slice(prefix.length))
}

function unknownFlag(argv: readonly string[]): string | undefined {
  return argv.find((value) => {
    if (!value.startsWith('--')) return false
    const name = value.slice(2).split('=')[0] ?? ''
    return !KNOWN_FLAGS.includes(name)
  })
}

/**
 * A bare `--image` with its value in the next token.
 *
 * Checked separately from `unknownFlag` so the message can say what to type
 * instead. `--image /tmp/a.jpg` is a KNOWN flag spelled the wrong way, and
 * reporting it as unknown would send the caller looking for a typo they did not
 * make.
 */
function spaceSeparated(argv: readonly string[]): string | undefined {
  return argv.find((value) => KNOWN_FLAGS.includes(value.replace(/^--/, '')) && value.startsWith('--'))
}

function parseRange(raw: string): { ok: true; from: number; to: number } | { ok: false } {
  const match = /^(\d+)-(\d+)$/.exec(raw)
  if (match === null) return { ok: false }

  const from = Number(match[1])
  const to = Number(match[2])
  if (to < from) return { ok: false }

  return { ok: true, from, to }
}

export function parseClipArgs(argv: readonly string[]): ParsedClipArgs {
  const spaced = spaceSeparated(argv)
  if (spaced !== undefined) {
    return {
      ok: false,
      reason: `${spaced} needs its value attached. Write ${spaced}=<value>, not ${spaced} <value>.`,
    }
  }

  const unknown = unknownFlag(argv)
  if (unknown !== undefined) {
    return {
      ok: false,
      reason: `Unknown flag ${unknown}. Known flags are ${KNOWN_FLAGS.map((name) => `--${name}=`).join(' ')}`,
    }
  }

  const out = flag(argv, 'out')
  if (out === undefined || out === '') {
    return { ok: false, reason: '--out=<path> is required, and it must end in .mp4' }
  }

  /*
   * The load-bearing refusal. `renderMedia` validates the extension against the
   * codec before rendering, so getting this wrong otherwise costs a full bundle
   * and then throws. See `apps/worker/src/stages/render.ts:308-322`.
   */
  if (!out.endsWith('.mp4')) {
    return {
      ok: false,
      reason: `--out must end in .mp4 for the h264 codec, got ${out}. Remotion checks this before it renders a frame, so a wrong extension costs a whole bundle for nothing.`,
    }
  }

  /*
   * ####################################################################
   * # THE OUTPUT CHECKS RUN BEFORE ANYTHING ELSE, AND THE ORDER IS      #
   * # LOAD-BEARING RATHER THAN TIDY.                                    #
   * #                                                                   #
   * # The extension refusal is the one this file's header calls the one #
   * # that pays for it, because `renderMedia` validates the extension   #
   * # BEFORE it renders a frame, so getting it wrong otherwise costs a  #
   * # whole bundle and then throws.                                     #
   * #                                                                   #
   * # When the label counts were added they were checked first, and a   #
   * # caller who typed `--out=clip.png` was told about a missing        #
   * # caption instead. Two tests caught it. Cheapest and most valuable  #
   * # refusal goes first; the count checks need the animation parsed    #
   * # and can wait.                                                     #
   * ####################################################################
   */
  /*
   * The animation is read FIRST, because how many photographs and how many
   * labels are legal depends on which device was asked for. Reading the images
   * first and validating them later is how a count check ends up applied to the
   * wrong animation.
   */
  const rawAnimation = flag(argv, 'animation')
  let animation: AnimationName = 'framed-card'
  if (rawAnimation !== undefined) {
    const match = ANIMATIONS.find((name) => name === rawAnimation)
    if (match === undefined) {
      return {
        ok: false,
        reason: `--animation=${rawAnimation} is not one this harness has built. Available: ${ANIMATIONS.join(', ')}`,
      }
    }
    animation = match
  }

  const images = flags(argv, 'image')
  const wantedImages = photoCountOf(animation)
  if (images.some((value) => value === '')) {
    return { ok: false, reason: '--image= was given with no path after it.' }
  }
  if (images.length !== wantedImages) {
    const noun = wantedImages === 1 ? 'photograph' : 'photographs'
    return {
      ok: false,
      reason:
        images.length === 0
          ? `--image=<path> is required. ${animation} draws ${wantedImages} ${noun}.`
          : `${animation} draws ${wantedImages} ${noun}, but ${images.length} --image= flags were given. Repeat --image= once per picture, left to right.`,
    }
  }

  const captions = flags(argv, 'caption')
  const wantedCaptions = captionCountOf(animation)
  const captionNoun = wantedCaptions === 1 ? 'label' : 'labels'

  /*
   * An empty label is worse here than a missing one, and it is not obvious.
   *
   * A chip is sized from its own words, so `--caption=` with nothing after it
   * does not draw a wordless chip. It draws a 67px orange stub — two lots of
   * padding and nothing between them — sitting under a 720px photograph.
   */
  if (captions.some((value) => value === '')) {
    return {
      ok: false,
      reason:
        '--caption= was given with no text after it. A label is sized from its words, so an empty one renders a 67px stub rather than a blank chip.',
    }
  }

  /*
   * ####################################################################
   * # `!==`, NOT `>`. THE FIRST VERSION OF THIS CHECK REFUSED TOO MANY  #
   * # AND SILENTLY ACCEPTED TOO FEW.                                    #
   * #                                                                   #
   * # The image check ten lines above got it right and this one did     #
   * # not, which is the whole argument for writing the two the same     #
   * # way. On a two-label device one `--caption=` parsed clean, the     #
   * # second was `undefined`, and the right-hand chip rendered wordless #
   * # with a success line and exit 0.                                   #
   * #                                                                   #
   * # That is the failure this file's header says it exists to prevent, #
   * # and it was introduced by the very change that added the counts.   #
   * ####################################################################
   */
  if (captions.length !== wantedCaptions) {
    return {
      ok: false,
      reason:
        wantedCaptions === 0
          ? `${animation} draws no text at all, so --caption= has nothing to write. It is the one reference animation with no words in it.`
          : captions.length === 0
            ? `--caption=<text> is required. ${animation} draws ${wantedCaptions} ${captionNoun}, left chip first.`
            : `${animation} draws ${wantedCaptions} ${captionNoun}, but ${captions.length} --caption= flags were given. Repeat --caption= once per chip, left to right.`,
    }
  }

  /*
   * ####################################################################
   * # THE PHRASE MUST BE AN EXACT SUBSTRING OF ITS OWN PARAGRAPH, AND  #
   * # THIS IS THE ONE REFUSAL IN THIS FILE THAT IS ABOUT MEANING       #
   * # RATHER THAN ABOUT COUNTS.                                        #
   * #                                                                   #
   * # a2 draws a yellow block behind a run of characters INSIDE a      #
   * # paragraph. If the phrase is not in the paragraph there is        #
   * # nothing to draw it behind, and the component would render the    #
   * # paragraph with no mark at all — a page that looks deliberate,    #
   * # at exit 0, with one third of the animation silently missing.     #
   * #                                                                   #
   * # It is a CHARACTER run and not a token match. The reference's     #
   * # second block stops 1.4px before the comma in "paragraphs,", so   #
   * # tokenising and rejoining draws a different rectangle.            #
   * ####################################################################
   */
  if (animation === 'highlight-page') {
    for (let index = 1; index < captions.length; index += 2) {
      const phrase = captions[index] ?? ''
      const paragraph = captions[index - 1] ?? ''
      if (!paragraph.includes(phrase)) {
        return {
          ok: false,
          reason:
            `--caption #${String(index + 1)} is the phrase to highlight in --caption #${String(index)}, ` +
            `and it does not occur in it. Got "${phrase}", which is not a substring of "${paragraph}". ` +
            'Captions go paragraph, phrase, paragraph, phrase, paragraph, phrase.',
        }
      }
    }
  }

  const rawAnchor = flag(argv, 'anchor')
  let anchor = { x: 0.5, y: 0.5 }
  if (rawAnchor !== undefined) {
    const parts = rawAnchor.split(',')
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (parts.length !== 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        ok: false,
        reason: `--anchor=${rawAnchor} is not two numbers. Write --anchor=<x>,<y>.`,
      }
    }
    /*
     * Fractions, not pixels. `vision.subjectAnchor` is a fraction of the frame,
     * and typing 920,610 is the obvious mistake. Refused rather than clamped,
     * because a clamped anchor silently points at the frame edge.
     */
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      return {
        ok: false,
        reason: `--anchor=${rawAnchor} must be fractions of the frame, each between 0 and 1, not pixels.`,
      }
    }
    anchor = { x, y }
  }

  /*
   * The default range is the whole of WHICHEVER animation was chosen. They are
   * different lengths — 90 frames against 93 — and defaulting both to 89 would
   * silently cut the last tenth of a second off the pointer label, which is
   * where its photograph finishes settling.
   */
  const lastFrame = lastFrameOf(animation, captions)

  const rawFrames = flag(argv, 'frames')
  let frames = { from: 0, to: lastFrame }
  if (rawFrames !== undefined) {
    const range = parseRange(rawFrames)
    if (!range.ok) {
      return {
        ok: false,
        reason: `--frames=${rawFrames} is not a range. Write --frames=<from>-<to> with two whole numbers, the second not smaller than the first.`,
      }
    }
    /*
     * ####################################################################
     * # BOUND THE EXPLICIT RANGE, NOT JUST THE DEFAULT ONE.              #
     * #                                                                   #
     * # The default was made per-animation when the third name arrived.   #
     * # An explicit `--frames=` never was, so `--frames=0-500` on a 120-  #
     * # frame device parsed clean, `clipDurationInFrames` returned 501,   #
     * # and the clip rendered 381 extra frames of held final pose with a  #
     * # success line and an mp4. A short clip is visibly short; a clip    #
     * # padded with a freeze is not, which is the same argument as the    #
     * # substituted-device bug this file already refuses.                 #
     * ####################################################################
     */
    if (range.to > lastFrame) {
      return {
        ok: false,
        reason: `--frames=${rawFrames} runs past the end of ${animation}, whose last frame is ${lastFrame}. Asking for frame ${range.to} would pad the clip with a held final pose rather than render anything.`,
      }
    }
    if (range.from > lastFrame) {
      return {
        ok: false,
        reason: `--frames=${rawFrames} starts past the end of ${animation}, whose last frame is ${lastFrame}.`,
      }
    }
    frames = { from: range.from, to: range.to }
  }

  return {
    ok: true,
    args: {
      images,
      captions,
      out,
      frames,
      animation,
      anchor,
    },
  }
}

/** The scene length a range implies, so the entry can size the composition. */
export function clipDurationInFrames(frames: { from: number; to: number }): number {
  return frames.to + 1
}

/** Re-exported so the CLI and the entry cannot disagree about the clock. */
export const CLIP_ANIMATION = FRAMED_CARD
