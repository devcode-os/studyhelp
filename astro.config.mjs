import { defineConfig } from 'astro/config';
import mkcert from 'vite-plugin-mkcert';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://studyhelp.fdaytalk.com',
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/account/') &&
        !page.includes('/login/') &&
        !page.includes('/signup/') &&
        !page.includes('/forgot-passcode/') &&
        !page.includes('/master-access/') &&
        !page.includes('/payment-processing/'),
    }),
  ],
  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [mkcert()],
    server: {
      https: true
    }
  }
});