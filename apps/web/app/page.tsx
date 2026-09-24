import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div aria-hidden className="pole mb-10 h-3 w-24 animate-pole rounded-full ring-2 ring-ink" />
      <p className="font-serif text-2xl text-muted">Booking for barbers</p>
      <h1 className="font-display text-7xl font-black uppercase leading-[0.85] tracking-tight">
        Your clients.
        <br />
        Your brand.
        <br />
        <span className="text-brand">Your money.</span>
      </h1>
      <p className="mt-6 max-w-md text-lg text-muted">
        Flat pricing, no commission on the clients you bring in, and a booking page that looks like
        your shop.
      </p>
      <div className="mt-10">
        <Link
          href="/book/southside-cuts"
          className="inline-flex rounded-full bg-brand px-7 py-3.5 font-semibold text-brand-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Try the demo shop →
        </Link>
      </div>
    </main>
  );
}
