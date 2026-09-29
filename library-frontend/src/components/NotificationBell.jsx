// The bell, shared by the reader app and the staff console.
//
// One implementation, two palettes. A notification must read and behave the
// same wherever you are signed in, and the two shells have very different
// colours, so the behaviour lives here and the colours arrive as `palette`.
//
// It is deliberately *not* a nav entry. `staff/nav.js` is the one table the
// rail, the top bar, the routes and the page titles are built from, and the
// bell is none of those — it sits in the header and links to screens that
// table already defines.
//
// Polling, not sockets: this codebase has no background scheduler and sweeps
// lazily on read (see `sweepExpiredReservations`), so the bell follows the same
// idiom. Fetch on mount, on navigation, and on a slow timer while the tab is
// actually being looked at — which is all "somebody has to refresh" needed.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useTranslation } from '../i18n/LanguageContext';
import { renderNotifications, notificationTime } from '../notifications';

// Slow enough not to be chatty, quick enough that a reply feels live.
const POLL_MS = 60000;

export default function NotificationBell({ palette, role }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  const load = useCallback(() => {
    api.get('/notifications')
      .then((r) => {
        setItems(r.data?.items || []);
        setUnread(Number(r.data?.unread || 0));
      })
      // A bell that cannot load is not worth an error on screen; it simply
      // shows nothing, the way the desk summary's badges do.
      .catch(() => {});
  }, []);

  // On mount and on every navigation, matching how the console already
  // refreshes its nav badges.
  useEffect(() => { load(); }, [load, loc.pathname]);

  // And on a timer, but only while the tab is visible — polling a hidden tab
  // is work nobody is waiting for.
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  // Close on a click anywhere else, and on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const markAll = () => {
    api.post('/notifications/seen', {})
      .then(() => { setUnread(0); setItems((prev) => prev.map((n) => ({ ...n, read: true }))); })
      .catch(() => {});
  };

  // Opening the panel is reading them: that is what the dot meant.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAll();
  };

  const rows = renderNotifications(t, items, role);

  return (
    <div ref={wrap} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={t('notif.open')}
        aria-expanded={open}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 999, cursor: 'pointer',
          background: open ? palette.hoverBg : 'transparent',
          border: '1px solid ' + palette.border,
          color: palette.text, fontSize: 16, lineHeight: 1, padding: 0,
        }}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17,
            padding: '0 4px', borderRadius: 999, background: palette.dot,
            color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid ' + palette.dotRing,
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
          width: 320, maxWidth: 'calc(100vw - 32px)',
          background: '#fff', border: '1px solid ' + palette.panelBorder,
          borderRadius: palette.radius, boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderBottom: '1px solid ' + palette.panelBorder,
          }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: palette.panelText }}>
              {t('notif.title')}
            </span>
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: '18px 14px', fontSize: 13, color: palette.dim }}>
              {t('notif.empty')}
            </div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {rows.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); if (n.to) nav(n.to); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: n.to ? 'pointer' : 'default',
                    padding: '10px 14px', border: 0,
                    borderBottom: '1px solid ' + palette.panelBorder,
                    background: n.read ? '#fff' : palette.unreadBg,
                    font: 'inherit', color: palette.panelText,
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.4 }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: palette.dim, marginTop: 3 }}>
                    {notificationTime(t, n.at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
