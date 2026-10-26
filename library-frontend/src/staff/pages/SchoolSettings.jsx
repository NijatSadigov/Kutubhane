// Məktəb ayarları — branches, staff, and (for a platform admin) schools.
//
// This is the console's replacement for what only the old /admin and /manager
// dashboards could do: create a school, add a branch, add a librarian or a
// school administrator. Until it existed, retiring those dashboards would have
// taken a platform admin's only way to provision anything.
//
// ONE SCREEN, TWO API SURFACES. A platform admin and a school administrator do
// the same things through different endpoints — /admin/* works across every
// school and takes a school_id, /manager/* is pinned to the caller's own
// school and does not. The shape of what comes back is identical, so the
// difference is confined to the small `ops` adapter below rather than spread
// through the markup.
//
// The server decides scope either way: a manager's school comes from their
// identity, never from anything this screen sends.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, pill } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Alert, PageIntro, Table, Row, Label } from '../components/StaffShell';

// The two endpoint families, behind one set of names.
function opsFor(isAdmin) {
  if (isAdmin) {
    return {
      load: () => api.get('/admin/school').then((r) => r.data || []),
      createSchool: (body) => api.post('/admin/school', body),
      updateSchool: (id, body) => api.put(`/admin/school/${id}`, body),
      createBranch: (body) => api.post('/admin/branch', body),
      renameBranch: (id, body) => api.put(`/admin/branch/${id}`, body),
      deleteBranch: (id) => api.delete(`/admin/branch/${id}`),
      addLibrarian: (body) => api.post('/admin/librarian', body),
      updateLibrarian: (id, body) => api.put(`/admin/librarian/${id}`, body),
      removeLibrarian: (id) => api.delete(`/admin/librarian/${id}`),
      addManager: (body) => api.post('/admin/manager', body),
      updateManager: (id, body) => api.put(`/admin/manager/${id}`, body),
      removeManager: (id) => api.delete(`/admin/manager/${id}`),
      // DELETE /admin/school/:id has no guard of its own — it leans on the
      // database's cascades, so one click on a populated school takes every
      // branch, reader and loan with it. The screen only offers it on a school
      // that is already empty; see the note under the table.
      deleteSchool: (id) => api.delete(`/admin/school/${id}`),
    };
  }
  return {
    // One school, returned as an object; wrapped so the rest of the screen
    // does not care which role it is serving.
    load: () => api.get('/manager/school').then((r) => (r.data ? [r.data] : [])),
    createSchool: null,
    // The caller's own school, which the server takes from their identity —
    // hence no id in the path, and the one the screen holds is ignored.
    updateSchool: (_id, body) => api.put('/manager/school', body),
    createBranch: (body) => api.post('/manager/branch', { name: body.name }),
    renameBranch: (id, body) => api.put(`/manager/branch/${id}`, body),
    deleteBranch: (id) => api.delete(`/manager/branch/${id}`),
    addLibrarian: (body) => api.post('/manager/librarian', {
      name: body.name, email: body.email, password: body.password, branch_id: body.branch_id,
    }),
    updateLibrarian: (id, body) => api.put(`/manager/librarian/${id}`, {
      name: body.name, branch_id: body.branch_id,
    }),
    removeLibrarian: (id) => api.delete(`/manager/librarian/${id}`),
    // A school administrator does not provision or edit other administrators;
    // that is the platform admin's.
    addManager: null,
    updateManager: null,
    removeManager: null,
    deleteSchool: null,
  };
}

export function SchoolBranches() { return <Screen tab="branches" />; }
export function SchoolStaff() { return <Screen tab="staff" />; }
export function SchoolList() { return <Screen tab="schools" />; }

function Screen({ tab }) {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const ops = useMemo(() => opsFor(isAdmin), [isAdmin]);

  const [schools, setSchools] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2800); }, []);

  const load = useCallback(() => {
    ops.load()
      .then((list) => { setSchools(list); setFailed(false); })
      .catch(() => setFailed(true));
  }, [ops]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); say(okMsg); load(); }
    catch (e) { say(e.response?.data?.error || e.response?.data || t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  if (schools === null && !failed) return <PageIntro>{t('common.loading')}</PageIntro>;
  if (failed) return <Alert tone="problem">{t('staff.ss.failed')}</Alert>;

  const branches = schools.flatMap((s) => (s.branches || []).map((b) => ({ ...b, schoolName: s.name })));
  const librarians = branches.flatMap((b) => (b.librarians || []).map((l) => ({ ...l, branchName: b.name })));
  const managers = schools.flatMap((s) => (s.managers || []).map((m) => ({ ...m, schoolName: s.name })));

  return (
    <>
      <PageIntro>
        {/* A school administrator opens the same screen on one school: their
            own. The list reads differently when it is a list of one. */}
        {t(tab === 'schools' && !isAdmin ? 'staff.ss.intro.mySchool' : 'staff.ss.intro.' + tab)}
      </PageIntro>
      {toast && <Alert tone="action">{toast}</Alert>}

      {tab === 'branches' && (
        <Branches schools={schools} branches={branches} isAdmin={isAdmin}
          ops={ops} act={act} busy={busy} t={t} />
      )}
      {tab === 'staff' && (
        <Staff schools={schools} branches={branches} librarians={librarians} managers={managers}
          isAdmin={isAdmin} ops={ops} act={act} busy={busy} t={t} />
      )}
      {tab === 'schools' && (
        <Schools schools={schools} isAdmin={isAdmin} ops={ops} act={act} busy={busy} t={t} />
      )}
    </>
  );
}

/* ------------------------------------------------------------- branches */

function Branches({ schools, branches, isAdmin, ops, act, busy, t }) {
  const [name, setName] = useState('');
  const [schoolID, setSchoolID] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const body = { name: name.trim() };
    if (isAdmin) body.school_id = Number(schoolID) || schools[0]?.id;
    act(() => ops.createBranch(body).then(() => setName('')), t('staff.ss.branchAdded'));
  };

  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.ss.branches')} value={branches.length} />
        <Kpi label={t('staff.ss.readers')} value={branches.reduce((n, b) => n + (b.student_count || 0), 0)} />
        <Kpi label={t('staff.ss.librarians')} value={branches.reduce((n, b) => n + (b.librarians || []).length, 0)} />
      </KpiRow>

      <div style={{
        background: '#fff', border: '1px solid ' + shell.border, borderRadius: radius.card,
        padding: 16, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 240px' }}>
          <Label>{t('staff.ss.newBranch')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('staff.ss.branchNameHint')} />
        </div>
        {isAdmin && schools.length > 1 && (
          <div style={{ width: 220 }}>
            <Label>{t('staff.ss.school')}</Label>
            <select value={schoolID} onChange={(e) => setSchoolID(e.target.value)} style={selectStyle}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <Btn onClick={create} disabled={busy || !name.trim()}>{t('common.add')}</Btn>
      </div>

      <Table
        columns={isAdmin ? '1.4fr 1fr .8fr .8fr 1.4fr' : '1.4fr .8fr .8fr 1.4fr'}
        head={isAdmin
          ? [t('staff.ss.branch'), t('staff.ss.school'), t('staff.ss.readers'), t('staff.ss.librarians'), '']
          : [t('staff.ss.branch'), t('staff.ss.readers'), t('staff.ss.librarians'), '']}
        empty={branches.length === 0 ? t('staff.ss.noBranches') : null}
      >
        {branches.map((b) => (
          <Row key={b.id} columns={isAdmin ? '1.4fr 1fr .8fr .8fr 1.4fr' : '1.4fr .8fr .8fr 1.4fr'}>
            <span style={{ fontWeight: 600 }}>
              {editing === b.id
                ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} />
                : b.name}
            </span>
            {isAdmin && <span style={{ color: ink.dim }}>{b.schoolName}</span>}
            <span>{b.student_count || 0}</span>
            <span>{(b.librarians || []).length}</span>
            <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {editing === b.id ? (
                <>
                  <Btn disabled={busy} onClick={() => act(
                    () => ops.renameBranch(b.id, { ...b, name: editName.trim() }).then(() => setEditing(null)),
                    t('staff.ss.saved'),
                  )}>{t('common.save')}</Btn>
                  <Btn kind="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Btn>
                </>
              ) : (
                <>
                  <Btn kind="secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={() => { setEditing(b.id); setEditName(b.name); }}>
                    {t('common.edit')}
                  </Btn>
                  {/* Deleting a branch takes its books, readers and loans with
                      it, so it is only offered once it is empty. */}
                  {(b.student_count || 0) === 0 && (b.librarians || []).length === 0 ? (
                    <Btn kind="danger" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy}
                      onClick={() => act(() => ops.deleteBranch(b.id), t('staff.ss.branchRemoved'))}>
                      {t('common.delete')}
                    </Btn>
                  ) : (
                    <Pill colors={pill('neutral')}>{t('staff.ss.inUse')}</Pill>
                  )}
                </>
              )}
            </span>
          </Row>
        ))}
      </Table>
      <Note>{t('staff.ss.branchNote')}</Note>
    </>
  );
}

/* ---------------------------------------------------------------- staff */

function Staff({ schools, branches, librarians, managers, isAdmin, ops, act, busy, t }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', branch_id: '', school_id: '' });
  const [kind, setKind] = useState('librarian');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Who is being edited, and what they are being edited to. One piece of
  // state for both tables: only one row is ever open.
  const [edit, setEdit] = useState(null); // { kind, id, name, where }
  const openEdit = (who, whoKind) => setEdit({
    kind: whoKind, id: who.user_id, name: who.name,
    where: String(whoKind === 'manager' ? who.school_id : who.branch_id),
  });
  const saveEdit = () => {
    const name = edit.name.trim();
    if (!name) return;
    const body = edit.kind === 'manager'
      ? { name, school_id: Number(edit.where) }
      : { name, branch_id: Number(edit.where) };
    const fn = edit.kind === 'manager' ? ops.updateManager : ops.updateLibrarian;
    act(() => fn(edit.id, body).then(() => setEdit(null)), t('staff.ss.saved'));
  };

  const ready = form.name.trim() && form.email.trim() && form.password.length >= 8
    && (kind === 'manager' ? true : (form.branch_id || branches[0]?.id));

  const create = () => {
    const base = { name: form.name.trim(), email: form.email.trim(), password: form.password };
    const done = () => setForm({ name: '', email: '', password: '', branch_id: '', school_id: '' });
    if (kind === 'manager') {
      act(() => ops.addManager({ ...base, school_id: Number(form.school_id) || schools[0]?.id }).then(done),
        t('staff.ss.staffAdded'));
    } else {
      const bid = Number(form.branch_id) || branches[0]?.id;
      const school = branches.find((b) => b.id === bid)?.school_id || schools[0]?.id;
      act(() => ops.addLibrarian({ ...base, branch_id: bid, school_id: school }).then(done),
        t('staff.ss.staffAdded'));
    }
  };

  return (
    <>
      <div style={{
        background: '#fff', border: '1px solid ' + shell.border, borderRadius: radius.card,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {isAdmin && (
            <div style={{ width: 180 }}>
              <Label>{t('staff.ss.role')}</Label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={selectStyle}>
                <option value="librarian">{t('role.librarian')}</option>
                <option value="manager">{t('role.manager')}</option>
              </select>
            </div>
          )}
          <div style={{ flex: '1 1 180px' }}>
            <Label>{t('staff.ss.name')}</Label>
            <Input value={form.name} onChange={set('name')} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Label>{t('staff.ss.email')}</Label>
            <Input type="email" value={form.email} onChange={set('email')} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <Label>{t('staff.ss.password')}</Label>
            <Input type="password" value={form.password} onChange={set('password')} />
          </div>
          {kind === 'librarian' ? (
            <div style={{ width: 200 }}>
              <Label>{t('staff.ss.branch')}</Label>
              <select value={form.branch_id} onChange={set('branch_id')} style={selectStyle}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          ) : isAdmin && schools.length > 1 ? (
            <div style={{ width: 200 }}>
              <Label>{t('staff.ss.school')}</Label>
              <select value={form.school_id} onChange={set('school_id')} style={selectStyle}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : null}
          <Btn onClick={create} disabled={busy || !ready}>{t('common.add')}</Btn>
        </div>
        <Note>{t('staff.ss.passwordHint')}</Note>
      </div>
      <Note>{t('staff.ss.emailNote')}</Note>

      <SectionTitle>{t('role.librarian')}</SectionTitle>
      <Table
        columns={STAFF_COLS}
        head={[t('staff.ss.name'), t('staff.ss.email'), t('staff.ss.branch'), '']}
        empty={librarians.length === 0 ? t('staff.ss.noStaff') : null}
      >
        {librarians.map((l) => {
          const on = edit?.kind === 'librarian' && edit.id === l.user_id;
          return (
            <Row key={l.user_id} columns={STAFF_COLS}>
              <span style={{ fontWeight: 600 }}>
                {on
                  ? <Input value={edit.name} style={{ width: '100%' }}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  : l.name}
              </span>
              {/* The e-mail is the login, and nothing on the server changes
                  one. Shown, never offered for editing. */}
              <span style={{ color: ink.dim }}>{l.user?.email || '—'}</span>
              <span>
                {on
                  ? (
                    <select value={edit.where} style={selectStyle}
                      onChange={(e) => setEdit({ ...edit, where: e.target.value })}>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )
                  : l.branchName}
              </span>
              <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {on ? (
                  <>
                    <Btn disabled={busy || !edit.name.trim()} onClick={saveEdit}>{t('common.save')}</Btn>
                    <Btn kind="secondary" onClick={() => setEdit(null)}>{t('common.cancel')}</Btn>
                  </>
                ) : (
                  <>
                    <Btn kind="secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => openEdit(l, 'librarian')}>{t('common.edit')}</Btn>
                    <Btn kind="danger" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy}
                      onClick={() => act(() => ops.removeLibrarian(l.user_id), t('staff.ss.staffRemoved'))}>
                      {t('common.delete')}
                    </Btn>
                  </>
                )}
              </span>
            </Row>
          );
        })}
      </Table>

      {isAdmin && (
        <>
          <SectionTitle>{t('role.manager')}</SectionTitle>
          <Table
            columns={STAFF_COLS}
            head={[t('staff.ss.name'), t('staff.ss.email'), t('staff.ss.school'), '']}
            empty={managers.length === 0 ? t('staff.ss.noStaff') : null}
          >
            {managers.map((m) => {
              const on = edit?.kind === 'manager' && edit.id === m.user_id;
              return (
                <Row key={m.user_id} columns={STAFF_COLS}>
                  <span style={{ fontWeight: 600 }}>
                    {on
                      ? <Input value={edit.name} style={{ width: '100%' }}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                      : m.name}
                  </span>
                  <span style={{ color: ink.dim }}>{m.user?.email || '—'}</span>
                  <span>
                    {on && schools.length > 1
                      ? (
                        <select value={edit.where} style={selectStyle}
                          onChange={(e) => setEdit({ ...edit, where: e.target.value })}>
                          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )
                      : m.schoolName}
                  </span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {on ? (
                      <>
                        <Btn disabled={busy || !edit.name.trim()} onClick={saveEdit}>{t('common.save')}</Btn>
                        <Btn kind="secondary" onClick={() => setEdit(null)}>{t('common.cancel')}</Btn>
                      </>
                    ) : (
                      <>
                        <Btn kind="secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => openEdit(m, 'manager')}>{t('common.edit')}</Btn>
                        <Btn kind="danger" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy}
                          onClick={() => act(() => ops.removeManager(m.user_id), t('staff.ss.staffRemoved'))}>
                          {t('common.delete')}
                        </Btn>
                      </>
                    )}
                  </span>
                </Row>
              );
            })}
          </Table>
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------- schools */

function Schools({ schools, isAdmin, ops, act, busy, t }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [edit, setEdit] = useState(null); // { id, name, address }

  const save = () => {
    if (!edit.name.trim()) return;
    act(
      () => ops.updateSchool(edit.id, { name: edit.name.trim(), address: edit.address.trim() })
        .then(() => setEdit(null)),
      t('staff.ss.saved'),
    );
  };

  return (
    <>
      {/* Only a platform admin creates a school. A school administrator is
          here for one row — their own — and the one thing they can do to it. */}
      {isAdmin && (
        <div style={{
          background: '#fff', border: '1px solid ' + shell.border, borderRadius: radius.card,
          padding: 16, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 220px' }}>
            <Label>{t('staff.ss.schoolName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <Label>{t('staff.ss.address')}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Btn disabled={busy || !name.trim()}
            onClick={() => act(
              () => ops.createSchool({ name: name.trim(), address: address.trim() })
                .then(() => { setName(''); setAddress(''); }),
              t('staff.ss.schoolAdded'),
            )}>{t('common.add')}</Btn>
        </div>
      )}

      <Table
        columns={SCHOOL_COLS}
        head={[t('staff.ss.schoolName'), t('staff.ss.address'), t('staff.ss.branches'),
          t('staff.ss.readers'), t('role.manager'), '']}
        empty={schools.length === 0 ? t('staff.ss.noSchools') : null}
      >
        {schools.map((s) => {
          const on = edit?.id === s.id;
          return (
            <Row key={s.id} columns={SCHOOL_COLS}>
              <span style={{ fontWeight: 600 }}>
                {on
                  ? <Input value={edit.name} style={{ width: '100%' }}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  : s.name}
              </span>
              <span style={{ color: ink.dim }}>
                {on
                  ? <Input value={edit.address} style={{ width: '100%' }}
                    onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
                  : s.address || '—'}
              </span>
              <span>{(s.branches || []).length}</span>
              <span>{(s.branches || []).reduce((n, b) => n + (b.student_count || 0), 0)}</span>
              <span>{(s.managers || []).length}</span>
              <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {on ? (
                  <>
                    <Btn disabled={busy || !edit.name.trim()} onClick={save}>{t('common.save')}</Btn>
                    <Btn kind="secondary" onClick={() => setEdit(null)}>{t('common.cancel')}</Btn>
                  </>
                ) : (
                  <>
                    <Btn kind="secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => setEdit({ id: s.id, name: s.name, address: s.address || '' })}>
                      {t('common.edit')}
                    </Btn>
                    {/* Only once it is empty, the same rule a branch is held
                        to one scale down. A school with anything in it is not
                        a row to remove by accident. */}
                    {isAdmin && (s.branches || []).length === 0 && (s.managers || []).length === 0 && (
                      <Btn kind="danger" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy}
                        onClick={() => act(() => ops.deleteSchool(s.id), t('staff.ss.schoolRemoved'))}>
                        {t('common.delete')}
                      </Btn>
                    )}
                  </>
                )}
              </span>
            </Row>
          );
        })}
      </Table>
      {/* Deleting a school would take every branch, reader and loan under it.
          That is not a button this screen should offer casually. */}
      <Note>{t('staff.ss.schoolNote')}</Note>
    </>
  );
}

/* --------------------------------------------------------------- pieces */

// A row of either staff table, and a row of the school table. Named because
// the head and the rows have to agree, and they did not when the widths were
// repeated at both ends of a 40-line component.
const STAFF_COLS = '1.3fr 1.5fr 1fr 1.3fr';
const SCHOOL_COLS = '1.4fr 1.4fr .6fr .6fr .6fr 1.1fr';

const selectStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid ' + shell.control, fontSize: 13, fontFamily: 'inherit',
  background: '#fff', color: ink.text,
};

function SectionTitle({ children }) {
  return (
    <h2 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: ink.strong }}>{children}</h2>
  );
}

function Note({ children }) {
  return <div style={{ fontSize: 12, color: ink.dim, lineHeight: 1.5 }}>{children}</div>;
}
