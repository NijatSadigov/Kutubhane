// Sinif oxusu — one class's reading, for the teacher who takes it.
//
// The school analytics screen answers "which class needs attention". This is
// the screen you open next: the children in that class, and which of them have
// not picked anything up.
//
// The roster is sorted by who has read least, for the same reason the class
// table on the analytics screen is: a teacher is not looking for their best
// reader. A child who has borrowed nothing in the period is called out rather
// than left as a row of zeroes to be scanned for.
//
// Which children: matched on grade and class group, the pair every reading
// feature groups on — not students.classroom_id, which is the dərslik roster
// and drifts from it. See handlers/teacherclass.go.

import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, pill } from '../theme';
import { Card, Kpi, KpiRow, Pill, Btn, Alert, PageIntro, Table, Row } from '../components/StaffShell';

const PERIODS = [30, 90, 365];
const BAR = '#D97706'; // the teacher accent, per staff/theme.js

export default function ClassReading() {
  const { t } = useTranslation();
  const [classes, setClasses] = useState(null);
  const [picked, setPicked] = useState(null); // { grade, class_group }
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  // The class list first, so the switcher can show before any class loads.
  useEffect(() => {
    let alive = true;
    api.get('/teacher/classes')
      .then((r) => {
        if (!alive) return;
        const list = r.data.classes || [];
        setClasses(list);
        if (list.length > 0) setPicked({ grade: list[0].grade, group: list[0].class_group });
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!picked) return undefined;
    let alive = true;
    api.get(`/teacher/class?grade=${picked.grade}&group=${encodeURIComponent(picked.group)}&days=${days}`)
      .then((r) => { if (alive) { setData(r.data); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [picked, days]);

  const totals = data?.totals || {};
  const weeks = data?.weeks || [];

  // Least-read first: the children who need a nudge are the point of the page.
  const roster = useMemo(
    () => [...(data?.roster || [])].sort((a, b) => (a.books - b.books) || (a.pages - b.pages)),
    [data],
  );
  const peak = useMemo(
    () => (data?.weeks || []).reduce((m, w) => Math.max(m, w.loans || 0), 0),
    [data],
  );

  if (classes === null && !failed) return <PageIntro>{t('common.loading')}</PageIntro>;
  if (failed && !data) return <Alert tone="problem">{t('staff.cr.failed')}</Alert>;
  // A teacher with no classes assigned is a real state, and the fix is an
  // administrative one, so say which.
  if (classes && classes.length === 0) {
    return <Alert tone="action">{t('staff.cr.noClasses')}</Alert>;
  }

  return (
    <>
      <PageIntro>{t('staff.cr.intro')}</PageIntro>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(classes || []).map((c) => {
          const on = picked && picked.grade === c.grade && picked.group === c.class_group;
          return (
            <Btn key={c.label} kind={on ? 'primary' : 'secondary'}
              onClick={() => setPicked({ grade: c.grade, group: c.class_group })}
              style={{ padding: '6px 12px' }}>
              {c.label} · {c.readers}
            </Btn>
          );
        })}
        {/* Two switchers in one row, each with its own selected state, read as
            a single group of five buttons without something between them. */}
        <span style={{
          width: 1, alignSelf: 'stretch', background: shell.border, margin: '0 6px',
        }} />
        {PERIODS.map((d) => (
          <Btn key={d} kind={d === days ? 'primary' : 'secondary'} onClick={() => setDays(d)}
            style={{ padding: '6px 12px' }}>
            {t('staff.an.lastDays', { n: d })}
          </Btn>
        ))}
      </div>

      {!data ? <PageIntro>{t('common.loading')}</PageIntro> : (
        <>
          <KpiRow>
            <Kpi label={t('staff.cr.readers')} value={totals.readers ?? 0} />
            <Kpi label={t('staff.an.activeReaders')} value={totals.active_readers ?? 0}
              note={t('staff.an.ofAll', { pct: totals.active_pct ?? 0 })} />
            <Kpi label={t('staff.cr.booksFinished')} value={totals.books ?? 0} />
            <Kpi label={t('staff.an.pagesPeriod')} value={(totals.pages ?? 0).toLocaleString()} />
            <Kpi label={t('staff.an.quizzes')} value={totals.quizzes ?? 0} />
          </KpiRow>

          {totals.overdue > 0 && (
            <Alert tone="problem">
              {t('staff.cr.overdueWarn', { n: totals.overdue })}
            </Alert>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '2 1 520px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: ink.strong }}>
                {t('staff.cr.roster')}
              </h2>
              <div style={{ fontSize: 12, color: ink.dim }}>{t('staff.cr.rosterHint')}</div>
              <Table
                columns="1.6fr .6fr .7fr .6fr .6fr .9fr"
                head={[t('staff.cr.pupil'), t('staff.cr.books'), t('staff.an.pages'),
                  t('staff.cr.streak'), t('staff.an.quizzes'), t('staff.cr.onLoan')]}
                empty={roster.length === 0 ? t('staff.cr.noPupils') : null}
              >
                {roster.map((r) => (
                  <Row key={r.user_id} columns="1.6fr .6fr .7fr .6fr .6fr .9fr">
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span>
                      {r.books === 0
                        // The row worth seeing at a glance.
                        ? <Pill colors={pill('overdue')}>0</Pill>
                        : r.books}
                    </span>
                    <span>{(r.pages || 0).toLocaleString()}</span>
                    <span>{r.streak > 0 ? '🔥 ' + r.streak : '—'}</span>
                    <span>{r.quizzes || '—'}</span>
                    <span>
                      {r.open_loans === 0 ? '—' : (
                        <>
                          {r.open_loans}
                          {r.overdue > 0 && (
                            <> <Pill colors={pill('overdue')}>{t('staff.cr.lateN', { n: r.overdue })}</Pill></>
                          )}
                        </>
                      )}
                    </span>
                  </Row>
                ))}
              </Table>
            </div>

            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: ink.strong }}>
                {t('staff.an.trend')}
              </h2>
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
            </div>
          </div>

          <div style={{ fontSize: 12, color: ink.dim, lineHeight: 1.5, borderTop: '1px solid ' + shell.rowLine, paddingTop: 10 }}>
            {t('staff.cr.note')}
          </div>
        </>
      )}
    </>
  );
}
