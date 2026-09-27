// Circulation desk — the librarian's main screen.
//
// Check out: find a student, see what they already hold and their limit, pick a
// book and a free copy, choose a loan period, confirm.
// Check in: find the loan by barcode or student, see overdue and hold alerts,
// record the condition, confirm.
// Plus "today at the desk" and the KPI strip.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, danger, overdueColors, pill } from '../theme';
import { Card, PageTitle, Kpi, Pill, Table, Row, Btn } from '../components/StaffShell';

const LOAN_PERIODS = [7, 14, 21];

export default function CirculationDesk() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('out');
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, cl, bk] = await Promise.allSettled([
        api.get('/desk/summary'),
        api.get('/class-list'),
        api.get('/books'),
      ]);
      if (!alive) return;
      if (s.status === 'fulfilled') setSummary(s.value.data);
      if (cl.status === 'fulfilled') setStudents(cl.value.data || []);
      if (bk.status === 'fulfilled') setBooks(bk.value.data || []);
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <>
      <PageTitle sub={t('staff.desk.sub')}>{t('staff.nav.desk')}</PageTitle>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        <Kpi label={t('staff.kpi.issuedToday')} value={summary?.issued_today ?? '—'} />
        <Kpi label={t('staff.kpi.returnedToday')} value={summary?.returned_today ?? '—'} />
        <Kpi label={t('staff.kpi.activeLoans')} value={summary?.active_loans ?? '—'} />
        <Kpi
          label={t('staff.kpi.overdue')} value={summary?.overdue ?? '—'}
          note={summary?.overdue_14_plus ? t('staff.kpi.over14', { n: summary.overdue_14_plus }) : null}
          noteColor={danger.text}
        />
        <Kpi label={t('staff.kpi.holds')} value={summary?.holds_pending ?? '—'} />
        <Kpi label={t('staff.kpi.members')} value={summary?.members ?? '—'} />
      </div>

      <div style={{ display: 'inline-flex', gap: 4, background: '#fff', border: '1px solid ' + shell.border, borderRadius: 999, padding: 4, marginBottom: 16 }}>
        {[['out', t('staff.desk.checkOut')], ['in', t('staff.desk.checkIn')]].map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            background: mode === k ? '#1B9DD9' : 'transparent',
            color: mode === k ? '#fff' : ink.body,
            border: 0, borderRadius: 999, padding: '8px 18px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
          }}>{label}</button>
        ))}
      </div>

      {mode === 'out'
        ? <CheckOut students={students} books={books} t={t} say={say} reload={reload} />
        : <CheckIn t={t} say={say} reload={reload} />}

      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '28px 0 12px' }}>{t('staff.desk.today')}</h2>
      <Table
        columns="minmax(0,1.4fr) minmax(0,1.6fr) 110px 100px"
        head={[t('staff.col.student'), t('staff.col.book'), t('staff.col.action'), t('staff.col.time')]}
        empty={(summary?.today || []).length === 0 ? t('staff.desk.nothingToday') : null}
      >
        {(summary?.today || []).map((r, i) => (
          <Row key={`${r.loan_id}-${r.action}-${i}`} columns="minmax(0,1.4fr) minmax(0,1.6fr) 110px 100px">
            <span style={{ minWidth: 0 }}>
              <strong>{r.student_name}</strong>
              {r.student_grade && <span style={{ color: ink.muted }}> · {r.student_grade}</span>}
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title}
              {r.tracking_number && <span style={{ color: ink.muted }}> · {r.tracking_number}</span>}
            </span>
            <Pill colors={pill(r.action)}>
              {r.action === 'out' ? t('staff.pill.checkedOut') : t('staff.pill.returned')}
            </Pill>
            <span style={{ color: ink.dim, fontSize: 12 }}>
              {new Date(r.action === 'out' ? r.issue_date : r.return_date)
                .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </Row>
        ))}
      </Table>

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

/* ------------------------------------------------------------- check out */

function CheckOut({ students, books, t, say, reload }) {
  const [studentId, setStudentId] = useState('');
  const [bookId, setBookId] = useState('');
  const [copy, setCopy] = useState('');
  const [days, setDays] = useState(14);
  const [holds, setHolds] = useState(null);
  const [busy, setBusy] = useState(false);

  // What the student already has out, and their limit — shown before issuing,
  // so the desk is not surprised by a rejection.
  useEffect(() => {
    if (!studentId) { setHolds(null); return undefined; }
    let alive = true;
    api.get(`/student/${studentId}/holds`)
      .then((r) => { if (alive) setHolds(r.data); })
      .catch(() => { if (alive) setHolds(null); });
    return () => { alive = false; };
  }, [studentId]);

  const selectedBook = books.find((b) => String(b.id) === String(bookId));
  const freeCopies = useMemo(
    () => (selectedBook?.copies || []).filter((cp) => cp.status?.code === 'AVAILABLE'),
    [selectedBook]
  );

  useEffect(() => { setCopy(freeCopies[0]?.tracking_number || ''); }, [freeCopies]);

  const atLimit = holds && holds.limit != null && holds.count >= holds.limit;

  const issue = async () => {
    if (!studentId || !bookId || !copy) { say(t('staff.desk.errPick')); return; }
    setBusy(true);
    try {
      const due = new Date();
      due.setDate(due.getDate() + Number(days));
      await api.post('/loan', {
        student_id: Number(studentId), book_id: Number(bookId),
        tracking_number: copy, due_date: due.toISOString().slice(0, 10),
      });
      say(t('staff.desk.issued'));
      setBookId(''); setCopy('');
      reload();
    } catch (e) {
      const code = e.response?.data?.code;
      say(code === 'LIMIT' ? t('mrb.err.limit')
        : code === 'DUPLICATE' ? t('mrb.err.duplicate')
        : e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <Select label={t('staff.col.student')} value={studentId} onChange={setStudentId}
          options={[['', t('staff.desk.pickStudent')], ...students.map((s) => [
            s.user_id, `${s.name}${s.grade ? ` · ${s.grade}${s.class_group || ''}` : ''}`,
          ])]} />

        <Select label={t('staff.col.book')} value={bookId} onChange={setBookId}
          options={[['', t('staff.desk.pickBook')], ...books.map((b) => [b.id, b.title])]} />

        <Select label={t('staff.desk.copy')} value={copy} onChange={setCopy}
          disabled={!selectedBook}
          options={freeCopies.length
            ? freeCopies.map((cp) => [cp.tracking_number, cp.tracking_number])
            : [['', t('staff.desk.noFreeCopy')]]} />

        <Select label={t('staff.desk.period')} value={days} onChange={setDays}
          options={LOAN_PERIODS.map((d) => [d, t('staff.desk.nDays', { n: d })])} />
      </div>

      {holds && (
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: atLimit ? danger.tint : shell.headerBg,
          border: '1px solid ' + (atLimit ? danger.border : shell.border),
          borderRadius: radius.alert, padding: '10px 13px', fontSize: 12.5,
          color: atLimit ? danger.text : ink.body,
        }}>
          <strong>{t('staff.desk.holdsNow', { n: holds.count, limit: holds.limit })}</strong>
          {atLimit && <span>{t('staff.desk.atLimit')}</span>}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn onClick={issue} disabled={busy || !studentId || !copy}>{t('staff.desk.confirmOut')}</Btn>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- check in */

function CheckIn({ t, say, reload }) {
  const [loans, setLoans] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(0);

  const load = useCallback(() => {
    api.get('/loans').then((r) => setLoans(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const term = q.trim().toLowerCase();
  const shown = term
    ? loans.filter((l) =>
        (l.book_copy?.tracking_number || '').toLowerCase().includes(term) ||
        (l.student?.name || '').toLowerCase().includes(term) ||
        (l.book_copy?.book?.title || '').toLowerCase().includes(term))
    : loans;

  const giveBack = async (loan) => {
    setBusy(loan.id);
    try {
      await api.post(`/return/${loan.id}`);
      say(t('staff.desk.returned'));
      load(); reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(0); }
  };

  return (
    <Card padding={0}>
      <div style={{ padding: 14, borderBottom: '1px solid ' + shell.border }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder={t('staff.desk.scanPlaceholder')}
          style={{
            width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
            padding: '10px 13px', fontSize: 14, fontFamily: font.ui, outline: 'none',
          }}
        />
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: 26, textAlign: 'center', fontSize: 13, color: ink.dim }}>
          {t('staff.desk.noMatch')}
        </div>
      ) : shown.slice(0, 25).map((l) => {
        const due = l.due_date ? new Date(l.due_date) : null;
        const late = due ? Math.floor((new Date() - due) / 86400000) : 0;
        const oc = overdueColors(late);
        return (
          <div key={l.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
            minHeight: 52, borderBottom: '1px solid ' + shell.border, flexWrap: 'wrap',
          }}>
            <span style={{ flex: '1 1 200px', minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{l.book_copy?.book?.title || '—'}</strong>
              <span style={{ display: 'block', fontSize: 12, color: ink.dim }}>
                {l.student?.name} · {l.book_copy?.tracking_number}
              </span>
            </span>
            {late > 0
              ? <Pill colors={oc}>{t('staff.desk.overdueDays', { n: late })}</Pill>
              : <Pill colors={pill('out')}>{t('staff.desk.dueOn', { date: due ? due.toLocaleDateString() : '—' })}</Pill>}
            <Btn kind="secondary" disabled={busy === l.id} onClick={() => giveBack(l)}>
              {t('staff.desk.confirmIn')}
            </Btn>
          </div>
        );
      })}
    </Card>
  );
}

function Select({ label, value, onChange, options, disabled }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: ink.dim, marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <select
        value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
          padding: '9px 11px', fontSize: 13, fontFamily: font.ui,
          background: disabled ? shell.headerBg : '#fff', color: ink.text,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map(([v, l]) => <option key={String(v)} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
