// Dəvət linkləri — how a student gets an account.
//
// This was a modal on the Members screen. The Üzvlər domain needs a second
// screen for its top bar, and issuing codes to a class is a job of its own
// rather than an aside to reading the class list, so it becomes a screen: the
// same form and the same token list, laid out in a Card instead of a Dialog.
//
// The design's Admin has an Invite modal, but it is school-wide and role-based;
// this is the branch-scoped one the system already had.

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, pill } from '../theme';
import { Card, Pill, Btn, Input, Mono, Alert, PageIntro } from '../components/StaffShell';
import { Toast } from './deskShared';

export default function MemberInvites() {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState([]);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(() => {
    api.get('/registration-tokens').then((r) => setTokens(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/registration-tokens', { label: label.trim(), days: Number(days) || 30 });
      setLabel('');
      say(t('staff.mem.inviteCreated'));
      load();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const revoke = async (id) => {
    try { await api.delete(`/registration-tokens/${id}`); say(t('staff.mem.inviteRevoked')); load(); }
    catch { say(t('msg.opFailed')); }
  };

  const copy = async (tok) => {
    try {
      await navigator.clipboard.writeText(tok);
      say(t('staff.mem.copied'));
    } catch { say(tok); }
  };

  return (
    <>
      <PageIntro>{t('staff.mem.inviteHint')}</PageIntro>

      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{
            flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4,
            fontSize: 12, fontWeight: 600, color: ink.strong,
          }}>
            {t('staff.mem.inviteLabel')}
            <Input value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder={t('staff.mem.inviteLabelHint')} />
          </label>
          <label style={{
            width: 120, display: 'flex', flexDirection: 'column', gap: 4,
            fontSize: 12, fontWeight: 600, color: ink.strong,
          }}>
            {t('staff.mem.inviteDays')}
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <Btn onClick={create} disabled={busy}>{t('staff.mem.inviteCreate')}</Btn>
        </div>
      </Card>

      {tokens.length === 0 ? (
        <Alert tone="action">{t('staff.mem.noInvites')}</Alert>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid ' + shell.border,
          borderRadius: radius.card, overflow: 'hidden',
        }}>
          {tokens.map((tok) => {
            const dead = tok.revoked || new Date(tok.expires_at) < new Date();
            return (
              <div key={tok.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: '1px solid ' + shell.rowLine, fontSize: 13, minHeight: 44,
                opacity: dead ? 0.55 : 1, flexWrap: 'wrap',
              }}>
                <Mono style={{ color: ink.text, fontSize: 13 }}>{tok.token}</Mono>
                <span style={{ flex: 1, minWidth: 0, color: ink.dim }}>
                  {tok.label || t('staff.mem.untitled')}
                </span>
                <span style={{ color: ink.dim, fontSize: 12 }}>
                  {t('staff.mem.usedN', { n: tok.use_count || 0 })} · {fmtDate(tok.expires_at)}
                </span>
                {dead
                  ? <Pill colors={pill('lost')}>{t('staff.mem.expired')}</Pill>
                  : <Pill colors={pill('active')}>{t('staff.mem.active')}</Pill>}
                <Btn kind="secondary" onClick={() => copy(tok.token)} style={{ padding: '5px 10px', fontSize: 12 }}>
                  {t('staff.mem.copy')}
                </Btn>
                {!dead && (
                  <Btn kind="danger" onClick={() => revoke(tok.id)} style={{ padding: '5px 10px', fontSize: 12 }}>
                    {t('staff.mem.revoke')}
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Toast>{toast}</Toast>
    </>
  );
}
