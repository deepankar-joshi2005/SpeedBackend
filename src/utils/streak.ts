/**
 * Calculates the current consecutive-day streak for a user.
 *
 * Rules:
 * - A "day" is a calendar day in IST (UTC+5:30).
 * - If the user submitted at least one completed attempt today → streak includes today.
 * - If the last attempt was yesterday → streak continues from yesterday.
 * - If the last attempt was 2+ days ago → streak resets to 0.
 * - Streak = number of consecutive days (going back from today/yesterday) that have at least one completed attempt.
 */
export function calculateStreak(submittedDates: (Date | null | undefined)[]): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  // Convert each date to IST calendar day string "YYYY-MM-DD"
  const daySet = new Set<string>();
  for (const d of submittedDates) {
    if (!d) continue;
    const istDate = new Date(d.getTime() + IST_OFFSET_MS);
    const dayStr = istDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    daySet.add(dayStr);
  }

  if (daySet.size === 0) return 0;

  // Today in IST
  const todayIST = new Date(Date.now() + IST_OFFSET_MS);
  const todayStr = todayIST.toISOString().slice(0, 10);

  // Check if streak is still active (attempted today or yesterday)
  const yesterdayIST = new Date(todayIST.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayIST.toISOString().slice(0, 10);

  const hasToday = daySet.has(todayStr);
  const hasYesterday = daySet.has(yesterdayStr);

  if (!hasToday && !hasYesterday) return 0; // streak broken

  // Walk backwards from today counting consecutive days
  let streak = 0;
  const cursor = new Date(todayIST);

  while (true) {
    const cursorStr = cursor.toISOString().slice(0, 10);
    if (daySet.has(cursorStr)) {
      streak++;
      cursor.setTime(cursor.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}
