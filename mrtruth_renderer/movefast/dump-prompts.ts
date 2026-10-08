// MoveFast-owned (Mr Truth). Run by update_mrtruth.sh from the repo's apps/worker with its tsx:
// writes the repo's planning prompts, fully resolved, to mrtruth_renderer/prompts.json.
import { writeFileSync } from 'node:fs'
import * as seg from './src/llm/anthropic.js'
import * as vp from './src/llm/anthropic-visual-plan.js'
import * as gem from './src/llm/gemini.js'
import * as res from './src/llm/anthropic-research.js'
import * as arch from './src/llm/anthropic-archive-names.js'
const pick = (m: Record<string, unknown>, k: string): string => {
  const v = m[k]
  if (typeof v !== 'string') throw new Error(`prompt ${k} missing from the repo`)
  return v
}
writeFileSync(process.argv[2], JSON.stringify({
  segmentation: pick(seg, 'SEGMENTATION_SYSTEM_PROMPT'), visual_plan: pick(vp, 'VISUAL_PLAN_SYSTEM_PROMPT'),
  vision: pick(gem, 'VISION_SYSTEM_PROMPT'), research: pick(res, 'RESEARCH_SYSTEM_PROMPT'),
  archive_names: pick(arch, 'ARCHIVE_NAMES_SYSTEM_PROMPT'),
}, null, 1))
