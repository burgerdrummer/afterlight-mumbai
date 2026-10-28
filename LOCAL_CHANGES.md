# v0.8 lighting layer

- Added a Lighting toggle, enabled by default, alongside Places / Help / CCTV.
- Thin parallel lighting strip on the selected route: charcoal solid (tagged lit),
  near-black dashed (tagged unlit), light-grey dotted (unknown).
- On-map legend with length-weighted percentages, plus hover/tap tag details.
- Uses existing route evidence; does not alter routing, scores or export geometry.
- Continuous same-state geometry is merged without bridging gaps or mutating data.
- Public browser routes retain source-way identifiers for lighting provenance.
- Route selection and the existing identity colours remain intact.

# v0.7 publication

All v0.6 work and the final card-alignment fix are included. Public hosts without
an API endpoint now use the bundled Mumbai walking graph in a browser worker.
Bike/Car hand off to Google Maps; local loopback keeps the full Valhalla service.
The public preview limitation is stated on the page. Sources, per-field hours
licensing, mobile comparison, scores and exports remain available.

Release validation: application tests, data audit, production build, browser
walking-preview QA and hosted publication checks. Paid backend hosting is not
part of this release.

# Local review v0.6

- Route cards sort by descending displayed score; ETA breaks ties.
- Every route has a coloured, clickable key above the map. The selected key and
  path have stronger borders/strokes; alternatives remain visible with lower opacity.
- Places, Help and CCTV are enabled by default.
- Metrics include icons and separate usable-hours and unknown-hours counts.
- Date/time controls have distinct icons; Use my location follows Date/Now below From.
- Fresh bounded OSM import: 78 added schedules, two corrected schedules, 62 added
  places, 18 duplicate matches avoided. Catalogue: 85,449 places / 1,025 schedules.
- Named OSM records link to the editor to contribute missing hours; changes enter
  the next refresh. The normalized overlay survives future PBF imports.
- Source URLs, ODbL licence and object/check timestamps are retained separately.
- Existing always-visible journey controls, all route candidates and explanations
  below the map remain in place.
- Local only; GitHub and public hosting unchanged.

Validation: 39 application tests, six opening-hours pipeline tests, production
build, desktop and mobile browser review. Work logs are in the ignored work/
directory. Source package excludes runtime dependencies and native routing tiles.
