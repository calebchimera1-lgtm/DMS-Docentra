import type { BillingInterval } from "@omniflow/database";

/** How many months one interval spans. Also the MRR divisor. */
const MONTHS_PER_INTERVAL: Record<BillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

/**
 * Adds one billing interval to `from`.
 *
 * Uses UTC month arithmetic rather than adding a fixed number of days, so
 * a monthly subscription started on the 15th bills on the 15th every
 * month regardless of month length. `Date.UTC` normalises the overflow
 * case for us: a subscription started on 31 January advances to 3 March
 * in a non-leap year rather than throwing or silently clamping — the
 * period still tiles forward without a gap, which is what the billing
 * guarantee depends on.
 */
export function addInterval(from: Date, interval: BillingInterval): Date {
  const months = MONTHS_PER_INTERVAL[interval];
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + months,
      from.getUTCDate(),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

/** Adds a whole number of days, used for trial windows. */
export function addDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Expresses a per-interval amount as monthly recurring revenue. A yearly
 * plan contributes a twelfth of its price each month and a quarterly plan
 * a third, so subscriptions on different intervals can be summed on a
 * common footing. Rounded to whole cents, since MRR is reported as money.
 */
export function toMonthlyRecurringCents(amountCents: number, interval: BillingInterval): number {
  return Math.round(amountCents / MONTHS_PER_INTERVAL[interval]);
}
