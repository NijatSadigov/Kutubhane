import { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { User as UserIcon } from 'lucide-react';

// Name lives on the role profile (librarian/student); admins have none.
export const displayName = (user) =>
    user?.librarian?.name || user?.student?.name || user?.name || '';

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, refreshUser } = useContext(AuthContext);
    const { t } = useTranslation();
    const isAdmin = user?.role === 'admin';

    const [form, setForm] = useState({ name: '', email: '', new_password: '', current_password: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm({ name: displayName(user), email: user?.email || '', new_password: '', current_password: '' });
        }
    }, [isOpen, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.put('/profile', {
                name: form.name,
                email: form.email,
                new_password: form.new_password,
                current_password: form.current_password,
            });
            await refreshUser();
            alert(t('profile.saved'));
            onClose();
        } catch (err) {
            alert((t('profile.saveFailed')) + ': ' + (err.response?.data?.error || 'Error'));
        } finally {
            setBusy(false);
        }
    };

    const input = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white";
    const label = "block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('profile.title')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 pb-2">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold uppercase text-lg">
                        {displayName(user)?.charAt(0) || <UserIcon size={20} />}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{displayName(user) || user?.email}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('profile.roleLabel')}: {t(`role.${user?.role}`)}</p>
                    </div>
                </div>

                {!isAdmin && (
                    <div>
                        <label className={label}>{t('profile.name')}</label>
                        <input type="text" className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                )}

                <div>
                    <label className={label}>{t('profile.email')}</label>
                    <input type="email" className={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>

                <div>
                    <label className={label}>{t('profile.newPassword')}</label>
                    <input type="password" className={input} placeholder="••••••••" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} />
                    <span className="text-[11px] text-gray-400 mt-1 block">{t('profile.newPasswordHint')}</span>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                    <label className={label}>{t('profile.currentPassword')}</label>
                    <input type="password" className={input} placeholder="••••••••" value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })} required />
                    <span className="text-[11px] text-gray-400 mt-1 block">{t('profile.currentPasswordHint')}</span>
                </div>

                <button disabled={busy} className="w-full bg-[#E85B5B] hover:bg-red-600 disabled:opacity-50 text-white py-2 rounded font-bold transition-colors">
                    {busy ? t('common.loading') : t('profile.save')}
                </button>
            </form>
        </Modal>
    );
};

export default ProfileModal;
