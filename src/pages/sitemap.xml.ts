import type { APIRoute } from 'astro';
import site from '../config/sito.json';
import { languages, pathFor } from '../i18n';

/** Sitemap with the three language versions, each pointing to the others (hreflang). */
export const GET: APIRoute = () => {
  const url = (path: string) => new URL(path, site.dominio).href;
  const alternates = [
    ...languages.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(pathFor(l))}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${url('/')}"/>`,
  ].join('\n');
  const today = new Date().toISOString().slice(0, 10);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${languages
  .map((l) => `  <url>\n    <loc>${url(pathFor(l))}</loc>\n    <lastmod>${today}</lastmod>\n${alternates}\n  </url>`)
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
