# Architecture

Design docs for Omniflow's overall system architecture: module boundaries,
Clean Architecture / DDD layering (controllers → services → repositories),
multi-tenant model (company/branch scoping), plugin system, and
microservice-readiness (how `apps/api` modules are split so any of them can
be extracted into a standalone service later without a rewrite).

Populated incrementally alongside the milestones in the root `README.md`.
The first substantive doc lands with Milestone 2 (an ER diagram of the
core schema) and Milestone 6 (the plugin system and service-boundary
rationale).

## Frontend (apps/web), added in Milestone 5

- **Auth state** is client-side: `providers/auth-provider.tsx` holds the
  current user in React context, backed by tokens in `localStorage`
  (`lib/auth-storage.ts`) rather than cookies — simplest option given the
  API and web app are separate origins in dev, with no shared-cookie
  complexity to manage. `lib/api-client.ts` attaches the access token to
  every request and transparently refreshes it once on a 401 (deduping
  concurrent refresh calls), clearing auth and redirecting to `/login` if
  the refresh itself fails.
- **Route protection is client-side**, not Next middleware: the
  `(dashboard)` route group's layout renders `DashboardShell`
  (`components/dashboard-shell.tsx`), which redirects to `/login` if
  there's no authenticated user once the initial `/users/me` check
  resolves. This was a deliberate simplification over middleware-based
  (cookie-checked, server-side) redirects — revisit if the flash of a
  loading state before redirect becomes a real UX problem.
- **UI primitives** (`Button`, `Card`, `Input`, `Badge`) live in
  `packages/ui` — small, hand-written, shadcn/ui-style components (Tailwind
  + `class-variance-authority`), not generated via the shadcn CLI, so
  there's no hidden codegen step. Dashboard-specific widgets
  (`StatTile`, `ActivityBarChart`, `RecentActivityFeed`, `Sidebar`,
  `Topbar`) live in `apps/web/src/components` for now; promote a
  component to `packages/ui` once a second app or module needs it.
- **Charts** follow the dataviz skill's method: single-series data gets a
  plain HTML/CSS bar list (not a charting library) with the mark spec
  (24px cap, 4px rounded data-end, hairline gridline, value at the tip),
  colored from CSS custom properties (`--chart-series-1`,
  `--chart-gridline` in `globals.css`) that swap between the skill's
  validated light/dark steps — no legend, since a single series is
  already named by the card title.
