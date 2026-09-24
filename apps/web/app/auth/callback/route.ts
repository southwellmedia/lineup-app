import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

/**
 * Where sign-in links land. Supports both link styles Supabase can send:
 * - `?code=` (PKCE): only works in the browser that requested the link.
 * - `?token_hash=&type=`: works on any device. Use this in the email
 *   template: {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
 *
 * After signing in, links any staff invites sent to this email, then
 * continues to `next`.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const supabase = await createUserClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  await supabase.rpc("claim_staff_invites");
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
