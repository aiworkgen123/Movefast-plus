import { overlayClipById, overlayClipTailFrames } from './effects.js'
import { EASING_NAMES, FPS, OVERLAY_MAX_CHARS } from './schemas.js'
import type { CaptionPhrase, CaptionWord, TransitionType, VideoPlan, WordTiming } from './schemas.js'

/**
 * All frame math lives here. Every caption and every cut keys off these
 * functions, so there is exactly one rounding rule in the project.
 *
 * Everything is integer arithmetic. `ms * fps` is an exact integer for any input
 * we can reach (60 minutes at 30fps is 108,000,000), so the divisions below are
 * exact and identical on every machine. Nothing accumulates: a frame number is
 * always derived from an absolute millisecond value, never from the sum of the
 * durations before it.
 */

function assertFps(fps: number): void {
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error(`frames: fps must be a positive integer, received ${String(fps)}`)
  }
}

function assertFiniteMs(ms: number, label: string): void {
  if (!Number.isFinite(ms)) {
    throw new Error(`frames: ${label} must be a finite number, received ${String(ms)}`)
  }
}

/** Milliseconds to frame index. Round-half-up, the single rounding rule. */
export function msToFrame(ms: number, fps: number): number {
  assertFps(fps)
  assertFiniteMs(ms, 'ms')
  const m = Math.max(0, Math.round(ms))
  return Math.floor((m * fps + 500) / 1000)
}

/**
 * Milliseconds to a frame COUNT. Ceil, never round: the video must cover the
 * whole voiceover, so the last partial frame still counts.
 */
export function msToFrameCeil(ms: number, fps: number): number {
  assertFps(fps)
  assertFiniteMs(ms, 'ms')
  const m = Math.max(0, Math.round(ms))
  return Math.floor((m * fps + 999) / 1000)
}

export function frameToMs(frame: number, fps: number): number {
  assertFps(fps)
  if (!Number.isInteger(frame)) {
    throw new Error(`frames: frame must be an integer, received ${String(frame)}`)
  }
  return Math.round((frame * 1000) / fps)
}

/** Total frames a plan needs to cover `audioMs` of voiceover. */
export function totalFramesForAudio(audioMs: number, fps: number): number {
  return Math.max(1, msToFrameCeil(audioMs, fps))
}

/**
 * Deterministic pseudo-random unit value in [0, 1) derived from an integer seed.
 * Used wherever the pipeline needs variation without `Math.random()` — the same
 * plan must always produce the same video.
 */
export function deterministicUnit(seed: number): number {
  let x = (Math.trunc(seed) + 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  return x / 0x100000000
}

/* ------------------------------------------------------------------------- */
/* Word timings                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Snap an arbitrary boundary to a real word end. Never invents a timestamp.
 *
 * A boundary that lands mid-word snaps to that word's end (cutting inside a
 * spoken word is the most audible failure there is). Otherwise it snaps to the
 * nearest `endMs`, ties going to the earlier word so the result is stable.
 */
export function snapToWordEnd(ms: number, words: readonly WordTiming[]): number {
  assertFiniteMs(ms, 'ms')
  if (words.length === 0) {
    throw new Error('snapToWordEnd: cannot snap without word timings')
  }

  let best: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const word of words) {
    if (ms >= word.startMs && ms < word.endMs) return word.endMs
    const distance = Math.abs(word.endMs - ms)
    if (distance < bestDistance) {
      bestDistance = distance
      best = word.endMs
    }
  }

  if (best === null) throw new Error('snapToWordEnd: no candidate word end found')
  return best
}

/**
 * Drop or truncate words that run past the end of the audio. Deepgram can emit a
 * final word whose `end` overshoots the file; left alone it produces a caption
 * that outlives the video.
 */
export function clampWordTimings(words: readonly WordTiming[], audioMs: number): WordTiming[] {
  assertFiniteMs(audioMs, 'audioMs')
  const limit = Math.max(0, Math.round(audioMs))
  const out: WordTiming[] = []

  for (const word of words) {
    if (word.startMs >= limit) continue
    out.push({
      word: word.word,
      startMs: word.startMs,
      endMs: Math.min(word.endMs, limit),
      confidence: word.confidence,
    })
  }
  return out
}

/* ------------------------------------------------------------------------- */
/* Captions                                                                    */
/* ------------------------------------------------------------------------- */

export type CaptionOptions = {
  /** A gap this long or longer starts a new phrase block. */
  gapMs?: number
  /** Minimum time a phrase stays on screen. */
  minDurationMs?: number
  maxLines?: number
  maxCharsPerLine?: number
  /** Hard ceiling (usually plan.totalFrames) so a phrase cannot outlive the video. */
  maxFrame?: number
}

export const CAPTION_DEFAULTS = {
  gapMs: 180,
  minDurationMs: 1200,
  maxLines: 2,
  maxCharsPerLine: 38,
} as const

/** Greedy wrap; returns the number of lines the words would occupy. */
export function countCaptionLines(words: readonly string[], maxCharsPerLine: number): number {
  if (words.length === 0) return 0
  let lines = 1
  let used = 0

  for (const word of words) {
    const cost = used === 0 ? word.length : used + 1 + word.length
    if (used !== 0 && cost > maxCharsPerLine) {
      lines += 1
      used = word.length
    } else {
      used = cost
    }
  }
  return lines
}

/**
 * Chunk word timings into on-screen phrase blocks.
 *
 * Guarantees, all of which are load-bearing:
 *  - no caption (word or phrase) has `endFrame <= startFrame`. Two words that
 *    round into the same frame flicker visibly; here the later one is pushed
 *    forward instead.
 *  - phrases never overlap, and words never overlap, because a single monotonic
 *    frame cursor walks the whole array.
 */
export function buildCaptionPhrases(
  words: readonly WordTiming[],
  fps: number,
  options: CaptionOptions = {},
): CaptionPhrase[] {
  assertFps(fps)

  const gapMs = options.gapMs ?? CAPTION_DEFAULTS.gapMs
  const minDurationMs = options.minDurationMs ?? CAPTION_DEFAULTS.minDurationMs
  const maxLines = options.maxLines ?? CAPTION_DEFAULTS.maxLines
  const maxCharsPerLine = options.maxCharsPerLine ?? CAPTION_DEFAULTS.maxCharsPerLine

  if (words.length === 0) return []

  // 1. group on breath gaps and on block capacity
  const groups: WordTiming[][] = []
  let current: WordTiming[] = []

  for (const word of words) {
    const previous = current[current.length - 1]
    if (previous !== undefined) {
      const gap = word.startMs - previous.endMs
      const wouldOverflow =
        countCaptionLines(
          [...current.map((w) => w.word), word.word],
          maxCharsPerLine,
        ) > maxLines
      if (gap >= gapMs || wouldOverflow) {
        groups.push(current)
        current = []
      }
    }
    current.push(word)
  }
  if (current.length > 0) groups.push(current)

  // 2. assign frames with one monotonic cursor across every group
  const phrases: CaptionPhrase[] = []
  let cursor = 0

  for (const group of groups) {
    const captionWords: CaptionWord[] = []

    for (const word of group) {
      const startFrame = Math.max(msToFrame(word.startMs, fps), cursor)
      const endFrame = Math.max(msToFrame(word.endMs, fps), startFrame + 1)
      captionWords.push({ text: word.word, startFrame, endFrame })
      cursor = endFrame
    }

    const first = captionWords[0]
    if (first === undefined) continue
    phrases.push({ startFrame: first.startFrame, endFrame: cursor, words: captionWords })
  }

  // 3. hold each phrase for the minimum, but never into the next one
  const minFrames = msToFrame(minDurationMs, fps)

  for (let i = 0; i < phrases.length; i += 1) {
    const phrase = phrases[i]
    if (phrase === undefined) continue

    const next = phrases[i + 1]
    const ceiling = next !== undefined ? next.startFrame : (options.maxFrame ?? Number.MAX_SAFE_INTEGER)
    const wanted = phrase.startFrame + minFrames

    phrase.endFrame = Math.max(phrase.endFrame, Math.min(wanted, ceiling))
    if (phrase.endFrame <= phrase.startFrame) phrase.endFrame = phrase.startFrame + 1
  }

  return phrases
}

/**
 * Clip absolute-timeline caption phrases to one scene and rebase them to
 * scene-relative frames. Captions inside a `PlannedScene` are always relative —
 * that is what lets a segment render on its own and what keeps `renderKey`
 * independent of placement.
 */
export function sliceAndRebaseCaptions(
  phrases: readonly CaptionPhrase[],
  sceneStartFrame: number,
  durationFrames: number,
): CaptionPhrase[] {
  if (durationFrames < 1) throw new Error('sliceAndRebaseCaptions: durationFrames must be >= 1')
  const sceneEndFrame = sceneStartFrame + durationFrames
  const out: CaptionPhrase[] = []

  for (const phrase of phrases) {
    if (phrase.endFrame <= sceneStartFrame || phrase.startFrame >= sceneEndFrame) continue

    const words: CaptionWord[] = []
    for (const word of phrase.words) {
      if (word.endFrame <= sceneStartFrame || word.startFrame >= sceneEndFrame) continue
      const startFrame = Math.max(0, Math.min(word.startFrame, sceneEndFrame - 1) - sceneStartFrame)
      const endFrame = Math.max(startFrame + 1, Math.min(word.endFrame, sceneEndFrame) - sceneStartFrame)
      words.push({ text: word.text, startFrame, endFrame })
    }
    if (words.length === 0) continue

    const first = words[0]
    const last = words[words.length - 1]
    if (first === undefined || last === undefined) continue

    const startFrame = Math.max(0, Math.min(phrase.startFrame, sceneEndFrame - 1) - sceneStartFrame)
    const endFrame = Math.min(
      durationFrames,
      Math.max(last.endFrame, Math.max(phrase.endFrame - sceneStartFrame, startFrame + 1)),
    )
    out.push({ startFrame, endFrame: Math.max(endFrame, startFrame + 1), words })
  }

  return out
}

/* ------------------------------------------------------------------------- */
/* Scene placement                                                             */
/* ------------------------------------------------------------------------- */

export type SceneTimeSpan = {
  index: number
  startMs: number
  endMs: number
}

export type ScenePlacement = {
  index: number
  startFrame: number
  durationFrames: number
}

/**
 * Turn absolute scene millisecond spans into frame placements.
 *
 * Every `startFrame` is computed from that scene's own absolute `startMs`.
 * Durations are the DIFFERENCE between neighbouring start frames — they are
 * never summed forward. Adding one rounded duration to the next is what produces
 * a two-second drift by scene 150.
 *
 * Guarantees:
 *   sum(durationFrames) === totalFrames
 *   scene[i].startFrame + scene[i].durationFrames === scene[i+1].startFrame
 *   scene[0].startFrame === 0
 */
export function planSceneFrames(
  scenes: readonly SceneTimeSpan[],
  fps: number,
  totalFrames: number,
): ScenePlacement[] {
  assertFps(fps)
  if (scenes.length === 0) throw new Error('planSceneFrames: at least one scene is required')
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new Error(`planSceneFrames: totalFrames must be a positive integer, received ${String(totalFrames)}`)
  }
  if (totalFrames < scenes.length) {
    throw new Error(
      `planSceneFrames: ${scenes.length} scenes cannot fit in ${totalFrames} frames (one frame minimum each)`,
    )
  }

  const starts: number[] = new Array<number>(scenes.length)

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i]
    if (scene === undefined) throw new Error(`planSceneFrames: scene ${i} is missing`)
    const previous = scenes[i - 1]
    if (previous !== undefined && scene.startMs < previous.startMs) {
      throw new Error(
        `planSceneFrames: scenes must be ordered by startMs (scene ${i} starts at ${scene.startMs}ms, scene ${i - 1} at ${previous.startMs}ms)`,
      )
    }
    starts[i] = i === 0 ? 0 : msToFrame(scene.startMs, fps)
  }

  // forward pass: every scene gets at least one frame
  for (let i = 1; i < starts.length; i += 1) {
    const previous = starts[i - 1]
    const own = starts[i]
    if (previous === undefined || own === undefined) throw new Error('planSceneFrames: internal indexing error')
    starts[i] = Math.max(own, previous + 1)
  }

  // backward pass: leave room for every remaining scene inside totalFrames
  for (let i = starts.length - 1; i >= 1; i -= 1) {
    const own = starts[i]
    if (own === undefined) throw new Error('planSceneFrames: internal indexing error')
    starts[i] = Math.min(own, totalFrames - (starts.length - i))
  }

  for (let i = 1; i < starts.length; i += 1) {
    const previous = starts[i - 1]
    const own = starts[i]
    if (previous === undefined || own === undefined) throw new Error('planSceneFrames: internal indexing error')
    if (own <= previous) {
      throw new Error(
        `planSceneFrames: scene ${i} cannot be placed after scene ${i - 1} within ${totalFrames} frames`,
      )
    }
  }

  const placements: ScenePlacement[] = []
  for (let i = 0; i < starts.length; i += 1) {
    const scene = scenes[i]
    const startFrame = starts[i]
    if (scene === undefined || startFrame === undefined) {
      throw new Error('planSceneFrames: internal indexing error')
    }
    const nextStart = starts[i + 1] ?? totalFrames
    placements.push({
      index: scene.index,
      startFrame,
      durationFrames: nextStart - startFrame,
    })
  }

  return placements
}

/* ------------------------------------------------------------------------- */
/* Overlay timing                                                              */
/* ------------------------------------------------------------------------- */

/**
 * ###########################################################################
 * # THESE FOUR NUMBERS LIVE IN CORE BECAUSE TWO PACKAGES NOW DO THE SAME    #
 * # ARITHMETIC WITH THEM, AND THE ONE THING THAT MUST NOT HAPPEN IS THE     #
 * # PLANNER PROMISING A FRAME THE COMPOSITOR REFUSES.                       #
 * #                                                                        #
 * # `renderKey` hashes the plan, so if `rebaseOverlay` stored frame 300 and #
 * # `overlayChoreography` clamped it to 208, two scenes drawing IDENTICAL   #
 * # pixels would carry different keys and re-render for no visible change.  #
 * # That is precisely the waste the box at the top of `renderKey.ts` exists #
 * # to prevent, so the clamp is computed ONCE, here, and both ends call it. #
 * ###########################################################################
 *
 * They were private to `apps/web/src/remotion/constants.ts` while the mark
 * always opened with its scene and the compositor was the only thing that
 * needed them. `constants.ts` re-exports them, so nothing there changes shape.
 */
/*
 * ##########################################################################
 * # `FILM_BURN_LEAD_FRAMES` (24, Saku's grayscale lead-in) WENT 2026-09-13. #
 * #                                                                        #
 * # Its argument survives and is now stronger: the planner writes a lead-in #
 * # length and the compositor draws it, so both must read ONE number. That #
 * # number is now per clip, `leadFrames` on a row of `OVERLAY_CLIPS` in     #
 * # `effects.ts`, which both packages import.                               #
 * ##########################################################################
 */

export const OVERLAY_ENTRY_FRAMES = 20
export const OVERLAY_HOLD_FRAMES = 60
export const OVERLAY_EXIT_FRAMES = 12
export const OVERLAY_READING_CHARS_PER_SECOND = 17

/**
 * A LINE NOBODY CAN FINISH READING IS WORSE THAN NO LINE.
 *
 * 26 characters at 17 per second is 46 frames, so a scene shorter than that
 * cannot hold its own longest legal overlay for long enough to be read even if
 * the mark were on screen for every frame of it.
 */
export const OVERLAY_MIN_READABLE_FRAMES = Math.ceil(
  (OVERLAY_MAX_CHARS / OVERLAY_READING_CHARS_PER_SECOND) * FPS,
)

/** Entry, hold and exit end to end. Under this the mark is drawn static. */
export const OVERLAY_FULL_TREATMENT_MIN_FRAMES =
  OVERLAY_ENTRY_FRAMES + OVERLAY_HOLD_FRAMES + OVERLAY_EXIT_FRAMES

/**
 * The latest frame of this scene at which a mark may still open.
 *
 * TWO DIFFERENT ANSWERS, because the two treatments end differently. An
 * `animated` mark must fit entry, hold AND exit before the shot ends, so it may
 * open no later than `durationFrames - 92`. A `static` mark never exits — it
 * simply stays until the cut — so all it owes the viewer is its entry plus a
 * full reading of the finished line, which is `durationFrames - 66`.
 *
 * Using the 46-frame floor here instead would be the subtle wrong answer. 46 is
 * ROOM, not reading: the entry eats 20 of it, so a mark opening that late shows
 * its formed line for 26 frames, and the band would quietly trade away the very
 * thing it exists to protect.
 *
 * BELOW 66 FRAMES THAT PROMISE CANNOT BE KEPT, and saying so is better than a
 * comment that reads as if it always is. `latest` goes negative there, the
 * `Math.max(0, ...)` floors it, and the mark opens with its shot however late
 * the model timed it — so a 46 to 65 frame scene shows its formed line for 26
 * to 45 frames. That is the worst case this band already shipped, unchanged; a
 * requested start can never make it worse, only fail to improve it.
 */
export function overlayStartFrame(durationFrames: number, requestedFrame: number): number {
  if (!Number.isFinite(requestedFrame) || requestedFrame <= 0) return 0
  if (durationFrames < OVERLAY_MIN_READABLE_FRAMES) return 0

  const latest =
    durationFrames < OVERLAY_FULL_TREATMENT_MIN_FRAMES
      ? durationFrames - (OVERLAY_ENTRY_FRAMES + OVERLAY_MIN_READABLE_FRAMES)
      : durationFrames - OVERLAY_FULL_TREATMENT_MIN_FRAMES

  return Math.max(0, Math.min(Math.floor(requestedFrame), latest))
}

/* ------------------------------------------------------------------------- */
/* The typewriter clock                                                        */
/* ------------------------------------------------------------------------- */

/**
 * ###########################################################################
 * # THIS CLOCK LIVES IN CORE FOR THE SAME REASON `overlayStartFrame` DOES,  #
 * # AND THE FAILURE IT PREVENTS IS AUDIBLE RATHER THAN VISIBLE.             #
 * #                                                                        #
 * # The compositor reveals an annotation a character at a time. `deliver`   #
 * # lays a keystroke under each WORD as it lands. Those are two packages    #
 * # doing the same arithmetic on the same string, and if they disagree by   #
 * # even two frames the sound stops belonging to the picture — which is     #
 * # the one thing the client asked for by name.                            #
 * #                                                                        #
 * # So neither end owns the timing. Both call `overlayTypeFrames` for the   #
 * # length and `overlayTypeWordOffsets` for the beats, and a click can only #
 * # land on a frame where a word actually appears.                          #
 * ###########################################################################
 */

/**
 * 1.6 FRAMES A CHARACTER, which is 53ms at 30fps and about 19 characters a
 * second.
 *
 * Chosen against the marks this film actually carries rather than in the
 * abstract. "Jerusalem" is 9 characters and types in 14 frames; "École
 * Biblique, Jerusalem" is 25 and types in 40. Faster than that and a short
 * mark is over before the eye finds it; slower and a long one is still
 * assembling itself when the shot cuts.
 *
 * A FRACTION ON PURPOSE. The reveal is a ratio across the whole string, not a
 * per-character switch, so this never has to be an integer and rounding it to
 * 2 would stretch a 40-character note by a quarter of a second.
 */
export const OVERLAY_TYPE_CHAR_FRAMES = 1.6

/**
 * The floor is the window the reveal used to have. Before this clock existed
 * every string, long or short, was uncovered across a flat 12 frames, so a
 * one-word mark behaves exactly as it did and only longer ones change.
 */
export const OVERLAY_TYPE_MIN_FRAMES = 12

/**
 * The reveal starts this far into the mark's own clock, after the scrim has
 * begun to rise. Unchanged from the flat window it replaces.
 */
export const OVERLAY_TYPE_DELAY_FRAMES = 8

/**
 * A FORMED LINE MUST STAND STILL LONG ENOUGH TO BE READ, and this is what
 * bounds the reveal rather than any judgement about typing speed.
 *
 * 30 frames is one second of finished, motionless text before the exit begins.
 */
export const OVERLAY_TYPE_MIN_FORMED_FRAMES = 30

/**
 * ###########################################################################
 * # DERIVED, NOT TYPED, AND THAT IS THE WHOLE POINT OF THE NUMBER.          #
 * #                                                                        #
 * # The reveal is spent INSIDE the entry and hold the mark already had. It  #
 * # does not extend the treatment, so `OVERLAY_FULL_TREATMENT_MIN_FRAMES`,  #
 * # `overlayStartFrame` and every clamp built on them are untouched, and no #
 * # plan written before this clock existed changes shape because of it.     #
 * #                                                                        #
 * # 20 + 60 - 8 - 30 = 42 frames, 1.4 seconds. A 64-character note — the    #
 * # longest the schema admits — types in that at 22ms a character, which is #
 * # brisk and still reads as a keyboard rather than a wipe.                 #
 * ###########################################################################
 */
export const OVERLAY_TYPE_MAX_FRAMES =
  OVERLAY_ENTRY_FRAMES +
  OVERLAY_HOLD_FRAMES -
  OVERLAY_TYPE_DELAY_FRAMES -
  OVERLAY_TYPE_MIN_FORMED_FRAMES

/**
 * How many frames THIS scene can give the reveal, which is not always the
 * derived ceiling.
 *
 * ###########################################################################
 * # THE COMPOSITOR AND `deliver` MUST ASK THIS QUESTION IDENTICALLY, so it  #
 * # is answered once, here, rather than twice with the same intent.         #
 * #                                                                        #
 * # It mirrors the three bands of `overlayChoreography`. Under 46 frames no #
 * # mark is drawn at all and there is no room for anything. Between 46 and  #
 * # 91 the mark is STATIC — it never exits, so the finished line stands     #
 * # until the cut and the room runs to the end of the shot. At 92 and above #
 * # the exit begins a fixed 80 frames after the mark opens, and the reveal  #
 * # gets what is left of that after the delay and the reading.              #
 * #                                                                        #
 * # The 46-frame worst case leaves 8, which the floor lifts back to 12 — so #
 * # the shortest legal scene still shows its formed line for 26 frames,     #
 * # which is exactly what the static branch already promised.                #
 * ###########################################################################
 */
export function overlayTypeRoom(durationFrames: number, requestedStartFrame = 0): number {
  if (durationFrames < OVERLAY_MIN_READABLE_FRAMES) return 0

  const at = overlayStartFrame(durationFrames, requestedStartFrame)
  const formedBy =
    durationFrames < OVERLAY_FULL_TREATMENT_MIN_FRAMES
      ? durationFrames
      : at + OVERLAY_ENTRY_FRAMES + OVERLAY_HOLD_FRAMES

  return Math.max(0, formedBy - at - OVERLAY_TYPE_DELAY_FRAMES - OVERLAY_TYPE_MIN_FORMED_FRAMES)
}

/**
 * The words of a mark, split EXACTLY the way the compositor splits them.
 *
 * `Note` splits on `/(\s+)/` and keeps the separators so the gaps uncover in
 * sequence with the letters either side. This drops the separators and keeps
 * nothing else, so the count here and the number of `inline-block` spans on
 * screen cannot come apart.
 */
export function overlayTypeWords(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0 && !/^\s+$/.test(part))
}

/**
 * How many frames the whole reveal takes for this string.
 *
 * `room` is what the mark's own window can afford, and it is passed in rather
 * than assumed because the `static` band has no exit and a short scene has
 * less of everything. Omit it and the derived ceiling applies.
 */
export function overlayTypeFrames(text: string, room: number = OVERLAY_TYPE_MAX_FRAMES): number {
  const characters = [...text].length
  if (characters === 0) return OVERLAY_TYPE_MIN_FRAMES

  const ceiling = Math.max(OVERLAY_TYPE_MIN_FRAMES, Math.min(OVERLAY_TYPE_MAX_FRAMES, room))
  const wanted = Math.round(characters * OVERLAY_TYPE_CHAR_FRAMES)

  return Math.max(OVERLAY_TYPE_MIN_FRAMES, Math.min(ceiling, wanted))
}

/**
 * The frame, counted from the first frame of the reveal, at which each word's
 * FIRST CHARACTER appears.
 *
 * ###########################################################################
 * # A KEYSTROKE GOES ON EACH OF THESE AND NOWHERE ELSE.                     #
 * #                                                                        #
 * # The reveal is linear across the CHARACTERS of the whole string, spaces  #
 * # included, because that is what the compositor draws. A word therefore   #
 * # starts at its own character offset scaled into the window, which is not #
 * # the same as dividing the window by the word count — "École Biblique,    #
 * # Jerusalem" would put its third beat at frame 27 by the honest reckoning #
 * # and at frame 27 as well by the naive one only because it happens to be  #
 * # three near-equal words. Longer, unevener marks come apart immediately.   #
 * ###########################################################################
 */
export function overlayTypeWordOffsets(
  text: string,
  room: number = OVERLAY_TYPE_MAX_FRAMES,
): number[] {
  const characters = [...text].length
  if (characters === 0) return []

  const frames = overlayTypeFrames(text, room)
  const offsets: number[] = []
  let consumed = 0

  for (const part of text.split(/(\s+)/).filter((piece) => piece.length > 0)) {
    if (!/^\s+$/.test(part)) {
      offsets.push(Math.round((consumed / characters) * frames))
    }
    consumed += [...part].length
  }

  return offsets
}

/* ------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* ------------------------------------------------------------------------- */

function fail(message: string): never {
  throw new Error(`plan invariant violated: ${message}`)
}

/**
 * The last gate before a plan is allowed to reach the renderer. Every check here
 * corresponds to a bug that is invisible in JSON and obvious in the finished
 * video.
 */
export function assertPlanInvariants(plan: VideoPlan): void {
  const { scenes, totalFrames } = plan

  if (!Number.isInteger(plan.fps) || plan.fps < 1) {
    fail(`fps must be a positive integer, got ${String(plan.fps)}`)
  }
  if (scenes.length === 0) fail('a plan must contain at least one scene')
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    fail(`totalFrames must be a positive integer, got ${String(totalFrames)}`)
  }

  let summed = 0

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i]
    if (scene === undefined) fail(`scene ${i} is missing`)

    if (scene.index !== i) fail(`scene at position ${i} carries index ${scene.index}`)
    if (!Number.isInteger(scene.startFrame) || scene.startFrame < 0) {
      fail(`scene ${i} has a non-integer or negative startFrame (${String(scene.startFrame)})`)
    }
    if (!Number.isInteger(scene.durationFrames) || scene.durationFrames < 1) {
      fail(`scene ${i} has durationFrames ${String(scene.durationFrames)}; every scene needs at least one frame`)
    }

    if (i === 0 && scene.startFrame !== 0) {
      fail(`scene 0 must start at frame 0, got ${scene.startFrame}`)
    }

    const next = scenes[i + 1]
    if (next !== undefined) {
      const expected = scene.startFrame + scene.durationFrames
      if (expected !== next.startFrame) {
        const kind = expected < next.startFrame ? 'gap' : 'overlap'
        fail(
          `${kind} between scene ${i} and ${i + 1}: scene ${i} ends at frame ${expected}, scene ${i + 1} starts at ${next.startFrame}`,
        )
      }
    } else if (scene.startFrame + scene.durationFrames !== totalFrames) {
      fail(
        `last scene ends at frame ${scene.startFrame + scene.durationFrames} but totalFrames is ${totalFrames}`,
      )
    }

    summed += scene.durationFrames

    if (scene.motion.fromScale < 1 || scene.motion.toScale < 1) {
      fail(
        `scene ${i} scales below 1.0 (${scene.motion.fromScale} -> ${scene.motion.toScale}); the image edges would be exposed`,
      )
    }
    /*
     * A SECOND, INDEPENDENT EASING GATE. `assertMotionSafe` checks the same
     * thing at derivation time, but this one runs over a whole plan that may
     * have been loaded from the database or hand-edited, so it cannot lean on
     * the deriver having been the author. Both had to be widened when the move
     * set grew from one easing to three; missing this one would have rejected
     * every plan the new deriver writes.
     */
    if (!EASING_NAMES.includes(scene.motion.easing)) {
      fail(`scene ${i} uses easing "${scene.motion.easing}"; only ${EASING_NAMES.join(', ')} are allowed`)
    }

    if (scene.transitionIn.durationFrames > scene.durationFrames) {
      fail(
        `scene ${i} transition (${scene.transitionIn.durationFrames}f) is longer than the scene itself (${scene.durationFrames}f)`,
      )
    }
    if (i === 0 && scene.transitionIn.type !== 'cut') {
      fail(`scene 0 must start on a cut, got "${scene.transitionIn.type}"`)
    }

    /*
     * plan C1: prevAsset only exists to be blended, so it is meaningless
     * anywhere else.
     *
     * ######################################################################
     * # `filmBurn` IS THE SECOND TYPE THAT CONSUMES IT, AND THAT IS WHY THE #
     * # LIST WIDENED RATHER THAN THE RULE RELAXING.                         #
     * #                                                                    #
     * # Saku's burn dissolves the OUTGOING photograph through a warm bloom  #
     * # into the incoming one, so like a crossfade it genuinely needs the   #
     * # frame before it. Every other type paints over the incoming segment  #
     * # alone and a `prevAsset` on one of those is dead weight in the render #
     * # key. Keep this exhaustive rather than dropping the check.           #
     * ######################################################################
     */
    /*
     * ######################################################################
     * # pushCut AND slide JOIN THE LIST, 2026-09-10, AND IT IS NOT OPTIONAL.#
     * #                                                                    #
     * # Both presets show the outgoing photograph travelling out while the #
     * # incoming one travels in, so both genuinely read the frame before   #
     * # them, exactly as the crossfade and the burn did. Leave either off  #
     * # this list and the plan REFUSES the `prevAsset` the planner just    #
     * # attached, which at least fails loudly.                             #
     * #                                                                    #
     * # THE DANGEROUS DIRECTION IS THE OTHER ONE. Put them here and forget #
     * # the emit gate in `plan.ts` and there is no error at all: the scene #
     * # simply carries no `prevAsset`, the compositor has no outgoing      #
     * # picture to move, and the transition draws against an empty frame.  #
     * # The two conditions have to agree and only one of them is checked.  #
     * ######################################################################
     */
    /*
     * ######################################################################
     * # `filmBurn` LEFT THIS LIST 2026-09-13. Saku's burn dissolved the    #
     * # OUTGOING photograph; Niku's clip is screened over each shot on its #
     * # own side of the cut and never reads the other one. A `prevAsset`  #
     * # on a burn is dead weight in the render key, and the planner's emit #
     * # gate stopped attaching one in the same change, so the two agree.   #
     * ######################################################################
     */
    const BLENDS_BACKWARDS: readonly TransitionType[] = [
      'crossfade',
      'pushCut',
      'slide',
    ]
    if (scene.prevAsset !== null && !BLENDS_BACKWARDS.includes(scene.transitionIn.type)) {
      fail(`scene ${i} carries prevAsset but its transition is "${scene.transitionIn.type}", which does not blend backwards`)
    }
    /*
     * The same zero-frame guard the flash has, and for the same reason: the
     * sizing ternary in `buildSceneDrafts` is exhaustive by falling through to
     * `: 0`, so a member with no arm silently gets zero frames and `Scene.tsx`
     * returns null under 1. The plan would validate, the render would succeed,
     * and the film would come back with no burn in it.
     */
    if (scene.transitionIn.type === 'filmBurn' && scene.transitionIn.durationFrames < 1) {
      fail(`scene ${i} is a film burn of zero frames`)
    }
    if (scene.transitionIn.type === 'crossfade' && scene.transitionIn.durationFrames < 1) {
      fail(`scene ${i} is a crossfade of zero frames`)
    }
    /*
     * The same guard for a flash, and it is the one that matters most for this
     * type. `buildSceneDrafts` sizes transitions with a ternary that is
     * exhaustive by FALLING THROUGH to `: 0` rather than by `assertNever`, so a
     * member with no arm gets zero frames — and `Scene.tsx` returns null under 1.
     * Without this the plan validates, the render succeeds, and the film comes
     * back six hours later looking exactly as it did before.
     */
    if (scene.transitionIn.type === 'flash' && scene.transitionIn.durationFrames < 1) {
      fail(`scene ${i} is a flash of zero frames`)
    }
    /*
     * ######################################################################
     * # THE SAME GUARD FOR THE CLIENT'S TWO NEW TRANSITIONS, AND THIS IS   #
     * # THE MOST IMPORTANT DEFENSIVE LINE IN THE WHOLE ADDITION.            #
     * #                                                                    #
     * # The failure it catches costs two hours of render time and looks    #
     * # exactly like success. A type with no arm in the sizing ternary gets #
     * # zero frames, `Scene.tsx` returns null below one frame, the plan     #
     * # validates, the render exits 0, and the film comes back byte for     #
     * # byte what it was. His 6% and 3% would simply not be there and       #
     * # nothing anywhere would say so.                                      #
     * #                                                                    #
     * # A ZERO HERE IS ALWAYS A BUG, NEVER A SHORT SCENE. The ternary       #
     * # clamps with `Math.max(1, ...)`, so a beat too short to hold the     #
     * # full window still gets one frame. Zero only ever means the arm is   #
     * # missing.                                                            #
     * ######################################################################
     */
    if (scene.transitionIn.type === 'pushCut' && scene.transitionIn.durationFrames < 1) {
      fail(`scene ${i} is a pushCut of zero frames`)
    }
    if (scene.transitionIn.type === 'slide' && scene.transitionIn.durationFrames < 1) {
      fail(`scene ${i} is a slide of zero frames`)
    }
    if (i === 0 && scene.prevAsset !== null) fail('scene 0 cannot have a prevAsset')

    /*
     * plan C1b: prevAsset must describe the PREVIOUS scene, and off-by-one here
     * is silent.
     *
     * The planner carries `previousAsset`, `previousMotion` and `previousCrop`
     * as cursors updated at the bottom of its loop, so storing the CURRENT
     * scene's values instead is a one-line slip that still parses, still
     * renders, and produces exactly the artefact prevAsset.crop was added to
     * prevent — the outgoing picture framed as the incoming one. A fixture test
     * pins two scenes; this holds for all 375 of a real plan.
     *
     * The crop is compared field by field rather than by reference: the two
     * objects come from separate `chooseCrop` calls and are never the same
     * instance.
     */
    const previous = i > 0 ? scenes[i - 1] : undefined
    if (scene.prevAsset !== null && previous !== undefined) {
      if (previous.asset === null) {
        fail(`scene ${i} carries a prevAsset but scene ${i - 1} has no asset to blend from`)
      } else if (scene.prevAsset.contentHash !== previous.asset.contentHash) {
        fail(
          `scene ${i} prevAsset is not scene ${i - 1}'s image (contentHash ${scene.prevAsset.contentHash.slice(0, 12)} vs ${previous.asset.contentHash.slice(0, 12)})`,
        )
      }
      if (
        scene.prevAsset.crop.mode !== previous.crop.mode ||
        scene.prevAsset.crop.anchor.x !== previous.crop.anchor.x ||
        scene.prevAsset.crop.anchor.y !== previous.crop.anchor.y
      ) {
        fail(
          `scene ${i} prevAsset.crop is "${scene.prevAsset.crop.mode}" but scene ${i - 1} rendered as "${previous.crop.mode}"; the dissolve would reframe the outgoing picture`,
        )
      }
    }

    /*
     * ######################################################################
     * # NIKU'S LIGHT BURN STRADDLES THE CUT, SO IT IS TWO HALVES ON TWO    #
     * # SEGMENTS, AND A HALF ON ITS OWN IS THE SILENT FAILURE.             #
     * #                                                                    #
     * # The outgoing shot draws the clip's first `leadFrames` over its own #
     * # last frames (`transitionOut`), the incoming shot draws the rest    #
     * # over its first (`transitionIn`). Lose the lead-in and the burn     #
     * # starts ON the cut instead of peaking there; lose the burn and the  #
     * # shot flares and then simply cuts. A clip id the table does not     #
     * # list draws nothing at exit 0. None of those throws anywhere else.  #
     * # T-24 holds the same rule for frozen plans, which skip this.        #
     * ######################################################################
     */
    if (scene.transitionIn.type === 'filmBurn') {
      const clip = overlayClipById(scene.transitionIn.clip)
      if (clip === null) {
        fail(`scene ${i} is a film burn naming no known clip ("${String(scene.transitionIn.clip)}")`)
      } else {
        const tail = overlayClipTailFrames(clip)
        if (scene.transitionIn.durationFrames !== tail) {
          fail(
            `scene ${i} draws ${scene.transitionIn.durationFrames} frames of ${clip.id}, whose incoming half is ${tail}`,
          )
        }
        const lead = previous?.transitionOut ?? null
        if (
          lead === null ||
          lead.type !== 'filmBurn' ||
          lead.clip !== clip.id ||
          lead.durationFrames !== clip.leadFrames
        ) {
          fail(`scene ${i} is a ${clip.id} burn but scene ${i - 1} carries no matching ${clip.leadFrames}-frame lead-in`)
        }
      }
    }
    if (scene.transitionOut !== null) {
      if (scene.transitionOut.type !== 'filmBurn') {
        fail(
          `scene ${i} carries a "${scene.transitionOut.type}" transitionOut, and only a film burn draws on the outgoing shot`,
        )
      } else if (
        next === undefined ||
        next.transitionIn.type !== 'filmBurn' ||
        next.transitionIn.clip !== scene.transitionOut.clip
      ) {
        fail(`scene ${i} carries a burn lead-in but scene ${i + 1} is not that burn`)
      }
      if (scene.transitionOut.durationFrames + scene.transitionIn.durationFrames > scene.durationFrames) {
        fail(
          `scene ${i} lead-in (${scene.transitionOut.durationFrames}f) overlaps its own transition (${scene.transitionIn.durationFrames}f) in a ${scene.durationFrames}-frame scene`,
        )
      }
    }

    /*
     * KEYED OFF THE CARD, NOT OFF THE SCENE TYPE.
     *
     * "A titleCard must have a textCard" is now FALSE BY DESIGN. A title beat
     * that found a photograph renders the photograph and says its piece as a
     * mark on top of it, which is what the client asked for. Left in place this
     * check threw on every such scene and failed the whole plan.
     *
     * What survives is the half that was always the real rule: two blocks of
     * type in one frame is the defect, and the card is what puts the first one
     * there. The `asset === null && textCard === null` check below is still what
     * guarantees every scene shows SOMETHING.
     */
    if (scene.textCard !== null && scene.captions.length > 0) {
      fail(`scene ${i} shows a text card but carries ${scene.captions.length} captions`)
    }
    if (scene.asset === null && scene.textCard === null) {
      fail(`scene ${i} has neither an asset nor a textCard; it would render as black`)
    }

    /*
     * A mark that opens outside its own shot is invisible, and invisible is the
     * one failure mode this device has that nothing else would report. The bound
     * is the COMPOSITOR's, from `overlayStartFrame`, not merely "inside the
     * scene" — a mark that opens with 30 frames left is technically in range and
     * still cannot finish its exit.
     */
    /*
     * TWO BLOCKS OF TYPE IN ONE FRAME, the other way round. A card and a mark on
     * the same frame is the shape the client asked us to stop making, and until
     * this existed nothing checked it.
     *
     * ######################################################################
     * # NARROWED 2026-08-18. THE TEST IS "IS THE CARD ACTUALLY DRAWN", NOT #
     * # "DOES A CARD OBJECT EXIST", AND THE TWO STOPPED MEANING THE SAME   #
     * # THING THE DAY A HELD SHOT WAS ALLOWED TO CARRY A MARK.             #
     * #                                                                    #
     * # A scene with no photograph of its own still gets a `textCard` from #
     * # the sourcing ladder, but when it has an earlier picture to inherit #
     * # the compositor draws that picture and never the card. So the plan  #
     * # legitimately holds both, and the frame carries exactly one block   #
     * # of type — the mark, over a real photograph.                        #
     * #                                                                    #
     * # The condition below is the COMPOSITOR's own `showsTextCard`        #
     * # verbatim (`Scene.tsx`): a card is on screen only when the scene has #
     * # no asset AND no inherited background to draw instead. Restating it #
     * # in a second dialect is how these two would drift, so if that       #
     * # predicate changes, change this in the same commit.                 #
     * #                                                                    #
     * # The un-narrowed version threw on every held shot carrying a date,  #
     * # which is a plan the pipeline is now expected to produce. It was    #
     * # invisible to the suite because `buildVideoPlan` does not call this #
     * # — only `runPlan` does — so it would have failed at the plan stage  #
     * # of a real job with 1,766 tests green.                              #
     * ######################################################################
     */
    const cardIsDrawn =
      scene.textCard !== null &&
      scene.asset === null &&
      scene.textCard.backgroundAssetPath === null
    if (cardIsDrawn && scene.overlay !== null) {
      fail(`scene ${i} shows a text card AND an overlay; only one block of type may be on a frame`)
    }

    if (scene.overlay?.startFrame != null) {
      const latest = overlayStartFrame(scene.durationFrames, scene.durationFrames)
      if (scene.overlay.startFrame < 0 || scene.overlay.startFrame > latest) {
        fail(
          `scene ${i} overlay starts at relative frame ${scene.overlay.startFrame}, outside [0, ${latest}] for a ${scene.durationFrames}-frame scene`,
        )
      }
    }

    assertCaptionsInsideScene(scene.captions, scene.durationFrames, i)

    if (scene.textCard !== null) {
      for (const word of scene.textCard.words) {
        if (word.startFrame < 0 || word.startFrame >= scene.durationFrames) {
          fail(
            `scene ${i} text-card word "${word.text}" starts at relative frame ${word.startFrame}, outside [0, ${scene.durationFrames})`,
          )
        }
      }
    }
  }

  if (summed !== totalFrames) {
    fail(`scene durations sum to ${summed} but totalFrames is ${totalFrames}`)
  }
}

function assertCaptionsInsideScene(
  captions: readonly CaptionPhrase[],
  durationFrames: number,
  sceneIndex: number,
): void {
  let previousEnd = -1

  for (let p = 0; p < captions.length; p += 1) {
    const phrase = captions[p]
    if (phrase === undefined) fail(`scene ${sceneIndex} caption ${p} is missing`)

    if (phrase.endFrame <= phrase.startFrame) {
      fail(
        `scene ${sceneIndex} caption ${p} has endFrame ${phrase.endFrame} <= startFrame ${phrase.startFrame}; it would flicker`,
      )
    }
    if (phrase.startFrame < previousEnd) {
      fail(`scene ${sceneIndex} caption ${p} overlaps caption ${p - 1}`)
    }
    if (phrase.startFrame < 0 || phrase.endFrame > durationFrames) {
      fail(
        `scene ${sceneIndex} caption ${p} spans [${phrase.startFrame}, ${phrase.endFrame}) which escapes the scene [0, ${durationFrames}). Captions inside a PlannedScene are scene-relative.`,
      )
    }
    previousEnd = phrase.endFrame

    let previousWordEnd = -1
    for (let w = 0; w < phrase.words.length; w += 1) {
      const word = phrase.words[w]
      if (word === undefined) fail(`scene ${sceneIndex} caption ${p} word ${w} is missing`)
      if (word.endFrame <= word.startFrame) {
        fail(
          `scene ${sceneIndex} caption ${p} word "${word.text}" has endFrame ${word.endFrame} <= startFrame ${word.startFrame}; it would flicker`,
        )
      }
      if (word.startFrame < previousWordEnd) {
        fail(`scene ${sceneIndex} caption ${p} word "${word.text}" overlaps the previous word`)
      }
      previousWordEnd = word.endFrame
    }
  }
}
