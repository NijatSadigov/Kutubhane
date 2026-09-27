# TODO — Hədəf Kütüphanə / myredbookshelf

The working checklist. Tick things off here; `ROADMAP.md` carries the reasoning
and the log, `PROJECT_BRIEF.md` describes the system for a newcomer.

**If you are picking this up cold, read "Start here" and nothing else first.**

---

## Start here

```bash
cd school-library-system && go run .      # backend  :8000
cd library-frontend && npm run dev        # frontend :5180
```

Postgres must be running (db `school_library`, user `postgres`). Logins are all
password `Test1234`: `admin@school.com`, `mgr@hadaf.com`, `fatma@lib.com`
(librarian), `nicat@stu.com` (student).

Health checks, both should pass:

```bash
cd school-library-system && go test ./... && go run ./cmd/apiaudit -writes
```

Deeper suites live in the session scratchpad and run against a **scratch
database**, never the real one — clone it, start a second server on 8001
(`DATABASE_DSN=...dbname=school_library_loantest PORT=8001 go run .`), then run
`test_loan_lifecycle.py`. `populate_demo.py` fills a database with lifelike
demo activity and takes `BASE` to choose which server.

```bash
cd library-frontend && npm run build && npx eslint src/mrb src/staff
```

Last run: 23 Go tests pass, **148 API checks pass**, 33/33 loan-lifecycle
checks pass, build and lint clean.

**Where things live.** `library-frontend/src/mrb/` is the new myredbookshelf UI
(`/` landing, `/app/*` reader app). The old role dashboards are still at
`/student`, `/librarian`, `/manager`, `/admin` and still work.

---

## Now

- [ ] **Restructure the staff console navigation into two levels** (buyer,
      2026-09-27). The left rail becomes *domains*, the top bar becomes the
      screens inside the domain the rail has selected. Today the console is one
      flat list of six items in the rail and nothing on top.

      Left rail:

      | Section | State |
      |---|---|
      | Kitabxana | built — needs its top bar |
      | Dərslik sistemi | **coming soon** placeholder |
      | Layihələr | **coming soon** placeholder |
      | Üzvlər | built |
      | Kitabxana ayarları | built (the current Settings) |
      | Dərslik sistemi ayarları | **coming soon** placeholder |
      | Texniki dəstək | **new feature** — see below |

      Top bar for **Kitabxana**: `Kitabxana` · `Rezerv edilən kitablar` ·
      `Verilən kitablar` · `Kitab sorğuları`. Every other section gets its own
      top bar on the same principle.

      Mapping onto what exists: the circulation desk is *Kitabxana*; Holds &
      overdue splits into *Rezerv edilən kitablar* and *Verilən kitablar* (it
      already has those as internal tabs, plus the overdue list); Requests is
      *Kitab sorğuları*. Catalogue & inventory needs a home in the Kitabxana
      top bar too. Nothing should be lost in the move.

- [ ] **Texniki dəstək — a ticketing system.** A librarian raises a ticket with
      the school admin: ask for a book to be added to the system, report a
      problem, anything else needing the admin. Needs a `Ticket` model
      (author, school/branch, subject, body, status, thread of replies), staff
      endpoints, a librarian view and an admin queue. None of this exists yet —
      design it before building.

- [ ] **Wire the borrow-limit policy UI.** `GET/PUT /branch-settings` and
      `GET/PUT /loan-limit` exist and are tested but nothing calls them — the
      branch-wide default has no screen. The per-student override is already on
      the Members panel. Until this lands, do not "clean up" those endpoints:
      they are unwired, not dead

- [ ] **Retire the old dashboards.** Librarians now land on `/staff`, with a
      "Classic dashboard" link in the sidebar as a fallback. Watch whether
      anyone reaches for it; when they stop, delete `pages/librarian/`
      (keeping `SettingsPanel`, which the console uses) and the dead
      `pages/Login.jsx`. Managers and admins still need `/manager` and
      `/admin` until the console grows S7–S9

- [ ] **A `teacher` role.** The design assumes one and three screens are blocked
      on it: the class dashboard, the moderation queue, and the "teacher" line
      under an overdue student. Today librarians author challenges and would
      moderate. It is also where the dərslik work belongs

- [ ] **Staff Console — teacher and admin sections** (the librarian side is done
      and live at `/staff`)
  - [ ] Teacher — Class dashboard: class switch, KPIs, 8-week chart, roster with
        streak/challenge flags, student side panel
  - [ ] Teacher — Challenge builder UI (the API already exists:
        `POST /challenges`, `/challenges/:id/questions`)
  - [ ] Teacher — Moderation queue (the `ReviewReport` model already exists;
        needs the staff endpoints and the Keep / Tag / Hide / Hide-and-warn actions)
  - [ ] Admin — Analytics: KPIs, weekly active, pages by branch and grade,
        genre mix, most borrowed
  - [ ] Admin — Branches & users: role tabs, search, suspend, invite, CSV import
  - [ ] Admin — Alliances & data sharing (blocked on Phase 3 tenancy)
  - [ ] A `teacher` role — the design assumes one; today librarians author
        challenges and would moderate

## Next

- [ ] **Staff Console** — the librarian/teacher/admin redesign, 9 sub-screens.
      Build at `/staff` alongside the current dashboards so nothing regresses.
  - [ ] Shell: 236px `#082F49` sidebar, role chip, `#F1F5F9` canvas, 44px rows
  - [ ] Librarian — Circulation desk: check out, check in, today's log, KPIs
  - [ ] Librarian — Holds & overdue: hold queue, bulk remind, mark lost
  - [ ] Librarian — Catalogue & inventory: availability bars, expandable copies, add title
  - [ ] Teacher — Class dashboard: class switch, KPIs, 8-week chart, roster
  - [ ] Teacher — Challenge builder (backend already exists)
  - [ ] Teacher — Moderation queue (needs review reports)
  - [ ] Admin — Analytics: KPIs, pages by branch and grade, genre mix
  - [ ] Admin — Branches & users: role tabs, suspend, invite, CSV import
  - [ ] Admin — Alliances & data sharing (needs Phase 3 tenancy)
- [ ] **Carry the parity gaps into the Staff Console** (see the table in `ROADMAP.md`)
  - [x] Settings: dynamic categories and statuses CRUD — carried into
        `/staff/settings`
  - [x] Book-request queue for staff — carried into `/staff/requests`
  - [x] Pickup deadlines visible in the holds queue
  - [x] CSV bulk upload of books — on Catalogue & inventory
  - [x] E-book upload and "open e-book" — on the title's edit dialog
  - [x] Branch student invite links — on Members
  - [ ] Manager tier: librarian tracking + read-only branch workspace
  - [x] Loan editing — the "All loans" tab on Holds & overdue
  - [x] Borrow-limit settings UI — per student, on the Members side panel.
        The branch-wide default still has no UI
  - [ ] Platform admin above the school admin
- [ ] **Public screens**: Join stepper with parent consent, Book clubs,
      Libraries & bookstores, Reader home
- [ ] Replace the old dashboards and delete them once covered

## Later

- [ ] **Phase 3 — identity & tenancy**: `Organization` (typed), `Location`,
      `Membership`; retire `User.Role`; org switcher; `Holding.mode`
      (LENDING/RETAIL/REFERENCE) so bookstores work; cross-org availability;
      reader self-signup with no school
- [ ] **Personas & masking**: guest / reader / teen / student; initials outside
      your own school; under-16 protections; no DMs
- [ ] **Battles & alliances**: head-to-head, per-field sharing toggles, audit log
- [ ] **Book clubs**: club, membership, threads, posts
- [ ] **Notifications**: nothing exists today
- [ ] **Dərslik** (classroom textbooks): `Class`, `Subject`, `AcademicYear`,
      bulk issue at year start, bulk return at year end, mid-year joiners and
      leavers, damaged and lost, kept out of the borrow limit
- [ ] Catalogue 1.6–1.8: external ids, duplicate merge tool, move read paths
      onto Edition, drop the duplicated columns from `Book`

## Known issues

- [ ] **Azerbaijani month and weekday names are hand-tabulated** in
      `src/i18n/dates.js` because Chrome's `Intl` reports `az` as supported and
      then formats it "M09 27, Sun". Revisit if that ever gets fixed upstream
- [ ] **No title has a synopsis.** The book page renders one when present and
      omits the paragraph otherwise; nothing writes `Work.Description`, so the
      book form needs the field
- [ ] There is no real **waitlist**. When every copy is out, the catalogue now
      offers only "add to my shelf" — a queue you can join is a separate feature


- [ ] Almost every ISBN in the database is 12 digits — truncated. Matching
      handles it; the book form should validate on entry
- [ ] The language filter lists `Azərbaycan` and `Azerbaycan` separately
      (display values differ, matching is correct). Group by normalized code
- [ ] Three book covers are generated placeholders
- [ ] Azerbaijani strings are AI-translated, never reviewed by a native speaker
- [ ] `Staff Console.dc.html` freezes when opened as a prototype — read the
      source as the spec
- [ ] Nothing pushed to a remote; single machine, no backup

## Done

- [x] **Design-fidelity pass finished on every screen that had one.** Catalogue,
      Book detail, My Shelf, Challenges, Landing, the staff shell and the three
      librarian screens are now transcribed from the prototype's markup, the way
      Discover was — literal sizes, colours and spacing, then checked with
      `getComputedStyle` against the source instead of by eye. The method:
      open that screen's block in `myredbookshelf.dc.html` (or
      `Staff Console.dc.html` / `Staff Design System.dc.html`) and copy the
      values out; never work from the README's prose.

      Backend the pass needed: `scope=shelf` implemented (it was still 501 from
      before `ShelfItem` existed), a real `borrow_count` and a `rating` sort so
      the four-item sort menu means something, `synopsis` and `my_loan_id` on
      the browse card, reviews actually sorted by helpful votes, the challenge
      review step un-stubbed, `/shelf/summary` extended with the banner's
      second lines and the genre mix, a new `ReadingGoal` model with
      `GET/PUT /shelf/goal`, `GET /public/challenge` for the landing page, a
      same-weekday-last-week comparison on the desk summary, and a condition
      recorded on check-in. API audit is 137 checks.

      Three designed elements are **not** faked and say so on screen: the
      landing page's public review strip (the privacy rule keeps student and
      teen reviews for members — which is what the design's own caption says),
      book clubs, and overdue reminders. The parity table in `ROADMAP.md` lists
      every designed element still waiting on data.

- [x] **Discover rebuilt to match the design.** Was missing entirely: the
      Bookworm card's favourite recent read with its tilted cover, the Top
      Reviewer quote and stat row, the league's **Our branches / Alliance
      schools** scope toggle, the lead sentence, the challenges link, and the
      **"Your contribution"** footer. Trending had no ratings, log counts or
      rank badges; the activity feed was a placeholder rather than the
      44/1fr/76 post card with spoiler block, likes, replies and report.
      Typography and colour were approximate throughout. New backend to support
      it: league `scope=schools`, `my_pages`, `branch_count`; ratings,
      availability and hold state on trending; the bookworm's favourite read
- [x] **Demo data.** 90 shelf items, 30 favourites, 20 private notes, 30 reviews,
      72 helpful votes, 14 replies, reading diaries, reservations at mixed
      stages, 4 book requests and a second challenge with quizzes. Re-runnable:
      `populate_demo.py` (takes `BASE`)

- [x] **Whole borrowing lifecycle audited end to end** — 33 checks over
      request → approve → collect → log pages → return, plus cancelling,
      two students competing for one copy, the borrow limit, direct desk loans,
      and that students cannot drive the desk. Copy status is asserted at every
      step. **Found and fixed a broken check-in**: the route is
      `POST /return/:id` but the handler ignored the path parameter and demanded
      `{book_id, tracking_number}` in the body, so the obvious call 400'd — the
      new staff console's Check In was hitting exactly that. It now accepts
      either form
- [x] **Shelf semantics split.** "On my shelf" (`OWNED`) means the reader has
      the book; "want to read" is its own list; **favourite is an independent
      flag**, not a status, so a book can be owned *and* starred. Catalogue
      cards gained a star button; My Shelf gained Books-I-have and Favourites
      tabs
- [x] **`PORT` is configurable** so a second server can run against a scratch
      database without fighting the real one for :8000

- [x] **Borrowing actions reflect reality.** A card offers at most two things:
      "add to my shelf" always, and "request loan" only when the reader's own
      library has a free copy *and* they are not already holding the book.
      Otherwise it states where they stand — requested, held for you, or you
      have it with its due date — instead of a reserve button the backend would
      reject. `/catalog/browse` now returns `my_status`, `my_due_date`,
      `my_pickup_deadline` and `shelf_status` per card, and the book page uses
      the same rule so the two screens cannot disagree

- [x] **Staff Console — librarian side**, at `/staff`, alongside the old
      dashboards. Deep-blue shell with role chip and live nav badges;
      Circulation desk (check out with a live holds/limit readout, check in by
      barcode or name, today's counter log, KPI strip); Holds & overdue
      (approve → stamps the pickup deadline, mark collected, cancel; overdue
      with amber→orange→coral severity and bulk select); Catalogue & inventory
      (availability bars, expandable copies, add-a-title that searches the
      shared catalogue first). Requests and Settings carried over intact

- [x] **Reviews & ratings** — `Review`, `ReviewVote`, `ReviewReply`,
      `ReviewReport`; list/create/edit/delete, helpful votes, threaded replies
      with a Moderator badge, reporting; aggregate + 5→1 histogram; half-star
      composer with spoiler tag; ratings on catalogue cards; Discover's Top
      Reviewer and activity feed; reviewing a challenge book ticks its step
- [x] **Booking in the new UI** — `GET /my-reservations`,
      `DELETE /reservation/:id`; My Shelf gained Reservations (with pickup
      deadline and withdraw) and Requests (ask for a title, see your own)
- [x] **Account menu** — avatar dropdown with profile, staff console, log out;
      edit-profile dialog for name, email and password
- [x] **Login and registration** rebuilt in the design's language, with the
      invite-code step for students

- [x] Global catalog: Work / Edition / Holding / Copy, with a shared matcher
      used by the backfill, the book form and CSV import
- [x] Migration backfilled and applied; 23 unit + integration tests
- [x] Security: `my-library` and `student/:id/stats` were readable by any
      student — now guarded, and covered by the audit
- [x] `cmd/apiaudit` — 130 checks across all roles, including write refusals
- [x] Landing page at `/` (guest) and Discover (signed in)
- [x] Catalogue + Book detail
- [x] My Shelf — banner, badges, currently reading, diary, want-to-read, notes
- [x] Challenges — cards, per-book steps, quiz modal, standings, authoring API
