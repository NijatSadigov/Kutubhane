// The wide staff table.
//
// It lives outside StaffShell.jsx so that file stays under the size where the
// React compiler's lint rules give up analysing it. Its row *style* is in
// theme.js, with the console's other style helpers.

import { shell, ink, radius } from '../theme';

// A wide staff table keeps its columns and scrolls sideways rather than
// wrapping, which is what the design system says to do. `min` is the width
// below which it starts scrolling.
export function ScrollTable({ min, columns, head, children, empty }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid ' + shell.border,
      borderRadius: radius.card, overflowX: 'auto',
    }}>
      <div style={{ minWidth: min }}>
        <div style={{
          display: 'grid', gridTemplateColumns: columns, gap: 12, alignItems: 'center',
          padding: '10px 16px', background: shell.headerBg,
          borderBottom: '1px solid ' + shell.border,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: ink.dim,
        }}>
          {head.map((h, i) => (
            <span key={i} style={i === head.length - 1 ? { textAlign: 'right' } : undefined}>{h}</span>
          ))}
        </div>
        {children}
        {empty && (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: ink.dim }}>{empty}</div>
        )}
      </div>
    </div>
  );
}
