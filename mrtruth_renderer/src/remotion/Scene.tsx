import { TypedCaption } from './TypedCaption.js'
import { CinemaTurn } from './CinemaTurn.js'
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { SourcedImg as Img } from './SourcedImg.js'
import type { ReactNode } from 'react'
import { DEVICE_REGISTRY } from '@vg/core/devices'
import {
  ambienceClipById,
  ambienceClipFrameIndex,
  ambienceClipFramePath,
  overlayClipById,
  overlayClipFramePath,
} from '@vg/core/effects'
import type { AmbienceClip, OverlayClip } from '@vg/core/effects'
import { maxTravelForCrop } from '@vg/core/motion'
import type { AssetVision, Crop, PlannedScene } from '@vg/core/schemas'
import { ArchivePlate } from './ArchivePlate.js'
import { CaptionScrim, Captions } from './Captions.js'
import { pushCut } from '@remotion/transitions/push-cut'
import { slide } from '@remotion/transitions/slide'
import {
  FLASH,
  FLASH_STREAK_GRADIENT,
  GRADE,
  PUSH_CUT_CUT_PROGRESS,
  PUSH_CUT_FLASH_COLOUR,
  PUSH_CUT_FLASH_FRAMES,
  PUSH_CUT_FLASH_PEAK,
} from './constants.js'
import { useDocumentaryFont } from './fonts.js'
import { Grade } from './Grade.js'
import { Posed } from './KenBurns.js'
import type { Pose } from './KenBurns.js'
import { DeviceFrame, deviceCarriesOwnGrade } from './DeviceFrame.js'
import { Overlay } from './Overlay.js'
import { TextCard } from './TextCard.js'
import type { OverlayVariant, SegmentProps } from './props.js'

/**
 * One segment.
 *
 * Every segment renders in isolation and in any order — that is what makes the
 * render cache sound and the V2 editor affordable. So nothing in here may depend
 * on a neighbouring segment's OUTPUT; it may only depend on the plan.
 *
 * ####################################################################
 * # PLAN C1 — THE TRANSITION IS BAKED INTO THE INCOMING SEGMENT.      #
 * #                                                                   #
 * # A crossfade needs two pictures. Rather than have the concat step  #
 * # blend two rendered files (which would make every segment depend   #
 * # on its neighbour's pixels), the OUTGOING image is composited      #
 * # inside THIS segment for `transitionIn.durationFrames`, using the  #
 * # pose the plan recorded in `prevAsset`. Everything needed is in    #
 * # the plan, so segment order never matters and concat stays a plain #
 * # stream copy.                                                      #
 * #                                                                   #
 * # The outgoing image sits ON TOP and fades to zero over a stationary#
 * # incoming layer. A symmetric dissolve (both at 50% mid-way) dips   #
 * # the luminance in the middle of every cut; this does not.          #
 * ####################################################################
 *
 * Layer order, bottom to top:
 *   black · visual · outgoing image (transition) · grade · ambience shadow ·
 *   ambience plate (screen) · scrim · captions · overlay · dip-to-black ·
 *   flash · pushCut flash · light burn (screen)
 *
 * The ambience shadow is DIRECTLY under the plate and that adjacency is load
 * bearing, not tidiness: the plate is screened, so it adds light in proportion
 * to how dark the backdrop under it already is. See the box on `AmbienceShadow`.
 *
 * The two screened clips sit at OPPOSITE ends of the type, and that is not an
 * oversight. The burn is a whole-frame flare across a cut and draws over
 * everything; the plate runs for the whole shot and draws under everything that
 * has to stay readable for the whole shot. See the box on each. THE ONE
 * EXCEPTION IS THE DEVICE BRANCH, where the plate sits above the device's own
 * type (lever 1, 2026-09-18): see the box above `AmbienceShadow` there.
 *
 * The scrim and the captions are ONE conditional layer, not two. See the guard
 * below.
 *
 * WHERE THE OVERLAY GOES, AND WHY IT IS THE SECOND LAYER FROM THE TOP.
 *
 * ABOVE the grade, for the same reason the captions are: type is a graphic
 * element, not part of the photograph, so it takes neither the grain nor the
 * vignette. Under the grade it would be dirtied and darkened by both, which is
 * how you get grey words on a pale scan.
 *
 * ABOVE the outgoing crossfade picture too, and that one is not free: a scene's
 * frame 0 can be mid-dissolve, so the overlay's own gradient would appear on top
 * of the transition. It fades in over the first six frames rather than snapping
 * on for exactly that case — see `Overlay.tsx`.
 *
 * BELOW the dip to black, because a dip is the whole frame going away and
 * nothing may survive it. That is the one layer this device must not fight, and
 * it is why it goes second from the top rather than last.
 */

export function Scene({
  scene,
  assetSrc,
  prevAssetSrc,
  textCardBackgroundSrc,
  companionSrcs,
  overlayVariant,
  overlayTreatment,
}: SegmentProps): ReactNode {
  // Holds the first frame of the segment until the typeface is registered, so
  // captions and text cards are never measured against a fallback metric set.
  // Bounded and never fatal — see `fonts.ts`.
  useDocumentaryFont()

  /*
   * ########################################################################
   * # THE DEVICE BRANCH, AND IT IS AN EARLY RETURN RATHER THAN A LAYER.    #
   * #                                                                      #
   * # A device draws its OWN complete composition — its own layout, its    #
   * # own type, and for the partner's templates its own colour treatment.  #
   * # So `Visual`, the captions, the overlay and the Ken Burns wrapper are #
   * # all SUPPRESSED, not dimmed and not layered under. Leaving any of     #
   * # them on puts two blocks of type on one frame, which is the defect    #
   * # every guard below this exists to prevent.                            #
   * #                                                                      #
   * # THE GUARD IS TWO-PART ON PURPOSE. TypeScript cannot narrow           #
   * # `assetSrc` from `scene.device`, so testing only the device would     #
   * # force either a non-null assertion or a device drawn with an empty    #
   * # `src`, which is a partial frame at exit 0. Testing both narrows      #
   * # `assetSrc` to `string` for free, and the fall-through is a frame     #
   * # that already works.                                                  #
   * #                                                                      #
   * # `TransitionIn` is NOT mounted, and the chooser's gate is what makes  #
   * # that safe: it admits only `cut`, and `TransitionIn` returns null for #
   * # anything but a crossfade. The two agree by construction. LOOSEN THAT #
   * # GATE AND THIS BRANCH MUST MOUNT IT IN THE SAME CHANGE.               #
   * #                                                                      #
   * # `DipToBlack` and `Flash` DO stay: a dip is the whole frame going     #
   * # away and nothing may survive it. They draw nothing today, because    #
   * # the same gate admits only `cut` — they are here so that a later      #
   * # phase which loosens it does not also silently lose them.             #
   * ########################################################################
   *
   * The hook above runs on both paths, so hook order is stable and the device
   * gets the same font gate the rest of the film does.
   */
  /*
   * ##########################################################################
   * # THE `assetSrc !== null` HALF IS A TYPE NARROWING, AND IT WAS ALSO A     #
   * # SECOND, UNDOCUMENTED PICTURE GATE. T-17.                               #
   * #                                                                        #
   * # Every device but one draws the scene's own photograph, so requiring one #
   * # here cost nothing and read as obviously right. `gallery-strip` is       #
   * # `pictureSource: 'filmPreview'` — its four cards are photographs the FILM #
   * # draws later, and its carrier beat may own none at all. Read as written, #
   * # this line refuses it even when the chooser has placed it, and the shot  #
   * # falls through to an ordinary scene with no error anywhere.              #
   * #                                                                        #
   * # So the narrowing stays for every device that needs it, and the one that #
   * # does not is admitted explicitly by name rather than by loosening the    #
   * # guard for all seventeen.                                               #
   * ##########################################################################
   */
  const devicePicturesAreItsOwn =
    scene.device === null || DEVICE_REGISTRY[scene.device.id].pictureSource === 'ownScene'
  if (scene.device !== null && (assetSrc !== null || !devicePicturesAreItsOwn)) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        {/*
          THE PLAN'S MOVE GOES IN WITH THE PICTURE, NOT AROUND THE DEVICE.
          Lever 4, 2026-09-19: the four client animations that draw the
          photograph full frame and untouched (shadow-up, chapter-plate,
          top-title, corner-label) froze once their type landed. The planner
          now writes Saku's slow push-in into `scene.motion` for exactly those
          four, and `DeviceFrame` hands it to them alone, where it moves their
          `<Img>` and nothing else. The type never moves, and nothing above the
          dust plate gains a transform, so its screen blend is not isolated.
        */}
        <DeviceFrame
          device={scene.device}
          src={assetSrc}
          companionSrcs={companionSrcs}
          grade={scene.grade}
          pictureMove={{ motion: scene.motion, durationFrames: scene.durationFrames }}
        />

        {/*
          THE HOUSE GRADE IS A PER-DEVICE FACT, NOT A PER-BRANCH ONE.

          The partner's templates apply their own CSS filter to the picture, so
          grading again matches neither his preview nor the film. The client's
          own animations apply nothing, so skipping it would ship those shots
          with no tone curve, no toe lift, no grain and no vignette while the
          other ninety have all four. See `deviceCarriesOwnGrade`.
        */}
        {!deviceCarriesOwnGrade(scene.device) && <Grade grade={scene.grade} />}

        {/*
          THE PARTICLE PLATE, MOUNTED HERE FOR THE SAME PARITY REASON THE DIP,
          THE FLASH AND THE LIGHT BURN ARE MOUNTED ON THIS BRANCH.

          This branch is an EARLY RETURN. A layer added only to the ordinary
          branch below is not "off for devices", it is silently absent, and the
          next person to widen the planner's rule has no way to find that out
          except by watching a two-hour render. The two boxes above this one
          record the same lesson twice.

          IT DRAWS SINCE LEVER 1 (2026-09-18). The worker's `assignAmbience`
          gives the dust first claim on the client's animations that freeze
          once their type lands (`STILL_PICTURE_DEVICES` in plan.ts), because
          those broke Saku's "something needs to be happening in each frame".

          HERE THE PLATE SITS ABOVE THE DEVICE'S OWN TYPE, unlike the ordinary
          branch below, and that was measured and accepted rather than missed.
          The type is near-white and screen cannot brighten white: on V57's
          eight long frozen shots the specks lifted at most 25 letter pixels a
          frame. The SHADOW is the half that would hurt, because a vignette
          subtracts and greyed the first capitals by up to 35 luma, so the
          planner never writes one on a device shot and T-25 names any that
          appears. Moving the plate under the type would mean reaching inside
          every device, which is why it stays here.
        */}
        <AmbienceShadow scene={scene} />
        <AmbienceLayer scene={scene} />
        <TypedCaption scene={scene} />

        <DipToBlack scene={scene} />
        <Flash scene={scene} />
        {/*
          The light burn, for the same parity reason as the two above. Rule 7
          gives a device and its follower hard cuts, so neither half draws here
          today; mounted so a later phase that loosens it cannot lose the burn.
        */}
        <OverlayClipLayer scene={scene} side="out" />
        <OverlayClipLayer scene={scene} side="in" />
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <PresetTransition scene={scene} prevAssetSrc={prevAssetSrc}>
        <CinemaTurn scene={scene}>
          <Visual
            scene={scene}
            assetSrc={assetSrc}
            textCardBackgroundSrc={textCardBackgroundSrc}
            overlayVariant={overlayVariant}
          />
        </CinemaTurn>
      </PresetTransition>

      <TransitionIn scene={scene} prevAssetSrc={prevAssetSrc} />

      <Grade grade={scene.grade} />

      {/*
        THE PARTICLE PLATE, ABOVE THE GRADE AND BELOW EVERY PIECE OF TYPE.

        ####################################################################
        # ABOVE `Grade`, FOR THE REASON THE FLASH'S BOX BELOW GIVES.       #
        #                                                                  #
        # `Grade` is a sibling over the picture applying a backdrop-filter #
        # contrast and a vignette. A screened plate mounted UNDER it comes #
        # out dimmer at the corners than in the middle and its white is    #
        # not white, so the motes would fade toward the frame edge — which #
        # is exactly where this plate puts its soft bokeh circles.         #
        ####################################################################

        ####################################################################
        # BELOW THE CAPTIONS AND BELOW THE MARK, AND THIS IS THE ONE PLACE #
        # IT DIFFERS FROM NIKU'S BURN.                                      #
        #                                                                  #
        # The burn draws LAST, above the type, deliberately and with a     #
        # comment saying so: the preview he approved was screened over the #
        # finished film, and a white flare across a cut is a whole-frame   #
        # event that nothing should survive.                                #
        #                                                                  #
        # A plate is the opposite kind of thing. It runs for the WHOLE     #
        # shot, so anything it sits on top of, it sits on top of for the   #
        # whole shot. Dust drawn over a date mark is not a flare across a  #
        # cut, it is specks on the lettering for three seconds — and       #
        # `screen` only ADDS light, so it would lift the type's own dark   #
        # edge and soften the very contrast the caption scrim exists to    #
        # guarantee.                                                        #
        #                                                                  #
        # MOUNTING IT HERE MAKES LEGIBILITY STRUCTURAL RATHER THAN A       #
        # JUDGEMENT. The scrim, the captions and `Overlay` are composited  #
        # AFTER this element and are not blended with it, so the type is   #
        # drawn at full strength over the plate exactly as it is drawn     #
        # over the photograph. There is no setting of this plate that can  #
        # make a title less legible, because no pixel of the title is the  #
        # plate's to touch. `scene.test.ts` pins the ordering.             #
        ####################################################################

        BELOW the dip to black too, for the reason the overlay's box gives: a
        dip is the whole frame going away and nothing may survive it.

        A DIRECT CHILD OF THIS ROOT, never inside `PresetTransition`. See the
        blend trap on `AmbienceLayer`.
      */}

      {/*
        THE "shadow" HALF OF HIS SECOND VARIANT, IMMEDIATELY UNDER THE PLATE.

        ####################################################################
        # THIS LINE MUST STAY ABOVE THE `<AmbienceLayer />` BELOW IT.      #
        #                                                                  #
        # Screen adds (1-a)*b, so a mote lands on the BACKDROP `a` that is #
        # already painted. Darkening under the plate lowers `a` and the    #
        # motes gain; darkening over the plate multiplies the motes too,   #
        # and the effect is exactly nothing. Swap these two lines and this #
        # layer becomes a pure cost. `scene.test.ts` pins the order.       #
        ####################################################################

        It sits ABOVE `Grade` for the same reason the plate does, and that also
        puts it immediately on top of the grade's OWN vignette, which every shot
        already carries at alpha 0.300. The two are concentric, share an inner
        stop, and multiply — see `ambienceShadowBackground`.
      */}
      <AmbienceShadow scene={scene} />
      <AmbienceLayer scene={scene} />

      {/*
        THE SCRIM AND THE CAPTIONS SHARE ONE GUARD, and that is the point of the
        fragment. The scrim used to mount outside this condition, which was
        correct while every scene had captions. With CAPTIONS_ENABLED off
        (`apps/worker/src/env.ts` — the client waived captions) the planner emits
        an empty `captions` array for all 91 scenes, and an unconditional scrim
        then paints a 408px dark band across the bottom of every shot with
        nothing inside it. That does not read as a deliberate look; it reads as
        subtitles that failed to render.

        Binding them together means the two can never disagree about whether
        there is anything down there to make legible.

        Text cards suppress captions. Two blocks of type in one frame is fatal —
        the eye cannot decide which is the subject. The planner already empties
        `captions` whenever it builds a card; this is the second lock, and it
        asks `showsTextCard` — the same question `Visual` asks — so the two can
        never disagree about whether a card is on screen. The card draws its own
        ground, so it never wanted the scrim either.
      */}
      {!showsTextCard(scene, assetSrc, textCardBackgroundSrc) && scene.captions.length > 0 && (
        <>
          <CaptionScrim />
          <Captions phrases={scene.captions} />
        </>
      )}
      <TypedCaption scene={scene} />

      {/*
        THE OVERLAY, AND EVERY CONDITION HERE IS A SECOND LOCK.

        The planner already refuses to put an overlay on a scene that shows a
        card or prints a caption band (`buildSceneDrafts` in
        apps/worker/src/stages/plan.ts), so in a real render `scene.overlay` is
        non-null only when these already hold. They are restated for the same
        reason the caption guard restates its own: the two devices must never
        share a frame, and a guarantee made in one process and relied on in
        another is a guarantee that will eventually be wrong.

        ####################################################################
        # THE MIDDLE TERM IS "IS THERE A PICTURE", AND IT USED TO BE       #
        # `assetSrc !== null`, WHICH IS A DIFFERENT QUESTION ON A HELD     #
        # SHOT.                                                            #
        #                                                                  #
        # A held scene has no asset of its own — `render.ts` passes        #
        # `assetSrc: null` — and draws the previous shot's photograph      #
        # through `textCardBackgroundSrc`. So the old term refused a mark  #
        # on a shot that is showing a picture, which is why the planner    #
        # could not put a date on one. Asking about EITHER source keeps the#
        # rule the comment always claimed: an overlay is words ON a        #
        # photograph, and with no picture under it, it IS the separate     #
        # full-screen text scene the client asked us to stop showing him.  #
        ####################################################################
      */}
      {scene.overlay !== null &&
        (assetSrc !== null || textCardBackgroundSrc !== null) &&
        !showsTextCard(scene, assetSrc, textCardBackgroundSrc) && (
          <Overlay
            overlay={scene.overlay}
            // The SCENE's length, not the composition's, for the reason `TextCard`
            // takes the same argument — and here it also decides whether the
            // device animates, holds static or is refused outright.
            durationFrames={scene.durationFrames}
            /*
             * A GUARD NOW, NOT A SOURCE. No style reads this as a picture any
             * more — `plate` used to redraw it small on black and stopped on
             * 2026-08-16, when it became the title set over the photograph
             * `Visual` already drew.
             *
             * It is still passed because it is still the question "does this
             * scene have a photograph OF ITS OWN under this type", which the
             * title needs asked: a title is the film's one opening mark and it
             * belongs on the shot that sourced its own picture, never on an
             * inherited one. That is why this stayed `assetSrc` while the mount
             * condition above widened.
             */
            assetSrc={assetSrc}
            /*
             * WHERE THE SUBJECT OF THE PICTURE IS, which is what chooses the
             * corner. `scene.asset.vision`, never `scene.crop.anchor`, and the
             * reason is now STRONGER than the one that used to stand here.
             *
             * This used to read "`chooseCrop` only moves that anchor off 0.5 for
             * a picture cropped horizontally, and it is 0.5 on all 87 scenes of
             * the delivered plan". The 87-scene plan was `PLAN-v7-2026-08-16`;
             * the delivered film is `tmp/plan-V22-final.json`, 166 scenes, and
             * there `crop.anchor.x` is off 0.5 on TWO of them. Still useless as
             * a corner signal, still for the same reason.
             *
             * AND IT IS NO LONGER EVEN ONE QUANTITY. `chooseCrop` now answers a
             * different question per mode: for `fill` the anchor is which part
             * of an oversized picture survives the crop, and for `blurPillarbox`
             * and `letterbox` it is where a whole picture SITS in the ground
             * beside it — a placement, already solved backwards from the subject
             * by `placeInGround`. Reading either as "where the subject is" is
             * wrong, and reading the second one that way is wrong in a direction
             * that moves. `vision.subjectAnchor` is the only field that means
             * what this rule needs, on every mode.
             *
             * Null on a HELD shot, and correctly so: the picture belongs to the
             * previous scene and the plan does not carry its vision record
             * (`Visual` below says the same thing about the archive plate's
             * ground tint). No subject means no corner, and the mark takes the
             * delivered block.
             */
            vision={scene.asset?.vision ?? null}
            treatment={overlayTreatment}
          />
        )}

      <DipToBlack scene={scene} />
      {/*
        BESIDE the dip and ABOVE `Grade`, not below it. `Grade` is a sibling over
        the picture that applies a `backdrop-filter` contrast and a vignette; a
        bloom mounted under it would come out dimmer at the corners than in the
        middle and its white would not be white.
      */}
      <Flash scene={scene} />
      {/*
        THE PUSHCUT'S FLASH IS DRAWN HERE, BY US, AND NOT BY THE PRESET.

        `push-cut.js` paints its own `#f5f2ed` sheet INSIDE its wrapper, which in
        our stack sits UNDER `Grade`. That is the same defect the box above
        records for the bloom: a sheet under a `backdrop-filter` contrast and a
        vignette comes out dimmer at the corners than in the middle, and its
        white is not white. So the preset is handed `flashOpacity: 0` and the
        sheet is mounted out here beside `<Flash>`, above `Grade`.
      */}
      <PushCutFlash scene={scene} />
      {/*
        NIKU'S LIGHT BURN, LAST OF ALL, AND AS DIRECT CHILDREN OF THIS ROOT.

        Above `Grade` so its white is white, and above the type because the
        preview he approved was screened over the finished film. The outgoing
        half draws on this shot's last frames and the incoming half on its first;
        a shot carries at most one of each. See `OverlayClipLayer` for why no
        wrapper may ever sit between these images and this element.
      */}
      <OverlayClipLayer scene={scene} side="out" />
      <OverlayClipLayer scene={scene} side="in" />
    </AbsoluteFill>
  )
}

/**
 * WHICH FRAME OF A LIGHT-BURN CLIP THIS SEGMENT DRAWS, OR NULL.
 *
 * ##########################################################################
 * # TWO HALVES, AND THE ARITHMETIC IS WHAT PUTS THE WHITE-OUT ON THE CUT.  #
 * #                                                                        #
 * #   'out'  the shot's last `transitionOut.durationFrames` draw the clip's  #
 * #          opening frames, ending on `leadFrames - 1` at its last frame   #
 * #   'in'   the shot's first `transitionIn.durationFrames` draw from        #
 * #          `leadFrames` upward, so its frame 0 is the first white-out     #
 * #                                                                        #
 * # Both sides are anchored to the CUT, not to their own window start, so  #
 * # a half that was ever shorter than its clip half would drop frames away #
 * # from the cut rather than slide the peak off it. The planner never      #
 * # shortens one, and `assertPlanInvariants` and T-24 refuse a plan that   #
 * # does.                                                                  #
 * ##########################################################################
 *
 * Exported only so `scene.test.ts` can pin the arithmetic without a Player.
 */
export function overlayClipFrame(
  scene: PlannedScene,
  frame: number,
  side: 'in' | 'out',
): { readonly clip: OverlayClip; readonly index: number } | null {
  if (side === 'in') {
    const { transitionIn } = scene
    if (transitionIn.type !== 'filmBurn') return null
    const clip = overlayClipById(transitionIn.clip)
    if (clip === null) return null
    if (frame < 0 || frame >= transitionIn.durationFrames) return null
    const index = clip.leadFrames + frame
    return index < clip.frameCount ? { clip, index } : null
  }

  const { transitionOut, durationFrames } = scene
  if (transitionOut === null || transitionOut.type !== 'filmBurn') return null
  const clip = overlayClipById(transitionOut.clip)
  if (clip === null) return null
  if (frame < durationFrames - transitionOut.durationFrames || frame >= durationFrames) return null
  const index = clip.leadFrames - (durationFrames - frame)
  return index >= 0 ? { clip, index } : null
}

/**
 * Niku's light burn: one full-range JPEG per frame, screened over everything.
 *
 * ##########################################################################
 * # THE `<img>` IS A DIRECT CHILD OF THE SEGMENT ROOT, AND IT MUST STAY    #
 * # ONE. THIS IS THE BLEND TRAP.                                           #
 * #                                                                        #
 * # `mix-blend-mode` blends against what is already painted inside the     #
 * # nearest ISOLATED GROUP. Wrap this image in anything that carries        #
 * # opacity, transform, filter or will-change and that wrapper becomes the  #
 * # group: the image blends against an empty layer, `screen` over nothing  #
 * # is the image itself, and the clip's black floor paints an opaque black  #
 * # box over the shot for every frame of the burn. Mounting it inside       #
 * # `PresetTransition` would do exactly that. The mount test walks every    #
 * # ancestor up to the root and refuses any of the four.                   #
 * #                                                                        #
 * # `SourcedImg`, so a slow frame retries and a missing one fails the      #
 * # segment loudly. `staticFile`, because the frames ride in the bundle    #
 * # from `apps/web/public/fx`, the way the fonts do, and so they are in    #
 * # `bundleHash`: swap a frame and the right segments re-render.           #
 * ##########################################################################
 */
function OverlayClipLayer({ scene, side }: { scene: PlannedScene; side: 'in' | 'out' }): ReactNode {
  const frame = useCurrentFrame()
  const hit = overlayClipFrame(scene, frame, side)
  if (hit === null) return null

  return (
    <Img
      src={staticFile(overlayClipFramePath(hit.clip, hit.index))}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        mixBlendMode: hit.clip.blend,
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * WHICH FRAME OF AN AMBIENCE PLATE THIS SEGMENT DRAWS, OR NULL.
 *
 * ##########################################################################
 * # ONE BRANCH, NOT TWO, AND MODULO RATHER THAN AN OFFSET FROM A CUT.      #
 * #                                                                        #
 * # `overlayClipFrame` above has an 'in' half and an 'out' half because a  #
 * # burn straddles a join and its peak has to land ON the cut. A plate     #
 * # belongs to no join: it starts at this shot's own frame 0 and wraps, so #
 * # there is nothing to anchor and nothing to split. A shot of any length  #
 * # is covered, and the same shot renders the same frames in isolation and #
 * # in any order, which is the rule the whole segment cache rests on.      #
 * ##########################################################################
 *
 * Exported only so `scene.test.ts` can pin the arithmetic without a Player.
 */
export function ambienceFrame(
  scene: PlannedScene,
  frame: number,
): { readonly clip: AmbienceClip; readonly index: number } | null {
  const ambience = scene.ambience ?? null
  if (ambience === null) return null
  const clip = ambienceClipById(ambience.clip)
  if (clip === null) return null
  /*
   * `ambience.durationFrames`, NOT `scene.durationFrames`, on purpose. The plan
   * states the plate's length and T-25 checks that statement against the scene;
   * reading the scene here instead would make the gate check a number the
   * drawer never looks at, which is a gate that passes while the film is wrong.
   */
  if (frame < 0 || frame >= ambience.durationFrames) return null
  const index = ambienceClipFrameIndex(clip, frame)
  return index === null ? null : { clip, index }
}

/**
 * THE CORNER ALPHA OF THIS SHOT'S "shadow" ON THIS FRAME, OR NULL FOR NONE.
 *
 * ##########################################################################
 * # IT IS GATED ON THE PLATE DRAWING ON THIS VERY FRAME, WHICH IS THE       #
 * # DEVELOPER'S READING OF HIS OWN TWO NAMES MADE EXACT.                    #
 * #                                                                        #
 * # He wrote "ashes and ashes + shadow". Both names begin with ashes, so    #
 * # the vignette never appears alone — and "alone" has to mean per FRAME,   #
 * # not per shot. `ambience.durationFrames` is a number the plan states and #
 * # a hand-edited plan may state short: a 60-frame plate on a 132-frame     #
 * # shot leaves 72 frames with no specks on them. A shadow gated only on    #
 * # the shot would darken those 72 frames' corners with nothing drifting    #
 * # over them, which is the one combination he never asked for, and it      #
 * # would pop off mid-shot when the plate ran out.                          #
 * #                                                                        #
 * # Delegating to `ambienceFrame` also means the two layers cannot disagree #
 * # about the unknown-clip case: a plan naming a plate this build has no    #
 * # frames for draws neither specks nor shadow, rather than a bare          #
 * # darkening. `scene.test.ts` pins both.                                   #
 * #                                                                        #
 * # `shadow` 0 is the FIRST variant, a real answer and not a missing one,   #
 * # so it returns null here and mounts nothing.                             #
 * ##########################################################################
 *
 * Exported so `scene.test.ts` can pin the gating without a Player.
 */
export function ambienceShadowAlpha(scene: PlannedScene, frame: number): number | null {
  if (ambienceFrame(scene, frame) === null) return null
  const shadow = scene.ambience?.shadow ?? 0
  return shadow > 0 ? shadow : null
}

/**
 * THE VIGNETTE, AS ONE CSS RADIAL GRADIENT AND NOTHING ELSE.
 *
 * ##########################################################################
 * # NO FRAMES, NO IMPORT, NOTHING ADDED TO `public/`. A gradient is a       #
 * # string. The dust plate costs 360 JPEGs and 23.55 MB because it is       #
 * # genuinely photographic; a soft corner falloff is not, and shipping it   #
 * # as frames would be a self-inflicted second 24 MB in the repo, in the    #
 * # bundle, and on the wire to the box for a shape four numbers describe.   #
 * ##########################################################################
 *
 * ##########################################################################
 * # THE SAME INNER STOP AS `Grade`'s VIGNETTE, AND THAT IS WHAT STOPS IT    #
 * # LOOKING LIKE A RING.                                                    #
 * #                                                                        #
 * # `Grade` already draws one of these on every shot at 55% and alpha       #
 * # 0.300. Two black gradients composited source-over MULTIPLY, so with the #
 * # SAME inner stop the pair is (1-A*t)(1-B*t) over one shared ramp `t` —   #
 * # a single smooth curve with one knee. Give this layer a different inner  #
 * # stop and the combined falloff gains a second knee, a slope break at a   #
 * # fixed radius, which is visible on a flat sky as a faint ring. So the    #
 * # stop is READ from `GRADE` rather than restated: the two cannot drift    #
 * # apart, because there is only one of them.                               #
 * #                                                                        #
 * # `ellipse at center` with no explicit size is farthest-corner, so 100%   #
 * # is the frame's own corner at any aspect. That is what makes the         #
 * # measured corner ratio a corner ratio.                                   #
 * ##########################################################################
 *
 * Returned as DATA, for the reason `houseCurveLayerStyle` in `Grade.tsx` is:
 * a mounted DOM can show the string once, but only calling this in node shows
 * that the shape is fixed and the alpha is the only thing a scene may vary.
 */
export function ambienceShadowBackground(alpha: number): string {
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) ${String(GRADE.vignetteInnerStop * 100)}%, rgba(0,0,0,${String(alpha)}) 100%)`
}

/**
 * The "shadow" half of the client's second variant: a soft darkening toward the
 * edges of the frame, drawn UNDER the plate and under every piece of type.
 *
 * ##########################################################################
 * # UNDER THE PLATE, AND THIS IS THE WHOLE REASON THE LAYER EXISTS.        #
 * #                                                                        #
 * # The plate is screened, and screen is 1-(1-a)(1-b): a mote ADDS          #
 * # (1-a)*b to the backdrop `a`. Mounted ABOVE the plate this vignette      #
 * # would multiply the motes it is there to reveal — it would darken the    #
 * # specks and the picture equally and change nothing about whether they    #
 * # can be seen. Mounted BELOW, it lowers `a` BEFORE the screen, so each    #
 * # mote lands on a darker backdrop and adds more of itself. Measured, the  #
 * # plate lifts 22,573 pixels by 8 or more on the darkest of three real     #
 * # frames against 5,966 on the brightest; this layer is how a bright shot  #
 * # is given some of that dark to sit on.                                   #
 * #                                                                        #
 * # So the order is not a preference. Above the plate this component is     #
 * # pointless, and `scene.test.ts` pins it below.                           #
 * ##########################################################################
 *
 * ##########################################################################
 * # AND UNDER THE TYPE, EXACTLY AS THE PLATE IS, ON THE ORDINARY BRANCH.    #
 * # On the device branch both sit above the device's own type, which is   #
 * # why the planner never gives a device shot this layer (lever 1).       #
 * #                                                                        #
 * # The scrim, the captions and `Overlay` composite AFTER this element and  #
 * # are not blended with it, so no pixel of a caption, a date mark or a     #
 * # title is this layer's to touch. That is the same structural argument    #
 * # the plate's own box makes, and it matters more here: the plate can only #
 * # ADD light, so its worst case on lettering is a slightly lifted edge,    #
 * # while a vignette SUBTRACTS and would put grey corners on white type.    #
 * # Being below the type means there is no setting of this layer that can   #
 * # do that.                                                                #
 * ##########################################################################
 *
 * A PLAIN `background`, NO `mixBlendMode`, so it is not subject to the blend
 * trap the box on `AmbienceLayer` describes. Source-over black at alpha `a`
 * gives base*(1-a) against whatever is already painted, which is what makes it
 * multiply cleanly with the grade's vignette.
 */
function AmbienceShadow({ scene }: { scene: PlannedScene }): ReactNode {
  const frame = useCurrentFrame()
  const alpha = ambienceShadowAlpha(scene, frame)
  if (alpha === null) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: ambienceShadowBackground(alpha),
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * The particle plate: one full-range JPEG per frame, screened over the graded
 * photograph and UNDER every piece of type on the frame. On the device branch
 * it sits above the device's own type instead, measured and accepted: see the
 * box above `AmbienceShadow` on that branch.
 *
 * ##########################################################################
 * # THE `<img>` IS A DIRECT CHILD OF THE SEGMENT ROOT, AND IT MUST STAY    #
 * # ONE. THE SAME BLEND TRAP THE LIGHT BURN'S BOX DESCRIBES.               #
 * #                                                                        #
 * # `mix-blend-mode` blends against what is already painted inside the     #
 * # nearest ISOLATED GROUP. Wrap this in anything carrying opacity,        #
 * # transform, filter or will-change and that wrapper becomes the group:   #
 * # the image blends against an empty layer, `screen` over nothing is the  #
 * # image itself, and the plate's black ground paints an opaque black box  #
 * # over the picture for the WHOLE SHOT. For the burn that defect lasts 26 #
 * # frames; here it is the entire shot, so the rule matters more, not      #
 * # less.                                                                  #
 * ##########################################################################
 */
function AmbienceLayer({ scene }: { scene: PlannedScene }): ReactNode {
  const frame = useCurrentFrame()
  const hit = ambienceFrame(scene, frame)
  if (hit === null) return null

  return (
    <Img
      src={staticFile(ambienceClipFramePath(hit.clip, hit.index))}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        mixBlendMode: hit.clip.blend,
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * The single encoding of "this segment is showing a text card".
 *
 * `Visual` and the caption guard MUST agree, and there is exactly ONE reason a
 * card is drawn now: there is no picture to draw instead. `sceneType` has
 * nothing to do with it. The `sceneType === 'titleCard'` arm that used to be
 * here forced a full-frame blurred card over a photograph the sourcing stage had
 * already found, which is the separate text scene the client asked us to stop
 * showing him. Its original purpose survives in the half that remains: a scene
 * whose image sourcing fell back draws its card, and reading `sceneType` alone
 * missed that, printing the narration twice — once as the card, once as the
 * caption track.
 *
 * ####################################################################
 * # THE THIRD ARGUMENT IS NOT A REFINEMENT. IT IS THE HALF THAT WAS   #
 * # MISSING, AND WITHOUT IT THE PLANNER'S NEW DATE MARK ON A HELD     #
 * # SHOT WOULD BE HASHED INTO EVERY RENDER KEY AND DRAW NOTHING.      #
 * #                                                                   #
 * # "No picture to draw instead" was spelled `assetSrc === null`, and #
 * # on a HELD scene that is false about the frame: the scene has no   #
 * # asset of its own, so `render.ts` passes null, but the previous    #
 * # shot's photograph is coming through `textCardBackgroundSrc` and   #
 * # is the whole of what is on screen. `Visual` already knew this and #
 * # drew the inherited picture; this predicate did not, and so said   #
 * # "a card is showing" about a frame that is a photograph.           #
 * #                                                                   #
 * # A GUARD WRAPPED AROUND THIS FUNCTION CANNOT FIX THAT. It would    #
 * # evaluate identically on every shot type in the film, because the  #
 * # thing that is wrong is the answer, not where it is asked.         #
 * ####################################################################
 *
 * `assetSrc`, not `scene.asset`, because the resolved URL is what decides
 * whether `Visual` can actually draw a picture (`render.ts:107` derives one from
 * the other, so they agree in production, and Studio may hand over a scene whose
 * asset resolves to nothing). `textCardBackgroundSrc` is resolved the same way
 * from `scene.textCard.backgroundAssetPath`, so it is non-null only when the
 * card exists — which is why the first term is a restatement in production and a
 * real guard in Studio.
 *
 * Exported only so `scene.test.ts` can pin it. Nothing outside this file renders
 * from it, and nothing should: a second caller elsewhere would be a third opinion
 * about what is on screen, which is the exact failure this function exists to end.
 */
export function showsTextCard(
  scene: PlannedScene,
  assetSrc: string | null,
  textCardBackgroundSrc: string | null,
): boolean {
  return scene.textCard !== null && assetSrc === null && textCardBackgroundSrc === null
}

/**
 * The other half of the same reading: this segment is drawing the PREVIOUS
 * shot's photograph because it has none of its own.
 *
 * Stated as its own predicate rather than left inline, because it and
 * `showsTextCard` partition the pictureless scenes between them and the pair has
 * to stay exhaustive. A scene with no asset either inherits a picture (this) or
 * has nothing to inherit (that) — there is no third case, and the frame is black
 * only before the film's first sourced photograph.
 */
export function showsHeldPicture(
  assetSrc: string | null,
  textCardBackgroundSrc: string | null,
): boolean {
  return assetSrc === null && textCardBackgroundSrc !== null
}

function Visual({
  scene,
  assetSrc,
  textCardBackgroundSrc,
  overlayVariant,
}: {
  scene: PlannedScene
  assetSrc: string | null
  textCardBackgroundSrc: string | null
  overlayVariant: OverlayVariant
}): ReactNode {
  /*
   * ####################################################################
   * # A CARD THAT INHERITED A PICTURE IS NOT A CARD. IT IS THE PREVIOUS #
   * # SHOT, HELD.                                                       #
   * #                                                                   #
   * # The client rejected the full-screen card on 2026-08-16, and the   #
   * # first attempt at answering him kept the card and drew its         #
   * # inherited photograph sharp with the narration line on top. That   #
   * # is worse than it sounds: the picture belongs to the PREVIOUS      #
   * # scene, so a line about a manuscript sat on a photograph of a      #
   * # cathedral and read as a caption for it.                           #
   * #                                                                   #
   * # So the line is gone and the picture is simply held. The planner   #
   * # gives these scenes the previous shot's crop and a move that       #
   * # continues from where it stopped, which makes them ordinary shots  #
   * # — so they draw through the SAME `CroppedImage` as everything      #
   * # else and there is no second way to put a photograph on screen.    #
   * #                                                                   #
   * # `TextCard` now fires ONLY when there is nothing to inherit, which #
   * # is a fallback at scene index 0. It does not occur in this film.   #
   * ####################################################################
   *
   * THIS BRANCH IS NOW FIRST AND ASKS ITS OWN QUESTION, and the order is the
   * change rather than the arithmetic. It used to be reached through
   * `card !== null`, which was true on a held shot only because
   * `showsTextCard` misread one as a card; now that the predicate reads the
   * frame correctly, `card` is null here and this branch has to be entered on
   * the fact that decides it — there is an inherited picture and no picture of
   * this scene's own.
   */
  if (showsHeldPicture(assetSrc, textCardBackgroundSrc) && textCardBackgroundSrc !== null) {
    return (
      <CroppedImage
        src={textCardBackgroundSrc}
        crop={scene.crop}
        // The inherited picture's vision record belongs to the scene it came
        // from and is not carried here. Only `archivePlate` reads it, for its
        // ground tint, and a held scene takes the previous crop — so this is
        // null rather than wrong, and the plate falls back to its own default.
        vision={null}
        pose={{
          kind: 'kenBurns',
          motion: scene.motion,
          durationFrames: scene.durationFrames,
        }}
      />
    )
  }

  /*
   * `showsTextCard` already implies a non-null card, but it returns a boolean and
   * so cannot narrow `scene.textCard` for the compiler. Reading it through the
   * predicate keeps the rule in one place and gets the narrowing without a `!`.
   *
   * Below the held branch, not above it, because the two predicates partition the
   * pictureless scenes: a card is what is left when there is nothing to inherit.
   */
  const card = showsTextCard(scene, assetSrc, textCardBackgroundSrc) ? scene.textCard : null

  if (card !== null) {
    return (
      <TextCard
        card={card}
        /*
         * NULL BY CONSTRUCTION NOW, and it is passed rather than dropped because
         * this component's own contract still allows a background. `showsTextCard`
         * returns true only when `textCardBackgroundSrc` is null, so the layer
         * `TextCard` would draw for it can no longer appear here — the card with a
         * picture behind it is the HELD branch above, and it is a photograph
         * rather than a card.
         */
        backgroundSrc={textCardBackgroundSrc}
        // The SCENE's length, not the composition's. The card's choreography is
        // planned against the scene it belongs to, and Studio and `<Player>` can
        // both mount a scene inside a differently-sized composition.
        durationFrames={scene.durationFrames}
        variant={overlayVariant}
        /*
         * THE CARD'S BACKGROUND MOVES NOW, AND THIS IS THE LINE THAT DOES IT.
         *
         * `deriveMotion` runs BEFORE the card branch in the planner, so every
         * card scene has carried a real, planned camera move since the stage was
         * written, and until 2026-08-16 nothing rendered it — the picture was a
         * bare `<Img>` with a constant transform. The client asked for the
         * background to zoom; it was already planned, it was simply never
         * reaching the screen.
         *
         * The SAME shape `CroppedImage` is handed below, deliberately. Two ways
         * of describing one pose is how the incoming and outgoing crossfade
         * layers drifted apart, and `Posed` exists so there is one.
         *
         * NO `maxTravel`. That cap belongs to a crop mode, and this layer is a
         * plain `objectFit: cover` fill — `maxTravelForCrop('fill')` is a no-op
         * anyway, so passing it would imply a constraint that is not there.
         */
        pose={{ kind: 'kenBurns', motion: scene.motion, durationFrames: scene.durationFrames }}
      />
    )
  }

  if (assetSrc === null) return null

  const { crop, motion, durationFrames } = scene

  return (
    <CroppedImage
      src={assetSrc}
      crop={crop}
      vision={scene.asset?.vision ?? null}
      pose={{ kind: 'kenBurns', motion, durationFrames }}
    />
  )
}

/**
 * THE ONLY PLACE A CROP MODE IS TURNED INTO PIXELS.
 *
 * Both the incoming picture and the outgoing picture of a crossfade come through
 * here, differing only in their `pose`. That is the entire point: this switch
 * used to exist for the incoming layer alone, and the outgoing layer was a flat
 * `objectFit: cover`, so every dissolve between two images snapped a portrait
 * scan off its archive plate to a full-bleed crop and back. Two implementations
 * of one idea will always drift; there is now one.
 *
 * If you add a crop mode, add it here and nowhere else.
 */
function CroppedImage({
  src,
  crop,
  vision,
  pose,
}: {
  src: string
  crop: Crop
  vision: AssetVision | null
  pose: Pose
}): ReactNode {
  // From core, because the worker's planner applies the same cap to the pose it
  // records for the outgoing image and cannot import anything under apps/web.
  // 'fill' and 'letterbox' get a cap that makes the reduction a no-op.
  const maxTravel = maxTravelForCrop(crop.mode)

  /*
   * ########################################################################
   * # WHERE A PICTURE THAT IS NOT CROPPED SITS, AND THE GEOMETRY IS THE     #
   * # OPPOSITE OF `fill`'s. GETTING IT BACKWARDS MOVES THE SUBJECT THE      #
   * # WRONG WAY.                                                           #
   * #                                                                      #
   * # In `fill` the picture is LARGER than the frame. The anchor names the  #
   * # part of the PICTURE that survives the crop, and `object-position`     #
   * # slides the picture under a fixed window: 0.68 keeps the right-hand    #
   * # part and throws the left away.                                       #
   * #                                                                      #
   * # In `blurPillarbox` and `letterbox` the picture is SMALLER than the    #
   * # frame on one axis and NOTHING IS CROPPED AT ALL. There is nothing to  #
   * # throw away; the only freedom is where the whole picture sits in the   #
   * # ground beside it. 0 is flush to the near edge, 1 to the far one.      #
   * #                                                                      #
   * #   blurPillarbox   picture at the frame's HEIGHT, ground left/right    #
   * #   letterbox       picture at the frame's WIDTH, ground top/bottom     #
   * #                                                                      #
   * # SO THIS VALUE IS NOT THE SUBJECT'S POSITION. `chooseCrop` already did #
   * # that arithmetic — see `placeInGround` in `packages/core/src/crop.ts`, #
   * # which solves "put the subject in the MIDDLE OF THE FRAME" for the     #
   * # placement that does it, and clamps when the picture is too wide to    #
   * # reach. Treating it as a subject position here would slide the picture #
   * # a second time, in the same direction, and hang it off the frame.      #
   * #                                                                      #
   * # ROUND ONE TAUGHT `chooseCrop` TO RETURN THIS AND NOTHING READ IT. The #
   * # only drawing consumer of `crop.anchor` in the repo was the FILL       #
   * # branch's `object-position` at the bottom of this function; the two    #
   * # branches below hard-centred their picture, so the vision model's      #
   * # answer was computed, planned, hashed and thrown away. Pinned by       #
   * # T-CROP1..3 in `captions.mount.test.tsx`.                              #
   * ########################################################################
   */
  const acrossPct = `${String(crop.anchor.x * 100)}%`
  const downPct = `${String(crop.anchor.y * 100)}%`

  if (crop.mode === 'archivePlate') {
    return <ArchivePlate src={src} pose={pose} vision={vision} />
  }

  if (crop.mode === 'letterbox') {
    // A panorama. Filling would throw away most of the picture, so it is held
    // whole on black.
    //
    // THE BLACK HAS TO BE ON THIS ELEMENT, not inherited from the segment root.
    // `AbsoluteFill` sets geometry only, it paints nothing. That was invisible
    // while this branch was reached solely by the incoming layer, which sits
    // directly on the root's black — but the outgoing crossfade layer stacks
    // ABOVE the incoming picture, so transparent bars let the next image show
    // through at full brightness on the very first frame of the dissolve. At the
    // 2.5:1 aspect this branch requires, that is a ~156px band top and bottom,
    // about 29% of the frame, popping for a frame and then correcting.
    return (
      <AbsoluteFill
        style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}
      >
        <Posed pose={pose} maxTravel={maxTravel}>
          {/*
            `object-position` IS EXACTLY THE RIGHT INSTRUCTION FOR A CONTAINED
            PICTURE, and it means something different here from what it means in
            the FILL branch below. On `objectFit: contain` the picture is smaller
            than its box, so the pair of percentages places the picture IN the
            box — `0% 0%` flush to the top left, `50% 50%` centred, which is the
            default this branch used to take by writing nothing. On `cover` the
            same two numbers choose which part of the picture the box keeps.
            One property, two geometries; see the box at the top of this
            function for which one applies where.
          */}
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: `${acrossPct} ${downPct}`,
            }}
          />
        </Posed>
      </AbsoluteFill>
    )
  }

  if (crop.mode === 'blurPillarbox') {
    // WHERE EVERY SUB-SQUARE STILL NOW LANDS. This comment used to end "Never for
    // stills"; the client retired that rule. He watched a manuscript page on an
    // archive plate at 0:02:23 — 24.1% of the frame carrying picture, 663px of
    // near-black down each side — and asked for a full frame. This is the only
    // crop that gives him one without upscaling: the sharp copy below is drawn at
    // the frame's own height, so a portrait scan is never sampled past 1:1. See
    // `isAssetResolutionAcceptable` in core/crop.ts, which proves that bound.
    // Sub-square VIDEO down to PHONE_ASPECT still takes the plate.
    return (
      /*
       * THE BLACK HAS TO BE ON THIS ELEMENT, for the same reason the letterbox
       * branch above carries it, and it went unnoticed for as long as this branch
       * was unreachable. `blur(48px)` samples past the element's own box as
       * TRANSPARENT, so the blurred copy fades out over roughly 3 x 48 = 144px at
       * each border while `transform: scale(1.1)` only pushes 96px of it outside
       * the frame. Measured by rendering frame 0 of one 960x1360 dissolve twice,
       * changing NOTHING but the incoming picture — white once, black once — and
       * differencing: 33 code values on all three channels at the top and bottom
       * edge and 8 at the left, falling to a bit-identical 0 by 120px in. That
       * difference is the INCOMING picture showing through, because the outgoing
       * crossfade layer stacks above it. An opaque ground costs nothing anywhere
       * the blur is already opaque and removes the bleed everywhere it is not.
       */
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        <Img
          src={src}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(48px) brightness(0.5)',
            transform: 'scale(1.1)',
          }}
        />
        <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'center' }}>
          {/*
            THE PLACEMENT BOX, AND IT HAS TO BE ITS OWN ELEMENT.

            ##################################################################
            # `left` + `translateX` IS THE ONLY EXACT WAY TO SAY THIS IN CSS. #
            #                                                                #
            # The sharp copy is a real element narrower than the frame, not a #
            # contained `<img>`, so `object-position` has nothing to act on   #
            # here. What is needed is "put its left edge `p` of the way       #
            # through the leftover ground", and the ground is                 #
            # `frame - picture` — a width no stylesheet knows, because the    #
            # picture's width comes from its own aspect at the frame's height.#
            #                                                                #
            # `left: p%` resolves against the CONTAINING BLOCK, so it moves   #
            # the box `p` of the FRAME. `translateX(-p%)` resolves against    #
            # the ELEMENT'S OWN box, so it pulls back `p` of the PICTURE. The #
            # sum is `p * (frame - picture)`, which is the placement exactly, #
            # and it needs neither width to be known.                         #
            #                                                                #
            # `align-items`, NOT `justify-content`, AND GETTING THAT WRONG    #
            # PASSES EVERY TEST IN THIS REPO. `AbsoluteFill` is `display:     #
            # flex` with `flex-direction: COLUMN`, so the main axis runs      #
            # DOWN: `justify-content` is the vertical one and `align-items`   #
            # is what centred this picture across the frame. Set to           #
            # `flex-start` it starts the box at the frame's own left edge, so #
            # `left` measures from there instead of from wherever centring    #
            # had already put it. Written down because it was got backwards   #
            # first, jsdom computes no layout so `captions.mount.test.tsx`    #
            # stayed green, and it took a rendered still to see the picture   #
            # sitting 631px to the right of where it belonged.                #
            #                                                                #
            # WHY NOT ON `Posed` ITSELF: `Posed` writes the Ken Burns         #
            # `transform` and merges the caller's style AFTER it, so a        #
            # `transform` passed in would silently REPLACE the camera move.   #
            # A wrapper keeps the two transforms on two elements, where they  #
            # compose instead of overwriting.                                 #
            #                                                                #
            # AND THE PERCENTAGES ARE EQUAL AND OPPOSITE ON PURPOSE. At 0.5   #
            # they cancel to the centre, which is exactly where this branch   #
            # drew every picture before, so a centred subject does not move.  #
            # MEASURED, on a 1054x1728 portrait rendered at 1920x1080: the sharp#
            # copy occupies columns 631-1289 before this change and columns   #
            # 631-1289 after it, and best alignment between the two renders   #
            # is at a shift of exactly 0 px.                                  #
            #                                                                #
            # NOT bit-identical, and the difference is worth naming: a        #
            # transform positions at sub-pixel precision where flex centring  #
            # snapped, so the picture is resampled a fraction of a pixel      #
            # differently — 1.06 of 255 mean over the whole frame, inside the #
            # picture's own columns and nowhere else. That is a resample of   #
            # the same placement, not a move. T-CROP3 pins the placement;     #
            # only a render can speak to the resample, and one was done.      #
            ##################################################################
          */}
          <div
            style={{
              position: 'relative',
              height: '100%',
              left: acrossPct,
              transform: `translateX(-${acrossPct})`,
            }}
          >
            <Posed
              pose={pose}
              maxTravel={maxTravel}
              style={{ position: 'relative', inset: 'auto', height: '100%' }}
            >
              <Img src={src} style={{ height: '100%', width: 'auto', display: 'block' }} />
            </Posed>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  return (
    <Posed pose={pose} maxTravel={maxTravel}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          /*
           * THE OTHER GEOMETRY. Here the picture is LARGER than the frame and
           * these two numbers choose which part of it survives the crop, which
           * is the reading `chooseCrop` uses for `fill` and only for `fill`.
           * Same property as the two branches above, opposite meaning.
           */
          objectPosition: `${acrossPct} ${downPct}`,
        }}
      />
    </Posed>
  )
}

/**
 * THE CLIENT'S TWO REMOTION PRESETS, pushCut AND slide, RULED 2026-09-10.
 *
 * ##########################################################################
 * # THIS IS THE FIRST TIME `@remotion/transitions` ENTERS THE FILM BUNDLE,  #
 * # AND IT REVERSES A DELIBERATE DECISION. `look-transition-entry.ts` says  #
 * # in its own header that the package is preview-only. He named these two  #
 * # by name, so it is his call and it is recorded here.                     #
 * #                                                                        #
 * # NEVER `TransitionSeries`. That component overlaps its children on one   #
 * # timeline, which is not how this film is built: segments are rendered    #
 * # INDEPENDENTLY and concatenated by stream copy, so nothing may span two  #
 * # of them. The preset's `component` is mounted directly instead, twice,   #
 * # and the whole transition lives inside the INCOMING segment, which is    #
 * # exactly how the crossfade and the film burn already worked. That is why #
 * # `prevAsset` exists.                                                     #
 * #                                                                        #
 * # FOUR THINGS THE DOCUMENTATION DOES NOT TELL YOU, all four read out of   #
 * # the preset sources and all four load-bearing.                           #
 * #                                                                        #
 * # 1. THE Z-ORDER IS INVERTED FOR THESE TWO. `push-cut.js` sets            #
 * #    `opacity: isEntering && presentationProgress < cutProgress ? 0 : 1`. #
 * #    On the EXITING side `isEntering` is false, so that layer is OPAQUE   #
 * #    for the entire window. Mount the exiting layer last, the way         #
 * #    `TransitionIn` does, and the incoming shot never appears at all.     #
 * #    The ENTERING layer must stack ABOVE the exiting one.                 #
 * #                                                                        #
 * # 2. THE FLASH LANDS IN THE WRONG LAYER, so it is turned off here and     #
 * #    redrawn by `PushCutFlash` above `Grade`. See the box at its mount.   #
 * #                                                                        #
 * # 3. THE SLIDE SEAM. `slide.js` subtracts an `epsilon` of 0.01 to overlap #
 * #    the two halves "to avoid a white line between them". Worked through, #
 * #    that is true for `from-left` and `from-top` and INVERTED for         #
 * #    `from-right` and `from-bottom`, where it opens a 0.01% GAP instead,  #
 * #    about 0.19px at 1920 wide. `from-left` is chosen partly for that.    #
 * #                                                                        #
 * # 4. THE WINDOW MUST END ON IDENTITY. The very next frame of the film is  #
 * #    the plain `Visual` at scale 1. The library default `incomingEndScale`#
 * #    is 1.07, which would pop by 7% between two frames. Forced to 1.      #
 * ##########################################################################
 */
const SLIDE_DIRECTION = 'from-left' as const

/**
 * Everything the preset asks for that a mounted-directly use has no answer to.
 *
 * `onElementImage` and `onUnmount` exist for `TransitionSeries`'s own frame
 * capture, and `bothEnteringAndExiting` tells a preset whether a single element
 * is doing both jobs. Neither CSS preset reads any of the three — verified in
 * `push-cut.js` and `slide.js`, whose destructures name none of them.
 */
const PRESET_UNUSED = {
  onElementImage: () => undefined,
  onUnmount: () => undefined,
  bothEnteringAndExiting: false,
} as const

function PresetTransition({
  scene,
  prevAssetSrc,
  children,
}: {
  scene: PlannedScene
  prevAssetSrc: string | null
  children: ReactNode
}): ReactNode {
  const frame = useCurrentFrame()
  const { transitionIn, prevAsset } = scene

  const isPreset = transitionIn.type === 'pushCut' || transitionIn.type === 'slide'
  /*
   * EVERY REFUSAL BELOW RETURNS THE CHILDREN RATHER THAN NULL, and that is the
   * difference between a degraded shot and a black one. A transition is a way of
   * arriving at the picture, so if it cannot be drawn the picture must still be.
   * `TransitionIn` and `Flash` may return null because they are layers OVER the
   * shot; this one wraps it.
   */
  if (!isPreset) return children
  if (transitionIn.durationFrames < 1) return children
  if (frame >= transitionIn.durationFrames) return children
  if (prevAsset === null || prevAssetSrc === null) return children

  const presentation =
    transitionIn.type === 'pushCut'
      ? pushCut({ flashOpacity: 0, incomingEndScale: 1 })
      : slide({ direction: SLIDE_DIRECTION })
  const Presentation = presentation.component

  /*
   * The preset wants progress on 0..1 across its own window. `durationFrames` is
   * the window, so frame 0 is 0 and the last drawn frame is just under 1 — the
   * frame that would be exactly 1 is the first frame this component stops
   * drawing at all, which is the plain `Visual` above.
   */
  const presentationProgress = frame / transitionIn.durationFrames

  const shared = {
    presentationProgress,
    presentationDurationInFrames: transitionIn.durationFrames,
    passedProps: presentation.props,
    ...PRESET_UNUSED,
  }

  return (
    <AbsoluteFill>
      {/* The shot being left. Drawn FIRST so the incoming one stacks over it. */}
      <Presentation {...shared} presentationDirection="exiting">
        <AbsoluteFill>
          {/*
            `prevAsset.crop`, NOT `scene.crop`, and the frozen end pose. Same
            reasoning as `TransitionIn` below: this is the PREVIOUS scene's
            picture and it has to be framed the way that segment framed it, or
            the join this is meant to smooth becomes the loudest thing in it.
          */}
          <CroppedImage
            src={prevAssetSrc}
            crop={prevAsset.crop}
            vision={null}
            pose={{
              kind: 'frozen',
              endScale: prevAsset.endScale,
              endX: prevAsset.endX,
              endY: prevAsset.endY,
            }}
          />
        </AbsoluteFill>
      </Presentation>

      {/* The shot being arrived at. ABOVE, for the reason in the box above. */}
      <Presentation {...shared} presentationDirection="entering">
        {children}
      </Presentation>
    </AbsoluteFill>
  )
}

/**
 * The pushCut's flash, drawn above `Grade` instead of inside the preset.
 *
 * The shape is the preset's own, read out of `push-cut.js`: it rises to its peak
 * over the one frame before the cut and decays over `flashFrames` after it. Both
 * halves are reproduced here because the cut is off-centre at 5/11 and a
 * symmetric flash would read as a different edit.
 */
function PushCutFlash({ scene }: { scene: PlannedScene }): ReactNode {
  const frame = useCurrentFrame()
  const { transitionIn } = scene

  if (transitionIn.type !== 'pushCut' || transitionIn.durationFrames < 1) return null
  if (frame >= transitionIn.durationFrames) return null

  const span = transitionIn.durationFrames
  const progress = frame / span
  const oneFrame = 1 / Math.max(1, span)
  const flashTail = PUSH_CUT_FLASH_FRAMES / Math.max(1, span)

  const opacity =
    progress < PUSH_CUT_CUT_PROGRESS
      ? interpolate(progress, [PUSH_CUT_CUT_PROGRESS - oneFrame, PUSH_CUT_CUT_PROGRESS], [0, PUSH_CUT_FLASH_PEAK], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(progress, [PUSH_CUT_CUT_PROGRESS, PUSH_CUT_CUT_PROGRESS + flashTail], [PUSH_CUT_FLASH_PEAK, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })

  if (opacity <= 0) return null

  return (
    <AbsoluteFill
      style={{ backgroundColor: PUSH_CUT_FLASH_COLOUR, opacity, pointerEvents: 'none' }}
    />
  )
}

function TransitionIn({
  scene,
  prevAssetSrc,
}: {
  scene: PlannedScene
  prevAssetSrc: string | null
}): ReactNode {
  const frame = useCurrentFrame()
  const { transitionIn, prevAsset } = scene

  if (transitionIn.type !== 'crossfade') return null
  if (prevAsset === null || prevAssetSrc === null) return null
  if (transitionIn.durationFrames < 1) return null
  if (frame >= transitionIn.durationFrames) return null

  const opacity = interpolate(frame, [0, transitionIn.durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ opacity }}>
      {/*
        `prevAsset.crop`, NOT `scene.crop`: this is the PREVIOUS scene's picture,
        and it has to be framed the way the previous segment framed it or the cut
        it is supposed to hide becomes the most visible thing in the film.

        `vision` is null because the plan does not carry the outgoing image's
        vision, only its crop and end pose. The one thing that costs is the
        archive plate's ground tint, which falls back to the neutral default for
        the 8-16 frames of the dissolve. That ground is a near-black gradient at
        ~8% lightness either way, so the difference is a couple of code values in
        the darkest part of the frame — as against the whole photograph changing
        size and position, which is what this layer used to do.
      */}
      <CroppedImage
        src={prevAssetSrc}
        crop={prevAsset.crop}
        vision={null}
        pose={{
          kind: 'frozen',
          endScale: prevAsset.endScale,
          endX: prevAsset.endX,
          endY: prevAsset.endY,
        }}
      />
    </AbsoluteFill>
  )
}

/**
 * How dark the incoming half of a dip is allowed to open, and it CANNOT BE 1.
 *
 * ##########################################################################
 * # A DIP THAT ONLY DIPS ON ONE SIDE IS A DROPPED FRAME, AND IT IS NINE     #
 * # DIPS RATHER THAN THE ONE THE CLIENT HAPPENED TO NAME.                   #
 * #                                                                        #
 * # COUNTED OFF `tmp/plan-V22-final.json`, THE DELIVERED 166-SCENE FILM.    #
 * # `dipToBlack` fires at that plan's zero-based `index` 7, 78, 87, 92,     #
 * # 109, 115, 131, 147 and 160 — 0:24.3, 3:58.3, 4:24.2, 4:39.6, 5:34.8,    #
 * # 5:50.8, 6:48.7, 7:45.3 and 8:30.2 — and all nine are 18 frames long.    #
 * # The client reported 0:24.3 because it is the first one; an earlier      #
 * # draft of this comment wrote that down as if it were the only one, which #
 * # is how a fix gets sized against a symptom instead of against the film.  #
 * #                                                                        #
 * # A dip to black is a symmetric gesture: the outgoing shot goes DOWN into #
 * # black and the incoming one comes back UP out of it. Only the second     #
 * # half of that is ours. The first half is the previous scene's screen     #
 * # time, and this compositor may not paint one pixel of it — segments      #
 * # render in isolation and may depend only on the plan, which is the rule  #
 * # at the top of this file and the reason the render cache is sound.       #
 * #                                                                        #
 * # So drawing our half FAITHFULLY is the bug. Opaque black on frame 0      #
 * # means the last frame of the outgoing shot is fully lit and the next one #
 * # is solid black, with nothing in between: a cut to black, one frame      #
 * # long, which is indistinguishable from a frame the encoder lost. The     #
 * # client reported it as exactly that.                                     #
 * #                                                                        #
 * # WHAT THE FILM BURN DOES INSTEAD IS THE PRECEDENT. It has the same       #
 * # missing half and answers it by pairing a `transitionOut` LEAD-IN onto   #
 * # the previous scene, so the shot being left drains before the splice.    #
 * # A dip has no such pairing in the plan, and inventing one here would be  #
 * # a schema change and a re-plan rather than a compositor fix. Until it    #
 * # has one, the honest thing this side can do is refuse to be opaque:      #
 * # open on a shadow deep enough to read as a dip, shallow enough that the  #
 * # picture is still under it, and recover from there.                      #
 * #                                                                        #
 * # THE NUMBER IS A LOOK DECISION AND NEEDS A RENDERED CLIP TO SETTLE. What #
 * # is not a look decision, and is pinned in `captions.mount.test.tsx`      #
 * # (T-DIP1), is that it is below one. 0.72 leaves 28% of the photograph    #
 * # readable, which is a shadow rather than a blackout.                     #
 * #                                                                        #
 * # IT WAS ALSO THE ANSWER THE FILM BURN'S SPLICE TOOK, and that device is  #
 * # gone as of 2026-09-10. `FILM_BURN_SPLICE_FLOOR` lived in the deleted    #
 * # `filmBurnClock.ts`: its splice frame was literal `#000000` on all 35    #
 * # burns of a delivered plan, and it was fixed by the rule written here    #
 * # first. The rule outlives the device — nothing in a transition may take  #
 * # the whole frame — and whatever draws the client's 10% burn next has to  #
 * # obey it. `git show` on the removing commit still holds the constant.    #
 * ##########################################################################
 */
const DIP_TO_BLACK_OPENING = 0.72

/** Above everything, including captions: a dip to black is the whole frame. */
function DipToBlack({ scene }: { scene: PlannedScene }): ReactNode {
  const frame = useCurrentFrame()
  const { transitionIn } = scene

  if (transitionIn.type !== 'dipToBlack' || transitionIn.durationFrames < 1) return null
  if (frame >= transitionIn.durationFrames) return null

  const opacity = interpolate(frame, [0, transitionIn.durationFrames], [DIP_TO_BLACK_OPENING, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return <AbsoluteFill style={{ backgroundColor: '#000', opacity }} />
}

/**
 * The client's 2026-08-15 reference at 0:23 — "a transition like the camera
 * capture and lightning".
 *
 * ####################################################################
 * # IT WASHES THE INCOMING SHOT AND CANNOT TOUCH THE OUTGOING ONE.    #
 * # Segments are rendered independently and concatenated without      #
 * # re-encoding, so nothing can paint into the previous scene's       #
 * # closing frames. The bloom therefore begins on the NEW picture's   #
 * # frame 0 and decays — which is what his reference shows.           #
 * #                                                                   #
 * # OPACITY AND TRANSFORM ONLY. A `filter: brightness()` would be the #
 * # obvious way to write this and it is the banned shape: Chrome      #
 * # re-rasterises the whole layer on every frame a filter value       #
 * # changes, which on the two cores this renders on is tens of        #
 * # minutes. See the cost note at the top of Grade.tsx.               #
 * ####################################################################
 *
 * TWO LAYERS, because a flat white alone reads as a dropped frame rather than as
 * light. The flat sheet is the exposure hit; the diagonal streak is the leak
 * across the gate, and it carries the faint cool cast his reference has at the
 * right-hand edge. The streak's gradient is a CONSTANT string and only its
 * `transform` moves, so it is rasterised once and then composited.
 */

function Flash({ scene }: { scene: PlannedScene }): ReactNode {
  const frame = useCurrentFrame()
  const { transitionIn } = scene

  if (transitionIn.type !== 'flash' || transitionIn.durationFrames < 1) return null
  if (frame >= transitionIn.durationFrames) return null

  /*
   * A FAST RISE AND A SLOWER FALL, which is what makes it read as a flash rather
   * than as a fade. The peak is a fixed fraction of the window rather than a
   * fixed frame count, so a flash clamped short by a brief scene still has a
   * shape instead of being cut off mid-rise.
   */
  const peakAt = transitionIn.durationFrames * FLASH.peakFraction
  const intensity =
    frame <= peakAt
      ? interpolate(frame, [0, peakAt], [0, 1], { extrapolateLeft: 'clamp' })
      : interpolate(frame, [peakAt, transitionIn.durationFrames], [1, 0], {
          extrapolateRight: 'clamp',
        })

  return (
    <AbsoluteFill style={{ opacity: intensity }}>
      <AbsoluteFill style={{ backgroundColor: FLASH.sheetColor, opacity: FLASH.sheetAlpha }} />
      <AbsoluteFill
        style={{
          background: FLASH_STREAK_GRADIENT,
          // Swept across the frame as the bloom decays. `translate` only.
          transform: `translateX(${String((intensity - 1) * FLASH.streakTravel)}px)`,
          willChange: 'transform',
        }}
      />
    </AbsoluteFill>
  )
}
