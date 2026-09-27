// Staff console tokens, from Staff Design System.dc.html.
//
// Same brand as the reader app, but a deep-blue shell with denser type, tables
// and role colours, so staff always know they are in admin mode.

export const shell = {
  bg: '#082F49',       // sidebar
  navActive: '#0C4A6E',
  navText: '#BAE6FD',
  canvas: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  control: '#CBD5E1',
  headerBg: '#F8FAFC',
  rowLine: '#F1F5F9',   // the hairline between table rows
  rowSelected: '#F0F9FF',
};

export const ink = {
  text: '#0F172A',
  strong: '#334155',
  body: '#475569',
  dim: '#64748B',
  muted: '#94A3B8',
};

export const primary = { base: '#1B9DD9', hover: '#1580B5', deep: '#075985' };

export const danger = { base: '#D93A41', text: '#B4232A', tint: '#FFF1EE', border: '#FFD6CF' };

// Role accents. The chip is [bg, text]; accent is the sidebar/rule colour.
export const ROLE = {
  librarian: { accent: '#0D9488', chip: ['#CCFBF1', '#115E59'], label: 'Librarian' },
  teacher: { accent: '#D97706', chip: ['#FEF3C7', '#92400E'], label: 'Teacher' },
  admin: { accent: '#7C3AED', chip: ['#EDE9FE', '#5B21B6'], label: 'Admin' },
  manager: { accent: '#7C3AED', chip: ['#EDE9FE', '#5B21B6'], label: 'Manager' },
};

export const roleOf = (r) => ROLE[r] || ROLE.librarian;

// Radius: 5 checkbox · 8 control · 10 alert · 12 card · 16 modal · 999 pill
export const radius = { check: 5, control: 8, alert: 10, card: 12, modal: 16, pill: 999 };

export const font = {
  ui: "'Noto Sans', system-ui, sans-serif",
  display: "'Source Serif 4', Georgia, serif",
  base: 13, // the console runs denser than the reader app
};

export const ROW_HEIGHT = 44;
export const SIDEBAR_WIDTH = 236;

// Overdue severity: amber 1–6, orange 7–13, coral 14+.
export function overdueColors(days) {
  if (days >= 14) return ['#FFF1EE', '#B4232A'];
  if (days >= 7) return ['#FFEDD5', '#9A3412'];
  if (days >= 1) return ['#FEF3C7', '#92400E'];
  return ['#F1F5F9', '#475569'];
}

// Status pills are colour *and* words, never colour alone.
export const STATUS_PILL = {
  available: ['#DCFCE7', '#166534'],  // Available
  out: ['#E0F2FE', '#075985'],        // On loan
  in: ['#DCFCE7', '#166534'],         // Returned
  hold: ['#FEF3C7', '#92400E'],       // On hold · Waiting
  ready: ['#CCFBF1', '#115E59'],      // Ready for pickup
  overdue: ['#FFF1EE', '#B4232A'],    // Overdue · Open report
  damaged: ['#FFEDD5', '#9A3412'],    // Damaged
  lost: ['#F1F5F9', '#475569'],       // Lost · Never shared
  invited: ['#EDE9FE', '#5B21B6'],    // Invited · Spoiler
  active: ['#DCFCE7', '#166534'],     // Active · Resolved
  pending: ['#E0F2FE', '#075985'],
  neutral: ['#F1F5F9', '#475569'],
};

// Alerts: radius 10, 10px 12px, weight 600. [bg, border, text]
export const ALERT = {
  problem: ['#FFF1EE', '#FFD6CF', '#B4232A'],
  action: ['#FEF3C7', '#FDE68A', '#92400E'],
  approval: ['#EDE9FE', '#EDE9FE', '#5B21B6'],
  done: ['#DCFCE7', '#DCFCE7', '#166534'],
};

export const pill = (kind) => STATUS_PILL[kind] || STATUS_PILL.neutral;
