# Third-party notices

Original Afterlight application code is MIT licensed. This does not relicense dependencies, fonts or data.

## OpenStreetMap

© OpenStreetMap contributors. The processed snapshot, street graph, geometries and derived audit database originate from OSM and are made available under **Open Database License 1.0**. See <https://www.openstreetmap.org/copyright> and <https://opendatacommons.org/licenses/odbl/1-0/>. The snapshot includes source attribution and is downloadable from the app; the included map displays attribution.

## opening_hours.js

The unmodified npm package `opening_hours` (see `package-lock.json` for the exact version) is distributed under **LGPL-3.0-only**. Copyright belongs to its authors and contributors. Source, notices and corresponding project files: <https://github.com/opening-hours/opening_hours.js>. Exact package source: <https://www.npmjs.com/package/opening_hours?activeTab=code>.

Its shipped licence texts are retained under `public/licenses/opening_hours/`. Some auxiliary repository/data files have different notices; those notices remain applicable. Afterlight does not modify the library. You can replace the dependency or modify its source and rebuild using the complete app source and the documented npm build procedure. No restriction is imposed on debugging modifications to the library. This application's experimental weights and source-data limitations are independent of the library authors.

## Fonts

DM Sans and Manrope are bundled locally, under SIL Open Font License 1.1. Font copyright notices and full licence terms are in `public/fonts/dm-sans-OFL.txt` and `public/fonts/manrope-OFL.txt`. Sources: <https://github.com/google/fonts/tree/main/ofl/dmsans> and <https://github.com/google/fonts/tree/main/ofl/manrope>.

## Other principal libraries

- Additional facility records: Overture Maps Foundation and its recorded providers.
  See `public/licenses/data/OVERTURE-NOTICES.md` and the downloadable per-record
  provenance database. Combined OSM-derived data retains ODbL attribution.
- Local routing: Valhalla / pyvalhalla, MIT, <https://github.com/valhalla/valhalla>.
  Optional Python libraries retain their distributed notices and are installed
  separately; their binaries are not included in the source archive.

- React and React DOM: MIT, <https://github.com/facebook/react>.
- MapLibre GL JS: BSD-3-Clause, <https://github.com/maplibre/maplibre-gl-js>.
- Lucide: ISC, <https://github.com/lucide-icons/lucide>.
- Vite: MIT, <https://github.com/vitejs/vite>.
- TypeScript: Apache-2.0, <https://github.com/microsoft/TypeScript>.

Dependency versions and the full dependency graph are recorded in `package-lock.json`. Original package notices remain with the packages and applicable generated distribution notices are retained by the bundler.
