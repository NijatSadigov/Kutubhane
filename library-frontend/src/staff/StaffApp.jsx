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

import { useContext } from 'react';
import { Routes, Route, Navigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import StaffShell, { PageIntro } from './components/StaffShell';
import CirculationDesk from './pages/CirculationDesk';
import Reservations from './pages/Reservations';
import Loans from './pages/Loans';
import Inventory from './pages/Inventory';
import Members from './pages/Members';
import MemberInvites from './pages/MemberInvites';
import ComingSoon from './pages/ComingSoon';
import { SettingsLists, SettingsStatuses, SettingsLimits } from './pages/SettingsScreens';
import { MyTickets, NewTicket, TicketInbox } from './pages/Support';
import Textbooks from './pages/Textbooks';
import TextbookRequests from './pages/TextbookRequests';
import NewTextbookRequest from './pages/NewTextbookRequest';
import Classrooms from './pages/Classrooms';
import {
  SettingsClassrooms, SettingsTeachers, SettingsSubjects, SettingsYears,
} from './pages/DerslikSettings';
import BookRequestsQueue from '../components/BookRequestsQueue';
import { LEGACY_REDIRECTS, visibleDomains, domainPath, locate } from './nav';
import { useTranslation } from '../i18n/LanguageContext';

export default function StaffApp() {
  return (
    <StaffShell>
      <OnlyIfVisible>
      <Routes>
        <Route index element={<StaffLanding />} />

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

        {/* Dərslik sistemi — the teacher's side and the library's, on one
            set of routes. The nav decides which screens a role is shown. */}
        <Route path="textbooks">
          <Route index element={<TextbookLanding />} />
          <Route path="classes" element={<Classrooms />} />
          <Route path="new" element={<NewTextbookRequest />} />
          <Route path="requests" element={<TextbookRequests />} />
          <Route path="catalogue" element={<Textbooks />} />
          <Route path="classrooms" element={<Classrooms />} />
        </Route>
        <Route path="projects" element={
          <ComingSoon
            titleKey="staff.soon.projects.title"
            bodyKey="staff.soon.projects.body"
          />
        } />
        {/* Dərslik sistemi ayarları — the school's own structure. */}
        <Route path="textbook-settings">
          <Route index element={<Navigate to="/staff/textbook-settings/classrooms" replace />} />
          <Route path="classrooms" element={<SettingsClassrooms />} />
          <Route path="teachers" element={<SettingsTeachers />} />
          <Route path="subjects" element={<SettingsSubjects />} />
          <Route path="years" element={<SettingsYears />} />
        </Route>

        {/* Whatever the flat console used to answer. */}
        <Route path=":legacy" element={<LegacyRedirect />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
      </OnlyIfVisible>
    </StaffShell>
  );
}

// Where /staff itself lands depends on the role, and the nav table is the only
// thing that knows: a librarian starts at the desk, a teacher at their classes,
// a manager at the dərslik settings, because that is the first domain each can
// actually reach. Hardcoding the desk sent a manager to a screen whose every
// number was an em-dash.
function StaffLanding() {
  const { user } = useContext(AuthContext);
  const role = user?.role || 'librarian';
  const first = visibleDomains(role)[0];
  return <Navigate to={first ? domainPath(first, role) : '/app'} replace />;
}

// A screen the nav does not offer this role is not one to render either — the
// rail hiding it while the route still drew it is how a manager ended up on a
// broken desk.
function OnlyIfVisible({ children }) {
  const { user } = useContext(AuthContext);
  const loc = useLocation();
  const role = user?.role || 'librarian';

  const rest = loc.pathname.replace(/^\/staff\/?/, '').replace(/\/+$/, '');
  // The console root and the old flat paths have no domain of their own — the
  // index and the redirect below handle them, so they pass straight through.
  if (rest === '' || LEGACY_REDIRECTS[rest]) return children;

  const { domain, screen } = locate(loc.pathname, role);
  if (!domain || (!domain.soon && !screen)) return <StaffLanding />;
  return children;
}

// Where /staff/textbooks lands depends on who is asking: a teacher starts with
// their own classes, the library with the queue waiting on it.
function TextbookLanding() {
  const { user } = useContext(AuthContext);
  const to = user?.role === 'teacher'
    ? '/staff/textbooks/classes'
    : '/staff/textbooks/requests';
  return <Navigate to={to} replace />;
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

// The book-request queue is carried across from the old dashboard rather than
// rebuilt — see the parity list in ROADMAP.md.
//
// It needs `listUrl` and `updateBase`: it is shared with the manager's
// school-wide view, which reads different paths. The console rendered it with
// neither until 2026-09-27, so it called api.get(undefined), swallowed the
// failure and drew its own empty state — indistinguishable from a queue with
// nothing in it, while the nav badge beside it counted four. The component also
// brings its own padding and card, so it is not wrapped in another one.
function RequestsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageIntro>{t('staff.requests.sub')}</PageIntro>
      <BookRequestsQueue listUrl="/book-requests" updateBase="/book-requests" />
    </>
  );
}
