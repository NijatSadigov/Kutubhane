import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute'; 
import { Login, Register } from './mrb/pages/AuthPages';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import LibrarianDashboard from './pages/librarian/LibrarianDashboard';
import StudentDashboard from './pages/student/StudentDashBoard';
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
          {/* --- ADMIN ONLY --- */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* --- MANAGER ONLY --- */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />

          {/* --- LIBRARIAN ONLY --- */}
          <Route
            path="/librarian"
            element={
              <ProtectedRoute allowedRoles={['librarian']}>
                <LibrarianDashboard />
              </ProtectedRoute>
            }
          />

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

          {/* --- Staff console (librarian / manager / admin) --- */}
          <Route
            path="/staff/*"
            element={
              <ProtectedRoute allowedRoles={['librarian', 'manager', 'admin']}>
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