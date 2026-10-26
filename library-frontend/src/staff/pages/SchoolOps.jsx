// Məktəb — the school administrator's operational view, across every branch.
//
// This is the last thing the old /manager dashboard did that the console could
// not: look at a branch's circulation, the school's readers, the school-wide
// book-request queue, and what each librarian is carrying.
//
// READ-ONLY, ON PURPOSE, except the request queue. The branch desk, the member
// list and the library's own settings are IsLibrarian-guarded, and a school
// administrator does not run a branch's desk — they look at it. The one thing
// they decide is whether the school will buy a book a reader asked for, which
// is an administrative decision and has its own endpoint.
//
// The school comes from the caller's identity in every one of these endpoints,
// never from anything this screen sends. A platform admin is not offered the
// domain at all: resolveManagerSchoolID() reads a manager profile, which an
// admin has none of — see the note in staff/nav.js.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate, daysOverdue } from '../../i18n/dates';
import { genreLabel } from '../../i18n/genres';
import { shell, ink, radius, pill, overdueColors } from '../theme';
import {
  Avatar, Kpi, KpiRow, Pill, Btn, Input, Alert, PageIntro, Table, Row, Spine,
} from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';

/* ------------------------------------------------- the school's branches */

// Every screen here needs the school's branch list, and three of them need
// nothing else from /manager/school. Shared so the rail's four screens do not
// each invent their own loading and failure states.
function useBranches() {
  const [branches, setBranches] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/manager/school')
      .then((r) => { if (alive) setBranches(r.data?.branches || []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  return { branches, failed };
}

/* ----------------------------------------------------- branch workspace */

// The three things a branch holds, under the names the librarian's own top bar
// gives them — so the same thing is not called two things in one console.
// (`nav.loans` exists, but reads as "data" in Azerbaijani.)
const VIEWS = [
  { key: 'books', labelKey: 'staff.nav.inventory' },
  { key: 'loans', labelKey: 'staff.nav.loans' },
  { key: 'reservations', labelKey: 'staff.nav.reservations' },
];

export function BranchWorkspace() {
  const { t } = useTranslation();
  const { branches, failed } = useBranches();
  // No branch is chosen until someone clicks one; the first in the list is a
  // default, not state, so the list arriving does not have to write any.
  const [picked, setPicked] = useState(null);
  const [view, setView] = useState('books');
  const branchID = picked ?? branches?.[0]?.id ?? null;

  // What came back, and *what it is of*. Kept as one value so switching
  // branches shows "loading" rather than the previous branch's rows for a
  // moment, without an effect that clears state before fetching.
  const [got, setGot] = useState(null);
  const key = `${branchID}/${view}`;

  useEffect(() => {
    if (!branchID) return undefined;
    let alive = true;
    api.get(`/manager/branch/${branchID}/${view}`)
      .then((r) => { if (alive) setGot({ key, rows: r.data || [] }); })
      .catch(() => { if (alive) setGot({ key, rows: null }); });
    return () => { alive = false; };
  }, [branchID, view, key]);

  if (failed) return <Alert tone="problem">{t('staff.so.failed')}</Alert>;
  if (branches === null) return <PageIntro>{t('common.loading')}</PageIntro>;
  if (branches.length === 0) return <Alert tone="action">{t('staff.ss.noBranches')}</Alert>;

  const current = got && got.key === key ? got : null;
  const rows = current?.rows ?? null;

  return (
    <>
      <PageIntro>{t('staff.so.branchIntro')}</PageIntro>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Chips rather than a dropdown: a school has a handful of branches,
            and the reader count belongs on the chip that selects it. */}
        {branches.map((b) => (
          <Btn key={b.id} kind={b.id === branchID ? 'primary' : 'secondary'}
            onClick={() => setPicked(b.id)} style={{ padding: '6px 12px' }}>
            {b.name} · {b.student_count || 0}
          </Btn>
        ))}
        <span style={{ width: 1, alignSelf: 'stretch', background: shell.border, margin: '0 6px' }} />
        {VIEWS.map((v) => (
          <Btn key={v.key} kind={v.key === view ? 'primary' : 'secondary'}
            onClick={() => setView(v.key)} style={{ padding: '6px 12px' }}>
            {t(v.labelKey)}
          </Btn>
        ))}
      </div>

      {current === null ? <PageIntro>{t('common.loading')}</PageIntro>
        : rows === null ? <Alert tone="problem">{t('staff.so.failed')}</Alert>
          : view === 'books' ? <BranchBooks rows={rows} t={t} />
            : view === 'loans' ? <BranchLoans rows={rows} t={t} />
              : <BranchReservations rows={rows} t={t} />}

      <Note>{t('staff.so.readOnlyNote')}</Note>
    </>
  );
}

const BOOK_COLS = '2fr 1fr .6fr .9fr';

function BranchBooks({ rows, t }) {
  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.so.titles')} value={rows.length} />
        <Kpi label={t('staff.col.copies')} value={rows.reduce((n, b) => n + (b.copies || []).length, 0)} />
        <Kpi label={t('ws.available')}
          value={rows.reduce((n, b) => n + (b.copies || []).filter((c) => c.status?.code === 'AVAILABLE').length, 0)} />
      </KpiRow>
      <Table
        columns={BOOK_COLS}
        head={[t('staff.col.title'), t('staff.col.genre'), t('staff.col.copies'), t('ws.available')]}
        empty={rows.length === 0 ? t('staff.inv.none') : null}
      >
        {rows.map((b) => {
          const copies = b.copies || [];
          const free = copies.filter((c) => c.status?.code === 'AVAILABLE').length;
          return (
            <Row key={b.id} columns={BOOK_COLS}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Spine src={b.cover_url ? assetUrl(b.cover_url) : ''} seed={b.title} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', ...clip }}>{b.title}</strong>
                  <span style={{ fontSize: 12, color: ink.dim }}>{b.author?.name || '—'}</span>
                </span>
              </span>
              <span style={{ color: ink.body, ...clip }}>
                {b.genre?.name ? genreLabel(b.genre.name, t) : '—'}
              </span>
              <span style={{ fontWeight: 700 }}>{copies.length}</span>
              <span>
                {free > 0
                  ? <Pill colors={pill('available')}>{free}</Pill>
                  : <Pill colors={pill('neutral')}>0</Pill>}
              </span>
            </Row>
          );
        })}
      </Table>
    </>
  );
}

const LOAN_COLS = '1.3fr .5fr 1.6fr 1fr';

function BranchLoans({ rows, t }) {
  // Whole calendar days late, the same way the desk counts them — see
  // overdueDays() in handlers/desk.go and daysOverdue() in i18n/dates.js.
  const late = rows.filter((l) => daysOverdue(l.due_date) > 0).length;
  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.kpi.activeLoans')} value={rows.length} />
        <Kpi label={t('staff.kpi.overdue')} value={late}
          note={rows.length ? t('staff.an.ofAll', { pct: Math.round((late * 100) / rows.length) }) : ''}
          noteColor={late > 0 ? '#B4232A' : undefined} />
      </KpiRow>
      <Table
        columns={LOAN_COLS}
        head={[t('th.student'), t('staff.an.class'), t('req.fTitle'), t('ws.due')]}
        empty={rows.length === 0 ? t('msg.noRecords') : null}
      >
        {rows.map((l) => {
          const over = daysOverdue(l.due_date);
          return (
            <Row key={l.id} columns={LOAN_COLS}>
              <span style={{ fontWeight: 600, ...clip }}>{l.student?.name || '—'}</span>
              <span style={{ color: ink.dim }}>{classOf(l.student)}</span>
              <span style={{ color: ink.body, ...clip }}>{l.book_copy?.book?.title || '—'}</span>
              <span>
                <Pill colors={over > 0 ? overdueColors(over) : pill('out')}>
                  {over > 0
                    ? t('staff.desk.overdueDays', { n: over })
                    : t('staff.desk.dueOn', { date: fmtDate(l.due_date) })}
                </Pill>
              </span>
            </Row>
          );
        })}
      </Table>
    </>
  );
}

const RES_COLS = '1.3fr .5fr 1.6fr 1fr';

function BranchReservations({ rows, t }) {
  const waiting = rows.filter(
    (r) => r.status?.code === 'PENDING' || r.status?.code === 'APPROVED',
  ).length;
  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.kpi.holds')} value={rows.length} />
        <Kpi label={t('staff.so.waiting')} value={waiting} />
      </KpiRow>
      <Table
        columns={RES_COLS}
        head={[t('th.student'), t('staff.an.class'), t('req.fTitle'), t('th.status')]}
        empty={rows.length === 0 ? t('msg.noRecords') : null}
      >
        {rows.map((r) => {
          const code = r.status?.code;
          return (
            <Row key={r.id} columns={RES_COLS}>
              <span style={{ fontWeight: 600, ...clip }}>{r.student?.name || '—'}</span>
              <span style={{ color: ink.dim }}>{classOf(r.student)}</span>
              <span style={{ color: ink.body, ...clip }}>{r.book_copy?.book?.title || '—'}</span>
              <span>
                {/* Colour *and* words, never colour alone — the status name is
                    already localised by the branch that defined it. */}
                <Pill colors={code === 'APPROVED' ? pill('ready')
                  : code === 'PENDING' ? pill('hold') : pill('neutral')}>
                  {r.status?.name || '—'}
                </Pill>
              </span>
            </Row>
          );
        })}
      </Table>
    </>
  );
}

/* ---------------------------------------------------------- the readers */

const READER_COLS = '1.6fr 1fr .6fr .8fr';

export function SchoolReaders() {
  const { t } = useTranslation();
  const [students, setStudents] = useState(null);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/manager/students')
      .then((r) => { if (alive) setStudents(r.data || []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = students || [];
    if (!q) return list;
    return list.filter((s) => (s.name || '').toLowerCase().includes(q)
      || (s.branch?.name || '').toLowerCase().includes(q)
      || classOf(s).toLowerCase().includes(q));
  }, [students, term]);

  if (failed) return <Alert tone="problem">{t('staff.so.failed')}</Alert>;
  if (students === null) return <PageIntro>{t('common.loading')}</PageIntro>;

  return (
    <>
      <PageIntro>{t('staff.so.readersIntro')}</PageIntro>

      <KpiRow>
        <Kpi label={t('staff.ss.readers')} value={students.length} />
        <Kpi label={t('staff.so.withoutClass')}
          value={students.filter((s) => !s.grade).length} />
      </KpiRow>

      <div style={{ maxWidth: 320 }}>
        <Input value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder={t('staff.so.readerSearch')} />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 520px' }}>
          <Table
            columns={READER_COLS}
            head={[t('f.fullName'), t('manager.branch'), t('staff.an.class'), t('th.status')]}
            empty={shown.length === 0 ? t('msg.noStudents') : null}
          >
            {shown.map((s) => (
              <Row key={s.user_id} columns={READER_COLS}
                selected={picked?.user_id === s.user_id}
                onClick={() => setPicked(s)}>
                <span style={{ fontWeight: 600, ...clip }}>{s.name}</span>
                <span style={{ color: ink.dim, ...clip }}>{s.branch?.name || '—'}</span>
                <span>
                  {/* A reader with no class is missing from every class
                      standing and every class dashboard, so it is called out
                      rather than drawn as a dash among dashes. */}
                  {s.grade
                    ? classOf(s)
                    : <Pill colors={pill('hold')}>{t('staff.pr.noClass')}</Pill>}
                </span>
                <span>
                  <Pill colors={s.status === 'ACTIVE' ? pill('active') : pill('neutral')}>
                    {s.status === 'ACTIVE' ? t('staff.so.active') : (s.status || '—')}
                  </Pill>
                </span>
              </Row>
            ))}
          </Table>
        </div>

        {picked && <ReaderCard student={picked} t={t} onClose={() => setPicked(null)} />}
      </div>
    </>
  );
}

// What a school administrator may know about one reader: what they have read
// and what they are holding. No limit, no class, no notes — those are the
// librarian's, on the branch's own member list.
function ReaderCard({ student, t, onClose }) {
  // Both calls and the reader they are about, as one value: picking a second
  // reader then cannot show the first one's numbers under the second's name.
  const [got, setGot] = useState(null);
  const id = student.user_id;

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get(`/student/${id}/stats`).then((r) => r.data).catch(() => null),
      api.get(`/student/${id}/holds`).then((r) => r.data).catch(() => null),
    ]).then(([stats, holds]) => { if (alive) setGot({ id, stats, holds }); });
    return () => { alive = false; };
  }, [id]);

  const fresh = got && got.id === id ? got : null;
  const stats = fresh?.stats;
  const open = fresh?.holds?.active_loans || [];

  return (
    <aside style={{
      flex: '1 1 300px', background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid ' + shell.border,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Avatar initials={initialsOf(student.name)} size={36} bg="#7C3AED" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, ...clip }}>{student.name}</div>
          <div style={{ fontSize: 12, color: ink.dim }}>
            {[student.branch?.name, classOf(student)].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}>✕</Btn>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label={t('staff.mem.booksRead')} value={stats?.total_books_read ?? '—'} />
          <Stat label={t('staff.mem.favGenre')}
            value={stats?.favorite_genre ? genreLabel(stats.favorite_genre, t) : '—'} />
        </div>

        <div>
          <Caption>{t('staff.mem.currentLoans')}</Caption>
          {open.length === 0 ? (
            <div style={{ fontSize: 13, color: ink.dim }}>{t('staff.mem.noLoans')}</div>
          ) : open.map((l) => {
            const over = daysOverdue(l.due_date);
            return (
              <div key={l.loan_id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 8, padding: '6px 0', fontSize: 13,
                borderBottom: '1px solid ' + shell.rowLine,
              }}>
                <span style={{ minWidth: 0, ...clip }}>{l.book_title}</span>
                <Pill colors={over > 0 ? overdueColors(over) : pill('out')}>
                  {over > 0
                    ? t('staff.desk.overdueDays', { n: over })
                    : t('staff.desk.dueOn', { date: fmtDate(l.due_date) })}
                </Pill>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* --------------------------------------------- the school's book requests */

const REQ_COLS = '1.2fr .9fr 1.8fr 1fr 1.4fr';

// A reader asks their branch for a book the library does not have. The
// librarian sees their own branch's queue under Kitabxana; this is the same
// queue across the school, which is where the decision to actually buy one
// is taken.
export function SchoolRequests() {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);

  const load = useCallback(() => {
    api.get('/manager/book-requests')
      .then((r) => { setRows(r.data || []); setFailed(false); })
      // "Could not load" and "nothing in the queue" are different facts, and
      // drawing the second for the first is how the librarian's own queue
      // looked empty for three sessions. See BookRequestsQueue.jsx.
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, status) => {
    setBusy(true);
    try {
      await api.put(`/manager/book-requests/${id}`, { status });
      setToast(t('staff.so.requestSaved'));
      setTimeout(() => setToast(''), 2800);
      load();
    } catch (e) {
      setToast(e.response?.data?.error || t('msg.opFailed'));
      setTimeout(() => setToast(''), 2800);
    } finally { setBusy(false); }
  };

  if (failed) return <Alert tone="problem">{t('req.loadFailed')}</Alert>;
  if (rows === null) return <PageIntro>{t('common.loading')}</PageIntro>;

  const pending = rows.filter((r) => r.status === 'PENDING');
  const shown = onlyOpen ? pending : rows;

  return (
    <>
      <PageIntro>{t('staff.so.requestsIntro')}</PageIntro>
      {toast && <Alert tone="action">{toast}</Alert>}

      <KpiRow>
        <Kpi label={t('req.PENDING')} value={pending.length} />
        <Kpi label={t('req.FULFILLED')} value={rows.filter((r) => r.status === 'FULFILLED').length} />
        <Kpi label={t('req.REJECTED')} value={rows.filter((r) => r.status === 'REJECTED').length} />
      </KpiRow>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn kind={onlyOpen ? 'primary' : 'secondary'} onClick={() => setOnlyOpen(true)}
          style={{ padding: '6px 12px' }}>{t('staff.so.onlyOpen')}</Btn>
        <Btn kind={onlyOpen ? 'secondary' : 'primary'} onClick={() => setOnlyOpen(false)}
          style={{ padding: '6px 12px' }}>{t('staff.so.allRequests')}</Btn>
      </div>

      <Table
        columns={REQ_COLS}
        head={[t('th.student'), t('manager.branch'), t('req.fTitle'), t('th.status'), '']}
        empty={shown.length === 0
          // "Nothing waiting" and "no requests at all" are different facts,
          // and the filter is the only thing that tells them apart.
          ? (onlyOpen && rows.length > 0 ? t('staff.so.noneWaiting') : t('req.none'))
          : null}
      >
        {shown.map((r) => (
          <Row key={r.id} columns={REQ_COLS}>
            <span style={{ fontWeight: 600, ...clip }}>{r.student?.name || '—'}</span>
            <span style={{ color: ink.dim, ...clip }}>{r.branch?.name || '—'}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', color: ink.text, ...clip }}>{r.title}</span>
              <span style={{ fontSize: 12, color: ink.dim }}>
                {[r.author, r.note].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            <span>
              <Pill colors={r.status === 'PENDING' ? pill('hold')
                : r.status === 'FULFILLED' ? pill('active') : pill('neutral')}>
                {t('req.' + r.status)}
              </Pill>
            </span>
            <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {r.status === 'PENDING' && (
                <>
                  <Btn disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={() => decide(r.id, 'FULFILLED')}>{t('req.fulfill')}</Btn>
                  <Btn kind="danger" disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={() => decide(r.id, 'REJECTED')}>{t('req.reject')}</Btn>
                </>
              )}
            </span>
          </Row>
        ))}
      </Table>
    </>
  );
}

/* ----------------------------------------------------- librarian tracking */

const LIB_COLS = '1.6fr 1fr .7fr .7fr .7fr .8fr .9fr .9fr';

// What each librarian is carrying. The numbers are the branch's, not the
// person's — two librarians in one branch read the same figures, because the
// work is the branch's catalogue and the branch's queue. Said in the note
// rather than left for someone to deduce from two identical rows.
export function LibrarianTracking() {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/manager/librarian-stats')
      .then((r) => { if (alive) setRows(r.data || []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  if (failed) return <Alert tone="problem">{t('staff.so.failed')}</Alert>;
  if (rows === null) return <PageIntro>{t('common.loading')}</PageIntro>;

  // Summed per *branch*, not per row. Every librarian in a branch reports that
  // branch's figures, so adding the rows up would have told a school with ten
  // loans out that it had twenty — a headline contradicting the table under it.
  const perBranch = new Map();
  rows.forEach((l) => { if (!perBranch.has(l.branch_id)) perBranch.set(l.branch_id, l); });
  const branchRows = [...perBranch.values()];
  const onLoan = branchRows.reduce((n, l) => n + (l.active_loans || 0), 0);
  const unattended = branchRows.reduce((n, l) => n + (l.pending_requests || 0), 0);

  return (
    <>
      <PageIntro>{t('staff.so.librariansIntro')}</PageIntro>

      <KpiRow>
        <Kpi label={t('staff.ss.librarians')} value={rows.length} />
        <Kpi label={t('mtrack.activeLoans')} value={onLoan} />
        {/* The rail cannot carry this count for a school administrator —
            /desk/summary is branch-scoped and IsLibrarian-guarded — so the
            screen itself has to say when something is waiting. */}
        <Kpi label={t('mtrack.pendingReq')} value={unattended}
          note={unattended > 0 ? t('staff.so.unattended') : ''}
          noteColor={unattended > 0 ? '#B4232A' : undefined} />
      </KpiRow>

      <ScrollTable
        min={900}
        columns={LIB_COLS}
        head={[t('staff.ss.name'), t('manager.branch'), t('staff.so.titles'), t('mtrack.copies'),
          t('public.students'), t('mtrack.activeLoans'), t('mtrack.pendingRes'), t('mtrack.pendingReq')]}
        empty={rows.length === 0 ? t('mtrack.noLibrarians') : null}
      >
        {rows.map((l) => (
          <div key={l.user_id} style={{
            display: 'grid', gridTemplateColumns: LIB_COLS, gap: 12, alignItems: 'center',
            padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine, fontSize: 13,
            minHeight: 44,
          }}>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', ...clip }}>{l.name}</strong>
              <span style={{ fontSize: 12, color: ink.dim, ...clip, display: 'block' }}>{l.email}</span>
            </span>
            <span style={{ color: ink.dim, ...clip }}>{l.branch_name || '—'}</span>
            <span>{l.books}</span>
            <span>{l.copies}</span>
            <span>{l.students}</span>
            <span style={{ fontWeight: 700 }}>{l.active_loans}</span>
            <span>{l.pending_reservations || '—'}</span>
            <span style={{ textAlign: 'right' }}>
              {l.pending_requests > 0
                ? <Pill colors={pill('hold')}>{l.pending_requests}</Pill>
                : <span style={{ color: ink.muted }}>0</span>}
            </span>
          </div>
        ))}
      </ScrollTable>

      <Note>{t('staff.so.librarianNote')}</Note>
    </>
  );
}

/* --------------------------------------------------------------- pieces */

const clip = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

function classOf(s) {
  if (!s?.grade) return '—';
  return `${s.grade}${s.class_group ? '-' + s.class_group : ''}`;
}

function initialsOf(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '·';
}

function Stat({ label, value }) {
  return (
    <div style={{
      flex: '1 1 120px', background: shell.headerBg, border: '1px solid ' + shell.border,
      borderRadius: radius.control, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11, color: ink.dim, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Caption({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: ink.dim, marginBottom: 6,
    }}>{children}</div>
  );
}

function Note({ children }) {
  return (
    <div style={{
      fontSize: 12, color: ink.dim, lineHeight: 1.5,
      borderTop: '1px solid ' + shell.rowLine, paddingTop: 10,
    }}>{children}</div>
  );
}
