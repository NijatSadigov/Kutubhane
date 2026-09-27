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
cd library-frontend && npm run build && npx eslint src/mrb
```

**Where things live.** `library-frontend/src/mrb/` is the new myredbookshelf UI
(`/` landing, `/app/*` reader app). The old role dashboards are still at
`/student`, `/librarian`, `/manager`, `/admin` and still work.

---

## Now

- [ ] **Design fidelity pass on every remaining screen.** The first build was
      "something like the design" rather than the design. Discover has now been
      rebuilt from the prototype markup — exact sizes, colours, spacing and the
      sections that were missing entirely. The same pass is still owed on:
  - [ ] Catalogue — scope switch, filter panel and card metrics against the source
  - [ ] Book detail — 52px specs table, action bar, review feed spacing
  - [ ] My Shelf — banner, badge medallions, tab pills, loan cards
  - [ ] Challenges — card layout, step pills, quiz modal, frontrunners
  - [ ] Landing — hero proportions, section rhythm, footer
  - [ ] Staff console — against `Staff Design System.dc.html`
  **Method that worked:** read the markup out of `myredbookshelf.dc.html` for
  that screen and transcribe the literal values, rather than working from the
  README summary.

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
  - [ ] CSV bulk upload of books
  - [ ] E-book upload and "open e-book"
  - [ ] Branch student invite links
  - [ ] Manager tier: librarian tracking + read-only branch workspace
  - [ ] Loan editing
  - [ ] Borrow-limit settings UI (missing in the old app too)
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
