// The avatar menu in the header: who you are, a link to your shelf, edit
// profile, and log out. The first version of this shell had no way to sign out
// at all.

import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, radius, shadow, font } from '../theme';
import { Button } from './primitives';

export default function AccountMenu() {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const name = user?.student?.name || user?.librarian?.name || user?.manager?.name || user?.email || '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const role = user?.role || '';

  const doLogout = async () => {
    setOpen(false);
    try { await logout(); } catch { /* clearing local state is enough */ }
    nav('/', { replace: true });
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open} title={name}
        style={{
          width: 36, height: 36, borderRadius: '50%', background: brand.deep, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, border: 0, cursor: 'pointer',
          boxShadow: '0 0 0 3px ' + brand.tint300, fontFamily: font.ui,
        }}
      >{initials || '·'}</button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 230,
          background: '#fff', border: '1px solid ' + slate.border, borderRadius: 14,
          boxShadow: shadow.card, overflow: 'hidden', zIndex: 50,
        }}>
          <div style={{ padding: '13px 15px', borderBottom: '1px solid ' + slate.border }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 11.5, color: slate.muted, marginTop: 2 }}>{user?.email}</div>
            {role && (
              <span style={{
                display: 'inline-block', marginTop: 7, background: brand.tint100, color: brand.deep,
                borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 800,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>{t('role.' + role) === 'role.' + role ? role : t('role.' + role)}</span>
            )}
          </div>

          <MenuItem onClick={() => { setOpen(false); nav('/app/shelf'); }}>{t('mrb.nav.shelf')}</MenuItem>
          <MenuItem onClick={() => { setOpen(false); setEditing(true); }}>{t('mrb.acct.editProfile')}</MenuItem>

          {/* Staff keep a way back to their console until the Staff Console
              screens replace it. */}
          {role && role !== 'student' && (
            <MenuItem onClick={() => { setOpen(false); nav('/' + role); }}>
              {t('mrb.acct.staffConsole')}
            </MenuItem>
          )}

          <MenuItem onClick={doLogout} danger>{t('nav.logout') === 'nav.logout' ? t('mrb.acct.logout') : t('nav.logout')}</MenuItem>
        </div>
      )}

      {editing && <ProfileDialog onClose={() => setEditing(false)} />}
    </div>
  );
}

function MenuItem({ children, onClick, danger: isDanger }) {
  return (
    <button role="menuitem" onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', background: 'none',
      border: 0, borderTop: '1px solid ' + slate.border, padding: '11px 15px',
      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font.ui,
      color: isDanger ? danger.text : slate.strong,
    }}>{children}</button>
  );
}

// Edit profile: name, email and an optional new password. Posts to the
// existing PUT /profile endpoint.
function ProfileDialog({ onClose }) {
  const { t } = useTranslation();
  const { user, refreshUser } = useContext(AuthContext);

  const currentName = user?.student?.name || user?.librarian?.name || user?.manager?.name || '';
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('mrb.acct.errName')); return; }
    if (!email.trim()) { setErr(t('mrb.acct.errEmail')); return; }
    if (password && password.length < 8) { setErr(t('mrb.acct.errShortPassword')); return; }
    if (password && password !== confirm) { setErr(t('mrb.acct.errMismatch')); return; }

    setBusy(true);
    try {
      const body = { name: name.trim(), email: email.trim() };
      if (password) body.password = password;
      await api.put('/profile', body);
      setSaved(true);
      if (refreshUser) await refreshUser();
      setTimeout(onClose, 900);
    } catch (e) {
      setErr(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 95,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 18, boxShadow: shadow.modal,
        width: 'min(460px, 100%)', padding: 26, fontFamily: font.ui,
      }}>
        <h2 style={{ fontFamily: font.display, fontSize: 24, fontWeight: 700, margin: '0 0 18px' }}>
          {t('mrb.acct.editProfile')}
        </h2>

        <Field label={t('profile.name')} value={name} onChange={setName} />
        <Field label={t('auth.email')} value={email} onChange={setEmail} type="email" />
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: slate.muted, margin: '18px 0 10px',
        }}>{t('mrb.acct.changePassword')}</div>
        <Field label={t('mrb.acct.newPassword')} value={password} onChange={setPassword} type="password"
          hint={t('mrb.acct.passwordHint')} />
        <Field label={t('mrb.acct.confirmPassword')} value={confirm} onChange={setConfirm} type="password" />

        {err && (
          <div style={{
            background: danger.tint, color: danger.text, border: '1px solid ' + danger.border,
            borderRadius: 10, padding: '9px 12px', fontSize: 13, marginTop: 4,
          }}>{err}</div>
        )}
        {saved && (
          <div style={{
            background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0',
            borderRadius: 10, padding: '9px 12px', fontSize: 13, marginTop: 4,
          }}>{t('mrb.acct.saved')}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Button kind="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={busy}>{t('common.save')}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: slate.body, marginBottom: 5 }}>
        {label}
      </span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', border: '1px solid ' + slate.border, borderRadius: radius.input,
          padding: '10px 12px', fontSize: 14, fontFamily: font.ui, color: slate.text, outline: 'none',
        }}
      />
      {hint && <span style={{ display: 'block', fontSize: 11, color: slate.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}
