/**
 * @vg/core — the spine.
 *
 * Every other package imports the contract from here and never redeclares it.
 *
 * Client bundles should import the subpath `@vg/core/schemas` instead of this
 * barrel: the barrel pulls in `node:fs` and `node:crypto` through storage.ts and
 * renderKey.ts.
 */

export * from './devices.js'
export * from './deviceChoice.js'
export * from './homonym.js'
/*
 * BARREL ONLY, AND NEVER A SUBPATH. `sections.ts` is what fills
 * `DeviceBeat.editorialTitle`, and the compositor imports exactly four subpaths
 * of this package — schemas, devices, frames, motion. Giving this one a subpath
 * would invite an import from `apps/web/src/remotion`, which would fold it into
 * `bundleHash` and turn every future edit to it into a full re-render of the
 * client's film. See the box at the top of that file, and trap SS.
 */
export * from './sections.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `sections.js` above.
 * `apps/web/src/remotion` imports @vg/core/{schemas,devices,frames,motion} and
 * nothing else, so a barrel export cannot move `bundleHash`. Adding
 * `./visualPlan` to package.json's exports map would.
 */
export * from './visualPlan.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS again. `assignment.ts` decides
 * which picture every shot of the film draws, so it will be edited often; a
 * subpath here would fold it into `bundleHash` and turn each of those edits
 * into a full re-render of the client's film. It has no compositor caller and
 * never will, because it runs in the worker before a plan exists.
 */
export * from './assignment.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `operatorPlacement.ts` is the
 * check a hand-placed device passes in the worker's plan stage; the compositor
 * never needs it, and a subpath would fold it into `bundleHash`.
 */
export * from './operatorPlacement.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `shadowUpFit.ts` measures a
 * template 05 line inside the chooser. The compositor draws the line and never
 * measures it, and a subpath would fold the mirror into `bundleHash`.
 */
export * from './shadowUpFit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS, same as `shadowUpFit.ts` above and
 * for the same reason. `bulletChecklistFit.ts` measures a7's title and rows
 * inside the chooser; the compositor draws them and never measures them.
 */
export * from './bulletChecklistFit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `p04Fit.ts` measures P04's label
 * and support line inside the chooser; the compositor draws them and never
 * measures them, and a subpath would fold the mirror into `bundleHash`.
 */
export * from './p04Fit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `p02Fit.ts` measures P02's label
 * and headline inside the chooser; the compositor draws them and never measures
 * them, and a subpath would fold the mirror into `bundleHash`.
 */
export * from './p02Fit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `p09Fit.ts` measures P09's section
 * label and question inside the chooser; the compositor draws them and never
 * measures them, and a subpath would fold the mirror into `bundleHash`.
 */
export * from './p09Fit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `p05Fit.ts` measures P05's eyebrow,
 * headline, support line and picture label inside the chooser; the compositor
 * draws them and never measures them, and a subpath would fold the mirror into
 * `bundleHash`.
 */
export * from './p05Fit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `chapterPlateFit.ts` measures the
 * chapter plate's heading inside the chooser; the compositor draws it and never
 * measures it, and a subpath would fold the Playfair Display advance table into
 * `bundleHash` — which would turn every future correction of a single glyph
 * width into a full re-render of the film.
 */
export * from './chapterPlateFit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `topTitleFit.ts` measures the two
 * top-title lines inside the chooser; the compositor draws them and never
 * measures them, and a subpath would fold the mirror into `bundleHash`.
 */
export * from './topTitleFit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS. `cornerLabelFit.ts` measures the
 * corner label and its kicker inside the chooser, in the CAPITALS the component
 * draws; the compositor draws them and never measures them, and a subpath would
 * fold the two mirrors into `bundleHash`.
 */
export * from './cornerLabelFit.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS, and here the rule earns its keep
 * twice over. `typeGround.ts` holds the LEGIBILITY THRESHOLDS — the region
 * level, the one-letter contrast floor and the printed-matter ceiling — and
 * those are numbers a person will want to retune after looking at a frame.
 * Kept out of the bundle they cost a re-plan of the shots that change; folded
 * into `bundleHash` through a subpath they would cost the full 87 minutes
 * every time somebody moved one by a hundredth.
 */
export * from './typeGround.js'
export * from './schemas.js'
/*
 * A SUBPATH AS WELL, ON PURPOSE, and the opposite call from the barrel-only
 * files above. `Scene.tsx` draws the clips this table names, so it must reach
 * it, and a change to what a row DRAWS should move `bundleHash`.
 * `bundleGraph.test.ts` lists it, and refuses any density number in it.
 */
export * from './effects.js'
/*
 * THE BARREL ONLY, NEVER A SUBPATH. Trap SS, and the other half of the call
 * above. `effectDensity.ts` holds how OFTEN each clip fires, which only the
 * planner and T-24 read. A subpath would invite the compositor to import it
 * and put a density tweak back into `bundleHash`, re-rendering the whole film.
 */
export * from './effectDensity.js'
export * from './frames.js'
export * from './rhythm.js'
export * from './motion.js'
export * from './crop.js'
export * from './renderKey.js'
export * from './storage.js'
export * from './aligner.js'
export * from './repair.js'
export * from './llm.js'
