// Moderasiya — what readers report, and what was done about it.
//
// The reporting half has always worked; this is the half where a person
// decides. Before it, a report went into a table no screen could reach.
//
// Four decisions, matching the resolutions the model names:
//
//   KEEP         nothing is wrong — close it so the queue stops asking
//   SPOILER_TAG  hide the text behind a spoiler warning, not remove it;
//                the right answer to most of what children report
//   HIDE         take it off every reader-facing surface
//   HIDE_WARN    the same, and the school speaks to the child — which
//                happens outside the software, so the only difference here
//                is what the record says was decided
//
// A hidden review is never deleted. It stays so a teacher or a parent can
// still see what was written, and it can be restored.

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, pill } from '../theme';
import { Pill, Btn, Alert, PageIntro, Chip } from '../components/StaffShell';

// t() hands back the key when nothing matches, so a reason code we have no
// wording for yet shows as the code rather than as "staff.mod.reason.XYZ".
function label(t, prefix, code) {
  if (!code) return '—';
  const out = t(prefix + code);
  return out === prefix + code ? code : out;
}

export default function Moderation() {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState({ reports: [], open: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(0);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(() => {
    api.get(`/moderation/reports${showAll ? '?state=all' : ''}`)
      .then((r) => { setData(r.data); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, resolution) => {
    setBusy(id);
    try {
      await api.put(`/moderation/reports/${id}`, { resolution });
      say(t('staff.mod.done'));
      load();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(0); }
  };

  const unhide = async (reviewId) => {
    setBusy(reviewId);
    try {
      await api.put(`/moderation/reviews/${reviewId}/unhide`);
      say(t('staff.mod.restored'));
      load();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(0); }
  };

  if (loading) return <PageIntro>{t('common.loading')}</PageIntro>;
  if (failed) return <Alert tone="problem">{t('staff.mod.failed')}</Alert>;

  const rows = data.reports || [];

  return (
    <>
      <PageIntro>{t('staff.mod.intro')}</PageIntro>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip on={!showAll} onClick={() => setShowAll(false)}>
          {t('staff.mod.openOnly', { n: data.open || 0 })}
        </Chip>
        <Chip on={showAll} onClick={() => setShowAll(true)}>{t('staff.mod.all')}</Chip>
      </div>

      {toast && <Alert tone="action">{toast}</Alert>}

      {rows.length === 0 ? (
        // An empty queue is good news here, so it should read as good news
        // rather than as a screen that failed to load.
        <Alert tone="action">
          {showAll ? t('staff.mod.noneEver') : t('staff.mod.noneOpen')}
        </Alert>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} style={{
              background: '#fff', border: '1px solid ' + shell.border,
              borderRadius: radius.card, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 10,
              opacity: r.resolved ? 0.72 : 1,
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pill colors={pill(r.resolved ? 'lost' : 'overdue')}>
                  {r.resolved ? label(t, 'staff.mod.res.', r.resolution) : label(t, 'staff.mod.reason.', r.reason)}
                </Pill>
                <span style={{ fontSize: 13, color: ink.dim }}>
                  {t('staff.mod.reportedBy', { who: r.reporter_name || '—' })}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: ink.dim }}>
                  {r.work_title}
                </span>
              </div>

              {r.note && (
                <div style={{ fontSize: 13, color: ink.dim, fontStyle: 'italic' }}>“{r.note}”</div>
              )}

              {/* The review itself. A moderator deciding without reading it is
                  the failure mode this screen exists to prevent. */}
              <div style={{
                background: shell.headerBg, borderRadius: radius.control,
                padding: '12px 14px', fontSize: 14, color: ink.text, lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 12, color: ink.dim, marginBottom: 4 }}>
                  {r.author_name}{r.author_class ? ' · ' + r.author_class : ''}
                  {r.rating ? ' · ★ ' + r.rating.toFixed(1) : ''}
                </div>
                {r.review_text || <span style={{ color: ink.dim }}>{t('staff.mod.noText')}</span>}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {r.review_hidden && <Pill colors={pill('lost')}>{t('staff.mod.isHidden')}</Pill>}
                {r.review_spoiler && <Pill colors={pill('hold')}>{t('staff.mod.isSpoiler')}</Pill>}

                {!r.resolved ? (
                  <>
                    <Btn kind="secondary" disabled={busy === r.id}
                      onClick={() => resolve(r.id, 'KEEP')}>{t('staff.mod.res.KEEP')}</Btn>
                    <Btn kind="secondary" disabled={busy === r.id}
                      onClick={() => resolve(r.id, 'SPOILER_TAG')}>{t('staff.mod.res.SPOILER_TAG')}</Btn>
                    <Btn kind="danger" disabled={busy === r.id}
                      onClick={() => resolve(r.id, 'HIDE')}>{t('staff.mod.res.HIDE')}</Btn>
                    <Btn kind="dangerSolid" disabled={busy === r.id}
                      onClick={() => resolve(r.id, 'HIDE_WARN')}>{t('staff.mod.res.HIDE_WARN')}</Btn>
                  </>
                ) : r.review_hidden || r.review_spoiler ? (
                  // A moderator can be wrong, and without this a mistake was
                  // permanent.
                  <Btn kind="secondary" disabled={busy === r.review_id}
                    onClick={() => unhide(r.review_id)}>{t('staff.mod.restore')}</Btn>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: ink.dim, lineHeight: 1.5 }}>
        {t('staff.mod.note')}
      </div>
    </>
  );
}
