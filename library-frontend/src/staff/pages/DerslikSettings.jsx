// Dərslik sistemi ayarları — the school's own structure.
//
// Four screens behind the rail's one entry: the classes, the teachers who take
// them, the curriculum's subjects and the academic years everything is stamped
// with. All of it belongs to the school administration; a librarian does not
// decide who is in 4-A, so the endpoints behind these refuse them and the
// screens say so rather than pretending.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font, pill, scrollRowStyle } from '../theme';
import { Card, Pill, Btn, Input, Label, Alert, PageIntro } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Dialog } from './InventoryDialogs';
import { Toast } from './deskShared';

function useToast() {
  const [toast, setToast] = useState('');
  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2800); }, []);
  return [toast, say];
}

// Everything here is administration-only; when the API refuses, say why rather
// than leaving an empty table that looks like there is nothing to show.
function Denied({ t }) {
  return <Alert tone="approval">{t('staff.ds.adminOnly')}</Alert>;
}

/* --------------------------------------------------------------- classes */

const CLS_COLS = 'minmax(0,1fr) minmax(0,2fr) 110px 120px 150px';

export function SettingsClassrooms() {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [years, setYears] = useState([]);
  const [students, setStudents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [denied, setDenied] = useState(false);
  const [toast, say] = useToast();
  const [key, setKey] = useState(0);
  const reload = () => setKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    api.get('/classrooms').then((r) => { if (alive) setRooms(r.data || []); })
      .catch((e) => { if (alive && e.response?.status === 403) setDenied(true); });
    api.get('/teachers').then((r) => { if (alive) setTeachers(r.data || []); }).catch(() => {});
    api.get('/academic-years').then((r) => { if (alive) setYears(r.data || []); }).catch(() => {});
    api.get('/class-list').then((r) => { if (alive) setStudents(r.data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  if (denied) return <Denied t={t} />;

  return (
    <>
      <PageIntro>{t('staff.ds.classSub')}</PageIntro>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setEditing({})} style={{ padding: '9px 14px' }}>
          {t('staff.ds.addClass')}
        </Btn>
      </div>

      <ScrollTable
        min={760} columns={CLS_COLS}
        head={[t('staff.ds.class'), t('staff.ds.teachers'), t('staff.ds.students'),
          t('staff.ds.year'), t('staff.col.actions')]}
        empty={rooms.length === 0 ? t('staff.ds.noClassrooms') : null}
      >
        {rooms.map((r) => (
          <div key={r.id} style={scrollRowStyle(CLS_COLS)}>
            <strong>{r.label}</strong>
            <span style={{ color: ink.body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.teacher_names?.length ? r.teacher_names.join(', ') : '—'}
            </span>
            <span style={{ fontWeight: 700 }}>{r.student_count}</span>
            <span style={{ color: ink.dim }}>{r.academic_year?.label || '—'}</span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn kind="secondary" onClick={() => setEditing(r)}>{t('common.edit')}</Btn>
            </span>
          </div>
        ))}
      </ScrollTable>

      {editing && (
        <ClassroomDialog
          room={editing} teachers={teachers} years={years} students={students}
          t={t} say={say}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      <Toast>{toast}</Toast>
    </>
  );
}

function ClassroomDialog({ room, teachers, years, students, t, say, onClose, onSaved }) {
  const isNew = !room.id;
  const [grade, setGrade] = useState(room.grade || '');
  const [letter, setLetter] = useState(room.letter || '');
  const [yearId, setYearId] = useState(room.academic_year_id || '');
  const [picked, setPicked] = useState(
    () => new Set((room.teachers || []).map((x) => x.user_id)),
  );
  const [roster, setRoster] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!room.id) return;
    api.get(`/classrooms/${room.id}/students`)
      .then((r) => setRoster(new Set((r.data || []).map((s) => s.user_id))))
      .catch(() => {});
  }, [room.id]);

  const toggle = (set, setter) => (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      let id = room.id;
      if (isNew) {
        const branchId = teachers[0]?.branch_id;
        const { data } = await api.post('/classrooms', {
          branch_id: branchId, grade: Number(grade),
          letter, academic_year_id: yearId ? Number(yearId) : null,
        });
        id = data.id;
      }
      await api.put(`/classrooms/${id}/teachers`, { teacher_ids: [...picked] });
      await api.put(`/classrooms/${id}/students`, {
        student_ids: [...roster], replace: true,
      });
      say(t('staff.inv.saved'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog title={isNew ? t('staff.ds.addClass') : t('staff.ds.editClass')} onClose={onClose} wide t={t}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.tb.grade')}</Label>
          <Input type="number" min={1} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.ds.letter')}</Label>
          <Input value={letter} onChange={(e) => setLetter(e.target.value.toUpperCase())} maxLength={2} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.ds.year')}</Label>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} style={selectStyle}>
            <option value="">{t('staff.ds.currentYear')}</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </label>
      </div>

      <Picker label={t('staff.ds.teachers')} items={teachers}
        idOf={(x) => x.user_id} nameOf={(x) => x.name}
        picked={picked} onToggle={toggle(picked, setPicked)} />

      <Picker label={t('staff.ds.students')} items={students}
        idOf={(x) => x.user_id} nameOf={(x) => x.name + (x.grade ? ` · ${x.grade}` : '')}
        picked={roster} onToggle={toggle(roster, setRoster)} tall />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={save} disabled={busy || !grade}>{t('common.save')}</Btn>
      </div>
    </Dialog>
  );
}

function Picker({ label, items, idOf, nameOf, picked, onToggle, tall }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label>{label} · {picked.size}</Label>
      <div style={{
        border: '1px solid ' + shell.border, borderRadius: radius.control,
        maxHeight: tall ? 190 : 130, overflowY: 'auto', padding: 8,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 4,
      }}>
        {items.length === 0 && (
          <span style={{ fontSize: 12, color: ink.dim }}>—</span>
        )}
        {items.map((x) => {
          const id = idOf(x);
          const on = picked.has(id);
          return (
            <button key={id} onClick={() => onToggle(id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left',
              background: on ? '#F0F9FF' : 'transparent',
              border: '1px solid ' + (on ? '#BAE6FD' : 'transparent'),
              borderRadius: radius.control, padding: '5px 8px',
              fontSize: 12.5, cursor: 'pointer', fontFamily: font.ui, color: ink.text,
            }}>
              <span style={{
                width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                border: '1.5px solid ' + (on ? '#1B9DD9' : shell.control),
                background: on ? '#1B9DD9' : '#fff', color: '#fff',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{on ? '✓' : ''}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(x)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- teachers */

const T_COLS = 'minmax(0,1.4fr) minmax(0,1.6fr) minmax(0,1fr) 120px';

export function SettingsTeachers() {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [adding, setAdding] = useState(false);
  const [denied, setDenied] = useState(false);
  const [toast, say] = useToast();
  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/teachers').then((r) => { if (alive) setTeachers(r.data || []); })
      .catch((e) => { if (alive && e.response?.status === 403) setDenied(true); });
    api.get('/classrooms').then((r) => { if (alive) setRooms(r.data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  // Which classes each teacher takes — the other half of the many-to-many.
  const classesOf = useMemo(() => {
    const m = {};
    rooms.forEach((r) => {
      (r.teachers || []).forEach((x) => {
        (m[x.user_id] = m[x.user_id] || []).push(r.label);
      });
    });
    return m;
  }, [rooms]);

  if (denied) return <Denied t={t} />;

  return (
    <>
      <PageIntro>{t('staff.ds.teacherSub')}</PageIntro>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setAdding(true)} style={{ padding: '9px 14px' }}>
          {t('staff.ds.addTeacher')}
        </Btn>
      </div>

      <ScrollTable
        min={720} columns={T_COLS}
        head={[t('staff.ds.name'), t('staff.ds.email'), t('staff.ds.classes'), t('staff.tb.subject')]}
        empty={teachers.length === 0 ? t('staff.ds.noTeachers') : null}
      >
        {teachers.map((x) => (
          <div key={x.user_id} style={scrollRowStyle(T_COLS)}>
            <strong>{x.name}</strong>
            <span style={{ color: ink.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {x.user?.email || '—'}
            </span>
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(classesOf[x.user_id] || []).map((l) => (
                <Pill key={l} colors={pill('pending')}>{l}</Pill>
              ))}
              {!(classesOf[x.user_id] || []).length && (
                <span style={{ color: ink.muted }}>—</span>
              )}
            </span>
            <span style={{ color: ink.dim }}>{x.subject || '—'}</span>
          </div>
        ))}
      </ScrollTable>

      {adding && (
        <TeacherDialog t={t} say={say}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); setKey((k) => k + 1); }} />
      )}
      <Toast>{toast}</Toast>
    </>
  );
}

function TeacherDialog({ t, say, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', subject: '' });
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api.get('/teachers').then((r) => {
      const bs = [];
      (r.data || []).forEach((x) => {
        if (x.branch && !bs.some((b) => b.id === x.branch.id)) bs.push(x.branch);
      });
      setBranches(bs);
      if (bs[0]) setBranchId(bs[0].id);
    }).catch(() => {});
  }, []);

  const ready = form.name.trim() && form.email.trim() && form.password.length >= 6 && branchId;

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/teachers', { ...form, branch_id: Number(branchId) });
      say(t('staff.ds.teacherAdded'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('staff.ds.addTeacher')} onClose={onClose} t={t}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.ds.name')}</Label>
          <Input value={form.name} onChange={set('name')} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.ds.email')}</Label>
          <Input type="email" value={form.email} onChange={set('email')} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.ds.password')}</Label>
          <Input type="password" value={form.password} onChange={set('password')} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.tb.subject')}</Label>
          <Input value={form.subject} onChange={set('subject')} />
        </label>
        {branches.length > 1 && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('manager.branch')}</Label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={selectStyle}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={save} disabled={busy || !ready}>{t('common.save')}</Btn>
      </div>
    </Dialog>
  );
}

/* -------------------------------------------------------------- subjects */

export function SettingsSubjects() {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, say] = useToast();
  const [key, setKey] = useState(0);

  useEffect(() => {
    api.get('/subjects').then((r) => setSubjects(r.data || [])).catch(() => {});
  }, [key]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post('/subjects', { name: name.trim() });
      setName('');
      setKey((k) => k + 1);
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const remove = async (s) => {
    try {
      await api.delete(`/subjects/${s.id}`);
      setKey((k) => k + 1);
    } catch (e) {
      say(e.response?.data?.code === 'IN_USE'
        ? t('staff.ds.subjectInUse', { n: e.response.data.count })
        : e.response?.data?.error || t('msg.opFailed'));
    }
  };

  return (
    <>
      <PageIntro>{t('staff.ds.subjectSub')}</PageIntro>
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('staff.ds.subjectName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          </label>
          <Btn onClick={add} disabled={busy || !name.trim()}>{t('common.addNew')}</Btn>
        </div>
      </Card>

      <div style={{
        background: '#fff', border: '1px solid ' + shell.border,
        borderRadius: radius.card, overflow: 'hidden',
      }}>
        {subjects.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: ink.dim, fontSize: 13 }}>
            {t('staff.ds.noSubjects')}
          </div>
        )}
        {subjects.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            borderBottom: '1px solid ' + shell.rowLine, fontSize: 13, minHeight: 44,
          }}>
            <strong style={{ flex: 1 }}>{s.name}</strong>
            <span style={{ color: ink.dim, fontSize: 12 }}>
              {t('staff.ds.nTextbooks', { n: s.book_count || 0 })}
            </span>
            <Btn kind="danger" onClick={() => remove(s)}
              style={{ padding: '5px 10px', fontSize: 12 }}>{t('common.delete')}</Btn>
          </div>
        ))}
      </div>
      <Toast>{toast}</Toast>
    </>
  );
}

/* ----------------------------------------------------------------- years */

export function SettingsYears() {
  const { t } = useTranslation();
  const [years, setYears] = useState([]);
  const [form, setForm] = useState({ label: '', starts_on: '', ends_on: '' });
  const [busy, setBusy] = useState(false);
  const [toast, say] = useToast();
  const [key, setKey] = useState(0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api.get('/academic-years').then((r) => setYears(r.data || [])).catch(() => {});
  }, [key]);

  const add = async () => {
    setBusy(true);
    try {
      await api.post('/academic-years', { ...form, is_current: years.length === 0 });
      setForm({ label: '', starts_on: '', ends_on: '' });
      setKey((k) => k + 1);
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const makeCurrent = async (y) => {
    try {
      await api.put(`/academic-years/${y.id}/current`);
      setKey((k) => k + 1);
    } catch (e) { say(e.response?.data?.error || t('msg.opFailed')); }
  };

  return (
    <>
      <PageIntro>{t('staff.ds.yearSub')}</PageIntro>
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('staff.ds.yearLabel')}</Label>
            <Input value={form.label} onChange={set('label')} placeholder="2026/2027" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('staff.ds.startsOn')}</Label>
            <Input type="date" value={form.starts_on} onChange={set('starts_on')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('staff.ds.endsOn')}</Label>
            <Input type="date" value={form.ends_on} onChange={set('ends_on')} />
          </label>
          <Btn onClick={add} disabled={busy || !form.label.trim()}>{t('common.addNew')}</Btn>
        </div>
      </Card>

      <div style={{
        background: '#fff', border: '1px solid ' + shell.border,
        borderRadius: radius.card, overflow: 'hidden',
      }}>
        {years.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: ink.dim, fontSize: 13 }}>
            {t('staff.ds.noYears')}
          </div>
        )}
        {years.map((y) => (
          <div key={y.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            borderBottom: '1px solid ' + shell.rowLine, fontSize: 13, minHeight: 44,
          }}>
            <strong style={{ minWidth: 90 }}>{y.label}</strong>
            <span style={{ flex: 1, color: ink.dim }}>
              {y.starts_on && y.ends_on
                ? `${fmtDate(y.starts_on)} — ${fmtDate(y.ends_on)}` : '—'}
            </span>
            {y.is_current
              ? <Pill colors={pill('active')}>{t('staff.ds.current')}</Pill>
              : (
                <Btn kind="secondary" onClick={() => makeCurrent(y)}
                  style={{ padding: '5px 10px', fontSize: 12 }}>
                  {t('staff.ds.makeCurrent')}
                </Btn>
              )}
          </div>
        ))}
      </div>
      <Toast>{toast}</Toast>
    </>
  );
}

const selectStyle = {
  width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
  padding: '8px 10px', fontSize: 13, background: '#fff', fontFamily: 'inherit',
};
