import { useEffect, useState, useContext, Fragment } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Bell, Plus, Search, CheckCircle, XCircle, ArrowRight, ChevronDown, ChevronUp, ChevronRight, Edit2, Trash2, Settings, School, Clock, Calendar, Undo2, AlertTriangle, Filter, Layers, Home, Mail, Moon, Sun, MoreHorizontal, ChevronLeft, FileText, Users, Info } from 'lucide-react';
import Modal from '../../components/Modal';
import SettingsPanel from './SettingsPanel';
import BulkUploadModal from './BulkUploadModal';

// Books and copies now reference category rows by id, so empty selects must be sent as
// null (not "") for the backend's *uint fields, and numeric inputs as real numbers.
const toId = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v));
const toNum = (v) => (v === '' || v === null || v === undefined ? 0 : parseInt(v));

const EMPTY_BOOK_FORM = {
    title: '', isbn: '', call_no: '', language: '', cefr_level: '',
    publication_year: '', edition: '', page_count: '', cover_url: '',
    physical_description: '', additional_notes: '',
    author_id: '', publisher_id: '', topic_id: '', genre_id: '', frequency_id: '',
    has_ebook: false, ebook_url: '',
};

const EMPTY_COPY_FORM = { tracking_number: '', condition_id: '', status_id: '' };
const EMPTY_LOAN_FORM = { student_id: '', tracking_number: '', due_date: '' };

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white";
const labelCls = "block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1";

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

    // Dynamic category lists that populate the book/copy dropdowns
    const [categories, setCategories] = useState({
        authors: [], publishers: [], topics: [], genres: [],
        frequencies: [], conditions: [], copyStatuses: [],
    });

    // Forms & Modals
    const [loanForm, setLoanForm] = useState(EMPTY_LOAN_FORM);
    const [studentPickerText, setStudentPickerText] = useState('');
    const [loanEditForm, setLoanEditForm] = useState({ due_date: '', description: '' });
    const [editLoanId, setEditLoanId] = useState(null);
    const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
    const [selectedBookId, setSelectedBookId] = useState(null);
    const [copyForm, setCopyForm] = useState(EMPTY_COPY_FORM);
    const [selectedCopyId, setSelectedCopyId] = useState(null);
    const [targetBookId, setTargetBookId] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('');
    const [isBulkOpen, setIsBulkOpen] = useState(false);
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
    const [cefrFilter, setCefrFilter] = useState('All');
    const [languageFilter, setLanguageFilter] = useState('All');
    const [availabilityFilter, setAvailabilityFilter] = useState('All');

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
            await fetchCategories();
            setLoading(false);
        };
        loadData();

        const handleClickOutside = () => setOpenDropdownId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [user, activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedGenre, callNoFilter, isbnFilter, cefrFilter, languageFilter, availabilityFilter, itemsPerPage, studentSearch, studentIdFilter, studentClass]);

    const fetchBooks = async () => { try { const res = await api.get('/books'); setBooks(res.data); } catch (err) { console.error(err); } };
    const fetchLoans = async () => { try { const res = await api.get('/loans'); setLoans(res.data); } catch (err) { console.error(err); } };
    const fetchReservations = async () => { try { const res = await api.get('/reservations'); setReservations(res.data); } catch (err) { console.error(err); } };
    const fetchStudents = async () => { try { const res = await api.get('/class-list'); setStudents(res.data); } catch (err) { console.error(err); } };

    const fetchCategories = async () => {
        try {
            const [authors, publishers, topics, genres, frequencies, conditions, copyStatuses] = await Promise.all([
                api.get('/authors'), api.get('/publishers'), api.get('/topics'), api.get('/genres'),
                api.get('/frequencies'), api.get('/copy-conditions'), api.get('/copy-statuses'),
            ]);
            setCategories({
                authors: authors.data || [], publishers: publishers.data || [],
                topics: topics.data || [], genres: genres.data || [],
                frequencies: frequencies.data || [], conditions: conditions.data || [],
                copyStatuses: copyStatuses.data || [],
            });
        } catch (err) { console.error("Error fetching categories", err); }
    };

    // --- 2. ACTIONS ---
    const handleLogout = () => { logout(); navigate('/login'); };

    // Loans and returns are keyed on the physical barcode, so resolve it to a book + copy
    // from the catalogue we already hold.
    const findCopyByTracking = (tracking) => {
        const needle = (tracking || '').trim();
        if (!needle) return null;
        for (const book of books) {
            const copy = book.copies?.find(c => c.tracking_number === needle);
            if (copy) return { book, copy };
        }
        return null;
    };

    const handleLoan = async (e) => {
        e.preventDefault();
        const match = findCopyByTracking(loanForm.tracking_number);
        if (!match) { alert("Bu demirbaş numarasına sahip bir kopya bulunamadı."); return; }
        try {
            await api.post('/loan', {
                student_id: parseInt(loanForm.student_id),
                book_id: match.book.id,
                tracking_number: match.copy.tracking_number,
                due_date: loanForm.due_date,
            });
            alert("Kitap Başarıyla Verildi! 📖");
            setLoanForm(EMPTY_LOAN_FORM);
            setStudentPickerText('');
            setIsModalOpen(false);
            fetchLoans();
            fetchBooks();
        } catch (err) { alert("İşlem başarısız: " + (err.response?.data?.error || "Hata")); }
    };

    const openEditLoan = (loan) => {
        setEditLoanId(loan.id);
        // <input type="date"> wants YYYY-MM-DD
        const due = loan.due_date ? new Date(loan.due_date).toISOString().slice(0, 10) : '';
        setLoanEditForm({ due_date: due, description: loan.description || '' });
        setModalType('edit_loan');
        setIsModalOpen(true);
        setOpenDropdownId(null);
    };

    const handleLoanEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/loans/${editLoanId}`, {
                due_date: loanEditForm.due_date,
                description: loanEditForm.description,
            });
            alert("Ödünç kaydı güncellendi.");
            setIsModalOpen(false);
            fetchLoans();
        } catch (err) { alert("Güncelleme başarısız: " + (err.response?.data?.error || "Hata")); }
    };

    // The backend finds the copy from the body; the :id segment is kept only for routing.
    const returnCopy = async (copyId, bookId, trackingNumber) => {
        try {
            await api.post(`/return/${copyId}`, { book_id: bookId, tracking_number: trackingNumber });
            alert("Kitap Başarıyla İade Alındı! ✅");
            setIsModalOpen(false);
            setLoanForm(EMPTY_LOAN_FORM);
            fetchLoans();
            fetchBooks();
            fetchStudents();
        } catch (err) { alert("İade başarısız: " + (err.response?.data?.error || "Ödünç kaydı bulunamadı.")); }
    };

    const handleQuickReturn = async (e) => {
        e.preventDefault();
        const match = findCopyByTracking(loanForm.tracking_number);
        if (!match) { alert("Bu demirbaş numarasına sahip bir kopya bulunamadı."); return; }
        await returnCopy(match.copy.id, match.book.id, match.copy.tracking_number);
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
            const payload = {
                ...bookForm,
                publication_year: toNum(bookForm.publication_year),
                page_count: toNum(bookForm.page_count),
                author_id: toId(bookForm.author_id),
                publisher_id: toId(bookForm.publisher_id),
                topic_id: toId(bookForm.topic_id),
                genre_id: toId(bookForm.genre_id),
                frequency_id: toId(bookForm.frequency_id),
            };
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
        setBookForm({
            title: book.title || '', isbn: book.isbn || '', call_no: book.call_no || '',
            language: book.language || '', cefr_level: book.cefr_level || '',
            publication_year: book.publication_year || '', edition: book.edition || '',
            page_count: book.page_count || '', cover_url: book.cover_url || '',
            physical_description: book.physical_description || '', additional_notes: book.additional_notes || '',
            author_id: book.author_id ?? '', publisher_id: book.publisher_id ?? '',
            topic_id: book.topic_id ?? '', genre_id: book.genre_id ?? '', frequency_id: book.frequency_id ?? '',
            has_ebook: book.has_ebook || false, ebook_url: book.ebook_url || '',
        });
        setIsModalOpen(true);
        setOpenDropdownId(null);
    };

    const openAddCopy = (bookId) => {
        setModalType('add_copy');
        setTargetBookId(bookId);
        // New copies start out available, so preselect the branch's AVAILABLE status.
        const available = categories.copyStatuses.find(s => s.code === 'AVAILABLE');
        setCopyForm({ ...EMPTY_COPY_FORM, status_id: available?.id ?? '' });
        setIsModalOpen(true);
        setOpenDropdownId(null);
    };

    const openEditCopy = (copy) => {
        setModalType('edit_copy');
        setSelectedCopyId(copy.id);
        setCopyForm({
            tracking_number: copy.tracking_number || '',
            condition_id: copy.condition_id ?? '',
            status_id: copy.status_id ?? '',
        });
        setIsModalOpen(true);
    };

    const handleCopySubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                tracking_number: copyForm.tracking_number,
                condition_id: toId(copyForm.condition_id),
                status_id: toId(copyForm.status_id),
            };
            if (modalType === 'add_copy') await api.post('/books/copy', { ...payload, book_id: targetBookId });
            else await api.put(`/copy/${selectedCopyId}`, payload);
            setIsModalOpen(false); fetchBooks();
        } catch (err) { alert("İşlem başarısız: " + (err.response?.data?.error || "Hata")); }
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
    const uniqueGenres = ['All', ...new Set(books.map(b => b.genre?.name).filter(Boolean))];
    const uniqueCefr = ['All', ...new Set(books.map(b => b.cefr_level).filter(Boolean))];
    const uniqueLanguages = ['All', ...new Set(books.map(b => b.language).filter(Boolean))];
    const bookHasAvailableCopy = (b) => b.copies?.some(c => c.status?.code === 'AVAILABLE');
    
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
        if (searchQuery && !b.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !b.author?.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedGenre !== 'All' && b.genre?.name !== selectedGenre) return false;
        if (callNoFilter && !b.call_no?.toLowerCase().includes(callNoFilter.toLowerCase())) return false;
        if (isbnFilter && !(b.isbn || "").toLowerCase().includes(isbnFilter.toLowerCase())) return false;
        if (cefrFilter !== 'All' && b.cefr_level !== cefrFilter) return false;
        if (languageFilter !== 'All' && b.language !== languageFilter) return false;
        if (availabilityFilter === 'available' && !bookHasAvailableCopy(b)) return false;
        if (availabilityFilter === 'unavailable' && bookHasAvailableCopy(b)) return false;
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(processedBooks.length / itemsPerPage));
    const currentBooks = processedBooks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const processedReservations = reservations.filter(r => {
        if (r.status?.code !== 'PENDING' && r.status?.code !== 'APPROVED') return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const bookTitle = (r.book_copy?.book?.title || "").toLowerCase();
            const studentName = (r.student?.name || "").toLowerCase();
            if (!bookTitle.includes(q) && !studentName.includes(q)) return false;
        }
        if (selectedGenre !== 'All' && r.book_copy?.book?.genre?.name !== selectedGenre) return false;
        if (callNoFilter && !r.book_copy?.book?.call_no?.toLowerCase().includes(callNoFilter.toLowerCase())) return false;
        if (cefrFilter !== 'All' && r.book_copy?.book?.cefr_level !== cefrFilter) return false;
        if (languageFilter !== 'All' && r.book_copy?.book?.language !== languageFilter) return false;
        return true;
    });

    const processedLoans = loans.filter(l => {
        if (l.status?.code !== 'ACTIVE') return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const bookTitle = (l.book_copy?.book?.title || "").toLowerCase();
            const studentName = (l.student?.name || "").toLowerCase();
            if (!bookTitle.includes(q) && !studentName.includes(q)) return false;
        }
        if (selectedGenre !== 'All' && l.book_copy?.book?.genre?.name !== selectedGenre) return false;
        if (callNoFilter && !l.book_copy?.book?.call_no?.toLowerCase().includes(callNoFilter.toLowerCase())) return false;
        if (cefrFilter !== 'All' && l.book_copy?.book?.cefr_level !== cefrFilter) return false;
        if (languageFilter !== 'All' && l.book_copy?.book?.language !== languageFilter) return false;
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

    const overdueCount = loans.filter(l => l.status?.code === 'ACTIVE' && new Date(l.due_date) < new Date()).length;

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
                                <button onClick={() => setActiveTab('settings')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'settings' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Ayarlar
                                    {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>

                                {/* Action Button in Header */}
                                {activeTab === 'inventory' && (
                                    <div className="absolute right-8 bottom-3 flex gap-2">
                                        <button onClick={() => setIsBulkOpen(true)} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1">
                                            <FileText size={14} /> Toplu Yükle
                                        </button>
                                        <button onClick={() => { setModalType('add_book'); setBookForm(EMPTY_BOOK_FORM); setIsModalOpen(true); }} className="bg-[#E85B5B] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-red-600 transition-colors flex items-center gap-1">
                                            <Plus size={14} /> Yeni Kitap Ekle
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-8">
                                {/* Universal Filter Block (not relevant to Ayarlar) */}
                                {activeTab !== 'settings' && (
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
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={cefrFilter} onChange={(e) => setCefrFilter(e.target.value)}>
                                                                {uniqueCefr.map(v => <option key={v} value={v}>{v === 'All' ? 'CEFR (Tümü)' : v}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                                        {activeTab === 'inventory' && (
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Demirbaş Durumu</label>
                                                                <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
                                                                    <option value="All">Tümü</option>
                                                                    <option value="available">Müsait kopyası var</option>
                                                                    <option value="unavailable">Müsait kopyası yok</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Dil</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#E85B5B]" value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
                                                                {uniqueLanguages.map(v => <option key={v} value={v}>{v === 'All' ? 'Dil (Tümü)' : v}</option>)}
                                                            </select>
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
                                )}

                                {/* === SUB-TAB VIEWS === */}

                                {/* 0. SETTINGS (Ayarlar) */}
                                {activeTab === 'settings' && (
                                    <SettingsPanel onDataChanged={() => { fetchCategories(); fetchBooks(); }} />
                                )}

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
                                                        const availableCopies = book.copies?.filter(c => c.status?.code === 'AVAILABLE').length || 0;
                                                        // Physical conditions are branch-defined free text with no system code, so
                                                        // "good vs worn" can't be derived. Show copies on loan instead.
                                                        const loanedCopies = book.copies?.filter(c => c.status?.code === 'LOANED').length || 0;
                                                        
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
                                                                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">Call No: {book.call_no || '-'} | ISBN: {book.isbn || '-'}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{book.author?.name || '-'}</td>
                                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{book.publisher?.name || '-'}</td>
                                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{book.genre?.name || '-'}</td>
                                                                    <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200 font-bold text-[11px]">{availableCopies} / {totalCopies} Müsait</td>
                                                                    <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200 font-bold text-[11px]">{loanedCopies} / {totalCopies} Ödünçte</td>
                                                                    
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
                                                                                <button onClick={() => { setModalType('issue_loan_modal'); setTargetBookId(book.id); setLoanForm(EMPTY_LOAN_FORM); setStudentPickerText(''); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#C2E0C6] border border-[#A3D3A8] text-[#1E5631] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#A3D3A8] transition-colors w-full">Kitabı Ver</button>
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
                                                                                            <th className="px-4 py-2 font-semibold">Demirbaş No</th>
                                                                                            <th className="px-4 py-2 font-semibold">Demirbaş Durumu (Müsaitlik)</th>
                                                                                            <th className="px-4 py-2 font-semibold">Durum (Fiziksel)</th>
                                                                                            <th className="px-4 py-2 font-semibold text-right">İşlemler</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                                                        {book.copies?.map(copy => (
                                                                                            <tr key={copy.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                                                <td className="px-4 py-3 font-mono text-gray-500">{copy.tracking_number || `#${copy.id}`}</td>
                                                                                                <td className="px-4 py-3">
                                                                                                    <span className={`px-2 py-1 rounded font-bold ${copy.status?.code === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{copy.status?.name || '-'}</span>
                                                                                                </td>
                                                                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{copy.condition?.name || '-'}</td>
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
                                                    const isPending = res.status?.code === 'PENDING';
                                                    
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
                                                                        <button onClick={() => returnCopy(loan.book_copy_id, loan.book_copy?.book_id, loan.book_copy?.tracking_number)} className="bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FBCFE8] transition-colors w-full">Kitabı İade Al</button>
                                                                        <button onClick={() => openEditLoan(loan)} className="bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E40AF] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#BFDBFE] transition-colors w-full">Düzenle</button>
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
                                                    const activeLoansCount = student.loans?.filter(l => l.status?.code === 'ACTIVE').length || 0;
                                                    
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
            <Modal isOpen={isModalOpen && (modalType === 'add_book' || modalType === 'edit_book')} onClose={() => setIsModalOpen(false)} title={modalType === 'add_book' ? "Yeni Kitap Ekle" : "Kitabı Düzenle"} maxWidth="max-w-2xl">
                <form onSubmit={handleBookSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                        <label className={labelCls}>Kitap Adı</label>
                        <input type="text" placeholder="Kitap Adı" className={inputCls} value={bookForm.title} onChange={e => setBookForm({ ...bookForm, title: e.target.value })} required />
                    </div>

                    {/* Categories are managed under the Ayarlar tab and referenced here by id. */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Yazar</label>
                            <select className={inputCls} value={bookForm.author_id} onChange={e => setBookForm({ ...bookForm, author_id: e.target.value })}>
                                <option value="">Seçiniz</option>
                                {categories.authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Yayınevi</label>
                            <select className={inputCls} value={bookForm.publisher_id} onChange={e => setBookForm({ ...bookForm, publisher_id: e.target.value })}>
                                <option value="">Seçiniz</option>
                                {categories.publishers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Konu</label>
                            <select className={inputCls} value={bookForm.topic_id} onChange={e => setBookForm({ ...bookForm, topic_id: e.target.value })}>
                                <option value="">Seçiniz</option>
                                {categories.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Tür</label>
                            <select className={inputCls} value={bookForm.genre_id} onChange={e => setBookForm({ ...bookForm, genre_id: e.target.value })}>
                                <option value="">Seçiniz</option>
                                {categories.genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Periyot</label>
                            <select className={inputCls} value={bookForm.frequency_id} onChange={e => setBookForm({ ...bookForm, frequency_id: e.target.value })}>
                                <option value="">Seçiniz</option>
                                {categories.frequencies.map(f => <option key={f.id} value={f.id}>{f.type}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Call No</label>
                            <input type="text" placeholder="Call No" className={inputCls} value={bookForm.call_no} onChange={e => setBookForm({ ...bookForm, call_no: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>ISBN</label>
                            <input type="text" placeholder="ISBN" className={inputCls} value={bookForm.isbn} onChange={e => setBookForm({ ...bookForm, isbn: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Yayın Yılı</label>
                            <input type="number" placeholder="Yıl" className={inputCls} value={bookForm.publication_year} onChange={e => setBookForm({ ...bookForm, publication_year: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Dil</label>
                            <input type="text" placeholder="Örn: Türkçe" className={inputCls} value={bookForm.language} onChange={e => setBookForm({ ...bookForm, language: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>CEFR Seviyesi</label>
                            <input type="text" placeholder="Örn: B1" className={inputCls} value={bookForm.cefr_level} onChange={e => setBookForm({ ...bookForm, cefr_level: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Baskı</label>
                            <input type="text" placeholder="Örn: 3. Baskı" className={inputCls} value={bookForm.edition} onChange={e => setBookForm({ ...bookForm, edition: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Sayfa Sayısı</label>
                            <input type="number" placeholder="Sayfa Sayısı" className={inputCls} value={bookForm.page_count} onChange={e => setBookForm({ ...bookForm, page_count: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Kapak Görseli (URL)</label>
                        <input type="text" placeholder="https://..." className={inputCls} value={bookForm.cover_url} onChange={e => setBookForm({ ...bookForm, cover_url: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelCls}>Fiziksel Açıklama</label>
                        <input type="text" placeholder="Örn: 21 cm, ciltli" className={inputCls} value={bookForm.physical_description} onChange={e => setBookForm({ ...bookForm, physical_description: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelCls}>Ek Notlar</label>
                        <textarea rows={2} placeholder="Ek Notlar" className={inputCls} value={bookForm.additional_notes} onChange={e => setBookForm({ ...bookForm, additional_notes: e.target.value })} />
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
                            <input type="checkbox" className="accent-[#E85B5B]" checked={bookForm.has_ebook} onChange={e => setBookForm({ ...bookForm, has_ebook: e.target.checked })} />
                            E-Kitap mevcut
                        </label>
                        {bookForm.has_ebook && (
                            <input type="text" placeholder="E-Kitap URL" className={`${inputCls} mt-2`} value={bookForm.ebook_url} onChange={e => setBookForm({ ...bookForm, ebook_url: e.target.value })} />
                        )}
                    </div>

                    <button className="w-full bg-[#E85B5B] hover:bg-red-600 text-white py-2 rounded font-bold transition-colors">Kaydet</button>
                </form>
            </Modal>

            {/* Direct Issue Loan Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'issue_loan_modal' || modalType === 'issue_res')} onClose={() => setIsModalOpen(false)} title={modalType === 'issue_res' ? "Rezervasyonu Onayla ve Kitabı Ver" : "Öğrenciye Kitap Ver"}>
                <form onSubmit={modalType === 'issue_res' ? handleIssueReservation : handleLoan} className="space-y-4">
                    {modalType === 'issue_loan_modal' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Öğrenci</label>
                                <input
                                    type="text"
                                    list="student-picker-list"
                                    placeholder="İsim veya numara ile ara..."
                                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white"
                                    value={studentPickerText}
                                    onChange={e => {
                                        const text = e.target.value;
                                        setStudentPickerText(text);
                                        // datalist option values are the user_id; map the picked value back to the student
                                        const picked = students.find(s => String(s.user_id) === text.trim());
                                        setLoanForm({ ...loanForm, student_id: picked ? picked.user_id : '' });
                                    }}
                                    required
                                />
                                <datalist id="student-picker-list">
                                    {students.map(s => (
                                        <option key={s.user_id} value={s.user_id}>
                                            {s.name} — No: {s.user_id} ({s.grade}-{s.class_group})
                                        </option>
                                    ))}
                                </datalist>
                                {loanForm.student_id
                                    ? <span className="text-xs text-green-600 mt-1 block">Seçilen: {students.find(s => s.user_id === loanForm.student_id)?.name}</span>
                                    : <span className="text-xs text-gray-400 mt-1 block">*Listeden bir öğrenci seçin.</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Verilecek Demirbaş No</label>
                                <input type="text" placeholder="Örn: 2024-0142" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.tracking_number} onChange={e => setLoanForm({ ...loanForm, tracking_number: e.target.value })} required />
                                <span className="text-xs text-gray-400 mt-1 block">*Kitabın üzerindeki demirbaş / barkod numarasını girin.</span>
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

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                isOpen={isBulkOpen}
                onClose={() => setIsBulkOpen(false)}
                categories={categories}
                onComplete={() => { fetchBooks(); fetchCategories(); }}
            />

            {/* Edit Loan Modal */}
            <Modal isOpen={isModalOpen && modalType === 'edit_loan'} onClose={() => setIsModalOpen(false)} title="Ödünç Kaydını Düzenle">
                <form onSubmit={handleLoanEdit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Son Teslim Tarihi</label>
                        <input type="date" className={inputCls} value={loanEditForm.due_date} onChange={e => setLoanEditForm({ ...loanEditForm, due_date: e.target.value })} required />
                    </div>
                    <div>
                        <label className={labelCls}>Açıklama / Not</label>
                        <textarea rows={3} placeholder="Örn: Süre uzatıldı" className={inputCls} value={loanEditForm.description} onChange={e => setLoanEditForm({ ...loanEditForm, description: e.target.value })} />
                    </div>
                    <button className="w-full bg-[#1E40AF] hover:bg-blue-800 text-white py-2 rounded font-bold transition-colors">Kaydet</button>
                </form>
            </Modal>

            {/* Return Book Modal */}
            <Modal isOpen={isModalOpen && modalType === 'return_book_modal'} onClose={() => setIsModalOpen(false)} title="Kitabı İade Al">
                <form onSubmit={handleQuickReturn} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Demirbaş No</label>
                        <input type="text" placeholder="Örn: 2024-0142" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.tracking_number} onChange={e => setLoanForm({ ...loanForm, tracking_number: e.target.value })} required />
                        <span className="text-xs text-gray-400 mt-1 block">*Öğrencinin getirdiği kitabın üzerindeki demirbaş numarasını girin.</span>
                    </div>
                    <button className="w-full bg-[#9D174D] hover:bg-pink-800 text-white py-2 rounded font-bold transition-colors">İade İşlemini Tamamla</button>
                </form>
            </Modal>

            {/* Add / Edit Copy Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'add_copy' || modalType === 'edit_copy')} onClose={() => setIsModalOpen(false)} title={modalType === 'add_copy' ? "Kopya Ekle" : "Kopya Düzenle"}>
                <form onSubmit={handleCopySubmit} className="space-y-4">
                    {/* Each copy is one physical item identified by its barcode, so copies are
                        added one at a time rather than by quantity. */}
                    <div>
                        <label className={labelCls}>Demirbaş / Barkod No</label>
                        <input type="text" placeholder="Örn: 2024-0142" className={inputCls} value={copyForm.tracking_number} onChange={e => setCopyForm({ ...copyForm, tracking_number: e.target.value })} required />
                    </div>
                    <div>
                        <label className={labelCls}>Fiziksel Durum</label>
                        <select className={inputCls} value={copyForm.condition_id} onChange={e => setCopyForm({ ...copyForm, condition_id: e.target.value })}>
                            <option value="">Seçiniz</option>
                            {categories.conditions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Demirbaş Durumu</label>
                        <select className={inputCls} value={copyForm.status_id} onChange={e => setCopyForm({ ...copyForm, status_id: e.target.value })}>
                            <option value="">Seçiniz</option>
                            {categories.copyStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    {categories.conditions.length === 0 && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Fiziksel durum listesi boş. Ayarlar sekmesinden ekleyebilirsiniz.
                        </p>
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
                                                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${loan.status?.code === 'ACTIVE' ? 'bg-[#FEF3C7] text-[#B45309]' : 'bg-[#E6F4EA] text-[#059669]'}`}>
                                                        {loan.status?.code === 'ACTIVE' ? 'Kullanılıyor' : 'İade Edildi'}
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