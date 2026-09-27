// Texniki dəstək — the librarian → school-administration ticket channel.
//
// Three screens, because the two sides of the conversation are different jobs:
//   · Müraciətlərim   the branch's own tickets, each opening its thread
//   · Yeni müraciət   raise one
//   · Gələn müraciətlər  the administration's queue (manager or admin only)
//
// The design has no ticketing screen, so this is built from the console's own
// primitives: a ScrollTable of 44px rows, status pills from the design system's
// STATUS_PILL map, and the thread as a card list rather than anything new.
//
// A thread's two sides are told apart by `from_admin` off the API, not by
// guessing from a role string, so the alignment cannot disagree with the badge.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { shell, ink, radius, font, pill, scrollRowStyle } from '../theme';
import {
  Card, Pill, Btn, Input, Alert, PageIntro, Label, Avatar,
} from '../components/StaffShell';
import { ScrollTable } from '../components/StaffTable';
import { Toast } from './deskShared';

const KINDS = ['BOOK_REQUEST', 'PROBLEM', 'OTHER'];

// Status → the design system's pill colours. A ticket waiting on the
// administration is "pending" blue; one somebody has picked up is amber; a
// finished one is green; a withdrawn one is grey.
const STATUS_PILL = {
  OPEN: 'pending',
  IN_PROGRESS: 'hold',
  RESOLVED: 'active',
  CLOSED: 'lost',
};

const kindKey = (k) => 'staff.sup.kind.' + k;
const statusKey = (s) => 'staff.sup.status.' + s;

/* ------------------------------------------------- the branch's own list */

const MINE_COLS = 'minmax(0,2.2fr) 130px 110px 110px 130px';

export function MyTickets() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/tickets');
      setRows(r.data || []);
    } catch { say(t('msg.opFailed')); }
    finally { setLoaded(true); }
  }, [say, t]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageIntro>{t('staff.sup.mineSub')}</PageIntro>

      <ScrollTable
        min={780} columns={MINE_COLS}
        head={[t('staff.sup.col.subject'), t('staff.sup.col.kind'),
          t('staff.sup.col.status'), t('staff.sup.col.replies'), t('staff.sup.col.updated')]}
        empty={loaded && rows.length === 0 ? t('staff.sup.mineEmpty') : null}
      >
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={() => setOpen(r.id)}
            style={{ ...scrollRowStyle(MINE_COLS), cursor: 'pointer' }}
          >
            <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* An unread reply is the one thing that must be visible without
                  opening the row. */}
              {r.unread && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#F2545B', flexShrink: 0,
                }} title={t('staff.sup.unread')} />
              )}
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.subject}
              </strong>
            </span>
            <span style={{ color: ink.body }}>{t(kindKey(r.kind))}</span>
            <span><Pill colors={pill(STATUS_PILL[r.status])}>{t(statusKey(r.status))}</Pill></span>
            <span style={{ color: ink.body }}>{r.reply_count || 0}</span>
            <span style={{ color: ink.dim }}>{fmtDate(r.last_reply_at || r.created_at)}</span>
          </div>
        ))}
      </ScrollTable>

      {open != null && (
        <TicketThread
          id={open} admin={false} t={t} say={say}
          onClose={() => { setOpen(null); load(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

/* --------------------------------------------------------- raise a ticket */

export function NewTicket() {
  const { t } = useTranslation();
  const [kind, setKind] = useState('BOOK_REQUEST');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState('');

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const ready = subject.trim() && body.trim();

  const send = async () => {
    setBusy(true);
    try {
      await api.post('/tickets', { kind, subject: subject.trim(), body: body.trim() });
      setSubject('');
      setBody('');
      setSent(true);
      say(t('staff.sup.sent'));
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageIntro>{t('staff.sup.newSub')}</PageIntro>

      {sent && <Alert tone="done">{t('staff.sup.sentNote')}</Alert>}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.sup.kindLabel')}</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {KINDS.map((k) => {
                const on = kind === k;
                return (
                  <button key={k} onClick={() => setKind(k)} style={{
                    background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
                    border: '1px solid ' + (on ? '#082F49' : shell.control),
                    borderRadius: radius.control, padding: '8px 14px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
                  }}>{t(kindKey(k))}</button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: ink.dim, lineHeight: 1.5 }}>
              {t('staff.sup.kindHint.' + kind)}
            </span>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{t('staff.sup.subjectLabel')}</Label>
            <Input
              value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder={t('staff.sup.subjectHint')}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{t('staff.sup.bodyLabel')}</Label>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              rows={7} placeholder={t('staff.sup.bodyHint')}
              style={{
                width: '100%', border: '1px solid ' + shell.control,
                borderRadius: radius.control, padding: '10px 12px', fontSize: 13,
                outline: 'none', fontFamily: 'inherit', color: ink.text,
                resize: 'vertical', lineHeight: 1.6,
              }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={send} disabled={busy || !ready}>{t('staff.sup.send')}</Btn>
          </div>
        </div>
      </Card>

      <Toast>{toast}</Toast>
    </>
  );
}

/* ----------------------------------------------- the administration's queue */

const QUEUE_COLS = 'minmax(0,2fr) minmax(0,1.2fr) 130px 110px 110px 110px';

export function TicketInbox() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('open');
  const [open, setOpen] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`;
      const r = await api.get('/manager/tickets' + q);
      setRows(r.data || []);
    } catch { say(t('msg.opFailed')); }
    finally { setLoaded(true); }
  }, [filter, say, t]);
  useEffect(() => { load(); }, [load]);

  const unread = useMemo(() => rows.filter((r) => r.unread).length, [rows]);

  return (
    <>
      <PageIntro>{t('staff.sup.inboxSub')}</PageIntro>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[['open', t('staff.sup.filterOpen')],
          ['RESOLVED', t('staff.sup.status.RESOLVED')],
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
        {unread > 0 && (
          <span style={{ alignSelf: 'center', fontSize: 12, color: ink.dim, fontWeight: 600 }}>
            {t('staff.sup.nUnread', { n: unread })}
          </span>
        )}
      </div>

      <ScrollTable
        min={880} columns={QUEUE_COLS}
        head={[t('staff.sup.col.subject'), t('staff.sup.col.from'), t('staff.sup.col.kind'),
          t('staff.sup.col.status'), t('staff.sup.col.replies'), t('staff.sup.col.updated')]}
        empty={loaded && rows.length === 0 ? t('staff.sup.inboxEmpty') : null}
      >
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={() => setOpen(r.id)}
            style={{ ...scrollRowStyle(QUEUE_COLS), cursor: 'pointer' }}
          >
            <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.unread && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#F2545B', flexShrink: 0,
                }} title={t('staff.sup.unread')} />
              )}
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.subject}
              </strong>
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.author_name}
              {r.branch_name && <span style={{ color: ink.dim }}> · {r.branch_name}</span>}
            </span>
            <span style={{ color: ink.body }}>{t(kindKey(r.kind))}</span>
            <span><Pill colors={pill(STATUS_PILL[r.status])}>{t(statusKey(r.status))}</Pill></span>
            <span style={{ color: ink.body }}>{r.reply_count || 0}</span>
            <span style={{ color: ink.dim }}>{fmtDate(r.last_reply_at || r.created_at)}</span>
          </div>
        ))}
      </ScrollTable>

      {open != null && (
        <TicketThread
          id={open} admin t={t} say={say}
          onClose={() => { setOpen(null); load(); }}
        />
      )}

      <Toast>{toast}</Toast>
    </>
  );
}

/* ----------------------------------------------------------- the thread */

// One ticket, its conversation, and whatever this side of it can do. Opening it
// stamps "seen", which is what clears the rail's badge.
function TicketThread({ id, admin, t, say, onClose }) {
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const root = admin ? '/manager/tickets' : '/tickets';

  const load = useCallback(async () => {
    try {
      const r = await api.get(`${root}/${id}`);
      setTicket(r.data);
      // Reading it is seeing it.
      api.post(`${root}/${id}/seen`).catch(() => {});
    } catch { say(t('msg.opFailed')); }
  }, [id, root, say, t]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.post(`${root}/${id}/replies`, { body: reply.trim() });
      setReply('');
      load();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const setStatus = async (status) => {
    setBusy(true);
    try {
      if (admin) await api.put(`/manager/tickets/${id}`, { status });
      else await api.put(`/tickets/${id}/close`);
      load();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const closed = ticket?.status === 'CLOSED';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 60,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: radius.modal, width: '100%', maxWidth: 680,
          display: 'flex', flexDirection: 'column', gap: 16, padding: 20,
          fontSize: 13, color: ink.text,
        }}
      >
        {!ticket ? (
          <div style={{ padding: 20, textAlign: 'center', color: ink.dim }}>
            {t('common.loading')}
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{ticket.subject}</h2>
                <div style={{ fontSize: 12, color: ink.dim, marginTop: 4 }}>
                  {[t(kindKey(ticket.kind)), ticket.author_name, ticket.branch_name,
                    fmtDate(ticket.created_at)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}>✕</Btn>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill colors={pill(STATUS_PILL[ticket.status])}>{t(statusKey(ticket.status))}</Pill>
            </div>

            {/* The opening message, then the thread. */}
            <Message
              name={ticket.author_name} body={ticket.body}
              at={ticket.created_at} fromAdmin={false} t={t}
            />
            {(ticket.replies || []).map((r) => (
              <Message
                key={r.id} name={r.author_name} body={r.body}
                at={r.created_at} fromAdmin={r.from_admin} t={t}
              />
            ))}

            {closed ? (
              <Alert tone="done">{t('staff.sup.closedNote')}</Alert>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>{t('staff.sup.replyLabel')}</Label>
                <textarea
                  value={reply} onChange={(e) => setReply(e.target.value)}
                  rows={4} placeholder={t('staff.sup.replyHint')}
                  style={{
                    width: '100%', border: '1px solid ' + shell.control,
                    borderRadius: radius.control, padding: '10px 12px', fontSize: 13,
                    outline: 'none', fontFamily: 'inherit', color: ink.text,
                    resize: 'vertical', lineHeight: 1.6,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {admin && ticket.status !== 'RESOLVED' && (
                    <Btn kind="secondary" disabled={busy} onClick={() => setStatus('RESOLVED')}>
                      {t('staff.sup.markResolved')}
                    </Btn>
                  )}
                  {admin && ticket.status === 'RESOLVED' && (
                    <Btn kind="secondary" disabled={busy} onClick={() => setStatus('IN_PROGRESS')}>
                      {t('staff.sup.reopen')}
                    </Btn>
                  )}
                  {!admin && (
                    <Btn kind="danger" disabled={busy} onClick={() => setStatus('CLOSED')}>
                      {t('staff.sup.withdraw')}
                    </Btn>
                  )}
                  <Btn onClick={send} disabled={busy || !reply.trim()}>{t('staff.sup.reply')}</Btn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// One message. The administration's side is tinted with the console's
// `approval` violet, the branch's is plain — colour *and* the words under the
// name, never colour alone.
function Message({ name, body, at, fromAdmin, t }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      background: fromAdmin ? '#F8F7FF' : shell.headerBg,
      border: '1px solid ' + (fromAdmin ? '#EDE9FE' : shell.border),
      borderRadius: radius.alert, padding: '12px 14px',
    }}>
      <Avatar initials={initialsOf(name)} size={28} bg={fromAdmin ? '#7C3AED' : '#0D9488'} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>{name || '—'}</strong>
          <span style={{ fontSize: 11, color: ink.dim, fontWeight: 600 }}>
            {fromAdmin ? t('staff.sup.fromAdmin') : t('staff.sup.fromBranch')}
          </span>
          <span style={{ fontSize: 11, color: ink.muted }}>{fmtDate(at)}</span>
        </div>
        <div style={{
          fontSize: 13, color: ink.body, lineHeight: 1.6, marginTop: 4,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{body}</div>
      </div>
    </div>
  );
}

function initialsOf(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '·';
}
