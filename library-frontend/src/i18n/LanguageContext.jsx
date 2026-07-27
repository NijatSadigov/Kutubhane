import { createContext, useContext, useState, useCallback } from 'react';
import { translations, LANGUAGES } from './translations';

const LanguageContext = createContext();

const DEFAULT_LANG = 'tr';

export const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(() => {
        const saved = localStorage.getItem('lang');
        return translations[saved] ? saved : DEFAULT_LANG;
    });

    const setLang = useCallback((code) => {
        if (!translations[code]) return;
        setLangState(code);
        localStorage.setItem('lang', code);
    }, []);

    // t(key, vars?) — falls back to Turkish then the raw key, and does simple
    // {placeholder} interpolation from an optional vars object.
    const t = useCallback((key, vars) => {
        let str = translations[lang]?.[key] ?? translations[DEFAULT_LANG]?.[key] ?? key;
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            }
        }
        return str;
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>
            {children}
        </LanguageContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTranslation = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useTranslation must be used within a LanguageProvider');
    return ctx;
};
