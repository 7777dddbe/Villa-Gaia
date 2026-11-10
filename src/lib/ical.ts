import { addDays, isISODate, romeDate, type ISODate } from './dates';

/** One booked stay read from a calendar feed. `end` is the departure day, as in Booking. */
export interface Stay {
  start: ISODate;
  end: ISODate;
}

/**
 * Stays in an iCalendar (.ics) feed, such as the per-apartment export of Booking.com.
 * Only DTSTART, DTEND (or DURATION) and STATUS of each VEVENT are read; cancelled events are skipped.
 * All-day events already end on the departure day (DTEND is exclusive); timed ones are read in Italian time.
 */
export function parseICalStays(ics: string): Stay[] {
  // Long lines are folded: a line break followed by a space or a tab continues the line (RFC 5545 §3.1).
  const lines = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const stays: Stay[] = [];
  let event: Map<string, string> | null = null;
  let nested = 0; // components inside the event, e.g. VALARM, whose properties are not the event's

  for (const line of lines) {
    const property = parseLine(line);
    if (!property) continue;
    const { name, value } = property;

    if (name === 'BEGIN') {
      if (event) nested++;
      else if (value.toUpperCase() === 'VEVENT') event = new Map();
    } else if (name === 'END' && event) {
      if (nested) nested--;
      else {
        const stay = toStay(event);
        if (stay) stays.push(stay);
        event = null;
      }
    } else if (event && !nested && !event.has(name)) {
      event.set(name, value);
    }
  }
  return stays;
}

/** "DTSTART;VALUE=DATE:20270612" → { name: "DTSTART", value: "20270612" }. Parameters are not needed. */
function parseLine(line: string): { name: string; value: string } | null {
  // The value starts at the first colon outside quoted parameter values, e.g. TZID="Europe: Rome".
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted) {
      return { name: line.slice(0, i).split(';')[0].trim().toUpperCase(), value: line.slice(i + 1).trim() };
    }
  }
  return null;
}

/** "20270612" or "20270612T140000[Z]" → "2027-06-12". UTC times are moved to Italian time, local ones kept as written. */
function icalDate(value: string | undefined): ISODate | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/i.exec(value ?? '');
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, utc] = match;
  const date = utc ? romeDate(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`) : `${y}-${m}-${d}`;
  return isISODate(date) ? date : null;
}

/** "P5D" or "P2W" → days. Time parts (e.g. "PT2H") do not add whole days. */
function durationDays(value: string | undefined): number {
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?/i.exec(value ?? '');
  return match ? Number(match[1] ?? 0) * 7 + Number(match[2] ?? 0) : 0;
}

function toStay(event: Map<string, string>): Stay | null {
  if (event.get('STATUS')?.toUpperCase() === 'CANCELLED') return null;
  const start = icalDate(event.get('DTSTART'));
  if (!start) return null;
  let end = icalDate(event.get('DTEND')) ?? addDays(start, durationDays(event.get('DURATION')));
  // An event without a length still blocks its first night.
  if (end <= start) end = addDays(start, 1);
  return { start, end };
}
