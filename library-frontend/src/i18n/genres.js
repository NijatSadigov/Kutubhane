// Display names for genres.
//
// A genre is a row the library names for itself — `genres.name` is free text a
// librarian types, stored in one language, the school's. So it is data, not a
// translatable string, and switching the interface to English used to leave
// "Roman" on an English page, where it reads as ancient Rome rather than
// "novel".
//
// The compromise: look the stored name up by a normalised slug, and fall back
// to the stored name when nothing matches. A genre a librarian invents still
// shows exactly as they typed it, in every language, which is the right
// answer — we cannot translate a word we have never seen. A genre we do know
// gets a proper label.
//
// The Azerbaijani labels in translations.js are identical to what the database
// stores, so nothing changes in the school's own language.
//
// Two things to keep in mind when touching this:
//   - genreColors() takes the STORED name, never the label, so a genre keeps
//     its colour across languages.
//   - filters and queries send the STORED name too; only what is rendered
//     passes through genreLabel().

// "Uşaq Ədəbiyyatı" -> "usaq-edebiyyati". Azerbaijani letters are folded to
// their closest ASCII so the key is writable in the translations file.
export function genreSlug(name) {
  return (name || '')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pass the reader's `t`. Returns the stored name unchanged when the genre has
// no label in any language.
export function genreLabel(name, t) {
  if (!name) return '';
  const key = 'genre.' + genreSlug(name);
  const label = t(key);
  // t() hands back the key itself when nothing matches, having already tried
  // the fallback language.
  return label === key ? name : label;
}
