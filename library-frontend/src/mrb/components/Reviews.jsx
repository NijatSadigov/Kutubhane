// Reviews & discussion — the lower half of "03 Book Detail".
//
// Transcribed from the prototype: the rating card as an auto-fit grid with a
// 56px serif average over a 20px star row and 28/1fr/48 histogram rows on 10px
// bars; the composer on a #BAE6FD border with its 4px #F0F9FF halo, 26px
// half-star picker and #F8FAFC textarea; and the feed as 16px-radius articles
// with a 40px avatar, right-aligned 16px stars, the 135° hatched spoiler
// block, pill actions, and replies indented behind a 2px #E0F2FE rule.

import { useCallback, useEffect, useState } from 'react';
import { useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { useReaderApi } from '../guest';
import { fmtDate } from '../../i18n/dates';

const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F8FAFC', surface: '#F1F5F9',
  tint: '#F0F9FF', sky100: '#E0F2FE', sky200: '#BAE6FD', sky300: '#7DD3FC',
  deep: '#075985', brand: '#1B9DD9', brandHi: '#1580B5',
  likeBg: '#FFE4E6', likeFg: '#D93A41', flagHover: '#FFF1EE',
};
const SERIF = "'Source Serif 4', Georgia, serif";

// The histogram bars take a colour per row. The prototype leaves the value to
// the data; these are the five steps of the design's own sky ramp, darkest at
// 5★, so the shape of the distribution reads at a glance.
const BAR_COLORS = { 5: C.deep, 4: C.brand, 3: C.sky300, 2: C.sky200, 1: C.sky100 };

/* ------------------------------------------------------- half-star picker */

// Each star has a left and a right hit area, so a click lands on a half step.
function StarPicker({ value, onChange, size = 26 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div style={{ display: 'flex', gap: 2, marginLeft: 8 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = shown >= star ? '100%' : shown >= star - 0.5 ? '50%' : '0%';
        return (
          <span key={star} style={{
            position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1,
            color: C.line2, cursor: 'pointer',
          }}>
            ★
            <span style={{
              position: 'absolute', left: 0, top: 0, overflow: 'hidden',
              color: C.brand, width: fill, pointerEvents: 'none',
            }}>★</span>
            <button
              type="button" aria-label={`${star - 0.5}`}
              onMouseEnter={() => setHover(star - 0.5)} onClick={() => onChange(star - 0.5)}
              style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
            />
            <button
              type="button" aria-label={`${star}`}
              onMouseEnter={() => setHover(star)} onClick={() => onChange(star)}
              style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
            />
          </span>
        );
      })}
    </div>
  );
}

// Read-only half stars: two stacked rows, the top one clipped to rating/5.
function Stars({ value = 0, size = 16, spacing = 1 }) {
  const w = (Math.max(0, Math.min(5, Number(value) || 0)) / 5) * 100;
  return (
    <span style={{
      position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1,
      letterSpacing: spacing + 'px', color: C.line2, flexShrink: 0,
    }}>
      ★★★★★
      <span style={{
        position: 'absolute', left: 0, top: 0, overflow: 'hidden', whiteSpace: 'nowrap',
        color: C.brand, width: w + '%',
      }}>★★★★★</span>
    </span>
  );
}

function initialsOf(name) {
  return (name || '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase() || '·';
}

/* ---------------------------------------------------------------- section */

export default function Reviews({ workId, editionId, onRatingChange }) {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const { guest, http, reviews: reviewsUrl } = useReaderApi();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState({});

  const load = useCallback(async () => {
    if (!workId) return;
    try {
      const res = await http.get(reviewsUrl(workId));
      setData(res.data);
      if (onRatingChange) onRatingChange(res.data.rating, res.data.count);
      // Pre-fill the composer when the reader already reviewed this book.
      const mine = (res.data.reviews || []).find((r) => r.is_mine);
      if (mine) { setRating(mine.rating); setText(mine.text); setSpoiler(mine.spoiler); }
    } catch { /* the empty state covers it */ }
  }, [workId, onRatingChange, http, reviewsUrl]);

  useEffect(() => { load(); }, [load]);

  const say = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };

  const post = async () => {
    setBusy(true);
    try {
      await api.post('/reviews', { work_id: workId, edition_id: editionId, rating, text, spoiler });
      say(t('mrb.rev.posted'));
      load();
    } catch (e) {
      const code = e.response?.data?.code;
      say(code === 'BAD_RATING' ? t('mrb.rev.errRating')
        : code === 'EMPTY_TEXT' ? t('mrb.rev.errText')
        : t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const vote = async (id) => {
    try { await api.post(`/reviews/${id}/vote`); load(); }
    catch (e) {
      say(e.response?.data?.code === 'OWN_REVIEW' ? t('mrb.rev.errOwnVote') : t('msg.opFailed'));
    }
  };

  const report = async (id) => {
    try { await api.post(`/reviews/${id}/report`, { reason: 'OFF_TOPIC' }); say(t('mrb.rev.reported')); }
    catch { say(t('msg.opFailed')); }
  };

  const removeMine = async (id) => {
    try {
      await api.delete(`/reviews/${id}`);
      setRating(0); setText(''); setSpoiler(false);
      say(t('mrb.rev.deleted'));
      load();
    } catch { say(t('msg.opFailed')); }
  };

  const reviews = data?.reviews || [];
  const hist = data?.histogram || [0, 0, 0, 0, 0];
  const total = hist.reduce((a, b) => a + b, 0);
  const myName = user?.student?.name || user?.librarian?.name || user?.manager?.name || user?.name;

  return (
    <>
      {/* ----------------------------------------------------- rating card */}
      <div id="ratings" style={{
        background: '#fff', border: '1px solid ' + C.line, borderRadius: 18, padding: 24,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 32, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontFamily: SERIF, fontSize: 56, fontWeight: 700, lineHeight: 1,
            color: data?.rating != null ? C.deep : C.line2,
          }}>
            {data?.rating != null ? data.rating.toFixed(1) : '—'}
            <span style={{ fontSize: 20, color: C.mute, fontWeight: 600 }}> / 5.0</span>
          </div>
          <span style={{ alignSelf: 'flex-start' }}>
            <Stars value={data?.rating || 0} size={20} spacing={2} />
          </span>
          <div style={{ fontSize: 13, color: C.dim }}>
            {data?.count ? t('mrb.rev.nStudentRatings', { n: data.count }) : t('mrb.noRatingsTitle')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[5, 4, 3, 2, 1].map((star) => {
            const pct = total ? Math.round((hist[star - 1] / total) * 100) : 0;
            return (
              <div key={star} style={{
                display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 48px',
                gap: 12, alignItems: 'center', fontSize: 13,
              }}>
                <span style={{ color: C.body, fontWeight: 600 }}>{star}★</span>
                <div style={{ height: 10, background: C.surface, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: BAR_COLORS[star], borderRadius: 999 }} />
                </div>
                <span style={{ color: C.dim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------- composer */}
      {!guest && <div id="composer" style={{
        background: '#fff', border: '1px solid ' + C.sky200, borderRadius: 18, padding: 22,
        display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 0 0 4px ' + C.tint,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            width: 36, height: 36, borderRadius: '50%', background: C.deep, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>{initialsOf(myName)}</span>
          <strong style={{ fontSize: 15 }}>
            {data?.mine ? t('mrb.rev.editYours') : t('mrb.rev.yourReview')}
          </strong>
          <StarPicker value={rating} onChange={setRating} />
          <span style={{ fontSize: 13, color: C.dim }}>
            {rating ? rating.toFixed(1) : t('mrb.pickRating')}
          </span>
        </div>

        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder={t('mrb.reviewPlaceholder')}
          style={{
            width: '100%', border: '1px solid ' + C.line, borderRadius: 12, padding: '12px 14px',
            fontSize: 15, lineHeight: 1.55, resize: 'vertical', outline: 'none',
            color: C.ink, background: C.wash, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.slate, cursor: 'pointer' }}>
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.brand }} />
            {t('mrb.containsSpoilers')}
          </label>
          <span style={{ fontSize: 12, color: C.mute }}>{t('mrb.rev.moderationNote')}</span>
          <span style={{ flex: 1 }} />
          {data?.mine && (
            <button onClick={() => removeMine(data.mine)} style={{
              background: 'none', border: 0, borderRadius: 10, padding: '10px 12px',
              fontSize: 14, fontWeight: 700, color: C.likeFg, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t('common.delete')}</button>
          )}
          <button
            onClick={post} disabled={busy || !rating || !text.trim()}
            style={{
              background: (busy || !rating || !text.trim()) ? C.sky200 : C.brand, color: '#fff',
              border: 0, borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700,
              cursor: (busy || !rating || !text.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >{data?.mine ? t('common.save') : t('mrb.rev.postReview')}</button>
        </div>

        {msg && (
          <div style={{
            background: C.tint, border: '1px solid ' + C.sky200, borderRadius: 9,
            padding: '8px 12px', fontSize: 13, color: C.deep,
          }}>{msg}</div>
        )}
      </div>}

      {/* ------------------------------------------------------------ feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 600 }}>
            {t('mrb.rev.sectionTitle')}
          </h2>
          <span style={{ fontSize: 13, color: C.dim }}>{t('mrb.rev.sortedByHelpful')}</span>
        </div>

        {reviews.length === 0 ? (
          <div style={{
            border: '1px dashed ' + C.sky200, borderRadius: 16, padding: 28, textAlign: 'center',
            fontSize: 14, color: C.body, background: C.tint,
          }}>{t('mrb.rev.beFirst')}</div>
        ) : reviews.map((r) => (
          <ReviewCard
            key={r.id} review={r} t={t}
            revealed={!!revealed[r.id]}
            onReveal={() => setRevealed({ ...revealed, [r.id]: true })}
            onVote={() => vote(r.id)} onReport={() => report(r.id)}
            onReplied={load} guest={guest}
          />
        ))}
      </div>
    </>
  );
}

function ReviewCard({ review: r, t, revealed, onReveal, onVote, onReport, onReplied, guest }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [flagged, setFlagged] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      await api.post(`/reviews/${r.id}/replies`, { text: reply });
      setReply(''); setOpen(true);
      onReplied();
    } catch { /* surfaced by the parent's toast on the next action */ }
  };

  const replies = r.replies || [];

  return (
    <article style={{
      background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: r.is_mine ? C.brand : C.deep, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>{r.author_initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{r.author_name}</div>
          <div style={{ fontSize: 12, color: C.dim }}>
            {[r.author_sub, fmtDate(r.created_at)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span style={{ marginLeft: 'auto' }}><Stars value={r.rating} size={16} /></span>
      </div>

      {r.spoiler && !revealed ? (
        <button onClick={onReveal} style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
          background: 'repeating-linear-gradient(135deg,' + C.surface + ' 0 8px,' + C.wash + ' 8px 16px)',
          border: '1px dashed ' + C.line2, borderRadius: 10, padding: '12px 14px',
          fontSize: 13, color: C.body, fontFamily: 'inherit',
        }}>
          <span style={{ fontWeight: 700, color: C.deep }}>{t('mrb.disc.spoilerTitle')}</span>
          <span>{t('mrb.disc.spoilerBody')}</span>
        </button>
      ) : (
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.65, color: C.slate,
          textWrap: 'pretty', whiteSpace: 'pre-wrap',
        }}>{r.text}</p>
      )}

      {!guest && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onVote} style={{
          background: r.i_voted ? C.likeBg : C.surface,
          color: r.i_voted ? C.likeFg : C.body,
          border: 0, borderRadius: 999, padding: '5px 12px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>♥ {t('mrb.rev.nHelpful', { n: r.helpful })}</button>

        <button onClick={() => setOpen((v) => !v)} style={{
          background: C.surface, color: C.body, border: 0, borderRadius: 999,
          padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>{open ? t('mrb.rev.hideReplies') : t('mrb.rev.nReplies', { n: r.reply_count || 0 })}</button>

        <span style={{ flex: 1 }} />

        {!r.is_mine && (
          <button
            onClick={() => { setFlagged(true); onReport(); }}
            style={{
              background: 'none', border: 0, borderRadius: 6, padding: '5px 8px',
              fontSize: 12, fontWeight: 600, color: flagged ? C.likeFg : C.mute,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >⚑ {flagged ? t('mrb.rev.reported') : t('mrb.rev.report')}</button>
        )}
      </div>}

      {open && !guest && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          marginLeft: 20, paddingLeft: 20, borderLeft: '2px solid ' + C.sky100,
        }}>
          {replies.map((rp) => (
            <div key={rp.id} style={{
              display: 'flex', gap: 10, borderRadius: 12, padding: 12,
              background: rp.is_moderator ? C.tint : C.wash,
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: rp.is_moderator ? C.deep : C.brand, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11,
              }}>{rp.author_initials || initialsOf(rp.author_name)}</span>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                  <strong>{rp.author_name}</strong>
                  {rp.is_moderator && (
                    <span style={{
                      background: C.deep, color: '#fff', borderRadius: 999,
                      padding: '1px 8px', fontSize: 11, fontWeight: 700,
                    }}>{t('mrb.rev.moderator')}</span>
                  )}
                  <span style={{ color: C.mute, fontSize: 12 }}>
                    {fmtDate(rp.created_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.slate }}>{rp.text}</p>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={reply} onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
              placeholder={t('mrb.rev.replyPlaceholder')}
              style={{
                flex: 1, minWidth: 120, border: '1px solid ' + C.line, borderRadius: 10,
                padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={sendReply} disabled={!reply.trim()} style={{
              background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: reply.trim() ? 'pointer' : 'not-allowed', opacity: reply.trim() ? 1 : 0.55,
            }}>{t('mrb.rev.send')}</button>
          </div>
        </div>
      )}
    </article>
  );
}
