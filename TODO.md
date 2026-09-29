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

Last run: 23 Go tests pass, **263 API checks across 5 roles**, 33/33
loan-lifecycle checks pass, build and lint clean.

The audit's count is deterministic — every `add()` in `cmd/apiaudit` is
unconditional, so two runs against different data still agree. If it disagrees
with this number, something changed; it is not drift.

**Where things live.** `library-frontend/src/mrb/` is the new myredbookshelf UI
(`/` landing, `/app/*` reader app). The old role dashboards are still at
`/student`, `/librarian`, `/manager`, `/admin` and still work.

---

## Now

Nothing here is blocking; pick by what the buyer will feel. A suggested order,
with the reasoning:

- [x] **Push.** Done 2026-09-28. Only 2 commits were actually outstanding —
      15 of the "16" had already reached `origin` in the previous session, so
      fetch first before believing a count like this one

- [x] **Notifications.** Done 2026-09-29. One `Notification` table keyed on
      `UserID`, three producers, one bell in each shell. See `HANDOFF.md` for
      the shape and the one decision that drove it

- [x] **End-of-year "return the whole set".** Done 2026-09-29.
      `POST /textbook-movements/bulk` takes every title at once and every row
      is prefilled with a full return, so a teacher corrects only the copies
      that did not come back. 4-A went from eight open-fill-submit cycles to
      one dialog

- [ ] **Drop `Book`'s duplicated columns.** `title`, `isbn`, `language`,
      `cefr_level`, `publication_year`, `edition`, `page_count`, `cover_url`
      are now unread wherever an edition is preloaded — the `AfterFind` hook on
      `Book` makes the Edition win. Deliberately left in place as the fallback
      so a forgotten preload degrades to stale rather than blank. Dropping them
      is mechanical now but one-way, so confirm every path preloads first

- [ ] **`teachers.subject` is decorative.** Free text that looks like a
      permission and constrains nothing. Either link it to `Subject` or drop the
      column

- [ ] **A read-only branch workspace for a manager.** Half done: the rail no
      longer offers them the branch desk, members or library settings, because
      those are `IsLibrarian`-guarded and a school administrator does not run a
      branch's desk. What is left is the deliberate feature — letting a manager
      *look* at a branch's circulation without acting on it. The foundation is
      in: `getUserBranchID` resolves a manager to one branch at a time, from
      `?branch_id=` within their school. What is missing is read access on the
      `IsLibrarian` routes, which is a permissions decision rather than a bug.
      A manager still lands on `/manager`; `homePathFor()` in `src/home.js` is
      the one place that decides

- [ ] **Escalating a student's book request into a ticket.** A librarian
      looking at `Kitab sorğuları` has no way to pass one up to the
      administration except retyping it as a `BOOK_REQUEST` ticket. The two
      models are deliberately separate (student → librarian vs librarian →
      administration), but a "raise this with the school" button on a request
      row would join them

- [ ] **Retire the manager and admin dashboards** once the console grows
      S7–S9. The librarian's is gone: `/librarian` redirects to `/staff`, and
      `LibrarianDashboard`, `BulkUploadModal` and `RegistrationTokensModal` are
      deleted — 1,728 lines. `SettingsPanel` stays, because the console's
      Kitabxana ayarları is built on it. A manager and an admin keep the
      "Köhnə panel" link; a librarian no longer has one

- [ ] **The three screens the teacher role unblocked.** The role itself now
      exists (branch-scoped like a librarian, lands on `/staff/textbooks`), so
      what is left is the design's own teacher screens: the class dashboard,
      the moderation queue, and the "teacher" line under an overdue student.
      Challenges are still authored by librarians

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
- [ ] **Notifications beyond the three kinds that exist.** The table and the
      bell are built; what is not built is a *channel out of the app* (e-mail
      or SMS), a per-user preference for which kinds you want, and automatic
      overdue reminders. The last one was deliberately left out: reminders are
      a librarian's decision today, and a nightly sweep needs a per-day dedupe
      key because this codebase has no scheduler and sweeps lazily on read
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
- [x] **A manager gets notifications where they actually land.** They receive
      `TICKET_REPLY` but `homePathFor()` sends them to `/manager` — the *old*
      dashboard — so the bell in the two new shells was invisible to them until
      they wandered into `/staff`. The old dashboard has the bell now, which
      means instrumenting a screen that is slated for deletion; worth it,
      because the alternative was a notification nobody reads. It goes when the
      dashboard does

## Done

- [x] **Layihələr** (buyer, 2026-09-29) — the rail's last placeholder is a
      real domain. The school's reading projects and campaigns: book drives,
      events, reading campaigns.

      **Deliberately not folded into `Challenge`.** A challenge is a book list
      with quizzes that readers join individually and are scored on. A project
      has a measurable goal rather than a fixed list of titles, a lifecycle
      (planned → active → done/cancelled) because it is planned before it runs
      and reviewed after, **classes** as participants rather than individual
      sign-ups, and a log of what happened. Folding either into the other would
      have meant a model half-empty whichever kind it held.

      **Progress is derived from the log, never stored** — the same rule as the
      textbook ledger, for the same reason. The class-against-class scoreboard
      is a group-by over that log, so standings cannot disagree with the
      entries they are built from. A project that beats its goal reports the
      real number and clamps only the bar.

      Scope follows Challenge's convention rather than a third one: the school
      owns it, `BranchID` narrows it to a branch, nil means school-wide. A
      branch sees its own plus the school's. Guarded by `IsTeacher`, which
      admits the library, the administration **and** teachers — a
      class-against-class campaign is the classes' business — and the nav gives
      those same four roles the domain, so nothing there 403s.

      A project opens in a panel on the list rather than at `/staff/projects/:id`:
      `locate()` derives the screen from the URL, so a `:id` would be a route
      `nav.js` cannot name and the page title would go blank. Tickets already
      work this way.

      A started project is **cancelled, not deleted** — what the school tried
      is worth as much as what it finished. Only one that never began can be
      removed outright.

      **Books and quizzes** (buyer, 2026-09-29, after the first cut shipped
      without them). A project with a reading list *runs as* a `Challenge`:
      attaching the first title creates the challenge behind it, and readers
      see the campaign on their own Müsabiqələr page, join it, log the book and
      answer the quiz. All of that already existed and was tested; giving
      Project its own books, quizzes, sign-ups and standings would have been a
      second implementation of it, and readers would have had two places to
      look. A book drive attaches nothing and so appears to no reader, which is
      right — there is nothing to read.

      Questions are keyed on (challenge, edition), so a title taken off the
      list and put back keeps the questions written for it. Emptying the list
      does **not** delete the challenge: readers may have joined and logged
      progress against it. The answer index stays `json:"-"` all the way
      through, so it never reaches a browser.

      **The word "Hədəf" is the school's own name**, so it is not used as a
      label for anything else. The goal field is `Məqsəd` / `Amaç` / `Goal`,
      written as the sentence it is — a number and the thing it counts, with a
      line underneath saying it back ("Məqsəd: 500 səhifə toplanacaq").

      **A reading project *is* a Müsabiqə.** The kind was called "Oxu
      kampaniyası" while readers call the same object Müsabiqələr; it is
      `Müsabiqə (oxu)` now, because two names for one thing is how a buyer
      ends up asking which is which.

      **The audience and the reading list are set at creation**, not only
      afterwards. `CreateProject` reuses the same `applyAudience` and
      `applyBooks` the later endpoints use, so the two entry points cannot
      check different things, and a create whose audience or books are refused
      deletes the project again rather than leaving it half-made.

      The book picker shows covers and opens on the branch's own shelf rather
      than an empty search box — a librarian recognises a cover long before
      they recall a spelling.

      **Quiz rules, enforced on the server** (buyer, 2026-09-29). A time limit
      per question, a random draw out of a bigger pool, one attempt, and
      readers proposing questions the library approves.

      The draw is **deterministic per reader**, seeded on (challenge, edition,
      user): a fresh shuffle each fetch would let somebody reload until they
      had seen the whole pool, and would change the paper under a reader who
      simply refreshed. `QuizSession` records when the paper went out, which is
      what makes both the clock and the single attempt real rather than
      client-side suggestions.

      Only APPROVED questions are asked. A reader's suggestion is inert until a
      librarian approves it, and approving appends it so the order does not
      shift under readers mid-campaign. The library can correct which answer is
      right before approving — a good question with the wrong answer marked is
      worth keeping.

      Still to do on the reader's side: the screen for **writing** a suggestion.
      The endpoint (`POST /challenges/:id/suggest`) and the whole review queue
      exist and are exercised, but the reader app has no form for it yet, so
      today a suggestion can only arrive through the API.

      **A target group** (buyer, 2026-09-29). `Audience` is one of SCHOOL,
      BRANCHES, CLASSES or SCHOOLS, with a join table behind each of the last
      three. It is a separate field from `BranchID`, because where a project
      *came from* and who it is *for* are different questions — a branch can
      raise a campaign the whole school runs.

      **It changes what readers see.** `ListChallenges` filtered on school
      alone and ignored `BranchID` entirely, so a campaign aimed at one branch
      was shown to the whole school. It now resolves the project behind each
      challenge and checks the reader's branch and class against its audience.
      Verified: with the audience set to 4-A, the 4-A reader sees the campaign
      and a 5-A reader and an unplaced reader do not. Without that fix the
      target group would have been decorative.

      Who may aim where follows the scope each role already runs: a librarian
      at their own branch and its classes, the administration anywhere in the
      school. `?scope=mine` on `/branches` exists so the picker cannot offer a
      branch the endpoint would refuse — the librarian was being shown Gəncə.

      **Partner schools are admin-only and go no further**, because deciding
      that two schools are partners is the alliance work in Phase 3. Until it
      exists there is nothing to check a school administrator's choice
      against, so the endpoint refuses them with `NO_ALLIANCES` and the screen
      says why rather than pretending.

- [x] **Moving the school up a year** (buyer, 2026-09-29). 7-A becomes 8-A and
      the final grade graduates; alumni stay alumni and are never swept up
      again. `GET /academic-years/rollover/preview` and
      `POST /academic-years/rollover`, both administration-only.

      **It creates next year's classrooms rather than renaming this year's.**
      Renaming would be fewer writes and would quietly rewrite history: the
      textbook ledger is keyed on `ClassroomID`, so last year's movements for
      7-A would start reading as 8-A's, and what a class held in a year it no
      longer exists in would be unanswerable. Holdings are derived from that
      ledger precisely so a number cannot drift from its own history.

      Only ACTIVE students in a classroom move. The legacy `Grade` and
      `ClassGroup` fields move with them, because the reader screens still
      print those and letting them go stale is how "7-A" ends up on an
      eighth-grader's profile. Teachers carry across as a starting point —
      easier to remove than to reassign every class from nothing.

      Two steps, because it cannot be undone from a screen: a preview that
      changes nothing and names every class with the textbooks it still owes,
      then a confirm. The server refuses a write with no `confirm`, so an API
      call cannot skip what the screen insists on, and refuses a second run
      into a year that already has classes. One transaction throughout.

      The final grade defaults to **11** and is editable per run — a guess
      about Azerbaijani schooling rather than a fact about every school.

- [x] **Üzvlər: a real search, and a class view** (buyer, 2026-09-29). The
      search now covers name, e-mail, class, status and **the titles a reader
      is holding** — "who has 1984?" is asked across the counter daily and had
      no answer on this screen. Terms are ANDed, so a second word narrows.
      `/class-list` gained `email` and `classroom_label`, filled in two queries
      rather than one per row.

      A Siyahı / Siniflər toggle switches the same readers between one long
      list and a card per class, each card showing its roll, how many books are
      out and how many are late. Opening a card lists the children in it, and
      picking one opens the same reader panel the table uses. Cards are built
      from the *filtered* list, so searching narrows both views rather than
      letting them disagree. Readers with no class get a card of their own — a
      branch's list is not allowed to quietly lose people.

- [x] **End-of-year "return the whole set".** `POST /textbook-movements/bulk`
      collects every title a class still holds in one **atomic** write. Every
      line validates before anything is written and the writes share a
      transaction, because a half-applied collection is worse than none — the
      teacher cannot tell from the screen which half landed.

      Each row is prefilled with a full return, since that is what nearly
      always happened; the teacher corrects only the exceptions. The three
      numbers may add up to *less* than what is outstanding — that is a child
      who was away, and the remainder simply stays out.

      A line that writes a copy off still needs a note naming the child, the
      same rule the single-title dialog enforces: collecting in bulk is not a
      way around the accountability the per-title path insists on. The note
      rides on the LOST and DAMAGED rows **only** — putting it on the RETURN
      as well made the ledger read as though that one child handed back the
      other thirty-eight.

- [x] **Notifications**, and with them the three features that were each
      incomplete for the one missing reason. One `Notification` table keyed on
      `UserID` — which works because all three consumers already address a
      user: `Loan.StudentID` references `Student.UserID`, and
      `TextbookRequest.TeacherID` and `Ticket.AuthorID` are user ids too.

      **The row stores facts, not sentences.** A `kind` and a JSON `params`
      bag; the sentence is built in `src/notifications.js` from the same i18n
      file as everything else. So a reader who switches language sees the
      notification in the new one instead of whatever was frozen at write
      time, and no Azerbaijani ever goes near a Go string literal. Verified by
      switching AZ → EN with a notification on screen and watching the same
      stored row re-render.

      Three producers. A textbook request fires on the *transition* into
      `READY`, not the state, so a librarian editing a desk note afterwards
      does not nudge the teacher twice. A ticket reply hooks
      `appendTicketReply`, the one choke point both reply handlers pass
      through, and fans out to every `Manager` of the school when the branch
      is the one replying — "the administration" is a role, not a person.
      An overdue reminder is the desk's button made real
      (`POST /desk/overdue/remind`), deliberately human rather than a nightly
      sweep, which is also why sending twice is allowed.

      The bell is in both shells' headers and is **not** a nav entry, so
      `staff/nav.js` was not touched. Polling, not sockets: on mount, on
      navigation, and every 60s while the tab is visible.

      `staff.overdue.noNotifications` — the honest "reminders are not possible
      yet" alert — is gone from all three languages, because it stopped being
      true.

- [x] **A `teacher` role**, with the dərslik system it exists for. Scoped like a
      librarian — one branch, one school — admitted to `/staff` by an
      `IsTeacher` guard that also lets the library and the administration
      through, and landing on `/staff/textbooks` rather than the reader app.
      Classrooms and teachers are many-to-many in both directions; a student
      sits in exactly one class and carries ACTIVE / ALUMNI / LEFT, where
      leaving takes the classroom but never the account or the reading history.
      Demo data via `tools/seed_derslik.py`: Sevda takes both classes, Rauf
      takes 4-A, Günel takes 5-A, ten pupils each

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
      | Dərslik sistemi | *built since — see the dərslik entries below* |
      | Layihələr | Layihələr · Yeni layihə *(built 2026-09-29)* |
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
