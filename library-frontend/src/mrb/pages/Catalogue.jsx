// Catalogue — screen "04 Catalogue" of the handoff.
//
// Transcribed from the prototype's `isCatalog` block rather than from the
// README's summary: the 24px screen rhythm, the school eyebrow and the result
// label flanking a Source Serif 38/600 title, the 12px-radius white scope
// switch with its count pills and hint line beneath, the filter panel as a
// 260px white card (search row on #F8FAFC, the "available at my library"
// switch on #F0F9FF/#BAE6FD, 12px/700/0.08em group labels, 999px chips at
// 5px 12px, genre rows with an 18px check box and an 8px square swatch), the
// 36px filter/sort bar, and the 180px card grid at 28px/22px with its 19px
// serif cover title, 10px absolute badges, plain-text availability line and
// the dashed sky empty state.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { coverColors, genreColors, cefrColors } from '../theme';
import { useSchoolLabel } from '../useSchoolLabel';
import { useReaderApi } from '../guest';
import { Toast } from '../components/primitives';

/* Literal design values, kept together so they read like the spec. */
const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F8FAFC',
  tint: '#F0F9FF', sky100: '#E0F2FE', sky200: '#BAE6FD',
  deep: '#075985', brand: '#1B9DD9', brandHi: '#1580B5',
  okBg: '#DCFCE7', okFg: '#166534', coralFg: '#B4232A',
};
const SERIF = "'Source Serif 4', Georgia, serif";
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04)';

const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
const LANGS = [['az', 'Azərbaycanca'], ['tr', 'Türkçe'], ['en', 'English'], ['ru', 'Русский']];
const LENGTHS = [['short', 'mrb.len.short'], ['mid', 'mrb.len.mid'], ['long', 'mrb.len.long']];
// The four the design's sort menu offers, in its order.
const SORTS = [
  ['popular', 'mrb.sort.borrowed'], ['rating', 'mrb.sort.rating'],
  ['newest', 'mrb.sort.newest'], ['title', 'mrb.sort.title'],
];
const SCOPE_KEYS = ['shelf', 'library', 'global'];

export default function Catalogue() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { label: schoolLabel, short: branchShort } = useSchoolLabel();
  const { guest, http, browse, bookPath } = useReaderApi();

  // A guest has no library and no shelf, so only the global scope exists.
  const [scope, setScope] = useState(guest ? 'global' : 'library');
  const [q, setQ] = useState(params.get('q') || '');
  const [available, setAvailable] = useState(false);
  const [cefr, setCefr] = useState([]);
  const [genres, setGenres] = useState([]);
  const [langs, setLangs] = useState([]);
  const [len, setLen] = useState('');
  const [sort, setSort] = useState('title');

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
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
      const res = await http.get(browse, {
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
    } catch {
      setError(t('msg.opFailed'));
    } finally { setLoading(false); }
  }, [scope, q, cefr, langs, len, sort, available, genres, t, http, browse]);

  useEffect(() => { load(); }, [load]);

  // Scope counts, unfiltered, so the segmented control reports the size of each
  // scope rather than the size of the current result set.
  useEffect(() => {
    (async () => {
      const got = {};
      const keys = guest ? ['global'] : SCOPE_KEYS;
      await Promise.all(keys.map(async (s) => {
        try {
          const res = await http.get(browse, { params: { scope: s } });
          got[s] = res.data.total || 0;
        } catch { /* counts are a nicety */ }
      }));
      setCounts(got);
    })();
  }, [guest, http, browse]);

  // Genre facets come from what is actually in the current scope, because
  // genres are per-branch rows a librarian names, not a fixed list.
  const genreFacets = useMemo(() => {
    const m = new Map();
    items.forEach((i) => { if (i.genre) m.set(i.genre, (m.get(i.genre) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const availCount = useMemo(
    () => items.filter((i) => i.available_copies > 0).length, [items],
  );

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeFilters = [
    ...cefr.map((v) => ({ label: v, onRemove: () => setCefr(cefr.filter((x) => x !== v)) })),
    ...genres.map((v) => ({ label: v, onRemove: () => setGenres(genres.filter((x) => x !== v)) })),
    ...langs.map((v) => ({
      label: (LANGS.find((l) => l[0] === v) || ['', v])[1],
      onRemove: () => setLangs(langs.filter((x) => x !== v)),
    })),
    ...(len ? [{ label: t(LENGTHS.find((l) => l[0] === len)[1]), onRemove: () => setLen('') }] : []),
    ...(available ? [{ label: t('mrb.availableHere'), onRemove: () => setAvailable(false) }] : []),
    ...(q ? [{ label: `“${q}”`, onRemove: () => { setQ(''); setParams({}); } }] : []),
  ];

  const clearFilters = () => {
    setCefr([]); setGenres([]); setLangs([]); setLen(''); setAvailable(false);
    setQ(''); setParams({});
  };

  const scopeTotal = counts[scope];
  const resultLabel = loading ? t('common.loading')
    : activeFilters.length && scopeTotal != null && scopeTotal !== items.length
      ? t('mrb.cat.resultFiltered', { n: items.length, total: scopeTotal })
      : t('mrb.nResults', { n: items.length });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* -------------------------------------------------------- heading */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.brandHi, marginBottom: 6 }}>
            {(guest ? t('mrb.guest.publicCatalogue') : schoolLabel) || ' '}
          </div>
          <h1 className="mrb-h-page" style={{
            margin: 0, fontFamily: SERIF, fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em',
          }}>{t('mrb.nav.catalogue')}</h1>
        </div>
        <div style={{ fontSize: 14, color: C.body }}>{resultLabel}</div>
      </div>

      {/* --------------------------------------------------- scope switch */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!guest && <div style={{
          display: 'flex', gap: 4, background: '#fff', border: '1px solid ' + C.line,
          borderRadius: 12, padding: 4, alignSelf: 'flex-start', flexWrap: 'wrap',
          boxShadow: CARD_SHADOW,
        }}>
          {SCOPE_KEYS.map((key) => {
            const on = scope === key;
            return (
              <button key={key} onClick={() => setScope(key)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: on ? C.sky100 : 'transparent',
                color: on ? C.deep : C.body,
                border: 0, borderRadius: 8, padding: '9px 16px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}>
                {t('mrb.scope.' + key)}
                {counts[key] != null && (
                  <span style={{
                    background: on ? '#fff' : C.line, color: on ? C.deep : C.body,
                    borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{counts[key]}</span>
                )}
              </button>
            );
          })}
        </div>}
        <div style={{ fontSize: 13, color: C.body }}>
          {guest ? t('mrb.guest.browseHint') : t('mrb.scope.' + scope + 'Hint')}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
        {/* ---------------------------------------------- filter panel */}
        <aside style={{
          flex: '0 1 260px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 20,
          background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, border: '1px solid ' + C.line,
            borderRadius: 10, padding: '8px 12px', background: C.wash,
          }}>
            <span style={{ color: C.dim }}>⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('mrb.searchPlaceholder')}
              style={{
                flex: 1, minWidth: 0, border: 0, background: 'transparent',
                outline: 'none', fontSize: 14, color: C.ink, fontFamily: 'inherit',
              }}
            />
          </div>

          {!guest && <button
            onClick={() => setAvailable(!available)}
            role="switch" aria-checked={available}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, background: C.tint,
              border: '1px solid ' + C.sky200, borderRadius: 12, padding: 12,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.deep }}>
                {t('mrb.availableHere')}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: C.body, marginTop: 2 }}>
                {t('mrb.availableHereAt', { branch: branchShort || '—', n: availCount })}
              </span>
            </span>
            <span style={{
              width: 40, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: available ? C.brand : C.line2, transition: 'background .2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: available ? 18 : 2, width: 20, height: 20,
                borderRadius: '50%', background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(15,23,42,0.3)',
              }} />
            </span>
          </button>}

          <FilterGroup label={t('mrb.filter.cefr')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CEFR_LEVELS.map((lv) => (
                <Chip key={lv} on={cefr.includes(lv)} onClick={() => toggle(cefr, setCefr, lv)}>{lv}</Chip>
              ))}
            </div>
          </FilterGroup>

          {/* Genre rows sit tighter than the other groups: 4px, per the source. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <GroupLabel style={{ marginBottom: 4 }}>{t('mrb.filter.genre')}</GroupLabel>
            {genreFacets.length === 0 && (
              <div style={{ fontSize: 13, color: C.mute }}>{t('mrb.cat.noGenres')}</div>
            )}
            {genreFacets.map(([name, n]) => {
              const [dot] = genreColors(name);
              const on = genres.includes(name);
              return (
                <button key={name} onClick={() => toggle(genres, setGenres, name)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0,
                  borderRadius: 8, padding: '6px 4px', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, color: C.slate, fontFamily: 'inherit',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5,
                    background: on ? C.brand : '#fff',
                    border: '1.5px solid ' + (on ? C.brand : C.line2),
                    color: '#fff', fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{on ? '✓' : ''}</span>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: dot, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{name}</span>
                  <span style={{ fontSize: 12, color: C.mute }}>{n}</span>
                </button>
              );
            })}
          </div>

          <FilterGroup label={t('mrb.filter.language')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LANGS.map(([code, label]) => (
                <Chip key={code} on={langs.includes(code)} onClick={() => toggle(langs, setLangs, code)}>
                  {label}
                </Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label={t('mrb.filter.length')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LENGTHS.map(([key, lk]) => (
                <Chip key={key} on={len === key} onClick={() => setLen(len === key ? '' : key)}>
                  {t(lk)}
                </Chip>
              ))}
            </div>
          </FilterGroup>
        </aside>

        {/* -------------------------------------------------- results */}
        <div style={{ flex: '999 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 36,
          }}>
            {activeFilters.map((af, i) => (
              <button key={i} onClick={af.onRemove} style={{
                display: 'flex', alignItems: 'center', gap: 6, background: C.sky100, color: C.deep,
                border: 0, borderRadius: 999, padding: '5px 10px 5px 12px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{af.label}<span style={{ fontSize: 11 }}>✕</span></button>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={clearFilters} style={{
                background: 'none', border: 0, padding: '5px 8px', fontSize: 13, fontWeight: 600,
                color: C.body, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
              }}>{t('mrb.clearAll')}</button>
            )}
            <span style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.body }}>
              {t('mrb.sortBy')}
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{
                border: '1px solid ' + C.line, borderRadius: 8, padding: '7px 10px',
                fontSize: 13, fontWeight: 600, color: C.ink, background: '#fff',
                fontFamily: 'inherit', cursor: 'pointer',
              }}>
                {SORTS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </label>
          </div>

          {error && (
            <div style={{
              border: '1px dashed ' + C.line2, background: '#fff', borderRadius: 16,
              padding: 40, textAlign: 'center', fontSize: 14, color: C.body,
            }}>{error}</div>
          )}

          {!error && items.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '28px 22px',
            }}>
              {items.map((b) => (
                <BookCard key={b.edition_id} book={b} t={t} reload={load} say={say}
                  onOpen={() => nav(bookPath(b.edition_id))} guest={guest} />
              ))}
            </div>
          )}

          {!error && !loading && items.length === 0 && (
            <div style={{
              border: '1px dashed ' + C.sky200, background: C.tint, borderRadius: 16, padding: 40,
              textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
            }}>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.deep }}>
                {t('mrb.noResults')}
              </div>
              <div style={{ fontSize: 14, color: C.body }}>{t('mrb.noResultsHint')}</div>
              <button onClick={clearFilters} style={{
                background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '9px 16px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.clearAllFilters')}</button>
            </div>
          )}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

/* --------------------------------------------------------- filter panel */

function GroupLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: C.dim, ...style,
    }}>{children}</div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GroupLabel>{label}</GroupLabel>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: on ? C.deep : '#fff',
      color: on ? '#fff' : C.body,
      border: '1px solid ' + (on ? C.deep : C.line),
      borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

/* ----------------------------------------------------------------- card */

// A card shows two actions at most:
//
//   * "Add to shelf" always — a reader can want a book the library has never
//     heard of, and get hold of it themselves.
//   * "Request loan" only when their own library has a copy free right now.
//
// When the reader already has something going on with the book — it is in
// their bag, or the desk is holding it for them — the second slot says so
// instead of offering a reserve button that the backend would only reject.
// The prototype draws a single action button; these two are the same shape.
function BookCard({ book, onOpen, say, t, reload, guest }) {
  const [busy, setBusy] = useState(false);
  const [lift, setLift] = useState(false);
  const canBorrow = book.held_here && book.available_copies > 0 && !book.my_status;
  // "On my shelf" means the reader has the book — their own copy. Wanting to
  // read it is a different list, and starring it is different again.
  const onShelf = book.shelf_status === 'OWNED';

  const [coverBg, coverFg] = coverColors(book.title);
  const [cefrBg, cefrFg] = cefrColors(book.cefr);
  const [gDot, , gFg] = genreColors(book.genre);
  const starW = ((Math.max(0, Math.min(5, Number(book.rating) || 0)) / 5) * 100) + '%';

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

  // Availability as a coloured line, not a pill: sky when a copy is free here,
  // coral when every copy is out, slate when this library does not hold it.
  //
  // A guest has no library, so "not held here" would be false as well as
  // unhelpful — they are told how many school libraries carry it instead.
  let availFg = C.dim, availDot = C.mute, availLabel = t('mrb.notHeld');
  if (guest) {
    const n = (book.other_branches || 0) + (book.held_here ? 1 : 0);
    availFg = n > 0 ? C.deep : C.dim;
    availDot = n > 0 ? C.brand : C.mute;
    availLabel = n > 0 ? t('mrb.guest.heldAt', { n }) : t('mrb.guest.notStocked');
  } else if (book.held_here && book.available_copies > 0) {
    availFg = C.deep; availDot = C.brand;
    availLabel = t('mrb.availableN', { n: book.available_copies, total: book.copies });
  } else if (book.held_here) {
    availFg = C.coralFg; availDot = '#F2545B';
    availLabel = t('mrb.allOnLoan');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <button
        onClick={onOpen}
        onMouseEnter={() => setLift(true)} onMouseLeave={() => setLift(false)}
        style={{ position: 'relative', border: 0, padding: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        {book.cover_url ? (
          <img src={assetUrl(book.cover_url)} alt={book.title} style={{
            width: '100%', aspectRatio: '2/3', borderRadius: 8, objectFit: 'cover', display: 'block',
            boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
            transform: lift ? 'translateY(-3px)' : 'none', transition: 'transform .15s',
          }} />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '2/3', background: coverBg, color: coverFg,
            borderRadius: 8, padding: '16px 14px', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
            transform: lift ? 'translateY(-3px)' : 'none', transition: 'transform .15s',
          }}>
            <div style={{
              fontFamily: SERIF, fontWeight: 700, fontSize: 19, lineHeight: 1.1,
              textWrap: 'balance', paddingRight: 28, overflow: 'hidden',
            }}>{book.title}</div>
            <div style={{
              fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85,
            }}>{book.author}</div>
          </div>
        )}

        {book.cefr && (
          <span style={{
            position: 'absolute', top: 10, right: 10, background: cefrBg, color: cefrFg,
            fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.2)',
          }}>{book.cefr}</span>
        )}

        {/* The status tag the design puts on a shelved book's cover. */}
        {book.shelf_status && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10, background: 'rgba(15,23,42,0.72)',
            color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 9px',
          }}>{t('mrb.shelfState.' + book.shelf_status)}</span>
        )}

        {/* Favourite is an independent flag, so it gets its own control. */}
        {!guest && <span
          role="button" tabIndex={0}
          onClick={toggleFavorite}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleFavorite(e); }}
          title={book.is_favorite ? t('mrb.cat.unfavorite') : t('mrb.cat.favorite')}
          aria-label={book.is_favorite ? t('mrb.cat.unfavorite') : t('mrb.cat.favorite')}
          style={{
            position: 'absolute', top: 10, left: 10, width: 28, height: 28, borderRadius: '50%',
            cursor: 'pointer', lineHeight: 1, fontSize: 15,
            background: book.is_favorite ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.42)',
            color: book.is_favorite ? '#F59E0B' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(15,23,42,0.2)',
          }}
        >{book.is_favorite ? '★' : '☆'}</span>}
      </button>

      <button onClick={onOpen} style={{
        background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer',
        fontFamily: 'inherit',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{book.title}</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
          {book.author || '—'}{book.pages ? ` · ${book.pages} ${t('mrb.pagesShort')}` : ''}
        </div>
      </button>

      {book.genre && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: gFg,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: gDot, flexShrink: 0 }} />
          {book.genre}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.body }}>
        {book.rating == null ? (
          <span style={{ color: C.mute }}>{t('mrb.noRatingsTitle')}</span>
        ) : (
          <>
            <span style={{
              position: 'relative', display: 'inline-block', fontSize: 13, lineHeight: 1,
              letterSpacing: '1px', color: C.line2,
            }}>
              ★★★★★
              <span style={{
                position: 'absolute', left: 0, top: 0, overflow: 'hidden', whiteSpace: 'nowrap',
                color: C.brand, width: starW,
              }}>★★★★★</span>
            </span>
            <strong style={{ color: C.ink }}>{Number(book.rating).toFixed(1)}</strong>
            {book.ratings_count ? <span style={{ color: C.mute }}>· {book.ratings_count}</span> : null}
          </>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: availFg,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: availDot, flexShrink: 0 }} />
        {availLabel}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {guest ? (
          <CardButton onClick={onOpen} bg={C.brand} fg="#fff" border={C.brand}>
            {t('mrb.guest.signInToBorrow')}
          </CardButton>
        ) : (<>
        <CardButton
          onClick={toggleShelf} disabled={busy}
          bg={onShelf ? C.sky100 : '#fff'} fg={onShelf ? C.deep : C.slate}
          border={onShelf ? C.sky100 : C.line}
        >{onShelf ? t('mrb.cat.onShelf') : t('mrb.cat.addToShelf')}</CardButton>

        <MyStatusAction book={book} canBorrow={canBorrow} busy={busy} onRequest={requestLoan} t={t} />
        </>)}
      </div>
    </div>
  );
}

function CardButton({ bg, fg, border, children, ...rest }) {
  return (
    <button {...rest} style={{
      background: bg, color: fg, border: '1px solid ' + border, borderRadius: 8,
      padding: '7px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
      cursor: rest.disabled ? 'not-allowed' : 'pointer', opacity: rest.disabled ? 0.55 : 1,
    }}>{children}</button>
  );
}

// The second slot: either an offer to borrow, or a statement of where the
// reader already stands with this book. Never a button that cannot work.
function MyStatusAction({ book, canBorrow, busy, onRequest, t }) {
  const note = (bg, fg, text) => (
    <div style={{
      background: bg, color: fg, borderRadius: 8, padding: '7px 10px', fontSize: 12.5,
      fontWeight: 600, textAlign: 'center', lineHeight: 1.4,
    }}>{text}</div>
  );

  if (book.my_status === 'ON_LOAN') {
    return note(C.okBg, C.okFg, book.my_due_date
      ? t('mrb.cat.youHaveItDue', { date: fmtDate(book.my_due_date) })
      : t('mrb.cat.youHaveIt'));
  }
  if (book.my_status === 'RESERVED_READY') {
    return note(C.sky100, C.deep, book.my_pickup_deadline
      ? t('mrb.cat.readyBy', { date: fmtDate(book.my_pickup_deadline) })
      : t('mrb.cat.ready'));
  }
  if (book.my_status === 'RESERVED_PENDING') {
    return note('#F1F5F9', C.body, t('mrb.cat.requested'));
  }
  if (canBorrow) {
    return (
      <CardButton onClick={onRequest} disabled={busy} bg={C.brand} fg="#fff" border={C.brand}>
        {t('mrb.cat.requestLoan')}
      </CardButton>
    );
  }
  // Not held here, or every copy is out. The reader can still shelve it.
  return null;
}
