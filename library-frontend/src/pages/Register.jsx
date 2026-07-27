import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { UserPlus, Calendar, Users, GraduationCap, KeyRound, CheckCircle } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from '../i18n/LanguageContext';

const Register = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        token: '',
        grade: '',
        class_group: '',
        birth_date: ''
    });
    const [error, setError] = useState('');
    // Result of validating the token: null = unchecked, {valid, branch_name} otherwise
    const [tokenInfo, setTokenInfo] = useState(null);

    // Validate a token (from the ?token= link or manual entry) and show the library.
    const validateToken = async (token) => {
        if (!token) { setTokenInfo(null); return; }
        try {
            const res = await api.get(`/registration-tokens/validate/${token}`);
            setTokenInfo(res.data);
        } catch (err) {
            setTokenInfo({ valid: false, error: err.response?.data?.error });
        }
    };

    // On mount, pick up a token from the URL (?token=...) and validate it.
    useEffect(() => {
        const urlToken = searchParams.get('token');
        if (urlToken) {
            setFormData(f => ({ ...f, token: urlToken }));
            validateToken(urlToken);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: 'student',
                token: formData.token.trim(),
                grade: parseInt(formData.grade),
                classGroup: formData.class_group,
                birthDate: new Date(formData.birth_date).toISOString()
            };
            await api.post('/register', payload);
            alert(t('auth.registerSuccess'));
            navigate('/login');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.response?.data?.error || t('auth.registerFailed'));
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 py-10">
            <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">{t('auth.registerTitle')}</h2>
                    <p className="text-gray-500">{t('auth.registerSubtitle')}</p>
                </div>

                {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* --- LOGIN INFO --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.fullName')}</label>
                        <input name="name" type="text" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Ali Yilmaz" onChange={handleChange} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                        <input name="email" type="email" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="student@school.com" onChange={handleChange} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                        <input name="password" type="password" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="••••••••" onChange={handleChange} />
                    </div>

                    {/* --- STUDENT INFO --- */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <GraduationCap size={14} className="text-gray-400"/> {t('auth.grade')}
                            </label>
                            <input name="grade" type="number" required min="1" max="12"
                                className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="1-12" onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <Users size={14} className="text-gray-400"/> {t('auth.classGroup')}
                            </label>
                            <input name="class_group" type="text" required 
                                className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="A, B, C..." onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Calendar size={14} className="text-gray-400"/> {t('auth.birthDate')}
                        </label>
                        <input name="birth_date" type="date" required 
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={handleChange} />
                    </div>

                    {/* --- REGISTRATION TOKEN --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            {t('regtoken.enterToken')}
                            <span className="text-xs text-gray-400 font-normal">{t('regtoken.tokenHint')}</span>
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input name="token" type="text" required
                                className="w-full border border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                placeholder="reg_..." value={formData.token}
                                onChange={handleChange}
                                onBlur={(e) => validateToken(e.target.value.trim())} />
                        </div>
                        {tokenInfo?.valid && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle size={13} /> {t('regtoken.registerTo')}: <span className="font-bold">{tokenInfo.branch_name}</span>
                            </p>
                        )}
                        {tokenInfo && !tokenInfo.valid && (
                            <p className="text-xs text-red-500 mt-1">{tokenInfo.error || t('regtoken.invalidToken')}</p>
                        )}
                    </div>

                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-4">
                        {t('auth.createAccount')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    {t('auth.haveAccount')}{' '}
                    <Link to="/login" className="text-blue-600 font-bold hover:underline">
                        {t('auth.loginHere')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;