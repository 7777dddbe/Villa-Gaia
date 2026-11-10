import type { ImageMetadata } from 'astro';

// Every photo under src/assets/foto/<folder>/, optimised by Astro at build time.
const all = import.meta.glob<ImageMetadata>('/src/assets/foto/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

/** Photos of one folder ("hero", "gaia1"...), in file name order: 01.jpg, 02.jpg, 10.jpg. */
export function photosOf(folder: string): ImageMetadata[] {
  return Object.entries(all)
    .filter(([path]) => path.split('/').at(-2) === folder)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, image]) => image);
}
