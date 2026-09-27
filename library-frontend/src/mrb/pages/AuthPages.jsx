// Login and registration in the myredbookshelf visual language.
//
// The handoff supplies no login or join screens (its Join stepper is for the
// public product, which needs the identity work in Phase 3). These are derived
// from the landing page: the same shelf-of-covers panel on the right, the same
// type, colours and radii, over the existing auth endpoints.

import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_ORIGIN } from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, radius, shadow, font, coverColors } from '../theme';
import { LogoMark, Wordmark, Button } from '../components/primitives';

const pub = axios.create({ baseURL: API_ORIGIN + '/api' });

/* ------------------------------------------------------------- shared shell */

function AuthLayout({ title, subtitle, children, footer }) {
  const { t, lang, setLang } = useTranslation();
  const [books, setBooks] = useState([]);

  useEffect(() => {
    pub.get('/public/books', { params: { limit: 6 } })
      .then((r) => setBooks(r.data || [])).catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: slate.bg, fontFamily: font.ui, color: slate.text,
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ borderBottom: '1px solid ' + slate.border, background: '#fff' }}>
        <div style={{
          maxWidth: 1360, margin: '0 auto', padding: '12px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <LogoMark size={34} />
            <Wordmark size={19} />
          </Link>
          <div style={{ display: 'flex', gap: 2 }}>
            {['az', 'tr', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? brand.deep : 'transparent',
                color: lang === l ? '#fff' : slate.dim,
                border: 0, padding: '5px 9px', borderRadius: 7,
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: font.ui,
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{
        flex: 1, maxWidth: 1360, width: '100%', margin: '0 auto', padding: '48px 40px',
        display: 'flex', gap: 56, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 380px', maxWidth: 440, minWidth: 280 }}>
          <h1 style={{
            fontFamily: font.display, fontSize: 40, fontWeight: 700,
            margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1,
          }}>{title}</h1>
          <p style={{ fontSize: 15, color: slate.body, margin: '0 0 26px', lineHeight: 1.6 }}>{subtitle}</p>

          <div style={{
            background: '#fff', border: '1px solid ' + slate.border,
            borderRadius: radius.hero, boxShadow: shadow.card, padding: 26,
          }}>{children}</div>

          {footer && <div style={{ fontSize: 13.5, color: slate.body, marginTop: 18 }}>{footer}</div>}
        </div>

        {/* The landing page's shelf, reused so signing in feels like the same
            product rather than a bare form. */}
        <div style={{ flex: '0 1 420px', minWidth: 280, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'center',
            padding: '30px 22px 24px', background: brand.tint50,
            border: '1px solid ' + brand.tint200, borderRadius: 22, minHeight: 250, width: '100%',
          }}>
            {books.length === 0 && <span style={{ color: slate.muted, fontSize: 13 }}>{t('common.loading')}</span>}
            {books.map((b, i) => {
              const [bg, fg] = coverColors(b.title);
              const h = 150 + ((i * 41) % 52);
              return (
                <div key={b.edition_id} style={{
                  width: 46, height: h, borderRadius: 5, background: bg, color: fg,
                  boxShadow: '0 6px 16px rgba(15,23,42,.14)', display: 'flex', alignItems: 'flex-end',
                  padding: 7, transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`, flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, lineHeight: 1.2, writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)', maxHeight: h - 18, overflow: 'hidden',
                  }}>{b.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, autoFocus, onEnter, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: slate.body, marginBottom: 5 }}>
        {label}
      </span>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        style={{
          width: '100%', border: '1px solid ' + slate.border, borderRadius: radius.input,
          padding: '11px 13px', fontSize: 14.5, fontFamily: font.ui, color: slate.text, outline: 'none',
        }}
      />
      {hint && <span style={{ display: 'block', fontSize: 11.5, color: slate.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: danger.tint, color: danger.text, border: '1px solid ' + danger.border,
      borderRadius: 10, padding: '10px 13px', fontSize: 13, marginBottom: 14, lineHeight: 1.5,
    }}>{children}</div>
  );
}

/* ------------------------------------------------------------------ login */

export function Login() {
  const { t } = useTranslation();
  const { user, login } = useContext(AuthContext);
  const nav = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Redirect once the session actually commits. Doing it here rather than in
  // the submit handler is what fixed "having to click login several times".
  useEffect(() => {
    if (!user) return;
    const home = user.role === 'admin' ? '/admin'
      : user.role === 'manager' ? '/manager'
      : user.role === 'librarian' ? '/librarian'
      : '/app';
    nav(home, { replace: true });
  }, [user, nav]);

  const submit = async () => {
    setErr('');
    if (!email.trim() || !password) { setErr(t('mrb.auth.errBlank')); return; }
    setBusy(true);
    // AuthContext.login resolves with {success, message} rather than throwing,
    // so a failure has to be read off the result.
    const res = await login(email.trim(), password);
    if (!res?.success) {
      setErr(res?.message || t('mrb.auth.errBadLogin'));
      setBusy(false);
    }
    // On success the effect above redirects once the session commits.
  };

  return (
    <AuthLayout
      title={t('mrb.auth.welcomeBack')}
      subtitle={t('mrb.auth.loginSub')}
      footer={<>{t('mrb.auth.noAccount')} <Link to="/register" style={{ fontWeight: 700 }}>{t('mrb.auth.joinNow')}</Link></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <ErrorBox>{err}</ErrorBox>
        <Field label={t('auth.email')} value={email} onChange={setEmail}
          type="email" placeholder="you@school.com" autoFocus onEnter={submit} />
        <Field label={t('auth.password')} value={password} onChange={setPassword}
          type="password" placeholder="••••••••" onEnter={submit} />
        <Button type="submit" disabled={busy} style={{ width: '100%', padding: '12px 16px', fontSize: 15 }}>
          {busy ? t('common.loading') : t('mrb.auth.logIn')}
        </Button>
      </form>
    </AuthLayout>
  );
}

/* --------------------------------------------------------------- register */

export function Register() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [tokenInput, setTokenInput] = useState(token);
  const [checking, setChecking] = useState(!!token);
  const [branch, setBranch] = useState(null);
  const [tokenErr, setTokenErr] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (user) nav('/app', { replace: true }); }, [user, nav]);

  // Validate an invite token and show which branch it belongs to, so a student
  // can see they are joining the right library before they fill anything in.
  const validate = async (value) => {
    const tk = (value ?? tokenInput).trim();
    if (!tk) { setTokenErr(t('mrb.auth.errNeedToken')); return; }
    setChecking(true); setTokenErr('');
    try {
      const res = await pub.get(`/registration-tokens/validate/${encodeURIComponent(tk)}`);
      setBranch(res.data);
    } catch {
      setBranch(null);
      setTokenErr(t('mrb.auth.errBadToken'));
    } finally { setChecking(false); }
  };

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    setChecking(true);
    pub.get(`/registration-tokens/validate/${encodeURIComponent(token)}`)
      .then((res) => { if (alive) setBranch(res.data); })
      .catch(() => { if (alive) setTokenErr(t('mrb.auth.errBadToken')); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [token, t]);

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('mrb.acct.errName')); return; }
    if (!email.trim()) { setErr(t('mrb.acct.errEmail')); return; }
    if (password.length < 8) { setErr(t('mrb.acct.errShortPassword')); return; }
    if (password !== confirm) { setErr(t('mrb.acct.errMismatch')); return; }

    setBusy(true);
    try {
      await pub.post('/register', {
        name: name.trim(), email: email.trim(), password,
        role: 'student', token: tokenInput.trim(),
      });
      setDone(true);
      setTimeout(() => nav('/login', { replace: true }), 1400);
    } catch (e) {
      setErr(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const footer = <>{t('mrb.auth.haveAccount')} <Link to="/login" style={{ fontWeight: 700 }}>{t('mrb.auth.logIn')}</Link></>;

  // Step 1: the invite link. Students join a specific branch, so there is no
  // account to create without one.
  if (!branch) {
    return (
      <AuthLayout title={t('mrb.auth.joinTitle')} subtitle={t('mrb.auth.joinSub')} footer={footer}>
        <ErrorBox>{tokenErr}</ErrorBox>
        <Field
          label={t('mrb.auth.inviteCode')} value={tokenInput} onChange={setTokenInput}
          placeholder="HDF-NZM-2026" autoFocus onEnter={() => validate()}
          hint={t('mrb.auth.inviteHint')}
        />
        <Button onClick={() => validate()} disabled={checking}
          style={{ width: '100%', padding: '12px 16px', fontSize: 15 }}>
          {checking ? t('common.loading') : t('common.continue') === 'common.continue' ? t('mrb.auth.continue') : t('common.continue')}
        </Button>
      </AuthLayout>
    );
  }

  // Step 2: the account itself.
  return (
    <AuthLayout title={t('mrb.auth.joinTitle')} subtitle={t('mrb.auth.joinSub')} footer={footer}>
      <div style={{
        background: brand.tint50, border: '1px solid ' + brand.tint200, borderRadius: 12,
        padding: '11px 14px', marginBottom: 18, fontSize: 13, color: brand.deep,
      }}>
        {t('mrb.auth.joiningBranch', { branch: branch.branch_name || branch.name || branch.label || '—' })}
      </div>

      {done ? (
        <div style={{
          background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0',
          borderRadius: 10, padding: '12px 14px', fontSize: 14,
        }}>{t('mrb.auth.created')}</div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <ErrorBox>{err}</ErrorBox>
          <Field label={t('profile.name')} value={name} onChange={setName}
            placeholder="Aynur Məmmədova" autoFocus />
          <Field label={t('auth.email')} value={email} onChange={setEmail}
            type="email" placeholder="you@school.com" />
          <Field label={t('auth.password')} value={password} onChange={setPassword}
            type="password" placeholder="••••••••" hint={t('mrb.acct.passwordHint')} />
          <Field label={t('mrb.acct.confirmPassword')} value={confirm} onChange={setConfirm}
            type="password" placeholder="••••••••" onEnter={submit} />
          <Button type="submit" disabled={busy} style={{ width: '100%', padding: '12px 16px', fontSize: 15 }}>
            {busy ? t('common.loading') : t('mrb.auth.createAccount')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
