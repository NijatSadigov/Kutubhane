// Catalogue — screen 2 of the handoff.
//
// Scope switch (My shelf / My library / Global) · left filter panel
// (search, "available at my library" toggle, CEFR chips, genre checkboxes
// with colour dot + count, edition-language chips, length chips) · results
// grid with removable active-filter chips, sort select and an empty state.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, radius, font, genreColors } from '../theme';
import {
  BookCover, CefrBadge, GenreChip, RatingLine, AvailabilityPill, Button, Toast,
} from '../components/primitives';

const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
const LANGS = [['az', 'Azərbaycanca'], ['tr', 'Türkçe'], ['en', 'English'], ['ru', 'Русский']];
const LENGTHS = [['short', 'mrb.len.short'], ['mid', 'mrb.len.mid'], ['long', 'mrb.len.long']];
const SORTS = [['borrowed', 'mrb.sort.borrowed'], ['newest', 'mrb.sort.newest'], ['title', 'mrb.sort.title']];

export default function Catalogue() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [scope, setScope] = useState('library');
  const [q, setQ] = useState(params.get('q') || '');
  const [available, setAvailable] = useState(false);
  const [cefr, setCefr] = useState([]);
  const [genres, setGenres] = useState([]);
  const [langs, setLangs] = useState([]);
  const [len, setLen] = useState('');
  const [sort, setSort] = useState('title');

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ library: 0, global: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);

  // Keep the URL in step so a search from the header lands here.
  useEffect(() => {
    const urlQ = params.get('q') || '';
    if (urlQ !== q) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/catalog/browse', {
        params: {
          scope,
          q: q.trim() || undefined,
          cefr: cefr.length ? cefr.join(',') : undefined,
          lang: langs.length ? langs.join(',') : undefined,
          len: len || undefined,
          sort,
          available: available ? 'true' : undefined,
          genre: genres.length ? genres.join(',') : undefined,
        },
      });
      setItems(res.data.items || []);
    } catch (err) {
      if (err.response?.data?.code === 'NOT_IMPLEMENTED') {
        setItems([]);
        setError(t('mrb.shelfNotReady'));
      } else {
        setError(t('msg.opFailed'));
      }
    } finally { setLoading(false); }
  }, [scope, q, cefr, langs, len, sort, available, genres, t]);

  useEffect(() => { load(); }, [load]);

  // Scope counts, fetched once and unfiltered so the segmented control shows
  // the size of each scope rather than the size of the current result set.
  useEffect(() => {
    (async () => {
      try {
        const [lib, glob] = await Promise.all([
          api.get('/catalog/browse', { params: { scope: 'library' } }),
          api.get('/catalog/browse', { params: { scope: 'global' } }),
        ]);
        setCounts({ library: lib.data.total || 0, global: glob.data.total || 0 });
      } catch { /* counts are a nicety */ }
    })();
  }, []);

  // Genre facets come from what is actually in the current scope, because
  // genres are per-branch rows a librarian names, not a fixed list.
  const genreFacets = useMemo(() => {
    const m = new Map();
    items.forEach((i) => { if (i.genre) m.set(i.genre, (m.get(i.genre) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeChips = [
    ...cefr.map((v) => ({ label: v, clear: () => setCefr(cefr.filter((x) => x !== v)) })),
    ...genres.map((v) => ({ label: v, clear: () => setGenres(genres.filter((x) => x !== v)) })),
    ...langs.map((v) => ({ label: (LANGS.find((l) => l[0] === v) || ['', v])[1], clear: () => setLangs(langs.filter((x) => x !== v)) })),
    ...(len ? [{ label: t(LENGTHS.find((l) => l[0] === len)[1]), clear: () => setLen('') }] : []),
    ...(available ? [{ label: t('mrb.availableHere'), clear: () => setAvailable(false) }] : []),
    ...(q ? [{ label: `“${q}”`, clear: () => { setQ(''); setParams({}); } }] : []),
  ];

  const clearAll = () => {
    setCefr([]); setGenres([]); setLangs([]); setLen(''); setAvailable(false);
    setQ(''); setParams({});
  };

  const SCOPES = [
    ['shelf', t('mrb.scope.shelf'), null],
    ['library', t('mrb.scope.library'), counts.library],
    ['global', t('mrb.scope.global'), counts.global],
  ];

  return (
    <>
      <div style={{ fontSize: 12, color: slate.dim, marginBottom: 6 }}>{t('mrb.nav.catalogue')}</div>
      <h1 style={{ fontFamily: font.display, fontSize: 38, fontWeight: 600, margin: '0 0 18px', letterSpacing: '-0.02em' }}>
        {t('mrb.nav.catalogue')}
      </h1>

      {/* scope switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{
          display: 'inline-flex', gap: 4, background: slate.surface,
          border: '1px solid ' + slate.border, borderRadius: 999, padding: 4, flexWrap: 'wrap',
        }}>
          {SCOPES.map(([key, label, n]) => {
            const active = scope === key;
            return (
              <button key={key} onClick={() => setScope(key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: active ? '#fff' : 'transparent',
                color: active ? brand.deep : slate.body,
                border: active ? '1px solid ' + slate.border : '1px solid transparent',
                boxShadow: active ? '0 1px 2px rgba(15,23,42,.06)' : 'none',
                padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: font.ui, whiteSpace: 'nowrap',
              }}>
                {label}
                {n != null && (
                  <span style={{
                    background: active ? brand.tint100 : slate.border, color: active ? brand.deep : slate.body,
                    borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800,
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 13, color: slate.dim }}>
          {scope === 'library' ? t('mrb.scope.libraryHint') : scope === 'global' ? t('mrb.scope.globalHint') : t('mrb.scope.shelfHint')}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 20 }}>
        {/* ------------------------------------------------ filter panel */}
        <aside style={{ flex: '0 1 260px', minWidth: 230, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('mrb.searchPlaceholder')}
            style={{
              width: '100%', border: '1px solid ' + slate.border, background: '#fff',
              borderRadius: radius.input, padding: '10px 12px', fontSize: 13,
              outline: 'none', fontFamily: font.ui, color: slate.text,
            }}
          />

          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: brand.tint50, border: '1px solid ' + brand.tint200,
            borderRadius: radius.smallCard, padding: '12px 14px', cursor: 'pointer',
          }}>
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: brand.deep }}>{t('mrb.availableHere')}</span>
              <span style={{ display: 'block', fontSize: 11, color: slate.dim, marginTop: 2 }}>
                {t('mrb.availableHereHint', { n: items.filter((i) => i.available_copies > 0).length })}
              </span>
            </span>
            <span
              role="switch" aria-checked={available}
              onClick={() => setAvailable(!available)}
              style={{
                width: 42, height: 24, borderRadius: 999, flexShrink: 0,
                background: available ? brand.primary : slate.border2,
                position: 'relative', transition: 'background .15s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: available ? 21 : 3, width: 18, height: 18,
                borderRadius: '50%', background: '#fff', transition: 'left .15s',
                boxShadow: '0 1px 3px rgba(15,23,42,.3)',
              }} />
            </span>
            <input type="checkbox" checked={available} onChange={() => setAvailable(!available)} style={{ display: 'none' }} />
          </label>

          <FilterGroup label={t('mrb.filter.cefr')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CEFR_LEVELS.map((lv) => (
                <Chip key={lv} active={cefr.includes(lv)} onClick={() => toggle(cefr, setCefr, lv)}>{lv}</Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label={t('mrb.filter.genre')}>
            {genreFacets.length === 0 && <div style={{ fontSize: 12, color: slate.muted }}>—</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {genreFacets.map(([name, n]) => {
                const [dot] = genreColors(name);
                const on = genres.includes(name);
                return (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(genres, setGenres, name)}
                      style={{ accentColor: brand.primary, width: 14, height: 14 }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: on ? slate.text : slate.body, fontWeight: on ? 700 : 400 }}>{name}</span>
                    <span style={{ fontSize: 11, color: slate.muted }}>{n}</span>
                  </label>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label={t('mrb.filter.language')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LANGS.map(([code, label]) => (
                <Chip key={code} active={langs.includes(code)} onClick={() => toggle(langs, setLangs, code)}>{label}</Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label={t('mrb.filter.length')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LENGTHS.map(([key, lk]) => (
                <Chip key={key} active={len === key} onClick={() => setLen(len === key ? '' : key)}>{t(lk)}</Chip>
              ))}
            </div>
          </FilterGroup>
        </aside>

        {/* ---------------------------------------------------- results */}
        <section style={{ flex: '999 1 560px', minWidth: 300 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {activeChips.map((c, i) => (
                <button key={i} onClick={c.clear} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, background: brand.tint100,
                  color: brand.deep, border: 0, borderRadius: 999, padding: '5px 10px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
                }}>{c.label} <span style={{ opacity: 0.7 }}>✕</span></button>
              ))}
              {activeChips.length > 0 && (
                <button onClick={clearAll} style={{
                  background: 'none', border: 0, color: slate.dim, fontSize: 12,
                  fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: font.ui,
                }}>{t('mrb.clearAll')}</button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: slate.dim }}>{t('mrb.sortBy')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{
                border: '1px solid ' + slate.border, background: '#fff', borderRadius: 10,
                padding: '7px 10px', fontSize: 13, fontFamily: font.ui, color: slate.strong, cursor: 'pointer',
              }}>
                {SORTS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </div>
          </div>

          {loading && <div style={{ padding: 40, textAlign: 'center', color: slate.muted, fontSize: 14 }}>{t('common.loading')}</div>}

          {!loading && error && (
            <div style={{
              padding: 32, textAlign: 'center', background: '#fff',
              border: '1px dashed ' + slate.border2, borderRadius: radius.card, color: slate.body, fontSize: 14,
            }}>{error}</div>
          )}

          {!loading && !error && items.length === 0 && (
            <div style={{
              padding: 48, textAlign: 'center', background: '#fff',
              border: '1px dashed ' + slate.border2, borderRadius: radius.card,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: slate.strong, marginBottom: 6 }}>{t('mrb.noResults')}</div>
              <div style={{ fontSize: 13, color: slate.dim, marginBottom: 16 }}>{t('mrb.noResultsHint')}</div>
              <Button kind="soft" onClick={clearAll}>{t('mrb.clearAll')}</Button>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: slate.dim, marginBottom: 12 }}>
                {t('mrb.nResults', { n: items.length })}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 22,
              }}>
                {items.map((b) => (
                  <BookCard key={b.edition_id} book={b} t={t} reload={load}
                    onOpen={() => nav(`/app/book/${b.edition_id}`)} say={say} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <Toast message={toast} />
    </>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
        color: slate.muted, marginBottom: 9,
      }}>{label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? brand.deep : '#fff',
      color: active ? '#fff' : slate.body,
      border: '1px solid ' + (active ? brand.deep : slate.border),
      padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      cursor: 'pointer', fontFamily: font.ui, whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

// A card shows two actions at most:
//
//   * "Add to shelf" always — a reader can want a book the library has never
//     heard of, and get hold of it themselves.
//   * "Request loan" only when their own library has a copy free right now.
//
// When the reader already has something going on with the book — it is in
// their bag, or the desk is holding it for them — the second slot says so
// instead of offering a reserve button that the backend would only reject.
function BookCard({ book, onOpen, say, t, reload }) {
  const [busy, setBusy] = useState(false);
  const canBorrow = book.held_here && book.available_copies > 0 && !book.my_status;
  // "On my shelf" means the reader has the book — their own copy. Wanting to
  // read it is a different list, and starring it is different again.
  const onShelf = book.shelf_status === 'OWNED';

  const stop = (e) => e.stopPropagation();

  const requestLoan = async (e) => {
    stop(e);
    setBusy(true);
    try {
      await api.post('/reservation', { book_id: book.book_id });
      say(t('mrb.cat.loanRequested'));
      reload();
    } catch (err) {
      const code = err.response?.data?.code;
      say(code === 'LIMIT' ? t('mrb.err.limit')
        : code === 'DUPLICATE' ? t('mrb.err.duplicate')
        : code === 'NO_COPY' ? t('mrb.err.noCopy')
        : t('msg.opFailed'));
      reload();
    } finally { setBusy(false); }
  };

  const toggleFavorite = async (e) => {
    stop(e);
    setBusy(true);
    try {
      await api.post('/shelf', {
        work_id: book.work_id, edition_id: book.edition_id, favorite: !book.is_favorite,
      });
      say(book.is_favorite ? t('mrb.cat.unfavorited') : t('mrb.cat.favorited'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const toggleShelf = async (e) => {
    stop(e);
    setBusy(true);
    try {
      await api.post('/shelf', {
        work_id: book.work_id,
        edition_id: book.edition_id,
        status: onShelf ? '' : 'OWNED',
      });
      say(onShelf ? t('mrb.shelf.removed') : t('mrb.addedToShelf'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  return (
    <article onClick={onOpen} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ position: 'relative' }}>
        <BookCover title={book.title} author={book.author} src={book.cover_url ? assetUrl(book.cover_url) : ''} />
        {book.cefr && (
          <span style={{ position: 'absolute', top: 8, right: 8 }}><CefrBadge level={book.cefr} /></span>
        )}
        <button
          onClick={toggleFavorite} disabled={busy}
          title={book.is_favorite ? t('mrb.cat.unfavorite') : t('mrb.cat.favorite')}
          aria-label={book.is_favorite ? t('mrb.cat.unfavorite') : t('mrb.cat.favorite')}
          style={{
            position: 'absolute', top: 6, left: 6, width: 30, height: 30, borderRadius: '50%',
            border: 0, cursor: 'pointer', lineHeight: 1, fontSize: 15,
            background: book.is_favorite ? 'rgba(255,255,255,.94)' : 'rgba(15,23,42,.42)',
            color: book.is_favorite ? '#F59E0B' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >{book.is_favorite ? '★' : '☆'}</button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: slate.text }}>{book.title}</div>
      <div style={{ fontSize: 12, color: slate.dim, marginTop: -4 }}>
        {book.author || '—'}{book.pages ? ` · ${book.pages} ${t('mrb.pagesShort')}` : ''}
      </div>
      {book.genre && <GenreChip genre={book.genre} dotOnly />}
      <RatingLine rating={book.rating} count={book.ratings_count} />
      <AvailabilityPill heldHere={book.held_here} availableCopies={book.available_copies} copies={book.copies} t={t} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
        <Button
          kind={onShelf ? 'soft' : 'secondary'}
          disabled={busy}
          onClick={toggleShelf}
          style={{ width: '100%', whiteSpace: 'normal' }}
        >{onShelf ? t('mrb.cat.onShelf') : t('mrb.cat.addToShelf')}</Button>

        <MyStatusAction book={book} canBorrow={canBorrow} busy={busy}
          onRequest={requestLoan} t={t} />
      </div>
    </article>
  );
}

// The second slot: either an offer to borrow, or a statement of where the
// reader already stands with this book. Never a button that cannot work.
function MyStatusAction({ book, canBorrow, busy, onRequest, t }) {
  if (book.my_status === 'ON_LOAN') {
    return (
      <StatusNote tone="ok">
        {book.my_due_date
          ? t('mrb.cat.youHaveItDue', { date: new Date(book.my_due_date).toLocaleDateString() })
          : t('mrb.cat.youHaveIt')}
      </StatusNote>
    );
  }
  if (book.my_status === 'RESERVED_READY') {
    return (
      <StatusNote tone="ready">
        {book.my_pickup_deadline
          ? t('mrb.cat.readyBy', { date: new Date(book.my_pickup_deadline).toLocaleDateString() })
          : t('mrb.cat.ready')}
      </StatusNote>
    );
  }
  if (book.my_status === 'RESERVED_PENDING') {
    return <StatusNote tone="wait">{t('mrb.cat.requested')}</StatusNote>;
  }
  if (canBorrow) {
    return (
      <Button disabled={busy} onClick={onRequest} style={{ width: '100%', whiteSpace: 'normal' }}>
        {t('mrb.cat.requestLoan')}
      </Button>
    );
  }
  // Not held here, or every copy is out. The reader can still shelve it.
  return null;
}

function StatusNote({ tone, children }) {
  const tones = {
    ok: ['#DCFCE7', '#166534'],
    ready: [brand.tint100, brand.deep],
    wait: [slate.surface, slate.body],
  };
  const [bg, fg] = tones[tone] || tones.wait;
  return (
    <div style={{
      background: bg, color: fg, borderRadius: radius.button, padding: '9px 12px',
      fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.4,
    }}>{children}</div>
  );
}
