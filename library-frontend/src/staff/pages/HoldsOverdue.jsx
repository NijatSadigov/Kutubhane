// S2 Holds & overdue — transcribed from `Staff Console.dc.html`.
//
// Outlined tab buttons with count pills; the holds queue as a 760px-wide
// table (book with its spine, student, placed, queue position, a stacked
// status pill and pickup line, right-aligned actions); and the overdue list
// as an 820px table with an 18px checkbox, the day count in bold on the
// amber → orange → coral ramp, and a bulk bar above it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font, danger, overdueColors, pill } from '../theme';
import { Pill, Btn, Input, Spine, Mono, Alert } from '../components/StaffShell';
import { Dialog } from './InventoryDialogs';

const HOLD_COLS = 'minmax(0,2fr) minmax(0,1.6fr) 90px 90px 150px 220px';
const OD_COLS = '28px minmax(0,1.6fr) minmax(0,2fr) 90px 110px 150px';
// All open loans, with the one action the design never gave the desk: change
// a due date. A librarian has always been able to, and there is no other way
// to extend a loan for a reader who asks.
const LOAN_COLS = 'minmax(0,1.6fr) minmax(0,2fr) 120px 110px 120px';

export default function HoldsOverdue() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('holds');
  const [reservations, setReservations] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loans, setLoans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState({});
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(0);

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async () => {
    const [rs, ds, ls] = await Promise.allSettled([
      api.get('/reservations'),
      api.get('/desk/summary'),
      api.get('/loans'),
    ]);
    if (rs.status === 'fulfilled') setReservations(rs.value.data || []);
    if (ds.status === 'fulfilled') setOverdue(ds.value.data?.overdue_rows || []);
    if (ls.status === 'fulfilled') setLoans(ls.value.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = useMemo(() => reservations.filter(
    (r) => r.status?.code === 'PENDING' || r.status?.code === 'APPROVED',
  ), [reservations]);

  // Where each hold sits in the queue for its own title, oldest first — the
  // design's "Queue" column.
  const queuePos = useMemo(() => {
    const byBook = {};
    [...open]
      .sort((a, b) => new Date(a.request_date || 0) - new Date(b.request_date || 0))
      .forEach((r) => {
        const key = r.book_copy?.book_id ?? 'x';
        byBook[key] = (byBook[key] || 0) + 1;
        r._pos = byBook[key];
      });
    const m = {};
    open.forEach((r) => { m[r.id] = r._pos; });
    return m;
  }, [open]);

  const act = async (r, what) => {
    setBusy(r.id);
    try {
      if (what === 'issue') {
        await api.post(`/reservation/${r.id}/issue`);
        say(t('staff.holds.issued'));
      } else {
        // The endpoint expects the capitalised words, not a verb.
        await api.post(`/reservation/${r.id}`, {
          action: what === 'approve' ? 'Approved' : 'Rejected',
        });
        say(what === 'approve' ? t('staff.holds.approved') : t('staff.holds.rejected'));
      }
      load();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(0); }
  };

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  return (
    <>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[['holds', t('staff.holds.queue'), open.length],
          ['overdue', t('staff.kpi.overdue'), overdue.length],
          ['loans', t('staff.holds.allLoans'), loans.length]]
          .map(([k, label, n]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: radius.control, padding: '8px 14px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>
                {label}
                <span style={{
                  background: on ? 'rgba(255,255,255,0.2)' : shell.canvas,
                  color: on ? '#fff' : ink.body,
                  borderRadius: 999, padding: '0 7px', fontSize: 11,
                }}>{n}</span>
              </button>
            );
          })}
      </div>

      {tab === 'loans' ? (
        <ScrollTable
          min={720} columns={LOAN_COLS}
          head={[t('staff.col.student'), t('staff.col.book'), t('staff.col.due'),
            t('staff.col.copy'), t('staff.col.actions')]}
          empty={loans.length === 0 ? t('staff.holds.noLoans') : null}
        >
          {loans.map((l) => {
            const late = l.due_date
              ? Math.floor((new Date() - new Date(l.due_date)) / 86400000) : 0;
            return (
              <div key={l.id} style={rowStyle(LOAN_COLS)}>
                <span style={{ minWidth: 0 }}>
                  <strong>{l.student?.name || '—'}</strong>
                  {l.student?.grade ? <span style={{ color: ink.dim }}> · {l.student.grade}</span> : null}
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.book_copy?.book?.title || '—'}
                </span>
                {late > 0
                  ? <Pill colors={overdueColors(late)}>{t('staff.desk.overdueDays', { n: late })}</Pill>
                  : <span style={{ color: ink.body }}>{fmtDate(l.due_date)}</span>}
                <Mono>{l.book_copy?.tracking_number}</Mono>
                <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn kind="secondary" onClick={() => setEditing(l)}>{t('staff.holds.changeDue')}</Btn>
                </span>
              </div>
            );
          })}
        </ScrollTable>
      ) : tab === 'holds' ? (
        <ScrollTable
          min={760} columns={HOLD_COLS}
          head={[t('staff.col.book'), t('staff.col.student'), t('staff.col.placed'),
            t('staff.col.queue'), t('staff.col.status'), t('staff.col.actions')]}
          empty={open.length === 0 ? t('staff.holds.none') : null}
        >
          {open.map((r) => {
            const code = r.status?.code;
            const deadline = r.pickup_deadline ? new Date(r.pickup_deadline) : null;
            const daysLeft = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;
            return (
              <div key={r.id} style={rowStyle(HOLD_COLS)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Spine
                    src={r.book_copy?.book?.cover_url ? assetUrl(r.book_copy.book.cover_url) : ''}
                    seed={r.book_copy?.book?.title} w={22} h={33}
                  />
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.book_copy?.book?.title || '—'}
                  </strong>
                </span>

                <span style={{ minWidth: 0 }}>
                  {r.student?.name || '—'}
                  {r.student?.grade && <span style={{ color: ink.dim }}> · {r.student.grade}</span>}
                </span>

                <span style={{ color: ink.body }}>
                  {r.request_date ? fmtDate(r.request_date) : '—'}
                </span>

                <span style={{ color: ink.body }}>#{queuePos[r.id] || 1}</span>

                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ alignSelf: 'flex-start' }}>
                    <Pill colors={code === 'APPROVED' ? pill('ready') : pill('hold')}>
                      {code === 'APPROVED' ? t('staff.holds.ready') : t('staff.holds.waiting')}
                    </Pill>
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: daysLeft != null && daysLeft <= 1 ? danger.text : ink.dim,
                  }}>
                    {deadline
                      ? t('staff.holds.pickupBy', { date: fmtDate(deadline) })
                      : code === 'PENDING' ? t('staff.holds.noDeadline') : '—'}
                  </span>
                </span>

                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {code === 'PENDING' && (
                    <Btn kind="secondary" disabled={busy === r.id} onClick={() => act(r, 'approve')}>
                      {t('staff.holds.markReady')}
                    </Btn>
                  )}
                  {code === 'APPROVED' && (
                    <Btn kind="secondary" disabled={busy === r.id} onClick={() => act(r, 'issue')}>
                      {t('staff.holds.collected')}
                    </Btn>
                  )}
                  <Btn kind="danger" disabled={busy === r.id} onClick={() => act(r, 'reject')}>
                    {t('staff.holds.cancel')}
                  </Btn>
                </span>
              </div>
            );
          })}
        </ScrollTable>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff',
            border: '1px solid ' + shell.border, borderRadius: radius.card, padding: '10px 14px',
          }}>
            <span style={{ fontWeight: 700 }}>
              {t('staff.overdue.nSelected', { n: selectedIds.length })}
            </span>
            <span style={{ flex: 1 }} />
            <Btn
              disabled={selectedIds.length === 0}
              onClick={() => say(t('staff.overdue.remindSoon'))}
            >{t('staff.overdue.remind')}</Btn>
            <Btn kind="secondary" disabled={selectedIds.length === 0} onClick={() => setSelected({})}>
              {t('staff.overdue.clear')}
            </Btn>
          </div>

          {/* Reminders need a notification channel, which nothing in this
              system has yet. Saying so beats a button that quietly does
              nothing. */}
          <Alert tone="approval">{t('staff.overdue.noNotifications')}</Alert>

          <ScrollTable
            min={820} columns={OD_COLS}
            head={['', t('staff.col.student'), t('staff.col.book'), t('staff.col.due'),
              t('staff.kpi.overdue'), t('staff.col.copy')]}
            empty={overdue.length === 0 ? t('staff.overdue.none') : null}
          >
            {overdue.map((r) => {
              const on = !!selected[r.loan_id];
              const [, dayFg] = overdueColors(r.days_overdue);
              return (
                <div key={r.loan_id} style={{
                  ...rowStyle(OD_COLS),
                  background: on ? shell.rowSelected : 'transparent',
                }}>
                  <button
                    onClick={() => setSelected({ ...selected, [r.loan_id]: !on })}
                    aria-label={t('staff.overdue.select')} aria-pressed={on}
                    style={{
                      width: 18, height: 18, borderRadius: radius.check,
                      border: '1.5px solid ' + (on ? '#1B9DD9' : shell.control),
                      background: on ? '#1B9DD9' : '#fff', color: '#fff',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >{on ? '✓' : ''}</button>

                  <span style={{ minWidth: 0 }}>
                    <strong>{r.student_name}</strong>
                    {r.student_grade && <span style={{ color: ink.dim }}> · {r.student_grade}</span>}
                  </span>

                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </span>

                  <span style={{ color: ink.body }}>
                    {r.due_date ? fmtDate(r.due_date) : '—'}
                  </span>

                  <strong style={{ fontWeight: 800, color: dayFg }}>
                    {t('staff.desk.overdueDays', { n: r.days_overdue })}
                  </strong>

                  <Mono>{r.tracking_number}</Mono>
                </div>
              );
            })}
          </ScrollTable>
        </>
      )}

      {editing && (
        <DueDateDialog
          loan={editing} t={t} say={say}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

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

// Wide staff tables keep their columns and scroll sideways rather than
// wrapping, which is what the design system says to do.
function ScrollTable({ min, columns, head, children, empty }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, overflowX: 'auto',
    }}>
      <div style={{ minWidth: min }}>
        <div style={{
          display: 'grid', gridTemplateColumns: columns, gap: 12, alignItems: 'center',
          padding: '10px 16px', background: shell.headerBg,
          borderBottom: '1px solid ' + shell.border,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: ink.dim,
        }}>
          {head.map((h, i) => (
            <span key={i} style={i === head.length - 1 ? { textAlign: 'right' } : undefined}>{h}</span>
          ))}
        </div>
        {children}
        {empty && (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim }}>{empty}</div>
        )}
      </div>
    </div>
  );
}

function rowStyle(columns) {
  return {
    display: 'grid', gridTemplateColumns: columns, gap: 12, alignItems: 'center',
    padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine, fontSize: 13,
    minHeight: 44,
  };
}

/* --------------------------------------------------- change a due date */

function DueDateDialog({ loan, t, say, onClose, onSaved }) {
  const iso = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
  const [due, setDue] = useState(iso(loan.due_date));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!due) return;
    setBusy(true);
    try {
      await api.put(`/loans/${loan.id}`, { due_date: due });
      say(t('staff.holds.dueSaved'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={t('staff.holds.changeDue')} onClose={onClose} t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8 }}>
        {loan.book_copy?.book?.title} · {loan.student?.name}
      </div>
      <label style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        fontSize: 12, fontWeight: 600, color: ink.strong,
      }}>
        {t('staff.col.due')}
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={save} disabled={busy || !due}>{t('common.save')}</Btn>
      </div>
    </Dialog>
  );
}
