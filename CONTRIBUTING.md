# Contributing

Code changes: install with `npm ci`, run `npm test`, `npm run audit:data` and
`npm run build`. For routing changes also prepare the local Valhalla graph and
run the native tests described in README.md. Include the trigger, expected
behaviour and validation in a pull request.

## Better facility and opening-hour data

Submit reviewed public-business/facility records in
`data/community-places.geojson`, which starts as an empty FeatureCollection.
Do not include personal home addresses, individual travel histories, private
contact details, proprietary map extracts or unlicensed directories.

Each Point feature requires:

- Stable feature `id` (use the existing source ID for a correction, otherwise a
  `community/` prefix), a public facility name, and category.
- Coordinates within Mumbai City/Suburban districts.
- `properties.source`: an HTTP(S) public source that supports the record.
- `properties.licence`: explicit permission to redistribute the submitted data.
- Optional `opening_hours` using OSM syntax, `checked` as YYYY-MM-DD, `phone`,
  `website` and `emergency` (only if the service is documented).

No sample shops or camera points are invented for the real dataset. For syntax
examples, see https://wiki.openstreetmap.org/wiki/Key:opening_hours . A date you
edited a record is not a field-check date. A hospital's existence is not proof
of a 24-hour emergency department. Report an unknown hour as unknown.

The importer validates source, licence, IDs, coordinates and check dates. Review
submissions before merging; repeat `scripts/enrich_places.py` to apply them and
run the data audit. Access verification remains false unless a future reviewed
verification workflow independently establishes entrances and service access.

OSM-derived data retains ODbL requirements; other providers retain their own
notices. Prefer improving OSM itself where appropriate rather than maintaining
an unreviewed parallel database. Never copy Google Maps listings into OSM.

## Public emergency contacts

Changes to `src/core/contacts.ts` need an official supporting URL and a review
date. Keep emergency calls separate from non-emergency reporting/WhatsApp.
Do not test-call emergency services as part of automated QA. Numbers, service
areas and published role descriptions can change; retain the source on screen.

## Scoring

Keep weights, unknown treatment and version explicit in SCORING.md and source.
Add meaningful regression checks for changes that could inflate evidence,
violate a detour/access constraint, or misrepresent missing data. No neighbourhood
crime/safety labels may be inferred from mapping density or cameras.
