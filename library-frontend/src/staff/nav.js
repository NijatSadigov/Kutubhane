// The staff console's two-level navigation, in one place.
//
// The left rail is *domains* — the parts of the school's operation. The top bar
// is the *screens* inside whichever domain the rail has selected. One table
// drives the rail, the top bar, the routes and the page title, so those four
// can never disagree the way the old flat list let them (see HANDOFF.md on the
// four places that decided where a librarian lands).
//
// `badge` names a field of GET /desk/summary. A screen shows its own count; a
// domain shows the sum of its screens', so an unattended queue is visible from
// the rail without opening the domain.
//
// `roles` is who can actually reach the thing, not who is allowed to see it
// greyed out. A domain with no screens for your role does not appear at all.

export const STAFF_ROOT = '/staff';

const ALL_STAFF = ['librarian', 'manager', 'admin'];
const WITH_TEACHERS = ['librarian', 'manager', 'admin', 'teacher'];
// The circulation desk, the members list and the library's own settings are
// branch-scoped and guarded by IsLibrarian, which admits a librarian and a
// platform admin but deliberately not a manager — a school administrator does
// not run a branch's desk. Offering them those screens only produced a rail
// full of 403s and em-dashes, so the rail no longer does. A read-only branch
// workspace for managers is a feature in its own right; see TODO.md.
const BRANCH_DESK = ['librarian', 'admin'];
// The librarian side of Texniki dəstək needs a branch to raise a ticket from,
// which only a librarian profile has. A manager or admin reads the queue.
const BRANCH_ONLY = ['librarian'];
const ADMIN_SIDE = ['manager', 'admin'];
// Who does which half of the dərslik system: a teacher asks, the library
// supplies, and the school administration sets up the classes behind both.
const TEACHER_SIDE = ['teacher'];
const LIBRARY_SIDE = ['librarian', 'manager', 'admin'];

export const DOMAINS = [
  {
    key: 'library',
    labelKey: 'staff.dom.library',
    roles: BRANCH_DESK,
    screens: [
      { path: 'desk', labelKey: 'staff.nav.desk', roles: BRANCH_DESK },
      { path: 'catalogue', labelKey: 'staff.nav.inventory', roles: BRANCH_DESK },
      { path: 'reservations', labelKey: 'staff.nav.reservations', badge: 'holds_pending', roles: BRANCH_DESK },
      { path: 'loans', labelKey: 'staff.nav.loans', roles: BRANCH_DESK },
      { path: 'requests', labelKey: 'staff.nav.requests', badge: 'requests_pending', roles: BRANCH_DESK },
    ],
  },
  {
    key: 'textbooks',
    labelKey: 'staff.dom.textbooks',
    roles: WITH_TEACHERS,
    screens: [
      // A teacher's own classes come first; for the library the queue does.
      { path: 'classes', labelKey: 'staff.nav.myClasses', roles: TEACHER_SIDE },
      { path: 'new', labelKey: 'staff.nav.newRequest', roles: TEACHER_SIDE },
      { path: 'requests', labelKey: 'staff.nav.textbookRequests', badge: 'textbook_requests', roles: WITH_TEACHERS },
      { path: 'catalogue', labelKey: 'staff.nav.textbookCatalogue', roles: LIBRARY_SIDE },
      { path: 'classrooms', labelKey: 'staff.nav.classHoldings', roles: LIBRARY_SIDE },
    ],
  },
  {
    // Layihələr — the school's reading projects and campaigns. Teachers are
    // in, because a class-against-class campaign is run by the classes; the
    // endpoints admit the same four roles, so nothing here 403s.
    key: 'projects',
    labelKey: 'staff.dom.projects',
    roles: WITH_TEACHERS,
    screens: [
      { path: '', labelKey: 'staff.nav.projectList', badge: 'projects_open', roles: WITH_TEACHERS },
      { path: 'new', labelKey: 'staff.nav.projectNew', roles: WITH_TEACHERS },
    ],
  },
  {
    key: 'members',
    labelKey: 'staff.dom.members',
    roles: BRANCH_DESK,
    screens: [
      { path: '', labelKey: 'staff.nav.members', roles: BRANCH_DESK },
      { path: 'invites', labelKey: 'staff.nav.invites', roles: BRANCH_DESK },
    ],
  },
  {
    key: 'settings',
    labelKey: 'staff.dom.settings',
    roles: BRANCH_DESK,
    screens: [
      { path: 'lists', labelKey: 'staff.nav.lists', roles: BRANCH_DESK },
      { path: 'statuses', labelKey: 'staff.nav.statuses', roles: BRANCH_DESK },
      { path: 'limits', labelKey: 'staff.nav.limits', roles: BRANCH_DESK },
    ],
  },
  {
    key: 'textbook-settings',
    labelKey: 'staff.dom.textbookSettings',
    roles: ALL_STAFF,
    screens: [
      { path: 'classrooms', labelKey: 'staff.nav.classrooms', roles: ALL_STAFF },
      { path: 'teachers', labelKey: 'staff.nav.teachers', roles: ALL_STAFF },
      { path: 'subjects', labelKey: 'staff.nav.subjects', roles: ALL_STAFF },
      { path: 'years', labelKey: 'staff.nav.years', roles: ALL_STAFF },
    ],
  },
  {
    key: 'support',
    labelKey: 'staff.dom.support',
    roles: ALL_STAFF,
    screens: [
      { path: '', labelKey: 'staff.nav.myTickets', badge: 'tickets_unread', roles: BRANCH_ONLY },
      { path: 'new', labelKey: 'staff.nav.newTicket', roles: BRANCH_ONLY },
      { path: 'inbox', labelKey: 'staff.nav.ticketInbox', roles: ADMIN_SIDE },
    ],
  },
];

// Old flat paths → their new home, so bookmarks and the top bar's ?q= deep
// link into the catalogue keep working.
export const LEGACY_REDIRECTS = {
  desk: 'library/desk',
  holds: 'library/reservations',
  overdue: 'library/loans',
  inventory: 'library/catalogue',
  requests: 'library/requests',
  settings: 'settings/lists',
};

// A screen's full path. A screen with an empty path is the domain's own index.
export function screenPath(domain, screen) {
  const base = `${STAFF_ROOT}/${domain.key}`;
  return screen.path ? `${base}/${screen.path}` : base;
}

// Where a domain goes when the rail is clicked: its first screen this role can
// reach, or the domain itself when it is a placeholder.
export function domainPath(domain, role) {
  if (domain.soon) return `${STAFF_ROOT}/${domain.key}`;
  const first = visibleScreens(domain, role)[0];
  return first ? screenPath(domain, first) : `${STAFF_ROOT}/${domain.key}`;
}

export function visibleScreens(domain, role) {
  if (!domain.screens) return [];
  return domain.screens.filter((s) => s.roles.includes(role));
}

// A domain is reachable when the role is allowed it *and* it has something
// inside — a placeholder counts, an empty screen list does not.
export function visibleDomains(role) {
  return DOMAINS.filter((d) => {
    if (!d.roles.includes(role)) return false;
    return d.soon || visibleScreens(d, role).length > 0;
  });
}

// Which domain and screen a pathname is inside. Used for the rail's active
// state, the top bar's contents and the page title, so all three read the URL
// rather than tracking their own state.
export function locate(pathname, role) {
  const rest = pathname.replace(/^\/staff\/?/, '').replace(/\/+$/, '');
  const [domainKey, ...tail] = rest.split('/');
  const domain = visibleDomains(role).find((d) => d.key === domainKey);
  if (!domain) return { domain: null, screen: null };

  const screens = visibleScreens(domain, role);
  const screenPathStr = tail.join('/');
  const screen = screens.find((s) => s.path === screenPathStr)
    // A domain's index falls back to its first screen.
    || (screenPathStr === '' ? screens[0] : null);
  return { domain, screen };
}

// The rail's count for a domain: everything unattended inside it.
export function domainBadge(domain, role, badges) {
  return visibleScreens(domain, role).reduce(
    (n, s) => n + (s.badge ? Number(badges?.[s.badge] || 0) : 0),
    0,
  );
}
