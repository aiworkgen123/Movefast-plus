/**
 * THE CLIPS THE FILM MAY DRAW OVER A CUT, AS A TABLE THE DEVELOPER EDITS.
 *
 * ##########################################################################
 * # NIKU'S LIGHT BURN, TRANSITION 02, 2026-09-13, AND THE SMALLEST P9.     #
 * #                                                                        #
 * #   "this has 19 transitions. We only want to test transition 2. Don't   #
 * #    activate other ones. Use this original MOV directly in Remotion.    #
 * #    Apply this at scene cuts using the appropriate blend mode"          #
 * #                                                                        #
 * # The MOV itself cannot reach the render box: Chrome cannot decode       #
 * # ProRes and `templates/` is gitignored. So each clip is transcoded ONCE #
 * # by `apps/web/scripts/fx-import.ts` into a folder of full-range 1080p   #
 * # JPEGs under `apps/web/public/fx/<id>/`, committed, and drawn one image #
 * # per frame with a screen blend. That script also prints the rows.       #
 * #                                                                        #
 * # ADDING A SECOND CLIP IS: run fx-import, paste its row here and its     #
 * # density row into `effectDensity.ts`. Nothing else. `filmBurn` stays    #
 * # the one transition type and each transition records WHICH row it      #
 * # draws in `clip`, so frozen plans keep parsing and the planner, the     #
 * # compositor, the invariants and T-24 all read this.                     #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE CLIP STRADDLES THE CUT, AND THAT IS WHAT `leadFrames` IS.          #
 * #                                                                        #
 * # Segments render in isolation, so no layer may span two of them. The    #
 * # approved preview puts the brightest frames ON the cut, which means the #
 * # OUTGOING shot draws the first `leadFrames` of the clip over its own    #
 * # last frames (`transitionOut`) and the INCOMING shot draws the rest     #
 * # over its first frames (`transitionIn`).                                #
 * #                                                                        #
 * # 12 FOR burn02, MEASURED OFF THE PREVIEW NIKU WATCHED. Every white-out  #
 * # in BURN-TEST-A and BURN-TEST-B was matched against the plan's real     #
 * # cuts (offset fixed by 12 of 15 plain cuts): the burn frame sitting on  #
 * # the first incoming frame was 11 four times, 12 three times and 13      #
 * # twice. The preview was placed by rounding seconds, so it wobbles a     #
 * # frame; 12 is its middle, and it lands clip frame 12, the first of the  #
 * # two full white-outs (YMIN 252), on the cut.                            #
 * ##########################################################################
 *
 * ##########################################################################
 * # IMPORTED BY THE COMPOSITOR as `@vg/core/effects`, SO EVERY BYTE OF     #
 * # THIS FILE IS IN `bundleHash`, AND ONLY WHAT A SEGMENT DRAWS BELONGS.   #
 * #                                                                        #
 * # A change to `dir`, `frameCount`, `leadFrames` or `blend` changes the    #
 * # pixels of every burn, so it SHOULD move `bundleHash`. How OFTEN a clip #
 * # is drawn (`share`, `maxPerMinute`, `minGapSeconds`) changes only which #
 * # scenes carry one, and those scenes' own render keys already say so.    #
 * # Those numbers live in `effectDensity.ts`, barrel only, so a density    #
 * # tweak re-renders the scenes it moves instead of the whole film.        #
 * # `bundleGraph.test.ts` refuses them here. This file imports nothing, so #
 * # it drags nothing else into the bundle graph.                           #
 * ##########################################################################
 */

/** How a clip is composited over the shot. Only `screen` is drawn today. */
export type OverlayBlend = 'screen'

export type OverlayClip = {
  /** What a transition records in `clip`. Lower case, digits and hyphens. */
  readonly id: string
  /** Where the MOV came from, for the next person. Nothing reads it. */
  readonly source: string
  /** The frame folder under `apps/web/public`, handed to `staticFile`. */
  readonly dir: string
  /** Frames in the folder, `000.jpg` upward, at the film's 30 fps. */
  readonly frameCount: number
  /** Frames drawn over the OUTGOING shot's last frames. The rest are the incoming shot's. */
  readonly leadFrames: number
  readonly blend: OverlayBlend
}

/** THE TABLE. One row per clip. `fx-import.ts` prints a row in exactly this shape. */
export const OVERLAY_CLIPS: readonly OverlayClip[] = [
  {
    id: 'burn02',
    source: 'templates/Templates/Light Burn Transitions 02.mov',
    dir: 'fx/burn02',
    frameCount: 26,
    leadFrames: 12,
    blend: 'screen',
  },
]

/** A clip id is one path segment, so it can name its own folder. */
export const OVERLAY_CLIP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

/**
 * The row a transition names, or null for none, an unknown id, or a frozen plan
 * that predates `clip`. Null is never drawn and T-24 refuses it.
 */
export function overlayClipById(id: string | undefined): OverlayClip | null {
  if (id === undefined) return null
  return OVERLAY_CLIPS.find((clip) => clip.id === id) ?? null
}

/** Frames drawn over the INCOMING shot, which is what `transitionIn.durationFrames` must be. */
export function overlayClipTailFrames(clip: OverlayClip): number {
  return clip.frameCount - clip.leadFrames
}

/** The public-relative path of one frame, `fx/burn02/012.jpg`. */
export function overlayClipFramePath(clip: OverlayClip, index: number): string {
  return `${clip.dir}/${String(index).padStart(3, '0')}.jpg`
}

/* ------------------------------------------------------------------------- */
/* The AMBIENCE plate — a second kind of clip, and deliberately not the first  */
/* ------------------------------------------------------------------------- */

/**
 * A CLIP THAT RUNS FOR A WHOLE SHOT INSTEAD OF ACROSS A CUT.
 *
 * ##########################################################################
 * # THE CLIENT, 2026-09-15, VERBATIM:                                      #
 * #                                                                        #
 * #   "this FX should appear on around 6% of all images. On images that    #
 * #    are atleast 3 seconds long, preferably shown on images that run     #
 * #    longer. Avoid applying this overlay on images that are short cuts,  #
 * #    though it is allowed."                                             #
 * #                                                                        #
 * # AND SAKU, 2026-09-16: "Something needs to be happening in each frame.  #
 * # And that doesnt include zoom." 163 of the delivered film's 164 shots   #
 * # fail that as written, and no camera change can answer it, because      #
 * # every shot is the zoom the client himself approved. A continuous       #
 * # particle layer over the picture is the one thing that answers both     #
 * # notes at once, which is why this table exists.                         #
 * ##########################################################################
 *
 * ##########################################################################
 * # WHY THIS IS NOT A ROW OF `OVERLAY_CLIPS`, AND THE ANSWER IS            #
 * # `leadFrames`.                                                          #
 * #                                                                        #
 * # Every field on `OverlayClip` that is not shared is about A CUT.        #
 * # `leadFrames` means "frames drawn over the OUTGOING shot", and          #
 * # `overlayClipTailFrames` derives the incoming half from it. Both are    #
 * # meaningless for a plate that starts at the shot's own frame 0 and runs #
 * # to its last frame — there is no outgoing half and no incoming half,    #
 * # there is one shot.                                                     #
 * #                                                                        #
 * # BENDING THE FIRST ROW WOULD NOT HAVE BEEN INERT. A `leadFrames: 0` row #
 * # is not "no lead": `overlayClipFrame`'s 'in' branch reads               #
 * # `clip.leadFrames + frame`, so a zero-lead row pasted into              #
 * # `OVERLAY_CLIPS` draws the WHOLE 360-frame plate over the first 360     #
 * # frames of the incoming shot — twelve seconds of dust keyed to a        #
 * # transition nobody asked for. `effects.test.ts` pins `leadFrames >= 1`  #
 * # for exactly that reason, and T-24 would then demand a paired lead-in   #
 * # on the shot before. Two tables, two shapes, no bending.                #
 * #                                                                        #
 * # WHAT IS SHARED IS SHARED: `id`, `source`, `dir`, `frameCount`,         #
 * # `blend`. What is NOT here is anything about a cut, and what is not     #
 * # here either is how OFTEN the plate is drawn — that is                  #
 * # `AMBIENCE_DENSITY` in `effectDensity.ts`, for the bundleHash reason    #
 * # the box at the top of this file gives.                                 #
 * ##########################################################################
 *
 * ##########################################################################
 * # `frameCount` IS A LOOP PERIOD HERE, NOT A LENGTH.                      #
 * #                                                                        #
 * # The drawer indexes `frame % frameCount`, so the plate wraps and a shot #
 * # of any length is covered. The import measured his plate's own wrap at  #
 * # 1.40x a normal adjacent step against 1.94x for two unrelated frames,   #
 * # so it wraps softly — and at 360 frames it is 12 seconds, while the     #
 * # longest shot in the delivered film is 4.93 s, so in THIS film the wrap #
 * # is never reached at all.                                               #
 * ##########################################################################
 */
export type AmbienceClip = {
  /** What a scene's `ambience` records in `clip`. Lower case, digits and hyphens. */
  readonly id: string
  /** Where the MOV came from, for the next person. Nothing reads it. */
  readonly source: string
  /** The frame folder under `apps/web/public`, handed to `staticFile`. */
  readonly dir: string
  /** Frames in the folder, `000.jpg` upward, at the film's 30 fps. THE LOOP PERIOD. */
  readonly frameCount: number
  readonly blend: OverlayBlend
}

/**
 * THE TABLE. One row per plate. `fx-import.ts --mode=ambience` prints a row in
 * exactly this shape.
 *
 * ##########################################################################
 * # `screen`, DELIBERATELY, AND THE WEAKNESS IS THE EFFECT BEING RIGHT.    #
 * #                                                                        #
 * # Screen is 1-(1-a)(1-b) and can only ADD light, which is what dust      #
 * # physically is: motes catching a shaft of light, never removing any.    #
 * # MEASURED by compositing plate frame 100 onto three real frames cut out #
 * # of the delivered film: +0.594 mean light over the darkest candidate,   #
 * # +0.405 over the median, +0.338 over the brightest. So it puts 76 per   #
 * # cent more light on a dark picture than on a bright one, and over the   #
 * # brightest engravings it is close to not there.                         #
 * #                                                                        #
 * # Every blend that would be stronger over a bright picture gets that     #
 * # strength by DARKENING somewhere, and a dust plate that darkens reads   #
 * # as dirt on the lens rather than motes in air. The two honest cures are #
 * # both the client's call: prefer the darker shots when choosing the 6    #
 * # per cent, or send a brighter plate. Neither is a blend change.         #
 * #                                                                        #
 * # `OverlayBlend` is still a union of exactly one member, and it stays    #
 * # one: both kinds of clip screen, so nothing here widens it.             #
 * ##########################################################################
 */
export const AMBIENCE_CLIPS: readonly AmbienceClip[] = [
  {
    id: 'dust',
    source: 'templates/fx/Floating_Dust_original_433528.mov',
    dir: 'fx/dust',
    frameCount: 360,
    blend: 'screen',
  },
]

/**
 * The plate a scene names, or null for none, an unknown id, or a frozen plan
 * that predates `ambience`. Null is never drawn and T-25 refuses it.
 */
export function ambienceClipById(id: string | undefined | null): AmbienceClip | null {
  if (id === undefined || id === null) return null
  return AMBIENCE_CLIPS.find((clip) => clip.id === id) ?? null
}

/**
 * WHICH FRAME OF THE PLATE A SHOT DRAWS AT ITS OWN FRAME `frame`, OR NULL.
 *
 * ##########################################################################
 * # MODULO, WHICH IS THE WHOLE DIFFERENCE FROM THE BURN.                   #
 * #                                                                        #
 * # `overlayClipFrame` anchors both of its branches to a CUT and returns   #
 * # null once the clip runs out, because a burn that outlived its own      #
 * # frames would freeze on its last one. A plate has no cut to anchor to   #
 * # and must never run out, so it wraps. Phase 0 at the shot's own frame   #
 * # 0, on every shot, so a segment renders identically in isolation and in #
 * # any order — the rule every other layer in the compositor lives under.  #
 * ##########################################################################
 */
export function ambienceClipFrameIndex(clip: AmbienceClip, frame: number): number | null {
  if (!Number.isInteger(frame) || frame < 0) return null
  return frame % clip.frameCount
}

/** The public-relative path of one plate frame, `fx/dust/100.jpg`. */
export function ambienceClipFramePath(clip: AmbienceClip, index: number): string {
  return `${clip.dir}/${String(index).padStart(3, '0')}.jpg`
}
