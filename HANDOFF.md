# Session handoff — 2026-09-28

Read this first, then `TODO.md` for the checklist. `ROADMAP.md` has the
reasoning and a dated log; `PROJECT_BRIEF.md` describes the system for someone
who has never seen it.

---

## ⚠️ Committed but unpushed — do this first

The working tree is clean and there **is** a remote, contrary to what this file
used to say: `origin` is `github.com/NijatSadigov/Kutubhane.git`, reachable,
and `backend-dynamic-categories` already tracks it. It is simply **16 commits
behind**:

```bash
git push origin backend-dynamic-categories
```

Two things found while checking it was safe to push:

- **The repository is public** (`"visibility": "public"`). Worth a conscious
  decision for a product being sold.
- **The Postgres password `2334` is already in the public history** —
  `config/config.go`, `.env.example`, `catalog/resolve_test.go` and this file.
  Pushing adds no new exposure, which is why it was judged safe. It is a
  localhost dev password so the practical risk is low, but rotate it if it is
  used anywhere else, and note that deleting it from the current files does not
  remove it from history.

New files still need `git add -A`; `git commit -a` does not catch them.

Database backups are at `../db-backups/`.

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

**Logins**, all password `Test1234`:

| Who | Email |
|---|---|
| Platform admin | `admin@school.com` |
| School admin (manager) | `mgr@hadaf.com` |
| Librarian, Nəsimi | `fatma@lib.com` |
| Teacher, **takes 4-A and 5-A** | `sevda@teach.com` |
| Teacher, takes 4-A | `rauf@teach.com` |
| Teacher, takes 5-A | `gunel@teach.com` |
| Reader | `nicat@stu.com` + 9 more |
| 4-A pupils | `s41@stu.com` … `s410@stu.com` |
| 5-A pupils | `s51@stu.com` … `s510@stu.com` |

Two branches exist: **Nəsimi** (id 1, everything is here) and **Gəncə** (id 2,
empty — the useful fixture for multi-branch bugs).

## How to check nothing is broken

```bash
cd school-library-system && go test ./... && go run ./cmd/apiaudit -writes
```

```bash
cd library-frontend && npm run build && npx eslint src/mrb src/staff src/i18n
```

Last run: 23 Go tests, **207 API checks across 5 roles**, build clean,
`src/mrb` + `src/staff` + `src/i18n` lint clean. (`npx eslint src` reports 12
errors, all pre-existing in the manager/admin/student dashboards and shared
components — down from ~20 since the librarian's dashboard was deleted.)

Three further suites live in the session scratchpad rather than the repo, and
are worth recreating if you touch what they cover: the dərslik cycle end to end
(37 checks), whether the shared catalogue is authoritative for a holding's title
(7), and the reader-chosen pickup/loan windows (14).

The deeper suites need a **scratch database** — never run them against
`school_library`:

```bash
psql -U postgres -c "CREATE DATABASE school_library_loantest"
pg_dump -U postgres school_library | psql -U postgres -d school_library_loantest
DATABASE_DSN="host=localhost user=postgres password=2334 dbname=school_library_loantest port=5432 sslmode=disable" PORT=8001 go run .
python tools/test_loan_lifecycle.py    # 33 checks, hits :8001
```

**To drive the UI against that scratch server** instead of the real database,
put `VITE_API_ORIGIN=http://localhost:8001` in `library-frontend/.env.local`
and restart Vite. Delete the file afterwards. This is how the whole loan flow
was exercised without touching real data.

---

## Where the code is

| Path | What |
|---|---|
| `library-frontend/src/mrb/` | myredbookshelf reader app — `/` landing, `/catalogue` + `/book/:id` for guests, `/app/*` for members |
| `library-frontend/src/staff/` | staff console — `/staff/<domain>/<screen>`, **where librarians now land**. `staff/nav.js` is the one table the rail, top bar, routes and titles are built from |
| `library-frontend/src/pages/` | the **old** dashboards, still live at `/manager`, `/admin`, `/student`. The librarian's is **deleted**; `/librarian` redirects to `/staff`. `pages/librarian/SettingsPanel.jsx` stays — the console is built on it |
| `library-frontend/src/staff/nav.js` | the one table the rail, the top bar, the routes and the page titles are all built from. Change navigation here, nowhere else |
| `school-library-system/models/derslik.go` | teachers, classrooms, subjects, academic years, textbooks and the movement ledger |
| `school-library-system/handlers/school.go` | the school's structure: years, subjects, classrooms, teachers, the lean student list |
| `school-library-system/handlers/derslik.go` | the textbook catalogue, the request cycle, what a class holds |
| `tools/seed_derslik.py` | re-runnable demo data for the dərslik system |
| `library-frontend/src/home.js` | one place deciding where each role lands after login |
| `library-frontend/src/i18n/dates.js` | language-aware dates — see the Intl warning below |
| `Hedef Kutuphane clickable prototype (1)/` | **the design**, untracked |

---

## What the 2026-09-28 session did

Sixteen commits, `da2b8f1` … `5d5ac1a`. The two features asked for, then a
list of fixes that came out of testing them.

**The staff console is two levels.** Left rail = domains, top bar = the screens
inside the selected one, at `/staff/<domain>/<screen>`. `staff/nav.js` is the
single table all four of rail, top bar, routes and page title are built from,
and `/staff` asks it which domain a role can reach first. A screen the rail
hides is not rendered either. Every old flat path redirects, query string
included.

**Texniki dəstək** — the librarian → school-administration ticket channel, with
a thread, one `SeenAt` per side driving the nav badge, and a manager seeing
their own school while a platform admin sees every one.

**The dərslik system** — the teacher role the design always assumed, plus
classrooms, subjects, academic years, textbooks and a movement ledger.
Accountability is per classroom by quantity, with the teacher naming a student
in the note; recording a loss refuses to save without one. What a class holds
is derived from the ledger, never stored, so a number cannot drift from its own
history.

**Genre and topic moved to the Work**, global like the author, because
branch-scoped lists meant Nəsimi's "Roman" and Gəncə's were rows no query could
join.

**Reader-chosen windows** — a reader says when they will collect and how long
they need it, both capped by branch policy; the desk can override on approval,
and handing over opens a loan-details step prefilled with what the reader asked.

### Bugs this turned up, all found by using the thing rather than reading it

Worth knowing because the same shapes will recur:

- The **book-request queue was empty while its badge counted four** — the
  shared component needs `listUrl`/`updateBase` props the console never passed,
  and the failure was swallowed into the same empty state as "nothing here".
- An **approved hold with no pickup deadline could never expire**, so two
  copies were pinned since July. The sweep filtered on `deadline IS NOT NULL`.
- **`available_copies` counted copies somebody was already queued for**, so a
  card offered "reserve" and the endpoint answered `NO_COPY`.
- **The desk would hand away a copy held for another student** — `CreateLoan`
  checked everything except whose hold it was.
- **A lost textbook came back to the shelf**, because the write-off was counted
  as a return.
- **`getUserBranchID` knew librarians and students but not teachers**, so every
  dərslik endpoint answered a teacher 403 — and not managers either, so the nav
  offered them screens that 403'd.
- **`AddBook` validated nothing.** An empty body was a 200 and created an
  untitled `Work` with match key `"|"` in the catalogue every school shares —
  and because matching is by key, every later untitled submission collapsed onto
  that one row. A unit test asserted this was fine, commented "degenerate but
  must still be handled"; it was codifying the hole.
- **Silently dropped form fields**: the new title form collected an author and
  publisher `AddBook` had no field for. Twice more, a label read `FLD.YEAR`
  because `t('fld.year')` does not exist.

The pattern: nothing above was visible from reading the code, and several looked
identical to correct behaviour on screen. An empty list looks like an empty
list.

## The two lessons that cost the most time

**1. Build screens from the prototype, and check the running page — not the
markup, and never the README's prose.**

Serve the design and open it:

```bash
cd "Hedef Kutuphane clickable prototype (1)/design_handoff_myredbookshelf" && python -m http.server 8899
```

Then `http://127.0.0.1:8899/myredbookshelf.dc.html`, and use the floating bar
at the bottom to switch persona (guest / reader / teen / student / staff).
`Staff Console.dc.html` freezes the tab — read its source as the spec, with
`Staff Design System.dc.html` for tokens.

Reading the markup alone produced a landing page that looked wrong for a reason
only visible when running it: **the design uses one header for guests and
members**, and mine had a second, search-less one. After building a screen,
read the values back out of the live page with `getComputedStyle` and compare;
eyeballing a screenshot hides 2px and one-shade-off errors.

**2. "Is it built?" and "is it wired up?" are different questions.**

The librarian console was finished for two sessions and the buyer never saw it:
signing in as a librarian went to `/librarian`, the *old* dashboard. Four places
decided where a user lands and disagreed — and one of them, `pages/Login.jsx`,
was dead code I edited first while nothing changed. They all defer to
`homePathFor()` in `src/home.js` now. **Test the path a real user walks: log in
and look.**

---

## Traps in this environment

- **Git Bash mangles UTF-8** in inline arguments. Azerbaijani and Turkish
  strings must go through a file written with the Write tool — never inline in
  `psql -c` or a `curl -d` body. `psql -f file.sql` with `PGCLIENTENCODING=UTF8`
  works. Bash heredocs containing them are unreliable too; put the script in a
  file and run it.
- **`Intl` lies about Azerbaijani.** Chrome reports `az` as supported and then
  formats it `"M09 27, Sun"`. Month and weekday names are tabulated by hand in
  `src/i18n/dates.js`. Do not "simplify" that file back to `Intl`.
- **`gofmt -w .` reformats the whole repo**, which is not gofmt-clean. Format
  only the files you touched.
- The Windows console cannot print `ə`; use `PYTHONIOENCODING=utf-8`.
- The browser pane's screenshots often fail with a render timeout and its
  console buffer keeps **stale** errors with old `?t=` timestamps. Prefer
  `get_page_text`, `read_page` and `javascript_tool`; check the network list for
  real failures rather than trusting the console.
- `psql` is not on PATH: `export PATH="$PATH:/c/Program Files/PostgreSQL/18/bin"`.

---

## State of the data

Demo data is loaded: 21 books / 41 copies, 12 loans, 11 reservations at mixed
stages, 31 reviews, 2 challenges with 17 participants, badges, diaries, notes.

Two things were written during testing and are fine to keep or clear: student
`nicat@stu.com` has a 2026 reading goal of 40 books, and a demo `bio` on their
profile so the banner shows its fourth row.

Known data problems, both pre-existing: nearly every ISBN is 12 digits
(truncated — matching handles it, the book form should validate), and the
language filter lists `Azərbaycan` and `Azerbaycan` separately.

---

## Open questions for the buyer

- A reader's profile is **global** (history survives changing school). Assumed.
- Author and publisher are **global facts**; genre and topic stay branch-local.
  Assumed.
- **There is still no `teacher` role.** It blocks the class dashboard, the
  moderation queue and the "teacher" line on overdue rows, and it is where the
  dərslik work belongs.
- Confirmed 2026-09-27: **school students only, no individual sign-ups.**
  Guests may browse the catalogue and read reviews with author names reduced to
  initials.
