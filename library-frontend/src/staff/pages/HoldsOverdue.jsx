// Holds & overdue.
//
// Holds queue: approve a booking (which stamps its pickup deadline), issue it
// when the student collects, or reject it.
// Overdue: bulk select, with days coloured amber → orange → coral.

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, danger, overdueColors, pill } from '../theme';
import { Card, PageTitle, Pill, Table, Row, Btn } from '../components/StaffShell';

export default function HoldsOverdue() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('holds');
  const [reservations, setReservations] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [selected, setSelected] = useState({});
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(0);

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async () => {
    const [rs, ds] = await Promise.allSettled([
      api.get('/reservations'),
      api.get('/desk/summary'),
    ]);
    if (rs.status === 'fulfilled') setReservations(rs.value.data || []);
    if (ds.status === 'fulfilled') setOverdue(ds.value.data?.overdue_rows || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = reservations.filter(
    (r) => r.status?.code === 'PENDING' || r.status?.code === 'APPROVED'
  );

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
      <PageTitle sub={t('staff.holds.sub')}>{t('staff.nav.holds')}</PageTitle>

      <div style={{ display: 'inline-flex', gap: 4, background: '#fff', border: '1px solid ' + shell.border, borderRadius: 999, padding: 4, marginBottom: 16 }}>
        {[['holds', t('staff.holds.queue'), open.length], ['overdue', t('staff.kpi.overdue'), overdue.length]].map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: tab === k ? '#1B9DD9' : 'transparent',
            color: tab === k ? '#fff' : ink.body,
            border: 0, borderRadius: 999, padding: '8px 16px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
          }}>
            {label}
            <span style={{
              background: tab === k ? 'rgba(255,255,255,.25)' : shell.headerBg,
              borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800,
            }}>{n}</span>
          </button>
        ))}
      </div>

      {tab === 'holds' ? (
        <Table
          columns="minmax(0,1.2fr) minmax(0,1.4fr) 120px 150px 190px"
          head={[t('staff.col.student'), t('staff.col.book'), t('staff.col.status'),
                 t('staff.col.pickupBy'), t('staff.col.actions')]}
          empty={open.length === 0 ? t('staff.holds.none') : null}
        >
          {open.map((r) => {
            const code = r.status?.code;
            const deadline = r.pickup_deadline ? new Date(r.pickup_deadline) : null;
            const daysLeft = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;
            return (
              <Row key={r.id} columns="minmax(0,1.2fr) minmax(0,1.4fr) 120px 150px 190px">
                <span style={{ minWidth: 0 }}><strong>{r.student?.name || '—'}</strong></span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.book_copy?.book?.title || '—'}
                  <span style={{ color: ink.muted }}> · {r.book_copy?.tracking_number}</span>
                </span>
                <Pill colors={code === 'APPROVED' ? pill('hold') : pill('pending')}>
                  {code === 'APPROVED' ? t('staff.holds.ready') : t('staff.holds.waiting')}
                </Pill>
                <span style={{ fontSize: 12, color: daysLeft != null && daysLeft <= 1 ? danger.text : ink.dim }}>
                  {deadline ? `${deadline.toLocaleDateString()}${daysLeft != null ? ` (${daysLeft}d)` : ''}` : '—'}
                </span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {code === 'PENDING' && (
                    <Btn disabled={busy === r.id} onClick={() => act(r, 'approve')}>{t('staff.holds.markReady')}</Btn>
                  )}
                  {code === 'APPROVED' && (
                    <Btn disabled={busy === r.id} onClick={() => act(r, 'issue')}>{t('staff.holds.collected')}</Btn>
                  )}
                  <Btn kind="danger" disabled={busy === r.id} onClick={() => act(r, 'reject')}>
                    {t('staff.holds.cancel')}
                  </Btn>
                </span>
              </Row>
            );
          })}
        </Table>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <Card style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{t('staff.overdue.nSelected', { n: selectedIds.length })}</strong>
              <Btn kind="secondary" onClick={() => say(t('staff.overdue.remindSoon'))}>
                {t('staff.overdue.remind')}
              </Btn>
              <Btn kind="secondary" onClick={() => setSelected({})}>{t('staff.overdue.clear')}</Btn>
            </Card>
          )}

          <Table
            columns="34px minmax(0,1.2fr) minmax(0,1.4fr) 120px"
            head={['', t('staff.col.student'), t('staff.col.book'), t('staff.kpi.overdue')]}
            empty={overdue.length === 0 ? t('staff.overdue.none') : null}
          >
            {overdue.map((r) => {
              const c = overdueColors(r.days_overdue);
              return (
                <Row key={r.loan_id} columns="34px minmax(0,1.2fr) minmax(0,1.4fr) 120px"
                  selected={!!selected[r.loan_id]}>
                  <input
                    type="checkbox" checked={!!selected[r.loan_id]}
                    onChange={(e) => setSelected({ ...selected, [r.loan_id]: e.target.checked })}
                    style={{ width: 15, height: 15, accentColor: '#1B9DD9', borderRadius: radius.check }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <strong>{r.student_name}</strong>
                    {r.student_grade && <span style={{ color: ink.muted }}> · {r.student_grade}</span>}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}<span style={{ color: ink.muted }}> · {r.tracking_number}</span>
                  </span>
                  <Pill colors={c}>{t('staff.desk.overdueDays', { n: r.days_overdue })}</Pill>
                </Row>
              );
            })}
          </Table>
        </>
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
