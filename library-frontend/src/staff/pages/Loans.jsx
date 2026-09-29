// Verilən kitablar — every book currently out, from S2 of `Staff Console.dc.html`.
//
// The two-level nav asks for one screen per thing a librarian does, and an
// overdue book *is* a book that was given out: so the old Holds & overdue
// screen's `loans` and `overdue` tabs merge here, with its tab control demoted
// to a filter — Hamısı / Gecikmiş — over one list. Nothing from either tab is
// lost: the 44px rows, the amber → orange → coral day count, the 18px
// checkboxes and bulk bar and the change-due-date action all carry over.
//
// The bulk bar's "send a reminder" used to be a button that said reminders
// would work once a notification channel existed, with a note underneath
// saying so. The channel exists now, so both the note and the apology are
// gone and the button posts to `/desk/overdue/remind`.
//
// The two views need different columns (only the overdue one has a checkbox and
// a day count), so the filter picks the column set as well as the rows.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font, overdueColors, scrollRowStyle } from '../theme';
import { Pill, Btn, Mono } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Toast, DueDateDialog } from './deskShared';

const ALL_COLS = 'minmax(0,1.6fr) minmax(0,2fr) 120px 110px 120px';
const OD_COLS = '28px minmax(0,1.6fr) minmax(0,2fr) 90px 110px 150px';

export default function Loans() {
  const { t } = useTranslation();
  const [view, setView] = useState('all');
  const [loans, setLoans] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState({});
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  // Fetching inside the effect with an `alive` guard rather than calling a
  // useCallback from it: the screen must not set state after it unmounts, and
  // the reload counter is how a write asks for fresh rows.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([api.get('/loans'), api.get('/desk/summary')]).then(([ls, ds]) => {
      if (!alive) return;
      if (ls.status === 'fulfilled') setLoans(ls.value.data || []);
      if (ds.status === 'fulfilled') setOverdue(ds.value.data?.overdue_rows || []);
    });
    return () => { alive = false; };
  }, [reloadKey]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
  );

  // Sending a reminder is a deliberate act by the librarian, not a nightly
  // sweep — which is also why sending twice is allowed. The desk's list can be
  // minutes stale, so the endpoint re-checks each loan and answers with how
  // many it actually sent; a reader who returned their book this morning is
  // skipped rather than told off.
  const remind = () => {
    setSending(true);
    api.post('/desk/overdue/remind', { loan_ids: selectedIds.map(Number) })
      .then((r) => {
        const n = Number(r.data?.sent || 0);
        say(n > 0 ? t('staff.overdue.remindSent', { n }) : t('staff.overdue.remindNone'));
        if (n > 0) setSelected({});
      })
      .catch(() => say(t('msg.opFailed')))
      .finally(() => setSending(false));
  };

  return (
    <>
      {/* The filter, in the design's own tab-button shape — the same control
          this screen used when it was two tabs, one level down. */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[['all', t('staff.loans.all'), loans.length],
          ['overdue', t('staff.kpi.overdue'), overdue.length]]
          .map(([k, label, n]) => {
            const on = view === k;
            return (
              <button key={k} onClick={() => setView(k)} style={{
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

      {view === 'all' ? (
        <ScrollTable
          min={720} columns={ALL_COLS}
          head={[t('staff.col.student'), t('staff.col.book'), t('staff.col.due'),
            t('staff.col.copy'), t('staff.col.actions')]}
          empty={loans.length === 0 ? t('staff.holds.noLoans') : null}
        >
          {loans.map((l) => {
            const late = l.due_date
              ? Math.floor((new Date() - new Date(l.due_date)) / 86400000) : 0;
            return (
              <div key={l.id} style={scrollRowStyle(ALL_COLS)}>
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
              disabled={selectedIds.length === 0 || sending}
              onClick={remind}
            >{t('staff.overdue.remind')}</Btn>
            <Btn kind="secondary" disabled={selectedIds.length === 0} onClick={() => setSelected({})}>
              {t('staff.overdue.clear')}
            </Btn>
          </div>

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
                  ...scrollRowStyle(OD_COLS),
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

      <Toast>{toast}</Toast>
    </>
  );
}
