# Session handoff — 2026-09-29

Read this first, then `TODO.md` for the checklist. `ROADMAP.md` has the
reasoning and a dated log; `PROJECT_BRIEF.md` describes the system for someone
who has never seen it.

---

## The remote

`origin` is `github.com/NijatSadigov/Kutubhane.git`, reachable, and
`backend-dynamic-categories` tracks it. **It is in sync as of 2026-09-29.**

A note on counting, because this file got it wrong once: it claimed 16 commits
were unpushed when only 2 were. The other 14 had already reached `origin` and
the local `origin/...` ref was stale. **`git fetch` before believing a number
like that**, including one written here:

```bash
git fetch origin && git log origin/backend-dynamic-categories..HEAD --oneline
```

Two things found while checking it was safe to push, both still true:

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

Both are also in `.claude/launch.json` now (`school-library-backend` and
`library-frontend`), so a Claude Code session starts them through its own
preview tooling rather than backgrounding a shell.

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

Last run: 23 Go tests, **249 API checks across 5 roles**, build clean,
`src/mrb` + `src/staff` + `src/i18n` lint clean. (`npx eslint src` reports 12
errors, all pre-existing in the manager/admin/student dashboards and shared
components — down from ~20 since the librarian's dashboard was deleted.)

The audit count is deterministic: every `add()` in `cmd/apiaudit` is
unconditional, so it does not drift with the data. This file said 207 when the
suite really ran 213 — the number was simply stale, and two runs against
different data confirmed it. If it disagrees, something changed.

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
| `school-library-system/models/notification.go` | the notification row — facts, never a sentence |
| `school-library-system/handlers/notifications.go` | `notify()`, the bell's two endpoints, and the overdue reminder |
| `library-frontend/src/notifications.js` | what a notification *says* and where it links — one place, both shells |
| `library-frontend/src/components/NotificationBell.jsx` | the bell itself; one implementation, a palette per shell |
| `school-library-system/models/project.go` | Layihələr — projects and their append-only log |
| `school-library-system/handlers/project.go` | projects; progress and standings summed from the log |
| `library-frontend/src/staff/pages/Projects.jsx` | the Layihələr list, its panel, and the new-project form |
| `library-frontend/src/home.js` | one place deciding where each role lands after login |
| `library-frontend/src/i18n/dates.js` | language-aware dates — see the Intl warning below |
| `Hedef Kutuphane clickable prototype (1)/` | **the design**, untracked |

---

## What the 2026-09-29 session did

**Notifications** — the one missing reason three separate features were each
incomplete. One `Notification` table keyed on `UserID`, three producers, a bell
in each shell.

The decision that shaped everything: **the row stores facts, not sentences.**
A `kind` plus a JSON `params` bag; `src/notifications.js` builds the sentence
from the same i18n file as the rest of the app. That buys three things — a
reader who switches language sees the notification in the new one rather than
whatever was frozen at write time, no Azerbaijani goes anywhere near a Go
string literal (see the UTF-8 trap below), and the strings stay in the one file
that already holds them. The cost is that a notification can only say what the
i18n file anticipates, which is fine for three fixed kinds.

| Kind | Fires | Goes to |
|---|---|---|
| `TEXTBOOK_READY` | `UpdateTextbookRequest`, on the **transition** into READY | the teacher who raised it |
| `TICKET_REPLY` | `appendTicketReply` — the one choke point both reply handlers pass through | the *other* side |
| `LOAN_OVERDUE` | `POST /desk/overdue/remind`, the desk's button | the reader |

Three things worth keeping in mind. READY fires on the transition, not the
state, so a librarian editing a desk note afterwards does not nudge the teacher
again. "The administration" is a role rather than a person, so a reply from the
branch fans out to every `Manager` of the school — a platform admin has no
school and is deliberately left out, matching how the ticket queue already
scopes them. And the reminder is a *human* action, not a nightly sweep, which
is why sending twice is allowed and why there is no scheduler.

`GET /notifications` and `POST /notifications/seen` sit on the plain
authenticated group with **no role guard** — that is what lets one endpoint
serve a student, a teacher, a librarian and a manager. Scope is always the
caller's own user id and cannot be widened by a query parameter.

The bell lives in each shell's header and is **not** a nav entry, so
`staff/nav.js` was not touched. It links only to screens that table already
defines. Polling rather than sockets, following the lazy-sweep idiom this
codebase already uses: on mount, on navigation, and every 60s while the tab is
visible.

**End-of-year "return the whole set"** — `POST /textbook-movements/bulk`. Every
title a class still holds on one form, each row prefilled with a full return,
so the teacher corrects only the copies that did not come back. 4-A went from
eight open-fill-submit cycles to one dialog.

It is **atomic**: every line validates before anything is written, and the
writes share a transaction. A half-applied collection is worse than none,
because the teacher cannot tell from the screen which half landed. Verified by
sending a good line and a bad one together and confirming the ledger did not
move.

A line that writes a copy off still needs a note naming the child — bulk is not
a way around what the per-title dialog insists on. The note rides on the LOST
and DAMAGED rows only; putting it on the RETURN as well made the ledger read as
though one child had handed back the other thirty-eight.

**Moving the school up a year** — `academic-years/rollover`, preview and apply.
7-A becomes 8-A, the final grade graduates, alumni stay alumni.

The decision worth knowing: **it creates next year's classrooms rather than
renaming this year's.** The textbook ledger is keyed on `ClassroomID`, so
renaming would make last year's movements for 7-A read as 8-A's and leave "what
did that class hold" unanswerable. A year's classrooms are that year's record.
Tested on a **scratch clone**, never the real database, and the check that
mattered was that `textbook_movements` still pointed at the old classrooms
afterwards.

It cannot be undone from a screen, so it is two steps: a preview that changes
nothing and names every class with the textbooks it still owes, then a confirm.
The server refuses a write without `confirm`, so an API call cannot skip what
the screen insists on, and refuses a second run into a year that already has
classes. The final grade defaults to 11 and is editable — a guess about
Azerbaijani schooling, not a fact about every school.

**Layihələr is a real domain** — the rail's last placeholder. The school's
reading projects and campaigns: book drives, events, reading pushes.

It is **deliberately not** the challenges screen, and the buyer chose that
deliberately when asked. A challenge is a book list with quizzes that readers
join individually; a project has a measurable goal, a lifecycle, classes as
participants and a log of what happened. Progress is summed from that log and
never stored — the textbook-ledger rule again — and the class-against-class
standings are a group-by over it, so they cannot disagree with their own
entries.

The `Challenge` API is still unbuilt on the staff side; the challenge builder
stays on the TODO list and is a separate job from this one.

Two things worth knowing if you touch it. A project opens in a **panel on the
list**, not at `/staff/projects/:id` — `locate()` derives the screen from the
URL, so a `:id` would be a route `nav.js` cannot name and the page title would
go blank; tickets already work this way. And a started project is **cancelled,
not deleted**, because what the school tried is worth as much as what it
finished.

`ComingSoon.jsx` now has **no caller** — Layihələr was the last `soon: true`
domain. The flag still exists in `nav.js` but nothing routes it, so a future
placeholder domain needs its route putting back.

**Üzvlər gained a real search and a class view** — the search now reaches
e-mail, class and the titles a reader is holding, and a Siyahı / Siniflər
toggle shows the same readers as a card per class that opens to its roll.

### Three bugs this turned up, all the shapes this file warns about

- **The manager's notification called a ticket theirs.** One i18n key serves
  both ends of the thread, and it read "Müraciət**inizə** yeni cavab" — *your*
  ticket. For the librarian who raised it that is right; for the administration
  answering their queue it is wrong. It is neutral now ("Müraciətə"). Invisible
  from the code, and it looked perfectly correct until I logged in as the other
  side.
- **The staff top bar wraps at 1024px** and puts the role chip on a second row.
  I nearly took the blame for it — hiding the bell with `display:none` and
  re-measuring showed the height was identical either way. **Pre-existing, not
  the bell.** Worth checking that way before "fixing" a layout.
- **A librarian saw every branch's classrooms, not their own.** `GetClassrooms`
  filtered by school only, while `Sinif dərslikləri` says outright that "the
  library sees the branch's". Invisible in demo data because Gəncə has no
  classes — which is exactly what Gəncə is the fixture for. A librarian is
  branch-scoped now; the administration keeps the school-wide view.
- **The bulk collection wrote the write-off note onto the plain RETURN row**,
  so the ledger read as though one child had returned the other thirty-eight.
  Only visible by reading the rows back out of the database after a successful
  submit — the screen looked right, because the totals were right.

A fourth thing, not a bug but the same lesson: **a manager receives
notifications but lands on `/manager`**, the old dashboard, which had no bell.
Built, but not wired up where the person actually is — exactly lesson 2 below.
The old dashboard has the bell now; it goes when that screen does.

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
  only the files you touched. As of 2026-09-29 exactly **two** files are
  non-gofmt — `handlers/admin.go` and `handlers/regtoken.go` — not the four
  this file used to claim. `gofmt -l .` is the check; it should print those two
  and nothing else.
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
