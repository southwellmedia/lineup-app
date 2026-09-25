import type { Database } from "@lineup/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { unwrap } from "../errors";
import { router, shopProcedure } from "../init";

const BUCKET = "client-photos";
/** Signed links last an hour: long enough for a session, short if one leaks. */
const LINK_SECONDS = 3600;

type Row = {
  id: string;
  client_id: string;
  appointment_id: string | null;
  taken_by: string | null;
  path: string;
  caption: string | null;
  consent: "private" | "portfolio" | "social";
  consent_at: string | null;
  created_at: string;
};
const COLUMNS =
  "id, client_id, appointment_id, taken_by, path, caption, consent, consent_at, created_at" as const;

/**
 * Client photos. Everything runs as the signed-in user, so table and storage
 * RLS decide who sees what: the same people who can see the client.
 */
export const photosRouter = router({
  /** A client's photos, newest first, with short-lived links. */
  forClient: shopProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = unwrap(
        await ctx.supabase
          .from("client_photos")
          .select(COLUMNS)
          .eq("shop_id", ctx.shopId)
          .eq("client_id", input.clientId)
          .order("created_at", { ascending: false })
          .limit(100),
      );
      return withUrls(ctx.supabase, rows);
    }),

  /**
   * For the booking panel: this visit's photos, plus the latest photo from
   * an earlier visit ("last time") so the barber can match the cut.
   */
  forAppointment: shopProcedure
    .input(z.object({ appointmentId: z.string().uuid(), clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [visit, earlier] = await Promise.all([
        ctx.supabase
          .from("client_photos")
          .select(COLUMNS)
          .eq("shop_id", ctx.shopId)
          .eq("appointment_id", input.appointmentId)
          .order("created_at"),
        ctx.supabase
          .from("client_photos")
          .select(COLUMNS)
          .eq("shop_id", ctx.shopId)
          .eq("client_id", input.clientId)
          .or(`appointment_id.is.null,appointment_id.neq.${input.appointmentId}`)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      const [thisVisit, lastTime] = await Promise.all([
        withUrls(ctx.supabase, unwrap(visit)),
        withUrls(ctx.supabase, unwrap(earlier)),
      ]);
      return { thisVisit, lastTime: lastTime[0] ?? null };
    }),

  /** Records a photo the browser just uploaded to "<shop>/<client>/<file>". */
  add: shopProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        appointmentId: z.string().uuid().nullable(),
        path: z.string().max(200),
        caption: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.path.startsWith(`${ctx.shopId}/${input.clientId}/`)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That photo isn't in this client's folder.",
        });
      }
      const row = unwrap(
        await ctx.supabase
          .from("client_photos")
          .insert({
            shop_id: ctx.shopId,
            client_id: input.clientId,
            appointment_id: input.appointmentId,
            taken_by: ctx.staff.id,
            path: input.path,
            caption: input.caption || null,
          })
          .select("id")
          .single(),
      );
      return { id: row.id };
    }),

  /** How far a photo may go. Anything past private records who said so and when. */
  setConsent: shopProcedure
    .input(
      z.object({
        photoId: z.string().uuid(),
        consent: z.enum(["private", "portfolio", "social"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = unwrap(
        await ctx.supabase
          .from("client_photos")
          .update({
            consent: input.consent,
            consent_at: input.consent === "private" ? null : new Date().toISOString(),
            consent_by: input.consent === "private" ? null : ctx.staff.id,
          })
          .eq("shop_id", ctx.shopId)
          .eq("id", input.photoId)
          .select("id")
          .maybeSingle(),
      );
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found." });
      return { ok: true };
    }),

  setCaption: shopProcedure
    .input(z.object({ photoId: z.string().uuid(), caption: z.string().trim().max(300) }))
    .mutation(async ({ ctx, input }) => {
      unwrap(
        await ctx.supabase
          .from("client_photos")
          .update({ caption: input.caption || null })
          .eq("shop_id", ctx.shopId)
          .eq("id", input.photoId),
      );
      return { ok: true };
    }),

  /** Deletes the photo and its file. Managers, or whoever took it. */
  remove: shopProcedure
    .input(z.object({ photoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = unwrap(
        await ctx.supabase
          .from("client_photos")
          .delete()
          .eq("shop_id", ctx.shopId)
          .eq("id", input.photoId)
          .select("path")
          .maybeSingle(),
      );
      if (!row) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a manager or whoever took the photo can delete it.",
        });
      }
      await ctx.supabase.storage.from(BUCKET).remove([row.path]);
      return { ok: true };
    }),
});

async function withUrls(supabase: SupabaseClient<Database>, rows: Row[]) {
  if (!rows.length) return [];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(
    rows.map((r) => r.path),
    LINK_SECONDS,
  );
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    appointmentId: r.appointment_id,
    takenBy: r.taken_by,
    path: r.path,
    caption: r.caption,
    consent: r.consent,
    consentAt: r.consent_at,
    createdAt: r.created_at,
    url: urls.get(r.path) ?? null,
  }));
}
