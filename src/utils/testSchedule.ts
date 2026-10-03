import { ITest } from "../models/test.model";

type ScheduleFields = Pick<ITest, "startDate" | "endDate" | "startTime" | "endTime">;

/** Combines a date with an optional "HH:mm" time. Without a time, the date is returned as-is. */
export function combineDateTime(date: Date | null | undefined, time: string | null | undefined): Date | null {
  if (!date) return null;
  if (!time) return new Date(date);
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return new Date(date);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
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
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDateTimeLabel(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
