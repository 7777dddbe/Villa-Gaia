// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

/**
 * On Netlify, /api/disponibilita is a Netlify Function. During `npm run dev` this serves
 * the same function file, so availability works locally too. GOOGLE_* and ICAL_* variables
 * can be put in a local .env file to try the real calendars.
 * @returns {import('astro').AstroIntegration}
 */
function netlifyFunctionsInDev() {
  return {
    name: 'netlify-functions-in-dev',
    hooks: {
      'astro:server:setup': ({ server }) => {
        Object.assign(process.env, loadEnv('development', process.cwd(), ['GOOGLE_', 'ICAL_']));
        server.middlewares.use('/api/disponibilita', async (req, res) => {
          try {
            const { default: handler } = await server.ssrLoadModule('/netlify/functions/disponibilita.mts');
            /** @type {Response} */
            const response = await handler(new Request(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost')));
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(await response.text());
          } catch (error) {
            console.error(error);
            res.statusCode = 500;
            res.end();
          }
        });
      },
    },
  };
}

export default defineConfig({
  site: 'https://residencevillagaia.com',
  trailingSlash: 'ignore',
  // Keep the classic whitespace handling so inline text never glues together.
  compressHTML: true,
  integrations: [netlifyFunctionsInDev()],
});
