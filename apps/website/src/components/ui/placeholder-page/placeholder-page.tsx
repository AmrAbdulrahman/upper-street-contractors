import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <main className="mx-auto max-w-container px-6 py-20">
      <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
        Placeholder
      </p>
      <h1 className="mt-2 font-serif text-4xl text-dark">{title}</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        This page is a stub while the full service content is being built.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline"
      >
        ← Back to home
      </Link>
    </main>
  );
}
