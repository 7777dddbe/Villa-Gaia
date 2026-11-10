/**
 * GET /api/disponibilita?checkin=2027-06-12&checkout=2027-06-16
 * → { "liberi": ["gaia1", "gaia3"], "fonte": "google+booking-gaia1" }
 *
 * Reads up to two kinds of calendars, all optional, and blocks an apartment booked in any of them.
 * The keys live only in Netlify's environment variables:
 *   GOOGLE_CALENDAR_ID            the single Google Calendar where every event title names the apartment
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  the service account the calendar is shared with
 *   GOOGLE_PRIVATE_KEY            that service account's private key
 *   ICAL_GAIA1, ICAL_GAIA2, ICAL_GAIA3
 *                                 the Booking.com iCal export link of each apartment
 * "fonte" lists the calendars read, joined by "+". With none of them it answers from
 * netlify/dati-prova.json ("fonte": "prova"), so the site works before any calendar is connected.
 * If a calendar cannot be read the answer is an error: an apartment is never shown free by mistake.
 */
import { createSign } from 'node:crypto';
import { addDays, checkStay, isISODate, nightsBetween, romeDate, todayISO, type ISODate } from '../../src/lib/dates';
import { apartmentsInTitle, freeApartments, type Booking } from '../../src/lib/availability';
import { rules } from '../../src/lib/booking-rules';
import { parseICalStays, type Stay } from '../../src/lib/ical';
import data from '../../src/config/appartamenti.json';
import mock from '../dati-prova.json';

export const config = { path: '/api/disponibilita' };

const MAX_NIGHTS = 60;
const apartments = data.appartamenti.map(({ id, nome }) => ({ id, nome }));
const ids = apartments.map((a) => a.id);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const checkin = url.searchParams.get('checkin');
  const checkout = url.searchParams.get('checkout');

  // One day of leeway: the visitor's "today" can be behind the server's clock.
  const today = addDays(todayISO(), -1);
  if (!isISODate(checkin) || !isISODate(checkout) || checkStay(checkin, checkout, today, rules) !== 'ok') {
    return json({ errore: 'Date non valide' }, 400);
  }
  if (nightsBetween(checkin, checkout) > MAX_NIGHTS) return json({ errore: 'Soggiorno troppo lungo' }, 400);

  const sources = calendarSources(checkin, checkout);
  if (sources.length === 0) {
    const bookings: Booking[] = (mock.prenotazioni as { appartamento: string; dal: string; al: string }[]).map((p) => ({
      apartment: p.appartamento,
      start: p.dal,
      end: p.al,
    }));
    return json({ liberi: freeApartments(ids, bookings, checkin, checkout), fonte: 'prova' });
  }

  const results = await Promise.allSettled(sources.map((source) => source.load()));
  const bookings: Booking[] = [];
  let failed = false;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') bookings.push(...result.value);
    else {
      failed = true;
      console.error(`Disponibilità non verificabile, calendario "${sources[i].name}":`, result.reason);
    }
  });
  if (failed) return json({ errore: 'Calendario non raggiungibile' }, 502);
  return json({ liberi: freeApartments(ids, bookings, checkin, checkout), fonte: sources.map((s) => s.name).join('+') });
}

/** The calendars configured in the environment variables, each with its name for "fonte" and the logs. */
function calendarSources(checkin: ISODate, checkout: ISODate) {
  const sources: { name: string; load: () => Promise<Booking[]> }[] = [];

  const { GOOGLE_CALENDAR_ID: calendarId, GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: key } = process.env;
  if (calendarId && email && key) {
    sources.push({ name: 'google', load: () => googleBookings(calendarId, email, key, checkin, checkout) });
  } else if (calendarId || email || key) {
    console.warn('Google Calendar ignorato: servono tutte e tre le variabili GOOGLE_*.');
  }

  for (const { id } of apartments) {
    const feed = process.env[`ICAL_${id.toUpperCase()}`]?.trim();
    if (!feed) continue;
    sources.push({
      name: `booking-${id}`,
      load: async () => (await icalStays(feed)).map((stay) => ({ apartment: id, ...stay })),
    });
  }
  return sources;
}

// ---------- Google Calendar ----------

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
let cachedToken: { value: string; expires: number } | null = null;

/** Service-account sign-in (OAuth 2 JWT bearer), without extra libraries. */
async function accessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expires > now + 60) return cachedToken.value;

  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  // Netlify often stores the key with literal "\n": turn them back into line breaks.
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey.replace(/\\n/g, '\n')).toString('base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!response.ok) throw new Error(`Google token ${response.status}: ${await response.text()}`);
  const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: access_token, expires: now + expires_in };
  return access_token;
}

interface CalendarEvent {
  summary?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

async function googleBookings(calendarId: string, email: string, key: string, checkin: ISODate, checkout: ISODate) {
  const token = await accessToken(email, key);
  const params = new URLSearchParams({
    timeMin: `${addDays(checkin, -1)}T00:00:00Z`,
    timeMax: `${addDays(checkout, 1)}T00:00:00Z`,
    singleEvents: 'true',
    maxResults: '2500',
    fields: 'items(summary,status,start,end)',
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`Google Calendar ${response.status}: ${await response.text()}`);
  const { items = [] } = (await response.json()) as { items?: CalendarEvent[] };

  const bookings: Booking[] = [];
  for (const event of items) {
    if (event.status === 'cancelled' || !event.start || !event.end) continue;
    // All-day events end on the departure day already; timed ones are read in Italian time.
    const start = event.start.date ?? (event.start.dateTime ? romeDate(event.start.dateTime) : null);
    let end = event.end.date ?? (event.end.dateTime ? romeDate(event.end.dateTime) : null);
    if (!start || !end) continue;
    if (end <= start) end = addDays(start, 1);
    for (const apartment of apartmentsInTitle(event.summary ?? '', apartments)) bookings.push({ apartment, start, end });
  }
  return bookings;
}

// ---------- Booking.com iCal ----------

const ICAL_CACHE_MS = 5 * 60_000;
const ICAL_TIMEOUT_MS = 8_000;
/** Recently read feeds, so a burst of searches does not call Booking every time. Failures are not kept. */
const icalCache = new Map<string, { stays: Stay[]; expires: number }>();

async function icalStays(feed: string): Promise<Stay[]> {
  const cached = icalCache.get(feed);
  if (cached && cached.expires > Date.now()) return cached.stays;

  const response = await fetch(feed.replace(/^webcal:/i, 'https:'), {
    headers: { accept: 'text/calendar' },
    signal: AbortSignal.timeout(ICAL_TIMEOUT_MS),
  });
  // The link itself is secret, so errors never repeat it.
  if (!response.ok) throw new Error(`iCal ${response.status} ${response.statusText}`);
  const text = await response.text();
  // An error page answered with 200 must not read as "no bookings".
  if (!/^BEGIN:VCALENDAR/im.test(text)) throw new Error('la risposta non è un calendario iCal');

  const stays = parseICalStays(text);
  icalCache.set(feed, { stays, expires: Date.now() + ICAL_CACHE_MS });
  return stays;
}
