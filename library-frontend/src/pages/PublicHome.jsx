import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { School, Users, BookOpen, BookMarked, FileText, MapPin, ArrowRight } from 'lucide-react';

const ROLE_ROUTE = { admin: '/admin', manager: '/manager', librarian: '/librarian', student: '/student' };

const PublicHome = () => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get('/public/stats').then(r => setData(r.data)).catch(() => {});
    }, []);

    const totals = data?.totals || {};
    const schools = data?.schools || [];

    const totalCards = [
        { key: 'schools', icon: School, label: t('public.schools'), value: totals.schools ?? 0, accent: 'text-[#E85B5B]' },
        { key: 'students', icon: Users, label: t('public.students'), value: totals.students ?? 0, accent: 'text-blue-500' },
        { key: 'books', icon: BookOpen, label: t('public.books'), value: totals.books ?? 0, accent: 'text-indigo-500' },
        { key: 'booksRead', icon: BookMarked, label: t('public.booksRead'), value: totals.books_read ?? 0, accent: 'text-green-600' },
        { key: 'pagesRead', icon: FileText, label: t('public.pagesRead'), value: (totals.pages_read ?? 0).toLocaleString(), accent: 'text-amber-500' },
    ];

    const goDashboard = () => navigate(ROLE_ROUTE[user?.role] || '/login');

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FFF5F5] to-white dark:from-gray-900 dark:to-gray-950 text-gray-800 dark:text-gray-100">
            {/* Header */}
            <header className="flex items-center justify-between px-6 sm:px-10 h-20 max-w-6xl mx-auto">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-[#E85B5B]">e12</span>
                    <span className="font-bold text-gray-700 dark:text-gray-200 hidden sm:inline">Kütüphane</span>
                </div>
                <div className="flex items-center gap-4">
                    <LanguageSwitcher />
                    {user ? (
                        <button onClick={goDashboard}
                            className="flex items-center gap-2 bg-[#E85B5B] hover:bg-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors">
                            {t('public.goToDashboard')} <ArrowRight size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate('/login')}
                                className="bg-[#E85B5B] hover:bg-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors">
                                {t('public.login')}
                            </button>
                            <button onClick={() => navigate('/register')}
                                className="text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-[#E85B5B] px-3 py-2.5 transition-colors">
                                {t('public.register')}
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 sm:px-10 pb-20">
                {/* Hero */}
                <section className="text-center py-14 sm:py-20">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
                        <span className="text-[#E85B5B]">e12</span> Kütüphane
                    </h1>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('public.tagline')}</p>
                </section>

                {/* Totals */}
                <section className="mb-16">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">{t('public.overview')}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {totalCards.map(c => {
                            const Icon = c.icon;
                            return (
                                <div key={c.key} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <Icon className={c.accent} size={22} />
                                    <p className="text-3xl font-black mt-3 text-gray-800 dark:text-gray-100">{c.value}</p>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mt-1">{c.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Schools */}
                <section>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">{t('public.schools')}</h2>
                    {schools.length === 0 ? (
                        <p className="text-gray-400 py-10 text-center">{t('public.noSchools')}</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {schools.map(s => (
                                <div key={s.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{s.name}</h3>
                                            {s.address && (
                                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin size={12} /> {s.address}</p>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400">{s.branches} {t('public.branches')}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-5">
                                        <Stat label={t('public.students')} value={s.students} />
                                        <Stat label={t('public.books')} value={s.books} />
                                        <Stat label={t('public.booksRead')} value={s.books_read} accent="text-green-600 dark:text-green-400" />
                                        <Stat label={t('public.pagesRead')} value={(s.pages_read || 0).toLocaleString()} accent="text-amber-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

const Stat = ({ label, value, accent }) => (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700">
        <p className={`text-xl font-bold ${accent || 'text-gray-800 dark:text-gray-100'}`}>{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">{label}</p>
    </div>
);

export default PublicHome;
