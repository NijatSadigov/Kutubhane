# Session handoff — 2026-09-27

Read this first, then `TODO.md` for the checklist. `ROADMAP.md` has the
reasoning and a dated log; `PROJECT_BRIEF.md` describes the system for someone
who has never seen it.

---

## ⚠️ Nothing is committed

A large amount of work is sitting in the working tree, unpushed and
**uncommitted**, on branch `backend-dynamic-categories`. There is no remote.
Commit before doing anything else:

```bash
git add -A && git commit -m "Global catalog, myredbookshelf reader app, staff console, reviews"
```

Database backups (which used to live in a temp folder that gets cleaned) are now
at `../db-backups/`. `pre_demo_seed_194513.dump` is the state *before* the demo
data was loaded.

---

## How to run

```bash
cd school-library-system && go run .
```

```bash
cd library-frontend && npm run dev
```

Postgres must be up: db `school_library`, user `postgres`, password `2334`.
Backend :8000 (override with `PORT`), frontend :5180.

`GORM_LOG=info` turns SQL logging back on — it defaults to warnings now because
Info level made bulk work very slow.

If the frontend serves stale code after edits: kill node on :5180,
`rm -rf node_modules/.vite`, restart. Vite's watcher drops changes on Windows.

**Logins**, all password `Test1234`: `admin@school.com`, `mgr@hadaf.com`,
`fatma@lib.com` (librarian, Nesimi), `nicat@stu.com` + 9 more students
(`aslan@`, `leyla@`, `tural@`, `nermin@`, `elvin@`, `aysu@`, `reshad@`,
`gunel@`, `kamran@` — all `@stu.com`).

## How to check nothing is broken

```bash
cd school-library-system && go test ./... && go run ./cmd/apiaudit -writes
```

```bash
cd library-frontend && npm run build && npx eslint src/mrb src/staff
```

Last run: 23 Go tests pass, **133 API checks pass**, build and lint clean.

Deeper suites are in `tools/` and need a **scratch database** — never run them
against `school_library`:

```bash
psql -U postgres -c "CREATE DATABASE school_library_loantest"
pg_dump -U postgres school_library | psql -U postgres -d school_library_loantest
DATABASE_DSN="host=localhost user=postgres password=2334 dbname=school_library_loantest port=5432 sslmode=disable" PORT=8001 go run .
python tools/test_loan_lifecycle.py     # 33 checks, hits :8001
```

`tools/populate_demo.py` reloads demo data (takes `BASE`, defaults to :8000).

---

## Where the code is

| Path | What |
|---|---|
| `library-frontend/src/mrb/` | myredbookshelf reader app — `/` landing, `/app/*` |
| `library-frontend/src/staff/` | staff console — `/staff/*` |
| `library-frontend/src/pages/` | the **old** dashboards, still live at `/librarian`, `/manager`, `/admin`, `/student` |
| `school-library-system/catalog/` | the shared catalogue matcher (+ its tests) |
| `school-library-system/cmd/apiaudit/` | the endpoint smoke test |
| `school-library-system/cmd/catalogbackfill/` | one-off catalogue migration, idempotent |
| `Hedef Kutuphane clickable prototype (1)/` | **the design**, untracked |

Routing: `/` shows the landing page to a guest and sends a member to `/app`.
Students land in `/app` after login; staff still go to their old console.

---

## The single most important lesson from this session

**Build screens from the prototype's markup, not from the README's prose.**

The first pass at Discover was written from the README summary and the user's
verdict was that it looked like "a cheap copy" — wrong sizes, wrong colours, and
whole sections simply missing. Rebuilding it meant opening
`Hedef Kutuphane clickable prototype (1)/design_handoff_myredbookshelf/myredbookshelf.dc.html`,
finding that screen's block (`<sc-if value="{{ isHub }}">` at line 78) and
transcribing the literal values.

**Only Discover has had that treatment.** Catalogue, Book detail, My Shelf,
Challenges, Landing and the whole staff console are still the looser first
versions and need the same pass. That is the top item in `TODO.md`.

To view the prototype:

```bash
cd "Hedef Kutuphane clickable prototype (1)/design_handoff_myredbookshelf" && python -m http.server 8899
```

then open `http://127.0.0.1:8899/myredbookshelf.dc.html`. The floating bar at
the bottom switches persona (guest / reader / teen / student / staff).
`Staff Console.dc.html` freezes the tab when opened — read its source as the
spec instead.

---

## Bugs found and fixed this session (don't reintroduce)

- **`my-library/:id` and `student/:id/stats` had no access check.** Any student
  could read another student's loans and statistics by editing the URL. Both now
  call `requireStudentAccess`. Covered by the audit.
- **`RequestReservation` took `student_id` from the request body**, so a student
  could reserve for someone else, and a caller who omitted it created an orphan
  row with `student_id` 0 that appeared on nobody's screen. Now taken from the
  session; staff may still reserve for a student they are allowed to see.
- **`POST /return/:id` ignored the path parameter** and demanded
  `{book_id, tracking_number}` in the body, so the obvious call 400'd and
  check-in looked broken. Accepts either form now.
- **`BulkUploadBooks` bypassed the catalogue resolver**, so every CSV import
  silently desynced the shared catalogue.
- **Catalogue offered "Reserve" on every book** regardless of state, so the same
  book could be requested repeatedly. Cards now report `my_status`.
- Matching: hyphens are word breaks (`Kitabi-Dədə Qorqud` = `Kitabi Dədə
  Qorqud`); languages normalise to ISO codes (`az` = `Azərbaycan`).

## Traps in this environment

- **Git Bash mangles UTF-8** in inline command arguments. Azerbaijani and
  Turkish strings must go through a file — a `.py` or `.sql` written with the
  Write tool — never inline in `psql -c` or a `curl -d` body.
- **`gofmt -w .` reformats the whole repo**, which is not gofmt-clean. Format
  only the files you touched.
- The Windows console cannot print `ə`; a `UnicodeEncodeError` in a test script
  is a display problem, not a data problem. Use `PYTHONIOENCODING=utf-8`.
- Python buffers stdout when redirected — use `PYTHONUNBUFFERED=1` if you want
  to watch a long script's progress.

---

## State of the data

Demo data is loaded and the app looks alive: 91 shelf items (31 favourited),
31 reviews with 72 helpful votes and 14 replies, 20 private notes, 2 challenges
with 17 participants and 24 quiz attempts, 12 loans, 11 reservations at mixed
stages, 15 diary entries, 8 book requests, 21 books / 21 editions / 41 copies.

Two known data problems, both pre-existing: nearly every ISBN is 12 digits
(truncated — matching handles it, the book form should validate), and the
language filter lists `Azərbaycan` and `Azerbaycan` separately because the
display values differ even though matching now agrees.

---

## Decisions taken, and the ones still open

Agreed: four-level catalogue (Work → Edition → Holding → Copy); tenancy will
generalise to User / Organization / Location / Membership; privacy layers can
only tighten, with minors capped regardless; no DMs in v1.

Assumed, cheap to reverse now and expensive later — **worth confirming**:

- A reader's profile is **global**, so history and followers survive changing
  school.
- Author and publisher are **global facts**; topic, genre and frequency stay
  branch-local shelving decisions.

Open question that blocks the next feature: **the design assumes a `teacher`
role that does not exist.** Today librarians author challenges and would
moderate. Teacher is also where the dərslik (classroom textbook) work belongs.
