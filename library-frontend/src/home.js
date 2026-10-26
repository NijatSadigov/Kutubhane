// Where each role belongs after signing in.
//
// Kept in one place because Login and the site root both have to answer it,
// and they were answering it differently: a librarian was sent to the old
// `/librarian` dashboard while the rebuilt console sat unvisited at `/staff`,
// and a signed-in librarian who opened `/` landed in the reader app.
//
// Everyone on the staff side goes to the console now. It covers what each old
// dashboard did: the desk, holds and overdue, all loans, the catalogue with its
// copies, members with invite codes, requests and settings for a librarian;
// analytics, the branch workspace, the school's readers, the school-wide
// request queue, librarian tracking, branches, staff and schools for the
// administration. /librarian, /manager and /admin are redirects.
//
// Where someone lands inside the console is nav.js's decision, not this file's
// — `StaffLanding` sends each role to the first domain it can actually reach.
// The two exceptions below are the cases where the first reachable domain is
// not the one the person came for.

export function homePathFor(user) {
  switch (user?.role) {
    case 'librarian': return '/staff';
    // A teacher's whole job in this system is the dərslik system, so that is
    // where they land rather than the circulation desk.
    case 'teacher': return '/staff/textbooks';
    case 'manager': return '/staff';
    case 'admin': return '/staff';
    default: return '/app';
  }
}

export default homePathFor;
