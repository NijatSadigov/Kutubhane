import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useTranslation } from '../i18n/LanguageContext';
import { Check, X } from 'lucide-react';

const STATUS_STYLE = {
    PENDING: 'bg-[#FEF3C7] text-[#B45309] dark:bg-yellow-900/30 dark:text-yellow-500',
    FULFILLED: 'bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400',
};

// Shared book-request queue for librarians (branch-scoped) and managers
// (school-scoped). `updateBase` is the PUT path prefix, e.g. '/book-requests' or
// '/manager/book-requests'. `showBranch` adds a branch column for the manager view.
const BookRequestsQueue = ({ listUrl, updateBase, showBranch = false }) => {
    const { t } = useTranslation();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        api.get(listUrl).then(r => setRows(r.data || [])).catch(() => {}).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [listUrl]);

    const setStatus = async (id, status) => {
        try { await api.put(`${updateBase}/${id}`, { status }); load(); }
        catch (e) { alert(e.response?.data?.error || ''); }
    };

    const cols = showBranch ? 6 : 5;

    return (
        <div className="p-8">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
                        <tr>
                            <th className="text-left font-semibold px-6 py-3">{t('th.student')}</th>
                            {showBranch && <th className="text-left font-semibold px-6 py-3">{t('manager.branch')}</th>}
                            <th className="text-left font-semibold px-6 py-3">{t('req.fTitle')}</th>
                            <th className="text-left font-semibold px-6 py-3">{t('req.fAuthor')}</th>
                            <th className="text-center font-semibold px-6 py-3">{t('th.status')}</th>
                            <th className="text-right font-semibold px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rows.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-6 py-3 text-gray-700 dark:text-gray-200 font-medium">{r.student?.name || '—'}</td>
                                {showBranch && <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{r.branch?.name || '—'}</td>}
                                <td className="px-6 py-3 text-gray-700 dark:text-gray-200">
                                    {r.title}
                                    {r.note && <div className="text-[11px] text-gray-400 mt-0.5">{r.note}</div>}
                                </td>
                                <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{r.author || '—'}</td>
                                <td className="px-6 py-3 text-center">
                                    <span className={`text-[10px] px-2.5 py-1 rounded font-bold tracking-wide ${STATUS_STYLE[r.status] || ''}`}>{t('req.' + r.status)}</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    {r.status === 'PENDING' && (
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setStatus(r.id, 'FULFILLED')}
                                                className="inline-flex items-center gap-1 bg-[#E6F4EA] dark:bg-green-900/30 text-[#059669] dark:text-green-400 hover:brightness-95 text-[11px] font-bold px-3 py-1.5 rounded-lg transition">
                                                <Check size={13} /> {t('req.fulfill')}
                                            </button>
                                            <button onClick={() => setStatus(r.id, 'REJECTED')}
                                                className="inline-flex items-center gap-1 bg-[#FCE7F3] dark:bg-pink-900/30 text-[#DB2777] dark:text-pink-400 hover:brightness-95 text-[11px] font-bold px-3 py-1.5 rounded-lg transition">
                                                <X size={13} /> {t('req.reject')}
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={cols} className="px-6 py-10 text-center text-gray-400">{t('req.none')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BookRequestsQueue;
