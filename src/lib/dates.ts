/**
 * Booking date rules. Dates are plain "YYYY-MM-DD" strings handled in UTC,
 * so they compare correctly as text and never shift with the visitor's time zone.
 * Shared by the browser (calendar) and the Netlify function (availability).
 */

export type ISODate = string;

export interface BookingRules {
  /** First possible arrival day of every season, "MM-DD". */
  opening: string;
  /** Last possible departure day of every season, "MM-DD". */
  closing: string;
  minNights: number;
  /** How many seasons after the current year can be booked. */
  yearsAhead: number;
}

const DAY_MS = 86_400_000;

export function fromISO(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(fromISO(value)) === value;
}

/** Today's date in the visitor's own calendar. */
export function todayISO(now = new Date()): ISODate {
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** Calendar date in Malcesine of an exact moment, e.g. a timed calendar event. */
export function romeDate(moment: string | Date): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(moment),
  );
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISO(new Date(fromISO(date).getTime() + days * DAY_MS));
}

export function nightsBetween(arrival: ISODate, departure: ISODate): number {
  return Math.round((fromISO(departure).getTime() - fromISO(arrival).getTime()) / DAY_MS);
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4));
}

export function seasonOf(year: number, rules: BookingRules) {
  return { open: `${year}-${rules.opening}`, close: `${year}-${rules.closing}` };
}

export function lastBookableYear(today: ISODate, rules: BookingRules): number {
  return yearOf(today) + rules.yearsAhead;
}

export function isInSeason(date: ISODate, rules: BookingRules): boolean {
  const { open, close } = seasonOf(yearOf(date), rules);
  return date >= open && date <= close;
}

/** A guest can arrive on this day: not in the past, in season, with room for the minimum stay. */
export function canArrive(date: ISODate, today: ISODate, rules: BookingRules): boolean {
  if (date < today || yearOf(date) > lastBookableYear(today, rules)) return false;
  const { open, close } = seasonOf(yearOf(date), rules);
  return date >= open && date <= addDays(close, -rules.minNights);
}

/** A guest who arrived on `arrival` can leave on this day: minimum stay respected, same season. */
export function canDepart(arrival: ISODate, date: ISODate, rules: BookingRules): boolean {
  if (nightsBetween(arrival, date) < rules.minNights) return false;
  return date <= seasonOf(yearOf(arrival), rules).close;
}

export type StayCheck = 'ok' | 'missing' | 'arrival' | 'minStay' | 'departure';

export function checkStay(
  arrival: ISODate | null,
  departure: ISODate | null,
  today: ISODate,
  rules: BookingRules,
): StayCheck {
  if (!arrival || !departure) return 'missing';
  if (!canArrive(arrival, today, rules)) return 'arrival';
  if (nightsBetween(arrival, departure) < rules.minNights) return 'minStay';
  if (!canDepart(arrival, departure, rules)) return 'departure';
  return 'ok';
}
