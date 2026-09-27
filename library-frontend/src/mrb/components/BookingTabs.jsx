// The booking side of the library, which the new reader UI was missing: the
// reader's own reservations (with pickup deadline and a way to withdraw), and
// requests for books the library does not hold.

import { useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { brand, slate, danger, warning, radius, font } from '../theme';
import { BookCover, Button, Card } from './primitives';
import { fmtDate } from '../../i18n/dates';

// Reservation status → pill colours, branching on the fixed code and never on
// the display name, which a librarian can rename in any language.
function statusStyle(code) {
  switch (code) {
    case 'APPROVED': return { background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' };
    case 'PENDING': return { background: brand.tint100, color: brand.deep, border: '1px solid ' + brand.tint200 };
    case 'REJECTED': return { background: '#FCE7F3', color: '#9F1239', border: '1px solid #FBCFE8' };
    case 'EXPIRED': return { background: danger.tint, color: danger.text, border: '1px solid ' + danger.border };
    default: return { background: slate.surface, color: slate.body, border: '1px solid ' + slate.border };
  }
}

export function ReservationsTab({ items, t, say, reload }) {
  if (items.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px dashed ' + slate.border2, borderRadius: radius.card,
        padding: 40, textAlign: 'center', fontSize: 14, color: slate.dim, lineHeight: 1.6,
      }}>{t('mrb.book.noReservations')}</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((r) => {
        const deadline = r.pickup_deadline ? new Date(r.pickup_deadline) : null;
        const daysLeft = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;
        return (
          <Card key={r.id} padding={16}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: 48, flexShrink: 0 }}>
                <BookCover title={r.title} src={r.cover_url ? assetUrl(r.cover_url) : ''} radiusPx={4} fontScale={0.45} />
              </div>

              <div style={{ flex: '1 1 220px', minWidth: 190 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: slate.dim }}>{r.author || '—'}</div>
                <div style={{ fontSize: 11.5, color: slate.muted, marginTop: 4 }}>
                  {t('mrb.book.requestedOn', { date: fmtDate(r.request_date) })}
                  {r.tracking_number ? ` · ${r.tracking_number}` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
                <span style={{ ...statusStyle(r.status_code), borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 700 }}>
                  {r.status || r.status_code}
                </span>

                {r.status_code === 'APPROVED' && deadline && (
                  <span style={{
                    fontSize: 11.5, fontWeight: 700,
                    color: daysLeft <= 1 ? danger.text : daysLeft <= 3 ? warning.text : slate.dim,
                  }}>
                    {daysLeft < 0
                      ? t('mrb.book.pickupExpired')
                      : t('mrb.book.pickupBy', { date: fmtDate(deadline), n: daysLeft })}
                  </span>
                )}

                {r.can_cancel && (
                  <Button kind="ghost" style={{ color: danger.text }} onClick={async () => {
                    try {
                      await api.delete(`/reservation/${r.id}`);
                      say(t('mrb.book.cancelled'));
                      reload();
                    } catch (e) {
                      say(e.response?.data?.code === 'NOT_CANCELLABLE'
                        ? t('mrb.book.errNotCancellable') : t('msg.opFailed'));
                    }
                  }}>{t('mrb.book.cancel')}</Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function RequestsTab({ items, t, say, reload }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim()) { say(t('mrb.book.errNeedTitle')); return; }
    setBusy(true);
    try {
      await api.post('/book-requests', { title: title.trim(), author: author.trim(), note: note.trim() });
      setTitle(''); setAuthor(''); setNote(''); setOpen(false);
      say(t('mrb.requestSent'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const pill = (status) => {
    const map = {
      PENDING: { background: brand.tint100, color: brand.deep },
      FULFILLED: { background: '#DCFCE7', color: '#166534' },
      REJECTED: { background: '#FCE7F3', color: '#9F1239' },
    };
    return map[status] || { background: slate.surface, color: slate.body };
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        {open ? (
          <Card>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
              color: slate.muted, marginBottom: 12,
            }}>{t('mrb.book.requestTitle')}</div>

            {[
              [t('mrb.book.fTitle'), title, setTitle, true],
              [t('mrb.book.fAuthor'), author, setAuthor, false],
              [t('mrb.book.fNote'), note, setNote, false],
            ].map(([label, value, set, required]) => (
              <label key={label} style={{ display: 'block', marginBottom: 11 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: slate.body, marginBottom: 5 }}>
                  {label}{required ? ' *' : ''}
                </span>
                <input value={value} onChange={(e) => set(e.target.value)} style={{
                  width: '100%', border: '1px solid ' + slate.border, borderRadius: radius.input,
                  padding: '10px 12px', fontSize: 14, fontFamily: font.ui, outline: 'none',
                }} />
              </label>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 6 }}>
              <Button kind="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={send} disabled={busy}>{t('mrb.book.send')}</Button>
            </div>
          </Card>
        ) : (
          <Button onClick={() => setOpen(true)}>{t('mrb.book.requestTitle')}</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px dashed ' + slate.border2, borderRadius: radius.card,
          padding: 36, textAlign: 'center', fontSize: 14, color: slate.dim, lineHeight: 1.6,
        }}>{t('mrb.book.noRequests')}</div>
      ) : (
        <Card padding={0}>
          {items.map((r, i) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: i < items.length - 1 ? '1px solid ' + slate.border : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: slate.dim }}>
                  {r.author || '—'}
                  {r.created_at ? ` · ${fmtDate(r.created_at)}` : ''}
                </div>
                {r.note && <div style={{ fontSize: 12.5, color: slate.body, marginTop: 4 }}>{r.note}</div>}
              </div>
              <span style={{
                ...pill(r.status), borderRadius: 999, padding: '4px 11px',
                fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
              }}>{t('mrb.book.st.' + r.status) === 'mrb.book.st.' + r.status ? r.status : t('mrb.book.st.' + r.status)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
