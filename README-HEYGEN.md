# HeyGen illustrative Documentary footage

HeyGen is an optional Documentary director tool when `HEYGEN_API_KEY` is present
and the existing **AI images** option is enabled. Other styles do not use it.
Real media stays prominent. The director may choose **zero to five** useful
illustrative shots, never a quota or a per-minute cadence. Each clip is **five
seconds**, **480p** by default, and its complete displayed interval must be inside
**0–300 seconds**. A shot at 295 seconds is allowed; one at 296 is omitted.

The director/review writes `cue`, exact `words`, `reason`, `brief`, and the complete
T2V `prompt`. Match the narrated object and useful action. Specify camera body,
lens/aperture, available light and ordinary texture; show one coherent action at
real-time speed, including tool-material contact and stable machine geometry.
Use a fixed camera unless movement helps show the action. No invented markings,
logos, text, archival claims, arbitrary drift, narration or music. Generated
imagery is contextual illustration, never authenticated evidence of a named
machine, person or event. Prompt enhancement is disabled and final audio removed.

`director.py` aligns the cue, checks the whole interval and caps all merged
drafts/review choices. HeyGen scenes are never shifted to make room. Generation
waits until the actual DLC timeline is assembled; a collision is omitted before
submission. The current subtitle clock is checked again, so stale cached moments
are omitted rather than moved away from their narrated words. Final assembly
checks actual cumulative timing/count, source duration, silence and media reuse,
including cached motion scenes and renamed generated files. The existing global
five-second footage maximum still applies.

The job's `heygen/` folder contains prepared `moments.json`, an effective policy
snapshot, raw downloads with client sidecars/job IDs, silent H.264 clips,
`ledger.json`, and `media.json`. Scene clearing/force removes only its moments and
policy snapshot; raw assets, clips, identities and paid-attempt ledger survive.
Each new prompt reserves an attempt before calling the client. Failed, interrupted
and uncertain attempts count toward the maximum, are omitted on subsequent runs,
and never cause automatic paid retry or provider fallback. Reusing the same
prompt at the same cue reuses a verified completed clip; it cannot create a new
asset name or be shown twice. Missing/changed assets are omitted without another
submission. A changed resolution or cue for an already attempted prompt requires
manual attention, not another paid job. Failure retains the existing underlying
coverage. Preserve the ledger and sidecars; uncertain jobs need account
reconciliation. Old plans without HeyGen moments do not invent new paid work.

For an explicit creator instruction, manually author **only** the needed fields
in the job root's `heygen_policy.json`:

```json
{"max_clips": 3, "window_seconds": 420, "resolution": "768p"}
```

These are the only accepted keys. `max_clips` must be a nonnegative integer;
`window_seconds` must be a finite nonnegative number; resolution must be `480p`
or `768p`. Unspecified fields keep the defaults (5, 300, 480p). A malformed policy
fails closed. The effective policy is frozen for plan, review, generation and
final validation. Explicitly clear/replan scenes to apply a changed policy; the
paid ledger remains intact, so lowering a limit cannot erase prior attempts.
AI output and free-text creator instructions cannot alter these limits. Duration
is not an override: generation/display remains five seconds, with no looping,
freezing or padding. Sources with unsupported frame cadence or insufficient
frames are omitted for manual inspection.

The standalone `heygen.py` client remains available for explicit tests with its
documented T2V/I2V contract; the Documentary integration uses T2V only. No other
provider defaults, dependencies or UI controls change.
