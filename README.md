# CPI Calculator

A BECTU rate-card and inflation calculator widget, embedded in a WildApricot
host page rather than served as its own site. Svelte 5 + TypeScript + Vite.

## Develop

Needs [Node](https://nodejs.org) 20.19+ or 22.12+. Run these from this folder,
in a terminal.

```sh
npm install      # once, and after pulling changes to package.json
npm run dev      # local preview, reloads as you edit -- ctrl-C to stop
npm run check    # reports type and template errors; changes nothing
npm run build    # writes the files to upload into dist/
```

`npm run dev` prints a `localhost` address to open in a browser. Editing the
source, or the JSON in `public/resources/api/`, updates that page immediately;
nothing there affects the live site until you run `npm run build` and upload.

The preview page takes a few query strings: `?mini=false` shows the callout and
the rate cards, `?w=380` constrains the widget to a sidebar width, `?debug`
adds the department switcher, and `?mode=inflation` opens on the inflation
calculator.

## Build output

The build is a **library**, not an app: one classic IIFE script and one
stylesheet, at fixed names ([vite.config.ts](vite.config.ts) explains why an
IIFE and not an ES module).

```
dist/cpi-calculator.js
dist/cpi-calculator.css
dist/resources/api/*.json
```

On the live site the script and stylesheet go in `/resources/scripts/cpi/` and
the JSON in `/resources/api/`. Because those are two different folders, the
embed sets `data-api-base` explicitly: [apiBase.ts](src/lib/apiBase.ts)
otherwise looks for the data beside the script, relative to its own URL, so
that the host's folder path never has to be hardcoded.

## Embedding

The snippet pasted into the host page's content HTML gadget:

```html
<link rel="stylesheet" href="/resources/scripts/cpi/cpi-calculator.css?v=5" />
<div data-cpi-calculator data-department="art" data-mini="false" data-api-base="/resources/api"></div>
<script src="/resources/scripts/cpi/cpi-calculator.js?v=5"></script>
```

Bump `?v=` on both files whenever a new build is uploaded, or the host serves
the cached ones.

Attributes on the mount element:

| Attribute         | Default         |                                                            |
| ----------------- | --------------- | ---------------------------------------------------------- |
| `data-department` | `art`           | `art`, `setdec` or `props`                                 |
| `data-mini`       | `false`         | Both calculators, no callout and no rate cards below       |
| `data-callout`    | `true`          | `false` hides the inflation-calculator promo               |
| `data-mode`       | `rates`         | Which calculator to open on; `?mode=` in the page URL wins |
| `data-api-base`   | script's folder | Where the JSON data files live                             |

More than one widget can share a page. The script mounts every matching element,
and the order above is not required — it is safe to load before or after the
markup it mounts into.

## Data

One JSON file per department in [public/resources/api/](public/resources/api/),
plus `cpi.json` for the inflation figures (which carries its own update
instructions). [SCHEMA.md](SCHEMA.md) documents the rate-card schema.
