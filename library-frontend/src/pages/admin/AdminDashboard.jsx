import { useEffect, useState, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, School, MapPin, Users, Trash2, Edit2, User as UserIcon } from 'lucide-react';
import Modal from '../../components/Modal';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ProfileModal from '../ProfileModal';
import { useTranslation } from '../../i18n/LanguageContext';

const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const { t } = useTranslation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const navigate = useNavigate();

    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('');

    const [formData, setFormData] = useState({ name: '', address: '', email: '', password: '' });

    const [selectedId, setSelectedId] = useState(null);
    const [targetSchoolId, setTargetSchoolId] = useState(null);
    const [targetBranchId, setTargetBranchId] = useState(null);

    const fetchData = async () => {
        try {
            const response = await api.get('/admin/school');
            setSchools(response.data);
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleDelete = async (type, id) => {
        if (!window.confirm(t('admin.deleteConfirm'))) return;
        try {
            const endpoint = type === 'school' ? `/admin/school/${id}`
                : type === 'branch' ? `/admin/branch/${id}`
                    : type === 'manager' ? `/admin/manager/${id}`
                        : `/admin/librarian/${id}`;

            await api.delete(endpoint);
            fetchData();
        } catch (error) {
            alert(t('admin.deleteItemFailed'));
        }
    };


    // Schools
    const openCreateSchool = () => {
        setModalType('create_school');
        setFormData({ name: '', address: '', email: '', password: '' });
        setIsModalOpen(true);
    };
    const openEditSchool = (school) => {
        setModalType('edit_school');
        setSelectedId(school.id);
        setFormData({ name: school.name, address: school.address || '', email: '', password: '' });
        setIsModalOpen(true);
    };

    // Branches
    const openCreateBranch = (schoolId) => {
        setModalType('create_branch');
        setTargetSchoolId(schoolId);
        setFormData({ name: '', address: '', email: '', password: '' });
        setIsModalOpen(true);
    };
    const openEditBranch = (branch) => {
        setModalType('edit_branch');
        setSelectedId(branch.id);
        setFormData({ name: branch.name, address: '', email: '', password: '' });
        setIsModalOpen(true);
    };

    // Librarians
    const openCreateLibrarian = (branchId, schoolId) => {
        setModalType('create_librarian');
        setTargetBranchId(branchId);
        setTargetSchoolId(schoolId);
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

    // Managers (school-level)
    const openCreateManager = (schoolId) => {
        setModalType('create_manager');
        setTargetSchoolId(schoolId);
        setFormData({ name: '', address: '', email: '', password: '' });
        setIsModalOpen(true);
    };

    const openEditManager = (mgr) => {
        setModalType('edit_manager');
        setSelectedId(mgr.user?.id || mgr.user_id || mgr.id);
        const email = mgr.user?.email || mgr.email || "";
        setFormData({ name: mgr.name, email: email, address: '', password: '' });
        setIsModalOpen(true);
    };

    // --- SUBMIT HANDLER ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // A. SCHOOL ACTIONS
            if (modalType === 'create_school') {
                await api.post('/admin/school', { name: formData.name, address: formData.address });
            }
            else if (modalType === 'edit_school') {
                await api.put(`/admin/school/${selectedId}`, { name: formData.name, address: formData.address });
            }
            // B. BRANCH ACTIONS
            else if (modalType === 'create_branch') {
                await api.post('/admin/branch', { name: formData.name, school_id: targetSchoolId });
            }
            else if (modalType === 'edit_branch') {
                await api.put(`/admin/branch/${selectedId}`, { name: formData.name });
            }
            // C. LIBRARIAN ACTIONS
            else if (modalType === 'create_librarian') {
                await api.post('/admin/librarian', {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    branch_id: targetBranchId,
                    school_id: targetSchoolId
                });
            }
            else if (modalType === 'edit_librarian') {
                await api.put(`/admin/librarian/${selectedId}`, {
                    name: formData.name
                });
            }
            // D. MANAGER ACTIONS
            else if (modalType === 'create_manager') {
                await api.post('/admin/manager', {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    school_id: targetSchoolId
                });
            }
            else if (modalType === 'edit_manager') {
                await api.put(`/admin/manager/${selectedId}`, {
                    name: formData.name
                });
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(t('msg.opFailed') + ": " + (error.response?.data?.error || t('stu.unknownError')));
        }
    };

    const handleLogout = () => { logout(); navigate('/login'); };

    if (loading) return <div className="p-10 text-center text-gray-500">{t('common.loading')}</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Navbar */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <School className="text-blue-600" /> {t('role.admin')}
                        </h1>
                        <div className="flex items-center gap-5">
                            <LanguageSwitcher />
                            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors text-sm font-medium">
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

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">{t('admin.schools')}</h2>
                        <p className="text-gray-500 mt-1">{t('admin.manageSubtitle')}</p>
                    </div>
                    <button onClick={openCreateSchool} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 font-medium transition-all">
                        <Plus size={20} /> {t('admin.newSchool')}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {schools.map((school) => (
                        <div key={school.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* School Header */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg"><School size={20} className="text-blue-700" /></div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">{school.name}</h3>
                                        {school.address && <p className="text-xs text-gray-500">{school.address}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEditSchool(school)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete('school', school.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>

                            {/* Branches Grid */}
                            <div className="p-6 bg-white">
                                {/* School-level Managers */}
                                <div className="mb-5 bg-sky-50/50 border border-sky-100 rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs font-bold text-sky-400 uppercase flex items-center gap-1">
                                            <UserIcon size={12} /> {t('admin.managers')}
                                        </div>
                                        <button
                                            onClick={() => openCreateManager(school.id)}
                                            className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded hover:bg-sky-200 flex items-center gap-1"
                                        >
                                            <Plus size={10} /> {t('common.add')}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {school.managers && school.managers.map((mgr) => (
                                            <div key={mgr.user_id || mgr.id} className="flex items-center gap-2 bg-white border border-sky-100 rounded px-2 py-1">
                                                <div className="leading-tight">
                                                    <span className="block font-medium text-xs text-gray-700">{mgr.name}</span>
                                                    <span className="block text-[10px] text-gray-400">{mgr.user?.email || mgr.email || t('admin.noEmail')}</span>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => openEditManager(mgr)} className="text-gray-300 hover:text-sky-500"><Edit2 size={12} /></button>
                                                    <button onClick={() => handleDelete('manager', mgr.user_id || mgr.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {(!school.managers || school.managers.length === 0) && <span className="text-gray-400 italic text-xs py-1">{t('admin.noManagers')}</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {school.branches && school.branches.map((branch) => (
                                        <div key={branch.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors group">

                                            {/* Branch Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2 font-semibold text-gray-700">
                                                    <MapPin size={16} className="text-green-600" />
                                                    {branch.name}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEditBranch(branch)} className="text-gray-400 hover:text-blue-500"><Edit2 size={14} /></button>
                                                    <button onClick={() => handleDelete('branch', branch.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                                </div>
                                            </div>

                                            {/* Librarians List */}
                                            <div className="bg-gray-50 rounded p-3 text-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                                                        <Users size={12} /> {t('admin.librarians')}
                                                    </div>
                                                    <button
                                                        onClick={() => openCreateLibrarian(branch.id, school.id)}
                                                        className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200 flex items-center gap-1"
                                                    >
                                                        <Plus size={10} /> {t('common.add')}
                                                    </button>
                                                </div>

                                                <div className="space-y-2">
                                                    {branch.librarians && branch.librarians.map((lib) => (
                                                        <div key={lib.user_id || lib.id} className="flex justify-between items-center text-gray-600 bg-white p-1 rounded border border-gray-100">

                                                            <div className="truncate pr-2">
                                                                <span className="block font-medium text-xs">{lib.name}</span>
                                                                
                                                                {/* 👇 FIX 4: CRITICAL FIX FOR WHITE SCREEN CRASH */}
                                                                <span className="block text-[10px] text-gray-400">
                                                                    {lib.user?.email || lib.email || t('admin.noEmail')}
                                                                </span>

                                                            </div>

                                                            <div className="flex gap-1 shrink-0">
                                                                <button onClick={() => openEditLibrarian(lib)} className="text-gray-300 hover:text-blue-500">
                                                                    <Edit2 size={12} />
                                                                </button>
                                                                <button onClick={() => handleDelete('librarian', lib.user_id || lib.id)} className="text-gray-300 hover:text-red-500">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(!branch.librarians || branch.librarians.length === 0) && <span className="text-gray-400 italic text-xs block py-1">{t('admin.noStaff')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => openCreateBranch(school.id)}
                                        className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all h-full min-h-[150px]"
                                    >
                                        <Plus size={24} className="mb-2" />
                                        <span className="text-sm font-medium">{t('admin.addBranch')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Modals --- */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={t('admin.md.' + modalType)}
            >
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* 1. School Form */}
                    {(modalType.includes('school')) && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.schoolName')}</label>
                                <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.address')}</label>
                                <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required />
                            </div>
                        </div>
                    )}

                    {/* 2. Branch Form */}
                    {(modalType.includes('branch')) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.branchName')}</label>
                            <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder={t('admin.branchPlaceholder')}
                                value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                    )}

                    {/* 3. Librarian / Manager Form (same fields: name, email, password) */}
                    {(modalType.includes('librarian') || modalType.includes('manager')) && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.name')}</label>
                                <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={t('admin.namePlaceholder')}
                                    value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                                <input type="email" className={`w-full border border-gray-300 rounded-lg px-4 py-2 outline-none ${modalType.startsWith('edit_') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'}`}
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
                                    <input type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="••••••"
                                        value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                                </div>
                            )}
                        </div>
                    )}

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        {t('common.save')}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default AdminDashboard;