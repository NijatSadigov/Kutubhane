// Dates in the language the reader chose.
//
// Every screen used to call `toLocaleDateString()` with no locale, so dates
// came out in the *browser's* language: an Azerbaijani student reading an
// Azerbaijani page was told it was "Sunday, September 27". There were 37 of
// those calls.
//
// Intl cannot be trusted for Azerbaijani. Chrome reports `az` as supported and
// then formats it as "M09 27, Sun" — a stub with no month names. So `az` is
// formatted from the tables below, and `tr`/`en` go through Intl.


const AZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
];
const AZ_MONTHS_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avq', 'sen', 'okt', 'noy', 'dek',
];
// Azerbaijani weeks start on Sunday in Date.getDay() order.
const AZ_DAYS = [
  'bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə',
  'cümə axşamı', 'cümə', 'şənbə',
];

const INTL_LOCALE = { tr: 'tr-TR', en: 'en-GB' };

// The active language, published by LanguageProvider. Dates are formatted in
// dozens of small presentational components that receive `t` as a prop and
// never touch the context themselves; thread a `lang` argument through all of
// them and one will eventually be forgotten, which is how they ended up in the
// browser's locale in the first place. There is exactly one provider, and
// changing the language re-renders everything under it.
let current = 'az';

export function setDateLang(lang) { current = lang; }
export function getDateLang() { return current; }

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pad = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------ formatters */

// 27.09.2026 · 27/09/2026 — the short form for tables and metadata.
export function fmtDate(value) {
  const d = asDate(value);
  if (!d) return '—';
  if (current === 'az') return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[current] || 'en-GB').format(d);
}

// 27 sentyabr 2026 — where the month should read as a word.
export function fmtDateLong(value) {
  const d = asDate(value);
  if (!d) return '—';
  if (current === 'az') return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[current] || 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

// bazar, 27 sentyabr — Discover's greeting line.
export function fmtWeekdayDay(value) {
  const d = asDate(value);
  if (!d) return '';
  if (current === 'az') return `${AZ_DAYS[d.getDay()]}, ${d.getDate()} ${AZ_MONTHS[d.getMonth()]}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[current] || 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
}

// 27 sen — the desk's compact "today" stamp.
export function fmtDayMonth(value) {
  const d = asDate(value);
  if (!d) return '';
  if (current === 'az') return `${d.getDate()} ${AZ_MONTHS_SHORT[d.getMonth()]}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[current] || 'en-GB', {
    day: 'numeric', month: 'short',
  }).format(d);
}

// sentyabr 2026 — the diary's month headings.
export function fmtMonthYear(value) {
  const d = asDate(value);
  if (!d) return '';
  if (current === 'az') return `${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[current] || 'en-GB', {
    month: 'long', year: 'numeric',
  }).format(d);
}

// 14:05 — 24-hour everywhere; none of these languages uses AM/PM.
export function fmtTime(value) {
  const d = asDate(value);
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------- numbers */

// 1 234 in az/tr, 1,234 in en — same reasoning as the dates.
export function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat(current === 'az' ? 'tr-TR' : (INTL_LOCALE[current] || 'en-GB'))
    .format(Number(n));
}
