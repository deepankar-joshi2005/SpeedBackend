import { ITest } from "../models/test.model";

type ScheduleFields = Pick<ITest, "startDate" | "endDate" | "startTime" | "endTime">;

// This app only serves Indian students, and all "HH:mm" time fields are
// entered by admins as India time. IST is a fixed UTC+5:30 offset with no
// daylight saving, so it's hardcoded here rather than left to the server
// process's own timezone — a server that happens to run in UTC (common on
// cloud hosts) would otherwise silently combine dates with the wrong hour
// and both enforce and *display* the wrong time.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Combines a date with an optional "HH:mm" (India time) time. Without a time, the date is returned as-is. */
export function combineDateTime(date: Date | null | undefined, time: string | null | undefined): Date | null {
  if (!date) return null;
  if (!time) return new Date(date);
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return new Date(date);

  // `date` is normally a date-only value (e.g. admin picked "10 Oct"), which
  // JS/Mongo store as UTC midnight. Shift by the IST offset before reading
  // the UTC getters so we recover the calendar date as it falls in India,
  // regardless of what timezone this process itself is running in.
  const istShifted = new Date(date.getTime() + IST_OFFSET_MS);
  const y = istShifted.getUTCFullYear();
  const m = istShifted.getUTCMonth();
  const d = istShifted.getUTCDate();

  // Build "y-m-d hours:minutes IST" as a UTC instant, then shift back.
  const utcMillisForIstWallClock = Date.UTC(y, m, d, hours, minutes, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMillisForIstWallClock);
}

/**
 * The actual start/end instants a test is attemptable, after folding in the
 * optional time-of-day fields. A test with no endDate but an endTime is
 * treated as ending that same day (startDate's date) — lets an admin set
 * "today, cutoff 7pm" without also having to pick an end date.
 */
export function getEffectiveWindow(test: ScheduleFields): { effectiveStart: Date | null; effectiveEnd: Date | null } {
  const effectiveStart = combineDateTime(test.startDate, test.startTime);
  const endDateBase = test.endDate ?? (test.endTime ? test.startDate : null);
  const effectiveEnd = combineDateTime(endDateBase, test.endTime);
  return { effectiveStart, effectiveEnd };
}

/**
 * Result/solution visibility is only gated when the admin explicitly set an
 * end TIME — a plain date-only schedule (or no schedule) keeps today's
 * always-visible-immediately behaviour unchanged.
 */
export function getResultLockUntil(test: ScheduleFields): Date | null {
  if (!test.endTime) return null;
  return getEffectiveWindow(test).effectiveEnd;
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function formatDateTimeLabel(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/** Formats a raw "HH:mm" time-of-day string (e.g. "09:00") as "9:00 AM" — pure string math, no Date/timezone involved. */
export function formatTimeOfDay(time: string): string | null {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}
