import { useCurrentFrame } from 'remotion'
import type { ReactNode } from 'react'
import type { Grade as GradeSettings } from '@vg/core/schemas'
import { GRADE } from './constants.js'

/**
 * The grade: one constant tonal curve, grain, and a vignette. Nothing else.
 *
 * ####################################################################
 * # NO PER-FRAME CSS FILTER VALUE ANYWHERE IN THIS COMPOSITION.       #
 * #                                                                   #
 * # A filter whose VALUE changes every frame forces Chrome to         #
 * # re-rasterise the layer 18,000 times over a ten-minute film. On    #
 * # the two cores this renders on, that is not a subtle cost — it is  #
 * # tens of minutes. So every filter in this file is a CONSTANT: the  #
 * # same string on every frame of every segment of every job. The     #
 * # only per-frame change left is `background-position` on the grain, #
 * # which the compositor handles without a repaint.                   #
 * #                                                                   #
 * # THE COLOUR IS NOT NORMALISED ANYWHERE ELSE — this block used to   #
 * # say otherwise and was simply wrong. It claimed normalisation      #
 * # happened "once per asset, in the worker, at ingest". There is no  #
 * # such step. `prepareRenderImage`                                   #
 * # (apps/worker/src/media/image.ts:71) is `.rotate().resize()        #
 * # .jpeg()` and nothing more, and it runs in the SOURCE stage        #
 * # (source.ts:1074), not at ingest. Whatever a provider served is    #
 * # what the compositor opens, cast and all. This file is the only    #
 * # place tone is touched at all, which is exactly why a comment      #
 * # pointing somewhere else was worse than no comment.                #
 * ####################################################################
 */

/**
 * The grain tile is an SVG `feTurbulence` encoded as a data URI.
 *
 * The filter is evaluated once when the browser decodes the image, not per
 * frame — which is the whole point. Shipping a PNG would work identically and
 * would put a binary in the repo for no benefit.
 */
function grainTileUri(size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" stitchTiles="stitch" result="n"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const GRAIN_URI = grainTileUri(GRADE.grainTileSize)

/**
 * Four offsets on a three-frame hold.
 *
 * Grain that never moves reads as dirt on the lens; grain that changes every
 * frame reads as video noise and eats bitrate. Three frames at 30fps is the
 * shutter cadence of film shot on a slow stock, which is the reference.
 */
const OFFSETS: readonly [number, number][] = [
  [0, 0],
  [37, 19],
  [11, 43],
  [29, 7],
]

/**
 * ONE HOUSE CURVE, IDENTICAL ON EVERY FRAME AND EVERY ASSET.
 *
 * ####################################################################
 * # WHY THIS IS NOT PER-ASSET WHITE BALANCE. Three independent        #
 * # reasons, any one of which is fatal on its own.                    #
 * #                                                                   #
 * # 1. `asset.vision` is nullable and is null on every degraded scene #
 * #    (source.ts:1144), so the coefficients would be absent exactly  #
 * #    where the picture is worst.                                    #
 * # 2. `PrevAssetSchema` carries no vision at all. The outgoing layer #
 * #    of a crossfade is the SAME photograph as the previous          #
 * #    segment's incoming layer, so it would be graded one way there  #
 * #    and another way here: the picture would shift colour for the   #
 * #    8-16 frames of the dissolve and shift back.                    #
 * # 3. `computeRenderKey` (renderKey.ts:78-93) does not hash vision,  #
 * #    so the segment cache would serve pixels graded under a reading #
 * #    that has since changed, with no way to notice.                 #
 * #                                                                   #
 * # It is also NOT keyed off `grade.lut`. LUT_NAMES has exactly one   #
 * # member (schemas.ts:38), so a switch on it is a switch with one    #
 * # arm.                                                              #
 * #                                                                   #
 * # A constant has none of those problems, because it is the same     #
 * # number in every one of those places by construction.              #
 * ####################################################################
 *
 * WHY `backdrop-filter` AND NOT `filter`, which is the uncomfortable part.
 *
 * `Scene` composites `<Grade>` as a SIBLING above the picture (Scene.tsx:59),
 * not as a wrapper around it. A `filter` on an element this file owns would
 * therefore grade the grain tile and the vignette and leave the photograph
 * exactly as the provider served it — that is, do nothing. From an overlay,
 * `backdrop-filter` is the only property that reaches the pixels underneath.
 *
 * The cost, stated rather than waved away. A constant `filter` on the picture
 * ELEMENT is rasterised once and thereafter only re-transformed, which is what
 * makes `TEXT_CARD.background.filter` free. `backdrop-filter` cannot be, because
 * its backdrop is a Ken Burns move and is different every frame — so this is one
 * full-frame colour-matrix pass per frame, order 10ms of software raster at
 * 1920x1080, against a render that already costs ~1879ms/frame. Half a percent,
 * and the same order as the full-frame `mixBlendMode: 'overlay'` grain layer
 * that has always been here. The cheaper shape is this exact string on the
 * `<Img>` in Scene.tsx and ArchivePlate.tsx; those are not this file.
 *
 * ONE new element, not two. The toe lift is the `backgroundColor` of the SAME
 * div, painted over the filtered backdrop, so the whole tonal treatment costs a
 * single additional composited layer rather than a fifth and a sixth.
 *
 * Returned as DATA so the claim that actually matters — that it is CONSTANT — is
 * checkable in node. A mounted DOM can show you the string once; only calling
 * this with no inputs at all shows you there is nothing for a frame, a scene or
 * an asset to vary.
 */
export function houseCurveLayerStyle(): { backdropFilter: string; backgroundColor: string } {
  return { backdropFilter: GRADE.toneFilter, backgroundColor: GRADE.toeColor }
}

export function Grade({ grade }: { grade: GradeSettings }): ReactNode {
  const frame = useCurrentFrame()

  const step = Math.floor(frame / GRADE.grainHoldFrames) % GRADE.grainOffsets
  const offset = OFFSETS[step] ?? OFFSETS[0]
  const [offsetX, offsetY] = offset ?? [0, 0]

  const vignetteAlpha = Math.min(
    GRADE.vignetteMaxAlpha,
    grade.vignette * GRADE.vignetteAlphaPerUnit,
  )

  return (
    <>
      {/*
        FIRST, so grain and vignette composite on top of the graded picture.
        Order is a claim about what belongs to what: the curve is applied to the
        PHOTOGRAPH, while grain and corner falloff belong to the film the
        photograph is printed into. Put this last and the curve would also be
        crushing the grain and the vignette, which are already exactly the values
        they are meant to be.

        Unconditional, unlike the two below. `grade.grain` and `grade.vignette`
        are per-scene strengths; the house curve is not a strength, it is the
        house.
      */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...houseCurveLayerStyle(),
          pointerEvents: 'none',
        }}
      />

      {grade.grain > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${GRAIN_URI}")`,
            backgroundRepeat: 'repeat',
            backgroundPosition: `${offsetX}px ${offsetY}px`,
            mixBlendMode: 'overlay',
            opacity: grade.grain,
            pointerEvents: 'none',
          }}
        />
      )}

      {vignetteAlpha > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${GRADE.vignetteInnerStop * 100}%, rgba(0,0,0,${vignetteAlpha}) 100%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  )
}
