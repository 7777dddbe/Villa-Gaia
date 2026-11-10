import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from '../config/appartamenti.json';
import site from '../config/sito.json';
import { EDIT_SEARCH_EVENT, SEARCH_EVENT, type SearchEventDetail } from './booking';
import { petFriendlyNames } from '../lib/booking-rules';
import { fromISO, nightsBetween, yearOf, todayISO, type ISODate } from '../lib/dates';
import { quote } from '../lib/pricing';
import { PLACEHOLDER } from '../lib/placeholder';
import { fill } from '../lib/text';
import { stayMessage, whatsappUrl } from '../lib/whatsapp';

type Texts = Record<string, string>;
interface Availability {
  liberi: string[];
  /** Calendars read, joined by "+" (e.g. "google+booking-gaia1"), or "prova" for the sample bookings. */
  fonte: string;
}

const petsAllowed = site.animali.ammessi as Record<string, boolean>;
const apartments = data.appartamenti;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Shows which apartments are free for the search, with Booking.com and direct prices side by side. */
export function initResults() {
  const section = document.querySelector<HTMLElement>('[data-results]');
  if (!section) return;

  const { locale, texts: r, search: s } = JSON.parse(section.dataset.config ?? '{}') as {
    locale: string;
    texts: Texts;
    search: Texts;
  };
  const q = <T extends Element>(sel: string) => section.querySelector<T>(sel)!;
  const title = q<HTMLElement>('[data-results-title]');
  const summary = q<HTMLElement>('[data-results-summary]');
  const status = q<HTMLElement>('[data-results-status]');
  const list = q<HTMLElement>('[data-results-list]');
  const change = q<HTMLButtonElement>('[data-results-change]');

  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const euro = (n: number) => money.format(n);
  const utc = { timeZone: 'UTC' } as const;
  const fmtShort = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short', day: 'numeric', month: 'short' });
  const fmtShortYear = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const showDate = (d: ISODate) => (yearOf(d) === yearOf(todayISO()) ? fmtShort : fmtShortYear).format(fromISO(d));
  const listFormat = new Intl.ListFormat(locale, { type: 'conjunction' });
  const nightsText = (n: number) => (n === 1 ? s.nightsOne : fill(s.nightsOther, { n }));
  const guestsText = (n: number) => (n === 1 ? s.guestsOne : fill(s.guestsOther, { n }));

  let controller: AbortController | null = null;
  let triggers: ScrollTrigger[] = [];

  change.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent(EDIT_SEARCH_EVENT, { detail: { trigger: change } }));
  });

  document.addEventListener(SEARCH_EVENT, (event) => run((event as CustomEvent<SearchEventDetail>).detail));

  async function run(search: SearchEventDetail) {
    controller?.abort();
    controller = new AbortController();
    const { arrival, departure, guests, pet } = search;

    section!.hidden = false;
    title.textContent = s.title;
    summary.textContent = `${fill(s.range, { arrivo: showDate(arrival), partenza: showDate(departure) })}, ${nightsText(nightsBetween(arrival, departure))}, ${guestsText(guests)}`;
    status.textContent = r.loading;
    list.replaceChildren();
    list.setAttribute('aria-busy', 'true');
    triggers.forEach((t) => t.kill());
    triggers = [];

    if (search.source === 'form') {
      section!.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      title.focus({ preventScroll: true });
    }

    let availability: Availability;
    try {
      const params = new URLSearchParams({ checkin: arrival, checkout: departure });
      const response = await fetch(`/api/disponibilita?${params}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      availability = (await response.json()) as Availability;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error(error);
      status.textContent = '';
      showEmpty(search, r.error, false);
      return;
    }

    status.replaceChildren();
    if (availability.fonte === 'prova') {
      // Visible reminder for the owner until a calendar is connected.
      const chip = document.createElement('span');
      chip.className = 'da-completare';
      chip.textContent = PLACEHOLDER;
      status.append(chip, ' Disponibilità di prova: nessun calendario ancora collegato.');
    }

    const free = apartments.filter((a) => availability.liberi.includes(a.id));
    const bigEnough = free.filter((a) => a.postiLetto >= guests);
    const fitting = bigEnough.filter((a) => !pet || petsAllowed[a.id]);

    if (!fitting.length) {
      let reason = '';
      if (free.length && !bigEnough.length) reason = fill(r.noneGuests, { n: Math.max(...free.map((a) => a.postiLetto)) });
      else if (bigEnough.length && pet) reason = fill(r.nonePet, { nomi: listFormat.format(petFriendlyNames) });
      showEmpty(search, reason, true);
      return;
    }

    title.textContent = r.title;
    const cards = fitting.map((apartment) => card(apartment, search));
    list.replaceChildren(...cards);
    list.removeAttribute('aria-busy');
    reveal(cards);
    if (search.source === 'form') scrollToCards();
  }

  /**
   * After a search from the form, scroll so the whole row of apartment cards is on screen,
   * just under the fixed header. Measured in page coordinates, so it stays right while the
   * earlier scroll to the section is still running.
   */
  function scrollToCards() {
    const header = document.querySelector<HTMLElement>('[data-header]')?.offsetHeight ?? 72;
    const top = list.getBoundingClientRect().top + window.scrollY - header - 24;
    window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function card(apartment: (typeof apartments)[number], search: SearchEventDetail): HTMLElement {
    const template = section!.querySelector<HTMLTemplateElement>(`template[data-card="${apartment.id}"]`)!;
    const node = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const slot = (name: string) => node.querySelector<HTMLElement>(`[data-slot="${name}"]`)!;
    const { arrival, departure, guests, pet } = search;
    const price = quote(apartment.id, arrival, departure, pet);
    const cta = slot('cta') as HTMLAnchorElement;

    if (price) {
      slot('nights').textContent = fill(r.total, { notti: nightsText(price.nights) });
      slot('booking').textContent = euro(price.bookingTotal);
      slot('saving').textContent = fill(r.direct, { risparmio: euro(price.saving) });
      slot('direct').textContent = euro(price.directTotal);
      slot('direct-shown').textContent = euro(reduceMotion() ? price.directTotal : price.bookingTotal);
      slot('average').textContent = fill(r.average, { prezzo: euro(price.averagePerNight) });
      if (price.petFee > 0) {
        slot('pet-fee').textContent = fill(r.petFee, { prezzo: euro(price.petFee) });
        slot('pet-fee').hidden = false;
      }
      node.dataset.from = String(price.bookingTotal);
      node.dataset.to = String(price.directTotal);
      cta.href = whatsappUrl(stayMessage({ apartment: apartment.nome, arrival, departure, guests, pet, price: price.directTotal }));
    } else {
      // A night without a price in prezzi.json: no numbers, the guest asks on WhatsApp.
      slot('prices').remove();
      slot('price-missing').hidden = false;
      cta.href = whatsappUrl(stayMessage({ apartment: apartment.nome, arrival, departure, guests, pet }));
    }
    return node;
  }

  function showEmpty(search: SearchEventDetail, reason: string, withAdvice: boolean) {
    title.textContent = withAdvice ? r.noneTitle : s.title;
    const node = (section!.querySelector<HTMLTemplateElement>('template[data-empty]')!.content.firstElementChild!.cloneNode(true)) as HTMLElement;
    node.querySelector<HTMLElement>('[data-slot="reason"]')!.textContent = reason;
    if (!withAdvice) node.querySelector('[data-slot="text"]')!.remove();
    const { arrival, departure, guests, pet } = search;
    node.querySelector<HTMLAnchorElement>('[data-slot="cta"]')!.href = whatsappUrl(stayMessage({ arrival, departure, guests, pet }));
    list.replaceChildren(node);
    list.removeAttribute('aria-busy');
    reveal([node]);
  }

  /** Cards come into focus one after the other; the direct price then drops from the Booking.com price. */
  function reveal(nodes: HTMLElement[]) {
    // Safe refresh: waits for the smooth scroll to the results to finish instead of cutting it short.
    ScrollTrigger.refresh(true);
    if (reduceMotion()) return;

    gsap.fromTo(
      nodes,
      { autoAlpha: 0, y: 16, filter: 'blur(4px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'filter,transform' },
    );

    nodes.forEach((node) => {
      const shown = node.querySelector<HTMLElement>('[data-slot="direct-shown"]');
      if (!shown || !node.dataset.from) return;
      const value = { n: Number(node.dataset.from) };
      const to = Number(node.dataset.to);
      triggers.push(
        ScrollTrigger.create({
          trigger: node,
          start: 'top 75%',
          once: true,
          onEnter: () =>
            gsap.to(value, {
              n: to,
              duration: 0.9,
              delay: 0.25,
              ease: 'power3.out',
              onUpdate: () => (shown.textContent = euro(Math.round(value.n))),
            }),
        }),
      );
    });
  }
}
