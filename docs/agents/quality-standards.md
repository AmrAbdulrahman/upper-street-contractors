# Quality standards

Non-negotiable standards for every UI/frontend task in **upper-street-contractors**.

## SEO

**Target: Lighthouse SEO score = 100.** Performance and best-practices should stay high; do not trade SEO for shortcuts.

### Metadata

- Every page exports unique `metadata` via Next.js Metadata API (Next 16 — read `node_modules/next/dist/docs/` before writing).
- Required per page: `<title>`, `meta description`.
- Add Open Graph + Twitter card tags, canonical URL.
- Set `lang` on `<html>` in root layout.

### HTML structure

- Semantic elements: `<nav>`, `<main>`, `<footer>`, `<article>`, `<section>` as appropriate.
- One `<h1>` per page; headings in order (`h1` → `h2` → `h3`), no skipped levels.
- Descriptive link text — never "click here" or bare URLs.

### Images and media

- Use `next/image` for all images.
- Every meaningful image has descriptive `alt` text.
- Decorative images: `alt=""` or `aria-hidden`.

### Crawlability

- Provide `sitemap.xml` and `robots.txt` (Next.js metadata routes).
- Add valid structured data (JSON-LD) where relevant (e.g. organization, breadcrumbs, articles).
- Avoid layout shift (CLS) and render-blocking regressions.

## Accessibility

**Target: WCAG 2.1 AA.** Screen reader and keyboard users must be first-class.

### Semantic HTML first

- Use native elements (`<button>`, `<a>`, `<input>`, `<label>`) before ARIA.
- ARIA only fills gaps: `aria-label`, `aria-expanded`, `aria-current`, `aria-describedby`, `role` where native semantics are insufficient.

### Keyboard and focus

- All interactive elements reachable via keyboard.
- Visible focus ring on every focusable element — do not remove `outline` without a replacement.
- Logical tab order matching visual order.
- Include a skip-to-content link at the top of the page.

### Forms

- Every input has an associated `<label>` (or `aria-label` when a visible label is not possible).
- Validation errors announced via `aria-live` and linked with `aria-describedby`.

### Visual and motion

- Text contrast >= 4.5:1 (WCAG AA). Do not rely on color alone to convey meaning.
- Decorative icons: `aria-hidden="true"`.
- Respect `prefers-reduced-motion` — disable or reduce animations when the user requests it.

## Responsiveness

**Target: works on all form factors.** Mobile-first Tailwind 4.

### Breakpoint strategy

- Mobile-first: base styles for small screens, layer up with `sm:`, `md:`, `lg:`, `xl:`, `2xl:`.
- Test at: 320px, 375px, 768px, 1024px, 1440px.
- No horizontal scroll at any breakpoint.

### Layout

- No fixed pixel widths that cause overflow — use fluid sizing, `max-w-*`, `flex`/`grid` with wrap.
- Tap targets >= 44px on touch devices.
- Readable font sizes on mobile (minimum 16px for body text to avoid iOS zoom-on-focus).

### Design tokens

- Use tokens from `src/app/globals.css` (`bg-surface`, `text-foreground`, etc.).
- Keep responsive variants consistent across sections and UI components.

## Verification gate

Before marking any UI/frontend task done:

1. Run `/verify-app` (Chrome DevTools MCP) — see `docs/agents/verification.md`.
2. Run a Lighthouse audit. **SEO must score 100.** Fix anything below target before reporting complete.

Skip for read-only Q&A, docs-only edits, or when the user opts out.
