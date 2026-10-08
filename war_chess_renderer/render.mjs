import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {bundle} = require('@remotion/bundler');
const {selectComposition, renderMedia, renderStill, openBrowser} = require('@remotion/renderer');

const root = path.dirname(fileURLToPath(import.meta.url));
const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = path.resolve(request.bundleDir);
if (!fs.existsSync(path.join(dir, 'index.html'))) {
  await bundle({entryPoint: path.join(root, 'src/MoveFast.tsx'), outDir: dir,
    publicDir: path.join(root, 'public'), webpackOverride: config => ({...config, cache: false})});
}
// Stage only explicitly supplied local assets. No remote URLs or secrets enter the browser.
for (const [key, source] of Object.entries(request.assets || {})) {
  if (!/^movefast\/[a-f0-9]+\.[a-z0-9]+$/.test(key)) throw new Error('Invalid staged asset key');
  const dest = path.join(dir, 'public', key);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  if (!fs.existsSync(dest)) fs.copyFileSync(source, dest);
}
const chromiumOptions = {gl: 'angle'};
const browser = await openBrowser('chrome', {logLevel: 'error', chromiumOptions});
try {
  for (const task of request.tasks) {
    const composition = await selectComposition({serveUrl: dir, id: 'MoveFastWarChess', inputProps: task.props,
      puppeteerInstance: browser, logLevel: 'error', chromiumOptions});
    const common = {serveUrl: dir, composition, inputProps: task.props, outputLocation: task.output,
      puppeteerInstance: browser, logLevel: 'error', chromiumOptions};
    if (task.frame !== undefined) await renderStill({...common, output: task.output, frame: task.frame, imageFormat: 'png'});
    else await renderMedia({...common, codec: 'h264', pixelFormat: 'yuv420p', colorSpace: 'bt709', crf: 19,
      // MoveFast stream-copies its segment join; every MP4 must share its time base.
      ffmpegOverride: ({args}) => args.map((arg, i) => args[i-1] === '-video_track_timescale' ? '15360' : arg),
      concurrency: 2, muted: true, x264Preset: 'veryfast'});
  }
} finally { await browser.close({silent: true}); }
