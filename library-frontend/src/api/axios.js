import axios from 'axios';

// Backend origin (without the /api suffix) — used to resolve uploaded file
// paths like "/uploads/covers/x.jpg" that the API stores as relative URLs.
export const API_ORIGIN = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_ORIGIN + '/api',
    withCredentials: true
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Resolve a stored file path to a loadable URL. Absolute URLs (old data) pass
// through unchanged; relative "/uploads/..." paths get the backend origin.
export const assetUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    return API_ORIGIN + (path.startsWith('/') ? path : '/' + path);
};

// Upload a file to /api/upload/:kind and return the stored { url, filename }.
export const uploadFile = async (kind, file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/upload/${kind}`, form);
    return res.data;
};

export default api;
