# Afterlight · Mumbai

A little more context for the way home. An open-source walking-route comparison pilot for **Bandra West, Mumbai**, built with real OpenStreetMap data.

**Experimental, not field validated.** Mapped lighting and scheduled opening hours are contextual signals, not measured safety. Afterlight does not provide live conditions, emergency response, or verified pedestrian access.

## Run it

Requires Node.js 22 or newer. No API key, account, backend, or database is needed.

```sh
git clone https://github.com/burgerdrummer/afterlight-mumbai.git
cd afterlight-mumbai
npm ci
npm run dev
```

Open the Local URL printed by Vite. To verify and build:

```sh
npm test
npm run audit:data
npm run build
npm run preview
```

## What works

- Search seven pilot landmarks or pick mapped street points on the interactive map.
- Compare a shortest walk with distinct alternatives within an extra-time budget.
- Set a departure date and time in **Mumbai time (IST)**.
- Evaluate opening schedules at the estimated time of passing each place.
- Inspect listed open places, mapped lighting, unknown hours and the longest gap without a listed open place nearby.
- Toggle place/help/gap layers, inspect place details, read the street sequence and download GPX.
- Read the complete methodology and data coverage inside the app.
- All route computation and map rendering happen locally. The bundled snapshot works without external map tiles or fonts. Initial page loading still needs the hosting server; this is not an installable offline-navigation app.

## The actual data audit

The initial extract was downloaded on **27 October 2026** from the OSM map API. Bounds: west `72.815`, south `19.045`, east `72.840`, north `19.070`.

| Measure | Initial snapshot |
| --- | ---: |
| Mapped activity/transport/help places | 914 |
| Places with an opening-hours expression | 70 |
| Places with a recorded check date | 8 |
| Routable street length | 94.8 km |
| Street length with interpreted lighting tags | 55.9% |
| Street length with sidewalk metadata | 15.1% |
| Field-verified help entrances | 0 |

These values describe the included graph, not Mumbai as a whole. The check-date count is not a count of independently verified schedules. `data/audit.json` and `public/data/bandra.json` are the machine-readable sources. More mapping can reflect more surveying effort, rather than better conditions.

## How routing works

1. Build a pedestrian graph from OSM ways. Exclude motorways, construction, mapped restricted access, paths with unsupported time restrictions and explicitly blocked nodes. Retain the largest connected component. Do not bridge disconnected streets.
2. Subdivide each existing segment into pieces of at most 25 m for context analysis. This preserves the source geometry; it does not create links between unrelated streets.
3. Generate candidate paths with Dijkstra's algorithm. The shortest option minimises estimated walking time. Alternatives apply a transparent experimental preference for mapped lighting and scheduled open places. Additional penalised-path searches provide route diversity.
4. Apply the user's detour budget, analyse each candidate at its estimated passing times, and show up to three distinct alternatives. This is **not an exhaustive search for the safest route**.

Default walking speed is 1.25 m/s; steps use 0.75 m/s. Times exclude crossing waits, gradient, congestion and individual mobility differences.

For a segment, positive context is `0.45 × mapped-lit + 0.55 × nearby-listed-open`, with each input either 0 or 1. Candidate edge cost is `walking minutes × (1 + preference × (1 - context))`. Candidate preferences are 0, 0.8, 2 and 5. Diversity searches penalise edges from existing candidates by 1.65. These coefficients are **uncalibrated preference weights**, not probabilities of safety. No main-road, CCTV, crime-data or unverified-help-point bonus is applied.

Route generation uses schedules at departure; final route metrics use estimated passing times. This approximation may miss a better time-dependent route. Geographic proximity is limited to 35 m, and does **not establish entrance accessibility**. The gap metric is approximate to segment resolution; a long gap means missing mapped open-place evidence, not an observed empty/dark street.

Missing/invalid schedules, schedules requiring unsupported holiday information, and ambiguous schedules remain unknown. No opening hours are fabricated. `lit=yes` and selected explicit lighting values contribute mapped lighting; no tag is treated as unknown, never as unlit. Source edits and download time do not prove recent field verification.

## Refresh the snapshot

Optional: Python 3.10+ (standard library only).

```sh
npm run refresh:data
npm run audit:data
npm test
```

This makes **one small bounding-box request** to the OSM map API. It is not a city-scale production data ingestion service. Do not repeatedly refresh, tile-scrape, or expand the bounding box indiscriminately. Review snapshot/audit changes before committing them. For an existing XML extract:

```sh
python scripts/refresh_data.py --input path/to/extract.osm
```

Input XML is intentionally not committed: it includes unneeded map elements and contributor metadata. The processed snapshot omits contributor details, private phone numbers, residential addresses, surveillance locations and incident reports.

## Deploy

This is a static React + TypeScript + Vite application. Publish `dist/` on any static host after `npm run build`.

For a subdirectory deployment (including GitHub Pages), set `VITE_BASE_PATH=/afterlight-mumbai/` before building. `.env.example` documents this optional setting. The included **Publish GitHub Pages** workflow builds with that path. In repository **Settings → Pages**, choose **GitHub Actions** as the source, then run the workflow from the Actions tab. Pages must be enabled before dispatching it.

The separate CI workflow tests the route engine, checks the data graph and builds on pushes and pull requests. Site-specific hosting identity is excluded from the public source distribution.

Docker is also supported:

```sh
docker build -t afterlight-mumbai .
docker run --rm -p 8080:80 afterlight-mumbai
```

Open `http://localhost:8080`.

## Privacy and accessibility

No analytics, accounts, route telemetry, or background location tracking are included. The optional location button asks the browser for permission; location is used on-device and is rejected outside the pilot. Hosting providers receive ordinary requests. External links have their own privacy policies.

Route choices, metrics and street sequences are available in text independently of the WebGL map. Dialogs support Escape, focus return and a keyboard focus trap. The layout adapts to narrow screens and respects reduced-motion settings. The landmark combobox supports typing and Enter; full arrow-key list navigation and a formal accessibility audit are future work.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). The next useful contribution is a **consent-based local data audit with women familiar with the area**, especially checking mapped hours, walking access and misleading recommendations. The pilot needs local evaluation before expansion.

Useful next steps: better time-dependent candidate generation; a replaceable data/routing-provider interface; verified entrance connections; a reviewed data correction process; additional Mumbai areas; Marathi/Hindi localisation; and a separately validated driving mode. Live tracking, emergency alerts and incident feeds are outside this release.

## Licences and credit

Original app code: [MIT](LICENSE). Map data: **© OpenStreetMap contributors, ODbL-1.0**, independently of the code licence. Fonts: SIL Open Font License. The unmodified `opening_hours` library is LGPL-3.0-only; dependency notices, full bundled licence texts and source links are provided in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Inspired by Aevy TV's [NightWise demonstration](https://www.youtube.com/shorts/csS2MHxljfo). This is an independent implementation, not an endorsement or an affiliated product.

