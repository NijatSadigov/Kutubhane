import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

const LanguageSwitcher = () => {
    const { lang, setLang, languages } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const current = languages.find(l => l.code === lang) || languages[0];

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors outline-none text-sm"
                title="Dil / Language"
            >
                <Globe size={20} />
                <span className="hidden sm:inline font-medium uppercase">{current.code}</span>
                <ChevronDown size={14} />
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {languages.map(l => (
                        <button
                            key={l.code}
                            onClick={() => { setLang(l.code); setOpen(false); }}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${l.code === lang ? 'font-bold text-[#E85B5B]' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                            <span>{l.flag}</span> {l.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
