import { useEffect, useState, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, School, MapPin, Users, Trash2, Edit2, User as UserIcon, GraduationCap, BookOpen } from 'lucide-react';
import Modal from '../../components/Modal';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ProfileModal from '../ProfileModal';
import ReaderStatsModal from '../../components/ReaderStatsModal';
import BookRequestsQueue from '../../components/BookRequestsQueue';
import { useTranslation } from '../../i18n/LanguageContext';

const ManagerDashboard = () => {
    const { logout } = useContext(AuthContext);
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [readerStudent, setReaderStudent] = useState(null); // {id, name} for reading-overview modal
    const [school, setSchool] = useState(null);
    const [students, setStudents] = useState([]);
    const [libStats, setLibStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('branches'); // 'branches' | 'students'

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [targetBranchId, setTargetBranchId] = useState(null);
    const [formData, setFormData] = useState({ name: '', address: '', email: '', password: '' });

    const fetchData = async () => {
        try {
            const [schoolRes, studentsRes, libStatsRes] = await Promise.all([
                api.get('/manager/school'),
                api.get('/manager/students'),
                api.get('/manager/librarian-stats'),
            ]);
            setSchool(schoolRes.data);
            setStudents(studentsRes.data || []);
            setLibStats(libStatsRes.data || []);
        } catch (err) {
            console.error("Failed to fetch manager data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleDelete = async (type, id) => {
        if (!window.confirm(t('admin.deleteConfirm'))) return;
        try {
            const endpoint = type === 'branch' ? `/manager/branch/${id}` : `/manager/librarian/${id}`;
            await api.delete(endpoint);
            fetchData();
        } catch (error) {
            alert(t('admin.deleteItemFailed'));
        }
    };

    // --- modal openers ---
    const openEditSchool = () => {
        setModalType('edit_school');
        setFormData({ name: school.name, address: school.address || '', email: '', password: '' });
        setIsModalOpen(true);
    };
    const openCreateBranch = () => {
        setModalType('create_branch');
        setFormData({ name: '', address: '', email: '', password: '' });
        setIsModalOpen(true);
    };
    const openEditBranch = (branch) => {
        setModalType('edit_branch');
        setSelectedId(branch.id);
        setFormData({ name: branch.name, address: '', email: '', password: '' });
        setIsModalOpen(true);
    };
    const openCreateLibrarian = (branchId) => {
        setModalType('create_librarian');
        setTargetBranchId(branchId);
        setFormData({ name: '', address: '', email: '', password: '' });
        setIsModalOpen(true);
    };
    const openEditLibrarian = (lib) => {
        setModalType('edit_librarian');
        setSelectedId(lib.user?.id || lib.user_id || lib.id);
        const email = lib.user?.email || lib.email || "";
        setFormData({ name: lib.name, email: email, address: '', password: '' });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalType === 'edit_school') {
                await api.put('/manager/school', { name: formData.name, address: formData.address });
            }
            else if (modalType === 'create_branch') {
                await api.post('/manager/branch', { name: formData.name });
            }
            else if (modalType === 'edit_branch') {
                await api.put(`/manager/branch/${selectedId}`, { name: formData.name });
            }
            else if (modalType === 'create_librarian') {
                await api.post('/manager/librarian', {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    branch_id: targetBranchId,
                });
            }
            else if (modalType === 'edit_librarian') {
                await api.put(`/manager/librarian/${selectedId}`, { name: formData.name });
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(t('msg.opFailed') + ": " + (error.response?.data?.error || t('stu.unknownError')));
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">{t('common.loading')}</div>;
    if (!school) return <div className="p-10 text-center text-gray-500">{t('msg.error')}</div>;

    const modalTitle = modalType === 'edit_school' ? t('manager.editSchool') : t('admin.md.' + modalType);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Navbar */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <School className="text-indigo-600" /> {t('role.manager')}
                        </h1>
                        <div className="flex items-center gap-5">
                            <LanguageSwitcher />
                            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors text-sm font-medium">
                                <UserIcon size={18} /> {t('nav.profile')}
                            </button>
                            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors text-sm font-medium">
                                <LogOut size={18} /> {t('auth.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
            <ReaderStatsModal isOpen={!!readerStudent} studentId={readerStudent?.id} studentName={readerStudent?.name} onClose={() => setReaderStudent(null)} />

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
                {/* School header */}
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <School className="text-indigo-600" size={28} /> {school.name}
                        </h2>
                        <p className="text-gray-500 mt-1">{t('manager.subtitle')}</p>
                        {school.address && <p className="text-xs text-gray-400 mt-0.5">{school.address}</p>}
                    </div>
                    <button onClick={openEditSchool} className="bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-600 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 font-medium transition-all text-sm">
                        <Edit2 size={16} /> {t('manager.editSchool')}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setTab('branches')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${tab === 'branches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <MapPin size={16} /> {t('manager.branches')}
                    </button>
                    <button
                        onClick={() => setTab('students')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${tab === 'students' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <GraduationCap size={16} /> {t('manager.students')} <span className="text-xs text-gray-400">({students.length})</span>
                    </button>
                    <button
                        onClick={() => setTab('requests')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${tab === 'requests' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <BookOpen size={16} /> {t('req.queue')}
                    </button>
                    <button
                        onClick={() => setTab('tracking')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${tab === 'tracking' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Users size={16} /> {t('manager.tracking')}
                    </button>
                </div>

                {/* Branches tab */}
                {tab === 'branches' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {school.branches && school.branches.map((branch) => (
                            <div key={branch.id} className="border border-gray-200 bg-white rounded-lg p-4 hover:border-indigo-300 transition-colors group">
                                {/* Branch Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2 font-semibold text-gray-700">
                                        <MapPin size={16} className="text-green-600" />
                                        {branch.name}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditBranch(branch)} className="text-gray-400 hover:text-indigo-500"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDelete('branch', branch.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {/* Librarians */}
                                <div className="bg-gray-50 rounded p-3 text-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                                            <Users size={12} /> {t('admin.librarians')}
                                        </div>
                                        <button
                                            onClick={() => openCreateLibrarian(branch.id)}
                                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded hover:bg-indigo-200 flex items-center gap-1"
                                        >
                                            <Plus size={10} /> {t('common.add')}
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {branch.librarians && branch.librarians.map((lib) => (
                                            <div key={lib.user_id || lib.id} className="flex justify-between items-center text-gray-600 bg-white p-1 rounded border border-gray-100">
                                                <div className="truncate pr-2">
                                                    <span className="block font-medium text-xs">{lib.name}</span>
                                                    <span className="block text-[10px] text-gray-400">{lib.user?.email || lib.email || t('admin.noEmail')}</span>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => openEditLibrarian(lib)} className="text-gray-300 hover:text-indigo-500"><Edit2 size={12} /></button>
                                                    <button onClick={() => handleDelete('librarian', lib.user_id || lib.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {(!branch.librarians || branch.librarians.length === 0) && <span className="text-gray-400 italic text-xs block py-1">{t('admin.noStaff')}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={openCreateBranch}
                            className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-all h-full min-h-[150px]"
                        >
                            <Plus size={24} className="mb-2" />
                            <span className="text-sm font-medium">{t('admin.addBranch')}</span>
                        </button>
                    </div>
                )}

                {/* Students tab */}
                {tab === 'students' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="text-left font-semibold px-4 py-3">{t('f.fullName')}</th>
                                    <th className="text-left font-semibold px-4 py-3">{t('manager.branch')}</th>
                                    <th className="text-left font-semibold px-4 py-3">{t('auth.grade')}</th>
                                    <th className="text-left font-semibold px-4 py-3">{t('th.classGroup')}</th>
                                    <th className="text-right font-semibold px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map((s) => (
                                    <tr key={s.user_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2.5 font-medium text-gray-700">{s.name}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{s.branch?.name || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{s.grade || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{s.class_group || '—'}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button onClick={() => setReaderStudent({ id: s.user_id, name: s.name })}
                                                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                                                <BookOpen size={14} /> {t('reader.view')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {students.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">{t('msg.noStudents')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Book requests tab (school-wide) */}
                {tab === 'requests' && (
                    <BookRequestsQueue listUrl="/manager/book-requests" updateBase="/manager/book-requests" showBranch />
                )}

                {/* Librarian tracking tab */}
                {tab === 'tracking' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                        <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="text-left font-semibold px-4 py-3">{t('f.fullName')}</th>
                                    <th className="text-left font-semibold px-4 py-3">{t('manager.branch')}</th>
                                    <th className="text-center font-semibold px-4 py-3">{t('nav.books')}</th>
                                    <th className="text-center font-semibold px-4 py-3">{t('mtrack.copies')}</th>
                                    <th className="text-center font-semibold px-4 py-3">{t('public.students')}</th>
                                    <th className="text-center font-semibold px-4 py-3">{t('mtrack.activeLoans')}</th>
                                    <th className="text-center font-semibold px-4 py-3">{t('mtrack.pendingRes')}</th>
                                    <th className="text-center font-semibold px-4 py-3">{t('mtrack.pendingReq')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {libStats.map((l) => (
                                    <tr key={l.user_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2.5">
                                            <div className="font-medium text-gray-700">{l.name}</div>
                                            <div className="text-[11px] text-gray-400">{l.email}</div>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500">{l.branch_name || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-700">{l.books}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-700">{l.copies}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-700">{l.students}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold text-indigo-600">{l.active_loans}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-700">{l.pending_reservations}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {l.pending_requests > 0
                                                ? <span className="inline-block bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded">{l.pending_requests}</span>
                                                : <span className="text-gray-400">0</span>}
                                        </td>
                                    </tr>
                                ))}
                                {libStats.length === 0 && (
                                    <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 italic">{t('mtrack.noLibrarians')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- Modals --- */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* School form */}
                    {modalType === 'edit_school' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.schoolName')}</label>
                                <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.address')}</label>
                                <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {/* Branch form */}
                    {modalType.includes('branch') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.branchName')}</label>
                            <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder={t('admin.branchPlaceholder')}
                                value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                    )}

                    {/* Librarian form */}
                    {modalType.includes('librarian') && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.name')}</label>
                                <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder={t('admin.namePlaceholder')}
                                    value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                                <input type="email" className={`w-full border border-gray-300 rounded-lg px-4 py-2 outline-none ${modalType.startsWith('edit_') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-indigo-500'}`}
                                    placeholder={t('admin.emailPlaceholder')}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    disabled={modalType.startsWith('edit_')}
                                />
                            </div>
                            {modalType.startsWith('create_') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                                    <input type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="••••••"
                                        value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                                </div>
                            )}
                        </div>
                    )}

                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        {t('common.save')}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default ManagerDashboard;
