"""War Chess visuals in Documentary's existing director and assembly pipeline.

MoveFast owns sourcing, narration and timing. The transferred renderer validates
and draws individual components; no VPP server or database is required.
"""
import hashlib
import json
import math
import shutil
import subprocess
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
RENDERER = HERE / 'war_chess_renderer'
FPS = 30
_RENDER_LOCK = threading.Lock()

# id: (purpose, minimum seconds, maximum seconds, layer, required real media)
CATALOG = {
    'P01': ('Brief emphasis; 2–8 words, <=42 characters; occasional big headline', 3, 5, 'full_screen', 'one relevant still'),
    'P02': ('Compact editorial thought; 2–8 words, <=66 characters; occasional big headline', 4, 5, 'full_screen', 'one relevant still'),
    'P03': ('Highlight 1–2 complete words in a 2–12 word phrase, <=66 characters', 3, 5, 'full_screen', 'one relevant still'),
    'P14': ('A four-digit year actually stated in this narration', 3, 5, 'full_screen', 'one relevant still'),
    'WC01': ('Compare two documented opposing forces or sides', 5, 5, 'full_screen', 'two distinct identity images'),
    'WC02': ('Explain meaningful progression or relationships around one anchor', 8, 20, 'full_screen', 'real anchor photo and transparent cutout; 2–5 imaged steps for anchored_progression_v2; person_marginalia_v3 is person-only, exactly three text steps, never a machine anchor'),
    'WC04': ('Geographical orientation only; no invented positions or tactical arrows', 5, 15, 'full_screen', 'a real map plate showing the named place'),
    'WC06': ('A clearly labelled chess analogy that explains an actual strategic relationship', 8, 20, 'full_screen', 'none; choose motif knight_fork, back_rank_mate or queen_capture; local Stockfish owns moves'),
    'WC07': ('Group or compare exactly three distinct subjects when this benefits understanding', 5, 10, 'full_screen', 'three distinct real subject images; never drop a fourth item to fit'),
    'WC08': ('Identity and place label over the current real footage', 3, 5, 'overlay', 'none'),
    'WC09': ('A consequential quantity, its unit and the exact supporting narration claim', 3, 5, 'overlay', 'none'),
    'WC10': ('An actual choice between 2–4 documented options; abstract decision diagram', 5, 15, 'full_screen', 'none'),
    'WC11': ('Timeline overlay for 2–6 factual events or clearly established ordered process steps; sequence/step labels for undated steps, never invented dates or order', 5, 15, 'full_screen', 'real underlying media selected separately'),
    'WC12': ('First introduction of a named public person over a 5–6 second base shot', 3, 4, 'overlay', 'a real transparent portrait cutout'),
    'WC13': ('Reveal a legible detail in a real document; never invent a quotation', 5, 10, 'full_screen', 'one real document; derive the detail by cropping that document'),
    'WC14': ('Show 2–4 meaningful visible details within one archival image', 5, 10, 'full_screen', 'one archival image; derive detail crops from that same image'),
    'WC15': ('Explain a supported contrast between two sources', 5, 10, 'full_screen', 'two distinct reviewed images'),
}
OVER_MEDIA = {'WC08', 'WC09', 'WC10', 'WC11', 'WC12'}

# Selection notes supplement the unchanged source/count/duration contracts above.
EDITORIAL_NOTES = {
    'P01': ('a short factual point needs clear emphasis', 'recognizes the key claim without a paragraph', 'emphasize a documented bottleneck over a relevant still'),
    'P02': ('a compact editorial thought clarifies a turn', 'understands the consequence', 'a concise supported explanation over a relevant still'),
    'P03': ('one or two complete words carry the contrast', 'notices the distinction within a short phrase', 'highlight the consequential term in a supported claim'),
    'P14': ('a spoken four-digit year anchors a change', 'places the event in time', 'the stated year a bridge opened'),
    'WC01': ('two documented opposing sides need to be understood together', 'recognizes who opposes whom', 'two real teams in a documented contest'),
    'WC02': ('progression or relationships revolve around one anchor', 'connects the steps or items to their common subject', 'an anchored machine with 2–5 imaged stages; person-only marginalia with exactly three text steps, never a machine anchor'),
    'WC04': ('a named location needs geographical orientation', 'understands the setting in its surroundings', 'a reviewed map plate locating a port; no tactical arrows'),
    'WC06': ('a clearly labelled chess analogy explains a real strategic relationship', 'understands the double threat or constraint', 'a supported strategic fork, with local Stockfish supplying legal moves'),
    'WC07': ('exactly three distinct subjects form a meaningful group or comparison', 'recognizes the set and differences together', 'three real equipment images; four items use object-row or suitable WC02, never drop one'),
    'WC08': ('identity or location needs a concise label on useful real footage', 'recognizes what the action shows', 'label the documented location without replacing the shot'),
    'WC09': ('a consequential quantity needs units and the narration claim', 'grasps the scale while seeing the subject', 'a stated carrying capacity over relevant real footage'),
    'WC10': ('an actual choice between 2–4 documented options explains the outcome', 'sees the alternatives and the real selection', 'documented route options in an abstract decision overlay'),
    'WC11': ('2–6 factual events or established ordered process steps explain progression', 'follows the order over real media', 'harvest, mill, pack with sequence/step labels when undated; never invent dates or order'),
    'WC12': ('a named public person needs a first introduction on real footage', 'identifies the person without losing the action', 'a real portrait cutout beside the spoken introduction'),
    'WC13': ('a legible document detail supports the claim', 'can inspect the evidence', 'an actual specification and its inspected detail crop; never invent a quotation'),
    'WC14': ('2–4 meaningful visible details in one archival image need attention', 'understands what to look at within that source', 'reviewed details within a real workshop photograph'),
    'WC15': ('two distinct reviewed sources support a consequential contrast', 'understands the relationship rather than seeing two disconnected pictures', 'two real sources showing documented before/after conditions'),
}

RULES = """DOCUMENTARY EDITING (these rules replace the old sparse-body/mandatory-alternation rules):
Choose treatments that answer the viewer's question, not just because a noun is mentioned.
Use the existing MoveFast tools together with War Chess. Target 40–50% of actual placements
with useful factual text or a template graphic. Small 1–6 word labels count; dust/frames do not.
Use big P01/P02 headlines when clear emphasis helps the explanation, with enough space and reading time.
No narration subtitles.
Useful action may continue at the original shot pace. There is no six-second plain-footage requirement.
Leave enough time to read each treatment. Do not accelerate cutting, stretch VO, loop or freeze video.
Use the enabled catalogue's situational Useful when / Viewer benefit / Example notes for meaningful
lists, sequences, contrasts, quantities and details. Preserve strong choices and useful explanatory
footage; all enabled families remain available. No automatic assignment for every list or section.
Each meaningful narration beat needs purposeful visual development that advances its point, through
useful real action, relevant imagery, annotation, comparison or explanatory animation. Avoid passive
generic coverage carrying multiple distinct ideas. This is not mandatory text/templates on every
sentence or arbitrary motion. Underlying footage is capped at five seconds; keep normal reading/pacing.
The 40–50% coverage target is advisory, not a ceiling on useful editing.
Each substantial edit needs a concrete reason and brief. No quota or forced rotation.
Vox remains available for mechanisms and relationships, without a cap, mandatory opening or
per-minute quotas. Different real shots
of the same subject are allowed. Exact media reuse still requires the existing reviewed exception;
'it is B-roll', cropping, zooming or changing labels never make the source new.
When coverage is short, find another suitable contextual shot, continue useful action within the
available source, or choose an explanatory visual supported by the facts. Do not invent evidence.
Real media stays visible under WC08–WC12 and small labels. Avoid text-card-only passages.
Preserve MoveFast's original channel dust setting; do not add a War Chess film-dust layer.
Frames are optional. Smoke/ash or snowfall only when appropriate to the scene; these are decorative
treatments, not proof of historical conditions. Stills mostly stay static; gentle motion on about one in four.
Use war_chess_fx for chapter/CTA beats over fitting media. A subscribe request gets a SUBSCRIBE label.
WC03/WC05 are unavailable. WC04 admits orientation only. WC06 moves come only from local Stockfish.
"""


def enabled(engine, style):
    return (__import__('styles').is_documentary(style)
            and ((getattr(engine, 'STYLE_INFO', {}).get(style) or {}).get('look') or {}).get('war_chess', False)
            and (getattr(engine, '_FEATURES', {}) or {}).get('motion', True))


# WC02's renderer rejects a whole component for one text over its limit (anchored-progression-config.ts) — a
# 25-character label cost the test video its WC02. Over-long text is shortened at a word boundary instead.
# subjectRole/subject become anchorLabel/anchorTitle (approved-components.tsx).
WC02_LIMITS = {'anchorLabel': 24, 'subjectRole': 24, 'label': 24, 'anchorTitle': 42, 'subject': 42, 'title': 42, 'relationshipLabel': 40,
               'finalMessage': 64, 'finalDetail': 90, 'detail': 90}


def _fit_lengths(node):
    if isinstance(node, list):
        for x in node:
            _fit_lengths(x)
    elif isinstance(node, dict):
        for key, value in node.items():
            limit = WC02_LIMITS.get(key)
            if limit and isinstance(value, str) and len(value) > limit:
                cut = value[:limit + 1].rsplit(' ', 1)[0].rstrip(' ,;:-—') if ' ' in value[:limit + 1] else value[:limit]
                words = cut.split(' ')
                while len(words) > 1 and words[-1].lower() in ('with', 'and', 'of', 'the', 'to', 'a', 'an', 'in', 'on', 'for', 'by', 'at'):
                    words.pop()
                node[key] = ' '.join(words)[:limit]
            else:
                _fit_lengths(value)


def _motif_for(item):
    """A WC06 the director sent without its motif: the closest admitted one from its brief and reason."""
    text = ' '.join(str(item.get(k) or '') for k in ('brief', 'reason', 'words')).lower()
    if any(w in text for w in ('two ', 'both', 'double', 'at once', 'fork')):
        return 'knight_fork'
    if any(w in text for w in ('mate', 'trap', 'no escape', 'cornered', 'checkmate', 'nowhere')):
        return 'back_rank_mate'
    if any(w in text for w in ('captur', 'take', 'sacrific', 'swallow', 'absorb', 'acquir', 'bought')):
        return 'queen_capture'
    return 'knight_fork'   # a double threat: the general case

def chess_on(engine, style):
    """Chess boards (WC06) belong to the War Chess channel (look.chess); Documentary keeps every other WC edit."""
    return bool(((getattr(engine, 'STYLE_INFO', {}).get(style) or {}).get('look') or {}).get('chess', False))


def prompt_block(chess=False):
    rows = ['- war_chess — choose a supported visual component on its exact spoken cue:',
            '  {"tool":"war_chess","type":"WC09","cue":8,"words":"ten thousand tons",',
            '   "reason":"Show the pusher force on the machinery footage","duration":4,',
            '   "brief":"10,000 tons of assembly force","media":[]}',
            '  For every required image, supply media:[{"id":"A1","subject":"...","query":"precise real-photo search","cutout":false}].',
            '  Each media id must be unique and alphanumeric only (for example A1, A2); use the supplied IDs exactly.',
            '  Request actual source photos, never generated replacements. A cutout:true item uses a real photo.',
            '  WC13/WC14 need one full image; the renderer briefing reviews it and makes real detail crops.',
            '  WC06 additionally supplies "motif": "knight_fork" | "back_rank_mate" | "queen_capture" (never FEN or moves). Explain why the analogy fits.']
    if not chess:
        rows.pop()
    else:
        rows.append('  This is the War Chess channel: chess boards (WC06) are its signature. Use one wherever the story has a real'
                    ' strategic beat (a double threat, a trap, a forced choice, a sacrifice) — about one every 2–4 minutes, never forced.')
    for key, (purpose, lo, hi, layer, media) in CATALOG.items():
        if key == 'WC06' and not chess:
            continue
        presentation = 'over the current real media' if key in OVER_MEDIA else layer
        rows.append(f'  {key}: {purpose}. {lo}–{hi}s; {presentation}; media: {media}.')
        useful, benefit, example = EDITORIAL_NOTES[key]
        rows.append(f'    Useful when: {useful}. Viewer benefit: {benefit}. Example: {example}.')
    rows += ['- war_chess_fx — treatment of existing media without replacing or shortening its shot:',
             '  {"tool":"war_chess_fx","cue":15,"words":"back to the history","duration":4,',
             '   "frame":false,"overlay":{"kind":"chapter","text":"BEFORE THE CRANKSHAFT"}}',
             '  filter optional: smoke_ash/snowfall. Omit for the original media appearance. overlay optional; kind chapter/cta/gap.',
             '  Chapter title max 8 words; small CTA/labels 1–6 words. Do not put text over another text-bearing scene.',
             '  Useful when: a spoken chapter/CTA beat benefits from a small cue on fitting media. Viewer benefit: follows the transition while useful imagery stays visible. Example: a concise requested subscribe cue; respect creator title/particle exclusions.']
    return '\n'.join(rows) + '\n'


def duration(item):
    if item.get('tool') == 'war_chess_fx':
        return max(3., min(8., float(item.get('duration') or 4)))
    spec = CATALOG[str(item.get('type'))]
    return max(spec[1], min(spec[2], float(item.get('duration') or spec[1])))


def is_overlay(item):
    return item.get('tool') == 'war_chess_fx' or item.get('type') in OVER_MEDIA


def _hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def _dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False))


def _load(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def _node():
    return shutil.which('node') or '/opt/homebrew/bin/node'


def _asset(path, staged):
    path = Path(path).resolve(strict=True)
    with path.open('rb') as file:
        digest = hashlib.file_digest(file, 'sha256').hexdigest()
    suffix = path.suffix.lower().lstrip('.')
    mime = {'png':'image/png', 'jpg':'image/jpeg', 'jpeg':'image/jpeg', 'mp4':'video/mp4'}.get(suffix)
    if not mime:
        raise ValueError(f'Unsupported War Chess media: {suffix}')
    key = f'movefast/{digest}.{suffix}'
    staged[key] = str(path)
    return {'artifactId':digest, 'sha256':digest, 'mediaType':mime, 'staticFileKey':key}


def _render(tasks, staged, folder):
    if not tasks:
        return
    # One job-owned bundle reused for its component and footage renders.
    request = folder / 'render-request.json'
    with _RENDER_LOCK:
        _dump(request, {'bundleDir':str(folder / 'bundle'), 'assets':staged, 'tasks':tasks})
        result = subprocess.run([_node(), str(RENDERER / 'render.mjs'), str(request)], cwd=RENDERER,
                                capture_output=True, text=True, timeout=max(1800, 20 * len(tasks)))  # ~7 s each
        (folder / 'render.log').write_text(result.stdout + result.stderr)
        if result.returncode:
            raise RuntimeError('War Chess renderer: ' + (result.stderr or result.stdout)[-1400:])


def _schema_for(kind, assets):
    schema = _load(RENDERER / 'component-schemas.json', {})[kind]
    def simplify(value):
        if isinstance(value, list): return [simplify(x) for x in value]
        if not isinstance(value, dict): return value
        if 'artifactId' in value.get('properties', {}):
            return {'type':'string', 'description':'Exact asset reference; $D1 etc also allowed for a supplied crop',
                    'examples':['$' + k for k in assets]}
        return {k:simplify(v) for k,v in value.items() if k not in ('$schema',)}
    return simplify(schema)


def _json_reply(text):
    text = text.strip()
    start, end = text.find('{'), text.rfind('}')
    value = json.loads(text[start:end + 1])
    if not isinstance(value, dict): raise ValueError('Expected a component object')
    return value


_SHOWN, _SHOWN_LOCK = {}, threading.Lock()


def _fresh_photo(job, photos):
    """The best-ranked photo no other board of this video shows yet; the top one again only when every pick is
    taken (owner: repeats allowed but rare, under ~2% of the video)."""
    with _SHOWN_LOCK:
        shown = _SHOWN.setdefault(str(job), set())
        digests = []
        for photo in photos:
            with open(photo, 'rb') as file:
                digests.append(hashlib.file_digest(file, 'sha256').hexdigest())
        choice = next((i for i, d in enumerate(digests) if d not in shown), 0)
        shown.add(digests[choice])
        return photos[choice]


def _prepare(engine, item, job, index):
    kind = item['type']
    folder = job / 'war_chess' / f'component-{index:03d}'
    folder.mkdir(parents=True, exist_ok=True)
    stamp = _hash(item)
    cached = _load(folder / 'prepared.json', {})
    if cached.get('stamp') == stamp:
        if cached.get('error'): raise ValueError(cached['error'])
        if all(Path(p).exists() for p in cached.get('assets', {}).values()): return cached
    try:
        import photofx
        from PIL import Image
        assets, staged, originals = {}, {}, []
        for media in item.get('media') or []:
            ident = str(media['id'])
            if not ident.isalnum(): raise ValueError('Invalid media id')
            source_dir = folder / ident
            source_dir.mkdir(exist_ok=True)
            picks = photofx.source_photos(engine, media.get('subject'), media.get('query'), source_dir, n=3)
            if not picks: raise ValueError('No suitable real media for ' + ident)
            original = _fresh_photo(job, [Path(p['photo']) for p in picks])
            originals.append(str(original.resolve()))
            source = photofx.cutout(original, source_dir / 'cutout', log=engine.log) if media.get('cutout') else original
            # WC02's published contract asks for PNGs; converting format does not change source identity.
            png = source_dir / 'source.png'
            with Image.open(source) as im: im.save(png)
            assets[ident] = _asset(png, staged)
        seconds = float(item['end']) - float(item['t'])
        frames = round(seconds * FPS)
        script = (job / 'script.txt').read_text()
        fields = item.get('fields')
        if kind == 'WC06':
            fields = {'title':str(item.get('brief') or 'Chess analogy')[:100]}
        if fields is None:
            prompt = f'''Prepare ONE {kind} visual for a documentary. Return a JSON object with fields and optional crops.
Narration is the factual limit, not independent source verification. Do not invent dates, identities,
quotes or quantities. Only show what the reviewed images really contain. Contextual images are enough: a
picture of the same kind of machine, place or era fits even when it is not the exact model the narration
names — label it by what it shows (e.g. "HOT-BULB ENGINE", not a model name it may not be), never as proof of the
named model. Leave out an unrelated image and work with the others. Return {{"skip":"reason"}} only when nothing
fitting is left.
Template purpose: {CATALOG[kind][0]}. Brief: {item.get('brief', '')}. Reason: {item.get('reason', '')}.
Spoken words: {item.get('words', '')}. Duration: {seconds:.2f}s at 30fps.
Use this fields JSON schema exactly: {json.dumps(_schema_for(kind, assets))}
Images, in attached order: {', '.join(assets)}. Image fields must reference the actual provided IDs,
prefixed with "$": {json.dumps(['$' + ident for ident in assets])}. Use only these exact asset references,
NEVER a path, URL or an invented ID.
evidenceIds within nested items must be ["narration"]. claimId, if needed, is "narration".
For WC04 set mode=orientation, actors=[], movementSteps=[], ranks=[].
For WC02 use anchored_progression_v2 (with real media for each step) or person_marginalia_v3
(only for a person, exactly three text steps, never a machine anchor); do not pretend an opaque photo is a cutout.
WC02 subjectRole is shown as the anchor's label: 1–3 words, at most 24 characters (e.g. "AUTOMAKER").
WC11 uses 2–6 factual events or clearly established ordered process steps over real media.
For undated steps use sequence/step labels in dateLabel; never invent dates or order.
WC13/WC14: inspect the attached full image. Return crops:[{{"id":"D1","asset":{json.dumps(next(iter(assets), 'actualProvidedID'))},"box":[x0,y0,x1,y1]}}]
using normalized 0–1 coordinates for meaningful visible details, then reference "$D1" in fields.
No invented details, no duplicate crops. WC15 requires two distinct original sources.
Do not supply narrationTiming, eventStartFrames or chosenRevealFrame: exact inner cues were not measured.
Narration:\n{script}
'''
            if kind in OVER_MEDIA and not assets:
                prompt += ("\nThis is a text/diagram overlay. MoveFast selects and checks the real underlying "
                           "footage separately, then composites this overlay over it. No attached image is "
                           "required for this component. Prepare the overlay from the narration; do not "
                           "describe unseen footage or reject solely because footage is not attached.")
            if assets:
                reply = _json_reply(engine.claude_vision(prompt, [Path(staged[a['staticFileKey']]) for a in assets.values()], max_tokens=4000))
            else:
                reply_items = engine._json_items(prompt + '\nReturn a JSON ARRAY containing that single object.', max_tokens=4000)
                reply = reply_items[0] if reply_items else {'skip':'No component brief returned'}
            if reply.get('skip'): raise ValueError(reply['skip'])
            if kind == 'WC02' and isinstance(reply.get('fields'), dict):
                _fit_lengths(reply['fields'])
            for crop in reply.get('crops', []):
                ident = str(crop['id'])
                if not ident.isalnum() or ident in assets: raise ValueError('Invalid crop identity')
                base = assets[crop['asset']]
                box = [float(x) for x in crop['box']]
                if len(box) != 4 or not (0 <= box[0] < box[2] <= 1 and 0 <= box[1] < box[3] <= 1):
                    raise ValueError('Invalid detail crop')
                if box[2]-box[0] < .04 or box[3]-box[1] < .04: raise ValueError('Detail crop too small')
                target = folder / (ident + '.png')
                with Image.open(staged[base['staticFileKey']]) as im:
                    im.crop((int(box[0]*im.width), int(box[1]*im.height), int(box[2]*im.width), int(box[3]*im.height))).save(target)
                assets[ident] = _asset(target, staged)
            # Models may return the supplied fields schema directly or in the requested wrapper.
            # Both shapes still pass asset binding and the complete component schema below.
            fields = reply.get('fields', {k: v for k, v in reply.items() if k != 'crops'})
        def bind(value):
            # "$A1" is a reviewed asset; "$50 million" is text.
            if isinstance(value, str) and value.startswith('$') and value[1:] in assets:
                return assets[value[1:]]
            if isinstance(value, list): return [bind(x) for x in value]
            if isinstance(value, dict):
                if any(k in value for k in ('url','staticFileKey','artifactId','sha256')):
                    raise ValueError('Component may only reference the reviewed assets')
                return {k:bind(v) for k,v in value.items()}
            return value
        if kind == 'WC06':
            from war_chess_renderer.chess_truth import resolve_wc06_engine_plan
            receipt = resolve_wc06_engine_plan(item.get('motif') or _motif_for(item), _hash(script), stamp)
            if receipt['status'] != 'verified': raise ValueError(receipt.get('failure_code', 'Chess not verified'))
            _dump(folder / 'stockfish-receipt.json', receipt)
            names = {'schema_version':'schemaVersion','motif_id':'motifId','principal_variation':'principalVariation',
                     'frozen_brief_hash':'frozenBriefHash','component_brief_hash':'componentBriefHash','receipt_hash':'receiptHash',
                     'movetime_ms':'movetimeMs','hash_mb':'hashMb'}
            def camel(x):
                if isinstance(x, list): return [camel(v) for v in x]
                if isinstance(x, dict): return {names.get(k,k):camel(v) for k,v in x.items()}
                return x
            fields = {'title':str((fields or {}).get('title') or item.get('brief') or 'Chess analogy'), 'chessPlan':camel(receipt)}
        else:
            fields = bind(fields)
        if kind == 'WC04' and fields.get('mode') != 'orientation': raise ValueError('Only orientation maps are admitted')
        if kind == 'WC15' and len({s['source']['sha256'] for s in fields['sources']}) != 2:
            raise ValueError('Comparison requires two different sources')
        component = {**fields, 'componentType':kind, 'componentId':f'movefast-{index}',
                     'parentUnitIds':['narration'], 'baseSceneIds':[f'movefast-{index}'],
                     'layer':CATALOG[kind][3], 'startFrame':0, 'endFrameExclusive':frames,
                     'evidenceIds':['narration'], 'acceptedScopeHash':_hash(script)}
        if kind == 'WC12':
            component.update(baseStartFrame=0, baseEndFrameExclusive=180)
        _dump(folder / 'component.json', component)
        subprocess.run([_node(), str(RENDERER / 'schema.mjs'), 'validate', str(folder / 'component.json')],
                       cwd=RENDERER, check=True, capture_output=True, text=True, timeout=30)
        # One component can legitimately derive several details from one source.
        # Register the original once; a later component still trips MoveFast's reuse check.
        unique = {}
        for original in originals:
            with open(original, 'rb') as file:
                unique.setdefault(hashlib.file_digest(file, 'sha256').hexdigest(), original)
        result = {'stamp':stamp, 'component':component, 'assets':staged, 'originals':list(unique.values())}
        _dump(folder / 'prepared.json', result)
        return result
    except Exception as exc:
        message = str(exc)
        if isinstance(exc, subprocess.CalledProcessError): message += ': ' + (exc.stderr or '')[-1200:]
        _dump(folder / 'prepared.json', {'stamp':stamp, 'error':message})
        raise ValueError(message) from exc


def add_to_timeline(segs, srt, job, style, force, workers=1, engine=None):
    if engine is None or not enabled(engine, style): return segs
    folder = job / 'war_chess'
    moments = _load(folder / 'moments.json', [])
    if not moments: return segs
    report, overlays, added = [], [], []
    media_manifest = _load(job / 'motion/media.json', {})
    for index, item in enumerate(moments):
        if item.get('tool') == 'war_chess_fx':
            overlays.append(item); continue
        kind = item.get('type')
        if kind not in CATALOG: continue
        out = folder / f'wc_{index:03d}_{kind}.mp4'
        try:
            prepared = _prepare(engine, item, job, index)
            comp = prepared['component']
            if kind in OVER_MEDIA:
                overlays.append(dict(item, prepared=prepared)); continue
            start, end = float(item['t']), float(item['end'])
            if any(start < a+d-.01 and a < end-.01 for a,p,d in segs):
                raise ValueError('Another rendered scene occupies this narration beat')
            render_stamp = folder / f'wc_{index:03d}_{kind}.stamp'
            if not out.exists() or _load(render_stamp, '') != prepared['stamp']:
                _render([{'output':str(out), 'props':{'frames':comp['endFrameExclusive'], 'base':None,
                    'layers':[{'from':0,'duration':comp['endFrameExclusive'],'component':comp}]}}], prepared['assets'], folder)
                _dump(render_stamp, prepared['stamp'])
            added.append((start, str(out), end-start))
            media_manifest[str(out)] = prepared['originals']
            report.append({'type':kind, 't':start, 'end':end, 'status':'rendered','path':str(out)})
        except Exception as exc:
            engine.log(f'war_chess: {kind} skipped — {str(exc)[:220]}')
            report.append({'type':kind, 't':item['t'], 'end':item['end'], 'status':'skipped','reason':str(exc)})
    _dump(folder / 'overlays.json', overlays)
    _dump(folder / 'report.json', report)
    _dump(job / 'motion/media.json', media_manifest)
    return sorted(list(segs) + added, key=lambda x:x[0])


def decorate(engine, plan, segs, job, style, force=False):
    """Apply overlay components and atmosphere to the real, already timed media.

    Uses the original footage frames and duration, with no change to the VO.
    """
    if not enabled(engine, style): return segs
    folder = job / 'war_chess'
    folder.mkdir(exist_ok=True)
    moments = _load(folder / 'overlays.json', [])
    # ComponentLayer owns its full animation clock even when crossing shot cuts.
    tasks, staged, results, report = [], {}, list(segs), _load(folder / 'report.json', [])
    report = [x for x in report if x.get('scope') != 'placement']
    labels = _load(job / 'overlays.json', [])
    spans, cursor = [], 0.
    for kind, source, leak, seconds in plan:
        spans.append((cursor, cursor + float(seconds), kind))
        cursor += float(seconds)
    # A readable overlay can span a cut while its animation clock continues.
    # Admit its complete interval, rather than showing isolated short fragments.
    admitted, occupied = set(), []
    for mi, item in enumerate(moments):
        a, b = float(item['t']), float(item['end'])
        text = item.get('prepared') or item.get('overlay')
        if not text:
            admitted.add(mi); continue
        covered = sum(max(0., min(b,y)-max(a,x)) for x,y,k in spans if k in ('photo','video'))
        conflict = any(float(x['t']) < b and float(x['t'])+float(x.get('dur',3.6)) > a for x in labels)
        if covered >= b-a-1/FPS and not conflict and not any(x < b and a < y for x,y in occupied):
            admitted.add(mi); occupied.append((a,b))
    t, texted = 0., 0
    used_overlay = set()
    embedded = _load(job / 'motion/media.json', {})
    # A cutout crossing a cut remains one continuous overlay. Register it once.
    registered = set()
    for i, (entry, seg) in enumerate(zip(plan, segs)):
        kind, source, leak, seconds = entry
        seconds = float(seconds); end = t + seconds
        if kind == 'motion':
            texted += 1; t = end; continue
        if kind not in ('photo','video'): t = end; continue
        layers, effects = [], []
        edit = {'kind':'filter_only','overlayText':None,'filter':None,'motion':'static','frame':False}
        has_label = any(float(x['t']) < end and float(x['t'])+float(x.get('dur',3.6)) > t for x in labels)
        for mi, item in enumerate(moments):
            if mi not in admitted: continue
            a, b = float(item['t']), float(item['end'])
            if a >= end or b <= t: continue
            if item.get('tool') == 'war_chess_fx':
                filt = item.get('filter')
                if filt in ('snowfall','smoke_ash'): edit['filter'] = filt
                edit['frame'] = bool(item.get('frame', False))
                overlay = item.get('overlay')
                if overlay:
                    words = str(overlay.get('text', '')).split()
                    span = round((min(end,b)-max(t,a))*FPS)   # under one frame on this shot: nothing to show
                    if overlay.get('kind') in ('chapter','cta','gap') and 0 < len(words) <= (8 if overlay['kind']=='chapter' else 6) and span >= 1:
                        effects.append({'from':round(max(0,a-t)*FPS), 'duration':span, 'overlay':overlay})
                used_overlay.add(mi)
            elif item.get('prepared'):
                prepared = item['prepared']; component = dict(prepared['component'])
                if component['componentType'] == 'WC12' and not (5 <= seconds <= 6 and a >= t and b < end):
                    continue
                if component['componentType'] == 'WC12':
                    component['baseEndFrameExclusive'] = round((end-a)*FPS)
                    if not 150 <= component['baseEndFrameExclusive'] <= 180:   # renderer: WC12 base is 5–6 s from its cue
                        continue
                if int(component.get('endFrameExclusive') or 0) < 1:
                    continue
                layers.append({'from':round((a-t)*FPS), 'duration':component['endFrameExclusive'],'component':component})
                staged.update(prepared['assets']); used_overlay.add(mi)
                if mi not in registered:
                    embedded[str(source)] = list(dict.fromkeys(embedded.get(str(source), []) + prepared['originals']))
                    registered.add(mi)
        has_text = bool(layers or effects or has_label)
        texted += int(has_text)
        base_source = _asset(seg, staged)
        frames = max(1, round(seconds*FPS))
        base = {'kind':'real_clip', 'plannedShotId':str(i), 'source':base_source,
                'startFrame':0, 'endFrameExclusive':frames, 'sourceStartFrame':0,
                'sourceEndFrameExclusive':frames, 'edit':edit}
        props = {'frames':frames,'base':base,'layers':layers,'effects':effects}
        out = folder / f'placement-{i:03d}.mp4'
        stamp = _hash(props)
        if force or not out.exists() or _load(out.with_suffix('.stamp'), '') != stamp:
            tasks.append({'output':str(out),'props':props})
        results[i] = out
        report.append({'scope':'placement','slot':i,'t':t,'end':end,'text_or_template':has_text,
                       'filter':edit['filter'],'frame':edit['frame'],'status':'rendered'})
        _dump(out.with_suffix('.pending'), stamp)
        t = end
    _dump(job / 'motion/media.json', embedded)
    engine._validate_media_plan(plan, job)
    def keep_finished():  # a rerun after a failure resumes instead of re-rendering every finished placement
        for path in results:
            path = Path(path); pending=path.with_suffix('.pending')
            if path.exists() and pending.exists() and engine._video_dur(path) > 0:
                pending.replace(path.with_suffix('.stamp'))
    try:
        _render(tasks, staged, folder)
        keep_finished()
    except Exception as exc:
        keep_finished()
        # Do not call a partially decorated video complete or silently discard its edit plan.
        engine.log('war_chess: footage treatment failed; see war_chess/render.log')
        raise RuntimeError('War Chess footage treatment failed: ' + str(exc)) from exc
    for mi, item in enumerate(moments):
        report.append({'type':item.get('type', 'treatment'), 't':item['t'], 'end':item['end'],
                       'status':'rendered' if mi in used_overlay else 'skipped',
                       'reason':'' if mi in used_overlay else 'No readable, non-conflicting real-media slot'})
    _dump(folder / 'report.json', report)
    coverage = {'placements':len(plan),'text_or_template':texted,
                'share':round(texted/max(1,len(plan)),3),'target':[.4,.5]}
    _dump(folder / 'coverage.json', coverage)
    engine.log(f'war_chess: {texted}/{len(plan)} placements carry text/templates; actual render report saved')
    return results
