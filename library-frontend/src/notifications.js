// What a notification says, and where it goes when you press it.
//
// The backend deliberately stores facts rather than sentences — a kind and a
// JSON bag of params — so the sentence is built here, from the same i18n file
// as every other string in the app. A reader who switches language sees the
// notification in the new one instead of whatever was frozen when it was
// written.
//
// Both shells use this module. The reader's bell and the staff console's bell
// are two different components in two different themes, but a notification must
// read the same in each, so the text and the destination live in one place.

import { fmtDate } from './i18n/dates';

// Which i18n key renders each kind. A kind this build does not know about falls
// back to nothing rendered rather than a raw key on screen — an old row from a
// future version should not shout `NOTIF.SOMETHING` at a librarian.
//
// `notif.ticketReply` is deliberately *not* possessive — "a new reply on the
// ticket", never "on your ticket". One key serves both ends of the thread: the
// librarian who raised it and the school administration who answer it. Calling
// it the administration's own ticket is wrong, and reads that way on screen.
const SENTENCE = {
  TEXTBOOK_READY: 'notif.textbookReady',
  TICKET_REPLY: 'notif.ticketReply',
  LOAN_OVERDUE: 'notif.loanOverdue',
};

// Where pressing the row takes you. Keyed by subject rather than kind, because
// the subject is the thing the notification is *about*.
//
// `role` decides the reader-or-staff half of the answer: an overdue reminder
// belongs to a student, who lives in the reader app, while the other two belong
// to staff, who live in the console.
//
// These are `staff/nav.js`'s own `<domain>/<screen>` paths. Nothing here adds a
// destination the rail does not already offer — a notification is a shortcut to
// an existing screen, never a route of its own.
function destination(n, role) {
  const staff = role && role !== 'student';
  switch (n.subject) {
    case 'textbook_request':
      return '/staff/textbooks/requests';
    case 'ticket':
      // The two sides of a ticket read it on their own screen: the branch on
      // Müraciətlərim, the administration on Gələn müraciətlər.
      return role === 'manager' || role === 'admin'
        ? '/staff/support/inbox'
        : '/staff/support';
    case 'loan':
      // A reader sees their loans on their shelf. A member of staff who somehow
      // holds one has no reader shelf to send them to.
      return staff ? '/staff/library/loans' : '/app/shelf';
    default:
      return null;
  }
}

// "Just now" / "3h ago" / "2d ago", falling back to a plain date after a week —
// by then the exact day is more use than the distance.
export function notificationTime(t, iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 60) return t('notif.now');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notif.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days <= 7) return t('notif.daysAgo', { n: days });
  return fmtDate(iso);
}

// One notification, ready to render: its sentence, its destination, and whether
// it has been read. Returns null for a kind this build does not recognise.
export function renderNotification(t, n, role) {
  const key = SENTENCE[n.kind];
  if (!key) return null;
  return {
    id: n.id,
    text: t(key, n.params || {}),
    to: destination(n, role),
    read: !!n.read,
    at: n.created_at,
  };
}

// The whole list, with unrecognised kinds dropped.
export function renderNotifications(t, items, role) {
  return (items || []).map((n) => renderNotification(t, n, role)).filter(Boolean);
}
