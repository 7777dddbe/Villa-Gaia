import { gsap } from 'gsap';

interface HeroOptions {
  motion: boolean;
  mobile: boolean;
}

/**
 * One orchestrated entrance, played once per visit: the photo settles,
 * the title rises line by line, then the subtitle comes into focus.
 * Afterwards the photo drifts slightly slower than the page (light parallax)
 * and the title sinks behind the mountains.
 */
export function initHero({ motion, mobile }: HeroOptions) {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;

  const header = document.querySelector<HTMLElement>('[data-header] [data-intro]');
  const title = hero.querySelector<HTMLElement>('.hero__title');
  const lines = hero.querySelectorAll<HTMLElement>('[data-hero-line]');
  const subtitle = hero.querySelector<HTMLElement>('[data-hero-sub]');
  const booking = hero.querySelector<HTMLElement>('[data-booking]');
  // Background photo and its sky-less copy in front of the title: they always move together.
  const photos = hero.querySelectorAll<HTMLElement>('[data-hero-photo]');
  const parallax = hero.querySelectorAll<HTMLElement>('[data-hero-parallax]');
  const intro = [header, title, subtitle, booking].filter((el): el is HTMLElement => el !== null);

  if (!motion) {
    gsap.set(intro, { autoAlpha: 1 });
    return;
  }

  const playIntro = !hero.dataset.introPlayed;
  hero.dataset.introPlayed = 'true';

  if (playIntro) {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(photos, { scale: 1.08 }, { scale: 1, duration: 1.8, ease: 'power2.out' }, 0)
      .fromTo(lines, { yPercent: 108 }, { yPercent: 0, duration: 1.1, stagger: 0.12, ease: 'power4.out' }, 0.15)
      .fromTo(
        subtitle,
        { autoAlpha: 0, y: 12, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, clearProps: 'filter' },
        0.6,
      )
      .fromTo(
        booking,
        { autoAlpha: 0, y: 16, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, clearProps: 'filter,transform' },
        0.75,
      )
      .fromTo(header, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.45);
    // The lines start below their masks, so the title itself can be shown right away.
    gsap.set(title, { autoAlpha: 1 });
  } else {
    gsap.set(intro, { autoAlpha: 1 });
  }

  const scroll = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
  gsap.to(parallax, { yPercent: mobile ? 5 : 9, ease: 'none', scrollTrigger: { ...scroll } });

  // Depth: while scrolling, the title sinks faster than the landscape and slips behind the mountains.
  if (title && hero.classList.contains('hero--depth')) {
    gsap.to(title, { y: () => hero.offsetHeight * (mobile ? 0.16 : 0.22), ease: 'none', scrollTrigger: { ...scroll } });
  }
}
