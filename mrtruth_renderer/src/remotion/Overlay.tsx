import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import type { ReactNode } from 'react'
import { overlayTypeFrames, overlayTypeRoom } from '@vg/core/frames'
import type { AssetVision, SceneOverlay } from '@vg/core/schemas'
import {
  easeIn,
  easeOut,
  FONT_FAMILY,
  FRAME_HEIGHT,
  OVERLAY,
  OVERLAY_FULL_FRAME_DIM,
  overlayFullFrameFontSize,
  OVERLAY_NOTE_FONT_SIZE,
  OVERLAY_TITLE_DIM,
  overlayChoreography,
  overlayFitsFullFrame,
  overlayLineBox,
  overlayNoteBox,
  overlayPlacement,
  overlayPlacementEdges,
  overlayStyleTypes,
  overlayTitleSetting,
  overlayWash,
  TEXT_CARD,
  titleScale,
} from './constants.js'
import type {
  FrameWindow,
  OverlayBlockBox,
  OverlayChoreography,
  OverlayPlacement,
} from './constants.js'
import type { OverlayTreatment } from './props.js'

/**
 * The text overlay — a few words set ON TOP of the photograph.
 *
 * ####################################################################
 * # IT IS NOT THE TEXT CARD, AND THE DIFFERENCE IS THE WHOLE FEATURE. #
 * #                                                                   #
 * # `TextCard` is what a scene gets when sourcing found NO picture:   #
 * # full frame, defocused backdrop, the narration set large. It is a  #
 * # fallback and it looks like one on purpose.                        #
 * #                                                                   #
 * # This is an EDITORIAL DEVICE. The scene HAS a photograph, the      #
 * # photograph stays on screen, and a short line names the thing      #
 * # being discussed — a year, a name, a place. Roughly 8-12 times in  #
 * # an 8m46s film, which is what makes it read as punctuation rather  #
 * # than as a subtitle track.                                         #
 * #                                                                   #
 * # THE PLANNER GUARANTEES THE TWO NEVER SHARE A FRAME, and `Scene`   #
 * # asks the same question again before mounting this. Two blocks of  #
 * # type in one frame is fatal — the eye cannot decide which is the   #
 * # subject.                                                          #
 * ####################################################################
 *
 * Four things that are load-bearing:
 *
 * NO NEW VISUAL LANGUAGE. The rule, the gold, the off-white, the measure and the
 * entry clock are all the text card's, taken from `constants.ts` rather than
 * restated. A second set of near-identical tokens would drift, and a viewer
 * would see two devices that were nearly the same instead of one film.
 *
 * IT LEAVES BEFORE THE SHOT DOES. `overlayChoreography` runs 20 frames of entry,
 * 60 of hold and 12 of exit and then this device is off the frame, however long
 * the scene is. See the box above that function for why it cannot borrow the
 * card's clock, which pins its exit to the end of its scene.
 *
 * NO REFLOW AND NO ANIMATED FILTER. Everything animates on `opacity` and
 * `transform` only, and the scrim is a constant gradient string — never a
 * `backdrop-filter`, which would have to re-rasterise as the Ken Burns move
 * slides the picture beneath it. See the cost note at the top of Grade.tsx.
 * The corner's `mask-image` is a constant string for the same reason: it is
 * decided by the placement, which is decided by the plan, so it is rasterised
 * once per segment and never once per frame.
 *
 * ONE LINE, ALWAYS. `OVERLAY_MAX_CHARS` in `@vg/core/schemas` is 26, and this
 * block sets 34 at this size across this measure, so a line that reached here
 * fits on one line with room to spare. There is deliberately no wrap handling
 * and no step down a type scale: an overlay that needed either would be a
 * sentence, and a sentence is the thing the client asked us to stop putting on
 * screen.
 *
 * ####################################################################
 * # AND SINCE 2026-08-18 IT MAY SIT IN A CORNER, WHICH IS A           #
 * # CONDITIONAL RULE AND NOT A NEW HOME FOR EVERY MARK.               #
 * #                                                                   #
 * # His own reference frames put their captions bottom-left and       #
 * # top-right, and he asked for one "in the corner". A corner is only #
 * # right when there IS a corner clear of the subject of the          #
 * # photograph, so `overlayPlacement` in constants.ts chooses one per #
 * # shot from `asset.vision` and hands back the delivered block when  #
 * # none is clear. On the 79 scored scenes of the frozen plan that is #
 * # 44 corners and 35 blocks; every closeup falls back. On the 22     #
 * # marks the v9 film actually carries it is 11 and 11 — the number   #
 * # that matters, because a scene without a mark draws none of this.  #
 * #                                                                   #
 * # THREE CORNERS, NOT FOUR. A `bottomLeft` corner puts the type on   #
 * # the identical pixel as the fallback — same 160 inset, same 936    #
 * # bottom edge, same left alignment — so it spent a shot's placement #
 * # decision and moved nothing anyone could see. It is out of         #
 * # `overlayCorners()` and `overlayPlacementMovesType` is the         #
 * # property that keeps it out. See the box on OVERLAY_CORNER_ORDER.  #
 * #                                                                   #
 * # NOTHING ABOUT THE TYPE CHANGES WITH IT. Same face, same size,     #
 * # same weight, same colour, same clock, same wash alpha. What moves #
 * # is which edges the block is pinned to, which end the line is set  #
 * # from, and where the wash stops — see `Wash` below.                #
 * ####################################################################
 */

export function Overlay({
  overlay,
  durationFrames,
  assetSrc = null,
  vision = null,
  treatment = 'rule',
}: {
  overlay: SceneOverlay
  /**
   * The SCENE's length, not the composition's — the same distinction `TextCard`
   * makes, and for the same reason: Studio and `<Player>` can both mount a scene
   * inside a differently-sized composition.
   */
  durationFrames: number
  /**
   * Defaulted rather than required, unlike `overlay` and `durationFrames`. Those
   * two are facts about the scene and a missing one is a caller bug; this is a
   * presentation choice with a house default, so Studio, `<Player>` and a test
   * that does not care are all correct without it.
   */
  /**
   * The scene's picture, needed ONLY by the `plate` style, which redraws it
   * small on black.
   *
   * Defaulted to null so every existing caller, Studio and the tests stay
   * correct without it — and so a plate marked on a scene whose sourcing found
   * no photograph degrades to the ordinary mark instead of drawing a caption
   * under an empty black frame.
   */
  assetSrc?: string | null
  /**
   * THE PHOTOGRAPH'S OWN VISION RECORD, AND IT IS WHAT DECIDES THE CORNER.
   *
   * `vision.subjectAnchor` says where the subject of the picture is, so it is
   * the only thing on the plan that can answer "which corner is clear of it".
   * The whole record is passed rather than the anchor alone because
   * `overlayPlacement` also needs `shotScale` to know how much of the frame the
   * subject takes up — see the box on `OVERLAY_SUBJECT_RADIUS_FRACTION`.
   *
   * Defaulted to null like `assetSrc`, and null is a real answer rather than a
   * missing one: a HELD scene draws the previous shot's photograph and the plan
   * does not carry that picture's vision, so there is genuinely no subject to be
   * clear of and the mark takes the delivered block.
   */
  vision?: AssetVision | null
  treatment?: OverlayTreatment
}): ReactNode {
  const frame = useCurrentFrame()
  /*
   * `overlay.startFrame` is the moment the narrator names the thing, rebased by
   * the planner into this scene's frames. Nullish on a plan frozen before the
   * field existed and on a scene the model gave no timestamp for, and `?? 0` is
   * then byte-for-byte the behaviour this device shipped with.
   */
  const choreography = overlayChoreography(durationFrames, overlay.startFrame ?? 0)

  /*
   * THE SHORT-SCENE REFUSAL, and it is the whole reason this component knows the
   * scene's length. Under `OVERLAY_MIN_READABLE_FRAMES` nobody can finish
   * reading the line, and a word that flashes and goes reads as a fault in the
   * render rather than as a mark. The scene keeps its photograph.
   */
  if (choreography.mode === 'none') return null

  const exit =
    choreography.mode === 'animated'
      ? interpolate(
          frame,
          [choreography.exitFrom, choreography.exitFrom + choreography.exitFrames],
          [0, 1],
          { easing: easeIn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
      : 0

  const ground = progressIn(frame, choreography.ground, choreography)

  /*
   * STYLE `fullFrame` — the client's 2026-08-15 reference, a bare year set across
   * the middle of the picture.
   *
   * THE `overlayFitsFullFrame` HALF IS NOT OPTIONAL. `Line` sets
   * `whiteSpace: nowrap`, so a line that does not fit cannot wrap or shrink out
   * of trouble — it hangs off both edges of the frame. Falling back to the
   * delivered lower-third look costs a treatment; drawing it anyway costs the
   * shot. The bound the SEGMENTER is asked for lives in `@vg/core/schemas`; this
   * is the one that decides what is actually drawn.
   */
  if (overlay.style === 'fullFrame' && overlayFitsFullFrame(overlay.text)) {
    return <FullFrameYear text={overlay.text} ground={ground} exit={exit} />
  }

  /*
   * STYLE `plate` — THE TITLE. It no longer draws a plate and it no longer
   * needs the picture, because it no longer redraws it.
   *
   * The string is unchanged on purpose. It is what the segmenter writes, what
   * the tool enum offers and what every stored artifact contains, and
   * `readArtifact` treats a parse failure as a cache MISS — so renaming the
   * value would re-source and re-bill every job ever run. See the box on
   * `OVERLAY.title` in constants.ts.
   *
   * `assetSrc` IS STILL THE GUARD, for a different reason than before. It used
   * to stop a caption being centred under an empty black frame; now it stops a
   * title being set over nothing at all. `Scene` already refuses to mount this
   * component without a picture, so this is the second lock rather than the
   * first.
   */
  if (overlay.style === 'plate' && assetSrc !== null) {
    return (
      <Title
        text={overlay.text}
        ground={ground}
        /*
         * THE POP RUNS OVER THE WHOLE ENTRY, NOT OVER THE GROUND'S SIX FRAMES.
         *
         * `ground` is the gradient's window — 6 frames, 0.2s — which is right
         * for a wash arriving and far too fast for a title landing. This spans
         * the opening beat to the end of the line's own window, which is
         * `OVERLAY_ENTRY_FRAMES` (20, 0.67s) and the same gesture length every
         * other device in the film uses.
         *
         * LINEAR, DELIBERATELY. `progressIn` applies `easeOut`, and `titleScale`
         * applies its own two-phase easing on top — composing the two would put
         * the peak somewhere neither constant describes.
         */
        entry={interpolate(
          frame,
          [choreography.ground[0], choreography.line[1]],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )}
        exit={exit}
      />
    )
  }

  /*
   * STYLE `note` — the annotation, revealed a character at a time. His other
   * 2026-08-15 reference, and the one he described as "the text font and the
   * in-motion".
   *
   * ####################################################################
   * # THE ONLY STYLE THAT TYPES, AND THE ONLY ONE THAT ASKS THE SHARED  #
   * # CLOCK HOW LONG ITS OWN STRING TAKES.                              #
   * #                                                                   #
   * # It used to uncover every string, long or short, across the flat   #
   * # 12-frame window every other device takes. A 64-character note ran #
   * # at about 6ms a character and front-loaded by the easing, which is #
   * # a WIPE. What the client asked for is a keyboard.                  #
   * #                                                                   #
   * # `overlayTypeRoom` is what this scene can afford and                #
   * # `overlayTypeFrames` is what this string wants, both from          #
   * # @vg/core/frames, because `deliver` lays a keystroke under each    #
   * # word using the identical two calls. Neither end owns the timing.  #
   * # Two frames of disagreement and the sound stops belonging to the   #
   * # picture.                                                          #
   * #                                                                   #
   * # THE REVEAL IS SPENT INSIDE THE ENTRY AND HOLD THE MARK ALREADY    #
   * # HAD. `ground`, `exitFrom` and `exitFrames` are the same numbers    #
   * # in both choreographies, which is why the two can be mixed in one   #
   * # render without anything coming apart — only `line` differs.        #
   * ####################################################################
   */
  if (overlayStyleTypes(overlay.style)) {
    const room = overlayTypeRoom(durationFrames, overlay.startFrame ?? 0)
    const revealFrames = overlayTypeFrames(overlay.text, room)
    const typed = overlayChoreography(durationFrames, overlay.startFrame ?? 0, revealFrames)

    return (
      <Note
        text={overlay.text}
        ground={ground}
        exit={exit}
        progress={progressIn(frame, typed.line, typed, LINEAR)}
        placement={overlayPlacement(vision, overlay.text, OVERLAY_NOTE_FONT_SIZE)}
      />
    )
  }

  /*
   * A YEAR OR A NAME IS A LABEL; ANYTHING ELSE IS A HEADLINE. The classification
   * travels on the plan because the segmenter made it while it still had the
   * narration in front of it. Re-deriving it here with a regex would be a second
   * opinion formed with strictly less information — which is exactly how the
   * text card's eyebrow used to print a common noun as if it were a place.
   */
  const setting = overlay.kind === 'phrase' ? OVERLAY.phrase : OVERLAY.label

  const showsRule = treatment === 'rule'
  const placement = overlayPlacement(vision, overlay.text, OVERLAY.fontSize)
  const box = overlayLineBox(placement, showsRule)
  const { onTop, onRight } = overlayPlacementEdges(placement)

  return (
    <AbsoluteFill>
      <Wash placement={placement} ground={ground} exit={exit} />

      <div
        style={{
          position: 'absolute',
          ...boxStyle(box),
          fontFamily: FONT_FAMILY,
          opacity: 1 - exit,
          transform: `translateY(${String(exitTravel(exit, onTop))}px)`,
          willChange: 'transform, opacity',
        }}
      >
        {/*
          TREATMENT `rule` — the same 64x2px gold hairline the card draws,
          animated the same way: `scaleX` from a left origin, never an animated
          `width`, because width is a layout property and animating it relays the
          line under it on every frame it takes to draw.

          TREATMENT `plain` drops it and moves the block down by exactly the rule
          and its gap, so the line lands on the same edge either way and the two
          stills differ in one thing only. That is what makes the client's pick
          answer a question. `overlayLineBox` owns which edge that is, because it
          is the bottom of the block at a bottom mount and the top of the LINE at
          a top one.

          IT DRAWS FROM THE SAME END THE LINE IS SET FROM. A right-aligned corner
          keeps the hairline against the right edge and grows it leftward, or the
          mark would be a line in the corner with a rule stranded across the
          frame from it.
        */}
        {showsRule && (
          <div
            style={{
              width: TEXT_CARD.rule.width,
              height: TEXT_CARD.rule.height,
              backgroundColor: TEXT_CARD.accentColor,
              marginBottom: TEXT_CARD.rule.gapBelowBare,
              marginLeft: onRight ? 'auto' : undefined,
              transformOrigin: onRight ? 'right center' : 'left center',
              transform: `scaleX(${String(ground)})`,
              willChange: 'transform',
            }}
          />
        )}

        <Line
          text={overlay.text}
          color={setting.color}
          letterSpacing={setting.letterSpacing}
          progress={progressIn(frame, choreography.line, choreography)}
        />
      </div>
    </AbsoluteFill>
  )
}

/**
 * THE LEGIBILITY GUARANTEE, AND IT IS NOT KEYED TO THE PICTURE UNDERNEATH.
 *
 * This device fires 8-12 times in an 8m46s film and nobody previews the
 * photograph under any of them, so the contrast has to be a property of the
 * DESIGN rather than of the picture. See `OVERLAY.scrim` for the worst cases it
 * is sized for — 10.3:1 for the off-white and 4.9:1 for the gold, both computed
 * against a pure WHITE image and both pinned by T-OV17d. A corner draws the same
 * ramp turned toward its own edge and masked so it stops, so the alpha under the
 * type is the identical 0.82 and the arithmetic carries over unchanged — see the
 * box on `OVERLAY_CORNER_WASH_UP`.
 *
 * IT FADES WITH THE GROUND RATHER THAN SNAPPING ON. A scene's frame 0 is not
 * always a cut: `transitionIn` may be a crossfade or a dip, and this layer sits
 * ABOVE the outgoing picture, so a band arriving instantly would darken part of
 * a dissolve in one frame. Six frames of `opacity` costs nothing — it is a
 * compositor-only property, so no layer is re-rasterised for it.
 *
 * ONE COMPONENT, TWO CALLERS. The one-line look and the annotation both draw it
 * and they must not drift; the mask in particular is the kind of property that
 * gets added to one mount and forgotten on the other.
 */
function Wash({
  placement,
  ground,
  exit,
}: {
  placement: OverlayPlacement
  ground: number
  exit: number
}): ReactNode {
  const wash = overlayWash(placement)

  return (
    <AbsoluteFill
      style={{
        background: wash.background,
        /*
         * BOTH SPELLINGS, and the prefixed one is not legacy noise. The
         * unprefixed property is recent in Chrome and this bundle is rendered by
         * whichever Chrome Headless Shell the installed Remotion ships; the
         * `-webkit-` form has been understood since Chrome 4. A renderer that
         * honours neither draws the ramp full width, which is more wash than
         * intended and never less — see the box on `OVERLAY_CORNER_WASH_UP`.
         */
        maskImage: wash.maskImage,
        WebkitMaskImage: wash.maskImage,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        opacity: ground * (1 - exit),
      }}
    />
  )
}

/**
 * The box, as CSS. `undefined` is how a side is left unpinned, which is what
 * lets one shape describe a block pinned left or right and top or bottom.
 */
function boxStyle(box: OverlayBlockBox): {
  left: number | undefined
  right: number | undefined
  top: number | undefined
  bottom: number | undefined
  width: number
  maxWidth: number
  textAlign: 'left' | 'right'
} {
  return {
    left: box.left,
    right: box.right,
    top: box.top,
    bottom: box.bottom,
    width: box.width,
    maxWidth: box.width,
    textAlign: box.textAlign,
  }
}

/**
 * A MARK LEAVES THE WAY IT CAME, which at a top corner is upward.
 *
 * The delivered block slides DOWN as it fades, toward the frame edge it is
 * pinned to. A top-mounted block sliding down would travel INTO the picture
 * while disappearing, which reads as the type falling rather than as the device
 * being taken off. Same distance, opposite sign.
 */
function exitTravel(exit: number, onTop: boolean): number {
  return exit * TEXT_CARD.exitTranslateY * (onTop ? -1 : 1)
}

/**
 * LOOK C — THE TITLE. Set across the middle of the photograph, which stays whole.
 *
 * ####################################################################
 * # THIS REPLACED A DEVICE THE CLIENT REJECTED, AND THE ARITHMETIC IS #
 * # WHY.                                                              #
 * #                                                                   #
 * # It used to paint the frame black and redraw the picture inside a  #
 * # 1131x742 box with a 50px caption 80px beneath it. On a 16:9       #
 * # photograph that box draws 1131x636 — 34.7% of the frame — so 65%  #
 * # of the shot was ground and the caption sat a tenth of the frame   #
 * # from the thing it named. He sent that frame back on 2026-08-16    #
 * # with one of his own where the picture fills the screen and the    #
 * # title sits on it. `crop.ts` already records him stopping the      #
 * # delivered film at 0:02:23 on the same geometry one layer down.    #
 * #                                                                   #
 * # SO IT NO LONGER DRAWS A PICTURE AT ALL. `Visual` drew one, full   #
 * # frame, already moving. Not covering it is the entire fix, and it  #
 * # is why the client's other ask — that the background zoom — needed #
 * # no work here: the zoom was always running underneath the black.   #
 * ####################################################################
 *
 * ####################################################################
 * # TWO SIZES, AND `overlayTitleSetting` PICKS BETWEEN THEM.          #
 * #                                                                   #
 * # The client's reference is a bare year across the middle of a      #
 * # photograph at 36% of the frame height, and this drew 12.71%. Same #
 * # family, same weight 800, same colour — the note he sent is about  #
 * # SIZE. So a title that FITS the full-frame measure is now set at   #
 * # the year's 389px cap on one line, and "4Q204" fits.               #
 * #                                                                   #
 * # THE FALLBACK IS WHY THE GATE EXISTS. Large is one line of         #
 * # `whiteSpace: nowrap` — a six-character title at font-size 515     #
 * # would hang off both edges of the frame with nothing to catch it.  #
 * # Anything the gate refuses keeps the delivered treatment: 12.71%,  #
 * # split to at most two balanced lines in `overlayTitleLines` rather #
 * # than by the browser, the same reason the card splits its own      #
 * # headline. Nothing on either path can hang off the frame.          #
 * #                                                                   #
 * # THE CENTRE OFFSET TRAVELS WITH THE SIZE and is not a constant     #
 * # here. +0.009 was measured on a two-line 181px block and -0.048 on #
 * # a one-line 515px one; a large title is the second of those.       #
 * ####################################################################
 *
 * A FLAT DIM, NOT THE LOWER-THIRD GRADIENT, shared with the year. That gradient
 * is fully transparent across the middle of the frame where this type sits, so
 * it would do nothing, and a second gradient shaped for the centre would darken
 * exactly the part of the photograph the client wants more of.
 */
function Title({
  text,
  ground,
  entry,
  exit,
}: {
  text: string
  /** The opening beat, 6 frames. Drives the wash and the fade. */
  ground: number
  /** The whole 20-frame entry. Drives the pop, which needs the longer window. */
  entry: number
  exit: number
}): ReactNode {
  /*
   * THE POP, AND IT IS A DELIBERATE REVERSAL OF THE RULE ON `FullFrameYear`.
   *
   * That component settles DOWN from 1.05 because type that grows reads as a
   * title animation. This IS the title, it fires once, and the client asked for
   * the growing one by name.
   *
   * `titleScale` lands on exactly 1 whatever `overshoot` is — see the box on it
   * for the version that did not, and stayed 4% too large for the rest of the
   * shot with nothing going red. Applied to a SCALE and never to the opacity
   * beside it: a value over 1 fed to an opacity is clamped by the compositor
   * rather than by the function, which hides the mistake.
   */
  const scale = titleScale(entry, OVERLAY.title.fromScale, OVERLAY.title.overshoot)

  /*
   * THE SIZE, THE MEASURE, THE OFFSET AND THE LINES ARE ONE DECISION, so they
   * are made once in `constants.ts` and only read here. Deciding them separately
   * in four style properties is how a large title would end up drawn at the
   * year's size on the fallback's offset — 62px off its own centre, on a frame
   * nothing would flag.
   */
  const titleSetting = overlayTitleSetting(text)

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ backgroundColor: OVERLAY_TITLE_DIM, opacity: ground * (1 - exit) }}
      />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          /*
           * Optically centred, and applied as a transform rather than a `top`
           * offset so it composites with the pop instead of forcing a second
           * layout. Both offsets were measured off rendered PNGs of the block
           * they serve — see the box on `OVERLAY.title.centreOffsetFraction`.
           */
          transform: `translateY(${String(FRAME_HEIGHT * titleSetting.centreOffsetFraction)}px) scale(${String(scale * (1 - exit) + exit)})`,
          opacity: (1 - exit) * ground,
          willChange: 'transform, opacity',
        }}
      >
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: titleSetting.fontSize,
            fontWeight: OVERLAY.title.fontWeight,
            letterSpacing: `${String(OVERLAY.title.letterSpacingEm)}em`,
            color: OVERLAY.title.color,
            lineHeight: OVERLAY.title.lineHeight,
            width: titleSetting.blockWidth,
            maxWidth: titleSetting.blockWidth,
            /*
             * NOWRAP ON THE LARGE PATH ONLY, and it is the same statement
             * `FullFrameYear` makes: a string that somehow got past
             * `overlayFitsFullFrame` overflows VISIBLY rather than wrapping to a
             * second 389px line, which would be 78% of the frame height of solid
             * type over the photograph. The fallback path must wrap — that is
             * how it holds two lines at all.
             */
            whiteSpace: titleSetting.full ? 'nowrap' : 'normal',
            textAlign: 'center',
          }}
        >
          {titleSetting.lines.map((line, position) => (
            <div key={`${String(position)}-${line}`}>{line}</div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * LOOK B — the annotation, revealed a character at a time.
 *
 * ####################################################################
 * # THE REVEAL IS PER CHARACTER, ON OPACITY, AND EVERY OTHER WAY OF   #
 * # DOING IT IS WORSE HERE.                                           #
 * #                                                                   #
 * # An animated `width` or a growing box RELAYS the text on every     #
 * # frame it takes to draw, which is the rule the rest of this file   #
 * # already follows by using `scaleX` for the rule.                    #
 * #                                                                   #
 * # A single `clip-path` wipe across the whole block would uncover    #
 * # BOTH LINES AT ONCE, left to right, which is not what a typewriter #
 * # does and not what the reference shows — his frame has line one    #
 * # finished and line two caught mid-word.                            #
 * #                                                                   #
 * # Per-character opacity is sequential across a wrap for free,       #
 * # because the characters are already in reading order, and opacity  #
 * # is a compositor-only property so nothing is re-rasterised.        #
 * ####################################################################
 *
 * WORDS ARE `inline-block`, WHICH IS WHAT KEEPS THE WRAPPING CORRECT. Split a
 * line into one span per character and the browser becomes free to break INSIDE
 * a word, because each span is its own inline box. Grouping each word into an
 * inline-block puts the break opportunities back where the spaces are.
 *
 * ####################################################################
 * # `progress` IS LINEAR AND ITS WINDOW IS THE STRING'S OWN LENGTH.   #
 * # BOTH ARE NEW AND BOTH ARE LOAD-BEARING.                           #
 * #                                                                   #
 * # This component's arithmetic is unchanged — `revealed` is still    #
 * # `progress x characters`, still counted with the spread operator   #
 * # so an astral character is one unit — and that is exactly why the  #
 * # keystrokes land. `overlayTypeWordOffsets` in @vg/core/frames puts #
 * # word k's beat at `round(consumed / characters x frames)`, and     #
 * # `consumed` there counts the identical units in the identical      #
 * # order, whitespace included. So the frame a word's first character #
 * # crosses opacity 0 here IS the frame the click is laid on there,   #
 * # as long as the progress feeding this is linear.                   #
 * #                                                                   #
 * # See the box on `LINEAR` for what an eased one would cost.         #
 * ####################################################################
 */
function Note({
  text,
  ground,
  exit,
  progress,
  placement,
}: {
  text: string
  ground: number
  exit: number
  progress: number
  placement: OverlayPlacement
}): ReactNode {
  // Split on spaces but KEEP them, so the gaps reveal in sequence with the
  // letters either side and the line does not assemble itself in jumps.
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0)
  const total = [...text].length
  const revealed = progress * total

  let consumed = 0

  const { onTop } = overlayPlacementEdges(placement)

  return (
    <AbsoluteFill>
      <Wash placement={placement} ground={ground} exit={exit} />

      <div
        style={{
          position: 'absolute',
          /*
           * Pinned by the edge it grows AWAY from, unlike the one-line look. See
           * `overlayNoteBox` for why the trade-off flips when the block is
           * allowed to wrap, and why a top corner has to pin the opposite side.
           */
          ...boxStyle(overlayNoteBox(placement)),
          fontFamily: FONT_FAMILY,
          fontSize: OVERLAY_NOTE_FONT_SIZE,
          fontWeight: OVERLAY.note.fontWeight,
          lineHeight: OVERLAY.note.lineHeight,
          letterSpacing: OVERLAY.note.letterSpacing,
          color: OVERLAY.note.color,
          opacity: 1 - exit,
          transform: `translateY(${String(exitTravel(exit, onTop))}px)`,
          willChange: 'transform, opacity',
        }}
      >
        {parts.map((part, partIndex) => {
          const start = consumed
          consumed += [...part].length
          const isSpace = /^\s+$/.test(part)

          // A run of whitespace is drawn as-is rather than as spans: an
          // inline-block space would stop being a break opportunity and the
          // line could not wrap at all.
          if (isSpace) return <span key={partIndex}>{part}</span>

          return (
            <span key={partIndex} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
              {[...part].map((character, characterIndex) => (
                <span
                  key={characterIndex}
                  style={{
                    // A one-character ramp rather than a hard switch, so the
                    // edge of the reveal is soft the way a real one is.
                    opacity: Math.min(1, Math.max(0, revealed - (start + characterIndex))),
                  }}
                >
                  {character}
                </span>
              ))}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/**
 * LOOK A — the year, set across the middle of the photograph.
 *
 * ####################################################################
 * # THIS IS THE ONE PLACE THE COMPOSITOR PUTS TYPE OVER THE SUBJECT  #
 * # OF A PICTURE, and everything odd about it follows from that.     #
 * #                                                                   #
 * # A FLAT DIM, NOT THE LOWER-THIRD GRADIENT. That gradient is fully  #
 * # transparent across the middle of the frame, so it would do        #
 * # nothing here; shaping a second gradient for the centre would      #
 * # darken exactly the part of the photograph the client wants more   #
 * # of. A low flat wash costs contrast evenly and guarantees the      #
 * # figure reads over any image.                                      #
 * #                                                                   #
 * # IT SCALES DOWN INTO PLACE, never up. Type that grows reads as a   #
 * # title animation; type that settles reads as a mark being placed.  #
 * # `transform` and `opacity` only — an animated `filter` or          #
 * # `fontSize` re-rasterises the layer every frame, which is the      #
 * # cost note at the top of Grade.tsx.                                #
 * ####################################################################
 *
 * It shares the lower third's clock rather than inventing one, so a year and a
 * name arrive and leave on the same beat and the film reads as one film.
 */
function FullFrameYear({
  text,
  ground,
  exit,
}: {
  text: string
  ground: number
  exit: number
}): ReactNode {
  const settle = OVERLAY.fullFrame.fromScale + (1 - OVERLAY.fullFrame.fromScale) * ground

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ backgroundColor: OVERLAY_FULL_FRAME_DIM, opacity: ground * (1 - exit) }}
      />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          // Optically centred — see `centreOffsetFraction`. Applied as a
          // transform rather than as a `top` offset so it composites with the
          // settle instead of forcing a second layout.
          transform: `translateY(${String(FRAME_HEIGHT * OVERLAY.fullFrame.centreOffsetFraction)}px) scale(${String(settle * (1 - exit) + exit)})`,
          opacity: (1 - exit) * ground,
          willChange: 'transform, opacity',
        }}
      >
        <div
          style={{
            fontFamily: FONT_FAMILY,
            /*
             * FITTED, NOT FIXED, AND THE TITLE USES THE SAME CALL. A year with
             * no "1" in it is materially wider than "1947" — Libre Franklin's
             * figures are proportional, which the advance comment used to deny
             * — so a fixed size here is a line that hangs off the frame on the
             * one shot this device exists for.
             */
            fontSize: overlayFullFrameFontSize(text),
            fontWeight: OVERLAY.fullFrame.fontWeight,
            letterSpacing: `${String(OVERLAY.fullFrame.letterSpacingEm)}em`,
            /*
             * Cancels the trailing letter-space so the GLYPHS are centred rather
             * than their box. See `letterSpacingEm` for the measurement.
             */
            marginRight: `${String(-OVERLAY.fullFrame.letterSpacingEm)}em`,
            color: OVERLAY.fullFrame.color,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * The line itself.
 *
 * `whiteSpace: 'nowrap'` is a claim the schema already pays for, not a hope:
 * `OVERLAY_MAX_CHARS` is 26 and this measure holds 34 at this size. Stating it
 * here means a line that somehow got past that bound overflows visibly rather
 * than wrapping into a second line that would push the block off its designed
 * bottom edge and into the caption position it exists to avoid.
 */
function Line({
  text,
  color,
  letterSpacing,
  progress,
}: {
  text: string
  color: string
  letterSpacing: string
  progress: number
}): ReactNode {
  return (
    <div
      style={{
        fontSize: OVERLAY.fontSize,
        fontWeight: OVERLAY.fontWeight,
        lineHeight: OVERLAY.lineHeight,
        letterSpacing,
        color,
        whiteSpace: 'nowrap',
        opacity: progress,
        // Transform only, so the line breaks — there is only one — are decided
        // once at layout and never move.
        transform: `translateY(${String((1 - progress) * TEXT_CARD.eyebrow.translateY)}px)`,
        willChange: 'transform, opacity',
      }}
    >
      {text}
    </div>
  )
}

/**
 * ####################################################################
 * # THE NOTE'S REVEAL IS LINEAR ON PURPOSE. THE EASING WAS REMOVED,   #
 * # NOT LOST, AND WITHOUT THIS COMMENT IT READS AS A MISTAKE.         #
 * #                                                                   #
 * # `progressIn` applies `easeOut`, which is right for everything     #
 * # that ARRIVES — a scrim, a rule, a line of type fading up. It is   #
 * # wrong for a typewriter, because the reveal is not one gesture     #
 * # arriving, it is a sequence of events with a SOUND on each one.    #
 * #                                                                   #
 * # `deliver` puts a keystroke on the frame each word's first         #
 * # character appears, and it computes those frames with              #
 * # `overlayTypeWordOffsets` in @vg/core/frames, which is LINEAR      #
 * # across the characters of the string. An eased picture against     #
 * # linear sound does not drift by a frame or two, it comes apart at  #
 * # both ends: `easeOut(0.25)` is 0.578, so at a quarter of the way   #
 * # through a 40-frame reveal the eye is 58% of the way through the   #
 * # words and the clicks are 25% of the way through theirs.           #
 * #                                                                   #
 * # THE SCRIM STAYS EASED. `ground` is a wash arriving and carries no #
 * # sound, so it keeps the house curve every other device uses. Only  #
 * # the note's own line goes linear.                                  #
 * ####################################################################
 */
const LINEAR = (value: number): number => value

/**
 * One entry window.
 *
 * BOTH `animated` AND `static` INTERPOLATE, and only the EXIT tells them apart.
 * This used to short-circuit to 1 for anything that was not `animated`, on the
 * reasoning that a truncated animation looks like a bug while a static mark
 * looks like a decision. That reasoning is sound about the exit and wrong about
 * the entry: arriving instantly on frame 0 means arriving on top of the outgoing
 * picture of a crossfade, which is not a decision, it is the device landing on
 * the wrong shot. See the box on the `static` branch of `overlayChoreography`
 * for the render that proved it.
 *
 * `none` never reaches here — the component returns null before drawing — so the
 * guard is only about keeping the function total.
 *
 * The WINDOWS come from `overlayChoreography`, so the decision that matters is
 * made in one place; only this interpolation is local.
 */
function progressIn(
  frame: number,
  window: FrameWindow,
  choreography: OverlayChoreography,
  /**
   * DEFAULTED TO THE HOUSE CURVE, so every existing call site is unchanged and
   * only the one device that needs a different answer says so. See the box on
   * `LINEAR` above for the one that does.
   */
  easing: (value: number) => number = easeOut,
): number {
  if (choreography.mode === 'none') return 1
  return interpolate(frame, [window[0], window[1]], [0, 1], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}
