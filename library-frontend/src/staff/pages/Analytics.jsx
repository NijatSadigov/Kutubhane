// Analitika — the screen a school administrator never had.
//
// It is the only place in the product that answers "how is my school actually
// reading", and it is built from the ledgers the daily work already writes:
// loans, the reading diary, quiz attempts, the textbook movements. Nothing is
// entered by hand for it, which is the point — a report nobody has to fill in
// is a report that still exists in March.
//
// Two labels here are doing careful work and should not be loosened:
//
//   - "pages" is the furthest page reached in each book, summed, exactly as a
//     reader sees on their own shelf. A reader who checks gets the same answer.
//   - the textbook figure is "accounted for", not "returned". A book still out
//     mid-year is not missing, and calling 23% a recovery rate in September
//     would be alarming and wrong.

import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { ink, pill } from '../theme';
import { Card, Kpi, KpiRow, Pill, Btn, Alert, PageIntro, Table, Row } from '../components/StaffShell';

const PERIODS = [30, 90, 365];
const BAR = '#1B9DD9';

export default function Analytics() {
  const { t } = useTranslation();
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // The previous period's figures stay on screen until the new ones arrive,
  // rather than blanking to a spinner on every click of the period buttons.
  useEffect(() => {
    let alive = true;
    api.get(`/analytics/school?days=${days}`)
      .then((r) => { if (alive) { setData(r.data); setFailed(false); } })
      .catch(() => { if (alive) { setData(null); setFailed(true); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const totals = data?.totals || {};
  const branches = data?.branches || [];
  const weeks = data?.weeks || [];
  const top = data?.top_titles || [];
  const tb = data?.textbooks || {};

  // Sorted by how few of them are reading, because the question a head teacher
  // asks is which class needs attention — not which one is winning.
  const classRows = useMemo(
    () => [...(data?.classes || [])].sort((a, b) => a.active_pct - b.active_pct),
    [data],
  );
  const peak = useMemo(
    () => (data?.weeks || []).reduce((m, w) => Math.max(m, w.loans || 0), 0),
    [data],
  );

  if (loading && !data) return <PageIntro>{t('common.loading')}</PageIntro>;
  // A failed request and a school with nothing in it are different states and
  // must not share one empty screen — that confusion has bitten this codebase
  // before.
  if (failed) return <Alert tone="problem">{t('staff.an.failed')}</Alert>;

  return (
    <>
      <PageIntro>{t('staff.an.intro')}</PageIntro>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {PERIODS.map((d) => (
          <Btn key={d} kind={d === days ? 'primary' : 'secondary'} onClick={() => setDays(d)}
            style={{ padding: '6px 12px' }}>
            {t('staff.an.lastDays', { n: d })}
          </Btn>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: ink.dim }}>{data?.school?.name}</span>
      </div>

      <KpiRow>
        <Kpi label={t('staff.an.readers')} value={totals.readers ?? 0} />
        <Kpi label={t('staff.an.activeReaders')} value={totals.active_readers ?? 0}
          note={t('staff.an.ofAll', { pct: totals.active_pct ?? 0 })} />
        <Kpi label={t('staff.an.loans')} value={totals.loans ?? 0}
          note={t('staff.an.perReader', { n: (totals.loans_per_reader ?? 0).toFixed(1) })} />
        <Kpi label={t('staff.an.pagesPeriod')} value={fmt(totals.pages_in_period)} />
        <Kpi label={t('staff.an.quizzes')} value={totals.quizzes_passed ?? 0} />
      </KpiRow>

      {/* The number worth acting on is the low one. */}
      {totals.readers > 0 && (totals.active_pct ?? 0) < 50 && (
        <Alert tone="action">
          {t('staff.an.lowActive', {
            pct: totals.active_pct ?? 0,
            n: (totals.readers ?? 0) - (totals.active_readers ?? 0),
          })}
        </Alert>
      )}

      <Section title={t('staff.an.byBranch')} note={t('staff.an.perCapNote')}>
        <Table
          columns="1.6fr .7fr .7fr .8fr 1fr"
          head={[t('staff.an.branch'), t('staff.an.readers'), t('staff.an.loans'),
            t('staff.an.activeShort'), t('staff.an.pagesPerReader')]}
          empty={branches.length === 0 ? t('staff.an.noBranches') : null}
        >
          {branches.map((b) => (
            <Row key={b.id} columns="1.6fr .7fr .7fr .8fr 1fr">
              <span style={{ fontWeight: 600 }}>{b.name}</span>
              <span>{b.readers}</span>
              <span>{b.loans}</span>
              <span><Pill colors={pill(b.active_pct >= 50 ? 'active' : 'neutral')}>{b.active_pct}%</Pill></span>
              <span>{fmt(b.pages_per_reader)}</span>
            </Row>
          ))}
        </Table>
      </Section>

      <Section title={t('staff.an.byClass')} subtitle={t('staff.an.byClassHint')}>
        <Table
          columns="1fr .8fr .8fr .8fr .8fr"
          head={[t('staff.an.class'), t('staff.an.readers'), t('staff.an.activeShort'),
            t('staff.an.loans'), t('staff.an.pages')]}
          empty={classRows.length === 0 ? t('staff.an.noClasses') : null}
        >
          {classRows.map((c) => (
            <Row key={`${c.grade}-${c.class_group}`} columns="1fr .8fr .8fr .8fr .8fr">
              <span style={{ fontWeight: 600 }}>
                {c.grade > 0
                  ? c.grade + (c.class_group ? '-' + c.class_group : '')
                  // A reader with no class signed up through a link that set
                  // none. Named rather than hidden: they sit outside every
                  // class standing until someone fixes it.
                  : <span style={{ color: ink.dim, fontWeight: 400 }}>{t('staff.an.noClass')}</span>}
              </span>
              <span>{c.readers}</span>
              <span>
                <Pill colors={pill(c.active_pct >= 50 ? 'active' : c.active_pct > 0 ? 'hold' : 'overdue')}>
                  {c.active_pct}%
                </Pill>
              </span>
              <span>{c.loans}</span>
              <span>{fmt(c.pages)}</span>
            </Row>
          ))}
        </Table>
      </Section>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Section title={t('staff.an.trend')}>
            {weeks.length === 0 ? (
              <Alert tone="action">{t('staff.an.noTrend')}</Alert>
            ) : (
              <Card>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 130 }}>
                  {weeks.map((w) => (
                    <div key={w.week} style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      gap: 4, alignItems: 'center', justifyContent: 'flex-end',
                    }}>
                      <div style={{ fontSize: 11, color: ink.dim }}>{w.loans}</div>
                      <div style={{
                        width: '100%',
                        height: Math.max(4, Math.round((w.loans / (peak || 1)) * 84)),
                        background: BAR, borderRadius: 4,
                      }} />
                      <div style={{ fontSize: 10, color: ink.dim }}>{w.week.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </Section>
        </div>

        <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Section title={t('staff.an.topTitles')}>
            <Table
              columns="1fr auto"
              head={[t('staff.an.title'), t('staff.an.loans')]}
              empty={top.length === 0 ? t('staff.an.noLoans') : null}
            >
              {top.map((b) => (
                <Row key={b.title} columns="1fr auto">
                  <span style={{ fontWeight: 600 }}>{b.title}</span>
                  <span>{b.loans}</span>
                </Row>
              ))}
            </Table>
          </Section>
        </div>
      </div>

      <Section title={t('staff.an.textbooks')} note={t('staff.an.tbNote')}>
        <KpiRow>
          <Kpi label={t('staff.an.tbIssued')} value={fmt(tb.issued)} />
          <Kpi label={t('staff.an.tbOutstanding')} value={fmt(tb.outstanding)} />
          <Kpi label={t('staff.an.tbReturned')} value={fmt(tb.returned)} />
          <Kpi label={t('staff.an.tbWrittenOff')} value={fmt(tb.written_off)} />
          <Kpi label={t('staff.an.tbAccounted')} value={(tb.accounted_pct ?? 0) + '%'} />
        </KpiRow>
      </Section>

      <div style={{ fontSize: 12, color: ink.dim, lineHeight: 1.5 }}>
        {t('staff.an.derivedNote')}
      </div>
    </>
  );
}

const fmt = (n) => (n === null || n === undefined ? '0' : Number(n).toLocaleString());

function Section({ title, subtitle, note, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <h2 style={{
          margin: 0, fontSize: 15, fontWeight: 800, color: ink.strong, letterSpacing: '0.01em',
        }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 12, color: ink.dim, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
      {note && <div style={{ fontSize: 12, color: ink.dim, lineHeight: 1.5 }}>{note}</div>}
    </section>
  );
}
