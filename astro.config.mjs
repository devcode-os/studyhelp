import { defineConfig } from 'astro/config';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  output: 'static',
  site: 'https://your-site.pages.dev',
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