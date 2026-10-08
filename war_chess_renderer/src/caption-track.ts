import {createTikTokStyleCaptions, type Caption, type TikTokPage} from '@remotion/captions';

import type {WarChessRenderSpec} from './schema';

type CaptionCue = WarChessRenderSpec['captions'][number];

export type CaptionPageInterval = {
  page: TikTokPage;
  startFrame: number;
  endFrameExclusive: number;
};

export const captionTrackIntervals = (
  cues: readonly CaptionCue[],
  fps: number,
  durationInFrames: number,
): CaptionPageInterval[] => {
  const captions: Caption[] = cues.map((cue, index) => ({
    text: `${index === 0 ? '' : ' '}${cue.text}`,
    startMs: (cue.startFrame / fps) * 1000,
    endMs: (cue.endFrameExclusive / fps) * 1000,
    timestampMs: null,
    confidence: null,
  }));
  const {pages} = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 0,
  });
  return pages.flatMap((page, index) => {
    const startFrame = Math.round((page.startMs / 1000) * fps);
    const nextPage = pages[index + 1];
    const endFrameExclusive = Math.min(
      durationInFrames,
      nextPage
        ? Math.round((nextPage.startMs / 1000) * fps)
        : Math.round(((page.startMs + page.durationMs) / 1000) * fps),
    );
    return endFrameExclusive > startFrame
      ? [{page, startFrame, endFrameExclusive}]
      : [];
  });
};
