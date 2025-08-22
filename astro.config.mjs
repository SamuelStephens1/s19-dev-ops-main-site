// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://s19devops.com",
  output: "server",
  adapter: cloudflare({
    // ✅ optimize images at build, not at runtime
    imageService: "compile",
    // keep local dev proxy
    platformProxy: { enabled: true },
  }),
  integrations: [
    mdx(),
    sitemap({ changefreq: "weekly", priority: 0.7 }),
  ],
});
