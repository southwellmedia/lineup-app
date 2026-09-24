import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/dashboard/csv";
import { createUserClient } from "@/lib/supabase/server";

/**
 * "Your client list is yours": every client the viewer can see, as CSV,
 * with notes, consent and visit stats. Runs under RLS.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shop: string }> },
) {
  const { shop: slug } = await params;
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth) return new NextResponse("Sign in first.", { status: 401 });

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!shop) return new NextResponse("Not found.", { status: 404 });

  const [clients, stats, staff] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, phone, email, notes, preferred_staff_id, sms_consent_at, email_consent_at, marketing_consent_at, created_at",
      )
      .eq("shop_id", shop.id)
      .order("name"),
    supabase.from("client_stats").select("*").eq("shop_id", shop.id),
    supabase.from("staff").select("id, display_name").eq("shop_id", shop.id),
  ]);
  if (clients.error) return new NextResponse("Couldn't export clients.", { status: 500 });

  const csv = toCsv(
    [
      "Name",
      "Phone",
      "Email",
      "Notes",
      "Preferred barber",
      "Visits",
      "No-shows",
      "Spent (USD)",
      "Last visit",
      "Texts OK since",
      "Email OK since",
      "Marketing OK since",
      "Client since",
    ],
    clients.data.map((c) => {
      const s = stats.data?.find((x) => x.client_id === c.id);
      return [
        c.name,
        c.phone,
        c.email,
        c.notes,
        staff.data?.find((b) => b.id === c.preferred_staff_id)?.display_name ?? null,
        s?.visits ?? 0,
        s?.no_shows ?? 0,
        ((s?.spent_cents ?? 0) / 100).toFixed(2),
        s?.last_visit_at ?? null,
        c.sms_consent_at,
        c.email_consent_at,
        c.marketing_consent_at,
        c.created_at,
      ];
    }),
  );

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${shop.slug}-clients-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
