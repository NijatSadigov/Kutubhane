// S-extra · Members — the branch's readers, and how they get an account.
//
// The design has no librarian members screen: S8 "Branches & users" belongs to
// the school admin and covers every role across every branch. But the working
// system has always given a librarian a class list, a reader's statistics and
// the branch invite links students register with, and losing those in the
// migration would take away the only way to enrol a class.
//
// So this borrows S8's shape — a KPI strip, a searchable 44px table, a side
// panel for the selected row — scoped to one branch and one role.
//
// The invite codes used to be a modal here; they are now the domain's second
// screen, in `MemberInvites.jsx`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, pill, overdueColors } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Avatar, Mono, Alert } from '../components/StaffShell';
import { Dialog } from './InventoryDialogs';
import { fmtDate } from '../../i18n/dates';

const COLS = 'minmax(0,1.8fr) 90px 90px 110px 120px';

export default function Members() {
  const { t } = useTranslation();
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'classes'
  const [openClass, setOpenClass] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    api.get('/class-list').then((r) => setStudents(r.data || [])).catch(() => {});
  }, [reloadKey]);

  // Everything a librarian at the desk might have in their head when they
  // start typing: the child, how to reach them, where they sit, and — the one
  // that is not about the person at all — the book they are holding. "Who has
  // 1984?" is a question asked across the counter every day, and it used to
  // have no answer on this screen.
  //
  // Terms are ANDed, so "7-a gecikmiş" narrows twice rather than widening.
  const haystack = useCallback((s) => [
    s.name,
    s.email,
    s.classroom_label,
    s.grade ? `${s.grade}-${s.class_group || ''}` : '',
    s.grade,
    s.class_group,
    s.status,
    ...(s.loans || []).filter((l) => !l.return_date).flatMap((l) => [
      l.book_copy?.book?.title,
      l.book_copy?.tracking_number,
    ]),
  ].filter(Boolean).join(' ').toLowerCase(), []);

  const shown = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return students;
    return students.filter((s) => {
      const hay = haystack(s);
      return terms.every((term) => hay.includes(term));
    });
  }, [students, q, haystack]);

  // The same readers, grouped by the class they sit in. Built from the
  // *filtered* list, so searching narrows the cards as well as the table
  // rather than the two views disagreeing about what is being looked at.
  //
  // Readers with no classroom are a card of their own rather than being
  // dropped: a branch's list is not allowed to quietly lose people, and an
  // unassigned reader is usually exactly who a librarian is hunting for.
  const classCards = useMemo(() => {
    const by = new Map();
    shown.forEach((s) => {
      const key = s.classroom_label || gradeOf(s) || '';
      const card = by.get(key) || { key, label: key, students: [], out: 0, late: 0 };
      const open = (s.loans || []).filter((l) => !l.return_date);
      card.out += open.length;
      if (open.some((l) => l.due_date && new Date(l.due_date) < new Date())) card.late++;
      card.students.push(s);
      by.set(key, card);
    });
    return [...by.values()].sort((a, b) => {
      // Unassigned last; otherwise by grade then letter, read out of the label.
      if (!a.key) return 1;
      if (!b.key) return -1;
      const [ag, al] = a.key.split('-');
      const [bg, bl] = b.key.split('-');
      return (Number(ag) - Number(bg)) || String(al || '').localeCompare(String(bl || ''));
    });
  }, [shown]);

  const totals = useMemo(() => {
    let out = 0, late = 0, withBooks = 0;
    students.forEach((s) => {
      const open = (s.loans || []).filter((l) => !l.return_date);
      out += open.length;
      if (open.length) withBooks++;
      if (open.some((l) => l.due_date && new Date(l.due_date) < new Date())) late++;
    });
    return { members: students.length, out, late, withBooks };
  }, [students]);

  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.mem.kpiMembers')} value={totals.members} />
        <Kpi label={t('staff.mem.kpiWithBooks')} value={totals.withBooks} />
        <Kpi label={t('staff.mem.kpiOut')} value={totals.out} />
        <Kpi
          label={t('staff.mem.kpiLate')} value={totals.late}
          note={totals.late ? t('staff.mem.lateNote') : ''} noteColor="#B4232A"
        />
      </KpiRow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('staff.mem.search')}
          style={{ flex: '1 1 260px', width: 'auto' }}
        />
        {/* The design's own screens-within-a-screen control, the same one the
            Verilən kitablar filter uses. Two ways of looking at one branch:
            every reader at once, or class by class. */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['list', t('staff.mem.viewList')], ['classes', t('staff.mem.viewClasses')]].map(([v, label]) => {
            const on = view === v;
            return (
              <button key={v} onClick={() => { setView(v); setOpenClass(null); }} style={{
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: radius.control, padding: '8px 14px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{label}</button>
            );
          })}
        </div>
      </div>

      {view === 'classes' && (
        <ClassCards
          classes={classCards} openClass={openClass} setOpenClass={setOpenClass}
          selected={selected} setSelected={setSelected} t={t}
        />
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{
          flex: '999 1 520px', minWidth: 0, background: '#fff',
          border: '1px solid ' + shell.border, borderRadius: radius.card, overflowX: 'auto',
          display: view === 'list' ? undefined : 'none',
        }}>
          <div style={{ minWidth: 560 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
              padding: '10px 16px', background: shell.headerBg,
              borderBottom: '1px solid ' + shell.border,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: ink.dim,
            }}>
              <span>{t('staff.col.student')}</span>
              <span>{t('staff.mem.grade')}</span>
              <span>{t('staff.mem.onLoan')}</span>
              <span>{t('staff.mem.limit')}</span>
              <span>{t('staff.col.status')}</span>
            </div>

            {shown.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim }}>
                {t('staff.mem.none')}
              </div>
            )}

            {shown.map((s) => {
              const open = (s.loans || []).filter((l) => !l.return_date);
              const worst = open.reduce((n, l) => {
                if (!l.due_date) return n;
                const d = Math.floor((new Date() - new Date(l.due_date)) / 86400000);
                return d > n ? d : n;
              }, 0);
              const on = selected?.user_id === s.user_id;
              return (
                <div
                  key={s.user_id} onClick={() => setSelected(on ? null : s)}
                  style={{
                    display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
                    padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine,
                    fontSize: 13, minHeight: 44, cursor: 'pointer',
                    background: on ? shell.rowSelected : 'transparent',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar initials={initialsOf(s.name)} size={28} />
                    <strong style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.name}</strong>
                  </span>
                  <span style={{ color: ink.body }}>{gradeOf(s) || '—'}</span>
                  <span style={{ fontWeight: 700 }}>{open.length}</span>
                  <span style={{ color: ink.body }}>
                    {s.borrow_limit ? t('staff.mem.custom', { n: s.borrow_limit }) : t('staff.mem.default')}
                  </span>
                  {worst > 0
                    ? <Pill colors={overdueColors(worst)}>{t('staff.desk.overdueDays', { n: worst })}</Pill>
                    : <Pill colors={pill(open.length ? 'out' : 'available')}>
                      {open.length ? t('staff.pill.onLoan') : t('staff.mem.clear')}
                    </Pill>}
                </div>
              );
            })}
          </div>
        </div>

        {selected && (
          <ReaderPanel
            student={selected} t={t} say={say} reload={reload}
            onClose={() => setSelected(null)}
          />
        )}
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

/* ------------------------------------------------------- reader panel */

// The side panel from S8: who they are, what they have out, what they have
// read, and the one setting a librarian may change — their borrow limit.
function ReaderPanel({ student, t, say, reload, onClose }) {
  const [stats, setStats] = useState(null);
  const [holds, setHolds] = useState(null);
  const [limit, setLimit] = useState(student.borrow_limit ? String(student.borrow_limit) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLimit(student.borrow_limit ? String(student.borrow_limit) : '');
    api.get(`/student/${student.user_id}/stats`).then((r) => setStats(r.data)).catch(() => setStats(null));
    api.get(`/student/${student.user_id}/holds`).then((r) => setHolds(r.data)).catch(() => setHolds(null));
  }, [student]);

  const saveLimit = async () => {
    setBusy(true);
    try {
      await api.put(`/student/${student.user_id}/limit`, {
        limit: limit.trim() === '' ? null : Number(limit),
      });
      say(t('staff.mem.limitSaved'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const open = (student.loans || []).filter((l) => !l.return_date);

  return (
    <aside style={{
      flex: '1 1 300px', background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid ' + shell.border,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Avatar initials={initialsOf(student.name)} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{student.name}</div>
          <div style={{ fontSize: 12, color: ink.dim }}>{gradeOf(student)}</div>
        </div>
        <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}>✕</Btn>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label={t('staff.mem.booksRead')} value={stats?.total_books_read ?? '—'} />
          <Stat label={t('staff.mem.favGenre')} value={stats?.favorite_genre || '—'} />
        </div>

        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: ink.dim, marginBottom: 6,
          }}>{t('staff.mem.currentLoans')}</div>
          {open.length === 0 ? (
            <div style={{ fontSize: 13, color: ink.dim }}>{t('staff.mem.noLoans')}</div>
          ) : open.map((l) => {
            const late = l.due_date
              ? Math.floor((new Date() - new Date(l.due_date)) / 86400000) : 0;
            return (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 8, padding: '6px 0', fontSize: 13,
                borderBottom: '1px solid ' + shell.rowLine,
              }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.book_copy?.book?.title || t('staff.desk.aBook')}
                </span>
                <Pill colors={late > 0 ? overdueColors(late) : pill('out')}>
                  {late > 0
                    ? t('staff.desk.overdueDays', { n: late })
                    : t('staff.desk.dueOn', { date: fmtDate(l.due_date) })}
                </Pill>
              </div>
            );
          })}
        </div>

        {/* The borrow limit: a branch default, with an optional per-student
            override. The design has no UI for it anywhere; without this a
            librarian cannot raise a limit for a reader who needs more. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: ink.dim,
          }}>{t('staff.mem.limit')}</div>
          <div style={{ fontSize: 12, color: ink.dim }}>
            {holds ? t('staff.desk.holdsNow', { n: holds.count, limit: holds.limit ?? '—' }) : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              type="number" min={0} value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t('staff.mem.useDefault')}
              style={{ width: 120 }}
            />
            <Btn onClick={saveLimit} disabled={busy}>{t('common.save')}</Btn>
          </div>
        </div>
      </div>
    </aside>
  );
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

/* --------------------------------------------------------------- misc */

function initialsOf(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '·';
}

function gradeOf(s) {
  if (!s?.grade) return '';
  return `${s.grade}${s.class_group ? '-' + s.class_group : ''}`;
}

/* ------------------------------------------- the branch, class by class */

// Üzvlər seen as classes rather than as one long list.
//
// A librarian's questions are often about a room rather than a person — who is
// in 7-A, how many of them are holding something, is anyone late. A card
// answers all three at a glance; opening one drops to the children in it, and
// picking a child opens the same reader panel the table uses, so nothing about
// a reader is learned twice.
function ClassCards({ classes, openClass, setOpenClass, selected, setSelected, t }) {
  if (classes.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px solid ' + shell.border, borderRadius: radius.card,
        padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim,
      }}>{t('staff.mem.none')}</div>
    );
  }

  const open = classes.find((c) => c.key === openClass);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
      }}>
        {classes.map((c) => {
          const on = c.key === openClass;
          return (
            <button
              key={c.key || 'unassigned'}
              onClick={() => { setOpenClass(on ? null : c.key); setSelected(null); }}
              style={{
                textAlign: 'left', cursor: 'pointer', font: 'inherit',
                background: on ? '#082F49' : '#fff',
                color: on ? '#fff' : ink.text,
                border: '1px solid ' + (on ? '#082F49' : shell.border),
                borderRadius: radius.card, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {c.label || t('staff.mem.noClass')}
              </span>
              <span style={{ fontSize: 12, color: on ? '#BAE6FD' : ink.dim }}>
                {t('staff.mem.cardStudents', { n: c.students.length })}
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <Pill colors={pill(c.out ? 'out' : 'available')}>
                  {t('staff.mem.cardOut', { n: c.out })}
                </Pill>
                {c.late > 0 && (
                  <Pill colors={pill('overdue')}>{t('staff.mem.cardLate', { n: c.late })}</Pill>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {open && (
        <div style={{
          background: '#fff', border: '1px solid ' + shell.border,
          borderRadius: radius.card, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', background: shell.headerBg,
            borderBottom: '1px solid ' + shell.border,
            fontSize: 13, fontWeight: 800,
          }}>
            {open.label || t('staff.mem.noClass')}
            <span style={{ fontWeight: 600, color: ink.dim }}>
              {' · '}{t('staff.mem.cardStudents', { n: open.students.length })}
            </span>
          </div>
          {open.students.map((s) => {
            const openLoans = (s.loans || []).filter((l) => !l.return_date);
            const worst = openLoans.reduce((n, l) => {
              if (!l.due_date) return n;
              const d = Math.floor((new Date() - new Date(l.due_date)) / 86400000);
              return d > n ? d : n;
            }, 0);
            const on = selected?.user_id === s.user_id;
            return (
              <div
                key={s.user_id}
                onClick={() => setSelected(on ? null : s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine,
                  fontSize: 13, minHeight: 44, cursor: 'pointer',
                  background: on ? shell.rowSelected : 'transparent',
                }}
              >
                <Avatar initials={initialsOf(s.name)} size={28} />
                <strong style={{
                  flex: 1, minWidth: 0, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.name}</strong>
                <span style={{ color: ink.dim, fontSize: 12 }}>{openLoans.length}</span>
                {worst > 0
                  ? <Pill colors={overdueColors(worst)}>{t('staff.desk.overdueDays', { n: worst })}</Pill>
                  : <Pill colors={pill(openLoans.length ? 'out' : 'available')}>
                    {openLoans.length ? t('staff.pill.onLoan') : t('staff.mem.clear')}
                  </Pill>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
