import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted">That page or shop doesn&apos;t exist.</p>
      <Link href="/" className="text-accent underline underline-offset-4">
        Go home
      </Link>
    </main>
  );
}
