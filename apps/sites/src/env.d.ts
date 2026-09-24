/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * True when the shop is served on its own host (subdomain or custom
     * domain), so links are "/barbers/x" rather than "/<slug>/barbers/x".
     */
    hostMode: boolean;
  }
}
