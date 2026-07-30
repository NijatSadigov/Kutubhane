import { useEffect, useState, useContext, Fragment } from 'react';
import api, { assetUrl, uploadFile } from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Bell, Plus, Search, CheckCircle, XCircle, ArrowRight, ChevronDown, ChevronUp, ChevronRight, Edit2, Trash2, Settings, School, Clock, Calendar, Undo2, AlertTriangle, Filter, Layers, Home, Mail, Moon, Sun, MoreHorizontal, ChevronLeft, FileText, Users, Info, User as UserIcon } from 'lucide-react';
import Modal from '../../components/Modal';
import SettingsPanel from './SettingsPanel';
import BulkUploadModal from './BulkUploadModal';
import RegistrationTokensModal from './RegistrationTokensModal';
import HomeView from '../../components/HomeView';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ProfileModal, { displayName } from '../ProfileModal';
import ReaderStatsModal from '../../components/ReaderStatsModal';
import BookRequestsQueue from '../../components/BookRequestsQueue';
import { useTranslation } from '../../i18n/LanguageContext';

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
const EMPTY_LOAN_FORM = { student_id: '', book_id: '', tracking_number: '', due_date: '' };

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white";
const labelCls = "block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1";

const LibrarianDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

    // UI State
    const [activeTab, setActiveTab] = useState('home');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [readerStudent, setReaderStudent] = useState(null); // {id, name} for reading-overview modal
    const [coverUploading, setCoverUploading] = useState(false);
    const [ebookUploading, setEbookUploading] = useState(false);
    const [ebookName, setEbookName] = useState('');
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
    const [loanHolds, setLoanHolds] = useState(null); // selected student's current holds vs limit
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
    const [isTokensOpen, setIsTokensOpen] = useState(false);
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

    // Open a clean direct-loan modal (prominent "Give Book" action).
    const openIssueLoan = () => {
        setLoanForm(EMPTY_LOAN_FORM);
        setLoanHolds(null);
        setStudentPickerText('');
        setModalType('issue_loan_modal');
        setIsModalOpen(true);
        setOpenDropdownId(null);
    };

    // When a student is chosen, load their current holds so the librarian can see
    // how many books they already have vs their limit.
    const selectLoanStudent = async (id) => {
        setLoanForm(f => ({ ...f, student_id: id }));
        if (!id) { setLoanHolds(null); return; }
        try {
            const res = await api.get(`/student/${id}/holds`);
            setLoanHolds(res.data);
        } catch { setLoanHolds(null); }
    };

    const handleLoan = async (e) => {
        e.preventDefault();
        if (!loanForm.student_id || !loanForm.book_id || !loanForm.tracking_number) {
            alert(t('msg.fillAll') || t('msg.error'));
            return;
        }
        try {
            // book_id is explicit (copy numbers can repeat across books, so we can't
            // resolve by tracking number alone).
            await api.post('/loan', {
                student_id: parseInt(loanForm.student_id),
                book_id: parseInt(loanForm.book_id),
                tracking_number: loanForm.tracking_number,
                due_date: loanForm.due_date,
            });
            alert(t('msg.loanSuccess'));
            setLoanForm(EMPTY_LOAN_FORM);
            setLoanHolds(null);
            setStudentPickerText('');
            setIsModalOpen(false);
            fetchLoans();
            fetchBooks();
            fetchStudents();
        } catch (err) { alert(t('msg.opFailed') + ": " + (err.response?.data?.error || t('msg.error'))); }
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
            alert(t('msg.loanUpdated'));
            setIsModalOpen(false);
            fetchLoans();
        } catch (err) { alert(t('msg.updateFailed') + ": " + (err.response?.data?.error || t('msg.error'))); }
    };

    // The backend finds the copy from the body; the :id segment is kept only for routing.
    const returnCopy = async (copyId, bookId, trackingNumber) => {
        try {
            await api.post(`/return/${copyId}`, { book_id: bookId, tracking_number: trackingNumber });
            alert(t('msg.returnSuccess'));
            setIsModalOpen(false);
            setLoanForm(EMPTY_LOAN_FORM);
            fetchLoans();
            fetchBooks();
            fetchStudents();
        } catch (err) { alert(t('msg.returnFailed') + ": " + (err.response?.data?.error || t('msg.copyNotFound'))); }
    };

    const handleQuickReturn = async (e) => {
        e.preventDefault();
        const match = findCopyByTracking(loanForm.tracking_number);
        if (!match) { alert(t('msg.copyNotFound')); return; }
        await returnCopy(match.copy.id, match.book.id, match.copy.tracking_number);
    };

    const handleReservationAction = async (id, actionWord) => {
        try { 
            await api.post(`/reservation/${id}`, { action: actionWord }); 
            fetchReservations(); 
            setOpenDropdownId(null);
        } catch (err) { alert(t('msg.opFailed')); }
    };

    const handleIssueReservation = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/reservation/${selectedResId}/issue`, { due_date: loanForm.due_date });
            alert(t('msg.resApprovedIssued'));
            setIsModalOpen(false); 
            fetchReservations(); 
            fetchLoans();
        } catch (err) { alert(t('msg.opFailed')); }
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
                has_ebook: !!bookForm.ebook_url, // derived: a book has an e-book if a PDF is attached
            };
            if (modalType === 'add_book') await api.post('/books', payload);
            else await api.put(`/books/${selectedBookId}`, payload);
            setIsModalOpen(false); fetchBooks();
        } catch (err) { alert(t('msg.opFailed')); }
    };

    // Upload a cover image and store its URL on the book form.
    const handleCoverUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCoverUploading(true);
        try {
            const { url } = await uploadFile('cover', file);
            setBookForm(f => ({ ...f, cover_url: url }));
        } catch (err) { alert(t('upload.failed') + ': ' + (err.response?.data?.error || 'Error')); }
        finally { setCoverUploading(false); e.target.value = ''; }
    };

    // Upload an e-book PDF and store its URL on the book form.
    const handleEbookUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setEbookUploading(true);
        try {
            const { url, filename } = await uploadFile('ebook', file);
            setBookForm(f => ({ ...f, ebook_url: url, has_ebook: true }));
            setEbookName(filename || '');
        } catch (err) { alert(t('upload.failed') + ': ' + (err.response?.data?.error || 'Error')); }
        finally { setEbookUploading(false); e.target.value = ''; }
    };

    const handleDeleteBook = async (id) => {
        if (!window.confirm(t('msg.deleteBookConfirm'))) return;
        try { await api.delete(`/books/${id}`); fetchBooks(); setOpenDropdownId(null); } catch (err) { alert(t('msg.deleteFailed')); }
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
        setEbookName('');
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
        } catch (err) { alert(t('msg.opFailed') + ": " + (err.response?.data?.error || t('msg.error'))); }
    };
    const handleDeleteCopy = async (id) => { if (!window.confirm(t('msg.deleteCopyConfirm'))) return; try { await api.delete(`/copy/${id}`); fetchBooks(); } catch (err) { alert(t('msg.deleteFailed')); } };

    const openStudentDetails = async (student) => {
        setSelectedStudent(student);
        setStudentHistoryTimeFrame('all'); 
        try {
            const res = await api.get(`/my-library/${student.user_id}`);
            setStudentLoans(res.data || []);
            setModalType('student_details');
            setIsModalOpen(true);
        } catch (err) {
            alert(t('msg.historyFailed'));
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

    // Overview data for the Anasayfa (home) view.
    const totalCopies = books.reduce((sum, b) => sum + (b.copies?.length || 0), 0);
    const availableCopiesCount = books.reduce((sum, b) => sum + (b.copies?.filter(c => c.status?.code === 'AVAILABLE').length || 0), 0);
    const pendingReservationsCount = reservations.filter(r => r.status?.code === 'PENDING').length;
    const homeStats = [
        { key: 'books', label: t('home.totalBooks'), value: books.length },
        { key: 'copies', label: t('home.totalCopies'), value: totalCopies },
        { key: 'available', label: t('home.availableCopies'), value: availableCopiesCount, accent: 'text-green-600 dark:text-green-400' },
        { key: 'loans', label: t('home.activeLoans'), value: loans.length },
        { key: 'reservations', label: t('home.pendingReservations'), value: pendingReservationsCount },
        { key: 'overdue', label: t('home.overdue'), value: overdueCount, accent: 'text-red-600 dark:text-red-400' },
        { key: 'members', label: t('home.members'), value: students.length },
    ];
    const homeActions = [
        { label: t('home.goToCatalog'), onClick: () => setActiveTab('inventory') },
        { label: t('home.goToManagement'), onClick: () => setActiveTab('settings') },
    ];

    if (loading) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>;

    return (
        <div className={isDark ? 'dark' : ''}>
            <div className="flex h-screen bg-[#F8F9FA] dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
                
                {/* LEFT SIDEBAR */}
                <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-sm transition-colors duration-200">
                    <div className="h-20 flex items-center px-8 border-b border-gray-100 dark:border-gray-800">
                        <img src="/logo.png" alt="Hədəf" className="h-8" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span className="text-2xl font-bold text-[#1B9DD9] hidden">Hədəf</span>
                    </div>
                    
                    <nav className="flex-1 px-4 py-6 flex flex-col gap-1">
                        {(() => {
                            const navItems = [
                                { id: 'home', icon: Home, label: t('nav.home') },
                                { id: 'inventory', icon: BookOpen, label: t('nav.books') },
                                { id: 'reservations', icon: Bell, label: t('nav.reservations') },
                                { id: 'requests', icon: Mail, label: t('req.queue') },
                                { id: 'loans', icon: FileText, label: t('nav.loans') },
                                { id: 'members', icon: Users, label: t('nav.members') },
                                { id: 'settings', icon: Settings, label: t('nav.management') },
                            ];
                            return navItems.map(item => {
                                const Icon = item.icon;
                                const active = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${active
                                            ? 'bg-[#1B9DD9] text-white shadow-md shadow-red-200 dark:shadow-none'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                    >
                                        <Icon size={18} /> {item.label}
                                    </button>
                                );
                            });
                        })()}

                        <div className="mt-auto flex flex-col gap-1">
                            <button onClick={() => setIsProfileOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <UserIcon size={18} /> {t('nav.profile')}
                            </button>
                            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <LogOut size={18} /> {t('auth.logout')}
                            </button>
                        </div>
                    </nav>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col h-screen overflow-hidden">
                    
                    {/* Top Header */}
                    <header className="h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 z-10 transition-colors duration-200">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium text-sm">
                            {{ home: t('nav.home'), inventory: t('tab.books'), reservations: t('tab.reservations'), requests: t('req.queue'), loans: t('tab.loans'), members: t('tab.members'), settings: t('nav.management') }[activeTab]}
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
                                <LanguageSwitcher />
                                <button onClick={() => setIsDark(!isDark)} className="hover:text-sky-500 outline-none">
                                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                                </button>
                            </div>
                            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800 outline-none group" title={t('nav.profile')}>
                                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold uppercase">
                                    {displayName(user)?.charAt(0) || 'P'}
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight group-hover:text-[#1B9DD9] transition-colors">{displayName(user) || t('role.librarian')}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{user?.email}</p>
                                </div>
                            </button>
                        </div>
                    </header>

                    {/* Scrollable Content */}
                    <main className="flex-1 overflow-y-auto p-8">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-full transition-colors duration-200">
                            
                            {/* Home / overview */}
                            {activeTab === 'home' && (
                                <HomeView welcomeName={displayName(user)} stats={homeStats} actions={homeActions} />
                            )}

                            {/* Tabs */}
                            {activeTab !== 'home' && (
                            <div className="px-8 pt-6 border-b border-gray-100 dark:border-gray-800 flex gap-8 relative">
                                <button onClick={() => setActiveTab('inventory')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'inventory' ? 'text-[#1B9DD9]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.books')}
                                    {activeTab === 'inventory' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B9DD9] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('reservations')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'reservations' ? 'text-[#1B9DD9]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.reservations')}
                                    {activeTab === 'reservations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B9DD9] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('loans')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'loans' ? 'text-[#1B9DD9]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.loans')}
                                    {activeTab === 'loans' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B9DD9] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('members')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'members' ? 'text-[#1B9DD9]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.members')}
                                    {activeTab === 'members' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B9DD9] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('settings')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'settings' ? 'text-[#1B9DD9]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.settings')}
                                    {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B9DD9] rounded-t-full"></div>}
                                </button>

                                {/* Action Button in Header */}
                                {activeTab === 'inventory' && (
                                    <div className="absolute right-8 bottom-3 flex gap-2">
                                        <button onClick={() => setIsBulkOpen(true)} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1">
                                            <FileText size={14} /> {t('bulk.button')}
                                        </button>
                                        <button onClick={() => { setModalType('add_book'); setBookForm(EMPTY_BOOK_FORM); setEbookName(''); setIsModalOpen(true); }} className="bg-[#1B9DD9] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-[#1580B5] transition-colors flex items-center gap-1">
                                            <Plus size={14} /> {t('book.addNew')}
                                        </button>
                                    </div>
                                )}
                                {activeTab === 'members' && (
                                    <div className="absolute right-8 bottom-3">
                                        <button onClick={() => setIsTokensOpen(true)} className="bg-[#1B9DD9] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-[#1580B5] transition-colors flex items-center gap-1">
                                            <Mail size={14} /> {t('regtoken.button')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}

                            <div className={activeTab === 'home' ? 'hidden' : 'p-8'}>
                                {/* Universal Filter Block (not relevant to Ayarlar) */}
                                {activeTab !== 'settings' && activeTab !== 'home' && (
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none hover:text-[#1B9DD9] transition-colors">
                                            {isFilterOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} {t('f.title')}
                                        </button>
                                    </div>
                                    
                                    {isFilterOpen && (
                                        <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                            
                                            {/* FILTER: KİTAPLAR, REZERVASYONLAR, VERİLEN KİTAPLAR */}
                                            {activeTab !== 'members' ? (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                                                        <div className="lg:col-span-2">
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('f.search')}</label>
                                                            <input type="text" placeholder={activeTab === 'inventory' ? t('f.searchBook') : t('f.searchPerson')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('fld.topicSel')}</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                                                                {uniqueGenres.map(g => <option key={g} value={g}>{g === 'All' ? t('f.byTopic') : g}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">ISBN</label>
                                                            <input type="text" placeholder={t('f.isbn')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={isbnFilter} onChange={(e) => setIsbnFilter(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Call No</label>
                                                            <input type="text" placeholder={t('f.callNo')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={callNoFilter} onChange={(e) => setCallNoFilter(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">CEFR</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={cefrFilter} onChange={(e) => setCefrFilter(e.target.value)}>
                                                                {uniqueCefr.map(v => <option key={v} value={v}>{v === 'All' ? t('f.cefrAll') : v}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                                        {activeTab === 'inventory' && (
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('th.copyStatus')}</label>
                                                                <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
                                                                    <option value="All">{t('common.all')}</option>
                                                                    <option value="available">{t('f.hasAvailable')}</option>
                                                                    <option value="unavailable">{t('f.noAvailable')}</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('fld.language')}</label>
                                                            <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
                                                                {uniqueLanguages.map(v => <option key={v} value={v}>{v === 'All' ? t('f.langAll') : v}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                /* 👇 UPDATED: FILTER: ÜYELER */
                                                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                    <div className="lg:col-span-2">
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('f.personSearch')}</label>
                                                        <input type="text" placeholder={t('f.fullName')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('f.studentNo')}</label>
                                                        <input type="text" placeholder={t('f.studentNoPh')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={studentIdFilter} onChange={(e) => setStudentIdFilter(e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('th.unit')}</label>
                                                        <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]">
                                                            <option>{t('common.all')}</option>
                                                            <option>{user?.librarian?.branch?.name || t('f.centralBranch')}</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        {/* 👇 UPDATED: Combined Sınıf dropdown */}
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('th.class')}</label>
                                                        <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 outline-none rounded-lg focus:border-[#1B9DD9]" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                                                            <option value="All">{t('common.all')}</option>
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
                                                        <th className="px-2 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.library')}</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.title')}</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.author')}</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.publisher')}</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.topic')}</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">{t('th.copyStatus')}</th>
                                                        <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">{t('th.status')}</th>
                                                        <th className="px-6 py-4 text-center font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('common.actions')}</th>
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
                                                                    <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200 font-bold text-[11px]">{availableCopies} / {totalCopies} {t('st.available')}</td>
                                                                    <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200 font-bold text-[11px]">{loanedCopies} / {totalCopies} {t('st.onLoan')}</td>
                                                                    
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
                                                                                <button onClick={() => { setModalType('issue_loan_modal'); setTargetBookId(book.id); setLoanForm(EMPTY_LOAN_FORM); setStudentPickerText(''); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#C2E0C6] border border-[#A3D3A8] text-[#1E5631] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#A3D3A8] transition-colors w-full">{t('b.giveBook')}</button>
                                                                                <button onClick={() => { setModalType('return_book_modal'); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FBCFE8] transition-colors w-full">{t('b.takeBack')}</button>
                                                                                <button onClick={() => openAddCopy(book.id)} className="bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FDE68A] transition-colors w-full">{t('md.addCopy')}</button>
                                                                                <button onClick={() => handleDeleteBook(book.id)} className="bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-red-200 transition-colors w-full mt-2">{t('common.delete')}</button>
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
                                                                                            <th className="px-4 py-2 font-semibold">{t('th.trackingNo')}</th>
                                                                                            <th className="px-4 py-2 font-semibold">{t('th.copyAvail')}</th>
                                                                                            <th className="px-4 py-2 font-semibold">{t('th.physical')}</th>
                                                                                            <th className="px-4 py-2 font-semibold text-right">{t('common.actions')}</th>
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
                                                                                                    <button onClick={() => openEditCopy(copy)} className="text-blue-500 hover:text-blue-700 mr-3 font-medium">{t('common.edit')}</button>
                                                                                                    <button onClick={() => handleDeleteCopy(copy.id)} className="text-red-500 hover:text-red-700 font-medium">{t('common.delete')}</button>
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
                                                    {currentBooks.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-gray-400">{t('msg.noRecords')}</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl gap-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <span>{t('msg.perPage')}</span>
                                                <select 
                                                    value={itemsPerPage} 
                                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded px-2 py-1 outline-none focus:border-[#1B9DD9] cursor-pointer"
                                                >
                                                    <option value={20}>20</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                    <option value={200}>200</option>
                                                </select>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="text-gray-500 dark:text-gray-400 hidden sm:block">
                                                    {t('msg.pageSummary', { total: processedBooks.length, from: processedBooks.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1, to: Math.min(currentPage * itemsPerPage, processedBooks.length) })}
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

                                {/* BOOK REQUESTS (student wishlist for missing books) */}
                                {activeTab === 'requests' && (
                                    <BookRequestsQueue listUrl="/book-requests" updateBase="/book-requests" />
                                )}

                                {/* 2. RESERVATIONS (Rezerve Edilen Kitaplar) */}
                                {activeTab === 'reservations' && (
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.title')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.copyId')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.student')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Talep Tarihi</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">{t('th.status')}</th>
                                                    <th className="px-6 py-4 text-center font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.action')}</th>
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
                                                                    {isPending ? t('st.pendingApproval') : t('st.approvedWaiting')}
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
                                                                                <button onClick={() => { setSelectedResId(res.id); setModalType('issue_res'); setIsModalOpen(true); setOpenDropdownId(null); }} className="bg-[#E0F2FE] border border-[#7DD3FC] text-[#075985] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#BAE6FD] transition-colors w-full">{t('b.giveBook')}</button>
                                                                                <button onClick={() => handleReservationAction(res.id, 'Rejected')} className="bg-[#FFEDD5] border border-[#FDBA74] text-[#C2410C] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FDBA74] transition-colors w-full">{t('b.reject')}</button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {processedReservations.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">{t('msg.noReservations')}</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* 3. LOANS (Verilen Kitaplar) */}
                                {activeTab === 'loans' && (
                                  <div>
                                    <div className="flex justify-end mb-4">
                                        <button onClick={openIssueLoan} className="bg-[#1B9DD9] hover:bg-[#1580B5] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"><Plus size={16}/> {t('loan.giveBook')}</button>
                                    </div>
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        {overdueCount > 0 && (
                                            <div className="bg-red-50 dark:bg-red-900/20 px-6 py-3 border-b border-red-100 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-400 animate-pulse">
                                                <AlertTriangle size={18} />
                                                <span className="font-bold text-sm">{t('msg.overdueWarn', { n: overdueCount })}</span>
                                            </div>
                                        )}
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.copyId')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.title')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.studentId')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.issueDate')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.dueDate')}</th>
                                                    <th className="px-6 py-4 text-center font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('common.actions')}</th>
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
                                                                {isOverdue && <span className="ml-2 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px]">{t('st.overdue')}</span>}
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
                                                                        <button onClick={() => returnCopy(loan.book_copy_id, loan.book_copy?.book_id, loan.book_copy?.tracking_number)} className="bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#FBCFE8] transition-colors w-full">{t('b.returnBook')}</button>
                                                                        <button onClick={() => openEditLoan(loan)} className="bg-[#DBEAFE] border border-[#7DD3FC] text-[#1E40AF] text-[11px] font-bold px-3 py-1.5 rounded text-center hover:bg-[#7DD3FC] transition-colors w-full">{t('common.edit')}</button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {processedLoans.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">{t('msg.noLoans')}</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                  </div>
                                )}

                                {/* 👇 UPDATED: 4. MEMBERS (Üyeler) */}
                                {activeTab === 'members' && (
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm min-h-[400px]">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.person')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">Birim</th>
                                                    {/* Changed Header */}
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.class')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider">{t('th.personType')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-center">{t('th.booksUsed')}</th>
                                                    <th className="px-6 py-4 font-bold text-xs text-gray-800 dark:text-gray-200 tracking-wider text-right">{t('common.actions')}</th>
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
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{user?.librarian?.branch?.name || t('f.centralBranch')}</td>
                                                            {/* Changed cell: combines grade and class_group */}
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{student.grade} {student.class_group}</td>
                                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{t('st.student')}</td>
                                                            <td className="px-6 py-4 text-center font-bold text-gray-800 dark:text-gray-200 text-sm">{activeLoansCount}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center gap-3 justify-end">
                                                                    <button
                                                                        onClick={() => setReaderStudent({ id: student.user_id, name: student.name })}
                                                                        className="text-sky-500 hover:text-sky-600 text-[11px] font-bold flex items-center gap-1 outline-none transition-colors"
                                                                    >
                                                                        <BookOpen size={14}/> {t('reader.view')}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => openStudentDetails(student)}
                                                                        className="text-yellow-500 hover:text-yellow-600 text-[11px] font-bold flex items-center gap-1 outline-none transition-colors"
                                                                    >
                                                                        <Info size={14}/> Detay
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {processedStudents.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">{t('msg.noStudents')}</td></tr>}
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
            <Modal isOpen={isModalOpen && (modalType === 'add_book' || modalType === 'edit_book')} onClose={() => setIsModalOpen(false)} title={modalType === 'add_book' ? t('md.addBook') : t('md.editBook')} maxWidth="max-w-2xl">
                <form onSubmit={handleBookSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                        <label className={labelCls}>{t('th.title')}</label>
                        <input type="text" placeholder={t('th.title')} className={inputCls} value={bookForm.title} onChange={e => setBookForm({ ...bookForm, title: e.target.value })} required />
                    </div>

                    {/* Categories are managed under the Ayarlar tab and referenced here by id. */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t('th.author')}</label>
                            <select className={inputCls} value={bookForm.author_id} onChange={e => setBookForm({ ...bookForm, author_id: e.target.value })}>
                                <option value="">{t('common.select')}</option>
                                {categories.authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>{t('th.publisher')}</label>
                            <select className={inputCls} value={bookForm.publisher_id} onChange={e => setBookForm({ ...bookForm, publisher_id: e.target.value })}>
                                <option value="">{t('common.select')}</option>
                                {categories.publishers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.topicSel')}</label>
                            <select className={inputCls} value={bookForm.topic_id} onChange={e => setBookForm({ ...bookForm, topic_id: e.target.value })}>
                                <option value="">{t('common.select')}</option>
                                {categories.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.genre')}</label>
                            <select className={inputCls} value={bookForm.genre_id} onChange={e => setBookForm({ ...bookForm, genre_id: e.target.value })}>
                                <option value="">{t('common.select')}</option>
                                {categories.genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.frequency')}</label>
                            <select className={inputCls} value={bookForm.frequency_id} onChange={e => setBookForm({ ...bookForm, frequency_id: e.target.value })}>
                                <option value="">{t('common.select')}</option>
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
                            <label className={labelCls}>{t('fld.pubYear')}</label>
                            <input type="number" placeholder={t('ph.year')} className={inputCls} value={bookForm.publication_year} onChange={e => setBookForm({ ...bookForm, publication_year: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.language')}</label>
                            <input type="text" placeholder={t('ph.langExample')} className={inputCls} value={bookForm.language} onChange={e => setBookForm({ ...bookForm, language: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.cefr')}</label>
                            <input type="text" placeholder={t('ph.cefrExample')} className={inputCls} value={bookForm.cefr_level} onChange={e => setBookForm({ ...bookForm, cefr_level: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.edition')}</label>
                            <input type="text" placeholder={t('ph.editionExample')} className={inputCls} value={bookForm.edition} onChange={e => setBookForm({ ...bookForm, edition: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('fld.pageCount')}</label>
                            <input type="number" placeholder={t('fld.pageCount')} className={inputCls} value={bookForm.page_count} onChange={e => setBookForm({ ...bookForm, page_count: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>{t('cover.label')}</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                                {bookForm.cover_url
                                    ? <img src={assetUrl(bookForm.cover_url)} alt="" className="w-full h-full object-cover" />
                                    : <BookOpen size={24} className="text-gray-300 dark:text-gray-600" />}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="cursor-pointer bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 w-fit">
                                    <Plus size={14} /> {coverUploading ? t('common.loading') : (bookForm.cover_url ? t('cover.change') : t('cover.upload'))}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
                                </label>
                                {bookForm.cover_url && (
                                    <button type="button" onClick={() => setBookForm({ ...bookForm, cover_url: '' })} className="text-xs text-red-500 hover:text-red-700 w-fit">{t('cover.remove')}</button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>{t('fld.physical')}</label>
                        <input type="text" placeholder={t('ph.physicalExample')} className={inputCls} value={bookForm.physical_description} onChange={e => setBookForm({ ...bookForm, physical_description: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelCls}>{t('fld.notes')}</label>
                        <textarea rows={2} placeholder={t('fld.notes')} className={inputCls} value={bookForm.additional_notes} onChange={e => setBookForm({ ...bookForm, additional_notes: e.target.value })} />
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                        <label className={labelCls}>{t('ebook.label')}</label>
                        {bookForm.ebook_url ? (
                            <div className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                <a href={assetUrl(bookForm.ebook_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#1B9DD9] font-medium truncate">
                                    <FileText size={16} /> {ebookName || t('ebook.attached')}
                                </a>
                                <button type="button" onClick={() => { setBookForm({ ...bookForm, ebook_url: '', has_ebook: false }); setEbookName(''); }} className="text-xs text-red-500 hover:text-red-700 shrink-0">{t('cover.remove')}</button>
                            </div>
                        ) : (
                            <label className="cursor-pointer bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 w-fit">
                                <FileText size={14} /> {ebookUploading ? t('common.loading') : t('ebook.upload')}
                                <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleEbookUpload} disabled={ebookUploading} />
                            </label>
                        )}
                    </div>

                    <button className="w-full bg-[#1B9DD9] hover:bg-[#1580B5] text-white py-2 rounded font-bold transition-colors">{t('common.save')}</button>
                </form>
            </Modal>

            {/* Direct Issue Loan Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'issue_loan_modal' || modalType === 'issue_res')} onClose={() => setIsModalOpen(false)} title={modalType === 'issue_res' ? t('md.issueRes') : t('md.issueLoan')}>
                <form onSubmit={modalType === 'issue_res' ? handleIssueReservation : handleLoan} className="space-y-4">
                    {modalType === 'issue_loan_modal' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('th.student')}</label>
                                <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white"
                                    value={loanForm.student_id}
                                    onChange={e => selectLoanStudent(e.target.value ? parseInt(e.target.value) : '')} required>
                                    <option value="">{t('loan.selectStudent')}…</option>
                                    {students.map(s => (
                                        <option key={s.user_id} value={s.user_id}>{s.name} ({s.grade}-{s.class_group})</option>
                                    ))}
                                </select>
                                {loanHolds && (
                                    <span className={`text-xs mt-1 block ${loanHolds.count >= loanHolds.limit ? 'text-red-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {t('loan.holds')}: {loanHolds.count} / {loanHolds.limit}{loanHolds.count >= loanHolds.limit ? ` — ${t('loan.limitReached')}` : ''}
                                    </span>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('th.title')}</label>
                                <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white"
                                    value={loanForm.book_id}
                                    onChange={e => setLoanForm({ ...loanForm, book_id: e.target.value, tracking_number: '' })} required>
                                    <option value="">{t('loan.selectBook')}…</option>
                                    {books.map(b => (
                                        <option key={b.id} value={b.id}>{b.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('loan.selectCopy')}</label>
                                {(() => {
                                    const selBook = books.find(b => String(b.id) === String(loanForm.book_id));
                                    const avail = (selBook?.copies || []).filter(c => c.status?.code === 'AVAILABLE');
                                    if (!loanForm.book_id) return <div className="text-xs text-gray-400 p-2 border border-dashed border-gray-200 dark:border-gray-700 rounded">{t('loan.selectBook')}…</div>;
                                    if (avail.length === 0) return <div className="text-xs text-red-500 p-2 border border-dashed border-red-200 dark:border-red-900 rounded">{t('loan.noCopies')}</div>;
                                    return (
                                        <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white"
                                            value={loanForm.tracking_number}
                                            onChange={e => setLoanForm({ ...loanForm, tracking_number: e.target.value })} required>
                                            <option value="">{t('loan.selectCopy')}…</option>
                                            {avail.map(c => <option key={c.id} value={c.tracking_number}>{c.tracking_number}</option>)}
                                        </select>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                    {modalType === 'issue_res' && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('misc.studentPickup')}</p>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('fld.dueDate')}</label>
                        <input type="date" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.due_date} onChange={e => setLoanForm({...loanForm, due_date: e.target.value})} required/>
                    </div>
                    <button className="w-full bg-[#1E5631] hover:bg-green-800 text-white py-2 rounded font-bold transition-colors">{t('b.approveGive')}</button>
                </form>
            </Modal>

            {/* Profile Modal */}
            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
            <ReaderStatsModal isOpen={!!readerStudent} studentId={readerStudent?.id} studentName={readerStudent?.name} onClose={() => setReaderStudent(null)} />

            {/* Registration Tokens Modal */}
            <RegistrationTokensModal isOpen={isTokensOpen} onClose={() => setIsTokensOpen(false)} />

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                isOpen={isBulkOpen}
                onClose={() => setIsBulkOpen(false)}
                categories={categories}
                onComplete={() => { fetchBooks(); fetchCategories(); }}
            />

            {/* Edit Loan Modal */}
            <Modal isOpen={isModalOpen && modalType === 'edit_loan'} onClose={() => setIsModalOpen(false)} title={t('md.editLoan')}>
                <form onSubmit={handleLoanEdit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Son Teslim Tarihi</label>
                        <input type="date" className={inputCls} value={loanEditForm.due_date} onChange={e => setLoanEditForm({ ...loanEditForm, due_date: e.target.value })} required />
                    </div>
                    <div>
                        <label className={labelCls}>{t('fld.descNote')}</label>
                        <textarea rows={3} placeholder={t('ph.extendedNote')} className={inputCls} value={loanEditForm.description} onChange={e => setLoanEditForm({ ...loanEditForm, description: e.target.value })} />
                    </div>
                    <button className="w-full bg-[#1E40AF] hover:bg-blue-800 text-white py-2 rounded font-bold transition-colors">{t('common.save')}</button>
                </form>
            </Modal>

            {/* Return Book Modal */}
            <Modal isOpen={isModalOpen && modalType === 'return_book_modal'} onClose={() => setIsModalOpen(false)} title={t('b.returnBook')}>
                <form onSubmit={handleQuickReturn} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('th.trackingNo')}</label>
                        <input type="text" placeholder={t('ph.trackingExample')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white" value={loanForm.tracking_number} onChange={e => setLoanForm({ ...loanForm, tracking_number: e.target.value })} required />
                        <span className="text-xs text-gray-400 mt-1 block">{t('misc.returnHint')}</span>
                    </div>
                    <button className="w-full bg-[#9D174D] hover:bg-pink-800 text-white py-2 rounded font-bold transition-colors">{t('b.completeReturn')}</button>
                </form>
            </Modal>

            {/* Add / Edit Copy Modal */}
            <Modal isOpen={isModalOpen && (modalType === 'add_copy' || modalType === 'edit_copy')} onClose={() => setIsModalOpen(false)} title={modalType === 'add_copy' ? t('md.addCopy') : t('md.editCopy')}>
                <form onSubmit={handleCopySubmit} className="space-y-4">
                    {/* Each copy is one physical item identified by its barcode, so copies are
                        added one at a time rather than by quantity. */}
                    <div>
                        <label className={labelCls}>{t('fld.trackingBarcode')}</label>
                        <input type="text" placeholder={t('ph.trackingExample')} className={inputCls} value={copyForm.tracking_number} onChange={e => setCopyForm({ ...copyForm, tracking_number: e.target.value })} required />
                    </div>
                    <div>
                        <label className={labelCls}>{t('fld.condition')}</label>
                        <select className={inputCls} value={copyForm.condition_id} onChange={e => setCopyForm({ ...copyForm, condition_id: e.target.value })}>
                            <option value="">{t('common.select')}</option>
                            {categories.conditions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>{t('th.copyStatus')}</label>
                        <select className={inputCls} value={copyForm.status_id} onChange={e => setCopyForm({ ...copyForm, status_id: e.target.value })}>
                            <option value="">{t('common.select')}</option>
                            {categories.copyStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    {categories.conditions.length === 0 && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {t('msg.conditionsEmpty')}
                        </p>
                    )}
                    <button className="w-full bg-[#1E5631] hover:bg-green-800 text-white py-2 rounded font-bold transition-colors">{t('common.save')}</button>
                </form>
            </Modal>

            {/* Student Details / Reading History Modal with Time Filter */}
            <Modal isOpen={isModalOpen && modalType === 'student_details'} onClose={() => setIsModalOpen(false)} title={t('md.studentHistory')} maxWidth="max-w-3xl">
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
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {selectedStudent.user_id} • {t('th.class')}: {selectedStudent.grade} {selectedStudent.class_group}</p>
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <select 
                                        className="w-full sm:w-auto border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm px-3 py-1.5 outline-none rounded-lg focus:border-[#1B9DD9]"
                                        value={studentHistoryTimeFrame}
                                        onChange={(e) => setStudentHistoryTimeFrame(e.target.value)}
                                    >
                                        <option value="all">{t('misc.allTime')}</option>
                                        <option value="year">{t('misc.thisYear')}</option>
                                        <option value="month">{t('misc.thisMonth')}</option>
                                    </select>
                                    
                                    <div className="text-right border-l border-gray-200 dark:border-gray-600 pl-4">
                                        <span className="block text-xl font-bold text-[#1B9DD9]">{filteredStudentLoans.length}</span>
                                        <span className="text-[10px] text-gray-400 uppercase whitespace-nowrap">{t('misc.totalTx')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 sticky top-0 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-xs">{t('th.title')}</th>
                                            <th className="px-4 py-3 font-semibold text-xs">{t('th.issue')}</th>
                                            <th className="px-4 py-3 font-semibold text-xs">{t('th.return')}</th>
                                            <th className="px-4 py-3 font-semibold text-xs text-right">{t('th.status')}</th>
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
                                                        {loan.status?.code === 'ACTIVE' ? t('st.inUse') : t('st.returned')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredStudentLoans.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-gray-400 text-xs">{t('msg.noPeriod')}</td></tr>}
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