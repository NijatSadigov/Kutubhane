// My Shelf — screen 5 of the handoff.
//
// Profile banner with pinned badges, the stats row, the badge grid, and tabs
// for Currently Reading (with inline page logging), Diary & History, Want to
// Read and My Notes.

import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, warning, radius, shadow, font } from '../theme';
import { BookCover, Button, Card, Toast } from '../components/primitives';
import { ReservationsTab, RequestsTab } from '../components/BookingTabs';

const SHAPES = {
  circle: 'circle(50% at 50% 50%)',
  hex: 'polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)',
  shield: 'polygon(50% 0,100% 14%,100% 58%,50% 100%,0 58%,0 14%)',
  octa: 'polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)',
  squircle: 'inset(0 round 26%)',
};

export default function MyShelf() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const nav = useNavigate();

  const [tab, setTab] = useState('reading');
  const [summary, setSummary] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loans, setLoans] = useState([]);
  const [diary, setDiary] = useState([]);
  const [want, setWant] = useState([]);
  const [owned, setOwned] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);

  // Bumping this refetches everything — used after logging pages, pinning a
  // badge or deleting a note.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    (async () => {
      const [s, b, l, d, w, n, ow, fv, rv, rq] = await Promise.allSettled([
        api.get('/shelf/summary'),
        api.get('/shelf/badges'),
        api.get(`/my-library/${user.id}`),
        api.get(`/student/${user.id}/reading`),
        api.get('/shelf', { params: { status: 'WANT' } }),
        api.get('/notes'),
        api.get('/shelf', { params: { status: 'OWNED' } }),
        api.get('/shelf', { params: { favorite: 'true' } }),
      ].concat([
        api.get('/my-reservations'),
        api.get('/book-requests/mine'),
      ]));
      if (!alive) return;
      if (s.status === 'fulfilled') setSummary(s.value.data);
      if (b.status === 'fulfilled') setBadges(b.value.data || []);
      if (l.status === 'fulfilled') setLoans(l.value.data || []);
      if (d.status === 'fulfilled') setDiary(d.value.data?.logs || []);
      if (w.status === 'fulfilled') setWant(w.value.data || []);
      if (n.status === 'fulfilled') setNotes(n.value.data || []);
      if (rv.status === 'fulfilled') setReservations(rv.value.data || []);
      if (rq.status === 'fulfilled') setRequests(rq.value.data || []);
      if (ow.status === 'fulfilled') setOwned(ow.value.data || []);
      if (fv.status === 'fulfilled') setFavorites(fv.value.data || []);
    })();
    return () => { alive = false; };
  }, [user, reloadKey]);

  const name = user?.student?.name || user?.librarian?.name || user?.manager?.name || user?.email || '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const sub = user?.student
    ? [user.student.grade ? `${user.student.grade}${user.student.class_group ? '-' + user.student.class_group : ''}` : '', user.student.branch?.name]
        .filter(Boolean).join(' · ')
    : '';

  const pinned = badges.filter((b) => b.pinned).slice(0, 3);
  const active = loans.filter((l) => !l.return_date);

  const openReservations = reservations.filter(
    (r) => r.status_code === 'PENDING' || r.status_code === 'APPROVED'
  );

  const TABS = [
    ['reading', t('mrb.shelf.reading'), active.length],
    ['reservations', t('mrb.shelf.reservations'), openReservations.length],
    ['owned', t('mrb.shelf.owned'), owned.length],
    ['favorites', t('mrb.shelf.favorites'), favorites.length],
    ['want', t('mrb.shelf.want'), want.length],
    ['diary', t('mrb.shelf.diary'), diary.length],
    ['requests', t('mrb.shelf.requests'), requests.length],
    ['notes', t('mrb.shelf.notes'), notes.length],
  ];

  return (
    <>
      {/* ----------------------------------------------------- banner */}
      <Card style={{ borderRadius: radius.hero, marginBottom: 22 }} padding={28}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <span style={{
            width: 104, height: 104, borderRadius: '50%', background: brand.deep, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, fontWeight: 800, flexShrink: 0,
          }}>{initials || '·'}</span>

          <div style={{ flex: '1 1 320px', minWidth: 240 }}>
            <h1 style={{ fontFamily: font.display, fontSize: 32, fontWeight: 700, margin: '0 0 6px' }}>{name}</h1>
            {sub && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <Pill>{sub}</Pill>
                {summary?.streak_days > 0 && (
                  <span style={{
                    background: danger.tint, color: danger.text, border: '1px solid ' + danger.border,
                    borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 700,
                  }}>🔥 {t('mrb.streak', { n: summary.streak_days })}</span>
                )}
              </div>
            )}
            {pinned.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                {pinned.map((b) => <Medallion key={b.id} badge={b} size={46} />)}
              </div>
            )}
          </div>
        </div>

        {/* stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14, marginTop: 24,
        }}>
          <Stat label={t('mrb.shelf.booksCompleted')} value={summary?.books_completed ?? '—'} />
          <Stat label={t('mrb.shelf.pagesConquered')} value={(summary?.pages_read ?? 0).toLocaleString()} />
          <Stat label={t('mrb.shelf.avgSpeed')} value={summary ? `${summary.pages_per_day} ${t('mrb.shelf.perDay')}` : '—'} />
          <Stat label={t('mrb.shelf.currentStreak')} value={summary ? t('mrb.shelf.nDays', { n: summary.streak_days }) : '—'} />
        </div>
      </Card>

      {/* ----------------------------------------------------- badges */}
      <h2 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, margin: '28px 0 14px' }}>
        {t('mrb.shelf.badges')}
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16,
      }}>
        {badges.map((b) => <BadgeCard key={b.id} badge={b} t={t} onPin={async () => {
          try {
            await api.post(`/shelf/badges/${b.id}/pin`);
            load();
          } catch (err) {
            say(err.response?.data?.code === 'PIN_LIMIT' ? t('mrb.shelf.pinLimit') : t('msg.opFailed'));
          }
        }} />)}
      </div>

      {/* ------------------------------------------------------- tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '34px 0 18px' }}>
        {TABS.map(([key, label, n]) => {
          const on = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: on ? brand.deep : '#fff', color: on ? '#fff' : slate.body,
              border: '1px solid ' + (on ? brand.deep : slate.border),
              borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: font.ui,
            }}>
              {label}
              <span style={{
                background: on ? 'rgba(255,255,255,.22)' : slate.surface,
                borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800,
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      {tab === 'reading' && <CurrentlyReading loans={active} t={t} say={say} reload={load} />}
      {tab === 'reservations' && <ReservationsTab items={reservations} t={t} say={say} reload={load} />}
      {tab === 'requests' && <RequestsTab items={requests} t={t} say={say} reload={load} />}
      {tab === 'diary' && <DiaryHistory logs={diary} t={t} />}
      {tab === 'want' && <ShelfGrid items={want} t={t} nav={nav} say={say} reload={load} empty={t('mrb.shelf.noWant')} />}
      {tab === 'owned' && <ShelfGrid items={owned} t={t} nav={nav} say={say} reload={load} empty={t('mrb.shelf.noOwned')} />}
      {tab === 'favorites' && <ShelfGrid items={favorites} t={t} nav={nav} say={say} reload={load} empty={t('mrb.shelf.noFavorites')} favoritesView />}
      {tab === 'notes' && <NotesTab notes={notes} t={t} say={say} reload={load} />}

      <Toast message={toast} />
    </>
  );
}

/* --------------------------------------------------------------- pieces */

function Pill({ children }) {
  return (
    <span style={{
      background: slate.surface, border: '1px solid ' + slate.border, borderRadius: 999,
      padding: '4px 11px', fontSize: 12, fontWeight: 600, color: slate.strong,
    }}>{children}</span>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: brand.tint50, borderRadius: radius.smallCard, padding: '14px 16px' }}>
      <div style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: brand.deep, lineHeight: 1.1 }}>{value}</div>
      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
        color: slate.dim, marginTop: 5,
      }}>{label}</div>
    </div>
  );
}

function Medallion({ badge, size = 84 }) {
  return (
    <span title={badge.name} style={{
      width: size, height: size, flexShrink: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: badge.ring, clipPath: SHAPES[badge.shape] || SHAPES.circle,
      filter: badge.earned ? 'none' : 'grayscale(1)', opacity: badge.earned ? 1 : 0.5,
    }}>
      <span style={{
        width: size * 0.78, height: size * 0.78, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: badge.fill, color: '#fff',
        clipPath: SHAPES[badge.shape] || SHAPES.circle,
        fontSize: size * 0.34, fontWeight: 800, lineHeight: 1,
      }}>{badge.glyph}</span>
    </span>
  );
}

function BadgeCard({ badge, t, onPin }) {
  const pct = badge.target > 0 ? Math.min(100, (badge.progress / badge.target) * 100) : 0;
  return (
    <div style={{
      background: badge.earned ? badge.tint : '#fff',
      border: '1px solid ' + (badge.earned ? badge.ring : slate.border),
      borderRadius: radius.card, padding: 16, textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <Medallion badge={badge} />
      {badge.tier && (
        <span style={{
          background: badge.earned ? badge.fill : slate.border2, color: '#fff',
          borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 800,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{badge.tier}</span>
      )}
      <div style={{ fontSize: 13, fontWeight: 700, color: badge.earned ? badge.ink : slate.strong }}>
        {tr(t, `mrb.badge.${badge.code}.name`, badge.name)}
      </div>
      <div style={{ fontSize: 11.5, color: slate.dim, lineHeight: 1.45 }}>
        {tr(t, `mrb.badge.${badge.code}.desc`, badge.description)}
      </div>

      {badge.earned ? (
        <>
          <div style={{ fontSize: 11, color: slate.muted }}>
            {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : ''}
          </div>
          <button onClick={onPin} style={{
            background: 'none', border: 0, color: brand.deep, fontSize: 11,
            fontWeight: 700, cursor: 'pointer', fontFamily: font.ui, textDecoration: 'underline',
          }}>{badge.pinned ? t('mrb.shelf.unpin') : t('mrb.shelf.pin')}</button>
        </>
      ) : badge.target > 0 ? (
        <div style={{ width: '100%' }}>
          <div style={{ height: 5, background: slate.surface, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: badge.fill }} />
          </div>
          <div style={{ fontSize: 11, color: slate.muted, marginTop: 5 }}>
            {badge.progress.toLocaleString()} / {badge.target.toLocaleString()}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CurrentlyReading({ loans, t, say, reload }) {
  if (loans.length === 0) return <EmptyCard>{t('mrb.shelf.noLoans')}</EmptyCard>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {loans.map((l) => <LoanCard key={l.id} loan={l} t={t} say={say} reload={reload} />)}
    </div>
  );
}

function LoanCard({ loan, t, say, reload }) {
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);

  const total = loan.page_count || 0;
  const current = loan.current_page || 0;
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  const due = loan.due_date ? new Date(loan.due_date) : null;
  const daysLeft = due ? Math.ceil((due - new Date()) / 86400000) : null;
  const dueStyle = daysLeft == null ? {}
    : daysLeft < 0 ? { background: danger.tint, color: danger.text, border: '1px solid ' + danger.border }
    : daysLeft <= 3 ? { background: warning.tint, color: warning.text, border: '1px solid #FDE68A' }
    : { background: brand.tint100, color: brand.deep, border: '1px solid ' + brand.tint200 };

  const log = async () => {
    const n = parseInt(page, 10);
    if (!n || n < 0) { say(t('mrb.shelf.enterPage')); return; }
    if (total > 0 && n > total) { say(t('mrb.shelf.pageTooHigh', { n: total })); return; }
    setBusy(true);
    try {
      await api.post('/reading-log', { loan_id: loan.id, page: n });
      setPage('');
      say(t('mrb.shelf.logged'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  return (
    <Card padding={18}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 58, flexShrink: 0 }}>
          <BookCover title={loan.book_title} src={loan.cover_url ? assetUrl(loan.cover_url) : ''} radiusPx={5} fontScale={0.5} />
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{loan.book_title}</div>
          <div style={{ fontSize: 12, color: slate.dim, marginBottom: 10 }}>{loan.author || '—'}</div>

          <div style={{ height: 7, background: slate.surface, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: brand.primary }} />
          </div>
          <div style={{ fontSize: 12, color: slate.body, marginTop: 6 }}>
            {total > 0
              ? t('mrb.shelf.progress', { current, total, pct: Math.round(pct) })
              : t('mrb.shelf.pageOnly', { current })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
          {due && (
            <span style={{ ...dueStyle, borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 700 }}>
              {daysLeft < 0 ? t('mrb.shelf.overdue', { n: -daysLeft }) : t('mrb.shelf.dueIn', { n: daysLeft })}
            </span>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={page} onChange={(e) => setPage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') log(); }}
              inputMode="numeric" placeholder={t('mrb.shelf.pagePlaceholder')}
              style={{
                width: 84, border: '1px solid ' + slate.border, borderRadius: 9,
                padding: '8px 10px', fontSize: 13, fontFamily: font.ui, outline: 'none',
              }}
            />
            <Button onClick={log} disabled={busy}>{t('mrb.shelf.logPages')}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DiaryHistory({ logs, t }) {
  if (logs.length === 0) return <EmptyCard>{t('mrb.shelf.noDiary')}</EmptyCard>;

  // Grouped by month, as the design specifies.
  const groups = {};
  logs.forEach((l) => {
    const d = new Date(l.created_at);
    const key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (groups[key] = groups[key] || []).push(l);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Object.entries(groups).map(([month, rows]) => (
        <div key={month}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
            color: slate.muted, marginBottom: 10,
          }}>{month}</div>
          <Card padding={0}>
            {rows.map((l, i) => (
              <div key={l.id} style={{
                display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'baseline',
                borderBottom: i < rows.length - 1 ? '1px solid ' + slate.border : 'none',
              }}>
                <span style={{ fontSize: 12, color: slate.muted, width: 46, flexShrink: 0 }}>
                  {new Date(l.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t('mrb.shelf.reachedPage', { n: l.page })}</span>
                  {l.note && <span style={{ display: 'block', fontSize: 12.5, color: slate.body, marginTop: 3 }}>{l.note}</span>}
                </span>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

// One grid serves "I own this", "want to read" and "favourites" — they differ
// only in what removing means.
function ShelfGrid({ items, t, nav, say, reload, empty, favoritesView }) {
  if (items.length === 0) return <EmptyCard>{empty}</EmptyCard>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 20 }}>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div onClick={() => it.edition_id && nav(`/app/book/${it.edition_id}`)}
            style={{ cursor: it.edition_id ? 'pointer' : 'default', position: 'relative' }}>
            <BookCover title={it.title} author={it.author} src={it.cover_url ? assetUrl(it.cover_url) : ''} />
            {it.favorite && (
              <span style={{
                position: 'absolute', top: 6, left: 6, width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(255,255,255,.94)', color: '#F59E0B', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>★</span>
            )}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{it.title}</div>
          <div style={{ fontSize: 11.5, color: slate.dim, marginTop: -4 }}>{it.author || '—'}</div>
          <Button kind="secondary" style={{ width: '100%' }} onClick={async () => {
            try {
              await api.post('/shelf', favoritesView
                ? { work_id: it.work_id, favorite: false }
                : { work_id: it.work_id, status: '' });
              say(t('mrb.shelf.removed'));
              reload();
            } catch { say(t('msg.opFailed')); }
          }}>{favoritesView ? t('mrb.cat.unfavorite') : t('mrb.shelf.remove')}</Button>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ notes, t, say, reload }) {
  if (notes.length === 0) return <EmptyCard>{t('mrb.shelf.noNotes')}</EmptyCard>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {notes.map((n) => (
        <div key={n.id} style={{
          background: '#FFFDF5', border: '1px solid #FDE68A', borderRadius: radius.card,
          padding: 18, boxShadow: shadow.card,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{n.work?.title || '—'}</div>
            <button onClick={async () => {
              try { await api.delete(`/notes/${n.id}`); say(t('mrb.shelf.noteDeleted')); reload(); }
              catch { say(t('msg.opFailed')); }
            }} style={{
              background: 'none', border: 0, color: danger.text, fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
            }}>{t('common.delete')}</button>
          </div>
          <div style={{ fontSize: 13.5, color: slate.body, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{n.text}</div>
          <div style={{
            fontSize: 11, color: slate.muted, marginTop: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>🔒 {t('mrb.shelf.privateNote')}</div>
        </div>
      ))}
    </div>
  );
}

// Badge names and descriptions are seeded in the database in English. Translate
// them by code where a translation exists, and fall back to the seeded text so
// a badge added later still reads sensibly.
function tr(t, key, fallback) {
  const out = t(key);
  return out === key ? fallback : out;
}

function EmptyCard({ children }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed ' + slate.border2, borderRadius: radius.card,
      padding: 40, textAlign: 'center', fontSize: 14, color: slate.dim, lineHeight: 1.6,
    }}>{children}</div>
  );
}
