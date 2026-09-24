/**
 * How a request maps to a shop:
 * - `<slug>.<rootDomain>` → that shop, served at the root of the host
 * - any other host that isn't the platform's own → a custom domain lookup
 * - otherwise → path mode, /<slug>/...
 */
export type Tenant =
  { kind: "subdomain"; slug: string } | { kind: "domain"; domain: string } | { kind: "path" };

/** Hosts that always use path mode (the platform's own deployment and local dev). */
function isPlatformHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".localhost")
  );
}

export function resolveTenant(hostHeader: string, rootDomain: string | undefined): Tenant {
  const host =
    hostHeader
      .toLowerCase()
      .split(":")[0]
      ?.replace(/^www\./, "") ?? "";
  const root = rootDomain?.toLowerCase().replace(/^\./, "");

  if (root && host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));
    if (/^[a-z0-9-]{1,63}$/.test(slug)) return { kind: "subdomain", slug };
  }
  if (!host || isPlatformHost(host) || host === root) return { kind: "path" };
  return { kind: "domain", domain: host };
}
