// The staff console, at /staff.
//
// It lives alongside the existing role dashboards rather than replacing them,
// so a librarian keeps a working tool while the console is finished. The old
// dashboards stay reachable at /librarian, /manager and /admin.
//
// Two levels of navigation: /staff/<domain>/<screen>. The rail picks the domain,
// the top bar picks the screen. `nav.js` is the table both are built from, and
// LEGACY_REDIRECTS keeps every path the flat console used working — a bookmark
// on /staff/holds still lands on the hold queue.

import { Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import StaffShell, { Card, PageIntro } from './components/StaffShell';
import CirculationDesk from './pages/CirculationDesk';
import Reservations from './pages/Reservations';
import Loans from './pages/Loans';
import Inventory from './pages/Inventory';
import Members from './pages/Members';
import MemberInvites from './pages/MemberInvites';
import ComingSoon from './pages/ComingSoon';
import { SettingsLists, SettingsStatuses, SettingsLimits } from './pages/SettingsScreens';
import { MyTickets, NewTicket, TicketInbox } from './pages/Support';
import BookRequestsQueue from '../components/BookRequestsQueue';
import { LEGACY_REDIRECTS } from './nav';
import { useTranslation } from '../i18n/LanguageContext';

export default function StaffApp() {
  return (
    <StaffShell>
      <Routes>
        <Route index element={<Navigate to="/staff/library/desk" replace />} />

        {/* Kitabxana — the daily circulation work, plus the catalogue. */}
        <Route path="library">
          <Route index element={<Navigate to="/staff/library/desk" replace />} />
          <Route path="desk" element={<CirculationDesk />} />
          <Route path="catalogue" element={<Inventory />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="loans" element={<Loans />} />
          <Route path="requests" element={<RequestsPage />} />
        </Route>

        {/* Üzvlər */}
        <Route path="members">
          <Route index element={<Members />} />
          <Route path="invites" element={<MemberInvites />} />
        </Route>

        {/* Kitabxana ayarları */}
        <Route path="settings">
          <Route index element={<Navigate to="/staff/settings/lists" replace />} />
          <Route path="lists" element={<SettingsLists />} />
          <Route path="statuses" element={<SettingsStatuses />} />
          <Route path="limits" element={<SettingsLimits />} />
        </Route>

        {/* Texniki dəstək */}
        <Route path="support">
          <Route index element={<MyTickets />} />
          <Route path="new" element={<NewTicket />} />
          <Route path="inbox" element={<TicketInbox />} />
        </Route>

        {/* The three domains the buyer asked to see in the rail before they
            exist. Each says what will live there. */}
        <Route path="textbooks" element={
          <ComingSoon
            titleKey="staff.soon.textbooks.title"
            bodyKey="staff.soon.textbooks.body"
            blockedKey="staff.soon.textbooks.blocked"
          />
        } />
        <Route path="projects" element={
          <ComingSoon
            titleKey="staff.soon.projects.title"
            bodyKey="staff.soon.projects.body"
          />
        } />
        <Route path="textbook-settings" element={
          <ComingSoon
            titleKey="staff.soon.textbookSettings.title"
            bodyKey="staff.soon.textbookSettings.body"
            blockedKey="staff.soon.textbookSettings.blocked"
          />
        } />

        {/* Whatever the flat console used to answer. */}
        <Route path=":legacy" element={<LegacyRedirect />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    </StaffShell>
  );
}

// A path from the flat console — /staff/holds, /staff/inventory — forwards to
// its new home, query string and all, so the top bar's catalogue search link
// and any bookmark keep working.
function LegacyRedirect() {
  const { legacy } = useParams();
  const [params] = useSearchParams();
  const target = LEGACY_REDIRECTS[legacy];
  if (!target) return <Navigate to="/staff" replace />;
  const q = params.toString();
  return <Navigate to={`/staff/${target}${q ? '?' + q : ''}`} replace />;
}

// The book-request queue already exists and works. It is carried across rather
// than rebuilt, so the migration does not drop it — see the parity list in
// ROADMAP.md.
function RequestsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageIntro>{t('staff.requests.sub')}</PageIntro>
      <Card><BookRequestsQueue /></Card>
    </>
  );
}
