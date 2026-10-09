import type { AmbienceClip, OverlayClip } from './effects.js'

/**
 * HOW OFTEN THE FILM MAY DRAW EACH OVERLAY CLIP. A SECOND TABLE, READ ONLY BY
 * THE PLANNER AND THE PLAN GATE.
 *
 * ##########################################################################
 * # WHY THESE THREE NUMBERS ARE NOT ON THE CLIP'S ROW IN `effects.ts`.     #
 * #                                                                        #
 * # The compositor imports `@vg/core/effects`, so every byte of that file  #
 * # is in `bundleHash`, and `bundleHash` is in EVERY scene's render key.   #
 * # `share`, `maxPerMinute` and `minGapSeconds` decide WHICH cuts get a    #
 * # burn. Nothing the compositor draws reads them.                         #
 * #                                                                        #
 * # On the row, moving the share from 1/9 to 1/7 after Niku watches the    #
 * # film moved `bundleHash` and re-rendered every segment, about two hours #
 * # on the box, when only the scenes that gain or lose a burn change. Here #
 * # it re-renders exactly those, because a scene's own key already folds   #
 * # in its `transitionIn` and `transitionOut`.                              #
 * #                                                                        #
 * # This is where the burn's density always lived before the clip table:  #
 * # `FILM_BURN_SHARE_PARKED` and the rate ceiling sat in the worker's      #
 * # `plan.ts`, which the compositor never imports.                         #
 * ##########################################################################
 *
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS, the same call as `sections.ts`.
 * A subpath would invite an import from `apps/web/src/remotion` and put these
 * numbers straight back into `bundleHash`. `bundleGraph.test.ts` refuses a
 * density field on a row the compositor bundles.
 *
 * ADDING A CLIP IS TWO PASTES, BOTH PRINTED BY `apps/web/scripts/fx-import.ts`:
 * its row into `OVERLAY_CLIPS` and its row here. `overlayClipDensity` throws
 * for a clip with no row here, and `effectDensity.test.ts` fails on either
 * half missing, so a forgotten paste stops the tests rather than the planner.
 */

export type OverlayClipDensity = {
  /** The `id` of the `OVERLAY_CLIPS` row this governs. */
  readonly id: string
  /** Its share of EVERY shot join, spread by the planner's content hash. */
  readonly share: number
  /** A ceiling in events per minute, measured off V19 against V20. */
  readonly maxPerMinute: number
  /**
   * ##########################################################################
   * # PHOTOSENSITIVITY. NO TWO WHITE-OUTS CLOSER THAN THIS, AND NONE THIS     #
   * # CLOSE TO A FLASH TRANSITION.                                           #
   * #                                                                        #
   * # burn02 whites out the whole frame for two frames (YMIN 252). The flash #
   * # is a near-white full-frame sheet too. A share alone allows two of them #
   * # on back-to-back cuts 1.3 seconds apart, so the planner refuses a        #
   * # candidate inside this gap and T-24 refuses a plan that breaks it.       #
   * ##########################################################################
   *
   * ##########################################################################
   * # 6 SECONDS SINCE 2026-09-18 (LEVER 2), THE DEVELOPER'S CALL. WAS 10.     #
   * #                                                                        #
   * # The recognised limit is about flashes inside ONE second: WCAG 2.3.1,   #
   * # from the broadcast flash test, allows no more than three. One burn is  #
   * # one two-frame white-out, so two of them 6 s apart are about eighteen   #
   * # times further apart than that limit needs. 10 was this project's own   #
   * # margin, not a measurement, and it was what capped the burn: measured   #
   * # on V57, only 57 of 163 cuts may carry one at all (rule 7 keeps every  #
   * # cut into and out of a template hard), and a 10 s gap fits at most 22   #
   * # of them whatever the share says.                                      #
   * ##########################################################################
   */
  readonly minGapSeconds: number
}

/**
 * THE TABLE. One row per clip, keyed by the clip's id. `fx-import.ts` prints a
 * row in exactly this shape.
 *
 * `share` is read as an AVERAGE share of every join and spread by the hash, NOT
 * a fixed pattern, which his 2026-08-31 ruling forbids by name. At `1 / 3`,
 * `maxPerMinute` 4.0 would quietly cap an 8m46 film at 35 rather than 54.
 *
 * ##########################################################################
 * # LEVER 2, 2026-09-18: 1/9 AND 10 s BECAME 1/5 AND 6 s. THE DEVELOPER'S   #
 * # CALL, ANSWERING HIS "more animations", AND ONE ROW TO TAKE BACK.        #
 * #                                                                        #
 * # 1/9 was his "every 9th cut". Raising the share ALONE bought one burn on #
 * # V57 (18 to 19), because the gap was the binding limit, so the two move  #
 * # together. Replayed through the real planner on V57's artifacts:         #
 * #                                                                        #
 * #   1/9, 10 s   18 burns   2.05 a minute   as delivered                   #
 * #   1/5, 10 s   19 burns                                                  #
 * #   1/5,  8 s   25 burns                                                  #
 * #   1/5,  6 s   28 burns   3.19 a minute   <- shipped                     #
 * #                                                                        #
 * # His 4-a-minute ceiling (35 on V57) still holds and does not bind. TO    #
 * # UNDO: `share: 1 / 9, minGapSeconds: 10`, which replays V57 exactly.     #
 * ##########################################################################
 */
export const OVERLAY_CLIP_DENSITY: readonly OverlayClipDensity[] = [
  {
    id: 'burn02',
    /* Lever 2, 2026-09-18. Was 1 / 9, his "every 9th cut". See the box above. */
    share: 1 / 5,
    maxPerMinute: 4,
    /* Lever 2, 2026-09-18. Was 10. See the field. */
    minGapSeconds: 6,
  },
]

/** The density row for a clip. Throws when there is none, so a half-pasted clip is never quietly planned. */
export function overlayClipDensity(clip: Pick<OverlayClip, 'id'>): OverlayClipDensity {
  const density = OVERLAY_CLIP_DENSITY.find((row) => row.id === clip.id)
  if (density === undefined) {
    throw new Error(
      `overlay clip '${clip.id}' has a row in OVERLAY_CLIPS but none in OVERLAY_CLIP_DENSITY ` +
        '(packages/core/src/effectDensity.ts). Paste the density row fx-import printed.',
    )
  }
  return density
}

/* ------------------------------------------------------------------------- */
/* How often the AMBIENCE plate is drawn, and on which shots                   */
/* ------------------------------------------------------------------------- */

/**
 * THE CLIENT'S 2026-09-15 RULING, AS TWO NUMBERS, AND OUT OF THE BUNDLE FOR
 * EXACTLY THE REASON THE BURN'S THREE ARE.
 *
 * ##########################################################################
 * # HIS WORDS, VERBATIM:                                                   #
 * #                                                                        #
 * #   "this FX should appear on around 6% of all images. On images that    #
 * #    are atleast 3 seconds long, preferably shown on images that run     #
 * #    longer. Avoid applying this overlay on images that are short cuts,  #
 * #    though it is allowed."                                             #
 * #                                                                        #
 * # `share` IS THE 6%. `minShotSeconds` IS THE 3. "Preferably longer" is   #
 * # not a number and is not here: it is the planner's RANKING, which       #
 * # weights each candidate's draw by its own length. "Though it is         #
 * # allowed" is why the floor is a floor on the CANDIDATE POOL and not an  #
 * # invariant — the plan gate reports a shot under the floor rather than   #
 * # refusing the plan, because refusing would contradict his own sentence. #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE COST OF GETTING THIS WRONG IS 1H21M, AND IT IS THE ONLY REASON     #
 * # THESE TWO NUMBERS ARE IN THIS FILE RATHER THAN ON THE ROW.             #
 * #                                                                        #
 * # The compositor imports `@vg/core/effects` to DRAW the plate, so         #
 * # `dir`, `frameCount` and `blend` are in `bundleHash` and must be — they #
 * # change the pixels of every shot that carries dust. `share` and         #
 * # `minShotSeconds` change only WHICH shots carry it, and each of those   #
 * # scenes' own render keys already says so, because `ambience` is hashed  #
 * # by `computeRenderKey`.                                                 #
 * #                                                                        #
 * # So moving the share from 6% to 8% after he watches the film re-renders #
 * # the handful of scenes that gain or lose a plate, not all 164. That is  #
 * # the same trade the burn's move from 1/9 to 1/7 taught this project the #
 * # expensive way.                                                         #
 * #                                                                        #
 * # THE BARREL ONLY, NEVER A SUBPATH, and `bundleGraph.test.ts` holds the  #
 * # other half: nothing the compositor bundles may name a density number.  #
 * # `effectDensity.test.ts` pins `minShotSeconds` to this file by name,    #
 * # because that word is newer than that sweep's regex.                    #
 * ##########################################################################
 */
export type AmbienceDensity = {
  /** The `id` of the `AMBIENCE_CLIPS` row this governs. */
  readonly id: string
  /** His 6%, read as a share of EVERY shot in the film, spread by the planner's content hash. */
  readonly share: number
  /**
   * His "atleast 3 seconds". THE FLOOR ON THE CANDIDATE POOL.
   *
   * A shot shorter than this is never chosen, which is the strong reading of a
   * sentence that also says a short cut "is allowed": allowed is what the plan
   * GATE permits on a hand-edited plan, chosen is what the planner does.
   */
  readonly minShotSeconds: number
  /**
   * HIS "ashes + shadow" VARIANT, AS THE EXTRA CORNER ALPHA OF A VIGNETTE.
   *
   * ##########################################################################
   * # A STRENGTH IN A FILE CALLED `effectDensity`, AND THE NAME IS THE ONLY   #
   * # THING WRONG WITH IT.                                                    #
   * #                                                                        #
   * # This file's real boundary is not often-versus-strong, it is BUNDLED     #
   * # versus NOT BUNDLED. The compositor imports `@vg/core/effects`, so every #
   * # byte of that file is in `bundleHash` and `bundleHash` is in all 164     #
   * # render keys; it does not import this one. A number that reaches a pixel #
   * # may still live here PROVIDED the planner copies it into the plan, which #
   * # is what `assignAmbience` does with this one — see                       #
   * # `SceneAmbienceSchema.shadow`.                                          #
   * #                                                                        #
   * # The payoff is the one the burn's share bought: moving this number       #
   * # re-renders the ten shots that carry a plate, not the whole film.        #
   * ##########################################################################
   *
   * ##########################################################################
   * # 0.25, AND IT IS 0.25 BECAUSE THE FILM ALREADY HAS A VIGNETTE.          #
   * #                                                                        #
   * # `Grade` (apps/web/src/remotion/Grade.tsx) draws                         #
   * #   radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,A))  #
   * # on EVERY shot, with A = grade.vignette * GRADE.vignetteAlphaPerUnit =   #
   * # 0.18 * (0.3/0.18) = 0.300. All 164 scenes of the delivered plan carry   #
   * # grade.vignette 0.18, so the corner of every frame ALREADY keeps only    #
   * # 0.700 of its picture. Confirmed on a frame cut out of                   #
   * # V56-full-2026-09-16.mp4: its outer radial band sits at 0.67-0.70 of the #
   * # middle, which is that 0.700.                                           #
   * #                                                                        #
   * # Two black gradients composited source-over MULTIPLY: base*(1-A)*(1-B).  #
   * # His clip's corner keeps about 0.52-0.55 of its plateau. So:            #
   * #                                                                        #
   * #   B = 0.25  ->  0.700 x 0.750 = 0.525 combined   <- HIS RATIO          #
   * #   B = 0.50  ->  0.700 x 0.500 = 0.350 combined   <- a telescope        #
   * #                                                                        #
   * # TAKING HIS MEASURED 0.5 AS THE ALPHA WOULD HAVE BEEN THE BUG. His 0.5  #
   * # is the FINISHED ratio, already including whatever vignette his own clip #
   * # has; ours is the SECOND darkening on top of one already there. The two  #
   * # compound, and 0.25 is what lands on his number once they do.            #
   * ##########################################################################
   */
  readonly shadowAlpha: number
  /**
   * THE BRIGHTNESS AT WHICH A SHOT STOPS GETTING "ashes" AND STARTS GETTING
   * "ashes + shadow". A shot whose `asset.vision.meanLuma` is AT LEAST this
   * takes the vignette, EXCEPT a device shot, which always takes the ashes
   * alone because on the device branch the vignette draws over the lettering
   * (`assignAmbience`, lever 1).
   *
   * ##########################################################################
   * # WHY THE TWO VARIANTS SPLIT ON BRIGHTNESS AT ALL, WHICH IS THE WHOLE     #
   * # DESIGN AND NOT AN OPTIMISATION.                                         #
   * #                                                                        #
   * # The plate is screened, and screen is 1-(1-a)(1-b): a mote ADDS          #
   * # (1-a)*b, so it adds nearly all of itself on a dark backdrop and almost  #
   * # nothing on a bright one. That is arithmetic, not a setting, and the box #
   * # on `AMBIENCE_CLIPS` in `effects.ts` says every blend that would be      #
   * # stronger over a bright picture gets there by DARKENING, which reads as  #
   * # dirt on the lens.                                                       #
   * #                                                                        #
   * # RENDERED AND LOOKED AT, over three real pictures from the film:         #
   * #                                                                        #
   * #   scene 59   YAVG  60.0   motes and soft bokeh, strength right          #
   * #   scene 38   YAVG 121.9   barely there, a few faint specks              #
   * #   scene 21   YAVG 165.9   INVISIBLE, not one mote findable at 1:1       #
   * #                                                                        #
   * # So his second variant is aimed where his first one is weakest: the      #
   * # vignette darkens the backdrop UNDER the plate, which lowers `a` and     #
   * # gives the specks somewhere to sit. A dark shot already reads and is the #
   * # one place a second darkening would cost something, so it keeps the      #
   * # plain variant. Both of his names get used, his 6% is untouched, and no  #
   * # further ruling was needed from him.                                     #
   * ##########################################################################
   *
   * ##########################################################################
   * # HOW MUCH IT ACTUALLY HELPS, MEASURED, AND IT IS NOT A CURE. SAY SO.     #
   * #                                                                        #
   * # Rendered through the real compositor at 1920x1080 and measured as Weber #
   * # contrast — how much a mote lifts its own backdrop, relative to that     #
   * # backdrop — over the outer region where the vignette acts:               #
   * #                                                                        #
   * #   DARK shot,   ashes           backdrop Y  62.0   contrast 0.3254       #
   * #   BRIGHT shot, ashes           backdrop Y 146.1   contrast 0.0855       #
   * #   BRIGHT shot, ashes + shadow  backdrop Y 136.2   contrast 0.0946       #
   * #                                                                        #
   * # So the shadow buys about 1.11x on a frame-wide sample, and about 1.33x  #
   * # at the extreme corner where the ramp is at full strength. It does NOT   #
   * # close the 3.8x gap between a bright shot and a dark one.                #
   * #                                                                        #
   * # IT CANNOT, AND THAT IS A CONSTRAINT RATHER THAN A SHORTFALL. His own    #
   * # reference only darkens the OUTER region and only by about a quarter at  #
   * # the corner; the plate spreads motes over the whole frame, so most of    #
   * # them sit where his vignette barely reaches. Going stronger would buy    #
   * # visibility by abandoning the look he sent us, which is the telescope    #
   * # the box above rules out.                                                #
   * #                                                                        #
   * # THE TWO LEVERS THAT WOULD ACTUALLY CLOSE IT, and the box on             #
   * # `AMBIENCE_CLIPS` in `effects.ts` already names them: prefer the darker  #
   * # shots when choosing the 6 per cent, or send a brighter plate. Neither   #
   * # is a blend change.                                                      #
   * #                                                                        #
   * # THE FIRST ONE IS BUILT as `preferDark` below and is ON SINCE           #
   * # 2026-09-17, the developer's decision rather than his: his hard rules    #
   * # (6 per cent, at least 3 seconds) are untouched, "preferably longer"     #
   * # was a preference, and a plate nobody can see serves none of it. He is   #
   * # told with the film, and his "no" is one word on the row. The second     #
   * # lever still needs a plate from him.                                     #
   * ##########################################################################
   *
   * ##########################################################################
   * # 0.45 IS THE FILM'S OWN MEDIAN, NOT A CHOSEN NUMBER.                     #
   * #                                                                        #
   * # `meanLuma` is on `asset.vision`, 0-1, and is present on all 164 scenes  #
   * # of the delivered plan. Its distribution there is min 0.18, p25 0.40,    #
   * # MEDIAN 0.45, p75 0.55, max 0.81. So this splits the film in half by     #
   * # construction: the darker half takes the ashes alone.                    #
   * #                                                                        #
   * # CHECKED AGAINST THE THREE PICTURES ACTUALLY LOOKED AT. `meanLuma` is    #
   * # the vision model's reading of the SOURCE image and YAVG is measured on  #
   * # the RENDERED frame; across those three the two are tightly linear       #
   * # (YAVG ~= 189*meanLuma + 12.7, within 4 code values on all three):       #
   * #                                                                        #
   * #   scene 59  meanLuma 0.25  -> ashes         and it read beautifully     #
   * #   scene 38  meanLuma 0.60  -> ashes+shadow  and it was "barely there"   #
   * #   scene 21  meanLuma 0.81  -> ashes+shadow  and it was invisible        #
   * #                                                                        #
   * # So the split agrees with every picture that was looked at, which is the #
   * # most that can be asked of a threshold with three ground truths.         #
   * #                                                                        #
   * # ON THE TEN SHOTS HIS RULE ACTUALLY SELECTS it gives 2 ashes (0.25,      #
   * # 0.35) and 8 ashes+shadow (0.45, 0.48, 0.52, 0.55, 0.58, 0.60, 0.70,     #
   * # 0.81). Lopsided, and correctly so: the ranking weights by DURATION and  #
   * # is blind to brightness, so most of the ten are the bright shots where   #
   * # the plate cannot currently be seen. That imbalance is the problem this  #
   * # field exists to fix, not evidence against it.                           #
   * #                                                                        #
   * # AT LEAST, not greater than, so a shot sitting exactly on the median     #
   * # takes the shadow. `meanLuma` is quantised to 0.01 by the model and 0.45 #
   * # is a popular value, so the boundary case is common rather than          #
   * # theoretical. A shot at 0.45 renders near YAVG 98, nearer the "barely    #
   * # there" 122 than the "beautiful" 60, so the visible half is the safe     #
   * # side of that edge.                                                      #
   * ##########################################################################
   */
  readonly shadowMinLuma: number
  /**
   * SHOULD HIS 6 PER CENT GO TO THE DARKEST ELIGIBLE SHOTS RATHER THAN THE
   * LUCKY-AND-LONG ONES? HIS CALL, ASKED 2026-09-17, AND PARKED AT `false`
   * UNTIL HE ANSWERS.
   *
   * ##########################################################################
   * # THE QUESTION, AND WHY IT IS HIS.                                        #
   * #                                                                        #
   * # The plate is screened, so it reads on a dark picture and vanishes on a #
   * # bright one — MEASURED as Weber contrast 0.3254 on a dark shot against   #
   * # 0.0855 on a bright one, and 0.0946 with the shadow. The ranking he      #
   * # ruled on, "preferably ... run longer", is blind to brightness, so eight #
   * # of the ten shots it picks on the delivered film are the bright half.    #
   * # Preferring the dark shots is the only lever that closes that 3.8x gap   #
   * # without changing his plate or his look — and it changes WHICH shots he #
   * # sees the effect on, which is his ruling to amend, not ours.             #
   * ##########################################################################
   *
   * ##########################################################################
   * # WHAT THE TWO VALUES DO, AND WHAT DOES NOT MOVE EITHER WAY.              #
   * #                                                                        #
   * #   false  the rank is `draw * durationFrames`, exactly as delivered.     #
   * #          The plan is byte-identical to the one before this field.       #
   * #                                                                        #
   * #   true   the rank is `meanLuma` ASCENDING, darkest first. A shot with   #
   * #          no reading sorts after every shot that has one. Two shots at   #
   * #          the same brightness keep their `false` order, so the choice    #
   * #          stays deterministic and "preferably longer" still decides     #
   * #          between equals. `meanLuma` is quantised to 0.01, so equals are #
   * #          common and that tie-break is real, not theoretical.            #
   * #                                                                        #
   * # UNCHANGED BY BOTH: the quota (his 6% of EVERY shot), the eligibility    #
   * # rule, the 3-second floor, and the shadow split — a chosen shot at or    #
   * # above `shadowMinLuma` still takes the vignette, unless it is a device   #
   * # shot (lever 1). `true` simply means far fewer chosen shots get there.   #
   * ##########################################################################
   *
   * ##########################################################################
   * # ON THE ROW RATHER THAN A LONE CONSTANT, FOR THE SAME REASON THE SHADOW  #
   * # SPLIT IS.                                                               #
   * #                                                                        #
   * # Whether a plate wants dark pictures is a fact about THAT plate's blend  #
   * # and brightness. A brighter plate he sends later may read on anything,   #
   * # and `assignAmbience` already reads every other choosing and variant    #
   * # knob off each plate's own row. A module-wide switch would silently      #
   * # apply his answer about the dust to a plate he has not seen.             #
   * #                                                                        #
   * # AND IN THIS FILE, NOT `effects.ts`, because that file is in             #
   * # `bundleHash`. Flipping this re-plans and moves the render keys of only  #
   * # the shots that gain or lose a plate — sixteen on the delivered film,    #
   * # measured below — rather than all 164.                                   #
   * ##########################################################################
   *
   * ##########################################################################
   * # MEASURED by replaying job c75d51e6's own artifacts through the planner, #
   * # both ways. 164 shots, 58 in the pool, pool mean `meanLuma` 0.485.       #
   * #                                                                        #
   * #   false  scenes 8 21 32 38 59 85 120 149 151 152                        #
   * #          meanLuma 0.45 0.81 0.35 0.60 0.25 0.70 0.52 0.48 0.55 0.58     #
   * #          MEAN 0.529, mean length 4.11 s, 2 ashes / 8 ashes+shadow       #
   * #                                                                        #
   * #   true   scenes 4 18 32 55 59 68 82 94 128 134                          #
   * #          meanLuma 0.20 0.35 0.35 0.35 0.25 0.28 0.25 0.20 0.33 0.22     #
   * #          MEAN 0.278, mean length 3.81 s, 10 ashes / 0 ashes+shadow      #
   * #                                                                        #
   * # So `true` puts every plate on a picture darker than scene 38's "barely  #
   * # there" and in scene 59's "beautiful" range, keeps two shots (32, 59),   #
   * # moves eight, and gives back 0.30 s of his "preferably longer". The      #
   * # `false` plan replays byte-identical to the one before this field.       #
   * #                                                                        #
   * # SAY THIS TO HIM PLAINLY: on this film no tie straddles the cut — the    #
   * # tenth-darkest shot is 0.35 and the eleventh is 0.38 — so `true` is in   #
   * # effect "the ten darkest", and the seeded draw decides nothing. His       #
   * # 2026-08-31 ruling (on the burn) forbids a PERIODIC pattern, and a sort   #
   * # by picture brightness is not one — the ten land at 4 18 32 55 59 68 82  #
   * # 94 128 134 — but it is no longer "randomly", and that is part of what   #
   * # he is saying yes to.                                                    #
   * ##########################################################################
   */
  readonly preferDark: boolean
  /**
   * DO THE CLIENT'S STILL-PICTURE ANIMATIONS GET FIRST CLAIM ON HIS 6 PER CENT?
   * LEVER 1 OF 2026-09-18, THE DEVELOPER'S CALL, AND A SWITCH SO IT CAN BE
   * TAKEN BACK WITH ONE WORD.
   *
   * ##########################################################################
   * # WHY. Measured on V57, 16 of 164 shots are COMPLETELY FROZEN once their #
   * # animation settles, 23.5 s of the film. They are the client's own       #
   * # animations, which draw the photograph as a plain untransformed fill,   #
   * # so once the type has landed nothing on the frame moves. Saku's rule is #
   * # "something needs to be happening in each frame", and these are the    #
   * # shots that break it. The plate is the one moving thing that can reach  #
   * # them without a compositor edit, because `Scene.tsx` already mounts it  #
   * # on the device branch.                                                  #
   * ##########################################################################
   *
   * ##########################################################################
   * # WHAT THE TWO VALUES DO.                                                #
   * #                                                                        #
   * #   false  no device shot is ever a candidate. The plan is byte-identical #
   * #          to the one before this field, which is how he gets V57's dust  #
   * #          back if the change looks off.                                  #
   * #                                                                        #
   * #   true   a shot drawing one of `STILL_PICTURE_DEVICES` (the worker's    #
   * #          plan.ts) that holds still for a second after its animation    #
   * #          settles (`MIN_FROZEN_FRAMES`) becomes a candidate WHEN THE     #
   * #          PLATE CAN BE SEEN ON IT, and goes ahead of every ordinary      #
   * #          shot. Each half keeps today's order, so `preferDark` still     #
   * #          decides inside each.                                          #
   * #                                                                        #
   * # UNCHANGED BY BOTH: the quota (his 6% of EVERY shot), the 3-second      #
   * # floor, and every device the table does not list, which stays excluded  #
   * # for the reason `ambienceCandidates` gives.                             #
   * ##########################################################################
   *
   * ##########################################################################
   * # "WHEN THE PLATE CAN BE SEEN ON IT" IS THE TRAP OF 2026-09-17, NOT A    #
   * # REFINEMENT. See `handoff/traps.md`, "AN EFFECT THAT ADDS LIGHT CANNOT   #
   * # BE SEEN ON A PICTURE THAT IS ALREADY BRIGHT": a selection rule that is  #
   * # blind to brightness spends the budget where it shows least. A frozen   #
   * # shot the specks cannot be seen on gains nothing from first claim, and   #
   * # it would take a plate off a dark shot where they read. The line is      #
   * # `stillShotMaxLuma` below, and it is measured.                           #
   * ##########################################################################
   *
   * NOT A RULING OF HIS, AND NOT A CHANGE TO ONE. His 6% says "of all images"
   * and names none, `preferDark` was already the developer's call, and the
   * device exclusion this relaxes was this project's own line in `plan.ts`.
   * Out of `bundleHash` for the reason every field on this row is: flipping it
   * re-plans and re-renders only the shots that gain or lose a plate.
   */
  readonly stillShotsFirst: boolean
  /**
   * THE LINE UNDER WHICH A FROZEN SHOT COUNTS AS ONE THE SPECKS CAN BE SEEN
   * ON. A still-picture device shot is a candidate only when its
   * `asset.vision.meanLuma` is STRICTLY BELOW this. Read only under
   * `stillShotsFirst`.
   *
   * ##########################################################################
   * # NOT `shadowMinLuma`, AND THE MEASUREMENT IS WHY. `meanLuma` is the     #
   * # vision model's reading of the SOURCE picture, and a device redraws     #
   * # that picture: beat 31 reads 0.14 and renders at YAVG 128, beat 154     #
   * # reads 0.45 and renders at YAVG 62 over its own black ground. So the    #
   * # line that splits ordinary shots in half would have admitted 2 of V57's #
   * # 8 long frozen shots and refused four the dust reads on.                #
   * ##########################################################################
   *
   * ##########################################################################
   * # 0.55, FROM ALL EIGHT, RENDERED THROUGH THE REAL COMPOSITOR AT THEIR    #
   * # SETTLED FRAME AND MEASURED AS WEBER CONTRAST OVER THE OUTER REGION     #
   * # (the same measure as the three reference shots on `shadowMinLuma`,    #
   * # where 0.3254 was "beautiful" and about 0.14 "barely there"):           #
   * #                                                                        #
   * #   meanLuma 0.14  beat  31  corner-label     0.370                     #
   * #            0.38  beat  94  chapter-plate    0.281                     #
   * #            0.45  beat  24  top-title        0.330                     #
   * #            0.45  beat 154  two-photo-zoom   1.848  (black ground)     #
   * #            0.51  beat  52  shadow-up        0.249                     #
   * #            0.52  beat  41  corner-label     0.235                     #
   * #   -------------------------------------------- the line --           #
   * #            0.55  beat 146  chapter-plate    0.177                     #
   * #            0.55  beat 120  top-title        0.117  "barely there"     #
   * #                                                                        #
   * # Every shot under it reads at 0.235 or better; the only two at it are   #
   * # the two worst. 0.55 is also the ceiling four of these animations set  #
   * # for their own type (`maxMeanLuma`, which admits 0.55), so the line     #
   * # refuses exactly the pictures at the very top of what they accept.      #
   * # Eight points is a small sample: move it when a new film says so.       #
   * ##########################################################################
   */
  readonly stillShotMaxLuma: number
}

/**
 * THE TABLE. One row per plate, keyed by the plate's id.
 *
 * ##########################################################################
 * # NO `maxPerMinute` AND NO `minGapSeconds`, AND THE ABSENCE IS THE POINT. #
 * #                                                                        #
 * # Those two exist on a burn row because burn02 whites the WHOLE FRAME out #
 * # for two frames (YMIN 252) and photosensitivity needs a floor between    #
 * # white-outs. This plate has no flash in it at all — its brightness curve #
 * # runs 0.698 to 0.742 of a code value across all 360 frames, flat enough  #
 * # that the importer's peak finder cannot find a peak — so neither number  #
 * # would protect anything.                                                 #
 * #                                                                        #
 * # And his rule is not a rate. It is a share of IMAGES with a floor on how #
 * # long they run, which is what these two fields are. Copying the burn's   #
 * # two across would be a guard that reads like a measurement and is not.   #
 * ##########################################################################
 */
export const AMBIENCE_DENSITY: readonly AmbienceDensity[] = [
  {
    id: 'dust',
    share: 0.06,
    minShotSeconds: 3,
    shadowAlpha: 0.25,
    shadowMinLuma: 0.45,
    /* ON since 2026-09-17, the developer's call, told to him with the film. `false` = his literal "preferably longer". See the field. */
    preferDark: true,
    /* ON since 2026-09-18, lever 1, the developer's call. `false` = V57's dust exactly. See the field. */
    stillShotsFirst: true,
    /* Measured on V57's eight long frozen shots, 2026-09-18. See the field. */
    stillShotMaxLuma: 0.55,
  },
  {
    /* The light leak (owner 2026-10-09): about 7% of all shots, only on otherwise empty pictures. The planner chooses. */
    id: 'leak',
    share: 0.07,
    minShotSeconds: 2,
    shadowAlpha: 0,
    shadowMinLuma: 1,
    preferDark: false,
    stillShotsFirst: false,
    stillShotMaxLuma: 1,
  },
]

/** The density row for a plate. Throws when there is none, so a half-pasted plate is never quietly planned. */
export function ambienceDensity(clip: Pick<AmbienceClip, 'id'>): AmbienceDensity {
  const density = AMBIENCE_DENSITY.find((row) => row.id === clip.id)
  if (density === undefined) {
    throw new Error(
      `ambience clip '${clip.id}' has a row in AMBIENCE_CLIPS but none in AMBIENCE_DENSITY ` +
        '(packages/core/src/effectDensity.ts). Paste the density row fx-import printed.',
    )
  }
  return density
}
