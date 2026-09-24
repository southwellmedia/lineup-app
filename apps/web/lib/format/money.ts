const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Integer cents → "$35.00". Money is only ever formatted at the UI edge. */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
