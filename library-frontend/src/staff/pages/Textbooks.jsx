// Dərsliklər — the branch's textbook catalogue.
//
// Not the reader catalogue: these are class sets, counted rather than
// barcoded, and a row's whole story is how many exist, how many are out with
// classes and how many were lost. The "written off" column is the one people
// forget — a lost copy is gone from the class *and* from the shelf.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, pill, scrollRowStyle } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Label } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Dialog } from './InventoryDialogs';
import { Toast } from './deskShared';

const COLS = 'minmax(0,2.2fr) 130px 70px 80px 80px 90px 110px';

export default function Textbooks() {
  const { t } = useTranslation();
  const [books, setBooks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grade, setGrade] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'subjects'
  const [openSubject, setOpenSubject] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    api.get('/textbooks').then((r) => { if (alive) setBooks(r.data || []); }).catch(() => {});
    api.get('/subjects').then((r) => { if (alive) setSubjects(r.data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  const grades = useMemo(
    () => [...new Set(books.map((b) => b.grade))].sort((a, b) => a - b),
    [books],
  );

  // Everything printed on a row, plus the things a librarian knows about a
  // title that the row has no column for — its publisher, its ISBN, the year
  // and the language. Searching only title/author/subject meant the two
  // questions asked most at a desk with a delivery note in hand, "did we order
  // the Çaşıoğlu one?" and "is this ISBN already in?", had no answer here.
  //
  // The state words come from the same i18n keys the row renders, so a search
  // matches what is on screen and follows the language.
  const haystack = useCallback((b) => [
    b.title, b.author, b.subject?.name, b.publisher, b.isbn, b.language,
    b.year, b.grade,
    t('staff.tb.gradeN', { n: b.grade }),
    b.issued_copies > 0 ? t('staff.tb.out') : '',
    b.written_off_copies > 0 ? [t('staff.tb.lost'), t('staff.tb.writtenOff')].join(' ') : '',
    b.available_copies > 0 ? t('staff.tb.freeN', { n: '' }) : '',
  ].filter(Boolean).join(' ').toLowerCase(), [t]);

  // Terms are ANDed, so "riyaziyyat 5" narrows twice rather than widening.
  const shown = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return books.filter((b) => {
      if (grade && String(b.grade) !== String(grade)) return false;
      if (terms.length === 0) return true;
      const hay = haystack(b);
      return terms.every((term) => hay.includes(term));
    });
  }, [books, grade, q, haystack]);

  // The same titles grouped by the thing a dərslik is actually organised by.
  // Built from the *filtered* list, so the grade chips and the search narrow
  // the cards too rather than letting the two views disagree.
  //
  // A title with no subject gets its own card rather than vanishing — an
  // uncatalogued textbook is usually exactly the one being looked for.
  const subjectCards = useMemo(() => {
    const by = new Map();
    shown.forEach((b) => {
      const key = b.subject?.name || '';
      const card = by.get(key)
        || { key, label: key, books: [], stock: 0, out: 0, lost: 0 };
      card.books.push(b);
      card.stock += b.total_copies || 0;
      card.out += b.issued_copies || 0;
      card.lost += b.written_off_copies || 0;
      by.set(key, card);
    });
    return [...by.values()].sort((a, b) => {
      if (!a.key) return 1;
      if (!b.key) return -1;
      return a.key.localeCompare(b.key);
    });
  }, [shown]);

  const totals = useMemo(() => books.reduce((a, b) => ({
    titles: a.titles + 1,
    stock: a.stock + (b.total_copies || 0),
    out: a.out + (b.issued_copies || 0),
    lost: a.lost + (b.written_off_copies || 0),
  }), { titles: 0, stock: 0, out: 0, lost: 0 }), [books]);

  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.tb.kpiTitles')} value={totals.titles} />
        <Kpi label={t('staff.tb.kpiStock')} value={totals.stock} />
        <Kpi label={t('staff.tb.kpiOut')} value={totals.out}
          note={t('staff.tb.withClasses')} />
        <Kpi label={t('staff.tb.kpiLost')} value={totals.lost}
          note={totals.lost > 0 ? t('staff.tb.writtenOff') : ''}
          noteColor={totals.lost > 0 ? '#B4232A' : undefined} />
      </KpiRow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('staff.tb.search')} style={{ flex: '1 1 240px', width: 'auto' }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <GradeChip on={grade === ''} onClick={() => setGrade('')}>{t('staff.tb.allGrades')}</GradeChip>
          {grades.map((g) => (
            <GradeChip key={g} on={String(grade) === String(g)} onClick={() => setGrade(g)}>
              {t('staff.tb.gradeN', { n: g })}
            </GradeChip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['list', t('staff.mem.viewList')], ['subjects', t('staff.tb.viewSubjects')]].map(([v, label]) => {
            const on = view === v;
            return (
              <button key={v} onClick={() => { setView(v); setOpenSubject(null); }} style={{
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: radius.control, padding: '8px 14px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{label}</button>
            );
          })}
        </div>
        <Btn onClick={() => setEditing({})} style={{ padding: '9px 14px' }}>
          {t('staff.tb.add')}
        </Btn>
      </div>

      {view === 'subjects' && (
        <SubjectCards
          cards={subjectCards} openSubject={openSubject} setOpenSubject={setOpenSubject}
          onEdit={setEditing} t={t}
        />
      )}

      {view === 'list' && (
      <ScrollTable
        min={880} columns={COLS}
        head={[t('staff.col.book'), t('staff.tb.subject'), t('staff.tb.grade'),
          t('staff.tb.stock'), t('staff.tb.out'), t('staff.tb.lost'), t('staff.col.actions')]}
        empty={shown.length === 0 ? t('staff.tb.none') : null}
      >
        {shown.map((b) => (
          <div key={b.id} style={scrollRowStyle(COLS)}>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.title}
              </strong>
              <span style={{ fontSize: 11, color: ink.dim }}>{b.author || '—'}</span>
            </span>
            <span style={{ color: ink.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.subject?.name || '—'}
            </span>
            <span style={{ color: ink.body }}>{b.grade}</span>
            <span style={{ fontWeight: 700 }}>{b.total_copies}</span>
            <span>
              {b.issued_copies > 0
                ? <Pill colors={pill('out')}>{b.issued_copies}</Pill>
                : <span style={{ color: ink.muted }}>0</span>}
            </span>
            <span>
              {b.written_off_copies > 0
                ? <Pill colors={pill('overdue')}>{b.written_off_copies}</Pill>
                : <span style={{ color: ink.muted }}>0</span>}
            </span>
            <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 12, color: ink.dim, alignSelf: 'center' }}>
                {t('staff.tb.freeN', { n: b.available_copies })}
              </span>
              <Btn kind="secondary" onClick={() => setEditing(b)}>{t('common.edit')}</Btn>
            </span>
          </div>
        ))}
      </ScrollTable>
      )}

      {editing && (
        <TextbookDialog
          book={editing} subjects={subjects} t={t} say={say}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

function GradeChip({ on, children, ...rest }) {
  return (
    <button {...rest} style={{
      background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
      border: '1px solid ' + (on ? '#082F49' : shell.control),
      borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700,
      cursor: 'pointer', fontFamily: font.ui, whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

/* ------------------------------------------ the catalogue, subject by subject */

// The same titles seen as subjects rather than as one long list — the shape a
// dərslik catalogue is actually organised by, and the one a librarian thinks
// in when a delivery arrives for Riyaziyyat.
//
// A card answers the three questions about a subject at once: how many titles,
// how many copies exist, and how many are out with classes. Opening one lists
// its titles with the same edit action the table has, so nothing is reachable
// from one view and not the other.
function SubjectCards({ cards, openSubject, setOpenSubject, onEdit, t }) {
  if (cards.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px solid ' + shell.border, borderRadius: radius.card,
        padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim,
      }}>{t('staff.tb.none')}</div>
    );
  }

  const open = cards.find((c) => c.key === openSubject);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
      }}>
        {cards.map((c) => {
          const on = c.key === openSubject;
          return (
            <button
              key={c.key || 'nosubject'}
              onClick={() => setOpenSubject(on ? null : c.key)}
              style={{
                textAlign: 'left', cursor: 'pointer', font: 'inherit',
                background: on ? '#082F49' : '#fff',
                color: on ? '#fff' : ink.text,
                border: '1px solid ' + (on ? '#082F49' : shell.border),
                borderRadius: radius.card, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {c.label || t('staff.tb.cardNoSubject')}
              </span>
              <span style={{ fontSize: 12, color: on ? '#BAE6FD' : ink.dim }}>
                {t('staff.tb.cardTitles', { n: c.books.length })}
                {' · '}
                {t('staff.tb.cardStock', { n: c.stock })}
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <Pill colors={pill(c.out ? 'out' : 'available')}>
                  {t('staff.tb.cardOut', { n: c.out })}
                </Pill>
                {c.lost > 0 && (
                  <Pill colors={pill('overdue')}>{t('staff.tb.cardLost', { n: c.lost })}</Pill>
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
            borderBottom: '1px solid ' + shell.border, fontSize: 13, fontWeight: 800,
          }}>
            {open.label || t('staff.tb.cardNoSubject')}
            <span style={{ fontWeight: 600, color: ink.dim }}>
              {' · '}{t('staff.tb.cardTitles', { n: open.books.length })}
            </span>
          </div>
          {open.books.map((b) => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine,
              fontSize: 13, minHeight: 44,
            }}>
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                <strong style={{
                  display: 'block', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{b.title}</strong>
                <span style={{ fontSize: 11, color: ink.dim }}>
                  {[t('staff.tb.gradeN', { n: b.grade }), b.author].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span style={{ color: ink.dim, fontSize: 12 }}>
                {t('staff.tb.freeN', { n: b.available_copies })}
              </span>
              {b.issued_copies > 0 && (
                <Pill colors={pill('out')}>{b.issued_copies}</Pill>
              )}
              {b.written_off_copies > 0 && (
                <Pill colors={pill('overdue')}>{b.written_off_copies}</Pill>
              )}
              <Btn kind="secondary" onClick={() => onEdit(b)}>{t('common.edit')}</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TextbookDialog({ book, subjects, t, say, onClose, onSaved }) {
  const isNew = !book.id;
  const [form, setForm] = useState({
    title: book.title || '', author: book.author || '', publisher: book.publisher || '',
    grade: book.grade || '', subject_id: book.subject_id || '', year: book.year || '',
    isbn: book.isbn || '', language: book.language || '', total_copies: book.total_copies ?? '',
    notes: book.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const ready = form.title.trim() && Number(form.grade) >= 1;

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...form,
        grade: Number(form.grade) || 0,
        year: Number(form.year) || 0,
        total_copies: Number(form.total_copies) || 0,
        subject_id: form.subject_id ? Number(form.subject_id) : null,
      };
      if (isNew) await api.post('/textbooks', body);
      else await api.put(`/textbooks/${book.id}`, body);
      say(t('staff.inv.saved'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/textbooks/${book.id}`);
      say(t('staff.inv.deleted'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('staff.tb.deleteBlocked'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={isNew ? t('staff.tb.add') : t('staff.tb.edit')} onClose={onClose} wide t={t}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12 }}>
        <Field label={t('staff.col.book')}>
          <Input value={form.title} onChange={set('title')} />
        </Field>
        <Field label={t('staff.tb.subject')}>
          <select value={form.subject_id} onChange={set('subject_id')} style={selectStyle}>
            <option value="">{t('staff.tb.noSubject')}</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t('staff.tb.grade')}>
          <Input type="number" min={1} value={form.grade} onChange={set('grade')} />
        </Field>
        <Field label={t('th.author')}>
          <Input value={form.author} onChange={set('author')} />
        </Field>
        <Field label={t('th.publisher')}>
          <Input value={form.publisher} onChange={set('publisher')} />
        </Field>
        <Field label={t('fld.pubYear')}>
          <Input type="number" value={form.year} onChange={set('year')} />
        </Field>
        <Field label="ISBN">
          <Input value={form.isbn} onChange={set('isbn')} />
        </Field>
        <Field label={t('fld.language')}>
          <Input value={form.language} onChange={set('language')} />
        </Field>
        <Field label={t('staff.tb.stock')} hint={t('staff.tb.stockHint')}>
          <Input type="number" min={0} value={form.total_copies} onChange={set('total_copies')} />
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span>
          {!isNew && (
            <Btn kind="danger" onClick={remove} disabled={busy}>{t('common.delete')}</Btn>
          )}
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn onClick={save} disabled={busy || !ready}>{t('common.save')}</Btn>
        </span>
      </div>
    </Dialog>
  );
}

const selectStyle = {
  width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
  padding: '8px 10px', fontSize: 13, background: '#fff', fontFamily: 'inherit',
};

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Label>{label}</Label>
      {children}
      {hint && <span style={{ fontSize: 11, color: ink.dim }}>{hint}</span>}
    </label>
  );
}
