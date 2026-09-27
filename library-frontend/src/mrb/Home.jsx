// The site's main page.
//
// A logged-out visitor gets the 00 Landing screen from the design. A signed-in
// visitor goes to whichever home their role belongs to — a reader into the
// app, a librarian into the staff console.

import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Landing from './pages/Landing';
import { slate, font } from './theme';
import { homePathFor } from '../home';

export default function Home() {
  const { user, loading } = useContext(AuthContext);

  // Wait for the session check before choosing, or a signed-in visitor sees
  // the guest landing flash past on every refresh.
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: slate.bg, color: slate.muted, fontFamily: font.ui, fontSize: 14,
      }}>…</div>
    );
  }

  if (user) return <Navigate to={homePathFor(user)} replace />;
  return <Landing />;
}
