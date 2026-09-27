// The signed-in shell: the shared site header with a member tail, and the
// 1360px canvas the prototype gives every app screen.
//
// The header itself lives in SiteHeader — the design uses one header for
// members and guests, and the landing page renders the same component.

import { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/LanguageContext';
import { AuthContext } from '../../context/AuthContext';
import { brand, slate, danger, font, layout } from '../theme';
import { streakFromLogs } from '../streak';
import AccountMenu from './AccountMenu';
import SiteHeader from './SiteHeader';
import { useSchoolLabel } from '../useSchoolLabel';
import api from '../../api/axios';
import '../responsive.css';

export default function AppShell({ children }) {
  const loc = useLocation();

  return (
    <div style={{ minHeight: '100vh', background: slate.bg, fontFamily: font.ui, color: slate.text }}>
      <SiteHeader
        schoolPill={<SchoolPill />}
        tail={<><StreakPill /><AccountMenu /></>}
      />

      {/* Every app screen in the prototype uses the same 1360px main at
          32px 40px 96px; Book Detail alone starts 4px higher. */}
      <main style={{
        maxWidth: layout.maxWidth, margin: '0 auto',
        padding: (loc.pathname.startsWith('/app/book') ? '28px' : '32px')
          + ' var(--mrb-gutter) 96px',
      }}>
        {children}
      </main>
    </div>
  );
}

// "Hədəf · Nizami Branch", or just the school name when it has one branch.
function SchoolPill() {
  const { label } = useSchoolLabel();
  if (!label) return null;
  return (
    <span className="mrb-school-pill" style={{
      display: 'flex', alignItems: 'center', gap: 6, background: slate.surface,
      border: '1px solid ' + slate.border, borderRadius: 999, padding: '4px 12px 4px 4px',
      fontSize: 12, fontWeight: 600, color: slate.strong, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: brand.deep, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
      }}>{label[0]}</span>
      {label}
    </span>
  );
}

// The streak is derived from the reading diary the student already keeps, and
// renders nothing when there is no streak to show.
function StreakPill() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/student/${user.id}/reading`);
        const logs = res.data?.logs || [];
        if (!alive) return;
        setDays(streakFromLogs(logs));
      } catch { /* not a student, or no diary — no pill */ }
    })();
    return () => { alive = false; };
  }, [user]);

  if (!days) return null;
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 6, background: danger.tint,
      color: danger.text, border: '1px solid ' + danger.border, borderRadius: 999,
      padding: '5px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
    }}>🔥 {t('mrb.streak', { n: days })}</span>
  );
}
