"""The website's few command-line jobs (install.sh uses the first):
    python -m web.manage add-owner NAME          asks for the password twice
    python -m web.manage add-member NAME
    python -m web.manage password NAME           a new password for someone who forgot theirs
    python -m web.manage people"""
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from web.store import Store  # noqa: E402

DATA = Path(os.environ.get("MRTRUTH_WEB_DATA") or (Path.home() / "mrtruth-web-data"))


def ask(name):
    while True:
        a = getpass.getpass(f"Password for {name} (10+ characters): ")
        if len(a) < 10:
            print("  too short, at least 10 characters")
            continue
        if getpass.getpass("Same password again: ") == a:
            return a
        print("  the two did not match, again")


def main(argv):
    s = Store(DATA / "studio.sqlite")
    if len(argv) >= 2 and argv[0] in ("add-owner", "add-member"):
        s.add_user(argv[1], ask(argv[1]), "owner" if argv[0] == "add-owner" else "member")
        print(f"{argv[1]} added")
    elif len(argv) >= 2 and argv[0] == "password":
        s.set_password(argv[1], ask(argv[1]))
        print("password changed")
    elif argv[:1] == ["people"]:
        for u in s.users():
            print(f"{u['name']:20} {u['role']}")
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
