// Discover — screen 1 of the handoff, "01 Community Hub".
//
// Sizes, colours and spacing are transcribed from the prototype rather than
// approximated: 40px section gaps, 18px hero-card radius, Source Serif 38/600
// greeting, the 44px serif statistic, the deep-blue league card with its period
// and scope toggles, lead line and "Your contribution" footer, the 180px
// trending carousel, and the 44 / 1fr / 76 post grid.

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { coverColors, cefrColors } from '../theme';

/* Literal design values, kept together so they read like the spec. */
const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F1F5F9', tint: '#F0F9FF',
  sky100: '#E0F2FE', sky200: '#BAE6FD', sky300: '#7DD3FC',
  deep: '#075985', brand: '#1B9DD9', brandHi: '#1580B5',
  coralBg: '#FFF1EE', coralFg: '#B4232A', likeBg: '#FFE4E6', likeFg: '#D93A41',
};
const SERIF = "'Source Serif 4', Georgia, serif";
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)';
const DEEP_SHADOW = '0 8px 24px rgba(7,89,133,0.25)';

export default function Discover() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const nav = useNavigate();

  const [period, setPeriod] = useState(30);
  const [scope, setScope] = useState('branches');
  const [trending, setTrending] = useState([]);
  const [readers, setReaders] = useState([]);
  const [league, setLeague] = useState(null);
  const [topReviewer, setTopReviewer] = useState(null);
  const [feed, setFeed] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [allTime, setAllTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/community/trending', { params: { days: period, limit: 9 } }),
      api.get('/community/readers', { params: { days: period, limit: 5 } }),
      api.get('/community/league', { params: { days: period, scope } }),
      api.get('/community/top-reviewer', { params: { days: period } }),
      api.get('/community/reviews', { params: { limit: 8 } }),
      api.get('/challenges'),
    ]).then(([tr, rd, lg, tv, fd, ch]) => {
      if (!alive) return;
      let widened = false;
      if (tr.status === 'fulfilled') setTrending(tr.value.data || []);
      if (rd.status === 'fulfilled') {
        setReaders(rd.value.data?.readers || []);
        widened = widened || !!rd.value.data?.all_time;
      }
      if (lg.status === 'fulfilled') {
        setLeague(lg.value.data || null);
        widened = widened || !!lg.value.data?.all_time;
      }
      setTopReviewer(tv.status === 'fulfilled' && tv.value.data?.found ? tv.value.data : null);
      if (fd.status === 'fulfilled') setFeed(fd.value.data || []);
      if (ch.status === 'fulfilled') {
        const list = ch.value.data || [];
        setChallenge(list.find((x) => x.state === 'active') || list[0] || null);
      }
      setAllTime(widened);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [period, scope, reloadKey]);

  const first = (user?.student?.name || user?.librarian?.name || user?.manager?.name || '')
    .split(/\s+/)[0] || '';
  const rows = league?.league || [];
  const mineRow = rows.find((r) => r.is_mine);
  const myRank = mineRow ? rows.indexOf(mineRow) + 1 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* ------------------------------------------------------ greeting */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.brandHi, marginBottom: 6 }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 style={{
          margin: 0, fontFamily: SERIF, fontSize: 38, fontWeight: 600,
          letterSpacing: '-0.02em', color: C.ink,
        }}>{greeting(t)}{first ? `, ${first}.` : '.'}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: C.body }}>
          {mineRow
            ? (myRank === 1
              ? t('mrb.disc.leagueTop', { name: mineRow.branch })
              : t('mrb.disc.leagueSentence', { branch: mineRow.branch, rank: myRank, total: rows.length }))
            : t('mrb.disc.leagueSentenceNone')}
        </p>
      </div>

      {/* --------------------------------------------------- hall of fame */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20,
      }}>
        <BookwormCard reader={readers[0]} allTime={allTime} t={t} nav={nav} />
        <TopReviewerCard data={topReviewer} t={t} />
        <LeagueCard
          league={league} rows={rows} mineRow={mineRow} myRank={myRank}
          period={period} setPeriod={setPeriod} scope={scope} setScope={setScope}
          allTime={allTime} t={t} nav={nav}
        />
      </section>

      {/* ------------------------------------------------------ trending */}
      <Trending books={trending} loading={loading} t={t} nav={nav} reload={reload} />

      {/* --------------------------------------------- activity + sidebar */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '999 1 560px', minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap',
          }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {t('mrb.disc.activity')}
            </h2>
            <span style={{ fontSize: 13, color: C.dim }}>{t('mrb.disc.feedSub', { n: feed.length })}</span>
          </div>

          {feed.length === 0 ? (
            <Panel><span style={{ fontSize: 14, color: C.dim, lineHeight: 1.6 }}>{t('mrb.disc.feedEmpty')}</span></Panel>
          ) : feed.map((row) => (
            <PostCard key={row.review.id} row={row} t={t} nav={nav} reload={reload} />
          ))}
        </div>

        <aside style={{
          display: 'flex', flexDirection: 'column', gap: 20,
          position: 'sticky', top: 88, flex: '1 1 320px',
        }}>
          <TopReaders readers={readers} allTime={allTime} t={t} />
          {challenge && <ChallengeTeaser ch={challenge} t={t} nav={nav} />}
        </aside>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- shared */

function Panel({ children, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + C.line, borderRadius: 18,
      boxShadow: CARD_SHADOW, padding: 24, display: 'flex', flexDirection: 'column', gap: 18,
      ...style,
    }}>{children}</div>
  );
}

function Eyebrow({ children, bg = C.sky100, fg = C.deep }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: fg, background: bg, borderRadius: 999, padding: '4px 10px',
      whiteSpace: 'nowrap', alignSelf: 'flex-start',
    }}>{children}</span>
  );
}

function Avatar({ initials, size = 52, bg = C.brand, ring = true }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: Math.round(size * 0.33), flexShrink: 0,
      boxShadow: ring ? '0 0 0 3px ' + C.sky200 : 'none',
    }}>{initials || '·'}</span>
  );
}

// Half stars: two stacked rows, the top one clipped to rating/5.
function Stars({ value = 0, size = 13 }) {
  const w = (Math.max(0, Math.min(5, value)) / 5) * 100;
  return (
    <span style={{
      position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1,
      letterSpacing: '1px', color: C.line2, flexShrink: 0,
    }}>
      ★★★★★
      <span style={{
        position: 'absolute', left: 0, top: 0, overflow: 'hidden',
        whiteSpace: 'nowrap', color: C.brand, width: w + '%',
      }}>★★★★★</span>
    </span>
  );
}

function Cover({ title, author, src, width, radius = 8, titleSize = 20, pad = '40px 14px 16px', rotate }) {
  const [bg, fg] = coverColors(title);
  const box = {
    width: width || '100%', aspectRatio: '2/3', borderRadius: radius,
    boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
    flexShrink: 0, overflow: 'hidden',
    transform: rotate ? `rotate(${rotate}deg)` : undefined,
  };
  if (src) return <img src={src} alt={title} style={{ ...box, objectFit: 'cover', display: 'block' }} />;
  return (
    <div style={{
      ...box, background: bg, color: fg, padding: pad,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{
        fontFamily: SERIF, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1,
        textWrap: 'balance', overflow: 'hidden',
      }}>{title}</div>
      {author && (
        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
          {author}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- hall of fame */

function BookwormCard({ reader, allTime, t, nav }) {
  if (!reader) {
    return (
      <Panel>
        <Eyebrow>{t('mrb.disc.bookworm')}</Eyebrow>
        <span style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{t('mrb.disc.noReaders')}</span>
      </Panel>
    );
  }
  const fav = reader.favourite;
  return (
    <Panel>
      <Eyebrow>{t('mrb.disc.bookworm')}</Eyebrow>
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar initials={reader.initials} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{reader.name}</div>
              <div style={{ fontSize: 13, color: C.dim }}>
                {[reader.grade, reader.branch].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: SERIF, fontSize: 44, fontWeight: 700, lineHeight: 1,
              color: C.deep, letterSpacing: '-0.02em',
            }}>{reader.pages.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: C.body, marginTop: 4 }}>
              {t('mrb.disc.pagesInPeriod', { n: reader.books })}{allTime ? ' · ' + t('mrb.disc.allTime') : ''}
            </div>
          </div>
          {fav && (
            <>
              <div style={{ fontSize: 12, color: C.dim, borderTop: '1px solid ' + C.line, paddingTop: 12 }}>
                {t('mrb.disc.favouriteRead')}
              </div>
              <button onClick={() => fav.edition_id && nav(`/app/book/${fav.edition_id}`)} style={{
                marginTop: -8, background: 'none', border: 0, padding: 0, textAlign: 'left',
                cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.deep,
              }}>{fav.title}{fav.rating ? ` — ★ ${fav.rating.toFixed(1)}` : ''} →</button>
            </>
          )}
        </div>
        {fav && (
          <div style={{ width: 96, flexShrink: 0, alignSelf: 'center' }}>
            <Cover title={fav.title} author={fav.author}
              src={fav.cover_url ? assetUrl(fav.cover_url) : ''}
              radius={6} titleSize={16} pad="12px" rotate={2} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function TopReviewerCard({ data, t }) {
  return (
    <Panel style={{ gap: 16 }}>
      <Eyebrow>{t('mrb.disc.topReviewer')}</Eyebrow>
      {!data ? (
        <span style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{t('mrb.disc.noReviewsYet')}</span>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar initials={data.initials} bg={C.deep} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.name}</div>
              <div style={{ fontSize: 13, color: C.dim }}>{data.sub}</div>
            </div>
          </div>
          {data.quote && (
            <blockquote style={{
              margin: 0, fontFamily: SERIF, fontSize: 16, lineHeight: 1.5,
              color: C.slate, textWrap: 'pretty',
            }}>“{data.quote}”</blockquote>
          )}
          <div style={{
            display: 'flex', gap: 16, marginTop: 'auto', paddingTop: 12,
            borderTop: '1px solid ' + C.line, flexWrap: 'wrap',
          }}>
            {[[data.upvotes, t('mrb.disc.upvotes')],
              [data.reviews, t('mrb.disc.reviews')],
              [data.replies, t('mrb.disc.repliesSparked')]].map(([n, label]) => (
              <div key={label}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{n}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function LeagueCard({ league, rows, mineRow, myRank, period, setPeriod, scope, setScope, allTime, t, nav }) {
  const max = Math.max(...rows.map((r) => r.avg_pages), 1);
  // The design hides the scope toggle when the school has a single branch.
  const showScopes = (league?.branch_count ?? 0) > 1;
  const leader = rows[0];

  const toggle = (active, wide) => ({
    background: active ? '#fff' : 'transparent',
    color: active ? C.deep : '#fff',
    border: 0, borderRadius: 6, padding: wide ? '5px 12px' : '4px 10px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      background: C.deep, color: '#fff', borderRadius: 18, boxShadow: DEEP_SHADOW,
      padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Eyebrow bg={C.sky200} fg={C.deep}>
          {scope === 'schools' ? t('mrb.disc.schoolLeague') : t('mrb.disc.branchLeague')}
        </Eyebrow>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 2 }}>
          {[[7, t('mrb.disc.week')], [30, t('mrb.disc.month')]].map(([d, label]) => (
            <button key={d} onClick={() => setPeriod(d)} style={toggle(period === d)}>{label}</button>
          ))}
        </div>
      </div>

      {showScopes && (
        <div style={{
          display: 'flex', gap: 2, background: 'rgba(255,255,255,0.12)', borderRadius: 8,
          padding: 2, alignSelf: 'flex-start', flexWrap: 'wrap',
        }}>
          {[['branches', t('mrb.disc.ourBranches')], ['schools', t('mrb.disc.allianceSchools')]].map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)} style={toggle(scope === k, true)}>{label}</button>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.sky200 }}>
        {t('mrb.disc.avgPerStudent')}{allTime ? ' · ' + t('mrb.disc.allTime') : ''}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.length === 0 && <span style={{ fontSize: 13, color: C.sky200 }}>{t('mrb.disc.noLeague')}</span>}
        {rows.map((r, i) => (
          <div key={r.branch} style={{
            display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) auto', gap: '4px 10px',
            alignItems: 'center', borderRadius: 10, padding: '6px 8px',
            background: r.is_mine ? 'rgba(255,255,255,0.12)' : 'transparent',
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.sky300 }}>{i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: r.is_mine ? 800 : 600, color: '#fff', minWidth: 0 }}>
              {r.branch}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>
              {r.avg_pages}
            </span>
            <span />
            <div style={{
              gridColumn: 'span 2', height: 6, background: 'rgba(255,255,255,0.12)',
              borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                width: `${(r.avg_pages / max) * 100}%`, height: '100%',
                background: r.is_mine ? C.sky300 : 'rgba(255,255,255,0.55)',
                borderRadius: 999, transition: 'width .5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {mineRow && leader && (
        <div style={{ fontSize: 13, color: C.sky100, lineHeight: 1.5 }}>
          {myRank === 1
            ? t('mrb.disc.leadTop', { name: mineRow.branch, n: mineRow.avg_pages - (rows[1]?.avg_pages ?? 0) })
            : t('mrb.disc.leadBehind', {
              name: mineRow.branch, rank: myRank, total: rows.length,
              n: leader.avg_pages - mineRow.avg_pages, leader: leader.branch,
            })}
        </div>
      )}

      <button onClick={() => nav('/app/challenges')} style={{
        alignSelf: 'flex-start', background: 'none', border: 0, padding: 0,
        color: C.sky300, fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>{t('mrb.disc.battlesLink')} →</button>

      <div style={{
        marginTop: 'auto', background: 'rgba(255,255,255,0.1)', borderRadius: 12,
        padding: '10px 14px', fontSize: 13, color: C.sky100,
        display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <span>{t('mrb.disc.yourContribution')}</span>
        <strong style={{ color: '#fff' }}>
          {t('mrb.disc.nPages', { n: (league?.my_pages ?? 0).toLocaleString() })}
        </strong>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- trending */

function Trending({ books, loading, t, nav, reload }) {
  const scroller = useRef(null);
  const by = (px) => scroller.current?.scrollBy({ left: px, behavior: 'smooth' });
  const round = {
    width: 36, height: 36, borderRadius: '50%', border: '1px solid ' + C.line,
    background: '#fff', cursor: 'pointer', fontSize: 16, color: C.deep,
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {t('mrb.disc.trending')}
          </h2>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>{t('mrb.disc.trendingSub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => by(-600)} style={round}>←</button>
          <button onClick={() => by(600)} style={round}>→</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: C.mute, fontSize: 14, padding: 20 }}>{t('common.loading')}</div>
      ) : (
        <div ref={scroller} style={{
          display: 'flex', gap: 20, overflowX: 'auto',
          padding: '4px 2px 12px', scrollBehavior: 'smooth', scrollbarWidth: 'thin',
        }}>
          {books.map((b, i) => (
            <TrendingCard key={b.edition_id} b={b} rank={i + 1} t={t} nav={nav} reload={reload} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrendingCard({ b, rank, t, nav, reload }) {
  const [busy, setBusy] = useState(false);
  const [cbg, cfg] = cefrColors(b.cefr);
  const canBorrow = b.available_copies > 0 && !b.my_status;

  const label = b.my_status === 'ON_LOAN' ? t('mrb.cat.youHaveIt')
    : b.my_status === 'RESERVED_READY' ? t('mrb.cat.ready')
    : b.my_status === 'RESERVED_PENDING' ? t('mrb.cat.requested')
    : canBorrow ? t('mrb.cat.requestLoan')
    : t('mrb.allOnLoan');

  const tone = b.my_status
    ? { background: C.sky100, color: C.deep, border: '1px solid ' + C.sky200 }
    : canBorrow
      ? { background: C.brand, color: '#fff', border: '1px solid ' + C.brand }
      : { background: C.wash, color: C.dim, border: '1px solid ' + C.line };

  return (
    <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button onClick={() => nav(`/app/book/${b.edition_id}`)} style={{
        position: 'relative', border: 0, padding: 0, background: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <Cover title={b.title} author={b.author} src={b.cover_url ? assetUrl(b.cover_url) : ''} />
        {b.cefr && (
          <span style={{
            position: 'absolute', top: 10, right: 10, background: cbg, color: cfg,
            fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.2)',
          }}>{b.cefr}</span>
        )}
        <span style={{
          position: 'absolute', bottom: 34, right: 10, background: 'rgba(15,23,42,0.6)',
          color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px',
        }}>#{rank}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.body }}>
        <Stars value={b.rating || 0} />
        {b.rating != null && <strong style={{ color: C.ink }}>{b.rating.toFixed(1)}</strong>}
        <span>· {t('mrb.disc.nLogs', { n: b.loans })}</span>
      </div>

      <button
        disabled={busy || !canBorrow}
        onClick={async () => {
          if (!canBorrow || !b.book_id) return;
          setBusy(true);
          try { await api.post('/reservation', { book_id: b.book_id }); } catch { /* card refreshes to the truth */ }
          reload();
          setBusy(false);
        }}
        style={{
          ...tone, borderRadius: 8, padding: '7px 10px', fontSize: 13, fontWeight: 600,
          cursor: canBorrow ? 'pointer' : 'default', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >{label}</button>
    </div>
  );
}

/* --------------------------------------------------------- activity feed */

function PostCard({ row, t, nav, reload }) {
  const r = row.review;
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = () => r.edition_id && nav(`/app/book/${r.edition_id}`);

  return (
    <article style={{
      background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
      display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 76px', gap: 16,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <Avatar initials={r.author_initials} size={44} bg={C.deep} ring={false} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: C.dim }}>
          <strong style={{ color: C.ink, fontSize: 14 }}>{r.author_name}</strong>
          {r.author_sub && <><span>·</span><span>{r.author_sub}</span></>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: C.body }}>{t('mrb.disc.reviewed')}</span>
          <button onClick={open} style={{
            background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
            fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: C.ink,
          }}>{row.book_title || '—'}</button>
          <Stars value={r.rating} size={15} />
        </div>

        {r.spoiler && !revealed ? (
          <button onClick={() => setRevealed(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
            background: 'repeating-linear-gradient(135deg,#F1F5F9 0 8px,#F8FAFC 8px 16px)',
            border: '1px dashed ' + C.line2, borderRadius: 10, padding: '12px 14px',
            fontSize: 13, color: C.body, flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 700, color: C.deep }}>{t('mrb.disc.spoilerTitle')}</span>
            <span>{t('mrb.disc.spoilerBody')}</span>
          </button>
        ) : (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.slate, textWrap: 'pretty' }}>{r.text}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: C.mute, marginRight: 6 }}>
            {new Date(r.created_at).toLocaleDateString()}
          </span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await api.post(`/reviews/${r.id}/vote`); } catch { /* own reviews are refused */ }
              reload(); setBusy(false);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: r.i_voted ? C.likeBg : C.wash, color: r.i_voted ? C.likeFg : C.body,
              border: 0, borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>♥ {r.helpful}</button>
          <button onClick={open} style={{
            background: C.wash, color: C.body, border: 0, borderRadius: 999,
            padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t('mrb.rev.nReplies', { n: r.reply_count })}</button>
          <span style={{ flex: 1 }} />
          {!r.is_mine && (
            <button
              title={t('mrb.disc.flagTitle')}
              onClick={async () => { try { await api.post(`/reviews/${r.id}/report`, { reason: 'OFF_TOPIC' }); } catch { /* ignore */ } }}
              style={{
                background: 'none', border: 0, borderRadius: 6, padding: '5px 8px',
                fontSize: 12, fontWeight: 600, color: C.mute, cursor: 'pointer',
              }}>⚑ {t('mrb.rev.report')}</button>
          )}
        </div>
      </div>

      <button onClick={open} style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer', alignSelf: 'start' }}>
        <Cover title={row.book_title || ''} src={row.cover_url ? assetUrl(row.cover_url) : ''}
          width={76} radius={4} titleSize={11} pad="7px" />
      </button>
    </article>
  );
}

/* ------------------------------------------------------------------ aside */

function TopReaders({ readers, allTime, t }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {t('mrb.disc.topReaders')}{allTime ? ' · ' + t('mrb.disc.allTime') : ''}
        </h3>
        <span style={{ fontSize: 12, color: C.dim }}>{t('mrb.disc.pagesLabel')}</span>
      </div>
      {readers.length === 0 && <span style={{ fontSize: 13, color: C.dim }}>{t('mrb.disc.noReaders')}</span>}
      {readers.map((r, i) => (
        <div key={r.user_id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px',
          borderRadius: 10, background: r.is_me ? C.tint : 'transparent',
        }}>
          <span style={{ width: 20, fontSize: 13, fontWeight: 800, color: C.deep, textAlign: 'center' }}>{i + 1}</span>
          <Avatar initials={r.initials} size={32} bg={C.deep} ring={false} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: C.dim }}>{[r.grade, r.branch].filter(Boolean).join(' · ')}</div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {r.pages.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChallengeTeaser({ ch, t, nav }) {
  const target = Math.max(1, (ch.book_count || 1) * 30);
  const pct = Math.min(100, (ch.points / target) * 100);
  const urgent = ch.state === 'active' && ch.days_left <= 7;
  return (
    <div style={{
      background: C.tint, border: '1px solid ' + C.sky200, borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: urgent ? C.coralFg : C.deep, background: urgent ? C.coralBg : C.sky200,
          borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap',
        }}>
          {ch.state === 'active'
            ? t('mrb.disc.challengeDays', { n: Math.max(0, ch.days_left) })
            : ch.state === 'upcoming' ? t('mrb.ch.startsOn', { date: new Date(ch.starts_at).toLocaleDateString() })
            : t('mrb.ch.finished')}
        </span>
      </div>
      <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.deep }}>{ch.title}</h3>
      <p style={{ margin: 0, fontSize: 14, color: C.slate, lineHeight: 1.5 }}>
        {t('mrb.disc.challengeBlurb', { n: ch.points })}
      </p>
      <div style={{ height: 8, background: '#fff', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: C.brand, borderRadius: 999 }} />
      </div>
      <button onClick={() => nav('/app/challenges')} style={{
        alignSelf: 'flex-start', background: C.brand, color: '#fff', border: 0,
        borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>{t('mrb.disc.openChallenges')} →</button>
    </div>
  );
}

function greeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t('mrb.disc.morning');
  if (h < 18) return t('mrb.disc.afternoon');
  return t('mrb.disc.evening');
}
