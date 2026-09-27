// My Shelf — screen "02 Student Profile" of the handoff.
//
// Transcribed from the prototype's `isProfile` block: the 20px-radius banner
// with its 84px #E0F2FE strip, the 104px avatar riding -44px over it on a 5px
// white ring, the pill row and pinned-badge medallions, and the divided stats
// strip whose cells are 34px serif figures over a 12px #1580B5 note; the badge
// card with an 84px clip-path medallion, its tier chip hung -8px below and a
// 6px progress rail for the locked ones; the 12px-radius tab bar; loan cards
// at 88px cover / 20px gap with a 10px #E0F2FE progress rail; the diary as one
// card of 48/36/1fr/auto/auto rows under sticky month strips; the 150px want
// grid; the note cards; and the sidebar's genre mix and year goal.

import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate, fmtDayMonth, fmtMonthYear, fmtNum } from '../../i18n/dates';
import { coverColors, genreColors } from '../theme';
import { Toast } from '../components/primitives';
import { ProfileDialog } from '../components/AccountMenu';
import { useSchoolLabel } from '../useSchoolLabel';
import { ReservationsTab, RequestsTab } from '../components/BookingTabs';

const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F8FAFC', surface: '#F1F5F9',
  tint: '#F0F9FF', sky100: '#E0F2FE', sky200: '#BAE6FD',
  deep: '#075985', brand: '#1B9DD9', brandHi: '#1580B5',
  coralBg: '#FFF1EE', coralBorder: '#FFD6CF', coralFg: '#B4232A',
  warnBg: '#FEF3C7', warnBorder: '#FDE68A', warnFg: '#92400E',
  noteBg: '#FFFDF5', noteBorder: '#FDE68A',
};
const SERIF = "'Source Serif 4', Georgia, serif";
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)';

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
  const [goal, setGoal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  // The badge grid is long, so it remembers whether this reader keeps it open.
  const [badgesOpen, setBadgesOpen] = useState(
    () => { try { return localStorage.getItem('mrb.badgesOpen') === '1'; } catch { return false; } },
  );

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);
  const school = useSchoolLabel();

  const toggleBadges = useCallback(() => {
    setBadgesOpen((v) => {
      try { localStorage.setItem('mrb.badgesOpen', v ? '0' : '1'); } catch { /* private mode */ }
      return !v;
    });
  }, []);

  // Bumping this refetches everything — used after logging pages, pinning a
  // badge, setting a goal or deleting a note.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    (async () => {
      const [s, b, l, d, w, n, ow, fv, rv, rq, gl] = await Promise.allSettled([
        api.get('/shelf/summary'),
        api.get('/shelf/badges'),
        api.get(`/my-library/${user.id}`),
        api.get(`/student/${user.id}/reading`),
        api.get('/shelf', { params: { status: 'WANT' } }),
        api.get('/notes'),
        api.get('/shelf', { params: { status: 'OWNED' } }),
        api.get('/shelf', { params: { favorite: 'true' } }),
        api.get('/my-reservations'),
        api.get('/book-requests/mine'),
        api.get('/shelf/goal'),
      ]);
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
      if (gl.status === 'fulfilled') setGoal(gl.value.data);
    })();
    return () => { alive = false; };
  }, [user, reloadKey]);

  const name = user?.student?.name || user?.librarian?.name || user?.manager?.name || user?.email || '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // The design shows a handle beside the name. Nothing stores one, so it is
  // the local part of their address — stable, theirs, and not invented.
  const handle = user?.email ? '@' + user.email.split('@')[0] : '';

  const pinned = badges.filter((b) => b.pinned).slice(0, 3);
  const active = loans.filter((l) => !l.return_date);
  const openReservations = reservations.filter(
    (r) => r.status_code === 'PENDING' || r.status_code === 'APPROVED',
  );

  // The prototype's three pills: where they read, their year group, and the
  // level they actually read at. The streak is a statistic below and a pill in
  // the header already — it is not repeated here.
  const pills = [];
  if (school.label) pills.push({ label: school.label, bg: C.sky100, fg: C.deep });
  if (user?.student?.grade) {
    pills.push({
      label: t('mrb.shelf.gradeN', {
        n: user.student.grade + (user.student.class_group ? '-' + user.student.class_group : ''),
      }),
      bg: C.surface, fg: C.slate,
    });
  }
  if (summary?.reading_level) {
    pills.push({
      label: t('mrb.shelf.readingLevel', { level: summary.reading_level }),
      bg: C.surface, fg: C.slate,
    });
  }

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

  const earned = badges.filter((b) => b.earned).length;
  // "Next up" is the unearned badge closest to its target.
  const next = badges
    .filter((b) => !b.earned && b.target > 0)
    .sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* --------------------------------------------------------- banner */}
      <section style={{
        background: '#fff', border: '1px solid ' + C.line, borderRadius: 20,
        overflow: 'hidden', boxShadow: CARD_SHADOW, order: 1,
      }}>
        <div style={{ height: 84, background: C.sky100, borderBottom: '1px solid ' + C.sky200 }} />
        <div className="mrb-banner-body" style={{
          padding: '0 32px 28px', display: 'flex', gap: 24, alignItems: 'flex-end',
          flexWrap: 'wrap', marginTop: -44,
        }}>
          <span style={{
            width: 104, height: 104, borderRadius: '50%', background: C.deep, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SERIF, fontWeight: 700, fontSize: 36,
            boxShadow: '0 0 0 5px #fff', flexShrink: 0,
          }}>{initials || '·'}</span>

          <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="mrb-h-name" style={{
                margin: 0, fontFamily: SERIF, fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em',
              }}>{name}</h1>
              {handle && <span style={{ fontSize: 14, color: C.dim }}>{handle}</span>}
            </div>

            {pills.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pills.map((p) => (
                  <span key={p.label} style={{
                    background: p.bg, color: p.fg, borderRadius: 999, padding: '4px 12px',
                    fontSize: 12, fontWeight: 700,
                  }}>{p.label}</span>
                ))}
              </div>
            )}

            <Bio
              value={user?.student?.bio || ''} t={t} say={say}
              canEdit={!!user?.student} onSaved={load}
            />

            {pinned.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {pinned.map((b) => (
                  <span key={b.id} title={tr(t, `mrb.badge.${b.code}.desc`, b.description)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, background: b.tint,
                    border: '1px solid ' + b.ring, borderRadius: 999, padding: '3px 12px 3px 3px',
                    fontSize: 12, fontWeight: 700, color: b.ink,
                  }}>
                    <span style={{
                      width: 24, height: 24, background: b.fill, clipPath: SHAPES[b.shape] || SHAPES.circle,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontFamily: SERIF, fontWeight: 700,
                    }}>{b.glyph}</span>
                    {tr(t, `mrb.badge.${b.code}.name`, b.name)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setEditing(true)} style={{
            background: '#fff', color: C.deep, border: '1px solid ' + C.sky200, borderRadius: 10,
            padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t('mrb.acct.editProfile')}</button>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          borderTop: '1px solid ' + C.line,
        }}>
          <Stat
            label={t('mrb.shelf.booksCompleted')}
            value={summary?.books_completed ?? '—'}
            note={summary?.books_this_month
              ? t('mrb.shelf.plusThisMonth', { n: summary.books_this_month }) : ''}
          />
          <Stat
            label={t('mrb.shelf.pagesConquered')}
            value={fmtNum(summary?.pages_read ?? 0)}
            note={summary?.member_since
              ? t('mrb.shelf.since', {
                date: fmtMonthYear(summary.member_since),
              }) : ''}
          />
          <Stat
            label={t('mrb.shelf.avgSpeed')}
            value={summary?.pages_per_day ?? '—'} unit={t('mrb.shelf.perDay')}
            note={summary?.grade_percentile
              ? t('mrb.shelf.topPct', { pct: summary.grade_percentile, grade: user?.student?.grade })
              : ''}
          />
          <Stat
            label={t('mrb.shelf.currentStreak')}
            value={summary ? '🔥 ' + summary.streak_days : '—'} unit={t('mrb.shelf.days')}
            note={summary?.best_streak
              ? t('mrb.shelf.bestStreak', { n: summary.best_streak }) : ''}
            last
          />
        </div>
      </section>

      {/* --------------------------------------------------------- badges */}
      {/* The prototype puts this straight under the profile at 160px a card,
          which fills the screen before the reader reaches what they are
          actually reading. On the buyer's instruction it sits below the
          shelves instead, at 120px, and folds away. */}
      <section style={{
        background: '#fff', border: '1px solid ' + C.line, borderRadius: 20,
        padding: badgesOpen ? '24px 28px' : '18px 28px',
        display: 'flex', flexDirection: 'column', gap: badgesOpen ? 20 : 0,
        boxShadow: CARD_SHADOW, order: 3,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          gap: 16, flexWrap: 'wrap',
        }}>
          <button
            onClick={toggleBadges}
            aria-expanded={badgesOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, background: 'none',
              border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: 8, background: C.surface, color: C.deep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, flexShrink: 0,
              transform: badgesOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s',
            }}>›</span>
            <span>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 600 }}>
                {t('mrb.shelf.badges')}
              </h2>
              <span style={{ display: 'block', fontSize: 13, color: C.dim, marginTop: 2 }}>
                {t('mrb.shelf.badgeSummary', { n: earned, total: badges.length })}
              </span>
            </span>
          </button>
          {next && (
            <div style={{
              fontSize: 13, color: C.body, background: C.wash, border: '1px solid ' + C.line,
              borderRadius: 10, padding: '8px 12px',
            }}>
              {t('mrb.shelf.nextUp')} <strong style={{ color: C.ink }}>
                {tr(t, `mrb.badge.${next.code}.name`, next.name)}
              </strong>
            </div>
          )}
        </div>

        {badgesOpen && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10,
        }}>
          {badges.map((b) => (
            <BadgeCard key={b.id} badge={b} t={t} onPin={async () => {
              try { await api.post(`/shelf/badges/${b.id}/pin`); load(); }
              catch (err) {
                say(err.response?.data?.code === 'PIN_LIMIT' ? t('mrb.shelf.pinLimit') : t('msg.opFailed'));
              }
            }} />
          ))}
        </div>
        )}
      </section>

      {/* ------------------------------------------------ tabs + sidebar */}
      <section style={{
        display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start', order: 2,
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20, flex: '999 1 560px', minWidth: 0,
        }}>
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', background: '#fff',
            border: '1px solid ' + C.line, borderRadius: 12, padding: 5, alignSelf: 'flex-start',
          }}>
            {TABS.map(([key, label, n]) => {
              const on = tab === key;
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: on ? C.sky100 : 'transparent', color: on ? C.deep : C.body,
                  border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}>
                  {label}
                  <span style={{
                    background: on ? '#fff' : C.surface, color: on ? C.deep : C.body,
                    borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>{n}</span>
                </button>
              );
            })}
          </div>

          {tab === 'reading' && <CurrentlyReading loans={active} t={t} nav={nav} say={say} reload={load} />}
          {tab === 'reservations' && <ReservationsTab items={reservations} t={t} say={say} reload={load} />}
          {tab === 'requests' && <RequestsTab items={requests} t={t} say={say} reload={load} />}
          {tab === 'diary' && <DiaryHistory logs={diary} t={t} nav={nav} />}
          {tab === 'want' && <ShelfGrid items={want} t={t} nav={nav} say={say} reload={load} empty={t('mrb.shelf.noWant')} />}
          {tab === 'owned' && <ShelfGrid items={owned} t={t} nav={nav} say={say} reload={load} empty={t('mrb.shelf.noOwned')} />}
          {tab === 'favorites' && <ShelfGrid items={favorites} t={t} nav={nav} say={say} reload={load} empty={t('mrb.shelf.noFavorites')} favoritesView />}
          {tab === 'notes' && <NotesTab notes={notes} t={t} say={say} reload={load} />}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: '1 1 300px' }}>
          <GenreMix mix={summary?.genre_mix || []} done={summary?.books_completed || 0} t={t} />
          <GoalCard goal={goal} t={t} say={say} reload={load} />
        </aside>
      </section>

      {editing && <ProfileDialog onClose={() => setEditing(false)} />}
      <Toast message={toast} />
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

function Stat({ label, value, unit, note, last }) {
  return (
    <div className="mrb-stat-cell" style={{ padding: '20px 32px', borderRight: last ? 'none' : '1px solid ' + C.line }}>
      <div style={{ fontSize: 13, color: C.dim }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: C.ink }}>
        {value}
        {unit ? <span style={{ fontSize: 16, fontWeight: 600, color: C.dim }}> {unit}</span> : null}
      </div>
      <div style={{ fontSize: 12, color: C.brandHi, fontWeight: 600, minHeight: 18 }}>{note}</div>
    </div>
  );
}

function BadgeCard({ badge: b, t, onPin }) {
  const clip = SHAPES[b.shape] || SHAPES.circle;
  const pct = b.target > 0 ? Math.min(100, (b.progress / b.target) * 100) : 0;

  return (
    <div
      title={tr(t, `mrb.badge.${b.code}.desc`, b.description)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
        padding: '14px 10px 12px', borderRadius: 14,
        background: b.earned ? b.tint : '#fff',
        border: '1px solid ' + (b.earned ? b.ring : C.line),
      }}>
      <div style={{
        width: 56, height: 56, position: 'relative',
        filter: b.earned ? 'none' : 'grayscale(1)', opacity: b.earned ? 1 : 0.5,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: b.ring, clipPath: clip }} />
        <div style={{
          position: 'absolute', inset: 4, background: b.fill, clipPath: clip,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          fontFamily: SERIF, fontWeight: 700, fontSize: 20, lineHeight: 1,
          letterSpacing: '-0.02em', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.12)',
        }}>{b.glyph}</div>
        {b.tier && (
          <span style={{
            position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
            background: b.earned ? b.fill : C.line2, color: '#fff', border: '2px solid #fff',
            borderRadius: 999, padding: '0 6px', fontSize: 9, fontWeight: 800,
            letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>{b.tier}</span>
        )}
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>
          {tr(t, `mrb.badge.${b.code}.name`, b.name)}
        </div>
        {/* The description is the first thing to go when the card shrinks: the
            name and the progress carry the meaning. It stays as a tooltip. */}
      </div>

      {b.earned ? (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: b.ink }}>
            {b.earned_at ? fmtDate(b.earned_at) : ''}
          </span>
          <button onClick={onPin} style={{
            background: 'none', border: 0, color: C.deep, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
          }}>{b.pinned ? t('mrb.shelf.unpin') : t('mrb.shelf.pin')}</button>
        </div>
      ) : b.target > 0 ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 'auto' }}>
          <div style={{ height: 6, background: C.line, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: b.fill, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.dim }}>
            {fmtNum(b.progress)} / {fmtNum(b.target)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------- currently reading */

function CurrentlyReading({ loans, t, nav, say, reload }) {
  if (loans.length === 0) return <EmptyCard>{t('mrb.shelf.noLoans')}</EmptyCard>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {loans.map((l) => <LoanCard key={l.id} loan={l} t={t} nav={nav} say={say} reload={reload} />)}
    </div>
  );
}

function LoanCard({ loan, t, nav, say, reload }) {
  const [logging, setLogging] = useState(false);
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);

  const total = loan.page_count || 0;
  const current = loan.current_page || 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  const due = loan.due_date ? new Date(loan.due_date) : null;
  const daysLeft = due ? Math.ceil((due - new Date()) / 86400000) : null;
  const dueTone = daysLeft == null ? { bg: C.surface, fg: C.body, border: C.line }
    : daysLeft < 0 ? { bg: C.coralBg, fg: C.coralFg, border: C.coralBorder }
    : daysLeft <= 3 ? { bg: C.warnBg, fg: C.warnFg, border: C.warnBorder }
    : { bg: C.sky100, fg: C.deep, border: C.sky200 };

  const [bg, fg] = coverColors(loan.book_title);

  const save = async () => {
    const n = parseInt(page, 10);
    if (!n || n < 0) { say(t('mrb.shelf.enterPage')); return; }
    if (total > 0 && n > total) { say(t('mrb.shelf.pageTooHigh', { n: total })); return; }
    setBusy(true);
    try {
      await api.post('/reading-log', { loan_id: loan.id, page: n });
      setPage(''); setLogging(false);
      say(t('mrb.shelf.logged'));
      reload();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const open = () => loan.edition_id && nav(`/app/book/${loan.edition_id}`);

  return (
    <div style={{
      background: '#fff', border: '1px solid ' + dueTone.border, borderRadius: 16, padding: 20,
      display: 'flex', gap: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <button onClick={open} style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer', flexShrink: 0 }}>
        {loan.cover_url ? (
          <img src={assetUrl(loan.cover_url)} alt={loan.book_title} style={{
            width: 88, aspectRatio: '2/3', borderRadius: 5, objectFit: 'cover', display: 'block',
            boxShadow: 'inset 3px 0 0 rgba(255,255,255,0.15), 0 4px 12px rgba(15,23,42,0.15)',
          }} />
        ) : (
          <div style={{
            width: 88, aspectRatio: '2/3', background: bg, color: fg, borderRadius: 5, padding: 8,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left',
            boxShadow: 'inset 3px 0 0 rgba(255,255,255,0.15), 0 4px 12px rgba(15,23,42,0.15)',
          }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>
              {loan.book_title}
            </div>
            <div style={{ fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
              {loan.author}
            </div>
          </div>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700 }}>{loan.book_title}</div>
            <div style={{ fontSize: 13, color: C.dim }}>
              {[loan.author, loan.issue_date
                ? t('mrb.shelf.since', { date: fmtDate(loan.issue_date) })
                : ''].filter(Boolean).join(' · ')}
            </div>
          </div>
          {due && (
            <span style={{
              background: dueTone.bg, color: dueTone.fg, borderRadius: 999, padding: '4px 12px',
              fontSize: 12, fontWeight: 700,
            }}>
              {daysLeft < 0 ? t('mrb.shelf.overdue', { n: -daysLeft }) : t('mrb.shelf.dueIn', { n: daysLeft })}
            </span>
          )}
        </div>

        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13,
            marginBottom: 6, flexWrap: 'wrap',
          }}>
            <span style={{ color: C.slate }}>
              {total > 0
                ? t('mrb.shelf.pageOfTotal', { current, total })
                : t('mrb.shelf.pageOnly', { current })}
            </span>
            {total > 0 && <strong style={{ color: C.deep }}>{pct}%</strong>}
          </div>
          <div style={{ height: 10, background: C.sky100, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: pct + '%', height: '100%', background: C.brand,
              borderRadius: 999, transition: 'width .4s ease',
            }} />
          </div>
        </div>

        {logging ? (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: C.tint,
            border: '1px solid ' + C.sky200, borderRadius: 12, padding: '10px 12px',
          }}>
            <span style={{ fontSize: 13, color: C.deep, fontWeight: 600 }}>{t('mrb.pageReached')}</span>
            <input
              type="number" min={1} value={page} onChange={(e) => setPage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              style={{
                width: 80, border: '1px solid ' + C.sky200, borderRadius: 8, padding: '7px 10px',
                fontSize: 14, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={save} disabled={busy} style={{
              background: C.brand, color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('common.save')}</button>
            <button onClick={() => setLogging(false)} style={{
              background: 'none', color: C.body, border: 0, padding: '8px 10px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('common.cancel')}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setLogging(true)} style={{
              background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '9px 16px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('mrb.shelf.logPages')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the diary */

function DiaryHistory({ logs, t, nav }) {
  if (logs.length === 0) return <EmptyCard>{t('mrb.shelf.noDiary')}</EmptyCard>;

  // Grouped by month, as the design specifies.
  const groups = [];
  logs.forEach((l) => {
    const d = new Date(l.created_at);
    const key = fmtMonthYear(d);
    const g = groups.find((x) => x.key === key);
    if (g) g.rows.push(l); else groups.push({ key, rows: [l] });
  });

  return (
    <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, overflow: 'hidden' }}>
      {groups.map((g) => (
        <div key={g.key}>
          <div style={{
            background: C.wash, borderBottom: '1px solid ' + C.line, padding: '10px 20px',
            fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: C.deep,
          }}>{g.key}</div>
          {g.rows.map((l) => {
            const [bg] = coverColors(l.book_title || '');
            return (
              <div key={l.id} style={{
                display: 'grid', gridTemplateColumns: '48px 36px minmax(0,1fr) auto',
                gap: 16, alignItems: 'center', padding: '12px 20px',
                borderBottom: '1px solid ' + C.surface,
              }}>
                <div style={{
                  fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: C.ink, textAlign: 'center',
                }}>{new Date(l.created_at).getDate()}</div>
                <span style={{
                  width: 36, aspectRatio: '2/3', background: bg, borderRadius: 3,
                  boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
                }} />
                <button
                  onClick={() => l.edition_id && nav(`/app/book/${l.edition_id}`)}
                  style={{
                    background: 'none', border: 0, padding: 0, textAlign: 'left',
                    cursor: l.edition_id ? 'pointer' : 'default', minWidth: 0, fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
                    {l.book_title || t('mrb.shelf.reachedPage', { n: l.page })}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim }}>
                    {[l.author, t('mrb.shelf.reachedPage', { n: l.page }), l.note]
                      .filter(Boolean).join(' · ')}
                  </div>
                </button>
                <span style={{ fontSize: 12, color: C.mute, whiteSpace: 'nowrap' }}>
                  {fmtDayMonth(l.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- shelf grids */

// One grid serves "I own this", "want to read" and "favourites" — they differ
// only in what removing means.
function ShelfGrid({ items, t, nav, say, reload, empty, favoritesView }) {
  if (items.length === 0) return <EmptyCard>{empty}</EmptyCard>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 20 }}>
      {items.map((it) => {
        const [bg, fg] = coverColors(it.title);
        const remove = async () => {
          try {
            await api.post('/shelf', favoritesView
              ? { work_id: it.work_id, favorite: false }
              : { work_id: it.work_id, status: '' });
            say(t('mrb.shelf.removed'));
            reload();
          } catch { say(t('msg.opFailed')); }
        };
        return (
          <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => it.edition_id && nav(`/app/book/${it.edition_id}`)}
              style={{
                border: 0, padding: 0, background: 'none', textAlign: 'left',
                cursor: it.edition_id ? 'pointer' : 'default', position: 'relative',
              }}
            >
              {it.cover_url ? (
                <img src={assetUrl(it.cover_url)} alt={it.title} style={{
                  width: '100%', aspectRatio: '2/3', borderRadius: 8, objectFit: 'cover', display: 'block',
                  boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
                }} />
              ) : (
                <div style={{
                  width: '100%', aspectRatio: '2/3', background: bg, color: fg, borderRadius: 8,
                  padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
                }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
                    {it.title}
                  </div>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85,
                  }}>{it.author}</div>
                </div>
              )}
              {it.favorite && !favoritesView && (
                <span style={{
                  position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.94)', color: '#F59E0B', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>★</span>
              )}
            </button>

            <div style={{ fontSize: 12, color: C.dim }}>
              {[it.author, it.pages ? `${it.pages} ${t('mrb.pagesShort')}` : ''].filter(Boolean).join(' · ') || '—'}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => it.edition_id && nav(`/app/book/${it.edition_id}`)}
                style={{
                  flex: 1, background: '#fff', color: C.deep, border: '1px solid ' + C.sky200,
                  borderRadius: 8, padding: '6px 8px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{t('mrb.shelf.openBook')}</button>
              <button
                onClick={remove} title={t('mrb.shelf.remove')} aria-label={t('mrb.shelf.remove')}
                style={{
                  background: '#fff', color: C.dim, border: '1px solid ' + C.line, borderRadius: 8,
                  padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- the notes */

function NotesTab({ notes, t, say, reload }) {
  if (notes.length === 0) return <EmptyCard>{t('mrb.shelf.noNotes')}</EmptyCard>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {notes.map((n) => {
        const [bg] = coverColors(n.work?.title || '');
        return (
          <div key={n.id} style={{
            background: C.noteBg, border: '1px solid ' + C.noteBorder, borderRadius: 16,
            padding: 20, display: 'flex', gap: 16,
          }}>
            <span style={{
              width: 44, aspectRatio: '2/3', background: bg, borderRadius: 3, flexShrink: 0,
              boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
            }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: SERIF, fontSize: 17 }}>{n.work?.title || '—'}</strong>
                <span style={{
                  background: C.warnBg, color: C.warnFg, borderRadius: 999, padding: '2px 10px',
                  fontSize: 11, fontWeight: 700,
                }}>🔒 {t('mrb.shelf.privateNote')}</span>
                <span style={{ fontSize: 12, color: C.mute, marginLeft: 'auto' }}>
                  {n.created_at || n.updated_at
                    ? fmtDate(n.created_at || n.updated_at)
                    : ''}
                </span>
              </div>
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6, color: C.slate,
                textWrap: 'pretty', whiteSpace: 'pre-wrap',
              }}>{n.text}</p>
              <button onClick={async () => {
                try { await api.delete(`/notes/${n.id}`); say(t('mrb.shelf.noteDeleted')); reload(); }
                catch { say(t('msg.opFailed')); }
              }} style={{
                alignSelf: 'flex-start', background: 'none', border: 0, padding: 0,
                fontSize: 12, color: C.dim, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('common.delete')}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------- the sidebar */

function GenreMix({ mix, done, t }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 22,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('mrb.shelf.genreMix')}</h3>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
          {t('mrb.shelf.basedOnN', { n: done })}
        </div>
      </div>

      {mix.length === 0 ? (
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{t('mrb.shelf.noGenreMix')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', gap: 3 }}>
            {mix.map((g) => (
              <div key={g.name} style={{ width: g.pct + '%', background: genreColors(g.name)[0] }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mix.map((g) => (
              <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 3, background: genreColors(g.name)[0], flexShrink: 0,
                }} />
                <span style={{ flex: 1, color: C.slate }}>{g.name}</span>
                <span style={{ color: C.dim, fontSize: 12 }}>{t('mrb.nBooks', { n: g.books })}</span>
                <strong style={{ width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {g.pct}%
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GoalCard({ goal, t, say, reload }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState('');

  if (!goal) return null;
  const pct = goal.target > 0 ? Math.min(100, (goal.completed / goal.target) * 100) : 0;
  const left = Math.max(0, goal.target - goal.completed);

  const save = async () => {
    const n = parseInt(target, 10);
    if (isNaN(n) || n < 0) { say(t('msg.opFailed')); return; }
    try {
      await api.put('/shelf/goal', { year: goal.year, target: n });
      setEditing(false);
      reload();
    } catch { say(t('msg.opFailed')); }
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 22,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 12, flexWrap: 'wrap',
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {t('mrb.shelf.yearGoal', { year: goal.year })}
        </h3>
        {goal.target > 0 && !editing && (
          <span style={{ fontSize: 13, color: C.body }}>
            <strong style={{ color: C.ink }}>{goal.completed}</strong> / {goal.target}
          </span>
        )}
      </div>

      {editing || goal.target === 0 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number" min={0} max={1000} value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder={t('mrb.shelf.goalPlaceholder')}
            style={{
              width: 90, border: '1px solid ' + C.line, borderRadius: 10, padding: '8px 12px',
              fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={save} style={{
            background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t('common.save')}</button>
          {goal.target > 0 && (
            <button onClick={() => setEditing(false)} style={{
              background: 'none', border: 0, color: C.body, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('common.cancel')}</button>
          )}
        </div>
      ) : (
        <>
          <div style={{ height: 10, background: C.sky100, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: C.brand, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
            {left === 0
              ? t('mrb.shelf.goalDone')
              : t('mrb.shelf.goalPace', { n: left, weeks: goal.weeks_left })}
          </div>
          <button onClick={() => { setTarget(String(goal.target)); setEditing(true); }} style={{
            alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: C.deep,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            textDecoration: 'underline',
          }}>{t('mrb.shelf.changeGoal')}</button>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- misc */

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
      border: '1px dashed ' + C.sky200, background: C.tint, borderRadius: 16,
      padding: 40, textAlign: 'center', fontSize: 14, color: C.body, lineHeight: 1.6,
    }}>{children}</div>
  );
}

/* ------------------------------------------------------------------ bio */

// The line under the name. The prototype has one ("Sci-fi first, classics
// second…") and it is the only place a reader says anything about themselves,
// so the field was added rather than dropping the row.
function Bio({ value, canEdit, t, say, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/shelf/bio', { bio: text });
      setEditing(false);
      say(t('mrb.shelf.bioSaved'));
      onSaved();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={280} autoFocus
          placeholder={t('mrb.shelf.bioPlaceholder')}
          style={{
            flex: '1 1 320px', maxWidth: 640, border: '1px solid ' + C.line, borderRadius: 10,
            padding: '8px 10px', fontSize: 14, lineHeight: 1.55, color: C.body,
            fontFamily: 'inherit', outline: 'none', resize: 'vertical',
          }}
        />
        <button onClick={save} disabled={busy} style={{
          background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>{t('common.save')}</button>
        <button onClick={() => { setText(value); setEditing(false); }} style={{
          background: 'none', border: 0, color: C.body, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', padding: '8px 4px',
        }}>{t('common.cancel')}</button>
      </div>
    );
  }

  if (!value) {
    if (!canEdit) return null;
    return (
      <button onClick={() => setEditing(true)} style={{
        alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: C.deep,
        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>{t('mrb.shelf.addBio')} →</button>
    );
  }

  return (
    <p
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? t('mrb.shelf.editBio') : undefined}
      style={{
        margin: 0, fontSize: 14, color: C.body, lineHeight: 1.55, maxWidth: 640,
        cursor: canEdit ? 'pointer' : 'default',
      }}
    >{value}</p>
  );
}
