# Handoff: myredbookshelf.com — School Reading Community

## Overview
A desktop-first social reading platform for middle/high-school students ("Letterboxd for books in schools"), built on top of an existing school library circulation system. Students keep a reading diary, log pages, review books, take verification quizzes in reading challenges, collect badges, and compete in branch / inter-school leaderboards. Multi-tenant: many schools, each with 1–N branches; schools can form **alliances** that agree to share limited student data for joint challenges and school battles.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, not production code. Recreate them in the target codebase's environment (React/Next.js + Tailwind recommended if none exists — the design is Tailwind-native: slate/sky palettes, 1px `slate-200` borders, soft shadows). All mock data lives in the `<script data-dc-script>` block of `myredbookshelf.dc.html` (constants `BOOKS`, `POSTS`, `CHALLENGES`, `QUIZ`, `BADGES`, `BRANCHES`, `SCHOOLS`, `BATTLES`, `PAST`, …) — use it as the shape of the API contract.

To view: open `myredbookshelf.dc.html` in a browser (needs `support.js` beside it). Tweak props (top of script tag `data-props`): `startScreen`, `schoolBranches` (1/3/5), `hideSpoilers`, `showReport`.

## Fidelity
**High-fidelity.** Final colors, type, spacing, and interactions. Recreate pixel-accurately. Book covers are typographic placeholders (colored block + title/author) — replace with real cover images.

## Global Shell
- **Sticky header** (white 94% + backdrop blur, bottom border `#E2E8F0`), content max-width **1360px**, padding `12px 40px`, flex-wrap, gap `12px 24px`.
  - Logo (see Logo.dc.html) + wordmark `my`**`red`**`bookshelf` `.com` — Source Serif 4 700 20px, "red" `#DC3B42`, ".com" `#94A3B8` 15px.
  - School pill: "Hədəf · Nizami Branch" (or "Hədəf School" when 1 branch).
  - Nav: Discover · Catalogue · Challenges · My Shelf. Active: bg `#E0F2FE`, text `#075985`; 14px/600, radius 8.
  - Search (bg `#F1F5F9`, radius 12) with segmented quick-filter Title / Author / Genre / CEFR. Typing shows a dropdown of matches (max 6) + "See all results in the catalogue →". On the Catalogue screen the header search filters the grid directly.
  - Language switcher AZ | TR | EN (active bg `#075985` white). Only nav/headings/primary buttons are translated in the mock (`T` dictionary) — implement full i18n; AZ/TR run 35–50% longer, so **no fixed widths** on buttons/pills/tabs (all use padding + wrap).
  - Streak pill "🔥 12-day streak" (bg `#FFF1EE`, text `#B4232A`, border `#FFD6CF`) + avatar (36px, ring `#7DD3FC`).
- Toast: fixed bottom-center, `#0F172A`, radius 12, auto-hide 2.2s.
- Responsiveness: all multi-column sections use flex-wrap / `auto-fit minmax()` so they stack gracefully below ~1000px.

## Screens

### 1. Discover (Community Hub)
- Greeting (Source Serif 38/600) + dynamic league sentence.
- **Hall of Fame** grid `repeat(auto-fit, minmax(340px,1fr))`, gap 20, cards radius 18, padding 24:
  - *Bookworm of the Month*: avatar, name + grade/branch, big number (Serif 44/700 `#075985`) "1,420 pages", favourite recent read with tilted cover.
  - *Top Reviewer of the Month*: quote (Serif 16), upvotes / reviews / replies stats.
  - *League widget* (bg `#075985`, white text): Week/Month toggle; scope toggle **Our branches / Alliance schools** (hidden when school has 1 branch → schools only). Ranked rows with bars, metric = **avg pages per student** (fair across sizes). User's row highlighted (bar `#7DD3FC`). Lead sentence + "Your contribution" + link to Challenges.
- **Trending this week**: horizontal scroll carousel (← → buttons scroll 600px), cards 180px: cover (2:3, radius 8), CEFR badge (colored per level), rank badge, stars + rating + log count, Quick reserve button (toggles Reserved ✓ / Join waitlist when 0 copies).
- **Activity feed** (left, flex 999 1 560px) + sidebar (320px):
  - Post card: avatar 44, name/handle/grade·branch, verb + book title (Serif 18), half-star rating, excerpt; spoiler posts show striped "Spoiler warning — click to show" block; like (♥ count, active bg `#FFE4E6` text `#D93A41`), replies, **⚑ Report** (→ "Sent to teacher", toast). Cover thumb 76px right.
  - Sidebar: Top readers leaderboard (you highlighted `#F0F9FF`), active-challenge teaser with progress.

### 2. Catalogue
- **Scope switch** (segmented, with counts): **My shelf** (reading/read/want-to-read; covers show status tag) · **My library** (school holdings, default) · **Global** (adds titles not held → "Request purchase").
- Left filter panel (flex 0 1 260px): search, **"Available at my library" toggle switch**, CEFR chips (A2/B1/B2/C1), Genre checkboxes with color dot + count, Edition language chips (AZ/TR/EN/RU), Length chips (<200 / 200–350 / 350+).
- Results: active filter chips (removable) + Clear all + Sort select (Most borrowed / Highest rated / Newest / Title A–Z, `localeCompare(...,'az')`). Grid `auto-fill minmax(180px,1fr)`. Card: cover, title, author·pages, genre (colored), stars, availability dot + label, reserve/waitlist/request button. Empty state with Clear all.

### 3. Book Detail
- Breadcrumb Catalogue / Genre / Title.
- Left column (320px): large cover, availability pill (sky when available, coral when all on loan, slate when not held), other-branch note, specs table (Author, ISBN, Pages, CEFR, Genre, Publisher, Published).
- Right: CEFR + genre chips, title (Serif 52/700), author·year, synopsis (Serif 18/1.65). Action bar: **Log to diary** (primary → Logged ✓), **Write review** (smooth-scrolls to composer, focuses textarea), **Reserve copy** / Join waitlist / Request purchase.
- Rating card: average (Serif 56) + stars + count; 5→1 histogram bars.
- Review composer: **half-star picker** (each star has left/right hit areas), textarea, "Contains spoilers" checkbox, moderation note, Post (disabled until rating + text).
- Review feed: helpful ♥ vote, replies toggle, threaded replies (indented, left border `#E0F2FE`), **Teacher · Moderator** badge (bg `#075985`), reply input, Report.

### 4. Challenges
- Challenge cards (auto-fit 300px): organizer pill (school = sky tint; alliance = `#075985`), status (days left, coral when urgent / "Starts 1 Oct"), book cover strip, your verified progress.
- Selected challenge detail: title, description, dates/participants/time left; upcoming → **Join challenge**. "How it works": **Read +10 · Pass quiz +15 · Review +5**.
- Challenge books: per-book step pills (Read / Quiz x/3 / Review) + single next action: Mark as read → Take quiz → Write review → Completed.
- **Quiz modal**: 3 multiple-choice questions, progress bar, Next/Finish; ≥2/3 = verified (+15, marks read), else "Try again". Best score kept.
- Aside: Frontrunners (top 5, gold/silver/bronze rank chips, you appended if outside), Branch or School standings, Prizes.
- **School battles**: head-to-head cards (live / finished) with split bar + metric. Alliance card: members, what IS shared (first name + initial, grade, pages, quiz scores) / NEVER shared (full names, loan history, private notes).
- Past challenges & champions: winner card (amber ring), stats, prize, top branch/school.

### 5. My Shelf (Profile)
- Banner: avatar 104, name (Serif 32), handle, school·branch / grade / level pills, **pinned badges** (3), bio, Edit profile. Stats row (auto-fit 200px): Books completed, Pages conquered (live), Avg speed, Current streak.
- **Badges section**: grid `auto-fill minmax(160px,1fr)`; 10 badges, each: medallion 84px (outer ring color + inner fill, clip-path shape: circle/hex/shield/octagon/squircle), glyph or custom logo (`img` field → background-image), tier ribbon (Gold/Silver/Bronze), name, description, earned date or progress bar (locked = grayscale 50% opacity). "Next up" hint.
- Tabs (pill, with counts): **Currently Reading** (loan cards: progress bar "Page 140 of 328 — 43%", due pill — sky / amber ≤3 days / coral overdue, **+ Log pages** inline input → updates progress + total pages), **Diary & History** (grouped by month, day, cover, rating, liked heart), **Want to Read** (grid, reserve/remove), **My Reviews & Notes** (private notes on warm tint `#FFFDF5`).
- Aside: Genre mix (stacked bar + legend), yearly goal.

## Accounts, personas & privacy (added)
- **Personas:** Guest (logged out), Reader (individual 16+), Teen (individual 13–15, parent-approved), Student (partner school), Librarian, Teacher, School admin. In the prototype a floating **"Prototype · view as"** bar (bottom-left) switches persona; prop `persona` sets the default.
- **Masking rule:** outside a student's own school, every school student and every under-16 user is shown as initials — "Aysel M." → **A\*\*\* M\*\*\*** — with sub-label "Student · partner school" / "Teen reader"; handles hidden. Applies to feed, reviews, replies, leaderboards, past winners (see `mask()` in the script).
- **Guest:** sees landing, catalogue (Global only), book pages, ratings and **adult public reviews only**; student/teen reviews are replaced by "N more reviews visible to signed-in members". All actions (log, review, reserve, join challenge/club) route to Join.
- **Teen:** private profile, no DMs, teen/school clubs only (adult clubs show "18+ only"), banner explaining protections.
- **Reader vs Student:** no school pill or branch league; catalogue scopes My shelf / Global; reserve becomes "+ Want to read"; challenges list shows open global challenges; loans shown as "Self-tracked".

## Public & individual screens (added)
- **00 Landing** (guest home): hero (H1 Serif 66/700, "shelf" in #DC3B42), shelf-of-covers visual with floating diary + challenge cards; "What the community is reading"; How it works (3 cards); fresh public reviews; open challenge + book clubs; **For schools** band (bg #075985, anchor id for-schools); Libraries & bookstores **coming soon** with email notify; footer.
- **06 Join**: stepper. Account type (Reader 13+ / Student with school code / Staff request) → About you (name, email or school code, birth year, password; under 13 blocked) → **Parent consent** if under 16 (parent email → pending → approved) → Interests (genre + language chips) → Done → enters app as reader / teen / student. Staff path: request form → "request sent".
- **07 Book clubs**: filters (All, My clubs, Teens 13–17, Adults 18+, School clubs for students); club list + detail (current book, 4-week schedule, next meeting, threads with new-thread input, members). Audience colours: Adults #EDE9FE/#5B21B6, Teens #FEF3C7/#92400E, School #E0F2FE/#075985.
- **08 Libraries & bookstores (coming soon)**: notify form, map placeholder with pins, partner list (Public library teal, Bookstore rose, Private library violet), "Become a partner" CTA.
- **Reader home**: "Your week" mini bar chart, open-challenge card, next club meeting; sidebar "Readers to follow" + "Borrow or buy nearby (coming soon)"; follow buttons on public posts.

## Staff console (added) — Staff Console.dc.html + Staff Design System.dc.html
**Known issue:** Staff Console.dc.html freezes the browser tab when opened as a prototype (a runtime issue in the prototype, not the design). Its template and logic are complete — read the source as the spec. The main app links to it instead of embedding it.

Shell: 236px sidebar #082F49, active nav #0C4A6E, white sticky top bar with role chip, canvas #F1F5F9, 13px base, 12px card radius, 44px table rows. Role accents: Librarian teal #0D9488, Teacher amber #D97706, Admin violet #7C3AED.
- **Librarian** — *Circulation desk*: Check out (find student → loans, limit 5, overdue warning → scan books → loan period 7/14/21 → confirm); Check in (scan → overdue + hold alerts → condition → confirm); "Today at the desk" log + KPIs. *Holds & overdue*: holds queue (mark ready → picked up / cancel); overdue (bulk select, remind, tell teacher, mark lost; days amber → orange → coral). *Catalogue & inventory*: branch filter, availability bars, expandable copies (barcode, branch, condition, status); Add title modal with ISBN lookup + copies per branch.
- **Teacher** — *Class dashboard*: class switch, KPIs, 8-week chart, roster with streak/challenge/flags, student side panel. *Challenge builder*: Details & audience → Books → Quiz editor (mark correct answer, pass mark) → Points & prizes → Review with student preview → Publish (alliance audience needs admin approval). *Moderation queue*: reasons Spoiler / Unkind / Personal info / Off-topic; auto-detected phone numbers; actions Keep / Add spoiler tag / Hide / Hide & warn; optional moderator reply; open / resolved.
- **Admin** — *Analytics*: range, KPIs, weekly active %, pages by branch & grade, genre mix, most borrowed. *Branches & users*: branch cards, role tabs, search, suspend / reactivate / resend, Invite modal, CSV import. *Alliances & data sharing*: active alliance card, invitation accept/decline, per-field sharing toggles; **never shared (locked):** full name, date of birth, loan history, private notes; audit log.

## Design Tokens
**Brand**: primary `#1B9DD9`, hover `#1580B5`, deep `#075985`, tints `#F0F9FF` `#E0F2FE` `#BAE6FD` `#7DD3FC`. Brand red (logo) `#F2545B`, wordmark red `#DC3B42`.
**Neutrals (slate)**: bg `#F8FAFC`, `#F1F5F9`, border `#E2E8F0`, `#CBD5E1`, `#94A3B8`, `#64748B`, `#475569`, `#334155`, text `#0F172A`.
**Danger/coral**: `#F2545B`, text `#B4232A`/`#D93A41`, tint `#FFF1EE`, border `#FFD6CF`. Warning: `#FEF3C7`/`#92400E`.
**Genre colors** [fill, tint, text]: Science Fiction `#7C3AED #EDE9FE #5B21B6` · World Classics `#BE123C #FFE4E6 #9F1239` · History `#D97706 #FEF3C7 #92400E` · Fantasy `#16A34A #DCFCE7 #166534` · Fiction `#0D9488 #CCFBF1 #115E59` · Azerbaijani Literature `#EA580C #FFEDD5 #9A3412` · History & Epic `#A16207 #FEF9C3 #854D0E` · Philosophy `#4F46E5 #E0E7FF #3730A3`.
**CEFR** [bg, text]: A2 `#DCFCE7 #166534` · B1 `#CCFBF1 #115E59` · B2 `#FEF3C7 #92400E` · C1 `#FFE4E6 #9F1239`.
**Type**: UI — Noto Sans 400/500/600/700/800 (full Azerbaijani/Turkish coverage: ə ğ ı ö ş ü ç). Display/book titles — Source Serif 4 500–700. Scale: 11 (labels, uppercase +0.08–0.1em), 12, 13, 14 (body UI), 15–16 (body/reading), 18–21 (card titles), 26 (section H2), 32–38 (page H1), 44–56 (hero numbers).
**Radius**: 6–8 (buttons/chips), 10–12 (inputs, small cards), 14–16 (cards), 18–20 (hero cards), 999 (pills).
**Shadows**: card `0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)`; cover `0 6px 16px rgba(15,23,42,.14)` + `inset 4px 0 0 rgba(255,255,255,.14)` (spine); modal `0 24px 64px rgba(15,23,42,.3)`.
**Spacing**: page padding 32/40px; section gap 36–40; card padding 18–28; grid gaps 14–28.
**Stars**: half-star via two stacked "★★★★★" layers; top layer width = rating/5 × 100%, color `#1B9DD9`, base `#CBD5E1`.

## State / Data Model (suggested)
- Tenancy: `School { id, name, branches[] }`, `Alliance { id, name, schools[], sharedFields[] }`.
- `Book { id, title, author, year, pages, cefr, genre, publisher, isbn, lang, synopsis, rating, ratingsCount }`, `Holding { bookId, branchId, copies, available }` (absent = global-only).
- `Loan { bookId, userId, since, due, currentPage }`, `PageLog { userId, bookId, pages, date }` (drives streaks, leaderboards).
- `DiaryEntry`, `Wishlist`, `Review { rating (0.5 steps), text, spoiler, votes, replies[], flagged }`, `Note { private }`.
- `Challenge { org (school|alliance), books[], start, end, prizes[], points rules }`, `Quiz { bookId, questions[{q, options[], answer}] }`, `ChallengeProgress { read, quizScore, reviewed }`.
- `Battle { schoolA, schoolB, metric, start, end }`, `Badge { id, name, desc, shape, colors, tier, img?, criteria }`.
- Moderation: Report → teacher queue; teacher replies get Moderator badge. Leaderboards across schools must only expose alliance-shared fields.

## Assets
No external images. Covers are placeholders (replace with real covers). Logo is built from CSS shapes (see Logo.dc.html) — export to SVG in the codebase. Badge glyphs are Unicode placeholders; custom badge logos will be supplied.

## Files
- `Staff Console.dc.html` — librarian / teacher / admin console (prop `role`). Source is the spec (see known issue).
- `Staff Design System.dc.html` — staff tokens, status pills, controls, shell, table, alerts.
- `myredbookshelf.dc.html` — full interactive prototype (all 5 screens, mock data + logic in the script block).
- `Logo.dc.html` — logo lockups, dark version, app icon, small sizes, colors.
- `support.js` — runtime needed to open the prototypes locally.
