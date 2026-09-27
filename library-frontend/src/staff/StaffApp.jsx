// The staff console, at /staff.
//
// It lives alongside the existing role dashboards rather than replacing them,
// so a librarian keeps a working tool while the console is finished. The old
// dashboards stay reachable at /librarian, /manager and /admin.

import { Routes, Route, Navigate } from 'react-router-dom';
import StaffShell, { Card, PageIntro } from './components/StaffShell';
import CirculationDesk from './pages/CirculationDesk';
import HoldsOverdue from './pages/HoldsOverdue';
import Inventory from './pages/Inventory';
import Members from './pages/Members';
import BookRequestsQueue from '../components/BookRequestsQueue';
import SettingsPanel from '../pages/librarian/SettingsPanel';
import { useTranslation } from '../i18n/LanguageContext';

export default function StaffApp() {
  return (
    <StaffShell>
      <Routes>
        <Route index element={<CirculationDesk />} />
        <Route path="desk" element={<CirculationDesk />} />
        <Route path="holds" element={<HoldsOverdue />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="members" element={<Members />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    </StaffShell>
  );
}

// The book-request queue and the category settings already exist and work.
// They are carried across rather than rebuilt, so the migration does not drop
// them — both are on the parity list in ROADMAP.md.
function RequestsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageIntro>{t('staff.requests.sub')}</PageIntro>
      <Card><BookRequestsQueue /></Card>
    </>
  );
}

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageIntro>{t('staff.settings.sub')}</PageIntro>
      <Card><SettingsPanel /></Card>
    </>
  );
}
