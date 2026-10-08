import {Chess, type Square} from 'chess.js';
import {z} from 'zod';

export {
  WC06_PRESET_REGISTRY,
  WC06_REGISTRY_HASH,
  assertValidWC06Registry,
  resolveWC06Preset,
  type WC06Preset,
  type ResolvedWC06Preset,
} from './chess-presets';
export {
  WC06_MOTIF_IDS,
  type WC06MotifId,
} from './chess-presets';
import {WC06_MOTIF_IDS} from './chess-presets';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const opaqueId = z.string().min(1).max(200);
const evidenceIds = z.array(opaqueId).min(1).max(64);

const normalizedDisplayWord = (value: string) =>
  value.normalize('NFKC').replace(/[.,!?;:()[\]{}"'“”‘’]/g, '').toLocaleLowerCase();

export const AssetSourceSchema = z
  .object({
    artifactId: opaqueId,
    sha256: hex64,
    mediaType: z.string().min(1).max(120),
    url: z.string().url().optional(),
    staticFileKey: z.string().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => !(value.url && value.staticFileKey), {
    message: 'asset source cannot contain both a URL and a static-file key',
  });

export const CaptionCueSchema = z
  .object({
    id: opaqueId,
    startFrame: z.number().int().nonnegative(),
    endFrameExclusive: z.number().int().positive(),
    text: z.string().min(1).max(240),
  })
  .strict()
  .refine((cue) => cue.endFrameExclusive > cue.startFrame, {
    message: 'caption range is empty',
  });

export const CaptionCuesSchema = z.array(CaptionCueSchema).max(10000).superRefine((cues, context) => {
  let previousEnd = 0;
  for (const [index, cue] of cues.entries()) {
    if (cue.startFrame < previousEnd) {
      context.addIssue({
        code: 'custom',
        message: 'captions must be ordered and non-overlapping',
        path: [index, 'startFrame'],
      });
    }
    previousEnd = cue.endFrameExclusive;
  }
});

const SceneOverlaySchema = z
  .object({
    kind: z.enum(['cta', 'chapter', 'gap']),
    text: z.string().trim().min(1).max(240),
  })
  .strict();

const GapReplacementSchema = z
  .object({
    sourceSpanId: opaqueId,
    sourceSpanHash: hex64,
    reason: z.literal('adjacent_media_under_gap'),
  })
  .strict();

const SceneEditSchema = z.object({
  kind: z.enum(['label', 'caption', 'headline', 'template_graphic', 'filter_only', 'frame']),
  overlayText: z.string().trim().min(1).max(240).nullable(),
  filter: z.enum(['smoke_ash', 'snowfall', 'film_dust']).nullable(),
  motion: z.enum(['static', 'zoom', 'pan']),
  frame: z.boolean(),
}).strict();

const CommonSceneSchema = z.object({
  sceneId: opaqueId,
  parentUnitId: opaqueId,
  plannedShotId: z.string().trim().min(1).max(160).optional(),
  startFrame: z.number().int().nonnegative(),
  endFrameExclusive: z.number().int().positive(),
  routeId: opaqueId,
  treatment: z
    .object({
      surfaceEffect: z.enum(['fine_35mm_grain', 'vignette', 'engraving_halftone']),
      presentationEffect: z.enum(['film_dust', 'snowfall', 'smoke_ash', 'white_grid']),
      presentationMode: z.enum(['stay_framed', 'expand_fullscreen']),
      seed: z.number().int().nonnegative(),
    })
    .strict(),
  acceptedScopeHash: hex64,
  overlay: SceneOverlaySchema.optional(),
  edit: SceneEditSchema.optional(),
  gapReplacement: GapReplacementSchema.optional(),
});

const FrameTreatmentSchema = z.discriminatedUnion('style', [
  z.object({style: z.literal('basic_static')}).strict(),
  z.object({
    style: z.literal('animated_signal_yellow'),
    reason: z.enum(['solo_person_reveal', 'specific_object_place_reveal']),
    visibleSubject: z.string().min(1).max(240),
    evidenceHash: hex64,
  }).strict(),
]);

const RenderSceneBaseSchema = z.discriminatedUnion('kind', [
  CommonSceneSchema.extend({
    kind: z.literal('animated_still'),
    frameTreatment: FrameTreatmentSchema.default({style: 'basic_static'}),
    source: AssetSourceSchema,
    sourceWidth: z.number().int().positive(),
    sourceHeight: z.number().int().positive(),
  }).strict(),
  CommonSceneSchema.extend({
    kind: z.literal('real_clip'),
    frameTreatment: FrameTreatmentSchema.default({style: 'basic_static'}),
    source: AssetSourceSchema,
    sourceWidth: z.number().int().positive(),
    sourceHeight: z.number().int().positive(),
    sourceIdentity: z.string().min(1).max(512).optional(),
    sourceStartFrame: z.number().int().nonnegative(),
    sourceEndFrameExclusive: z.number().int().positive(),
    sourceAudio: z.literal(false),
  }).strict(),
  CommonSceneSchema.extend({
    kind: z.literal('original_motion_graphic'),
    componentId: opaqueId,
    componentVariant: z.enum(['evidence_flow_v1', 'board_count_v1']),
    boardCount: z.number().int().min(2).max(4).optional(),
    display: z
      .object({
        eyebrow: z.string().min(1).max(48),
        title: z.string().min(1).max(100),
        steps: z.array(z.string().min(1).max(240)).min(1).max(4),
      })
      .strict(),
    stateChangePlan: z
      .array(
        z
          .object({
            startFrame: z.number().int().nonnegative(),
            endFrameExclusive: z.number().int().positive(),
            description: z.string().min(1).max(160),
            meaningfulChange: z.literal(true),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  }).strict(),
]);

export const RenderSceneSchema = RenderSceneBaseSchema.superRefine((scene, context) => {
  const duration = scene.endFrameExclusive - scene.startFrame;
  if (scene.kind === 'real_clip' && duration > 150) {
    context.addIssue({
      code: 'custom',
      message: 'sourced clips must not exceed 150 frames',
      path: ['endFrameExclusive'],
    });
  }
  if (scene.kind === 'animated_still' && scene.treatment.presentationMode !== 'stay_framed') {
    context.addIssue({
      code: 'custom',
      message: 'stills must remain inside the approved frame',
      path: ['treatment', 'presentationMode'],
    });
  }
  if (
    scene.kind === 'real_clip' &&
    scene.sourceEndFrameExclusive <= scene.sourceStartFrame
  ) {
    context.addIssue({
      code: 'custom',
      message: 'source range is empty',
      path: ['sourceEndFrameExclusive'],
    });
  }
  if (scene.kind === 'real_clip' && scene.frameTreatment.style !== 'basic_static') {
    context.addIssue({
      code: 'custom',
      message: 'real clips must use the basic static frame treatment',
      path: ['frameTreatment'],
    });
  }
  if (scene.kind === 'real_clip' && scene.sourceEndFrameExclusive - scene.sourceStartFrame > 150) {
    context.addIssue({
      code: 'custom',
      message: 'clip source window must not exceed 150 frames',
      path: ['sourceEndFrameExclusive'],
    });
  }
  if (scene.kind === 'real_clip' && duration > scene.sourceEndFrameExclusive - scene.sourceStartFrame) {
    context.addIssue({
      code: 'custom',
      message: 'clip source window cannot be shorter than its display interval',
      path: ['sourceEndFrameExclusive'],
    });
  }
  if (scene.kind === 'original_motion_graphic') {
    if (scene.componentVariant === 'board_count_v1') {
      if (
        !scene.plannedShotId || scene.boardCount === undefined ||
        scene.display.steps.length !== scene.boardCount ||
        scene.stateChangePlan.length !== scene.boardCount ||
        scene.stateChangePlan.some((state) => state.endFrameExclusive - state.startFrame < 2)
      ) {
        context.addIssue({code: 'custom', message: 'board count must match its authored reveals', path: ['boardCount']});
      }
    } else if (scene.boardCount !== undefined) {
      context.addIssue({code: 'custom', message: 'board count requires the board graphic variant', path: ['boardCount']});
    }
    if (scene.display.steps.length !== scene.stateChangePlan.length ||
        new Set(scene.display.steps).size !== scene.display.steps.length) {
      context.addIssue({code: 'custom', message: 'display states must match distinct authored reveals', path: ['display', 'steps']});
    }
    let cursor = 0;
    for (const [index, state] of scene.stateChangePlan.entries()) {
      if (state.startFrame !== cursor || state.endFrameExclusive - state.startFrame < 2) {
        context.addIssue({
          code: 'custom',
          message: 'motion graphic state changes must form a continuous local partition',
          path: ['stateChangePlan', index],
        });
      }
      if (state.endFrameExclusive - state.startFrame > 150) {
        context.addIssue({
          code: 'custom',
          message: 'motion graphic may not remain materially unchanged for more than 150 frames',
          path: ['stateChangePlan', index, 'endFrameExclusive'],
        });
      }
      cursor = state.endFrameExclusive;
    }
    if (cursor !== duration) {
      context.addIssue({
        code: 'custom',
        message: 'motion graphic state changes must cover the complete scene',
        path: ['stateChangePlan'],
      });
    }
  }
  if (scene.endFrameExclusive <= scene.startFrame) {
    context.addIssue({
      code: 'custom',
      message: 'scene range is empty',
      path: ['endFrameExclusive'],
    });
  }
});

const NarrationTimingSchema = z.object({
  policy: z.literal('measured-component-cues.v1'),
  alignment_hash: hex64,
  owner_start_frame: z.number().int().nonnegative(),
  owner_end_frame_exclusive: z.number().int().positive(),
  status: z.enum(['not_requested', 'unsupported', 'measured']),
  reason: z.literal('measured_words_unavailable').optional(),
  cues: z.array(z.object({
    target: opaqueId, phrase: z.string().min(1).max(240), cue_id: opaqueId,
    script_word_start: z.number().int().nonnegative(),
    script_word_end_exclusive: z.number().int().positive(),
    start_frame: z.number().int().nonnegative(), end_frame_exclusive: z.number().int().positive(),
  }).strict()).max(6),
}).strict();

const ComponentBaseSchema = z.object({
  narrationTiming: NarrationTimingSchema.optional(),
  componentId: opaqueId,
  parentUnitIds: z.array(opaqueId).min(1).max(32),
  layer: z.enum(['full_screen', 'overlay']),
  baseSceneIds: z.array(opaqueId).min(1).max(32),
  startFrame: z.number().int().nonnegative(),
  endFrameExclusive: z.number().int().positive(),
  evidenceIds,
  acceptedScopeHash: hex64,
});

const ForceSchema = z
  .object({
    forceId: opaqueId,
    label: z.string().min(1).max(80),
    side: z.enum(['red', 'blue']),
    evidenceIds,
    identityAsset: AssetSourceSchema,
  })
  .strict()
  .refine((force) => ['image/png', 'image/jpeg'].includes(force.identityAsset.mediaType), {
    message: 'force identity must be a still image',
    path: ['identityAsset'],
  });

const ProgressionStepSchema = z
  .object({
    stepId: opaqueId,
    label: z.string().min(1).max(24),
    title: z.string().min(1).max(42).optional(),
    detail: z.string().min(1).max(90).optional(),
    media: AssetSourceSchema.optional(),
    evidenceIds,
  })
  .strict();

const SubjectSchema = z
  .object({
    subjectId: opaqueId,
    label: z.string().min(1).max(100),
    evidenceIds,
    subjectAsset: AssetSourceSchema,
  })
  .strict()
  .refine((subject) => ['image/png', 'image/jpeg'].includes(subject.subjectAsset.mediaType), {
    message: 'three-up subject must be a still image',
    path: ['subjectAsset'],
  });

const CoordinateSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();

const MapActorSchema = z
  .object({
    actorId: opaqueId,
    label: z.string().min(1).max(80),
    side: z.enum(['red', 'blue', 'neutral']),
    position: CoordinateSchema,
  })
  .strict();

const MapMovementSchema = z
  .object({
    movementId: opaqueId,
    actorId: opaqueId,
    label: z.string().min(1).max(100),
    from: CoordinateSchema,
    to: CoordinateSchema,
  })
  .strict();

const MapRankSchema = z
  .object({
    rankId: opaqueId,
    label: z.string().min(1).max(80),
    actorIds: z.array(opaqueId).min(1).max(20),
  })
  .strict();

const AuthoredPlateSchema = z
  .object({
    source: AssetSourceSchema,
    label: z.string().min(1).max(100),
  })
  .strict()
  .refine(
    (value) => !value.source.url || value.source.url.startsWith('blob:'),
    {
    message: 'map plates may use only their canonical artifact identity or a local staged asset',
    path: ['source'],
    },
  );

const OptionSchema = z
  .object({
    optionId: opaqueId,
    label: z.string().min(1).max(100),
    evidenceIds,
  })
  .strict();

const CampaignEventSchema = z
  .object({
    eventId: opaqueId,
    dateLabel: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    evidenceIds,
  })
  .strict();

const ArchivalDetailSchema = z
  .object({
    detailId: opaqueId,
    label: z.string().min(1).max(80),
    evidenceIds,
    source: AssetSourceSchema,
  })
  .strict();

const ContrastSourceSchema = z
  .object({
    sourceId: opaqueId,
    label: z.string().min(1).max(100),
    sourceKind: z.enum([
      'primary_document', 'painting', 'photograph', 'map', 'film_frame', 'artifact',
    ]),
    dateLabel: z.string().min(1).max(80),
    evidenceIds,
    source: AssetSourceSchema,
  })
  .strict();

const WC06_ENGINE_RECEIPT_SCHEMA = 'war-chess-wc06-engine-receipt.v1';
const WC06UciSchema = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const WC06_MOTIF_FENS = {
  knight_fork: '2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1',
  back_rank_mate: '6k1/5ppp/8/8/8/6P1/5P1P/4R1K1 w - - 0 1',
  queen_capture: '4k3/8/8/8/8/8/4r3/3Q2K1 w - - 0 1',
} as const;
const WC06PlanMoveSchema = z.object({
  ply: z.number().int().min(1).max(3),
  uci: WC06UciSchema,
  caption: z.enum(['Move', 'Best reply', 'Follow-up']),
}).strict();

const applyUciMove = (chess: Chess, uci: string): void => {
  const promotion = uci.slice(4) as 'q' | 'r' | 'b' | 'n' | '';
  const move = chess.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    ...(promotion ? {promotion} : {}),
  });
  if (!move) throw new Error(`illegal UCI move: ${uci}`);
};

export const WC06ChessPlanSchema = z.object({
  schemaVersion: z.literal(WC06_ENGINE_RECEIPT_SCHEMA),
  status: z.literal('verified'),
  motifId: z.enum(WC06_MOTIF_IDS),
  fen: z.string().trim().min(1).max(120),
  moves: z.array(WC06PlanMoveSchema).min(1).max(3),
  principalVariation: z.array(WC06UciSchema).min(1).max(32),
  engine: z.object({
    name: z.literal('Stockfish'),
    version: z.string().trim().min(1).max(80),
    settings: z.object({
      depth: z.number().int().min(1).max(64),
      movetimeMs: z.number().int().min(1).max(120_000),
      threads: z.literal(1),
      hashMb: z.number().int().min(1).max(1024),
      multipv: z.literal(1),
    }).strict(),
  }).strict(),
  score: z.object({
    kind: z.enum(['cp', 'mate']),
    value: z.number().int(),
  }).strict().nullable(),
  frozenBriefHash: hex64,
  componentBriefHash: hex64,
  receiptHash: hex64,
}).strict().superRefine((plan, context) => {
  if (plan.fen !== WC06_MOTIF_FENS[plan.motifId]) {
    context.addIssue({code: 'custom', message: 'WC06 motif must use its locked FEN', path: ['fen']});
  }
  if (plan.principalVariation.length < plan.moves.length) {
    context.addIssue({code: 'custom', message: 'WC06 move line exceeds its principal variation', path: ['moves']});
  }
  plan.moves.forEach((move, index) => {
    if (move.ply !== index + 1 || move.caption !== ['Move', 'Best reply', 'Follow-up'][index]) {
      context.addIssue({code: 'custom', message: 'WC06 move captions and ply numbers must be ordered', path: ['moves', index]});
    }
    if (plan.principalVariation[index] !== move.uci) {
      context.addIssue({code: 'custom', message: 'WC06 rendered moves must be the principal-variation prefix', path: ['moves', index, 'uci']});
    }
  });
  let chess: Chess;
  try {
    chess = new Chess(plan.fen);
  } catch {
    context.addIssue({code: 'custom', message: 'WC06 receipt FEN is not legal', path: ['fen']});
    return;
  }
  for (const [index, uci] of plan.principalVariation.entries()) {
    try {
      applyUciMove(chess, uci);
    } catch {
      context.addIssue({code: 'custom', message: 'WC06 receipt contains an illegal UCI move', path: ['principalVariation', index]});
      break;
    }
  }
});

export const ComponentSchemas = [
  ComponentBaseSchema.extend({
    componentType: z.literal('P01'),
    layer: z.literal('full_screen'),
    headline: z.string().trim().min(1).max(42).refine(
      (value) => {
        const words = value.split(/\s+/).filter(Boolean).length;
        return words >= 2 && words <= 8;
      },
      'P01 headline must contain two to eight words',
    ),
    emphasis: z.string().trim().min(1).max(32).nullable(),
    source: AssetSourceSchema,
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('P02'),
    layer: z.literal('full_screen'),
    headline: z.string().trim().min(1).max(66).refine(
      (value) => {
        const words = value.split(/\s+/).filter(Boolean).length;
        return words >= 2 && words <= 8;
      },
      'P02 headline must contain two to eight words',
    ),
    source: AssetSourceSchema,
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('P03'),
    layer: z.literal('full_screen'),
    headline: z.string().trim().min(1).max(66).refine(
      (value) => {
        const words = value.split(/\s+/).filter(Boolean).length;
        return words >= 2 && words <= 12;
      },
      'P03 headline must contain two to twelve words',
    ),
    highlightWords: z.array(z.string().trim().min(1).max(32).regex(/^\S+$/)).min(1).max(2),
    placement: z.enum(['bottom-left', 'bottom-right', 'top-left', 'center-left']),
    source: AssetSourceSchema,
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('P14'),
    layer: z.literal('full_screen'),
    year: z.string().regex(/^[0-9]{4}$/),
    source: AssetSourceSchema,
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC01'),
    layer: z.literal('full_screen'),
    forces: z.array(ForceSchema).length(2),
    title: z.string().min(1).max(100),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC02'),
    layer: z.literal('full_screen'),
    presentationVariant: z.enum(['anchored_progression_v2', 'person_marginalia_v3']).optional(),
    subject: z.string().min(1).max(42),
    title: z.string().min(1).max(100).optional(),
    subjectRole: z.string().min(1).max(100),
    anchorKind: z.enum(['person', 'place', 'object', 'document', 'group', 'symbol']).optional(),
    relationship: z.enum(['progression', 'contrast', 'cause_effect', 'facets', 'repeated_context']).optional(),
    relationshipLabel: z.string().min(1).max(40).optional(),
    subjectImage: AssetSourceSchema,
    subjectCutout: AssetSourceSchema,
    steps: z.array(ProgressionStepSchema).min(2).max(5),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC04'),
    layer: z.literal('full_screen'),
    mode: z.enum(['orientation', 'static_positions', 'tactical_movement', 'ranked_formation']),
    title: z.string().min(1).max(100),
    plate: AuthoredPlateSchema,
    actors: z.array(MapActorSchema).max(12),
    movementSteps: z.array(MapMovementSchema).max(5),
    ranks: z.array(MapRankSchema).max(8),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC06'),
    layer: z.literal('full_screen'),
    chessPlan: WC06ChessPlanSchema,
    title: z.string().min(1).max(100),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC07'),
    layer: z.literal('full_screen'),
    subjects: z.array(SubjectSchema).length(3),
    title: z.string().min(1).max(100),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC08'),
    layer: z.literal('overlay'),
    identity: z.string().min(1).max(100),
    place: z.string().min(1).max(100),
    label: z.string().min(1).max(120),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC09'),
    layer: z.literal('overlay'),
    value: z.string().min(1).max(80),
    unit: z.string().min(1).max(40),
    claimId: opaqueId,
    sourceClaim: z.string().min(1).max(160),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC10'),
    layer: z.literal('full_screen'),
    options: z.array(OptionSchema).min(2).max(4),
    chosenOptionId: opaqueId,
    chosenRevealFrame: z.number().int().positive().optional(),
    title: z.string().min(1).max(100),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC11'),
    layer: z.literal('full_screen'),
    events: z.array(CampaignEventSchema).min(2).max(6),
    eventStartFrames: z.array(z.number().int().nonnegative()).min(2).max(6).optional(),
    title: z.string().min(1).max(100),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC12'),
    layer: z.literal('overlay'),
    namedPerson: z.string().min(1).max(100),
    role: z.string().min(1).max(100),
    label: z.string().min(1).max(120),
    baseStartFrame: z.number().int().nonnegative(),
    baseEndFrameExclusive: z.number().int().positive(),
    cutout: AssetSourceSchema,
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC13'),
    layer: z.literal('full_screen'),
    documentLabel: z.string().min(1).max(100),
    dateLabel: z.string().min(1).max(80),
    detailLabel: z.string().min(1).max(100),
    title: z.string().min(1).max(100),
    takeaway: z.string().min(1).max(160),
    document: AssetSourceSchema,
    detail: AssetSourceSchema,
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC14'),
    layer: z.literal('full_screen'),
    sourceTitle: z.string().min(1).max(100),
    sourceLabel: z.string().min(1).max(100),
    source: AssetSourceSchema,
    details: z.array(ArchivalDetailSchema).min(2).max(4),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WC15'),
    layer: z.literal('full_screen'),
    relationship: z.enum([
      'plan_outcome', 'claim_consequence', 'advance_retreat',
      'competing_accounts', 'reviewed_contrast',
    ]),
    relationshipLabel: z.string().min(1).max(80),
    sources: z.array(ContrastSourceSchema).length(2),
  }).strict(),
  ComponentBaseSchema.extend({
    componentType: z.literal('WCFX01'),
    layer: z.literal('full_screen'),
    label: z.string().min(1).max(120),
    source: AssetSourceSchema,
    sourceStartFrame: z.number().int().nonnegative().optional(),
    sourceEndFrameExclusive: z.number().int().positive().optional(),
    sourceAudio: z.literal(false).optional(),
  }).strict(),
] as const;

export const RenderComponentSchema = z
  .discriminatedUnion('componentType', ComponentSchemas)
  .superRefine((component, context) => {
    if (component.endFrameExclusive <= component.startFrame) {
      context.addIssue({
        code: 'custom',
        message: 'component range is empty',
        path: ['endFrameExclusive'],
      });
    }
    if (component.componentType === 'P01') {
      const duration = component.endFrameExclusive - component.startFrame;
      if (duration < 90 || duration > 150) {
        context.addIssue({code: 'custom', message: 'P01 image must last three to five seconds', path: ['endFrameExclusive']});
      }
      if (!['image/png', 'image/jpeg'].includes(component.source.mediaType)) {
        context.addIssue({code: 'custom', message: 'P01 requires one reviewed still image', path: ['source', 'mediaType']});
      }
      if (component.baseSceneIds.length !== 1) {
        context.addIssue({code: 'custom', message: 'P01 must replace exactly one still-image scene', path: ['baseSceneIds']});
      }
      if (component.emphasis && !component.headline.toLocaleLowerCase().includes(component.emphasis.toLocaleLowerCase())) {
        context.addIssue({code: 'custom', message: 'P01 emphasis must occur in the headline', path: ['emphasis']});
      }
    }
    if (component.componentType === 'P02') {
      const duration = component.endFrameExclusive - component.startFrame;
      if (duration < 120 || duration > 150) {
        context.addIssue({code: 'custom', message: 'P02 image must last four to five seconds', path: ['endFrameExclusive']});
      }
      if (!['image/png', 'image/jpeg'].includes(component.source.mediaType)) {
        context.addIssue({code: 'custom', message: 'P02 requires one reviewed still image', path: ['source', 'mediaType']});
      }
      if (component.baseSceneIds.length !== 1) {
        context.addIssue({code: 'custom', message: 'P02 must replace exactly one still-image scene', path: ['baseSceneIds']});
      }
    }
    if (component.componentType === 'P03') {
      const duration = component.endFrameExclusive - component.startFrame;
      if (duration < 90 || duration > 150) {
        context.addIssue({code: 'custom', message: 'P03 image must last three to five seconds', path: ['endFrameExclusive']});
      }
      if (!['image/png', 'image/jpeg'].includes(component.source.mediaType)) {
        context.addIssue({code: 'custom', message: 'P03 requires one reviewed still image', path: ['source', 'mediaType']});
      }
      if (component.baseSceneIds.length !== 1) {
        context.addIssue({code: 'custom', message: 'P03 must replace exactly one still-image scene', path: ['baseSceneIds']});
      }
      const headlineWords = new Set(component.headline.split(/\s+/).map(normalizedDisplayWord));
      const highlights = component.highlightWords.map(normalizedDisplayWord);
      if (new Set(highlights).size !== highlights.length || highlights.some((word) => !word || !headlineWords.has(word))) {
        context.addIssue({code: 'custom', message: 'P03 highlights must be unique complete words from the headline', path: ['highlightWords']});
      }
    }
    if (component.componentType === 'P14') {
      const duration = component.endFrameExclusive - component.startFrame;
      if (duration < 90 || duration > 150) {
        context.addIssue({code: 'custom', message: 'P14 image must last three to five seconds', path: ['endFrameExclusive']});
      }
      if (!['image/png', 'image/jpeg'].includes(component.source.mediaType)) {
        context.addIssue({code: 'custom', message: 'P14 requires one reviewed still image', path: ['source', 'mediaType']});
      }
      if (component.baseSceneIds.length !== 1) {
        context.addIssue({code: 'custom', message: 'P14 must replace exactly one still-image scene', path: ['baseSceneIds']});
      }
    }
    if (component.componentType === 'WC01' && component.endFrameExclusive - component.startFrame !== 150) {
      context.addIssue({code: 'custom', message: 'WC01 must be exactly 150 frames', path: ['endFrameExclusive']});
    }
    if (component.componentType === 'WC01') {
      const forceIds = new Set(component.forces.map((force) => force.forceId));
      const sides = new Set(component.forces.map((force) => force.side));
      if (forceIds.size !== component.forces.length || sides.size !== 2) {
        context.addIssue({code: 'custom', message: 'WC01 requires two distinct opposing forces', path: ['forces']});
      }
    }
    if (component.componentType === 'WC02') {
      const stepIds = new Set(component.steps.map((step) => step.stepId));
      if (stepIds.size !== component.steps.length) {
        context.addIssue({code: 'custom', message: 'WC02 steps must be distinct and ordered', path: ['steps']});
      }
      if (component.subjectImage.mediaType !== 'image/png' || component.subjectCutout.mediaType !== 'image/png') {
        context.addIssue({code: 'custom', message: 'WC02 requires reviewed PNG subject image and cutout', path: ['subjectImage']});
      }
      if (component.presentationVariant === 'anchored_progression_v2') {
        if (!component.anchorKind || !component.relationship || !component.relationshipLabel) {
          context.addIssue({code: 'custom', message: 'WC02 v2 requires anchor and relationship semantics', path: ['presentationVariant']});
        }
        if (component.steps.some((step) => !step.title || !step.detail || !step.media)) {
          context.addIssue({code: 'custom', message: 'WC02 v2 requires reviewed media and display copy for every item', path: ['steps']});
        }
        if (component.steps.some((step) => step.media?.mediaType !== 'image/png')) {
          context.addIssue({code: 'custom', message: 'WC02 v2 progression media must be reviewed PNG stills', path: ['steps']});
        }
      }
      if (component.presentationVariant === 'person_marginalia_v3') {
        if (component.anchorKind !== 'person') {
          context.addIssue({code: 'custom', message: 'WC02 v3 requires a person anchor', path: ['anchorKind']});
        }
        if (!component.relationship || !component.relationshipLabel) {
          context.addIssue({code: 'custom', message: 'WC02 v3 requires relationship semantics', path: ['presentationVariant']});
        }
        if (component.steps.length !== 3) {
          context.addIssue({code: 'custom', message: 'WC02 v3 requires exactly three ordered steps', path: ['steps']});
        }
        if (!component.title) {
          context.addIssue({code: 'custom', message: 'WC02 v3 requires a title', path: ['title']});
        }
        if (component.steps.some((step) => step.media)) {
          context.addIssue({code: 'custom', message: 'WC02 v3 does not accept progression media', path: ['steps']});
        }
        if (component.steps.some((step) => !(step.title || step.label))) {
          context.addIssue({code: 'custom', message: 'WC02 v3 requires display text for every step', path: ['steps']});
        }
      }
    }
    if (component.componentType === 'WC04') {
      const actorIds = new Set(component.actors.map((actor) => actor.actorId));
      if (actorIds.size !== component.actors.length) {
        context.addIssue({code: 'custom', message: 'WC04 actor ids must be unique', path: ['actors']});
      }
      const movementIds = new Set(component.movementSteps.map((step) => step.movementId));
      if (movementIds.size !== component.movementSteps.length) {
        context.addIssue({code: 'custom', message: 'WC04 movement steps must be ordered and distinct', path: ['movementSteps']});
      }
      if (component.movementSteps.some((step) => !actorIds.has(step.actorId))) {
        context.addIssue({code: 'custom', message: 'WC04 movement actor is not declared', path: ['movementSteps']});
      }
      for (let index = 1; index < component.movementSteps.length; index += 1) {
        const previous = component.movementSteps[index - 1];
        const current = component.movementSteps[index];
        if (previous.actorId === current.actorId && (previous.to.x !== current.from.x || previous.to.y !== current.from.y)) {
          context.addIssue({code: 'custom', message: 'WC04 movement steps must connect for each actor', path: ['movementSteps', index]});
        }
      }
      const rankIds = new Set(component.ranks.map((rank) => rank.rankId));
      if (rankIds.size !== component.ranks.length || component.ranks.some((rank) => rank.actorIds.some((actorId) => !actorIds.has(actorId)))) {
        context.addIssue({code: 'custom', message: 'WC04 ranks must reference declared actors', path: ['ranks']});
      }
      if (component.mode === 'tactical_movement' && component.movementSteps.length === 0) {
        context.addIssue({code: 'custom', message: 'tactical movement requires ordered steps', path: ['movementSteps']});
      }
      if (component.mode !== 'tactical_movement' && component.movementSteps.length > 0) {
        context.addIssue({code: 'custom', message: 'movement steps are only valid for tactical movement', path: ['movementSteps']});
      }
      if (component.mode === 'ranked_formation' && component.ranks.length < 2) {
        context.addIssue({code: 'custom', message: 'ranked formation requires at least two ranks', path: ['ranks']});
      }
      if (component.mode === 'orientation' && (component.actors.length > 0 || component.ranks.length > 0)) {
        context.addIssue({code: 'custom', message: 'orientation maps cannot imply actor positions or ranks', path: ['actors']});
      }
      if (component.mode !== 'orientation' && component.actors.length === 0) {
        context.addIssue({code: 'custom', message: 'non-orientation maps require declared actors', path: ['actors']});
      }
    }
    if (component.componentType === 'WC06') {
      const duration = component.endFrameExclusive - component.startFrame;
      if (duration < 240 || duration > 600) {
        context.addIssue({code: 'custom', message: 'WC06 must cover 240 to 600 frames', path: ['endFrameExclusive']});
      }
    }
    const duration = component.endFrameExclusive - component.startFrame;
    const timing = component.narrationTiming;
    if (timing) {
      if (timing.status === 'unsupported') {
        context.addIssue({code: 'custom', message: 'Unsupported requested precision requires ordinary-media fallback', path: ['narrationTiming']});
      }
      if ((component.componentType === 'WC10' || component.componentType === 'WC11') && (duration < 150 || duration > 450)) {
        context.addIssue({code: 'custom', message: 'Component scene must cover 150 to 450 frames', path: ['endFrameExclusive']});
      }
      if (timing.status === 'measured' && !['WC10', 'WC11', 'WC12'].includes(component.componentType)) {
        context.addIssue({code: 'custom', message: 'Component does not support measured cues', path: ['narrationTiming']});
      }
      if ((timing.status === 'unsupported') !== (timing.reason === 'measured_words_unavailable')) {
        context.addIssue({code: 'custom', message: 'Precision fallback reason invalid', path: ['narrationTiming']});
      }
      const ownerStart = component.componentType === 'WC12' ? component.baseStartFrame : component.startFrame;
      const ownerEnd = component.componentType === 'WC12' ? component.baseEndFrameExclusive : component.endFrameExclusive;
      if (timing.owner_start_frame !== ownerStart || timing.owner_end_frame_exclusive !== ownerEnd ||
          (timing.status === 'measured') !== (timing.cues.length > 0) ||
          timing.cues.some(cue => cue.start_frame < ownerStart || cue.end_frame_exclusive > ownerEnd || cue.end_frame_exclusive <= cue.start_frame || cue.script_word_end_exclusive <= cue.script_word_start)) {
        context.addIssue({code: 'custom', message: 'Narration cue ownership invalid', path: ['narrationTiming']});
      }
      if (timing.status === 'measured' && component.componentType === 'WC12' &&
          (timing.cues.length !== 1 || timing.cues[0].target !== 'overlay_entry' || component.startFrame !== timing.cues[0].start_frame)) {
        context.addIssue({code: 'custom', message: 'Overlay cue binding invalid', path: ['startFrame']});
      }
    }
    if (component.componentType === 'WC10') {
      if (component.chosenRevealFrame !== undefined && (!timing || timing.status !== 'measured' || timing.cues.length !== 1 || timing.cues[0].target !== 'chosen_option' || component.chosenRevealFrame !== timing.cues[0].start_frame - component.startFrame || component.chosenRevealFrame < 30 * component.options.length || duration - component.chosenRevealFrame < 30)) {
        context.addIssue({code: 'custom', message: 'Choice cue binding invalid', path: ['chosenRevealFrame']});
      }
      if (timing?.status === 'measured' && component.chosenRevealFrame === undefined) {
        context.addIssue({code: 'custom', message: 'Choice cue control missing', path: ['chosenRevealFrame']});
      }
      const optionIds = new Set(component.options.map((option) => option.optionId));
      if (optionIds.size !== component.options.length || !optionIds.has(component.chosenOptionId)) {
        context.addIssue({code: 'custom', message: 'WC10 chosen option must be one declared option', path: ['chosenOptionId']});
      }
    }
    if (component.componentType === 'WC07') {
      const subjectIds = new Set(component.subjects.map((subject) => subject.subjectId));
      if (subjectIds.size !== component.subjects.length) {
        context.addIssue({code: 'custom', message: 'WC07 subjects must be distinct and ordered', path: ['subjects']});
      }
    }
    if (component.componentType === 'WC11') {
      const frames = component.eventStartFrames;
      if (frames !== undefined && (!timing || timing.status !== 'measured' || frames.length !== component.events.length || timing.cues.length !== frames.length || frames.some((frame, index) => (frames[index + 1] ?? duration) - frame < 30 || (index > 0 && frame <= frames[index - 1]) || timing.cues[index]?.target !== component.events[index].eventId || timing.cues[index]?.start_frame !== component.startFrame + frame))) {
        context.addIssue({code: 'custom', message: 'Chronology cue binding invalid', path: ['eventStartFrames']});
      }
      if (timing?.status === 'measured' && frames === undefined) {
        context.addIssue({code: 'custom', message: 'Chronology cue control missing', path: ['eventStartFrames']});
      }
      const eventIds = new Set(component.events.map((event) => event.eventId));
      if (eventIds.size !== component.events.length) {
        context.addIssue({code: 'custom', message: 'WC11 events must be distinct and ordered', path: ['events']});
      }
    }
    if (component.componentType === 'WC12') {
      const baseDuration = component.baseEndFrameExclusive - component.baseStartFrame;
      const overlayDuration = component.endFrameExclusive - component.startFrame;
      if (component.baseSceneIds.length !== 1) {
        context.addIssue({code: 'custom', message: 'WC12 must attach to exactly one base scene', path: ['baseSceneIds']});
      }
      if (baseDuration < 150 || baseDuration > 180) {
        context.addIssue({code: 'custom', message: 'WC12 base must be 150 to 180 frames', path: ['baseEndFrameExclusive']});
      }
      if (overlayDuration < 90 || overlayDuration > 120 || component.endFrameExclusive >= component.baseEndFrameExclusive) {
        context.addIssue({code: 'custom', message: 'WC12 overlay must be 90 to 120 frames and end before its base', path: ['endFrameExclusive']});
      }
      if (component.startFrame < component.baseStartFrame || component.endFrameExclusive > component.baseEndFrameExclusive) {
        context.addIssue({code: 'custom', message: 'WC12 overlay must stay within its base interval', path: ['startFrame']});
      }
      if (component.cutout.mediaType !== 'image/png') {
        context.addIssue({code: 'custom', message: 'WC12 requires a transparent PNG cutout', path: ['cutout', 'mediaType']});
      }
    }
    if (component.componentType === 'WC13') {
      if (![component.document.mediaType, component.detail.mediaType].every((type) => type === 'image/png' || type === 'image/jpeg')) {
        context.addIssue({code: 'custom', message: 'WC13 requires reviewed image document and detail assets', path: ['document']});
      }
    }
    if (component.componentType === 'WC14') {
      const detailIds = new Set(component.details.map((detail) => detail.detailId));
      if (detailIds.size !== component.details.length) {
        context.addIssue({code: 'custom', message: 'WC14 details must be distinct and ordered', path: ['details']});
      }
      if (![component.source.mediaType, ...component.details.map((detail) => detail.source.mediaType)].every((type) => type === 'image/png' || type === 'image/jpeg')) {
        context.addIssue({code: 'custom', message: 'WC14 requires a reviewed image source and image details', path: ['details']});
      }
    }
    if (component.componentType === 'WC15') {
      const sourceIds = new Set(component.sources.map((source) => source.sourceId));
      if (sourceIds.size !== 2 || component.sources.some((source) => source.source.mediaType !== 'image/png' && source.source.mediaType !== 'image/jpeg')) {
        context.addIssue({code: 'custom', message: 'WC15 requires two distinct reviewed image sources', path: ['sources']});
      }
    }
    if (component.componentType === 'WCFX01' && component.source.mediaType === 'video/mp4') {
      if (component.sourceStartFrame === undefined || component.sourceEndFrameExclusive === undefined || component.sourceAudio !== false) {
        context.addIssue({code: 'custom', message: 'WCFX01 video treatment requires a muted source range', path: ['source']});
      }
      if (component.sourceStartFrame !== undefined && component.sourceEndFrameExclusive !== undefined && component.sourceEndFrameExclusive <= component.sourceStartFrame) {
        context.addIssue({code: 'custom', message: 'WCFX01 video source range is empty', path: ['sourceEndFrameExclusive']});
      }
    }
  });

export type RenderComponent = z.infer<typeof RenderComponentSchema>;

export const WarChessRenderSpecSchema = z
  .object({
    schemaVersion: z.literal('vpp-war-chess-render-spec.v1'),
    jobId: opaqueId,
    templateId: z.literal('war_chess'),
    templateVersion: z.literal('r4'),
    compositionId: z.literal('WarChessMaster'),
    width: z.literal(1920),
    height: z.literal(1080),
    fps: z.literal(30),
    durationInFrames: z.number().int().positive(),
    voiceover: AssetSourceSchema,
    scenes: z.array(RenderSceneSchema).min(1).max(1000),
    components: z.array(RenderComponentSchema).max(256).default([]),
    componentManifestHash: hex64,
    componentQcHash: hex64,
    captions: CaptionCuesSchema,
    selectedSetHash: hex64,
    timelineHash: hex64,
    attributionHash: hex64,
    rendererBuildHash: hex64,
    dependencyLockHash: hex64,
    rightsManifestHash: hex64,
    fixtureOnly: z.boolean(),
    commercialUseCertified: z.boolean(),
    renderSpecHash: hex64,
  })
  .strict()
  .superRefine((spec, context) => {
    let cursor = 0;
    let previousClip: Extract<(typeof spec.scenes)[number], {kind: 'real_clip'}> | undefined;
    let continuousClipFrames = 0;
    const scenesById = new Map<string, (typeof spec.scenes)[number]>();
    for (const [index, scene] of spec.scenes.entries()) {
      if (scene.startFrame !== cursor) {
        context.addIssue({
          code: 'custom',
          message: 'scene partition is not contiguous',
          path: ['scenes', index, 'startFrame'],
        });
      }
      if (scenesById.has(scene.sceneId)) {
        context.addIssue({code: 'custom', message: 'scene ids must be unique', path: ['scenes', index, 'sceneId']});
      }
      scenesById.set(scene.sceneId, scene);
      if (scene.kind === 'real_clip') {
        const sameSource = previousClip && (
          scene.source.artifactId === previousClip.source.artifactId ||
          scene.source.sha256 === previousClip.source.sha256 ||
          (scene.sourceIdentity !== undefined && scene.sourceIdentity === previousClip.sourceIdentity)
        );
        const continuous = sameSource && previousClip && scene.startFrame === previousClip.endFrameExclusive &&
          scene.sourceStartFrame === previousClip.sourceStartFrame + previousClip.endFrameExclusive - previousClip.startFrame;
        const duration = scene.endFrameExclusive - scene.startFrame;
        continuousClipFrames = continuous ? continuousClipFrames + duration : duration;
        if (continuousClipFrames > 150) {
          context.addIssue({code: 'custom', message: 'continuous sourced footage must not exceed 150 frames across adjacent scenes', path: ['scenes', index]});
        }
        previousClip = scene;
      } else {
        previousClip = undefined;
        continuousClipFrames = 0;
      }
      cursor = scene.endFrameExclusive;
    }
    if (cursor !== spec.durationInFrames) {
      context.addIssue({
        code: 'custom',
        message: 'scene partition does not cover the composition duration',
        path: ['scenes'],
      });
    }
    const fullScreenComponents = spec.components
      .filter((component) => component.layer === 'full_screen')
      .sort((a, b) => a.startFrame - b.startFrame);
    const componentIds = new Set<string>();
    for (const [index, component] of spec.components.entries()) {
      if (componentIds.has(component.componentId)) {
        context.addIssue({code: 'custom', message: 'component ids must be unique', path: ['components', index, 'componentId']});
      }
      componentIds.add(component.componentId);
      if (new Set(component.baseSceneIds).size !== component.baseSceneIds.length) {
        context.addIssue({code: 'custom', message: 'component base scene ids must be unique', path: ['components', index, 'baseSceneIds']});
      }
      if (new Set(component.parentUnitIds).size !== component.parentUnitIds.length) {
        context.addIssue({code: 'custom', message: 'component parent unit ids must be unique', path: ['components', index, 'parentUnitIds']});
      }
    }
    for (let index = 0; index < fullScreenComponents.length; index += 1) {
      const component = fullScreenComponents[index];
      const referenced = component.baseSceneIds.map((id) => scenesById.get(id));
      if (referenced.some((scene) => !scene)) {
        context.addIssue({code: 'custom', message: 'component references an unknown base scene', path: ['components']});
        continue;
      }
      const ordered = referenced as (typeof spec.scenes)[number][];
      if (ordered.some((scene, sceneIndex) => sceneIndex > 0 && scene.startFrame < ordered[sceneIndex - 1].startFrame)) {
        context.addIssue({code: 'custom', message: 'component base scenes must be declared in story order', path: ['components']});
      }
      if (component.startFrame !== ordered[0].startFrame || component.endFrameExclusive !== ordered[ordered.length - 1].endFrameExclusive) {
        context.addIssue({code: 'custom', message: 'full-screen component must cover its declared base interval', path: ['components']});
      }
      for (let sceneIndex = 1; sceneIndex < ordered.length; sceneIndex += 1) {
        if (ordered[sceneIndex - 1].endFrameExclusive !== ordered[sceneIndex].startFrame) {
          context.addIssue({code: 'custom', message: 'full-screen component base scenes must be contiguous', path: ['components']});
        }
      }
      const previous = fullScreenComponents[index - 1];
      if (previous && previous.endFrameExclusive > component.startFrame) {
        context.addIssue({code: 'custom', message: 'full-screen components may not overlap', path: ['components']});
      }
      if (previous && previous.endFrameExclusive === component.startFrame && previous.componentType === component.componentType) {
        context.addIssue({code: 'custom', message: 'identical full-screen variants may not be adjacent', path: ['components']});
      }
    }
    for (const [index, component] of spec.components.entries()) {
      if (component.endFrameExclusive > spec.durationInFrames) {
        context.addIssue({code: 'custom', message: 'component exceeds the composition duration', path: ['components', index, 'endFrameExclusive']});
      }
      const referenced = component.baseSceneIds.map((id) => scenesById.get(id));
      if (referenced.some((scene) => !scene)) continue;
      const ordered = referenced as (typeof spec.scenes)[number][];
      if (ordered.some((scene, sceneIndex) => sceneIndex > 0 && scene.startFrame < ordered[sceneIndex - 1].startFrame)) {
        context.addIssue({code: 'custom', message: 'component base scenes must be declared in story order', path: ['components', index, 'baseSceneIds']});
      }
      const expectedParentUnitIds = ordered.reduce<string[]>((ids, scene) => {
        if (!ids.includes(scene.parentUnitId)) ids.push(scene.parentUnitId);
        return ids;
      }, []);
      if (
        component.parentUnitIds.length !== expectedParentUnitIds.length ||
        component.parentUnitIds.some((parentUnitId, parentIndex) => parentUnitId !== expectedParentUnitIds[parentIndex])
      ) {
        context.addIssue({
          code: 'custom',
          message: 'component parent unit ids must match its base scenes in story order',
          path: ['components', index, 'parentUnitIds'],
        });
      }
      if (component.layer === 'overlay') {
        if (component.baseSceneIds.length !== 1) {
          context.addIssue({code: 'custom', message: 'overlays must declare one base scene', path: ['components', index, 'baseSceneIds']});
        }
        const base = referenced[0];
        if (base && (component.startFrame < base.startFrame || component.endFrameExclusive > base.endFrameExclusive)) {
          context.addIssue({code: 'custom', message: 'overlay must remain inside its base scene', path: ['components', index]});
        }
      }
      if (component.componentType === 'P01' && ordered[0]?.kind !== 'animated_still') {
        context.addIssue({code: 'custom', message: 'P01 may replace only an animated-still scene', path: ['components', index, 'baseSceneIds']});
      }
      if (component.componentType === 'P02' && ordered[0]?.kind !== 'animated_still') {
        context.addIssue({code: 'custom', message: 'P02 may replace only an animated-still scene', path: ['components', index, 'baseSceneIds']});
      }
      if (component.componentType === 'P03' && ordered[0]?.kind !== 'animated_still') {
        context.addIssue({code: 'custom', message: 'P03 may replace only an animated-still scene', path: ['components', index, 'baseSceneIds']});
      }
      if (component.componentType === 'P14' && ordered[0]?.kind !== 'animated_still') {
        context.addIssue({code: 'custom', message: 'P14 may replace only an animated-still scene', path: ['components', index, 'baseSceneIds']});
      }
    }
    const p14Components = spec.components.filter((component) => component.componentType === 'P14');
    const wc12Components = spec.components.filter((component) => component.componentType === 'WC12');
    for (const p14 of p14Components) {
      for (const wc12 of wc12Components) {
        if (p14.startFrame < wc12.endFrameExclusive && wc12.startFrame < p14.endFrameExclusive) {
          context.addIssue({code: 'custom', message: 'P14 and WC12 may not overlap in rendered time', path: ['components']});
        }
      }
    }
    for (const [index, cue] of spec.captions.entries()) {
      if (cue.endFrameExclusive > spec.durationInFrames) {
        context.addIssue({
          code: 'custom',
          message: 'caption exceeds the composition duration',
          path: ['captions', index, 'endFrameExclusive'],
        });
      }
    }
    if (spec.commercialUseCertified && spec.fixtureOnly) {
      context.addIssue({
        code: 'custom',
        message: 'fixture output cannot be commercially certified',
        path: ['commercialUseCertified'],
      });
    }
  });

export type RenderScene = z.input<typeof RenderSceneSchema>;
export type WarChessRenderSpec = Omit<z.infer<typeof WarChessRenderSpecSchema>, 'scenes'> & {
  scenes: RenderScene[];
};
