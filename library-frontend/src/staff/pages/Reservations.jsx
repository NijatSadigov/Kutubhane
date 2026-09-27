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
import { ink, danger, pill, scrollRowStyle } from '../theme';
import { Pill, Btn, Spine } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Toast } from './deskShared';

const HOLD_COLS = 'minmax(0,2fr) minmax(0,1.6fr) 90px 90px 150px 220px';

export default function Reservations() {
  const { t } = useTranslation();
  const [reservations, setReservations] = useState([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(0);

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

      <Toast>{toast}</Toast>
    </>
  );
}
