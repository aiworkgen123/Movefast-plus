# War Chess editing — the War Chess channel and Documentary

**Since 4 Oct 2026 War Chess is its own channel** (`styles/war_chess.json`, label "War Chess").
It is Documentary plus the chess boards, in the paper look:

| | Documentary | War Chess |
|---|---|---|
| MoveFast tools (maps, headlines, Vox, spotlights, …) | yes | yes |
| War Chess edits (WC01–WC15, P01–P14, war_chess_fx) | yes, **except WC06 chess boards** | yes, **WC06 chess boards are a normal option** |
| Construction Legends edits (`legends.py`, the shared pool) | yes, Documentary colours | yes, paper colours (`look.legends_skin: "war-chess"`) |
| Bowed grid, film burn, red wash | yes | yes |

The War Chess channel is in the Documentary family (`"family": "documentary"`): every rule
that says "Documentary" (real media first, film look, the director's offers, clean renders)
applies to it too — `styles.is_documentary(name)` is the one check. Keep **Motion graphics**
on to use the War Chess and Construction Legends edits. Other MoveFast styles receive neither.

## Choosing an edit

Choose the treatment that answers the viewer's question at the spoken beat.
A mentioned name, number, place or date is an opportunity, not an automatic
full-screen graphic. Keep real footage prominent. WC08–WC12 are
composited over the actual footage; they do not turn it into a text slide.

Target 40–50% of placements with useful text or template graphics. Small factual
labels of 1–6 words count. Atmosphere and frames do not count toward that target.
Use P01/P02 headlines when clear emphasis helps the explanation, with enough space and reading time.
The target is an editorial instruction, not a reason to invent unsupported edits or discard
a useful nonoverlapping Documentary scene solely for crossing a scene-share percentage;
the job's `war_chess/coverage.json` reports actual coverage, including existing
MoveFast scenes and labels. A skipped treatment is reported, not counted as rendered.

Preserve normal shot pacing, useful action and reading time. There is no mandatory
six-second plain-footage gap. Never stretch narration, loop video or freeze it to
fill a gap. Most stills stay static; about one in four can use a gentle move.
Narration subtitles are controlled separately and are not enabled by this pack.

War Chess preserves MoveFast's original channel dust setting; it adds no film-dust
particle layer, including when an older plan requests it. Documentary's original
setting has added dust off. The director can choose smoke/ash, snowfall, or a frame
when contextually appropriate. These are presentation effects, not historical
evidence. Chapter and CTA cards remain on fitting media. A subscribe request gets
a short SUBSCRIBE overlay.

Every substantial edit carries a concrete reason and brief.
Use the enabled catalogue's situational notes below to assess meaningful lists, sequences,
contrasts, quantities and details. Both Documentary drafts and the existing one whole-video
review see these notes; disabled tools receive no notes. The review inspects missed opportunities
where proposed visuals leave those points unexplained, adds suitable treatments when they improve
understanding, and preserves strong choices and useful explanatory footage.

Each meaningful narration beat needs purposeful visual development: useful action in real footage,
a reveal/change of relevant imagery, annotation, comparison or explanatory animation advancing its
point. Avoid passive generic coverage carrying multiple distinct ideas without a visual response.
This is not mandatory text or a full-screen template on every sentence, or arbitrary motion.
Keep normal reading/pacing, continuous underlying footage at most five seconds, and no loop/freeze
or exact subject-media reuse. The 40–50% target is advisory, not a ceiling on useful editing.

No quota or forced rotation. Vox remains fully available with no cap or mandatory cadence.
Documentary scene arbitration keeps the existing tool ranks without demoting an edit solely
because its family was used nearby. Scene-share percentages are advisory for Documentary;
actual timing bounds, gaps, collisions and cue/source/media safeguards still apply.
Other styles retain their existing scene-share caps.
Media IDs must be unique and alphanumeric (for example A1/A2). Component image fields reference
the actual provided ID with a `$` prefix, such as `$PRECISION` or `$JOINING`; no aliases are created.
Do not reuse the **exact media** merely because it is suitable B-roll. Cropping,
zooming, format conversion and new labels do not create a new source. Existing
`media_reuse.json` reviewed detail/comparison/callback exceptions still apply.
Within WC13/WC14, showing the original followed by its actual detail crops is the
purpose of the component; subsequent reuse elsewhere still requires an exception.
When coverage runs short, find another suitable source, continue useful action
within the source duration, or use a factually justified explanatory visual.

## Situational MoveFast notes

These are editorial options, not new output fields, automatic assignments, quotas or prescribed rotation.
The existing tool catalogue still supplies factual, media, duration and count constraints.

| Tool / subtype | Useful when | Viewer benefit | Example |
| --- | --- | --- | --- |
| map | location or distance changes the explanation | understands where the action fits | locate a river crossing and the nearby town |
| spotlight | a public person's identity or a documented place/event matters | connects the account to a real subject | identify the engineer behind a design using a reviewed photograph |
| object | a physical item or grouped components need to be seen | recognizes the parts and their relationship | show three or four pieces in the existing object-row, keeping every listed item |
| headline | a reported claim or named page needs its real source | sees the evidence rather than an unsupported assertion | highlight the actual report announcing a closure |
| strip | two or three distinct real photographs clarify a public person's identity | sees the subject across relevant views | an introduction supported by archive portraits |
| press | an era's printed report is the evidence | sees how the event was reported at the time | inspect a real newspaper's announcement |
| matchcut | a public person's introduction benefits from six to ten distinct real views | recognizes the same person across photographs | align archive portraits at a first introduction, within the existing once-only rule |
| textcut | three to five supported facts build a compact point | follows the accumulation without a long paragraph | stated milestones over distinct relevant photographs, within the existing once-only rule |
| vox | a mechanism or connected relationship needs several relevant images | follows how the pieces connect or cause an outcome | trace a pump, pipe and reservoir with media-led composition and supporting labels |
| text | identification or concise explanation is enough over useful footage | understands the current action without replacing it | name/place/date/number identifies what matters; a short phrase such as ALIGN BEFORE JOINING explains a supported operation. Faithful concise paraphrases are allowed, never running subtitles |
| graphic.dateline | a stated date/location establishes context | follows a time change | mark the documented opening date |
| graphic.number | one consequential quantity needs scale and units | grasps its significance | a stated capacity with its unit and source |
| graphic.chart | three or more real quantities need comparison | sees the relative differences | compare documented outputs of three plants; never chart a part against its whole |
| graphic.timeline | dated events explain a development | follows the chronology | order supported opening, expansion and closure dates |
| graphic.quote | documented exact words carry the point | hears the claim in its attributed form | a verified statement by the named speaker |
| graphic.pivot | the argument makes a real turn | recognizes why the next idea changes the explanation | a concise supported contrast at the turning point |
| graphic.question | a real unresolved question motivates the next explanation | knows what the following evidence must answer | WHY THIS ROUTE? at a documented route-choice problem |
| graphic.step | a stated process stage benefits from a short signpost | follows the established order | label the measured inspection stage, without inventing steps |
| graphic.card | a short factual explanation needs a clear phrase | remembers the relationship | summarize a supported requirement with concise emphasis |
| graphic.social | a documented follow/unfollow changes the relationship | understands the public connection | show the reported action between the two named people |
| graphic.place | a move to a real city matters | recognizes the new setting | the named city and country at the move |
| graphic.pull | an article's exact sentence is consequential evidence | sees the wording and attribution | a verified sentence with outlet, writer and date |
| graphic.table | two to five sourced rows benefit from compact inspection | compares the facts without losing their units | documented specifications with a real source |

## Available templates

| Template | Useful when | Viewer benefit | Example | Required media / limits |
| --- | --- | --- | --- | --- |
| P01 | a short factual point needs clear emphasis | recognizes the key claim without a paragraph | emphasize a documented bottleneck over a relevant still | Real still; 2–8 words, at most 42 characters; 3–5 seconds |
| P02 | a compact editorial thought clarifies a turn | understands the consequence | a concise supported explanation over a relevant still | Real still; 2–8 words, at most 66 characters; 4–5 seconds |
| P03 | one or two complete words carry the contrast | notices the distinction within a short phrase | highlight the consequential term in a supported claim | Real still; 2–12 words, at most 66 characters; highlight 1–2 complete words; 3–5 seconds |
| P14 | a spoken four-digit year anchors a change | places the event in time | the stated year a bridge opened | Real still; exactly four digits; 3–5 seconds |
| WC01 | two documented opposing sides need to be understood together | recognizes who opposes whom | two real teams in a documented contest | Two distinct real identity images; 5 seconds |
| WC02 | progression or relationships revolve around one anchor | connects the steps or items to their common subject | an anchored machine with 2–5 imaged stages; person-only marginalia with exactly three text steps, never a machine anchor | Real anchor and cutout; anchored_progression_v2 uses 2–5 imaged steps; person_marginalia_v3 is person-only with exactly three text steps, never a machine anchor; 8–20 seconds |
| WC04 | a named location needs geographical orientation | understands the setting in its surroundings | a reviewed map plate locating a port; no tactical arrows | Reviewed map plate; orientation mode only; 5–15 seconds |
| WC06 | a clearly labelled chess analogy explains a real strategic relationship | understands the double threat or constraint | a supported strategic fork, with local Stockfish supplying legal moves | Local Stockfish-verified knight fork, back-rank mate or queen capture; 8–20 seconds |
| WC07 | exactly three distinct subjects form a meaningful group or comparison | recognizes the set and differences together | three real equipment images; four items use object-row or suitable WC02, never drop one | Three distinct real reviewed images; never drop a fourth item to fit; 5–10 seconds |
| WC08 | identity or location needs a concise label on useful real footage | recognizes what the action shows | label the documented location without replacing the shot | Actual underlying footage; 3–5 seconds |
| WC09 | a consequential quantity needs units and the narration claim | grasps the scale while seeing the subject | a stated carrying capacity over relevant real footage | Actual underlying footage and supporting narration claim; 3–5 seconds |
| WC10 | an actual choice between 2–4 documented options explains the outcome | sees the alternatives and the real selection | documented route options in an abstract decision overlay | 2–4 real options and the actual chosen option; abstract decision surface; 5–15 seconds |
| WC11 | 2–6 factual events or established ordered process steps explain progression | follows the order over real media | harvest, mill, pack with sequence/step labels when undated; never invent dates or order | 2–6 events/steps; timeline overlay; sequence/step labels for undated steps, never invented dates or order; 5–15 seconds |
| WC12 | a named public person needs a first introduction on real footage | identifies the person without losing the action | a real portrait cutout beside the spoken introduction | Real transparent portrait cutout; 3–4 second overlay within a 5–6 second base shot |
| WC13 | a legible document detail supports the claim | can inspect the evidence | an actual specification and its inspected detail crop; never invent a quotation | Real full document and an inspected crop of its actual detail; 5–10 seconds |
| WC14 | 2–4 meaningful visible details in one archival image need attention | understands what to look at within that source | reviewed details within a real workshop photograph | Real source and 2–4 inspected crops from that source; 5–10 seconds |
| WC15 | two distinct reviewed sources support a consequential contrast | understands the relationship rather than seeing two disconnected pictures | two real sources showing documented before/after conditions | Two distinct reviewed images and a supported relationship; 5–10 seconds |

WC03 and WC05 are intentionally unavailable. WC04 tactical movement and formation
modes are not offered. WC10 and WC11 are available in the limited modes above.
The AI never supplies chess positions, moves, evaluations or a fake engine receipt.
Unsupported media or facts cause a reported skip; ordinary contextual media remains.

## Files and operation

- `warchess.py`: active catalog, selection instructions, sourcing and timeline bridge.
- `war_chess_renderer/src/MoveFast.tsx`: individual components and footage overlays.
- `war_chess_renderer/src/schema.ts`: input validation and text-card limits.
- `war_chess_renderer/reference/`: original transferred VPP definitions and guide,
  retained as historical reference. They are not MoveFast's active policy.
- `director.py`: chooses the moments together with MoveFast's original tools.
- Each Documentary job's `director_raw.json`: original merged parallel draft.
- `director_review.json`: one whole-video review with `status` (`success` or `failed`),
  `original_draft`, `reviewed_items` (null on failure), and `error`. Both outcomes are cached;
  failure keeps the draft and is not retried automatically. Interrupted reviews become failed on
  resume. Existing completed `director.json` jobs are not silently reviewed. Explicit force/scene
  clearing removes the review cache; force also refreshes the raw draft.
- Each job's `war_chess/report.json`: rendered and skipped components, with reasons.

The bridge reuses MoveFast's existing real-photo search, image review and configured
background-removal provider for cutouts. Text/image review uses MoveFast's configured
language provider. No VPP database/server is needed. Node/Remotion dependencies on this
Mac reuse the already-installed 4.0.509 runtime via local links; keep those linked
runtime folders in place. WC06 also requires local Stockfish. No paid calls are retried
by this bridge after a cached component failure. A fresh job can make a fresh attempt.
