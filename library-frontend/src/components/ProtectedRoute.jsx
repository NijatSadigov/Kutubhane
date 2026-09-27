import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { homePathFor } from '../home';

const ProtectedRoute = ({ children, allowedRoles }) => {
    // 1. Get User and Loading from Context
    // Note: We do NOT destructure 'role' here because it's not in the context.
    const { user, loading } = useContext(AuthContext);

    // 2. Wait for Auth check to finish
    // This prevents kicking the user out while the token is being verified
    if (loading) return <div className="p-10 text-center text-gray-500">{'…'}</div>;

    // 3. Not Logged In? -> Go to Login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 4. Logged In but Wrong Role?
    // We must access user.role, not just role
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        
        // Redirect them to their appropriate dashboard
        if (user.role !== 'student') return <Navigate to={homePathFor(user)} replace />;
        // Students belong in the myredbookshelf app; /student is the legacy
        // dashboard, still reachable directly until the new screens cover it.
        if (user.role === 'student') return <Navigate to="/app" replace />;
        
        // Fallback
        return <Navigate to="/login" replace />;
    }

    // 5. Access Granted
    return children;
};

export default ProtectedRoute;