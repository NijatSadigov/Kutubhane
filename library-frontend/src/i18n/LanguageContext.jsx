import { createContext, useContext, useState, useCallback } from 'react';
import { translations, LANGUAGES } from './translations';
import { setDateLang } from './dates';

const LanguageContext = createContext();

// The schools this runs in are Azerbaijani and so is every book in the
// catalogue, so an Azerbaijani interface is the sane default. It used to open
// in Turkish, which read as a half-finished translation.
const DEFAULT_LANG = 'az';

export const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(() => {
        const saved = localStorage.getItem('lang');
        const initial = translations[saved] ? saved : DEFAULT_LANG;
        // Dates format from a module-level language; set it before the first
        // render so nothing paints in the wrong one.
        setDateLang(initial);
        return initial;
    });

    const setLang = useCallback((code) => {
        if (!translations[code]) return;
        setDateLang(code);
        setLangState(code);
        localStorage.setItem('lang', code);
    }, []);

    // t(key, vars?) — falls back to Turkish then the raw key, and does simple
    // {placeholder} interpolation from an optional vars object.
    // `{n|book|books}` picks the singular when that variable is exactly 1, so
    // one row reads "1 book" rather than "1 books". It is per placeholder, not
    // per string, because several strings carry two counts at once
    // ("{n} readers · {d} days left").
    //
    // Only English needs it here: Azerbaijani and Turkish do not pluralise a
    // noun after a numeral, so their strings keep the single form and are left
    // exactly as they are.
    const t = useCallback((key, vars) => {
        let str = translations[lang]?.[key] ?? translations[DEFAULT_LANG]?.[key] ?? key;
        if (vars) {
            str = str.replace(/\{(\w+)\|([^|{}]*)\|([^|{}]*)\}/g, (whole, k, one, many) => (
                k in vars ? (Number(vars[k]) === 1 ? one : many) : whole
            ));
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
