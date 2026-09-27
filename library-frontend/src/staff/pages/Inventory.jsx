// Catalogue & inventory.
//
// The branch's holdings with availability bars and expandable copies (barcode,
// condition, status). Adding a title searches the shared catalogue first, so a
// book another branch already catalogued is linked rather than retyped — that
// is the whole point of the Work/Edition split.

import { useCallback, useEffect, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, pill } from '../theme';
import { Card, PageTitle, Pill, Table, Row, Btn } from '../components/StaffShell';
import { BookCover } from '../../mrb/components/primitives';

export default function Inventory() {
  const { t } = useTranslation();
  const [books, setBooks] = useState([]);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(() => {
    api.get('/books').then((r) => setBooks(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const term = q.trim().toLowerCase();
  const shown = term
    ? books.filter((b) =>
        (b.title || '').toLowerCase().includes(term) ||
        (b.author?.name || '').toLowerCase().includes(term) ||
        (b.isbn || '').toLowerCase().includes(term) ||
        (b.call_no || '').toLowerCase().includes(term))
    : books;

  return (
    <>
      <PageTitle
        sub={t('staff.inv.sub')}
        right={<Btn onClick={() => setAdding(true)}>{t('staff.inv.addTitle')}</Btn>}
      >{t('staff.nav.inventory')}</PageTitle>

      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={t('staff.inv.search')}
        style={{
          width: '100%', maxWidth: 420, border: '1px solid ' + shell.control,
          borderRadius: radius.control, padding: '9px 12px', fontSize: 13,
          fontFamily: font.ui, outline: 'none', marginBottom: 14,
        }}
      />

      <Table
        columns="44px minmax(0,2fr) minmax(0,1.2fr) 150px 90px"
        head={['', t('staff.col.book'), t('staff.col.author'), t('staff.col.availability'), t('staff.col.copies')]}
        empty={shown.length === 0 ? t('staff.inv.none') : null}
      >
        {shown.map((b) => {
          const copies = b.copies || [];
          const free = copies.filter((c) => c.status?.code === 'AVAILABLE').length;
          const pct = copies.length ? (free / copies.length) * 100 : 0;
          const open = expanded === b.id;
          return (
            <div key={b.id}>
              <Row columns="44px minmax(0,2fr) minmax(0,1.2fr) 150px 90px"
                selected={open} onClick={() => setExpanded(open ? null : b.id)}>
                <span style={{ width: 28 }}>
                  <BookCover title={b.title} src={b.cover_url ? assetUrl(b.cover_url) : ''} radiusPx={3} fontScale={0.3} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{b.title}</strong>
                  <span style={{ display: 'block', fontSize: 11.5, color: ink.muted }}>
                    {b.call_no ? `${b.call_no} · ` : ''}{b.isbn || t('staff.inv.noIsbn')}
                  </span>
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ink.body }}>
                  {b.author?.name || '—'}
                </span>
                <span>
                  <span style={{ display: 'block', height: 6, background: shell.headerBg, borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                    <span style={{ display: 'block', height: '100%', width: pct + '%', background: free ? '#16A34A' : '#F2545B' }} />
                  </span>
                  <span style={{ fontSize: 11, color: ink.dim }}>
                    {t('staff.inv.nFree', { n: free, total: copies.length })}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: ink.dim }}>
                  {open ? '▾' : '▸'} {copies.length}
                </span>
              </Row>

              {open && (
                <div style={{ background: shell.headerBg, padding: '10px 16px 14px', borderBottom: '1px solid ' + shell.border }}>
                  {copies.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: ink.dim }}>{t('staff.inv.noCopies')}</div>
                  ) : copies.map((c) => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0',
                      fontSize: 12.5, flexWrap: 'wrap',
                    }}>
                      <strong style={{ minWidth: 110 }}>{c.tracking_number || '—'}</strong>
                      <Pill colors={c.status?.code === 'AVAILABLE' ? pill('available') : pill('out')}>
                        {c.status?.name || c.status?.code || '—'}
                      </Pill>
                      {c.condition?.name && (
                        <span style={{ color: ink.dim }}>{c.condition.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Table>

      {adding && <AddTitle t={t} say={say} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#fff', padding: '11px 18px', borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 100,
        }}>{toast}</div>
      )}
    </>
  );
}

// Add a title: search the shared catalogue first. Linking an existing edition
// is the normal path; typing a new one is the fallback.
function AddTitle({ t, say, onClose, onAdded }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [callNo, setCallNo] = useState('');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return undefined; }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/catalog/search', { params: { q: term, limit: 12 } });
        setHits(res.data || []);
      } catch { setHits([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const add = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await api.post('/books', { edition_id: picked.edition_id, call_no: callNo.trim() });
      say(t('staff.inv.added'));
      onAdded();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 95,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: radius.modal, width: 'min(600px, 100%)',
        maxHeight: '86vh', overflowY: 'auto', padding: 22, fontFamily: font.ui,
      }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{t('staff.inv.addTitle')}</h2>
        <p style={{ fontSize: 12.5, color: ink.dim, margin: '0 0 16px', lineHeight: 1.55 }}>
          {t('staff.inv.addHint')}
        </p>

        <input
          value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder={t('staff.inv.searchCatalogue')}
          style={{
            width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
            padding: '10px 12px', fontSize: 13.5, fontFamily: font.ui, outline: 'none',
          }}
        />

        <div style={{ marginTop: 12, maxHeight: 260, overflowY: 'auto' }}>
          {searching && <div style={{ fontSize: 12.5, color: ink.dim, padding: 8 }}>{t('common.loading')}</div>}
          {!searching && q.trim().length >= 2 && hits.length === 0 && (
            <div style={{ fontSize: 12.5, color: ink.dim, padding: 8 }}>{t('staff.inv.noMatches')}</div>
          )}
          {hits.map((h) => (
            <button key={h.edition_id} onClick={() => setPicked(h)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
              background: picked?.edition_id === h.edition_id ? shell.rowSelected : 'transparent',
              border: '1px solid ' + (picked?.edition_id === h.edition_id ? '#1B9DD9' : shell.border),
              borderRadius: radius.control, padding: '9px 11px', marginBottom: 6,
              cursor: 'pointer', fontFamily: font.ui,
            }}>
              <span style={{ width: 26, flexShrink: 0 }}>
                <BookCover title={h.title} src={h.cover_url ? assetUrl(h.cover_url) : ''} radiusPx={3} fontScale={0.3} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{h.title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: ink.muted }}>
                  {h.author_name || '—'}{h.publisher_name ? ` · ${h.publisher_name}` : ''}
                  {h.holding_count ? ` · ${t('staff.inv.heldBy', { n: h.holding_count })}` : ''}
                </span>
              </span>
              {h.already_held && <Pill colors={pill('in')}>{t('staff.inv.alreadyHeld')}</Pill>}
            </button>
          ))}
        </div>

        {picked && (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: ink.dim, marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {t('staff.inv.callNo')}
              </span>
              <input value={callNo} onChange={(e) => setCallNo(e.target.value)} style={{
                width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
                padding: '9px 11px', fontSize: 13, fontFamily: font.ui, outline: 'none',
              }} />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 16 }}>
          <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn onClick={add} disabled={!picked || busy}>{t('common.add')}</Btn>
        </div>
      </div>
    </div>
  );
}
