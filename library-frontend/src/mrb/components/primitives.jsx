// Shared visual primitives for myredbookshelf, matching the design handoff.
// Each one is small and dumb: the screens compose them.

import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, radius, shadow, font, genreColors, cefrColors, coverColors } from '../theme';

/* ------------------------------------------------------------------ logo */

// The wordmark: my**red**bookshelf.com, Source Serif 4 700 20px.
export function Wordmark({ size = 20 }) {
  return (
    <span style={{
      fontFamily: font.display, fontWeight: 700, fontSize: size,
      color: slate.text, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
    }}>
      my<span style={{ color: brand.wordmarkRed }}>red</span>bookshelf
      <span style={{ color: slate.muted, fontWeight: 600, fontSize: size * 0.75 }}>.com</span>
    </span>
  );
}

// The mark is built from CSS shapes, as in Logo.dc.html: three book spines on a
// shelf, the rightmost tilted and red. Sized proportionally from `size` so it
// stays correct at 24px and 36px alike.
export function LogoMark({ size = 36 }) {
  const u = size / 36;
  return (
    <span style={{
      width: size, height: size, borderRadius: 10 * u, background: brand.primary,
      position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'block',
    }}>
      <span style={{ position: 'absolute', left: 5.76 * u, right: 5.76 * u, bottom: 7.92 * u, height: 1.8 * u, background: '#fff', borderRadius: 1 * u }} />
      <span style={{ position: 'absolute', left: 7.92 * u, bottom: 9.72 * u, width: 4.68 * u, height: 15.12 * u, background: brand.tint200, borderRadius: 1.5 * u }} />
      <span style={{ position: 'absolute', left: 14.04 * u, bottom: 9.72 * u, width: 4.68 * u, height: 18.72 * u, background: '#fff', borderRadius: 1.5 * u }} />
      <span style={{
        position: 'absolute', left: 20.16 * u, bottom: 9.72 * u, width: 5.04 * u, height: 16.56 * u,
        background: brand.red, borderRadius: 1.5 * u, transform: 'rotate(16deg)', transformOrigin: 'bottom right',
      }} />
    </span>
  );
}

/* ----------------------------------------------------------------- chips */

export function CefrBadge({ level, size = 11 }) {
  if (!level) return null;
  const [bg, fg] = cefrColors(level);
  return (
    <span style={{
      background: bg, color: fg, fontSize: size, fontWeight: 800,
      padding: '3px 7px', borderRadius: 6, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>{level}</span>
  );
}

export function GenreChip({ genre, dotOnly = false }) {
  if (!genre) return null;
  const [dot, bg, fg] = genreColors(genre);
  if (dotOnly) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: slate.body }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        {genre}
      </span>
    );
  }
  return (
    <span style={{
      background: bg, color: fg, fontSize: 11, fontWeight: 700,
      padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{genre}</span>
  );
}

/* ----------------------------------------------------------------- stars */

// Half-star rating: two stacked "★★★★★" layers, the top one clipped to
// rating/5 of the width. Exactly the technique the handoff specifies.
export function Stars({ value = 0, size = 13 }) {
  const pct = Math.max(0, Math.min(5, Number(value) || 0)) / 5 * 100;
  return (
    <span style={{ position: 'relative', display: 'inline-block', lineHeight: 1, fontSize: size, letterSpacing: '1px', flexShrink: 0 }}>
      <span style={{ color: slate.border2 }}>★★★★★</span>
      <span style={{
        position: 'absolute', left: 0, top: 0, width: pct + '%',
        overflow: 'hidden', whiteSpace: 'nowrap', color: brand.primary,
      }}>★★★★★</span>
    </span>
  );
}

// Ratings do not exist until the social layer is built. Saying so is better
// than rendering an empty five stars, which reads as "rated zero".
export function RatingLine({ rating, count, size = 13 }) {
  const { t } = useTranslation();
  if (rating == null) {
    return <span style={{ fontSize: 12, color: slate.muted }}>{t('mrb.noRatingsTitle')}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Stars value={rating} size={size} />
      <span style={{ fontSize: 12, fontWeight: 700, color: slate.strong }}>{Number(rating).toFixed(1)}</span>
      {count ? <span style={{ fontSize: 12, color: slate.muted }}>· {count}</span> : null}
    </span>
  );
}

/* ----------------------------------------------------------------- cover */

// A book cover. Real cover images win; otherwise the typographic placeholder
// from the prototype — a coloured block with the title, author at the foot,
// and a lighter spine down the left edge.
export function BookCover({ title, author, src, width = '100%', ratio = 1.5, radiusPx = 8, fontScale = 1 }) {
  const [bg, fg] = coverColors(title);
  const common = {
    width, aspectRatio: `1 / ${ratio}`, borderRadius: radiusPx,
    boxShadow: `${shadow.cover}, inset 4px 0 0 rgba(255,255,255,.14)`,
    overflow: 'hidden', flexShrink: 0, display: 'block',
  };

  if (src) {
    return <img src={src} alt={title} style={{ ...common, objectFit: 'cover', background: slate.surface }} />;
  }

  return (
    <div style={{
      ...common, background: bg, color: fg, position: 'relative',
      padding: `${14 * fontScale}px ${12 * fontScale}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{
        fontFamily: font.display, fontWeight: 700, fontSize: 17 * fontScale,
        lineHeight: 1.18, letterSpacing: '-0.01em',
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{title}</div>
      {author ? (
        <div style={{
          fontSize: 9 * fontScale, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', opacity: 0.85,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{author}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------- availability pill */

// Availability as the design states it: sky when a copy is free, coral when
// every copy is on loan, slate when the library does not hold the book.
export function AvailabilityPill({ heldHere, availableCopies, copies, t }) {
  let bg = slate.surface, fg = slate.body, label = t('mrb.notHeld');
  if (heldHere && availableCopies > 0) {
    bg = brand.tint100; fg = brand.deep;
    label = t('mrb.availableN', { n: availableCopies, total: copies });
  } else if (heldHere) {
    bg = danger.tint; fg = danger.text;
    label = t('mrb.allOnLoan');
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, color: fg,
      fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', opacity: 0.8 }} />
      {label}
    </span>
  );
}

/* --------------------------------------------------------------- buttons */

export function Button({ kind = 'primary', children, style, ...rest }) {
  const kinds = {
    primary: { background: brand.primary, color: '#fff', border: '1px solid ' + brand.primary },
    secondary: { background: '#fff', color: slate.strong, border: '1px solid ' + slate.border },
    soft: { background: brand.tint100, color: brand.deep, border: '1px solid transparent' },
    ghost: { background: 'transparent', color: slate.body, border: '1px solid transparent' },
  };
  return (
    <button
      {...rest}
      style={{
        ...kinds[kind], padding: '9px 14px', borderRadius: radius.button,
        fontSize: 13, fontWeight: 700, cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.55 : 1, fontFamily: font.ui,
        // No fixed widths anywhere: AZ and TR labels run 35–50% longer than EN.
        whiteSpace: 'nowrap', ...style,
      }}
    >{children}</button>
  );
}

export function Card({ children, style, padding = 24 }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + slate.border,
      borderRadius: radius.card, boxShadow: shadow.card, padding, ...style,
    }}>{children}</div>
  );
}

export function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>{children}</h2>
      {sub ? <div style={{ fontSize: 13, color: slate.dim, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- toast */

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: slate.text, color: '#fff', padding: '11px 18px', borderRadius: 12,
      fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: shadow.modal,
    }}>{message}</div>
  );
}
