import { useEffect, useState } from 'react';
import api from '../api/axios';
import Modal from './Modal';
import { useTranslation } from '../i18n/LanguageContext';
import { BookOpen, BarChart2, Clock } from 'lucide-react';

// Read-only reading overview for a single student, shown to librarians/managers.
// Fetches the same /student/:id/reading endpoint the student's own stats tab uses;
// the backend enforces that the caller may see this student.
const ReaderStatsModal = ({ studentId, studentName, isOpen, onClose }) => {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !studentId) return;
        setData(null);
        setLoading(true);
        api.get(`/student/${studentId}/reading`)
            .then(res => setData(res.data))
            .catch(err => console.error('Error fetching reader stats', err))
            .finally(() => setLoading(false));
    }, [isOpen, studentId]);

    const kpi = (label, value, Icon, accent) => (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
            </div>
            <Icon className={accent} size={22} />
        </div>
    );

    const activeBooks = (data?.books || []).filter(b => b.status_code !== 'RETURNED');
    const notes = (data?.logs || []).filter(l => l.note && l.note.trim());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${studentName || ''} · ${t('reader.title')}`} maxWidth="max-w-2xl">
            {loading && <div className="py-10 text-center text-gray-400 text-sm">…</div>}
            {!loading && data && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {kpi(t('stu.booksRead'), data.books_read, BookOpen, 'text-blue-500')}
                        {kpi(t('stu.pagesRead'), (data.pages_read || 0).toLocaleString(), BarChart2, 'text-green-500')}
                        {kpi(t('stu.readingSpeed'), `${data.reading_speed_ppd} ${t('stu.pagesPerDay')}`, Clock, 'text-[#1B9DD9]')}
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('stu.currentlyReading')}</h4>
                        {activeBooks.length === 0 ? (
                            <p className="text-xs text-gray-400 py-3">{t('reader.noBooks')}</p>
                        ) : (
                            <div className="space-y-3">
                                {activeBooks.map(b => (
                                    <div key={b.loan_id}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[65%]">{b.title}</span>
                                            <span className="text-gray-500 dark:text-gray-400">{b.current_page}/{b.page_count || '?'} {t('stu.pagesShort')} · {b.percent}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#1B9DD9] rounded-full" style={{ width: `${b.percent}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('reader.notes')}</h4>
                        {notes.length === 0 ? (
                            <p className="text-xs text-gray-400 py-3">{t('diary.noEntries')}</p>
                        ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto">
                                {[...notes].reverse().map(n => (
                                    <div key={n.id} className="flex justify-between items-start gap-3 text-xs bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                                        <div className="flex-1">
                                            <span className="font-bold text-gray-700 dark:text-gray-200">{t('diary.currentPage')}: {n.page}</span>
                                            <p className="text-gray-500 dark:text-gray-400 mt-0.5">{n.note}</p>
                                        </div>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ReaderStatsModal;
