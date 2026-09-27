# Session handoff — 2026-09-27

Read this first, then `TODO.md` for the checklist. `ROADMAP.md` has the
reasoning and a dated log; `PROJECT_BRIEF.md` describes the system for someone
who has never seen it.

---

## ⚠️ Nothing is committed

Three sessions of work sit in the working tree, unpushed and **uncommitted**,
on branch `backend-dynamic-categories`. There is no remote. Commit before
doing anything else:

```bash
git add -A && git commit -m "Design-fidelity pass, guest site, librarian console, cleanup"
```

Nine files are new and untracked — `git add -A` catches them, `git commit -a`
does not:

```
src/home.js                      src/i18n/dates.js
src/mrb/PublicShell.jsx          src/mrb/components/SiteHeader.jsx
src/mrb/guest.js                 src/mrb/responsive.css
src/mrb/useSchoolLabel.js        src/staff/pages/InventoryDialogs.jsx
src/staff/pages/Members.jsx
```

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

**Logins**, all password `Test1234`: `admin@school.com`, `mgr@hadaf.com`,
`fatma@lib.com` (librarian, Nesimi), `nicat@stu.com` + 9 more students.

## How to check nothing is broken

```bash
cd school-library-system && go test ./... && go run ./cmd/apiaudit -writes
```

```bash
cd library-frontend && npm run build && npx eslint src/mrb src/staff src/i18n
```

Last run: 23 Go tests, **148 API checks**, build clean, `src/mrb` + `src/staff`
+ `src/i18n` lint clean. (`npx eslint src` still reports ~20 errors, all
pre-existing in the old dashboards and shared components.)

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
| `library-frontend/src/staff/` | staff console — `/staff/*`, **where librarians now land** |
| `library-frontend/src/pages/` | the **old** dashboards, still live at `/librarian`, `/manager`, `/admin`, `/student` |
| `library-frontend/src/home.js` | one place deciding where each role lands after login |
| `library-frontend/src/i18n/dates.js` | language-aware dates — see the Intl warning below |
| `Hedef Kutuphane clickable prototype (1)/` | **the design**, untracked |

---

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
