// MoveFast-owned. Same contract as war_chess_renderer/render.mjs, composition MoveFastLegends, WITH sound.
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
if (!fs.existsSync(path.join(dir, 'index.html'))) {
  await bundle({entryPoint: path.join(root, 'movefast/entry.tsx'), outDir: dir, rootDir: root,
    publicDir: path.join(root, 'public'), webpackOverride: (config) => ({...config, cache: false})});
}
// Stage only explicitly supplied local assets.
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
    const composition = await selectComposition({serveUrl: dir, id: 'MoveFastLegends', inputProps: task.props, puppeteerInstance: browser, logLevel: 'error', chromiumOptions});
    const format = task.props.alpha ? {codec: 'prores', proresProfile: '4444', imageFormat: 'png', pixelFormat: 'yuva444p10le', audioCodec: 'pcm-16'}
      : {codec: 'h264', pixelFormat: 'yuv420p', colorSpace: 'bt709', crf: 19, audioCodec: 'aac', x264Preset: 'veryfast'};
    await renderMedia({serveUrl: dir, composition, inputProps: task.props, outputLocation: task.output, puppeteerInstance: browser, logLevel: 'error',
      chromiumOptions, ...format, enforceAudioTrack: true,
      // MoveFast stream-copies its segment join; every MP4 must share its time base.
      ffmpegOverride: ({args}) => args.map((arg, i) => args[i - 1] === '-video_track_timescale' ? '15360' : arg),
      concurrency: 2});
  }
} finally { await browser.close({silent: true}); }
