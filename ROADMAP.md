# Hədəf Kütüphanə — Working Roadmap

The living plan. Updated as work progresses. For the full designer-facing
description of the system see [PROJECT_BRIEF.md](PROJECT_BRIEF.md).

Last updated: 2026-09-26

---

## Where things stand

**Repo** — `Kutubhane/`, branch `backend-dynamic-categories`, nothing pushed to a
remote. Working tree has `PROJECT_BRIEF.md`, `ROADMAP.md` and `.claude/` untracked.

**Stack** — Go 1.25 + Fiber + GORM + Postgres 18 (`school-library-system/`, ~3.7k
lines, port 8000) and React 19 + Vite/rolldown + Tailwind 3 (`library-frontend/`,
~6.5k lines, port 5180). No component library, no state manager, no tests.

**How to run**

```bash
cd school-library-system && go run .
```

```bash
cd library-frontend && npm run dev
```

Postgres must be up. DB `school_library`, user `postgres`. If the frontend serves
stale code after edits, kill node on :5180, `rm -rf node_modules/.vite`, restart —
Vite's watcher drops changes on Windows.

**Logins** — all passwords `Test1234`: `admin@school.com` (admin),
`mgr@hadaf.com` (manager), `fatma@lib.com` (librarian, branch 1),
`nicat@stu.com` (student).

**What works today** — full per-branch library operations: catalog with dynamic
categories, copies with barcodes, loans, returns, reservations with pickup
deadlines, borrow limits, reading diary with derived stats, book requests,
invite-link registration, four roles (admin / manager / librarian / student),
tr-az-en throughout, anonymous landing page with aggregate stats.

**What's missing / broken** — see "Backlog" at the bottom.

---

## Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Catalog splits into four levels: **Work → Edition → Holding → Copy** | Agreed |
| D2 | Tenancy generalises: **User / Organization / Location / Membership**, orgs typed SCHOOL, PUBLIC_LIBRARY, PRIVATE_LIBRARY, BOOKSTORE, PERSONAL | Agreed |
| D3 | Privacy layers org policy → user setting → per item, each able only to tighten; minors capped regardless | Agreed |
| D4 | No direct messages in v1; adult→minor following off by default | Agreed |
| D5 | Global Work/Edition records read-only to librarians; local deviation lives on Holding; curator merges duplicates | Proposed |
| D6 | A reader's profile is **global** — reading history and followers survive changing school | **Assumed, not confirmed** |
| D7 | Author + Publisher become global (facts about the book); Topic, Genre, Frequency stay branch-local (shelving decisions) | **Assumed, not confirmed** |

D6 and D7 are my recommendations, taken as working assumptions so the work can
start. Both are reversible cheaply right now and expensive later — say the word
if either is wrong.

---

## Phase 1 — Catalog split (Work / Edition / Holding / Copy)

The prerequisite for everything social. Mechanical, self-contained, no UI concept
changes for the librarian if done right.

- [x] **1.1** `Work`, `Edition`, `CatalogAuthor`, `CatalogPublisher` added in
      `models/catalog.go`; registered in `main.go` AutoMigrate
- [x] **1.2** `Book` is now the branch **Holding**: gained `EditionID` +
      `CatalogEdition` relation. The duplicated bibliographic columns are
      *retained for now* — expand/migrate/contract, so nothing broke. They get
      dropped in 1.7 once every read path goes through Edition
- [x] **1.3** Backfill written as `catalog/backfill.go` + `cmd/catalogbackfill`,
      idempotent, dry-run by default. Rehearsed on a `pg_dump` clone, then
      applied to `school_library` after a backup. 21 holdings → 21 works,
      21 editions, 18 authors, 8 publishers; 0 unlinked, copies and loans
      untouched. Unit tests in `catalog/normalize_test.go` (first tests in
      the repo)
- [x] **1.4** `GET /api/catalog/search?q=|isbn=` and `GET /api/catalog/editions/:id`
      in `handlers/catalog.go`. Searches the whole shared catalog by title,
      author or ISBN via the normalized keys, and tells the caller how many
      branches hold each edition and whether their own already does. Follows
      `merged_into_id` so old ids keep resolving
- [x] **1.5** `AddBook` takes either `edition_id` (link an existing catalog
      record — bibliographic fields come from the catalog, local fields from the
      form) or the bibliographic fields (resolved through the same matcher).
      **`BulkUploadBooks` too** — it was creating holdings with no edition,
      which would have silently desynced the catalog on every CSV import
- [ ] **1.6** External ids on Edition (`isbn13`, `open_library_id`,
      `google_books_id`) + idempotent import; duplicate merge with `merged_into_id`
- [ ] **1.7** Update every handler that touches `Book` — `liblary.go`,
      `settings.go`, `manager.go`, `public.go`, `reading.go`, `bookrequest.go`
- [ ] **1.8** Update the frontend: book form, catalog list, book detail, bulk CSV
      upload, settings panel (authors/publishers move out of branch scope)
- [ ] **1.9** Verify: smoke-test DB end to end, then the real DB after a backup

## Phase 2 — Build the myredbookshelf design

- [x] **2.1** Design received: `Hedef Kutuphane clickable prototype (1)/design_handoff_myredbookshelf/`.
      High fidelity, desktop first, Tailwind-native. Answers the open questions:
      it is a **separate consumer surface** at its own domain, with the staff
      console as a distinct app — so D6 (global reader profile) and D7 (author
      and publisher as global facts) are both settled the way we assumed
- [x] **2.2** Foundation: design tokens (`mrb/theme.js`), Noto Sans + Source
      Serif 4, logo built from CSS shapes, shared primitives (half-star rating,
      CEFR/genre chips, typographic cover placeholder, availability pill,
      buttons, cards, toast)
- [x] **2.3** Global shell — sticky blurred header, 1360px canvas, logo +
      wordmark, school pill, nav, search with quick filters and a live
      suggestion dropdown, AZ/TR/EN switcher, streak pill, avatar
- [x] **2.4a** **Fidelity pass, 2026-09-27.** Catalogue, Book detail, My Shelf,
      Challenges and Landing rebuilt from the prototype's markup, as Discover
      already had been — literal sizes, colours and spacing, verified with
      `getComputedStyle` against the source rather than by eye. See the Log
      entry for the backend work it required
- [x] **2.4** **Catalogue** screen, wired to real data: scope switch with
      counts, filter panel (search, availability toggle, CEFR chips, genre
      facets with colour dots and counts, edition-language chips, length
      chips), removable filter chips, sort, results grid, empty state, and a
      reserve action that really creates a reservation
- [x] **2.5** **Book Detail** screen: breadcrumb, cover, availability, specs
      table, serif title, action bar, rating card and review composer (the last
      two rendered in their designed form but disabled, since reviews have no
      backend)
- [x] **2.6** **Discover** is now the signed-in home, built on real loans and
      the real reading diary: greeting + league sentence, Bookworm of the
      period, branch league (average pages per student), trending carousel
      ranked by loans, top-readers sidebar. Top Reviewer and the activity feed
      are honest empty states until reviews exist
- [x] **2.6a** **00 Landing** is now the site's main page at `/`: guest header,
      hero with the shelf-of-covers visual, "What the community is reading"
      (real books), how it works, fresh-reviews section, For schools band,
      libraries coming soon, footer with live totals. Signed-in visitors are
      sent into the app instead
- [x] **2.7** **Challenges** — built full stack. Challenge cards with organiser
      pill and status, detail with per-book step pills and a single next action,
      the 3-question quiz modal with best-score-kept, frontrunners and prizes.
      Backend: `Challenge`, `ChallengeBook`, `ChallengeParticipant`,
      `ChallengeProgress`, `QuizQuestion`, `QuizAttempt`, plus staff authoring
      endpoints (the Challenge Builder's back end). Battles and alliances still
      outstanding — they need Phase 3 tenancy
- [x] **2.8** **My Shelf** — built full stack. Profile banner with pinned
      badges, stats row, badge grid, and tabs for Currently Reading (inline page
      logging), Diary & History (grouped by month), Want to Read and private
      Notes. Backend: `ShelfItem`, `Note`, `Badge`, `UserBadge`. Badge progress
      is computed live from loans and the diary rather than stored, so it can
      never drift; reaching a target awards the badge on the spot
- [ ] **2.9** Public screens: Landing, Join (with parent consent), Book clubs,
      Libraries & bookstores, Reader home
- [ ] **2.10** Personas and the masking rule (initials outside your own school,
      under-16 protection) — depends on Phase 3 identity
- [ ] **2.11** Staff Console: librarian circulation desk, teacher class
      dashboard / challenge builder / moderation queue, admin analytics /
      branches & users / alliances. Read `Staff Console.dc.html` as the spec —
      the prototype freezes when opened.
      **Shell and the three librarian screens are done to the design** (S1–S3,
      2026-09-27): the 236px `#082F49` sidebar with the school card and the
      workspace nav, the sticky top bar with crumb / 19px-800 title / search /
      role chip, the 24/800 KPI strip, the desk's numbered check-out flow with
      a basket, the barcode check-in with its overdue and hold alerts, the
      holds queue with placed date and queue position, and inventory with
      segmented availability bars. **Teacher (S4–S6) and admin (S7–S9) are not
      built** — they are features, not restyling, and S4/S6 need the `teacher`
      role first
- [ ] **2.12** Replace the remaining role dashboards once the new screens cover
      them, and translate the `ComingSoon` scaffolding away. Students already
      land in the new app after login; `/student` stays reachable directly, and
      staff still go to their existing consoles

## Phase 3 — Identity & tenancy refactor

Bigger and more invasive than Phase 1. Design output should sharpen it first.

- [ ] **3.1** `Organization` (typed) and `Location` replacing `School`/`Branch`
- [ ] **3.2** `Membership` join table; `User.Role` string retired
- [ ] **3.3** Move `Grade`/`ClassGroup` onto the school membership
- [ ] **3.4** Org switcher in the UI for multi-membership users
- [ ] **3.5** `Holding.mode` — LENDING / RETAIL / REFERENCE — so bookstores work
- [ ] **3.6** Cross-org availability on the book page ("available at …")
- [ ] **3.7** Self-signup for readers with no institution
- [ ] **3.8** Migration: Hadaf → Organization(SCHOOL), branches → Locations,
      students → User + Membership

## Feature parity — what the design does not cover

The design describes a new product; the working system has features it never
mentions. Dropping them in the migration would be a regression, so each needs a
home in the new UI. Reviewed 2026-09-26.

| Existing feature | In the design? | Plan |
|---|---|---|
| Dynamic per-branch categories and statuses (authors, publishers, topics, genres, frequencies, copy conditions, copy/loan/reservation statuses) with full CRUD | **No** — the Staff Console has an Add-title modal but no list management | Add a **Settings** section to the Staff Console sidebar, carrying the existing panel over |
| CSV bulk upload of books | **No** — the design's CSV import is for users | Keep, as an action on Catalogue & inventory |
| E-book PDF upload and "Open e-book" | **No** — e-books are not mentioned at all | Keep on the book form and the book page |
| Branch-scoped student invite links (registration tokens) | **Partly** — Admin has an Invite modal, but not per-branch librarian-issued links | Keep on the librarian's Members area |
| Book-request queue for librarians and managers | **Partly** — students can "request purchase", but no staff queue exists | Keep as a Requests tab in the Staff Console |
| Manager role: school-level branch/librarian CRUD, librarian tracking, read-only branch workspace | **No** — the design has one school Admin and no Manager tier | Keep the role; map it onto the Admin console with the tracking and workspace screens added |
| Loan editing (change due date, fix a mistake) | **No** — the desk has check out and check in only | Add an edit action to the loan row |
| Reservation pickup deadlines and auto-expiry | **Partly** — holds can be marked ready or cancelled, with no deadline concept | Keep; surface the deadline in the holds queue |
| Borrow limits: branch default plus per-student override | **Partly** — check-out mentions a limit but there is no settings UI | Build the UI in Settings — still missing in both |
| Platform admin across many schools | **No** — the design's Admin is a single school's admin | Keep the platform tier above the school Admin console |

Found during the 2026-09-27 fidelity pass — designed features with nothing
behind them yet:

| Designed element | Where | Status |
|---|---|---|
| Book synopsis under the title (Source Serif 18/1.65) | Book detail | Field exposed as `synopsis` off `Work.Description`; **nothing writes one**, so no title has it. The book form needs the field |
| "Fresh from the community" review cards | Landing | Deliberately an empty state: every reviewer is a student or teen, and the design's own caption says those reviews are members-only |
| Book clubs card with real clubs | Landing | Feature does not exist (Phase "Later"); the card says coming soon |
| Overdue reminders, "notify class teachers", "mark lost" | Staff · Holds & overdue | No notification channel, no teacher role, and no LOST copy status. The bulk bar states this instead of pretending |
| Teacher line under each overdue student | Staff · Holds & overdue | Blocked on the `teacher` role |
| School battles and the alliance card | Challenges | Blocked on Phase 3 tenancy |
| Per-branch copy counts when adding a title | Staff · Inventory | The add flow links one holding for the caller's own branch; multi-branch stocking needs the manager tier |
| ISBN lookup when adding a title | Staff · Inventory | Replaced by a shared-catalogue search, which is the equivalent this system actually has — an external bibliographic service would be new scope |

## Phase 4 — Social layer backend

What remains after My Shelf and Challenges: reviews and everything built on
them.

- [ ] **4.1** `Review` + `Rating` on Work (half-star steps), `ReviewVote`,
      `ReviewReply`, `Shelf`/`List`, `Follow`, private `Note`
- [ ] **4.2** Privacy enforcement per D3/D4, with the minor cap non-bypassable
- [ ] **4.3** Moderation queue + report button
- [ ] **4.4** Feed, with seeded signal for cold start (staff picks, recently
      returned, most borrowed)
- [ ] **4.5** Notification infrastructure — none exists today
- [x] **4.6** `Badge` + `UserBadge` — done with My Shelf
- [x] **4.7** `Challenge`, `ChallengeBook`, `ChallengeProgress`,
      `QuizQuestion`, `QuizAttempt` — done with Challenges
- [ ] **4.8** `Battle`, `Alliance`, per-field sharing toggles + audit log
- [ ] **4.9** `Club`, `ClubMembership`, `ClubThread`, `ClubPost`
- [ ] **4.10** Streaks and leaderboards (avg pages per student), materialised
      rather than computed per request once there is real volume

## Phase 5 — Dərslik (classroom textbook distribution)

- [ ] **5.1** `Class`, `Subject`, `AcademicYear` entities
- [ ] **5.2** Textbook set per class per year
- [ ] **5.3** Bulk issue at year start / bulk return at year end, with exceptions
- [ ] **5.4** Mid-year joiners and leavers
- [ ] **5.5** Damaged and lost handling
- [ ] **5.6** Keep textbooks out of the borrow limit and out of the social layer

---

## Backlog (pre-existing, not blocking)

- [ ] Borrow limits, pickup deadlines and branch policy settings have **working
      backend endpoints and no UI at all** — `branch-settings`, `loan-limit`,
      `pickup_days`, and the `LIMIT` / `DUPLICATE` / `NO_COPY` error codes appear
      nowhere in the frontend
- [ ] **Almost every ISBN in the database is 12 digits, not 13** — truncated,
      missing the check digit (e.g. `978-0-7432-7356`). The matcher correctly
      refuses them and falls back to title matching (covered by a test), but the
      book form should validate ISBNs on entry so no more get in
- [ ] The language *filter* dropdown lists both `Azərbaycan` and `Azerbaycan`
      as separate options. Matching now treats them as one language, but the
      display values are still whatever was typed, so the UI looks untidy.
      Cosmetic; wants the filter to group by normalized code
- [ ] Three book covers are generated placeholders (real ones exist on Open
      Library: cover_i 5094326, 103858, 8996939)
- [ ] Azerbaijani strings are AI-translated, never reviewed by a native speaker
- [ ] Admin dashboard CRUD never verified end-to-end in a browser
- [ ] ~20 cosmetic lint warnings
- [ ] No tests anywhere
- [ ] Nothing pushed to a remote — single machine, no backup

---

## Log

**2026-09-27 (dead code sweep)** — Looked for unused endpoints and found almost
none: **every one of the 152 routes is referenced** by the UI, the API audit or
`tools/`. Five are referenced only by the audit, and all five are kept
deliberately:

| Route | Why it stays |
|---|---|
| `GET/PUT /branch-settings` | The branch-wide borrow limit. The parity table lists its UI as still to build — deleting the backend would delete the feature |
| `GET/PUT /loan-limit` | Same policy pair |
| `GET /catalog/editions/:id` | The canonical single-edition read. Book Detail currently filters `/catalog/browse` instead, which is the thing that should change |

The dead code was in the **frontend**. Walking the import graph from
`main.jsx`: 52 modules reachable, 6 not. Deleted four —
`pages/Login.jsx`, `pages/Register.jsx` (superseded by
`mrb/pages/AuthPages.jsx`), `pages/PublicHome.jsx` (superseded by the landing
page) and `App.css`.

The other two were **not** dead, and one was a latent bug: `App.jsx` imported
`./pages/student/StudentDashBoard` while the file is `StudentDashboard.jsx`.
Windows does not care; a Linux build would have failed on it. Fixed, which also
un-orphans `components/BookRequestModal.jsx`.

Then 104 translation keys that nothing referenced any more — 312 lines across
the three locales. The detector has to understand both spellings of a dynamic
key, `t('mrb.scope.' + scope)` **and** ``tr(t, `mrb.badge.${code}.name`)``; the
first pass missed the template-literal form and would have deleted every badge
name. Afterwards all 13 screens plus both old dashboards were scanned for raw
`dotted.key` text: none.

**2026-09-27 (the console was unreachable)** — The librarian console had been
built for two sessions and nobody could see it: signing in as a librarian went
to `/librarian`, the *old* dashboard, while the rebuilt console sat unvisited
at `/staff`. Worth remembering — "is it wired up?" is a different question from
"is it built?", and only the first one the buyer can answer.

Four places decided where a signed-in user goes and they disagreed. The live
login is `mrb/pages/AuthPages.jsx`; `pages/Login.jsx` is dead code that still
carried its own copy of the rule, and I edited that one first and watched
nothing change. They now all defer to `homePathFor()` in `src/home.js`.

A librarian lands on `/staff`, which by now covers everything their old
dashboard did — desk, holds and overdue, all loans, catalogue with copies,
members with invite codes, requests, settings. **Managers and admins keep
their own consoles**: the staff console has no screens for them yet (S7–S9,
analytics and branches & users, are unbuilt), so routing them there would take
tools away rather than give them any. The sidebar keeps a "Classic dashboard"
link while the console beds in.

**2026-09-27 (profile & challenges)** — Compared My Shelf and Challenges against
the running prototype rather than its markup, which showed three real gaps.

*The profile banner* was a row short. The prototype's text column has four:
name + handle, three pills, the pinned badges, and a **bio** — and the pills are
school · branch, year group and **reading level**, not the grade/branch/streak
mine carried (the streak is already a statistic below and a pill in the header).
So: `Student.Bio` added with `PUT /shelf/bio` (deliberately outside
`UpdateProfile`, which gates every change behind the current password — right
for an email, absurd for a sentence about liking science fiction), and
`reading_level` on `/shelf/summary`, derived from the commonest CEFR among the
books the reader has finished. Students have no CEFR field and inventing one
from their year group would be fiction.

*Badges*, on the buyer's instruction, now deviate from the prototype
deliberately: the design puts a 160px-card grid directly under the profile,
which fills the screen before the reader reaches what they are actually
reading. The section moved below the shelves, the cards went to 120px (56px
medallions, description demoted to a tooltip), and it folds away — collapsed by
default, and the choice is remembered per reader. 600px of page became 99px.

*Challenges* had three wording mismatches with the prototype: the organiser
pill said a generic "School" where the design names it ("Hədəf · all 5
branches"), the card's progress counted sub-steps where the design counts
**books verified**, and Frontrunners lacked the reader's own rank ("You're #6
of 418"). The API gained `organiser`, `branch_count` and `verified` to say it
properly.

**2026-09-27 (librarian pass)** — **Loan system verified, and the librarian
features the design never covered given a home.**

*Loans.* `tools/test_loan_lifecycle.py` passes 33/33 against a scratch clone,
and the rebuilt Circulation Desk was driven by hand through a full cycle:
pick a student → see their live limit readout → search a copy → basket → check
out → check in with a condition. The KPI strip, the day's log and the database
all agreed at every step; the copy came back AVAILABLE with its condition
recorded, and the hold alert fired on the return because another reader was
waiting for it.

*The gap.* `Staff Console.dc.html` gives the librarian three screens. The
working system has always had more, and the new console had quietly dropped
them — most seriously, **there was no way to add a physical copy**. Added, in
the staff design system's language:

- **Inventory** — add / edit / delete copies (a new copy defaults to the
  branch's AVAILABLE status, or it lands in limbo: countable by nobody and
  lendable to nobody), edit a holding's shelf mark and genre, upload a cover or
  an e-book, delete a title, and CSV bulk import. Title and author stay
  read-only: they belong to the shared catalogue.
- **Members** (new nav item) — the branch's readers with a KPI strip, search,
  and a side panel carrying their statistics, what they have out and the one
  setting a librarian may change, their borrow limit. Plus the branch invite
  codes students register with. This borrows S8's shape, scoped to one branch
  and one role.
- **Holds & overdue** — a third tab, "All loans", with the action the design
  never gave the desk: change a due date.

Fixed on the way: `/class-list` did not preload the loan's book, so the reader
panel said "A book" instead of the title; and `API_ORIGIN` is now overridable
with `VITE_API_ORIGIN`, which is how the UI was pointed at the scratch server
so none of this testing touched the real database.

**2026-09-27 (later)** — **Four corrections after review.**

1. **The landing page was not the guest view.** The prototype uses *one*
   header for members and guests — same logo, nav, search and quick filters,
   only the tail differs (avatar vs "Log in / Join"). The landing had its own
   search-less header, which is what made it look like a different page. The
   header is now `mrb/components/SiteHeader.jsx`, shared by the app, the
   landing and the public screens. The two empty sections are filled with real
   data: recent reviews and the challenges schools are reading together.

2. **Dates ignored the chosen language.** 37 `toLocaleDateString()` calls with
   no locale meant an Azerbaijani page said "Sunday, September 27". They now go
   through `i18n/dates.js`. Note for anyone tempted to use `Intl` for this:
   Chrome reports `az` as supported and then formats it "M09 27, Sun", so the
   Azerbaijani month and weekday names are tabulated in that file. The default
   language is now `az` rather than `tr`, which is the other half of why the
   UI read as half-translated. The remaining hardcoded Turkish in the old
   dashboards is translated too.

3. **Responsiveness.** The design is desktop-first and relies on `flex-wrap`;
   at 375px the header stacked into six rows 570px tall before any content, and
   the search box pushed its quick filters off the edge. `mrb/responsive.css`
   holds the few rules that need a media query: a gutter that shrinks from 40px
   to 16px, a three-row mobile header (165px), display sizes on `clamp()`, and
   the staff sidebar becoming a horizontal bar under 900px.

4. **School students only — no individual sign-ups** (confirmed with the buyer
   on 2026-09-27). The landing leads with the school code instead of "join
   free"; the "readers aged 13+" framing, the adult book clubs and the adult
   public reviews are gone. What replaced them is real: reviews by school
   readers and challenges at partner schools.

   A logged-out visitor may now browse the catalogue and read a book page
   (`/catalogue`, `/book/:id`), with every action routing to sign-in — the
   design's guest persona. Reviews are visible to guests **with author names
   reduced to initials and no grade or branch**, because they are written by
   minors: `maskReviewAuthors` in `handlers/review.go`, served by
   `/api/public/catalog`, `/api/public/works/:id/reviews` and
   `/api/public/reviews`. The authenticated endpoints are untouched.

**2026-09-27** — **Design-fidelity pass on the remaining reader screens and the
staff console.** Discover had already been rebuilt from the prototype's markup;
the same treatment is now done for Catalogue, Book detail, My Shelf, Challenges,
Landing, the staff shell and the three librarian screens. Each was written by
opening that screen's block in `myredbookshelf.dc.html` (or
`Staff Console.dc.html` / `Staff Design System.dc.html`) and transcribing the
literal sizes, colours and spacing, then checked against the source with
`getComputedStyle` rather than by eye.

The pass turned up backend gaps, because several designed elements had no data
behind them:

- `scope=shelf` on `/catalog/browse` still returned 501 from before `ShelfItem`
  existed. It now browses the reader's own works, so the design's three-way
  scope switch works.
- The sort menu names four orders; the backend had three, and "most borrowed"
  actually sorted by *copies held*. Added a real `borrow_count` (loans per
  edition, all branches) and a `rating` order that sinks unrated titles.
- Book detail needed `synopsis` (from `Work.Description`) and `my_loan_id`, so
  the diary button can write against the open loan.
- The review feed's caption says "sorted by most helpful" — it was newest
  first. Sorted after decoration, stably, so ties stay newest-first.
- `review_step_available: false` was stale: reviewing a challenge book has
  ticked its step since reviews landed. The step is live again.
- `/shelf/summary` gained the second line under each statistic — books this
  month, member since, percentile within the year group, best streak — plus the
  sidebar's genre mix.
- Added `ReadingGoal` (one row per reader per year) with `GET/PUT /shelf/goal`,
  for the design's year-goal card.
- Added `GET /public/challenge` so the landing page's open-challenge card and
  hero badge show the real challenge rather than a mock.
- The desk summary gained the same-weekday-last-week comparison behind the
  design's "+6 vs last Sat", and `POST /return/:id` now records the copy's
  condition from the branch's own condition rows.

Three designed elements were deliberately **not** faked, and say so on screen:
the landing page's "fresh from the community" strip (every reviewer here is a
student or teen, and the privacy rule keeps their reviews for members — which
is exactly what the design's own caption states), the book-clubs card (the
feature does not exist), and overdue reminders (there is no notification
channel yet). Book synopses render when present; nothing writes one yet.

**2026-09-26** — Wrote `PROJECT_BRIEF.md` (designer-facing description of the
system) and this roadmap. Agreed the four-level catalog and the
org/membership tenancy model.

**2026-09-26** — Phase 1.1–1.3 done. Global catalog tables exist and every
holding is linked to an Edition. Approach was expand/migrate/contract: add the
new tables and the `EditionID` column alongside the old fields, backfill, and
only later drop the duplicated columns — so the running app never broke.

Matching went through two rounds. The first matcher keyed works on
title+author and editions on title+publisher+year+language, which failed the
moment one branch recorded a publisher and another didn't: the same book got
two works and two editions. Now there is a relaxed second pass that matches on
title alone (works) or ignores a missing publisher (editions), but **only when
exactly one candidate fits** — an ambiguous match is refused, logged, and left
for a curator rather than guessed. Verified: two branches stocking "1984" with
different metadata collapse onto one edition; two same-titled works with no
author correctly refuse to merge.

DB backup taken before applying, kept in the session scratchpad
(`school_library_backup_20260926_145908.dump`). Rollback if ever needed:
`UPDATE books SET edition_id=NULL;` then drop `editions`, `works`,
`catalog_authors`, `catalog_publishers`.

**2026-09-26** — Phase 1.4–1.5 done. The catalog is now reachable and every
write path goes through one matcher.

Refactored first: the backfill had its own in-memory matching, which would have
drifted from whatever the book form did. Matching now lives in
`catalog/resolve.go` and is called by the backfill, `AddBook` and
`BulkUploadBooks` alike. This needed normalized key columns (`title_key`,
`language_key`, `match_key`) so the same comparison can run as a SQL predicate;
`catalog.Reindex` fills them and is safe to re-run.

Three real defects found by testing rather than by reading:

1. **Hyphens were being dropped, not treated as word breaks**, so
   "Kitabi-Dədə Qorqud" and "Kitabi Dədə Qorqud" did not match. Hyphens, dashes
   and slashes now fold to a space; apostrophes and brackets are still dropped.
   The old unit test had asserted the wrong behaviour and was rewritten.
2. **`SELECT *` across the author/work joins** let `catalog_authors.id` and
   `works.title` overwrite the edition's own fields when GORM scanned the row —
   search returned a 500. Fixed by scoping to `editions.*`.
3. **`BulkUploadBooks` bypassed the catalog entirely**, creating holdings with
   `edition_id` NULL. Every CSV import would have quietly desynced the catalog.

Verified end to end against a clone and then live: branch 2 linking to branch 1's
edition of "1984" produces one shared edition with `holding_count` 2; a CSV
containing a book another branch owns reports `matched_existing`; an ambiguous
title with no author is refused rather than guessed. Test rows were removed —
the DB is back to 21 books / 21 works / 21 editions / 41 copies / 10 loans, 0
unlinked.

`AddBook`'s response keeps the book's fields at the top level (embedded struct)
so existing callers are unaffected; `catalog_match` is additive.

**2026-09-26** — Testing and fixes pass. 23 tests now pass (`go test ./catalog/`),
up from 7. The manual checks from the previous session are now automated
integration tests against a throwaway Postgres (`resolve_test.go`), so the
matching behaviour cannot silently regress. They skip rather than fail when no
Postgres is reachable.

Writing the tests found one bug immediately and confirmed two fixes:

- **Language values were not normalized.** `az` and `Azərbaycan` produced
  different keys, so one book became two editions. `catalog/language.go` folds
  the spellings this system actually sees onto ISO 639-1 codes; unknown
  languages still match themselves rather than collapsing together. The typed
  value is preserved for display. Applied to the real DB by reindex.
- **The corrupted title is repaired.** `?li v? Nino` is now `Əli və Nino` in
  `books`, `works` and `editions` (13 octets / 11 chars — real UTF-8), and
  renders correctly in the catalog. Backup taken first. No literal `?` remains
  in any title anywhere.
- **Database-level duplicate protection added.** The resolver's check-then-insert
  is not atomic, so two simultaneous adds of the same ISBN could both pass.
  `main.go` now creates partial unique indexes on `editions(isbn13)` and
  `works(match_key)` (partial: blanks stay allowed, merged rows excluded).
  Verified they actually reject a duplicate.

### Security fix found during the regression pass

`GET /api/my-library/:id` and `GET /api/student/:id/stats` had **no access check
at all**. Any signed-in student could read any other student's borrowed books,
due dates, reading progress and statistics by editing the id in the URL. The
newer diary endpoints had the guard; these two predated it and never got one.

Both now call a new `requireStudentAccess` helper in `handlers/reading.go`, which
takes the raw path parameter so a handler cannot forget to parse and check it.
Verified matrix: a student sees only themselves (own 200 / other 403); a
librarian sees their own branch (200) but not another branch (403); a manager
sees their school; an admin sees all; a malformed id is a 400. Both frontend
call sites already pass a permitted id, so nothing broke.

This matters beyond the immediate leak: the privacy model in D3 is meaningless
if personal endpoints are unguarded.

### Regression pass

All four roles exercised end to end, API and UI. 27 endpoints across librarian,
student, manager, admin, catalog and public return expected statuses. Librarian
books list, student catalog / my-books / stats (reading speed, genre
distribution, history), and the admin dashboard all render with no console
errors. DB unchanged at 21 books / 21 works / 21 editions / 41 copies / 10
loans, 0 unlinked.

**2026-09-26** — Design handoff received and the first slice built.

Read the whole handoff and the prototype (served locally and stepped through in
a browser). It is 15+ screens plus a three-role staff console, and needs about
twenty new tables. Rather than stub all of it, I built the foundation and the
two screens the existing backend can genuinely feed, end to end.

Built: `mrb/theme.js` (tokens transcribed from the handoff), `mrb/streak.js`,
`mrb/components/primitives.jsx`, `mrb/components/AppShell.jsx`,
`mrb/pages/Catalogue.jsx`, `mrb/pages/BookDetail.jsx`, `mrb/pages/ComingSoon.jsx`,
`mrb/MrbApp.jsx`, mounted at `/app/*`. Backend: `GET /api/catalog/browse` in
`handlers/browse.go` — scope, text search, CEFR, language, length, genre,
availability, sort, with per-branch availability and holdings elsewhere.
59 new i18n keys across tr/az/en.

Two places where the design does not meet the data, handled rather than faked:

- **Genres.** The handoff names eight genres in English with fixed colours. Real
  genres are per-branch rows librarians name themselves, in Azerbaijani and
  Turkish ("Distopya", "Uşaq Ədəbiyyatı"). The eight documented colours are kept
  for exact matches; anything else gets a stable colour hashed from its name, so
  unknown genres still read as consistent distinct chips.
- **Ratings.** There is no review backend, so cards say "no ratings yet" rather
  than rendering empty stars, which would read as "rated zero". The book page
  shows the rating card and composer in their designed form but disabled, with
  the reason stated.

Verified live as a student in all three languages: 21 titles, real cover images,
CEFR filter narrows to 3, genre facets and counts correct, scope switch works,
and Reserve created a real reservation (checked in Postgres, then removed along
with the copy's status). Build and lint both clean.

**2026-09-26** — `/` is now the design, not the old page.

The first pass mounted the new app at `/app` and left the old public home on
`/`, which is not what a replacement means. Now: `/` serves the 00 Landing
screen to a logged-out visitor and sends a signed-in one into the app, whose
home is Discover — matching what the design shows each audience at the root.
Students also land in the app after login rather than the old dashboard.

**Discover** turned out to be substantially buildable from data that already
exists, so it is a real screen rather than a placeholder. Loans give the
trending carousel; the reading diary gives the branch league, the Bookworm of
the period and the top-readers board. New endpoints in `handlers/community.go`:
`/community/trending`, `/community/readers`, `/community/league`, plus a no-auth
`/public/books` for the landing page.

Two bugs found by looking at the rendered page rather than the API:

- Every trending card read "not borrowed yet" although the library has ten
  loans. `popularBooks` pads its result with never-borrowed titles so the row is
  never short, which meant the "window was empty, widen to all time" check —
  written as a length test — could never fire. It now tests for an actual loan
  signal.
- With demo data three months old, a 30-day window left Discover looking dead.
  The readers and league endpoints now widen to all time when the window is
  empty and return `all_time: true` so the UI labels it, instead of a new or
  quiet library seeing an empty board.

Verified signed out and signed in, in Turkish and Azerbaijani: the landing shows
real books from the library; Discover shows Nəsimi top of the branch league,
Aslan Polat as bookworm on 210 pages, and trending ranked 3/2/2/2/1 loans. The
legacy dashboards all still respond. Database unchanged.

**2026-09-26** — Endpoint audit, My Shelf and Challenges.

**Endpoint audit.** `cmd/apiaudit` is a re-runnable smoke test that logs in as
all four roles and checks every read endpoint, plus that each write is refused
for the wrong role. **130 checks, all passing.** Run it with
`go run ./cmd/apiaudit -writes` against a running server. It covers the
cross-role refusals too, so the access-control fix from earlier is now guarded
by a test rather than by memory.

**My Shelf** and **Challenges** are both built full stack and replace their
placeholders; `ComingSoon.jsx` is deleted.

Badge progress is derived, not stored — pages, books, languages, early returns,
quizzes passed and streak are all recomputed from loans and the diary on each
request, and a badge is awarded the moment its target is met. That means a badge
can never be out of step with reality, and a scoring change just works
retroactively. Pages are summed as the furthest page per book, not the sum of
every log row, which would count the same pages repeatedly.

The challenge flow is covered by a scripted end-to-end test (17 checks, all
passing): joining is required before acting, the quiz never ships its answers to
the client, a failing attempt is recorded without passing, passing awards 15
points and marks the book read, and a later worse attempt does not lower the
best score.

Badge names are seeded in English in the database, so the UI now translates them
by badge code and falls back to the seeded text — otherwise the badge grid stayed
English while everything around it was Azerbaijani.

A demo challenge ("Payız Oxu Marafonu", 3 books, a 3-question quiz on the first)
was created through the API so the screen has content. It is ordinary data:
`DELETE /api/challenges/1` as a librarian removes it.

**Feature parity** with the existing app is now reviewed and tabled above — ten
features the design does not cover, each with a plan so the migration does not
quietly drop them.

**Not done this round: the Staff Console.** The librarian and admin redesign is
nine sub-screens (circulation desk, holds and overdue, catalogue and inventory,
class dashboard, challenge builder, moderation queue, analytics, branches and
users, alliances) and it is the next piece of work. The existing dashboards keep
running untouched in the meantime, so nothing is regressed — but they are still
the old design.
