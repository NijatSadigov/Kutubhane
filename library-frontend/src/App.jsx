import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute'; 
import Register from './pages/Register'; 
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import LibrarianDashboard from './pages/librarian/LibrarianDashboard';
import StudentDashboard from './pages/student/StudentDashBoard';
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Navigate to="/login" />} />
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

          {/* Catch all 404 */}
          <Route path="*" element={<div className="p-10">404 - Not Found</div>} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;