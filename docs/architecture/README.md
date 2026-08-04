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
- **Theme is Odoo-inspired**: because every color in the UI already
  flowed through the CSS custom properties in `globals.css`
  (`--primary`, `--background`, `--muted`, `--border`, consumed via
  Tailwind's `hsl(var(--x))` pattern in `tailwind.config.ts`), retargeting
  the whole app's look was a tokens-only change — no component edits.
  `--primary` is now Odoo's brand purple (`#714B67`), `--radius` dropped
  to `0.25rem` for Odoo's flatter/tighter corners, and the body font is
  Roboto (`next/font/google` in `app/layout.tsx`, exposed as
  `--font-roboto`), matching Odoo's backend typeface. Both light and dark
  variants were re-tuned so the purple accent stays legible in both.
  Three secondary accents extend the palette: `--navy` (nav rail
  background), `--warning` (orange) and `--highlight` (yellow) as new
  `Badge` variants in `packages/ui`. These are UI-chrome/status colors,
  not chart-identity colors, so they were checked for WCAG text contrast
  (`navy`/white 10:1, `warning`/dark-text 5.4:1, `highlight`/dark-text
  8:1) rather than run through the dataviz skill's categorical-palette
  validator — that validator governs series-identity colors in a chart,
  and per its own rule a single-measure category breakdown (e.g. the
  dashboard's "Activity by action") stays one series/one hue
  (`--chart-series-1`, still purple), not per-bar colors.
