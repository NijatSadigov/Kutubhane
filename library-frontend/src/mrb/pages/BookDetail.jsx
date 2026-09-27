// Book Detail — screen 3 of the handoff.
//
// Breadcrumb · left column (large cover, availability pill, other-branch note,
// specs table) · right column (CEFR + genre chips, serif title, action bar,
// rating card, review composer, review feed).
//
// The rating card, composer and feed are part of the social layer, which has
// no backend yet. They are rendered in their designed form but disabled, with
// the reason stated, rather than faked with mock data.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, font } from '../theme';
import {
  BookCover, CefrBadge, GenreChip, AvailabilityPill, Button, Card, Toast,
} from '../components/primitives';
import Reviews from '../components/Reviews';

function StatusChip({ tone, children }) {
  const tones = {
    ok: ['#DCFCE7', '#166534'],
    ready: [brand.tint100, brand.deep],
    wait: [slate.surface, slate.body],
  };
  const [bg, fg] = tones[tone] || tones.wait;
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 999, padding: '9px 15px',
      fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

export default function BookDetail() {
  const { editionId } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [reserved, setReserved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  // Re-fetch so the action bar reflects the new state rather than guessing.
  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try {
        // Browse carries availability and the local holding; the edition
        // endpoint alone does not.
        const res = await api.get('/catalog/browse', { params: { scope: 'global' } });
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
  }, [editionId, t, reloadKey]);

  const reserve = async () => {
    if (!book?.book_id) { say(t('mrb.requestSent')); return; }
    setBusy(true);
    try {
      await api.post('/reservation', { book_id: book.book_id });
      setReserved(true);
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

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: slate.muted }}>{t('common.loading')}</div>;
  if (error) return <div style={{ padding: 60, textAlign: 'center', color: slate.body }}>{error}</div>;
  if (!book) return null;


  return (
    <>
      {/* breadcrumb */}
      <nav style={{ fontSize: 12, color: slate.dim, marginBottom: 18, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/app/catalogue')} style={{
          background: 'none', border: 0, padding: 0, cursor: 'pointer',
          color: brand.deep, fontWeight: 600, fontSize: 12, fontFamily: font.ui,
        }}>{t('mrb.nav.catalogue')}</button>
        {book.genre && <><span>/</span><span>{book.genre}</span></>}
        <span>/</span><span style={{ color: slate.strong }}>{book.title}</span>
      </nav>

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ------------------------------------------------- left column */}
        <div style={{ flex: '0 1 320px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <BookCover
            title={book.title} author={book.author}
            src={book.cover_url ? assetUrl(book.cover_url) : ''}
            radiusPx={12} fontScale={1.7}
          />

          <AvailabilityPill
            heldHere={book.held_here} availableCopies={book.available_copies}
            copies={book.copies} t={t}
          />

          {book.other_branches > 0 && (
            <div style={{ fontSize: 12, color: slate.dim, marginTop: -8 }}>
              {t('mrb.alsoAtBranches', { n: book.other_branches })}
            </div>
          )}

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {[
                  [t('th.author'), book.author],
                  ['ISBN', book.isbn],
                  [t('mrb.spec.pages'), book.pages || null],
                  ['CEFR', book.cefr],
                  [t('mrb.spec.genre'), book.genre],
                  [t('th.publisher'), book.publisher],
                  [t('mrb.spec.published'), book.year || null],
                  [t('mrb.spec.language'), book.language],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: '1px solid ' + slate.border }}>
                    <td style={{ padding: '10px 14px', color: slate.dim, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
                    <td style={{ padding: '10px 14px', color: slate.text, fontWeight: 600 }}>{value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* ------------------------------------------------ right column */}
        <div style={{ flex: '999 1 520px', minWidth: 300 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <CefrBadge level={book.cefr} size={12} />
            <GenreChip genre={book.genre} />
          </div>

          <h1 style={{
            fontFamily: font.display, fontSize: 52, fontWeight: 700, lineHeight: 1.08,
            margin: '0 0 10px', letterSpacing: '-0.025em',
          }}>{book.title}</h1>

          <div style={{ fontSize: 16, color: slate.body, marginBottom: 26 }}>
            {book.author || '—'}{book.year ? ` · ${book.year}` : ''}
          </div>

          {/* Action bar. Same rule as the catalogue: shelf always, borrow only
              when a copy is genuinely free and the reader is not already
              holding this book. */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32, alignItems: 'center' }}>
            <Button
              kind={book.shelf_status === 'OWNED' ? 'soft' : 'secondary'}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/shelf', {
                    work_id: book.work_id, edition_id: book.edition_id,
                    status: book.shelf_status === 'OWNED' ? '' : 'OWNED',
                  });
                  say(book.shelf_status === 'OWNED' ? t('mrb.shelf.removed') : t('mrb.addedToShelf'));
                  refresh();
                } catch { say(t('msg.opFailed')); }
                finally { setBusy(false); }
              }}
            >{book.shelf_status === 'OWNED' ? t('mrb.cat.onShelf') : t('mrb.cat.addToShelf')}</Button>

            <Button
              kind={book.is_favorite ? 'soft' : 'secondary'}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/shelf', {
                    work_id: book.work_id, edition_id: book.edition_id, favorite: !book.is_favorite,
                  });
                  say(book.is_favorite ? t('mrb.cat.unfavorited') : t('mrb.cat.favorited'));
                  refresh();
                } catch { say(t('msg.opFailed')); }
                finally { setBusy(false); }
              }}
            >{book.is_favorite ? '★ ' + t('mrb.cat.favorited2') : '☆ ' + t('mrb.cat.favorite')}</Button>

            <Button
              kind="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/shelf', {
                    work_id: book.work_id, edition_id: book.edition_id,
                    status: book.shelf_status === 'WANT' ? '' : 'WANT',
                  });
                  say(book.shelf_status === 'WANT' ? t('mrb.shelf.removed') : t('mrb.addedToWant'));
                  refresh();
                } catch { say(t('msg.opFailed')); }
                finally { setBusy(false); }
              }}
            >{book.shelf_status === 'WANT' ? t('mrb.cat.onWantList') : t('mrb.wantToRead')}</Button>

            <Button
              kind="secondary"
              onClick={() => {
                const el = document.getElementById('composer');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.querySelector('textarea')?.focus();
              }}
            >{t('mrb.writeReview')}</Button>

            {book.my_status === 'ON_LOAN' ? (
              <StatusChip tone="ok">
                {book.my_due_date
                  ? t('mrb.cat.youHaveItDue', { date: new Date(book.my_due_date).toLocaleDateString() })
                  : t('mrb.cat.youHaveIt')}
              </StatusChip>
            ) : book.my_status === 'RESERVED_READY' ? (
              <StatusChip tone="ready">
                {book.my_pickup_deadline
                  ? t('mrb.cat.readyBy', { date: new Date(book.my_pickup_deadline).toLocaleDateString() })
                  : t('mrb.cat.ready')}
              </StatusChip>
            ) : book.my_status === 'RESERVED_PENDING' ? (
              <StatusChip tone="wait">{t('mrb.cat.requested')}</StatusChip>
            ) : book.held_here && book.available_copies > 0 ? (
              <Button disabled={busy || reserved} onClick={reserve}>
                {reserved ? t('mrb.cat.loanRequested') : t('mrb.cat.requestLoan')}
              </Button>
            ) : null}
          </div>

          <Reviews workId={book.work_id} editionId={book.edition_id} />
        </div>
      </div>

      <Toast message={toast} />
    </>
  );
}
