package catalog

// Librarians type the language field freely and in whichever interface language
// they happen to be using, so the same language arrives as "az", "Azərbaycan",
// "Azerbaijani" and "Azeri". Left alone, those spellings split one book into
// several editions.
//
// languageAliases folds the spellings this system actually sees onto ISO 639-1
// codes. It is deliberately a lookup rather than a full language library: the
// set of languages a school library stocks is small, and a wrong guess here
// would silently merge genuinely different editions.
var languageAliases = map[string]string{
	// Azerbaijani
	"az": "az", "aze": "az", "azb": "az",
	"azerbaycan": "az", "azerbaycanca": "az", "azerbaijani": "az", "azeri": "az",
	"azerice": "az", "azerbaycan dili": "az",

	// Turkish
	"tr": "tr", "tur": "tr", "turkce": "tr", "turkish": "tr",
	"turk": "tr", "turkiye": "tr", "turk dili": "tr",

	// English
	"en": "en", "eng": "en", "english": "en",
	"ingilizce": "en", "ingilis": "en", "ingilis dili": "en", "inglizce": "en",

	// Russian
	"ru": "ru", "rus": "ru", "russian": "ru", "rusca": "ru", "rus dili": "ru",

	// Other languages that turn up on school shelves
	"fa": "fa", "farsca": "fa", "persian": "fa", "farsi": "fa",
	"ar": "ar", "arapca": "ar", "arabic": "ar", "erebce": "ar",
	"de": "de", "almanca": "de", "german": "de", "deutsch": "de",
	"fr": "fr", "fransizca": "fr", "french": "fr", "francais": "fr",
	"es": "es", "ispanyolca": "es", "spanish": "es", "espanol": "es",
}

// NormalizeLanguage reduces a free-text language to a stable key: an ISO 639-1
// code when the spelling is recognised, otherwise the normalized text itself so
// unrecognised languages still match themselves.
//
// It is used for the LanguageKey that edition matching compares. The value the
// librarian typed is preserved separately on Edition.Language for display.
func NormalizeLanguage(s string) string {
	key := NormalizeKey(s)
	if key == "" {
		return ""
	}
	if code, ok := languageAliases[key]; ok {
		return code
	}
	return key
}
