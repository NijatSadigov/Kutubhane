// The staff console shell: a 236px deep-blue sidebar, a white sticky top bar
// with the role chip, and a #F1F5F9 canvas.
//
// Which sections appear depends on the role. A librarian never sees the admin
// sections, and the nav is built from what the signed-in person can actually
// reach rather than greyed-out items.

import { useContext, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, roleOf, SIDEBAR_WIDTH } from '../theme';
import { LogoMark } from '../../mrb/components/primitives';

// [path, label key, roles that see it, badge key from the desk summary]
const SECTIONS = [
  ['desk', 'staff.nav.desk', ['librarian', 'manager', 'admin'], null],
  ['holds', 'staff.nav.holds', ['librarian', 'manager', 'admin'], 'holds_pending'],
  ['inventory', 'staff.nav.inventory', ['librarian', 'manager', 'admin'], null],
  ['requests', 'staff.nav.requests', ['librarian', 'manager', 'admin'], 'requests_pending'],
  ['settings', 'staff.nav.settings', ['librarian', 'manager', 'admin'], null],
];

export default function StaffShell({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const [badges, setBadges] = useState({});

  const role = user?.role || 'librarian';
  const theme = roleOf(role);

  useEffect(() => {
    let alive = true;
    api.get('/desk/summary')
      .then((r) => { if (alive) setBadges(r.data || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const name = user?.librarian?.name || user?.manager?.name || user?.email || '';
  const visible = SECTIONS.filter(([, , roles]) => roles.includes(role));

  return (
    <div style={{
      minHeight: '100vh', background: shell.canvas, display: 'flex',
      fontFamily: font.ui, fontSize: font.base, color: ink.text,
    }}>
      {/* ------------------------------------------------------ sidebar */}
      <aside style={{
        width: SIDEBAR_WIDTH, flexShrink: 0, background: shell.bg, color: '#fff',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{
          padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,.1)',
        }}>
          <LogoMark size={30} />
          <span style={{ lineHeight: 1.2 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>myredbookshelf</span>
            <span style={{ display: 'block', fontSize: 11, color: shell.navText }}>{t('staff.console')}</span>
          </span>
        </div>

        <nav style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {visible.map(([path, key, , badgeKey]) => {
            const n = badgeKey ? badges[badgeKey] : 0;
            return (
              <NavLink key={path} to={`/staff/${path}`} end={path === 'desk'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: isActive ? shell.navActive : 'transparent',
                  color: isActive ? '#fff' : shell.navText,
                  borderRadius: radius.control, padding: '9px 10px',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                })}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: theme.accent,
                }} />
                <span style={{ flex: 1 }}>{t(key)}</span>
                {n > 0 && (
                  <span style={{
                    background: '#F2545B', color: '#fff', borderRadius: 999,
                    padding: '0 7px', fontSize: 11, fontWeight: 800,
                  }}>{n}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button onClick={() => nav('/app')} style={{
            width: '100%', textAlign: 'left', background: 'transparent', color: shell.navText,
            border: '1px solid rgba(255,255,255,.18)', borderRadius: radius.control,
            padding: '9px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: font.ui,
          }}>{t('staff.backToReader')}</button>
        </div>
      </aside>

      {/* ------------------------------------------------------- content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          position: 'sticky', top: 0, zIndex: 20, background: '#fff',
          borderBottom: '1px solid ' + shell.border,
          padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{
            background: theme.chip[0], color: theme.chip[1], borderRadius: 999,
            padding: '4px 11px', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>{t('role.' + role) === 'role.' + role ? theme.label : t('role.' + role)}</span>

          <span style={{ fontSize: 13, fontWeight: 600, color: ink.strong }}>{name}</span>
          {user?.librarian?.branch?.name && (
            <span style={{ fontSize: 12, color: ink.dim }}>· {user.librarian.branch.name}</span>
          )}

          <button onClick={async () => { await logout(); nav('/', { replace: true }); }} style={{
            marginLeft: 'auto', background: 'transparent', border: '1px solid ' + shell.control,
            borderRadius: radius.control, padding: '7px 13px', fontSize: 12.5,
            fontWeight: 700, cursor: 'pointer', color: ink.body, fontFamily: font.ui,
          }}>{t('mrb.acct.logout')}</button>
        </header>

        <main style={{ padding: 24, flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
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

export function PageTitle({ children, sub, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap', marginBottom: 18,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{children}</h1>
        {sub && <div style={{ fontSize: 12.5, color: ink.dim, marginTop: 4 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({ label, value, note, noteColor }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11, color: ink.dim, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: noteColor || ink.muted, fontWeight: 600 }}>{note}</div>}
    </div>
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
      padding: '0 16px', minHeight: 44, borderBottom: '1px solid ' + shell.border,
      background: selected ? shell.rowSelected : 'transparent',
      cursor: onClick ? 'pointer' : 'default', fontSize: 13,
    }}>{children}</div>
  );
}

export function Btn({ kind = 'primary', children, style, ...rest }) {
  const kinds = {
    primary: { background: '#1B9DD9', color: '#fff', border: '1px solid #1B9DD9' },
    secondary: { background: '#fff', color: ink.strong, border: '1px solid ' + shell.control },
    danger: { background: '#fff', color: '#B4232A', border: '1px solid #FFD6CF' },
  };
  return (
    <button {...rest} style={{
      ...kinds[kind], borderRadius: radius.control, padding: '8px 13px',
      fontSize: 12.5, fontWeight: 700, cursor: rest.disabled ? 'not-allowed' : 'pointer',
      opacity: rest.disabled ? 0.55 : 1, fontFamily: font.ui, whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}
