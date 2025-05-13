// @ts-check
import { defineConfig } from "astro/config";

import node from "@astrojs/node";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://prog.lactoflow.com.br",
  redirects: {
    "/promo-25-05": "/",
  },
  output: "server",

  adapter: node({
    mode: "standalone",
  }),

  integrations: [react({ experimentalReactChildren: true })],

  vite: {
    plugins: [tailwindcss()],
  },
});
