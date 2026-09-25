import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/booking/phone";
import { instagramHandle } from "@/lib/social/instagram";
import {
  parseGa4,
  parseMetaPixel,
  parseSiteVerification,
  type Parsed,
} from "@/lib/site/connections";
import { SLUG_PATTERN } from "@/lib/shop/slug";
import { unwrap } from "../errors";
import { managerProcedure, router, shopProcedure } from "../init";

const SETTINGS_COLUMNS =
  "id, name, slug, timezone, plan, brand_color, min_booking_notice_minutes, max_booking_advance_days, slot_interval_minutes, cancellation_window_minutes, late_cancel_fee_cents, no_show_fee_cents, share_clients_between_staff, tagline, about, phone, email, instagram, address_line, city, region, postal_code, neighborhood, ga4_measurement_id, meta_pixel_id, google_site_verification" as const;

/** A pasted tag or id, reduced to the one value we store (null = remove). */
const connection = (parse: (input: string) => Parsed) =>
  z
    .string()
    .max(4000)
    .transform((input, ctx) => {
      const parsed = parse(input);
      if ("error" in parsed) {
        ctx.addIssue({ code: "custom", message: parsed.error });
        return z.NEVER;
      }
      return parsed.value;
    });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

export const settingsRouter = router({
  get: shopProcedure.query(async ({ ctx }) => {
    const shop = unwrap(
      await ctx.supabase.from("shops").select(SETTINGS_COLUMNS).eq("id", ctx.shopId).maybeSingle(),
    );
    if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });
    return shop;
  }),

  update: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(SLUG_PATTERN, "Use lowercase letters, numbers and dashes."),
        timezone: z.string().min(1),
        brandColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Pick a color like #C0312B.")
          .nullable(),
        minBookingNoticeMinutes: z.number().int().min(0).max(10_080),
        maxBookingAdvanceDays: z.number().int().min(1).max(365),
        slotIntervalMinutes: z.number().int().min(5).max(120),
        cancellationWindowMinutes: z.number().int().min(0).max(10_080),
        lateCancelFeeCents: z.number().int().min(0).max(100_000),
        noShowFeeCents: z.number().int().min(0).max(100_000),
        shareClientsBetweenStaff: z.boolean(),
        tagline: optionalText(120),
        about: optionalText(2000),
        phone: z
          .string()
          .trim()
          .transform((value, ctx) => {
            if (!value) return null;
            const e164 = normalizePhone(value);
            if (!e164) {
              ctx.addIssue({ code: "custom", message: "Enter a valid phone number." });
              return z.NEVER;
            }
            return e164;
          })
          .nullable(),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email()
          .or(z.literal(""))
          .transform((v) => v || null)
          .nullable(),
        instagram: instagramHandle.nullable(),
        addressLine: optionalText(200),
        city: optionalText(100),
        region: optionalText(100),
        postalCode: optionalText(20),
        neighborhood: optionalText(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!Intl.supportedValuesOf("timeZone").includes(input.timezone)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a valid timezone." });
      }
      const result = await ctx.supabase
        .from("shops")
        .update({
          name: input.name,
          slug: input.slug,
          timezone: input.timezone,
          brand_color: input.brandColor,
          min_booking_notice_minutes: input.minBookingNoticeMinutes,
          max_booking_advance_days: input.maxBookingAdvanceDays,
          slot_interval_minutes: input.slotIntervalMinutes,
          cancellation_window_minutes: input.cancellationWindowMinutes,
          late_cancel_fee_cents: input.lateCancelFeeCents,
          no_show_fee_cents: input.noShowFeeCents,
          share_clients_between_staff: input.shareClientsBetweenStaff,
          tagline: input.tagline,
          about: input.about,
          phone: input.phone,
          email: input.email,
          instagram: input.instagram,
          address_line: input.addressLine,
          city: input.city,
          region: input.region,
          postal_code: input.postalCode,
          neighborhood: input.neighborhood,
        })
        .eq("id", ctx.shopId)
        .select(SETTINGS_COLUMNS)
        .single();
      if (result.error?.code === "23505") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That booking link is taken. Try another.",
        });
      }
      return unwrap(result);
    }),

  /** Google Analytics, Meta Pixel and Search Console tags for the shop's website. */
  updateConnections: managerProcedure
    .input(
      z.object({
        ga4: connection(parseGa4),
        metaPixel: connection(parseMetaPixel),
        siteVerification: connection(parseSiteVerification),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      unwrap(
        await ctx.supabase
          .from("shops")
          .update({
            ga4_measurement_id: input.ga4,
            meta_pixel_id: input.metaPixel,
            google_site_verification: input.siteVerification,
          })
          .eq("id", ctx.shopId)
          .select(SETTINGS_COLUMNS)
          .single(),
      ),
    ),
});
