// 00 Public Landing — the guest view.
//
// Transcribed from the prototype's `isLanding` block with the guest tail of
// the shared header (line 71). Two things had been wrong here: the page
// carried its own header with no search, where the design reuses the app's;
// and two sections were empty placeholders where the design has content.
//
// The product is school-only — there is no individual sign-up — so the copy
// leads with the school code rather than "join free", and the two sections
// that were about adult readers and public book clubs are now about the
// partner schools: reviews written by school readers (shown as initials,
// because they are written by minors) and the challenges those schools are
// reading together.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ORIGIN, assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { coverColors, genreColors } from '../theme';
import { Wordmark } from '../components/primitives';
import SiteHeader, { GuestTail } from '../components/SiteHeader';
import { fmtDate, fmtNum } from '../../i18n/dates';
import '../responsive.css';

// The landing page is public, so it must not send the auth interceptor's
// Authorization header or rely on a session.
const pub = axios.create({ baseURL: API_ORIGIN + '/api' });

const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F8FAFC', surface: '#F1F5F9',
  tint: '#F0F9FF', sky100: '#E0F2FE', sky200: '#BAE6FD', sky300: '#7DD3FC',
  deep: '#075985', brand: '#1B9DD9', brandHi: '#1580B5', red: '#DC3B42',
  roseBg: '#FFE4E6', roseFg: '#9F1239', warnBg: '#FEF3C7', warnFg: '#92400E',
  tealBg: '#CCFBF1', tealFg: '#115E59', violetBg: '#EDE9FE', violetFg: '#5B21B6',
};
const SERIF = "'Source Serif 4', Georgia, serif";
const MAX = 1360;

// Every band is the same 1360px column; only the vertical padding differs.
const band = (top, bottom) => ({
  maxWidth: MAX, width: '100%', margin: '0 auto',
  padding: `${top}px var(--mrb-gutter) ${bottom}px`,
});

export default function Landing() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    pub.get('/public/books', { params: { limit: 10 } }).then((r) => setBooks(r.data || [])).catch(() => {});
    pub.get('/public/stats').then((r) => setStats(r.data)).catch(() => {});
    pub.get('/public/challenge')
      .then((r) => setChallenge(r.data?.found ? r.data : null)).catch(() => {});
    pub.get('/public/challenges').then((r) => setChallenges(r.data || [])).catch(() => {});
    pub.get('/public/reviews', { params: { limit: 3 } })
      .then((r) => setReviews(r.data || [])).catch(() => {});
  }, []);

  const toSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Noto Sans', system-ui, sans-serif", color: C.ink }}>
      <SiteHeader guest tail={<GuestTail />} />

      <main style={{ display: 'flex', flexDirection: 'column' }}>
        {/* ------------------------------------------------------- hero */}
        <section className="mrb-hero" style={{
          ...band(72, 56), display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center',
        }}>
          <div style={{ flex: '1 1 460px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <span style={{
              alignSelf: 'flex-start', background: C.sky100, color: C.deep, borderRadius: 999,
              padding: '6px 14px', fontSize: 13, fontWeight: 700,
            }}>{t('mrb.land.eyebrow')}</span>

            <h1 className="mrb-h-hero" style={{
              margin: 0, fontFamily: SERIF, fontSize: 66, fontWeight: 700,
              lineHeight: 1.02, letterSpacing: '-0.035em', textWrap: 'balance',
            }}>
              {t('mrb.land.heroA')}{' '}
              <span style={{ color: C.red }}>{t('mrb.land.heroHighlight')}</span>{t('mrb.land.heroB')}
            </h1>

            <p style={{
              margin: 0, fontSize: 19, lineHeight: 1.55, color: C.body,
              maxWidth: 560, textWrap: 'pretty',
            }}>{t('mrb.land.heroBody')}</p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => nav('/register')} className="mrb-tap" style={{
                background: C.brand, color: '#fff', border: 0, borderRadius: 12,
                padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.land.joinWithCode')}</button>
              <button onClick={() => nav('/catalogue')} className="mrb-tap" style={{
                background: '#fff', color: C.deep, border: '1px solid ' + C.sky200,
                borderRadius: 12, padding: '12px 22px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.land.exploreBooks')}</button>
            </div>

            <div style={{ fontSize: 14, color: C.body }}>
              {t('mrb.land.notAtSchool')}{' '}
              <button onClick={() => toSection('for-schools')} style={{
                background: 'none', border: 0, padding: 0, color: C.deep,
                fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.land.howSchoolsJoin')} →</button>
            </div>
          </div>

          <HeroShelf books={books} challenge={challenge} t={t} />
        </section>

        {/* -------------------------------- what the community is reading */}
        <section style={{ ...band(24, 48), display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: 16, flexWrap: 'wrap',
          }}>
            <h2 className="mrb-h-section" style={{
              margin: 0, fontFamily: SERIF, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em',
            }}>{t('mrb.land.communityReading')}</h2>
            <button onClick={() => nav('/catalogue')} style={{
              background: 'none', border: 0, padding: 0, color: C.deep,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('mrb.land.browseAll')} →</button>
          </div>

          {books.length === 0 ? (
            <div style={{ color: C.mute, fontSize: 14 }}>{t('common.loading')}</div>
          ) : (
            <div style={{ display: 'flex', gap: 20, overflowX: 'auto', padding: '4px 2px 12px' }}>
              {books.map((b) => {
                const [bg, fg] = coverColors(b.title);
                const [gDot, , gFg] = genreColors(b.genre);
                const starW = ((Math.max(0, Math.min(5, Number(b.rating) || 0)) / 5) * 100) + '%';
                return (
                  <button key={b.edition_id} onClick={() => nav(`/book/${b.edition_id}`)} style={{
                    flex: '0 0 156px', display: 'flex', flexDirection: 'column', gap: 8,
                    background: 'none', border: 0, padding: 0, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}>
                    {b.cover_url ? (
                      <img src={assetUrl(b.cover_url)} alt={b.title} style={{
                        width: '100%', aspectRatio: '2/3', borderRadius: 8, objectFit: 'cover', display: 'block',
                        boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
                      }} />
                    ) : (
                      <div style={{
                        width: '100%', aspectRatio: '2/3', background: bg, color: fg, borderRadius: 8,
                        padding: '14px 12px', display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.14), 0 6px 16px rgba(15,23,42,0.14)',
                      }}>
                        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, lineHeight: 1.1 }}>
                          {b.title}
                        </div>
                        <div style={{
                          fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85,
                        }}>{b.author}</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.body }}>
                      {b.rating == null ? (
                        <span style={{ color: C.mute }}>{t('mrb.noRatingsTitle')}</span>
                      ) : (
                        <>
                          <Stars width={starW} />
                          <strong style={{ color: C.ink }}>{Number(b.rating).toFixed(1)}</strong>
                        </>
                      )}
                    </div>

                    {b.genre && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, fontWeight: 600, color: gFg,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: gDot }} />
                        {b.genre}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ------------------------------------------------ how it works */}
        <section style={{
          ...band(24, 56), display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20,
        }}>
          {[
            ['1', C.sky100, C.deep, 'mrb.land.how1', 'mrb.land.how1b'],
            ['2', C.roseBg, C.roseFg, 'mrb.land.how2', 'mrb.land.how2b'],
            ['3', C.warnBg, C.warnFg, 'mrb.land.how3', 'mrb.land.how3b'],
          ].map(([n, bg, fg, title, body]) => (
            <div key={n} style={{
              background: '#fff', border: '1px solid ' + C.line, borderRadius: 18, padding: 26,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, background: bg, color: fg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SERIF, fontSize: 20, fontWeight: 700,
              }}>{n}</span>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{t(title)}</h3>
              <p style={{ margin: 0, fontSize: 15, color: C.body, lineHeight: 1.55 }}>{t(body)}</p>
            </div>
          ))}
        </section>

        {/* ----------------------------------------- fresh from the schools */}
        <section style={{ ...band(24, 56), display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h2 className="mrb-h-section" style={{
              margin: 0, fontFamily: SERIF, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em',
            }}>{t('mrb.land.fresh')}</h2>
            <div style={{ fontSize: 14, color: C.dim, marginTop: 4, maxWidth: 720, lineHeight: 1.55 }}>
              {t('mrb.land.freshSub')}
            </div>
          </div>

          {reviews.length === 0 ? (
            <div style={{
              border: '1px dashed ' + C.sky200, background: C.tint, borderRadius: 16,
              padding: 28, fontSize: 14, color: C.body, lineHeight: 1.7,
            }}>{t('mrb.land.freshEmpty')}</div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16,
            }}>
              {reviews.map((r) => {
                const [bg] = coverColors(r.title || '');
                const starW = ((Math.max(0, Math.min(5, Number(r.rating) || 0)) / 5) * 100) + '%';
                return (
                  <button key={r.id} onClick={() => r.edition_id && nav(`/book/${r.edition_id}`)} style={{
                    background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
                    display: 'flex', gap: 16, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', color: C.ink,
                  }}>
                    {r.cover_url ? (
                      <img src={assetUrl(r.cover_url)} alt="" style={{
                        width: 56, height: 84, borderRadius: 4, objectFit: 'cover', flexShrink: 0,
                        boxShadow: '0 3px 8px rgba(15,23,42,0.15)',
                      }} />
                    ) : (
                      <span style={{
                        width: 56, height: 84, borderRadius: 4, background: bg, flexShrink: 0,
                        boxShadow: '0 3px 8px rgba(15,23,42,0.15)',
                      }} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                      <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700 }}>{r.title}</div>
                      <span style={{ alignSelf: 'flex-start' }}><Stars width={starW} size={14} /></span>
                      <p style={{
                        margin: 0, fontSize: 14, lineHeight: 1.55, color: C.slate, textWrap: 'pretty',
                      }}>{r.spoiler ? t('mrb.disc.spoilerBody') : r.text}</p>
                      <div style={{ fontSize: 12, color: C.dim }}>
                        <strong style={{ color: C.ink }}>{r.author_initials}</strong>
                        {' · '}{t('mrb.land.schoolReader')}{' · '}{fmtDate(r.created_at)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ------------------------------- open challenge + reading together */}
        <section style={{ ...band(24, 64), display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {challenge && (
            <div id="open-challenge" style={{
              flex: '1 1 380px', background: C.deep, color: '#fff', borderRadius: 20, padding: 28,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <span style={{
                alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: C.deep, background: C.sky200,
                borderRadius: 999, padding: '4px 10px',
              }}>{t('mrb.land.openToSchools')}</span>
              <div className="mrb-h-name" style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700 }}>
                {challenge.title}
              </div>
              {challenge.description && (
                <p style={{ margin: 0, fontSize: 15, color: C.sky100, lineHeight: 1.55 }}>
                  {challenge.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(challenge.covers || []).slice(0, 6).map((src, i) => {
                  const [bg] = coverColors(challenge.title + i);
                  return src ? (
                    <img key={i} src={assetUrl(src)} alt="" style={{
                      width: 34, height: 50, borderRadius: 3, objectFit: 'cover',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    }} />
                  ) : (
                    <span key={i} style={{
                      width: 34, height: 50, borderRadius: 3, background: bg,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    }} />
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: C.sky200 }}>
                {t('mrb.land.challengeMeta', {
                  n: challenge.participants, d: Math.max(0, challenge.days_left),
                })}
              </div>
              <button onClick={() => nav('/login')} className="mrb-tap" style={{
                marginTop: 'auto', alignSelf: 'flex-start', background: '#fff', color: C.deep,
                border: 0, borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.land.seeChallenge')} →</button>
            </div>
          )}

          {/* The design's book-clubs card. With no individual members there
              are no public clubs; a school's challenge is the same idea —
              a group reading the same books together — so that is what this
              lists, from real data. */}
          <div id="reading-together" style={{
            flex: '1 1 380px', background: '#fff', border: '1px solid ' + C.line,
            borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              gap: 12, flexWrap: 'wrap',
            }}>
              <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 700 }}>
                {t('mrb.land.readingTogether')}
              </h3>
              <button onClick={() => nav('/login')} style={{
                background: 'none', border: 0, padding: 0, color: C.deep,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.land.allChallenges')} →</button>
            </div>

            {challenges.length === 0 ? (
              <p style={{ margin: 0, fontSize: 15, color: C.body, lineHeight: 1.55 }}>
                {t('mrb.land.noChallenges')}
              </p>
            ) : challenges.map((ch, i) => {
              const [bg] = coverColors(ch.reading || ch.title);
              return (
                <button key={ch.id} onClick={() => nav('/login')} style={{
                  display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 0,
                  borderTop: i === 0 ? 0 : '1px solid ' + C.surface, padding: i === 0 ? 0 : '12px 0 0',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: C.ink,
                }}>
                  {ch.cover_url ? (
                    <img src={assetUrl(ch.cover_url)} alt="" style={{
                      width: 36, height: 54, borderRadius: 3, objectFit: 'cover', flexShrink: 0,
                    }} />
                  ) : (
                    <span style={{ width: 36, height: 54, borderRadius: 3, background: bg, flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{ch.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.dim }}>
                      {[
                        ch.school,
                        t('mrb.ch.nReaders', { n: ch.participants }),
                        ch.reading ? t('mrb.land.nowReading', { title: ch.reading }) : '',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span style={{
                    background: ch.upcoming ? C.warnBg : C.tealBg,
                    color: ch.upcoming ? C.warnFg : C.tealFg,
                    borderRadius: 999, padding: '3px 10px',
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{ch.upcoming ? t('mrb.ch.upcoming') : t('mrb.ch.running')}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* -------------------------------------------------- for schools */}
        <section id="for-schools" style={{ background: C.deep, color: '#fff' }}>
          <div style={{
            ...band(72, 72), display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center',
          }}>
            <div style={{ flex: '1 1 460px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <span style={{
                alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: C.deep, background: C.sky200,
                borderRadius: 999, padding: '4px 10px',
              }}>{t('mrb.land.nav.forSchools')}</span>
              <h2 className="mrb-h-panel" style={{
                margin: 0, fontFamily: SERIF, fontSize: 44, fontWeight: 700,
                lineHeight: 1.08, letterSpacing: '-0.02em',
              }}>{t('mrb.land.schoolsTitle')}</h2>
              <p style={{ margin: 0, fontSize: 17, color: C.sky100, lineHeight: 1.6, maxWidth: 560 }}>
                {t('mrb.land.schoolsBody')}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => nav('/login')} className="mrb-tap" style={{
                  background: '#fff', color: C.deep, border: 0, borderRadius: 12,
                  padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t('mrb.land.bookDemo')}</button>
                <button onClick={() => nav('/register')} className="mrb-tap" style={{
                  background: 'transparent', color: '#fff', border: '1px solid ' + C.sky300,
                  borderRadius: 12, padding: '12px 22px', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{t('mrb.land.staffAccess')}</button>
              </div>
            </div>

            <div style={{
              flex: '1 1 420px', display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12,
            }}>
              {[
                ['mrb.land.f1', 'mrb.land.f1b'],
                ['mrb.land.f2', 'mrb.land.f2b'],
                ['mrb.land.f3', 'mrb.land.f3b'],
                ['mrb.land.f4', 'mrb.land.f4b'],
              ].map(([a, b]) => (
                <div key={a} style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: 14, padding: 18,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{t(a)}</div>
                  <div style={{ fontSize: 13, color: C.sky200, marginTop: 4, lineHeight: 1.5 }}>{t(b)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- libraries & stores */}
        <section id="places" style={band(64, 64)}>
          <div style={{
            background: '#fff', border: '1px solid ' + C.line, borderRadius: 20, padding: 32,
            display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center',
          }}>
            <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{
                alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: C.warnFg, background: C.warnBg,
                borderRadius: 999, padding: '4px 10px',
              }}>{t('mrb.land.comingSoon')}</span>
              <h2 className="mrb-h-name" style={{
                margin: 0, fontFamily: SERIF, fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em',
              }}>{t('mrb.land.placesTitle')}</h2>
              <p style={{ margin: 0, fontSize: 16, color: C.body, lineHeight: 1.6 }}>
                {t('mrb.land.placesBody')}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  [t('mrb.land.chipPublicLib'), C.tealBg, C.tealFg],
                  [t('mrb.land.chipBookstores'), C.roseBg, C.roseFg],
                  [t('mrb.land.chipPrivateLib'), C.violetBg, C.violetFg],
                ].map(([label, bg, fg]) => (
                  <span key={label} style={{
                    background: bg, color: fg, borderRadius: 999, padding: '4px 12px',
                    fontSize: 12, fontWeight: 700,
                  }}>{label}</span>
                ))}
              </div>
            </div>

            {/* The design puts a "notify me" capture here. There is nowhere to
                store an address yet, so the card offers the partner route
                instead of a form that would throw the address away. */}
            <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                background: C.sky100, color: C.deep, borderRadius: 12, padding: '14px 16px',
                fontSize: 14, fontWeight: 600, lineHeight: 1.5,
              }}>{t('mrb.land.placesNote')}</div>
              <button onClick={() => toSection('for-schools')} style={{
                alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: C.deep,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.land.becomePartner')} →</button>
            </div>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------- footer */}
      <footer style={{ borderTop: '1px solid ' + C.line, background: '#fff' }}>
        <div style={{
          ...band(40, 96), display: 'flex', flexWrap: 'wrap',
          gap: 40, justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
            <Wordmark size={20} />
            <span style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>{t('mrb.land.footerTag')}</span>
            {stats?.totals && (
              <span style={{ fontSize: 13, color: C.mute }}>
                {t('mrb.land.footerStats', {
                  books: stats.totals.books,
                  pages: fmtNum(stats.totals.pages_read || 0),
                })}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', fontSize: 14 }}>
            <FootCol title={t('mrb.land.footReaders')} links={[
              [t('mrb.land.nav.explore'), () => nav('/catalogue')],
              [t('mrb.nav.challenges'), () => toSection('open-challenge')],
              [t('mrb.land.readingTogether'), () => toSection('reading-together')],
            ]} />
            <FootCol title={t('mrb.land.footSchools')} links={[
              [t('mrb.land.nav.forSchools'), () => toSection('for-schools')],
              [t('mrb.land.bookDemo'), () => nav('/login')],
              [t('mrb.land.privacyMinors'), () => toSection('for-schools')],
            ]} />
            <FootCol title={t('mrb.land.footCompany')} links={[
              [t('mrb.land.about'), () => toSection('for-schools')],
              [t('mrb.land.partners'), () => toSection('places')],
              [t('mrb.land.terms'), () => toSection('for-schools')],
            ]} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stars({ width, size = 13 }) {
  return (
    <span style={{
      position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1,
      letterSpacing: '1px', color: C.line2,
    }}>
      ★★★★★
      <span style={{
        position: 'absolute', left: 0, top: 0, overflow: 'hidden',
        whiteSpace: 'nowrap', color: C.brand, width,
      }}>★★★★★</span>
    </span>
  );
}

function FootCol({ title, links }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong>{title}</strong>
      {links.map(([label, onClick]) => (
        <button key={label} onClick={onClick} style={{
          background: 'none', border: 0, padding: 0, textAlign: 'left',
          color: C.deep, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}>{label}</button>
      ))}
    </div>
  );
}

// The hero visual: a shelf of leaning spines on a deep-blue rail, with the
// diary card floating at the top-left and the open challenge at the
// bottom-right. The spines are real books once the public API answers.
function HeroShelf({ books, challenge, t }) {
  const shelf = books.slice(0, 6);
  // The prototype staggers the spines; keeping the pattern fixed means a
  // given position always leans the same way rather than flickering.
  const HEIGHTS = ['86%', '100%', '78%', '94%', '70%', '88%'];
  const TILTS = ['-2deg', '0deg', '1.5deg', '-1deg', '2deg', '0deg'];

  return (
    <div className="mrb-hero-visual" style={{ flex: '1 1 440px', position: 'relative', minHeight: 440 }}>
      <div style={{
        position: 'absolute', left: '4%', right: '4%', bottom: 70, height: 300,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10,
      }}>
        {shelf.map((b, i) => {
          const [bg, fg] = coverColors(b.title);
          return (
            <div key={b.edition_id} style={{
              width: '15%', height: HEIGHTS[i % HEIGHTS.length], background: bg, color: fg,
              borderRadius: '6px 6px 3px 3px', padding: '12px 8px',
              display: 'flex', alignItems: 'flex-start',
              boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.15), 0 10px 20px rgba(15,23,42,0.18)',
              transform: `rotate(${TILTS[i % TILTS.length]})`, transformOrigin: 'bottom left',
              overflow: 'hidden',
            }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>
                {b.title}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 56, height: 14,
        background: C.deep, borderRadius: 4, boxShadow: '0 10px 24px rgba(7,89,133,0.25)',
      }} />

      <div style={{
        position: 'absolute', top: 0, left: 0, background: '#fff', border: '1px solid ' + C.line,
        borderRadius: 14, padding: '14px 16px', boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
        display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 250,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%', background: '#0F766E', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>FN</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t('mrb.land.diaryCard')}</span>
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>{t('mrb.land.heroCardSub')}</div>
        <div style={{ height: 6, background: C.sky100, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: '67%', height: '100%', background: C.brand }} />
        </div>
      </div>

      {challenge && (
        <div style={{
          position: 'absolute', right: 0, bottom: 0, background: C.deep, color: '#fff',
          borderRadius: 14, padding: '14px 16px', boxShadow: '0 12px 32px rgba(7,89,133,0.3)',
          display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 260,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: C.sky300,
          }}>{t('mrb.land.openChallenge')}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{challenge.title}</span>
          <span style={{ fontSize: 12, color: C.sky200 }}>
            {t('mrb.land.challengeMeta', {
              n: challenge.participants, d: Math.max(0, challenge.days_left),
            })}
          </span>
        </div>
      )}
    </div>
  );
}
