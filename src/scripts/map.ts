interface Place {
  lat: number;
  lng: number;
  label: string;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * OpenStreetMap map of Malcesine. Leaflet and the map tiles load only when the
 * section gets close, so the first page view stays light. No cookies are set.
 */
export function initMap() {
  const el = document.querySelector<HTMLElement>('[data-map]');
  if (!el) return;

  const observer = new IntersectionObserver(
    async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();

      const L = (await import('leaflet')).default;
      const { markers, house } = JSON.parse(el.dataset.config ?? '{}') as { markers: Place[]; house: Place | null };
      // On touch screens one finger keeps scrolling the page; the + and − buttons still zoom.
      const touch = window.matchMedia('(pointer: coarse)').matches;

      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const map = L.map(el, {
        scrollWheelZoom: false,
        dragging: !touch,
        zoomSnap: 0.5,
        zoomAnimation: !still,
        fadeAnimation: !still,
        markerZoomAnimation: !still,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

      const pin = (place: Place, extra = '') =>
        L.marker([place.lat, place.lng], {
          icon: L.divIcon({ className: '', html: `<span class="map-pin ${extra}">${escapeHtml(place.label)}</span>`, iconSize: [0, 0] }),
          interactive: false,
          keyboard: false,
        }).addTo(map);

      markers.forEach((place) => pin(place));
      if (house) pin(house, 'map-pin--house');

      const all = house ? [...markers, house] : markers;
      // Labels sit to the right of each dot, so leave more room on that side.
      map.fitBounds(L.latLngBounds(all.map((p) => [p.lat, p.lng] as [number, number])), {
        paddingTopLeft: [40, 48],
        paddingBottomRight: [170, 48],
        maxZoom: 16,
      });
    },
    { rootMargin: '400px 0px' },
  );
  observer.observe(el);
}
