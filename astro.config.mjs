// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 1) Build for Workers (not static)
  output: 'server',

  // 2) Use the official Cloudflare adapter
  adapter: cloudflare(),

  // 3) Your public URL (used for sitemap, RSS, etc.)
  site: 'https://s19devops.com',

  vite: {
    plugins: [tailwindcss()],
  },
});