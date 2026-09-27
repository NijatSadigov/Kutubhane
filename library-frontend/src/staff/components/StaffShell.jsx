// The staff console shell, transcribed from `Staff Console.dc.html` and
// `Staff Design System.dc.html`.
//
// A 236px #082F49 sidebar holding the inverted wordmark, the school card, the
// role's workspace nav with live count badges and the signed-in user at the
// foot; a sticky white top bar carrying the crumb, the 19px/800 page title,
// the catalogue search and the role chip; and a #F1F5F9 canvas at 24/28.
//
// Which sections appear depends on the role. A librarian never sees the admin
// sections, and the nav is built from what the signed-in person can actually
// reach rather than greyed-out items.

import { useContext, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, roleOf, SIDEBAR_WIDTH } from '../theme';
import { useSchoolLabel } from '../../mrb/useSchoolLabel';
import '../../mrb/responsive.css';

// [path, label key, roles that see it, badge key from the desk summary]
const SECTIONS = [
  ['desk', 'staff.nav.desk', ['librarian', 'manager', 'admin'], null],
  ['holds', 'staff.nav.holds', ['librarian', 'manager', 'admin'], 'holds_pending'],
  ['inventory', 'staff.nav.inventory', ['librarian', 'manager', 'admin'], null],
  ['members', 'staff.nav.members', ['librarian', 'manager', 'admin'], null],
  ['requests', 'staff.nav.requests', ['librarian', 'manager', 'admin'], 'requests_pending'],
  ['settings', 'staff.nav.settings', ['librarian', 'manager', 'admin'], null],
];

export default function StaffShell({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const loc = useLocation();
  const [badges, setBadges] = useState({});
  const [q, setQ] = useState('');
  const school = useSchoolLabel();

  const role = user?.role || 'librarian';
  const theme = roleOf(role);
  const roleLabel = t('role.' + role) === 'role.' + role ? theme.label : t('role.' + role);

  useEffect(() => {
    let alive = true;
    api.get('/desk/summary')
      .then((r) => { if (alive) setBadges(r.data || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [loc.pathname]);

  const name = user?.librarian?.name || user?.manager?.name || user?.email || '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '·';
  const visible = SECTIONS.filter(([, , roles]) => roles.includes(role));

  // The top bar names the page. Deriving it from the route keeps the title and
  // the nav from ever disagreeing.
  const current = visible.find(([path]) => loc.pathname === `/staff/${path}`)
    || (loc.pathname === '/staff' ? visible[0] : null);
  const pageTitle = current ? t(current[1]) : t('staff.console');

  return (
    <div className="staff-shell" style={{
      minHeight: '100vh', background: shell.canvas, display: 'flex',
      fontFamily: font.ui, fontSize: font.base, color: ink.text,
    }}>
      {/* ------------------------------------------------------ sidebar */}
      <aside className="staff-sidebar" style={{
        width: SIDEBAR_WIDTH, flexShrink: 0, background: shell.bg, color: shell.navText,
        display: 'flex', flexDirection: 'column', gap: 20,
        position: 'sticky', top: 0, height: '100vh', padding: '18px 12px', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
          <InvertedMark />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: '#fff' }}>
              my<span style={{ color: '#FF8A8F' }}>red</span>bookshelf
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#7DD3FC',
            }}>{t('staff.console')}</span>
          </div>
        </div>

        <div className="staff-sidebar-school" style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: radius.alert, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#7DD3FC',
          }}>{t('staff.school')}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {school.label ? school.label.split(' · ')[0] : '—'}
          </span>
          <span style={{ fontSize: 12, color: shell.navText }}>{school.short || ''}</span>
        </div>

        <nav className="staff-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="staff-sidebar-label" style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#7DD3FC', padding: '0 10px 6px',
          }}>{t('staff.workspace', { role: roleLabel })}</span>

          {visible.map(([path, key, , badgeKey]) => {
            const n = badgeKey ? badges[badgeKey] : 0;
            return (
              <NavLink key={path} to={`/staff/${path}`} end={path === 'desk'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isActive ? shell.navActive : 'transparent',
                  color: isActive ? '#fff' : shell.navText,
                  border: 0, borderRadius: radius.control, padding: '9px 10px',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'left',
                })}>
                {({ isActive }) => (
                  <>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? '#7DD3FC' : 'rgba(186,230,253,0.3)',
                    }} />
                    <span style={{ flex: 1 }}>{t(key)}</span>
                    {n > 0 && (
                      <span style={{
                        background: '#F2545B', color: '#fff', borderRadius: 999,
                        padding: '0 7px', fontSize: 11, fontWeight: 800,
                      }}>{n}</span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="staff-sidebar-foot" style={{
          marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
          padding: 10, borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div className="staff-sidebar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: '50%', background: theme.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{name}</div>
              <div style={{ fontSize: 11, color: shell.navText }}>{roleLabel}</div>
            </div>
          </div>
          {/* The design draws the user block alone; the console still needs a
              way out of it, so the two links sit under the block rather than
              displacing anything. */}
          <div style={{ display: 'flex', gap: 12, paddingLeft: 42, flexWrap: 'wrap' }}>
            <SideLink onClick={() => nav('/app')}>{t('staff.backToReader')}</SideLink>
            {/* The old dashboard is still there while this console beds in.
                Remove the link — and the dashboard — once nobody reaches for
                it. See TODO.md. */}
            <SideLink onClick={() => nav('/' + (role === 'librarian' ? 'librarian' : role))}>
              {t('staff.classicDashboard')}
            </SideLink>
            <SideLink onClick={async () => { await logout(); nav('/', { replace: true }); }}>
              {t('mrb.acct.logout')}
            </SideLink>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------- content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="staff-topbar" style={{
          position: 'sticky', top: 0, zIndex: 20, background: '#fff',
          borderBottom: '1px solid ' + shell.border, padding: '12px 28px',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: 11, color: ink.dim, fontWeight: 600 }}>
              {[roleLabel, school.label].filter(Boolean).join(' · ')}
            </div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {pageTitle}
            </h1>
          </div>

          <form
            className="staff-search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) nav(`/staff/inventory?q=${encodeURIComponent(q.trim())}`);
            }}
            style={{
              flex: '0 1 360px', display: 'flex', alignItems: 'center', gap: 8,
              background: shell.canvas, border: '1px solid ' + shell.border,
              borderRadius: radius.control, padding: '7px 10px',
            }}
          >
            <span style={{ color: ink.dim }}>⌕</span>
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={t('staff.searchPlaceholder')}
              style={{
                border: 0, background: 'transparent', outline: 'none',
                fontSize: 13, flex: 1, minWidth: 0, fontFamily: 'inherit', color: ink.text,
              }}
            />
          </form>

          <span style={{
            background: theme.chip[0], color: theme.chip[1], borderRadius: 999,
            padding: '4px 12px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
          }}>{t('staff.roleMode', { role: roleLabel })}</span>
        </header>

        <main className="staff-main" style={{
          padding: '24px 28px 110px', display: 'flex', flexDirection: 'column',
          gap: 20, minWidth: 0,
        }}>{children}</main>
      </div>
    </div>
  );
}

function SideLink({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 0, padding: 0, color: '#7DD3FC',
      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      textDecoration: 'underline',
    }}>{children}</button>
  );
}

// The sidebar mark is the reader app's logo inverted: a white tile with the
// spines in brand blues, as the console source draws it.
function InvertedMark() {
  return (
    <span style={{
      width: 30, height: 30, borderRadius: 8, background: '#fff',
      position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'block',
    }}>
      <span style={{ position: 'absolute', left: 4.8, right: 4.8, bottom: 6.6, height: 1.5, background: '#075985' }} />
      <span style={{ position: 'absolute', left: 6.6, bottom: 8.1, width: 3.9, height: 12.6, background: '#7DD3FC', borderRadius: 1 }} />
      <span style={{ position: 'absolute', left: 11.7, bottom: 8.1, width: 3.9, height: 15.6, background: '#1B9DD9', borderRadius: 1 }} />
      <span style={{
        position: 'absolute', left: 16.8, bottom: 8.1, width: 4.2, height: 13.8,
        background: '#F2545B', borderRadius: 1,
        transform: 'rotate(16deg)', transformOrigin: 'bottom right',
      }} />
    </span>
  );
}

/* ---------------------------------------------------------- primitives */

export function Card({ children, style, padding = 16 }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, padding, ...style,
    }}>{children}</div>
  );
}

// A section heading inside the canvas — 15px/700, per the type scale. The page
// title itself lives in the top bar.
export function SectionTitle({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
    }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{children}</h2>
      {right}
    </div>
  );
}

export function PageIntro({ children }) {
  if (!children) return null;
  return <div style={{ fontSize: 13, color: ink.dim }}>{children}</div>;
}

// 12px label, 24px/800 figure, 12px delta — the design's KPI card.
export function Kpi({ label, value, note, noteColor }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border, borderRadius: radius.card,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 12, color: ink.dim, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: ink.text }}>
        {value}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: noteColor || ink.muted, minHeight: 18 }}>
        {note || ''}
      </span>
    </div>
  );
}

export function KpiRow({ children }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12,
    }}>{children}</div>
  );
}

export function Pill({ colors, children }) {
  return (
    <span style={{
      background: colors[0], color: colors[1], borderRadius: 999,
      padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// Alerts: colour and words, radius 10, 10px 12px, weight 600.
export function Alert({ tone = 'problem', children }) {
  const tones = {
    problem: ['#FFF1EE', '#FFD6CF', '#B4232A'],
    action: ['#FEF3C7', '#FDE68A', '#92400E'],
    approval: ['#EDE9FE', '#EDE9FE', '#5B21B6'],
    done: ['#DCFCE7', '#DCFCE7', '#166534'],
  };
  const [bg, border, fg] = tones[tone] || tones.problem;
  return (
    <div style={{
      background: bg, border: '1px solid ' + border, color: fg,
      borderRadius: radius.alert, padding: '10px 12px', fontSize: 13, fontWeight: 600,
    }}>{children}</div>
  );
}

export function Label({ children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: ink.dim,
    }}>{children}</span>
  );
}

export function Input({ big, style, ...rest }) {
  return (
    <input {...rest} style={{
      width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
      padding: big ? '12px 14px' : '8px 10px', fontSize: big ? 15 : 13,
      outline: 'none', background: '#fff', fontFamily: 'inherit', color: ink.text, ...style,
    }} />
  );
}

// A chip in a row of choices — 5px 12px, 12/600, pill.
export function Chip({ on, children, ...rest }) {
  return (
    <button {...rest} style={{
      background: on ? '#1B9DD9' : '#fff',
      color: on ? '#fff' : ink.strong,
      border: '1px solid ' + (on ? '#1B9DD9' : shell.control),
      borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
    }}>{children}</button>
  );
}

// A table whose header is 11px caps on #F8FAFC and whose rows are 44px.
export function Table({ columns, head = [], children, empty }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: columns, gap: 12, padding: '10px 16px',
        background: shell.headerBg, borderBottom: '1px solid ' + shell.border,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: ink.dim,
      }}>
        {head.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {children}
      {empty && (
        <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim }}>{empty}</div>
      )}
    </div>
  );
}

export function Row({ columns, children, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: columns, gap: 12, alignItems: 'center',
      padding: '0 16px', minHeight: 44, borderBottom: '1px solid ' + shell.rowLine,
      background: selected ? shell.rowSelected : 'transparent',
      cursor: onClick ? 'pointer' : 'default', fontSize: 13,
    }}>{children}</div>
  );
}

export function Btn({ kind = 'primary', children, style, ...rest }) {
  const kinds = {
    primary: { background: '#1B9DD9', color: '#fff', border: '1px solid #1B9DD9', fontWeight: 700 },
    secondary: { background: '#fff', color: ink.text, border: '1px solid ' + shell.control, fontWeight: 600 },
    danger: { background: '#fff', color: '#B4232A', border: '1px solid #FFD6CF', fontWeight: 600 },
    dangerSolid: { background: '#D93A41', color: '#fff', border: '1px solid #D93A41', fontWeight: 700 },
  };
  return (
    <button {...rest} style={{
      ...kinds[kind], borderRadius: radius.control, padding: '7px 12px',
      fontSize: 13, cursor: rest.disabled ? 'not-allowed' : 'pointer',
      opacity: rest.disabled ? 0.55 : 1, fontFamily: font.ui, whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}

// A book spine, as the console draws one wherever a cover is too small to read.
export function Spine({ src, seed, w = 24, h = 36, radius: r = 3 }) {
  const bg = spineColor(seed || '');
  if (src) {
    return <img src={src} alt="" style={{
      width: w, height: h, borderRadius: r, objectFit: 'cover', flexShrink: 0,
      boxShadow: '0 1px 3px rgba(15,23,42,0.2)', display: 'block',
    }} />;
  }
  return <span style={{
    width: w, height: h, borderRadius: r, background: bg, flexShrink: 0,
    boxShadow: '0 1px 3px rgba(15,23,42,0.2)', display: 'block',
  }} />;
}

const SPINE_COLORS = [
  '#7C2D12', '#EA580C', '#0C4A6E', '#1E293B', '#B91C1C', '#14532D',
  '#991B1B', '#312E81', '#365314', '#9D174D', '#57534E', '#15803D',
];

function spineColor(seed) {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

export function Avatar({ initials, size = 32, bg = '#0D9488' }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.375), fontWeight: 700, flexShrink: 0,
    }}>{initials || '·'}</span>
  );
}

export function Mono({ children, style }) {
  return (
    <span style={{
      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: ink.dim, ...style,
    }}>{children}</span>
  );
}
