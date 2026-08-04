import { defineConfig } from 'astro/config';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  output: 'static',
  site: 'https://your-site.pages.dev',
  vite: {
    plugins: [mkcert()],
    server: {
      https: true
    }
  }
});
