import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initMenu } from './menu';
import { initHeader } from './header';
import { initHero } from './hero';
import { initBooking } from './booking';
import { initResults } from './results';
import { initApartments } from './apartments';
import { initWink } from './wink';
import { initReveals } from './reveal';
import { initMap } from './map';
import { initContact } from './contact';

gsap.registerPlugin(ScrollTrigger);

initMenu();
initResults();
initBooking();
initApartments();
initWink();
initMap();

// Wait for the fonts (at most 800 ms) so the title is measured with its real typeface.
const fontsReady = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 800))]);

fontsReady.then(() => {
  const mm = gsap.matchMedia();

  // Everything created here is reverted and rebuilt when one of these conditions changes.
  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      reduce: '(prefers-reduced-motion: reduce)',
      mobile: '(max-width: 47.99rem)',
    },
    (context) => {
      const { motion = false, mobile = false } = context.conditions ?? {};
      // ScrollTriggers are created in page order, top to bottom.
      initHeader();
      initHero({ motion, mobile });
      initReveals({ motion, mobile });
    },
  );

  initContact();
  ScrollTrigger.refresh();
});
