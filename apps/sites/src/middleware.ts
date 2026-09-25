import { SITES_ROOT_DOMAIN } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { siteByDomain } from "./lib/api";
import { resolveTenant } from "./lib/tenant";

/** Paths that are never shop pages. */
const PASSTHROUGH = /^\/(_astro|_image|favicon|robots\.txt|api\/revalidate)/;

/**
 * Maps subdomains and custom domains onto the path-based routes, so
 * southsidecuts.com/barbers/marcus renders /southside-cuts/barbers/marcus.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.hostMode = false;
  const { pathname } = context.url;
  if (PASSTHROUGH.test(pathname)) return next();

  const tenant = resolveTenant(
    context.request.headers.get("host") ?? context.url.host,
    SITES_ROOT_DOMAIN,
  );
  if (tenant.kind === "path") return next();

  let slug: string | undefined;
  if (tenant.kind === "subdomain") slug = tenant.slug;
  else slug = (await siteByDomain(tenant.domain))?.shop.slug;
  if (!slug) return new Response("Not found", { status: 404 });

  context.locals.hostMode = true;
  return next(`/${slug}${pathname === "/" ? "" : pathname}`);
});
