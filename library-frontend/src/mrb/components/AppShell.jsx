// The global shell from the handoff: sticky header (white 94% + backdrop
// blur), 1360px content, logo + school pill + nav + search + language +
// streak + avatar. Nothing here has a fixed width — AZ and TR labels run
// 35–50% longer than English, so everything is padding and wrap.

import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/LanguageContext';
import { AuthContext } from '../../context/AuthContext';
import { brand, slate, danger, font, layout, shadow } from '../theme';
import { LogoMark, Wordmark, BookCover } from './primitives';
import { streakFromLogs } from '../streak';
import AccountMenu from './AccountMenu';
import api from '../../api/axios';

const NAV = [
  { key: 'discover', path: '/app', labelKey: 'mrb.nav.discover' },
  { key: 'catalogue', path: '/app/catalogue', labelKey: 'mrb.nav.catalogue' },
  { key: 'challenges', path: '/app/challenges', labelKey: 'mrb.nav.challenges' },
  { key: 'shelf', path: '/app/shelf', labelKey: 'mrb.nav.shelf' },
];

const QUICK_FILTERS = ['title', 'author', 'genre', 'cefr'];

export default function AppShell({ children }) {
  const { t, lang, setLang } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();

  const [q, setQ] = useState('');
  const [field, setField] = useState('title');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Close the suggestion dropdown on an outside click.
  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Typing shows up to 6 matches. Debounced so a fast typist does not fire a
  // request per keystroke.
  useEffect(() => {
    const term = q.trim();
    const id = setTimeout(async () => {
      if (term.length < 2) { setHits([]); setOpen(false); return; }
      try {
        const res = await api.get('/catalog/browse', { params: { scope: 'library', q: term } });
        setHits((res.data.items || []).slice(0, 6));
        setOpen(true);
      } catch { setHits([]); }
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const goSearch = () => {
    setOpen(false);
    nav(`/app/catalogue?q=${encodeURIComponent(q)}&field=${field}`);
  };

  const activeKey = loc.pathname === '/app' ? 'discover'
    : NAV.find((n) => n.path !== '/app' && loc.pathname.startsWith(n.path))?.key
    || (loc.pathname.startsWith('/app/book') ? 'catalogue' : '');

  return (
    <div style={{ minHeight: '100vh', background: slate.bg, fontFamily: font.ui, color: slate.text }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid ' + slate.border,
      }}>
        <div style={{
          maxWidth: layout.maxWidth, margin: '0 auto', padding: '12px 40px',
          display: 'flex', alignItems: 'center', gap: '12px 24px', flexWrap: 'wrap',
        }}>
          <button onClick={() => nav('/app')} style={{
            display: 'flex', alignItems: 'center', gap: 10, background: 'none',
            border: 0, padding: 0, cursor: 'pointer', flexShrink: 0,
          }}>
            <LogoMark size={36} />
            <Wordmark />
          </button>

          <SchoolPill />

          <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {NAV.map((n) => {
              const active = activeKey === n.key;
              return (
                <button key={n.key} onClick={() => nav(n.path)} style={{
                  background: active ? brand.tint100 : 'transparent',
                  color: active ? brand.deep : slate.body,
                  border: 0, padding: '8px 14px', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: font.ui,
                }}>{t(n.labelKey)}</button>
              );
            })}
          </nav>

          {/* search */}
          <div ref={boxRef} style={{ flex: '1 1 420px', minWidth: 280, position: 'relative', order: 3 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: slate.surface,
              border: '1px solid ' + slate.border, borderRadius: 12, padding: '5px 5px 5px 14px',
            }}>
              <span style={{ color: slate.dim, fontSize: 15 }}>⌕</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') goSearch(); }}
                onFocus={() => hits.length && setOpen(true)}
                placeholder={t('mrb.searchPlaceholder')}
                style={{
                  flex: 1, minWidth: 80, border: 0, background: 'transparent',
                  outline: 'none', fontSize: 14, color: slate.text, padding: '6px 0', fontFamily: font.ui,
                }}
              />
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {QUICK_FILTERS.map((f) => (
                  <button key={f} onClick={() => setField(f)} style={{
                    background: field === f ? '#fff' : 'transparent',
                    color: field === f ? brand.deep : slate.dim,
                    border: field === f ? '1px solid ' + slate.border : '1px solid transparent',
                    padding: '5px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: font.ui, whiteSpace: 'nowrap',
                  }}>{t('mrb.field.' + f)}</button>
                ))}
              </div>
            </div>

            {open && hits.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: '#fff', border: '1px solid ' + slate.border, borderRadius: 12,
                boxShadow: shadow.card, overflow: 'hidden', zIndex: 40,
              }}>
                {hits.map((h) => (
                  <button key={h.edition_id} onClick={() => { setOpen(false); nav(`/app/book/${h.edition_id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      background: 'none', border: 0, borderBottom: '1px solid ' + slate.border,
                      padding: '9px 12px', cursor: 'pointer', fontFamily: font.ui,
                    }}>
                    <div style={{ width: 28, flexShrink: 0 }}>
                      <BookCover title={h.title} src={h.cover_url} radiusPx={4} fontScale={0.4} />
                    </div>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: slate.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                      <span style={{ display: 'block', fontSize: 11, color: slate.muted }}>{h.author || '—'}</span>
                    </span>
                  </button>
                ))}
                <button onClick={goSearch} style={{
                  display: 'block', width: '100%', textAlign: 'left', background: brand.tint50,
                  border: 0, padding: '10px 12px', fontSize: 12, fontWeight: 700,
                  color: brand.deep, cursor: 'pointer', fontFamily: font.ui,
                }}>{t('mrb.seeAllResults')} →</button>
              </div>
            )}
          </div>

          {/* language */}
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {['az', 'tr', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? brand.deep : 'transparent',
                color: lang === l ? '#fff' : slate.dim,
                border: 0, padding: '5px 9px', borderRadius: 7,
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: font.ui,
              }}>{l.toUpperCase()}</button>
            ))}
          </div>

          <StreakPill />

          <AccountMenu />
        </div>
      </header>

      <main style={{ maxWidth: layout.maxWidth, margin: '0 auto', padding: '32px 40px 64px' }}>
        {children}
      </main>
    </div>
  );
}

// "Hədəf · Nizami Branch", or just the school name when it has one branch.
function SchoolPill() {
  const { user } = useContext(AuthContext);
  const [label, setLabel] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/public/stats');
        const school = (res.data.schools || [])[0];
        if (!alive || !school) return;
        setLabel(school.branches > 1 && user?.student?.branch?.name
          ? `${school.name} · ${user.student.branch.name}`
          : school.name);
      } catch { /* the pill is decorative; stay silent */ }
    })();
    return () => { alive = false; };
  }, [user]);

  if (!label) return null;
  return (
    <span style={{
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

// The streak is a social-layer feature with no backend yet. Rather than
// hardcoding the prototype's "12-day streak", this derives a real streak from
// the reading diary the student already keeps, and renders nothing when there
// is no streak to show.
function StreakPill() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
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
