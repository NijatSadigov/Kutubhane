# E12 Kütüphane — Session Handoff

Last updated: 2026-07-28. Everything below is committed on branch
`backend-dynamic-categories` (nothing pushed to a remote). Working tree clean.

## What this project is

A school library system. **Backend**: Go + Fiber + GORM + Postgres in
`school-library-system/`. **Frontend**: React 19 + Vite (rolldown) + Tailwind in
`library-frontend/`. Three roles: admin, librarian, student. The git repo root is
`Kutubhane/` (one level below the folder usually opened).

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

## Done this session (12 commits, newest first)

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

1. **Admin dashboard is English-only** — `src/pages/admin/AdminDashboard.jsx` was
   written in English and does NOT use `t()`. ~20 strings to translate to tr/az/en.
   This is the main known translation gap. (User was asked, hadn't decided.)
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
