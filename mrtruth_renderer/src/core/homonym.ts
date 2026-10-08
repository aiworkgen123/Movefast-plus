/**
 * IS THE DRAWN CAPTION NAMING A DIFFERENT THING FROM THE ONE IN THE PICTURE?
 *
 * ##########################################################################
 * # THE FRAME THIS EXISTS FOR, AND THE CLIENT SCREENSHOTTED IT.            #
 * #                                                                        #
 * # At 1:10 of a delivered film, a `framed-card` captioned "Enoch" sat     #
 * # over `File:Enoch_Powell_6_Allan_Warren.jpg` — a photograph of the      #
 * # British politician, in a documentary about the Book of Enoch, on a     #
 * # monetised channel. The ranker scored it 9 and wrote "Direct portrait   #
 * # of Enoch Powell matching the exact subject of the narration."          #
 * #                                                                        #
 * # It was asked whether the picture SUITS a beat about Enoch. A           #
 * # photograph of a man named Enoch does. Nothing asked whether the man    #
 * # IS the Enoch the film means. That is trap V, and this is a net under   #
 * # it rather than a fix for it.                                           #
 * #                                                                        #
 * # The client, 2026-08-31: "I also noticed a few of these animations have #
 * # a unsuitable Image. The AI should have understood the topic and the    #
 * # concept, and searched for 'Prophet enoch'."                            #
 * #                                                                        #
 * # It was removed from V17 BY HAND, as two edits to a frozen plan. A      #
 * # fresh re-plan puts it straight back: `tmp/plan-new-2026-08-30.json`    #
 * # scene 19 carries it today. So this module is what unblocks re-planning #
 * # the film at all.                                                       #
 * ##########################################################################
 *
 * ##########################################################################
 * # FOUR FACTS, EACH MEASURED OVER EVERY ARTIFACT ON DISK RATHER THAN      #
 * # ARGUED. The corpus is 756 (entity, ranked candidate) pairs drawn from  #
 * # every `source.json` and `segment.json` in `storage/artifacts`. The     #
 * # rule fires TWICE, and both are the same photograph, in jobs 5c55cd11   #
 * # and 835cd84f.                                                          #
 * #                                                                        #
 * # 1. IT READS `reason` AND NEVER `sourceUrl`.                            #
 * #    A variant that also mined the Commons file name FALSELY FIRED on    #
 * #    job 99414763 scene 74. `File:Torleif_Elgvin,_Scrolls_lab_2018.jpg`  #
 * #    glues into the run [Torleif, Elgvin, Scrolls], so the correct       #
 * #    two-word caption "Torleif Elgvin" becomes a strict prefix of a      #
 * #    three-word run and a true caption is refused. Measured, not feared. #
 * #                                                                        #
 * # 2. THE PERSON GATE IS LOAD-BEARING, AND HERE IS THE CASE.              #
 * #    Remove it and a third pair fires: job 835cd84f scene 33, caption    #
 * #    "Aksum" over "Shows a church precinct in Aksum, Ethiopia". The run  #
 * #    is [Aksum, Ethiopia] and "Aksum" is a strict prefix, so an ungated  #
 * #    rule refuses a caption that is completely correct. That is exactly  #
 * #    the failure mode trap FF recorded when it refuted the "fragment     #
 * #    rule", and the gate is the whole difference.                        #
 * #                                                                        #
 * #    THE FRAGMENT RULE IS NOT WRITTEN HERE, and trap FF's refutation     #
 * #    reproduces exactly. Job 5c55cd11's sentence reads "...which fits    #
 * #    the entity named Enoch...", so "Enoch" DOES appear standing alone   #
 * #    and any EVERY-sighting quantifier returns false and keeps the       #
 * #    caption. This rule quantifies over runs, not over sightings.        #
 * #                                                                        #
 * # 3. STRICT, NEVER EQUAL.                                                #
 * #    "Torleif Elgvin" over a picture the ranker calls "scholar Torleif   #
 * #    Elgvin himself" is the caption naming the WHOLE person and it must  #
 * #    survive. Only a caption naming PART of a longer name is a homonym.  #
 * #                                                                        #
 * # 4. IT IS A NET, NOT A GUARANTEE, AND SAYING SO IS THE POINT.           #
 * #    `AssetVisionSchema` has seven fields and not one of them is a       #
 * #    person flag — `subjectAnchor` is a position, not an identity. So    #
 * #    this reads prose the model happened to volunteer. Reword the        #
 * #    sentence to "a man in a suit" and it goes blind and keeps the       #
 * #    caption. THE REAL FIX IS THE RANKER'S PROMPT, asking whether the    #
 * #    picture IS the thing rather than A thing of that kind. Trap V.      #
 * #    Still open.                                                         #
 * ##########################################################################
 */

/**
 * Tokens. The Latin-1 and Latin Extended-A/B range is deliberate — this
 * narration carries "École Biblique", "Schøyen" and "Ludwig-Maximilians-
 * Universität München", and splitting those on the accent would manufacture
 * capitalised runs that are not names.
 */
function words(text: string): string[] {
  return text.split(/[^A-Za-zÀ-ɏ0-9]+/u).filter((token) => token.length > 0)
}

/**
 * Runs of two or more consecutive capitalised tokens, which is what a personal
 * name looks like in the ranker's prose.
 *
 * Single characters are excluded so an initial does not open a run — "A
 * portrait of J. Smith" should read as [Smith] and not as [J, Smith], because
 * a one-letter head makes almost any caption a strict prefix.
 */
function nameRuns(text: string): string[][] {
  const runs: string[][] = []
  let run: string[] = []

  for (const token of words(text)) {
    const capitalised = token.length > 1 && token[0] === token[0]?.toUpperCase() && /[A-Za-zÀ-ɏ]/u.test(token[0] ?? '')
    if (capitalised) {
      run.push(token)
      continue
    }
    if (run.length >= 2) runs.push(run)
    run = []
  }
  if (run.length >= 2) runs.push(run)

  return runs
}

/**
 * A CLOSED, FROZEN LIST, AND IT IS DELIBERATELY SHORT.
 *
 * Every word here is one the ranker actually used in this corpus about a human
 * subject. It is not a general person detector and must not grow into an
 * attempt at one — each addition widens what fact 2 above shows is the
 * dangerous direction, refusing correct captions over places and objects whose
 * names happen to run on.
 */
const PERSON_WORDS: ReadonlySet<string> = new Set([
  'portrait',
  'portraits',
  'politician',
  'statesman',
  'scholar',
  'historian',
  'archaeologist',
  'professor',
])

function claimsAPerson(reason: string): boolean {
  return words(reason).some((token) => PERSON_WORDS.has(token.toLowerCase()))
}

/**
 * Is `printed` the opening of `run`, and SHORTER than it?
 *
 * Equal length is not a fragment — see fact 3. Empty is not a fragment either,
 * or every run would match every blank caption.
 */
function isStrictOpeningFragment(printed: readonly string[], run: readonly string[]): boolean {
  if (printed.length === 0 || printed.length >= run.length) return false
  return printed.every((token, index) => token.toLowerCase() === run[index]?.toLowerCase())
}

/**
 * True when one of the strings about to be DRAWN names only the opening of a
 * longer personal name the picture's own description gives.
 *
 * @param printed every string this device would put on screen, from
 *                `printedLines`. Passing the scene's entity list instead is how
 *                the same predicate refuses the CANDIDATE upstream, so a
 *                picture and its caption cannot disagree about whether a
 *                homonym was caught.
 * @param reason  `AssetVision.reason`, the ranker's own prose. `null` when the
 *                scene has no picture of its own, and null never fires — a
 *                caption over an inherited or generated frame is a different
 *                problem with different guards.
 */
export function marksTheWrongPerson(printed: readonly string[], reason: string | null): boolean {
  if (reason === null || !claimsAPerson(reason)) return false

  const runs = nameRuns(reason)
  return printed.some((line) => runs.some((run) => isStrictOpeningFragment(words(line), run)))
}
