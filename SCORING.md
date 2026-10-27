# Afterlight Score · v0.6 interface

The score summarizes mapped support. It is not measured safety or a probability
of harm. Compare routes for the same mode and departure. The calculation lives
in `src/core/scoring.ts`; the recommendation rule is in `presentation.ts`.

## Dataset audit and excluded factors

The current Mumbai import records **zero verified assistance entrances** and
**zero checked assistance access routes** (`audit.verifiedHelpEntrances = 0`,
`enrichment.accessVerified = 0`). The analyzer does not establish reachability.
There is **no connected current road-condition feed**. Both factors were always
zero in v0.3/v0.4; they now carry **no weight** and are absent from the scored
factor list. They remain explicitly documented below the map. Nearby assistance
listings are context, not verified reachable services. CCTV is also excluded.

The remaining data is sparse too: the legacy walking graph has 3.9% lighting-tag
coverage and 2.3% sidewalk-tag coverage. The merged facility catalogue contains
85,449 places, with 1,025 recorded schedules (about 1.2%). These are snapshot-wide
figures, not route coverage or live availability. Native road evidence can differ
from the legacy walking graph. Unsupported factors should only be reintroduced
with usable citywide inputs and a new published score version.

## Fixed supported-input weights

| Factor, night | Walk | Bike | Car |
| --- | ---: | ---: | ---: |
| Mapped walking infrastructure / road surface | 40 | 60 | 70 |
| Street lighting | 35 | 25 | 20 |
| Places listed open along the route | 25 | 15 | 10 |
| Total | 100 | 100 | 100 |

| Factor, day | Walk | Bike | Car |
| --- | ---: | ---: | ---: |
| Mapped walking infrastructure / road surface | 70 | 80 | 85 |
| Street lighting | 0 | 0 | 0 |
| Places listed open along the route | 30 | 20 | 15 |
| Total | 100 | 100 | 100 |

These are explicit product judgments, not empirically calibrated weights. They
redistribute the unsupported assistance/conditions budget across inputs that the
pipeline actually supplies. Walking emphasizes pedestrian infrastructure and
lighting; vehicles emphasize recorded surface. Daylight removes the lighting
weight. Presets are fixed for the city and are never renormalized to whatever
happens to be known on one route. Sparse data can still produce low scores.

For each segment, multiply the preset weight by its fraction of route length,
then by the observed quality. Sum the earned points and round to a single integer
out of 100. Coverage is the weighted fraction with interpretable observations and
is shown separately. Unknown observations earn zero, and a known negative value
(such as `lit=no`) resolves coverage without earning positive points. Solar
position at passing time determines day/night; mixed journeys blend by length.
Internal diagnostic bounds remain in the data model but are never the UI score.

Mapped infrastructure means sidewalk/pedestrian-path tags for walking, and
recorded surface type for vehicles. It no longer reserves a permanently
unscorable fraction for absent crossing/junction observations: those are explicitly
outside this model. Sidewalks earn full infrastructure credit, steps half, and
other mapped pedestrian paths 85%. Paved vehicle surfaces earn full credit;
rough surfaces earn less (bike 10%, car 30%; stone/pavers 50%). Surface type does
not establish current condition, traffic danger or pothole absence.

Activity is length-weighted proximity to at least one facility with an
interpretable schedule that says open at estimated passing time: within 50 m for
walking and 100 m for vehicles. Duplicate density adds no extra points. Place
existence and Overture operating status never substitute for opening hours.

## Recommendation and map identities

Routing first applies the chosen mode, access rules, avoid options and maximum
extra-time budget. Among returned eligible candidates, **the highest displayed
Afterlight Score is Recommended**. Equal integer scores prefer the shorter ETA,
then the unrounded earned score if ETAs also tie. Coverage is visible context and
does not secretly override this ordering. Recommendation is relative mapped
support among these candidates, not certification of the safest possible route.

Recommended is green (`#00866b`); a distinct Fastest route is blue (`#2563eb`).
Alternatives are purple/amber. When one route wins both, there is one green path
and card labelled `Recommended · Fastest`. All returned routes appear by default.
Shared sections have small visual offsets so alternatives remain distinguishable;
underlying coordinates and exports are unchanged. One selected-route ETA pill
avoids overlapping time labels. Selecting a card does not reset map bounds.

The full factor breakdown, excluded inputs, nearby facilities, journey notes and
directions are visible below the map. Journey fields and preferences remain open
after every search. Estimates omit live traffic and unverified off-street access.

## v0.6 presentation and data update

Cards and the interactive map key sort by descending integer score, with shorter
ETA first for ties. Original indices retain stable map identities. The selected
path uses a 9 px solid stroke with a 15 px white outline; alternatives use 4 px
strokes at 62% opacity. All three facility layers start enabled. The score model
and fixed presets remain `0.5-mapped-support-1`.

A bounded OSM refresh added explicit schedules with retained provenance. See
OPENING_HOURS.md and data/opening-hours-audit.json. The metric now distinguishes
usable schedules from unknown hours so a zero open count is not mistaken for a
claim that no businesses exist. No brand/category or operating-status assumptions
were added to scoreRoute or hoursState.

## Public v0.7 walking preview

A public host without a configured routing API uses the bundled pedestrian graph
in a browser worker. Its candidates are analyzed by the same JourneyAnalyzer and
scoreRoute functions, with the same three fixed inputs. Its shortest ETA uses
static pedestrian/stairs speeds, with no live traffic. Known stairs and unpaved
surfaces are skipped when requested; a street approach farther than 120 m is
rejected. The full native turn/access processing remains in service mode. Bike
and Car never use this walking graph; they hand off to Google Maps in the public
preview until a native API is configured. This distinction is visible in the UI.

## v0.8 lighting map layer

The selected route's original evidence geometry is displayed as a 13 px visual
parallel offset, preserving the route's green/blue identity and export geometry.
`yes`, `24/7`, `automatic`, and `sunset-sunrise` map to Tagged lit; only `no` maps
to Tagged unlit. Missing, limited, unrecognized and ambiguous tags map to Unknown.
Unknown is grey/dotted rather than an unlit assertion. The legend is length
weighted, is independent of the scoring weights and describes mapped tags at any
time of day. It is not a live streetlight reading. Toggling it does not reroute,
change scores or reset map bounds. Only the selected route's lighting is shown.
