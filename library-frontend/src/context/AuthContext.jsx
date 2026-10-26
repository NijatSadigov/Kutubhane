import { createContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // 1. Initialize from LocalStorage
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    
    const [loading, setLoading] = useState(true);

    // 2. Check User on Mount (Verification)
    useEffect(() => {
        const checkUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Refetch data on refresh to keep it synced
                    const res = await api.get('/user');
                    console.log("🔄 Auto-Login Data:", res.data); // Debug Log
                    setUser(res.data);
                    localStorage.setItem('user', JSON.stringify(res.data));
                } catch (err) {
                    console.error("Auth check failed", err);
                    logout();
                }
            }
            setLoading(false);
        };
        checkUser();
    }, []);

    const login = async (email, password) => {
        try {
            const res = await api.post('/login', { email, password });
            console.log("✅ Login Response:", res.data); // Debug Log

            // 1. Save Token
            localStorage.setItem('token', res.data.token);
            
            // 2. Save User (The critical part)
            // The backend sends { token: "...", user: { ... } }
            // We must save res.data.user, NOT just res.data
            const userData = res.data.user; 
            
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            
            return { success: true, role: userData.role };
        } catch (err) {
            console.error("Login error", err);
            // No message of our own for a wrong e-mail or password: the server
            // sends a code rather than prose now, and the login page has the
            // sentence for it in all three languages. An English fallback here
            // is how an Azerbaijani screen used to say "Incorrect password".
            const code = err.response?.data?.code;
            if (code === 'BAD_CREDENTIALS' || code === 'RATE_LIMITED') {
                return { success: false, code };
            }
            return { success: false, message: err.response?.data?.message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    // Re-fetch the current user after a profile change so the UI reflects it.
    const refreshUser = async () => {
        try {
            const res = await api.get('/user');
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
            return res.data;
        } catch (err) {
            console.error("refreshUser failed", err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};