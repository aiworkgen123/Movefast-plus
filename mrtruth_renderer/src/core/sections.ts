/**
 * THE CHAPTER-TITLE PRODUCER — a section of the script becomes a beat index.
 *
 * ##########################################################################
 * # THIS IS THE ONE PIECE THAT FILLS `DeviceBeat.editorialTitle`, AND      #
 * # WITHOUT IT a3 CANNOT DRAW A FRAME.                                     #
 * #                                                                        #
 * # `2628f67` fixed the three reasons the chooser refused `chapter-title`  #
 * # and proved the result frame-identical, precisely because the field it  #
 * # reads is null on every beat. This module is what makes it non-null.    #
 * #                                                                        #
 * # THE CLIENT ASKED FOR IT BY NAME, twice. On 2026-08-30, answering a     #
 * # question open since 08-24: "The tool can write its own words there     #
 * # when needed, based on the context and the paragraph... I believe       #
 * # chapter title in most occasions will be AI's own words, describing     #
 * # the next chapter". And on 2026-09-02: "Visual planner includes text    #
 * # overlay animatioons like chapter title, pop container, question text   #
 * # overlay." See T-18 and T-19 in `TREATMENT-STANDARD.md`.                #
 * ##########################################################################
 *
 * ##########################################################################
 * # IT IS DELIBERATELY NOT REACHABLE FROM THE COMPOSITOR BUNDLE.           #
 * #                                                                        #
 * # `apps/web/src/remotion` imports exactly four subpaths of this package  #
 * # — schemas, devices, frames, motion — and never the barrel. MEASURED,   #
 * # not assumed: `grep -rhoE "from '@vg/core[^']*'" apps/web/src/remotion` #
 * # returns those four and nothing else. So this file is exported from     #
 * # `index.ts` only, `bundleHash` cannot move, and a film that gains a     #
 * # chapter title re-renders THE TITLED SEGMENTS AND NOTHING ELSE.         #
 * #                                                                        #
 * # That is the difference between a two-minute recut and a ninety-minute  #
 * # one. Do not add a subpath export for this file, and do not import it   #
 * # from anything under `apps/web/src/remotion`. Trap SS.                  #
 * ##########################################################################
 */

import { normaliseToken } from './repair.js'

/** One aligned word. The shape `align.json` already stores. */
export type AlignedWord = {
  readonly word: string
  readonly startMs: number
}

/** One dossier section. The shape `research.json` already stores. */
export type DossierSection = {
  readonly startChar: number
  readonly endChar: number
  readonly title: string
}

/** The little a beat has to expose to be a candidate carrier. */
export type SectionCandidateBeat = {
  readonly index: number
  readonly startMs: number
}

/**
 * HOW FAR A SCENE CUT MAY SIT FROM A SECTION'S FIRST SPOKEN WORD AND STILL BE
 * CALLED THE START OF THAT SECTION.
 *
 * ##########################################################################
 * # 1000ms IS AN EDITORIAL BOUND SITTING INSIDE A MEASURED FLAT REGION,     #
 * # WHICH IS THE ONLY HONEST WAY TO PICK A NUMBER LIKE THIS.                #
 * #                                                                        #
 * # Swept against the real 118-scene segmentation of the client's own       #
 * # narration and TWO independently produced dossiers of it, counting only  #
 * # candidates that also clear a3's own 120..240 frame window:              #
 * #                                                                        #
 * #    tolerance     0   200   400   600   800  1000  1200  1500  2000 2500 #
 * #    dossier v1    0     1     3     4     8     8     8     8     8    8 #
 * #    dossier v2    1     1     2     2     3     3     3     3     4    7 #
 * #                                                                        #
 * # BOTH SATURATE ACROSS 800..1500ms. Beyond the plateau v1 never moves at  #
 * # all out to six seconds, and v2 starts admitting titles two and a half   #
 * # seconds adrift, which is a heading announcing a chapter the viewer is   #
 * # already inside. So the plateau is where the honest values live and      #
 * # 1000ms sits in the middle of it on both.                                #
 * #                                                                        #
 * # THE TWO DOSSIERS MATTER MORE THAN THE TWO ROWS. They were produced by   #
 * # separate model calls and cut the same script into DIFFERENT sections,   #
 * # so a number that only looked stable on one of them would have shown up  #
 * # here as a plateau in one row and not the other. It did not.             #
 * #                                                                        #
 * # 1000ms is also the thing a viewer would accept stated on its own terms: #
 * # the cut is within one second of the chapter's first word. Re-sweep      #
 * # before changing it; do not tune it to make one film place one more      #
 * # title.                                                                  #
 * ##########################################################################
 */
export const SECTION_CUT_TOLERANCE_MS = 1000

/**
 * THE FLOOR UNDER WHICH THE WHOLE MAP IS REFUSED.
 *
 * ##########################################################################
 * # A HEADING OVER THE WRONG PASSAGE IS INDISTINGUISHABLE FROM A RIGHT ONE  #
 * # IN THE JSON, WHICH IS WHY THIS IS A REFUSAL AND NOT A WARNING.          #
 * #                                                                        #
 * # The dossier's offsets index the SCRIPT and a beat's identity lives in   #
 * # the ALIGNER's word timings. If those two texts are not the same         #
 * # narration — a re-uploaded script, a swapped voiceover, an aligner that  #
 * # returned garbage — then every offset still maps to SOME millisecond and #
 * # every millisecond still lands in SOME beat. The output looks exactly    #
 * # like a correct one and every title is over the wrong passage.           #
 * #                                                                        #
 * # MEASURED on the real pair: 1359 of 1404 script tokens anchor, 96.79%,   #
 * # longest unanchored run 3 ("one hundred two"). So 0.5 is nowhere near    #
 * # the working value and fires only on genuine breakage.                   #
 * ##########################################################################
 */
export const SECTION_MIN_ANCHORED_FRACTION = 0.5

/**
 * THE HALF-WIDTH OF THE BAND THE ALIGNMENT IS SOLVED INSIDE.
 *
 * ##########################################################################
 * # BANDED RATHER THAN FULL, AND ON THIS NARRATION IT IS NOT AN             #
 * # APPROXIMATION — IT IS THE IDENTICAL ANSWER.                             #
 * #                                                                        #
 * # A full LCS table over 1404 script tokens and 1399 aligner words is 7.9  #
 * # MB and runs in 26ms, so it is fine here and catastrophic later: the     #
 * # table is O(n*m), so a script ten times this one is 800 MB and a         #
 * # three-hour narration is gigabytes. The band makes it O(n*W).            #
 * #                                                                        #
 * # MEASURED, all four bands against the full table on the real pair:       #
 * #                                                                        #
 * #   full LCS      1359 anchored  96.79%   26ms                            #
 * #   banded W=16   1359 anchored  96.79%    5ms   identical                #
 * #   banded W=32   1359 anchored  96.79%   12ms   identical                #
 * #   banded W=64   1359 anchored  96.79%   12ms   identical                #
 * #   banded W=128  1359 anchored  96.79%   20ms   identical                #
 * #                                                                        #
 * # "identical" means every one of the 1404 anchors and all fourteen        #
 * # section boundary timestamps agree exactly, not that the totals match.   #
 * # W=16 already suffices because the two texts are the same narration and  #
 * # the whole film's net drift is five tokens; 64 is four times that and    #
 * # still costs 724 KB.                                                     #
 * #                                                                        #
 * # A GREEDY SYNC WALK WAS TRIED FIRST AND IS WORSE: same window, 1306      #
 * # anchored (93.02%), and it disagrees with the optimal answer about the   #
 * # boundaries. It is not shipped. Do not replace this with one.            #
 * ##########################################################################
 */
const BAND_HALF_WIDTH = 64

type ScriptToken = {
  readonly key: string
  readonly startChar: number
}

/**
 * The script's own words, with the character offset the dossier indexes by.
 *
 * `normaliseToken` is `repair.ts`'s, not a second copy. The aligner is ASR over
 * the client's voiceover and the script is his document, so they disagree about
 * punctuation, case and accents constantly — `preserve,` against `preserve`,
 * `École` against `Ecole`. That function already exists to make those the same
 * token, and a stricter variant that also drops the apostrophe was MEASURED
 * against it on the real pair: both anchor 1306 under the same walk, because
 * both texts spell `Ge'ez` and `doesn't` the same way. Identical result, so the
 * existing export wins and there is no near-duplicate to drift.
 *
 * IT DOES NOT NORMALISE NUMBER WORDS, and that is a stated limit rather than an
 * oversight: the script writes "forty-seven" where the aligner heard "47", and
 * essentially every unanchored token on the real narration is a spelled-out
 * number or a compound around one. They are skipped, the alignment re-joins on
 * the next word, and no section boundary on this film needed one.
 */
export function scriptTokens(scriptText: string): ScriptToken[] {
  const out: ScriptToken[] = []
  for (const match of scriptText.matchAll(/\S+/gu)) {
    const key = normaliseToken(match[0])
    if (key.length === 0) continue
    out.push({ key, startChar: match.index })
  }
  return out
}

/**
 * For each script token, the aligner word it is, or null where the two texts
 * disagree.
 *
 * A LONGEST COMMON SUBSEQUENCE, solved inside a band around the diagonal. The
 * band is what bounds the memory; see `BAND_HALF_WIDTH` for the measurement
 * showing it returns the full table's answer on the real narration.
 */
export function anchorScriptToWords(
  tokens: readonly ScriptToken[],
  words: readonly AlignedWord[],
): (number | null)[] {
  const n = tokens.length
  const m = words.length
  const out: (number | null)[] = new Array<number | null>(n).fill(null)
  if (n === 0 || m === 0) return out

  const a = tokens.map((token) => token.key)
  const b = words.map((word) => normaliseToken(word.word))

  const w = BAND_HALF_WIDTH
  const width = 2 * w + 1
  /* dp[i][d] is the LCS of a[i..] and b[j..], where j = i + d - w. */
  const dp: Uint32Array[] = []
  for (let i = 0; i <= n; i += 1) dp.push(new Uint32Array(width))

  const at = (i: number, d: number): number => {
    if (i < 0 || i > n || d < 0 || d >= width) return 0
    const j = i + d - w
    if (j < 0 || j > m) return 0
    return dp[i]?.[d] ?? 0
  }

  for (let i = n - 1; i >= 0; i -= 1) {
    const row = dp[i]
    if (row === undefined) continue
    /*
     * d DESCENDING. Advancing the WORD stays on this row at `d + 1`, so that
     * cell has to be filled already. Ascending here silently reads zeros and
     * costs three quarters of the anchors — it was measured at 28.70% against
     * 96.79% before the order was corrected, with every band width agreeing on
     * the wrong answer, which is exactly what a structural bug looks like.
     */
    for (let d = width - 1; d >= 0; d -= 1) {
      const j = i + d - w
      if (j < 0 || j >= m) {
        row[d] = 0
        continue
      }
      row[d] = a[i] === b[j] ? at(i + 1, d) + 1 : Math.max(at(i + 1, d - 1), at(i, d + 1))
    }
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    const d = j - i + w
    /* Drifted out of the band. Nothing further can be trusted, so stop. */
    if (d < 0 || d >= width) break
    if (a[i] === b[j]) {
      out[i] = j
      i += 1
      j += 1
      continue
    }
    if (at(i + 1, d - 1) >= at(i, d + 1)) i += 1
    else j += 1
  }

  return out
}

/** What the producer decided, per section, so a report can say why. */
export type SectionPlacement = {
  readonly sectionIndex: number
  readonly title: string
  /** The beat the title lands on, or null when nothing legal was near enough. */
  readonly beatIndex: number | null
  /** The section's first spoken word, in audio milliseconds. */
  readonly startMs: number | null
  /** Signed distance from that word to the chosen beat's own start. */
  readonly offsetMs: number | null
  readonly refusal:
    | null
    | 'is-the-films-opening'
    | 'no-title'
    | 'no-anchor-in-the-audio'
    | 'no-cut-within-tolerance'
    | 'beat-already-titled'
}

export type SectionTitleResult = {
  /** Beat index to the line it should carry. Empty when nothing qualified. */
  readonly titleByBeat: ReadonlyMap<number, string>
  readonly placements: readonly SectionPlacement[]
  /** Share of script tokens that found their word. Below the floor, nothing places. */
  readonly anchoredFraction: number
  /** True when the floor refused the whole map rather than the sections doing so. */
  readonly refusedForDrift: boolean
}

/**
 * WHICH BEAT, IF ANY, ANNOUNCES EACH SECTION.
 *
 * ##########################################################################
 * # IT OFFERS. IT DOES NOT PLACE.                                          #
 * #                                                                        #
 * # Every device rule stays exactly where it already lives. This returns a  #
 * # line for every beat that genuinely begins a section, and `chooseDevices`#
 * # then applies G3's 120..240 frame window, `maxPerFilm: 2`, the           #
 * # `prefersFirstHalf` position rule, G18's "spoken words outrank written   #
 * # ones", G2's own-picture requirement and the `drawnHeadlines` duplicate  #
 * # ledger. Enforcing any of those a second time here would be trap Z — two #
 * # guards catching one case means neither can ever be mutated red.         #
 * #                                                                        #
 * # MEASURED ON THE REAL FILM, and the shape of it is the point rather than #
 * # any one number: the second dossier offers a line to FIVE of its         #
 * # thirteen turns, three of those beats are the right length for a3, and   #
 * # the chooser draws ONE. Seven of the thirteen are refused here because   #
 * # no scene cut lands within a second of where the chapter begins.         #
 * #                                                                        #
 * # SO THE YIELD IS A PROPERTY OF WHERE THE SEGMENTER HAPPENED TO CUT, not  #
 * # of this rule, and the way to raise it is to CUT a beat at the boundary  #
 * # the way `cutCarrierAt` already does for the opening gallery. That       #
 * # renumbers every scene after it and would re-break the gallery's own     #
 * # placement, so it is a separate change with its own replay, not a        #
 * # threshold to widen here.                                                #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE FILM'S FIRST SECTION IS NEVER OFFERED ONE, AND THAT IS THREE RULES  #
 * # AGREEING RATHER THAN A CONVENIENCE.                                     #
 * #                                                                        #
 * #   - A chapter title marks a TURN. There is no turn before the first     #
 * #     section; its start is the film's start.                             #
 * #   - Saku's own a3 rule: "select ONLY for an explicit chapter or major   #
 * #     section heading. The end of a hook is not enough." Section 0 IS     #
 * #     the hook.                                                           #
 * #   - His spine is Hook -> A8 Gallery Strip -> Chapter Title -> Main      #
 * #     Content, so the title comes AFTER the opening gallery, and scene 0  #
 * #     carries the P03 opening title T-11 requires and the client praised. #
 * ##########################################################################
 */
export function sectionTitlesForBeats(input: {
  readonly sections: readonly DossierSection[]
  readonly scriptText: string
  readonly words: readonly AlignedWord[]
  readonly beats: readonly SectionCandidateBeat[]
  readonly toleranceMs?: number
}): SectionTitleResult {
  const tolerance = input.toleranceMs ?? SECTION_CUT_TOLERANCE_MS
  const tokens = scriptTokens(input.scriptText)
  const nothing: SectionTitleResult = {
    titleByBeat: new Map<number, string>(),
    placements: [],
    anchoredFraction: 0,
    refusedForDrift: false,
  }
  if (tokens.length === 0 || input.words.length === 0 || input.beats.length === 0) return nothing

  const anchor = anchorScriptToWords(tokens, input.words)
  const anchoredFraction = anchor.filter((entry) => entry !== null).length / tokens.length
  if (anchoredFraction < SECTION_MIN_ANCHORED_FRACTION) {
    return { ...nothing, anchoredFraction, refusedForDrift: true }
  }

  /** The first anchored token at or after `startChar`, as audio milliseconds. */
  const firstSpokenMs = (startChar: number): number | null => {
    const from = tokens.findIndex((token) => token.startChar >= startChar)
    if (from === -1) return null
    for (let i = from; i < tokens.length; i += 1) {
      const at = anchor[i]
      if (at !== undefined && at !== null) return input.words[at]?.startMs ?? null
    }
    return null
  }

  const titleByBeat = new Map<number, string>()
  const placements: SectionPlacement[] = []

  for (const [sectionIndex, section] of input.sections.entries()) {
    const title = section.title.trim()
    const base = { sectionIndex, title }

    if (sectionIndex === 0) {
      placements.push({ ...base, beatIndex: null, startMs: null, offsetMs: null, refusal: 'is-the-films-opening' })
      continue
    }
    if (title.length === 0) {
      placements.push({ ...base, beatIndex: null, startMs: null, offsetMs: null, refusal: 'no-title' })
      continue
    }

    const startMs = firstSpokenMs(section.startChar)
    if (startMs === null) {
      placements.push({ ...base, beatIndex: null, startMs: null, offsetMs: null, refusal: 'no-anchor-in-the-audio' })
      continue
    }

    /*
     * THE NEAREST CUT IN EITHER DIRECTION, not the next one forward.
     *
     * A beat that opens 400ms EARLY carries at most 400ms of the previous
     * section under the new heading. Taking the next cut FORWARD instead would
     * put four of this film's titles between 3.9 and 5.0 seconds late, which is
     * a heading announcing a chapter the viewer is already several sentences
     * into. Ties break on the lower beat index so the answer is deterministic —
     * `computeRenderKey` rests on this being a pure function of the plan.
     */
    let carrier: SectionCandidateBeat | null = null
    let best = Number.POSITIVE_INFINITY
    for (const beat of input.beats) {
      const delta = Math.abs(beat.startMs - startMs)
      if (delta < best) {
        best = delta
        carrier = beat
      }
    }

    if (carrier === null || best > tolerance) {
      placements.push({ ...base, beatIndex: null, startMs, offsetMs: null, refusal: 'no-cut-within-tolerance' })
      continue
    }

    /*
     * ONE BEAT CANNOT ANNOUNCE TWO CHAPTERS. With a tolerance in play two short
     * sections can both land on the same cut; the earlier one is the chapter
     * that cut actually opens, so the later loses rather than overwriting it.
     */
    if (titleByBeat.has(carrier.index)) {
      placements.push({
        ...base,
        beatIndex: null,
        startMs,
        offsetMs: carrier.startMs - startMs,
        refusal: 'beat-already-titled',
      })
      continue
    }

    titleByBeat.set(carrier.index, title)
    placements.push({
      ...base,
      beatIndex: carrier.index,
      startMs,
      offsetMs: carrier.startMs - startMs,
      refusal: null,
    })
  }

  return { titleByBeat, placements, anchoredFraction, refusedForDrift: false }
}
