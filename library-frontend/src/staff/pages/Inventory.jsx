// S3 Catalogue & inventory — transcribed from `Staff Console.dc.html`.
//
// A 170px KPI strip, a filter row with the search and "+ Add title", then an
// 820px table: the title with its 24×36 spine, the ISBN in mono, CEFR, genre,
// the copy count, a segmented 8px availability bar with a one-line summary,
// and a toggle that opens the copies as 230px cards on #F8FAFC.
//
// Adding a title searches the shared catalogue first, so a book another branch
// already catalogued is linked rather than retyped — that is the whole point
// of the Work/Edition split. The design's ISBN lookup would need an external
// bibliographic service; the shared catalogue is the one this system has.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font, pill } from '../theme';
import { Kpi, KpiRow, Pill, Btn, Input, Spine, Mono } from '../components/StaffShell';
import { EditTitle, EditCopy, BulkUpload } from './InventoryDialogs';

// The design's last column holds one button. This console also has to edit a
// title and manage its copies, so the slot is widened to take three.
const COLS = 'minmax(0,2.4fr) 140px 60px minmax(0,1.1fr) 70px minmax(0,1.4fr) 190px';
const BAR = { free: '#16A34A', out: '#1B9DD9', other: '#CBD5E1' };

// The pencil on a copy card: an icon button, so it does not compete with the
// row's real buttons.
const copyIconStyle = {
  background: 'none', border: 0, padding: '2px 4px', cursor: 'pointer',
  color: '#64748B', fontSize: 13, lineHeight: 1,
};

export default function Inventory() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [editing, setEditing] = useState(null);   // a book being edited
  const [copyFor, setCopyFor] = useState(null);   // { book, copy|null }
  const [toast, setToast] = useState('');

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(() => {
    api.get('/books').then((r) => setBooks(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  // The top bar's search lands here, so keep the field and the URL in step.
  useEffect(() => {
    const urlQ = params.get('q') || '';
    if (urlQ !== q) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const term = q.trim().toLowerCase();
  const shown = term
    ? books.filter((b) =>
      (b.title || '').toLowerCase().includes(term)
      || (b.author?.name || '').toLowerCase().includes(term)
      || (b.isbn || '').toLowerCase().includes(term)
      || (b.call_no || '').toLowerCase().includes(term)
      || (b.copies || []).some((c) => (c.tracking_number || '').toLowerCase().includes(term)))
    : books;

  const totals = useMemo(() => {
    let copies = 0, free = 0, out = 0;
    books.forEach((b) => (b.copies || []).forEach((c) => {
      copies++;
      if (c.status?.code === 'AVAILABLE') free++;
      else if (c.status?.code === 'LOANED') out++;
    }));
    return { titles: books.length, copies, free, out };
  }, [books]);

  return (
    <>
      <KpiRow>
        <Kpi label={t('staff.inv.kpiTitles')} value={totals.titles} />
        <Kpi label={t('staff.inv.kpiCopies')} value={totals.copies} />
        <Kpi label={t('staff.inv.kpiOnLoan')} value={totals.out} />
        <Kpi
          label={t('staff.inv.kpiAvailable')} value={totals.free}
          note={totals.copies
            ? t('staff.inv.pctOnShelf', { pct: Math.round((totals.free / totals.copies) * 100) })
            : ''}
          noteColor="#166534"
        />
      </KpiRow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}); }}
          placeholder={t('staff.inv.search')}
          style={{ flex: '1 1 260px', width: 'auto' }}
        />
        <Btn kind="secondary" onClick={() => setBulk(true)} style={{ padding: '9px 14px' }}>
          {t('staff.inv.bulkUpload')}
        </Btn>
        <Btn onClick={() => setAdding(true)} style={{ padding: '9px 14px' }}>
          + {t('staff.inv.addTitle')}
        </Btn>
      </div>

      <div style={{
        background: '#fff', border: '1px solid ' + shell.border,
        borderRadius: radius.card, overflowX: 'auto',
      }}>
        <div style={{ minWidth: 820 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
            padding: '10px 16px', background: shell.headerBg,
            borderBottom: '1px solid ' + shell.border,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: ink.dim,
          }}>
            <span>{t('staff.col.title')}</span><span>ISBN</span><span>CEFR</span>
            <span>{t('staff.col.genre')}</span><span>{t('staff.col.copies')}</span>
            <span>{t('staff.col.availability')}</span><span />
          </div>

          {shown.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim }}>
              {t('staff.inv.none')}
            </div>
          )}

          {shown.map((b) => {
            const copies = b.copies || [];
            const free = copies.filter((c) => c.status?.code === 'AVAILABLE').length;
            const out = copies.filter((c) => c.status?.code === 'LOANED').length;
            const other = copies.length - free - out;
            const open = expanded === b.id;
            const pctOf = (n) => (copies.length ? (n / copies.length) * 100 : 0) + '%';

            return (
              <div key={b.id}>
                <div style={{
                  display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center',
                  padding: '10px 16px', borderBottom: '1px solid ' + shell.rowLine,
                  fontSize: 13, minHeight: 44,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Spine src={b.cover_url ? assetUrl(b.cover_url) : ''} seed={b.title} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{
                        display: 'block', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{b.title}</strong>
                      <span style={{ fontSize: 12, color: ink.dim }}>{b.author?.name || '—'}</span>
                    </span>
                  </span>

                  <Mono style={{ color: ink.body }}>{b.isbn || '—'}</Mono>
                  <span style={{ fontWeight: 700 }}>{b.cefr_level || '—'}</span>
                  <span style={{
                    color: ink.body, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.genre?.name || '—'}</span>
                  <span style={{ fontWeight: 700 }}>{copies.length}</span>

                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      display: 'flex', height: 8, borderRadius: 999,
                      overflow: 'hidden', background: shell.canvas,
                    }}>
                      <span style={{ width: pctOf(free), background: BAR.free }} />
                      <span style={{ width: pctOf(out), background: BAR.out }} />
                      <span style={{ width: pctOf(other), background: BAR.other }} />
                    </span>
                    <span style={{ fontSize: 11, color: ink.body }}>
                      {t('staff.inv.barSummary', { free, out, total: copies.length })}
                    </span>
                  </span>

                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Btn
                      kind="secondary" onClick={() => setExpanded(open ? null : b.id)}
                      style={{ padding: '5px 10px', fontSize: 12 }}
                    >{open ? t('staff.inv.hide') : t('staff.inv.copies')}</Btn>
                    <Btn
                      kind="secondary" onClick={() => setEditing(b)}
                      style={{ padding: '5px 10px', fontSize: 12 }}
                    >{t('common.edit')}</Btn>
                  </span>
                </div>

                {open && (
                  <div style={{
                    background: shell.headerBg, borderBottom: '1px solid ' + shell.border,
                    padding: '10px 16px 14px 50px', display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8,
                  }}>
                    {copies.length === 0 && (
                      <div style={{ fontSize: 12.5, color: ink.dim }}>{t('staff.inv.noCopies')}</div>
                    )}
                    {copies.map((c) => (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
                        border: '1px solid ' + shell.border, borderRadius: radius.control,
                        padding: '8px 10px',
                      }}>
                        <Mono style={{ color: ink.text }}>{c.tracking_number || '—'}</Mono>
                        <span style={{
                          color: ink.dim, fontSize: 12, flex: 1, minWidth: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{c.condition?.name || t('staff.inv.noCondition')}</span>
                        <Pill colors={c.status?.code === 'AVAILABLE' ? pill('available') : pill('out')}>
                          {c.status?.name || c.status?.code || '—'}
                        </Pill>
                        <button
                          onClick={() => setCopyFor({ book: b, copy: c })}
                          title={t('common.edit')} aria-label={t('common.edit')}
                          style={copyIconStyle}
                        >✎</button>
                      </div>
                    ))}
                    <button
                      onClick={() => setCopyFor({ book: b, copy: null })}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: '#fff', border: '1px dashed ' + shell.control,
                        borderRadius: radius.control, padding: '8px 10px', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, color: ink.body, fontFamily: font.ui,
                      }}
                    >+ {t('staff.inv.addCopy')}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {adding && <AddTitle t={t} say={say} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}
      {bulk && <BulkUpload t={t} say={say} onClose={() => setBulk(false)} onDone={() => { setBulk(false); load(); }} />}
      {editing && (
        <EditTitle
          book={editing} t={t} say={say}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {copyFor && (
        <EditCopy
          book={copyFor.book} copy={copyFor.copy} t={t} say={say}
          onClose={() => setCopyFor(null)}
          onSaved={() => { setCopyFor(null); load(); }}
        />
      )}

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
      position: 'fixed', inset: 0, background: 'rgba(8,47,73,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 620, background: '#fff', borderRadius: radius.modal,
        padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 64px rgba(15,23,42,0.35)', maxHeight: '86vh', overflowY: 'auto',
        fontFamily: font.ui,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t('staff.inv.addTitle')}</h2>
          <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}>✕</Btn>
        </div>

        <Input
          value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder={t('staff.inv.searchCatalogue')}
        />
        <div style={{ fontSize: 12, color: ink.dim, marginTop: -8 }}>{t('staff.inv.addHint')}</div>

        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {searching && <div style={{ fontSize: 12.5, color: ink.dim, padding: 8 }}>{t('common.loading')}</div>}
          {!searching && q.trim().length >= 2 && hits.length === 0 && (
            <div style={{ fontSize: 12.5, color: ink.dim, padding: 8 }}>{t('staff.inv.noMatches')}</div>
          )}
          {hits.map((h) => (
            <button key={h.edition_id} onClick={() => setPicked(h)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
              background: picked?.edition_id === h.edition_id ? shell.rowSelected : '#fff',
              border: '1px solid ' + (picked?.edition_id === h.edition_id ? '#1B9DD9' : shell.border),
              borderRadius: radius.control, padding: '9px 11px',
              cursor: 'pointer', fontFamily: font.ui,
            }}>
              <Spine src={h.cover_url ? assetUrl(h.cover_url) : ''} seed={h.title} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{h.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: ink.dim }}>
                  {h.author_name || '—'}{h.publisher_name ? ` · ${h.publisher_name}` : ''}
                  {h.holding_count ? ` · ${t('staff.inv.heldBy', { n: h.holding_count })}` : ''}
                </span>
              </span>
              {h.already_held && <Pill colors={pill('in')}>{t('staff.inv.alreadyHeld')}</Pill>}
            </button>
          ))}
        </div>

        {picked && (
          <label style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            fontSize: 12, fontWeight: 600, color: ink.strong,
          }}>
            {t('staff.inv.callNo')}
            <Input value={callNo} onChange={(e) => setCallNo(e.target.value)} />
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn onClick={add} disabled={!picked || busy}>{t('common.add')}</Btn>
        </div>
      </div>
    </div>
  );
}
