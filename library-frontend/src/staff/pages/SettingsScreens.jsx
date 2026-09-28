// Kitabxana ayarları — the three screens of the settings domain's top bar.
//
// The existing SettingsPanel is nine CRUD tables behind one row of chips. The
// two-level nav splits them where the meaning splits: `Kataloq siyahıları` is
// the vocabulary a title is catalogued with (author, publisher, topic, genre,
// periodicity), and `Status və vəziyyətlər` is the lifecycle a physical copy and
// its loans move through. A librarian adding a genre and a librarian renaming a
// loan status are doing unrelated jobs.
//
// `Borc qaydaları` is new. GET/PUT /branch-settings has existed and been tested
// since the borrow-limit work but nothing called it, so the branch-wide default
// had no screen at all — only the per-student override on the Members panel.

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { ink } from '../theme';
import { Card, Btn, Input, Alert, PageIntro, Label } from '../components/StaffShell';
import SettingsPanel from '../../pages/librarian/SettingsPanel';
import { Toast } from './deskShared';

// What a title is catalogued *with*.
const CATALOGUE_LISTS = ['authors', 'publishers', 'topics', 'genres', 'frequencies'];
// What a copy and its loans move *through*.
const LIFECYCLE_LISTS = ['copy-conditions', 'copy-statuses', 'loan-statuses', 'reservation-statuses'];

export function SettingsLists() {
  const { t } = useTranslation();
  return (
    <>
      <PageIntro>{t('staff.set.listsSub')}</PageIntro>
      <Card><SettingsPanel only={CATALOGUE_LISTS} /></Card>
    </>
  );
}

export function SettingsStatuses() {
  const { t } = useTranslation();
  return (
    <>
      <PageIntro>{t('staff.set.statusesSub')}</PageIntro>
      <Card><SettingsPanel only={LIFECYCLE_LISTS} /></Card>
    </>
  );
}

/* --------------------------------------------------------- borrow policy */

// The branch-wide defaults, which every student inherits unless the Members
// panel gives them their own limit.
export function SettingsLimits() {
  const { t } = useTranslation();
  const [limit, setLimit] = useState('');
  const [pickup, setPickup] = useState('');
  const [loanDays, setLoanDays] = useState('');
  const [maxLoan, setMaxLoan] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/branch-settings');
      setLimit(String(r.data?.loan_limit ?? ''));
      setPickup(String(r.data?.max_pickup_days ?? ''));
      setLoanDays(String(r.data?.default_loan_days ?? ''));
      setMaxLoan(String(r.data?.max_loan_days ?? ''));
    } catch { say(t('msg.opFailed')); }
    finally { setLoaded(true); }
  }, [say, t]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/branch-settings', {
        loan_limit: Number(limit),
        max_pickup_days: Number(pickup),
        default_loan_days: Number(loanDays),
        max_loan_days: Number(maxLoan),
      });
      say(t('staff.set.limitsSaved'));
      load();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  // The endpoint clamps a negative limit to 0 and a pickup window below 1 to 1,
  // so the form refuses those rather than letting a saved value differ from the
  // typed one.
  const limitOk = limit !== '' && Number(limit) >= 0;
  const pickupOk = pickup !== '' && Number(pickup) >= 1;
  const maxLoanOk = maxLoan !== '' && Number(maxLoan) >= 1;
  // The default is what the desk fills in unasked, so it cannot exceed the cap
  // the same screen sets — the endpoint would clamp it and the saved value
  // would differ from the typed one.
  const loanDaysOk = loanDays !== '' && Number(loanDays) >= 1
    && (!maxLoanOk || Number(loanDays) <= Number(maxLoan));

  return (
    <>
      <PageIntro>{t('staff.set.limitsSub')}</PageIntro>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560 }}>
          <Field
            label={t('staff.set.loanLimit')}
            hint={t('staff.set.loanLimitHint')}
            value={limit} onChange={setLimit} min={0} disabled={!loaded}
            bad={loaded && !limitOk} badText={t('staff.set.loanLimitBad')}
          />
          <Field
            label={t('staff.set.pickupDays')}
            hint={t('staff.set.pickupDaysHint')}
            value={pickup} onChange={setPickup} min={1} disabled={!loaded}
            bad={loaded && !pickupOk} badText={t('staff.set.pickupDaysBad')}
          />

          <Field
            label={t('staff.set.loanDays')}
            hint={t('staff.set.loanDaysHint')}
            value={loanDays} onChange={setLoanDays} min={1} disabled={!loaded}
            bad={loaded && !loanDaysOk} badText={t('staff.set.loanDaysBad')}
          />
          <Field
            label={t('staff.set.maxLoanDays')}
            hint={t('staff.set.maxLoanDaysHint')}
            value={maxLoan} onChange={setMaxLoan} min={1} disabled={!loaded}
            bad={loaded && !maxLoanOk} badText={t('staff.set.maxLoanDaysBad')}
          />

          <Alert tone="approval">{t('staff.set.limitsOverrideNote')}</Alert>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={save} disabled={busy || !loaded || !limitOk || !pickupOk || !loanDaysOk || !maxLoanOk}>
              {t('common.save')}
            </Btn>
          </div>
        </div>
      </Card>

      <Toast>{toast}</Toast>
    </>
  );
}

function Field({ label, hint, value, onChange, min, disabled, bad, badText }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label>{label}</Label>
      <Input
        type="number" min={min} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ maxWidth: 140 }}
      />
      <span style={{ fontSize: 12, color: bad ? '#B4232A' : ink.dim, lineHeight: 1.5 }}>
        {bad ? badText : hint}
      </span>
    </label>
  );
}
