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

Last run: 23 Go tests pass, **162 API checks pass**, 33/33 loan-lifecycle
checks pass, build and lint clean.

**Where things live.** `library-frontend/src/mrb/` is the new myredbookshelf UI
(`/` landing, `/app/*` reader app). The old role dashboards are still at
`/student`, `/librarian`, `/manager`, `/admin` and still work.

---

## Now

- [ ] **The manager tier inside the console.** Now that a manager reaches
      `/staff` for the ticket inbox, the gap shows: the rail still lists
      Kitabxana, Üzvlər and Kitabxana ayarları for them, and every screen in
      those is branch-scoped, so `/desk/summary` answers a manager
      403 *Librarians Only* and the desk draws em-dashes instead of numbers.
      It degrades rather than crashes, and it predates the two-level nav — the
      old flat rail listed the same six items for a manager. Decide whether a
      manager gets a read-only branch workspace (the parity item below) or
      whether those domains are scoped to `librarian` in `staff/nav.js`.
      A manager still lands on `/manager`; `homePathFor()` in `src/home.js` is
      the one place that decides

- [ ] **Escalating a student's book request into a ticket.** A librarian
      looking at `Kitab sorğuları` has no way to pass one up to the
      administration except retyping it as a `BOOK_REQUEST` ticket. The two
      models are deliberately separate (student → librarian vs librarian →
      administration), but a "raise this with the school" button on a request
      row would join them

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
  - [x] Loan editing — the "Hamısı" filter on Verilən kitablar
  - [x] Borrow-limit settings UI — per student on the Members side panel, and
        the branch-wide default on Kitabxana ayarları → Borc qaydaları
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

- [x] **The staff console is two levels** (buyer, 2026-09-27). The left rail is
      *domains*, the top bar is the screens inside the selected one.
      `staff/nav.js` is the single table the rail, the top bar, the routes and
      the page title are all built from, so they cannot disagree the way the
      flat list let them. Paths are `/staff/<domain>/<screen>`; every old flat
      path redirects to its new home, query string included, so a bookmark on
      `/staff/holds` still lands on the hold queue.

      | Rail | Top bar |
      |---|---|
      | Kitabxana | Kitab verilişi · Kataloq və inventar · Rezerv edilən kitablar · Verilən kitablar · Kitab sorğuları |
      | Dərslik sistemi | *tezliklə* |
      | Layihələr | *tezliklə* |
      | Üzvlər | Üzvlər · Dəvət linkləri |
      | Kitabxana ayarları | Kataloq siyahıları · Status və vəziyyətlər · Borc qaydaları |
      | Dərslik sistemi ayarları | *tezliklə* |
      | Texniki dəstək | Müraciətlərim · Yeni müraciət — or Gələn müraciətlər for the administration |

      Nothing was lost in the move. Holds & overdue split: its `holds` tab is
      now *Rezerv edilən kitablar*, and its `overdue` and `loans` tabs merged
      into *Verilən kitablar* with the tab control demoted to a Hamısı /
      Gecikmiş filter — an overdue book is a book that was given out. The
      invite-links modal became the Üzvlər domain's second screen. The nine
      settings tables split where their meaning splits: the vocabulary a title
      is catalogued with on one screen, the lifecycle a copy and its loans move
      through on the other. The placeholders are clickable and say what will
      live there and what it waits on, rather than being greyed out.

      The second level is drawn with the one pattern the design already owns for
      screens-within-a-screen — S2's outlined tab buttons, 8px radius, 8px 14px,
      13px/700, #082F49 when active — because the design's own console is a flat
      nine-screen list with no top bar. Verified against the live page with
      `getComputedStyle`, not the markup.

- [x] **Texniki dəstək — the librarian → administration ticket channel.**
      `Ticket` + `TicketReply`, shaped after `BookRequest` (branch-scoped
      author, school-scoped queue, scope from the caller's profile and never the
      request body). Three kinds — ask for a book to be added, report a problem,
      anything else. A thread with a reply endpoint on each side, a denormalised
      reply count so the list needs no join per row, and one `SeenAt` stamp per
      side driving the nav badge rather than a per-user read table. A manager is
      the school administrator and sees their own school; a platform admin has
      no school and sees every one. Answering an untouched ticket moves it to
      IN_PROGRESS; the branch can withdraw its own; a closed ticket takes no
      more replies. `desk/summary` gained `tickets_unread`. API audit is **162
      checks**

- [x] **The branch-wide borrow policy has a screen** — `Kitabxana ayarları →
      Borc qaydaları`, wiring `GET/PUT /branch-settings`, which had been tested
      but unwired since the borrow-limit work. Both the default limit and the
      pickup window, with the form refusing the values the endpoint would
      silently clamp. The per-student override stays on the Members panel

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
