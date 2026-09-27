// S-extra · Members — the branch's readers, and how they get an account.
//
// The design has no librarian members screen: S8 "Branches & users" belongs to
// the school admin and covers every role across every branch. But the working
// system has always given a librarian a class list, a reader's statistics and
// the branch invite links students register with, and losing those in the
// migration would take away the only way to enrol a class.
//
// So this borrows S8's shape — a KPI strip, a searchable 44px table, a side
// panel for the selected row — scoped to one branch and one role.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, pill, overdueColors } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Avatar, Mono, Alert } from '../components/StaffShell';
import { Dialog } from './InventoryDialogs';
import { fmtDate } from '../../i18n/dates';

const COLS = 'minmax(0,1.8fr) 90px 90px 110px 120px';

export default function Members() {
  const { t } = useTranslation();
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [invites, setInvites] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    api.get('/class-list').then((r) => setStudents(r.data || [])).catch(() => {});
  }, [reloadKey]);

  const term = q.trim().toLowerCase();
  const shown = term
    ? students.filter((s) =>
      (s.name || '').toLowerCase().includes(term)
      || String(s.grade || '').includes(term)
      || (s.class_group || '').toLowerCase().includes(term))
    : students;

  const totals = useMemo(() => {
    let out = 0, late = 0, withBooks = 0;
    students.forEach((s) => {
      const open = (s.loans || []).filter((l) => !l.return_date);
      out += open.length;
      if (open.length) withBooks++;
      if (open.some((l) => l.due_date && new Date(l.due_date) < new Date())) late++;
    });
    return { members: students.length, out, late, withBooks };
  }, [students]);

  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.mem.kpiMembers')} value={totals.members} />
        <Kpi label={t('staff.mem.kpiWithBooks')} value={totals.withBooks} />
        <Kpi label={t('staff.mem.kpiOut')} value={totals.out} />
        <Kpi
          label={t('staff.mem.kpiLate')} value={totals.late}
          note={totals.late ? t('staff.mem.lateNote') : ''} noteColor="#B4232A"
        />
      </KpiRow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('staff.mem.search')}
          style={{ flex: '1 1 260px', width: 'auto' }}
        />
        <Btn onClick={() => setInvites(true)} style={{ padding: '9px 14px' }}>
          {t('staff.mem.inviteLinks')}
        </Btn>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{
          flex: '999 1 520px', minWidth: 0, background: '#fff',
          border: '1px solid ' + shell.border, borderRadius: radius.card, overflowX: 'auto',
        }}>
          <div style={{ minWidth: 560 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
              padding: '10px 16px', background: shell.headerBg,
              borderBottom: '1px solid ' + shell.border,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: ink.dim,
            }}>
              <span>{t('staff.col.student')}</span>
              <span>{t('staff.mem.grade')}</span>
              <span>{t('staff.mem.onLoan')}</span>
              <span>{t('staff.mem.limit')}</span>
              <span>{t('staff.col.status')}</span>
            </div>

            {shown.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim }}>
                {t('staff.mem.none')}
              </div>
            )}

            {shown.map((s) => {
              const open = (s.loans || []).filter((l) => !l.return_date);
              const worst = open.reduce((n, l) => {
                if (!l.due_date) return n;
                const d = Math.floor((new Date() - new Date(l.due_date)) / 86400000);
                return d > n ? d : n;
              }, 0);
              const on = selected?.user_id === s.user_id;
              return (
                <div
                  key={s.user_id} onClick={() => setSelected(on ? null : s)}
                  style={{
                    display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
                    padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine,
                    fontSize: 13, minHeight: 44, cursor: 'pointer',
                    background: on ? shell.rowSelected : 'transparent',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar initials={initialsOf(s.name)} size={28} />
                    <strong style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.name}</strong>
                  </span>
                  <span style={{ color: ink.body }}>{gradeOf(s) || '—'}</span>
                  <span style={{ fontWeight: 700 }}>{open.length}</span>
                  <span style={{ color: ink.body }}>
                    {s.borrow_limit ? t('staff.mem.custom', { n: s.borrow_limit }) : t('staff.mem.default')}
                  </span>
                  {worst > 0
                    ? <Pill colors={overdueColors(worst)}>{t('staff.desk.overdueDays', { n: worst })}</Pill>
                    : <Pill colors={pill(open.length ? 'out' : 'available')}>
                      {open.length ? t('staff.pill.onLoan') : t('staff.mem.clear')}
                    </Pill>}
                </div>
              );
            })}
          </div>
        </div>

        {selected && (
          <ReaderPanel
            student={selected} t={t} say={say} reload={reload}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {invites && <InviteLinks t={t} say={say} onClose={() => setInvites(false)} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#fff', padding: '11px 18px', borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 100,
        }}>{toast}</div>
      )}
    </>
  );
}

/* ------------------------------------------------------- reader panel */

// The side panel from S8: who they are, what they have out, what they have
// read, and the one setting a librarian may change — their borrow limit.
function ReaderPanel({ student, t, say, reload, onClose }) {
  const [stats, setStats] = useState(null);
  const [holds, setHolds] = useState(null);
  const [limit, setLimit] = useState(student.borrow_limit ? String(student.borrow_limit) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLimit(student.borrow_limit ? String(student.borrow_limit) : '');
    api.get(`/student/${student.user_id}/stats`).then((r) => setStats(r.data)).catch(() => setStats(null));
    api.get(`/student/${student.user_id}/holds`).then((r) => setHolds(r.data)).catch(() => setHolds(null));
  }, [student]);

  const saveLimit = async () => {
    setBusy(true);
    try {
      await api.put(`/student/${student.user_id}/limit`, {
        limit: limit.trim() === '' ? null : Number(limit),
      });
      say(t('staff.mem.limitSaved'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const open = (student.loans || []).filter((l) => !l.return_date);

  return (
    <aside style={{
      flex: '1 1 300px', background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid ' + shell.border,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Avatar initials={initialsOf(student.name)} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{student.name}</div>
          <div style={{ fontSize: 12, color: ink.dim }}>{gradeOf(student)}</div>
        </div>
        <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}>✕</Btn>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label={t('staff.mem.booksRead')} value={stats?.total_books_read ?? '—'} />
          <Stat label={t('staff.mem.favGenre')} value={stats?.favorite_genre || '—'} />
        </div>

        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: ink.dim, marginBottom: 6,
          }}>{t('staff.mem.currentLoans')}</div>
          {open.length === 0 ? (
            <div style={{ fontSize: 13, color: ink.dim }}>{t('staff.mem.noLoans')}</div>
          ) : open.map((l) => {
            const late = l.due_date
              ? Math.floor((new Date() - new Date(l.due_date)) / 86400000) : 0;
            return (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 8, padding: '6px 0', fontSize: 13,
                borderBottom: '1px solid ' + shell.rowLine,
              }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.book_copy?.book?.title || t('staff.desk.aBook')}
                </span>
                <Pill colors={late > 0 ? overdueColors(late) : pill('out')}>
                  {late > 0
                    ? t('staff.desk.overdueDays', { n: late })
                    : t('staff.desk.dueOn', { date: fmtDate(l.due_date) })}
                </Pill>
              </div>
            );
          })}
        </div>

        {/* The borrow limit: a branch default, with an optional per-student
            override. The design has no UI for it anywhere; without this a
            librarian cannot raise a limit for a reader who needs more. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: ink.dim,
          }}>{t('staff.mem.limit')}</div>
          <div style={{ fontSize: 12, color: ink.dim }}>
            {holds ? t('staff.desk.holdsNow', { n: holds.count, limit: holds.limit ?? '—' }) : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              type="number" min={0} value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t('staff.mem.useDefault')}
              style={{ width: 120 }}
            />
            <Btn onClick={saveLimit} disabled={busy}>{t('common.save')}</Btn>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{
      flex: '1 1 120px', background: shell.headerBg, border: '1px solid ' + shell.border,
      borderRadius: radius.control, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11, color: ink.dim, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------- invite links */

// How a student gets an account: the librarian issues a branch code and gives
// it to a class. The design's Admin has an Invite modal, but it is school-wide
// and role-based; this is the branch-scoped one the system already had.
function InviteLinks({ t, say, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);

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
    <Dialog title={t('staff.mem.inviteLinks')} onClose={onClose} wide t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8, lineHeight: 1.5 }}>
        {t('staff.mem.inviteHint')}
      </div>

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

      {tokens.length === 0 ? (
        <Alert tone="action">{t('staff.mem.noInvites')}</Alert>
      ) : (
        <div style={{
          border: '1px solid ' + shell.border, borderRadius: radius.control, overflow: 'hidden',
        }}>
          {tokens.map((tok) => {
            const dead = tok.revoked || new Date(tok.expires_at) < new Date();
            return (
              <div key={tok.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderBottom: '1px solid ' + shell.rowLine, fontSize: 13,
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
    </Dialog>
  );
}

/* --------------------------------------------------------------- misc */

function initialsOf(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '·';
}

function gradeOf(s) {
  if (!s?.grade) return '';
  return `${s.grade}${s.class_group ? '-' + s.class_group : ''}`;
}
