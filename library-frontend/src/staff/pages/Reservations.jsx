// Rezerv edilən kitablar — the hold queue, from S2 of `Staff Console.dc.html`.
//
// Was the `holds` tab of the old Holds & overdue screen; the two-level nav
// promotes it to a screen of its own in the Kitabxana top bar. Unchanged from
// there: a 760px-wide table (book with its spine, student, placed, queue
// position, a stacked status pill and pickup line, right-aligned actions), and
// the three actions — mark ready, which stamps the pickup deadline; mark
// collected; cancel.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, danger, pill, radius, font, scrollRowStyle } from '../theme';
import { Pill, Btn, Spine, Label } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Toast } from './deskShared';
import LoanDetailsDialog from './LoanDetailsDialog';
import { Dialog } from './InventoryDialogs';

const HOLD_COLS = 'minmax(0,2fr) minmax(0,1.6fr) 90px 90px 150px 220px';

export default function Reservations() {
  const { t } = useTranslation();
  const [reservations, setReservations] = useState([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(0);
  const [issuing, setIssuing] = useState(null);
  const [approving, setApproving] = useState(null);

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    api.get('/reservations')
      .then((r) => { if (alive) setReservations(r.data || []); })
      .catch(() => { /* the empty state says it */ });
    return () => { alive = false; };
  }, [reloadKey]);

  const open = useMemo(() => reservations.filter(
    (r) => r.status?.code === 'PENDING' || r.status?.code === 'APPROVED',
  ), [reservations]);

  // Where each hold sits in the queue for its own title, oldest first — the
  // design's "Queue" column.
  const queuePos = useMemo(() => {
    const byBook = {};
    const m = {};
    [...open]
      .sort((a, b) => new Date(a.request_date || 0) - new Date(b.request_date || 0))
      .forEach((r) => {
        const key = r.book_copy?.book_id ?? 'x';
        byBook[key] = (byBook[key] || 0) + 1;
        m[r.id] = byBook[key];
      });
    return m;
  }, [open]);

  const act = async (r, what) => {
    // Handing the book over opens the loan details rather than issuing blind:
    // the desk should see the due date it is about to set, and be able to
    // change it.
    if (what === 'issue') { setIssuing(r); return; }
    // Approving sets the collection deadline, so the desk gets to see and
    // change it rather than having it silently computed.
    if (what === 'approve') { setApproving(r); return; }
    setBusy(r.id);
    try {
      {
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

  return (
    <>
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
            <div key={r.id} style={scrollRowStyle(HOLD_COLS)}>
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

      {approving && (
        <ApproveDialog
          reservation={approving} say={say}
          onClose={() => setApproving(null)}
          onDone={() => { setApproving(null); say(t('staff.holds.approved')); load(); }}
        />
      )}

      {issuing && (
        <LoanDetailsDialog
          reservation={issuing} say={say}
          onClose={() => setIssuing(null)}
          onDone={() => { setIssuing(null); say(t('staff.holds.issued')); load(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

/* ------------------------------------------------- approving a hold */

// Approval is where the collection deadline is set, so it gets a step of its
// own: the window the reader asked for is prefilled, and the desk may shorten
// or extend it up to the branch maximum. The server clamps to the same cap, so
// a date beyond it cannot be saved from here either.
function ApproveDialog({ reservation, onClose, onDone, say }) {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState(null);
  const [days, setDays] = useState(null);
  const [busy, setBusy] = useState(false);

  const asked = reservation.pickup_days || 0;

  useEffect(() => {
    let alive = true;
    api.get('/loan-policy')
      .then((r) => {
        if (!alive) return;
        const p = r.data || {};
        setPolicy(p);
        setDays(asked > 0 ? Math.min(asked, p.max_pickup_days || 7) : (p.max_pickup_days || 7));
      })
      .catch(() => { if (alive) setPolicy({}); });
    return () => { alive = false; };
  }, [asked]);

  const max = policy?.max_pickup_days || 7;
  const choices = [...new Set([1, 2, 3, 5, 7].filter((n) => n <= max).concat(max))]
    .sort((a, b) => a - b);

  const by = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(n || 0));
    return fmtDate(d);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/reservation/${reservation.id}`, {
        action: 'Approved', pickup_days: days,
      });
      onDone();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('staff.approve.title')} onClose={onClose} t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8 }}>
        {reservation.book_copy?.book?.title} · {reservation.student?.name}
      </div>

      {!policy ? (
        <div style={{ fontSize: 13, color: ink.dim }}>{t('common.loading')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.approve.window')}</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {choices.map((n) => {
                const on = days === n;
                return (
                  <button key={n} onClick={() => setDays(n)} style={{
                    background: on ? '#082F49' : '#fff',
                    color: on ? '#fff' : ink.body,
                    border: '1px solid ' + (on ? '#082F49' : shell.control),
                    borderRadius: radius.control, padding: '7px 13px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
                  }}>{t('staff.desk.nDays', { n })}</button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: ink.dim }}>
              {days ? t('staff.approve.until', { date: by(days) }) : ''}
              {asked > 0 ? ' · ' + t('staff.approve.askedFor', { n: asked }) : ''}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
            <Btn onClick={confirm} disabled={busy || !days}>{t('staff.approve.confirm')}</Btn>
          </div>
        </>
      )}
    </Dialog>
  );
}
