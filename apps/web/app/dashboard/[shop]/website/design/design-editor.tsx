"use client";

import { SECTION_LABELS, type Section, type SectionType, type TemplateId } from "@lineup/site-kit";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShop } from "@/components/shop-context";
import { Button, Notice } from "@/components/ui";
import { useTRPC } from "@/trpc/client";
import { DesignMediaProvider } from "./media-context";
import { SectionFields, type EditorLists } from "./section-fields";

const SPRING = { type: "spring", stiffness: 480, damping: 38 } as const;

/** Drops half-filled list rows (an empty review or FAQ) so a save never fails on them. */
function clean(section: Section): Section {
  switch (section.type) {
    case "reviews":
      return {
        ...section,
        props: { ...section.props, items: section.props.items.filter((r) => r.quote.trim()) },
      };
    case "visit":
      return {
        ...section,
        props: {
          ...section.props,
          faqs: section.props.faqs.filter((f) => f.q.trim() && f.a.trim()),
        },
      };
    case "signature":
      return {
        ...section,
        props: {
          ...section.props,
          steps: section.props.steps.filter((s) => s.label.trim()),
        },
      };
    case "about":
      return {
        ...section,
        props: {
          ...section.props,
          credentials: section.props.credentials.filter((c) => c.trim()),
        },
      };
    default:
      return section;
  }
}

export function DesignEditor({ siteUrl }: { siteUrl: string | null }) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.website.design.queryOptions({ shopId: shop.id }));

  const saved = useMemo(
    () =>
      Object.fromEntries(data.templates.map((t) => [t.id, t.design.sections])) as Record<
        TemplateId,
        Section[]
      >,
    [data.templates],
  );
  const [drafts, setDrafts] = useState(saved);
  const [template, setTemplate] = useState<TemplateId>(data.active);
  const [open, setOpen] = useState<SectionType | null>(null);
  const [picker, setPicker] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const sections = drafts[template];
  const info = data.templates.find((t) => t.id === template)!;
  const dirty = JSON.stringify(sections) !== JSON.stringify(saved[template]);
  const isLive = template === data.active;
  const lists: EditorLists = { services: data.services, barbers: data.barbers };

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation(
    trpc.website.saveDesign.mutationOptions({
      onSuccess: async (_, input) => {
        await queryClient.invalidateQueries({ queryKey: trpc.website.design.pathKey() });
        setPreviewKey((k) => k + 1);
        setMessage({
          tone: "success",
          text: input.activate
            ? `Published. ${info.name} is live on your site.`
            : "Saved. Preview it here, then publish when you're ready.",
        });
      },
      onError: (e) => setMessage({ tone: "error", text: e.message }),
    }),
  );

  const submit = (activate: boolean) => {
    setMessage(null);
    const cleaned = sections.map(clean);
    setDrafts((d) => ({ ...d, [template]: cleaned }));
    save.mutate({
      shopId: shop.id,
      template,
      activate,
      sections: cleaned,
    });
  };

  const update = (type: SectionType, change: Partial<Section>) =>
    setDrafts((d) => ({
      ...d,
      [template]: d[template].map((s) => (s.type === type ? ({ ...s, ...change } as Section) : s)),
    }));

  const previewUrl = siteUrl ? `${siteUrl}?preview=1&template=${template}&v=${previewKey}` : null;

  return (
    <DesignMediaProvider baseUrl={data.mediaBaseUrl} folder={data.mediaFolder}>
      {(uploading) => (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                href={`/dashboard/${shop.slug}/website` as Route}
                className="text-sm font-semibold text-muted hover:text-ink"
              >
                ← Website
              </Link>
              <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight">
                Design
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {uploading ? (
                <span className="animate-pulse text-sm font-semibold text-muted">
                  Uploading {uploading} photo{uploading === 1 ? "" : "s"}…
                </span>
              ) : dirty ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                  <span className="size-2 rounded-full bg-brand" /> Unsaved changes
                </span>
              ) : null}
              {isLive ? (
                <Button
                  variant="primary"
                  disabled={!dirty || save.isPending || uploading > 0}
                  onClick={() => submit(true)}
                >
                  {save.isPending ? "Publishing…" : "Publish"}
                </Button>
              ) : (
                <>
                  <Button
                    disabled={!dirty || save.isPending || uploading > 0}
                    onClick={() => submit(false)}
                  >
                    Save
                  </Button>
                  <Button
                    variant="primary"
                    disabled={save.isPending || uploading > 0}
                    onClick={() => submit(true)}
                  >
                    Use {info.name}
                  </Button>
                </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {message ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4"
              >
                <Notice tone={message.tone}>{message.text}</Notice>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="grid gap-5 xl:grid-cols-[26rem_minmax(0,1fr)]">
            {/* Editor */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Template
                    </p>
                    <p className="flex items-center gap-2 truncate font-display text-2xl font-bold uppercase">
                      {info.name}
                      {info.tier === "premium" ? <PremiumBadge /> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {isLive ? "Live on your site" : "Previewing. Your live site is unchanged."}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setPicker((v) => !v)} aria-expanded={picker}>
                    {picker ? "Close" : "Change"}
                  </Button>
                </div>
                <AnimatePresence initial={false}>
                  {picker ? (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 grid gap-2 overflow-hidden"
                    >
                      {data.templates.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setTemplate(t.id);
                              setOpen(null);
                              setPicker(false);
                            }}
                            aria-pressed={t.id === template}
                            className="w-full rounded-xl p-3 text-left ring-1 ring-line transition-colors hover:ring-ink aria-pressed:bg-ink aria-pressed:text-paper aria-pressed:ring-ink"
                          >
                            <span className="flex items-center gap-2 font-semibold">
                              {t.name}
                              {t.tier === "premium" ? <PremiumBadge /> : null}
                              {t.id === data.active ? (
                                <span className="ml-auto text-xs font-semibold opacity-70">
                                  Live
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-xs opacity-70">{t.description}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </section>

              <Reorder.Group
                axis="y"
                values={sections}
                onReorder={(next) => setDrafts((d) => ({ ...d, [template]: next }))}
                className="space-y-2"
              >
                {sections.map((section) => (
                  <SectionCard
                    key={`${template}-${section.type}`}
                    section={section}
                    open={open === section.type}
                    lists={lists}
                    onToggleOpen={() => setOpen((o) => (o === section.type ? null : section.type))}
                    onEnabled={(enabled) => update(section.type, { enabled })}
                    onProps={(props) => update(section.type, { props } as Partial<Section>)}
                  />
                ))}
              </Reorder.Group>
              <p className="px-1 text-xs text-muted">
                Drag sections to reorder. Services, prices, hours and your team always come from the
                rest of Lineup, so they stay in sync.
              </p>
            </div>

            {/* Preview */}
            <Preview url={previewUrl} dirty={dirty} />
          </div>
        </>
      )}
    </DesignMediaProvider>
  );
}

function PremiumBadge() {
  return (
    <span className="rounded-full bg-brand px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-brand-ink">
      Premium
    </span>
  );
}

function SectionCard(props: {
  section: Section;
  open: boolean;
  lists: EditorLists;
  onToggleOpen: () => void;
  onEnabled: (enabled: boolean) => void;
  onProps: (props: Section["props"]) => void;
}) {
  const controls = useDragControls();
  const label = SECTION_LABELS[props.section.type];
  return (
    <Reorder.Item
      value={props.section}
      dragListener={false}
      dragControls={controls}
      transition={SPRING}
      className={`overflow-hidden rounded-2xl border bg-card ${props.open ? "border-ink shadow-md" : "border-line"}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-label={`Drag to reorder ${label.name}`}
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none rounded-md px-1 py-2 text-muted hover:bg-paper hover:text-ink active:cursor-grabbing"
        >
          <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5 fill-current">
            {[2, 8, 14].flatMap((y) => [
              <circle key={`a${y}`} cx="2" cy={y} r="1.5" />,
              <circle key={`b${y}`} cx="8" cy={y} r="1.5" />,
            ])}
          </svg>
        </button>
        <button
          type="button"
          onClick={props.onToggleOpen}
          aria-expanded={props.open}
          className={`min-w-0 flex-1 text-left ${props.section.enabled ? "" : "opacity-50"}`}
        >
          <span className="block font-semibold">{label.name}</span>
          <span className="block truncate text-xs text-muted">{label.hint}</span>
        </button>
        <label
          className="relative inline-flex shrink-0 cursor-pointer"
          title={props.section.enabled ? "Shown" : "Hidden"}
        >
          <input
            type="checkbox"
            role="switch"
            aria-label={`Show ${label.name}`}
            checked={props.section.enabled}
            onChange={(e) => props.onEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-ink"
          />
          <span
            aria-hidden
            className="absolute left-0.5 top-0.5 size-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4"
          />
        </label>
        <button
          type="button"
          onClick={props.onToggleOpen}
          aria-label={props.open ? `Close ${label.name}` : `Edit ${label.name}`}
          className={`grid size-7 place-items-center rounded-full text-muted transition-transform hover:bg-paper hover:text-ink ${props.open ? "rotate-180" : ""}`}
        >
          ⌄
        </button>
      </div>
      <AnimatePresence initial={false}>
        {props.open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="border-t border-line p-4">
              <SectionFields section={props.section} lists={props.lists} onChange={props.onProps} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Reorder.Item>
  );
}

const DESKTOP_WIDTH = 1280;

function Preview({ url, dirty }: { url: string | null; dirty: boolean }) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width > 0) setScale(Math.min(1, width / DESKTOP_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!url) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
        Set <code>SITES_URL</code> on the web app to see a preview.
      </p>
    );
  }
  const height = "calc(100dvh - 13rem)";
  return (
    <section className="rounded-2xl border border-line bg-card xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="text-sm font-semibold">
          Preview{" "}
          {dirty ? (
            <span className="font-normal text-muted">· save to see your latest edits</span>
          ) : null}
        </p>
        <div
          role="group"
          aria-label="Preview size"
          className="flex rounded-full bg-paper p-0.5 ring-1 ring-line"
        >
          {(["desktop", "phone"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className="rounded-full px-3 py-0.5 text-sm font-semibold capitalize text-muted aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-b-2xl bg-paper p-3">
        <div ref={box} className={device === "desktop" ? "block" : "hidden"}>
          <div className="overflow-hidden rounded-xl border border-line bg-ink" style={{ height }}>
            <iframe
              key={url}
              src={url}
              title="Your website on a computer"
              className="origin-top-left"
              style={{
                width: DESKTOP_WIDTH,
                height: `calc((100dvh - 13rem) / ${scale})`,
                transform: `scale(${scale})`,
              }}
            />
          </div>
        </div>
        {device === "phone" ? (
          <div className="flex justify-center">
            <iframe
              key={`${url}-phone`}
              src={url}
              title="Your website on a phone"
              className="w-[390px] max-w-full rounded-[2rem] border-8 border-ink bg-ink"
              style={{ height }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
