import { useEffect, useState, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Book, Calendar, Clock, Bookmark, Filter, Layers, User, BarChart2, BookOpen, PieChart, Award } from 'lucide-react';

const StudentDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // UI State
    const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'mylibrary' | 'stats'
    const [loading, setLoading] = useState(true);

    // Data State
    const [books, setBooks] = useState([]);
    const [myLoans, setMyLoans] = useState([]);

    // Filters & Sorting State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [bookSort, setBookSort] = useState('title_az');
    const [loanFilter, setLoanFilter] = useState('All');
    const [loanSort, setLoanSort] = useState('newest');
    
    // Statistics State
    const [timeFrame, setTimeFrame] = useState('all'); // 'all', 'year', 'month'

    // --- 1. FETCH DATA ---
    useEffect(() => {
        const fetchData = async () => {
            await fetchCatalog();
            if (user && user.id) await fetchMyLibrary();
            setLoading(false);
        };
        fetchData();
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
            alert("Sorry, no copies are currently available for reservation.");
            return;
        }
        if(!window.confirm(`Reserve a copy of "${book.title}"?`)) return;

        try {
            await api.post('/reservation', {
                student_id: parseInt(user.id),
                book_copy_id: availableCopy.id
            });
            alert("Reservation Request Sent! 📩");
            fetchCatalog(); 
        } catch (err) {
            alert("Reservation failed: " + (err.response?.data?.error || "Unknown error"));
        }
    };

    const handleLogout = () => { logout(); navigate('/login'); };

    // --- 3. FILTERING LOGIC (CATALOG & LIBRARY) ---

    // Unique Genres for Dropdown
    const uniqueGenres = ['All', ...new Set(books.map(b => b.genre).filter(Boolean))];

    // Filtered Catalog
    const getFilteredCatalog = () => {
        let result = books;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(b => 
                b.title?.toLowerCase().includes(q) || 
                b.author?.toLowerCase().includes(q) ||
                b.genre?.toLowerCase().includes(q)
            );
        }
        if (selectedGenre !== 'All') {
            result = result.filter(b => b.genre === selectedGenre);
        }
        return result.sort((a, b) => {
            if (bookSort === 'title_az') return a.title.localeCompare(b.title);
            if (bookSort === 'author_az') return a.author.localeCompare(b.author);
            return 0;
        });
    };

    // Filtered Loans
    const getFilteredLoans = () => {
        let result = myLoans;
        if (loanFilter === 'Active') result = result.filter(l => l.status === 'Active');
        if (loanFilter === 'Returned') result = result.filter(l => l.status === 'Returned');
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

    // Helper to safely get book details
    const getSafeBookDetails = (loan) => {
        if (loan.book_title) return { title: loan.book_title, author: loan.author || "Unknown" };
        const copy = loan.book_copy || loan.BookCopy || {};
        const book = copy.book || copy.Book || {};
        return { 
            title: book.title || book.Title || "Unknown Book", 
            author: book.author || book.Author || "Unknown Author" 
        };
    };

    // --- 4. STATISTICS LOGIC (NEW) ---
    const getFilteredStats = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Filter Loans by Timeframe & Status="Returned"
        const readBooks = myLoans.filter(loan => {
            // Note: Depending on backend, status might be 'Returned' or check return_date
            if (loan.status !== 'Returned') return false; 
            
            // Safety check for date
            if (!loan.return_date) return false; 
            
            const rDate = new Date(loan.return_date);
            if (timeFrame === 'year' && rDate.getFullYear() !== currentYear) return false;
            if (timeFrame === 'month' && (rDate.getFullYear() !== currentYear || rDate.getMonth() !== currentMonth)) return false;
            
            return true;
        });

        const totalBooks = readBooks.length;
        const totalPages = readBooks.reduce((sum, book) => sum + (book.page_count || 0), 0);
        
        // Genre Calculation
        const genreCounts = {};
        readBooks.forEach(b => {
            const g = b.genre || "Other";
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });

        // Convert to array for Pie Chart
        const genreData = Object.keys(genreCounts).map(key => ({
            name: key,
            count: genreCounts[key],
            percent: totalBooks > 0 ? ((genreCounts[key] / totalBooks) * 100).toFixed(1) : 0
        })).sort((a, b) => b.count - a.count);

        const favoriteGenre = genreData.length > 0 ? genreData[0].name : "None yet";

        return { readBooks, totalBooks, totalPages, genreData, favoriteGenre };
    };

    const stats = getFilteredStats();

    // Helper: Pie Chart Gradient Generator
    const getConicGradient = (data) => {
        if (!data.length) return 'gray';
        let gradient = 'conic-gradient(';
        let currentDeg = 0;
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
        
        data.forEach((item, index) => {
            const deg = (item.count / stats.totalBooks) * 360;
            const color = colors[index % colors.length];
            gradient += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `;
            currentDeg += deg;
        });
        return gradient.slice(0, -2) + ')';
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading Library...</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Navbar */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Book className="text-blue-600" /> Student Portal
                        </h1>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 hidden sm:block">Welcome, {user?.name}</span>
                            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 flex items-center gap-2 text-sm font-medium">
                                <LogOut size={18} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 mt-8">
                
                {/* Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
                        <button onClick={() => setActiveTab('catalog')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'catalog' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>Browse Catalog</button>
                        <button onClick={() => setActiveTab('mylibrary')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'mylibrary' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>My Library</button>
                        <button onClick={() => setActiveTab('stats')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>My Statistics</button>
                    </div>
                </div>

                {/* === VIEW 1: CATALOG === */}
                {activeTab === 'catalog' && (
                    <div className="space-y-6">
                        {/* Search & Filter Bar */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            {/* Search */}
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search by title, author, genre..." 
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={searchQuery} 
                                    onChange={(e) => setSearchQuery(e.target.value)} 
                                />
                            </div>

                            {/* Filters */}
                            <div className="flex gap-3 w-full md:w-auto overflow-x-auto">
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <Filter size={16} className="text-gray-500" />
                                    <select className="bg-transparent text-sm text-gray-700 outline-none" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                                        {uniqueGenres.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <Layers size={16} className="text-gray-500" />
                                    <select className="bg-transparent text-sm text-gray-700 outline-none" value={bookSort} onChange={(e) => setBookSort(e.target.value)}>
                                        <option value="title_az">Title (A-Z)</option>
                                        <option value="author_az">Author (A-Z)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Books Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayBooks.map((book) => {
                                const availableCount = book.copies ? book.copies.filter(c => c.status === 'Available').length : 0;
                                const isAvailable = availableCount > 0;
                                return (
                                    <div key={book.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-bold text-gray-800 leading-tight">{book.title}</h3>
                                                <span className={`text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {isAvailable ? `${availableCount} Available` : 'Out of Stock'}
                                                </span>
                                            </div>
                                            <p className="text-gray-500 text-sm mb-2">by {book.author}</p>
                                            {book.genre && <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mb-4">{book.genre}</span>}
                                            <div className="text-xs text-gray-400 space-y-1 mb-4">
                                                <p>Publisher: {book.publisher || 'N/A'}</p>
                                                <p>Year: {book.publication_year || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleReserve(book)} disabled={!isAvailable} className={`w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${isAvailable ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                            <Bookmark size={16} /> {isAvailable ? 'Reserve Copy' : 'Unavailable'}
                                        </button>
                                    </div>
                                );
                            })}
                            {displayBooks.length === 0 && <div className="col-span-full p-10 text-center text-gray-400">No books found matching your criteria.</div>}
                        </div>
                    </div>
                )}

                {/* === VIEW 2: MY LIBRARY === */}
                {activeTab === 'mylibrary' && (
                    <div className="space-y-8">
                        {/* Stats & Filter Bar */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="grid grid-cols-2 gap-4 flex-1">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <h4 className="text-blue-800 text-xs font-bold uppercase tracking-wider mb-1">Active</h4>
                                    <p className="text-2xl font-bold text-blue-900">{myLoans.filter(l => l.status === 'Active').length}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                    <h4 className="text-green-800 text-xs font-bold uppercase tracking-wider mb-1">Returned</h4>
                                    <p className="text-2xl font-bold text-green-900">{myLoans.filter(l => l.status === 'Returned').length}</p>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-center gap-3 min-w-[250px]">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center gap-1"><Filter size={14}/> Status:</span>
                                    <select className="bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none font-medium" value={loanFilter} onChange={(e) => setLoanFilter(e.target.value)}>
                                        <option value="All">All Loans</option>
                                        <option value="Active">Active Only</option>
                                        <option value="Returned">Returned</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center gap-1"><Layers size={14}/> Sort by:</span>
                                    <select className="bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none font-medium" value={loanSort} onChange={(e) => setLoanSort(e.target.value)}>
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="title_az">Title (A-Z)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Loan List */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50"><h3 className="font-bold text-gray-700">Loan History</h3></div>
                            <div className="divide-y divide-gray-100">
                                {displayLoans.map((loan) => {
                                    const details = getSafeBookDetails(loan);
                                    const dueDate = new Date(loan.due_date);
                                    const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                                    const isOverdue = diffDays < 0 && loan.status === 'Active';

                                    return (
                                        <div key={loan.id} className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4 hover:bg-gray-50">
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg">{details.title}</h4>
                                                <p className="text-sm text-gray-500 mb-2">Author: {details.author}</p>
                                                <div className="flex gap-4 text-xs text-gray-400 mt-2">
                                                    <span className="flex items-center gap-1"><Calendar size={14} /> Issued: {new Date(loan.issue_date).toLocaleDateString()}</span>
                                                    {loan.status === 'Active' && (
                                                        <span className={`flex items-center gap-1 font-bold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                                                            <Clock size={14} /> {isOverdue ? `Overdue by ${Math.abs(diffDays)} days` : `Due in ${diffDays} days`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${loan.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {loan.status || "Unknown Status"}
                                            </span>
                                        </div>
                                    );
                                })}
                                {displayLoans.length === 0 && <div className="p-10 text-center text-gray-400">No records found.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* === VIEW 3: STATISTICS (NEW) === */}
                {activeTab === 'stats' && (
                    <div className="space-y-6">
                        
                        {/* 1. Student Profile Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <User size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">{user?.name}</h2>
                                <div className="flex gap-4 text-sm text-gray-500 mt-1">
                                    <span>ID: <strong className="text-gray-700">{user?.id}</strong></span>
                                    <span>•</span>
                                    <span>Email: <strong className="text-gray-700">{user?.email}</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Controls & Metrics */}
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Reading Insights</h3>
                            <select className="bg-white border border-gray-200 text-sm p-2 rounded-lg outline-none cursor-pointer hover:border-gray-400 transition-colors" 
                                value={timeFrame} onChange={(e) => setTimeFrame(e.target.value)}>
                                <option value="all">All Time</option>
                                <option value="year">This Year</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-indigo-600 font-medium text-sm mb-1">Books Read</p>
                                        <h3 className="text-3xl font-bold text-indigo-900">{stats.totalBooks}</h3>
                                    </div>
                                    <BookOpen className="text-indigo-300" size={24} />
                                </div>
                            </div>
                            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-emerald-600 font-medium text-sm mb-1">Pages Read</p>
                                        <h3 className="text-3xl font-bold text-emerald-900">{stats.totalPages.toLocaleString()}</h3>
                                    </div>
                                    <BarChart2 className="text-emerald-300" size={24} />
                                </div>
                            </div>
                            <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-amber-600 font-medium text-sm mb-1">Favorite Genre</p>
                                        <h3 className="text-2xl font-bold text-amber-900 truncate max-w-[150px]">{stats.favoriteGenre}</h3>
                                    </div>
                                    <Award className="text-amber-300" size={24} />
                                </div>
                            </div>
                        </div>

                        {/* 3. Charts & History */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Genre Chart */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><PieChart size={18} /> Genre Distribution</h3>
                                {stats.totalBooks > 0 ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-48 h-48 rounded-full shadow-inner mb-6 relative" 
                                            style={{ background: getConicGradient(stats.genreData) }}>
                                            <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                                                <span className="text-2xl font-bold text-gray-700">{stats.totalBooks}</span>
                                                <span className="text-xs text-gray-400">Books</span>
                                            </div>
                                        </div>
                                        <div className="w-full space-y-2">
                                            {stats.genreData.map((g, i) => (
                                                <div key={g.name} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full" style={{ background: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6] }}></div>
                                                        <span className="text-gray-600">{g.name}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-800">{g.count} ({g.percent}%)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-gray-400 italic">No reading history yet.</div>
                                )}
                            </div>

                            {/* Reading History List */}
                            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50"><h3 className="font-bold text-gray-700">Detailed History</h3></div>
                                <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                                    {stats.readBooks.length > 0 ? stats.readBooks.map((book) => (
                                        <div key={book.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-sm">{book.book_title}</h4>
                                                <p className="text-xs text-gray-500">by {book.author}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-xs font-bold text-green-600">{book.page_count} pages</span>
                                                <span className="text-[10px] text-gray-400">Returned: {new Date(book.return_date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-10 text-center text-gray-400">No books read in this period.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;