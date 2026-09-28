// Dərslik sorğuları — one screen, two sides.
//
// A teacher sees their own classes' requests and can withdraw one. The library
// sees the branch's queue and works it: accept and start preparing, trim a
// quantity the shelf cannot meet, say it is ready, hand it over. Which side you
// are on is the role, and the same row carries both.

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font, pill, scrollRowStyle } from '../theme';
import { Pill, Btn, Input, Label, Alert, PageIntro } from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Dialog } from './InventoryDialogs';
import { Toast } from './deskShared';

const COLS = 'minmax(0,1.5fr) 110px minmax(0,1.3fr) 120px 90px 110px 120px';

// Status → the design system's pill colours, and the order the desk works in.
const STATUS_PILL = {
  PENDING: 'pending',
  PREPARING: 'hold',
  READY: 'ready',
  COLLECTED: 'active',
  REJECTED: 'overdue',
  CANCELLED: 'lost',
};

const kindKey = (k) => 'staff.tbreq.kind.' + k;
const statusKey = (s) => 'staff.tbreq.status.' + s;

export default function TextbookRequests() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const isTeacher = user?.role === 'teacher';

  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('open');
  const [open, setOpen] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    const q = filter === 'all' ? '' : `?status=${filter}`;
    api.get('/textbook-requests' + q)
      .then((r) => { if (alive) setRows(r.data || []); })
      .catch(() => { if (alive) say(t('msg.opFailed')); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [filter, reloadKey, say, t]);

  const waiting = useMemo(
    () => rows.filter((r) => r.status === 'PENDING').length, [rows],
  );

  return (
    <>
      <PageIntro>
        {isTeacher ? t('staff.tbreq.mineSub') : t('staff.tbreq.queueSub')}
      </PageIntro>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['open', t('staff.tbreq.filterOpen')],
          ['COLLECTED', t('staff.tbreq.status.COLLECTED')],
          ['all', t('staff.sup.filterAll')]].map(([k, label]) => {
          const on = filter === k;
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
              border: '1px solid ' + (on ? '#082F49' : shell.control),
              borderRadius: radius.control, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
            }}>{label}</button>
          );
        })}
        <span style={{ flex: 1 }} />
        {!isTeacher && waiting > 0 && (
          <span style={{ fontSize: 12, color: ink.dim, fontWeight: 600 }}>
            {t('staff.tbreq.nWaiting', { n: waiting })}
          </span>
        )}
      </div>

      <ScrollTable
        min={900} columns={COLS}
        head={[t('staff.tbreq.class'), t('staff.sup.col.kind'), t('staff.tbreq.teacher'),
          t('staff.sup.col.status'), t('staff.tbreq.books'), t('staff.tbreq.pickup'),
          t('staff.sup.col.updated')]}
        empty={loaded && rows.length === 0 ? t('staff.tbreq.none') : null}
      >
        {rows.map((r) => (
          <div key={r.id} onClick={() => setOpen(r.id)}
            style={{ ...scrollRowStyle(COLS), cursor: 'pointer' }}>
            <strong>{r.class_label}</strong>
            <span style={{ color: ink.body }}>{t(kindKey(r.kind))}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.teacher_name || '—'}
            </span>
            <span><Pill colors={pill(STATUS_PILL[r.status])}>{t(statusKey(r.status))}</Pill></span>
            <span style={{ fontWeight: 700 }}>{r.total_books}</span>
            <span style={{ color: ink.body }}>
              {r.pickup_on ? fmtDate(r.pickup_on) : '—'}
            </span>
            <span style={{ color: ink.dim }}>{fmtDate(r.updated_at || r.created_at)}</span>
          </div>
        ))}
      </ScrollTable>

      {open != null && (
        <RequestDialog
          id={open} isTeacher={isTeacher} t={t} say={say}
          onClose={() => setOpen(null)}
          onChanged={() => { setOpen(null); reload(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

/* ------------------------------------------------------------ the detail */

function RequestDialog({ id, isTeacher, t, say, onClose, onChanged }) {
  const [req, setReq] = useState(null);
  const [approvals, setApprovals] = useState({});
  const [deskNote, setDeskNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/textbook-requests/${id}`)
      .then((r) => {
        if (!alive) return;
        setReq(r.data);
        setDeskNote(r.data.desk_note || '');
        const m = {};
        (r.data.lines || []).forEach((l) => {
          m[l.id] = l.qty_approved > 0 ? l.qty_approved : l.qty_requested;
        });
        setApprovals(m);
      })
      .catch(() => { if (alive) { say(t('msg.opFailed')); onClose(); } });
    return () => { alive = false; };
  }, [id, say, t, onClose]);

  const lines = req?.lines || [];
  const done = req && ['COLLECTED', 'REJECTED', 'CANCELLED'].includes(req.status);

  const patch = async (status) => {
    setBusy(true);
    try {
      await api.put(`/textbook-requests/${id}`, {
        status,
        desk_note: deskNote,
        lines: lines.map((l) => ({ id: l.id, qty_approved: Number(approvals[l.id]) || 0 })),
      });
      say(t('staff.tbreq.saved'));
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  const issue = async () => {
    setBusy(true);
    try {
      await api.post(`/textbook-requests/${id}/issue`);
      say(t('staff.tbreq.issued'));
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.put(`/textbook-requests/${id}/cancel`);
      say(t('staff.tbreq.cancelled'));
      onChanged();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  const totalAsked = lines.reduce((n, l) => n + l.qty_requested, 0);
  const totalGiving = lines.reduce((n, l) => n + (Number(approvals[l.id]) || 0), 0);

  return (
    <Dialog title={t('staff.tbreq.title')} onClose={onClose} wide t={t}>
      {!req ? (
        <div style={{ fontSize: 13, color: ink.dim }}>{t('common.loading')}</div>
      ) : (
        <>
          <div style={{
            background: shell.headerBg, border: '1px solid ' + shell.border,
            borderRadius: radius.alert, padding: '12px 14px',
            display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: -8, fontSize: 13,
          }}>
            <Fact label={t('staff.tbreq.class')}>{req.class_label}</Fact>
            <Fact label={t('staff.tbreq.teacher')}>{req.teacher_name || '—'}</Fact>
            <Fact label={t('staff.sup.col.kind')}>{t(kindKey(req.kind))}</Fact>
            <Fact label={t('staff.sup.col.status')}>
              <Pill colors={pill(STATUS_PILL[req.status])}>{t(statusKey(req.status))}</Pill>
            </Fact>
            <Fact label={t('staff.tbreq.pickup')}>
              {req.pickup_on ? fmtDate(req.pickup_on) : '—'}
            </Fact>
            <Fact label={t('staff.tbreq.returnBy')}>
              {req.return_by ? fmtDate(req.return_by) : '—'}
            </Fact>
          </div>

          {req.note && (
            <div style={{ fontSize: 13, color: ink.body, lineHeight: 1.6 }}>
              <strong>{t('staff.tbreq.teacherNote')}:</strong> {req.note}
            </div>
          )}

          {/* The lines. The library types what it can actually give. */}
          <div style={{
            border: '1px solid ' + shell.border, borderRadius: radius.card, overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 90px 110px', gap: 10,
              padding: '9px 14px', background: shell.headerBg,
              borderBottom: '1px solid ' + shell.border,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: ink.dim,
            }}>
              <span>{t('staff.col.book')}</span>
              <span>{t('staff.tbreq.asked')}</span>
              <span>{t('staff.tbreq.giving')}</span>
            </div>
            {lines.map((l) => (
              <div key={l.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 90px 110px', gap: 10,
                alignItems: 'center', padding: '8px 14px',
                borderBottom: '1px solid ' + shell.rowLine, fontSize: 13,
              }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.textbook?.title}
                  </strong>
                  <span style={{ fontSize: 11, color: ink.dim }}>
                    {l.textbook?.subject?.name || ''}
                    {l.textbook ? ` · ${t('staff.tb.freeN', { n: l.textbook.available_copies })}` : ''}
                  </span>
                </span>
                <span style={{ fontWeight: 700 }}>{l.qty_requested}</span>
                <span>
                  {isTeacher || done ? (
                    <strong>{l.qty_approved || l.qty_requested}</strong>
                  ) : (
                    <Input type="number" min={0} value={approvals[l.id] ?? ''}
                      onChange={(e) => setApprovals({ ...approvals, [l.id]: e.target.value })}
                      style={{ padding: '5px 8px' }} />
                  )}
                </span>
              </div>
            ))}
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 90px 110px', gap: 10,
              padding: '9px 14px', fontSize: 13, fontWeight: 800,
            }}>
              <span>{t('staff.tbreq.total')}</span>
              <span>{totalAsked}</span>
              <span>{totalGiving}</span>
            </div>
          </div>

          {!isTeacher && !done && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>{t('staff.tbreq.deskNote')}</Label>
              <Input value={deskNote} onChange={(e) => setDeskNote(e.target.value)}
                placeholder={t('staff.tbreq.deskNoteHint')} />
            </label>
          )}
          {isTeacher && req.desk_note && (
            <Alert tone="approval">{req.desk_note}</Alert>
          )}

          {req.status === 'READY' && (
            <Alert tone="done">{t('staff.tbreq.readyNote')}</Alert>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <Btn kind="secondary" onClick={onClose}>{t('common.close')}</Btn>
            {isTeacher && !done && (
              <Btn kind="danger" onClick={cancel} disabled={busy}>
                {t('staff.tbreq.withdraw')}
              </Btn>
            )}
            {!isTeacher && !done && (
              <>
                <Btn kind="danger" onClick={() => patch('REJECTED')} disabled={busy}>
                  {t('staff.tbreq.reject')}
                </Btn>
                {req.status === 'PENDING' && (
                  <Btn kind="secondary" onClick={() => patch('PREPARING')} disabled={busy}>
                    {t('staff.tbreq.prepare')}
                  </Btn>
                )}
                {req.status !== 'READY' && (
                  <Btn kind="secondary" onClick={() => patch('READY')} disabled={busy}>
                    {t('staff.tbreq.markReady')}
                  </Btn>
                )}
                <Btn onClick={issue} disabled={busy}>{t('staff.tbreq.handOver')}</Btn>
              </>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}

function Fact({ label, children }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: ink.dim }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{children}</span>
    </span>
  );
}
