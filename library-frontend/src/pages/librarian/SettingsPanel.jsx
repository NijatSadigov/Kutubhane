import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Plus, Edit2, Trash2, Lock } from 'lucide-react';
import Modal from '../../components/Modal';
import { useTranslation } from '../../i18n/LanguageContext';

// Every category endpoint has the same CRUD shape, so one config table drives all of them.
// Labels are i18n keys resolved at render. `countable` = backend returns a computed
// book_count. `system` = rows may carry a fixed Code the backend refuses to delete.
const SECTIONS = [
    { key: 'authors', labelKey: 'set.authors', endpoint: '/authors', countable: true, fields: [{ name: 'name', labelKey: 'set.name' }] },
    { key: 'publishers', labelKey: 'set.publishers', endpoint: '/publishers', countable: true, fields: [{ name: 'name', labelKey: 'set.name' }, { name: 'location', labelKey: 'set.location' }] },
    { key: 'topics', labelKey: 'set.topics', endpoint: '/topics', countable: true, fields: [{ name: 'name', labelKey: 'set.name' }, { name: 'location', labelKey: 'set.location' }] },
    { key: 'genres', labelKey: 'set.genres', endpoint: '/genres', countable: true, fields: [{ name: 'name', labelKey: 'set.name' }, { name: 'location', labelKey: 'set.location' }] },
    { key: 'frequencies', labelKey: 'set.frequencies', endpoint: '/frequencies', fields: [{ name: 'type', labelKey: 'set.period' }] },
    { key: 'copy-conditions', labelKey: 'set.conditions', endpoint: '/copy-conditions', fields: [{ name: 'name', labelKey: 'set.name' }] },
    { key: 'copy-statuses', labelKey: 'set.copyStatuses', endpoint: '/copy-statuses', system: true, fields: [{ name: 'name', labelKey: 'set.name' }] },
    { key: 'loan-statuses', labelKey: 'set.loanStatuses', endpoint: '/loan-statuses', system: true, fields: [{ name: 'name', labelKey: 'set.name' }] },
    { key: 'reservation-statuses', labelKey: 'set.resStatuses', endpoint: '/reservation-statuses', system: true, fields: [{ name: 'name', labelKey: 'set.name' }] },
];

const SettingsPanel = ({ onDataChanged }) => {
    const { t } = useTranslation();
    const [activeKey, setActiveKey] = useState('authors');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({});

    const section = SECTIONS.find(s => s.key === activeKey);
    const primaryField = section.fields[0].name;

    // SECTIONS is module-level, so `section` is stable per activeKey and this won't loop.
    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(section.endpoint);
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(`Error fetching ${section.endpoint}`, err);
            setItems([]);
        }
        setLoading(false);
    }, [section]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const openAdd = () => {
        setEditingId(null);
        setForm(Object.fromEntries(section.fields.map(f => [f.name, ''])));
        setIsModalOpen(true);
    };

    const openEdit = (item) => {
        setEditingId(item.id);
        setForm(Object.fromEntries(section.fields.map(f => [f.name, item[f.name] || ''])));
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) await api.put(`${section.endpoint}/${editingId}`, form);
            else await api.post(section.endpoint, form);
            setIsModalOpen(false);
            fetchItems();
            onDataChanged?.();
        } catch (err) {
            alert(t('msg.opFailed') + ": " + (err.response?.data?.error || t('msg.error')));
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(t('set.deleteConfirm', { name: item[primaryField] }))) return;
        try {
            await api.delete(`${section.endpoint}/${item.id}`);
            fetchItems();
            onDataChanged?.();
        } catch (err) {
            alert(err.response?.data?.error || t('msg.deleteFailed'));
        }
    };

    // A row with a system Code is core to the workflow: renameable, never deletable.
    const isProtected = (item) => Boolean(section.system && item.code);

    return (
        <div>
            {/* Category picker */}
            <div className="flex flex-wrap gap-2 mb-6">
                {SECTIONS.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setActiveKey(s.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeKey === s.key
                            ? 'bg-[#1B9DD9] text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        {t(s.labelKey)}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{t(section.labelKey)}</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {loading ? t('common.loading') : `${items.length} ${t('common.records')}`}
                    </p>
                </div>
                <button onClick={openAdd} className="bg-[#1B9DD9] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-[#1580B5] transition-colors flex items-center gap-1">
                    <Plus size={14} /> {t('common.addNew')}
                </button>
            </div>

            <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <tr>
                            {section.fields.map(f => (
                                <th key={f.name} className="px-6 py-3 text-left font-bold">{t(f.labelKey)}</th>
                            ))}
                            {section.countable && <th className="px-6 py-3 text-left font-bold">{t('set.bookCount')}</th>}
                            {section.system && <th className="px-6 py-3 text-left font-bold">{t('set.systemCode')}</th>}
                            <th className="px-6 py-3 text-right font-bold">{t('th.action')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={section.fields.length + 2} className="px-6 py-10 text-center text-gray-400 dark:text-gray-500 text-xs">
                                    {t('set.empty')}
                                </td>
                            </tr>
                        )}
                        {items.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                {section.fields.map(f => (
                                    <td key={f.name} className="px-6 py-3 text-gray-800 dark:text-gray-200">
                                        {item[f.name] || <span className="text-gray-400">-</span>}
                                    </td>
                                ))}
                                {section.countable && (
                                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400 text-xs">{item.book_count ?? 0}</td>
                                )}
                                {section.system && (
                                    <td className="px-6 py-3">
                                        {item.code
                                            ? <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-[10px] font-bold">{item.code}</span>
                                            : <span className="text-gray-400 text-xs">{t('set.custom')}</span>}
                                    </td>
                                )}
                                <td className="px-6 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openEdit(item)} title={t('common.edit')} className="p-1.5 rounded-lg text-gray-500 hover:text-[#1B9DD9] hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                                            <Edit2 size={14} />
                                        </button>
                                        {isProtected(item) ? (
                                            <span title={t('set.protectedHint')} className="p-1.5 text-gray-300 dark:text-gray-600">
                                                <Lock size={14} />
                                            </span>
                                        ) : (
                                            <button onClick={() => handleDelete(item)} title={t('common.delete')} className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`${t(section.labelKey)} — ${editingId ? t('common.edit') : t('common.addNew')}`}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {section.fields.map((f, i) => (
                        <div key={f.name}>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t(f.labelKey)}</label>
                            <input
                                type="text"
                                autoFocus={i === 0}
                                required={i === 0}
                                placeholder={t(f.labelKey)}
                                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white"
                                value={form[f.name] || ''}
                                onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                            />
                        </div>
                    ))}
                    <button type="submit" className="w-full bg-[#1B9DD9] text-white py-2 rounded-lg text-sm font-bold hover:bg-[#1580B5] transition-colors">
                        {editingId ? 'Kaydet' : 'Ekle'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default SettingsPanel;
