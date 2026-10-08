import type { WordTiming } from './schemas.js'

/**
 * Stage 2b — transcript repair.
 *
 * THE GOVERNING RULE: the audio is truth. The script is a spelling aid and
 * nothing more.
 *
 * ASR gets foreign proper nouns wrong and gets them wrong in a way that matters,
 * because these words become image-search queries: "Ecol" returns nothing,
 * "École" returns the French archaeological school. So we take the SPELLING from
 * the script for a narrow class of tokens — names, catalogue designations, dated
 * eras — and we take everything else, including every timestamp, from Deepgram.
 *
 * Three things this module will never do, because each one is a worse failure
 * than leaving a misspelling in place:
 *
 *  1. INSERT a word the narrator did not say. A divergence with an empty
 *     transcript side (the script's em dashes, a skipped "of") is always dropped.
 *  2. "Fix" a formatting difference. "47" versus "forty-seven" and "post death"
 *     versus "post-death" are the script and the ASR spelling the same sound two
 *     ways; digits read better in a caption anyway.
 *  3. MOVE a timestamp. A repaired span occupies exactly the milliseconds the
 *     original words occupied, first startMs and last endMs to the exact
 *     integer, so no drift can enter the timeline through this stage.
 *
 * Every judgement call in here is biased towards leaving the transcript alone.
 * The expensive failure is silently replacing what the narrator said with what
 * the script wished he had said, and that failure is invisible until the video
 * is delivered.
 */

/* ------------------------------------------------------------------------- */
/* Contract                                                                    */
/* ------------------------------------------------------------------------- */

export type RepairReason = 'properNoun' | 'designation' | 'date'

export type RepairEdit = {
  startMs: number
  /** What Deepgram returned, joined by spaces. */
  heard: string
  /** What it was replaced with, joined by spaces. */
  written: string
  reason: RepairReason
  /** The lowest Deepgram confidence across the words that were replaced. */
  minConfidence: number
}

export type RepairResult = {
  /**
   * The repaired timeline. The count may differ from the input in either
   * direction — a collapse ("four q two zero four" -> "4Q204") shortens it, an
   * expansion ("March" -> "364 CE") lengthens it. What is preserved is the span:
   * the first word's `startMs` and the last word's `endMs` are always the input's.
   */
  words: WordTiming[]
  /** Every change, in timeline order, for review and logging. */
  edits: RepairEdit[]
  /**
   * Set when the pass declined to run at all, as opposed to running and finding
   * nothing. The caller must be able to tell those apart: both return zero edits,
   * but one means "the names were already right" and the other means "this did
   * nothing and nobody was told". A silent no-op on a 25-minute video would read
   * as a clean green run.
   */
  skipped?: 'emptyScript' | 'tooLong'
}

export type RepairOptions = {
  /** Repair a proper noun at or below this Deepgram confidence. */
  maxConfidence?: number
  /** ...or above this normalised similarity, however confident Deepgram was. */
  minSimilarity?: number
}

export const REPAIR_DEFAULTS = {
  maxConfidence: 0.75,
  minSimilarity: 0.55,
} as const

/**
 * The LCS matrix is O(n*m). At this bound it is 8001 rows of 8001 uint32s, about
 * 256MB, allocated once and released.
 *
 * Sized against the real deliverable, not a guess. The measured rate on the client's
 * own voiceover is 1,417 words over 527s, about 161 wpm, so his stated 15-25 minute
 * videos are 2,400-4,000 words and the 60-minute ingest cap is ~9,700. A 4,000 bound
 * would therefore have quietly switched this off for every real video while passing
 * on the 9-minute test fixture — working in testing and doing nothing in production.
 *
 * Past the bound we do not gamble a whole job on a 1GB allocation. We return the
 * transcript untouched AND set `skipped: 'tooLong'`, because a silent no-op is the
 * failure this bound exists to avoid.
 */
export const MAX_ALIGN_TOKENS = 8000

/**
 * No repair below this resemblance, whatever the confidence says.
 *
 * See the note at the gate in `repairRegion`: low confidence is not evidence that
 * the script is right, so it must never on its own license a substitution.
 */
export const ABSOLUTE_SIMILARITY_FLOOR = 0.25

/**
 * A divergence wider than this is a mangled sentence, not a mangled name, and
 * wholesale-replacing a sentence is exactly the over-correction we are guarding
 * against. The real failures cluster at one to five words a side.
 */
export const MAX_REGION_TOKENS = 8

/** Beyond this the edit-distance is not worth computing; treat it as no match. */
const MAX_SIMILARITY_CHARS = 1024

/* ------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* ------------------------------------------------------------------------- */

const COMBINING_MARKS = /\p{M}+/gu
const NOT_NORMAL = /[^a-z0-9']+/g
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const LEADING_UPPER = /^\p{Lu}/u
const ANY_UPPER = /\p{Lu}/u
const NON_ASCII = /[^\u0000-\u007f]/
const HYPHENS_AND_SPACE = /[-\u2010-\u2015\s]+/

/**
 * The comparison form. NFKD then drop combining marks, so `École` and `Ecole`
 * are the same token and the aligner does not report an accent as a divergence.
 * Letters with no decomposition (`ø`) simply fall out with the rest of the
 * non-ASCII, which is fine — it only ever makes two tokens look LESS alike, and
 * looking less alike can only cost us a repair, never cause a wrong one.
 *
 * The apostrophe survives so that `Ge'ez` stays one token's worth of signal.
 */
export function normaliseToken(token: string): string {
  return token
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NOT_NORMAL, '')
}

/** The token with its edge punctuation removed: `4Q204.` -> `4Q204`, `—` -> ``. */
function coreOf(token: string): string {
  return token.replace(EDGE_PUNCTUATION, '')
}

/* ------------------------------------------------------------------------- */
/* Script tokens                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Sentence-final punctuation, optionally behind a closing quote or bracket. A
 * false positive here (`Dr.`) only makes the NEXT token look sentence-initial,
 * which raises the bar for repairing it. That is the safe direction.
 */
const SENTENCE_END = /[.!?:;\u2026]["'\u201d\u2019)\]]*$/

type ScriptToken = {
  raw: string
  core: string
  norm: string
  capitalised: boolean
  /** First token of the script, or the first after sentence-final punctuation. */
  sentenceInitial: boolean
  hasNonAscii: boolean
  /** An uppercase letter after the first character: `VanderKam`, `McDonald`. */
  hasInternalUpper: boolean
}

function tokeniseScript(scriptText: string): ScriptToken[] {
  const out: ScriptToken[] = []
  let sentenceInitial = true

  for (const raw of scriptText.split(/\s+/)) {
    if (raw.length === 0) continue

    const core = coreOf(raw)
    const rest = Array.from(core).slice(1).join('')

    const token: ScriptToken = {
      raw,
      core,
      norm: normaliseToken(raw),
      capitalised: LEADING_UPPER.test(core),
      sentenceInitial,
      hasNonAscii: NON_ASCII.test(core),
      hasInternalUpper: ANY_UPPER.test(rest),
    }

    // A bare `—` or `...` is not a word, so it neither opens nor closes a sentence
    // for our purposes; the flag carries across it unchanged.
    if (core.length > 0) sentenceInitial = SENTENCE_END.test(raw)

    // Tokens with no comparable content (`—`) are dropped outright. Keeping them
    // would let an em dash ride into a caption on the back of a real repair.
    if (token.norm.length > 0) out.push(token)
  }

  return out
}

/* ------------------------------------------------------------------------- */
/* Number formatting                                                           */
/* ------------------------------------------------------------------------- */

const NUMBER_WORDS = new Map<string, number>([
  ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40],
  ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90],
  ['hundred', 100], ['thousand', 1000], ['million', 1_000_000],
  ['billion', 1_000_000_000],
])

/**
 * The value of a side if — and only if — the whole side is a number, written
 * either in digits or in words. Returns null for anything else, including
 * `4Q204` and `364 CE`, which must stay repairable.
 *
 * A bare numeral only counts when it stands alone, so `364 CE` cannot be read as
 * "the number 364 plus some noise".
 */
export function parseNumberExpression(tokens: readonly string[]): number | null {
  const parts: string[] = []

  for (const token of tokens) {
    const core = coreOf(token).toLowerCase()
    if (core.length === 0) return null
    for (const part of core.split(HYPHENS_AND_SPACE)) {
      if (part.length > 0) parts.push(part)
    }
  }
  if (parts.length === 0) return null

  const only = parts[0]
  if (parts.length === 1 && only !== undefined && /^\d+$/.test(only)) return Number(only)

  let total = 0
  let current = 0
  let sawValue = false

  for (const part of parts) {
    if (/^\d+$/.test(part)) return null
    if (part === 'and') continue

    const value = NUMBER_WORDS.get(part)
    if (value === undefined) return null
    sawValue = true

    if (value === 100) {
      current = (current === 0 ? 1 : current) * 100
    } else if (value >= 1000) {
      total += (current === 0 ? 1 : current) * value
      current = 0
    } else {
      current += value
    }
  }

  return sawValue ? total + current : null
}

/* ------------------------------------------------------------------------- */
/* Edit distance                                                               */
/* ------------------------------------------------------------------------- */

function levenshtein(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = new Uint32Array(b.length + 1)
  let current = new Uint32Array(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) previous[j] = j

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const deletion = (previous[j] ?? 0) + 1
      const insertion = (current[j - 1] ?? 0) + 1
      const substitution = (previous[j - 1] ?? 0) + cost
      current[j] = Math.min(deletion, insertion, substitution)
    }
    const swap = previous
    previous = current
    current = swap
  }

  return previous[b.length] ?? 0
}

/** 1 for identical, 0 for nothing in common. Code points, not UTF-16 units. */
export function normalisedSimilarity(a: string, b: string): number {
  const left = Array.from(a)
  const right = Array.from(b)
  const longest = Math.max(left.length, right.length)
  if (longest === 0) return 1
  if (longest > MAX_SIMILARITY_CHARS) return 0
  return 1 - levenshtein(left, right) / longest
}

/* ------------------------------------------------------------------------- */
/* Alignment                                                                   */
/* ------------------------------------------------------------------------- */

type MatchPair = { transcript: number; script: number }

/**
 * Longest common subsequence over normalised tokens, returned as the matched
 * index pairs. The backtrace tie-break is fixed (prefer the transcript side), so
 * the same two inputs always produce the same alignment — this feeds a
 * content-hashed cache.
 */
function lcsMatches(a: readonly string[], b: readonly string[]): MatchPair[] {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return []

  const rows: Uint32Array[] = new Array<Uint32Array>(n + 1)
  for (let i = 0; i <= n; i += 1) rows[i] = new Uint32Array(m + 1)

  for (let i = 1; i <= n; i += 1) {
    const row = rows[i]
    const above = rows[i - 1]
    if (row === undefined || above === undefined) throw new Error('repair: lcs indexing error')

    for (let j = 1; j <= m; j += 1) {
      row[j] =
        a[i - 1] === b[j - 1]
          ? (above[j - 1] ?? 0) + 1
          : Math.max(above[j] ?? 0, row[j - 1] ?? 0)
    }
  }

  const matches: MatchPair[] = []
  let i = n
  let j = m

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.push({ transcript: i - 1, script: j - 1 })
      i -= 1
      j -= 1
      continue
    }
    const up = rows[i - 1]?.[j] ?? 0
    const left = rows[i]?.[j - 1] ?? 0
    if (up >= left) i -= 1
    else j -= 1
  }

  matches.reverse()
  return matches
}

/** Half-open on both sides. Either side may be empty. */
type Region = {
  transcriptStart: number
  transcriptEnd: number
  scriptStart: number
  scriptEnd: number
}

function collectRegions(
  matches: readonly MatchPair[],
  transcriptCount: number,
  scriptCount: number,
): Region[] {
  const regions: Region[] = []
  let transcript = 0
  let script = 0

  for (const match of matches) {
    if (match.transcript > transcript || match.script > script) {
      regions.push({
        transcriptStart: transcript,
        transcriptEnd: match.transcript,
        scriptStart: script,
        scriptEnd: match.script,
      })
    }
    transcript = match.transcript + 1
    script = match.script + 1
  }

  if (transcript < transcriptCount || script < scriptCount) {
    regions.push({
      transcriptStart: transcript,
      transcriptEnd: transcriptCount,
      scriptStart: script,
      scriptEnd: scriptCount,
    })
  }

  return regions
}

/* ------------------------------------------------------------------------- */
/* Classification                                                              */
/* ------------------------------------------------------------------------- */

/** A Dead Sea Scrolls catalogue number: `4Q204`, `11Q13`. */
const DESIGNATION = /^\d+[A-Z]\w*$/
/** A year with an era: `364 CE`, `70 AD`, `168BCE`. */
const DATE = /^\d{1,4}\s?(BCE|CE|AD|BC)$/i

function isDesignation(tokens: readonly ScriptToken[]): boolean {
  return tokens.some((token) => DESIGNATION.test(token.core))
}

function isDate(tokens: readonly ScriptToken[]): boolean {
  return DATE.test(tokens.map((token) => token.core).join(' '))
}

/**
 * Does the script side name something?
 *
 * A capital in the MIDDLE of a sentence is real evidence — English only puts one
 * there for a name. A capital at the START of a sentence is no evidence at all,
 * because every sentence starts with one, so it needs corroboration:
 *
 *  - a non-ASCII letter (`École`, `Józef`, `Schøyen`), or
 *  - an internal capital (`VanderKam`), or
 *  - the same token appearing mid-sentence somewhere else in the script, which
 *    is the one genuinely reliable proper-noun test available without a
 *    dictionary (`Knibb` opens one sentence and sits inside another).
 *
 * Single-character capitals (`I`, `A`) are never evidence.
 */
function isProperNoun(tokens: readonly ScriptToken[], confirmed: ReadonlySet<string>): boolean {
  return tokens.some((token) => {
    if (!token.capitalised || token.core.length < 2) return false
    if (!token.sentenceInitial) return true
    return token.hasNonAscii || token.hasInternalUpper || confirmed.has(token.norm)
  })
}

/* ------------------------------------------------------------------------- */
/* Rewriting                                                                   */
/* ------------------------------------------------------------------------- */

function copyWord(word: WordTiming): WordTiming {
  return {
    word: word.word,
    startMs: word.startMs,
    endMs: word.endMs,
    confidence: word.confidence,
  }
}

/**
 * Put `texts` in the exact span the `heard` words occupied.
 *
 * Equal counts is the easy case: swap the text, do not touch a single timestamp.
 *
 * Otherwise the span is divided proportionally by character length, in integer
 * milliseconds, with the first startMs and the last endMs pinned to the original
 * values. A forward pass guarantees every word gets at least one millisecond and
 * a backward pass guarantees the tail still fits, which together make the result
 * strictly increasing without ever moving either endpoint.
 *
 * Returns null when the rewrite cannot be done cleanly (a span too short to hold
 * one millisecond per word). Null means "leave the transcript alone".
 */
function buildReplacement(
  heard: readonly WordTiming[],
  texts: readonly string[],
  swappable: readonly boolean[],
): WordTiming[] | null {
  const first = heard[0]
  const last = heard[heard.length - 1]
  if (first === undefined || last === undefined || texts.length === 0) return null

  const start = first.startMs
  const end = last.endMs
  const minConfidence = heard.reduce((lowest, word) => Math.min(lowest, word.confidence), 1)

  if (texts.length === heard.length) {
    const out: WordTiming[] = []
    for (let i = 0; i < texts.length; i += 1) {
      const source = heard[i]
      const text = texts[i]
      if (source === undefined || text === undefined) return null
      // The narrator's own form wins when only spelling noise separates the pair,
      // and whenever the script token is not itself the thing we came to fix.
      const sameWord = normaliseToken(source.word) === normaliseToken(text)
      const keep = sameWord || swappable[i] !== true
      out.push({
        word: keep ? source.word : text,
        startMs: source.startMs,
        endMs: source.endMs,
        confidence: source.confidence,
      })
    }
    return out
  }

  const count = texts.length
  const span = end - start
  if (span < count) return null

  const lengths = texts.map((text) => Math.max(1, Array.from(text).length))
  const total = lengths.reduce((sum, length) => sum + length, 0)

  const bounds: number[] = new Array<number>(count + 1)
  bounds[0] = start
  bounds[count] = end

  let cumulative = 0
  for (let k = 0; k < count - 1; k += 1) {
    cumulative += lengths[k] ?? 1
    bounds[k + 1] = start + Math.round((span * cumulative) / total)
  }

  for (let k = 1; k < count; k += 1) {
    bounds[k] = Math.max(bounds[k] ?? start, (bounds[k - 1] ?? start) + 1)
  }
  for (let k = count - 1; k >= 1; k -= 1) {
    bounds[k] = Math.min(bounds[k] ?? start, (bounds[k + 1] ?? end) - 1)
  }

  const out: WordTiming[] = []
  for (let k = 0; k < count; k += 1) {
    const wordStart = bounds[k]
    const wordEnd = bounds[k + 1]
    const text = texts[k]
    if (wordStart === undefined || wordEnd === undefined || text === undefined) return null
    if (wordEnd <= wordStart) return null
    out.push({ word: text, startMs: wordStart, endMs: wordEnd, confidence: minConfidence })
  }

  const firstOut = out[0]
  const lastOut = out[out.length - 1]
  if (firstOut === undefined || lastOut === undefined) return null
  if (firstOut.startMs !== start || lastOut.endMs !== end) return null

  return out
}

/* ------------------------------------------------------------------------- */
/* The pass                                                                    */
/* ------------------------------------------------------------------------- */

type Decision = {
  region: Region
  replacement: WordTiming[]
  edit: RepairEdit
}

function decideRegion(
  region: Region,
  words: readonly WordTiming[],
  heardNorms: readonly string[],
  script: readonly ScriptToken[],
  confirmed: ReadonlySet<string>,
  maxConfidence: number,
  minSimilarity: number,
): Decision | null {
  const heard = words.slice(region.transcriptStart, region.transcriptEnd)
  const written = script.slice(region.scriptStart, region.scriptEnd)

  // Never insert a word he did not say, and never delete one either.
  if (heard.length === 0 || written.length === 0) return null
  if (heard.length > MAX_REGION_TOKENS || written.length > MAX_REGION_TOKENS) return null

  const heardJoined = heardNorms.slice(region.transcriptStart, region.transcriptEnd).join('')
  const writtenJoined = written.map((token) => token.norm).join('')

  // Hyphenation, spacing or accents only: `post death` / `post-death`. Nothing
  // to repair, and the transcript's form is the one he actually spoke.
  if (heardJoined === writtenJoined) return null

  // Number formatting only: `47` / `forty-seven`. Digits read better in a caption.
  if (
    parseNumberExpression(heard.map((word) => word.word)) !== null &&
    parseNumberExpression(written.map((token) => token.raw)) !== null
  ) {
    return null
  }

  // Designations and dates repair regardless of confidence: `4Q204` came back at
  // 0.98 and is still useless as a search query.
  let reason: RepairReason | null = null
  if (isDesignation(written)) reason = 'designation'
  else if (isDate(written)) reason = 'date'
  else if (isProperNoun(written, confirmed)) reason = 'properNoun'
  if (reason === null) return null

  const minConfidence = heard.reduce((lowest, word) => Math.min(lowest, word.confidence), 1)

  // A name region may only swap the NAME. Where the script's word is ordinary
  // (`heard [great Nicholsberg]` against `script [mighty Nickelsburg]`) the
  // narrator's word stands — the script does not get to win an argument about
  // vocabulary on the strength of a misspelt surname sitting next to it.
  const swappable =
    reason === 'properNoun'
      ? written.map((token) => token.capitalised)
      : written.map(() => true)

  if (reason === 'properNoun') {
    const similarity = normalisedSimilarity(heardJoined, writtenJoined)

    // The floor applies whatever the confidence, and that is the whole point.
    //
    // Low confidence is NOT evidence that the script is right — on this material it
    // is the baseline for any foreign name, correct or not. The client's own data has
    // Deepgram at 0.60 on a name it got RIGHT and 0.86 on one it got wrong. So a bare
    // `confidence <= maxConfidence` bypass would authorise replacing any heard word
    // with any capitalised script token at zero resemblance: narrator says "Milik",
    // Deepgram hears "Milik" correctly at 0.6, the script says "Nickelsburg" nearby,
    // and both the caption and the image search silently become the wrong scholar.
    //
    // 0.25 is measured, not picked: the weakest true positive in the real fixture is
    // "showian" against "schoyen" at 0.286, while "milik" against "nickelsburg" sits
    // near 0.18. The floor keeps every real repair and refuses the invented ones.
    if (similarity < ABSOLUTE_SIMILARITY_FLOOR) return null
    if (minConfidence > maxConfidence && similarity < minSimilarity) return null

    // With counts unequal there is no word-for-word correspondence to protect an
    // ordinary word, so the whole script side has to be name.
    if (written.length !== heard.length && !swappable.every((allowed) => allowed)) return null
  }

  const replacement = buildReplacement(
    heard,
    written.map((token) => token.raw),
    swappable,
  )
  if (replacement === null) return null

  const heardText = heard.map((word) => word.word).join(' ')
  const writtenText = replacement.map((word) => word.word).join(' ')
  if (heardText === writtenText) return null

  const anchor = heard[0]
  if (anchor === undefined) return null

  return {
    region,
    replacement,
    edit: {
      startMs: anchor.startMs,
      heard: heardText,
      written: writtenText,
      reason,
      minConfidence,
    },
  }
}

/**
 * Repair the spelling of names, catalogue designations and dated eras in a
 * Deepgram transcript, using the narrator's own script as a spelling reference.
 *
 * Pure, deterministic, and total: any input it cannot confidently improve comes
 * back unchanged (with fresh objects, so the caller's array is never aliased).
 */
export function repairTranscript(
  words: readonly WordTiming[],
  scriptText: string,
  options: RepairOptions = {},
): RepairResult {
  const maxConfidence = options.maxConfidence ?? REPAIR_DEFAULTS.maxConfidence
  const minSimilarity = options.minSimilarity ?? REPAIR_DEFAULTS.minSimilarity

  if (words.length === 0) return { words: [], edits: [] }

  const untouched = (skipped?: RepairResult['skipped']): RepairResult =>
    skipped === undefined
      ? { words: words.map(copyWord), edits: [] }
      : { words: words.map(copyWord), edits: [], skipped }

  if (typeof scriptText !== 'string' || scriptText.trim().length === 0) {
    return untouched('emptyScript')
  }

  const script = tokeniseScript(scriptText)
  if (script.length === 0) return untouched('emptyScript')
  if (words.length > MAX_ALIGN_TOKENS || script.length > MAX_ALIGN_TOKENS) {
    return untouched('tooLong')
  }

  const heardNorms = words.map((word) => normaliseToken(word.word))
  const scriptNorms = script.map((token) => token.norm)

  const matches = lcsMatches(heardNorms, scriptNorms)
  const regions = collectRegions(matches, words.length, script.length)

  // The one reliable proper-noun test without a dictionary: capitalised where
  // English has no grammatical reason to capitalise.
  const confirmed = new Set<string>()
  for (const token of script) {
    if (token.capitalised && !token.sentenceInitial && token.core.length >= 2) {
      confirmed.add(token.norm)
    }
  }

  const decisions: Decision[] = []
  for (const region of regions) {
    const decision = decideRegion(
      region,
      words,
      heardNorms,
      script,
      confirmed,
      maxConfidence,
      minSimilarity,
    )
    if (decision !== null) decisions.push(decision)
  }

  if (decisions.length === 0) return untouched()

  const out: WordTiming[] = []
  const edits: RepairEdit[] = []
  let index = 0
  let next = 0

  while (index < words.length) {
    const decision = decisions[next]
    if (decision !== undefined && decision.region.transcriptStart === index) {
      for (const word of decision.replacement) out.push(word)
      edits.push(decision.edit)
      index = decision.region.transcriptEnd
      next += 1
      continue
    }
    const word = words[index]
    if (word !== undefined) out.push(copyWord(word))
    index += 1
  }

  return { words: out, edits }
}
