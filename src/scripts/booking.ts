import { gsap } from 'gsap';
import {
  addDays,
  canArrive,
  canDepart,
  checkStay,
  fromISO,
  isISODate,
  isInSeason,
  lastBookableYear,
  nightsBetween,
  seasonOf,
  todayISO,
  yearOf,
  type ISODate,
} from '../lib/dates';
import { maxGuests, petFriendlyNames, rules } from '../lib/booking-rules';
import { fill } from '../lib/text';

export interface Search {
  arrival: ISODate;
  departure: ISODate;
  guests: number;
  pet: boolean;
}

/** Fired on `document` when the guest checks availability. `detail` is a Search plus where it came from. */
export const SEARCH_EVENT = 'villa:search';
export type SearchEventDetail = Search & { source: 'form' | 'url' };
/** Fire on `document` to reopen the calendar from elsewhere (the results); Done then searches again. */
export const EDIT_SEARCH_EVENT = 'villa:edit-search';

type Texts = Record<string, string>;
interface Month {
  y: number;
  /** 0 = January */
  m: number;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = window.matchMedia('(min-width: 48rem)');
const pad = (n: number) => String(n).padStart(2, '0');

const monthOf = (d: ISODate): Month => ({ y: yearOf(d), m: Number(d.slice(5, 7)) - 1 });
const monthIndex = (mo: Month) => mo.y * 12 + mo.m;
const addMonths = (mo: Month, n: number): Month => {
  const i = monthIndex(mo) + n;
  return { y: Math.floor(i / 12), m: i % 12 };
};
const daysIn = (mo: Month) => new Date(Date.UTC(mo.y, mo.m + 1, 0)).getUTCDate();
const firstDay = (mo: Month): ISODate => `${mo.y}-${pad(mo.m + 1)}-01`;
const lastDay = (mo: Month): ISODate => `${mo.y}-${pad(mo.m + 1)}-${pad(daysIn(mo))}`;
/** 0 = Monday ... 6 = Sunday */
const weekdayIndex = (d: ISODate) => (fromISO(d).getUTCDay() + 6) % 7;

export function initBooking() {
  const form = document.querySelector<HTMLFormElement>('[data-booking]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-calendar]');
  if (!form || !dialog) return;

  const { locale, texts: t } = JSON.parse(form.dataset.config ?? '{}') as { locale: string; texts: Texts };
  const today = todayISO();

  // ---------- Elements ----------
  const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;
  const fields = {
    arrival: q<HTMLButtonElement>(form, '[data-date-field="arrival"]'),
    departure: q<HTMLButtonElement>(form, '[data-date-field="departure"]'),
  };
  const values = {
    arrival: q<HTMLElement>(form, '[data-date-value="arrival"]'),
    departure: q<HTMLElement>(form, '[data-date-value="departure"]'),
  };
  const guestsOut = q<HTMLOutputElement>(form, '[data-guests-value]');
  const minus = q<HTMLButtonElement>(form, '[data-guests-step="-1"]');
  const plus = q<HTMLButtonElement>(form, '[data-guests-step="1"]');
  // The pet switch exists only when some apartment accepts pets (sito.json → animali).
  const petInput = form.querySelector<HTMLInputElement>('[data-pet]');
  const wantsPet = () => petInput?.checked ?? false;
  const note = q<HTMLElement>(form, '[data-booking-note]');

  const panel = q<HTMLElement>(dialog, '[data-cal-panel]');
  const scrim = q<HTMLElement>(dialog, '.cal__scrim');
  const monthsEl = q<HTMLElement>(dialog, '[data-cal-months]');
  const prevBtn = q<HTMLButtonElement>(dialog, '[data-cal-prev]');
  const nextBtn = q<HTMLButtonElement>(dialog, '[data-cal-next]');
  const statusEl = q<HTMLElement>(dialog, '[data-cal-status]');
  const clearBtn = q<HTMLButtonElement>(dialog, '[data-cal-clear]');
  const doneBtn = q<HTMLButtonElement>(dialog, '[data-cal-done]');

  // ---------- Formatting ----------
  const utc = { timeZone: 'UTC' } as const;
  const fmtShort = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short', day: 'numeric', month: 'short' });
  const fmtShortYear = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const fmtLong = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDayMonth = new Intl.DateTimeFormat(locale, { ...utc, day: 'numeric', month: 'long', year: 'numeric' });
  const fmtMonth = new Intl.DateTimeFormat(locale, { ...utc, month: 'long', year: 'numeric' });
  const fmtWeekday = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short' });
  const fmtWeekdayLong = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'long' });
  const list = new Intl.ListFormat(locale, { type: 'conjunction' });
  const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

  const showDate = (d: ISODate) => (yearOf(d) === yearOf(today) ? fmtShort : fmtShortYear).format(fromISO(d));
  const nightsText = (n: number) => (n === 1 ? t.nightsOne : fill(t.nightsOther, { n }));
  const monthName = (mo: Month) => capitalize(fmtMonth.format(fromISO(firstDay(mo))));

  // ---------- State ----------
  let arrival: ISODate | null = null;
  let departure: ISODate | null = null;
  let guests = Number(guestsOut.value || guestsOut.textContent) || 2;
  let mode: 'arrival' | 'departure' = 'arrival';
  let view: Month = monthOf(today);
  let focused: ISODate = today;
  let preview: ISODate | null = null;
  let trigger: HTMLElement | null = null;
  let searchWhenDone = false;

  const minMonth = monthOf(today);
  const maxMonth = monthOf(seasonOf(lastBookableYear(today, rules), rules).close);
  const monthsShown = () => (wide.matches ? 2 : 1);

  /** First day a guest can arrive, from today on. */
  function firstArrival(): ISODate {
    if (canArrive(today, today, rules)) return today;
    const thisYear = seasonOf(yearOf(today), rules).open;
    return today < thisYear ? thisYear : seasonOf(yearOf(today) + 1, rules).open;
  }

  /** Days between arrival and the minimum stay can't be a departure. */
  function inMinStayGap(d: ISODate) {
    return mode === 'departure' && arrival !== null && d > arrival && nightsBetween(arrival, d) < rules.minNights;
  }

  function isSelectable(d: ISODate) {
    if (mode === 'departure' && arrival) {
      if (inMinStayGap(d)) return false;
      return canDepart(arrival, d, rules) || canArrive(d, today, rules);
    }
    return canArrive(d, today, rules);
  }

  // ---------- Form fields ----------
  function syncFields() {
    for (const key of ['arrival', 'departure'] as const) {
      const date = key === 'arrival' ? arrival : departure;
      values[key].textContent = date ? showDate(date) : t.addDate;
      values[key].classList.toggle('is-empty', !date);
      const label = key === 'arrival' ? t.arrival : t.departure;
      fields[key].setAttribute('aria-label', `${label}: ${date ? fmtLong.format(fromISO(date)) : t.addDate}`);
    }
  }

  function setGuests(n: number, animateFrom = 0) {
    const next = Math.min(maxGuests, Math.max(1, n));
    const changed = next !== guests;
    guests = next;
    guestsOut.value = String(next);
    guestsOut.textContent = String(next);
    minus.setAttribute('aria-disabled', String(next <= 1));
    plus.setAttribute('aria-disabled', String(next >= maxGuests));
    if (changed && animateFrom && !reduceMotion()) {
      gsap.fromTo(
        guestsOut,
        { y: animateFrom * 8, opacity: 0, filter: 'blur(2px)' },
        { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.22, ease: 'power3.out', overwrite: true, clearProps: 'filter' },
      );
    }
    updateNote();
  }

  function updateNote(error?: string) {
    const parts: string[] = [];
    if (error) parts.push(error);
    else {
      if (wantsPet() && petFriendlyNames.length) parts.push(fill(t.petHint, { nomi: list.format(petFriendlyNames) }));
      if (guests >= maxGuests) parts.push(fill(t.guestsMax, { n: maxGuests }));
    }
    const text = parts.join(' ');
    const appearing = note.hidden && parts.length > 0;
    note.textContent = text;
    note.hidden = parts.length === 0;
    note.classList.toggle('is-error', Boolean(error));
    if (appearing && !reduceMotion()) {
      gsap.fromTo(note, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'all' });
    }
  }

  // ---------- Calendar rendering ----------
  function renderMonth(mo: Month): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cal-month';
    const titleId = `cal-month-${mo.y}-${mo.m}`;

    const title = document.createElement('h3');
    title.className = 'cal-month__title';
    title.id = titleId;
    title.textContent = monthName(mo);

    const table = document.createElement('table');
    table.className = 'cal-grid';
    table.setAttribute('aria-labelledby', titleId);

    const head = table.createTHead().insertRow();
    for (let i = 0; i < 7; i++) {
      const day = fromISO(addDays('2024-01-01', i)); // 1 January 2024 was a Monday
      const th = document.createElement('th');
      th.scope = 'col';
      th.abbr = fmtWeekdayLong.format(day);
      th.textContent = fmtWeekday.format(day).replace('.', '');
      head.append(th);
    }

    const body = table.createTBody();
    let row = body.insertRow();
    for (let i = 0; i < weekdayIndex(firstDay(mo)); i++) row.insertCell();
    for (let day = 1; day <= daysIn(mo); day++) {
      const date = `${mo.y}-${pad(mo.m + 1)}-${pad(day)}`;
      if (row.cells.length === 7) row = body.insertRow();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'day';
      button.dataset.date = date;
      button.tabIndex = -1;
      button.textContent = String(day);
      row.insertCell().append(button);
    }
    while (row.cells.length < 7) row.insertCell();

    wrap.append(title, table);

    // A month entirely outside the season gets a short message and a shortcut to the next opening.
    const season = seasonOf(mo.y, rules);
    const closed = lastDay(mo) < season.open || firstDay(mo) > season.close;
    if (closed) {
      wrap.classList.add('is-closed');
      const reopen = firstDay(mo) > season.close ? seasonOf(mo.y + 1, rules).open : season.open;
      const box = document.createElement('div');
      box.className = 'cal-month__closed';
      const text = document.createElement('p');
      text.textContent = fill(t.closedUntil, { data: fmtDayMonth.format(fromISO(reopen)) });
      box.append(text);
      if (yearOf(reopen) <= lastBookableYear(today, rules)) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'btn';
        go.textContent = fill(t.goToSeason, { mese: monthName(monthOf(reopen)) });
        go.addEventListener('click', () => goToMonth(monthOf(reopen), 1));
        box.append(go);
      }
      wrap.append(box);
    }
    return wrap;
  }

  function render() {
    monthsEl.replaceChildren(...Array.from({ length: monthsShown() }, (_, i) => renderMonth(addMonths(view, i))));
    prevBtn.disabled = monthIndex(view) <= monthIndex(minMonth);
    nextBtn.disabled = monthIndex(view) + monthsShown() - 1 >= monthIndex(maxMonth);
    updateDays();
  }

  function updateDays() {
    const rangeEnd = departure ?? (mode === 'departure' ? preview : null);
    const buttons = monthsEl.querySelectorAll<HTMLButtonElement>('.day');
    let focusable: HTMLButtonElement | null = null;

    buttons.forEach((button) => {
      const d = button.dataset.date!;
      const cell = button.parentElement!;
      const selectable = isSelectable(d);
      const isStart = d === arrival;
      const isEnd = d === departure;
      const gap = inMinStayGap(d);

      button.setAttribute('aria-disabled', String(!selectable && !isStart && !isEnd));
      button.setAttribute('aria-pressed', String(isStart || isEnd));
      button.classList.toggle('is-start', isStart);
      button.classList.toggle('is-end', isEnd);
      button.classList.toggle('is-today', d === today);
      button.classList.toggle('is-preview-end', !departure && d === preview);

      let label = fmtLong.format(fromISO(d));
      if (gap) label += `, ${fill(t.minStayDay, { n: rules.minNights })}`;
      else if (!isInSeason(d, rules)) label += `, ${t.closed}`;
      button.setAttribute('aria-label', label);
      button.title = gap ? fill(t.minStayDay, { n: rules.minNights }) : '';

      const inRange = Boolean(arrival && rangeEnd && d > arrival && d < rangeEnd);
      cell.classList.toggle('in-range', inRange);
      cell.classList.toggle('range-start', Boolean(isStart && rangeEnd && rangeEnd > d));
      cell.classList.toggle('range-end', Boolean(arrival && rangeEnd && d === rangeEnd));

      button.tabIndex = -1;
      if (d === focused) focusable = button;
    });

    // Exactly one day can be reached with Tab (roving tabindex).
    const target = focusable ?? Array.from(buttons).find((b) => b.getAttribute('aria-disabled') === 'false') ?? buttons[0];
    if (target) target.tabIndex = 0;
    updateStatus();
  }

  function updateStatus(error?: string) {
    const complete = Boolean(arrival && departure);
    if (error) statusEl.textContent = error;
    else if (complete)
      statusEl.textContent = `${fill(t.range, { arrivo: showDate(arrival!), partenza: showDate(departure!) })}, ${nightsText(nightsBetween(arrival!, departure!))}`;
    else statusEl.textContent = mode === 'departure' ? t.chooseDeparture : t.chooseArrival;
    statusEl.classList.toggle('is-error', Boolean(error));
    clearBtn.disabled = !arrival;
    doneBtn.disabled = !complete;
  }

  function slide(direction: number) {
    if (reduceMotion() || !direction) return;
    gsap.fromTo(
      monthsEl,
      { x: direction * 24, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.28, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
    );
  }

  function clampMonth(mo: Month): Month {
    const last = monthIndex(maxMonth) - (monthsShown() - 1);
    const i = Math.min(Math.max(monthIndex(mo), monthIndex(minMonth)), Math.max(last, monthIndex(minMonth)));
    return { y: Math.floor(i / 12), m: i % 12 };
  }

  function goToMonth(mo: Month, direction: number) {
    view = clampMonth(mo);
    const visibleEnd = lastDay(addMonths(view, monthsShown() - 1));
    if (focused < firstDay(view) || focused > visibleEnd) focused = firstDay(view);
    render();
    slide(direction);
    // If the focused control just vanished or got disabled (a month shortcut, the last arrow), focus a day instead.
    const active = document.activeElement as HTMLButtonElement | null;
    if (!active || !dialog!.contains(active) || !active.isConnected || active.disabled) {
      monthsEl.querySelector<HTMLButtonElement>('.day[tabindex="0"]')?.focus({ preventScroll: true });
    }
  }

  /** Keyboard focus moves without animation: keyboard users want speed. */
  function moveFocus(d: ISODate) {
    const min = today;
    const max = lastDay(maxMonth);
    focused = d < min ? min : d > max ? max : d;
    const mo = monthOf(focused);
    if (monthIndex(mo) < monthIndex(view)) {
      view = clampMonth(mo);
      render();
    } else if (monthIndex(mo) > monthIndex(view) + monthsShown() - 1) {
      view = clampMonth(addMonths(mo, -(monthsShown() - 1)));
      render();
    } else updateDays();
    monthsEl.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }

  function pick(d: ISODate) {
    if (!isSelectable(d)) {
      if (inMinStayGap(d)) updateStatus(fill(t.errorMinStay, { n: rules.minNights }));
      return;
    }
    if (mode === 'departure' && arrival && d > arrival && canDepart(arrival, d, rules)) {
      departure = d;
      mode = 'arrival';
    } else {
      arrival = d;
      departure = null;
      mode = 'departure';
    }
    preview = null;
    focused = d;
    syncFields();
    updateDays();
    if (arrival && departure) updateNote();
  }

  // ---------- Open / close ----------
  function openCalendar(which: 'arrival' | 'departure', from: HTMLElement, searchAfter = false) {
    trigger = from;
    searchWhenDone = searchAfter;
    mode = which === 'departure' && arrival ? 'departure' : 'arrival';
    preview = null;
    focused =
      mode === 'departure' ? (departure ?? addDays(arrival!, rules.minNights)) : (arrival ?? firstArrival());
    view = clampMonth(monthOf(focused));
    render();

    dialog!.showModal();
    document.documentElement.style.overflow = 'hidden';
    monthsEl.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus({ preventScroll: true });

    gsap.killTweensOf([panel, scrim]);
    if (reduceMotion()) return;
    gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.24, ease: 'power2.out' });
    if (wide.matches) {
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' },
        { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.32, ease: 'power3.out', clearProps: 'all' },
      );
    } else {
      gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: 'power4.out', clearProps: 'all' });
    }
  }

  function closeCalendar({ search = false } = {}) {
    const finish = () => {
      dialog!.close();
      gsap.set([panel, scrim], { clearProps: 'all' });
      document.documentElement.style.overflow = '';
      trigger?.focus({ preventScroll: true });
      if (search && arrival && departure) form!.requestSubmit();
    };
    gsap.killTweensOf([panel, scrim]);
    if (reduceMotion() || !dialog!.open) return finish();
    // Leaving is quicker and quieter than arriving.
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(scrim, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0);
    if (wide.matches) tl.to(panel, { opacity: 0, scale: 0.98, y: 4, duration: 0.16, ease: 'power2.in' }, 0);
    else tl.to(panel, { yPercent: 100, duration: 0.28, ease: 'power3.in' }, 0);
  }

  // ---------- Events ----------
  fields.arrival.addEventListener('click', () => openCalendar('arrival', fields.arrival));
  fields.departure.addEventListener('click', () => openCalendar('departure', fields.departure));

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeCalendar();
  });
  dialog.querySelectorAll('[data-cal-close]').forEach((el) => el.addEventListener('click', () => closeCalendar()));
  doneBtn.addEventListener('click', () => closeCalendar({ search: searchWhenDone }));
  document.addEventListener(EDIT_SEARCH_EVENT, (event) => {
    const from = (event as CustomEvent<{ trigger?: HTMLElement }>).detail?.trigger ?? fields.arrival;
    openCalendar('arrival', from, true);
  });
  clearBtn.addEventListener('click', () => {
    arrival = departure = preview = null;
    mode = 'arrival';
    syncFields();
    updateDays();
  });
  prevBtn.addEventListener('click', () => goToMonth(addMonths(view, -1), -1));
  nextBtn.addEventListener('click', () => goToMonth(addMonths(view, 1), 1));

  monthsEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.day');
    if (button) pick(button.dataset.date!);
  });

  monthsEl.addEventListener('focusin', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.day');
    if (button) focused = button.dataset.date!;
  });

  monthsEl.addEventListener('keydown', (event) => {
    if (!(event.target as HTMLElement).closest('.day')) return;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: ISODate | null = null;
    if (event.key in steps) next = addDays(focused, steps[event.key]);
    else if (event.key === 'Home') next = addDays(focused, -weekdayIndex(focused));
    else if (event.key === 'End') next = addDays(focused, 6 - weekdayIndex(focused));
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const mo = addMonths(monthOf(focused), (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
      next = `${mo.y}-${pad(mo.m + 1)}-${pad(Math.min(Number(focused.slice(8)), daysIn(mo)))}`;
    }
    if (!next) return;
    event.preventDefault();
    moveFocus(next);
  });

  // Mouse hover previews the stay while choosing the departure day.
  monthsEl.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse' || mode !== 'departure' || !arrival) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.day');
    const d = button?.dataset.date ?? null;
    const next = d && canDepart(arrival, d, rules) ? d : null;
    if (next !== preview) {
      preview = next;
      updateDays();
    }
  });
  monthsEl.addEventListener('pointerleave', () => {
    if (preview) {
      preview = null;
      updateDays();
    }
  });

  wide.addEventListener('change', () => {
    if (dialog.open) goToMonth(view, 0);
  });

  minus.addEventListener('click', () => setGuests(guests - 1, -1));
  plus.addEventListener('click', () => setGuests(guests + 1, 1));
  petInput?.addEventListener('change', () => updateNote());

  // ---------- Search ----------
  function updateLanguageLinks(params: URLSearchParams) {
    const query = params.toString();
    document.querySelectorAll<HTMLAnchorElement>('.lang a[hreflang]').forEach((link) => {
      const url = new URL(link.href);
      url.search = query;
      link.href = url.pathname + url.search;
    });
  }

  function dispatch(source: SearchEventDetail['source']) {
    const detail: SearchEventDetail = { arrival: arrival!, departure: departure!, guests, pet: wantsPet(), source };
    const params = new URLSearchParams({
      checkin: detail.arrival,
      checkout: detail.departure,
      guests: String(detail.guests),
      pet: detail.pet ? '1' : '0',
    });
    history.replaceState(null, '', `${location.pathname}?${params}`);
    updateLanguageLinks(params);
    document.dispatchEvent(new CustomEvent<SearchEventDetail>(SEARCH_EVENT, { detail }));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const check = checkStay(arrival, departure, today, rules);
    if (check === 'ok') {
      updateNote();
      dispatch('form');
      return;
    }
    const message = check === 'minStay' ? fill(t.errorMinStay, { n: rules.minNights }) : t.errorDates;
    updateNote(message);
    const which = arrival && check !== 'arrival' ? 'departure' : 'arrival';
    openCalendar(which, fields[which]);
  });

  // ---------- Start: restore a search from the address (shared links, language switch) ----------
  const params = new URLSearchParams(location.search);
  const urlArrival = params.get('checkin');
  const urlDeparture = params.get('checkout');
  const urlGuests = Number(params.get('guests'));
  if (Number.isInteger(urlGuests) && urlGuests >= 1) guests = Math.min(urlGuests, maxGuests);
  if (petInput) petInput.checked = params.get('pet') === '1';
  if (isISODate(urlArrival) && isISODate(urlDeparture) && checkStay(urlArrival, urlDeparture, today, rules) === 'ok') {
    arrival = urlArrival;
    departure = urlDeparture;
  }

  syncFields();
  setGuests(guests);
  if (arrival && departure) requestAnimationFrame(() => dispatch('url'));
}
