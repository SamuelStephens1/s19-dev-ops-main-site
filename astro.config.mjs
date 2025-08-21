// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';          // ✅ add MDX
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Build for Cloudflare Workers
  output: 'server',
  adapter: cloudflare(),

  // Used for absolute URLs in RSS/Sitemap/OpenGraph
  site: 'https://s19devops.com',

  // Enable MDX pages/posts
  integrations: [mdx()],

  vite: {
    plugins: [tailwindcss()],
  },
});
