import { useEffect, useState, useContext } from 'react';
import api, { assetUrl } from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Book, Calendar, Clock, Bookmark, Filter, Layers, User, BarChart2, BookOpen, PieChart, Award, Home, ChevronDown, ChevronUp, Mail, Bell, Moon, Sun, MoreHorizontal, Globe, ChevronLeft, CheckSquare, Square, FileText } from 'lucide-react';
import Modal from '../../components/Modal'; // <-- EKLENDI: Modal Bileseni
import HomeView from '../../components/HomeView';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ProfileModal, { displayName } from '../ProfileModal';
import { useTranslation } from '../../i18n/LanguageContext';

const StudentDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

    // UI State
    const [activeTab, setActiveTab] = useState('home');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDark, setIsDark] = useState(false); 
    const [viewMode, setViewMode] = useState('card');
    const [libraryViewMode, setLibraryViewMode] = useState('list'); 
    
    const [isFilterOpen, setIsFilterOpen] = useState(false); 
    const [isLibraryFilterOpen, setIsLibraryFilterOpen] = useState(false); 

    const [openDropdownId, setOpenDropdownId] = useState(null);

    // 👇 EKLENDI: Modal ve Seçili Kitap Durumu (State)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedBook, setSelectedBook] = useState(null);

    // Data State
    const [books, setBooks] = useState([]);
    const [myLoans, setMyLoans] = useState([]);

    // Filters & Sorting State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [isbnFilter, setIsbnFilter] = useState('');
    const [librarySearchQuery, setLibrarySearchQuery] = useState('');
    const [librarySelectedGenre, setLibrarySelectedGenre] = useState('All');
    const [loanFilter, setLoanFilter] = useState('All');
    const [loanSort, setLoanSort] = useState('newest');
    const [hideReturned, setHideReturned] = useState(false); 
    const [timeFrame, setTimeFrame] = useState('all');

    // --- 1. FETCH DATA & EVENT LISTENERS ---
    useEffect(() => {
        const fetchData = async () => {
            await fetchCatalog();
            if (user && user.id) await fetchMyLibrary();
            setLoading(false);
        };
        fetchData();

        const handleClickOutside = () => setOpenDropdownId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [user]);

    const fetchCatalog = async () => {
        try {
            const res = await api.get('/books');
            setBooks(res.data);
        } catch (err) { console.error("Error fetching catalog", err); } 
    };

    const fetchMyLibrary = async () => {
        try {
            const res = await api.get(`/my-library/${user.id}`); 
            setMyLoans(res.data);
        } catch (err) { console.error("Error fetching loans", err); }
    };

    // --- 2. ACTIONS ---
    const handleReserve = async (book) => {
        const availableCopy = book.copies?.find(c => c.status?.code === 'AVAILABLE');
        if (!availableCopy) {
            alert(t('stu.noCopy'));
            return;
        }
        if(!window.confirm(t('stu.reserveConfirm', { title: book.title || book.book_title }))) return;

        try {
            // The backend locates the copy by book + physical barcode, not by copy id.
            await api.post('/reservation', {
                student_id: parseInt(user.id),
                book_id: book.id,
                tracking_number: availableCopy.tracking_number
            });
            alert(t('stu.reserveSent'));
            setOpenDropdownId(null);
            setIsDetailModalOpen(false); // Modalı da kapat
            fetchCatalog(); 
        } catch (err) {
            alert(t('stu.reserveFailed') + ": " + (err.response?.data?.error || t('stu.unknownError')));
        }
    };

    const handleLogout = () => { logout(); navigate('/login'); };

    // 👇 EKLENDI: Detay Modalını Açma Fonksiyonu
    const openBookDetails = (data, isFromLibrary = false) => {
        let bookData = {};
        
        if (isFromLibrary) {
            // Kitaplarım'dan geliyorsa veriyi normalize et
            bookData = {
                id: data.id,
                title: data.book_title || t('stu.unknownBook'),
                author: data.author || t('stu.unknownAuthor'),
                genre: data.genre || "-",
                page_count: data.page_count || "?",
                publisher: t('stu.libraryRecord'),
                isbn: "-",
                cover_url: data.cover_url,
                isLibraryItem: true,
                issue_date: data.issue_date,
                due_date: data.due_date,
                status: data.status,
                status_code: data.status_code,
                raw: data // Rezervasyon için asıl kopya gerekebilir
            };
        } else {
            // Katalog'dan geliyorsa kategori nesnelerini isimlere çevir
            bookData = {
                ...data,
                author: data.author?.name || t('stu.unknownAuthor'),
                genre: data.genre?.name || "-",
                publisher: data.publisher?.name || "-",
                isLibraryItem: false,
            };
        }
        
        setSelectedBook(bookData);
        setIsDetailModalOpen(true);
        setOpenDropdownId(null); // 3-nokta menüsünü kapat
    };

    // --- 3. FILTERING LOGIC ---
    const uniqueGenres = ['All', ...new Set(books.map(b => b.genre?.name).filter(Boolean))];
    const uniqueLibraryGenres = ['All', ...new Set(myLoans.map(l => l.genre).filter(Boolean))];

    const getFilteredCatalog = () => {
        let result = books;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(b => 
                b.title?.toLowerCase().includes(q) || 
                b.author?.name?.toLowerCase().includes(q) ||
                b.publisher?.name?.toLowerCase().includes(q)
            );
        }
        if (selectedGenre !== 'All') {
            result = result.filter(b => b.genre?.name === selectedGenre);
        }
        if (isbnFilter) {
            result = result.filter(b => b.isbn?.includes(isbnFilter));
        }
        return result;
    };

    const getFilteredLoans = () => {
        let result = myLoans;
        if (librarySearchQuery) {
            const q = librarySearchQuery.toLowerCase();
            result = result.filter(l => 
                (l.book_title || "").toLowerCase().includes(q) ||
                (l.author || "").toLowerCase().includes(q)
            );
        }
        if (librarySelectedGenre !== 'All') {
            result = result.filter(l => l.genre === librarySelectedGenre);
        }
        if (hideReturned) {
            result = result.filter(l => l.status_code === 'ACTIVE');
        } else {
            if (loanFilter === 'Active') result = result.filter(l => l.status_code === 'ACTIVE');
            if (loanFilter === 'Returned') result = result.filter(l => l.status_code === 'RETURNED');
        }
        return result.sort((a, b) => {
            const dateA = new Date(a.issue_date).getTime();
            const dateB = new Date(b.issue_date).getTime();
            if (loanSort === 'newest') return dateB - dateA;
            if (loanSort === 'oldest') return dateA - dateB;
            if (loanSort === 'title_az') return (a.book_title || "").localeCompare(b.book_title || "");
            return 0;
        });
    };

    const displayBooks = getFilteredCatalog();
    const displayLoans = getFilteredLoans();

    const getSafeBookDetails = (loan) => {
        if (loan.book_title) return { title: loan.book_title, author: loan.author || t('stu.unknownAuthor'), genre: loan.genre, page_count: loan.page_count };
        const copy = loan.book_copy || loan.BookCopy || {};
        const book = copy.book || copy.Book || {};
        return {
            title: book.title || t('stu.unknownBook'),
            author: book.author?.name || t('stu.unknownAuthor'),
            genre: book.genre?.name || "-",
            page_count: book.page_count || 0
        };
    };

    // --- 4. STATISTICS LOGIC ---
    const getFilteredStats = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const readBooks = myLoans.filter(loan => {
            if (loan.status_code !== 'RETURNED') return false;
            if (!loan.return_date) return false; 
            const rDate = new Date(loan.return_date);
            if (timeFrame === 'year' && rDate.getFullYear() !== currentYear) return false;
            if (timeFrame === 'month' && (rDate.getFullYear() !== currentYear || rDate.getMonth() !== currentMonth)) return false;
            return true;
        });

        const totalBooks = readBooks.length;
        const totalPages = readBooks.reduce((sum, book) => sum + (book.page_count || 0), 0);
        
        const genreCounts = {};
        readBooks.forEach(b => {
            const g = b.genre || t('stu.other');
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });

        const genreData = Object.keys(genreCounts).map(key => ({
            name: key,
            count: genreCounts[key],
            percent: totalBooks > 0 ? ((genreCounts[key] / totalBooks) * 100).toFixed(1) : 0
        })).sort((a, b) => b.count - a.count);

        const favoriteGenre = genreData.length > 0 ? genreData[0].name : t('stu.none');

        return { readBooks, totalBooks, totalPages, genreData, favoriteGenre };
    };

    const stats = getFilteredStats();

    const getConicGradient = (data) => {
        if (!data.length) return 'gray';
        let gradient = 'conic-gradient(';
        let currentDeg = 0;
        const colors = ['#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];
        data.forEach((item, index) => {
            const deg = (item.count / stats.totalBooks) * 360;
            const color = colors[index % colors.length];
            gradient += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `;
            currentDeg += deg;
        });
        return gradient.slice(0, -2) + ')';
    };

    // Overview data for the Anasayfa (home) view.
    const studentHomeStats = [
        { key: 'active', label: t('home.myActiveLoans'), value: myLoans.filter(l => l.status_code === 'ACTIVE').length, accent: 'text-[#E85B5B] dark:text-red-400' },
        { key: 'read', label: t('home.myReadBooks'), value: myLoans.filter(l => l.status_code === 'RETURNED').length, accent: 'text-green-600 dark:text-green-400' },
        { key: 'catalog', label: t('home.totalBooks'), value: books.length },
    ];
    const studentHomeActions = [
        { label: t('home.goToCatalog'), onClick: () => setActiveTab('catalog') },
        { label: t('home.goToMyBooks'), onClick: () => setActiveTab('mylibrary') },
    ];

    if (loading) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>;

    return (
        <div className={isDark ? 'dark' : ''}>
            <div className="flex h-screen bg-[#F8F9FA] dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
                
                {/* LEFT SIDEBAR */}
                <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-sm transition-colors duration-200">
                    <div className="h-20 flex items-center px-8 border-b border-gray-100 dark:border-gray-800">
                        <img src="/logo.png" alt="e12" className="h-8" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span className="text-2xl font-bold text-[#E85B5B] hidden">e12</span>
                    </div>
                    
                    <nav className="flex-1 px-4 py-6 flex flex-col gap-1">
                        {[
                            { id: 'home', icon: Home, label: t('nav.home') },
                            { id: 'catalog', icon: BookOpen, label: t('nav.library') },
                            { id: 'mylibrary', icon: Book, label: t('nav.myBooks') },
                            { id: 'stats', icon: BarChart2, label: t('tab.stats') },
                        ].map(item => {
                            const Icon = item.icon;
                            const active = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${active
                                        ? 'bg-[#E85B5B] text-white shadow-md shadow-red-200 dark:shadow-none'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    <Icon size={18} /> {item.label}
                                </button>
                            );
                        })}

                        <div className="mt-auto flex flex-col gap-1">
                            <button onClick={() => setIsProfileOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <User size={18} /> {t('nav.profile')}
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
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:text-black dark:hover:text-white transition-colors">
                            <ChevronLeft size={20} />
                            {t('nav.library')}
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
                                <LanguageSwitcher />
                                <button onClick={() => setIsDark(!isDark)} className="hover:text-indigo-500 dark:hover:text-yellow-400 transition-colors outline-none">
                                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                                </button>
                            </div>
                            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800 outline-none group" title={t('nav.profile')}>
                                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold uppercase">
                                    {displayName(user)?.charAt(0) || 'A'}
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight group-hover:text-[#E85B5B] transition-colors">{displayName(user) || t('role.student')}</p>
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
                                <HomeView welcomeName={displayName(user)} stats={studentHomeStats} actions={studentHomeActions} />
                            )}

                            {/* Tabs */}
                            {activeTab !== 'home' && (
                            <div className="px-8 pt-6 border-b border-gray-100 dark:border-gray-800 flex gap-8 relative">
                                <button onClick={() => setActiveTab('catalog')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'catalog' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.catalog')}
                                    {activeTab === 'catalog' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('mylibrary')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'mylibrary' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.myLibrary')}
                                    {activeTab === 'mylibrary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('stats')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'stats' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    {t('tab.stats')}
                                    {activeTab === 'stats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>

                                {/* List/Card Toggle for Kitaplarım */}
                                {activeTab === 'mylibrary' && (
                                    <div className="absolute right-8 bottom-3 flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                        <button onClick={() => setLibraryViewMode('list')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${libraryViewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                            Liste
                                        </button>
                                        <button onClick={() => setLibraryViewMode('card')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${libraryViewMode === 'card' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                            {t('view.chartCard')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}

                            {/* === TAB 1: CATALOG === */}
                            {activeTab === 'catalog' && (
                                <div className="p-8">
                                    <div className="mb-8">
                                        <div className="flex justify-between items-center mb-4">
                                            <button 
                                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                                className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none hover:text-[#E85B5B] transition-colors"
                                            >
                                                {isFilterOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} Filtre
                                            </button>
                                            
                                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                                <button onClick={() => setViewMode('card')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${viewMode === 'card' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>{t('view.card')}</button>
                                                <button onClick={() => setViewMode('list')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>{t('view.list')}</button>
                                            </div>
                                        </div>
                                        
                                        {isFilterOpen && (
                                            <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="lg:col-span-2">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Kitap Ara</label>
                                                    <input type="text" placeholder={t('stu.searchCatalog')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B] dark:focus:border-[#E85B5B]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Konu</label>
                                                    <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                                                        {uniqueGenres.map(g => <option key={g} value={g}>{g === 'All' ? t('f.byTopic') : g}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">ISBN</label>
                                                    <input type="text" placeholder={t('f.isbn')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={isbnFilter} onChange={(e) => setIsbnFilter(e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Catalog Display */}
                                    {viewMode === 'card' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {displayBooks.map((book) => {
                                                const availableCount = book.copies ? book.copies.filter(c => c.status?.code === 'AVAILABLE').length : 0;
                                                const isAvailable = availableCount > 0;
                                                
                                                let badgeText = t('stu.outOfStock');
                                                let badgeColor = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                                                if (isAvailable) { badgeText = t('stu.inLibrary'); badgeColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400"; }
                                                else if (book.copies && book.copies.length > 0) { badgeText = "Rezerve"; badgeColor = "bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400"; }

                                                return (
                                                    <div key={book.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 relative group hover:border-[#E85B5B] dark:hover:border-[#E85B5B] transition-colors bg-white dark:bg-gray-800">
                                                        <div className="flex justify-between items-start mb-4 relative">
                                                            <span className={`text-[10px] px-3 py-1 rounded font-bold tracking-wide ${badgeColor}`}>{badgeText}</span>
                                                            
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `catalog-${book.id}` ? null : `catalog-${book.id}`); }} 
                                                                className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 outline-none"
                                                            >
                                                                <MoreHorizontal size={18}/>
                                                            </button>

                                                            {openDropdownId === `catalog-${book.id}` && (
                                                                <div 
                                                                    className="absolute right-0 top-6 flex flex-col gap-2 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <button onClick={() => openBookDetails(book)} className="bg-[#FEF3C7] dark:bg-amber-900/40 border border-[#FDE68A] dark:border-amber-700 text-[#B45309] dark:text-amber-400 text-[11px] font-bold px-4 py-2 rounded-lg w-28 text-center hover:bg-[#FDE68A] dark:hover:bg-amber-900/60 transition-colors">
                                                                        Detay
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleReserve(book)} 
                                                                        disabled={!isAvailable} 
                                                                        className={`text-[11px] font-bold px-4 py-2 rounded-lg border w-28 text-center transition-colors ${isAvailable ? 'bg-[#E0E7FF] dark:bg-indigo-900/40 border-[#BFDBFE] dark:border-indigo-700 text-[#4338CA] dark:text-indigo-300 hover:bg-[#C7D2FE] dark:hover:bg-indigo-900/60' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
                                                                    >
                                                                        {t('stu.reserve')}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="h-40 border border-gray-300 dark:border-gray-600 rounded mb-4 relative overflow-hidden bg-[#F9FAFB] dark:bg-gray-700 flex items-center justify-center">
                                                            {book.cover_url && (
                                                                <img src={assetUrl(book.cover_url)} alt={book.title} className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.target.style.display = 'none'; }} />
                                                            )}
                                                            <svg className="absolute inset-0 w-full h-full text-gray-300 dark:text-gray-600 z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"/>
                                                                <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1"/>
                                                            </svg>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-0.5 truncate" title={book.title}>{book.title}</h3>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 truncate">{book.author?.name || '-'}</p>
                                                            
                                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                                                                <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate mr-2">{book.publisher?.name || t('stu.publisherUnspecified')}</span>
                                                                <span className="text-[10px] flex items-center gap-1 font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 shrink-0"><Globe size={10}/> {book.language || t('fld.language')}</span>
                                                            </div>
                                                            
                                                            <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                                                <span>ISBN: {book.isbn || t('stu.na')}</span>
                                                                <span>{t('stu.page')}: {book.page_count || '?'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                    <tr>
                                                        <th className="px-6 py-4 font-semibold">{t('th.title')}</th>
                                                        <th className="px-6 py-4 font-semibold">{t('th.author')}</th>
                                                        <th className="px-6 py-4 font-semibold">{t('th.publisher')}</th>
                                                        <th className="px-6 py-4 font-semibold">{t('fld.genre')}</th>
                                                        <th className="px-6 py-4 font-semibold">Durum</th>
                                                        <th className="px-6 py-4 text-center font-semibold">{t('th.action')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                    {displayBooks.map(book => {
                                                        const availableCount = book.copies ? book.copies.filter(c => c.status?.code === 'AVAILABLE').length : 0;
                                                        const isAvailable = availableCount > 0;
                                                        
                                                        let badgeText = t('stu.outOfStock');
                                                        let badgeColor = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                                                        if (isAvailable) { badgeText = t('stu.inLibrary'); badgeColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400"; }
                                                        else if (book.copies && book.copies.length > 0) { badgeText = "Rezerve"; badgeColor = "bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400"; }

                                                        return (
                                                            <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                                    {book.title}
                                                                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">ISBN: {book.isbn || t('stu.na')}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{book.author?.name || '-'}</td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{book.publisher?.name || '-'}</td>
                                                                <td className="px-6 py-4">
                                                                    {book.genre?.name ? <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs">{book.genre.name}</span> : '-'}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`text-[10px] px-3 py-1 rounded font-bold tracking-wide ${badgeColor}`}>{badgeText}</span>
                                                                </td>
                                                                <td className="px-6 py-4 text-center relative">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `catalog-list-${book.id}` ? null : `catalog-list-${book.id}`); }} 
                                                                        className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 outline-none"
                                                                    >
                                                                        <MoreHorizontal size={18}/>
                                                                    </button>

                                                                    {openDropdownId === `catalog-list-${book.id}` && (
                                                                        <div 
                                                                            className="absolute right-16 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button onClick={() => openBookDetails(book)} className="bg-[#FEF3C7] dark:bg-amber-900/40 border border-[#FDE68A] dark:border-amber-700 text-[#B45309] dark:text-amber-400 text-[11px] font-bold px-4 py-2 rounded-lg w-28 text-center hover:bg-[#FDE68A] dark:hover:bg-amber-900/60 transition-colors">Detay</button>
                                                                            <button onClick={() => handleReserve(book)} disabled={!isAvailable} className={`text-[11px] font-bold px-4 py-2 rounded-lg border w-28 text-center transition-colors ${isAvailable ? 'bg-[#E0E7FF] dark:bg-indigo-900/40 border-[#BFDBFE] dark:border-indigo-700 text-[#4338CA] dark:text-indigo-300 hover:bg-[#C7D2FE] dark:hover:bg-indigo-900/60' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}>Rezerve Et</button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {displayBooks.length === 0 && <div className="py-20 text-center text-gray-400 dark:text-gray-500">{t('stu.noBooksFound')}</div>}
                                </div>
                            )}

                            {/* === TAB 2: MY LIBRARY (KITAPLARIM) === */}
                            {activeTab === 'mylibrary' && (
                                <div className="p-8 space-y-6">
                                    
                                    {/* Filter & Tools Section for Library */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <button 
                                                onClick={() => setIsLibraryFilterOpen(!isLibraryFilterOpen)}
                                                className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none hover:text-[#E85B5B] transition-colors"
                                            >
                                                {isLibraryFilterOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} Filtre
                                            </button>
                                        </div>
                                        
                                        {isLibraryFilterOpen && (
                                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200 mb-6">
                                                <div className="lg:col-span-2">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t('stu.searchHistory')}</label>
                                                    <input type="text" placeholder={t('stu.searchBookAuthor')} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={librarySearchQuery} onChange={(e) => setLibrarySearchQuery(e.target.value)} />
                                                </div>
                                                <div className="lg:col-span-2">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Konu</label>
                                                    <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={librarySelectedGenre} onChange={(e) => setLibrarySelectedGenre(e.target.value)}>
                                                        {uniqueLibraryGenres.map(g => <option key={g} value={g}>{g === 'All' ? t('f.byTopic') : g}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <div className="flex gap-4">
                                                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 min-w-[120px]">
                                                    <h4 className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('stu.activeLoans')}</h4>
                                                    <p className="text-2xl font-bold text-[#E85B5B] dark:text-red-400">{myLoans.filter(l => l.status_code === 'ACTIVE').length}</p>
                                                </div>
                                                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 min-w-[120px]">
                                                    <h4 className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('stu.returnedLabel')}</h4>
                                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{myLoans.filter(l => l.status_code === 'RETURNED').length}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-4">
                                                <button 
                                                    onClick={() => setHideReturned(!hideReturned)}
                                                    className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors outline-none"
                                                >
                                                    {hideReturned ? <CheckSquare className="text-[#E85B5B]" size={18}/> : <Square size={18}/>}
                                                    {t('stu.hideReturned')}
                                                </button>

                                                <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-4">
                                                    <Layers size={14} className="text-gray-500" />
                                                    <select className="bg-transparent text-sm text-gray-700 dark:text-gray-200 outline-none font-medium cursor-pointer" value={loanSort} onChange={(e) => setLoanSort(e.target.value)}>
                                                        <option value="newest">En Yeniler</option>
                                                        <option value="oldest">En Eskiler</option>
                                                        <option value="title_az">{t('stu.titleAZ')}</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Library Display */}
                                    {libraryViewMode === 'list' ? (
                                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                    <tr>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">{t('th.library')}</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">{t('th.title')}</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">{t('th.author')}</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">{t('fld.genre')}</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">{t('stu.issueReturn')}</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Durum</th>
                                                        <th className="px-6 py-4 text-center font-semibold text-xs uppercase tracking-wider">{t('common.actions')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                    {displayLoans.map((loan) => {
                                                        const details = getSafeBookDetails(loan);
                                                        const issueDate = new Date(loan.issue_date);
                                                        const dueDate = new Date(loan.due_date);
                                                        const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                                                        const isOverdue = diffDays < 0 && loan.status_code === 'ACTIVE';
                                                        
                                                        let statusText = t('st.inUse');
                                                        let statusColor = "bg-[#FEF3C7] text-[#B45309] dark:bg-yellow-900/30 dark:text-yellow-500";
                                                        if (loan.status_code === 'RETURNED') {
                                                            statusText = t('st.returned');
                                                            statusColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400";
                                                        } else if (isOverdue) {
                                                            statusText = "Gecikti";
                                                            statusColor = "bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400";
                                                        }

                                                        return (
                                                            <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group relative">
                                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{t('f.centralBranch')}</td>
                                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">{details.title}</td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{details.author}</td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{details.genre}</td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                                    <div className="text-[11px]">{issueDate.toLocaleDateString()}</div>
                                                                    <div className={`text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                                                        {dueDate.toLocaleDateString()}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <span className={`text-[10px] px-3 py-1 rounded font-bold tracking-wide ${statusColor}`}>
                                                                        {statusText}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-center relative">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `lib-list-${loan.id}` ? null : `lib-list-${loan.id}`); }} 
                                                                        className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 outline-none"
                                                                    >
                                                                        <MoreHorizontal size={18}/>
                                                                    </button>
                                                                    
                                                                    {openDropdownId === `lib-list-${loan.id}` && (
                                                                        <div 
                                                                            className="absolute right-16 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button onClick={() => openBookDetails(loan, true)} className="bg-[#C2E0C6] dark:bg-green-900/40 border border-[#A3D3A8] dark:border-green-700 text-[#1E5631] dark:text-green-300 text-[11px] font-bold px-4 py-2 rounded-lg w-28 text-center hover:bg-[#A3D3A8] dark:hover:bg-green-900/60 transition-colors">Detay</button>
                                                                            <button className="bg-[#E0E7FF] dark:bg-indigo-900/40 border border-[#BFDBFE] dark:border-indigo-700 text-[#4338CA] dark:text-indigo-300 text-[11px] font-bold px-4 py-2 rounded-lg w-28 text-center hover:bg-[#C7D2FE] dark:hover:bg-indigo-900/60 transition-colors">Okuma Bilgisi</button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {displayLoans.map((loan) => {
                                                const details = getSafeBookDetails(loan);
                                                const dueDate = new Date(loan.due_date);
                                                const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                                                const isOverdue = diffDays < 0 && loan.status_code === 'ACTIVE';

                                                let statusText = t('st.inUse');
                                                let statusColor = "bg-[#FEF3C7] text-[#B45309] dark:bg-yellow-900/30 dark:text-yellow-500";
                                                if (loan.status_code === 'RETURNED') {
                                                    statusText = t('st.returned');
                                                    statusColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400";
                                                } else if (isOverdue) {
                                                    statusText = "Gecikti";
                                                    statusColor = "bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400";
                                                }

                                                return (
                                                    <div key={loan.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 relative hover:border-[#E85B5B] dark:hover:border-[#E85B5B] transition-colors bg-white dark:bg-gray-800">
                                                        <div className="flex justify-between items-start mb-4 relative">
                                                            <span className={`text-[10px] px-3 py-1 rounded font-bold tracking-wide ${statusColor}`}>{statusText}</span>
                                                            
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `lib-card-${loan.id}` ? null : `lib-card-${loan.id}`); }} 
                                                                className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 outline-none"
                                                            >
                                                                <MoreHorizontal size={18}/>
                                                            </button>

                                                            {openDropdownId === `lib-card-${loan.id}` && (
                                                                <div 
                                                                    className="absolute right-0 top-6 flex flex-col gap-2 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <button onClick={() => openBookDetails(loan, true)} className="bg-[#C2E0C6] dark:bg-green-900/40 border border-[#A3D3A8] dark:border-green-700 text-[#1E5631] dark:text-green-300 text-[11px] font-bold px-4 py-2 rounded-lg w-28 text-center hover:bg-[#A3D3A8] dark:hover:bg-green-900/60 transition-colors">Detay</button>
                                                                    <button className="bg-[#E0E7FF] dark:bg-indigo-900/40 border border-[#BFDBFE] dark:border-indigo-700 text-[#4338CA] dark:text-indigo-300 text-[11px] font-bold px-4 py-2 rounded-lg w-28 text-center hover:bg-[#C7D2FE] dark:hover:bg-indigo-900/60 transition-colors">Okuma Bilgisi</button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="h-40 border border-gray-300 dark:border-gray-600 rounded mb-4 relative overflow-hidden bg-[#F9FAFB] dark:bg-gray-700 flex items-center justify-center">
                                                            {details.cover_url && <img src={assetUrl(details.cover_url)} alt={details.title} className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.target.style.display = 'none'; }}/>}
                                                            <svg className="absolute inset-0 w-full h-full text-gray-300 dark:text-gray-600 z-0" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"/><line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1"/></svg>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-0.5 truncate" title={details.title}>{details.title}</h3>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 truncate">{details.author}</p>
                                                            
                                                            <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-[10px] text-gray-500 dark:text-gray-400 mb-2 border border-gray-100 dark:border-gray-700">
                                                                <div className="flex justify-between mb-1">
                                                                    <span>{t('stu.acquired')}:</span> <span className="font-medium">{new Date(loan.issue_date).toLocaleDateString()}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t('stu.deliver')}:</span> <span className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>{dueDate.toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {displayLoans.length === 0 && <div className="p-10 text-center text-gray-400 dark:text-gray-500">{t('msg.noRecords')}</div>}
                                </div>
                            )}

                            {/* === TAB 3: STATISTICS === */}
                            {activeTab === 'stats' && (
                                <div className="p-8 space-y-8">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('stu.readingStats')}</h3>
                                        <select className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 text-sm px-4 py-2 rounded-lg outline-none cursor-pointer focus:border-[#E85B5B]" value={timeFrame} onChange={(e) => setTimeFrame(e.target.value)}>
                                            <option value="all">{t('misc.allTime')}</option>
                                            <option value="year">{t('misc.thisYear')}</option>
                                            <option value="month">Bu Ay</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">Okunan Kitap</p>
                                                <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.totalBooks}</h3>
                                            </div>
                                            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center"><BookOpen className="text-blue-500 dark:text-blue-400" size={24} /></div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">Okunan Sayfa</p>
                                                <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.totalPages.toLocaleString()}</h3>
                                            </div>
                                            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center"><BarChart2 className="text-green-500 dark:text-green-400" size={24} /></div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">{t('stu.favGenre')}</p>
                                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate max-w-[120px]">{stats.favoriteGenre}</h3>
                                            </div>
                                            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center"><Award className="text-purple-500 dark:text-purple-400" size={24} /></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center">
                                            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-6 text-sm self-start">{t('stu.genreDist')}</h3>
                                            {stats.totalBooks > 0 ? (
                                                <>
                                                    <div className="w-48 h-48 rounded-full mb-6 relative" style={{ background: getConicGradient(stats.genreData) }}>
                                                        <div className="absolute inset-4 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center flex-col shadow-inner transition-colors duration-200">
                                                            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalBooks}</span>
                                                            <span className="text-[10px] text-gray-400 uppercase">Kitap</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full space-y-3 mt-4">
                                                        {stats.genreData.map((g, i) => (
                                                            <div key={g.name} className="flex justify-between items-center text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded-full" style={{ background: ['#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'][i % 6] }}></div>
                                                                    <span className="text-gray-600 dark:text-gray-300 font-medium">{g.name}</span>
                                                                </div>
                                                                <span className="font-bold text-gray-800 dark:text-gray-200">{g.count} <span className="text-gray-400 dark:text-gray-500 font-normal">({g.percent}%)</span></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Veri Yok</div>
                                            )}
                                        </div>

                                        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700"><h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{t('stu.readingHistory')}</h3></div>
                                            <div className="divide-y divide-gray-50 dark:divide-gray-700 flex-1 overflow-y-auto max-h-[400px]">
                                                {stats.readBooks.length > 0 ? stats.readBooks.map((book) => (
                                                    <div key={book.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-gray-700 dark:text-gray-200 text-sm">{book.book_title}</h4>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('th.author')}: {book.author?.name || '-'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-xs font-bold text-green-600 dark:text-green-400">{book.page_count} sayfa</span>
                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('th.return')}: {new Date(book.return_date).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="p-10 text-center text-gray-400 text-sm flex h-full items-center justify-center">{t('stu.noReadPeriod')}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </main>
                </div>
            </div>

            {/* 👇 EKLENDI: Kitap Detay Modalı */}
            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={t('stu.bookDetails')}>
                {selectedBook && (
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            {/* Left: Book Cover Placeholder */}
                            <div className="w-32 h-44 border border-gray-200 dark:border-gray-700 rounded-lg flex-shrink-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden">
                                {selectedBook.cover_url && (
                                    <img src={assetUrl(selectedBook.cover_url)} alt={selectedBook.title} className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.target.style.display = 'none'; }} />
                                )}
                                <svg className="absolute inset-0 w-full h-full text-gray-300 dark:text-gray-600 z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"/>
                                    <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1"/>
                                </svg>
                            </div>
                            
                            {/* Right: Book Details */}
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 mb-1">{selectedBook.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{t('th.author')}: <span className="font-medium text-gray-900 dark:text-white">{selectedBook.author}</span></p>
                                
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <p className="flex justify-between"><span>{t('fld.genre')}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.genre || "-"}</span></p>
                                    <p className="flex justify-between"><span>{t('stu.page')}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.page_count || "-"}</span></p>
                                    <p className="flex justify-between"><span>{t('th.publisher')}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.publisher || "-"}</span></p>
                                    <p className="flex justify-between"><span>ISBN:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.isbn || "-"}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Additional Info for Library Items */}
                        {selectedBook.isLibraryItem && (
                            <div className="bg-[#E0E7FF] dark:bg-indigo-900/30 text-[#4338CA] dark:text-indigo-300 p-3 rounded-lg text-sm border border-[#BFDBFE] dark:border-indigo-800">
                                <div className="flex justify-between font-bold mb-1">
                                    <span>{t('stu.statusPrefix')}: {selectedBook.status_code === 'ACTIVE' ? t('stu.activeLoanBadge') : t('st.returned')}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span>{t('th.issue')}: {new Date(selectedBook.issue_date).toLocaleDateString()}</span>
                                    {selectedBook.status_code === 'ACTIVE' && <span>{t('stu.deliver')}: {new Date(selectedBook.due_date).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        )}

                        {/* E-Book read/download */}
                        {selectedBook.has_ebook && selectedBook.ebook_url && (
                            <a
                                href={assetUrl(selectedBook.ebook_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full mt-2 bg-[#1E5631] hover:bg-green-800 text-white font-bold py-2.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <FileText size={18} /> {t('ebook.view')}
                            </a>
                        )}

                        {/* Action Buttons */}
                        {!selectedBook.isLibraryItem && (
                            <button
                                onClick={() => handleReserve(selectedBook)}
                                className="w-full mt-2 bg-[#E85B5B] hover:bg-red-600 text-white font-bold py-2.5 rounded-lg shadow-sm transition-colors"
                            >
                                Rezerve Et
                            </button>
                        )}
                    </div>
                )}
            </Modal>

        </div>
    );
};

export default StudentDashboard;