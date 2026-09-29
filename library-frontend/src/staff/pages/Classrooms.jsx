// Siniflərim / Sinif dərslikləri — what a class is holding, and putting it right.
//
// A teacher sees their own classes; the library sees the branch's. Either way
// the screen is the same question: what went out, what has come back, and what
// is still with the children. The numbers are derived from the movement ledger,
// so this can never say something the history does not.
//
// Recording a loss asks for a note, because per-class counting is only honest
// if somebody writes down whose book it was.

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, pill, scrollRowStyle } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Label, Alert, PageIntro } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Dialog } from './InventoryDialogs';
import { Toast } from './deskShared';

const COLS = 'minmax(0,2fr) minmax(0,1.2fr) 80px 90px 90px 90px 150px';

export default function Classrooms() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const isTeacher = user?.role === 'teacher';

  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [held, setHeld] = useState([]);
  const [roster, setRoster] = useState([]);
  const [moving, setMoving] = useState(null);
  const [returningSet, setReturningSet] = useState(false);
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    api.get('/classrooms').then((r) => {
      if (!alive) return;
      const list = r.data || [];
      setRooms(list);
      setRoomId((cur) => cur || (list[0] ? list[0].id : null));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!roomId) return undefined;
    let alive = true;
    api.get(`/classroom-holdings?classroom_id=${roomId}`)
      .then((r) => { if (alive) setHeld(r.data || []); }).catch(() => {});
    api.get(`/classrooms/${roomId}/students`)
      .then((r) => { if (alive) setRoster(r.data || []); }).catch(() => { if (alive) setRoster([]); });
    return () => { alive = false; };
  }, [roomId, reloadKey]);

  const room = rooms.find((r) => r.id === roomId);
  const totals = useMemo(() => held.reduce((a, h) => ({
    out: a.out + h.outstanding,
    issued: a.issued + h.issued,
    returned: a.returned + h.returned,
    lost: a.lost + h.lost + h.damaged,
  }), { out: 0, issued: 0, returned: 0, lost: 0 }), [held]);

  // Only titles the class is still holding can come back, so they are the only
  // ones the end-of-year dialog offers.
  const stillOut = useMemo(() => held.filter((h) => h.outstanding > 0), [held]);

  return (
    <>
      <PageIntro>{isTeacher ? t('staff.cls.mineSub') : t('staff.cls.allSub')}</PageIntro>

      {rooms.length === 0 ? (
        <Alert tone="action">{t('staff.cls.noClasses')}</Alert>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {rooms.map((r) => {
              const on = r.id === roomId;
              return (
                <button key={r.id} onClick={() => setRoomId(r.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                  border: '1px solid ' + (on ? '#082F49' : shell.control),
                  borderRadius: radius.control, padding: '8px 14px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
                }}>
                  {r.label}
                  <span style={{
                    background: on ? 'rgba(255,255,255,0.2)' : shell.canvas,
                    color: on ? '#fff' : ink.body,
                    borderRadius: 999, padding: '0 7px', fontSize: 11,
                  }}>{r.student_count}</span>
                </button>
              );
            })}
          </div>

          {room && (
            <div style={{ fontSize: 12, color: ink.dim }}>
              {[room.teacher_names?.join(', '), room.academic_year?.label]
                .filter(Boolean).join(' · ')}
            </div>
          )}

          <KpiRow>
            <Kpi label={t('staff.cls.kpiStudents')} value={room?.student_count ?? 0} />
            <Kpi label={t('staff.cls.kpiOut')} value={totals.out}
              note={t('staff.cls.withChildren')} />
            <Kpi label={t('staff.cls.kpiReturned')} value={totals.returned} />
            <Kpi label={t('staff.cls.kpiLost')} value={totals.lost}
              noteColor={totals.lost > 0 ? '#B4232A' : undefined}
              note={totals.lost > 0 ? t('staff.tb.writtenOff') : ''} />
          </KpiRow>

          {/* The end of the year. Doing this a title at a time is eight
              open-fill-submit cycles for 4-A, and the answer is nearly always
              "all of them" — so the set comes back in one action and the
              teacher adjusts only the exceptions. */}
          {stillOut.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: '#fff', border: '1px solid ' + shell.border,
              borderRadius: radius.card, padding: '10px 14px',
            }}>
              <span style={{ fontWeight: 700 }}>
                {t('staff.cls.setSummary', { titles: stillOut.length, copies: totals.out })}
              </span>
              <span style={{ flex: 1 }} />
              <Btn onClick={() => setReturningSet(true)}>{t('staff.cls.returnSet')}</Btn>
            </div>
          )}

          <ScrollTable
            min={880} columns={COLS}
            head={[t('staff.col.book'), t('staff.tb.subject'), t('staff.tb.grade'),
              t('staff.cls.issued'), t('staff.cls.returned'), t('staff.cls.lost'),
              t('staff.col.actions')]}
            empty={held.length === 0 ? t('staff.cls.nothingOut') : null}
          >
            {held.map((h) => (
              <div key={h.textbook_id} style={scrollRowStyle(COLS)}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.title}
                  </strong>
                  <span style={{ fontSize: 11, color: h.outstanding > 0 ? '#92400E' : ink.dim }}>
                    {t('staff.cls.stillOut', { n: h.outstanding })}
                  </span>
                </span>
                <span style={{ color: ink.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.subject_name || '—'}
                </span>
                <span style={{ color: ink.body }}>{h.grade}</span>
                <span style={{ fontWeight: 700 }}>{h.issued}</span>
                <span style={{ color: ink.body }}>{h.returned}</span>
                <span>
                  {h.lost + h.damaged > 0
                    ? <Pill colors={pill('overdue')}>{h.lost + h.damaged}</Pill>
                    : <span style={{ color: ink.muted }}>0</span>}
                </span>
                <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn kind="secondary" disabled={h.outstanding < 1}
                    onClick={() => setMoving(h)}>{t('staff.cls.record')}</Btn>
                </span>
              </div>
            ))}
          </ScrollTable>

          {roster.length > 0 && (
            <details style={{
              background: '#fff', border: '1px solid ' + shell.border,
              borderRadius: radius.card, padding: '12px 16px', fontSize: 13,
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                {t('staff.cls.roster', { n: roster.length })}
              </summary>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))',
                gap: 6, marginTop: 10,
              }}>
                {roster.map((s) => (
                  <span key={s.user_id} style={{ color: ink.body }}>
                    {s.name}
                    {s.status && s.status !== 'ACTIVE' && (
                      <span style={{ color: ink.muted, fontSize: 11 }}> · {s.status}</span>
                    )}
                  </span>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {moving && (
        <MovementDialog
          holding={moving} classroomId={roomId} roster={roster} t={t} say={say}
          onClose={() => setMoving(null)}
          onDone={() => { setMoving(null); reload(); }}
        />
      )}

      {returningSet && (
        <ReturnSetDialog
          holdings={stillOut} classroomId={roomId} roster={roster} t={t} say={say}
          onClose={() => setReturningSet(false)}
          onDone={() => { setReturningSet(false); reload(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

/* --------------------------------------------- recording what came back */

function MovementDialog({ holding, classroomId, roster, t, say, onClose, onDone }) {
  const [kind, setKind] = useState('RETURN');
  const [qty, setQty] = useState(String(holding.outstanding));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const n = Number(qty);
  const ok = n >= 1 && n <= holding.outstanding;
  // A loss with no name is how a class set quietly goes missing, so the note is
  // required for anything that is not a plain return.
  const needsNote = kind !== 'RETURN';
  const ready = ok && (!needsNote || note.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/textbook-movements', {
        classroom_id: classroomId, textbook_id: holding.textbook_id,
        kind, qty: n, note: note.trim(),
      });
      say(t('staff.cls.recorded'));
      onDone();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('staff.cls.record')} onClose={onClose} t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8 }}>
        <strong>{holding.title}</strong> · {t('staff.cls.stillOut', { n: holding.outstanding })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>{t('staff.cls.what')}</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['RETURN', 'LOST', 'DAMAGED'].map((k) => {
            const on = kind === k;
            return (
              <button key={k} onClick={() => setKind(k)} style={{
                background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                border: '1px solid ' + (on ? '#082F49' : shell.control),
                borderRadius: radius.control, padding: '7px 13px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{t('staff.cls.kind.' + k)}</button>
            );
          })}
        </div>
        {kind !== 'RETURN' && (
          <span style={{ fontSize: 12, color: '#92400E' }}>{t('staff.cls.writeOffNote')}</span>
        )}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>{t('staff.cls.howMany')}</Label>
        <Input type="number" min={1} max={holding.outstanding} value={qty}
          onChange={(e) => setQty(e.target.value)} style={{ maxWidth: 140 }} />
        {!ok && qty !== '' && (
          <span style={{ fontSize: 12, color: '#B4232A' }}>
            {t('staff.cls.tooMany', { n: holding.outstanding })}
          </span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>{needsNote ? t('staff.cls.whichStudent') : t('staff.cls.note')}</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)}
          list="roster-names"
          placeholder={needsNote ? t('staff.cls.whichStudentHint') : t('staff.cls.noteHint')} />
        <datalist id="roster-names">
          {roster.map((s) => <option key={s.user_id} value={s.name} />)}
        </datalist>
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={submit} disabled={busy || !ready}>{t('staff.cls.confirm')}</Btn>
      </div>
    </Dialog>
  );
}

/* ------------------------------------- collecting the whole set at year end */

// The end-of-year collection: every title the class still holds, on one form.
//
// Each row is prefilled with a full return, because that is what nearly always
// happened — the teacher's job here is to correct the two copies that did not
// come back, not to retype the twenty-three that did. A row only asks for a
// name once something is written off, which is the same rule the single-title
// dialog enforces: collecting in bulk must not become a way around saying
// whose book went missing.
//
// The three numbers on a row may add up to *less* than what is outstanding.
// That is a child who was away on the day, and the remainder simply stays out.
function ReturnSetDialog({ holdings, classroomId, roster, t, say, onClose, onDone }) {
  const [lines, setLines] = useState(() => holdings.map((h) => ({
    textbook_id: h.textbook_id,
    title: h.title,
    outstanding: h.outstanding,
    returned: String(h.outstanding),
    lost: '0',
    damaged: '0',
    note: '',
  })));
  const [busy, setBusy] = useState(false);

  const set = (id, field, value) => setLines((prev) => prev.map((l) => (
    l.textbook_id === id ? { ...l, [field]: value } : l
  )));

  // One row's arithmetic, used for both its own error line and the footer.
  const readRow = (l) => {
    const returned = Number(l.returned) || 0;
    const lost = Number(l.lost) || 0;
    const damaged = Number(l.damaged) || 0;
    const total = returned + lost + damaged;
    const writeOff = lost + damaged;
    return {
      returned, lost, damaged, total, writeOff,
      tooMany: total > l.outstanding,
      negative: returned < 0 || lost < 0 || damaged < 0,
      needsNote: writeOff > 0 && !l.note.trim(),
    };
  };

  const rows = lines.map((l) => ({ line: l, calc: readRow(l) }));
  const blocked = rows.some(({ calc }) => calc.tooMany || calc.negative || calc.needsNote);
  const touched = rows.filter(({ calc }) => calc.total > 0);
  const ready = !blocked && touched.length > 0;

  const totalCopies = touched.reduce((n, { calc }) => n + calc.total, 0);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post('/textbook-movements/bulk', {
        classroom_id: classroomId,
        lines: touched.map(({ line, calc }) => ({
          textbook_id: line.textbook_id,
          returned: calc.returned,
          lost: calc.lost,
          damaged: calc.damaged,
          note: line.note.trim(),
        })),
      });
      say(t('staff.cls.setRecorded', { titles: r.data?.titles ?? touched.length }));
      onDone();
    } catch (e) {
      // The endpoint names the title it stopped on, which is more use than a
      // generic failure when eight of them are on screen.
      const d = e.response?.data;
      say(d?.title ? `${d.title}: ${d.error}` : (d?.error || t('msg.opFailed')));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('staff.cls.returnSetTitle')} onClose={onClose} t={t} wide>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8 }}>
        {t('staff.cls.returnSetIntro')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(({ line: l, calc }) => (
          <div key={l.textbook_id} style={{
            border: '1px solid ' + shell.border, borderRadius: radius.card,
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
            background: calc.total === 0 ? shell.canvas : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{l.title}</strong>
              <span style={{ fontSize: 11, color: ink.dim }}>
                {t('staff.cls.stillOut', { n: l.outstanding })}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                ['returned', t('staff.cls.colReturned')],
                ['lost', t('staff.cls.colLost')],
                ['damaged', t('staff.cls.colDamaged')],
              ].map(([field, label]) => (
                <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Label>{label}</Label>
                  <Input
                    type="number" min={0} max={l.outstanding} value={l[field]}
                    onChange={(e) => set(l.textbook_id, field, e.target.value)}
                    style={{ width: 92 }}
                  />
                </label>
              ))}
            </div>

            {calc.writeOff > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Label>{t('staff.cls.whichStudent')}</Label>
                <Input
                  value={l.note} list="roster-names"
                  placeholder={t('staff.cls.whichStudentHint')}
                  onChange={(e) => set(l.textbook_id, 'note', e.target.value)}
                />
              </label>
            )}

            {calc.tooMany && (
              <span style={{ fontSize: 12, color: '#B4232A' }}>
                {t('staff.cls.tooMany', { n: l.outstanding })}
              </span>
            )}
            {calc.needsNote && (
              <span style={{ fontSize: 12, color: '#B4232A' }}>{t('staff.cls.noteNeeded')}</span>
            )}
          </div>
        ))}
      </div>

      <datalist id="roster-names">
        {roster.map((s) => <option key={s.user_id} value={s.name} />)}
      </datalist>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        borderTop: '1px solid ' + shell.border, paddingTop: 12,
      }}>
        <span style={{ fontSize: 13, color: ink.body }}>
          {t('staff.cls.setFooter', { titles: touched.length, copies: totalCopies })}
        </span>
        <span style={{ flex: 1 }} />
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={submit} disabled={busy || !ready}>{t('staff.cls.confirm')}</Btn>
      </div>
    </Dialog>
  );
}
