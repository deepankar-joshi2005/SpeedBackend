import { ITestSeries } from "../models/testSeries.model";

type PriceFields = Pick<ITestSeries, "price" | "coachingPrice" | "coachingAccessType">;

/**
 * What a student actually pays for a paid TestSeries. `coachingAccessType`
 * is the explicit Free/Paid toggle admins set for coaching students — it
 * exists because inferring "free" from `coachingPrice === 0` is ambiguous
 * with "admin hasn't configured a discount yet" (the original bug: outsider
 * price leaked through whenever coachingPrice was left at 0).
 *
 * Series saved before this toggle existed have `coachingAccessType ===
 * undefined`; for those we keep the old heuristic so already-configured
 * series don't change behaviour until an admin re-saves them.
 */
export function resolveSeriesPrice(series: PriceFields, isCoachingStudent: boolean): number {
  if (!isCoachingStudent) return series.price;
  if (series.coachingAccessType === "free") return 0;
  if (series.coachingAccessType === "paid") return series.coachingPrice;
  return series.coachingPrice > 0 ? series.coachingPrice : series.price;
}
