import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useTranslation } from '../../i18n/LanguageContext';
import { Plus, Copy, Link2, Trash2, Check, Clock } from 'lucide-react';

const RegistrationTokensModal = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(false);
    const [label, setLabel] = useState('');
    const [days, setDays] = useState(30);
    const [copied, setCopied] = useState(''); // token+kind that was just copied

    const fetchTokens = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/registration-tokens');
            setTokens(Array.isArray(res.data) ? res.data : []);
        } catch (err) { console.error(err); setTokens([]); }
        setLoading(false);
    }, []);

    useEffect(() => { if (isOpen) fetchTokens(); }, [isOpen, fetchTokens]);

    const createToken = async (e) => {
        e.preventDefault();
        try {
            await api.post('/registration-tokens', { label, days: parseInt(days) || 30 });
            setLabel('');
            fetchTokens();
        } catch (err) { alert(t('regtoken.createFailed') + ': ' + (err.response?.data?.error || 'Error')); }
    };

    const revoke = async (id) => {
        if (!window.confirm(t('regtoken.revokeConfirm'))) return;
        try { await api.delete(`/registration-tokens/${id}`); fetchTokens(); }
        catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const linkFor = (token) => `${window.location.origin}/register?token=${token}`;

    const copy = async (text, key) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            setTimeout(() => setCopied(''), 1500);
        } catch { alert(text); }
    };

    const isExpired = (tok) => tok.revoked || new Date(tok.expires_at) < new Date();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('regtoken.title')} maxWidth="max-w-2xl">
            <div className="space-y-5">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('regtoken.intro')}</p>

                {/* Create */}
                <form onSubmit={createToken} className="flex flex-wrap items-end gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('regtoken.label')}</label>
                        <input type="text" placeholder={t('regtoken.labelPlaceholder')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white text-sm" value={label} onChange={e => setLabel(e.target.value)} />
                    </div>
                    <div className="w-28">
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('regtoken.validityDays')}</label>
                        <input type="number" min="1" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white text-sm" value={days} onChange={e => setDays(e.target.value)} />
                    </div>
                    <button className="bg-[#E85B5B] hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={14} /> {t('regtoken.create')}</button>
                </form>

                {/* List */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {loading && <p className="text-sm text-gray-400">{t('common.loading')}</p>}
                    {!loading && tokens.length === 0 && <p className="text-sm text-gray-400 text-center py-6">{t('regtoken.none')}</p>}
                    {tokens.map(tok => {
                        const expired = isExpired(tok);
                        return (
                            <div key={tok.id} className={`border rounded-xl p-3 ${expired ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{tok.label || t('regtoken.untitled')}</span>
                                        {expired
                                            ? <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-bold">{tok.revoked ? t('regtoken.revoked') : t('regtoken.expired')}</span>
                                            : <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">{t('regtoken.active')}</span>}
                                    </div>
                                    <button onClick={() => revoke(tok.id)} title={t('regtoken.revoke')} className="text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={15} /></button>
                                </div>
                                <code className="block text-xs bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded px-2 py-1.5 text-gray-600 dark:text-gray-300 truncate mb-2">{tok.token}</code>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={12} /> {new Date(tok.expires_at).toLocaleDateString()} · {tok.use_count} {t('regtoken.uses')}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => copy(tok.token, tok.id + 't')} className="text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:text-[#E85B5B] flex items-center gap-1">
                                            {copied === tok.id + 't' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />} {t('regtoken.copyToken')}
                                        </button>
                                        <button onClick={() => copy(linkFor(tok.token), tok.id + 'l')} className="text-[11px] font-bold text-[#E85B5B] hover:text-red-600 flex items-center gap-1">
                                            {copied === tok.id + 'l' ? <Check size={13} className="text-green-600" /> : <Link2 size={13} />} {t('regtoken.copyLink')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
};

export default RegistrationTokensModal;
