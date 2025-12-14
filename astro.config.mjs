// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://prog.lactoflow.com.br",
  redirects: {
    // "/promo-25-05": "/",
    "/bf-25": "/",
  },
  output: "server",

  adapter: cloudflare({
    imageService: 'cloudflare',
    platformProxy: { enabled: true },
  }),

  integrations: [react({ experimentalReactChildren: true })],

  vite: {
    plugins: [tailwindcss()],
  },
});
