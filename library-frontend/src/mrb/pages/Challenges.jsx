// Challenges — screen 4 of the handoff.
//
// Challenge cards with organiser pill and status, the selected challenge's
// detail with per-book step pills and a single next action, the 3-question
// quiz modal, and the frontrunners standings.

import { useCallback, useEffect, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, danger, radius, shadow, font } from '../theme';
import { BookCover, Button, Card, Toast } from '../components/primitives';

export default function Challenges() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2400); }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/challenges');
      const rows = res.data || [];
      setList(rows);
      setSelected((cur) => (cur == null && rows.length ? rows[0].id : cur));
    } catch { /* shown by the empty state */ }
    finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); return; }
    try {
      const res = await api.get(`/challenges/${id}`);
      setDetail(res.data);
    } catch { setDetail(null); }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDetail(selected); }, [selected, loadDetail]);

  if (loading) {
    return <div style={{ padding: 50, textAlign: 'center', color: slate.muted }}>{t('common.loading')}</div>;
  }

  return (
    <>
      <h1 style={{ fontFamily: font.display, fontSize: 38, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        {t('mrb.nav.challenges')}
      </h1>
      <p style={{ fontSize: 14, color: slate.body, margin: '0 0 26px' }}>
        {t('mrb.ch.rulesLine', { read: 10, quiz: 15, review: 5 })}
      </p>

      {list.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px dashed ' + slate.border2, borderRadius: radius.card,
          padding: 44, maxWidth: 640,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('mrb.ch.noneTitle')}</div>
          <div style={{ fontSize: 14, color: slate.body, lineHeight: 1.65 }}>{t('mrb.ch.noneBody')}</div>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 18, marginBottom: 34,
          }}>
            {list.map((ch) => (
              <ChallengeCard key={ch.id} ch={ch} active={ch.id === selected}
                onClick={() => setSelected(ch.id)} t={t} />
            ))}
          </div>

          {detail && (
            <ChallengeDetail
              detail={detail} t={t} say={say}
              onReload={() => { loadDetail(selected); loadList(); }}
              onQuiz={setQuiz}
            />
          )}
        </>
      )}

      {quiz && (
        <QuizModal
          quiz={quiz} t={t} say={say}
          onClose={() => setQuiz(null)}
          onDone={() => { setQuiz(null); loadDetail(selected); }}
        />
      )}
      <Toast message={toast} />
    </>
  );
}

function ChallengeCard({ ch, active, onClick, t }) {
  const urgent = ch.state === 'active' && ch.days_left <= 7;
  const status = ch.state === 'upcoming'
    ? t('mrb.ch.startsOn', { date: new Date(ch.starts_at).toLocaleDateString() })
    : ch.state === 'finished'
    ? t('mrb.ch.finished')
    : t('mrb.ch.daysLeft', { n: Math.max(0, ch.days_left) });

  return (
    <button onClick={onClick} style={{
      textAlign: 'left', background: '#fff', cursor: 'pointer',
      border: '1px solid ' + (active ? brand.primary : slate.border),
      boxShadow: active ? '0 0 0 3px ' + brand.tint100 : shadow.card,
      borderRadius: radius.card, padding: 20, fontFamily: font.ui,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          background: brand.tint100, color: brand.deep, borderRadius: 999,
          padding: '3px 10px', fontSize: 11, fontWeight: 800,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{t('mrb.ch.school')}</span>
        <span style={{
          background: urgent ? danger.tint : slate.surface,
          color: urgent ? danger.text : slate.body,
          borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        }}>{status}</span>
      </div>

      <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{ch.title}</div>
      {ch.description && (
        <div style={{ fontSize: 13, color: slate.body, lineHeight: 1.55 }}>{ch.description}</div>
      )}

      <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
        {(ch.covers || []).slice(0, 5).map((c, i) => (
          <span key={i} style={{ width: 26 }}>
            <BookCover title={String(i)} src={c ? assetUrl(c) : ''} radiusPx={3} fontScale={0.01} />
          </span>
        ))}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 10,
        fontSize: 12, color: slate.dim, marginTop: 4,
      }}>
        <span>{t('mrb.ch.nBooks', { n: ch.book_count })} · {t('mrb.ch.nReaders', { n: ch.participants })}</span>
        <strong style={{ color: brand.deep }}>{t('mrb.ch.nPoints', { n: ch.points })}</strong>
      </div>
    </button>
  );
}

function ChallengeDetail({ detail, t, say, onReload, onQuiz }) {
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    try {
      await api.post(`/challenges/${detail.id}/join`);
      say(t('mrb.ch.joined'));
      onReload();
    } catch (err) {
      say(err.response?.data?.code === 'FINISHED' ? t('mrb.ch.errFinished') : t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const markRead = async (editionID, read) => {
    try {
      await api.post(`/challenges/${detail.id}/read`, { edition_id: editionID, read });
      say(read ? t('mrb.ch.markedRead') : t('mrb.ch.unmarkedRead'));
      onReload();
    } catch { say(t('msg.opFailed')); }
  };

  const openQuiz = async (book) => {
    try {
      const res = await api.get(`/challenges/${detail.id}/quiz`, { params: { edition_id: book.edition_id } });
      onQuiz({ challengeID: detail.id, book, ...res.data });
    } catch (err) {
      say(err.response?.data?.code === 'NO_QUIZ' ? t('mrb.ch.noQuiz') : t('msg.opFailed'));
    }
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <section style={{ flex: '999 1 540px', minWidth: 300 }}>
        <Card style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>{detail.title}</h2>
          {detail.description && (
            <p style={{ fontSize: 14, color: slate.body, lineHeight: 1.65, margin: '0 0 14px' }}>{detail.description}</p>
          )}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: slate.dim }}>
            <span>{new Date(detail.starts_at).toLocaleDateString()} – {new Date(detail.ends_at).toLocaleDateString()}</span>
            <span>{t('mrb.ch.nReaders', { n: detail.participants })}</span>
            <strong style={{ color: brand.deep }}>{t('mrb.ch.yourPoints', { n: detail.points })}</strong>
          </div>

          {!detail.joined && detail.state !== 'finished' && (
            <div style={{ marginTop: 16 }}>
              <Button onClick={join} disabled={busy}>{t('mrb.ch.join')}</Button>
            </div>
          )}

          <div style={{
            marginTop: 16, background: brand.tint50, border: '1px solid ' + brand.tint200,
            borderRadius: radius.smallCard, padding: '11px 14px', fontSize: 12.5,
            color: brand.deep, lineHeight: 1.6,
          }}>
            {t('mrb.ch.howItWorks', {
              read: detail.rules?.read ?? 10,
              quiz: detail.rules?.quiz ?? 15,
              review: detail.rules?.review ?? 5,
            })}
            {detail.review_step_available === false && (
              <div style={{ marginTop: 6, color: slate.body }}>{t('mrb.ch.reviewsPending')}</div>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(detail.books || []).map((b) => (
            <Card key={b.edition_id} padding={16}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ width: 48, flexShrink: 0 }}>
                  <BookCover title={b.title} src={b.cover_url ? assetUrl(b.cover_url) : ''} radiusPx={4} fontScale={0.45} />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: slate.dim, marginBottom: 8 }}>{b.author || '—'}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Step on={b.read} label={t('mrb.ch.stepRead')} />
                    <Step on={b.quiz_best >= 2} label={
                      b.quiz_total > 0 ? t('mrb.ch.stepQuiz', { n: b.quiz_best, total: b.quiz_total }) : t('mrb.ch.noQuizShort')
                    } />
                    <Step on={b.reviewed} label={t('mrb.ch.stepReview')} muted={detail.review_step_available === false} />
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {!detail.joined ? (
                    <span style={{ fontSize: 12, color: slate.muted }}>{t('mrb.ch.joinFirst')}</span>
                  ) : b.next === 'read' ? (
                    <Button onClick={() => markRead(b.edition_id, true)}>{t('mrb.ch.markRead')}</Button>
                  ) : b.next === 'quiz' ? (
                    <Button onClick={() => openQuiz(b)}>{t('mrb.ch.takeQuiz')}</Button>
                  ) : b.next === 'review' ? (
                    <Button kind="secondary" disabled title={t('mrb.ch.reviewsPending')}>{t('mrb.ch.writeReview')}</Button>
                  ) : (
                    <span style={{
                      background: '#DCFCE7', color: '#166534', borderRadius: 999,
                      padding: '6px 13px', fontSize: 12, fontWeight: 800,
                    }}>{t('mrb.ch.completed')}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <aside style={{ flex: '1 1 300px', minWidth: 260 }}>
        <h3 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
          {t('mrb.ch.frontrunners')}
        </h3>
        <Card padding={0}>
          {(detail.standings || []).length === 0 && (
            <div style={{ padding: 20, fontSize: 13, color: slate.dim }}>{t('mrb.ch.noStandings')}</div>
          )}
          {(detail.standings || []).map((s, i) => {
            const medal = [['#FDE68A', '#92400E'], ['#E2E8F0', '#334155'], ['#FED7AA', '#9A3412']][i];
            return (
              <div key={s.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px',
                borderBottom: i < detail.standings.length - 1 ? '1px solid ' + slate.border : 'none',
                background: s.is_me ? brand.tint50 : 'transparent',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: medal ? medal[0] : slate.surface,
                  color: medal ? medal[1] : slate.dim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: s.is_me ? 800 : 600 }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: slate.dim }}>
                    {[s.grade, s.branch].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <strong style={{ fontSize: 13, color: brand.deep }}>{s.points}</strong>
              </div>
            );
          })}
        </Card>

        {detail.prizes && (
          <Card style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.09em',
              textTransform: 'uppercase', color: slate.muted, marginBottom: 8,
            }}>{t('mrb.ch.prizes')}</div>
            <div style={{ fontSize: 13.5, color: slate.body, lineHeight: 1.6 }}>{detail.prizes}</div>
          </Card>
        )}
      </aside>
    </div>
  );
}

function Step({ on, label, muted }) {
  return (
    <span style={{
      background: on ? '#DCFCE7' : muted ? slate.surface : '#fff',
      color: on ? '#166534' : muted ? slate.muted : slate.body,
      border: '1px solid ' + (on ? '#BBF7D0' : slate.border),
      borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{on ? '✓ ' : ''}{label}</span>
  );
}

function QuizModal({ quiz, t, say, onClose, onDone }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const qs = quiz.questions || [];
  const q = qs[idx];
  const chosen = q ? answers[q.id] : undefined;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/challenges/${quiz.challengeID}/quiz`, {
        edition_id: quiz.book.edition_id, answers,
      });
      setResult(res.data);
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 90,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 18, boxShadow: shadow.modal,
        width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 26,
      }}>
        {result ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: font.display, fontSize: 44, fontWeight: 700,
              color: result.passed ? '#166534' : danger.text,
            }}>{result.score} / {result.total}</div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 6px' }}>
              {result.passed ? t('mrb.ch.quizPassed') : t('mrb.ch.quizFailed')}
            </div>
            <div style={{ fontSize: 13.5, color: slate.body, lineHeight: 1.6, marginBottom: 20 }}>
              {result.passed
                ? t('mrb.ch.quizPassedBody', { n: result.points_awarded })
                : t('mrb.ch.quizFailedBody', { n: quiz.pass_mark, total: result.total })}
            </div>
            <div style={{ fontSize: 12, color: slate.muted, marginBottom: 18 }}>
              {t('mrb.ch.bestKept', { n: result.best })}
            </div>
            <Button onClick={onDone}>{t('common.close')}</Button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: slate.strong }}>{quiz.book.title}</div>
              <div style={{ fontSize: 12, color: slate.muted }}>{idx + 1} / {qs.length}</div>
            </div>
            <div style={{ height: 5, background: slate.surface, borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: `${((idx + 1) / qs.length) * 100}%`, height: '100%', background: brand.primary }} />
            </div>

            <div style={{ fontFamily: font.display, fontSize: 19, fontWeight: 600, lineHeight: 1.35, marginBottom: 16 }}>
              {q?.prompt}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[q?.option_a, q?.option_b, q?.option_c, q?.option_d].map((opt, i) => {
                if (!opt) return null;
                const on = chosen === i;
                return (
                  <button key={i} onClick={() => setAnswers({ ...answers, [q.id]: i })} style={{
                    textAlign: 'left', background: on ? brand.tint50 : '#fff',
                    border: '1px solid ' + (on ? brand.primary : slate.border),
                    borderRadius: 11, padding: '12px 14px', fontSize: 14,
                    cursor: 'pointer', fontFamily: font.ui, color: slate.text,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: '2px solid ' + (on ? brand.primary : slate.border2),
                      background: on ? brand.primary : '#fff',
                    }} />
                    {opt}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 22 }}>
              <Button kind="ghost" onClick={onClose}>{t('common.cancel')}</Button>
              {idx < qs.length - 1 ? (
                <Button onClick={() => setIdx(idx + 1)} disabled={chosen === undefined}>{t('mrb.ch.next')}</Button>
              ) : (
                <Button onClick={submit} disabled={busy || Object.keys(answers).length < qs.length}>
                  {t('mrb.ch.finish')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
