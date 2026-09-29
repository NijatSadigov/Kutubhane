// Challenges — screen "05 Challenges" of the handoff.
//
// Transcribed from the prototype's `isChallenges` block: the 40px screen
// rhythm under a "read · verify · win" eyebrow; 300px challenge cards at
// 1.5px borders with organiser and status pills, a 24×36 cover strip and a 6px
// progress rail; the 20px-radius detail panel with its 34px serif title, the
// #F1F5F9 meta chips, the three 180px step cards priced in points, and book
// rows at 48×72 with step pills and one action; a 320px sidebar of
// frontrunners, the deep-blue branch standings and the prizes list; the past
// champions grid; and the 560px quiz modal with its lettered options.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { fmtDate } from '../../i18n/dates';
import { coverColors } from '../theme';
import { Toast } from '../components/primitives';

const C = {
  ink: '#0F172A', body: '#475569', slate: '#334155', dim: '#64748B', mute: '#94A3B8',
  line: '#E2E8F0', line2: '#CBD5E1', wash: '#F8FAFC', surface: '#F1F5F9',
  tint: '#F0F9FF', sky100: '#E0F2FE', sky200: '#BAE6FD',
  deep: '#075985', brand: '#1B9DD9', brandHi: '#1580B5',
  okBg: '#DCFCE7', okBorder: '#BBF7D0', okFg: '#166534',
  coralBg: '#FFF1EE', coralFg: '#B4232A',
  goldBg: '#FFFBEB', goldBorder: '#FDE68A', goldFg: '#92400E', gold: '#F59E0B',
};
const SERIF = "'Source Serif 4', Georgia, serif";
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)';

export default function Challenges() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [suggesting, setSuggesting] = useState(null); // {challengeID, book}
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2400); }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/challenges');
      const rows = res.data || [];
      setList(rows);
      setSelected((cur) => {
        if (cur != null) return cur;
        const live = rows.find((r) => r.state === 'active') || rows.find((r) => r.state === 'upcoming');
        return (live || rows[0])?.id ?? null;
      });

      // The champions strip needs each finished challenge's leader, which only
      // the detail endpoint knows.
      const finished = rows.filter((r) => r.state === 'finished').slice(0, 6);
      const details = await Promise.allSettled(finished.map((r) => api.get(`/challenges/${r.id}`)));
      setPast(details.filter((d) => d.status === 'fulfilled').map((d) => d.value.data));
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
    return <div style={{ padding: 50, textAlign: 'center', color: C.mute }}>{t('common.loading')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* -------------------------------------------------------- heading */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.brandHi, marginBottom: 6 }}>
          {t('mrb.ch.eyebrow')}
        </div>
        <h1 className="mrb-h-page" style={{
          margin: 0, fontFamily: SERIF, fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em',
        }}>{t('mrb.nav.challenges')}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: C.body, maxWidth: 720, lineHeight: 1.55 }}>
          {t('mrb.ch.lead')}
        </p>
      </div>

      {list.length === 0 ? (
        <div style={{
          border: '1px dashed ' + C.sky200, background: C.tint, borderRadius: 16,
          padding: 40, maxWidth: 640,
        }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.deep, marginBottom: 8 }}>
            {t('mrb.ch.noneTitle')}
          </div>
          <div style={{ fontSize: 14, color: C.body, lineHeight: 1.6 }}>{t('mrb.ch.noneBody')}</div>
        </div>
      ) : (
        <>
          <section style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16,
          }}>
            {list.map((ch) => (
              <ChallengeCard key={ch.id} ch={ch} active={ch.id === selected}
                onClick={() => setSelected(ch.id)} t={t} />
            ))}
          </section>

          {detail && (
            <ChallengeDetail
              detail={detail} t={t} say={say} nav={nav}
              onReload={() => { loadDetail(selected); loadList(); }}
              onQuiz={setQuiz} onSuggest={setSuggesting}
            />
          )}

          {past.length > 0 && <PastChallenges past={past} t={t} />}
        </>
      )}

      {quiz && (
        <QuizModal
          quiz={quiz} t={t} say={say}
          onClose={() => setQuiz(null)}
          onDone={() => { setQuiz(null); loadDetail(selected); loadList(); }}
        />
      )}
      {suggesting && (
        <SuggestModal
          target={suggesting} t={t} say={say}
          onClose={() => setSuggesting(null)}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

/* ----------------------------------------------------------------- cards */

// "Hədəf · all 5 branches" in the design. The school comes from the API; the
// reach is phrased in the reader's language rather than baked into the string.
function organiser(ch, t) {
  const school = ch.organiser || '';
  if (ch.scope === 'alliance') {
    return [school, t('mrb.ch.alliance')].filter(Boolean).join(' · ');
  }
  if (ch.branch_count > 1) {
    return [school, t('mrb.ch.allBranches', { n: ch.branch_count })].filter(Boolean).join(' · ');
  }
  return school || t('mrb.ch.school');
}

// The run of dates, or nothing at all when neither was set. Printing the zero
// time as "01.01.1 – 01.01.1" was how an open-ended campaign looked before.
function dateRange(ch) {
  const parts = [ch.starts_at && fmtDate(ch.starts_at), ch.ends_at && fmtDate(ch.ends_at)]
    .filter(Boolean);
  return parts.join(' – ');
}

function stateTone(ch, t) {
  if (ch.state === 'upcoming') {
    return {
      bg: C.surface, fg: C.slate,
      label: t('mrb.ch.startsOn', { date: fmtDate(ch.starts_at) }),
    };
  }
  if (ch.state === 'finished') return { bg: C.surface, fg: C.dim, label: t('mrb.ch.finished') };
  // A campaign with no end date has no countdown — it simply runs. Saying
  // "0 gün qaldı" for one would read as though it were over.
  if (ch.days_left == null) {
    return { bg: C.sky100, fg: C.deep, label: t('mrb.ch.running') };
  }
  const urgent = ch.days_left <= 7;
  return {
    bg: urgent ? C.coralBg : C.sky100, fg: urgent ? C.coralFg : C.deep,
    label: t('mrb.ch.daysLeft', { n: Math.max(0, ch.days_left) }),
  };
}

function ChallengeCard({ ch, active, onClick, t }) {
  const tone = stateTone(ch, t);
  // The bar tracks books verified, not sub-steps: that is the unit the
  // challenge is actually scored and described in.
  const total = ch.book_count || 0;
  const pct = total > 0 ? Math.round(((ch.verified || 0) / total) * 100) : 0;

  return (
    <button onClick={onClick} style={{
      textAlign: 'left', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: C.ink,
      border: '1.5px solid ' + (active ? C.brand : C.line),
      boxShadow: active ? '0 0 0 3px ' + C.tint : CARD_SHADOW,
      borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          background: ch.scope === 'alliance' ? C.deep : C.sky100,
          color: ch.scope === 'alliance' ? '#fff' : C.deep,
          borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        }}>{organiser(ch, t)}</span>
        <span style={{
          background: tone.bg, color: tone.fg, borderRadius: 999, padding: '3px 10px',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
        }}>{tone.label}</span>
      </div>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700 }}>{ch.title}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(ch.covers || []).slice(0, 5).map((src, i) => (
            <Spine key={i} src={src} seed={ch.title + i} w={24} h={36} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: C.dim }}>
          {dateRange(ch)}
          {' · '}{t('mrb.ch.nReaders', { n: ch.participants })}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 6, background: C.sky100, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: C.brand, borderRadius: 999 }} />
        </div>
        <span style={{ fontSize: 12, color: C.body, fontWeight: 600 }}>
          {ch.joined
            ? t('mrb.ch.verifiedOf', { n: ch.verified || 0, total })
            : t('mrb.ch.notJoined')}
        </span>
      </div>
    </button>
  );
}

// A book spine: the real cover where there is one, otherwise the block of
// colour the prototype draws.
function Spine({ src, seed, w, h, radius = 3, shadow = '0 2px 4px rgba(15,23,42,0.15)' }) {
  const [bg] = coverColors(seed);
  if (src) {
    return <img src={assetUrl(src)} alt="" style={{
      width: w, height: h, borderRadius: radius, objectFit: 'cover', display: 'block', boxShadow: shadow,
    }} />;
  }
  return <span style={{ width: w, height: h, borderRadius: radius, background: bg, boxShadow: shadow }} />;
}

/* ---------------------------------------------------------------- detail */

function ChallengeDetail({ detail, t, say, nav, onReload, onQuiz, onSuggest }) {
  const [busy, setBusy] = useState(false);
  const tone = stateTone(detail, t);

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

  const STEPS = [
    ['1', t('mrb.ch.step1'), detail.rules?.read ?? 10, t('mrb.ch.step1body')],
    ['2', t('mrb.ch.step2'), detail.rules?.quiz ?? 15, t('mrb.ch.step2body')],
    ['3', t('mrb.ch.step3'), detail.rules?.review ?? 5, t('mrb.ch.step3body')],
  ];

  return (
    <section style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
      <div style={{
        flex: '999 1 600px', minWidth: 0, background: '#fff', border: '1px solid ' + C.line,
        borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 24,
        boxShadow: CARD_SHADOW,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: detail.scope === 'alliance' ? C.deep : C.sky100,
              color: detail.scope === 'alliance' ? '#fff' : C.deep,
              borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
            }}>{organiser(detail, t)}</span>
          </div>

          <h2 className="mrb-h-panel" style={{
            margin: 0, fontFamily: SERIF, fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em',
          }}>{detail.title}</h2>

          {detail.description && (
            <p style={{
              margin: 0, fontSize: 15, color: C.body, lineHeight: 1.6, maxWidth: 680, textWrap: 'pretty',
            }}>{detail.description}</p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: C.slate }}>
            <span style={{ background: C.surface, borderRadius: 8, padding: '5px 10px' }}>
              {dateRange(detail)}
            </span>
            <span style={{ background: C.surface, borderRadius: 8, padding: '5px 10px' }}>
              {t('mrb.ch.nReaders', { n: detail.participants })}
            </span>
            <span style={{
              background: tone.bg, color: tone.fg, borderRadius: 8, padding: '5px 10px', fontWeight: 600,
            }}>{tone.label}</span>
          </div>

          {!detail.joined && detail.state !== 'finished' && (
            <button onClick={join} disabled={busy} style={{
              alignSelf: 'flex-start', background: C.brand, color: '#fff',
              border: '1px solid ' + C.brand, borderRadius: 10, padding: '10px 18px',
              fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: busy ? 0.55 : 1,
            }}>{t('mrb.ch.join')}</button>
          )}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
        }}>
          {STEPS.map(([n, label, pts, body]) => (
            <div key={n} style={{
              background: C.wash, border: '1px solid ' + C.line, borderRadius: 14, padding: 14,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{n} · {label}</strong>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.brandHi, whiteSpace: 'nowrap' }}>
                  +{pts} {t('mrb.ch.pts')}
                </span>
              </div>
              <span style={{ fontSize: 13, color: C.body, lineHeight: 1.45 }}>{body}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: 12, flexWrap: 'wrap',
          }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('mrb.ch.booksTitle')}</h3>
            <span style={{ fontSize: 14, color: C.body }}>
              {t('mrb.ch.yourPointsLabel')}{' '}
              <strong style={{ color: C.deep, fontSize: 16 }}>{detail.points}</strong> / {detail.max_points}
            </span>
          </div>

          {(detail.books || []).map((b) => (
            <BookRow
              key={b.edition_id} b={b} detail={detail} t={t} nav={nav}
              onRead={() => markRead(b.edition_id, true)} onQuiz={() => openQuiz(b)}
              onSuggest={() => onSuggest({ challengeID: detail.id, book: b })}
            />
          ))}
        </div>
      </div>

      <Sidebar detail={detail} t={t} />
    </section>
  );
}

function BookRow({ b, detail, t, nav, onRead, onQuiz, onSuggest }) {
  const open = () => nav(`/app/book/${b.edition_id}`);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      border: '1px solid ' + C.line, borderRadius: 14, padding: 14,
    }}>
      <button onClick={open} style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer', flexShrink: 0 }}>
        <Spine src={b.cover_url} seed={b.title} w={48} h={72} radius={4}
          shadow="inset 2px 0 0 rgba(255,255,255,0.15), 0 3px 8px rgba(15,23,42,0.15)" />
      </button>

      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <button onClick={open} style={{
          background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
          fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: C.ink,
        }}>{b.title}</button>
        <div style={{ fontSize: 13, color: C.dim }}>
          {[b.author, b.cefr ? `CEFR ${b.cefr}` : '', b.pages ? `${b.pages} ${t('mrb.pagesShort')}` : '']
            .filter(Boolean).join(' · ')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Step on={b.read} label={t('mrb.ch.stepRead')} />
        <Step
          on={b.quiz_best >= 2}
          label={b.quiz_total > 0 ? t('mrb.ch.stepQuiz', { n: b.quiz_best, total: b.quiz_total }) : t('mrb.ch.noQuizShort')}
          muted={!b.quiz_total}
        />
        <Step on={b.reviewed} label={t('mrb.ch.stepReview')} />
      </div>

      {!detail.joined ? (
        <span style={{ fontSize: 12, color: C.mute }}>{t('mrb.ch.joinFirst')}</span>
      ) : b.next === 'done' ? (
        <span style={{
          background: C.okBg, color: C.okFg, border: '1px solid ' + C.okBorder, borderRadius: 10,
          padding: '9px 16px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        }}>✓ {t('mrb.ch.completed')}</span>
      ) : (
        <Act onClick={b.next === 'read' ? onRead : b.next === 'quiz' ? onQuiz : open}>
          {b.next === 'read' ? t('mrb.ch.markRead')
            : b.next === 'quiz' ? t('mrb.ch.takeQuiz')
            : t('mrb.writeReview')}
        </Act>
      )}

      {/* Writing a question for the next reader. Only when the library has
          opened the quiz to suggestions, and only to somebody taking part —
          a question about a book you have not read is not much of a question. */}
      {detail.joined && detail.quiz_open_submissions && (
        <button onClick={onSuggest} style={{
          background: 'transparent', border: 0, padding: '6px 0',
          color: C.brandHi, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
        }}>{t('mrb.ch.suggestQ')}</button>
      )}
    </div>
  );
}

function Act({ children, ...rest }) {
  return (
    <button {...rest} style={{
      background: C.brand, color: '#fff', border: '1px solid ' + C.brand, borderRadius: 10,
      padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      whiteSpace: 'nowrap', fontFamily: 'inherit',
    }}>{children}</button>
  );
}

function Step({ on, label, muted }) {
  return (
    <span style={{
      background: on ? C.okBg : muted ? C.surface : '#fff',
      color: on ? C.okFg : muted ? C.mute : C.body,
      border: '1px solid ' + (on ? C.okBorder : C.line),
      borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{on ? '✓ ' : ''}{label}</span>
  );
}

/* --------------------------------------------------------------- sidebar */

function Sidebar({ detail, t }) {
  const standings = detail.standings;
  const rows = useMemo(() => standings || [], [standings]);
  const myRank = rows.findIndex((r) => r.is_me) + 1;

  // The design's deep-blue card ranks groups rather than individuals. Branch
  // is the group this system actually knows, so the rows are folded by it.
  const branches = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const key = r.branch || '—';
      m.set(key, (m.get(key) || 0) + r.points);
    });
    return [...m.entries()].map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points);
  }, [rows]);
  const top = branches[0]?.points || 1;

  const prizes = (detail.prizes || '').split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <aside style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 12, flexWrap: 'wrap',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('mrb.ch.frontrunners')}</h3>
          <span style={{ fontSize: 12, color: C.dim }}>
            {myRank
              ? t('mrb.ch.yourRank', { n: myRank, total: detail.participants || rows.length })
              : t('mrb.ch.notRanked')}
          </span>
        </div>

        {rows.length === 0 ? (
          <div style={{ fontSize: 14, color: C.body, background: C.wash, borderRadius: 10, padding: 14 }}>
            {t('mrb.ch.noStandings')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map((s, i) => {
              const medal = [['#FDE68A', '#92400E'], ['#E2E8F0', '#334155'], ['#FED7AA', '#9A3412']][i];
              return (
                <div key={s.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                  borderRadius: 10, background: s.is_me ? C.tint : 'transparent',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: medal ? medal[0] : C.surface, color: medal ? medal[1] : C.dim,
                    fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <span style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: s.is_me ? C.brand : C.deep, color: '#fff', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{s.initials}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: C.dim }}>
                      {[s.grade, s.branch].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {s.points}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {branches.length > 1 && (
        <div style={{
          background: C.deep, color: '#fff', borderRadius: 16, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('mrb.ch.branchStandings')}</h3>
            <div style={{ fontSize: 12, color: C.sky200, marginTop: 2 }}>{t('mrb.ch.branchMetric')}</div>
          </div>
          {branches.map((b, i) => (
            <div key={b.name} style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '4px 10px',
              background: i === 0 ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderRadius: 10, padding: '6px 8px',
            }}>
              <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500 }}>{b.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{b.points}</span>
              <div style={{
                gridColumn: 'span 2', height: 6, background: 'rgba(255,255,255,0.12)',
                borderRadius: 999, overflow: 'hidden',
              }}>
                <div style={{
                  width: (b.points / top) * 100 + '%', height: '100%',
                  background: i === 0 ? '#7DD3FC' : C.sky200, borderRadius: 999,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {prizes.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('mrb.ch.prizes')}</h3>
          {prizes.map((p, i) => {
            const chip = [['#FEF3C7', '#92400E'], ['#F1F5F9', '#334155'], ['#FFEDD5', '#9A3412']][i]
              || [C.surface, C.body];
            return (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '6px 0', borderBottom: '1px solid ' + C.surface,
              }}>
                <span style={{
                  background: chip[0], color: chip[1], borderRadius: 8, padding: '3px 8px',
                  fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0,
                }}>{t('mrb.ch.place', { n: i + 1 })}</span>
                <span style={{ fontSize: 14, color: C.slate, lineHeight: 1.45 }}>{p}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------- past champions */

function PastChallenges({ past, t }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 600 }}>
        {t('mrb.ch.pastTitle')}
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16,
      }}>
        {past.map((pc) => {
          const winner = (pc.standings || [])[0];
          return (
            <div key={pc.id} style={{
              background: '#fff', border: '1px solid ' + C.line, borderRadius: 16, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 12,
              }}>
                <span style={{
                  background: C.surface, color: C.slate, borderRadius: 999,
                  padding: '3px 10px', fontWeight: 700,
                }}>{organiser(pc, t)}</span>
                <span style={{ color: C.dim }}>
                  {dateRange(pc)}
                </span>
              </div>

              <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700 }}>{pc.title}</div>

              {winner ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, background: C.goldBg,
                  border: '1px solid ' + C.goldBorder, borderRadius: 12, padding: '10px 12px',
                }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: '50%', background: C.deep, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                    boxShadow: '0 0 0 2px #fff, 0 0 0 4px ' + C.gold,
                  }}>{winner.initials}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: C.goldFg,
                    }}>{t('mrb.ch.champion')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{winner.name}</div>
                    <div style={{ fontSize: 12, color: C.dim }}>
                      {[winner.grade, winner.branch].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.dim }}>{t('mrb.ch.noChampion')}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: C.slate }}>
                {winner && <span>{t('mrb.ch.championStat', { pts: winner.points, books: winner.books })}</span>}
                <span style={{ color: C.dim }}>{t('mrb.ch.nReaders', { n: pc.participants })}</span>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {(pc.covers || []).slice(0, 6).map((src, i) => (
                  <Spine key={i} src={src} seed={pc.title + i} w={24} h={36} shadow="none" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ quiz modal */

const LETTERS = ['A', 'B', 'C', 'D'];

function QuizModal({ quiz, t, say, onClose, onDone }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const qs = quiz.questions || [];
  const q = qs[idx];
  const chosen = q ? answers[q.id] : undefined;
  const last = idx >= qs.length - 1;

  // The clock. The server is the one that decides whether time ran out — this
  // is the reader's view of it, started from what the server said was left, so
  // reloading the page does not hand out a fresh allowance.
  const [left, setLeft] = useState(
    typeof quiz.seconds_left === 'number' ? quiz.seconds_left : -1,
  );
  const timed = left >= 0 && !result;

  const submit = useCallback(async (auto) => {
    setBusy(true);
    try {
      const res = await api.post(`/challenges/${quiz.challengeID}/quiz`, {
        edition_id: quiz.book.edition_id, answers,
      });
      setResult(res.data);
    } catch (e) {
      const code = e.response?.data?.code;
      say(code === 'TIME_UP' ? t('mrb.ch.timeUp')
        : code === 'ALREADY_TAKEN' ? t('mrb.ch.alreadyTaken')
          : t('msg.opFailed'));
      if (auto) onClose();
    } finally { setBusy(false); }
  }, [answers, quiz, say, t, onClose]);

  useEffect(() => {
    if (!timed) return undefined;
    if (left === 0) {
      // Hand it in rather than losing what they answered.
      submit(true);
      return undefined;
    }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [timed, left, submit]);

  const clock = left >= 0
    ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
    : null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, padding: 28,
        display: 'flex', flexDirection: 'column', gap: 18,
        boxShadow: '0 24px 64px rgba(15,23,42,0.3)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: C.brandHi,
            }}>{t('mrb.ch.quizEyebrow')}</div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700 }}>{quiz.book.title}</div>
            {/* One go, and how long is left, said before they start rather
                than discovered at the end. */}
            <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
              {[
                quiz.pool_size > qs.length
                  ? t('mrb.ch.drawnFrom', { n: qs.length, pool: quiz.pool_size })
                  : '',
                t('mrb.ch.oneTryOnly'),
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {clock && !result && (
              // Under a minute turns coral. The clock is the server's, not the
              // browser's — this only draws what it was told.
              <span style={{
                fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 18,
                color: left <= 60 ? C.coralFg : C.deep,
                background: left <= 60 ? '#FFF1EE' : C.sky100,
                borderRadius: 999, padding: '5px 12px',
              }}>{clock}</span>
            )}
            <button onClick={onClose} aria-label={t('common.close')} style={{
              width: 36, height: 36, borderRadius: '50%', border: '1px solid ' + C.line,
              background: '#fff', cursor: 'pointer', fontSize: 14, color: C.body, flexShrink: 0,
            }}>✕</button>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
            {result ? t('mrb.ch.quizDone') : t('mrb.ch.quizStep', { n: idx + 1, total: qs.length })}
          </span>
          <div style={{ height: 6, background: C.sky100, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: (result ? 100 : ((idx + 1) / Math.max(1, qs.length)) * 100) + '%',
              height: '100%', background: C.brand, borderRadius: 999, transition: 'width .3s',
            }} />
          </div>
        </div>

        {result ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
            textAlign: 'center', padding: '8px 0',
          }}>
            <div style={{
              fontFamily: SERIF, fontSize: 56, fontWeight: 700, lineHeight: 1,
              color: result.passed ? C.okFg : C.coralFg,
            }}>
              {result.score}<span style={{ fontSize: 24, color: C.mute }}> / {result.total}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {result.passed ? t('mrb.ch.quizPassed') : t('mrb.ch.quizFailed')}
            </div>
            <div style={{ fontSize: 14, color: C.body, maxWidth: 380, lineHeight: 1.5 }}>
              {result.passed
                ? t('mrb.ch.quizPassedBody', { n: result.points_awarded })
                : t('mrb.ch.quizFailedBody', { n: quiz.pass_mark, total: result.total })}
            </div>
            {/* "Try again" used to be offered here. The quiz is one go now —
                the server refuses a second submission — so the button was an
                offer that could not be kept. */}
            <div style={{ fontSize: 12, color: C.mute }}>{t('mrb.ch.oneTryOnly')}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={onDone} style={{
                background: C.brand, color: '#fff', border: 0, borderRadius: 10, padding: '10px 18px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('mrb.ch.backToChallenge')}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>{q?.prompt}</div>

            {[q?.option_a, q?.option_b, q?.option_c, q?.option_d].map((opt, i) => {
              if (!opt) return null;
              const on = chosen === i;
              return (
                <button key={i} onClick={() => setAnswers({ ...answers, [q.id]: i })} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: on ? C.tint : '#fff',
                  border: '1.5px solid ' + (on ? C.brand : C.line),
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                  fontSize: 15, color: C.ink, fontFamily: 'inherit',
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: on ? C.brand : C.surface, color: on ? '#fff' : C.deep,
                    fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{LETTERS[i]}</span>
                  {opt}
                </button>
              );
            })}

            <button
              onClick={() => (last ? submit() : setIdx(idx + 1))}
              disabled={chosen === undefined || busy}
              style={{
                alignSelf: 'flex-end', marginTop: 6,
                background: chosen === undefined || busy ? C.sky200 : C.brand,
                color: '#fff', border: 0, borderRadius: 10, padding: '10px 22px',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                cursor: chosen === undefined || busy ? 'not-allowed' : 'pointer',
              }}
            >{last ? t('mrb.ch.finish') : t('mrb.ch.next')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------- a reader writing a question */

// A reader proposing a quiz question for the next person to read the book.
//
// It goes nowhere near the quiz until the library approves it — which is said
// on the form, because somebody who writes a question and then never sees it
// asked would reasonably think it had been lost.
function SuggestModal({ target, t, say, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const setOpt = (i) => (e) => setOpts(opts.map((o, j) => (j === i ? e.target.value : o)));
  const ready = prompt.trim() !== '' && opts.every((o) => o.trim() !== '');

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/challenges/${target.challengeID}/suggest`, {
        edition_id: target.book.edition_id,
        prompt: prompt.trim(),
        option_a: opts[0].trim(), option_b: opts[1].trim(),
        option_c: opts[2].trim(), option_d: opts[3].trim(),
        answer,
      });
      setSent(true);
    } catch (e) {
      const code = e.response?.data?.code;
      say(code === 'SUBMISSIONS_CLOSED' ? t('mrb.ch.sugClosed') : t('msg.opFailed'));
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, padding: 28,
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 64px rgba(15,23,42,0.3)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: C.brandHi,
            }}>{t('mrb.ch.sugEyebrow')}</div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700 }}>{target.book.title}</div>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid ' + C.line,
            background: '#fff', cursor: 'pointer', fontSize: 14, color: C.body, flexShrink: 0,
          }}>✕</button>
        </div>

        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 44 }}>✓</div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700 }}>{t('mrb.ch.sugThanks')}</div>
            <div style={{ fontSize: 14, color: C.body, textAlign: 'center', lineHeight: 1.5 }}>
              {t('mrb.ch.sugThanksBody')}
            </div>
            <button onClick={onClose} style={{
              background: C.brand, color: '#fff', border: 0, borderRadius: 10,
              padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', marginTop: 6,
            }}>{t('mrb.ch.backToChallenge')}</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: C.body, lineHeight: 1.5 }}>{t('mrb.ch.sugIntro')}</div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>{t('mrb.ch.sugPrompt')}</span>
              <textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                rows={2} placeholder={t('mrb.ch.sugPromptHint')}
                style={{
                  border: '1px solid ' + C.line, borderRadius: 12, padding: '10px 12px',
                  fontSize: 14, fontFamily: 'inherit', resize: 'vertical', color: C.body,
                }}
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>{t('mrb.ch.sugOptions')}</span>
              {opts.map((o, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="radio" name="sug-answer" checked={answer === i}
                    onChange={() => setAnswer(i)} aria-label={t('mrb.ch.sugCorrect')} />
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: answer === i ? C.brand : C.sky100,
                    color: answer === i ? '#fff' : C.deep,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                  }}>{LETTERS[i]}</span>
                  <input
                    value={o} onChange={setOpt(i)} placeholder={t('mrb.ch.sugOptionHint')}
                    style={{
                      flex: 1, minWidth: 0, border: '1px solid ' + C.line, borderRadius: 10,
                      padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: C.body,
                    }}
                  />
                </label>
              ))}
              <span style={{ fontSize: 12, color: C.mute }}>{t('mrb.ch.sugCorrectNote')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} style={{
                background: '#fff', color: C.deep, border: '1px solid ' + C.sky200,
                borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('common.cancel')}</button>
              <button onClick={send} disabled={busy || !ready} style={{
                background: ready ? C.brand : C.sky200, color: '#fff', border: 0,
                borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700,
                cursor: ready ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>{t('mrb.ch.sugSend')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
