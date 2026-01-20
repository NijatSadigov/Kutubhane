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
            return { success: false, message: err.response?.data?.message || "Login failed" };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};