package catalog

import "testing"

func TestNormalizeLanguageFoldsSpellingsOntoOneCode(t *testing.T) {
	groups := map[string][]string{
		"az": {"az", "AZ", "Azərbaycan", "azerbaycan", "Azerbaijani", "Azeri", "Azərbaycan dili"},
		"tr": {"tr", "Türkçe", "turkce", "Turkish", "TÜRKÇE"},
		"en": {"en", "English", "english", "İngilizce", "İngilis dili"},
		"ru": {"ru", "Rusca", "Russian"},
	}
	for want, spellings := range groups {
		for _, s := range spellings {
			if got := NormalizeLanguage(s); got != want {
				t.Errorf("NormalizeLanguage(%q) = %q, want %q", s, got, want)
			}
		}
	}
}

func TestNormalizeLanguageKeepsUnknownLanguagesDistinct(t *testing.T) {
	// An unrecognised language must still match itself, and must not collapse
	// onto some other language.
	a := NormalizeLanguage("Klingon")
	b := NormalizeLanguage("klingon")
	if a != b {
		t.Errorf("unknown language did not normalize consistently: %q vs %q", a, b)
	}
	if a == "" {
		t.Error("unknown language normalized to empty, which would match every blank record")
	}
	if a == NormalizeLanguage("Elvish") {
		t.Error("two different unknown languages collapsed onto one key")
	}
}

func TestNormalizeLanguageEmpty(t *testing.T) {
	for _, s := range []string{"", "   ", "!!!"} {
		if got := NormalizeLanguage(s); got != "" {
			t.Errorf("NormalizeLanguage(%q) = %q, want empty", s, got)
		}
	}
}
