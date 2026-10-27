# Opening-hours coverage and refresh

## Local v0.6 audit · 27 October 2026

The catalogue grew from **85,387 to 85,449 places**. Explicit schedules grew from
**947 to 1,025**: 78 added schedules, two changed schedules, 62 additional places.
The public Overpass response had 1,624 objects; the importer retained 1,025
scheduled public-facility records inside the Mumbai City/Suburban polygons.
It skipped private access, non-facility objects and locations outside that area.
Name/coordinate matching avoided adding 18 duplicate place records.

An evaluation at **23:30 IST on 27 October 2026** found 262 citywide records listed
open, versus 238 before this refresh. At noon the count rose from 826 to 895.
These are counts at a fixed time across the dataset, not counts along a journey.
Routes evaluate schedules at passing time and within their proximity radius.

Only about 1.2% of the catalogue has a schedule, so some routes will still have
zero confirmed listed-open places. Most of the large Overture catalogue does
not supply opening-hour fields. Its operating status is not a weekly schedule:
https://docs.overturemaps.org/schema/reference/places/place/

## Repeat the update

Run `npm run refresh:hours` with network access. It makes one bounded Overpass
query, clips results to district polygons, merges explicit hours and writes the
local manifest, compressed facilities, normalized overlay and audit. No accounts
or API keys are needed. A partial/error response is rejected before applying it.

- `data/opening-hours-osm.json`: normalized OSM schedules and provenance.
- `data/opening-hours-audit.json`: before/after counts and source timestamp.
- `work/latest-hours-overpass.json`: ignored raw response.
- `scripts/refresh_opening_hours.py`: standalone refresh/merge code.
- `scripts/test_opening_hours_refresh.py`: filtering, deduplication, dates and
  provenance regression checks; run with `python -m unittest discover -s scripts
  -p test_opening_hours_refresh.py -v`.

The normalized overlay is reused by `enrich_places.py` after a future PBF rebuild;
reviewed community corrections are applied afterward. Run refresh during data
preparation, then reload the local app. It is not a live per-journey API request.

## Provenance and what this does not establish

Every imported schedule keeps its OSM source URL and ODbL licence. An object edit
timestamp is stored as `hoursUpdated`; it does not prove when the hours were last
checked. `checked` is set only from an actual recorded check-date tag. Fetching
today does not turn an old schedule into a field-verified schedule. No accessible
entrances are inferred, and a hotel/bank listing does not establish a help service.

The UI shows usable-hours and unknown-hours counts beside the open count. OSM
facility cards link directly to the editor to add/update hours. Contributions
are made by the user on OSM and enter Afterlight on the next refresh, rather than
being silently published from this app. Existing reviewed community GeoJSON can
also be imported with a public source, reuse licence and real check date.

Larger gains require original shopkeeper/community observations or operator
feeds with explicit reuse permission. Those can use the same provenance-based
merge; missing hours are never guessed from brand, business status or category.
