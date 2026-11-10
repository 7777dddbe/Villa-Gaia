import { gsap } from 'gsap';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Full-screen menu on phones. Opens with one short movement; closes faster and quieter. */
export function initMenu() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const button = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const label = document.querySelector<HTMLElement>('[data-menu-label]');
  if (!header || !button || !menu) return;

  const links = Array.from(menu.querySelectorAll<HTMLAnchorElement>('[data-menu-link]'));
  let isOpen = false;

  function open() {
    isOpen = true;
    menu!.hidden = false;
    header!.classList.add('is-menu-open');
    button!.setAttribute('aria-expanded', 'true');
    if (label) label.textContent = button!.dataset.labelClose ?? '';
    document.documentElement.style.overflow = 'hidden';

    gsap.killTweensOf(menu);
    if (reducedMotion()) {
      gsap.set(menu, { clearProps: 'all' });
    } else {
      // Navigation should feel quick: one short movement for the whole sheet, no cascade.
      gsap.fromTo(menu, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out', clearProps: 'transform' });
    }
    // Focus stays on the toggle: the menu follows the header, so Tab moves straight into the links.
  }

  function close({ restoreFocus = true } = {}) {
    isOpen = false;
    header!.classList.remove('is-menu-open');
    button!.setAttribute('aria-expanded', 'false');
    if (label) label.textContent = button!.dataset.labelOpen ?? '';
    document.documentElement.style.overflow = '';

    const hide = () => {
      menu!.hidden = true;
      gsap.set(menu, { clearProps: 'all' });
    };
    gsap.killTweensOf(menu);
    if (reducedMotion()) hide();
    else gsap.to(menu, { autoAlpha: 0, duration: 0.16, ease: 'power2.in', onComplete: hide });
    if (restoreFocus) button!.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => (isOpen ? close() : open()));
  links.forEach((link) => link.addEventListener('click', () => close({ restoreFocus: false })));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) close();
  });
  // If the window grows to desktop size, the phone menu is no longer there.
  window.matchMedia('(min-width: 56rem)').addEventListener('change', (event) => {
    if (event.matches && isOpen) close({ restoreFocus: false });
  });
}
