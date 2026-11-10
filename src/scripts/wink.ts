/**
 * The wink on the hero photo (desktop only, hidden by CSS on phones):
 * a click shows a short note about the photo, another click, Escape, a click elsewhere
 * or a few seconds later hides it again.
 */
export function initWink() {
  const wink = document.querySelector<HTMLElement>('[data-wink]');
  const button = wink?.querySelector<HTMLButtonElement>('[data-wink-button]');
  if (!wink || !button) return;

  let timer = 0;

  function setOpen(open: boolean) {
    clearTimeout(timer);
    wink!.toggleAttribute('data-open', open);
    button!.setAttribute('aria-expanded', String(open));
    if (open) timer = window.setTimeout(() => setOpen(false), 7000);
  }

  button.addEventListener('click', () => setOpen(!wink.hasAttribute('data-open')));
  document.addEventListener('pointerdown', (event) => {
    if (!wink.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}
