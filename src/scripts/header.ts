import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * The header is see-through while only the photo is behind it, and turns solid white
 * as soon as the hero title would slide underneath it.
 */
export function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!header || !hero) return;
  const title = hero.querySelector<HTMLElement>('.hero__title') ?? hero;

  ScrollTrigger.create({
    trigger: hero,
    start: 'top bottom',
    endTrigger: title,
    end: () => `top top+=${header.offsetHeight + 8}`,
    toggleClass: { targets: header, className: 'is-over-hero' },
  });
}
