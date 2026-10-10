"""Render one Mr Truth film from your own script + voiceover.
  .venv/bin/python run_test.py script.txt voice.mp3 "Title" [minutes]                 plan + draw here
  .venv/bin/python run_test.py script.txt voice.mp3 "Title" [minutes] --export        plan here, write render_package.tgz, stop
  .venv/bin/python run_test.py script.txt voice.mp3 "Title" [minutes] --segments segments.tgz   unpack drawn shots, finish here
A finish joins the drawn shots under the plan the --export run saved (mrtruth/plan.json): nothing is planned again
and no paid service is asked (MRTRUTH_FINISH=1).
"""
import sys, os, time, tarfile
from pathlib import Path
here = Path(__file__).resolve().parent
os.chdir(here); sys.path.insert(0, str(here))
args = sys.argv[1:]
export = "--export" in args
seg_file = ""
if "--segments" in args:
    i = args.index("--segments"); seg_file = args[i + 1]; del args[i:i + 2]
args = [x for x in args if x != "--export"]
if export:
    os.environ["MT_EXPORT_PACKAGE"] = "1"
if seg_file:
    os.environ["MRTRUTH_FINISH"] = "1"      # finish from the saved plan: no re-plan, no preflight pings (owner 2026-10-10)
from dotenv import load_dotenv; load_dotenv(here / ".env")
import make_video as mv, motion, styles, mrtruth
styles.apply_to_engine(mv, motion)
script_file, voice, title = args[0], args[1], args[2]
minutes = int(args[3]) if len(args) > 3 else 3
script = Path(script_file).read_text(encoding="utf-8-sig").strip()
if seg_file:
    seg_dir = mv.job_dir(title, "mr_truth") / "mrtruth" / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(seg_file) as tar:
        for m in tar.getmembers():
            if m.isfile() and m.name.endswith(".mp4") and "/" not in m.name and not m.name.startswith("."):
                tar.extract(m, seg_dir)
    print(f"unpacked drawn shots into {seg_dir}")
t0 = time.time()
try:
    out = mv.run_custom(title, minutes, steps=["video"], script_text=script, style="mr_truth",
                        byo_audio=str(Path(voice).resolve()), features={"ai_images": True})
    print(f"FINAL {out}\nTOTAL {(time.time() - t0) / 60:.1f} min")
except mrtruth.PackageExported as e:
    print(f"PACKAGE {e.path}\nPLANNED in {(time.time() - t0) / 60:.1f} min. Copy it to the render machine, run remote_render.py there.")
