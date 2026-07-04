import Link from "next/link";

const WHATSAPP_HREF = "https://wa.me/447588376345";

export function ProjectCta() {
  return (
    <section className="bg-dark text-white">
      <div className="mx-auto max-w-container px-6 py-[88px] text-center">
        <h2 className="font-serif text-[clamp(28px,3.4vw,42px)] leading-tight text-white">
          Ready to start your project?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-white/70">
          Send photos on WhatsApp or request a site visit for a detailed,
          broken-down quote.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full bg-whatsapp px-7 text-sm font-semibold text-white transition hover:brightness-110"
          >
            💬 WhatsApp Us
          </a>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/35 bg-transparent px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
          >
            Request a Quote
          </Link>
        </div>
      </div>
    </section>
  );
}
