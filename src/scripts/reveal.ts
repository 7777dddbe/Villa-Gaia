import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface MotionOptions {
  motion: boolean;
  mobile: boolean;
}

/**
 * Scroll reveals, each played once, with two distinct gestures:
 * - section titles and intros simply rise into place (no blur: text should be readable at once);
 * - photos and the map open from a slightly smaller frame.
 * Lists, controls and reviews do not animate. Nothing runs with reduced motion.
 */
export function initReveals({ motion, mobile }: MotionOptions) {
  if (!motion) return;

  // Only prepare what is still below the fold, so nothing already on screen blinks.
  const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.88;

  const texts = gsap.utils.toArray<HTMLElement>('[data-reveal]').filter(below);
  gsap.set(texts, { autoAlpha: 0, y: 12 });
  ScrollTrigger.batch(texts, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', overwrite: true }),
  });

  const frames = gsap.utils.toArray<HTMLElement>('[data-reveal-frame]').filter(below);
  gsap.set(frames, { clipPath: 'inset(7% 5% 7% 5% round 28px)' });
  ScrollTrigger.batch(frames, {
    start: 'top 85%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        clipPath: 'inset(0% 0% 0% 0% round 28px)',
        duration: 1.1,
        stagger: 0.08,
        ease: 'power3.out',
        overwrite: true,
        clearProps: 'clipPath',
      }),
  });

  const stage = document.querySelector<HTMLElement>('[data-apt-stage]');
  if (!stage) return;
  gsap.fromTo(
    stage.querySelectorAll('.gallery__parallax'),
    { yPercent: mobile ? -2.5 : -4 },
    {
      yPercent: mobile ? 2.5 : 4,
      ease: 'none',
      scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: true },
    },
  );
}
