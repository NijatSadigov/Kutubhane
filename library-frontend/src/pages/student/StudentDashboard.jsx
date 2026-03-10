import { useEffect, useState, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Book, Calendar, Clock, Bookmark, Filter, Layers, User, BarChart2, BookOpen, PieChart, Award, Home, ChevronDown, ChevronUp, Mail, Bell, Moon, Sun, MoreHorizontal, Globe, ChevronLeft, CheckSquare, Square } from 'lucide-react';
import Modal from '../../components/Modal'; // <-- EKLENDI: Modal Bileseni

const StudentDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // UI State
    const [activeTab, setActiveTab] = useState('catalog');
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
        const availableCopy = book.copies?.find(c => c.status === 'Available');
        if (!availableCopy) {
            alert("Üzgünüz, şu anda rezerve edilecek kopya yok.");
            return;
        }
        if(!window.confirm(`"${book.title || book.book_title}" kitabını rezerve etmek istiyor musunuz?`)) return;

        try {
            await api.post('/reservation', {
                student_id: parseInt(user.id),
                book_copy_id: availableCopy.id
            });
            alert("Rezervasyon Talebi Gönderildi! 📩");
            setOpenDropdownId(null);
            setIsDetailModalOpen(false); // Modalı da kapat
            fetchCatalog(); 
        } catch (err) {
            alert("Rezervasyon başarısız: " + (err.response?.data?.error || "Bilinmeyen Hata"));
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
                title: data.book_title || "Bilinmeyen Kitap",
                author: data.author || "Bilinmeyen Yazar",
                genre: data.genre || "-",
                page_count: data.page_count || "?",
                publisher: "Kütüphane Kaydı", // Backend loan objesinde publisher yoksa
                isbn: "-",
                cover_url: data.cover_url,
                isLibraryItem: true,
                issue_date: data.issue_date,
                due_date: data.due_date,
                status: data.status,
                raw: data // Rezervasyon için asıl kopya gerekebilir
            };
        } else {
            // Katalog'dan geliyorsa doğrudan kullan
            bookData = { ...data, isLibraryItem: false };
        }
        
        setSelectedBook(bookData);
        setIsDetailModalOpen(true);
        setOpenDropdownId(null); // 3-nokta menüsünü kapat
    };

    // --- 3. FILTERING LOGIC ---
    const uniqueGenres = ['All', ...new Set(books.map(b => b.genre).filter(Boolean))];
    const uniqueLibraryGenres = ['All', ...new Set(myLoans.map(l => l.genre).filter(Boolean))];

    const getFilteredCatalog = () => {
        let result = books;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(b => 
                b.title?.toLowerCase().includes(q) || 
                b.author?.toLowerCase().includes(q) ||
                b.publisher?.toLowerCase().includes(q)
            );
        }
        if (selectedGenre !== 'All') {
            result = result.filter(b => b.genre === selectedGenre);
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
            result = result.filter(l => l.status === 'Active');
        } else {
            if (loanFilter === 'Active') result = result.filter(l => l.status === 'Active');
            if (loanFilter === 'Returned') result = result.filter(l => l.status === 'Returned');
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
        if (loan.book_title) return { title: loan.book_title, author: loan.author || "Bilinmeyen Yazar", genre: loan.genre, page_count: loan.page_count };
        const copy = loan.book_copy || loan.BookCopy || {};
        const book = copy.book || copy.Book || {};
        return { 
            title: book.title || book.Title || "Bilinmeyen Kitap", 
            author: book.author || book.Author || "Bilinmeyen Yazar",
            genre: book.genre || "-",
            page_count: book.page_count || 0
        };
    };

    // --- 4. STATISTICS LOGIC ---
    const getFilteredStats = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const readBooks = myLoans.filter(loan => {
            if (loan.status !== 'Returned') return false; 
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
            const g = b.genre || "Diğer";
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });

        const genreData = Object.keys(genreCounts).map(key => ({
            name: key,
            count: genreCounts[key],
            percent: totalBooks > 0 ? ((genreCounts[key] / totalBooks) * 100).toFixed(1) : 0
        })).sort((a, b) => b.count - a.count);

        const favoriteGenre = genreData.length > 0 ? genreData[0].name : "Henüz Yok";

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
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium bg-[#E85B5B] text-white rounded-xl shadow-md shadow-red-200 dark:shadow-none">
                            <BookOpen size={18} /> Kütüphane
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
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:text-black dark:hover:text-white transition-colors">
                            <ChevronLeft size={20} />
                            Kütüphane
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
                                <Mail size={20} className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors" />
                                <Bell size={20} className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors" />
                                <button onClick={() => setIsDark(!isDark)} className="hover:text-indigo-500 dark:hover:text-yellow-400 transition-colors outline-none">
                                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800">
                                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold uppercase">
                                    {user?.name?.charAt(0) || 'A'}
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">{user?.name || "Öğrenci"}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{user?.email || "ogrenci@e12.com.tr"}</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Scrollable Content */}
                    <main className="flex-1 overflow-y-auto p-8">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-full transition-colors duration-200">
                            
                            {/* Tabs */}
                            <div className="px-8 pt-6 border-b border-gray-100 dark:border-gray-800 flex gap-8 relative">
                                <button onClick={() => setActiveTab('catalog')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'catalog' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Kütüphane
                                    {activeTab === 'catalog' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('mylibrary')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'mylibrary' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    Kitaplarım
                                    {activeTab === 'mylibrary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>
                                <button onClick={() => setActiveTab('stats')} className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'stats' ? 'text-[#E85B5B]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                    İstatistiklerim
                                    {activeTab === 'stats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85B5B] rounded-t-full"></div>}
                                </button>

                                {/* List/Card Toggle for Kitaplarım */}
                                {activeTab === 'mylibrary' && (
                                    <div className="absolute right-8 bottom-3 flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                        <button onClick={() => setLibraryViewMode('list')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${libraryViewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                            Liste
                                        </button>
                                        <button onClick={() => setLibraryViewMode('card')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${libraryViewMode === 'card' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                            Grafik / Kart
                                        </button>
                                    </div>
                                )}
                            </div>

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
                                                <button onClick={() => setViewMode('card')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${viewMode === 'card' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>Kart</button>
                                                <button onClick={() => setViewMode('list')} className={`px-4 py-1 text-xs font-bold rounded shadow-sm transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>Liste</button>
                                            </div>
                                        </div>
                                        
                                        {isFilterOpen && (
                                            <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="lg:col-span-2">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Kitap Ara</label>
                                                    <input type="text" placeholder="Kitap adı, yazar veya yayınevi ile ara" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B] dark:focus:border-[#E85B5B]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Konu</label>
                                                    <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                                                        {uniqueGenres.map(g => <option key={g} value={g}>{g === 'All' ? 'Konuya göre ara' : g}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">ISBN</label>
                                                    <input type="text" placeholder="ISBN Numarası" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={isbnFilter} onChange={(e) => setIsbnFilter(e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Catalog Display */}
                                    {viewMode === 'card' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {displayBooks.map((book) => {
                                                const availableCount = book.copies ? book.copies.filter(c => c.status === 'Available').length : 0;
                                                const isAvailable = availableCount > 0;
                                                
                                                let badgeText = "Tükendi";
                                                let badgeColor = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                                                if (isAvailable) { badgeText = "Kütüphanede"; badgeColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400"; }
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
                                                                        Rezerve Et
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="h-40 border border-gray-300 dark:border-gray-600 rounded mb-4 relative overflow-hidden bg-[#F9FAFB] dark:bg-gray-700 flex items-center justify-center">
                                                            {book.cover_url && (
                                                                <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.target.style.display = 'none'; }} />
                                                            )}
                                                            <svg className="absolute inset-0 w-full h-full text-gray-300 dark:text-gray-600 z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"/>
                                                                <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1"/>
                                                            </svg>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-0.5 truncate" title={book.title}>{book.title}</h3>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 truncate">{book.author}</p>
                                                            
                                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                                                                <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate mr-2">{book.publisher || 'Yayınevi Belirtilmemiş'}</span>
                                                                <span className="text-[10px] flex items-center gap-1 font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 shrink-0"><Globe size={10}/> Türkçe</span>
                                                            </div>
                                                            
                                                            <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                                                <span>ISBN: {book.isbn || 'Yok'}</span>
                                                                <span>Sayfa: {book.page_count || '?'}</span>
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
                                                        <th className="px-6 py-4 font-semibold">Kitap Adı</th>
                                                        <th className="px-6 py-4 font-semibold">Yazar</th>
                                                        <th className="px-6 py-4 font-semibold">Yayınevi</th>
                                                        <th className="px-6 py-4 font-semibold">Tür</th>
                                                        <th className="px-6 py-4 font-semibold">Durum</th>
                                                        <th className="px-6 py-4 text-center font-semibold">İşlem</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                    {displayBooks.map(book => {
                                                        const availableCount = book.copies ? book.copies.filter(c => c.status === 'Available').length : 0;
                                                        const isAvailable = availableCount > 0;
                                                        
                                                        let badgeText = "Tükendi";
                                                        let badgeColor = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                                                        if (isAvailable) { badgeText = "Kütüphanede"; badgeColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400"; }
                                                        else if (book.copies && book.copies.length > 0) { badgeText = "Rezerve"; badgeColor = "bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400"; }

                                                        return (
                                                            <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                                    {book.title}
                                                                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">ISBN: {book.isbn || 'Yok'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{book.author}</td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{book.publisher || '-'}</td>
                                                                <td className="px-6 py-4">
                                                                    {book.genre ? <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs">{book.genre}</span> : '-'}
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

                                    {displayBooks.length === 0 && <div className="py-20 text-center text-gray-400 dark:text-gray-500">Aradığınız kriterlere uygun kitap bulunamadı.</div>}
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
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Geçmişte Ara</label>
                                                    <input type="text" placeholder="Kitap adı veya yazar ile ara" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={librarySearchQuery} onChange={(e) => setLibrarySearchQuery(e.target.value)} />
                                                </div>
                                                <div className="lg:col-span-2">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Konu</label>
                                                    <select className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm px-3 py-2 outline-none focus:border-[#E85B5B]" value={librarySelectedGenre} onChange={(e) => setLibrarySelectedGenre(e.target.value)}>
                                                        {uniqueLibraryGenres.map(g => <option key={g} value={g}>{g === 'All' ? 'Konuya göre ara' : g}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <div className="flex gap-4">
                                                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 min-w-[120px]">
                                                    <h4 className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Aktif Ödünçler</h4>
                                                    <p className="text-2xl font-bold text-[#E85B5B] dark:text-red-400">{myLoans.filter(l => l.status === 'Active').length}</p>
                                                </div>
                                                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 min-w-[120px]">
                                                    <h4 className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">İade Edilen</h4>
                                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{myLoans.filter(l => l.status === 'Returned').length}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-4">
                                                <button 
                                                    onClick={() => setHideReturned(!hideReturned)}
                                                    className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors outline-none"
                                                >
                                                    {hideReturned ? <CheckSquare className="text-[#E85B5B]" size={18}/> : <Square size={18}/>}
                                                    İade edilenleri gizle
                                                </button>

                                                <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-4">
                                                    <Layers size={14} className="text-gray-500" />
                                                    <select className="bg-transparent text-sm text-gray-700 dark:text-gray-200 outline-none font-medium cursor-pointer" value={loanSort} onChange={(e) => setLoanSort(e.target.value)}>
                                                        <option value="newest">En Yeniler</option>
                                                        <option value="oldest">En Eskiler</option>
                                                        <option value="title_az">Kitap Adı (A-Z)</option>
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
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Kütüphane</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Kitap Adı</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Yazar</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Tür</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Veriliş / Teslim</th>
                                                        <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Durum</th>
                                                        <th className="px-6 py-4 text-center font-semibold text-xs uppercase tracking-wider">İşlemler</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                    {displayLoans.map((loan) => {
                                                        const details = getSafeBookDetails(loan);
                                                        const issueDate = new Date(loan.issue_date);
                                                        const dueDate = new Date(loan.due_date);
                                                        const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                                                        const isOverdue = diffDays < 0 && loan.status === 'Active';
                                                        
                                                        let statusText = "Kullanılıyor";
                                                        let statusColor = "bg-[#FEF3C7] text-[#B45309] dark:bg-yellow-900/30 dark:text-yellow-500";
                                                        if (loan.status === 'Returned') {
                                                            statusText = "İade Edildi";
                                                            statusColor = "bg-[#E6F4EA] text-[#059669] dark:bg-green-900/30 dark:text-green-400";
                                                        } else if (isOverdue) {
                                                            statusText = "Gecikti";
                                                            statusColor = "bg-[#FCE7F3] text-[#DB2777] dark:bg-pink-900/30 dark:text-pink-400";
                                                        }

                                                        return (
                                                            <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group relative">
                                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">Merkez Şube</td>
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
                                                const isOverdue = diffDays < 0 && loan.status === 'Active';

                                                let statusText = "Kullanılıyor";
                                                let statusColor = "bg-[#FEF3C7] text-[#B45309] dark:bg-yellow-900/30 dark:text-yellow-500";
                                                if (loan.status === 'Returned') {
                                                    statusText = "İade Edildi";
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
                                                            {details.cover_url && <img src={details.cover_url} alt={details.title} className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.target.style.display = 'none'; }}/>}
                                                            <svg className="absolute inset-0 w-full h-full text-gray-300 dark:text-gray-600 z-0" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"/><line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1"/></svg>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-0.5 truncate" title={details.title}>{details.title}</h3>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 truncate">{details.author}</p>
                                                            
                                                            <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-[10px] text-gray-500 dark:text-gray-400 mb-2 border border-gray-100 dark:border-gray-700">
                                                                <div className="flex justify-between mb-1">
                                                                    <span>Alış:</span> <span className="font-medium">{new Date(loan.issue_date).toLocaleDateString()}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Teslim:</span> <span className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>{dueDate.toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {displayLoans.length === 0 && <div className="p-10 text-center text-gray-400 dark:text-gray-500">Kayıt bulunamadı.</div>}
                                </div>
                            )}

                            {/* === TAB 3: STATISTICS === */}
                            {activeTab === 'stats' && (
                                <div className="p-8 space-y-8">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Okuma İstatistiklerim</h3>
                                        <select className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 text-sm px-4 py-2 rounded-lg outline-none cursor-pointer focus:border-[#E85B5B]" value={timeFrame} onChange={(e) => setTimeFrame(e.target.value)}>
                                            <option value="all">Tüm Zamanlar</option>
                                            <option value="year">Bu Yıl</option>
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
                                                <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">Favori Tür</p>
                                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate max-w-[120px]">{stats.favoriteGenre}</h3>
                                            </div>
                                            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center"><Award className="text-purple-500 dark:text-purple-400" size={24} /></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center">
                                            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-6 text-sm self-start">Tür Dağılımı</h3>
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
                                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700"><h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Okuma Geçmişi</h3></div>
                                            <div className="divide-y divide-gray-50 dark:divide-gray-700 flex-1 overflow-y-auto max-h-[400px]">
                                                {stats.readBooks.length > 0 ? stats.readBooks.map((book) => (
                                                    <div key={book.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-gray-700 dark:text-gray-200 text-sm">{book.book_title}</h4>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Yazar: {book.author}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-xs font-bold text-green-600 dark:text-green-400">{book.page_count} sayfa</span>
                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">İade: {new Date(book.return_date).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="p-10 text-center text-gray-400 text-sm flex h-full items-center justify-center">Bu dönemde okunan kitap yok.</div>
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
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Kitap Detayları">
                {selectedBook && (
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            {/* Left: Book Cover Placeholder */}
                            <div className="w-32 h-44 border border-gray-200 dark:border-gray-700 rounded-lg flex-shrink-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden">
                                {selectedBook.cover_url && (
                                    <img src={selectedBook.cover_url} alt={selectedBook.title} className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.target.style.display = 'none'; }} />
                                )}
                                <svg className="absolute inset-0 w-full h-full text-gray-300 dark:text-gray-600 z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"/>
                                    <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1"/>
                                </svg>
                            </div>
                            
                            {/* Right: Book Details */}
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 mb-1">{selectedBook.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Yazar: <span className="font-medium text-gray-900 dark:text-white">{selectedBook.author}</span></p>
                                
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <p className="flex justify-between"><span>Tür:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.genre || "-"}</span></p>
                                    <p className="flex justify-between"><span>Sayfa:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.page_count || "-"}</span></p>
                                    <p className="flex justify-between"><span>Yayınevi:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.publisher || "-"}</span></p>
                                    <p className="flex justify-between"><span>ISBN:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedBook.isbn || "-"}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Additional Info for Library Items */}
                        {selectedBook.isLibraryItem && (
                            <div className="bg-[#E0E7FF] dark:bg-indigo-900/30 text-[#4338CA] dark:text-indigo-300 p-3 rounded-lg text-sm border border-[#BFDBFE] dark:border-indigo-800">
                                <div className="flex justify-between font-bold mb-1">
                                    <span>Durum: {selectedBook.status === 'Active' ? 'Aktif Ödünç' : 'İade Edildi'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span>Veriliş: {new Date(selectedBook.issue_date).toLocaleDateString()}</span>
                                    {selectedBook.status === 'Active' && <span>Teslim: {new Date(selectedBook.due_date).toLocaleDateString()}</span>}
                                </div>
                            </div>
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