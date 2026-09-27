// S1 Circulation desk — transcribed from `Staff Console.dc.html`.
//
// A 170px KPI strip over a 560/300 split: on the left a card whose head is the
// check-out / check-in tabs, and whose body is the design's numbered flow —
// find the student, see what they already hold, pick books into a basket,
// choose a loan period, confirm; or scan a barcode, read the overdue and hold
// alerts, record the condition, confirm the return. On the right, "Today at
// the desk" as a timeline of 10px rows.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate, fmtDayMonth, fmtTime } from '../../i18n/dates';
import { shell, ink, radius, font, danger, overdueColors, pill } from '../theme';
import {
  Kpi, KpiRow, Pill, Btn, Alert, Label, Input, Chip, Spine, Avatar, Mono,
} from '../components/StaffShell';

const LOAN_PERIODS = [7, 14, 21];

export default function CirculationDesk() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('out');
  const [summary, setSummary] = useState(null);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    api.get('/desk/summary')
      .then((r) => { if (alive) setSummary(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  const issuedDelta = summary && summary.issued_prev_weekday != null
    ? summary.issued_today - summary.issued_prev_weekday : null;

  return (
    <>
      <KpiRow>
        <Kpi
          label={t('staff.kpi.issuedToday')} value={summary?.issued_today ?? '—'}
          note={issuedDelta == null ? '' : t('staff.kpi.vsLastWeek', {
            n: (issuedDelta >= 0 ? '+' : '') + issuedDelta,
          })}
          noteColor={issuedDelta >= 0 ? '#166534' : danger.text}
        />
        <Kpi label={t('staff.kpi.returnedToday')} value={summary?.returned_today ?? '—'} />
        <Kpi label={t('staff.kpi.activeLoans')} value={summary?.active_loans ?? '—'} />
        <Kpi
          label={t('staff.kpi.overdue')} value={summary?.overdue ?? '—'}
          note={summary?.overdue_14_plus ? t('staff.kpi.over14', { n: summary.overdue_14_plus }) : ''}
          noteColor={danger.text}
        />
        <Kpi label={t('staff.kpi.holds')} value={summary?.holds_pending ?? '—'} />
        <Kpi label={t('staff.kpi.members')} value={summary?.members ?? '—'} />
      </KpiRow>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{
          flex: '999 1 560px', minWidth: 0, background: '#fff',
          border: '1px solid ' + shell.border, borderRadius: radius.card,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', gap: 4, padding: 10,
            borderBottom: '1px solid ' + shell.border, flexWrap: 'wrap',
          }}>
            {[['out', t('staff.desk.checkOut')], ['in', t('staff.desk.checkIn')]].map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)} style={{
                background: mode === k ? '#082F49' : 'transparent',
                color: mode === k ? '#fff' : ink.body,
                border: 0, borderRadius: radius.control, padding: '8px 16px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{label}</button>
            ))}
          </div>

          {mode === 'out'
            ? <CheckOut t={t} say={say} reload={reload} />
            : <CheckIn t={t} say={say} reload={reload} />}
        </div>

        <TodayAtTheDesk summary={summary} t={t} />
      </div>

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

function CheckOut({ t, say, reload }) {
  const [patronQ, setPatronQ] = useState('');
  const [students, setStudents] = useState([]);
  const [patron, setPatron] = useState(null);
  const [holds, setHolds] = useState(null);

  const [bookQ, setBookQ] = useState('');
  const [books, setBooks] = useState([]);
  const [cart, setCart] = useState([]);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/class-list').then((r) => setStudents(r.data || [])).catch(() => {});
    api.get('/books').then((r) => setBooks(r.data || [])).catch(() => {});
  }, []);

  // What the student already has out, and their limit — shown before issuing,
  // so the desk is not surprised by a rejection.
  useEffect(() => {
    if (!patron) return undefined;
    let alive = true;
    api.get(`/student/${patron.user_id}/holds`)
      .then((r) => { if (alive) setHolds(r.data); })
      .catch(() => { if (alive) setHolds(null); });
    return () => { alive = false; };
  }, [patron]);

  const patronResults = useMemo(() => {
    const term = patronQ.trim().toLowerCase();
    if (!term) return students.slice(0, 6);
    return students.filter((s) =>
      (s.name || '').toLowerCase().includes(term)
      || String(s.user_id) === term
      || (s.grade || '').toLowerCase().includes(term)).slice(0, 8);
  }, [patronQ, students]);

  // Free copies, flattened so a barcode scan finds one directly.
  const copyResults = useMemo(() => {
    const term = bookQ.trim().toLowerCase();
    const out = [];
    books.forEach((b) => {
      (b.copies || []).forEach((cp) => {
        if (cp.status?.code !== 'AVAILABLE') return;
        const bc = cp.tracking_number || '';
        if (term && !(b.title || '').toLowerCase().includes(term) && !bc.toLowerCase().includes(term)) return;
        if (cart.some((c) => c.tracking_number === bc)) return;
        out.push({ book_id: b.id, title: b.title, cover_url: b.cover_url, tracking_number: bc });
      });
    });
    return out.slice(0, 8);
  }, [bookQ, books, cart]);

  const activeLoans = (patron?.loans || []).filter((l) => !l.return_date);
  const hasOverdue = activeLoans.some((l) => l.due_date && new Date(l.due_date) < new Date());
  const atLimit = holds && holds.limit != null && holds.count + cart.length > holds.limit;

  const due = new Date();
  due.setDate(due.getDate() + Number(days));

  const checkout = async () => {
    if (!patron || cart.length === 0) return;
    setBusy(true);
    let done = 0;
    for (const item of cart) {
      try {
        await api.post('/loan', {
          student_id: patron.user_id, book_id: item.book_id,
          tracking_number: item.tracking_number,
          due_date: due.toISOString().slice(0, 10),
        });
        done++;
      } catch (e) {
        const code = e.response?.data?.code;
        say(code === 'LIMIT' ? t('mrb.err.limit')
          : code === 'DUPLICATE' ? t('mrb.err.duplicate')
          : e.response?.data?.error || t('msg.opFailed'));
        break;
      }
    }
    if (done > 0) {
      say(t('staff.desk.issuedN', { n: done }));
      setCart([]); setBookQ('');
      api.get('/books').then((r) => setBooks(r.data || [])).catch(() => {});
      api.get('/class-list').then((r) => setStudents(r.data || [])).catch(() => {});
      reload();
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ------------------------------------------------- 1 · student */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>{t('staff.desk.step1')}</Label>

        {!patron ? (
          <>
            <Input big autoFocus value={patronQ} onChange={(e) => setPatronQ(e.target.value)}
              placeholder={t('staff.desk.scanStudent')} />
            <div style={{
              display: 'flex', flexDirection: 'column', border: '1px solid ' + shell.border,
              borderRadius: radius.alert, overflow: 'hidden',
            }}>
              {patronResults.length === 0 && (
                <div style={{ padding: 14, fontSize: 13, color: ink.dim }}>{t('staff.desk.noStudent')}</div>
              )}
              {patronResults.map((s) => {
                const open = (s.loans || []).filter((l) => !l.return_date);
                const late = open.some((l) => l.due_date && new Date(l.due_date) < new Date());
                return (
                  <button key={s.user_id} onClick={() => setPatron(s)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: 0,
                    borderBottom: '1px solid ' + shell.rowLine, padding: '10px 12px',
                    cursor: 'pointer', textAlign: 'left', fontFamily: font.ui,
                  }}>
                    <Avatar initials={initialsOf(s.name)} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: ink.dim }}>
                        {[gradeOf(s), t('staff.desk.nLoans', { n: open.length })].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {late && <Pill colors={pill('overdue')}>{t('staff.pill.overdue')}</Pill>}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{
              display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
              background: shell.headerBg, border: '1px solid ' + shell.border,
              borderRadius: radius.alert, padding: 14,
            }}>
              <Avatar initials={initialsOf(patron.name)} size={44} />
              <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15 }}>{patron.name}</strong>
                  <span style={{ color: ink.dim }}>{gradeOf(patron)}</span>
                </div>
                <div style={{ fontSize: 12, color: ink.body }}>
                  {holds
                    ? t('staff.desk.holdsNow', { n: holds.count, limit: holds.limit ?? '—' })
                    : t('common.loading')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {activeLoans.map((l) => {
                    const late = l.due_date
                      ? Math.floor((new Date() - new Date(l.due_date)) / 86400000) : 0;
                    return (
                      <div key={l.id} style={{
                        display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12,
                      }}>
                        <span>{l.book_copy?.book?.title || t('staff.desk.aBook')}</span>
                        <Pill colors={late > 0 ? overdueColors(late) : pill('out')}>
                          {late > 0
                            ? t('staff.desk.overdueDays', { n: late })
                            : t('staff.desk.dueOn', {
                              date: l.due_date ? fmtDate(l.due_date) : '—',
                            })}
                        </Pill>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Btn kind="secondary" onClick={() => { setPatron(null); setHolds(null); setCart([]); }}>
                {t('staff.desk.change')}
              </Btn>
            </div>

            {hasOverdue && <Alert tone="problem">{t('staff.desk.hasOverdue')}</Alert>}
            {atLimit && <Alert tone="action">{t('staff.desk.overLimit')}</Alert>}
          </>
        )}
      </div>

      {patron && (
        <>
          {/* ---------------------------------------------- 2 · books */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.desk.step2')}</Label>
            <Input big value={bookQ} onChange={(e) => setBookQ(e.target.value)}
              placeholder={t('staff.desk.scanBook')} />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8,
            }}>
              {copyResults.length === 0 && (
                <div style={{ fontSize: 13, color: ink.dim, padding: '4px 2px' }}>
                  {t('staff.desk.noFreeCopy')}
                </div>
              )}
              {copyResults.map((r) => (
                <button key={r.tracking_number} onClick={() => setCart([...cart, r])} style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
                  border: '1px solid ' + shell.border, borderRadius: radius.alert,
                  padding: '8px 10px', cursor: 'pointer', textAlign: 'left', fontFamily: font.ui,
                }}>
                  <Spine src={r.cover_url ? assetUrl(r.cover_url) : ''} seed={r.title} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 13, fontWeight: 700,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{r.title}</span>
                    <Mono style={{ display: 'block', fontSize: 11 }}>{r.tracking_number}</Mono>
                  </span>
                  <span style={{ color: '#1580B5', fontWeight: 800 }}>+</span>
                </button>
              ))}
            </div>
          </div>

          {/* ---------------------------------------------- 3 · basket */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 8, flexWrap: 'wrap',
            }}>
              <Label>{t('staff.desk.step3', { n: cart.length })}</Label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: ink.dim, marginRight: 4 }}>
                  {t('staff.desk.period')}
                </span>
                {LOAN_PERIODS.map((d) => (
                  <Chip key={d} on={days === d} onClick={() => setDays(d)}>
                    {t('staff.desk.nDays', { n: d })}
                  </Chip>
                ))}
              </div>
            </div>

            {cart.length === 0 ? (
              <div style={{
                border: '1px dashed ' + shell.control, borderRadius: radius.alert,
                padding: 16, textAlign: 'center', color: ink.dim,
              }}>{t('staff.desk.basketEmpty')}</div>
            ) : cart.map((ci) => (
              <div key={ci.tracking_number} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                border: '1px solid ' + shell.border, borderRadius: radius.alert, padding: '8px 10px',
              }}>
                <Spine src={ci.cover_url ? assetUrl(ci.cover_url) : ''} seed={ci.title} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{ci.title}</strong>{' '}
                  <Mono style={{ fontSize: 11 }}>{ci.tracking_number}</Mono>
                </span>
                <span style={{ fontSize: 12, color: ink.body }}>
                  {t('staff.desk.dueOn', { date: fmtDate(due) })}
                </span>
                <button
                  onClick={() => setCart(cart.filter((c) => c.tracking_number !== ci.tracking_number))}
                  aria-label={t('common.delete')}
                  style={{ background: 'none', border: 0, color: ink.muted, cursor: 'pointer', fontSize: 14 }}
                >✕</button>
              </div>
            ))}

            <Btn
              onClick={checkout} disabled={busy || cart.length === 0}
              style={{ alignSelf: 'flex-end', padding: '10px 18px', fontSize: 14 }}
            >{t('staff.desk.confirmOut')}</Btn>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- check in */

function CheckIn({ t, say, reload }) {
  const [loans, setLoans] = useState([]);
  const [holdsByBook, setHoldsByBook] = useState({});
  const [conditions, setConditions] = useState([]);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState(null);
  const [condition, setCondition] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/loans').then((r) => setLoans(r.data || [])).catch(() => {});
    // A hold waiting on the same title turns the return into a shelf action,
    // which is the amber alert in the design.
    api.get('/reservations').then((r) => {
      const m = {};
      (r.data || []).forEach((res) => {
        if (!['PENDING', 'APPROVED'].includes(res.status?.code)) return;
        const bid = res.book_copy?.book_id;
        if (bid) m[bid] = res.student?.name || t('staff.holds.someone');
      });
      setHoldsByBook(m);
    }).catch(() => {});
  }, [t]);
  useEffect(() => { load(); }, [load]);

  // The condition chips are this branch's own condition rows — librarians name
  // them themselves in Settings, so hard-coding three would be a fiction.
  useEffect(() => {
    api.get('/copy-conditions').then((r) => setConditions(r.data || [])).catch(() => {});
  }, []);

  const term = q.trim().toLowerCase();
  const shown = (term
    ? loans.filter((l) =>
      (l.book_copy?.tracking_number || '').toLowerCase().includes(term)
      || (l.student?.name || '').toLowerCase().includes(term)
      || (l.book_copy?.book?.title || '').toLowerCase().includes(term))
    : loans).slice(0, 8);

  const lateDays = (l) => (l?.due_date
    ? Math.floor((new Date() - new Date(l.due_date)) / 86400000) : 0);

  const confirm = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await api.post(`/return/${chosen.id}`, condition ? { condition_id: condition } : {});
      say(t('staff.desk.returned'));
      setChosen(null); setQ(''); setCondition(0);
      load(); reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const late = lateDays(chosen);
  const hold = chosen ? holdsByBook[chosen.book_copy?.book_id] : null;

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Input big autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={t('staff.desk.scanReturn')} />

      {!chosen ? (
        <div style={{
          display: 'flex', flexDirection: 'column', border: '1px solid ' + shell.border,
          borderRadius: radius.alert, overflow: 'hidden',
        }}>
          {shown.length === 0 && (
            <div style={{ padding: 14, fontSize: 13, color: ink.dim }}>{t('staff.desk.noMatch')}</div>
          )}
          {shown.map((l) => {
            const n = lateDays(l);
            return (
              <button key={l.id} onClick={() => setChosen(l)} style={{
                display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: 0,
                borderBottom: '1px solid ' + shell.rowLine, padding: '10px 12px',
                cursor: 'pointer', textAlign: 'left', fontFamily: font.ui,
              }}>
                <Spine
                  src={l.book_copy?.book?.cover_url ? assetUrl(l.book_copy.book.cover_url) : ''}
                  seed={l.book_copy?.book?.title}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 14, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{l.book_copy?.book?.title || '—'}</span>
                  <span style={{ display: 'block', fontSize: 12, color: ink.dim }}>
                    {l.student?.name} · {t('staff.desk.dueOn', {
                      date: l.due_date ? fmtDate(l.due_date) : '—',
                    })}
                  </span>
                </span>
                <Mono style={{ fontSize: 11 }}>{l.book_copy?.tracking_number}</Mono>
                <Pill colors={n > 0 ? overdueColors(n) : pill('out')}>
                  {n > 0 ? t('staff.desk.overdueDays', { n }) : t('staff.pill.onLoan')}
                </Pill>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
            background: shell.headerBg, border: '1px solid ' + shell.border,
            borderRadius: radius.alert, padding: 14,
          }}>
            <Spine
              src={chosen.book_copy?.book?.cover_url ? assetUrl(chosen.book_copy.book.cover_url) : ''}
              seed={chosen.book_copy?.book?.title} w={40} h={60}
            />
            <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 15 }}>{chosen.book_copy?.book?.title || '—'}</strong>
              <span style={{ color: ink.body }}>
                {t('staff.desk.borrowedBy', { name: chosen.student?.name || '—' })}
              </span>
              <span style={{ color: ink.body }}>
                {t('staff.desk.dueOn', {
                  date: chosen.due_date ? fmtDate(chosen.due_date) : '—',
                })} · <Mono>{chosen.book_copy?.tracking_number}</Mono>
              </span>
            </div>
            <Btn kind="secondary" onClick={() => setChosen(null)}>{t('common.cancel')}</Btn>
          </div>

          {late > 0 && <Alert tone="problem">{t('staff.desk.returnedLate', { n: late })}</Alert>}
          {hold && <Alert tone="action">{t('staff.desk.holdWaiting', { name: hold })}</Alert>}

          {conditions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: ink.dim, marginRight: 4 }}>
                {t('staff.desk.condition')}
              </span>
              {conditions.map((c) => (
                <Chip key={c.id} on={condition === c.id} onClick={() => setCondition(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          )}

          <Btn onClick={confirm} disabled={busy}
            style={{ alignSelf: 'flex-end', padding: '10px 18px', fontSize: 14 }}>
            {t('staff.desk.confirmIn')}
          </Btn>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- today */

function TodayAtTheDesk({ summary, t }) {
  const rows = summary?.today || [];
  return (
    <div style={{
      flex: '1 1 300px', background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid ' + shell.border,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ink.text }}>
          {t('staff.desk.today')}
        </h2>
        <span style={{ fontSize: 12, color: ink.dim }}>
          {fmtDayMonth(new Date())}
        </span>
      </div>

      {rows.length === 0 && (
        <div style={{ padding: 18, fontSize: 13, color: ink.dim }}>{t('staff.desk.nothingToday')}</div>
      )}

      {rows.map((r, i) => {
        const when = r.action === 'out' ? r.issue_date : r.return_date;
        return (
          <div key={`${r.loan_id}-${r.action}-${i}`} style={{
            display: 'flex', gap: 12, padding: '10px 16px',
            borderBottom: '1px solid ' + shell.rowLine, alignItems: 'flex-start',
          }}>
            <Mono style={{ width: 40, flexShrink: 0, paddingTop: 1 }}>
              {when ? fmtTime(when) : ''}
            </Mono>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
              background: r.action === 'out' ? '#1B9DD9' : '#16A34A',
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {r.action === 'out' ? t('staff.pill.checkedOut') : t('staff.pill.returned')} · {r.title}
              </div>
              <div style={{ fontSize: 12, color: ink.dim }}>
                {r.student_name}{r.student_grade ? ` · ${r.student_grade}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- misc */

function initialsOf(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '·';
}

function gradeOf(s) {
  if (!s?.grade) return '';
  return `${s.grade}${s.class_group ? '-' + s.class_group : ''}`;
}
