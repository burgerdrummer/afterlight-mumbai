# Contributing to Afterlight

Run `npm ci`, `npm test`, `npm run audit:data`, and `npm run build` before opening a pull request. Use small, reviewable changes and explain the user-visible effect and how it was verified.

## Data and methodology

- Preserve explicit unknowns. Do not fill missing lighting, hours, crowds or accessibility with invented values.
- Keep map facts, derived contextual signals and personal perceptions distinct.
- A point near a route is not a verified entrance. Do not describe it as accessible until the connection has been audited.
- Add source, collection/check date, methodology and reuse licence for new datasets. Do not copy proprietary map data.
- Keep original OSM attribution and data licensing. Do not imply that the MIT code licence covers OSM-derived databases.
- Explain changes to ranking weights. Add regression cases for a concrete failure rather than assuming a higher score means greater safety.

## Local evaluation

Do not encourage anyone to walk an unfamiliar route at night solely to test this app. Start with desk review and voluntary feedback from people already familiar with the area. Obtain consent for research participation; avoid collecting identifiable incident reports or precise travel histories in public issues.

## Privacy and scope

Do not add analytics, continuous tracking, incident publication, emergency messaging, or account requirements without a documented design discussion. Report software errors with a minimal reproduction and non-sensitive example journey.

## Suggested first issues

1. Validate opening hours and pedestrian access for a small set of consenting local reviewers' familiar journeys.
2. Improve keyboard interactions in the landmark selector and run a formal accessibility audit.
3. Improve candidate generation using time-of-passing rather than departure-only schedules.
4. Investigate licensed, dated lighting and footpath data for another Mumbai pilot area.
