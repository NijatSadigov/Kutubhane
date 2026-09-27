// The logged-out reader surface: the catalogue and book pages a guest may
// browse, under the same header the landing page and the app use.
//
// Everything here is read-only. Borrowing, shelving, reviewing and logging all
// belong to a school account, so those controls invite the visitor to sign in
// rather than appearing and then failing.

import { slate, font, layout } from './theme';
import SiteHeader, { GuestTail } from './components/SiteHeader';
import { GuestContext } from './guest';
import './responsive.css';

// A layout, not a router: App.jsx registers the two public paths and wraps
// each screen in this. Nesting a second <Routes> under a non-splat path would
// match nothing, which is how the page came up empty.
export default function PublicShell({ children }) {
  return (
    <GuestContext.Provider value>
      <div style={{ minHeight: '100vh', background: slate.bg, fontFamily: font.ui, color: slate.text }}>
        <SiteHeader guest tail={<GuestTail />} />
        <main style={{
          maxWidth: layout.maxWidth, margin: '0 auto',
          padding: '32px var(--mrb-gutter) 96px',
        }}>{children}</main>
      </div>
    </GuestContext.Provider>
  );
}
