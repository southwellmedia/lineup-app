import { z } from "zod";

/**
 * A shop's website design: which template it uses and, per template, an
 * ordered list of sections with their settings. Stored as JSON on the shop
 * (`shops.site_template`, `shops.site_content`), edited in the dashboard,
 * rendered by apps/sites. Business facts (services, prices, hours, team,
 * address) always come from Lineup itself; sections only hold presentation
 * and marketing copy.
 *
 * Everything that reads stored JSON goes through `resolveDesign`, which
 * fills defaults and drops anything invalid, so templates can trust it.
 */

export const TEMPLATE_IDS = ["classic", "contact-sheet"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const SECTION_TYPES = [
  "hero",
  "gallery",
  "services",
  "signature",
  "about",
  "team",
  "reviews",
  "visit",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/* ---------------------------------------------------------------- media */

/** A file in the public `site-media` bucket: "<shop id>/<name>.jpg". */
const mediaPath = z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/, "Invalid media path");
export const media = z.object({ path: mediaPath, alt: z.string().max(200).default("") });
export type MediaRef = z.infer<typeof media>;

const text = (max: number) => z.string().max(max).default("");
const images = (max: number) => z.array(media).max(max).default([]);

/* ------------------------------------------------------------- sections */

export const sectionProps = {
  hero: z.object({
    /**
     * The big headline. Blank = the shop's name (first word on line one, the
     * rest outlined on line two). Set line one, and optionally line two, for
     * a custom headline like "Sharp / Lines".
     */
    headline: text(40),
    headlineSecond: text(40),
    /** Small line above the name, e.g. "Barbershop · Est. 2016". Blank = automatic. */
    eyebrow: text(80),
    /** The intro sentence. Blank = the shop's tagline. */
    lede: text(300),
    image: media.nullable().default(null),
  }),
  gallery: z.object({
    title: text(80),
    images: images(24),
  }),
  services: z.object({
    title: text(60),
    intro: text(300),
    /** Optional photo per service, by service id. */
    photos: z.record(z.string().uuid(), media).default({}),
  }),
  signature: z.object({
    /** The service to feature. Null = hide the section's price and button. */
    serviceId: z.string().uuid().nullable().default(null),
    kicker: text(60),
    title: text(60),
    lede: text(300),
    image: media.nullable().default(null),
    steps: z
      .array(z.object({ at: z.string().max(12), label: z.string().max(40) }))
      .max(6)
      .default([]),
  }),
  about: z.object({
    /** Large statement. Wrap words in *asterisks* for italics. */
    statement: text(400),
    /** Supporting paragraph. Blank = the shop's About text. */
    body: text(1500),
    image: media.nullable().default(null),
    credentials: z.array(z.string().max(40)).max(4).default([]),
  }),
  team: z.object({
    title: text(60),
    /** Optional portrait per barber, by staff id. */
    photos: z.record(z.string().uuid(), media).default({}),
  }),
  reviews: z.object({
    /** Headline rating, e.g. "4.9". Blank hides the score. */
    rating: z
      .string()
      .regex(/^$|^[0-5](\.\d)?$/, "Use a rating like 4.9")
      .default(""),
    count: z.number().int().min(0).max(1_000_000).nullable().default(null),
    items: z
      .array(
        z.object({
          quote: z.string().min(1).max(400),
          name: z.string().max(60).default(""),
          source: z.string().max(30).default(""),
        }),
      )
      .max(12)
      .default([]),
  }),
  visit: z.object({
    faqs: z
      .array(z.object({ q: z.string().min(1).max(160), a: z.string().min(1).max(800) }))
      .max(10)
      .default([]),
  }),
} satisfies Record<SectionType, z.ZodType>;

export type SectionProps = { [K in SectionType]: z.infer<(typeof sectionProps)[K]> };

/**
 * The hero's two headline lines: the custom headline if set, otherwise the
 * shop name split after its first word ("Southside" / "Cuts").
 */
export function heroLines(shopName: string, hero: SectionProps["hero"]): [string, string] {
  if (hero.headline.trim()) return [hero.headline.trim(), hero.headlineSecond.trim()];
  const words = shopName.trim().split(/\s+/);
  return [words[0] ?? shopName, words.slice(1).join(" ")];
}

export type Section = {
  [K in SectionType]: { id: string; type: K; enabled: boolean; props: SectionProps[K] };
}[SectionType];

/* ------------------------------------------------------------ templates */

export type TemplateInfo = {
  id: TemplateId;
  name: string;
  description: string;
  tier: "free" | "premium";
  /** Sections this template can render, in their default order. */
  sections: SectionType[];
  /** Sections switched off until the owner adds content. */
  startDisabled?: SectionType[];
};

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Bold and clean. Menu board, the chairs, hours and directions.",
    tier: "free",
    sections: ["hero", "services", "team", "about", "visit"],
  },
  "contact-sheet": {
    id: "contact-sheet",
    name: "Contact Sheet",
    description:
      "A darkroom-inspired studio site: film strip, photo prints, a circle-your-picks service sheet and grain.",
    tier: "premium",
    sections: ["hero", "gallery", "services", "signature", "about", "team", "reviews", "visit"],
    startDisabled: ["signature", "reviews"],
  },
};

export const SECTION_LABELS: Record<SectionType, { name: string; hint: string }> = {
  hero: { name: "Hero", hint: "Your name, intro line and main photo." },
  gallery: { name: "Film strip", hint: "A scrolling strip of recent work." },
  services: { name: "Services", hint: "Your menu with prices, from Services." },
  signature: { name: "Signature service", hint: "Spotlight one service with steps." },
  about: { name: "About", hint: "Your story and a portrait." },
  team: { name: "Team", hint: "Your barbers, from Team." },
  reviews: { name: "Reviews", hint: "Rating and a few quotes from clients." },
  visit: { name: "Visit", hint: "Address, hours and FAQs." },
};

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------- resolving */

export type Design = { template: TemplateId; sections: Section[] };

function defaults<K extends SectionType>(type: K): SectionProps[K] {
  return sectionProps[type].parse({}) as SectionProps[K];
}

/**
 * The stored content for `template`, cleaned up: every section the template
 * supports appears exactly once (in the stored order, new ones appended),
 * props are validated with defaults filled in, and anything invalid is
 * replaced by defaults rather than breaking the site.
 */
export function resolveDesign(template: TemplateId, stored: unknown): Design {
  const info = TEMPLATES[template];
  const raw = (stored as Record<string, unknown> | null)?.[template];
  const list = Array.isArray((raw as { sections?: unknown } | undefined)?.sections)
    ? ((raw as { sections: unknown[] }).sections as unknown[])
    : [];

  const seen = new Set<SectionType>();
  const sections: Section[] = [];
  for (const item of list) {
    const entry = item as { type?: unknown; enabled?: unknown; props?: unknown };
    const type = entry?.type as SectionType;
    if (!info.sections.includes(type) || seen.has(type)) continue;
    seen.add(type);
    const parsed = sectionProps[type].safeParse(entry.props ?? {});
    sections.push({
      id: type,
      type,
      enabled: entry.enabled !== false,
      props: parsed.success ? parsed.data : defaults(type),
    } as Section);
  }
  for (const type of info.sections) {
    if (seen.has(type)) continue;
    sections.push({
      id: type,
      type,
      enabled: !info.startDisabled?.includes(type),
      props: defaults(type),
    } as Section);
  }
  return { template, sections };
}

const sectionInput = <K extends SectionType>(type: K) =>
  z.object({ type: z.literal(type), enabled: z.boolean(), props: sectionProps[type] });

/** Strict check for saving: the same shape resolveDesign reads, or an error. */
export const designInput = z.object({
  template: z.enum(TEMPLATE_IDS),
  sections: z
    .array(
      z.discriminatedUnion("type", [
        sectionInput("hero"),
        sectionInput("gallery"),
        sectionInput("services"),
        sectionInput("signature"),
        sectionInput("about"),
        sectionInput("team"),
        sectionInput("reviews"),
        sectionInput("visit"),
      ]),
    )
    .max(SECTION_TYPES.length),
});
export type DesignInput = z.infer<typeof designInput>;

/**
 * Merges a saved design into the stored JSON without touching the other
 * templates' content, so switching templates and back loses nothing.
 */
export function mergeDesign(stored: unknown, input: DesignInput): Record<string, unknown> {
  const base =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  return {
    ...base,
    [input.template]: {
      sections: input.sections.map((s) => ({ type: s.type, enabled: s.enabled, props: s.props })),
    },
  };
}

/** Every media path a design references, e.g. to check they belong to the shop. */
export function mediaPaths(sections: { type: string; props: unknown }[]): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const v = value as Record<string, unknown>;
    if (typeof v.path === "string") out.push(v.path);
    Object.values(v).forEach(visit);
  };
  sections.forEach((s) => visit(s.props));
  return out;
}

/** "Trained in *São Paulo*" → segments for rendering italics safely (no HTML). */
export function emphasis(textValue: string): { text: string; em: boolean }[] {
  return textValue
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("*") && part.endsWith("*") && part.length > 2
        ? { text: part.slice(1, -1), em: true }
        : { text: part, em: false },
    );
}

/** Public URL of a site photo, or null. */
export function mediaUrl(base: string, ref: MediaRef | null | undefined): string | null {
  return ref ? `${base}${ref.path}` : null;
}
