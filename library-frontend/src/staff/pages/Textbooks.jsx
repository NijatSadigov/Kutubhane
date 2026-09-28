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

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return books.filter((b) => {
      if (grade && String(b.grade) !== String(grade)) return false;
      if (!term) return true;
      return (b.title || '').toLowerCase().includes(term)
        || (b.author || '').toLowerCase().includes(term)
        || (b.subject?.name || '').toLowerCase().includes(term);
    });
  }, [books, grade, q]);

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
        <Btn onClick={() => setEditing({})} style={{ padding: '9px 14px' }}>
          {t('staff.tb.add')}
        </Btn>
      </div>

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
        <Field label={t('fld.year')}>
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
