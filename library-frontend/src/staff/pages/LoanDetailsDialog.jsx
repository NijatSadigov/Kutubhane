// The loan details step: everything prefilled, confirm and done.
//
// Handing a reserved book over used to be a single button that issued the loan
// with whatever the server defaulted to — the desk could not see the due date,
// let alone change it. This is the step in between: it shows the reader, the
// copy and the dates, fills them from the reader's own request and the branch
// policy, and lets the librarian change any of it before confirming.
//
// A branch that does not care about periods just presses Confirm.

import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font } from '../theme';
import { Btn, Input, Label, Mono, Alert } from '../components/StaffShell';
import { Dialog } from './InventoryDialogs';

const BASE_PERIODS = [7, 14, 21, 30];

function periodsFor(policy, asked) {
  const max = policy?.max_loan_days || 30;
  const out = BASE_PERIODS.filter((n) => n <= max);
  // What the reader asked for is always offered, so honouring it is one click.
  if (asked && asked <= max && !out.includes(asked)) out.push(asked);
  if (!out.includes(max)) out.push(max);
  return [...new Set(out)].sort((a, b) => a - b);
}

function isoPlus(n) {
  const d = new Date();
  d.setDate(d.getDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}

export default function LoanDetailsDialog({ reservation, onClose, onDone, say }) {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState(null);
  const [days, setDays] = useState(null);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  // What the reader asked for when they placed the hold.
  const asked = reservation.loan_days || 0;

  useEffect(() => {
    let alive = true;
    api.get('/loan-policy')
      .then((r) => {
        if (!alive) return;
        const p = r.data || {};
        setPolicy(p);
        const start = asked > 0 ? asked : (p.default_loan_days || 14);
        setDays(start);
        setDue(isoPlus(start));
      })
      .catch(() => { if (alive) setPolicy({}); });
    return () => { alive = false; };
  }, [asked]);

  const periods = useMemo(() => periodsFor(policy, asked), [policy, asked]);

  // Picking a period moves the date; editing the date is the final word and
  // clears the period highlight, so the two can never contradict each other.
  const pickDays = (n) => { setDays(n); setDue(isoPlus(n)); };
  const pickDate = (v) => { setDue(v); setDays(null); };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/reservation/${reservation.id}/issue`, {
        days: days || undefined,
        due_date: due || undefined,
      });
      onDone();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  const book = reservation.book_copy?.book;

  return (
    <Dialog title={t('staff.loan.title')} onClose={onClose} t={t}>
      {/* Who and what — so the desk can check it against the book in hand. */}
      <div style={{
        background: shell.headerBg, border: '1px solid ' + shell.border,
        borderRadius: radius.alert, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 6, marginTop: -8,
      }}>
        <Row label={t('staff.col.student')}>
          <strong>{reservation.student?.name || '—'}</strong>
          {reservation.student?.grade ? (
            <span style={{ color: ink.dim }}> · {reservation.student.grade}</span>
          ) : null}
        </Row>
        <Row label={t('staff.col.book')}>
          <strong>{book?.title || '—'}</strong>
        </Row>
        <Row label={t('staff.col.copy')}>
          <Mono style={{ fontSize: 13, color: ink.text }}>
            {reservation.book_copy?.tracking_number || '—'}
          </Mono>
        </Row>
      </div>

      {!policy ? (
        <div style={{ fontSize: 13, color: ink.dim }}>{t('common.loading')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.loan.period')}</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {periods.map((n) => {
                const on = days === n;
                return (
                  <button key={n} onClick={() => pickDays(n)} style={{
                    background: on ? '#082F49' : '#fff',
                    color: on ? '#fff' : ink.body,
                    border: '1px solid ' + (on ? '#082F49' : shell.control),
                    borderRadius: radius.control, padding: '7px 13px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {t('staff.desk.nDays', { n })}
                    {asked === n && (
                      <span style={{
                        fontSize: 10, fontWeight: 800,
                        color: on ? '#7DD3FC' : ink.muted,
                      }}>★</span>
                    )}
                  </button>
                );
              })}
            </div>
            {asked > 0 && (
              <span style={{ fontSize: 12, color: ink.dim }}>
                {t('staff.loan.askedFor', { n: asked })}
              </span>
            )}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{t('staff.col.due')}</Label>
            <Input type="date" value={due} onChange={(e) => pickDate(e.target.value)} />
            <span style={{ fontSize: 12, color: ink.dim }}>
              {due ? t('staff.loan.dueHint', { date: fmtDate(due) }) : ''}
            </span>
          </label>

          {reservation.status?.code === 'PENDING' && (
            <Alert tone="action">{t('staff.loan.notApproved')}</Alert>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
            <Btn onClick={confirm} disabled={busy || !due}>{t('staff.loan.confirm')}</Btn>
          </div>
        </>
      )}
    </Dialog>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'baseline' }}>
      <span style={{ width: 92, flexShrink: 0, color: ink.dim, fontSize: 12 }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}
