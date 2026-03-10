import { useEffect, useState, useContext, Fragment } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Bell, Plus, Search, CheckCircle, XCircle, ArrowRight, ChevronDown, ChevronUp, ChevronRight, Edit2, Trash2, Settings, School, Clock, Calendar, Undo2, AlertTriangle, Filter, Layers, Home, Mail, Moon, Sun, MoreHorizontal, ChevronLeft, FileText, Users, Info } from 'lucide-react';
import Modal from '../../components/Modal';

const LibrarianDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // UI State
    const [activeTab, setActiveTab] = useState('inventory');
    const [loading, setLoading] = useState(true);
    const [isDark, setIsDark] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(true);
    const [openDropdownId, setOpenDropdownId] = useState(null); 
    const [expandedBookId, setExpandedBookId] = useState(null);

    // Data State
    const [books, setBooks] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loans, setLoans] = useState([]);
    const [students, setStudents] = useState([]);

    // Forms & Modals
    const [loanForm, setLoanForm] = useState({ student_id: '', book_copy_id: '', due_date: '' });
    const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', publisher: '', publication_year: '', genre: '', page_count: '' });
    const [selectedBookId, setSelectedBookId] = useState(null);
    const [copyForm, setCopyForm] = useState({ quantity: 1, condition: 'New', status: 'Available' });
    const [selectedCopyId, setSelectedCopyId] = useState(null);
    const [targetBookId, setTargetBookId] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selectedResId, setSelectedResId] = useState(null);
    
    // Selected Student details for Modal
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentLoans, setStudentLoans] = useState([]);
    const [studentHistoryTimeFrame, setStudentHistoryTimeFrame] = useState('all'); 

    // Filters (Inventory/Loans)
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [callNoFilter, setCallNoFilter] = useState('');
    const [isbnFilter, setIsbnFilter] = useState('');

    // 👇 NEW: Merged Student Class filter (e.g., '7-A')
    const [studentSearch, setStudentSearch] = useState('');
    const [studentIdFilter, setStudentIdFilter] = useState('');
    const [studentClass, setStudentClass] = useState('All');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // --- 1. FETCH DATA & EVENT LISTENERS ---
    useEffect(() => {
        const loadData = async () => {
            await fetchBooks();
            await fetchLoans();
            await fetchReservations();
            await fetchStudents();
            setLoading(false);
        };
        loadData();

        const handleClickOutside = () => setOpenDropdownId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [user, activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedGenre, callNoFilter, isbnFilter, itemsPerPage, studentSearch, studentIdFilter, studentClass]);

    const fetchBooks = async () => { try { const res = await api.get('/books'); setBooks(res.data); } catch (err) { console.error(err); } };
    const fetchLoans = async () => { try { const res = await api.get('/loans'); setLoans(res.data); } catch (err) { console.error(err); } };
    const fetchReservations = async () => { try { const res = await api.get('/reservations'); setReservations(res.data); } catch (err) { console.error(err); } };
    const fetchStudents = async () => { try { const res = await api.get('/class-list'); setStudents(res.data); } catch (err) { console.error(err); } };

    // --- 2. ACTIONS ---
    const handleLogout = () => { logout(); navigate('/login'); };

    const handleLoan = async (e) => {
        e.preventDefault();
        try {
            await api.post('/loan', { student_id: parseInt(loanForm.student_id), book_copy_id: parseInt(loanForm.book_copy_id), due_date: loanForm.due_date });
            alert("Kitap Başarıyla Verildi! 📖"); 
            setLoanForm({ student_id: '', book_copy_id: '', due_date: '' }); 
            setIsModalOpen(false);
            fetchLoans();
            fetchBooks();
        } catch (err) { alert("İşlem başarısız: " + (err.response?.data?.error || "Hata")); }
    };

    const handleQuickReturn = async (e) => {
        e.preventDefault();
        try { 
            await api.post(`/return/${loanForm.book_copy_id}`); 
            alert("Kitap Başarıyla İade Alındı! ✅");
            setIsModalOpen(false);
            setLoanForm({ student_id: '', book_copy_id: '', due_date: '' }); 
            fetchLoans(); 
            fetchBooks();
            fetchStudents();
        } catch (err) { alert("İade başarısız: Ödünç kaydı bulunamadı."); }
    };

    const handleReservationAction = async (id, actionWord) => {
        try { 
            await api.post(`/reservation/${id}`, { action: actionWord }); 
            fetchReservations(); 
            setOpenDropdownId(null);
        } catch (err) { alert("İşlem başarısız"); }
    };

    const handleIssueReservation = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/reservation/${selectedResId}/issue`, { due_date: loanForm.due_date });
            alert("Rezervasyon Onaylandı ve Kitap Verildi! ✅"); 
            setIsModalOpen(false); 
            fetchReservations(); 
            fetchLoans();
        } catch (err) { alert("İşlem başarısız"); }
    };

    // --- 3. INVENTORY ACTIONS ---
    const handleBookSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...bookForm, publication_year: parseInt(bookForm.publication_year), page_count: parseInt(bookForm.page_count) };
            if (modalType === 'add_book') await api.post('/books', payload);
            else await api.put(`/books/${selectedBookId}`, payload);
            setIsModalOpen(false); fetchBooks();
        } catch (err) { alert("İşlem başarısız"); }
    };

    const handleDeleteBook = async (id) => {
        if (!window.confirm("Bu kitabı tamamen silmek istediğinize emin misiniz?")) return;
        try { await api.delete(`/books/${id}`); fetchBooks(); setOpenDropdownId(null); } catch (err) { alert("Silme başarısız"); }
    };

    const openEditBook = (book) => {
        setModalType('edit_book'); setSelectedBookId(book.id);
        setBookForm({ title: book.title, author: book.author, isbn: book.isbn||'', publisher: book.publisher||'', publication_year: book.publication_year||'', genre: book.genre||'', page_count: book.page_count||'' });
        setIsModalOpen(true);
        setOpenDropdownId(null);
    };

    const openAddCopy = (bookId) => { setModalType('add_copy'); setTargetBookId(bookId); setCopyForm({ quantity: 1, condition: 'New', status: 'Available' }); setIsModalOpen(true); setOpenDropdownId(null); };

    const openEditCopy = (copy) => { setModalType('edit_copy'); setSelectedCopyId(copy.id); setCopyForm({ quantity: 1, condition: copy.condition, status: copy.status }); setIsModalOpen(true); };
    const handleCopySubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalType === 'add_copy') await api.post('/books/copy', { book_id: targetBookId, quantity: parseInt(copyForm.quantity), condition: copyForm.condition });
            else await api.put(`/copy/${selectedCopyId}`, { condition: copyForm.condition, status: copyForm.status });
            setIsModalOpen(false); fetchBooks();
        } catch (err) { alert("İşlem başarısız"); }
    };
    const handleDeleteCopy = async (id) => { if (!window.confirm("Kopyayı sil?")) return; try { await api.delete(`/copy/${id}`); fetchBooks(); } catch (err) { alert("Silme başarısız"); } };

    const openStudentDetails = async (student) => {
        setSelectedStudent(student);
        setStudentHistoryTimeFrame('all'); 
        try {
            const res = await api.get(`/my-library/${student.user_id}`);
            setStudentLoans(res.data || []);
            setModalType('student_details');
            setIsModalOpen(true);
        } catch (err) {
            alert("Öğrenci geçmişi yüklenemedi.");
        }
    };

    // --- 4. FILTERING LOGIC ---
    const uniqueGenres = ['All', ...new Set(books.map(b => b.genre).filter(Boolean))];
    
    // 👇 NEW: Extract and sort combined classes (e.g. '7-A', '8-B') safely
    const uniqueClasses = [...new Set(
        students
            .filter(s => s.grade && s.class_group) // Ensure they have both
            .map(s => `${s.grade}-${s.class_group}`)
    )].sort((a, b) => {
        const [gradeA, groupA] = a.split('-');
        const [gradeB, groupB] = b.split('-');
        if (parseInt(gradeA) !== parseInt(gradeB)) return parseInt(gradeA) - parseInt(gradeB);
        return groupA.localeCompare(groupB);
    });

    const processedBooks = books.filter(b => {
        if (searchQuery && !b.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !b.author?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedGenre !== 'All' && b.genre !== selectedGenre) return false;
        if (callNoFilter && !b.id?.toString().includes(callNoFilter)) return false;
        if (isbnFilter && !(b.isbn || "").toLowerCase().includes(isbnFilter.toLowerCase())) return false;
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(processedBooks.length / itemsPerPage));
    const currentBooks = processedBooks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const processedReservations = reservations.filter(r => {
        if (r.status !== 'Pending' && r.status !== 'Approved') return false; 
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const bookTitle = (r.book_copy?.book?.title || "").toLowerCase();
            const studentName = (r.student?.name || "").toLowerCase();
            if (!bookTitle.includes(q) && !studentName.includes(q)) return false;
        }
        if (selectedGenre !== 'All' && r.book_copy?.book?.genre !== selectedGenre) return false;
        if (callNoFilter && !r.book_copy?.book?.id?.toString().includes(callNoFilter)) return false;
        return true;
    });

    const processedLoans = loans.filter(l => {
        if (l.status !== 'Active') return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const bookTitle = (l.book_copy?.book?.title || "").toLowerCase();
            const studentName = (l.student?.name || "").toLowerCase();
            if (!bookTitle.includes(q) && !studentName.includes(q)) return false;
        }
        if (selectedGenre !== 'All' && l.book_copy?.book?.genre !== selectedGenre) return false;
        if (callNoFilter && !l.book_copy?.book?.id?.toString().includes(callNoFilter)) return false;
        return true;
    }).sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date));

    const processedStudents = students.filter(s => {
        if (studentSearch && !s.name?.toLowerCase().includes(studentSearch.toLowerCase())) return false;
        if (studentIdFilter && !s.user_id?.toString().includes(studentIdFilter)) return false;
        
        // 👇 NEW: Filter by the combined class string (e.g. '7-A')
        if (studentClass !== 'All') {
            const sClass = `${s.grade}-${s.class_group}`;
            if (sClass !== studentClass) return false;
        }
        return true;
    });

    const overdueCount = loans.filter(l => l.status === 'Active' && new Date(l.due_date) < new Date()).length;

    if (loading) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Yükleniyor...</div>;

    return (
        <div className={isDark ? 'dark' : ''}>
            <div className="flex h-screen bg-[#F8F9FA] dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
                
                {/* LEFT SIDEBAR */}
                <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-sm transition-colors duration-200">
                    <div className="h-20 flex items-center px-8 border-b border-gray-100 dark:border-gray-800">
                        <img src="/logo.png" alt="e12" className="h-8" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span className="text-2xl font-bold text-[#E85B5B] hidden">e12</span>
                    </div>
                    
                    <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Home size={18} /> Anasayfa
                        </button>
                        
                        <div className="mt-4 mb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                            Kütüphane <ChevronDown size={14}/>
                        </div>
                        
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium bg-[#E85B5B] text-white rounded-xl shadow-md shadow-red-200 dark:shadow-none">
                            <BookOpen size={18} /> Kütüphanem
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <FileText size={18} /> Kitaplarım
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Settings size={18} /> Kütüphane Yönetim
                        </button>

                        <div className="mt-auto">
                            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <LogOut size={18} /> Çıkış Yap
                            </button>
                        </div>
                    </nav>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col h-screen overflow-hidden">
                    
                    {/* Top Header */}
                    <header className="h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 z-10 transition-colors duration-200">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium text-sm">
                            Anasayfa
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
                                <Mail size={20} className="hover:text-gray-600 cursor-pointer" />
                                <Bell size={20} className="hover:text-gray-600 cursor-pointer" />
                                <button onClick={() => setIsDark(!isDark)} className="hover:text-indigo-500 outline-none">
                                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800">
                                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold uppercase">
                                    {user?.name?.charAt(0) || 'P'}
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">{user?.name || "Personel"}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{user?.email || "personel@e12.com.tr"}</p>
                                    <p className="text-[10px] font-bold text-[#E85B5B] mt-0.5 uppercase tracking-wide">Kütüphane ID: {user?.librarian?.branch_id || '-'}</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Scrollable Content */}
                    <main className="flex-1 overflow-y-auto p-8">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-full transition-colors duration-200">
                            
                            {/* Tabs */}
                            <div className="px-8 pt-6 border-b border-gray-100 dark:border-gray-800 flex gap-8 relative">
                                <button onClick={() => setActiveTab('inventory')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'inventory' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Kitaplar
                                    {activeTab === 'inventory' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('reservations')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'reservations' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Rezerve Edilen Kitaplar
                                    {activeTab === 'reservations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('loans')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'loans' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Verilen Kitaplar
                                    {activeTab === 'loans' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('members')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'members' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Üyeler
                                    {activeTab === 'members' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>

                                {/* Action Button in Header */}
                                {activeTab === 'inventory' && (
                                    <div className="absolute right-8 bottom-3">
                                        <button onClick={() => { setModalType('add_book'); setBookForm({ title: '', author: '', isbn: '', publisher: '', publication_year: '', genre: '', page_count: '' }); setIsModalOpen(true); }} className="bg-[#E85B5B] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-red-600 transition-colors flex items-center gap-1">
                                            <Plus size={14} /> Yeni Kitap Ekle
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-8">
                                {/* Universal Filter Block */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none hover:text-[#E85B5B] transition-colors">
                                            {isFilterOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} Filtre
                                        </button>
                                    </div>
                                    
                                    {isFilterOpen && (
                                        <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                            
                                            {/* FILTER: KİTAPLAR, REZERVASYONLAR, VERİLEN KİTAPLAR */}
                                            {activeTab !== 'members' ? (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                                                        <div className="lg:col-span-2">
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Arama</label>
                                                            <input type="text" placeholder={activeTab === 'inventory' ? "Kitap adı veya yazar ile ara" : "Kitap adı veya öğrenci ismi ile ara"} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Konu</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                                                                {uniqueGenres.map(g => <option key={g} value={g}>{g === 'All' ? 'Konuya göre ara' : g}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">ISBN</label>
                                                            <input type="text" placeholder="ISBN Numarası" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={isbnFilter} onChange={(e) => setIsbnFilter(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Call No</label>
                                                            <input type="text" placeholder="Call No (Örn: 10)" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={callNoFilter} onChange={(e) => setCallNoFilter(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">CEFR</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]"><option>CEFR</option></select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Demirbaş Durumu</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]"><option>Demirbaş Durumu</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Dil</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]"><option>Dil Seçiniz</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Durum</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]"><option>Durum</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Teslim Tarihi</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]"><option>Teslim Tarihi</option></select>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                /* 👇 UPDATED: FILTER: ÜYELER */
                                                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                    <div className="lg:col-span-2">
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Kişi Ara</label>
                                                        <input type="text" placeholder="Ad Soyad" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Öğrenci Numarası</label>
                                                        <input type="text" placeholder="Öğrenci No" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={studentIdFilter} onChange={(e) => setStudentIdFilter(e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Birim</label>
                                                        <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]">
                                                            <option>Tümü</option>
                                                            <option>{user?.librarian?.branch?.name || "Merkez Şube"}</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        {/* 👇 UPDATED: Combined Sınıf dropdown */}
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Sınıf</label>
                                                        <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                                                            <option value="All">Tümü</option>
                                                            {uniqueClasses.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* === SUB-TAB VIEWS === */}
                                
                                {/* 1. INVENTORY (Kitaplar) */}
                                {activeTab === 'inventory' && (
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                    <tr>
                                                        <th className="px-4 py-4 w-10"></th>
                                                        <th className="px-2 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kütüphane</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kitap Adı</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Yazar</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Yayınevi</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Konusu</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">Demirbaş Durumu</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">Durum</th>
                                                        <th className="px-6 py-4 text-center font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">İşlemler</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                    {currentBooks.map(book => {
                                                        const totalCopies = book.copies?.length || 0;
                                                        const availableCopies = book.copies?.filter(c => c.status === 'Available').length || 0;
                                                        const goodCondition = book.copies?.filter(c => ['New', 'Good', 'Yeni', 'İyi'].includes(c.condition)).length || 0;
                                                        
                                                        const isExpanded = expandedBookId === book.id;

                                                        return (
                                                            <Fragment key={book.id}>
                                                                <tr 
                                                                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/30' : ''} ${openDropdownId === `inv-${book.id}` ? 'relative z-40' : ''}`}
                                                                    onClick={() => setExpandedBookId(isExpanded ? null : book.id)}
                                                                >
                                                                    <td className="px-4 py-4 text-gray-400">
                                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                                    </td>
                                                                    <td className="px-2 py-4 text-gray-600 dark:text-gray-400 font-medium text-xs">{user?.librarian?.branch?.name || "Merkez"}</td>
                                                                    <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-xs">
                                                                        {book.title}
                                                                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">Call No: {book.id} | ISBN: {book.isbn || '-'}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{book.author}</td>
                                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{book.publisher || '-'}</td>
                                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{book.genre || '-'}</td>
                                                                    <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200 font-bold text-[11px]">{availableCopies} / {totalCopies} Müsait</td>
                                                                    <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200 font-bold text-[11px]">{goodCondition} / {totalCopies} Sağlam</td>
                                                                    
                                                                    <td className="px-6 py-4 text-center relative">
                                                                        <div className="flex items-center justify-center gap-3">
                                                                            <span className="text-yellow-500 hover:text-yellow-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); openEditBook(book); }}>
                                                                                <Info size={12}/> Detay
                                                                            </span>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `inv-${book.id}` ? null : `inv-${book.id}`); }} 
                                                                                className="text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded transition-colors outline-none"
                                                                            >
                                                                                <MoreHorizontal size={18}/>
                                                                            </button>
                                                                        </div>

                                                                        {openDropdownId === `inv-${book.id}` && (
                                                                            <div className="absolute right-10 top-0 mt-6 flex flex-col gap-1.5 z-50 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 animate-in fade-in zoom-in-95 duration-100 w-40" onClick={(e) => e.stopPropagation()}>
                                                                                <button onClick={() => { setModalType('issue_loan_modal'); setTargetBookId(book.id); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#C2E0C6] border border-[#A3D3A8] text-[#1E5631] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#A3D3A8] transition-colors w-full">Kitabı Ver</button>
                                                                                <button onClick={() => { setModalType('return_book_modal'); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FBCFE8] transition-colors w-full">Kitabı Geri Al</button>
                                                                                <button onClick={() => openAddCopy(book.id)} className="bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FDE68A] transition-colors w-full">Yeni Kopya Ekle</button>
                                                                                <button onClick={() => handleDeleteBook(book.id)} className="bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-red-200 transition-colors w-full mt-2">Sil</button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                
                                                                {isExpanded && (
                                                                    <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 cursor-default">
                                                                        <td colSpan="9" className="px-10 py-6">
                                                                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                                                                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                                                    <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs uppercase">Fiziksel Kopyalar</h4>
                                                                                    <button onClick={() => openAddCopy(book.id)} className="text-xs bg-[#1E5631] text-white px-3 py-1 rounded hover:bg-green-800 transition-colors">+ Kopya Ekle</button>
                                                                                </div>
                                                                                <table className="w-full text-left text-xs">
                                                                                    <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400">
                                                                                            <tr>
                                                                                            <th className="px-4 py-2 font-semibold">Kopya ID</th>
                                                                                            <th className="px-4 py-2 font-semibold">Demirbaş Durumu (Müsaitlik)</th>
                                                                                            <th className="px-4 py-2 font-semibold">Durum (Fiziksel)</th>
                                                                                            <th className="px-4 py-2 font-semibold text-right">İşlemler</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                                                        {book.copies?.map(copy => (
                                                                                            <tr key={copy.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                                                <td className="px-4 py-3 font-mono text-gray-500">#{copy.id}</td>
                                                                                                <td className="px-4 py-3">
                                                                                                    <span className={`px-2 py-1 rounded font-bold ${copy.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{copy.status}</span>
                                                                                                </td>
                                                                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{copy.condition}</td>
                                                                                                <td className="px-4 py-3 text-right">
                                                                                                    <button onClick={() => openEditCopy(copy)} className="text-blue-500 hover:text-blue-700 mr-3 font-medium">Düzenle</button>
                                                                                                    <button onClick={() => handleDeleteCopy(copy.id)} className="text-red-500 hover:text-red-700 font-medium">Sil</button>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                        {(!book.copies || book.copies.length === 0) && (
                                                                                            <tr><td colSpan="4" className="text-center py-6 text-gray-400">Bu kitaba ait fiziksel kopya bulunmuyor.</td></tr>
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </Fragment>
                                                        );
                                                    })}
                                                    {currentBooks.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl gap-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <span>Sayfa başına göster:</span>
                                                <select 
                                                    value={itemsPerPage} 
                                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded px-2 py-1 outline-none focus:border-[#E85B5B] cursor-pointer"
                                                >
                                                    <option value={20}>20</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                    <option value={200}>200</option>
                                                </select>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="text-gray-500 dark:text-gray-400 hidden sm:block">
                                                    Toplam <strong className="text-gray-700 dark:text-gray-200">{processedBooks.length}</strong> kayıttan <strong className="text-gray-700 dark:text-gray-200">{processedBooks.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, processedBooks.length)}</strong> arası
                                                </span>
                                                
                                                <div className="flex items-center gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm">
                                                    <button 
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="p-1.5 rounded-l-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 transition-colors"
                                                    >
                                                        <ChevronLeft size={18} />
                                                    </button>
                                                    <div className="px-3 text-xs font-bold text-gray-700 dark:text-gray-200 border-x border-gray-200 dark:border-gray-600">
                                                        {currentPage} / {totalPages}
                                                    </div>
                                                    <button 
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={currentPage === totalPages || totalPages === 0}
                                                        className="p-1.5 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 transition-colors"
                                                    >
                                                        <ChevronRight size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 2. RESERVATIONS (Rezerve Edilen Kitaplar) */}
                                {activeTab === 'reservations' && (
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kitap Adı</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kopya ID</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Öğrenci</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Talep Tarihi</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">Durum</th>
                                                    <th className="px-6 py-4 text-center font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                {processedReservations.map(res => {
                                                    const isPending = res.status === 'Pending';
                                                    
                                                    return (
                                                        <tr key={res.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative group ${openDropdownId === `res-${res.id}` ? 'relative z-40' : ''}`}>
                                                            <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-xs">{res.book_copy?.book?.title}</td>
                                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">#{res.book_copy_id}</td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{res.student?.name}</td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{new Date(res.request_date).toLocaleDateString()}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-3 py-1 rounded text-[10px] font-bold tracking-wide ${isPending ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {isPending ? 'Onay Bekliyor' : 'Onaylandı (Teslim Bekleniyor)'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center relative">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `res-${res.id}` ? null : `res-${res.id}`); }} 
                                                                    className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 outline-none"
                                                                >
                                                                    <MoreHorizontal size={18}/>
                                                                </button>
                                                                
                                                                {openDropdownId === `res-${res.id}` && (
                                                                    <div className="absolute right-10 top-0 mt-6 flex flex-col gap-1.5 z-50 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100 w-36" onClick={(e) => e.stopPropagation()}>
                                                                        {isPending ? (
                                                                            <>
                                                                                <button onClick={() => handleReservationAction(res.id, 'Approved')} className="bg-[#C2E0C6] border border-[#A3D3A8] text-[#1E5631] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#A3D3A8] transition-colors w-full">Onayla</button>
                                                                                <button onClick={() => handleReservationAction(res.id, 'Rejected')} className="bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FBCFE8] transition-colors w-full">Reddet</button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <button onClick={() => { setSelectedResId(res.id); setModalType('issue_res'); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#E0E7FF] border border-[#BFDBFE] text-[#4338CA] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#C7D2FE] transition-colors w-full">Kitabı Ver</button>
                                                                                <button onClick={() => handleReservationAction(res.id, 'Rejected')} className="bg-[#FFEDD5] border border-[#FDBA74] text-[#C2410C] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FDBA74] transition-colors w-full">İptal Et</button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {processedReservations.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">Aktif rezervasyon bulunamadı.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* 3. LOANS (Verilen Kitaplar) */}
                                {activeTab === 'loans' && (
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        {overdueCount > 0 && (
                                            <div className="bg-red-50 dark:bg-red-900/20 px-6 py-3 border-b border-red-100 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-400 animate-pulse">
                                                <AlertTriangle size={18} />
                                                <span className="font-bold text-sm">Dikkat! İadesi geciken {overdueCount} kitap var.</span> 
                                            </div>
                                        )}
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kopya ID</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kitap Adı</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Öğrenci (ID)</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Veriliş Tarihi</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Teslim Tarihi</th>
                                                    <th className="px-6 py-4 text-center font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                {processedLoans.map(loan => {
                                                    const isOverdue = new Date(loan.due_date) < new Date();
                                                    return (
                                                        <tr key={loan.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isOverdue ? 'bg-red-50/30 dark:bg-red-900/10' : ''} ${openDropdownId === `loan-${loan.id}` ? 'relative z-40' : ''}`}>
                                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">#{loan.book_copy_id}</td>
                                                            <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-xs">{loan.book_copy?.book?.title}</td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{loan.student?.name} <span className="text-gray-400">({loan.student_id})</span></td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{new Date(loan.issue_date).toLocaleDateString()}</td>
                                                            <td className={`px-6 py-4 font-bold text-xs ${isOverdue ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                {new Date(loan.due_date).toLocaleDateString()}
                                                                {isOverdue && <span className="ml-2 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px]">GECİKTİ</span>}
                                                            </td>
                                                            <td className="px-6 py-4 text-center relative">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `loan-${loan.id}` ? null : `loan-${loan.id}`); }} 
                                                                    className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 outline-none"
                                                                >
                                                                    <MoreHorizontal size={18}/>
                                                                </button>
                                                                
                                                                {openDropdownId === `loan-${loan.id}` && (
                                                                    <div className="absolute right-10 top-0 mt-6 flex flex-col gap-1.5 z-50 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100 w-36" onClick={(e) => e.stopPropagation()}>
                                                                        <button onClick={(e) => { setLoanForm({ ...loanForm, book_copy_id: loan.book_copy_id }); handleQuickReturn(e); }} className="bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FBCFE8] transition-colors w-full">Kitabı İade Al</button>
                                                                        <button className="bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FDE68A] transition-colors w-full">Hatırlatma SMS</button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {processedLoans.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">Aktif ödünç bulunamadı.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* 👇 UPDATED: 4. MEMBERS (Üyeler) */}
                                {activeTab === 'members' && (
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kişi</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Birim</th>
                                                    {/* Changed Header */}
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Sınıf</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Kişi Türü</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">Kullanılan Kitap Sayısı</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-right">İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                {processedStudents.map(student => {
                                                    const activeLoansCount = student.loans?.filter(l => l.status === 'Active').length || 0;
                                                    
                                                    return (
                                                        <tr key={student.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="font-bold text-gray-800 dark:text-gray-200 text-xs">{student.name}</div>
                                                                <div className="text-[10px] text-gray-400 mt-0.5">No: {student.user_id}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{user?.librarian?.branch?.name || "Merkez Şube"}</td>
                                                            {/* Changed cell: combines grade and class_group */}
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{student.grade} {student.class_group}</td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">Öğrenci</td>
                                                            <td className="px-6 py-4 text-center font-bold text-gray-800 dark:text-gray-200 text-sm">{activeLoansCount}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button 
                                                                    onClick={() => openStudentDetails(student)}
                                                                    className="text-yellow-500 hover:text-yellow-600 text-[11px] font-bold flex items-center gap-1 justify-end ml-auto outline-none transition-colors"
                                                                >
                                                                    <Info size={14}/> Detay
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {processedStudents.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">Öğrenci bulunamadı.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* Edit / Add Book Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'add_book' || modalType === 'edit_book')} onClose={() => setIsModalOpen(false)} title={modalType === 'add_book' ? "Yeni Kitap Ekle" : "Kitabı Düzenle"}>
                <form onSubmit={handleBookSubmit} className="space-y-4">
                    <input type="text" placeholder="Kitap Adı" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.title} onChange={e => setBookForm({ ...bookForm, title: e.target.value })} required />
                    <input type="text" placeholder="Yazar" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.author} onChange={e => setBookForm({ ...bookForm, author: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="ISBN" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.isbn} onChange={e => setBookForm({ ...bookForm, isbn: e.target.value })} />
                        <input type="number" placeholder="Yıl" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.publication_year} onChange={e => setBookForm({ ...bookForm, publication_year: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Tür / Konu" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.genre} onChange={e => setBookForm({ ...bookForm, genre: e.target.value })} />
                        <input type="number" placeholder="Sayfa Sayısı" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.page_count} onChange={e => setBookForm({ ...bookForm, page_count: e.target.value })} />
                    </div>
                    <input type="text" placeholder="Yayınevi" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={bookForm.publisher} onChange={e => setBookForm({ ...bookForm, publisher: e.target.value })} />
                    <button className="w-full bg-[#E85B5B] hover:bg-red-600 text-white py-2 rounded font-bold transition-colors">Kaydet</button>
                </form>
            </Modal>

            {/* Direct Issue Loan Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'issue_loan_modal' || modalType === 'issue_res')} onClose={() => setIsModalOpen(false)} title={modalType === 'issue_res' ? "Rezervasyonu Onayla ve Kitabı Ver" : "Öğrenciye Kitap Ver"}>
                <form onSubmit={modalType === 'issue_res' ? handleIssueReservation : handleLoan} className="space-y-4">
                    {modalType === 'issue_loan_modal' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Öğrenci ID</label>
                                <input type="number" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.student_id} onChange={e => setLoanForm({ ...loanForm, student_id: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Verilecek Kopya ID</label>
                                <input type="number" placeholder="Örn: 12" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.book_copy_id} onChange={e => setLoanForm({ ...loanForm, book_copy_id: e.target.value })} required />
                                <span className="text-xs text-gray-400 mt-1 block">*Lütfen kütüphanedeki müsait bir kopyanın ID'sini girin.</span>
                            </div>
                        </>
                    )}
                    {modalType === 'issue_res' && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Öğrenci kitabı teslim almaya geldi. Lütfen son teslim tarihini belirleyin.</p>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Son Teslim Tarihi</label>
                        <input type="date" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.due_date} onChange={e => setLoanForm({...loanForm, due_date: e.target.value})} required/>
                    </div>
                    <button className="w-full bg-[#1E5631] hover:bg-green-800 text-white py-2 rounded font-bold transition-colors">Onayla ve Ver</button>
                </form>
            </Modal>

            {/* Return Book Modal */}
            <Modal isOpen={isModalOpen && modalType === 'return_book_modal'} onClose={() => setIsModalOpen(false)} title="Kitabı İade Al">
                <form onSubmit={handleQuickReturn} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Kopya ID</label>
                        <input type="number" placeholder="Örn: 12" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.book_copy_id} onChange={e => setLoanForm({ ...loanForm, book_copy_id: e.target.value })} required />
                        <span className="text-xs text-gray-400 mt-1 block">*Öğrencinin getirdiği kitabın arkasındaki Kopya ID numarasını girin.</span>
                    </div>
                    <button className="w-full bg-[#9D174D] hover:bg-pink-800 text-white py-2 rounded font-bold transition-colors">İade İşlemini Tamamla</button>
                </form>
            </Modal>

            {/* Add / Edit Copy Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'add_copy' || modalType === 'edit_copy')} onClose={() => setIsModalOpen(false)} title={modalType === 'add_copy' ? "Kopya Ekle" : "Kopya Düzenle"}>
                <form onSubmit={handleCopySubmit} className="space-y-4">
                    {modalType === 'add_copy' && (
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Miktar</label>
                            <input type="number" min="1" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={copyForm.quantity} onChange={e => setCopyForm({ ...copyForm, quantity: e.target.value })} required />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Fiziksel Durum</label>
                        <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={copyForm.condition} onChange={e => setCopyForm({ ...copyForm, condition: e.target.value })}>
                            <option value="New">Yeni</option><option value="Good">İyi</option><option value="Fair">Orta</option><option value="Poor">Kötü</option>
                        </select>
                    </div>
                    {modalType === 'edit_copy' && (
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Demirbaş Durumu</label>
                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={copyForm.status} onChange={e => setCopyForm({ ...copyForm, status: e.target.value })}>
                                <option value="Available">Müsait (Available)</option><option value="Loaned">Ödünç Verildi (Loaned)</option><option value="Reserved">Rezerve (Reserved)</option><option value="Lost">Kayıp (Lost)</option><option value="Maintenance">Bakımda (Maintenance)</option>
                            </select>
                        </div>
                    )}
                    <button className="w-full bg-[#1E5631] hover:bg-green-800 text-white py-2 rounded font-bold transition-colors">Kaydet</button>
                </form>
            </Modal>

            {/* Student Details / Reading History Modal with Time Filter */}
            <Modal isOpen={isModalOpen && modalType === 'student_details'} onClose={() => setIsModalOpen(false)} title="Öğrenci Okuma Geçmişi" maxWidth="max-w-3xl">
                {selectedStudent && (() => {
                    const now = new Date();
                    const filteredStudentLoans = studentLoans.filter(loan => {
                        if (studentHistoryTimeFrame === 'all') return true;
                        
                        const d = new Date(loan.issue_date);
                        if (studentHistoryTimeFrame === 'year') {
                            return d.getFullYear() === now.getFullYear();
                        }
                        if (studentHistoryTimeFrame === 'month') {
                            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                        }
                        return true;
                    });

                    return (
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">{selectedStudent.name}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {selectedStudent.user_id} • Sınıf: {selectedStudent.grade} {selectedStudent.class_group}</p>
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <select 
                                        className="w-full sm:w-auto border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm px-3 py-1.5 outline-none rounded-lg focus:border-[#E85B5B]"
                                        value={studentHistoryTimeFrame}
                                        onChange={(e) => setStudentHistoryTimeFrame(e.target.value)}
                                    >
                                        <option value="all">Tüm Zamanlar</option>
                                        <option value="year">Bu Yıl</option>
                                        <option value="month">Bu Ay</option>
                                    </select>
                                    
                                    <div className="text-right border-l border-gray-200 dark:border-gray-600 pl-4">
                                        <span className="block text-xl font-bold text-[#E85B5B]">{filteredStudentLoans.length}</span>
                                        <span className="text-[10px] text-gray-400 uppercase whitespace-nowrap">Toplam İşlem</span>
                                    </div>
                                </div>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 sticky top-0 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-xs">Kitap Adı</th>
                                            <th className="px-4 py-3 font-semibold text-xs">Veriliş</th>
                                            <th className="px-4 py-3 font-semibold text-xs">İade</th>
                                            <th className="px-4 py-3 font-semibold text-xs text-right">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-800">
                                        {filteredStudentLoans.map(loan => (
                                            <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 text-xs">{loan.book_title}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{new Date(loan.issue_date).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{loan.return_date ? new Date(loan.return_date).toLocaleDateString() : '-'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${loan.status === 'Active' ? 'bg-[#FEF3C7] text-[#B45309]' : 'bg-[#E6F4EA] text-[#059669]'}`}>
                                                        {loan.status === 'Active' ? 'Kullanılıyor' : 'İade Edildi'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredStudentLoans.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-gray-400 text-xs">Bu döneme ait işlem bulunmamaktadır.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

        </div>
    );
};

export default LibrarianDashboard;