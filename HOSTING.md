# Keep the website on ChatGPT Sites

ChatGPT Sites already hosts the website. We do not need to move it just to let
people open it on phones. The public v0.7 build calculates walking previews in
the visitor's browser from the bundled Mumbai graph. Bike/Car hand off to Google
Maps until the full routing service has an online endpoint.

The full local engine uses native Valhalla and prepared road tiles. Sites' Worker
runtime cannot run this Python/native service as a long-running process. To offer
full Walk/Bike/Car comparisons online, host only that backend on a suitable server
and connect it to the existing Site. The Site can stay where it is.

`VITE_ROUTING_API` configures a public routing-service base URL (the app appends
`/route`). Local loopback defaults to the Vite `/api/routing` proxy. A non-loopback
host without a configured API uses browser walking. `VITE_ROUTING_MODE=service`
forces service mode for an installation with a same-origin proxy. Rebuild the UI
after changing these public build settings; never put an API secret in a VITE value.

The production service still needs packaging, allowed-origin/CORS configuration,
request/concurrency limits, health checks, TLS, and verification under concurrent
load. The current loopback Python adapter is not an Internet-facing production
server. Precise journey endpoints should stay out of application/access logs.
No external routing server, paid hosting account or domain has been purchased.

The earlier planning estimate below remains a possible backend pilot, not a
requirement to pay for a second frontend host. Capacity must be measured before
opening full routing to broad traffic.

## Earlier backend planning notes

Reviewed 27 October 2026. No hosting account, payment, domain or public deployment
was created during the local redesign.

## Recommended pilot: Render, Singapore, 2 GB RAM

Use Render's `1c-2g` web-service plan (formerly Standard): 1 CPU, 2 GB RAM,
currently $25/month for compute, before applicable taxes and additional usage.
Singapore is an available region. Treat 2 GB as a starting recommendation for
the Mumbai subset, not a load-tested capacity guarantee. Verify the live quote
and resource use before paying or opening the service to a broad audience.

- Pricing: https://render.com/pricing
- Plan specifications: https://render.com/docs/compute-plans
- Regions: https://render.com/docs/regions
- Setup: https://render.com/docs/your-first-deploy

The browser app and its same-origin `/api/routing/*` service must both be
available. A static-only upload cannot run Valhalla. Native routing tiles should
be built during a controlled build, preserved with their ODbL/source notices,
and loaded by the service. The build also needs sufficient temporary memory.
Keep Python, Valhalla and data snapshot versions pinned.

Render supplies a hosted URL and TLS, so a custom domain can wait until the
pilot is useful. The code can stay open on GitHub while users simply visit that
URL on phones or laptops. Mobile users need no GitHub account or Python setup.

Before launch, package the front end and routing service behind the same origin,
configure the allowed public origin, add request/concurrency limits and request
size limits, set health checks, and verify routes under expected concurrent load.
Keep precise journey endpoints out of access logs. The current loopback server
is a local preview adapter; it is not an internet-facing production service.

Render's free web service sleeps after 15 minutes of inactivity and may take
about a minute to wake. I would not use it for a public route-planning pilot that
should respond predictably. Free static hosting is still useful for a landing
page, but does not solve the routing-service requirement.

## Lower-cost alternative: a managed-by-us VPS

Hetzner's published CX23 price in Germany/Finland is currently EUR 5.49/month,
excluding IPv4 and VAT. Region and latency differ from a Singapore service; we
would need to maintain the operating system, proxy, TLS, service restarts,
updates and monitoring ourselves. This is an option if a lower fixed compute
bill is more important than managed operations.

Official price list:
https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/

## Installable web app

The source now includes a web manifest, home-screen icons and a production
service worker. Users can add the site to their home screen on supported
browsers after it is hosted securely. Offline navigation falls back to a small
public-contact page. Routing, business schedules and current map data still
need an online service; installing the app does not make routing offline.

Only the help page, manifest and icons are cached. Route requests, coordinates,
map databases and browsing/navigation URLs are not persisted by the worker.
The worker is disabled in Vite development so local edits are never served from
an outdated offline cache. It runs in the production build / preview.
