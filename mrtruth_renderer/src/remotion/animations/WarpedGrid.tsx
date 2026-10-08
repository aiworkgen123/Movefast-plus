import type { ReactNode } from 'react'
import { FRAME_HEIGHT, FRAME_WIDTH } from '../constants.js'
import {
  GRID_VIGNETTE,
  gridVignetteAlphaAtRadiusFor,
  warpedGridPaths,
} from './warpedGridGeometry.js'
import type { GridVignetteLaw } from './warpedGridGeometry.js'

/**
 * The warped grid, drawn.
 *
 * ####################################################################
 * # ONE COMPONENT, BECAUSE FOUR OF THE CLIENT'S NINE REFERENCES SIT   #
 * # ON THIS GRID — a3, a4, a8 AND a9.                                 #
 * #                                                                   #
 * # It lived inside `PhotoPop.tsx` while a9 was the only animation    #
 * # that needed it. It moved here the moment a4 arrived, rather than  #
 * # being copied, because a copy is how the four drift apart and a    #
 * # drift here is a drift in four deliverables.                       #
 * #                                                                   #
 * # The geometry lives in `warpedGridGeometry.ts`, which is pure and testable #
 * # in the `.test.ts` lane. This file is the thin drawing half.       #
 * ####################################################################
 *
 * TWO PROPS AND NO MORE. `scale` because a9's grid grows and a4's does not, and
 * `blurStdDeviation` because the two animations draw the same artwork at two
 * different softnesses. Everything else is baked into the path data and must
 * never be recomputed at runtime.
 *
 * ####################################################################
 * # `blurStdDeviation` IS REQUIRED, AND IT USED TO DEFAULT.          #
 * #                                                                   #
 * # It defaulted to `GRID_PAINT.blurStdDeviation`, which is 2.32 —    #
 * # a9's value, because a9 is the animation the artwork was traced    #
 * # from. So a new caller that forgot the prop got a9's softness with #
 * # nothing failing: every test green, the typecheck clean, and every #
 * # line drawn at 58 peak luma where the reference draws 96, across   #
 * # the whole frame for every frame.                                  #
 * #                                                                   #
 * # Adding the animation's entry to `GRID_BLUR` does NOT close that.  #
 * # `GRID_BLUR` is `as const`, so a missing key is a hard TS2339 and  #
 * # was never the silent path. The silent path was the DEFAULT, and   #
 * # the fix is to make the caller say which softness it wants.        #
 * ####################################################################
 */
export function WarpedGrid({
  scale,
  blurStdDeviation,
  strokeWidth,
  strokeOpacity,
  vignette,
  vignetteScalesWithGrid = false,
  idPrefix,
}: {
  scale: number
  /**
   * REQUIRED. See the box above — a default here silently gave every new
   * animation a9's softness. Take it, and the two below, from one row of
   * `GRID_ANIMATION_PAINT`, which holds a measured set per animation.
   */
  blurStdDeviation: number
  /** REQUIRED. a3 needs 3.357 where a4 and a9 need 2.75. */
  strokeWidth: number
  /** REQUIRED. a3 needs 0.2423 where a4 and a9 need 0.504. */
  strokeOpacity: number
  /**
   * The corner falloff, REQUIRED, and for the same reason the three above are.
   *
   * ####################################################################
   * # THIS USED TO BE `GRID_VIGNETTE` HARD-WIRED INSIDE THIS FILE, AND #
   * # THAT IS THE SAME SILENT DEFAULT AS THE BLUR ONE, ONE LAYER DOWN. #
   * #                                                                   #
   * # The shared curve was traced off a9 and fitted against a4, and it #
   * # holds alpha at 1.000 out to r = 0.68. a8 is already at 0.87 by   #
   * # r = 0.60, so a8 drawn through the shared curve is 34% to 46% too #
   * # bright at r = 0.708 and about 50% too bright at r = 0.799 — a    #
   * # large bright ring across most of the frame, on the animation     #
   * # where the grid is the ONLY thing on screen for sixty frames.     #
   * #                                                                   #
   * # Take it from `GRID_ANIMATION_VIGNETTE`, whose rows are keyed the #
   * # same way `GRID_ANIMATION_PAINT`'s are, and take BOTH rows for    #
   * # the same animation. That file explains at length why mixing one  #
   * # animation's paint with another's vignette produces a whole-frame #
   * # error metric that gets BETTER as the build gets more wrong.      #
   * ####################################################################
   */
  vignette: GridVignetteLaw
  /**
   * Whether the corner vignette rides inside the zoom.
   *
   * DEFAULTS TO FALSE, which is what a4 and a9 want and what the comment in
   * the body explains: a screen-fixed vignette cannot swim as the grid grows.
   *
   * a3 measures the other way, and the evidence is 2.25x in fit rms — its
   * darkening is fixed to the GRID rather than to the screen (grid-space fit
   * 1.885 against screen-space 4.234). Turning this on for a4 or a9 makes
   * their corners breathe, which is exactly what that comment warns about.
   */
  vignetteScalesWithGrid?: boolean
  /**
   * Namespaces the SVG `id`s.
   *
   * REQUIRED, and not cosmetic. SVG ids are global to the document, so two
   * grids on one frame — or a grid beside any other filtered SVG — would have
   * the second definition silently win for both. Nothing renders red; the wrong
   * blur is simply applied.
   */
  idPrefix: string
}): ReactNode {
  const paths = warpedGridPaths()
  const filterId = `${idPrefix}-grid-soften`
  const maskId = `${idPrefix}-grid-vignette`
  const gradientId = `${idPrefix}-grid-falloff`

  /*
   * The vignette as gradient stops, sampled from the same function the test
   * pins, so the mask and the alpha law cannot drift apart.
   *
   * THE OFFSETS COME FROM THE LAW, not from a list here. a super-Gaussian and a
   * smoothstep put their knees in different places, and the shared list's
   * 0.08-wide step across 0.60 to 0.68 straddles a8's. The shared offsets are
   * frozen because a4's and a9's clips are already with the client.
   */
  const stops = vignette.stops.map((offset) => ({
    offset,
    alpha: gridVignetteAlphaAtRadiusFor(vignette, offset),
  }))

  return (
    <svg
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
      style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}
    >
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={blurStdDeviation} />
        </filter>
        <radialGradient
          id={gradientId}
          cx={GRID_VIGNETTE.centre.x}
          cy={GRID_VIGNETTE.centre.y}
          r={GRID_VIGNETTE.radius.x}
          gradientUnits="userSpaceOnUse"
          gradientTransform={`translate(0 ${GRID_VIGNETTE.centre.y}) scale(1 ${
            GRID_VIGNETTE.radius.y / GRID_VIGNETTE.radius.x
          }) translate(0 ${-GRID_VIGNETTE.centre.y})`}
        >
          {stops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              stopColor="#ffffff"
              stopOpacity={stop.alpha}
            />
          ))}
        </radialGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect
            x={0}
            y={0}
            width={FRAME_WIDTH}
            height={FRAME_HEIGHT}
            fill={`url(#${gradientId})`}
          />
        </mask>
      </defs>

      {(() => {
        /*
          THE VIGNETTE'S FRAME OF REFERENCE IS PER ANIMATION.

          Outside the scaled group it is fixed in SCREEN space, which is what
          a4 and a9 measure: scaling it with the grid swims the darkening
          around as the grid grows, and that reads as the corners breathing.

          a3 measures the opposite way. Its darkening is fixed to the GRID, so
          for a3 the mask goes INSIDE the transform. Same component, one
          switch, rather than a second copy of the artwork.
        */
        const grid = (
          <g opacity={strokeOpacity} filter={`url(#${filterId})`}>
            {/*
              `opacity` ON THE GROUP AND ONE PATH FOR ALL THIRTY LINES.

              Found by rendering and measuring, not by review. `stroke-opacity`
              is inherited and applied per stroke, so two half-transparent
              lines composite where they cross: the reference's crossings peak
              at 91 of 255 and the first build measured 109. Flattening the
              group first, then fading it once, took that to 94.

              A `filter` runs BEFORE `opacity`, so this blurs the union and
              then fades it, which is what the reference's 91 says its author
              did.
            */}
            <path
              d={[...paths.vertical, ...paths.horizontal].join(' ')}
              fill="none"
              stroke="#ffffff"
              strokeWidth={strokeWidth}
            />
          </g>
        )

        const zoom = `translate(${FRAME_WIDTH / 2} ${FRAME_HEIGHT / 2}) scale(${scale}) translate(${-FRAME_WIDTH / 2} ${-FRAME_HEIGHT / 2})`

        return vignetteScalesWithGrid ? (
          <g transform={zoom}>
            <g mask={`url(#${maskId})`}>{grid}</g>
          </g>
        ) : (
          <g mask={`url(#${maskId})`}>
            <g transform={zoom}>{grid}</g>
          </g>
        )
      })()}
    </svg>
  )
}
