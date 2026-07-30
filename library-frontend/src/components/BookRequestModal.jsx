import { useEffect, useState } from 'react';
import api from '../api/axios';
import Modal from './Modal';
import { useTranslation } from '../i18n/LanguageContext';

const STATUS_STYLE = {
    PENDING: 'bg-[#FEF3C7] text-[#B45309] dark:bg-yellow-900/30 dark:text-yellow-500',
    FULFILLED: 'bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400',
};

// Student-facing: submit a request for a book the library doesn't have, and see
// the status of past requests.
const BookRequestModal = ({ isOpen, onClose, prefillTitle = '' }) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [mine, setMine] = useState([]);

    const fetchMine = () => api.get('/book-requests/mine').then(r => setMine(r.data)).catch(() => {});

    useEffect(() => {
        if (!isOpen) return;
        setTitle(prefillTitle || '');
        setAuthor('');
        setNote('');
        fetchMine();
    }, [isOpen, prefillTitle]);

    const submit = async () => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            await api.post('/book-requests', { title: title.trim(), author: author.trim(), note: note.trim() });
            setTitle(''); setAuthor(''); setNote('');
            await fetchMine();
            alert(t('req.sent'));
        } catch (err) {
            alert(t('req.failed') + ': ' + (err.response?.data?.error || ''));
        } finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('req.request')} maxWidth="max-w-lg">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">{t('req.fTitle')}</label>
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            className="w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1B9DD9]" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">{t('req.fAuthor')}</label>
                        <input value={author} onChange={e => setAuthor(e.target.value)}
                            className="w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1B9DD9]" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">{t('req.fNote')}</label>
                        <input value={note} onChange={e => setNote(e.target.value)}
                            className="w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1B9DD9]" />
                    </div>
                </div>
                <button onClick={submit} disabled={saving || !title.trim()}
                    className="bg-[#1B9DD9] hover:bg-[#1580B5] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg shadow-sm transition-colors">
                    {t('req.submit')}
                </button>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('req.myRequests')}</h4>
                    {mine.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">{t('req.empty')}</p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {mine.map(r => (
                                <div key={r.id} className="flex justify-between items-center gap-3 text-xs bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-gray-700 dark:text-gray-200 truncate block">{r.title}</span>
                                        {r.author && <span className="text-gray-500 dark:text-gray-400">{r.author}</span>}
                                    </div>
                                    <span className={`text-[10px] px-2.5 py-1 rounded font-bold tracking-wide ${STATUS_STYLE[r.status] || ''}`}>{t('req.' + r.status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default BookRequestModal;
