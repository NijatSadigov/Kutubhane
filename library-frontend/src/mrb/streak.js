// Reading streaks.
//
// The design shows a "🔥 12-day streak" pill in the header. There is no streak
// table yet, but the reading diary already records a timestamp per page log,
// which is enough to derive one honestly rather than hardcoding the
// prototype's number.

// Consecutive calendar days, ending today or yesterday, that have at least one
// diary entry. Yesterday counts as the end of the streak so it does not appear
// broken first thing in the morning, before today's reading.
export function streakFromLogs(logs) {
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const days = new Set(
    (logs || [])
      .map((l) => new Date(l.created_at))
      .filter((d) => !isNaN(d))
      .map(key)
  );
  if (!days.size) return 0;

  const cursor = new Date();
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }

  let n = 0;
  while (days.has(key(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
