"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type DesignMedia = {
  /** Public URL prefix of the site-media bucket. */
  baseUrl: string;
  /** This shop's folder in the bucket, "<shop id>/". */
  folder: string;
  /** Photos still uploading; saving waits until this is 0. */
  uploading: number;
  track: <T>(work: Promise<T>) => Promise<T>;
};

const Context = createContext<DesignMedia | null>(null);

export function DesignMediaProvider(props: {
  baseUrl: string;
  folder: string;
  children: (uploading: number) => ReactNode;
}) {
  const [uploading, setUploading] = useState(0);
  const track = useCallback(async <T,>(work: Promise<T>) => {
    setUploading((n) => n + 1);
    try {
      return await work;
    } finally {
      setUploading((n) => n - 1);
    }
  }, []);
  const value = useMemo(
    () => ({ baseUrl: props.baseUrl, folder: props.folder, uploading, track }),
    [props.baseUrl, props.folder, uploading, track],
  );
  return <Context.Provider value={value}>{props.children(uploading)}</Context.Provider>;
}

export function useDesignMedia(): DesignMedia {
  const value = useContext(Context);
  if (!value) throw new Error("useDesignMedia() must be used inside the design editor");
  return value;
}
