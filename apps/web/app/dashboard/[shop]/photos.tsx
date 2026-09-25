"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { useShop } from "@/components/shop-context";
import { preparePhoto } from "@/lib/media/resize";
import { canShare, shareCaption } from "@/lib/photos/caption";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";

/* Client photos, shared by the calendar's booking panel and client profiles. */

type Photo = inferRouterOutputs<AppRouter>["photos"]["forClient"][number];
type Consent = Photo["consent"];

const CONSENT: { value: Consent; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only staff see it, in this client's history." },
  { value: "portfolio", label: "Website", hint: "The client said it can go on your site." },
  { value: "social", label: "Social", hint: "The client said you can post it and tag them." },
];

function useRefreshPhotos() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: trpc.photos.pathKey() });
}

/** Resizes (dropping GPS and other metadata), uploads, then records the photo. */
function useAddPhoto(clientId: string, appointmentId: string | null) {
  const trpc = useTRPC();
  const shop = useShop();
  const refresh = useRefreshPhotos();
  const add = useMutation(trpc.photos.add.mutationOptions());
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 6);
    setBusy(list.length);
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error("Pick a photo.");
        const blob = await preparePhoto(file);
        const path = `${shop.id}/${clientId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await createBrowserSupabase()
          .storage.from("client-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw new Error(uploadError.message);
        await add.mutateAsync({ shopId: shop.id, clientId, appointmentId, path });
      } catch (e) {
        setError((e as Error).message);
      }
      setBusy((n) => n - 1);
    }
    await refresh();
  };
  return { upload, busy, error };
}

function AddPhotoButton(props: { clientId: string; appointmentId: string | null; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useAddPhoto(props.clientId, props.appointmentId);
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy > 0}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-ink disabled:opacity-60"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {busy ? `Uploading ${busy}…` : (props.label ?? "Add photo")}
      </button>
      {/* capture opens the camera on phones; desktops get a file picker. */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <p className="mt-1 text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

/** Booking panel: this visit's photos, plus the last one from an earlier visit. */
export function VisitPhotos(props: { clientId: string; appointmentId: string }) {
  const trpc = useTRPC();
  const shop = useShop();
  const { data } = useQuery(
    trpc.photos.forAppointment.queryOptions({
      shopId: shop.id,
      appointmentId: props.appointmentId,
      clientId: props.clientId,
    }),
  );
  return (
    <div className="space-y-3">
      {data?.lastTime?.url ? (
        <div className="flex items-center gap-3 rounded-2xl bg-paper p-2 pr-3 ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
          <img src={data.lastTime.url} alt="" className="size-16 rounded-xl object-cover" />
          <p className="text-sm">
            <span className="block font-semibold">Last time</span>
            <span className="text-muted">
              {DateTime.fromISO(data.lastTime.createdAt).toFormat("LLL d, yyyy")}
              {data.lastTime.caption ? ` · ${data.lastTime.caption}` : ""}
            </span>
          </p>
        </div>
      ) : null}
      {data?.thisVisit.length ? (
        <ul className="grid grid-cols-4 gap-1.5">
          {data.thisVisit.map((p) => (
            <li key={p.id}>
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                <img
                  src={p.url}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-line"
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <AddPhotoButton clientId={props.clientId} appointmentId={props.appointmentId} />
    </div>
  );
}

/** Client profile: every photo, with consent, share and delete. */
export function ClientPhotoGallery(props: {
  clientId: string;
  isMinor: boolean;
  clientInstagram: string | null;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const { data: photos } = useQuery(
    trpc.photos.forClient.queryOptions({ shopId: shop.id, clientId: props.clientId }),
  );
  const [open, setOpen] = useState<string | null>(null);
  const selected = photos?.find((p) => p.id === open) ?? null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {props.isMinor
            ? "Kids' photos stay private."
            : "Private unless the client says otherwise. Mark consent before sharing."}
        </p>
        <AddPhotoButton clientId={props.clientId} appointmentId={null} />
      </div>
      {photos?.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(p.id)}
                className="group relative block aspect-square w-full overflow-hidden rounded-xl ring-1 ring-line focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={`Photo from ${DateTime.fromISO(p.createdAt).toFormat("LLL d")}`}
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                  <img
                    src={p.url}
                    alt=""
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : null}
                {p.consent !== "private" ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-paper">
                    {p.consent === "social" ? "Social" : "Website"}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No photos yet. Snap the finished cut from the booking panel or here.
        </p>
      )}

      <AnimatePresence>
        {selected ? (
          <PhotoDetail
            key={selected.id}
            photo={selected}
            isMinor={props.isMinor}
            clientInstagram={props.clientInstagram}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PhotoDetail(props: {
  photo: Photo;
  isMinor: boolean;
  clientInstagram: string | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const refresh = useRefreshPhotos();
  const { data: settings } = useQuery(trpc.settings.get.queryOptions({ shopId: shop.id }));
  const [caption, setCaption] = useState(props.photo.caption ?? "");
  const [note, setNote] = useState<string | null>(null);
  const consent = useMutation(trpc.photos.setConsent.mutationOptions({ onSuccess: refresh }));
  const saveCaption = useMutation(trpc.photos.setCaption.mutationOptions({ onSuccess: refresh }));
  const remove = useMutation(
    trpc.photos.remove.mutationOptions({
      onSuccess: async () => {
        await refresh();
        props.onClose();
      },
      onError: (e) => setNote(e.message),
    }),
  );

  const p = props.photo;
  const shareable = canShare(p.consent, props.isMinor);
  const text = shareCaption({
    caption,
    services: [],
    shopInstagram: settings?.instagram,
    shopName: settings?.name ?? "",
    clientInstagram: props.clientInstagram,
    consent: p.consent,
    bookingUrl: `${window.location.origin}/book/${shop.slug}?src=instagram`,
  });

  const share = async () => {
    setNote(null);
    if (!p.url) return;
    try {
      const blob = await (await fetch(p.url)).blob();
      const file = new File([blob], "lineup-cut.jpg", { type: "image/jpeg" });
      await navigator.clipboard?.writeText(text).catch(() => undefined);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        setNote("Caption copied too, in case the app drops it.");
      } else {
        // Desktop: save the photo and keep the caption on the clipboard.
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "lineup-cut.jpg";
        a.click();
        URL.revokeObjectURL(a.href);
        setNote("Photo downloaded and caption copied. Post it from Instagram.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote((e as Error).message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="mt-4 grid gap-4 rounded-2xl p-4 ring-1 ring-ink sm:grid-cols-[14rem_1fr]"
    >
      {p.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
        <img src={p.url} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
      ) : null}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted">
            {DateTime.fromISO(p.createdAt).toFormat("cccc, LLL d, yyyy")}
          </p>
          <button
            type="button"
            onClick={props.onClose}
            className="text-sm font-semibold text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Where it can go</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {CONSENT.map((c) => {
              const blocked = props.isMinor && c.value !== "private";
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={p.consent === c.value}
                  disabled={blocked || consent.isPending}
                  onClick={() =>
                    consent.mutate({ shopId: shop.id, photoId: p.id, consent: c.value })
                  }
                  className="rounded-xl p-2.5 text-left ring-1 ring-line transition-colors hover:ring-ink disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-ink aria-pressed:text-paper aria-pressed:ring-ink"
                >
                  <span className="block text-sm font-semibold">{c.label}</span>
                  <span className="block text-xs opacity-70">{c.hint}</span>
                </button>
              );
            })}
          </div>
          {p.consentAt ? (
            <p className="mt-1.5 text-xs text-muted">
              Consent recorded {DateTime.fromISO(p.consentAt).toFormat("LLL d, yyyy 'at' h:mm a")}.
            </p>
          ) : null}
        </fieldset>

        <div>
          <label htmlFor={`cap-${p.id}`} className="mb-1 block text-sm font-semibold">
            Caption
          </label>
          <input
            id={`cap-${p.id}`}
            value={caption}
            maxLength={300}
            placeholder="Clean taper for the weekend"
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() =>
              caption !== (p.caption ?? "") &&
              saveCaption.mutate({ shopId: shop.id, photoId: p.id, caption })
            }
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </div>

        {shareable ? (
          <div className="rounded-xl bg-paper p-3 ring-1 ring-line">
            <p className="whitespace-pre-line text-sm">{text}</p>
            {!props.clientInstagram ? (
              <p className="mt-1 text-xs text-muted">Add their Instagram under Edit to tag them.</p>
            ) : null}
          </div>
        ) : null}

        {note ? <p className="text-sm font-semibold">{note}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void share()}
            disabled={!shareable}
            title={shareable ? undefined : "Mark it Social first"}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-brand hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Share to Instagram…
          </button>
          <button
            type="button"
            onClick={() => remove.mutate({ shopId: shop.id, photoId: p.id })}
            disabled={remove.isPending}
            className="rounded-full border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-paper"
          >
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}
