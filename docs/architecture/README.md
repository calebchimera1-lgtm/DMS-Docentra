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
