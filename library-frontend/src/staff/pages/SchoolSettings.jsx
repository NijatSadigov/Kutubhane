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
      createBranch: (body) => api.post('/admin/branch', body),
      renameBranch: (id, body) => api.put(`/admin/branch/${id}`, body),
      deleteBranch: (id) => api.delete(`/admin/branch/${id}`),
      addLibrarian: (body) => api.post('/admin/librarian', body),
      removeLibrarian: (id) => api.delete(`/admin/librarian/${id}`),
      addManager: (body) => api.post('/admin/manager', body),
      removeManager: (id) => api.delete(`/admin/manager/${id}`),
    };
  }
  return {
    // One school, returned as an object; wrapped so the rest of the screen
    // does not care which role it is serving.
    load: () => api.get('/manager/school').then((r) => (r.data ? [r.data] : [])),
    createSchool: null,
    createBranch: (body) => api.post('/manager/branch', { name: body.name }),
    renameBranch: (id, body) => api.put(`/manager/branch/${id}`, body),
    deleteBranch: (id) => api.delete(`/manager/branch/${id}`),
    addLibrarian: (body) => api.post('/manager/librarian', {
      name: body.name, email: body.email, password: body.password, branch_id: body.branch_id,
    }),
    removeLibrarian: (id) => api.delete(`/manager/librarian/${id}`),
    addManager: null,
    removeManager: null,
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
      <PageIntro>{t('staff.ss.intro.' + tab)}</PageIntro>
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
        <Schools schools={schools} ops={ops} act={act} busy={busy} t={t} />
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

      <SectionTitle>{t('role.librarian')}</SectionTitle>
      <Table
        columns="1.3fr 1.5fr 1fr .8fr"
        head={[t('staff.ss.name'), t('staff.ss.email'), t('staff.ss.branch'), '']}
        empty={librarians.length === 0 ? t('staff.ss.noStaff') : null}
      >
        {librarians.map((l) => (
          <Row key={l.user_id} columns="1.3fr 1.5fr 1fr .8fr">
            <span style={{ fontWeight: 600 }}>{l.name}</span>
            <span style={{ color: ink.dim }}>{l.user?.email || '—'}</span>
            <span>{l.branchName}</span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn kind="danger" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy}
                onClick={() => act(() => ops.removeLibrarian(l.user_id), t('staff.ss.staffRemoved'))}>
                {t('common.delete')}
              </Btn>
            </span>
          </Row>
        ))}
      </Table>

      {isAdmin && (
        <>
          <SectionTitle>{t('role.manager')}</SectionTitle>
          <Table
            columns="1.3fr 1.5fr 1fr .8fr"
            head={[t('staff.ss.name'), t('staff.ss.email'), t('staff.ss.school'), '']}
            empty={managers.length === 0 ? t('staff.ss.noStaff') : null}
          >
            {managers.map((m) => (
              <Row key={m.user_id} columns="1.3fr 1.5fr 1fr .8fr">
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                <span style={{ color: ink.dim }}>{m.user?.email || '—'}</span>
                <span>{m.schoolName}</span>
                <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn kind="danger" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy}
                    onClick={() => act(() => ops.removeManager(m.user_id), t('staff.ss.staffRemoved'))}>
                    {t('common.delete')}
                  </Btn>
                </span>
              </Row>
            ))}
          </Table>
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------- schools */

function Schools({ schools, ops, act, busy, t }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  return (
    <>
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

      <Table
        columns="1.4fr 1.4fr .7fr .7fr .7fr"
        head={[t('staff.ss.schoolName'), t('staff.ss.address'), t('staff.ss.branches'),
          t('staff.ss.readers'), t('role.manager')]}
        empty={schools.length === 0 ? t('staff.ss.noSchools') : null}
      >
        {schools.map((s) => (
          <Row key={s.id} columns="1.4fr 1.4fr .7fr .7fr .7fr">
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            <span style={{ color: ink.dim }}>{s.address || '—'}</span>
            <span>{(s.branches || []).length}</span>
            <span>{(s.branches || []).reduce((n, b) => n + (b.student_count || 0), 0)}</span>
            <span>{(s.managers || []).length}</span>
          </Row>
        ))}
      </Table>
      {/* Deleting a school would take every branch, reader and loan under it.
          That is not a button this screen should offer casually. */}
      <Note>{t('staff.ss.schoolNote')}</Note>
    </>
  );
}

/* --------------------------------------------------------------- pieces */

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
