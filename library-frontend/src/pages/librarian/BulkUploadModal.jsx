import { useState } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { UploadCloud, FileText, CheckCircle, XCircle } from 'lucide-react';

// Minimal CSV parser: handles quoted fields (with embedded commas and "" escapes)
// and both \n and \r\n line endings. Good enough for librarian-exported spreadsheets.
function parseCSV(text) {
    const rows = [];
    let field = '', row = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
        else if (c === '\r') { /* ignore, handled by \n */ }
        else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

// Header aliases -> canonical field. Accepts Turkish and English column names.
const HEADER_MAP = {
    title: 'title', 'kitap adı': 'title', 'kitap adi': 'title', 'başlık': 'title', 'baslik': 'title',
    author: 'author', yazar: 'author',
    publisher: 'publisher', 'yayınevi': 'publisher', 'yayinevi': 'publisher',
    genre: 'genre', 'tür': 'genre', tur: 'genre',
    topic: 'topic', konu: 'topic',
    isbn: 'isbn',
    call_no: 'call_no', 'call no': 'call_no', 'yer no': 'call_no',
    language: 'language', dil: 'language',
    cefr_level: 'cefr_level', cefr: 'cefr_level', 'cefr seviyesi': 'cefr_level',
    publication_year: 'publication_year', 'yıl': 'publication_year', yil: 'publication_year', 'yayın yılı': 'publication_year',
    edition: 'edition', 'baskı': 'edition', baski: 'edition',
    page_count: 'page_count', 'sayfa': 'page_count', 'sayfa sayısı': 'page_count', 'sayfa sayisi': 'page_count',
};

// Category-typed columns and the endpoint that creates them.
const CATEGORY_FIELDS = {
    author: { endpoint: '/authors', idKey: 'author_id' },
    publisher: { endpoint: '/publishers', idKey: 'publisher_id' },
    genre: { endpoint: '/genres', idKey: 'genre_id' },
    topic: { endpoint: '/topics', idKey: 'topic_id' },
};

const TEMPLATE = 'title,author,publisher,genre,isbn,call_no,language,cefr_level,publication_year,page_count\n'
    + 'Örnek Kitap,Örnek Yazar,Örnek Yayınevi,Roman,978-000,CN-1,Türkçe,B1,2020,240\n';

const BulkUploadModal = ({ isOpen, onClose, categories, onComplete }) => {
    const [rawText, setRawText] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null); // { created, failures: [{row, error}] }

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setRawText(String(reader.result));
        reader.readAsText(file);
    };

    // Build name->id lookups from the categories already loaded, so we only create
    // what's genuinely new. Keys are lowercased for case-insensitive matching.
    const buildIndex = () => {
        const idx = {};
        for (const key of Object.keys(CATEGORY_FIELDS)) {
            const listKey = key === 'author' ? 'authors' : key === 'publisher' ? 'publishers' : key === 'genre' ? 'genres' : 'topics';
            idx[key] = new Map((categories[listKey] || []).map(c => [c.name.trim().toLowerCase(), c.id]));
        }
        return idx;
    };

    const resolveCategory = async (idx, key, name) => {
        const clean = name.trim();
        if (!clean) return null;
        const existing = idx[key].get(clean.toLowerCase());
        if (existing) return existing;
        // Create it once, then remember it for later rows.
        const res = await api.post(CATEGORY_FIELDS[key].endpoint, { name: clean });
        const newId = res.data?.id;
        idx[key].set(clean.toLowerCase(), newId);
        return newId;
    };

    const handleImport = async () => {
        const rows = parseCSV(rawText);
        if (rows.length < 2) { alert("En az bir başlık satırı ve bir veri satırı gerekli."); return; }

        const headers = rows[0].map(h => HEADER_MAP[h.trim().toLowerCase()] || null);
        if (!headers.includes('title')) { alert("CSV'de 'title' (Kitap Adı) sütunu bulunamadı."); return; }

        setBusy(true);
        const idx = buildIndex();
        const failures = [];
        let created = 0;

        for (let r = 1; r < rows.length; r++) {
            const cells = rows[r];
            const rec = {};
            headers.forEach((field, i) => { if (field) rec[field] = (cells[i] || '').trim(); });

            if (!rec.title) { failures.push({ row: r + 1, error: "Kitap adı boş" }); continue; }

            try {
                const payload = {
                    title: rec.title,
                    isbn: rec.isbn || '',
                    call_no: rec.call_no || '',
                    language: rec.language || '',
                    cefr_level: rec.cefr_level || '',
                    edition: rec.edition || '',
                    publication_year: rec.publication_year ? parseInt(rec.publication_year) : 0,
                    page_count: rec.page_count ? parseInt(rec.page_count) : 0,
                };
                for (const key of Object.keys(CATEGORY_FIELDS)) {
                    payload[CATEGORY_FIELDS[key].idKey] = rec[key] ? await resolveCategory(idx, key, rec[key]) : null;
                }
                await api.post('/books', payload);
                created++;
            } catch (err) {
                failures.push({ row: r + 1, error: err.response?.data?.error || err.message || "Bilinmeyen hata" });
            }
        }

        setBusy(false);
        setResult({ created, failures });
        if (created > 0) onComplete?.();
    };

    const close = () => { setRawText(''); setResult(null); onClose(); };

    const downloadTemplate = () => {
        const blob = new Blob([TEMPLATE], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'kitap-yukleme-sablonu.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title="Toplu Kitap Yükleme (CSV)" maxWidth="max-w-2xl">
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Kitap adı, yazar, tür gibi sütunları içeren bir CSV yükleyin. Yazar/yayınevi/tür/konu
                    isimleri otomatik eşleştirilir; sistemde yoksa oluşturulur. Kopyalar ayrıca eklenmelidir.
                </p>

                <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 bg-[#1B9DD9] text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-[#1580B5] transition-colors">
                        <UploadCloud size={16} /> CSV Dosyası Seç
                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                    </label>
                    <button onClick={downloadTemplate} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <FileText size={16} /> Şablon İndir
                    </button>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">CSV İçeriği (dosya seçince otomatik dolar, düzenleyebilirsiniz)</label>
                    <textarea
                        rows={8}
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded text-gray-900 dark:text-white font-mono text-xs"
                        placeholder="title,author,genre,isbn..."
                        value={rawText}
                        onChange={e => { setRawText(e.target.value); setResult(null); }}
                    />
                </div>

                {result && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold">
                            <CheckCircle size={16} /> {result.created} kitap eklendi
                        </div>
                        {result.failures.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
                                    <XCircle size={16} /> {result.failures.length} satır başarısız
                                </div>
                                <ul className="text-xs text-gray-500 dark:text-gray-400 max-h-32 overflow-y-auto list-disc pl-5">
                                    {result.failures.map((f, i) => <li key={i}>Satır {f.row}: {f.error}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={handleImport}
                    disabled={busy || !rawText.trim()}
                    className="w-full bg-[#1E5631] hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-bold transition-colors"
                >
                    {busy ? 'Yükleniyor...' : 'İçe Aktar'}
                </button>
            </div>
        </Modal>
    );
};

export default BulkUploadModal;
