// @ts-check
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  // Every page is rendered per request: one deployment serves every shop.
  output: "server",
  adapter: process.env.VERCEL ? vercel() : node({ mode: "standalone" }),
  // Pages build their own absolute URLs from the request host.
  trailingSlash: "ignore",
  env: {
    schema: {
      /** Base URL of the Lineup web app, e.g. https://lineup-web-southwell-media.vercel.app */
      LINEUP_API_URL: envField.string({ context: "server", access: "public", url: true }),
      /**
       * Hosts that serve tenants by subdomain, e.g. "lineup.site" makes
       * southside-cuts.lineup.site the Southside Cuts site. Optional.
       */
      SITES_ROOT_DOMAIN: envField.string({ context: "server", access: "public", optional: true }),
      /** Vercel protection bypass for calling a protected preview of the web app. Optional. */
      LINEUP_API_BYPASS: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: { noExternal: ["@lineup/site-kit"] },
  },
});
