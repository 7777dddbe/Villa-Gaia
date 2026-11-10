import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EDIT_SEARCH_EVENT } from './booking';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Gallery {
  reset: () => void;
}

/** Horizontal photo gallery: native swipe and scroll-snap, plus arrow buttons and a counter. */
function initGallery(root: HTMLElement): Gallery {
  const track = root.querySelector<HTMLElement>('[data-gallery-track]')!;
  const slides = Array.from(track.children) as HTMLElement[];
  const prev = root.querySelector<HTMLButtonElement>('[data-gallery-prev]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-gallery-next]')!;
  const index = root.querySelector<HTMLElement>('[data-gallery-index]')!;

  const step = () => (slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : 0) || track.clientWidth || 1;
  const current = () => Math.min(slides.length - 1, Math.max(0, Math.round(track.scrollLeft / step())));
  const atEnd = () => track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;

  function update() {
    const i = current();
    index.textContent = String(i + 1);
    prev.setAttribute('aria-disabled', String(i === 0));
    next.setAttribute('aria-disabled', String(i >= slides.length - 1 || atEnd()));
  }

  function go(direction: number) {
    const button = direction < 0 ? prev : next;
    if (button.getAttribute('aria-disabled') === 'true') return;
    track.scrollTo({ left: (current() + direction) * step(), behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  let frame = 0;
  track.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  update();

  return {
    reset() {
      track.scrollLeft = 0;
      update();
    },
  };
}

/**
 * Apartment tabs (Gaia 1, Gaia 2, Gaia 3). Switching is a short choreography:
 * the old panel steps back, the new photos slide in from the side of the chosen tab.
 */
export function initApartments() {
  const section = document.querySelector<HTMLElement>('[data-apartments]');
  if (!section) return;

  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-apt-tab]'));
  const panels = tabs.map((tab) => section.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`)!);
  const galleries = new Map(panels.map((panel) => [panel, initGallery(panel.querySelector<HTMLElement>('[data-gallery]')!)]));
  const indicator = section.querySelector<HTMLElement>('[data-apt-indicator]')!;
  let active = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));

  const parts = (panel: HTMLElement) => [panel, ...panel.querySelectorAll<HTMLElement>('.gallery__slide, [data-apt-info]')];
  const clear = (panel: HTMLElement) => {
    gsap.killTweensOf(parts(panel));
    gsap.set(parts(panel), { clearProps: 'opacity,visibility,transform,filter' });
  };

  function enter(panel: HTMLElement, direction: number) {
    const slides = panel.querySelectorAll('.gallery__slide');
    const info = panel.querySelector('[data-apt-info]');
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(
        slides,
        { x: direction * 48, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, clearProps: 'transform,opacity,visibility' },
        0,
      )
      .fromTo(
        info,
        { y: 12, autoAlpha: 0, filter: 'blur(4px)' },
        { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.5, clearProps: 'transform,opacity,visibility,filter' },
        0.08,
      );
  }

  function select(index: number, focus = false) {
    if (focus) tabs[index].focus();
    if (index === active) return;
    const direction = index > active ? 1 : -1;
    const previous = panels[active];
    const next = panels[index];
    active = index;

    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });

    const reduce = reduceMotion();
    if (reduce) gsap.set(indicator, { xPercent: index * 100 });
    else gsap.to(indicator, { xPercent: index * 100, duration: 0.45, ease: 'power3.out', overwrite: true });

    // A quick second click may interrupt a switch: only the panel being left can still be on screen.
    panels.forEach((panel) => {
      if (panel !== previous) {
        clear(panel);
        panel.hidden = true;
      }
    });

    const show = () => {
      clear(previous);
      previous.hidden = true;
      next.hidden = false;
      galleries.get(next)?.reset();
      ScrollTrigger.refresh(true);
      if (!reduce) enter(next, direction);
    };

    if (reduce || previous.hidden) return show();
    gsap.killTweensOf(parts(previous));
    gsap.to(previous, { autoAlpha: 0, y: -6, filter: 'blur(4px)', duration: 0.18, ease: 'power2.in', onComplete: show });
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));

  // Arrow keys move between tabs and show them right away (automatic activation).
  section.querySelector('[data-apt-tabs]')!.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    const last = tabs.length - 1;
    const target =
      key === 'ArrowRight' ? (active + 1) % tabs.length
      : key === 'ArrowLeft' ? (active - 1 + tabs.length) % tabs.length
      : key === 'Home' ? 0
      : key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    select(target, true);
  });

  // "Check dates for Gaia 1" opens the calendar; after Done the search runs.
  section.querySelectorAll<HTMLButtonElement>('[data-apt-book]').forEach((button) =>
    button.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent(EDIT_SEARCH_EVENT, { detail: { trigger: button } })),
    ),
  );
}
