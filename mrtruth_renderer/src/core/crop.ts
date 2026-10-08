import { FRAME_HEIGHT, FRAME_WIDTH } from './schemas.js'
import type { AssetVision, Crop, CropMode } from './schemas.js'

/**
 * Aspect strategy: how a source image of any shape is presented in a 16:9 frame.
 *
 * THE RULE THIS FILE USED TO OPEN WITH IS GONE, AND THE CLIENT RETIRED IT.
 * It read "a portrait still gets an ARCHIVE PLATE, never a blurred pillarbox",
 * on the argument that blurred bars behind a vertical photo is the single most
 * recognisable "YouTube automation" tell there is, and that a designed card is
 * what a documentary editor actually does with an archival object. That argument
 * is still true about EDITORIAL REGISTER, and it was still the wrong call for
 * this film. Measured on the delivered cut, job 06dec888, 91 scenes: 67 filled,
 * 10 took `archivePlate`, 14 had no image. The client watched one of the ten at
 * 0:02:23 — a manuscript page held on a plate that measures 594x842 inside
 * 1920x1080, so 24.1% of the frame carries picture and 75.9% is ground, with
 * 663px of near-black down each side — and said the format is wrong and images
 * should fill the screen. A defect the person paying for the film can name in
 * one frame outranks a tell only the people who build these pipelines can.
 *
 * SO THE FRAME IS ALWAYS FULL NOW, and the only question left is what fills it:
 *
 *   at or above square     `fill` — the picture itself covers every pixel
 *   below square, still    `blurPillarbox` — picture whole and sharp, on a
 *                          blurred copy of itself, because a 0.71 page can
 *                          cover at most 39.7% of a 16:9 frame uncropped.
 *                          UNREACHABLE FOR A NEW PLAN SINCE RULING R1
 *                          (2026-09-11): the source stage refuses every still
 *                          below square. Kept so frozen plans re-render
 *                          identically, and so plan-check T-21 can name it.
 *   below square, video    `archivePlate`, down to PHONE_ASPECT; see `media`
 *
 * WHY NOT `fill` ALL THE WAY DOWN, which is what "fill the screen" sounds like
 * it is asking for. Rendered and edge-measured on a 960x1360 page (aspect
 * 0.706), BOTH AT THE OPENING FRAME OF A PUSH, where the Ken Burns scale is
 * exactly 1.0 and neither crop is being flattered by it — quote a pose or the
 * two numbers are not comparable. `fill` covers the frame at
 * `max(1920/960, 1080/1360)` = 2.00x, drawing the page 1920x2720 so that 1080 of
 * those 2720 rows are on screen: 100% of the width kept, 39.7% of the HEIGHT
 * kept and 60.3% of the page thrown away, taking the border, the initial, the
 * miniature, the head and the foot with it at half the sharpness. It stops
 * reading as a page at all. `blurPillarbox` draws the same page at the frame's
 * own height, 762x1080, so 0.794x — never an upscale — and keeps 100% of the
 * picture, on 39.7% of the FRAME. The two 39.7%s are the same ratio read on
 * opposite axes, which is the whole trade in one number: `fill` spends it on the
 * picture and the blur spends it on the frame. A full frame is the requirement;
 * destroying the picture on the way to one is not.
 *
 * `archivePlate` IS NOW UNREACHABLE FOR STILLS, and is deliberately still wired
 * up, still tested and still reachable for VIDEO between PHONE_ASPECT and
 * square. The component is not wrong, it is out of favour, and it is one
 * threshold away from coming back.
 */

/** Wider than this is a panorama; filling it would throw away most of the picture. */
export const PANORAMA_ASPECT = 2.5
/** Comfortably landscape: crop to fill and anchor on the subject. */
export const LANDSCAPE_ASPECT = 1.5
/**
 * At or above this, `fill` covers the frame with picture and costs height only.
 *
 * IT IS SQUARE, AND SQUARE IS WHERE THE RESOLUTION FLOOR CHANGES SIDES — not
 * where the pictures happen to start looking better. `isAssetResolutionAcceptable`
 * admits `max(w, h) >= 1280 && min(w, h) >= 720`. At aspect >= 1 the WIDTH is the
 * long edge, so `w >= 1280` and `h >= 720`, and covering 1920x1080 costs
 * `max(1920/w, 1080/h)` — both terms of which are at most 1.5. Below square the
 * width is the SHORT edge and the same cover costs up to 1920/720 = 2.67x. So
 * every shape this newly admits to `fill` was already reachable at 1.5x, and
 * moving the threshold down from 1.2 costs the proof below exactly nothing.
 *
 * WHAT MOVING IT BUYS. At 1.2 a SQUARE scan was plated too, and the client's
 * complaint was never about squares: a square fills keeping 100% of its width
 * and `1080 * aspect / 1920` = 56.3% of its height, against 67.5% at 1.2. That
 * is a crop, not a gutting. A square was only ever plated by a threshold set for
 * the shape of a manuscript page, and a square is not that shape.
 */
export const FILLABLE_ASPECT = 1.0
/**
 * Taller than 3:5 is the shape of modern phone VIDEO, which an archive plate
 * would misrepresent — a plate says "this is an object from an archive", and a
 * clip shot on a handset last year is not one. It now separates the two crops a
 * sub-square VIDEO can take; a still no longer consults it at all, because every
 * sub-square still takes the same crop however narrow it is. See `media`.
 */
export const PHONE_ASPECT = 0.6

/**
 * THE RESOLUTION FLOOR, MEASURED ON THE EDGES AND NOT ON THE AXES.
 *
 * It used to be `width >= 1280 && height >= 720`, which reads as "at least 720p"
 * and actually means "at least 1280 across the HORIZONTAL axis". On a portrait
 * scan the horizontal axis is the SHORT edge, so the rule refused an image for
 * being tall.
 *
 * That is not a hypothetical. Live probe of this job's own scene queries,
 * 2026-08-04: the literal query for scene 0 returns nine hits, every one an
 * `application/pdf` manuscript page, and MediaWiki serves 960x1356, 960x1451 and
 * 960x1491 renditions for three of them. All three were refused. On a
 * documentary about manuscripts the corpus IS portrait page scans, so the gate
 * was throwing away exactly the material the product exists to find.
 */
export const MIN_ASSET_LONG_EDGE = 1280
export const MIN_ASSET_SHORT_EDGE = 720

/**
 * THE PER-AXIS FLOOR, KEPT ONLY FOR THE TWO GATES THAT STILL READ IT DIRECTLY,
 * AND DELIBERATELY LOWERED TO THE SHORT EDGE.
 *
 * `validateImage.ts` re-checks the DECODED bytes with `width < MIN_ASSET_WIDTH ||
 * height < MIN_ASSET_HEIGHT`. It does not call the predicate below, so if these
 * two kept their old 1280/720 the post-download gate would refuse the very
 * renditions the source gate now admits — after a full `safeFetch`, a slot in the
 * download limiter and a token from `upload.wikimedia.org`'s 10-per-minute
 * budget. That converts a free refusal into an expensive one, which is strictly
 * worse than not having changed the rule at all.
 *
 * So both are now `MIN_ASSET_SHORT_EDGE`, which makes that gate the axis-agnostic
 * HALF of the rule below (`min(w, h) >= 720`) rather than a contradiction of it.
 * Nothing the long-edge predicate admits can fail it, and nothing it admits can
 * skip the predicate, because the predicate runs first at every provider and
 * again in `source.ts` before a byte moves.
 *
 * THE OTHER READER OF THESE TWO HAS ALREADY MOVED. `harness/assertions.ts` used
 * `MIN_ASSET_WIDTH` as a LONG-edge floor (`Math.max(w, h) < MIN_ASSET_WIDTH`),
 * which was only ever right by coincidence — both constants were 1280. It now
 * imports `MIN_ASSET_LONG_EDGE` and says so, so lowering these cannot weaken it.
 *
 * ONE FOLLOW-UP THIS FILE CANNOT MAKE, and it is one line: `validateImage.ts`
 * should take the long/short-edge form itself rather than importing a per-axis
 * pair, at which point these two have no callers left and can go.
 */
export const MIN_ASSET_WIDTH = MIN_ASSET_SHORT_EDGE
export const MIN_ASSET_HEIGHT = MIN_ASSET_SHORT_EDGE

export type SourceDimensions = { width: number; height: number }

/**
 * Which of the two readings applies. Defaulted to `'still'` at every entry point
 * because V1 sources no video at all, so an omitted argument must land on the
 * reading the film actually ships — the one that fills the frame, rather than the
 * one that still holds a sub-square picture on a card.
 */
export type MediaKind = 'still' | 'video'

/**
 * Enough pixels to survive a 1920x1080 frame and a Ken Burns push, WHICHEVER WAY
 * UP the image is.
 *
 * WHAT THIS NOW ADMITS THAT IT DID NOT, EXACTLY. A hit is newly admitted iff
 * `!(w >= 1280 && h >= 720)` and `max >= 1280 && min >= 720`. If `w >= 1280` then
 * `min` is `h`, and an `h < 720` fails the new rule too — so no landscape image
 * is admitted that was not admitted before. Therefore `w < 1280`, and the new
 * rule still needs `max >= 1280`, so `h >= 1280 > w`. Every newly admitted asset
 * is `720 <= w < 1280 <= h`: strictly portrait, aspect below 1. Nothing soft
 * gets in by luck; it gets in by construction or not at all.
 *
 * THE WORST CASE IT PERMITS IS 720x1280, and it is essentially 1:1 at 1080p.
 * This proof MOVED when the crop did, and it MOVED AGAIN when the move set grew;
 * it was not dropped. Aspect 0.5625 is under FILLABLE_ASPECT, so
 * `chooseCropMode` returns `'blurPillarbox'` for every one of these, all the way
 * down — `'fill'`, the only mode that can upscale, stays unreachable below
 * square. The blur branch draws the SHARP copy at `height: 100%` of the frame
 * with `width: auto` (Scene.tsx:264), so 1080 CSS px, and the largest scale it
 * ever holds is `MOVE_PEAK_CEILING` = 1.20 on a pull:
 * `maxTravelForCrop('blurPillarbox')` is the same 6% cap the plate took, and
 * `reduceMotion` shrinks a move toward its START, so a pull's `fromScale` — the
 * peak — is exactly what survives it. Peak displayed height is 1080 x 1.20 =
 * 1296 px, drawn from 1280 source px: 1.0125x at the worst frame of the worst
 * admissible image.
 *
 * ############################################################################
 * # THAT CROSSED 1:1, AND IT IS RECORDED HERE RATHER THAN ROUNDED AWAY.       #
 * #                                                                          #
 * # The peak was 1.12 while there was one zoom magnitude per shot scale, and  #
 * # 1080 x 1.12 = 1210 px from 1280 was 1.06x OVERSAMPLED. The motion rewrite #
 * # raised the wide peak to 1.20 to buy pan slack, which spends that 6% of    #
 * # headroom and 1.25% more. 1.0125x is a resample, not a visible upscale —   #
 * # under a Gaussian-blurred gutter, on the single worst shape the sourcing   #
 * # rule admits at all. The corpus MEDIAN is 1880px wide, nowhere near this   #
 * # corner. If a pillarboxed page ever reads soft, this is the sentence to    #
 * # come back to: the fix is a lower peak, not a different crop.              #
 * ############################################################################
 *
 * AND 1.0125x IS THE BOUND FOR THE WHOLE CLASS, not just for the corner. Below
 * square the HEIGHT is the long edge, so every sub-square image this admits has
 * `h >= 1280` and is drawn into the same 1296 px. There is no sub-square shape
 * that gets in and lands softer. The plate this replaced drew 842 CSS px
 * (`ARCHIVE_PLATE.height`, ArchivePlate.tsx:85) x 1.12 = 943 px from that same
 * 1280 and was 1.36x oversampled — so the picture is now 37% larger on screen
 * and has only just crossed 1:1.
 *
 * WHAT `'fill'` CAN REACH NOW THAT ITS THRESHOLD IS SQUARE AND NOT 1.2. Aspect
 * >= 1 means the width is the long edge, so `w >= 1280` and `h >= 720`, and a
 * cover of 1920x1080 is `max(1920/w, 1080/h)` <= 1.5. `maxTravelForCrop('fill')`
 * is Infinity, so that peaks at 1.5 x `MOVE_PEAK_CEILING` = 1.5 x 1.20 = 1.80x.
 * That corner is not new in kind: a 1280x720 landscape is aspect 1.778, has
 * always taken `'fill'`, and spanned 2150 CSS px from 1280 source px at the old
 * 1.12 peak — a 1.68x UPSCALE the OLD rule shipped without complaint. The
 * motion rewrite takes that same shape to 1.80x, 7% further. Lowering the crop
 * threshold still admits no shape to `fill` that is worse than the shape `fill`
 * already had; the peak did that, not the threshold.
 *
 * The real recoveries are nowhere near the worst case. Probed directly on the two
 * literal scene queries, six renditions come back that this unblocks and the old
 * rule refused — 960 x 1356, 1385, 1451, 1490, 1491 and 1681. All six are
 * portrait and take the pillarbox, so the paragraph above governs them, not this
 * one. Nothing anywhere near 720x1280 was observed; that bound is the arithmetic
 * limit, not a shape the corpus actually contains.
 */
export function isAssetResolutionAcceptable(source: SourceDimensions): boolean {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) return false
  return (
    Math.max(source.width, source.height) >= MIN_ASSET_LONG_EDGE &&
    Math.min(source.width, source.height) >= MIN_ASSET_SHORT_EDGE
  )
}

/**
 * HOW MANY SOURCE PIXELS THE COMPOSITOR STRETCHES INTO ONE FRAME PIXEL, at rest.
 *
 * ##########################################################################
 * # THE SECOND HALF OF `chooseCropMode`, WHICH EXISTED ONLY AS PROSE.      #
 * #                                                                        #
 * # `chooseCropMode` picks the mode and `Scene.tsx` sizes the element:      #
 * #                                                                        #
 * #   fill           objectFit cover    max(1920/w, 1080/h)                 #
 * #   letterbox      objectFit contain  min(1920/w, 1080/h)                 #
 * #   blurPillarbox  height 100%        1080/h   <- THE WIDTH IS NOT READ   #
 * #                                                                        #
 * # IT IS NOT A FUNCTION OF THE EDGES, and that is the whole reason this    #
 * # exists. A 1280x853 photograph and a 794x853 CROP of it share a short    #
 * # edge, and are drawn at 1.5000x and 1.2661x, because the crop moved the  #
 * # aspect under FILLABLE_ASPECT and therefore changed the MODE. Any rule   #
 * # that judges a crop by its edges is asking a question the compositor     #
 * # never asks.                                                             #
 * #                                                                        #
 * # STILLS ONLY, said rather than assumed: `archivePlate` sizes against a   #
 * # height that lives in apps/web, which core cannot import, and no still   #
 * # has reached it since the client retired that treatment.                 #
 * ##########################################################################
 */
export function renderScale(source: SourceDimensions): number {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) {
    return Number.POSITIVE_INFINITY
  }
  if (source.width <= 0 || source.height <= 0) return Number.POSITIVE_INFINITY
  const mode = chooseCropMode(source.width / source.height, 'still')
  if (mode === 'fill') {
    return Math.max(FRAME_WIDTH / source.width, FRAME_HEIGHT / source.height)
  }
  if (mode === 'letterbox') {
    return Math.min(FRAME_WIDTH / source.width, FRAME_HEIGHT / source.height)
  }
  return FRAME_HEIGHT / source.height
}

/**
 * HOW MUCH OF THE FRAME'S WIDTH THE PICTURE ITSELF COVERS, 0..1.
 *
 * 1 for `fill`, which covers the frame by definition. For `blurPillarbox` the
 * picture is fitted to the frame's HEIGHT, so what it spans across is its own
 * aspect scaled by the frame's, and the rest is the blurred ground.
 */
export function frameShare(source: SourceDimensions): number {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) return 0
  if (source.width <= 0 || source.height <= 0) return 0
  const aspect = source.width / source.height
  const mode = chooseCropMode(aspect, 'still')
  if (mode === 'fill') return 1
  if (mode === 'letterbox') return 1
  return Math.min(1, (aspect * FRAME_HEIGHT) / FRAME_WIDTH)
}

/**
 * THE SOFTEST FRAME THE SOURCING FLOOR ALREADY SHIPS, and therefore the most a
 * downstream rule may ever take a picture to.
 *
 * DERIVED, NEVER CHOSEN. `isAssetResolutionAcceptable` admits 1280x720, which
 * is 16:9, therefore `fill`, therefore max(1920/1280, 1080/720) — both terms
 * being exactly 1.5. So a picture drawn at 1.5x is one this pipeline already
 * considers acceptable, and anything softer than that is new harm.
 *
 * MUTATING IT IS DIRECTIONAL, which the test says out loud. RAISING either
 * floor leaves the Math.max at 1.5 because the two terms are equal; only
 * LOWERING one moves this number.
 */
export const MAX_RENDER_SCALE = Math.max(
  FRAME_WIDTH / MIN_ASSET_LONG_EDGE,
  FRAME_HEIGHT / MIN_ASSET_SHORT_EDGE,
)

/**
 * THE NARROWEST THE PICTURE MAY BE LEFT BY A CROP.
 *
 * ##########################################################################
 * # ANCHORED ON WHAT THIS FILE ALREADY DRAWS, not on a number picked to     #
 * # make one photograph pass. `chooseCropMode`'s own note says "the most a  #
 * # 0.71 page can span uncropped is 39.7% of a 16:9 frame", and the         #
 * # pipeline draws those pages every day, so 39.7% is a shape the client    #
 * # has already accepted.                                                    #
 * #                                                                        #
 * # A CROP MAY NOT GO BELOW IT. Trimming a caption off an already-portrait  #
 * # page can leave it spanning under a quarter of the frame, which is the   #
 * # narrow strip of the retired archive plate — a treatment the client      #
 * # rejected by name. Removing printed text is not worth reintroducing it.  #
 * #                                                                        #
 * # IT DOES NOT COST THE FRAME THIS WORK EXISTS FOR: the Dead Sea Scroll,   #
 * # trimmed to 794x853, spans 52.4%, wider than the pages already shipping. #
 * ##########################################################################
 */
export const MIN_CROP_FRAME_SHARE = frameShare({ width: 71, height: 100 })

export function chooseCropMode(aspect: number, media: MediaKind = 'still'): CropMode {
  if (!Number.isFinite(aspect) || aspect <= 0) return 'fill'
  if (aspect > PANORAMA_ASPECT) return 'letterbox'
  if (aspect >= FILLABLE_ASPECT) return 'fill'
  // Taller than wide, so no crop mode can cover the frame with the picture: the
  // most a 0.71 page can span uncropped is 39.7% of a 16:9 frame. Only VIDEO
  // still gets a card here, and only down to the phone shape, because a squarish
  // clip has an archival reading and a handset clip does not. A STILL takes the
  // blur at every aspect below square — it is the only crop that leaves no dead
  // ground while never upscaling the sharp copy, which is the pair of properties
  // the client's complaint and the resolution floor ask for at the same time.
  if (media === 'video' && aspect >= PHONE_ASPECT) return 'archivePlate'
  return 'blurPillarbox'
}

/**
 * IS THIS SHAPE WIDE ENOUGH TO CARRY THE FRAME? The same threshold
 * `chooseCropMode` reads on the line above, as a predicate, so that SOURCING can
 * prefer a shape the renderer will cover the frame with — without re-declaring
 * the number anywhere else.
 *
 * ONE THRESHOLD, AND IT HAS TO STAY ONE. True here means `chooseCropMode` returns
 * `'fill'` or `'letterbox'` and the picture spans the frame; false means it
 * returns `'blurPillarbox'` and part of the frame is a blurred copy of the
 * picture rather than the picture. Give this predicate a stricter number than the
 * crop and it starts ranking a shape that fills perfectly level with one that
 * gutters — a 1.1 scan indistinguishable from an 0.56 scan — which is the exact
 * blindness it was added to remove.
 *
 * WHY IT EXISTS. Measured on the delivered film, job 06dec888, 91 scenes: 67
 * scenes took `fill`, 10 took `archivePlate`. The client watched one of those ten
 * at 0:02:23 — a tall manuscript scan held small in the middle of a near-black
 * frame, dead margins either side — and said images should fill the screen. The
 * renderer's answer to that is the file header: sub-square stills no longer plate
 * at all. This is the OTHER half, and it is the half that is actually free.
 * Nothing upstream ever PREFERRED a picture that would fill the frame with itself,
 * so tall images reached the film purely by chance, and a tall image is still the
 * one shape no crop mode can cover the frame with.
 *
 * ##########################################################################
 * # A GATE SINCE 2026-09-11, RULING R1, AND IT IS THE ONLY ONE.            #
 * #                                                                        #
 * # "no 9:16 ratio'd images allowed. Resort to AI instead if a 9:16 image  #
 * # gets chosen or suitable 16:9 is not found." (CLIENT-NOTES.md:1296).    #
 * # The developer ruled that "9:16" means every still this function        #
 * # returns false for, device-covered and held beats included, and         #
 * # rejected the reading "keep a portrait only under a device".            #
 * #                                                                        #
 * # The sentence that stood here said this was a preference and never a    #
 * # gate, because a tall image must still beat nothing. He overruled that. #
 * # A beat with no wide picture now goes down the R2 chain in the worker's #
 * # source stage: a wide-shot re-search, then an AI image, and only then a #
 * # reuse of an earlier picture, at most two in the whole film.            #
 * #                                                                        #
 * # READERS, all reading this one function and this one number:           #
 * #   gatherCandidates         the declared size, before the prefilter     #
 * #   materialise              the decoded size, the backstop              #
 * #   trimCaptionBand          a caption cut may not leave a picture tall  #
 * #   storeGeneratedImage      a generated picture                         #
 * #   enforceStillShapeOnResume  stored checkpoints, companions and pools  #
 * #   holdPicture              the held-beat re-frame list (plan stage)    #
 * #   planCheck T-21           through the crop mode, before the render    #
 * # A stricter or looser second number anywhere would let sourcing and    #
 * # the renderer disagree about which pictures get blurred side bands.    #
 * ##########################################################################
 *
 * ABOVE PANORAMA_ASPECT IS DELIBERATELY TRUE. A panorama is letterboxed rather
 * than filled, but its picture still spans the full width of the frame, so it is
 * not the shape the client objected to and there is no reason to rank it below a
 * portrait.
 */
export function isFillableAspect(source: SourceDimensions): boolean {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) return false
  if (source.width <= 0 || source.height <= 0) return false
  return source.width / source.height >= FILLABLE_ASPECT
}

/**
 * WHERE THE PICTURE SITS IN THE GROUND, for the two modes that draw the picture
 * WHOLE and have frame left over. 0 is flush to the near edge, 1 to the far one,
 * 0.5 centred — `objectPosition`'s own reading of a contained picture.
 *
 * ##########################################################################
 * # THE GEOMETRY, BECAUSE IT IS THE OPPOSITE OF `fill`'s AND READING THE   #
 * # TWO THE SAME WAY IS THE BUG THIS REPLACES.                            #
 * #                                                                        #
 * # In `fill` the picture is LARGER than the frame, the anchor names the    #
 * # part of the PICTURE that survives, and the free axis is the one being   #
 * # cropped. In `blurPillarbox` and `letterbox` the picture is SMALLER than #
 * # the frame on one axis, nothing is cropped at all, and the free axis is  #
 * # the one with ground left over — the choice is not what to keep, it is   #
 * # where to put what we are keeping anyway.                               #
 * #                                                                        #
 * #   blurPillarbox   picture at the frame's HEIGHT, bands left and right   #
 * #                   -> ACROSS is free, DOWN is pinned                     #
 * #   letterbox       picture at the frame's WIDTH, bands top and bottom    #
 * #                   -> DOWN is free, ACROSS is pinned                     #
 * #                                                                        #
 * # `share` is how much of the frame that axis the picture covers, so the   #
 * # ground is `1 - share`. Placing the picture at `p` puts its own point    #
 * # `s` at `p * (1 - share) + s * share` of the FRAME. Setting that to 0.5  #
 * # and solving for `p` is the line below: it is the placement that brings  #
 * # the subject to the middle of the frame, not the placement that puts the #
 * # subject's own fraction anywhere.                                        #
 * #                                                                        #
 * # THE CLAMP IS A REAL CASE, NOT DEFENSIVE PADDING. Once `share > 0.5` a   #
 * # subject at the picture's own edge cannot reach the middle at all, and   #
 * # an unclamped `p` would hang the picture off the frame and open a bar of #
 * # bare ground on the far side. Flush is the honest answer there, and      #
 * # `AnchorSchema` bounds the field to 0..1 in any case.                    #
 * ##########################################################################
 */
function placeInGround(subject: number, share: number): number {
  // share >= 1 is the PINNED axis: the picture is exactly the frame there, so
  // there is no ground to place it in and the only answer is the middle.
  if (!Number.isFinite(share) || share >= 1 || share <= 0) return 0.5
  return clamp01((0.5 - clamp01(subject) * share) / (1 - share))
}

/**
 * HOW MUCH OF EACH FRAME AXIS A WHOLE PICTURE COVERS when it is fitted inside
 * rather than cropped to fill. Exactly one of the two is 1 — the axis the fit is
 * binding on — and the other is the shorter side, which is where the ground is.
 */
function containShare(aspect: number, targetAspect: number): { x: number; y: number } {
  if (!Number.isFinite(aspect) || aspect <= 0) return { x: 1, y: 1 }
  if (!Number.isFinite(targetAspect) || targetAspect <= 0) return { x: 1, y: 1 }
  if (aspect >= targetAspect) return { x: 1, y: targetAspect / aspect }
  return { x: aspect / targetAspect, y: 1 }
}

/**
 * Pick the crop strategy and the anchor point.
 *
 * ##########################################################################
 * # EVERY MODE THAT HAS A FREE AXIS NOW USES IT, AND THE COMMENT THAT USED  #
 * # TO STAND HERE IS THE DEFECT WRITTEN DOWN.                              #
 * #                                                                        #
 * # It read "the anchor only matters for `fill`", and the code below it     #
 * # returned a hard 0.5/0.5 for everything else. That is true only if       #
 * # "anchor" can mean nothing but "what to crop away". A pillarboxed        #
 * # picture is not cropped, so on that reading it had no anchor and the     #
 * # vision model's answer was thrown away — scene 45 held an Aksum stela    #
 * # for 3.4 seconds with two thirds of the frame a flat blue-grey field and #
 * # the subject in a band off to the right, under the "1983" mark, from a   #
 * # `subjectAnchor.x` of 0.68 the crop never read. See `placeInGround`.     #
 * #                                                                        #
 * # `fill` KEEPS ITS OWN RULE UNCHANGED. Its anchor is a crop, the free     #
 * # axis is whichever one is being cropped, and anchoring both axes on a    #
 * # subject that is only cropped in one produces an off-centre frame for no #
 * # reason.                                                                 #
 * #                                                                        #
 * # `archivePlate` IS THE ONE MODE WITH NO FREE AXIS. It is a designed card #
 * # of a fixed size in the middle of the frame, and `ArchivePlate.tsx` does #
 * # not read `crop.anchor` at all — it takes `vision` and places the        #
 * # picture inside the card itself. Sliding it would move the DESIGN.       #
 * ##########################################################################
 */
export function chooseCrop(
  source: SourceDimensions,
  vision: AssetVision | null,
  target: SourceDimensions = { width: FRAME_WIDTH, height: FRAME_HEIGHT },
  media: MediaKind = 'still',
): Crop {
  const aspect = source.height > 0 ? source.width / source.height : 0
  const targetAspect = target.height > 0 ? target.width / target.height : FRAME_WIDTH / FRAME_HEIGHT
  const mode = chooseCropMode(aspect, media)
  const subject = vision?.subjectAnchor ?? { x: 0.5, y: 0.5 }

  if (mode === 'archivePlate') {
    return { mode, anchor: { x: 0.5, y: 0.5 } }
  }

  if (mode === 'blurPillarbox' || mode === 'letterbox') {
    const share = containShare(aspect, targetAspect)
    return {
      mode,
      anchor: {
        x: placeInGround(subject.x, share.x),
        y: placeInGround(subject.y, share.y),
      },
    }
  }

  const cropsHorizontally = aspect > targetAspect
  return {
    mode,
    anchor: {
      x: cropsHorizontally ? clamp01(subject.x) : 0.5,
      y: cropsHorizontally ? 0.5 : clamp01(subject.y),
    },
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}
