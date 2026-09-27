// Package catalog holds the shared logic for the global book catalog: key
// normalization for duplicate detection, ISBN handling, and the backfill that
// lifts branch-scoped Book rows into Works and Editions.
package catalog

import (
	"strings"
	"unicode"
)

// foldings maps the letters that differ between Azerbaijani, Turkish and plain
// Latin onto an ASCII base, so "Əli və Nino" and "Ali ve Nino" match.
var foldings = map[rune]rune{
	'ə': 'e', 'Ə': 'e',
	'ğ': 'g', 'Ğ': 'g',
	'ı': 'i', 'I': 'i', 'İ': 'i',
	'ö': 'o', 'Ö': 'o',
	'ş': 's', 'Ş': 's',
	'ü': 'u', 'Ü': 'u',
	'ç': 'c', 'Ç': 'c',
	'â': 'a', 'Â': 'a',
	'î': 'i', 'Î': 'i',
	'û': 'u', 'Û': 'u',
}

// separators are punctuation that stands between words rather than inside one.
// A hyphen in a title ("Kitabi-Dədə Qorqud") is nearly always a word break, so
// it folds to a space and the hyphenated and spaced spellings agree. Apostrophes
// and the rest are dropped instead, since they sit inside a word ("Don't").
var separators = map[rune]bool{
	'-':  true, // hyphen-minus
	'–':  true, // en dash
	'—':  true, // em dash
	'·':  true, // middle dot
	'/':  true,
	'\\': true,
	'_':  true,
}

// NormalizeKey reduces a title or a name to a comparison key: case folded,
// diacritics flattened to ASCII, word-separating punctuation turned into
// spaces, other punctuation dropped, whitespace collapsed. It is deliberately
// lossy — its only job is to make near-identical strings collide so duplicates
// can be spotted.
func NormalizeKey(s string) string {
	var b strings.Builder
	lastSpace := true // leading spaces are skipped

	for _, r := range s {
		if folded, ok := foldings[r]; ok {
			b.WriteRune(folded)
			lastSpace = false
			continue
		}
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToLower(r))
			lastSpace = false
		case unicode.IsSpace(r):
			if !lastSpace {
				b.WriteRune(' ')
				lastSpace = true
			}
		case separators[r]:
			if !lastSpace {
				b.WriteRune(' ')
				lastSpace = true
			}
		default:
			// intra-word punctuation (apostrophes, quotes, brackets) is dropped
			// rather than spaced, so "Don't" and "Dont" agree
		}
	}
	return strings.TrimSpace(b.String())
}

// WorkMatchKey builds the key used to decide whether two works are the same
// creation: normalized title joined to normalized author.
func WorkMatchKey(title, author string) string {
	return NormalizeKey(title) + "|" + NormalizeKey(author)
}

// NormalizeISBN strips the formatting humans put in ISBNs, leaving digits and a
// trailing X. It returns "" if what is left is not a plausible ISBN.
func NormalizeISBN(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == 'x' || r == 'X':
			b.WriteRune('X')
		}
	}
	out := b.String()
	if len(out) != 10 && len(out) != 13 {
		return ""
	}
	// An X is only legal as the ISBN-10 check digit.
	if i := strings.IndexByte(out, 'X'); i != -1 && !(len(out) == 10 && i == 9) {
		return ""
	}
	return out
}

// ISBN13 returns the 13-digit form of an ISBN, converting from ISBN-10 when
// needed. It returns "" when the input is not a usable ISBN.
func ISBN13(raw string) string {
	n := NormalizeISBN(raw)
	switch len(n) {
	case 13:
		return n
	case 10:
		body := "978" + n[:9]
		sum := 0
		for i, r := range body {
			d := int(r - '0')
			if i%2 == 0 {
				sum += d
			} else {
				sum += 3 * d
			}
		}
		check := (10 - sum%10) % 10
		return body + string(rune('0'+check))
	}
	return ""
}
