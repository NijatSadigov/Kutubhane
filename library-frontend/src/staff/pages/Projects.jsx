// Layihələr — the school's reading projects and campaigns.
//
// Not the challenges screen. A challenge is a book list with quizzes that
// readers join individually; a project is longer-running work the school plans
// apart from the library's daily job — a book drive, an author visit, a class
// against class campaign. It has a goal, a lifecycle and a log of what
// happened, and none of those are things a challenge has.
//
// Progress comes from the log, never from a stored counter, so the bar on a
// card cannot disagree with the updates underneath it.
//
// A project opens in a panel here rather than at its own path: `nav.js` is the
// one table the routes and the page title are built from, and a /:id would be
// a route it cannot name.

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font, pill } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Label, Alert, PageIntro } from '../components/StaffShell';
import { Toast } from './deskShared';

const KINDS = ['BOOK_DRIVE', 'EVENT', 'CAMPAIGN', 'OTHER'];
const STATUSES = ['PLANNED', 'ACTIVE', 'DONE', 'CANCELLED'];

// The lifecycle's colours, borrowed from the pills the console already uses so
// a project reads like everything else in it.
const STATUS_PILL = {
  PLANNED: 'neutral', ACTIVE: 'active', DONE: 'available', CANCELLED: 'overdue',
};

export default function Projects() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    api.get('/projects').then((r) => { if (alive) setProjects(r.data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  // The same comprehensive shape Üzvlər and the dərslik catalogue use: every
  // word on the card, ANDed, so a second term narrows.
  const haystack = useCallback((p) => [
    p.title, p.description, p.goal_unit, p.branch_name,
    t('staff.pr.kind.' + p.kind), t('staff.pr.status.' + p.status),
    ...(p.classrooms || []).map((c) => `${c.grade}-${c.letter}`),
  ].filter(Boolean).join(' ').toLowerCase(), [t]);

  const shown = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return projects.filter((p) => {
      if (status === 'open' && !['PLANNED', 'ACTIVE'].includes(p.status)) return false;
      if (status !== 'open' && status !== 'all' && p.status !== status) return false;
      if (terms.length === 0) return true;
      const hay = haystack(p);
      return terms.every((term) => hay.includes(term));
    });
  }, [projects, q, status, haystack]);

  const totals = useMemo(() => ({
    all: projects.length,
    running: projects.filter((p) => p.status === 'ACTIVE').length,
    planned: projects.filter((p) => p.status === 'PLANNED').length,
    done: projects.filter((p) => p.status === 'DONE').length,
  }), [projects]);

  return (
    <>
      <PageIntro>{t('staff.pr.sub')}</PageIntro>

      {/* The KPIs are the filter. Somebody looking for last year's campaigns
          looks at the "finished" number first, so it is the thing that takes
          them there rather than a chip further down they have to notice. */}
      <div style={{ cursor: 'pointer' }}>
        <KpiRow>
          <span onClick={() => { setStatus('all'); setOpen(null); }}>
            <Kpi label={t('staff.pr.kpiAll')} value={totals.all} note={t('staff.pr.kpiTap')} />
          </span>
          <span onClick={() => { setStatus('ACTIVE'); setOpen(null); }}>
            <Kpi label={t('staff.pr.kpiRunning')} value={totals.running} />
          </span>
          <span onClick={() => { setStatus('PLANNED'); setOpen(null); }}>
            <Kpi label={t('staff.pr.kpiPlanned')} value={totals.planned} />
          </span>
          <span onClick={() => { setStatus('DONE'); setOpen(null); }}>
            <Kpi label={t('staff.pr.kpiDone')} value={totals.done}
              note={totals.done > 0 ? t('staff.pr.kpiSeeOld') : ''} />
          </span>
        </KpiRow>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('staff.pr.search')} style={{ flex: '1 1 240px', width: 'auto' }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[['open', t('staff.pr.filterOpen')], ['all', t('staff.pr.filterAll')],
            ...STATUSES.map((s) => [s, t('staff.pr.status.' + s)])].map(([v, label]) => {
            const on = status === v;
            return (
              <button key={v} onClick={() => { setStatus(v); setOpen(null); }} style={{
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: font.ui, whiteSpace: 'nowrap',
              }}>{label}</button>
            );
          })}
        </div>
        <Btn onClick={() => nav('/staff/projects/new')} style={{ padding: '9px 14px' }}>
          {t('staff.pr.add')}
        </Btn>
      </div>

      {shown.length === 0 ? (
        <Alert tone="action">
          {projects.length === 0 ? t('staff.pr.none') : t('staff.pr.noMatches')}
        </Alert>
      ) : (
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}>
          {shown.map((p) => (
            <ProjectCard
              key={p.id} project={p} t={t}
              on={open?.id === p.id}
              onOpen={() => setOpen(open?.id === p.id ? null : p)}
            />
          ))}
        </div>
      )}

      {open && (
        <ProjectPanel
          key={open.id} projectId={open.id} t={t} say={say}
          onClose={() => setOpen(null)}
          onChanged={() => { reload(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

/* ------------------------------------------------------------- the card */

// Who a project is for, in as few words as a card has room for. Naming one or
// two groups is more use than a count, so the names are listed until there are
// too many and only then collapsed to a number.
function audienceLabel(p, t) {
  const names = (rows, key) => (rows || []).map((r) => r[key]).filter(Boolean);
  switch (p.audience) {
    case 'BRANCHES': {
      const n = names(p.branches, 'name');
      return n.length <= 2 ? n.join(', ') : t('staff.pr.audNBranches', { n: n.length });
    }
    case 'CLASSES': {
      // Classroom.Label() is a Go method, not a column, so a project's own
      // classrooms arrive as grade and letter with no label — unlike
      // /classrooms, which returns a view that has one. Build it here rather
      // than printing "undefined, undefined".
      const n = (p.classrooms || [])
        .map((r) => r.label || [r.grade, r.letter].filter(Boolean).join('-'))
        .filter(Boolean);
      return n.length <= 3 ? n.join(', ') : t('staff.pr.audNClasses', { n: n.length });
    }
    case 'SCHOOLS': {
      const n = names(p.schools, 'name');
      return n.length <= 2 ? n.join(', ') : t('staff.pr.audNSchools', { n: n.length });
    }
    default:
      return t('staff.pr.schoolWide');
  }
}

function ProjectCard({ project: p, on, onOpen, t }) {
  const hasGoal = p.goal_target > 0;
  return (
    <button onClick={onOpen} style={{
      textAlign: 'left', cursor: 'pointer', font: 'inherit',
      background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.text,
      border: '1px solid ' + (on ? '#082F49' : shell.border),
      borderRadius: radius.card, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill colors={pill(STATUS_PILL[p.status] || 'neutral')}>
          {t('staff.pr.status.' + p.status)}
        </Pill>
        <span style={{ fontSize: 11, color: on ? '#BAE6FD' : ink.dim, fontWeight: 700 }}>
          {t('staff.pr.kind.' + p.kind)}
        </span>
      </span>

      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{p.title}</span>

      {(p.starts_on || p.ends_on) && (
        <span style={{ fontSize: 11, color: on ? '#BAE6FD' : ink.dim }}>
          {[p.starts_on && fmtDate(p.starts_on), p.ends_on && fmtDate(p.ends_on)]
            .filter(Boolean).join(' — ')}
        </span>
      )}

      {hasGoal ? (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: on ? '#fff' : ink.body }}>
            <strong>{p.progress}</strong>
            {' / '}{p.goal_target} {p.goal_unit}
          </span>
          {/* The bar is the only place progress is drawn, and it is drawn from
              the summed log rather than a stored number. */}
          <span style={{
            height: 6, borderRadius: 999, overflow: 'hidden',
            background: on ? 'rgba(255,255,255,0.25)' : shell.canvas,
          }}>
            <span style={{
              display: 'block', height: '100%', width: `${p.percent}%`,
              background: p.percent >= 100 ? '#15803D' : '#1B9DD9',
            }} />
          </span>
        </span>
      ) : (
        <span style={{ fontSize: 12, color: on ? '#BAE6FD' : ink.dim }}>
          {t('staff.pr.noGoal')}
        </span>
      )}

      <span style={{ fontSize: 11, color: on ? '#BAE6FD' : ink.dim }}>
        {[
          t('staff.pr.nUpdates', { n: p.update_count }),
          // Only when it has one: a book drive saying "0 books" would read as
          // a broken reading list rather than a campaign that has none.
          p.book_count > 0 ? t('staff.pr.nBooks', { n: p.book_count }) : '',
          // Who it is for, named rather than left to be guessed from the
          // branch it came from — those are different questions.
          audienceLabel(p, t),
        ].filter(Boolean).join(' · ')}
      </span>
    </button>
  );
}

/* ------------------------------------------------- the project, opened up */

// Everything about one project: its goal, what has happened, who is taking
// part and how the classes stand. Loaded on open rather than with the list,
// because the log is the big part and a card does not need it.
function ProjectPanel({ projectId, t, say, onClose, onChanged }) {
  const [p, setP] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [body, setBody] = useState('');
  const [amount, setAmount] = useState('');
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get(`/projects/${projectId}`).then((r) => { if (alive) setP(r.data); }).catch(() => {});
    api.get('/classrooms').then((r) => { if (alive) setRooms(r.data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [projectId, key]);

  const refresh = () => { setKey((k) => k + 1); onChanged(); };

  const addUpdate = async () => {
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/updates`, {
        body: body.trim(),
        amount: Number(amount) || 0,
        classroom_id: roomId ? Number(roomId) : null,
      });
      setBody(''); setAmount(''); setRoomId('');
      say(t('staff.pr.updateAdded'));
      refresh();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const setStatus = async (status) => {
    try {
      await api.put(`/projects/${projectId}`, { status });
      say(t('staff.pr.statusSet', { s: t('staff.pr.status.' + status) }));
      refresh();
    } catch (e) { say(e.response?.data?.error || t('msg.opFailed')); }
  };

  if (!p) return null;
  const closed = p.status === 'DONE' || p.status === 'CANCELLED';
  const ready = body.trim() !== '' || Number(amount) > 0;

  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, padding: 18,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{p.title}</h3>
          {p.description && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: ink.body }}>{p.description}</p>
          )}
        </div>
        <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}>✕</Btn>
      </div>

      {/* The lifecycle, as the buttons that move it. A closed project offers
          the way back, because "done" is sometimes pressed too early. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Label>{t('staff.pr.lifecycle')}</Label>
        {STATUSES.filter((s) => s !== p.status).map((s) => (
          <Btn key={s} kind="secondary" onClick={() => setStatus(s)}
            style={{ padding: '5px 10px', fontSize: 12 }}>
            {t('staff.pr.status.' + s)}
          </Btn>
        ))}
      </div>

      {p.standings?.length > 0 && (
        <div>
          <Label>{t('staff.pr.standings')}</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {p.standings.map((s, i) => (
              <div key={s.classroom_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, padding: '6px 10px',
                background: i === 0 ? '#F0F9FF' : 'transparent',
                borderRadius: radius.control,
              }}>
                <span style={{ width: 22, color: ink.dim, fontWeight: 700 }}>{i + 1}</span>
                <strong style={{ flex: 1 }}>{s.label}</strong>
                <span style={{ fontWeight: 700 }}>{s.amount}</span>
                <span style={{ color: ink.dim, fontSize: 12 }}>{p.goal_unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!closed && (
        <div style={{
          border: '1px solid ' + shell.border, borderRadius: radius.card, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <Label>{t('staff.pr.addUpdate')}</Label>
          <Input value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={t('staff.pr.updateHint')} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>{p.goal_unit || t('staff.pr.amount')}</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                style={{ width: 110 }} placeholder="0" />
            </label>
            <label style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>{t('staff.pr.whichClass')}</Label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{
                width: '100%', border: '1px solid ' + shell.control,
                borderRadius: radius.control, padding: '8px 10px',
                fontSize: 13, background: '#fff', fontFamily: 'inherit',
              }}>
                <option value="">{t('staff.pr.noClass')}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
            <Btn onClick={addUpdate} disabled={busy || !ready}>{t('staff.pr.record')}</Btn>
          </div>
        </div>
      )}

      <AudiencePicker project={p} t={t} say={say} onChanged={refresh} />

      <ReadingList project={p} t={t} say={say} onChanged={refresh} />

      <div>
        <Label>{t('staff.pr.log')}</Label>
        {(p.updates || []).length === 0 ? (
          <div style={{ fontSize: 13, color: ink.dim, padding: '10px 0' }}>
            {t('staff.pr.logEmpty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {p.updates.map((u) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
                padding: '8px 0', borderBottom: '1px solid ' + shell.rowLine, fontSize: 13,
              }}>
                <span style={{ color: ink.dim, fontSize: 11, minWidth: 90 }}>
                  {fmtDate(u.created_at)}
                </span>
                <span style={{ flex: 1, minWidth: 140 }}>{u.body || '—'}</span>
                {u.classroom?.id && (
                  <Pill colors={pill('neutral')}>
                    {u.classroom.grade}-{u.classroom.letter}
                  </Pill>
                )}
                {u.amount !== 0 && (
                  <strong style={{ color: u.amount > 0 ? '#15803D' : '#B4232A' }}>
                    {u.amount > 0 ? '+' : ''}{u.amount}
                  </strong>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------- who the project is for */

// The target group.
//
// Four audiences, and which of them a person may pick follows the scope they
// already run: a librarian runs one branch, so the branch list they are shown
// is their own and the classes are their own branch's. The endpoint enforces
// the same thing rather than trusting the picker, because a screen that only
// *shows* the right options is not a permission.
//
// Partner schools appear for a platform admin alone. Deciding that two schools
// are partners is the alliance work in Phase 3; until that exists there is
// nothing to check a school administrator's choice against, so the option says
// so rather than pretending.
function AudiencePicker({ project: p, t, say, onChanged }) {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [branches, setBranches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [schools, setSchools] = useState([]);
  const [aud, setAud] = useState(() => ({
    audience: p.audience || 'SCHOOL',
    branch_ids: (p.branches || []).map((b) => b.id),
    classroom_ids: (p.classrooms || []).map((r) => r.id),
    school_ids: (p.schools || []).map((s) => s.id),
  }));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // `scope=mine` so a branch-scoped librarian is not offered a branch the
    // endpoint would refuse. A manager or admin has no single branch and gets
    // the whole school back, which is what they should be choosing from.
    api.get('/branches', { params: { scope: 'mine' } })
      .then((r) => { if (alive) setBranches(r.data || []); }).catch(() => {});
    api.get('/classrooms').then((r) => { if (alive) setRooms(r.data || []); }).catch(() => {});
    if (isAdmin) {
      api.get('/admin/school').then((r) => { if (alive) setSchools(r.data || []); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [isAdmin]);

  // An audience that names nobody would silently mean "everyone", so it is
  // refused here as well as at the endpoint.
  const key = aud.audience === 'BRANCHES' ? 'branch_ids'
    : aud.audience === 'CLASSES' ? 'classroom_ids'
      : aud.audience === 'SCHOOLS' ? 'school_ids' : null;
  const ready = key === null || (aud[key] || []).length > 0;

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/projects/${p.id}/audience`, aud);
      say(t('staff.pr.audSaved'));
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      border: '1px solid ' + shell.border, borderRadius: radius.card, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <Label>{t('staff.pr.audience')}</Label>
      <span style={{ fontSize: 12, color: ink.dim, marginTop: -4 }}>
        {t('staff.pr.audienceNote')}
      </span>

      <AudienceFields
        value={aud} onChange={setAud} isAdmin={isAdmin}
        branches={branches} rooms={rooms} schools={schools} t={t}
      />

      {!ready && (
        <span style={{ fontSize: 12, color: '#B4232A' }}>{t('staff.pr.audEmpty')}</span>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={save} disabled={busy || !ready}
          style={{ padding: '5px 11px', fontSize: 12 }}>
          {t('staff.pr.audSave')}
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- picking books */

// Choosing titles for a reading list.
//
// The first cut was a text box that searched titles and listed the matches as
// a row of words, which is a poor way to recognise a book: a librarian knows a
// cover long before they can recall how the title is spelled. So this shows
// covers, opens with the branch's own shelf rather than an empty box, keeps
// what is already chosen visible at the top, and lets a title be dropped from
// there without hunting for it again in the results.
//
// It is used by the new-project form and by the panel, so a reading list is
// assembled the same way whether it is being written or edited.
function BookPicker({ chosen, onChange, t }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Open with something to look at. An empty box gives no clue that the
  // catalogue is what is being searched.
  const load = useCallback(async (term) => {
    setLoading(true);
    try {
      const r = term
        ? await api.get('/catalog/search', { params: { q: term } })
        : await api.get('/catalog/browse', { params: { scope: 'library', limit: 24 } });
      const rows = r.data?.items || r.data || [];
      setResults(rows.slice(0, 24));
    } catch { setResults([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(''); }, [load]);

  const ids = chosen.map((b) => b.edition_id);

  // Updates go through a function rather than being built from `chosen`,
  // because two adds in quick succession both read the same captured list and
  // the second overwrites the first — a book silently not added. `onChange` is
  // a useState setter at both call sites, so it takes an updater.
  const add = (b) => onChange((prev) => (
    prev.some((x) => x.edition_id === b.edition_id) ? prev : [...prev, b]
  ));
  const drop = (id) => onChange((prev) => prev.filter((b) => b.edition_id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* What is already on the list, with its covers, so the shape of the
          campaign is visible while more are added. */}
      {chosen.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chosen.map((b) => (
            <div key={b.edition_id} style={{
              position: 'relative', width: 74,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <Cover book={b} h={100} />
              <span style={{
                fontSize: 10, lineHeight: 1.25, color: ink.body,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>{b.title}</span>
              <button onClick={() => drop(b.edition_id)} aria-label={t('common.remove')}
                style={{
                  position: 'absolute', top: -5, right: -5, width: 20, height: 20,
                  borderRadius: 999, border: '1px solid ' + shell.border,
                  background: '#fff', cursor: 'pointer', fontSize: 11,
                  lineHeight: 1, color: '#B4232A', padding: 0,
                }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); load(q.trim()); } }}
          placeholder={t('staff.pr.bookSearch')} style={{ flex: '1 1 200px', width: 'auto' }}
        />
        <Btn kind="secondary" onClick={() => load(q.trim())} disabled={loading}>
          {t('staff.pr.findBook')}
        </Btn>
        {q && (
          <Btn kind="secondary" onClick={() => { setQ(''); load(''); }}>
            {t('staff.pr.clearSearch')}
          </Btn>
        )}
      </div>

      <span style={{ fontSize: 11, color: ink.dim }}>
        {q ? t('staff.pr.searchingCatalogue') : t('staff.pr.showingShelf')}
      </span>

      {results.length === 0 ? (
        <span style={{ fontSize: 12, color: ink.dim }}>
          {loading ? t('common.loading') : t('staff.pr.noBooks')}
        </span>
      ) : (
        <div style={{
          display: 'grid', gap: 10, maxHeight: 260, overflowY: 'auto', paddingRight: 4,
          gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
        }}>
          {results.map((r) => {
            const on = ids.includes(r.edition_id);
            return (
              <button key={r.edition_id} onClick={() => add(r)} disabled={on}
                title={[r.title, r.author_name].filter(Boolean).join(' · ')}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 4, padding: 0,
                  border: 0, background: 'transparent', font: 'inherit',
                  cursor: on ? 'default' : 'pointer', textAlign: 'left',
                  opacity: on ? 0.45 : 1,
                }}>
                <Cover book={r} h={112} ring={on} />
                <span style={{
                  fontSize: 10, lineHeight: 1.25, color: ink.text,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>{r.title}</span>
                <span style={{ fontSize: 9, color: ink.dim }}>
                  {on ? t('staff.pr.alreadyOn') : (r.author_name || '')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A cover, or the title on a coloured card when there is no image — the same
// fallback the reader app uses, so a book without a cover is still
// recognisable rather than a grey box.
function Cover({ book, h, ring }) {
  const src = book.cover_url;
  const common = {
    width: '100%', height: h, borderRadius: 6, objectFit: 'cover',
    border: ring ? '2px solid #082F49' : '1px solid ' + shell.border,
    display: 'block',
  };
  if (src) return <img src={src} alt="" style={common} />;
  return (
    <span style={{
      ...common, background: '#0C4A6E', color: '#fff',
      fontSize: 9, fontWeight: 700, padding: 6,
      display: 'flex', alignItems: 'flex-end', overflow: 'hidden',
    }}>{book.title}</span>
  );
}

/* --------------------------------------- the reading list, and its quiz */

// Books and quiz questions on a project.
//
// A project that has books *runs as* a reading challenge: the moment the first
// title is attached, readers see the campaign on their own Müsabiqələr page and
// can join it, log the book and answer the quiz. That whole flow already
// existed; this is the staff's way into it, which is what was missing.
//
// A book drive or an author visit simply never attaches a book, and then
// nothing appears for readers — which is right, because there is nothing for
// them to read.
function ReadingList({ project: p, t, say, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(null); // edition_id a question is being written for

  const books = useMemo(() => p.books || [], [p.books]);
  // The list being edited, separate from the saved one, so the picker can be
  // played with and abandoned. On an existing project the saved list is what
  // readers are working through, and rewriting it on every click would be a
  // change nobody asked for.
  const [draft, setDraft] = useState(books);
  useEffect(() => { setDraft(books); }, [books]);

  const dirty = draft.length !== books.length
    || draft.some((b, i) => b.edition_id !== books[i]?.edition_id);

  const setBooks = async (next) => {
    setBusy(true);
    try {
      await api.put(`/projects/${p.id}/books`, { edition_ids: next });
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const removeBook = (editionId) => setBooks(
    books.map((b) => b.edition_id).filter((i) => i !== editionId),
  );

  return (
    <div style={{
      border: '1px solid ' + shell.border, borderRadius: radius.card, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <Label>{t('staff.pr.reading')}</Label>
      <span style={{ fontSize: 12, color: ink.dim, marginTop: -4 }}>
        {t('staff.pr.readingNote')}
      </span>

      {/* How the quiz is sat, and what readers have proposed for it. Both only
          mean anything once there is a book to ask about, so they appear with
          the list rather than before it. */}
      {books.length > 0 && (
        <>
          <QuizSettings project={p} t={t} say={say} onChanged={onChanged} />
          <Suggestions project={p} t={t} say={say} onChanged={onChanged} />
        </>
      )}

      {books.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {books.map((b) => (
            <div key={b.edition_id} style={{
              border: '1px solid ' + shell.border, borderRadius: radius.control,
              padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ flex: '1 1 160px', fontSize: 13 }}>
                  {b.title}
                  {b.author_name && (
                    <span style={{ fontWeight: 400, color: ink.dim }}> · {b.author_name}</span>
                  )}
                </strong>
                <span style={{ fontSize: 11, color: ink.dim }}>
                  {t('staff.pr.nQuestions', { n: b.questions.length })}
                </span>
                <Btn kind="secondary" disabled={busy}
                  onClick={() => setAsking(asking === b.edition_id ? null : b.edition_id)}
                  style={{ padding: '4px 9px', fontSize: 12 }}>
                  {t('staff.pr.addQuestion')}
                </Btn>
                <Btn kind="secondary" disabled={busy} onClick={() => removeBook(b.edition_id)}
                  style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
              </div>

              {b.questions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {b.questions.map((qq) => (
                    <div key={qq.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 12, color: ink.body,
                    }}>
                      <span style={{ flex: 1 }}>· {qq.prompt}</span>
                      <button
                        onClick={async () => {
                          try {
                            await api.delete(`/projects/${p.id}/questions/${qq.id}`);
                            onChanged();
                          } catch (e) { say(e.response?.data?.error || t('msg.opFailed')); }
                        }}
                        style={{
                          border: 0, background: 'transparent', cursor: 'pointer',
                          color: ink.muted, fontSize: 12, fontFamily: 'inherit',
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {asking === b.edition_id && (
                <QuestionForm
                  projectId={p.id} editionId={b.edition_id} t={t} say={say}
                  onDone={() => { setAsking(null); onChanged(); }}
                  onCancel={() => setAsking(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Picking from the shared catalogue, so a reading list is made of real
          editions rather than retyped titles. Saving is explicit here, because
          on an existing project a stray click would otherwise rewrite the list
          readers are already working through. */}
      <BookPicker chosen={draft} onChange={setDraft} t={t} />
      {dirty && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: ink.dim }}>
            {t('staff.pr.nBooks', { n: draft.length })}
          </span>
          <span style={{ flex: 1 }} />
          <Btn kind="secondary" onClick={() => setDraft(books)}
            style={{ padding: '5px 10px', fontSize: 12 }}>{t('common.cancel')}</Btn>
          <Btn onClick={() => setBooks(draft.map((b) => b.edition_id))} disabled={busy}
            style={{ padding: '5px 10px', fontSize: 12 }}>{t('staff.pr.saveBooks')}</Btn>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------- how the quiz is sat */

// The three rules that make copying an answer off the person next to you not
// worth the trouble: a clock, a random draw out of a bigger pool, and one go.
//
// One go is not a setting — it is how the quiz works — so it is stated here
// rather than offered as a switch somebody could turn off by accident.
function QuizSettings({ project: p, t, say, onChanged }) {
  const ch = p.quiz || {};
  const [seconds, setSeconds] = useState(String(ch.seconds ?? 0));
  const [draw, setDraw] = useState(String(ch.draw ?? 0));
  const [open, setOpen] = useState(!!ch.open_submissions);
  const [busy, setBusy] = useState(false);

  // How many questions exist, so "ask 4 of 10" can say what the 10 is.
  const pool = (p.books || []).reduce((n, b) => n + b.questions.length, 0);
  const n = Number(draw) || 0;
  const tooMany = n > pool && pool > 0;

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/projects/${p.id}/quiz-settings`, {
        quiz_seconds: Number(seconds) || 0,
        quiz_draw: n,
        quiz_open_submissions: open,
      });
      say(t('staff.pr.quizSaved'));
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      border: '1px solid ' + shell.border, borderRadius: radius.card,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
      background: shell.canvas,
    }}>
      <Label>{t('staff.pr.quizRules')}</Label>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.pr.secondsPerQ')}</Label>
          <Input type="number" min={0} max={3600} value={seconds}
            onChange={(e) => setSeconds(e.target.value)} style={{ width: 110 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.pr.drawCount')}</Label>
          <Input type="number" min={0} value={draw}
            onChange={(e) => setDraw(e.target.value)} style={{ width: 110 }} />
        </label>
        <span style={{ flex: 1 }} />
        <Btn onClick={save} disabled={busy || tooMany}
          style={{ padding: '5px 11px', fontSize: 12 }}>{t('staff.pr.quizSave')}</Btn>
      </div>

      {/* Both settings say themselves back, because "30" and "4" on their own
          mean nothing without the sentence around them. */}
      <span style={{ fontSize: 12, color: ink.body }}>
        {Number(seconds) > 0 ? t('staff.pr.secondsReads', { n: seconds }) : t('staff.pr.noTimeLimit')}
      </span>
      <span style={{ fontSize: 12, color: tooMany ? '#B4232A' : ink.body }}>
        {tooMany
          ? t('staff.pr.drawTooMany', { pool })
          : n > 0
            ? t('staff.pr.drawReads', { n, pool })
            : t('staff.pr.drawAll', { pool })}
      </span>
      <span style={{ fontSize: 12, color: ink.dim }}>{t('staff.pr.oneTry')}</span>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        {t('staff.pr.openSubmissions')}
      </label>
      <span style={{ fontSize: 12, color: ink.dim, marginTop: -4 }}>
        {t('staff.pr.openSubmissionsNote')}
      </span>
    </div>
  );
}

/* ------------------------------------ what readers have proposed */

// Questions readers have written, and the library deciding which are asked.
//
// Nothing here is live until it is approved, so this is a queue rather than a
// list of things already happening. Approving one puts it at the end of the
// book's questions, so a reader part-way through a campaign does not find the
// order shifting under them.
function Suggestions({ project: p, t, say, onChanged }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get(`/projects/${p.id}/suggestions`, { params: { status } })
      .then((r) => { if (alive) setRows(r.data || []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [p.id, status, key]);

  const review = async (id, approve, answer) => {
    setBusy(true);
    try {
      await api.put(`/projects/${p.id}/suggestions/${id}`, { approve, answer });
      say(approve ? t('staff.pr.sugApproved') : t('staff.pr.sugRejected'));
      setKey((k) => k + 1);
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const OPTS = ['PENDING', 'APPROVED', 'REJECTED'];

  return (
    <div style={{
      border: '1px solid ' + shell.border, borderRadius: radius.card,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Label>{t('staff.pr.suggestions')}</Label>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {OPTS.map((s) => {
            const on = status === s;
            return (
              <button key={s} onClick={() => setStatus(s)} style={{
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: font.ui,
              }}>{t('staff.pr.sug.' + s)}</button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <span style={{ fontSize: 12, color: ink.dim }}>{t('staff.pr.sugNone')}</span>
      ) : rows.map((q) => (
        <SuggestionRow key={q.id} q={q} busy={busy} review={review} t={t} />
      ))}
    </div>
  );
}

// One suggestion, with the four answers and which one the reader marked. The
// library can change that before approving — a good question with the wrong
// answer marked is worth keeping rather than refusing.
function SuggestionRow({ q, busy, review, t }) {
  const [answer, setAnswer] = useState(q.answer);
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
  const pending = q.status === 'PENDING';

  return (
    <div style={{
      border: '1px solid ' + shell.border, borderRadius: radius.control,
      padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, flex: '1 1 200px' }}>{q.prompt}</strong>
        <span style={{ fontSize: 11, color: ink.dim }}>
          {[q.by_name, q.book_title].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div style={{
        display: 'grid', gap: 3,
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))',
      }}>
        {opts.map((o, i) => (
          <label key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: i === answer ? '#15803D' : ink.body, fontWeight: i === answer ? 700 : 400,
          }}>
            <input type="radio" name={`sug-${q.id}`} checked={answer === i}
              disabled={!pending} onChange={() => setAnswer(i)} />
            {String.fromCharCode(65 + i)}. {o}
          </label>
        ))}
      </div>

      {pending && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Btn kind="secondary" disabled={busy} onClick={() => review(q.id, false)}
            style={{ padding: '4px 9px', fontSize: 12 }}>{t('staff.pr.sugReject')}</Btn>
          <Btn disabled={busy} onClick={() => review(q.id, true, answer)}
            style={{ padding: '4px 9px', fontSize: 12 }}>{t('staff.pr.sugApprove')}</Btn>
        </div>
      )}
    </div>
  );
}

// One quiz question: the prompt, four answers, and which of them is right.
// Four are required because that is what the reader app draws, and a question
// with two empty options renders as two blank buttons.
function QuestionForm({ projectId, editionId, t, say, onDone, onCancel }) {
  const [prompt, setPrompt] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState(0);
  const [busy, setBusy] = useState(false);

  const setOpt = (i) => (e) => setOpts(opts.map((o, j) => (j === i ? e.target.value : o)));
  const ready = prompt.trim() !== '' && opts.every((o) => o.trim() !== '');

  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/questions`, {
        edition_id: editionId, prompt: prompt.trim(),
        option_a: opts[0].trim(), option_b: opts[1].trim(),
        option_c: opts[2].trim(), option_d: opts[3].trim(),
        answer,
      });
      onDone();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: shell.canvas, borderRadius: radius.control, padding: 10,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <Input value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder={t('staff.pr.promptHint')} />
      {opts.map((o, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* The radio is how the right answer is named, which is less
              error-prone than typing an index nobody can see. */}
          <input type="radio" name={`ans-${editionId}`} checked={answer === i}
            onChange={() => setAnswer(i)} aria-label={t('staff.pr.correct')} />
          <Input value={o} onChange={setOpt(i)}
            placeholder={t('staff.pr.optionN', { n: String.fromCharCode(65 + i) })}
            style={{ flex: 1, width: 'auto' }} />
        </label>
      ))}
      <span style={{ fontSize: 11, color: ink.dim }}>{t('staff.pr.correctNote')}</span>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <Btn kind="secondary" onClick={onCancel} style={{ padding: '5px 10px', fontSize: 12 }}>
          {t('common.cancel')}
        </Btn>
        <Btn onClick={save} disabled={busy || !ready} style={{ padding: '5px 10px', fontSize: 12 }}>
          {t('staff.pr.saveQuestion')}
        </Btn>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- a new project */

export function NewProject() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [form, setForm] = useState({
    kind: 'CAMPAIGN', title: '', description: '',
    starts_on: '', ends_on: '', goal_target: '', goal_unit: '', school_wide: false,
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  // The target group and the reading list are chosen here, not after the fact:
  // whoever is setting up a campaign knows who it is for and what is on it at
  // the moment they write it down.
  const [aud, setAud] = useState({
    audience: 'SCHOOL', branch_ids: [], classroom_ids: [], school_ids: [],
  });
  const [picked, setPicked] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get('/branches', { params: { scope: 'mine' } })
      .then((r) => { if (alive) setBranches(r.data || []); }).catch(() => {});
    api.get('/classrooms').then((r) => { if (alive) setRooms(r.data || []); }).catch(() => {});
    if (isAdmin) {
      api.get('/admin/school').then((r) => { if (alive) setSchools(r.data || []); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [isAdmin]);

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const target = Number(form.goal_target) || 0;
  // The endpoint refuses a number with nothing being counted; saying so here
  // means the form does not have to be submitted to find that out.
  const needsUnit = target > 0 && !form.goal_unit.trim();
  // An audience that names nobody would quietly mean everybody.
  const audKey = aud.audience === 'BRANCHES' ? 'branch_ids'
    : aud.audience === 'CLASSES' ? 'classroom_ids'
      : aud.audience === 'SCHOOLS' ? 'school_ids' : null;
  const audEmpty = audKey !== null && (aud[audKey] || []).length === 0;
  const ready = form.title.trim() !== '' && !needsUnit && !audEmpty;

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/projects', {
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        starts_on: form.starts_on, ends_on: form.ends_on,
        goal_target: target, goal_unit: form.goal_unit.trim(),
        school_wide: form.school_wide,
        ...aud,
        edition_ids: picked.map((b) => b.edition_id),
      });
      nav('/staff/projects');
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <>
      <PageIntro>{t('staff.pr.newSub')}</PageIntro>

      <div style={{
        background: '#fff', border: '1px solid ' + shell.border,
        borderRadius: radius.card, padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>{t('staff.pr.kind')}</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {KINDS.map((k) => {
              const on = form.kind === k;
              return (
                <button key={k} onClick={() => setForm({ ...form, kind: k })} style={{
                  background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                  border: '1px solid ' + (on ? '#082F49' : shell.control),
                  borderRadius: radius.control, padding: '7px 13px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
                }}>{t('staff.pr.kind.' + k)}</button>
              );
            })}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.pr.title')}</Label>
          <Input value={form.title} onChange={set('title')}
            placeholder={t('staff.pr.titleHint')} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>{t('staff.pr.description')}</Label>
          <Input value={form.description} onChange={set('description')}
            placeholder={t('staff.pr.descriptionHint')} />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('staff.ds.startsOn')}</Label>
            <Input type="date" value={form.starts_on} onChange={set('starts_on')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{t('staff.ds.endsOn')}</Label>
            <Input type="date" value={form.ends_on} onChange={set('ends_on')} />
          </label>
        </div>

        {/* The goal, written as the sentence it is rather than as two fields
            whose relationship the reader has to guess: a number, and the thing
            that number counts. The line underneath says it back. */}
        <div style={{
          border: '1px solid ' + shell.border, borderRadius: radius.card, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <Label>{t('staff.pr.goalSection')}</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input type="number" min={0} value={form.goal_target}
              onChange={set('goal_target')} placeholder="0" style={{ width: 110 }} />
            <Input value={form.goal_unit} onChange={set('goal_unit')}
              placeholder={t('staff.pr.goalUnitHint')} style={{ flex: '1 1 160px', width: 'auto' }} />
          </div>
          <span style={{ fontSize: 12, color: needsUnit ? '#B4232A' : ink.dim }}>
            {needsUnit
              ? t('staff.pr.unitNeeded')
              : target > 0
                ? t('staff.pr.goalReads', { n: target, unit: form.goal_unit.trim() })
                : t('staff.pr.goalNote')}
          </span>
        </div>

        {/* Who it is for, chosen here rather than only after it exists. */}
        <div style={{
          border: '1px solid ' + shell.border, borderRadius: radius.card, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <Label>{t('staff.pr.audience')}</Label>
          <span style={{ fontSize: 12, color: ink.dim, marginTop: -4 }}>
            {t('staff.pr.audienceNote')}
          </span>
          <AudienceFields
            value={aud} onChange={setAud} isAdmin={isAdmin}
            branches={branches} rooms={rooms} schools={schools} t={t}
          />
        </div>

        {/* And what is on it. Optional: a book drive has no reading list. */}
        <div style={{
          border: '1px solid ' + shell.border, borderRadius: radius.card, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <Label>{t('staff.pr.reading')}</Label>
          <span style={{ fontSize: 12, color: ink.dim, marginTop: -4 }}>
            {t('staff.pr.readingNote')}
          </span>
          <BookPicker chosen={picked} onChange={setPicked} t={t} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={form.school_wide}
            onChange={(e) => setForm({ ...form, school_wide: e.target.checked })} />
          {t('staff.pr.schoolWideLabel')}
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn kind="secondary" onClick={() => nav('/staff/projects')}>{t('common.cancel')}</Btn>
          <Btn onClick={save} disabled={busy || !ready}>{t('staff.pr.create')}</Btn>
        </div>
      </div>

      <Toast>{toast}</Toast>
    </>
  );
}

// The audience controls, shared by the new-project form and the panel so the
// two cannot offer different choices or scope them differently.
function AudienceFields({ value, onChange, isAdmin, branches, rooms, schools, t }) {
  const OPTIONS = [
    ['SCHOOL', t('staff.pr.aud.SCHOOL')],
    ['BRANCHES', t('staff.pr.aud.BRANCHES')],
    ['CLASSES', t('staff.pr.aud.CLASSES')],
    ...(isAdmin ? [['SCHOOLS', t('staff.pr.aud.SCHOOLS')]] : []),
  ];

  const list = value.audience === 'BRANCHES' ? branches.map((b) => [b.id, b.name])
    : value.audience === 'CLASSES' ? rooms.map((r) => [r.id, r.label])
      : value.audience === 'SCHOOLS' ? schools.map((s) => [s.id, s.name]) : [];

  const key = value.audience === 'BRANCHES' ? 'branch_ids'
    : value.audience === 'CLASSES' ? 'classroom_ids' : 'school_ids';
  const picked = value[key] || [];

  const toggle = (id) => onChange({
    ...value,
    [key]: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id],
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {OPTIONS.map(([v, label]) => {
          const on = value.audience === v;
          return (
            <button key={v} type="button" onClick={() => onChange({ ...value, audience: v })}
              style={{
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: radius.control, padding: '7px 13px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{label}</button>
          );
        })}
      </div>

      {value.audience !== 'SCHOOL' && (
        list.length === 0 ? (
          <span style={{ fontSize: 12, color: ink.dim }}>{t('staff.pr.audNothing')}</span>
        ) : (
          <div style={{
            display: 'grid', gap: 4,
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))',
          }}>
            {list.map(([id, label]) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} />
                {label}
              </label>
            ))}
          </div>
        )
      )}

      {value.audience === 'SCHOOLS' && (
        <span style={{ fontSize: 12, color: '#92400E' }}>{t('staff.pr.audAllianceNote')}</span>
      )}
    </>
  );
}
