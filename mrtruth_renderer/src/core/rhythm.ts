import { deterministicUnit, msToFrame, msToFrameCeil } from './frames.js'
import type { ScenePlacement } from './frames.js'
import type { WordTiming } from './schemas.js'

/**
 * Scene-duration rhythm.
 *
 * Uniform ~3.8s scenes is the single loudest "a machine made this" tell, and it
 * survives every other quality improvement. This module cuts on the narrator's
 * breaths and enforces a DISTRIBUTION of scene lengths rather than a mean.
 *
 * Everything here is deterministic. Variation comes from the scene index and the
 * word timings, never from `Math.random()`, because the same plan must always
 * produce the same video.
 */

/** A gap at least this long is a phrase boundary. */
export const PHRASE_GAP_MS = 220
/** A gap at least this long is a sentence boundary. */
export const SENTENCE_GAP_MS = 400
/**
 * Cut this many frames BEFORE the next word starts. Landing the cut exactly on
 * the word reads mechanical; arriving a beat early reads like an editor.
 */
export const CUT_LEAD_FRAMES = 2
/** Emit one rest beat roughly this often. */
export const REST_BEAT_INTERVAL_MS = 90_000

export type BreathKind = 'phrase' | 'sentence'

export type BreathBoundary = {
  /** Index of the word BEFORE the gap. */
  wordIndex: number
  /** The real word end. A boundary is never an invented timestamp. */
  endMs: number
  /** Where the next word begins; the cut is placed relative to this. */
  nextStartMs: number
  gapMs: number
  kind: BreathKind
}

export type RhythmBucketName = 'short' | 'mid' | 'long' | 'epic' | 'rest'

export type RhythmBucket = {
  name: RhythmBucketName
  /** Preferred window. */
  lo: number
  hi: number
  /** Absolute window, used only when the preferred one contains no breath. */
  floor: number
  ceil: number
}

/**
 * The target distribution: ~20% at 1.8-2.6s, ~55% at 3.2-4.5s, ~20% at 5.5-8s,
 * ~5% at 9-12s. `floor`/`ceil` widen the search when no breath lands inside the
 * preferred window, but never far enough to reclassify the scene into a
 * neighbouring bucket.
 */
export const RHYTHM_BUCKETS: Record<RhythmBucketName, RhythmBucket> = {
  short: { name: 'short', lo: 1800, hi: 2600, floor: 1500, ceil: 2950 },
  mid: { name: 'mid', lo: 3200, hi: 4500, floor: 3050, ceil: 4950 },
  long: { name: 'long', lo: 5500, hi: 8000, floor: 5050, ceil: 8450 },
  epic: { name: 'epic', lo: 9000, hi: 12_000, floor: 8550, ceil: 14_000 },
  rest: { name: 'rest', lo: 1500, hi: 2500, floor: 1400, ceil: 2900 },
}

/**
 * 20 slots: 4 short, 11 mid, 4 long, 1 epic. Interleaved rather than clumped, so
 * the distribution is right at every scale — three long scenes in a row would be
 * as obviously patterned as uniform ones.
 */
const BUCKET_PATTERN: readonly RhythmBucketName[] = [
  'mid', 'short', 'mid', 'mid', 'long',
  'mid', 'short', 'mid', 'mid', 'long',
  'mid', 'short', 'mid', 'epic', 'mid',
  'long', 'mid', 'short', 'mid', 'long',
]

/** Scenes shorter than this count toward the "too many quick cuts" rule. */
const SHORT_SCENE_MS = 3000

/**
 * After three consecutive scenes under 3s the eye needs somewhere to rest, so
 * the next scene is forced long regardless of where the pattern is.
 */
export function selectBucket(patternIndex: number, consecutiveShort: number): RhythmBucket {
  if (consecutiveShort >= 3) {
    return { name: 'long', lo: 6000, hi: 8000, floor: 6000, ceil: 8450 }
  }
  const name = BUCKET_PATTERN[Math.abs(Math.trunc(patternIndex)) % BUCKET_PATTERN.length] ?? 'mid'
  return { ...RHYTHM_BUCKETS[name] }
}

export function classifyDuration(durationMs: number): Exclude<RhythmBucketName, 'rest'> {
  if (durationMs < SHORT_SCENE_MS) return 'short'
  if (durationMs < 5000) return 'mid'
  if (durationMs < 8500) return 'long'
  return 'epic'
}

const SENTENCE_PUNCTUATION = /[.!?]["'’”)]*$/

/**
 * Find every place the narrator took a breath.
 *
 * Deepgram returns punctuated words, so a word ending in terminal punctuation is
 * treated as a sentence boundary even when the pause is short — the sense of the
 * sentence has ended whether or not the narrator waited.
 */
export function findBreathBoundaries(
  words: readonly WordTiming[],
  options: { phraseGapMs?: number; sentenceGapMs?: number } = {},
): BreathBoundary[] {
  const phraseGapMs = options.phraseGapMs ?? PHRASE_GAP_MS
  const sentenceGapMs = options.sentenceGapMs ?? SENTENCE_GAP_MS
  const out: BreathBoundary[] = []

  for (let i = 0; i < words.length - 1; i += 1) {
    const word = words[i]
    const next = words[i + 1]
    if (word === undefined || next === undefined) continue

    const gapMs = next.startMs - word.endMs
    const punctuated = SENTENCE_PUNCTUATION.test(word.word)

    let kind: BreathKind | null = null
    if (gapMs >= sentenceGapMs || (punctuated && gapMs >= phraseGapMs / 2)) kind = 'sentence'
    else if (gapMs >= phraseGapMs) kind = 'phrase'
    if (kind === null) continue

    out.push({ wordIndex: i, endMs: word.endMs, nextStartMs: next.startMs, gapMs, kind })
  }

  return out
}

export type RhythmCut = {
  index: number
  /** Narration span. `endMs` is always a real word end. */
  startMs: number
  endMs: number
  /** Visual placement, including the two-frame lead. Contiguous by construction. */
  startFrame: number
  endFrame: number
  durationFrames: number
  /** What the scene actually turned out to be. */
  bucket: RhythmBucketName
  /** What the pattern asked for. Differs when no breath was available. */
  targetBucket: RhythmBucketName
  /** A rest beat renders with no caption and slowed motion. */
  isRestBeat: boolean
  boundaryKind: BreathKind | 'hard'
}

export type RhythmOptions = {
  phraseGapMs?: number
  sentenceGapMs?: number
  restBeatIntervalMs?: number
  cutLeadFrames?: number
  /** Defaults to the last word's end. */
  audioEndMs?: number
}

/** A sentence boundary is worth this much slack when scoring against the target. */
const SENTENCE_PREFERENCE_MS = 300
/** Never leave a stub shorter than this at the end of the video. */
const MIN_TAIL_MS = 1200

type Candidate = { wordIndex: number; endMs: number; nextStartMs: number; kind: BreathKind | 'hard' }

function pickBoundary(
  boundaries: readonly BreathBoundary[],
  fromWordIndex: number,
  loMs: number,
  hiMs: number,
  targetMs: number,
): Candidate | null {
  let best: Candidate | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const boundary of boundaries) {
    if (boundary.wordIndex < fromWordIndex) continue
    if (boundary.nextStartMs < loMs) continue
    if (boundary.nextStartMs > hiMs) break

    const bonus = boundary.kind === 'sentence' ? SENTENCE_PREFERENCE_MS : 0
    const score = Math.abs(boundary.nextStartMs - targetMs) - bonus
    if (score < bestScore) {
      bestScore = score
      best = {
        wordIndex: boundary.wordIndex,
        endMs: boundary.endMs,
        nextStartMs: boundary.nextStartMs,
        kind: boundary.kind,
      }
    }
  }

  return best
}

function pickWordEnd(
  words: readonly WordTiming[],
  fromWordIndex: number,
  loMs: number,
  hiMs: number,
  targetMs: number,
): Candidate | null {
  let best: Candidate | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let i = fromWordIndex; i < words.length - 1; i += 1) {
    const word = words[i]
    const next = words[i + 1]
    if (word === undefined || next === undefined) continue
    if (next.startMs < loMs) continue
    if (next.startMs > hiMs) break

    const score = Math.abs(next.startMs - targetMs)
    if (score < bestScore) {
      bestScore = score
      best = { wordIndex: i, endMs: word.endMs, nextStartMs: next.startMs, kind: 'hard' }
    }
  }

  return best
}

/**
 * Plan the cut rhythm for a whole voiceover.
 *
 * The returned cuts are contiguous in frame space: `cut[i].endFrame ===
 * cut[i+1].startFrame`, starting at 0. Feed them to `rhythmPlacements()` to get
 * scene placements that preserve the two-frame cut lead.
 */
export function planRhythm(
  words: readonly WordTiming[],
  fps: number,
  options: RhythmOptions = {},
): RhythmCut[] {
  if (words.length === 0) throw new Error('planRhythm: cannot plan rhythm without word timings')

  const lastWord = words[words.length - 1]
  if (lastWord === undefined) throw new Error('planRhythm: word list is malformed')

  const audioEndMs = options.audioEndMs ?? lastWord.endMs
  const restIntervalMs = options.restBeatIntervalMs ?? REST_BEAT_INTERVAL_MS
  const cutLead = options.cutLeadFrames ?? CUT_LEAD_FRAMES
  const finalFrame = Math.max(1, msToFrameCeil(audioEndMs, fps))

  const boundaries = findBreathBoundaries(words, options)

  const cuts: RhythmCut[] = []
  let patternIndex = 0
  let consecutiveShort = 0
  let lastRestStartMs = 0
  let cursorWord = 0
  let startMs = 0
  let startFrame = 0

  // hard stop: every iteration consumes at least RHYTHM_BUCKETS.rest.floor of audio
  const maxIterations = Math.ceil(audioEndMs / 1000) + 16

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const remaining = audioEndMs - startMs
    if (remaining <= 0) break

    const wantsRest =
      cuts.length > 0 &&
      startMs - lastRestStartMs >= restIntervalMs &&
      remaining > RHYTHM_BUCKETS.rest.ceil + MIN_TAIL_MS

    const bucket = wantsRest ? { ...RHYTHM_BUCKETS.rest } : selectBucket(patternIndex, consecutiveShort)

    // not enough audio left for another full scene plus a usable tail: finish here
    if (remaining <= bucket.ceil + MIN_TAIL_MS) {
      cuts.push(
        makeCut({
          index: cuts.length,
          startMs,
          endMs: audioEndMs,
          startFrame,
          endFrame: Math.max(finalFrame, startFrame + 1),
          durationMs: remaining,
          targetBucket: bucket.name,
          // whatever audio is left over is a tail, not a designed rest beat
          isRestBeat: false,
          boundaryKind: 'hard',
        }),
      )
      break
    }

    const targetMs = startMs + Math.round(bucket.lo + (bucket.hi - bucket.lo) * deterministicUnit(cuts.length * 2654435761))

    const pick =
      pickBoundary(boundaries, cursorWord, startMs + bucket.lo, startMs + bucket.hi, targetMs) ??
      pickBoundary(boundaries, cursorWord, startMs + bucket.floor, startMs + bucket.ceil, targetMs) ??
      pickWordEnd(words, cursorWord, startMs + bucket.floor, startMs + bucket.ceil, targetMs)

    if (pick === null) {
      cuts.push(
        makeCut({
          index: cuts.length,
          startMs,
          endMs: audioEndMs,
          startFrame,
          endFrame: Math.max(finalFrame, startFrame + 1),
          durationMs: remaining,
          targetBucket: bucket.name,
          isRestBeat: false,
          boundaryKind: 'hard',
        }),
      )
      break
    }

    const rawEndFrame = msToFrame(pick.nextStartMs, fps) - cutLead
    const endFrame = Math.max(Math.min(rawEndFrame, finalFrame - 1), startFrame + 1)
    const durationMs = pick.nextStartMs - startMs

    cuts.push(
      makeCut({
        index: cuts.length,
        startMs,
        endMs: pick.endMs,
        startFrame,
        endFrame,
        durationMs,
        targetBucket: bucket.name,
        isRestBeat: wantsRest,
        boundaryKind: pick.kind,
      }),
    )

    if (wantsRest) lastRestStartMs = startMs
    else patternIndex += 1

    consecutiveShort = durationMs < SHORT_SCENE_MS ? consecutiveShort + 1 : 0

    startMs = pick.nextStartMs
    startFrame = endFrame
    cursorWord = pick.wordIndex + 1
  }

  const last = cuts[cuts.length - 1]
  if (last === undefined) {
    return [
      makeCut({
        index: 0,
        startMs: 0,
        endMs: audioEndMs,
        startFrame: 0,
        endFrame: finalFrame,
        durationMs: audioEndMs,
        targetBucket: 'mid',
        isRestBeat: false,
        boundaryKind: 'hard',
      }),
    ]
  }
  if (last.endFrame !== finalFrame) {
    last.endFrame = Math.max(finalFrame, last.startFrame + 1)
    last.endMs = audioEndMs
    last.durationFrames = last.endFrame - last.startFrame
  }

  return cuts
}

type CutInput = {
  index: number
  startMs: number
  endMs: number
  startFrame: number
  endFrame: number
  /**
   * Measured start-of-scene to start-of-next-word, i.e. the same quantity the
   * bucket windows are expressed in. Classifying on `endMs - startMs` instead
   * would subtract the breath gap and drop scenes into the bucket below.
   */
  durationMs: number
  targetBucket: RhythmBucketName
  isRestBeat: boolean
  boundaryKind: BreathKind | 'hard'
}

function makeCut(input: CutInput): RhythmCut {
  return {
    index: input.index,
    startMs: input.startMs,
    endMs: input.endMs,
    startFrame: input.startFrame,
    endFrame: input.endFrame,
    durationFrames: input.endFrame - input.startFrame,
    bucket: input.isRestBeat ? 'rest' : classifyDuration(input.durationMs),
    targetBucket: input.targetBucket,
    isRestBeat: input.isRestBeat,
    boundaryKind: input.boundaryKind,
  }
}

/**
 * Convert rhythm cuts to scene placements.
 *
 * Preferred over `planSceneFrames` when the cuts came from here, because it
 * keeps the two-frame cut lead that `planSceneFrames` would recompute away.
 */
export function rhythmPlacements(cuts: readonly RhythmCut[], totalFrames: number): ScenePlacement[] {
  if (cuts.length === 0) throw new Error('rhythmPlacements: no cuts')
  if (totalFrames < cuts.length) {
    throw new Error(`rhythmPlacements: ${cuts.length} cuts cannot fit in ${totalFrames} frames`)
  }

  const placements: ScenePlacement[] = []

  for (let i = 0; i < cuts.length; i += 1) {
    const cut = cuts[i]
    if (cut === undefined) throw new Error('rhythmPlacements: internal indexing error')

    const previous = placements[i - 1]
    const startFrame = previous === undefined ? 0 : previous.startFrame + previous.durationFrames
    const nextCut = cuts[i + 1]
    const rawEnd = nextCut === undefined ? totalFrames : nextCut.startFrame
    const endFrame = Math.min(Math.max(rawEnd, startFrame + 1), totalFrames - (cuts.length - 1 - i))

    placements.push({ index: i, startFrame, durationFrames: endFrame - startFrame })
  }

  const last = placements[placements.length - 1]
  if (last === undefined) throw new Error('rhythmPlacements: internal indexing error')
  last.durationFrames = totalFrames - last.startFrame
  if (last.durationFrames < 1) {
    throw new Error(`rhythmPlacements: last scene would be ${last.durationFrames} frames long`)
  }

  return placements
}
