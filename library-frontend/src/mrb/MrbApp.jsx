// myredbookshelf — the reader-facing social app described in
// design_handoff_myredbookshelf/README.md.
//
// It lives under /app alongside the existing role dashboards rather than
// replacing them, so the working library system keeps running while this is
// built out screen by screen.

import { Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import Catalogue from './pages/Catalogue';
import Discover from './pages/Discover';
import BookDetail from './pages/BookDetail';
import MyShelf from './pages/MyShelf';
import Challenges from './pages/Challenges';

export default function MrbApp() {
  return (
    <AppShell>
      <Routes>
        <Route index element={<Discover />} />
        <Route path="catalogue" element={<Catalogue />} />
        <Route path="book/:editionId" element={<BookDetail />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="shelf" element={<MyShelf />} />
      </Routes>
    </AppShell>
  );
}
