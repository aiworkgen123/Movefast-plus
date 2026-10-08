import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const MEDIA_FIRST_OVERLAY_DURATION = 150;
export const MEDIA_FIRST_FRAMED_DURATION = 150;
export const MEDIA_FIRST_CUTOUT_DURATION = 180;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const voiceover = 'visual-lab/factual-owner-cut/voiceover-62.9s.wav';

const fadeFor = (frame: number, duration: number) =>
  interpolate(frame, [0, 8, duration - 10, duration - 1], [0, 1, 1, 0], clamp);

/**
 * Media-first option A: the photograph owns the full frame. Text is a compact
 * identifier over a shallow local gradient, never a competing title card.
 */
export const MediaFirstOverlayProof: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = fadeFor(frame, MEDIA_FIRST_OVERLAY_DURATION);
  const reveal = interpolate(frame, [10, 31], [0, 1], ease);

  return (
    <AbsoluteFill style={{backgroundColor: '#171410', opacity: fade, overflow: 'hidden'}}>
      <Audio src={staticFile(voiceover)} trimBefore={203} trimAfter={353} />
      <Img
        src={staticFile('visual-lab/factual-owner-cut/rommel-1917.jpg')}
        style={{
          position: 'absolute',
          inset: -26,
          width: 1972,
          height: 1132,
          objectFit: 'cover',
          objectPosition: '50% 24%',
          scale: interpolate(frame, [0, 149], [1.04, 1.09], clamp),
          filter: 'grayscale(.26) sepia(.08) contrast(1.04) brightness(1.02)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(12,10,8,.48) 0%, rgba(12,10,8,.08) 27%, transparent 51%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 82,
          opacity: reveal,
          translate: `0 ${interpolate(reveal, [0, 1], [22, 0], clamp)}px`,
          textShadow: '0 4px 24px rgba(0,0,0,.55)',
        }}
      >
        <div
          style={{
            color: '#f2eadb',
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 67,
            fontWeight: 700,
            letterSpacing: -1.3,
            lineHeight: 0.95,
          }}
        >
          Erwin Rommel
        </div>
        <div
          style={{
            marginTop: 14,
            color: '#e2b769',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 4.2,
            textTransform: 'uppercase',
          }}
        >
          Western Desert · identity context
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Media-first option B: a deliberately framed image carries the scene and the
 * adjacent copy merely identifies it. The photograph is not shaded.
 */
export const MediaFirstFramedProof: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = fadeFor(frame, MEDIA_FIRST_FRAMED_DURATION);
  const reveal = interpolate(frame, [8, 32], [0, 1], ease);
  const imageX = interpolate(reveal, [0, 1], [-45, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#d7cbb8',
        color: '#171510',
        opacity: fade,
        overflow: 'hidden',
      }}
    >
      <Audio src={staticFile(voiceover)} trimBefore={410} trimAfter={560} />

      <div
        style={{
          position: 'absolute',
          left: 68,
          top: 62,
          bottom: 62,
          width: 1270,
          overflow: 'hidden',
          opacity: reveal,
          translate: `${imageX}px 0`,
          backgroundColor: '#b9ad99',
          boxShadow: '0 24px 62px rgba(64,48,29,.2)',
        }}
      >
        <Img
          src={staticFile('visual-lab/factual-owner-cut/montgomery-1943.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 22%',
            scale: interpolate(frame, [0, 149], [1.02, 1.065], clamp),
            filter: 'grayscale(.15) sepia(.05) contrast(1.02) brightness(1.04)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1420,
          right: 72,
          top: 310,
          opacity: reveal,
          translate: `${interpolate(reveal, [0, 1], [28, 0], clamp)}px 0`,
        }}
      >
        <div
          style={{
            color: '#8c3f34',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 3.6,
            textTransform: 'uppercase',
          }}
        >
          Sandhurst
        </div>
        <div
          style={{
            marginTop: 21,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 69,
            fontWeight: 700,
            lineHeight: 0.94,
            letterSpacing: -1.6,
          }}
        >
          Bernard<br />Montgomery
        </div>
        <div
          style={{
            marginTop: 27,
            color: 'rgba(23,21,16,.58)',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 1.4,
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}
        >
          Portrait · 1943
          <br />Identity context
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Media-first option C: a visible historical map remains the base while a
 * reviewed cutout creates depth. Copy stays small and anchored to the evidence.
 */
export const MediaFirstCutoutProof: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = fadeFor(frame, MEDIA_FIRST_CUTOUT_DURATION);
  const establish = interpolate(frame, [0, 24], [0, 1], ease);
  const subject = interpolate(frame, [18, 48], [0, 1], ease);

  return (
    <AbsoluteFill style={{backgroundColor: '#cfc2aa', opacity: fade, overflow: 'hidden'}}>
      <Audio src={staticFile(voiceover)} trimBefore={627} trimAfter={807} />
      <Img
        src={staticFile('visual-lab/factual-owner-cut/russian-campaign-1812-map.jpg')}
        style={{
          position: 'absolute',
          inset: -28,
          width: 1976,
          height: 1136,
          objectFit: 'cover',
          objectPosition: '48% 47%',
          opacity: 0.92,
          scale: interpolate(frame, [0, 179], [1.02, 1.075], clamp),
          filter: 'sepia(.08) saturate(.82) contrast(1.03) brightness(1.08)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(244,235,218,.76) 0%, rgba(244,235,218,.25) 35%, transparent 62%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: 150,
          bottom: -95,
          width: 635,
          height: 1110,
          opacity: subject,
          translate: `${interpolate(subject, [0, 1], [80, 0], clamp)}px 0`,
          filter: 'drop-shadow(0 28px 25px rgba(50,36,18,.34))',
        }}
      >
        <Img
          src={staticFile('visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png')}
          style={{width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 95,
          top: 122,
          width: 540,
          opacity: establish,
          translate: `0 ${interpolate(establish, [0, 1], [18, 0], clamp)}px`,
        }}
      >
        <div
          style={{
            color: '#8f3f34',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 4.1,
            textTransform: 'uppercase',
          }}
        >
          Russia · 1812
        </div>
        <div
          style={{
            marginTop: 18,
            color: '#211d17',
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: -1.25,
            lineHeight: 0.94,
          }}
        >
          The prepared reply
        </div>
        <div
          style={{
            marginTop: 21,
            color: 'rgba(33,29,23,.6)',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 1.4,
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}
        >
          Campaign map · visual context
        </div>
      </div>
    </AbsoluteFill>
  );
};
