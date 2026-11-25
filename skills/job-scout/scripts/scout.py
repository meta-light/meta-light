#!/usr/bin/env python3
"""Job scout: scrape job boards listed in boards.txt, filter/score against config.json,
and drop anything already in the Notion Jobs DB or seen in a previous run.

Stdlib only. Usage:
  scout.py run   --boards boards.txt [--channels channels.txt] --existing existing.json [--out DIR] [--only SUBSTR] [--include-seen]
  scout.py seen  --add candidates.json        # mark every candidate in the file as seen
  scout.py seen  --add-urls URL [URL ...]     # mark specific URLs as seen

existing.json = list of Notion rows: [{"Role":..., "Company":..., "URL":...}, ...]
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
CONFIG = SKILL_DIR / "config.json"
SEEN = SKILL_DIR / "data" / "seen.json"
UA = "job-scout/1.0 (personal job search script)"
NOW = dt.datetime.now(dt.timezone.utc)

ATS_LINK = re.compile(
    r"https?://(?:jobs\.ashbyhq\.com|boards\.greenhouse\.io|job-boards\.greenhouse\.io|"
    r"jobs\.lever\.co|apply\.workable\.com|jobs\.gem\.com)/[A-Za-z0-9_.%-]+", re.I)


# ---------------------------------------------------------------- http
def get(url, as_json=False, timeout=25, retries=2):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8", "replace")
            return json.loads(body) if as_json else body
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (404, 403, 401, 410):
                break
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def job(title, company, url, location="", posted=None, source="", tags=(), headcount=None,
        comp="", crypto_context=False, work_mode=""):
    return {
        "title": (title or "").strip(), "company": (company or "").strip(), "url": url,
        "location": location or "", "posted": posted, "source": source,
        "tags": list(tags or []), "headcount": headcount, "comp": comp,
        "crypto_context": crypto_context, "work_mode": work_mode or "",
    }


def iso_from_epoch(x):
    try:
        return dt.datetime.fromtimestamp(int(x), dt.timezone.utc).date().isoformat()
    except Exception:  # noqa: BLE001
        return None


def iso(s):
    return s[:10] if isinstance(s, str) and len(s) >= 10 else None


def host_label(url):
    h = urllib.parse.urlparse(url).netloc.lower()
    h = re.sub(r"^(www|jobs|careers|talent|apply)\.", "", h)
    return h


# ---------------------------------------------------------------- sources
def next_data(page):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    return json.loads(m.group(1)) if m else None


def getro_jobs_from_page(page):
    d = next_data(page)
    if not d:
        return None
    try:
        found = d["props"]["pageProps"]["initialState"]["jobs"]["found"]
    except (KeyError, TypeError):
        return None
    return [j for j in found if isinstance(j, dict) and "title" in j]


def scrape_getro(url, cfg, first_page):
    """Getro SSR only renders 20 jobs, but honours ?q=, so run several keyword queries."""
    p = urllib.parse.urlparse(url)
    path = p.path
    if re.fullmatch(r"/companies/?", path):  # network company list -> jobs list
        path = "/jobs"
    base = urllib.parse.urlunparse((p.scheme, p.netloc, path, "", "", ""))
    label = host_label(url)
    seen, out = set(), []

    def add(items):
        for j in items or []:
            if j["id"] in seen:
                continue
            seen.add(j["id"])
            org = j.get("organization") or {}
            cmin, cmax = j.get("compensationAmountMinCents"), j.get("compensationAmountMaxCents")
            comp = ""
            if j.get("compensationPublic") and cmin:
                comp = f"${cmin // 100_000}k" + (f"-{cmax // 100_000}k" if cmax else "")
            out.append(job(j["title"], org.get("name"), j.get("url"),
                           "; ".join(j.get("locations") or []), iso_from_epoch(j.get("createdAt")),
                           f"getro:{label}", org.get("industryTags") or [], org.get("headCount"),
                           comp, work_mode=j.get("workMode") or ""))

    add(getro_jobs_from_page(first_page) if path == p.path else None)
    for q in cfg["getro_queries"]:
        try:
            pg = get(f"{base}?q={urllib.parse.quote(q)}")
            add(getro_jobs_from_page(pg))
        except Exception as e:  # noqa: BLE001
            print(f"  ! {label} q={q}: {e}", file=sys.stderr)
        time.sleep(0.4)
    return out


def scrape_ashby(slug):
    d = get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true", as_json=True)
    out = []
    for j in d.get("jobs", []):
        if j.get("isListed") is False:
            continue
        loc = j.get("location") or ""
        sec = [s.get("location", "") for s in j.get("secondaryLocations") or []]
        if j.get("isRemote"):
            loc += "; Remote"
        comp = ((j.get("compensation") or {}).get("compensationTierSummary")) or ""
        out.append(job(j.get("title"), slug, j.get("jobUrl"), "; ".join([loc] + sec),
                       iso(j.get("publishedAt")), f"ashby:{slug}", comp=comp, crypto_context=True,
                       work_mode=j.get("workplaceType") or ""))
    return out


def scrape_greenhouse(slug):
    d = get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", as_json=True)
    return [job(j.get("title"), j.get("company_name") or slug, j.get("absolute_url"),
                (j.get("location") or {}).get("name", ""), iso(j.get("first_published") or j.get("updated_at")),
                f"greenhouse:{slug}", crypto_context=True) for j in d.get("jobs", [])]


def scrape_lever(slug):
    d = get(f"https://api.lever.co/v0/postings/{slug}?mode=json", as_json=True)
    out = []
    for j in d:
        c = j.get("categories") or {}
        out.append(job(j.get("text"), slug, j.get("hostedUrl"),
                       "; ".join(filter(None, [c.get("location"), j.get("workplaceType")])),
                       iso_from_epoch((j.get("createdAt") or 0) / 1000), f"lever:{slug}",
                       crypto_context=True, work_mode=j.get("workplaceType") or ""))
    return out


def scrape_workable(slug):
    d = get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}", as_json=True)
    out = []
    for j in d.get("jobs", []):
        loc = ", ".join(filter(None, [j.get("city"), j.get("state"), j.get("country")]))
        if j.get("telecommuting"):
            loc += "; Remote"
        out.append(job(j.get("title"), d.get("name") or slug, j.get("url") or j.get("shortlink"),
                       loc, iso(j.get("published_on") or j.get("created_at")), f"workable:{slug}",
                       crypto_context=True))
    return out


def scrape_gem(slug):
    d = get(f"https://api.gem.com/job_board/v0/{slug}/job_posts/", as_json=True)
    out = []
    for j in d:
        loc = (j.get("location") or {}).get("name", "") if isinstance(j.get("location"), dict) else ""
        out.append(job(j.get("title"), slug.replace("-careers", ""), j.get("absolute_url"), loc,
                       iso(j.get("first_published_at") or j.get("updated_at")), f"gem:{slug}",
                       crypto_context=True))
    return out


# ---------------------------------------------------------------- telegram
TG_SKIP_HOSTS = ("t.me", "telegram.me", "telegram.org", "telesco.pe", "x.com", "twitter.com", "instagram.com")
HREF = re.compile(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', re.I)


def unescape(s):
    return html.unescape(html.unescape(s or ""))


def strip_tags(s):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def usable_link(url):
    p = urllib.parse.urlparse(unescape(url))
    host = p.netloc.lower().removeprefix("www.")
    if p.scheme not in ("http", "https") or not host:
        return False
    return not any(host == h or host.endswith("." + h) for h in TG_SKIP_HOSTS)


def links_in(fragment):
    out = []
    for href, inner in HREF.findall(fragment or ""):
        url = unescape(href)
        if usable_link(url):
            out.append((url, strip_tags(inner)))
    return out


def tg_ref(url):
    """Return ('public', username), ('private', id), or None."""
    p = urllib.parse.urlparse((url or "").strip())
    host = p.netloc.lower().removeprefix("www.")
    if host not in ("t.me", "telegram.me"):
        return None
    parts = [x for x in p.path.split("/") if x]
    if parts[:1] == ["s"]:
        parts = parts[1:]
    if not parts or parts[0] in ("c", "joinchat") or parts[0].startswith("+"):
        return ("private", parts[-1] if parts else url)
    return ("public", parts[0])


def tg_messages(page):
    out = []
    for chunk in page.split('data-post="')[1:]:
        post = chunk.split('"', 1)[0]
        if "/" not in post:
            continue
        chan, mid = post.split("/", 1)
        text_m = re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)</div>', chunk)
        time_m = re.search(r'<time datetime="([^"]+)"', chunk)
        out.append({
            "url": f"https://t.me/{chan}/{mid}",
            "html": text_m.group(1) if text_m else "",
            "posted": time_m.group(1)[:10] if time_m else None,
        })
    return out


ROLE_WORD = re.compile(
    r"analyst|engineer|manager|researcher|associate|lead|director|counsel|operator|specialist|"
    r"scientist|advocate|intern|recruiter|designer|officer|coordinator|strategist|owner", re.I)
SKIP_ROLE_TAG = re.compile(r"^(full|part)[\s·.-]*time$|^(remote|hybrid|contract|internship)$", re.I)


def best_job_url(links, fallback, intro=""):
    ranked = []
    for url, text in links:
        score = 0
        if ats_from_url(url):
            score += 5
        if re.search(r"/jobs?/|jobDetail|gh_jid|lever\.co|ashbyhq|greenhouse", url, re.I):
            score += 3
        if re.search(r"apply", text or "", re.I):
            score += 2
        if intro and url in intro:
            score -= 2
        ranked.append((score, url))
    if not ranked:
        return fallback
    return max(ranked)[1]


def emit(title, company, url, loc, msg, channel, comp="", mode=""):
    title, company = (title or "").strip(" -–—"), (company or "").strip(" -–—")
    if not title or not company or len(title) > 160 or len(company) > 80:
        return None
    if not mode and re.search(r"\bremote\b", loc or "", re.I):
        mode = "remote"
    elif not mode and re.search(r"\bhybrid\b", loc or "", re.I):
        mode = "hybrid"
    return job(title, company, url, loc or "", msg["posted"], f"tg:{channel}", comp=comp,
               crypto_context=True, work_mode=mode, tags=["telegram"])


def plain_lines(raw):
    text = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    lines = []
    for line in text.splitlines():
        s = strip_tags(line).strip(" -•*")
        if s and not re.search(r"forward to a friend", s, re.I):
            lines.append(s)
    return lines


def job_from_hiring_line(part, msg, channel):
    m = re.search(r"is hiring", part, re.I)
    if not m:
        return None
    company = strip_tags(part[:m.start()]).lstrip("-•* ").strip(" -")
    title = strip_tags(part[m.end():])
    title = re.sub(r"^(?:(?:an?|the)\s+)?(?:hybrid|remote|onsite|on-site|in-office)\s+", "", title, flags=re.I)
    title = re.sub(r"^(?:an?\s+)+", "", title, flags=re.I)
    loc = ""
    lm = re.search(r"\s+in\s+([A-Za-z][^.]{1,60})$", title)
    if lm:
        loc = lm.group(1).strip(" .")
        title = title[:lm.start()].strip()
    links = links_in(part)
    url = msg["url"]
    for u, t in links:
        if t and (t.lower() in title.lower() or title.lower() in t.lower()):
            url = u
            break
    else:
        url = best_job_url(links, msg["url"])
    mode = "hybrid" if re.search(r"\bhybrid\b", part, re.I) else ("remote" if re.search(r"\bremote\b", part, re.I) else "")
    return emit(title, company, url, loc, msg, channel, mode=mode)


def job_from_hiring_at(lines, links, msg, channel):
    out = []
    for line in lines:
        m = re.match(r"Hiring:\s*(?P<title>.+?)\s+at\s+(?P<company>.+?)(?:\s*\((?P<loc>[^)]+)\))?\s*$", line, re.I)
        if not m:
            continue
        url = best_job_url(links, msg["url"])
        j = emit(m.group("title"), m.group("company"), url, m.group("loc") or "", msg, channel)
        if j:
            out.append(j)
    return out


def company_from_intro(lines):
    if not lines:
        return ""
    m = re.match(r"^([A-Z][\w.&'+-]{1,48}?)\s+(?:is|—|–|-)\b", lines[0])
    return m.group(1).strip() if m else ""


def job_from_labels(lines, links, msg, channel, intro=""):
    labels, comp = {}, ""
    for line in lines:
        lab = re.match(r"(company|protocol|project|role|position|title|job|location|loc)\s*[:：]\s*(.+)", line, re.I)
        if lab:
            labels[lab.group(1).lower()] = lab.group(2).strip()
        elif re.search(r"\$\s?\d|k/year|per year|/year", line, re.I):
            comp = comp or line
    title = labels.get("role") or labels.get("position") or labels.get("title") or labels.get("job")
    company = labels.get("company") or labels.get("protocol") or labels.get("project") or company_from_intro(lines)
    if not title or not company:
        return []
    loc = labels.get("location") or labels.get("loc") or ""
    if not loc:
        loc = next((line for line in lines if re.fullmatch(r"remote|hybrid|on-?site", line, re.I)), "")
    return [j] if (j := emit(title, company, best_job_url(links, msg["url"], intro), loc, msg, channel, comp=comp)) else []


def job_from_at_line(lines, links, msg, channel):
    title = company = loc = comp = ""
    for line in lines:
        if re.match(r"at\s+\S", line, re.I) and not company:
            company = re.sub(r"^at\s+", "", line, flags=re.I).strip()
            continue
        if re.match(r"apply\b", line, re.I) or re.search(r"applications close|days left", line, re.I):
            continue
        if re.search(r"\$\s?\d|k/year|per year|/year", line, re.I):
            comp = comp or line
            continue
        if not title:
            title = line
            continue
        if not loc and len(line) < 80:
            loc = line
    if not (title and company):
        return []
    url = next((u for u, t in links if t and t.lower() in title.lower()), None) or best_job_url(links, msg["url"])
    j = emit(title, company, url, loc, msg, channel, comp=comp)
    return [j] if j else []


def job_from_hashtag_post(lines, links, msg, channel):
    """DeJob-style: company name, a #Role·Title tag, then an apply link."""
    if not any(re.match(r"#\s*Recruitment\b", line, re.I) for line in lines):
        return []
    company = ""
    for line in lines:
        if re.match(r"#", line) or re.match(r"(introduction|apply|compensation|requirements|responsibilities)\b", line, re.I):
            continue
        name = re.split(r"\s+#", line, maxsplit=1)[0].strip()
        if 1 < len(name) <= 60 and not name.lower().startswith("http"):
            company = name
            break
    title = ""
    for line in lines:
        for tag in re.findall(r"#([^\s#]+)", line):
            label = tag.replace("·", " ").replace("•", " ")
            if SKIP_ROLE_TAG.match(label) or not ROLE_WORD.search(label):
                continue
            title = label
            break
        if title:
            break
    loc = "Remote" if any(re.search(r"#Remote\b", line, re.I) for line in lines) else ""
    j = emit(title, company, best_job_url(links, msg["url"]), loc, msg, channel)
    return [j] if j else []


def job_from_structured(raw, msg, channel):
    lines = plain_lines(raw)
    links = links_in(raw)
    if not lines:
        return []
    intro = re.split(r"<br\s*/?>", raw, maxsplit=1, flags=re.I)[0]
    return (job_from_hiring_at(lines, links, msg, channel)
            or job_from_labels(lines, links, msg, channel, intro)
            or job_from_at_line(lines, links, msg, channel)
            or job_from_hashtag_post(lines, links, msg, channel))


def jobs_from_message(msg, channel):
    raw = re.sub(r'<i class="emoji"[^>]*>[\s\S]*?</i>', "", msg.get("html") or "")
    if not raw.strip():
        return []
    hiring = [j for part in re.split(r"<br\s*/?>", raw, flags=re.I) if (j := job_from_hiring_line(part, msg, channel))]
    return hiring or job_from_structured(raw, msg, channel)


def scrape_telegram(url, cfg):
    """Public t.me/s preview. Private t.me/c and t.me/+ links are reported, not fetched."""
    ref = tg_ref(url)
    if not ref:
        raise RuntimeError(f"not a telegram url: {url}")
    kind, name = ref
    if kind == "private":
        return [], "tg-private", {}
    preview = f"https://t.me/s/{urllib.parse.quote(name)}"
    max_age = cfg.get("max_age_days", 45)
    cap = int(cfg.get("tg_max_pages", 10))
    jobs, before, last_post = [], None, None
    for _ in range(cap):
        page = get(preview if not before else f"{preview}?before={before}")
        if "data-post=" not in page:
            return [], "tg-private", {}
        msgs = tg_messages(page)
        if not msgs:
            break
        stale = False
        for m in msgs:
            if m["posted"] and (last_post is None or m["posted"] > last_post):
                last_post = m["posted"]
            if m["posted"]:
                try:
                    if (NOW.date() - dt.date.fromisoformat(m["posted"])).days > max_age:
                        stale = True
                        continue
                except ValueError:
                    pass
            jobs.extend(jobs_from_message(m, name))
        nxt = re.search(r'data-before="(\d+)"', page)
        if stale or not nxt:
            break
        before = nxt.group(1)
        time.sleep(0.35)
    return jobs, "telegram", {"last_post": last_post} if last_post else {}


def scrape_source(url, cfg):
    if tg_ref(url):
        return scrape_telegram(url, cfg)
    jobs, kind = scrape_board(url, cfg)
    return jobs, kind, {}


def ats_from_url(url):
    p = urllib.parse.urlparse(url)
    host = p.netloc.lower()
    parts = [x for x in p.path.split("/") if x]
    if not parts:
        return None
    slug = urllib.parse.quote(urllib.parse.unquote(parts[0]))
    if "ashbyhq.com" in host:
        return ("ashby", slug)
    if "greenhouse.io" in host:
        return ("greenhouse", slug)
    if "lever.co" in host:
        return ("lever", slug)
    if "workable.com" in host:
        return ("workable", slug)
    if "gem.com" in host:
        return ("gem", slug)
    return None


ATS = {"ashby": scrape_ashby, "greenhouse": scrape_greenhouse, "lever": scrape_lever,
       "workable": scrape_workable, "gem": scrape_gem}


def scrape_board(url, cfg):
    """Return (jobs, status_string)."""
    a = ats_from_url(url)
    if a:
        return ATS[a[0]](a[1]), a[0]
    page = get(url)
    if getro_jobs_from_page(page) is not None or "getro" in page[:200000].lower():
        jobs = scrape_getro(url, cfg, page)
        if jobs:
            return jobs, "getro"
    # Generic careers page: follow embedded ATS links (capped).
    links = sorted({m.group(0).rstrip(".") for m in ATS_LINK.finditer(html.unescape(page))})
    targets = sorted({ats_from_url(l) for l in links if ats_from_url(l)})[:40]
    if not targets:
        return [], "manual"
    jobs = []
    crypto_parent = any(b in url for b in cfg.get("crypto_boards", []))
    for kind, slug in targets:
        try:
            for j in ATS[kind](slug):
                j["crypto_context"] = crypto_parent
                j["source"] += f"<{host_label(url)}"
                jobs.append(j)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {kind}:{slug}: {e}", file=sys.stderr)
    return jobs, f"embedded({len(targets)} ATS)"


# ---------------------------------------------------------------- filtering
def rx_any(patterns, text):
    return next((p for p in patterns if re.search(p, text, re.I)), None)


def norm_company(s):
    s = (s or "").lower()
    s = re.sub(r"\(.*?\)", "", s)  # "Douro Labs (Pyth)" -> "douro labs"
    s = re.sub(r"[-_]\d+$", "", s)  # getro slugs like hylo-2
    s = re.sub(r"\b(inc|llc|labs?|foundation|capital|research|protocol|network|ventures|the|co|corp|ltd)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def norm_url(u):
    u = (u or "").split("#")[0].split("?")[0].rstrip("/").lower()
    m = re.search(r"/jobs/(\d+)", u)  # getro job id survives across boards
    return f"getro:{m.group(1)}" if m and "ashby" not in u and "greenhouse" not in u else u


def evaluate(j, cfg):
    """Return (score, tier, reasons) or (None, None, reject_reason)."""
    t = j["title"]
    if not t:
        return None, None, "no title"
    if (p := rx_any(cfg["exclude_titles"], t)):
        return None, None, f"title:{p}"
    if (p := rx_any(cfg["exclude_senior_pm"], t)):
        return None, None, f"senior-pm:{p}"
    if (p := rx_any(cfg["exclude_seniority"], t)):
        return None, None, f"seniority:{p}"
    if re.search(r"\bhead of\b", t, re.I) and (j["headcount"] or 0) > cfg["head_of_max_headcount"]:
        return None, None, "head-of at large co"

    tier = next((tr for tr in cfg["tiers"] if rx_any(tr["title"], t)), None)
    if not tier:
        return None, None, "no tier match"

    loc = f'{j["location"]} {j["work_mode"]}'.strip()
    L = cfg["location"]
    is_remote = bool(rx_any(L["remote_markers"], loc))
    is_local = bool(rx_any(L["local_markers"], loc))
    if loc:
        if rx_any(L["non_us_remote"], loc) and not is_local and not re.search(r"united states|\bus\b|usa|north america|americas", loc, re.I):
            return None, None, f"loc:{loc}"
        if not rx_any(L["allow"], loc):
            return None, None, f"loc:{loc}"
        # US-only onsite/hybrid outside Boston
        if not is_remote and not is_local:
            return None, None, f"onsite elsewhere:{loc}"
    elif not L["keep_unknown"]:
        return None, None, "loc unknown"

    if j["posted"]:
        try:
            age = (NOW.date() - dt.date.fromisoformat(j["posted"])).days
            if age > cfg["max_age_days"]:
                return None, None, f"stale:{age}d"
        except ValueError:
            pass

    hay = " ".join([t, j["company"], " ".join(j["tags"])])
    kw = [p for p in cfg["keywords"] if re.search(p, hay, re.I)]
    crypto_tag = any(re.search(r"blockchain|crypto|web3|defi", x, re.I) for x in j["tags"])
    crypto_board = any(b in j["source"] for b in cfg.get("crypto_boards", []))
    signal = j["crypto_context"] or crypto_tag or crypto_board or bool(kw)
    if not signal:
        if tier["name"] in cfg["signal_required_tiers"] or not rx_any(cfg["non_crypto_signal"], hay):
            return None, None, "no crypto/AI signal"

    score = tier["points"] + min(len(kw) * cfg["keyword_points"], cfg["keyword_cap"])
    score += 8 if (j["crypto_context"] or crypto_tag or crypto_board) else 0
    reasons = [tier["name"]]
    if is_local:
        score += cfg["bonus"]["boston"]; reasons.append("Boston")
    elif is_remote:
        score += cfg["bonus"]["remote"]; reasons.append("Remote")
    else:
        reasons.append("location unclear")
    if j["comp"]:
        score += cfg["bonus"]["comp_listed"]
    if kw:
        reasons.append("kw:" + ",".join(re.sub(r"\\b", "", k) for k in kw[:5]))
    return score, tier["name"], reasons


# ---------------------------------------------------------------- qualification
_board_cache = {}


def _cached(key, url):
    if key not in _board_cache:
        _board_cache[key] = get(url, as_json=True)
    return _board_cache[key]


def strip_html(s):
    s = re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", s or "", flags=re.I)
    s = html.unescape(html.unescape(re.sub(r"<[^>]+>", " ", s)))
    return re.sub(r"[ \t\xa0]+", " ", s)


def fetch_description(url):
    """Best-effort plain-text job description via public ATS APIs; '' if unavailable."""
    p = urllib.parse.urlparse(url or "")
    host, parts = p.netloc.lower(), [x for x in p.path.split("/") if x]
    try:
        if "ashbyhq.com" in host and len(parts) >= 2:
            slug = urllib.parse.quote(urllib.parse.unquote(parts[0]))
            d = _cached(f"ashby:{slug}", f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
            for j in d.get("jobs", []):
                if j.get("id") == parts[1]:
                    return j.get("descriptionPlain") or strip_html(j.get("descriptionHtml"))
        if "greenhouse.io" in host and "jobs" in parts:
            jid = parts[parts.index("jobs") + 1]
            d = get(f"https://boards-api.greenhouse.io/v1/boards/{parts[0]}/jobs/{jid}", as_json=True)
            return strip_html(d.get("content"))
        if "lever.co" in host and len(parts) >= 2:
            d = get(f"https://api.lever.co/v0/postings/{parts[0]}/{parts[1]}", as_json=True)
            lists = "\n".join(f'{l.get("text")}\n{strip_html(l.get("content"))}' for l in d.get("lists", []))
            return "\n".join([d.get("descriptionPlain", ""), lists, d.get("additionalPlain", "")])
        if "gem.com" in host and parts:
            d = _cached(f"gem:{parts[0]}", f"https://api.gem.com/job_board/v0/{parts[0]}/job_posts/")
            for j in d:
                if (j.get("absolute_url") or "").rstrip("/") == url.rstrip("/"):
                    return strip_html(j.get("content"))
        if p.scheme.startswith("http") and "getro" not in host:
            return strip_html(re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", get(url), flags=re.S | re.I))[:40000]
    except Exception as e:  # noqa: BLE001
        print(f"  ! desc {url}: {e}", file=sys.stderr)
    return ""


YEARS = re.compile(r"(?<![\d.$])(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?years?\b([^.\n]{0,90})", re.I)


def qualify(j, cfg):
    """Attach description-derived facts; return a reject reason or None."""
    q = cfg["qualification"]
    text = j.get("description") or ""
    if not text:
        j["qual"] = "no description fetched, check manually"
        return None
    # Years of experience: ignore 'years old', 'years ago', company age, nice-to-haves.
    reqs = []
    for m in YEARS.finditer(text):
        ctx = m.group(2).lower()
        before = text[max(0, m.start() - 60):m.start()].lower()
        if re.search(r"\b(old|ago|in business|history)\b", ctx) or re.search(r"(nice to have|bonus|preferred|founded)", before):
            continue
        if not re.search(r"experience|exp\b|working|track record|in (a|an|the)? ?\w+ (role|capacity)|product|research|industry|analyst|management", ctx + before):
            continue
        reqs.append((int(m.group(1)), (m.group(0)).strip()[:110]))
    j["years_required"] = max((n for n, _ in reqs), default=None)
    j["years_snippets"] = [s for _, s in reqs][:4]
    is_pm = j["tier"].startswith("T2")
    limit = q["max_years_pm"] if is_pm else q["max_years"]
    pm_years = [n for n, s in reqs if re.search(r"product (management|manager)|\bpm\b", s, re.I)]
    if is_pm and pm_years and max(pm_years) > limit:
        return f"needs {max(pm_years)}+ yrs PM (limit {limit})"
    if j["years_required"] and j["years_required"] > q["max_years"]:
        return f"needs {j['years_required']}+ yrs (limit {q['max_years']})"
    if (m := re.search(cfg["travel_flag_regex"], text, re.I)) and int(m.group(2)) > q["max_travel_pct"]:
        return f"travel {m.group(2)}%"
    if (p := rx_any(q["heavy_travel"], text)):
        j["flags"] = j.get("flags", []) + [f"travel: {p}"]
    if (p := rx_any(q["onsite_elsewhere"], text)) and not rx_any(cfg["location"]["local_markers"], j["location"]):
        return f"in-office requirement: {p}"
    if (p := rx_any(q["blockers"], text)):
        return f"requires {p}"
    for p in q["soft_flags"]:
        if re.search(p, text, re.I):
            j["flags"] = j.get("flags", []) + [p]
    return None


# ---------------------------------------------------------------- commands
def merge(base, overlay):
    out = dict(base)
    for k, v in overlay.items():
        if str(k).startswith("_"):
            continue
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merge(out[k], v)
        else:
            out[k] = v
    return out


def load_cfg():
    if not CONFIG.exists():
        raise SystemExit(
            "config.json is missing. Copy templates/config.json to config.json and fill "
            "location, qualification, and applied_companies. Do not commit that file."
        )
    cfg = json.loads(CONFIG.read_text())
    prof = SKILL_DIR / "data" / "profile.json"
    if prof.exists():
        cfg = merge(cfg, json.loads(prof.read_text()))
    return cfg


def http_lines(path):
    return [l.strip() for l in Path(path).read_text().splitlines() if l.strip().startswith("http")]


def load_seen():
    try:
        return set(json.loads(SEEN.read_text()))
    except Exception:  # noqa: BLE001
        return set()


def save_seen(s):
    SEEN.parent.mkdir(parents=True, exist_ok=True)
    SEEN.write_text(json.dumps(sorted(s), indent=0))


def cmd_run(a):
    cfg = load_cfg()
    boards = http_lines(a.boards)
    ch_path = None
    if not a.no_channels:
        ch_path = a.channels or (str(SKILL_DIR / "data" / "channels.txt")
                                 if (SKILL_DIR / "data" / "channels.txt").exists() else None)
    channels = http_lines(ch_path) if ch_path else []
    if a.only:
        boards = [b for b in boards if a.only.lower() in b.lower()]
        channels = [c for c in channels if a.only.lower() in c.lower()]
    existing = json.loads(Path(a.existing).read_text()) if a.existing else []
    ex_urls = {norm_url(r.get("URL") or r.get("userDefined:URL")) for r in existing}
    # dead rows (Closed / Lost / No-Go) don't block the company: a new role there is fair game
    dead = {s.lower() for s in cfg.get("nonblocking_statuses", ["Closed", "Lost", "No-Go"])}
    ex_cos = {norm_company(r.get("Company")) for r in existing
              if r.get("Company") and (r.get("Status") or "").lower() not in dead}
    applied = {norm_company(c) for c in cfg["applied_companies"]}
    seen = set() if a.include_seen else load_seen()

    status, all_jobs = {}, []
    sources = boards + channels
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(scrape_source, b, cfg): b for b in sources}
        for f in cf.as_completed(futs):
            b = futs[f]
            try:
                js, kind, meta = f.result()
                status[b] = {"kind": kind, "jobs": len(js), **(meta or {})}
                all_jobs += js
                extra = f"  last {meta.get('last_post')}" if meta.get("last_post") and not js else ""
                print(f"  {kind:<18} {len(js):>4}  {b}{extra}", file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                status[b] = {"kind": "error", "jobs": 0, "error": str(e)[:200]}
                print(f"  {'ERROR':<18}       {b}  {e}", file=sys.stderr)

    # dedupe identical postings found on several boards
    uniq = {}
    for j in all_jobs:
        k = norm_url(j["url"])
        if k not in uniq:
            uniq[k] = j
        else:
            uniq[k]["source"] += f",{j['source']}" if j["source"] not in uniq[k]["source"] else ""
    rejects, kept = {}, []
    near, pipeline_hits = [], []
    near_cfg = {**cfg, "tiers": [{"name": "Near miss", "points": 0, "title": [".*"]}],
                "signal_required_tiers": ["Near miss"]}
    for k, j in uniq.items():
        nc = norm_company(j["company"])
        if k in ex_urls:
            rejects["already in Notion (url)"] = rejects.get("already in Notion (url)", 0) + 1; continue
        if k in seen:
            rejects["seen in earlier run"] = rejects.get("seen in earlier run", 0) + 1; continue
        # exact normalized match only: substring matching hid Rain ("Tephra" ~ "Tephra Digital") and
        # Clear ("clear" in "Space Nuclear")
        if nc and nc in ex_cos | applied:
            rejects["company already in Notion/applied"] = rejects.get("company already in Notion/applied", 0) + 1
            # don't drop silently: other roles at pipeline companies that pass every filter get listed for review
            score, tier, why = evaluate(j, cfg)
            if score is not None:
                pipeline_hits.append({"title": j["title"], "company": j["company"], "url": j["url"], "tier": tier,
                                      "location": j["location"], "posted": j["posted"], "source": j["source"]})
            continue
        score, tier, why = evaluate(j, cfg)
        if why == "no tier match":
            # near miss: re-run with a catch-all tier so odd titles that pass every other check get a human look
            s2, _, w2 = evaluate(j, near_cfg)
            if s2 is not None:
                near.append({"title": j["title"], "company": j["company"], "url": j["url"],
                             "location": j["location"], "posted": j["posted"], "source": j["source"], "why": w2})
        if score is None:
            key = why.split(":")[0]
            rejects[key] = rejects.get(key, 0) + 1; continue
        if score < cfg["min_score"]:
            rejects["below min_score"] = rejects.get("below min_score", 0) + 1; continue
        j.update(score=score, tier=tier, reasons=why, key=k)
        kept.append(j)

    # qualification: read each surviving posting and drop ones the profile doesn't qualify for
    unqualified = []
    if not a.no_qualify:
        with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
            for j, d in zip(kept, ex.map(lambda x: fetch_description(x["url"]), kept)):
                j["description"] = d
        still = []
        for j in kept:
            why = qualify(j, cfg)
            if why:
                unqualified.append({"title": j["title"], "company": j["company"], "url": j["url"],
                                    "key": j["key"], "why": why})
                rejects["not qualified"] = rejects.get("not qualified", 0) + 1
            else:
                still.append(j)
        kept = still
        for j in kept:  # keep a short excerpt for review, not the whole posting
            j["description"] = (j["description"] or "")[:3000]

    # one role per company: keep best score, list the rest as alternates
    by_co = {}
    for j in sorted(kept, key=lambda x: (-x["score"], x["posted"] or "") ):
        nc = norm_company(j["company"]) or j["url"]
        if nc in by_co:
            by_co[nc].setdefault("also_open", []).append(f'{j["title"]} | {j["url"]}')
        else:
            by_co[nc] = j
    cands = sorted(by_co.values(), key=lambda x: (-x["score"], -(int((x["posted"] or "0000-00-00").replace("-", "")))))
    cands = cands[: cfg["max_candidates"]]

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out / "candidates.json").write_text(json.dumps(cands, indent=1))
    (out / "board_status.json").write_text(json.dumps(status, indent=1))
    (out / "unqualified.json").write_text(json.dumps(unqualified, indent=1))
    (out / "near_misses.json").write_text(json.dumps(near, indent=1))
    (out / "pipeline_company_hits.json").write_text(json.dumps(pipeline_hits, indent=1))
    lines = [f"# Job scout {NOW.date()}", "",
             f"Boards: {len(boards)} | channels: {len(channels)} | raw jobs: {len(all_jobs)} | unique: {len(uniq)} | candidates: {len(cands)}", "",
             "Rejected: " + ", ".join(f"{k} {v}" for k, v in sorted(rejects.items(), key=lambda x: -x[1])), "",
             "| # | Score | Tier | Role | Company | Location | Posted | Yrs req | Flags | URL |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for i, j in enumerate(cands, 1):
        lines.append(f'| {i} | {j["score"]} | {j["tier"]} | {j["title"]} | {j["company"]} | '
                     f'{j["location"][:40]} | {j["posted"] or "?"} | {j.get("years_required") or "-"} | '
                     f'{"; ".join(j.get("flags", [])) or j.get("qual", "")} | {j["url"]} |')
    lines += ["", "## Other roles at companies already in the pipeline (review; not qualification-checked)",
              *[f'- {p["title"]} @ {p["company"]} ({p["tier"]}, {p["location"][:30]}): {p["url"]}' for p in pipeline_hits]]
    lines += ["", "## Dropped as not qualified", *[f'- {u["title"]} @ {u["company"]}: {u["why"]}' for u in unqualified]]
    manual = [b for b, s in status.items() if s["kind"] in ("manual", "error", "tg-private") or s["jobs"] == 0]
    lines += ["", "## Boards needing manual check (no parseable jobs)", *[f"- {b} ({status[b]['kind']})" for b in manual]]
    (out / "summary.md").write_text("\n".join(lines))
    print(f"\nwrote {out/'candidates.json'} ({len(cands)}), {out/'summary.md'}", file=sys.stderr)


def cmd_seen(a):
    s = load_seen()
    n0 = len(s)
    if a.add:
        for j in json.loads(Path(a.add).read_text()):
            s.add(j.get("key") or norm_url(j["url"]))
        unq = Path(a.add).with_name("unqualified.json")
        if unq.exists():
            for j in json.loads(unq.read_text()):
                s.add(j["key"])
    for u in a.add_urls or []:
        s.add(norm_url(u))
    save_seen(s)
    print(f"seen: {n0} -> {len(s)}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--boards", required=True)
    r.add_argument("--channels", help="telegram channel list; default data/channels.txt if it exists")
    r.add_argument("--no-channels", action="store_true")
    r.add_argument("--existing")
    r.add_argument("--out", default=".")
    r.add_argument("--only", help="only boards whose URL contains this substring")
    r.add_argument("--include-seen", action="store_true")
    r.add_argument("--workers", type=int, default=8)
    r.add_argument("--no-qualify", action="store_true", help="skip fetching descriptions / qualification check")
    s = sub.add_parser("seen")
    s.add_argument("--add")
    s.add_argument("--add-urls", nargs="*")
    a = ap.parse_args()
    {"run": cmd_run, "seen": cmd_seen}[a.cmd](a)


if __name__ == "__main__":
    main()
