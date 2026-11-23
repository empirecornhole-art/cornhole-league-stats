import Link from "next/link";

// Rendered inside the root layout, so the nav and footer stay in place. Next
// serves this with a 404 status and a noindex tag automatically.
export default function NotFound() {
  return (
    <main className="bg-brand-bg">
      <section className="mx-auto max-w-3xl px-4 py-24 text-center md:px-6 md:py-32">
        <span className="eyebrow">Error 404</span>
        <h1 className="heading-page mt-4">Page not found</h1>
        <p className="mx-auto mt-5 max-w-xl font-sans text-lg text-brand-textSecondary">
          That page doesn&apos;t exist, or it moved. Here are the places most people are looking for.
        </p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/leagues" className="btn-primary">
            League standings
          </Link>
          <Link href="/events" className="btn-secondary">
            Upcoming events
          </Link>
          <Link href="/" className="btn-secondary">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
