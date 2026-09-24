"use client";

import type { Section, SectionProps, SectionType } from "@lineup/site-kit";
import { useId, type ReactNode } from "react";
import { ImageField, ImageListField } from "./image-field";

export type EditorLists = {
  services: { id: string; name: string; isAddon: boolean }[];
  barbers: { id: string; name: string }[];
};

/** The form for one section's settings. Every field is optional; blanks fall back to shop data. */
export function SectionFields(props: {
  section: Section;
  lists: EditorLists;
  onChange: (props: Section["props"]) => void;
}) {
  const { section, lists } = props;
  switch (section.type) {
    case "hero":
      return <HeroFields value={section.props} onChange={props.onChange} />;
    case "gallery":
      return <GalleryFields value={section.props} onChange={props.onChange} />;
    case "services":
      return <ServicesFields value={section.props} lists={lists} onChange={props.onChange} />;
    case "signature":
      return <SignatureFields value={section.props} lists={lists} onChange={props.onChange} />;
    case "about":
      return <AboutFields value={section.props} onChange={props.onChange} />;
    case "team":
      return <TeamFields value={section.props} lists={lists} onChange={props.onChange} />;
    case "reviews":
      return <ReviewsFields value={section.props} onChange={props.onChange} />;
    case "visit":
      return <VisitFields value={section.props} onChange={props.onChange} />;
  }
}

type FieldsProps<K extends SectionType> = {
  value: SectionProps[K];
  onChange: (value: SectionProps[K]) => void;
};

/* ------------------------------------------------------------ primitives */

function Text(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  const id = useId();
  const cls =
    "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-ink";
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between text-sm font-semibold">
        {props.label}
        {props.value.length > props.max * 0.8 ? (
          <span className="font-normal tabular-nums text-muted">
            {props.value.length}/{props.max}
          </span>
        ) : null}
      </label>
      {props.multiline ? (
        <textarea
          id={id}
          value={props.value}
          maxLength={props.max}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
          className={`${cls} min-h-20`}
        />
      ) : (
        <input
          id={id}
          value={props.value}
          maxLength={props.max}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
          className={cls}
        />
      )}
      {props.hint ? <p className="mt-1 text-xs text-muted">{props.hint}</p> : null}
    </div>
  );
}

/** An editable list of small records, with add, remove and reorder. */
function ListField<T>(props: {
  label: string;
  items: T[];
  max: number;
  blank: T;
  addLabel: string;
  onChange: (items: T[]) => void;
  render: (item: T, update: (item: T) => void) => ReactNode;
}) {
  const move = (from: number, to: number) => {
    const next = [...props.items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    props.onChange(next);
  };
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{props.label}</legend>
      <ol className="space-y-2">
        {props.items.map((item, i) => (
          <li key={i} className="rounded-xl bg-paper p-2.5 ring-1 ring-line">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
              <span>#{i + 1}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="rounded px-1.5 hover:bg-card disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === props.items.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded px-1.5 hover:bg-card disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}
                  className="rounded px-1.5 text-danger hover:bg-card"
                >
                  ✕
                </button>
              </span>
            </div>
            {props.render(item, (next) =>
              props.onChange(props.items.map((old, j) => (j === i ? next : old))),
            )}
          </li>
        ))}
      </ol>
      {props.items.length < props.max ? (
        <button
          type="button"
          onClick={() => props.onChange([...props.items, props.blank])}
          className="mt-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-line hover:ring-ink"
        >
          + {props.addLabel}
        </button>
      ) : null}
    </fieldset>
  );
}

/** A photo per service or barber, by id. */
function PhotoMap(props: {
  label: string;
  hint: string;
  items: { id: string; name: string }[];
  value: SectionProps["services"]["photos"];
  onChange: (value: SectionProps["services"]["photos"]) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{props.label}</legend>
      <p className="text-xs text-muted">{props.hint}</p>
      {props.items.map((item) => (
        <ImageField
          key={item.id}
          compact
          label={item.name}
          value={props.value[item.id] ?? null}
          onChange={(ref) => {
            const next = { ...props.value };
            if (ref) next[item.id] = ref;
            else delete next[item.id];
            props.onChange(next);
          }}
        />
      ))}
    </fieldset>
  );
}

/* -------------------------------------------------------------- sections */

function HeroFields({ value, onChange }: FieldsProps<"hero">) {
  return (
    <div className="space-y-4">
      <Text
        label="Intro line"
        multiline
        max={300}
        value={value.lede}
        onChange={(lede) => onChange({ ...value, lede })}
        placeholder="Blank uses your tagline from Settings"
      />
      <Text
        label="Small line above your name"
        max={80}
        value={value.eyebrow}
        onChange={(eyebrow) => onChange({ ...value, eyebrow })}
        placeholder="e.g. Barbershop — Oak Cliff, est. 2016"
      />
      <ImageField
        label="Main photo"
        value={value.image}
        onChange={(image) => onChange({ ...value, image })}
        hint="A portrait or the shop floor. Also used when your site is shared."
      />
    </div>
  );
}

function GalleryFields({ value, onChange }: FieldsProps<"gallery">) {
  return (
    <div className="space-y-4">
      <ImageListField
        label="Photos"
        max={24}
        value={value.images}
        onChange={(images) => onChange({ ...value, images })}
      />
      <p className="text-xs text-muted">
        Recent cuts work best. The strip hides itself until you add a photo.
      </p>
    </div>
  );
}

function ServicesFields({
  value,
  lists,
  onChange,
}: FieldsProps<"services"> & { lists: EditorLists }) {
  return (
    <div className="space-y-4">
      <Text
        label="Title"
        max={60}
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
        placeholder="The Sheet"
      />
      <Text
        label="Intro"
        multiline
        max={300}
        value={value.intro}
        onChange={(intro) => onChange({ ...value, intro })}
      />
      <PhotoMap
        label="Service photos"
        hint="Prices, times and descriptions come from Services. Photos are optional; blanks borrow from your film strip."
        items={lists.services}
        value={value.photos}
        onChange={(photos) => onChange({ ...value, photos })}
      />
    </div>
  );
}

function SignatureFields({
  value,
  lists,
  onChange,
}: FieldsProps<"signature"> & { lists: EditorLists }) {
  const id = useId();
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-semibold">
          Service to feature
        </label>
        <select
          id={id}
          value={value.serviceId ?? ""}
          onChange={(e) => onChange({ ...value, serviceId: e.target.value || null })}
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
        >
          <option value="">Pick a service…</option>
          {lists.services
            .filter((s) => !s.isAddon)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          Price, time and the Book button come from this service.
        </p>
      </div>
      <Text
        label="Title"
        max={60}
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
        placeholder="Blank uses the service name"
      />
      <Text
        label="Small line above the title"
        max={60}
        value={value.kicker}
        onChange={(kicker) => onChange({ ...value, kicker })}
      />
      <Text
        label="Description"
        multiline
        max={300}
        value={value.lede}
        onChange={(lede) => onChange({ ...value, lede })}
      />
      <ImageField
        label="Photo"
        value={value.image}
        onChange={(image) => onChange({ ...value, image })}
      />
      <ListField
        label="Steps"
        items={value.steps}
        max={6}
        blank={{ at: "", label: "" }}
        addLabel="Add a step"
        onChange={(steps) => onChange({ ...value, steps })}
        render={(step, update) => (
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <input
              aria-label="When"
              value={step.at}
              maxLength={12}
              placeholder="00:05"
              onChange={(e) => update({ ...step, at: e.target.value })}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
            />
            <input
              aria-label="Step"
              value={step.label}
              maxLength={40}
              placeholder="The cut"
              onChange={(e) => update({ ...step, label: e.target.value })}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
            />
          </div>
        )}
      />
    </div>
  );
}

function AboutFields({ value, onChange }: FieldsProps<"about">) {
  return (
    <div className="space-y-4">
      <Text
        label="Statement"
        multiline
        max={400}
        value={value.statement}
        onChange={(statement) => onChange({ ...value, statement })}
        placeholder="Blank uses About from Settings"
        hint="Put *asterisks* around words to set them in italics."
      />
      <Text
        label="More about you"
        multiline
        max={1500}
        value={value.body}
        onChange={(body) => onChange({ ...value, body })}
      />
      <ImageField
        label="Portrait"
        value={value.image}
        onChange={(image) => onChange({ ...value, image })}
        hint="Gets the magnifying loupe on desktop."
      />
      <ListField
        label="Credentials"
        items={value.credentials}
        max={4}
        blank=""
        addLabel="Add a credential"
        onChange={(credentials) => onChange({ ...value, credentials })}
        render={(c, update) => (
          <input
            aria-label="Credential"
            value={c}
            maxLength={40}
            placeholder="Licensed · Texas"
            onChange={(e) => update(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
          />
        )}
      />
    </div>
  );
}

function TeamFields({ value, lists, onChange }: FieldsProps<"team"> & { lists: EditorLists }) {
  return (
    <div className="space-y-4">
      <Text
        label="Title"
        max={60}
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
        placeholder="The Chairs"
      />
      <PhotoMap
        label="Portraits"
        hint="Names and bios come from Team. Without a photo, a barber gets their initial."
        items={lists.barbers}
        value={value.photos}
        onChange={(photos) => onChange({ ...value, photos })}
      />
    </div>
  );
}

function ReviewsFields({ value, onChange }: FieldsProps<"reviews">) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-paper px-3 py-2 text-xs text-muted ring-1 ring-line">
        Only use real reviews, copied word for word, with the client&apos;s okay.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Text
          label="Rating"
          max={3}
          value={value.rating}
          onChange={(rating) => onChange({ ...value, rating })}
          placeholder="4.9"
        />
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="rev-count">
            Number of reviews
          </label>
          <input
            id="rev-count"
            inputMode="numeric"
            value={value.count ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ""));
              onChange({ ...value, count: e.target.value ? n : null });
            }}
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
      </div>
      <ListField
        label="Quotes"
        items={value.items}
        max={12}
        blank={{ quote: "", name: "", source: "Google" }}
        addLabel="Add a review"
        onChange={(items) => onChange({ ...value, items })}
        render={(r, update) => (
          <div className="space-y-1.5">
            <textarea
              aria-label="Quote"
              value={r.quote}
              maxLength={400}
              placeholder="What they said"
              onChange={(e) => update({ ...r, quote: e.target.value })}
              className="min-h-16 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                aria-label="Name"
                value={r.name}
                maxLength={60}
                placeholder="Marcus W."
                onChange={(e) => update({ ...r, name: e.target.value })}
                className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
              />
              <input
                aria-label="Source"
                value={r.source}
                maxLength={30}
                placeholder="Google"
                onChange={(e) => update({ ...r, source: e.target.value })}
                className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}

function VisitFields({ value, onChange }: FieldsProps<"visit">) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Address, phone and hours come from Settings and Team.</p>
      <ListField
        label="Questions"
        items={value.faqs}
        max={10}
        blank={{ q: "", a: "" }}
        addLabel="Add a question"
        onChange={(faqs) => onChange({ ...value, faqs })}
        render={(f, update) => (
          <div className="space-y-1.5">
            <input
              aria-label="Question"
              value={f.q}
              maxLength={160}
              placeholder="Do you take walk-ins?"
              onChange={(e) => update({ ...f, q: e.target.value })}
              className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm font-semibold"
            />
            <textarea
              aria-label="Answer"
              value={f.a}
              maxLength={800}
              placeholder="Yes, when a chair is free."
              onChange={(e) => update({ ...f, a: e.target.value })}
              className="min-h-14 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
            />
          </div>
        )}
      />
    </div>
  );
}
