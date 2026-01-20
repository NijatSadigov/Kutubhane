import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
    // 1. Get User and Loading from Context
    // Note: We do NOT destructure 'role' here because it's not in the context.
    const { user, loading } = useContext(AuthContext);

    // 2. Wait for Auth check to finish
    // This prevents kicking the user out while the token is being verified
    if (loading) return <div className="p-10 text-center text-gray-500">Checking Security...</div>;

    // 3. Not Logged In? -> Go to Login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 4. Logged In but Wrong Role?
    // We must access user.role, not just role
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        
        // Redirect them to their appropriate dashboard
        if (user.role === 'admin') return <Navigate to="/admin" replace />;
        if (user.role === 'librarian') return <Navigate to="/librarian" replace />;
        if (user.role === 'student') return <Navigate to="/student" replace />;
        
        // Fallback
        return <Navigate to="/login" replace />;
    }

    // 5. Access Granted
    return children;
};

export default ProtectedRoute;