// Reserving a book is two questions, not one click.
//
// A reader has to say when they will come for it and how long they need it —
// otherwise the desk is guessing, and the loan's due date is whatever the
// librarian happened to press. Both answers are capped by the branch's own
// policy (Kitabxana ayarları → Borc qaydaları), which the dialog reads rather
// than hardcodes, so a librarian changing the rules changes this form too.
//
// Both fields arrive prefilled with the branch defaults, so a reader who does
// not care simply confirms.

import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate } from '../theme';
import { fmtDate } from '../../i18n/dates';
import { Button } from './primitives';

// The choices offered as chips. Anything above the branch cap is dropped, and
// the cap itself is always offered even when it is not a round number.
function options(base, max) {
  const out = base.filter((n) => n <= max);
  if (!out.includes(max)) out.push(max);
  return out.sort((a, b) => a - b);
}

export default function ReserveDialog({ book, onClose, onReserved, say }) {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState(null);
  const [pickupDays, setPickupDays] = useState(null);
  const [loanDays, setLoanDays] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/loan-policy')
      .then((r) => {
        if (!alive) return;
        const p = r.data || {};
        setPolicy(p);
        setPickupDays(Math.min(3, p.max_pickup_days || 7));
        setLoanDays(p.default_loan_days || 14);
      })
      .catch(() => { if (alive) setPolicy({}); });
    return () => { alive = false; };
  }, []);

  const maxPickup = policy?.max_pickup_days || 7;
  const maxLoan = policy?.max_loan_days || 30;
  const pickupChoices = useMemo(() => options([1, 2, 3, 5, 7], maxPickup), [maxPickup]);
  const loanChoices = useMemo(() => options([7, 14, 21, 30], maxLoan), [maxLoan]);

  const by = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/reservation', {
        book_id: book.book_id,
        pickup_days: pickupDays,
        loan_days: loanDays,
      });
      onReserved();
    } catch (err) {
      const code = err.response?.data?.code;
      say(code === 'LIMIT' ? t('mrb.err.limit')
        : code === 'DUPLICATE' ? t('mrb.err.duplicate')
        : code === 'NO_COPY' ? t('mrb.err.noCopy')
        : t('msg.opFailed'));
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: '0 24px 64px rgba(15,23,42,0.3)', maxHeight: '88vh', overflowY: 'auto',
        }}
      >
        <div>
          <h2 style={{
            margin: 0, fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 22, fontWeight: 600, color: slate.text, lineHeight: 1.25,
          }}>{book.title}</h2>
          <div style={{ fontSize: 13, color: slate.dim, marginTop: 4 }}>
            {book.author || '—'}
          </div>
        </div>

        {!policy ? (
          <div style={{ fontSize: 13, color: slate.dim }}>{t('common.loading')}</div>
        ) : (
          <>
            <Choice
              label={t('mrb.res.pickupLabel')}
              hint={pickupDays ? t('mrb.res.pickupHint', { date: by(pickupDays) }) : ''}
              choices={pickupChoices} value={pickupDays} onChange={setPickupDays} t={t}
            />
            <Choice
              label={t('mrb.res.loanLabel')}
              hint={loanDays ? t('mrb.res.loanHint', { date: by(loanDays) }) : ''}
              choices={loanChoices} value={loanDays} onChange={setLoanDays} t={t}
            />

            {/* The desk decides in the end; saying so up front avoids a reader
                thinking the dates are already promised. */}
            <div style={{
              background: brand.tint50, border: '1px solid ' + brand.tint200,
              borderRadius: 10, padding: '10px 12px', fontSize: 12,
              color: brand.deep, lineHeight: 1.5,
            }}>{t('mrb.res.deskNote')}</div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button kind="ghost" onClick={onClose}>{t('common.cancel')}</Button>
              <Button onClick={submit} disabled={busy || !pickupDays || !loanDays}>
                {t('mrb.res.confirm')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Choice({ label, hint, choices, value, onChange, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: slate.dim,
      }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {choices.map((n) => {
          const on = value === n;
          return (
            <button key={n} onClick={() => onChange(n)} style={{
              background: on ? brand.primary : '#fff',
              color: on ? '#fff' : slate.body,
              border: '1px solid ' + (on ? brand.primary : slate.border2),
              borderRadius: 999, padding: '6px 14px', fontSize: 13,
              fontWeight: on ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('mrb.res.nDays', { n })}</button>
          );
        })}
      </div>
      {hint && (
        <span style={{ fontSize: 12, color: slate.dim }}>{hint}</span>
      )}
    </div>
  );
}
