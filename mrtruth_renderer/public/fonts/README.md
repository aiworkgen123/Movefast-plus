# Fonts

Four files belong in this directory, under exactly these names, and between them
they supply **six** weights across **two** families:

```
LibreFranklin-Variable.woff2    (weights 300 and 800 — one variable face)
LibreFranklin-Medium.woff2      (weight 500)
LibreFranklin-SemiBold.woff2    (weight 600)
PlayfairDisplay-Variable.woff2  (weights 500 and 700 — one variable face)
```

The first three are `FONT_FAMILY`, the sans. The fourth is `SERIF_FAMILY`, and it
is the first serif this project has ever shipped. It was added on 2026-09-14
because two of the four overlays the client sent that morning are set in a
high-contrast display serif, and P03, P12 and P13 had all asked for one and been
collapsed into the sans. See the box on `SERIF_FAMILY` in
`src/remotion/constants.ts` for why it is a separate family and not a weight.

`src/remotion/fonts.ts` asks for them by that path and nothing else.

**They ARE committed, and this file used to say the opposite.** `git ls-files`
lists both static faces; nothing in `.gitignore` mentions fonts at all. The claim
that they were absent was wrong and it mattered, because the reasoning downstream
depended on it — the Docker section below is right that `COPY . /app` is the only
way they reach the image, and the reason that works today is precisely that they
are in the repository. A fresh clone has them. Add new faces to git too, or the
container falls back and nothing goes red.

Libre Franklin is OFL 1.1, which permits redistribution, so committing them is
allowed as well as convenient. Keep `OFL.txt` alongside if the container is
redistributed.

Which weight sets what:

| weight | file | used by |
|---|---|---|
| 300 | Variable | the lower-left caption and the plate caption |
| 500 | Medium | captions, the text card's eyebrow |
| 600 | SemiBold | the text card headline, the overlay's original look |
| 800 | Variable | the full-frame year |

`SERIF_FAMILY`, Playfair Display:

| weight | file | used by |
|---|---|---|
| 500 | Variable | the name plate's role line |
| 700 | Variable | the chapter plate's heading, the name plate's name |

## The date stamp's two faces (added 2026-10-11)

Two more files, loaded ONLY on a `date-stamp` shot by `useDateStampFonts()` in
`src/remotion/fonts.ts` (every other shot keeps the four faces above and nothing
else):

```
DMSerifDisplay-Regular.ttf     the month line   (OFL-DMSerifDisplay.txt)
LibreBaskerville-Regular.ttf   the year line    (OFL-LibreBaskerville.txt)
```

They are the faces of the owner's own date overlay, matched glyph by glyph off
his reference (per-glyph IoU 0.939 and 0.925; every runner-up at or below
0.906). Both are SIL OFL 1.1 and are the exact files Google Fonts serves
(`fonts.googleapis.com/css2?family=DM+Serif+Display` and `...family=Libre+Baskerville`),
**TTF and unmodified**: no subsetting and no conversion, so the pixels are the
ones that were matched and the OFL's Reserved Font Name clause never comes up.

| file | version | sha256 |
|---|---|---|
| DMSerifDisplay-Regular.ttf | 5.200 | `c03775f8cc3db88cfea259b231abe13f94e6a3d3cb01c09477a2e42a1f5919e1` |
| LibreBaskerville-Regular.ttf | 2.005 | `f5bc4341f15de5e877d8d95b6b14b33e9a3da1f8fef4ed0700ed407f096cffb6` |

Their licences are beside them (`OFL-*.txt`, from github.com/google/fonts).

## Where to get them

**Libre Franklin**, SIL Open Font License 1.1 — a Franklin Gothic revival, the
news and documentary lineage.

- Specimen and family download: <https://fonts.google.com/specimen/Libre+Franklin>

**Playfair Display**, SIL Open Font License 1.1 — a high-contrast transitional
display serif, the closest open match to the face in the client's own reference
clips.

- Specimen: <https://fonts.google.com/specimen/Playfair+Display>
- The file here is the **latin subset** served by the Google Fonts CSS API, which
  is exactly what the three Libre Franklin files are. It covers U+0000-00FF, so an
  accented name on the name plate falls back. That limitation is not new — every
  caption in the film already has it.
- Upstream source: <https://github.com/googlefonts/libre-franklin>

The fastest way to get `woff2` specifically, rather than the TTFs in the Google
Fonts ZIP, is to ask the CSS API with a browser user agent — without one it
serves TTF:

```sh
curl -s -H 'User-Agent: Mozilla/5.0' \
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@500;600'
```

That prints one `https://fonts.gstatic.com/...woff2` URL per weight per subset.
Take the one whose `unicode-range` starts `U+0000-00FF` — that is the `latin`
subset, and it is the only one this film needs. The names in the script that have
accents (Émile Puech, Józef Milik, Schøyen) are all inside Latin-1.

### The 300/800 file is VARIABLE, and that is not a mistake

```sh
curl -s -H 'User-Agent: Mozilla/5.0' \
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;800'
```

Ask for those two weights and Google returns **the same URL twice**. Libre
Franklin is served as a single variable face with a `wght` axis, not as separate
cuts, so one 29KB file covers both. `fonts.ts` registers it twice with a
single-value `weight` descriptor, which pins the axis to that value.

**Verify a new weight by rendering it, never by reading about it.** A weight the
browser cannot honour does not throw — it synthesises a face or falls back, and
the loader here fails soft on purpose, so the wrong weight would reach a six-hour
render with nothing going red. One frame is enough:

```sh
cd apps/web && npx remotion still src/remotion/index.ts Segment out.png --props=…
```

Starting from the TTFs instead, convert with Google's `woff2_compress`, or with
fonttools:

```sh
python -m fonttools ttLib.woff2 compress LibreFranklin-Medium.ttf
```

## How they reach the renderer

The compositor resolves `staticFile('fonts/…')` against whatever `publicDir` the
worker passes, and that is the **storage root** (`STORAGE_DIR`), not this
directory — the storage root is where the rendered assets already live, and
`bundle()` and `renderMedia()` have to be handed the same one.

So `ensureRenderFonts` in `apps/worker/src/bundle.ts` copies both files from here
into `<STORAGE_DIR>/fonts/` once per process, before the compositor is bundled.
Drop the files here and the worker does the rest. If you keep them somewhere
else, put them at `<STORAGE_DIR>/fonts/` under the same names and the copy step
finds them already in place and does nothing.

## The still loop, which is how a new weight gets checked

`apps/web/scripts/look-still.ts` renders one scene at 1920x1080 in under a minute.
Use it on any typographic change before a full render — a weight the browser
cannot honour does not throw, it synthesises or falls back, and the loader here
fails soft on purpose.

```sh
cd apps/web
npx tsx scripts/look-still.ts --look=year --image=../../storage/assets/<any>.jpg --out=/tmp/y.png
```

That is how `capEm` in `constants.ts` was corrected from a guessed 0.72 to a
measured 0.756, which had the year rendering 5% oversized.

## What happens when they are missing

The render **continues** with a fallback. `fonts.ts` registers a metric-compatible
system face (Liberation Sans, then Arial, then DejaVu Sans) under the same family
name, so the metrics stay identical across every segment and captions do not
shift at the cuts — they are simply set in the wrong face.

This is a deliberate change from the original behaviour, which was
`cancelRender()`. Failing the job was the wrong trade: a missing typeface is a
cosmetic defect, and destroying a three-hour render at segment 140 costs far more
than captions in Liberation Sans.

The warning you should actually see is the worker's, once, at start-up:

```
WARN  … font file(s) are not on disk — see apps/web/public/fonts/README.md
```

## Docker

**The image does not download these files.** `docker/worker.Dockerfile` installs
`fontconfig`, `fonts-liberation` and `fonts-noto-core` — that is what makes the
*fallback* work and what keeps a non-Latin name in a title card from rendering as
tofu boxes. It then copies the repository in with `COPY . /app`, which is the
only way these two `woff2` files get into the image: **they must be present in
this directory when the image is built**, or every render in the container falls
back.

To fetch them at build time instead, add a step to the `fonts` stage of
`docker/worker.Dockerfile` that writes both files to
`/app/apps/web/public/fonts/`, before the runtime stage copies the repo. That is
not implemented today.

## Why not Montserrat, Poppins or Bebas Neue

Those three are so heavily used in generated video that the typeface alone
announces how the film was made. The point of this project is output that does
not read as machine-made, and type is the first thing a viewer parses.

## Licence

Libre Franklin is OFL 1.1. Keep the upstream `OFL.txt` alongside these files if
you redistribute the container.
