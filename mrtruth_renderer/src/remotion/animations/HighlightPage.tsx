import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { BODY_FACE_FAMILY, useBodyFace } from './bodyFace.js'
import { useBodyFaceBold } from './bodyFaceBold.js'
import {
  HIGHLIGHT_PAGE,
  highlightPageBlockTop,
  highlightPageReveal,
  highlightPageScale,
  highlightPageSchedule,
} from './highlightPageClock.js'

/**
 * a2, the highlighted-paragraph page — three paragraphs of body type on a
 * light, softly vignetted page, with a yellow block wiping in behind one bold
 * phrase in each, and the whole page zooming slowly in.
 *
 * The client's second reference animation, at 0:03 of `Templates (Unseperated)`.
 * Every number lives in `highlightPageClock.ts`, pinned by measurements there.
 *
 * ####################################################################
 * # IN THE FILM SINCE 2026-09-11, ON HIS RULING THAT IT IS MANDATORY  #
 * # IN EVERY VIDEO. `DeviceFrame.tsx` draws it. The tool never       #
 * # chooses it: it is placed by hand until the step that writes its  #
 * # passage is built. See `PLACED_BY_OPERATOR_ONLY`.                  #
 * ####################################################################
 *
 * ####################################################################
 * # THE BOLD IS REAL NOTO SANS BOLD SINCE 2026-09-11.                 #
 * #                                                                   #
 * # a2's marked phrases are set in a REAL BOLD WEIGHT — measured,     #
 * # their advance is 1.0802x the regular's with a per-character       #
 * # increment spanning 1.432 to 1.826px, a 27% spread. A synthetic    #
 * # stroke adds a CONSTANT amount per glyph and is excluded twice     #
 * # over, once by that spread and once by template fits.              #
 * #                                                                   #
 * # Until now `font-weight: 700` fell through to Chrome's SYNTHETIC   #
 * # bold, patched with tracking. `bodyFaceBold.ts` registers Noto     #
 * # Sans Bold 2.015 in this family, and fontTools sets his three      #
 * # phrases at 1.0806 / 1.0662 / 1.0913 of the regular against his    #
 * # 1.0833 / 1.0719 / 1.0928. See the box in the clock. A render must #
 * # still confirm the rects before a clip goes out.                   #
 * ####################################################################
 *
 * ####################################################################
 * # WHAT THE FILM CANNOT YET PRODUCE, AND a2 IS THE MOST DEMANDING    #
 * # OF THE NINE.                                                      #
 * #                                                                   #
 * # It needs 56 words of connected PROSE plus three phrases that are  #
 * # exact substrings of it. Not a caption — a paragraph.              #
 * #                                                                   #
 * # BUT IT IS NOT BLOCKED THE WAY a5 IS. a5 needs "CEO of Tesla &     #
 * # SpaceX", a fact about a real person that nothing here knows. a2   #
 * # needs prose and substrings of that prose, and the narration IS    #
 * # prose the aligner has already timestamped word by word. So a2     #
 * # passes `verifySpokenMarks` by construction — the guard keeps an   #
 * # overlay when ANY of its words were spoken in the shot, and every  #
 * # word here would be.                                               #
 * #                                                                   #
 * # What is missing is SELECTION: nothing chooses where to break the  #
 * # narration into three paragraphs or which phrase to mark in each.  #
 * # That is a much cheaper problem than invention.                    #
 * ####################################################################
 */

/**
 * One paragraph, with its marked phrase wrapped.
 *
 * ####################################################################
 * # THE MARK IS A REAL INLINE ELEMENT, NOT AN ABSOLUTELY POSITIONED   #
 * # RECTANGLE, AND THAT IS A DELIBERATE TRADE.                        #
 * #                                                                   #
 * # The three rects' design coordinates ARE measured — 551..914,      #
 * # 652..1227, 320..618 — so hard-coding them would reproduce the     #
 * # reference exactly. It would also make the device able to draw     #
 * # only this one paragraph set, and a2 is the one animation whose    #
 * # geometry is a function of its copy.                               #
 * #                                                                   #
 * # So the browser lays the marks out and the test checks that it     #
 * # lands on those measured integers.                                 #
 * ####################################################################
 */
function Paragraph({
  text,
  phrase,
  index,
  reveal,
}: {
  text: string
  phrase: string
  index: number
  reveal: number
}): ReactNode {
  const { type, highlight } = HIGHLIGHT_PAGE

  /*
   * FIRST occurrence. The phrase is required to be an exact substring — the
   * CLI refuses one that is not — and a phrase that occurs twice is not
   * something the reference can settle, so the first is taken and said so.
   *
   * ####################################################################
   * # A PHRASE THAT IS NOT THERE DRAWS NO MARK, AND THE FIRST BUILD    #
   * # APPENDED IT TO THE PARAGRAPH INSTEAD.                            #
   * #                                                                   #
   * # `indexOf` returning -1 left `before` as the whole text and       #
   * # `after` empty, and the span was still rendered — so the missing  #
   * # phrase was silently STUCK ON THE END of the paragraph, in bold,  #
   * # on a yellow block. Caught by the mount test, not by review.      #
   * #                                                                   #
   * # An EMPTY phrase is the same trap wearing a different hat:        #
   * # `indexOf('')` returns 0, so it drew a zero-width mark at the     #
   * # head of every paragraph.                                         #
   * #                                                                   #
   * # The CLI refuses both before they get here. This is the second    #
   * # line of defence, for a caller wiring the component directly.     #
   * ####################################################################
   */
  const at = phrase.length === 0 ? -1 : text.indexOf(phrase)
  const marked = at >= 0
  const before = marked ? text.slice(0, at) : text
  const after = marked ? text.slice(at + phrase.length) : ''

  const markStyle: CSSProperties = {
    fontWeight: 700,
    /*
      THE SAME COLOUR AS THE BODY. Measured, the bold reads 0.5-0.9 levels
      darker, which is exactly what its wider stem alone predicts. Giving it
      its own colour is inventing a difference the frames do not have.
    */
    color: type.colour,
    /*
      NOWRAP, AND IT IS LOAD-BEARING RATHER THAN DECORATION.

      Line 5 of the reference wraps BEFORE the bold "exactly" even though the
      line plus that word is 1187.3 design px, less than line 1's own 1222.45.
      That only resolves if marks are unbreakable. Without this, paragraph 3
      wraps differently from his and every x-position on it is wrong.
    */
    whiteSpace: 'nowrap',
    /*
      NO TRACKING. The width comes from the real bold registered by
      `useBodyFaceBold`, so it sits inside each glyph where his does. The
      1.2px-per-character stand-in that used to live here patched Chrome's
      synthetic bold, which adds nothing to advances.
    */
    /*
      VERTICAL PADDING OF EXACTLY THE HALF-LEADING, AND HORIZONTAL PADDING OF
      EXACTLY ZERO.

      An inline element's background paints its CONTENT box, which is the
      face's ascent plus descent — 1.362em, or 43.584 design px here. The
      reference's block is the LINE BOX, 51.2px. The difference is 7.616px,
      3.808 above and below.

      On an inline element vertical padding does not affect line height but
      does extend the background box, so this is the one lever that turns the
      content box into the line box without moving a single glyph.

      The horizontal zero is measured: the rect's left edge IS the pen position
      where the bold run starts, three times out of three.
    */
    padding: `${String((type.lineHeight - 1.362 * type.fontSize) / 2)}px 0`,
    /*
      THE WIPE. A hard, left-anchored width reveal at full opacity and full
      height from its first frame.

      `background-size` on a two-stop gradient of one colour is the cheapest
      spelling that cannot accidentally scale anything inside the block — the
      percentage resolves against the padding box, so 100% height IS the line
      box and the width is a fraction of the mark's own advance. A
      `transform: scaleX` would look identical on a bare div and is wrong the
      moment the block has content.

      Backgrounds always paint behind content, so the type sits on top of the
      yellow for free, which is what the reference shows.
    */
    backgroundImage: `linear-gradient(${highlight.colour}, ${highlight.colour})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${String(reveal * 100)}% 100%`,
    borderRadius: highlight.cornerRadius,
  }

  return (
    <p
      style={{
        margin: 0,
        /*
          The paragraph gap is 83.2 - 51.2 = 32 design px, exactly one em. Set
          as a margin between paragraphs rather than as a line-height, because
          the measured pitch is between the LAST baseline of one paragraph and
          the FIRST of the next.
        */
        marginTop: index === 0 ? 0 : type.paragraphPitch - type.lineHeight,
      }}
    >
      {before}
      {marked ? <span style={markStyle}>{phrase}</span> : null}
      {after}
    </p>
  )
}

export function HighlightPage({
  paragraphs,
  phrases,
}: {
  /** Three paragraphs of prose, in reading order. */
  paragraphs: readonly string[]
  /** One marked phrase per paragraph, each an exact substring of its own. */
  phrases: readonly string[]
}): ReactNode {
  useBodyFace()
  useBodyFaceBold()
  const frame = useCurrentFrame()

  const { type, vignette } = HIGHLIGHT_PAGE
  const scale = highlightPageScale(frame)
  const schedule = highlightPageSchedule(phrases)

  /*
    The gradient's ending shape is the OUTER ellipse, so the inner stop is a
    percentage along it. Semi-axes are `r` horizontally and `r / aspect`
    vertically, because the measured law is `hypot(dx, aspect * dy)`.
  */
  const outerX = vignette.outerRadius
  const outerY = vignette.outerRadius / vignette.aspect
  const innerStop = (vignette.innerRadius / vignette.outerRadius) * 100

  /*
    Oversized on purpose. The page only ever scales UP from 1.0, so a
    1920x1080 element would in fact always cover the frame — but a gradient
    that pads outside its own element is a silent failure the day anyone
    changes `scaleFrom`, and the extra pixels cost nothing.
  */
  const vignetteWidth = 2600
  const vignetteHeight = 1500

  return (
    <AbsoluteFill style={{ backgroundColor: HIGHLIGHT_PAGE.pageColour }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: HIGHLIGHT_PAGE.frameWidth,
          height: HIGHLIGHT_PAGE.frameHeight,
          /*
            ONE TRANSFORM CARRIES THE WHOLE PAGE, and everything inside is
            authored at design scale.

            Animating the font size instead re-rounds every line box every
            frame and gives a per-line shimmer of up to a pixel, on different
            lines at different times. Directly measured mid-shot, the
            reference's baselines are plainly NOT integers and match the
            continuously scaled design integers to 0.08px.
          */
          transform: `scale(${String(scale)})`,
          transformOrigin: '50% 50%',
        }}
      >
        {/*
          THE VIGNETTE IS INSIDE THE SCALED NODE, which is the whole point.

          Pinned to the viewport instead it is wrong by 23.5 to 25.1 codes rms
          at the first frame — the corners start 22 codes too bright and never
          move. And this is not a reuse of `GRID_VIGNETTE`: that one is 1275 x
          745 with a 1.712 axis ratio, a smoothstep, dark in the middle, on a
          dark ground. Refitting it to a2 costs 48x the residual.
        */}
        <div
          style={{
            position: 'absolute',
            left: HIGHLIGHT_PAGE.frameWidth / 2 - vignetteWidth / 2,
            top: HIGHLIGHT_PAGE.frameHeight / 2 - vignetteHeight / 2,
            width: vignetteWidth,
            height: vignetteHeight,
            /*
              Absolute pixels, never percentages — a percentage ellipse resizes
              with its box and the falloff lands somewhere else. And a CSS
              gradient interpolates in sRGB bytes, which is what the reference
              does: a free exponent fits to 0.998-1.001, where linear light is
              7 to 26 times worse and reads as a visible dark ring.
            */
            backgroundImage: `radial-gradient(${String(outerX)}px ${String(outerY)}px at 50% 50%, ${
              HIGHLIGHT_PAGE.pageColour
            } 0px, ${HIGHLIGHT_PAGE.pageColour} ${String(innerStop)}%, ${vignette.floorColour} 100%)`,
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: type.columnLeft,
            /*
              Positioned by the BLOCK TOP that puts the first BASELINE where it
              was measured. `top: baseline - fontSize` is wrong by 6 design px
              per line here, and it has shipped wrong twice in this project.
            */
            top: highlightPageBlockTop(),
            width: type.columnWidth,
            fontFamily: BODY_FACE_FAMILY,
            fontWeight: 400,
            fontSize: type.fontSize,
            lineHeight: `${String(type.lineHeight)}px`,
            letterSpacing: type.letterSpacing,
            color: type.colour,
            /*
              KERNING ON. Turning it off costs 4.6 to 7.3x in fit residual and
              drifts a line by several pixels — the reference's renderer
              applied GPOS `kern`.
            */
            fontKerning: 'normal',
            textAlign: 'left',
          }}
        >
          {paragraphs.map((text, index) => (
            <Paragraph
              key={index}
              text={text}
              phrase={phrases[index] ?? ''}
              index={index}
              reveal={highlightPageReveal(frame, schedule[index] ?? { from: 0, to: 1 })}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}
