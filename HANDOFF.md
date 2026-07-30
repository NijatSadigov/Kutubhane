# E12 Kütüphane — Session Handoff

Last updated: 2026-07-28. Everything below is committed on branch
`backend-dynamic-categories` (nothing pushed to a remote). Working tree clean.

## What this project is

A school library system. **Backend**: Go + Fiber + GORM + Postgres in
`school-library-system/`. **Frontend**: React 19 + Vite (rolldown) + Tailwind in
`library-frontend/`. Four roles: admin, **manager** (school-level), librarian,
student. The git repo root is `Kutubhane/` (one level below the folder usually opened).

## How to run (both servers must be restarted each new session)

Postgres runs locally; `psql` is at `/c/Program Files/PostgreSQL/18/bin/psql.exe`
(user `postgres`, password `2334`, db `school_library`).

- **Backend** → port 8000: `cd school-library-system && go run .`
  Config comes from env with dev fallbacks (`config/config.go`): `JWT_SECRET`,
  `DATABASE_DSN`. Defaults connect to the real `school_library` DB.
- **Frontend** → port **5180** (fixed via `strictPort` in `vite.config.js`):
  `cd library-frontend && npm run dev`. Backend CORS allows 5173 + 5180.
  Port 5173 is taken by the user's *other* app (SERÇE Aİ) — leave it alone.

### ⚠️ Critical gotcha: stale Vite on Windows
After many edits, Vite's file watcher misses changes and serves a **stale
in-memory transform**. Symptom: the browser shows old code / wrong behavior even
after a refresh (e.g. covers rendering as broken images, a translation not
applying). Fix = **restart the dev server**, not just refresh:
```
kill the node on :5180, then: rm -rf node_modules/.vite && npm run dev
```
This bit us twice this session. When something looks wrong, suspect this first.

## Login credentials (ALL passwords are `Test1234`)

| Email | Role | Branch |
|---|---|---|
| admin@school.com | admin | — |
| mgr@hadaf.com | manager | School "Hadaf" (id 1) — demo account added when building the manager role; delete anytime |
| fatma@lib.com | librarian | 1 (Nesimi) |
| ayse@lib.com | librarian | 1 (Nesimi) |
| Mert@lib.com | librarian | 2 (Gence) |
| nicat@stu.com, aslan@stu.com + 8 demo students | student | 1 (Nesimi) |

Demo students: leyla@, tural@, nermin@, elvin@, aysu@, reshad@, gunel@, kamran@ (all @stu.com).

## Current data state (branch 1 = Nesimi)

20 books, 41 copies, 10 students, 10 loans (5 active incl. 2 overdue, 5 returned),
~6 reservations (pending + approved). Covers: 14 real JPGs from Open Library + 6
generated SVGs, all under `school-library-system/uploads/covers/`. **`uploads/` is
gitignored** — covers/e-books live only on this machine's disk, referenced by
`cover_url`/`ebook_url` in the DB.

## Architecture you must know before editing

- **Branding = Hədəf STEAM Liseyi** (customer, not "e12"). Brand primary blue
  `#1B9DD9`, hover/darker `#1580B5`; secondary accent = Tailwind `sky-*` (was
  `indigo-*`); light info tints `#E0F2FE`/`#7DD3FC`/`#BAE6FD`, dark info text
  `#075985`. Colors are inline (no Tailwind theme tokens). **Semantic red is kept
  on purpose** — errors, overdue, delete/danger, and the reserved/rejected pink
  (`#FCE7F3`) badges. Wordmark renders as the text "Hədəf" (public/logo.png is
  absent; drop the real Hədəf logo there and it shows automatically).

- **Role hierarchy (4 roles).** `User.Role` is a string; each non-admin role has a
  profile table keyed by `UserID`. `admin` (platform, no profile) → creates schools
  + **managers**. `manager` (`Manager{UserID,Name,SchoolID}`, many per school) →
  runs one school: CRUD its branches + librarians, view its students, edit school
  profile. `librarian` (`SchoolID`+`BranchID`) → one branch. `student` (`BranchID`).
  - Manager backend lives in `handlers/manager.go`; **every** `/manager/*` handler
    calls `resolveManagerSchoolID(c)` (from the JWT identity, never the request body)
    and 403s on anything outside that school. Admin provisions managers via
    `/admin/manager` (`AddManager`/`UpdateManager`/`RemoveManager` in `admin.go`).
    Middleware `IsManager` (manager OR admin). Admin keeps full super-admin control.
  - Frontend: `pages/manager/ManagerDashboard.jsx` (Branches/Students tabs, reuses
    the admin `Modal` + `admin.*`/`manager.*` i18n keys). Admin dashboard gained a
    per-school "Managers" strip. Routes/redirects updated in `App.jsx`,
    `ProtectedRoute.jsx`, `Login.jsx`. Role labels: tr Müdür / az Müdir / en Manager.
- **Dynamic per-branch categories.** Authors, publishers, genres, topics,
  frequencies, copy-conditions, copy-statuses, loan-statuses, reservation-statuses
  are all branch-scoped lookup tables with CRUD (`handlers/settings.go`). Books
  reference them by nullable `*_id` FKs. Managed in the UI under the **Ayarlar**
  (Settings) tab.
- **Statuses have `Name` (librarian-editable) + `Code` (fixed).** Always branch on
  `.code` in JS, never the display name. Codes: copy `AVAILABLE/LOANED/RESERVED`;
  loan `ACTIVE/RETURNED`; reservation `PENDING/APPROVED/REJECTED/COMPLETED`.
  Seeded per branch by `database/seeder.go` (Turkish names, English codes).
- **Loans/returns/reservations identify a copy by `book_id` + `tracking_number`**,
  not by copy id. The book form sends category *ids*; copies are added one at a
  time (each has its own barcode / `tracking_number`).
- **i18n** is hand-rolled: `src/i18n/translations.js` (tr/az/en flat keys),
  `src/i18n/LanguageContext.jsx` (`useTranslation()` → `{ t, lang, setLang }`,
  persisted to `localStorage.lang`, falls back tr → key). `t('key', {vars})` does
  `{var}` interpolation. `LanguageSwitcher` sits in every header.
- **File paths**: `src/api/axios.js` exports `assetUrl(path)` (resolves
  `/uploads/...` against the backend origin `http://localhost:8000`) and
  `uploadFile(kind, file)`. Cover `<img>` tags MUST use `assetUrl()`.

## Testing pattern (used repeatedly, works well)

Don't touch the real DB for tests. Create a throwaway DB and point the backend at
it via env override, then drop it:
```
createdb school_library_smoketest → run backend with
DATABASE_DSN=...dbname=school_library_smoketest → curl the API → drop it.
```
Auth setup path for a fresh DB: register admin (role=admin) → login → POST
/admin/school → POST /admin/branch (seeds statuses) → POST /admin/librarian.
One-off DB scripts go in a temp subfolder of `school-library-system/` (e.g.
`sampledata/main.go`) that shares go.mod; run with `go run ./sampledata`, then
delete it. Note: Git Bash on Windows mangles UTF-8 in curl bodies (Turkish/Azeri
text) — that's a harness artifact, the app handles UTF-8 fine from the browser.

## Epic in progress (2026-07-28, continued session — uncommitted)

Building 4 phases: **A** reading diary+stats (DONE), **B** book requests, **C** public
landing page, **D** manager librarian workspace/tracking. Design locked with user:
reading speed = pages/day from diary-update timestamps (fallback loan duration);
public home shown to everyone (logged-in users get a "go to dashboard" link); book
requests are a simple title+author form (no ISBN), also offered on empty search.

**Phase A — DONE & verified (backend curl + frontend build + JS-driven UI checks):**
- Model `ReadingLog{LoanID, StudentID, Page, Note, CreatedAt}` (models/liblary.go),
  migrated in main.go. `handlers/reading.go`: `AddReadingLog` (student writes own
  loan only), `GetLoanReadingLogs`, `GetStudentReading` (aggregate stats + per-book
  progress + logs). Access helper `canAccessStudent` (self / same-branch librarian /
  same-school manager / admin) — scope-verified incl. cross-branch 403. Routes:
  `POST /reading-log`, `GET /reading-log/:loanId`, `GET /student/:id/reading`.
  `GetMyLibrary` DTO gained `current_page` (max logged page) for progress bars.
- Student UI: the dead "Okuma Bilgisi" buttons now open a diary modal (update page +
  note, progress bar, history). Stats tab gained a reading-speed KPI + "currently
  reading" progress bars; hardcoded TR strings replaced with i18n (`diary.*`,
  `stu.booksRead/pagesRead/readingSpeed/...`). Duplicate "Sınıf" header fixed via
  new `th.classGroup`.
- Staff view: reusable `components/ReaderStatsModal.jsx` wired into the manager
  students table and the librarian members table ("Okuma"/Reading button per student).

**Phase B — DONE & verified (backend curl incl. scope + build + student UI smoke):**
- Model `BookRequest{StudentID, BranchID, Title, Author, Note, Status, CreatedAt}`
  (plain status string PENDING/FULFILLED/REJECTED, not the dynamic status tables).
  `handlers/bookrequest.go`. Routes: student `POST /book-requests` (branch from own
  profile) + `GET /book-requests/mine`; librarian `GET /book-requests` +
  `PUT /book-requests/:id`; manager `GET|PUT /manager/book-requests[/:id]`
  (school-scoped). Cross-branch update → 403 (verified).
- Frontend components: `BookRequestModal.jsx` (student form title+author+note +
  "my requests" list) — opened from a "Kitap İste" button in the catalog toolbar and
  from an empty-search prompt (prefilled with the query). `BookRequestsQueue.jsx`
  (shared) — wired as a new "requests" nav tab in the librarian dashboard and a
  requests tab in the manager dashboard (showBranch). i18n `req.*`.

**Phase C — DONE & verified (public endpoint no-auth + build + guest/logged-in UI):**
- `handlers/public.go` `GetPublicStats` → per-school + platform totals (schools,
  branches, students, books, books_read=returned loans, pages_read), counts only,
  no PII. Registered as `GET /api/public/stats` BEFORE the auth group.
- `pages/PublicHome.jsx` at `/` (App.jsx route changed from Navigate→login). Header
  with LanguageSwitcher + login/register; logged-in users get "Go to my dashboard"
  → their role route. Totals cards + per-school stat cards. i18n `public.*`.

**Phase D — Librarian tracking DONE & verified (backend curl+scope, build, UI):**
- `handlers/manager.go` `ManagerLibrarianStats` → per-librarian row (branch, books,
  copies, active loans, pending reservations, pending requests, students),
  school-scoped. Route `GET /manager/librarian-stats` (IsManager; librarian→403).
- ManagerDashboard gained a "Librarian Tracking" tab (table). i18n `manager.tracking`,
  `mtrack.*`.
- Manager branch workspace (read-only "see what librarians see"): manager-scoped
  read endpoints `GET /manager/branch/:branchId/{books,loans,reservations}` (handlers
  in manager.go via `managerBranchParam`, which 403s on any branch outside the
  manager's school — verified). Frontend `components/ManagerBranchWorkspace.jsx` — a
  "Branch Library" tab with a branch selector + Books/Loans/Reservations sub-tabs.
  i18n `manager.workspace`, `ws.*`. Read-only by design; managers do not do librarian
  data-entry (add books / issue loans) — that stays with librarians.

## Done earlier (2026-07-28, continued session — uncommitted)

- **Admin dashboard translated** to tr/az/en (was English-only). See pending #1.
- **NEW: `manager` role (school-level admin).** Full stack — see the role-hierarchy
  bullet under Architecture. Backend verified end-to-end via curl: admin→create
  manager, manager login/preload, scoped branch CRUD (school_id forced from JWT,
  statuses auto-seed), students list, edit school; and security scoping — manager
  gets 403 on `/admin/*` and on any branch/librarian outside their school (foreign
  data left untouched). Frontend `npm run build` passes clean (1763 modules).
  Client-side clicks (tab toggle, modals) were NOT visually confirmed — the dev
  pane's rolldown-vite HMR client wedged after repeated restarts; the code renders
  and builds fine. If revisiting: hard-restart Vite + fresh browser tab, then click
  the Öğrenciler tab / "Şube Ekle" / "Ekle" to confirm the toggles + modals.

## Done earlier this session (12 commits, newest first)

- Deep translation of librarian + student dashboards + settings panel (tr/az/en).
- Token-based student registration (invite links) — `RegistrationToken` model,
  librarian modal on the Members tab, `/register?token=` flow. Replaces the old
  "type your branch id" signup.
- File uploads for covers (images) and e-books (PDFs): `POST /api/upload/:kind`,
  served statically at `/uploads`, book form has uploaders + preview, student
  detail shows an "Open E-Book" button.
- i18n foundation + language switcher; Anasayfa (home) overview pages for student
  & librarian; profile modal (`PUT /api/profile`); wired the previously-dead
  sidebar nav.
- Student picker for loans, loan editing (`PUT /loans/:id`), CSV bulk book upload.
- Wired the dead filter dropdowns (CEFR / language / availability).
- Security: `JWT_SECRET` + `DATABASE_DSN` moved to env; removed public
  `/debug/librarians`; `.gitignore` + `.env.example` added.
- Fixed category `book_count` always returning 0 (gorm `-` → `->;-:migration`).
- Frontend realigned to the dynamic-category backend refactor.
- Seeded 20 sample books (+covers), demo students/loans/reservations; reset all
  passwords to `Test1234`.

## PENDING / next steps

1. ~~**Admin dashboard is English-only**~~ ✅ DONE (2026-07-28). Translated
   `src/pages/admin/AdminDashboard.jsx` to tr/az/en via `t()`. Added an
   `admin.*` namespace (+ `admin.md.*` for the modal titles keyed on `modalType`)
   to `src/i18n/translations.js`; reused existing keys where they fit
   (`common.save/add/loading`, `auth.email/password`, `profile.name`,
   `msg.opFailed`). Verified in-browser rendering in all three languages (nav,
   headers, librarian lists, "New School" modal). CRUD not yet exercised — see #4.
2. **3 covers are generated placeholders, not real.** Əli və Nino, Kitabi-Dədə
   Qorqud, Saatleri Ayarlama Enstitüsü have real covers on Open Library (cover_i
   5094326, 103858, 8996939) but the covers CDN rate-limited us after ~14
   downloads. Can retry fetching + `UPDATE books SET cover_url` for those.
3. **Azerbaijani strings were AI-translated** — may need a native speaker's tweaks.
   All in `src/i18n/translations.js`.
4. **Admin dashboard never verified end-to-end** in the browser (school/branch/
   librarian CRUD). Backend admin routes were untouched by the refactor, so likely
   fine, but unconfirmed.
5. Pre-existing lint noise (~20 warnings: unused `catch (err)`, hook-used-before-
   declared) across files not touched this session. Cosmetic.

## Don'ts

- Don't push or merge without the user asking.
- Don't run destructive SQL on `school_library` without asking (it's their real
  dev data). Reads and the documented password/seed helpers were pre-authorized
  this session; re-confirm for anything new.
- Don't reintroduce raw `book_copy_id` in loan/return/reservation calls — they use
  `book_id` + `tracking_number` now.
