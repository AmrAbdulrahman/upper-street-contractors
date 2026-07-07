# Context map

This repo holds multiple bounded contexts. Each owns its own ubiquitous language.
The same word (e.g. **Entry**, **Field**, **Type**, **drawer**) may mean different
things in different contexts — always read the term in its own `CONTEXT.md`.

| Context | Lives in | Language |
| --- | --- | --- |
| **Website / Strapi** | [`CONTEXT.md`](./CONTEXT.md) | Renovation marketing content + the Strapi-backed inspect/edit experience. Here **Entry** = a Strapi document, **Field** = a Strapi attribute, **Edit drawer** = the inspect-mode panel. |
| **zero-cms** | [`libs/zero-cms-core/CONTEXT.md`](./libs/zero-cms-core/CONTEXT.md) | A standalone, file-system-backed CMS engine (no DB). Here **Entry/Field/Type** mean the zero-cms model, independent of Strapi. Spans `zero-cms-core`, `zero-cms-app`, `zero-cms-widget`. |

System-wide architectural decisions live in [`docs/adr/`](./docs/adr/).
