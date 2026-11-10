import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SEARCH_EVENT, type SearchEventDetail } from './booking';
import { stayMessage, whatsappUrl } from '../lib/whatsapp';

/**
 * The general WhatsApp buttons (contact section and the phone bar).
 * Before a search they send the generic message; after one, the guest's dates.
 */
export function initContact() {
  const links = document.querySelectorAll<HTMLAnchorElement>('[data-wa-link]');
  document.addEventListener(SEARCH_EVENT, (event) => {
    const { arrival, departure, guests, pet } = (event as CustomEvent<SearchEventDetail>).detail;
    const url = whatsappUrl(stayMessage({ arrival, departure, guests, pet }));
    links.forEach((link) => (link.href = url));
  });

  // Phone bar: shows up once the search box has scrolled away, steps aside at the contact section.
  const bar = document.querySelector<HTMLAnchorElement>('[data-wa-bar]');
  const booking = document.querySelector('[data-booking]');
  const contact = document.querySelector('#contact');
  if (!bar || !booking || !contact) return;

  const setVisible = (visible: boolean) => {
    bar.classList.toggle('is-visible', visible);
    bar.setAttribute('aria-hidden', String(!visible));
    bar.tabIndex = visible ? 0 : -1;
  };

  ScrollTrigger.create({
    trigger: booking,
    start: 'bottom top',
    endTrigger: contact,
    end: 'top bottom',
    onToggle: (self) => setVisible(self.isActive),
    onRefresh: (self) => setVisible(self.isActive),
  });
}
