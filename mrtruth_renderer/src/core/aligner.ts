import { createReadStream } from 'node:fs'
import path from 'node:path'
import { request } from 'undici'
import { z } from 'zod'
import type { WordTiming } from './schemas.js'

/**
 * Stage 2 — word-level timing.
 *
 * This array is the spine of the entire system: captions, cuts and text-card
 * reveals all key off it. If the timing drifts, everything drifts.
 *
 * Deepgram rather than local WhisperX because the target hardware has two cores
 * and no CUDA — `large-v3` takes about an hour for a ten-minute file there. The
 * interface exists so that a GPU box later makes WhisperX a drop-in.
 */

export interface Aligner {
  align(audioPath: string, scriptHint?: string): Promise<WordTiming[]>
}

/**
 * PINNED. Deepgram ships model changes under moving aliases; an alias would let
 * a silent upstream update shift every timestamp in a rendered video, and the
 * segment cache would happily serve the old segments alongside new ones.
 */
export const DEEPGRAM_MODEL = 'nova-3'
export const DEEPGRAM_ENDPOINT = 'https://api.deepgram.com/v1/listen'

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
}

export class AlignerError extends Error {
  override readonly name = 'AlignerError'
  readonly statusCode: number | undefined

  constructor(message: string, statusCode?: number) {
    super(message)
    this.statusCode = statusCode
  }
}

const DeepgramWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number().optional(),
  punctuated_word: z.string().optional(),
})

const DeepgramResponseSchema = z.object({
  results: z.object({
    channels: z
      .array(
        z.object({
          alternatives: z
            .array(
              z.object({
                transcript: z.string().optional(),
                words: z.array(DeepgramWordSchema).optional(),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  }),
})

export type DeepgramAlignerOptions = {
  apiKey: string
  model?: string
  endpoint?: string
  language?: string
  /** Retries on 429/5xx/network failures. */
  maxAttempts?: number
  requestTimeoutMs?: number
}

export class DeepgramAligner implements Aligner {
  private readonly apiKey: string
  private readonly model: string
  private readonly endpoint: string
  private readonly language: string
  private readonly maxAttempts: number
  private readonly requestTimeoutMs: number

  constructor(options: DeepgramAlignerOptions) {
    if (typeof options.apiKey !== 'string' || options.apiKey.length === 0) {
      throw new AlignerError('DeepgramAligner: apiKey is required')
    }
    this.apiKey = options.apiKey
    this.model = options.model ?? DEEPGRAM_MODEL
    this.endpoint = options.endpoint ?? DEEPGRAM_ENDPOINT
    this.language = options.language ?? 'en'
    this.maxAttempts = options.maxAttempts ?? 3
    // Deepgram transcribes far faster than realtime, but a 60-minute upload on a
    // domestic connection is bounded by the upload, not the model.
    this.requestTimeoutMs = options.requestTimeoutMs ?? 600_000
  }

  async align(audioPath: string, scriptHint?: string): Promise<WordTiming[]> {
    const url = this.buildUrl(scriptHint)
    const contentType = AUDIO_CONTENT_TYPES[path.extname(audioPath).toLowerCase()] ?? 'audio/*'

    let lastError: unknown = null

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        // Recreated per attempt: a consumed stream cannot be replayed.
        const body = createReadStream(audioPath)
        const response = await request(url, {
          method: 'POST',
          body,
          headers: {
            authorization: `Token ${this.apiKey}`,
            'content-type': contentType,
          },
          headersTimeout: this.requestTimeoutMs,
          bodyTimeout: this.requestTimeoutMs,
        })

        if (response.statusCode >= 400) {
          const detail = (await response.body.text()).slice(0, 500)
          const error = new AlignerError(
            `Deepgram returned ${response.statusCode}: ${detail}`,
            response.statusCode,
          )
          if (isRetryable(response.statusCode) && attempt < this.maxAttempts) {
            lastError = error
            await delay(attempt)
            continue
          }
          throw error
        }

        const payload: unknown = await response.body.json()
        return toWordTimings(payload)
      } catch (error) {
        if (error instanceof AlignerError && !isRetryable(error.statusCode)) throw error
        lastError = error
        if (attempt >= this.maxAttempts) break
        await delay(attempt)
      }
    }

    throw new AlignerError(
      `Deepgram alignment failed after ${this.maxAttempts} attempts: ${describe(lastError)}`,
    )
  }

  private buildUrl(scriptHint?: string): string {
    const url = new URL(this.endpoint)
    url.searchParams.set('model', this.model)
    url.searchParams.set('language', this.language)
    url.searchParams.set('punctuate', 'true')
    url.searchParams.set('smart_format', 'true')

    // The script is not truth — the narration is — but the proper nouns in it are
    // exactly what ASR gets wrong, and a wrong name is visible in a caption.
    for (const term of deriveKeyterms(scriptHint)) {
      url.searchParams.append('keyterm', term)
    }
    return url.toString()
  }
}

function isRetryable(statusCode: number | undefined): boolean {
  if (statusCode === undefined) return true
  return statusCode === 408 || statusCode === 429 || statusCode >= 500
}

function delay(attempt: number): Promise<void> {
  const ms = Math.min(30_000, 500 * 2 ** (attempt - 1))
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Sentence-initial capitals that are not proper nouns. Not exhaustive and does
 * not need to be — a stray common word costs a wasted keyterm slot, nothing more.
 */
const KEYTERM_STOPWORDS = new Set([
  'The', 'A', 'An', 'And', 'But', 'Or', 'If', 'When', 'While', 'After', 'Before',
  'In', 'On', 'At', 'By', 'For', 'From', 'To', 'With', 'It', 'This', 'That',
  'These', 'Those', 'He', 'She', 'They', 'We', 'You', 'I', 'His', 'Her', 'Their',
  'There', 'Then', 'Now', 'What', 'Which', 'Who', 'How', 'Why', 'No', 'Not',
  'One', 'Two', 'Three', 'Its', 'Was', 'Were', 'Is', 'Are', 'Be', 'Been', 'As',
  'So', 'Because', 'During', 'Over', 'Under', 'Between', 'Every', 'Each',
  'Later', 'Meanwhile', 'However', 'Today', 'Yesterday', 'Within', 'Without',
  'Across', 'Through', 'Until', 'Since', 'Although', 'Though', 'Even', 'Only',
  'Just', 'Still', 'Yet', 'Once', 'Soon', 'Finally', 'Eventually', 'Instead',
  'Perhaps', 'Almost', 'Nearly', 'Many', 'Most', 'Some', 'Few', 'All', 'Both',
  'Another', 'Other', 'Such', 'More', 'Less', 'Here', 'Where', 'Nothing',
])

export const MAX_KEYTERMS = 24

/**
 * Pull likely proper nouns out of the script. Deterministic: most frequent
 * first, ties broken alphabetically, so the same script always sends the same
 * terms and the same audio always aligns identically.
 */
export function deriveKeyterms(scriptHint: string | undefined, limit = MAX_KEYTERMS): string[] {
  if (typeof scriptHint !== 'string' || scriptHint.length === 0) return []

  const counts = new Map<string, number>()
  const matches = scriptHint.match(/\b[A-Z][A-Za-z'-]{2,29}\b/g) ?? []

  for (const raw of matches) {
    if (KEYTERM_STOPWORDS.has(raw)) continue
    const term = raw.replace(/[^A-Za-z0-9' -]/g, '')
    if (term.length < 3) continue
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term)
}

/**
 * Deepgram response to the canonical `WordTiming[]`.
 *
 * Seconds become integer milliseconds here and nowhere else. Every downstream
 * frame calculation assumes integers, so a float leaking past this point is the
 * beginning of a drift bug.
 */
export function toWordTimings(payload: unknown): WordTiming[] {
  const parsed = DeepgramResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AlignerError(`Deepgram response did not match the expected shape: ${parsed.error.message}`)
  }

  const channel = parsed.data.results.channels[0]
  const alternative = channel?.alternatives[0]
  const words = alternative?.words ?? []

  const out: WordTiming[] = []
  let previousEndMs = 0

  for (const word of words) {
    const text = (word.punctuated_word ?? word.word).trim()
    if (text.length === 0) continue

    const startMs = Math.max(previousEndMs, Math.round(word.start * 1000))
    const endMs = Math.max(startMs + 1, Math.round(word.end * 1000))

    out.push({
      word: text.slice(0, 120),
      startMs,
      endMs,
      confidence: Math.min(1, Math.max(0, word.confidence ?? 1)),
    })
    previousEndMs = endMs
  }

  if (out.length === 0) {
    throw new AlignerError('Deepgram returned no words; the voiceover may be silent or unsupported')
  }
  return out
}
