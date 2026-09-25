import type { Metadata } from "next";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "UI kit · Lineup", robots: { index: false } };

/** Every shared component in one place, for building and reviewing screens. */
export default function UiKitPage() {
  return <Gallery />;
}
