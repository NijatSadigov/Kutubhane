import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute'; 
import PublicShell from './mrb/PublicShell';
import MrbCatalogue from './mrb/pages/Catalogue';
import MrbBookDetail from './mrb/pages/BookDetail';
import { Login, Register } from './mrb/pages/AuthPages';
import StudentDashboard from './pages/student/StudentDashboard';
import MrbApp from './mrb/MrbApp';
import Home from './mrb/Home';
import StaffApp from './staff/StaffApp';
function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* The logged-out reader surface: browse the catalogue and read
              reviews without an account. Every action asks you to sign in. */}
          <Route path="/catalogue" element={<PublicShell><MrbCatalogue /></PublicShell>} />
          <Route path="/book/:editionId" element={<PublicShell><MrbBookDetail /></PublicShell>} />
          {/* --- THE OLD ROLE DASHBOARDS ---
              All three are gone. The console at /staff covers what each of
              them did: the desk, holds, all loans, the catalogue with its
              copies and a typed-in new title, members with invite codes,
              requests and settings for a librarian; analytics, a read-only
              branch workspace, the school's readers, the school-wide request
              queue, librarian tracking, and branches, staff and schools for
              the administration. The paths stay as redirects so a bookmark or
              a link in somebody's notes still lands somewhere useful. */}
          <Route path="/librarian" element={<Navigate to="/staff" replace />} />
          <Route path="/manager" element={<Navigate to="/staff" replace />} />
          <Route path="/admin" element={<Navigate to="/staff" replace />} />

          {/* --- STUDENT ONLY --- */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* --- myredbookshelf: the reader-facing social app --- */}
          <Route
            path="/app/*"
            element={
              <ProtectedRoute allowedRoles={['student', 'librarian', 'manager', 'admin']}>
                <MrbApp />
              </ProtectedRoute>
            }
          />

          {/* --- Staff console (librarian / teacher / manager / admin) --- */}
          <Route
            path="/staff/*"
            element={
              <ProtectedRoute allowedRoles={['librarian', 'manager', 'admin', 'teacher']}>
                <StaffApp />
              </ProtectedRoute>
            }
          />

          {/* Catch all 404 */}
          <Route path="*" element={<div className="p-10">404 - Not Found</div>} />

        </Routes>
      </Router>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;