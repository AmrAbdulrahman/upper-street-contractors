# 26. Address lookup is a server-proxied type-ahead, not the vendor's browser widget

Date: 2026-09-13

## Status

Accepted. Retires the postcodes.io calls in `wizard.tsx`.

## Context

The Enquiry Wizard's Your Info step asks for an address. Until now it called
[postcodes.io](https://postcodes.io) directly from the visitor's browser: `/postcodes/:pc/autocomplete`
for a postcode type-ahead, then `/postcodes/:pc` to fill Town and Region.

postcodes.io holds no [PAF](https://www.poweredbypaf.com/) data, so it can only ever
suggest *postcodes* — never the addresses at one. The two address lines were always
typed by hand, which is the slowest part of the form on a phone and the part that most
often arrives mistyped in the Enquiry email. [Ideal Postcodes](https://ideal-postcodes.co.uk)
has the addresses, so the fix was always going to be a paid, keyed API.

Ideal Postcodes ships a React package whose documented integration mounts a widget in
the browser with the key in client code, restricted by Allowed URLs. That is a
legitimate design and the vendor supports it. Three things about *this* repo argue
against it:

1. **`CONTEXT.md`'s "Read-only service token" entry rules the vocabulary out on
   purpose** — "Public API, anon key, API key" are listed under _Avoid_. The repo has
   no `NEXT_PUBLIC_*` variable at all; this would have been the first.
2. **[ADR 0013](./0013-cookie-consent.md) makes any third party the *browser* contacts
   a consent-gated one.** Gating an address lookup on Functional cookies means a
   visitor who refuses them loses the ability to have their address filled in —
   consent purchased with usability, for a technology that stores nothing on their
   device.
3. **Credits are real money**, and a browser-side widget has nowhere to cache.

The pricing shape is what decides the interaction design. Ideal Postcodes bills a
credit for *resolving* an address, and **charges nothing for autocomplete**. A
type-ahead is therefore both the nicer experience and the cheaper one: the list can
follow the keyboard for free, and the bill tracks completed enquiries rather than
traffic.

Against all this: the existing postcodes.io call is itself an undocumented
browser-direct third-party call with no ADR, no glossary term and no consent gate.
Whatever we chose had to settle that too.

## Decision

- **A Route Handler, `GET /api/address-lookup`, is the only thing that talks to the
  vendor**, in two steps that mirror how it is priced:
  - `?q=<partial>` — suggestions. Free, rate-limited generously, and **not cached**:
    while someone types, every keystroke is a new prefix, so a cache read before
    the vendor call is latency spent to miss. Free to fetch means nothing to save.
  - `?id=<hit id>` — the full address behind one suggestion. One credit; rate-limited
    tightly; cached for `IDEAL_POSTCODES_CACHE_TTL_DAYS`. The paid half is the
    only half worth caching.

  `IDEAL_POSTCODES_API_KEY` is an ordinary server secret. The browser only ever calls
  this origin, so there is **no `categories.ts` entry and no `CONSENT_VERSION` bump** —
  not an oversight, a consequence.
- **The route returns our own shapes, never the vendor's.** `Suggestion` is
  `{ id, label }` with `id` opaque to the browser; `LookupAddress` is
  `{ line1, line2, town, postcode, organisation }`. The wizard has never heard of
  `post_town` or `udprn`. Swapping provider is one file — the same property
  `.env.example` already claims for SMTP ("nothing here is Resend-specific").
- **Vendor error text never leaves the server.** `4010` invalid key, `4011` URL not
  whitelisted, `4021` balance depleted and `4022` key disabled all name our account
  state; they are logged and returned to the browser as `"unavailable"`.
- **The field is an ARIA combobox over a listbox**, positioned absolutely so opening
  and closing it never moves the fields beneath. Arrow keys move the highlight, Enter
  takes it, Escape closes, an outside click closes, and `aria-activedescendant` keeps
  focus in the input throughout. The status line beneath is a permanently-rendered
  `aria-live` region, so the first keystroke does not push the form down.
- **The search debounces at 200ms**, short because suggestions are free and the list is
  meant to keep up with the keyboard. Seventeen characters typed produces one request.
- **The same guard set as [ADR 0014](./0014-enquiry-attachments-inline-plus-hosted.md):**
  per-IP `INCR`/`EXPIRE` rate limits that **fail open**, in two buckets so free typing
  cannot exhaust the budget that protects paid resolves.
- **postcodes.io is removed entirely.** One vendor, one code path, and the un-gated
  browser-direct call goes with it.
- **The address fields stay visible and editable throughout.** The lookup fills them;
  it never gates them. An unreachable API costs autofill, not the enquiry.
- **The `region` field is retired.** It existed because postcodes.io could only offer a
  town and an administrative region. Ideal Postcodes' own guidance is to avoid county
  data, and a UK address is identified by its first line plus its postcode.

## Considered options

- **The vendor's React package, key in `NEXT_PUBLIC_`.** Rejected on the three counts
  above, plus: it pulls `@ideal-postcodes/core-axios` into the client bundle, injects
  its own DOM into React-owned markup (needing `controller.removeAll()` on unmount),
  and ships CSS that has to be fought into line with our tokens.
- **The vendor's package pointed at our origin via `baseUrl`.** Keeps the widget, drops
  the public key — but we would have to mirror the vendor's response shapes exactly and
  keep up with them across versions. All of the coupling, none of the freedom.
- **Postcode in, then a `<select>` of the addresses at it.** Built first, and it worked.
  Rejected on sight: it asks for a whole postcode before it will help, where the
  type-ahead helps from the third character; it bills a lookup per search rather than
  per enquiry; and it puts a second control on screen for a job one can do.
- **Keeping postcodes.io for a free postcode type-ahead.** Moot once autocomplete turned
  out to be free — going all-in on one vendor is both cheaper and simpler.
- **Hiding the address fields until an address is picked** (the vendor's
  `hide`/`unhide` pattern). Rejected: layout shift, and it puts a working network call
  between a visitor and finishing the form.

## Consequences

- `IDEAL_POSTCODES_API_KEY` must be set on Vercel for Production, Preview **and**
  Development — there is no `vercel.json`, so env is dashboard-only and nothing in the
  repo checks it. Unset, the route answers `"unavailable"`, the address fields stay
  typable and the enquiry still sends.
- **Allowed URLs must be left empty on this key.** That list is checked against the
  `Referer`/`Origin` of the request; a server sends neither, so a populated list
  rejects every call with `4011` — which is exactly what happened the first time this
  ran against a key still carrying a browser-era whitelist. The remaining control is
  the daily lookup cap, which does apply, and should be set.
- Cost tracks enquiries, roughly one credit each, not traffic. Typing is free at the
  vendor and uncached here, so a search always reflects live PAF. Credit is prepaid and
  expires after 12 months. It is left out of the README's subscription totals because
  it is usage drawn down by real enquiries, not a recurring charge.
- The Privacy Policy now names an address lookup provider, and says the request comes
  from our server rather than the visitor's browser. `scripts/seed-legal-pages.mjs`
  carries that copy.
- A postcode still reaches a third party — just ours-to-theirs rather than
  browser-to-theirs. That is a processor relationship to record, not a consent one.
- `scripts/seed-drop-region-field.mjs` retires the `region` field in two passes: the
  unlink and reorder land as a draft immediately, and the entry itself can only be
  deleted once the wizard is published (reference integrity counts published values).
  Re-run it after publishing.
