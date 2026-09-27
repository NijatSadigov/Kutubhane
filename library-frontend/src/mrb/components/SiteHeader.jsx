// The site header, from the prototype's `isApp` block (line 23).
//
// The design uses **one** header for signed-in and logged-out visitors: same
// logo, same nav, same search with its quick filters. Only the tail differs —
// a streak pill and avatar for a member, "Log in / Join" for a guest. The
// landing page used to carry a second, search-less header of its own, which is
// why the guest view did not match the prototype.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api, { API_ORIGIN, assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, font, layout, shadow } from '../theme';
import { LogoMark, Wordmark, BookCover } from './primitives';

// Guests must not send the auth interceptor's Authorization header.
const pub = axios.create({ baseURL: API_ORIGIN + '/api' });

const QUICK_FILTERS = ['title', 'author', 'genre', 'cefr'];

// The member nav is the app; the guest nav is the design's public one. Both
// end at the same places — a guest may browse the catalogue and read reviews.
const MEMBER_NAV = [
  { key: 'discover', path: '/app', labelKey: 'mrb.nav.discover' },
  { key: 'catalogue', path: '/app/catalogue', labelKey: 'mrb.nav.catalogue' },
  { key: 'challenges', path: '/app/challenges', labelKey: 'mrb.nav.challenges' },
  { key: 'shelf', path: '/app/shelf', labelKey: 'mrb.nav.shelf' },
];

export default function SiteHeader({ guest = false, tail = null, schoolPill = null, onNavigateHome }) {
  const { t, lang, setLang } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();

  const [q, setQ] = useState('');
  const [field, setField] = useState('title');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Typing shows up to 6 matches. Debounced so a fast typist does not fire a
  // request per keystroke.
  useEffect(() => {
    const term = q.trim();
    const id = setTimeout(async () => {
      if (term.length < 2) { setHits([]); setOpen(false); return; }
      try {
        const res = guest
          ? await pub.get('/public/catalog', { params: { q: term } })
          : await api.get('/catalog/browse', { params: { scope: 'library', q: term } });
        setHits((res.data.items || []).slice(0, 6));
        setOpen(true);
      } catch { setHits([]); }
    }, 220);
    return () => clearTimeout(id);
  }, [q, guest]);

  const catalogue = guest ? '/catalogue' : '/app/catalogue';
  const bookPath = (id) => (guest ? `/book/${id}` : `/app/book/${id}`);

  const goSearch = () => {
    setOpen(false);
    nav(`${catalogue}?q=${encodeURIComponent(q)}&field=${field}`);
  };

  const toSection = (id) => () => {
    if (loc.pathname !== '/') { nav('/'); setTimeout(() => scrollTo(id), 80); return; }
    scrollTo(id);
  };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const guestNav = [
    { key: 'explore', labelKey: 'mrb.land.nav.explore', onClick: () => nav(catalogue) },
    { key: 'challenges', labelKey: 'mrb.nav.challenges', onClick: toSection('open-challenge') },
    { key: 'clubs', labelKey: 'mrb.land.nav.clubs', onClick: toSection('reading-together') },
    { key: 'places', labelKey: 'mrb.land.nav.places', onClick: toSection('places') },
    { key: 'schools', labelKey: 'mrb.land.nav.forSchools', onClick: toSection('for-schools') },
  ];

  const activeKey = loc.pathname === '/app' ? 'discover'
    : MEMBER_NAV.find((n) => n.path !== '/app' && loc.pathname.startsWith(n.path))?.key
    || (loc.pathname.startsWith('/app/book') ? 'catalogue' : '');

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid ' + slate.border,
    }}>
      <div className="mrb-header-inner" style={{
        maxWidth: layout.maxWidth, margin: '0 auto',
        padding: '12px var(--mrb-gutter)',
        display: 'flex', alignItems: 'center', gap: '12px 24px', flexWrap: 'wrap',
      }}>
        <button
          onClick={onNavigateHome || (() => nav(guest ? '/' : '/app'))}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, background: 'none',
            border: 0, padding: 0, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <LogoMark size={36} />
          <span className="mrb-wordmark"><Wordmark /></span>
        </button>

        {schoolPill}

        <nav className="mrb-nav" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(guest ? guestNav : MEMBER_NAV).map((n) => {
            const active = !guest && activeKey === n.key;
            return (
              <button
                key={n.key} className="mrb-tap"
                onClick={n.onClick || (() => nav(n.path))}
                style={{
                  background: active ? brand.tint100 : 'transparent',
                  color: active ? brand.deep : slate.body,
                  border: 0, padding: '8px 14px', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: font.ui,
                }}
              >{t(n.labelKey)}</button>
            );
          })}
        </nav>

        {/* search */}
        <div ref={boxRef} className="mrb-header-search"
          style={{ flex: '1 1 420px', minWidth: 240, position: 'relative', order: 3 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, background: slate.surface,
            border: '1px solid ' + slate.border, borderRadius: 12, padding: '5px 5px 5px 14px',
          }}>
            <span style={{ color: slate.dim, fontSize: 15 }}>⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goSearch(); }}
              onFocus={() => hits.length && setOpen(true)}
              placeholder={t('mrb.searchPlaceholder')}
              style={{
                flex: 1, minWidth: 60, border: 0, background: 'transparent',
                outline: 'none', fontSize: 14, color: slate.text, padding: '6px 0', fontFamily: font.ui,
              }}
            />
            <div className="mrb-quickfilters" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {QUICK_FILTERS.map((f) => (
                <button key={f} onClick={() => setField(f)} style={{
                  background: field === f ? '#fff' : 'transparent',
                  color: field === f ? brand.deep : slate.dim,
                  border: field === f ? '1px solid ' + slate.border : '1px solid transparent',
                  padding: '5px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: font.ui, whiteSpace: 'nowrap',
                }}>{t('mrb.field.' + f)}</button>
              ))}
            </div>
          </div>

          {open && hits.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#fff', border: '1px solid ' + slate.border, borderRadius: 12,
              boxShadow: shadow.card, overflow: 'hidden', zIndex: 40,
            }}>
              {hits.map((h) => (
                <button key={h.edition_id} onClick={() => { setOpen(false); nav(bookPath(h.edition_id)); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    background: 'none', border: 0, borderBottom: '1px solid ' + slate.border,
                    padding: '9px 12px', cursor: 'pointer', fontFamily: font.ui,
                  }}>
                  <div style={{ width: 28, flexShrink: 0 }}>
                    <BookCover title={h.title} src={h.cover_url ? assetUrl(h.cover_url) : ''} radiusPx={4} fontScale={0.4} />
                  </div>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: slate.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: slate.muted }}>{h.author || '—'}</span>
                  </span>
                </button>
              ))}
              <button onClick={goSearch} style={{
                display: 'block', width: '100%', textAlign: 'left', background: brand.tint50,
                border: 0, padding: '10px 12px', fontSize: 12, fontWeight: 700,
                color: brand.deep, cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.seeAllResults')} →</button>
            </div>
          )}
        </div>

        {/* language */}
        <div className="mrb-header-lang" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {['az', 'tr', 'en'].map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{
              background: lang === l ? brand.deep : 'transparent',
              color: lang === l ? '#fff' : slate.dim,
              border: 0, padding: '5px 9px', borderRadius: 7,
              fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: font.ui,
            }}>{l.toUpperCase()}</button>
          ))}
        </div>

        <span className="mrb-header-tail" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {tail}
        </span>
      </div>
    </header>
  );
}

// The guest tail: log in, or join with a school code. There is no individual
// sign-up — every reader comes in through their school.
export function GuestTail() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <button onClick={() => nav('/login')} className="mrb-tap" style={{
        background: '#fff', color: brand.deep, border: '1px solid ' + brand.tint200,
        borderRadius: 10, padding: '8px 14px', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui,
      }}>{t('mrb.land.login')}</button>
      <button onClick={() => nav('/register')} className="mrb-tap" style={{
        background: brand.primary, color: '#fff', border: 0,
        borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui,
      }}>
        <span className="mrb-long">{t('mrb.land.joinWithCode')}</span>
        <span className="mrb-short">{t('mrb.land.join')}</span>
      </button>
    </div>
  );
}
