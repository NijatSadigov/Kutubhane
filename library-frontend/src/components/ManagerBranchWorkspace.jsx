import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useTranslation } from '../i18n/LanguageContext';

// Read-only window into any branch of the manager's school: browse the catalog,
// active loans and reservations a librarian there would see. Data comes from the
// scope-checked /manager/branch/:id/* endpoints.
const ManagerBranchWorkspace = ({ branches = [] }) => {
    const { t } = useTranslation();
    const [branchId, setBranchId] = useState(branches[0]?.id || null);
    const [view, setView] = useState('books'); // books | loans | reservations
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!branchId && branches.length) setBranchId(branches[0].id);
    }, [branches]);

    useEffect(() => {
        if (!branchId) return;
        setLoading(true);
        setData([]);
        api.get(`/manager/branch/${branchId}/${view}`)
            .then(r => setData(r.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [branchId, view]);

    const subTab = (v, label) => (
        <button onClick={() => setView(v)}
            className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${view === v ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
        </button>
    );

    const th = (label, extra = '') => <th className={`px-4 py-3 font-semibold ${extra || 'text-left'}`}>{label}</th>;
    const empty = (cols) => !loading && data.length === 0 && (
        <tr><td colSpan={cols} className="px-4 py-6 text-center text-gray-400 italic">{t('msg.noRecords')}</td></tr>
    );

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {subTab('books', t('nav.books'))}
                    {subTab('loans', t('nav.loans'))}
                    {subTab('reservations', t('nav.reservations'))}
                </div>
                <select value={branchId || ''} onChange={e => setBranchId(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500 bg-white">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
                {view === 'books' && (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                            {th(t('req.fTitle'))}{th(t('req.fAuthor'))}{th(t('mtrack.copies'), 'text-center')}{th(t('ws.available'), 'text-center')}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map(b => {
                                const copies = b.copies || [];
                                const avail = copies.filter(c => c.status?.code === 'AVAILABLE').length;
                                return (
                                    <tr key={b.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2.5 font-medium text-gray-700">{b.title}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{b.author?.name || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-700">{copies.length}</td>
                                        <td className="px-4 py-2.5 text-center"><span className={avail > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>{avail}</span></td>
                                    </tr>
                                );
                            })}
                            {empty(4)}
                        </tbody>
                    </table>
                )}

                {view === 'loans' && (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                            {th(t('th.student'))}{th(t('req.fTitle'))}{th(t('ws.due'))}{th(t('th.status'), 'text-center')}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map(l => (
                                <tr key={l.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-medium text-gray-700">{l.student?.name || '—'}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{l.book_copy?.book?.title || '—'}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{l.due_date ? new Date(l.due_date).toLocaleDateString() : '—'}</td>
                                    <td className="px-4 py-2.5 text-center text-gray-600">{l.status?.name || '—'}</td>
                                </tr>
                            ))}
                            {empty(4)}
                        </tbody>
                    </table>
                )}

                {view === 'reservations' && (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                            {th(t('th.student'))}{th(t('req.fTitle'))}{th(t('th.status'), 'text-center')}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-medium text-gray-700">{r.student?.name || '—'}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{r.book_copy?.book?.title || '—'}</td>
                                    <td className="px-4 py-2.5 text-center text-gray-600">{r.status?.name || '—'}</td>
                                </tr>
                            ))}
                            {empty(3)}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ManagerBranchWorkspace;
