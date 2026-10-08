// MoveFast-owned (Mr Truth). Renders a list of the repo's scenes through its own `Segment` composition
// (or `Direct` for a switched-off template's preview). Request JSON:
//   {bundleDir, storageDir, concurrency, tasks: [{id, props, output}]}
// Pictures are referenced in props as "/storage/<path under storageDir>".
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {bundle} = require('@remotion/bundler');
const {selectComposition, renderMedia, openBrowser} = require('@remotion/renderer');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = path.resolve(request.bundleDir);
const core = path.join(root, 'src/core');
if (!fs.existsSync(path.join(dir, 'index.html'))) {
  await bundle({entryPoint: path.join(root, 'movefast/entry.tsx'), outDir: dir, rootDir: root,
    publicDir: path.join(root, 'public'),
    // The repo's packages export TypeScript source with NodeNext `.js` imports, and @vg/core is a workspace package.
    webpackOverride: (config) => ({...config, cache: false, resolve: {...config.resolve,
      extensionAlias: {...config.resolve?.extensionAlias, '.js': ['.ts', '.tsx', '.js']},
      alias: {...config.resolve?.alias,
        '@vg/core$': path.join(core, 'index.ts'),
        '@vg/core/schemas$': path.join(core, 'schemas.ts'), '@vg/core/devices$': path.join(core, 'devices.ts'),
        '@vg/core/motion$': path.join(core, 'motion.ts'), '@vg/core/frames$': path.join(core, 'frames.ts'),
        '@vg/core/effects$': path.join(core, 'effects.ts')}}})});
}
const mount = path.join(dir, 'storage');
const want = path.resolve(request.storageDir);
let have = null;
try { have = fs.readlinkSync(mount); } catch {}
if (have !== want) {          // two render processes share one bundle: re-point only when it differs
  fs.rmSync(mount, {force: true, recursive: false});
  try { fs.symlinkSync(want, mount); } catch (e) { if (e.code !== 'EEXIST') throw e; }
}
const browser = await openBrowser('chrome', {logLevel: 'error'});
try {
  for (const task of request.tasks) {
    if (fs.existsSync(task.output)) continue;
    const composition = await selectComposition({serveUrl: dir, id: task.id, inputProps: task.props, puppeteerInstance: browser, logLevel: 'error'});
    const temporary = `${task.output}.part.mp4`;
    await renderMedia({serveUrl: dir, composition, inputProps: task.props, outputLocation: temporary, puppeteerInstance: browser,
      logLevel: 'error', codec: 'h264', imageFormat: 'jpeg', jpegQuality: 90, crf: 18, x264Preset: 'veryfast', muted: true,
      pixelFormat: 'yuv420p', colorSpace: 'bt709',
      // MoveFast stream-copies its segment join; every MP4 must share its time base.
      ffmpegOverride: ({args}) => args.map((arg, i) => args[i - 1] === '-video_track_timescale' ? '15360' : arg),
      concurrency: request.concurrency || 3, timeoutInMilliseconds: 120000});
    fs.renameSync(temporary, task.output);
    console.log(`rendered ${path.basename(task.output)}`);
  }
} finally { await browser.close({silent: true}); }
