// Reviews: the rating card with its 5→1 histogram, the half-star composer, and
// the review feed with helpful votes, threaded replies and reporting.

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, radius, font } from '../theme';
import { Stars, Button, Card } from './primitives';

/* ------------------------------------------------------- half-star picker */

// Each star has a left and a right hit area, so a click lands on a half step.
function StarPicker({ value, onChange, size = 30 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div style={{ display: 'inline-flex', gap: 2 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = shown >= star;
        const half = !full && shown >= star - 0.5;
        return (
          <span key={star} style={{ position: 'relative', width: size, height: size, cursor: 'pointer' }}>
            <span style={{
              position: 'absolute', inset: 0, fontSize: size, lineHeight: 1,
              color: slate.border2, userSelect: 'none',
            }}>★</span>
            <span style={{
              position: 'absolute', inset: 0, fontSize: size, lineHeight: 1,
              color: brand.primary, overflow: 'hidden', userSelect: 'none',
              width: full ? '100%' : half ? '50%' : '0%',
            }}>★</span>
            <button
              type="button" aria-label={`${star - 0.5}`}
              onMouseEnter={() => setHover(star - 0.5)} onClick={() => onChange(star - 0.5)}
              style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', opacity: 0, border: 0, cursor: 'pointer' }}
            />
            <button
              type="button" aria-label={`${star}`}
              onMouseEnter={() => setHover(star)} onClick={() => onChange(star)}
              style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', opacity: 0, border: 0, cursor: 'pointer' }}
            />
          </span>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- section */

export default function Reviews({ workId, editionId, onRatingChange }) {
  const { t } = useTranslation();
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
      const res = await api.get(`/works/${workId}/reviews`);
      setData(res.data);
      if (onRatingChange) onRatingChange(res.data.rating, res.data.count);
      // Pre-fill the composer when the reader already reviewed this book.
      const mine = (res.data.reviews || []).find((r) => r.is_mine);
      if (mine) { setRating(mine.rating); setText(mine.text); setSpoiler(mine.spoiler); }
    } catch { /* the empty state covers it */ }
  }, [workId, onRatingChange]);

  useEffect(() => { load(); }, [load]);

  const say = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };

  const post = async () => {
    setBusy(true);
    try {
      await api.post('/reviews', {
        work_id: workId, edition_id: editionId, rating, text, spoiler,
      });
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
  const maxBar = Math.max(...hist, 1);

  return (
    <>
      {/* rating card */}
      <Card style={{ marginBottom: 22 }} id="ratings">
        <div style={{ display: 'flex', gap: 30, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{
              fontFamily: font.display, fontSize: 56, fontWeight: 700, lineHeight: 1,
              color: data?.rating != null ? slate.text : slate.border2,
            }}>{data?.rating != null ? data.rating.toFixed(1) : '—'}</div>
            <div style={{ marginTop: 6 }}><Stars value={data?.rating || 0} size={17} /></div>
            <div style={{ fontSize: 12, color: slate.muted, marginTop: 5 }}>
              {data?.count ? t('mrb.rev.nRatings', { n: data.count }) : t('mrb.noRatingsTitle')}
            </div>
          </div>

          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                <span style={{ fontSize: 11.5, color: slate.dim, width: 22 }}>{star}★</span>
                <span style={{ flex: 1, height: 7, background: slate.surface, borderRadius: 999, overflow: 'hidden' }}>
                  <span style={{
                    display: 'block', height: '100%',
                    width: `${(hist[star - 1] / maxBar) * 100}%`, background: brand.primary,
                  }} />
                </span>
                <span style={{ fontSize: 11.5, color: slate.muted, width: 22, textAlign: 'right' }}>{hist[star - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* composer */}
      <Card style={{ marginBottom: 22 }} id="composer">
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: slate.muted, marginBottom: 12,
        }}>{data?.mine ? t('mrb.rev.editYours') : t('mrb.writeReview')}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <StarPicker value={rating} onChange={setRating} />
          <span style={{ fontSize: 12.5, color: rating ? slate.strong : slate.muted, fontWeight: rating ? 700 : 400 }}>
            {rating ? rating.toFixed(1) : t('mrb.pickRating')}
          </span>
        </div>

        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder={t('mrb.reviewPlaceholder')}
          style={{
            width: '100%', border: '1px solid ' + slate.border, borderRadius: radius.input,
            padding: 12, fontSize: 14, fontFamily: font.ui, color: slate.text,
            resize: 'vertical', outline: 'none',
          }}
        />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginTop: 12,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: slate.body, cursor: 'pointer' }}>
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)}
              style={{ accentColor: brand.primary, width: 15, height: 15 }} />
            {t('mrb.containsSpoilers')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {data?.mine && (
              <Button kind="ghost" onClick={() => removeMine(data.mine)}
                style={{ color: danger.text }}>{t('common.delete')}</Button>
            )}
            <Button onClick={post} disabled={busy || !rating || !text.trim()}>
              {data?.mine ? t('common.save') : t('mrb.post')}
            </Button>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: slate.muted, marginTop: 10, lineHeight: 1.5 }}>
          {t('mrb.rev.moderationNote')}
        </div>
        {msg && (
          <div style={{
            marginTop: 10, background: brand.tint50, border: '1px solid ' + brand.tint200,
            borderRadius: 9, padding: '8px 12px', fontSize: 13, color: brand.deep,
          }}>{msg}</div>
        )}
      </Card>

      {/* feed */}
      <h3 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, margin: '0 0 14px' }}>
        {t('mrb.rev.feedTitle', { n: reviews.length })}
      </h3>

      {reviews.length === 0 ? (
        <Card><div style={{ fontSize: 13.5, color: slate.dim, lineHeight: 1.6 }}>{t('mrb.rev.beFirst')}</div></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reviews.map((r) => (
            <ReviewCard
              key={r.id} review={r} t={t}
              revealed={!!revealed[r.id]}
              onReveal={() => setRevealed({ ...revealed, [r.id]: true })}
              onVote={() => vote(r.id)} onReport={() => report(r.id)}
              onReplied={load}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ReviewCard({ review: r, t, revealed, onReveal, onVote, onReport, onReplied }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [showReplies, setShowReplies] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      await api.post(`/reviews/${r.id}/replies`, { text: reply });
      setReply(''); setReplying(false); setShowReplies(true);
      onReplied();
    } catch { /* surfaced by the parent's toast on the next action */ }
  };

  return (
    <Card padding={18}>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: r.is_mine ? brand.primary : brand.deep, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800,
        }}>{r.author_initials}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>{r.author_name}</strong>
            {r.author_sub && <span style={{ fontSize: 12, color: slate.muted }}>{r.author_sub}</span>}
            <span style={{ fontSize: 12, color: slate.muted }}>· {new Date(r.created_at).toLocaleDateString()}</span>
          </div>

          <div style={{ margin: '6px 0 8px' }}><Stars value={r.rating} size={14} /></div>

          {r.spoiler && !revealed ? (
            <button onClick={onReveal} style={{
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
              border: '1px solid ' + slate.border2, borderRadius: 10, padding: '14px 16px',
              fontSize: 13, fontWeight: 600, color: slate.body, fontFamily: font.ui,
              background: 'repeating-linear-gradient(45deg,#F8FAFC,#F8FAFC 8px,#F1F5F9 8px,#F1F5F9 16px)',
            }}>{t('mrb.rev.spoilerWarning')}</button>
          ) : (
            <p style={{ fontSize: 14, lineHeight: 1.65, color: slate.body, margin: 0, whiteSpace: 'pre-wrap' }}>{r.text}</p>
          )}

          <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={onVote} style={{
              background: r.i_voted ? '#FFE4E6' : 'transparent',
              color: r.i_voted ? '#D93A41' : slate.dim,
              border: 0, borderRadius: 999, padding: '4px 10px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
            }}>♥ {r.helpful}</button>

            {r.reply_count > 0 && (
              <button onClick={() => setShowReplies((v) => !v)} style={{
                background: 'none', border: 0, color: slate.dim, fontSize: 12,
                fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
              }}>{t('mrb.rev.nReplies', { n: r.reply_count })}</button>
            )}

            <button onClick={() => setReplying((v) => !v)} style={{
              background: 'none', border: 0, color: slate.dim, fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
            }}>{t('mrb.rev.reply')}</button>

            {!r.is_mine && (
              <button onClick={onReport} style={{
                background: 'none', border: 0, color: slate.muted, fontSize: 12,
                fontWeight: 700, cursor: 'pointer', fontFamily: font.ui, marginLeft: 'auto',
              }}>⚑ {t('mrb.rev.report')}</button>
            )}
          </div>

          {showReplies && (r.replies || []).map((rp) => (
            <div key={rp.id} style={{
              marginTop: 12, paddingLeft: 14, borderLeft: '2px solid ' + brand.tint100,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>{rp.author_name}</strong>
                {rp.is_moderator && (
                  <span style={{
                    background: brand.deep, color: '#fff', borderRadius: 999,
                    padding: '2px 8px', fontSize: 10, fontWeight: 800,
                  }}>{t('mrb.rev.moderator')}</span>
                )}
                <span style={{ fontSize: 11.5, color: slate.muted }}>
                  {new Date(rp.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: slate.body, margin: '4px 0 0' }}>{rp.text}</p>
            </div>
          ))}

          {replying && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={reply} onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                placeholder={t('mrb.rev.replyPlaceholder')}
                style={{
                  flex: 1, border: '1px solid ' + slate.border, borderRadius: 10,
                  padding: '9px 12px', fontSize: 13, fontFamily: font.ui, outline: 'none',
                }}
              />
              <Button onClick={sendReply} disabled={!reply.trim()}>{t('mrb.rev.send')}</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
