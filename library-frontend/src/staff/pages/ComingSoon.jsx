// A domain the rail lists but that has nothing behind it yet.
//
// The rail could have hidden these, or greyed them out and swallowed the click.
// Both lie about the shape of the product: the buyer asked for Dərslik sistemi,
// Layihələr and their settings to be *there*, so the rail names them and this
// page says plainly what will live in each and what it is waiting on. The one
// alert uses the design's `approval` tone (#EDE9FE / #5B21B6) — the console's
// colour for "somebody else's move next".

import { useTranslation } from '../../i18n/LanguageContext';
import { ink } from '../theme';
import { Card, Alert } from '../components/StaffShell';

export default function ComingSoon({ titleKey, bodyKey, blockedKey }) {
  const { t } = useTranslation();
  return (
    <>
      <Alert tone="approval">{t('staff.soon.banner')}</Alert>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t(titleKey)}</h2>
          <p style={{ margin: 0, fontSize: 13, color: ink.body, lineHeight: 1.6 }}>
            {t(bodyKey)}
          </p>
          {blockedKey && (
            <p style={{ margin: 0, fontSize: 12, color: ink.dim, lineHeight: 1.6 }}>
              {t(blockedKey)}
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
