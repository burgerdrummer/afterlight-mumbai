# Afterlight · Mumbai

Open-source Mumbai route comparison with mapped-support scores, opening schedules,
nearby services, CCTV context, public emergency contacts and Google Maps handoff.
Code is MIT licensed; OSM-derived data retains ODbL and other source notices.

## Public website

[Open Afterlight](https://afterlight-mumbai-pilot.bumfuzzlex.chatgpt.site)

The public ChatGPT Site includes a **citywide walking preview calculated in the
visitor's browser**. It needs no local server or account. Bike and Car directions
open in Google Maps. Full Afterlight Bike/Car route comparisons need an online
Valhalla service; those continue to work in the prepared local setup below.

The website can remain on ChatGPT Sites. Only the native routing service needs a
separate suitable host to enable full multimodal comparisons publicly. See
[HOSTING.md](HOSTING.md) for the architecture and remaining backend deployment work.

## v0.8 lighting update

Lighting is enabled by default as a parallel strip beside the selected route.
Charcoal solid = tagged lit; near-black dashes = tagged unlit; light-grey dots = unknown.
The on-map legend reports length-weighted shares. Hover/tap the strip for the
recorded tag and a source-way link where available. Route identity colours stay
green/blue/purple. The display describes mapped tags, not live lighting operation.

## v0.7 release

- Always-visible journey controls and preferences, with all returned routes shown.
- Cards sorted by descending Afterlight Score; green Recommended, blue Fastest,
  purple/amber alternatives. A matching interactive map key highlights selection.
- Default Places / Help / CCTV layers, mobile layout and Google Maps / GPX export.
- Score breakdown, exclusions, icon-led metrics, nearby places and directions below
  the map; both detail cards have aligned bottom edges.
- 85,449 merged facilities; 1,025 recorded opening schedules. No opening hours are
  guessed from business existence or operating status. [Hours audit](OPENING_HOURS.md).
- Explicit fixed mode/day-night scoring weights and separate evidence coverage.
  [Scoring methodology](SCORING.md). Scores are mapped support, not safety probability.
- Home-screen manifest and offline emergency-contact page; map/route databases are
  not cached by the service worker and full offline navigation is not provided.

Public walking uses the bundled pedestrian graph, with static walking speeds,
known stairs/surface preferences and conservative snap limits. It does not inherit
Valhalla's full native turn/access processing. The local service remains the full
mode-specific engine. This distinction is visible in the app.

## Run the prepared local checkout

Requires Node.js 22+ and the prepared Python 3.12+ routing environment:

```sh
npm ci
npm run dev:local
```

Open http://127.0.0.1:5173/ . This starts Vite and the loopback Valhalla service.
If a preview is already running, use its existing tab; do not start duplicate
servers. You can also run `npm run dev` and `npm run router` in separate terminals.
The front end can show data and SOS contacts while the router is unavailable,
but it never substitutes walking geometry for a vehicle route.

## First-time routing setup on another computer

No API key or proprietary routing account is needed. Python 3.12+ is required
for the published pyvalhalla binary wheel. Install into an isolated environment:

```sh
python -m venv work/routing-venv
# Windows PowerShell:
./work/routing-venv/Scripts/python.exe -m pip install -r scripts/requirements-routing.txt
# Linux/macOS use work/routing-venv/bin/python instead of the Windows path.
```

Download the Western India OSM PBF from
https://download.geofabrik.de/asia/india/western-zone.html and keep it outside
`public/`. The reviewed source was 221,665,654 bytes, with OSM data through
2026-10-26 21:24:46 UTC. Build the local engine graph:

```sh
./work/routing-venv/Scripts/python.exe scripts/prepare_routing.py --pbf /absolute/path/western-zone-latest.osm.pbf
npm run dev:local
```

The build retains complete road ways and mapped turn restrictions intersecting
an area around Mumbai, including a buffer for cross-boundary connections. This
review selected 107,506 ways and 294 restriction relations. Valhalla builds its
own directed, mode-aware graph. Generated tiles, regional data, Python packages,
logs and machine-specific configuration are ignored under `work/` and are not
part of the source ZIP.

`regional_context.py` creates enclosing **configuration masks**, not real country
boundary data. These assign India/Maharashtra country defaults, left-side traffic
and Asia/Kolkata time to the local graph. They are never shown as map boundaries
or used as roads. The displayed city boundaries remain actual OSM district polygons.
The Windows build was exercised locally; native setup on other platforms needs
its own verification, including availability of the Spatialite shared library.

## Routing and data foundation from v0.3

- Separate walking, motorcycle/scooter and car profiles with street-segment
  snapping, one-way and mapped turn-restriction support. Ferries are excluded.
- Generate candidates using the same departure instant, ETA-sort them, apply a
  hard extra-time budget and show up to three options. The fastest estimate is
  the lowest ETA among candidates found, not a live-traffic guarantee.
- Avoid stairs (walking), tolls (vehicles), and known unpaved surfaces. Returned
  segments are checked; an option is never silently relaxed to provide a route.
- Street-approach offsets are visible. Their off-network access paths/duration
  are unverified and excluded from on-road ETA rather than drawn as fake links.
- Mode-specific score weights and evidence coverage. The current interface displays
  a single confirmed-point score; details remain in SCORING.md.
- Interactive route comparison. The interface uses route-identity colours and one selected
  map time label; card selection preserves the comparison viewport.
- Named place popups on desktop hover/mobile tap, a searchable route facility
  list, source links, schedules, check dates and listed contact numbers.
- Distinct police, hospital, pharmacy, clinic, transport and roadside-service
  labels. A hospital is not assumed to have an emergency department.
- SOS contacts from official sources: 112, 108, 101, 1916, 139, 1033 and Mumbai
  Traffic Police WhatsApp. Route context changes relevance order, not availability.
- Optional fresh location acquisition and user-initiated location sharing in the
  SOS panel. No automatic alert, emergency call, message or background tracking.
- Current Mumbai date/time with Now/manual departure controls, mobile touch
  controls, swipeable route cards, and a sticky Google Maps handoff.
- Mode-aware Google Maps URLs. Google recalculates and can ignore waypoints;
  two-wheeler availability depends on Maps. GPX retains selected route geometry.
- 180 source-labelled outdoor camera/surveillance records and local licensed
  camera GeoJSON import. Camera counts never influence score or routing weights.

## Places, hours and provenance

The reviewed facility merge contains **85,449 records**, including 76,087
additional Overture records after filtering and conservative name/coordinate
conflation. **1,025 have a recorded opening-hours expression**, up from 894 in the
original city import. An expression can still be unsupported or out of date.
More place records do not establish more places currently open.

- OSM facilities now include medical/roadside categories, public contact fields
  and facility relations, clipped to Mumbai City/Suburban district geometry.
- Overture records are filtered by existence confidence and closure status;
  their granular category is retained. Source records can still contain junk,
  duplicates or inaccurate coordinates. Confidence is not a safety score.
- Overture operating status is NEVER converted into opening hours. Unknown,
  invalid and unsupported holiday schedules stay unknown.
- Runtime facilities: `public/data/mumbai/places-extra.json.gz`.
- Original provider record IDs, licences and provenance:
  `public/data/mumbai/place-provenance.json.gz` (loaded only when downloaded).
- Search/display metadata is served as `manifest.json.gz`; uncompressed
  `manifest.json` remains available for inspection. Neither needs external tiles.
- Original walking audit: `data/mumbai-audit.json`; facility merge audit:
  `data/places-audit.json`. The old graph remains for regression tests and the
  Bandra data remains a legacy data sample, not the current routing engine.

Citywide geographic scope does not mean every shop, lamp or camera is known.
Original walking-network lighting/sidewalk coverage was 3.9% / 2.3%; those are
explicitly labelled legacy network figures in the app. New route coverage is
computed on the actual returned geometry and explicit OSM tags. Engine-inferred
surface defaults are not used as positive source evidence.

Nearby facility candidates are geometric: 50 m for walking and 100 m for
vehicles. Access across walls, railways, divided roads or locked gates has not
been verified. These are not checked detours, and unverified proximity earns
no assistance points. The longest open-place-data gap is also shown.

## Repeat the facility import

The official Overture client downloads a bounding-box subset. The importer then
clips it to the district polygons and retains original provider provenance:

```sh
./work/routing-venv/Scripts/python.exe -m overturemaps download --bbox=72.7732289,18.8921596,72.9817485,19.2694771 -f geojson --type=place -o work/overture-mumbai.geojson
./work/routing-venv/Scripts/python.exe scripts/enrich_places.py --pbf /absolute/path/western-zone-latest.osm.pbf --overture work/overture-mumbai.geojson
```

Do not add proprietary map listings without permission. Use explicit reuse
licences and preserve source notices. The importer has a local OSM facility
cache in `work/osm-facilities.json`; refresh that cache when the input PBF changes.

Reviewed additions/corrections belong in `data/community-places.geojson`, an
empty FeatureCollection in this checkout. Each point needs a stable ID, name,
category, source URL and reuse licence. Optional properties: `opening_hours`,
`checked` (YYYY-MM-DD), `phone`, `website`, `emergency`. Use an existing source ID
to submit a correction. New IDs can use a `community/` prefix. Coordinates must
lie within Mumbai districts. Reimport to validate and apply the file; submissions
never automatically acquire a field-verified access badge. See CONTRIBUTING.md.

For a fresh base map import, use the original `scripts/import_city.py` with the
regional PBF and `scripts/requirements-data.txt`, then run enrichment. The optional
`--cache` argument of the base importer is trusted-local-only (pickle); never
load a cache obtained from someone else.

## Verification

```sh
npm test
npm run audit:data
npm run build
./work/routing-venv/Scripts/python.exe scripts/test_routing.py
```

JS tests cover scoring uncertainty, mode weights, passing-time schedules,
contacts/URLs, camera isolation and legacy city graph connectivity. Native tests
exercise real city journeys across the three travel modes, ferry exclusion,
India/timezone configuration and avoid preferences. No emergency numbers are
test-called; no phone or WhatsApp message is sent during QA.

## Hosting boundary

The public UI is static, but multimodal routing needs Valhalla. `npm run dev:local`
is the supported local review entry point. A standalone GitHub Pages or static
Site upload cannot supply this backend. Before publishing the current version, provision a
routing service and reverse proxy `/api/routing/*` to its `/route` and `/health`
endpoints, with appropriate hosting access controls. The checked-in Pages
workflow only builds the UI and must not be mistaken for a complete deployment.
The existing published v0.1 app has not been changed by this local work.

The routing server binds only to 127.0.0.1 and accepts route requests from the
local Vite origins. No journey access logs, accounts, analytics or travel history
are stored. Public hosting requires a deliberate server configuration review;
this local script is not an internet-facing production deployment.

## Licences

Application code: MIT. OSM-derived databases/graphs: ODbL 1.0, © OpenStreetMap
contributors. Additional place providers retain CDLA-Permissive-2.0, Apache-2.0
or CC0-1.0 terms as recorded. See THIRD_PARTY_NOTICES.md and
`public/licenses/data/OVERTURE-NOTICES.md`. The MIT code licence never overrides
data or dependency terms. Google Maps is an optional external handoff with its
own terms/privacy policy.
