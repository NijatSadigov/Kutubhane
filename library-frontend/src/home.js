// Where each role belongs after signing in.
//
// Kept in one place because Login and the site root both have to answer it,
// and they were answering it differently: a librarian was sent to the old
// `/librarian` dashboard while the rebuilt console sat unvisited at `/staff`,
// and a signed-in librarian who opened `/` landed in the reader app.
//
// Librarians go to the new console: it now covers everything their old
// dashboard did — the desk, holds and overdue, all loans, the catalogue with
// its copies, members with invite codes, requests and settings.
//
// Managers and admins stay on their own consoles. The staff console has no
// screens for them yet (the design's S7–S9, analytics and branches & users,
// are not built), so sending them there would take tools away.

export function homePathFor(user) {
  switch (user?.role) {
    case 'librarian': return '/staff';
    // A teacher's whole job in this system is the dərslik system, so that is
    // where they land rather than the circulation desk.
    case 'teacher': return '/staff/textbooks';
    case 'manager': return '/manager';
    case 'admin': return '/admin';
    default: return '/app';
  }
}

export default homePathFor;
