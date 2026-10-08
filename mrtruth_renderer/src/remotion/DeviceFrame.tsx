import type { ReactNode } from 'react'
import { DEVICE_REGISTRY } from '@vg/core/devices'
import type { SceneDevice } from '@vg/core/devices'
import type { Grade as GradeSettings } from '@vg/core/schemas'
import type { PictureMove } from './KenBurns.js'
import { BulletChecklist } from './animations/BulletChecklist.js'
import { ChapterPlate } from './animations/ChapterPlate.js'
import { ChapterTitle } from './animations/ChapterTitle.js'
import { CornerLabel } from './animations/CornerLabel.js'
import { FramedCard } from './animations/FramedCard.js'
import { GalleryStrip } from './animations/GalleryStrip.js'
import { HighlightPage } from './animations/HighlightPage.js'
import { PhotoPop } from './animations/PhotoPop.js'
import { TopTitle } from './animations/TopTitle.js'
import { TwoPhotoZoom } from './animations/TwoPhotoZoom.js'
/*
 * `NamePlate` IS DELIBERATELY NOT IMPORTED. Its registry entry is
 * `enabled: false`, and `inert.test.ts` asserts that no disabled device is
 * reachable from this file. Importing it would cost a full re-render of the
 * film — `bundleHash` folds in everything this module reaches — and buy
 * nothing, because `chooseDevices` can never return it. The component is
 * built and tested; it is one boolean and one import away from drawing.
 */
import { P02 } from './templates/P02.js'
import { P03 } from './templates/P03.js'
import { P04 } from './templates/P04.js'
import { P05 } from './templates/P05.js'
import { P08 } from './templates/P08.js'
import { P09 } from './templates/P09.js'
import { P12 } from './templates/P12.js'
import { P14 } from './templates/P14.js'
import { P17 } from './templates/P17.js'
import { P19 } from './templates/P19.js'
import { P22 } from './templates/P22.js'
import { ShadowUp } from './templates/ShadowUp.js'

/**
 * THE ONE PLACE A CHOSEN DEVICE BECOMES A DRAWN FRAME.
 *
 * ##########################################################################
 * # THIS FILE IS WHAT MAKES THE ANIMATIONS REACHABLE, AND THAT HAS A       #
 * # PRICE THAT IS PAID ONCE AND ON PURPOSE.                                #
 * #                                                                        #
 * # `bundleHash` is a hash of the bundle OUTPUT and every render key folds #
 * # it in. So the commit that adds this import invalidates EVERY cached    #
 * # segment of the client's film — one re-render of the whole thing, about #
 * # seventy-five minutes on the server instead of ten.                     #
 * #                                                                        #
 * # That is a real cost and it is not a bug. It is the cost of the         #
 * # compositor being able to draw a device at all, it is paid exactly once #
 * # however many devices land in the same commit, and `inert.test.ts` has  #
 * # been rewritten to pin the new boundary rather than the old one.        #
 * ##########################################################################
 *
 * NO `default:` ARM. The switch is exhaustive over the discriminated union and
 * ends in `assertNever`, so adding an eighteenth device stops this file
 * compiling until somebody says what draws it. A `default` that rendered null
 * would give a new device a black frame at exit 0 instead.
 */

/** Local, because nothing exports one that `apps/web` can import. Two lines. */
function assertNever(value: never): never {
  throw new Error(`DeviceFrame: unhandled device ${JSON.stringify(value)}`)
}

export type DeviceFrameProps = {
  device: SceneDevice
  /**
   * The scene's own picture, already resolved to a URL by the worker.
   *
   * NULL FOR `pictureSource: 'filmPreview'` ONLY. The opening gallery's carrier
   * beat may own no photograph at all, and even where it does, that picture is
   * the one card the strip must not show — it previews nothing. Every arm below
   * that reads `src` narrows it first, so a missing picture is a refusal to draw
   * rather than an empty `<Img>`.
   */
  src: string | null
  /**
   * The pictures beside the scene's own, already resolved. Empty for the
   * one-picture devices, three long for the four-picture ones — and FOUR long
   * for `gallery-strip`, which draws no card from its own scene.
   */
  companionSrcs: readonly string[]
  /**
   * The scene's own grade, for the one device that draws the house grade
   * ITSELF, under its type rather than over it: `top-title`. Every other device
   * ignores it, and `Scene` still mounts the grade on top of them.
   *
   * REQUIRED, NOT DEFAULTED. A default would let a caller forget the scene's
   * grade and draw the house default in its place, and nothing would say so.
   */
  grade: GradeSettings
  /**
   * THE PLAN'S MOVE FOR THIS SCENE'S OWN PICTURE, handed ONLY to the four
   * client animations that draw it full frame and untouched: shadow-up,
   * chapter-plate, top-title, corner-label. Lever 4, 2026-09-19. The planner
   * writes Saku's slow push-in into `scene.motion` for exactly those four
   * (`DEVICE_PICTURE_PUSH` in the worker's plan.ts). Every other arm ignores
   * it: the partner's templates push on their own, and framed-card and
   * two-photo-zoom hold their picture in a card, where a move is wrong.
   *
   * REQUIRED, for the reason `grade` is: an optional one here would let a
   * caller forget it and ship the four frozen again, with nothing to say so.
   */
  pictureMove: PictureMove
}

/**
 * Does this device carry its own colour treatment?
 *
 * ##########################################################################
 * # READ PER DEVICE, NEVER PER BRANCH, AND THE DIFFERENCE IS VISIBLE.      #
 * #                                                                        #
 * # The three partner templates apply their own CSS filter to the picture, #
 * # so mounting the house `Grade` on top of them grades it twice and       #
 * # matches neither the pack's preview nor the film. The client's own      #
 * # animations apply NOTHING, so skipping the house grade for them ships   #
 * # those shots with no tone curve, no toe lift, no grain and no vignette  #
 * # while the other ninety shots have all four.                            #
 * #                                                                        #
 * # A branch-level "templates don't get graded" rule is wrong in one       #
 * # direction for each half of the set. This is the fact, per device.      #
 * ##########################################################################
 */
export function deviceCarriesOwnGrade(device: SceneDevice): boolean {
  return DEVICE_REGISTRY[device.id].carriesOwnGrade
}

export function DeviceFrame({ device, src, companionSrcs, grade, pictureMove }: DeviceFrameProps): ReactNode {
  /*
   * ##########################################################################
   * # NARROWED ONCE, HERE, RATHER THAN AT EVERY ARM BELOW.                    #
   * #                                                                        #
   * # `src` became nullable so the opening gallery could draw on a beat that  #
   * # owns no photograph. Twenty-one of twenty-two devices take the scene's  #
   * # own picture and every one of them would need its own null check, which #
   * # is sixteen chances to forget one and hand `<Img>` an empty string.     #
   * #                                                                        #
   * # One guard, keyed off the registry's own `pictureSource`, refuses to     #
   * # draw an own-scene device with no scene picture and narrows `src` to a   #
   * # string for every arm after it. Returning null is correct rather than    #
   * # merely safe: the chooser's gate G2 already refuses those devices on a   #
   * # picture-less beat, so reaching here means the plan and the compositor   #
   * # disagree, and a blank device frame is the honest way to say so.         #
   * ##########################################################################
   */
  /*
   * ##########################################################################
   * # THE ONE `filmPreview` DEVICE IS ANSWERED BEFORE THE SWITCH, and that is #
   * # a type-narrowing decision as much as a structural one: after it, `src`  #
   * # is a string for all sixteen remaining arms and none of them needs its  #
   * # own null check. Sixteen checks is sixteen chances to forget one and    #
   * # hand `<Img>` an empty string.                                          #
   * #                                                                        #
   * # THE HOLD ON THIS DEVICE IS LIFTED — 2026-08-30. It was never about the  #
   * # drawing; it was about where the beat landed, and the planner now CUTS   #
   * # the beat at the boundary instead of hoping the segmenter left one       #
   * # there. See the box on the registry entry in `devices.ts`.               #
   * #                                                                        #
   * # DO NOT WRITE THE ANIMATION'S IMPORT PATH OUT ANYWHERE IN THIS FILE,     #
   * # NOT EVEN INSIDE A COMMENT. `inert.test.ts` finds imports with a regex   #
   * # over the raw source and does not strip comments, so a quoted module     #
   * # path in prose reads to it as a real edge. That went red here once,      #
   * # which is the test doing its job badly and usefully at the same time.    #
   * #                                                                        #
   * # THE ORDER IS READING ORDER AND THE CAMERA RUNS THE OTHER WAY. The       #
   * # camera opens hard inside the LAST picture and travels left to land on   #
   * # the FIRST, so handing them in the order the camera visits them makes a  #
   * # mirror that looks plausible and is wrong in every frame.                #
   * #                                                                        #
   * # AND THE SCENE'S OWN PICTURE IS NOT ONE OF THEM. T-17. This arm once     #
   * # read `[src, ...companionSrcs]`, which is right for every other          #
   * # four-picture device and wrong for this one. Saku 0.3 makes the gallery  #
   * # a preview of "content that appears LATER in the video", and the picture #
   * # on screen at that moment previews nothing. `plan.ts` therefore fills    #
   * # all four cards into `companions`, and the carrier may own no `src` at   #
   * # all — which is why this arm is answered before the `src === null`       #
   * # guard below rather than after it.                                       #
   * ##########################################################################
   */
  if (device.id === 'gallery-strip') return <GalleryStrip srcs={companionSrcs} />

  /*
   * Every other device draws the scene's own photograph. Reaching here with none
   * means the plan and the compositor disagree — the chooser's gate G2 already
   * refuses those devices on a picture-less beat — so a blank frame is the
   * honest way to say so rather than an empty `<Img>`.
   */
  if (src === null) return null

  switch (device.id) {
    /* ---- one picture ---- */
    case 'photo-pop':
      return <PhotoPop src={src} />

    case 'framed-card':
      return <FramedCard src={src} caption={device.caption} />

    case 'P12':
      return <P12 src={src} year={device.year} eraLabel={device.eraLabel} detail={device.detail} />

    /*
     * P14, the fast year odometer, and the second of the two year treatments.
     * The scene's own picture with four digit wheels rolling to the narration's
     * own `bareYear` mark, which `buildCopy` has already held to exactly four
     * digits — anything else and the pack's renderer would draw a different
     * year. `label` and `detail` are both '' and the component omits their
     * blocks; the pack's hardcoded verification tag is cut in the component. It
     * grades its own picture (`carriesOwnGrade`).
     */
    case 'P14':
      return <P14 src={src} targetYear={device.year} label={device.label} detail={device.detail} />

    case 'P17':
      return (
        <P17
          src={src}
          label={device.label}
          anchorX={device.anchorX}
          anchorY={device.anchorY}
          labelX={device.labelX}
          labelY={device.labelY}
        />
      )

    case 'P03':
      return (
        <P03
          src={src}
          kicker={device.kicker}
          headline={device.headline}
          highlightWords={device.highlightWords}
        />
      )

    /*
     * Saku's 05. The planner's one line over the scene's own picture. The
     * house grade goes on top, because `carriesOwnGrade` is false for it.
     */
    case 'shadow-up':
      return <ShadowUp src={src} line={device.line} pictureMove={pictureMove} />

    /*
     * P08, fullscreen source evidence. The scene's own picture in the pack's
     * gold frame. NO WORDS: the schema arm carries no string, so both text
     * props are handed empty and the component omits their blocks. It grades
     * its own picture, so the house grade stays off (`carriesOwnGrade`).
     */
    case 'P08':
      return <P08 src={src} sourceTag="" sourceDetail="" />

    /*
     * P04, the lower-left label. The scene's own picture with the plan's label
     * and support line, both already held to the ruling in `buildCopy`: spoken in
     * the shot and in the archive record. An empty support line is '' and the
     * component omits its block. It grades its own picture (`carriesOwnGrade`).
     */
    case 'P04':
      return <P04 src={src} mainLine={device.mainLine} supportLine={device.supportLine} />

    /*
     * P02, the editorial card. The scene's own picture with the plan's label and
     * headline on the pack's paper card, both already held in `buildCopy` to the
     * narration and to the width of the card. An empty label is '' and the
     * component omits its block. It grades its own picture (`carriesOwnGrade`).
     */
    case 'P02':
      return <P02 src={src} label={device.label} headline={device.headline} />

    /*
     * P09, the compact question card. The scene's own picture with the plan's
     * section label and question on the pack's translucent card, both already
     * held in `buildCopy` to the narration, to a question the narration really
     * asks, and to the width of the card. An empty label is '' and the component
     * omits its block. It grades its own picture (`carriesOwnGrade`).
     */
    case 'P09':
      return <P09 src={src} sectionLabel={device.sectionLabel} question={device.question} />

    /*
     * P05, text left and a picture right. The scene's own picture in the pack's
     * panel, square by R1, with the plan's eyebrow, headline and support line on
     * the pack's own ground beside it and the picture label inside it. All four
     * are already held in `buildCopy` to the narration, the label to the shot and
     * the archive record as well, and each to its measure. An empty line is ''
     * and the component omits its block. It grades its own picture
     * (`carriesOwnGrade`).
     */
    case 'P05':
      return (
        <P05
          src={src}
          eyebrow={device.eyebrow}
          headline={device.headline}
          supportLine={device.supportLine}
          imageLabel={device.imageLabel}
        />
      )

    /* ---- four pictures ---- */

    case 'P22': {
      /*
       * A 4-TUPLE, NOT AN ARRAY, so a missing picture is a compile error rather
       * than a black cell in the mosaic. The chooser's picture gate guarantees
       * three companions; this narrows the type without a cast.
       */
      const [a, b, c] = companionSrcs
      if (a === undefined || b === undefined || c === undefined) return null
      return <P22 cards={[{ src }, { src: a }, { src: b }, { src: c }]} />
    }

    case 'P19': {
      /*
       * FOUR PICTURES, AND THE FOURTH IS THE BOARD. The scene's own asset is
       * the background the three cards are pinned to; the companions are the
       * cards. The partner's registry says `sourceCount: 3` and lists four
       * assets — both are right about different things.
       */
      const [a, b, c] = companionSrcs
      if (a === undefined || b === undefined || c === undefined) return null
      return <P19 backgroundSrc={src} cards={[{ src: a }, { src: b }, { src: c }]} />
    }

    /*
     * ######################################################################
     * # THE TWO THE VISUAL PLANNER UNLOCKED, 2026-09-04.                    #
     * #                                                                    #
     * # Both were `enabled: false` for `needs-invented-copy` and both were  #
     * # therefore refused here as well — the three-way lock this file's own #
     * # header describes. Their components have been on disk and under      #
     * # their own clock tests since they were built; the only thing missing #
     * # was words nobody could honestly write. Stage 1c writes them         #
     * # upstream and freezes them into the plan under T-18.                  #
     * #                                                                    #
     * # THE BUNDLE COST WAS ALREADY PAID BY THE COMMIT THAT FLIPPED THE     #
     * # REGISTRY. `devices.ts` is one of the four subpaths this compositor  #
     * # imports, so `bundleHash` moved there; adding these two imports here #
     * # costs nothing further. Same argument as the box at the top.          #
     * ######################################################################
     */
    case 'bullet-checklist':
      /*
       * `items` rather than `rows`, and the names differ on purpose: the plan
       * calls them rows because that is what the schema slot is, and the
       * component calls them items because that is what the reference clip
       * labels them. Renaming either would touch a file the other owns.
       */
      return <BulletChecklist src={src} title={device.title} items={device.rows} />

    case 'two-photo-zoom': {
      /*
       * TWO PICTURES, and the second is the scene's one companion. `pictures: 2`
       * in the registry is what gate G2 counts, so reaching here without a
       * companion means the plan and the compositor disagree — a blank frame is
       * the honest way to say so, exactly as the `src === null` guard above is.
       */
      const [companion] = companionSrcs
      if (companion === undefined) return null
      return (
        <TwoPhotoZoom srcs={[src, companion]} captions={[device.left, device.right]} />
      )
    }

    /*
     * ---- a2, drawn but never chosen ----
     *
     * NO PHOTOGRAPH. The page is its own ground, so `src` is not read. The beat
     * still has to own one because the guard above returns null without it, and
     * that is the same fact the hand-placement check refuses on.
     */
    case 'highlight-page':
      return <HighlightPage paragraphs={device.paragraphs} phrases={device.phrases} />

    /*
     * ---- a3, drawn but never chosen ----
     *
     * NO PHOTOGRAPH. The title paints its own black ground and the warped grid,
     * so `src` is not read. The beat still has to own one because the guard
     * above returns null without it, and that is the same fact the
     * hand-placement check refuses on.
     */
    case 'chapter-title':
      return <ChapterTitle caption={device.caption} />

    /*
     * ---- Niku's three, 2026-09-14, all over the scene's own picture ----
     *
     * These sit with the one-picture group above in spirit, and are grouped
     * here only so his four stay together and readable. All three are
     * `pictures: 1` and `pictureSource: 'ownScene'`, so each draws the beat's
     * photograph at cover as its own first child.
     *
     * THE GRADE DIFFERS. `chapter-plate` and `corner-label` are
     * `carriesOwnGrade: false` and the house grade goes on top, exactly as
     * `shadow-up` does. `top-title` is `true` since 2026-09-17: it mounts the
     * same house grade itself, between its photograph and its type, because
     * the grade on top greyed and cooled his cream. See `TopTitle.tsx`.
     *
     * THE SECOND CHAPTER STYLE, and the reason it is a second device rather
     * than a restyle: `chapter-title` is capped at two per film by the client's
     * own written rule, and section detection finds about eight spots. Two ids
     * carry two caps.
     */
    /*
     * NO DEPTH PROP. This device carried a per-shot `washAlpha` for one day,
     * and the band it set the depth of is gone: the heading's ground travels on
     * its own glyphs now, fitted to the size the heading is set at, so there is
     * nothing per-shot for the plan to hand down. `ChapterPlate.tsx`'s own box
     * carries the numbers, and `corner-label` below has drawn the same way
     * since the same day.
     */
    case 'chapter-plate':
      return <ChapterPlate src={src} heading={device.heading} pictureMove={pictureMove} />

    case 'top-title':
      return (
        <TopTitle src={src} grade={grade} line1={device.line1} line2={device.line2} pictureMove={pictureMove} />
      )

    case 'corner-label':
      return <CornerLabel src={src} label={device.label} kicker={device.kicker} pictureMove={pictureMove} />

    /* ---- registered, disabled, and refused by the chooser before here ---- */
    case 'pointer-label':
    case 'name-card':
    /*
     * `name-plate` is Niku's fourth, and it is here rather than above for the
     * same reason `name-card` is: it prints a real person's NAME onto a
     * photograph, the client's own rule says the face shown must not be the
     * real one, and the question that settles that has been unanswered since
     * 23 August. Its component exists and is tested; nothing imports it.
     */
    case 'name-plate':
    case 'P13':
    case 'P16':
      /*
       * NOT `assertNever`, because these ARE members of the union — they are
       * registered so the schema round-trips, and so any frozen plan that
       * carries one still parses. The device that was briefly enabled and so
       * could sit in a frozen plan, `chapter-title`, is drawn above since
       * 2026-09-11. `enabled: false` in the registry is what stops the chooser
       * ever returning these four, and returning null here means a plan that
       * somehow carries one falls back to the ordinary shot rather than
       * drawing a half-fed device.
       */
      return null

    default:
      return assertNever(device)
  }
}
