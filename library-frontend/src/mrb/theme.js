// Design tokens for myredbookshelf, transcribed from the design handoff
// (design_handoff_myredbookshelf/README.md, "Design Tokens").
//
// The prototype writes colours inline; keeping them here instead means a token
// is changed in one place. Values are copied exactly — do not "tidy" them.

export const brand = {
  primary: '#1B9DD9',
  hover: '#1580B5',
  deep: '#075985',
  tint50: '#F0F9FF',
  tint100: '#E0F2FE',
  tint200: '#BAE6FD',
  tint300: '#7DD3FC',
  red: '#F2545B',        // logo
  wordmarkRed: '#DC3B42',
};

export const slate = {
  bg: '#F8FAFC',
  surface: '#F1F5F9',
  border: '#E2E8F0',
  border2: '#CBD5E1',
  muted: '#94A3B8',
  dim: '#64748B',
  body: '#475569',
  strong: '#334155',
  text: '#0F172A',
  white: '#FFFFFF',
};

export const danger = {
  base: '#F2545B',
  text: '#B4232A',
  textSoft: '#D93A41',
  tint: '#FFF1EE',
  border: '#FFD6CF',
};

export const warning = { tint: '#FEF3C7', text: '#92400E' };

// [fill, tint, text] — the eight genres named in the handoff.
export const GENRE_COLORS = {
  'Science Fiction': ['#7C3AED', '#EDE9FE', '#5B21B6'],
  'World Classics': ['#BE123C', '#FFE4E6', '#9F1239'],
  'History': ['#D97706', '#FEF3C7', '#92400E'],
  'Fantasy': ['#16A34A', '#DCFCE7', '#166534'],
  'Fiction': ['#0D9488', '#CCFBF1', '#115E59'],
  'Azerbaijani Literature': ['#EA580C', '#FFEDD5', '#9A3412'],
  'History & Epic': ['#A16207', '#FEF9C3', '#854D0E'],
  'Philosophy': ['#4F46E5', '#E0E7FF', '#3730A3'],
};

// The handoff names eight genres in English, but genres in this system are
// per-branch lookup rows that librarians name themselves, in Azerbaijani or
// Turkish ("Tarixi Roman", "Distopya", "Uşaq Ədəbiyyatı"). Anything not in the
// table above gets a stable colour derived from its name, so an unknown genre
// still reads as a distinct, consistent chip rather than falling back to grey.
const FALLBACK_GENRE_COLORS = [
  ['#7C3AED', '#EDE9FE', '#5B21B6'],
  ['#BE123C', '#FFE4E6', '#9F1239'],
  ['#D97706', '#FEF3C7', '#92400E'],
  ['#16A34A', '#DCFCE7', '#166534'],
  ['#0D9488', '#CCFBF1', '#115E59'],
  ['#EA580C', '#FFEDD5', '#9A3412'],
  ['#A16207', '#FEF9C3', '#854D0E'],
  ['#4F46E5', '#E0E7FF', '#3730A3'],
  ['#0369A1', '#E0F2FE', '#075985'],
  ['#9D174D', '#FCE7F3', '#831843'],
];

export function genreColors(name) {
  if (!name) return ['#94A3B8', '#F1F5F9', '#475569'];
  if (GENRE_COLORS[name]) return GENRE_COLORS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_GENRE_COLORS[h % FALLBACK_GENRE_COLORS.length];
}

// [bg, text]
export const CEFR_COLORS = {
  A2: ['#DCFCE7', '#166534'],
  B1: ['#CCFBF1', '#115E59'],
  B2: ['#FEF3C7', '#92400E'],
  C1: ['#FFE4E6', '#9F1239'],
};

export const cefrColors = (level) => CEFR_COLORS[level] || ['#F1F5F9', '#475569'];

export const radius = {
  chip: 8, button: 8, input: 12, smallCard: 12,
  card: 16, hero: 18, pill: 999,
};

export const shadow = {
  card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)',
  cover: '0 6px 16px rgba(15,23,42,.14)',
  modal: '0 24px 64px rgba(15,23,42,.3)',
};

export const font = {
  ui: "'Noto Sans', system-ui, sans-serif",
  display: "'Source Serif 4', Georgia, serif",
};

export const layout = {
  maxWidth: 1360,
  pagePadding: 40,
};

// Cover placeholders in the prototype are typographic: a coloured block with
// the title and author set in it. Real covers replace them when a book has one.
// The colour pair is derived from the title so a given book always looks the
// same, rather than flickering between renders.
const COVER_PALETTE = [
  ['#7C2D12', '#FED7AA'], ['#EA580C', '#FFF7ED'], ['#0C4A6E', '#FDE68A'],
  ['#1E293B', '#FBCFE8'], ['#B91C1C', '#FEF3C7'], ['#14532D', '#D9F99D'],
  ['#991B1B', '#F8FAFC'], ['#312E81', '#E0E7FF'], ['#365314', '#FEF08A'],
  ['#9D174D', '#FCE7F3'], ['#57534E', '#FAFAF9'], ['#15803D', '#F0FDF4'],
  ['#1D4ED8', '#FFFFFF'], ['#1E3A8A', '#FDE68A'], ['#CA8A04', '#1C1917'],
  ['#0F766E', '#FEF9C3'],
];

export function coverColors(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}
