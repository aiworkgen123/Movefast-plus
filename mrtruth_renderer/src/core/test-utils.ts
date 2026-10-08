import { DEFAULT_GRADE, FPS } from './schemas.js'
import type { AssetVision, PlannedScene, VideoPlan, WordTiming } from './schemas.js'

/** Test fixtures. Not part of the public API — excluded from the build. */

export function hex64(seed: string): string {
  const base = seed.replace(/[^0-9a-f]/g, '') || '0'
  return base.repeat(Math.ceil(64 / base.length)).slice(0, 64)
}

export function makeVision(overrides: Partial<AssetVision> = {}): AssetVision {
  return {
    score: 8,
    reason: 'test fixture',
    shotScale: 'wide',
    subjectAnchor: { x: 0.5, y: 0.5 },
    meanLuma: 0.5,
    dominantHue: 30,
    hasBakedText: false,
    ...overrides,
  }
}

export function makeScene(overrides: Partial<PlannedScene> = {}): PlannedScene {
  const base: PlannedScene = {
    index: 0,
    startFrame: 0,
    durationFrames: 120,
    sceneType: 'imagery',
    locked: false,
    version: 1,
    asset: {
      path: 'assets/ab/cd/fixture.jpg',
      contentHash: hex64('abc'),
      type: 'image',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fixture.jpg',
      license: 'CC BY-SA 4.0',
      attribution: 'Fixture Photographer',
      vision: makeVision(),
      /** A photograph, which is what nearly every asset is. See `PlannedAssetSchema.generator`. */
      generator: null,
    sourceBeatId: null,
    },
    crop: { mode: 'fill', anchor: { x: 0.5, y: 0.5 } },
    motion: {
      type: 'kenBurns',
      fromScale: 1,
      toScale: 1.12,
      fromX: -0.2,
      toX: 0.2,
      fromY: 0,
      toY: 0,
      easing: 'linearOut',
    },
    transitionIn: { type: 'cut', durationFrames: 0 },
    transitionOut: null,
    prevAsset: null,
    captions: [
      {
        startFrame: 0,
        endFrame: 60,
        words: [
          { text: 'the', startFrame: 0, endFrame: 20 },
          { text: 'winter', startFrame: 20, endFrame: 60 },
        ],
      },
    ],
    textCard: null,
    /** No overlay, which is what ~90% of a real film's scenes carry. */
    overlay: null,
    device: null,
    companions: [],
    grade: { ...DEFAULT_GRADE },
    renderKey: hex64('def'),
  }
  return { ...base, ...overrides }
}

export function makePlan(scenes: PlannedScene[], totalFrames?: number): VideoPlan {
  const last = scenes[scenes.length - 1]
  return {
    id: '11111111-1111-4111-8111-111111111111',
    fps: FPS,
    dimensions: { width: 1920, height: 1080 },
    audio: {
      voiceoverPath: 'uploads/voiceover.wav',
      musicPath: 'uploads/music.mp3',
      duckingThreshold: 0.03,
      musicGainDb: -18,
    },
    scenes,
    totalFrames: totalFrames ?? (last === undefined ? 1 : last.startFrame + last.durationFrames),
    openingBoundary: null,
    contentHash: hex64('fed'),
  }
}

/** Contiguous scenes of `durationFrames` each, correctly placed. */
export function makeContiguousScenes(count: number, durationFrames: number): PlannedScene[] {
  const scenes: PlannedScene[] = []
  for (let i = 0; i < count; i += 1) {
    scenes.push(
      makeScene({
        index: i,
        startFrame: i * durationFrames,
        durationFrames,
        captions: [],
      }),
    )
  }
  return scenes
}

export type SynthWordOptions = {
  wordMs?: number
  gapMs?: number
  /** Every Nth word is followed by a phrase-length pause. */
  phraseEvery?: number
  phraseGapMs?: number
  /** Every Nth word is followed by a sentence-length pause and gets a full stop. */
  sentenceEvery?: number
  sentenceGapMs?: number
}

/**
 * A synthetic narration track with realistic breath structure: a phrase pause
 * roughly every three words and a sentence pause roughly every eleven.
 */
export function synthWords(totalMs: number, options: SynthWordOptions = {}): WordTiming[] {
  const wordMs = options.wordMs ?? 260
  const gapMs = options.gapMs ?? 30
  const phraseEvery = options.phraseEvery ?? 3
  const phraseGapMs = options.phraseGapMs ?? 240
  const sentenceEvery = options.sentenceEvery ?? 11
  const sentenceGapMs = options.sentenceGapMs ?? 460

  const words: WordTiming[] = []
  let cursor = 0
  let i = 0

  while (cursor + wordMs <= totalMs) {
    const isSentence = (i + 1) % sentenceEvery === 0
    const isPhrase = (i + 1) % phraseEvery === 0
    words.push({
      word: isSentence ? `word${i}.` : `word${i}`,
      startMs: cursor,
      endMs: cursor + wordMs,
      confidence: 0.94,
    })
    cursor += wordMs + (isSentence ? sentenceGapMs : isPhrase ? phraseGapMs : gapMs)
    i += 1
  }

  return words
}
