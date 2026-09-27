// Book Detail — screen "03 Book Detail" of the handoff.
//
// Transcribed from the prototype's `isBook` block: a 13px breadcrumb, then a
// 40px two-column split — a 320px aside carrying the 10px-radius cover with
// its 34px serif title and deep drop shadow, the availability pill, and the
// 14px-radius specs table whose rows are a 100px/1fr grid at 10px 16px — and a
// 480px main column at 28px rhythm with the CEFR and genre pills, the 52px
// serif title, the byline, the Source Serif synopsis, the 11px/18px action
// bar, and then the rating card, composer and review feed.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { coverColors, genreColors, cefrColors } from '../theme';
import { Toast } from '../components/primitives';
import Reviews from '../components/Reviews';
import { useReaderApi } from '../guest';

const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F8FAFC', surface: '#F1F5F9',
  tint: '#F0F9FF', sky100: '#E0F2FE', sky200: '#BAE6FD',
  deep: '#075985', brand: '#1B9DD9',
  coralBg: '#FFF1EE', coralBorder: '#FFD6CF', coralFg: '#B4232A', coral: '#F2545B',
  okBg: '#DCFCE7', okFg: '#166534',
};
const SERIF = "'Source Serif 4', Georgia, serif";

export default function BookDetail() {
  const { editionId } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { guest, http, browse, cataloguePath } = useReaderApi();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  // Re-fetch so the action bar reflects the new state rather than guessing.
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try {
        // Browse carries availability and the local holding; the edition
        // endpoint alone does not.
        const res = await http.get(browse, { params: { scope: 'global' } });
        const found = (res.data.items || []).find((b) => String(b.edition_id) === String(editionId));
        if (!alive) return;
        if (!found) { setError(t('mrb.bookNotFound')); return; }
        setBook(found);
      } catch {
        if (alive) setError(t('msg.opFailed'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [editionId, t, reloadKey, http, browse]);

  const shelf = useCallback(async (patch, message) => {
    setBusy(true);
    try {
      await api.post('/shelf', { work_id: book.work_id, edition_id: book.edition_id, ...patch });
      say(message);
      refresh();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  }, [book, refresh, t]);

  const reserve = async () => {
    if (!book?.book_id) return;
    setBusy(true);
    try {
      await api.post('/reservation', { book_id: book.book_id });
      say(t('mrb.cat.loanRequested'));
      refresh();
    } catch (err) {
      const code = err.response?.data?.code;
      say(code === 'LIMIT' ? t('mrb.err.limit')
        : code === 'DUPLICATE' ? t('mrb.err.duplicate')
        : code === 'NO_COPY' ? t('mrb.err.noCopy')
        : t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.mute }}>{t('common.loading')}</div>;
  if (error) return <div style={{ padding: 60, textAlign: 'center', color: C.body }}>{error}</div>;
  if (!book) return null;

  const [coverBg, coverFg] = coverColors(book.title);
  const [cefrBg, cefrFg] = cefrColors(book.cefr);
  const [gDot, gBg, gFg] = genreColors(book.genre);
  const onShelf = book.shelf_status === 'OWNED';
  const onWantList = book.shelf_status === 'WANT';

  // Availability, stated once and reused by the pill.
  let av = { bg: C.surface, fg: C.body, border: C.line, dot: C.mute, label: t('mrb.notHeld') };
  if (book.held_here && book.available_copies > 0) {
    av = {
      bg: C.sky100, fg: C.deep, border: C.sky200, dot: C.brand,
      label: t('mrb.availableN', { n: book.available_copies, total: book.copies }),
    };
  } else if (book.held_here) {
    av = { bg: C.coralBg, fg: C.coralFg, border: C.coralBorder, dot: C.coral, label: t('mrb.allOnLoan') };
  }

  const specs = [
    [t('th.author'), book.author],
    ['ISBN', book.isbn],
    [t('mrb.spec.pages'), book.pages || null],
    ['CEFR', book.cefr],
    [t('mrb.spec.genre'), book.genre],
    [t('th.publisher'), book.publisher],
    [t('mrb.spec.published'), book.year || null],
    [t('mrb.spec.language'), book.language],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ----------------------------------------------------- breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, fontSize: 13, color: C.dim, flexWrap: 'wrap' }}>
        <button onClick={() => nav(cataloguePath)} style={{
          background: 'none', border: 0, padding: 0, color: C.deep, fontSize: 13,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{t('mrb.nav.catalogue')}</button>
        {book.genre && <><span>/</span><span>{book.genre}</span></>}
        <span>/</span>
        <span style={{ color: C.ink, fontWeight: 600 }}>{book.title}</span>
      </nav>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' }}>
        {/* ------------------------------------------------------- aside */}
        <aside style={{
          display: 'flex', flexDirection: 'column', gap: 18, flex: '0 1 320px', minWidth: 260,
        }}>
          {book.cover_url ? (
            <img src={assetUrl(book.cover_url)} alt={book.title} style={{
              width: '100%', aspectRatio: '2/3', borderRadius: 10, objectFit: 'cover', display: 'block',
              boxShadow: 'inset 6px 0 0 rgba(255,255,255,0.14), 0 20px 40px rgba(15,23,42,0.22)',
            }} />
          ) : (
            <div style={{
              width: '100%', aspectRatio: '2/3', background: coverBg, color: coverFg,
              borderRadius: 10, padding: '28px 24px', display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'inset 6px 0 0 rgba(255,255,255,0.14), 0 20px 40px rgba(15,23,42,0.22)',
            }}>
              <div style={{
                fontFamily: SERIF, fontWeight: 700, fontSize: 34, lineHeight: 1.05, textWrap: 'balance',
              }}>{book.title}</div>
              <div style={{
                fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85,
              }}>{book.author}</div>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, background: av.bg, color: av.fg,
            border: '1px solid ' + av.border, borderRadius: 999, padding: '8px 14px',
            fontSize: 13, fontWeight: 700, alignSelf: 'flex-start',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: av.dot, flexShrink: 0 }} />
            {av.label}
          </div>

          {book.other_branches > 0 && (
            <div style={{ fontSize: 12, color: C.dim, marginTop: -8 }}>
              {t('mrb.alsoAtBranches', { n: book.other_branches })}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 14, overflow: 'hidden' }}>
            {specs.map(([k, v]) => (
              <div key={k} style={{
                display: 'grid', gridTemplateColumns: '100px minmax(0,1fr)', gap: 12,
                padding: '10px 16px', borderBottom: '1px solid ' + C.surface, fontSize: 13,
              }}>
                <span style={{ color: C.dim }}>{k}</span>
                <span style={{ color: C.ink, fontWeight: 600, wordBreak: 'break-word' }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ------------------------------------------------- main column */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0, flex: '999 1 480px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {book.cefr && (
                <span style={{
                  background: cefrBg, color: cefrFg, borderRadius: 999, padding: '4px 12px',
                  fontSize: 12, fontWeight: 700,
                }}>CEFR {book.cefr}</span>
              )}
              {book.genre && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: gBg, color: gFg,
                  borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: gDot }} />
                  {book.genre}
                </span>
              )}
            </div>

            <h1 className="mrb-h-book" style={{
              margin: 0, fontFamily: SERIF, fontSize: 52, fontWeight: 700, lineHeight: 1.05,
              letterSpacing: '-0.02em', textWrap: 'balance',
            }}>{book.title}</h1>

            <div style={{ fontSize: 16, color: C.body }}>
              {t('mrb.byAuthor')} <strong style={{ color: C.ink }}>{book.author || '—'}</strong>
              {book.year ? ` · ${book.year}` : ''}
            </div>

            {/* The design sets a synopsis here. Nothing writes one yet, so the
                paragraph is omitted rather than filled with invented copy. */}
            {book.synopsis && (
              <p style={{
                margin: '6px 0 0', fontFamily: SERIF, fontSize: 18, lineHeight: 1.65,
                color: C.slate, maxWidth: 720, textWrap: 'pretty',
              }}>{book.synopsis}</p>
            )}
          </div>

          {/* ----------------------------------------------- action bar */}
          {guest ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              background: C.tint, border: '1px solid ' + C.sky200, borderRadius: 18, padding: 22,
            }}>
              <div style={{ flex: '1 1 280px' }}>
                <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.deep }}>
                  {t('mrb.guest.joinTitle')}
                </div>
                <div style={{ fontSize: 14, color: C.body, marginTop: 4 }}>
                  {t('mrb.guest.joinBody')}
                </div>
              </div>
              <Action bg={C.brand} fg="#fff" border={C.brand} onClick={() => nav('/register')}>
                {t('mrb.land.joinWithCode')}
              </Action>
              <Action bg="#fff" fg={C.deep} border={C.sky200} onClick={() => nav('/login')}>
                {t('mrb.land.login')}
              </Action>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* The diary is written against a loan, so this appears when the
                  reader actually has the library's copy. */}
              {book.my_loan_id && (
                <Action
                  bg={C.brand} fg="#fff" border={C.brand}
                  onClick={() => setDiaryOpen((v) => !v)}
                >{t('mrb.logReading')}</Action>
              )}

              <Action
                bg="#fff" fg={C.deep} border={C.sky200}
                onClick={() => {
                  const el = document.getElementById('composer');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el?.querySelector('textarea')?.focus();
                }}
              >{t('mrb.writeReview')}</Action>

              <LoanAction book={book} busy={busy} onReserve={reserve} t={t} />

              <Action
                bg={onShelf ? C.sky100 : '#fff'} fg={onShelf ? C.deep : C.slate}
                border={onShelf ? C.sky100 : C.line} disabled={busy}
                onClick={() => shelf(
                  { status: onShelf ? '' : 'OWNED' },
                  onShelf ? t('mrb.shelf.removed') : t('mrb.addedToShelf'),
                )}
              >{onShelf ? t('mrb.cat.onShelf') : t('mrb.cat.addToShelf')}</Action>

              <Action
                bg={onWantList ? C.sky100 : '#fff'} fg={onWantList ? C.deep : C.slate}
                border={onWantList ? C.sky100 : C.line} disabled={busy}
                onClick={() => shelf(
                  { status: onWantList ? '' : 'WANT' },
                  onWantList ? t('mrb.shelf.removed') : t('mrb.addedToWant'),
                )}
              >{onWantList ? t('mrb.cat.onWantList') : t('mrb.wantToRead')}</Action>

              <Action
                bg={book.is_favorite ? C.sky100 : '#fff'}
                fg={book.is_favorite ? C.deep : C.slate}
                border={book.is_favorite ? C.sky100 : C.line} disabled={busy}
                onClick={() => shelf(
                  { favorite: !book.is_favorite },
                  book.is_favorite ? t('mrb.cat.unfavorited') : t('mrb.cat.favorited'),
                )}
              >{book.is_favorite ? '★ ' + t('mrb.cat.favorited2') : '☆ ' + t('mrb.cat.favorite')}</Action>
            </div>

            {diaryOpen && book.my_loan_id && (
              <DiaryBox loanId={book.my_loan_id} pages={book.pages} t={t}
                onDone={(m) => { say(m); setDiaryOpen(false); }} />
            )}
          </div>
          )}

          <Reviews workId={book.work_id} editionId={book.edition_id} />
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

function Action({ bg, fg, border, children, ...rest }) {
  return (
    <button {...rest} style={{
      background: bg, color: fg, border: '1px solid ' + border, borderRadius: 10,
      padding: '11px 18px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
      cursor: rest.disabled ? 'not-allowed' : 'pointer', opacity: rest.disabled ? 0.55 : 1,
    }}>{children}</button>
  );
}

// The borrow slot: an offer, or a statement of where the reader already stands.
// Same rule as the catalogue card, so the two screens cannot disagree.
function LoanAction({ book, busy, onReserve, t }) {
  const note = (bg, fg, border, text) => (
    <span style={{
      display: 'flex', alignItems: 'center', background: bg, color: fg,
      border: '1px solid ' + border, borderRadius: 10, padding: '11px 18px',
      fontSize: 14, fontWeight: 700,
    }}>{text}</span>
  );

  if (book.my_status === 'ON_LOAN') {
    return note(C.okBg, C.okFg, C.okBg, book.my_due_date
      ? t('mrb.cat.youHaveItDue', { date: fmtDate(book.my_due_date) })
      : t('mrb.cat.youHaveIt'));
  }
  if (book.my_status === 'RESERVED_READY') {
    return note(C.sky100, C.deep, C.sky200, book.my_pickup_deadline
      ? t('mrb.cat.readyBy', { date: fmtDate(book.my_pickup_deadline) })
      : t('mrb.cat.ready'));
  }
  if (book.my_status === 'RESERVED_PENDING') {
    return note(C.surface, C.body, C.line, t('mrb.cat.requested'));
  }
  if (book.held_here && book.available_copies > 0) {
    return (
      <Action bg={C.brand} fg="#fff" border={C.brand} disabled={busy} onClick={onReserve}>
        {t('mrb.cat.requestLoan')}
      </Action>
    );
  }
  return null;
}

// Logging a page count against the open loan — the design's diary button.
function DiaryBox({ loanId, pages, t, onDone }) {
  const [page, setPage] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/reading-log', { loan_id: loanId, page: Number(page) || 0, note });
      onDone(t('mrb.diarySaved'));
    } catch { onDone(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      background: C.tint, border: '1px solid ' + C.sky200, borderRadius: 12, padding: 16,
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.slate }}>
        {t('mrb.pageReached')}
        <input
          type="number" min={0} max={pages || undefined} value={page}
          onChange={(e) => setPage(e.target.value)}
          style={{
            width: 90, border: '1px solid ' + C.line, borderRadius: 10, padding: '8px 12px',
            fontSize: 14, outline: 'none', fontFamily: 'inherit',
          }}
        />
      </label>
      {pages ? <span style={{ fontSize: 13, color: C.dim }}>/ {pages}</span> : null}
      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={t('mrb.diaryNotePlaceholder')}
        style={{
          flex: 1, minWidth: 160, border: '1px solid ' + C.line, borderRadius: 10,
          padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button onClick={submit} disabled={busy || page === ''} style={{
        background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '9px 16px',
        fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        cursor: busy || page === '' ? 'not-allowed' : 'pointer', opacity: busy || page === '' ? 0.55 : 1,
      }}>{t('common.save')}</button>
    </div>
  );
}
