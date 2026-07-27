import { useTranslation } from '../i18n/LanguageContext';

// Presentational overview page shared by the student and librarian dashboards.
// stats: [{ key, label, value, accent }]; actions: [{ label, onClick }].
const HomeView = ({ welcomeName, stats = [], actions = [], children }) => {
    const { t } = useTranslation();

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    {t('home.welcome')}{welcomeName ? `, ${welcomeName}` : ''} 👋
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('home.subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stats.map(s => (
                    <div key={s.key} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{s.label}</p>
                        <p className={`text-3xl font-bold mt-2 ${s.accent || 'text-gray-800 dark:text-gray-100'}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {actions.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t('home.quickActions')}</h2>
                    <div className="flex flex-wrap gap-3">
                        {actions.map((a, i) => (
                            <button key={i} onClick={a.onClick} className="bg-[#E85B5B] hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
                                {a.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {children}
        </div>
    );
};

export default HomeView;
