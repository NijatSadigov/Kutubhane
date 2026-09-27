// 00 Landing — the guest home, and the site's main page.
//
// Hero with the shelf-of-covers visual and floating diary/challenge cards,
// "What the community is reading" (real books from this library), how it
// works, fresh reviews, open challenge + book clubs, the For schools band,
// libraries & bookstores coming soon, and the footer.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ORIGIN, assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, radius, shadow, font, layout, coverColors, genreColors } from '../theme';
import { LogoMark, Wordmark, BookCover, CefrBadge, Button } from '../components/primitives';

// The landing page is public, so it must not send the auth interceptor's
// Authorization header or rely on a session.
const pub = axios.create({ baseURL: API_ORIGIN + '/api' });

export default function Landing() {
  const { t, lang, setLang } = useTranslation();
  const nav = useNavigate();
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    pub.get('/public/books', { params: { limit: 8 } }).then((r) => setBooks(r.data || [])).catch(() => {});
    pub.get('/public/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font.ui, color: slate.text }}>
      {/* ------------------------------------------------- guest header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid ' + slate.border,
      }}>
        <div style={{
          maxWidth: layout.maxWidth, margin: '0 auto', padding: '12px 40px',
          display: 'flex', alignItems: 'center', gap: '12px 24px', flexWrap: 'wrap',
        }}>
          <button onClick={() => nav('/')} style={{
            display: 'flex', alignItems: 'center', gap: 10, background: 'none',
            border: 0, padding: 0, cursor: 'pointer', flexShrink: 0,
          }}>
            <LogoMark size={36} />
            <Wordmark />
          </button>

          <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: '1 1 auto' }}>
            {[
              ['mrb.land.nav.explore', () => nav('/login')],
              ['mrb.nav.challenges', () => nav('/login')],
              ['mrb.land.nav.clubs', () => nav('/login')],
              ['mrb.land.nav.places', () => nav('/login')],
              ['mrb.land.nav.forSchools', () => document.getElementById('for-schools')?.scrollIntoView({ behavior: 'smooth' })],
            ].map(([k, onClick]) => (
              <button key={k} onClick={onClick} style={{
                background: 'transparent', color: slate.body, border: 0,
                padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui,
              }}>{t(k)}</button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {['az', 'tr', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? brand.deep : 'transparent',
                color: lang === l ? '#fff' : slate.dim,
                border: 0, padding: '5px 9px', borderRadius: 7,
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: font.ui,
              }}>{l.toUpperCase()}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => nav('/login')} style={{
              background: '#fff', color: brand.deep, border: '1px solid ' + brand.tint200,
              borderRadius: 10, padding: '8px 14px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui,
            }}>{t('mrb.land.login')}</button>
            <button onClick={() => nav('/register')} style={{
              background: brand.primary, color: '#fff', border: 0,
              borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui,
            }}>{t('mrb.land.joinFree')}</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: layout.maxWidth, margin: '0 auto', padding: '0 40px' }}>
        {/* --------------------------------------------------------- hero */}
        <section style={{
          display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap',
          padding: '64px 0 56px',
        }}>
          <div style={{ flex: '1 1 460px', minWidth: 300 }}>
            <span style={{
              display: 'inline-block', background: brand.tint50, color: brand.deep,
              border: '1px solid ' + brand.tint200, borderRadius: 999,
              padding: '5px 13px', fontSize: 12, fontWeight: 700, marginBottom: 20,
            }}>{t('mrb.land.eyebrow')}</span>

            <h1 style={{
              margin: 0, fontFamily: font.display, fontSize: 66, fontWeight: 700,
              lineHeight: 1.02, letterSpacing: '-0.035em', textWrap: 'balance',
            }}>
              {t('mrb.land.heroA')}{' '}
              <span style={{ color: brand.wordmarkRed }}>{t('mrb.land.heroHighlight')}</span>{t('mrb.land.heroB')}
            </h1>

            <p style={{
              fontSize: 17, lineHeight: 1.6, color: slate.body,
              margin: '20px 0 28px', maxWidth: 520,
            }}>{t('mrb.land.heroBody')}</p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => nav('/register')} style={{
                background: brand.primary, color: '#fff', border: 0, borderRadius: 12,
                padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.land.joinFree')}</button>
              <button onClick={() => nav('/login')} style={{
                background: '#fff', color: brand.deep, border: '1px solid ' + brand.tint200,
                borderRadius: 12, padding: '12px 22px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.land.exploreBooks')}</button>
            </div>

            <div style={{ fontSize: 13, color: slate.dim, marginTop: 18 }}>
              {t('mrb.land.studentPrompt')}{' '}
              <button onClick={() => nav('/register')} style={{
                background: 'none', border: 0, padding: 0, color: brand.deep,
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.land.schoolCode')} →</button>
            </div>
          </div>

          <HeroShelf books={books} t={t} />
        </section>

        {/* ------------------------------------ what the community reads */}
        <section style={{ padding: '44px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap', marginBottom: 22,
          }}>
            <h2 style={{ margin: 0, fontFamily: font.display, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {t('mrb.land.communityReading')}
            </h2>
            <button onClick={() => nav('/login')} style={{
              background: 'none', border: 0, color: brand.deep, fontSize: 14,
              fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
            }}>{t('mrb.land.browseAll')} →</button>
          </div>

          {books.length === 0 ? (
            <div style={{ color: slate.muted, fontSize: 14 }}>{t('common.loading')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 22 }}>
              {books.map((b) => (
                <button key={b.edition_id} onClick={() => nav('/login')} style={{
                  background: 'none', border: 0, padding: 0, cursor: 'pointer',
                  textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 9,
                }}>
                  <div style={{ position: 'relative' }}>
                    <BookCover title={b.title} author={b.author} src={b.cover_url ? assetUrl(b.cover_url) : ''} />
                    {b.cefr && <span style={{ position: 'absolute', top: 8, right: 8 }}><CefrBadge level={b.cefr} /></span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: slate.dim, marginTop: -4 }}>{b.author || '—'}</div>
                  {b.genre && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: slate.body }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: genreColors(b.genre)[0] }} />
                      {b.genre}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------ how it works */}
        <section style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20, padding: '44px 0',
        }}>
          {[
            ['1', 'mrb.land.how1', 'mrb.land.how1b'],
            ['2', 'mrb.land.how2', 'mrb.land.how2b'],
            ['3', 'mrb.land.how3', 'mrb.land.how3b'],
          ].map(([n, title, body]) => (
            <div key={n} style={{
              background: '#fff', border: '1px solid ' + slate.border,
              borderRadius: radius.hero, boxShadow: shadow.card, padding: 26,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '50%', background: brand.tint100,
                color: brand.deep, fontSize: 14, fontWeight: 800, marginBottom: 14,
              }}>{n}</span>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>{t(title)}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: slate.body }}>{t(body)}</p>
            </div>
          ))}
        </section>

        {/* ----------------------------------------- fresh from community */}
        <section style={{ padding: '44px 0' }}>
          <h2 style={{ margin: '0 0 6px', fontFamily: font.display, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('mrb.land.fresh')}
          </h2>
          <div style={{ fontSize: 13, color: slate.dim, marginBottom: 20, maxWidth: 620, lineHeight: 1.6 }}>
            {t('mrb.land.freshSub')}
          </div>
          <div style={{
            background: brand.tint50, border: '1px dashed ' + brand.tint200,
            borderRadius: radius.card, padding: 28, fontSize: 14, color: brand.deep, lineHeight: 1.7,
          }}>{t('mrb.land.freshEmpty')}</div>
        </section>

        {/* -------------------------------------------------- for schools */}
        <section id="for-schools" style={{
          background: brand.deep, color: '#fff', borderRadius: 24,
          padding: 44, margin: '44px 0', display: 'flex', gap: 40, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 380px', minWidth: 280 }}>
            <span style={{
              display: 'inline-block', background: brand.tint200, color: brand.deep,
              borderRadius: 999, padding: '4px 11px', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16,
            }}>{t('mrb.land.nav.forSchools')}</span>
            <h2 style={{
              margin: '0 0 14px', fontFamily: font.display, fontSize: 36,
              fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.025em',
            }}>{t('mrb.land.schoolsTitle')}</h2>
            <p style={{ margin: '0 0 22px', fontSize: 15, lineHeight: 1.65, color: brand.tint200 }}>
              {t('mrb.land.schoolsBody')}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => nav('/login')} style={{
                background: '#fff', color: brand.deep, border: 0, borderRadius: 10,
                padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.land.bookDemo')}</button>
              <button onClick={() => nav('/login')} style={{
                background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.4)',
                borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.land.staffAccess')}</button>
            </div>
          </div>

          <div style={{
            flex: '1 1 360px', minWidth: 260, display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14,
          }}>
            {[
              ['mrb.land.f1', 'mrb.land.f1b'],
              ['mrb.land.f2', 'mrb.land.f2b'],
              ['mrb.land.f3', 'mrb.land.f3b'],
              ['mrb.land.f4', 'mrb.land.f4b'],
            ].map(([a, b]) => (
              <div key={a} style={{
                background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{t(a)}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: brand.tint200 }}>{t(b)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------- libraries & stores */}
        <section style={{ padding: '30px 0 50px' }}>
          <div style={{
            border: '1px solid ' + slate.border, borderRadius: radius.card,
            padding: 28, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 320px' }}>
              <div style={{
                display: 'inline-block', background: slate.surface, color: slate.body,
                borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
              }}>{t('mrb.land.comingSoon')}</div>
              <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                {t('mrb.land.placesTitle')}
              </div>
              <div style={{ fontSize: 14, color: slate.body, lineHeight: 1.6 }}>{t('mrb.land.placesBody')}</div>
            </div>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------- footer */}
      <footer style={{ borderTop: '1px solid ' + slate.border, background: slate.bg, marginTop: 20 }}>
        <div style={{
          maxWidth: layout.maxWidth, margin: '0 auto', padding: '30px 40px',
          display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoMark size={28} />
            <Wordmark size={16} />
          </div>
          {stats?.totals && (
            <div style={{ fontSize: 13, color: slate.dim }}>
              {t('mrb.land.footerStats', {
                books: stats.totals.books, pages: (stats.totals.pages_read || 0).toLocaleString(),
              })}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

// The hero visual: a row of leaning covers with a floating diary card and an
// open-challenge card, as in the prototype. The covers are real books when the
// API has returned them.
function HeroShelf({ books, t }) {
  const shelf = books.slice(0, 6);
  return (
    <div style={{ flex: '1 1 420px', minWidth: 300, position: 'relative', paddingBottom: 30 }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'center',
        padding: '28px 18px 22px', background: brand.tint50,
        border: '1px solid ' + brand.tint200, borderRadius: 22, minHeight: 240,
      }}>
        {shelf.length === 0 && <div style={{ color: slate.muted, fontSize: 13 }}>…</div>}
        {shelf.map((b, i) => {
          const [bg, fg] = coverColors(b.title);
          const h = 150 + ((i * 37) % 46);
          return (
            <div key={b.edition_id} style={{
              width: 46, height: h, borderRadius: 5, background: bg, color: fg,
              boxShadow: shadow.cover, display: 'flex', alignItems: 'flex-end',
              padding: 7, transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`, flexShrink: 0,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, lineHeight: 1.2, writingMode: 'vertical-rl',
                transform: 'rotate(180deg)', maxHeight: h - 18, overflow: 'hidden',
              }}>{b.title}</span>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', left: 0, bottom: 0, background: '#fff',
        border: '1px solid ' + slate.border, borderRadius: 14, boxShadow: shadow.card,
        padding: '12px 14px', maxWidth: 250,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', background: '#0F766E', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
          }}>FN</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{t('mrb.land.diaryCard')}</span>
        </div>
        <div style={{ height: 5, background: slate.surface, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: '67%', height: '100%', background: brand.primary }} />
        </div>
      </div>

      <div style={{
        position: 'absolute', right: 0, top: -10, background: danger.tint,
        border: '1px solid ' + danger.border, borderRadius: 12, padding: '9px 13px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: danger.text,
        }}>{t('mrb.land.openChallenge')}</div>
      </div>
    </div>
  );
}
