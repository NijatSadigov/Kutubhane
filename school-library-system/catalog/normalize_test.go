package catalog

import "testing"

func TestNormalizeKeyFoldsAzeriAndTurkish(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Əli və Nino", "eli ve nino"},
		{"Ali ve Nino", "ali ve nino"}, // not the same key — folding is not transliteration
		{"Kitabi-Dədə Qorqud", "kitabi dede qorqud"},
		{"Saatleri Ayarlama Enstitüsü", "saatleri ayarlama enstitusu"},
		{"  Extra   Spaces  ", "extra spaces"},
		{"ÜST ÜSTE", "ust uste"},
		{"Şeyx Şamil", "seyx samil"},
		{"", ""},
		{"!!!", ""},
	}
	for _, c := range cases {
		if got := NormalizeKey(c.in); got != c.want {
			t.Errorf("NormalizeKey(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeKeyTreatsHyphensAsWordBreaks(t *testing.T) {
	// A hyphen between words is a word break, not a joiner: the hyphenated and
	// spaced spellings of a title are the same book. This is the case that
	// showed up in real data — "Kitabi-Dədə Qorqud" vs "Kitabi Dədə Qorqud".
	hyphen := NormalizeKey("Kitabi-Dədə Qorqud")
	spaced := NormalizeKey("Kitabi Dədə Qorqud")
	if hyphen != spaced {
		t.Errorf("hyphenated and spaced titles disagree: %q vs %q", hyphen, spaced)
	}
	if hyphen != "kitabi dede qorqud" {
		t.Errorf("unexpected key %q", hyphen)
	}
	// Other dash characters behave the same way.
	for _, v := range []string{"Kitabi–Dədə Qorqud", "Kitabi—Dədə Qorqud", "Kitabi/Dədə Qorqud"} {
		if got := NormalizeKey(v); got != spaced {
			t.Errorf("NormalizeKey(%q) = %q, want %q", v, got, spaced)
		}
	}
}

func TestNormalizeKeyDropsIntraWordPunctuation(t *testing.T) {
	// Apostrophes sit inside a word, so they are dropped rather than spaced.
	if NormalizeKey("Don't Panic") != "dont panic" {
		t.Errorf("apostrophe handling changed: %q", NormalizeKey("Don't Panic"))
	}
	if NormalizeKey("(Brackets) [Too]") != "brackets too" {
		t.Errorf("bracket handling changed: %q", NormalizeKey("(Brackets) [Too]"))
	}
}

func TestWorkMatchKeySeparatesTitleAndAuthor(t *testing.T) {
	// Without the separator, ("AB","C") and ("A","BC") would collide.
	if WorkMatchKey("AB", "C") == WorkMatchKey("A", "BC") {
		t.Error("title and author are not properly separated in the match key")
	}
}

func TestNormalizeISBN(t *testing.T) {
	cases := []struct{ in, want string }{
		{"978-9952-24-123-4", "9789952241234"},
		{"9789952241234", "9789952241234"},
		{"0-306-40615-2", "0306406152"},
		{"080442957X", "080442957X"},
		{"080442957x", "080442957X"},
		{"", ""},
		{"12345", ""},          // too short
		{"97899522412345", ""}, // too long
		{"97X9952241234", ""},  // X only legal as the ISBN-10 check digit
	}
	for _, c := range cases {
		if got := NormalizeISBN(c.in); got != c.want {
			t.Errorf("NormalizeISBN(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestISBN13ConvertsFromISBN10(t *testing.T) {
	// Known-good pairs.
	cases := []struct{ in, want string }{
		{"0-306-40615-2", "9780306406157"},
		{"0306406152", "9780306406157"},
		{"9789952241234", "9789952241234"}, // already 13, passed through
		{"not an isbn", ""},
		{"", ""},
	}
	for _, c := range cases {
		if got := ISBN13(c.in); got != c.want {
			t.Errorf("ISBN13(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestISBN13IsStableAcrossFormatting(t *testing.T) {
	// The whole point: the same book typed three ways must produce one key.
	want := ISBN13("9780306406157")
	for _, v := range []string{"978-0-306-40615-7", "978 0 306 40615 7", "0306406152"} {
		if got := ISBN13(v); got != want {
			t.Errorf("ISBN13(%q) = %q, want %q", v, got, want)
		}
	}
}
