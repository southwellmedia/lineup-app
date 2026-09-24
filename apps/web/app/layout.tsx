import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TRPCReactProvider } from "@/trpc/client";
import { display, sans, serif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lineup",
  description: "Booking and payments for barbers.",
};

export const viewport: Viewport = {
  themeColor: "#f5f1ea",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
