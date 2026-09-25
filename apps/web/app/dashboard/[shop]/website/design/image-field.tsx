"use client";

import type { MediaRef } from "@lineup/site-kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { preparePhoto } from "@/lib/media/resize";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useDesignMedia } from "./media-context";
import { Skeleton } from "@/components/skeleton";

const BUCKET = "site-media";

/** The shop's uploaded site photos, newest first. */
export function useMediaLibrary() {
  const { folder } = useDesignMedia();
  return useQuery({
    queryKey: ["site-media", folder],
    queryFn: async () => {
      const { data, error } = await createBrowserSupabase()
        .storage.from(BUCKET)
        .list(folder.replace(/\/$/, ""), {
          limit: 200,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (error) throw error;
      return data.filter((f) => f.name && !f.name.startsWith(".")).map((f) => `${folder}${f.name}`);
    },
  });
}

/** Uploads a photo into the shop's folder and returns its path. */
export function useUpload() {
  const { folder, track } = useDesignMedia();
  const queryClient = useQueryClient();
  return (file: File): Promise<string> => track(uploadOne(file));
  async function uploadOne(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPEG, PNG or WebP).");
    const blob = await preparePhoto(file);
    const path = `${folder}${crypto.randomUUID()}.jpg`;
    const { error } = await createBrowserSupabase()
      .storage.from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["site-media", folder] });
    return path;
  }
}

/** One photo: upload, pick from the library, describe, or remove. */
export function ImageField(props: {
  label: string;
  value: MediaRef | null;
  onChange: (value: MediaRef | null) => void;
  hint?: string;
  compact?: boolean;
}) {
  const id = useId();
  const { baseUrl } = useDesignMedia();
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const path = await upload(file);
      props.onChange({ path, alt: props.value?.alt ?? "" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{props.label}</p>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files[0]);
          }}
          className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-paper text-xs font-semibold text-muted transition-colors hover:border-ink ${props.compact ? "size-16" : "size-24"}`}
          aria-label={props.value ? `Replace ${props.label}` : `Upload ${props.label}`}
        >
          {busy ? (
            <span className="animate-pulse">Uploading…</span>
          ) : props.value ? (
            // eslint-disable-next-line @next/next/no-img-element -- a user photo from Storage
            <img src={`${baseUrl}${props.value.path}`} alt="" className="size-full object-cover" />
          ) : (
            <span>+ Photo</span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          {props.value ? (
            <input
              id={id}
              aria-label={`${props.label} description`}
              value={props.value.alt}
              maxLength={200}
              placeholder="Describe the photo (for captions and screen readers)"
              onChange={(e) => props.onChange({ ...props.value!, alt: e.target.value })}
              className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm outline-none focus:border-ink"
            />
          ) : null}
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-full px-2.5 py-1 ring-1 ring-line hover:ring-ink"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setLibrary((v) => !v)}
              aria-expanded={library}
              className="rounded-full px-2.5 py-1 ring-1 ring-line hover:ring-ink"
            >
              Library
            </button>
            {props.value ? (
              <button
                type="button"
                onClick={() => props.onChange(null)}
                className="rounded-full px-2.5 py-1 text-danger ring-1 ring-line hover:ring-danger"
              >
                Remove
              </button>
            ) : null}
          </div>
          {props.hint ? <p className="text-xs text-muted">{props.hint}</p> : null}
          {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
        </div>
      </div>
      {library ? (
        <Library
          onPick={(path) => {
            props.onChange({ path, alt: props.value?.alt ?? "" });
            setLibrary(false);
          }}
        />
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}

function Library({ onPick }: { onPick: (path: string) => void }) {
  const { baseUrl } = useDesignMedia();
  const { data, isLoading, error } = useMediaLibrary();
  return (
    <div className="mt-2 rounded-xl bg-paper p-2 ring-1 ring-line">
      {isLoading ? (
        <div role="status" aria-busy="true" className="grid grid-cols-4 gap-1.5">
          <span className="sr-only">Loading photos…</span>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="p-2 text-xs text-danger">Couldn&apos;t load your photos.</p>
      ) : !data?.length ? (
        <p className="p-2 text-xs text-muted">No photos yet. Upload one and it lands here.</p>
      ) : (
        <ul className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto">
          {data.map((path) => (
            <li key={path}>
              <button
                type="button"
                onClick={() => onPick(path)}
                className="block aspect-square w-full overflow-hidden rounded-lg ring-1 ring-line hover:ring-2 hover:ring-ink"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a user photo from Storage */}
                <img
                  src={`${baseUrl}${path}`}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Several photos in order (the film strip). */
export function ImageListField(props: {
  label: string;
  value: MediaRef[];
  onChange: (value: MediaRef[]) => void;
  max: number;
}) {
  const { baseUrl } = useDesignMedia();
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = Math.max(0, props.max - props.value.length);
    const picked = Array.from(files).slice(0, room);
    setBusy(picked.length);
    const added: MediaRef[] = [];
    for (const file of picked) {
      try {
        added.push({ path: await upload(file), alt: "" });
      } catch (e) {
        setError((e as Error).message);
      }
      setBusy((n) => n - 1);
    }
    props.onChange([...props.value, ...added]);
    if (input.current) input.current.value = "";
  };

  const move = (from: number, to: number) => {
    const next = [...props.value];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    props.onChange(next);
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">
        {props.label}{" "}
        <span className="font-normal text-muted">
          {props.value.length} of {props.max}
        </span>
      </p>
      <ul className="grid grid-cols-4 gap-1.5">
        {props.value.map((img, i) => (
          <li
            key={`${img.path}-${i}`}
            className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-line"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a user photo from Storage */}
            <img src={`${baseUrl}${img.path}`} alt={img.alt} className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/70 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                aria-label="Move earlier"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className="px-1.5 text-paper disabled:opacity-30"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => props.onChange(props.value.filter((_, j) => j !== i))}
                className="px-1.5 text-paper"
              >
                ✕
              </button>
              <button
                type="button"
                aria-label="Move later"
                disabled={i === props.value.length - 1}
                onClick={() => move(i, i + 1)}
                className="px-1.5 text-paper disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <li key={`busy-${i}`} className="aspect-square animate-pulse rounded-lg bg-line" />
        ))}
        {props.value.length + busy < props.max ? (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="grid aspect-square w-full place-items-center rounded-lg border border-dashed border-line text-xs font-semibold text-muted hover:border-ink"
            >
              + Add
            </button>
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        onClick={() => setLibrary((v) => !v)}
        aria-expanded={library}
        className="mt-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-line hover:ring-ink"
      >
        Add from library
      </button>
      {library ? (
        <Library
          onPick={(path) => {
            if (props.value.length < props.max) props.onChange([...props.value, { path, alt: "" }]);
          }}
        />
      ) : null}
      {error ? <p className="mt-1 text-xs font-semibold text-danger">{error}</p> : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void add(e.target.files)}
      />
    </div>
  );
}
