"""Where a film's machines come from (owner 2026-10-12): RunPod's cheap machines and Vast.ai's cheap machines, looked
at together, cheapest first; RunPod's processor-only machines (secure data centres, plenty in stock, $0.48/h for 16
cores) only when nothing cheaper is free. The GPU itself is never used: Mr Truth plans and draws on the processor.

Every offer has a price, a size and a source; `Sources.rent` tries them cheapest first until one really starts. A
machine's id carries its source - "vast:123" for Vast, the plain pod id for RunPod (as the first version stored it) -
so switching off, looking up and listing go to the right place.

RunPod gets its start script as the container command; Vast takes only a short command, so it fetches its script from a
link the website made (the script holds the keys, so the link is private and short-lived, and the object is deleted
when the film ends)."""
import email.utils
import json
import re
import shlex
import time

import requests

REST = "https://rest.runpod.io/v1"
GRAPHQL = "https://api.runpod.io/graphql"
VAST = "https://console.vast.ai"
IMAGE = "node:22-bookworm"
# only when RunPod's price list cannot be read: tried in this order (roughly cheapest first)
GPUS = ("NVIDIA GeForce RTX 3090", "NVIDIA RTX A4000", "NVIDIA RTX A4500", "NVIDIA RTX A5000", "NVIDIA A40",
        "NVIDIA RTX A6000", "NVIDIA L4", "NVIDIA L40S", "NVIDIA GeForce RTX 4090", "NVIDIA L40",
        "NVIDIA RTX PRO 4500 Blackwell", "NVIDIA A100-SXM4-40GB")
# the backup: RunPod's processor-only machines (secure cloud), compute-optimised flavours, 2 GB per core
BACKUP_FLAVORS = ("cpu3c", "cpu5c")
BACKUP_FALLBACK_HR = 0.03                      # $ per core-hour when the live price cannot be read
# Vast hosts: where (the planner searches Bing and calls Claude and Gemini; a drawer only needs fast internet), how
# reliable, how fast its internet is, and no processors more than ~8 years old (a share would take twice as long)
VAST_COUNTRIES = {"US", "CA", "GB", "IE", "FR", "DE", "NL", "BE", "LU", "AT", "CH", "IT", "ES", "PT", "DK", "SE", "NO",
                  "FI", "IS", "PL", "CZ", "SK", "SI", "HR", "HU", "RO", "BG", "GR", "EE", "LV", "LT"}
VAST_MIN_RELIABILITY = 0.97
VAST_MIN_NET_MBPS = 200
VAST_MAX_GB_COST = 0.05                        # $ per GB of traffic some hosts charge on top
VAST_OLD_CPU = re.compile(r"E5-|E7-|E3-|\bX5\d{3}|\bL5\d{3}|\bE5\d{3}|Silver 41|Bronze|Opteron|Phenom|FX-", re.I)
VAST_DISK_GB = 40
VAST_BAD_HOST_S = 6 * 3600                     # a Vast computer whose machine would not start is passed over this long
VAST_SLOW_HOST_S = 7 * 86400                   # and one that drew far slower than the film's other machines, this long
AVOID = {}                                     # Vast computer (its machine_id, as text) -> passed over until then
MIN_BALANCE = 3.0                              # a source with less than this (or 2 h of its spending) is not used


def _ago(text: str) -> float:
    try:
        return email.utils.parsedate_to_datetime(text).timestamp()
    except (TypeError, ValueError):
        return 0.0


def avoid(host, seconds: float) -> None:
    """Pass a Vast computer over for `seconds` (the website keeps the list across restarts)."""
    if host:
        AVOID[str(host)] = max(AVOID.get(str(host), 0), time.time() + seconds)


class Sources:
    """The machine sources of one website. `keys` is the website's keys.env (RUNPOD_API_KEY, VAST_API_KEY)."""

    def __init__(self, keys: dict, note=lambda s: None):
        self.keys, self.note = keys, note
        self._bal, self._bal_at = {}, 0.0

    @property
    def runpod_key(self):
        return self.keys.get("RUNPOD_API_KEY", "")

    @property
    def vast_key(self):
        return self.keys.get("VAST_API_KEY", "")

    def _rp_headers(self):
        return {"Authorization": "Bearer " + self.runpod_key}

    def _vast_headers(self):
        return {"Authorization": "Bearer " + self.vast_key, "Content-Type": "application/json"}

    def _graphql(self, query: str) -> dict:
        r = requests.post(GRAPHQL, params={"api_key": self.runpod_key}, json={"query": query}, timeout=60)
        r.raise_for_status()
        got = r.json()
        if got.get("errors"):                      # an outage or a limit often comes back as 200 with errors
            raise ValueError(f"RunPod price list: {str(got['errors'])[:200]}")
        return got.get("data") or {}

    # ── what each source offers ───────────────────────────────────────────

    def runpod_offers(self, min_vcpu: int, ram: int) -> list:
        """RunPod's GPU machines in stock with at least `min_vcpu` cores and `ram` GB, cheapest first (both clouds)."""
        out = []
        for secure in (False, True):
            data = self._graphql(
                "query { gpuTypes { id lowestPrice(input:{gpuCount:1, minVcpuCount:%d, minMemoryInGb:%d, "
                "secureCloud:%s}) { uninterruptablePrice stockStatus } } }"
                % (int(min_vcpu), int(ram), "true" if secure else "false"))
            for g in data.get("gpuTypes") or []:
                lp = g.get("lowestPrice") or {}
                stock = str(lp.get("stockStatus") or "")
                if lp.get("uninterruptablePrice") and stock and stock.lower() != "none":
                    cloud = "SECURE" if secure else "COMMUNITY"
                    out.append({"src": "runpod", "price": float(lp["uninterruptablePrice"]), "gpu": g["id"],
                                "cloud": cloud, "vcpu": int(min_vcpu),
                                "desc": f"{g['id'].replace('NVIDIA ', '')}, RunPod {cloud.lower()}"})
        return sorted(out, key=lambda o: o["price"])

    def runpod_fallback(self, min_vcpu: int) -> list:
        """RunPod's price list could not be read: the fixed list, price unknown (checked once the machine exists)."""
        return [{"src": "runpod", "price": None, "gpu": g, "cloud": c, "vcpu": int(min_vcpu),
                 "desc": f"{g.replace('NVIDIA ', '')}, RunPod {c.lower()}"} for c in ("COMMUNITY", "SECURE") for g in GPUS]

    def backup_offers(self, min_vcpu: int, ram: int) -> list:
        """RunPod's processor-only machines: 16 cores (32 when asked for more), 2 GB per core, secure data centres."""
        vcpu = 16 if min_vcpu <= 16 else 32
        if ram > vcpu * 2:
            vcpu = 32
        out = []
        for flavor in BACKUP_FLAVORS:
            price, stock = BACKUP_FALLBACK_HR * vcpu, "?"
            try:
                data = self._graphql('query { cpuFlavors { id specifics(input:{instanceId:"%s-%d-%d"}) '
                                     '{ stockStatus securePrice } } }' % (flavor, vcpu, vcpu * 2))
                spec = next((f.get("specifics") or {} for f in data.get("cpuFlavors") or [] if f.get("id") == flavor), {})
                stock = str(spec.get("stockStatus") or "")
                if spec.get("securePrice"):
                    price = float(spec["securePrice"])
                if not stock or stock.lower() == "none":
                    continue
            except (requests.RequestException, ValueError, KeyError, TypeError):
                pass                                    # unknown: still worth a try (it is the last resort)
            out.append({"src": "runpod-cpu", "price": price, "flavor": flavor, "vcpu": vcpu, "backup": True,
                        "desc": f"{vcpu}-core processor-only ({flavor}), RunPod secure"})
        return sorted(out, key=lambda o: o["price"])

    def vast_offers(self, min_vcpu: int, ram: int) -> list:
        """Vast.ai's free on-demand machines with at least `min_vcpu` effective cores and `ram` GB, in the countries
        above, reliable, with fast internet and a recent processor; priced with their traffic charges."""
        q = {"rentable": {"eq": True}, "rented": {"eq": False}, "verified": {"eq": True}, "type": "ondemand",
             "cpu_cores_effective": {"gte": int(min_vcpu)}, "cpu_ram": {"gte": int(ram) * 1000},
             "reliability": {"gte": VAST_MIN_RELIABILITY}, "inet_up": {"gte": VAST_MIN_NET_MBPS},
             "inet_down": {"gte": VAST_MIN_NET_MBPS}, "disk_space": {"gte": VAST_DISK_GB},
             "dph_total": {"lte": 2.0}, "allocated_storage": VAST_DISK_GB, "order": [["dph_total", "asc"]],
             "limit": 200}
        r = requests.post(f"{VAST}/api/v0/bundles/", json=q, headers=self._vast_headers(), timeout=60)
        r.raise_for_status()
        out = []
        for o in r.json().get("offers") or []:
            country = str(o.get("geolocation") or "").split(",")[-1].strip().upper()
            cost = float(o.get("inet_up_cost") or 0) + float(o.get("inet_down_cost") or 0)
            if (country not in VAST_COUNTRIES or VAST_OLD_CPU.search(str(o.get("cpu_name") or ""))
                    or float(o.get("inet_up_cost") or 0) > VAST_MAX_GB_COST
                    or float(o.get("inet_down_cost") or 0) > VAST_MAX_GB_COST or o.get("is_bid")
                    or AVOID.get(str(o.get("machine_id")), 0) > time.time()):
                continue
            cores = int(float(o.get("cpu_cores_effective") or 0))
            # the hourly price with our disk (charged by the GB a month; the search counts it when told the size),
            # and about a GB each way per machine-hour of traffic
            disk = float(o.get("storage_cost") or 0) * VAST_DISK_GB / 720
            price = max(float(o.get("dph_total") or 0), float(o.get("dph_base") or 0) + disk) + cost
            cpu = re.sub(r"\s*\d+-Core Processor|\(R\)|®|™", "", str(o.get("cpu_name") or "")).strip()
            out.append({"src": "vast", "price": round(price, 4), "offer": o["id"], "vcpu": cores,
                        "host": o.get("machine_id"), "desc": f"{cores}-core {cpu}, Vast {country}"})
        return sorted(out, key=lambda o: o["price"])

    def offers(self, min_vcpu: int, ram: int, max_hr=None, fallback: bool = False, backup: bool = True) -> tuple:
        """Every source's offers under `max_hr`, cheapest first, the backup last among equals; and what went wrong
        reading them (a source that does not answer is left out, never the reason a film fails on its own)."""
        out, problems = [], []
        usable = self.usable()
        if self.runpod_key and usable.get("runpod", True):
            try:
                out += self.runpod_offers(min_vcpu, ram)
            except (requests.RequestException, ValueError, KeyError, TypeError) as e:
                problems.append(f"RunPod price list: {type(e).__name__}")
                if fallback:
                    out += self.runpod_fallback(min_vcpu)
        if self.vast_key and usable.get("vast", True):
            try:
                out += self.vast_offers(min_vcpu, ram)
            except (requests.RequestException, ValueError, KeyError, TypeError) as e:
                problems.append(f"Vast offers: {type(e).__name__}")
        if backup and self.runpod_key and usable.get("runpod", True):
            out += self.backup_offers(min_vcpu, ram)
        if max_hr is not None:
            out = [o for o in out if o["price"] is None or o["price"] <= max_hr]
        # cheapest first; an unknown price (the fixed list) after every known one; the backup after an equal offer
        out.sort(key=lambda o: (o["price"] is None, o["price"] or 0, bool(o.get("backup"))))
        for src, ok in usable.items():
            if not ok:
                problems.append(f"{'RunPod' if src == 'runpod' else 'Vast'} balance too low")
        return out, problems

    # ── renting ───────────────────────────────────────────────────────────

    def create(self, offer: dict, name: str, env: dict, script: str, boot=None):
        """Start one machine from an offer. Returns (machine, why-not): machine = {"id", "hr", "desc", "vcpu"}.
        A lost answer is checked by name: a machine made under this name is ours; if none shows, renting stops
        (whatever was made is switched off with the film, by its name)."""
        env = dict(env, VCPU=str(offer.get("vcpu") or 16))
        if offer["src"] in ("runpod", "runpod-cpu"):
            body = {"name": name, "imageName": IMAGE, "containerDiskInGb": 60, "volumeInGb": 0,
                    "dockerEntrypoint": ["bash", "-c"], "dockerStartCmd": [script], "ports": [], "env": env}
            if offer["src"] == "runpod":
                body.update(gpuCount=1, gpuTypeIds=[offer["gpu"]], cloudType=offer["cloud"],
                            minVCPUPerGPU=int(offer["vcpu"]), minRAMPerGPU=int(env.get("_RAM", 32)))
            else:
                body.update(computeType="CPU", cpuFlavorIds=[offer["flavor"]], vcpuCount=int(offer["vcpu"]),
                            cloudType="SECURE")
            body["env"] = {k: v for k, v in env.items() if not k.startswith("_")}
            try:
                r = requests.post(f"{REST}/pods", json=body, timeout=60, headers=self._rp_headers())
            except requests.ConnectTimeout:
                return None, "RunPod did not answer"
            except requests.RequestException:
                return self._found(name, offer), "lost answer"
            if not r.ok:
                return None, f"RunPod HTTP {r.status_code}: {(r.text or '')[:120]}"
            try:
                pod = r.json()
            except ValueError:
                return self._found(name, offer), "lost answer"
            if not pod.get("id"):
                return None, "RunPod gave no id"
            hr = float(pod.get("costPerHr") or offer.get("price") or 0)
            return {"id": pod["id"], "hr": hr, "vcpu": offer.get("vcpu"),
                    "desc": f"{offer['desc']}, {offer.get('vcpu')}+ CPUs, ${hr:.2f}/h"}, ""
        # Vast: a short command fetches the full script (with the settings above) from a private link
        text = "".join(f"export {k}={shlex.quote(str(v))}\n" for k, v in env.items() if not k.startswith("_")) + script
        url = boot(name, text)
        body = {"image": IMAGE, "label": name, "disk": VAST_DISK_GB, "runtype": "args", "cancel_unavail": True,
                "args": ["bash", "-c", f"curl -sf -m 300 --retry 8 --retry-all-errors '{url}' -o /root/boot.sh "
                                       f"&& exec bash /root/boot.sh"]}
        try:
            r = requests.put(f"{VAST}/api/v0/asks/{offer['offer']}/", json=body, headers=self._vast_headers(), timeout=60)
        except requests.ConnectTimeout:
            return None, "Vast did not answer"
        except requests.RequestException:
            return self._found(name, offer), "lost answer"
        try:
            got = r.json()
        except ValueError:
            got = {}
        if not r.ok or not got.get("new_contract"):
            return None, f"Vast HTTP {r.status_code}: {str(got.get('msg') or got.get('error') or r.text)[:120]}"
        hr = float(offer.get("price") or 0)
        return {"id": f"vast:{got['new_contract']}", "hr": hr, "vcpu": offer.get("vcpu"), "host": offer.get("host"),
                "desc": f"{offer['desc']}, ${hr:.2f}/h"}, ""

    def _found(self, name, offer):
        m = next((p for p in self.list() if p.get("name") == name), None)
        if not m:
            return None
        hr = float(m.get("hr") or offer.get("price") or 0)
        return {"id": m["id"], "hr": hr, "vcpu": offer.get("vcpu"), "host": offer.get("host"),
                "desc": f"{offer['desc']}, ${hr:.2f}/h"}

    def rent(self, name: str, env: dict, script: str, min_vcpu: int = 16, ram: int = 32, max_hr=None,
             fallback: bool = False, backup: bool = True, stop=lambda: False, boot=None) -> tuple:
        """The cheapest machine that really starts: (machine or None, what was tried - for the film's log)."""
        offers, problems = self.offers(min_vcpu, ram, max_hr, fallback, backup)
        tried = list(problems)
        for offer in offers:
            if stop():                                   # Stop pressed while renting: rent nothing more
                return None, tried
            if offer["src"] == "vast" and boot is None:
                continue
            machine, why = self.create(offer, name, dict(env, _RAM=ram), script, boot)
            if machine:
                if max_hr is not None and machine["hr"] > max_hr:      # dearer than listed: not this one
                    self.terminate(machine["id"])
                    tried.append(f"{offer['desc']}: ${machine['hr']:.2f}/h is over the limit")
                    continue
                return machine, tried
            tried.append(f"{offer['desc']} ${offer['price'] if offer['price'] is not None else '?'}/h: {why}")
            if why == "lost answer":                     # it may exist after all: stop rather than risk two
                return None, tried
        if not offers:
            tried.append("nothing free under the price limit")
        return None, tried

    # ── the machines we have ──────────────────────────────────────────────

    def list(self) -> list:
        """Every machine on both accounts: [{"id", "name", "hr", "state"}] (a source that does not answer: none)."""
        out = []
        if self.runpod_key:
            try:
                r = requests.get(f"{REST}/pods", timeout=60, headers=self._rp_headers())
                got = r.json() if r.ok else []
                got = got.get("pods", []) if isinstance(got, dict) else got
                for p in got if isinstance(got, list) else []:
                    if isinstance(p, dict) and p.get("id"):
                        out.append({"id": p["id"], "name": str(p.get("name") or ""), "hr": p.get("costPerHr"),
                                    "state": str(p.get("desiredStatus") or "").lower()})
            except (requests.RequestException, ValueError):
                pass
        if self.vast_key:
            token = None
            try:
                for _ in range(40):                      # 25 a page
                    params = {"limit": 25, "select_cols": json.dumps(["id", "label", "actual_status", "dph_total",
                                                                       "intended_status"])}
                    if token:
                        params["after_token"] = token
                    r = requests.get(f"{VAST}/api/v1/instances", params=params, headers=self._vast_headers(), timeout=60)
                    if not r.ok:
                        break
                    got = r.json()
                    for p in got.get("instances") or []:
                        out.append({"id": f"vast:{p['id']}", "name": str(p.get("label") or ""), "hr": p.get("dph_total"),
                                    "state": str(p.get("actual_status") or "").lower()})
                    token = got.get("next_token")
                    if not token:
                        break
            except (requests.RequestException, ValueError, KeyError):
                pass
        return out

    def state(self, mid: str) -> str:
        """"running", "starting", "stopped" (exited, offline...), "gone" (404), or "unknown" (could not ask)."""
        if not mid:
            return "gone"
        try:
            if str(mid).startswith("vast:"):
                r = requests.get(f"{VAST}/api/v0/instances/{mid[5:]}/", headers=self._vast_headers(), timeout=30)
                if r.status_code == 404:
                    return "gone"
                if not r.ok:
                    return "unknown"
                inst = r.json().get("instances")
                inst = inst[0] if isinstance(inst, list) and inst else inst
                if not inst:
                    return "gone"
                s = str(inst.get("actual_status") or "").lower()
                if "stopped" in (str(inst.get("cur_state") or "").lower(), str(inst.get("intended_status") or "").lower()):
                    # we never stop a machine (only delete it): the host gave up on it, e.g. "failed to start
                    # containers" on a broken computer, seen 2026-10-12 - that computer is passed over for a while
                    if s != "running":
                        avoid(inst.get("machine_id"), VAST_BAD_HOST_S)
                    return "stopped"
                return ("running" if s == "running" else "starting" if s in ("", "loading", "created", "scheduling")
                        else "stopped")
            r = requests.get(f"{REST}/pods/{mid}", timeout=30, headers=self._rp_headers())
            if r.status_code == 404:
                return "gone"
            if not r.ok:
                return "unknown"
            s = str(r.json().get("desiredStatus") or "").upper()
            return "running" if s == "RUNNING" else "stopped" if s in ("EXITED", "TERMINATED") else "starting"
        except (requests.RequestException, ValueError, AttributeError):
            return "unknown"

    def terminate(self, mid: str) -> bool:
        """Switch a machine off for good. True once it is gone (already gone counts)."""
        if not mid:
            return True
        if str(mid).startswith("vast:"):
            for attempt in range(6):
                try:
                    r = requests.delete(f"{VAST}/api/v0/instances/{mid[5:]}/", headers=self._vast_headers(), timeout=30)
                    if r.ok or r.status_code == 404:
                        return True
                except requests.RequestException:
                    pass
                if attempt < 5:
                    time.sleep(min(30, 2 ** attempt * 2))
            return False
        from farm.runpod import RunPod
        return RunPod(self.runpod_key).terminate(mid)

    # ── money ─────────────────────────────────────────────────────────────

    def balances(self, fresh: bool = False) -> dict:
        """{"runpod": {"balance", "spend_hr"}, "vast": {"balance"}} for the sources with a key; read at most once a
        minute. A value that could not be read is None."""
        if not fresh and time.time() - self._bal_at < 60:
            return self._bal
        out = {}
        if self.runpod_key:
            try:
                me = self._graphql("query { myself { clientBalance currentSpendPerHr } }").get("myself") or {}
                out["runpod"] = {"balance": float(me.get("clientBalance")), "spend_hr": float(me.get("currentSpendPerHr") or 0)}
            except (requests.RequestException, ValueError, KeyError, TypeError):
                out["runpod"] = {"balance": None, "spend_hr": None}
        if self.vast_key:
            try:
                r = requests.get(f"{VAST}/api/v0/users/current/", headers=self._vast_headers(), timeout=30)
                r.raise_for_status()
                me = r.json()
                bal = me.get("credit") if me.get("credit") is not None else me.get("balance")
                out["vast"] = {"balance": float(bal), "spend_hr": None}
            except (requests.RequestException, ValueError, KeyError, TypeError):
                out["vast"] = {"balance": None, "spend_hr": None}
        self._bal, self._bal_at = out, time.time()
        return out

    def usable(self) -> dict:
        """Which sources have enough money to rent from: at least MIN_BALANCE and two hours of what they spend now.
        A balance that could not be read does not stop renting (the source itself refuses if it must)."""
        out = {}
        for src, b in self.balances().items():
            bal, spend = b.get("balance"), b.get("spend_hr") or 0
            out[src] = bal is None or bal >= max(MIN_BALANCE, 2 * spend)
        return out
