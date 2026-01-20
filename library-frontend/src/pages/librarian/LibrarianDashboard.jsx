import { useEffect, useState, useContext, Fragment } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Repeat, Bell, Plus, Search, CheckCircle, XCircle, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, Edit2, Trash2, Settings, School, Clock, User, Calendar, Undo2, AlertTriangle, Filter, Layers } from 'lucide-react';
import Modal from '../../components/Modal';

const LibrarianDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // UI State
    const [activeTab, setActiveTab] = useState('inventory');
    const [expandedBookId, setExpandedBookId] = useState(null);
    
    // Sorting & Filtering State
    const [loanSortConfig, setLoanSortConfig] = useState('newest'); 
    const [bookSortConfig, setBookSortConfig] = useState('title_az'); // 'title_az', 'copies_desc', 'copies_asc'
    const [selectedGenre, setSelectedGenre] = useState('All');

    // Data State
    const [books, setBooks] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loans, setLoans] = useState([]);

    // Forms
    const [loanForm, setLoanForm] = useState({ student_id: '', book_copy_id: '', due_date: '' });
    
    // Book & Copy Forms

    const [bookForm, setBookForm] = useState({ 
        title: '', author: '', isbn: '', publisher: '', publication_year: '', genre: '', page_count: '' 
    });
    
    const [selectedBookId, setSelectedBookId] = useState(null);
    const [copyForm, setCopyForm] = useState({ quantity: 1, condition: 'New', status: 'Available' });
    const [selectedCopyId, setSelectedCopyId] = useState(null);
    const [targetBookId, setTargetBookId] = useState(null);

    // Date Update State
    const [editDateId, setEditDateId] = useState(null);
    const [newDueDate, setNewDueDate] = useState('');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selectedResId, setSelectedResId] = useState(null);

    // --- FETCH DATA ---
    useEffect(() => {
        if (activeTab === 'inventory') fetchBooks();
        if (activeTab === 'circulation') {
            fetchLoans();
            fetchReservations();
        }
    }, [activeTab]);

    const fetchBooks = async () => { try { const res = await api.get('/books'); setBooks(res.data); } catch (err) { console.error(err); } };
    const fetchLoans = async () => { try { const res = await api.get('/loans'); setLoans(res.data); } catch (err) { console.error(err); } };
    const fetchReservations = async () => { try { const res = await api.get('/reservations'); setReservations(res.data); } catch (err) { console.error(err); } };

    // --- LOGIC: LOAN SORTING ---
    const getSortedLoans = () => {
        const sorted = [...loans];
        const getDate = (d) => new Date(d).getTime();
        switch (loanSortConfig) {
            case 'newest': return sorted.sort((a, b) => getDate(b.issue_date) - getDate(a.issue_date));
            case 'due_soon': return sorted.sort((a, b) => getDate(a.due_date) - getDate(b.due_date));
            case 'student_az': return sorted.sort((a, b) => (a.student?.name || "").localeCompare(b.student?.name || ""));
            case 'title_az': return sorted.sort((a, b) => (a.book_copy?.book?.title || "").localeCompare(b.book_copy?.book?.title || ""));
            default: return sorted;
        }
    };
    const sortedLoans = getSortedLoans();
    const overdueCount = loans.filter(l => new Date(l.due_date) < new Date()).length;

    // --- LOGIC: BOOK SORTING & FILTERING ---
    
    const uniqueGenres = ['All', ...new Set(books.map(b => b.genre).filter(Boolean))];

    const getProcessedBooks = () => {
        let result = [...books];

        if (selectedGenre !== 'All') {
            result = result.filter(b => b.genre === selectedGenre);
        }

        switch (bookSortConfig) {
            case 'title_az': 
                return result.sort((a, b) => a.title.localeCompare(b.title));
            case 'copies_desc': // Most copies first
                return result.sort((a, b) => (b.copies?.length || 0) - (a.copies?.length || 0));
            case 'copies_asc': // Fewest copies first
                return result.sort((a, b) => (a.copies?.length || 0) - (b.copies?.length || 0));
            default: return result;
        }
    };
    const processedBooks = getProcessedBooks();


    // --- HANDLERS ---
    const handleLoan = async (e) => {
        e.preventDefault();
        try {
            await api.post('/loan', { 
                student_id: parseInt(loanForm.student_id), 
                book_copy_id: parseInt(loanForm.book_copy_id),
                due_date: loanForm.due_date
            });
            alert("Book Issued! 📖"); 
            setLoanForm({ student_id: '', book_copy_id: '', due_date: '' }); 
            fetchLoans();
        } catch (err) { alert("Loan failed: " + (err.response?.data?.error || "Error")); }
    };

    const handleUpdateDate = async (loanId) => {
        if(!newDueDate) return;
        try {
            await api.put(`/loans/${loanId}`, { due_date: newDueDate });
            alert("Date Updated"); setEditDateId(null); fetchLoans();
        } catch(err) { alert("Update failed"); }
    };

    const handleQuickReturn = async (copyId) => {
        if (!window.confirm(`Mark Copy #${copyId} as returned?`)) return;
        try { await api.post(`/return/${copyId}`); fetchLoans(); } catch (err) { alert("Return failed"); }
    };

    const handleReservationAction = async (id, actionWord) => {
        try { await api.post(`/reservation/${id}`, { action: actionWord }); fetchReservations(); } catch (err) { alert("Action failed"); }
    };

    const handleIssueReservation = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/reservation/${selectedResId}/issue`, { due_date: loanForm.due_date });
            alert("Reservation Converted to Loan! ✅"); setIsModalOpen(false); fetchReservations(); fetchLoans();
        } catch (err) { alert("Failed to issue book"); }
    };

    const pendingReservations = reservations.filter(r => r.status === 'Pending');
    const approvedReservations = reservations.filter(r => r.status === 'Approved');

    // --- INVENTORY HANDLERS ---
    const toggleRow = (id) => setExpandedBookId(expandedBookId === id ? null : id);
    
    const handleBookSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { 
                ...bookForm, 
                publication_year: parseInt(bookForm.publication_year),
                page_count: parseInt(bookForm.page_count)
            };
            if (modalType === 'add_book') await api.post('/books', payload);
            else await api.put(`/books/${selectedBookId}`, payload);
            setIsModalOpen(false); fetchBooks();
        } catch (err) { alert("Operation failed"); }
    };

    const handleDeleteBook = async (id) => {
        if (!window.confirm("Delete book?")) return;
        try { await api.delete(`/books/${id}`); fetchBooks(); } catch (err) { alert("Delete failed"); }
    };

    const openEditBook = (book) => {
        setModalType('edit_book'); setSelectedBookId(book.id);
        setBookForm({ 
            title: book.title, author: book.author, isbn: book.isbn||'', 
            publisher: book.publisher||'', publication_year: book.publication_year||'',
            genre: book.genre||'', page_count: book.page_count||''
        });
        setIsModalOpen(true);
    };

    const openAddCopy = (bookId) => { setModalType('add_copy'); setTargetBookId(bookId); setCopyForm({ quantity: 1, condition: 'New', status: 'Available' }); setIsModalOpen(true); };
    const openEditCopy = (copy) => { setModalType('edit_copy'); setSelectedCopyId(copy.id); setCopyForm({ quantity: 1, condition: copy.condition, status: copy.status }); setIsModalOpen(true); };
    const handleCopySubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalType === 'add_copy') await api.post('/books/copy', { book_id: targetBookId, quantity: parseInt(copyForm.quantity), condition: copyForm.condition });
            else await api.put(`/copy/${selectedCopyId}`, { condition: copyForm.condition, status: copyForm.status });
            setIsModalOpen(false); fetchBooks();
        } catch (err) { alert("Operation failed"); }
    };
    const handleDeleteCopy = async (id) => { if (!window.confirm("Delete copy?")) return; try { await api.delete(`/copy/${id}`); fetchBooks(); } catch (err) { alert("Delete failed"); } };
    const handleLogout = () => { logout(); navigate('/login'); };
    const formatDate = (dateString) => { if (!dateString) return "N/A"; return new Date(dateString).toLocaleDateString(); };
    const isOverdue = (dateString) => { return new Date(dateString) < new Date(); };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Navbar */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BookOpen className="text-indigo-600" /> Librarian Dashboard</h1>
                    <div className="hidden md:block text-right">
                        <div className="text-sm font-bold text-gray-800 flex items-center justify-end gap-1"><School size={14} className="text-indigo-500" />{user?.librarian?.school?.name || "School"}</div>
                        <div className="text-xs text-gray-500">{user?.librarian?.branch?.name || "Branch"} • ID: {user?.librarian?.branch_id}</div>
                    </div>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 flex items-center gap-2 text-sm font-medium"><LogOut size={18} /> Logout</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-6xl mx-auto px-4 mt-8">
                <div className="flex space-x-4 border-b border-gray-200 mb-6">
                    <button onClick={() => setActiveTab('inventory')} className={`pb-3 px-2 font-medium ${activeTab === 'inventory' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}>Inventory</button>
                    <button onClick={() => setActiveTab('circulation')} className={`pb-3 px-2 font-medium ${activeTab === 'circulation' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}>Circulation</button>
                </div>

                {/* === INVENTORY TAB === */}
                {activeTab === 'inventory' && (
                    <div>
                         {/* Header & Controls */}
                         <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                            <h2 className="text-2xl font-bold text-gray-800">Book Catalog</h2>
                            
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Genre Filter */}
                                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                    <Filter size={16} className="text-gray-400" />
                                    <select className="text-sm border-none bg-transparent outline-none" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                                        {uniqueGenres.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>

                                {/* Sort Order */}
                                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                    <Layers size={16} className="text-gray-400" />
                                    <select className="text-sm border-none bg-transparent outline-none" value={bookSortConfig} onChange={(e) => setBookSortConfig(e.target.value)}>
                                        <option value="title_az">Title (A-Z)</option>
                                        <option value="copies_desc">Copies (High-Low)</option>
                                        <option value="copies_asc">Copies (Low-High)</option>
                                    </select>
                                </div>

                                <button onClick={() => { setModalType('add_book'); setBookForm({ title: '', author: '', isbn: '', publisher: '', publication_year: '', genre: '', page_count: '' }); setIsModalOpen(true); }}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                                    <Plus size={20} /> Add Book
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="w-10 px-4 py-3"></th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Author</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Genre</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Copies</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {processedBooks.map((book) => (
                                        <Fragment key={book.id}>
                                            <tr className={`hover:bg-gray-50 transition-colors ${expandedBookId === book.id ? 'bg-indigo-50' : ''}`}>
                                                <td className="px-4 py-4 text-center">
                                                    <button onClick={() => toggleRow(book.id)} className="text-gray-400 hover:text-indigo-600">
                                                        {expandedBookId === book.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {book.title}
                                                    <div className="text-xs text-gray-400 font-normal">{book.page_count ? `${book.page_count} pages` : ''}</div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{book.author}</td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {book.genre ? <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{book.genre}</span> : '-'}
                                                </td>
                                                <td className="px-6 py-4"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{book.copies?.length || 0}</span></td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => openEditBook(book)} className="text-gray-400 hover:text-indigo-600 p-1"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDeleteBook(book.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                            {expandedBookId === book.id && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan="6" className="px-6 py-4 shadow-inner">
                                                        {/* Copies Grid  */}
                                                        <div className="flex justify-between items-center mb-3">
                                                            <h4 className="text-sm font-bold text-gray-700 uppercase">Physical Copies</h4>
                                                            <button onClick={() => openAddCopy(book.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center gap-1"><Plus size={14} /> Add Copies</button>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            {book.copies?.map(copy => (
                                                                <div key={copy.id} className="bg-white border border-gray-200 rounded p-3 flex justify-between items-center shadow-sm">
                                                                    <div>
                                                                        <span className="block text-xs font-mono text-gray-400">ID #{copy.id}</span>
                                                                        <div className="flex gap-2 mt-1">
                                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${copy.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{copy.status}</span>
                                                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{copy.condition}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => openEditCopy(copy)} className="text-gray-300 hover:text-blue-500 p-1"><Settings size={14} /></button>
                                                                        <button onClick={() => handleDeleteCopy(copy.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* === CIRCULATION TAB === */}
                {activeTab === 'circulation' && (
                    <div className="space-y-8">
                        {/* 1. ISSUE FORM */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ArrowRight className="text-indigo-600" /> Issue Book (Direct Loan)</h3>
                            <form onSubmit={handleLoan} className="flex flex-wrap gap-2 items-center">
                                <input type="number" placeholder="Student ID" className="w-32 border p-2 rounded" value={loanForm.student_id} onChange={e => setLoanForm({ ...loanForm, student_id: e.target.value })} required />
                                <input type="number" placeholder="Copy ID" className="w-32 border p-2 rounded" value={loanForm.book_copy_id} onChange={e => setLoanForm({ ...loanForm, book_copy_id: e.target.value })} required />
                                <div className="flex items-center gap-1 border p-1 rounded bg-gray-50">
                                    <span className="text-xs text-gray-500 px-1">Due:</span>
                                    <input type="date" className="bg-transparent text-sm outline-none" value={loanForm.due_date} onChange={e => setLoanForm({ ...loanForm, due_date: e.target.value })} />
                                </div>
                                <button className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700">Issue</button>
                            </form>
                        </div>

                        {/* 2. ACTIVE LOANS */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {overdueCount > 0 && (
                                <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex items-center gap-3 text-red-700 animate-pulse">
                                    <AlertTriangle size={20} />
                                    <span className="font-bold">Attention!</span> 
                                    <span className="text-sm">You have <span className="font-bold underline">{overdueCount} overdue books</span> that need to be returned.</span>
                                </div>
                            )}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={18} className="text-blue-600"/> Active Loans</h3>
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-gray-400" />
                                    <span className="text-xs font-medium text-gray-600">Sort by:</span>
                                    <select className="text-sm border-none bg-transparent font-medium text-indigo-600 focus:ring-0 cursor-pointer" value={loanSortConfig} onChange={(e) => setLoanSortConfig(e.target.value)}>
                                        <option value="newest">Issue Date (Newest)</option>
                                        <option value="due_soon">Due Date (Urgent First)</option>
                                        <option value="student_az">Student Name (A-Z)</option>
                                        <option value="title_az">Book Title (A-Z)</option>
                                    </select>
                                </div>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500"><tr><th className="px-6 py-3">Details</th><th className="px-6 py-3">Student</th><th className="px-6 py-3">Issue Date</th><th className="px-6 py-3">Due Date</th><th className="px-6 py-3 text-right">Action</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedLoans.map(loan => {
                                        const overdue = isOverdue(loan.due_date);
                                        return (
                                            <tr key={loan.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50/50' : ''}`}>
                                                <td className="px-6 py-3">
                                                    <div className="font-medium">{loan.book_copy?.book?.title}</div>
                                                    <div className="text-xs text-gray-500">Copy #{loan.book_copy_id}</div>
                                                </td>
                                                <td className="px-6 py-3">{loan.student?.name} <span className="text-xs text-gray-400">({loan.student_id})</span></td>
                                                <td className="px-6 py-3 text-gray-600">{formatDate(loan.issue_date)}</td>
                                                <td className="px-6 py-3">
                                                    {editDateId === loan.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <input type="date" className="border text-xs p-1 rounded w-32" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                                                            <button onClick={() => handleUpdateDate(loan.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Save</button>
                                                            <button onClick={() => setEditDateId(null)} className="text-gray-400 px-1 hover:text-gray-600">✕</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className={`font-bold cursor-pointer group flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-gray-700'}`} onClick={() => { setEditDateId(loan.id); setNewDueDate(loan.due_date ? loan.due_date.split('T')[0] : ''); }}>
                                                                {formatDate(loan.due_date)}
                                                                {overdue && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded uppercase ml-1">Late</span>}
                                                                <Edit2 size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 ml-1"/>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button onClick={() => handleQuickReturn(loan.book_copy_id)} className="bg-green-100 text-green-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-200 flex items-center gap-1 ml-auto">
                                                        <Undo2 size={14} /> Return
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. RESERVATION REQUESTS */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-200"><h3 className="font-bold text-yellow-800 flex items-center gap-2"><Bell size={18}/> 1. Reservation Requests</h3></div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500"><tr><th className="px-6 py-3">Book</th><th className="px-6 py-3">Student</th><th className="px-6 py-3 text-right">Decision</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pendingReservations.map(res => (
                                        <tr key={res.id}>
                                            <td className="px-6 py-3 font-medium">{res.book_copy?.book?.title}</td>
                                            <td className="px-6 py-3">{res.student?.name}</td>
                                            <td className="px-6 py-3 text-right flex justify-end gap-2">
                                                <button onClick={() => handleReservationAction(res.id, 'Approved')} className="bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 flex items-center gap-1"><CheckCircle size={14}/> Approve</button>
                                                <button onClick={() => handleReservationAction(res.id, 'Rejected')} className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1"><XCircle size={14}/> Reject</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 4. APPROVED RESERVATIONS */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-blue-50 px-6 py-4 border-b border-blue-200"><h3 className="font-bold text-blue-800 flex items-center gap-2"><Calendar size={18}/> 2. Ready for Pickup</h3></div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500"><tr><th className="px-6 py-3">Book</th><th className="px-6 py-3">Student</th><th className="px-6 py-3 text-right">Action</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {approvedReservations.map(res => (
                                        <tr key={res.id}>
                                            <td className="px-6 py-3">
                                                <div className="font-medium">{res.book_copy?.book?.title}</div>
                                                <div className="text-xs text-gray-500">Reserved Copy #{res.book_copy_id}</div>
                                            </td>
                                            <td className="px-6 py-3">{res.student?.name}</td>
                                            <td className="px-6 py-3 text-right flex justify-end gap-2">
                                                <button onClick={() => handleReservationAction(res.id, 'Rejected')} className="border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-100">Cancel</button>
                                                <button onClick={() => { setSelectedResId(res.id); setModalType('issue_res'); setIsModalOpen(true); }} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1">
                                                    <ArrowRight size={14}/> Issue Loan
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL for Issuing Reservation */}
            <Modal isOpen={isModalOpen && modalType === 'issue_res'} onClose={() => setIsModalOpen(false)} title="Confirm Loan Issue">
                <form onSubmit={handleIssueReservation} className="space-y-4">
                    <p className="text-gray-600 text-sm">You are converting this reservation into an active loan. Please set the due date.</p>
                    <div>
                        <label className="block text-sm font-medium mb-1">Due Date</label>
                        <input type="date" className="w-full border p-2 rounded" required value={loanForm.due_date} onChange={e => setLoanForm({...loanForm, due_date: e.target.value})} />
                    </div>
                    <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Confirm & Issue Book</button>
                </form>
            </Modal>

            {/* Book/Copy Modals */}
            <Modal isOpen={isModalOpen && modalType !== 'issue_res'} onClose={() => setIsModalOpen(false)} title={modalType.replace('_', ' ')}>
                {/* Book Form */}
                {(modalType.includes('book')) && (
                    <form onSubmit={handleBookSubmit} className="space-y-4">
                        <input type="text" placeholder="Title" className="w-full border p-2 rounded" value={bookForm.title} onChange={e => setBookForm({ ...bookForm, title: e.target.value })} required />
                        <input type="text" placeholder="Author" className="w-full border p-2 rounded" value={bookForm.author} onChange={e => setBookForm({ ...bookForm, author: e.target.value })} required />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="ISBN" className="w-full border p-2 rounded" value={bookForm.isbn} onChange={e => setBookForm({ ...bookForm, isbn: e.target.value })} />
                            <input type="number" placeholder="Year" className="w-full border p-2 rounded" value={bookForm.publication_year} onChange={e => setBookForm({ ...bookForm, publication_year: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Genre" className="w-full border p-2 rounded" value={bookForm.genre} onChange={e => setBookForm({ ...bookForm, genre: e.target.value })} />
                            <input type="number" placeholder="Pages" className="w-full border p-2 rounded" value={bookForm.page_count} onChange={e => setBookForm({ ...bookForm, page_count: e.target.value })} />
                        </div>
                        <input type="text" placeholder="Publisher" className="w-full border p-2 rounded" value={bookForm.publisher} onChange={e => setBookForm({ ...bookForm, publisher: e.target.value })} />
                        <button className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Save Book</button>
                    </form>
                )}
                {/* Copy Form */}
                {(modalType.includes('copy')) && (
                    <form onSubmit={handleCopySubmit} className="space-y-4">
                        {modalType === 'add_copy' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity</label>
                                <input type="number" min="1" className="w-full border p-2 rounded" value={copyForm.quantity} onChange={e => setCopyForm({ ...copyForm, quantity: e.target.value })} required />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1">Condition</label>
                            <select className="w-full border p-2 rounded" value={copyForm.condition} onChange={e => setCopyForm({ ...copyForm, condition: e.target.value })}>
                                <option value="New">New</option><option value="Good">Good</option><option value="Fair">Fair</option><option value="Poor">Poor</option>
                            </select>
                        </div>
                        {modalType === 'edit_copy' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select className="w-full border p-2 rounded" value={copyForm.status} onChange={e => setCopyForm({ ...copyForm, status: e.target.value })}>
                                    <option value="Available">Available</option><option value="Loaned">Loaned</option><option value="Reserved">Reserved</option><option value="Lost">Lost</option><option value="Maintenance">Maintenance</option>
                                </select>
                            </div>
                        )}
                        <button className="w-full bg-green-600 text-white py-2 rounded font-bold">Save Copy</button>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default LibrarianDashboard;